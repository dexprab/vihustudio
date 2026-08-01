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

  // BACKLOG.md item 4 ("Performance: ... moving object or choosing color
  // becomes really difficult if there are over 20 objects on scene") — a
  // real Playwright profiling reproduction confirmed ObjectStrip.refresh()
  // (a full teardown-and-rebuild of every object card on the page) was
  // responsible for 99.1% of a single drag-tick's cost when called from
  // _afterQuickEditChange() below: 49.04ms/event at N=25 objects with the
  // call present vs. 0.423ms/event with it stubbed out, over a simulated
  // 30-tick native <input type=range>/<input type=color> drag gesture —
  // ~1.47 seconds of blocking JS for one rotation-slider drag, directly
  // matching the reported symptom. redrawPreview()/draw() and
  // CardDesigner.refresh() were both separately, empirically confirmed to
  // stay flat regardless of N (0.95x/0.92x scaling ratios N=3->50) and are
  // therefore left firing on every tick unchanged below — only
  // ObjectStrip.refresh() is debounced, via the one shared helper below so
  // every call site (the World-owned/sticker-text quick-edit popup's own
  // commit tail, and _appendBackground's Scene-hosted-background Colour
  // Kit callback — both wired to a native <input type=range>/<input
  // type=color>'s own continuously-firing 'input' event) coalesces onto
  // the same timer rather than each keeping its own, independent one.
  const OBJECT_STRIP_REFRESH_DEBOUNCE_MS=150;
  let _objectStripRefreshTimer=null;
  function _debouncedObjectStripRefresh(){
    if(_objectStripRefreshTimer) clearTimeout(_objectStripRefreshTimer);
    _objectStripRefreshTimer=setTimeout(function(){
      _objectStripRefreshTimer=null;
      if(typeof ObjectStrip!=='undefined'){ try{ ObjectStrip.refresh(); }catch(e){ try{ console.error('[Context Panel] ObjectStrip.refresh (debounced) failed:',e); }catch(_){} } }
    },OBJECT_STRIP_REFRESH_DEBOUNCE_MS);
  }

  // Right Panel Redesign — state for the Personalize ⇄ Refine swap.
  // personalizeExpanded: only meaningful once something is selected —
  // false shows the collapsed one-line strip, true re-expands the full
  // Personalize zone in place. personalizeOpenSection: which single
  // inline-accordion body (inside the full Personalize zone) is open —
  // 'add' | 'background' | 'caption' | null; opening one closes any
  // other. Both reset only when the selection itself actually changes
  // (tracked via _lastSelectionKey), never on a same-selection refresh()
  // triggered by toggling one of these very controls.
  // BACKLOG.md: "Default state of add something should be open." —
  // 'add' is the real default (not null) so every time the panel
  // returns to its nothing-selected default state (a fresh boot, or
  // deselecting after a genuine new selection), Add Something's own
  // grid is already showing, with zero tap required — a Story Author
  // still tapping the trigger to close it stays closed for the rest of
  // that same selection (the existing "never reset on a same-selection
  // refresh()" rule, unchanged), reopening only once a real new
  // selection cycle brings this default back around.
  let personalizeExpanded=false;
  let personalizeOpenSection='add';
  let _lastSelectionKey=null;

  // "2 corrections for text object" — a Story-owned freeform text
  // sticker's own first-ever selection still opens the full right-panel
  // editor (today's exact existing behaviour); every selection after
  // that routes to the lightweight quick-edit popup instead. Computed
  // exactly once per genuine new selection (inside refresh()'s own
  // key!==_lastSelectionKey gate, via _consumeStickerTextFirstEdition
  // below) — never re-derived on a same-selection refresh() triggered by
  // typing mid-edit, or the very first editing session would itself get
  // yanked over to the popup the instant the first keystroke fires one.
  let _currentStickerTextFirstEdition=true;

  // "need back button to go to previous selection else every time have
  // to reset it by clicking outside" — a small, real selection history
  // (browser-back-button semantics), independent of Personalize's own
  // expand/collapse state. _selectionHistory holds the snapshots being
  // LEFT each time the selection genuinely changes; _navigatingBack
  // suppresses re-pushing the very transition Back itself causes, so
  // Back/Forward can never ping-pong two entries against each other.
  let _selectionHistory=[];
  let _lastSelectionSnapshot={sceneId:null,sceneType:null,textId:null};
  let _navigatingBack=false;
  const SELECTION_HISTORY_MAX=20;

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

  // Platform Hardening — Draft Asset Architecture, Phase C. Every real
  // upload in this file (Add/Replace Artwork, Crop/Rotate's re-apply, a
  // World-owned object's own Replace Image control) funnels through this
  // one function before it ever reaches a slide — mirrors js/app.js's own
  // identically-named helper exactly (duplicated here rather than shared
  // across files, matching this codebase's own established "kept in
  // lockstep by hand" precedent for small, per-module adapter functions).
  // A missing AssetStore/ProjectManager, or any put() failure, falls back
  // to handing the caller the raw data: URI unchanged — exactly today's
  // pre-Phase-C behaviour, never a silently lost upload.
  function _storeUploadedAsset(dataURL,onFile){
    if(typeof window.AssetStore==='undefined' || typeof ProjectManager==='undefined' || typeof ProjectManager.ensureProjectId!=='function'){
      onFile(dataURL); return;
    }
    const projectId=ProjectManager.ensureProjectId();
    if(!projectId){ onFile(dataURL); return; }
    const finish=function(finalDataURL){
      window.AssetStore.put(finalDataURL,{surface:'creator',projectId:projectId}).then(function(ref){
        onFile(ref);
      }).catch(function(){ onFile(finalDataURL); });
    };
    const isImage=typeof dataURL==='string' && dataURL.indexOf('data:image/')===0;
    if(isImage && dataURL.length>window.AssetStore.UPLOAD_DOWNSCALE_THRESHOLD_BYTES && typeof window.AssetStore.downscaleImageDataURL==='function'){
      window.AssetStore.downscaleImageDataURL(dataURL).then(finish).catch(function(){ finish(dataURL); });
    }else{
      finish(dataURL);
    }
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
    const wasNavigatingBack=_navigatingBack;
    _navigatingBack=false;
    if(key!==_lastSelectionKey){
      // Only push the state being LEFT onto history when this change
      // was a genuine new selection — not when it's the very refresh()
      // caused by clicking Back itself (that would just re-push the
      // state Back is trying to leave, producing an infinite ping-pong
      // between two entries instead of real history).
      if(!wasNavigatingBack && _lastSelectionKey!==null){
        _selectionHistory.push(_lastSelectionSnapshot);
        if(_selectionHistory.length>SELECTION_HISTORY_MAX) _selectionHistory.shift();
      }
      personalizeExpanded=false;
      // BACKLOG.md: "Default state of add something should be open." —
      // resets back to 'add' (not null) on every genuine new selection
      // cycle, matching the declaration-site default above.
      personalizeOpenSection='add';
      // "2 corrections for text object" — computed here, exactly once
      // per genuine new selection, same reasoning as the reset above:
      // a same-selection refresh() (e.g. every keystroke while the
      // right-panel editor is open) must never re-derive this and yank
      // a Story Author's own first editing session over to the popup
      // mid-sentence.
      _currentStickerTextFirstEdition=_consumeStickerTextFirstEdition(sceneId,sceneType);
    }
    _lastSelectionSnapshot={sceneId:sceneId,sceneType:sceneType,textId:textId};
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
      // "2 corrections for text object" — a Story-owned freeform text
      // sticker's own SECOND and later selection routes to the
      // lightweight quick-edit popup pointer view instead of reopening
      // the full right-panel editor every time; its first-ever
      // selection (the flag computed above, once, on this same genuine
      // selection change) falls straight through to the existing
      // unconditional behaviour right below, unchanged.
      if(sceneType==='sticker' && sceneObj.visual && sceneObj.visual.kind==='text' && !_currentStickerTextFirstEdition){
        _hideAllTabs();
        _renderStickerTextQuickEditPointer(sceneObj);
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

  // "2 corrections for text object" — decides (and durably records) which
  // edition a Story-owned freeform text sticker's selection is: the
  // FIRST time it's ever opened here (the sticker instance carries no
  // `_edited` flag yet) returns true and stamps `_edited:true` right
  // away — a later reselection of the SAME sticker, this session or any
  // future one (the flag rides on the sticker instance, saved with the
  // slide), then correctly returns false. Reads the sticker's own
  // `kind` field directly rather than needing the render-tree's
  // `visual.kind` — this runs from refresh()'s own key-change gate,
  // before the render-tree lookup that would otherwise supply it.
  // Every non-text-sticker selection (World-owned objects, Places,
  // Scene blueprint elements, shape/doodle/glyph stickers) always
  // returns true — the flag has no meaning for them, so the caller's
  // own dispatch is what actually decides whether this value is ever
  // consulted at all.
  function _consumeStickerTextFirstEdition(sceneId,sceneType){
    if(sceneType!=='sticker' || !sceneId) return true;
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.findSticker!=='function' || typeof SceneEngine.updateSticker!=='function') return true;
    let st;
    try{ st=SceneEngine.findSticker(slide,sceneId); }catch(e){ st=null; }
    if(!st || st.kind!=='text') return true;
    if(st._edited) return false;
    try{ SceneEngine.updateSticker(slide,sceneId,{_edited:true}); }catch(e){}
    return true;
  }

  // "need back button to go to previous selection else every time have
  // to reset it by clicking outside" — pops the last entry off
  // _selectionHistory and re-applies it via PageRuntime, exactly the
  // same selection channels every other control in this file already
  // uses. A "nothing selected" history entry (both ids null) goes back
  // to clearing selection, matching what clicking empty canvas already
  // does today — Back just makes that one keystroke instead of a hunt
  // for empty space.
  function _goBack(){
    if(!_selectionHistory.length) return;
    const prev=_selectionHistory.pop();
    _navigatingBack=true;
    if(typeof PageRuntime==='undefined'){ _navigatingBack=false; return; }
    if(prev.sceneId && prev.sceneType){
      PageRuntime.selectSceneObject(prev.sceneId,prev.sceneType);
    }else if(prev.textId){
      PageRuntime.selectTextObject(prev.textId);
    }else{
      PageRuntime.clearSelection();
    }
  }
  function _appendBackControl(container){
    if(!_selectionHistory.length) return;
    const btn=_el('button','context-back-btn','← Back');
    btn.type='button';
    btn.addEventListener('click',_goBack);
    container.appendChild(btn);
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
  // control elsewhere in Creator already does. Renamed from
  // _afterWorldObjectEdit — a Story-owned freeform text sticker's own
  // quick-edit popup (_appendStickerTextEditControl below) now shares
  // this exact same commit tail, so the name no longer says "World"
  // only.
  //
  // BACKLOG.md item 4 (Performance with 20+ objects) — ObjectStrip.
  // refresh() is a full teardown-and-rebuild of every object card on
  // the page (confirmed via direct read of js/objectStrip.js's own
  // refresh(): innerHTML='' then every card rebuilt from scratch, with
  // real per-object canvas draws/Promise creation for image/shape/
  // doodle visual kinds) — genuinely expensive, and every one of this
  // function's ~15 call sites is wired to a native <input type=range>/
  // <input type=color>'s own 'input' event, which fires continuously
  // (many times per second) during a drag/pick gesture, not once at the
  // end. Debouncing ONLY this call — never host.redraw()/markDirty(),
  // both confirmed to stay flat regardless of object count and needed
  // for live visual feedback on every tick — coalesces a whole drag
  // gesture's worth of ticks into one real rebuild once the gesture
  // settles, matching this codebase's own established "defer expensive
  // work to gesture-end" convention (autosave/cloud-sync/asset-
  // migration debouncing in js/projectManager.js, etc.). The canvas
  // itself keeps repainting on every tick throughout — only the Object
  // Strip's own thumbnail/label rebuild is deferred.
  function _afterQuickEditChange(){
    // Diagnostic-only addition — this catch used to swallow whatever
    // host.redraw() throws with zero signal, which could leave the
    // canvas silently stuck on its last successfully-drawn frame after
    // an in-place World-owned-object edit with no visible error anywhere
    // an author or a future debugger could see. Never changes behaviour
    // on a successful redraw — only surfaces a genuine failure.
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){ try{ console.error('[Context Panel] redraw after World-owned object edit failed:',e); }catch(_){} } }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){ try{ console.error('[Context Panel] markDirty after World-owned object edit failed:',e); }catch(_){} } }
    }
    _debouncedObjectStripRefresh();
  }

  // Honor Grid follow-up — the World-owned Text object build. Kept as
  // this module's own small copy (matching js/objectStrip.js's/
  // js/selectionActionStrip.js's own established per-module vocabulary-
  // table duplication precedent, rather than reaching into cardDesigner.
  // js's private, closure-scoped FONT_FAMILY_OPTIONS/FONT_WEIGHT_OPTIONS)
  // — same option set and the same field-name convention (fontFamily/
  // fontSize/fontWeight/fontStyle/alignment) as that file's own fixed-
  // Text typography system, so a Story Author sees identical vocabulary
  // in both places even though the two write to genuinely different
  // override bags (cardOverrides.textElements there, elementOverrides
  // here).
  const WORLD_TEXT_FONT_OPTIONS=[
    {value:'',label:'World Default'},
    {value:'Georgia, serif',label:'Georgia'},
    {value:'"Times New Roman", Times, serif',label:'Times'},
    {value:'Arial, Helvetica, sans-serif',label:'Arial'},
    {value:'"Helvetica Neue", Helvetica, Arial, sans-serif',label:'Helvetica'},
    {value:'"Trebuchet MS", sans-serif',label:'Trebuchet'},
    {value:'"Comic Sans MS", "Chalkboard SE", cursive',label:'Comic'},
    {value:'"Courier New", Courier, monospace',label:'Courier'},
    {value:'"Kalam", "Comic Sans MS", cursive',label:'Handwriting'},
    {value:'"Nunito", "Trebuchet MS", sans-serif',label:'Kid Friendly'},
    {value:'"Permanent Marker", "Comic Sans MS", cursive',label:'Marker'}
  ];
  // "weight is a very technical term, is that drop down even needed?" ->
  // "approved make the change" — the old 7-option Weight dropdown
  // (World Default/Light/Regular/Medium/Semibold/Bold/Black) is retired
  // outright; Bold now lives as a fourth Style-row toggle instead (see
  // _makeMultiToggleRow below), writing the identical `fontWeight` field
  // ('700' on, cleared/World-Default off) through the exact same
  // SceneEngine.setContentOverride path the dropdown always used — a
  // narrower vocabulary a Story Author actually reasons about, not a new
  // mechanism.

  // Every builder below now optionally appends (pass a real `parent`) or
  // just returns the built row unattached (`parent` falsy) — the second
  // form is what lets _pairRow() below combine two of these into one
  // shared line instead of each claiming a full row of its own.
  function _makeRangeRow(parent,opts){
    // opts: {labelText, min, max, step, value, format(v), onInput(v)}
    const row=_el('div','designer-row context-row');
    const lbl=_el('div','designer-row-label text-slider-label');
    lbl.appendChild(_el('span',null,opts.labelText));
    const val=_el('span','context-range-value',opts.format(opts.value));
    lbl.appendChild(val);
    row.appendChild(lbl);
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(opts.min);
    slider.max=String(opts.max);
    slider.step=String(opts.step);
    slider.className='context-range-input';
    slider.value=String(opts.value);
    slider.addEventListener('input',function(){
      const v=parseFloat(slider.value);
      val.textContent=opts.format(v);
      opts.onInput(v);
    });
    row.appendChild(slider);
    if(parent) parent.appendChild(row);
    return row;
  }

  function _makeSelectRow(parent,labelText,options,currentValue,onChange){
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label',labelText));
    const sel=document.createElement('select');
    sel.className='context-select';
    options.forEach(function(o){
      const opt=document.createElement('option');
      opt.value=o.value; opt.textContent=o.label;
      sel.appendChild(opt);
    });
    sel.value=currentValue||'';
    sel.addEventListener('change',function(){ onChange(sel.value); });
    row.appendChild(sel);
    if(parent) parent.appendChild(row);
    return row;
  }

  function _makeIconChoiceRow(parent,labelText,choices,currentValue,onChoose){
    // choices: [[value,label], ...] — reuses the same .icon-row/.icon-card
    // vocabulary cardDesigner.js's own Style/Alignment rows already use,
    // so this reads as the same control language, not a new one.
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label',labelText));
    const icons=_el('div','icon-row');
    const btns=[];
    choices.forEach(function(c){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card'+(currentValue===c[0]?' active':'');
      const lbl=_el('span','icon-label',c[1]);
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){
        // This popup is never rebuilt mid-edit (see _makeMultiToggleRow's
        // own comment above), so a single-select row must keep its own
        // "which button is active" state correct purely via DOM
        // manipulation on click — previously this only ever called
        // onChoose(), leaving every button frozen at whichever one was
        // active when the popup first opened even though the model (and
        // the object's own rendered effect) had already changed.
        btns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        onChoose(c[0]);
      });
      icons.appendChild(btn);
      btns.push(btn);
    });
    row.appendChild(icons);
    if(parent) parent.appendChild(row);
    return row;
  }

  // Multi-select sibling of _makeIconChoiceRow above — that one is a
  // single-select, radio-style control (clicking one deselects every
  // other), unsuitable for Style once Bold/Italic/Underline/Strikethrough
  // must combine freely (a line can be all four at once) rather than one
  // replacing another. Each button toggles its own boolean independently;
  // the glyph preview itself is styled to actually look bold/italic/
  // underlined/struck-through, so the effect is visible before it's even
  // applied. `isActive(value)` seeds each button's initial state from the
  // current model; after that, each button's own class toggle is the
  // source of truth for the rest of this popup's lifetime (mirrors how
  // this file never rebuilds the popup mid-edit — _afterQuickEditChange
  // deliberately never calls refresh() — so there's nothing that would
  // re-derive it from a stale closure anyway).
  function _makeMultiToggleRow(parent,labelText,choices,isActive,onToggle){
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label',labelText));
    const icons=_el('div','icon-row');
    choices.forEach(function(c){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card'+(isActive(c[0])?' active':'');
      const lbl=_el('span','icon-label icon-label-glyph',c[1]);
      if(c[0]==='bold') lbl.style.fontWeight='800';
      else if(c[0]==='italic') lbl.style.fontStyle='italic';
      else if(c[0]==='underline') lbl.style.textDecoration='underline';
      else if(c[0]==='strikethrough') lbl.style.textDecoration='line-through';
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){
        onToggle(c[0]);
        btn.classList.toggle('active');
      });
      icons.appendChild(btn);
    });
    row.appendChild(icons);
    if(parent) parent.appendChild(row);
    return row;
  }

  // "The color kit should be available everywhere where color options
  // are" — the one shared seam every colour surface in this file (the 3
  // _makeColorRow call sites below, plus _appendBackground's own 2
  // direct colour inputs) funnels through, appending the shared,
  // reusable Colour Kit widget (curated swatches + a custom native
  // picker) js/cardDesigner.js already built and exposed on window.
  // CardDesigner.buildColourKit, instead of a bare <input type=color>.
  // Falls back to the original raw input only in the (practically
  // unreachable) case CardDesigner hasn't loaded yet, so this can never
  // leave a caller with no colour control at all.
  function _appendColourKit(row,colorValue,onInput){
    if(typeof window.CardDesigner!=='undefined' && typeof window.CardDesigner.buildColourKit==='function'){
      window.CardDesigner.buildColourKit(row,{
        value:_safeColor(colorValue),
        onChange:function(v){ onInput(v); }
      });
    }else{
      const input=document.createElement('input');
      input.type='color';
      input.className='theme-color-input';
      input.value=_safeColor(colorValue);
      input.addEventListener('input',function(){ onInput(input.value); });
      row.appendChild(input);
    }
  }

  function _makeColorRow(parent,labelText,colorValue,onInput){
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label',labelText));
    _appendColourKit(row,colorValue,onInput);
    if(parent) parent.appendChild(row);
    return row;
  }

  // Popup-cramping fix (screenshot-reported: "all options are not visible,
  // scroll is needed but i dont want scroll") — pairs two short field rows
  // side by side on one line instead of each stacking as its own full-width
  // row, mirroring World Builder's own established _fieldRow()/
  // _buildFieldGroup() pairing convention (tools/world-builder-v2's
  // Inspector already solved this exact "too many stacked fields, not
  // enough vertical room" problem the same way). `cellB` is optional — a
  // lone cell (e.g. Rotation with no Colour to pair with, on a moveable-
  // only object) spans the row's own full width on its own, never left
  // half-empty.
  function _pairRow(container,cellA,cellB){
    if(!cellA) return;
    if(!cellB){ container.appendChild(cellA); return; }
    const row=_el('div','context-field-row');
    row.appendChild(cellA);
    row.appendChild(cellB);
    container.appendChild(row);
  }

  // Kind-specific in-place edit control, built from the exact same
  // `visual` descriptor (renderer/slideRenderer.js's `_layerVisual`)
  // Object Strip's own thumbnail already reads — editing here and the
  // thumbnail agreeing about what a field means is automatic, not
  // separately maintained. Writes through SceneEngine.setContentOverride
  // (js/sceneEngine.js), the exact elementOverrides bag every other
  // per-object override already lives in.
  // Takes an explicit container instead of always writing into panelRoot
  // -- Selection Confidence Sprint (Option B follow-up) reuses this exact
  // function to mount the SAME real control inline in the Selection
  // Action Strip's own small popup, rather than duplicating the
  // color/image/text branching a second time. _renderWorldObjectDisclosure
  // below still passes panelRoot, so its own behaviour is unchanged.
  // Honor Grid follow-up — content controls (Words/Colour/Image, plus
  // Text's own Typography+Alignment+Opacity) stay gated on
  // sceneObj.editable (Honor 3); Rotation is a spatial transform gated
  // on sceneObj.moveable (Honor 2) instead, independent of editable —
  // matching the same bucket Move/Resize already live in. Returns
  // whether anything was actually mounted.
  function _appendWorldObjectEditControl(container,sceneObj,v){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.setContentOverride!=='function') return false;
    let mounted=false;
    // The raw override bag — Rotation/Opacity/Font/Size/Weight/Style/
    // Alignment aren't part of the `v` visual descriptor (_layerVisual
    // only carries what a thumbnail/popup's INITIAL content value needs
    // for color/image/text), so read the same bag renderer/
    // slideRenderer.js's own _layerOverride reads, directly.
    const ov=(slide.metadata && slide.metadata.elementOverrides && slide.metadata.elementOverrides[sceneObj.id]) || {};

    // Built first, regardless of order below, so it can be paired onto
    // Colour's own row when both are present (screenshot-reported: the
    // popup was cramped enough to need a scrollbar with every field
    // stacked one-per-line) — or stand alone, full-width, when Colour
    // isn't shown at all (a moveable:true/editable:false object still
    // needs a reachable Rotation control with nothing to pair it with).
    let rotationCell=null;
    if(v.kind==='text' && sceneObj.moveable && typeof SceneEngine.setRotation==='function'){
      rotationCell=_makeRangeRow(null,{
        labelText:'Rotation',min:-180,max:180,step:1,
        value:(typeof ov.rotation==='number')?ov.rotation:0,
        format:function(n){ return Math.round(n)+'°'; },
        onInput:function(n){ SceneEngine.setRotation(slide,sceneObj.id,n); _afterQuickEditChange(); }
      });
      mounted=true;
    }

    if(sceneObj.editable){
      if(v.kind==='color' || v.kind==='shape'){
        const colorCell=_makeColorRow(null,'Colour',v.color||v.fillColor,function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'fillColor',val);
          _afterQuickEditChange();
        });
        _pairRow(container,colorCell,rotationCell);
        rotationCell=null;
        mounted=true;
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
              _storeUploadedAsset(reader.result,function(finalRef){
                SceneEngine.setContentOverride(slide,sceneObj.id,'image',finalRef);
                _afterQuickEditChange();
              });
            };
            reader.readAsDataURL(file);
          });
          fileInput.click();
        });
        container.appendChild(btn);
        mounted=true;
      }else if(v.kind==='text'){
        container.appendChild(_el('div','designer-row-label','Words'));
        const textarea=document.createElement('textarea');
        textarea.className='context-textarea';
        textarea.value=v.content||'';
        textarea.addEventListener('input',function(){
          SceneEngine.setContentOverride(slide,sceneObj.id,'content',textarea.value);
          _afterQuickEditChange();
        });
        container.appendChild(textarea);

        container.appendChild(_el('div','designer-sublabel','Typography'));
        // Font Family's old partner, Weight, no longer exists as a dropdown
        // (folded into Style as a Bold toggle, below) — Font Family is now
        // paired instead with the newer Fill Style toggle right beside it.
        const familyCell=_makeSelectRow(null,'Font Family',WORLD_TEXT_FONT_OPTIONS,ov.fontFamily||'',function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'fontFamily',val===''?null:val);
          _afterQuickEditChange();
        });
        // "geometric/faceted lettering" — a Fill Style toggle, Solid vs.
        // Shapes (a deterministic geometric-mosaic pattern clipped to the
        // real rendered glyph shapes, working for any typed text/any font
        // — see renderer/slideRenderer.js's _drawShapeMosaicTextBlock).
        // Paired with Font Family since both are foundational "how does
        // this text render" choices, not a Typography sub-property.
        const fillStyleCell=_makeIconChoiceRow(null,'Fill Style',[['solid','Solid'],['shapes','Shapes']],ov.shapeFill?'shapes':'solid',function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'shapeFill',val==='shapes'?true:null);
          _afterQuickEditChange();
        });
        _pairRow(container,familyCell,fillStyleCell);

        // "why we dont have underline as a style, and strikethrough also" —
        // folded into this same Style row as independently-toggling
        // buttons rather than new stacked rows, matching the exact scope
        // the user asked for ("add it in the styles"). Bold joined the
        // same row later ("approved make the change," replacing the old
        // Weight dropdown above) for the identical reason — one small,
        // legible glyph a Story Author actually reasons about, instead of
        // a jargon-heavy Light/Regular/Medium/Semibold/Bold/Black list.
        // Bold is the one entry here that does NOT write a plain boolean
        // — it shares the `fontWeight` field the old dropdown wrote,
        // toggling it between '700' and cleared (World Default) — every
        // other entry (Italic/Underline/Strikethrough) still writes its
        // own boolean/`fontStyle` field exactly as before.
        const styleState={bold:ov.fontWeight==='700',italic:ov.fontStyle==='italic',underline:!!ov.underline,strikethrough:!!ov.strikethrough};
        const styleCell=_makeMultiToggleRow(null,'Style',[['bold','B'],['italic','I'],['underline','U'],['strikethrough','S']],function(key){
          return styleState[key];
        },function(key){
          const next=!styleState[key];
          if(key==='bold') SceneEngine.setContentOverride(slide,sceneObj.id,'fontWeight',next?'700':null);
          else if(key==='italic') SceneEngine.setContentOverride(slide,sceneObj.id,'fontStyle',next?'italic':null);
          else SceneEngine.setContentOverride(slide,sceneObj.id,key,next?true:null);
          styleState[key]=next;
          _afterQuickEditChange();
        });
        const alignCell=_makeIconChoiceRow(null,'Alignment',[['left','Left'],['center','Center'],['right','Right']],ov.alignment||'',function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'alignment',val);
          _afterQuickEditChange();
        });
        _pairRow(container,styleCell,alignCell);

        const sizeCell=_makeRangeRow(null,{
          labelText:'Font Size',min:12,max:96,step:1,
          value:(typeof ov.fontSize==='number')?ov.fontSize:24,
          format:function(n){ return Math.round(n)+'px'; },
          onInput:function(n){ SceneEngine.setContentOverride(slide,sceneObj.id,'fontSize',Math.round(n)); _afterQuickEditChange(); }
        });
        const opacityCell=_makeRangeRow(null,{
          labelText:'Opacity',min:0,max:1,step:0.01,
          value:(typeof ov.opacity==='number')?ov.opacity:1,
          format:function(n){ return Math.round(n*100)+'%'; },
          onInput:function(n){ SceneEngine.setOpacity(slide,sceneObj.id,n); _afterQuickEditChange(); }
        });
        _pairRow(container,sizeCell,opacityCell);

        const colorCell=_makeColorRow(null,'Colour',ov.color,function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'color',val);
          _afterQuickEditChange();
        });
        _pairRow(container,colorCell,rotationCell);
        rotationCell=null;
        // Bug G — Curve is a rendering property (editable/Honor 3), not
        // spatial like Rotation (moveable/Honor 2). Range −180…180°:
        // 0 = flat/no curve (byte-identical default), positive = smile
        // arc, negative = frown arc. Full-width row of its own since
        // Rotation was already paired with Colour above.
        const curveCell=_makeRangeRow(null,{
          labelText:'Curve',min:-180,max:180,step:1,
          value:(typeof ov.curve==='number')?ov.curve:0,
          format:function(n){ return Math.round(n)+'°'; },
          onInput:function(n){ SceneEngine.setContentOverride(slide,sceneObj.id,'curve',n?n:null); _afterQuickEditChange(); }
        });
        _pairRow(container,curveCell,null);
        mounted=true;
      }
    }
    // Only reached when Rotation was built but nothing above claimed it
    // as a pairing partner (editable:false, or a color/shape/image kind
    // that never builds a rotationCell in the first place) — its own
    // full-width row rather than being silently dropped.
    if(rotationCell) container.appendChild(rotationCell);
    return mounted;
  }

  // Public seam for the Selection Action Strip's own inline "Edit" popup
  // (js/selectionActionStrip.js) -- reuses this exact rendering/write
  // path rather than a second implementation, so the strip's control and
  // this panel's own disclosure can never disagree about what a field
  // means or where it writes.
  // Honor Grid follow-up — no longer gates World-owned objects on
  // sceneObj.editable up front (Rotation is real and reachable on a
  // moveable:true/editable:false object too) — _appendWorldObjectEditControl
  // itself decides per honor now and reports back whether anything was
  // actually mounted, so the caller can show its own fallback when
  // there's nothing to mount.
  // "2 corrections for text object" — widened beyond World-owned objects
  // to also cover a Story-owned freeform text sticker (owner==='story',
  // type==='sticker', visual.kind==='text') on its SECOND and later
  // selection (js/selectionActionStrip.js only ever opens this popup at
  // all; refresh()'s own first-edition gate below decides whether that
  // popup or the full right-panel editor is what a given selection
  // reaches). A World-owned object's content lives in
  // slide.metadata.elementOverrides (SceneEngine.setContentOverride); a
  // Story-owned sticker's own content lives in a completely different
  // bag — its own instance fields on slide.metadata.stickers[]
  // (SceneEngine.updateSticker) — so this dispatches on ownership first,
  // routing each kind to its own, separate write path rather than
  // silently writing to the wrong one.
  function mountQuickEditControl(container,sceneObj){
    if(!container || !sceneObj) return false;
    if(sceneObj.owner==='world'){
      const v=sceneObj.visual;
      if(!v || !(v.kind==='color'||v.kind==='shape'||v.kind==='image'||v.kind==='text')) return false;
      return _appendWorldObjectEditControl(container,sceneObj,v);
    }
    if(sceneObj.type==='sticker' && sceneObj.visual && sceneObj.visual.kind==='text'){
      return _appendStickerTextEditControl(container,sceneObj);
    }
    return false;
  }

  // "2 corrections for text object" — mirrors js/cardDesigner.js's own
  // sticker-Text-group option lists field-for-field (same values, so a
  // Story Author sees identical choices whichever surface they're on),
  // duplicated as this module's own small copy rather than reaching into
  // cardDesigner.js's private, closure-scoped FONT_FAMILY_OPTIONS/
  // FONT_WEIGHT_OPTIONS — matching this file's own established
  // WORLD_TEXT_FONT_OPTIONS precedent. The first option is relabelled
  // 'Default' rather than 'World Default': a freeform sticker has no
  // Theme backing it (renderer/slideRenderer.js's _drawFreeformText falls
  // back to plain Georgia serif / unweighted, never a World value), so
  // "World Default" would be a wrong claim here.
  const STICKER_TEXT_FONT_OPTIONS=[
    {value:'',label:'Default'},
    {value:'Georgia, serif',label:'Georgia'},
    {value:'"Times New Roman", Times, serif',label:'Times'},
    {value:'Arial, Helvetica, sans-serif',label:'Arial'},
    {value:'"Helvetica Neue", Helvetica, Arial, sans-serif',label:'Helvetica'},
    {value:'"Trebuchet MS", sans-serif',label:'Trebuchet'},
    {value:'"Comic Sans MS", "Chalkboard SE", cursive',label:'Comic'},
    {value:'"Courier New", Courier, monospace',label:'Courier'},
    {value:'"Kalam", "Comic Sans MS", cursive',label:'Handwriting'},
    {value:'"Nunito", "Trebuchet MS", sans-serif',label:'Kid Friendly'},
    {value:'"Permanent Marker", "Comic Sans MS", cursive',label:'Marker'}
  ];
  // "2 corrections for text object" — 1) a Delete option inside the
  // quick-edit popup ("under modify delete is also an option, add
  // that"); 2) from a Story-owned freeform text sticker's SECOND
  // selection onward, this popup (not the full right-panel editor) is
  // what a Story Author reaches — see refresh()'s own
  // _consumeStickerTextFirstEdition gate below. Mirrors
  // js/cardDesigner.js's own sticker Text group field-for-field (Words/
  // Font/Size/Weight/Style/Colour/Alignment/Width, plus the Rotation/
  // Opacity rows every sticker kind shares there) — same option lists,
  // same default fallback values, so a Story Author sees the identical
  // control language whichever surface reaches it; writes through
  // SceneEngine.updateSticker exactly like CardDesigner's own
  // _stickerUpdate, never setContentOverride's elementOverrides bag
  // (that bag is keyed for World-owned objects and isn't this object's
  // own storage at all).
  //
  // "remove the weights drop down. add bold, underline and strike
  // through styles" — the Weight dropdown (STICKER_TEXT_WEIGHT_OPTIONS)
  // is retired outright, matching the exact same trade the World-owned
  // Text popup already made ("weight is a very technical term, is that
  // drop down even needed?") — Bold folds into the Style row as one more
  // _makeMultiToggleRow toggle, sharing the same fontWeight field the
  // dropdown used to write ('700' on, '' off). Font Family is paired with
  // the newer Fill Style toggle instead (see below), not spanning alone.
  function _appendStickerTextEditControl(container,sceneObj){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.findSticker!=='function' || typeof SceneEngine.updateSticker!=='function') return false;
    const st=SceneEngine.findSticker(slide,sceneObj.id);
    if(!st) return false;
    const update=function(changes){
      SceneEngine.updateSticker(slide,sceneObj.id,changes);
      _afterQuickEditChange();
    };

    container.appendChild(_el('div','designer-row-label','Words'));
    const textarea=document.createElement('textarea');
    textarea.className='context-textarea';
    textarea.value=typeof st.text==='string'?st.text:'';
    textarea.addEventListener('input',function(){ update({text:textarea.value}); });
    container.appendChild((typeof EmojiPicker!=='undefined' && typeof EmojiPicker.wrap==='function') ? EmojiPicker.wrap(textarea) : textarea);

    container.appendChild(_el('div','designer-sublabel','Typography'));
    const familyCell=_makeSelectRow(null,'Font',STICKER_TEXT_FONT_OPTIONS,st.fontFamily||'',function(val){ update({fontFamily:val}); });
    // "geometric/faceted lettering" — the same Solid/Shapes Fill Style
    // toggle the World-owned Text popup got, mirrored here for a
    // Story-owned freeform text sticker; renderer/slideRenderer.js's
    // _drawFreeformText already reads st.shapeFill directly (a plain
    // instance field, no Engine Adapter/compile step involved for
    // Story-owned content).
    const fillStyleCell=_makeIconChoiceRow(null,'Fill Style',[['solid','Solid'],['shapes','Shapes']],st.shapeFill?'shapes':'solid',function(val){ update({shapeFill:val==='shapes'}); });
    _pairRow(container,familyCell,fillStyleCell);

    // Bold/Italic/Underline/Strikethrough — a multi-select toggle row
    // (any combination can be active at once), mirroring the World-owned
    // Text popup's own [['bold','B'],['italic','I'],['underline','U'],
    // ['strikethrough','S']] shape exactly. Bold shares the sticker's own
    // fontWeight field ('700' on, '' off — matching what the retired
    // Weight dropdown used to write); Italic keeps writing fontStyle as
    // 'italic'/'normal' (the exact stored shape this popup's own prior
    // single-select Style row already used, so an already-authored
    // sticker's fontStyle value keeps meaning the same thing); Underline/
    // Strikethrough are new plain boolean instance fields, drawn by
    // renderer/slideRenderer.js's _drawFreeformText.
    const styleState={bold:st.fontWeight==='700',italic:st.fontStyle==='italic',underline:!!st.underline,strikethrough:!!st.strikethrough};
    const styleCell=_makeMultiToggleRow(null,'Style',[['bold','B'],['italic','I'],['underline','U'],['strikethrough','S']],function(key){
      return styleState[key];
    },function(key){
      const next=!styleState[key];
      if(key==='bold') update({fontWeight:next?'700':''});
      else if(key==='italic') update({fontStyle:next?'italic':'normal'});
      else if(key==='underline') update({underline:next});
      else update({strikethrough:next});
      styleState[key]=next;
    });
    const alignCell=_makeIconChoiceRow(null,'Alignment',[['left','Left'],['center','Center'],['right','Right']],st.align||'center',function(val){ update({align:val}); });
    _pairRow(container,styleCell,alignCell);

    const sizeCell=_makeRangeRow(null,{
      labelText:'Font Size',min:16,max:140,step:1,
      value:(typeof st.fontSize==='number')?st.fontSize:44,
      format:function(n){ return Math.round(n)+'px'; },
      onInput:function(n){ update({fontSize:Math.round(n)}); }
    });
    const widthCell=_makeRangeRow(null,{
      labelText:'Width',min:120,max:1000,step:1,
      value:(typeof st.w==='number')?st.w:420,
      format:function(n){ return Math.round(n)+'px'; },
      onInput:function(n){ update({w:Math.round(n)}); }
    });
    _pairRow(container,sizeCell,widthCell);

    const colorCell=_makeColorRow(null,'Colour',st.color||'#1D3457',function(val){ update({color:val}); });
    const opacityCell=_makeRangeRow(null,{
      labelText:'See Through',min:0,max:1,step:0.01,
      value:(typeof st.opacity==='number')?st.opacity:1,
      format:function(n){ return Math.round(n*100)+'%'; },
      onInput:function(n){ update({opacity:Math.round(n*100)/100}); }
    });
    _pairRow(container,colorCell,opacityCell);

    const rotationCell=_makeRangeRow(null,{
      labelText:'Spin',min:-180,max:180,step:1,
      value:(typeof st.rotation==='number')?st.rotation:0,
      format:function(n){ return Math.round(n)+'°'; },
      onInput:function(n){ update({rotation:Math.round(n)}); }
    });
    const curveCell=_makeRangeRow(null,{
      labelText:'Curve',min:-180,max:180,step:1,
      value:(typeof st.curve==='number')?st.curve:0,
      format:function(n){ return Math.round(n)+'°'; },
      onInput:function(n){ update({curve:Math.round(n)}); }
    });
    _pairRow(container,rotationCell,curveCell);

    const delBtn=document.createElement('button');
    delBtn.type='button';
    delBtn.className='context-btn selection-quick-delete-btn';
    delBtn.textContent='🗑 Delete';
    delBtn.addEventListener('click',function(){
      SceneEngine.removeSticker(slide,sceneObj.id);
      if(typeof PageRuntime!=='undefined'){ try{ PageRuntime.clearSelection(); }catch(e){} }
      _afterQuickEditChange();
    });
    container.appendChild(delBtn);

    return true;
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
    _appendBackControl(panelRoot);
    _appendStatusPill(panelRoot,'🌍',sceneObj.editable?'Part of the World — you can adjust it':'Part of the World','world');
    const v=sceneObj.visual;
    const hasRealControl=sceneObj.editable && v && (v.kind==='color'||v.kind==='shape'||v.kind==='image'||v.kind==='text');
    // Direct product feedback after the Selection Action Strip shipped
    // its own inline popup reusing this exact control ("i like context
    // menu better"): showing the SAME live-editable field here too was
    // pure duplication — two independent DOM nodes bound to one
    // underlying value, with no reason to keep both live at once. When
    // the strip is loaded (the real, always-true case in this app —
    // gated defensively so a build missing the module still gets the
    // old inline control rather than a silent dead end), this panel now
    // shows only the status banner/hint and points at the strip's own
    // popup instead of mounting a second, redundant editing surface.
    const stripAvailable=typeof SelectionActionStrip!=='undefined';
    panelRoot.appendChild(_el('div','context-nothing-selected-hint',
      hasRealControl
        ? (stripAvailable
            ? 'This is part of the World — tap ✏️ Edit on the toolbar above the page to adjust it.'
            : 'This is part of the World — you can adjust it below.')
        : sceneObj.editable
          ? 'This is part of the World, but you may adjust it. That kind of edit isn’t available in Creator yet.'
          : 'This is part of the World.'
    ));
    if(hasRealControl && !stripAvailable) _appendWorldObjectEditControl(panelRoot,sceneObj,v);
    if(sceneObj.decorationSlot) _appendDecorationSlotButton(sceneObj);
    _renderPersonalizeZone(panelRoot,{full:personalizeExpanded});
  }

  // "2 corrections for text object" — the lightweight view a Story-owned
  // freeform text sticker's SECOND and later selections land on (its
  // first-ever selection still opens the full right-panel editor via
  // _renderSelectionHeading below, unchanged). Mirrors
  // _renderWorldObjectDisclosure's own banner/back/status/hint shape,
  // but never shows a Delete button here itself — that lives inside the
  // Selection Action Strip's own popup (_appendStickerTextEditControl),
  // matching this file's own already-established "one live control, not
  // two independent DOM nodes bound to the same value" rule. When the
  // strip isn't loaded at all (defensive — should not happen in
  // production), "Open Full Editor →" is still a real, always-reachable
  // escape hatch into the identical full editor a first-time selection
  // gets.
  function _renderStickerTextQuickEditPointer(sceneObj){
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    const banner=_el('div','context-panel-heading context-selection-banner');
    banner.appendChild(_el('span','context-selection-banner-icon','📝'));
    banner.appendChild(_el('span','context-selection-banner-label','Your Text'));
    panelRoot.appendChild(banner);
    _appendBackControl(panelRoot);
    _appendStatusPill(panelRoot,'✏️','You can edit this','editable');
    const stripAvailable=typeof SelectionActionStrip!=='undefined';
    panelRoot.appendChild(_el('div','context-nothing-selected-hint',
      stripAvailable
        ? 'You’ve already set this up once — tap ✏️ Edit on the toolbar above the page to make more changes, or open the full editor below.'
        : 'You’ve already set this up once — use the full editor below to make more changes.'
    ));
    const link=document.createElement('button');
    link.type='button';
    link.className='context-btn';
    link.textContent='Open Full Editor →';
    link.addEventListener('click',function(){
      _setTabVisible('card-tab');
      _setCardSections(['sticker']);
      _renderSelectionHeading('sticker');
    });
    panelRoot.appendChild(link);
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
    _appendBackControl(panelRoot);
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
      _storeUploadedAsset(result.dataURL,function(finalRef){
        if(!placeId){
          slide.image=img;
          slide._imageDataURL=finalRef;
        }else{
          if(!slide.metadata) slide.metadata={};
          if(!slide.metadata.placeContent) slide.metadata.placeContent={};
          if(!slide.metadata.placeContent[placeId]) slide.metadata.placeContent[placeId]={};
          slide.metadata.placeContent[placeId].dataURL=finalRef;
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
        // Companion Engine Foundation (Sprint C1) — "User inserts artwork".
        try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('artwork-added'); }catch(e){}
      });
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
    PictureStudio.open(source,{defaultMode:'fit',onApply:_applyImageResult,fallbackOwnerId:slide.recallOwnerId});
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
    _appendBackControl(panelRoot);
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

  // A real, user-reported bug: "i changed BG color it did not worked."
  // This control's own per-page override (slide.metadata.cardOverrides.
  // background) DOES win over the World's wall tone in the base canvas
  // fill -- but a World-authored, Scene-hosted "Background" object
  // (Builder's "Hosted by Scene" Colour Experience, converged onto the
  // theme's 'slide'-scoped Layer Pack) paints AFTER that base fill, as
  // part of the merged Scene Stack render -- so on any page with a real
  // Scene-hosted Background object (increasingly the normal case), this
  // swatch visibly did nothing: the World's own full-bleed fill always
  // painted right over it. When one exists, edit IT instead -- the same
  // World-object colour-edit mechanism Object Strip's own "Background"
  // card already uses (SceneEngine.setContentOverride) -- so this
  // control always changes what a Story Author actually sees change.
  function _sceneHostedBackgroundObject(){
    if(typeof PageRuntime==='undefined') return null;
    const list=(PageRuntime.getRenderedObjects().scene)||[];
    for(let i=0;i<list.length;i++){
      const o=list[i];
      if(o.owner==='world' && o.target==='slide' && o.visual && o.visual.kind==='color') return o;
    }
    return null;
  }
  function _appendBackground(container){
    const slide=_currentSlide();
    if(!slide) return;
    container.appendChild(_el('div','context-panel-heading','Page Background'));

    const hostedBg=_sceneHostedBackgroundObject();
    if(hostedBg){
      if(!hostedBg.editable || typeof SceneEngine==='undefined' || typeof SceneEngine.setContentOverride!=='function'){
        container.appendChild(_el('div','context-nothing-selected-hint',"This page's background comes from the World and can't be changed here."));
        return;
      }
      const row=_el('div','designer-row context-row');
      row.appendChild(_el('div','designer-row-label','Background Colour'));
      _appendColourKit(row,hostedBg.visual.color,function(val){
        SceneEngine.setContentOverride(slide,hostedBg.id,'fillColor',val);
        if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
        if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
        // BACKLOG.md item 4 (Performance) — this callback is wired to a
        // native <input type=color>'s own 'input' event (via
        // _appendColourKit -> buildColourKit's "Custom" swatch), which
        // fires continuously during interactive colour-picker dragging in
        // Chrome and similar browsers — the identical risk profile the
        // World-owned quick-edit popup's own Rotation slider already had,
        // confirmed and fixed via _afterQuickEditChange() above. Reuse the
        // same shared debounce rather than calling ObjectStrip.refresh()
        // unconditionally on every tick.
        _debouncedObjectStripRefresh();
      });
      container.appendChild(row);
      return;
    }

    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    const co=slide.metadata.cardOverrides;

    // BACKLOG Bug 6 — "Color and Image can co-exist in background. color
    // is always behind the image not in front." Colour and Image are no
    // longer a mutually-exclusive mode toggle — both controls always
    // render together, and renderer/slideRenderer.js's render(s) already
    // draws colour first, image on top of it (colour stays visible
    // wherever the image doesn't fully cover it, e.g. a rotated or
    // semi-transparent picture). co.backgroundMode is no longer written
    // here at all — it's a harmless, dead legacy field on any
    // already-saved project.
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label','Colour'));
    const existing=co.background;
    let fallback='#1D3461';
    try{
      if(typeof ThemeEngine!=='undefined'){
        const opts=ThemeEngine.getOptions();
        const theme=ThemeEngine.getActiveTheme();
        fallback=(opts.colours&&opts.colours.frame)||(theme&&theme.frame&&theme.frame.color)||fallback;
      }
    }catch(e){}
    _appendColourKit(row,existing||fallback,function(val){
      co.background=val;
      if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    });
    container.appendChild(row);

    _appendBackgroundImageControls(container,co);
  }

  // Picture — a genuinely uploaded picture covering the full page
  // background, cover-fit + optional rotation + optional opacity, drawn by
  // renderer/slideRenderer.js's _slideBackgroundImageOverride/
  // _drawSlideBackgroundImage. co.backgroundImage is {ref, rotation,
  // opacity} — absent entirely until a first upload succeeds. BACKLOG
  // Bug 6 — "the image uploaded need to pass through image studio and
  // also need to support all options which other images objects have
  // got": upload/replace and crop/rotate both now open the real Picture
  // Studio tool (js/pictureStudio.js), mirroring _replaceArtwork/
  // _cropRotateArtwork's own established pattern exactly, instead of a
  // raw FileReader with no editing step at all; Opacity joins the
  // existing Rotation slider, matching the Opacity control every other
  // image-kind object in this app (a Sticker's own image content,
  // World-owned Decoration images) already has.
  function _applyBackgroundImageResult(result){
    const slide=_currentSlide();
    if(!slide || !result) return;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    const co=slide.metadata.cardOverrides;
    const prevBg=co.backgroundImage;
    _storeUploadedAsset(result.dataURL,function(finalRef){
      co.backgroundImage={
        ref:finalRef,
        rotation:(prevBg&&typeof prevBg.rotation==='number')?prevBg.rotation:0,
        opacity:(prevBg&&typeof prevBg.opacity==='number')?prevBg.opacity:1
      };
      if(host){
        if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
        if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
      }
      refresh();
    });
  }

  function _appendBackgroundImageControls(container,co){
    const bg=co.backgroundImage||null;

    container.appendChild(_el('div','designer-row-label','Picture'));

    // .context-action-row (not .designer-row, which is a flex COLUMN) —
    // mirrors _renderArtworkActions' own established Replace/Crop-Rotate
    // button-row precedent exactly, so Upload/Replace and Crop/Rotate sit
    // side by side rather than stacking vertically.
    const btnRow=_el('div','context-action-row');
    const uploadBtn=_el('button','context-btn',bg&&bg.ref?'🖼️ Replace Picture':'🖼️ Upload Picture');
    uploadBtn.type='button';
    uploadBtn.addEventListener('click',function(){
      const fileInput=document.createElement('input');
      fileInput.type='file';
      fileInput.accept='image/*';
      fileInput.addEventListener('change',function(){
        const file=fileInput.files && fileInput.files[0];
        if(!file || typeof PictureStudio==='undefined') return;
        PictureStudio.open(file,{defaultMode:'fill',onApply:_applyBackgroundImageResult});
      });
      fileInput.click();
    });
    btnRow.appendChild(uploadBtn);

    if(bg&&bg.ref){
      const cropBtn=_el('button','context-btn','✂️ Crop / Rotate');
      cropBtn.type='button';
      cropBtn.addEventListener('click',function(){
        if(typeof PictureStudio==='undefined') return;
        const slide=_currentSlide();
        // Mirrors _cropRotateArtwork's own established pattern exactly —
        // bg.ref is an EXISTING reference (unlike Upload's fresh File,
        // which has no owner concept at all), so it needs the same
        // cross-owner recall fallback every other "re-open an already-
        // uploaded picture" call site in this file already passes.
        PictureStudio.open(bg.ref,{defaultMode:'fill',onApply:_applyBackgroundImageResult,fallbackOwnerId:slide&&slide.recallOwnerId});
      });
      btnRow.appendChild(cropBtn);
    }
    container.appendChild(btnRow);

    if(bg&&bg.ref){
      _makeRangeRow(container,{
        labelText:'Rotation',min:0,max:359,step:1,
        value:(typeof bg.rotation==='number')?bg.rotation:0,
        format:function(v){ return Math.round(v)+'°'; },
        onInput:function(v){
          bg.rotation=v;
          if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
          if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
        }
      });
      _makeRangeRow(container,{
        labelText:'Opacity',min:0,max:100,step:1,
        value:Math.round(((typeof bg.opacity==='number')?bg.opacity:1)*100),
        format:function(v){ return Math.round(v)+'%'; },
        onInput:function(v){
          bg.opacity=v/100;
          if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
          if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
        }
      });

      const removeRow=_el('div','designer-row context-row');
      const removeBtn=_el('button','context-btn context-btn-danger','✕ Remove Picture');
      removeBtn.type='button';
      removeBtn.addEventListener('click',function(){
        co.backgroundImage=null;
        if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
        if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
        refresh();
      });
      removeRow.appendChild(removeBtn);
      container.appendChild(removeRow);
    }else{
      container.appendChild(_el('div','context-nothing-selected-hint','Upload a picture to layer on top of the colour above.'));
    }
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

  // Real Vector Shapes — "outline shapes, geometry shapes, free style
  // shapes." A real geometry picker, deliberately separate from the
  // combined emoji-glyph "Stickers, Decorations & Shapes" row above —
  // real vector geometry (fill/outline/opacity, resolved through
  // renderer/slideRenderer.js's _layerDrawShape) is a different
  // capability from an emoji glyph, mirroring World Builder's own
  // established UX precedent of two parallel grids: an emoji-glyph
  // picker and a separate "Add a Shape" tile grid. Picking a preset
  // creates the shape instance immediately and selects it — window.
  // setSelectedSceneElement already ends in PageRuntime.notify() (js/
  // app.js's own _setSelectedSceneElement), which rebuilds this panel
  // into the new Shape's own Refine panel — no separate refresh() call
  // needed.
  function _showShapePicker(){
    stickerStudioOpen=true;
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    panelRoot.appendChild(_el('div','context-shape-picker-heading','🔺 Pick a Shape'));
    const grid=_el('div','context-shape-picker-grid');
    const kinds=(typeof StickerLibrary!=='undefined' && StickerLibrary.SHAPE_KINDS) ? StickerLibrary.SHAPE_KINDS : [];
    kinds.forEach(function(k){
      const tile=_el('button','context-shape-tile');
      tile.type='button';
      tile.appendChild(_el('span','context-shape-tile-icon',k.icon));
      tile.appendChild(_el('span','context-shape-tile-label',k.label));
      tile.addEventListener('click',function(){ _addShapeObject(k.value); });
      grid.appendChild(tile);
    });
    panelRoot.appendChild(grid);
    const btn=_el('button','context-btn','← Done Adding Shapes');
    btn.type='button';
    btn.addEventListener('click',function(){ refresh(); });
    panelRoot.appendChild(btn);
  }
  function _addShapeObject(shapeId){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    // addSticker's own guard requires a truthy stickerId (a catalog
    // reference) — never touched by SlideRenderer's kind:'shape' draw
    // path, but needed here to satisfy that pre-existing check without
    // any SceneEngine change.
    const st=SceneEngine.addSticker(slide,{
      kind:'shape', shape:shapeId, stickerId:'shape.'+shapeId,
      fillColor:'#F0B429', strokeColor:'#24406B', strokeWidth:0,
      fillOpacity:1, strokeOpacity:1,
      w:240, h:240
    });
    if(!st) return;
    if(typeof window.setSelectedSceneElement==='function'){
      try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
    }
  }

  // Freeform Text — "text should support all text related options. nice
  // kid friendly font... something which resemble handwriting fonts."
  // The exact capability the old "Note" row's own code comment disclosed
  // as not-yet-buildable ("no freeform text-object array... stubbed
  // honestly as Coming Soon"); now real. Same immediate-create-and-
  // select flow as Shapes above, landing on the new Text object's own
  // Refine panel (Words/Font/Size/Weight/Style/Colour/Alignment/Width)
  // ready for a child to type into.
  function _addTextObject(){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    // Same synthetic-stickerId reasoning as _addShapeObject above.
    const st=SceneEngine.addSticker(slide,{
      kind:'text', stickerId:'text.freeform', text:'New text',
      fontFamily:'', fontSize:44, fontWeight:'', fontStyle:'normal',
      color:'#1D3457', align:'center', w:420
    });
    if(!st) return;
    if(typeof window.setSelectedSceneElement==='function'){
      try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
    }
  }

  // Doodle — "draw your own is just filling shape, it does not allow you
  // to draw irregular shape... this has potential to become doodle. the
  // doodle implementation should live in doodle." A genuinely separate
  // capability from Shapes' own "Draw Your Own" custom path (which stays
  // a single closed, fillable silhouette) — Doodle is a real multi-
  // stroke freehand drawing object, reachable from its own Add Something
  // row, closing the gap that row's old Coming Soon stub disclosed. Same
  // immediate-create-and-select flow as Shapes/Text above, landing on
  // the new Doodle's own Refine panel (a blank pad, ready to draw on).
  function _addDoodleObject(){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    // Same synthetic-stickerId reasoning as _addShapeObject/_addTextObject.
    const st=SceneEngine.addSticker(slide,{
      kind:'doodle', stickerId:'doodle.freeform', strokes:[],
      w:320, h:320
    });
    if(!st) return;
    if(typeof window.setSelectedSceneElement==='function'){
      try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
    }
  }

  // Add Image — the remaining piece of "Under add category for images":
  // a genuinely new, freestanding picture the Story Author uploads from
  // their OWN device, distinct from "From This World" below (which
  // sources art the Theme Author already flagged in the World's own
  // Collection registry). Reuses the exact hidden-file-input/FileReader/
  // _storeUploadedAsset chain _appendWorldObjectEditControl's own Replace
  // Image control already established, so an upload here is durably
  // stored (vihu-asset:) the identical way every other picture upload in
  // this app already is. Lands on an ordinary kind:'image' sticker's
  // Refine panel — Position/Size/Rotation/Opacity/Lock/Duplicate/Delete —
  // exactly like a Collection-sourced picture's own panel, since the
  // picture itself is real artwork with nothing further to configure.
  function _addImageObject(){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    const fileInput=document.createElement('input');
    fileInput.type='file';
    fileInput.accept='image/*';
    fileInput.addEventListener('change',function(){
      const file=fileInput.files && fileInput.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload=function(){
        _storeUploadedAsset(reader.result,function(finalRef){
          // Same synthetic-stickerId reasoning as _addShapeObject/
          // _addTextObject/_addDoodleObject above — a fixed literal is
          // fine since instance identity comes from st.id, not stickerId,
          // and several freestanding photos may coexist on one page.
          const st=SceneEngine.addSticker(slide,{
            kind:'image', image:finalRef, stickerId:'image.upload',
            w:320, h:320
          });
          if(!st) return;
          if(typeof window.setSelectedSceneElement==='function'){
            try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
          }
        });
      };
      reader.readAsDataURL(file);
    });
    fileInput.click();
  }

  // Collection ("From This World") — Collection Phase 6. A Theme Author
  // may flag a Collection asset availableToCreator:true in World Builder
  // ("collection can have assets which are used in scenes and others
  // which builder would want creator to have access for customization" —
  // the user's own words); Phase 5 already compiles exactly those
  // flagged entries into the published Theme's own theme.collectionAssets
  // (id/name/kind/relPath, sanitized — never the internal Builder-
  // session .ref) with the real bytes guaranteed embedded regardless of
  // Scene usage. This resolves the CURRENTLY ACTIVE World/Story theme's
  // own array — Artwork Theme first (a World, the common case for this
  // feature), falling back to the Story Theme, mirroring the exact
  // artworkId||storyId precedent js/app.js's own _updateHeaderContext()
  // already established for "which theme is this Story actually using
  // right now."
  function _activeCollectionAssets(){
    try{
      if(typeof ThemeEngine==='undefined' || typeof ThemeRegistry==='undefined') return [];
      const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
      const storyId=ThemeEngine.getActiveThemeId && ThemeEngine.getActiveThemeId();
      const themeId=artworkId||storyId;
      if(!themeId) return [];
      const theme=ThemeRegistry.get(themeId);
      if(!theme || !Array.isArray(theme.collectionAssets)) return [];
      return theme.collectionAssets
        .filter(function(e){ return e && e.availableToCreator===true && e.relPath; })
        .map(function(e){ return {id:e.id,name:e.name||'Picture',kind:e.kind||'image',relPath:e.relPath,themeId:themeId}; });
    }catch(e){ return []; }
  }

  // "add new," per the user's own answered design fork ("Both" — ship
  // this first, defer "swap an existing World-owned object's art" to its
  // own later phase). Mirrors _showShapePicker's exact shape: a full-
  // panel-replacing tile grid with a "← Done" exit, each tile a real
  // resolved thumbnail (via ThemeRegistry.resolveAssetRef, the same
  // synchronous resolver every other Creator-side World-asset read
  // already uses — Scene Decoration images, World Card art,
  // Representation thumbnails, Theme Library cards) rather than a
  // generic icon, since the whole point is showing the Theme Author's
  // own real artwork.
  //
  // REVISITED per direct product feedback ("we have enough space.
  // maximize space usage so maximum assets can be seen at a time"): the
  // fixed-height horizontal-scroll-strip redesign that preceded this one
  // (mirroring js/objectStrip.js's own pattern) traded away visible real
  // estate for a bounded height — the right call for the Object Strip,
  // which sits beside a fixed canvas, but the wrong call for a picker
  // whose whole job is "browse everything this World offers." Reworked
  // into a wrapping, auto-fill grid instead (mirroring Sticker Studio's
  // own already-proven .sticker-studio-grid pattern, css/style.css:
  // "repeat(auto-fill,minmax(Npx,1fr))") that fills the full width of
  // the right sidebar and wraps into as many rows as needed — no per-
  // picker scroll container or arrow buttons at all. .right-sidebar
  // already scrolls (overflow-y:auto), the same safety net every other
  // growing Context Panel section already relies on, so a large
  // Collection simply makes the whole sidebar a little taller to scroll
  // through, never forcing a second, nested scroll region. Entries are
  // grouped by kind — Images / Graphics, the only two kinds
  // registerCollectionAsset ever produces (confirmed via a repo-wide
  // grep) — into two labelled sections, so a World's Collection reads
  // as organized rather than one mixed pile.
  function _collectionGroupLabel(kind){
    return kind==='graphic' ? '🎭 Graphics' : '🖼️ Images';
  }
  function _buildCollectionTile(entry){
    const tile=_el('button','context-collection-tile');
    tile.type='button';
    let src=entry.relPath;
    if(typeof ThemeRegistry!=='undefined' && typeof ThemeRegistry.resolveAssetRef==='function'){
      try{ src=ThemeRegistry.resolveAssetRef(entry.themeId,entry.relPath)||entry.relPath; }catch(e){}
    }
    const thumb=_el('span','context-collection-tile-thumb');
    const img=document.createElement('img');
    img.src=src;
    img.alt=entry.name;
    thumb.appendChild(img);
    tile.appendChild(thumb);
    tile.appendChild(_el('span','context-collection-tile-label',entry.name));
    tile.addEventListener('click',function(){ _addCollectionObject(entry); });
    return tile;
  }
  function _showCollectionPicker(){
    stickerStudioOpen=true;
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    panelRoot.appendChild(_el('div','context-collection-picker-heading','🎁 From This World'));

    const groups={};
    _activeCollectionAssets().forEach(function(entry){
      const key=entry.kind==='graphic' ? 'graphic' : 'image';
      if(!groups[key]) groups[key]=[];
      groups[key].push(entry);
    });
    ['image','graphic'].forEach(function(key){
      const entries=groups[key];
      if(!entries || !entries.length) return;
      panelRoot.appendChild(_el('div','context-collection-group-label',_collectionGroupLabel(key)+' ('+entries.length+')'));
      const grid=_el('div','context-collection-picker-grid');
      entries.forEach(function(entry){ grid.appendChild(_buildCollectionTile(entry)); });
      panelRoot.appendChild(grid);
    });

    const btn=_el('button','context-btn','← Done Browsing');
    btn.type='button';
    btn.addEventListener('click',function(){ refresh(); });
    panelRoot.appendChild(btn);
  }
  // Same immediate-create-and-select flow as _addShapeObject/_addTextObject/
  // _addDoodleObject above — a real, ordinary Story-owned Decoration
  // sticker (kind:'image'), landing on its own Refine panel with nothing
  // beyond Position/Size/Rotation/Opacity/Lock/Duplicate/Delete, since
  // this kind carries real artwork rather than a vector/text/stroke
  // payload to further configure. entry.relPath (never a raw vihu-asset:/
  // data: reference) is resolved live at render time through whichever
  // Theme is active — see renderer/slideRenderer.js's _drawStickerImage.
  function _addCollectionObject(entry){
    const slide=_currentSlide();
    if(!slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    const st=SceneEngine.addSticker(slide,{
      kind:'image', image:entry.relPath, stickerId:'collection.'+entry.id,
      w:320, h:320
    });
    if(!st) return;
    if(typeof window.setSelectedSceneElement==='function'){
      try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
    }
  }

  // ---------- Right Panel Redesign — Personalize zone ----------

  // "+ Add Something"'s rows. Stickers/Decorations are, today, the exact
  // same underlying capability — SceneEngine.addSticker via Sticker
  // Studio — and Sticker Studio's own category tab strip already gives
  // full reach across every category (Characters/Decorations/etc.) once
  // it's open, so one combined entry point is enough — no pre-filtering
  // into a specific category. Shapes, Text, and Doodle are real, separate
  // capabilities (see _showShapePicker/_addTextObject/_addDoodleObject
  // above). An earlier "Photo" row was removed once — it duplicated the
  // per-Place "Add Artwork" flow (filling the Scene's own Artwork Place),
  // which is where THAT kind of artwork replacement belongs. "Photo" here
  // is a genuinely different capability, added for a later request's own
  // "Under add category for images": a real, freestanding, ordinary
  // Story-owned kind:'image' Decoration object the Story Author uploads
  // from their own device (see _addImageObject above), grouped right
  // beside "From This World" (Collection Phase 6, a World's own
  // Theme-Author-flagged assets) so the two image-sourcing options read
  // as one category, per that request's own framing. "From This World"
  // only appears when the active Theme actually has at least one
  // availableToCreator Collection asset — never an empty, confusing
  // picker, matching this codebase's own established discipline for a
  // conditional row (e.g. the Caption tile's own actions-gated presence).
  // Voice has no supporting SceneEngine/renderer capability today (no
  // audio attachment) — stubbed honestly as Coming Soon rather than
  // faked.
  function _addSomethingItems(){
    const items=[
      {id:'stickers',icon:'😀',label:'Emojis',onClick:function(){ _showStickerStudio(); }},
      {id:'shapes',icon:'🔺',label:'Shapes',onClick:function(){ _showShapePicker(); }},
      {id:'text',icon:'🅰️',label:'Text',onClick:function(){ _addTextObject(); }},
      {id:'doodle',icon:'✏️',label:'Doodle',onClick:function(){ _addDoodleObject(); }},
      {id:'photo',icon:'🖼️',label:'Photo',onClick:function(){ _addImageObject(); }}
    ];
    if(_activeCollectionAssets().length>0){
      items.push({id:'fromWorld',icon:'🎁',label:'From This World',onClick:function(){ _showCollectionPicker(); }});
    }
    items.push({id:'voice',icon:'🎤',label:'Voice',comingSoon:true});
    return items;
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
      // "organise this better" — a stacked list of full-width rows read
      // cluttered and gave every item (including the disabled Voice row)
      // equal visual weight. Reorganized into a compact icon-card grid,
      // mirroring the same .icon-card language the Shape picker/Draw
      // Tool row already use elsewhere in this panel, so a real
      // capability (Stickers/Shapes/Text/Doodle) reads as a tappable
      // card and "Soon" reads as a clearly separate, muted state.
      const list=_el('div','context-add-grid');
      _addSomethingItems().forEach(function(item){
        const row=_el('button','context-add-card'+(item.comingSoon?' is-coming-soon':''));
        row.type='button';
        const iconWrap=_el('span','context-add-card-icon',item.icon);
        row.appendChild(iconWrap);
        row.appendChild(_el('span','context-add-card-label',item.label));
        if(item.comingSoon){
          row.appendChild(_el('span','context-add-card-soon','Soon'));
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

  // Background — reuses _appendBackground's own field-building body
  // verbatim (unchanged internals, same per-page override), now only
  // rendered while its own accordion body is open instead of always-
  // rendered. BACKLOG Bug 6 — renamed from "Background Colour" since
  // Colour and Image now coexist in this one section, never one or the
  // other.
  function _buildBackgroundTile(){
    const wrap=_el('div','context-set-tile');
    const trigger=_el('button','context-set-trigger');
    trigger.type='button';
    trigger.appendChild(_el('span','context-set-trigger-label','🎨 Background'));
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
    // Creator Acceptance Sprint / Right Panel Redesign — the panel used
    // to open with a "Welcome to <icon> <World Name>" greeting here;
    // "what i meant is that welcome string in the right pane of studio
    // is not needed. we can remove it" — dropped outright, not replaced.
    // Personalize itself (below) already teaches what's addable/
    // settable, so the standalone ownership legend and "tap anything"
    // hint stay dropped too, in favour of each object's own Status pill
    // doing that teaching contextually once something is selected.
    _appendBackControl(panelRoot);
    _renderPersonalizeZone(panelRoot,{full:true});
  }

  return {
    configure:configure,
    init:init,
    refresh:refresh,
    mountQuickEditControl:mountQuickEditControl
  };
})();
try{ window.ContextPanel=ContextPanel; }catch(e){}
