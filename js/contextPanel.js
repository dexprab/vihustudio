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
  // A page's own background wants a different set of colours from a pen
  // or a letter. The shared kit's default palette is built for MARKS —
  // strong reds, blacks, saturated blues, which are right for text and
  // drawing and wrong behind a whole page, where they leave a child
  // nowhere to put anything. These are skies and grounds: five pastels
  // to sit behind a story, four deep tones for night and earth. Anything
  // else is still one tap away on the kit's own custom picker.
  //
  // Deliberately passed only at the background call sites, not changed
  // globally — every other control keeps the palette it needs.
  const BACKGROUND_PALETTE=['#BFE3F7','#FBC9B6','#B9ECC8','#FCE8A8','#DCC6F7',
                            '#1E2F5E','#7C5CE0','#1F7A45','#A06A3A'];

  function _appendColourKit(row,colorValue,onInput,palette){
    if(typeof window.CardDesigner!=='undefined' && typeof window.CardDesigner.buildColourKit==='function'){
      window.CardDesigner.buildColourKit(row,{
        value:_safeColor(colorValue),
        palette:palette||undefined,
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

  // --- Spatial controls: 8-way nudge pad + 360° rotation dial -------
  //
  // "whenever there is a moveable flag true with any object i need the
  // 8 direction mover like we did in builder along with 360 degree
  // rotation spinner."
  //
  // THE PAD is a faithful port of World Builder v2's own _v2NudgePad
  // (tools/world-builder-v2/js/worldBuilderApp.js) — same circular
  // geometry, same press-and-hold repeat, and the same deliberate
  // "dumb, reusable input surface" contract: it only ever emits (dx,dy)
  // unit steps and the CALLER decides what a step means. Ported rather
  // than shared, matching this codebase's own established Studio-vs-
  // Builder twin-file discipline (the two have no common module, and
  // Builder's own copy stays untouched).
  //
  // THE DIAL is genuinely new. Builder has no rotation dial at all —
  // rotation there, and everywhere in Studio until now, is a plain
  // range slider. A round dial pairs with the round pad and reads as
  // one continuous turn of the object rather than a linear track.
  //
  // Until this, root Studio had NO position control of any kind: every
  // object was drag-only (js/app.js's own move/resize gestures), with
  // arrow-key nudge existing solely for Story stickers and Story Theme
  // text. So this is the first reachable "move it a precise step"
  // surface in Studio, not a restyle of an existing one.

  // ONE widget, two gestures — the product owner asked for the Move pad
  // and the Spin dial combined ("we can combine spin and move panel into
  // one"), so the 8 direction buttons now ring a Spin disc nested at the
  // widget's own centre rather than sitting in a separate row above it.
  // Geometry is expressed in PERCENTAGES of the pad rather than fixed
  // pixels: the Selection Action Strip sizes itself to whatever gutter
  // room it finds (MIN_USABLE 160px, js/selectionActionStrip.js), so a
  // fixed-px widget could overflow the narrowest popup. The pad caps at
  // COMBO_PAD_PX but shrinks with the strip, and every child rides along.
  const NUDGE_HOLD_DELAY_MS=350;   // pause before auto-repeat kicks in
  const NUDGE_HOLD_REPEAT_MS=80;   // then ~12 steps/sec while held
  const COMBO_PAD_PX=150;          // widget diameter cap — matches the CSS
  const NUDGE_BTN_PX=28;           // direction-button diameter
  // Orbit radius as a fraction of the pad: half the pad, less half a
  // button, less a 4px rim gap. Everything below is derived from it, so
  // changing COMBO_PAD_PX/NUDGE_BTN_PX keeps the ring self-consistent.
  const NUDGE_ORBIT_PCT=((COMBO_PAD_PX/2-NUDGE_BTN_PX/2-4)/COMBO_PAD_PX)*100;
  // One step, in absolute canvas pixels. Position everywhere in Studio
  // is an absolute canvas-pixel CENTRE point (unlike Builder, whose own
  // pad works in 0..1 fractions), so the step is a pixel count rather
  // than a percentage. ~1% of the 1080-wide default canvas.
  const NUDGE_STEP_PX=10;
  const NUDGE_DIRS=[
    ['↖',-1,-1,'Nudge up-left'],
    ['↑',0,-1,'Nudge up'],
    ['↗',1,-1,'Nudge up-right'],
    ['←',-1,0,'Nudge left'],
    ['→',1,0,'Nudge right'],
    ['↙',-1,1,'Nudge down-left'],
    ['↓',0,1,'Nudge down'],
    ['↘',1,1,'Nudge down-right']
  ];

  function _makeNudgePad(onNudge){
    const pad=_el('div','nudge-pad');
    // Press-and-hold driver. The first step fires synchronously on
    // pointerdown (so a plain tap still nudges exactly once), then a
    // delay + interval keeps firing while held. Pointer capture
    // guarantees the matching pointerup/pointercancel always lands on
    // this button, so the interval can never leak.
    function wireHold(btn,fire){
      let delayT=null,repT=null;
      function stop(){
        if(delayT){ clearTimeout(delayT); delayT=null; }
        if(repT){ clearInterval(repT); repT=null; }
      }
      btn.addEventListener('pointerdown',function(e){
        e.preventDefault();
        try{ btn.setPointerCapture(e.pointerId); }catch(err){ /* older engines — repeat still stops on pointerup */ }
        fire();
        delayT=setTimeout(function(){ repT=setInterval(fire,NUDGE_HOLD_REPEAT_MS); },NUDGE_HOLD_DELAY_MS);
      });
      ['pointerup','pointercancel','lostpointercapture'].forEach(function(ev){
        btn.addEventListener(ev,stop);
      });
      // Keyboard activation (Enter/Space) arrives as a click with
      // detail 0 and no pointer sequence — fire one step so the pad
      // stays keyboard-reachable. A pointer-driven click has detail ≥ 1
      // and already fired on pointerdown, so it's ignored here (never a
      // double step per tap).
      btn.addEventListener('click',function(e){ if(e.detail===0) fire(); });
    }
    NUDGE_DIRS.forEach(function(cell){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='nudge-btn';
      btn.textContent=cell[0];
      btn.title=cell[3]+' — hold to keep moving';
      // A bare arrow glyph announces as nothing useful; the dial next to
      // it already carries role/aria-valuenow, so the pad names itself
      // the same way rather than leaving one half of the pair unlabelled.
      btn.setAttribute('aria-label',cell[3]);
      // Normalize (dx,dy) so the diagonals sit at the same distance
      // from centre as the cardinals (a raw 3×3 grid would push them
      // √2 out).
      const len=Math.sqrt(cell[1]*cell[1]+cell[2]*cell[2]);
      // Percentage placement (with a -50%/-50% translate in CSS) so the
      // ring scales with the pad instead of pinning to a fixed diameter.
      btn.style.left=(50+(cell[1]/len)*NUDGE_ORBIT_PCT)+'%';
      btn.style.top=(50+(cell[2]/len)*NUDGE_ORBIT_PCT)+'%';
      wireHold(btn,function(){ onNudge(cell[1],cell[2]); });
      pad.appendChild(btn);
    });
    return pad;
  }

  function _makeCenterButton(onCenter,centerTitle){
    const center=document.createElement('button');
    center.type='button';
    center.className='nudge-btn nudge-center';
    center.textContent='⊙';
    center.title=centerTitle||'Put it back';
    center.setAttribute('aria-label',centerTitle||'Put it back');
    // Centre is a one-shot reset — no hold-to-repeat (repeating a reset
    // is meaningless), a plain click is the whole gesture. It sits ON the
    // Spin disc now, so its own pointerdown must not also start a rotate
    // drag; the dial's handler is on the dial itself, so stopping
    // propagation here is the whole guard.
    center.addEventListener('pointerdown',function(e){ e.stopPropagation(); });
    center.addEventListener('click',function(e){ e.stopPropagation(); onCenter(); });
    return center;
  }

  // Dial geometry, also as fractions of its own box. The dial nests
  // inside the ring, so its diameter is whatever the buttons' inner
  // edge leaves, less a small breathing gap.
  const DIAL_PCT_OF_PAD=((COMBO_PAD_PX/2-NUDGE_BTN_PX-8)*2/COMBO_PAD_PX)*100;
  const DIAL_HANDLE_PX=18;

  // Every rotation write in Studio is plain degrees, but the existing
  // controls disagree on range (−180..180 for World objects and Story
  // stickers, 0..359 for Places and V2 layers). A dial has no ends, so
  // it normalizes to 0..359 for display and writes the same — visually
  // identical, since an angle is the same mod 360 (270° === −90°).
  function _normDeg(v){
    let n=Number(v);
    if(!isFinite(n)) n=0;
    n=n%360;
    if(n<0) n+=360;
    return Math.round(n);
  }

  // Builds the Spin disc alone (no row, no label) so it can be nested at
  // the centre of the Move ring. Reports its own reading back through
  // opts.onDisplay so the shared label above the widget stays in sync.
  // opts: {value, onInput(deg), onDisplay(deg)}
  function _makeDial(opts){
    const dial=_el('div','rot-dial');
    // Announced as a real slider so the dial is reachable and readable
    // without a pointer — the pad is keyboard-reachable too, so neither
    // control is pointer-only.
    dial.setAttribute('role','slider');
    dial.setAttribute('tabindex','0');
    dial.setAttribute('aria-label','Spin');
    dial.setAttribute('aria-valuemin','0');
    dial.setAttribute('aria-valuemax','359');
    const needle=_el('div','rot-dial-needle');
    const handle=_el('div','rot-dial-handle');
    dial.appendChild(needle);
    dial.appendChild(handle);

    let cur=_normDeg(opts.value);
    function place(){
      // 0° is up (12 o'clock) and grows clockwise — the same sense a
      // positive canvas rotate() turns, so the handle's position always
      // matches which way the object actually ends up facing. Placed in
      // percentages of the dial's own box, like the ring above it, so
      // the whole widget scales as one.
      const rad=(cur-90)*Math.PI/180;
      const rPct=50-((DIAL_HANDLE_PX/2+3)/(COMBO_PAD_PX*DIAL_PCT_OF_PAD/100))*100;
      handle.style.left=(50+Math.cos(rad)*rPct)+'%';
      handle.style.top=(50+Math.sin(rad)*rPct)+'%';
      needle.style.transform='rotate('+cur+'deg)';
      dial.setAttribute('aria-valuenow',String(cur));
      if(typeof opts.onDisplay==='function') opts.onDisplay(cur);
    }
    function commit(v){
      cur=_normDeg(v);
      place();
      if(typeof opts.onInput==='function') opts.onInput(cur);
    }
    function angleFromEvent(e){
      const rect=dial.getBoundingClientRect();
      const dx=e.clientX-(rect.left+rect.width/2);
      const dy=e.clientY-(rect.top+rect.height/2);
      // atan2 measures from the +x axis; +90 rotates the origin to 12
      // o'clock so the reading matches the handle's own convention.
      return _normDeg(Math.atan2(dy,dx)*180/Math.PI+90);
    }
    let dragging=false;
    dial.addEventListener('pointerdown',function(e){
      e.preventDefault();
      dragging=true;
      try{ dial.setPointerCapture(e.pointerId); }catch(err){ /* release still lands via pointerup */ }
      commit(angleFromEvent(e));
    });
    dial.addEventListener('pointermove',function(e){
      if(!dragging) return;
      commit(angleFromEvent(e));
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(ev){
      dial.addEventListener(ev,function(){ dragging=false; });
    });
    dial.addEventListener('keydown',function(e){
      const step=e.shiftKey?10:1;
      if(e.key==='ArrowRight'||e.key==='ArrowUp'){ e.preventDefault(); commit(cur+step); }
      else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){ e.preventDefault(); commit(cur-step); }
      else if(e.key==='Home'){ e.preventDefault(); commit(0); }
    });
    place();
    return dial;
  }

  // The whole thing, assembled: a Move ring of 8 direction buttons with a
  // Spin disc nested at its centre, and the "put it back" reset sitting
  // on the disc's own hub. One widget, two gestures — tap or hold an
  // arrow to move, drag around the middle to turn.
  // opts: {onNudge(dx,dy), onCenter(), resetTitle, canRotate, rotValue,
  //        onRot(deg)}
  function _makeSpatialWidget(parent,opts){
    const row=_el('div','designer-row context-row context-spatial-row');
    const lbl=_el('div','designer-row-label text-slider-label');
    lbl.appendChild(_el('span',null,opts.canRotate?'Move & Spin':'Move'));
    const val=opts.canRotate?_el('span','context-range-value',_normDeg(opts.rotValue)+'°'):null;
    if(val) lbl.appendChild(val);
    row.appendChild(lbl);

    const pad=_makeNudgePad(opts.onNudge);
    const center=_makeCenterButton(opts.onCenter,opts.resetTitle);
    if(opts.canRotate){
      const dial=_makeDial({
        value:opts.rotValue,
        onInput:opts.onRot,
        onDisplay:function(deg){ if(val) val.textContent=deg+'°'; }
      });
      // The hub lives on the disc so a kid's thumb lands on one place to
      // reset, right where the turn gesture already centres.
      dial.appendChild(center);
      pad.appendChild(dial);
    }else{
      // Nothing to spin (a full-bleed colour fill has no orientation, a
      // non-rotatable Place is guardrailed off) — the ring keeps its own
      // hub and no disc is rendered at all.
      pad.appendChild(center);
    }
    row.appendChild(pad);

    const legend=_el('div','spatial-legend');
    legend.appendChild(_el('span',null,'Tap the arrows to move'));
    if(opts.canRotate) legend.appendChild(_el('span',null,'Drag around the middle to spin'));
    row.appendChild(legend);

    if(parent) parent.appendChild(row);
    return row;
  }

  function _canvasSize(slide){
    try{
      if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getCanvasSize==='function'){
        const sz=SlideRenderer.getCanvasSize(slide);
        if(sz && sz.w && sz.h) return sz;
      }
    }catch(e){}
    return {w:1080,h:1350};
  }

  // One adapter per object kind, because position and rotation live in
  // genuinely different bags depending on who owns the object — this is
  // the same dispatch js/app.js's own drag handler already makes
  // (`elementType==='sticker'` → updateSticker, else setPosition), kept
  // in one place here rather than re-derived per control.
  //
  //   Story sticker  → instance fields on slide.metadata.stickers[]
  //                    (SceneEngine.updateSticker)
  //   Everything else → slide.metadata.elementOverrides[id]
  //                    (SceneEngine.setPosition / setRotation), except a
  //                    Place's rotation, which uses setContentOverride
  //                    (its own established 0..359 convention, and the
  //                    one the renderer's permission-gated
  //                    _resolvePlaceRotation reads back).
  //
  // Returns null when there is nothing to offer — the caller then mounts
  // nothing rather than a dead control.
  function _spatialAdapter(slide,sceneObj){
    if(!slide || !sceneObj || !sceneObj.moveable) return null;
    if(typeof SceneEngine==='undefined') return null;
    const cv=_canvasSize(slide);
    const isPlace=!!sceneObj.isPlace;
    const isStorySticker=(!isPlace && sceneObj.owner!=='world' && sceneObj.type==='sticker');

    if(isStorySticker){
      if(typeof SceneEngine.findSticker!=='function' || typeof SceneEngine.updateSticker!=='function') return null;
      const st=SceneEngine.findSticker(slide,sceneObj.id);
      if(!st) return null;
      return {
        // Every Story-sticker draw path already reads st.rotation
        // (glyph/shape/text/doodle/image/voice alike), so the dial is
        // real for all of them.
        canRotate:true,
        getPos:function(){
          return {x:(typeof st.x==='number')?st.x:cv.w/2, y:(typeof st.y==='number')?st.y:cv.h/2};
        },
        setPos:function(px,py){ SceneEngine.updateSticker(slide,sceneObj.id,{x:px,y:py}); },
        // A Story-placed sticker has no "authored" home to return to —
        // the middle of the page is the only meaningful reset.
        resetPos:function(){ SceneEngine.updateSticker(slide,sceneObj.id,{x:Math.round(cv.w/2),y:Math.round(cv.h/2)}); },
        resetTitle:'Put it back in the middle',
        getRot:function(){ return (typeof st.rotation==='number')?st.rotation:0; },
        setRot:function(v){ SceneEngine.updateSticker(slide,sceneObj.id,{rotation:v}); }
      };
    }

    if(typeof SceneEngine.setPosition!=='function') return null;
    const vKind=(sceneObj.visual && sceneObj.visual.kind)||null;
    let canRotate;
    if(isPlace){
      // A Place's rotation is its own separate Theme-Author honor, and
      // the renderer gates the READ on it too (_resolvePlaceRotation),
      // so a dial without it would write a value nothing ever reads.
      canRotate=!!sceneObj.rotatable && typeof SceneEngine.setContentOverride==='function';
    }else if(sceneObj.owner==='world'){
      // 'glyph' joins the list this ship — see renderer/slideRenderer.js
      // (_layerDrawSticker now reads ov.rotation). 'color' stays out on
      // purpose: a full-bleed fill has no meaningful orientation, and
      // rotating one only ever exposes its own corners — the same call
      // already made when the old slider shipped. A null visual
      // (spotlight/paperTexture/shadowWash/museumCaption) has no
      // rotation read at all, so it gets the pad but no dial.
      canRotate=(vKind==='text'||vKind==='image'||vKind==='shape'||vKind==='glyph') && typeof SceneEngine.setRotation==='function';
    }else{
      // Story blueprint elements (Cover/Hook/End). Only the Frame has a
      // proven rotation read (and its own long-standing Spin slider);
      // blueprint decorations have never had one, and adding a dial
      // there would be a dead control until the renderer reads it.
      canRotate=(sceneObj.type==='image-holder') && typeof SceneEngine.setRotation==='function';
    }
    function ovBag(){
      return (slide.metadata && slide.metadata.elementOverrides && slide.metadata.elementOverrides[sceneObj.id]) || {};
    }
    return {
      canRotate:canRotate,
      getPos:function(){
        const ov=ovBag();
        if(ov.position && typeof ov.position.x==='number' && typeof ov.position.y==='number'){
          return {x:ov.position.x,y:ov.position.y};
        }
        // No override yet — the object's own rendered centre IS its
        // current position, and the renderer applies an override as a
        // translation from exactly that point, so starting here means
        // the first nudge moves by one step rather than jumping.
        return {x:sceneObj.bx+sceneObj.bw/2, y:sceneObj.by+sceneObj.bh/2};
      },
      setPos:function(px,py){ SceneEngine.setPosition(slide,sceneObj.id,{x:px,y:py}); },
      // Dropping the override entirely is the honest reset here: it puts
      // the object back exactly where the World author placed it, which
      // is more useful than centring it on the page.
      resetPos:function(){ SceneEngine.setPosition(slide,sceneObj.id,null); },
      resetTitle:'Put it back where the World put it',
      getRot:function(){
        if(isPlace){
          try{
            if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceRotation==='function'){
              return SlideRenderer.getPlaceRotation(slide,sceneObj.id)||0;
            }
          }catch(e){}
        }
        const ov=ovBag();
        return (typeof ov.rotation==='number')?ov.rotation:0;
      },
      setRot:function(v){
        if(isPlace) SceneEngine.setContentOverride(slide,sceneObj.id,'rotation',v);
        else SceneEngine.setRotation(slide,sceneObj.id,v);
      }
    };
  }

  // Mounts the pad (always, when moveable) and the dial (when this kind
  // genuinely rotates). Returns whether anything was mounted, so the
  // caller can still fall back when there's nothing to show.
  function _appendSpatialControls(container,sceneObj){
    const slide=_currentSlide();
    const ad=_spatialAdapter(slide,sceneObj);
    if(!ad) return false;
    const cv=_canvasSize(slide);
    _makeSpatialWidget(container,{
      onNudge:function(dx,dy){
        const p=ad.getPos();
        // Clamp the centre inside the page so a held direction can never
        // walk an object completely off-canvas and out of reach.
        const nx=Math.max(0,Math.min(cv.w,Math.round(p.x+dx*NUDGE_STEP_PX)));
        const ny=Math.max(0,Math.min(cv.h,Math.round(p.y+dy*NUDGE_STEP_PX)));
        ad.setPos(nx,ny);
        _afterQuickEditChange();
      },
      onCenter:function(){
        ad.resetPos();
        _afterQuickEditChange();
      },
      resetTitle:ad.resetTitle,
      canRotate:ad.canRotate,
      rotValue:ad.canRotate?ad.getRot():0,
      onRot:function(v){ ad.setRot(v); _afterQuickEditChange(); }
    });
    return true;
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

    // Rotation used to be a -180..180 range slider built right here, paired
    // onto Colour's own row. It's gone: _appendSpatialControls now mounts a
    // real circular Spin dial (plus the 8-direction Move pad) for EVERY
    // moveable object, so a second rotation control on this one surface
    // would be a duplicate of the same override bag. Colour keeps its own
    // full-width row below, unpaired.
    const rotationCell=null;

    if(sceneObj.editable){
      if(v.kind==='color' || v.kind==='shape'){
        const colorCell=_makeColorRow(null,'Colour',v.color||v.fillColor,function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'fillColor',val);
          _afterQuickEditChange();
        });
        _pairRow(container,colorCell,rotationCell);
        mounted=true;
      }else if(v.kind==='image'){
        // Shared apply tail for BOTH sources (local file / Family
        // Photos) — the picked bytes land identically either way, so
        // downstream never knows which source they came from.
        const applyImage=function(dataURL){
          if(!dataURL) return;
          _storeUploadedAsset(dataURL,function(finalRef){
            SceneEngine.setContentOverride(slide,sceneObj.id,'image',finalRef);
            _afterQuickEditChange();
          });
        };
        // Standing rule: EVERY image, from any source, passes through
        // Image Studio (Picture Studio) before it ever shows up on the
        // scene — local file and Family pick alike. The degraded
        // direct-apply path exists only for the theoretical case
        // Picture Studio isn't loaded.
        const prepImage=function(source){
          if(!source) return;
          if(typeof PictureStudio!=='undefined' && typeof PictureStudio.open==='function'){
            PictureStudio.open(source,{defaultMode:'fit',onApply:function(result){
              if(result && result.dataURL) applyImage(result.dataURL);
            }});
            return;
          }
          if(typeof source==='string'){ applyImage(source); return; }
          const reader=new FileReader();
          reader.onload=function(){ applyImage(reader.result); };
          reader.readAsDataURL(source);
        };
        const btn=_el('button','context-btn','🖼️ Replace Image');
        btn.type='button';
        btn.addEventListener('click',function(){
          const fileInput=document.createElement('input');
          fileInput.type='file';
          fileInput.accept='image/*';
          fileInput.addEventListener('change',function(){
            const file=fileInput.files && fileInput.files[0];
            if(!file) return;
            prepImage(file);
          });
          fileInput.click();
        });
        container.appendChild(btn);
        // Family Photos — the second source, alongside (never replacing)
        // the local picker; same conditional-presence rule as the
        // Artwork panel's own From Family Album button, and the picker
        // itself carries the Traveller gate.
        if(_familyPhotosAvailable()){
          const famBtn=_el('button','context-btn','📷 From Family Album');
          famBtn.type='button';
          famBtn.addEventListener('click',function(){
            _showFamilyPhotosPicker({onPick:prepImage});
          });
          container.appendChild(famBtn);
        }
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
        // Bug G Rework — Curve Style picker (None/Arc/Wave/Circle)
        // paired with Amount slider. Amount is disabled for None (nothing
        // to shape) and Circle (radius is derived from text width, not
        // amount). Both _layerDrawText and _drawFreeformText in
        // renderer/slideRenderer.js dispatch through a shared
        // _drawStyledTextLine so the picker's choice is honoured
        // uniformly across Solid AND Shape-Mosaic Fill Style. Backward
        // compat: an object with only curve set (no curveStyle) is
        // treated as 'arc' by both engines' backward-compat resolution,
        // so nothing already authored regresses.
        const curveVal=(typeof ov.curve==='number')?ov.curve:0;
        const curveStyleVal=(typeof ov.curveStyle==='string')?ov.curveStyle:(curveVal?'arc':'none');
        const amountCell=_makeRangeRow(null,{
          labelText:'Amount',min:-180,max:180,step:1,
          value:curveVal,
          format:function(n){ return Math.round(n)+'°'; },
          onInput:function(n){ SceneEngine.setContentOverride(slide,sceneObj.id,'curve',n?n:null); _afterQuickEditChange(); }
        });
        const amountSlider=amountCell.querySelector('input');
        function syncAmountDisabled(styleVal){
          const disabled=(styleVal==='none' || styleVal==='circle');
          if(amountSlider) amountSlider.disabled=disabled;
          amountCell.style.opacity=disabled?'0.5':'';
        }
        syncAmountDisabled(curveStyleVal);
        const curveStyleCell=_makeIconChoiceRow(null,'Curve Style',[
          ['none','None'],['arc','Arc'],['wave','Wave'],['circle','Circle']
        ],curveStyleVal,function(val){
          SceneEngine.setContentOverride(slide,sceneObj.id,'curveStyle',val==='none'?null:val);
          syncAmountDisabled(val);
          _afterQuickEditChange();
        });
        _pairRow(container,curveStyleCell,amountCell);
        mounted=true;
      }
    }
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
    // Content controls and spatial controls are independent: an object can
    // be moveable but not editable (Move/Spin, no content fields), editable
    // but not moveable (content fields, no Move/Spin), or both. OR-ing the
    // two results — rather than the old early-return-per-branch — is what
    // lets a moveable-only object mount at all instead of falling through
    // to the plain "open the right panel" hint.
    let mounted=false;
    if(sceneObj.owner==='world'){
      const v=sceneObj.visual;
      if(v && (v.kind==='color'||v.kind==='shape'||v.kind==='image'||v.kind==='text')){
        if(_appendWorldObjectEditControl(container,sceneObj,v)) mounted=true;
      }
    }else if(sceneObj.type==='sticker' && sceneObj.visual && sceneObj.visual.kind==='text'){
      if(_appendStickerTextEditControl(container,sceneObj)) mounted=true;
    }
    if(_appendSpatialControls(container,sceneObj)) mounted=true;
    return mounted;
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

    // Spin used to be a -180..180 range slider here. It's gone:
    // _appendSpatialControls mounts a real circular Spin dial (plus the
    // 8-direction Move pad) for every moveable object, writing to the
    // exact same st.rotation this slider did — a second control on the
    // same field would just be a duplicate.
    // Bug G Rework — Curve Style picker (None/Arc/Wave/Circle) +
    // Amount slider. Same pattern as the World-owned Text popup
    // above, adapted for a Story-owned freeform sticker (writes to
    // st.curve/st.curveStyle via SceneEngine.updateSticker shallow-
    // merge; no elementOverrides bag for a sticker's own top-level
    // fields). Amount is disabled for None/Circle.
    const stCurveVal=(typeof st.curve==='number')?st.curve:0;
    const stCurveStyleVal=(typeof st.curveStyle==='string')?st.curveStyle:(stCurveVal?'arc':'none');
    const stAmountCell=_makeRangeRow(null,{
      labelText:'Amount',min:-180,max:180,step:1,
      value:stCurveVal,
      format:function(n){ return Math.round(n)+'°'; },
      onInput:function(n){ update({curve:Math.round(n)}); }
    });
    const stAmountSlider=stAmountCell.querySelector('input');
    function syncStAmountDisabled(styleVal){
      const disabled=(styleVal==='none' || styleVal==='circle');
      if(stAmountSlider) stAmountSlider.disabled=disabled;
      stAmountCell.style.opacity=disabled?'0.5':'';
    }
    syncStAmountDisabled(stCurveStyleVal);
    const stCurveStyleCell=_makeIconChoiceRow(null,'Curve Style',[
      ['none','None'],['arc','Arc'],['wave','Wave'],['circle','Circle']
    ],stCurveStyleVal,function(val){
      update({curveStyle:val==='none'?null:val});
      syncStAmountDisabled(val);
    });
    _pairRow(container,stCurveStyleCell,stAmountCell);

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
    // Family Photos — the second source for a Place's picture, ALONGSIDE
    // the local picker above, never replacing it. Same conditional-
    // presence rule as the Add Something row; the picker itself carries
    // the Traveller gate, so this stays one plain button either way.
    if(_familyPhotosAvailable()){
      const familyBtn=_el('button','context-btn','📷 From Family Album');
      familyBtn.type='button';
      familyBtn.addEventListener('click',function(){ _showFamilyPhotosPicker({mode:'artwork'}); });
      row.appendChild(familyBtn);
    }
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
      },BACKGROUND_PALETTE);
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
    },BACKGROUND_PALETTE);
    container.appendChild(row);

    _appendBackgroundImageControls(container,co);
    _appendPlaceTransparency(container,slide);
  }

  // "Transparent background for the Places" — the one background in the
  // Studio that had no way to be turned off.
  //
  // On a page with no Story World the picture area is painted with an
  // opaque page-colour rectangle (renderer/slideRenderer.js, the
  // fallback-panel branch). A Place authored in the Builder can already
  // be made transparent, and a Frame Style's fill has had a 'None' chip
  // all along — but both of those sit ON TOP of that rectangle, so
  // turning them off revealed the page colour rather than the page.
  //
  // Only offered where it means something: a page whose Place comes
  // from a World has its own Paper control and must not be given a
  // second, conflicting one.
  function _appendPlaceTransparency(container,slide){
    if(!slide) return;
    let worldOwned=false;
    try{
      worldOwned=(typeof SceneEngine!=='undefined') &&
                 (SceneEngine.getRenderData(slide)!==null);
    }catch(e){}
    if(worldOwned) return;

    if(!slide.metadata) slide.metadata={};
    const row=_el('div','designer-row context-row');
    row.appendChild(_el('div','designer-row-label','Picture Area'));

    const wrap=document.createElement('label');
    wrap.className='context-transparent-toggle';
    wrap.style.display='inline-flex';
    wrap.style.alignItems='center';
    wrap.style.gap='6px';
    wrap.style.fontSize='13px';
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=!!slide.metadata.placeTransparent;
    cb.addEventListener('change',function(){
      if(cb.checked) slide.metadata.placeTransparent=true;
      else delete slide.metadata.placeTransparent;
      delete slide.thumbnail;
      if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
      _debouncedObjectStripRefresh();
    });
    wrap.appendChild(cb);
    const lbl=document.createElement('span');
    lbl.textContent='Transparent';
    wrap.appendChild(lbl);
    row.appendChild(wrap);
    container.appendChild(row);
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

    // Family Photos as a second background-picture source — the picked
    // photo runs the identical Picture Studio 'fill' pass the local
    // upload button above already uses, landing via the same
    // _applyBackgroundImageResult completion.
    if(_familyPhotosAvailable()){
      const famBtn=_el('button','context-btn','📷 From Family Album');
      famBtn.type='button';
      famBtn.addEventListener('click',function(){
        _showFamilyPhotosPicker({onPick:function(dataURL){
          if(typeof PictureStudio==='undefined'){ _applyBackgroundImageResult({dataURL:dataURL}); return; }
          PictureStudio.open(dataURL,{defaultMode:'fill',onApply:_applyBackgroundImageResult});
        }});
      });
      btnRow.appendChild(famBtn);
    }

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
  // Collection registry). The picked file routes through the SAME
  // Picture Studio pass every other picture upload in this app already
  // takes (Place fills, Family Photos picks, the page background) —
  // "when i choose image from +add something it does not goes through
  // image studio" was a real, reported gap: this path used to hand the
  // raw FileReader result straight to a sticker with no Picture Studio
  // step at all. Applying from Picture Studio lands on an ordinary
  // kind:'image' sticker's Refine panel — Position/Size/Rotation/
  // Opacity/Lock/Duplicate/Delete — exactly like a Collection-sourced
  // picture's own panel.
  function _addImageObject(){
    const fileInput=document.createElement('input');
    fileInput.type='file';
    fileInput.accept='image/*';
    fileInput.addEventListener('change',function(){
      const file=fileInput.files && fileInput.files[0];
      if(!file) return;
      if(typeof PictureStudio!=='undefined' && typeof PictureStudio.open==='function'){
        PictureStudio.open(file,{
          defaultMode:'fit',
          onApply:function(result){
            _addImageStickerFromDataURL(result && result.dataURL,'image.upload');
          },
          // Opting in to the multi-picture return. Image Studio's Cut Out
          // Objects tool can find several separate drawings on one
          // photographed sheet, and this is the one place today that can
          // genuinely place them all — each becomes its own freestanding
          // sticker the kid can move, resize and colour independently.
          // Every other PictureStudio.open call site omits this and is
          // completely unaffected.
          onApplyMany:function(results){
            (results||[]).forEach(function(r){
              _addImageStickerFromDataURL(r && r.dataURL,'image.upload');
            });
          }
        });
        return;
      }
      // Degraded path only — Picture Studio always exists in real Studio.
      const reader=new FileReader();
      reader.onload=function(){ _addImageStickerFromDataURL(reader.result,'image.upload'); };
      reader.readAsDataURL(file);
    });
    fileInput.click();
  }

  // Shared tail for every "a picked/prepared picture becomes a
  // freestanding kind:'image' sticker" path (Add Something's Photo card,
  // Family Photos picks) — durably stored (vihu-asset:) via
  // _storeUploadedAsset, then selected so the kid lands straight on its
  // Refine panel. stickerId is a fixed synthetic literal per source
  // (instance identity comes from st.id, not stickerId, so several
  // photos may coexist on one page).
  function _addImageStickerFromDataURL(dataURL,stickerId){
    const slide=_currentSlide();
    if(!dataURL || !slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    _storeUploadedAsset(dataURL,function(finalRef){
      const st=SceneEngine.addSticker(slide,{
        kind:'image', image:finalRef, stickerId:stickerId||'image.upload',
        w:320, h:320
      });
      if(!st) return;
      if(typeof window.setSelectedSceneElement==='function'){
        try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
      }
    });
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

  // ---------- Voice (per-page narration) ----------
  // Locked Product Decision #4 (Audio Studio) MVP: one narration clip
  // per page — the kid tells THIS page's story in their own voice —
  // stored at slide.metadata.narration = {ref, durationMs} (metadata
  // rides serialize() wholesale, so save/restore/cloud-sync need zero
  // persistence changes). Record (js/voiceRecorder.js, 60s cap with a
  // countdown) or import an audio file; the clip lands in AssetStore
  // exactly like every picture (durable vihu-asset: ref + background
  // cloud upload). Creator-only by product decision — a Traveller sees
  // the companion-framed nudge toward their first Publish, same
  // discipline as Family Photos. Playback is Studio-only for now
  // (PDF/PNG structurally can't carry audio — narrated exports stay
  // the "foundation for" future Decision #4 already anticipates).
  // Voice-note OBJECTS on the canvas are the agreed follow-up ship,
  // not part of this MVP.
  let _voiceAudioEl=null;   // live playback element, one at a time
  let _voicePreview=null;   // {blob,durationMs,url} between Stop and Keep It

  function _fmtVoiceTime(ms){
    const total=Math.max(0,Math.round(ms/1000));
    const m=Math.floor(total/60), s=total%60;
    return m+':'+(s<10?'0':'')+s;
  }
  function _stopVoicePlayback(){
    if(_voiceAudioEl){ try{ _voiceAudioEl.pause(); }catch(e){} }
    _voiceAudioEl=null;
  }
  function _clearVoicePreview(){
    if(_voicePreview && _voicePreview.url){ try{ URL.revokeObjectURL(_voicePreview.url); }catch(e){} }
    _voicePreview=null;
  }
  // Mirrors _storeUploadedAsset's shape for a Blob (no downscale step —
  // audio has nothing to downscale; AssetStore.put is MIME-agnostic).
  function _storeVoiceBlob(blob,onDone){
    if(typeof window.AssetStore==='undefined' || typeof ProjectManager==='undefined' || typeof ProjectManager.ensureProjectId!=='function'){
      onDone(null); return;
    }
    const projectId=ProjectManager.ensureProjectId();
    if(!projectId){ onDone(null); return; }
    window.AssetStore.put(blob,{surface:'creator',projectId:projectId}).then(function(ref){
      onDone(typeof ref==='string' && ref.indexOf('vihu-asset:')===0 ? ref : null);
    }).catch(function(){ onDone(null); });
  }
  // Both page strips show a 🔊 badge on a page carrying narration, so
  // setting or clearing one has to repaint them. host.markDirty() only
  // flags the project dirty — it does not re-render — and PageRuntime.notify()
  // would be wrong here: it calls ContextPanel.refresh(), which would rebuild
  // the Voice panel out from under the flow the child is in.
  function _refreshPageStrips(){
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
  }
  function _setNarration(ref,durationMs){
    const slide=_currentSlide();
    if(!slide) return;
    if(!slide.metadata) slide.metadata={};
    slide.metadata.narration={ref:ref, durationMs:durationMs||0};
    if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    _refreshPageStrips();
  }
  function _removeNarration(){
    const slide=_currentSlide();
    if(slide && slide.metadata && slide.metadata.narration){
      delete slide.metadata.narration;
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
      _refreshPageStrips();
    }
  }
  function _playNarration(statusEl){
    const slide=_currentSlide();
    const n=slide && slide.metadata && slide.metadata.narration;
    if(!n || !n.ref){ return; }
    _stopVoicePlayback();
    const opts=slide && slide.recallOwnerId ? {ownerId:slide.recallOwnerId} : undefined;
    const resolveP=(typeof window.AssetStore!=='undefined' && typeof window.AssetStore.resolve==='function')
      ? window.AssetStore.resolve(n.ref,opts) : Promise.resolve(n.ref);
    resolveP.then(function(url){
      if(!url){ if(statusEl) statusEl.textContent='Hmm — this voice couldn’t load right now.'; return; }
      _voiceAudioEl=new Audio(url);
      _voiceAudioEl.play().catch(function(){
        if(statusEl) statusEl.textContent='Hmm — this voice couldn’t play right now.';
      });
    });
  }
  // commit(ref,durationMs) decides where the stored clip LANDS — page
  // narration (_setNarration) or a canvas voice-note sticker
  // (_addVoiceNoteSticker) — so one import path serves both (Ship 2).
  function _importVoiceFile(commit,afterStored){
    const input=document.createElement('input');
    input.type='file';
    input.accept='audio/*';
    input.addEventListener('change',function(){
      const file=input.files && input.files[0];
      if(!file) return;
      // Duration from metadata, best-effort — a webm/opus import can
      // legitimately report Infinity; 0 then just means "no time shown".
      const url=URL.createObjectURL(file);
      const probe=new Audio();
      const finish=function(durationMs){
        try{ URL.revokeObjectURL(url); }catch(e){}
        _storeVoiceBlob(file,function(ref){
          if(ref){ commit(ref,durationMs); }
          afterStored(!!ref);
        });
      };
      probe.onloadedmetadata=function(){
        const d=probe.duration;
        finish(isFinite(d) && d>0 ? Math.round(d*1000) : 0);
      };
      probe.onerror=function(){ finish(0); };
      probe.src=url;
    });
    input.click();
  }

  // Voice MVP Ship 2 — a voice-note OBJECT: a placeable 🔊 badge sticker
  // (kind:'voice') a kid drops anywhere on the page, several per page,
  // tap-to-play on the canvas. Mirrors _addImageStickerFromDataURL's own
  // create-and-auto-select shape; the clip is already durably stored
  // (vihu-asset:) by the time this runs, so the instance just carries
  // the reference + measured length. Selecting the new note navigates
  // the panel to its Refine controls — the natural landing, exactly like
  // a fresh Photo pick.
  // "there is no way to place it on slide" — a voice note used to spawn
  // at SceneEngine.addSticker's own dead-centre default (540,675), which
  // on a real page is squarely on top of the Artwork Place: the badge
  // lands buried in the middle of the picture, and a second one lands
  // exactly on the first. Spawn low-left instead — clear of a typical
  // Place's content area — and cascade diagonally per note already on
  // the page so several notes are each individually grabbable. Fractions
  // of the page's OWN resolved size (never a hardcoded 1080×1350, which
  // is only one of several aspects a Scene can declare).
  function _voiceNoteSpawn(slide){
    let w=1080, h=1350;
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getCanvasSize==='function'){
      try{ const sz=SlideRenderer.getCanvasSize(slide); if(sz && sz.w && sz.h){ w=sz.w; h=sz.h; } }catch(e){}
    }
    const existing=(slide && slide.metadata && Array.isArray(slide.metadata.stickers))
      ? slide.metadata.stickers.filter(function(s){ return s && s.kind==='voice'; }).length : 0;
    const step=Math.round(Math.min(w,h)*0.07);
    // Wrap the cascade before it can walk off the page — 5 steps up-and-
    // right, then start a fresh column further right.
    const col=Math.floor(existing/5), row=existing%5;
    const x=Math.min(w-70, Math.round(w*0.18)+col*step*2+row*step);
    const y=Math.max(70, Math.round(h*0.80)-row*step);
    return {x:x,y:y};
  }

  function _addVoiceNoteSticker(ref,durationMs){
    const slide=_currentSlide();
    if(!ref || !slide || typeof SceneEngine==='undefined' || typeof SceneEngine.addSticker!=='function') return;
    const at=_voiceNoteSpawn(slide);
    const st=SceneEngine.addSticker(slide,{
      kind:'voice', stickerId:'voice.note',
      voiceRef:ref, voiceDurationMs:durationMs||0,
      x:at.x, y:at.y, w:110, h:110
    });
    if(!st) return;
    if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
    if(typeof window.setSelectedSceneElement==='function'){
      try{ window.setSelectedSceneElement(st.id,'sticker'); }catch(e){}
    }
    // Land the kid on the Move pad + Spin dial straight away. The
    // Refine panel a fresh note otherwise opens on carries Play/Size/
    // Spin/See Through/Lock/Duplicate/Delete and no position control at
    // all, so placement was only ever reachable by discovering the
    // strip's own ✏️ — the literal "no way to place it". Deferred one
    // frame so setSelectedSceneElement's own PageRuntime.notify() has
    // already rebuilt the strip for THIS object before the popup opens
    // against it.
    if(typeof SelectionActionStrip!=='undefined' && typeof SelectionActionStrip.openEdit==='function'){
      try{ window.requestAnimationFrame(function(){ try{ SelectionActionStrip.openEdit(); }catch(e){} }); }catch(e){}
    }
  }

  function _showVoicePanel(){
    stickerStudioOpen=true;
    _stopVoicePlayback();
    panelRoot.innerHTML='';
    panelRoot.classList.remove('is-empty');
    panelRoot.appendChild(_el('div','context-collection-picker-heading','🎤 Your Voice'));

    const leave=function(){
      _stopVoicePlayback();
      _clearVoicePreview();
      if(typeof VoiceRecorder!=='undefined'){ try{ VoiceRecorder.cancel(); }catch(e){} }
      refresh();
    };
    const doneBtn=function(){
      const b=_el('button','context-btn','← Done');
      b.type='button';
      b.addEventListener('click',leave);
      return b;
    };

    // Creator-only — same companion-framed gate discipline as Family
    // Photos: a child's recorded voice is personal data, and the gate
    // points at the real path (first Publish → companion) rather than
    // just refusing.
    if(!_isCreatorSession()){
      const gate=_el('div','context-family-gate');
      gate.appendChild(_el('div','context-family-gate-icon','🧭'));
      gate.appendChild(_el('div','context-family-gate-text',
        'You need a companion before you can leave your voice on a page! Share your first story with VihuPlanet — your companion will arrive, and together you can tell every page’s story out loud.'));
      panelRoot.appendChild(gate);
      panelRoot.appendChild(doneBtn());
      return;
    }

    const body=_el('div','voice-panel-body');
    panelRoot.appendChild(body);
    panelRoot.appendChild(doneBtn());

    const supported=(typeof VoiceRecorder!=='undefined' && VoiceRecorder.isSupported());

    // Where a finished clip LANDS: page narration, or (Ship 2) a
    // placeable voice-note sticker on the canvas. Same record/import
    // machinery either way — only the commit differs.
    const commitNarration=function(ref,durationMs){ _setNarration(ref,durationMs); };
    const commitVoiceNote=function(ref,durationMs){ _addVoiceNoteSticker(ref,durationMs); };

    function renderIdle(){
      _clearVoicePreview();
      body.innerHTML='';
      const slide=_currentSlide();
      const n=slide && slide.metadata && slide.metadata.narration;
      const status=_el('div','voice-status','');
      if(n && n.ref){
        body.appendChild(_el('div','voice-hint',
          'This page has your voice on it'+(n.durationMs?' ('+_fmtVoiceTime(n.durationMs)+')':'')+'.'));
        const listen=_el('button','context-btn','▶ Listen');
        listen.type='button';
        listen.addEventListener('click',function(){ _playNarration(status); });
        body.appendChild(listen);
        if(supported){
          const again=_el('button','context-btn','🎤 Record Again');
          again.type='button';
          again.addEventListener('click',function(){ startRecording(commitNarration); });
          body.appendChild(again);
        }
        const imp=_el('button','context-btn','📁 Import Audio');
        imp.type='button';
        imp.addEventListener('click',function(){ _importVoiceFile(commitNarration,function(){ renderIdle(); }); });
        body.appendChild(imp);
        const rm=_el('button','context-btn voice-remove-btn','🗑 Remove Voice');
        rm.type='button';
        rm.addEventListener('click',function(){ _stopVoicePlayback(); _removeNarration(); renderIdle(); });
        body.appendChild(rm);
      }else{
        body.appendChild(_el('div','voice-hint','Tell this page’s story in your own voice!'));
        if(supported){
          const rec=_el('button','voice-record-btn','🎤 Start Recording');
          rec.type='button';
          rec.addEventListener('click',function(){ startRecording(commitNarration); });
          body.appendChild(rec);
        }else{
          body.appendChild(_el('div','voice-status','Recording isn’t available on this device — you can still import an audio file.'));
        }
        const imp=_el('button','context-btn','📁 Import Audio');
        imp.type='button';
        imp.addEventListener('click',function(){ _importVoiceFile(commitNarration,function(){ renderIdle(); }); });
        body.appendChild(imp);
      }
      body.appendChild(status);

      // ---- Voice Notes (Ship 2): little 🔊 badges dropped anywhere on
      // the page — several per page, each its own clip, tap-to-play on
      // the canvas. A fresh note auto-selects (the commit navigates the
      // panel to the new note's Refine controls, exactly like a fresh
      // Photo pick — renderIdle after that runs on a disconnected body,
      // harmless per the established isConnected discipline).
      body.appendChild(_el('div','voice-section-divider'));
      body.appendChild(_el('div','context-collection-group-label','🔊 Voice Notes'));
      const notes=(slide && slide.metadata && Array.isArray(slide.metadata.stickers))
        ? slide.metadata.stickers.filter(function(s){ return s && s.kind==='voice'; }) : [];
      body.appendChild(_el('div','voice-hint',
        notes.length
          ? (notes.length===1 ? 'This page has 1 voice note — tap its 🔊 badge to hear it.'
                              : 'This page has '+notes.length+' voice notes — tap any 🔊 badge to hear it.')
          : 'Drop little voice bubbles anywhere on the page!'));
      if(supported){
        const addNote=_el('button','context-btn','➕ Add a Voice Note');
        addNote.type='button';
        addNote.addEventListener('click',function(){ startRecording(commitVoiceNote); });
        body.appendChild(addNote);
      }
      const impNote=_el('button','context-btn','📁 Import a Voice Note');
      impNote.type='button';
      impNote.addEventListener('click',function(){ _importVoiceFile(commitVoiceNote,function(){ renderIdle(); }); });
      body.appendChild(impNote);
    }

    function startRecording(commit){
      _stopVoicePlayback();
      _clearVoicePreview();
      body.innerHTML='';
      const maxMs=VoiceRecorder.DEFAULT_MAX_MS;
      const pulse=_el('div','voice-pulse-dot');
      const timer=_el('div','voice-timer','0:00 / '+_fmtVoiceTime(maxMs));
      const row=_el('div','voice-recording-row');
      row.appendChild(pulse);
      row.appendChild(timer);
      body.appendChild(_el('div','voice-hint','I’m listening…'));
      body.appendChild(row);
      const stopBtn=_el('button','voice-record-btn is-recording','⏹ Stop');
      stopBtn.type='button';
      const cancelBtn=_el('button','context-btn','✕ Cancel');
      cancelBtn.type='button';
      body.appendChild(stopBtn);
      body.appendChild(cancelBtn);

      const finishToPreview=function(){
        VoiceRecorder.stop().then(function(clip){
          renderPreview(clip,commit);
        }).catch(function(){ renderIdle(); });
      };
      stopBtn.addEventListener('click',finishToPreview);
      cancelBtn.addEventListener('click',function(){ VoiceRecorder.cancel(); renderIdle(); });

      VoiceRecorder.start({
        maxMs:maxMs,
        onTick:function(elapsed,cap){
          if(!timer.isConnected) return;
          timer.textContent=_fmtVoiceTime(Math.min(elapsed,cap))+' / '+_fmtVoiceTime(cap);
          if(cap-elapsed<=10000) timer.classList.add('voice-timer-ending');
        },
        onAutoStop:finishToPreview
      }).catch(function(err){
        body.innerHTML='';
        const msg=(err && err.reason==='denied')
          ? '😕 I couldn’t hear you — check your microphone and try again.'
          : '😕 Recording didn’t start — check your microphone and try again.';
        body.appendChild(_el('div','voice-status',msg));
        const back=_el('button','context-btn','↩ Back');
        back.type='button';
        back.addEventListener('click',renderIdle);
        body.appendChild(back);
      });
    }

    function renderPreview(clip,commit){
      _clearVoicePreview();
      _voicePreview={blob:clip.blob,durationMs:clip.durationMs,url:URL.createObjectURL(clip.blob)};
      body.innerHTML='';
      body.appendChild(_el('div','voice-hint','Here’s what you said ('+_fmtVoiceTime(clip.durationMs)+') — keep it?'));
      const status=_el('div','voice-status','');
      const play=_el('button','context-btn','▶ Play');
      play.type='button';
      play.addEventListener('click',function(){
        _stopVoicePlayback();
        _voiceAudioEl=new Audio(_voicePreview.url);
        _voiceAudioEl.play().catch(function(){ status.textContent='Hmm — playback didn’t start.'; });
      });
      const keep=_el('button','voice-record-btn','✓ Keep It');
      keep.type='button';
      keep.addEventListener('click',function(){
        keep.disabled=true;
        status.textContent='Saving your voice…';
        _storeVoiceBlob(_voicePreview.blob,function(ref){
          if(!ref){
            status.textContent='😕 Saving didn’t work — try again.';
            keep.disabled=false;
            return;
          }
          commit(ref,_voicePreview.durationMs);
          renderIdle();
        });
      });
      const again=_el('button','context-btn','↩ Try Again');
      again.type='button';
      again.addEventListener('click',function(){ startRecording(commit); });
      body.appendChild(play);
      body.appendChild(keep);
      body.appendChild(again);
      body.appendChild(status);
    }

    renderIdle();
  }

  // ---------- Family Photos (shared Google Photos albums) ----------
  // A parent shares one or more PUBLIC Google Photos albums (stored per-
  // kid in Supabase — js/familyAlbum.js is all the plumbing); the kid
  // browses and picks photos from them ALONGSIDE the ordinary local
  // picker, never replacing it. One shared picker, several entry points:
  //   - Add Something -> "📷 Family Photos" (lands as a freestanding
  //     kind:'image' sticker, exactly like "Photo"/"From This World")
  //   - the Artwork panel's "📷 From Family Album" (fills the selected
  //     Place, exactly like "Replace Artwork")
  //   - every other replace-image surface, via opts.onPick (the
  //     World-owned object quick-edit's Replace Image, Background's
  //     Upload/Replace Picture, and — cross-module via the ContextPanel
  //     export — pageDesigner's Cover/Hook/End Image Manager), per
  //     "wherever we have replace image or replace photo or replace art
  //     it should be able to replace from local as well as family photos"
  // Both route the picked photo through Picture Studio first, so a kid
  // can crop/adjust before it lands — the identical pipeline a local
  // file pick already uses; downstream code never knows the picture
  // came from Google Photos at all.
  //
  // Creator-only by product decision ("functionality not needed for
  // traveller. infact we can show you need to have companion to guide
  // you in external world") — a Traveller who taps in sees a companion-
  // framed nudge toward their first Publish instead of the picker.
  let _familyPickerAlbumId=null; // remembered chip choice across re-renders

  function _familyPhotosAvailable(){
    try{ return !!(window.FamilyAlbum && FamilyAlbum.isAvailable()); }catch(e){ return false; }
  }
  // Creator = a claimed Magic Card is active on this device. Same
  // gate _scheduleCloudProjectSync/the sync charm already key off.
  function _isCreatorSession(){
    try{ return !!(typeof MagicCard!=='undefined' && MagicCard.getActive && MagicCard.getActive()); }catch(e){ return false; }
  }
  // ---------- The Family Photos POPUP ----------
  // Product decision ("the family photo needs to show the photos in a
  // pop up UI. this will ensure we are able to show enough pics on the
  // screen not just scroll after each pic"): the picker and the parent
  // Manage Albums panel both render inside one shared popup modal, not
  // the narrow right sidebar — a real multi-column grid shows a whole
  // album at a glance. The right panel behind it is never touched, so
  // closing the popup lands the kid exactly where they were. Z-layered
  // below Picture Studio's own modal (200) — moot in practice, since a
  // pick closes this popup BEFORE Picture Studio opens.
  let _familyModal=null, _familyModalTitle=null, _familyModalBody=null;
  function _ensureFamilyModal(){
    if(_familyModal) return;
    _familyModal=_el('div','family-photos-modal hidden');
    const box=_el('div','family-photos-box');
    const header=_el('div','family-photos-header');
    _familyModalTitle=_el('div','family-photos-title','📷 Family Photos');
    header.appendChild(_familyModalTitle);
    const close=_el('button','family-photos-close','✕');
    close.type='button';
    close.setAttribute('aria-label','Close');
    close.addEventListener('click',_closeFamilyModal);
    header.appendChild(close);
    box.appendChild(header);
    _familyModalBody=_el('div','family-photos-body');
    box.appendChild(_familyModalBody);
    _familyModal.appendChild(box);
    // Backdrop click closes; clicks inside the box never reach here.
    _familyModal.addEventListener('mousedown',function(e){ if(e.target===_familyModal) _closeFamilyModal(); });
    document.body.appendChild(_familyModal);
  }
  function _onFamilyModalKeyDown(e){ if(e.key==='Escape') _closeFamilyModal(); }
  // Clears + returns the modal body as the mount point for a fresh
  // render (picker or manager) — the isConnected guards below keep
  // working since a re-render disconnects the previous body wholesale.
  function _openFamilyModal(title){
    _ensureFamilyModal();
    _familyModalTitle.textContent=title;
    _familyModalBody.innerHTML='';
    _familyModal.classList.remove('hidden');
    document.addEventListener('keydown',_onFamilyModalKeyDown);
    return _familyModalBody;
  }
  function _closeFamilyModal(){
    if(_familyModal) _familyModal.classList.add('hidden');
    document.removeEventListener('keydown',_onFamilyModalKeyDown);
  }
  function _familyDoneBtn(label){
    const btn=_el('button','context-btn',label||'✕ Close');
    btn.type='button';
    btn.addEventListener('click',function(){ _closeFamilyModal(); });
    return btn;
  }

  function _showFamilyPhotosPicker(opts){
    const mount=_openFamilyModal('📷 Family Photos');

    if(!_isCreatorSession()){
      // Traveller gate — the product decision's own framing, worded for
      // a kid: the outside world needs a companion as a guide, and a
      // companion arrives with the first Publish (the Awakening).
      const gate=_el('div','context-family-gate');
      gate.appendChild(_el('div','context-family-gate-icon','🧭'));
      gate.appendChild(_el('div','context-family-gate-text',
        'You need a companion to guide you in the outside world! Share your first story with VihuPlanet — your companion will arrive, and together you can bring in family photos.'));
      mount.appendChild(gate);
      mount.appendChild(_familyDoneBtn());
      return;
    }

    const status=_el('div','context-family-status','Looking for your family albums…');
    mount.appendChild(status);
    const body=_el('div','context-family-body');
    mount.appendChild(body);
    const actions=_el('div','context-action-row');
    const manageBtn=_el('button','context-btn','⚙️ Manage Albums');
    manageBtn.type='button';
    manageBtn.addEventListener('click',function(){ _showFamilyAlbumManager(opts); });
    actions.appendChild(manageBtn);
    actions.appendChild(_familyDoneBtn());
    mount.appendChild(actions);

    FamilyAlbum.listAlbums().then(function(albums){
      if(!body.isConnected) return; // navigated away while loading
      if(!albums.length){
        status.textContent='';
        const empty=_el('div','context-family-gate');
        empty.appendChild(_el('div','context-family-gate-icon','👨‍👩‍👧'));
        empty.appendChild(_el('div','context-family-gate-text',
          'No family albums connected yet. Ask a parent to add a shared Google Photos album link in Manage Albums — then everyone\'s photos show up right here.'));
        body.appendChild(empty);
        return;
      }
      let active=albums.find(function(a){ return a.id===_familyPickerAlbumId; })||albums[0];
      _familyPickerAlbumId=active.id;
      if(albums.length>1){
        const chips=_el('div','context-family-chips');
        albums.forEach(function(a,i){
          const chip=_el('button','context-family-chip'+(a.id===active.id?' is-active':''),a.label||('Album '+(i+1)));
          chip.type='button';
          chip.addEventListener('click',function(){
            _familyPickerAlbumId=a.id;
            _showFamilyPhotosPicker(opts);
          });
          chips.appendChild(chip);
        });
        body.appendChild(chips);
      }
      status.textContent='Opening “'+(active.label||'your album')+'”…';
      FamilyAlbum.getPhotos(active.albumUrl).then(function(res){
        if(!body.isConnected) return;
        if(!res.ok){
          status.textContent='Couldn\'t reach this album right now — check the link in Manage Albums, or try again in a moment.';
          return;
        }
        status.textContent=res.fromCache==='stale'
          ? 'Showing saved copies — couldn\'t reach the album just now.'
          : (res.count===0 ? 'This album looks empty — add photos to it in Google Photos.' : 'Tap a photo to use it.');
        if(!res.count) return;
        // The popup's own wide multi-column grid (family-photos-grid),
        // not the sidebar's narrow collection grid — the whole point of
        // the popup is showing many photos at once.
        const grid=_el('div','family-photos-grid');
        res.photos.forEach(function(p){
          grid.appendChild(_buildFamilyPhotoTile(p,opts));
        });
        body.appendChild(grid);
      });
    });
  }

  function _buildFamilyPhotoTile(photo,opts){
    const tile=_el('button','context-collection-tile context-family-tile');
    tile.type='button';
    const thumb=_el('span','context-collection-tile-thumb');
    const img=document.createElement('img');
    // Direct lh3 thumbnail — a plain <img>, no crossOrigin, no canvas,
    // so browsing costs zero Supabase egress (the GO-proxy verdict only
    // applies to the pick itself below).
    img.src=FamilyAlbum.thumbUrl(photo);
    img.alt='family photo';
    img.loading='lazy';
    thumb.appendChild(img);
    tile.appendChild(thumb);
    tile.addEventListener('click',function(){
      if(tile.classList.contains('is-loading')) return;
      tile.classList.add('is-loading');
      // The one proxied fetch per pick (canvas-safe bytes via the Edge
      // Function — direct lh3 loads carry no CORS headers and would
      // taint the canvas, per the go/no-go test's own verdict).
      FamilyAlbum.fetchPhotoAsDataURL(photo).then(function(res){
        tile.classList.remove('is-loading');
        if(!res.ok){
          tile.classList.add('is-error');
          setTimeout(function(){ tile.classList.remove('is-error'); },1600);
          return;
        }
        _routeFamilyPick(res.dataURL,opts);
      });
    });
    return tile;
  }

  function _routeFamilyPick(dataURL,opts){
    // Close the popup BEFORE Picture Studio opens so the two modals are
    // never stacked — the pick hands off cleanly into the same Picture
    // Studio pass a local file pick already uses.
    _closeFamilyModal();
    // Generic callback mode — "wherever we have replace image or replace
    // photo or replace art it should be able to replace from local as
    // well as family photos": any replace-image surface can open this
    // picker with its own onPick and route the picked bytes through the
    // EXACT same pipeline its local file pick already uses (Picture
    // Studio pass included or not, matching that site's own local path),
    // so the two sources always behave identically per surface.
    if(opts && typeof opts.onPick==='function'){ opts.onPick(dataURL); return; }
    const artworkMode=!!(opts && opts.mode==='artwork');
    if(typeof PictureStudio==='undefined'){
      // Degraded path only — Picture Studio always exists in real Studio.
      if(artworkMode){ _applyImageResult({dataURL:dataURL}); }
      else{ _familyAddImageObject(dataURL); }
      return;
    }
    if(artworkMode){
      // Fills the selected Place — the identical completion the local
      // "Replace Artwork" flow already uses, including the Place's own
      // authored fit as Picture Studio's starting mode.
      const places=(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceRects==='function')
        ? SlideRenderer.getPlaceRects(_currentSlide())
        : null;
      const placeId=_currentPlaceId();
      const place=places && places.find(function(p){ return p.id===placeId; });
      const defaultMode=(place && place.place && place.place.fit)||'fit';
      PictureStudio.open(dataURL,{defaultMode:defaultMode,onApply:_applyImageResult});
    }else{
      PictureStudio.open(dataURL,{defaultMode:'fit',onApply:function(result){
        _familyAddImageObject(result && result.dataURL);
      }});
    }
  }

  // Same freestanding kind:'image' sticker Add Something's Photo card
  // creates — shared tail lives in _addImageStickerFromDataURL above.
  function _familyAddImageObject(dataURL){
    _addImageStickerFromDataURL(dataURL,'image.family');
  }

  // Parent-facing album management — add / rename / replace link /
  // remove, all through js/familyAlbum.js's own CRUD (RLS enforces
  // ownership server-side). Deliberately plain and text-first: this is
  // the one Family Photos surface aimed at the PARENT, not the kid.
  function _showFamilyAlbumManager(pickerOpts){
    const mount=_openFamilyModal('⚙️ Family Albums');
    mount.appendChild(_el('div','context-family-manager-hint',
      'For parents: share a Google Photos album (Share → Create link), then paste the link here. Photos stay on Google — VihuStudio only remembers the link.'));

    const listWrap=_el('div','context-family-manager-list');
    mount.appendChild(listWrap);

    // Add form — real inputs (a pasted URL needs a field, not a prompt).
    const form=_el('div','context-family-manager-form');
    const urlInput=document.createElement('input');
    urlInput.type='text';
    urlInput.className='context-family-input';
    urlInput.placeholder='https://photos.app.goo.gl/…';
    const labelInput=document.createElement('input');
    labelInput.type='text';
    labelInput.className='context-family-input';
    labelInput.placeholder='Album name (like “Holidays”)';
    const addBtn=_el('button','context-btn context-btn-primary','➕ Add Album');
    addBtn.type='button';
    const formStatus=_el('div','context-family-status','');
    addBtn.addEventListener('click',function(){
      const url=(urlInput.value||'').trim();
      if(!FamilyAlbum.isValidAlbumUrl(url)){
        formStatus.textContent='That doesn\'t look like a Google Photos share link — it should start with https://photos.app.goo.gl/…';
        return;
      }
      addBtn.disabled=true;
      formStatus.textContent='Adding…';
      FamilyAlbum.addAlbum(url,(labelInput.value||'').trim()).then(function(res){
        addBtn.disabled=false;
        if(!res.ok){ formStatus.textContent='Couldn\'t add that album ('+res.error+') — try again.'; return; }
        _showFamilyAlbumManager(pickerOpts);
      });
    });
    form.appendChild(urlInput);
    form.appendChild(labelInput);
    form.appendChild(addBtn);
    form.appendChild(formStatus);
    mount.appendChild(form);

    const actions=_el('div','context-action-row');
    const backBtn=_el('button','context-btn','← Back to Photos');
    backBtn.type='button';
    backBtn.addEventListener('click',function(){ _showFamilyPhotosPicker(pickerOpts); });
    actions.appendChild(backBtn);
    actions.appendChild(_familyDoneBtn('✕ Close'));
    mount.appendChild(actions);

    FamilyAlbum.listAlbums().then(function(albums){
      if(!listWrap.isConnected) return;
      if(!albums.length){
        listWrap.appendChild(_el('div','context-family-status','No albums yet — add the first one below.'));
        return;
      }
      albums.forEach(function(a){
        listWrap.appendChild(_buildFamilyAlbumRow(a,pickerOpts));
      });
    });
  }

  function _buildFamilyAlbumRow(album,pickerOpts){
    const row=_el('div','context-family-album-row');
    const nameInput=document.createElement('input');
    nameInput.type='text';
    nameInput.className='context-family-input';
    nameInput.value=album.label||'';
    nameInput.placeholder='Album name';
    nameInput.addEventListener('change',function(){
      FamilyAlbum.updateAlbum(album.id,{label:(nameInput.value||'').trim()});
    });
    row.appendChild(nameInput);
    row.appendChild(_el('div','context-family-album-url',album.albumUrl));
    const btns=_el('div','context-family-album-btns');
    const relinkBtn=_el('button','context-btn','🔗 Replace Link');
    relinkBtn.type='button';
    relinkBtn.addEventListener('click',function(){
      const next=window.prompt('Paste the new shared album link:',album.albumUrl);
      if(next==null) return;
      FamilyAlbum.updateAlbum(album.id,{albumUrl:next.trim()}).then(function(res){
        if(!res.ok){ window.alert('That link didn\'t work ('+res.error+') — it should start with https://photos.app.goo.gl/…'); return; }
        try{ FamilyAlbum.clearPhotoCache(album.albumUrl); }catch(e){}
        _showFamilyAlbumManager(pickerOpts);
      });
    });
    const removeBtn=_el('button','context-btn context-btn-danger','🗑 Remove');
    removeBtn.type='button';
    removeBtn.addEventListener('click',function(){
      if(!window.confirm('Remove “'+(album.label||album.albumUrl)+'” from Family Photos? The album itself stays untouched in Google Photos.')) return;
      FamilyAlbum.removeAlbum(album.id).then(function(res){
        if(res.ok){
          try{ FamilyAlbum.clearPhotoCache(album.albumUrl); }catch(e){}
          if(_familyPickerAlbumId===album.id) _familyPickerAlbumId=null;
        }
        _showFamilyAlbumManager(pickerOpts);
      });
    });
    btns.appendChild(relinkBtn);
    btns.appendChild(removeBtn);
    row.appendChild(btns);
    return row;
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
  // is ALWAYS present but greyed out (disabled, no click) when the
  // active Theme has zero availableToCreator Collection assets — per
  // direct product decision ("the tile should always be there. just
  // grey it out when there is nothing to show"), reversing the earlier
  // hide-entirely behaviour, which read as the tile having vanished.
  // Voice is real now — per-page narration (record/import, Creator-only,
  // see _showVoicePanel above); voice-note OBJECTS on the canvas remain
  // the agreed follow-up ship.
  function _addSomethingItems(){
    const items=[
      {id:'stickers',icon:'😀',label:'Emojis',onClick:function(){ _showStickerStudio(); }},
      {id:'shapes',icon:'🔺',label:'Shapes',onClick:function(){ _showShapePicker(); }},
      {id:'text',icon:'🅰️',label:'Text',onClick:function(){ _addTextObject(); }},
      {id:'doodle',icon:'✏️',label:'Doodle',onClick:function(){ _addDoodleObject(); }},
      {id:'photo',icon:'🖼️',label:'Photo',onClick:function(){ _addImageObject(); }}
    ];
    // Family Photos — shown whenever the repository layer is configured
    // at all (an unconfigured deployment can never have albums, so the
    // row would be a dead end there — same conditional-presence
    // discipline as "From This World" below). A Traveller DOES see the
    // row: tapping it shows the companion-framed gate, the product's
    // own deliberate nudge toward a first Publish.
    if(_familyPhotosAvailable()){
      items.push({id:'family',icon:'📷',label:'Family Photos',onClick:function(){ _showFamilyPhotosPicker(); }});
    }
    items.push({
      id:'fromWorld',icon:'🎁',label:'From This World',
      disabled:_activeCollectionAssets().length===0,
      onClick:function(){ _showCollectionPicker(); }
    });
    items.push({id:'voice',icon:'🎤',label:'Voice',onClick:function(){ _showVoicePanel(); }});
    return items;
  }

  // Drawn icons for the Add Something tiles. An emoji is a different
  // picture on every operating system, which is a real problem for a
  // product whose entire vocabulary is visual — and at tile size the
  // system faces read as flat glyphs rather than as things a child
  // might want to touch. Each entry is static, code-authored markup,
  // keyed by the item id; anything without one falls back to the emoji
  // it always used.
  const ADD_ART={
    stickers:'<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="16" r="12" fill="#FFD84D"/><circle cx="11.6" cy="13.6" r="1.9" fill="#3B2E00"/><circle cx="20.4" cy="13.6" r="1.9" fill="#3B2E00"/><path d="M10.4 19.4a6.4 6.4 0 0011.2 0" fill="none" stroke="#3B2E00" stroke-width="2" stroke-linecap="round"/><circle cx="8.2" cy="18.4" r="2.1" fill="#FF9EB5" opacity=".75"/><circle cx="23.8" cy="18.4" r="2.1" fill="#FF9EB5" opacity=".75"/></svg>',
    shapes:'<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="12" cy="12" r="7.5" fill="#5B9CF8"/><path d="M21 8l7 12H14z" fill="#F26D8B" opacity=".92"/><rect x="9" y="17" width="11" height="11" rx="2.6" fill="#9B7BEA" opacity=".9"/></svg>',
    text:'<svg viewBox="0 0 32 32" width="30" height="30"><rect x="4" y="4" width="24" height="24" rx="7" fill="#FFFFFF"/><path d="M16 8.5l6 15h-3.1l-1.3-3.6h-6.2L10.1 23.5H7zm0 4.6l-2.1 5.4h4.2z" fill="#F2506A"/></svg>',
    doodle:'<svg viewBox="0 0 32 32" width="30" height="30"><path d="M7 25l1.6-5 12-12 3.4 3.4-12 12z" fill="#FFD84D"/><path d="M20.6 8l3.4 3.4 2.2-2.2a2.4 2.4 0 00-3.4-3.4z" fill="#F4A0B6"/><path d="M7 25l1.6-5 1.7 1.7z" fill="#4A5578"/></svg>',
    photo:'<svg viewBox="0 0 32 32" width="30" height="30"><rect x="4" y="7" width="24" height="18" rx="4" fill="#FFFFFF" stroke="#C6D2EC" stroke-width="1.6"/><circle cx="11" cy="13" r="2.6" fill="#FFD84D"/><path d="M7 23.4l6.4-7.4 4.6 5.4 3.4-3.4 4.6 5.4z" fill="#5BBE97"/></svg>',
    family:'<svg viewBox="0 0 32 32" width="30" height="30"><rect x="3" y="9" width="26" height="16" rx="4.5" fill="#33477E"/><path d="M11.5 9l1.8-2.6h5.4L20.5 9z" fill="#33477E"/><circle cx="16" cy="17" r="5.4" fill="#8FB6F5"/><circle cx="16" cy="17" r="2.4" fill="#FFFFFF" opacity=".85"/></svg>',
    fromWorld:'<svg viewBox="0 0 32 32" width="30" height="30"><rect x="4" y="13" width="24" height="15" rx="3" fill="#F2506A"/><rect x="3" y="9" width="26" height="6" rx="2.4" fill="#FF7B90"/><rect x="13.6" y="9" width="4.8" height="19" fill="#FFD84D"/><path d="M16 9c-3-4-8-1-4 2M16 9c3-4 8-1 4 2" fill="none" stroke="#FFD84D" stroke-width="2.4" stroke-linecap="round"/></svg>',
    voice:'<svg viewBox="0 0 32 32" width="30" height="30"><rect x="12" y="4" width="8" height="14" rx="4" fill="#33477E"/><path d="M8.5 15a7.5 7.5 0 0015 0" fill="none" stroke="#33477E" stroke-width="2.4" stroke-linecap="round"/><path d="M16 22.5V27M12 27h8" stroke="#33477E" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };

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
        // The item's own id, on the element. Additive and purely
        // descriptive — it gives anything outside this panel a stable
        // handle on a card that isn't its visible label (which is
        // child-facing copy and can change). The Studio Rite uses it to
        // quiet the cards its story never asks for.
        row.setAttribute('data-add-id',item.id||'');
        const art=ADD_ART[item.id];
        const iconWrap=art?_el('span','context-add-card-icon'):_el('span','context-add-card-icon',item.icon);
        if(art) iconWrap.innerHTML=art;
        row.appendChild(iconWrap);
        row.appendChild(_el('span','context-add-card-label',item.label));
        if(item.comingSoon){
          row.appendChild(_el('span','context-add-card-soon','Soon'));
          row.disabled=true;
        }else if(item.disabled){
          // Greyed, not hidden — the capability exists, this World just
          // has nothing to offer through it right now (From This World
          // with zero Creator-flagged Collection assets). Same muted
          // .is-coming-soon visual, deliberately no "Soon" pill since
          // the message is "empty," not "unbuilt."
          row.classList.add('is-coming-soon');
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
    tiles.appendChild(_buildPageShapeTile());
    tiles.appendChild(_buildBackgroundTile());
    const changeLookTile=_buildChangeLookTile();
    if(changeLookTile) tiles.appendChild(changeLookTile);
    const captionTile=_buildCaptionTile();
    if(captionTile) tiles.appendChild(captionTile);
    zone.appendChild(tiles);
    container.appendChild(zone);
  }

  // ---------- Page Shape ----------
  //
  // Orientation and whether the page has a picture area at all, PER
  // PAGE — the product owner's own call when asked whether it should be
  // per page or per story. Per page is what the renderer seam supports
  // and it is the freer answer: a story can open on a wide landscape
  // page and turn to a tall one.
  //
  // Both write plain page metadata that the renderer already reads
  // (`aspect` → the layout rect and the scene viewport; `noPlace` →
  // "this page declares it has no picture area"). Neither invents a
  // concept: the aspect vocabulary is World Builder v2's own, and
  // `noPlace` was already honoured everywhere, it simply had no control
  // and had only ever been set by the Studio Rite.
  var PAGE_SHAPES=[
    ['portrait','📖','Tall'],
    ['landscape','🖼️','Wide'],
    ['square','⬜','Square']
  ];

  function _appendPageShape(container){
    const slide=_currentSlide();
    if(!slide) return;
    if(!slide.metadata) slide.metadata={};

    function changed(){
      // The page's own picture is now the wrong shape or gone, so the
      // strip has to draw it again rather than reuse what it has.
      delete slide.thumbnail;
      if(host && typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(host && typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
      _debouncedObjectStripRefresh();
      refresh();
    }

    container.appendChild(_el('div','context-panel-heading','Shape'));
    const row=_el('div','designer-row context-row');
    // The codebase's own chip vocabulary (css/style.css, .preview-chip),
    // reused rather than a new class — a chip row invented here would
    // arrive with no styles at all, which is exactly what happened the
    // first time this was written.
    const chips=_el('div','preview-chip-row');
    const current=slide.metadata.aspect||null;
    PAGE_SHAPES.forEach(function(shape){
      const chip=_el('button','preview-chip'+((current===shape[0])?' active':''),
        shape[1]+' '+shape[2]);
      chip.type='button';
      chip.addEventListener('click',function(){
        if(slide.metadata.aspect===shape[0]) delete slide.metadata.aspect;
        else slide.metadata.aspect=shape[0];
        changed();
      });
      chips.appendChild(chip);
    });
    row.appendChild(chips);
    container.appendChild(row);

    // A page with no picture area at all. Real pages want this — a page
    // that is only words, an ending, a dedication — and until now the
    // only way to have one was to leave the picture empty, which draws
    // an invitation to add artwork rather than a page that has none.
    container.appendChild(_el('div','context-panel-heading','Picture Area'));
    const hasRow=_el('div','designer-row context-row');
    const hasWrap=document.createElement('label');
    hasWrap.className='context-transparent-toggle';
    hasWrap.style.display='inline-flex';
    hasWrap.style.alignItems='center';
    hasWrap.style.gap='6px';
    hasWrap.style.fontSize='13px';
    const hasCb=document.createElement('input');
    hasCb.type='checkbox';
    hasCb.checked=!slide.metadata.noPlace;
    hasCb.addEventListener('change',function(){
      if(hasCb.checked) delete slide.metadata.noPlace;
      else slide.metadata.noPlace=true;
      changed();
    });
    hasWrap.appendChild(hasCb);
    const hasLbl=document.createElement('span');
    hasLbl.textContent='This page has a picture';
    hasWrap.appendChild(hasLbl);
    hasRow.appendChild(hasWrap);
    container.appendChild(hasRow);
  }

  function _buildPageShapeTile(){
    const wrap=_el('div','context-set-tile');
    const trigger=_el('button','context-set-trigger');
    trigger.type='button';
    trigger.appendChild(_el('span','context-set-trigger-label','📐 Page Shape'));
    trigger.appendChild(_el('span','context-accordion-chevron',personalizeOpenSection==='shape'?'▴':'▾'));
    trigger.addEventListener('click',function(){
      personalizeOpenSection=(personalizeOpenSection==='shape')?null:'shape';
      refresh();
    });
    wrap.appendChild(trigger);
    if(personalizeOpenSection==='shape'){
      const body=_el('div','context-set-body');
      _appendPageShape(body);
      wrap.appendChild(body);
    }
    return wrap;
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
    mountQuickEditControl:mountQuickEditControl,
    // Family Photos, exposed for OTHER modules' own replace-image
    // surfaces (js/pageDesigner.js's Cover/Hook/End Image Manager) —
    // "wherever we have replace image ... it should be able to replace
    // from local as well as family photos". availability = configured +
    // FamilyAlbum loaded; the picker itself carries the Traveller gate.
    familyPhotosAvailable:_familyPhotosAvailable,
    openFamilyPhotosPicker:_showFamilyPhotosPicker
  };
})();
try{ window.ContextPanel=ContextPanel; }catch(e){}
