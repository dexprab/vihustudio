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
    getCurrentSlide:function(){ return null; }
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
    window.addEventListener('resize',function(){ _positionWidget(); });
    refresh();
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
    let editable;
    if(obj){
      editable=!!obj.editable;
    }else{
      // A Place has no render-tree bbox entry — ask the Theme Author's
      // own compiled guardrail directly, mirroring js/cardDesigner.js's
      // own established _placeEditableGuard pattern.
      const slide=cfg.getCurrentSlide();
      if(slide && typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getPlacePermissions==='function'){
        try{
          const perm=SlideRenderer.getPlacePermissions(slide,sel.sceneId);
          editable=!perm || perm.editable!==false;
        }catch(e){ editable=true; }
      }else{
        editable=true;
      }
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
    // shows. A Scene Object's Edit button shows only when it's genuinely
    // editable, matching Rule 2 (Guardrails): "Every object on Scene
    // honors the guardrails."
    if(editBtn) editBtn.classList.toggle('selection-action-btn-hidden',!isPlace && !editable);

    if(_editOpen) _openEditPanel(); // keep an already-open popup in sync across a live redraw
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

    let mounted=false;
    if(obj && typeof ContextPanel!=='undefined' && typeof ContextPanel.mountQuickEditControl==='function'){
      try{ mounted=ContextPanel.mountQuickEditControl(editPanelEl,obj); }catch(e){ mounted=false; }
    }
    if(!mounted) _openPanelFallback();
    _positionWidget();
  }

  function _positionWidget(){
    if(!root || root.classList.contains('selection-action-strip-hidden')) return;
    const area=document.querySelector('.preview-area');
    const canvas=document.getElementById('previewCanvas');
    root.classList.remove('selection-action-strip-side-left','selection-action-strip-side-right','selection-action-strip-top');
    if(!area || !canvas){
      root.classList.add('selection-action-strip-top');
      return;
    }
    const areaRect=area.getBoundingClientRect();
    const canvasRect=canvas.getBoundingClientRect();
    const w=root.offsetWidth||220;
    const GAP=16;
    const rightGutter=areaRect.right-canvasRect.right;
    const leftGutter=canvasRect.left-areaRect.left;
    if(rightGutter>=w+GAP){
      // A real gutter exists to the right of the canvas within the
      // preview column — anchoring the whole widget's x-range there
      // puts it entirely outside the canvas's own x-range, so it can
      // never overlap it no matter how tall the inline edit popup below
      // grows.
      root.classList.add('selection-action-strip-side-right');
    }else if(leftGutter>=w+GAP){
      root.classList.add('selection-action-strip-side-left');
    }else{
      // No real side gutter (a narrow viewport where the canvas spans
      // the whole column) — fall back to a compact, normal-flow
      // placement ABOVE the canvas, which structurally can never
      // overlap it.
      root.classList.add('selection-action-strip-top');
    }
  }

  return {configure:configure, init:init, refresh:refresh};
})();
try{ window.SelectionActionStrip=SelectionActionStrip; }catch(e){}
