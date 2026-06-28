// CardDesigner — reusable foundation shared by Story / Cover / CTA Designers.
// Sprint 4.1: structure, public API, mount/unmount.
// Sprint 4.2: Image section becomes the first functional module — scale,
// fit/fill, reset — operating on slide.metadata.imageView (presentation-only).
const CardDesigner=(function(){
  const SECTIONS=[
    {
      id:'image',
      title:'Image',
      summary:''
    },
    {
      id:'card',
      title:'Card',
      summary:'Card styling with theme defaults and per-card overrides. Reserved for Sprint 4.x.'
    },
    {
      id:'text',
      title:'Text',
      summary:''
    }
  ];

  const SCALE_MIN=0.25, SCALE_MAX=4, SCALE_STEP=0.05;
  const DEFAULT_VIEW={scale:1,offsetX:0,offsetY:0,fit:'fit'};

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

  function _ensureView(slide){
    if(!slide) return null;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.imageView){
      slide.metadata.imageView={scale:DEFAULT_VIEW.scale,offsetX:DEFAULT_VIEW.offsetX,offsetY:DEFAULT_VIEW.offsetY,fit:DEFAULT_VIEW.fit};
    }
    return slide.metadata.imageView;
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

  function _resetView(){
    const v=_ensureView(_currentSlide());
    if(!v) return;
    v.scale=DEFAULT_VIEW.scale;
    v.offsetX=DEFAULT_VIEW.offsetX;
    v.offsetY=DEFAULT_VIEW.offsetY;
    v.fit=DEFAULT_VIEW.fit;
    _commit();
  }

  function _buildImageControls(body){
    const modeRow=document.createElement('div');
    modeRow.className='designer-row';
    const modeLabel=document.createElement('div');
    modeLabel.className='designer-row-label';
    modeLabel.textContent='Mode';
    modeRow.appendChild(modeLabel);
    const modeIcons=document.createElement('div');
    modeIcons.className='icon-row image-mode-row';
    [['fit','Fit'],['fill','Fill']].forEach(function(pair){
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
      modeIcons.appendChild(btn);
    });
    modeRow.appendChild(modeIcons);
    body.appendChild(modeRow);

    const scaleRow=document.createElement('div');
    scaleRow.className='designer-row';
    const scaleLabel=document.createElement('div');
    scaleLabel.className='designer-row-label image-scale-label';
    const scaleLabelText=document.createElement('span');
    scaleLabelText.textContent='Scale';
    scaleLabel.appendChild(scaleLabelText);
    const scaleValue=document.createElement('span');
    scaleValue.className='image-scale-value';
    scaleValue.textContent='1.00×';
    scaleLabel.appendChild(scaleValue);
    scaleRow.appendChild(scaleLabel);
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(SCALE_MIN);
    slider.max=String(SCALE_MAX);
    slider.step=String(SCALE_STEP);
    slider.value='1';
    slider.className='image-scale-slider';
    slider.addEventListener('input',function(){ _setScale(slider.value); });
    scaleRow.appendChild(slider);
    body.appendChild(scaleRow);

    const resetRow=document.createElement('div');
    resetRow.className='designer-row';
    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='image-reset-btn';
    resetBtn.textContent='↺ Reset to Fit';
    resetBtn.addEventListener('click',_resetView);
    resetRow.appendChild(resetBtn);
    body.appendChild(resetRow);

    const hint=document.createElement('p');
    hint.className='placeholder image-hint';
    hint.textContent='Drag the canvas to pan the image.';
    body.appendChild(hint);
  }

  function _refreshImage(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const v=(s && s.metadata && s.metadata.imageView) || DEFAULT_VIEW;
    const hasImage=!!(s && s.image);
    mountedRoot.querySelectorAll('.image-mode-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-mode')===(v.fit||'fit'));
      b.disabled=!hasImage;
    });
    const slider=mountedRoot.querySelector('.image-scale-slider');
    if(slider){
      slider.value=String(v.scale||1);
      slider.disabled=!hasImage;
    }
    const readout=mountedRoot.querySelector('.image-scale-value');
    if(readout){ readout.textContent=(v.scale||1).toFixed(2)+'×'; }
    const reset=mountedRoot.querySelector('.image-reset-btn');
    if(reset){ reset.disabled=!hasImage; }
  }

  // --- Text section (Sprint 4.3) -----------------------------------------
  // Overrides live at slide.metadata.cardOverrides.textElements[id] and ride
  // through the existing metadata serialization — no project format change.
  const TEXT_ELEMENT_LABELS={
    'story-text':'Story Text',
    'footer':'Footer',
    'page-number':'Page Number',
    'handle':'Handle'
  };

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

  function _resetTextOverride(){
    const slide=_currentSlide();
    const id=_selectedTextId();
    if(!slide||!id) return;
    if(slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.textElements){
      delete slide.metadata.cardOverrides.textElements[id];
    }
    _commitText();
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

    // Font Size
    const sizeRow=document.createElement('div');
    sizeRow.className='designer-row';
    const sizeLabel=document.createElement('div');
    sizeLabel.className='designer-row-label text-size-label';
    const sizeTitle=document.createElement('span');
    sizeTitle.textContent='Font Size';
    sizeLabel.appendChild(sizeTitle);
    const sizeValue=document.createElement('span');
    sizeValue.className='text-size-value';
    sizeValue.textContent='—';
    sizeLabel.appendChild(sizeValue);
    sizeRow.appendChild(sizeLabel);
    const sizeSlider=document.createElement('input');
    sizeSlider.type='range';
    sizeSlider.min='12';
    sizeSlider.max='120';
    sizeSlider.step='1';
    sizeSlider.value='56';
    sizeSlider.className='text-size-slider';
    sizeSlider.addEventListener('input',function(){ _setTextOverride('fontSize',parseInt(sizeSlider.value,10)); });
    sizeRow.appendChild(sizeSlider);
    editor.appendChild(sizeRow);

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

    // Reset
    const resetRow=document.createElement('div');
    resetRow.className='designer-row';
    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='text-reset-btn';
    resetBtn.textContent='↺ Reset to Theme Default';
    resetBtn.addEventListener('click',_resetTextOverride);
    resetRow.appendChild(resetBtn);
    editor.appendChild(resetRow);

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

    const sizeSlider=mountedRoot.querySelector('.text-size-slider');
    const sizeValue=mountedRoot.querySelector('.text-size-value');
    const effSize=ov.fontSize||def.fontSize;
    if(sizeSlider) sizeSlider.value=String(effSize);
    if(sizeValue) sizeValue.textContent=effSize+'px';

    const colorInput=mountedRoot.querySelector('.text-color-input');
    if(colorInput) colorInput.value=_normalizeColor(ov.color||def.color);

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
    SECTIONS.forEach(function(s){ root.appendChild(_buildSection(s)); });
    container.appendChild(root);
    container.__cardDesignerRoot=root;
    mountedContainer=container;
    mountedRoot=root;

    // Wire collapsible behavior on the headers we just rendered. The Theme
    // Designer in app.js also delegates [data-collapsible-toggle] clicks, but
    // CardDesigner manages its own lifecycle so it works regardless of mount
    // order or whether it shares a host page with the Theme Designer.
    root.querySelectorAll('[data-collapsible-toggle]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const group=btn.closest('.designer-group');
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
