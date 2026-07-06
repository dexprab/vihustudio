// creationFlow.js — Sprint 10.0 Creation Experience V1, made data-driven by
// Sprint 10.1 (Theme Driven Representations), given the "Story Meadow"
// arrival experience and master/detail Screen 2 by Sprint 11.0 (Studio
// Arrival Experience). Canonical product documents:
//   docs/STUDIO_DESIGN_CANON.md
//   docs/STUDIO_CREATION_JOURNEY_V1.md
//   docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md
// This file implements those documents; it does not redefine them —
// see the docs for the product rationale behind the structure below.
//
// Two full-screen steps, shown before the editor:
//   Screen 1 — Choose What To Create (Creation Type)
//   Screen 2 — Choose Your Creative World: a two-column master/detail
//              layout — LEFT is World Sources only (a Vihu Worlds row +
//              a World Library row, each horizontally scrolling, inside
//              one sources panel); RIGHT is the single Selected World
//              Preview, which holds the Page Style picker and Start
//              Creating. Only one World is selected at a time,
//              regardless of which row/source it came from, and there
//              is exactly one Preview/Page-Style picker on the screen.
// Only once "Start Creating" is pressed (or the chosen World has no
// Representations to pick from) does Studio create the first page and
// reveal the editor.
//
// Sprint 10.1 — Studio knows nothing about Museum Gallery, Storybook
// Classic, or any other theme by name. Creation Types themselves stay a
// small hardcoded list (CREATION_TYPES — an explicit sprint scope
// decision), but which Theme is offered under which Creation Type, and
// which Representation cards a Theme offers, are both read live from
// ThemeRegistry: `theme.supportedCreationTypes` and `theme.representations`.
//
// Sprint 11.0 — Import Theme moves from the (now unreachable while this
// overlay is up) Theme Library modal onto Screen 2 itself — both as a
// header-level "Add New World" button and as the World Library row's
// own "Add New World" card (same action, two affordances, matching the
// storyboard) — so a theme emailed to a fresh install can be picked up
// without ever detouring through the editor first. It reuses
// ThemeEngine.importThemeFile as-is — no Theme Engine/Registry/Builder/
// Compiler change of any kind. A Creation Type with zero compatible
// themes is never a dead end: Vihu Worlds is simply omitted and World
// Library's Add New World card is always present (see the IA doc's
// "Empty state" section) — there is no separate "Coming Soon" screen.
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
  // themes simply renders an empty Vihu Worlds row and an Add New World
  // card with no special-casing needed for 'card'/'more'.
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
    brand.appendChild(_el('div','creation-flow-brand-name','✨ VihuStudio ✨'));
    brand.appendChild(_el('div','creation-flow-brand-tagline','Your story. Your world. Your way.'));
    brand.appendChild(_el('div','creation-flow-brand-divider','»»»»» ♥ «««««'));
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

  // Vihu Worlds (official) vs World Library (imported) — the IA doc's
  // two World Sources. Same ThemeRegistry record every other theme
  // lookup already reads; no new registry concept.
  function _themeSource(themeId){
    const rec=(typeof ThemeRegistry!=='undefined') ? ThemeRegistry.getRecord(themeId) : null;
    return (rec && rec.source) || 'official';
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

  // A compact card for the Vihu Worlds / World Library rows — icon/image
  // + name only. Description lives in the Selected World Preview (§5 of
  // the IA doc), never duplicated here.
  function _worldRowCard(theme,selected,onClick){
    const card=_el('button','creation-flow-world-card'+(selected?' selected':''));
    card.type='button';
    if(selected) card.appendChild(_checkBadge());
    const preview=_el('div','creation-flow-world-thumb');
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
    card.appendChild(_el('div','creation-flow-world-name',theme.name));
    card.addEventListener('click',onClick);
    return card;
  }

  // Last card in the World Library row — same size as a World card, so
  // it reads as "one more world source" rather than a toolbar button.
  // Its click handler is wired externally via _wireImportButton.
  function _addWorldCard(){
    const card=_el('button','creation-flow-world-card creation-flow-add-world-card');
    card.type='button';
    const preview=_el('div','creation-flow-world-thumb creation-flow-add-world-thumb','+');
    card.appendChild(preview);
    card.appendChild(_el('div','creation-flow-world-name','Add New World'));
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
  // Fixed 4-column grid (4+2 wrap for six cards) per the storyboard —
  // not an auto-fill grid, which would space unevenly at this card count.
  function _renderTypeScreen(){
    _clear();
    _setAtmosphere(false);
    _brand();
    _header('Step 1 of 2',null);
    content.appendChild(_el('h1','creation-flow-question','What would you like to create today?'));
    content.appendChild(_el('p','creation-flow-subtitle','Choose how your creative adventure begins.'));
    const grid=_el('div','creation-flow-grid creation-flow-type-grid');
    CREATION_TYPES.forEach(function(t){
      const card=_el('button','creation-flow-card');
      card.type='button';
      card.appendChild(_el('div','creation-flow-card-icon',t.icon));
      card.appendChild(_el('div','creation-flow-card-title',t.title));
      card.appendChild(_el('div','creation-flow-card-desc',t.desc));
      card.addEventListener('click',function(){
        _selectedThemeId=null; _selectedRepId=null;
        _renderWorldScreen(t);
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

  function _wireImportButton(el,onImported){
    el.addEventListener('click',function(){
      const input=_importInput();
      input.onchange=function(e){
        const file=e.target.files && e.target.files[0];
        input.value='';
        if(!file || typeof ThemeEngine==='undefined' || typeof ThemeEngine.importThemeFile!=='function') return;
        const before={};
        _allThemes().forEach(function(t){ before[t.id]=true; });
        ThemeEngine.importThemeFile(file).then(function(){
          const added=_allThemes().find(function(t){ return !before[t.id]; });
          onImported(added||null);
        });
      };
      input.click();
    });
  }

  // A small circular chevron beside a horizontally-scrolling row —
  // purely a convenience affordance; the row already scrolls by drag/
  // wheel/touch on its own.
  function _scrollButton(rowEl){
    const btn=_el('button','creation-flow-scroll-btn','›');
    btn.type='button';
    btn.addEventListener('click',function(){ rowEl.scrollBy({left:220,behavior:'smooth'}); });
    return btn;
  }

  function _sourceGroup(headingText,subText,rowEl){
    const group=_el('div','creation-flow-source-group');
    group.appendChild(_el('h2','creation-flow-source-heading',headingText));
    group.appendChild(_el('p','creation-flow-source-sub',subText));
    const wrap=_el('div','creation-flow-world-row-wrap');
    wrap.appendChild(rowEl);
    wrap.appendChild(_scrollButton(rowEl));
    group.appendChild(wrap);
    return group;
  }

  // ---------- Screen 2: Choose Your Creative World ----------
  // Two-column master/detail per docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md
  // and the canonical storyboard: LEFT is World Sources ONLY (Vihu
  // Worlds row + World Library row, each horizontally scrolling, inside
  // one sources panel); RIGHT is the single Selected World Preview
  // (hero art, name, description, "Begin With" Page Style cards, Start
  // Creating) — the one detail component every World, regardless of
  // source, is read about and acted on through. Only one World is
  // selected at a time; selecting a different card repaints the
  // Preview only, never spawns a second picker.
  function _renderWorldScreen(type){
    _clear();
    _setAtmosphere(true);

    const topRow=_el('div','creation-flow-header');
    const back=_el('button','creation-flow-back','← Back');
    back.type='button';
    back.addEventListener('click',_renderTypeScreen);
    topRow.appendChild(back);
    const headerAddBtn=_el('button','creation-flow-add-world-header-btn','⊕ Add New World');
    headerAddBtn.type='button';
    topRow.appendChild(headerAddBtn);
    content.appendChild(topRow);

    content.appendChild(_el('h1','creation-flow-question','🌿 Choose Your Creative World 🌿'));
    content.appendChild(_el('p','creation-flow-subtitle','Pick a world you love and choose how you want to begin.'));

    const themes=_themesForType(type.id);
    const officialThemes=themes.filter(function(t){ return _themeSource(t.id)==='official'; });
    const importedThemes=themes.filter(function(t){ return _themeSource(t.id)==='imported'; });
    const selectable=officialThemes.concat(importedThemes);
    if(!_selectedThemeId || !selectable.some(function(t){ return t.id===_selectedThemeId; })){
      _selectedThemeId=selectable.length ? selectable[0].id : null;
    }

    const layout=_el('div','creation-flow-worldscreen');
    content.appendChild(layout);

    const sourcesPanel=_el('div','creation-flow-sources-panel');
    layout.appendChild(sourcesPanel);

    let officialRow=null;
    if(officialThemes.length){
      officialRow=_el('div','creation-flow-world-row');
      sourcesPanel.appendChild(_sourceGroup('⭐ Vihu Worlds','Creative worlds built by VihuStudio',officialRow));
    }
    const importedRow=_el('div','creation-flow-world-row');
    sourcesPanel.appendChild(_sourceGroup('📖 World Library','All kinds of worlds from anywhere',importedRow));

    const preview=_el('div','creation-flow-preview');
    layout.appendChild(preview);

    function selectWorld(themeId){
      if(_selectedThemeId===themeId) return;
      _selectedThemeId=themeId;
      _selectedRepId=null;
      paintRows();
      paintPreview();
    }

    function onImported(added){
      if(added){ _selectedThemeId=added.id; _selectedRepId=null; }
      _renderWorldScreen(type);
    }
    _wireImportButton(headerAddBtn,onImported);

    function paintRows(){
      if(officialRow){
        officialRow.innerHTML='';
        officialThemes.forEach(function(theme){
          officialRow.appendChild(_worldRowCard(theme,theme.id===_selectedThemeId,function(){ selectWorld(theme.id); }));
        });
      }
      importedRow.innerHTML='';
      importedThemes.forEach(function(theme){
        importedRow.appendChild(_worldRowCard(theme,theme.id===_selectedThemeId,function(){ selectWorld(theme.id); }));
      });
      const addCard=_addWorldCard();
      _wireImportButton(addCard,onImported);
      importedRow.appendChild(addCard);
    }

    function paintPreview(){
      preview.innerHTML='';
      const theme=selectable.find(function(t){ return t.id===_selectedThemeId; });
      if(!theme){
        preview.appendChild(_el('p','creation-flow-preview-empty','Add a world from World Library to get started.'));
        return;
      }
      const pv=_themePreview(theme);
      const hero=_el('div','creation-flow-preview-hero');
      if(pv.image){
        const img=document.createElement('img');
        img.src=pv.image; img.alt='';
        hero.appendChild(img);
      }else{
        hero.style.background=pv.color;
        hero.textContent=pv.icon;
      }
      preview.appendChild(hero);

      const body=_el('div','creation-flow-preview-body');
      body.appendChild(_el('h2','creation-flow-preview-name',pv.icon+' '+theme.name));
      body.appendChild(_el('p','creation-flow-preview-desc',theme.description||''));

      const reps=_representationsForTheme(theme.id,type.id);
      if(reps.length){
        if(!_selectedRepId || !reps.some(function(r){ return r.id===_selectedRepId; })){
          _selectedRepId=reps[0].id;
        }
        body.appendChild(_el('div','creation-flow-preview-divider','🌿 ───── 🌿'));
        body.appendChild(_el('h3','creation-flow-subheading','🌿 Begin With 🌿'));
        const grid=_el('div','creation-flow-grid creation-flow-style-grid');
        reps.forEach(function(r){
          grid.appendChild(_repCard(r,r.id===_selectedRepId,function(){
            _selectedRepId=r.id;
            paintPreview();
          }));
        });
        body.appendChild(grid);
      }else{
        _selectedRepId=null;
      }

      const footer=_el('div','creation-flow-footer');
      const startBtn=_el('button','creation-flow-start-btn','Start Creating  →');
      startBtn.type='button';
      startBtn.addEventListener('click',function(){
        const reps2=_representationsForTheme(theme.id,type.id);
        const rep=reps2.find(function(r){ return r.id===_selectedRepId; })||null;
        _finish(type,theme,rep);
      });
      footer.appendChild(startBtn);
      body.appendChild(footer);

      preview.appendChild(body);
    }

    paintRows();
    paintPreview();
  }

  // ---------- Change Representation screen (Context Panel shortcut) ----------
  // Deliberately NOT the master/detail Screen 2 above: the active World
  // is already fixed (set from the editor), so only the Page Style
  // (Representation) grid is shown — no World rows, no Import Theme.
  // This preserves the exact Sprint 10.1 "Change Representation"
  // behavior; Sprint 11.0 only restyled Screens 1/2 of the new-project
  // flow.
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
