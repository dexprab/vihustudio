// shared/worldObject.js — VihuPlanet reusable World Object system.
//
// Every visible thing that lives in the world (moon, stars, clouds,
// rocket, paper plane, tufts, telescope, and every future landmark)
// is a **World Object**: a small descriptor that pairs a source SVG
// with placement + motion metadata. The scene bootstrap in
// `js/scene.js` walks the registry and injects each object into the
// DOM in one place.
//
// Why not raw <img> or <svg> in index.html?
//   * The world will grow. A future sprint (Sprint M0.2) adds
//     storyteller cards, sprint M1.x adds VihuStudio landing as a
//     destination inside VihuPlanet, and sprint M2.x adds new
//     landmarks (garden, library, workshop, telescope-interactive).
//     A registry lets a new object arrive by adding one entry — no
//     HTML shuffling, no CSS refactor.
//   * Each object declares its **motion category** (see
//     animations/motion.css — Living / Greeting / Journey /
//     Celebration). The scene doesn't hard-code "cloud → drift";
//     it reads the declared category and attaches the matching class.
//   * Non-interactive vs. interactive objects can be flagged.
//     The telescope in M0.1 is a visual landmark only; a future
//     sprint flips `interactive:true` and adds a click handler.
//
// Public API:
//
//   WorldObject.register(descriptor)
//     descriptor = {
//       id: 'moon',                           // stable identifier
//       label: 'Moon',                        // aria-label
//       assetHref: 'assets/objects/moon.svg', // fetched + inlined —
//                                              // also the fallback if
//                                              // libraryType has no art yet
//       libraryType: 'cloud',                 // optional — World Library
//                                              // object type (see
//                                              // shared/worldLibrary.js).
//                                              // When set, WorldObject asks
//                                              // WorldLibrary for artwork
//                                              // first and only falls back
//                                              // to assetHref if none exists.
//       layer: 'sky' | 'ground' | 'foreground',
//       placement: { top, left, width, height, transform },
//       motion: { category, name, duration, delay, params },
//       interactive: false                    // true → clickable
//     }
//
//   WorldObject.list()             // returns registered descriptors
//   WorldObject.mount(container)   // resolves every object's artwork
//                                  // (World Library first, SVG fallback)
//                                  // and appends it into the world tree

(function (global) {
  'use strict';

  var _registry = [];
  var _typeCounters = {};

  function register(descriptor) {
    if (!descriptor || !descriptor.id) return false;
    for (var i = 0; i < _registry.length; i++) {
      if (_registry[i].id === descriptor.id) return false;   // duplicate id
    }
    _registry.push(descriptor);
    return true;
  }

  function list() { return _registry.slice(); }

  // Mount every world object into the correct layer. The scene has
  // three layers: .sky, .ground, .foreground. Descriptors that name
  // a layer that doesn't exist yet fall back to .sky.
  function mount(container) {
    if (!container) return Promise.resolve([]);
    var mounts = _registry.map(function (d) {
      return _mountOne(container, d);
    });
    return Promise.all(mounts);
  }

  // Resolves the artwork to render for a descriptor: World Library
  // first (if libraryType is declared and the library has something
  // for it), the existing hardcoded SVG otherwise. This is the only
  // place that decides between the two — everything downstream just
  // renders whatever comes back.
  function _resolveArtwork(d) {
    var libraryType = d.libraryType;
    var hasLibrary = libraryType && global.WorldLibrary;
    var index = 0;
    if (hasLibrary) {
      _typeCounters[libraryType] = (_typeCounters[libraryType] || 0) + 1;
      index = _typeCounters[libraryType] - 1;
    }
    var libraryLookup = hasLibrary
      ? global.WorldLibrary.resolveAt(libraryType, index).catch(function () { return null; })
      : Promise.resolve(null);

    return libraryLookup.then(function (url) {
      if (url) return { isImage: true, content: url };
      return fetch(d.assetHref).then(function (r) { return r.text(); }).then(function (svgText) {
        return { isImage: false, content: svgText };
      });
    });
  }

  function _mountOne(container, d) {
    return _resolveArtwork(d).then(function (asset) {
      var layer = container.querySelector('.' + (d.layer || 'sky')) || container.querySelector('.sky');
      if (!layer) return null;

      // Wrap the artwork so placement + motion styles hang off the
      // wrapper — the inner asset stays pure. That lets the same
      // asset ship at different sizes / positions if a scene
      // instantiates the same descriptor twice in a future sprint.
      var wrap = document.createElement('div');
      wrap.className = 'world-object world-object-' + d.id;
      wrap.dataset.objectId = d.id;

      var p = d.placement || {};
      if (p.top      != null) wrap.style.top      = p.top;
      if (p.left     != null) wrap.style.left     = p.left;
      if (p.right    != null) wrap.style.right    = p.right;
      if (p.bottom   != null) wrap.style.bottom   = p.bottom;
      if (p.width    != null) wrap.style.width    = p.width;
      if (p.height   != null) wrap.style.height   = p.height;
      if (p.transform!= null) wrap.style.transform= p.transform;

      // Motion → classes come from animations/motion.css. The scene
      // registry declares category + name; scene.js applies them.
      if (d.motion) {
        wrap.dataset.motionCategory = d.motion.category || '';
        wrap.dataset.motionName     = d.motion.name     || '';
        if (d.motion.duration) wrap.style.setProperty('--vp-motion-duration', d.motion.duration);
        if (d.motion.delay)    wrap.style.setProperty('--vp-motion-delay',    d.motion.delay);
        if (d.motion.params) {
          Object.keys(d.motion.params).forEach(function (k) {
            wrap.style.setProperty(k, d.motion.params[k]);
          });
        }
      }

      if (d.interactive === true) {
        wrap.setAttribute('role', 'button');
        wrap.setAttribute('tabindex', '0');
        wrap.classList.add('is-interactive');
      } else {
        wrap.setAttribute('aria-hidden', 'true');
      }

      if (asset.isImage) {
        var img = document.createElement('img');
        img.src = asset.content;
        img.alt = '';
        img.decoding = 'async';
        wrap.appendChild(img);
      } else {
        wrap.innerHTML = asset.content;
      }

      layer.appendChild(wrap);
      return wrap;
    }).catch(function () { return null; });
  }

  var api = { register: register, list: list, mount: mount };
  try { global.WorldObject = api; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
