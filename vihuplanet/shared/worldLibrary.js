// shared/worldLibrary.js — VihuPlanet World Library asset provider.
//
// The World Library (world-library/) is a flat, filename-agnostic
// asset tree. The Hero never hard-codes a filename — it asks for a
// renderable object TYPE (sky, tree, flower, cloud, rock, shrub,
// waterfall, story-home, dreaming-home, decoration, companion,
// telescope, trail, seed, story-meadow) and gets back whatever
// artwork currently lives in the matching folder, or nothing at all
// if the folder is empty.
//
// Hero Composition Engine (Sprint · Atmosphere & World Identity;
// extended in Sprint · Dreaming Realm Implementation; extended to
// vary the Dream Trail; extended again in Sprint H4-H6 for the
// Telescope Library): sky, cloud, story-meadow, dreaming-home, and
// trail vary once per browser session. The first resolveAt() call
// for one of those types picks a random offset and sticks it in
// sessionStorage; every later call (this load or a refresh/
// navigation within the same tab) reuses it, so the chosen
// environment holds steady for the session and only changes when a
// fresh session starts. Story Worlds are never in this set — see
// SESSION_VARIED_TYPES below.
//
// Telescope was session-varied too until the Hero Premium Pass
// (Pass 4): a craft audit found the Telescope Library's 10 other
// candidates broke storybook consistency (glossy CG shading, or
// visibly blurred/artifacted renders) next to the hand-painted
// floating islands, while `telescope.png` alone matched — genuine
// watercolor texture, warm palette, star/moon motif. FILE_FILTERS
// below narrows the folder to that one file; the other 10 stay in
// World Library, unused, for future variants to inherit from rather
// than being deleted.
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
//   WorldLibrary.displayFor(url)        -> {anchor?, focusY?} | null
//     Display-framing hint for a URL previously returned by one of the
//     resolve calls above, or null if that asset declares none. Purely
//     data — callers decide what to do with it (see worldObject.js's
//     generic --vp-display-position application).
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
    'companion':     'world-library/companions/',
    'telescope':     'world-library/telescope/',
    'trail':         'world-library/trails/',
    'seed':          'world-library/seeds/',
    'story-meadow':  'world-library/nature/story-meadows/'
  };

  // Types the Hero Composition Engine varies once per browser
  // session. Everything else resolves the same deterministic way it
  // always has (first file, or cycling by registration order).
  var SESSION_VARIED_TYPES = { 'sky': true, 'cloud': true, 'story-meadow': true, 'dreaming-home': true, 'trail': true };

  // Some collections carry a now-superseded file alongside their
  // canonical set — e.g. dreaming-home's original single
  // `dreaming_home.png` stayed in the World Library after the three
  // production `dreaming-world-0N.png` homes landed. Filtering here
  // (rather than deleting the file) keeps World Library content
  // untouched — it's the pipeline's source of truth, not this repo's.
  var FILE_FILTERS = {
    'dreaming-home': /^dreaming-world-\d+\.png$/i,
    'telescope':     /^telescope\.png$/i
  };
  var SESSION_KEY_PREFIX = 'vp-session-offset-';
  var _sessionOffsets = {}; // type -> chosen offset, memoized per page load

  function _sessionOffset(type) {
    if (!SESSION_VARIED_TYPES[type]) return 0;
    if (_sessionOffsets[type] !== undefined) return _sessionOffsets[type];

    var offset;
    try {
      var key = SESSION_KEY_PREFIX + type;
      var stored = global.sessionStorage ? global.sessionStorage.getItem(key) : null;
      if (stored !== null) {
        offset = parseInt(stored, 10) || 0;
      } else {
        offset = Math.floor(Math.random() * 997);
        if (global.sessionStorage) global.sessionStorage.setItem(key, String(offset));
      }
    } catch (e) {
      // Storage unavailable (private browsing, etc.) — still vary for
      // this one page load, just without persisting across reloads.
      offset = Math.floor(Math.random() * 997);
    }
    _sessionOffsets[type] = offset;
    return offset;
  }

  var _cache = {}; // type -> Promise<string[]> of resolved asset URLs

  // A manifest entry is normally a plain filename string. The World
  // Library pipeline (Sprint MEP-08, vihuplanet-world-library) can
  // optionally emit `{id, file, display}` objects instead, for
  // collections that declare per-file display-framing metadata
  // (display.json upstream) — Story Meadow is the first. `display`
  // (anchor/focusY) is generic, asset-agnostic hint data: any World
  // Library collection can carry it, and nothing here — or in
  // shared/worldObject.js, which is what actually applies it — ever
  // branches on which collection or file it belongs to.
  function _manifestEntryFilename(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry.file === 'string') return entry.file;
    return null;
  }

  // url -> display object, populated alongside the resolved file list
  // in _parseManifest. Looked up post-hoc via displayFor() once a
  // caller has a resolved URL in hand — by construction that's always
  // after _parseManifest already ran for it, so no ordering to manage.
  var _displayByUrl = {};

  function _parseManifest(names, folder, type) {
    if (!Array.isArray(names)) return [];
    var filter = FILE_FILTERS[type];
    var seen = {};
    var files = [];
    for (var i = 0; i < names.length; i++) {
      var entry = names[i];
      var name = _manifestEntryFilename(entry);
      if (typeof name !== 'string' || !IMAGE_EXT.test(name) || seen[name]) continue;
      if (filter && !filter.test(name)) continue;
      seen[name] = true;
      var url = folder + name;
      files.push(url);
      if (entry && typeof entry === 'object' && entry.display) _displayByUrl[url] = entry.display;
    }
    return files.sort();
  }

  // Generic lookup: the display block (anchor/focusY, or whatever a
  // future field adds) for a URL previously returned by resolve()/
  // resolveAt()/resolveMany(), or null if that asset carries none.
  // Takes a URL rather than a type+index so a caller never needs to
  // re-derive which manifest entry it came from.
  function displayFor(url) {
    return _displayByUrl[url] || null;
  }

  function _listFolder(folder, type) {
    return fetch(folder + 'manifest.json')
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (names) { return _parseManifest(names, folder, type); })
      .catch(function () { return []; });
  }

  function _filesFor(type) {
    var folder = FOLDERS[type];
    if (!folder) return Promise.resolve([]);
    if (!_cache[type]) _cache[type] = _listFolder(folder, type);
    return _cache[type];
  }

  function resolveAt(type, index) {
    return _filesFor(type).then(function (files) {
      if (!files.length) return null;
      var i = index + _sessionOffset(type);
      return files[((i % files.length) + files.length) % files.length];
    });
  }

  function resolve(type) {
    return resolveAt(type, 0);
  }

  function resolveMany(type, count) {
    return _filesFor(type).then(function (files) {
      if (!files.length) return [];
      var offset = _sessionOffset(type);
      var out = [];
      for (var i = 0; i < count; i++) out.push(files[(i + offset) % files.length]);
      return out;
    });
  }

  var api = {
    resolve: resolve,
    resolveAt: resolveAt,
    resolveMany: resolveMany,
    displayFor: displayFor,
    TYPES: Object.keys(FOLDERS)
  };
  try { global.WorldLibrary = api; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
