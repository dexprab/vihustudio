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
const CreatorProjectStore=(function(){
  'use strict';

  const STORAGE_KEY='vihustudio-projects';

  function _readAll(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(e){ return []; }
  }

  // Mirrors World Builder's own AV-009 discipline — a caller gets a real
  // {ok,error} result instead of a silently-swallowed quota failure.
  function _writeAll(records){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(records));
      return {ok:true};
    }catch(e){ return {ok:false,error:e}; }
  }

  function newId(){
    return 'proj_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }

  // Newest-first — matches World Builder's own "My World Projects" list.
  function list(){
    return _readAll().sort(function(a,b){ return new Date(b.updatedAt)-new Date(a.updatedAt); });
  }

  function get(id){
    return _readAll().find(function(p){ return p.id===id; })||null;
  }

  // Creates the record on first save, or updates an existing one in
  // place — the one entry point ProjectManager's autosave hook calls.
  // `data` is exactly ProjectManager.serialize()'s own payload shape, so
  // reopening a record later is just ProjectManager.deserialize(record.data).
  function upsert(id,meta,data){
    const now=new Date().toISOString();
    const records=_readAll();
    const idx=records.findIndex(function(p){ return p.id===id; });
    const record={
      id:id,
      name:(meta&&meta.name)||'Untitled',
      thumbnail:(meta&&meta.thumbnail)||null,
      createdAt:idx===-1?now:records[idx].createdAt,
      updatedAt:now,
      data:data
    };
    if(idx===-1) records.push(record); else records[idx]=record;
    return {ok:_writeAll(records).ok,record:record};
  }

  function remove(id){
    const records=_readAll().filter(function(p){ return p.id!==id; });
    return _writeAll(records);
  }

  const api={
    STORAGE_KEY:STORAGE_KEY,
    newId:newId,
    list:list,
    get:get,
    upsert:upsert,
    remove:remove
  };
  try{ window.CreatorProjectStore=api; }catch(e){}
  return api;
})();
