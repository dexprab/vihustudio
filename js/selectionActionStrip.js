// selectionActionStrip.js — Option B (Refined), pencil/small-side-widget
// follow-up. A small, always-reliable action strip for whatever Scene
// Object is currently selected on the canvas — the ownership status
// (matching Object Strip's own established badge wording exactly), a
// friendly icon+name, and quick actions.
//
// Positioned as a small floating widget in the SIDE gutter beside the
// canvas (never a full-width bar spanning the top) — _positionWidget()
// measures the real, current gap between the canvas's own rendered rect
// and the preview column's edges and anchors there; only when no real
// gutter exists at all (a narrow viewport where the canvas spans the
// whole column) does it fall back to a compact, normal-flow placement
// ABOVE the canvas, which by construction can never overlap it either.
// This is the hard, standing constraint from the prior sprint: "any new
// tool which opens up cannot be over the slide in centerpane."
//
// Clicking Edit opens a small inline popup, right inside this widget,
// with the REAL editing control for the selected object — reusing
// ContextPanel.mountQuickEditControl() (js/contextPanel.js) rather than
// a second implementation, so this strip's control and the right
// panel's own World-object disclosure can never disagree about what a
// field means or where it writes. When there's no real inline control
// for this object (a Story-owned object, whose Refine controls live in
// CardDesigner's own sections; a World-owned object with no editable
// quick-edit shape at all), the popup instead shows a plain hint plus a
// link into the right panel — never a misleadingly-empty box.
//
// This is a complement to, not a replacement for, the on-canvas
// selection outline + resize handles (renderer/slideRenderer.js's
// _drawSelectionOutline/_drawResizeHandles), which are unchanged — those
// stay the direct-manipulation grips; this is the reliable, always-
// visible summary + shortcut.
//
// Reordering is deliberately NOT one of this strip's actions — Object
// Strip's own drag-to-reorder is already the one, explicit reorder
// control (Unified Layer Ordering / "Object Strip Becomes the ONE
// Reorder Control" sprints), and this strip isn't meant to reintroduce a
// second one.
//
// Refreshed from PageRuntime.notify()'s own dispatch list, the same real
// choke point ObjectStrip/ContextPanel already use — no wiring of its
// own beyond that one hook.
const SelectionActionStrip=(function(){
  let cfg={
    focusEditor:function(){},
    getCurrentSlide:function(){ return null; },
    // "change the size and shape of place if story author has allowed
    // it" — a resizable Place's Shape picker (below) needs the exact
    // same redraw/markDirty hooks js/contextPanel.js's own
    // _afterQuickEditChange() already uses for a World-owned object
    // edit; wired by js/app.js's own SelectionActionStrip.configure(...)
    // call, mirroring its identical ContextPanel.configure(...) wiring.
    redraw:function(){},
    markDirty:function(){}
  };
  let root=null, badgeEl=null, nameEl=null, ownerEl=null, editBtn=null, deselectBtn=null, editPanelEl=null;
  // Tracks which object the inline popup currently belongs to, so a
  // routine same-selection refresh() (e.g. while a Story Author is
  // mid-keystroke inside the popup's own Words textarea) never rebuilds
  // it out from under them — matches contextPanel.js's own established
  // "never rebuild mid-edit" rule.
  let _lastKey=null, _editOpen=false;

  function configure(opts){ cfg=Object.assign({},cfg,opts||{}); }

  function init(){
    root=document.getElementById('selectionActionStrip');
    if(!root) return;
    badgeEl=document.getElementById('selectionActionBadge');
    nameEl=document.getElementById('selectionActionName');
    ownerEl=document.getElementById('selectionActionOwner');
    editBtn=document.getElementById('selectionActionEdit');
    deselectBtn=document.getElementById('selectionActionDeselect');
    editPanelEl=document.getElementById('selectionActionEditPanel');
    if(editBtn){
      editBtn.addEventListener('click',function(){
        if(_editOpen) _closeEditPanel(); else _openEditPanel();
      });
    }
    if(deselectBtn){
      deselectBtn.addEventListener('click',function(){
        _closeEditPanel();
        if(typeof PageRuntime!=='undefined'){ try{ PageRuntime.clearSelection(); }catch(e){} }
      });
    }
    // Real multi-line content ("this is not what is intended" follow-up)
    // needs the Words textarea to genuinely grow to fit what's typed,
    // never hide extra lines behind its own inner scrollbar while the
    // popup's own outer overflow stays the true last resort. One
    // delegated listener here (rather than special-casing this inside
    // contextPanel.js's own textarea-building code, which has no reason
    // to know about this popup's own chrome) autosizes ANY textarea
    // mounted into the popup, live, on every keystroke.
    if(editPanelEl){
      editPanelEl.addEventListener('input',function(e){
        if(e.target && e.target.tagName==='TEXTAREA') _autosizeTextarea(e.target);
      });
    }
    window.addEventListener('resize',function(){ _positionWidget(); });
    refresh();
  }

  function _autosizeTextarea(el){
    el.style.height='auto';
    el.style.height=el.scrollHeight+'px';
  }

  // A small, closed icon table mirroring Object Strip's own FRIENDLY_TYPE
  // (js/objectStrip.js) — kept as its own copy rather than a shared
  // import, matching this codebase's own established precedent for small,
  // per-module vocabulary tables.
  function _friendlyIcon(type){
    if(type==='image-holder') return '🖼️';
    if(type==='text') return '✏️';
    if(type==='sticker') return '✨';
    if(type==='decoration') return '🎀';
    return '🔷';
  }

  function _hide(){
    if(root) root.classList.add('selection-action-strip-hidden');
    _closeEditPanel();
    _lastKey=null;
  }

  function _closeEditPanel(){
    _editOpen=false;
    if(editBtn) editBtn.setAttribute('aria-expanded','false');
    if(editPanelEl){
      editPanelEl.innerHTML='';
      editPanelEl.classList.add('selection-action-edit-panel-hidden');
    }
  }

  function _currentSceneObject(sel){
    if(typeof PageRuntime==='undefined' || !sel) return null;
    const objects=(PageRuntime.getRenderedObjects().scene)||[];
    return objects.find(function(o){ return o.id===sel.sceneId; })||null;
  }

  // Guardrails — a Place has no render-tree bbox entry of its own, so
  // both refresh() (below, for `editable`) and _openEditPanel() (for
  // `resizable`, gating the new Shape picker) ask the Theme Author's own
  // compiled permissions directly via renderer/slideRenderer.js's
  // getPlacePermissions — factored into one shared helper so the two
  // call sites can never disagree about what a given Place is actually
  // allowed. Mirrors js/cardDesigner.js's own established
  // _placeEditableGuard pattern. `resizable` follows `moveable`'s own
  // "absent resolves to false/closed" convention (renderer/
  // slideRenderer.js's _resolvePlacePermissions) — a Place with no
  // `resizable` value authored at all (every Place shipped before this
  // feature) correctly resolves closed here too.
  function _resolvePlacePerm(sceneId){
    const slide=cfg.getCurrentSlide();
    if(slide && typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlacePermissions==='function'){
      try{
        const perm=SlideRenderer.getPlacePermissions(slide,sceneId);
        return {
          editable: !perm || perm.editable!==false,
          resizable: !!(perm && perm.resizable),
          // `rotatable` follows `resizable`'s own "absent → closed"
          // convention (renderer/slideRenderer.js's _resolvePlacePermissions).
          rotatable: !!(perm && perm.rotatable)
        };
      }catch(e){ /* fall through to the safe default below */ }
    }
    return {editable:true, resizable:false, rotatable:false};
  }

  function refresh(){
    if(!root) return;
    if(typeof PageRuntime==='undefined'){ _hide(); return; }
    const sel=PageRuntime.getSelection();
    // Scoped to Scene Object selection (Places/decorations/stickers/
    // text Layers) — the same population the on-canvas outline/resize
    // grid apply to. A plain Story Theme text selection (Story Text/
    // Handle/Footer/Page Number, a different selection channel per
    // pageRuntime.js's own documented "two explicit functions, not one"
    // design) has no on-canvas grip of its own either, so it's out of
    // scope here too.
    if(!sel || !sel.sceneId || !PageRuntime.selectionIsValid()){ _hide(); return; }
    const obj=_currentSceneObject(sel);
    // A Place ('image-holder', or 'image-place-N' for an extra Place)
    // has no render-tree bbox entry of its own (Multiple Artwork Places
    // Per Page's own established convention — selectionIsValid() already
    // special-cases this the same way) — still show the strip for it,
    // using the selection's own sceneType.
    const isPlace=sel.sceneType==='image-holder';
    if(!obj && !isPlace){ _hide(); return; }

    const key=sel.sceneId+'|'+sel.sceneType;
    if(key!==_lastKey){
      _closeEditPanel();
      _lastKey=key;
    }

    root.classList.remove('selection-action-strip-hidden');
    const type=(obj && obj.type)||sel.sceneType;
    const label=(obj && obj.label)||(isPlace ? 'Artwork' : 'Object');
    const owner=obj ? obj.owner : 'story';
    let editable, moveable;
    if(obj){
      editable=!!obj.editable;
      moveable=!!obj.moveable;
    }else{
      const perm=_resolvePlacePerm(sel.sceneId);
      editable=perm.editable;
      moveable=true; // unused for a Place — its Edit button always shows regardless (see below)
    }

    if(badgeEl) badgeEl.textContent=_friendlyIcon(type);
    if(nameEl) nameEl.textContent=label;
    if(ownerEl){
      // Exactly Object Strip's own badge wording (js/objectStrip.js) so
      // the two surfaces never disagree about the same object.
      ownerEl.textContent=editable ? '🟢 You can edit' : (owner==='world' ? '🌍 Part of the World' : '🔒 Locked');
    }
    // A Place always has real, reachable Refine controls (Fit/Frame/
    // Presentation, in the existing right-panel section) even though it
    // has no in-place quick-edit shape here — so its Edit button always
    // shows. A Scene Object's Edit button shows whenever EITHER honor is
    // true — Rotation is gated on moveable alone (a spatial transform,
    // not a content edit), so a moveable:true/editable:false object
    // still needs a reachable Edit button for its Rotation slider, even
    // though mountQuickEditControl's content controls (Words/Colour/
    // Image/Font/Size/Weight/Style/Alignment/Opacity) stay editable-only.
    // Matches Rule 2 (Guardrails): "Every object on Scene honors the
    // guardrails" — never shows a button that would open to nothing.
    if(editBtn) editBtn.classList.toggle('selection-action-btn-hidden',!isPlace && !editable && !moveable);

    // Real bug found investigating "the change seems to be happening but
    // not showing up on center pane": this used to call _openEditPanel()
    // again on EVERY refresh() while the popup was open, "to keep it in
    // sync" — but _openEditPanel() tears down and rebuilds the whole
    // popup (editPanelEl.innerHTML=''), including a fresh <textarea> with
    // no focus. refresh() fires on essentially every PageRuntime.notify()
    // in the whole app (any page mutation, any unrelated selection
    // elsewhere, autosave, companion sync ticks) — so a Story Author
    // mid-keystroke here could have the textarea silently swapped out
    // from under their cursor by something completely unrelated,
    // discarding focus for every keystroke typed after that point even
    // though the value shown looked correct. This directly violated this
    // module's own stated "never rebuild mid-edit" rule (see the header
    // comment and the _lastKey tracking above, which already exists
    // specifically to prevent this). Fixed by simply never rebuilding an
    // already-open popup on a same-selection refresh — a genuinely NEW
    // selection already closes it via _closeEditPanel() in the
    // key-changed branch above, so there is nothing left to "keep in
    // sync" here.
    _positionWidget();
  }

  function _hintEl(text){
    const p=document.createElement('div');
    p.className='selection-action-edit-hint';
    p.textContent=text;
    return p;
  }

  function _openPanelFallback(){
    editPanelEl.appendChild(_hintEl('Open the right panel to edit this.'));
    const link=document.createElement('button');
    link.type='button';
    link.className='selection-action-open-panel-btn';
    link.textContent='Open Right Panel →';
    link.addEventListener('click',function(){ try{ cfg.focusEditor(); }catch(e){} });
    editPanelEl.appendChild(link);
  }

  function _openEditPanel(){
    if(!editPanelEl) return;
    _editOpen=true;
    if(editBtn) editBtn.setAttribute('aria-expanded','true');
    editPanelEl.innerHTML='';
    editPanelEl.classList.remove('selection-action-edit-panel-hidden');

    const sel=(typeof PageRuntime!=='undefined') ? PageRuntime.getSelection() : null;
    const obj=sel ? _currentSceneObject(sel) : null;
    const isPlace=!!(sel && sel.sceneType==='image-holder');

    let mounted=false;
    if(obj && typeof ContextPanel!=='undefined' && typeof ContextPanel.mountQuickEditControl==='function'){
      try{ mounted=ContextPanel.mountQuickEditControl(editPanelEl,obj); }catch(e){ mounted=false; }
    }
    // "change the size and shape of place if story author has allowed
    // it" — a resizable Place gets a real Shape picker here, the one
    // in-place quick-edit control a Place can have. A Place's SIZE
    // itself is changed only via its own on-canvas resize handles
    // (js/app.js's generic resize-drag handler, gated on this same
    // `resizable` permission through renderer/slideRenderer.js's
    // _supportsResize) — mirroring how every other resizable object in
    // this app (Sticker/Text/Decoration) has its own size changed by
    // dragging its handles, never a popup slider; a non-resizable Place
    // (or one authored before this feature at all, absent → closed —
    // see _resolvePlacePerm above) falls through to the existing,
    // unchanged plain fallback below. Rotation joins as the third
    // in-place Place quick-edit control, gated independently on
    // `rotatable` — a Place can be rotatable without being resizable, or
    // resizable without being rotatable, each honor standing alone;
    // BOTH mount when both are enabled, unlike a Scene Object where
    // mountQuickEditControl returns a single-shot bool.
    if(isPlace){
      const perm=_resolvePlacePerm(sel.sceneId);
      if(perm.resizable){
        if(_mountPlaceShapePicker(editPanelEl,sel.sceneId)) mounted=true;
      }
      if(perm.rotatable){
        if(_mountPlaceRotationSlider(editPanelEl,sel.sceneId)) mounted=true;
      }
    }
    if(!mounted) _openPanelFallback();
    // _positionWidget() first — it's what fixes the popup's own final
    // width, and a textarea's scrollHeight (what the autosize pass below
    // measures) depends on that width being settled already, not
    // whatever width the popup happened to have before this open.
    _positionWidget();
    const areas=editPanelEl.querySelectorAll('textarea');
    for(let i=0;i<areas.length;i++) _autosizeTextarea(areas[i]);
  }

  // Runs the exact same redraw/markDirty/ObjectStrip.refresh() sequence
  // js/contextPanel.js's own _afterQuickEditChange() runs after a
  // World-owned object edit — kept as this module's own small copy
  // (matching the established per-module vocabulary-table duplication
  // precedent already used for _friendlyIcon above) rather than reaching
  // into contextPanel.js's own closure-private function.
  function _afterPlaceEdit(){
    if(typeof cfg.redraw==='function'){ try{ cfg.redraw(); }catch(e){ try{ console.error('[Selection Action Strip] redraw after Place edit failed:',e); }catch(_){} } }
    if(typeof cfg.markDirty==='function'){ try{ cfg.markDirty(); }catch(e){ try{ console.error('[Selection Action Strip] markDirty after Place edit failed:',e); }catch(_){} } }
    if(typeof ObjectStrip!=='undefined' && typeof ObjectStrip.refresh==='function'){ try{ ObjectStrip.refresh(); }catch(e){ try{ console.error('[Selection Action Strip] ObjectStrip.refresh after Place edit failed:',e); }catch(_){} } }
  }

  // Reuses the exact .designer-row/.designer-row-label/.icon-row/
  // .icon-card/.icon-label/.active vocabulary js/contextPanel.js's own
  // _makeIconChoiceRow already established for every other single-select
  // icon-choice control in this app (Font Style/Alignment, etc.) — this
  // reads as the same control language, not a new one, and needs zero
  // new CSS of its own (.selection-action-edit-panel .icon-row/.icon-
  // card already have their own popup-scoped overrides, css/style.css).
  const PLACE_SHAPE_CHOICES=[['rectangle','▭ Rectangle'],['rounded','▢ Rounded'],['circle','⬤ Circle']];

  function _mountPlaceShapePicker(container,sceneId){
    const slide=cfg.getCurrentSlide();
    if(!slide) return false;
    let current='rectangle';
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceShape==='function'){
      try{ current=SlideRenderer.getPlaceShape(slide,sceneId)||'rectangle'; }catch(e){}
    }
    const row=document.createElement('div');
    row.className='designer-row context-row';
    const label=document.createElement('div');
    label.className='designer-row-label';
    label.textContent='Shape';
    row.appendChild(label);
    const icons=document.createElement('div');
    icons.className='icon-row';
    PLACE_SHAPE_CHOICES.forEach(function(c){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card'+(current===c[0]?' active':'');
      const lbl=document.createElement('span');
      lbl.className='icon-label';
      lbl.textContent=c[1];
      btn.appendChild(lbl);
      btn.addEventListener('click',function(){
        if(current===c[0]) return;
        if(typeof SceneEngine==='undefined' || typeof SceneEngine.setContentOverride!=='function') return;
        try{ SceneEngine.setContentOverride(slide,sceneId,'shape',c[0]); }catch(e){ return; }
        _afterPlaceEdit();
        _openEditPanel(); // rebuild the popup so the newly-picked shape shows as active
      });
      icons.appendChild(btn);
    });
    row.appendChild(icons);
    container.appendChild(row);
    return true;
  }

  // Rotation slider for a rotatable Place — gated on the Theme Author's
  // own `rotatable` permission via _resolvePlacePerm above. Writes
  // through the exact same generic override-bag mutator every other
  // Story-Author Place edit uses (SceneEngine.setContentOverride) —
  // renderer/slideRenderer.js's own render loop reads the resolved
  // rotation via SlideRenderer.getPlaceRotation (which honours the
  // same rotatable gate on the read side, so a Theme Author dropping
  // the permission after a Story Author had already dialed one in
  // correctly falls back to the Theme-Author base without silently
  // preserving the now-un-authorized override). Range is 0-359 degrees,
  // matching the identical convention every other rotation field in
  // this app already uses (World-owned Text rotation, Image Layer
  // rotation, Shape rotation).
  function _mountPlaceRotationSlider(container,sceneId){
    const slide=cfg.getCurrentSlide();
    if(!slide) return false;
    let current=0;
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlaceRotation==='function'){
      try{ current=SlideRenderer.getPlaceRotation(slide,sceneId)||0; }catch(e){}
    }
    // Mirrors js/contextPanel.js's own _makeRangeRow shape exactly —
    // same class vocabulary (.designer-row/.designer-row-label
    // .text-slider-label + a .context-range-value span + a
    // .context-range-input slider) so the CSS this codebase already
    // ships styles it identically to every other range control in the
    // popup with zero new rules of its own.
    const row=document.createElement('div');
    row.className='designer-row context-row';
    const label=document.createElement('div');
    label.className='designer-row-label text-slider-label';
    const labelText=document.createElement('span');
    labelText.textContent='Rotation';
    const valueSpan=document.createElement('span');
    valueSpan.className='context-range-value';
    valueSpan.textContent=Math.round(current)+'°';
    label.appendChild(labelText);
    label.appendChild(valueSpan);
    row.appendChild(label);
    const input=document.createElement('input');
    input.type='range';
    input.min='0';
    input.max='359';
    input.step='1';
    input.value=String(Math.round(current));
    input.className='context-range-input';
    input.addEventListener('input',function(){
      const v=Number(input.value)||0;
      valueSpan.textContent=v+'°';
      if(typeof SceneEngine==='undefined' || typeof SceneEngine.setContentOverride!=='function') return;
      try{ SceneEngine.setContentOverride(slide,sceneId,'rotation',v); }catch(e){ return; }
      _afterPlaceEdit();
    });
    row.appendChild(input);
    container.appendChild(row);
    return true;
  }

  // Real bug found via a second, real-content regression report ("this is
  // not what is intended"): the ORIGINAL version of this function required
  // the widget's FULL width to fit inside the narrow gutter between the
  // canvas and .preview-area's own edge before choosing a side placement
  // at all — reasonable when the widget was position:absolute and
  // strictly confined inside .preview-area's own overflow:hidden box, but
  // once the user explicitly relaxed the constraint ("context menu can
  // overlap on right and left panel that should be ok if needed") and the
  // widget switched to position:fixed (css/style.css, escaping that
  // clipping so it can genuinely render over the sidebar), that same
  // strict gutter-fit check would have kept pushing the now-wider popup
  // into the less useful 'top' fallback for no reason — it no longer
  // needs the FULL width to fit in the gutter, only *some* real room past
  // the canvas's own edge to safely anchor against.
  //
  // Rewritten around one real, load-bearing invariant instead: whichever
  // side is chosen, the widget's near edge is always placed strictly on
  // the far side of the canvas's own edge (never crossing into it,
  // structurally — the one constraint that stays hard), and its own
  // WIDTH is capped to whatever room genuinely exists between that near
  // edge and the true viewport edge — so it can extend into the sidebar
  // as far as it likes without ever crossing the canvas OR spilling off
  // the real screen. This is deliberately a width-cap, not a position-
  // clamp: clamping the *position* toward the viewport edge when the
  // widget is wider than the available room would risk sliding its far
  // edge back across the canvas boundary — capping the *width* instead
  // means the far edge can never be computed past the viewport, by
  // construction, regardless of how little room is actually available.
  function _positionWidget(){
    if(!root || root.classList.contains('selection-action-strip-hidden')) return;
    const area=document.querySelector('.preview-area');
    const canvas=document.getElementById('previewCanvas');
    root.classList.remove('selection-action-strip-side-left','selection-action-strip-side-right','selection-action-strip-top');
    root.style.top='';
    root.style.left='';
    root.style.maxWidth='';
    root.style.maxHeight='';
    if(!area || !canvas){
      root.classList.add('selection-action-strip-top');
      return;
    }
    const areaRect=area.getBoundingClientRect();
    const canvasRect=canvas.getBoundingClientRect();
    const GAP=16; // clearance kept between the canvas's own edge and the widget's near edge
    const EDGE=8; // safety margin from the true viewport edge, so the widget is never flush against it
    const MAX_WIDTH=440; // matches the CSS ceiling — never grown past this even when more room exists
    const MIN_USABLE=160; // matches min-width; below this on a side, a floating widget genuinely isn't useful there
    const spaceRight=window.innerWidth-canvasRect.right-GAP-EDGE;
    const spaceLeft=canvasRect.left-GAP-EDGE;
    const top=areaRect.top+16;
    if(spaceRight>=MIN_USABLE){
      root.classList.add('selection-action-strip-side-right');
      const width=Math.min(MAX_WIDTH,spaceRight);
      root.style.maxWidth=width+'px';
      root.style.left=(canvasRect.right+GAP)+'px';
      root.style.top=top+'px';
      root.style.maxHeight=(window.innerHeight-top-16)+'px';
    }else if(spaceLeft>=MIN_USABLE){
      root.classList.add('selection-action-strip-side-left');
      const width=Math.min(MAX_WIDTH,spaceLeft);
      root.style.maxWidth=width+'px';
      root.style.left=(canvasRect.left-GAP-width)+'px';
      root.style.top=top+'px';
      root.style.maxHeight=(window.innerHeight-top-16)+'px';
    }else{
      // Neither side has genuinely enough room (a narrow viewport where
      // the .workspace media queries have already collapsed the
      // sidebars out of the layout, css/style.css ~line 3057) — fall
      // back to a compact, normal-flow placement ABOVE the canvas, which
      // structurally can never overlap it either.
      root.classList.add('selection-action-strip-top');
    }
  }

  return {configure:configure, init:init, refresh:refresh};
})();
try{ window.SelectionActionStrip=SelectionActionStrip; }catch(e){}
