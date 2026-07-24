// js/creatorProjectCache.js — Cloud-Primary Creator Project Storage,
// Phase 1 (Foundation).
//
// The Studio (Creator) half of "everything should be on cloud... world &
// studio both. i dont want any kind of trouble later on. no data loss
// beacause of whatsoever reason." Mirrors
// tools/world-builder-v2/js/projectCache.js almost exactly — same
// architecture, same constraints, same guarantees — applied to
// js/creatorProjectStore.js's own catalog of saved Stories instead of
// World Builder's Projects. Kept as a genuinely separate module rather
// than a shared one, matching this codebase's own established precedent
// of duplicating small per-surface adapters (js/projectStore.js /
// js/creatorProjectStore.js, tools/world-builder-v2/js/services/
// projectSync.js / js/creatorProjectSync.js are already parallel, never
// shared).
//
// THE ONE HARD CONSTRAINT: js/creatorProjectStore.js's public functions
// (list/get/upsert/remove/clearAll) are synchronous today — every real
// call site (js/projectManager.js's _syncProjectStore/_ensureProjectId,
// js/magicCard.js's _pullRecalledProjects, js/creationFlow.js's My
// Projects screen) reads a return value in the same tick. IndexedDB has
// no synchronous write, so — exactly like the World Builder sibling —
// this module keeps an in-memory Map, hydrated from IndexedDB once at
// boot, that every public function reads/writes synchronously; the real
// IndexedDB write happens in the background, never awaited by the
// caller.
//
// DISCLOSED RESIDUAL RISK, ORDERING GUARD: identical to
// tools/world-builder-v2/js/projectCache.js's own header comment — see
// that file for the full reasoning, unchanged here.
//
// A genuinely important difference from World Builder: Studio's cloud
// sync has ALWAYS been gated on MagicCard.getActive() — a Traveller (no
// claimed identity) has nothing to sync to at all, by deliberate,
// existing product design (the whole Traveller/Story-Egg/Creator-
// Governing-Rules canon). This module's drain loop respects that
// unchanged: a record with no active Magic Card simply never gets pushed
// (CreatorProjectSync.push() itself already no-ops without a session to
// attribute it to — see that file's own header comment) — this cache
// tier still protects a Traveller's OWN local data from a localStorage-
// quota failure even though nothing of theirs ever reaches the cloud.
//
// PHASE 1 SCOPE: pure, self-contained infrastructure. Nothing calls
// hydrate()/putLocal()/drainPendingSync() yet — that's Phase 4
// (js/creatorProjectStore.js's internals rewired to read/write through
// this module). Loading this script now is zero-risk.
(function () {
    'use strict';

    const DB_NAME = 'vihu-creator-project-cache';
    const DB_VERSION = 1;
    const PROJECT_STORE = 'projects';
    const PENDING_STORE = 'pendingCloudSync';
    // The exact key js/creatorProjectStore.js already writes to today.
    const LEGACY_KEY = 'vihustudio-projects';

    const FALLBACK_BACKOFF_MS = [5000, 20000, 60000, 300000, 900000];
    function _backoffMs() {
        return (window.AssetStore && window.AssetStore.BACKOFF_MS) || FALLBACK_BACKOFF_MS;
    }

    // "why i dont have red, orange, green in studio" -- a small pub/sub,
    // mirroring tools/world-builder-v2/js/projectCache.js's own
    // onSyncStateChange(id, outcome) exactly, so js/companionDirector.js
    // (the ONE file allowed to know what a settled sync outcome should
    // mean for the companion widget) can react to a real settled outcome
    // for whichever project id it cares about right now, without this
    // module knowing anything about Companion UI at all. Fired from
    // _attemptSync() below for every one of its outcomes
    // (unavailable/synced/conflict/failed) -- the same "id + outcome,
    // nothing UI-specific" shape js/projectStore.js's own
    // onPersistError(id, error) already establishes for the sibling
    // durable-write-failure case. Unlike the World Builder sibling, this
    // module deliberately does NOT also notify a 'pending' outcome here
    // -- js/projectManager.js's own _scheduleCloudProjectSync already
    // knows the exact moment a sync is first requested (mirroring
    // worldBuilderApp.js's own _setCloudSyncState('pending') being set
    // by the *caller*, not the cache module), so there is no need to
    // duplicate that signal here.
    const _syncListeners = [];
    function onSyncStateChange(fn) {
        if (typeof fn === 'function') _syncListeners.push(fn);
    }
    function _notifySyncStateChange(id, outcome) {
        _syncListeners.forEach(function (fn) {
            try { fn(id, outcome); } catch (e) {}
        });
    }

    let _dbPromise = null;
    let _useFallback = false;
    const _map = new Map(); // id -> {id,name,thumbnail,createdAt,updatedAt,cloudSyncedAt,data}
    let _hydratePromise = null;
    let _retryTimer = null;
    let _hydrated = false;

    function _openDB() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise(function (resolve, reject) {
            if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function () {
                const db = req.result;
                if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
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

    function _readLegacyLocalStorage() {
        try {
            const raw = localStorage.getItem(LEGACY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function _writeLegacyLocalStorageFallback() {
        try {
            localStorage.setItem(LEGACY_KEY, JSON.stringify(Array.from(_map.values())));
            return { ok: true };
        } catch (e) { return { ok: false, error: e }; }
    }

    function _persistOne(record, opts) {
        opts = opts || {};
        if (_useFallback) return Promise.resolve(_writeLegacyLocalStorageFallback());
        const capturedUpdatedAt = record.updatedAt;
        return _tx([PROJECT_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
            return new Promise(function (resolve, reject) {
                const current = _map.get(record.id);
                if (current && current.updatedAt !== capturedUpdatedAt) { resolve(); return; }
                tx.objectStore(PROJECT_STORE).put(record);
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
                            cloudUpdatedAt: null,
                            createdAt: existing ? existing.createdAt : Date.now()
                        });
                    };
                }
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
                tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
            });
        }).then(function () { return { ok: true }; }).catch(function (e) {
            // Same "no data loss under any circumstances" backstop as the
            // World Builder sibling — see that module's own comment on
            // this exact catch branch for the full reasoning.
            const fallback = _writeLegacyLocalStorageFallback();
            if (fallback.ok) return { ok: true };
            return { ok: false, error: e };
        });
    }

    function _deleteOne(id) {
        if (_useFallback) return Promise.resolve(_writeLegacyLocalStorageFallback());
        return _tx([PROJECT_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
            return new Promise(function (resolve, reject) {
                tx.objectStore(PROJECT_STORE).delete(id);
                tx.objectStore(PENDING_STORE).delete(id);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        }).then(function () { return { ok: true }; }).catch(function (e) { return { ok: false, error: e }; });
    }

    function _updatePendingRecord(id, patch) {
        if (_useFallback) return Promise.resolve();
        return _tx([PENDING_STORE], 'readwrite').then(function (tx) {
            return new Promise(function (resolve, reject) {
                const getReq = tx.objectStore(PENDING_STORE).get(id);
                getReq.onsuccess = function () {
                    const existing = getReq.result || { id: id, status: 'pending', attempts: 0, nextAttemptAt: Date.now(), lastError: null, cloudUpdatedAt: null, createdAt: Date.now() };
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
            return _tx([PROJECT_STORE]).then(function (tx) {
                return _reqToPromise(tx.objectStore(PROJECT_STORE).getAll());
            });
        }).then(function (rows) {
            (rows || []).forEach(function (r) { _map.set(r.id, r); });
            if (_map.size === 0) return _migrateLegacyOnce();
        }).catch(function () {
            _useFallback = true;
            _readLegacyLocalStorage().forEach(function (r) { _map.set(r.id, r); });
        });
        return _hydratePromise;
    }

    function _migrateLegacyOnce() {
        const legacy = _readLegacyLocalStorage();
        if (!legacy.length) return Promise.resolve();
        legacy.forEach(function (r) { _map.set(r.id, r); });
        return legacy.reduce(function (chain, record) {
            return chain.then(function () {
                return _persistOne(record).then(function () { _scheduleDrainSoon(); });
            });
        }, Promise.resolve());
    }

    function isReady() { return _hydrated; }
    function list() { return Array.from(_map.values()); }
    function get(id) { return _map.get(id) || null; }

    // `opts.onPersistFailed(error)` — see
    // tools/world-builder-v2/js/projectCache.js's own putLocal() comment
    // for the full reasoning; mirrored here for parity, wired in by
    // js/creatorProjectStore.js once Phase 4 rewires this module's caller.
    function putLocal(record, opts) {
        opts = opts || {};
        _map.set(record.id, record);
        _persistOne(record).then(function (result) {
            if (result.ok) _scheduleDrainSoon();
            else if (typeof opts.onPersistFailed === 'function') opts.onPersistFailed(result.error);
        });
        return record;
    }

    function removeLocal(id) {
        _map.delete(id);
        _deleteOne(id);
    }

    // Cloud-Primary Project Storage, Phase 4 — js/creatorProjectStore.js's
    // own clearAll() ("traveller should not see projects of previous
    // creators," js/gatewaySequence.js's one-time-per-session wipe) needs
    // a real whole-store clear now that this cache, not a plain
    // localStorage array, is the actual source of truth. The in-memory Map
    // is cleared synchronously — so a list() call immediately after this
    // returns already reflects empty, matching every existing caller's own
    // fire-and-forget usage (none of them read this function's own return
    // value) — while the real IndexedDB clear (both stores) and the
    // legacy localStorage key removal happen in the background,
    // mirroring every other write in this module.
    function clearAll() {
        _map.clear();
        if (_useFallback) {
            try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
            return Promise.resolve({ ok: true });
        }
        return _tx([PROJECT_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
            return new Promise(function (resolve, reject) {
                tx.objectStore(PROJECT_STORE).clear();
                tx.objectStore(PENDING_STORE).clear();
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error || new Error('IndexedDB clear failed')); };
            });
        }).then(function () {
            try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
            return { ok: true };
        }).catch(function (e) {
            try { localStorage.removeItem(LEGACY_KEY); } catch (e2) {}
            return { ok: false, error: e };
        });
    }

    function markCloudSynced(id, updatedAt) {
        const record = _map.get(id);
        if (!record) return;
        record.cloudSyncedAt = updatedAt;
        _persistOne(record, { skipPendingRefresh: true });
    }

    function enqueueSync(id) {
        if (!_map.has(id)) return Promise.resolve();
        return _updatePendingRecord(id, { status: 'pending', nextAttemptAt: Date.now(), lastError: null, cloudUpdatedAt: null }).then(function () {
            _scheduleDrainSoon();
        });
    }

    function _allPendingRecords() {
        if (_useFallback) return Promise.resolve([]);
        return _tx([PENDING_STORE]).then(function (tx) {
            return _reqToPromise(tx.objectStore(PENDING_STORE).getAll());
        }).catch(function () { return []; });
    }

    function getPendingSyncCount() {
        return _allPendingRecords().then(function (all) {
            return (all || []).filter(function (r) { return r.status === 'pending' || (r.status === 'failed' && r.nextAttemptAt !== null); }).length;
        });
    }

    function getConflictIds() {
        return _allPendingRecords().then(function (all) {
            return (all || []).filter(function (r) { return r.status === 'conflict'; }).map(function (r) { return r.id; });
        });
    }

    // Gated exactly like js/projectManager.js's own existing
    // _scheduleCloudProjectSync — a Traveller (no claimed Magic Card)
    // never reaches CreatorProjectSync.push() at all, unchanged from
    // today's behavior; this cache tier still protects a Traveller's own
    // local data from a quota failure even though nothing of theirs is
    // ever pushed to the cloud.
    function _attemptSync(id) {
        const record = _map.get(id);
        if (!record) return Promise.resolve('failed');
        if (typeof MagicCard === 'undefined' || !MagicCard.getActive()) { _notifySyncStateChange(id, 'unavailable'); return Promise.resolve('unavailable'); }
        if (typeof CreatorProjectSync === 'undefined') { _notifySyncStateChange(id, 'failed'); return Promise.resolve('failed'); }
        return CreatorProjectSync.push(record, { expectedUpdatedAt: record.cloudSyncedAt }).then(function (result) {
            if (result.ok) {
                markCloudSynced(id, result.updatedAt || new Date().toISOString());
                return _updatePendingRecord(id, { status: 'done', attempts: 0, nextAttemptAt: null, lastError: null, cloudUpdatedAt: null }).then(function () {
                    _notifySyncStateChange(id, 'synced');
                    return 'synced';
                });
            }
            if (result.conflict) {
                return _updatePendingRecord(id, { status: 'conflict', nextAttemptAt: null, lastError: null, cloudUpdatedAt: result.cloudUpdatedAt }).then(function () {
                    _notifySyncStateChange(id, 'conflict');
                    return 'conflict';
                });
            }
            return _getPendingRecordRaw(id).then(function (existing) {
                const attempts = ((existing && existing.attempts) || 0) + 1;
                const ladder = _backoffMs();
                const delay = ladder[Math.min(attempts - 1, ladder.length - 1)];
                return _updatePendingRecord(id, {
                    status: 'failed', attempts: attempts, nextAttemptAt: Date.now() + delay,
                    lastError: (result.error && result.error.message) || String(result.error || 'unknown error')
                }).then(function () {
                    _notifySyncStateChange(id, 'failed');
                    return 'failed';
                });
            });
        });
    }

    function _getPendingRecordRaw(id) {
        if (_useFallback) return Promise.resolve(null);
        return _tx([PENDING_STORE]).then(function (tx) {
            return _reqToPromise(tx.objectStore(PENDING_STORE).get(id));
        }).catch(function () { return null; });
    }

    function drainPendingSync() {
        return _allPendingRecords().then(function (all) {
            const now = Date.now();
            const due = (all || []).filter(function (r) {
                if (r.status === 'done') return false;
                if (r.status === 'conflict') return false;
                if (r.status === 'pending') return true;
                return r.nextAttemptAt !== null && r.nextAttemptAt <= now;
            });
            let synced = 0, conflicted = 0, failed = 0;
            return due.reduce(function (chain, record) {
                return chain.then(function () {
                    return _attemptSync(record.id).then(function (outcome) {
                        if (outcome === 'synced') synced++;
                        else if (outcome === 'conflict') conflicted++;
                        else failed++;
                    });
                });
            }, Promise.resolve()).then(function () { return { synced: synced, conflicted: conflicted, failed: failed }; });
        }).catch(function () { return { synced: 0, conflicted: 0, failed: 0 }; });
    }

    let _drainSoonTimer = null;
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
        hydrate().then(function () {
            _hydrated = true;
            drainPendingSync();
        });
        try { window.addEventListener('online', function () { drainPendingSync(); }); } catch (e) {}
        _scheduleBackgroundRetry();
    }

    // A genuine unconditional overwrite push, mirroring
    // tools/world-builder-v2/js/projectCache.js's own forceSync(id) —
    // Studio's own cloud-sync companion charm (js/companionDirector.js)
    // has no "force overwrite?" UI of its own (a settled conflict just
    // shows a quiet, non-blocking "attention" state, matching this
    // codebase's own "no scary error UI for kids" discipline rather
    // than a click-to-resolve control), but the underlying escape hatch
    // is exposed here anyway, matching the World Builder sibling's
    // public shape exactly, for any future Studio surface (or Phase 5's
    // own restore-modal freshness check) that needs it.
    function forceSync(id) {
        const record = _map.get(id);
        if (!record) return Promise.resolve({ ok: false });
        if (!window.CreatorProjectSync) return Promise.resolve({ ok: false });
        return window.CreatorProjectSync.push(record).then(function (result) {
            if (result.ok) {
                markCloudSynced(id, result.updatedAt);
                return _updatePendingRecord(id, { status: 'done', attempts: 0, nextAttemptAt: null, lastError: null, cloudUpdatedAt: null }).then(function () {
                    return { ok: true };
                });
            }
            return { ok: false, error: result.error };
        });
    }

    const CreatorProjectCache = {
        hydrate: hydrate,
        isReady: isReady,
        list: list,
        get: get,
        putLocal: putLocal,
        removeLocal: removeLocal,
        clearAll: clearAll,
        markCloudSynced: markCloudSynced,
        enqueueSync: enqueueSync,
        forceSync: forceSync,
        getPendingSyncCount: getPendingSyncCount,
        getConflictIds: getConflictIds,
        drainPendingSync: drainPendingSync,
        onSyncStateChange: onSyncStateChange
    };
    try { window.CreatorProjectCache = CreatorProjectCache; } catch (e) {}

    _init();
})();
