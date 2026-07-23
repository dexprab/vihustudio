// tools/world-builder-v2/js/projectCache.js — Cloud-Primary World Project
// Storage, Phase 1 (Foundation).
//
// "everything should be on cloud... world & studio both. i dont want any
// kind of trouble later on. no data loss beacause of whatsoever reason."
// Draft Asset Architecture (js/assetStore.js) already externalized every
// IMAGE out of a Project's JSON into Supabase Storage — the JSON itself
// (Scenes/Places/Experiences/Frames) is small now, but it is still
// local-primary: js/projectStore.js writes the whole array of every World
// Project to one localStorage key, and Supabase's builder_projects table
// (js/services/projectSync.js) is only ever a best-effort background
// backup nobody reads from during live editing. This module closes that
// gap: an IndexedDB cache tier — the same "truth for fast reads" role
// js/assetStore.js's own blobs store already plays for images — sits
// beneath ProjectStore, with a durably-queued, retry-forever background
// push keeping Supabase current, so a Project survives a tab crash, a
// cleared localStorage, or a browser that never comes back, exactly like
// an image already does.
//
// THE ONE HARD CONSTRAINT THIS FILE IS BUILT AROUND: js/projectStore.js's
// public functions (list/get/save/duplicate/remove) are synchronous today
// — ~150 real call sites across worldBuilderApp.js read a {project,ok,
// error} result in the SAME TICK the call is made. IndexedDB has no
// synchronous write. The only way to gain IndexedDB's durability without
// touching a single one of those call sites is what this module provides:
// an in-memory Map, hydrated from IndexedDB once at boot (before the
// Welcome screen first paints — see hydrate()), that every public
// function here reads/writes SYNCHRONOUSLY; the actual IDBObjectStore.put()
// is fired in the background from inside putLocal(), never awaited by the
// caller. This is js/assetStore.js's own put() pattern ("resolves the
// instant the local write completes, never waits on the network"), pushed
// one level further so even the "local write" being reported on is the
// in-memory mirror, with IndexedDB durability trailing a tick behind.
//
// DISCLOSED RESIDUAL RISK, not hidden: there is a small (millisecond-
// scale) window where a tab crash between "accepted into the in-memory
// Map" and "the background IDBObjectStore.put() transaction actually
// commits" could lose the very last edit. This is strictly smaller and
// rarer than the localStorage-quota failure mode it replaces, and mirrors
// the same class of disclosed risk js/assetStore.js's own header comment
// already accepts for image uploads.
//
// ORDERING GUARD: a rapid sequence of putLocal() calls for the same
// project id (a drag operation calling ProjectStore.save() many times a
// second) must never let a background write complete out of order and
// clobber a fresher one with a stale one — each background write compares
// the record it captured at call time against whatever is CURRENTLY in
// the in-memory Map right before it actually writes, and silently no-ops
// if a newer putLocal() has already superseded it (that newer call's own
// background write will persist the truth).
//
// PHASE 1 SCOPE: pure, self-contained infrastructure. Nothing in the app
// calls hydrate()/putLocal()/drainPendingSync() yet — that's Phase 2
// (js/projectStore.js's internals rewired to read/write through this
// module instead of localStorage). Loading this script now is zero-risk.
(function () {
    'use strict';

    const DB_NAME = 'vihu-world-project-cache';
    const DB_VERSION = 1;
    const PROJECT_STORE = 'projects';
    const PENDING_STORE = 'pendingCloudSync';
    // The exact key js/projectStore.js already writes to today — the
    // one-time migration below reads it, never deletes it (a zero-cost
    // rollback safety net, since there's no quota pressure left to
    // reclaim now that the JSON itself is small).
    const LEGACY_KEY = 'vihu-world-builder-projects';

    // Mirrors js/assetStore.js's own exponential-backoff ladder exactly
    // (shared via window.AssetStore.BACKOFF_MS when it's loaded, which it
    // always is on this page — falling back to an identical literal copy
    // only if that module somehow isn't present, so this file never hard-
    // depends on load order).
    const FALLBACK_BACKOFF_MS = [5000, 20000, 60000, 300000, 900000];
    function _backoffMs() {
        return (window.AssetStore && window.AssetStore.BACKOFF_MS) || FALLBACK_BACKOFF_MS;
    }

    let _dbPromise = null;
    let _useFallback = false; // true only if indexedDB.open() itself failed
    const _map = new Map(); // id -> project record, the synchronous mirror every public read/write goes through
    let _hydratePromise = null;
    let _retryTimer = null;

    // Phase 2 — a small pub/sub so worldBuilderApp.js's own cloud-sync
    // badge (_setCloudSyncState) can react to a real settled outcome for
    // whichever project id it cares about right now, without this module
    // needing to know anything about that UI. Fired from _attemptSync()
    // below for every one of its outcomes (unavailable/synced/conflict/
    // failed) — the same "id + outcome, nothing UI-specific" shape
    // js/projectStore.js's own onPersistError(id, error) already
    // establishes for the sibling durable-write-failure case.
    const _syncListeners = [];
    function onSyncStateChange(fn) {
        if (typeof fn === 'function') _syncListeners.push(fn);
    }
    function _notifySyncStateChange(id, outcome) {
        _syncListeners.forEach(function (fn) {
            try { fn(id, outcome); } catch (e) {}
        });
    }

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

    // Reads localStorage directly — the same shape js/projectStore.js's
    // own _readAll() already parses, reused here only for the one-time
    // migration and the graceful IndexedDB-unavailable fallback path.
    function _readLegacyLocalStorage() {
        try {
            const raw = localStorage.getItem(LEGACY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function _writeLegacyLocalStorageFallback() {
        // Only used when IndexedDB itself is unavailable (old Safari
        // private mode, etc.) — degrade straight back to today's exact
        // localStorage read/write path rather than throw, matching
        // js/assetStore.js's own "never throw, degrade to prior behavior"
        // discipline for its put() catch branch.
        try {
            localStorage.setItem(LEGACY_KEY, JSON.stringify(Array.from(_map.values())));
            return { ok: true };
        } catch (e) { return { ok: false, error: e }; }
    }

    // Writes the project record + refreshes its own pending-cloud-sync
    // bookkeeping in ONE IndexedDB transaction — a local write can never
    // exist without its own durable retry record riding along, mirroring
    // js/assetStore.js's blobs+pendingUploads one-transaction discipline
    // exactly.
    function _persistOne(record, opts) {
        opts = opts || {};
        if (_useFallback) return Promise.resolve(_writeLegacyLocalStorageFallback());
        const capturedUpdatedAt = record.updatedAt;
        return _tx([PROJECT_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
            return new Promise(function (resolve, reject) {
                // Ordering guard — a newer putLocal() for this same id may
                // already have superseded this one in _map by the time this
                // background transaction actually runs; if so, skip the
                // write entirely (the newer call's own background write
                // owns persisting the truth) rather than clobber it.
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
        }).then(function () { return { ok: true }; })
            .catch(function (e) {
                // A real "no data loss under any circumstances" backstop —
                // _useFallback only ever covers indexedDB.open() itself
                // failing; THIS catch is the rarer case where IndexedDB
                // opened fine but this specific write transaction still
                // failed (a transient disk/quota hiccup). Rather than
                // report failure with nothing durable saved at all, fall
                // back to the same plain localStorage write _useFallback
                // mode already uses — the record is still genuinely safe,
                // just via the legacy path instead of IndexedDB, exactly
                // matching (never worse than) this app's own pre-Phase-1
                // baseline durability.
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

    // hydrate() -> Promise<void> — loads every row from IndexedDB into
    // the in-memory Map once, running the one-time legacy migration first
    // if the cache is genuinely empty and localStorage has real content.
    // Kicked off automatically at module load (see _init below); callable
    // any number of times afterward — always resolves the SAME promise,
    // so a caller never has to know whether hydration already finished.
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
            // IndexedDB itself unavailable (old Safari private mode, an
            // exotic embedder, etc.) — degrade straight to today's plain
            // localStorage array, never throw, never leave the Welcome
            // screen with no data at all.
            _useFallback = true;
            _readLegacyLocalStorage().forEach(function (r) { _map.set(r.id, r); });
        });
        return _hydratePromise;
    }

    // Idempotent by construction (only ever called when the cache's own
    // projects store was found genuinely empty during hydrate()) — copies
    // every legacy localStorage Project in once, and enqueues a real,
    // unconditional first-touch cloud push for each (no expectedUpdatedAt
    // — projectSync.js's own push() already knows how to tell a brand-new
    // row apart from a real conflict for exactly this case). The legacy
    // key itself is never deleted.
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

    let _hydrated = false;
    function isReady() { return _hydrated; }

    function list() { return Array.from(_map.values()); }
    function get(id) { return _map.get(id) || null; }

    // putLocal(record) -> record — the one function js/projectStore.js's
    // rewritten save()/duplicate()/create() calls. Updates the in-memory
    // Map immediately (genuinely synchronous from the caller's point of
    // view) and fires the durable IndexedDB write + pending-sync refresh
    // in the background, never awaited here.
    //
    // `opts.onPersistFailed(error)`, when supplied, is called ONLY in the
    // genuinely rare case where the durable write ultimately failed even
    // after _persistOne's own localStorage emergency backstop — i.e.
    // "this device's storage is broken in some deeper way," not an
    // ordinary quota event (images are already externalized; a plain
    // Scenes/Places/Experiences JSON blob is tiny). js/projectStore.js's
    // save()/duplicate()/create() thread this through to
    // ProjectStore.onPersistError()'s registered listeners, so the
    // Workspace can flip its save badge to a real, honestly-rare failure
    // state asynchronously — a beat after the synchronous {ok:true}
    // return every caller already reads, never blocking on it.
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

    // Called after a successful cloud push (from drainPendingSync() below,
    // or from a caller's own direct force-overwrite path in a later
    // phase) — updates the in-memory record's own cloudSyncedAt so the
    // *next* push's conditional write compares against the real value,
    // matching worldBuilderApp.js's existing project.cloudSyncedAt=... one-
    // liner exactly, just centralized here now that the mirror is
    // authoritative.
    function markCloudSynced(id, updatedAt) {
        const record = _map.get(id);
        if (!record) return;
        record.cloudSyncedAt = updatedAt;
        _persistOne(record, { skipPendingRefresh: true });
    }

    // (Re)marks a project's own pending-sync record as due right now —
    // used by a future "force overwrite the cloud" UI action to bypass an
    // existing conflict/backoff hold, and by any caller that wants an
    // immediate retry rather than waiting for the next drain trigger.
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

    // getPendingSyncCount() -> Promise<number> — mirrors
    // AssetStore.getPendingCount()'s exact shape, for a future "N Worlds
    // still saving to the cloud" status readout.
    function getPendingSyncCount() {
        return _allPendingRecords().then(function (all) {
            return (all || []).filter(function (r) { return r.status === 'pending' || (r.status === 'failed' && r.nextAttemptAt !== null); }).length;
        });
    }

    // getConflictIds() -> Promise<string[]> — every project id currently
    // holding an unresolved cloud conflict (a human must decide — see
    // js/services/projectSync.js's own header comment on "no merge logic
    // of any kind").
    function getConflictIds() {
        return _allPendingRecords().then(function (all) {
            return (all || []).filter(function (r) { return r.status === 'conflict'; }).map(function (r) { return r.id; });
        });
    }

    // The one real Studio/Builder-parity fix this Foundation phase closes
    // for World Builder specifically: attempts a single project's cloud
    // push using whatever is CURRENTLY in the in-memory Map (never a
    // stale captured reference), exactly mirroring worldBuilderApp.js's
    // own pre-existing _scheduleCloudSync() push call — this is the same
    // logic, just callable for any project id, not only currentProject.
    function _attemptSync(id) {
        const record = _map.get(id);
        if (!record) return Promise.resolve('failed');
        if (!window.ProjectSync) return Promise.resolve('failed');
        return window.ProjectSync.isAvailable().then(function (ok) {
            if (!ok) { _notifySyncStateChange(id, 'unavailable'); return 'unavailable'; }
            return window.ProjectSync.push(record, { expectedUpdatedAt: record.cloudSyncedAt }).then(function (result) {
                if (result.ok) {
                    markCloudSynced(id, result.updatedAt);
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
        });
    }

    // forceSync(id) -> Promise<{ok,error}> — the conflict escape hatch's
    // own unconditional push, bypassing the conditional expectedUpdatedAt
    // check entirely (the same "I know I'm the only one editing this in
    // two tabs" override worldBuilderApp.js's own _forceOverwriteCloud
    // already offered before this module existed). Always resolves
    // {ok:true}/{ok:false}, never {conflict:true} — an unconditional push
    // can't conflict by definition.
    function forceSync(id) {
        const record = _map.get(id);
        if (!record) return Promise.resolve({ ok: false });
        if (!window.ProjectSync) return Promise.resolve({ ok: false });
        return window.ProjectSync.push(record).then(function (result) {
            if (result.ok) {
                markCloudSynced(id, result.updatedAt);
                return _updatePendingRecord(id, { status: 'done', attempts: 0, nextAttemptAt: null, lastError: null, cloudUpdatedAt: null }).then(function () {
                    _notifySyncStateChange(id, 'synced');
                    return { ok: true };
                });
            }
            return { ok: false, error: result.error };
        });
    }

    function _getPendingRecordRaw(id) {
        if (_useFallback) return Promise.resolve(null);
        return _tx([PENDING_STORE]).then(function (tx) {
            return _reqToPromise(tx.objectStore(PENDING_STORE).get(id));
        }).catch(function () { return null; });
    }

    // drainPendingSync() -> Promise<{synced,conflicted,failed}> — the
    // retry-forever loop. Called once on module load, once on the
    // browser's `online` event, and on a slow shared background interval
    // while any due record exists — the identical trigger set
    // js/assetStore.js's own retryPending() already uses, not a per-
    // project timer (real, avoidable overhead once an author has dozens
    // of Worlds).
    function drainPendingSync() {
        return _allPendingRecords().then(function (all) {
            const now = Date.now();
            const due = (all || []).filter(function (r) {
                if (r.status === 'done') return false;
                if (r.status === 'conflict') return false; // needs a human, never auto-retried
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
        // Coalesces several rapid putLocal() calls into one drain attempt
        // shortly after, rather than firing a network round trip per
        // keystroke — mirrors worldBuilderApp.js's own pre-existing 2s
        // _scheduleCloudSync debounce.
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

    const ProjectCache = {
        hydrate: hydrate,
        isReady: isReady,
        list: list,
        get: get,
        putLocal: putLocal,
        removeLocal: removeLocal,
        markCloudSynced: markCloudSynced,
        enqueueSync: enqueueSync,
        forceSync: forceSync,
        getPendingSyncCount: getPendingSyncCount,
        getConflictIds: getConflictIds,
        drainPendingSync: drainPendingSync,
        onSyncStateChange: onSyncStateChange
    };
    try { window.ProjectCache = ProjectCache; } catch (e) {}

    _init();
})();
