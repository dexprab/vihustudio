// js/companionMemoryEvents.js — which moments are worth remembering.
//
// Sprint 1B. The other half of js/companionMemory.js: that file stores
// and retrieves, this one decides what is true enough to store.
//
// ---------------------------------------------------------------
// IT DERIVES. IT DOES NOT LISTEN.
//
// The obvious shape would be a listener per moment — hook `published`,
// hook the library's save, hook a page turn. It was not built that way,
// for three reasons:
//
//   1. This sprint may not change js/companionDirector.js, and that is
//      where notify() lives. Hooking it would mean editing it.
//   2. A listener fires once and can be missed — a tab closed mid-write,
//      a listener bound after the event. A derivation asked twice gives
//      the same answer, so nothing is ever lost by being late.
//   3. It is this codebase's own idiom. js/studioRite.js's 21 gates are
//      not events; `_conditionMet(kind, baseline)` compares live state
//      against a baseline on a tick that was already happening.
//
// So `sync()` reads what the Studio already knows and asks the store to
// remember anything provable. Running it a hundred times a session is
// harmless: every memory carries a deterministic key, and one key is one
// memory (see companionMemory.js's own note on why that is what stops
// this becoming an activity log).
//
// ---------------------------------------------------------------
// WHAT MAY BE REMEMBERED, AND WHAT MAY NOT
//
// Sprint 1B is deterministic. Every memory below is a FACT the
// application can prove from its own records:
//
//   · this card owns at least one story        → they made a first story
//   · this card owns at least one character    → they made a first one
//   · one of their stories carries publishedAt → they shared one
//   · a story they own has cheers > 0          → somebody was kind to it
//   · the open story was last touched long ago → they came back to it
//   · the card carries a bonded companion      → the two of them met
//
// NOTHING IS INFERRED. "Creator created a dragon" does not become
// "Creator likes dragons"; no preference, no emotion, no personality and
// no relationship meaning is derived from any of this. That reading is
// what a model is for, in a later sprint, under Decision 30's gate — and
// what it proposes will still have to be validated against these same
// records before anything is stored.
//
// The CREATOR memory type therefore has NO producer in this sprint, and
// that is the correct outcome rather than a gap: everything that would
// fill it ("they prefer...", "they always...") is an inference.
const CompanionMemoryEvents = (function () {
  'use strict';

  // How long a story must have been left alone for opening it again to
  // count as coming back to it rather than carrying on with it. In one
  // place, like every other tunable in this layer.
  const RETURN_AFTER_MS = 14 * 86400000;

  // WHAT THE STORIES LOOKED LIKE WHEN THIS PAGE LOADED.
  //
  // Taken once, at load, and never updated. `returned-to-story` needs to
  // know when a story was last touched BEFORE this session touched it,
  // and an autosave a few seconds in would erase exactly that. Reading it
  // at load is the one moment nothing can have changed it yet.
  //
  // If this module loads late and a save has already happened, the
  // memory is simply not made. That is the right way round: a missed
  // memory is a small loss, an invented one is a Companion claiming
  // something that did not happen.
  const _atLoad = {};
  let _snapped = false;

  function _snapshot() {
    if (_snapped) return;
    _snapped = true;
    try {
      if (typeof CreatorProjectStore === 'undefined' || !CreatorProjectStore.list) return;
      CreatorProjectStore.list().forEach(function (r) {
        if (r && r.id) _atLoad[r.id] = r.updatedAt || r.createdAt || null;
      });
    } catch (e) {}
  }

  function _name(s, fallback) {
    const t = String(s || '').trim();
    return t || fallback;
  }

  // Oldest first, so "the first one" means the first one.
  function _byOldest(list, field) {
    return list.slice().sort(function (a, b) {
      return String(a[field] || '').localeCompare(String(b[field] || ''));
    });
  }

  function _projects() {
    try {
      if (typeof CreatorProjectStore === 'undefined' || !CreatorProjectStore.list) return [];
      return CreatorProjectStore.list() || [];
    } catch (e) { return []; }
  }

  function _characters() {
    try {
      if (typeof CreatorLibrary === 'undefined' || !CreatorLibrary.list) return [];
      return CreatorLibrary.list() || [];
    } catch (e) { return []; }
  }

  function _card() {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.getActive) return null;
      return MagicCard.getActive();
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------
  // THE RECORDERS
  //
  // Each answers "is this provably true right now?" and, if so, names
  // the moment. Each returns the key it used, or null.

  // SELF — the two of them met. The bond is set once at claim and never
  // re-rolled (Canon 3), so this is a fact about the Companion's own
  // existence rather than an observation about the child.
  function _bonded(mem) {
    const card = _card();
    if (!card || !card.companionId) return null;
    const who = _name(card.companionName, card.companionId);
    const r = mem.remember({
      key: 'bonded',
      kind: 'self',
      content: who + ' and their Creator were bonded, and that only happens once.',
      importance: 'high',
      confidence: 'confirmed',
      source: 'state:magic-card',
      entities: ['companion:' + card.companionId],
      protected: true,
    });
    return r.created ? 'bonded' : null;
  }

  // SHARED — the first story. The single most important memory this
  // product can hold, and the reason `protected` exists.
  function _firstStory(mem) {
    const all = _byOldest(_projects(), 'createdAt');
    if (!all.length) return null;
    const first = all[0];
    const r = mem.remember({
      key: 'first-story',
      kind: 'shared',
      content: 'We made your first story together — ' + _name(first.name, 'it') + '.',
      importance: 'high',
      confidence: 'confirmed',
      source: 'state:creator-projects',
      entities: ['project:' + first.id],
      protected: true,
    });
    return r.created ? 'first-story' : null;
  }

  // SHARED — the first character. `name` is the child's own word for
  // somebody they invented, which is why this memory can be about Spark
  // without anything here knowing what a Spark is.
  function _firstCharacter(mem) {
    const all = _byOldest(_characters(), 'createdAt');
    if (!all.length) return null;
    const first = all[0];
    const r = mem.remember({
      key: 'first-character',
      kind: 'shared',
      content: 'We brought ' + _name(first.name, 'somebody') + ' to life together.',
      importance: 'high',
      confidence: 'confirmed',
      source: 'state:creator-library',
      entities: ['library:' + first.id],
      protected: true,
    });
    return r.created ? 'first-character' : null;
  }

  // SHARED — the first share. `publishedAt` is the Ether's own
  // definition of membership (Decision 9), stamped by the ceremony and
  // nowhere else (Decision 12), so this is as authoritative as a fact
  // gets in this product.
  function _firstShare(mem) {
    const shared = _byOldest(_projects().filter(function (r) { return r && r.publishedAt; }), 'publishedAt');
    if (!shared.length) return null;
    const first = shared[0];
    const r = mem.remember({
      key: 'first-share',
      kind: 'shared',
      content: 'You shared ' + _name(first.name, 'your story') + ' with VihuPlanet, and I watched it go.',
      importance: 'high',
      confidence: 'confirmed',
      source: 'state:published-at',
      entities: ['project:' + first.id],
      protected: true,
    });
    return r.created ? 'first-share' : null;
  }

  // WORLD — somebody was kind to one of their stories.
  //
  // The only genuinely EXTERNAL thing this product records: a cheer comes
  // from another person's browser, is counted server-side in
  // story_cheers, and is not something the child did. That makes it the
  // one honest source for "what happened while I was away" — and
  // Decision 30's rule holds either way: if the system has no record,
  // the Companion may not claim it.
  //
  // ONE PER STORY, not one per cheer. The key names the story, so a
  // story cheered forty times is one memory. Counting would be a score,
  // and Decision 20 is explicit that no number is ever shown.
  function _cheered(mem) {
    if (typeof Cheer === 'undefined' || !Cheer.count) return null;
    const made = [];
    _projects().forEach(function (p) {
      if (!p || !p.id || !p.publishedAt) return;
      let n = 0;
      try { n = Cheer.count(p.id) | 0; } catch (e) { n = 0; }
      if (n <= 0) return;
      const key = 'cheered:' + p.id;
      const r = mem.remember({
        key: key,
        kind: 'world',
        content: 'Someone out in VihuPlanet gave ' + _name(p.name, 'your story') + ' a little starlight.',
        importance: 'medium',
        confidence: 'confirmed',
        source: 'state:story-cheers',
        entities: ['project:' + p.id],
      });
      if (r.created) made.push(key);
    });
    return made.length ? made : null;
  }

  // SHARED — they came back to something they had left.
  //
  // Deterministic, and it is the load-time snapshot that makes it so:
  // the story open right now was last touched before this session began,
  // and that was long enough ago to be a return rather than a
  // continuation. Once per story ever.
  function _returned(mem) {
    _snapshot();
    let openId = null;
    try {
      openId = (typeof AppState !== 'undefined' && AppState.project && AppState.project.id) || null;
    } catch (e) { openId = null; }
    if (!openId) return null;

    const was = _atLoad[openId];
    if (!was) return null;                      // not seen at load — say nothing
    let age = 0;
    try { age = Date.now() - new Date(was).getTime(); } catch (e) { return null; }
    if (!isFinite(age) || age < RETURN_AFTER_MS) return null;

    const rec = _projects().find(function (p) { return p && p.id === openId; });
    const key = 'returned:' + openId;
    const r = mem.remember({
      key: key,
      kind: 'shared',
      content: 'We went back to ' + _name(rec && rec.name, 'a story we made a while ago') + ' after a long time away.',
      importance: 'medium',
      confidence: 'confirmed',
      source: 'state:project-updated-at',
      entities: ['project:' + openId],
    });
    return r.created ? key : null;
  }

  const RECORDERS = [_bonded, _firstStory, _firstCharacter, _firstShare, _cheered, _returned];

  /**
   * Ask every recorder whether anything provable has happened, and
   * remember what has. Idempotent: safe to call as often as you like,
   * because a key that already exists is not written twice.
   *
   * Nothing calls this on a timer, and nothing calls it on every click.
   * @returns {{created:string[]}} the keys made THIS call, for tests.
   */
  function sync() {
    const created = [];
    try {
      if (typeof CompanionMemory === 'undefined') return { created: created };
      // A Traveller has no card, so the store refuses every write
      // anyway; returning early means not even asking, which keeps a
      // Traveller's session genuinely untouched.
      if (!_card()) return { created: created };
      RECORDERS.forEach(function (fn) {
        try {
          const made = fn(CompanionMemory);
          if (!made) return;
          if (Array.isArray(made)) created.push.apply(created, made);
          else created.push(made);
        } catch (e) {}
      });
    } catch (e) {}
    return { created: created };
  }

  // ---------------------------------------------------------------
  // WHEN IT RUNS
  //
  // js/pageRuntime.js's observer list — the same seam
  // js/companionDirector.js and js/studioRite.js already watch the
  // child's own actions through. NO POLLING IS INTRODUCED: notify()
  // already fires exactly once per meaningful mutation, and this is one
  // more subscriber on a dispatch that was happening anyway.
  //
  // It wires ITSELF rather than being wired from js/app.js, for the same
  // reason js/gardenRenderer.js calls LivingGarden.claim() itself: a
  // module somebody else has to remember to start is a module that
  // eventually is not started. It also means this sprint changes no
  // existing Studio file to make memory happen.
  //
  // Nothing READS the store yet. Decision 30 and this sprint both say
  // memory must exist before anything consumes it, so the Companion's
  // behaviour is exactly what it was — it simply now has a past.
  let _wired = false;
  function _wire() {
    if (_wired) return;
    _wired = true;
    try {
      // The stores hydrate from IndexedDB, so the first ask waits for
      // them. Asking early would see an empty library and quietly
      // decide there was no first character — the memory would still
      // arrive on the next tick, but silence is cheaper than a wrong
      // answer either way.
      const ready = [];
      try { if (typeof CreatorProjectCache !== 'undefined' && CreatorProjectCache.hydrate) ready.push(CreatorProjectCache.hydrate()); } catch (e) {}
      try { if (typeof CreatorLibrary !== 'undefined' && CreatorLibrary.whenReady) ready.push(CreatorLibrary.whenReady()); } catch (e) {}
      Promise.all(ready.map(function (p) { return Promise.resolve(p).catch(function () {}); }))
        .then(function () { sync(); })
        .catch(function () {});
    } catch (e) {}
    try {
      if (typeof PageRuntime !== 'undefined' && PageRuntime.observe) {
        PageRuntime.observe(function () { sync(); });
      }
    } catch (e) {}
  }

  const api = { sync: sync, RETURN_AFTER_MS: RETURN_AFTER_MS, _snapshot: _snapshot, _wire: _wire };
  try { window.CompanionMemoryEvents = api; } catch (e) {}

  // The load-time snapshot has to happen at load, or it is not a
  // load-time snapshot. Everything else waits to be asked.
  try { _snapshot(); } catch (e) {}
  try { _wire(); } catch (e) {}

  return api;
})();
