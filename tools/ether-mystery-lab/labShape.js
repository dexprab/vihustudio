// tools/ether-mystery-lab/labShape.js — the CREATURE SHAPE LAB.
//
// SPRINT — Ether Mystery Lab: Creature Shape Lab (Decision 58).
//
// A RESEARCH INSTRUMENT, NOT A CREATURE SYSTEM. Every earlier creature
// experiment had the model pre-select creatures, draw them and judge
// them. This removes that judgement from the loop: a person draws a
// figure in the Ether's own point-and-line language at a chosen point
// BUDGET, marks which joins are missing, records what THEY see, and
// compares the same creature across budgets. The tool answers
// nothing. It shows.
//
// WHAT IT DELIBERATELY DOES NOT DO.
//   - It holds no animal image, no SVG, no silhouette under the canvas
//     and no tracing of any kind (the suite scans for them). The whole
//     question is what the point/line language can express on its own.
//   - It computes no recognisability score and asks no model. The
//     judgement panel is checkboxes and words a researcher writes.
//   - It generates no geometry from a creature's name. The name is
//     researcher metadata: it is never in a candidate, never on the
//     canvas, never in the preview.
//   - It draws no curves. The Ether figure system has none — a join is
//     a straight segment between two lights — so offering one here
//     would show something the runtime cannot perform.
//
// THE PRODUCTION CEILING IS NOT CHANGED, AND IT IS NOT HIDDEN. Four
// research budgets — 8, 12, 16, 20 — and the product performs one of
// them. A figure above eight is drawn here in the Ether's language so
// it can be JUDGED, and the real validator's refusal is shown beside it
// in as many words. It can be played in the real Ether only when the
// real Ether can perform it; the tool never truncates, never clamps and
// never pretends.
//
// ONE UNIT SPACE, ONE SCALE, EVERY BUDGET. A figure is authored in the
// validator's own coordinate box (±1.4) and drawn at ONE fixed scale in
// the editor and in every comparison tile — so a 20-light figure and
// an 8-light figure are compared at the same size, and scale can never
// be used to flatter a budget.
//
// A JOIN IS SAVED AS "a-b", NEVER AS A PAIR OF INTEGERS. A list of
// integer pairs is what a Magic Card's constellation looks like, and
// the Stars guard refuses that shape on sight (Decision 58). The
// figure contract's own spelling is used everywhere a figure leaves
// this file.

