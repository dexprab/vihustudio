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
