// CardDesigner — reusable foundation shared by Story / Cover / CTA Designers.
// Sprint 4.1: structure, public API, mount/unmount.
// Sprint 4.2: Image section — scale, fit/fill, pan, reset (stored at imageView).
// Sprint 4.5: Image overrides migrated to slide.metadata.cardOverrides.image,
//             expanded with composition / light / color / detail / effects.
//             Card section hidden from the palette (code preserved).
// Sprint 6.5: "Make My Picture Beautiful." UI rewritten in child-friendly
//             language with two groups — Picture (Show / Bigger ↔ Smaller /
//             Move Left ↔ Right / Move Up ↔ Down / Start Over) and Picture
//             Border (size / color / round corners / border line / shadow /
//             reset). Legacy composition / light / color / detail / effects
//             data continues to render from saved projects; the power-user
//             UI is hidden because a 9-year-old shouldn't need it.
const CardDesigner=(function(){
  // Sprint 8.4.1 — section order tracks the Universal Object Selection
  // routing in app.js. `frame` is the Picture Holder (the container the
  // picture lives inside); `image` is the picture itself; the rest are
  // self-evident. The id `frame` is preserved for backward compat with
  // every saved selection state + the renderer's element id.
  const SECTIONS=[
    {
      id:'sticker',
      title:'Sticker',
      summary:''
    },
    {
      id:'frame',
      title:'Picture Frame',
      summary:''
    },
    {
      id:'image',
      title:'Picture',
      summary:''
    },
    {
      id:'card',
      title:'Card',
      summary:'Card styling with theme defaults and per-card overrides. Reserved for Sprint 4.x.',
      hidden:true
    },
    {
      id:'text',
      title:'Text',
      summary:''
    },
    {
      id:'decoration',
      title:'Decoration',
      summary:''
    }
  ];

  const SCALE_MIN=0.25, SCALE_MAX=4, SCALE_STEP=0.05;
  // Sprint 6.5: Bigger ↔ Smaller is the only zoom control children see, and
  // the previous 0.25× – 4× range felt punishing. 0.5× – 3× still covers
  // every realistic case.
  const PICTURE_ZOOM_MIN=0.5, PICTURE_ZOOM_MAX=3, PICTURE_ZOOM_STEP=0.05;
  const MOVE_MIN=-300, MOVE_MAX=300;
  const DEFAULT_VIEW={scale:1,offsetX:0,offsetY:0,fit:'fit'};
  // Sprint 6.5 — picture border defaults.
  const BORDER_DEFAULTS={padding:20,fill:'page',cornerRadius:0,lineWidth:2,lineColor:'#000000',shadowIntensity:0.4};
  const BORDER_FILL_PRESETS=[
    {id:'none',label:'None'},
    {id:'white',label:'White'},
    {id:'black',label:'Black'},
    {id:'page',label:'Same as Page'}
  ];
  // Sprint 6.5 — Frame Designs. Each preset writes a complete border
  // configuration; the child can then tweak any value in Frame Style.
  const FRAME_DESIGNS=[
    {id:'simple',    label:'Simple',    border:{padding:0,  fill:'none',  cornerRadius:0,  line:{enabled:false}, shadow:{enabled:false}}},
    {id:'rounded',   label:'Rounded',   border:{padding:18, fill:'white', cornerRadius:30, line:{enabled:false}, shadow:{enabled:true, intensity:0.35}}},
    {id:'storybook', label:'Storybook', border:{padding:24, fill:'page',  cornerRadius:20, line:{enabled:false}, shadow:{enabled:false}}},
    {id:'polaroid',  label:'Polaroid',  border:{padding:28, fill:'white', cornerRadius:0,  line:{enabled:false}, shadow:{enabled:true, intensity:0.6}}},
    {id:'comic',     label:'Comic',     border:{padding:8,  fill:'white', cornerRadius:0,  line:{enabled:true,  width:6, color:'#000000'}, shadow:{enabled:false}}},
    {id:'cloud',     label:'Cloud',     border:{padding:16, fill:'white', cornerRadius:60, line:{enabled:false}, shadow:{enabled:true, intensity:0.25}}},
    {id:'ribbon',    label:'Ribbon',    border:{padding:14, fill:'page',  cornerRadius:10, line:{enabled:true,  width:3, color:'#D4AF37'}, shadow:{enabled:false}}},
    {id:'wooden',    label:'Wooden',    border:{padding:22, fill:'#8B6A45', cornerRadius:6, line:{enabled:true, width:4, color:'#4A361F'}, shadow:{enabled:true, intensity:0.5}}},
    {id:'magic',     label:'Magic',     border:{padding:18, fill:'page',  cornerRadius:30, line:{enabled:true,  width:4, color:'#7A4FB5'}, shadow:{enabled:true, intensity:0.7}}},
    {id:'vintage',   label:'Vintage',   border:{padding:20, fill:'#F4E6D0', cornerRadius:0, line:{enabled:true, width:2, color:'#8C5A2B'}, shadow:{enabled:true, intensity:0.45}}}
  ];

  let mountedContainer=null;
  let mountedRoot=null;
  let host=null;

  function getSections(){ return SECTIONS.slice(); }

  function _buildSection(s){
    const section=document.createElement('section');
    section.className='designer-group';
    section.setAttribute('data-card-section',s.id);

    const header=document.createElement('button');
    header.type='button';
    header.className='designer-group-title';
    header.setAttribute('aria-expanded','true');
    header.setAttribute('data-collapsible-toggle','');

    const text=document.createElement('span');
    text.className='designer-group-title-text';
    text.textContent=s.title;
    header.appendChild(text);

    // Sprint 8.4.3 — inheritance badge. "Theme" when no card override
    // for this section is set on the active slide; "This Page" when
    // the child has personalised it. Refreshed by _refreshInheritance.
    const badge=document.createElement('span');
    badge.className='card-section-badge';
    badge.setAttribute('data-card-section-badge',s.id);
    badge.textContent='Theme';
    header.appendChild(badge);

    const chev=document.createElement('span');
    chev.className='designer-group-chevron';
    chev.setAttribute('aria-hidden','true');
    chev.textContent='▾';
    header.appendChild(chev);

    section.appendChild(header);

    const body=document.createElement('div');
    body.className='designer-group-body';
    // Section body container — referenced by future control implementations
    // via `[data-card-section="..."] .card-section-body`.
    const sub=document.createElement('div');
    sub.className='card-section-body';
    sub.setAttribute('data-card-section-body',s.id);

    if(s.id==='image'){
      _buildImageControls(sub);
    }else if(s.id==='text'){
      _buildTextControls(sub);
    }else if(s.id==='sticker'){
      _buildStickerControls(sub);
    }else if(s.id==='frame'){
      _buildFrameControls(sub);
    }else if(s.id==='decoration'){
      _buildDecorationControls(sub);
    }else if(s.summary){
      const note=document.createElement('p');
      note.className='placeholder';
      note.textContent=s.summary;
      sub.appendChild(note);
    }

    body.appendChild(sub);
    section.appendChild(body);
    return section;
  }

  // Multiple Artwork Places Per Page — the current selection's own scene
  // id IS the Place id ('image-holder' for Place 1, unchanged; an extra
  // Place's own 'image-place-N' id otherwise). undefined preserves every
  // function below's exact pre-existing Place-1 behaviour.
  function _currentPlaceId(){
    if(!host||typeof host.getSelectedSceneElement!=='function') return undefined;
    let id=null;
    try{ id=host.getSelectedSceneElement(); }catch(e){}
    return (id && id!=='image-holder') ? id : undefined;
  }

  // Guardrails — "Can a Story Author change this? (its Frame, once
  // populated)". Reads the SAME resolved permissions Object Strip/hit-
  // testing already read (SlideRenderer.getPlacePermissions), so Frame
  // Look/Frame Style can never disagree with what the rest of Creator
  // already enforces for this Place. `_currentPlaceId()` returns
  // undefined for Place 1 by its own established convention — translated
  // to the real 'image-holder' id here before resolving permissions.
  // Absent SlideRenderer.getPlacePermissions (a legacy build) defaults to
  // true — never newly locks a control that was always unrestricted.
  function _currentPlaceEditable(){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getPlacePermissions!=='function') return true;
    const s=_currentSlide();
    if(!s) return true;
    const placeId=_currentPlaceId()||'image-holder';
    try{ return SlideRenderer.getPlacePermissions(s,placeId).editable!==false; }catch(e){ return true; }
  }

  // Multiple Artwork Places Per Page — `placeId` omitted preserves the
  // exact Place-1 (slide.metadata.cardOverrides.image) path below,
  // unchanged; a real id reads/creates that Place's own view bag under
  // slide.metadata.placeContent[placeId].imageView instead.
  function _placeViewBag(slide,placeId){
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.placeContent) slide.metadata.placeContent={};
    if(!slide.metadata.placeContent[placeId]) slide.metadata.placeContent[placeId]={};
    return slide.metadata.placeContent[placeId];
  }

  // Sprint 4.5: image overrides live at slide.metadata.cardOverrides.image.
  // Legacy data from Sprint 4.2 lived at slide.metadata.imageView and is
  // migrated on first access; this single getter ensures all later writes go
  // to the new path so saved projects converge without a schema bump.
  function _ensureView(slide,placeId){
    if(!slide) return null;
    if(placeId){
      const bag=_placeViewBag(slide,placeId);
      if(!bag.imageView) bag.imageView={scale:DEFAULT_VIEW.scale,offsetX:DEFAULT_VIEW.offsetX,offsetY:DEFAULT_VIEW.offsetY,fit:DEFAULT_VIEW.fit};
      return bag.imageView;
    }
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.image){
      if(slide.metadata.imageView){
        slide.metadata.cardOverrides.image=slide.metadata.imageView;
        delete slide.metadata.imageView;
      }else{
        slide.metadata.cardOverrides.image={scale:DEFAULT_VIEW.scale,offsetX:DEFAULT_VIEW.offsetX,offsetY:DEFAULT_VIEW.offsetY,fit:DEFAULT_VIEW.fit};
      }
    }
    return slide.metadata.cardOverrides.image;
  }

  function _readView(slide,placeId){
    if(!slide||!slide.metadata) return null;
    if(placeId){
      return (slide.metadata.placeContent && slide.metadata.placeContent[placeId] && slide.metadata.placeContent[placeId].imageView) || null;
    }
    if(slide.metadata.cardOverrides && slide.metadata.cardOverrides.image) return slide.metadata.cardOverrides.image;
    if(slide.metadata.imageView) return slide.metadata.imageView;
    return null;
  }

  function _currentSlide(){
    if(!host||typeof host.getCurrentSlide!=='function') return null;
    try{ return host.getCurrentSlide(); }catch(e){ return null; }
  }

  function _commit(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    _refreshImage();
  }

  // Sprint 9.6 — Museum Gallery Theme Support adds 'original' as a
  // third Holder mode alongside the pre-existing fit/fill. `mode` is
  // written explicitly (the new authoritative field — see
  // ImageViewEngine.normalize) and `fit` keeps being written too for
  // any older code path still reading it directly; 'original' writes
  // 'fit' as an inert placeholder since `mode` always wins once set.
  function _setMode(mode){
    const v=_ensureView(_currentSlide(),_currentPlaceId());
    if(!v) return;
    v.mode=(mode==='original')?'original':(mode==='fill')?'fill':'fit';
    v.fit=(mode==='fill')?'fill':'fit';
    _commit();
  }

  function _setScale(value){
    const v=_ensureView(_currentSlide(),_currentPlaceId());
    if(!v) return;
    let n=parseFloat(value);
    if(!isFinite(n)) n=1;
    if(n<SCALE_MIN) n=SCALE_MIN;
    if(n>SCALE_MAX) n=SCALE_MAX;
    v.scale=n;
    _commit();
  }

  function _setImageProp(key,value){
    const v=_ensureView(_currentSlide(),_currentPlaceId());
    if(!v) return;
    if(typeof value==='number' && !isFinite(value)) return;
    v[key]=value;
    _commit();
  }

  // Sprint 4.5 reset actions (composition-only, adjustments-only, full).
  // Multiple Artwork Places Per Page — `placeId` omitted preserves each
  // reset's exact Place-1 behaviour below, unchanged.
  function _pruneImage(slide,placeId){
    if(!slide||!slide.metadata) return;
    if(placeId){
      const bag=slide.metadata.placeContent && slide.metadata.placeContent[placeId];
      if(bag && bag.imageView && Object.keys(bag.imageView).length===0) delete bag.imageView;
      return;
    }
    if(!slide.metadata.cardOverrides) return;
    const img=slide.metadata.cardOverrides.image;
    if(img && Object.keys(img).length===0) delete slide.metadata.cardOverrides.image;
  }
  function _resetImageComposition(){
    const slide=_currentSlide();
    const placeId=_currentPlaceId();
    if(!slide) return;
    const img=_readView(slide,placeId);
    if(!img) return;
    COMPOSITION_KEYS.forEach(function(k){ delete img[k]; });
    _pruneImage(slide,placeId);
    _commit();
  }
  function _resetImageAdjustments(){
    const slide=_currentSlide();
    const placeId=_currentPlaceId();
    if(!slide) return;
    const img=_readView(slide,placeId);
    if(!img) return;
    ADJUSTMENT_KEYS.forEach(function(k){ delete img[k]; });
    _pruneImage(slide,placeId);
    _commit();
  }
  function _resetImage(){
    const slide=_currentSlide();
    const _resetPlaceId=_currentPlaceId();
    if(_resetPlaceId){
      if(slide && slide.metadata && slide.metadata.placeContent && slide.metadata.placeContent[_resetPlaceId]){
        delete slide.metadata.placeContent[_resetPlaceId].imageView;
      }
      _commit();
      return;
    }
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    delete slide.metadata.cardOverrides.image;
    _commit();
  }
  // Kept under its old name for backward compat with the Sprint 4.2 unit
  // test harness — the Composition reset replaces it conceptually.
  function _resetView(){ _resetImageComposition(); }

  // --- Image section builders ---------------------------------------------
  // Each control row is built via _makeImageSliderRow with consistent
  // chrome so spacing matches the Theme Designer's icon-row grid.
  function _makeImageSliderRow(parent,opts){
    const row=document.createElement('div');
    row.className='designer-row';
    const lbl=document.createElement('div');
    lbl.className='designer-row-label text-slider-label';
    const title=document.createElement('span');
    title.textContent=opts.labelText;
    lbl.appendChild(title);
    const val=document.createElement('span');
    val.className=opts.valueClass;
    val.textContent='—';
    lbl.appendChild(val);
    row.appendChild(lbl);
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(opts.min);
    slider.max=String(opts.max);
    slider.step=String(opts.step);
    slider.className=opts.sliderClass;
    slider.addEventListener('input',function(){ opts.onInput(parseFloat(slider.value)); });
    row.appendChild(slider);
    parent.appendChild(row);
  }

  function _makeImageSubgroup(parent,id,title){
    const sub=document.createElement('div');
    sub.className='image-subgroup';
    sub.setAttribute('data-image-group',id);
    const header=document.createElement('button');
    header.type='button';
    header.className='image-subgroup-title';
    header.setAttribute('aria-expanded','true');
    header.setAttribute('data-collapsible-toggle','');
    const t=document.createElement('span');
    t.className='image-subgroup-title-text';
    t.textContent=title;
    header.appendChild(t);
    const chev=document.createElement('span');
    chev.className='designer-group-chevron';
    chev.setAttribute('aria-hidden','true');
    chev.textContent='▾';
    header.appendChild(chev);
    sub.appendChild(header);
    const body=document.createElement('div');
    body.className='image-subgroup-body';
    sub.appendChild(body);
    parent.appendChild(sub);
    return body;
  }

  // Sprint 6.5 — Picture section: Show / Bigger ↔ Smaller / Move Left ↔
  // Right / Move Up ↔ Down / Start Over. Followed by the Picture Border
  // section. Legacy power-user data (crop, focal, straighten, brightness,
  // contrast, highlights, shadows, warmth, saturation, sharpness,
  // vignette) is still honoured by the renderer for existing projects;
  // a 9-year-old just no longer sees those knobs.
  function _buildImageControls(body){
    // Picture controls live directly under the section header — adding a
    // second "Picture" subgroup title would just duplicate the heading.
    const pic=document.createElement('div');
    pic.className='image-picture-block';
    body.appendChild(pic);

    // Show: Whole Picture / Fill the Box  (internal: fit / fill)
    const showRow=document.createElement('div');
    showRow.className='designer-row';
    const showLabel=document.createElement('div');
    showLabel.className='designer-row-label';
    showLabel.textContent='Show';
    showRow.appendChild(showLabel);
    const showIcons=document.createElement('div');
    showIcons.className='icon-row image-mode-row';
    [['fit','Whole Picture'],['fill','Fill the Box'],['original','Actual Size']].forEach(function(pair){
      const id=pair[0], name=pair[1];
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card image-mode-btn';
      btn.setAttribute('data-mode',id);
      const pv=document.createElement('span');
      pv.className='icon-preview';
      const glyph=document.createElement('span');
      glyph.className='image-mode-glyph image-mode-glyph-'+id;
      pv.appendChild(glyph);
      btn.appendChild(pv);
      const lbl=document.createElement('span');
      lbl.className='icon-label';
      lbl.textContent=name;
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){ _setMode(id); });
      showIcons.appendChild(btn);
    });
    showRow.appendChild(showIcons);
    pic.appendChild(showRow);

    // Bigger ↔ Smaller (zoom)
    _makeImageSliderRow(pic,{
      labelText:'Bigger ↔ Smaller',valueClass:'image-scale-value',sliderClass:'image-scale-slider',
      min:PICTURE_ZOOM_MIN,max:PICTURE_ZOOM_MAX,step:PICTURE_ZOOM_STEP,
      onInput:function(v){ _setScale(v); }
    });

    // Move Left ↔ Right (offsetX). Snap to 0 inside a 1px deadzone so the
    // override stays absent when the slider is dead-centered.
    _makeImageSliderRow(pic,{
      labelText:'Move Left ↔ Right',valueClass:'image-offsetx-value',sliderClass:'image-offsetx-slider',
      min:MOVE_MIN,max:MOVE_MAX,step:1,
      onInput:function(v){
        const view=_ensureView(_currentSlide(),_currentPlaceId());
        if(!view) return;
        if(Math.abs(v)<0.5) delete view.offsetX; else view.offsetX=Math.round(v);
        _commit();
      }
    });

    // Move Up ↔ Down (offsetY)
    _makeImageSliderRow(pic,{
      labelText:'Move Up ↔ Down',valueClass:'image-offsety-value',sliderClass:'image-offsety-slider',
      min:MOVE_MIN,max:MOVE_MAX,step:1,
      onInput:function(v){
        const view=_ensureView(_currentSlide(),_currentPlaceId());
        if(!view) return;
        if(Math.abs(v)<0.5) delete view.offsetY; else view.offsetY=Math.round(v);
        _commit();
      }
    });

    // Start Over (resets the picture view + adjustments).
    const startRow=document.createElement('div');
    startRow.className='picture-actions-row';
    const startBtn=document.createElement('button');
    startBtn.type='button';
    startBtn.className='picture-reset-btn picture-reset-image-btn';
    startBtn.textContent='↺ Start Over';
    startBtn.addEventListener('click',_resetImage);
    startRow.appendChild(startBtn);
    pic.appendChild(startRow);

    _buildFrameLookControls(body);
    _buildBorderControls(body);

    // Sprint 9.4 — Frame Look's visibility (the whole "frameStyle"
    // preset subgroup, tagged in _buildFrameLookControls) is decided at
    // this level. Uses applyLayout (not layout) deliberately: at this
    // container level the only tagged direct child is the frameStyle
    // subgroup itself — layout() would try to build any unresolved
    // catalog id (paper/mat) directly here too, duplicating the ones
    // Frame Style already builds one level down.
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.applyLayout(body,WorkspaceBuilder.getControlIds('frame'));
    }

    // Sprint 9.4 — Artwork Presentation: a new, additive subgroup for
    // Holder → Image controls (Presentation / Frame preset / Lighting /
    // Caption). Built once at mount like every other subgroup; hidden
    // entirely when the active workspace theme lists nothing for
    // 'holder.image' so a theme with no opinion here never leaves an
    // empty section visible.
    const artworkBody=_makeImageSubgroup(body,'artwork-presentation','Artwork Presentation');
    const artworkSub=artworkBody.parentNode;
    // Retro Guardrails Audit — shares the same lock note wording/toggle
    // as Frame Look; both live under one "its Frame" guardrail.
    const artworkLockNote=document.createElement('p');
    artworkLockNote.className='placeholder frame-editable-lock-note artwork-presentation-lock-note hidden';
    artworkLockNote.textContent='This Place’s look was set by the World and can’t be changed here.';
    artworkBody.insertBefore(artworkLockNote,artworkBody.firstChild);
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(artworkBody,'holder.image',{getSlide:_currentSlide,onChange:_commit,getPlaceId:_currentPlaceId,getPlaceEditable:_currentPlaceEditable},artworkSub);
    }
  }

  // Sprint 6.5 (Object Designer) — Frame Look section. A row of preset
  // cards that write a complete border configuration to
  // cardOverrides.border. Children can still tweak any value in Frame Style.
  function _buildFrameLookControls(body){
    const fl=_makeImageSubgroup(body,'frame-look','Frame Look');
    // Sprint 9.4 — the whole subgroup is one theme-driven "frame" panel
    // control (fl.parentNode is the .image-subgroup wrapper _makeImageSubgroup
    // built and already appended to `body`; tag it there rather than
    // changing _makeImageSubgroup's return shape).
    fl.parentNode.setAttribute('data-control','frameStyle');
    // Guardrails — shown only when the selected Place's Frame is locked
    // by its Builder author; toggled in _refreshFrameWorkspace().
    const lockNote=document.createElement('p');
    lockNote.className='placeholder frame-editable-lock-note hidden';
    lockNote.textContent='This Place’s Frame was set by the World and can’t be changed here.';
    fl.appendChild(lockNote);
    const grid=document.createElement('div');
    grid.className='icon-row frame-design-row';
    FRAME_DESIGNS.forEach(function(p){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card frame-design-btn';
      btn.setAttribute('data-frame-design',p.id);
      const pv=document.createElement('span');
      pv.className='icon-preview frame-design-preview frame-design-preview-'+p.id;
      btn.appendChild(pv);
      const lbl=document.createElement('span');
      lbl.className='icon-label';
      lbl.textContent=p.label;
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){ _applyFrameDesign(p); });
      grid.appendChild(btn);
    });
    fl.appendChild(grid);
  }

  function _applyFrameDesign(preset){
    const slide=_currentSlide();
    if(!slide) return;
    // Guardrails — defensive: the button itself is disabled when the
    // selected Place's Frame isn't editable (see _refreshFrameWorkspace),
    // but refuse the write here too in case something else calls this
    // directly.
    if(!_currentPlaceEditable()) return;
    // Deep-clone the preset's border config so future mutations don't
    // leak across presets. Sprint 6.5.1 — embed the design id inside the
    // border object so the renderer can dispatch per-design ornament.
    const cfg=JSON.parse(JSON.stringify(preset.border));
    cfg.design=preset.id;
    // Multiple Artwork Places Per Page — a real Place must write to its
    // own storage; omitted (Place 1) keeps the exact pre-existing path.
    const placeId=_currentPlaceId();
    if(placeId){
      const bag=_placeViewBag(slide,placeId);
      if(!bag.cardOverrides) bag.cardOverrides={};
      bag.cardOverrides.border=cfg;
      bag.cardOverrides.frameDesign=preset.id;
    }else{
      if(!slide.metadata) slide.metadata={};
      if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
      slide.metadata.cardOverrides.border=cfg;
      slide.metadata.cardOverrides.frameDesign=preset.id;
    }
    _commit();
  }

  // Sprint 6.5.1 — render a single Frame Design swatch into a 64×56 canvas
  // by calling into SlideRenderer.drawFrameSwatch, then dispose the canvas
  // by returning its data URL. Children pick frames by sight, not by name.
  function _generateFrameThumb(preset){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.drawFrameSwatch!=='function') return null;
    const W=86, H=64;
    const c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    // Page-coloured background so the swatch reads like a real preview tile.
    let pageColor='#1D3457';
    try{
      if(typeof ThemeEngine!=='undefined'){
        const t=ThemeEngine.getActiveTheme();
        const opts=ThemeEngine.getOptions();
        if(t && t.frame){
          pageColor=(typeof ThemeEngine.resolveFrameColor==='function')
            ? ThemeEngine.resolveFrameColor(t, opts && opts.variant)
            : t.frame.color;
        }
      }
    }catch(e){}
    ctx.fillStyle=pageColor;
    ctx.fillRect(0,0,W,H);
    const M=4;
    const rect={x:M, y:M, w:W-M*2, h:H-M*2};
    // The renderer expects a fully-resolved border object — clone the
    // preset and stamp the design id so dispatch fires.
    const border=Object.assign({}, JSON.parse(JSON.stringify(preset.border)), {design:preset.id});
    // Make sure derived flags read as the renderer expects.
    const line=border.line||{};
    const shadow=border.shadow||{};
    const renderBorder={
      design: preset.id,
      padding: Math.max(2, Math.min(14, Math.round((border.padding||20)*0.35))),
      fill: border.fill||'page',
      cornerRadius: Math.round((border.cornerRadius||0)*0.45),
      lineEnabled: !!line.enabled,
      lineWidth: Math.max(1, Math.round((line.width||2)*0.6)),
      lineColor: line.color||'#000000',
      shadowEnabled: !!shadow.enabled,
      shadowIntensity: typeof shadow.intensity==='number'?shadow.intensity:0.4
    };
    let theme=null;
    try{ theme=(typeof ThemeEngine!=='undefined')?ThemeEngine.getActiveTheme():null; }catch(e){}
    SlideRenderer.drawFrameSwatch(ctx, rect, renderBorder, theme);
    return c.toDataURL('image/png');
  }

  function _refreshFrameThumbs(){
    if(!mountedRoot) return;
    FRAME_DESIGNS.forEach(function(preset){
      const btn=mountedRoot.querySelector('.frame-design-btn[data-frame-design="'+preset.id+'"]');
      if(!btn) return;
      const pv=btn.querySelector('.frame-design-preview');
      if(!pv) return;
      try{
        const url=_generateFrameThumb(preset);
        if(url){
          pv.style.backgroundImage='url("'+url+'")';
          pv.style.backgroundSize='cover';
          pv.style.backgroundPosition='center';
          pv.classList.add('frame-design-preview-rendered');
        }
      }catch(e){}
    });
  }

  // Sprint 6.5 — Frame Style section (was "Picture Border" in the first
  // iteration; renamed so the child sees Frame Look + Frame Style as the
  // two ways the picture's frame can be customised).
  function _buildBorderControls(body){
    const bg=_makeImageSubgroup(body,'border','Frame Style');

    // Sprint 9.4 — Frame Style's fields are grouped into four theme-
    // driven controls (fill / border / radius / shadow) plus two new
    // ones (paper / mat) built by WorkspaceBuilder. Each wrapper is a
    // direct child of `bg` so WorkspaceBuilder.layout can show/hide/
    // reorder them without touching a single field's wiring below.
    const fillGroup=document.createElement('div');
    fillGroup.setAttribute('data-control','fill');
    bg.appendChild(fillGroup);
    const borderGroup=document.createElement('div');
    borderGroup.setAttribute('data-control','border');
    bg.appendChild(borderGroup);
    const radiusGroup=document.createElement('div');
    radiusGroup.setAttribute('data-control','radius');
    bg.appendChild(radiusGroup);
    const shadowGroup=document.createElement('div');
    shadowGroup.setAttribute('data-control','shadow');
    bg.appendChild(shadowGroup);

    // Border Size (padding) — Tiny ↔ Big
    _makeImageSliderRow(borderGroup,{
      labelText:'Border Size',valueClass:'border-padding-value',sliderClass:'border-padding-slider',
      min:0,max:60,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide(),_currentPlaceId());
        if(!b) return;
        if(Math.round(v)===BORDER_DEFAULTS.padding) delete b.padding; else b.padding=Math.round(v);
        _commitBorder();
      }
    });

    // Border Color — chips: None / White / Black / Same as Page / Pick a Color
    const colorRow=document.createElement('div');
    colorRow.className='designer-row';
    const colorLabel=document.createElement('div');
    colorLabel.className='designer-row-label';
    colorLabel.textContent='Border Color';
    colorRow.appendChild(colorLabel);
    const chips=document.createElement('div');
    chips.className='icon-row border-fill-row';
    BORDER_FILL_PRESETS.forEach(function(p){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card border-fill-btn';
      btn.setAttribute('data-fill',p.id);
      const pv=document.createElement('span');
      pv.className='icon-preview border-fill-preview border-fill-preview-'+p.id;
      btn.appendChild(pv);
      const lbl=document.createElement('span');
      lbl.className='icon-label';
      lbl.textContent=p.label;
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){
        const b=_ensureBorder(_currentSlide(),_currentPlaceId());
        if(!b) return;
        if(p.id==='page') delete b.fill; else b.fill=p.id;
        _commitBorder();
      });
      chips.appendChild(btn);
    });
    // Pick a Color chip (hides a color input inside the card).
    const customWrap=document.createElement('button');
    customWrap.type='button';
    customWrap.className='icon-card border-fill-btn border-fill-custom';
    customWrap.setAttribute('data-fill','custom');
    const customPv=document.createElement('span');
    customPv.className='icon-preview border-fill-preview border-fill-preview-custom';
    customWrap.appendChild(customPv);
    const customColor=document.createElement('input');
    customColor.type='color';
    customColor.className='border-fill-custom-input';
    customColor.value='#FFFFFF';
    customColor.addEventListener('input',function(){
      const b=_ensureBorder(_currentSlide(),_currentPlaceId());
      if(!b) return;
      b.fill=customColor.value;
      _commitBorder();
    });
    customWrap.appendChild(customColor);
    const customLbl=document.createElement('span');
    customLbl.className='icon-label';
    customLbl.textContent='Pick a Color';
    customWrap.appendChild(customLbl);
    customWrap.addEventListener('click',function(e){
      // Avoid bubbling into the native click that already opens the picker.
      if(e.target!==customColor) customColor.click();
    });
    chips.appendChild(customWrap);
    colorRow.appendChild(chips);
    fillGroup.appendChild(colorRow);

    // Round Corners — Square ↔ Round
    _makeImageSliderRow(radiusGroup,{
      labelText:'Round Corners',valueClass:'border-radius-value',sliderClass:'border-radius-slider',
      min:0,max:80,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide(),_currentPlaceId());
        if(!b) return;
        if(Math.round(v)===0) delete b.cornerRadius; else b.cornerRadius=Math.round(v);
        _commitBorder();
      }
    });

    // Border Line (on/off + width + color)
    _buildToggleRow(borderGroup,'Border Line','border-line-toggle',function(checked){
      const b=_ensureBorder(_currentSlide(),_currentPlaceId());
      if(!b) return;
      b.line=b.line||{};
      if(checked) b.line.enabled=true; else delete b.line.enabled;
      _commitBorder();
    });
    _makeImageSliderRow(borderGroup,{
      labelText:'Line Width',valueClass:'border-line-width-value',sliderClass:'border-line-width-slider',
      min:1,max:12,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide(),_currentPlaceId());
        if(!b) return;
        b.line=b.line||{};
        if(Math.round(v)===BORDER_DEFAULTS.lineWidth) delete b.line.width; else b.line.width=Math.round(v);
        _commitBorder();
      }
    });
    const lineColorRow=document.createElement('div');
    lineColorRow.className='designer-row';
    const lineColorLabel=document.createElement('div');
    lineColorLabel.className='designer-row-label';
    lineColorLabel.textContent='Line Color';
    lineColorRow.appendChild(lineColorLabel);
    const lineColorInput=document.createElement('input');
    lineColorInput.type='color';
    lineColorInput.className='border-line-color-input';
    lineColorInput.value=BORDER_DEFAULTS.lineColor;
    lineColorInput.addEventListener('input',function(){
      const b=_ensureBorder(_currentSlide(),_currentPlaceId());
      if(!b) return;
      b.line=b.line||{};
      b.line.color=lineColorInput.value;
      _commitBorder();
    });
    lineColorRow.appendChild(lineColorInput);
    borderGroup.appendChild(lineColorRow);

    // Shadow (on/off + intensity)
    _buildToggleRow(shadowGroup,'Shadow','border-shadow-toggle',function(checked){
      const b=_ensureBorder(_currentSlide(),_currentPlaceId());
      if(!b) return;
      b.shadow=b.shadow||{};
      if(checked) b.shadow.enabled=true; else delete b.shadow.enabled;
      _commitBorder();
    });
    _makeImageSliderRow(shadowGroup,{
      labelText:'Light ↔ Dark',valueClass:'border-shadow-value',sliderClass:'border-shadow-slider',
      min:0,max:1,step:0.01,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide(),_currentPlaceId());
        if(!b) return;
        b.shadow=b.shadow||{};
        const n=Math.round(v*100)/100;
        if(Math.abs(n-BORDER_DEFAULTS.shadowIntensity)<0.005) delete b.shadow.intensity; else b.shadow.intensity=n;
        _commitBorder();
      }
    });

    // Sprint 9.4 — show/hide/reorder fill/border/radius/shadow per the
    // active workspace theme, and build Paper/Mat (new, inert this
    // sprint — see workspaceBuilder.js header) if the theme lists them.
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(bg,'frame',{getSlide:_currentSlide,onChange:_commitBorder,getPlaceId:_currentPlaceId});
    }

    // Reset Border — a trailer action, always last regardless of the
    // theme-driven order above (appended after WorkspaceBuilder.layout
    // so it's never one of the elements that gets reordered).
    const resetRow=document.createElement('div');
    resetRow.className='picture-actions-row';
    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='picture-reset-btn picture-reset-border-btn';
    resetBtn.textContent='↺ Reset Border';
    resetBtn.addEventListener('click',_resetBorder);
    resetRow.appendChild(resetBtn);
    bg.appendChild(resetRow);
  }

  function _buildToggleRow(parent,labelText,toggleClass,onChange){
    const row=document.createElement('div');
    row.className='designer-row border-toggle-row';
    const lbl=document.createElement('div');
    lbl.className='designer-row-label';
    lbl.textContent=labelText;
    row.appendChild(lbl);
    const toggle=document.createElement('label');
    toggle.className='border-toggle';
    const input=document.createElement('input');
    input.type='checkbox';
    input.className=toggleClass;
    toggle.appendChild(input);
    const swText=document.createElement('span');
    swText.className='border-toggle-text';
    swText.textContent='On';
    toggle.appendChild(swText);
    row.appendChild(toggle);
    parent.appendChild(row);
    input.addEventListener('change',function(){ onChange(input.checked); });
  }

  // Sprint 6.5 — border data lives under slide.metadata.cardOverrides.border.
  // Multiple Artwork Places Per Page — `placeId` omitted preserves the
  // exact Place-1 path below, unchanged; a real id reads/creates that
  // Place's own bag under slide.metadata.placeContent[placeId].cardOverrides.border
  // instead, mirroring _ensureView/_readView's own placeId convention.
  function _ensureBorder(slide,placeId){
    if(!slide) return null;
    if(placeId){
      const bag=_placeViewBag(slide,placeId);
      if(!bag.cardOverrides) bag.cardOverrides={};
      if(!bag.cardOverrides.border) bag.cardOverrides.border={};
      return bag.cardOverrides.border;
    }
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.border) slide.metadata.cardOverrides.border={};
    return slide.metadata.cardOverrides.border;
  }
  function _readBorder(slide,placeId){
    if(!slide||!slide.metadata) return null;
    if(placeId){
      const bag=slide.metadata.placeContent && slide.metadata.placeContent[placeId];
      return (bag && bag.cardOverrides && bag.cardOverrides.border) || null;
    }
    if(!slide.metadata.cardOverrides) return null;
    return slide.metadata.cardOverrides.border||null;
  }
  function _pruneBorder(slide,placeId){
    if(!slide||!slide.metadata) return;
    if(placeId){
      const bag=slide.metadata.placeContent && slide.metadata.placeContent[placeId];
      const b=bag && bag.cardOverrides && bag.cardOverrides.border;
      if(!b) return;
      if(b.line && Object.keys(b.line).length===0) delete b.line;
      if(b.shadow && Object.keys(b.shadow).length===0) delete b.shadow;
      if(Object.keys(b).length===0) delete bag.cardOverrides.border;
      return;
    }
    if(!slide.metadata.cardOverrides) return;
    const b=slide.metadata.cardOverrides.border;
    if(!b) return;
    if(b.line && Object.keys(b.line).length===0) delete b.line;
    if(b.shadow && Object.keys(b.shadow).length===0) delete b.shadow;
    if(Object.keys(b).length===0) delete slide.metadata.cardOverrides.border;
  }
  function _commitBorder(){
    _pruneBorder(_currentSlide(),_currentPlaceId());
    _commit();
  }
  function _resetBorder(){
    const slide=_currentSlide();
    const placeId=_currentPlaceId();
    if(!slide||!slide.metadata) return;
    if(placeId){
      const bag=slide.metadata.placeContent && slide.metadata.placeContent[placeId];
      if(bag && bag.cardOverrides) delete bag.cardOverrides.border;
      _commit();
      return;
    }
    if(!slide.metadata.cardOverrides) return;
    delete slide.metadata.cardOverrides.border;
    _commit();
  }

  // Sprint 6.5 — Picture-section effective values. Legacy power-user keys
  // (crop / focal / straighten / brightness / etc.) still render from
  // saved projects but aren't exposed in the UI any more. `placeId`
  // omitted preserves the exact Place-1 lookup below, unchanged.
  function _effectiveImageView(slide,placeId){
    const v=_readView(slide,placeId) || {};
    return {
      fit:v.fit||'fit',
      // Sprint 9.6 — `mode` is authoritative when set (see
      // ImageViewEngine.normalize); every pre-9.6 project only ever has
      // `fit`, so this falls through to it unchanged.
      mode:v.mode||v.fit||'fit',
      scale:(typeof v.scale==='number')?v.scale:1,
      offsetX:(typeof v.offsetX==='number')?v.offsetX:0,
      offsetY:(typeof v.offsetY==='number')?v.offsetY:0
    };
  }

  function _refreshImage(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const placeId=_currentPlaceId();
    const eff=_effectiveImageView(s,placeId);
    // Multiple Artwork Places Per Page — whether the SELECTED Place has
    // a picture yet, not always Place 1's.
    const hasImage=placeId
      ? !!(s && s._placeImages && s._placeImages[placeId] && s._placeImages[placeId].width)
      : !!(s && s.image);
    mountedRoot.querySelectorAll('.image-mode-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-mode')===eff.mode);
      b.disabled=!hasImage;
    });
    function setSlider(sel,valueSel,value,fmt){
      const sl=mountedRoot.querySelector(sel);
      const vl=mountedRoot.querySelector(valueSel);
      if(sl){ sl.value=String(value); sl.disabled=!hasImage; }
      if(vl) vl.textContent=fmt(value);
    }
    setSlider('.image-scale-slider','.image-scale-value',eff.scale,function(v){ return v.toFixed(2)+'×'; });
    setSlider('.image-offsetx-slider','.image-offsetx-value',eff.offsetX,function(v){ return Math.round(v)+'px'; });
    setSlider('.image-offsety-slider','.image-offsety-value',eff.offsetY,function(v){ return Math.round(v)+'px'; });
    mountedRoot.querySelectorAll('.picture-reset-btn').forEach(function(btn){ btn.disabled=!hasImage; });
    _refreshBorder();
    _refreshFrameWorkspace();
  }

  // Sprint 9.4 — re-run the theme-driven layout for the Frame panel
  // (Frame Look visibility + Frame Style's fill/border/radius/shadow/
  // paper/mat) and the Holder → Image "Artwork Presentation" subgroup.
  // Called on every image refresh (slide switch, control commit) so a
  // theme change picked up via ThemeEngine._refreshUI -> CardDesigner.
  // refresh() -> here rebuilds the right panel immediately, no reload.
  function _refreshFrameWorkspace(){
    if(!mountedRoot || typeof WorkspaceBuilder==='undefined') return;
    const imageBody=mountedRoot.querySelector('[data-card-section-body="image"]');
    if(!imageBody) return;
    // Retro Guardrails Audit — "its Frame" covers the whole look-and-
    // feel group, not just Frame Look/Style: paper/mat (also part of
    // the 'frame' panel, via WorkspaceBuilder) and every Artwork
    // Presentation control (Frame Variation/Presentation/Lighting/
    // Caption, the 'holder.image' panel) lock together with it when a
    // Place's editable guardrail is false — one checkbox, one meaning.
    const ctx={getSlide:_currentSlide,onChange:_commit,getPlaceId:_currentPlaceId,getPlaceEditable:_currentPlaceEditable};
    const borderCtx={getSlide:_currentSlide,onChange:_commitBorder,getPlaceId:_currentPlaceId,getPlaceEditable:_currentPlaceEditable};
    WorkspaceBuilder.applyLayout(imageBody,WorkspaceBuilder.getControlIds('frame'));
    const frameStyleBody=imageBody.querySelector('[data-image-group="border"] .image-subgroup-body');
    if(frameStyleBody) WorkspaceBuilder.layout(frameStyleBody,'frame',borderCtx);
    const artworkSub=imageBody.querySelector('[data-image-group="artwork-presentation"]');
    const artworkBody=imageBody.querySelector('[data-image-group="artwork-presentation"] .image-subgroup-body');
    if(artworkBody) WorkspaceBuilder.layout(artworkBody,'holder.image',ctx,artworkSub);

    // Guardrails — "Can a Story Author change this? (its Frame, once
    // populated)". Frame Look's preset swatches are theme-authored data
    // presented as plain buttons (not a WorkspaceBuilder control), so
    // they're gated here directly rather than through applyLayout.
    const editable=_currentPlaceEditable();
    mountedRoot.querySelectorAll('.frame-design-btn').forEach(function(btn){ btn.disabled=!editable; });
    // Retro Guardrails Audit — toggles BOTH lock notes (Frame Look's own
    // and the new Artwork Presentation one) with the same querySelectorAll,
    // since both now share the .frame-editable-lock-note class.
    mountedRoot.querySelectorAll('.frame-editable-lock-note').forEach(function(note){ note.classList.toggle('hidden', editable); });
  }

  function _refreshBorder(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const placeId=_currentPlaceId();
    const b=_readBorder(s,placeId)||{};
    const line=b.line||{};
    const shadow=b.shadow||{};
    const padding=(typeof b.padding==='number')?b.padding:BORDER_DEFAULTS.padding;
    const cornerRadius=(typeof b.cornerRadius==='number')?b.cornerRadius:BORDER_DEFAULTS.cornerRadius;
    const lineEnabled=!!line.enabled;
    const lineWidth=(typeof line.width==='number')?line.width:BORDER_DEFAULTS.lineWidth;
    const lineColor=line.color||BORDER_DEFAULTS.lineColor;
    const shadowEnabled=!!shadow.enabled;
    const shadowIntensity=(typeof shadow.intensity==='number')?shadow.intensity:BORDER_DEFAULTS.shadowIntensity;
    const fillSetting=b.fill||'page';
    // Multiple Artwork Places Per Page — whether the SELECTED Place has
    // a picture yet, not always Place 1's (mirrors _refreshImage's own
    // hasImage computation).
    const hasImage=placeId
      ? !!(s && s._placeImages && s._placeImages[placeId] && s._placeImages[placeId].width)
      : !!(s && s.image);
    // Guardrails — "Can a Story Author change this? (its Frame, once
    // populated)". Every Frame Style control below folds this in
    // alongside hasImage, exactly the same disables-controls pattern
    // already used for "no picture yet."
    const editable=_currentPlaceEditable();
    const locked=!hasImage||!editable;

    function setSlider(sel,valueSel,value,fmt,disabled){
      const sl=mountedRoot.querySelector(sel);
      const vl=mountedRoot.querySelector(valueSel);
      if(sl){ sl.value=String(value); sl.disabled=!!disabled; }
      if(vl) vl.textContent=fmt(value);
    }
    setSlider('.border-padding-slider','.border-padding-value',padding,function(v){ return Math.round(v)+'px'; },locked);
    setSlider('.border-radius-slider','.border-radius-value',cornerRadius,function(v){ return Math.round(v)+'px'; },locked);
    setSlider('.border-line-width-slider','.border-line-width-value',lineWidth,function(v){ return Math.round(v)+'px'; },locked||!lineEnabled);
    setSlider('.border-shadow-slider','.border-shadow-value',shadowIntensity,function(v){ return Math.round(v*100)+'%'; },locked||!shadowEnabled);

    // Active fill chip
    const isCustom=typeof fillSetting==='string' && fillSetting.charAt(0)==='#';
    const activeFill=isCustom?'custom':fillSetting;
    mountedRoot.querySelectorAll('.border-fill-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-fill')===activeFill);
      btn.disabled=locked;
    });

    const lineToggle=mountedRoot.querySelector('.border-line-toggle');
    if(lineToggle){ lineToggle.checked=lineEnabled; lineToggle.disabled=locked; }
    const shadowToggle=mountedRoot.querySelector('.border-shadow-toggle');
    if(shadowToggle){ shadowToggle.checked=shadowEnabled; shadowToggle.disabled=locked; }

    const lineColorInput=mountedRoot.querySelector('.border-line-color-input');
    if(lineColorInput){ lineColorInput.value=_normalizeColor(lineColor); lineColorInput.disabled=locked||!lineEnabled; }
    const customColorInput=mountedRoot.querySelector('.border-fill-custom-input');
    if(customColorInput){
      if(isCustom) customColorInput.value=_normalizeColor(fillSetting);
      customColorInput.disabled=locked;
    }
  }

  // --- Sticker section (Sprint 6.6 — Object Designer for stickers) --------
  // Surfaced when a sticker is the active selection. Everything is live;
  // no Apply button. The section reuses the same designer-row /
  // icon-card chrome as the rest of the Card Designer so children see a
  // consistent visual language.

  function _selectedStickerHostId(){
    // The selected sticker id comes from the same scene-selection channel
    // app.js exposes via host.getSelectedSceneElement. We deliberately go
    // through the host so CardDesigner stays decoupled from the global
    // selection state.
    if(host && typeof host.getSelectedSceneElement==='function'){
      try{ return host.getSelectedSceneElement(); }catch(e){}
    }
    return null;
  }
  function _selectedStickerType(){
    if(host && typeof host.getSelectedSceneElementType==='function'){
      try{ return host.getSelectedSceneElementType(); }catch(e){}
    }
    return null;
  }

  function _activeSticker(){
    if(typeof SceneEngine==='undefined') return null;
    const slide=_currentSlide();
    if(!slide) return null;
    const id=_selectedStickerHostId();
    if(!id) return null;
    return SceneEngine.findSticker(slide,id);
  }
  function _commitSticker(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    _refreshSticker();
  }
  function _stickerUpdate(changes){
    if(typeof SceneEngine==='undefined') return;
    const slide=_currentSlide();
    const id=_selectedStickerHostId();
    if(!slide||!id) return;
    SceneEngine.updateSticker(slide,id,changes);
    _commitSticker();
  }

  function _buildStickerControls(body){
    const empty=document.createElement('p');
    empty.className='placeholder sticker-empty';
    empty.textContent='Pick a sticker on the page to edit it.';
    body.appendChild(empty);

    const editor=document.createElement('div');
    editor.className='sticker-editor hidden';

    const selectedLabel=document.createElement('div');
    selectedLabel.className='sticker-selected-label';
    selectedLabel.textContent='Sticker';
    editor.appendChild(selectedLabel);

    // Size — Bigger ↔ Smaller (uniform scale, preserves aspect ratio).
    const sizeRow=document.createElement('div');
    sizeRow.className='designer-row';
    const sizeLbl=document.createElement('div');
    sizeLbl.className='designer-row-label text-slider-label';
    const sizeTitle=document.createElement('span');
    sizeTitle.textContent='Size';
    sizeLbl.appendChild(sizeTitle);
    const sizeVal=document.createElement('span');
    sizeVal.className='sticker-size-value';
    sizeVal.textContent='—';
    sizeLbl.appendChild(sizeVal);
    sizeRow.appendChild(sizeLbl);
    const sizeSlider=document.createElement('input');
    sizeSlider.type='range';
    sizeSlider.min='60';
    sizeSlider.max='900';
    sizeSlider.step='1';
    sizeSlider.className='sticker-size-slider';
    sizeSlider.addEventListener('input',function(){
      const st=_activeSticker();
      if(!st) return;
      const target=parseFloat(sizeSlider.value);
      const aspect=(st.w&&st.h)?(st.w/st.h):1;
      _stickerUpdate({w:Math.round(target), h:Math.round(target/aspect)});
    });
    sizeRow.appendChild(sizeSlider);
    editor.appendChild(sizeRow);

    // Rotation — Spin ↺ ↻.
    const rotRow=document.createElement('div');
    rotRow.className='designer-row';
    const rotLbl=document.createElement('div');
    rotLbl.className='designer-row-label text-slider-label';
    const rotTitle=document.createElement('span');
    rotTitle.textContent='Spin';
    rotLbl.appendChild(rotTitle);
    const rotVal=document.createElement('span');
    rotVal.className='sticker-rotation-value';
    rotVal.textContent='0°';
    rotLbl.appendChild(rotVal);
    rotRow.appendChild(rotLbl);
    const rotSlider=document.createElement('input');
    rotSlider.type='range';
    rotSlider.min='-180';
    rotSlider.max='180';
    rotSlider.step='1';
    rotSlider.className='sticker-rotation-slider';
    rotSlider.addEventListener('input',function(){
      _stickerUpdate({rotation:parseFloat(rotSlider.value)});
    });
    rotRow.appendChild(rotSlider);
    editor.appendChild(rotRow);

    // Opacity — See Through.
    const opRow=document.createElement('div');
    opRow.className='designer-row';
    const opLbl=document.createElement('div');
    opLbl.className='designer-row-label text-slider-label';
    const opTitle=document.createElement('span');
    opTitle.textContent='See Through';
    opLbl.appendChild(opTitle);
    const opVal=document.createElement('span');
    opVal.className='sticker-opacity-value';
    opVal.textContent='100%';
    opLbl.appendChild(opVal);
    opRow.appendChild(opLbl);
    const opSlider=document.createElement('input');
    opSlider.type='range';
    opSlider.min='0';
    opSlider.max='1';
    opSlider.step='0.01';
    opSlider.className='sticker-opacity-slider';
    opSlider.addEventListener('input',function(){
      _stickerUpdate({opacity:Math.round(parseFloat(opSlider.value)*100)/100});
    });
    opRow.appendChild(opSlider);
    editor.appendChild(opRow);

    // Flip row — Flip Left/Right + Flip Up/Down.
    const flipRow=document.createElement('div');
    flipRow.className='designer-row';
    const flipLbl=document.createElement('div');
    flipLbl.className='designer-row-label';
    flipLbl.textContent='Flip';
    flipRow.appendChild(flipLbl);
    const flipIcons=document.createElement('div');
    flipIcons.className='icon-row sticker-flip-row';
    [['flipX','Left ↔ Right','↔','flipX'],['flipY','Up ↔ Down','↕','flipY']].forEach(function(t){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card sticker-flip-btn';
      btn.setAttribute('data-flip',t[0]);
      const pv=document.createElement('span'); pv.className='icon-preview';
      const g=document.createElement('span'); g.className='sticker-flip-glyph'; g.textContent=t[2]; pv.appendChild(g);
      btn.appendChild(pv);
      const lbl=document.createElement('span'); lbl.className='icon-label'; lbl.textContent=t[1]; btn.appendChild(lbl);
      btn.addEventListener('click',function(){
        const st=_activeSticker();
        if(!st) return;
        const upd={};
        upd[t[0]]=!st[t[0]];
        _stickerUpdate(upd);
      });
      flipIcons.appendChild(btn);
    });
    flipRow.appendChild(flipIcons);
    editor.appendChild(flipRow);

    // Layer ordering moved to the Object Strip's own drag-to-reorder
    // (per direct product feedback: "remove any reordering function from
    // the right panel") — the Order row that used to live here is gone;
    // SlideRenderer.getReorderableIds()/SceneEngine.setLayerOrder() are
    // unchanged and still power that one, real reorder control.

    // Action row — Lock / Duplicate / Delete.
    const actionRow=document.createElement('div');
    actionRow.className='sticker-actions-row';

    const lockBtn=document.createElement('button');
    lockBtn.type='button';
    lockBtn.className='sticker-action-btn sticker-lock-btn';
    lockBtn.addEventListener('click',function(){
      const st=_activeSticker();
      if(!st) return;
      _stickerUpdate({locked:!st.locked});
    });
    actionRow.appendChild(lockBtn);

    const dupBtn=document.createElement('button');
    dupBtn.type='button';
    dupBtn.className='sticker-action-btn sticker-dup-btn';
    dupBtn.textContent='⎘ Duplicate';
    dupBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      const copy=SceneEngine.duplicateSticker(slide,id);
      _commitSticker();
      if(copy && host && typeof host.setSelectedSceneElement==='function'){
        try{ host.setSelectedSceneElement(copy.id,'sticker'); }catch(e){}
      }
    });
    actionRow.appendChild(dupBtn);

    const delBtn=document.createElement('button');
    delBtn.type='button';
    delBtn.className='sticker-action-btn sticker-del-btn';
    delBtn.textContent='✕ Delete';
    delBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      SceneEngine.removeSticker(slide,id);
      if(host && typeof host.setSelectedSceneElement==='function'){
        try{ host.setSelectedSceneElement(null,null); }catch(e){}
      }
      _commitSticker();
    });
    actionRow.appendChild(delBtn);

    editor.appendChild(actionRow);

    // Sprint 9.4 — Holder → Sticker's theme-driven controls (today just
    // "shadow", e.g. Comic). Built as one additive container, hidden
    // entirely when the active workspace theme lists nothing here.
    const stickerWorkspace=document.createElement('div');
    stickerWorkspace.className='sticker-workspace-controls';
    editor.appendChild(stickerWorkspace);
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(stickerWorkspace,'holder.sticker',{getSlide:_currentSlide,onChange:_commitSticker},stickerWorkspace);
    }

    body.appendChild(editor);
  }

  function _refreshSticker(){
    if(!mountedRoot) return;
    const section=mountedRoot.querySelector('[data-card-section="sticker"]');
    if(!section) return;
    const empty=section.querySelector('.sticker-empty');
    const editor=section.querySelector('.sticker-editor');
    if(!empty || !editor) return;
    const stickerWorkspace=editor.querySelector('.sticker-workspace-controls');
    if(stickerWorkspace && typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(stickerWorkspace,'holder.sticker',{getSlide:_currentSlide,onChange:_commitSticker},stickerWorkspace);
    }
    const st=_activeSticker();
    const isStickerSelected=!!st && _selectedStickerType()==='sticker';
    if(!isStickerSelected){
      empty.classList.remove('hidden');
      editor.classList.add('hidden');
      section.classList.remove('sticker-active');
      return;
    }
    empty.classList.add('hidden');
    editor.classList.remove('hidden');
    section.classList.add('sticker-active');

    const cat=(typeof StickerLibrary!=='undefined') ? StickerLibrary.getById(st.stickerId) : null;
    const labelEl=section.querySelector('.sticker-selected-label');
    if(labelEl) labelEl.textContent='Sticker: '+(cat?cat.name:'Sticker');

    const sizeSlider=section.querySelector('.sticker-size-slider');
    const sizeVal=section.querySelector('.sticker-size-value');
    const w=st.w||260;
    if(sizeSlider) sizeSlider.value=String(w);
    if(sizeVal) sizeVal.textContent=Math.round(w)+'px';

    const rotSlider=section.querySelector('.sticker-rotation-slider');
    const rotVal=section.querySelector('.sticker-rotation-value');
    const rot=typeof st.rotation==='number'?st.rotation:0;
    if(rotSlider) rotSlider.value=String(rot);
    if(rotVal) rotVal.textContent=Math.round(rot)+'°';

    const opSlider=section.querySelector('.sticker-opacity-slider');
    const opVal=section.querySelector('.sticker-opacity-value');
    const op=typeof st.opacity==='number'?st.opacity:1;
    if(opSlider) opSlider.value=String(op);
    if(opVal) opVal.textContent=Math.round(op*100)+'%';

    section.querySelectorAll('.sticker-flip-btn').forEach(function(b){
      const k=b.getAttribute('data-flip');
      b.classList.toggle('active',!!st[k]);
    });

    const lockBtn=section.querySelector('.sticker-lock-btn');
    if(lockBtn){
      lockBtn.textContent=st.locked?'🔓 Unlock':'🔒 Lock';
      lockBtn.classList.toggle('active',!!st.locked);
    }
  }

  // --- Frame section (Sprint 6.6.1 — Object Designer for the Frame) ----
  // The Frame is the rectangle that holds the picture. Sprint 6.6.1
  // promotes it to a first-class object: rotation, layer order, and
  // free move/resize (move + resize already work via canvas drag +
  // handles; this section surfaces the rest of the universal object
  // controls in the right pane).
  function _activeFrameElement(){
    if(_selectedStickerType()!=='image-holder') return null;
    if(typeof SceneEngine==='undefined') return null;
    const slide=_currentSlide();
    if(!slide) return null;
    const data=SceneEngine.getRenderData(slide);
    if(!data) return null;
    const id=_selectedStickerHostId();
    if(!id) return null;
    return data.elements.find(function(el){ return el.id===id; })||null;
  }
  function _commitFrame(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    _refreshFrame();
  }
  function _buildFrameControls(body){
    const empty=document.createElement('p');
    empty.className='placeholder frame-empty';
    // Sprint 8.4.4 — Picture Holder Completion. The section is the
    // Picture Holder — the rectangle the picture lives inside.
    // Changing the holder never distorts the picture; the picture
    // keeps its own pan / zoom / replace controls under the Picture
    // section below.
    empty.textContent='Pick the picture frame on the page to edit it.';
    body.appendChild(empty);

    const editor=document.createElement('div');
    editor.className='frame-editor hidden';

    const selectedLabel=document.createElement('div');
    selectedLabel.className='frame-selected-label';
    selectedLabel.textContent='Picture Frame';
    editor.appendChild(selectedLabel);

    const hint=document.createElement('p');
    hint.className='placeholder frame-hint';
    hint.textContent='Drag the frame on the canvas to move it. Drag the gold handles to resize. The picture inside follows the frame but stays editable in the Picture section below.';
    editor.appendChild(hint);

    // Sprint 8.4.4 — Picture Holder cross-reference. Border / Corner /
    // Shadow controls live in the Picture section's Frame Look + Frame
    // Style sub-groups (same data, slide.metadata.cardOverrides.border).
    // Surface a friendly pointer so children find them.
    const styleHint=document.createElement('p');
    styleHint.className='placeholder frame-style-hint';
    styleHint.textContent='Change the border, corner roundness, and shadow under Picture → Frame Look / Frame Style.';
    editor.appendChild(styleHint);

    // Spin (rotation)
    const rotRow=document.createElement('div');
    rotRow.className='designer-row';
    const rotLbl=document.createElement('div');
    rotLbl.className='designer-row-label text-slider-label';
    const rotTitle=document.createElement('span');
    rotTitle.textContent='Spin';
    rotLbl.appendChild(rotTitle);
    const rotVal=document.createElement('span');
    rotVal.className='frame-rotation-value';
    rotVal.textContent='0°';
    rotLbl.appendChild(rotVal);
    rotRow.appendChild(rotLbl);
    const rotSlider=document.createElement('input');
    rotSlider.type='range';
    rotSlider.min='-180';
    rotSlider.max='180';
    rotSlider.step='1';
    rotSlider.className='frame-rotation-slider';
    rotSlider.addEventListener('input',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      SceneEngine.setRotation(slide,id,parseFloat(rotSlider.value));
      _commitFrame();
    });
    rotRow.appendChild(rotSlider);
    editor.appendChild(rotRow);

    // Layer ordering moved to the Object Strip's own drag-to-reorder —
    // see the matching removal note at the top of the Sticker section.

    // Sprint 8.3 — Frame Holder completion. The Frame is now a true
    // first-class object: Lock / Duplicate / Delete sit beside the
    // existing Spin / Layer / Reset controls so every page object
    // (Frame, Sticker, …) carries the same shape. Picture
    // independence is preserved by construction — these actions
    // never touch the imageView; the picture inside the frame keeps
    // its own pan / zoom / replace controls under the Picture section.
    const actionRow=document.createElement('div');
    actionRow.className='sticker-actions-row';

    const lockBtn=document.createElement('button');
    lockBtn.type='button';
    lockBtn.className='sticker-action-btn frame-lock-btn';
    lockBtn.textContent='🔒 Lock';
    lockBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      const cur=(slide.metadata && slide.metadata.elementOverrides
        && slide.metadata.elementOverrides[id]
        && slide.metadata.elementOverrides[id].locked)===true;
      SceneEngine.setLocked(slide,id,!cur);
      _commitFrame();
    });
    actionRow.appendChild(lockBtn);

    const dupBtn=document.createElement('button');
    dupBtn.type='button';
    dupBtn.className='sticker-action-btn frame-dup-btn';
    dupBtn.textContent='⎘ Duplicate';
    dupBtn.title='More picture holders per page are coming soon.';
    dupBtn.addEventListener('click',function(){
      // V1.0 architecture-ready: the scene blueprint owns one Picture
      // Holder per page; a future sprint will lift the holder into a
      // free standing object collection. Until then, surface a
      // friendly note so the action behaves predictably.
      try{ alert('More picture holders per page are coming in a future story. ✨'); }catch(e){}
    });
    actionRow.appendChild(dupBtn);

    const delBtn=document.createElement('button');
    delBtn.type='button';
    // Sprint 8.3 — distinct class so the test harness + future styling
    // can target the Frame's delete without hitting the Sticker's.
    delBtn.className='sticker-action-btn sticker-del-btn frame-del-btn';
    delBtn.textContent='✕ Delete';
    delBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      // Delete = hide. Children can bring the frame back from the
      // Page Designer's Elements checklist.
      SceneEngine.setVisibility(slide,id,false);
      if(host && typeof host.setSelectedSceneElement==='function'){
        try{ host.setSelectedSceneElement(null,null); }catch(e){}
      }
      _commitFrame();
    });
    actionRow.appendChild(delBtn);

    editor.appendChild(actionRow);

    // Reset — clears every override on the image-holder. Picture stays
    // untouched because slide.image / slide.imageView live elsewhere.
    const resetRow=document.createElement('div');
    resetRow.className='picture-actions-row';
    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='picture-reset-btn picture-reset-frame-btn';
    resetBtn.textContent='↺ Reset Picture Frame';
    resetBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      SceneEngine.clearOverride(slide,id);
      _commitFrame();
    });
    resetRow.appendChild(resetBtn);
    editor.appendChild(resetRow);

    body.appendChild(editor);
  }

  // --- Decoration section (Sprint 8.4.1 — Universal Object Selection) ----
  // Selecting a decoration on canvas now routes the right pane to the Card
  // Designer just like every other object. The Decoration section surfaces
  // Visibility, Lock, Layer order, Reset — the controls that fit a
  // decorative element. The wider Element checklist in the Story tab still
  // works for bulk visibility toggling.
  function _activeDecorationElement(){
    if(_selectedStickerType()!=='decoration') return null;
    if(typeof SceneEngine==='undefined') return null;
    const slide=_currentSlide();
    if(!slide) return null;
    const data=SceneEngine.getRenderData(slide);
    if(!data) return null;
    const id=_selectedStickerHostId();
    if(!id) return null;
    return data.elements.find(function(el){ return el.id===id; })||null;
  }
  function _commitDecoration(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    _refreshDecoration();
  }

  function _buildDecorationControls(body){
    const empty=document.createElement('p');
    empty.className='placeholder decoration-empty';
    empty.textContent='Pick a decoration on the page to edit it.';
    body.appendChild(empty);

    const editor=document.createElement('div');
    editor.className='decoration-editor hidden';

    const selectedLabel=document.createElement('div');
    selectedLabel.className='decoration-selected-label';
    selectedLabel.textContent='Decoration';
    editor.appendChild(selectedLabel);

    const hint=document.createElement('p');
    hint.className='placeholder decoration-hint';
    hint.textContent='Drag the decoration on the canvas to move it. Drag the gold handles to resize.';
    editor.appendChild(hint);

    // Layer ordering moved to the Object Strip's own drag-to-reorder —
    // see the matching removal note at the top of the Sticker section.

    // Action row — Lock / Hide / Reset.
    const actionRow=document.createElement('div');
    actionRow.className='sticker-actions-row';

    const lockBtn=document.createElement('button');
    lockBtn.type='button';
    lockBtn.className='sticker-action-btn decoration-lock-btn';
    lockBtn.textContent='🔒 Lock';
    lockBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      const cur=(slide.metadata && slide.metadata.elementOverrides
        && slide.metadata.elementOverrides[id]
        && slide.metadata.elementOverrides[id].locked)===true;
      SceneEngine.setLocked(slide,id,!cur);
      _commitDecoration();
    });
    actionRow.appendChild(lockBtn);

    const hideBtn=document.createElement('button');
    hideBtn.type='button';
    hideBtn.className='sticker-action-btn decoration-hide-btn';
    hideBtn.textContent='✕ Hide';
    hideBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      SceneEngine.setVisibility(slide,id,false);
      if(host && typeof host.setSelectedSceneElement==='function'){
        try{ host.setSelectedSceneElement(null,null); }catch(e){}
      }
      _commitDecoration();
    });
    actionRow.appendChild(hideBtn);

    editor.appendChild(actionRow);

    // Reset Decoration.
    const resetRow=document.createElement('div');
    resetRow.className='picture-actions-row';
    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='picture-reset-btn picture-reset-decoration-btn';
    resetBtn.textContent='↺ Reset Decoration';
    resetBtn.addEventListener('click',function(){
      if(typeof SceneEngine==='undefined') return;
      const slide=_currentSlide();
      const id=_selectedStickerHostId();
      if(!slide||!id) return;
      SceneEngine.clearOverride(slide,id);
      _commitDecoration();
    });
    resetRow.appendChild(resetBtn);
    editor.appendChild(resetRow);

    body.appendChild(editor);
  }

  function _refreshDecoration(){
    if(!mountedRoot) return;
    const section=mountedRoot.querySelector('[data-card-section="decoration"]');
    if(!section) return;
    const empty=section.querySelector('.decoration-empty');
    const editor=section.querySelector('.decoration-editor');
    if(!empty || !editor) return;
    const el=_activeDecorationElement();
    if(!el){
      empty.classList.remove('hidden');
      editor.classList.add('hidden');
      section.classList.remove('decoration-active');
      return;
    }
    empty.classList.add('hidden');
    editor.classList.remove('hidden');
    section.classList.add('decoration-active');
    const label=section.querySelector('.decoration-selected-label');
    if(label) label.textContent=el.label||'Decoration';
    const lockBtn=section.querySelector('.decoration-lock-btn');
    if(lockBtn){
      const locked=!!el.locked;
      lockBtn.textContent=locked?'🔓 Unlock':'🔒 Lock';
      lockBtn.classList.toggle('active',locked);
    }
  }

  function _refreshFrame(){
    if(!mountedRoot) return;
    const section=mountedRoot.querySelector('[data-card-section="frame"]');
    if(!section) return;
    const empty=section.querySelector('.frame-empty');
    const editor=section.querySelector('.frame-editor');
    if(!empty || !editor) return;
    const el=_activeFrameElement();
    if(!el){
      empty.classList.remove('hidden');
      editor.classList.add('hidden');
      section.classList.remove('frame-active');
      return;
    }
    empty.classList.add('hidden');
    editor.classList.remove('hidden');
    section.classList.add('frame-active');

    const rotSlider=section.querySelector('.frame-rotation-slider');
    const rotVal=section.querySelector('.frame-rotation-value');
    const rot=typeof el.rotation==='number'?el.rotation:0;
    if(rotSlider) rotSlider.value=String(rot);
    if(rotVal) rotVal.textContent=Math.round(rot)+'°';

    // Lock button reflects current state.
    const lockBtn=section.querySelector('.frame-lock-btn');
    if(lockBtn){
      const locked=!!el.locked;
      lockBtn.textContent=locked?'🔓 Unlock':'🔒 Lock';
      lockBtn.classList.toggle('active',locked);
    }
  }

  // --- Text section (Sprint 4.3 + 4.4) -----------------------------------
  // Overrides live at slide.metadata.cardOverrides.textElements[id] and ride
  // through the existing metadata serialization — no project format change.
  // Sprint 4.4 adds: fontFamily, fontWeight, fontStyle, opacity,
  // letterSpacing, lineHeight, and a nested position {offsetX, offsetY}.
  const TEXT_ELEMENT_LABELS={
    'story-text':'Story Text',
    'footer':'Footer',
    'page-number':'Page Number',
    'handle':'Handle'
  };

  const FONT_FAMILY_OPTIONS=[
    {value:'',label:'World Default'},
    {value:'Georgia, serif',label:'Georgia'},
    {value:'"Times New Roman", Times, serif',label:'Times'},
    {value:'Arial, Helvetica, sans-serif',label:'Arial'},
    {value:'"Helvetica Neue", Helvetica, Arial, sans-serif',label:'Helvetica'},
    {value:'"Trebuchet MS", sans-serif',label:'Trebuchet'},
    {value:'"Comic Sans MS", "Chalkboard SE", cursive',label:'Comic'},
    {value:'"Courier New", Courier, monospace',label:'Courier'}
  ];
  const FONT_WEIGHT_OPTIONS=[
    {value:'',label:'World Default'},
    {value:'300',label:'Light'},
    {value:'400',label:'Regular'},
    {value:'500',label:'Medium'},
    {value:'600',label:'Semibold'},
    {value:'700',label:'Bold'},
    {value:'900',label:'Black'}
  ];
  // Typography keys (everything except position) — used for Reset Typography.
  const TYPOGRAPHY_KEYS=['fontFamily','fontSize','fontWeight','fontStyle','color','opacity','letterSpacing','lineHeight','alignment'];

  function _ensureTextOverrides(slide){
    if(!slide) return null;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.textElements) slide.metadata.cardOverrides.textElements={};
    return slide.metadata.cardOverrides.textElements;
  }

  function _selectedTextId(){
    if(!host||typeof host.getSelectedTextElement!=='function') return null;
    try{ return host.getSelectedTextElement(); }catch(e){ return null; }
  }

  function _textDefaultsFor(id){
    if(host&&typeof host.getTextDefaults==='function'){
      try{ return host.getTextDefaults(id); }catch(e){}
    }
    return {fontSize:24,color:'#FFFFFF',alignment:'left'};
  }

  function _commitText(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    _refreshText();
  }

  function _setTextOverride(key,value){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    const map=_ensureTextOverrides(slide);
    if(!map[id]) map[id]={};
    map[id][key]=value;
    _commitText();
  }

  // Removes a single property — Sprint 4.4 "Reset Property". Empty string
  // selection in <select> dropdowns funnels through this so picking
  // "Theme Default" actually removes the override.
  function _clearTextProperty(key){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    const map=slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements;
    if(!map||!map[id]) return;
    delete map[id][key];
    if(Object.keys(map[id]).length===0) delete map[id];
    _commitText();
  }

  // Sprint 4.4 reset actions.
  function _resetTypography(){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    const map=slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements;
    if(!map||!map[id]) return;
    TYPOGRAPHY_KEYS.forEach(function(k){ delete map[id][k]; });
    if(Object.keys(map[id]).length===0) delete map[id];
    _commitText();
  }
  function _resetPosition(){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    const map=slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements;
    if(!map||!map[id]) return;
    delete map[id].position;
    if(Object.keys(map[id]).length===0) delete map[id];
    _commitText();
  }
  function _resetToTheme(){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    if(slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements){
      delete slide.metadata.cardOverrides.textElements[id];
    }
    _commitText();
  }

  function _makeSliderRow(parent,opts){
    // opts: {labelText, valueClass, sliderClass, min, max, step, onInput, format}
    const row=document.createElement('div');
    row.className='designer-row';
    const lbl=document.createElement('div');
    lbl.className='designer-row-label text-slider-label';
    const title=document.createElement('span');
    title.textContent=opts.labelText;
    lbl.appendChild(title);
    const val=document.createElement('span');
    val.className=opts.valueClass;
    val.textContent='—';
    lbl.appendChild(val);
    row.appendChild(lbl);
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(opts.min);
    slider.max=String(opts.max);
    slider.step=String(opts.step);
    slider.className=opts.sliderClass;
    slider.addEventListener('input',function(){ opts.onInput(parseFloat(slider.value)); });
    row.appendChild(slider);
    parent.appendChild(row);
  }

  function _buildTextControls(body){
    const empty=document.createElement('p');
    empty.className='placeholder text-empty';
    empty.textContent='Click any text on the canvas to edit it.';
    body.appendChild(empty);

    const editor=document.createElement('div');
    editor.className='text-editor hidden';

    const selectedLabel=document.createElement('div');
    selectedLabel.className='text-selected-label';
    selectedLabel.textContent='Selected: —';
    editor.appendChild(selectedLabel);

    // --- Position group --------------------------------------------------
    const posHdr=document.createElement('div');
    posHdr.className='designer-sublabel';
    posHdr.textContent='Position';
    editor.appendChild(posHdr);
    const posRow=document.createElement('div');
    posRow.className='text-position-row';
    posRow.innerHTML='<span>X <span class="text-pos-x">0</span>px</span><span>Y <span class="text-pos-y">0</span>px</span>';
    editor.appendChild(posRow);
    const posHint=document.createElement('p');
    posHint.className='placeholder text-pos-hint';
    posHint.textContent='Drag text on canvas, or use arrow keys (Shift = 10×).';
    editor.appendChild(posHint);
    const resetPosBtn=document.createElement('button');
    resetPosBtn.type='button';
    resetPosBtn.className='text-reset-pos-btn text-small-btn';
    resetPosBtn.textContent='↺ Reset Position';
    resetPosBtn.addEventListener('click',_resetPosition);
    editor.appendChild(resetPosBtn);

    // --- Typography group ------------------------------------------------
    // Sprint 9.4 — everything from Font Family through Line Height is one
    // theme-driven "typography" control (holder.text); wrapped in a
    // single tagged container so WorkspaceBuilder can show/hide/reorder
    // it as a unit relative to "alignment", without touching any of the
    // individual fields' wiring below.
    const typoGroup=document.createElement('div');
    typoGroup.setAttribute('data-control','typography');
    editor.appendChild(typoGroup);

    const typoHdr=document.createElement('div');
    typoHdr.className='designer-sublabel';
    typoHdr.textContent='Typography';
    typoGroup.appendChild(typoHdr);

    // Font Family
    const familyRow=document.createElement('div');
    familyRow.className='designer-row';
    const familyLabel=document.createElement('div');
    familyLabel.className='designer-row-label';
    familyLabel.textContent='Font Family';
    familyRow.appendChild(familyLabel);
    const familySel=document.createElement('select');
    familySel.className='text-family-select';
    FONT_FAMILY_OPTIONS.forEach(function(o){
      const opt=document.createElement('option'); opt.value=o.value; opt.textContent=o.label; familySel.appendChild(opt);
    });
    familySel.addEventListener('change',function(){
      if(familySel.value==='') _clearTextProperty('fontFamily');
      else _setTextOverride('fontFamily',familySel.value);
    });
    familyRow.appendChild(familySel);
    typoGroup.appendChild(familyRow);

    // Font Size
    _makeSliderRow(typoGroup,{
      labelText:'Font Size',valueClass:'text-size-value',sliderClass:'text-size-slider',
      min:12,max:120,step:1,
      onInput:function(v){ _setTextOverride('fontSize',Math.round(v)); }
    });

    // Font Weight
    const weightRow=document.createElement('div');
    weightRow.className='designer-row';
    const weightLabel=document.createElement('div');
    weightLabel.className='designer-row-label';
    weightLabel.textContent='Weight';
    weightRow.appendChild(weightLabel);
    const weightSel=document.createElement('select');
    weightSel.className='text-weight-select';
    FONT_WEIGHT_OPTIONS.forEach(function(o){
      const opt=document.createElement('option'); opt.value=o.value; opt.textContent=o.label; weightSel.appendChild(opt);
    });
    weightSel.addEventListener('change',function(){
      if(weightSel.value==='') _clearTextProperty('fontWeight');
      else _setTextOverride('fontWeight',weightSel.value);
    });
    weightRow.appendChild(weightSel);
    typoGroup.appendChild(weightRow);

    // Font Style (Normal / Italic icon cards)
    const styleRow=document.createElement('div');
    styleRow.className='designer-row';
    const styleLabel=document.createElement('div');
    styleLabel.className='designer-row-label';
    styleLabel.textContent='Style';
    styleRow.appendChild(styleLabel);
    const styleIcons=document.createElement('div');
    styleIcons.className='icon-row text-style-row';
    [['normal','Normal','R'],['italic','Italic','I']].forEach(function(t){
      const id=t[0], name=t[1], glyph=t[2];
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card text-style-btn';
      btn.setAttribute('data-style',id);
      const pv=document.createElement('span'); pv.className='icon-preview';
      const g=document.createElement('span');
      g.className='text-style-glyph text-style-glyph-'+id;
      g.textContent=glyph;
      pv.appendChild(g);
      btn.appendChild(pv);
      const lbl=document.createElement('span'); lbl.className='icon-label'; lbl.textContent=name; btn.appendChild(lbl);
      btn.addEventListener('click',function(){ _setTextOverride('fontStyle',id); });
      styleIcons.appendChild(btn);
    });
    styleRow.appendChild(styleIcons);
    typoGroup.appendChild(styleRow);

    // Color
    const colorRow=document.createElement('div');
    colorRow.className='designer-row text-color-row';
    const colorLabel=document.createElement('div');
    colorLabel.className='designer-row-label';
    colorLabel.textContent='Color';
    colorRow.appendChild(colorLabel);
    const colorInput=document.createElement('input');
    colorInput.type='color';
    colorInput.className='text-color-input';
    colorInput.value='#ffffff';
    colorInput.addEventListener('input',function(){ _setTextOverride('color',colorInput.value); });
    colorRow.appendChild(colorInput);
    typoGroup.appendChild(colorRow);

    // Opacity
    _makeSliderRow(typoGroup,{
      labelText:'Opacity',valueClass:'text-opacity-value',sliderClass:'text-opacity-slider',
      min:0,max:1,step:0.01,
      onInput:function(v){ _setTextOverride('opacity',Math.round(v*100)/100); }
    });

    // Letter Spacing
    _makeSliderRow(typoGroup,{
      labelText:'Letter Spacing',valueClass:'text-letterspacing-value',sliderClass:'text-letterspacing-slider',
      min:-5,max:20,step:0.5,
      onInput:function(v){ _setTextOverride('letterSpacing',v); }
    });

    // Line Height
    _makeSliderRow(typoGroup,{
      labelText:'Line Height',valueClass:'text-lineheight-value',sliderClass:'text-lineheight-slider',
      min:0.8,max:2.5,step:0.05,
      onInput:function(v){ _setTextOverride('lineHeight',Math.round(v*100)/100); }
    });

    // Sprint 9.4 — Alignment is the second theme-driven "holder.text"
    // control, wrapped the same way as Typography above.
    const alignGroup=document.createElement('div');
    alignGroup.setAttribute('data-control','alignment');
    editor.appendChild(alignGroup);

    // Alignment
    const alignRow=document.createElement('div');
    alignRow.className='designer-row';
    const alignLabel=document.createElement('div');
    alignLabel.className='designer-row-label';
    alignLabel.textContent='Alignment';
    alignRow.appendChild(alignLabel);
    const alignIcons=document.createElement('div');
    alignIcons.className='icon-row text-align-row';
    ['left','center','right'].forEach(function(a){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card text-align-btn';
      btn.setAttribute('data-align',a);
      const pv=document.createElement('span');
      pv.className='icon-preview';
      const glyph=document.createElement('span');
      glyph.className='text-align-glyph text-align-glyph-'+a;
      pv.appendChild(glyph);
      btn.appendChild(pv);
      const lbl=document.createElement('span');
      lbl.className='icon-label';
      lbl.textContent=a.charAt(0).toUpperCase()+a.slice(1);
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){ _setTextOverride('alignment',a); });
      alignIcons.appendChild(btn);
    });
    alignRow.appendChild(alignIcons);
    alignGroup.appendChild(alignRow);

    // Sprint 9.4 — show/hide/reorder Typography vs. Alignment per the
    // active workspace theme. Position (above) and Reset actions (below)
    // are core and stay untouched/untagged.
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(editor,'holder.text',{getSlide:_currentSlide,onChange:_commitText});
    }

    // --- Reset actions ---------------------------------------------------
    const resetGroup=document.createElement('div');
    resetGroup.className='text-reset-actions';
    const resetTypoBtn=document.createElement('button');
    resetTypoBtn.type='button';
    resetTypoBtn.className='text-reset-typo-btn text-small-btn';
    resetTypoBtn.textContent='↺ Reset Typography';
    resetTypoBtn.addEventListener('click',_resetTypography);
    resetGroup.appendChild(resetTypoBtn);
    const resetAllBtn=document.createElement('button');
    resetAllBtn.type='button';
    resetAllBtn.className='text-reset-btn';
    resetAllBtn.textContent='↺ Reset to Theme';
    resetAllBtn.addEventListener('click',_resetToTheme);
    resetGroup.appendChild(resetAllBtn);
    editor.appendChild(resetGroup);

    body.appendChild(editor);
  }

  function _refreshText(){
    if(!mountedRoot) return;
    const empty=mountedRoot.querySelector('.text-empty');
    const editor=mountedRoot.querySelector('.text-editor');
    if(!empty||!editor) return;
    // Sprint 9.4 — re-run on every refresh so a theme change (routed
    // here via ThemeEngine._refreshUI -> CardDesigner.refresh()) updates
    // Typography/Alignment visibility and order with no reload.
    if(typeof WorkspaceBuilder!=='undefined'){
      WorkspaceBuilder.layout(editor,'holder.text',{getSlide:_currentSlide,onChange:_commitText});
    }
    const id=_selectedTextId();
    if(!id){
      empty.classList.remove('hidden');
      editor.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    editor.classList.remove('hidden');

    const slide=_currentSlide();
    const ovMap=(slide && slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements) || {};
    const ov=ovMap[id] || {};
    const def=_textDefaultsFor(id);

    const labelEl=mountedRoot.querySelector('.text-selected-label');
    if(labelEl) labelEl.textContent='Selected: '+(TEXT_ELEMENT_LABELS[id]||id);

    // Position readout
    const pos=ov.position||{};
    const px=Math.round(pos.offsetX||0);
    const py=Math.round(pos.offsetY||0);
    const xEl=mountedRoot.querySelector('.text-pos-x');
    const yEl=mountedRoot.querySelector('.text-pos-y');
    if(xEl) xEl.textContent=String(px);
    if(yEl) yEl.textContent=String(py);

    // Font Family
    const familySel=mountedRoot.querySelector('.text-family-select');
    if(familySel) familySel.value=ov.fontFamily||'';

    // Font Size
    const sizeSlider=mountedRoot.querySelector('.text-size-slider');
    const sizeValue=mountedRoot.querySelector('.text-size-value');
    const effSize=ov.fontSize||def.fontSize;
    if(sizeSlider) sizeSlider.value=String(effSize);
    if(sizeValue) sizeValue.textContent=effSize+'px';

    // Font Weight
    const weightSel=mountedRoot.querySelector('.text-weight-select');
    if(weightSel) weightSel.value=ov.fontWeight||'';

    // Font Style
    const effStyle=ov.fontStyle||def.fontStyle||'normal';
    mountedRoot.querySelectorAll('.text-style-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-style')===effStyle);
    });

    // Color
    const colorInput=mountedRoot.querySelector('.text-color-input');
    if(colorInput) colorInput.value=_normalizeColor(ov.color||def.color);

    // Opacity
    const opSlider=mountedRoot.querySelector('.text-opacity-slider');
    const opValue=mountedRoot.querySelector('.text-opacity-value');
    const effOpacity=(typeof ov.opacity==='number')?ov.opacity:(def.opacity!==undefined?def.opacity:1);
    if(opSlider) opSlider.value=String(effOpacity);
    if(opValue) opValue.textContent=Math.round(effOpacity*100)+'%';

    // Letter Spacing
    const lsSlider=mountedRoot.querySelector('.text-letterspacing-slider');
    const lsValue=mountedRoot.querySelector('.text-letterspacing-value');
    const effLS=(typeof ov.letterSpacing==='number')?ov.letterSpacing:(def.letterSpacing||0);
    if(lsSlider) lsSlider.value=String(effLS);
    if(lsValue) lsValue.textContent=effLS+'px';

    // Line Height
    const lhSlider=mountedRoot.querySelector('.text-lineheight-slider');
    const lhValue=mountedRoot.querySelector('.text-lineheight-value');
    const effLH=(typeof ov.lineHeight==='number')?ov.lineHeight:(def.lineHeight||1.2);
    if(lhSlider) lhSlider.value=String(effLH);
    if(lhValue) lhValue.textContent=effLH.toFixed(2);

    // Alignment
    const effAlign=ov.alignment||def.alignment||'left';
    mountedRoot.querySelectorAll('.text-align-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-align')===effAlign);
    });
  }

  // <input type=color> only accepts lowercased 7-char hex; theme colors are
  // sometimes uppercase. Strip alpha if present and lowercase.
  function _normalizeColor(c){
    if(typeof c!=='string') return '#ffffff';
    const m=c.match(/^#?[0-9a-f]{6}/i);
    return m ? ('#'+m[0].replace('#','').toLowerCase()) : '#ffffff';
  }

  // Mount the Card Designer foundation into a container element.
  // Returns the mounted root element (or null if the container is missing).
  function mount(container){
    if(!container) return null;
    if(container.__cardDesignerRoot){
      mountedContainer=container;
      mountedRoot=container.__cardDesignerRoot;
      _refreshImage();
      return mountedRoot;
    }
    container.innerHTML='';
    const root=document.createElement('div');
    root.className='card-designer';

    // Sprint 8.4.3 — Card Designer Inheritance. The header note explains
    // the rule so the child / user reading the right pane knows that
    // every control inherits from the Theme until they override it for
    // this page. Reset buttons in each section walk the override back.
    const intro=document.createElement('p');
    intro.className='card-designer-inheritance';
    intro.innerHTML='<strong>Card</strong> customises this page only. Every control follows the <strong>Theme</strong> until you change it here.';
    root.appendChild(intro);

    SECTIONS.forEach(function(s){ if(s.hidden) return; root.appendChild(_buildSection(s)); });
    container.appendChild(root);
    container.__cardDesignerRoot=root;
    mountedContainer=container;
    mountedRoot=root;

    // Wire collapsible behavior on the headers we just rendered. The Theme
    // Designer in app.js also delegates [data-collapsible-toggle] clicks, but
    // CardDesigner manages its own lifecycle so it works regardless of mount
    // order or whether it shares a host page with the Theme Designer.
    // Sprint 4.5: also handle nested .image-subgroup collapsibles.
    root.querySelectorAll('[data-collapsible-toggle]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const group=btn.closest('.image-subgroup, .designer-group');
        if(!group) return;
        const collapsed=group.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded',collapsed?'false':'true');
      });
    });

    _refreshImage();
    _refreshText();
    _refreshSticker();
    _refreshFrame();
    _refreshDecoration();
    _refreshInheritance();
    _refreshFrameThumbs();
    return root;
  }

  // Bind to the surrounding application: how to find the active slide, how
  // to redraw the preview, and how to mark persistence dirty. Hosts other
  // than the current right-pane integration (future Story / Cover / CTA
  // Designers) simply pass their own equivalents.
  function configure(cfg){
    host=cfg||null;
    _refreshImage();
    _refreshText();
    _refreshSticker();
    _refreshFrame();
    _refreshDecoration();
    _refreshInheritance();
  }

  // Re-sync every section with the current slide/selection — call after
  // the host switches slides or changes the object selection.
  function refresh(){
    _refreshImage();
    _refreshText();
    _refreshSticker();
    _refreshFrame();
    _refreshDecoration();
    _refreshInheritance();
  }

  // Sprint 8.4.3 — Card Designer Inheritance. Walks the active slide's
  // cardOverrides + stickers + scene element overrides to decide
  // whether each Card Designer section is currently "Theme" or
  // "This Page". The badge updates per-refresh so the child sees the
  // section flip as soon as they change a control.
  function _slideHasSectionOverride(slide,sectionId){
    if(!slide||!slide.metadata) return false;
    const co=slide.metadata.cardOverrides||{};
    switch(sectionId){
      case 'image':{
        const img=co.image||{};
        // Default image view has no relevant overrides; any deviation
        // counts. We treat plain {fit:'fit',scale:1,offsetX:0,offsetY:0}
        // as no override.
        const isPlain = (img.fit==='fit' || !img.fit) &&
                        (img.scale===undefined || img.scale===1) &&
                        (img.offsetX===undefined || img.offsetX===0) &&
                        (img.offsetY===undefined || img.offsetY===0);
        return !isPlain;
      }
      case 'frame':{
        if(co.border) return true;
        // image-holder element override on this slide.
        const eo=(slide.metadata.elementOverrides||{})['image-holder'];
        if(eo && Object.keys(eo).length>0) return true;
        return !!co.frameDesign;
      }
      case 'text':{
        const te=co.textElements||{};
        return Object.keys(te).length>0;
      }
      case 'sticker':{
        return Array.isArray(slide.metadata.stickers) && slide.metadata.stickers.length>0;
      }
      case 'decoration':{
        const overrides=slide.metadata.elementOverrides||{};
        for(const k in overrides){
          if(k==='image-holder') continue;
          if(k.indexOf('-holder')!==-1) continue;
          if(Object.keys(overrides[k]||{}).length>0) return true;
        }
        return false;
      }
      default:
        return false;
    }
  }
  function _refreshInheritance(){
    if(!mountedRoot) return;
    const slide=_currentSlide();
    SECTIONS.forEach(function(s){
      if(s.hidden) return;
      const badge=mountedRoot.querySelector('[data-card-section-badge="'+s.id+'"]');
      if(!badge) return;
      const overridden=_slideHasSectionOverride(slide,s.id);
      badge.textContent=overridden?'This Page':'Theme';
      badge.classList.toggle('is-overridden',overridden);
    });
  }

  // Sprint 8.4.1 — Universal Object Selection. Expand the named section,
  // make sure its body is visible (uncollapse if collapsed), and smoothly
  // scroll it into view inside the right pane. Other sections stay in
  // whatever state the child left them — the rule is "make sure the
  // matching section is open and visible", not "close everything else".
  function focusSection(sectionId){
    if(!mountedRoot||!sectionId) return false;
    const section=mountedRoot.querySelector('[data-card-section="'+sectionId+'"]');
    if(!section) return false;
    if(section.classList.contains('collapsed')){
      const header=section.querySelector('.designer-group-title');
      if(header){
        section.classList.remove('collapsed');
        header.setAttribute('aria-expanded','true');
      }
    }
    // Defer the scroll so the tab-switch + refresh DOM mutations settle
    // first; otherwise the scrollIntoView lands on the wrong layout.
    try{
      window.requestAnimationFrame(function(){
        try{ section.scrollIntoView({behavior:'smooth',block:'start'}); }
        catch(e){ try{ section.scrollIntoView(); }catch(_){ } }
      });
    }catch(e){}
    return true;
  }

  // Read the active slide's imageView, defaulting if absent. Exposed so
  // canvas pan handlers in the host can read+write without poking metadata
  // directly. Returns the live object, not a copy. Multiple Artwork
  // Places Per Page — `placeId` omitted (Place 1) preserves the exact
  // pre-existing lookup; a real id returns that Place's own live view.
  function getActiveImageView(placeId){
    const v=_ensureView(_currentSlide(),placeId);
    return v||null;
  }

  // Commit a host-driven mutation (e.g. canvas drag) — redraws, marks
  // dirty, and re-syncs the Image section UI.
  function notifyImageViewChanged(){ _commit(); }

  // Returns the section body container for a given section id within a
  // mounted root — the documented attachment point for future controls.
  function getSectionBody(container,sectionId){
    if(!container||!sectionId) return null;
    return container.querySelector('[data-card-section-body="'+sectionId+'"]');
  }

  function unmount(container){
    if(!container) return;
    container.innerHTML='';
    delete container.__cardDesignerRoot;
    if(mountedContainer===container){
      mountedContainer=null;
      mountedRoot=null;
    }
  }

  const api={
    SECTIONS:SECTIONS,
    DEFAULT_VIEW:DEFAULT_VIEW,
    SCALE_MIN:SCALE_MIN,
    SCALE_MAX:SCALE_MAX,
    getSections:getSections,
    mount:mount,
    unmount:unmount,
    configure:configure,
    refresh:refresh,
    focusSection:focusSection,
    getActiveImageView:getActiveImageView,
    notifyImageViewChanged:notifyImageViewChanged,
    getSectionBody:getSectionBody
  };
  try{ window.CardDesigner=api; }catch(e){}
  return api;
})();
