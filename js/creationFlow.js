// creationFlow.js — Sprint 10.0 Creation Experience V1, made data-driven by
// Sprint 10.1 (Theme Driven Representations), given the "Story Meadow"
// arrival experience and master/detail Screen 2 by Sprint 11.0 (Studio
// Arrival Experience), given a swipeable layout-carousel Preview by
// Sprint 11.1 (World Selection & Preview Experience), and made strictly
// package-driven by Sprint 11.2 (Official World Platform — Museum
// Gallery is the reference implementation; there are no privileged code
// paths, no hardcoded Worlds/layouts/representations, and no synthetic
// fallback data of any kind — see docs/WORLD_ASSET_CONTRACT.md). Canonical
// product documents:
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
//              one sources panel); RIGHT is the single Preview, a
//              horizontally scrollable carousel of every layout the
//              selected World offers, with Start Creating inside it.
//              Only one World is selected at a time, regardless of
//              which row/source it came from, and there is exactly one
//              Preview on the screen.
// Sprint 11.1 — the Preview IS the layout selector: whichever slide is
// currently scrolled into view is the current selection. There is no
// separate click-to-select grid, no checkmarks, no "Begin With" step,
// and no other selection state — Start Creating always acts on
// whichever layout is currently visible in the Preview.
// Only once "Start Creating" is pressed does Studio create the first
// page and reveal the editor. A World with no Representations (a
// pre-existing, legacy gap — never fabricated by Studio) shows no
// carousel at all; Start Creating still works, with no layout override.
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

  // WEP Scope Freeze — Import Deferred. A deliberate product decision,
  // not a technical limitation: the WEP proves one complete authoring
  // workflow (Builder Project -> Build -> Publish to Personal Repository
  // -> Promote to Official Repository -> Studio Consumption) before any
  // additional entry point is introduced. Import is not removed — every
  // function below it (_importInput/_wireImportButton/ThemeEngine.
  // importThemeFile) is untouched and fully working — it is only no
  // longer reachable from Screen 2's UI while this flag is false. Future
  // milestone: re-enable for .vtheme sharing / Marketplace / Community
  // exchange / local repository sync / backup-restore (see
  // docs/THEME_REPOSITORY_ARCHITECTURE.md's WEP Scope section).
  const IMPORT_ENABLED=false;

  // Storyboard "Choose What To Create" cards — six tiles, wording and
  // icons transcribed from the canonical storyboard. supportedCreationTypes
  // stays theme-owned data (Sprint 10.1); a type with zero compatible
  // themes simply renders an empty Vihu Worlds row and an Add New World
  // card with no special-casing needed for 'card'/'more'.
  const CREATION_TYPES=[
    {id:'story',   title:'Tell a Story',           desc:'Build your own story page by page.',    icon:'📖', accent:'sand'},
    {id:'artwork', title:'Showcase My Artwork',     desc:'Display your art in beautiful layouts.', icon:'🖼️', accent:'amber'},
    {id:'quote',   title:'Create Quotes',           desc:'Design inspiring quotes.',               icon:'💬', accent:'sky'},
    {id:'poem',    title:'Write a Poem',            desc:'Bring your words to life.',              icon:'🖋️', accent:'sand'},
    {id:'card',    title:'Make a Greeting Card',    desc:'Create cards for special moments.',      icon:'❤️', accent:'rose'},
    {id:'more',    title:'More Ideas',              desc:'Explore more ways to create.',           icon:'✨', accent:'lilac'}
  ];

  let overlay=null, content=null;
  let _mode='new'; // 'new' (full flow) | 'change-representation' (Page Style only, no new page)
  let _selectedThemeId=null;
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
    // Asset Repository Transition — manifest.previewImage may be a bare
    // relative-path reference (builder.js/_buildPackageFromZipFiles no
    // longer embed it directly) rather than a ready data:/http(s) src;
    // resolveAssetRef resolves it through this theme's own assets map
    // either way (local-import data URI or a repository's signed URL),
    // unchanged for the legacy already-embedded case.
    const previewImage=(typeof ThemeRegistry!=='undefined' && ThemeRegistry.resolveAssetRef)
      ? ThemeRegistry.resolveAssetRef(theme.id,manifest.previewImage)
      : manifest.previewImage;
    return {
      image:previewImage||null,
      icon:manifest.themeIcon||'🎨',
      color:(theme.frame && theme.frame.color) || '#EFEFEF',
      description:theme.description||manifest.description||manifest.purpose||''
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

  // Platform Hardening Sprint — a Representation's `thumbnail` may be a
  // path relative to its own theme's `assets/` folder (docs/
  // THEME_PROJECT_SPEC.md §8/§9: "the code consuming that field is
  // responsible for the map lookup"), not only a bare data:/http(s) URI
  // or an emoji. `themeId` lets this resolve that path through
  // ThemeRegistry.getAsset() before falling back to using it directly —
  // an emoji or an already-absolute URI is returned unchanged either way.
  //
  // A Representation with no `thumbnail` of its own used to fall back to
  // a hardcoded generic 🎭 mask — the same glyph for every World's every
  // Representation, regardless of what that World actually is. Real
  // authoring surfaced this as "no real visual" — fixed by falling back
  // to the World's own preview image/icon (_themePreview, the exact
  // fields ThemeEngine's Theme Library card already reads) instead of an
  // unrelated invented glyph. Only when the World itself has neither an
  // image nor a themeIcon does this fall back to a plain, generic 🎨.
  function _repThumbnail(r,themeId){
    const t=r.thumbnail;
    if(t){
      if(/^(data:|https?:)/i.test(t)) return {image:t};
      if(/\.(png|jpe?g|svg|webp)$/i.test(t)){
        const resolved=(themeId && typeof ThemeRegistry!=='undefined' && ThemeRegistry.resolveAssetRef)
          ? ThemeRegistry.resolveAssetRef(themeId,t)
          : t;
        return {image:resolved};
      }
      return {text:t};
    }
    const theme=(themeId && typeof ThemeRegistry!=='undefined') ? ThemeRegistry.get(themeId) : null;
    if(theme){
      const pv=_themePreview(theme);
      if(pv.image) return {image:pv.image};
      return {text:pv.icon};
    }
    return {text:'🎨'};
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

  // A large carousel slide for the Screen 2 Preview (Sprint 11.1) — one
  // per layout the selected World offers. Deliberately a separate
  // builder from _repCard: _repCard stays exactly as it was for the
  // Context Panel's "Change Representation" shortcut (out of this
  // sprint's scope), while the carousel slide has no click handler and
  // no selected/checkmark state of its own — the Preview's scroll
  // position is the only selection mechanism (see paintPreview).
  function _carouselSlide(r,themeId){
    const slide=_el('div','creation-flow-carousel-slide');
    const art=_el('div','creation-flow-carousel-art');
    const thumb=_repThumbnail(r,themeId);
    if(thumb.image){
      const img=document.createElement('img');
      img.src=thumb.image; img.alt='';
      art.appendChild(img);
    }else{
      art.textContent=thumb.text;
    }
    slide.appendChild(art);
    slide.appendChild(_el('div','creation-flow-carousel-name',r.name));
    if(r.description) slide.appendChild(_el('div','creation-flow-carousel-desc',r.description));
    return slide;
  }

  function _repCard(r,selected,onClick,themeId){
    const card=_el('button','creation-flow-card creation-flow-representation-card'+(selected?' selected':''));
    card.type='button';
    if(selected) card.appendChild(_checkBadge());
    const thumb=_repThumbnail(r,themeId);
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
    const header=_el('div','creation-flow-header');
    header.appendChild(_el('span','creation-flow-step','Step 1 of 2'));
    const help=_el('button','creation-flow-help','?');
    help.type='button';
    help.title='Every idea has a world. Pick one to begin.';
    header.appendChild(help);
    content.appendChild(header);
    content.appendChild(_el('h1','creation-flow-question','What shall we create today?'));
    content.appendChild(_el('p','creation-flow-subtitle','Every idea has a world.'));
    const grid=_el('div','creation-flow-grid creation-flow-type-grid');
    CREATION_TYPES.forEach(function(t){
      const card=_el('button','creation-flow-card creation-flow-card-accent-'+(t.accent||'sand'));
      card.type='button';
      card.appendChild(_el('div','creation-flow-card-icon',t.icon));
      card.appendChild(_el('div','creation-flow-card-title',t.title));
      card.appendChild(_el('div','creation-flow-card-desc',t.desc));
      card.addEventListener('click',function(){
        _selectedThemeId=null;
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
  // one sources panel); RIGHT is the single Preview — a swipeable
  // carousel of every layout the selected World offers, Start Creating
  // living inside it (Sprint 11.1). Only one World is selected at a
  // time; selecting a different card repaints the Preview only, never
  // spawns a second picker.
  function _renderWorldScreen(type){
    _clear();
    _setAtmosphere(true);

    const topRow=_el('div','creation-flow-header');
    const back=_el('button','creation-flow-back','← Back');
    back.type='button';
    back.addEventListener('click',_renderTypeScreen);
    topRow.appendChild(back);
    const headerAddBtn=IMPORT_ENABLED ? _el('button','creation-flow-add-world-header-btn','⊕ Add New World') : null;
    if(headerAddBtn){
      headerAddBtn.type='button';
      topRow.appendChild(headerAddBtn);
    }
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
    sourcesPanel.appendChild(_sourceGroup('📚 World Library','All kinds of worlds from anywhere',importedRow));

    const preview=_el('div','creation-flow-preview');
    layout.appendChild(preview);

    function selectWorld(themeId){
      if(_selectedThemeId===themeId) return;
      _selectedThemeId=themeId;
      paintRows();
      paintPreview();
    }

    function onImported(added){
      if(added){ _selectedThemeId=added.id; }
      _renderWorldScreen(type);
    }
    if(IMPORT_ENABLED) _wireImportButton(headerAddBtn,onImported);

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
      if(IMPORT_ENABLED){
        const addCard=_addWorldCard();
        _wireImportButton(addCard,onImported);
        importedRow.appendChild(addCard);
      }else if(!importedThemes.length){
        // WEP Scope Freeze — with Import hidden, an empty World Library
        // row would otherwise be a dead end; Worlds arrive here only by
        // being Published/Promoted from World Builder in the WEP flow,
        // so say that honestly instead of showing a blank row.
        importedRow.appendChild(_el('p','creation-flow-preview-empty','No worlds published yet — publish one from World Builder to see it here.'));
      }
    }

    // Sprint 11.1 — the Preview IS the layout selector: a horizontally
    // scrollable carousel of every layout the selected World offers
    // (theme.representations — the already-authored, user-facing
    // wrapper around theme.layouts; see docs/THEME_PROJECT_SPEC.md §8).
    // Whichever slide is currently scrolled into view is the current
    // selection — no click-to-select grid, no checkmarks, no separate
    // "Begin With" step.
    //
    // Sprint 11.2 (Official World Platform) — the carousel renders ONLY
    // what the selected World's package declares. No synthetic
    // representation is fabricated for a World with none: the World
    // Contract requires every Official World to declare at least one
    // (see docs/WORLD_ASSET_CONTRACT.md), and Studio never compensates
    // for an incomplete package by inventing data it never shipped. A
    // World with zero Representations (a pre-existing, legacy gap —
    // Storybook Classic has never had any) simply shows no carousel and
    // an honest message; Start Creating still works, creating the page
    // with no layout override, exactly as it always has for a theme
    // with nothing to override.
    function paintPreview(){
      preview.innerHTML='';
      const theme=selectable.find(function(t){ return t.id===_selectedThemeId; });
      if(!theme){
        preview.appendChild(_el('p','creation-flow-preview-empty','Add a world from World Library to get started.'));
        return;
      }
      const pv=_themePreview(theme);
      const heroBadge=_el('div','creation-flow-preview-badge',pv.icon);
      preview.appendChild(heroBadge);
      preview.appendChild(_el('div','creation-flow-preview-heading',theme.name));
      if(pv.description) preview.appendChild(_el('p','creation-flow-preview-desc',pv.description));

      const reps=_representationsForTheme(theme.id,type.id);

      const footer=_el('div','creation-flow-footer');
      const startBtn=_el('button','creation-flow-start-btn','Start Creating  →');
      startBtn.type='button';
      footer.appendChild(startBtn);

      if(!reps.length){
        preview.appendChild(_el('p','creation-flow-preview-empty','This world has no page styles to preview yet.'));
        preview.appendChild(footer);
        startBtn.addEventListener('click',function(){ _finish(type,theme,null); });
        return;
      }

      if(reps.length>1) preview.appendChild(_el('div','creation-flow-begin-with','🌿 Begin With 🌿'));
      const carouselWrap=_el('div','creation-flow-carousel-wrap');
      const prevBtn=_el('button','creation-flow-carousel-arrow prev','‹');
      prevBtn.type='button';
      const carousel=_el('div','creation-flow-carousel');
      const nextBtn=_el('button','creation-flow-carousel-arrow next','›');
      nextBtn.type='button';
      carouselWrap.appendChild(prevBtn);
      carouselWrap.appendChild(carousel);
      carouselWrap.appendChild(nextBtn);
      reps.forEach(function(r){ carousel.appendChild(_carouselSlide(r,theme.id)); });
      preview.appendChild(carouselWrap);

      const dots=_el('div','creation-flow-carousel-dots');
      const dotEls=reps.map(function(){
        const d=_el('span','creation-flow-carousel-dot');
        dots.appendChild(d);
        return d;
      });
      if(reps.length>1) preview.appendChild(dots);
      preview.appendChild(footer);

      let currentIndex=0;
      function updateActive(index){
        currentIndex=Math.max(0,Math.min(reps.length-1,index));
        dotEls.forEach(function(d,i){ d.classList.toggle('active',i===currentIndex); });
        prevBtn.disabled=currentIndex===0;
        nextBtn.disabled=currentIndex===reps.length-1;
      }
      updateActive(0);

      if(reps.length>1){
        let scrollFrame=null;
        carousel.addEventListener('scroll',function(){
          if(scrollFrame) cancelAnimationFrame(scrollFrame);
          scrollFrame=requestAnimationFrame(function(){
            updateActive(Math.round(carousel.scrollLeft/carousel.clientWidth));
          });
        });
        prevBtn.addEventListener('click',function(){ carousel.scrollBy({left:-carousel.clientWidth,behavior:'smooth'}); });
        nextBtn.addEventListener('click',function(){ carousel.scrollBy({left:carousel.clientWidth,behavior:'smooth'}); });
      }else{
        prevBtn.disabled=true;
        nextBtn.disabled=true;
      }

      startBtn.addEventListener('click',function(){
        _finish(type,theme,reps[currentIndex]);
      });
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
  function _renderChangeRepresentationScreen(reps,themeId){
    _clear();
    _setAtmosphere(true);
    _header('Choose your Page Style',_closeChangeRepresentation);
    content.appendChild(_el('h1','creation-flow-question','Choose a Page Style'));
    const grid=_el('div','creation-flow-grid');
    reps.forEach(function(r){
      grid.appendChild(_repCard(r,false,function(){ _applyRepresentationToCurrentSlide(r); },themeId));
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

  // Same active-theme resolution as currentRepresentations(), kept as a
  // separate lookup rather than changing that function's own return
  // shape (js/contextPanel.js already depends on it being a plain
  // Representation array) — only needed here so a relative-path
  // thumbnail can be resolved through the correct theme's asset map.
  function _currentRepresentationsThemeId(){
    if(typeof ThemeEngine==='undefined') return null;
    const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
    if(artworkId) return artworkId;
    return (ThemeEngine.getActiveThemeId && ThemeEngine.getActiveThemeId())||null;
  }

  function changeRepresentation(){
    const reps=currentRepresentations();
    if(!reps || !reps.length) return false;
    _ensureDom();
    _mode='change-representation';
    overlay.classList.remove('hidden');
    _renderChangeRepresentationScreen(reps,_currentRepresentationsThemeId());
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
    _selectedThemeId=null;
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
