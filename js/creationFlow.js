// creationFlow.js — Sprint 10.0 Creation Experience V1, made data-driven by
// Sprint 10.1 (Theme Driven Representations).
//
// A full-screen, three-step wizard shown before the editor: Creation Type
// -> Theme -> Representation. Only once a Representation is chosen (or the
// chosen Theme has none) does Studio create the first page and reveal the
// editor.
//
// Sprint 10.1 — Studio knows nothing about Museum Gallery, Storybook
// Classic, or any other theme by name. Creation Types themselves stay a
// small hardcoded list (CREATION_TYPES — an explicit sprint scope
// decision), but which Theme is offered under which Creation Type, and
// which Representation cards a Theme offers, are both read live from
// ThemeRegistry: `theme.supportedCreationTypes` and `theme.representations`.
// A Creation Type with no compatible registered theme shows a generic
// "Coming Soon" screen rather than a hardcoded placeholder theme.
//
// Representation selection only ever writes to existing, already-
// supported fields (slide.metadata.layout, AppState.project.artworkTheme/
// theme) — the exact same fields the Theme Designer / Card Designer
// already read and write.
const CreationFlow=(function(){
  'use strict';

  const CREATION_TYPES=[
    {id:'story',   title:'Story',            desc:'Tell a story, page by page.',        icon:'📖'},
    {id:'artwork', title:'Artwork Showcase',  desc:'Show off a picture you made.',       icon:'🖼️'},
    {id:'quote',   title:'Quote Design',      desc:'Turn your favorite words into art.', icon:'💬'},
    {id:'poem',    title:'Poems',             desc:'Share a poem you wrote.',            icon:'📝'}
  ];

  let overlay=null, content=null;
  let _mode='new'; // 'new' (full flow) | 'change-representation' (Step 3 only, no new page)

  function _el(tag,className,text){
    const e=document.createElement(tag);
    if(className) e.className=className;
    if(text!==undefined) e.textContent=text;
    return e;
  }

  function _ensureDom(){
    if(overlay) return;
    overlay=document.getElementById('creationFlowOverlay');
    content=document.getElementById('creationFlowContent');
  }

  function _clear(){ content.innerHTML=''; }

  function _header(stepLabel,onBack){
    const header=_el('div','creation-flow-header');
    if(onBack){
      const back=_el('button','creation-flow-back','← Back');
      back.type='button';
      back.addEventListener('click',onBack);
      header.appendChild(back);
    }
    header.appendChild(_el('span','creation-flow-step',stepLabel));
    content.appendChild(header);
  }

  // ---------- Theme discovery (data-driven — Sprint 10.1) ----------
  function _allThemes(){
    if(typeof ThemeRegistry==='undefined') return [];
    const c=ThemeRegistry.getCatalog();
    return [].concat(c.story.official,c.story.imported,c.artwork.official,c.artwork.imported);
  }

  // Every registered theme (story or artwork) that declares support for
  // this Creation Type id. A theme with no `supportedCreationTypes` field
  // at all (none exist pre-Sprint-10.1) simply never appears here — no
  // Studio-side default/guess is made on its behalf.
  function _themesForType(typeId){
    return _allThemes().filter(function(t){
      return Array.isArray(t.supportedCreationTypes) && t.supportedCreationTypes.indexOf(typeId)!==-1;
    });
  }

  function _themeType(themeId){
    const rec=(typeof ThemeRegistry!=='undefined') ? ThemeRegistry.getRecord(themeId) : null;
    return (rec && rec.manifest && rec.manifest.type) || 'story';
  }

  // A Theme card's preview swatch/icon — the same manifest fields
  // ThemeEngine's own Theme Library card (_renderThemeCard) already reads
  // for this exact purpose, so a new theme picks up a sensible preview
  // automatically, with no Creation-Flow-specific authoring step.
  function _themePreview(theme){
    const rec=(typeof ThemeRegistry!=='undefined') ? ThemeRegistry.getRecord(theme.id) : null;
    const manifest=(rec && rec.manifest) || {};
    return {
      image:manifest.previewImage||null,
      icon:manifest.themeIcon||'🎨',
      color:(theme.frame && theme.frame.color) || '#EFEFEF'
    };
  }

  // Representations this theme offers for this Creation Type. A
  // Representation whose own `supportedCreationTypes` is absent applies
  // under any Creation Type the theme itself supports; one that names a
  // list is filtered to it (a future theme could offer a Representation
  // valid under only one of several supported Creation Types).
  function _representationsForTheme(themeId,typeId){
    if(typeof ThemeRegistry==='undefined') return [];
    const theme=ThemeRegistry.get(themeId);
    const reps=(theme && Array.isArray(theme.representations)) ? theme.representations : [];
    return reps.filter(function(r){
      const supported=r.supportedCreationTypes;
      return !supported || !supported.length || supported.indexOf(typeId)!==-1;
    });
  }

  function _repThumbnail(r){
    const t=r.thumbnail;
    if(!t) return {text:'🎭'};
    if(/^(data:|https?:)/i.test(t) || /\.(png|jpe?g|svg|webp)$/i.test(t)) return {image:t};
    return {text:t};
  }

  // ---------- Step 1: Creation Type ----------
  function _renderTypeScreen(){
    _clear();
    _header('Step 1 of 3',null);
    content.appendChild(_el('h1','creation-flow-question','What would you like to create today?'));
    const grid=_el('div','creation-flow-grid');
    CREATION_TYPES.forEach(function(t){
      const card=_el('button','creation-flow-card');
      card.type='button';
      card.appendChild(_el('div','creation-flow-card-icon',t.icon));
      card.appendChild(_el('div','creation-flow-card-title',t.title));
      card.appendChild(_el('div','creation-flow-card-desc',t.desc));
      card.addEventListener('click',function(){ _renderThemeScreen(t); });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ---------- Step 2: Theme Selection ----------
  function _renderThemeScreen(type){
    _clear();
    _header('Step 2 of 3',_renderTypeScreen);
    content.appendChild(_el('h1','creation-flow-question','Pick a look for your '+type.title.toLowerCase()+'.'));
    const themes=_themesForType(type.id);
    if(!themes.length){ _renderComingSoon(type); return; }
    const grid=_el('div','creation-flow-grid');
    themes.forEach(function(theme){
      const card=_el('button','creation-flow-card creation-flow-theme-card');
      card.type='button';
      const preview=_el('div','creation-flow-theme-preview');
      const pv=_themePreview(theme);
      if(pv.image){
        const img=document.createElement('img');
        img.src=pv.image; img.alt='';
        preview.appendChild(img);
      }else{
        preview.style.background=pv.color;
        preview.textContent=pv.icon;
      }
      card.appendChild(preview);
      card.appendChild(_el('div','creation-flow-card-title',theme.name));
      card.appendChild(_el('div','creation-flow-card-desc',theme.description||''));
      card.addEventListener('click',function(){
        const reps=_representationsForTheme(theme.id,type.id);
        if(reps.length){ _renderRepresentationScreen(type,theme,reps); }
        else { _finish(type,theme,null); }
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  function _renderComingSoon(type){
    _clear();
    _header('Step 2 of 3',_renderTypeScreen);
    content.appendChild(_el('h1','creation-flow-question',type.title+' is coming soon!'));
    content.appendChild(_el('p','creation-flow-comingsoon-msg','We\'re still working on this one. Pick something else for now — '+type.title+' will be ready soon.'));
    const back=_el('button','creation-flow-card creation-flow-choose-other','Choose Something Else');
    back.type='button';
    back.addEventListener('click',_renderTypeScreen);
    content.appendChild(back);
  }

  // ---------- Step 3: Representation Selection ----------
  function _renderRepresentationScreen(type,theme,reps){
    _clear();
    const onBack=(_mode==='change-representation') ? _closeChangeRepresentation : function(){ _renderThemeScreen(type); };
    _header('Step 3 of 3',onBack);
    content.appendChild(_el('h1','creation-flow-question','Choose a Page Style'));
    const grid=_el('div','creation-flow-grid');
    reps.forEach(function(r){
      const card=_el('button','creation-flow-card creation-flow-representation-card');
      card.type='button';
      const thumb=_repThumbnail(r);
      if(thumb.image){
        const img=document.createElement('img');
        img.className='creation-flow-card-icon-image';
        img.src=thumb.image; img.alt='';
        card.appendChild(img);
      }else{
        card.appendChild(_el('div','creation-flow-card-icon',thumb.text));
      }
      card.appendChild(_el('div','creation-flow-card-title',r.name));
      card.appendChild(_el('div','creation-flow-card-desc',r.description||''));
      card.addEventListener('click',function(){
        if(_mode==='change-representation'){ _applyRepresentationToCurrentSlide(r); }
        else { _finish(type,theme,r); }
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ---------- Enter editor (first time only) ----------
  function _finish(type,theme,representation){
    if(typeof PageOps!=='undefined' && AppState.slides.length===0){
      PageOps.addBefore(0);
    }
    const slide=AppState.slides[AppState.currentSlide];
    AppState.project.creationType=type.id;
    AppState.project.representationId=representation?representation.id:null;
    if(slide){
      if(!slide.metadata) slide.metadata={};
      if(representation && representation.layout) slide.metadata.layout=representation.layout;
    }
    if(typeof ThemeEngine!=='undefined'){
      try{
        if(_themeType(theme.id)==='artwork') ThemeEngine.applyArtworkTheme(theme.id,{silent:true});
        else ThemeEngine.applyTheme(theme.id,{silent:true});
      }catch(e){}
    }
    try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    _closeOverlay();
    try{ if(typeof window.redrawPreview==='function') window.redrawPreview(); }catch(e){}
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.showSlide==='function') window.showSlide(AppState.currentSlide); }catch(e){}
    try{ if(typeof ContextPanel!=='undefined') ContextPanel.refresh(); }catch(e){}
  }

  // ---------- Change Representation (from the Context Panel) ----------
  // Reuses the same Step 3 screen, but only ever touches the CURRENT
  // slide's layout — never creates a page or changes the theme. Checks
  // the active Artwork Theme first (Museum Gallery's own model), then
  // the active Story Theme, so a future Story Theme that ships its own
  // Representations (e.g. Storybook Classic's eventual Cover/Story Page/
  // Ending) works without any change here.
  function currentRepresentations(){
    if(typeof ThemeEngine==='undefined' || typeof ThemeRegistry==='undefined') return null;
    const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
    if(artworkId){
      const theme=ThemeRegistry.get(artworkId);
      if(theme && Array.isArray(theme.representations) && theme.representations.length) return theme.representations;
    }
    const storyId=ThemeEngine.getActiveThemeId && ThemeEngine.getActiveThemeId();
    if(storyId){
      const theme=ThemeRegistry.get(storyId);
      if(theme && Array.isArray(theme.representations) && theme.representations.length) return theme.representations;
    }
    return null;
  }

  function changeRepresentation(){
    const reps=currentRepresentations();
    if(!reps || !reps.length) return false;
    _ensureDom();
    _mode='change-representation';
    overlay.classList.remove('hidden');
    // `type`/`theme` args are unused on this path (only _finish, which
    // change-representation mode never calls, reads them) — a
    // placeholder is enough.
    _renderRepresentationScreen({id:AppState.project.creationType||'',title:''},null,reps);
    return true;
  }

  function _applyRepresentationToCurrentSlide(r){
    const slide=AppState.slides[AppState.currentSlide];
    if(slide){
      if(!slide.metadata) slide.metadata={};
      if(r.layout) slide.metadata.layout=r.layout;
      AppState.project.representationId=r.id;
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
    _closeChangeRepresentation();
    try{ if(typeof window.redrawPreview==='function') window.redrawPreview(); }catch(e){}
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof ContextPanel!=='undefined') ContextPanel.refresh(); }catch(e){}
  }

  function _closeChangeRepresentation(){
    _mode='new';
    overlay.classList.add('hidden');
  }

  function _closeOverlay(){
    overlay.classList.add('hidden');
    document.body.classList.remove('creation-flow-active');
  }

  // ---------- Entry point (first boot / brand-new project) ----------
  function start(){
    _ensureDom();
    _mode='new';
    document.body.classList.add('creation-flow-active');
    overlay.classList.remove('hidden');
    _renderTypeScreen();
  }

  return {
    start:start,
    changeRepresentation:changeRepresentation,
    currentRepresentations:currentRepresentations
  };
})();
try{ window.CreationFlow=CreationFlow; }catch(e){}
