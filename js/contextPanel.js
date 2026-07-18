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
//
// Right Panel Redesign — Personalize ⇄ Refine. Rules 2/3/4 each get their
// own real estate instead of competing for it: Status (Rule 2 — the small
// guardrail pill at the top of a selection), Refine (Rule 3 — still 100%
// CardDesigner's own #card-tab markup, completely untouched by this file),
// and Personalize (Rule 4 — adding a new personal layer to the page). When
// nothing is selected, Personalize takes the whole panel; the instant
// something IS selected, Personalize collapses to one quiet strip and
// Refine expands into the room it gave up. Anything Personalize's own
// "+ Add Something" menu creates (a sticker, a decoration, a shape) is a
// completely ordinary SceneEngine.addSticker object — it lands in the
// render tree / Object Strip exactly like anything else, with zero new
// plumbing, which is what actually closes the Rule 4 → Rule 3 loop.
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

  // Right Panel Redesign — state for the Personalize ⇄ Refine swap.
  // personalizeExpanded: only meaningful once something is selected —
  // false shows the collapsed one-line strip, true re-expands the full
  // Personalize zone in place. personalizeOpenSection: which single
  // inline-accordion body (inside the full Personalize zone) is open —
  // 'add' | 'background' | 'caption' | null; opening one closes any
  // other. Both reset only when the selection itself actually changes
  // (tracked via _lastSelectionKey), never on a same-selection refresh()
  // triggered by toggling one of these very controls.
  let personalizeExpanded=false;
  let personalizeOpenSection=null;
  let _lastSelectionKey=null;

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

    // Right Panel Redesign — Personalize's own expand/collapse state only
    // resets when the SELECTION itself changed, not on a same-selection
    // refresh() triggered by tapping the collapsed strip or an accordion
    // trigger (both simply call refresh() again after mutating one of
    // these two variables).
    const key=(sceneId||'')+'|'+(sceneType||'')+'|'+(textId||'');
    if(key!==_lastSelectionKey){
      personalizeExpanded=false;
      personalizeOpenSection=null;
    }
    _lastSelectionKey=key;

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
        // A World-owned selection replaces the whole panel with its own
        // disclosure banner — it must hide whatever CardDesigner tab/
        // section a PRIOR selection left visible, or a stale, seemingly-
        // live editor (e.g. "Your Picture"'s Fit/Frame controls) stays
        // rendered underneath the "This is part of the World" message,
        // contradicting it.
        _hideAllTabs();
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

  // Right Panel Redesign — Rule 2's own small status pill, shown at the
  // top of every real selection state (World-owned, a Place, or an
  // ordinary Story-owned object) so the guardrail is legible at a glance
  // without reading a paragraph of disclosure text.
  function _appendStatusPill(container,icon,label,kind){
    const zone=_el('div','context-zone-status');
    const pill=_el('span','context-status-pill'+(kind?(' context-status-pill-'+kind):''));
    pill.appendChild(_el('span','context-status-pill-icon',icon));
    pill.appendChild(_el('span','context-status-pill-label',label));
    zone.appendChild(pill);
    container.appendChild(zone);
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
  // Honour World-Owned Object Commitments sprint — a Story-Author edit
  // to a World-owned object's own content, live and re-drawing. Never
  // calls refresh() (which would rebuild this very panel — including
  // the input the child is actively using — mid-edit); redraws the
  // canvas + Object Strip only, exactly like every other in-place edit
  // control elsewhere in Creator already does.
  function _afterWorldObjectEdit(){
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
    if(typeof ObjectStrip!=='undefined'){ try{ ObjectStrip.refresh(); }catch(e){} }
  }

  // Kind-specific in-place edit control, built from the exact same
  // `visual` descriptor (renderer/slideRenderer.js's `_layerVisual`)
  // Object Strip's own thumbnail already reads — editing here and the
  // thumbnail agreeing about what a field means is automatic, not
  // separately maintained. Writes through SceneEngine.setContentOverride
  // (js/sceneEngine.js), the exact elementOverrides bag every other
  // per-object override already lives in.
  function _appendWorldObjectEditControl(sceneObj,v){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.setContentOverride!=='function') return;
    if(v.kind==='color' || v.kind==='shape'){
      const row=_el('div','designer-row context-row');
      row.appendChild(_el('div','designer-row-label','Colour'));
      const input=document.createElement('input');
      input.type='color';
      input.className='theme-color-input';
      input.value=_safeColor(v.color||v.fillColor);
      input.addEventListener('input',function(){
        SceneEngine.setContentOverride(slide,sceneObj.id,'fillColor',input.value);
        _afterWorldObjectEdit();
      });
      row.appendChild(input);
      panelRoot.appendChild(row);
    }else if(v.kind==='image'){
      const btn=_el('button','context-btn','🖼️ Replace Image');
      btn.type='button';
      btn.addEventListener('click',function(){
        const fileInput=document.createElement('input');
        fileInput.type='file';
        fileInput.accept='image/*';
        fileInput.addEventListener('change',function(){
          const file=fileInput.files && fileInput.files[0];
          if(!file) return;
          const reader=new FileReader();
          reader.onload=function(){
            SceneEngine.setContentOverride(slide,sceneObj.id,'image',reader.result);
            _afterWorldObjectEdit();
          };
          reader.readAsDataURL(file);
        });
        fileInput.click();
      });
      panelRoot.appendChild(btn);
    }else if(v.kind==='text'){
      panelRoot.appendChild(_el('div','designer-row-label','Words'));
      const textarea=document.createElement('textarea');
      textarea.className='context-textarea';
      textarea.value=v.content||'';
      textarea.addEventListener('input',function(){
        SceneEngine.setContentOverride(slide,sceneObj.id,'content',textarea.value);
        _afterWorldObjectEdit();
      });
      panelRoot.appendChild(textarea);
    }
  }

  // Decoration Slot — "Let the Story Author add their own decorations
  // here too." Reuses Sticker Studio end to end (pick-from-library ->
  // place-on-canvas -> slide.metadata.stickers[]), the existing
  // mechanism for a Story Author adding their own decorative content,
  // rather than inventing a second one; the only new piece is seeding
  // the very next placement near this object's own position instead of
  // Sticker Studio's ordinary centered default.
  function _appendDecorationSlotButton(sceneObj){
    const btn=_el('button','context-btn','✨ Add your own decoration here');
    btn.type='button';
    btn.addEventListener('click',function(){
      if(typeof StickerStudio!=='undefined' && typeof StickerStudio.setNextPlacementSeed==='function'){
        try{ StickerStudio.setNextPlacementSeed(sceneObj.bx+sceneObj.bw/2, sceneObj.by+sceneObj.bh/2); }catch(e){}
      }
      _showStickerStudio();
    });
    panelRoot.appendChild(btn);
  }

  // A World-owned Scene Object (a theme-authored Layer Pack entry —
  // Museum Caption, Wax Seal, Gallery Spotlight, …) never opens Card
  // Designer's generic decoration/text/sticker section: that section
  // reads slide.metadata.elementOverrides directly by section, not by
  // this object's own id — opening it would show live-looking controls
  // that silently don't target what was clicked. Builder's own editable
  // capability (js/projectModel.js's layer.permissions) decides whether
  // a real, kind-specific edit control (Part C of the Honour World-
  // Owned Object Commitments sprint) is offered here instead.
  function _renderWorldObjectDisclosure(sceneObj){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const banner=_el('div','context-panel-heading context-selection-banner');
    banner.appendChild(_el('span','context-selection-banner-icon','🌍'));
    banner.appendChild(_el('span','context-selection-banner-label',sceneObj.label||'World Object'));
    panelRoot.appendChild(banner);
    _appendStatusPill(panelRoot,'🌍',sceneObj.editable?'Part of the World — you can adjust it':'Part of the World','world');
    const v=sceneObj.visual;
    const hasRealControl=sceneObj.editable && v && (v.kind==='color'||v.kind==='shape'||v.kind==='image'||v.kind==='text');
    panelRoot.appendChild(_el('div','context-nothing-selected-hint',
      hasRealControl
        ? 'This is part of the World — you can adjust it below.'
        : sceneObj.editable
          ? 'This is part of the World, but you may adjust it. That kind of edit isn’t available in Creator yet.'
          : 'This is part of the World.'
    ));
    if(hasRealControl) _appendWorldObjectEditControl(sceneObj,v);
    if(sceneObj.decorationSlot) _appendDecorationSlotButton(sceneObj);
    _renderPersonalizeZone(panelRoot,{full:personalizeExpanded});
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
    // Every object reachable through this branch is an ordinary,
    // Story-owned object (World-owned selections are routed to
    // _renderWorldObjectDisclosure instead, above) — always editable.
    _appendStatusPill(panelRoot,'✏️','You can edit this','editable');
    _renderPersonalizeZone(panelRoot,{full:personalizeExpanded});
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
  //
  // Multiple Artwork Places Per Page — the current selection's own scene
  // id IS the Place id ('image-holder' for Place 1, unchanged; an extra
  // Place's own 'image-place-N' id otherwise); every function below reads
  // it once and routes to the correct storage, Place 1's own path
  // completely unchanged.
  function _currentPlaceId(){
    const id=host && typeof host.getSelectedSceneElement==='function' ? host.getSelectedSceneElement() : null;
    return (id && id!=='image-holder') ? id : undefined;
  }
  function _hasPlaceImage(slide,placeId){
    if(!slide) return false;
    if(!placeId) return !!slide.image;
    return !!(slide._placeImages && slide._placeImages[placeId] && slide._placeImages[placeId].width);
  }
  // Right Panel Redesign — whether the currently-selected Place's own
  // look was locked by the Theme Author (Builder's per-Place "Can a
  // Story Author change this?" guardrail, already compiled onto
  // placeRects and already enforced by Card Designer's Frame controls —
  // see SlideRenderer.getPlacePermissions). Used only for the Status
  // pill's own wording here; the actual enforcement lives in
  // js/cardDesigner.js, untouched by this file.
  function _placeEditable(slide,placeId){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getPlacePermissions!=='function') return true;
    try{
      const perm=SlideRenderer.getPlacePermissions(slide,placeId||'image-holder');
      return !perm || perm.editable!==false;
    }catch(e){ return true; }
  }
  function _applyImageResult(result){
    const slide=_currentSlide();
    if(!slide || !result) return;
    const placeId=_currentPlaceId();
    const img=new Image();
    img.onload=function(){
      if(!placeId){
        slide.image=img;
        slide._imageDataURL=result.dataURL;
      }else{
        if(!slide.metadata) slide.metadata={};
        if(!slide.metadata.placeContent) slide.metadata.placeContent={};
        if(!slide.metadata.placeContent[placeId]) slide.metadata.placeContent[placeId]={};
        slide.metadata.placeContent[placeId].dataURL=result.dataURL;
        if(!slide._placeImages) slide._placeImages={};
        slide._placeImages[placeId]=img;
      }
      // The page thumbnail represents every Place combined, so any
      // Place's picture changing invalidates it, not only Place 1's.
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
      if(typeof ObjectStrip!=='undefined'){ try{ ObjectStrip.refresh(); }catch(e){} }
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
      const placeId=_currentPlaceId();
      const places=(placeId && typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceRects==='function')
        ? SlideRenderer.getPlaceRects(_currentSlide())
        : null;
      const place=places && places.find(function(p){ return p.id===placeId; });
      const defaultMode=(place && place.place && place.place.fit) || 'fit';
      PictureStudio.open(file,{defaultMode:defaultMode,onApply:_applyImageResult});
    });
    input.click();
  }

  function _cropRotateArtwork(){
    const slide=_currentSlide();
    if(!slide || typeof PictureStudio==='undefined') return;
    const placeId=_currentPlaceId();
    const source=placeId
      ? ((slide._placeImages && slide._placeImages[placeId]) || (slide.metadata && slide.metadata.placeContent && slide.metadata.placeContent[placeId] && slide.metadata.placeContent[placeId].dataURL))
      : (slide.image||slide._imageDataURL);
    if(!source) return;
    PictureStudio.open(source,{defaultMode:'fit',onApply:_applyImageResult});
  }

  function _renderArtworkActions(){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const slide=_currentSlide();
    const placeId=_currentPlaceId();
    const hasImage=_hasPlaceImage(slide,placeId);
    const banner=_el('div','context-panel-heading context-selection-banner');
    banner.appendChild(_el('span','context-selection-banner-icon','🖼️'));
    banner.appendChild(_el('span','context-selection-banner-label','Your Picture'));
    panelRoot.appendChild(banner);
    const editable=_placeEditable(slide,placeId);
    _appendStatusPill(panelRoot, editable?'✏️':'🔒', editable?'You can edit this':'Locked', editable?'editable':'locked');
    const row=_el('div','context-action-row');
    // Creator Acceptance Sprint — "Add Artwork" before anything's been
    // uploaded, "Replace Artwork" once it has; Crop/Rotate only shows
    // once there's something to crop (it already silently no-ops with
    // nothing selected via _cropRotateArtwork's own guard — hiding it
    // just removes a dead button, not new capability).
    const replaceBtn=_el('button','context-btn context-btn-primary',hasImage?'🖼️ Replace Artwork':'🖼️ Add Artwork');
    replaceBtn.type='button';
    replaceBtn.addEventListener('click',_replaceArtwork);
    row.appendChild(replaceBtn);
    if(hasImage){
      const cropBtn=_el('button','context-btn','✂️ Crop / Rotate');
      cropBtn.type='button';
      cropBtn.addEventListener('click',_cropRotateArtwork);
      row.appendChild(cropBtn);
    }
    panelRoot.appendChild(row);
    _renderPersonalizeZone(panelRoot,{full:personalizeExpanded});
  }

  // ---------- "Nothing Selected" default view ----------
  function _safeColor(c){
    if(typeof c!=='string') return '#1D3457';
    const m=c.match(/^#?[0-9a-f]{6}/i);
    return m ? ('#'+m[0].replace('#','').toLowerCase()) : '#1D3457';
  }

  // Creator Acceptance Sprint — same lookup js/app.js's own
  // _updateHeaderContext() already makes (Artwork Theme first, Story
  // Theme fallback), reused here so the default view can greet the
  // child by the active World's own name/icon instead of a generic hint.
  function _worldIdentity(){
    if(typeof ThemeEngine==='undefined' || typeof ThemeRegistry==='undefined') return null;
    const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
    const storyId=ThemeEngine.getActiveThemeId && ThemeEngine.getActiveThemeId();
    const themeId=artworkId||storyId;
    const theme=themeId && ThemeRegistry.get ? ThemeRegistry.get(themeId) : null;
    if(!theme) return null;
    return {icon:theme.themeIcon||'📖', name:theme.name||''};
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

  // A real, user-reported bug: this wrote to the STORY Theme's global
  // colours.frame sub-option (ThemeEngine.setSubOption), which
  // renderer/slideRenderer.js's background-fill line always preferred
  // the active World's own wall tone over -- so for any World-based
  // page (the common case), changing this swatch had zero visible
  // effect on the canvas. Fixed to write a genuine PER-PAGE override
  // (slide.metadata.cardOverrides.background) that the renderer now
  // checks first, ahead of both wall tone and the Story Theme default
  // -- matching the "PAGE BACKGROUND" heading this control has always
  // shown, and the same per-card override pattern every other Story-
  // Author control in this file already uses.
  function _appendBackground(container){
    const slide=_currentSlide();
    if(!slide) return;
    container.appendChild(_el('div','context-panel-heading','Page Background'));
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label','Background Colour'));
    const input=document.createElement('input');
    input.type='color';
    input.className='theme-color-input';
    const existing=slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.background;
    let fallback='#1D3461';
    try{
      if(typeof ThemeEngine!=='undefined'){
        const opts=ThemeEngine.getOptions();
        const theme=ThemeEngine.getActiveTheme();
        fallback=(opts.colours&&opts.colours.frame)||(theme&&theme.frame&&theme.frame.color)||fallback;
      }
    }catch(e){}
    input.value=_safeColor(existing||fallback);
    input.addEventListener('input',function(){
      if(!slide.metadata) slide.metadata={};
      if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
      slide.metadata.cardOverrides.background=input.value;
      if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    });
    row.appendChild(input);
    container.appendChild(row);
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

  // ---------- Right Panel Redesign — Personalize zone ----------

  // "+ Add Something"'s 7 rows. Stickers/Decorations/Shape are all,
  // today, the exact same underlying capability — SceneEngine.addSticker
  // via Sticker Studio, filtered to a different StickerLibrary category —
  // confirmed by investigation before this sprint began; there is no
  // separate "decoration object"/"shape object" type. Photo reuses the
  // existing Add/Replace Artwork flow. Note/Doodle/Voice have no
  // supporting SceneEngine/renderer capability today (confirmed: no
  // freeform text-object array, no freehand drawing, no audio
  // attachment) — stubbed honestly as Coming Soon rather than faked.
  function _addSomethingItems(){
    return [
      {id:'stickers',icon:'😀',label:'Stickers',onClick:function(){ _showStickerStudio(); }},
      {id:'decorations',icon:'⭐',label:'Decorations',onClick:function(){
        if(typeof StickerStudio!=='undefined' && typeof StickerStudio.setActiveCategory==='function'){
          try{ StickerStudio.setActiveCategory('decorations'); }catch(e){}
        }
        _showStickerStudio();
      }},
      {id:'shape',icon:'🔷',label:'Shape',onClick:function(){
        if(typeof StickerStudio!=='undefined' && typeof StickerStudio.setActiveCategory==='function'){
          try{ StickerStudio.setActiveCategory('shapes'); }catch(e){}
        }
        _showStickerStudio();
      }},
      {id:'photo',icon:'📸',label:'Photo',onClick:_addPhoto},
      {id:'note',icon:'🗒️',label:'Note',comingSoon:true},
      {id:'doodle',icon:'✏️',label:'Doodle',comingSoon:true},
      {id:'voice',icon:'🎤',label:'Voice',comingSoon:true}
    ];
  }

  // Photo — no existing "fill the next empty Place" helper anywhere in
  // the codebase (confirmed by investigation); _replaceArtwork()/
  // _applyImageResult() are entirely selection-driven. This selects the
  // first Place with no picture yet (or falls back to Place 1 / the
  // Cover-Hook-End single-holder case once every Place is filled or the
  // theme has none) before handing off to the existing, unmodified
  // upload flow — one tap from "Photo" to a real file picker.
  function _firstOpenPlaceSelection(slide){
    if(!slide) return {id:'image-holder'};
    let places=null;
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceRects==='function'){
      try{ places=SlideRenderer.getPlaceRects(slide); }catch(e){ places=null; }
    }
    if(places && places.length){
      for(let i=0;i<places.length;i++){
        const p=places[i];
        const placeId=(p.id && p.id!=='image-holder') ? p.id : undefined;
        if(!_hasPlaceImage(slide,placeId)) return {id:p.id||'image-holder'};
      }
    }
    return {id:'image-holder'};
  }

  function _addPhoto(){
    const slide=_currentSlide();
    const target=_firstOpenPlaceSelection(slide);
    // PageRuntime.selectSceneObject -> host.setSelectedSceneElement
    // already ends in PageRuntime.notify() (js/app.js's own
    // _setSelectedSceneElement), which rebuilds this very panel into
    // the Artwork-selected state — no separate notify() call needed.
    if(typeof PageRuntime!=='undefined' && typeof PageRuntime.selectSceneObject==='function'){
      try{ PageRuntime.selectSceneObject(target.id,'image-holder'); }catch(e){}
    }
    _replaceArtwork();
  }

  function _buildAddSomethingAccordion(){
    const wrap=_el('div','context-add-accordion');
    const trigger=_el('button','context-add-trigger');
    trigger.type='button';
    trigger.appendChild(_el('span','context-add-trigger-label','➕ Add Something'));
    trigger.appendChild(_el('span','context-accordion-chevron',personalizeOpenSection==='add'?'▴':'▾'));
    trigger.addEventListener('click',function(){
      personalizeOpenSection=(personalizeOpenSection==='add')?null:'add';
      refresh();
    });
    wrap.appendChild(trigger);
    if(personalizeOpenSection==='add'){
      const list=_el('div','context-add-list');
      _addSomethingItems().forEach(function(item){
        const row=_el('button','context-add-item'+(item.comingSoon?' is-coming-soon':''));
        row.type='button';
        row.appendChild(_el('span','context-add-item-icon',item.icon));
        row.appendChild(_el('span','context-add-item-label',item.label));
        if(item.comingSoon){
          row.appendChild(_el('span','context-add-item-soon','Soon'));
          row.disabled=true;
        }else{
          row.addEventListener('click',item.onClick);
        }
        list.appendChild(row);
      });
      wrap.appendChild(list);
    }
    return wrap;
  }

  // Background Colour — reuses _appendBackground's own field-building
  // body verbatim (unchanged internals, same per-page override), now
  // only rendered while its own accordion body is open instead of
  // always-rendered.
  function _buildBackgroundTile(){
    const wrap=_el('div','context-set-tile');
    const trigger=_el('button','context-set-trigger');
    trigger.type='button';
    trigger.appendChild(_el('span','context-set-trigger-label','🎨 Background Colour'));
    trigger.appendChild(_el('span','context-accordion-chevron',personalizeOpenSection==='background'?'▴':'▾'));
    trigger.addEventListener('click',function(){
      personalizeOpenSection=(personalizeOpenSection==='background')?null:'background';
      refresh();
    });
    wrap.appendChild(trigger);
    if(personalizeOpenSection==='background'){
      const body=_el('div','context-set-body');
      _appendBackground(body);
      wrap.appendChild(body);
    }
    return wrap;
  }

  // Change Look — reuses _appendRepresentationRow verbatim (same gate,
  // same button, same CreationFlow.changeRepresentation() call); it
  // fires immediately and navigates to the existing full-screen
  // Representation picker, so it has no inline accordion body of its
  // own. Returns null (renders nothing) when the active theme has no
  // Representations to switch between — matching the dead-button-
  // avoidance convention already used elsewhere in this file.
  function _buildChangeLookTile(){
    const info=_repInfo();
    const reps=(typeof CreationFlow!=='undefined') ? CreationFlow.currentRepresentations() : null;
    if(!info && !(reps&&reps.length)) return null;
    const wrap=_el('div','context-set-tile context-set-tile-static');
    _appendRepresentationRow(wrap);
    return wrap;
  }

  // Caption / Quote — reuses _appendCaptionOrQuote's own field-building
  // body verbatim; the tile itself is hidden entirely (not merely
  // disabled) when the active Representation supports neither
  // editCaption nor editQuote, matching the existing no-op the reused
  // function already has.
  function _buildCaptionTile(){
    const rep=_currentRepresentation();
    if(!rep || !Array.isArray(rep.actions)) return null;
    const isQuote=rep.actions.indexOf('editQuote')!==-1;
    const isCaption=!isQuote && rep.actions.indexOf('editCaption')!==-1;
    if(!isQuote && !isCaption) return null;
    const wrap=_el('div','context-set-tile');
    const trigger=_el('button','context-set-trigger');
    trigger.type='button';
    trigger.appendChild(_el('span','context-set-trigger-label',isQuote?'📝 Your Quote':'📝 Caption'));
    trigger.appendChild(_el('span','context-accordion-chevron',personalizeOpenSection==='caption'?'▴':'▾'));
    trigger.addEventListener('click',function(){
      personalizeOpenSection=(personalizeOpenSection==='caption')?null:'caption';
      refresh();
    });
    wrap.appendChild(trigger);
    if(personalizeOpenSection==='caption'){
      const body=_el('div','context-set-body');
      _appendCaptionOrQuote(body);
      wrap.appendChild(body);
    }
    return wrap;
  }

  // The one shared Personalize zone builder — full (nothing selected,
  // or the collapsed strip just got re-tapped open) vs. collapsed (a
  // real object is selected and Refine has taken the room). Every
  // selected-state renderer in this file appends this at the very end
  // of panelRoot, so Personalize is reachable from any selection, not
  // only the default view.
  function _renderPersonalizeZone(container,opts){
    const full=!!(opts && opts.full);
    const zone=_el('div','context-zone-personalize');
    if(!full){
      const strip=_el('div','context-personalize-collapsed');
      strip.appendChild(_el('span','context-personalize-collapsed-label','✨ Personalize this page'));
      strip.appendChild(_el('span','context-accordion-chevron','▾'));
      strip.addEventListener('click',function(){
        personalizeExpanded=true;
        refresh();
      });
      zone.appendChild(strip);
      container.appendChild(zone);
      return;
    }
    zone.appendChild(_el('div','context-zone-label','✨ Personalize this page'));
    zone.appendChild(_buildAddSomethingAccordion());
    const tiles=_el('div','context-set-tiles');
    tiles.appendChild(_buildBackgroundTile());
    const changeLookTile=_buildChangeLookTile();
    if(changeLookTile) tiles.appendChild(changeLookTile);
    const captionTile=_buildCaptionTile();
    if(captionTile) tiles.appendChild(captionTile);
    zone.appendChild(tiles);
    container.appendChild(zone);
  }

  function _renderDefault(){
    if(stickerStudioOpen) return;
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    // Creator Acceptance Sprint / Right Panel Redesign — greet the child
    // by the active World's own name/icon; Personalize itself (below)
    // now teaches what's addable/settable, so the standalone ownership
    // legend and "tap anything" hint are dropped in favour of each
    // object's own Status pill doing that teaching contextually, once
    // something is actually selected.
    const world=_worldIdentity();
    if(world){
      panelRoot.appendChild(_el('div','context-welcome-heading','Welcome to '+world.icon+' '+world.name));
    }
    _renderPersonalizeZone(panelRoot,{full:true});
  }

  return {
    configure:configure,
    init:init,
    refresh:refresh
  };
})();
try{ window.ContextPanel=ContextPanel; }catch(e){}
