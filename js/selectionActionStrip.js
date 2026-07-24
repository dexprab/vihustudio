// selectionActionStrip.js — Option B (Refined). A small, always-reliable
// action strip for whatever Scene Object is currently selected on the
// canvas — the ownership status (matching Object Strip's own established
// badge wording exactly), a friendly icon+name, and quick actions.
//
// Deliberately anchored ABOVE the canvas frame itself (a sibling of
// .preview-wrapper in index.html, positioned by the center column's own
// flex layout, never relative to the selected object's own on-canvas
// coordinates) — so it can never end up floating over the slide, no
// matter where on the page the selected object sits. This is a
// complement to, not a replacement for, the on-canvas selection outline
// + resize handles (renderer/slideRenderer.js's _drawSelectionOutline/
// _drawResizeHandles), which are unchanged — those stay the direct-
// manipulation grips; this is the reliable, always-visible summary +
// shortcut.
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
    focusEditor:function(){}
  };
  let root=null, badgeEl=null, nameEl=null, ownerEl=null, editBtn=null, deselectBtn=null;

  function configure(opts){ cfg=Object.assign({},cfg,opts||{}); }

  function init(){
    root=document.getElementById('selectionActionStrip');
    if(!root) return;
    badgeEl=document.getElementById('selectionActionBadge');
    nameEl=document.getElementById('selectionActionName');
    ownerEl=document.getElementById('selectionActionOwner');
    editBtn=document.getElementById('selectionActionEdit');
    deselectBtn=document.getElementById('selectionActionDeselect');
    if(editBtn){
      editBtn.addEventListener('click',function(){
        try{ cfg.focusEditor(); }catch(e){}
      });
    }
    if(deselectBtn){
      deselectBtn.addEventListener('click',function(){
        if(typeof PageRuntime!=='undefined'){ try{ PageRuntime.clearSelection(); }catch(e){} }
      });
    }
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

  function refresh(){
    if(!root) return;
    if(typeof PageRuntime==='undefined'){
      root.classList.add('selection-action-strip-hidden');
      return;
    }
    const sel=PageRuntime.getSelection();
    // Scoped to Scene Object selection (Places/decorations/stickers/
    // text Layers) — the same population the on-canvas outline/resize
    // grid apply to. A plain Story Theme text selection (Story Text/
    // Handle/Footer/Page Number, a different selection channel per
    // pageRuntime.js's own documented "two explicit functions, not one"
    // design) has no on-canvas grip of its own either, so it's out of
    // scope here too.
    if(!sel || !sel.sceneId || !PageRuntime.selectionIsValid()){
      root.classList.add('selection-action-strip-hidden');
      return;
    }
    const objects=(PageRuntime.getRenderedObjects().scene)||[];
    const obj=objects.find(function(o){ return o.id===sel.sceneId; });
    // A Place ('image-holder') has no render-tree bbox entry of its own
    // (Multiple Artwork Places Per Page's own established convention —
    // selectionIsValid() already special-cases this the same way) —
    // still show the strip for it, using the selection's own sceneType.
    const isPlace=sel.sceneType==='image-holder';
    if(!obj && !isPlace){
      root.classList.add('selection-action-strip-hidden');
      return;
    }
    root.classList.remove('selection-action-strip-hidden');
    const type=(obj && obj.type)||sel.sceneType;
    const label=(obj && obj.label)||(isPlace ? 'Artwork' : 'Object');
    const owner=obj ? obj.owner : 'story';
    const editable=obj ? !!obj.editable : true;
    if(badgeEl) badgeEl.textContent=_friendlyIcon(type);
    if(nameEl) nameEl.textContent=label;
    if(ownerEl){
      // Exactly Object Strip's own badge wording (js/objectStrip.js) so
      // the two surfaces never disagree about the same object.
      ownerEl.textContent=editable ? '🟢 You can edit' : (owner==='world' ? '🌍 Part of the World' : '🔒 Locked');
    }
  }

  return {configure:configure, init:init, refresh:refresh};
})();
try{ window.SelectionActionStrip=SelectionActionStrip; }catch(e){}
