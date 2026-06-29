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
  const SECTIONS=[
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

  // Sprint 4.5: image overrides live at slide.metadata.cardOverrides.image.
  // Legacy data from Sprint 4.2 lived at slide.metadata.imageView and is
  // migrated on first access; this single getter ensures all later writes go
  // to the new path so saved projects converge without a schema bump.
  function _ensureView(slide){
    if(!slide) return null;
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

  function _readView(slide){
    if(!slide||!slide.metadata) return null;
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

  function _setMode(mode){
    const v=_ensureView(_currentSlide());
    if(!v) return;
    v.fit=(mode==='fill')?'fill':'fit';
    _commit();
  }

  function _setScale(value){
    const v=_ensureView(_currentSlide());
    if(!v) return;
    let n=parseFloat(value);
    if(!isFinite(n)) n=1;
    if(n<SCALE_MIN) n=SCALE_MIN;
    if(n>SCALE_MAX) n=SCALE_MAX;
    v.scale=n;
    _commit();
  }

  function _setImageProp(key,value){
    const v=_ensureView(_currentSlide());
    if(!v) return;
    if(typeof value==='number' && !isFinite(value)) return;
    v[key]=value;
    _commit();
  }

  // Sprint 4.5 reset actions (composition-only, adjustments-only, full).
  function _pruneImage(slide){
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    const img=slide.metadata.cardOverrides.image;
    if(img && Object.keys(img).length===0) delete slide.metadata.cardOverrides.image;
  }
  function _resetImageComposition(){
    const slide=_currentSlide();
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    const img=slide.metadata.cardOverrides.image;
    if(!img) return;
    COMPOSITION_KEYS.forEach(function(k){ delete img[k]; });
    _pruneImage(slide);
    _commit();
  }
  function _resetImageAdjustments(){
    const slide=_currentSlide();
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    const img=slide.metadata.cardOverrides.image;
    if(!img) return;
    ADJUSTMENT_KEYS.forEach(function(k){ delete img[k]; });
    _pruneImage(slide);
    _commit();
  }
  function _resetImage(){
    const slide=_currentSlide();
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
    [['fit','Whole Picture'],['fill','Fill the Box']].forEach(function(pair){
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
        const view=_ensureView(_currentSlide());
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
        const view=_ensureView(_currentSlide());
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
  }

  // Sprint 6.5 (Object Designer) — Frame Look section. A row of preset
  // cards that write a complete border configuration to
  // cardOverrides.border. Children can still tweak any value in Frame Style.
  function _buildFrameLookControls(body){
    const fl=_makeImageSubgroup(body,'frame-look','Frame Look');
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
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    // Deep-clone the preset's border config so future mutations don't
    // leak across presets.
    slide.metadata.cardOverrides.border=JSON.parse(JSON.stringify(preset.border));
    slide.metadata.cardOverrides.frameDesign=preset.id;
    _commit();
  }

  // Sprint 6.5 — Frame Style section (was "Picture Border" in the first
  // iteration; renamed so the child sees Frame Look + Frame Style as the
  // two ways the picture's frame can be customised).
  function _buildBorderControls(body){
    const bg=_makeImageSubgroup(body,'border','Frame Style');

    // Border Size (padding) — Tiny ↔ Big
    _makeImageSliderRow(bg,{
      labelText:'Border Size',valueClass:'border-padding-value',sliderClass:'border-padding-slider',
      min:0,max:60,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide());
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
        const b=_ensureBorder(_currentSlide());
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
      const b=_ensureBorder(_currentSlide());
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
    bg.appendChild(colorRow);

    // Round Corners — Square ↔ Round
    _makeImageSliderRow(bg,{
      labelText:'Round Corners',valueClass:'border-radius-value',sliderClass:'border-radius-slider',
      min:0,max:80,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide());
        if(!b) return;
        if(Math.round(v)===0) delete b.cornerRadius; else b.cornerRadius=Math.round(v);
        _commitBorder();
      }
    });

    // Border Line (on/off + width + color)
    _buildToggleRow(bg,'Border Line','border-line-toggle',function(checked){
      const b=_ensureBorder(_currentSlide());
      if(!b) return;
      b.line=b.line||{};
      if(checked) b.line.enabled=true; else delete b.line.enabled;
      _commitBorder();
    });
    _makeImageSliderRow(bg,{
      labelText:'Line Width',valueClass:'border-line-width-value',sliderClass:'border-line-width-slider',
      min:1,max:12,step:1,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide());
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
      const b=_ensureBorder(_currentSlide());
      if(!b) return;
      b.line=b.line||{};
      b.line.color=lineColorInput.value;
      _commitBorder();
    });
    lineColorRow.appendChild(lineColorInput);
    bg.appendChild(lineColorRow);

    // Shadow (on/off + intensity)
    _buildToggleRow(bg,'Shadow','border-shadow-toggle',function(checked){
      const b=_ensureBorder(_currentSlide());
      if(!b) return;
      b.shadow=b.shadow||{};
      if(checked) b.shadow.enabled=true; else delete b.shadow.enabled;
      _commitBorder();
    });
    _makeImageSliderRow(bg,{
      labelText:'Light ↔ Dark',valueClass:'border-shadow-value',sliderClass:'border-shadow-slider',
      min:0,max:1,step:0.01,
      onInput:function(v){
        const b=_ensureBorder(_currentSlide());
        if(!b) return;
        b.shadow=b.shadow||{};
        const n=Math.round(v*100)/100;
        if(Math.abs(n-BORDER_DEFAULTS.shadowIntensity)<0.005) delete b.shadow.intensity; else b.shadow.intensity=n;
        _commitBorder();
      }
    });

    // Reset Border
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
  function _ensureBorder(slide){
    if(!slide) return null;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.border) slide.metadata.cardOverrides.border={};
    return slide.metadata.cardOverrides.border;
  }
  function _readBorder(slide){
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return null;
    return slide.metadata.cardOverrides.border||null;
  }
  function _pruneBorder(slide){
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    const b=slide.metadata.cardOverrides.border;
    if(!b) return;
    if(b.line && Object.keys(b.line).length===0) delete b.line;
    if(b.shadow && Object.keys(b.shadow).length===0) delete b.shadow;
    if(Object.keys(b).length===0) delete slide.metadata.cardOverrides.border;
  }
  function _commitBorder(){
    _pruneBorder(_currentSlide());
    _commit();
  }
  function _resetBorder(){
    const slide=_currentSlide();
    if(!slide||!slide.metadata||!slide.metadata.cardOverrides) return;
    delete slide.metadata.cardOverrides.border;
    _commit();
  }

  // Sprint 6.5 — Picture-section effective values. Legacy power-user keys
  // (crop / focal / straighten / brightness / etc.) still render from
  // saved projects but aren't exposed in the UI any more.
  function _effectiveImageView(slide){
    const v=(slide && slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.image) || (slide && slide.metadata && slide.metadata.imageView) || {};
    return {
      fit:v.fit||'fit',
      scale:(typeof v.scale==='number')?v.scale:1,
      offsetX:(typeof v.offsetX==='number')?v.offsetX:0,
      offsetY:(typeof v.offsetY==='number')?v.offsetY:0
    };
  }

  function _refreshImage(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const eff=_effectiveImageView(s);
    const hasImage=!!(s && s.image);
    mountedRoot.querySelectorAll('.image-mode-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-mode')===eff.fit);
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
  }

  function _refreshBorder(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const b=_readBorder(s)||{};
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
    const hasImage=!!(s && s.image);

    function setSlider(sel,valueSel,value,fmt,disabled){
      const sl=mountedRoot.querySelector(sel);
      const vl=mountedRoot.querySelector(valueSel);
      if(sl){ sl.value=String(value); sl.disabled=!!disabled; }
      if(vl) vl.textContent=fmt(value);
    }
    setSlider('.border-padding-slider','.border-padding-value',padding,function(v){ return Math.round(v)+'px'; },!hasImage);
    setSlider('.border-radius-slider','.border-radius-value',cornerRadius,function(v){ return Math.round(v)+'px'; },!hasImage);
    setSlider('.border-line-width-slider','.border-line-width-value',lineWidth,function(v){ return Math.round(v)+'px'; },!hasImage||!lineEnabled);
    setSlider('.border-shadow-slider','.border-shadow-value',shadowIntensity,function(v){ return Math.round(v*100)+'%'; },!hasImage||!shadowEnabled);

    // Active fill chip
    const isCustom=typeof fillSetting==='string' && fillSetting.charAt(0)==='#';
    const activeFill=isCustom?'custom':fillSetting;
    mountedRoot.querySelectorAll('.border-fill-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-fill')===activeFill);
      btn.disabled=!hasImage;
    });

    const lineToggle=mountedRoot.querySelector('.border-line-toggle');
    if(lineToggle){ lineToggle.checked=lineEnabled; lineToggle.disabled=!hasImage; }
    const shadowToggle=mountedRoot.querySelector('.border-shadow-toggle');
    if(shadowToggle){ shadowToggle.checked=shadowEnabled; shadowToggle.disabled=!hasImage; }

    const lineColorInput=mountedRoot.querySelector('.border-line-color-input');
    if(lineColorInput){ lineColorInput.value=_normalizeColor(lineColor); lineColorInput.disabled=!hasImage||!lineEnabled; }
    const customColorInput=mountedRoot.querySelector('.border-fill-custom-input');
    if(customColorInput){
      if(isCustom) customColorInput.value=_normalizeColor(fillSetting);
      customColorInput.disabled=!hasImage;
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
    {value:'',label:'Theme Default'},
    {value:'Georgia, serif',label:'Georgia'},
    {value:'"Times New Roman", Times, serif',label:'Times'},
    {value:'Arial, Helvetica, sans-serif',label:'Arial'},
    {value:'"Helvetica Neue", Helvetica, Arial, sans-serif',label:'Helvetica'},
    {value:'"Trebuchet MS", sans-serif',label:'Trebuchet'},
    {value:'"Comic Sans MS", "Chalkboard SE", cursive',label:'Comic'},
    {value:'"Courier New", Courier, monospace',label:'Courier'}
  ];
  const FONT_WEIGHT_OPTIONS=[
    {value:'',label:'Theme Default'},
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
    const typoHdr=document.createElement('div');
    typoHdr.className='designer-sublabel';
    typoHdr.textContent='Typography';
    editor.appendChild(typoHdr);

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
    editor.appendChild(familyRow);

    // Font Size
    _makeSliderRow(editor,{
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
    editor.appendChild(weightRow);

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
    editor.appendChild(styleRow);

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
    editor.appendChild(colorRow);

    // Opacity
    _makeSliderRow(editor,{
      labelText:'Opacity',valueClass:'text-opacity-value',sliderClass:'text-opacity-slider',
      min:0,max:1,step:0.01,
      onInput:function(v){ _setTextOverride('opacity',Math.round(v*100)/100); }
    });

    // Letter Spacing
    _makeSliderRow(editor,{
      labelText:'Letter Spacing',valueClass:'text-letterspacing-value',sliderClass:'text-letterspacing-slider',
      min:-5,max:20,step:0.5,
      onInput:function(v){ _setTextOverride('letterSpacing',v); }
    });

    // Line Height
    _makeSliderRow(editor,{
      labelText:'Line Height',valueClass:'text-lineheight-value',sliderClass:'text-lineheight-slider',
      min:0.8,max:2.5,step:0.05,
      onInput:function(v){ _setTextOverride('lineHeight',Math.round(v*100)/100); }
    });

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
    editor.appendChild(alignRow);

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
  }

  // Re-sync the Image and Text sections with the current slide/selection —
  // call after the host switches slides or changes the text selection.
  function refresh(){ _refreshImage(); _refreshText(); }

  // Read the active slide's imageView, defaulting if absent. Exposed so
  // canvas pan handlers in the host can read+write without poking metadata
  // directly. Returns the live object, not a copy.
  function getActiveImageView(){
    const v=_ensureView(_currentSlide());
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
    getActiveImageView:getActiveImageView,
    notifyImageViewChanged:notifyImageViewChanged,
    getSectionBody:getSectionBody
  };
  try{ window.CardDesigner=api; }catch(e){}
  return api;
})();
