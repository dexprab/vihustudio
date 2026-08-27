// js/companionMemory.js — what a Companion remembers.
//
// Sprint 1B. CLAUDE.md → Decision 30: "A Companion may remember
// meaningful experiences, conversations and creations shared with its
// Creator, across sessions and across devices... Memory is of meaningful
// moments, never a log of everything the Creator does."
//
// THERE IS NO INTELLIGENCE IN THIS FILE. It has no model, no network to
// a provider, no interpretation and no opinion. It stores what somebody
// else has already PROVED, retrieves it deterministically, and nothing
// more. Which moments are worth remembering is
// js/companionMemoryEvents.js's question; whether a Companion ever says
// any of it is a later sprint's, and today the answer is no — nothing
// reads this store yet, deliberately.
//
// ---------------------------------------------------------------
// WHAT MAKES THIS MEMORY RATHER THAN SURVEILLANCE
//
// Two things, and they are structural rather than promises:
//
//   1. NOTHING WRITES HERE ON ITS OWN. There is no observer, no timer
//      and no hook into anything a child does. A memory exists only
//      because a recorder asked for it by name, and the recorders are a
//      short, closed, readable list.
//   2. EVERY MEMORY CARRIES A `key`, AND THE KEY IS UNIQUE. A key is a
//      deterministic name for a moment ('first-story',
//      'returned:proj_x'), so asking twice is not two memories — it is
//      the same one. A store where repeating an action cannot grow the
//      record is a store that cannot become an activity log by accident.
//
// The second is the same discipline Decision 20 states for Cheer: "The
// database's primary key IS the rule — one row per (story, cheerer)...
// There is no counter to drift out of step with the rows, because the
// count is the rows." Here the rule is one row per (card, key).
//
// ---------------------------------------------------------------
// SCOPED TO THE MAGIC CARD, LIKE EVERYTHING A CHILD OWNS
//
// Decision 19: a Story belongs to the Creator who made it, and the store
// is per-DEVICE unless something scopes it. So a memory carries the
// `cardId` that was active when it was made, `list()` returns what the
// ACTIVE card owns, and a second child on the same machine sees none of
// the first child's.
//
// And Decision 19's other half: A TRAVELLER IS STATELESS. A Traveller
// holds no card, so nothing is written for them at all — not held and
// later swept, simply never made. `forgetTraveller()` exists anyway, for
// the same reason LivingGarden's does: a record from before a card
// existed must not outlive the session that made it.
//
// ---------------------------------------------------------------
// LOCAL FIRST, CLOUD AFTER — the house rule
//
// localStorage is the source of truth for this device and answers
// instantly; the platform is told afterwards and is what carries a
// memory to a grandmother's laptop. With no Supabase configured at all
// this file works exactly as it does with one, which is the same posture
// js/cheer.js and js/creatorLibrary.js already hold.
//
// The records are tiny — a sentence and a little metadata — so this is
// localStorage rather than IndexedDB. A thousand memories is well under
// a hundred kilobytes, and a thousand is far more than the ceiling
// below allows.
const CompanionMemory = (function () {
  'use strict';

  const STORE_PREFIX = 'vihu-companion-memory:';
  const TRAVELLER_KEY = STORE_PREFIX + 'traveller';
  const TABLE = 'creator_companion_memory';

  // ---------------------------------------------------------------
  // THE ONE PLACE THE LIMITS LIVE
  //
  // Same discipline js/gardenEngine.js's LIFECYCLE object holds ("Do not
  // scatter timing constants"), and for the same reason: these will be
  // tuned, and tuning them must be one edit a person can read in full.
  //
  // Deliberately NOT a memory-aging algorithm. Decision 30 and this
  // sprint both say the same thing — creation, retrieval, deduplication,
  // persistence, a basic lifecycle state. Consolidation belongs to a
  // later sprint that has something to consolidate.
  const LIMITS = {
    // Above this, the OLDEST unprotected active memory goes dormant when
    // a new one arrives. Not deleted: Decision 19's rule for a child's
    // work is "a filter and never a delete", and it holds here too.
    activeMax: 120,
    // A hard stop on the record as a whole. Only reachable if something
    // has gone wrong, since a memory is only ever made by a named
    // recorder for a named moment.
    hardMax: 400,
    // How many a retrieval hands back by default. A Companion referring
    // to eight things at once is reciting, not remembering.
    retrieveDefault: 6,
  };

  const KINDS = ['self', 'creator', 'shared', 'world'];
  const IMPORTANCE = { low: 0, medium: 1, high: 2 };
  const STATUSES = ['active', 'dormant', 'archived'];

  let _cache = null;

  function _now() { try { return new Date().toISOString(); } catch (e) { return ''; } }

  function _cardId() {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.getActive) return null;
      const c = MagicCard.getActive();
      return (c && c.id) || null;
    } catch (e) { return null; }
  }

  // The Companion this Creator is bonded to (Canon 3, one and permanent).
  // Stored ON the memory rather than looked up at read time, because a
  // memory is a record of what happened and the bond is part of what
  // happened. Null is a real state — a Traveller mid-Rite has no card and
  // therefore no companion — and nothing here invents one.
  function _companionId() {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.getActive) return null;
      const c = MagicCard.getActive();
      return (c && c.companionId) || null;
    } catch (e) { return null; }
  }

  function _storeKey() {
    const id = _cardId();
    return id ? (STORE_PREFIX + id) : TRAVELLER_KEY;
  }

  function _read() {
    if (_cache) return _cache;
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(_storeKey()) || 'null'); } catch (e) { rec = null; }
    if (!rec || !Array.isArray(rec.items)) rec = { v: 1, items: [] };
    _cache = rec;
    return rec;
  }

  function _write() {
    try { localStorage.setItem(_storeKey(), JSON.stringify(_read())); } catch (e) {}
  }

  function newId() {
    return 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------
  // WRITING
  //
  // The one entry point, and it is deliberately hard to misuse: a
  // recorder must name the moment (`key`), say which of the four kinds
  // it is, and hand over a finished sentence. Anything malformed is
  // refused rather than stored badly — a memory that is half a memory is
  // worse than none, because something later will read it aloud.
  //
  // @param {object} m {key, kind, content, importance, confidence,
  //                    source, entities, protected}
  // @returns {{ok:boolean, created:boolean, memory:object|null, reason?:string}}
  function remember(m) {
    try {
      if (!m || typeof m !== 'object') return { ok: false, created: false, memory: null, reason: 'bad-input' };

      const key = String(m.key || '').trim();
      const content = String(m.content || '').trim();
      const kind = String(m.kind || '').trim();
      if (!key) return { ok: false, created: false, memory: null, reason: 'no-key' };
      if (!content) return { ok: false, created: false, memory: null, reason: 'no-content' };
      if (KINDS.indexOf(kind) === -1) return { ok: false, created: false, memory: null, reason: 'bad-kind' };

      // NOTHING IS REMEMBERED FOR A TRAVELLER. Decision 19: if it is not
      // attached to a Magic Card it does not survive — so rather than
      // write it and sweep it later, it is never written. A Traveller's
      // Companion is the Story Egg, which has no memory to keep.
      const cardId = _cardId();
      if (!cardId) return { ok: false, created: false, memory: null, reason: 'no-card' };

      // INFERENCE IS NOT ALLOWED IN THIS SPRINT, and it is refused here
      // rather than trusted not to arrive. There is no model in this
      // build, so an 'inferred' memory could only come from a rule
      // guessing — which is the thing Decision 30 says a proposal must
      // be validated out of, not stored.
      const confidence = String(m.confidence || 'confirmed');
      if (confidence !== 'confirmed' && confidence !== 'observed') {
        return { ok: false, created: false, memory: null, reason: 'bad-confidence' };
      }

      const rec = _read();

      // THE DEDUPLICATION. One memory per (card, key), and the check is
      // the whole mechanism — there is no "have I done this?" flag kept
      // anywhere else that could disagree with the store.
      const existing = rec.items.find(function (x) { return x && x.key === key; });
      if (existing) return { ok: true, created: false, memory: _clone(existing) };

      if (rec.items.length >= LIMITS.hardMax) {
        return { ok: false, created: false, memory: null, reason: 'full' };
      }

      const memory = {
        id: newId(),
        key: key,
        kind: kind,
        content: content,
        importance: (m.importance in IMPORTANCE) ? m.importance : 'medium',
        confidence: confidence,
        source: String(m.source || 'unknown'),
        entities: Array.isArray(m.entities) ? m.entities.slice() : [],
        protected: !!m.protected,
        status: 'active',
        cardId: cardId,
        companionId: _companionId(),
        at: _now(),
        ref: null,
      };
      rec.items.push(memory);
      _prune(rec);
      _write();
      _push(memory);
      return { ok: true, created: true, memory: _clone(memory) };
    } catch (e) {
      return { ok: false, created: false, memory: null, reason: 'threw' };
    }
  }

  // Over the ceiling, the oldest unprotected ACTIVE memory steps back to
  // dormant. Not deleted, and never a protected one — "first story" is
  // the whole point of having a memory at all, and a cleanup that could
  // take it would make the store worse the longer it was used.
  //
  // This is the Garden's density idea at its simplest: pressure, applied
  // to the oldest thing, one at a time. It is NOT the Garden's life
  // cycle, which ages by kind through several stages; that belongs to a
  // sprint with enough memories for a season to mean anything.
  function _prune(rec) {
    const active = rec.items.filter(function (x) { return x && x.status === 'active' && !x.protected; });
    let over = rec.items.filter(function (x) { return x && x.status === 'active'; }).length - LIMITS.activeMax;
    if (over <= 0) return;
    active.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    for (let i = 0; i < active.length && over > 0; i++, over--) active[i].status = 'dormant';
  }

  function _clone(m) {
    // Every own key, known or not — js/companionRecord.js's discipline,
    // for the same reason: a field a later build adds must survive a
    // round trip through this file without this file being changed.
    const out = {};
    Object.keys(m).forEach(function (k) { out[k] = m[k]; });
    return out;
  }

  // ---------------------------------------------------------------
  // READING

  /** Every memory this card owns, newest first. Active only by default. */
  function list(opts) {
    const o = opts || {};
    const want = o.status || 'active';
    return _read().items
      .filter(function (m) { return m && (want === 'any' || m.status === want); })
      .filter(function (m) { return !o.kind || m.kind === o.kind; })
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); })
      .map(_clone);
  }

  function get(id) {
    const m = _read().items.find(function (x) { return x && x.id === id; });
    return m ? _clone(m) : null;
  }

  function has(key) {
    return !!_read().items.find(function (x) { return x && x.key === key; });
  }

  /**
   * RETRIEVAL, AND IT IS ARITHMETIC.
   *
   * No embeddings, no vector store, no semantic search, no ranking
   * model. `entities` hold REAL, STABLE IDS — 'project:<id>',
   * 'library:<id>', 'companion:leafy' — so an entity match is EXACT
   * where an embedding would be approximate, and a linear scan over a
   * store bounded at 120 is sub-millisecond.
   *
   * Understanding that a child saying "Spark" means library:lib_x is a
   * later sprint's job. This one answers the question once somebody
   * knows how to ask it.
   *
   * @param {object} [opts] {entities:[], kinds:[], limit, includeDormant}
   */
  function relevant(opts) {
    const o = opts || {};
    const want = Array.isArray(o.entities) ? o.entities.filter(Boolean) : [];
    const kinds = Array.isArray(o.kinds) ? o.kinds : null;
    const limit = (typeof o.limit === 'number' && o.limit > 0) ? o.limit : LIMITS.retrieveDefault;

    const pool = _read().items.filter(function (m) {
      if (!m) return false;
      if (m.status === 'archived') return false;
      if (m.status === 'dormant' && !o.includeDormant) return false;
      if (kinds && kinds.indexOf(m.kind) === -1) return false;
      return true;
    });

    const scored = pool.map(function (m) {
      let score = 0;
      // An exact entity match is worth more than anything else: it is
      // the difference between a memory ABOUT this thing and a memory
      // that merely happens to be recent.
      for (let i = 0; i < want.length; i++) {
        if (m.entities.indexOf(want[i]) !== -1) score += 5;
      }
      score += (IMPORTANCE[m.importance] || 0);
      if (m.protected) score += 1;
      // Recency, gently: last REFERENCED where we have it, otherwise
      // when it was made. A memory that has been used lately is more
      // alive than one merely made lately.
      const when = m.ref || m.at;
      score += _recency(when);
      return { m: m, score: score };
    });

    // If entities were asked for, a memory matching none of them is not
    // "less relevant" — it is not an answer to the question. Falling
    // back to recency there is how a Companion ends up saying something
    // true about the wrong thing.
    const pruned = want.length
      ? scored.filter(function (s) { return s.score >= 5; })
      : scored;

    pruned.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.m.at).localeCompare(String(a.m.at));
    });
    return pruned.slice(0, limit).map(function (s) { return _clone(s.m); });
  }

  // 0..1, halving roughly every 30 days. Deliberately small next to an
  // entity match — recency breaks ties, it does not decide answers.
  function _recency(iso) {
    try {
      const age = Date.now() - new Date(iso).getTime();
      if (!isFinite(age) || age < 0) return 1;
      return 1 / (1 + (age / (30 * 86400000)));
    } catch (e) { return 0; }
  }

  /**
   * THE SHAPE A FUTURE COMPANION MIND RECEIVES.
   *
   * Four fields, and deliberately not the record: no id, no key, no
   * cardId, no companionId, no status, no source, no timestamps. Those
   * are how this store works, and Decision 30's Privacy / Relevance Gate
   * is the only thing that may ever hand anything to a model — so what
   * leaves here is already the smallest true thing, and carries no
   * identifier that could name a child or a device even if it did.
   *
   * Marks what it hands back as referenced, which is the only thing that
   * makes `ref` mean anything.
   *
   * `{touch:false}` READS WITHOUT WRITING. Added for Sprint 1D's context
   * builder, which is permitted to retrieve a memory and forbidden to
   * modify one — and a reference stamp is bookkeeping, but bookkeeping
   * is still a write. The default is unchanged, so every existing
   * caller behaves exactly as it did; there are no existing callers
   * today, and this is deliberately additive anyway rather than a
   * change of mind about what the default should be.
   */
  function context(opts) {
    const picked = relevant(opts);
    const stamp = _now();
    if (picked.length && !(opts && opts.touch === false)) {
      const rec = _read();
      picked.forEach(function (p) {
        const live = rec.items.find(function (x) { return x && x.id === p.id; });
        if (live) live.ref = stamp;
      });
      _write();
    }
    return {
      memories: picked.map(function (m) {
        return {
          type: m.kind,
          content: m.content,
          importance: m.importance,
          confidence: m.confidence,
        };
      }),
    };
  }

  // ---------------------------------------------------------------
  // LIFECYCLE

  /** active → dormant → archived, or back. Protected memories may move
   *  between states but are never moved BY the cleanup above. */
  function setStatus(id, status) {
    if (STATUSES.indexOf(status) === -1) return { ok: false, reason: 'bad-status' };
    const rec = _read();
    const m = rec.items.find(function (x) { return x && x.id === id; });
    if (!m) return { ok: false, reason: 'not-found' };
    m.status = status;
    _write();
    _push(m);
    return { ok: true, memory: _clone(m) };
  }

  // ---------------------------------------------------------------
  // OWNERSHIP

  // A Traveller's memories become theirs when they claim a card — except
  // there are none, because remember() refuses to write without one.
  // This exists for the same reason LivingGarden.claim() does: if that
  // rule ever changes, the sweep is already here and already one-way.
  // Only the unowned record moves; another Creator's is never touched.
  function claim() {
    const id = _cardId();
    if (!id) return { ok: false, claimed: 0 };
    try {
      const target = STORE_PREFIX + id;
      if (localStorage.getItem(target)) return { ok: true, claimed: 0 };
      const orphan = localStorage.getItem(TRAVELLER_KEY);
      if (!orphan) return { ok: true, claimed: 0 };
      localStorage.setItem(target, orphan);
      localStorage.removeItem(TRAVELLER_KEY);
      _cache = null;
      return { ok: true, claimed: 1 };
    } catch (e) { return { ok: false, claimed: 0 }; }
  }

  // js/travellerReset.js is the only caller. Only ever the unowned
  // record — memories belonging to any card are untouchable, which is
  // Decision 19's own rule and the reason this can run for everybody.
  function forgetTraveller() {
    try { localStorage.removeItem(TRAVELLER_KEY); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }

  // ---------------------------------------------------------------
  // THE PLATFORM
  //
  // Push-only, fire-and-forget, exactly as js/creatorLibrary.js and
  // js/handwritingStore.js already are. It is what carries a memory to a
  // second device; it is never on the path of anything a child is
  // waiting for, and with no Supabase configured this file behaves
  // identically.
  //
  // THE ONLY NETWORK CALL IN THIS MODULE, and it goes to this project's
  // own database. No provider, no analytics, no third party — Decision
  // 30: memory never leaves VihuPlanet.
  function _push(memory) {
    try {
      if (typeof ThemeRepositoryClient === 'undefined') return;
      ThemeRepositoryClient.isConfigured().then(function (ok) {
        if (!ok) return;
        return ThemeRepositoryClient.getClient().then(function (client) {
          return ThemeRepositoryClient.getSession().then(function (session) {
            if (!client || !session || !session.user) return;
            return client.from(TABLE).upsert({
              id: memory.id,
              // The VERIFIED session, never a client-supplied owner —
              // Sprint 1A's rule, and what the row's own RLS checks.
              owner_id: session.user.id,
              card_id: memory.cardId,
              companion_id: memory.companionId,
              kind: memory.kind,
              content: memory.content,
              importance: memory.importance,
              confidence: memory.confidence,
              source: memory.source,
              entities: memory.entities,
              dedupe_key: memory.key,
              protected: memory.protected,
              status: memory.status,
              created_at: memory.at,
              last_referenced_at: memory.ref,
            }, { onConflict: 'id' });
          });
        });
      }).catch(function () {});
    } catch (e) {}
  }

  // Test seam. Drops the in-memory cache so a suite can change the
  // active card and see the right store. Never called by the Studio.
  function _reset() { _cache = null; }

  const api = {
    remember: remember,
    list: list,
    get: get,
    has: has,
    relevant: relevant,
    context: context,
    setStatus: setStatus,
    claim: claim,
    forgetTraveller: forgetTraveller,
    newId: newId,
    LIMITS: LIMITS,
    KINDS: KINDS,
    _reset: _reset,
  };
  try { window.CompanionMemory = api; } catch (e) {}

  // Self-claim on load, the way js/gardenRenderer.js calls
  // LivingGarden.claim() — a store that claims itself cannot be
  // forgotten by an unrelated file. js/handwritingStore.js's own
  // claimUnowned is exported and called from nowhere, which is exactly
  // the failure this avoids.
  try { claim(); } catch (e) {}

  return api;
})();
