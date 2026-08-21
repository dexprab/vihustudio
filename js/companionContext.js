// js/companionContext.js — Companion Intelligence, Phase 0: AWARENESS.
//
// The Companion has always had a face and never had eyes. It could look
// delighted, curious or sleepy, but it had no idea whether the page in
// front of the child was empty or full, whose objects were on it, or
// what the child had just touched. This file is the eyes, and nothing
// else: it answers "what is true right now?" and never decides anything.
//
// docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md §2.1 (Context Reader) and
// §3.1 (the three seams). The central finding of that document is that
// almost everything a Companion needs to seem aware ALREADY EXISTS as
// structured data and is simply never routed to it. So this module
// computes almost nothing — it PROJECTS what four existing systems
// already own:
//
//   js/pageRuntime.js       — what page is active, what is rendered,
//                             what is selected. Its own observer list
//                             is the awareness seam; no polling.
//   renderer/slideRenderer.js — every rendered object already arrives
//                             through _sceneObject() carrying a uniform
//                             {id,type,label,owner,moveable,editable}
//                             shape, guardrails included.
//   js/publishValidator.js  — already a pure rules-over-project-state
//                             engine returning friendly, ordered,
//                             non-blocking nudges. Its own header:
//                             "Friendly language only. Never 'error',
//                             never 'warning'. Never blocks publishing."
//                             That is exactly the noticing engine the
//                             Companion wants, so it is CALLED, never
//                             reimplemented.
//   js/state.js             — the project itself (slides, title).
//
// THIS MODULE OWNS NO STATE. It has no timers, no listeners, no cache
// that outlives a tick, and it never writes anywhere. Deleting this
// file changes nothing about how the Studio behaves — which is the
// fail-open property §3.2 asks for, achieved structurally rather than
// by a flag.
//
// Everything is read defensively. A snapshot taken before the Studio
// has booted, on a page with no Scene, with SlideRenderer absent or
// PublishValidator not yet loaded, returns a complete, well-shaped,
// empty-ish snapshot rather than throwing — because the Brain's rules
// read these fields unconditionally and a missing sub-system must read
// as "nothing to say", never as an exception.
const CompanionContext=(function(){

  // One snapshot per tick. PageRuntime.notify() refreshes five panels
  // and then every observer, so several observers asking for a snapshot
  // inside one dispatch must not each re-run the validator. A very
  // short TTL is deliberately used rather than explicit invalidation:
  // there is no second source of truth to keep in step, and a snapshot
  // that is at worst one animation frame stale is exactly as correct
  // for a Companion's purposes as one that is not.
  const CACHE_MS=120;
  let _cached=null, _cachedAt=0;

  function _now(){ try{ return Date.now(); }catch(e){ return 0; } }

  function _slides(){
    try{ return (typeof AppState!=='undefined' && Array.isArray(AppState.slides)) ? AppState.slides : []; }
    catch(e){ return []; }
  }

  // The rendered objects, already normalised by SlideRenderer with their
  // guardrails attached. Read through PageRuntime rather than the
  // renderer directly, because PageRuntime is the sanctioned owner of
  // "what is rendered" and already merges scene and text elements.
  function _objects(){
    let scene=[], text=[];
    try{
      if(typeof PageRuntime!=='undefined' && PageRuntime.getRenderedObjects){
        const r=PageRuntime.getRenderedObjects()||{};
        if(Array.isArray(r.scene)) scene=r.scene;
        if(Array.isArray(r.text)) text=r.text;
      }
    }catch(e){}
    return {scene:scene, text:text};
  }

  // A rendered object, reduced to the fields a Companion may reason
  // about. Deliberately NOT the raw object: bboxes, canvas rects and
  // image handles are drawing concerns, and a Brain that could see them
  // would start making layout judgements, which is the Story Author's
  // job and not its own.
  function _reduce(o,kind){
    if(!o || typeof o!=='object') return null;
    return {
      id:o.id||null,
      type:o.type||kind||null,
      label:o.label||o.name||null,
      owner:o.owner||'story',
      moveable:(typeof o.moveable==='boolean')?o.moveable:true,
      editable:(typeof o.editable==='boolean')?o.editable:true,
      visible:(typeof o.visible==='boolean')?o.visible:true
    };
  }

  // What the child currently has selected, resolved back to the real
  // rendered object so its guardrails come with it. PageRuntime reports
  // a selection as ids; an id that no longer resolves (a stale
  // selection mid-mutation) reads as no selection, never as a
  // half-object.
  function _selection(objs){
    let sel=null;
    try{
      if(typeof PageRuntime!=='undefined' && PageRuntime.getSelection) sel=PageRuntime.getSelection();
    }catch(e){}
    if(!sel) return null;
    let found=null;
    if(sel.sceneId){
      for(let i=0;i<objs.scene.length;i++){
        if(objs.scene[i] && objs.scene[i].id===sel.sceneId){ found=_reduce(objs.scene[i],'scene'); break; }
      }
      if(!found) found={id:sel.sceneId,type:sel.sceneType||'scene',label:null,owner:'story',moveable:true,editable:true,visible:true};
    }else if(sel.textId){
      for(let i=0;i<objs.text.length;i++){
        if(objs.text[i] && objs.text[i].id===sel.textId){ found=_reduce(objs.text[i],'text'); break; }
      }
      if(!found) found={id:sel.textId,type:'text',label:null,owner:'story',moveable:true,editable:true,visible:true};
    }
    return found;
  }

  // The story's own health, straight from the existing validator. Its
  // nudges are already friendly, already ordered, already
  // non-blocking — the Companion adds nothing to them but a voice.
  // Wrapped because it is a Publish-path module: if it is absent, the
  // Companion simply notices less, and nothing anywhere fails.
  function _notices(slides){
    try{
      if(typeof PublishValidator==='undefined' || !PublishValidator.run) return [];
      // THE PROJECT, NOT THE WHOLE APPSTATE. The story's name lives at
      // AppState.project.bookTitle — js/app.js writes it there from the
      // header field — and the validator reads `project.bookTitle`.
      // Handing it AppState made that read undefined, so the "no name
      // yet" nudge fired on every story however it was named, and the
      // Companion said something untrue. Since Decision 12 removed the
      // readiness check from the finish path, this Companion is the
      // validator's ONLY caller, so nothing else was exercising these
      // rules and nothing else would have caught it.
      const project=(typeof AppState!=='undefined' && AppState.project) ? AppState.project : null;
      const list=PublishValidator.run(slides,project);
      return Array.isArray(list)?list:[];
    }catch(e){ return []; }
  }

  // The same three-step ladder js/companionDirector.js has always used
  // for glow richness, read here so the Brain and the Director cannot
  // disagree about how full a story is.
  function _richness(n){ return n>=6?2:(n>=3?1:0); }

  function _build(){
    const slides=_slides();
    const objs=_objects();
    const scene=[], world=[], text=[];
    for(let i=0;i<objs.scene.length;i++){
      const r=_reduce(objs.scene[i],'scene');
      if(!r) continue;
      scene.push(r);
      if(r.owner==='world') world.push(r);
    }
    for(let i=0;i<objs.text.length;i++){
      const r=_reduce(objs.text[i],'text');
      if(r) text.push(r);
    }
    let index=0;
    try{ index=(typeof AppState!=='undefined' && typeof AppState.currentSlide==='number')?AppState.currentSlide:0; }catch(e){}

    return {
      // Where we are.
      pages:slides.length,
      pageIndex:index,
      richness:_richness(slides.length),

      // What is on this page, and whose it is. `world` is the subset
      // the Theme Author owns — the objects Creator Governing Rule 2's
      // guardrails apply to, and the only ones about which a Companion
      // has anything true to explain.
      objects:{
        total:scene.length+text.length,
        scene:scene,
        text:text,
        world:world
      },

      // What the child is touching right now, guardrails attached.
      selection:_selection(objs),

      // What the story itself would like, in the validator's own words.
      notices:_notices(slides),

      at:_now()
    };
  }

  /**
   * The one public call. Cheap, synchronous, cached per tick.
   * Never throws: an unreadable Studio yields an empty snapshot.
   * @returns {object}
   */
  function snapshot(){
    const now=_now();
    if(_cached && (now-_cachedAt)<CACHE_MS) return _cached;
    let s;
    try{ s=_build(); }
    catch(e){
      s={pages:0,pageIndex:0,richness:0,objects:{total:0,scene:[],text:[],world:[]},selection:null,notices:[],at:now};
    }
    _cached=s; _cachedAt=now;
    return s;
  }

  /** Drops the per-tick cache. Only tests and a page swap need this. */
  function invalidate(){ _cached=null; _cachedAt=0; }

  return { snapshot:snapshot, invalidate:invalidate };
})();
try{ window.CompanionContext=CompanionContext; }catch(e){}
