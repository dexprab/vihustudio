// js/companionFacts.js — what a Creator has TOLD their own Companion.
//
// Sprint 1N.3. The private half of Companion knowledge.
//
//     Creator: "My name is Vihaan."
//     ... later ...
//     Creator: "What's my name?"
//     Companion: "Your name is Vihaan."
//
// ---------------------------------------------------------------
// TOLD IS NOT PUBLISHED, AND TOLD IS NOT REMEMBERED
//
// A child telling their Companion something is neither of those. It is
// not a memory (js/companionMemory.js), it is not a Bond Moment
// (supabase/functions/_shared/bondValidator.js), and it does not travel
// to the Ether. It is a current fact about the relationship, replaced
// when it changes, with no history — the same shape as the name a child
// gives their Companion (js/companionName.js), and it deliberately uses
// the same scoping, the same refusal without a card, and the same
// validator.
//
// The Bond validator is not imported, mentioned or consulted anywhere
// in this file, and `remember` is not a call it can make.
//
// ---------------------------------------------------------------
// A CLOSED SET, SO NOTHING IS INVENTED
//
// Only the keys in TELLABLE can be stored. A Companion that hoovered up
// every sentence a child said would be the general record of everything
// the Creator does that Decision 30 forbids in as many words; this can
// hold the handful of things a child deliberately tells it and nothing
// else.
const CompanionFacts = (function () {
  'use strict';

  const KEY = 'vihu.companion.told';

  // What a child can tell their Companion about themselves. One entry
  // today, and adding one is a product decision rather than a side
  // effect — every key here needs a way to be asked for as well as a
  // way to be said, or it is a store with a leak in it.
  const TELLABLE = ['name'];

  function _read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) { return {}; }
  }
  function _write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); return true; }
    catch (e) { return false; }
  }

  /** The active card and the Companion bonded to it, or null. */
  function _slot() {
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive)
        ? MagicCard.getActive() : null;
      if (!c || !c.id) return null;
      return c.id + '|' + (c.companionId || 'none');
    } catch (e) { return null; }
  }

  /**
   * ONE COPY OF "IS THIS A NAME", and it is not here.
   * js/companionMind.js -> validName() owns the shape rules, so a child
   * is allowed to be called exactly what their Companion is allowed to
   * be called. With the Mind absent this REFUSES, exactly as the naming
   * store does: a write gated on a validator must fail closed.
   */
  function _valid(raw) {
    try {
      if (typeof CompanionMind !== 'undefined' && CompanionMind.validName) {
        return CompanionMind.validName(raw);
      }
    } catch (e) {}
    return { ok: false, name: null, reason: 'no-validator' };
  }

  /** Everything this Creator has told this Companion. Never null. */
  function all() {
    const slot = _slot();
    if (!slot) return {};
    const mine = _read()[slot];
    return (mine && typeof mine === 'object') ? mine : {};
  }

  function get(key) {
    const v = all()[String(key)];
    return (typeof v === 'string' && v) ? v : null;
  }

  /**
   * Told. Replaces — a child correcting their own name is not a second
   * name, and a list of everything they have ever said they were called
   * is a history nobody asked to keep.
   */
  function tell(key, value) {
    const k = String(key || '');
    if (TELLABLE.indexOf(k) === -1) return { ok: false, value: null, reason: 'not-tellable' };
    const slot = _slot();
    if (!slot) return { ok: false, value: null, reason: 'no-card' };
    const v = _valid(value);
    if (!v.ok) return { ok: false, value: null, reason: v.reason };
    const map = _read();
    const mine = (map[slot] && typeof map[slot] === 'object') ? map[slot] : {};
    mine[k] = v.name;
    map[slot] = mine;
    _write(map);
    return { ok: true, value: v.name, reason: 'ok' };
  }

  function forget(key) {
    const slot = _slot();
    if (!slot) return false;
    const map = _read();
    const mine = map[slot];
    if (!mine || !Object.prototype.hasOwnProperty.call(mine, String(key))) return false;
    delete mine[String(key)];
    _write(map);
    return true;
  }

  /**
   * A TRAVELLER CANNOT TELL A COMPANION ANYTHING, because they have no
   * Companion of their own and tell() refuses without a card. This
   * exists so js/travellerReset.js has an answer here rather than an
   * absence — the same reason js/companionName.js carries one.
   */
  function forgetTraveller() { return false; }

  const api = {
    KEY: KEY,
    TELLABLE: TELLABLE,
    all: all,
    get: get,
    tell: tell,
    forget: forget,
    forgetTraveller: forgetTraveller
  };
  try { window.CompanionFacts = api; } catch (e) {}
  return api;
})();
