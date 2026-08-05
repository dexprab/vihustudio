const SlideRenderer=(()=>{
  let c,x;
  // Scene Viewport — the resolved on-screen area a Slide's own content
  // actually occupies. Mutable module state, re-resolved at the top of
  // every render() for a canvas opted into adaptive sizing (see
  // __vihuAdaptiveViewport below); every existing canvas (Publish's own
  // throwaway exports, any caller that never opts in) keeps reading the
  // canonical 1080x1350 default it always has.
  let _viewportW=1080,_viewportH=1350;
  let _dpr=1;
  const PANEL_X=70, PANEL_Y=185, PANEL_W=940, PANEL_H=930;
  // Cached after each render() so canvas hit-testing can match clicks to
  // the actual rendered bboxes — including override-driven size shifts.
  let _lastTextElements=[];
  // Sprint 6.1 — scene element bboxes from the most recent render(), used
  // by the canvas drag handler to hit-test scene elements.
  let _lastSceneElements=[];
  // Layer Pack (theme-authored decorations/text — Museum Caption, Wax
  // Seal, etc.) bboxes accumulated across every _renderLayers() call in
  // the current render() pass, then folded into _lastSceneElements once
  // at the very end — see the comment at that concat site for why this
  // can't just push into _lastSceneElements directly.
  let _layerObjectBboxes=[];
  // Unified Layer Ordering follow-up — true for whichever render() pass
  // most recently used the merged, fully-interleaved slide+story+overlay
  // draw order (no Frame/Holder pipeline running for this page). Read by
  // getReorderableIds()/getReorderBucket() so they know the whole page
  // is ONE reorderable group rather than three separate buckets.
  let _lastRenderWasMerged=false;

  const FALLBACK_THEME={
    frame:{ color:'#1D3457' },
    panel:{ color:'#FFFFFF' },
    storyText:{ font:'Arial', size:56, color:'#FFFFFF' },
    footerText:{ font:'Arial', size:24, color:'#FFFFFF' },
    watermark:{ font:'Arial', size:24, color:'#FFFFFF' }
  };
  // Turned off by default per explicit product direction -- see the
  // matching comment on js/themeEngine.js's _defaultOptionsFor(), the
  // real source of truth whenever ThemeEngine is available. Easily
  // reversible: flip these two back to 'bottom-right' / 'show'.
  const FALLBACK_OPTIONS={
    variant:'classic',
    panelStyle:'classic',
    footerStyle:'classic',
    decorations:[],
    pageNumber:'hidden',
    bookTitleVisibility:'hide',
    bookTitlePosition:'bottom-left',
    handleVisibility:'show',
    handlePosition:'top-right'
  };

  function _theme(s){
    if(s && s.theme) return s.theme;
    // Sprint 8.4.2 — Theme Designer Completion. resolveTheme() layers the
    // themeOptions Typography + Colours sub-objects onto the active theme
    // so Theme-level overrides reach the renderer without the renderer
    // having to know about themeOptions schema.
    if(typeof ThemeEngine!=='undefined'){
      try{
        if(typeof ThemeEngine.resolveTheme==='function') return ThemeEngine.resolveTheme();
        return ThemeEngine.getActiveTheme();
      }catch(e){}
    }
    return FALLBACK_THEME;
  }

  function _options(s){
    if(s && s.themeOptions) return s.themeOptions;
    if(typeof ThemeEngine!=='undefined'){
      try{ return ThemeEngine.getOptions(); }catch(e){}
    }
    return FALLBACK_OPTIONS;
  }

  // Sprint 9.3 — Artwork Themes. Same lookup shape as _theme(s), but
  // `null` is a legitimate, common answer (no Artwork Theme selected)
  // rather than something to fall back away from — every artwork-
  // presentation call site below treats a null return as "render
  // exactly like before this sprint existed."
  function _artworkTheme(s){
    if(s && s.artworkTheme!==undefined) return s.artworkTheme;
    if(typeof ThemeEngine!=='undefined'){
      try{ return ThemeEngine.getActiveArtworkTheme(); }catch(e){ return null; }
    }
    return null;
  }

  // ===========================================================
  // Sprint 9.6 — Museum Gallery Theme Support: Slide layout presets.
  // ===========================================================
  // Canonical containership: Slide -> Frame -> Holder -> Element. A
  // layout preset decides only WHERE the Frame sits on the Slide
  // (position/size) — the Frame's own look (border/paper/shadow/fill)
  // stays the Artwork Theme's separate concern (_artworkBorder below).
  // `holders` on a preset is reserved for future multi-Holder layouts
  // (Diptych/Triptych) and is always 1 this sprint — adding those later
  // means teaching the Frame draw path to loop over N holder rects
  // instead of drawing one, not a parallel layout system.
  //
  // `portrait` is deliberately identical to the pre-9.6 fixed panel
  // rect (PANEL_X/Y/PANEL_W/PANEL_H below), so a theme with no `layouts` array
  // (every theme before this sprint) and a Museum Gallery slide that
  // hasn't picked a layout yet both resolve to the exact same
  // geometry — zero regression either way.
  // Sprint 9.7 — `wide` is narrower than its 9.6 shape (was
  // edge-to-edge, leaving zero room for a caption beside it): the
  // Design Board's Wide composition puts the picture on the left ~55%
  // of the slide with a real text column on the right (see
  // _captionRectFor), not just a wider centered rect.
  // Scene Viewport sprint — every entry below now sits inside a Scene
  // Viewport actually shaped to match (see SCENE_VIEWPORT_BY_ASPECT):
  // `landscape`/`full-bleed` were re-authored (previously placement
  // rects inside an always-portrait canvas); `portrait`/`quote` are
  // unchanged (their Viewport stays 1080x1350); `square`/`wide` are
  // re-centered within their own now-correct Viewport dimensions as a
  // consistency pass (no live theme reaches either today).
  const LAYOUT_RECT={
    portrait:    {x:PANEL_X, y:PANEL_Y, w:PANEL_W, h:PANEL_H},
    landscape:   {x:70,  y:130, w:1210, h:820},
    square:      {x:190, y:190, w:700,  h:700},
    wide:        {x:70,  y:200, w:880,  h:600},
    quote:       {x:140, y:460, w:800,  h:380},
    'full-bleed':{x:0,   y:0,   w:1080, h:1920}
  };

  // Scene Viewport — the resolved {w,h} a Slide's own content should
  // occupy, keyed by the same aspect vocabulary LAYOUT_RECT already
  // uses (World Builder v2's own real ASPECT_RATIOS table,
  // tools/world-builder-v2/js/services/engineSchema.js). `portrait`/
  // `quote` match the canonical default exactly (zero pixel change for
  // any existing theme); the others give a Scene's own Aspect Ratio a
  // genuinely differently-shaped Viewport instead of just a placement
  // rect inside an always-portrait canvas.
  const DEFAULT_VIEWPORT={w:1080, h:1350};
  const SCENE_VIEWPORT_BY_ASPECT={
    portrait:    {w:1080, h:1350},
    landscape:   {w:1350, h:1080},
    square:      {w:1080, h:1080},
    wide:        {w:1600, h:900},
    quote:       {w:1080, h:1350},
    'full-bleed':{w:1080, h:1920}
  };

  // Layouts belong to the theme (the spec's words) — same single
  // active-workspace-theme precedent WorkspaceBuilder already
  // established in Sprint 9.4: an active Artwork Theme governs Frame
  // geometry if present, otherwise the Story Theme does.
  function _layoutTheme(s){
    // A synthetic preview slide (Screen 2's carousel) may stamp its own raw
    // theme object here directly -- distinct from s.theme/s.artworkTheme,
    // which _theme()/_artworkTheme() already interpret for other purposes
    // and can't safely be reused for this. Real slides never set this
    // field, so this branch is a no-op for every existing render path.
    if(s && s.layoutTheme) return s.layoutTheme;
    const art=_artworkTheme(s);
    if(art) return art;
    if(typeof ThemeEngine!=='undefined'){ try{ return ThemeEngine.getActiveTheme(); }catch(e){} }
    return null;
  }

  // Per-Slide layout choice lives in slide.metadata.layout — same
  // convention as the existing slide.metadata.cardOverrides bag. No
  // choice yet (or theme has no `layouts` at all) resolves to the
  // theme's first listed layout, or — if the theme declares none — to
  // null, meaning "use the legacy fixed panel rect" (see _panelRectFor).
  //
  // Sprint 9.7 — Museum Gallery Fidelity: "Each layout must define its
  // own composition rather than simply changing aspect ratio." A
  // layout preset may carry `composition` ('below' — title/caption
  // under the Frame, the default; 'right' — Frame left, caption right,
  // Wide's layout; 'quote' — no Frame/Holder at all, just centered
  // quote text). Returns {rect, composition} instead of a bare rect so
  // render() can branch on it; _panelRectFor below still hands back
  // just the rect for every caller that only ever needed geometry.
  // Shared by _resolveLayout (LAYOUT_RECT lookup) and _sceneViewportFor
  // (SCENE_VIEWPORT_BY_ASPECT lookup) so the two tables can never
  // resolve a different aspect for the same slide.
  function _resolvedAspectKey(s){
    const theme=_layoutTheme(s);
    const layouts=theme && Array.isArray(theme.layouts) ? theme.layouts : null;
    if(!layouts || !layouts.length) return null;
    const chosenId=(s && s.metadata && s.metadata.layout) || null;
    const preset=(chosenId && layouts.find(function(l){ return l && l.id===chosenId; })) || layouts[0];
    return preset && (preset.aspect||preset.id);
  }

  function _resolveLayout(s){
    const theme=_layoutTheme(s);
    const layouts=theme && Array.isArray(theme.layouts) ? theme.layouts : null;
    if(!layouts || !layouts.length) return null;
    const chosenId=(s && s.metadata && s.metadata.layout) || null;
    const preset=(chosenId && layouts.find(function(l){ return l && l.id===chosenId; })) || layouts[0];
    const key=_resolvedAspectKey(s);
    const rect=(key && LAYOUT_RECT[key]) || null;
    if(!rect) return null;
    return {rect:rect, composition:(preset&&preset.composition)||'below'};
  }

  function _panelRectFor(s){
    const resolved=_resolveLayout(s);
    return (resolved && resolved.rect) || {x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H};
  }

  // Scene Viewport — the resolved {w,h} a Slide's own content should
  // occupy. Omitted `s` (or a Cover/Hook/End Scene-blueprint page,
  // which has no Aspect Ratio concept of its own) returns the canonical
  // default; a Story-role page resolves through the same aspect key
  // _resolveLayout already uses.
  function _sceneViewportFor(s){
    if(!s) return DEFAULT_VIEWPORT;
    const hasScene=(typeof SceneEngine!=='undefined') && (SceneEngine.getRenderData(s)!==null);
    if(hasScene) return DEFAULT_VIEWPORT;
    const key=_resolvedAspectKey(s);
    return (key && SCENE_VIEWPORT_BY_ASPECT[key]) || DEFAULT_VIEWPORT;
  }

  // The active Layout preset's own `holders` count (Sprint 9.6 reserved
  // this field, "always 1 in V1," but nothing ever populated it until
  // the Builder Convergence Sprint's Scene->Layout conversion started
  // recording a Scene's real Place count). Returns null when the field
  // is absent — every hand-authored Layout today, and any Layout a
  // Theme Author hasn't rebuilt since this field started being
  // produced — so callers must treat null as "unknown, assume one,"
  // never as zero, to stay backward compatible.
  function _activeLayoutHolders(s){
    const theme=_layoutTheme(s);
    const layouts=theme && Array.isArray(theme.layouts) ? theme.layouts : null;
    if(!layouts || !layouts.length) return null;
    const chosenId=(s && s.metadata && s.metadata.layout) || null;
    const preset=(chosenId && layouts.find(function(l){ return l && l.id===chosenId; })) || layouts[0];
    return (preset && typeof preset.holders==='number') ? preset.holders : null;
  }

  // Multiple Artwork Places Per Page — the active Layout preset's real,
  // per-Place rects (position/size/shape/padding/fit/frame), additive
  // alongside the bare count above. Returns null when the preset carries
  // no `placeRects` array (every Layout compiled before this feature,
  // and anything compiled by tools/world-builder/ v1) — callers must
  // treat null the same as "exactly one implicit Place," never crash.
  function _activeLayoutPlaces(s){
    const theme=_layoutTheme(s);
    const layouts=theme && Array.isArray(theme.layouts) ? theme.layouts : null;
    if(!layouts || !layouts.length) return null;
    const chosenId=(s && s.metadata && s.metadata.layout) || null;
    const preset=(chosenId && layouts.find(function(l){ return l && l.id===chosenId; })) || layouts[0];
    return (preset && Array.isArray(preset.placeRects) && preset.placeRects.length) ? preset.placeRects : null;
  }

  // Maps one Place's fractional (0..1) rect onto the given stage rect.
  // Callers now pass the FULL Scene Canvas (`_sceneCanvasRect(s)`), not
  // the inset legacy `panelRect` — matching Builder's own Scene canvas
  // convention exactly: a Theme Author authors `holder.position`/`.size`
  // as fractions of the Scene's own full canvas (1080x1080 for square,
  // 1350x1080 for landscape, etc.), and Studio now honours those same
  // fractions on the same canvas rather than silently rescaling them
  // onto the pre-Multi-Place-era inset LAYOUT_RECT (which existed to
  // reserve margins for legacy Story-Theme chrome — Handle/Footer/Page
  // Number — none of which a Multi-Place-era Layout carries alongside
  // its own authored Places). Applied uniformly to every LAYOUT_RECT
  // aspect (portrait/landscape/square/wide/quote). Byte-identical for
  // every theme with no `placeRects` at all (Museum Gallery, every
  // legacy theme), since those still fall through to `panelRect` at the
  // three call sites via the `_places && _places.length ? ... : ...`
  // fallback — this function only ever runs for a Multi-Place-era Layout
  // that authored real `placeRects`, which is exactly the case where
  // Builder maps against the full canvas too.
  function _placePixelRectFor(stageRect,place){
    const pos=(place && place.position) || {x:0,y:0};
    const size=(place && place.size) || {w:1,h:1};
    return {
      x: stageRect.x + (pos.x||0)*stageRect.w,
      y: stageRect.y + (pos.y||0)*stageRect.h,
      w: Math.max(1,(size.w||0)*stageRect.w),
      h: Math.max(1,(size.h||0)*stageRect.h)
    };
  }

  // The full Scene Canvas rect a Multi-Place Layout's `placeRects` are
  // authored against in Builder — `_sceneViewportFor(s)` already resolves
  // the real (per-aspect) canvas size a Slide occupies, so this is just
  // that value origined at (0,0). Kept as its own tiny helper both so
  // the intent at each call site reads clearly ("map Places onto the
  // full Scene canvas, matching Builder") and so a future change to the
  // Scene Canvas coordinate system only has one place to update.
  function _sceneCanvasRect(s){
    const vp=_sceneViewportFor(s);
    return { x:0, y:0, w:vp.w, h:vp.h };
  }

  // Multiple Artwork Places Per Page — every place selection/storage id
  // used elsewhere in this file (Object Strip cards, app.js's hit-test,
  // slide.metadata.placeContent/slide.placeImages keys) is index-based
  // ('image-holder' for index 0, 'image-place-N' for index N-1>=1) —
  // deliberately DIFFERENT from a compiled Place's own Builder-authored
  // `id` field (e.g. 'holder-2'), since two Places sharing one compiled
  // theme could coincidentally reuse an id another theme already uses
  // for something else entirely. This one small pair of helpers is the
  // single place that translates between the two id spaces, so every
  // other function in this file only ever has to deal with one of them
  // at a time.
  function _placeIndexForId(placeId){
    if(!placeId || placeId==='image-holder') return 0;
    const m=/^image-place-(\d+)$/.exec(placeId);
    return m ? (parseInt(m[1],10)-1) : -1;
  }
  function _placeByExternalId(s,placeId){
    const idx=_placeIndexForId(placeId);
    if(idx<0) return null;
    const places=_activeLayoutPlaces(s);
    return (places && places[idx]) || null;
  }

  // "change the size and shape of place if story author has allowed it" —
  // resolves a Place's own shape (rectangle/rounded/circle): a Story-
  // Author override first (js/selectionActionStrip.js's shape picker,
  // written via SceneEngine.setContentOverride(...,'shape',...), gated on
  // the same `resizable` permission that governs resize), else the
  // Theme-Author-authored value (Builder's own compiled
  // placeRects[i].shape, tools/world-builder-v2/js/services/builder.js's
  // `shape: h.shape || 'rectangle'`), else 'rectangle' — matching every
  // existing Place's own compiled default exactly, so this is byte-
  // identical/backward-compatible for every theme authored before this
  // feature and every Place with no override.
  function _resolvePlaceShape(s,placeId){
    const ov=_layerOverride(s,placeId);
    if(ov && typeof ov.shape==='string' && ov.shape) return ov.shape;
    const place=_placeByExternalId(s,placeId);
    return (place && place.shape) || 'rectangle';
  }

  // Story-Author override wins over the Theme-Author compiled base — but
  // ONLY when the Theme Author explicitly opted in via `rotatable:true`,
  // matching the exact resolution the render loop itself uses. A Place
  // authored without `rotatable` still renders its Theme-Author-authored
  // base rotation (if any); a Story Author simply can't change it, which
  // is what Guardrails (Creator Governing Rule #2) requires.
  function _resolvePlaceRotation(s,placeId){
    const place=_placeByExternalId(s,placeId);
    const perm=_resolvePlacePermissions(place);
    const base=(place && typeof place.rotation==='number')?place.rotation:0;
    if(!perm.rotatable) return base;
    const ov=_layerOverride(s,placeId);
    if(ov && typeof ov.rotation==='number') return ov.rotation;
    return base;
  }

  function _layoutCompositionFor(s){
    const resolved=_resolveLayout(s);
    return (resolved && resolved.composition) || 'below';
  }

  // Guardrails — Studio's own render-time default for an already-
  // compiled placeRects entry is NOT uniformly the opposite of Builder's
  // own compile-time default; the two fields it governs have different
  // histories and need different absent-field defaults:
  //  - `moveable` is a BRAND NEW capability this feature introduced —
  //    absent (every theme published before this fix) must resolve to
  //    `false` (locked/non-moveable), so nothing that could never be
  //    dragged before suddenly can be.
  //  - `editable` (Frame-editing via Card Designer's Frame Look/Frame
  //    Style controls) is a PRE-EXISTING capability that has always been
  //    unrestricted for every Place in every theme published before this
  //    fix — absent must resolve to `true`, or this fix would newly LOCK
  //    Frame-editing for every already-shipped theme, a real regression
  //    the "Creator can further refine objects through the right panel"
  //    rule forbids. Only a Place whose Builder author explicitly
  //    unchecked "Can a Story Author change this?" (editable:false) gets
  //    locked.
  //  - Absent `visible` resolves to `true` (a Place always showed before
  //    this fix).
  //  - `resizable` (Story Author may change this Place's own size/shape) is
  //    a BRAND NEW capability, added alongside `moveable` rather than
  //    `editable` — so it follows `moveable`'s own "absent resolves to
  //    false/closed" convention, not `editable`'s "absent resolves to
  //    true/open" one. No theme published before this feature existed ever
  //    authored a `resizable` value, so defaulting it closed means no
  //    already-shipped Place silently becomes resizable/shapeable without
  //    its Theme Author explicitly opting in.
  function _resolvePlacePermissions(place){
    const p=place||{};
    return {
      visible: p.visible!==false,
      moveable: p.moveable===true,
      editable: p.editable!==false,
      resizable: p.resizable===true,
      // `rotatable` follows `resizable`'s exact "absent → closed"
      // discipline — a brand-new capability with no compiled entry
      // predating it, so every already-published Place stays permanently
      // un-rotatable to a Story Author until a Theme Author explicitly
      // opts in via Builder's own permission checkbox.
      rotatable: p.rotatable===true
    };
  }
  // Exported so app.js's grab-handle hit-test and js/objectStrip.js's
  // lock-badge/draggable gating both read the SAME resolved permissions,
  // rather than re-deriving the absent-field-defaults-to-false rule in
  // two places.
  function getPlacePermissions(s,placeId){
    return _resolvePlacePermissions(_placeByExternalId(s,placeId));
  }

  // Place · Frame · Paper · Art Model V2 — Phase 6 authoring bridge.
  //
  // Resolves the effective V2 layer set for a Place, applying any Story-
  // Author overrides on top of the Theme-Author-authored `place.v2Layers`
  // baseline. Overrides live in the exact same generic per-id
  // elementOverrides bag every other Story-Author edit already uses
  // (SceneEngine.setContentOverride), keyed by the Place's own selection
  // id (e.g. 'image-holder', 'image-place-2'). Each field is a flat
  // top-level override key — matching the already-established `shape`
  // and `rotation` convention exactly — so the whole resolution is a
  // per-field merge, not a nested object merge, and any future field
  // added by later authoring UI rides through automatically without
  // touching this function's own shape.
  //
  // Returns the same `{frame, paper, art}` shape place.v2Layers itself
  // has, with each field merged from override (if set) → authored base
  // → schema default. Callers (render side + authoring UI both) read
  // this one function to stay in lockstep.
  const _V2_FIELD_MAP={
    frame:[
      ['v2FrameGeometry','geometry'],
      ['v2FrameVisible','visible'],
      ['v2FrameBorderColor','__borderColor'],
      ['v2FrameBorderWidth','__borderWidth'],
      // Phase 13 — the remaining V2 knobs become Story-Author-overridable.
      ['v2FrameRotation','rotation'],
      ['v2FramePadding','padding'],
      // Phase 14 — tilt (X/Y shear, degrees ±45).
      ['v2FrameTiltX','__tiltX'],
      ['v2FrameTiltY','__tiltY'],
      // Phase 15 — perspective (anchor edge + strength 0..0.85).
      ['v2FramePerspAnchor','__perspAnchor'],
      ['v2FramePerspStrength','__perspStrength']
    ],
    paper:[
      ['v2PaperVisible','visible'],
      ['v2PaperContentColor','__contentColor'],
      ['v2PaperContentKind','__contentKind'],
      ['v2PaperRotation','rotation'],
      ['v2PaperBoundsW','__boundsW'],
      ['v2PaperBoundsH','__boundsH'],
      ['v2PaperTiltX','__tiltX'],
      ['v2PaperTiltY','__tiltY'],
      ['v2PaperPerspAnchor','__perspAnchor'],
      ['v2PaperPerspStrength','__perspStrength']
    ],
    art:[
      ['v2ArtVisible','visible'],
      ['v2ArtContentColor','__contentColor'],
      ['v2ArtContentKind','__contentKind'],
      ['v2ArtRotation','rotation'],
      ['v2ArtBoundsW','__boundsW'],
      ['v2ArtBoundsH','__boundsH'],
      ['v2ArtTiltX','__tiltX'],
      ['v2ArtTiltY','__tiltY'],
      ['v2ArtPerspAnchor','__perspAnchor'],
      ['v2ArtPerspStrength','__perspStrength']
    ]
  };
  // Phase 13 — which permission ACTION an override target falls under,
  // for read-side Guardrails gating (below): a Theme Author dropping a
  // per-layer permission after a Story Author had already dialed an
  // override in correctly falls back to the authored base, rather than
  // silently preserving the now-un-authorized override — the exact
  // discipline getPlaceRotation already established for legacy Place
  // rotation.
  function _v2ActionForTarget(targetKey){
    // Phase 14/15: tilt and perspective are rotate-class transforms —
    // same permission bucket per-layer `transform` / Place-wide
    // `rotatable` govern.
    if(targetKey==='rotation' || targetKey==='__tiltX' || targetKey==='__tiltY' ||
       targetKey==='__perspAnchor' || targetKey==='__perspStrength') return 'rotate';
    if(targetKey==='padding' || targetKey==='__boundsW' || targetKey==='__boundsH') return 'resize';
    if(targetKey==='visible') return 'visible';
    return 'content';
  }
  function _v2ResolveEffectiveLayers(place,s,placeId){
    if(!place || !place.v2Layers) return null;
    const ov=_layerOverride(s,placeId) || {};
    // Deep-ish clone the authored layer set so per-field overrides never
    // mutate the compiled theme object (which is shared across every render
    // of every slide using this theme). One level of nesting is enough —
    // border and content are the only nested sub-objects each layer holds.
    function cloneLayer(layer){
      if(!layer) return null;
      const c={};
      Object.keys(layer).forEach(function(k){
        // Phase 13 adds bounds (a {w,h} object a __boundsW/H override
        // mutates per-field) to the nested-clone list — without this,
        // writing an override would mutate the compiled theme object
        // shared across every render. permissions is cloned too for
        // the same defensive reason, though nothing writes to it here.
        // Phase 14 adds tilt ({x,y}, mutated per-field by __tiltX/Y);
        // Phase 15 adds perspective ({anchor,strength}) likewise.
        if(k==='border' || k==='content' || k==='bounds' || k==='permissions' || k==='tilt' || k==='perspective'){
          c[k]=layer[k] ? Object.assign({},layer[k]) : null;
        }else{
          c[k]=layer[k];
        }
      });
      return c;
    }
    const out={
      frame:cloneLayer(place.v2Layers.frame),
      paper:cloneLayer(place.v2Layers.paper),
      art:  cloneLayer(place.v2Layers.art)
    };
    // Apply overrides per layer. A __-prefixed target key is a virtual
    // path into a nested sub-object (border.color, content.color,
    // content.kind) — kept as a flat override key on the wire so
    // SceneEngine.setContentOverride can mutate it individually, exactly
    // like shape/rotation do.
    ['frame','paper','art'].forEach(function(layerKind){
      // If the compiled baseline for this layer is null (a Theme Author
      // authored no Paper/Art at all), but a Story Author IS writing an
      // override for one of its keys, materialize a default layer object
      // first — matching js/placeFrameV2.js's own baseline defaults
      // exactly, so the effective layer has a sane shape for the
      // downstream render code (visible:true, fitMode:'fit-frame' for
      // paper/art). This lets a Story Author INTRODUCE content that
      // didn't exist in the compiled baseline, not just modify what was
      // there — which is what "Creator can further refine objects through
      // the right panel" (Creator Governing Rule #3) requires.
      const hasOverrideForLayer=_V2_FIELD_MAP[layerKind].some(function(pair){ return pair[0] in ov; });
      if(!out[layerKind] && hasOverrideForLayer){
        if(layerKind==='frame'){
          out[layerKind]={visible:true, geometry:'rectangle', border:null, content:null, bounds:null};
        }else{
          out[layerKind]={visible:true, fitMode:'fit-frame', content:null, bounds:null};
        }
      }
      const layer=out[layerKind];
      if(!layer) return;
      _V2_FIELD_MAP[layerKind].forEach(function(pair){
        const ovKey=pair[0], targetKey=pair[1];
        if(!(ovKey in ov)) return;
        // Phase 13 Guardrails — an override only applies while the
        // Theme Author's own per-layer permission (Phase 12, absent →
        // inherit Place-wide) still allows its action category. The
        // override stays stored (a re-granted permission brings it
        // back), it just never wins the merge while denied.
        if(!_v2LayerPermission(place,layerKind,_v2ActionForTarget(targetKey))) return;
        const val=ov[ovKey];
        if(targetKey==='__borderColor'){
          if(!layer.border) layer.border={};
          layer.border.color=val;
        }else if(targetKey==='__borderWidth'){
          if(!layer.border) layer.border={};
          layer.border.width=val;
        }else if(targetKey==='__contentColor'){
          if(!layer.content) layer.content={kind:'color'};
          layer.content.color=val;
        }else if(targetKey==='__contentKind'){
          if(!layer.content) layer.content={};
          layer.content.kind=val;
        }else if(targetKey==='__boundsW'){
          if(!layer.bounds) layer.bounds={};
          layer.bounds.w=val;
        }else if(targetKey==='__boundsH'){
          if(!layer.bounds) layer.bounds={};
          layer.bounds.h=val;
        }else if(targetKey==='__tiltX'){
          if(!layer.tilt) layer.tilt={};
          layer.tilt.x=val;
        }else if(targetKey==='__tiltY'){
          if(!layer.tilt) layer.tilt={};
          layer.tilt.y=val;
        }else if(targetKey==='__perspAnchor'){
          if(!layer.perspective) layer.perspective={};
          layer.perspective.anchor=val;
        }else if(targetKey==='__perspStrength'){
          if(!layer.perspective) layer.perspective={};
          layer.perspective.strength=val;
        }else{
          layer[targetKey]=val;
        }
      });
    });
    return out;
  }
  // Exported for the authoring UI (js/selectionActionStrip.js) to read
  // whichever effective value the render side actually uses — so a Story
  // Author's popup control always seeds from the exact same source of
  // truth the canvas paints from, not from the raw authored base with
  // any override silently invisible.
  function getPlaceV2Layers(s,placeId){
    const place=_placeByExternalId(s,placeId);
    return _v2ResolveEffectiveLayers(place,s,placeId);
  }
  // Cheap "is this Place a V2 Place?" check, used by the authoring UI
  // to decide whether to mount V2-specific controls or fall through to
  // the legacy Shape/Rotation pickers. Returns false for a Cover/Hook/
  // End image-holder (no places array at all) too, matching how every
  // other V2-aware read already gracefully returns null there.
  function isPlaceV2(s,placeId){
    const place=_placeByExternalId(s,placeId);
    return !!(place && place.v2Layers);
  }
  // Phase 12 — per-layer Story-Author permission resolution (spec §2's
  // "Author permission: Honor" cell). A compiled V2 layer may carry its
  // own `permissions` {visible, content, transform} booleans; any absent
  // key inherits the Place-wide permission for that action — the exact
  // pre-Phase-12 behaviour, so a layer authored before this phase (or
  // one a Theme Author never touched) resolves identically to before:
  //   visible / content → Place `editable` (absent → open),
  //   rotate → Place `rotatable`, resize → Place `resizable` (both
  //   absent → closed, their own established defaults).
  // One resolver, exported, so the authoring UI (Phase 13's Selection
  // Action Strip controls) and any future consumer read the SAME rule
  // rather than re-deriving the inheritance in two places — the exact
  // discipline getPlacePermissions itself already established.
  function _v2LayerPermission(place,layerKind,action){
    if(!place || !place.v2Layers) return false;
    if(layerKind!=='frame' && layerKind!=='paper' && layerKind!=='art') return false;
    // A valid layer kind whose baseline is null (a Theme Author authored
    // no Paper/Art at all) still resolves — it simply has no per-layer
    // permissions object, so every action inherits the Place-wide flag.
    // This is what lets a Story Author INTRODUCE content on an absent
    // layer (the materialize-on-override branch in
    // _v2ResolveEffectiveLayers) under the same rules that would govern
    // an authored one.
    const layer=place.v2Layers[layerKind];
    const lp=layer && layer.permissions;
    const pw=_resolvePlacePermissions(place);
    let key, fallback;
    if(action==='visible'){ key='visible'; fallback=pw.editable; }
    else if(action==='content'){ key='content'; fallback=pw.editable; }
    else if(action==='rotate'){ key='transform'; fallback=pw.rotatable; }
    else if(action==='resize'){ key='transform'; fallback=pw.resizable; }
    else return false;
    if(lp && typeof lp[key]==='boolean') return lp[key];
    return fallback;
  }
  function getPlaceV2LayerPermission(s,placeId,layerKind,action){
    return _v2LayerPermission(_placeByExternalId(s,placeId),layerKind,action);
  }

  // Guardrails / full cross-object reorder — Place 1's own atomic paint
  // step (image/placeholder, ornament/stroke, caption, and the Place-1-
  // only 'frame'/'holder'/'element' Layer Pack draws), extracted
  // verbatim from render()'s old fixed-position code so it can be
  // invoked from wherever the interleaved reorder pass decides Place 1's
  // turn comes up, instead of it always drawing first regardless of any
  // reorder. The caller is expected to have already checked
  // `_composition!=='quote'` before invoking this (Quote has no Frame/
  // Holder/image pipeline at all — see _drawQuoteText).
  function _drawPlaceOne(s,t,_border,_place1Rect,_chromeColor,_layerPack,_composition){
    if(s.image && s.image.width){
      _drawImage(s,_border,_place1Rect,null,null,'image-holder');
    }else if(_border){
      _drawArtworkPlaceholder(_place1Rect,_border,_chromeColor);
    }
    if(_border){
      _drawPictureFrameOrnament(_place1Rect,_border,t);
      _drawPictureFrameStroke(_place1Rect,_border);
      if(_border._artwork) _drawArtworkCaption(_border._artwork,s.metadata,_place1Rect,t);
      _renderLayers(_layerPack,'frame',_place1Rect,s);
      const _captionRect=_captionRectFor(_place1Rect,_composition)||_holderRectFor(_place1Rect,_border);
      _renderLayers(_layerPack,'holder',_captionRect,s);
      _renderLayers(_layerPack,'element',_captionRect,s);
    }
    return {bx:_place1Rect.x,by:_place1Rect.y,bw:_place1Rect.w,bh:_place1Rect.h};
  }

  // An additional Place's own atomic paint step, extracted verbatim from
  // render()'s old fixed Place-N loop body. `placeId` (new) is this
  // Place's own selection id — threaded through to _drawImage for
  // shape-clipping (_resolvePlaceShape).
  function _drawPlaceExtra(s,t,opts,placeRect,placeBorder,placeImg,placeView,_chromeColor,placeId){
    if(placeBorder){
      _drawPictureFrameFill(placeRect,placeBorder,t,s);
      _drawArtworkPresentation(placeRect,placeBorder);
    }else{
      _drawPanel(t.panel.color,opts.panelStyle,placeRect);
    }
    if(placeImg && placeImg.width){
      _drawImage(s,placeBorder,placeRect,placeImg,placeView,placeId);
    }else if(placeBorder){
      _drawArtworkPlaceholder(placeRect,placeBorder,_chromeColor);
    }
    if(placeBorder){
      _drawPictureFrameOrnament(placeRect,placeBorder,t);
      _drawPictureFrameStroke(placeRect,placeBorder);
    }
    return {bx:placeRect.x,by:placeRect.y,bw:placeRect.w,bh:placeRect.h};
  }

  // Place · Frame · Paper · Art Model V2 — Phase 4: Studio Render
  //
  // A minimal V2 renderer, invoked only when a Place's compiled
  // record actually carries `v2Layers` (a Theme Author explicitly
  // opted the Place into V2 via Phase 2b's Enable button). A Place
  // with no `v2Layers` falls through to the legacy _drawPlaceOne /
  // _drawPlaceExtra path completely unchanged, so every existing
  // Theme (Museum Gallery included) renders byte-identically.
  //
  // Paint order (spec §1.2, back → front): Paper → Art → Frame.
  // Frame declares the geometry (rectangle / rounded / circle) and
  // owns the only border. Paper/Art clip to Frame's geometry via a
  // Path2D built once per render.
  //
  // Phase 4 scope, deliberately narrow: renders Frame border,
  // Frame geometry as clip, and — if the slide has an image — the
  // image inside Frame (Art layer). Content slots (per-layer
  // image/color/shape/experience attachments) are Phase 6+ work and
  // are stubbed here: a Paper/Art/Frame with a `content` entry set
  // gets a minimal solid-color fill when kind==='color', and every
  // other kind is a documented no-op this phase. Rotation/tilt/
  // perspective wrap the whole Place upstream in render() itself.
  function _drawPlaceV2(s,t,place,placeRect,chromeColor,placeId,placeImg,placeView){
    const v2=place && place.v2Layers;
    if(!v2) return {bx:placeRect.x,by:placeRect.y,bw:placeRect.w,bh:placeRect.h};
    // Phase 6: resolve any Story-Author overrides against the compiled
    // baseline before rendering — every field a control can write to lives
    // in the exact same generic elementOverrides bag every other Story-
    // Author edit already uses (Sprint 8.3 Universal Object Consistency
    // discipline), keyed off this Place's own selection id. Falls back to
    // the raw compiled v2Layers untouched when no override exists, so
    // every already-authored theme renders byte-identically.
    const eff=_v2ResolveEffectiveLayers(place,s,placeId) || v2;
    const frame=eff.frame || {};
    const paper=eff.paper || null;
    const art  =eff.art   || null;
    const frameVisible=frame.visible!==false;
    // Phase 10 — per-layer rotation (spec §4). Frame's rotation wraps
    // the WHOLE V2 stack (Paper/Art are Frame's children per spec §1.1
    // containment — the clip path, border, and both surface layers all
    // pivot together); Paper/Art each add their own rotation on top,
    // inside the Frame clip, around the Place's own centre.
    const _v2cx=placeRect.x+placeRect.w/2, _v2cy=placeRect.y+placeRect.h/2;
    const frameRot=(typeof frame.rotation==='number')?frame.rotation:0;
    const paperRot=(paper && typeof paper.rotation==='number')?paper.rotation:0;
    const artRot=(art && typeof art.rotation==='number')?art.rotation:0;
    function _v2Rotate(deg){
      if(!deg) return;
      x.translate(_v2cx,_v2cy);
      x.rotate(deg*Math.PI/180);
      x.translate(-_v2cx,-_v2cy);
    }
    // Phase 14 — per-layer tilt (spec §4's 3D X/Y skew, approximated as
    // an affine shear — the same math js/placeFrameV2.js's own
    // applyTransformStack documents). tilt.x shears vertically as the
    // eye moves along X; tilt.y shears horizontally. Each axis clamps
    // ±45°, anchored at the Place centre. Applied AFTER rotation per the
    // spec's own transform-stack order (rotation → tilt → perspective →
    // resize). Frame's tilt carries Paper/Art with it (containment
    // §1.1), exactly like rotation; Paper/Art add their own on top,
    // inside the Frame clip. A null/absent tilt is a no-op, so every
    // pre-Phase-14 Place renders byte-identically.
    const frameTilt=(frame.tilt && typeof frame.tilt==='object')?frame.tilt:null;
    const paperTilt=(paper && paper.tilt && typeof paper.tilt==='object')?paper.tilt:null;
    const artTilt=(art && art.tilt && typeof art.tilt==='object')?art.tilt:null;
    function _v2Tilt(tilt){
      if(!tilt) return;
      const tx=Math.max(-45,Math.min(45,(typeof tilt.x==='number')?tilt.x:0));
      const ty=Math.max(-45,Math.min(45,(typeof tilt.y==='number')?tilt.y:0));
      if(!tx && !ty) return;
      x.translate(_v2cx,_v2cy);
      x.transform(1,Math.tan(tx*Math.PI/180),Math.tan(ty*Math.PI/180),1,0,0);
      x.translate(-_v2cx,-_v2cy);
    }
    const _tiltActive=function(t){ return !!(t && ((t.x||0)!==0 || (t.y||0)!==0)); };
    const frameHasXform=!!frameRot || _tiltActive(frameTilt);
    // Phase 15 — perspective (spec §4 step 3: vanishing-point warp,
    // anchor + strength). Not expressible as a Canvas 2D affine
    // transform (the spec's own "perspective needs a 4-point mapping"
    // note), so an active layer paints into an offscreen canvas first
    // and is composited back as N thin strips, each with its own affine
    // scale about the Place centre — the classic keystone
    // approximation. anchor names the RECEDING edge ('top' = the top
    // edge shrinks toward a vanishing point); strength 0..0.85 is how
    // far it recedes. Applied AFTER rotation+tilt per the spec's own
    // transform-stack order: the layer's rotated/tilted output is what
    // the offscreen holds, and the strips warp that. Frame's
    // perspective warps the WHOLE stack (containment §1.1); Paper/Art
    // warp only their own layer, composited back under the still-live
    // Frame clip so the warp can never leak past the Frame geometry.
    // null/absent (every pre-Phase-15 Place) skips the offscreen
    // entirely — byte-identical legacy render, zero extra cost.
    function _v2NormPerspective(p){
      if(!p || typeof p!=='object') return null;
      const a=p.anchor;
      if(a!=='top' && a!=='bottom' && a!=='left' && a!=='right') return null;
      const st=Math.max(0,Math.min(0.85,(typeof p.strength==='number')?p.strength:0));
      if(!st) return null;
      return {anchor:a,strength:st};
    }
    const framePersp=_v2NormPerspective(frame.perspective);
    const paperPersp=paper?_v2NormPerspective(paper.perspective):null;
    const artPersp=art?_v2NormPerspective(art.perspective):null;
    function _v2WithPerspective(persp,drawFn){
      if(!persp){ drawFn(); return; }
      const off=document.createElement('canvas');
      off.width=Math.max(1,Math.round(_viewportW*_dpr));
      off.height=Math.max(1,Math.round(_viewportH*_dpr));
      const offCtx=off.getContext('2d');
      offCtx.setTransform(_dpr,0,0,_dpr,0,0);
      // drawFrameSwatch's own established context-swap technique: every
      // draw helper reads the module-level `x` live, so retargeting it
      // reuses the whole paint pipeline against the offscreen with zero
      // duplication. The composite below runs on the REAL context, so
      // it inherits whatever ambient transform (an enclosing Frame
      // rotation/tilt) and clip (the Frame geometry) are active there.
      const saved=x;
      x=offCtx;
      try{ drawFn(); } finally { x=saved; }
      const st=persp.strength, anchor=persp.anchor;
      x.save();
      x.imageSmoothingEnabled=true;
      if(anchor==='top' || anchor==='bottom'){
        // Horizontal strips, each scaled horizontally about the Place
        // centre. Rows outside the Place rect clamp to the nearest
        // edge's scale (content only reaches there via an enclosing
        // rotation — an accepted approximation).
        const t0=placeRect.y, hgt=Math.max(1,placeRect.h);
        const steps=Math.max(24,Math.min(260,Math.round(hgt)));
        for(let i=0;i<steps;i++){
          const y0=_viewportH*i/steps, y1=_viewportH*(i+1)/steps;
          const rel=Math.max(0,Math.min(1,((y0+y1)/2-t0)/hgt));
          const sc=(anchor==='top')?(1-st*(1-rel)):(1-st*rel);
          x.drawImage(off, 0, y0*_dpr, _viewportW*_dpr, Math.max(1,(y1-y0)*_dpr),
            _v2cx+(0-_v2cx)*sc, y0, _viewportW*sc, (y1-y0));
        }
      }else{
        // Vertical strips, scaled vertically about the Place centre.
        const l0=placeRect.x, wid=Math.max(1,placeRect.w);
        const steps=Math.max(24,Math.min(260,Math.round(wid)));
        for(let i=0;i<steps;i++){
          const x0=_viewportW*i/steps, x1=_viewportW*(i+1)/steps;
          const rel=Math.max(0,Math.min(1,((x0+x1)/2-l0)/wid));
          const sc=(anchor==='left')?(1-st*(1-rel)):(1-st*rel);
          x.drawImage(off, x0*_dpr, 0, Math.max(1,(x1-x0)*_dpr), _viewportH*_dpr,
            x0, _v2cy+(0-_v2cy)*sc, (x1-x0), _viewportH*sc);
        }
      }
      x.restore();
    }
    // Phase 11 — Frame internal padding (the mat gap) + per-layer
    // bounds. `frame.padding` is a fraction of the Place rect's short
    // edge; it insets an inner rect that Paper/Art resolve their own
    // bounds against. A layer's `bounds` is {w,h} fractions of that
    // inner rect, centered — null means "fill the inner rect", so a
    // Place authored before this phase (padding 0, bounds null) renders
    // byte-identically.
    const _padFrac=(typeof frame.padding==='number' && frame.padding>0)?Math.min(frame.padding,0.45):0;
    const _padPx=_padFrac*Math.min(placeRect.w,placeRect.h);
    const innerRect={
      x:placeRect.x+_padPx, y:placeRect.y+_padPx,
      w:Math.max(0,placeRect.w-2*_padPx), h:Math.max(0,placeRect.h-2*_padPx)
    };
    function _v2LayerRect(layer){
      const b=layer && layer.bounds;
      if(!b || typeof b!=='object') return innerRect;
      const fw=(typeof b.w==='number' && b.w>0)?Math.min(b.w,1):1;
      const fh=(typeof b.h==='number' && b.h>0)?Math.min(b.h,1):1;
      // Nudge offset — {ox,oy} fractions of the inner rect, applied
      // AFTER centering, clamped ±0.5. Absent (every pre-nudge layer)
      // → 0, byte-identical centered placement. Kept in lockstep with
      // engineRuntime.js's own v2LayerRect (twin-engine discipline).
      const ox=(typeof b.ox==='number')?Math.max(-0.5,Math.min(0.5,b.ox)):0;
      const oy=(typeof b.oy==='number')?Math.max(-0.5,Math.min(0.5,b.oy)):0;
      const w=innerRect.w*fw, h=innerRect.h*fh;
      return {x:innerRect.x+(innerRect.w-w)/2+ox*innerRect.w, y:innerRect.y+(innerRect.h-h)/2+oy*innerRect.h, w:w, h:h};
    }
    // Phase 15 — the whole stack is a function so Frame's own
    // perspective (which warps clip + border + Paper/Art together, per
    // containment §1.1) can route it through the offscreen keystone
    // compositor above. With no Frame perspective (every pre-Phase-15
    // Place) _v2WithPerspective calls it straight through — the exact
    // pre-restructure control flow, byte-identical.
    const _paintV2Stack=function(){
    if(frameHasXform){ x.save(); _v2Rotate(frameRot); _v2Tilt(frameTilt); }
    // Build Frame geometry as a Path2D — the shared clip for
    // Paper/Art/Frame's own border stroke.
    const geom=frame.geometry || 'rectangle';
    const framePath=_v2BuildFramePath(placeRect,geom);
    // Paint order: Paper (back).
    if(paper && paper.visible!==false){
      x.save();
      x.clip(framePath);
      _v2WithPerspective(paperPersp,function(){
        _v2Rotate(paperRot);
        _v2Tilt(paperTilt);
        _v2PaintSurfaceLayer(paper,_v2LayerRect(paper),chromeColor,s);
        _v2PaintExperienceOverlay(paper,_v2LayerRect(paper),s);
      });
      x.restore();
    }
    // Art (middle) — clipped to Frame geometry, uses slide.image /
    // placeImg exactly like the legacy path does. This is what makes
    // an ordinary Story-Author-uploaded picture visible on a V2
    // Place with no explicit Art content authored.
    const artImg=placeImg || (s.image && s.image.width ? s.image : null);
    const hasArtContent=art && art.content && art.content.kind && art.content.kind!=='none';
    if(art && art.visible!==false){
      const artRect=_v2LayerRect(art);
      x.save();
      x.clip(framePath);
      _v2WithPerspective(artPersp,function(){
        _v2Rotate(artRot);
        _v2Tilt(artTilt);
        if(hasArtContent){
          _v2PaintSurfaceLayer(art,artRect,chromeColor,s);
        }else if(artImg && artImg.width){
          // Draw the slide's own picture through the existing
          // _drawImage pipeline — reuses every legacy crop/pan/zoom
          // behaviour and border-radius handling. Passing a null
          // `border` is safe: _drawImage falls back to the panel rect
          // as its clip, and we've already established the Frame
          // geometry clip via the enclosing x.save/clip.
          _drawImage(s,null,artRect,artImg,placeView,placeId);
        }else{
          // Nothing to show — draw a lightweight placeholder so the
          // Place remains discoverable on-canvas rather than looking
          // blank.
          _v2DrawPlaceholder(artRect,chromeColor);
        }
        // Phase 16 — the layer's Experience overlay is ALWAYS additive,
        // on top of whatever the layer itself holds (or the fallback
        // picture/placeholder): spec §3/§6, "never displaces the
        // layer's own primary content."
        _v2PaintExperienceOverlay(art,artRect,s);
      });
      x.restore();
    }
    // Frame (top) — border stroke on the geometry path.
    if(frameVisible && frame.border){
      const border=frame.border;
      const strokeColor=border.color || border.borderColor || '#333333';
      const strokeWidth=(typeof border.width==='number')?border.width:2;
      if(strokeWidth>0){
        x.save();
        x.strokeStyle=strokeColor;
        x.lineWidth=strokeWidth;
        x.stroke(framePath);
        x.restore();
      }
    }
    // Frame content — Phase 5 handles image/shape/color overlay on top
    // of the border (spec §1.2: Frame's Shape/Image content — tape, wood
    // grain, ornament image — sits above Art and Paper regardless).
    // Colour keeps its Phase-4 15%-alpha subtle-tint semantics for
    // backward compat with the Phase 4 verify suite; a caller wanting
    // an opaque colour fill on Frame authors `content.opacity` instead.
    if(frameVisible && frame.content && frame.content.kind && frame.content.kind!=='none'){
      const fc=frame.content;
      x.save();
      x.clip(framePath);
      if(fc.kind==='color' && fc.color){
        x.fillStyle=fc.color;
        x.globalAlpha=(typeof fc.opacity==='number')?fc.opacity:0.15;
        x.fillRect(placeRect.x,placeRect.y,placeRect.w,placeRect.h);
      }else if(fc.kind==='image' && fc.image){
        _v2DrawImageContent(fc,placeRect,s);
      }else if(fc.kind==='shape' && fc.shape){
        _v2DrawShapeContent(fc,placeRect);
      }
      x.restore();
    }
    // Phase 16 — Frame's own Experience overlay, above everything (the
    // Frame is the topmost layer, spec §1.2), still inside the Frame
    // geometry clip. A separate block from the frame-content one above
    // so an Experience attaches to a Frame with no primary content of
    // its own ("works on nothing," spec §3).
    if(frameVisible && frame.experience){
      x.save();
      x.clip(framePath);
      _v2PaintExperienceOverlay(frame,placeRect,s);
      x.restore();
    }
    if(frameHasXform){ x.restore(); }
    };
    _v2WithPerspective(framePersp,_paintV2Stack);
    // The hit-test bbox stays the unrotated placeRect — the identical
    // convention whole-Place rotation already established upstream.
    return {bx:placeRect.x,by:placeRect.y,bw:placeRect.w,bh:placeRect.h};
  }

  // V2 helpers — kept private to the render module. Frame geometry
  // path builder (rectangle / rounded / circle). Rounded uses a
  // conservative 12% short-edge radius, mirroring the visual weight
  // of the pre-existing Sprint 6.5 rounded frame default; a future
  // phase can promote this to an authored field.
  function _v2BuildFramePath(rect,geom){
    const p=new Path2D();
    if(geom==='circle'){
      const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
      const r=Math.min(rect.w,rect.h)/2;
      p.arc(cx,cy,r,0,Math.PI*2);
      p.closePath();
      return p;
    }
    if(geom==='rounded'){
      const r=Math.max(0,Math.min(rect.w,rect.h)*0.12);
      _v2AppendRoundRect(p,rect.x,rect.y,rect.w,rect.h,r);
      return p;
    }
    // rectangle (default)
    p.rect(rect.x,rect.y,rect.w,rect.h);
    return p;
  }

  function _v2AppendRoundRect(p,rx,ry,rw,rh,r){
    if(r<=0){ p.rect(rx,ry,rw,rh); return; }
    p.moveTo(rx+r,ry);
    p.arcTo(rx+rw,ry,rx+rw,ry+rh,r);
    p.arcTo(rx+rw,ry+rh,rx,ry+rh,r);
    p.arcTo(rx,ry+rh,rx,ry,r);
    p.arcTo(rx,ry,rx+rw,ry,r);
    p.closePath();
  }

  // Paint a Paper/Art surface layer's own content — Phase 5 covers
  // colour / image / shape (an Experience is NOT a content kind — it
  // is the layer's own separate additive `experience` field, painted
  // by _v2PaintExperienceOverlay after this). The caller has already
  // established the Frame-geometry clip (Path2D), so image/shape are
  // free to draw straight to the full placeRect and the clip enforces
  // "nothing outgrows Frame" (spec §1.1) for free — no per-layer
  // secondary rectangular clip needed here. Fit modes for Paper/Art
  // (spec §2: fit-frame/fit-art/original) affect the layer's own
  // BOUNDS, not the content within them — bounds resolution lands in
  // a later phase when custom `bounds` authoring exists; today all
  // layers fill their parent, matching resolveLayerBounds()'s own
  // null-proposed convention in js/placeFrameV2.js.
  function _v2PaintSurfaceLayer(layer,placeRect,chromeColor,s){
    const content=layer.content;
    if(!content || !content.kind || content.kind==='none') return;
    if(content.kind==='color' && content.color){
      x.save();
      x.fillStyle=content.color;
      if(typeof content.opacity==='number') x.globalAlpha=content.opacity;
      x.fillRect(placeRect.x,placeRect.y,placeRect.w,placeRect.h);
      x.restore();
    }else if(content.kind==='image' && content.image){
      _v2DrawImageContent(content,placeRect,s);
    }else if(content.kind==='shape' && content.shape){
      _v2DrawShapeContent(content,placeRect);
    }
  }

  // Phase 16 — Experience as a per-layer ADDITIVE overlay (spec §3,
  // decision log §6: "Additive only... never displaces the layer's own
  // primary content"). In a compiled Theme a V2 layer's `experience`
  // field is the pre-resolved {id, parts} builder.js compiled from the
  // Builder's own Experience registry — a published package has no
  // registry left to resolve against, so parts arrive inline. Each part
  // is {rect, content}: rect is {x,y,w,h} FRACTIONS OF THE LAYER'S OWN
  // RECT (null = the whole layer rect); content is a V2 content spec
  // painted through the exact same adapters every other V2 draw already
  // uses — plus 'text', an overlay-only kind (the three primary layers
  // never hold text of their own). Always painted AFTER the layer's own
  // primary content, inside the same clip/transform stack. Hand-mirrors
  // engineRuntime.js's own _v2PaintExperienceOverlay per the
  // established twin-engine discipline.
  function _v2PaintExperienceOverlay(layer,layerRect,s){
    const ref=layer && layer.experience;
    if(!ref || typeof ref!=='object' || !Array.isArray(ref.parts) || !ref.parts.length) return;
    ref.parts.forEach(function(part){
      if(!part || !part.content) return;
      const fr=part.rect;
      const r=(fr && typeof fr==='object')
        ? {
            x:layerRect.x+(fr.x||0)*layerRect.w,
            y:layerRect.y+(fr.y||0)*layerRect.h,
            w:Math.max(0,(typeof fr.w==='number'?fr.w:1))*layerRect.w,
            h:Math.max(0,(typeof fr.h==='number'?fr.h:1))*layerRect.h
          }
        : layerRect;
      if(r.w<=0 || r.h<=0) return;
      const content=part.content;
      if(content.kind==='text'){
        _v2PaintOverlayText(content,r);
      }else if(content.kind==='color' && content.color){
        x.save();
        x.fillStyle=content.color;
        if(typeof content.opacity==='number') x.globalAlpha=content.opacity;
        x.fillRect(r.x,r.y,r.w,r.h);
        x.restore();
      }else if(content.kind==='image' && content.image){
        _v2DrawImageContent(content,r,s);
      }else if(content.kind==='shape' && content.shape){
        _v2DrawShapeContent(content,r);
      }
    });
  }

  // Text is an overlay-only content kind (an Experience Text part).
  // Simple wrapped fill via the same _wrapText every other text draw
  // here uses; the part's own size is in canvas-logical px (the unit
  // Experience Text parts already author), alignment resolves within
  // the part rect, rotation pivots on the part rect's own centre.
  function _v2PaintOverlayText(content,rect){
    if(!content.text) return;
    x.save();
    if(typeof content.opacity==='number') x.globalAlpha=content.opacity;
    if(content.rotation){
      const tcx=rect.x+rect.w/2, tcy=rect.y+rect.h/2;
      x.translate(tcx,tcy);
      x.rotate(content.rotation*Math.PI/180);
      x.translate(-tcx,-tcy);
    }
    const size=(typeof content.size==='number' && content.size>0)?content.size:32;
    const weight=(content.weight && content.weight!=='normal')?content.weight+' ':'';
    x.font=weight+size+'px '+(content.font||'Georgia, serif');
    x.fillStyle=content.color||'#1D3457';
    x.textAlign=content.align||'left';
    x.textBaseline='top';
    const tx=content.align==='center'?rect.x+rect.w/2
      :(content.align==='right'?rect.x+rect.w:rect.x);
    _wrapText(content.text,rect.w).forEach(function(line,i){
      x.fillText(line,tx,rect.y+i*size*1.25);
    });
    x.restore();
  }

  // Adapters — build a Layer-Pack-Decoration-shaped `d` object from a
  // V2 content spec and delegate to the already-proven Layer Pack
  // drawing routines (_layerDrawDecorationImage, _layerDrawShape). Zero
  // second-implementation drift risk: whatever those routines already
  // do for a Theme-Author-authored Layer Pack Decoration (Draft Asset
  // resolution via _ensureDecorationImage + AssetStore.resolve, Theme-
  // relative-path resolution via ThemeRegistry.resolveAssetRef, cover-
  // fit rotation math, cross-owner Magic-Card-recall image fallback,
  // multi-stroke Custom shape paths, letter/number shapes, Paint-Inside
  // fill mode) is inherited here for free. Callers are responsible for
  // establishing the Frame-geometry clip beforehand.
  function _v2DrawImageContent(content,placeRect,s){
    _layerDrawDecorationImage({
      image:content.image,
      fit:content.fit||'fill',
      rotation:content.rotation||0,
      alpha:(typeof content.opacity==='number')?content.opacity:1
    },placeRect,s,null);
  }

  function _v2DrawShapeContent(content,placeRect){
    _layerDrawShape({
      shape:content.shape,
      rotation:content.rotation||0,
      alpha:(typeof content.opacity==='number')?content.opacity:1,
      fillColor:content.fillColor||'#666666',
      fillOpacity:(typeof content.fillOpacity==='number')?content.fillOpacity:1,
      strokeColor:content.strokeColor||'#111111',
      strokeOpacity:(typeof content.strokeOpacity==='number')?content.strokeOpacity:1,
      strokeWidth:(typeof content.strokeWidth==='number')?content.strokeWidth:0,
      fillMode:content.fillMode||'solid',
      customPath:content.customPath||null,
      customStrokes:content.customStrokes||null,
      paintStrokes:content.paintStrokes||null,
      fillEnabled:content.fillEnabled!==false
    },placeRect);
  }

  function _v2DrawPlaceholder(placeRect,chromeColor){
    const color=chromeColor||'#FFFFFF';
    x.save();
    x.globalAlpha=0.06;
    x.fillStyle=color;
    x.fillRect(placeRect.x,placeRect.y,placeRect.w,placeRect.h);
    x.restore();
  }

  function _frameColor(theme,opts){
    if(typeof ThemeEngine!=='undefined' && theme && theme.variants){
      try{ return ThemeEngine.resolveFrameColor(theme,opts.variant); }catch(e){}
    }
    return theme.frame.color;
  }

  // Sprint 9.0.2 — WYSIWYE. `init` now takes an optional `opts` bag
  // whose `dpr` key controls the canvas backing store scale. Editor
  // and Publish Read canvases pass `window.devicePixelRatio` (default)
  // so what the child sees on screen is drawn at native pixel density —
  // no more CSS-downscale softness. Export paths (Publish Studio's PDF
  // render loop, thumbnails) pass `{dpr: 1}` because their toDataURL
  // output should stay 1080 × 1350 pixels flat. The renderer continues
  // to draw in the fixed 1080 × 1350 coordinate space regardless of
  // dpr thanks to the setTransform below, so no downstream renderer
  // code needs to change.
  // Scene Viewport — `opts.adaptiveViewport` stamps a sticky, per-canvas-
  // element flag (`cv.__vihuAdaptiveViewport`) rather than mutating any
  // shared module state: only a canvas that explicitly opts in ever has
  // render() resize it to a Slide's own resolved Viewport (see render()
  // below). Every existing caller (Publish's own throwaway export
  // canvases, any caller that never passes this option) keeps getting
  // exactly the canonical 1080x1350 default it always has, on this
  // element and on every future `init()` call against it, since the
  // flag lives on the DOM element itself, not on the module.
  function init(cv, opts){
    c=cv;
    _dpr=(opts && typeof opts.dpr==='number' && opts.dpr>0)
      ? opts.dpr
      : ((typeof window!=='undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);
    if(opts && typeof opts.adaptiveViewport==='boolean'){ cv.__vihuAdaptiveViewport=opts.adaptiveViewport; }
    // Every init() call resets to the canonical default -- render()'s
    // own Viewport-resolution step (for an adaptive canvas) re-derives
    // the real size on the very next render() call.
    _viewportW=DEFAULT_VIEWPORT.w; _viewportH=DEFAULT_VIEWPORT.h;
    c.width=Math.round(_viewportW*_dpr);
    c.height=Math.round(_viewportH*_dpr);
    x=c.getContext('2d');
    // DPR scaling is baked into the transform once, so
    // `x.fillRect(0,0,_viewportW,_viewportH)` still covers the full
    // Viewport regardless of backing store size.
    try{ x.setTransform(_dpr,0,0,_dpr,0,0); }catch(e){}
    // Sprint 6.3 — Chromium defaults imageSmoothingQuality to 'low' which
    // smudges fine pencil strokes when the renderer downscales scans
    // into the image-holder. Set to 'high' so the single resampling step
    // uses better-than-bilinear interpolation.
    try{ x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; }catch(e){}
  }

  // ===========================================================
  // Sprint 9.3 — Artwork Themes.
  // ===========================================================
  // Artwork Themes never touch a pixel of the child's picture. They
  // map onto the exact same Picture Border rendering Sprint 6.5/6.5.1
  // already built (fill / design / cornerRadius / shadow / padding) —
  // there is no parallel "artwork engine" here, just three lookup
  // tables plus a couple of new ornament/texture passes that draw
  // around the image, never onto it. See _resolveBorder below for
  // where this becomes one more fallback layer (card override wins,
  // then an Artwork Theme, then the Story Theme's Holder Defaults).
  //
  // background -> border.fill (drawn UNDER the image — "Background
  // always sits behind the artwork").
  const ARTWORK_BACKGROUND_FILL={
    white:'white', cream:'#F7F1E3', 'kraft-paper':'#C9A66B',
    'watercolor-paper':'#F5F0E6', 'notebook-paper':'#F4F6FA',
    black:'black', transparent:'none', 'bulletin-board':'#C9A876'
  };
  // frame -> {design, cornerRadius}. "none" / "white-mat" / "floating"
  // lean on the existing fill+shadow primitives rather than a bespoke
  // design (a mat is just a fill with no ornament). "wood" and
  // "polaroid" reuse the Sprint 6.5.1 designs verbatim — they already
  // are what these presets describe. "tape" is the one genuinely new
  // ornament this sprint adds (see _ornamentTape). Frames never crop
  // or resize the image itself — only cornerRadius, which the image's
  // own clip path already respects for every other border design.
  const ARTWORK_FRAME_PRESET={
    'none':           {design:null,       cornerRadius:0},
    'white-mat':      {design:null,       cornerRadius:0},
    'floating':       {design:null,       cornerRadius:8},
    'wood':           {design:'wooden',   cornerRadius:6},
    'polaroid':       {design:'polaroid', cornerRadius:0},
    'tape':           {design:'tape',     cornerRadius:0},
    'bulletin-board': {design:null,       cornerRadius:0},
    // Bug 4 (BACKLOG.md) — Frame Style = Image: the ornament is a
    // Theme-Author-authored picture overlay drawn onto the border
    // band. Zero inherent corner rounding; the picture itself carries
    // any rounding needed. `design:'image'` dispatches to
    // _ornamentImage in _drawPictureFrameOrnament below.
    'image':          {design:'image',    cornerRadius:0}
  };
  // shadow -> {enabled, intensity}. Deliberately subtle across the
  // board — "Keep shadows subtle" per the sprint spec.
  const ARTWORK_SHADOW_PRESET={
    'none':     {enabled:false, intensity:0},
    soft:       {enabled:true,  intensity:0.22},
    gallery:    {enabled:true,  intensity:0.32},
    floating:   {enabled:true,  intensity:0.55}
  };
  // composition -> padding (px, same unit as the existing border.padding).
  const ARTWORK_COMPOSITION_PADDING={
    center:24, fit:0, margin:56, floating:32, 'full-width':4
  };

  // Converts an active Artwork Theme into the same border-shape object
  // _resolveBorder already produces for a card override or the Story
  // Theme's Holder Defaults, so every existing draw function (fill /
  // ornament / stroke / image clip) needs zero changes to understand
  // it. `_artwork` is stashed on the return value (not part of the
  // border shape those functions read) purely so the texture/lighting
  // passes below can look up paper/lighting without re-resolving the
  // active theme a second time.
  // Sprint 9.5 — Theme Language v2. An Artwork Theme may now say
  // `presentation:'gallery'` instead of spelling out every field below;
  // ThemePresets.resolveHolder fills in whatever the theme doesn't
  // override itself (Presentation Preset -> Theme Overrides), and any
  // field still missing after that falls through to this function's
  // own ARTWORK_*_PRESET['none'] lookups exactly as before (System
  // Defaults). A theme with no `presentation`, or one ThemePresets
  // doesn't recognize, resolves to its own explicit fields unchanged —
  // this is a strict superset of pre-9.5 behaviour, not a redesign.
  // Sprint 9.7 — Museum Gallery Fidelity. Frame Variations describe
  // the exhibition mount with real, direct values (per the approved
  // Design Board) instead of only picking from the enum lookup tables
  // above: `matWidth` (px) overrides the composition-based padding,
  // `frameThickness` (px, >0) draws an actual coloured border stroke —
  // every artwork theme before this sprint had lineEnabled permanently
  // off — and `borderColor` sets its colour. All three are optional;
  // omitted, the enum-based System Defaults below run exactly as
  // before, so an artwork theme that only ever set background/frame/
  // paper/shadow (every artwork theme before Museum Gallery's 9.7
  // variations) is unaffected.
  function _artworkBorder(art){
    if(!art) return null;
    if(!art._hasExplicitChrome){
      // No Frame Variation chosen, no per-card override — render this
      // Place with zero chrome (no mat fill, no border stroke, no
      // shadow, no paper/lighting texture, no caption) instead of
      // falling back to the Theme's own Presentation Preset System
      // Defaults. `_artwork:{}` (not the raw merged fields) so
      // _drawArtworkPresentation/_drawArtworkCaption's own paper/
      // lighting/caption checks all correctly no-op too.
      return {
        design:null, padding:0, fill:'none', cornerRadius:0,
        lineEnabled:false, lineWidth:2, lineColor:'#000000',
        shadowEnabled:false, shadowIntensity:0, _artwork:{}
      };
    }
    const resolved=(typeof ThemePresets!=='undefined')
      ? ThemePresets.resolveHolder('image',art.presentation,art)
      : art;
    const framePreset=ARTWORK_FRAME_PRESET[resolved.frame]||ARTWORK_FRAME_PRESET['none'];
    const shadowPreset=ARTWORK_SHADOW_PRESET[resolved.shadow]||ARTWORK_SHADOW_PRESET['none'];
    const padding=(typeof resolved.matWidth==='number')
      ? resolved.matWidth
      : (ARTWORK_COMPOSITION_PADDING[resolved.composition]!=null)?ARTWORK_COMPOSITION_PADDING[resolved.composition]:24;
    const thickness=(typeof resolved.frameThickness==='number')?resolved.frameThickness:0;
    return {
      design:framePreset.design,
      padding:padding,
      fill:ARTWORK_BACKGROUND_FILL[resolved.background]||'none',
      cornerRadius:framePreset.cornerRadius,
      lineEnabled:thickness>0,
      lineWidth:thickness>0?thickness:2,
      lineColor:resolved.borderColor||'#000000',
      shadowEnabled:shadowPreset.enabled,
      shadowIntensity:shadowPreset.intensity,
      _artwork:resolved
    };
  }

  // Sprint 9.6 — Museum Gallery Theme Support: Frame Variations. A
  // theme may ship `frameVariations` (named bundles of artwork fields
  // — "Classic White Mat", "Gold Accent", …), and Sprint 9.4's
  // per-card Holder controls (Presentation/Frame/Lighting/Caption/
  // Paper/Mat), written into slide.metadata.cardOverrides.artwork since
  // they shipped but never rendered ("inert this sprint" — see
  // js/workspaceBuilder.js's file header), finally get consumed here.
  // Precedence, most-specific-wins: System Default < Presentation
  // Preset < Theme's own explicit fields < chosen Frame Variation's
  // fields < a raw per-card field override. A slide that has never
  // touched any of these controls has an empty cardOverrides bag, so
  // this is a no-op and rendering is exactly what _artworkBorder
  // already produced pre-9.6.
  // Multiple Artwork Places Per Page — `placeId` omitted/undefined
  // preserves the exact page-level (Place 1) lookup below unchanged;
  // a real id reads that Place's own override bag instead
  // (slide.metadata.placeContent[placeId].cardOverrides.artwork).
  function _cardArtworkOverride(s,placeId){
    if(placeId){
      return (s && s.metadata && s.metadata.placeContent && s.metadata.placeContent[placeId]
        && s.metadata.placeContent[placeId].cardOverrides && s.metadata.placeContent[placeId].cardOverrides.artwork) || {};
    }
    return (s && s.metadata && s.metadata.cardOverrides && s.metadata.cardOverrides.artwork) || {};
  }
  function _resolveArtworkFields(theme,s,placeId){
    if(!theme) return null;
    const cardOv=_cardArtworkOverride(s,placeId);
    let merged=Object.assign({},theme);
    // Multiple Artwork Places Per Page — an extra Place has no
    // page-level `representation.defaultFrame` seeding step the way
    // Place 1 does (js/creationFlow.js's _seedDefaultFrameVariation);
    // instead, absent a Story Author's own per-Place override, its
    // compiled `frame` reference (the Theme Author's own authored
    // default for THIS Place) is read live off the active Layout —
    // simpler than a second seeding mechanism, and always reflects the
    // current compiled Place rather than a stale seeded snapshot.
    let frameVariationId=cardOv.frameVariation;
    if(!frameVariationId && placeId){
      const place=_placeByExternalId(s,placeId);
      if(place && place.frame) frameVariationId=place.frame;
    }
    // A dangling reference — a `frameVariation` id that doesn't (or no
    // longer) resolves to a real entry in `theme.frameVariations` (e.g.
    // a stale seed from a Frame the Theme Author since renamed/removed
    // in Builder) — must NOT count as "a Frame Variation was chosen."
    // Only a reference that actually resolves counts.
    let frameVariationResolved=false;
    if(frameVariationId && Array.isArray(theme.frameVariations)){
      const variation=theme.frameVariations.find(function(v){ return v && v.id===frameVariationId; });
      if(variation && variation.fields){ merged=Object.assign(merged,variation.fields); frameVariationResolved=true; }
    }
    // A real, explicit product decision: a Place with no Frame Variation
    // chosen (by the Theme Author, in Builder) and no per-card
    // Presentation override (by the Story Author, in Card Designer)
    // should render with ZERO chrome — matching Builder's own Working
    // View, which never fabricates a themed look for an un-Framed
    // Place — rather than silently inheriting the Theme's own
    // top-level presentation/background/frame/paper/shadow/lighting
    // fields (which exist to give an *explicitly Framed* Place its
    // System Default look when a Frame Variation's own fields don't
    // cover something, not to invent chrome for a Place with no Frame
    // at all). Wall tone (_resolveWallTone, below) is deliberately a
    // separate resolution and stays unaffected — the gallery wall
    // colour is a Slide-level concept independent of any one Place's
    // own Frame choice.
    const hasCardChromeOverride=['presentation','frame','paper','lighting','composition'].some(function(k){ return cardOv[k]!==undefined; });
    ['presentation','frame','paper','lighting','caption','composition'].forEach(function(k){
      if(cardOv[k]!==undefined) merged[k]=cardOv[k];
    });
    merged._hasExplicitChrome=frameVariationResolved||hasCardChromeOverride;
    return merged;
  }

  // A real, user-reported bug: Context Panel's "Page Background ->
  // Background Colour" swatch wrote to the STORY Theme's global
  // colours.frame sub-option (js/contextPanel.js's _appendBackground)
  // -- but _resolveWallTone(s) below almost always resolves a real,
  // non-null value the instant any World/Artwork Theme is active
  // (which is the common case for a real project), and the background
  // fill line further down unconditionally preferred wall tone over
  // the Story Theme's frame colour -- so the swatch had ZERO visible
  // effect for any World-based page, exactly the reported symptom.
  // Fixed with a genuine PER-PAGE override (matching the "PAGE
  // BACKGROUND" heading the control has always shown, and the same
  // per-card override pattern every other Story-Author control in
  // this file already uses) that wins over both wall tone and the
  // Story Theme default -- a Story Author's own explicit choice for
  // THIS page, not a second global setting.
  function _slideBackgroundOverride(s){
    const co=s && s.metadata && s.metadata.cardOverrides;
    // BACKLOG Bug 6 — "Color and Image can co-exist in background. color
    // is always behind the image not in front." Colour and Image used to
    // be mutually exclusive here (gated on co.backgroundMode), which is
    // exactly why a Story Author could never see both at once. Now this
    // resolves purely on whether a colour was ever authored, completely
    // independent of whether an image is *also* active — the render call
    // site (this file's own render(s) function) already draws colour
    // first and the image on top of it, so co.backgroundMode is no
    // longer read anywhere and is left as a harmless, no-op legacy field
    // on any already-saved project.
    const bg=co && co.background;
    return (typeof bg==='string' && bg) ? bg : null;
  }

  // The Image counterpart to _slideBackgroundOverride above — {ref,
  // rotation, opacity} or null. co.backgroundImage is only ever set once
  // a Story Author's own upload succeeds (js/contextPanel.js's
  // _appendBackgroundImageControls), so a project/theme with no such
  // upload is completely unaffected. BACKLOG Bug 6 — no longer gated on
  // co.backgroundMode; presence of a real ref is the only thing that
  // decides whether the image shows, so it can render alongside a
  // Background Colour, never only instead of one.
  function _slideBackgroundImageOverride(s){
    const co=s && s.metadata && s.metadata.cardOverrides;
    const img=co && co.backgroundImage;
    return (img && typeof img.ref==='string' && img.ref) ? img : null;
  }

  // Draws a Story Author's own uploaded picture as the page's full
  // background — cover-fit ('fill') + optional rotation + optional
  // opacity, reusing _layerDrawDecorationImage's already-established
  // cover-fit/rotation/alpha math and _ensureDecorationImage's cache-
  // and-redraw-on-load resolution (vihu-asset: refs and legacy data:
  // URIs alike) rather than a second, duplicated image-drawing
  // implementation. Passing a vihu-asset:/data: ref through as `d.image`
  // with no override bag is safe: ThemeRegistry.resolveAssetRef (the one
  // extra step _layerDrawDecorationImage takes when no override is
  // present) returns any value that isn't a bare theme-relative asset
  // path completely unchanged (confirmed: it early-returns for anything
  // matching data:/https?: OR anything NOT ending in a known image/font
  // extension — a vihu-asset: ref matches neither test either way, so
  // this call is a guaranteed no-op regardless of whether an Artwork
  // Theme is even active). alpha lets the colour underneath show through
  // a semi-transparent image, per BACKLOG Bug 6's "colour is always
  // behind the image" requirement — the colour fill/clearRect already
  // painted moments earlier in render(s) is exactly what remains
  // visible wherever this draw doesn't fully cover it.
  function _drawSlideBackgroundImage(s,bgImg){
    _layerDrawDecorationImage(
      {
        image:bgImg.ref,
        fit:'fill',
        rotation:(typeof bgImg.rotation==='number')?bgImg.rotation:0,
        alpha:(typeof bgImg.opacity==='number')?bgImg.opacity:1
      },
      {x:0,y:0,w:_viewportW,h:_viewportH},
      s,
      null
    );
  }

  // Sprint 9.7 — Museum Gallery Fidelity: wall tone is the gallery
  // room's paint colour, not the picture's mat — it applies whenever
  // an Artwork Theme is active, regardless of whether THIS particular
  // slide has a picture (a Quote page has no image at all but still
  // sits on the same gallery wall). Deliberately independent of
  // _resolveBorder, which stays image-gated for the Frame/mat itself.
  function _resolveWallTone(s){
    // _layoutTheme(s), not _artworkTheme(s) directly -- see _resolveBorder's
    // matching comment: whichever theme actually supplies Layout/Holder/
    // Frame Variation data (Artwork Theme slot preferred, Story Theme
    // slot as fallback) is also the one whose wall tone applies.
    const artTheme=_layoutTheme(s);
    if(!artTheme) return null;
    const merged=_resolveArtworkFields(artTheme,s);
    const resolved=(typeof ThemePresets!=='undefined')
      ? ThemePresets.resolveHolder('image',merged.presentation,merged)
      : merged;
    return resolved.wallTone||null;
  }

  // Sprint 9.7 — page-furniture text (Handle, Page Number) is drawn in
  // the Story Theme's own watermark/footerText colour by default,
  // which is usually white for a dark book-frame background. Once an
  // Artwork Theme sets a wall tone, that assumption can invert (a
  // light gallery wall needs dark text) — a simple luminance check
  // picks a readable colour instead of hardcoding one gallery mood.
  function _luminance(hex){
    const h=String(hex).replace('#','');
    if(h.length<6) return 1;
    const r=parseInt(h.substr(0,2),16), g=parseInt(h.substr(2,2),16), b=parseInt(h.substr(4,2),16);
    if(isNaN(r)||isNaN(g)||isNaN(b)) return 1;
    return (0.299*r+0.587*g+0.114*b)/255;
  }
  function _chromeTextColor(wallTone){
    if(!wallTone) return null;
    return _luminance(wallTone)>0.55 ? '#2A2A2A' : '#F5F0E6';
  }

  // Sprint 6.5 — Picture Border. Resolved from
  // slide.metadata.cardOverrides.border (passed in via payload.overrides.border).
  // Returns null when no override is present so the legacy rendering path
  // stays byte-identical for projects that haven't touched the border.
  // Sprint 6.5.1 — also carries the design id so per-design ornament
  // drawing dispatches consistently.
  // Multiple Artwork Places Per Page — `placeId` omitted/undefined
  // preserves every existing line below byte-for-byte (Place 1's own
  // page-level `s.overrides.border`/Sprint-8.4.2-fallback resolution,
  // unchanged); a real id resolves an extra Place's own border instead —
  // its own explicit override if a Story Author set one, else the
  // active Artwork Theme resolved through that Place's own default Frame
  // (_resolveArtworkFields' own placeId branch), with no fallback to the
  // page-level Sprint 8.4.2 Picture-Holder-defaults (a Story-Theme-level
  // concept with no per-Place analog — an extra Place only ever exists
  // under an active Artwork Theme in the first place).
  function _resolveBorder(s,placeId){
    // A Scene converged with zero Places has no picture area at all --
    // Builder's own Runtime Preview draws nothing for it (no Frame, no
    // mat, no wall chrome, no placeholder). The check below at the top
    // of the artTheme branch only ever skipped THAT branch's own
    // Frame/mat/wall resolution; it never stopped this function from
    // falling through to the generic, artwork-independent Sprint 8.4.2
    // "Picture Holder defaults" (opts.holder) a few lines down, which
    // can still resolve a non-null border on its own (any theme-level
    // cornerRadius/padding/shadow/fill default) -- and once _border is
    // non-null, render() still draws the artwork placeholder box and
    // Frame/Holder-scoped Layer Pack content for a page that Builder
    // itself never authored a Holder for. Gating here, before either
    // branch runs, makes zero-Holder mean "no border, period" -- the
    // one behaviour both branches were always supposed to share.
    if(_activeLayoutHolders(s)===0) return null;
    if(placeId){
      const placeOv=(s && s.metadata && s.metadata.placeContent && s.metadata.placeContent[placeId]) || null;
      const pb=placeOv && placeOv.cardOverrides && placeOv.cardOverrides.border;
      if(pb){
        const pLine=pb.line||{};
        const pShadow=pb.shadow||{};
        return {
          design:pb.design||null,
          padding:(typeof pb.padding==='number')?pb.padding:20,
          fill:pb.fill||'page',
          cornerRadius:(typeof pb.cornerRadius==='number')?pb.cornerRadius:0,
          lineEnabled:!!pLine.enabled,
          lineWidth:(typeof pLine.width==='number')?pLine.width:2,
          lineColor:pLine.color||'#000000',
          shadowEnabled:!!pShadow.enabled,
          shadowIntensity:(typeof pShadow.intensity==='number')?pShadow.intensity:0.4,
          // Studio Frame Personalization — a Story Author's own uploaded
          // Frame Picture ("Your Own Picture" in Frame Style's fill row).
          // Only meaningful when fill==='image'; carried through unchanged
          // otherwise so every pre-existing project (never setting either
          // field) is byte-for-byte unaffected.
          image:pb.image||null,
          imageRotation:(typeof pb.imageRotation==='number')?pb.imageRotation:0
        };
      }
      // A real, user-reported bug found live: the Layout/Holder/Place
      // geometry above already resolves via _layoutTheme(s) — which
      // tries _artworkTheme(s) first, then falls back to the active
      // Story Theme — because that's the one place a theme carrying
      // Layouts/Holders/Frame Variations can actually be found. If that
      // same theme ended up applied as the Story Theme rather than the
      // Artwork Theme (AppState.project.artworkTheme left null), the
      // chrome resolution below used to require _artworkTheme(s)
      // specifically, found nothing, and fell through to the legacy
      // _drawPanel(t.panel.color,...) fallback below — painting a
      // plain white/cream panel over geometry that otherwise rendered
      // correctly. Using the same _layoutTheme(s) fallback here keeps
      // both resolutions consistent — whichever theme supplies the
      // Layout data also supplies its own Frame chrome, exactly as
      // before for the normal case (_layoutTheme prefers a real
      // Artwork Theme when one is active, identical to _artworkTheme).
      const artTheme=_layoutTheme(s);
      if(artTheme){
        const art=_resolveArtworkFields(artTheme,s,placeId);
        const artworkBorder=_artworkBorder(art);
        if(artworkBorder) return artworkBorder;
      }
      return null;
    }
    const ov=(s && s.overrides) || null;
    const b=ov && ov.border;
    if(!b){
      // Sprint 9.3 originally gated this behind hasImage ("If a page
      // contains no artwork, Artwork Theme has no effect"). Creator
      // Acceptance Sprint (Museum Gallery Theme Fidelity) reverses that
      // specifically for the Frame/mat/wall chrome: Builder's own
      // Runtime Preview always shows an empty Frame's chrome before a
      // picture is added (engineRuntime.js's _paintHolder — an
      // Engine-level rule, not a Theme choice), so a Story-role Artwork
      // Theme page now resolves its Frame Variation regardless of
      // image presence. Only the picture itself (_drawImage, gated
      // separately in render()) still requires a real image.
      // The zero-Holder case (docs/THEME_PROJECT_SPEC.md §5's "holders"
      // field) is already handled by the early return at the top of
      // this function, which covers this branch and the legacy
      // Picture-Holder-defaults fallback below uniformly.
      // Uses _layoutTheme(s), not _artworkTheme(s) directly — see the
      // matching comment on the placeId branch above for why.
      const artTheme=_layoutTheme(s);
      if(artTheme){
        const art=_resolveArtworkFields(artTheme,s);
        const artworkBorder=_artworkBorder(art);
        if(artworkBorder) return artworkBorder;
      }
      // Sprint 8.4.2 — when no card-level override is set, fall back to the
      // theme-level Picture Holder defaults (themeOptions.holder). The card
      // still wins per slide; this is the global default for every untouched
      // holder. When neither is set, return null so legacy behaviour holds.
      const opts=_options(s);
      const hd=(opts && opts.holder) || {};
      // Sprint 9.5 — `fill` joins cornerRadius/padding/shadow as a
      // Frame-presentation-seedable field (see ThemeEngine's
      // _defaultOptionsFor -> ThemePresets.resolveFrame). A theme with
      // no `holder` block never sets it, so `hd.fill` stays undefined
      // and this branch's own System Default ('page') is what runs —
      // identical to every pre-9.5 theme.
      const hasHolderDefault=
        (typeof hd.cornerRadius==='number' && hd.cornerRadius>0) ||
        (typeof hd.padding==='number' && hd.padding>0) ||
        !!hd.shadow ||
        !!hd.fill;
      if(!hasHolderDefault) return null;
      return {
        design:null,
        padding:(typeof hd.padding==='number')?hd.padding:0,
        fill:hd.fill||'page',
        cornerRadius:(typeof hd.cornerRadius==='number')?hd.cornerRadius:0,
        lineEnabled:false,
        lineWidth:2,
        lineColor:'#000000',
        shadowEnabled:!!hd.shadow,
        shadowIntensity:0.4
      };
    }
    const line=b.line||{};
    const shadow=b.shadow||{};
    return {
      design:b.design||null,
      padding:(typeof b.padding==='number')?b.padding:20,
      fill:b.fill||'page',
      cornerRadius:(typeof b.cornerRadius==='number')?b.cornerRadius:0,
      lineEnabled:!!line.enabled,
      lineWidth:(typeof line.width==='number')?line.width:2,
      lineColor:line.color||'#000000',
      shadowEnabled:!!shadow.enabled,
      shadowIntensity:(typeof shadow.intensity==='number')?shadow.intensity:0.4,
      // Studio Frame Personalization — see the matching comment on the
      // placeId branch above.
      image:b.image||null,
      imageRotation:(typeof b.imageRotation==='number')?b.imageRotation:0
    };
  }

  function _resolveBorderFillColor(border,theme){
    switch(border.fill){
      case 'none': return null;
      case 'white': return '#FFFFFF';
      case 'black': return '#000000';
      case 'page': return (theme && theme.panel) ? theme.panel.color : '#FFFFFF';
      default:
        if(typeof border.fill==='string' && border.fill.charAt(0)==='#') return border.fill;
        return (theme && theme.panel) ? theme.panel.color : '#FFFFFF';
    }
  }

  // Sprint 6.5.1 — per-design asymmetric padding. Polaroid grows the
  // bottom by ~3× the side padding so the classic instant-photo frame
  // reads at a glance. Every other design stays symmetric.
  function _getDesignInsets(border){
    const p=border.padding;
    if(border.design==='polaroid'){
      return {top:p, right:p, bottom:Math.round(p*2.8), left:p};
    }
    return {top:p, right:p, bottom:p, left:p};
  }

  function _picturePath(rx,ry,rw,rh,radius){
    const r=Math.max(0,Math.min(radius||0,rw/2,rh/2));
    if(r===0){
      x.beginPath();
      x.rect(rx,ry,rw,rh);
      return;
    }
    x.beginPath();
    x.moveTo(rx+r,ry);
    x.arcTo(rx+rw,ry,rx+rw,ry+rh,r);
    x.arcTo(rx+rw,ry+rh,rx,ry+rh,r);
    x.arcTo(rx,ry+rh,rx,ry,r);
    x.arcTo(rx,ry,rx+rw,ry,r);
    x.closePath();
  }

  // Cloud-shape path — six puffy lobes around the rect. Used by the
  // Cloud Frame Design for both the frame fill and the image clip.
  function _cloudPath(rx,ry,rw,rh){
    const cx=rx+rw/2, cy=ry+rh/2;
    const a=rw/2*0.95, b=rh/2*0.95;
    x.beginPath();
    // Top puffs
    const lobeR=Math.min(rw,rh)*0.18;
    const tops=[
      [cx-rw*0.30, ry+lobeR*0.5, lobeR*1.05],
      [cx-rw*0.05, ry+lobeR*0.20, lobeR*1.25],
      [cx+rw*0.22, ry+lobeR*0.35, lobeR*1.10]
    ];
    // Side puffs
    const sides=[
      [rx+rw-lobeR*0.40, cy-rh*0.10, lobeR*1.10],
      [rx+rw-lobeR*0.50, cy+rh*0.20, lobeR*1.00]
    ];
    // Bottom puffs
    const bots=[
      [cx+rw*0.20, ry+rh-lobeR*0.40, lobeR*1.10],
      [cx-rw*0.10, ry+rh-lobeR*0.20, lobeR*1.25],
      [cx-rw*0.30, ry+rh-lobeR*0.45, lobeR*0.95]
    ];
    // Left puffs
    const lefts=[
      [rx+lobeR*0.40, cy+rh*0.10, lobeR*1.10],
      [rx+lobeR*0.50, cy-rh*0.20, lobeR*1.00]
    ];
    // Compose an ellipse roughly and then union with the lobes. Simplest:
    // ellipse base + circle lobes on top.
    x.ellipse(cx,cy,a*0.92,b*0.86,0,0,Math.PI*2);
    [].concat(tops,sides,bots,lefts).forEach(function(p){
      x.moveTo(p[0]+p[2],p[1]);
      x.arc(p[0],p[1],p[2],0,Math.PI*2);
    });
    x.closePath();
  }

  // Sprint 6.5.1 — dispatch the fill path by design. For most designs the
  // existing rounded-rect path is correct; Cloud swaps it for the cloud
  // silhouette so the frame really IS cloud-shaped.
  function _frameFillPath(rect,border){
    if(border.design==='cloud'){
      _cloudPath(rect.x,rect.y,rect.w,rect.h);
      return;
    }
    _picturePath(rect.x,rect.y,rect.w,rect.h,border.cornerRadius);
  }

  // BACKLOG.md — Frame style comes over the art: a shared band-only clip
  // for any ornament that paints a picture/pattern across the frame area
  // itself, so it can never bleed into the interior artwork region. Mirrors
  // _ornamentWooden's already-correct evenodd technique (outer path XOR
  // inner content path) — an ornament calling this then drawing with fill()
  // or drawImage() is structurally restricted to the frame band alone,
  // regardless of the drawing call's own coverage. Caller must have already
  // done x.save(); pair with x.restore() after the ornament finishes.
  function _bandOnlyClip(rect,border){
    const insets=_getDesignInsets(border);
    const innerRect={
      x:rect.x+insets.left, y:rect.y+insets.top,
      w:Math.max(1,rect.w-insets.left-insets.right),
      h:Math.max(1,rect.h-insets.top-insets.bottom)
    };
    x.beginPath();
    _frameFillPath(rect,border);
    const innerR=Math.max(0,(border.cornerRadius||0)-border.padding);
    if(innerR>0){
      _picturePath(innerRect.x,innerRect.y,innerRect.w,innerRect.h,innerR);
    }else{
      x.rect(innerRect.x,innerRect.y,innerRect.w,innerRect.h);
    }
    try{ x.clip('evenodd'); }catch(e){ x.clip(); }
  }

  // Picture-frame fill (with optional drop shadow). Drawn under the image.
  //
  // Feature 1 — Image-typed Frame Variations. `border._artwork` (stashed
  // by `_artworkBorder` purely for lookups like this one — see that
  // function's own comment) may now carry `background:'image'` +
  // `frameImage` (a compiled Frame Variation field, externalized at
  // Build time exactly like every other image-bearing field —
  // `docs/VTHEME_PACKAGE_SPEC.md`'s "reference, not embedded bytes"
  // convention — so by the time root Studio ever sees it, it's a plain
  // relative-path reference resolved via `ThemeRegistry.resolveAssetRef`,
  // the identical resolution `_layerDrawDecorationImage` already uses
  // for a theme-authored Decoration image). Painted covering ('fill')
  // the exact same frame-fill path/clip the flat colour already used,
  // right after it — Rule #5 (Publish Fidelity): this must match
  // `engineRuntime.js`'s own `_paintHolder` mat-band image step exactly,
  // both painting a base colour first (a sensible fallback for a
  // transparent-PNG source) then layering the image on top when
  // authored, never the reverse.
  //
  // Studio Frame Personalization — a genuinely separate second image
  // mechanism, `border.fill==='image'`+`border.image` (Frame Style's
  // "Your Own Picture" chip, a Story Author's own upload). Mutually
  // exclusive with the Feature-1 case above by construction: `border.
  // _artwork` is only ever stashed by `_artworkBorder()`, a return path
  // `_resolveBorder` never takes once `cardOverrides.border` is set at
  // all — and `border.fill`/`.image` only ever come from that exact
  // cardOverrides.border shape. Resolved via `_ensureDecorationImage`
  // (the Draft-Asset-Architecture `vihu-asset:`/`data:` path, with the
  // slide's own `recallOwnerId` fallback — the identical resolution a
  // Story-Author-replaced World-owned object's image override already
  // uses), never `ThemeRegistry.resolveAssetRef` (reserved for
  // Theme-authored assets) — a Story Author's own upload isn't a Theme
  // asset. `s` is optional (undefined at the one swatch-preview call
  // site, `drawFrameSwatch`, which has no real slide in scope and never
  // carries a Picture-Border image anyway).
  function _drawPictureFrameFill(rect,border,theme,s){
    const fillColor=_resolveBorderFillColor(border,theme);
    const art=border._artwork;
    const hasImageBg=!!(art && art.background==='image' && art.frameImage);
    const hasBorderImageBg=!!(border.fill==='image' && border.image);
    if(!fillColor && !border.shadowEnabled && !hasImageBg && !hasBorderImageBg) return;
    x.save();
    if(border.shadowEnabled){
      x.shadowBlur=16+border.shadowIntensity*36;
      x.shadowOffsetY=6+border.shadowIntensity*10;
      x.shadowColor='rgba(0,0,0,'+(0.20+border.shadowIntensity*0.5).toFixed(3)+')';
    }
    if(fillColor){
      _frameFillPath(rect,border);
      x.fillStyle=fillColor;
      x.fill();
    }
    x.restore();

    if(hasImageBg){
      let src=art.frameImage;
      const themeId=art.id;
      if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
        try{ src=ThemeRegistry.resolveAssetRef(themeId,art.frameImage)||art.frameImage; }catch(e){}
      }
      const img=_ensureDecorationImage(src);
      if(img && img.__ready && img.width && img.height){
        x.save();
        _frameFillPath(rect,border);
        x.clip();
        // "spin/rotate is missing" -- rotated around the frame-fill
        // rect's own centre, mirroring engineRuntime.js's identical
        // rotate-around-rect-centre convention exactly (Rule #5, Publish
        // Fidelity: Builder's preview and this render must agree).
        const bgRotation=art.frameImageRotation||0;
        const rcx=rect.x+rect.w/2, rcy=rect.y+rect.h/2;
        if(bgRotation){
          x.translate(rcx,rcy);
          x.rotate(bgRotation*Math.PI/180);
          x.translate(-rcx,-rcy);
        }
        // Always cover-fit ('fill') — a Frame's own background image is
        // meant to fully cover the frame area, cropping if needed, the
        // same fixed mode engineRuntime.js's own mat-band step uses.
        // Cover scale must account for rotation: after rotating the
        // canvas by θ, the target rect appears rotated by -θ in the
        // image's frame, so the image needs to cover the rotated
        // rect's own AABB, not the axis-aligned rect. Without this,
        // rotation≠0 leaves the rect corners uncovered and exposes
        // whatever was drawn beneath.
        const iw=img.width, ih=img.height;
        const scale=_rotationCoverScale(rect.w,rect.h,iw,ih,bgRotation);
        const dw=iw*scale, dh=ih*scale;
        x.drawImage(img,rcx-dw/2,rcy-dh/2,dw,dh);
        x.restore();
      }
    }

    if(hasBorderImageBg){
      const img=_ensureDecorationImage(border.image, s && s.recallOwnerId);
      if(img && img.__ready && img.width && img.height){
        x.save();
        _frameFillPath(rect,border);
        x.clip();
        const rotation=border.imageRotation||0;
        const rcx=rect.x+rect.w/2, rcy=rect.y+rect.h/2;
        if(rotation){
          x.translate(rcx,rcy);
          x.rotate(rotation*Math.PI/180);
          x.translate(-rcx,-rcy);
        }
        // Cover-fit, matching the Feature-1 image-background convention
        // above exactly — a Frame Picture is meant to fully cover the
        // frame area, cropping if needed. Rotation-aware scale so a
        // rotated image still covers the rect corners.
        const iw=img.width, ih=img.height;
        const scale=_rotationCoverScale(rect.w,rect.h,iw,ih,rotation);
        const dw=iw*scale, dh=ih*scale;
        x.drawImage(img,rcx-dw/2,rcy-dh/2,dw,dh);
        x.restore();
      }
    }
  }

  // Cover-fit scale that stays correct when the target rect is rotated.
  // After rotating the canvas by θ, the target rect appears rotated by
  // -θ in the image's own frame. To cover it, the image must scale to
  // fit the rotated rect's axis-aligned bounding box, not the original
  // axis-aligned rect. Bug 4 discovery: without this, rotation!=0
  // silently leaves rect corners uncovered.
  function _rotationCoverScale(rectW,rectH,iw,ih,rotationDeg){
    if(!rotationDeg) return Math.max(rectW/iw,rectH/ih);
    const rad=rotationDeg*Math.PI/180;
    const c=Math.abs(Math.cos(rad)), sn=Math.abs(Math.sin(rad));
    const w2=rectW*c+rectH*sn;
    const h2=rectW*sn+rectH*c;
    return Math.max(w2/iw,h2/ih);
  }

  // Sprint 6.5.1 — per-design ornament drawn after the image, under the
  // stroke. This is what gives each Frame Design its visual identity
  // (sparkles for Magic, grain for Wooden, ribbon corners for Ribbon, …).
  function _drawPictureFrameOrnament(rect,border,theme){
    if(!border.design) return;
    switch(border.design){
      case 'storybook': return _ornamentStorybook(rect);
      case 'polaroid':  return _ornamentPolaroid(rect,border);
      case 'ribbon':    return _ornamentRibbon(rect);
      case 'wooden':    return _ornamentWooden(rect,border);
      case 'magic':     return _ornamentMagic(rect);
      case 'vintage':   return _ornamentVintage(rect,border,theme);
      case 'tape':      return _ornamentTape(rect);
      // Bug 4 (BACKLOG.md) — Frame Style = Image: a Theme-Author-authored
      // picture overlays as the frame ornament itself. Distinct from
      // border.image (mat-fill picture, Feature-1) and art.frameImage
      // (mat-band background picture) — both can coexist; each renders
      // in its own pipeline stage. Reads art.frameOrnamentImage /
      // art.frameOrnamentImageRotation, which ride through
      // _resolveArtworkFields' Object.assign(merged, variation.fields)
      // automatically.
      case 'image':     return _ornamentImage(rect,border);
      default: return;
    }
  }

  function _ornamentImage(rect,border){
    // Bug 4 — Frame Style = Image: draw the Theme-Author-authored
    // ornament picture across the frame BAND (border/mat) — never the
    // interior artwork region. Mirrors the exact
    // ThemeRegistry.resolveAssetRef → _ensureDecorationImage pattern
    // hasImageBg (mat-band) already uses right above, so the two
    // image-bearing frame fields resolve identically. Ordered inside
    // the ornament pipeline stage, so it correctly draws OVER the
    // mat-band fill (either colour or frameImage) and UNDER the stroke.
    //
    // BACKLOG.md — Frame style comes over the art: previously this
    // used _frameFillPath's whole-rect clip, so a full-cover image
    // painted across the interior artwork too. Now clipped to the
    // frame band only via _bandOnlyClip (evenodd: outer XOR inner
    // content), matching the technique _ornamentWooden already uses —
    // structurally impossible for the ornament to touch the artwork.
    const art=border && border._artwork;
    if(!art || !art.frameOrnamentImage) return;
    let src=art.frameOrnamentImage;
    const themeId=art.id;
    if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
      try{ src=ThemeRegistry.resolveAssetRef(themeId,art.frameOrnamentImage)||art.frameOrnamentImage; }catch(e){}
    }
    const img=_ensureDecorationImage(src);
    if(!img || !img.__ready || !img.width || !img.height) return;
    x.save();
    _bandOnlyClip(rect,border);
    const rotation=art.frameOrnamentImageRotation||0;
    const rcx=rect.x+rect.w/2, rcy=rect.y+rect.h/2;
    if(rotation){
      x.translate(rcx,rcy);
      x.rotate(rotation*Math.PI/180);
      x.translate(-rcx,-rcy);
    }
    const iw=img.width, ih=img.height;
    const scale=_rotationCoverScale(rect.w,rect.h,iw,ih,rotation);
    const dw=iw*scale, dh=ih*scale;
    x.drawImage(img,rcx-dw/2,rcy-dh/2,dw,dh);
    x.restore();
  }

  function _ornamentStorybook(rect){
    // Soft inner highlight — a thin lighter band just inside the top edge
    // so the cream paper feels printed, not flat.
    x.save();
    x.strokeStyle='rgba(255,255,255,0.45)';
    x.lineWidth=2;
    const m=4;
    x.beginPath();
    x.moveTo(rect.x+m+10, rect.y+m+2);
    x.lineTo(rect.x+rect.w-m-10, rect.y+m+2);
    x.stroke();
    x.restore();
  }

  function _ornamentPolaroid(rect,border){
    // A faint caption baseline inside the wide bottom margin so the
    // polaroid identity reads even without text.
    x.save();
    const insets=_getDesignInsets(border);
    const captionY=rect.y+rect.h-insets.bottom/2;
    x.strokeStyle='rgba(80,80,80,0.20)';
    x.lineWidth=2;
    x.beginPath();
    x.moveTo(rect.x+rect.w*0.20, captionY);
    x.lineTo(rect.x+rect.w*0.80, captionY);
    x.stroke();
    x.restore();
  }

  function _ornamentRibbon(rect){
    // Gold ribbon corners — small triangle-fold accents at each of the
    // four corners.
    x.save();
    x.fillStyle='#D4AF37';
    const s=Math.min(rect.w,rect.h)*0.08;
    const corners=[
      [rect.x, rect.y, 1, 1],
      [rect.x+rect.w, rect.y, -1, 1],
      [rect.x, rect.y+rect.h, 1, -1],
      [rect.x+rect.w, rect.y+rect.h, -1, -1]
    ];
    corners.forEach(function(c){
      x.beginPath();
      x.moveTo(c[0], c[1]);
      x.lineTo(c[0]+s*c[2], c[1]);
      x.lineTo(c[0], c[1]+s*c[3]);
      x.closePath();
      x.fill();
    });
    x.restore();
  }

  function _ornamentWooden(rect,border){
    // Horizontal wood grain — translucent darker streaks restricted to
    // the frame band (between the outer edge and the inner image rect)
    // so the grain reads as wood, not blinds over the picture.
    if(!border) return;
    const insets=_getDesignInsets(border);
    const innerRect={
      x:rect.x+insets.left, y:rect.y+insets.top,
      w:Math.max(1,rect.w-insets.left-insets.right),
      h:Math.max(1,rect.h-insets.top-insets.bottom)
    };
    x.save();
    // Compose a band-only clip path with even-odd: outer ring – inner shape.
    x.beginPath();
    _picturePath(rect.x,rect.y,rect.w,rect.h,border.cornerRadius);
    const innerR=Math.max(0,(border.cornerRadius||0)-border.padding);
    if(innerR>0){
      _picturePath(innerRect.x,innerRect.y,innerRect.w,innerRect.h,innerR);
    }else{
      x.rect(innerRect.x,innerRect.y,innerRect.w,innerRect.h);
    }
    try{ x.clip('evenodd'); }catch(e){ x.clip(); }
    x.strokeStyle='rgba(74,54,31,0.45)';
    x.lineWidth=1.5;
    const steps=18;
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const yT=rect.y+rect.h*t;
      x.beginPath();
      x.moveTo(rect.x-2, yT);
      x.bezierCurveTo(
        rect.x+rect.w*0.30, yT+(i%2?2:-2),
        rect.x+rect.w*0.70, yT+(i%2?-2:2),
        rect.x+rect.w+2, yT
      );
      x.stroke();
    }
    x.restore();
  }

  function _ornamentMagic(rect){
    // Soft purple glow + sparkle dots. The glow is a stroked rounded rect
    // a few px outside the frame; the sparkles are positioned around it.
    x.save();
    x.strokeStyle='rgba(168,124,245,0.55)';
    x.lineWidth=8;
    x.shadowColor='rgba(168,124,245,0.95)';
    x.shadowBlur=22;
    _picturePath(rect.x-3, rect.y-3, rect.w+6, rect.h+6, 24);
    x.stroke();
    x.shadowBlur=0;
    // Sparkles
    const sparkles=[
      [rect.x+rect.w*0.05, rect.y-12, 6],
      [rect.x+rect.w*0.30, rect.y-18, 5],
      [rect.x+rect.w*0.70, rect.y-10, 7],
      [rect.x+rect.w*0.95, rect.y+rect.h*0.30, 5],
      [rect.x-12, rect.y+rect.h*0.60, 6],
      [rect.x+rect.w*0.10, rect.y+rect.h+12, 5],
      [rect.x+rect.w*0.55, rect.y+rect.h+18, 6],
      [rect.x+rect.w*0.92, rect.y+rect.h+8, 4]
    ];
    x.fillStyle='#FFE17A';
    sparkles.forEach(function(p){ _drawStar(p[0],p[1],p[2]); });
    x.restore();
  }

  function _ornamentVintage(rect,border,theme){
    // Worn / aged edges — a darker brown band along the inner edge of the
    // frame fades toward the middle, and four corner spots imply age.
    x.save();
    const grad=x.createLinearGradient(rect.x,rect.y,rect.x,rect.y+rect.h);
    grad.addColorStop(0,'rgba(86,52,18,0.35)');
    grad.addColorStop(0.5,'rgba(86,52,18,0.0)');
    grad.addColorStop(1,'rgba(86,52,18,0.35)');
    x.strokeStyle=grad;
    x.lineWidth=8;
    _picturePath(rect.x+3, rect.y+3, rect.w-6, rect.h-6, Math.max(0,((border && border.cornerRadius)||0)-2));
    x.stroke();
    // Age spots
    x.fillStyle='rgba(86,52,18,0.18)';
    const spots=[
      [rect.x+rect.w*0.05, rect.y+rect.h*0.05, 3],
      [rect.x+rect.w*0.92, rect.y+rect.h*0.10, 4],
      [rect.x+rect.w*0.10, rect.y+rect.h*0.90, 3.5],
      [rect.x+rect.w*0.86, rect.y+rect.h*0.93, 4]
    ];
    spots.forEach(function(s){ x.beginPath(); x.arc(s[0],s[1],s[2],0,Math.PI*2); x.fill(); });
    x.restore();
  }

  // Sprint 9.3 — Artwork Theme "tape" frame (Sketchbook, Scrapbook).
  // Two small washi-tape strips holding the corners down, rotated a
  // few degrees so it reads as hand-placed rather than printed. Fixed
  // offsets/angles (not randomised) so the same theme renders
  // identically every time — consistent with every other ornament in
  // this file.
  function _ornamentTape(rect){
    x.save();
    x.globalAlpha=0.78;
    x.fillStyle='#E8D9B5';
    const tapes=[
      {x:rect.x+rect.w*0.14, y:rect.y-6, w:64, h:26, rot:-8},
      {x:rect.x+rect.w*0.82, y:rect.y-8, w:64, h:26, rot:6}
    ];
    tapes.forEach(function(t){
      x.save();
      x.translate(t.x,t.y);
      x.rotate(t.rot*Math.PI/180);
      x.fillRect(-t.w/2,-t.h/2,t.w,t.h);
      x.strokeStyle='rgba(255,255,255,0.35)';
      x.lineWidth=1;
      x.strokeRect(-t.w/2,-t.h/2,t.w,t.h);
      x.restore();
    });
    x.restore();
  }

  // ---------- Sprint 9.3 — Artwork Theme paper / lighting ----------
  // Drawn right after the frame fill, still entirely under the image
  // (the image is drawn afterwards and fully covers its own inner
  // rect) — these never touch the artwork itself, only the mat/
  // background band around it. Every pattern below uses fixed
  // coordinates, never Math.random(), so a page renders identically
  // on every redraw — the same discipline every other ornament in
  // this file already follows.
  function _drawArtworkPresentation(rect,border){
    const art=border && border._artwork;
    if(!art) return;
    _drawArtworkPaper(rect,art.paper);
    _drawArtworkLighting(rect,art.lighting);
    if(art.background==='bulletin-board') _drawBulletinPins(rect);
  }

  function _drawArtworkPaper(rect,paper){
    switch(paper){
      case 'notebook':   return _paperNotebook(rect);
      case 'kraft':      return _paperSpeckle(rect,'rgba(120,88,45,0.12)');
      case 'watercolor': return _paperMottled(rect,1);
      case 'canvas':     return _paperCrosshatch(rect);
      case 'handmade':   return _paperMottled(rect,0.6);
      default: return; // 'smooth' or unspecified — no texture
    }
  }

  // Faint ruled lines + a red margin line — notebook paper.
  function _paperNotebook(rect){
    x.save();
    x.strokeStyle='rgba(120,150,200,0.35)';
    x.lineWidth=1.5;
    const rowHeight=34;
    for(let ly=rect.y+rowHeight; ly<rect.y+rect.h-6; ly+=rowHeight){
      x.beginPath(); x.moveTo(rect.x+6,ly); x.lineTo(rect.x+rect.w-6,ly); x.stroke();
    }
    x.strokeStyle='rgba(214,90,90,0.30)';
    x.lineWidth=2;
    x.beginPath(); x.moveTo(rect.x+26,rect.y+4); x.lineTo(rect.x+26,rect.y+rect.h-4); x.stroke();
    x.restore();
  }

  // Small fixed dot scatter — kraft paper's soft speckle.
  function _paperSpeckle(rect,color){
    x.save();
    x.fillStyle=color;
    const cols=6, rows=5;
    for(let i=0;i<cols;i++){
      for(let j=0;j<rows;j++){
        const ox=((i*37+j*13)%17)-8;
        const oy=((i*11+j*29)%13)-6;
        const px=rect.x+rect.w*((i+0.5)/cols)+ox;
        const py=rect.y+rect.h*((j+0.5)/rows)+oy;
        x.beginPath(); x.arc(px,py,1.6,0,Math.PI*2); x.fill();
      }
    }
    x.restore();
  }

  // Three soft radial blobs — watercolor bleed / handmade paper's
  // uneven surface, at a lower alpha for handmade.
  function _paperMottled(rect,alphaScale){
    x.save();
    const blobs=[
      [rect.x+rect.w*0.22, rect.y+rect.h*0.30, rect.w*0.30],
      [rect.x+rect.w*0.70, rect.y+rect.h*0.65, rect.w*0.26],
      [rect.x+rect.w*0.45, rect.y+rect.h*0.85, rect.w*0.22]
    ];
    blobs.forEach(function(b){
      const grad=x.createRadialGradient(b[0],b[1],0,b[0],b[1],b[2]);
      grad.addColorStop(0,'rgba(255,255,255,'+(0.10*alphaScale).toFixed(3)+')');
      grad.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=grad;
      x.beginPath(); x.arc(b[0],b[1],b[2],0,Math.PI*2); x.fill();
    });
    x.restore();
  }

  // Fine diagonal crosshatch — canvas weave.
  function _paperCrosshatch(rect){
    x.save();
    x.strokeStyle='rgba(0,0,0,0.05)';
    x.lineWidth=1;
    const step=14;
    for(let ox=-rect.h; ox<rect.w; ox+=step){
      x.beginPath();
      x.moveTo(rect.x+ox,rect.y);
      x.lineTo(rect.x+ox+rect.h,rect.y+rect.h);
      x.stroke();
    }
    x.restore();
  }

  // Lighting only ever washes the mat/background band — never the
  // artwork itself ("Lighting only affects presentation. Never alter
  // artwork colours.").
  function _drawArtworkLighting(rect,lighting){
    switch(lighting){
      case 'gallery': return _lightingGlow(rect, rect.x+rect.w*0.5, rect.y+rect.h*0.25, Math.max(rect.w,rect.h)*0.7, 0.10);
      case 'soft':    return _lightingGlow(rect, rect.x+rect.w*0.5, rect.y+rect.h*0.40, Math.max(rect.w,rect.h)*0.85, 0.06);
      case 'window':  return _lightingDirectional(rect);
      default: return; // 'none' or unspecified
    }
  }
  function _lightingGlow(rect,cx,cy,r,alpha){
    x.save();
    const grad=x.createRadialGradient(cx,cy,0,cx,cy,r);
    grad.addColorStop(0,'rgba(255,248,224,'+alpha.toFixed(3)+')');
    grad.addColorStop(1,'rgba(255,248,224,0)');
    x.fillStyle=grad;
    x.fillRect(rect.x,rect.y,rect.w,rect.h);
    x.restore();
  }
  function _lightingDirectional(rect){
    x.save();
    const grad=x.createLinearGradient(rect.x,rect.y,rect.x+rect.w,rect.y+rect.h*0.3);
    grad.addColorStop(0,'rgba(255,255,255,0.12)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=grad;
    x.fillRect(rect.x,rect.y,rect.w,rect.h);
    x.restore();
  }

  // Classroom Display's "pinned to the bulletin board" detail — two
  // small pin heads at the top corners of the OUTER rect (deliberately
  // not clipped to the fill/frame path, since a pin is meant to sit on
  // the board's surface, slightly overlapping the picture's edge).
  function _drawBulletinPins(rect){
    x.save();
    const pins=[[rect.x+18,rect.y+14],[rect.x+rect.w-18,rect.y+14]];
    pins.forEach(function(p){
      const grad=x.createRadialGradient(p[0]-2,p[1]-2,0,p[0],p[1],7);
      grad.addColorStop(0,'#F2E4C4');
      grad.addColorStop(1,'#B8934A');
      x.fillStyle=grad;
      x.beginPath(); x.arc(p[0],p[1],6,0,Math.PI*2); x.fill();
      x.strokeStyle='rgba(0,0,0,0.25)';
      x.lineWidth=1;
      x.stroke();
    });
    x.restore();
  }

  // Artwork caption — museum label / handwritten note / student tag /
  // minimal line, drawn just under the panel (legacy Story-role
  // layout only; a scene-based image holder can sit anywhere on the
  // page, so there's no single safe spot to anchor a caption under it
  // — out of scope for this sprint, see render()'s call site).
  // "Captions remain optional": with no slide.metadata.artwork set
  // (true for every project today — no UI writes this field yet) this
  // draws nothing at all, exactly like every other artwork-theme
  // effect does when there's nothing to show.
  // `theme` is the resolved Story Theme — the caption sits in the
  // frame band below the panel (same area the footer already reads
  // theme.footerText.color for), so it uses that colour too rather
  // than a hardcoded shade. A hardcoded dark grey would go invisible
  // against a dark frame colour like Storybook Classic's navy; every
  // Story Theme's footerText colour is already tuned for legibility
  // against its own frame, so reusing it guarantees the caption reads
  // no matter which Story Theme + Artwork Theme are combined.
  function _drawArtworkCaption(art,meta,panelRect,theme){
    if(!art || !art.caption || art.caption==='none') return;
    const info=(meta && meta.artwork) || null;
    const title=(info && typeof info.title==='string') ? info.title.trim() : '';
    if(!title) return;
    const subParts=[];
    if(info.artist) subParts.push(String(info.artist));
    if(info.age) subParts.push('Age '+info.age);
    if(info.date) subParts.push(String(info.date));
    const subLine=subParts.join('  ·  ');
    const baseColor=(theme && theme.footerText && theme.footerText.color) || '#FFFFFF';

    const cx=panelRect.x+panelRect.w/2;
    const titleY=panelRect.y+panelRect.h+34;
    let titleFont,titleAlpha,subFont,titleText;
    switch(art.caption){
      case 'museum':
        titleFont='600 18px Georgia, serif'; titleAlpha=0.92; titleText=title.toUpperCase();
        subFont='16px Georgia, serif';
        break;
      case 'handwritten':
        titleFont='italic 26px Georgia, serif'; titleAlpha=0.92; titleText=title;
        subFont='italic 18px Georgia, serif';
        break;
      case 'student':
        titleFont='600 20px "Comic Sans MS", "Chalkboard SE", sans-serif'; titleAlpha=0.92; titleText=title;
        subFont='16px "Comic Sans MS", "Chalkboard SE", sans-serif';
        break;
      case 'minimal':
      default:
        titleFont='300 16px "Helvetica Neue", Arial, sans-serif'; titleAlpha=0.78; titleText=title;
        subFont='300 13px "Helvetica Neue", Arial, sans-serif';
        break;
    }
    x.save();
    x.textAlign='center';
    x.textBaseline='alphabetic';
    x.fillStyle=baseColor;
    x.font=titleFont;
    x.globalAlpha=titleAlpha;
    x.fillText(titleText,cx,titleY);
    if(subLine){
      x.font=subFont;
      x.globalAlpha=titleAlpha*0.72;
      x.fillText(subLine,cx,titleY+22);
    }
    x.restore();
  }

  // Picture-frame stroke. Drawn over the image so it always reads as a
  // crisp border, even when fill is "None".
  function _drawPictureFrameStroke(rect,border){
    if(!border.lineEnabled || !border.lineWidth) return;
    x.save();
    _frameFillPath(rect,border);
    x.lineWidth=border.lineWidth;
    x.strokeStyle=border.lineColor;
    x.stroke();
    x.restore();
  }

  // ===========================================================
  // Sprint 9.6 — Museum Gallery Theme Support: Layer System draw
  // helpers. LayerEngine (js/layerEngine.js) owns filtering-by-target,
  // z-ordering and anchor resolution; every actual canvas-2d call
  // stays here, same discipline as the rest of this file.
  // ===========================================================
  // Builder Convergence — a Scene's own Layer Pack entries are only
  // ever meant for the one Layout that Scene converged into (a Layout
  // id shared with the Scene-derived Representation's own `layout`
  // field); without this filter every converged Scene's Layers would
  // leak onto every other page using the same theme. A layer with no
  // `scope` (every layer authored before this) always passes — the
  // theme.layerPack global scheme every pre-existing theme relies on
  // is completely unaffected.
  // Turns a Layer Pack entry's own id ('wax-seal', 'gallery-spotlight')
  // into a readable label ('Wax Seal', 'Gallery Spotlight') for the
  // Object Strip / hit-test bbox, when the theme hasn't declared its
  // own `layer.label`. Purely cosmetic; never affects rendering.
  function _humanizeLayerId(id){
    if(!id) return 'Object';
    return String(id).split(/[-_]/).map(function(w){
      return w ? w.charAt(0).toUpperCase()+w.slice(1) : w;
    }).join(' ');
  }

  function _activeLayerPack(s){
    const theme=_layoutTheme(s);
    const pack=(theme && Array.isArray(theme.layerPack)) ? theme.layerPack : null;
    if(!pack) return null;
    const chosenLayoutId=(s && s.metadata && s.metadata.layout) || null;
    return pack.filter(function(l){ return !l || !l.scope || l.scope===chosenLayoutId; });
  }

  // Real, user-requested "set the background colour as transparent" —
  // Publish Fidelity's own mirror of engineRuntime.js's identical
  // _hasExplicitBottomFill: a Scene-hosted Colour Experience's own
  // full-bleed background fill Layer always compiles to target:'slide'
  // (builder.js's convergeSceneLayer), so its presence here is the
  // deliberate signal that this page's own opaque backdrop fallback
  // (render(s)'s own fillStyle/fillRect line) must be skipped, letting
  // the Layer's own colour+alpha (possibly fully transparent) be the
  // ENTIRE base rather than painting underneath it. A page with no such
  // Layer Pack entry is completely unaffected -- every existing theme,
  // and any page authored before this capability, keeps its exact
  // opaque wallTone/frameColor fallback.
  function _hasSlideFullBleedFill(pack){
    if(!pack) return false;
    return pack.some(function(l){
      return l && l.visible!==false && l.target==='slide' && l.type==='decoration' &&
             l.decoration && l.decoration.kind==='fill' &&
             l.rect && (l.rect.w||0)>=0.98 && (l.rect.h||0)>=0.98;
    });
  }

  // Sprint 9.7 — a declarative Layer Pack entry (Handle / Page Number)
  // may carry a `position` field pinning it to a specific corner,
  // overriding the Story Theme's own handlePosition/pageNumber default
  // for that one theme. No entry, no `position` field: null, and the
  // existing themeOptions default runs exactly as before.
  function _layerPosition(pack,id){
    const l=pack && pack.find(function(l2){ return l2 && l2.id===id; });
    return (l && l.position) || null;
  }

  // Returns a {bx,by,bw,bh} geometry box for whatever it drew (used by
  // _renderLayers to register a real, selectable/clickable Object Strip
  // + hit-test entry for Layer Pack content — see the id/type/label
  // wrapping in _renderLayers itself), or null when nothing was drawn.
  function _layerDrawText(layer,anchor,rect,s){
    const t=layer.text||{};
    // Sprint 9.7 — Museum Gallery Fidelity: 'museumCaption' composes the
    // Design Board's two-line museum label (bold serif title, then a
    // muted "By {artist} ✍️  Age {age} 🎂 | {date} 📅" line) from real
    // per-slide fields instead of one flat string.
    if(t.source==='museumCaption') return _drawMuseumCaption(t,anchor,s,layer);
    const ov=_layerOverride(s,layer.id);
    let content=t.content||'';
    // 'slideCaption' — a plain per-slide caption string a child typed
    // (slide.metadata.caption), same convention as bookTitle / handle
    // already being plain per-slide string fields. Kept as a simpler
    // single-field option for future themes that don't need the full
    // Title/Artist/Age/Date breakdown.
    if(t.source==='slideCaption') content=(s && s.metadata && typeof s.metadata.caption==='string' && s.metadata.caption) || content;
    if(ov && typeof ov.content==='string') content=ov.content;
    if(!content) return null;
    const baseSize=t.size||18;
    // Honor Grid follow-up — full typography becomes a real Story-Author
    // capability for a moveable/editable World-owned Text object (Font
    // Family/Size/Weight/Style/Colour already had ov.color read above;
    // Alignment joins here). Each field falls back to the Theme Author's
    // own authored value when no override exists — byte-identical to
    // before this change for every object nobody has ever touched.
    const hAlign=(ov && (ov.alignment==='left'||ov.alignment==='center'||ov.alignment==='right')) ? ov.alignment : (anchor.hAlign==='left'?'left':anchor.hAlign==='right'?'right':'center');
    const vAlign=anchor.vAlign==='top'?'top':anchor.vAlign==='bottom'?'bottom':'middle';
    const fontFamily=(ov && ov.fontFamily)||t.font||'Georgia, serif';
    const fontWeight=(ov && ov.fontWeight)||'';
    const fontStyle=(ov && ov.fontStyle==='italic')?'italic':'';
    x.save();
    let size=(ov && typeof ov.fontSize==='number' && ov.fontSize>0)?ov.fontSize:baseSize;
    x.font=(fontStyle?fontStyle+' ':'')+(fontWeight?fontWeight+' ':'')+size+'px '+fontFamily;
    // Real, user-reported gap: a Text Experience's own manual line
    // breaks (Enter in the Words/Content field, World Builder's own
    // Working View/Runtime Preview already honour this) were silently
    // flattened here — this drew the whole `content` string in one
    // fillText call, no wrap, no newline handling at all. Fixed by
    // reusing the same _wrapText helper Quote/freeform-sticker text
    // already use (kept in lockstep with engineRuntime.js's own
    // _wrapLines) — word-wraps against this layer's own rect width
    // (a Scene-converged Text Layer always carries a real, non-zero
    // rect.w; a legacy declarative caption falls back to the broader
    // panel/slide/holder rect, wide enough that a short caption still
    // renders on one line exactly as before) and treats an explicit
    // '\n' as a forced line break either way.
    // Real, user-reported bug (found testing Guardrails specifically —
    // "am only testing the rules which builder has provided and are they
    // getting honored"): resizing a moveable:true World-owned text object
    // past ~6x its own natural width made the canvas appear to "freeze"
    // — the underlying size override kept growing on every further drag
    // tick (confirmed via a direct sweep: overrideW climbed from 333 to
    // 4003 with zero further visual change past the 6x mark) while the
    // render silently stopped changing, because the resize-grid fix this
    // replaces derived a font-size SCALE from the override width and
    // clamped that scale to Math.max(0.2,Math.min(6,...)) — an invented
    // mechanism with no counterpart anywhere in Builder. Confirmed via
    // direct comparison against tools/world-builder-v2/js/services/
    // engineRuntime.js's own _paintLayer/textFootprint: Builder's text
    // Layers NEVER scale font size off a resized box at all — resizing
    // only changes the WRAP WIDTH (rewraps the same-size text), and
    // height is always derived from the resulting wrapped line count,
    // never independently read from the box's own height. Studio's own
    // freeform text stickers (_textObjBbox/_textLineMetrics) already
    // follow this exact model correctly — only this Layer Pack path
    // invented a divergent one. Fixed to match both references: a size
    // override's own w becomes the wrap width directly (no ratio, no
    // clamp, no ceiling — matching Builder's genuinely unbounded resize),
    // font size is never touched by resize, and height keeps being
    // derived from the wrapped line count exactly as it already was.
    const maxWidth=Math.max(1, (ov && ov.size && typeof ov.size.w==='number') ? ov.size.w : (rect && typeof rect.w==='number' ? rect.w : Infinity));
    const lines=_wrapText(content,maxWidth);
    const lineHeight=Math.round(size*1.25);
    const totalH=lines.length*lineHeight;
    let maxLineWidth=0;
    lines.forEach(function(line){
      const lw=x.measureText(line).width;
      if(lw>maxLineWidth) maxLineWidth=lw;
    });
    // Honour World-Owned Object Commitments sprint — a moveable:true
    // text layer's Story-Author position override is a translation
    // applied to whatever this layer would have drawn at naturally,
    // computed from the natural (un-dragged) bbox center so the shift
    // is correct regardless of text alignment (left/center/right).
    // Absent an override, drawX/drawY equal anchor.x/anchor.y exactly —
    // byte-identical to before this fix for every existing theme (a
    // single line's own totalH is size*1.25, a few px taller than the
    // old bare `size` — the bbox is a hit-test/selection box only,
    // never rendered, so this is a negligible, disclosed difference).
    let natBx=anchor.x-maxLineWidth/2; if(hAlign==='left') natBx=anchor.x; else if(hAlign==='right') natBx=anchor.x-maxLineWidth;
    let natBy=anchor.y-totalH/2; if(vAlign==='top') natBy=anchor.y; else if(vAlign==='bottom') natBy=anchor.y-totalH;
    let drawX=anchor.x, drawY=anchor.y;
    if(ov && ov.position){
      drawX+=ov.position.x-(natBx+maxLineWidth/2);
      drawY+=ov.position.y-(natBy+totalH/2);
    }
    // Moved up from the end of the function (was computed after
    // x.restore()) so the new Shapes Fill Style branch below — which
    // needs the natural, untransformed text-block bbox to build its
    // offscreen mosaic canvas — can use it before any drawing happens.
    let bx=drawX-maxLineWidth/2;
    if(hAlign==='left') bx=drawX; else if(hAlign==='right') bx=drawX-maxLineWidth;
    let by=drawY-totalH/2;
    if(vAlign==='top') by=drawY; else if(vAlign==='bottom') by=drawY-totalH;
    // Honor Grid follow-up — Rotation (Honor 2/Moveable, a spatial
    // transform living in the same bucket as Move/Resize) rotates around
    // the resolved (post-position-override) center; Opacity (Honor
    // 3/Editable, an appearance property alongside Colour/Words) fades
    // it. Both ride on this function's own existing x.save()/x.restore()
    // wrap (above/below), so neither needs its own cleanup. Absent
    // either override this is a no-op — byte-identical to before.
    x.globalAlpha=(ov && typeof ov.opacity==='number')?Math.max(0,Math.min(1,ov.opacity)):1;
    // "add rotation to text, and graphics in builder" — until this fix,
    // ov.rotation (a Story-Author's own override, above) was the ONLY
    // rotation mechanism this function read; a Theme-Author-authored
    // rotation compiled at Build time (t.rotation, World Builder's own
    // Rotation slider for a Text Experience) was silently never applied
    // here at all — a real Fidelity gap, unlike the sibling image/shape
    // Decoration draw functions, which already read a compiled
    // decoration.rotation directly. t.rotation is now the base; a real
    // Story-Author override (ov.rotation) still wins over it, matching
    // the exact ov-overrides-t precedent every other field here already
    // uses (fontFamily/color/etc.) — byte-identical to before for any
    // object with neither set.
    const rotation=(ov && typeof ov.rotation==='number')?ov.rotation:(typeof t.rotation==='number'?t.rotation:0);
    if(rotation){
      x.translate(drawX,drawY);
      x.rotate(rotation*Math.PI/180);
      x.translate(-drawX,-drawY);
    }
    // Bug G — "For texts allow these curves." Total arc-angle degrees
    // (0 = flat, byte-identical to before this feature). Precedence
    // mirrors rotation/opacity/fontWeight exactly: Story-Author
    // ov.curve wins over Theme-Author-authored t.curve base.
    const textCurve=(ov && typeof ov.curve==='number')?ov.curve:(typeof t.curve==='number'?t.curve:0);
    // Bug G Rework — Curve Style ('none'/'arc'/'wave'/'circle').
    // Same tri-state precedence: ov wins over t. Backward compat: an
    // older object with curve set but no curveStyle is treated as 'arc'
    // by _drawStyledTextLine (the resolveEffective step there), matching
    // the original Bug G behaviour byte-for-byte.
    const curveStyle=(ov && typeof ov.curveStyle==='string')?ov.curveStyle:(typeof t.curveStyle==='string'?t.curveStyle:(textCurve?'arc':'none'));
    const isCurvedActive = curveStyle && curveStyle!=='none' && (curveStyle==='circle' || textCurve!==0);
    x.textAlign=hAlign;
    // "why we dont have underline as a style, and strikethrough also" —
    // Canvas has no native text-decoration; the only way to render either
    // is a manually-stroked line. Drawn per-line (not once across the
    // whole block) so a shorter wrapped line — the last line of a
    // paragraph, say — gets a stroke matching ITS OWN measured width,
    // never the shared maxLineWidth every line was wrapped against.
    const hasUnderline=!!(ov && ov.underline);
    const hasStrikethrough=!!(ov && ov.strikethrough);
    // "what do we call this kind of fonts" — a real Fill Style choice,
    // Solid (the original, unchanged behaviour below) vs. Shapes (a
    // colorful geometric-mosaic fill clipped to the real glyph shapes
    // via _drawShapeMosaicTextBlock, working for any text/any font with
    // no per-glyph art). ov wins over a Theme-Author-authored base,
    // matching the exact tri-state precedent rotation/opacity already
    // use above — absent either, this is a plain false/Solid, so every
    // existing theme renders byte-identically to before this feature.
    const shapeFillOn=(ov && typeof ov.shapeFill==='boolean')?ov.shapeFill:!!t.shapeFill;
    // Bug G Rework — shared line-draw dispatcher used by both the
    // shape-mosaic drawTextFn (below) AND the plain-colour path, so
    // Shape-Mosaic Fill now honours Curve Style too (the earlier Bug G
    // ship shipped Curve for solid text only; the mask+composite path
    // silently skipped it). isCurvedActive gates the choice between the
    // styled per-line dispatcher and the straight fillText/strokeText
    // fallback — absent curveStyle (or curveStyle==='none'), this is
    // byte-identical to before.
    const drawStyledLine=function(targetCtx,line,g,isStroke){
      if(!isCurvedActive){
        if(isStroke) targetCtx.strokeText(line,drawX,g.lineY);
        else targetCtx.fillText(line,drawX,g.lineY);
        return;
      }
      let cx=drawX;
      const lw=targetCtx.measureText(line).width;
      if(hAlign==='left') cx=drawX+lw/2;
      else if(hAlign==='right') cx=drawX-lw/2;
      const drew=_drawStyledTextLine(targetCtx,line,cx,g.lineY,curveStyle,textCurve,isStroke?'stroke':'fill');
      if(!drew){
        if(isStroke) targetCtx.strokeText(line,drawX,g.lineY);
        else targetCtx.fillText(line,drawX,g.lineY);
      }
    };
    if(shapeFillOn){
      const fontStr=x.font;
      const drawTextFn=function(targetCtx,isStroke){
        targetCtx.font=fontStr;
        targetCtx.textAlign=hAlign;
        lines.forEach(function(line,i){
          const g=_textLineGeometry(i,lines,drawY,lineHeight,totalH,vAlign);
          targetCtx.textBaseline=g.baseline;
          if(isStroke){
            targetCtx.strokeStyle='#FFFFFF';
            targetCtx.lineWidth=Math.max(1.5,size*0.05);
          } else {
            targetCtx.fillStyle='#000000';
          }
          drawStyledLine(targetCtx,line,g,isStroke);
        });
      };
      // Bug G Rework — expand the mask/pattern bbox generously when a
      // curved style is active, so a curved glyph's real reach is never
      // clipped by too small an offscreen canvas. Arc adds bulge from
      // the arc's own sagitta; wave adds ±amplitude; circle becomes
      // roughly a 2*radius square (radius = textWidth/2π).
      let mbx=bx, mby=by, mbw=maxLineWidth, mbh=totalH;
      if(isCurvedActive){
        if(curveStyle==='arc'){
          const arcRad=Math.abs((textCurve||0)*Math.PI/180);
          const radius=maxLineWidth/Math.max(0.001,arcRad);
          const bulge=Math.abs(radius*(1-Math.cos(arcRad/2)));
          mbh+=bulge+size;
          if((textCurve||0)<0) mby-=bulge;
        } else if(curveStyle==='wave'){
          const amp=Math.abs(textCurve||0)*0.3;
          mbh+=amp*2+size*0.3;
          mby-=amp;
        } else if(curveStyle==='circle'){
          const cr=maxLineWidth/(2*Math.PI);
          const diameter=2*cr+size*1.2;
          mbx=drawX-diameter/2;
          mby=by;
          mbw=diameter;
          mbh=diameter;
        }
      }
      _drawShapeMosaicTextBlock(x,mbx,mby,mbw,mbh,drawTextFn);
      if(hasUnderline||hasStrikethrough){
        lines.forEach(function(line,i){
          const g=_textLineGeometry(i,lines,drawY,lineHeight,totalH,vAlign);
          _drawTextLineDecoration(x,line,g.lineY,vAlign,hAlign,drawX,size,'#22252b',hasUnderline,hasStrikethrough);
        });
      }
    } else {
      x.fillStyle=(ov && ov.color)||t.color||'#333333';
      lines.forEach(function(line,i){
        const g=_textLineGeometry(i,lines,drawY,lineHeight,totalH,vAlign);
        x.textBaseline=g.baseline;
        // Bug G Rework — one dispatch for all four styles (None/Arc/
        // Wave/Circle). Underline/strikethrough deliberately draw
        // straight even under curved text — a curved baseline
        // decoration would need per-char stroke segments; disclosed as
        // out of scope, matching Bug G's own original scope.
        drawStyledLine(x,line,g,false);
        if(hasUnderline||hasStrikethrough){
          _drawTextLineDecoration(x,line,g.lineY,vAlign,hAlign,drawX,size,x.fillStyle,hasUnderline,hasStrikethrough);
        }
      });
    }
    x.restore();
    return {bx:bx,by:by,bw:maxLineWidth,bh:totalH+8};
  }

  function _drawMuseumCaption(t,anchor,s,layer){
    const m=(s && s.metadata) || {};
    const title=(typeof m.artworkTitle==='string') ? m.artworkTitle.trim() : '';
    const artist=(typeof m.artist==='string') ? m.artist.trim() : '';
    const age=(typeof m.age==='string' || typeof m.age==='number') ? String(m.age).trim() : '';
    const date=(typeof m.date==='string') ? m.date.trim() : '';
    if(!title && !artist && !age && !date) return null;
    const metaParts=[];
    if(artist) metaParts.push('By '+artist+' ✍️');
    if(age) metaParts.push('Age '+age+' 🎂');
    if(date) metaParts.push(date+' 📅');
    const metaLine=metaParts.join('   |   ');

    const titleSize=t.size||20;
    const align=anchor.hAlign==='left'?'left':anchor.hAlign==='right'?'right':'center';
    const font=t.font||'Georgia, serif';

    // Real, user-reported freeze bug ("reposition text first and then
    // try to resize" — the visible pixels never moved even though the
    // model kept recording a fresh override on every drag/resize tick):
    // unlike every other _layerDrawText text source, this whole draw
    // path early-returned before `ov=_layerOverride(s,layer.id)` was
    // ever read, so a moveable/editable museumCaption Layer's own
    // position/size overrides were silently never applied at all — a
    // direct Guardrails (Rule #2) violation, since resize handles are
    // shown for it (type:'text') the same as any other moveable text
    // object. Fixed by measuring first (never drawing until the final
    // position is known, matching _layerDrawText's own natural-center-
    // relative translation for position), and treating ov.size.w as a
    // wrap-width constraint for both lines — reusing the shared
    // _wrapText helper — exactly the same "resize changes wrap width,
    // never font size" semantics _layerDrawText already applies.
    // Absent any override, maxWidth stays Infinity (never wraps) and
    // drawX/drawY stay anchor.x/anchor.y — byte-identical to before
    // this fix for every existing, unmoved Museum Caption.
    const ov=_layerOverride(s, layer && layer.id);
    // Real regression caught via a git-stash pixel-hash A/B before
    // shipping: routing the natural (no-override) string through
    // _wrapText even at maxWidth=Infinity still re-joins its
    // whitespace-split words with a single space each, silently
    // collapsing metaLine's own deliberate '   |   ' (3-space) visual
    // separator to a single space for EVERY existing Museum Caption —
    // wrapping (and the whitespace normalization that comes with it)
    // must only ever kick in once a real size override actually asks
    // for it; absent one, the exact original strings/whitespace are
    // used untouched, one line each, matching pre-fix pixels exactly.
    const hasSizeOverride=!!(ov && ov.size && typeof ov.size.w==='number');
    const maxWidth=hasSizeOverride?Math.max(1,ov.size.w):Infinity;
    const titleLineHeight=Math.round(titleSize*1.2);
    const metaLineHeight=Math.round(titleSize*0.65*1.2);

    let maxW=0;
    x.save();
    x.font=titleSize+'px '+font;
    const titleLines=!title?[]:(hasSizeOverride?_wrapText(title,maxWidth):[title]);
    titleLines.forEach(function(line){ maxW=Math.max(maxW,x.measureText(line).width); });
    x.font=Math.round(titleSize*0.65)+'px '+font;
    const metaLines=!metaLine?[]:(hasSizeOverride?_wrapText(metaLine,maxWidth):[metaLine]);
    metaLines.forEach(function(line){ maxW=Math.max(maxW,x.measureText(line).width); });
    x.restore();
    if(!titleLines.length && !metaLines.length) return null;

    const totalH=(titleLines.length*titleLineHeight)+(metaLines.length*metaLineHeight);
    let natBx=anchor.x-maxW/2; if(align==='left') natBx=anchor.x; else if(align==='right') natBx=anchor.x-maxW;
    const natBy=anchor.y;
    let drawX=anchor.x, drawY=anchor.y;
    if(ov && ov.position){
      drawX+=ov.position.x-(natBx+maxW/2);
      drawY+=ov.position.y-(natBy+totalH/2);
    }

    x.save();
    x.textAlign=align;
    x.textBaseline='top';
    let cy=drawY;
    if(titleLines.length){
      x.font=titleSize+'px '+font;
      x.fillStyle=t.color||'#3A3A3A';
      titleLines.forEach(function(line){ x.fillText(line,drawX,cy); cy+=titleLineHeight; });
    }
    if(metaLines.length){
      x.font=Math.round(titleSize*0.65)+'px '+font;
      x.fillStyle='rgba(58,58,58,0.72)';
      metaLines.forEach(function(line){ x.fillText(line,drawX,cy); cy+=metaLineHeight; });
    }
    x.restore();

    let bx=drawX-maxW/2;
    if(align==='left') bx=drawX; else if(align==='right') bx=drawX-maxW;
    return {bx:bx,by:drawY,bw:maxW,bh:totalH};
  }

  // Wax Seal (Museum Gallery's one shipped Sticker Layer, Frame-
  // targeted). A custom glyph draws as-is; the default is a small
  // drawn ornament (not an emoji) so the look never depends on font/
  // emoji coverage.
  // Sprint 9.7 — default glyphs for the rest of the Design Board's
  // named Sticker Layer catalog (Gallery Badge, Certificate Ribbon,
  // Curator Pick, Museum Stamp). A theme never has to use these — any
  // layer.sticker.glyph always wins — but declaring e.g. {id:
  // 'gallery-badge', type:'sticker', ...} with no glyph of its own
  // still renders something on-theme instead of a generic circle. Not
  // part of Museum Gallery's shipped layerPack (the board's own
  // "Common Layers" panel keeps that minimal); available for any
  // future theme package that wants them.
  const LAYER_STICKER_GLYPH={
    'gallery-badge':'🏅',
    'certificate-ribbon':'🎗️',
    'curator-pick':'⭐',
    'museum-stamp':'🔖'
  };
  function _layerDrawSticker(layer,anchor,s){
    const st=layer.sticker||{};
    const glyph=st.glyph||LAYER_STICKER_GLYPH[layer.id];
    // Honour World-Owned Object Commitments sprint — a Sticker Layer's
    // bbox is always centered on its anchor for both the glyph and the
    // drawn-circle fallback, so a position override can simply replace
    // the anchor point outright (no alignment-dependent shift needed,
    // unlike text). Absent an override, ax/ay equal anchor.x/anchor.y
    // exactly — unchanged for every existing theme.
    const ov=_layerOverride(s,layer.id);
    let ax=anchor.x, ay=anchor.y;
    if(ov && ov.position){ ax=ov.position.x; ay=ov.position.y; }
    // "The Grid" audit — a moveable:true Layer Pack Sticker (e.g. a
    // Wax Seal) has always structurally offered resize handles
    // (_supportsResize includes type:'sticker') but this function never
    // read the Story-Author's own size override at all — the exact
    // "resize is completely inert" gap already fixed once for fill/
    // image/shape/legacy-decoration kinds, just missed for this
    // separate declarative-sticker draw path. A sticker's own resize is
    // corner-only and uniformly scaled (js/app.js locks aspect for
    // type:'sticker' the same way it does for type:'text'), so
    // ov.size.w/.h are always roughly equal — averaging them keeps a
    // genuinely square glyph/circle square regardless of tiny
    // mouse-drag rounding either side. Absent an override, this is
    // byte-identical to before this fix.
    let size=st.size||36;
    if(ov && ov.size && typeof ov.size.w==='number' && typeof ov.size.h==='number'){
      size=(ov.size.w+ov.size.h)/2;
    }
    if(glyph){
      x.save();
      x.font=size+'px sans-serif';
      x.textAlign='center';
      x.textBaseline='middle';
      x.fillText(glyph,ax,ay);
      x.restore();
      return {bx:ax-size/2,by:ay-size/2,bw:size,bh:size};
    }
    x.save();
    x.translate(ax,ay);
    const r=size/2;
    // A glyph-less sticker (the colour-circle fallback) already showed
    // a real Colour edit control in the right panel/action strip — its
    // _layerVisual entry resolves kind:'color' — but this draw call
    // never read the ov.fillColor that control writes, so picking a
    // new colour silently did nothing visible. Fixed to match the
    // identical ov.fillColor precedence _layerDrawDecoration's own
    // 'fill' branch already uses.
    x.fillStyle=(ov && ov.fillColor)||st.color||'#7A1F2B';
    x.beginPath(); x.arc(0,0,r,0,Math.PI*2); x.fill();
    x.strokeStyle='rgba(255,255,255,0.35)';
    x.lineWidth=2;
    x.beginPath(); x.arc(0,0,r*0.6,0,Math.PI*2); x.stroke();
    x.restore();
    return {bx:ax-r,by:ay-r,bw:r*2,bh:r*2};
  }

  // Gallery Spotlight (Museum Gallery's one shipped Decoration Layer,
  // Slide-targeted) reuses the exact same radial-glow primitive the
  // Holder-scope 'gallery'/'soft' lighting already draws (_lightingGlow
  // above) — just aimed at the whole Slide rect instead of the picture
  // rect, so there's no second glow implementation to keep in sync.
  // Sprint 9.7 — two more kinds from the Design Board's Decoration
  // Layer catalog, each reusing an existing texture/vignette primitive
  // rather than a bespoke drawing routine: 'paperTexture' (the same
  // mottled paper wash Holder-scope paper textures already use) and
  // 'shadowWash' (a soft vignette at the Slide's edges).
  // Builder Convergence — a converged Scene Layer's `decoration.kind`
  // can be 'fill' (a solid-colour rect, the mirrored form of a Scene's
  // Background/Colour content) or 'image' (a real uploaded/Experience
  // image, the mirrored form of a Scene's Image/Graphics content).
  // Both draw against `layerRect` (the layer's own free-form Scene
  // position) when present, else the target rect — same fallback
  // discipline as everywhere else in this convergence.
  function _layerDrawDecoration(layer,anchor,rect,s,layerRect){
    // Creator Acceptance Sprint (Museum Gallery trace) — docs/THEME_PROJECT_SPEC.md
    // §7's own contract: "position [is] only meaningful on the
    // declarative handle / page-number ids" — an entry with no
    // `decoration` payload AND a `position` field exists purely to carry
    // that position override for a pre-existing engine feature
    // (_drawHandle/_drawPageNumber, fed via _layerPosition elsewhere in
    // render()), never a second, competing renderer for the same
    // content. Without this guard, Museum Gallery's own `handle` entry
    // (type:'decoration', no `decoration` payload, `position` set)
    // silently fell through to the kind==='spotlight' default below,
    // painting an unintended glow AND appearing as a nonsensical
    // "Handle" card in the Object Strip. `gallery-spotlight` (no
    // `decoration` payload either, but no `position` field) is
    // unaffected — its default-to-spotlight glow is real, intentional
    // content, exactly as authored.
    if(!layer.decoration && layer.position) return null;
    const d=layer.decoration||{};
    const kind=d.kind||'spotlight';
    const ov=_layerOverride(s,layer.id);
    let r=layerRect||rect;
    // baseR — r's value BEFORE any Story-Author override below ever
    // mutates it (both blocks below reassign r to a new object rather
    // than mutating in place, so this reference never changes). Used by
    // spotlight's own dx/dy shift: its glow "hotspot" is anchor-based,
    // not r-based, so it needs the delta r moved by, not r itself.
    const baseR=r;
    // Guardrails — a moveable:true Layer's Story-Author SIZE override
    // (SceneEngine.setSize, the same generic override bag position
    // already uses — js/app.js's resize-drag handler writes both size
    // and position together on every resize gesture) is applied first,
    // recentred around r's own current center, so the position override
    // immediately below still lands the final center exactly where the
    // Story Author dragged it to, regardless of order. Absent a size
    // override, r is unchanged — byte-identical to before this fix for
    // every existing theme.
    if(ov && ov.size && typeof ov.size.w==='number' && typeof ov.size.h==='number'){
      const scx=r.x+r.w/2, scy=r.y+r.h/2;
      r={x:scx-ov.size.w/2,y:scy-ov.size.h/2,w:ov.size.w,h:ov.size.h};
    }
    // Honour World-Owned Object Commitments sprint — fill/image/shape
    // all position themselves purely from `r` (never anchor.x/y), so a
    // moveable:true override is a straightforward translation of `r`
    // itself, correct regardless of the decoration's own kind. Absent
    // an override, `r` is unchanged — byte-identical to before this
    // sprint for every existing theme.
    //
    // Guardrails fix — spotlight/paperTexture/shadowWash used to be
    // excluded here ("have no realistic 'move' concept") and drew
    // against the raw, un-overridden `rect` regardless of any position/
    // size a Story Author had dragged — a real, confirmed bug: a
    // moveable:true legacy decoration silently never moved or resized.
    // Now generalized: paperTexture/shadowWash draw against `r` exactly
    // like fill/image/shape (their whole visual — blob positions,
    // gradient center, fill bounds — is defined purely relative to
    // whichever rect they're handed, so this is a safe, direct swap);
    // spotlight keeps its glow radius/fill bounds tied to `r` too, and
    // shifts its own anchor-based hotspot by the exact delta `r` moved
    // by (dx/dy below), since its resting position is deliberately an
    // authored anchor point (e.g. Museum Gallery's top-center), not r's
    // own center — recentering on r's center outright would silently
    // relocate every existing theme's unmoved glow. When no override
    // exists at all, r===rect===baseR and dx/dy are 0 — byte-identical
    // to the pre-fix rendering for every theme that never gets moved.
    if(ov && ov.position){
      const cx=r.x+r.w/2, cy=r.y+r.h/2;
      r={x:r.x+(ov.position.x-cx),y:r.y+(ov.position.y-cy),w:r.w,h:r.h};
    }
    const dx=r.x-baseR.x, dy=r.y-baseR.y;
    if(kind==='spotlight'){
      const radius=(typeof d.radius==='number')?d.radius:Math.max(r.w,r.h)*0.6;
      const alpha=(typeof d.alpha==='number')?d.alpha:0.12;
      _lightingGlow(r,anchor.x+dx,anchor.y+dy,radius,alpha);
    }else if(kind==='paperTexture'){
      _paperMottled(r,(typeof d.alpha==='number')?d.alpha:0.5);
    }else if(kind==='shadowWash'){
      x.save();
      const grad=x.createRadialGradient(r.x+r.w/2,r.y+r.h/2,Math.min(r.w,r.h)*0.3,r.x+r.w/2,r.y+r.h/2,Math.max(r.w,r.h)*0.7);
      grad.addColorStop(0,'rgba(0,0,0,0)');
      grad.addColorStop(1,'rgba(0,0,0,'+((typeof d.alpha==='number')?d.alpha:0.18).toFixed(3)+')');
      x.fillStyle=grad;
      x.fillRect(r.x,r.y,r.w,r.h);
      x.restore();
    }else if(kind==='fill'){
      x.save();
      x.globalAlpha=(typeof d.alpha==='number')?Math.max(0,Math.min(1,d.alpha)):1;
      x.fillStyle=(ov && ov.fillColor)||d.color||'rgba(0,0,0,0.08)';
      x.fillRect(r.x,r.y,r.w,r.h);
      x.restore();
    }else if(kind==='image'){
      _layerDrawDecorationImage(d,r,s,ov);
    }else if(kind==='shape'){
      // Same Guardrails fix as the image branch above — a Story-Author
      // fillColor and/or rotation override wins over the Theme-Author's
      // own compiled base. Only builds a merged copy when an override
      // genuinely exists, so `d` is passed through untouched (and this
      // is byte-identical to before) for every theme with neither.
      const _ovFill=(ov && ov.fillColor);
      const _ovRot=(ov && typeof ov.rotation==='number');
      let _sd=d;
      if(_ovFill || _ovRot){
        _sd=Object.assign({},d);
        if(_ovFill) _sd.fillColor=ov.fillColor;
        if(_ovRot) _sd.rotation=ov.rotation;
      }
      _layerDrawShape(_sd,r);
    }
    return {bx:r.x,by:r.y,bw:r.w,bh:r.h};
  }

  // Letter/Number shapes — "alphabets, numbers should also be part of
  // shapes... your second interpretation is correct. the literal one.":
  // a standalone, pickable Shape kind per A-Z/0-9 (SHAPE_KINDS), drawn as
  // real, colourable/outlinable/rotatable glyph text rather than a
  // hand-plotted vector path (36 hand-authored outlines would be
  // impractical and lower quality than the browser's own font
  // rendering) — mirrored by hand into engineRuntime.js's own
  // _drawLetterShape for Builder's Working View/Runtime Preview.
  function _shapeLetterChar(kind){
    if(typeof kind!=='string') return null;
    if(kind.indexOf('letter-')===0) return kind.slice(7);
    if(kind.indexOf('number-')===0) return kind.slice(7);
    return null;
  }
  // Shared by _drawLetterShape (Solid) and _drawLetterShapePaint (Paint
  // Inside) so the two modes' auto-fit sizing can never drift apart —
  // mutates ctx.font/.textAlign/.textBaseline as a side effect (both
  // callers need them set before they measure/draw, exactly as the
  // original inline version already did) and returns the resolved font
  // size in px. Auto-fit: start near the full rect height, shrink
  // proportionally only if the glyph's own measured width would overflow
  // the rect — most letters/numbers are taller than wide, so height is
  // the natural starting constraint and width is the one that ever needs
  // correcting.
  function _letterFont(ctx,ch,rect){
    let fontSize=rect.h*0.82;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font='bold '+fontSize+'px sans-serif';
    const maxW=rect.w*0.86;
    const measured=ctx.measureText(ch).width;
    if(measured>maxW && measured>0){
      fontSize=fontSize*(maxW/measured);
      ctx.font='bold '+fontSize+'px sans-serif';
    }
    return fontSize;
  }
  function _drawLetterShape(ctx,ch,rect,cx,cy,d){
    _letterFont(ctx,ch,rect);
    const baseAlpha=ctx.globalAlpha;
    const fillA=(typeof d.fillOpacity==='number')?Math.max(0,Math.min(1,d.fillOpacity)):1;
    const strokeA=(typeof d.strokeOpacity==='number')?Math.max(0,Math.min(1,d.strokeOpacity)):1;
    // fillEnabled — the same "Outline Only" gate every other Shape kind
    // already honours (undefined!==false keeps every pre-existing caller
    // byte-identical).
    if(d.fillEnabled!==false){
      ctx.fillStyle=d.fillColor||'#F0B429';
      ctx.globalAlpha=baseAlpha*fillA;
      ctx.fillText(ch,cx,cy);
    }
    if(d.strokeWidth>0){
      ctx.lineWidth=d.strokeWidth;
      ctx.strokeStyle=d.strokeColor||'#24406B';
      ctx.globalAlpha=baseAlpha*strokeA;
      ctx.strokeText(ch,cx,cy);
    }
  }
  // Letter/Number Paint Inside — fillText/strokeText produce no plottable
  // path to clip Doodle's own strokes against (unlike every other Shape
  // kind, see _paintShapePathTail's own doc comment), so this mirrors the
  // established offscreen-canvas-plus-compositing technique
  // _buildRecoloredStickerCanvas already uses for "Colour This": a `mask`
  // canvas holds the glyph's own opaque silhouette (drawn once, directly,
  // in device-pixel space); a `paint` canvas holds the real, live-drawn
  // strokes (via the reused _drawDoodleStrokes, which always computes
  // absolute design-space coordinates against the same rect every other
  // caller passes it, and operates on the module-level shared context (x)
  // by design — retargeted here for the duration of the draw, then
  // restored, mirroring the swap-then-restore discipline already
  // established for ThumbnailEngine/PublishStudio's own temp-canvas
  // rendering elsewhere in this file); destination-in then composites the
  // two so only the ink inside the glyph survives. Outline (strokeText)
  // stays unconditional and unclipped, drawn straight onto the real ctx,
  // exactly like Solid mode already does — Paint Inside never touches it.
  function _drawLetterShapePaint(ctx,ch,rect,cx,cy,d){
    const fontSize=_letterFont(ctx,ch,rect);
    const baseAlpha=ctx.globalAlpha;
    const fillA=(typeof d.fillOpacity==='number')?Math.max(0,Math.min(1,d.fillOpacity)):1;
    const strokeA=(typeof d.strokeOpacity==='number')?Math.max(0,Math.min(1,d.strokeOpacity)):1;
    if(Array.isArray(d.paintStrokes) && d.paintStrokes.length){
      const pad=Math.max(rect.w,rect.h)*0.08;
      const bx=rect.x-pad, by=rect.y-pad, bw=rect.w+pad*2, bh=rect.h+pad*2;
      const scale=2; // a modest supersample for quality, matching the
                      // spirit of RECOLOR_SIZE's own fixed-resolution boost
      const cw=Math.max(1,Math.round(bw*scale)), ch2=Math.max(1,Math.round(bh*scale));

      const mask=document.createElement('canvas');
      mask.width=cw; mask.height=ch2;
      const mctx=mask.getContext('2d');
      mctx.textAlign='center'; mctx.textBaseline='middle';
      mctx.font='bold '+(fontSize*scale)+'px sans-serif';
      mctx.fillStyle='#000';
      mctx.fillText(ch,(cx-bx)*scale,(cy-by)*scale);

      const paint=document.createElement('canvas');
      paint.width=cw; paint.height=ch2;
      const savedC=c, savedX=x;
      c=paint; x=paint.getContext('2d');
      // Maps this canvas's design-space bounding box (bx,by,bw,bh) onto
      // its own device-pixel box (0,0,cw,ch2) — _drawDoodleStrokes'
      // absolute-coordinate draw calls land correctly with zero changes
      // to its own math.
      x.setTransform(scale,0,0,scale,-bx*scale,-by*scale);
      _drawDoodleStrokes(d.paintStrokes,rect,fillA);
      c=savedC; x=savedX;

      // Clip the painted strokes to exactly the glyph's own ink.
      // setTransform(identity) first — the composite below must be a raw,
      // 1:1 device-pixel copy, not re-transformed a second time by the
      // scale/translate the strokes were just drawn through.
      const pctx=paint.getContext('2d');
      pctx.setTransform(1,0,0,1,0,0);
      pctx.globalCompositeOperation='destination-in';
      pctx.drawImage(mask,0,0);

      // ctx.globalAlpha is still baseAlpha here (untouched since function
      // entry) — fillA is already baked into the strokes above, so this
      // applies the shape's own overall alpha exactly once, matching the
      // Solid-fill path's identical baseAlpha*fillA total.
      ctx.drawImage(paint,bx,by,bw,bh);
    }
    if(d.strokeWidth>0){
      ctx.lineWidth=d.strokeWidth;
      ctx.strokeStyle=d.strokeColor||'#24406B';
      ctx.globalAlpha=baseAlpha*strokeA;
      ctx.strokeText(ch,cx,cy);
    }
  }

  // A regular N-sided polygon inscribed in the same rx/ry ellipse
  // 'circle' already uses, point-up (matching 'star''s own starting
  // angle) — mirrors engineRuntime.js's own _regularPolygonPath. Builds
  // onto a caller-supplied Path2D (never the module-level x context's
  // own mutable "current path" directly) so a shape's own outline
  // geometry survives whole even after other, unrelated canvas drawing
  // happens in between it being built and it finally being
  // fill()/clip()/stroke()-ed — see _paintShapePathTail below.
  function _regularPolygonPathFor(path,cx,cy,rx,ry,sides){
    const start=-Math.PI/2;
    const step=(Math.PI*2)/sides;
    path.moveTo(cx+Math.cos(start)*rx,cy+Math.sin(start)*ry);
    for(let i=1;i<sides;i++){
      const a=start+step*i;
      path.lineTo(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry);
    }
    path.closePath();
  }

  // The shared fill/outline tail for every plotted-path Shape (every
  // kind except letter/number, which paints via fillText/strokeText —
  // see _drawLetterShape/_drawLetterShapePaint — and has no plottable
  // path for this function to work with at all).
  //
  // "Solid Fill" (the default, style.fillMode!=='paint') is the
  // original, unchanged flat fill(path) behaviour — a Shape sticker/
  // Layer authored before Paint Inside existed renders byte-identically
  // forever, since fillMode is always undefined for it.
  //
  // "Paint Inside" (style.fillMode==='paint') reuses Doodle's own
  // multi-stroke/multi-colour/medium renderer (_drawDoodleStrokes,
  // which itself calls _drawDoodleStrokeOnCtx per stroke) directly —
  // zero duplicated per-medium drawing logic — clipped to this shape's
  // own real silhouette via the Path2D built by the caller (never a
  // faked bounding-box clip). No strokes yet drawn (an empty/absent
  // paintStrokes array) means nothing is filled at all, matching
  // Doodle's own "blank until you draw" convention exactly. fillEnabled
  // (the Solid Fill "Outline Only" toggle) has no bearing on Paint
  // Inside — the two fill mechanisms are independent, and a leftover
  // fillEnabled:false from a prior Solid Fill session must never
  // silently suppress a Paint Inside shape's own strokes.
  //
  // The outline (stroke(path)) is unconditional in both modes —
  // Outline stays a separate, always-available control regardless of
  // which fill mode is active, per the shipped product decision.
  function _paintShapePathTail(path,rect,style){
    const baseAlpha=x.globalAlpha;
    const fillA=(typeof style.fillOpacity==='number')?Math.max(0,Math.min(1,style.fillOpacity)):1;
    const strokeA=(typeof style.strokeOpacity==='number')?Math.max(0,Math.min(1,style.strokeOpacity)):1;
    if(style.fillMode==='paint'){
      if(Array.isArray(style.paintStrokes) && style.paintStrokes.length){
        x.save();
        x.clip(path);
        _drawDoodleStrokes(style.paintStrokes,rect,baseAlpha*fillA);
        x.restore();
      }
    }else if(style.fillEnabled!==false){
      // fillEnabled — "give option for just outline shape of colored
      // shape." Optional, defaults to true (undefined!==false) so every
      // caller that predates this stays byte-identical — only a Story
      // Author's explicit "Outline Only" toggle ever sets it false.
      x.fillStyle=style.fillColor||'#F0B429';
      x.globalAlpha=baseAlpha*fillA;
      x.fill(path);
    }
    if(style.strokeWidth>0){
      x.lineWidth=style.strokeWidth;
      x.strokeStyle=style.strokeColor||'#24406B';
      x.globalAlpha=baseAlpha*strokeA;
      x.stroke(path);
    }
  }

  // A converged Shape decoration (Builder V3.1 Graphics section — real
  // vector fill+outline, not a fixed-colour glyph). Mirrors
  // tools/world-builder-v2/js/services/engineRuntime.js's own
  // _drawShape path/geometry and fill/strokeOpacity handling exactly
  // (same SHAPE_KINDS) so a Shape renders identically in Builder's own
  // preview and here in the real Reader-facing Runtime — two files by
  // necessity (this renderer has no dependency on Builder's own
  // module), kept in lockstep by hand.
  function _layerDrawShape(d,rect){
    const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
    const rx=rect.w/2, ry=rect.h/2;
    x.save();
    x.globalAlpha=(typeof d.alpha==='number')?Math.max(0,Math.min(1,d.alpha)):1;
    const rotation=(typeof d.rotation==='number')?d.rotation:0;
    if(rotation){ x.translate(cx,cy); x.rotate(rotation*Math.PI/180); x.translate(-cx,-cy); }
    const kind=d.shape;
    const letterCh=_shapeLetterChar(kind);
    if(letterCh){
      // Letter/Number shapes piggyback on the rotation transform above
      // (already applied) but bypass the shared path-based fill()/
      // stroke() tail entirely — fillText/strokeText already implement
      // their own fill+stroke, matching a 'circle'/'star'/etc. shape's
      // visible result exactly, just via glyph text instead of a plotted
      // path. Paint Inside gets its own dedicated alpha-mask-composite
      // function (_drawLetterShapePaint) rather than sharing
      // _paintShapePathTail — see that function's own doc comment for why.
      if(d.fillMode==='paint'){
        _drawLetterShapePaint(x,letterCh,rect,cx,cy,d);
      }else{
        _drawLetterShape(x,letterCh,rect,cx,cy,d);
      }
      x.restore();
      return {bx:rect.x,by:rect.y,bw:rect.w,bh:rect.h};
    }
    // Built onto an independent Path2D — see _paintShapePathTail's own
    // doc comment for why this must never be built directly on x.
    const path=new Path2D();
    if(kind==='circle'){
      path.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
    }else if(kind==='rectangle'){
      path.rect(rect.x,rect.y,rect.w,rect.h);
    }else if(kind==='rounded-rectangle'){
      const r=Math.min(rect.w,rect.h)*0.2;
      path.moveTo(rect.x+r,rect.y);
      path.arcTo(rect.x+rect.w,rect.y,rect.x+rect.w,rect.y+rect.h,r);
      path.arcTo(rect.x+rect.w,rect.y+rect.h,rect.x,rect.y+rect.h,r);
      path.arcTo(rect.x,rect.y+rect.h,rect.x,rect.y,r);
      path.arcTo(rect.x,rect.y,rect.x+rect.w,rect.y,r);
      path.closePath();
    }else if(kind==='custom'){
      // A creator-drawn shape. Two representations coexist by design:
      //   (1) d.customStrokes — the newer multi-stroke Line/Circle Tool
      //     silhouette (Sprint "Shapes 'Draw Your Own' — Multi-Stroke
      //     Line/Circle Tool + Fill Shape Toggle"), an array of
      //     {type:'line'|'circle', p0, p1} entries in 0..1 fractional
      //     coordinates. Checked FIRST — mirrors _drawSceneShape's own
      //     established convention for a Story-owned Shape sticker
      //     (line ~4422), so a Theme-Author-authored World-owned
      //     custom Shape composes identically to a Story-Author-
      //     authored freeform sticker rather than silently falling
      //     through to the plain single-freehand path or the ellipse
      //     placeholder underneath — closes BACKLOG.md's own reported
      //     Studio-vs-Builder rendering divergence (Frame Style /
      //     Paint-Inside Custom shapes were invisible in Studio).
      //   (2) d.customPath — the older single-freehand path (pre-Multi-
      //     Stroke sprint), an array of {x,y} points. Preserved
      //     unchanged for every legacy Custom shape authored before
      //     Multi-Stroke shipped.
      if(Array.isArray(d.customStrokes) && d.customStrokes.length){
        _buildCustomStrokePath(path,d.customStrokes,rect);
      }else if(Array.isArray(d.customPath) && d.customPath.length>=2){
        d.customPath.forEach(function(p,i){
          const px=rect.x+p.x*rect.w, py=rect.y+p.y*rect.h;
          if(i===0) path.moveTo(px,py); else path.lineTo(px,py);
        });
        path.closePath();
      }else{
        path.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
      }
    }else if(kind==='triangle'){
      _regularPolygonPathFor(path,cx,cy,rx,ry,3);
    }else if(kind==='diamond'){
      path.moveTo(cx,rect.y);
      path.lineTo(rect.x+rect.w,cy);
      path.lineTo(cx,rect.y+rect.h);
      path.lineTo(rect.x,cy);
      path.closePath();
    }else if(kind==='pentagon'){
      _regularPolygonPathFor(path,cx,cy,rx,ry,5);
    }else if(kind==='hexagon'){
      _regularPolygonPathFor(path,cx,cy,rx,ry,6);
    }else if(kind==='octagon'){
      _regularPolygonPathFor(path,cx,cy,rx,ry,8);
    }else if(kind==='star'){
      const spikes=5, outerRx=rx, outerRy=ry, innerRx=rx*0.42, innerRy=ry*0.42;
      let rot=-Math.PI/2;
      const step=Math.PI/spikes;
      path.moveTo(cx+Math.cos(rot)*outerRx,cy+Math.sin(rot)*outerRy);
      for(let i=0;i<spikes;i++){
        rot+=step;
        path.lineTo(cx+Math.cos(rot)*innerRx,cy+Math.sin(rot)*innerRy);
        rot+=step;
        path.lineTo(cx+Math.cos(rot)*outerRx,cy+Math.sin(rot)*outerRy);
      }
      path.closePath();
    }else if(kind==='cross'){
      const tw=rect.w*0.34, th=rect.h*0.34;
      const x0=rect.x, y0=rect.y, w=rect.w, h=rect.h;
      const cx1=x0+(w-tw)/2, cx2=x0+(w+tw)/2;
      const cy1=y0+(h-th)/2, cy2=y0+(h+th)/2;
      path.moveTo(cx1,y0); path.lineTo(cx2,y0); path.lineTo(cx2,cy1);
      path.lineTo(x0+w,cy1); path.lineTo(x0+w,cy2); path.lineTo(cx2,cy2);
      path.lineTo(cx2,y0+h); path.lineTo(cx1,y0+h); path.lineTo(cx1,cy2);
      path.lineTo(x0,cy2); path.lineTo(x0,cy1); path.lineTo(cx1,cy1);
      path.closePath();
    }else if(kind==='trapezoid'){
      path.moveTo(rect.x+rect.w*0.2,rect.y);
      path.lineTo(rect.x+rect.w*0.8,rect.y);
      path.lineTo(rect.x+rect.w,rect.y+rect.h);
      path.lineTo(rect.x,rect.y+rect.h);
      path.closePath();
    }else if(kind==='parallelogram'){
      const skew=rect.w*0.2;
      path.moveTo(rect.x+skew,rect.y);
      path.lineTo(rect.x+rect.w,rect.y);
      path.lineTo(rect.x+rect.w-skew,rect.y+rect.h);
      path.lineTo(rect.x,rect.y+rect.h);
      path.closePath();
    }else if(kind==='arrow'){
      const shaftTop=cy-ry*0.28, shaftBottom=cy+ry*0.28, headX=rect.x+rect.w*0.62;
      path.moveTo(rect.x,shaftTop);
      path.lineTo(headX,shaftTop);
      path.lineTo(headX,cy-ry*0.62);
      path.lineTo(rect.x+rect.w,cy);
      path.lineTo(headX,cy+ry*0.62);
      path.lineTo(headX,shaftBottom);
      path.lineTo(rect.x,shaftBottom);
      path.closePath();
    }else if(kind==='speech-bubble'){
      // Two subpaths in one fill()/stroke() — the rounded body (its own
      // moveTo..closePath, exactly _roundedRect's own arcTo chain) plus
      // the tail triangle, matching engineRuntime.js's own
      // _roundedRectPath-then-tail construction exactly.
      const r=Math.min(rect.w,rect.h)*0.18, bodyBottom=rect.y+rect.h*0.78, bh=bodyBottom-rect.y;
      path.moveTo(rect.x+r,rect.y);
      path.arcTo(rect.x+rect.w,rect.y,rect.x+rect.w,rect.y+bh,r);
      path.arcTo(rect.x+rect.w,rect.y+bh,rect.x,rect.y+bh,r);
      path.arcTo(rect.x,rect.y+bh,rect.x,rect.y,r);
      path.arcTo(rect.x,rect.y,rect.x+rect.w,rect.y,r);
      path.closePath();
      path.moveTo(rect.x+rect.w*0.22,bodyBottom);
      path.lineTo(rect.x+rect.w*0.12,rect.y+rect.h);
      path.lineTo(rect.x+rect.w*0.38,bodyBottom);
      path.closePath();
    }else if(kind==='banner'){
      const notch=rect.w*0.14;
      path.moveTo(rect.x,rect.y);
      path.lineTo(rect.x+rect.w,rect.y);
      path.lineTo(rect.x+rect.w-notch,cy);
      path.lineTo(rect.x+rect.w,rect.y+rect.h);
      path.lineTo(rect.x,rect.y+rect.h);
      path.lineTo(rect.x+notch,cy);
      path.closePath();
    }else{
      path.rect(rect.x,rect.y,rect.w,rect.h);
    }
    _paintShapePathTail(path,rect,d);
    x.restore();
  }

  // Multi-stroke "Draw Your Own" — direct product feedback that the
  // old single-freehand-path version ("just filling shape") should
  // become a genuine drawing tool: several independent strokes, each
  // either a straight Line or a Circle (not raw freehand tracing, which
  // Doodle already covers), composed into one shape that can render as
  // Outline Only or a filled Colour Shape. st.customStrokes is an array
  // of {type:'line'|'circle', p0:{x,y}, p1:{x,y}} — p0/p1 are 0..1
  // fractional within the shape's own w/h box. Consecutive Line strokes
  // whose endpoints touch chain into one continuous subpath (so drawing
  // 3-4 connected lines produces a real closed, fillable polygon);
  // a Circle stroke is always its own separate closed subpath (an
  // ellipse inscribed in the p0/p1 drag rectangle). Deliberately a
  // separate function from _layerDrawShape (kept untouched, still the
  // single-freehand-path path for any legacy customPath and for every
  // World-owned Layer Pack decoration) — reused identically by
  // _drawSceneShape and drawObjectThumbnail so Working canvas and
  // Object Strip can never disagree.
  // Builds onto a caller-supplied Path2D — see _paintShapePathTail's own
  // doc comment for why this must never be built directly on x.
  function _buildCustomStrokePath(path,strokes,rect){
    let lastEnd=null;
    (strokes||[]).forEach(function(s){
      if(!s||!s.p0||!s.p1) return;
      const x0=rect.x+s.p0.x*rect.w, y0=rect.y+s.p0.y*rect.h;
      const x1=rect.x+s.p1.x*rect.w, y1=rect.y+s.p1.y*rect.h;
      if(s.type==='circle'){
        const ccx=(x0+x1)/2, ccy=(y0+y1)/2;
        const crx=Math.max(Math.abs(x1-x0)/2,0.5), cry=Math.max(Math.abs(y1-y0)/2,0.5);
        path.moveTo(ccx+crx,ccy);
        path.ellipse(ccx,ccy,crx,cry,0,0,Math.PI*2);
        lastEnd=null;
      }else{
        const connects=lastEnd && Math.hypot(x0-lastEnd.x,y0-lastEnd.y)<6;
        if(!connects) path.moveTo(x0,y0);
        path.lineTo(x1,y1);
        lastEnd={x:x1,y:y1};
      }
    });
  }
  function _drawCustomStrokeShape(rect,strokes,style){
    style=style||{};
    const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
    x.save();
    x.globalAlpha=(typeof style.alpha==='number')?Math.max(0,Math.min(1,style.alpha)):1;
    const rotation=(typeof style.rotation==='number')?style.rotation:0;
    if(rotation){ x.translate(cx,cy); x.rotate(rotation*Math.PI/180); x.translate(-cx,-cy); }
    const path=new Path2D();
    _buildCustomStrokePath(path,strokes,rect);
    _paintShapePathTail(path,rect,style);
    x.restore();
  }

  // Same per-src Image cache + onload/redraw-nudge discipline
  // _ensureStickerImage already established (line ~1509) — a second,
  // parallel cache rather than reusing that one since sticker ids and
  // asset references are different keyspaces, but identical mechanics.
  // Platform Hardening — Draft Asset Architecture, Phase C. `src` may now
  // be a durable vihu-asset: reference (a Story-Author-replaced image via
  // SceneEngine.setContentOverride) rather than a directly-usable data:/
  // http(s) URL — a placeholder entry is cached under the ORIGINAL src key
  // immediately (so a second call for the same still-resolving src is a
  // cache hit, not a duplicate resolve), then swapped in place for the
  // real Image once AssetStore.resolve() settles, reusing the exact same
  // onload/redraw-nudge mechanics. A legacy data:/http(s) URL resolves
  // through the same call, same-tick, with zero behaviour change.
  //
  // Phase E — `fallbackOwnerId` (this module deliberately takes no
  // dependency on AppState directly, per its own established "operate
  // purely on the slide object passed in" discipline — the caller reads
  // it off `s.recallOwnerId`, stamped there by ProjectManager.deserialize()
  // only for a Magic-Card-recalled project) is threaded to
  // AssetStore.resolve() as its own opts.ownerId fallback, so a Story-
  // Author-replaced image left over from before a recall still resolves
  // on the recalling device. See AssetStore.resolve()'s own comment.
  const _decorationImgCache={};
  function _ensureDecorationImage(src,fallbackOwnerId){
    if(!src) return null;
    if(_decorationImgCache[src]) return _decorationImgCache[src];
    const placeholder={};
    _decorationImgCache[src]=placeholder;
    // Diagnostic-only addition — neither branch below previously logged
    // anything on failure, so a Decoration image that silently never
    // resolves (a broken/expired signed URL, a cross-owner Storage
    // access denial, AssetStore.resolve() coming back null) rendered as
    // nothing at all with zero signal anywhere an author or a future
    // debugger could see — confirmed the real, silent failure mode while
    // investigating a real report ("Paper BG" invisible on a World-Card-
    // redeemed Theme). This never changes what's drawn — a genuinely
    // still-loading image still resolves normally the instant it loads.
    const warn=function(reason){
      try{ console.warn('[Decoration Image] failed to load ("'+reason+'"): '+src); }catch(_){}
    };
    const start=function(resolvedSrc){
      if(!resolvedSrc){ warn('AssetStore.resolve() returned null'); return; }
      const img=new Image();
      // Same root cause as js/projectManager.js's loadImageFromDataURL —
      // `resolvedSrc` may be a genuinely cross-origin Supabase Storage
      // signed URL (AssetStore.resolve()'s own fallback tier), and
      // drawing it onto the canvas with no `crossOrigin` set silently
      // taints it, breaking a later toDataURL()/getImageData() call
      // elsewhere (ThumbnailEngine, Publish/Export) — the real,
      // confirmed cause of a "Studio center pane frozen" bug.
      img.crossOrigin='anonymous';
      img.onload=function(){
        img.__ready=true;
        if(typeof window!=='undefined' && typeof window.redrawPreview==='function'){
          try{ window.redrawPreview(); }catch(_){}
        }
      };
      img.onerror=function(){ warn('image failed to decode/load: '+resolvedSrc); };
      img.src=resolvedSrc;
      _decorationImgCache[src]=img;
    };
    if(typeof src==='string' && src.indexOf('vihu-asset:')===0 && typeof window!=='undefined' && window.AssetStore){
      window.AssetStore.resolve(src,fallbackOwnerId?{ownerId:fallbackOwnerId}:undefined).then(start);
    }else{
      start(src);
    }
    return _decorationImgCache[src];
  }
  function _layerDrawDecorationImage(d,rect,s,ov){
    // Honour World-Owned Object Commitments sprint — a Story-Author-
    // replaced image (editable:true) may be a durable vihu-asset:
    // reference now (Phase C) or a legacy embedded data: URI, either way
    // resolved by _ensureDecorationImage below — unlike the theme-
    // authored relative path, which resolves through ThemeRegistry
    // instead. Absent an override, behaviour is unchanged.
    let src=(ov && ov.image) || d.image;
    if(!src) return;
    if(!(ov && ov.image)){
      const theme=_layoutTheme(s);
      const themeId=theme && theme.id;
      if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
        try{ src=ThemeRegistry.resolveAssetRef(themeId,d.image)||d.image; }catch(e){}
      }
    }
    const img=_ensureDecorationImage(src,s&&s.recallOwnerId);
    if(!img || !img.__ready || !img.width || !img.height) return;
    // Fidelity fix — a Theme's own Fit dropdown for Image content has no
    // rotation control today (rotation is Shape/Graphics-only), but this
    // function's own sibling, _layerDrawShape, already applies rotation
    // generically, and tools/world-builder-v2's engineRuntime.js's own
    // _paintLayer applies layer.rotation to BOTH shape and image
    // decorations uniformly — this brought Studio's image renderer into
    // that same generic shape, so a compiled decoration.rotation (from
    // any current or future authoring path, including a hand-authored
    // Layer Pack) is honoured here exactly as it already is for shapes,
    // rather than being silently dropped. Absent d.rotation (every
    // existing theme today), this is a byte-identical no-op.
    //
    // Guardrails — "world own image when marked as movable by author
    // means not just repositioning but also rotation and resizable".
    // A Story-Author rotation override (SceneEngine.setRotation, written
    // by the quick-edit popup's own Rotation slider, gated on the same
    // moveable:true permission Move/Resize already use) takes precedence
    // over the Theme-Author's own compiled `d.rotation` base — the exact
    // tri-state ov-beats-compiled precedence every other overridable
    // field on this object already follows. Absent an override, this is
    // byte-identical to before for every existing theme.
    const fit=d.fit||'fit';
    x.save();
    x.globalAlpha=(typeof d.alpha==='number')?Math.max(0,Math.min(1,d.alpha)):1;
    const rotation=(ov && typeof ov.rotation==='number')
      ? ov.rotation
      : ((typeof d.rotation==='number')?d.rotation:0);
    if(rotation){
      const rcx=rect.x+rect.w/2, rcy=rect.y+rect.h/2;
      x.translate(rcx,rcy); x.rotate(rotation*Math.PI/180); x.translate(-rcx,-rcy);
    }
    x.beginPath(); x.rect(rect.x,rect.y,rect.w,rect.h); x.clip();
    // 'stretch' -- a real, user-requested addition (World Builder's own
    // Image Experience Fit dropdown, kept in lockstep with
    // engineRuntime.js's _drawImageWithFit) -- scales both axes
    // independently to exactly match rect, so a compiled Theme's
    // Decoration image renders identically here whether authored as
    // fit/fill/original/stretch.
    if(fit==='stretch'){
      x.drawImage(img,rect.x,rect.y,rect.w,rect.h);
      x.restore();
      return;
    }
    const iw=img.width, ih=img.height;
    const base=fit==='fit' ? Math.min(rect.w/iw,rect.h/ih) : Math.max(rect.w/iw,rect.h/ih);
    const dw=iw*base, dh=ih*base;
    const dx=rect.x+rect.w/2-dw/2, dy=rect.y+rect.h/2-dh/2;
    x.drawImage(img,dx,dy,dw,dh);
    x.restore();
  }

  // Scene Object — the one uniform interface every rendered, discoverable
  // object on the page exposes, regardless of whether it originated as a
  // Cover/Hook/End blueprint element, a Story-Author-placed sticker, or a
  // theme-authored Layer Pack entry (Creator Reconciliation Sprint).
  // Object Strip / hit-testing / Context Panel all read this one shape —
  // {id,type,label,bx,by,bw,bh,visible,owner,moveable,editable,locked} —
  // and never branch on where an object came from. `owner` is 'world'
  // (theme/Builder-authored — Layer Pack) or 'story' (blueprint elements,
  // stickers — today's actual Sprint 8.3 Universal Object Consistency
  // behaviour, now named explicitly instead of re-derived from `locked`
  // at each call site). `moveable`/`editable` default to `!locked` when
  // not supplied — i.e. exactly today's behaviour for every object type
  // this function didn't get real Builder-authored values for.
  function _sceneObject(raw,owner){
    const locked=!!raw.locked;
    return Object.assign({},raw,{
      owner:owner||'story',
      moveable:(typeof raw.moveable==='boolean')?raw.moveable:!locked,
      editable:(typeof raw.editable==='boolean')?raw.editable:!locked
    });
  }

  // Honour World-Owned Object Commitments sprint — a Story Author's
  // in-place edit (position/fillColor/content/image) on a World-owned
  // Layer Pack object. Reuses the exact same per-id override bag
  // js/sceneEngine.js's elementOverrides already is (setPosition et al.
  // already write/read it generically, keyed by any string id) rather
  // than inventing a second bag: a Layer Pack id (Builder-generated,
  // e.g. 'scene-single-holder-decoration') never collides with a
  // SceneEngine blueprint's own fixed element ids, and
  // SceneEngine.getRenderData() only ever reads keys present in the
  // current page's own blueprint, so it simply never looks at a Layer
  // Pack id's entry even though it lives in the same object. Absent an
  // override (every page today), this always resolves null — zero
  // behaviour change for any existing theme.
  function _layerOverride(s,layerId){
    return (s && s.metadata && s.metadata.elementOverrides && s.metadata.elementOverrides[layerId]) || null;
  }

  // Guardrails — a moveable Artwork Place's grab-handle drag writes a
  // new absolute canvas-pixel center position into the exact same
  // generic override bag every other draggable object already uses
  // (js/sceneEngine.js's setPosition/elementOverrides), keyed by the
  // Place's own selection id. This reads it back and shifts the
  // Theme-Author-authored rect so its own center matches — a pure,
  // additive translation on top of whatever Builder authored, exactly
  // mirroring how a World-owned Layer Pack object's own moveable support
  // already works (_layerOverride). Absent an override (every Place
  // today, and any non-moveable Place forever), this is a no-op —
  // byte-identical to before this feature.
  function _applyPlaceMoveOverride(rect,s,placeId){
    const ov=_layerOverride(s,placeId);
    if(!ov || !ov.position || typeof ov.position.x!=='number' || typeof ov.position.y!=='number') return rect;
    const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
    const dx=ov.position.x-cx, dy=ov.position.y-cy;
    return {x:rect.x+dx, y:rect.y+dy, w:rect.w, h:rect.h};
  }

  // Guardrails — a resizable Artwork Place's resize-handle drag writes a
  // new absolute canvas-pixel {w,h} into the exact same generic override
  // bag (js/sceneEngine.js's setSize/elementOverrides) every other
  // resizable object already uses. Resizes about the AUTHORED rect's own
  // pre-move center — this must run BEFORE _applyPlaceMoveOverride at
  // every call site, since the real drag-resize gesture (js/app.js's
  // generic resize-drag handler) always writes an absolute FINAL center
  // into the position override that already accounts for whichever corner
  // stayed fixed during the drag; applying the move override last,
  // unconditionally forcing that exact center, is correct regardless of
  // what size change preceded it. Absent an override (every Place today,
  // and any non-resizable Place forever), this is a no-op — byte-
  // identical to before this feature.
  function _applyPlaceSizeOverride(rect,s,placeId){
    const ov=_layerOverride(s,placeId);
    if(!ov || !ov.size || typeof ov.size.w!=='number' || typeof ov.size.h!=='number') return rect;
    const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
    const w=Math.max(1,ov.size.w), h=Math.max(1,ov.size.h);
    return {x:cx-w/2, y:cy-h/2, w:w, h:h};
  }

  // A normalized, kind-specific description of what a World-owned
  // object actually IS, for the Object Strip to render an accurate
  // thumbnail from (colour swatch / real image / real shape / real
  // glyph / real text snippet) instead of one generic icon per type.
  // Reflects any live Story-Author override so an edited object's
  // thumbnail stays in sync with what's actually drawn. Returns null
  // for kinds with no meaningful single-object preview (Theme-effect
  // layers like spotlight/paperTexture/shadowWash, or a composed
  // multi-field museumCaption).
  function _layerVisual(layer,type,s,ov){
    if(type==='decoration'){
      const d=layer.decoration||{};
      const kind=d.kind;
      if(kind==='fill') return {kind:'color',color:(ov&&ov.fillColor)||d.color||'rgba(0,0,0,0.08)'};
      if(kind==='image'){
        if(ov&&ov.image) return {kind:'image',src:ov.image};
        let src=d.image;
        const theme=_layoutTheme(s);
        const themeId=theme&&theme.id;
        if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
          try{ src=ThemeRegistry.resolveAssetRef(themeId,d.image)||d.image; }catch(e){}
        }
        return {kind:'image',src:src};
      }
      if(kind==='shape') return {kind:'shape',shape:d.shape,fillColor:(ov&&ov.fillColor)||d.fillColor,strokeColor:d.strokeColor,strokeWidth:d.strokeWidth,rotation:d.rotation,customPath:d.customPath};
      return null;
    }
    if(type==='sticker'){
      const st=layer.sticker||{};
      const glyph=st.glyph||LAYER_STICKER_GLYPH[layer.id];
      if(glyph) return {kind:'glyph',glyph:glyph};
      // "The Grid" audit — this branch never read ov.fillColor, unlike
      // decoration's own 'fill' kind right above it, so a colour-
      // fallback sticker's edit popup always reopened showing the
      // ORIGINAL authored colour rather than whatever the Story Author
      // last picked, and the Object Strip thumbnail swatch never
      // reflected an edit either — even once _layerDrawSticker's own
      // matching read (above) made the actual canvas paint correctly.
      return {kind:'color',color:(ov&&ov.fillColor)||st.color||'#7A1F2B'};
    }
    if(type==='text'){
      const t=layer.text||{};
      if(t.source==='museumCaption') return null;
      let content=t.content||'';
      if(t.source==='slideCaption') content=(s&&s.metadata&&typeof s.metadata.caption==='string'&&s.metadata.caption)||content;
      if(ov&&typeof ov.content==='string') content=ov.content;
      if(!content) return null;
      // `content` is the full, untruncated string (an editable-object
      // control needs the real value to edit); `snippet` is the
      // truncated display form the Object Strip card actually shows.
      return {kind:'text',content:content,snippet:content.length>40?content.slice(0,40)+'…':content};
    }
    return null;
  }

  // Wraps a drawn Layer Pack entry's returned bbox into the same shape
  // _sceneBbox()/_stickerBbox() already produce, so it flows through the
  // existing Object Strip + canvas hit-test + selection-outline pipeline
  // with no changes needed there beyond consuming _lastSceneElements.
  function _pushLayerObject(layer,type,box,s,target){
    if(!box) return;
    // Creator Reconciliation Sprint — moveable/editable come straight off
    // the compiled Layer Pack entry (tools/world-builder-v2's
    // convergeSceneLayer mirrors these from Builder's own
    // layer.permissions, the exact pattern `visible` already used). A
    // hand-authored legacy Layer Pack entry (Museum Gallery, or anything
    // authored before this sprint) simply has neither key, so
    // `!!undefined` resolves to `false` for moveable/editable.
    // Honour World-Owned Object Commitments sprint — `locked` (the one
    // field js/app.js's existing drag machinery actually checks) now
    // follows the real authored `moveable` value instead of being
    // hardcoded true, so a moveable:true object engages the exact same
    // mousedown/mousemove/mouseup chain Cover/Hook/End elements already
    // use. Absent `moveable` (every legacy Layer Pack entry), this stays
    // locked exactly as before.
    const ov=_layerOverride(s,layer.id);
    _layerObjectBboxes.push(_sceneObject({
      id:layer.id, type:type, label:layer.label||_humanizeLayerId(layer.id),
      bx:box.bx, by:box.by, bw:box.bw, bh:box.bh,
      visible:layer.visible!==false, locked:!layer.moveable,
      moveable:!!layer.moveable, editable:!!layer.editable,
      decorationSlot:!!layer.decorationSlot,
      visual:_layerVisual(layer,type,s,ov),
      // A real, user-reported bug: every Layer Pack object, regardless of
      // which of the 5 containership scopes it targets, used to be
      // concatenated onto the very END of _lastSceneElements (see the
      // single `.concat()` below) -- app.js's _hitTestSceneElement reads
      // that array topmost-first (last element wins), so a 'slide'-scoped
      // World object (drawn FIRST, visually BEHIND every Scene element and
      // Story-Author sticker) was nonetheless always hit-tested as if it
      // sat on TOP of them, silently stealing clicks/drags meant for a
      // sticker the Story Author placed and can plainly see is on top.
      // Recording which scope this entry actually targeted lets the
      // concatenation step below restore the real visual order instead.
      target:target
    },'world'));
  }

  function _layerHelpers(rect,s,target){
    return {
      drawText:function(layer,anchor,r,layerRect){ _pushLayerObject(layer,'text',_layerDrawText(layer,anchor,layerRect||rect,s),s,target); },
      drawSticker:function(layer,anchor){ _pushLayerObject(layer,'sticker',_layerDrawSticker(layer,anchor,s),s,target); },
      drawDecoration:function(layer,anchor,r,layerRect){ _pushLayerObject(layer,'decoration',_layerDrawDecoration(layer,anchor,rect,s,layerRect),s,target); }
    };
  }
  function _renderLayers(pack,target,rect,s){
    if(!pack || typeof LayerEngine==='undefined') return;
    LayerEngine.render(pack,target,rect,_layerHelpers(rect,s,target));
  }
  // Unified Layer Ordering follow-up — a real World built almost
  // entirely from moveable World-owned Decoration Shapes reported that
  // NOTHING was truly reorderable: two Shapes landed in two different
  // bucket ('slide' vs 'overlay', decided by the unrelated Hosted-by-
  // Scene/full-bleed heuristic, not by anything the Theme Author would
  // recognize as a meaningful boundary), and neither could move relative
  // to the Sticker either — every complaint (Card Designer's Order
  // buttons doing nothing, Object Strip drag doing nothing, one Shape
  // moving on canvas but not the other) traced to this one root cause.
  // Draws ONE Layer Pack entry (reused by the merged, fully-interleaved
  // no-Frame-pipeline path in render() below) via the exact same helpers
  // `_renderLayers` uses for its bulk pass — never a second draw
  // implementation.
  function _renderOneLayer(layer,rect,s,target){
    if(typeof LayerEngine==='undefined' || typeof LayerEngine.renderOne!=='function') return;
    LayerEngine.renderOne(layer,rect,_layerHelpers(rect,s,target));
  }

  // "Extend Experiences to Places" — a Layer whose Theme Author Hosted
  // By a specific Place (any Experience type — decoration/text,
  // mirroring exactly how Scene/Free hosting already work) compiles to
  // one or more target:'place' Layer Pack entries, each carrying the
  // exact Place id it belongs to (tools/world-builder-v2's
  // convergeSceneLayer). Unlike the legacy 'frame'/'holder'/'element'
  // scopes (Place 1 only, by design, a standing pre-existing
  // limitation this does not lift), this new scope reaches every
  // Place, 1 and 2+ alike — called from both _drawPlaceOne and
  // _drawPlaceExtra below. Reuses LayerEngine.forTarget/renderOne, the
  // exact same filtering/drawing primitives every other Layer Pack
  // scope already uses — the only genuinely new step is filtering by
  // placeId, since LayerEngine itself has no concept of which Place a
  // 'place'-targeted layer belongs to (that's this function's own,
  // additive job, not a change to the generic engine).
  function _renderPlaceHostedLayers(pack,placeId,rect,s){
    if(!pack || !placeId || !rect || typeof LayerEngine==='undefined') return;
    LayerEngine.forTarget(pack,'place').forEach(function(layer){
      if(layer.placeId===placeId) _renderOneLayer(layer,rect,s,'place');
    });
  }

  // Holder rect — same insets/padding math _drawImage already applies
  // to the panel rect, exposed separately so Holder-targeted layers
  // (Museum Caption) can anchor to the actual picture content area
  // rather than the outer Frame.
  function _holderRectFor(panelRect,border){
    const insets=border?_getDesignInsets(border):{top:DEFAULT_IMG_PAD,right:DEFAULT_IMG_PAD,bottom:DEFAULT_IMG_PAD,left:DEFAULT_IMG_PAD};
    return {
      x:panelRect.x+insets.left, y:panelRect.y+insets.top,
      w:Math.max(1,panelRect.w-insets.left-insets.right),
      h:Math.max(1,panelRect.h-insets.top-insets.bottom)
    };
  }

  // Sprint 9.7 — Museum Gallery Fidelity: the 'right' composition
  // (Wide layout — "Image on left, text on right") puts the Museum
  // Caption in a column beside the Frame instead of below it. A middle
  // vertical band (not the full column height) keeps a two-line
  // caption reading as vertically centered against the Frame without
  // teaching the Layer Engine a new anchor.
  function _captionRectFor(panelRect,composition){
    if(composition!=='right') return null;
    const gap=40;
    const x0=panelRect.x+panelRect.w+gap;
    const w0=Math.max(80,(_viewportW-40)-x0);
    return {x:x0, y:panelRect.y+panelRect.h*0.32, w:w0, h:panelRect.h*0.36};
  }

  // Quote composition ("Minimal Quote" — no Frame/Holder at all, just
  // a centered quote). Basic word-wrap since Canvas text has none
  // built in; a quote with no text set renders nothing, leaving a
  // plain gallery wall rather than an empty box. Also reused, kept in
  // lockstep with engineRuntime.js's own _wrapLines, by _drawFreeformText
  // (Creator freeform Text stickers) and _layerDrawText (a published
  // Theme's compiled Text Experience/Layer Pack content) — every one of
  // this function's callers benefits together from splitting on '\n'
  // into paragraphs first, then word-wrapping each independently, so a
  // Theme Author's own manual Enter/newline survives as a real line
  // break instead of being silently absorbed by whitespace-collapsing
  // word-wrap. A blank paragraph (from '\n\n') pushes an empty line,
  // preserving intentional blank-line spacing. Text with no '\n' at all
  // (every pre-existing caller) is byte-identical to the original
  // single-paragraph algorithm.
  function _wrapText(text,maxWidth){
    const paragraphs=String(text).split('\n');
    const lines=[];
    paragraphs.forEach(function(paragraph){
      const words=paragraph.split(/\s+/).filter(Boolean);
      if(!words.length){ lines.push(''); return; }
      let line='';
      words.forEach(function(w){
        const trial=line?line+' '+w:w;
        if(x.measureText(trial).width>maxWidth && line){ lines.push(line); line=w; }
        else line=trial;
      });
      if(line) lines.push(line);
    });
    return lines;
  }

  // Shared by _layerDrawText (World-owned Layer Pack text) and
  // _drawFreeformText (Story-owned freeform text stickers) — computes
  // which vertical-alignment textBaseline a given wrapped line should use
  // and its own y coordinate, so both callers (and the new "Shapes" Fill
  // Style branch's own offscreen redraw pass, below) can never disagree
  // about where a line actually lands.
  function _textLineGeometry(i,lines,drawY,lineHeight,totalH,vAlign){
    if(vAlign==='top') return {lineY:drawY+i*lineHeight,baseline:'top'};
    if(vAlign==='bottom') return {lineY:drawY-(lines.length-1-i)*lineHeight,baseline:'bottom'};
    return {lineY:drawY-totalH/2+(i+0.5)*lineHeight,baseline:'middle'};
  }

  // Bug G — "For texts allow these curves." Draws one line of text
  // along an arc, character-by-character (each glyph translated to its
  // position on the arc, then rotated so its baseline is tangent to
  // the arc at that point). arcDeg is the total angular span the line
  // arcs across (0 = flat, caller handles that; positive = concave
  // down/smile arc; negative = concave up/frown arc). anchorX/anchorY
  // is where the LINE's own centerpoint (mid-baseline) sits — the
  // caller has already resolved this for its own align/vAlign. Requires
  // ctx.font/ctx.fillStyle to already be set. drawKind is 'fill' or
  // 'stroke'. Kept in lockstep, by hand, with tools/world-builder-v2/
  // js/services/engineRuntime.js's own mirrored copy. Never used for
  // decoration (underline/strikethrough) — a curved baseline would
  // need per-char stroke segments; disclosed as out of scope.
  function _drawCurvedTextLine(ctx,line,anchorX,anchorY,arcDeg,drawKind){
    if(!line || !arcDeg) return false;
    const arcRad=arcDeg*Math.PI/180;
    const totalW=ctx.measureText(line).width;
    if(totalW<=0) return false;
    const absArc=Math.abs(arcRad);
    const radius=totalW/absArc;
    const sign=arcRad>0?1:-1;
    const chars=Array.from(line);
    const savedAlign=ctx.textAlign;
    let cumW=0;
    for(let i=0;i<chars.length;i++){
      const ch=chars[i];
      const chW=ctx.measureText(ch).width;
      const angleFromCenter=((cumW+chW/2)-totalW/2)/radius;
      const posX=anchorX+radius*Math.sin(angleFromCenter);
      const posYOff=radius*(1-Math.cos(angleFromCenter));
      const posY=anchorY-sign*posYOff;
      const rot=sign*angleFromCenter;
      ctx.save();
      ctx.translate(posX,posY);
      ctx.rotate(rot);
      ctx.textAlign='center';
      if(drawKind==='stroke') ctx.strokeText(ch,0,0);
      else ctx.fillText(ch,0,0);
      ctx.restore();
      cumW+=chW;
    }
    ctx.textAlign=savedAlign;
    return true;
  }

  // Bug G Rework — Wave style, mirrored (by hand, no shared module) from
  // tools/world-builder-v2/js/services/engineRuntime.js's own
  // _drawWaveTextLine. amplitude = |amount|*0.3 in px, sign flips the
  // starting direction; period auto-derived from text width so 2-3
  // waves always show. Glyphs stay upright.
  function _drawWaveTextLine(ctx,line,anchorX,anchorY,amount,drawKind){
    if(!line || !amount) return false;
    const totalW=ctx.measureText(line).width;
    if(totalW<=0) return false;
    const amplitude=Math.abs(amount)*0.3;
    const sign=amount>=0?1:-1;
    const period=Math.max(60, totalW/2.5);
    const chars=Array.from(line);
    const savedAlign=ctx.textAlign;
    const startX=anchorX-totalW/2;
    let cumW=0;
    for(let i=0;i<chars.length;i++){
      const ch=chars[i];
      const chW=ctx.measureText(ch).width;
      const cx=startX+cumW+chW/2;
      const waveY=sign*Math.sin(((cx-startX)/period)*2*Math.PI)*amplitude;
      ctx.save();
      ctx.translate(cx, anchorY+waveY);
      ctx.textAlign='center';
      if(drawKind==='stroke') ctx.strokeText(ch,0,0);
      else ctx.fillText(ch,0,0);
      ctx.restore();
      cumW+=chW;
    }
    ctx.textAlign=savedAlign;
    return true;
  }

  // Bug G Rework — Circle style. Full 360° wrap, radius = textWidth/(2π).
  // Amount is deliberately unused (Amount slider disabled in the UI).
  // Text starts at 12 o'clock, reads clockwise; each glyph rotates
  // tangent, matching Arc's convention.
  function _drawCircleTextLine(ctx,line,anchorX,anchorY,drawKind){
    if(!line) return false;
    const totalW=ctx.measureText(line).width;
    if(totalW<=0) return false;
    const radius=totalW/(2*Math.PI);
    const chars=Array.from(line);
    const savedAlign=ctx.textAlign;
    let cumW=0;
    for(let i=0;i<chars.length;i++){
      const ch=chars[i];
      const chW=ctx.measureText(ch).width;
      const angle=((cumW+chW/2)/totalW)*2*Math.PI - Math.PI/2;
      const posX=anchorX+radius*Math.cos(angle);
      const posY=anchorY+radius+radius*Math.sin(angle);
      const rot=angle+Math.PI/2;
      ctx.save();
      ctx.translate(posX,posY);
      ctx.rotate(rot);
      ctx.textAlign='center';
      if(drawKind==='stroke') ctx.strokeText(ch,0,0);
      else ctx.fillText(ch,0,0);
      ctx.restore();
      cumW+=chW;
    }
    ctx.textAlign=savedAlign;
    return true;
  }

  // Bug G Rework — unified dispatcher. Backward compat: an older Layer
  // with `curve` set but no `curveStyle` is treated as 'arc'. Returns
  // true iff a styled line was drawn; false lets caller fall through.
  function _drawStyledTextLine(ctx,line,anchorX,anchorY,curveStyle,amount,drawKind){
    const effectiveStyle = curveStyle && curveStyle!=='none' ? curveStyle : (amount ? 'arc' : 'none');
    if(effectiveStyle==='arc') return _drawCurvedTextLine(ctx,line,anchorX,anchorY,amount,drawKind);
    if(effectiveStyle==='wave') return _drawWaveTextLine(ctx,line,anchorX,anchorY,amount,drawKind);
    if(effectiveStyle==='circle') return _drawCircleTextLine(ctx,line,anchorX,anchorY,drawKind);
    return false;
  }

  // Shared underline/strikethrough stroke — extracted so both Fill Style
  // branches (plain solid colour, and the new Shapes mosaic fill below)
  // draw the identical decoration geometry, just in a different colour
  // (the text's own fill colour for solid, a fixed neutral tone for
  // Shapes, since a mosaic fill has no single colour of its own to
  // reuse). Requires ctx.font to already be set to the line's real font
  // (measureText depends on it).
  function _drawTextLineDecoration(ctx,line,lineY,vAlign,hAlign,drawX,size,strokeColor,hasUnderline,hasStrikethrough){
    const lw=ctx.measureText(line).width;
    let lsx=drawX-lw/2, lex=drawX+lw/2;
    if(hAlign==='left'){ lsx=drawX; lex=drawX+lw; }
    else if(hAlign==='right'){ lsx=drawX-lw; lex=drawX; }
    let baselineY;
    if(vAlign==='top') baselineY=lineY+size*0.8;
    else if(vAlign==='bottom') baselineY=lineY-size*0.2;
    else baselineY=lineY+size*0.3;
    ctx.save();
    ctx.strokeStyle=strokeColor;
    ctx.lineWidth=Math.max(1,size*0.06);
    if(hasUnderline){ const uy=baselineY+size*0.08; ctx.beginPath(); ctx.moveTo(lsx,uy); ctx.lineTo(lex,uy); ctx.stroke(); }
    if(hasStrikethrough){ const sy=baselineY-size*0.3; ctx.beginPath(); ctx.moveTo(lsx,sy); ctx.lineTo(lex,sy); ctx.stroke(); }
    ctx.restore();
  }

  // "what do we call this kind of fonts" — a colorful, geometric-shape-
  // filled letter style ("stained-glass"/faceted lettering, e.g. the
  // "VIHAAN" reference image). Rendered as a real Fill Style option for
  // ANY text object, in ANY font, working automatically for the full
  // alphabet and every digit — never per-glyph authored art — via a
  // canvas glyph-as-clip-mask technique: render the real text once to
  // build a solid alpha mask, then use source-in compositing so a filled
  // geometric pattern only shows through where the glyphs actually are,
  // then stroke a white outline on top. Kept in lockstep, by hand, with
  // tools/world-builder-v2/js/services/engineRuntime.js's own mirrored
  // copy of this same technique — the two rendering engines share no
  // drawing module, matching this codebase's established precedent.
  const SHAPE_MOSAIC_PALETTE=['#FF3B6B','#FFC94D','#4FD1C5','#7C5CFC','#FF8A5B','#3DDC84'];

  // One deterministic ("same input, same pixels" — this codebase's own
  // established rule for any generative visual effect, e.g. the Spray
  // Doodle medium) cell motif, cycled by row/column index, never
  // Math.random — a redraw of the identical text always looks identical.
  function _paintShapeMosaicCell(ctx,cx,cy,cell,colorA,colorB,variant){
    const half=cell/2;
    ctx.save();
    ctx.translate(cx,cy);
    const v=variant%3;
    if(v===0){
      ctx.fillStyle=colorA;
      ctx.beginPath(); ctx.moveTo(-half,-half); ctx.lineTo(0,0); ctx.lineTo(-half,half); ctx.closePath(); ctx.fill();
      ctx.fillStyle=colorB;
      ctx.beginPath(); ctx.moveTo(half,-half); ctx.lineTo(0,0); ctx.lineTo(half,half); ctx.closePath(); ctx.fill();
    } else if(v===1){
      ctx.fillStyle=colorA; ctx.fillRect(-half,-half,cell,cell);
      ctx.fillStyle=colorB;
      ctx.beginPath(); ctx.moveTo(0,-half); ctx.lineTo(half,0); ctx.lineTo(0,half); ctx.lineTo(-half,0); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle=colorA; ctx.fillRect(-half,-half,cell,cell);
      ctx.fillStyle=colorB;
      ctx.beginPath(); ctx.moveTo(-half,-half); ctx.lineTo(half,-half); ctx.lineTo(-half,half); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(half,-half); ctx.lineTo(half,half); ctx.lineTo(-half,half); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function _fillShapeMosaicPattern(ctx,w,h,cellSize){
    const cols=Math.ceil(w/cellSize)+1;
    const rows=Math.ceil(h/cellSize)+1;
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const idxA=(row*7+col*3)%SHAPE_MOSAIC_PALETTE.length;
        const idxB=(row*7+col*3+2+SHAPE_MOSAIC_PALETTE.length)%SHAPE_MOSAIC_PALETTE.length;
        const variant=row*5+col*2;
        _paintShapeMosaicCell(ctx,col*cellSize+cellSize/2,row*cellSize+cellSize/2,cellSize,SHAPE_MOSAIC_PALETTE[idxA],SHAPE_MOSAIC_PALETTE[idxB],variant);
      }
    }
  }

  // mainCtx: the real canvas context currently drawing (already
  // transformed for rotation, if any — the final drawImage call below
  // respects whatever transform is active, so this works transparently
  // whether the caller rotated first or not). bx/by/bw/bh: the natural
  // (untransformed) text-block bbox, in the exact same coordinate space
  // drawTextFn's own fillText/strokeText calls use. drawTextFn(targetCtx,
  // isStroke): replicates the caller's own per-line loop against
  // whatever ctx it's handed — false builds the solid-black alpha mask,
  // true draws the white outline pass — so the mosaic fill can never
  // drift out of sync with what a plain solid fill would have drawn.
  function _drawShapeMosaicTextBlock(mainCtx,bx,by,bw,bh,drawTextFn){
    const pad=Math.max(4,Math.ceil(bh*0.2));
    const w=Math.max(1,Math.ceil(bw+pad*2));
    const h=Math.max(1,Math.ceil(bh+pad*2));
    const off=document.createElement('canvas');
    off.width=w; off.height=h;
    const octx=off.getContext('2d');
    octx.save();
    octx.translate(-bx+pad,-by+pad);
    drawTextFn(octx,false);
    octx.restore();
    // The mosaic pattern is built on its OWN, separate offscreen canvas
    // first (plain source-over, so each cell's own two fill() calls never
    // interfere with each other), then composited onto the glyph mask via
    // exactly ONE drawImage call under source-in — a real bug found and
    // fixed here, not assumed correct: source-in composites per DRAW CALL,
    // not cumulatively, over the whole canvas. Looping several fill() calls
    // directly under source-in (the original approach) let every later
    // cell's fill erase every earlier cell's already-composited result — a
    // pixel "untouched by this call" counts as fully transparent source,
    // multiplied against dest alpha = 0, wiping out whatever was already
    // painted there, regardless of the fact it had already composited
    // correctly on a prior call. Confirmed via a decisive reproduction: the
    // old code rendered only the final white outline stroke, zero mosaic
    // colour, for any text with 2+ shape cells.
    const pattern=document.createElement('canvas');
    pattern.width=w; pattern.height=h;
    const pctx=pattern.getContext('2d');
    _fillShapeMosaicPattern(pctx,w,h,Math.max(18,Math.round(bh*0.4)));
    octx.globalCompositeOperation='source-in';
    octx.drawImage(pattern,0,0);
    octx.globalCompositeOperation='source-over';
    octx.save();
    octx.translate(-bx+pad,-by+pad);
    drawTextFn(octx,true);
    octx.restore();
    mainCtx.drawImage(off,bx-pad,by-pad);
  }

  function _drawQuoteText(s,t,rect){
    const m=(s && s.metadata) || {};
    const quote=(typeof m.quoteText==='string') ? m.quoteText.trim() : '';
    const attribution=(typeof m.quoteAttribution==='string') ? m.quoteAttribution.trim() : '';
    if(!quote && !attribution) return;
    const cx=rect.x+rect.w/2;
    const maxWidth=rect.w*0.82;
    x.save();
    x.textAlign='center';
    x.textBaseline='middle';
    const quoteSize=32;
    x.font='italic '+quoteSize+'px Georgia, serif';
    // A museum wall label is dark serif on a light wall, regardless of
    // the Story Theme's own storyText colour (usually white, meant for
    // a dark book-frame background) — Quote is a Museum Gallery
    // composition, not a generic Story Theme feature.
    x.fillStyle='#3A3A3A';
    const lines=quote?_wrapText('“'+quote+'”',maxWidth):[];
    const lineHeight=Math.round(quoteSize*1.35);
    const totalH=lines.length*lineHeight+(attribution?lineHeight:0);
    let cy=rect.y+rect.h/2-totalH/2+lineHeight/2;
    lines.forEach(function(line){
      x.fillText(line,cx,cy);
      cy+=lineHeight;
    });
    if(attribution){
      x.font='16px Georgia, serif';
      x.fillStyle='rgba(58,58,58,0.7)';
      x.fillText('— '+attribution,cx,cy);
    }
    x.restore();
  }

  // ---------- Unified Layer Ordering (Scene elements + Stickers) ----------
  // A real, user-reported gap: Scene blueprint elements (Frame/Decoration/
  // Text-holder on Cover/Hook/End pages) order themselves via a numeric
  // `zIndex`, while Stickers order via plain array position — two
  // completely separate mechanisms that were always drawn as two
  // back-to-back loops (Scene elements, then every Sticker unconditionally
  // after), so a Sticker could never be sent behind, or a Scene element
  // brought in front of, the other kind, regardless of either's own
  // ordering value. These two are the one pair safely mergeable into one
  // interleaved draw pass with no risk to any existing theme: neither
  // depends on Frame/Panel/Border-specific geometry (unlike World-owned
  // Layer Pack objects, whose rect for 'frame'/'holder'/'element' scopes
  // is only resolved at specific points inside Frame/Panel drawing, and
  // whose 'slide'/'overlay' scopes are drawn at fixed points — before
  // Frame/Panel, and after everything else, respectively — that existing
  // themes already depend on; unifying those safely needs deferred/
  // two-pass drawing, a materially bigger change disclosed as a follow-up
  // rather than forced into this pass).
  //
  // `_naturalStoryOrder` is exactly today's existing order (Scene elements
  // sorted by zIndex, then every Sticker in array order) — calling this
  // alone and never applying an override reproduces the pre-existing
  // behaviour byte-for-byte. `_resolveStoryOrder` applies an optional,
  // page-wide `layerOrder` override (SceneEngine.getLayerOrder/
  // setLayerOrder) written only once a Story Author actually drags a card
  // in the Object Strip or clicks an Order button — absent for every page
  // today, so this whole mechanism is purely additive.
  //
  // Follow-up (a real project reported to have nothing reorderable at
  // all — a page built almost entirely from moveable World-owned
  // Decoration Shapes plus one Sticker): a `moveable:true` World-owned
  // Layer Pack object now ALSO joins a reorderable group — but strictly
  // WITHIN its own draw bucket, never crossing into another one. There
  // are three such buckets, always drawn in this fixed relative order:
  // "earlier" (non-overlay World objects — slide/frame/holder/element
  // scopes, drawn first), "story" (the Scene-element/Sticker interleaved
  // pass above, drawn second), and "overlay" (overlay-scoped World
  // objects, drawn last). Two objects that share a bucket (e.g. two
  // Scene-hosted background Shapes, both 'slide'-scoped) can be freely
  // reordered relative to each other — this is exactly as safe as the
  // Scene/Sticker merge above, since nothing about their own relative
  // draw-call order needs to move, only which one draws first within the
  // single shared call. Crossing a bucket boundary (e.g. a 'slide'-scoped
  // Shape moving in front of a Sticker) is NOT done here — that still
  // needs the same deferred/two-pass drawing named above as a follow-up.
  // `_applyOrderOverride` is the one shared resolution step every bucket
  // (Story, Earlier, Overlay) independently runs against the SAME global
  // `layerOrder` array — ids are unique across buckets, so a foreign id
  // appearing in the override is simply invisible to a bucket that
  // doesn't contain it; this is what keeps the three buckets from ever
  // being able to interfere with each other even though they share one
  // override list.
  function _applyOrderOverride(natural,order){
    if(!order || !order.length) return natural;
    const indexOf={};
    order.forEach(function(id,i){ indexOf[id]=i; });
    const listed=[], unlisted=[];
    natural.forEach(function(o){
      if(Object.prototype.hasOwnProperty.call(indexOf,o.id)) listed.push(o); else unlisted.push(o);
    });
    listed.sort(function(a,b){ return indexOf[a.id]-indexOf[b.id]; });
    // Anything never listed (e.g. a Sticker added after the last drag, or
    // a locked World object that was never draggable to begin with) is
    // appended after every listed object — matches the pre-existing
    // "the last sticker added sits on top" convention.
    return listed.concat(unlisted);
  }
  function _naturalStoryOrder(s){
    const out=[];
    if(typeof SceneEngine==='undefined') return out;
    const data=SceneEngine.getRenderData(s);
    if(data && data.elements && data.elements.length){
      const sorted=data.elements.slice().sort(function(a,b){ return (a.zIndex||0)-(b.zIndex||0); });
      sorted.forEach(function(el){ if(el.visible!==false) out.push({id:el.id,kind:'scene',ref:el}); });
    }else{
      // Guardrails / full cross-object reorder — a Story-role page (no
      // Scene blueprint) places its Artwork Place(s) here, ahead of
      // Stickers, matching today's exact visual order when nothing has
      // been reordered. A Quote composition or a Scene explicitly
      // converged with zero Places draws no Places at all — the same
      // gating _resolveBorder/_activeLayoutHolders already use. A
      // `visible:false` Place (Builder's own "Should a Story Author see
      // this at all?" guardrail) is skipped entirely here — never drawn,
      // never in Object Strip, never reorderable — mirroring how a
      // hidden World-owned Layer Pack object is already skipped above.
      //
      // A real regression, found via full regression testing: every
      // theme compiled before Multiple Artwork Places Per Page (every
      // theme today except a freshly-authored multi-Place one —
      // including Museum Gallery) has no `placeRects` array at all, so
      // `_activeLayoutPlaces(s)` returns null — that must still mean
      // "exactly one implicit Place" (the convention `getPlaceRects`'s
      // own fallback already establishes), NEVER "zero Places," or Place
      // 1 (and its Frame-scoped Layer Pack content — Museum Gallery's
      // own Wax Seal/Museum Caption) would silently stop drawing/
      // appearing in Object Strip entirely for every legacy theme.
      const places=_activeLayoutPlaces(s);
      if(_layoutCompositionFor(s)!=='quote' && _activeLayoutHolders(s)!==0){
        const effectivePlaces=(places && places.length) ? places : [null];
        effectivePlaces.forEach(function(p,i){
          if(_resolvePlacePermissions(p).visible===false) return;
          out.push({id:(i===0?'image-holder':'image-place-'+(i+1)),kind:'place',ref:{place:p,index:i}});
        });
      }
    }
    const stickers=SceneEngine.getStickers(s);
    for(let i=0;i<stickers.length;i++) out.push({id:stickers[i].id,kind:'sticker',ref:stickers[i]});
    return out;
  }
  function _resolveStoryOrder(s){
    const order=(typeof SceneEngine!=='undefined')?SceneEngine.getLayerOrder(s):null;
    return _applyOrderOverride(_naturalStoryOrder(s),order);
  }
  // World-object bucket helpers — read straight off `_layerObjectBboxes`,
  // the cache render() just populated for whichever slide it last drew
  // (the same "read the last render's cache" convention getSceneElements/
  // getTextElements already use). Only `moveable:true` entries ever join
  // a bucket; a locked object is simply never present in either list, so
  // it can never be dragged and never has anything dropped onto it.
  // Resolved against the SAME `layerOrder` override render()'s own
  // bucket-splitting step applies, so a caller asking "what's this
  // bucket's current order" after a reorder sees the real, already-
  // reordered result rather than the natural push order every time.
  function _worldBucketOrder(s,wantOverlay){
    const natural=_layerObjectBboxes.filter(function(o){
      return !!o.moveable && (wantOverlay?o.target==='overlay':o.target!=='overlay');
    });
    const order=(typeof SceneEngine!=='undefined')?SceneEngine.getLayerOrder(s):null;
    return _applyOrderOverride(natural,order);
  }
  // Unified Layer Ordering follow-up — when the most recent render() used
  // the merged, no-Frame-pipeline pass, every drawn object (Scene
  // element/Sticker AND slide-/overlay-scoped World layer alike) already
  // lives in `_lastSceneElements` in ONE final resolved order; a locked
  // World-owned layer is excluded here exactly as it always was (never
  // draggable), while every story-owned object (Scene element/Sticker)
  // stays included unconditionally, matching the pre-existing story
  // bucket's own behaviour.
  function _mergedReorderableIds(){
    return _lastSceneElements.filter(function(o){
      // Guardrails — unlike a plain "locked" Scene element/Sticker
      // (which stays reorderable even while its own position is frozen —
      // an existing, pre-Places precedent), a Place's own "Can a Story
      // Author move this?" guardrail is the ONE checkbox this feature is
      // actually about: unchecking it means "keep this fixed," full
      // stop — position AND stacking order both, matching the real bug
      // report that named both symptoms together. So a non-moveable
      // Place is excluded here entirely, not just from the grab-handle.
      if(o.isPlace) return !!o.moveable;
      return o.owner==='story' || (o.owner==='world' && !!o.moveable);
    }).map(function(o){ return o.id; });
  }
  // Exported so Card Designer's Order buttons and the Object Strip's
  // drag-to-reorder both read the SAME current effective order rather
  // than recomputing it themselves — the one place this is decided. The
  // three buckets (story/earlier/overlay) are concatenated into one flat
  // list here purely so callers have a single "is this id reorderable at
  // all, and what's its current position" answer; render()'s own
  // `_applyOrderOverride` calls resolve each bucket independently, so a
  // foreign id from a different bucket sitting anywhere in this flat list
  // (or in the persisted layerOrder it gets spliced into) can never shift
  // an object across a bucket boundary — see the comment above
  // `_naturalStoryOrder`. When the page has no Frame/Holder pipeline
  // (`_lastRenderWasMerged`), there's only ONE group — read directly off
  // `_lastSceneElements`'s already-resolved merged order instead.
  function getReorderableIds(s){
    if(_lastRenderWasMerged) return _mergedReorderableIds();
    return _resolveStoryOrder(s).map(function(o){ return o.id; })
      .concat(_worldBucketOrder(s,false).map(function(o){ return o.id; }))
      .concat(_worldBucketOrder(s,true).map(function(o){ return o.id; }));
  }
  // Which independent reorder bucket an id currently belongs to —
  // 'story' (Scene elements + Stickers), 'earlier' (non-overlay
  // World-owned objects), 'overlay' (overlay-scoped World-owned
  // objects), or null if it isn't reorderable at all right now (a locked
  // World object, or an id that no longer exists on the page). The
  // Object Strip's drag handler uses this so a drag can only ever be
  // dropped against another card in the SAME bucket — crossing buckets
  // would silently do nothing to the actual draw order (see above), so
  // this keeps the drop target from ever suggesting a move that
  // wouldn't really happen. When `_lastRenderWasMerged`, every reorderable
  // id shares one bucket (named 'merged') since the whole page draws as
  // one interleaved pass — no boundary to enforce.
  function getReorderBucket(s,id){
    if(_lastRenderWasMerged) return _mergedReorderableIds().indexOf(id)!==-1 ? 'merged' : null;
    if(_layerObjectBboxes.some(function(o){ return o.id===id && !!o.moveable && o.target!=='overlay'; })) return 'earlier';
    if(_layerObjectBboxes.some(function(o){ return o.id===id && !!o.moveable && o.target==='overlay'; })) return 'overlay';
    if(_naturalStoryOrder(s).some(function(o){ return o.id===id; })) return 'story';
    return null;
  }

  function render(s){
    if(!x) return;
    // Scene Viewport sprint — only a canvas explicitly opted into
    // adaptive sizing (init(cv,{adaptiveViewport:true}), stamped on the
    // DOM element itself) ever resizes here; every other canvas
    // (Publish's own throwaway export canvases, any caller that never
    // opts in) keeps drawing at whatever fixed size its own init() call
    // already set, completely unaffected.
    if(c && c.__vihuAdaptiveViewport){
      const target=_sceneViewportFor(s);
      if(target.w!==_viewportW || target.h!==_viewportH){
        _viewportW=target.w; _viewportH=target.h;
        c.width=Math.round(_viewportW*_dpr);
        c.height=Math.round(_viewportH*_dpr);
        try{ x.setTransform(_dpr,0,0,_dpr,0,0); }catch(e){}
        try{ x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; }catch(e){}
        try{ c.style.aspectRatio=_viewportW+' / '+_viewportH; }catch(e){}
      }
    }
    const t=_theme(s);
    const opts=_options(s);
    const overrides=(s && s.overrides && s.overrides.textElements) || {};
    _lastTextElements=[];
    _layerObjectBboxes=[];

    // Sprint 6.5 — when the user has customised the Picture Border, draw
    // a styled frame in place of the legacy panel. Otherwise fall through
    // to the existing panel style so untouched projects stay pixel-identical.
    // Sprint 9.7 — resolved before the background fill below so a Frame
    // Variation's `wallTone` (the gallery wall colour, a Slide-level
    // concept distinct from the mat) can override it.
    const _border=_resolveBorder(s);
    const _panelRect=_panelRectFor(s);
    // Multiple Artwork Places Per Page — Place 1's OWN rendered rect.
    // Governing rule — "when Scene shows up in Creator it is exactly as
    // it was in Builder": whenever a Layout authors ANY real Place (its
    // own placeRects array exists, length>=1), Place 1 is subdivided by
    // its own authored fractional position/size exactly like every other
    // Place, honouring Builder's own geometry rather than silently
    // discarding it for a "full panel" substitute. Only when a Layout
    // authors NO Places at all (no placeRects array — every legacy theme
    // with no Scene/Place concept, e.g. Museum Gallery) does Place 1 fall
    // back to the full, unmodified panel rect — the true implicit-Place
    // case, unchanged.
    const _places=_activeLayoutPlaces(s);
    const _place1Rect=_applyPlaceMoveOverride(_applyPlaceSizeOverride((_places && _places.length) ? _placePixelRectFor(_sceneCanvasRect(s),_places[0]) : _panelRect, s, 'image-holder'), s, 'image-holder');
    // Whole-Place rotation for Place 1 must wrap BOTH the mat/fill/
    // presentation draws further down (which happen BEFORE the reorderable
    // loop, so a naive per-loop-iteration transform would only rotate the
    // artwork/ornament/caption on top and leave the mat/wall/border pixels
    // unrotated -- exactly the bug the rotation feature's verification
    // caught). Compute the effective rotation once up front so the same
    // value is applied by both the mat-fill wrap (below, when _border is
    // present) and the reorderable loop's Place-1 branch (further down).
    const _place1=(_places && _places.length)?_places[0]:null;
    const _place1Perm=_resolvePlacePermissions(_place1);
    const _place1BaseRot=(_place1 && typeof _place1.rotation==='number')?_place1.rotation:0;
    const _place1Ov=(s.metadata && s.metadata.elementOverrides && s.metadata.elementOverrides['image-holder'])||null;
    const _place1OvRot=(_place1Ov && typeof _place1Ov.rotation==='number' && _place1Perm.rotatable)?_place1Ov.rotation:null;
    const _place1RotDeg=(_place1OvRot!==null)?_place1OvRot:_place1BaseRot;
    const _place1Cx=_place1Rect.x+_place1Rect.w/2;
    const _place1Cy=_place1Rect.y+_place1Rect.h/2;
    // Sprint 9.7 — "Each layout must define its own composition."
    // 'quote' suppresses the Frame/Holder/image pipeline entirely (a
    // gallery wall with just a quote on it); 'right' keeps everything
    // but moves the Museum Caption beside the Frame instead of below.
    const _composition=_layoutCompositionFor(s);
    // Unified Layer Ordering follow-up — whenever there's genuinely no
    // Frame/Holder pipeline running for this page (a Quote composition,
    // or a Scene explicitly converged with zero Places), the 'frame'/
    // 'holder'/'element' Layer Pack targets are never drawn at all (their
    // own `_renderLayers` calls live inside the border-drawing branch
    // below, which these two compositions skip outright) -- so 'slide'
    // and 'overlay' Layer Pack objects, plus every Scene element/Sticker,
    // are the ONLY things this page ever draws, with nothing else whose
    // own draw-order depends on Frame/Panel geometry. That's exactly the
    // condition under which merging all three into one fully-interleaved,
    // freely-reorderable pass is safe — see the merged branch below.
    const _noFramePipeline=(_composition==='quote')||(_activeLayoutHolders(s)===0);
    // Sprint 6.2 — when a scene is active, the scene blueprint owns the
    // page composition. Skip the legacy Story-style pipeline so text /
    // image / decorations don't double-render. Story-role pages stay
    // byte-identical because SceneEngine.getRenderData returns null for
    // them. Hoisted earlier than its original position (right before the
    // `if(!_hasScene)` block below) so it can gate the bulk 'slide'-layer
    // draw immediately below too — see _useMergedPass's own comment.
    const _hasScene=(typeof SceneEngine!=='undefined') && (SceneEngine.getRenderData(s)!==null);
    // Guardrails / full cross-object reorder — a Story-role page (no
    // Scene blueprint) ALWAYS uses the fully-interleaved merged pass now,
    // not just when `_noFramePipeline` (Quote/zero-Holder), so that real
    // Artwork Places can be freely reordered against Stickers and World-
    // owned 'slide'/'overlay' Layer Pack objects — closing the guardrails
    // gap (Builder's own "Can a Story Author move/reorder this?" per-
    // Place permission had no effect in Creator until now). A Cover/Hook/
    // End page (`_hasScene` true, no Places ever apply) is completely
    // unaffected — it keeps using the merged pass ONLY when
    // `_noFramePipeline`, exactly as before this change.
    const _useMergedPass=_noFramePipeline||!_hasScene;

    // Frame
    const _wallTone=_resolveWallTone(s);
    const _bgOverride=_slideBackgroundOverride(s);
    // BACKLOG Bug 6 — null for every page except one whose Story Author
    // has uploaded a Background picture (js/contextPanel.js's
    // _appendBackgroundImageControls). Independent of _bgOverride above —
    // both can be set on the same page at once, colour behind image.
    const _bgImageOverride=_slideBackgroundImageOverride(s);
    // Whichever colour actually paints the wall/background (a Story
    // Author's own override, when set, else the World's wall tone)
    // decides chrome-text legibility too -- a dark override still needs
    // light Handle/Page Number text, exactly like a dark wall tone does.
    const _chromeColor=_chromeTextColor(_bgOverride||_wallTone);
    // Sprint 9.6 — Slide-targeted layers (Gallery Spotlight) sit right
    // on the background wall, before the picture panel/border draws on
    // top of it. A theme with no layerPack (every theme before this
    // sprint) has _layerPack===null, so _renderLayers is a no-op.
    const _layerPack=_activeLayerPack(s);
    // A Story Author's own per-page Background Colour override (Context
    // Panel's "Page Background" control) wins over both the World's own
    // wall tone and the Story Theme's default frame colour -- see
    // _slideBackgroundOverride's own comment for why this needed fixing.
    // Real, user-requested "set the background colour as transparent" —
    // skipped outright (a plain clearRect instead) whenever no Story-
    // Author override exists AND the World itself authored a real,
    // full-bleed Scene background Layer (`_hasSlideFullBleedFill`,
    // mirroring engineRuntime.js's own `_hasExplicitBottomFill` byte-
    // for-byte) — that Layer's own colour+alpha, painted moments later
    // in this same function's own 'slide'-target pass, becomes the
    // entire base instead of this fallback painting underneath it,
    // exactly as Builder's Working View/Runtime Preview already show. A
    // page with no such Layer (every existing theme, and any page that
    // never touches Colour) is completely unaffected.
    if(!_bgOverride && _hasSlideFullBleedFill(_layerPack)){
      x.clearRect(0,0,_viewportW,_viewportH);
    }else{
      x.fillStyle=_bgOverride||_wallTone||_frameColor(t,opts);
      x.fillRect(0,0,_viewportW,_viewportH);
    }
    // A Story Author's own Background picture (js/contextPanel.js's
    // _appendBackgroundImageControls) draws on top of whichever
    // colour/clear/wall-tone fill just painted above -- that fill stays
    // visible behind it (per Bug 6, colour is always BEHIND the image,
    // never hidden entirely) and, for the one frame or two while
    // _ensureDecorationImage is still resolving the real picture
    // asynchronously, is all that's visible until this repaints once
    // it's ready.
    if(_bgImageOverride){
      _drawSlideBackgroundImage(s,_bgImageOverride);
    }
    // When this page uses the merged pass, 'slide'-target layers are
    // deferred into it instead of being bulk-drawn here — see that
    // pass's own comment.
    if(!_useMergedPass){
      _renderLayers(_layerPack,'slide',{x:0,y:0,w:_viewportW,h:_viewportH},s);
    }

    if(_composition==='quote'){
      _drawQuoteText(s,t,_panelRect);
    }else if(_activeLayoutHolders(s)===0){
      // A Scene explicitly converged with zero Places has no picture
      // area at all -- unlike the plain "_border is null" case just
      // below (a legacy Story Theme with no Artwork Theme, where
      // _drawPanel's page-colour rectangle IS the intended background
      // for where the story picture goes), a zero-Holder Artwork Theme
      // Scene isn't missing styling, it's declaring there's no picture
      // area here at all. That fallback panel was never holder-count
      // aware, so it kept painting regardless -- the real source of
      // the reported "white box" once _resolveBorder started correctly
      // returning null for this case. Draw nothing here; the 'slide'-
      // scoped Layer Pack entries above (background fill/decorations)
      // are the only content a zero-Holder Scene ever declares.
    }else if(_border){
      if(_place1RotDeg){
        x.save();
        x.translate(_place1Cx,_place1Cy);
        x.rotate(_place1RotDeg*Math.PI/180);
        x.translate(-_place1Cx,-_place1Cy);
      }
      _drawPictureFrameFill(_place1Rect,_border,t,s);
      _drawArtworkPresentation(_place1Rect,_border);
      if(_place1RotDeg) x.restore();
    }else{
      // Fallback panel (no Artwork Theme border resolved) still needs the
      // same rotation wrap for the same reason as the mat-fill branch
      // above -- a Story-Author-rotated Place must show the WHOLE Place
      // rotate around its own centre, panel included. Without this, the
      // panel stays axis-aligned while the artwork inside _drawPlaceOne
      // rotates, breaking "whole Place rotates as one unit".
      if(_place1RotDeg){
        x.save();
        x.translate(_place1Cx,_place1Cy);
        x.rotate(_place1RotDeg*Math.PI/180);
        x.translate(-_place1Cx,-_place1Cy);
      }
      _drawPanel(t.panel.color,opts.panelStyle,_place1Rect);
      if(_place1RotDeg) x.restore();
    }

    // _hasScene is now computed earlier (before the bulk 'slide'-layer
    // draw above) — see its own comment there.
    if(!_hasScene){
      // Top story text
      const storyBbox=_drawStoryText(s,t,overrides);
      if(storyBbox) _lastTextElements.push(storyBbox);

      // Handle / branding watermark — Sprint 5.0 reads handle text from payload.
      const handleBbox=_drawHandle(t,opts,overrides,s.handle,_layerPosition(_layerPack,'handle'),_chromeColor);
      if(handleBbox) _lastTextElements.push(handleBbox);

      // Guardrails / full cross-object reorder — Places (Frame/Holder/
      // Element content + caption, Place-1-only exactly as before) now
      // draw as part of the SAME fully-interleaved, freely-reorderable
      // pass Stickers and World-owned 'slide'/'overlay' Layer Pack
      // objects already use, instead of fixed code that always ran
      // before Stickers regardless of any reorder — this is what lets a
      // Story Author drag a Place in front of/behind a Sticker or a
      // World-owned Decoration in the Object Strip. A Story-role page
      // (this branch) ALWAYS uses this merged pass now — previously only
      // when `_noFramePipeline` (Quote/zero-Holder) did. Cover/Hook/End
      // pages (the `_hasScene` branch below, outside this `if`) are
      // completely unaffected: they still use the merged pass only when
      // `_noFramePipeline`, via the untouched code further down, exactly
      // as before this change.
      _lastSceneElements=[];
      _lastRenderWasMerged=true;
      const slideLayers=(_layerPack && typeof LayerEngine!=='undefined')?LayerEngine.forTarget(_layerPack,'slide'):[];
      const overlayLayers=(_layerPack && typeof LayerEngine!=='undefined')?LayerEngine.forTarget(_layerPack,'overlay'):[];
      const combinedNatural=
        slideLayers.map(function(l){ return {id:l.id,kind:'layer',ref:l,target:'slide'}; })
        .concat(_naturalStoryOrder(s))
        .concat(overlayLayers.map(function(l){ return {id:l.id,kind:'layer',ref:l,target:'overlay'}; }));
      const _storyOrder=(typeof SceneEngine!=='undefined')?SceneEngine.getLayerOrder(s):null;
      const resolvedStoryCombined=_applyOrderOverride(combinedNatural,_storyOrder);
      resolvedStoryCombined.forEach(function(o){
        if(o.kind==='layer'){
          const beforeLen=_layerObjectBboxes.length;
          _renderOneLayer(o.ref,{x:0,y:0,w:_viewportW,h:_viewportH},s,o.target);
          if(_layerObjectBboxes.length>beforeLen) _lastSceneElements.push(_layerObjectBboxes.pop());
        }else if(o.kind==='place'){
          const _place=o.ref.place;
          const _placeIndex=o.ref.index;
          const _placeSelId=o.id;
          const _perm=_resolvePlacePermissions(_place);
          let bbox;
          let _thisPlaceRect;
          // Whole-Place rotation (Theme-Author base + Story-Author
          // override — override wins when both are set, matching every
          // other elementOverrides field). Applied as a ctx transform
          // that wraps BOTH the Place's own chrome (image/border/ornament/
          // caption + Place-1-only 'frame'/'holder'/'element' Layer Packs)
          // AND every Place-hosted Layer beneath it, so the whole Place
          // pivots as one unit around its own centre — a Frame's
          // mat/border/ornament and every anchored decoration all follow
          // together, never independently. `rotatable` gates whether the
          // Story-Author-side override even reaches this branch (the
          // Selection Action Strip's Rotation slider is hidden when
          // false); the Theme-Author's base rotation always applies
          // regardless. The bbox pushed below stays the un-rotated rect
          // for hit-testing/reordering purposes — Selection Action Strip
          // is the primary editor for rotation anyway.
          const _placeBaseRot=(_place && typeof _place.rotation==='number')?_place.rotation:0;
          const _placeOv=(s.metadata && s.metadata.elementOverrides && s.metadata.elementOverrides[_placeSelId])||null;
          const _placeOvRot=(_placeOv && typeof _placeOv.rotation==='number' && _perm.rotatable)?_placeOv.rotation:null;
          const _placeRotDeg=(_placeOvRot!==null)?_placeOvRot:_placeBaseRot;
          if(_placeIndex===0){
            _thisPlaceRect=_place1Rect;
          }else{
            // The storage/selection id for this Place is index-based
            // ('image-place-N'), deliberately distinct from the Place's
            // own compiled Builder id — see _placeByExternalId's own
            // comment for why the two id spaces are kept separate.
            _thisPlaceRect=_applyPlaceMoveOverride(_applyPlaceSizeOverride(_placePixelRectFor(_sceneCanvasRect(s),_place), s, _placeSelId), s, _placeSelId);
          }
          if(_placeRotDeg){
            const _pcx=_thisPlaceRect.x+_thisPlaceRect.w/2;
            const _pcy=_thisPlaceRect.y+_thisPlaceRect.h/2;
            x.save();
            x.translate(_pcx,_pcy);
            x.rotate(_placeRotDeg*Math.PI/180);
            x.translate(-_pcx,-_pcy);
          }
          // Place · Frame · Paper · Art Model V2 — Phase 4 dispatch.
          // A Place carrying compiled `v2Layers` (Phase 3 output from
          // a Theme Author who opted the Place into V2 via Phase 2b's
          // Enable) renders through the new V2 path. Every other Place
          // — every existing Theme — falls through to the byte-
          // identical legacy _drawPlaceOne / _drawPlaceExtra.
          if(_place && _place.v2Layers){
            if(_placeIndex===0){
              bbox=_drawPlaceV2(s,t,_place,_place1Rect,_chromeColor,'image-holder',null,null);
            }else{
              const _placeContent=(s.metadata && s.metadata.placeContent && s.metadata.placeContent[_placeSelId])||null;
              const _placeImg=(s.placeImages && s.placeImages[_placeSelId])||null;
              const _placeView=(_placeContent && _placeContent.imageView)||null;
              bbox=_drawPlaceV2(s,t,_place,_thisPlaceRect,_chromeColor,_placeSelId,_placeImg,_placeView);
            }
          }else if(_placeIndex===0){
            bbox=_drawPlaceOne(s,t,_border,_place1Rect,_chromeColor,_layerPack,_composition);
          }else{
            const _placeBorder=_resolveBorder(s,_placeSelId);
            const _placeContent=(s.metadata && s.metadata.placeContent && s.metadata.placeContent[_placeSelId])||null;
            const _placeImg=(s.placeImages && s.placeImages[_placeSelId])||null;
            const _placeView=(_placeContent && _placeContent.imageView)||null;
            bbox=_drawPlaceExtra(s,t,opts,_thisPlaceRect,_placeBorder,_placeImg,_placeView,_chromeColor,_placeSelId);
          }
          // "Extend Experiences to Places" — paints any Experience Hosted
          // By THIS specific Place (a compiled target:'place' Layer Pack
          // entry, any Experience type, unlike the legacy Place-1-only
          // 'frame'/'holder'/'element' scopes) right after the Place's own
          // Frame/image draw, exactly where the plan calls for it — reuses
          // the same pop-the-newly-pushed-bboxes-off-_layerObjectBboxes
          // pattern the plain layer branch above already uses (splice, not
          // pop, since more than one Layer/Experience can be hosted at one
          // Place and their authored order should survive into the render
          // tree), so a Place-hosted object is just as selectable/
          // reorderable/Object-Strip-visible as anything else on the page.
          if(_place && _place.id){
            const _beforeLen=_layerObjectBboxes.length;
            _renderPlaceHostedLayers(_layerPack,_place.id,_thisPlaceRect,s);
            if(_layerObjectBboxes.length>_beforeLen){
              _layerObjectBboxes.splice(_beforeLen).forEach(function(o2){ _lastSceneElements.push(o2); });
            }
          }
          if(_placeRotDeg) x.restore();
          if(bbox){
            bbox.id=_placeSelId;
            bbox.type='image-holder';
            bbox.isPlace=true;
            bbox.label=(_place && _place.name) || (_placeIndex===0 ? (s.image?'Artwork':'Artwork Place') : ('Artwork Place '+(_placeIndex+1)));
            bbox.visible=true;
            bbox.locked=!_perm.moveable;
            bbox.moveable=_perm.moveable;
            bbox.editable=_perm.editable;
            bbox.resizable=_perm.resizable;
            bbox.rotatable=_perm.rotatable;
            bbox.rotation=_placeRotDeg;
            _lastSceneElements.push(_sceneObject(bbox,'story'));
          }
        }else if(o.kind==='sticker'){
          const st=o.ref;
          _drawSceneSticker(st,s);
          _lastSceneElements.push(_sceneObject(_stickerBbox(st,s),'story'));
        }
      });

      // Decorations on the frame
      _drawDecorations(opts.decorations,t,opts);

      // Footer (book title)
      const footerBbox=_drawFooter(t,opts,s.bookTitle||'',overrides);
      if(footerBbox) _lastTextElements.push(footerBbox);

      // Page number
      const pageBbox=_drawPageNumber(t,opts,s.page||1,s.totalPages||1,overrides,_layerPosition(_layerPack,'page-number'),_chromeColor);
      if(pageBbox) _lastTextElements.push(pageBbox);
    }

    // Sprint 6.1 — Scene Layer. Story role pages return null from
    // SceneEngine, so this pass is a no-op for them — and, since the
    // Guardrails / full cross-object reorder generalization above, a
    // Story-role page (`!_hasScene`) already ran its OWN merged pass
    // in-place (including Places) and populated `_lastSceneElements`
    // there; re-running this whole block for such a page would reset
    // `_lastSceneElements=[]` and silently discard that work. Gated on
    // `_hasScene` so this entire section — completely unchanged from
    // before this feature — only ever runs for Cover/Hook/End pages.
    //
    // Unified Layer Ordering — Scene blueprint elements (Frame/Decoration/
    // Text-holder) and Stickers now draw as ONE resolved, interleaved
    // pass (_resolveStoryOrder) instead of two fixed back-to-back loops,
    // so a Sticker can be sent behind/brought in front of a Scene element
    // and vice versa. Natural order (no layerOrder override, every page
    // today) is exactly the old fixed sequence — Scene elements sorted by
    // zIndex, then every Sticker in array order — so this is byte-
    // identical until a Story Author actually reorders something.
    if(_hasScene){
      _lastSceneElements=[];
      _lastRenderWasMerged=_noFramePipeline;
      if(_noFramePipeline){
        // Unified Layer Ordering follow-up ("reordering in object strip
        // not happening" on a real World built almost entirely from
        // moveable World-owned Decoration Shapes) — with no Frame/Holder
        // pipeline running, 'slide' and 'overlay' Layer Pack objects are
        // drawn nowhere else in this function, so they can safely join the
        // Scene-element/Sticker interleaved pass above as ONE fully
        // resolvable, freely-reorderable group instead of two separate
        // fixed-position bulk draws. This is what actually lets a Shape
        // move in front of/behind a Sticker (or another Shape it doesn't
        // happen to share a scope with), not just within its own bucket.
        const slideLayers=(_layerPack && typeof LayerEngine!=='undefined')?LayerEngine.forTarget(_layerPack,'slide'):[];
        const overlayLayers=(_layerPack && typeof LayerEngine!=='undefined')?LayerEngine.forTarget(_layerPack,'overlay'):[];
        const combinedNatural=
          slideLayers.map(function(l){ return {id:l.id,kind:'layer',ref:l,target:'slide'}; })
          .concat(_naturalStoryOrder(s))
          .concat(overlayLayers.map(function(l){ return {id:l.id,kind:'layer',ref:l,target:'overlay'}; }));
        const order=(typeof SceneEngine!=='undefined')?SceneEngine.getLayerOrder(s):null;
        const resolvedCombined=_applyOrderOverride(combinedNatural,order);
        resolvedCombined.forEach(function(o){
          if(o.kind==='layer'){
            // _renderOneLayer -> _pushLayerObject pushes onto the shared
            // _layerObjectBboxes accumulator, same as the bulk path; pull
            // that one entry straight into _lastSceneElements here instead,
            // so it lands in the exact position this merged pass decided,
            // not wherever the old fixed bulk concatenation would have put
            // it. The final fold-step below sees an empty
            // _layerObjectBboxes for this page (frame/holder/element never
            // ran) and is correctly a no-op.
            const beforeLen=_layerObjectBboxes.length;
            _renderOneLayer(o.ref,{x:0,y:0,w:_viewportW,h:_viewportH},s,o.target);
            if(_layerObjectBboxes.length>beforeLen) _lastSceneElements.push(_layerObjectBboxes.pop());
          }else if(o.kind==='scene'){
            const el=o.ref;
            if(el.type==='background') _drawSceneBackground(el);
            else if(el.type==='decoration') _drawSceneDecoration(el);
            else if(el.type==='image-holder') _drawSceneImageHolder(s,el);
            else if(el.type==='text-holder') _drawSceneTextHolder(s,el);
            else if(el.type==='text') _drawSceneText(s,el);
            _lastSceneElements.push(_sceneObject(_sceneBbox(el),'story'));
          }else if(o.kind==='sticker'){
            const st=o.ref;
            _drawSceneSticker(st,s);
            _lastSceneElements.push(_sceneObject(_stickerBbox(st,s),'story'));
          }
        });
      }else if(typeof SceneEngine!=='undefined'){
        const resolved=_resolveStoryOrder(s);
        resolved.forEach(function(o){
          if(o.kind==='scene'){
            const el=o.ref;
            if(el.type==='background') _drawSceneBackground(el);
            else if(el.type==='decoration') _drawSceneDecoration(el);
            else if(el.type==='image-holder') _drawSceneImageHolder(s,el);
            else if(el.type==='text-holder') _drawSceneTextHolder(s,el);
            // Legacy fallback for projects authored against Sprint 6.1.
            else if(el.type==='text') _drawSceneText(s,el);
            _lastSceneElements.push(_sceneObject(_sceneBbox(el),'story'));
          }else if(o.kind==='sticker'){
            const st=o.ref;
            _drawSceneSticker(st,s);
            _lastSceneElements.push(_sceneObject(_stickerBbox(st,s),'story'));
          }
        });
      }
    }

    // Builder Convergence Sprint — a 5th Layer Pack target, 'overlay',
    // sitting on top of literally everything above (frame/image/
    // decorations/footer/page number/legacy Scene elements/stickers),
    // at full-canvas fractional coordinates. The existing four targets
    // (slide/frame/holder/element, docs/THEME_PROJECT_SPEC.md §7/§11)
    // all render at specific points *within* the Slide->Frame->Holder->
    // Element containership chain, gated on a border/image existing —
    // exactly wrong for a converged Scene's own foreground content
    // (Decorations/Text authored to sit above the artwork, absolute
    // Scene-canvas position), which needs to paint unconditionally, on
    // top, regardless of whether this page even has a picture. No
    // pre-existing theme ever sets `target:'overlay'` on a layer, so
    // this is purely additive — zero effect on any theme that doesn't
    // use it.
    //
    // When this page used the merged pass (Story-role always; Cover/
    // Hook/End only when `_noFramePipeline`), 'overlay' was already
    // drawn as part of it.
    if(!_useMergedPass){
      _renderLayers(_layerPack,'overlay',{x:0,y:0,w:_viewportW,h:_viewportH},s);
    }

    // Fold every Layer Pack object drawn this pass (slide/frame/holder/
    // element/overlay scopes alike) into _lastSceneElements exactly once,
    // here — after every _renderLayers() call above and before anything
    // below reads _lastSceneElements for hit-testing/selection. Doing this
    // earlier (e.g. right after the 'slide'-scope call) would lose the
    // data: _lastSceneElements is reset to [] again above (Sprint 6.1's
    // own Scene Layer pass) after the four earlier-scope _renderLayers()
    // calls but before this 'overlay' one, so a Layer Pack object is only
    // ever safe to add after this point in the function.
    //
    // A real, user-reported bug ("added a sticker, I can't drag it; the
    // layer order buttons don't work"): every Layer Pack object used to be
    // concatenated onto the END of _lastSceneElements as one lump,
    // regardless of which scope drew it — but 'slide'/'frame'/'holder'/
    // 'element'-scoped objects were all drawn EARLIER in this render pass
    // (before Scene elements/Stickers below), while only 'overlay' is
    // genuinely drawn LAST (Builder Convergence Sprint's own "on top of
    // literally everything" design). Splitting on the `target` tag
    // _pushLayerObject now records restores real visual z-order for
    // hit-testing (app.js's _hitTestSceneElement reads this array
    // topmost-first): earlier-scoped World objects are spliced in BEFORE
    // the Scene elements/Stickers that visually sit above them, and only
    // 'overlay'-scoped ones are appended after, exactly as before.
    if(_layerObjectBboxes.length){
      // Unified Layer Ordering follow-up — a real project reported
      // nothing reorderable at all because its page was built almost
      // entirely from moveable World-owned Decoration Shapes. Each of
      // these two buckets can now be reordered WITHIN itself (a
      // page-wide `layerOrder` override, the exact same one the Story
      // bucket above already resolves against) — two Shapes sharing one
      // bucket can swap which one draws first; nothing crosses the
      // earlier/story/overlay boundary here, since that still needs the
      // deferred/two-pass drawing named above as a follow-up.
      const _worldOrder=(typeof SceneEngine!=='undefined')?SceneEngine.getLayerOrder(s):null;
      const _earlierLayerObjs=_applyOrderOverride(_layerObjectBboxes.filter(function(o){ return o.target!=='overlay'; }),_worldOrder);
      const _overlayLayerObjs=_applyOrderOverride(_layerObjectBboxes.filter(function(o){ return o.target==='overlay'; }),_worldOrder);
      _lastSceneElements=_earlierLayerObjs.concat(_lastSceneElements).concat(_overlayLayerObjs);
    }

    // Drag guides (Sprint 4.4) — drawn under the selection outline so the
    // outline stays on top of the canvas center crosshair.
    if(s && s.dragActiveId){
      const dragSel=_lastTextElements.find(function(e){ return e.id===s.dragActiveId; });
      if(dragSel) _drawDragGuides(dragSel);
    }

    // Sprint 6.1 selection outline for scene elements + Sprint 6.5
    // (Object Designer) resize handles for elements that support resize
    // (Frame / decoration).
    if(s && s.selectedSceneElement){
      const sel=_lastSceneElements.find(function(e){ return e.id===s.selectedSceneElement; });
      if(sel){
        _drawSelectionOutline(sel);
        if(_supportsResize(sel)) _drawResizeHandles(sel);
        // Guardrails — a small grab-handle appears once a moveable
        // Artwork Place is selected; dragging it repositions the Place
        // (js/app.js), completely independent of the existing content-
        // pan gesture (which still pans/zooms the picture itself when
        // the Place's own content area is clicked). A non-moveable Place
        // shows no handle at all — nothing to grab.
        if(sel.isPlace && sel.moveable && !sel.locked) _drawPlaceGrabHandle(sel);
      }
    }

    // Selection outline — last, so it sits above everything.
    if(s && s.selectedTextElement){
      const sel=_lastTextElements.find(function(e){ return e.id===s.selectedTextElement; });
      if(sel) _drawSelectionOutline(sel);
    }

    // Sprint 8.4.2 — Page Layout Safe Area guide. Editor chrome only: the
    // flag rides on the payload via `showSafeArea`, which the editor sets
    // from themeOptions.layout.showSafeArea and Publish Studio leaves
    // false. Draws a dashed gold rectangle inset by `pageMargin` so
    // children can keep important content inside the safe zone.
    if(s && s.showSafeArea){
      const m=(typeof s.pageMargin==='number') ? s.pageMargin : 60;
      if(m>0 && m<_viewportW/2 && m<_viewportH/2){
        x.save();
        x.strokeStyle='rgba(255,203,69,0.7)';
        x.lineWidth=2;
        x.setLineDash([12,8]);
        x.strokeRect(m,m,_viewportW-m*2,_viewportH-m*2);
        x.restore();
      }
    }
  }

  // Sprint 6.1 — scene element drawing helpers.
  function _drawSceneBackground(el){
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    x.fillStyle=el.color||'#000000';
    x.fillRect(0,0,_viewportW,_viewportH);
    x.restore();
  }
  function _drawSceneDecoration(el){
    const pos=el.position||{x:_viewportW/2,y:_viewportH/2};
    const size=el.size||{w:64,h:64};
    if(!el.glyph) return;
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    if(el.rotation){
      x.translate(pos.x,pos.y);
      x.rotate(el.rotation*Math.PI/180);
      x.translate(-pos.x,-pos.y);
    }
    x.font=Math.round(size.h||64)+'px "Apple Color Emoji","Segoe UI Emoji",Arial,sans-serif';
    x.textAlign='center';
    x.textBaseline='middle';
    x.fillText(el.glyph,pos.x,pos.y);
    x.restore();
  }
  function _drawSceneText(s,el){
    const text=SceneEngine.resolveTextSource(s,el.source) || el.placeholder || '';
    if(!text) return;
    const pos=el.position||{x:_viewportW/2,y:_viewportH/2};
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    const stylePart=el.fontStyle && el.fontStyle!=='normal' ? el.fontStyle+' ' : '';
    const weightPart=el.fontWeight && el.fontWeight!=='normal' ? el.fontWeight+' ' : '';
    x.font=stylePart+weightPart+(el.fontSize||56)+'px '+(el.fontFamily||'Georgia, serif');
    x.fillStyle=el.color||'#FFFFFF';
    x.textAlign=el.alignment||'center';
    x.textBaseline='alphabetic';
    x.fillText(text,pos.x,pos.y);
    x.restore();
  }

  // Sprint 6.2 — Text Holder. Same render contract as text, but draws a
  // soft placeholder when the page hasn't filled the slot yet so the
  // user always sees where the content will appear.
  function _drawSceneTextHolder(s,el){
    let text=SceneEngine.resolveTextSource(s,el.source);
    const isPlaceholder=!text;
    if(isPlaceholder) text=el.placeholder||'';
    if(!text) return;
    const pos=el.position||{x:_viewportW/2,y:_viewportH/2};
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    if(isPlaceholder) x.globalAlpha=(x.globalAlpha||1)*0.5;
    const stylePart=el.fontStyle && el.fontStyle!=='normal' ? el.fontStyle+' ' : '';
    const weightPart=el.fontWeight && el.fontWeight!=='normal' ? el.fontWeight+' ' : '';
    x.font=stylePart+weightPart+(el.fontSize||56)+'px '+(el.fontFamily||'Georgia, serif');
    x.fillStyle=el.color||'#FFFFFF';
    x.textAlign=el.alignment||'center';
    x.textBaseline='alphabetic';
    x.fillText(text,pos.x,pos.y);
    x.restore();
  }

  // Creator Acceptance Sprint — Museum Gallery Theme Fidelity. Mirrors
  // _drawSceneImageHolder's own "Add an image" dashed-placeholder
  // pattern (Sprint 6.2) for the one shape that never had it: a
  // Story-role page's artwork content rect, which SceneEngine has no
  // blueprint for (Story role's _hasScene is always false). Uses
  // _holderRectFor so the placeholder sits exactly where the real
  // picture will land, inside the frame's own mat/padding insets.
  // Unlike _drawSceneImageHolder's hardcoded white, this takes an
  // explicit chromeColor (the same wall-tone luminance check already
  // used for Handle/Page Number text) — a light Frame Variation's wall
  // (Museum Gallery's own "Classic White") would make a white dashed
  // line invisible.
  function _drawArtworkPlaceholder(panelRect,border,chromeColor){
    const rect=_holderRectFor(panelRect,border);
    const color=chromeColor||'#FFFFFF';
    x.save();
    x.globalAlpha=0.06;
    x.fillStyle=color;
    x.fillRect(rect.x,rect.y,rect.w,rect.h);
    x.globalAlpha=0.40;
    x.strokeStyle=color;
    x.lineWidth=3;
    x.setLineDash([12,8]);
    x.strokeRect(rect.x,rect.y,rect.w,rect.h);
    x.setLineDash([]);
    x.globalAlpha=0.70;
    x.fillStyle=color;
    x.font='bold 26px sans-serif';
    x.textAlign='center';
    x.textBaseline='middle';
    x.fillText('Tap to add your artwork',rect.x+rect.w/2,rect.y+rect.h/2);
    x.restore();
  }

  // Sprint 6.2 — Image Holder. Sprint 6.3.1: routed through ImageViewEngine
  // so Cover / Hook / End use the SAME view model (mode / zoom / panX / panY)
  // as Story. When the page has no image, paints a dashed placeholder so
  // the user sees the slot. The blueprint's `fit` ('cover' / 'contain')
  // seeds the default view mode but the user's `s.imageView.mode` wins.
  function _drawSceneImageHolder(s,el){
    const pos=el.position||{x:_viewportW/2,y:_viewportH/2};
    const size=el.size||{w:600,h:600};
    const rx=pos.x-size.w/2, ry=pos.y-size.h/2;
    const img=s.image;
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    // Sprint 6.6.1 — Frame Designer rotation. Rotate around the holder
    // centre so the user's spin reads naturally and the image inside
    // stays anchored to the frame.
    if(el.rotation){
      x.translate(pos.x,pos.y);
      x.rotate((el.rotation||0)*Math.PI/180);
      x.translate(-pos.x,-pos.y);
    }
    if(!img || !img.width){
      x.fillStyle='rgba(255,255,255,0.06)';
      x.fillRect(rx,ry,size.w,size.h);
      x.strokeStyle='rgba(255,255,255,0.40)';
      x.lineWidth=3;
      x.setLineDash([12,8]);
      x.strokeRect(rx,ry,size.w,size.h);
      x.setLineDash([]);
      x.fillStyle='rgba(255,255,255,0.70)';
      x.font='bold 28px sans-serif';
      x.textAlign='center';
      x.textBaseline='middle';
      x.fillText('Add an image',pos.x,pos.y);
      x.restore();
      return;
    }
    // Sprint 6.5 — Picture Border applies to scene image holders too, so
    // the same UI controls Story / Cover / Hook / End. Sprint 6.5.1 —
    // design dispatch + asymmetric insets + Cloud clip work identically
    // here.
    const border=_resolveBorder(s);
    const outerRect={x:rx,y:ry,w:size.w,h:size.h};
    const insets=border ? _getDesignInsets(border) : null;
    const pad=border ? border.padding : 0;
    const innerRect=border ? {
      x:rx+insets.left, y:ry+insets.top,
      w:Math.max(1,size.w-insets.left-insets.right),
      h:Math.max(1,size.h-insets.top-insets.bottom)
    } : {x:rx, y:ry, w:size.w, h:size.h};
    if(border){
      _drawPictureFrameFill(outerRect,border,_theme(s),s);
      _drawArtworkPresentation(outerRect,border);
    }
    // Resolve the view: user's s.imageView wins; blueprint `fit` seeds
    // the default mode ('cover' → 'fill', 'contain' → 'fit').
    const seedMode=el.fit==='contain' ? 'fit' : 'fill';
    const raw=s.imageView ? Object.assign({mode:seedMode},s.imageView) : {mode:seedMode};
    if(typeof ImageViewEngine!=='undefined'){
      if(border){
        // Apply a concentric round-rect (or cloud) clip so the image
        // follows the frame's silhouette, then hand off to the View
        // Engine for the actual image draw.
        const innerRadius=Math.max(0,(border.cornerRadius||0)-pad);
        x.save();
        if(border.design==='cloud'){
          _cloudPath(innerRect.x,innerRect.y,innerRect.w,innerRect.h);
        }else if(innerRadius>0){
          _picturePath(innerRect.x,innerRect.y,innerRect.w,innerRect.h,innerRadius);
        }else{
          x.beginPath();
          x.rect(innerRect.x,innerRect.y,innerRect.w,innerRect.h);
        }
        x.clip();
        ImageViewEngine.drawInto(x,img,innerRect,raw);
        x.restore();
      }else{
        ImageViewEngine.drawInto(x,img,outerRect,raw);
      }
    }else{
      // Defensive fallback — should never run because the script is loaded first.
      const iw=img.width, ih=img.height;
      const targetRect=border?innerRect:outerRect;
      const base=seedMode==='fit' ? Math.min(targetRect.w/iw,targetRect.h/ih) : Math.max(targetRect.w/iw,targetRect.h/ih);
      const dw=iw*base, dh=ih*base;
      const dx=targetRect.x+targetRect.w/2-dw/2, dy=targetRect.y+targetRect.h/2-dh/2;
      x.beginPath(); x.rect(targetRect.x,targetRect.y,targetRect.w,targetRect.h); x.clip();
      x.drawImage(img,dx,dy,dw,dh);
    }
    if(border){
      _drawPictureFrameOrnament(outerRect,border,_theme(s));
      _drawPictureFrameStroke(outerRect,border);
    }
    x.restore();
  }
  // Sprint 6.6 — Stickers. The catalog hands us an SVG; we cache an
  // `Image` per sticker id so the renderer can call `drawImage` directly.
  // While the image is still decoding the renderer falls back to drawing
  // the sticker's emoji glyph so children always see something (and the
  // canvas refreshes once the image fires its `onload`).
  const _stickerImgCache={};
  function _ensureStickerImage(stickerId,onReady){
    if(!stickerId) return null;
    if(_stickerImgCache[stickerId]) return _stickerImgCache[stickerId];
    if(typeof StickerLibrary==='undefined') return null;
    const url=StickerLibrary.getDataURL(stickerId);
    if(!url) return null;
    const img=new Image();
    img.onload=function(){
      img.__ready=true;
      if(typeof onReady==='function') onReady(img);
      // Nudge the editor to repaint once the decode lands so children
      // never see a blank slot for more than a frame.
      if(typeof window!=='undefined' && typeof window.redrawPreview==='function'){
        try{ window.redrawPreview(); }catch(_){}
      }
    };
    img.src=url;
    _stickerImgCache[stickerId]=img;
    return img;
  }
  // Recolorable stickers ("Colour This") — color emoji glyphs render via
  // the browser's own built-in COLR/CBDT colour-font tables, which ignore
  // CSS/canvas fillStyle entirely, so a literal per-region recolor isn't
  // possible for the library's existing 500+ glyph-based stickers. This
  // is the "Auto Duotone" technique instead: read the glyph's own
  // light/dark pixels (via getImageData) and split them into a Body tone
  // + a Shade tone by luminance, plus a dilated Outline ring stamped from
  // the same alpha shape — preserving some of the glyph's own shape
  // detail rather than flattening it to one flat silhouette colour.
  // Works automatically on every existing sticker/decoration/shape with
  // zero new artwork, since they're all the same catalog entry shape.
  const _stickerRecolorCache={};
  const _stickerRecolorDataURLCache={};
  const RECOLOR_SIZE=256;
  const RECOLOR_OUTLINE_WIDTH=Math.round(RECOLOR_SIZE*0.035);
  function _hexToRgb(hex){
    if(!hex) return null;
    const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(!m) return null;
    return {r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)};
  }
  function _buildRecoloredStickerCanvas(stickerId,bodyColor,shadeColor,outlineColor){
    if(!stickerId) return null;
    const srcImg=_ensureStickerImage(stickerId);
    if(!srcImg || !srcImg.__ready) return null;
    const size=RECOLOR_SIZE;
    const glyph=document.createElement('canvas');
    glyph.width=size; glyph.height=size;
    glyph.getContext('2d').drawImage(srcImg,0,0,size,size);

    // Outline layer — stamp the glyph's own alpha shape in a ring of
    // offsets (radius = outline width), then flatten the union to
    // outlineColor via source-atop compositing.
    const outline=document.createElement('canvas');
    outline.width=size; outline.height=size;
    const o=outline.getContext('2d');
    const steps=16;
    for(let i=0;i<steps;i++){
      const ang=(i/steps)*Math.PI*2;
      o.drawImage(glyph,Math.cos(ang)*RECOLOR_OUTLINE_WIDTH,Math.sin(ang)*RECOLOR_OUTLINE_WIDTH);
    }
    o.globalCompositeOperation='source-atop';
    o.fillStyle=outlineColor||'#1D3457';
    o.fillRect(0,0,size,size);

    // Fill layer — Auto Duotone: recolor each opaque pixel into the Body
    // tone or the Shade tone based on its own original luminance.
    const fill=document.createElement('canvas');
    fill.width=size; fill.height=size;
    const f=fill.getContext('2d');
    f.drawImage(glyph,0,0);
    const bodyRgb=_hexToRgb(bodyColor)||{r:224,g:67,b:43};
    const shadeRgb=_hexToRgb(shadeColor)||{r:138,g:31,b:16};
    const imgData=f.getImageData(0,0,size,size);
    const d=imgData.data;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]===0) continue;
      const lum=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      const t=lum>150 ? bodyRgb : shadeRgb;
      d[i]=t.r; d[i+1]=t.g; d[i+2]=t.b;
    }
    f.putImageData(imgData,0,0);

    const out=document.createElement('canvas');
    out.width=size; out.height=size;
    const c=out.getContext('2d');
    c.drawImage(outline,0,0);
    c.drawImage(fill,0,0);
    return out;
  }
  function _recolorKey(st){
    return st.stickerId+'|'+(st.bodyColor||'')+'|'+(st.shadeColor||'')+'|'+(st.outlineColor||'');
  }
  function _recoloredStickerCanvas(st){
    if(!st || !st.stickerId) return null;
    const key=_recolorKey(st);
    if(_stickerRecolorCache[key]) return _stickerRecolorCache[key];
    const canvas=_buildRecoloredStickerCanvas(st.stickerId,st.bodyColor,st.shadeColor,st.outlineColor);
    // Only cache a real result — the source glyph image may still be
    // decoding, and _ensureStickerImage's own onload already triggers a
    // repaint once it's ready, so the next render() naturally retries.
    if(canvas) _stickerRecolorCache[key]=canvas;
    return canvas;
  }
  function _recoloredStickerDataURL(st){
    const key=_recolorKey(st);
    if(_stickerRecolorDataURLCache[key]) return _stickerRecolorDataURLCache[key];
    const canvas=_recoloredStickerCanvas(st);
    if(!canvas) return null;
    const url=canvas.toDataURL('image/png');
    _stickerRecolorDataURLCache[key]=url;
    return url;
  }
  // Real vector Shapes (kind:'shape' sticker instances) — a Story
  // Author's own Personalize capability ("outline shapes, geometry
  // shapes, free style shapes"). Reuses _layerDrawShape (built for
  // World-owned Layer Pack decorations) verbatim rather than
  // reimplementing geometry — a Shape instance's own fields (shape/
  // fillColor/strokeColor/strokeWidth/fillOpacity/strokeOpacity/
  // customPath) already match _layerDrawShape's own `d` parameter names.
  function _drawSceneShape(st){
    if(!st) return;
    const w=typeof st.w==='number'?st.w:240;
    const h=typeof st.h==='number'?st.h:240;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const rect={x:cx-w/2,y:cy-h/2,w:w,h:h};
    if(st.shape==='custom' && Array.isArray(st.customStrokes) && st.customStrokes.length){
      _drawCustomStrokeShape(rect,st.customStrokes,{
        fillColor:st.fillColor, fillOpacity:st.fillOpacity,
        strokeColor:st.strokeColor, strokeOpacity:st.strokeOpacity, strokeWidth:st.strokeWidth,
        fillEnabled:st.fillEnabled,
        fillMode:st.fillMode, paintStrokes:st.paintStrokes,
        rotation:typeof st.rotation==='number'?st.rotation:0,
        alpha:typeof st.opacity==='number'?Math.max(0,Math.min(1,st.opacity)):1
      });
      return;
    }
    _layerDrawShape({
      shape:st.shape||'circle',
      fillColor:st.fillColor,
      strokeColor:st.strokeColor,
      strokeWidth:st.strokeWidth,
      fillOpacity:st.fillOpacity,
      strokeOpacity:st.strokeOpacity,
      fillEnabled:st.fillEnabled,
      fillMode:st.fillMode, paintStrokes:st.paintStrokes,
      rotation:typeof st.rotation==='number'?st.rotation:0,
      alpha:typeof st.opacity==='number'?Math.max(0,Math.min(1,st.opacity)):1,
      customPath:st.customPath
    },rect);
  }
  function _shapeBbox(st){
    const w=typeof st.w==='number'?st.w:240;
    const h=typeof st.h==='number'?st.h:240;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const kindInfo=(typeof StickerLibrary!=='undefined' && typeof StickerLibrary.getShapeKind==='function') ? StickerLibrary.getShapeKind(st.shape) : null;
    return {
      id:st.id,
      type:'sticker',
      label:kindInfo?kindInfo.label:'Shape',
      bx:cx-w/2, by:cy-h/2, bw:w, bh:h,
      visible:true,
      locked:!!st.locked,
      visual:{
        kind:'shape', shape:st.shape,
        fillColor:st.fillColor, strokeColor:st.strokeColor, strokeWidth:st.strokeWidth,
        fillOpacity:st.fillOpacity, strokeOpacity:st.strokeOpacity, fillEnabled:st.fillEnabled,
        fillMode:st.fillMode, paintStrokes:st.paintStrokes,
        rotation:typeof st.rotation==='number'?st.rotation:0,
        customPath:st.customPath, customStrokes:st.customStrokes
      }
    };
  }

  // Freeform Text (kind:'text' sticker instances) — a Story Author's own
  // Personalize capability. No existing per-instance draggable text
  // drawer to reuse (confirmed by investigation) — built new here,
  // pattern-matching _drawSceneSticker's own transform handling and
  // reusing the existing _wrapText word-wrap utility (already measures
  // against whatever font is currently set on the canvas context).
  // Canvas ctx.font= draws are synchronous with no font-loading
  // awareness anywhere else in this file — _ensureCanvasFont closes that
  // gap for a newly-added webfont the same way _ensureStickerImage
  // already does for a still-decoding sticker image: request once,
  // redraw once ready, never block the current paint.
  //
  // Named _drawFreeformText (not _drawSceneText) deliberately — a real,
  // separate _drawSceneText(s,el) already exists above (~line 2700) for
  // a Scene-blueprint text element; the two were shipped as an accidental
  // same-name pair (JS's last-declaration-wins let the newer one silently
  // shadow the older one), caught during the Doodle follow-up work below
  // rather than at ship time since the older function's own call site
  // (el.type==='text') is presently unreachable dead code — no blueprint
  // anywhere actually creates a type:'text' element (only 'text-holder'
  // is real) — but the collision itself was still a real bug, fixed here.
  const _canvasFontsRequested={};
  // A font family can be requested at more than one weight (a normal
  // freeform Text object vs. one explicitly set Bold) — check()/load()
  // both key off the CSS <font> shorthand's own weight, and Chrome
  // treats each declared @font-face weight as its own, separately
  // loadable face. Checking at one weight (e.g. the shorthand's
  // implicit "normal"/400) never reports "ready" for a face that was
  // only ever *loaded* at a different weight (e.g. a hardcoded 700) —
  // found and fixed while wiring up preloadFonts() below, since the
  // original bold-only load call silently never satisfied a normal-
  // weight Text object's own check, in the editor as much as Publish.
  function _ensureCanvasFont(fontFamily, weight){
    if(!fontFamily || typeof document==='undefined' || !document.fonts) return;
    const w=weight||'400';
    const key=fontFamily+'|'+w;
    if(_canvasFontsRequested[key]) return;
    let ready=true;
    try{ ready=document.fonts.check(w+' 16px '+fontFamily); }catch(e){ ready=true; }
    if(ready) return;
    _canvasFontsRequested[key]=true;
    try{
      document.fonts.load(w+' 16px '+fontFamily).then(function(){
        if(typeof window!=='undefined' && typeof window.redrawPreview==='function'){
          try{ window.redrawPreview(); }catch(_){}
        }
      }).catch(function(){});
    }catch(e){}
  }
  // Rule 5 (Publish Fidelity) — _ensureCanvasFont's own "not ready yet,
  // redraw once it is" callback only ever redraws the LIVE editor canvas
  // (window.redrawPreview) — exactly right for the editor, but useless
  // for a one-shot Publish export, since document.fonts.load() is async
  // and a synchronous render() call never waits for it: a freeform Text
  // object using a custom font (Handwriting/Kid Friendly) can silently
  // render in the browser's fallback font in an export that's never
  // redrawn again. preloadFonts(s) lets a caller genuinely await every
  // custom font family a Slide's own freeform Text stickers reference
  // before calling render() — Publish's own render call sites use this;
  // the live editor canvas still relies on _ensureCanvasFont's existing
  // request-once/redraw-later path, unchanged.
  function _fontFacesFor(s){
    const faces=[];
    const seen={};
    const stickers=(s && s.metadata && s.metadata.stickers) || [];
    stickers.forEach(function(st){
      if(st && st.kind==='text' && st.fontFamily){
        const weight=st.fontWeight||'400';
        const key=st.fontFamily+'|'+weight;
        if(!seen[key]){ seen[key]=true; faces.push({family:st.fontFamily, weight:weight}); }
      }
    });
    return faces;
  }
  function preloadFonts(s){
    if(typeof document==='undefined' || !document.fonts) return Promise.resolve();
    const faces=_fontFacesFor(s);
    if(!faces.length) return Promise.resolve();
    const jobs=faces.map(function(face){
      let ready=true;
      try{ ready=document.fonts.check(face.weight+' 16px '+face.family); }catch(e){ ready=true; }
      if(ready) return Promise.resolve();
      let p;
      try{ p=document.fonts.load(face.weight+' 16px '+face.family); }catch(e){ p=null; }
      return p ? p.catch(function(){}) : Promise.resolve();
    });
    return Promise.all(jobs);
  }
  function _textFontString(st,size){
    const style=(st.fontStyle==='italic')?'italic ':'';
    const weight=st.fontWeight?st.fontWeight+' ':'';
    return style+weight+size+'px '+(st.fontFamily||'Georgia, serif');
  }
  function _drawFreeformText(st){
    if(!st) return;
    const text=typeof st.text==='string'?st.text:'';
    const size=typeof st.fontSize==='number'?st.fontSize:44;
    const w=typeof st.w==='number'?st.w:420;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const align=(st.align==='left'||st.align==='right')?st.align:'center';
    _ensureCanvasFont(st.fontFamily, st.fontWeight);
    x.save();
    x.globalAlpha=typeof st.opacity==='number' ? Math.max(0,Math.min(1,st.opacity)) : 1;
    x.translate(cx,cy);
    if(st.rotation) x.rotate((st.rotation||0)*Math.PI/180);
    x.font=_textFontString(st,size);
    x.fillStyle=st.color||'#1D3457';
    x.textAlign=align;
    x.textBaseline='middle';
    const lines=text?_wrapText(text,w):[];
    const lineHeight=Math.round(size*1.25);
    const totalH=lines.length*lineHeight;
    let ty=-totalH/2+lineHeight/2;
    const tx=(align==='left')?-w/2:(align==='right')?w/2:0;
    // "add bold, underline and strike through styles" — the Bold half
    // already rides the existing st.fontWeight field (_textFontString
    // above already applies any weight, including '700'); Underline/
    // Strikethrough have no native canvas text-decoration, so they're
    // drawn the identical way _layerDrawText already does it for a
    // World-owned Text object (a manually-stroked line per wrapped line,
    // matching THAT line's own measured width, not the shared wrap
    // width) — reused rather than reinvented, just against this
    // function's own fixed textBaseline='middle' (_layerDrawText varies
    // its baseline approximation per vAlign; a freeform sticker only
    // ever centers vertically, so only that one case is needed here).
    const hasUnderline=!!st.underline, hasStrikethrough=!!st.strikethrough;
    // "what do we call this kind of fonts" — the same Fill Style choice
    // as a World-owned Text object (_layerDrawText), just a plain
    // instance boolean here since a Story-owned sticker has no
    // Theme-authored base to fall back to. Solid (the original, fully
    // unchanged loop below) vs. Shapes (the shared geometric-mosaic
    // fill, clipped to the real glyph shapes, reusing the exact
    // _drawShapeMosaicTextBlock/_drawTextLineDecoration helpers
    // _layerDrawText already established).
    const shapeFillOn=!!st.shapeFill;
    // Bug G Rework — Curve Style (None/Arc/Wave/Circle) + amount.
    // Story-owned sticker reads its own top-level fields directly (no
    // ov/t precedence — a sticker instance IS its own store). Backward
    // compat: a legacy sticker authored before Curve Style existed but
    // carrying a nonzero curve is treated as 'arc' by _drawStyledTextLine,
    // matching the original Bug G behaviour byte-for-byte.
    const textCurve=typeof st.curve==='number'?st.curve:0;
    const curveStyle=(typeof st.curveStyle==='string')?st.curveStyle:(textCurve?'arc':'none');
    const isCurvedActive = curveStyle && curveStyle!=='none' && (curveStyle==='circle' || textCurve!==0);
    // Shared line-draw dispatcher used by both the shape-mosaic drawTextFn
    // (below) AND the plain-fill else branch, so Shape-Mosaic Fill now
    // honours Curve Style too (mirroring the same _layerDrawText fix
    // this same rework applied to the World-owned Text path).
    const drawStyledLine=function(targetCtx,line,lineY,isStroke){
      if(!isCurvedActive){
        if(isStroke) targetCtx.strokeText(line,tx,lineY);
        else targetCtx.fillText(line,tx,lineY);
        return;
      }
      let cxCurve=tx;
      const lw=targetCtx.measureText(line).width;
      if(align==='left') cxCurve=tx+lw/2;
      else if(align==='right') cxCurve=tx-lw/2;
      const drew=_drawStyledTextLine(targetCtx,line,cxCurve,lineY,curveStyle,textCurve,isStroke?'stroke':'fill');
      if(!drew){
        if(isStroke) targetCtx.strokeText(line,tx,lineY);
        else targetCtx.fillText(line,tx,lineY);
      }
    };
    if(shapeFillOn){
      let maxLineWidth=0;
      lines.forEach(function(line){ const lw=x.measureText(line).width; if(lw>maxLineWidth) maxLineWidth=lw; });
      let bx=tx-maxLineWidth/2;
      if(align==='left') bx=tx; else if(align==='right') bx=tx-maxLineWidth;
      const fontStr=x.font;
      const drawTextFn=function(targetCtx,isStroke){
        targetCtx.font=fontStr;
        targetCtx.textAlign=align;
        targetCtx.textBaseline='middle';
        let localTy=-totalH/2+lineHeight/2;
        lines.forEach(function(line){
          if(isStroke){
            targetCtx.strokeStyle='#FFFFFF';
            targetCtx.lineWidth=Math.max(1.5,size*0.05);
          } else {
            targetCtx.fillStyle='#000000';
          }
          drawStyledLine(targetCtx,line,localTy,isStroke);
          localTy+=lineHeight;
        });
      };
      // Bug G Rework — expand the mask/pattern bbox generously when a
      // curved style is active (arc adds sagitta bulge; wave adds
      // ±amplitude; circle becomes a 2*radius square). Same math as
      // _layerDrawText's own equivalent expansion.
      let mbx=bx, mby=-totalH/2, mbw=maxLineWidth, mbh=totalH;
      if(isCurvedActive){
        if(curveStyle==='arc'){
          const arcRad=Math.abs((textCurve||0)*Math.PI/180);
          const radius=maxLineWidth/Math.max(0.001,arcRad);
          const bulge=Math.abs(radius*(1-Math.cos(arcRad/2)));
          mbh+=bulge+size;
          if((textCurve||0)<0) mby-=bulge;
        } else if(curveStyle==='wave'){
          const amp=Math.abs(textCurve||0)*0.3;
          mbh+=amp*2+size*0.3;
          mby-=amp;
        } else if(curveStyle==='circle'){
          const cr=maxLineWidth/(2*Math.PI);
          const diameter=2*cr+size*1.2;
          mbx=tx-diameter/2;
          mby=-diameter/2;
          mbw=diameter;
          mbh=diameter;
        }
      }
      _drawShapeMosaicTextBlock(x,mbx,mby,mbw,mbh,drawTextFn);
      if(hasUnderline||hasStrikethrough){
        let localTy=-totalH/2+lineHeight/2;
        lines.forEach(function(line){
          _drawTextLineDecoration(x,line,localTy,'middle',align,tx,size,'#22252b',hasUnderline,hasStrikethrough);
          localTy+=lineHeight;
        });
      }
    } else {
      // Bug G Rework — one dispatch for all four styles (None/Arc/Wave/
      // Circle). Underline/strikethrough drawn straight even when
      // curved — a curved baseline decoration would need per-char
      // stroke segments; disclosed as out of scope, matching Bug G's
      // own original scope.
      lines.forEach(function(line){
        drawStyledLine(x,line,ty,false);
        if(hasUnderline || hasStrikethrough){
          const lw=x.measureText(line).width;
          let lsx=tx-lw/2, lex=tx+lw/2;
          if(align==='left'){ lsx=tx; lex=tx+lw; }
          else if(align==='right'){ lsx=tx-lw; lex=tx; }
          const baselineY=ty+size*0.3;
          x.save();
          x.strokeStyle=x.fillStyle;
          x.lineWidth=Math.max(1,size*0.06);
          if(hasUnderline){
            const uy=baselineY+size*0.08;
            x.beginPath(); x.moveTo(lsx,uy); x.lineTo(lex,uy); x.stroke();
          }
          if(hasStrikethrough){
            const sy=baselineY-size*0.3;
            x.beginPath(); x.moveTo(lsx,sy); x.lineTo(lex,sy); x.stroke();
          }
          x.restore();
        }
        ty+=lineHeight;
      });
    }
    x.restore();
  }
  function _textLineMetrics(st){
    const text=typeof st.text==='string'?st.text:'';
    const size=typeof st.fontSize==='number'?st.fontSize:44;
    const w=typeof st.w==='number'?st.w:420;
    x.save();
    x.font=_textFontString(st,size);
    const lines=text?_wrapText(text,w):[];
    x.restore();
    return {count:Math.max(1,lines.length), lineHeight:Math.round(size*1.25)};
  }
  function _textObjBbox(st){
    const w=typeof st.w==='number'?st.w:420;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const m=_textLineMetrics(st);
    const h=m.count*m.lineHeight;
    const text=typeof st.text==='string'?st.text:'';
    const snippet=text.length>18?text.slice(0,18)+'…':text;
    return {
      id:st.id,
      type:'sticker',
      label:'Text',
      bx:cx-w/2, by:cy-h/2, bw:w, bh:h,
      visible:true,
      locked:!!st.locked,
      visual:{kind:'text',content:text,snippet:snippet||'Text'}
    };
  }

  // Doodle (kind:'doodle' sticker instances) — a genuine multi-stroke
  // freehand drawing capability. Direct product feedback: the Shape
  // system's "Draw Your Own" custom-path pad ("this is just filling
  // shape, it does not allow you to draw irregular shape... this has
  // potential to become doodle") captured exactly one stroke and always
  // force-closed + filled it into a blob — real line art (a stick
  // figure, a squiggle) needs several separate, unclosed strokes drawn
  // one after another. Doodle is that: st.strokes is an array of
  // {points:[{x,y}...],color,width}, each point 0..1 fractional within
  // the doodle's own w/h box, one entry per pen-down..pen-up gesture on
  // the Refine panel's Draw pad — a doodle can freely mix several
  // strokes and several pen colours/widths in one drawing. Deliberately
  // a distinct object kind from Shape rather than an in-place upgrade of
  // "Draw Your Own" (a direct product decision) — Shape's own custom
  // path stays a single closed, fillable silhouette; Doodle is unclosed,
  // stroke-only, multi-stroke line art with its own Add Something entry.
  // Coloring Kit -- Crayon/Pastel/Brush stroke rendering, hand-mirrored
  // from js/cardDesigner.js's own _drawDoodleStrokeOnCtx/_doodleBrushTaper
  // (the two files have no shared module to route through, matching this
  // codebase's established Shape-pad/real-renderer duplication
  // discipline). A stroke with no `medium` field (every doodle drawn
  // before this feature shipped) always renders through the final
  // `else` branch below, byte-identical to the original algorithm --
  // guaranteeing zero visual regression for already-authored content.
  function _doodleBrushTaper(t){
    if(t<0.15) return 0.35+(t/0.15)*0.65;
    if(t>0.85) return 0.35+((1-t)/0.15)*0.65;
    return 1;
  }
  // A deterministic (never Math.random -- so a Spray stroke renders
  // identically on every redraw) GLSL-style sine hash, seeded by two
  // plain integers -- used to scatter Spray's own dots around each stroke
  // point without ever storing the scatter itself, only the stroke's
  // real points. Mirrors js/cardDesigner.js's own _sprayHash exactly.
  function _sprayHash(i,k){
    const v=Math.sin(i*12.9898+k*78.233)*43758.5453;
    return v-Math.floor(v);
  }
  function _drawDoodleStrokeOnCtx(points,rect,color,width,medium,baseAlpha){
    const mapPt=function(p){ return {x:rect.x+p.x*rect.w, y:rect.y+p.y*rect.h}; };
    const col=color||'#24406B';
    const w=typeof width==='number'?width:6;
    if(medium==='pastel'){
      x.save();
      x.globalAlpha=baseAlpha*0.55;
      x.shadowColor=col;
      x.shadowBlur=w*1.1;
      x.strokeStyle=col;
      x.lineWidth=Math.max(1,w*0.85);
      x.beginPath();
      points.forEach(function(p,i){ const m=mapPt(p); if(i===0) x.moveTo(m.x,m.y); else x.lineTo(m.x,m.y); });
      x.stroke();
      x.restore();
    }else if(medium==='brush'){
      x.save();
      x.globalAlpha=baseAlpha;
      x.strokeStyle=col;
      const n=points.length;
      for(let i=0;i<n-1;i++){
        const t=i/Math.max(1,n-1);
        x.lineWidth=Math.max(1,w*_doodleBrushTaper(t));
        const p1=mapPt(points[i]), p2=mapPt(points[i+1]);
        x.beginPath();
        x.moveTo(p1.x,p1.y);
        x.lineTo(p2.x,p2.y);
        x.stroke();
      }
      x.restore();
    }else if(medium==='crayon'){
      x.save();
      const passes=[{dx:0,dy:0,ws:1,as:0.55},{dx:1,dy:-1,ws:0.85,as:0.32},{dx:-1,dy:1,ws:0.7,as:0.28}];
      passes.forEach(function(pass){
        x.globalAlpha=baseAlpha*pass.as;
        x.strokeStyle=col;
        x.lineWidth=Math.max(1,w*pass.ws);
        x.beginPath();
        points.forEach(function(p,i){
          const m=mapPt(p);
          const px=m.x+pass.dx, py=m.y+pass.dy;
          if(i===0) x.moveTo(px,py); else x.lineTo(px,py);
        });
        x.stroke();
      });
      x.restore();
    }else if(medium==='spray'){
      // Airy, textured, airbrush-like -- a deterministic scatter of small
      // dots around each point along the stroke (via _sprayHash, never
      // Math.random) instead of a continuous line, mimicking a real spray
      // can's own speckled coverage.
      x.save();
      x.fillStyle=col;
      const dotsPerPoint=5;
      const radius=Math.max(4,w*1.4);
      points.forEach(function(p,i){
        const m=mapPt(p);
        for(let k=0;k<dotsPerPoint;k++){
          const h1=_sprayHash(i,k), h2=_sprayHash(i+1000,k);
          const angle=h1*Math.PI*2;
          const dist=h2*radius;
          const dotR=Math.max(0.6,w*0.09*(0.5+h1));
          x.globalAlpha=baseAlpha*(0.28+0.35*h2);
          x.beginPath();
          x.arc(m.x+Math.cos(angle)*dist, m.y+Math.sin(angle)*dist, dotR, 0, Math.PI*2);
          x.fill();
        }
      });
      x.restore();
    }else{
      x.globalAlpha=baseAlpha;
      x.beginPath();
      points.forEach(function(p,i){ const m=mapPt(p); if(i===0) x.moveTo(m.x,m.y); else x.lineTo(m.x,m.y); });
      x.lineWidth=w;
      x.strokeStyle=col;
      x.stroke();
    }
  }
  function _drawDoodleStrokes(strokes,rect,alpha){
    if(!Array.isArray(strokes) || !strokes.length) return;
    x.save();
    x.lineCap='round';
    x.lineJoin='round';
    const a=(typeof alpha==='number')?Math.max(0,Math.min(1,alpha)):1;
    strokes.forEach(function(s){
      if(!s || !Array.isArray(s.points) || s.points.length<2) return;
      _drawDoodleStrokeOnCtx(s.points,rect,s.color,s.width,s.medium,a);
    });
    x.restore();
  }
  function _drawSceneDoodle(st){
    if(!st) return;
    const w=typeof st.w==='number'?st.w:320;
    const h=typeof st.h==='number'?st.h:320;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const rect={x:cx-w/2,y:cy-h/2,w:w,h:h};
    const rotation=(typeof st.rotation==='number')?st.rotation:0;
    const alpha=typeof st.opacity==='number'?Math.max(0,Math.min(1,st.opacity)):1;
    // BACKLOG.md: "leakage from doodle sketch area to outside area" — a
    // stroke's own pen width (especially a wide/round-capped one drawn
    // near the object's own edge) can paint pixels outside the doodle's
    // own bounding rect once it lands on the real, much-larger page
    // canvas — unlike the small, dedicated pad canvas element on the
    // Refine panel, which can never "leak" beyond its own element bounds
    // (a browser fundamental), this real render has no such natural
    // boundary. Clipped to a Path2D rect, inside the same rotation
    // transform so the clip rotates along with the drawing — mirroring
    // the exact x.save(); x.clip(path); ...; x.restore(); idiom already
    // proven in _paintShapePathTail for Shape's own Paint Inside fill.
    const clipPath=new Path2D();
    clipPath.rect(rect.x,rect.y,rect.w,rect.h);
    x.save();
    if(rotation){
      x.translate(cx,cy); x.rotate(rotation*Math.PI/180); x.translate(-cx,-cy);
    }
    x.clip(clipPath);
    _drawDoodleStrokes(st.strokes,rect,alpha);
    x.restore();
  }
  function _doodleBbox(st){
    const w=typeof st.w==='number'?st.w:320;
    const h=typeof st.h==='number'?st.h:320;
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    return {
      id:st.id,
      type:'sticker',
      label:'Doodle',
      bx:cx-w/2, by:cy-h/2, bw:w, bh:h,
      visible:true,
      locked:!!st.locked,
      visual:{kind:'doodle', strokes:st.strokes, rotation:typeof st.rotation==='number'?st.rotation:0}
    };
  }

  // Collection ("From This World") — a Story Author's own Personalization
  // capability, Collection Phase 6: picking one of a World's own
  // availableToCreator Collection assets creates an ordinary new Story-
  // owned Decoration sticker, matching exactly how Shapes/Text/Doodle
  // above already work — the fourth genuinely new sticker `kind`, this
  // time carrying real Theme-authored artwork rather than a vector/text/
  // stroke payload. `st.image` is deliberately a compiled-package
  // relPath (e.g. "collection/<id>.png"), NEVER a raw vihu-asset:/data:
  // reference re-embedded onto the sticker — resolving it live through
  // ThemeRegistry.resolveAssetRef (the exact mechanism a World-owned
  // Decoration Layer's own d.image already resolves through,
  // _layerDrawDecorationImage above) is what keeps a Collection-sourced
  // picture out of the Story's own JSON, preserving Draft Asset
  // Architecture's whole point. Resolved against whichever Theme is
  // currently active (_layoutTheme(s), the same resolution
  // _layerDrawDecorationImage already uses) — a disclosed, narrow edge
  // case for this first cut: if the Story Author later swaps Worlds
  // ("Change Look" onto a different Theme entirely), the reference can
  // no longer resolve and the placeholder glyph below shows instead,
  // exactly like a World-owned object's own art would if its owning
  // Theme's assets ever changed out from under it.
  function _drawStickerImage(st,s){
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const w=typeof st.w==='number'?st.w:260;
    const h=typeof st.h==='number'?st.h:260;
    x.save();
    x.globalAlpha=typeof st.opacity==='number' ? Math.max(0,Math.min(1,st.opacity)) : 1;
    x.translate(cx,cy);
    if(st.rotation) x.rotate((st.rotation||0)*Math.PI/180);
    let src=st.image;
    if(src){
      const theme=_layoutTheme(s);
      const themeId=theme && theme.id;
      if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
        try{ src=ThemeRegistry.resolveAssetRef(themeId,st.image)||st.image; }catch(e){}
      }
    }
    const img=src ? _ensureDecorationImage(src,s&&s.recallOwnerId) : null;
    if(img && img.__ready && img.width && img.height){
      const iw=img.width, ih=img.height;
      const base=Math.min(w/iw,h/ih);
      const dw=iw*base, dh=ih*base;
      x.drawImage(img,-dw/2,-dh/2,dw,dh);
    }else{
      // Placeholder while the image resolves/decodes, or a genuinely
      // stale reference (the disclosed World-swap edge case above) —
      // never a blank/invisible sticker.
      x.fillStyle='rgba(0,0,0,0.08)';
      x.fillRect(-w/2,-h/2,w,h);
      x.font=Math.round(Math.min(w,h)*0.4)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      x.textAlign='center';
      x.textBaseline='middle';
      x.fillText('🖼️',0,0);
    }
    x.restore();
  }

  // Voice note — the fifth sticker kind (Voice MVP Ship 2): a placeable
  // 🔊 badge whose real payload is audio (st.voiceRef, a durable
  // vihu-asset: reference; st.voiceDurationMs the wall-clock length).
  // The badge is all a silent surface can show — a coral disc (matching
  // the Voice panel's own record-button coral) with a white ring and a
  // speaker glyph, so a reader can SEE there's something to tap. Paints
  // in every render, Publish included (Creator Governing Rule #5 —
  // Publish honours the center pane; a printed badge is an honest "this
  // page has sound in Studio" marker, the same way the audio itself is
  // disclosed as Studio-only until Story Reel).
  function _drawSceneVoice(st){
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const w=typeof st.w==='number'?st.w:110;
    const h=typeof st.h==='number'?st.h:110;
    const r=Math.min(w,h)/2;
    x.save();
    x.globalAlpha=typeof st.opacity==='number' ? Math.max(0,Math.min(1,st.opacity)) : 1;
    x.translate(cx,cy);
    if(st.rotation) x.rotate((st.rotation||0)*Math.PI/180);
    x.beginPath();
    x.arc(0,0,r,0,Math.PI*2);
    x.fillStyle='#E67373';
    x.fill();
    x.lineWidth=Math.max(3,r*0.1);
    x.strokeStyle='#FFFFFF';
    x.stroke();
    x.font=Math.round(r)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign='center';
    x.textBaseline='middle';
    x.fillText('🔊',0,r*0.06);
    x.restore();
  }

  function _drawSceneSticker(st,s){
    if(!st) return;
    if(st.kind==='shape'){ _drawSceneShape(st); return; }
    if(st.kind==='text'){ _drawFreeformText(st); return; }
    if(st.kind==='doodle'){ _drawSceneDoodle(st); return; }
    if(st.kind==='image'){ _drawStickerImage(st,s); return; }
    if(st.kind==='voice'){ _drawSceneVoice(st); return; }
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const w=typeof st.w==='number'?st.w:260;
    const h=typeof st.h==='number'?st.h:260;
    x.save();
    x.globalAlpha=typeof st.opacity==='number' ? Math.max(0,Math.min(1,st.opacity)) : 1;
    x.translate(cx,cy);
    if(st.rotation) x.rotate((st.rotation||0)*Math.PI/180);
    const sx=st.flipX?-1:1, sy=st.flipY?-1:1;
    if(sx!==1 || sy!==1) x.scale(sx,sy);
    const recolored=st.recolorEnabled ? _recoloredStickerCanvas(st) : null;
    if(recolored){
      x.drawImage(recolored,-w/2,-h/2,w,h);
    }else{
      const img=_ensureStickerImage(st.stickerId);
      if(img && img.__ready){
        x.drawImage(img,-w/2,-h/2,w,h);
      }else{
        // Fallback while the SVG decodes — emoji glyph at the right size.
        const cat=(typeof StickerLibrary!=='undefined') ? StickerLibrary.getById(st.stickerId) : null;
        const glyph=cat?cat.glyph:'?';
        x.font=Math.round(h*0.7)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        x.textAlign='center';
        x.textBaseline='middle';
        x.fillText(glyph,0,0);
      }
    }
    x.restore();
  }
  function _stickerBbox(st,s){
    if(st.kind==='shape') return _shapeBbox(st);
    if(st.kind==='text') return _textObjBbox(st);
    if(st.kind==='doodle') return _doodleBbox(st);
    const cx=typeof st.x==='number'?st.x:_viewportW/2;
    const cy=typeof st.y==='number'?st.y:_viewportH/2;
    const w=typeof st.w==='number'?st.w:260;
    const h=typeof st.h==='number'?st.h:260;
    // Hit-test uses the AXIS-ALIGNED bbox; rotation tightens later if
    // needed. For a child interaction this is generous, never confusing.
    const bbox={
      id:st.id,
      type:'sticker',
      stickerId:st.stickerId,
      label:st.kind==='image'?'Picture':(st.kind==='voice'?'Voice Note':'Sticker'),
      bx:cx-w/2, by:cy-h/2, bw:w, bh:h,
      visible:true,
      locked:!!st.locked
    };
    if(st.kind==='voice'){
      // Object Strip renders {kind:'glyph'} as a plain text glyph already
      // — zero ObjectStrip changes needed for the 🔊 card.
      bbox.visual={kind:'glyph',glyph:'🔊'};
      return bbox;
    }
    if(st.recolorEnabled){
      const url=_recoloredStickerDataURL(st);
      if(url) bbox.visual={kind:'image',src:url};
    }else if(st.kind==='image' && st.image){
      // Object Strip's own accurate-thumbnail convention — resolve the
      // same way _drawStickerImage does so the card shows the real
      // picture, not a generic icon; ObjectStrip._renderThumb's own
      // vihu-asset:-prefix check is a no-op here since resolveAssetRef
      // already returns a directly-usable src (or the bare relPath
      // unchanged if unresolvable, matching every other image field's
      // established degrade).
      let src=st.image;
      const theme=_layoutTheme(s);
      const themeId=theme && theme.id;
      if(themeId && typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
        try{ src=ThemeRegistry.resolveAssetRef(themeId,st.image)||st.image; }catch(e){}
      }
      bbox.visual={kind:'image',src:src};
    }
    return bbox;
  }

  function _sceneBbox(el){
    const pos=el.position||{x:_viewportW/2,y:_viewportH/2};
    const locked=!!el.locked;
    if(el.type==='background'){
      return {id:el.id,type:el.type,label:el.label||el.id,bx:0,by:0,bw:_viewportW,bh:_viewportH,visible:el.visible!==false,locked:locked};
    }
    if(el.type==='decoration'){
      const size=el.size||{w:64,h:64};
      return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x-size.w/2,by:pos.y-size.h/2,bw:size.w,bh:size.h,visible:el.visible!==false,locked:locked};
    }
    if(el.type==='text' || el.type==='text-holder'){
      const w=(el.size && el.size.w) || 700;
      const h=(el.fontSize||56)+12;
      let bx=pos.x-w/2;
      if(el.alignment==='left') bx=pos.x;
      else if(el.alignment==='right') bx=pos.x-w;
      return {id:el.id,type:el.type,label:el.label||el.id,bx:bx,by:pos.y-(el.fontSize||56),bw:w,bh:h,visible:el.visible!==false,locked:locked};
    }
    if(el.type==='image-holder'){
      const size=el.size||{w:600,h:600};
      return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x-size.w/2,by:pos.y-size.h/2,bw:size.w,bh:size.h,visible:el.visible!==false,locked:locked};
    }
    return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x,by:pos.y,bw:0,bh:0,visible:el.visible!==false,locked:locked};
  }

  // Sprint 6.1 — exposed for canvas drag hit-testing.
  function getSceneElements(){ return _lastSceneElements.slice(); }

  // Returns the most recent text-element bboxes (canvas-pixel coords) so the
  // host can hit-test mouse clicks against them. Each entry:
  //   {id, label, bx, by, bw, bh}
  function getTextElements(){ return _lastTextElements.slice(); }

  function _drawSelectionOutline(e){
    x.save();
    x.strokeStyle='#FFCB45';
    x.lineWidth=4;
    x.setLineDash([12,6]);
    x.strokeRect(e.bx-8, e.by-6, e.bw+16, e.bh+12);
    x.restore();
  }

  // Sprint 6.5 (Object Designer) — resize handles. Eight handles total
  // (four corners + four side midpoints) on the selected scene element's
  // bbox. App.js hit-tests against the same positions to drive resize
  // drag. Option B ("chunky corner grips") bumped this from the original
  // thin-circle radius (12) to a bigger, bolder value — js/app.js's own
  // hit-test slop (_hitTestResizeHandle's `r*1.4`) reads this same
  // constant via getHandleRadius(), so the clickable area widens to match
  // automatically, no separate change needed there.
  const HANDLE_RADIUS=18;
  function _supportsResize(el){
    if(!el || !el.type) return false;
    // Guardrails — an Artwork Place (marked `isPlace`, distinguishing it
    // from a real Cover/Hook/End Scene blueprint image-holder element,
    // which keeps working exactly as below) gets its OWN independent
    // `resizable` permission, checked BEFORE the generic Sprint 8.3
    // `locked` gate below — a Place's `locked` flag only ever reflects
    // its `moveable` permission (see the Place bbox-construction block
    // in render()), so a Place can be resizable without being moveable,
    // or moveable without being resizable; each Theme-Author permission
    // stands alone. Absent `resizable` (every Place authored before this
    // feature), this resolves false — byte-identical to before.
    if(el.isPlace) return !!el.resizable;
    // Sprint 8.3 — Universal Object Consistency. Lock disables resize
    // (and drag) for ANY scene element type. Resize otherwise applies
    // to the Frame (image-holder), decorations, stickers, and text.
    if(el.locked) return false;
    // "honoring the story author can adjust this grid... finalize it
    // for any text object" — a World-owned Text Layer (Museum Caption-
    // style) was the one type excluded here even though Move already
    // worked for it (Honour World-Owned Object Commitments sprint) —
    // `el.locked` above already correctly gates this on the same
    // Theme Author moveable:true permission every other kind uses, so
    // no separate permission check is needed; _layerDrawText below now
    // actually reads the resulting size override, so the grid this
    // adds is never a silent no-op.
    return el.type==='image-holder' || el.type==='decoration' || el.type==='sticker' || el.type==='text';
  }
  function _drawResizeHandles(el){
    const cx1=el.bx, cy1=el.by;
    const cx2=el.bx+el.bw, cy2=el.by+el.bh;
    const mx=el.bx+el.bw/2, my=el.by+el.bh/2;
    const positions=[
      [cx1,cy1],[cx2,cy1],[cx1,cy2],[cx2,cy2],
      [mx,cy1],[mx,cy2],[cx1,my],[cx2,my]
    ];
    // Option B ("chunky corner grips") — bigger, bolder rounded squares
    // in place of the original thin gold circles. These are direct-
    // manipulation handles (drag to resize), so sitting right on the
    // selected object is exactly their job — unlike the action strip,
    // which never renders on canvas at all (see js/selectionActionStrip.js).
    const half=HANDLE_RADIUS;
    const corner=5;
    x.save();
    x.fillStyle='#FFCB45';
    x.strokeStyle='#1D3457';
    x.lineWidth=2.5;
    positions.forEach(function(p){
      const gx=p[0]-half, gy=p[1]-half, gw=half*2, gh=half*2;
      x.beginPath();
      x.moveTo(gx+corner,gy);
      x.arcTo(gx+gw,gy,gx+gw,gy+gh,corner);
      x.arcTo(gx+gw,gy+gh,gx,gy+gh,corner);
      x.arcTo(gx,gy+gh,gx,gy,corner);
      x.arcTo(gx,gy,gx+gw,gy,corner);
      x.closePath();
      x.fill();
      x.stroke();
    });
    x.restore();
  }
  // Guardrails — a selected, moveable Artwork Place's own Move grab-
  // handle: a small circle inset from the Place's top-left corner (kept
  // clear of the picture-pan gesture's own hit area, which is the whole
  // content rect). `PLACE_GRAB_RADIUS`/`PLACE_GRAB_INSET` are shared
  // between the draw call and the exported hit-test query below so they
  // can never drift apart.
  const PLACE_GRAB_RADIUS=14;
  const PLACE_GRAB_INSET=20;
  function _drawPlaceGrabHandle(el){
    const cx=el.bx+PLACE_GRAB_INSET, cy=el.by+PLACE_GRAB_INSET;
    x.save();
    x.fillStyle='#4C8BF5';
    x.strokeStyle='#FFFFFF';
    x.lineWidth=2;
    x.beginPath();
    x.arc(cx,cy,PLACE_GRAB_RADIUS,0,Math.PI*2);
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(cx-7,cy); x.lineTo(cx+7,cy);
    x.moveTo(cx,cy-7); x.lineTo(cx,cy+7);
    x.stroke();
    x.restore();
  }
  // Exposed for canvas hit-testing (js/app.js) — returns the grab-
  // handle's hit-circle for the currently-selected Place, or null when
  // nothing is selected / the selection isn't a moveable Place.
  function getPlaceGrabHandleHitbox(elementId){
    const el=_lastSceneElements.find(function(e){ return e.id===elementId; });
    if(!el || !el.isPlace || !el.moveable || el.locked) return null;
    return {x:el.bx+PLACE_GRAB_INSET, y:el.by+PLACE_GRAB_INSET, r:PLACE_GRAB_RADIUS};
  }
  // Exposed for canvas hit-testing — returns the 8 handle positions for
  // the currently-selected scene element, or [] when nothing is selected.
  function getResizeHandlesFor(elementId){
    const el=_lastSceneElements.find(function(e){ return e.id===elementId; });
    if(!el || !_supportsResize(el)) return [];
    const cx1=el.bx, cy1=el.by;
    const cx2=el.bx+el.bw, cy2=el.by+el.bh;
    const mx=el.bx+el.bw/2, my=el.by+el.bh/2;
    return [
      {pos:'nw', x:cx1, y:cy1},
      {pos:'ne', x:cx2, y:cy1},
      {pos:'sw', x:cx1, y:cy2},
      {pos:'se', x:cx2, y:cy2},
      {pos:'n',  x:mx,  y:cy1},
      {pos:'s',  x:mx,  y:cy2},
      {pos:'w',  x:cx1, y:my},
      {pos:'e',  x:cx2, y:my}
    ];
  }
  function getHandleRadius(){ return HANDLE_RADIUS; }

  const SNAP_DIST=18;
  function _drawDragGuides(el){
    const cx=el.bx+el.bw/2;
    const cy=el.by+el.bh/2;
    x.save();
    x.strokeStyle='#7B9AC8';
    x.lineWidth=1.5;
    x.setLineDash([8,6]);
    x.globalAlpha=Math.abs(cx-_viewportW/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(_viewportW/2,0); x.lineTo(_viewportW/2,_viewportH); x.stroke();
    x.globalAlpha=Math.abs(cy-_viewportH/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(0,_viewportH/2); x.lineTo(_viewportW,_viewportH/2); x.stroke();
    x.restore();
  }

  function _bboxForAnchored(text,anchorX,baselineY,align,size){
    const w=x.measureText(text).width;
    let bx=anchorX;
    if(align==='center') bx=anchorX-w/2;
    else if(align==='right') bx=anchorX-w;
    return { bx:bx, by:baselineY-size, bw:w, bh:size+8 };
  }

  // Resolve effective text style: Card Override → Theme → System Default.
  // Returns the final values used by both drawing and bbox math.
  function _resolveTextStyle(ov,defSize,defFont,defColor,defAlign){
    const pos=ov.position||{};
    return {
      fontSize:(typeof ov.fontSize==='number'&&ov.fontSize>0)?ov.fontSize:defSize,
      fontFamily:ov.fontFamily||defFont,
      fontWeight:ov.fontWeight||'normal',
      fontStyle:ov.fontStyle||'normal',
      color:ov.color||defColor,
      opacity:(typeof ov.opacity==='number'&&isFinite(ov.opacity))?Math.max(0,Math.min(1,ov.opacity)):1,
      letterSpacing:(typeof ov.letterSpacing==='number'&&isFinite(ov.letterSpacing))?ov.letterSpacing:0,
      lineHeight:(typeof ov.lineHeight==='number'&&isFinite(ov.lineHeight)&&ov.lineHeight>0)?ov.lineHeight:1.2,
      alignment:ov.alignment||defAlign,
      offsetX:(typeof pos.offsetX==='number'&&isFinite(pos.offsetX))?pos.offsetX:0,
      offsetY:(typeof pos.offsetY==='number'&&isFinite(pos.offsetY))?pos.offsetY:0
    };
  }

  function _applyTextStyle(st){
    x.fillStyle=st.color;
    const stylePart=st.fontStyle&&st.fontStyle!=='normal'?st.fontStyle+' ':'';
    const weightPart=st.fontWeight&&st.fontWeight!=='normal'?st.fontWeight+' ':'';
    x.font=stylePart+weightPart+st.fontSize+'px '+st.fontFamily;
    try{ x.letterSpacing=st.letterSpacing+'px'; }catch(e){}
    x.textAlign=st.alignment;
    x.globalAlpha=st.opacity;
  }

  function _drawStoryText(s,theme,overrides){
    if(!s.storyBeat) return null;
    // Sprint 5.1 — exposed to Story Designer as the source of truth for
    // overflow detection. Width budget = viewport minus left/right
    // margins (60 each side). Multi-line input also flags overflow
    // because the current renderer draws only the first line.
    // Scene Viewport sprint — computed fresh per call (not a module-
    // parse-time constant) since _viewportW can now vary per Slide.
    const storyMaxWidth=_viewportW-120;
    const ov=overrides['story-text']||{};
    const st=_resolveTextStyle(ov,theme.storyText.size,theme.storyText.font,theme.storyText.color,'left');
    x.save();
    _applyTextStyle(st);
    let drawX=60;
    if(st.alignment==='center') drawX=_viewportW/2;
    else if(st.alignment==='right') drawX=_viewportW-60;
    drawX+=st.offsetX;
    const drawY=100+st.offsetY;
    x.fillText(s.storyBeat,drawX,drawY);
    const w=x.measureText(s.storyBeat).width;
    x.restore();
    let bx=drawX;
    if(st.alignment==='center') bx=drawX-w/2;
    else if(st.alignment==='right') bx=drawX-w;
    const overflow=(w>storyMaxWidth) || (s.storyBeat.indexOf('\n')!==-1);
    return {id:'story-text',label:'Story Text',bx:bx,by:drawY-st.fontSize,bw:w,bh:st.fontSize+8,overflow:overflow,maxWidth:storyMaxWidth};
  }

  // Inner image area inside the panel. Sprint 6.5 — padding is normally
  // 20px (the legacy default) but the Picture Border slider can override
  // it; the renderer adapts so the image always fits inside the styled frame.
  // Sprint 6.5.1 — designs can request asymmetric insets (Polaroid grows
  // the bottom). The image rect is computed from those insets so the
  // identity of the design reads in the layout.
  const DEFAULT_IMG_PAD=20;

  // Multiple Artwork Places Per Page — `imgOverride`/`viewOverride`
  // omitted preserves the exact page-level (Place 1) behaviour below,
  // reading `s.image`/`s.imageView`; when provided (an extra Place's own
  // loaded Image + its own view bag), every line below reads those
  // instead, with no other change to this function's geometry/filter
  // logic.
  function _drawImage(s,border,panelRect,imgOverride,viewOverride,placeId){
    const rect=panelRect||{x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H};
    const insets=border ? _getDesignInsets(border) : {top:DEFAULT_IMG_PAD,right:DEFAULT_IMG_PAD,bottom:DEFAULT_IMG_PAD,left:DEFAULT_IMG_PAD};
    const pad=border ? border.padding : DEFAULT_IMG_PAD;
    const IMG_X=rect.x+insets.left, IMG_Y=rect.y+insets.top;
    const IMG_W=Math.max(1,rect.w-insets.left-insets.right), IMG_H=Math.max(1,rect.h-insets.top-insets.bottom);
    const img=imgOverride||s.image;
    const v=viewOverride||s.imageView||{};
    // Sprint 4.5 — crop / straighten / focal point / image adjustments.
    const focalX=typeof v.focalX==='number' && isFinite(v.focalX) ? Math.max(0,Math.min(1,v.focalX)) : 0.5;
    const focalY=typeof v.focalY==='number' && isFinite(v.focalY) ? Math.max(0,Math.min(1,v.focalY)) : 0.5;
    const crop=v.crop||{};
    const cTop=crop.top||0, cRight=crop.right||0, cBottom=crop.bottom||0, cLeft=crop.left||0;
    const straighten=typeof v.straighten==='number' && isFinite(v.straighten) ? v.straighten : 0;
    // Light / Color / Detail
    const brightness=typeof v.brightness==='number'?v.brightness:0;
    const contrast=typeof v.contrast==='number'?v.contrast:0;
    const highlights=typeof v.highlights==='number'?v.highlights:0;
    const shadows=typeof v.shadows==='number'?v.shadows:0;
    const warmth=typeof v.warmth==='number'?v.warmth:0;
    const saturation=typeof v.saturation==='number'?v.saturation:0;
    const sharpness=typeof v.sharpness==='number'?v.sharpness:0;
    const vignette=typeof v.vignette==='number'?v.vignette:0;

    const iw=img.width, ih=img.height;
    // Cropped source rect (in original image coords) — never modifies the
    // Image; just narrows the slice that gets drawn.
    const srcX=cLeft*iw, srcY=cTop*ih;
    const srcW=Math.max(1, iw - srcX - cRight*iw);
    const srcH=Math.max(1, ih - srcY - cBottom*ih);

    // Sprint 6.3.1 — geometry routed through ImageViewEngine so the Story
    // path uses the SAME uniform-scale guarantee as Cover / Hook / End.
    // The View Engine returns dw / dh via a single scale factor applied
    // to both axes, so the original aspect ratio is preserved by
    // construction. Backward-compatible: View Engine normalize() accepts
    // both new (mode/zoom/panX/panY) and legacy (fit/scale/offsetX/offsetY)
    // keys, so existing projects keep working.
    let dw, dh, panX, panY;
    if(typeof ImageViewEngine!=='undefined'){
      const c=ImageViewEngine.compute(srcW,srcH,IMG_W,IMG_H,v);
      dw=c.dw; dh=c.dh; panX=c.panX; panY=c.panY;
    }else{
      const fit=v.fit==='fill'?'fill':'fit';
      const userScale=typeof v.scale==='number' && isFinite(v.scale) && v.scale>0 ? v.scale : 1;
      const base=fit==='fill' ? Math.max(IMG_W/srcW, IMG_H/srcH) : Math.min(IMG_W/srcW, IMG_H/srcH);
      const sc=base*userScale;
      dw=srcW*sc; dh=srcH*sc;
      panX=typeof v.offsetX==='number' && isFinite(v.offsetX) ? v.offsetX : 0;
      panY=typeof v.offsetY==='number' && isFinite(v.offsetY) ? v.offsetY : 0;
    }
    // Place the focal point of the cropped src at the panel center, plus
    // any user pan offset.
    const dx=IMG_X+IMG_W/2 - focalX*dw + panX;
    const dy=IMG_Y+IMG_H/2 - focalY*dh + panY;

    // Build canvas filter string (Light + Color + Detail). Highlights /
    // Shadows / Sharpness are approximated as light brightness/contrast
    // perturbations — subtle, non-destructive, matches "beautify originals".
    const filterParts=[];
    const bF = 1 + brightness*0.5 + highlights*0.18 + shadows*-0.18;
    if(Math.abs(bF-1)>0.001) filterParts.push('brightness('+bF.toFixed(4)+')');
    const cF = 1 + contrast*0.5 + sharpness*0.25;
    if(Math.abs(cF-1)>0.001) filterParts.push('contrast('+cF.toFixed(4)+')');
    const satF = 1 + saturation;
    if(Math.abs(satF-1)>0.001) filterParts.push('saturate('+satF.toFixed(4)+')');
    if(Math.abs(warmth)>0.001) filterParts.push('hue-rotate('+(warmth*-15).toFixed(2)+'deg)');

    x.save();
    // Sprint 6.5 — when a picture-border radius is set, the inner image
    // gets a concentric round-rect clip so the image's corners follow
    // the frame's corners. Inner radius = max(0, R - padding). Sprint
    // 6.5.1 — Cloud design clips the image to a cloud silhouette so the
    // picture really IS cloud-shaped.
    //
    // "change the size and shape of place if story author has allowed
    // it" — a Place's own shape (rectangle/rounded/circle, Theme-
    // authored or Story-Author-overridden, see _resolvePlaceShape) clips
    // the ARTWORK IMAGE ITSELF, layered as one more fallback alongside
    // the existing cloud/cornerRadius/rectangle branches — deliberately
    // NOT a whole-Place clip mirroring Builder's own multi-band
    // architecture (wall/border/mat/content), which is organically
    // different from Studio's wall-tone/shadow system and too large/
    // risky a change to safely regression-test here. `placeId` is
    // omitted by every caller with no real Place concept (Cover/Hook/
    // End's own image drawing, which never passes a 6th arg) — for
    // those, placeShape stays the default 'rectangle' and this whole
    // branch is a no-op, byte-identical to before this feature.
    const placeShape=placeId ? _resolvePlaceShape(s,placeId) : 'rectangle';
    const innerRadius=border ? Math.max(0,(border.cornerRadius||0)-pad) : 0;
    if(border && border.design==='cloud'){
      _cloudPath(IMG_X,IMG_Y,IMG_W,IMG_H);
    }else if(placeShape==='circle'){
      const r=Math.min(IMG_W,IMG_H)/2;
      x.beginPath();
      x.arc(IMG_X+IMG_W/2,IMG_Y+IMG_H/2,r,0,Math.PI*2);
    }else if(innerRadius>0 || placeShape==='rounded'){
      const r=placeShape==='rounded' ? Math.max(innerRadius,Math.min(IMG_W,IMG_H)*0.08) : innerRadius;
      _picturePath(IMG_X,IMG_Y,IMG_W,IMG_H,r);
    }else{
      x.beginPath();
      x.rect(IMG_X,IMG_Y,IMG_W,IMG_H);
    }
    x.clip();
    // Straighten: rotate around the panel center so the user sees a level horizon.
    if(Math.abs(straighten)>0.001){
      const cx0=IMG_X+IMG_W/2, cy0=IMG_Y+IMG_H/2;
      x.translate(cx0,cy0);
      x.rotate(straighten*Math.PI/180);
      x.translate(-cx0,-cy0);
    }
    if(filterParts.length>0) x.filter=filterParts.join(' ');
    x.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
    if(filterParts.length>0) x.filter='none';
    // Sprint 6.3.1 — runtime tripwire. The source we just drew is the
    // cropped slice (srcW × srcH); the rendered slice is (dw × dh). If
    // these ratios ever drift the engine has been bypassed somewhere
    // upstream — surface it loudly without breaking production.
    if(typeof ImageViewEngine!=='undefined'){
      ImageViewEngine.verifyAspectRatio(srcW,srcH,dw,dh);
    }
    // Vignette: a radial dim drawn on top of the panel area only.
    if(vignette>0.001){
      const grad=x.createRadialGradient(
        IMG_X+IMG_W/2, IMG_Y+IMG_H/2, Math.min(IMG_W,IMG_H)*0.30,
        IMG_X+IMG_W/2, IMG_Y+IMG_H/2, Math.max(IMG_W,IMG_H)*0.72
      );
      grad.addColorStop(0,'rgba(0,0,0,0)');
      grad.addColorStop(1,'rgba(0,0,0,'+(Math.min(1,vignette)*0.7).toFixed(4)+')');
      x.fillStyle=grad;
      x.fillRect(IMG_X,IMG_Y,IMG_W,IMG_H);
    }
    x.restore();
  }

  // Public: panel rect in canvas coordinates — consumed by canvas pan
  // handler. Sprint 9.6 — an optional slide arg resolves the active
  // layout's Frame rect (see _panelRectFor); omitted, it's the legacy
  // fixed rect exactly as before, for any caller not yet slide-aware.
  function getPanelRect(s){ return s!==undefined ? _panelRectFor(s) : {x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H}; }

  // Multiple Artwork Places Per Page — pixel rects for every Place on
  // this page (id + rect), in the same array order as the compiled
  // Layout's own placeRects (Place 1 first). Every existing single/zero-
  // Place theme resolves to exactly one entry (id:'image-holder', the
  // legacy panel rect) so every caller can loop uniformly instead of
  // special-casing "one implicit Place." `id` for extra Places
  // (index>=1) is `'image-place-'+(index+1)` — a NEW id, distinct from
  // the legacy `'image-holder'` string every existing caller already
  // hardcodes for Place 1.
  //
  // Place 1's rect matches render()'s own _place1Rect exactly: the FULL
  // panelRect only when NO Places are authored at all (no placeRects
  // array — the true implicit-Place legacy case, e.g. Museum Gallery);
  // subdivided by its own compiled position/size, exactly like every
  // other Place, whenever a Layout authors any real Place — honouring
  // Builder's own authored geometry for a single Place too, per the
  // "Creator shows the Scene exactly as it was in Builder" rule. This
  // function must report exactly what render() actually draws, or
  // callers (Object Strip, hit-testing, pixel verification) would
  // select/sample the wrong on-screen area for Place 1.
  function getPlaceRects(s){
    const panelRect=_panelRectFor(s);
    const places=_activeLayoutPlaces(s);
    if(!places || !places.length) return [{id:'image-holder',place:null,rect:_applyPlaceMoveOverride(_applyPlaceSizeOverride(panelRect,s,'image-holder'),s,'image-holder')}];
    const sceneRect=_sceneCanvasRect(s);
    return places.map(function(p,i){
      const id=i===0 ? 'image-holder' : ('image-place-'+(i+1));
      const rect=_placePixelRectFor(sceneRect,p);
      return { id:id, place:p, rect:_applyPlaceMoveOverride(_applyPlaceSizeOverride(rect,s,id),s,id) };
    });
  }

  // Sprint B2.0.3 — World Builder Working View guides. Read-only query,
  // no new rendering behaviour: mirrors render()'s own caption-rect
  // resolution (_captionRectFor falling back to _holderRectFor) so a
  // tool can draw a "Caption Boundary" guide without duplicating that
  // logic or being told about it out-of-band.
  function getCaptionRect(s){
    const panelRect=_panelRectFor(s);
    const border=_resolveBorder(s);
    const composition=_layoutCompositionFor(s);
    return _captionRectFor(panelRect,composition)||_holderRectFor(panelRect,border);
  }

  // Sprint 9.0.2 — WYSIWYE. Canonical canvas size in *logical* pixels
  // (the coordinate space every downstream renderer / hit-tester uses,
  // regardless of DPR-scaled backing store). Hit-testing on the editor
  // canvas divides mouse events by this rather than by `canvas.width`,
  // which is now `_viewportW * dpr` on HiDPI displays.
  //
  // Scene Viewport sprint — an optional `s` (slide) argument resolves
  // the slide's own Scene Viewport (see _sceneViewportFor); omitted, this
  // is the exact byte-identical `{w:1080,h:1350}` every pre-existing
  // caller already gets.
  function getCanvasSize(s){ return s!==undefined ? _sceneViewportFor(s) : DEFAULT_VIEWPORT; }

  // Sprint 9.7 — `positionOverride` lets a theme's Layer Pack pin
  // Handle to a specific corner (the Design Board puts it bottom-right
  // for Museum Gallery) regardless of the Story Theme's own
  // handlePosition default — see _layerPosition below. Omitted (every
  // theme before this sprint), behaviour is unchanged.
  // Sprint 9.7 — `colorOverride` lets the active wall tone (see
  // _chromeTextColor) win over the Story Theme's own watermark colour
  // (usually white, meant for a dark book-frame) so Handle stays
  // legible against a light gallery wall. Omitted, behaviour unchanged.
  function _drawHandle(theme,opts,overrides,handleText,positionOverride,colorOverride){
    if(opts.handleVisibility==='hide') return null;
    // A slide's Handle only ever shows text the theme or the creator
    // actually put there (slide.metadata.handle, or a theme's own
    // defaultHandle) -- it never fabricates placeholder branding when
    // nothing was set.
    if(typeof handleText!=='string' || handleText.length===0) return null;
    const text=handleText;
    const ov=(overrides && overrides['handle'])||{};
    const pos=positionOverride||opts.handlePosition||'top-right';
    let hx, hy, defaultAlign;
    if(pos==='top-left'){ hx=60; hy=60; defaultAlign='left'; }
    else if(pos==='bottom-left'){ hx=60; hy=_viewportH-30; defaultAlign='left'; }
    else if(pos==='bottom-right'){ hx=_viewportW-60; hy=_viewportH-30; defaultAlign='right'; }
    else { hx=_viewportW-60; hy=60; defaultAlign='right'; }
    const st=_resolveTextStyle(ov,theme.watermark.size,theme.watermark.font,colorOverride||theme.watermark.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    hx+=st.offsetX;
    hy+=st.offsetY;
    x.fillText(text,hx,hy);
    const w=x.measureText(text).width;
    x.restore();
    let bx=hx;
    if(st.alignment==='center') bx=hx-w/2;
    else if(st.alignment==='right') bx=hx-w;
    return {id:'handle',label:'Handle',bx:bx,by:hy-st.fontSize,bw:w,bh:st.fontSize+8};
  }

  // --- Panel styles ---
  // Sprint 9.6 — `rect` is the resolved layout Frame rect (see
  // _panelRectFor); omitted, falls back to the legacy fixed panel so
  // any caller not yet passing one stays byte-identical.
  function _drawPanel(color,style,rect){
    const r=rect||{x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H};
    x.fillStyle=color;
    if(style==='rounded'){
      _roundedRect(r.x,r.y,r.w,r.h,40);
      x.fill();
    }else if(style==='cloud'){
      _cloudShape(r.x,r.y,r.w,r.h);
      x.fill();
    }else if(style==='scroll'){
      x.fillRect(r.x,r.y,r.w,r.h);
      x.save();
      x.fillStyle='rgba(0,0,0,0.10)';
      x.fillRect(r.x,r.y,r.w,22);
      x.fillRect(r.x,r.y+r.h-22,r.w,22);
      x.fillStyle='rgba(0,0,0,0.05)';
      x.fillRect(r.x,r.y+22,r.w,8);
      x.fillRect(r.x,r.y+r.h-30,r.w,8);
      x.restore();
    }else{
      x.fillRect(r.x,r.y,r.w,r.h);
    }
  }

  function _roundedRect(rx,ry,rw,rh,r){
    x.beginPath();
    x.moveTo(rx+r,ry);
    x.arcTo(rx+rw,ry,rx+rw,ry+rh,r);
    x.arcTo(rx+rw,ry+rh,rx,ry+rh,r);
    x.arcTo(rx,ry+rh,rx,ry,r);
    x.arcTo(rx,ry,rx+rw,ry,r);
    x.closePath();
  }

  function _cloudShape(rx,ry,rw,rh){
    const cx=rx+rw/2, cy=ry+rh/2;
    x.beginPath();
    x.ellipse(cx,cy,rw/2-10,rh/2-10,0,0,Math.PI*2);
    x.closePath();
  }

  // --- Footer (book title) ---
  function _drawFooter(theme,opts,bookTitle,overrides){
    if(opts.bookTitleVisibility==='hide') return null;
    if(opts.footerStyle==='hidden' || !bookTitle) return null;
    const ov=(overrides && overrides['footer'])||{};
    let defaultSize=theme.footerText.size;
    if(opts.footerStyle==='modern') defaultSize=Math.round(defaultSize*1.1);
    else if(opts.footerStyle==='minimal') defaultSize=Math.round(defaultSize*0.75);
    const pos=opts.bookTitlePosition||'bottom-left';
    let anchorX, defaultAlign;
    if(pos==='bottom-center'){ anchorX=_viewportW/2; defaultAlign='center'; }
    else if(pos==='bottom-right'){ anchorX=_viewportW-60; defaultAlign='right'; }
    else { anchorX=320; defaultAlign='left'; }
    const st=_resolveTextStyle(ov,defaultSize,theme.footerText.font,theme.footerText.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    anchorX+=st.offsetX;
    const anchorY=(_viewportH-65)+st.offsetY;
    x.fillText(bookTitle,anchorX,anchorY);
    const w=x.measureText(bookTitle).width;
    x.restore();
    let bx=anchorX;
    if(st.alignment==='center') bx=anchorX-w/2;
    else if(st.alignment==='right') bx=anchorX-w;
    return {id:'footer',label:'Footer',bx:bx,by:anchorY-st.fontSize,bw:w,bh:st.fontSize+8};
  }

  // --- Page number ---
  // Sprint 9.7 — `positionOverride` (same convention as _drawHandle
  // above) adds a 'bottom-left' placement, which nothing before this
  // sprint's Museum Gallery Layer Pack ever needed.
  function _drawPageNumber(theme,opts,page,total,overrides,positionOverride,colorOverride){
    if(opts.pageNumber==='hidden') return null;
    const ov=(overrides && overrides['page-number'])||{};
    const label=page+' / '+total;
    const pos=positionOverride||opts.pageNumber;
    let anchorX, anchorY, defaultAlign;
    if(pos==='bottom-center'){
      anchorX=_viewportW/2; anchorY=opts.footerStyle==='hidden'?(_viewportH-65):(_viewportH-25); defaultAlign='center';
    }else if(pos==='bottom-left'){
      anchorX=60; anchorY=_viewportH-65; defaultAlign='left';
    }else{
      anchorX=_viewportW-180; anchorY=_viewportH-65; defaultAlign='left';
    }
    const st=_resolveTextStyle(ov,theme.footerText.size,theme.footerText.font,colorOverride||theme.footerText.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    anchorX+=st.offsetX;
    anchorY+=st.offsetY;
    x.fillText(label,anchorX,anchorY);
    const w=x.measureText(label).width;
    x.restore();
    let bx=anchorX;
    if(st.alignment==='center') bx=anchorX-w/2;
    else if(st.alignment==='right') bx=anchorX-w;
    return {id:'page-number',label:'Page Number',bx:bx,by:anchorY-st.fontSize,bw:w,bh:st.fontSize+8};
  }

  // --- Decorations ---
  function _drawDecorations(decorations,theme,opts){
    if(!decorations||decorations.length===0) return;
    const color=theme.watermark.color;
    decorations.forEach(function(d){
      if(d==='stars') _drawStars(color);
      else if(d==='clouds') _drawClouds(color);
      else if(d==='birds') _drawBirds(color);
      else if(d==='trees') _drawTrees(color);
      else if(d==='flowers') _drawFlowers(color);
    });
  }

  function _drawStar(cx,cy,r){
    x.beginPath();
    for(let i=0;i<5;i++){
      const a1=(i*2*Math.PI/5)-Math.PI/2;
      const a2=a1+Math.PI/5;
      const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
      const x2=cx+(r/2)*Math.cos(a2), y2=cy+(r/2)*Math.sin(a2);
      if(i===0) x.moveTo(x1,y1); else x.lineTo(x1,y1);
      x.lineTo(x2,y2);
    }
    x.closePath();
    x.fill();
  }

  function _drawStars(color){
    x.save();
    x.fillStyle=color;
    const positions=[[40,40],[1020,140],[40,1200],[1010,1295],[200,1230],[860,1235],[35,700],[1030,700]];
    positions.forEach(function(p){ _drawStar(p[0],p[1],11); });
    x.restore();
  }

  function _drawCloud(cx,cy,scale){
    const r=20*scale;
    x.beginPath();
    x.arc(cx-r*1.4,cy,r,0,Math.PI*2);
    x.arc(cx,cy-r*0.6,r*1.3,0,Math.PI*2);
    x.arc(cx+r*1.4,cy,r,0,Math.PI*2);
    x.arc(cx,cy+r*0.3,r*1.1,0,Math.PI*2);
    x.fill();
  }

  function _drawClouds(color){
    x.save();
    x.globalAlpha=0.85;
    x.fillStyle=color;
    _drawCloud(160,80,1.0);
    _drawCloud(950,80,1.2);
    _drawCloud(40,1250,0.9);
    _drawCloud(1020,1240,1.0);
    x.restore();
  }

  function _drawBird(cx,cy,scale){
    x.beginPath();
    const w=18*scale;
    x.moveTo(cx-w,cy);
    x.quadraticCurveTo(cx-w/2,cy-w*0.6,cx,cy);
    x.quadraticCurveTo(cx+w/2,cy-w*0.6,cx+w,cy);
    x.lineWidth=3*scale;
    x.stroke();
  }

  function _drawBirds(color){
    x.save();
    x.strokeStyle=color;
    x.fillStyle=color;
    [[140,90,1.0],[300,55,1.2],[920,70,1.0],[1010,110,1.3],[60,1240,1.0],[1010,1255,1.1]].forEach(function(p){
      _drawBird(p[0],p[1],p[2]);
    });
    x.restore();
  }

  function _drawTree(cx,cy,scale){
    const w=28*scale, h=44*scale;
    x.beginPath();
    x.moveTo(cx,cy-h);
    x.lineTo(cx-w,cy);
    x.lineTo(cx+w,cy);
    x.closePath();
    x.fill();
    x.fillRect(cx-4*scale,cy,8*scale,12*scale);
  }

  function _drawTrees(color){
    x.save();
    x.fillStyle=color;
    [[35,1320,1.0],[120,1320,0.9],[960,1320,1.1],[1045,1320,0.9],[35,80,0.8],[1045,80,0.8]].forEach(function(p){
      _drawTree(p[0],p[1],p[2]);
    });
    x.restore();
  }

  function _drawFlower(cx,cy,scale){
    const r=10*scale;
    const offsets=[[0,-r*1.4],[r*1.3,-r*0.4],[r*0.8,r*1.2],[-r*0.8,r*1.2],[-r*1.3,-r*0.4]];
    offsets.forEach(function(o){
      x.beginPath(); x.arc(cx+o[0],cy+o[1],r,0,Math.PI*2); x.fill();
    });
    x.beginPath(); x.fillStyle='#FFD27A'; x.arc(cx,cy,r*0.55,0,Math.PI*2); x.fill();
  }

  function _drawFlowers(color){
    x.save();
    x.fillStyle=color;
    [[55,1255,1.0],[1020,1260,1.1],[45,90,0.9],[1025,95,1.0],[140,1310,0.8]].forEach(function(p){
      _drawFlower(p[0],p[1],p[2]);
    });
    x.restore();
  }

  // Sprint 6.4 — WYSIWYE. Single source of truth for resolving a slide
  // into a render payload. Preview (app.js), Thumbnail (thumbnails.js),
  // and Export (pageOps.js) all funnel through this helper so the
  // exported PNG is pixel-identical to what's on the canvas. Adding new
  // resolution layers in the future means changing one place.
  //
  // opts: { page, totalPages, defaultBookTitle, defaultHandle } — all
  // optional. The defaults are the editor-chrome fallbacks (the hidden
  // #bookTitle input value); slide.metadata always wins when set.
  function buildPayload(slide, opts){
    opts = opts || {};
    // Sprint 9.1.3 — Theme Designer Global Behaviour. The payload
    // carries the RESOLVED theme (with themeOptions.typography +
    // themeOptions.colours layered on top) so every render surface
    // — editor, publish, thumbnails — reflects Theme Designer
    // changes immediately. Before this, buildPayload stamped the
    // BASE theme, which meant Typography / Colours overrides
    // reached the renderer only through _theme(s)'s late fallback
    // and never through the payload's `theme` field — so typography
    // changes silently didn't propagate to thumbnails or the read
    // canvas.
    // Creator Acceptance Sprint (Museum Gallery trace) — this duplicated
    // _theme(s)/_options(s)'s own ThemeEngine calls without their
    // try/catch safety net, so a real, reachable ThemeEngine exception
    // (found tracing a project with no Story Theme active at all) went
    // uncaught here even though _theme(s)/_options(s) already handle it
    // gracefully elsewhere in this file. Same fallback pattern now.
    let theme;
    try{
      theme = (typeof ThemeEngine !== 'undefined')
        ? ((typeof ThemeEngine.resolveTheme === 'function')
            ? ThemeEngine.resolveTheme()
            : ThemeEngine.getActiveTheme())
        : FALLBACK_THEME;
    }catch(e){ theme = FALLBACK_THEME; }
    let themeOptions;
    try{ themeOptions = (typeof ThemeEngine !== 'undefined') ? ThemeEngine.getOptions() : FALLBACK_OPTIONS; }
    catch(e){ themeOptions = FALLBACK_OPTIONS; }
    // Sprint 9.3 — same "stamp the resolved value into the payload"
    // discipline as `theme` above, so every render surface (editor,
    // thumbnails, publish) reflects an Artwork Theme change
    // immediately. null (no Artwork Theme selected) is a normal,
    // common value here — see _artworkTheme(s) / _resolveBorder(s).
    const artworkTheme = (typeof ThemeEngine !== 'undefined' && typeof ThemeEngine.getActiveArtworkTheme === 'function')
      ? ThemeEngine.getActiveArtworkTheme()
      : null;
    const m = slide.metadata || {};
    const cardOverrides = m.cardOverrides || null;
    // Sprint 4.5: image view lives under cardOverrides.image; fall back
    // to the legacy slide.metadata.imageView path so old projects render.
    const imageView = (cardOverrides && cardOverrides.image)
      || m.imageView
      || null;
    // Sprint 5.0: per-slide footer / handle overrides resolved here.
    const bookTitle = (typeof m.footerText === 'string')
      ? m.footerText
      : (opts.defaultBookTitle || '');
    const handle = (typeof m.handle === 'string' && m.handle.length > 0)
      ? m.handle
      : (opts.defaultHandle || '');
    return {
      image: slide.image,
      // Multiple Artwork Places Per Page — the loaded Image objects for
      // every Place beyond the first (Place 1 keeps using the `image`
      // field above, unchanged); a sibling runtime cache to slide.image,
      // never persisted directly (see slide.metadata.placeContent for
      // the persisted dataURL/view/overrides half of each entry).
      placeImages: slide._placeImages || null,
      storyBeat: slide.storyBeat || '',
      bookTitle: bookTitle,
      handle: handle,
      page: (opts.page != null) ? opts.page : (slide.page || 1),
      totalPages: (opts.totalPages != null) ? opts.totalPages : (slide.totalPages || 0),
      theme: theme,
      themeOptions: themeOptions,
      artworkTheme: artworkTheme,
      imageView: imageView,
      overrides: cardOverrides,
      pageType: slide.pageType,
      metadata: slide.metadata
    };
  }

  // Sprint 6.5.1 — Frame thumbnail helper. Renders a single Frame Design
  // into a provided 2D context so the Card Designer's chip previews show
  // the actual rendered Frame (not a CSS approximation). The function
  // temporarily retargets the module-level `x` so existing draw helpers
  // can be reused without duplication.
  function drawFrameSwatch(targetCtx,rect,border,theme){
    if(!targetCtx||!rect||!border) return;
    const saved=x;
    x=targetCtx;
    try{
      _drawPictureFrameFill(rect,border,theme||{panel:{color:'#FFFFFF'}});
      // The "picture" inside a swatch is a soft placeholder block so
      // shape / proportions read at a glance.
      const insets=_getDesignInsets(border);
      const inner={
        x:rect.x+insets.left, y:rect.y+insets.top,
        w:Math.max(1,rect.w-insets.left-insets.right),
        h:Math.max(1,rect.h-insets.top-insets.bottom)
      };
      const innerRadius=Math.max(0,(border.cornerRadius||0)-border.padding);
      targetCtx.save();
      if(border.design==='cloud'){
        _cloudPath(inner.x,inner.y,inner.w,inner.h);
      }else if(innerRadius>0){
        _picturePath(inner.x,inner.y,inner.w,inner.h,innerRadius);
      }else{
        targetCtx.beginPath();
        targetCtx.rect(inner.x,inner.y,inner.w,inner.h);
      }
      targetCtx.clip();
      const grad=targetCtx.createLinearGradient(inner.x,inner.y,inner.x,inner.y+inner.h);
      grad.addColorStop(0,'#9FB0CB');
      grad.addColorStop(1,'#3D5A82');
      targetCtx.fillStyle=grad;
      targetCtx.fillRect(inner.x,inner.y,inner.w,inner.h);
      // Sun arc to hint a picture is inside
      targetCtx.fillStyle='#FFD27A';
      targetCtx.beginPath();
      targetCtx.arc(inner.x+inner.w*0.70, inner.y+inner.h*0.30, Math.min(inner.w,inner.h)*0.12, 0, Math.PI*2);
      targetCtx.fill();
      targetCtx.restore();
      _drawPictureFrameOrnament(rect,border,theme||{panel:{color:'#FFFFFF'}});
      _drawPictureFrameStroke(rect,border);
    } finally {
      x=saved;
    }
  }

  // Honour World-Owned Object Commitments sprint — the Object Strip's
  // `visual`-aware thumbnail for a shape-kind World object. Mirrors
  // drawFrameSwatch's own context-swap technique exactly (swap the
  // module-private canvas context to an external one, call the
  // existing draw routine, restore) so a Shape thumbnail reuses
  // _layerDrawShape's real geometry rather than a second implementation.
  // Only `kind:'shape'` needs a canvas at all — color/image/glyph/text
  // thumbnails are plain DOM (swatch div / img / text), built directly
  // in js/objectStrip.js from the same `visual` descriptor.
  function drawObjectThumbnail(targetCtx,visual,size){
    if(!targetCtx||!visual) return;
    if(visual.kind!=='shape' && visual.kind!=='doodle') return;
    const saved=x;
    x=targetCtx;
    try{
      if(visual.kind==='shape'){
        if(visual.shape==='custom' && Array.isArray(visual.customStrokes) && visual.customStrokes.length){
          _drawCustomStrokeShape({x:0,y:0,w:size,h:size},visual.customStrokes,{
            fillColor:visual.fillColor, fillOpacity:visual.fillOpacity,
            strokeColor:visual.strokeColor, strokeOpacity:visual.strokeOpacity, strokeWidth:visual.strokeWidth,
            fillEnabled:visual.fillEnabled,
            fillMode:visual.fillMode, paintStrokes:visual.paintStrokes,
            rotation:visual.rotation, alpha:1
          });
        }else{
          _layerDrawShape({
            shape:visual.shape,
            fillColor:visual.fillColor,
            strokeColor:visual.strokeColor,
            strokeWidth:visual.strokeWidth,
            fillEnabled:visual.fillEnabled,
            fillMode:visual.fillMode, paintStrokes:visual.paintStrokes,
            rotation:visual.rotation,
            customPath:visual.customPath
          },{x:0,y:0,w:size,h:size});
        }
      }else{
        // Doodle — reuse the exact same stroke renderer the live canvas
        // paints with, so an Object Strip thumbnail is never a second
        // implementation (Honour World-Owned Object Commitments sprint's
        // own established drawObjectThumbnail precedent).
        _drawDoodleStrokes(visual.strokes,{x:0,y:0,w:size,h:size},1);
      }
    } finally {
      x=saved;
    }
  }

  // Temporary diagnostic export — NOT part of the permanent API surface.
  // Lets a caller inspect exactly what _resolveBorder computes for a
  // given raw slide + placeId, using the same buildPayload() step
  // render() itself uses, so this is faithful to the real render path
  // rather than a re-derivation.
  function debugResolveBorder(slide,placeId){
    const payload=buildPayload(slide);
    return _resolveBorder(payload,placeId);
  }

  const api={init,render,buildPayload,getPanelRect,getPlaceRects,getPlacePermissions,getPlaceShape:_resolvePlaceShape,getPlaceRotation:_resolvePlaceRotation,getPlaceGrabHandleHitbox,getCaptionRect,getCanvasSize,getTextElements,getSceneElements,getResizeHandlesFor,getHandleRadius,drawFrameSwatch,drawObjectThumbnail,getReorderableIds,getReorderBucket,activeLayoutHolderCount:_activeLayoutHolders,debugResolveBorder,preloadFonts,getPlaceV2Layers,isPlaceV2,getPlaceV2LayerPermission};
  try{ window.SlideRenderer=api; }catch(e){}
  return api;
})();
