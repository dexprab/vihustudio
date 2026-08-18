// etherHost.js — the Story's host, standing in the portal.
//
// Sprint 1, Companion as World Host. When a Traveller opens a Story,
// the Companion of whoever made it is there — quiet, alive, and
// entirely optional to notice.
//
//   The story owns the attention. The Companion enriches the
//   experience.
//
// The test this file is held to: a Traveller must be able to read the
// whole Story start to finish while ignoring the Companion completely.
// Nothing here is a control, nothing waits for a tap, and nothing
// blocks a page. If it is noticed at all it should read as "there is
// someone living in this world", never as "an assistant appeared".
//
// ---------------------------------------------------------------
// WHY THIS IS NOT THE COMPANION WIDGET
//
// js/companionEngine.js's own mounted widget is the Studio's
// companion: it appends itself to document.body, it is draggable, it
// remembers where it was dragged to, it reacts to clicks and hovers
// with sparkle bursts, and it carries a speech bubble, a little grass-
// and-flowers "home" and a cloud charm. Every one of those is right in
// the Studio and wrong over a story somebody is reading — a draggable
// portrait that remembers its position is a Companion a child can park
// on top of the page, which is the one thing the attention hierarchy
// forbids.
//
// So this uses the SAME Companion Engine seams the three existing
// in-place companion surfaces already use — CompanionEngine.
// loadRegistry() for who exists, and the package's own
// companion.json states map for the art (js/studioRite.js,
// js/shareCeremony.js and js/magicCardUI.js all do exactly this, and
// each says so in a comment). No second companion system, no redrawn
// art, no change to any Companion's visual identity, and zero lines
// changed in js/companionEngine.js.
//
// ---------------------------------------------------------------
// THE ATTENTION HIERARCHY, MADE STRUCTURAL
//
// story -> story content -> interactive elements -> Companion -> UI.
//
// A z-index and a bit of care would have satisfied that by eye and
// broken the first time a Story had an unusually shaped page. Instead
// the host lives in its own reserved band at the foot of the portal
// (.ether-portal-foot, css/vihuplanet-home.css), so it CANNOT overlap
// the page, the arrows, the close control, the title or the count —
// there is no geometry in which those rectangles intersect, because
// they are in different rows of the same flex column. The band only
// reserves its height when a host is actually standing in it, so a
// Story with no host gets the layout it always had, to the pixel.
//
// It is also pointer-events:none. Not a click target, not a dismiss
// control, not a panel — there is nothing to interact with, so there
// is nothing to explain.
//
// ---------------------------------------------------------------
// FOUR BEHAVIOURS, AND ONLY FOUR
//
//   welcome    a small wave as the Story opens, settling to idle
//   presence   idle, with the gentlest float
//   reaction   one quiet pose when a page turns, rate-limited
//   celebrate  a brief flourish on the last page, once per reading
//
// There is no look/observe, no react-to-story-events and no scene
// transition, and that is not an omission. This runtime has no event
// model to hook and no scenes at all — EtherFeed.pagesOf() returns a
// flat list of page images. Inventing events to react to would be
// inventing a story model that does not exist.
//
// The page-turn reaction deliberately fires AFTER the turn animation
// has finished. A Companion moving while the paper is moving is two
// things competing for the same glance, and the page has to win.
const EtherHost = (function () {
  'use strict';

  // Poses as PREFERENCES, never requirements. The Companion packs have
  // genuinely uneven art — measured, not assumed: leafy is complete;
  // nimbus and leosaurus have no `think`; quill has no `celebrate`, no
  // `happy`, no `surprised` and no `sleep`. Every one of those is a
  // real child's real bonded Companion, so a behaviour has to degrade
  // to whatever that pack actually ships rather than showing a broken
  // image or, worse, someone else's art.
  //
  // Each chain ends somewhere every pack has (`idle` is a package's
  // declared defaultState by contract), so the worst case is "the host
  // simply does not change pose" — which reads as a calm presence, not
  // as a fault.
  const POSES = {
    welcome:   ['wave', 'happy', 'hero', 'idle'],
    presence:  ['idle'],
    reaction:  ['curious', 'think', 'surprised', 'idle'],
    celebrate: ['celebrate', 'happy', 'hero', 'idle']
  };

  const WELCOME_DELAY_MS   = 760;   // after the portal has finished opening
  const WELCOME_HOLD_MS    = 1900;
  const REACTION_HOLD_MS   = 1300;
  const REACTION_QUIET_MS  = 2600;  // never react more often than this
  const CELEBRATE_HOLD_MS  = 2400;

  let root = null;      // [data-portal-host]
  let img  = null;      // [data-portal-host-img]
  let foot = null;      // the reserved band

  let pack = null;      // {basePath, pkg}
  let poses = null;     // resolved pose name -> real src (or null)
  let timers = [];
  let lastReactionAt = 0;
  let celebrated = false;

  // One token per open(). Everything asynchronous checks it before
  // touching the DOM, so a Story closed while its Companion was still
  // resolving can never arrive late over the next one. This is also
  // what makes "no duplicate Companion across page turns and reopens"
  // true by construction rather than by tidying up afterwards.
  let token = 0;

  function _els() {
    if (root) return true;
    root = document.querySelector('[data-portal-host]');
    img  = document.querySelector('[data-portal-host-img]');
    foot = root ? root.closest('.ether-portal-foot') : null;
    return !!(root && img);
  }

  function _later(fn, ms) {
    const mine = token;
    const id = window.setTimeout(function () {
      if (mine !== token) return;
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function _clearTimers() {
    timers.forEach(function (id) { window.clearTimeout(id); });
    timers = [];
  }

  // ---------- what art actually exists ----------
  //
  // A pose DECLARED in companion.json is not a guarantee the file has
  // been uploaded — a disclosed gap across several packs, and the
  // reason js/studioRite.js, js/shareCeremony.js and js/magicCardUI.js
  // each carry their own version of this note. Here the check is done
  // ONCE per Story, up front, so a behaviour knows whether it can
  // happen before its moment arrives rather than discovering a 404
  // mid-flourish.
  const _probe = {};
  function _exists(src) {
    if (_probe[src]) return _probe[src];
    _probe[src] = new Promise(function (resolve) {
      const probe = new Image();
      probe.onload  = function () { resolve(probe.naturalWidth > 0); };
      probe.onerror = function () { resolve(false); };
      probe.src = src;
    });
    return _probe[src];
  }

  function _srcFor(name) {
    const states = pack && pack.pkg && pack.pkg.states;
    return (states && states[name]) ? (pack.basePath + states[name]) : null;
  }

  function _firstReal(chain, i) {
    i = i || 0;
    if (i >= chain.length) return Promise.resolve(null);
    const src = _srcFor(chain[i]);
    if (!src) return _firstReal(chain, i + 1);
    return _exists(src).then(function (ok) {
      return ok ? src : _firstReal(chain, i + 1);
    });
  }

  function _resolvePoses() {
    const kinds = Object.keys(POSES);
    return Promise.all(kinds.map(function (k) { return _firstReal(POSES[k]); }))
      .then(function (found) {
        const out = {};
        kinds.forEach(function (k, i) { out[k] = found[i]; });
        return out;
      });
  }

  function _pose(kind) {
    if (!img || !poses) return;
    const src = poses[kind] || poses.presence;
    if (!src) return;
    if (img.getAttribute('src') === src) return;
    img.setAttribute('src', src);
  }

  // ---------- the presence itself ----------

  function _mount(record) {
    if (!_els()) return;
    // Decorative by intention as well as by CSS: a Traveller using a
    // screen reader is reading a story, and a Companion announcing
    // itself into that would be the loudest thing in the portal.
    img.setAttribute('alt', '');
    root.hidden = false;
    if (foot) foot.classList.add('has-host');
    _pose('presence');
    // Two frames, matching how the portal itself opens: the browser
    // has to have laid the element out before the arriving class has
    // anything to transition from.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (root) root.classList.add('is-here');
      });
    });
  }

  /**
   * A Story has been opened. Resolves its host, and shows it only if
   * there really is one — a Story shared before the Companion
   * travelled with it shows nobody at all, never a substitute.
   *
   * @param {object} story the Story Entity the portal is showing
   */
  function open(story) {
    close();
    const mine = ++token;
    if (typeof StoryHost === 'undefined') return;

    StoryHost.resolve(story).then(function (record) {
      if (mine !== token || !record) return null;
      return StoryHost.packOf(record).then(function (found) {
        if (mine !== token || !found) return null;
        pack = found;
        return _resolvePoses().then(function (resolved) {
          if (mine !== token) return null;
          // Not one real image in the whole package. Showing an empty
          // frame would be worse than showing nothing.
          if (!resolved.presence) return null;
          poses = resolved;
          _mount(record);
          // The welcome waits for the portal to have finished opening.
          // Arriving in the middle of that is one movement too many at
          // the exact moment the child is looking at the first page.
          _later(function () {
            _pose('welcome');
            _later(function () { _pose('presence'); }, WELCOME_HOLD_MS);
          }, WELCOME_DELAY_MS);
          return null;
        });
      });
    }).catch(function () { /* a quieter portal, never a broken one */ });
  }

  /**
   * A page has turned. Called once the turn has finished, so the
   * Companion never moves while the paper is moving.
   *
   * @param {number} index the page now showing, zero-based
   * @param {number} total how many pages the Story has
   */
  function pageTurned(index, total) {
    if (!poses || !root || root.hidden) return;

    // The last page. A brief flourish, once per reading — a Companion
    // that celebrated again every time a child flicked back and forth
    // over the end would stop meaning anything.
    //
    // A one-page Story never reaches here (there is no turn to make),
    // which is right: the welcome already happened seconds ago, and
    // there was no journey to have finished.
    if (total > 1 && index >= total - 1 && !celebrated) {
      celebrated = true;
      _pose('celebrate');
      _later(function () { _pose('presence'); }, CELEBRATE_HOLD_MS);
      return;
    }

    // One quiet reaction. Rate-limited so that a child turning pages
    // quickly gets a companion that is reading along, not one
    // flickering between poses.
    const now = Date.now();
    if (now - lastReactionAt < REACTION_QUIET_MS) return;
    lastReactionAt = now;
    _pose('reaction');
    _later(function () { _pose('presence'); }, REACTION_HOLD_MS);
  }

  /** The portal is closing. The host leaves with it. */
  function close() {
    token++;
    _clearTimers();
    pack = null;
    poses = null;
    celebrated = false;
    lastReactionAt = 0;
    if (!root && !_els()) return;
    if (root) {
      root.classList.remove('is-here');
      root.hidden = true;
    }
    if (foot) foot.classList.remove('has-host');
    if (img) img.removeAttribute('src');
  }

  const api = { open: open, close: close, pageTurned: pageTurned };
  try { window.EtherHost = api; } catch (e) {}
  return api;
})();
