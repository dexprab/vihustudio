const SlideRenderer=(()=>{
  let c,x;
  const W=1080,H=1350;
  const PANEL_X=70, PANEL_Y=185, PANEL_W=940, PANEL_H=930;
  // Cached after each render() so canvas hit-testing can match clicks to
  // the actual rendered bboxes — including override-driven size shifts.
  let _lastTextElements=[];
  // Sprint 6.1 — scene element bboxes from the most recent render(), used
  // by the canvas drag handler to hit-test scene elements.
  let _lastSceneElements=[];

  const FALLBACK_THEME={
    frame:{ color:'#1D3457' },
    panel:{ color:'#FFFFFF' },
    storyText:{ font:'Arial', size:56, color:'#FFFFFF' },
    footerText:{ font:'Arial', size:24, color:'#FFFFFF' },
    watermark:{ font:'Arial', size:24, color:'#FFFFFF' }
  };
  const FALLBACK_OPTIONS={
    variant:'classic',
    panelStyle:'classic',
    footerStyle:'classic',
    decorations:[],
    pageNumber:'bottom-right',
    bookTitleVisibility:'show',
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
  function init(cv, opts){
    c=cv;
    const dpr=(opts && typeof opts.dpr==='number' && opts.dpr>0)
      ? opts.dpr
      : ((typeof window!=='undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);
    c.width=Math.round(W*dpr);
    c.height=Math.round(H*dpr);
    x=c.getContext('2d');
    // Draw in canonical 1080 × 1350 coordinates; DPR scaling is baked
    // into the transform once, so `x.fillRect(0,0,W,H)` still covers
    // the full page regardless of backing store size.
    try{ x.setTransform(dpr,0,0,dpr,0,0); }catch(e){}
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
    'bulletin-board': {design:null,       cornerRadius:0}
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
  function _artworkBorder(art){
    if(!art) return null;
    const resolved=(typeof ThemePresets!=='undefined')
      ? ThemePresets.resolveHolder('image',art.presentation,art)
      : art;
    const framePreset=ARTWORK_FRAME_PRESET[resolved.frame]||ARTWORK_FRAME_PRESET['none'];
    const shadowPreset=ARTWORK_SHADOW_PRESET[resolved.shadow]||ARTWORK_SHADOW_PRESET['none'];
    const padding=(ARTWORK_COMPOSITION_PADDING[resolved.composition]!=null)?ARTWORK_COMPOSITION_PADDING[resolved.composition]:24;
    return {
      design:framePreset.design,
      padding:padding,
      fill:ARTWORK_BACKGROUND_FILL[resolved.background]||'none',
      cornerRadius:framePreset.cornerRadius,
      lineEnabled:false,
      lineWidth:2,
      lineColor:'#000000',
      shadowEnabled:shadowPreset.enabled,
      shadowIntensity:shadowPreset.intensity,
      _artwork:resolved
    };
  }

  // Sprint 6.5 — Picture Border. Resolved from
  // slide.metadata.cardOverrides.border (passed in via payload.overrides.border).
  // Returns null when no override is present so the legacy rendering path
  // stays byte-identical for projects that haven't touched the border.
  // Sprint 6.5.1 — also carries the design id so per-design ornament
  // drawing dispatches consistently.
  function _resolveBorder(s){
    const ov=(s && s.overrides) || null;
    const b=ov && ov.border;
    if(!b){
      // Sprint 9.3 — an Artwork Theme is the next fallback layer,
      // ABOVE the Story Theme's Holder Defaults (below) but only when
      // the slide actually has a picture — "If a page contains no
      // artwork, Artwork Theme has no effect" is enforced right here,
      // not by every draw call site having to check separately.
      const hasImage=!!(s && s.image && s.image.width);
      if(hasImage){
        const art=_artworkTheme(s);
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
      shadowIntensity:(typeof shadow.intensity==='number')?shadow.intensity:0.4
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

  // Picture-frame fill (with optional drop shadow). Drawn under the image.
  function _drawPictureFrameFill(rect,border,theme){
    const fillColor=_resolveBorderFillColor(border,theme);
    if(!fillColor && !border.shadowEnabled) return;
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
      default: return;
    }
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

  function render(s){
    if(!x) return;
    const t=_theme(s);
    const opts=_options(s);
    const overrides=(s && s.overrides && s.overrides.textElements) || {};
    _lastTextElements=[];

    // Frame
    x.fillStyle=_frameColor(t,opts);
    x.fillRect(0,0,W,H);

    // Sprint 6.5 — when the user has customised the Picture Border, draw
    // a styled frame in place of the legacy panel. Otherwise fall through
    // to the existing panel style so untouched projects stay pixel-identical.
    const _border=_resolveBorder(s);
    const _panelRect={x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H};
    if(_border){
      _drawPictureFrameFill(_panelRect,_border,t);
      _drawArtworkPresentation(_panelRect,_border);
    }else{
      _drawPanel(t.panel.color,opts.panelStyle);
    }

    // Sprint 6.2 — when a scene is active, the scene blueprint owns the
    // page composition. Skip the legacy Story-style pipeline so text /
    // image / decorations don't double-render. Story-role pages stay
    // byte-identical because SceneEngine.getRenderData returns null for
    // them.
    const _hasScene=(typeof SceneEngine!=='undefined') && (SceneEngine.getRenderData(s)!==null);
    if(!_hasScene){
      // Top story text
      const storyBbox=_drawStoryText(s,t,overrides);
      if(storyBbox) _lastTextElements.push(storyBbox);

      // Handle / branding watermark — Sprint 5.0 reads handle text from payload.
      const handleBbox=_drawHandle(t,opts,overrides,s.handle);
      if(handleBbox) _lastTextElements.push(handleBbox);

      // Image inside panel — presentation-only transforms; original image untouched.
      // s.imageView (optional): { scale, offsetX, offsetY, fit:'fit'|'fill' }
      if(s.image && s.image.width){
        _drawImage(s,_border);
      }
      // Sprint 6.5 — Picture Border stroke sits above the image so it
      // always reads as a crisp frame edge. Sprint 6.5.1 — ornament
      // (sparkles, grain, ribbon corners, …) sits between image and
      // stroke so the stroke can still cap it visually.
      if(_border){
        _drawPictureFrameOrnament(_panelRect,_border,t);
        _drawPictureFrameStroke(_panelRect,_border);
        // Sprint 9.3 — _border._artwork is only ever set when the
        // slide has an image (see _resolveBorder's gating), so this
        // is already "no artwork on the page -> no caption" for free.
        if(_border._artwork) _drawArtworkCaption(_border._artwork,s.metadata,_panelRect,t);
      }

      // Decorations on the frame
      _drawDecorations(opts.decorations,t,opts);

      // Footer (book title)
      const footerBbox=_drawFooter(t,opts,s.bookTitle||'',overrides);
      if(footerBbox) _lastTextElements.push(footerBbox);

      // Page number
      const pageBbox=_drawPageNumber(t,opts,s.page||1,s.totalPages||1,overrides);
      if(pageBbox) _lastTextElements.push(pageBbox);
    }

    // Sprint 6.1 — Scene Layer. Story role pages return null from
    // SceneEngine, so this pass is a no-op for them.
    _lastSceneElements=[];
    if(typeof SceneEngine!=='undefined'){
      const data=SceneEngine.getRenderData(s);
      if(data && data.elements && data.elements.length){
        const sorted=data.elements.slice().sort(function(a,b){ return (a.zIndex||0)-(b.zIndex||0); });
        sorted.forEach(function(el){
          if(el.visible===false) return;
          if(el.type==='background') _drawSceneBackground(el);
          else if(el.type==='decoration') _drawSceneDecoration(el);
          else if(el.type==='image-holder') _drawSceneImageHolder(s,el);
          else if(el.type==='text-holder') _drawSceneTextHolder(s,el);
          // Legacy fallback for projects authored against Sprint 6.1.
          else if(el.type==='text') _drawSceneText(s,el);
          _lastSceneElements.push(_sceneBbox(el));
        });
      }
    }

    // Sprint 6.6 — Stickers. Story objects that ride on top of every
    // role's composition. Drawn back-to-front in array order so the last
    // sticker added sits on top. Bboxes are appended to the scene-element
    // list so the existing canvas hit-test path covers them for free.
    if(typeof SceneEngine!=='undefined'){
      const stickers=SceneEngine.getStickers(s);
      for(let i=0;i<stickers.length;i++){
        const st=stickers[i];
        _drawSceneSticker(st);
        _lastSceneElements.push(_stickerBbox(st));
      }
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
      if(m>0 && m<W/2 && m<H/2){
        x.save();
        x.strokeStyle='rgba(255,203,69,0.7)';
        x.lineWidth=2;
        x.setLineDash([12,8]);
        x.strokeRect(m,m,W-m*2,H-m*2);
        x.restore();
      }
    }
  }

  // Sprint 6.1 — scene element drawing helpers.
  function _drawSceneBackground(el){
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    x.fillStyle=el.color||'#000000';
    x.fillRect(0,0,W,H);
    x.restore();
  }
  function _drawSceneDecoration(el){
    const pos=el.position||{x:W/2,y:H/2};
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
    const pos=el.position||{x:W/2,y:H/2};
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
    const pos=el.position||{x:W/2,y:H/2};
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

  // Sprint 6.2 — Image Holder. Sprint 6.3.1: routed through ImageViewEngine
  // so Cover / Hook / End use the SAME view model (mode / zoom / panX / panY)
  // as Story. When the page has no image, paints a dashed placeholder so
  // the user sees the slot. The blueprint's `fit` ('cover' / 'contain')
  // seeds the default view mode but the user's `s.imageView.mode` wins.
  function _drawSceneImageHolder(s,el){
    const pos=el.position||{x:W/2,y:H/2};
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
      _drawPictureFrameFill(outerRect,border,_theme(s));
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
  function _drawSceneSticker(st){
    if(!st) return;
    const cx=typeof st.x==='number'?st.x:W/2;
    const cy=typeof st.y==='number'?st.y:H/2;
    const w=typeof st.w==='number'?st.w:260;
    const h=typeof st.h==='number'?st.h:260;
    x.save();
    x.globalAlpha=typeof st.opacity==='number' ? Math.max(0,Math.min(1,st.opacity)) : 1;
    x.translate(cx,cy);
    if(st.rotation) x.rotate((st.rotation||0)*Math.PI/180);
    const sx=st.flipX?-1:1, sy=st.flipY?-1:1;
    if(sx!==1 || sy!==1) x.scale(sx,sy);
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
    x.restore();
  }
  function _stickerBbox(st){
    const cx=typeof st.x==='number'?st.x:W/2;
    const cy=typeof st.y==='number'?st.y:H/2;
    const w=typeof st.w==='number'?st.w:260;
    const h=typeof st.h==='number'?st.h:260;
    // Hit-test uses the AXIS-ALIGNED bbox; rotation tightens later if
    // needed. For a child interaction this is generous, never confusing.
    return {
      id:st.id,
      type:'sticker',
      stickerId:st.stickerId,
      label:'Sticker',
      bx:cx-w/2, by:cy-h/2, bw:w, bh:h,
      visible:true,
      locked:!!st.locked
    };
  }

  function _sceneBbox(el){
    const pos=el.position||{x:W/2,y:H/2};
    const locked=!!el.locked;
    if(el.type==='background'){
      return {id:el.id,type:el.type,label:el.label||el.id,bx:0,by:0,bw:W,bh:H,visible:el.visible!==false,locked:locked};
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
  // drag.
  const HANDLE_RADIUS=12;
  function _supportsResize(el){
    if(!el || !el.type) return false;
    // Sprint 8.3 — Universal Object Consistency. Lock disables resize
    // (and drag) for ANY scene element type. Resize otherwise applies
    // to the Frame (image-holder), decorations, and stickers.
    if(el.locked) return false;
    return el.type==='image-holder' || el.type==='decoration' || el.type==='sticker';
  }
  function _drawResizeHandles(el){
    const cx1=el.bx, cy1=el.by;
    const cx2=el.bx+el.bw, cy2=el.by+el.bh;
    const mx=el.bx+el.bw/2, my=el.by+el.bh/2;
    const positions=[
      [cx1,cy1],[cx2,cy1],[cx1,cy2],[cx2,cy2],
      [mx,cy1],[mx,cy2],[cx1,my],[cx2,my]
    ];
    x.save();
    x.fillStyle='#FFCB45';
    x.strokeStyle='#1D3457';
    x.lineWidth=2;
    positions.forEach(function(p){
      x.beginPath();
      x.arc(p[0],p[1],HANDLE_RADIUS,0,Math.PI*2);
      x.fill();
      x.stroke();
    });
    x.restore();
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
    x.globalAlpha=Math.abs(cx-W/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(W/2,0); x.lineTo(W/2,H); x.stroke();
    x.globalAlpha=Math.abs(cy-H/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(0,H/2); x.lineTo(W,H/2); x.stroke();
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

  // Sprint 5.1 — exposed to Story Designer as the source of truth for
  // overflow detection. Width budget = canvas minus left/right margins
  // (60 each side). Multi-line input also flags overflow because the
  // current renderer draws only the first line.
  const STORY_MAX_WIDTH=W-120;

  function _drawStoryText(s,theme,overrides){
    if(!s.storyBeat) return null;
    const ov=overrides['story-text']||{};
    const st=_resolveTextStyle(ov,theme.storyText.size,theme.storyText.font,theme.storyText.color,'left');
    x.save();
    _applyTextStyle(st);
    let drawX=60;
    if(st.alignment==='center') drawX=W/2;
    else if(st.alignment==='right') drawX=W-60;
    drawX+=st.offsetX;
    const drawY=100+st.offsetY;
    x.fillText(s.storyBeat,drawX,drawY);
    const w=x.measureText(s.storyBeat).width;
    x.restore();
    let bx=drawX;
    if(st.alignment==='center') bx=drawX-w/2;
    else if(st.alignment==='right') bx=drawX-w;
    const overflow=(w>STORY_MAX_WIDTH) || (s.storyBeat.indexOf('\n')!==-1);
    return {id:'story-text',label:'Story Text',bx:bx,by:drawY-st.fontSize,bw:w,bh:st.fontSize+8,overflow:overflow,maxWidth:STORY_MAX_WIDTH};
  }

  // Inner image area inside the panel. Sprint 6.5 — padding is normally
  // 20px (the legacy default) but the Picture Border slider can override
  // it; the renderer adapts so the image always fits inside the styled frame.
  // Sprint 6.5.1 — designs can request asymmetric insets (Polaroid grows
  // the bottom). The image rect is computed from those insets so the
  // identity of the design reads in the layout.
  const DEFAULT_IMG_PAD=20;

  function _drawImage(s,border){
    const insets=border ? _getDesignInsets(border) : {top:DEFAULT_IMG_PAD,right:DEFAULT_IMG_PAD,bottom:DEFAULT_IMG_PAD,left:DEFAULT_IMG_PAD};
    const pad=border ? border.padding : DEFAULT_IMG_PAD;
    const IMG_X=PANEL_X+insets.left, IMG_Y=PANEL_Y+insets.top;
    const IMG_W=Math.max(1,PANEL_W-insets.left-insets.right), IMG_H=Math.max(1,PANEL_H-insets.top-insets.bottom);
    const v=s.imageView||{};
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

    const iw=s.image.width, ih=s.image.height;
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
    const innerRadius=border ? Math.max(0,(border.cornerRadius||0)-pad) : 0;
    if(border && border.design==='cloud'){
      _cloudPath(IMG_X,IMG_Y,IMG_W,IMG_H);
    }else if(innerRadius>0){
      _picturePath(IMG_X,IMG_Y,IMG_W,IMG_H,innerRadius);
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
    x.drawImage(s.image, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
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

  // Public: panel rect in canvas coordinates — consumed by canvas pan handler.
  function getPanelRect(){ return {x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H}; }

  // Sprint 9.0.2 — WYSIWYE. Canonical canvas size in *logical* pixels
  // (the coordinate space every downstream renderer / hit-tester uses,
  // regardless of DPR-scaled backing store). Hit-testing on the editor
  // canvas divides mouse events by this rather than by `canvas.width`,
  // which is now `W * dpr` on HiDPI displays.
  function getCanvasSize(){ return {w:W, h:H}; }

  function _drawHandle(theme,opts,overrides,handleText){
    if(opts.handleVisibility==='hide') return null;
    const text=(typeof handleText==='string' && handleText.length>0) ? handleText : '@vihuplanet';
    const ov=(overrides && overrides['handle'])||{};
    const pos=opts.handlePosition||'top-right';
    let hx, hy, defaultAlign;
    if(pos==='top-left'){ hx=60; hy=60; defaultAlign='left'; }
    else if(pos==='bottom-left'){ hx=60; hy=H-30; defaultAlign='left'; }
    else if(pos==='bottom-right'){ hx=W-60; hy=H-30; defaultAlign='right'; }
    else { hx=W-60; hy=60; defaultAlign='right'; }
    const st=_resolveTextStyle(ov,theme.watermark.size,theme.watermark.font,theme.watermark.color,defaultAlign);
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
  function _drawPanel(color,style){
    x.fillStyle=color;
    if(style==='rounded'){
      _roundedRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H,40);
      x.fill();
    }else if(style==='cloud'){
      _cloudShape(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
      x.fill();
    }else if(style==='scroll'){
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
      x.save();
      x.fillStyle='rgba(0,0,0,0.10)';
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,22);
      x.fillRect(PANEL_X,PANEL_Y+PANEL_H-22,PANEL_W,22);
      x.fillStyle='rgba(0,0,0,0.05)';
      x.fillRect(PANEL_X,PANEL_Y+22,PANEL_W,8);
      x.fillRect(PANEL_X,PANEL_Y+PANEL_H-30,PANEL_W,8);
      x.restore();
    }else{
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
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
    if(pos==='bottom-center'){ anchorX=W/2; defaultAlign='center'; }
    else if(pos==='bottom-right'){ anchorX=W-60; defaultAlign='right'; }
    else { anchorX=320; defaultAlign='left'; }
    const st=_resolveTextStyle(ov,defaultSize,theme.footerText.font,theme.footerText.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    anchorX+=st.offsetX;
    const anchorY=1285+st.offsetY;
    x.fillText(bookTitle,anchorX,anchorY);
    const w=x.measureText(bookTitle).width;
    x.restore();
    let bx=anchorX;
    if(st.alignment==='center') bx=anchorX-w/2;
    else if(st.alignment==='right') bx=anchorX-w;
    return {id:'footer',label:'Footer',bx:bx,by:anchorY-st.fontSize,bw:w,bh:st.fontSize+8};
  }

  // --- Page number ---
  function _drawPageNumber(theme,opts,page,total,overrides){
    if(opts.pageNumber==='hidden') return null;
    const ov=(overrides && overrides['page-number'])||{};
    const label=page+' / '+total;
    let anchorX, anchorY, defaultAlign;
    if(opts.pageNumber==='bottom-center'){
      anchorX=W/2; anchorY=opts.footerStyle==='hidden'?1285:1325; defaultAlign='center';
    }else{
      anchorX=900; anchorY=1285; defaultAlign='left';
    }
    const st=_resolveTextStyle(ov,theme.footerText.size,theme.footerText.font,theme.footerText.color,defaultAlign);
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
    const theme = (typeof ThemeEngine !== 'undefined')
      ? ((typeof ThemeEngine.resolveTheme === 'function')
          ? ThemeEngine.resolveTheme()
          : ThemeEngine.getActiveTheme())
      : null;
    const themeOptions = (typeof ThemeEngine !== 'undefined') ? ThemeEngine.getOptions() : null;
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
      : (opts.defaultHandle || '@vihuplanet');
    return {
      image: slide.image,
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

  const api={init,render,buildPayload,getPanelRect,getCanvasSize,getTextElements,getSceneElements,getResizeHandlesFor,getHandleRadius,drawFrameSwatch};
  try{ window.SlideRenderer=api; }catch(e){}
  return api;
})();
