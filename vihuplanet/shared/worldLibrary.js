// shared/worldLibrary.js — VihuPlanet World Library asset provider.
//
// The World Library (world-library/) is a flat, filename-agnostic
// asset tree. The Hero never hard-codes a filename — it asks for a
// renderable object TYPE (sky, tree, flower, cloud, rock, shrub,
// waterfall, story-home, dreaming-home, decoration, companion) and
// gets back whatever artwork currently lives in the matching folder,
// or nothing at all if the folder is empty.
//
// Workflow this exists to support: generate artwork, resize it,
// drop the PNG into the right world-library/ folder, refresh the
// Hero. No code change, no manifest to hand-edit, no build step.
//
// How discovery works: WorldLibrary fetches the folder URL and reads
// the directory listing the static file server returns for it
// (Apache/nginx autoindex, `python -m http.server`, most local dev
// servers return an HTML page of <a href> links for a folder with no
// index.html). If the server the Hero is running on doesn't expose a
// directory listing (many production static hosts don't), the fetch
// simply won't parse into any files and resolve()/resolveAt() return
// null — callers fall back to their existing placeholder. This is
// also what keeps the Hero working while the World Library is empty.
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
    'shrub':         'world-library/nature/shrubs/',
    'waterfall':     'world-library/nature/waterfalls/',
    'decoration':    'world-library/decorations/',
    'companion':     'world-library/companions/'
  };

  var _cache = {}; // type -> Promise<string[]> of resolved asset URLs

  function _parseListing(html, folder) {
    if (!html || typeof DOMParser === 'undefined') return [];
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var anchors = doc.querySelectorAll('a[href]');
    var seen = {};
    var files = [];
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href') || '';
      if (!IMAGE_EXT.test(href)) continue;
      var name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
      if (!name || seen[name]) continue;
      seen[name] = true;
      files.push(folder + name);
    }
    return files.sort();
  }

  function _listFolder(folder) {
    return fetch(folder)
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (html) { return _parseListing(html, folder); })
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
