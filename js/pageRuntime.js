// pageRuntime.js — Creator Runtime Pass Sprint. Promotes the center pane
// (js/app.js's existing render/selection/navigation machinery) into a
// named Page Runtime: the single owner of "what page is active, what
// objects are rendered on it, and what's selected right now." Every
// surrounding panel (Object Strip, Context Panel, page navigation)
// should read and mutate through this module instead of independently
// reconstructing the same answers from AppState / SlideRenderer.
//
// This is deliberately a thin ownership/dispatch layer, NOT a new
// rendering system. It does not reimplement rendering, hit-testing, or
// selection logic — every function here wraps an existing js/app.js
// function (via the same configure({...}) host-binding pattern
// js/objectStrip.js / js/contextPanel.js already use) so the real work
// stays exactly where it already lived. See docs/CREATOR_PAGE_RUNTIME.md
// for the full contract this module promotes into place.
const PageRuntime=(function(){
  let host={
    getSlides:function(){ return []; },
    getCurrentIndex:function(){ return 0; },
    getSelectedTextElement:function(){ return null; },
    getSelectedSceneElement:function(){ return null; },
    getSelectedSceneElementType:function(){ return null; },
    setSelectedTextElement:function(){},
    setSelectedSceneElement:function(){},
    showSlide:function(){},
    redrawPreview:function(){}
  };

  function configure(bindings){ host=Object.assign({},host,bindings||{}); }

  // ---------- Read accessors ----------
  // The one place every panel should ask "what page is active" instead
  // of re-deriving AppState.slides[AppState.currentSlide] itself.
  function getActivePage(){
    const slides=host.getSlides();
    return slides[host.getCurrentIndex()]||null;
  }

  // The render tree already IS Creator's object model (Creator
  // Reconciliation Sprint) — this simply names that existing contract
  // as the Runtime's own object-discovery API. No new shape invented,
  // no second query path.
  function getRenderedObjects(){
    const scene=(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getSceneElements==='function')
      ? SlideRenderer.getSceneElements() : [];
    const text=(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getTextElements==='function')
      ? SlideRenderer.getTextElements() : [];
    return {scene:scene, text:text};
  }

  function getSelection(){
    return {
      sceneId:host.getSelectedSceneElement(),
      sceneType:host.getSelectedSceneElementType(),
      textId:host.getSelectedTextElement()
    };
  }

  // Does the current selection still refer to something actually
  // rendered on the active page right now? Consumers use this to decide
  // whether to show a selected object's controls at all, instead of
  // trusting a selection id/type that may be left over from a different
  // page or a since-removed object.
  function selectionIsValid(){
    const sel=getSelection();
    // Multiple Artwork Places Per Page — every Place selection (Place 1's
    // exact legacy id 'image-holder', or an extra Place's own
    // 'image-place-N' id) shares this one synthetic type with no
    // render-tree bbox; checking sceneType instead of the exact id
    // generalizes this correctly without a second id-pattern check.
    if(sel.sceneType==='image-holder') return true;
    if(sel.sceneId){
      return getRenderedObjects().scene.some(function(o){ return o.id===sel.sceneId; });
    }
    if(sel.textId){
      return getRenderedObjects().text.some(function(t){ return t.id===sel.textId; });
    }
    return false;
  }

  // ---------- Mutation entry points ----------
  // Every consumer should call these instead of reaching into js/app.js
  // internals (window.setSelectedSceneElement/setSelectedTextElement,
  // window.showSlide) directly.

  // Two explicit functions, not one selectObject(id,type) dispatching on
  // type — a Scene Object can itself legitimately carry type:'text' (a
  // Layer Pack text entry like a Museum Caption), which is a completely
  // different selection channel from Story Theme text furniture
  // (Story Text/Handle/Footer/Page Number, selected by id alone via
  // getTextElements()). Collapsing them onto one type-sniffing function
  // silently rerouted a selected Scene Object of type 'text' into the
  // wrong channel — caught by the Runtime Pass verification, fixed here
  // rather than special-cased at each call site.
  function selectSceneObject(id,type){
    host.setSelectedSceneElement(id,type);
  }
  function selectTextObject(id){
    host.setSelectedTextElement(id);
  }

  function clearSelection(){
    host.setSelectedSceneElement(null,null);
    host.setSelectedTextElement(null);
  }

  // Delegates to the existing showSlide — the one real choke point
  // every page-change path already funnels through (confirmed by
  // investigation: renderList/renderTimeline thumbnail clicks,
  // PageOps._refreshSelection, ProjectManager session restore,
  // CreationFlow, PublishStudio, ThemeEngine all call it directly).
  // showSlide itself now owns tearing down stale selection before a
  // page change, so every one of those callers gets that fix for free —
  // not just callers that go through openPage().
  function openPage(index){
    host.showSlide(index);
  }

  // ---------- The one notify/dispatch function ----------
  // Every mutation that changes what's rendered or selected calls this
  // exactly once, instead of each call site hand-assembling its own
  // subset of "redraw + refresh every panel" (previously two divergent
  // sequences existed — the selection setters' 4-call tail and
  // showSlide's own 6-call tail).
  function notify(){
    host.redrawPreview();
    if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
    if(typeof ContextPanel!=='undefined'){ try{ ContextPanel.refresh(); }catch(e){} }
    if(typeof ObjectStrip!=='undefined'){ try{ ObjectStrip.refresh(); }catch(e){} }
    if(typeof TravellerSaveNotice!=='undefined'){ try{ TravellerSaveNotice.refresh(); }catch(e){} }
  }

  return {
    configure:configure,
    getActivePage:getActivePage,
    getRenderedObjects:getRenderedObjects,
    getSelection:getSelection,
    selectionIsValid:selectionIsValid,
    selectSceneObject:selectSceneObject,
    selectTextObject:selectTextObject,
    clearSelection:clearSelection,
    openPage:openPage,
    notify:notify
  };
})();
try{ window.PageRuntime=PageRuntime; }catch(e){}
