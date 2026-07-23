// projectStore.js — Builder-owned World Project persistence.
//
// A World Project (docs/WORLD_PROJECT_CONTRACT.md) is not a folder on
// the creator's disk — it's Builder-owned, editable data.
//
// Cloud-Primary Project Storage, Phase 2 — this module's own internals
// changed, its PUBLIC API did not: every function below keeps its exact
// pre-existing signature and return shape, so every real call site across
// worldBuilderApp.js (~150 of them) is completely unaffected. What changed
// is what's underneath: list/get/save/duplicate/create/remove now read and
// write through js/projectCache.js's own synchronous in-memory Map mirror
// (hydrated from IndexedDB once at boot — see ProjectCache.hydrate(), wired
// into worldBuilderApp.js's own boot IIFE) instead of a plain localStorage
// array. The actual IndexedDB durability, the durably-queued retry-forever
// cloud push, and the ordering guard against rapid sequential edits all
// live in that module — this file stays a thin, synchronous-feeling
// adapter over it, exactly the role js/creatorProjectStore.js plays over
// js/creatorProjectCache.js on Studio's own side of this same effort.
//
// AV-009's own "a caller gets a real {ok,error} result instead of a
// silently-swallowed quota failure" principle still holds — it just means
// something different now: since ProjectCache.putLocal() always updates
// the in-memory mirror SYNCHRONOUSLY (that can't fail), save()/duplicate()
// now always return {ok:true} — a real, deliberate simplification, not a
// regression, since the underlying data is no longer routinely at risk of
// the ~5-10MB localStorage ceiling that caused the original AV-009 bug
// (Draft Asset Architecture already externalized every image out of this
// JSON; what's left is tens of KB, and IndexedDB's own realistic quota is
// hundreds of MB-low GB). The genuinely rare residual case — IndexedDB AND
// its own localStorage emergency fallback BOTH failing on one write — is
// surfaced asynchronously via onPersistError() below, since ProjectCache's
// own background write can't report failure inside a function contract
// that must stay synchronous.
const ProjectStore = (function () {
  'use strict';

  const STORAGE_KEY = 'vihu-world-builder-projects';

  function _cache() {
    return window.ProjectCache;
  }

  function _newId() {
    return 'wp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // A tiny pub/sub — worldBuilderApp.js registers exactly one listener
  // (near _setSaveState) to flip its save badge if a project's durable
  // write ultimately fails, without threading a callback through every one
  // of the ~14 direct save()/duplicate() call sites individually.
  const _persistErrorListeners = [];
  function onPersistError(fn) {
    if (typeof fn === 'function') _persistErrorListeners.push(fn);
  }
  function _notifyPersistError(id, error) {
    _persistErrorListeners.forEach(function (fn) {
      try { fn(id, error); } catch (e) {}
    });
  }
  function _onPersistFailed(id) {
    return function (error) { _notifyPersistError(id, error); };
  }

  // Newest-first — "My World Projects" always leads with whatever the
  // creator touched most recently.
  function list() {
    return _cache().list().sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function get(id) {
    return _cache().get(id);
  }

  // Create + persist a new World Project from a template's generated
  // content (WorldTemplates.generate(templateId) — see templates.js).
  // The project is already complete per docs/WORLD_PROJECT_CONTRACT.md
  // (LOCK 03 — born valid) the instant this returns.
  function create(templateId, generated) {
    const now = new Date().toISOString();
    const project = {
      id: _newId(),
      templateId: templateId,
      name: generated.name,
      tagline: generated.tagline,
      description: generated.description,
      icon: generated.icon,
      status: 'growing',
      createdAt: now,
      updatedAt: now,
      files: generated.files
    };
    _cache().putLocal(project, { onPersistFailed: _onPersistFailed(project.id) });
    return project;
  }

  // Returns { project, ok, error } — see this file's own header comment
  // for why `ok` is now always true synchronously; a genuine, rare durable-
  // write failure is surfaced later via onPersistError(), not through this
  // return value.
  function save(project) {
    project.updatedAt = new Date().toISOString();
    _cache().putLocal(project, { onPersistFailed: _onPersistFailed(project.id) });
    return { project: project, ok: true };
  }

  // Sprint B2.0.1 — Duplicate/Delete, the header overflow menu's two real
  // actions. A duplicate is a deep copy with its own new id/timestamps,
  // "(Copy)" appended to its name so it's never confused with the
  // original in "My World Projects".
  function duplicate(project) {
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(project));
    copy.id = _newId();
    copy.name = project.name + ' (Copy)';
    copy.status = 'growing';
    copy.createdAt = now;
    copy.updatedAt = now;
    delete copy.lastBuild;
    // A fresh copy under a brand-new id has never itself been synced to
    // the cloud — its own first push must be an unconditional first-touch
    // (matching how a genuinely new Project behaves), never conditioned on
    // the ORIGINAL Project's own cloudSyncedAt value.
    delete copy.cloudSyncedAt;
    _cache().putLocal(copy, { onPersistFailed: _onPersistFailed(copy.id) });
    return { project: copy, ok: true };
  }

  function remove(id) {
    _cache().removeLocal(id);
  }

  // A real, measured readout of exactly what this browser stores for
  // World Builder, plus (since a shared origin's total is what actually
  // decides whether ANY write here can succeed) a whole-origin walk — see
  // js/worldBuilderApp.js's _renderStorageMeter, repurposed into a Local
  // Cache & Cloud Sync status panel now that IndexedDB, not this narrow
  // localStorage measurement, is the real storage tier for Project data
  // itself. Kept, not deleted, in Phase 2: these legacy keys still exist
  // (the one-time migration source, and this module's own emergency
  // write-failure fallback), and the origin-wide walk is still the only
  // way to see Studio's own separate footprint.
  function getStorageStats() {
    const KEYS = {
      projects: STORAGE_KEY,
      editingContext: 'vihu-world-builder-editing-context',
      workspaceLayout: 'vihustudio.worldBuilder.workspaceLayout'
    };
    const byKey = {};
    let totalBytes = 0;
    Object.keys(KEYS).forEach(function (label) {
      let bytes = 0;
      try {
        const raw = localStorage.getItem(KEYS[label]);
        bytes = raw ? new Blob([raw]).size : 0;
      } catch (e) {}
      byKey[label] = bytes;
      totalBytes += bytes;
    });

    let originTotalBytes = totalBytes;
    try {
      originTotalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const raw = localStorage.getItem(localStorage.key(i));
        if (raw) originTotalBytes += new Blob([raw]).size;
      }
    } catch (e) { originTotalBytes = totalBytes; }
    const otherBytes = Math.max(0, originTotalBytes - totalBytes);

    return { totalBytes: totalBytes, byKey: byKey, originTotalBytes: originTotalBytes, otherBytes: otherBytes };
  }

  return {
    list: list, get: get, create: create, save: save, duplicate: duplicate, remove: remove,
    getStorageStats: getStorageStats,
    onPersistError: onPersistError
  };
})();
try { window.ProjectStore = ProjectStore; } catch (e) {}
