// contextPanel.js — Sprint 10.0 Creation Experience V1 (Child First Studio).
//
// Replaces the permanent tab bar + always-visible designer sections with a
// single Context Panel that shows only the controls relevant to whatever is
// currently selected. Deliberately does NOT rebuild or duplicate editing
// logic: CardDesigner / PageDesigner / StickerStudio / WorkspaceBuilder are
// mounted exactly as before (js/app.js is unchanged there) and keep doing
// all the real work. This module only:
//   1. Hides the tab bar and each section's accordion chrome (CSS, via the
//      `context-panel-mode` class added once at init), and
//   2. Drives which existing tab-content / [data-card-section] block is
//      visible, based on the current selection — a thin, additive
//      orchestration layer, not a second rendering system.
// The one new surface is the "Nothing Selected" default view (Representation
// info / Change Representation / Caption or Quote fields / Page Background /
// Add a Sticker) — built fresh here since no existing panel covers it.
//
// Two context-panel states the sprint's own spec describes as separate
// selectable objects — Artwork vs. Frame, and Title vs. Description vs.
// Metadata — do not have separate hit-targets in today's canvas (clicking
// the picture selects one "image-holder" scene element; Museum Gallery's
// caption is one composed layer, not three clickable fields). Rather than
// add new hit-testing (out of this sprint's Studio-UX-only scope), this
// module shows Picture + Frame controls together on that one click, and
// Title/Artist/Age/Date as one grouped Caption editor in the default view.
const ContextPanel=(function(){
  'use strict';

  const TAB_IDS=['card-tab','story-tab','style-tab','stickers-tab'];

  // scene element type -> CardDesigner section id(s) to show together.
  // 'image-holder' shows only 'image': for a Story-role page (every
  // Museum Gallery representation this sprint), SceneEngine.getRenderData
  // returns null (no scene blueprint for Story role — see
  // js/sceneEngine.js), so the 'frame' ("Picture Holder") section only
  // ever renders its "Pick the picture holder…" placeholder; Fit/Fill/
  // Original, Frame Look, Frame Style, and Frame Variation already live
  // inside the 'image' ("Picture") section for exactly this reason.
  const TYPE_TO_SECTIONS={
    'image-holder':['image'],
    'text-holder':['text'],
    'text':['text'],
    'sticker':['sticker'],
    'decoration':['decoration']
  };

  let host=null;
  let rightSidebar=null;
  let panelRoot=null;
  let initialized=false;
  let stickerStudioOpen=false;

  function configure(cfg){ host=cfg||null; }

  function _el(tag,className,text){
    const e=document.createElement(tag);
    if(className) e.className=className;
    if(text!==undefined) e.textContent=text;
    return e;
  }

  function _currentSlide(){
    if(host && typeof host.getCurrentSlide==='function'){ try{ return host.getCurrentSlide(); }catch(e){} }
    return null;
  }

  function init(){
    if(initialized) return;
    rightSidebar=document.querySelector('.right-sidebar');
    if(!rightSidebar) return;
    panelRoot=document.createElement('div');
    panelRoot.id='contextPanelRoot';
    panelRoot.className='context-panel-root';
    const tabsEl=rightSidebar.querySelector('.tabs');
    if(tabsEl) rightSidebar.insertBefore(panelRoot,tabsEl.nextSibling);
    else rightSidebar.insertBefore(panelRoot,rightSidebar.firstChild);
    rightSidebar.classList.add('context-panel-mode');
    initialized=true;
    refresh();
  }

  // ---------- Tab / section visibility orchestration ----------
  function _setTabVisible(tabId){
    TAB_IDS.forEach(function(id){
      const el=document.getElementById(id);
      if(el) el.classList.toggle('context-visible', id===tabId);
    });
  }
  function _hideAllTabs(){
    TAB_IDS.forEach(function(id){
      const el=document.getElementById(id);
      if(el) el.classList.remove('context-visible');
    });
  }
  function _setCardSections(ids){
    const root=document.getElementById('cardDesignerRoot');
    if(!root) return;
    root.querySelectorAll('[data-card-section]').forEach(function(sec){
      const id=sec.getAttribute('data-card-section');
      sec.classList.toggle('context-active', ids.indexOf(id)!==-1);
    });
  }

  // ---------- Main dispatcher ----------
  function _resetScroll(){
    if(!rightSidebar) return;
    rightSidebar.scrollTop=0;
    // CardDesigner.focusSection() (called from app.js's existing
    // _setSelectedSceneElement/_setSelectedTextElement, upstream of this
    // call) schedules its own scrollIntoView via requestAnimationFrame —
    // deferring this reset the same way guarantees it runs AFTER that one
    // in the same frame, rather than being immediately overridden by it.
    try{ window.requestAnimationFrame(function(){ rightSidebar.scrollTop=0; }); }catch(e){}
  }

  function refresh(){
    if(!initialized) return;
    stickerStudioOpen=false;
    _resetScroll();
    const textId=host && typeof host.getSelectedTextElement==='function' ? host.getSelectedTextElement() : null;
    const sceneId=host && typeof host.getSelectedSceneElement==='function' ? host.getSelectedSceneElement() : null;
    const sceneType=host && typeof host.getSelectedSceneElementType==='function' ? host.getSelectedSceneElementType() : null;

    if(sceneId && sceneType && TYPE_TO_SECTIONS[sceneType]){
      // 'image-holder' (Artwork) is the one synthetic selection with no
      // render-tree bbox (js/objectStrip.js's own disclosed exception)
      // and keeps its existing, unconditional behaviour.
      if(sceneType==='image-holder'){
        _setTabVisible('card-tab');
        _setCardSections(TYPE_TO_SECTIONS[sceneType]);
        _renderArtworkActions();
        return;
      }
      // Creator Runtime Pass Sprint — ask Page Runtime whether the
      // selection still resolves to something actually rendered on the
      // active page BEFORE opening any section at all, not only before
      // choosing disclosure wording. A selection left over from a
      // different page (or a since-removed object) now falls through to
      // the default view instead of opening a live-looking but
      // id-blind editor.
      const sceneObj=_findSceneObject(sceneId,sceneType);
      if(!sceneObj){
        _hideAllTabs();
        _renderDefault();
        return;
      }
      if(sceneObj.owner==='world'){
        _renderWorldObjectDisclosure(sceneObj);
        return;
      }
      _setTabVisible('card-tab');
      _setCardSections(TYPE_TO_SECTIONS[sceneType]);
      _renderSelectionHeading(sceneType);
      return;
    }
    if(textId){
      _setTabVisible('card-tab');
      _setCardSections(['text']);
      _renderSelectionHeading('text');
      return;
    }
    _hideAllTabs();
    _renderDefault();
  }

  // Sprint 10.0 shipped this as a blank hand-off straight into the raw
  // CardDesigner accordion section — fine when the panel sat inside a
  // permanent tab bar, but the Creator V2 rebuild gives every selection
  // its own small, friendly "what am I editing" banner (icon + name),
  // matching the wireframe's per-object state cards. The controls
  // underneath are still the exact same CardDesigner section — this only
  // adds a heading above it.
  const SELECTION_BANNERS={
    'text-holder':{icon:'📝',label:'Your Text'},
    'text':{icon:'📝',label:'Your Text'},
    'sticker':{icon:'✨',label:'Your Sticker'},
    'decoration':{icon:'🎀',label:'Your Decoration'}
  };
  // Creator Reconciliation Sprint — the selected object itself, read
  // straight off the render tree (the same SlideRenderer.getSceneElements()
  // list js/objectStrip.js already builds its cards from), is the source
  // of truth for what Context Panel shows. 'image-holder' never resolves
  // here on purpose (no render-tree bbox exists for it).
  function _findSceneObject(sceneId,sceneType){
    if(sceneType==='image-holder') return null;
    const list=(typeof PageRuntime!=='undefined')
      ? PageRuntime.getRenderedObjects().scene
      : ((typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getSceneElements==='function') ? SlideRenderer.getSceneElements() : []);
    for(let i=0;i<list.length;i++){ if(list[i].id===sceneId) return list[i]; }
    return null;
  }

  // A World-owned Scene Object (a theme-authored Layer Pack entry —
  // Museum Caption, Wax Seal, Gallery Spotlight, …) never opens Card
  // Designer's generic decoration/text/sticker section: that section
  // reads slide.metadata.elementOverrides, which isn't keyed to this
  // object's own id at all — opening it would show live-looking controls
  // that silently don't target what was clicked. Builder's own editable
  // capability (js/projectModel.js's layer.permissions) decides the
  // wording; a real generic editor for Builder-owned content is a later
  // phase, not faked here.
  function _renderWorldObjectDisclosure(sceneObj){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const banner=_el('div','context-panel-heading context-selection-banner');
    banner.appendChild(_el('span','context-selection-banner-icon','🌍'));
    banner.appendChild(_el('span','context-selection-banner-label',sceneObj.label||'World Object'));
    panelRoot.appendChild(banner);
    panelRoot.appendChild(_el('div','context-nothing-selected-hint',
      sceneObj.editable
        ? 'This is part of the World, but you may adjust it. That kind of edit isn’t available in Creator yet.'
        : 'This is part of the World.'
    ));
  }

  function _renderSelectionHeading(type){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const info=SELECTION_BANNERS[type];
    if(info){
      const banner=_el('div','context-panel-heading context-selection-banner');
      banner.appendChild(_el('span','context-selection-banner-icon',info.icon));
      banner.appendChild(_el('span','context-selection-banner-label',info.label));
      panelRoot.appendChild(banner);
    }
  }
  function _renderEmpty(){
    panelRoot.innerHTML='';
    panelRoot.classList.add('is-empty');
  }

  // ---------- "Artwork Selected" quick actions ----------
  // Replace Artwork / Crop / Rotate sit here (new, small, additive) since
  // no existing control replaces a slide's picture in place — uploading
  // today always adds a NEW slide. Fit / Fill / Original / Frame
  // Variations are the existing CardDesigner 'image' + 'frame' sections,
  // shown right below this row by _setCardSections.
  function _applyImageResult(result){
    const slide=_currentSlide();
    if(!slide || !result) return;
    const img=new Image();
    img.onload=function(){
      slide.image=img;
      slide._imageDataURL=result.dataURL;
      delete slide.thumbnail;
      if(typeof ThumbnailEngine!=='undefined'){
        try{ ThumbnailEngine.generate(slide).then(function(){
          try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
          try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
        }); }catch(e){}
      }
      if(host){
        if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
        if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
      }
      if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
    };
    img.src=result.dataURL;
  }

  function _replaceArtwork(){
    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.addEventListener('change',function(){
      const file=input.files && input.files[0];
      if(!file || typeof PictureStudio==='undefined') return;
      PictureStudio.open(file,{defaultMode:'fit',onApply:_applyImageResult});
    });
    input.click();
  }

  function _cropRotateArtwork(){
    const slide=_currentSlide();
    if(!slide || typeof PictureStudio==='undefined') return;
    const source=slide.image||slide._imageDataURL;
    if(!source) return;
    PictureStudio.open(source,{defaultMode:'fit',onApply:_applyImageResult});
  }

  function _renderArtworkActions(){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const banner=_el('div','context-panel-heading context-selection-banner');
    banner.appendChild(_el('span','context-selection-banner-icon','🖼️'));
    banner.appendChild(_el('span','context-selection-banner-label','Your Picture'));
    panelRoot.appendChild(banner);
    const row=_el('div','context-action-row');
    const replaceBtn=_el('button','context-btn context-btn-primary','🖼️ Replace Artwork');
    replaceBtn.type='button';
    replaceBtn.addEventListener('click',_replaceArtwork);
    row.appendChild(replaceBtn);
    const cropBtn=_el('button','context-btn','✂️ Crop / Rotate');
    cropBtn.type='button';
    cropBtn.addEventListener('click',_cropRotateArtwork);
    row.appendChild(cropBtn);
    panelRoot.appendChild(row);
  }

  // ---------- "Nothing Selected" default view ----------
  function _safeColor(c){
    if(typeof c!=='string') return '#1D3457';
    const m=c.match(/^#?[0-9a-f]{6}/i);
    return m ? ('#'+m[0].replace('#','').toLowerCase()) : '#1D3457';
  }

  // Sprint 10.1 — Theme Driven Representations. The active theme's own
  // `representations` array is the only source of a Representation's
  // name/actions — nothing here names Showcase/Portrait/Quote (or any
  // other theme's Representation) directly.
  function _activeRepresentations(){
    if(typeof ThemeEngine==='undefined' || typeof ThemeRegistry==='undefined') return null;
    const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
    if(artworkId){
      const theme=ThemeRegistry.get(artworkId);
      if(theme && Array.isArray(theme.representations) && theme.representations.length){
        return {themeId:artworkId,reps:theme.representations};
      }
    }
    const storyId=ThemeEngine.getActiveThemeId && ThemeEngine.getActiveThemeId();
    if(storyId){
      const theme=ThemeRegistry.get(storyId);
      if(theme && Array.isArray(theme.representations) && theme.representations.length){
        return {themeId:storyId,reps:theme.representations};
      }
    }
    return null;
  }

  function _currentRepresentation(){
    const active=_activeRepresentations();
    const slide=_currentSlide();
    const layout=slide && slide.metadata && slide.metadata.layout;
    if(!active || !layout) return null;
    return active.reps.find(function(r){ return r.layout===layout; }) || null;
  }

  function _repInfo(){
    const artworkId=(typeof ThemeEngine!=='undefined' && ThemeEngine.getActiveArtworkThemeId) ? ThemeEngine.getActiveArtworkThemeId() : null;
    if(!artworkId) return null;
    const rep=_currentRepresentation();
    return {name:rep?rep.name:null,theme:artworkId};
  }

  function _appendRepresentationRow(container){
    const info=_repInfo();
    const reps=(typeof CreationFlow!=='undefined') ? CreationFlow.currentRepresentations() : null;
    if(!info && !(reps&&reps.length)) return;
    container.appendChild(_el('div','context-panel-heading','Page Style'));
    if(info && info.name){
      container.appendChild(_el('div','context-rep-name',info.name));
    }
    if(reps && reps.length){
      const btn=_el('button','context-btn','🔄 Change Look');
      btn.type='button';
      btn.addEventListener('click',function(){ CreationFlow.changeRepresentation(); });
      container.appendChild(btn);
    }
  }

  // Sprint 10.1 — which field group to show comes from the current
  // Representation's own declared `actions` (editQuote / editCaption),
  // not a hardcoded layout id check. `editQuote`/`editCaption` are the
  // two field-group ids Studio knows how to render (mirroring how Layer
  // `type`/`target` are a small, known enum) — a Representation that
  // declares neither (or none exist yet, e.g. a legacy artworkTheme
  // never chosen through the Creation Flow) simply gets no field group,
  // rather than Studio guessing.
  function _appendCaptionOrQuote(container){
    const rep=_currentRepresentation();
    if(!rep || !Array.isArray(rep.actions)) return;
    const slide=_currentSlide();
    if(!slide) return;
    if(!slide.metadata) slide.metadata={};
    if(rep.actions.indexOf('editQuote')!==-1){
      container.appendChild(_el('div','context-panel-heading','Your Quote'));
      [
        {key:'quoteText',label:'Quote',multiline:true,placeholder:'e.g. Every child is an artist…'},
        {key:'quoteAttribution',label:'Attribution',multiline:false,placeholder:'e.g. Pablo Picasso'}
      ].forEach(function(f){ _appendMetadataField(container,slide,f); });
    }else if(rep.actions.indexOf('editCaption')!==-1){
      container.appendChild(_el('div','context-panel-heading','Caption'));
      [
        {key:'artworkTitle',label:'Title',placeholder:'e.g. The Big Tree'},
        {key:'artist',label:'Artist',placeholder:'e.g. Vihaan'},
        {key:'age',label:'Age',placeholder:'e.g. 7'},
        {key:'date',label:'Date',placeholder:'e.g. May 2025'}
      ].forEach(function(f){ _appendMetadataField(container,slide,f); });
    }
  }

  function _appendMetadataField(container,slide,f){
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label',f.label));
    const input=document.createElement(f.multiline?'textarea':'input');
    if(!f.multiline) input.type='text';
    else input.rows=3;
    input.className='input-field workspace-text-input';
    input.placeholder=f.placeholder||'';
    input.value=(slide.metadata[f.key]!==undefined)?slide.metadata[f.key]:'';
    input.addEventListener('input',function(){
      if(input.value) slide.metadata[f.key]=input.value; else delete slide.metadata[f.key];
      if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    });
    row.appendChild((typeof EmojiPicker!=='undefined') ? EmojiPicker.wrap(input) : input);
    container.appendChild(row);
  }

  function _appendBackground(container){
    if(typeof ThemeEngine==='undefined') return;
    container.appendChild(_el('div','context-panel-heading','Page Background'));
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label','Background Colour'));
    const input=document.createElement('input');
    input.type='color';
    input.className='theme-color-input';
    try{
      const opts=ThemeEngine.getOptions();
      const theme=ThemeEngine.getActiveTheme();
      input.value=_safeColor((opts.colours&&opts.colours.frame)||(theme&&theme.frame&&theme.frame.color)||'#1D3457');
    }catch(e){}
    input.addEventListener('input',function(){
      try{ ThemeEngine.setSubOption('colours','frame',input.value); }catch(e){}
    });
    row.appendChild(input);
    container.appendChild(row);
  }

  function _appendAddSticker(container){
    const btn=_el('button','context-btn','✨ Add a Sticker');
    btn.type='button';
    btn.addEventListener('click',_showStickerStudio);
    container.appendChild(btn);
  }

  function _showStickerStudio(){
    stickerStudioOpen=true;
    _setTabVisible('stickers-tab');
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const btn=_el('button','context-btn','← Done Adding Stickers');
    btn.type='button';
    btn.addEventListener('click',function(){ refresh(); });
    panelRoot.appendChild(btn);
  }

  function _renderDefault(){
    if(stickerStudioOpen) return;
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const hint=_el('div','context-nothing-selected-hint','👆 Tap anything on the page to edit it');
    panelRoot.appendChild(hint);
    _appendRepresentationRow(panelRoot);
    _appendCaptionOrQuote(panelRoot);
    // Museum Gallery story-role pages have no per-page background scene
    // control today (only Cover/Hook/End roles do) — this reuses the
    // existing global Theme Designer background colour instead of
    // inventing new per-page background behaviour.
    _appendBackground(panelRoot);
    _appendAddSticker(panelRoot);
  }

  return {
    configure:configure,
    init:init,
    refresh:refresh
  };
})();
try{ window.ContextPanel=ContextPanel; }catch(e){}
