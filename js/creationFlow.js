// creationFlow.js — Sprint 10.0 Creation Experience V1 (Child First Studio).
//
// A full-screen, three-step wizard shown before the editor: Creation Type
// -> Theme -> Representation. Only once a Representation is chosen (or the
// chosen Theme has none) does Studio create the first page and reveal the
// editor. Hardcoded data throughout, per the sprint's own scope — no
// runtime/compiler/registry changes. Representation selection only ever
// writes to existing, already-supported fields (slide.metadata.layout,
// AppState.project.artworkTheme/theme) — the exact same fields the Theme
// Designer / Card Designer already read and write.
const CreationFlow=(function(){
  'use strict';

  const CREATION_TYPES=[
    {id:'story',   title:'Story',            desc:'Tell a story, page by page.',        icon:'📖'},
    {id:'artwork', title:'Artwork Showcase',  desc:'Show off a picture you made.',       icon:'🖼️'},
    {id:'quote',   title:'Quote Design',      desc:'Turn your favorite words into art.', icon:'💬'},
    {id:'poem',    title:'Poems',             desc:'Share a poem you wrote.',            icon:'📝'}
  ];

  // Hardcoded per-type theme compatibility (sprint scope: only Story and
  // Artwork Showcase have a real, working theme this sprint).
  const THEMES_BY_TYPE={
    story:[
      {themeId:'storybook-classic', kind:'story', name:'Storybook Classic', desc:'A warm, classic storybook look.', swatch:'#1D3457', icon:'📖', real:true}
    ],
    artwork:[
      {themeId:'museum-gallery', kind:'artwork', name:'Museum Gallery', desc:'Showcase artwork the way a museum would.', swatch:'#F7F4EE', icon:'🖼️', real:true}
    ],
    quote:[
      {themeId:null, kind:null, name:'Quote Theme', desc:'A beautiful home for your favorite words.', swatch:'#EFEFEF', icon:'💬', real:false}
    ],
    poem:[
      {themeId:null, kind:null, name:'Poetry Theme', desc:'A gentle page for your poems.', swatch:'#EFEFEF', icon:'📝', real:false}
    ]
  };

  // Hardcoded Representations, per theme. A theme absent from this map
  // (Storybook Classic) skips Step 3 entirely and goes straight to the
  // editor — it has no Representation concept this sprint.
  const REPRESENTATIONS_BY_THEME={
    'museum-gallery':[
      {id:'showcase', name:'Showcase', desc:'Big and bold — the classic gallery look.',        layout:'landscape', icon:'🖼️'},
      {id:'portrait', name:'Portrait', desc:'Tall and centered, like a framed portrait.',       layout:'portrait',  icon:'🧍'},
      {id:'quote',    name:'Quote',    desc:'Just your words, beautifully centered.',           layout:'quote',     icon:'💬'}
    ]
  };

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
    const grid=_el('div','creation-flow-grid');
    (THEMES_BY_TYPE[type.id]||[]).forEach(function(th){
      const card=_el('button','creation-flow-card creation-flow-theme-card');
      card.type='button';
      const preview=_el('div','creation-flow-theme-preview');
      preview.style.background=th.swatch;
      preview.textContent=th.icon;
      card.appendChild(preview);
      card.appendChild(_el('div','creation-flow-card-title',th.name));
      card.appendChild(_el('div','creation-flow-card-desc',th.desc));
      if(!th.real) card.appendChild(_el('div','creation-flow-badge','Coming Soon'));
      card.addEventListener('click',function(){
        if(!th.real){ _renderComingSoon(type,th); return; }
        const reps=REPRESENTATIONS_BY_THEME[th.themeId];
        if(reps && reps.length){ _renderRepresentationScreen(type,th,reps); }
        else { _finish(type,th,null); }
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  function _renderComingSoon(type,th){
    _clear();
    _header('Step 2 of 3',function(){ _renderThemeScreen(type); });
    content.appendChild(_el('h1','creation-flow-question',th.name+' is coming soon!'));
    content.appendChild(_el('p','creation-flow-comingsoon-msg','We\'re still working on this one. Pick something else for now — '+th.name+' will be ready soon.'));
    const back=_el('button','creation-flow-card creation-flow-choose-other','Choose Something Else');
    back.type='button';
    back.addEventListener('click',_renderTypeScreen);
    content.appendChild(back);
  }

  // ---------- Step 3: Representation Selection ----------
  function _renderRepresentationScreen(type,th,reps){
    _clear();
    const onBack=(_mode==='change-representation') ? _closeChangeRepresentation : function(){ _renderThemeScreen(type); };
    _header('Step 3 of 3',onBack);
    content.appendChild(_el('h1','creation-flow-question','Choose a Page Style'));
    const grid=_el('div','creation-flow-grid');
    reps.forEach(function(r){
      const card=_el('button','creation-flow-card creation-flow-representation-card');
      card.type='button';
      card.appendChild(_el('div','creation-flow-card-icon',r.icon));
      card.appendChild(_el('div','creation-flow-card-title',r.name));
      card.appendChild(_el('div','creation-flow-card-desc',r.desc));
      card.addEventListener('click',function(){
        if(_mode==='change-representation'){ _applyRepresentationToCurrentSlide(r); }
        else { _finish(type,th,r); }
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ---------- Enter editor (first time only) ----------
  function _finish(type,th,representation){
    if(typeof PageOps!=='undefined' && AppState.slides.length===0){
      PageOps.addBefore(0);
    }
    const slide=AppState.slides[AppState.currentSlide];
    AppState.project.creationType=type.id;
    AppState.project.representationId=representation?representation.id:null;
    if(slide){
      if(!slide.metadata) slide.metadata={};
      if(representation) slide.metadata.layout=representation.layout;
    }
    if(th.kind==='artwork' && typeof ThemeEngine!=='undefined'){
      try{ ThemeEngine.applyArtworkTheme(th.themeId,{silent:true}); }catch(e){}
    }else if(th.kind==='story' && typeof ThemeEngine!=='undefined'){
      try{ ThemeEngine.applyTheme(th.themeId,{silent:true}); }catch(e){}
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
  // slide's layout — never creates a page or changes the theme.
  function currentRepresentations(){
    const artworkId=(typeof ThemeEngine!=='undefined' && ThemeEngine.getActiveArtworkThemeId) ? ThemeEngine.getActiveArtworkThemeId() : null;
    return artworkId ? (REPRESENTATIONS_BY_THEME[artworkId]||null) : null;
  }

  function changeRepresentation(){
    const reps=currentRepresentations();
    if(!reps || !reps.length) return false;
    _ensureDom();
    _mode='change-representation';
    overlay.classList.remove('hidden');
    _renderRepresentationScreen({id:'artwork',title:'Artwork Showcase'},{themeId:'museum-gallery',kind:'artwork'},reps);
    return true;
  }

  function _applyRepresentationToCurrentSlide(r){
    const slide=AppState.slides[AppState.currentSlide];
    if(slide){
      if(!slide.metadata) slide.metadata={};
      slide.metadata.layout=r.layout;
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
