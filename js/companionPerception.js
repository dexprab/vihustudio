// js/companionPerception.js — what a Companion is ALLOWED TO KNOW, here.
//
// Sprint 1N.3. One authoritative contract, and it answers exactly one
// question:
//
//     WHAT MAY THIS COMPANION KNOW, ON THIS SURFACE?
//
// It is deliberately NOT the privacy gate. js/companionPrivacyGate.js
// answers a different question — what may TRAVEL — and duplicating its
// rules here would give this product two places to be wrong about the
// same thing. Perception decides what is assembled; the gate decides
// what leaves. Both run.
//
// ---------------------------------------------------------------
// TWO KINDS OF CREATOR KNOWLEDGE, AND THE LINE BETWEEN THEM
//
//   Told privately in Studio  ──▶  the Creator + Companion relationship
//                                  and NOWHERE else
//   On the Magic Card          ──▶  public, and a Traveller may hear it
//                                  ── EXCEPT THE STARS
//
// A child saying "my name is Vihaan" to their own Companion has told
// their Companion something. It is not a publication. It does not
// become a memory, it does not become a Bond Moment, and it does not
// travel to the Ether. What DOES reach the Ether is what the Magic Card
// already shows the world — the portal prints the maker's name in its
// own title bar, so a resident of that world being able to say it is
// not a disclosure.
//
// ---------------------------------------------------------------
// THE STARS ARE THE ABSOLUTE EXCEPTION
//
// A Creator's constellation is their identity — it is what recognises
// them on a strange device (Decision 11) and it is the credential
// (Decision 18). It is never public, on any surface, at any time, in
// any form: not the pattern, not the constellation's name, not the
// COUNT of stars in it. There is no field for one here, and a sweep
// refuses one that arrives by any route, because a wall with one guard
// is a wall with one mistake in it.
//
// ---------------------------------------------------------------
// WHITELISTS, NOT COPIES
//
// Nothing is spread in from a record. Every field below is written out
// by hand and read from a named source, so a field added to a card, a
// project or a feed record tomorrow cannot arrive here by being
// adjacent to one that is already allowed.
const CompanionPerception = (function () {
  'use strict';

  const VERSION = '1N.3';

  // The three places a Companion can be talked to. A perception is
  // always FOR one of them, and "where are we?" is answered from it
  // rather than from one universal sentence.
  const SURFACES = ['studio-home', 'story-editor', 'ether'];

  // Never, on any surface, whatever route it took. The star fields are
  // first and they are the reason this list exists.
  const FORBIDDEN = ['pattern', 'constellation', 'stars', 'star', 'starcount',
                     'sky', 'signature', 'email', 'parentemail', 'password',
                     'token', 'accesstoken', 'session', 'auth', 'apikey',
                     'ownerid', 'cardid', 'userid', 'projectid', 'memoryid',
                     'memories', 'conversation', 'notes'];

  function _key(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function _str(v, max) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > (max || 80) ? t.slice(0, max || 80) : t;
  }
  function _num(v) {
    return (typeof v === 'number' && isFinite(v) && v >= 0) ? (v | 0) : null;
  }

  /**
   * THE SWEEP. Refuses a perception that carries anything on the list
   * above, at any depth. It should never fire — the builders below
   * cannot produce one — which is exactly why it is worth having: if it
   * ever does, something upstream started copying records in.
   */
  function audit(p) {
    const bad = [];
    (function walk(v, path) {
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach(function (x, i) { walk(x, path + '[' + i + ']'); }); return; }
      Object.keys(v).forEach(function (k) {
        if (FORBIDDEN.indexOf(_key(k)) !== -1) bad.push(path + '.' + k);
        walk(v[k], path + '.' + k);
      });
    })(p, '');
    return { clean: bad.length === 0, violations: bad };
  }

  // ---------------------------------------------------------------
  // THE STUDIO
  //
  // A Creator talking to their OWN Companion. Everything here is either
  // the card this browser holds, the story that is open, or something
  // the child themselves said out loud to their Companion.

  function _card() {
    try {
      return (typeof MagicCard !== 'undefined' && MagicCard.getActive)
        ? MagicCard.getActive() : null;
    } catch (e) { return null; }
  }

  function _story() {
    try {
      if (typeof AppState === 'undefined' || !AppState) return null;
      // THE STUDIO'S OWN SHAPE, and it is not the one a project RECORD
      // has. `AppState.project` is the metadata — title, author, theme —
      // while the pages live in `AppState.slides` and the open one is
      // `AppState.currentSlide`. Reading `project.pages` gave nulls for
      // everything, which is the kind of wrong that looks like "no story
      // is open" rather than like a bug.
      const meta = AppState.project || {};
      const pages = Array.isArray(AppState.slides) ? AppState.slides : [];
      if (!pages.length && !meta.id) return null;
      const idx = (typeof AppState.currentSlide === 'number' && AppState.currentSlide >= 0)
        ? AppState.currentSlide : null;
      const page = (idx !== null && pages[idx]) ? pages[idx] : null;
      return {
        name: _str(meta.bookTitle || meta.title, 120),
        pageCount: pages.length || null,
        pageIndex: idx,
        // THE EXISTENCE OF A PICTURE, never a word about what is in it.
        hasImage: page ? !!(page.image || page.imageId || page.picture ||
                            (page.metadata && page.metadata.image)) : null
      };
    } catch (e) { return null; }
  }

  /**
   * Which Studio screen is up. Studio Home is a full-screen overlay over
   * the workspace, so the body class is the authority rather than
   * whether a project happens to exist.
   */
  function surfaceNow() {
    try {
      if (document.body.classList.contains('creation-flow-active')) return 'studio-home';
      return 'story-editor';
    } catch (e) { return 'studio-home'; }
  }

  /**
   * The Creator's own Companion, on the Studio surface it is standing
   * on. Null with no card — a Traveller has no Companion of their own
   * (Canon 8) and there is nothing to build.
   */
  function studio(opts) {
    const card = _card();
    if (!card || !card.id) return null;
    const surface = (opts && opts.surface) || surfaceNow();
    let called = null, facts = null;
    try {
      if (typeof CompanionName !== 'undefined' && CompanionName.get) called = CompanionName.get();
    } catch (e) {}
    try {
      if (typeof CompanionFacts !== 'undefined' && CompanionFacts.all) facts = CompanionFacts.all();
    } catch (e) {}
    const told = facts || {};
    const p = {
      mode: 'creator',
      surface: SURFACES.indexOf(surface) !== -1 ? surface : 'studio-home',
      companion: {
        // The canonical identity, always. What a child CALLS it is a
        // separate field, and both are said when asked (Decision 47).
        name: _str(card.companionName, 40),
        species: _str(card.companionSpecies, 40),
        id: _str(card.companionId, 40),
        called: _str(called, 40)
      },
      creator: {
        // WHAT THE CHILD TOLD THEIR OWN COMPANION, and nothing read off
        // a record. The card's own nickname is deliberately NOT used
        // here: it is the name on a card, and this field is the answer
        // to "what's my name?", which is a question about what the two
        // of them have said to each other.
        name: _str(told.name, 40),
        // NO PID EXISTS IN THIS PRODUCT YET. The field is here so the
        // rule has somewhere to live and so the checks can prove both
        // branches; it is null because nothing publishes one, and an
        // invented one would be exactly what Sprint 1N.3 forbids.
        pid: _str(told.pid, 40)
      },
      story: (surface === 'story-editor') ? _story() : null,
      relationship: { told: Object.keys(told).sort() }
    };
    // A STORY-EDITOR PERCEPTION WITH NO STORY IS STILL HONEST. It says
    // there is none rather than pretending to a name.
    return p;
  }

  // ---------------------------------------------------------------
  // THE ETHER
  //
  // A Traveller meeting somebody else's Companion. The whitelist is
  // js/travellerContext.js's and is not re-implemented here: this adds
  // the two PUBLIC Magic Card facts Sprint 1N.3 introduces and nothing
  // else, then hands the whole thing back through that file's own
  // approval so a single wall stays a single wall.

  /**
   * @param {object} story the record js/etherFeed.js produced for the
   *   open portal — gated on `is_shared`, so an unshared draft is
   *   unreachable by construction (Decision 15).
   * @param {object} host  who is standing there.
   * @param {object} [opts] `{ othersHere: n }` — how many OTHER stories
   *   by this maker are in the Ether right now. A real count of a
   *   public set, never a database total.
   */
  function ether(story, host, opts) {
    let base = null;
    try {
      if (typeof TravellerContext === 'undefined' || !TravellerContext.build) return null;
      base = TravellerContext.build(story, host);
    } catch (e) { return null; }
    if (!base) return null;
    const p = {
      mode: 'traveller',
      surface: 'ether',
      companion: {
        name: base.companionName || null,
        species: base.companionSpecies || null,
        id: base.companionId || null,
        // A PERSONAL NAME NEVER TRAVELS. What one child calls their own
        // Companion is between the two of them; a stranger meets the
        // canonical identity. There is no field to put it in.
        called: null
      },
      creator: {
        // PUBLIC, AND ALREADY ON SCREEN. The portal's own title bar
        // prints the maker's name, so a resident of that world being
        // able to say it discloses nothing. It is the record's own
        // `creatorName`, which travels WITH the story (Decision 15) —
        // never the card of whoever is doing the looking.
        name: _str(story && story.creator, 40),
        pid: null
      },
      story: {
        name: base.storyTitle || null,
        pageCount: (typeof base.pageCount === 'number') ? base.pageCount : null,
        pageIndex: null,
        hasVoice: !!base.hasVoice,
        isCanon: !!base.isCanon
      },
      // AUTHORITATIVE OR ABSENT. This is a count of a set that is
      // public by construction — the maker's OTHER stories that are in
      // the Ether right now — and the sentence built from it says so.
      // A database total would count private drafts, and a guess would
      // be an invented number; both are refused by there being nothing
      // to read them from.
      publicStories: { othersHere: _num(opts && opts.othersHere) },
      relationship: { told: [] }
    };
    return p;
  }

  const api = {
    VERSION: VERSION,
    SURFACES: SURFACES,
    FORBIDDEN: FORBIDDEN,
    studio: studio,
    ether: ether,
    surfaceNow: surfaceNow,
    audit: audit
  };
  try { window.CompanionPerception = api; } catch (e) {}
  return api;
})();
