// js/companionMemoryRank.js — the retrieval rules, in one place.
//
// Sprint 1E.1. This was inside js/companionMemory.js's relevant(), and
// it was lifted out for one reason: companion-chat now retrieves
// memories SERVER-SIDE, and the server must apply the identical rules.
// Two implementations of "which memories answer this question" is two
// things that can disagree about what a Companion knows, which is
// exactly the second source of truth Decision 30 forbids.
//
// So the browser's store calls this, and the Edge Function carries a
// GENERATED copy of it (tools/edge-auth-test/sync-shared.js), the same
// discipline the auth gate and the privacy gate already hold.
//
// ---------------------------------------------------------------
// IT IS ARITHMETIC, AND IT IS PURE
//
// No embeddings, no vector store, no semantic search, no ranking model,
// and no state. It takes a list and returns a shorter list. `entities`
// hold REAL, STABLE IDS — 'project:<id>', 'library:<id>',
// 'companion:leafy' — so a match is EXACT where an embedding would be
// approximate, and a linear scan over a store bounded at 120 is
// sub-millisecond.
//
// Behaviour is unchanged from the version this was lifted from; the
// memory suite's own retrieval checks are what prove that.
const CompanionMemoryRank = (function () {
  'use strict';

  const IMPORTANCE = { low: 0, medium: 1, high: 2 };
  const DEFAULT_LIMIT = 6;

  // 0..1, halving roughly every 30 days. Deliberately small next to an
  // entity match — recency breaks ties, it does not decide answers.
  function recency(iso) {
    try {
      const age = Date.now() - new Date(iso).getTime();
      if (!isFinite(age) || age < 0) return 1;
      return 1 / (1 + (age / (30 * 86400000)));
    } catch (e) { return 0; }
  }

  /**
   * @param {Array} items  memory records — {kind, importance, protected,
   *                       status, entities[], at, ref}
   * @param {object} [opts] {entities:[], kinds:[], limit, includeDormant}
   * @returns {Array} the same objects, filtered and ordered. Never
   *          copies and never mutates: the caller owns its records.
   */
  function rank(items, opts) {
    const o = opts || {};
    const list = Array.isArray(items) ? items : [];
    const want = Array.isArray(o.entities) ? o.entities.filter(Boolean) : [];
    const kinds = Array.isArray(o.kinds) ? o.kinds : null;
    const limit = (typeof o.limit === 'number' && o.limit > 0) ? o.limit : DEFAULT_LIMIT;

    const pool = list.filter(function (m) {
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
      const ents = Array.isArray(m.entities) ? m.entities : [];
      for (let i = 0; i < want.length; i++) {
        if (ents.indexOf(want[i]) !== -1) score += 5;
      }
      score += (IMPORTANCE[m.importance] || 0);
      if (m.protected) score += 1;
      // Recency, gently: last REFERENCED where we have it, otherwise
      // when it was made. A memory that has been used lately is more
      // alive than one merely made lately.
      score += recency(m.ref || m.at);
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
    return pruned.slice(0, limit).map(function (s) { return s.m; });
  }

  /**
   * The four fields that may leave a store — and no identifier of any
   * kind. Lifted here beside the ranking for the same reason: the
   * server produces this shape too, and one definition of "what a
   * memory looks like on the way out" is the whole point.
   */
  function project(items) {
    return (Array.isArray(items) ? items : []).map(function (m) {
      return {
        type: m.kind,
        content: m.content,
        importance: m.importance,
        confidence: m.confidence,
      };
    });
  }

  const api = { rank: rank, project: project, recency: recency, IMPORTANCE: IMPORTANCE, DEFAULT_LIMIT: DEFAULT_LIMIT };
  try { window.CompanionMemoryRank = api; } catch (e) {}
  return api;
})();
