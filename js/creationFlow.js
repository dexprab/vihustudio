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

  // Vihu Card Platform v1 — "card imported themes should have some
  // distinct marking." ThemeRegistry.getRecord() already stamps
  // redeemed:true/redeemedExpiresAt on a Card-unlocked theme's own
  // record (registerRedeemedTheme) — no new registry concept needed,
  // just reading a field this file hadn't looked at yet.
  function _redeemedInfo(themeId){
    if(typeof ThemeRegistry==='undefined' || !ThemeRegistry.getRecord) return null;
    const rec=ThemeRegistry.getRecord(themeId);
    return (rec && rec.redeemed) ? {expiresAt:rec.redeemedExpiresAt||null} : null;
  }
  function _redeemedTimeLeft(expiresAt){
    if(!expiresAt) return null;
    const ms=expiresAt-Date.now();
    if(ms<=0) return null; // _pruneExpiredRedeemed() will have already dropped this theme
    const hours=ms/3600000;
    if(hours<1) return Math.max(1,Math.round(ms/60000))+'m left';
    if(hours<24) return Math.round(hours)+'h left';
    return Math.round(hours/24)+'d left';
  }

  // A Theme card's preview swatch/icon — the same manifest fields
  // ThemeEngine's own Theme Library card (_renderThemeCard) already reads
  // for this exact purpose, so a new theme picks up a sensible preview
  // automatically, with no Creation-Flow-specific authoring step.
  //
  // Builder's Overview screen authors Thumbnail and Hero Image as two
  // distinct uploads (manifest.thumbnail / manifest.previewImage) —
  // Thumbnail for small card/list contexts, Hero Image as the larger
  // representative source. This function resolves both separately so a
  // caller picks the one that matches its own visual size, instead of
  // one generic `image` field that silently let a World-card-sized
  // thumbnail show the Hero Image instead.
  function _themePreview(theme){
    const rec=(typeof ThemeRegistry!=='undefined') ? ThemeRegistry.getRecord(theme.id) : null;
    const manifest=(rec && rec.manifest) || {};
    // Asset Repository Transition — manifest.thumbnail/.previewImage may
    // be bare relative-path references (builder.js/
    // _buildPackageFromZipFiles no longer embed them directly) rather
    // than a ready data:/http(s) src; resolveAssetRef resolves either
    // through this theme's own assets map (local-import data URI or a
    // repository's signed URL), unchanged for the legacy already-
    // embedded case.
    function resolve(v){
      return (v && typeof ThemeRegistry!=='undefined' && ThemeRegistry.resolveAssetRef)
        ? ThemeRegistry.resolveAssetRef(theme.id,v)
        : (v||null);
    }
    return {
      thumbnail:resolve(manifest.thumbnail),
      heroImage:resolve(manifest.previewImage),
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
      // This is a large carousel-slide visual, not a small list card —
      // prefer the World's Hero Image (its higher-resolution source),
      // falling back to Thumbnail, then the plain icon glyph.
      if(pv.heroImage) return {image:pv.heroImage};
      if(pv.thumbnail) return {image:pv.thumbnail};
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
    // A small List row card — this is exactly the Thumbnail Builder's
    // own Overview screen authors for this purpose, never the larger
    // Hero Image (a different, separately-uploaded asset).
    if(pv.thumbnail){
      const img=document.createElement('img');
      img.src=pv.thumbnail; img.alt='';
      preview.appendChild(img);
    }else{
      preview.style.background=pv.color;
      preview.textContent=pv.icon;
    }
    // "card imported themes should have some distinct marking" — a
    // Card-unlocked World is time-boxed and not a permanent addition
    // to this World Library, so it reads visibly differently from an
    // ordinary imported/published World, not just via a hidden field.
    const redeemed=_redeemedInfo(theme.id);
    if(redeemed) preview.appendChild(_el('div','creation-flow-world-card-badge','🎴'));
    card.appendChild(preview);
    card.appendChild(_el('div','creation-flow-world-name',theme.name));
    if(redeemed){
      const timeLeft=_redeemedTimeLeft(redeemed.expiresAt);
      card.appendChild(_el('div','creation-flow-world-card-timeleft',timeLeft||'Card'));
    }
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

    // Vihu Card Platform v1 — redemption lives HERE, before any
    // Creation Type is chosen, not on Screen 2. Screen 2's own World
    // Library is already filtered to whichever single type is active
    // (_themesForType) — redeeming there risked unlocking a World for
    // the wrong category (an Artwork World redeemed while on "Tell a
    // Story" simply vanished from that filtered view, reading as
    // "nothing happened"). Redeeming here has no category to get wrong;
    // _handleCardRedeemResult below routes to the matching Creation
    // Type screen once the theme's own supportedCreationTypes is known.
    if(typeof window.CardPlatform!=='undefined'){
      content.appendChild(_buildCardRedeemWidget());
    }
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
      const redeemed=_redeemedInfo(theme.id);
      if(redeemed){
        const timeLeft=_redeemedTimeLeft(redeemed.expiresAt);
        preview.appendChild(_el('div','creation-flow-preview-redeemed-note','🎴 Unlocked with a Card'+(timeLeft?' — '+timeLeft:'')));
      }
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

  // ---------- Vihu Card Platform v1 — Redeem widget ----------
  // A thin UI hook into js/cardPlatform.js: this file owns none of the
  // pattern-matching/rarity/RPC logic, only the grid/line-drawing DOM
  // mechanics (ported near-verbatim from the validated wireframe) and
  // calling CardPlatform.redeem()/rendering its result. Collapsed by
  // default — a 10x10 board is a lot of real estate to show
  // unconditionally beside the World Library — expanding into the same
  // tap-to-place, tap-again-to-undo, live-line-per-tap mechanics the
  // wireframe proved. The wireframe's own demo-only "reference" card-
  // back column is deliberately dropped here: in production there is no
  // local copy of a card's pattern to show a reference for — the
  // physical/shared card itself (a screenshot, a print, a spoken word)
  // is the real-world reference, external to this app.
  const CARD_GRID_SIZE=10;

  function _cardBoardKey(r,c){ return r+','+c; }

  function _cardCenterOfCell(boardEl,r,c){
    const el=boardEl.querySelector('[data-row="'+r+'"][data-col="'+c+'"]');
    if(!el) return {x:0,y:0};
    return {x:el.offsetLeft+el.offsetWidth/2, y:el.offsetTop+el.offsetHeight/2};
  }

  // Builds a real numbered coordinate grid (corner + column headers +
  // row headers + size*size tappable cells, every element explicitly
  // grid-placed) plus one <svg> line-overlay sibling used to draw the
  // live connecting line as stars are tapped. Returns the svg so the
  // caller can redraw into it.
  function _cardBuildGrid(boardEl,size,onClick){
    boardEl.innerHTML='';
    const corner=_el('div','creation-flow-card-gridlabel');
    corner.style.gridRow='1'; corner.style.gridColumn='1';
    boardEl.appendChild(corner);
    for(let c=0;c<size;c++){
      const colHead=_el('div','creation-flow-card-gridlabel',String(c+1));
      colHead.style.gridRow='1'; colHead.style.gridColumn=String(c+2);
      boardEl.appendChild(colHead);
    }
    for(let r=0;r<size;r++){
      const rowHead=_el('div','creation-flow-card-gridlabel',String(r+1));
      rowHead.style.gridRow=String(r+2); rowHead.style.gridColumn='1';
      boardEl.appendChild(rowHead);
    }
    for(let rr=0;rr<size;rr++){
      for(let cc=0;cc<size;cc++){
        const cell=document.createElement('button');
        cell.type='button';
        cell.className='creation-flow-card-cell';
        cell.dataset.row=rr; cell.dataset.col=cc;
        cell.style.gridRow=String(rr+2); cell.style.gridColumn=String(cc+2);
        cell.setAttribute('aria-label','Row '+(rr+1)+', Column '+(cc+1));
        cell.addEventListener('click',function(){ onClick(rr,cc,cell); });
        boardEl.appendChild(cell);
      }
    }
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','creation-flow-card-lines');
    boardEl.appendChild(svg);
    return svg;
  }

  function _cardRedrawLiveLines(board,svg,selected){
    svg.innerHTML='';
    if(selected.length<2) return;
    const centers=selected.map(function(k){
      const parts=k.split(',');
      return _cardCenterOfCell(board,parseInt(parts[0],10),parseInt(parts[1],10));
    });
    for(let i=0;i<centers.length-1;i++){
      const a=centers[i], b=centers[i+1];
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
      line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
      line.setAttribute('class','creation-flow-card-line');
      svg.appendChild(line);
    }
  }

  // The redeem_card RPC's own response never includes a card's real
  // pattern/constellation (see supabase/schema.sql) — there is nothing
  // here to sweep-animate against beyond what the redeemer themselves
  // just tapped, so success simply confirms the match rather than
  // replaying a server-known pattern back, unlike the wireframe's own
  // demo (which had the whole pattern hardcoded client-side to animate).
  function _handleCardRedeemResult(result,status,clearBoard){
    if(!result || !result.ok){
      const reason=result && result.reason;
      if(reason==='exhausted'){ status.textContent='✗ This card has no tries left.'; }
      else if(reason==='not_authenticated'){ status.textContent='✗ Couldn\'t verify your session — please try again.'; }
      else{ status.textContent='✗ Not quite — check the card and try again.'; }
      status.className='creation-flow-card-status err';
      clearBoard();
      return;
    }
    clearBoard();
    _routeAfterRedeem(result, status);
  }

  // Redeeming happens before any Creation Type is chosen (Screen 1),
  // so there is no "current screen" to simply repaint — this decides
  // where the newly-unlocked World actually belongs. A theme
  // registered via ThemeRegistry.registerRedeemedTheme() carries its
  // own real supportedCreationTypes (the compiled package's own field,
  // unchanged by redemption); matching it against CREATION_TYPES is
  // the same check _themesForType() already makes for Screen 2's own
  // filtering, just run once here to decide navigation instead of
  // filtering a list.
  function _routeAfterRedeem(result,status){
    const theme=(typeof ThemeRegistry!=='undefined') ? ThemeRegistry.get(result.themeId) : null;
    const supported=(theme && Array.isArray(theme.supportedCreationTypes)) ? theme.supportedCreationTypes : [];
    const matches=CREATION_TYPES.filter(function(t){ return supported.indexOf(t.id)!==-1; });
    if(matches.length===1){
      // The obvious case: jump straight to the one screen this World
      // belongs on, with it already selected — landing there IS the
      // confirmation, no separate message needed.
      _selectedThemeId=result.themeId;
      _renderWorldScreen(matches[0]);
      return;
    }
    // Zero or several matching types — stay on Screen 1 (nothing to
    // auto-pick) and say so in place, since the widget/status line
    // survives here (Screen 1 isn't being re-rendered).
    const typeNames=matches.map(function(t){ return t.title; });
    status.textContent='✨ '+(result.label||'World')+' unlocked'+
      (result.triesRemaining!=null?' — '+result.triesRemaining+' tries left':'')+
      (typeNames.length ? '. Choose "'+typeNames.join('" or "')+'" above to find it.' : '. Choose a creation type above to find it.');
    status.className='creation-flow-card-status ok';
  }

  function _buildCardRedeemPanel(panel){
    panel.appendChild(_el('p','creation-flow-card-redeem-intro','Tap the stars shown on your card, in order — a line connects them as you go. Tap a star again to undo it.'));

    const board=_el('div','creation-flow-card-board');
    panel.appendChild(board);

    const counter=_el('div','creation-flow-card-counter','0 stars selected');
    panel.appendChild(counter);

    const status=_el('p','creation-flow-card-status');
    panel.appendChild(status);

    const redeemBtn=_el('button','creation-flow-card-redeem-btn','✨ Redeem');
    redeemBtn.type='button';
    panel.appendChild(redeemBtn);

    let selected=[];
    const svg=_cardBuildGrid(board,CARD_GRID_SIZE,function(r,c,cell){
      const k=_cardBoardKey(r,c);
      const idx=selected.indexOf(k);
      if(idx===-1){
        selected.push(k);
        cell.classList.add('selected');
        cell.textContent='★';
      }else{
        selected.splice(idx,1);
        cell.classList.remove('selected');
        cell.textContent='';
      }
      counter.textContent=selected.length+' star'+(selected.length===1?'':'s')+' selected';
      _cardRedrawLiveLines(board,svg,selected);
    });

    function clearBoard(){
      board.querySelectorAll('.creation-flow-card-cell').forEach(function(el){
        el.classList.remove('selected');
        el.textContent='';
      });
      svg.innerHTML='';
      selected=[];
      counter.textContent='0 stars selected';
    }

    redeemBtn.addEventListener('click',function(){
      if(selected.length<2){
        status.textContent='Tap at least two stars first.';
        status.className='creation-flow-card-status err';
        return;
      }
      redeemBtn.disabled=true;
      status.textContent='Checking…';
      status.className='creation-flow-card-status';
      const pattern=selected.map(function(k){
        const parts=k.split(',');
        return [parseInt(parts[0],10),parseInt(parts[1],10)];
      });
      window.CardPlatform.redeem({pattern:pattern}).then(function(result){
        redeemBtn.disabled=false;
        _handleCardRedeemResult(result,status,clearBoard);
      });
    });

    const codeToggle=_el('button','creation-flow-card-code-toggle','Prefer to type the magic word instead? ⌄');
    codeToggle.type='button';
    const codeFallback=_el('div','creation-flow-card-code-fallback hidden');
    const codeInput=document.createElement('input');
    codeInput.type='text';
    codeInput.className='creation-flow-card-code-input';
    codeInput.placeholder='e.g. ORION-00125';
    const codeSubmit=_el('button','creation-flow-card-code-submit','Redeem with code');
    codeSubmit.type='button';
    codeFallback.appendChild(codeInput);
    codeFallback.appendChild(codeSubmit);
    panel.appendChild(codeToggle);
    panel.appendChild(codeFallback);

    codeToggle.addEventListener('click',function(){
      const opening=codeFallback.classList.contains('hidden');
      codeFallback.classList.toggle('hidden',!opening);
      codeToggle.textContent='Prefer to type the magic word instead? '+(opening?'⌃':'⌄');
    });

    function submitCode(){
      const val=codeInput.value.trim();
      if(!val){
        status.textContent='Enter the magic word and card number first.';
        status.className='creation-flow-card-status err';
        return;
      }
      codeSubmit.disabled=true;
      status.textContent='Checking…';
      status.className='creation-flow-card-status';
      window.CardPlatform.redeem({typed:val}).then(function(result){
        codeSubmit.disabled=false;
        _handleCardRedeemResult(result,status,clearBoard);
      });
    }
    codeSubmit.addEventListener('click',submitCode);
    codeInput.addEventListener('keydown',function(e){ if(e.key==='Enter') submitCode(); });
  }

  function _buildCardRedeemWidget(){
    const wrap=_el('div','creation-flow-card-redeem');
    const toggle=_el('button','creation-flow-card-toggle','🔮 Have a Card? Redeem it here ⌄');
    toggle.type='button';
    const panel=_el('div','creation-flow-card-redeem-panel hidden');
    wrap.appendChild(toggle);
    wrap.appendChild(panel);

    let built=false;
    toggle.addEventListener('click',function(){
      const opening=panel.classList.contains('hidden');
      panel.classList.toggle('hidden',!opening);
      toggle.textContent='🔮 Have a Card? Redeem it here '+(opening?'⌃':'⌄');
      if(opening && !built){ built=true; _buildCardRedeemPanel(panel); }
    });

    return wrap;
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

  // A Representation authored in World Builder can name a `defaultFrame`
  // (the Frame Variation the Theme Author picked for that Place) — but
  // Frame Variation has always been a per-card, Story-Author-driven
  // control (renderer/slideRenderer.js's `_resolveArtworkFields` only
  // ever reads `slide.metadata.cardOverrides.artwork.frameVariation`,
  // never `representation.defaultFrame`), so a Theme Author's own chosen
  // Frame silently never appeared until the Story Author manually opened
  // Card Designer and picked one themselves. Seeding the override here —
  // once, only when the slide has no per-card choice of its own yet —
  // closes that gap without inventing a second resolution mechanism:
  // it's the exact same override bag every hand-picked Frame Variation
  // already writes to, just pre-filled with the Theme's own intent.
  function _seedDefaultFrameVariation(slide,representation,theme){
    if(!slide || !representation || !representation.defaultFrame || !theme) return;
    if(!Array.isArray(theme.frameVariations)) return;
    const exists=theme.frameVariations.some(function(v){ return v && v.id===representation.defaultFrame; });
    if(!exists) return;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.artwork) slide.metadata.cardOverrides.artwork={};
    if(slide.metadata.cardOverrides.artwork.frameVariation) return; // never clobber a Story Author's own choice
    slide.metadata.cardOverrides.artwork.frameVariation=representation.defaultFrame;
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
      _seedDefaultFrameVariation(slide,representation,theme);
    }
    if(typeof ThemeEngine!=='undefined'){
      try{
        if(_themeType(theme.id)==='artwork') ThemeEngine.applyArtworkTheme(theme.id,{silent:true});
        else ThemeEngine.applyTheme(theme.id,{silent:true});
      }catch(e){}
    }
    try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    _closeOverlay();
    // Creator Runtime Pass Sprint — one dispatch instead of three
    // independent re-render sequences. PageOps.addBefore's own pipeline
    // and ThemeEngine.apply*'s own renderList/showSlide calls already
    // cover most of this; routing the final refresh through Page
    // Runtime (or its own showSlide fallback) guarantees the
    // just-applied theme/layout is reflected everywhere exactly once.
    try{
      if(typeof PageRuntime!=='undefined') PageRuntime.openPage(AppState.currentSlide);
      else if(typeof window.showSlide==='function') window.showSlide(AppState.currentSlide);
    }catch(e){}
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
      const themeId=_currentRepresentationsThemeId();
      const theme=(themeId && typeof ThemeRegistry!=='undefined')?ThemeRegistry.get(themeId):null;
      _seedDefaultFrameVariation(slide,r,theme);
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
