// js/handwritingStore.js — the letters a child has kept from the My
// Handwriting grid, stored so the grid a child part-filled at home
// greets them part-filled tomorrow — and so My Garden can show them.
//
// Product decision: "it needs to be stored also correct. it needs to
// go on cloud" — and, on the plumbing, "we will use the same
// underlying plumbing for handwriting like we did for library." So
// this module is js/creatorLibrary.js with the image plumbing removed:
// the same in-memory Map hydrated once from its own IndexedDB so every
// read is synchronous, the same durable pendingCloudSync queue with
// the same backoff ladder, the same ONE shared client
// (window.ThemeRepositoryClient), the same "an unconfigured platform
// is a normal state" discipline, and the same Decision 19 scoping — a
// record belongs to the Magic Card that made it, list() FILTERS on the
// active card, and claimUnowned() sweeps a Traveller's letters to the
// card they claim. No downscale and no thumbnails: a letter row is the
// glyph's own small PNG (a few KB), nothing more.
//
// THE LETTER IS THE UNIT OF KEEPING (migrations_handwriting.sql): one
// record per kept letter, per card. Keeping 'a' again REPLACES that
// card's 'a' — save() finds the existing record by (ch, card) and
// reuses its id, which is also what makes the cloud upsert land on the
// same row. The record travels whole into creator_handwriting's
// `data`, in the migration's documented shape (kind · ch · cardId ·
// glyph · keptAt), so SQL never has to look inside.
//
// TWO SURFACES, ONE FILE, same as the library: loaded by the Studio
// (My Garden's letters section) AND by tools/bring-it-alive (the grid
// itself), so MagicCard presence is never assumed — the active card id
// falls back to MagicCard's own localStorage keys, kept in lockstep by
// hand with js/magicCard.js.
(function () {
  'use strict';

  const DB_NAME = 'vihu-creator-handwriting';
  const DB_VERSION = 1;
  const ITEM_STORE = 'letters';
  const PENDING_STORE = 'pendingCloudSync';
  const TABLE = 'creator_handwriting';
  const BACKOFF_MS = [5000, 20000, 60000, 300000, 900000];

  let _dbPromise = null;
  let _useFallbackMemoryOnly = false;
  const _map = new Map();             // id -> record
  let _hydratePromise = null;
  let _retryTimer = null;
  let _drainSoonTimer = null;
  let _drainInFlightPromise = null;

  function newId() {
    return 'hwl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function _activeCardId() {
    try {
      if (typeof MagicCard !== 'undefined' && MagicCard.activeId) return MagicCard.activeId() || null;
    } catch (e) {}
    try { return localStorage.getItem('vihu-magic-card-active-id') || null; } catch (e) { return null; }
  }

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
  function _tx(stores, mode) {
    return _openDB().then(function (db) { return db.transaction(stores, mode || 'readonly'); });
  }
  function _reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed')); };
    });
  }

  function _persistOne(record) {
    if (_useFallbackMemoryOnly) return Promise.resolve({ ok: true });
    const capturedUpdatedAt = record.updatedAt;
    return _tx([ITEM_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        const current = _map.get(record.id);
        if (current && current.updatedAt !== capturedUpdatedAt) { resolve(); return; }
        tx.objectStore(ITEM_STORE).put(record);
        const pendingReq = tx.objectStore(PENDING_STORE).get(record.id);
        pendingReq.onsuccess = function () {
          const existing = pendingReq.result;
          tx.objectStore(PENDING_STORE).put({
            id: record.id, status: 'pending',
            attempts: existing ? existing.attempts : 0,
            nextAttemptAt: Date.now(), lastError: null,
            createdAt: existing ? existing.createdAt : Date.now()
          });
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
      });
    }).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, error: e }; });
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

  function _updatePending(id, patch) {
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
      setTimeout(recolorLegacyInk, 400);
    }).catch(function () { _useFallbackMemoryOnly = true; });
    return _hydratePromise;
  }

  // One-shot sweep: letters kept before the ink matched the Studio
  // ("this does not look good in black match the studio colors" — the
  // product owner) were stored near-black. A letter PNG is a pure
  // alpha mask, so the recolor is lossless — the child's exact ink,
  // in the Studio's own navy (#1D3457, the same a Text object writes
  // in). Marked on the record so it runs once per letter; placed
  // objects own their copies and are deliberately untouched.
  const INK = '#1D3457';
  function recolorLegacyInk() {
    const jobs = [];
    _map.forEach(function (r) {
      if (r.kind === 'font' || !r.glyph || !r.glyph.png || r.ink === INK) return;
      jobs.push(new Promise(function (resolve) {
        const im = new Image();
        im.onload = function () {
          try {
            const c = document.createElement('canvas');
            c.width = r.glyph.w; c.height = r.glyph.h;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.drawImage(im, 0, 0);
            const img = x.getImageData(0, 0, c.width, c.height);
            for (let i = 0; i < img.data.length; i += 4) {
              if (img.data[i + 3] > 0) { img.data[i] = 29; img.data[i + 1] = 52; img.data[i + 2] = 87; }
            }
            x.putImageData(img, 0, 0);
            const next = {};
            Object.keys(r).forEach(function (k) { next[k] = r[k]; });
            next.glyph = { png: c.toDataURL('image/png'), w: r.glyph.w, h: r.glyph.h };
            next.ink = INK;
            next.updatedAt = new Date().toISOString();
            _map.set(next.id, next);
            _persistOne(next).then(function () { resolve(true); });
          } catch (e) { resolve(false); }
        };
        im.onerror = function () { resolve(false); };
        im.src = r.glyph.png;
      }));
    });
    if (jobs.length) return Promise.all(jobs).then(function () { _scheduleDrainSoon(); return jobs.length; });
    return Promise.resolve(0);
  }
  function whenReady() { return hydrate(); }

  // Decision 19's standard, verbatim from the library: the active card
  // sees its own letters; a Traveller holding no card sees unowned
  // ones; nothing is ever deleted by walking in.
  function list() {
    const cardId = _activeCardId();
    const out = [];
    _map.forEach(function (r) {
      if (r.kind === 'font') return;              // the font row is not a letter
      if (cardId ? r.cardId === cardId : !r.cardId) out.push(r);
    });
    // Alphabetical the way a child reads it — 'a m R', never the ASCII
    // 'R a m' (uppercase-first) a plain sort produces.
    out.sort(function (a, b) {
      const al = a.ch.toLowerCase(), bl = b.ch.toLowerCase();
      if (al !== bl) return al < bl ? -1 : 1;
      return a.ch < b.ch ? -1 : (a.ch > b.ch ? 1 : 0);
    });
    return out;
  }
  function get(ch) {
    const cardId = _activeCardId();
    let found = null;
    _map.forEach(function (r) {
      if (r.kind === 'font') return;
      if (r.ch === ch && (cardId ? r.cardId === cardId : !r.cardId)) found = r;
    });
    return found;
  }

  // ---- the font row — the build product, one per card ----------------------
  // migrations_handwriting.sql's second documented shape: { kind:'font',
  // cardId, ttf:'<base64>', letters:'ab…', builtAt }. Kept so a fresh
  // device can wear the font before it has re-read a single letter, and
  // rebuilt (hwFont is deterministic and takes milliseconds) whenever
  // the letters change.
  function getFont() {
    const cardId = _activeCardId();
    let found = null;
    _map.forEach(function (r) {
      if (r.kind === 'font' && (cardId ? r.cardId === cardId : !r.cardId)) found = r;
    });
    return found;
  }
  function saveFont(input) {
    input = input || {};
    if (!input.ttf) return Promise.resolve({ ok: false, error: 'nothing_to_save' });
    return hydrate().then(function () {
      const existing = getFont();
      const now = new Date().toISOString();
      const record = {};
      if (existing) Object.keys(existing).forEach(function (k) { record[k] = existing[k]; });
      record.id = (existing && existing.id) || ('hwf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
      record.kind = 'font';
      record.cardId = (existing && existing.cardId) || _activeCardId() || undefined;
      record.ttf = input.ttf;
      record.letters = String(input.letters || '');
      record.builtAt = now;
      record.createdAt = (existing && existing.createdAt) || now;
      record.updatedAt = now;
      record.cloudSyncedAt = existing ? existing.cloudSyncedAt : undefined;
      _map.set(record.id, record);
      return _persistOne(record).then(function (result) {
        if (result.ok) _scheduleDrainSoon();
        return { ok: true, record: record, persisted: result.ok, error: result.error };
      });
    }).catch(function (e) { return { ok: false, error: e }; });
  }

  function claimUnowned() {
    const cardId = _activeCardId();
    if (!cardId) return { ok: false, claimed: 0 };
    let n = 0;
    _map.forEach(function (r) {
      if (r.cardId) return;
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

  // save({ch, png, w, h}) — keeping a letter again replaces that
  // card's letter (same id, same cloud row). Same carry-forward
  // discipline as the library's save(): unknown fields survive.
  function save(input) {
    input = input || {};
    if (!input.ch || !input.png) return Promise.resolve({ ok: false, error: 'nothing_to_save' });
    return hydrate().then(function () {
      const existing = get(input.ch);
      const now = new Date().toISOString();
      const record = {};
      if (existing) Object.keys(existing).forEach(function (k) { record[k] = existing[k]; });
      record.id = (existing && existing.id) || newId();
      record.kind = 'letter';
      record.ch = String(input.ch);
      record.cardId = (existing && existing.cardId) || _activeCardId() || undefined;
      record.glyph = { png: input.png, w: input.w || 0, h: input.h || 0 };
      record.keptAt = now;
      record.createdAt = (existing && existing.createdAt) || now;
      record.updatedAt = now;
      record.cloudSyncedAt = existing ? existing.cloudSyncedAt : undefined;
      _map.set(record.id, record);
      return _persistOne(record).then(function (result) {
        if (result.ok) _scheduleDrainSoon();
        return { ok: true, record: record, persisted: result.ok, error: result.error };
      });
    }).catch(function (e) { return { ok: false, error: e }; });
  }

  function remove(id) {
    if (!id) return { ok: false };
    _map.delete(id);
    _deleteOne(id);
    _cloudDelete(id);
    return { ok: true };
  }

  // ---- cloud, through the ONE shared client --------------------------------
  function isAvailable() {
    return !!(typeof window !== 'undefined' && window.ThemeRepositoryClient &&
      typeof window.ThemeRepositoryClient.getClient === 'function' &&
      typeof window.ThemeRepositoryClient.getSession === 'function');
  }
  function _clientAndUid() {
    if (!isAvailable()) return Promise.resolve(null);
    const repo = window.ThemeRepositoryClient;
    return Promise.all([repo.getClient(), repo.getSession()]).then(function (pair) {
      const client = pair[0], session = pair[1];
      if (!client || !session || !session.user || !session.user.id) return null;
      return { client: client, uid: session.user.id };
    }).catch(function () { return null; });
  }
  function _cloudPush(record) {
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false, error: new Error('unavailable') };
      const nowIso = new Date().toISOString();
      return cu.client.from(TABLE).upsert({
        id: record.id, owner_id: cu.uid, data: record, updated_at: nowIso
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

  function drainPendingSync() {
    if (_drainInFlightPromise) return _drainInFlightPromise;
    _drainInFlightPromise = _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).getAll());
    }).then(function (rows) {
      const due = (rows || []).filter(function (r) { return r.status === 'pending' && r.nextAttemptAt <= Date.now(); });
      let synced = 0, failed = 0;
      return due.reduce(function (chain, pending) {
        return chain.then(function () {
          const record = _map.get(pending.id);
          if (!record) return _updatePending(pending.id, { status: 'done' });
          return _cloudPush(record).then(function (res) {
            if (res.ok) {
              synced++;
              record.cloudSyncedAt = res.updatedAt;
              _map.set(record.id, record);
              return _updatePending(pending.id, { status: 'done' });
            }
            failed++;
            const attempts = (pending.attempts || 0) + 1;
            return _updatePending(pending.id, {
              attempts: attempts,
              nextAttemptAt: Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)],
              lastError: String(res.error && res.error.message || res.error || 'sync failed')
            });
          });
        });
      }, Promise.resolve()).then(function () { return { synced: synced, failed: failed }; });
    }).catch(function () { return { synced: 0, failed: 0 }; }).then(function (r) {
      _drainInFlightPromise = null;
      return r;
    });
  }
  function _scheduleDrainSoon() {
    if (_drainSoonTimer) clearTimeout(_drainSoonTimer);
    _drainSoonTimer = setTimeout(function () { _drainSoonTimer = null; drainPendingSync(); }, 400);
  }
  function _scheduleBackgroundRetry() {
    if (_retryTimer) return;
    _retryTimer = setInterval(function () { drainPendingSync(); }, 60000);
  }

  if (typeof document !== 'undefined') {
    hydrate();
    try { window.addEventListener('online', function () { drainPendingSync(); }); } catch (e) {}
    _scheduleBackgroundRetry();
  }

  const api = {
    hydrate: hydrate, whenReady: whenReady,
    list: list, get: get, save: save, remove: remove,
    getFont: getFont, saveFont: saveFont,
    recolorLegacyInk: recolorLegacyInk,
    claimUnowned: claimUnowned, drainPendingSync: drainPendingSync,
    isAvailable: isAvailable
  };
  try { window.HandwritingStore = api; } catch (e) {}
})();
