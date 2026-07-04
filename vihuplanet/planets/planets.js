// planets.js — Chapter 2 storyteller-planet system.
//
// Same registry pattern WorldObject uses (Chapter 1) — a descriptor
// is register()ed, then mount() resolves its artwork, injects it into
// the foreground layer, and stamps placement + motion CSS
// properties. Each planet is a Story World: mount() renders its
// worldName as plain typography near the artwork — no card, no
// background, no badge. The Hero presents worlds, not user profiles;
// storytellerName lives on the descriptor but is never shown
// (Sprint · Story World Identity, narrowed to World-Name-only in
// Sprint · Atmosphere & World Identity).
//
// A descriptor's optional `libraryType` (MEP-01: World Library
// integration — see shared/worldLibrary.js) is tried first; the
// existing `asset` SVG is the fallback whenever the World Library has
// nothing for that type yet.
//
// The Dreaming Planet is NOT part of this registry — it lives in
// its own module because its behaviour is singular.
//
// Public API:
//   Planet.register(descriptor)
//   Planet.list()
//   Planet.find(id)
//   PlanetsManager.mount(container)

(function (global) {
  'use strict';

  var _registry = [];

  function register(d) {
    if (!d || !d.id) return false;
    for (var i = 0; i < _registry.length; i++) {
      if (_registry[i].id === d.id) return false;
    }
    _registry.push(d);
    return true;
  }
  function list() { return _registry.slice().filter(function (d) { return d.enabled !== false; }); }
  function find(id) {
    for (var i = 0; i < _registry.length; i++) if (_registry[i].id === id) return _registry[i];
    return null;
  }

  var Planet = { register: register, list: list, find: find };
  try { global.Planet = Planet; } catch (e) {}

  // Small deterministic hash so each Story World's label gets its own
  // slight tilt (see --vp-label-tilt in planets.css) — "natural
  // variation" without literal randomness, so it's stable across
  // reloads instead of jittering.
  function _hashId(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  }

  // World Library first (libraryType: 'story-home'), existing SVG
  // (d.asset) as the fallback — same pattern as WorldObject. `idx` is
  // the planet's position in the registry, reused so a given planet
  // consistently picks the same World Library asset across mounts
  // once more than one story-home image exists.
  function _resolveArtwork(d, idx) {
    var hasLibrary = d.libraryType && global.WorldLibrary;
    var libraryLookup = hasLibrary
      ? global.WorldLibrary.resolveAt(d.libraryType, idx).catch(function () { return null; })
      : Promise.resolve(null);

    return libraryLookup.then(function (url) {
      if (url) return { isImage: true, content: url };
      return fetch(d.asset).then(function (r) { return r.text(); }).then(function (svg) {
        return { isImage: false, content: svg };
      });
    });
  }

  function _mountOne(container, d, idx) {
    return _resolveArtwork(d, idx).then(function (asset) {
      var wrap = document.createElement('div');
      wrap.className = 'storyteller-planet';
      wrap.setAttribute('data-planet-id', d.id);

      var p = d.placement || {};
      if (p.top    != null) wrap.style.top    = p.top;
      if (p.left   != null) wrap.style.left   = p.left;
      if (p.right  != null) wrap.style.right  = p.right;
      if (p.bottom != null) wrap.style.bottom = p.bottom;
      if (p.width  != null) wrap.style.width  = p.width;

      if (d.motion) {
        if (d.motion.duration) wrap.style.setProperty('--vp-motion-duration', d.motion.duration);
        if (d.motion.delay)    wrap.style.setProperty('--vp-motion-delay',    d.motion.delay);
        if (d.motion.params) {
          Object.keys(d.motion.params).forEach(function (k) {
            wrap.style.setProperty(k, d.motion.params[k]);
          });
        }
        wrap.classList.add(d.motion.name || 'planet-drift');
      }
      // Stagger the settle-in reveal so the row of planets lands
      // one at a time. Art Direction v1.0 slows the stagger so
      // planets appear in sequence rather than in a run.
      wrap.style.setProperty('--vp-settle-delay', (idx * 0.35) + 's');
      wrap.classList.add('settle');

      // Atmospheric depth per Art Direction v1.0. Background
      // planets sit softer and farther; midground reads present;
      // foreground is reserved (Chapter 3+ may use it).
      if (d.depth) wrap.classList.add('depth-' + d.depth);

      if (asset.isImage) {
        var img = document.createElement('img');
        img.src = asset.content;
        img.alt = '';
        img.decoding = 'async';
        wrap.appendChild(img);
      } else {
        wrap.insertAdjacentHTML('afterbegin', asset.content);
      }

      // World Name is the Story World's only visible identity
      // (Sprint · Atmosphere & World Identity) — the Hero presents
      // places, not profiles. storytellerName stays on the
      // descriptor for a possible future use, but is intentionally
      // hidden from the Hero entirely — including assistive tech, so
      // sighted and screen-reader experiences match — "dreamed by"
      // is retired. Pure typography — no card, no background, no
      // badge — so it reads as printed onto the page rather than
      // floating UI. The visible label itself is the accessible
      // name; no separate aria-label needed.
      var label = document.createElement('div');
      label.className = 'story-world-label';
      var tilt = ((_hashId(d.id) % 5) - 2) * 0.6; // -1.2deg .. 1.2deg, per-world
      label.style.setProperty('--vp-label-tilt', tilt + 'deg');

      var worldNameEl = document.createElement('div');
      worldNameEl.className = 'story-world-name';
      worldNameEl.textContent = d.worldName;
      label.appendChild(worldNameEl);

      wrap.appendChild(label);
      container.appendChild(wrap);
      return wrap;
    }).catch(function () { return null; });
  }

  function mount(container) {
    if (!container) return Promise.resolve([]);
    var mounts = list().map(function (d, i) { return _mountOne(container, d, i); });
    return Promise.all(mounts);
  }

  var PlanetsManager = { mount: mount };
  try { global.PlanetsManager = PlanetsManager; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
