// planets.js — Chapter 2 storyteller-planet system.
//
// Same registry pattern WorldObject uses (Chapter 1) — a descriptor
// is register()ed, then mount() fetches every SVG, injects it into
// the foreground layer, and stamps placement + motion CSS
// properties. Each planet carries a hand-drawn storyteller name and
// a one-line story teaser (rendered as small labels beneath the
// sphere).
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

  function _mountOne(container, d, idx) {
    return fetch(d.asset).then(function (r) { return r.text(); }).then(function (svg) {
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
        wrap.classList.add(d.motion.name || 'planet-drift');
      }
      // Stagger the settle-in reveal so the row of planets lands
      // one at a time.
      wrap.style.setProperty('--vp-settle-delay', (idx * 0.18) + 's');
      wrap.classList.add('settle');

      wrap.innerHTML =
        svg +
        '<div class="storyteller-planet-label" aria-hidden="true">' +
          '<div class="storyteller-planet-name">' + d.name + '</div>' +
          '<div class="storyteller-planet-teaser">' + d.teaser + '</div>' +
        '</div>';
      wrap.setAttribute('aria-label', d.name + ' — ' + d.teaser);
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
