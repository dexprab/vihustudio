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
  //
  // Cloud-Primary Project Storage, Phase 6 — a real, confirmed bug found
  // while writing this phase's own conflict-pipeline verification test:
  // this function used to construct a brand-new record object on EVERY
  // call with no cloudSyncedAt field at all, silently discarding
  // whatever js/creatorProjectCache.js's markCloudSynced() had recorded
  // after a prior successful push. Since js/projectManager.js's
  // _writeStorage() calls upsert() on every single debounced autosave —
  // not just the first one — this meant cloudSyncedAt was wiped the
  // instant editing continued past a Story's very first save, so
  // js/creatorProjectCache.js's _attemptSync() (reading
  // record.cloudSyncedAt fresh from the map at call time) always passed
  // an undefined expectedUpdatedAt to CreatorProjectSync.push() — which
  // takes that as "no conflict check needed" and falls through to a
  // plain, unconditional upsert. The Phase 4 hardening ("no data loss...
  // world & studio both") was correctly built end to end but never
  // actually engaged in practice past a Story's first save, for any real
  // editing session. Fixed by carrying cloudSyncedAt forward from the
  // existing record exactly like createdAt already was — a genuinely
  // new record still gets no cloudSyncedAt (existing is null), correctly
  // taking the unconditional first-touch push path, matching World
  // Builder's own save()'s equivalent in-place-mutation behaviour
  // (tools/world-builder-v2/js/projectStore.js), which never had this
  // bug since it mutates the caller's existing object rather than
  // constructing a fresh one.
  function upsert(id,meta,data){
    const now=new Date().toISOString();
    const existing=_cache().get(id);
    const record={
      id:id,
      name:(meta&&meta.name)||'Untitled',
      thumbnail:(meta&&meta.thumbnail)||null,
      createdAt:existing?existing.createdAt:now,
      updatedAt:now,
      cloudSyncedAt:existing?existing.cloudSyncedAt:undefined,
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
