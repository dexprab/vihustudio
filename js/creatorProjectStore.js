// creatorProjectStore.js — Creator-owned multi-project persistence.
//
// Until now Creator's own save model (js/projectManager.js) was a single
// fixed localStorage slot ('vihustudio-session') — one active project,
// restore-or-discard on reload, no way to see or reopen anything else
// without wiping the slot. This module adds a second, parallel store —
// mirroring World Builder's own proven ProjectStore pattern
// (tools/world-builder-v2/js/projectStore.js) almost exactly — so every
// project a Story Author has ever started stays reachable by name and
// thumbnail, not just the single most-recent one.
//
// This module never replaces ProjectManager's own session slot or its
// restore-modal flow (both stay exactly as they are, unmodified) — it is
// purely additive bookkeeping ProjectManager opts into on its own
// existing autosave path (see the small hook in projectManager.js).
//
// Cloud-Primary Project Storage, Phase 4 — this module's own internals
// changed, its PUBLIC API did not: every function below keeps its exact
// pre-existing signature and return shape, so every real call site
// (js/projectManager.js, js/creationFlow.js, js/magicCard.js,
// js/magicCardUI.js, js/gatewaySequence.js) is completely unaffected.
// What changed is what's underneath: list/get/upsert/remove/clearAll now
// read and write through js/creatorProjectCache.js's own synchronous
// in-memory Map mirror (hydrated from IndexedDB once at boot) instead of
// a plain localStorage array — mirroring tools/world-builder-v2/js/
// projectStore.js's own Phase 2 rewrite exactly, the Studio-side half of
// the same "everything should be on cloud... no data loss beacause of
// whatsoever reason" effort.
//
// A real, confirmed gap this phase also closes: js/creatorProjectSync.js's
// push() was, until now, a plain unconditional upsert with no
// optimistic-concurrency check at all — the exact class of blind-
// overwrite bug that caused the real "Story-Forest Adventure" data-loss
// incident for World Builder before that surface's own Versioned Cloud
// Sync closed it. js/creatorProjectCache.js's own _attemptSync() already
// called push() with {expectedUpdatedAt: record.cloudSyncedAt} since
// Phase 1 (built ahead of time, anticipating this exact fix) — it simply
// had nothing real to check against until creatorProjectSync.js's own
// push() itself was hardened to honour that option.
const CreatorProjectStore=(function(){
  'use strict';

  const STORAGE_KEY='vihustudio-projects';

  function _cache() {
    return window.CreatorProjectCache;
  }

  function newId(){
    return 'proj_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }

  // A tiny pub/sub, mirroring js/projectStore.js's own onPersistError()
  // exactly — surfaces the genuinely rare residual case (IndexedDB AND
  // its own localStorage emergency fallback BOTH failing on the same
  // write) asynchronously, since a synchronous return value can no
  // longer report it. No caller registers a listener yet (Studio has no
  // visible save-state UI today), but the seam exists for parity with
  // the World Builder sibling and any future surface that needs it.
  const _persistErrorListeners=[];
  function onPersistError(fn){
    if(typeof fn==='function') _persistErrorListeners.push(fn);
  }
  function _notifyPersistError(id,error){
    _persistErrorListeners.forEach(function(fn){
      try{ fn(id,error); }catch(e){}
    });
  }
  function _onPersistFailed(id){
    return function(error){ _notifyPersistError(id,error); };
  }

  // Newest-first — matches World Builder's own "My World Projects" list.
  function list(){
    return _cache().list().sort(function(a,b){ return new Date(b.updatedAt)-new Date(a.updatedAt); });
  }

  function get(id){
    return _cache().get(id);
  }

  // Creates the record on first save, or updates an existing one in
  // place — the one entry point ProjectManager's autosave hook calls.
  // `data` is exactly ProjectManager.serialize()'s own payload shape, so
  // reopening a record later is just ProjectManager.deserialize(record.data).
  function upsert(id,meta,data){
    const now=new Date().toISOString();
    const existing=_cache().get(id);
    const record={
      id:id,
      name:(meta&&meta.name)||'Untitled',
      thumbnail:(meta&&meta.thumbnail)||null,
      createdAt:existing?existing.createdAt:now,
      updatedAt:now,
      data:data
    };
    _cache().putLocal(record,{onPersistFailed:_onPersistFailed(id)});
    return {ok:true,record:record};
  }

  function remove(id){
    _cache().removeLocal(id);
    return {ok:true};
  }

  // "traveller should not see projects of previous creators" -- called
  // by js/gatewaySequence.js exactly once per genuinely new browser
  // session, only when that session is identified as a first-time
  // Traveller (never for a Returning Creator) -- wipes the whole list
  // outright so a story a DIFFERENT anonymous Traveller left on a
  // shared device never surfaces in "My Projects" for the next one.
  function clearAll(){
    _cache().clearAll();
    return {ok:true};
  }

  const api={
    STORAGE_KEY:STORAGE_KEY,
    newId:newId,
    list:list,
    get:get,
    upsert:upsert,
    remove:remove,
    clearAll:clearAll,
    onPersistError:onPersistError
  };
  try{ window.CreatorProjectStore=api; }catch(e){}
  return api;
})();
