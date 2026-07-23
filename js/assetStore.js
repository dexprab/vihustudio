// js/assetStore.js — Shared Asset Storage (Phase A: Foundation).
//
// Fixes a real, confirmed data-loss architecture bug: every uploaded image
// in both authoring surfaces (World Builder, root Creator/Studio) has been
// embedded as a base64 `data:` URI directly inside one JSON object written
// wholesale to a single localStorage key (a small, fixed browser quota).
// Build/Publish reads live in-memory state directly, bypassing whatever the
// local save last successfully persisted -- so a Theme/Story can Publish
// successfully from memory at the exact moment its own local save is
// failing on quota, permanently diverging the two (a compiled Theme cannot
// be reverse-compiled back into editable authoring data). This module is
// the fix: a local cache tier (IndexedDB -- a large, non-embedded quota,
// not the 5-10MB localStorage ceiling that caused the bug) is "truth for
// fast reads," and Supabase Storage's new `draft-assets` bucket is "truth
// for durability," with a durably-queued, retry-forever background upload
// bridging the two. Loaded once, by every authoring surface (root
// index.html, tools/world-builder-v2/index.html, tools/world-builder/
// index.html), exactly mirroring how js/themeRepositoryClient.js is
// already shared today -- this module never opens its own Supabase
// client/session, it calls ThemeRepositoryClient.getClient()/.getSession(),
// the same "never a second sign-in, a second config fetch, or a second
// Supabase client instance" discipline js/creatorProjectSync.js and
// tools/world-builder-v2/js/services/projectSync.js already established.
//
// Reference format: `vihu-asset:<surface>:<projectId>:<assetId>`
// (surface in {builder, creator}). Deliberately never embeds owner_id --
// the Storage object path ({surface}/{owner_id}/{projectId}/{assetId},
// mirroring theme-assets' own {repository}/{owner_id}/{theme_id}/{path}
// convention) is always derived from the ref plus whatever session is
// live right now, so put() never has to resolve/await a session before
// returning -- that would reintroduce exactly the jitter this fix exists
// to remove. A legacy raw `data:` URI is a permanently valid input to
// every function here too (format-detection, not version-flagging) --
// untouched old content keeps working forever with zero risk from any
// later migration step.
//
// PHASE A SCOPE: this file is pure, self-contained infrastructure. Nothing
// in the app calls put()/resolve() yet -- that's Phase B (World Builder)
// and Phase C (Creator/Studio), each its own separate, independently
// shippable increment per the approved plan. Loading this script now is
// zero-risk: it does not change any existing behavior on its own.
(function () {
  'use strict';

  const DB_NAME = 'vihu-asset-cache';
  const DB_VERSION = 1;
  const BLOB_STORE = 'blobs';
  const PENDING_STORE = 'pendingUploads';
  const BUCKET = 'draft-assets';
  const REF_PREFIX = 'vihu-asset:';
  const SIGNED_URL_TTL_SECONDS = 3600;

  // Exponential backoff for a failed upload attempt -- capped, never
  // gives up. Indexed by (attempts-1); the last entry repeats forever.
  const BACKOFF_MS = [5000, 20000, 60000, 300000, 900000];

  let _dbPromise = null;
  // Warm, in-memory cache of ref -> already-resolved src (an
  // object URL for a local blob, or a signed URL for a Storage fetch) --
  // makes every read after the first one for a given ref genuinely
  // synchronous-feeling (no repeated IndexedDB/network round trip within
  // one page session).
  const _warmCache = {};
  let _retryTimer = null;

  function _newAssetId() {
    return 'ast_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function _parseRef(ref) {
    if (typeof ref !== 'string' || ref.indexOf(REF_PREFIX) !== 0) return null;
    const parts = ref.slice(REF_PREFIX.length).split(':');
    if (parts.length !== 3) return null;
    return { surface: parts[0], projectId: parts[1], assetId: parts[2] };
  }

  function _buildRef(surface, projectId, assetId) {
    return REF_PREFIX + surface + ':' + projectId + ':' + assetId;
  }

  function _openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'assetId' });
        if (!db.objectStoreNames.contains(PENDING_STORE)) db.createObjectStore(PENDING_STORE, { keyPath: 'assetId' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
    });
    return _dbPromise;
  }

  function _tx(storeNames, mode) {
    return _openDB().then(function (db) {
      return db.transaction(storeNames, mode || 'readonly');
    });
  }

  function _reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed')); };
    });
  }

  function _dataURLToBlob(dataURL) {
    // Standard, synchronous-cost, zero-network browser operation --
    // fetch() on a data: URI never touches the network, matching the
    // identical technique already established at
    // tools/world-builder-v2/js/projectCompiler.js's own _dataURLToBlob.
    return fetch(dataURL).then(function (resp) { return resp.blob(); });
  }

  function _blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('blob->dataURL failed')); };
      reader.readAsDataURL(blob);
    });
  }

  function _toBlob(source) {
    if (typeof Blob !== 'undefined' && source instanceof Blob) return Promise.resolve(source);
    if (typeof source === 'string' && source.indexOf('data:') === 0) return _dataURLToBlob(source);
    return Promise.reject(new Error('AssetStore.put(): source must be a Blob or a data: URI string'));
  }

  // Writes the blob + a durable pending-upload record in ONE IndexedDB
  // transaction, so a blob can never exist locally with no pending-upload
  // record, or vice versa.
  function _writeLocal(assetId, surface, projectId, blob) {
    return _tx([BLOB_STORE, PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.objectStore(BLOB_STORE).put({
          assetId: assetId, surface: surface, projectId: projectId,
          blob: blob, mime: blob.type || 'application/octet-stream',
          byteLength: blob.size, createdAt: Date.now()
        });
        tx.objectStore(PENDING_STORE).put({
          assetId: assetId, surface: surface, projectId: projectId,
          status: 'pending', attempts: 0, nextAttemptAt: Date.now(),
          lastError: null, createdAt: Date.now()
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
      });
    });
  }

  // AssetStore.put(source, {surface, projectId}) -> Promise<string ref>
  //
  // source: a Blob, or a raw `data:` URI string (the exact shape every
  // existing upload call site already produces via FileReader.readAsDataURL
  // or canvas.toDataURL). Resolves with the new reference the instant the
  // LOCAL IndexedDB write completes -- never waits on the network. If the
  // local write itself fails for any reason (extremely rare for a
  // same-origin IndexedDB write, but a real "under any circumstances"
  // safety net), resolves with the ORIGINAL source unchanged instead of
  // throwing -- the caller simply keeps behaving exactly as it does today
  // (an embedded data: URI), never silently loses the asset.
  function put(source, opts) {
    const surface = (opts && opts.surface) || 'builder';
    const projectId = (opts && opts.projectId) || '';
    const assetId = _newAssetId();
    return _toBlob(source).then(function (blob) {
      return _writeLocal(assetId, surface, projectId, blob).then(function () {
        const ref = _buildRef(surface, projectId, assetId);
        // Fire-and-forget background upload -- never awaited by the
        // caller, satisfies "zero jitter" for the write path.
        _attemptUpload(assetId).catch(function () {});
        return ref;
      });
    }).catch(function () {
      // Local write (or blob conversion) failed -- fall back to the
      // original, pre-existing behavior rather than lose the asset.
      return typeof source === 'string' ? source : null;
    });
  }

  function _getBlobRecord(assetId) {
    return _tx([BLOB_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(BLOB_STORE).get(assetId));
    });
  }

  function _getPendingRecord(assetId) {
    return _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).get(assetId));
    });
  }

  function _updatePendingRecord(record) {
    return _tx([PENDING_STORE], 'readwrite').then(function (tx) {
      return new Promise(function (resolve, reject) {
        tx.objectStore(PENDING_STORE).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function _remotePathFor(surface, projectId, assetId, ownerId) {
    return surface + '/' + ownerId + '/' + projectId + '/' + assetId;
  }

  // Resolves the current session's owner id via the shared
  // ThemeRepositoryClient -- lazily establishes an anonymous session the
  // first time it's ever needed (its own existing, proven behavior),
  // matching every other Supabase-touching module in this codebase.
  function _currentOwnerId() {
    if (typeof window.ThemeRepositoryClient === 'undefined') {
      return Promise.reject(new Error('ThemeRepositoryClient not loaded'));
    }
    return window.ThemeRepositoryClient.getSession().then(function (session) {
      return session.user.id;
    });
  }

  function _attemptUpload(assetId) {
    return Promise.all([_getBlobRecord(assetId), _getPendingRecord(assetId)]).then(function (pair) {
      const blobRecord = pair[0], pendingRecord = pair[1];
      if (!blobRecord || !pendingRecord) return; // asset genuinely gone locally -- nothing to upload
      if (pendingRecord.status === 'done') return;
      if (typeof window.ThemeRepositoryClient === 'undefined') return; // not loaded on this page -- nothing to do
      return window.ThemeRepositoryClient.getClient().then(function (client) {
        return _currentOwnerId().then(function (ownerId) {
          const remotePath = _remotePathFor(blobRecord.surface, blobRecord.projectId, assetId, ownerId);
          return client.storage.from(BUCKET).upload(remotePath, blobRecord.blob, { upsert: true }).then(function (res) {
            if (res.error) throw res.error;
            return _updatePendingRecord({
              assetId: assetId, surface: blobRecord.surface, projectId: blobRecord.projectId,
              status: 'done', attempts: pendingRecord.attempts, nextAttemptAt: null,
              lastError: null, createdAt: pendingRecord.createdAt
            });
          });
        });
      }).catch(function (error) {
        const attempts = (pendingRecord.attempts || 0) + 1;
        const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
        return _updatePendingRecord({
          assetId: assetId, surface: blobRecord.surface, projectId: blobRecord.projectId,
          status: 'failed', attempts: attempts, nextAttemptAt: Date.now() + delay,
          lastError: (error && error.message) || String(error), createdAt: pendingRecord.createdAt
        });
      });
    });
  }

  // AssetStore.retryPending(surface?, projectId?) -> Promise<{uploaded,failed}>
  //
  // Drains the durable queue -- called once on module load, once on the
  // browser's `online` event, and on a slow background interval while any
  // pending record exists. This is what makes an upload durably resumable:
  // since the queue lives in IndexedDB (not memory), a Theme/Story Author
  // who uploaded something and immediately closed the tab, or lost
  // network mid-upload, has that upload resume automatically the next
  // time either surface loads -- no user action required, nothing
  // silently forgotten.
  function retryPending(surface, projectId) {
    return _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).getAll());
    }).then(function (all) {
      const now = Date.now();
      const due = (all || []).filter(function (r) {
        if (r.status === 'done') return false;
        if (surface && r.surface !== surface) return false;
        if (projectId && r.projectId !== projectId) return false;
        if (r.status === 'pending') return true;
        return r.status === 'failed' && r.nextAttemptAt !== null && r.nextAttemptAt <= now;
      });
      let uploaded = 0, failed = 0;
      return due.reduce(function (chain, record) {
        return chain.then(function () {
          return _attemptUpload(record.assetId).then(function () {
            return _getPendingRecord(record.assetId);
          }).then(function (updated) {
            if (updated && updated.status === 'done') uploaded++; else failed++;
          }).catch(function () { failed++; });
        });
      }, Promise.resolve()).then(function () { return { uploaded: uploaded, failed: failed }; });
    }).catch(function () { return { uploaded: 0, failed: 0 }; });
  }

  // AssetStore.getPendingCount(surface, projectId) -> Promise<number>
  //
  // For a small, honest "N images still saving to the cloud" indicator --
  // makes the pending state visible rather than invisible, without being
  // alarming (this is a children's product; a quiet status line, never a
  // scary error banner, is the right tone -- left for a future UI phase
  // to actually surface).
  function getPendingCount(surface, projectId) {
    return _tx([PENDING_STORE]).then(function (tx) {
      return _reqToPromise(tx.objectStore(PENDING_STORE).getAll());
    }).then(function (all) {
      return (all || []).filter(function (r) {
        return r.status !== 'done' && (!surface || r.surface === surface) && (!projectId || r.projectId === projectId);
      }).length;
    }).catch(function () { return 0; });
  }

  function _resolveFromStorage(parsed) {
    if (typeof window.ThemeRepositoryClient === 'undefined') return Promise.resolve(null);
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return _currentOwnerId().then(function (ownerId) {
        const remotePath = _remotePathFor(parsed.surface, parsed.projectId, parsed.assetId, ownerId);
        return client.storage.from(BUCKET).createSignedUrl(remotePath, SIGNED_URL_TTL_SECONDS).then(function (signed) {
          if (signed.error) throw signed.error;
          return signed.data.signedUrl;
        });
      });
    }).catch(function () { return null; });
  }

  // AssetStore.resolve(ref) -> Promise<string|null src>
  //
  // A legacy `data:` URI (or anything else that isn't a vihu-asset: ref --
  // including null/undefined, which every existing "no image yet" call
  // site already treats as falsy) resolves verbatim, same-tick, with zero
  // behavior change for untouched old content. A vihu-asset: ref resolves,
  // in order: the warm in-memory cache (instant); the local IndexedDB
  // blob (fast, an object URL); a Storage signed URL (the one genuinely
  // async path -- a fresh device or a cleared cache, exactly the same
  // asynchrony that already exists today at _repoOnlyCard's own
  // _resolveRepoThumbnailURL(...).then(...) pattern, generalized rather
  // than reinvented). Never rejects, never throws -- total failure
  // resolves null, which every call site already treats as "show
  // placeholder."
  function resolve(ref) {
    const parsed = _parseRef(ref);
    if (!parsed) return Promise.resolve(ref);
    if (Object.prototype.hasOwnProperty.call(_warmCache, ref)) return Promise.resolve(_warmCache[ref]);
    return _getBlobRecord(parsed.assetId).then(function (record) {
      if (record && record.blob) {
        const src = URL.createObjectURL(record.blob);
        _warmCache[ref] = src;
        return src;
      }
      return _resolveFromStorage(parsed).then(function (signedUrl) {
        if (signedUrl) _warmCache[ref] = signedUrl;
        return signedUrl;
      });
    }).catch(function () { return null; });
  }

  // AssetStore.resolveSync(ref) -> string|null
  //
  // Warm-cache-only, synchronous. The seam for genuinely synchronous
  // per-frame painters (engineRuntime.js's _paintLayer, slideRenderer.js's
  // draw loop) that cannot await mid-frame -- these already resolve once,
  // up front, into a host-side cache and redraw on arrival
  // (_resolveLayerImage/_representativeArtworkImage today); this simply
  // generalizes that existing, already-documented "necessarily
  // asynchronous... the host's concern" contract (engineRuntime.js lines
  // 46-54) to also accept a vihu-asset: ref transparently. A legacy
  // `data:` URI (or any non-ref value) passes through unchanged, since
  // it's already synchronously usable as-is.
  function resolveSync(ref) {
    const parsed = _parseRef(ref);
    if (!parsed) return ref || null;
    return Object.prototype.hasOwnProperty.call(_warmCache, ref) ? _warmCache[ref] : null;
  }

  // AssetStore.hydrateForExport(ref) -> Promise<string dataURL>
  //
  // The inverse of put() -- resolves a vihu-asset: ref back to a real,
  // embedded `data:` URI. Used only by the genuinely-portable-file export
  // paths that must stay self-contained outside this app's own Supabase
  // project (ProjectManager.saveProjectAs, World Builder's .vtheme
  // Export). A legacy `data:` URI passes through unchanged (it's already
  // hydrated).
  function hydrateForExport(ref) {
    const parsed = _parseRef(ref);
    if (!parsed) return Promise.resolve(ref);
    return _getBlobRecord(parsed.assetId).then(function (record) {
      if (record && record.blob) return _blobToDataURL(record.blob);
      return resolve(ref).then(function (src) {
        if (!src) throw new Error('Asset ' + ref + ' could not be resolved for export');
        return fetch(src).then(function (r) { return r.blob(); }).then(_blobToDataURL);
      });
    });
  }

  // AssetStore.migrateFieldsOnSave(surface, projectId, accessors) -> Promise<void>
  //
  // The lazy migration hook. `accessors` is a plain array of {get, set}
  // pairs the CALLER builds by walking its own known image-bearing fields
  // (World Builder's Identity/Assets-screen/Scene-Layer/Experience
  // fields; Creator's slide.image/_imageDataURL/thumbnail/placeContent/
  // elementOverrides fields) -- this module stays generic and has no
  // built-in knowledge of either surface's own data shape, matching "a
  // shared module reusable by both surfaces" rather than hardcoding
  // surface-specific field paths in here. For any accessor whose get()
  // currently returns a raw `data:` URI, put()s it and rewrites the field
  // in place to the new reference -- but only after put()'s local write
  // is confirmed; a field left as the original data: URI (put() itself
  // failed) is simply retried on the next save, never left half-migrated.
  // A no-op for a field already migrated or empty. Never fires on read --
  // only ever called from an existing debounced save path, so it only
  // touches a Project the user is actively saving right now.
  function migrateFieldsOnSave(surface, projectId, accessors) {
    const jobs = (accessors || []).filter(function (a) {
      const v = a.get();
      return typeof v === 'string' && v.indexOf('data:') === 0;
    }).map(function (a) {
      return put(a.get(), { surface: surface, projectId: projectId }).then(function (ref) {
        if (typeof ref === 'string' && ref.indexOf(REF_PREFIX) === 0) a.set(ref);
        // else: put() itself fell back to the original data: URI --
        // leave the field exactly as it was, retried next save.
      }).catch(function () {});
    });
    return Promise.all(jobs).then(function () {});
  }

  // Platform Hardening — Draft Asset Architecture, Phase C. The exact
  // threshold/algorithm World Builder v2's own private
  // _downscaleImageDataURL (tools/world-builder-v2/js/worldBuilderApp.js)
  // already uses -- duplicated here as the one canonical, Promise-based
  // copy Studio's own upload call sites share (matching this module's own
  // async style, unlike World Builder's callback-based one), so a future
  // caller on either surface never has to reinvent it. World Builder's
  // own already-shipped, already-tested private copy is left completely
  // untouched -- zero behaviour change there.
  const UPLOAD_DOWNSCALE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
  const UPLOAD_MAX_DIMENSION = 1600;

  function downscaleImageDataURL(dataURL) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = Math.min(1, UPLOAD_MAX_DIMENSION / longestEdge);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // Preserve PNG format for PNG sources — JPEG has no alpha
          // channel (the same reasoning World Builder's own copy
          // documents: re-encoding a transparent PNG as JPEG flattens
          // every transparent pixel to solid black).
          const isPNG = /^data:image\/png/i.test(dataURL);
          const out = isPNG ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
          resolve(out.length < dataURL.length ? out : dataURL);
        } catch (e) {
          resolve(dataURL); // canvas export failed — fall back to the original upload
        }
      };
      img.onerror = function () { resolve(dataURL); };
      img.src = dataURL;
    });
  }

  function _scheduleBackgroundRetry() {
    if (_retryTimer) return;
    _retryTimer = setInterval(function () { retryPending(); }, 60000);
  }

  function _init() {
    // Best-effort -- reduces (never eliminates) the real, disclosed risk
    // window between "local IndexedDB write confirmed" and "Storage
    // upload confirmed," where the browser could otherwise evict
    // "best-effort" storage under disk pressure. No user-visible
    // permission prompt in most browsers once a site has real engagement.
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
    retryPending().catch(function () {});
    try {
      window.addEventListener('online', function () { retryPending().catch(function () {}); });
    } catch (e) {}
    _scheduleBackgroundRetry();
  }

  const AssetStore = {
    put: put,
    resolve: resolve,
    resolveSync: resolveSync,
    migrateFieldsOnSave: migrateFieldsOnSave,
    hydrateForExport: hydrateForExport,
    retryPending: retryPending,
    getPendingCount: getPendingCount,
    downscaleImageDataURL: downscaleImageDataURL,
    UPLOAD_DOWNSCALE_THRESHOLD_BYTES: UPLOAD_DOWNSCALE_THRESHOLD_BYTES
  };
  try { window.AssetStore = AssetStore; } catch (e) {}

  _init();
})();
