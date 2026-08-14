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
// Canon (CLAUDE.md, Decision 9) says development instrumentation is not
// part of the experience and stays out of the universe's way. So this
// is four characters in a corner at a third opacity, cannot be clicked
// through to anything, is hidden from screen readers, and never moves.
// A child will not notice it; a tester glances at it.
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

  function mount() {
    var v = version();
    if (!v) return;
    if (document.querySelector('[data-build-stamp]')) return;
    var el = document.createElement('div');
    el.setAttribute('data-build-stamp', '');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'build ' + v;
    el.style.cssText = [
      'position:fixed',
      'left:8px',
      'bottom:6px',
      'z-index:2147483000',
      'font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.04em',
      'color:rgba(150,160,190,.42)',
      'pointer-events:none',
      'user-select:none',
      '-webkit-user-select:none'
    ].join(';');
    (document.body || document.documentElement).appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
