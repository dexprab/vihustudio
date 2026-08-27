// js/companionMoments.js — WHEN may a Companion speak?
//
// Sprint 1J. This file answers exactly one question and deliberately
// cannot answer the other one:
//
//   THIS LAYER          decides WHETHER the Companion may speak.
//   THE COMPANION MIND  will decide WHAT it says.        (Step 3)
//   THE PRIVACY GATE    decides what may reach that Mind. (Sprint 1D)
//   THE BOND VALIDATOR  decides what may become memory.   (Sprint 1G)
//
// Those four responsibilities are never reversed. Nothing here composes
// a sentence about a child's story, and nothing here writes a memory.
// Where a fixed line is needed before the Mind exists, it comes from
// js/companionLines.js — twenty authored lines, not a dialogue system.
//
// ---------------------------------------------------------------
// IT DOES NOT WATCH. IT ASKS.
//
// There is no observer here, no timer, no listener, no scanner and no
// tracker. The Companion knows a moment happened because VihuPlanet
// already knows it happened, and every signal below is a read of a
// record some other system is already the authority for:
//
//   js/studioEntry.js       an arrival token, minted by the ONE door
//                           (goStudio) and deliberately not minted by a
//                           Studio reloading itself.
//   js/magicCard.js         getActive() — Decision 11's own definition
//                           of a Creator, and the only one used here.
//   js/companionMemory.js   what this Creator's Companion already
//                           remembers. Sprint 1B derived it from real
//                           records; this file only READS it.
//   js/state.js             AppState.project — which story is open.
//   the document            body.studio-rite-running, and the Studio's
//                           own modal classes.
//
// The same derivation idiom js/studioRite.js's twenty-one gates and
// js/companionMemoryEvents.js's six recorders already use: ask what is
// true, do not subscribe to becoming true. A derivation asked twice
// gives the same answer, so nothing is ever lost by being late and
// nothing has to be listened for.
//
// ---------------------------------------------------------------
// SILENCE IS THE DEFAULT, AND EVERY SILENCE HAS A NAME
//
// decide() returns {speak:false, reason:'...'} far more often than it
// returns true, and the reason is always one of the REASONS below —
// never a bare false. A silence nobody can explain is indistinguishable
// from a bug, and the whole layer is meant to be inspectable.
//
// ---------------------------------------------------------------
// PURE, THEN COMMITTED
//
// decide() is side-effect free: it READS the deduplication ledger and
// never writes it. commit() is the only writer in this file. That split
// is what makes "would the Companion speak?" a question a test — or a
// developer, or a future Mind — can ask as often as it likes without
// changing the answer.
const CompanionMoments = (function () {
  'use strict';

  // The moments this platform can PROVE. Deliberately three. Every
  // other candidate is either already owned by an existing module or
  // not provable from authoritative state — see NOT_MOMENTS below,
  // which is data rather than a comment so a suite can read it.
  const MOMENTS = ['entry', 'return-to-story', 'exit'];

  // Why the Companion was quiet. One of these, always.
  const REASONS = {
    TRAVELLER:      'traveller',            // no Magic Card: no Companion at all
    NO_COMPANION:   'no-companion',         // a card with nobody bonded to it
    UNKNOWN_MOMENT: 'not-a-moment',         // asked about something that is not one
    UNPROVEN:       'unproven',             // the platform cannot show this happened
    ACKNOWLEDGED:   'already-acknowledged', // this exact moment was answered already
    RITE_RUNNING:   'rite-running',         // a chapter owns the screen
    BUSY:           'busy',                 // a dialog owns the screen
    // Retired from this file in Sprint 1K and kept published: the
    // "one lifecycle line per arrival" spacing is real, but it is a
    // question about TIME, so js/companionDirector.js enforces it
    // through js/companionBrain.js's own clock. Nothing here returns
    // it, and the suite checks that nothing does.
    ENTRY_SPOKE:    'entry-already-spoke',
    NO_WINDOW:      'exit-has-no-window'    // provable, but there is no time to say it
  };

  // Why it spoke.
  const OCCASIONS = {
    FIRST_ENTRY:  'first-entry',       // nothing has ever been made
    ENTRY:        'entry',             // a plain arrival
    ENTRY_KNOWN:  'entry-with-history',// an arrival with something remembered
    ENTRY_RETURN: 'entry-returning',   // arriving into a story left a long time ago
    RETURNED:     'return-to-story',   // opening such a story later in the visit
    LEAVING:      'deliberate-exit'    // Back to the Ether was pressed
  };

  // WHICH OPENING LINE, AND WHY IT IS A TABLE.
  //
  // "Do not choose randomly" — so the arrival's own shape picks the
  // line, and the same shape always picks the same one. Four occasions,
  // four indices into js/companionLines.js's OPENING. Not a score: a
  // score would need weights nobody could explain and would make the
  // choice unreviewable. Index 0 is the canonical default and is what
  // a plain first arrival gets.
  //
  // The four chosen read correctly in a Studio as well as in the Ether,
  // which is the constraint that ruled the other six out — "Shhh… look
  // around." is right for arriving inside somebody's story and wrong
  // for arriving at a workshop. No line was rewritten to fit.
  const OPENING_FOR = {
    'first-entry':        0,   // 'Hey… you're here.'
    'entry':              9,   // 'Ready? Let's go.'
    'entry-with-history': 3,   // 'I wonder what we'll find.'
    // DISCLOSED, and measured: 'entry-returning' cannot occur in the
    // Studio today. The Companion mounts before any story is opened, so
    // an arrival never has a story to be a return to. The mapping is
    // kept because it is the right line if a future caller ever decides
    // an entry with a story in hand; nothing depends on it firing.
    'entry-returning':    5,   // 'Something magical is waiting.'
    // The return a child CAN reach. Deliberately the same library and
    // deliberately not a line about time: 'Ooh… this looks
    // interesting.' is a Companion noticing what is in front of it,
    // which is what looking at an old story together is. Nothing says
    // "back", "again", "a while" or how long they were gone — a
    // Companion that recites an absence is reciting surveillance.
    'return-to-story':    4    // 'Ooh… this looks interesting.'
  };

  // WHICH FAREWELL. One occasion today, so one entry.
  //
  // Index 6, 'Thanks for coming along.' — chosen because it is the one
  // farewell that is about the time just spent rather than about a
  // Story having ended, and a child leaving the Studio has not finished
  // anything. Nothing in the library asks to be come back to, which is
  // Decision 31's emotional-dependency rule holding by construction
  // rather than by a check here.
  const FAREWELL_FOR = {
    'deliberate-exit': 6
  };

  // MOMENTS THIS LAYER DELIBERATELY DOES NOT OWN.
  //
  // Data, not prose, so tools/companion-moments-test can assert that
  // none of them grew a rule here by accident. Each names where the
  // responsibility actually lives, or why it cannot exist.
  const NOT_MOMENTS = {
    'object-added':      'ordinary creation — the child is working; js/companionBrain.js may change the FACE and says nothing',
    'page-added':        'ordinary creation — already a pose in js/companionDirector.js, and no line',
    'saved':             'ordinary creation — an autosave is not an event a friend would remark on',
    'page-turned':       'ordinary creation — Story primary',
    'selection-changed': 'ordinary creation — js/companionBrain.js reacts with a pose only',
    'typing':            'ordinary creation — a pose, on a cooldown, in js/companionDirector.js',
    'play':              'already owned — js/companionBrain.js play(); a child poking the Companion is answered every time',
    'invoked':           'already owned — js/companionChat.js; the child asked, so there is nothing to ration',
    'published':         'already owned — js/companionDirector.js notify("published")',
    'companion-born':    'already owned — js/companionDirector.js notify("creator-born"), once ever by construction',
    'long-absence':      'NOT PROVABLE — nothing records a visit, and adding a visit log is the surveillance this layer refuses',
    'idle':              'NOT PROVABLE without watching, and watching is forbidden',
    'seems-stuck':       'NOT PROVABLE, and would be an inference about a child rather than a fact about a record'
  };

  // ---------------------------------------------------------------
  // THE LEDGER
  //
  // Which moments have already been answered. sessionStorage, because a
  // browser session IS one visit to the Studio: a refresh keeps it (so
  // nothing repeats), and closing the tab ends it (so a genuinely new
  // visit starts clean). The same one-visit shape js/studioEntry.js and
  // js/creatorRecognition.js already use.
  //
  // IT IS NOT AN ACTIVITY LOG, and it cannot become one. It holds
  // nothing but keys the code below can already generate, it never
  // leaves the browser, it is not a memory, it is not synced, and it
  // dies with the tab. Compare js/companionMemory.js's own note on why
  // a deterministic key per moment is what stops a store growing into a
  // record of everything somebody did.
  const LEDGER_KEY = 'vihu.companion.moments';

  function _ledger() {
    try {
      const raw = sessionStorage.getItem(LEDGER_KEY);
      const v = raw ? JSON.parse(raw) : null;
      return (v && Array.isArray(v.keys)) ? v.keys : [];
    } catch (e) { return []; }
  }

  function seen(key) {
    if (!key) return false;
    return _ledger().indexOf(key) !== -1;
  }

  // The one writer. Returns whether this call is what recorded it, so a
  // caller can tell "I am answering this moment" from "somebody already
  // did" without a second read.
  function commit(decision) {
    try {
      if (!decision || !decision.key) return { ok: false, recorded: false };
      const keys = _ledger();
      if (keys.indexOf(decision.key) !== -1) return { ok: true, recorded: false };
      keys.push(decision.key);
      sessionStorage.setItem(LEDGER_KEY, JSON.stringify({ keys: keys }));
      return { ok: true, recorded: true };
    } catch (e) { return { ok: false, recorded: false }; }
  }

  function _forget() {
    try { sessionStorage.removeItem(LEDGER_KEY); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // THE SIGNALS
  //
  // Every field is a read of somebody else's record. Nothing is
  // computed about the child, nothing is measured, nothing is timed and
  // nothing is remembered between calls. Read defensively throughout: a
  // missing module is "cannot be proved", never an exception, because
  // the whole layer must fail into silence rather than into noise.

  function _card() {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.getActive) return null;
      return MagicCard.getActive() || null;
    } catch (e) { return null; }
  }

  function _openStoryId() {
    try {
      return (typeof AppState !== 'undefined' && AppState.project && AppState.project.id) || null;
    } catch (e) { return null; }
  }

  function _remembers(key) {
    try {
      if (typeof CompanionMemory === 'undefined' || !CompanionMemory.has) return false;
      return !!CompanionMemory.has(key);
    } catch (e) { return false; }
  }

  function _anyMemory() {
    try {
      if (typeof CompanionMemory === 'undefined' || !CompanionMemory.list) return false;
      return (CompanionMemory.list({ status: 'any' }) || []).length > 0;
    } catch (e) { return false; }
  }

  function _riteRunning() {
    try { return !!document.body.classList.contains('studio-rite-running'); }
    catch (e) { return false; }
  }

  // The Studio's own dialogs. The same convention every overlay in this
  // codebase follows and js/companionDirector.js already reads: a
  // container that gains and loses a plain '.hidden'.
  const BUSY_SELECTORS = [
    '#restoreModal:not(.hidden)',
    '#themePickerModal:not(.hidden)',
    '#magicCardOverlay:not(.hidden)'
  ];

  // Is a Companion actually mounted in this document? One selector, on
  // the class js/companionEngine.js gives its own root. No observer.
  function _widgetMounted() {
    try { return !!document.querySelector('.companion-widget'); }
    catch (e) { return false; }
  }

  function _busy() {
    try {
      for (let i = 0; i < BUSY_SELECTORS.length; i++) {
        if (document.querySelector(BUSY_SELECTORS[i])) return true;
      }
      return false;
    } catch (e) { return false; }
  }

  /**
   * What VihuPlanet can prove right now. A plain object, no state, no
   * writes, cheap enough to call on any tick — every field is a
   * property read or a single indexed lookup.
   * @returns {object}
   */
  function signals() {
    const card = _card();
    const storyId = _openStoryId();
    return {
      // Decision 11: a Creator is somebody holding a claimed Magic Card.
      // This is the only definition used anywhere in this file.
      creator: !!card,
      // A card can exist before a Companion is bonded to it — Rite I
      // mints one at completion and the Ceremony bonds separately — so
      // "has a card" and "has a Companion" are two questions.
      companionId: (card && card.companionId) || null,
      // IS A COMPANION ACTUALLY HERE? Two ways of being true, and
      // deliberately not just the bond: a Creator whose card was minted
      // by finishing Rite I has no bonded Companion until the Ceremony
      // runs, and the Studio still mounts one for them. Reading the
      // mounted widget is reading the Studio's own state, not a claim
      // anybody made — and it is a single indexed selector, not a
      // watcher.
      companionAvailable: !!(card && (card.companionId || _widgetMounted())),
      arrival: (function () {
        try {
          if (typeof StudioEntry === 'undefined' || !StudioEntry.arrival) return null;
          return StudioEntry.arrival();
        } catch (e) { return null; }
      })(),
      storyId: storyId,
      // Sprint 1B's own recorder wrote this from a load-time snapshot of
      // when the story was last touched. Reading it here is what Part 3
      // of the brief asks for: the return is already proved, by records,
      // and this layer does not re-derive it.
      storyIsAReturn: !!(storyId && _remembers('returned:' + storyId)),
      hasEverMade: _remembers('first-story'),
      hasHistory: _anyMemory(),
      riteRunning: _riteRunning(),
      busy: _busy()
    };
  }

  // ---------------------------------------------------------------
  // THE DECISION

  function _no(moment, reason, key) {
    return { speak: false, moment: moment || null, reason: reason, key: key || null, occasion: null };
  }

  function _yes(moment, occasion, key) {
    return { speak: true, moment: moment, reason: occasion, key: key, occasion: occasion };
  }

  /**
   * May the Companion speak about this moment?
   *
   * Deterministic, explainable, bounded and side-effect free. No
   * Math.random, no clock, no probability: the same signals always give
   * the same answer, which is what makes the whole layer reviewable.
   *
   * @param {string} moment one of MOMENTS
   * @param {object} [ctx] a signals() snapshot; taken fresh if omitted
   * @returns {{speak:boolean, moment:string|null, reason:string,
   *            key:string|null, occasion:string|null}}
   */
  function decide(moment, ctx) {
    try {
      const s = ctx || signals();

      // GATE 1 — TRAVELLER. At the top, before anything else is even
      // looked at, exactly as js/companionBrain.js does it. A Traveller
      // has no Companion (Canon 8), so there is no speech, no opening,
      // no exit and nothing to filter later.
      if (!s.creator) return _no(moment, REASONS.TRAVELLER);

      // GATE 2 — is a Companion available at all? A Creator with no
      // Companion bonded and none mounted has nobody to speak.
      if (!s.companionAvailable) return _no(moment, REASONS.NO_COMPANION);

      if (MOMENTS.indexOf(moment) === -1) return _no(moment, REASONS.UNKNOWN_MOMENT);

      // GATE 3 — a chapter owns the screen. Decision 22 is explicit
      // that offering anything during a rite is the interruption a rite
      // must never contain.
      if (s.riteRunning) return _no(moment, REASONS.RITE_RUNNING);

      if (moment === 'entry')           return _entry(s);
      if (moment === 'return-to-story') return _return(s);
      if (moment === 'exit')            return _exit(s);
      return _no(moment, REASONS.UNKNOWN_MOMENT);
    } catch (e) {
      // A layer whose job is restraint fails into restraint.
      return _no(moment || null, REASONS.UNPROVEN);
    }
  }

  // ENTRY — a real arrival, and only a real arrival.
  //
  // The arrival token is the whole proof. It is minted by goStudio()
  // and by nothing else, and a Studio reloading ITSELF keeps the token
  // it already had — so the Home button, Publish's clean slate and the
  // build stamp's refetch all come back to a key already in the ledger
  // and are silent. A refresh never gets here at all: with no pass, the
  // gate at the top of studio.html sends it to VihuPlanet.
  function _entry(s) {
    if (!s.arrival) return _no('entry', REASONS.UNPROVEN);
    const key = 'entry:' + s.arrival;
    if (seen(key)) return _no('entry', REASONS.ACKNOWLEDGED, key);
    // A dialog on top of the workspace at the moment of arrival — a
    // restore prompt, a ceremony — means the child is answering
    // something. The greeting is dropped rather than queued: a hello
    // that arrives after a conversation with a dialog is not a hello.
    if (s.busy) return _no('entry', REASONS.BUSY, key);
    return _yes('entry', _occasionFor(s), key);
  }

  // WHICH KIND OF ARRIVAL THIS IS. Most specific first.
  function _occasionFor(s) {
    if (s.storyIsAReturn) return OCCASIONS.ENTRY_RETURN;
    if (!s.hasEverMade)   return OCCASIONS.FIRST_ENTRY;
    if (s.hasHistory)     return OCCASIONS.ENTRY_KNOWN;
    return OCCASIONS.ENTRY;
  }

  // RETURN TO A STORY — opening something left alone for a long time.
  //
  // SPRINT 1K CORRECTED THIS MOMENT, AND THE BUG WAS THIS FILE'S OWN.
  //
  // Sprint 1J refused a return whenever the entry had already spoken for
  // the same arrival, to stop two lifecycle lines landing in one breath.
  // The intent was right; the rule made the moment UNREACHABLE, and it
  // was measured in the running Studio rather than reasoned about.
  //
  // The Companion mounts inside _beginBoot(), BEFORE any story is
  // opened — so at the instant the entry is decided, storyId is null.
  // The story opens seconds later, by which time 'entry:<arrival>' is in
  // the ledger for the rest of the visit. Every return, forever, came
  // back 'entry-already-spoke'. Two occasions were dead for the same
  // reason: 'entry-returning' cannot fire either, because an arrival
  // never has a story to be a return TO.
  //
  // "ONE BREATH" IS A QUESTION ABOUT TIME, AND THIS FILE HAS NO CLOCK —
  // deliberately, and its own suite fails on one. So the spacing moved
  // to where the clock already lives: js/companionDirector.js asks
  // js/companionBrain.js's mayVolunteer(), the same settle-and-cooldown
  // every other volunteered line obeys. This layer answers only whether
  // the moment is real, which is the thing it can actually know.
  //
  // The moment stays pending until it is allowed, because nothing here
  // commits it — so a story opened at boot is remarked on once the
  // greeting has had its space, and a story opened from My Projects
  // later in the visit is remarked on when it is opened.
  function _return(s) {
    if (!s.storyId) return _no('return-to-story', REASONS.UNPROVEN);
    if (!s.storyIsAReturn) return _no('return-to-story', REASONS.UNPROVEN);
    const key = 'returned:' + s.storyId;
    if (seen(key)) return _no('return-to-story', REASONS.ACKNOWLEDGED, key);
    if (s.busy) return _no('return-to-story', REASONS.BUSY, key);
    return _yes('return-to-story', OCCASIONS.RETURNED, key);
  }

  // EXIT — pressing Back to the Ether, and nothing else.
  //
  // THE MOMENT IS PROVABLE AND THE WINDOW IS NOT, and those are
  // different problems. A deliberate press is as authoritative a signal
  // as this product has: Decision 23 makes it the one way out of the
  // Studio. What it does not come with is time — the handler navigates
  // as soon as the pending save settles, and holding a child in the
  // Studio so a Companion can finish a sentence is forbidden by that
  // same decision's "never let a hung save trap a child".
  //
  // So this returns a decision either way and the caller is told which:
  // the moment is recognised, deduplicated and explainable, and whether
  // a line is actually shown is governed by WINDOW below. It ships
  // false — measured, the bubble's life is whatever the autosave takes,
  // which on a small story is a few milliseconds, and a goodbye nobody
  // can read is worse than a goodbye nobody was given. Flipping it is a
  // one-line change the day the exit gains a real pause of its own.
  function _exit(s) {
    const key = 'exit:' + (s.arrival || 'unknown');
    if (seen(key)) return _no('exit', REASONS.ACKNOWLEDGED, key);
    if (!WINDOW.exit) return _no('exit', REASONS.NO_WINDOW, key);
    return _yes('exit', OCCASIONS.LEAVING, key);
  }

  // Whether a moment has enough time on screen for a line to be read.
  // One object, so the disclosure above is a value a suite can read
  // rather than a claim in a comment.
  const WINDOW = { entry: true, 'return-to-story': true, exit: false };

  /**
   * The opening line for a decision, from js/companionLines.js. Never
   * random: the occasion picks the index through OPENING_FOR.
   * @returns {{text:string, emotion:string}|null}
   */
  function openingFor(decision) {
    try {
      const lib = (typeof CompanionLines !== 'undefined') ? CompanionLines.OPENING : null;
      if (!lib || !lib.length) return null;
      const occ = decision && decision.occasion;
      const i = Object.prototype.hasOwnProperty.call(OPENING_FOR, occ) ? OPENING_FOR[occ] : 0;
      return lib[i] || lib[0] || null;
    } catch (e) { return null; }
  }

  /** The farewell line for a decision. Same rule, same library. */
  function farewellFor(decision) {
    try {
      const lib = (typeof CompanionLines !== 'undefined') ? CompanionLines.FAREWELL : null;
      if (!lib || !lib.length) return null;
      const occ = decision && decision.occasion;
      const i = Object.prototype.hasOwnProperty.call(FAREWELL_FOR, occ) ? FAREWELL_FOR[occ] : 0;
      return lib[i] || lib[0] || null;
    } catch (e) { return null; }
  }

  /**
   * DEVELOPER DIAGNOSTICS, and nothing a child ever sees.
   *
   * Every reason string in this file is policy vocabulary — 'unproven',
   * 'already-acknowledged', 'traveller' — and none of it appears in any
   * bubble, panel or screen. This returns the layer's own view of
   * itself for a console or a suite; it is not persisted, not synced,
   * not a memory, and it contains no story text, no card, no name and
   * no identifier beyond a project id the caller already had.
   */
  function diagnostics() {
    const s = signals();
    return {
      signals: s,
      decisions: MOMENTS.map(function (m) { return decide(m, s); }),
      ledger: _ledger(),
      window: WINDOW
    };
  }

  const api = {
    signals: signals,
    decide: decide,
    commit: commit,
    seen: seen,
    openingFor: openingFor,
    farewellFor: farewellFor,
    diagnostics: diagnostics,
    MOMENTS: MOMENTS,
    REASONS: REASONS,
    OCCASIONS: OCCASIONS,
    OPENING_FOR: OPENING_FOR,
    FAREWELL_FOR: FAREWELL_FOR,
    NOT_MOMENTS: NOT_MOMENTS,
    WINDOW: WINDOW,
    LEDGER_KEY: LEDGER_KEY,
    _forget: _forget
  };
  try { window.CompanionMoments = api; } catch (e) {}
  return api;
})();
