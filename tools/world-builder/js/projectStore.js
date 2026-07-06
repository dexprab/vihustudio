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

  function _writeAll(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {}
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
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      files: generated.files
    };
    const projects = _readAll();
    projects.push(project);
    _writeAll(projects);
    return project;
  }

  function save(project) {
    project.updatedAt = new Date().toISOString();
    const projects = _readAll();
    const idx = projects.findIndex(function (p) { return p.id === project.id; });
    if (idx === -1) projects.push(project);
    else projects[idx] = project;
    _writeAll(projects);
    return project;
  }

  // Sprint B2.0.1 — Duplicate/Delete, the header overflow menu's two
  // real actions. A duplicate is a deep copy with its own new id/
  // timestamps, "(Copy)" appended to its name so it's never confused
  // with the original in "My World Projects".
  function duplicate(project) {
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(project));
    copy.id = _newId();
    copy.name = project.name + ' (Copy)';
    copy.status = 'draft';
    copy.createdAt = now;
    copy.updatedAt = now;
    delete copy.lastBuild;
    const projects = _readAll();
    projects.push(copy);
    _writeAll(projects);
    return copy;
  }

  function remove(id) {
    const projects = _readAll().filter(function (p) { return p.id !== id; });
    _writeAll(projects);
  }

  return { list: list, get: get, create: create, save: save, duplicate: duplicate, remove: remove };
})();
try { window.ProjectStore = ProjectStore; } catch (e) {}
