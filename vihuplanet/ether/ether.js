// ether.js — the first real VihuPlanet Ether surface.
//
// This page's own job is small, and deliberately so: mount a universe,
// ask EtherFeed for the real published Stories, start it. Everything
// that makes it feel like somewhere is the runtime, unchanged.
//
// It also owns two things the runtime correctly knows nothing about:
//
//   1. DEEP LINKS. Every Story in the Ether has a URL. Opening one
//      focuses it; focusing one puts it in the address bar, so the
//      link a child copies is the Story they are looking at.
//   2. The quiet state. An Ether with no Stories in it is not an
//      error, and it is not empty either — the universe is alive on
//      its own. It just gets one line explaining why nothing is
//      drifting yet.
//
// Both are wired through the runtime's own signals. Nothing in
// vihuplanet/runtime/ was modified to support this page, which is the
// architecture doing what it was built to do.

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Deep links
  //
  //   .../vihuplanet/ether/?story=proj_m8x2k1_a7f3
  //
  // The project id, not the entity id. It is the stable identifier the
  // Story has everywhere else in VihuStudio — in the project store, in
  // the cloud row, in a future reading view — and a link should
  // survive anything the runtime chooses to call things internally.
  //
  // A query parameter rather than a hash so the link reads as a place
  // rather than an anchor, and so a future server-rendered preview
  // (an open-graph card for a shared Story) can see it. Both work on a
  // static host; only one of them is visible to anything but the
  // browser.
  //
  // WHAT A SHARED LINK CAN AND CANNOT DO TODAY, stated plainly because
  // it is the honest limit of this feature: it resolves for anyone
  // whose Ether contains that Story. Today that means the creator
  // themselves, including on another device once their Magic Card has
  // synced. It does NOT yet resolve for a stranger, because there is no
  // public VihuPlanet to read from — `creator_projects` is a private,
  // card-gated backup. The URL contract is what a public feed will
  // need; the feed is what a stranger will need. This page handles the
  // gap by saying so rather than by failing silently.
  // ---------------------------------------------------------------
  var PARAM = 'story';

  function linkedProjectId() {
    try {
      return new URLSearchParams(window.location.search).get(PARAM);
    } catch (e) { return null; }
  }

  function setLink(projectId) {
    try {
      var url = new URL(window.location.href);
      if (projectId) url.searchParams.set(PARAM, projectId);
      else url.searchParams.delete(PARAM);
      // replaceState, not pushState: drifting through the Ether and
      // looking at Stories is browsing, not navigating. Every glance
      // should not become a back-button step a child has to unwind.
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function projectIdOf(entity) {
    return (entity && entity.source && entity.source.projectId) || null;
  }

  // ---------------------------------------------------------------
  function quiet(message) {
    var box = document.querySelector('[data-quiet]');
    var line = document.querySelector('[data-quiet-line]');
    if (!box || !line) return;
    if (!message) { box.hidden = true; return; }
    line.textContent = message;
    box.hidden = false;
  }

  function boot() {
    var mount = document.querySelector('[data-universe]');
    if (!mount || !window.VihuPlanet) return;

    var universe = VihuPlanet.Universe.create({ mount: mount });
    if (!universe) return;

    // The universe starts before the Stories arrive, always. It is
    // alive on its own — that is the whole premise of Sprint U1 — so
    // there is nothing to wait for and no loading state to show.
    universe.start();
    window.vihuPlanetUniverse = universe;

    // --- the address bar follows the Story a child is looking at ---
    universe.on('focus:opened', function (payload) {
      setLink(projectIdOf(payload.entity));
    });
    universe.on('focus:closed', function () {
      setLink(null);
    });

    if (typeof EtherFeed === 'undefined') {
      quiet('This Ether cannot reach your stories right now.');
      return;
    }

    EtherFeed.attach(universe).then(function (stories) {
      var wanted = linkedProjectId();

      if (!stories.length) {
        quiet(wanted
          ? 'That story is not in your Ether yet.'
          : 'Nothing of yours is drifting here yet. Share a story and it will join VihuPlanet.');
        return;
      }

      quiet(null);
      if (!wanted) return;

      // Resolve the deep link. The Story is already in the Ether and
      // already drifting; focusing it is the whole of "opening" it —
      // the universe brings it forward exactly as a touch would, so an
      // arriving link and an arriving finger do the same thing.
      var match = null;
      for (var i = 0; i < stories.length; i++) {
        if (stories[i].source && stories[i].source.projectId === wanted) {
          match = stories[i];
          break;
        }
      }

      if (!match) {
        quiet('That story is not in your Ether yet.');
        return;
      }

      // One beat, so the child sees the universe before it moves. A
      // link that snaps straight to a card never shows them where the
      // story lives.
      window.setTimeout(function () { universe.focus.open(match.id); }, 900);
    }).catch(function () {
      quiet('This Ether cannot reach your stories right now.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
