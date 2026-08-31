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

  // ---------------------------------------------------------------
  // WHOSE PROJECTS THESE ARE.
  //
  // Reported, and real: signed in as one Creator, made a Story, went
  // back and was recognised as a DIFFERENT Creator — and the first
  // Creator's Story was still sitting in My Projects.
  //
  // The cause was that projects were never scoped to a Creator at all.
  // This store is per-DEVICE and always has been: one list, one
  // IndexedDB, and a cloud row keyed on the browser's own anonymous
  // session — which is the device, not the card. Two Magic Cards on one
  // machine share that anonymous session, so they shared everything.
  //
  // The only wipe that existed (clearAll, below) fires for a first-time
  // TRAVELLER and never for a Returning Creator, which is exactly the
  // case that was reported: one Creator following another.
  //
  // So a record now records the card that owns it, and the list is what
  // that card owns. Deliberately a FILTER and never a delete: a second
  // Creator borrowing a machine must not be able to destroy the first
  // one's work by walking in, and the owner sees it all again the
  // moment their own sky is recognised.
  // ---------------------------------------------------------------
  function _activeCardId(){
    try{
      return (typeof MagicCard!=='undefined' && MagicCard.getActiveId)
        ? (MagicCard.getActiveId()||null) : null;
    }catch(e){ return null; }
  }

  function _cards(){
    try{
      return (typeof MagicCard!=='undefined' && MagicCard.list) ? (MagicCard.list()||[]) : [];
    }catch(e){ return []; }
  }

  // EVERY record, whoever owns it. For the callers that genuinely mean
  // the device rather than the Creator — the Ether's own local source
  // is the one: a Story shared with VihuPlanet is public, and hiding
  // another card's shared Story from the universe would be a different
  // bug from the one being fixed here.
  function listAll(){
    return _cache().list().sort(function(a,b){ return new Date(b.updatedAt)-new Date(a.updatedAt); });
  }

  // WHAT HAPPENS TO WORK THAT PREDATES THIS.
  //
  // Every record already on a device has no owner recorded, and
  // guessing wrong in either direction is bad: hide a child's own
  // Stories, or hand them to somebody else. Two things are known and
  // both are used, in order of how much they prove:
  //
  //   1. The record's own creatorName, stamped at save time from the
  //      card that was active. A card on this device with that nickname
  //      IS that record's owner — recorded evidence, not a guess.
  //   2. Failing that, a device with exactly ONE card has no ambiguity
  //      to resolve; the work is that card's.
  //
  // Anything left over stays unowned, and unowned work is shown to a
  // Traveller who holds no card at all — which is what it is. Nothing
  // is ever deleted by this, so a record that cannot be placed today
  // can still be placed later.
  // ONE-SHOT PER DEVICE, NOT PER PAGE LOAD (build 0633).
  //
  // `_claimedOnce` is a module variable, so this ran again on every
  // single load — and the "a device with exactly ONE card has no
  // ambiguity" branch therefore adopted EVERY orphan that ever appeared
  // on that device, for ever. Two things follow from that and both are
  // wrong:
  //
  //   · a Traveller's throwaway work became the resident Creator's, so
  //     nothing an unclaimed session made could ever be swept — which
  //     is exactly "we cannot have anything persisting from unclaimed
  //     sessions", reported by the product owner with six leftover test
  //     stories on screen;
  //   · and a SECOND child's story on a one-card device was handed to
  //     the first child's card, which is Decision 19's own promise
  //     broken in the other direction.
  //
  // The word legacy is what settles it: this places work that predates
  // ownership, and that is a migration, so it happens once and is
  // finished. Anything unowned after it has run is a Traveller's, and
  // js/travellerReset.js decides what happens to that.
  var LEGACY_DONE='vihu.projects.legacyPlaced';
  var _claimedOnce=false;
  function _claimLegacy(){
    if(_claimedOnce) return;
    _claimedOnce=true;
    try{ if(localStorage.getItem(LEGACY_DONE)) return; }catch(e){}
    try{ localStorage.setItem(LEGACY_DONE,'1'); }catch(e){}
    var cards=_cards();
    if(!cards.length) return;
    var byName={};
    cards.forEach(function(c){
      var n=(c&&c.nickname||'').trim().toLowerCase();
      if(n && !byName[n]) byName[n]=c.id;
    });
    var only=cards.length===1?cards[0].id:null;
    listAll().forEach(function(r){
      if(!r || r.cardId) return;
      var n=(r.creatorName||'').trim().toLowerCase();
      var owner=(n && byName[n]) || only;
      if(!owner) return;
      var next={};
      Object.keys(r).forEach(function(k){ next[k]=r[k]; });
      next.cardId=owner;
      _cache().putLocal(next,{onPersistFailed:_onPersistFailed(r.id)});
    });
  }

  // A TRAVELLER'S WORK BECOMES THEIRS.
  //
  // The Rite has a child make a Story before they have a Magic Card, so
  // at the moment a card is claimed there is real work sitting here
  // owned by nobody. It is that child's — they are standing there — and
  // without this it would vanish from My Projects the instant they were
  // given the very card that is supposed to keep it.
  //
  // Only ever unowned records. A Story already belonging to another
  // Creator is never swept up by somebody else claiming a card.
  function claimUnowned(cardId){
    if(!cardId) return {ok:false,claimed:0};
    var n=0;
    listAll().forEach(function(r){
      if(!r || r.cardId) return;
      var next={};
      Object.keys(r).forEach(function(k){ next[k]=r[k]; });
      next.cardId=cardId;
      _cache().putLocal(next,{onPersistFailed:_onPersistFailed(r.id)});
      n++;
    });
    return {ok:true,claimed:n};
  }

  // …AND A TRAVELLER'S WORK STOPS BEING ANYBODY'S AT THE END OF THE
  // SESSION.
  //
  // "this browser or session persistance is killing us. we cannot have
  // anything persisting from unclaimed sessions" — the product owner,
  // looking at six leftover test stories in My Projects.
  //
  // The exact mirror of claimUnowned() above and bound by the same one
  // rule: ONLY records nobody owns. A Story belonging to any card is
  // untouchable, so a second child on a shared machine can no more
  // destroy a Creator's work by walking in than they could take it
  // (Decision 19 — it is a filter, never a delete, and that still holds
  // for everything that has an owner).
  //
  // `preserveIds` is the only exemption, and it is about the CURRENT
  // navigation rather than about state: the Story a child is making
  // right now, or the one the page was opened to show. See
  // js/travellerReset.js for who passes what.
  //
  // A SHARED STORY IS NOT EXEMPT, and briefly was. "anything not
  // attached with a card lets remove that" — the product owner — and a
  // shared Story lives in the Ether from the platform's own shared feed
  // (Decision 15's `is_shared`), so the local record is not what keeps
  // it in the universe. Removing it takes it out of this device's My
  // Projects and out of nothing else.
  function removeUnowned(opts){
    var keep=(opts&&Array.isArray(opts.preserveIds))?opts.preserveIds:[];
    var n=0;
    listAll().forEach(function(r){
      if(!r || r.cardId) return;
      if(keep.indexOf(r.id)>=0) return;
      _cache().removeLocal(r.id);
      n++;
    });
    return {ok:true,removed:n};
  }

  // THE STORIES THAT WERE ALREADY SHARED.
  //
  // Reported by the product owner: "can we update the preexisting
  // stories too. there is no way to reshare them." Both halves are
  // true, and the second is worse than it sounds — markPublished()
  // returns `already` on its FIRST line, before the block that puts a
  // Companion aboard, so even a re-share would not have fixed one.
  // Without this, every Story shared before Sprint 1 would have stood
  // empty for ever.
  //
  // Nothing is invented. This is the same stamp the same device would
  // have applied at share time, from the same card, applied late — the
  // Companion of the child who is sitting here, onto the Stories that
  // are demonstrably theirs.
  //
  // Ownership is judged exactly as markPublished() judges it, which is
  // Decision 19's own standard: refuse only on positive evidence that
  // a record belongs to somebody else. A shared machine can therefore
  // never put one child's Companion into another child's Story.
  //
  // Only ever fills a MISSING one. A Story that already carries a
  // Companion is never rewritten, so this can run as often as it likes
  // and can never overwrite what a Story already knows about itself.
  //
  // A Story made by another child and living here through the shared
  // feed is not ours to stamp, and is left alone: it heals when its own
  // maker next opens VihuPlanet, and their sweep syncs it up.
  let _companionsSwept=false;
  function _sweepCompanions(){
    if(_companionsSwept) return;
    const mine=_localCompanion();
    if(!mine) return;              // no card, or no bonded Companion yet
    _companionsSwept=true;         // only once we could actually have done it
    const active=_activeCardId();
    listAll().forEach(function(r){
      if(!r || !r.publishedAt || r.companion) return;
      if(r.cardId && active && r.cardId!==active) return;
      const next={};
      Object.keys(r).forEach(function(k){ next[k]=r[k]; });
      next.companion=mine;
      _cache().putLocal(next,{onPersistFailed:_onPersistFailed(r.id)});
    });
  }

  // SOCIAL 1 — the public VihuPlanet name reaches stories that were
  // shared BEFORE it was chosen. The exact _sweepCompanions() shape:
  // one lazy pass per load, only once a name exists to stamp, only
  // onto records this card provably owns, never rewriting a record
  // that already carries one. A record's attribution stays the stamp
  // its own maker's device applied — just applied late.
  let _usernamesSwept=false;
  function _sweepUsernames(){
    if(_usernamesSwept) return;
    const mine=_localCreatorUsername();
    if(!mine) return;              // no card, or no name chosen yet
    _usernamesSwept=true;          // only once we could actually have done it
    const active=_activeCardId();
    listAll().forEach(function(r){
      if(!r || !r.publishedAt || r.creatorUsername) return;
      if(!r.cardId || !active || r.cardId!==active) return;
      const next={};
      Object.keys(r).forEach(function(k){ next[k]=r[k]; });
      next.creatorUsername=mine;
      _cache().putLocal(next,{onPersistFailed:_onPersistFailed(r.id)});
    });
  }

  // Newest-first — matches World Builder's own "My World Projects" list.
  function list(){
    _claimLegacy();
    _sweepCompanions();
    _sweepUsernames();
    var active=_activeCardId();
    return listAll().filter(function(r){
      if(!r) return false;
      // A rite's story is not in My Projects until the rite is done.
      // It is HELD, never deleted: the child is offered it back on
      // Studio Home, and it joins this list the moment they finish.
      if(r.riteInProgress) return false;
      // A Traveller holding no card sees the work that belongs to no
      // card — their own, made before they had one.
      if(!active) return !r.cardId;
      return r.cardId===active;
    });
  }

  // The story a rite is part way through, for the one caller that has a
  // reason to find it: the offer on Studio Home. Scoped to the active
  // card the same way list() is, so a machine two children share never
  // offers one child the other's unfinished story.
  //
  // Newest first, and only ever one is used — starting a rite reuses
  // the story it is already holding rather than making a second one, so
  // a second entry here would be a bug rather than a case to handle.
  function riteStory(riteId){
    if(!riteId) return null;
    var active=_activeCardId();
    var found=listAll().filter(function(r){
      if(!r || r.riteInProgress!==riteId) return false;
      if(!active) return !r.cardId;
      return r.cardId===active;
    });
    return found.length?found[0]:null;
  }

  // Held while the rite runs, released when it finishes. Two named calls
  // rather than one setter taking null, because "this story is inside a
  // rite" and "this story is finished and belongs to the child now" are
  // different events and read differently at the call site.
  function markRiteInProgress(id,riteId){
    const record=_cache().get(id);
    if(!record || !riteId) return {ok:false};
    if(record.riteInProgress===riteId) return {ok:true,record:record,already:true};
    record.riteInProgress=riteId;
    record.updatedAt=new Date().toISOString();
    _cache().putLocal(record,{onPersistFailed:_onPersistFailed(id)});
    return {ok:true,record:record};
  }
  function clearRiteInProgress(id){
    const record=_cache().get(id);
    if(!record) return {ok:false};
    if(!record.riteInProgress) return {ok:true,record:record,already:true};
    // Deleted rather than set to null: absence is what "this is an
    // ordinary story" means everywhere else in this record.
    delete record.riteInProgress;
    record.updatedAt=new Date().toISOString();
    _cache().putLocal(record,{onPersistFailed:_onPersistFailed(id)});
    return {ok:true,record:record};
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
  // The nickname on this device's own Magic Card, used only when
  // stamping a record this device is authoring. Never used to label a
  // story that came from somewhere else.
  function _localCreatorName(){
    try{
      if(typeof MagicCard==='undefined') return null;
      const card=MagicCard.getActive();
      return (card && card.nickname) || null;
    }catch(e){ return null; }
  }

  // The maker's public VihuPlanet name (SOCIAL 1), under the exact
  // rule _localCreatorName() states above: read only when stamping a
  // record this device is authoring — never the viewer's.
  // SOCIAL 2 — the one-shot make-for note, consumed by the FIRST NEW
  // record made after arriving with it (the intent-crosses-state-
  // does-not shape, Decision 23). CreatorSocial owns writing it; this
  // is the one consumer, and consuming here is what makes "one
  // journey, one dedication" true by construction.
  const FOR_NOTE='vihu.makeFor.note';
  function _pendingForUsername(){
    try{
      const name=sessionStorage.getItem(FOR_NOTE);
      if(!name) return null;
      sessionStorage.removeItem(FOR_NOTE);
      return String(name).toLowerCase();
    }catch(e){ return null; }
  }

  function _localCreatorUsername(){
    try{
      if(typeof MagicCard==='undefined') return null;
      const card=MagicCard.getActive();
      return (card && card.username) || null;
    }catch(e){ return null; }
  }

  // The bonded Story Companion on this device's own Magic Card, used
  // only when stamping a record this device is authoring — the exact
  // same rule _localCreatorName() above holds, and for the exact same
  // reason: a Story read in the Ether must never be given the
  // Companion of whoever happens to be looking at it.
  //
  // Null for a Traveller who has not had their Creator Ceremony yet.
  // That is honest rather than a gap: they have no Companion, so their
  // Story carries none, and it gains one on the next save after the
  // Ceremony bonds it.
  function _localCompanion(){
    try{
      if(typeof MagicCard==='undefined' || typeof CompanionRecord==='undefined') return null;
      return CompanionRecord.fromCard(MagicCard.getActive());
    }catch(e){ return null; }
  }

  // Opaque copy, guarded — a surface that does not load
  // js/companionRecord.js still saves projects exactly as it always
  // did, it simply carries whatever is already on the record through
  // untouched rather than re-copying it.
  function _companionClone(rec){
    if(!rec) return null;
    try{
      if(typeof CompanionRecord==='undefined') return rec;
      return CompanionRecord.clone(rec);
    }catch(e){ return rec; }
  }

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
      // Carried forward for exactly the reason cloudSyncedAt above is:
      // this function rebuilds the whole record on every debounced
      // autosave, so anything not carried forward is silently wiped the
      // instant editing continues. A Story that was shared with
      // VihuPlanet must not stop being shared because its author typed
      // one more word into it.
      publishedAt:existing?existing.publishedAt:undefined,
      // A STORY BEING MADE INSIDE A RITE, and not finished yet.
      //
      // "why dont we allow resume from studio home for rite 2 & 3 this
      // way it will never enter projects or show in projects till
      // completely done, child does not have any work lost on account of
      // not able to complete in single seating" — the product owner.
      // A rite starts a blank story the moment it opens, so an abandoned
      // rite used to leave one behind in My Projects on every attempt
      // (measured: three abandoned starts, three empty stories). Holding
      // it here rather than deleting it is what keeps the OTHER half of
      // his ask true — nothing a child made is ever thrown away.
      //
      // Carried forward for exactly the reason publishedAt above is:
      // this record is rebuilt on every debounced autosave, so a field
      // not carried forward is wiped the instant editing continues —
      // which for this one would put an unfinished rite's story back in
      // My Projects after its first edit.
      riteInProgress:(meta&&Object.prototype.hasOwnProperty.call(meta,'riteInProgress'))
        ? (meta.riteInProgress||undefined)
        : (existing?existing.riteInProgress:undefined),
      // Story Origin (Sprint VP3). A project made in the Studio is a
      // CREATOR story: it belongs to the child who made it and it
      // carries their name. The other kind, a CANON story, is a product
      // asset owned by nobody and never lives here at all — it lives in
      // vihuplanet/canon/ and ships with the application. Stated
      // explicitly rather than left implied, so that "what kind of
      // story is this" is one field to read instead of a guess about
      // which store something came out of.
      origin:(existing&&existing.origin)||'creator',
      // WHOSE STORY THIS IS, travelling WITH the story.
      //
      // The Ether is a shared space: anybody's shared story shows in
      // everybody's Ether. So the maker's name cannot be read from the
      // Magic Card on the DEVICE doing the looking — that is the
      // viewer, not the author, and every story in the Ether would be
      // attributed to whoever happened to be reading it.
      //
      // Carried forward like publishedAt above, for the same reason: a
      // record is rebuilt on every debounced autosave, so anything not
      // carried forward is wiped the moment editing continues.
      creatorName:(meta&&meta.creatorName)||(existing&&existing.creatorName)||_localCreatorName()||undefined,
      // The maker's public VihuPlanet name (SOCIAL 1), travelling with
      // the story for the same reason creatorName does, carried
      // forward for the same reason too.
      creatorUsername:(meta&&meta.creatorUsername)||(existing&&existing.creatorUsername)||_localCreatorUsername()||undefined,
      // SOCIAL 2 — a creation made FOR somebody ("🏰 A Castle for
      // Moonmaker's Dragon"). Stamped ONCE, when the record is first
      // made under a make-for intent (js/creatorSocial.js owns the
      // one-shot note); carried forward exactly as creatorName is. A
      // public dedication on the story — never a message, and never
      // re-derived, so opening somebody's gift never re-addresses it.
      forUsername:(meta&&meta.forUsername)||(existing&&existing.forUsername)
        ||(!existing&&_pendingForUsername())||undefined,
      // WHICH CREATOR'S WORK THIS IS — see list() above.
      //
      // Carried forward like publishedAt and creatorName, and for the
      // same reason: this record is rebuilt on every debounced autosave,
      // so anything not carried forward is wiped the moment editing
      // continues. It never changes hands afterwards either — a Story
      // opened by whoever is at the machine stays the Story of the
      // Creator who made it.
      //
      // meta.cardId is for the one caller that knows better than the
      // active card does: MagicCard.adopt(), materialising a recalled
      // Creator's own Stories on a new device.
      cardId:(meta&&meta.cardId)||(existing&&existing.cardId)||_activeCardId()||undefined,
      // WHOSE COMPANION LIVES IN THIS STORY (Sprint 1, Companion as
      // World Host). A Story opened by a Traveller shows the Companion
      // of the child who made it, and nothing in the Ether could look
      // that up: a Magic Card lives on its owner's device. So the
      // Companion travels with the Story, exactly as creatorName above
      // does — see js/companionRecord.js for why it is a structured
      // record and not a bare id.
      //
      // Carried forward like publishedAt, creatorName and cardId, and
      // for the same reason spelled out above them: this record is
      // rebuilt from scratch on every debounced autosave, so anything
      // not carried forward is wiped the moment editing continues.
      // Copied through CompanionRecord.clone(), which copies every own
      // key rather than a declared list — a field a future build adds
      // survives this function without this function being changed.
      companion:_companionClone(meta&&meta.companion)||
                _companionClone(existing&&existing.companion)||
                _localCompanion()||undefined,
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
  //
  // Task #490 -- opts.preserveIds (an array of project ids) lets the one
  // real caller keep the CURRENTLY ACTIVE session's own project record
  // intact through the wipe -- see js/creatorProjectCache.js's own
  // clearAll() comment for the full reasoning. Omitted/empty keeps this
  // function's exact prior behaviour (a total wipe).
  function clearAll(opts){
    _cache().clearAll(opts);
    return {ok:true};
  }

  // The Ether, Phase 1 wiring. Until now nothing anywhere recorded
  // WHICH Story was shared with VihuPlanet — MagicCard's own
  // hasEverPublished is a single global boolean per browser, true the
  // moment any Story is published and never attributable to one. That
  // is fine for what it was built for (gating the Creator Ceremony) and
  // useless for the Ether, which needs to know which Stories are in it.
  //
  // So publishing now stamps the Story itself, on the record that
  // already carries its name and its cover and already syncs to the
  // cloud. Nothing new is stored and nothing new is uploaded: one more
  // field on a row that was already going there.
  //
  // Deliberately idempotent on the FIRST publish only — publishing the
  // same Story again does not move its arrival date, because a Story
  // joined the Ether once and has been drifting ever since.
  function markPublished(id,when){
    const record=_cache().get(id);
    if(!record) return {ok:false};
    if(record.publishedAt) return {ok:true,record:record,already:true};
    // SHARE TIME IS THE MOMENT THE COMPANION MUST BE ABOARD.
    //
    // upsert() above stamps it on every save, so a Story written since
    // Sprint 1 already carries one. This covers the Story that does
    // not: one made before this shipped, or one made by a Traveller
    // whose Creator Ceremony happened between their last edit and this
    // moment (Canon 6 puts the Ceremony AFTER a first share, so that
    // ordering is the normal case rather than an edge one).
    //
    // Guarded by ownership: a record belonging to a different Magic
    // Card is left alone, so a machine two children share can never
    // put one child's Companion into the other's Story (the failure
    // CLAUDE.md -> Decision 19 had to fix for projects).
    if(!record.companion){
      const active=_activeCardId();
      if(!record.cardId || !active || record.cardId===active){
        const mine=_localCompanion();
        if(mine) record.companion=mine;
      }
    }
    record.publishedAt=when||new Date().toISOString();
    record.updatedAt=new Date().toISOString();
    _cache().putLocal(record,{onPersistFailed:_onPersistFailed(id)});
    return {ok:true,record:record};
  }

  // Every Story that has been shared with VihuPlanet, newest arrival
  // first. The Ether's whole reading list.
  // EVERY shared Story on this device, whoever made it — listAll, not
  // list. This is the Ether's own local source, and the Ether is a
  // shared space (Decision 15): a Story that was shared with VihuPlanet
  // is public, so hiding one because a different card is active would
  // take a Story out of the universe that its maker put there. My
  // Projects is the surface that must be scoped; the universe is not.
  function listPublished(){
    _claimLegacy();
    _sweepCompanions();
    _sweepUsernames();
    return listAll().filter(function(r){ return !!r.publishedAt; })
      .sort(function(a,b){ return new Date(b.publishedAt)-new Date(a.publishedAt); });
  }

  const api={
    STORAGE_KEY:STORAGE_KEY,
    newId:newId,
    list:list,
    listAll:listAll,
    claimUnowned:claimUnowned,
    removeUnowned:removeUnowned,
    get:get,
    upsert:upsert,
    remove:remove,
    clearAll:clearAll,
    markPublished:markPublished,
    listPublished:listPublished,
    riteStory:riteStory,
    markRiteInProgress:markRiteInProgress,
    clearRiteInProgress:clearRiteInProgress,
    onPersistError:onPersistError
  };
  try{ window.CreatorProjectStore=api; }catch(e){}
  return api;
})();
