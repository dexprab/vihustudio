// dreamingPlanetManager.js — Chapter 2 Dreaming Planet orchestrator.
//
// State machine (matches the Visual Contract's Companion Awakening
// Sequence):
//
//   sleeping → stirring → waking → looking → smiling → speaking
//                                                     ↓
//                                    ┌────────────────┼────────────────┐
//                                    │                │                │
//                                yes (chapter 3B)  already (3A)   later (idle)
//
// The DOM carries `data-dp-state="…"` for CSS targeting; the CSS
// (dreamingPlanet.css) swaps eye / mouth SVG groups per state.
//
// Public API:
//   DreamingPlanetManager.mount(container)
//   DreamingPlanetManager.getState()
//   DreamingPlanetManager.onEnd(cb)      — invoked with the chosen
//                                          path ('yes'|'already'|'later')

(function (global) {
  'use strict';

  var STATES = {
    SLEEPING: 'sleeping',
    STIRRING: 'stirring',
    WAKING:   'waking',
    LOOKING:  'looking',
    SMILING:  'smiling',
    SPEAKING: 'speaking',
    CHOSEN:   'chosen',
    RESTING:  'resting'    // returned to sleep after "Maybe later"
  };
  var _state = STATES.SLEEPING;
  var _root = null;
  var _dialogue = null;
  var _choices = null;
  var _endCallbacks = [];
  var _mounted = false;

  function _setState(next) {
    _state = next;
    if (_root) _root.setAttribute('data-dp-state', next);
    if (global.document && document.body) document.body.setAttribute('data-dp-state', next);
  }

  function _delay(ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); }

  function _renderSphere(descriptor) {
    var wrap = document.createElement('div');
    wrap.className = 'dreaming-planet';
    wrap.setAttribute('data-dp-state', STATES.SLEEPING);
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'A dreaming planet');

    var p = descriptor.placement || {};
    if (p.top    != null) wrap.style.top    = p.top;
    if (p.left   != null) wrap.style.left   = p.left;
    if (p.right  != null) wrap.style.right  = p.right;
    if (p.bottom != null) wrap.style.bottom = p.bottom;
    if (p.width  != null) wrap.style.width  = p.width;
    if (descriptor.motion) {
      if (descriptor.motion.duration) wrap.style.setProperty('--vp-motion-duration', descriptor.motion.duration);
    }
    // The sphere itself always breathes (Living / breathing).
    wrap.classList.add('breathing');

    fetch(descriptor.asset).then(function (r) { return r.text(); })
      .then(function (svg) {
        // Insert the SVG BEFORE the orbiting-stars layer so the
        // stars sit above the sphere. The sleeping companion is
        // inside the SVG.
        wrap.insertAdjacentHTML('afterbegin', svg);
      });

    // Orbiting stars — 4 tiny stars that circle the planet centre.
    // Each star gets a phase offset so the constellation reads.
    var orbit = document.createElement('div');
    orbit.className = 'dreaming-planet-orbit';
    orbit.setAttribute('aria-hidden', 'true');
    var STAR_SVG =
      '<svg viewBox="0 0 12 12" class="dp-orbit-star">' +
        '<path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" fill="#F4D79A"/>' +
      '</svg>';
    for (var i = 0; i < 4; i++) {
      var star = document.createElement('span');
      star.className = 'dp-orbit-star-wrap orbit';
      star.style.setProperty('--vp-motion-duration', (20 + i * 4) + 's');
      star.style.setProperty('--vp-motion-delay',   (-i * 4) + 's');
      star.style.setProperty('--vp-orbit-radius',   (90 + i * 6) + 'px');
      star.innerHTML = STAR_SVG;
      orbit.appendChild(star);
    }
    wrap.appendChild(orbit);

    wrap.addEventListener('click', function () { begin(); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
    });

    return wrap;
  }

  function _renderDialogue(descriptor) {
    var host = document.createElement('div');
    host.className = 'dreaming-dialogue';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML =
      '<div class="dreaming-dialogue-bubble">' +
        '<p class="dreaming-dialogue-line" data-dp-intro>' + descriptor.companion.dialogue.intro + '</p>' +
        '<p class="dreaming-dialogue-line" data-dp-question hidden>' + descriptor.companion.dialogue.question + '</p>' +
      '</div>';
    return host;
  }

  function _renderChoices(descriptor) {
    var dlg = descriptor.companion.dialogue;
    var host = document.createElement('div');
    host.className = 'dreaming-choices';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Companion invitation');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML =
      '<button type="button" class="dreaming-choice dreaming-choice-yes" data-dp-choice="yes">'    + '<span class="dreaming-choice-glyph">🌟</span><span>Yes, I’d love to!</span>'    + '</button>' +
      '<button type="button" class="dreaming-choice dreaming-choice-already" data-dp-choice="already">' + '<span class="dreaming-choice-glyph">🏠</span><span>I already have a planet.</span>' + '</button>' +
      '<button type="button" class="dreaming-choice dreaming-choice-later" data-dp-choice="later">'   + '<span class="dreaming-choice-glyph">🌙</span><span>Maybe later.</span>'          + '</button>';
    host.querySelectorAll('.dreaming-choice').forEach(function (btn) {
      btn.addEventListener('click', function () { _choose(btn.getAttribute('data-dp-choice'), dlg); });
    });
    return host;
  }

  function _showChoicesAsync() {
    if (!_choices) return;
    _choices.setAttribute('aria-hidden', 'false');
    // requestAnimationFrame so the transition fires reliably.
    window.requestAnimationFrame(function () { _choices.classList.add('is-visible'); });
  }
  function _hideChoices() {
    if (!_choices) return;
    _choices.classList.remove('is-visible');
    _choices.setAttribute('aria-hidden', 'true');
  }

  function _showDialogueIntro() {
    if (!_dialogue) return;
    _dialogue.setAttribute('aria-hidden', 'false');
    _dialogue.classList.add('is-visible');
  }
  function _showDialogueQuestion() {
    if (!_dialogue) return;
    var q = _dialogue.querySelector('[data-dp-question]');
    if (q) q.hidden = false;
  }
  function _hideDialogue() {
    if (!_dialogue) return;
    _dialogue.classList.remove('is-visible');
    _dialogue.setAttribute('aria-hidden', 'true');
    var q = _dialogue.querySelector('[data-dp-question]');
    if (q) q.hidden = true;
  }

  function mount(container) {
    if (_mounted || !container) return;
    if (typeof DreamingPlanet === 'undefined') return;
    var descriptor = DreamingPlanet.get();
    if (!descriptor) return;

    _root = _renderSphere(descriptor);
    container.appendChild(_root);

    _dialogue = _renderDialogue(descriptor);
    container.appendChild(_dialogue);

    _choices = _renderChoices(descriptor);
    container.appendChild(_choices);

    _mounted = true;
  }

  // Kick off the wake sequence. Called on click / keyboard activate.
  function begin() {
    if (_state !== STATES.SLEEPING && _state !== STATES.RESTING) return;

    document.body.classList.add('universe-quieting');
    _setState(STATES.STIRRING);

    _delay(900)
      .then(function () { _setState(STATES.WAKING); return _delay(1000); })
      .then(function () { _setState(STATES.LOOKING); return _delay(900); })
      .then(function () { _setState(STATES.SMILING); return _delay(700); })
      .then(function () {
        _setState(STATES.SPEAKING);
        _showDialogueIntro();
        return _delay(1900);
      })
      .then(function () {
        _showDialogueQuestion();
        return _delay(1500);
      })
      .then(function () { _showChoicesAsync(); });
  }

  function _choose(path, dlg) {
    if (_state !== STATES.SPEAKING) return;
    _setState(STATES.CHOSEN);
    _hideChoices();
    var response = (path === 'yes') ? dlg.yes : (path === 'already' ? dlg.already : dlg.later);
    // Swap the bubble content with the companion's response.
    if (_dialogue) {
      var bubble = _dialogue.querySelector('.dreaming-dialogue-bubble');
      if (bubble) {
        bubble.innerHTML =
          '<p class="dreaming-dialogue-headline">' + response.headline + '</p>' +
          '<p class="dreaming-dialogue-line">' + response.line + '</p>';
      }
    }
    _endCallbacks.forEach(function (cb) { try { cb(path); } catch (e) {} });

    // "Maybe later" — planet returns to sleep and the universe wakes
    // back up so the explorer keeps exploring. The other two paths
    // fade out (Chapter 3 will pick up).
    if (path === 'later') {
      _delay(2400).then(function () {
        _hideDialogue();
        _setState(STATES.RESTING);
        document.body.classList.remove('universe-quieting');
        window.setTimeout(function () { _setState(STATES.SLEEPING); }, 1200);
      });
    } else {
      _delay(2400).then(function () {
        document.body.classList.add('dreaming-fade-out');
        window.setTimeout(function () {
          _hideDialogue();
          _root && _root.classList.add('is-gone');
          document.body.classList.remove('dreaming-fade-out');
          document.body.classList.remove('universe-quieting');
        }, 1400);
      });
    }
  }

  function onEnd(cb) { if (typeof cb === 'function') _endCallbacks.push(cb); }

  var DreamingPlanetManager = {
    STATES: STATES,
    mount: mount,
    begin: begin,
    getState: function () { return _state; },
    onEnd: onEnd
  };
  try { global.DreamingPlanetManager = DreamingPlanetManager; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
