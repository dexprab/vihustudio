// tools/ether-mystery-lab/labUnfinished.js — FROM A COMPLETE FIGURE, THE
// UNFINISHED ONE: which relationships a child will make.
//
// SPRINT — Ether grammar V2, close the loop (Decision 58, Lab only).
//
// NOT AT RANDOM. A missing join is chosen so that the unfinished figure
// still says "something is here", the absence is visible, and the join
// is a natural invitation. The rules are the creature experiments' own
// findings, written down:
//
//   ONLY A RELATIONSHIP MAY BE MISSING. A join that is the structure of a
//   part — a wing's edge, a tail's run, a body's volume, a ring — carries
//   what the part IS and is never taken. What may be taken is the join
//   BETWEEN parts: an attachment, or a transition on the flow (a neck is
//   the best gap a bird has).
//
//   NEVER A STRAY LIGHT. Both ends of a missing join keep at least one
//   other join, so nothing floats as a lone star — the sky is full of
//   those and a detached point does not read (Unfinished Figure).
//
//   A DETACHED PART READS. Prefer the gap that leaves a whole part sitting
//   apart from the body; prefer the part that carries identity (a
//   diagnostic or must-survive mass), because a wing or a tail sitting a
//   little apart is the strongest "these go together" there is.
//
//   WIDE, AND SPREAD OUT. Prefer the wider gap — two lights a finger's
//   width apart already look joined — and never two gaps sharing a light.
//
//   FEW. One to three, by the figure's size, and at least two joins always
//   remain — a figure that is mostly gaps is not a figure.
//
// Deterministic: the same figure gives the same gaps. No creature word,
// no `subject ===`, and the suite scans for both.

(function (global) {
  'use strict';

  var RELATIONSHIP = /^(attach|flow|continuous|limb)(?: \(rejoined\))?$/;
  var COUNT_FOR = function (n) { return n <= 8 ? 2 : n <= 12 ? 2 : 3; };

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  // figure: { points, joins: [{a,b,why}], masses: [massId per point] }
  // plan (optional): { masses:[{id, role}], mustSurvive:[ids] }
  function derive(figure, plan, opts) {
    opts = opts || {};
    if (!figure || !Array.isArray(figure.points) || !Array.isArray(figure.joins)) return { ok: false, reason: 'no-figure' };
    var P = figure.points, J = figure.joins, massOf = figure.masses || [];
    if (P.length < 3 || J.length < 3) return { ok: false, reason: 'too-small' };
    var identity = {};
    if (plan) {
      (plan.mustSurvive || []).forEach(function (id) { identity[id] = true; });
      (plan.masses || []).forEach(function (m) { if (m.role === 'diagnostic') identity[m.id] = true; });
    }
    var degree = P.map(function () { return 0; });
    J.forEach(function (j) { degree[j.a]++; degree[j.b]++; });
    var want = Math.max(1, Math.min(opts.max || COUNT_FOR(P.length), Math.floor((J.length - 2) / 2), 3));

    var cands = [];
    J.forEach(function (j, i) {
      var why = String(j.why || '');
      if (!RELATIONSHIP.test(why)) return;
      if (degree[j.a] < 2 || degree[j.b] < 2) return;            // never a stray light
      var d = dist(P[j.a], P[j.b]);
      var ma = massOf[j.a], mb = massOf[j.b];
      if (ma !== undefined && ma === mb) return;                  // a join inside one part is structure, not a relationship
      var partApart = Math.min(degree[j.a], degree[j.b]) >= 2;   // the weaker end still holds a part
      var carries = identity[ma] || identity[mb];
      var score = d + (partApart ? 0.5 : 0) + (carries ? 0.35 : 0) + (why.indexOf('flow') === 0 ? 0.25 : 0);
      cands.push({ index: i, score: score, d: d, a: j.a, b: j.b, why: why, between: [ma, mb], carries: !!carries });
    });
    cands.sort(function (x, y) { return y.score - x.score || x.index - y.index; });

    var chosen = [], used = {};
    for (var k = 0; k < cands.length && chosen.length < want; k++) {
      var c = cands[k];
      if (used[c.a] || used[c.b]) continue;                       // gaps never share a light
      // the join's own ends must keep a join AFTER every gap chosen so far
      var da = degree[c.a] - 1, db = degree[c.b] - 1;
      if (da < 1 || db < 1) continue;
      chosen.push(c); used[c.a] = true; used[c.b] = true;
      degree[c.a]--; degree[c.b]--;
    }
    if (!chosen.length) return { ok: false, reason: 'no-relationship-can-be-missing' };
    var missing = chosen.map(function (c) { return c.index; }).sort(function (x, y) { return x - y; });
    return {
      ok: true, missing: missing,
      gaps: chosen.map(function (c) { return { join: c.index, between: c.between, reason: (c.why.indexOf('flow') === 0 ? 'a transition on the flow' : 'an attachment') + (c.carries ? ', on a part that carries identity' : '') + ', wide enough to see' }; }),
      remaining: J.length - missing.length
    };
  }

  var api = { derive: derive, RELATIONSHIP: RELATIONSHIP, countFor: COUNT_FOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabUnfinished = api;
  else global.LabUnfinished = api;
})(typeof window !== 'undefined' ? window : this);
