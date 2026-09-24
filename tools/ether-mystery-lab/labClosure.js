// tools/ether-mystery-lab/labClosure.js — CLOSE THE LOOP on the Shape Lab
// page: vocabulary decision → composition with or without extensions →
// reveal suggestions → the unfinished creature and its hint → the real
// Ether preview (through the existing ▶ Play in Ether).
//
// SPRINT — Ether grammar V2, close the loop (Decision 58, Lab only).
//
// WHAT THIS FILE OWNS is the page flow and nothing about meaning or
// geometry: labVocabulary.js decides what a proposal is and whether the
// compiler can draw it, labEtherComposer.js draws, labUnfinished.js
// chooses the missing relationships, labReveal.js owns what a reveal
// feature is. This file asks them in the right order and shows the
// researcher what happened:
//
//   CURRENT ETHER VOCABULARY → CAN EXPRESS? → SUPPORTED / EXTENSION
//   REQUIRED / NOT EXPRESSIBLE → PROPOSED EXTENSION (research only) →
//   ETHER COMPOSITION RESULT (base or extended, one toggle) → SUGGESTED
//   REVEALS (accept · reject · edit · add) → MISSING CONNECTIONS and the
//   HINT → the existing TEST stage.
//
// THE RESEARCHER REMAINS THE AUTHOR. Nothing is auto-approved: a reveal
// suggestion becomes a feature only when accepted, a missing connection
// is placed only when asked for, and everything placed is an ordinary
// editable thing afterwards. Nothing here is persisted into a fixture
// beyond what the editor already keeps; extensions are session research
// data and reach no store, no export and no candidate.
//
// NO CREATURE CATALOGUE. No species word and no `subject ===` in this
// file; the suite scans for both.

