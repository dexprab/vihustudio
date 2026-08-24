// buildStamp.js — which build am I looking at?
//
// Asked for while testing: "will make it easier to identify we are on
// correct build". A stale cached page and a broken change look
// identical from the outside, and several rounds of this sprint were
// spent wondering which one was in front of us.
//
// IT READS ITS OWN SCRIPT TAG. The version is the `?v=` cache-buster
// every page already stamps on every script it loads, so there is no
// second number to remember to update — the thing on screen is, by
// construction, the thing the browser actually fetched. A hardcoded
// version string would eventually disagree with the files, which is
// precisely the confusion this exists to end.
//
// IT ALSO KNOWS WHEN IT IS OUT OF DATE. Reading the version off the
// script tag says which build is RUNNING; it cannot say whether that is
// the latest one, and that gap cost this sprint several rounds — a
// countdown was reported missing from a page built before the countdown
// existed, and the only way to tell was to diff `?v=` out of a
// screenshot against the git log.
//
// The cause is structural rather than anybody's mistake: `?v=` busts
// every script, and nothing busts the DOCUMENT that names them. A
// browser holding a cached index.html will keep asking for exactly the
// old scripts it already knows about, forever, and every one of those
// requests looks perfectly fresh.
//
// So the stamp fetches version.txt with `cache: 'no-store'` — one line,
// no headers to trust — and if the build in it differs from the build
// running, it SAYS so and offers to fix itself. It never reloads on its
// own: a page that reloads under a child mid-story is a worse bug than
// the one this solves.
//
// Canon (CLAUDE.md, Decision 9) says development instrumentation is not
// part of the experience and stays out of the universe's way. So this
// is four characters in a corner at a third opacity, cannot be clicked
// through to anything, is hidden from screen readers, and never moves.
// A child will not notice it; a tester glances at it. The stale state
// is the one exception and earns it: it is amber, it is clickable, and
// it only ever appears when the page is genuinely behind.
(function () {
  'use strict';

  function version() {
    try {
      // Its own tag first — that is the one guaranteed to carry the
      // same stamp as everything else on the page.
      var own = document.currentScript;
      if (own && own.src) {
        var m = own.src.match(/[?&]v=([^&]+)/);
        if (m) return m[1];
      }
      var any = document.querySelector('script[src*="v="]');
      if (any) {
        var m2 = any.src.match(/[?&]v=([^&]+)/);
        if (m2) return m2[1];
      }
    } catch (e) {}
    return null;
  }

  var BASE = [
    'position:fixed',
    'left:8px',
    'bottom:6px',
    'z-index:2147483000',
    'font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
    'letter-spacing:.04em',
    'user-select:none',
    '-webkit-user-select:none'
  ];

  // A DIFFERENT URL, not a reload.
  //
  // location.reload() is served the cached document — the very thing
  // that is wrong — so it would change nothing and could loop. A query
  // the browser has never seen is a different cache key, which is what
  // actually forces a fresh fetch of the HTML.
  //
  // Every parameter already on the address is kept: ?story= and ?born=
  // are real deep links (Decisions 9 and 12) and a child arriving on one
  // must still arrive there after updating.
  function refetch(latest) {
    // This page coming back as itself with a fresh copy. On the Studio
    // that has to carry its entry authority across, or the gate at the
    // top of studio.html treats the update as an unauthorised arrival
    // and sends the child to VihuPlanet mid-story. A no-op on
    // VihuPlanet's own page, which is where this badge also runs.
    try { StudioEntry.renewHere(); } catch (e) {}
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('b', latest);
      window.location.replace(url.toString());
    } catch (e) {
      window.location.reload();
    }
  }

  // Consumed on arrival, exactly as clearBorn() does for ?born=. The
  // cache-buster did its work in the request; leaving it on screen would
  // make a shared link carry somebody else's build number.
  function clearBuster() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has('b')) return;
      url.searchParams.delete('b');
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function askIfStale(el, running) {
    if (!window.fetch) return;
    // no-store, not no-cache: no-cache still revalidates through the
    // same caches this is trying to see past.
    window.fetch('version.txt', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) return null;
      return r.text();
    }).then(function (text) {
      if (!text) return;
      var latest = String(text).trim();
      if (!latest || latest === running) return;

      // IT NOW FIXES ITSELF, ONCE.
      //
      // "cache buster needed. the screen is flickering between old and
      // new screen" — the product owner. The mechanism below was
      // already right and simply waited to be tapped, so a stale
      // document stayed stale until somebody noticed a four-character
      // badge in the corner. What that actually looks like from the
      // outside is one load showing the old screen and the next showing
      // the new one, which is exactly the report.
      //
      // The original reasoning for never reloading stands and is kept:
      // a page that reloads under a child mid-story is a worse bug than
      // the one this solves. So the Rite is the one place it still only
      // offers — a chapter cannot survive its own page being replaced,
      // and there is nothing else in the Studio that a refetch costs,
      // because every edit is already autosaved and StudioEntry's
      // authority is carried across by refetch().
      //
      // ONCE, and the guard is the point. If the fresh document comes
      // back reporting the same old build — a cache that ignores the
      // query, a half-finished deploy — a second attempt would loop
      // forever on a blank screen. Remembering which `latest` we have
      // already tried turns that into a single wasted load and then the
      // badge, which is a bad state a person can see and act on rather
      // than one that hides.
      var riteRunning = false;
      try {
        riteRunning = typeof StudioRite !== 'undefined' && StudioRite.isRunning && StudioRite.isRunning();
      } catch (e) {}
      var tried = null;
      try { tried = sessionStorage.getItem('vihu.buildStamp.tried'); } catch (e) {}
      if (!riteRunning && tried !== latest) {
        try { sessionStorage.setItem('vihu.buildStamp.tried', latest); } catch (e) {}
        refetch(latest);
        return;
      }

      el.textContent = 'build ' + running + ' → ' + latest + ' · tap to update';
      el.style.cssText = BASE.concat([
        'color:#0f1220',
        'background:rgba(232,184,113,.92)',
        'padding:5px 8px',
        'border-radius:6px',
        'cursor:pointer',
        'pointer-events:auto'
      ]).join(';');
      el.removeAttribute('aria-hidden');
      el.addEventListener('click', function () { refetch(latest); });
    }).catch(function () {
      // Offline, or no version.txt deployed. Saying nothing is right:
      // the stamp's first job is to report the build it is on, and it
      // still does that.
    });
  }

  function mount() {
    var v = version();
    if (!v) return;
    clearBuster();
    if (document.querySelector('[data-build-stamp]')) return;
    var el = document.createElement('div');
    el.setAttribute('data-build-stamp', '');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'build ' + v;
    el.style.cssText = BASE.concat([
      'color:rgba(150,160,190,.42)',
      'pointer-events:none'
    ]).join(';');
    (document.body || document.documentElement).appendChild(el);
    askIfStale(el, v);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
