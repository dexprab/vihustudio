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

  // ---------------------------------------------------------------
  // AN ARRIVAL, AND WHY IT IS A SECOND KEY
  //
  // The pass above answers "may this load happen?" and is consumed by
  // the inline gate at the top of studio.html before any script runs.
  // By the time anything else is loaded the answer is gone, and it
  // could not have been reused anyway: renewHere() mints the SAME pass
  // for a Studio reloading ITSELF, so a pass says "this load is
  // allowed", never "somebody arrived".
  //
  // Those are different questions and Sprint 1J needs the second one.
  // A Companion that greets a child on every load would greet them
  // again on the Home button, on Publish's clean slate and on the build
  // stamp's cache-busting refetch — none of which is an arrival.
  //
  // So pass() stamps an arrival TOKEN and renewHere() deliberately does
  // not. The token is not consumed: it stays for the whole visit, which
  // is what lets a later reload recognise itself as the same arrival
  // rather than a new one. It is a monotonic counter, never a random or
  // a clock value — nothing about identifying one navigation needs
  // either, and a deterministic token is a testable one.
  var ARRIVAL_KEY = 'vihu.studioEntry.arrival';
  var ARRIVAL_SEQ = 'vihu.studioEntry.arrivalSeq';

  function _mintArrival() {
    try {
      var n = parseInt(sessionStorage.getItem(ARRIVAL_SEQ) || '0', 10);
      if (!isFinite(n) || n < 0) n = 0;
      n += 1;
      sessionStorage.setItem(ARRIVAL_SEQ, String(n));
      sessionStorage.setItem(ARRIVAL_KEY, 'arrival:' + n);
    } catch (e) {}
  }

  // The token for the arrival this document belongs to, or null when
  // this load is not one — a direct Author Mode load, or a browser that
  // refuses storage. Null is a complete answer and reads as "cannot be
  // proved", never as an error.
  function arrival() {
    try { return sessionStorage.getItem(ARRIVAL_KEY) || null; } catch (e) { return null; }
  }

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
    _mintArrival();
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
    // The raw key only. NOT pass(): this document is coming back as
    // itself, so the arrival it already belongs to is unchanged, and
    // minting a new token here is precisely how the Home button would
    // become a second arrival.
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
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

  return {
    pass: pass, renewHere: renewHere, consume: consume, arrival: arrival,
    KEY: KEY, ARRIVAL_KEY: ARRIVAL_KEY, ARRIVAL_SEQ: ARRIVAL_SEQ
  };
})();
