// js/creatorLibrary.js — My Library: the characters a child brings to
// life in Bring It Alive, kept so they can be used in any story.
//
// Product decision (the product owner, verbatim): "lets introduce the
// concept of my library in studio where kid can save their characters
// of these extractions. the library item goes on cloud. can be edited
// like any other object when used on scene. can be deleted from
// library when needed."
//
// THE ONE ARCHITECTURAL CHOICE THIS MODULE STANDS ON: a library record
// CARRIES ITS OWN BYTES. AssetStore refs embed a projectId
// (`vihu-asset:creator:<projectId>:<assetId>`), its Storage paths and
// the RLS policy in supabase/migrations_shared_story_assets.sql all
// join on projectId — a cross-project asset has no representation
// there today. Rather than invent a new AssetStore surface plus a new
// storage policy, the row is self-contained:
//
//   { id:            'lib_<b36>_<rand>'
//     name:          child-facing name
//     createdAt / updatedAt / cloudSyncedAt
//     cardId:        WHOSE library item this is (Decision 19 scoping)
//     creatorName:   the active card's nickname at save time
//     thumbnail:     small ~256px JPEG data URL (grid card art)
//     png:           the placement PNG data URL — what lands on a page,
//                    downscaled with the same 1600px / 1.5MB discipline
//                    AssetStore.downscaleImageDataURL enforces
//     creation:      the vihu-creation JSON object, pixels included —
//                    the still-editable layered document itself }
//
// DISCLOSED COST: the row is big — roughly the placement PNG plus the
// creation's own embedded pixels (typically a few hundred KB to a few
// MB per item). That is the price of self-containment, paid knowingly:
// no bucket changes, no new storage policy, and a library item that
// can never dangle because the project it came from was deleted.
//
// PLACING NEVER REFERENCES THE LIBRARY. The Studio picker hands the
// record's `png` to the exact same tail every picked photo uses
// (js/contextPanel.js's _addImageStickerFromDataURL →
// _storeUploadedAsset), so the PLACED object gets an ordinary
// per-project `vihu-asset:` ref and owns its own copy. Publish
// hydration, the Object Strip, drag/resize/rotate and the Refine panel
// all work unchanged, by construction — and deleting a library item
// can never touch a page.
//
// LOCAL FIRST, CLOUD AFTER (the house rule): an in-memory Map hydrated
// once from this module's own IndexedDB (`vihu-creator-library`), so
// every read below is synchronous, exactly like js/creatorProjectStore.js
// through js/creatorProjectCache.js; the cloud (`creator_library`,
// mirroring `creator_projects` — see supabase/migrations_creator_library.sql)
// is told afterwards through a pendingCloudSync queue with the same
// backoff ladder. Everything works with no platform configured, and
// sync is silent when it cannot run.
//
// TWO SURFACES, ONE FILE. This module is loaded by the Studio AND by
// tools/bring-it-alive/ (its first outside link). So:
//   · it never assumes MagicCard is loaded — the active card id falls
//     back to reading MagicCard's own localStorage keys directly
//     ('vihu-magic-card-active-id' / 'vihu-magic-cards', owned by
//     js/magicCard.js — kept in lockstep by hand);
//   · it never assumes AssetStore is loaded — the downscale falls back
//     to a local replica of AssetStore.downscaleImageDataURL (kept in
//     lockstep by hand, same threshold, same max edge, same PNG/JPEG
//     rule);
//   · it never fetches supabase-config.json at load time — the first
//     network byte moves only when a sync is actually attempted, which
//     is gated on an active Magic Card exactly like
//     js/creatorProjectCache.js's drain (a Traveller has nothing to
//     attribute a cloud row to).
// Cloud access goes through window.ThemeRepositoryClient.getClient()/
// .getSession() — the single shared client, exactly like
// js/familyAlbum.js and js/creatorProjectSync.js. NEVER a second
// Supabase client, config fetch or sign-in.
(function () {
  'use strict';

  const DB_NAME = 'vihu-creator-library';
  const DB_VERSION = 1;
  const ITEM_STORE = 'items';
  const PENDING_STORE = 'pendingCloudSync';
  const TABLE = 'creator_library';

  // The same ladder as AssetStore.BACKOFF_MS — defined locally rather
  // than read off window.AssetStore because Bring It Alive loads this
  // module without AssetStore, and a backoff schedule is not worth a
  // module dependency. Kept in lockstep by hand with js/assetStore.js.
  const BACKOFF_MS = [5000, 20000, 60000, 300000, 900000];

  // The same discipline as AssetStore's upload downscale (kept in
  // lockstep by hand with js/assetStore.js — same threshold, same max
  // edge, same "PNG stays PNG because JPEG has no alpha" rule).
  const DOWNSCALE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
  const MAX_DIMENSION = 1600;
  const THUMB_MAX = 256;

  let _dbPromise = null;
  let _useFallbackMemoryOnly = false; // IndexedDB genuinely unavailable
  const _map = new Map();             // id -> record
  let _hydratePromise = null;
  let _retryTimer = null;
  let _drainSoonTimer = null;
  let _drainInFlightPromise = null;

  function newId() {
    return 'lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------
  // WHOSE LIBRARY ITEM THIS IS — Decision 19, applied from birth.
  //
  // Projects had to LEARN this scoping after a real cross-Creator leak
  // ("my project from vihupapa was still available in the god");
  // library items are born with it. A record carries the cardId of the
  // Magic Card that was active when it was saved, list() FILTERS on
  // the active card (never deletes), and claimUnowned() sweeps a
  // Traveller's card-less saves to the card they claim — mirroring
  // CreatorProjectStore.claimUnowned exactly.
  //
  // MagicCard may not be loaded here (Bring It Alive loads this file
  // without it), so the fallback reads MagicCard's own storage
  // directly. Keys owned by js/magicCard.js (CARDS_KEY / ACTIVE_KEY) —
  // kept in lockstep by hand.
  // ---------------------------------------------------------------
  function _activeCardId() {
    try {
      if (typeof MagicCard !== 'undefined' && MagicCard.getActiveId) {
        return MagicCard.getActiveId() || null;
      }
    } catch (e) {}
    try { return localStorage.getItem('vihu-magic-card-active-id') || null; } catch (e) { return null; }
  }
  function _cards() {
    try {
      if (typeof MagicCard !== 'undefined' && MagicCard.list) return MagicCard.list() || [];
    } catch (e) {}
    try {
      const raw = localStorage.getItem('vihu-magic-cards');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function _activeCreatorName() {
    const id = _activeCardId();
    if (!id) return null;
    const card = _cards().filter(function (c) { return c && c.id === id; })[0];
    return (card && card.nickname) || null;
  }

  // ---------------------------------------------------------------
  // IndexedDB plumbing — the same shape as js/creatorProjectCache.js,
  // deliberately its own DB and its own tiny copy (this codebase's
  // established "duplicate small per-surface adapters, kept in
  // lockstep by hand" precedent) rather than a shared module: the tool
  // must be able to load exactly one store file.
  // ---------------------------------------------------------------
  function _openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(ITEM_STORE)) db.createObjectStore(ITEM_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PENDING_STORE)) db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
    });
    return _dbPromise;
  }
  function _tx(storeNames, mode) {
    return _openDB().then(function (db) { return db.transaction(storeNames, mode || 'readonly'); });
  }
  function _reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed')); };
    });
  }

  function _persistOne(record, opts) {
    opts = opts || {};
    if (_useFallbackMemoryOnly) return Promise.resolve({ ok: true });
    const capturedUpdatedAt = record.updatedAt;
    return _tx([ITEM_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        // Ordering guard, same as the sibling caches: a stale write
        // never clobbers a newer in-memory record.
        const current = _map.get(record.id);
        if (current && current.updatedAt !== capturedUpdatedAt) { resolve(); return; }
        tx.objectStore(ITEM_STORE).put(record);
        if (!opts.skipPendingRefresh) {
          const pendingReq = tx.objectStore(PENDING_STORE).get(record.id);
          pendingReq.onsuccess = function () {
            const existing = pendingReq.result;
            tx.objectStore(PENDING_STORE).put({
              id: record.id,
              status: 'pending',
              attempts: existing ? existing.attempts : 0,
              nextAttemptAt: Date.now(),
              lastError: null,
              createdAt: existing ? existing.createdAt : Date.now()
            });
          };
        }
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
      });
    }).then(function () { return { ok: true }; }).catch(function (e) {
      // No localStorage fallback here, deliberately: a library row is
      // PNG + creation pixels, far past any localStorage quota — a
      // failed durable write is reported, never faked.
      return { ok: false, error: e };
    });
  }

  function _deleteOne(id) {
    if (_useFallbackMemoryOnly) return Promise.resolve({ ok: true });
    return _tx([ITEM_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.objectStore(ITEM_STORE).delete(id);
        tx.objectStore(PENDING_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, error: e }; });
  }

  function _updatePendingRecord(id, patch) {
    if (_useFallbackMemoryOnly) return Promise.resolve();
    return _tx([PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        const getReq = tx.objectStore(PENDING_STORE).get(id);
        getReq.onsuccess = function () {
          const existing = getReq.result || { id: id, status: 'pending', attempts: 0, nextAttemptAt: Date.now(), lastError: null, createdAt: Date.now() };
          tx.objectStore(PENDING_STORE).put(Object.assign({}, existing, patch));
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () {});
  }

  function hydrate() {
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = _openDB().then(function () {
      return _tx([ITEM_STORE]).then(function (tx) {
        return _reqToPromise(tx.objectStore(ITEM_STORE).getAll());
      });
    }).then(function (rows) {
      (rows || []).forEach(function (r) { _map.set(r.id, r); });
    }).catch(function () {
      _useFallbackMemoryOnly = true;
    });
    return _hydratePromise;
  }
  function whenReady() { return hydrate(); }

  // ---------------------------------------------------------------
  // Image plumbing — downscale + thumbnail.
  // ---------------------------------------------------------------
  function _downscaleDataURL(dataURL, maxEdge, forceJpegOnLight) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        const longestEdge = Math.max(img.naturalWidth, img.naturalHeight) || 1;
        const scale = Math.min(1, maxEdge / longestEdge);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (forceJpegOnLight) {
            // A thumbnail is a JPEG (small), and JPEG has no alpha —
            // compose the transparent character onto a soft light
            // ground first, never onto default black.
            ctx.fillStyle = '#f6f4ee';
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(img, 0, 0, w, h);
          if (forceJpegOnLight) { resolve(canvas.toDataURL('image/jpeg', 0.8)); return; }
          // Same rule as AssetStore.downscaleImageDataURL: PNG stays
          // PNG (alpha survives), everything else re-encodes as JPEG.
          const isPNG = /^data:image\/png/i.test(dataURL);
          const out = isPNG ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
          resolve(out.length < dataURL.length ? out : dataURL);
        } catch (e) { resolve(dataURL); }
      };
      img.onerror = function () { resolve(dataURL); };
      img.src = dataURL;
    });
  }

  function _preparePng(dataURL) {
    if (typeof dataURL !== 'string' || dataURL.indexOf('data:image/') !== 0) {
      return Promise.resolve(dataURL);
    }
    if (dataURL.length <= DOWNSCALE_THRESHOLD_BYTES) return Promise.resolve(dataURL);
    // Prefer the canonical copy when the Studio has it loaded; the
    // local replica exists for Bring It Alive, which does not.
    if (typeof window !== 'undefined' && window.AssetStore &&
        typeof window.AssetStore.downscaleImageDataURL === 'function') {
      return window.AssetStore.downscaleImageDataURL(dataURL).catch(function () { return dataURL; });
    }
    return _downscaleDataURL(dataURL, MAX_DIMENSION, false);
  }

  function _makeThumbnail(pngDataURL) {
    if (typeof pngDataURL !== 'string' || pngDataURL.indexOf('data:image/') !== 0) {
      return Promise.resolve(null);
    }
    return _downscaleDataURL(pngDataURL, THUMB_MAX, true);
  }

  // ---------------------------------------------------------------
  // Public reads — synchronous, off the hydrated map.
  // ---------------------------------------------------------------
  function listAll() {
    return Array.from(_map.values()).sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  // Work that predates a card, placed by evidence — the exact
  // _claimLegacy discipline js/creatorProjectStore.js established:
  // a record's own creatorName names its owner; failing that, a device
  // with exactly one card has no ambiguity. Never a delete, and
  // anything unplaceable stays unowned (shown to a card-less
  // Traveller, claimable later).
  let _claimedOnce = false;
  function _claimLegacy() {
    if (_claimedOnce) return;
    _claimedOnce = true;
    const cards = _cards();
    if (!cards.length) return;
    const byName = {};
    cards.forEach(function (c) {
      const n = (c && c.nickname || '').trim().toLowerCase();
      if (n && !byName[n]) byName[n] = c.id;
    });
    const only = cards.length === 1 ? cards[0].id : null;
    listAll().forEach(function (r) {
      if (!r || r.cardId) return;
      const n = (r.creatorName || '').trim().toLowerCase();
      const owner = (n && byName[n]) || only;
      if (!owner) return;
      const next = {};
      Object.keys(r).forEach(function (k) { next[k] = r[k]; });
      next.cardId = owner;
      _map.set(next.id, next);
      _persistOne(next, { skipPendingRefresh: true });
    });
  }

  // A FILTER, never a delete — Decision 19's own rule. A Traveller
  // holding no card sees the items that belong to no card.
  function list() {
    _claimLegacy();
    const active = _activeCardId();
    return listAll().filter(function (r) {
      if (!r) return false;
      if (!active) return !r.cardId;
      return r.cardId === active;
    });
  }

  function get(id) { return _map.get(id) || null; }

  // A Traveller's saves become theirs when they claim a card — the
  // sibling of CreatorProjectStore.claimUnowned (js/creatorProjectStore.js),
  // called beside it from MagicCard.claim(). Only unowned records:
  // another Creator's characters are never swept up.
  function claimUnowned(cardId) {
    if (!cardId) return { ok: false, claimed: 0 };
    let n = 0;
    listAll().forEach(function (r) {
      if (!r || r.cardId) return;
      const next = {};
      Object.keys(r).forEach(function (k) { next[k] = r[k]; });
      next.cardId = cardId;
      _map.set(next.id, next);
      _persistOne(next);
      n++;
    });
    if (n) _scheduleDrainSoon();
    return { ok: true, claimed: n };
  }

  // ---------------------------------------------------------------
  // save({id?, name, png, creation, thumbnail?}) -> Promise<{ok,record}>
  //
  // The write is local and durable before this resolves anything about
  // the cloud; the cloud is told afterwards, silently. The record is
  // rebuilt here, so EVERY field is explicitly carried forward from
  // any existing record — the exact gotcha js/creatorProjectStore.js's
  // upsert() documents (a field not carried forward is silently wiped
  // on the next save). Fields this build does not know about are
  // copied through opaquely first, so a future field survives this
  // function without this function changing.
  // ---------------------------------------------------------------
  function save(input) {
    input = input || {};
    if (!input.png && !input.id) {
      return Promise.resolve({ ok: false, error: 'nothing_to_save' });
    }
    return hydrate().then(function () {
      return _preparePng(input.png || null);
    }).then(function (png) {
      const existing = input.id ? _map.get(input.id) : null;
      const thumbP = input.thumbnail
        ? Promise.resolve(input.thumbnail)
        : (png ? _makeThumbnail(png) : Promise.resolve(existing ? existing.thumbnail : null));
      return thumbP.then(function (thumbnail) {
        const now = new Date().toISOString();
        const record = {};
        // Opaque carry-forward FIRST: every existing key survives…
        if (existing) Object.keys(existing).forEach(function (k) { record[k] = existing[k]; });
        // …then the fields this build owns are written deliberately.
        record.id = input.id || (existing && existing.id) || newId();
        record.name = (input.name != null ? String(input.name) : (existing && existing.name)) || 'My Character';
        record.createdAt = (existing && existing.createdAt) || now;
        record.updatedAt = now;
        record.cloudSyncedAt = existing ? existing.cloudSyncedAt : undefined;
        record.cardId = (existing && existing.cardId) || _activeCardId() || undefined;
        record.creatorName = (existing && existing.creatorName) || _activeCreatorName() || undefined;
        record.thumbnail = thumbnail || (existing && existing.thumbnail) || null;
        record.png = png || (existing && existing.png) || null;
        record.creation = input.creation || (existing && existing.creation) || null;
        _map.set(record.id, record);
        return _persistOne(record).then(function (result) {
          if (result.ok) _scheduleDrainSoon();
          // Saved is saved locally even if the durable write failed —
          // the in-memory record serves this session; the error rides
          // along for a caller that cares (no child ever sees it).
          return { ok: true, record: record, persisted: result.ok, error: result.error };
        });
      });
    }).catch(function (e) {
      return { ok: false, error: e };
    });
  }

  // Removing a library item never touches placed objects — a placed
  // object owns its own per-project copy (see the header). Local
  // delete first, cloud delete after, silently.
  function remove(id) {
    if (!id) return { ok: false };
    _map.delete(id);
    _deleteOne(id);
    _cloudDelete(id);
    return { ok: true };
  }

  // ---------------------------------------------------------------
  // Cloud — table `creator_library`, through the ONE shared client
  // (window.ThemeRepositoryClient), exactly like js/familyAlbum.js's
  // _clientAndUid(). Every function resolves {ok:false}/null rather
  // than throwing; an unconfigured platform is a normal state.
  // ---------------------------------------------------------------
  function isAvailable() {
    return !!(typeof window !== 'undefined' && window.ThemeRepositoryClient &&
      typeof window.ThemeRepositoryClient.getClient === 'function' &&
      typeof window.ThemeRepositoryClient.getSession === 'function');
  }

  function _clientAndUid() {
    if (!isAvailable()) return Promise.resolve(null);
    const repo = window.ThemeRepositoryClient;
    return Promise.all([repo.getClient(), repo.getSession()])
      .then(function (pair) {
        const client = pair[0], session = pair[1];
        if (!client || !session || !session.user || !session.user.id) return null;
        return { client: client, uid: session.user.id };
      })
      .catch(function () { return null; });
  }

  function _cloudPush(record) {
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false, error: new Error('unavailable') };
      const nowIso = new Date().toISOString();
      return cu.client.from(TABLE).upsert({
        id: record.id,
        owner_id: cu.uid,
        data: record,
        updated_at: nowIso
      }, { onConflict: 'id' }).then(function (res) {
        if (res.error) return { ok: false, error: res.error };
        return { ok: true, updatedAt: nowIso };
      });
    }).catch(function (e) { return { ok: false, error: e }; });
  }

  function _cloudDelete(id) {
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false };
      return cu.client.from(TABLE).delete().eq('id', id).eq('owner_id', cu.uid)
        .then(function (res) { return { ok: !res.error }; });
    }).catch(function () { return { ok: false }; });
  }

  // ---------------------------------------------------------------
  // The drain — same gating as js/creatorProjectCache.js's
  // _attemptSync: no active Magic Card means nothing is pushed (a
  // Traveller's saves stay local until they claim a card, exactly like
  // their projects), and NOTHING here ever touches the network before
  // that gate passes — which is also what keeps Bring It Alive's suite
  // network-silent.
  // ---------------------------------------------------------------
  function _allPendingRecords() {
    if (_useFallbackMemoryOnly) return Promise.resolve([]);
    return _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).getAll());
    }).catch(function () { return []; });
  }
  function _getPendingRecordRaw(id) {
    if (_useFallbackMemoryOnly) return Promise.resolve(null);
    return _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).get(id));
    }).catch(function () { return null; });
  }

  function _markCloudSynced(id, updatedAt) {
    const record = _map.get(id);
    if (!record) return;
    record.cloudSyncedAt = updatedAt;
    _persistOne(record, { skipPendingRefresh: true });
  }

  function _attemptSync(id) {
    const record = _map.get(id);
    if (!record) return Promise.resolve('failed');
    if (!_activeCardId()) return Promise.resolve('unavailable');
    if (!isAvailable()) return Promise.resolve('unavailable');
    return _cloudPush(record).then(function (result) {
      if (result.ok) {
        _markCloudSynced(id, result.updatedAt || new Date().toISOString());
        return _updatePendingRecord(id, { status: 'done', attempts: 0, nextAttemptAt: null, lastError: null })
          .then(function () { return 'synced'; });
      }
      return _getPendingRecordRaw(id).then(function (existing) {
        const attempts = ((existing && existing.attempts) || 0) + 1;
        const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
        return _updatePendingRecord(id, {
          status: 'failed', attempts: attempts, nextAttemptAt: Date.now() + delay,
          lastError: (result.error && result.error.message) || String(result.error || 'unknown error')
        }).then(function () { return 'failed'; });
      });
    });
  }

  // In-flight guard, mirrored from js/creatorProjectCache.js (see that
  // module's own comment for the real statement-timeout incident that
  // made it necessary): every trigger shares ONE running drain.
  function drainPendingSync() {
    if (_drainInFlightPromise) return _drainInFlightPromise;
    const runPromise = _allPendingRecords().then(function (all) {
      const now = Date.now();
      const due = (all || []).filter(function (r) {
        if (r.status === 'done') return false;
        if (r.status === 'pending') return true;
        return r.nextAttemptAt !== null && r.nextAttemptAt <= now;
      });
      let synced = 0, failed = 0, unavailable = 0;
      return due.reduce(function (chain, record) {
        return chain.then(function () {
          return _attemptSync(record.id).then(function (outcome) {
            if (outcome === 'synced') synced++;
            else if (outcome === 'unavailable') unavailable++;
            else failed++;
          });
        });
      }, Promise.resolve()).then(function () { return { synced: synced, failed: failed, unavailable: unavailable }; });
    }).catch(function () { return { synced: 0, failed: 0, unavailable: 0 }; });
    _drainInFlightPromise = runPromise.then(function (result) {
      _drainInFlightPromise = null;
      return result;
    }, function (err) {
      _drainInFlightPromise = null;
      throw err;
    });
    return _drainInFlightPromise;
  }

  function _scheduleDrainSoon() {
    if (_drainSoonTimer) return;
    _drainSoonTimer = setTimeout(function () {
      _drainSoonTimer = null;
      drainPendingSync();
    }, 2000);
  }
  function _scheduleBackgroundRetry() {
    if (_retryTimer) return;
    _retryTimer = setInterval(function () { drainPendingSync(); }, 60000);
  }

  function _init() {
    hydrate().then(function () { drainPendingSync(); });
    try { window.addEventListener('online', function () { drainPendingSync(); }); } catch (e) {}
    _scheduleBackgroundRetry();
  }

  const api = {
    newId: newId,
    hydrate: hydrate,
    whenReady: whenReady,
    list: list,
    listAll: listAll,
    get: get,
    save: save,
    remove: remove,
    claimUnowned: claimUnowned,
    isAvailable: isAvailable,
    drainPendingSync: drainPendingSync
  };
  try { window.CreatorLibrary = api; } catch (e) {}

  _init();
})();
