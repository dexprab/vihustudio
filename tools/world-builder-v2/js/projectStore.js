// projectStore.js — Builder-owned World Project persistence.
//
// A World Project (docs/WORLD_PROJECT_CONTRACT.md) is not a folder on
// the creator's disk — it's Builder-owned, editable data. This module
// is where that data actually lives: localStorage, the same mechanism
// js/themeRegistry.js already uses for imported themes in the main
// Studio app (`_persistImported`/`_loadImported`). No GitHub, no cloud
// sync — "the current local persistence approach," per this sprint's
// own instruction.
const ProjectStore = (function () {
  'use strict';

  const STORAGE_KEY = 'vihu-world-builder-projects';

  function _readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  // AV-009 — this used to swallow a thrown QuotaExceededError silently:
  // a large upload (a realistic photo's data URL routinely runs several
  // megabytes) could push the serialized array past the browser's
  // per-origin localStorage quota, the write would throw, and the catch
  // here discarded that failure with no signal anywhere — the Workspace
  // still showed "All Changes Saved" while the actual write never
  // happened, so the next reload silently reverted to the last value
  // that *did* fit. Callers now get a real ok/error result instead of a
  // lie.
  function _writeAll(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  function _newId() {
    return 'wp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Newest-first — "My World Projects" always leads with whatever the
  // creator touched most recently.
  function list() {
    return _readAll().sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function get(id) {
    return _readAll().find(function (p) { return p.id === id; }) || null;
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
    const projects = _readAll();
    projects.push(project);
    _writeAll(projects);
    return project;
  }

  // Returns { project, ok, error } — `ok:false` means the write did NOT
  // reach localStorage (quota exceeded is the realistic case) and
  // `project.updatedAt` was bumped in memory but not actually persisted;
  // no existing caller read this function's return value before AV-009,
  // so widening it to an object here changes no other behaviour.
  function save(project) {
    project.updatedAt = new Date().toISOString();
    const projects = _readAll();
    const idx = projects.findIndex(function (p) { return p.id === project.id; });
    if (idx === -1) projects.push(project);
    else projects[idx] = project;
    const result = _writeAll(projects);
    return { project: project, ok: result.ok, error: result.error };
  }

  // Sprint B2.0.1 — Duplicate/Delete, the header overflow menu's two
  // real actions. A duplicate is a deep copy with its own new id/
  // timestamps, "(Copy)" appended to its name so it's never confused
  // with the original in "My World Projects".
  //
  // Real bug found by a user report ("nothing happens, no error, no
  // new card") — the exact AV-009 class of failure (a silent
  // QuotaExceededError from _writeAll, discarded with no signal
  // anywhere), applied to a code path AV-009 itself never touched.
  // Duplicating a World roughly doubles that World's own storage
  // footprint (original + copy both now exist), which is exactly the
  // realistic case that pushes a large, image-heavy World over this
  // browser's per-origin localStorage quota — and this function used
  // to always return the in-memory `copy` object regardless of whether
  // _writeAll actually reached storage, so the caller had no way to
  // know it silently failed. Now mirrors save()'s own {project, ok,
  // error} shape so a caller can tell the difference and say so.
  function duplicate(project) {
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(project));
    copy.id = _newId();
    copy.name = project.name + ' (Copy)';
    copy.status = 'growing';
    copy.createdAt = now;
    copy.updatedAt = now;
    delete copy.lastBuild;
    const projects = _readAll();
    projects.push(copy);
    const result = _writeAll(projects);
    return { project: copy, ok: result.ok, error: result.error };
  }

  function remove(id) {
    const projects = _readAll().filter(function (p) { return p.id !== id; });
    _writeAll(projects);
  }

  // A real, measured readout of exactly what this module (and its two
  // small sibling keys — the editing-context resume-position and the
  // Workspace layout preference) actually store in this browser, found
  // necessary while diagnosing a real silent Duplicate-quota failure —
  // there was no way for an author to see how close to full they were
  // until the write already failed. `bytes` is a real
  // `new Blob([raw]).size` measurement (UTF-16-accurate, not
  // `.length`, which undercounts any non-ASCII character a data: URI's
  // own base64 alphabet never contains but a World's name/description
  // very well might). Every key this module or its siblings write to
  // localStorage is included by name — nothing is guessed or globbed.
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
    return { totalBytes: totalBytes, byKey: byKey };
  }

  return {
    list: list, get: get, create: create, save: save, duplicate: duplicate, remove: remove,
    getStorageStats: getStorageStats
  };
})();
try { window.ProjectStore = ProjectStore; } catch (e) {}
