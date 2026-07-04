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

  // Sprint H4-H6 — Interactive Story Worlds. Three nested layers,
  // each owning `transform` for one concern so they compose instead
  // of fighting (a CSS animation/one-shot-fill-mode always wins the
  // cascade over a plain rule on the *same* element, so hover-lift
  // cannot live on the same element as either the ambient
  // `planet-drift` animation or the `.settle` reveal/depth-ramp
  // scale — see planets.css for the full reasoning):
  //   .storyteller-planet        position, focus, depth-ramp scale,
  //                              settle-in reveal, click/keydown
  //   .storyteller-planet-hover  hover/active lift only
  //   .storyteller-planet-float  ambient planet-drift float + the
  //                              flex layout (art above label)
  // Part 8 requirement ("hover must never reset ambient floating")
  // is what this structure exists to satisfy — the float keeps
  // running on its own layer no matter what hover does on its.
  function _mountOne(container, d, idx) {
    return _resolveArtwork(d, idx).then(function (asset) {
      var wrap = document.createElement('div');
      wrap.className = 'storyteller-planet';
      wrap.setAttribute('data-planet-id', d.id);
      // Wonder before interaction, but curiosity still needs a
      // door: keyboard-focusable and announced as a button, same
      // convention WorldObject uses for `interactive:true` objects.
      // No real destination exists yet (Chapter 3 — Story World
      // entry — isn't built), so activating one plays its tactile +
      // audio acknowledgment only; nothing is faked or navigated to.
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', d.worldName);

      var p = d.placement || {};
      if (p.top    != null) wrap.style.top    = p.top;
      if (p.left   != null) wrap.style.left   = p.left;
      if (p.right  != null) wrap.style.right  = p.right;
      if (p.bottom != null) wrap.style.bottom = p.bottom;
      if (p.width  != null) wrap.style.width  = p.width;

      // Stagger the settle-in reveal so the row of planets lands
      // one at a time. Art Direction v1.0 slows the stagger so
      // planets appear in sequence rather than in a run.
      wrap.style.setProperty('--vp-settle-delay', (idx * 0.35) + 's');
      wrap.classList.add('settle');

      // Atmospheric depth per Art Direction v1.0. Background
      // planets sit softer and farther; midground reads present;
      // foreground is reserved (Chapter 3+ may use it).
      if (d.depth) wrap.classList.add('depth-' + d.depth);

      var hover = document.createElement('div');
      hover.className = 'storyteller-planet-hover';

      var float = document.createElement('div');
      float.className = 'storyteller-planet-float';
      if (d.motion) {
        if (d.motion.duration) float.style.setProperty('--vp-motion-duration', d.motion.duration);
        if (d.motion.delay)    float.style.setProperty('--vp-motion-delay',    d.motion.delay);
        if (d.motion.params) {
          Object.keys(d.motion.params).forEach(function (k) {
            float.style.setProperty(k, d.motion.params[k]);
          });
        }
        float.classList.add(d.motion.name || 'planet-drift');
      }

      if (asset.isImage) {
        var img = document.createElement('img');
        img.src = asset.content;
        img.alt = '';
        img.decoding = 'async';
        float.appendChild(img);
      } else {
        float.insertAdjacentHTML('afterbegin', asset.content);
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
      // name; no separate aria-label needed (aria-label above on the
      // interactive wrapper mirrors it for the same reason).
      var label = document.createElement('div');
      label.className = 'story-world-label';
      var tilt = ((_hashId(d.id) % 5) - 2) * 0.6; // -1.2deg .. 1.2deg, per-world
      label.style.setProperty('--vp-label-tilt', tilt + 'deg');

      var worldNameEl = document.createElement('div');
      worldNameEl.className = 'story-world-name';
      worldNameEl.textContent = d.worldName;
      label.appendChild(worldNameEl);

      float.appendChild(label);
      hover.appendChild(float);
      wrap.appendChild(hover);

      // Click/tactile feedback (Part 1) — a brief `.is-pressed` class
      // drives the 1-2px settle in CSS; HeroAudio plays the soft
      // paper-touch (Part 7) if the module loaded. No navigation:
      // see the role/tabindex comment above.
      function _activate() {
        wrap.classList.add('is-pressed');
        window.setTimeout(function () { wrap.classList.remove('is-pressed'); }, 150);
        if (global.HeroAudio && global.HeroAudio.storyWorldClick) global.HeroAudio.storyWorldClick();
      }
      wrap.addEventListener('click', _activate);
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _activate(); }
      });

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
