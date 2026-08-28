// js/companionName.js — what a child calls their Companion.
//
// Sprint 1N.2. A small piece of RELATIONSHIP STATE, and deliberately
// nothing more than that.
//
// ---------------------------------------------------------------
// IT IS NOT A MEMORY, AND IT IS NOT A BOND MOMENT
//
// "Creator and Leo shared a meaningful moment" is a memory. "This
// child calls Leo 'Spark'" is a setting — a current fact about the
// relationship, replaced when it changes, with no history and nothing
// to consolidate. So it does not go through js/companionMemory.js: it
// would show up in list(), be retrievable by recall(), and be recited
// back as something the two of them did. The Bond validator is not
// imported, mentioned or consulted, and there is no proposal, no
// model and no transcript anywhere in this file.
//
// ---------------------------------------------------------------
// THE CANONICAL IDENTITY IS UNTOUCHED
//
// Leo is still Leo. `MagicCard.companionName` is the bond and is never
// written here — a child choosing what to call somebody is not a
// rename of that somebody, and asked directly the Companion says both
// (js/companionMind.js -> the `identity` intent).
//
// ---------------------------------------------------------------
// SCOPED TO CREATOR + COMPANION, AND UNWRITEABLE WITHOUT A CARD
//
// The key is the active card's id and the Companion's id together, so
// Creator A calling Leo "Spark" is invisible to Creator B on the same
// machine, and a child with two Companions names each of them
// separately. A Traveller holds no card, so set() refuses — the same
// door js/companionMemory.js -> remember() closes, and for the same
// reason: a record with no card behind it must never outlive its
// session (Decision 19).
//
// Local to the device. There is no column for it, and inventing one
// would be a schema change this sprint may not make; a child who names
// their Companion on a grandmother's laptop names it there. That is a
// disclosed limit rather than an oversight.
const CompanionName = (function () {
  'use strict';

  const KEY = 'vihu.companion.called';
  const MAX = 24;
  const MAX_WORDS = 3;

  // WHAT A NAME MAY BE MADE OF. Letters (including accented ones), a
  // digit or two, spaces, apostrophes and hyphens. Everything a URL, an
  // email, a token, an internal identifier or a fragment of markup
  // needs — : / @ . < > _ { } = — is absent from this set, so those are
  // refused by construction rather than by a list of things to look
  // for. The value-shape rules in js/companionPrivacyGate.js are then
  // asked as a second, independent reading, because one check that
  // agrees with itself is not two checks.
  const ALLOWED = /^[\p{L}\p{M}0-9 '’-]+$/u;
  const HAS_LETTER = /\p{L}/u;

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
      const companion = c.companionId || 'none';
      return c.id + '|' + companion;
    } catch (e) { return null; }
  }

  /**
   * Is this something a child may call their Companion?
   *
   * Bounded, plain, and free of anything that is not a name. The reason
   * is a DIAGNOSTIC — it is for a suite and a developer, and no child
   * ever meets one: the Companion's answer to a refused name is a
   * sentence in its own voice, asked for again kindly.
   *
   * @returns {{ok:boolean, name:(string|null), reason:string}}
   */
  function validate(raw) {
    const t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!t) return { ok: false, name: null, reason: 'empty' };
    if (t.length > MAX) return { ok: false, name: null, reason: 'too-long' };
    if (!ALLOWED.test(t)) return { ok: false, name: null, reason: 'not-a-name' };
    if (!HAS_LETTER.test(t)) return { ok: false, name: null, reason: 'no-letters' };
    if (t.split(' ').length > MAX_WORDS) return { ok: false, name: null, reason: 'too-many-words' };
    // A SECOND, INDEPENDENT READING. The charset above already refuses
    // every shape below; this asks the privacy gate's own rules as
    // well, so if that set is ever widened the two disagree loudly
    // rather than quietly.
    try {
      if (typeof CompanionPrivacyGate !== 'undefined' && CompanionPrivacyGate.audit) {
        const seen = CompanionPrivacyGate.audit({ called: t }, { keys: false });
        if (seen && seen.clean === false) return { ok: false, name: null, reason: 'not-a-name' };
      }
    } catch (e) {}
    return { ok: true, name: t, reason: 'ok' };
  }

  /** What this Creator calls this Companion, or null. */
  function get() {
    const slot = _slot();
    if (!slot) return null;
    const v = _read()[slot];
    return (typeof v === 'string' && v) ? v : null;
  }

  /**
   * Choose it, or change it. A rename REPLACES — there is one current
   * name and no accumulating history, because a list of everything a
   * child has ever called somebody is a record of them changing their
   * mind, which nobody asked to keep.
   */
  function set(raw) {
    const slot = _slot();
    if (!slot) return { ok: false, name: null, reason: 'no-card' };
    const v = validate(raw);
    if (!v.ok) return v;
    const map = _read();
    map[slot] = v.name;
    _write(map);
    return { ok: true, name: v.name, reason: 'ok' };
  }

  /** Back to the canonical name, and nothing left behind. */
  function clear() {
    const slot = _slot();
    if (!slot) return false;
    const map = _read();
    if (!Object.prototype.hasOwnProperty.call(map, slot)) return false;
    delete map[slot];
    _write(map);
    return true;
  }

  /**
   * A TRAVELLER CANNOT HAVE ONE, so there is nothing of theirs to
   * sweep — set() refuses without a card and the key needs one. This
   * exists so js/travellerReset.js has an answer here rather than an
   * absence, and so a future change that made the store writeable
   * without a card would have somewhere obvious to be wrong.
   */
  function forgetTraveller() { return false; }

  const api = {
    KEY: KEY,
    MAX: MAX,
    MAX_WORDS: MAX_WORDS,
    get: get,
    set: set,
    clear: clear,
    validate: validate,
    forgetTraveller: forgetTraveller,
  };
  try { window.CompanionName = api; } catch (e) {}
  return api;
})();
