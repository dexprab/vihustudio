// studioEntry.js — the Studio is never opened directly.
//
// CLAUDE.md -> Decision 10: "Studio is never opened directly — only
// through intent, and intent is one of exactly two things: I want to see
// my stories, or I want to create a story."  Decision 23: "VihuPlanet is
// never resumed — it is always entered."
//
// Both were stated and neither was enforced, so the browser broke them
// for every child. The moment a child taps ✨ Create Story the address
// bar reads studio.html, and from then on a refresh, a closed and
// reopened tab, a restored session, the back button and a bookmark all
// land in the Studio and never on VihuPlanet. Reported exactly that way:
// "if i am working on a story and than refresh the page or simply close
// the page and reopen vihuplanet it goes directly to studio."
//
// ---------------------------------------------------------------
// WHY A ONE-SHOT PASS, AND NOT A FLAG
//
// A flag saying "this browser has been through VihuPlanet" would be
// true forever after the first visit, which is no gate at all. A
// sessionStorage flag would survive a refresh — and a refresh is one of
// the two cases the product owner named, so it has to go home too.
//
// So authority is minted per navigation and consumed on arrival: it
// authorises exactly ONE load of the Studio. Whoever intends a load says
// so; nobody else can. The same one-shot sessionStorage shape
// js/creatorRecognition.js already uses for its recognition pass.
//
// This module OWNS the key. It is read raw in exactly one other place —
// the inline gate at the top of studio.html — because that gate has to
// run before any script has loaded, which is the whole point of it. That
// duplication is deliberate and documented at both ends.
// ---------------------------------------------------------------

const StudioEntry = (function () {
  'use strict';

  var KEY = 'vihu.studioEntry.pass';

  // Is the document we are in right now the Studio itself? Used so a
  // page that reloads itself keeps its own authority without ever
  // handing authority to a different page — js/buildStamp.js runs on
  // VihuPlanet too, and minting a Studio pass from there would authorise
  // a later direct arrival that nobody asked for.
  function _isStudio() {
    try {
      return /(^|\/)studio\.html$/.test(window.location.pathname);
    } catch (e) { return false; }
  }

  // Authorise ONE upcoming load of the Studio. Called by whoever is
  // about to send a child there on purpose — today only
  // js/vihuplanetHome.js's goStudio(), which Decision 21 already
  // established as the single door.
  function pass() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }

  // This document is about to reload ITSELF and means to come back as
  // itself. Carries the Studio's authority across its own reload, so an
  // in-Studio navigation (Home, a clean slate, a cache-busting refetch)
  // is not mistaken for somebody arriving at the Studio from nowhere.
  //
  // A no-op anywhere that is not the Studio, so it is always safe to
  // call from code shared with VihuPlanet.
  function renewHere() {
    if (!_isStudio()) return;
    pass();
  }

  // Read + remove. Present for completeness and for tests; the live
  // consumer is the inline gate in studio.html, which must run before
  // this file exists.
  function consume() {
    try {
      var v = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      return !!v;
    } catch (e) { return false; }
  }

  return { pass: pass, renewHere: renewHere, consume: consume, KEY: KEY };
})();
