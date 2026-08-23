// js/invite.js — somebody was invited, and this quietly notices how far
// the invitation got.
//
// Asked for by the product owner alongside the invite page: "track if
// the invite was accepted."
//
// ---------------------------------------------------------------
// WHAT THIS IS NOT
//
// It is NOT analytics on children, and it must never grow into that.
// There is no session, no page view, no dwell time, no funnel of things
// a child touched. This module can write exactly four facts about one
// INVITATION — that it was opened, that somebody crossed the threshold,
// and that they finished their first story — and it can write each of
// them once. Nothing it sends identifies a child, because it has
// nothing to identify one with: the token names an invitation, not a
// person, and VihuPlanet has no accounts (CLAUDE.md → Decision 11).
//
// A child who arrives through an invite link gets exactly the same
// VihuPlanet as a child who typed the address. The token unlocks
// nothing, is never asked for, and is never shown.
//
// ---------------------------------------------------------------
// THE TOKEN IS AN INTENT, AND INTENTS ARE CONSUMED
//
// Decision 23: "Intent may cross; state may not" — `?born=` and
// `?story=` are read once and stripped from the address bar. `?invite=`
// is the same kind of thing and is treated the same way, so a shared
// screenshot of the URL carries nothing and a refresh cannot re-fire
// anything.
//
// It is kept in localStorage afterwards for one reason only: the
// journey it records finishes in the STUDIO, a different document from
// the one the link landed on. Without that it could never learn whether
// the invitation was accepted.
//
// ---------------------------------------------------------------
// EVERY PATH IS BEST-EFFORT
//
// No platform configured, no network, an unknown token, a stale link —
// each ends with nothing recorded and the child's own experience
// completely untouched. Nothing here is ever awaited by anything a
// child is waiting for.
const Invite = (function () {
  'use strict';

  var KEY = 'vihu-invite-token';
  var DONE = 'vihu-invite-stages';   // stages already reported, per token

  function _read(k, d) {
    try { return localStorage.getItem(k) || d; } catch (e) { return d; }
  }

  function _token() {
    var t = _read(KEY, '');
    return /^[a-z0-9]{8,64}$/i.test(t) ? t : '';
  }

  // Which stages this browser has already reported for this token. The
  // database coalesces anyway — a stage is written once and never
  // moved — but there is no reason to send the same fact on every load.
  function _already(stage) {
    var t = _token();
    if (!t) return true;
    try {
      var all = JSON.parse(_read(DONE, '{}') || '{}');
      return !!(all[t] && all[t][stage]);
    } catch (e) { return false; }
  }

  function _remember(stage) {
    var t = _token();
    if (!t) return;
    try {
      var all = JSON.parse(_read(DONE, '{}') || '{}');
      if (!all[t]) all[t] = {};
      all[t][stage] = 1;
      localStorage.setItem(DONE, JSON.stringify(all));
    } catch (e) {}
  }

  function _client() {
    if (typeof window.ThemeRepositoryClient === 'undefined') return Promise.resolve(null);
    return window.ThemeRepositoryClient.isConfigured().then(function (ok) {
      if (!ok) return null;
      return window.ThemeRepositoryClient.getClient();
    }).catch(function () { return null; });
  }

  /**
   * Reads `?invite=` off the address, keeps it, strips it, and records
   * that the letter was opened. Safe to call on any page and on every
   * load — a page with no token in the address simply does nothing, and
   * a token already stored is not re-reported.
   */
  function capture() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var fresh = (params.get('invite') || '').trim();
      if (fresh && /^[a-z0-9]{8,64}$/i.test(fresh)) {
        try { localStorage.setItem(KEY, fresh); } catch (e) {}
        // CONSUMED, exactly like every other intent that crosses into
        // the product. The address bar is left clean.
        params.delete('invite');
        var qs = params.toString();
        var url = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
        try { window.history.replaceState({}, '', url); } catch (e) {}
      }
      reached('opened');
    } catch (e) {}
  }

  /**
   * One step of the journey, recorded once.
   * @param {string} stage 'opened' | 'explored' | 'creator'
   */
  function reached(stage) {
    try {
      if (['opened', 'explored', 'creator'].indexOf(stage) === -1) return;
      var t = _token();
      if (!t) return;
      if (_already(stage)) return;
      // REMEMBERED ONLY ONCE IT LANDED. The first version marked the
      // stage before the round trip, reasoning that a failed send must
      // not become a retry on every page load. That was the wrong trade
      // and it broke the feature outright: the platform client is not
      // always ready the instant a page loads, and a stage marked
      // locally is never sent again — so an invitation that was opened
      // could sit on the roll saying nobody opened it.
      //
      // Retrying is cheap and bounded: at most one call per stage per
      // page load, and `invite_reached` coalesces server-side, so a
      // late second report writes nothing new.
      _client().then(function (client) {
        if (!client) return;
        return client.rpc('invite_reached', { p_token: t, p_stage: stage })
          .then(function (r) { if (!r || !r.error) _remember(stage); });
      }).catch(function () {});
    } catch (e) {}
  }

  /** Whether this browser is carrying an invitation at all. */
  function pending() { return !!_token(); }

  /** Test seam. Forgets the invitation entirely. */
  function _forget() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(DONE); } catch (e) {}
  }

  // READS ITSELF IN. A page that includes this file has said everything
  // it needs to say — there is no configuration, and forgetting the one
  // call is exactly how an invitation gets opened and nobody hears
  // about it.
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { capture(); });
    } else {
      capture();
    }
  } catch (e) {}

  return { capture: capture, reached: reached, pending: pending, _forget: _forget };
})();
try { window.Invite = Invite; } catch (e) {}
