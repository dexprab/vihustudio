// shared/worldLibrary.js — VihuPlanet World Library asset provider.
//
// The World Library (world-library/) is a flat, filename-agnostic
// asset tree. The Hero never hard-codes a filename — it asks for a
// renderable object TYPE (sky, tree, flower, cloud, rock, shrub,
// waterfall, story-home, dreaming-home, decoration, companion) and
// gets back whatever artwork currently lives in the matching folder,
// or nothing at all if the folder is empty.
//
// Workflow this exists to support: generate artwork, resize it, drop
// the PNG into the right world-library/ folder, push. The VihuPlanet
// World Library pipeline synchronizes the PNG and regenerates that
// folder's manifest.json automatically — no code change, no manifest
// to hand-edit, no build step.
//
// How discovery works: WorldLibrary fetches manifest.json from the
// object type's folder — a flat JSON array of PNG filenames, nothing
// else — and builds asset URLs from it. Manifests are plain static
// files, so this works identically on GitHub Pages, local dev
// servers, and every other static host (unlike the directory-listing
// approach this replaced, which relies on server autoindexing and
// returns 404 on most production hosts). If manifest.json is missing,
// unreachable, or lists no assets, resolve()/resolveAt() return null
// — callers fall back to their existing placeholder. This is also
// what keeps the Hero working while a World Library collection is
// empty.
//
// Public API:
//   WorldLibrary.resolve(type)          -> Promise<string|null>
//     First available asset URL for a type, or null.
//   WorldLibrary.resolveAt(type, index) -> Promise<string|null>
//     Cycles through whatever's discovered so multiple instances of
//     the same type (e.g. six flowers) can vary once more than one
//     asset exists, without any caller-side bookkeeping.
//   WorldLibrary.resolveMany(type, count) -> Promise<string[]>
//   WorldLibrary.TYPES                  -> array of supported type names

(function (global) {
  'use strict';

  var IMAGE_EXT = /\.png$/i;

  // Object type -> World Library folder. Mirrors the folder tree
  // exactly (see world-library/ at the project root).
  var FOLDERS = {
    'sky':           'world-library/skies/',
    'story-home':    'world-library/story-homes/',
    'dreaming-home': 'world-library/dreaming-home/',
    'tree':          'world-library/nature/trees/',
    'flower':        'world-library/nature/flowers/',
    'cloud':         'world-library/nature/clouds/',
    'rock':          'world-library/nature/rocks/',
    'shrub':         'world-library/shrubs/',
    'waterfall':     'world-library/nature/waterfalls/',
    'decoration':    'world-library/decorations/',
    'companion':     'world-library/companions/'
  };

  var _cache = {}; // type -> Promise<string[]> of resolved asset URLs

  function _parseManifest(names, folder) {
    if (!Array.isArray(names)) return [];
    var seen = {};
    var files = [];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (typeof name !== 'string' || !IMAGE_EXT.test(name) || seen[name]) continue;
      seen[name] = true;
      files.push(folder + name);
    }
    return files.sort();
  }

  function _listFolder(folder) {
    return fetch(folder + 'manifest.json')
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (names) { return _parseManifest(names, folder); })
      .catch(function () { return []; });
  }

  function _filesFor(type) {
    var folder = FOLDERS[type];
    if (!folder) return Promise.resolve([]);
    if (!_cache[type]) _cache[type] = _listFolder(folder);
    return _cache[type];
  }

  function resolveAt(type, index) {
    return _filesFor(type).then(function (files) {
      if (!files.length) return null;
      return files[((index % files.length) + files.length) % files.length];
    });
  }

  function resolve(type) {
    return resolveAt(type, 0);
  }

  function resolveMany(type, count) {
    return _filesFor(type).then(function (files) {
      if (!files.length) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(files[i % files.length]);
      return out;
    });
  }

  var api = {
    resolve: resolve,
    resolveAt: resolveAt,
    resolveMany: resolveMany,
    TYPES: Object.keys(FOLDERS)
  };
  try { global.WorldLibrary = api; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
