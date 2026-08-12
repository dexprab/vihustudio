// publishTarget.js — where a finished story goes.
//
// There is ONE editor, ONE story format and ONE authoring experience.
// The only thing that ever differs between a child making a story and
// the VihuPlanet team making an official one is the destination.
//
// ---------------------------------------------------------------
// TARGETS, NOT MODES
//
// The obvious way to build this would be "Creator Mode" and "Author
// Mode" as two states threaded through the editor, and it is a trap:
// every panel, every control and every save path would grow an `if`,
// and the two would drift until they were two products sharing a
// codebase. Nothing in the editor asks this file anything. Only the
// very last step does — the moment a finished story needs somewhere to
// go — which is why this module is tiny and why it is imported by
// exactly one screen.
//
//   CREATOR → Share with VihuPlanet   (js/shareCeremony.js)
//             The child's story, owned by them, becomes a Story Spirit.
//   CANON   → Publish to Canon        (js/canonRepository.js)
//             A product asset, owned by nobody, shipped with the app.
//
// If a future change has to touch the editor to add a third target,
// the seam is in the wrong place.
// ---------------------------------------------------------------
//
// AUTHOR MODE IS A DEVELOPMENT CONFIGURATION, and deliberately not a
// role, an account or a permission. The sprint is explicit that role
// management, user administration and permission editing are out of
// scope, and none of them exist here. A child cannot reach this: it is
// switched by a URL only somebody who knows it exists would ever type,
// and once off it leaves nothing behind.
//
//   studio.html?author=on    turn it on for this browser
//   studio.html?author=off   turn it off again
//
// It is remembered in localStorage so an author does not re-type it on
// every load, and the parameter is stripped from the address bar the
// moment it is read, so it is never in a link anybody can share by
// accident.

const PublishTarget = (function () {
  'use strict';

  var CREATOR = 'creator';
  var CANON = 'canon';

  var KEY = 'vihu-author-mode';
  var PARAM = 'author';

  function _read() {
    try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; }
  }

  function _write(on) {
    try {
      if (on) localStorage.setItem(KEY, 'on');
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  // Read once, at load, and strip the parameter in the same breath.
  // Leaving it in the address bar would make it survive a copied link,
  // and Author Mode arriving by accident in somebody else's browser is
  // the one failure mode a development switch must not have.
  (function consumeParam() {
    try {
      var url = new URL(window.location.href);
      var v = url.searchParams.get(PARAM);
      if (v === null) return;
      _write(v === 'on' || v === '1' || v === 'true');
      url.searchParams.delete(PARAM);
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  })();

  function isAuthorMode() { return _read(); }

  // The target a story finished RIGHT NOW would go to. Author Mode is
  // the only thing that changes it, and it changes nothing else.
  function current() { return _read() ? CANON : CREATOR; }

  function isCanon() { return current() === CANON; }

  // The words each target uses at the end of a story. Kept here rather
  // than in Publish Studio so the one screen that changes reads as
  // "ask the target what it is called", not as a mode switch.
  var LABELS = {
    creator: {
      brand: '📖 Finish Story',
      review: 'Finish My Story',
      commit: 'Finish My Story',
      commitHeadline: 'Your story is ready to finish!',
      celebration: '🎉 You finished your story!',
      destination: 'Share with VihuPlanet',
      destinationGlyph: '🌌'
    },
    canon: {
      // The author's language is the product's, not a child's. Nothing
      // here is softened, because nobody here needs it to be.
      brand: '📖 Canon Authoring',
      review: 'Review Complete',
      commit: '❄️ Freeze This Story',
      commitHeadline: 'Ready to freeze.',
      celebration: '❄️ Story frozen.',
      destination: 'Publish to Canon',
      destinationGlyph: '🌌'
    }
  };

  function labels() { return LABELS[current()]; }

  var api = {
    CREATOR: CREATOR,
    CANON: CANON,
    current: current,
    isCanon: isCanon,
    isAuthorMode: isAuthorMode,
    labels: labels,
    // Exposed for the development switch and for tests. Not a role
    // system and not an entry point for anything the product does on a
    // child's behalf.
    setAuthorMode: function (on) { _write(!!on); }
  };
  try { window.PublishTarget = api; } catch (e) {}
  return api;
})();
