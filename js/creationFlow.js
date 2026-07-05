// creationFlow.js — Sprint 10.0 Creation Experience V1, made data-driven by
// Sprint 10.1 (Theme Driven Representations), given the "Story Meadow"
// arrival experience by Sprint 11.0 (Studio Arrival Experience).
//
// Two full-screen steps, shown before the editor:
//   Screen 1 — Choose What To Create (Creation Type)
//   Screen 2 — Choose a Theme + Choose your first Page Style, combined
//              on one screen per the Sprint 11.0 storyboard (picking a
//              Theme immediately refreshes the Page Style cards below
//              it; Start Creating finishes the flow).
// Only once "Start Creating" is pressed (or the chosen Theme has no
// Representations to pick from) does Studio create the first page and
// reveal the editor.
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
// Sprint 11.0 — Import Theme moves from the (now unreachable while this
// overlay is up) Theme Library modal onto Screen 2 itself, so a theme
// emailed to a fresh install can be picked up without ever detouring
// through the editor first. It reuses ThemeEngine.importThemeFile as-is
// — no Theme Engine/Registry/Builder/Compiler change of any kind.
//
// Representation selection only ever writes to existing, already-
// supported fields (slide.metadata.layout, AppState.project.artworkTheme/
// theme) — the exact same fields the Theme Designer / Card Designer
// already read and write. The Workspace itself is untouched.
const CreationFlow=(function(){
  'use strict';

  // Storyboard "Choose What To Create" cards — six tiles, wording and
  // icons transcribed from the canonical storyboard. supportedCreationTypes
  // stays theme-owned data (Sprint 10.1); a type with zero compatible
  // themes naturally falls into _renderComingSoon below with no special-
  // casing needed for 'card'/'more'.
  const CREATION_TYPES=[
    {id:'story',   title:'Tell a Story',           desc:'Build your own story page by page.',    icon:'📖'},
    {id:'artwork', title:'Showcase My Artwork',     desc:'Display your art in beautiful layouts.', icon:'🖼️'},
    {id:'quote',   title:'Create Quotes',           desc:'Design inspiring quotes.',               icon:'💬'},
    {id:'poem',    title:'Write a Poem',            desc:'Bring your words to life.',              icon:'🖋️'},
    {id:'card',    title:'Make a Greeting Card',    desc:'Create cards for special moments.',      icon:'❤️'},
    {id:'more',    title:'More Ideas',              desc:'Explore more ways to create.',           icon:'✨'}
  ];

  let overlay=null, content=null;
  let _mode='new'; // 'new' (full flow) | 'change-representation' (Page Style only, no new page)
  let _selectedThemeId=null, _selectedRepId=null;
  let _importInputEl=null;

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

  function _setAtmosphere(faded){
    if(overlay) overlay.classList.toggle('step2',!!faded);
  }

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

  function _brand(){
    const brand=_el('div','creation-flow-brand');
    brand.appendChild(_el('div','creation-flow-brand-name','✨ VihuStudio'));
    brand.appendChild(_el('div','creation-flow-brand-tagline','Your story. Your world. Your way.'));
    content.appendChild(brand);
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

  // ---------- Shared card builders ----------
  function _checkBadge(){ return _el('div','creation-flow-card-check','✓'); }

  function _themeCard(theme,selected,onClick){
    const card=_el('button','creation-flow-card creation-flow-theme-card'+(selected?' selected':''));
    card.type='button';
    if(selected) card.appendChild(_checkBadge());
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
    card.addEventListener('click',onClick);
    return card;
  }

  function _repCard(r,selected,onClick){
    const card=_el('button','creation-flow-card creation-flow-representation-card'+(selected?' selected':''));
    card.type='button';
    if(selected) card.appendChild(_checkBadge());
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
    card.addEventListener('click',onClick);
    return card;
  }

  // ---------- Screen 1: Choose What To Create ----------
  function _renderTypeScreen(){
    _clear();
    _setAtmosphere(false);
    _brand();
    _header('Step 1 of 2',null);
    content.appendChild(_el('h1','creation-flow-question','What would you like to create today?'));
    const grid=_el('div','creation-flow-grid');
    CREATION_TYPES.forEach(function(t){
      const card=_el('button','creation-flow-card');
      card.type='button';
      card.appendChild(_el('div','creation-flow-card-icon',t.icon));
      card.appendChild(_el('div','creation-flow-card-title',t.title));
      card.appendChild(_el('div','creation-flow-card-desc',t.desc));
      card.addEventListener('click',function(){
        _selectedThemeId=null; _selectedRepId=null;
        _renderThemeAndStyleScreen(t);
      });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ---------- Import Theme (Sprint 11.0 — moved onto Screen 2) ----------
  // A dedicated hidden input, independent of the Theme Library modal's own
  // #importThemeInput (which lives inside the now-unreachable-from-here
  // #app sidebar). Reuses ThemeEngine.importThemeFile as-is — validation,
  // duplicate-id conflict prompt and persistence are all unchanged.
  function _importInput(){
    if(_importInputEl) return _importInputEl;
    _importInputEl=document.createElement('input');
    _importInputEl.type='file';
    _importInputEl.accept='.vtheme,application/json';
    _importInputEl.hidden=true;
    document.body.appendChild(_importInputEl);
    return _importInputEl;
  }

  function _wireImportButton(btn,type){
    btn.addEventListener('click',function(){
      const input=_importInput();
      input.onchange=function(e){
        const file=e.target.files && e.target.files[0];
        input.value='';
        if(!file || typeof ThemeEngine==='undefined' || typeof ThemeEngine.importThemeFile!=='function') return;
        const before={};
        _allThemes().forEach(function(t){ before[t.id]=true; });
        ThemeEngine.importThemeFile(file).then(function(){
          const added=_allThemes().find(function(t){ return !before[t.id]; });
          if(added){ _selectedThemeId=added.id; _selectedRepId=null; }
          _renderThemeAndStyleScreen(type);
        });
      };
      input.click();
    });
  }

  // ---------- Screen 2: Choose a Theme + Choose your first Page Style ----------
  // Combined per the Sprint 11.0 storyboard: Theme cards on top, Page
  // Style (Representation) cards beneath refreshing live as the Theme
  // selection changes, Import Theme top-right, Start Creating bottom-
  // right. Replaces the old two-step Theme->Representation wizard.
  function _renderThemeAndStyleScreen(type){
    _clear();
    _setAtmosphere(true);
    _header('Step 2 of 2',_renderTypeScreen);

    const themes=_themesForType(type.id);
    if(!themes.length){ _renderComingSoon(type); return; }
    if(!_selectedThemeId || !themes.some(function(t){ return t.id===_selectedThemeId; })){
      _selectedThemeId=themes[0].id;
    }

    const titleRow=_el('div','creation-flow-title-row');
    const titleCol=_el('div');
    titleCol.appendChild(_el('h1','creation-flow-question','Choose a Theme'));
    titleCol.appendChild(_el('p','creation-flow-subtitle','Pick a world and page style to start'));
    titleRow.appendChild(titleCol);
    const importBtn=_el('button','creation-flow-import-btn','⤴ Import Theme');
    importBtn.type='button';
    _wireImportButton(importBtn,type);
    titleRow.appendChild(importBtn);
    content.appendChild(titleRow);

    const themeGrid=_el('div','creation-flow-grid creation-flow-theme-grid');
    content.appendChild(themeGrid);
    const styleSection=_el('div','creation-flow-style-section');
    content.appendChild(styleSection);
    const footer=_el('div','creation-flow-footer');
    const startBtn=_el('button','creation-flow-start-btn','Start Creating  →');
    startBtn.type='button';
    footer.appendChild(startBtn);
    content.appendChild(footer);

    function paintThemes(){
      themeGrid.innerHTML='';
      themes.forEach(function(theme){
        themeGrid.appendChild(_themeCard(theme,theme.id===_selectedThemeId,function(){
          if(_selectedThemeId===theme.id) return;
          _selectedThemeId=theme.id;
          _selectedRepId=null;
          paintThemes();
          paintStyles();
        }));
      });
    }

    function paintStyles(){
      styleSection.innerHTML='';
      const theme=themes.find(function(t){ return t.id===_selectedThemeId; });
      const reps=theme ? _representationsForTheme(theme.id,type.id) : [];
      if(!reps.length){ _selectedRepId=null; return; }
      if(!_selectedRepId || !reps.some(function(r){ return r.id===_selectedRepId; })){
        _selectedRepId=reps[0].id;
      }
      styleSection.appendChild(_el('h2','creation-flow-subheading','Choose your first Page Style'));
      const grid=_el('div','creation-flow-grid creation-flow-style-grid');
      reps.forEach(function(r){
        grid.appendChild(_repCard(r,r.id===_selectedRepId,function(){
          _selectedRepId=r.id;
          paintStyles();
        }));
      });
      styleSection.appendChild(grid);
    }

    startBtn.addEventListener('click',function(){
      const theme=themes.find(function(t){ return t.id===_selectedThemeId; });
      if(!theme) return;
      const reps=_representationsForTheme(theme.id,type.id);
      const rep=reps.find(function(r){ return r.id===_selectedRepId; })||null;
      _finish(type,theme,rep);
    });

    paintThemes();
    paintStyles();
  }

  // ---------- Change Representation screen (Context Panel shortcut) ----------
  // Deliberately NOT the combined Screen 2 above: the active Theme is
  // already fixed (set from the editor), so only the Page Style
  // (Representation) grid is shown — no Theme grid, no Import Theme. This
  // preserves the exact Sprint 10.1 "Change Representation" behavior;
  // Sprint 11.0 only restyled Screen 1/2 of the new-project flow.
  function _renderChangeRepresentationScreen(reps){
    _clear();
    _setAtmosphere(true);
    _header('Choose your Page Style',_closeChangeRepresentation);
    content.appendChild(_el('h1','creation-flow-question','Choose a Page Style'));
    const grid=_el('div','creation-flow-grid');
    reps.forEach(function(r){
      grid.appendChild(_repCard(r,false,function(){ _applyRepresentationToCurrentSlide(r); }));
    });
    content.appendChild(grid);
  }

  // No theme currently supports this Creation Type. Import Theme still
  // appears here (it's the empty state of Screen 2, not a new screen) so
  // a theme emailed for exactly this Creation Type isn't blocked behind
  // first completing the flow with something else.
  function _renderComingSoon(type){
    _clear();
    _setAtmosphere(true);
    _header('Step 2 of 2',_renderTypeScreen);
    const titleRow=_el('div','creation-flow-title-row');
    titleRow.appendChild(_el('h1','creation-flow-question',type.title+' is coming soon!'));
    const importBtn=_el('button','creation-flow-import-btn','⤴ Import Theme');
    importBtn.type='button';
    _wireImportButton(importBtn,type);
    titleRow.appendChild(importBtn);
    content.appendChild(titleRow);
    content.appendChild(_el('p','creation-flow-comingsoon-msg','We\'re still working on this one. Pick something else for now, or import a theme that supports it — '+type.title+' will be ready soon.'));
    const back=_el('button','creation-flow-card creation-flow-choose-other','Choose Something Else');
    back.type='button';
    back.addEventListener('click',_renderTypeScreen);
    content.appendChild(back);
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
  // Reuses the Screen 2 Page Style grid, but skips the Theme grid and
  // Import Theme control entirely, and only ever touches the CURRENT
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
    _renderChangeRepresentationScreen(reps);
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
    _selectedThemeId=null; _selectedRepId=null;
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
