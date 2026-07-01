// storyteller.js — Chapter 2 module.
//
// Two things live in this file:
//
//   Storyteller           tiny registry API. Load order is:
//                         storyteller.js → storytellerData.js → scene
//                         .js. storytellerData.js calls
//                         Storyteller.register() to populate; scene
//                         .js calls StorytellerManager.mount() to
//                         paint.
//
//   StorytellerManager    load storytellers, render cards, arm
//                         hover / select interaction, drive the
//                         transition to Storyteller Home (Chapter 3).
//
// Motion is not implemented here. Every animation the manager triggers
// (settle-in on mount, pulse on select, zoom-out on transition) is a
// class from animations/motion.css — the manager only toggles
// classes. That preserves the sprint's "Reuse WorldMotion. Do not
// create another animation system." rule.

(function (global) {
  'use strict';

  // ---------- Registry -----------------------------------------------
  var _registry = [];

  function register(descriptor) {
    if (!descriptor || !descriptor.id) return false;
    for (var i = 0; i < _registry.length; i++) {
      if (_registry[i].id === descriptor.id) return false;   // duplicate id
    }
    _registry.push(descriptor);
    return true;
  }
  function list() {
    return _registry.slice().filter(function (d) { return d.enabled !== false; });
  }
  function find(id) {
    for (var i = 0; i < _registry.length; i++) {
      if (_registry[i].id === id) return _registry[i];
    }
    return null;
  }

  var Storyteller = { register: register, list: list, find: find };
  try { global.Storyteller = Storyteller; } catch (e) {}

  // ---------- Manager -----------------------------------------------
  var _mounted = false;
  var _root = null;
  var _selectedId = null;
  var _transitionCallbacks = [];

  function _svgPlus(colour) {
    return '<svg viewBox="0 0 120 120" class="storyteller-plus" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="' + colour + '" stroke-width="3" stroke-dasharray="4 6" opacity="0.85"/>' +
      '<path d="M60 34 L60 86 M34 60 L86 60" stroke="' + colour + '" stroke-width="6" stroke-linecap="round"/>' +
      '</svg>';
  }

  function _renderCard(descriptor, index) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'storyteller-card';
    card.setAttribute('data-storyteller-id', descriptor.id);
    if (descriptor.kind === 'add') card.classList.add('storyteller-card-add');
    card.style.setProperty('--st-color', descriptor.themeColor);
    card.style.setProperty('--st-accent', descriptor.accent);
    // Stagger the settle-in reveal so the row lands like it's being
    // introduced one storyteller at a time.
    card.style.setProperty('--vp-motion-delay', (index * 0.12) + 's');
    card.setAttribute('aria-label',
      descriptor.kind === 'add' ? 'Add a new storyteller' : ('Choose ' + descriptor.name));

    var avatar = document.createElement('span');
    avatar.className = 'storyteller-avatar';
    if (descriptor.kind === 'add') {
      avatar.innerHTML = _svgPlus(descriptor.themeColor);
    } else if (descriptor.avatar) {
      // Fetch + inline the SVG so `currentColor` and CSS custom
      // properties reach through to the artwork.
      fetch(descriptor.avatar).then(function (r) { return r.text(); })
        .then(function (svg) { avatar.innerHTML = svg; })
        .catch(function () { /* leave blank */ });
    }
    card.appendChild(avatar);

    // Selection sparkles — small twinkling stars that arm only when
    // the card is selected. Hidden by default via CSS.
    var sparkleLayer = document.createElement('span');
    sparkleLayer.className = 'storyteller-sparkles';
    sparkleLayer.setAttribute('aria-hidden', 'true');
    var STAR = '<svg viewBox="0 0 12 12"><path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" fill="var(--st-accent, #FFD166)"/></svg>';
    for (var s = 0; s < 5; s++) sparkleLayer.insertAdjacentHTML('beforeend', STAR);
    card.appendChild(sparkleLayer);

    var name = document.createElement('span');
    name.className = 'storyteller-name';
    name.textContent = descriptor.name;
    card.appendChild(name);

    card.addEventListener('click', function () { _select(descriptor); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _select(descriptor);
      }
    });

    return card;
  }

  function mount(container) {
    if (_mounted || !container) return;
    _root = container;

    // Subtitle — small helper text under the hero question.
    var subtitle = document.createElement('p');
    subtitle.className = 'storyteller-subtitle settle';
    subtitle.textContent = 'Choose your storyteller to begin';
    subtitle.style.setProperty('--vp-motion-delay', '0.1s');
    _root.appendChild(subtitle);

    // Card row.
    var row = document.createElement('div');
    row.className = 'storyteller-row';
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Storytellers');
    list().forEach(function (d, i) {
      var card = _renderCard(d, i + 1);
      card.classList.add('settle');
      row.appendChild(card);
    });
    _root.appendChild(row);

    _mounted = true;
  }

  function _select(descriptor) {
    if (!descriptor || _selectedId === descriptor.id) return;
    _selectedId = descriptor.id;
    _root.querySelectorAll('.storyteller-card').forEach(function (c) {
      var isSelected = c.getAttribute('data-storyteller-id') === descriptor.id;
      c.classList.toggle('is-selected', isSelected);
      c.setAttribute('aria-checked', String(isSelected));
    });
    if (descriptor.kind === 'add') {
      // Add storyteller lands in a Chapter 3+ flow — for MEP, just
      // pulse the tile and let the child know it's coming.
      _showComingSoon('Adding a new storyteller lives in a later chapter.');
      return;
    }
    // Kick off the transition after a beat so the sparkle animation
    // reads first.
    window.setTimeout(function () { _transitionToStorytellerHome(descriptor); }, 950);
  }

  function _showComingSoon(msg) {
    var host = document.querySelector('[data-storyteller-toast]');
    if (!host) {
      host = document.createElement('div');
      host.className = 'storyteller-toast';
      host.setAttribute('data-storyteller-toast', '');
      _root.appendChild(host);
    }
    host.textContent = msg;
    host.classList.add('is-visible');
    window.setTimeout(function () { host.classList.remove('is-visible'); }, 2400);
  }

  function _transitionToStorytellerHome(descriptor) {
    // Chapter 3 (Bookshelf) is not yet built. For MEP, the transition
    // plays as spec'd — smooth zoom + fade on the world — and lands
    // on a placeholder that fades back after a beat, so the app
    // stays fully functional per the Repository & Commit Contract's
    // "Never commit incomplete functionality" rule.
    document.body.classList.add('storyteller-transitioning');
    var placeholder = document.createElement('div');
    placeholder.className = 'storyteller-home-placeholder';
    placeholder.innerHTML =
      '<span class="storyteller-home-glyph">📖</span>' +
      '<span class="storyteller-home-line">Welcome, <strong>' + descriptor.name + '</strong>.</span>' +
      '<span class="storyteller-home-sub">Your Bookshelf arrives in Chapter 3.</span>';
    document.body.appendChild(placeholder);

    // Notify any listener registered via onTransition() so tests /
    // future chapters can hook in.
    _transitionCallbacks.forEach(function (cb) {
      try { cb(descriptor); } catch (e) {}
    });

    // Placeholder auto-fades back so the child returns to a live
    // scene rather than a dead-end screen.
    window.setTimeout(function () {
      placeholder.classList.add('is-leaving');
      document.body.classList.remove('storyteller-transitioning');
      window.setTimeout(function () {
        placeholder.remove();
        _root.querySelectorAll('.storyteller-card').forEach(function (c) {
          c.classList.remove('is-selected');
          c.setAttribute('aria-checked', 'false');
        });
        _selectedId = null;
      }, 900);
    }, 2800);
  }

  function onTransition(cb) { if (typeof cb === 'function') _transitionCallbacks.push(cb); }

  var StorytellerManager = {
    mount: mount,
    getSelectedId: function () { return _selectedId; },
    onTransition: onTransition
  };
  try { global.StorytellerManager = StorytellerManager; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