(function (global) {
  'use strict';

  var doc = global.document;
  var state = { decision: null, meta: null, mode: 'extended', resolved: null, mystery: null, accepted: {}, rejected: {}, busy: false, last: null };
  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(msg, kind) { var n = el('[data-vocab-status]'); if (n) { n.textContent = msg || ''; n.className = 'say vocab-status' + (kind ? ' ' + kind : ''); } }
  function connMode() { var C = global.LabConnection; return C ? C.status().mode : 'fixture'; }
  function unconfigured() { var C = global.LabConnection; return !!C && connMode() !== 'fixture' && /not configured/.test(C.status().line); }
  var FALLBACK_HINT = 'Something is waiting…';

  // ---------------------------------------------------------------
  // THE DECISION — asked of the model with the picture, the
  // understanding and the plan; answered by the fixture with SUPPORTED
  // and nothing bound.
  // ---------------------------------------------------------------
  function decide() {
    var V = global.LabVocabulary, T = global.LabTranslate, I = global.LabImagine, C = global.LabConnection;
    if (!V || !T || !I || !C) { status('A module is not loaded.', 'warn'); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
    var plan = T.plan(), analysis = I.analysis();
    var img = I.selectedImageBytes ? I.selectedImageBytes() : null;
    if (!plan || !analysis || !img) { status('Create the Ether creature first — the vocabulary is judged against its plan.', 'warn'); return Promise.resolve({ ok: false, reason: 'no-plan' }); }
    if (state.busy) return Promise.resolve({ ok: false, reason: 'busy' });
    var mode = connMode();
    var kept = state.decision ? 'The decision you had is still here.' : 'Nothing changed.';
    var trace = { stage: 'vocabulary', mode: mode, request: null, answer: null, parse: null, outcome: 'pending' };
    state.last = trace;
    if (unconfigured()) {
      trace.request = 'not sent — the source is selected but not configured'; trace.outcome = 'not-configured';
      status('The source is selected but not configured — set it under Advanced, or choose Fixture. ' + kept, 'warn'); render();
      return Promise.resolve({ ok: false, reason: 'not-configured' });
    }
    var m = V.decisionMessages(analysis, plan);
    trace.request = mode === 'fixture' ? 'none — fixture mode answers SUPPORTED with nothing bound, and says it is a fixture' : 'sent through LabConnection (' + mode + '): the vocabulary question, the understanding, the plan, and the picture — nothing else';
    state.busy = true; render();
    status(mode === 'fixture' ? 'Fixture: the vocabulary is taken as sufficient…' : 'Asking whether the Ether vocabulary can express this being (' + mode + ')…');
    return C.understand({ messages: m.messages, image: { mime: img.mime, b64: img.b64 }, fixture: V.fixtureDecision }).then(function (r) {
      state.busy = false;
      if (!r || !r.ok) {
        var reason = (r && r.reason) || 'unavailable';
        trace.answer = { ok: false, reason: reason }; trace.outcome = 'failed';
        status('The vocabulary question failed — ' + reason + ' (' + mode + '). No fixture was substituted. ' + kept, 'warn'); render();
        return { ok: false, reason: reason };
      }
      trace.answer = { ok: true, source: r.source, model: r.model || null, chars: String(r.text || '').length };
      var v = V.parseDecision(r.text, plan, analysis.subject);
      trace.parse = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
      if (!v.ok) {
        trace.outcome = 'rejected';
        status('The decision was refused — ' + v.reasons.slice(0, 3).join(', ') + (v.reasons.length > 3 ? '…' : '') + '. ' + kept, 'warn'); render();
        return { ok: false, reason: 'invalid-decision', reasons: v.reasons };
      }
      state.decision = v.decision;
      state.meta = { source: r.source, mode: mode, model: r.model || null, repairs: v.repairs || [], at: Date.now() };
      state.accepted = {}; state.rejected = {}; state.mystery = null;
      trace.outcome = r.source === 'fixture' ? 'fixture' : 'generated';
      var d = v.decision;
      var ex = d.extensions.filter(function (e) { return e.compiler && e.compiler.ok; }).length;
      var no = d.extensions.length - ex;
      status((r.source === 'fixture' ? 'Fixture decision: ' : 'Decision (' + (r.model || mode) + '): ') + d.decision.replace(/_/g, ' ') + (d.extensions.length ? ' — ' + d.extensions.length + ' extension' + (d.extensions.length === 1 ? '' : 's') + ' proposed, ' + ex + ' expressible' + (no ? ', ' + no + ' not' : '') : '') + (d.revealCandidates.length ? ' · ' + d.revealCandidates.length + ' reveal suggestion' + (d.revealCandidates.length === 1 ? '' : 's') : '') + (d.hint ? ' · hint written' : '') + '.', 'ok');
      applyMode(state.mode);
      render();
      return { ok: true, source: r.source, decision: d.decision, extensions: d.extensions.length, reveal: d.revealCandidates.length };
    }).catch(function () {
      state.busy = false; trace.answer = { ok: false, reason: 'error' }; trace.outcome = 'failed';
      status('The vocabulary question failed (' + mode + '). ' + kept, 'warn'); render();
      return { ok: false, reason: 'error' };
    });
  }

  // BASE or EXTENDED — the same plan through the same composer; the one
  // difference is the capabilities bound to its masses.
  function applyMode(mode) {
    var V = global.LabVocabulary, T = global.LabTranslate;
    state.mode = mode === 'base' ? 'base' : 'extended';
    if (!V || !T || !T.plan()) return { ok: false, reason: 'no-plan' };
    state.resolved = V.resolve(state.decision, state.mode);
    var caps = state.mode === 'extended' && Object.keys(state.resolved.caps).length ? state.resolved.caps : null;
    var r = T.recompose(caps, state.mode === 'extended' ? (caps ? 'Composed with the extensions' : 'Composed — nothing bound, so the base vocabulary alone') : 'Composed with the base vocabulary alone');
    state.mystery = null;
    render();
    return r;
  }

  // ---------------------------------------------------------------
  // THE UNFINISHED CREATURE — the missing relationships and the hint
  // ---------------------------------------------------------------
  function makeMystery() {
    var U = global.LabUnfinished, T = global.LabTranslate, S = global.ShapeLab;
    if (!U || !T || !S) return { ok: false, reason: 'not-loaded' };
    var fig = T.figure(), plan = T.plan();
    if (!fig || !plan) return { ok: false, reason: 'no-figure' };
    var u = U.derive({ points: fig.points, joins: fig.joins, masses: fig.masses }, plan);
    if (!u.ok) { status('No missing connection could be chosen — ' + u.reason + '.', 'warn'); return u; }
    // the figure in the editor may have been edited since it was composed:
    // a gap is placed on the join with the same two ends, or not at all
    // (the editor's own record keeps a join as "a-b" and the gaps as indices)
    function pair(j) { if (typeof j === 'string') { var ab = j.split('-').map(Number); return { a: ab[0], b: ab[1] }; } return { a: Number(j.a), b: Number(j.b) }; }
    var st = S.state();
    var placed = 0, notFound = [];
    (st.missing || []).slice().sort(function (x, y) { return y - x; }).forEach(function (k) { S.toggleGap(k); });
    st = S.state();
    u.gaps.forEach(function (g) {
      var cj = fig.joins[g.join];
      var k = -1;
      st.joins.forEach(function (j0, i) { var j = pair(j0); if ((j.a === cj.a && j.b === cj.b) || (j.a === cj.b && j.b === cj.a)) k = i; });
      if (k === -1) { notFound.push(g.between.join('–')); return; }
      var r = S.toggleGap(k); if (r.ok && r.gap) placed++;
    });
    var hint = (state.decision && state.decision.hint) || FALLBACK_HINT;
    S.setHint(hint);
    state.mystery = { gaps: u.gaps, placed: placed, notFound: notFound, hint: hint, remaining: u.remaining };
    status('Missing connections chosen: ' + placed + (notFound.length ? ' (' + notFound.length + ' no longer in the figure)' : '') + ' — ' + u.gaps.map(function (g) { return g.between[0] === g.between[1] ? g.between[0] : g.between.join(' ↔ '); }).join(', ') + '. Hint: “' + hint + '”', 'ok');
    render();
    return { ok: true, placed: placed, gaps: u.gaps, hint: hint };
  }

  // ---------------------------------------------------------------
  // REVEAL SUGGESTIONS — accept, reject; accepted ones become ordinary
  // editable reveal features anchored to the mass's own lights
  // ---------------------------------------------------------------
  function lightsOf(massId) {
    var T = global.LabTranslate; var fig = T && T.figure();
    if (!fig || !Array.isArray(fig.masses)) return null;
    var idx = [];
    fig.masses.forEach(function (m, i) { if (m === massId) idx.push(i); });
    if (!idx.length) return null;
    // the feature's frame is |A→B|, so B is the mass's light NEAREST to A:
    // a frame spanning a whole part drew a mane larger than the figure
    // (measured on the first render); the researcher resizes from there
    var a = idx[0], b = null, best = Infinity;
    idx.slice(1).forEach(function (i) { var d = Math.hypot(fig.points[i][0] - fig.points[a][0], fig.points[i][1] - fig.points[a][1]); if (d < best) { best = d; b = i; } });
    return { a: a, b: b };
  }
  function suggestions() {
    var d = state.decision;
    if (!d) return [];
    return d.revealCandidates.map(function (c) {
      var L = c.near ? lightsOf(c.near) : null;
      var support = c.support;
      var why = c.why;
      if (support === 'SUPPORTED_REVEAL' && !L) { support = 'NOT_SUITABLE_FOR_REVEAL'; why = 'the part it belongs to got no light in this composition'; }
      return { name: c.name, reason: c.reason, importance: c.importance, role: c.role, appearance: c.appearance, near: c.near, kind: c.kind, wanted: c.wanted, support: support, why: why, lights: L,
        state: state.accepted[c.name] ? 'accepted' : state.rejected[c.name] ? 'rejected' : 'offered' };
    });
  }
  function acceptReveal(name) {
    var S = global.ShapeLab;
    var s = suggestions().filter(function (x) { return x.name === name; })[0];
    if (!s || !S) return { ok: false, reason: 'no-such-suggestion' };
    if (s.support !== 'SUPPORTED_REVEAL') return { ok: false, reason: s.support };
    var r = S.addReveal(s.kind, s.lights.a, s.lights.b, s.name);
    if (!r.ok) return r;
    state.accepted[name] = r.id; delete state.rejected[name];
    render();
    return { ok: true, id: r.id };
  }
  function rejectReveal(name) { state.rejected[name] = true; delete state.accepted[name]; render(); return { ok: true }; }

  // ---------------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------------
  function renderVocab() {
    var box = el('[data-vocab-panel]');
    if (!box) return;
    var d = state.decision, m = state.meta || {};
    if (!d) { box.innerHTML = '<div class="note">No decision yet. Once the Ether creature is composed, the vocabulary is checked against it.</div>'; return; }
    var rows = [];
    rows.push('<div class="srcbadge ' + (m.source === 'fixture' ? 'fixture' : 'llm') + '">' + (m.source === 'fixture' ? 'FIXTURE — no model looked' : 'VOCABULARY DECISION (' + esc(m.model || m.mode) + ')') + '</div>');
    rows.push('<div class="vd-decision ' + esc(d.decision.toLowerCase()) + '">' + esc(d.decision.replace(/_/g, ' ')) + '</div>');
    if (d.reason) rows.push('<div class="an-v">' + esc(d.reason) + '</div>');
    if (d.extensions.length) {
      rows.push('<div class="an-h">Proposed extensions</div>');
      d.extensions.forEach(function (e) {
        var ok = e.compiler && e.compiler.ok;
        rows.push('<div class="ext-card ' + (ok ? 'ok' : 'no') + '">' +
          '<div class="ext-h">' + (ok ? '✓' : '○') + ' <b>' + esc(e.name) + '</b> <span class="ext-status">' + esc(e.status) + '</span></div>' +
          '<div class="ext-row"><span>Meaning:</span> ' + esc(e.meaning) + '</div>' +
          '<div class="ext-row"><span>Why needed:</span> ' + esc(e.whyNeeded) + '</div>' +
          (e.expresses ? '<div class="ext-row"><span>Expresses:</span> ' + esc(e.expresses) + '</div>' : '') +
          '<div class="ext-row"><span>Composes with:</span> ' + esc(e.composesWith.join(', ')) + '</div>' +
          '<div class="ext-row"><span>Affects:</span> ' + esc(e.affects.join(', ')) + '</div>' +
          (e.visualEffect ? '<div class="ext-row"><span>Visual effect:</span> ' + esc(e.visualEffect) + '</div>' : '') +
          '<div class="ext-row"><span>Made of:</span> ' + esc(e.construction.base) + (e.construction.modifiers.length ? ' + ' + e.construction.modifiers.map(function (x) { return x.cap + (x.value ? ':' + x.value : ''); }).join(' + ') : '') + '</div>' +
          '<div class="ext-row ' + (ok ? 'good' : 'bad') + '"><span>Can be drawn:</span> ' + (ok ? 'yes — every part of it is a drawing capability' : 'NOT EXPRESSIBLE — ' + esc(e.compiler.reasons.join(', '))) + '</div>' +
          (e.examples.length ? '<div class="ext-row"><span>Useful for:</span> ' + esc(e.examples.join(' · ')) + '</div>' : '') +
          '</div>');
      });
    }
    if (d.refused.length) rows.push('<div class="an-h">Refused proposals</div><div class="an-v">' + d.refused.map(function (r) { return esc(r.name || '?') + ' — ' + esc(r.reasons.join(', ')); }).join('<br>') + '</div>');
    if (d.apply.length) rows.push('<div class="an-h">Bound to the figure</div><ul class="an-list">' + d.apply.map(function (a) { return '<li><b>' + esc(a.mass) + '</b> — ' + esc(a.terms.join(', ')) + '</li>'; }).join('') + '</ul>');
    var res = state.resolved;
    if (res) {
      rows.push('<div class="an-h">Composed with</div><div class="an-v">' + (state.mode === 'base' ? 'the base vocabulary alone' : (Object.keys(res.caps).length ? 'the extensions — ' + Object.keys(res.caps).map(function (id) { return id + ': ' + Object.keys(res.caps[id]).map(function (k) { return res.caps[id][k] === true ? k : k + ':' + res.caps[id][k]; }).join(' + '); }).join(' · ') : 'nothing bound — the base vocabulary alone')) + '</div>');
      if (res.notExpressible.length) rows.push('<div class="an-v bad">Not drawn: ' + res.notExpressible.map(function (n) { return esc(n.mass) + ' ← ' + esc(n.term) + ' (' + esc(n.reasons.join(', ')) + ')'; }).join(' · ') + '</div>');
    }
    if (d.hint) rows.push('<div class="an-h">Leading hint</div><div class="an-v">“' + esc(d.hint) + '”</div>');
    if (m.repairs && m.repairs.length) rows.push('<div class="an-h">Tidied</div><div class="an-v">' + esc(m.repairs.join(' · ')) + '</div>');
    box.innerHTML = rows.join('');
  }

  function renderRevealSuggestions() {
    var box = el('[data-reveal-suggested]');
    if (!box) return;
    var list = suggestions();
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    var m = state.meta || {};
    var rows = ['<div class="srclabel">Suggested reveals' + (m.source === 'fixture' ? ' — fixture' : '') + '</div>'];
    list.forEach(function (s) {
      var mark = s.state === 'accepted' ? '✓' : s.state === 'rejected' ? '✕' : s.support === 'SUPPORTED_REVEAL' ? '○' : '○';
      var supportWord = s.support === 'SUPPORTED_REVEAL' ? 'supported' : s.support === 'REQUIRES_EXTENSION' ? 'requires extension' : 'not suitable';
      rows.push('<div class="rv-sugg ' + esc(s.state) + ' ' + esc(s.support.toLowerCase()) + '" data-rv-sugg-name="' + esc(s.name) + '">' +
        '<div class="rv-sugg-h">' + mark + ' <b>' + esc(s.name) + '</b> <span class="rv-sugg-meta">' + esc(s.role) + ' · ' + esc(s.importance) + ' · ' + esc(s.appearance) + ' · ' + supportWord + '</span></div>' +
        '<div class="rv-sugg-why">' + esc(s.reason || '') + (s.near ? ' — near ' + esc(s.near) : '') + ' · ' + esc(s.why) + '</div>' +
        '<div class="row rv-sugg-actions">' +
        (s.support === 'SUPPORTED_REVEAL' && s.state !== 'accepted' ? '<button class="quiet" data-rv-accept="' + esc(s.name) + '">Accept</button>' : '') +
        (s.state !== 'rejected' ? '<button class="quiet" data-rv-reject="' + esc(s.name) + '">Reject</button>' : '') +
        (s.state === 'accepted' ? '<span class="note">accepted — edit it in the list above like any feature</span>' : '') +
        (s.support === 'REQUIRES_EXTENSION' ? '<span class="note">research information — not drawn, not implemented</span>' : '') +
        '</div></div>');
    });
    box.innerHTML = rows.join('');
    box.querySelectorAll('[data-rv-accept]').forEach(function (b) { b.addEventListener('click', function () { var r = acceptReveal(b.getAttribute('data-rv-accept')); if (!r.ok) status('Not added: ' + r.reason, 'warn'); }); });
    box.querySelectorAll('[data-rv-reject]').forEach(function (b) { b.addEventListener('click', function () { rejectReveal(b.getAttribute('data-rv-reject')); }); });
  }

  function renderDiag() {
    var box = el('[data-vocab-diag]');
    if (!box) return;
    var t = state.last;
    if (!t) { box.innerHTML = '<div class="note">No decision asked yet.</div>'; return; }
    function row(k, v, cls) { return '<div class="trow"><span class="tk">' + esc(k) + '</span><span class="tv' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span></div>'; }
    var rows = [row('decision · connection', t.mode), row('decision · request', t.request || '—')];
    if (t.answer) rows.push(t.answer.ok ? row('decision · answer', 'received · labelled ' + t.answer.source + (t.answer.model ? ' · model ' + t.answer.model : '') + ' · ' + t.answer.chars + ' chars', 'good') : row('decision · answer', 'failed — ' + t.answer.reason, 'bad'));
    if (t.parse) rows.push(t.parse.ok ? row('decision · checked', 'accepted' + (t.parse.repairs.length ? ' · tidied: ' + t.parse.repairs.join(' · ') : ''), 'good') : row('decision · checked', 'refused — ' + t.parse.reasons.join(', '), 'bad'));
    rows.push(row('outcome', t.outcome, /failed|rejected|not-configured/.test(t.outcome) ? 'bad' : 'good'));
    if (state.resolved) rows.push(row('resolved', JSON.stringify(state.resolved)));
    if (state.mystery) rows.push(row('mystery', JSON.stringify({ gaps: state.mystery.gaps, hint: state.mystery.hint, remaining: state.mystery.remaining })));
    box.innerHTML = rows.join('');
  }

  function render() {
    if (!doc) return;
    var T = global.LabTranslate;
    var havePlan = !!(T && T.plan && T.plan());
    var go = el('[data-vocab-go]'); if (go) go.disabled = !havePlan || state.busy;
    var sec = el('[data-vocab-section]'); if (sec) sec.setAttribute('data-vocab-outcome', state.last ? state.last.outcome : 'none');
    var mb = el('[data-vocab-mode="base"]'), me = el('[data-vocab-mode="extended"]');
    var bindable = !!(state.decision && state.decision.apply.length);
    if (mb) { mb.classList.toggle('on', state.mode === 'base'); mb.disabled = !havePlan || !state.decision; }
    if (me) { me.classList.toggle('on', state.mode === 'extended'); me.disabled = !havePlan || !state.decision; me.title = bindable ? '' : 'nothing bound — the extended composition is the base one'; }
    var my = el('[data-mystery-go]'); if (my) my.disabled = !havePlan;
    var myWhy = el('[data-mystery-why]');
    if (myWhy) myWhy.textContent = state.mystery ? state.mystery.gaps.map(function (g) { return (g.between[0] === g.between[1] ? g.between[0] : g.between.join(' ↔ ')) + ' — ' + g.reason; }).join(' · ') : (havePlan ? '' : 'Compose an Ether creature first.');
    renderVocab(); renderRevealSuggestions(); renderDiag();
  }

  function wire() {
    var go = el('[data-vocab-go]'); if (go) go.addEventListener('click', function () { decide(); });
    ['base', 'extended'].forEach(function (mode) { var b = el('[data-vocab-mode="' + mode + '"]'); if (b) b.addEventListener('click', function () { applyMode(mode); }); });
    var cb = el('[data-compose-budget]'); if (cb) cb.addEventListener('change', function () { if (global.LabTranslate && global.LabTranslate.plan()) applyMode(state.mode); });
    var my = el('[data-mystery-go]'); if (my) my.addEventListener('click', function () { makeMystery(); });
    var T = global.LabTranslate;
    // a new creature is a new question: the decision that answered the
    // old plan is dropped, and asked again by itself when a model is there
    if (T && T.onTranslated) T.onTranslated(function () { state.decision = null; state.meta = null; state.resolved = null; state.mystery = null; state.accepted = {}; state.rejected = {}; render(); decide(); });
    var S = global.ShapeLab; if (S && S.observe) S.observe(function () { renderRevealSuggestions(); });
    render();
  }
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire); else wire(); }

  var api = {
    FALLBACK_HINT: FALLBACK_HINT,
    decide: decide, applyMode: applyMode, makeMystery: makeMystery, acceptReveal: acceptReveal, rejectReveal: rejectReveal, suggestions: suggestions,
    decision: function () { return state.decision ? JSON.parse(JSON.stringify(state.decision)) : null; },
    meta: function () { return state.meta ? JSON.parse(JSON.stringify(state.meta)) : null; },
    mode: function () { return state.mode; },
    resolved: function () { return state.resolved ? JSON.parse(JSON.stringify(state.resolved)) : null; },
    mystery: function () { return state.mystery ? JSON.parse(JSON.stringify(state.mystery)) : null; },
    last: function () { return state.last ? JSON.parse(JSON.stringify(state.last)) : null; },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabClosure = api;
  else global.LabClosure = api;
})(typeof window !== 'undefined' ? window : this);