(function (global) {
  'use strict';

  var BUDGETS = [8, 12, 16, 20];
  var PRODUCTION_BUDGET = 8;       // shown, never enforced here — the validator says so
  var STORE_KEY = 'vihu.lab.shapes';
  var LAB_VERSION = 'shape-lab-1';
  var COORD = 1.4;                 // the validator's own bound on a point

  // ---- the Ether's own look, restated here for a canvas of our own ----
  var LINE = 'rgba(232,214,168,.62)';
  var LINE_MISSING = 'rgba(232,214,168,.14)';   // editor only: where a gap is
  var CORE = '#F5EEDA';
  var HALO = 'rgba(241,234,208,';

  var doc = global.document;

  // ---------------------------------------------------------------
  // STATE — the working figure. Joins are kept as objects while
  // editing (a deleted light renumbers everything after it, and a
  // gap has to follow its join through that), and are written out as
  // "a-b" strings plus gap indices, which is the figure contract.
  // ---------------------------------------------------------------
  var state = {
    id: null,                    // the fixture this was opened from, or null
    budget: 8,
    points: [],                  // [[x,y]] in unit space
    joins: [],                   // [{a,b,gap}]
    name: '', hint: '', notes: '',
    judgement: null,
    tease: false                 // the delayed aid, OFF by default
  };
  var mode = 'add';              // add · move · delete · join · gap
  var pendingA = null;           // join mode: the first light chosen
  var dragging = null;           // move mode
  var showNumbers = true;
  var listeners = [];
  var figureEpoch = 0;          // bumped when a different figure is opened
  var judgedEpoch = -1;

  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function clamp(v) { return Math.max(-COORD, Math.min(COORD, Math.round(v * 100) / 100)); }
  function key(a, b) { return Math.min(a, b) + '-' + Math.max(a, b); }

  // ---------------------------------------------------------------
  // EDITING
  // ---------------------------------------------------------------
  function setBudget(b) {
    b = Number(b);
    if (BUDGETS.indexOf(b) === -1) return { ok: false, reason: 'not-a-budget' };
    // A figure never silently exceeds its budget — shrinking under a
    // figure that has more lights than the new budget is refused,
    // never trimmed.
    if (state.points.length > b) {
      return { ok: false, reason: 'figure-has-' + state.points.length + '-lights' };
    }
    state.budget = b;
    emit();
    return { ok: true };
  }

  function addPoint(x, y) {
    if (state.points.length >= state.budget) {
      return { ok: false, reason: 'budget-full:' + state.budget };
    }
    state.points.push([clamp(x), clamp(y)]);
    emit();
    return { ok: true, index: state.points.length - 1 };
  }

  function movePoint(i, x, y) {
    if (!state.points[i]) return { ok: false, reason: 'no-such-light' };
    state.points[i] = [clamp(x), clamp(y)];
    emit();
    return { ok: true };
  }

  function deletePoint(i) {
    if (!state.points[i]) return { ok: false, reason: 'no-such-light' };
    state.points.splice(i, 1);
    // Joins touching the light go; every index above it steps down,
    // and a gap follows its own join.
    state.joins = state.joins.filter(function (j) { return j.a !== i && j.b !== i; })
      .map(function (j) {
        return { a: j.a > i ? j.a - 1 : j.a, b: j.b > i ? j.b - 1 : j.b, gap: !!j.gap };
      });
    if (pendingA === i) pendingA = null;
    else if (pendingA !== null && pendingA > i) pendingA--;
    emit();
    return { ok: true };
  }

  function findJoin(a, b) {
    for (var i = 0; i < state.joins.length; i++) {
      if (key(state.joins[i].a, state.joins[i].b) === key(a, b)) return i;
    }
    return -1;
  }

  // Connect two lights, or — if they are already joined — take the
  // join away. One tool for both, so "remove a connection" is the
  // same gesture as making one.
  function toggleJoin(a, b) {
    if (a === b || !state.points[a] || !state.points[b]) {
      return { ok: false, reason: 'not-two-lights' };
    }
    var i = findJoin(a, b);
    if (i !== -1) { state.joins.splice(i, 1); emit(); return { ok: true, removed: true }; }
    state.joins.push({ a: Math.min(a, b), b: Math.max(a, b), gap: false });
    emit();
    return { ok: true, added: true };
  }

  // A gap is EXPLICIT: the researcher names the join, nothing is
  // drawn at random.
  function toggleGap(joinIndex) {
    var j = state.joins[joinIndex];
    if (!j) return { ok: false, reason: 'no-such-join' };
    j.gap = !j.gap;
    emit();
    return { ok: true, gap: j.gap };
  }

  function reset() {
    figureEpoch++;
    state.id = null;
    state.points = []; state.joins = [];
    state.name = ''; state.hint = ''; state.notes = '';
    state.judgement = null; state.tease = false;
    pendingA = null; dragging = null;
    emit();
  }

  // A NEUTRAL DEMONSTRATION SHAPE, and deliberately not a creature: a
  // ring of lights around the budget, so the tool can be shown working
  // without anybody having chosen an animal for the researcher.
  function demoRing() {
    figureEpoch++;
    state.points = []; state.joins = []; pendingA = null;
    var n = state.budget;
    for (var i = 0; i < n; i++) {
      var t = -Math.PI / 2 + (i / n) * Math.PI * 2;
      state.points.push([clamp(Math.cos(t) * 1.0), clamp(Math.sin(t) * 1.0)]);
    }
    for (var k = 0; k < n; k++) state.joins.push({ a: Math.min(k, (k + 1) % n), b: Math.max(k, (k + 1) % n), gap: false });
    state.joins[0].gap = true;
    emit();
  }

  // ---------------------------------------------------------------
  // THE FIGURE CONTRACT, AND THE CANDIDATE
  // ---------------------------------------------------------------
  function figureOf(s) {
    s = s || state;
    var gaps = [];
    var joins = s.joins.map(function (j, i) { if (j.gap) gaps.push(i); return j.a + '-' + j.b; });
    return { points: s.points.map(function (p) { return [p[0], p[1]]; }), joins: joins, gaps: gaps };
  }

  var candidateSeq = 0;
  // THE ID IS OPAQUE AND THE NAME IS NOT IN IT. A candidate is what
  // reaches the interpreter, and nothing about the creature — not its
  // name, not the hint, not the notes — may travel inside one.
  function candidateFor(s) {
    s = s || state;
    var Kit = global.EtherMysteryLabKit;
    if (!Kit || !Kit.creatureCandidate) return null;
    var fig = figureOf(s);
    candidateSeq++;
    return Kit.creatureCandidate({
      id: 'lab-shape-' + candidateSeq,
      nodes: fig.points.length,
      complexity: 'moderate',
      title: 'a shape of lights, ' + fig.gaps.length + ' join' + (fig.gaps.length === 1 ? '' : 's') + ' short',
      figure: fig
    });
  }

  // ---------------------------------------------------------------
  // METRICS — facts only. No score, no model, no opinion.
  // ---------------------------------------------------------------
  function components(s) {
    s = s || state;
    var n = s.points.length;
    if (!n) return 0;
    var parent = [];
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    s.joins.forEach(function (j) {
      if (j.gap) return;                       // the UNFINISHED figure's islands
      if (j.a >= n || j.b >= n) return;
      var ra = find(j.a), rb = find(j.b);
      if (ra !== rb) parent[ra] = rb;
    });
    var roots = {};
    for (var k = 0; k < n; k++) roots[find(k)] = 1;
    return Object.keys(roots).length;
  }

  function metrics(s) {
    s = s || state;
    var fig = figureOf(s);
    var m = {
      budget: s.budget,
      points: fig.points.length,
      connections: fig.joins.length,
      missing: fig.gaps.length,
      components: components(s),
      percentUsed: s.budget ? Math.round((fig.points.length / s.budget) * 100) : 0,
      allPlaced: fig.points.length === s.budget,
      productionBudget: PRODUCTION_BUDGET,
      aboveProduction: s.budget > PRODUCTION_BUDGET,
      validator: null
    };
    var G = global.EtherGrammar;
    var cand = candidateFor(s);
    if (G && G.validate && cand) {
      var v = G.validate(cand);
      m.validator = { ok: !!v.ok, reasons: v.reasons || [] };
    } else {
      m.validator = { ok: false, reasons: ['no-validator'] };
    }
    return m;
  }

  // The real Ether can PERFORM this figure: the validator takes it, and
  // it has at least one gap to complete. Nothing else is asked.
  function playable(s) {
    var m = metrics(s || state);
    return !!(m.validator && m.validator.ok && m.missing > 0);
  }

  // ---------------------------------------------------------------
  // DRAWING — the Ether's language on a canvas of our own. One fixed
  // scale for every budget; nothing auto-fits.
  // ---------------------------------------------------------------
  function scaleFor(w, h) { return (Math.min(w, h) * 0.46) / COORD; }

  function toScreen(p, w, h) {
    var k = scaleFor(w, h);
    return [w / 2 + p[0] * k, h / 2 + p[1] * k];
  }
  function toUnit(x, y, w, h) {
    var k = scaleFor(w, h);
    return [(x - w / 2) / k, (y - h / 2) / k];
  }

  function draw(canvas, s, opts) {
    s = s || state; opts = opts || {};
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#161C33'); grad.addColorStop(1, '#1E2440');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);

    var P = s.points.map(function (p) { return toScreen(p, w, h); });
    var lw = Math.max(1.2, Math.min(w, h) / 420);
    g.lineCap = 'round';
    s.joins.forEach(function (j) {
      if (!P[j.a] || !P[j.b]) return;
      if (j.gap && opts.unfinished) return;              // the unfinished figure: nothing at all
      g.strokeStyle = (j.gap && opts.editing) ? LINE_MISSING : LINE;
      g.lineWidth = lw;
      if (j.gap && opts.editing) g.setLineDash([4, 6]); else g.setLineDash([]);
      g.beginPath(); g.moveTo(P[j.a][0], P[j.a][1]); g.lineTo(P[j.b][0], P[j.b][1]); g.stroke();
    });
    g.setLineDash([]);
    var r = Math.max(9, Math.min(w, h) / 34), core = Math.max(2.6, Math.min(w, h) / 130);
    P.forEach(function (p, i) {
      var rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      rg.addColorStop(0, HALO + '.34)'); rg.addColorStop(1, HALO + '0)');
      g.fillStyle = rg; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
      g.fillStyle = (opts.editing && pendingA === i) ? '#ffd27a' : CORE;
      g.beginPath(); g.arc(p[0], p[1], core, 0, Math.PI * 2); g.fill();
      if (opts.editing && opts.numbers) {
        g.fillStyle = 'rgba(241,234,208,.55)';
        g.font = Math.max(10, Math.min(w, h) / 44) + 'px ui-monospace, monospace';
        g.textAlign = 'left';
        g.fillText(String(i), p[0] + core + 4, p[1] - core - 3);
      }
    });
  }

  // ---------------------------------------------------------------
  // HIT TESTING — a light within reach, or a segment under the pointer
  // ---------------------------------------------------------------
  function pointAt(x, y, w, h) {
    var best = -1, bd = 16;
    state.points.forEach(function (p, i) {
      var q = toScreen(p, w, h);
      var d = Math.hypot(q[0] - x, q[1] - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function joinAt(x, y, w, h) {
    var best = -1, bd = 9;
    state.joins.forEach(function (j, i) {
      var A = toScreen(state.points[j.a], w, h), B = toScreen(state.points[j.b], w, h);
      var vx = B[0] - A[0], vy = B[1] - A[1], L = vx * vx + vy * vy;
      var t = L ? Math.max(0.12, Math.min(0.88, ((x - A[0]) * vx + (y - A[1]) * vy) / L)) : 0;
      var d = Math.hypot(A[0] + vx * t - x, A[1] + vy * t - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ---------------------------------------------------------------
  // FIXTURES — research artifacts, in one key of this browser's own
  // storage. Loading the page WRITES NOTHING; only a save does.
  // ---------------------------------------------------------------
  function readStore() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeStore(arr) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  function serialize() {
    var fig = figureOf(state);
    return {
      id: state.id, labVersion: LAB_VERSION,
      name: state.name || '', budget: state.budget,
      points: fig.points, joins: fig.joins, missing: fig.gaps,
      hint: state.hint || '', notes: state.notes || '',
      judgement: state.judgement || null,
      tease: !!state.tease
    };
  }

  function save() {
    var arr = readStore();
    var now = new Date().toISOString();
    var rec = serialize();
    if (!rec.id) {
      rec.id = 'shape-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
      rec.createdAt = now;
      state.id = rec.id;
    } else {
      var old = null;
      arr.forEach(function (r) { if (r.id === rec.id) old = r; });
      rec.createdAt = (old && old.createdAt) || now;
    }
    rec.updatedAt = now;
    var replaced = false;
    arr = arr.map(function (r) { if (r.id === rec.id) { replaced = true; return rec; } return r; });
    if (!replaced) arr.push(rec);
    var ok = writeStore(arr);
    emit();
    return { ok: ok, id: rec.id };
  }

  function hydrate(rec) {
    figureEpoch++;
    state.id = rec.id || null;
    state.budget = BUDGETS.indexOf(Number(rec.budget)) !== -1 ? Number(rec.budget) : 8;
    state.points = (rec.points || []).map(function (p) { return [clamp(p[0]), clamp(p[1])]; });
    var missing = rec.missing || [];
    state.joins = (rec.joins || []).map(function (j, i) {
      var ab = String(j).split('-').map(Number);
      return { a: Math.min(ab[0], ab[1]), b: Math.max(ab[0], ab[1]), gap: missing.indexOf(i) !== -1 };
    }).filter(function (j) { return state.points[j.a] && state.points[j.b] && j.a !== j.b; });
    // A fixture never exceeds its own budget: extra lights are REFUSED
    // rather than trimmed, so a hand-edited file cannot smuggle one in.
    if (state.points.length > state.budget) {
      state.points = []; state.joins = [];
      return { ok: false, reason: 'fixture-exceeds-budget' };
    }
    state.name = rec.name || ''; state.hint = rec.hint || ''; state.notes = rec.notes || '';
    state.judgement = rec.judgement || null;
    state.tease = !!rec.tease;
    pendingA = null;
    return { ok: true };
  }

  function load(id) {
    var rec = null;
    readStore().forEach(function (r) { if (r.id === id) rec = r; });
    if (!rec) return { ok: false, reason: 'no-such-fixture' };
    var r = hydrate(rec);
    emit();
    return r;
  }

  // Duplicate INTO a budget: the same lights and joins, a new fixture,
  // independent from the first. A budget too small for the figure is
  // refused — the copy is never trimmed to fit.
  function duplicate(id, toBudget) {
    var rec = null;
    readStore().forEach(function (r) { if (r.id === id) rec = r; });
    if (!rec) return { ok: false, reason: 'no-such-fixture' };
    var b = toBudget ? Number(toBudget) : rec.budget;
    if (BUDGETS.indexOf(b) === -1) return { ok: false, reason: 'not-a-budget' };
    if ((rec.points || []).length > b) return { ok: false, reason: 'figure-has-' + rec.points.length + '-lights' };
    var copy = JSON.parse(JSON.stringify(rec));
    copy.id = null; copy.budget = b; copy.judgement = null;
    delete copy.createdAt; delete copy.updatedAt;
    hydrate(copy);
    var r = save();
    return { ok: r.ok, id: r.id };
  }

  function remove(id) {
    var arr = readStore().filter(function (r) { return r.id !== id; });
    var ok = writeStore(arr);
    if (state.id === id) state.id = null;
    emit();
    return { ok: ok };
  }

  function list() { return readStore(); }

  function setJudgement(j) { state.judgement = j || null; emit(); }
  function setName(v) { state.name = String(v || ''); emit(); }
  function setHint(v) { state.hint = String(v || ''); emit(); }
  function setNotes(v) { state.notes = String(v || ''); emit(); }
  function setTease(v) { state.tease = !!v; emit(); }

  function exportJSON() {
    return JSON.stringify({ kind: 'vihu-shape-lab-fixtures', labVersion: LAB_VERSION,
                            exportedAt: new Date().toISOString(), fixtures: readStore() }, null, 2);
  }
  function importJSON(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, reason: 'not-json' }; }
    var incoming = Array.isArray(data) ? data : (data && data.fixtures);
    if (!Array.isArray(incoming)) return { ok: false, reason: 'no-fixtures' };
    var arr = readStore(), have = {};
    arr.forEach(function (r) { have[r.id] = 1; });
    var added = 0, refused = 0;
    incoming.forEach(function (r) {
      if (!r || typeof r !== 'object') { refused++; return; }
      if (BUDGETS.indexOf(Number(r.budget)) === -1 || (r.points || []).length > Number(r.budget)) { refused++; return; }
      if (!r.id || have[r.id]) r.id = 'shape-' + Date.now().toString(36) + '-' + (added + 1) + Math.floor(Math.random() * 1e4).toString(36);
      have[r.id] = 1;
      arr.push(r); added++;
    });
    writeStore(arr);
    emit();
    return { ok: true, added: added, refused: refused };
  }

  // Every fixture carrying this name, in budget order — the comparison
  // is the research output, and the tool only lays them side by side.
  function compare(name) {
    var n = String(name || '').trim().toLowerCase();
    return readStore().filter(function (r) { return String(r.name || '').trim().toLowerCase() === n; })
      .sort(function (a, b) { return a.budget - b.budget; });
  }
  function names() {
    var seen = {};
    readStore().forEach(function (r) { var n = String(r.name || '').trim(); if (n) seen[n] = 1; });
    return Object.keys(seen).sort();
  }

  // ---------------------------------------------------------------
  // THE PAGE
  // ---------------------------------------------------------------
  function el(sel) { return doc.querySelector(sel); }

  function wireCanvas(canvas) {
    function xy(ev) {
      var r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top, r.width, r.height];
    }
    canvas.addEventListener('pointerdown', function (ev) {
      var q = xy(ev), x = q[0], y = q[1], w = q[2], h = q[3];
      var pi = pointAt(x, y, w, h), ji;
      if (mode === 'add') {
        if (pi === -1) {
          var u = toUnit(x, y, w, h);
          var r = addPoint(u[0], u[1]);
          if (!r.ok) say('This budget is full — ' + state.budget + ' lights. Choose a larger budget or take one away.');
        }
      } else if (mode === 'move') {
        if (pi !== -1) { dragging = pi; canvas.setPointerCapture(ev.pointerId); }
      } else if (mode === 'delete') {
        if (pi !== -1) deletePoint(pi);
      } else if (mode === 'join') {
        if (pi !== -1) {
          if (pendingA === null || pendingA === pi) { pendingA = (pendingA === pi) ? null : pi; emit(); }
          else { toggleJoin(pendingA, pi); pendingA = null; emit(); }
        } else {
          ji = joinAt(x, y, w, h);
          if (ji !== -1) { state.joins.splice(ji, 1); emit(); }
        }
      } else if (mode === 'gap') {
        ji = joinAt(x, y, w, h);
        if (ji !== -1) toggleGap(ji);
      }
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (dragging === null) return;
      var q = xy(ev), u = toUnit(q[0], q[1], q[2], q[3]);
      movePoint(dragging, u[0], u[1]);
    });
    function up() { dragging = null; }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  function say(msg) {
    var n = el('[data-say]');
    if (!n) return;
    n.textContent = msg;
    n.hidden = !msg;
  }

  function fmtValidator(m) {
    if (!m.validator) return '—';
    if (m.validator.ok) return 'passes';
    return 'refused: ' + m.validator.reasons.join(', ');
  }

  function renderMetrics() {
    var m = metrics();
    var box = el('[data-metrics]');
    if (!box) return;
    var rows = [
      ['budget', m.budget + (m.aboveProduction ? ' — Lab research budget; the product performs ' + m.productionBudget : ' — the production budget')],
      ['points', m.points + ' / ' + m.budget + ' (' + m.percentUsed + '%)'],
      ['all points placed', m.allPlaced ? 'yes' : 'no'],
      ['connections', String(m.connections)],
      ['missing joins', String(m.missing)],
      ['connected components (unfinished)', String(m.components)],
      ['real validator', fmtValidator(m)]
    ];
    box.innerHTML = rows.map(function (r) {
      return '<div class="mrow"><span class="mk">' + r[0] + '</span><span class="mv">' + esc(r[1]) + '</span></div>';
    }).join('');
    var play = el('[data-play]');
    if (play) {
      var can = playable();
      play.disabled = !can;
      var why = el('[data-play-why]');
      if (why) {
        why.textContent = can ? '' :
          (m.aboveProduction
            ? 'The real Ether performs up to ' + m.productionBudget + ' lights. A ' + m.budget + '-light figure can be judged here and cannot be played there — the runtime is not changed by this tool.'
            : (m.missing === 0 ? 'Mark at least one join as missing — a figure with no gap is not unfinished.'
                               : 'The real validator refuses this figure: ' + (m.validator ? m.validator.reasons.join(', ') : '')));
      }
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var JUDGE_COMPLETE = ['unmistakable', 'recognisable', 'looks like a related animal', 'abstract', 'fails'];
  var JUDGE_UNFINISHED = ['recognisable and incomplete', 'recognisable but weak', 'abstract', 'fails'];

  function renderJudgement() {
    var box = el('[data-judgement]');
    if (!box) return;
    var j = state.judgement || {};
    function group(label, name, options, current) {
      return '<div class="jgroup"><div class="jlabel">' + label + '</div>' +
        options.map(function (o) {
          return '<label class="jopt"><input type="radio" name="' + name + '" value="' + esc(o) + '"' +
            (current === o ? ' checked' : '') + '> ' + esc(o) + '</label>';
        }).join('') + '</div>';
    }
    box.innerHTML =
      group('COMPLETED FIGURE', 'jComplete', JUDGE_COMPLETE, j.complete) +
      group('UNFINISHED FIGURE', 'jUnfinished', JUDGE_UNFINISHED, j.unfinished) +
      '<label class="jtext">What do I see?<textarea data-j="see">' + esc(j.see || '') + '</textarea></label>' +
      '<label class="jtext">What\'s missing?<textarea data-j="missing">' + esc(j.missing || '') + '</textarea></label>' +
      '<label class="jtext">Would I use this as a Creature Mystery?<textarea data-j="use">' + esc(j.use || '') + '</textarea></label>';
    box.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.addEventListener('change', function () {
        var jj = state.judgement || {};
        if (r.name === 'jComplete') jj.complete = r.value; else jj.unfinished = r.value;
        state.judgement = jj;
      });
    });
    box.querySelectorAll('textarea[data-j]').forEach(function (t) {
      t.addEventListener('input', function () {
        var jj = state.judgement || {};
        jj[t.getAttribute('data-j')] = t.value;
        state.judgement = jj;
      });
    });
  }

  function renderFixtures() {
    var box = el('[data-fixtures]');
    if (!box) return;
    var arr = readStore();
    if (!arr.length) { box.innerHTML = '<div class="note">No fixtures saved yet.</div>'; return; }
    var byName = {};
    arr.forEach(function (r) { var n = String(r.name || '').trim() || '(unnamed)'; (byName[n] = byName[n] || []).push(r); });
    box.innerHTML = Object.keys(byName).sort().map(function (n) {
      var rows = byName[n].sort(function (a, b) { return a.budget - b.budget; }).map(function (r) {
        var jud = r.judgement ? (r.judgement.complete || '—') + ' · ' + (r.judgement.unfinished || '—') : '—';
        return '<div class="frow' + (r.id === state.id ? ' open' : '') + '">' +
          '<span class="fb">' + r.budget + '</span>' +
          '<span class="fi">' + (r.points || []).length + ' lights · ' + (r.joins || []).length + ' joins · ' + (r.missing || []).length + ' missing</span>' +
          '<span class="fj">' + esc(jud) + '</span>' +
          '<button data-open="' + r.id + '">Open</button>' +
          '<select data-dup="' + r.id + '"><option value="">Duplicate to…</option>' +
            BUDGETS.map(function (b) { return '<option value="' + b + '">' + b + '</option>'; }).join('') + '</select>' +
          '<button data-del="' + r.id + '" class="quiet">Delete</button>' +
        '</div>';
      }).join('');
      return '<div class="fgroup"><div class="fname">' + esc(n) + '</div>' + rows + '</div>';
    }).join('');
    box.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () { load(b.getAttribute('data-open')); say(''); });
    });
    box.querySelectorAll('[data-dup]').forEach(function (s) {
      s.addEventListener('change', function () {
        if (!s.value) return;
        var r = duplicate(s.getAttribute('data-dup'), Number(s.value));
        say(r.ok ? 'Duplicated into a ' + s.value + '-light budget — a new, independent fixture, now open.' :
                   'Not duplicated: ' + r.reason.replace(/-/g, ' ') + '.');
        s.value = '';
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { remove(b.getAttribute('data-del')); });
    });
  }

  function renderCompare() {
    var box = el('[data-compare]'), sel = el('[data-compare-name]');
    if (!box || !sel) return;
    var current = sel.value;
    var ns = names();
    sel.innerHTML = '<option value="">— choose a creature —</option>' +
      ns.map(function (n) { return '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    if (!current) { box.innerHTML = '<div class="note">Save the same creature at more than one budget, then choose it here.</div>'; return; }
    var rows = compare(current);
    if (!rows.length) { box.innerHTML = '<div class="note">Nothing saved under that name.</div>'; return; }
    box.innerHTML = rows.map(function (r, i) {
      return '<div class="ctile"><div class="ctitle">' + r.budget + ' lights</div>' +
        '<canvas class="ccanvas" data-ci="' + i + '" data-state="complete"></canvas>' +
        '<canvas class="ccanvas" data-ci="' + i + '" data-state="unfinished"></canvas>' +
        '<div class="csub">' + (r.points || []).length + ' placed · ' + (r.missing || []).length + ' missing' +
          (r.judgement && r.judgement.complete ? ' · ' + esc(r.judgement.complete) : '') + '</div></div>';
    }).join('');
    box.querySelectorAll('canvas.ccanvas').forEach(function (c) {
      var r = rows[Number(c.getAttribute('data-ci'))];
      var s = { budget: r.budget, points: r.points, joins: (r.joins || []).map(function (j, k) {
        var ab = String(j).split('-').map(Number);
        return { a: ab[0], b: ab[1], gap: (r.missing || []).indexOf(k) !== -1 };
      }) };
      draw(c, s, { unfinished: c.getAttribute('data-state') === 'unfinished' });
    });
  }

  function render() {
    var cc = el('[data-canvas-complete]'), cu = el('[data-canvas-unfinished]');
    if (cc) draw(cc, state, { editing: true, numbers: showNumbers });
    if (cu) draw(cu, state, { unfinished: true });
    doc.querySelectorAll('[data-budget]').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-budget')) === state.budget);
    });
    var bl = el('[data-budget-label]');
    if (bl) bl.textContent = 'TESTING ' + state.budget + ' POINTS' + (state.budget > PRODUCTION_BUDGET ? ' — Lab research budget (production is ' + PRODUCTION_BUDGET + ')' : ' — the production budget');
    doc.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    var nm = el('[data-name]'); if (nm && nm.value !== state.name) nm.value = state.name;
    var hn = el('[data-hint]'); if (hn && hn.value !== state.hint) hn.value = state.hint;
    var nt = el('[data-notes]'); if (nt && nt.value !== state.notes) nt.value = state.notes;
    var tz = el('[data-tease]'); if (tz) tz.checked = !!state.tease;
    var op = el('[data-opened]'); if (op) op.textContent = state.id ? ('fixture ' + state.id) : 'unsaved figure';
    renderMetrics();
    if (judgedEpoch !== figureEpoch) { renderJudgement(); judgedEpoch = figureEpoch; }
    renderFixtures();
    renderCompare();
  }

  function wire() {
    var cc = el('[data-canvas-complete]');
    if (cc) wireCanvas(cc);
    doc.querySelectorAll('[data-budget]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = setBudget(Number(b.getAttribute('data-budget')));
        say(r.ok ? '' : 'The figure has ' + state.points.length + ' lights — more than that budget holds. Take some away first; nothing is trimmed for you.');
      });
    });
    doc.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); pendingA = null; emit(); });
    });
    var num = el('[data-numbers]');
    if (num) num.addEventListener('change', function () { showNumbers = num.checked; emit(); });
    var nm = el('[data-name]'); if (nm) nm.addEventListener('input', function () { state.name = nm.value; renderMetrics(); });
    var hn = el('[data-hint]'); if (hn) hn.addEventListener('input', function () { state.hint = hn.value; });
    var nt = el('[data-notes]'); if (nt) nt.addEventListener('input', function () { state.notes = nt.value; });
    var tz = el('[data-tease]'); if (tz) tz.addEventListener('change', function () { state.tease = tz.checked; });
    var rs = el('[data-reset]'); if (rs) rs.addEventListener('click', function () { reset(); say(''); });
    var dm = el('[data-demo]'); if (dm) dm.addEventListener('click', function () { demoRing(); say('A neutral ring at this budget — not a creature, only the tool working.'); });
    var sv = el('[data-save]'); if (sv) sv.addEventListener('click', function () {
      var r = save(); say(r.ok ? 'Saved as ' + r.id + '.' : 'Could not save — this browser refused storage.');
    });
    var nw = el('[data-new]'); if (nw) nw.addEventListener('click', function () {
      // The same figure, unsaved, so a variation can be saved beside
      // its original rather than over it.
      state.id = null; state.judgement = null; figureEpoch++; emit(); say('Detached from its fixture — Save will make a new one.');
    });
    var ex = el('[data-export]'); if (ex) ex.addEventListener('click', function () {
      var out = el('[data-export-out]'); if (out) { out.value = exportJSON(); out.hidden = false; out.select(); }
    });
    var im = el('[data-import]'); if (im) im.addEventListener('click', function () {
      var inp = el('[data-import-in]'); if (!inp) return;
      var r = importJSON(inp.value);
      say(r.ok ? 'Imported ' + r.added + ' fixture(s)' + (r.refused ? ', refused ' + r.refused : '') + '.' : 'Not imported: ' + r.reason + '.');
    });
    var cs = el('[data-compare-name]'); if (cs) cs.addEventListener('change', renderCompare);
    var play = el('[data-play]'); if (play) play.addEventListener('click', function () {
      if (!playable()) return;
      var cand = candidateFor(state);
      var Host = global.LabPreviewHost;
      if (!Host) { say('The preview host is not loaded.'); return; }
      // The hint travels BESIDE the candidate, never inside it; the
      // creature's name travels nowhere.
      var r = Host.open(cand, 'shape-' + (state.id || 'unsaved'), function () {}, 'play',
                        { hint: state.hint || '', tease: state.tease ? 'delayed' : false });
      say(r.ok ? '' : 'The browser refused the preview tab (popup blocked).');
    });
    global.addEventListener('resize', render);
    listeners.push(render);
    render();
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }

  global.ShapeLab = {
    BUDGETS: BUDGETS.slice(),
    PRODUCTION_BUDGET: PRODUCTION_BUDGET,
    STORE_KEY: STORE_KEY,
    LAB_VERSION: LAB_VERSION,
    // editing
    setBudget: setBudget, addPoint: addPoint, movePoint: movePoint, deletePoint: deletePoint,
    toggleJoin: toggleJoin, toggleGap: toggleGap, reset: reset, demoRing: demoRing,
    setMode: function (m) { mode = m; pendingA = null; emit(); },
    setName: setName, setHint: setHint, setNotes: setNotes, setTease: setTease,
    setJudgement: setJudgement,
    // reading
    state: function () { return JSON.parse(JSON.stringify(serialize())); },
    figure: function () { return figureOf(state); },
    metrics: function () { return metrics(); },
    playable: function () { return playable(); },
    candidateFor: function (rec) {
      if (!rec) return candidateFor(state);
      var s = { budget: rec.budget, points: rec.points, joins: (rec.joins || []).map(function (j, k) {
        var ab = String(j).split('-').map(Number);
        return { a: ab[0], b: ab[1], gap: (rec.missing || []).indexOf(k) !== -1 };
      }) };
      return candidateFor(s);
    },
    // fixtures
    save: save, load: load, duplicate: duplicate, remove: remove, list: list,
    compare: compare, names: names, exportJSON: exportJSON, importJSON: importJSON,
    // the suite's window
    draw: draw, render: render
  };
})(typeof window !== 'undefined' ? window : this);
