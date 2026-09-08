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
//   - It holds no animal image, no SVG and no tracing of any kind (the
//     suite scans for them). The whole question is what the point/line
//     language can express on its own. CREATE FROM CREATURE (a later
//     sprint, labReference.js) may lay a rough VECTOR sketch under this
//     canvas while a person is authoring — a validated blueprint of
//     ellipses and lines, never a bitmap — and that layer is hidden with
//     one press, is never on the unfinished pane, and has no field in a
//     fixture or a candidate to travel in. The judging state is still
//     the Ether figure alone.
//   - It computes no recognisability score and asks no model. The
//     judgement panel is checkboxes and words a researcher writes.
//   - It generates no geometry from a creature's name. The name is
//     researcher metadata: it is never in a candidate, never on the
//     canvas, never in the preview.
//   - It draws no curves. The Ether figure system has none — a join is
//     a straight segment between two lights — so offering one here
//     would show something the runtime cannot perform.
//
// THE PRODUCTION CEILING IS NOT CHANGED, AND IT IS NOT HIDDEN. Six
// authoring budgets — 8, 10, 12, 16, 18, 20 — and the product performs
// one of them. A figure above eight is drawn here in the Ether's
// language so it can be JUDGED, and the real validator's refusal is
// shown beside it in as many words. It can be played in the real Ether
// only when the real Ether can perform it; the tool never truncates,
// never clamps and never pretends.
//
// A BUDGET IS AN AUTHORING TARGET, NEVER A DESTRUCTIVE OPERATION.
// Choosing a smaller budget under a bigger figure keeps every light: the
// figure is shown to EXCEED the selected budget — in the header, in the
// metrics, beside Play — and the researcher takes lights away by hand if
// they want it to fit. Nothing is ever deleted or trimmed by a budget
// change. What a budget does bound is ADDING: a light beyond it is
// refused, and a fixture is saved only at or under its budget, which is
// what keeps a stored fixture honest (a hand-edited one over its budget
// is still refused on open and on import).
//
// APPROVE FIGURE freezes the authored figure as the research artifact:
// points, joins, gaps, the budget, and the semantic feature each light
// was accepted for — and nothing else. No outline, no sketch, no
// blueprint, no subject beyond the one word the author typed, nothing
// private. It activates nothing, publishes nothing and enters no pool.
//
// ONE UNIT SPACE, ONE SCALE, EVERY BUDGET. A figure is authored in the
// validator's own coordinate box (±1.4) and drawn at ONE fixed scale in
// the editor and in every comparison tile — so a 20-light figure and
// an 8-light figure are compared at the same size, and scale can never
// be used to flatter a budget.
//
// THE RESEARCHER WORKFLOW (the Shape Lab cleanup sprint). The page reads
// as one instrument in six stages — CREATE → SHAPE → CONNECT → REVEAL →
// TEST → APPROVE — and this file grew the four things that make that
// coherent rather than a rearrangement of buttons:
//   - AN AUTHORING HISTORY. Undo / Redo over the authored figure and the
//     reveal (points, roles, joins, gaps, budget, reveal features) —
//     snapshots taken BEFORE every mutating operation, a drag coalesced
//     into one step, and NEVER touched by a preview or a test state.
//     Loading a different figure clears it: history belongs to one
//     figure. It is not faked: undo restores exactly the snapshot.
//   - A SELECTION. In the Connect tool a light is selected, then another;
//     a click on a line SELECTS the connection (it no longer deletes it),
//     and explicit JOIN · UNJOIN · MISSING act on what is selected. The
//     pair gesture the product owner asked for is untouched: two lights
//     clicked connect, the same two clicked again disconnect.
//   - SCOPED RESETS that say what they reset: Reset points (back to the
//     starting points; connections and the reveal features anchored to
//     the removed lights go with them, said so), Reset connections
//     (joins and missing marks only; points stay), Reset reveal (the
//     reveal only; the puzzle stays), Reset everything (confirmed).
//   - A STATUS a person can read: BUILDING · READY TO TEST · READY TO
//     APPROVE · APPROVED, with one sentence saying what to do next in
//     workflow words, never a validator reason.
//
// A JOIN IS SAVED AS "a-b", NEVER AS A PAIR OF INTEGERS. A list of
// integer pairs is what a Magic Card's constellation looks like, and
// the Stars guard refuses that shape on sight (Decision 58). The
// figure contract's own spelling is used everywhere a figure leaves
// this file.

(function (global) {
  'use strict';

  var BUDGETS = [8, 10, 12, 16, 18, 20];
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
    roles: [],                   // per light: the feature name it was accepted for, or null — never geometry
    generated: null,             // { source: 'translation' | 'fixture', at, edited } — a label, never a lock
    origins: [],                 // per light: the suggested PLACE it was accepted at ([x,y]) or null — SESSION ONLY, never serialized
    joins: [],                   // [{a,b,gap}]
    approved: null,              // the frozen research artifact, or null once the figure changes
    name: '', hint: '', notes: '',
    judgement: null,
    tease: false,                // the delayed aid, OFF by default
    authoring: null,             // { subject, referenceUsed, source } — how the figure was made; never geometry
    // REVEAL-ONLY FEATURES (labReveal.js) — the PAYOFF, never the
    // puzzle: not lights, not joins, not gaps, never counted, never part
    // of completion. Kept beside the figure, drawn only on the reveal
    // preview canvas and in the Ether preview AFTER completion.
    reveal: { durationS: 4, features: [] }
  };
  var revealSeq = 0;             // mints reveal feature ids
  var revealEpoch = 0;           // bumped when the feature LIST changes (rows re-render)
  var revealPlay = null;         // { t0 } while the reveal preview is playing its sequence
  var revealAuthoring = true;    // show the features statically while authoring
  var revealDrag = null;         // { id, x, y } while a feature is being dragged
  var revealRaf = 0;
  var mode = 'add';              // add · move · delete · join · gap
  var pendingA = null;           // join mode: the first light chosen (= sel.a)
  var sel = { a: null, b: null, join: null };   // the Connect selection: a light, a pair, a connection
  var dragging = null;           // move mode
  var tested = false;            // a TEST state has been shown for this figure since its last change (UI only)
  var savedSnap = '';            // what the store / the opened fixture holds — for "unsaved changes"
  var armedOpen = null;          // a fixture id whose Open is waiting for a second press
  // THE AUTHORING HISTORY — undo / redo over the authored figure and
  // the reveal. Snapshots of the AUTHORED state only; a preview, a test
  // state, a judgement, a name or a note never enters it.
  var history = { past: [], future: [], max: 100, coalesce: false };
  var showNumbers = true;
  var listeners = [];
  var figureEpoch = 0;          // bumped when a different figure is opened
  var judgedEpoch = -1;

  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  function snapshot() {
    return JSON.stringify({ budget: state.budget, points: state.points, roles: state.roles, origins: state.origins, joins: state.joins, reveal: state.reveal, generated: state.generated });
  }
  // Record BEFORE a mutation. While a drag is coalescing, only its first
  // step is recorded; the rest ride on it.
  function record() {
    if (history.coalesce) return;
    history.past.push(snapshot());
    if (history.past.length > history.max) history.past.shift();
    history.future = [];
  }
  // A recorded step that changed nothing is not a step.
  function unrecordIfSame() {
    if (history.coalesce) return;
    if (history.past.length && history.past[history.past.length - 1] === snapshot()) history.past.pop();
  }
  function restore(snap) {
    var t = JSON.parse(snap);
    state.budget = t.budget; state.points = t.points; state.roles = t.roles; state.origins = t.origins;
    state.joins = t.joins; state.reveal = t.reveal;
    revealEpoch++; revealPlay = null; revealForced = null;
    clearSelection(); dragging = null;
    touch();
    // the GENERATED / EDITED label follows the history too — undoing the
    // one edit made to a generated figure gives GENERATED back
    state.generated = t.generated === undefined ? state.generated : (t.generated ? { source: t.generated.source, at: t.generated.at, edited: !!t.generated.edited } : null);
    emit();
  }
  function undo() {
    if (!history.past.length) return { ok: false, reason: 'nothing-to-undo' };
    history.future.push(snapshot());
    restore(history.past.pop());
    return { ok: true, undoLeft: history.past.length, redoLeft: history.future.length };
  }
  function redo() {
    if (!history.future.length) return { ok: false, reason: 'nothing-to-redo' };
    history.past.push(snapshot());
    restore(history.future.pop());
    return { ok: true, undoLeft: history.past.length, redoLeft: history.future.length };
  }
  function clearHistory() { history.past = []; history.future = []; history.coalesce = false; }
  function historyDepth() { return { undo: history.past.length, redo: history.future.length }; }
  function clearSelection() { sel = { a: null, b: null, join: null }; pendingA = null; }
  function isDirty() { return snapshot() !== savedSnap; }
  function clamp(v) { return Math.max(-COORD, Math.min(COORD, Math.round(v * 100) / 100)); }
  function key(a, b) { return Math.min(a, b) + '-' + Math.max(a, b); }

  // ---------------------------------------------------------------
  // EDITING
  // ---------------------------------------------------------------
  // The figure changed: an approval no longer describes it.
  // GENERATED vs AUTHORED. A figure the translation composed carries
  // `generated` — where it came from and whether a hand has touched it
  // since. It is a label on the status strip and in the fixture record,
  // never a lock: every tool works on a generated figure exactly as on an
  // authored one, and the first edit marks it GENERATED · EDITED rather
  // than taking anything away. Nothing here reads it to change behaviour.
  var nameGenerated = false;       // the current name came from a generation, not from the researcher
  function touch() { state.approved = null; tested = false; if (state.generated && !state.generated.edited) state.generated.edited = true; }
  function origin() { return !state.generated ? 'authored' : (state.generated.edited ? 'generated-edited' : 'generated'); }

  // THE SUGGESTED POINTS ARE THE STARTING FIGURE. Decided by the product
  // owner after the first real lion: "the suggested points are also part
  // of authored figure only." So the budgeted suggestions are PLACED as
  // real lights — each carrying the feature name it stands for — when a
  // reference arrives and when the budget grows, and from that instant
  // they are the author's: move them, delete them, add to them. This is
  // the ONE seam through which a suggestion becomes a light without a
  // press; joins and gaps are never placed for anybody, a light already
  // standing is never moved, and the budget still bounds it. Shrinking a
  // budget still deletes nothing.
  // A suggested place a light was accepted at, whether the light still
  // stands there or the author has since moved it. Session-only: it is
  // never serialized, so a reopened fixture starts with no origins.
  function originTaken(x, y) {
    return state.origins.some(function (o) { return o && Math.hypot(o[0] - x, o[1] - y) < 0.03; });
  }

  function placeSuggestions() {
    var Ref = global.LabReference;
    if (!Ref || !Ref.suggestions || !Ref.isShowing || !Ref.isShowing()) return { ok: false, reason: 'no-reference', placed: 0 };
    record();
    var placed = 0;
    Ref.suggestions().filter(function (x) { return x.budgeted; }).forEach(function (x) {
      if (state.points.length >= state.budget) return;
      if (state.points.some(function (p) { return Math.hypot(p[0] - x.x, p[1] - x.y) < 0.03; })) return;
      // A place the author accepted a light at and then MOVED it away
      // from is theirs: it is never re-placed behind them.
      if (originTaken(x.x, x.y)) return;
      state.points.push([clamp(x.x), clamp(x.y)]);
      state.roles.push(x.name ? String(x.name).toUpperCase().slice(0, 24) : null);
      state.origins.push([x.x, x.y]);
      placed++;
    });
    if (placed) { touch(); emit(); } else unrecordIfSame();
    return { ok: true, placed: placed };
  }

  // ONE GENERATED FIGURE, ONE HISTORY STEP. The translation's composer
  // hands over points (unit space), a role per point, a join list and
  // the budget it chose; this replaces the figure — points, connections
  // and reveal — in a single undoable step and marks it GENERATED. The
  // name is filled from the subject only while it is empty.
  function loadGenerated(fig) {
    if (!fig || !Array.isArray(fig.points) || !fig.points.length) return { ok: false, reason: 'no-figure' };
    var budget = BUDGETS.indexOf(Number(fig.budget)) !== -1 ? Number(fig.budget) : BUDGETS.filter(function (b) { return b >= fig.points.length; })[0] || BUDGETS[BUDGETS.length - 1];
    if (fig.points.length > budget) return { ok: false, reason: 'over-budget:' + budget };
    record();
    state.budget = budget;
    state.points = []; state.roles = []; state.origins = []; state.joins = [];
    state.reveal = { durationS: state.reveal.durationS, features: [] }; revealEpoch++; revealPlay = null; revealForced = null;
    clearSelection(); dragging = null;
    fig.points.forEach(function (p, i) {
      state.points.push([clamp(p[0]), clamp(p[1])]);
      var role = fig.roles && fig.roles[i] ? String(fig.roles[i]).toUpperCase().slice(0, 24) : null;
      state.roles.push(role); state.origins.push(null);
    });
    var seen = {};
    (fig.joins || []).forEach(function (j) {
      var a = Number(j.a), b = Number(j.b);
      if (!(a >= 0 && b >= 0 && a < state.points.length && b < state.points.length) || a === b) return;
      var k = key(a, b); if (seen[k]) return; seen[k] = true;
      state.joins.push({ a: Math.min(a, b), b: Math.max(a, b), gap: false });
    });
    state.approved = null; tested = false;
    state.generated = { source: fig.source === 'fixture' ? 'fixture' : 'translation', at: Date.now(), edited: false };
    // the understanding's subject names the figure unless the researcher
    // has typed a name themselves — a name a previous generation gave is
    // the generation's to replace
    if (fig.subject && (!state.name || nameGenerated)) { state.name = String(fig.subject).slice(0, 40); nameGenerated = true; }
    state.authoring = authoringOf({ subject: fig.subject || state.name || 'generated', referenceUsed: false, source: fig.source === 'fixture' ? 'fixture' : 'generated' });
    emit();
    return { ok: true, points: state.points.length, joins: state.joins.length, budget: budget };
  }

  function overBudget(s) { s = s || state; return Math.max(0, s.points.length - s.budget); }

  // A budget change is NEVER destructive. Choosing a smaller budget under
  // a bigger figure keeps every light and reports how many the figure is
  // over; the header, the metrics and Play say so, and the researcher
  // takes lights away by hand. Nothing is deleted, nothing is trimmed.
  function setBudget(b) {
    b = Number(b);
    if (BUDGETS.indexOf(b) === -1) return { ok: false, reason: 'not-a-budget' };
    var was = state.budget;
    if (was !== b) { record(); touch(); }
    state.budget = b;
    // A bigger budget opens more suggested places, and they are placed as
    // lights at once (the seam above); a smaller one places nothing and
    // deletes nothing.
    var placed = (b > was) ? placeSuggestions().placed : 0;
    var over = overBudget();
    emit();
    var out = { ok: true };
    if (placed) out.placed = placed;
    if (over) { out.overBudget = over; out.lights = state.points.length; }
    return out;
  }

  // `role` — the feature name a light was accepted for (from a suggested
  // point), or nothing for a light placed freehand. A word, never a place.
  function addPoint(x, y, role) {
    if (state.points.length >= state.budget) {
      return { ok: false, reason: 'budget-full:' + state.budget };
    }
    record();
    state.points.push([clamp(x), clamp(y)]);
    state.roles.push(role ? String(role).toUpperCase().slice(0, 24) : null);
    state.origins.push(role ? [clamp(x), clamp(y)] : null);
    touch();
    emit();
    return { ok: true, index: state.points.length - 1 };
  }

  function movePoint(i, x, y) {
    if (!state.points[i]) return { ok: false, reason: 'no-such-light' };
    record();
    state.points[i] = [clamp(x), clamp(y)];
    touch();
    emit();
    return { ok: true };
  }

  function deletePoint(i) {
    if (!state.points[i]) return { ok: false, reason: 'no-such-light' };
    record();
    var joinsGone = state.joins.filter(function (j) { return j.a === i || j.b === i; }).length;
    state.points.splice(i, 1);
    state.roles.splice(i, 1);
    state.origins.splice(i, 1);
    touch();
    // Joins touching the light go; every index above it steps down,
    // and a gap follows its own join.
    state.joins = state.joins.filter(function (j) { return j.a !== i && j.b !== i; })
      .map(function (j) {
        return { a: j.a > i ? j.a - 1 : j.a, b: j.b > i ? j.b - 1 : j.b, gap: !!j.gap };
      });
    clearSelection();
    // A reveal feature anchored to the deleted light has nowhere to be
    // and goes with it; every anchor above steps down with the light.
    var dropped = [];
    if (global.LabReveal) {
      var rv = global.LabReveal.onPointDeleted(state.reveal.features, i);
      if (rv.dropped.length) revealEpoch++;
      state.reveal.features = rv.features; dropped = rv.dropped;
    }
    emit();
    return { ok: true, droppedReveal: dropped, joinsRemoved: joinsGone };
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
    record();
    touch();
    if (i !== -1) { state.joins.splice(i, 1); if (sel.join !== null) sel.join = null; emit(); return { ok: true, removed: true }; }
    state.joins.push({ a: Math.min(a, b), b: Math.max(a, b), gap: false });
    emit();
    return { ok: true, added: true };
  }

  // JOIN IN ORDER. Asked for by the product owner: "the join button
  // should automatically join dots as per their order." Pressing the
  // Join tool joins consecutive lights — 1→2, 2→3, … — in the order they
  // stand (placement order, which for a placed starting figure is the
  // ranking's order). It only ADDS the consecutive joins that are
  // missing: an existing join is kept, a gap is kept, and nothing is
  // ever removed — the chain is left open (the author closes it, or
  // rearranges it, with the same click gestures as before).
  function joinInOrder() {
    record();
    var added = 0;
    for (var i = 0; i + 1 < state.points.length; i++) {
      if (findJoin(i, i + 1) !== -1) continue;
      state.joins.push({ a: i, b: i + 1, gap: false });
      added++;
    }
    if (added) { touch(); emit(); } else unrecordIfSame();
    return { ok: true, added: added, lights: state.points.length };
  }

  // A gap is EXPLICIT: the researcher names the join, nothing is
  // drawn at random.
  function toggleGap(joinIndex) {
    var j = state.joins[joinIndex];
    if (!j) return { ok: false, reason: 'no-such-join' };
    record();
    j.gap = !j.gap;
    touch();
    emit();
    return { ok: true, gap: j.gap };
  }

  function reset() {
    figureEpoch++;
    state.id = null;
    state.points = []; state.roles = []; state.origins = []; state.joins = []; state.approved = null;
    state.name = ''; state.hint = ''; state.notes = ''; nameGenerated = false;
    state.judgement = null; state.tease = false; state.authoring = null;
    state.generated = null;
    state.reveal = { durationS: 4, features: [] }; revealEpoch++; revealPlay = null; revealForced = null;
    clearSelection(); dragging = null; tested = false; armedOpen = null;
    clearHistory(); savedSnap = snapshot();
    emit();
  }

  // ---------------------------------------------------------------
  // SCOPED RESETS — each one says what it resets, and each is one
  // undoable step. Reset everything is the old reset(): it is the one
  // that starts the session over, and the page confirms it first.
  // ---------------------------------------------------------------
  // Back to the STARTING POINTS: every light goes, and with them every
  // connection and every reveal feature anchored to a light (a feature
  // with no light to stand on cannot exist). If a reference is showing,
  // its budgeted suggested points are placed again — the same starting
  // figure Generate gave. The reveal's hold time is kept.
  function resetPoints() {
    record();
    var hadReveal = state.reveal.features.length;
    state.points = []; state.roles = []; state.origins = []; state.joins = [];
    state.reveal = { durationS: state.reveal.durationS, features: [] }; revealEpoch++; revealPlay = null; revealForced = null;
    clearSelection(); dragging = null;
    touch();
    history.coalesce = true;                       // the re-placement rides on this one step
    var placed = 0;
    try { placed = placeSuggestions().placed || 0; } finally { history.coalesce = false; }
    emit();
    return { ok: true, placed: placed, revealDropped: hadReveal };
  }
  // Connections and missing marks only. Every point stays where it is;
  // the reveal is untouched (it is anchored to lights, not to joins).
  function resetConnections() {
    if (!state.joins.length) return { ok: true, removed: 0 };
    record();
    var n = state.joins.length;
    state.joins = [];
    clearSelection();
    touch();
    emit();
    return { ok: true, removed: n };
  }
  // The reveal only. The puzzle — points, connections, missing — stays.
  function resetReveal() {
    if (!state.reveal.features.length && state.reveal.durationS === 4) return { ok: true, removed: 0 };
    record();
    var n = state.reveal.features.length;
    state.reveal = { durationS: 4, features: [] }; revealEpoch++; revealPlay = null; revealForced = null;
    touch();
    emit();
    return { ok: true, removed: n };
  }

  // ---------------------------------------------------------------
  // THE CONNECT SELECTION — a light, then a pair, or a connection.
  // Explicit JOIN / UNJOIN / MISSING act on it; the pair gesture
  // (two lights clicked → connected; the same two again → disconnected)
  // is unchanged, and a click on a LINE selects it rather than removing
  // it, so removing a connection is always a deliberate second act.
  // ---------------------------------------------------------------
  function selection() {
    var j = sel.join !== null && state.joins[sel.join] ? state.joins[sel.join] : null;
    return { a: sel.a, b: sel.b, join: sel.join, joined: !!j, missing: !!(j && j.gap),
             canJoin: sel.a !== null && sel.b !== null && sel.a !== sel.b && findJoin(sel.a, sel.b) === -1,
             canUnjoin: !!j, canMissing: !!j };
  }
  function selectLight(i) {
    if (!state.points[i]) return { ok: false, reason: 'no-such-light' };
    if (sel.a === null || (sel.a !== null && sel.b !== null)) { sel = { a: i, b: null, join: null }; }
    else if (sel.a === i) { clearSelection(); }
    else {
      // the pair gesture: connect, or — already connected — disconnect;
      // either way the pair stays selected so JOIN / UNJOIN can answer it
      var a = sel.a, r = toggleJoin(a, i);
      sel = { a: a, b: i, join: r.added ? findJoin(a, i) : null };
    }
    pendingA = sel.a;
    emit();
    return { ok: true, selection: selection() };
  }
  function selectJoin(ji) {
    var j = state.joins[ji];
    if (!j) return { ok: false, reason: 'no-such-join' };
    sel = { a: j.a, b: j.b, join: ji }; pendingA = sel.a;
    emit();
    return { ok: true, selection: selection() };
  }
  function joinSelected() {
    var x = selection();
    if (!x.canJoin) return { ok: false, reason: 'select-two-lights' };
    var r = toggleJoin(sel.a, sel.b);
    sel.join = findJoin(sel.a, sel.b); pendingA = sel.a;
    emit();
    return { ok: r.ok && r.added, selection: selection() };
  }
  function unjoinSelected() {
    var x = selection();
    if (!x.canUnjoin) return { ok: false, reason: 'select-a-connection' };
    var j = state.joins[sel.join];
    var r = toggleJoin(j.a, j.b);
    sel = { a: j.a, b: j.b, join: null }; pendingA = sel.a;
    emit();
    return { ok: r.ok && r.removed, selection: selection() };
  }
  function toggleMissingSelected() {
    var x = selection();
    if (!x.canMissing) return { ok: false, reason: 'select-a-connection' };
    var r = toggleGap(sel.join);
    return { ok: r.ok, missing: r.gap, selection: selection() };
  }

  // ---------------------------------------------------------------
  // STATUS — where the researcher is, in workflow words. Never a
  // validator reason: those stay in Advanced / Research details.
  // ---------------------------------------------------------------
  function markTested() { tested = true; emit(); return { ok: true }; }
  function status() {
    var m = metrics();
    var Ref = global.LabReference;
    var refOn = !!(Ref && Ref.isShowing && Ref.isShowing());
    var name = String(state.name || (state.authoring && state.authoring.subject) || '').trim();
    var st = 'BUILDING', next = '';
    if (state.approved) { st = 'APPROVED'; next = 'Frozen as approved. Save the fixture to keep it; editing anything clears the approval.'; }
    else if (!m.points) { next = refOn ? 'Place points: the suggested points are a starting figure — accept them, move them, or add your own.' : 'Add points on the AUTHOR pane, or generate a reference to start from.'; }
    else if (m.overBudget) { next = 'Over the ' + m.budget + '-point budget by ' + m.overBudget + ' — delete ' + m.overBudget + ' point' + (m.overBudget === 1 ? '' : 's') + ', or choose a bigger budget. Nothing is removed for you.'; }
    else if (m.points < 2) { next = 'Add at least one more point, then connect them.'; }
    else if (m.connections === 0) { next = 'Connect the points — the Connect tool joins them in order, then select two points to change a connection.'; }
    else if (m.missing === 0) { next = 'Leave one connection missing — that is what the child completes.'; }
    else if (!tested) { st = 'READY TO TEST'; next = 'Test it: UNFINISHED, then COMPLETE, then COME ALIVE.' + (m.aboveProduction ? ' (This budget tests here; the real Ether performs up to ' + m.productionBudget + ' points.)' : ''); }
    else { st = 'READY TO APPROVE'; next = 'Looks right? Approve the creature, then save the fixture.'; }
    return {
      name: name, origin: origin(),
      points: m.points, connections: m.connections, missing: m.missing, reveal: state.reveal.features.length,
      budget: m.budget, overBudget: m.overBudget, state: st, next: next, tested: tested, dirty: isDirty(),
      line: m.points + ' POINT' + (m.points === 1 ? '' : 'S') + ' · ' + m.connections + ' CONNECTED · ' + m.missing + ' MISSING' + (state.reveal.features.length ? ' · ' + state.reveal.features.length + ' REVEAL' : '')
    };
  }

  // A NEUTRAL DEMONSTRATION SHAPE, and deliberately not a creature: a
  // ring of lights around the budget, so the tool can be shown working
  // without anybody having chosen an animal for the researcher.
  function demoRing() {
    figureEpoch++;
    state.points = []; state.roles = []; state.origins = []; state.joins = []; state.approved = null; pendingA = null;
    state.reveal = { durationS: 4, features: [] }; revealEpoch++; revealPlay = null;
    var n = state.budget;
    for (var i = 0; i < n; i++) {
      var t = -Math.PI / 2 + (i / n) * Math.PI * 2;
      state.points.push([clamp(Math.cos(t) * 1.0), clamp(Math.sin(t) * 1.0)]);
      state.roles.push(null);
    }
    for (var k = 0; k < n; k++) state.joins.push({ a: Math.min(k, (k + 1) % n), b: Math.max(k, (k + 1) % n), gap: false });
    state.joins[0].gap = true;
    clearSelection(); clearHistory(); tested = false;
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
      overBudget: overBudget(s),
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
    return !!(m.validator && m.validator.ok && m.missing > 0 && !m.overBudget);
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
    if (opts.transparent) {
      // A reference underlay is showing beneath this canvas: paint no
      // sky, so it shows through. Everything else draws exactly as it does
      // on an opaque sky.
      g.clearRect(0, 0, w, h);
    } else {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#161C33'); grad.addColorStop(1, '#1E2440');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }

    var P = s.points.map(function (p) { return toScreen(p, w, h); });
    var lw = Math.max(1.2, Math.min(w, h) / 420);
    g.lineCap = 'round';
    s.joins.forEach(function (j) {
      if (!P[j.a] || !P[j.b]) return;
      if (j.gap && opts.unfinished) return;              // the unfinished figure: nothing at all
      var selected = opts.editing && s === state && sel.join !== null && state.joins[sel.join] === j;
      g.strokeStyle = selected ? 'rgba(255,210,122,.95)' : ((j.gap && opts.editing) ? LINE_MISSING : LINE);
      g.lineWidth = selected ? lw * 2.2 : lw;
      if (j.gap && opts.editing) g.setLineDash([4, 6]); else g.setLineDash([]);
      g.beginPath(); g.moveTo(P[j.a][0], P[j.a][1]); g.lineTo(P[j.b][0], P[j.b][1]); g.stroke();
    });
    g.setLineDash([]);
    var r = Math.max(9, Math.min(w, h) / 34), core = Math.max(2.6, Math.min(w, h) / 130);
    // THE STARTING POINT ON THE BARE SKY. Asked for by the product owner:
    // the unfinished pane was empty until a light was placed, while the
    // suggested points stood only on the reference layer — so there was
    // no way to see how the suggested figure reads WITHOUT the outline
    // under it. The pane now marks the current suggestions faintly on its
    // own opaque sky: no outline, no labels, plainly not lights (a dashed
    // ring, never a solid core), gone one by one as they are accepted,
    // and gone altogether with the reference or the suggestions switch.
    // They are still never placed, never in the figure, never in a
    // fixture or a candidate: what the pane draws is a preview of where a
    // light COULD go, and only the author's press makes one.
    if (opts.suggest) drawSuggestedMarks(g, w, h);
    P.forEach(function (p, i) {
      var rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      rg.addColorStop(0, HALO + '.34)'); rg.addColorStop(1, HALO + '0)');
      g.fillStyle = rg; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
      var picked = opts.editing && s === state && (sel.a === i || sel.b === i);
      if (picked) {
        // the selected light: a gold ring around it, obvious at a glance
        g.strokeStyle = 'rgba(255,210,122,.95)'; g.lineWidth = 2; g.setLineDash([]);
        g.beginPath(); g.arc(p[0], p[1], core + 6, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = picked ? '#ffd27a' : CORE;
      g.beginPath(); g.arc(p[0], p[1], core, 0, Math.PI * 2); g.fill();
      if (opts.editing && opts.numbers) {
        g.fillStyle = 'rgba(241,234,208,.55)';
        g.font = Math.max(10, Math.min(w, h) / 44) + 'px ui-monospace, monospace';
        g.textAlign = 'left';
        g.fillText(String(i), p[0] + core + 4, p[1] - core - 3);
      }
    });
  }

  function drawSuggestedMarks(g, w, h) {
    var Ref = global.LabReference;
    if (!Ref || !Ref.suggestions) return;
    var sg = Ref.suggestions();
    var base = Math.max(5, Math.min(w, h) / 66);
    sg.forEach(function (s) {
      var q = toScreen([s.x, s.y], w, h);
      var lv = s.level || 1, rr = base * (lv === 1 ? 1.0 : lv === 2 ? 0.85 : 0.7);
      g.setLineDash([3, 4]);
      g.strokeStyle = 'rgba(206,222,255,' + (lv === 1 ? 0.5 : 0.36) + ')'; g.lineWidth = 1;
      g.beginPath(); g.arc(q[0], q[1], rr, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(206,222,255,.3)';
      g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, rr / 3.4), 0, Math.PI * 2); g.fill();
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
      tease: !!state.tease,
      // How the figure was made — a subject the author typed and whether
      // a reference was used. Words only: no sketch, no anchors, no
      // feature list ever lands here.
      authoring: authoringOf(state.authoring),
      generated: state.generated ? { source: state.generated.source, at: state.generated.at, edited: !!state.generated.edited } : null,
      // Per light, the feature it was accepted for — a word or null.
      roles: rolesOf(state),
      // REVEAL-ONLY VISUAL FEATURES — explicit and deterministic, kept
      // apart from the puzzle geometry above. Never a light, a join or a
      // gap; never in a candidate.
      reveal: revealOf(),
      // The frozen research artifact, when the figure has been approved
      // and not changed since.
      approved: state.approved ? JSON.parse(JSON.stringify(state.approved)) : null
    };
  }

  function rolesOf(s) {
    var out = [];
    for (var i = 0; i < s.points.length; i++) out.push(s.roles && s.roles[i] ? String(s.roles[i]).toUpperCase().slice(0, 24) : null);
    return out;
  }

  function authoringOf(a) {
    if (!a || typeof a !== 'object') return null;
    var subject = String(a.subject || '').slice(0, 40);
    if (!subject) return null;
    return { subject: subject, referenceUsed: !!a.referenceUsed, source: a.source === 'generated' ? 'generated' : 'fixture' };
  }
  function setAuthoring(a) { state.authoring = authoringOf(a); emit(); }

  function save() {
    // A fixture is saved only at or under its budget. A figure that
    // exceeds the budget is kept whole on screen — that is what a budget
    // change promises — and Save says so rather than storing something a
    // reopen would refuse.
    if (overBudget()) return { ok: false, reason: 'figure-exceeds-budget:' + state.points.length + '>' + state.budget };
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
    if (ok) savedSnap = snapshot();
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
      state.points = []; state.joins = []; state.roles = []; state.origins = [];
      clearSelection(); clearHistory();
      return { ok: false, reason: 'fixture-exceeds-budget' };
    }
    state.name = rec.name || ''; state.hint = rec.hint || ''; state.notes = rec.notes || '';
    state.judgement = rec.judgement || null;
    state.tease = !!rec.tease;
    state.authoring = authoringOf(rec.authoring);
    state.generated = rec.generated && typeof rec.generated === 'object' ? { source: rec.generated.source === 'fixture' ? 'fixture' : 'translation', at: Number(rec.generated.at) || 0, edited: !!rec.generated.edited } : null;
    state.roles = rolesOf({ points: state.points, roles: Array.isArray(rec.roles) ? rec.roles : [] });
    state.origins = state.points.map(function () { return null; });
    // The reveal block is REFUSED rather than trimmed when it is not
    // what the vocabulary allows — a hand-edited fixture cannot smuggle
    // an unknown key, a forbidden name or an anchor past the figure.
    var rv = global.LabReveal ? global.LabReveal.sanitize(rec.reveal, state.points.length)
                              : { ok: rec.reveal === undefined, reasons: ['no-reveal-module'], durationS: 4, features: [] };
    if (!rv.ok) {
      state.points = []; state.joins = []; state.roles = []; state.origins = [];
      state.reveal = { durationS: 4, features: [] }; revealEpoch++;
      return { ok: false, reason: 'reveal-refused:' + rv.reasons.join(',') };
    }
    state.reveal = { durationS: rv.durationS, features: rv.features };
    revealSeq = Math.max(revealSeq, state.reveal.features.length);
    revealEpoch++; revealPlay = null;
    state.approved = approvedOf(rec.approved, state);
    clearSelection(); clearHistory(); tested = false; armedOpen = null;
    savedSnap = snapshot();
    return { ok: true };
  }

  // A stored approval is honoured only while it still describes the
  // stored figure; anything else is dropped rather than trusted.
  function approvedOf(a, s) {
    if (!a || typeof a !== 'object' || a.kind !== APPROVED_KIND) return null;
    var fig = figureOf(s);
    if (JSON.stringify(a.points) !== JSON.stringify(fig.points) || JSON.stringify(a.joins) !== JSON.stringify(fig.joins) ||
        JSON.stringify(a.missing) !== JSON.stringify(fig.gaps) || Number(a.budget) !== s.budget) return null;
    // The approval covers the reveal too: a feature added, moved or
    // retimed since is a different artifact.
    var mine = JSON.stringify(revealOf(s));
    var theirs = a.reveal ? JSON.stringify({ durationS: a.reveal.durationS, features: a.reveal.features }) : JSON.stringify({ durationS: 4, features: [] });
    if (mine !== theirs) return null;
    return JSON.parse(JSON.stringify(a));
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

  // ---------------------------------------------------------------
  // APPROVE FIGURE — freeze the authored figure as the research artifact.
  // What it holds: the points, the joins, which joins are gaps, the
  // budget it was authored at, and per light the feature it was accepted
  // for (a word), plus the researcher's name for it and the subject they
  // typed. What it cannot hold, by construction: an outline, a sketch,
  // a blueprint, a landmark, an anchor, anything private, anything of the
  // Ether's. It is stored ON the fixture, exported through the existing
  // export, and shown in an APPROVED FIGURE state. Approving activates
  // nothing, publishes nothing, and makes no hint, gap, challenge,
  // completion, awakening, roaming or pool entry.
  // ---------------------------------------------------------------
  var APPROVED_KIND = 'vihu-shape-lab-approved-figure';
  var REVEAL_KIND = 'vihu-shape-lab-reveal-only-features';

  function approve() {
    if (!state.points.length) return { ok: false, reason: 'no-lights' };
    if (overBudget()) return { ok: false, reason: 'figure-exceeds-budget:' + state.points.length + '>' + state.budget };
    var fig = figureOf(state);
    var roles = rolesOf(state);
    var art = {
      kind: APPROVED_KIND,
      labVersion: LAB_VERSION,
      approvedAt: new Date().toISOString(),
      name: state.name || '',
      subject: state.authoring && state.authoring.subject ? state.authoring.subject : '',
      budget: state.budget,
      points: fig.points, joins: fig.joins, missing: fig.gaps,
      // semantic feature associations: light index → feature name
      roles: roles.map(function (r, i) { return r ? { light: i, feature: r } : null; }).filter(Boolean),
      // WHAT EACH PART OF THIS ARTIFACT IS. `points`, `joins`, `missing`,
      // `roles` and `budget` are the AUTHORED PUZZLE GEOMETRY — what a
      // child completes. `reveal` is the REVEAL-ONLY VISUAL FEATURES —
      // what appears for a few seconds after they do, and never a light,
      // a join, a gap or a condition.
      sections: { puzzle: ['budget', 'points', 'joins', 'missing', 'roles'], reveal: ['reveal'] },
      reveal: {
        kind: REVEAL_KIND,
        note: 'Reveal-only visual features: not lights, not joins, not gaps; never counted toward the budget or toward completion; shown only after the figure is complete, then faded.',
        durationS: state.reveal.durationS,
        features: revealOf().features
      }
    };
    state.approved = art;
    emit();
    return { ok: true, approved: JSON.parse(JSON.stringify(art)) };
  }

  function exportApproved() {
    if (!state.approved) return null;
    return JSON.stringify(state.approved, null, 2);
  }

  function setJudgement(j) { state.judgement = j || null; emit(); }
  function setName(v) { state.name = String(v || ''); nameGenerated = false; emit(); }
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
      if (global.LabReveal && !global.LabReveal.sanitize(r.reveal, (r.points || []).length).ok) { refused++; return; }
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
  // REVEAL-ONLY FEATURES — THE PAYOFF, AUTHORED BESIDE THE PUZZLE.
  //
  // DOTS + JOINS are the challenge; these are what a completed creature
  // is answered with. They live in `state.reveal`, apart from the
  // figure: never a light, never a join, never a gap, never counted
  // toward the budget, never part of completion, never in a candidate.
  // The two judging panes never draw them. They are drawn on ONE canvas
  // of their own — the reveal preview — and in the Ether preview only
  // AFTER the figure is whole. labReveal.js owns what a feature IS and
  // how it is drawn; this file only keeps the list beside the figure,
  // lets the researcher edit it, and shows it.
  //
  // A feature is anchored to the author's own lights (labReveal.js
  // frameOf): move the head light and the mane moves with it. The
  // blueprint outline is never an anchor — it was an authoring
  // reference, and the author's figure is authoritative.
  // ---------------------------------------------------------------
  var revealForced = null;       // 'unfinished' | 'complete' | 'reveal' | 'after' — a state the suite asked to see
  var revealLast = { phase: 'idle', painted: 0, ms: 0 };
  var revealRowsEpoch = -1;
  var revealSelectsKey = '';

  function revealOf(s) {
    s = s || state;
    var r = s.reveal || { durationS: 4, features: [] };
    return { durationS: r.durationS, features: JSON.parse(JSON.stringify(r.features)) };
  }

  function revealIndex(id) {
    for (var i = 0; i < state.reveal.features.length; i++) if (state.reveal.features[i].id === id) return i;
    return -1;
  }

  // Every change goes through the sanitizer — the ONE authority on what
  // a feature may be — so the list can never hold what a fixture would
  // refuse.
  function revealCommit(list, durationS) {
    var R = global.LabReveal;
    if (!R) return { ok: false, reason: 'no-reveal-module' };
    var chk = R.sanitize({ durationS: durationS, features: list }, state.points.length);
    if (!chk.ok) return { ok: false, reason: chk.reasons.join(',') };
    record();
    state.reveal = { durationS: chk.durationS, features: chk.features };
    revealForced = null;
    touch();
    emit();
    return { ok: true };
  }

  function addReveal(type, a, b, name) {
    var R = global.LabReveal;
    if (!R) return { ok: false, reason: 'no-reveal-module' };
    if (!state.points.length) return { ok: false, reason: 'no-lights' };
    if (state.reveal.features.length >= R.LIMITS.featuresMax) return { ok: false, reason: 'too-many-features:' + R.LIMITS.featuresMax };
    a = (Number.isInteger(a) && state.points[a]) ? a : 0;
    b = (Number.isInteger(b) && state.points[b] && b !== a) ? b : null;
    var f;
    do { revealSeq++; f = R.make(type, a, b, name, revealSeq); } while (revealIndex(f.id) !== -1);
    var r = revealCommit(state.reveal.features.concat([f]), state.reveal.durationS);
    if (!r.ok) return r;
    revealEpoch++; emit();
    var added = state.reveal.features[state.reveal.features.length - 1];
    return { ok: true, id: added.id, feature: JSON.parse(JSON.stringify(added)) };
  }

  function updateReveal(id, patch) {
    var R = global.LabReveal;
    if (!R) return { ok: false, reason: 'no-reveal-module' };
    var idx = revealIndex(id);
    if (idx === -1) return { ok: false, reason: 'no-such-feature' };
    patch = patch || {};
    var f = JSON.parse(JSON.stringify(state.reveal.features[idx]));
    var rows = false;
    if (patch.type !== undefined && patch.type !== f.type) { f.type = patch.type; f.params = R.defaults(patch.type); rows = true; }
    if (patch.name !== undefined) f.name = patch.name;
    if (patch.lights) {
      if (patch.lights.a !== undefined) f.lights.a = patch.lights.a;
      if (patch.lights.b !== undefined) f.lights.b = patch.lights.b;
      rows = true;
    }
    if (patch.offset !== undefined) f.offset = patch.offset;
    if (patch.size !== undefined) f.size = patch.size;
    if (patch.angle !== undefined) f.angle = patch.angle;
    if (patch.params && typeof patch.params === 'object') {
      Object.keys(patch.params).forEach(function (k) { f.params[k] = patch.params[k]; });
    }
    var list = state.reveal.features.map(function (g, i) { return i === idx ? f : g; });
    var r = revealCommit(list, state.reveal.durationS);
    if (!r.ok) return r;
    if (rows) { revealEpoch++; emit(); }
    return { ok: true, feature: JSON.parse(JSON.stringify(state.reveal.features[idx])) };
  }

  function removeReveal(id) {
    var idx = revealIndex(id);
    if (idx === -1) return { ok: false, reason: 'no-such-feature' };
    var list = state.reveal.features.filter(function (g, i) { return i !== idx; });
    var r = revealCommit(list, state.reveal.durationS);
    if (!r.ok) return r;
    revealEpoch++; emit();
    return { ok: true };
  }

  function setRevealDuration(sec) {
    var r = revealCommit(state.reveal.features, Number(sec));
    return r.ok ? { ok: true, durationS: state.reveal.durationS } : r;
  }

  // ---- the reveal preview canvas ----
  // The COMPLETE figure on its own opaque sky, and over it the reveal
  // features — statically while authoring (so they can be placed), on
  // the timeline while ▶ Play reveal runs, and not at all in 'plain'.
  // Never the outline, never the reference, never a suggestion.
  function drawRevealCanvas(now) {
    var c = el('[data-canvas-reveal]');
    if (!c) return;
    var R = global.LabReveal;
    var forced = revealForced;
    var unfinished = forced === 'unfinished';
    draw(c, state, { unfinished: unfinished });
    if (!R) return;
    var w = c.clientWidth || c.width, h = c.clientHeight || c.height;
    var g = c.getContext('2d');
    var P = state.points.map(function (p) { return toScreen(p, w, h); });
    var feats = state.reveal.features, n = feats.length;
    var envFor = null, phase = 'authoring', ms = 0, t = (now || 0) / 1000;
    if (forced) {
      if (forced === 'reveal') { envFor = null; t = 0; phase = 'reveal'; }
      else { revealLast = { phase: forced, painted: 0, ms: 0 }; return; }
    } else if (revealPlay) {
      ms = (now || 0) - revealPlay.t0;
      var dur = state.reveal.durationS;
      var total = R.totalMs(n, dur);
      if (ms >= total || !n) {
        // Gone. The plain figure stands until the next edit or toggle —
        // exactly what a child is left with — rather than snapping back
        // to the authoring view.
        revealPlay = null;
        revealForced = 'after';
        draw(c, state, {});
        revealLast = { phase: 'done', painted: 0, ms: ms };
        return;
      }
      envFor = function (i) { return R.envelope(ms, i, n, dur); };
      phase = envFor(0).phase;
      if (phase === 'in' || phase === 'hold') { var last = envFor(n - 1).phase; if (last === 'response' || last === 'in') phase = 'in'; }
    } else if (!revealAuthoring) {
      revealLast = { phase: 'plain', painted: 0, ms: 0 };
      return;
    }
    var painted = R.draw(g, feats, P, t, envFor);
    // Authoring handles: a small ring at each feature's origin, so it
    // can be dragged. Never drawn while playing or when asked for a
    // child's-eye state.
    if (!revealPlay && !forced) {
      feats.forEach(function (f) {
        var o = R.originOf(f, P);
        if (!o) return;
        g.setLineDash([3, 3]);
        g.strokeStyle = revealDrag && revealDrag.id === f.id ? 'rgba(255,214,122,.9)' : 'rgba(206,222,255,.55)';
        g.lineWidth = 1;
        g.beginPath(); g.arc(o[0], o[1], 9, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(206,222,255,.7)';
        g.font = '10px ui-monospace, monospace'; g.textAlign = 'left';
        g.fillText(f.name.toLowerCase(), o[0] + 12, o[1] + 4);
      });
    }
    revealLast = { phase: phase, painted: painted, ms: Math.round(ms) };
  }

  function revealLoop(now) {
    revealRaf = 0;
    drawRevealCanvas(now);
    if (revealPlay || (revealAuthoring && !revealForced && state.reveal.features.length)) {
      revealRaf = global.requestAnimationFrame(revealLoop);
    }
  }
  function ensureRevealLoop() {
    if (revealRaf || !global.requestAnimationFrame) { if (!revealRaf) drawRevealCanvas(0); return; }
    revealRaf = global.requestAnimationFrame(revealLoop);
  }

  function revealStart() {
    if (!state.reveal.features.length) return { ok: false, reason: 'no-features' };
    revealForced = null;
    revealPlay = { t0: (global.performance && global.performance.now) ? global.performance.now() : Date.now() };
    ensureRevealLoop();
    return { ok: true, totalMs: global.LabReveal ? global.LabReveal.totalMs(state.reveal.features.length, state.reveal.durationS) : 0 };
  }
  function revealStop() { revealPlay = null; drawRevealCanvas(0); return { ok: true }; }

  // A named state, drawn at once — the four the critical visual test
  // asks for: 'unfinished', 'complete', 'reveal' (held at full light),
  // 'after' (the reveal gone: pixel-identical with 'complete'). null
  // returns the canvas to authoring.
  function revealShow(name) {
    revealPlay = null;
    revealForced = (name === 'unfinished' || name === 'complete' || name === 'reveal' || name === 'after') ? name : null;
    drawRevealCanvas(0);
    if (!revealForced) ensureRevealLoop();
    return { ok: true, state: revealForced || 'authoring', painted: revealLast.painted };
  }

  function revealStatus() {
    return {
      phase: revealLast.phase, painted: revealLast.painted, ms: revealLast.ms,
      playing: !!revealPlay, authoring: revealAuthoring, forced: revealForced,
      features: state.reveal.features.length, durationS: state.reveal.durationS
    };
  }

  // ---- the rows ----
  function lightOptions(selected, allowCentre) {
    var out = allowCentre ? '<option value=""' + (selected === null ? ' selected' : '') + '>centre of figure</option>' : '';
    state.points.forEach(function (p, i) {
      out += '<option value="' + i + '"' + (selected === i ? ' selected' : '') + '>' + i + (state.roles[i] ? ' · ' + esc(state.roles[i].toLowerCase()) : '') + '</option>';
    });
    return out;
  }

  function paramInput(type, k, v) {
    var spec = global.LabReveal.PARAMS[type][k];
    if (spec.options) {
      return '<label class="rvp">' + esc(spec.label) + '<select data-rv-param="' + k + '">' +
        spec.options.map(function (o) { return '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
    }
    if (spec.bool) return '<label class="rvp rvb"><input type="checkbox" data-rv-param="' + k + '"' + (v ? ' checked' : '') + '> ' + esc(spec.label) + '</label>';
    return '<label class="rvp">' + esc(spec.label) + '<input type="number" data-rv-param="' + k + '" value="' + v + '" min="' + spec.min + '" max="' + spec.max + '" step="' + spec.step + '"></label>';
  }

  function renderRevealRows() {
    var box = el('[data-reveal-list]');
    var R = global.LabReveal;
    if (!box || !R) return;
    var feats = state.reveal.features;
    if (!feats.length) { box.innerHTML = '<div class="note">No reveal-only features yet. They are the payoff, not the puzzle: add one, place it on the figure below, and press ▶ Play reveal to see it arrive after completion.</div>'; return; }
    box.innerHTML = feats.map(function (f) {
      return '<div class="rvrow" data-rv="' + esc(f.id) + '">' +
        '<div class="rvhead">' +
          '<input type="text" class="rvname" data-rv-name value="' + esc(f.name) + '" maxlength="24" title="name — a label, never shown to a child">' +
          '<select data-rv-type title="visual type">' + R.TYPES.map(function (t) { return '<option value="' + t + '"' + (t === f.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
          '<label class="rvp">at point<select data-rv-a>' + lightOptions(f.lights.a, false) + '</select></label>' +
          '<label class="rvp">toward<select data-rv-b>' + lightOptions(f.lights.b, true) + '</select></label>' +
          '<button class="quiet" data-rv-del title="delete this feature">×</button>' +
        '</div>' +
        '<div class="rvbody">' +
          '<label class="rvp">offset x<input type="number" data-rv-off="0" value="' + f.offset[0] + '" step="0.05" min="-2" max="2"></label>' +
          '<label class="rvp">offset y<input type="number" data-rv-off="1" value="' + f.offset[1] + '" step="0.05" min="-2" max="2"></label>' +
          '<label class="rvp">size<input type="number" data-rv-size value="' + f.size + '" step="0.05" min="0.2" max="4"></label>' +
          '<label class="rvp">angle °<input type="number" data-rv-angle value="' + f.angle + '" step="5" min="-180" max="180"></label>' +
          Object.keys(R.PARAMS[f.type]).map(function (k) { return paramInput(f.type, k, f.params[k]); }).join('') +
        '</div>' +
      '</div>';
    }).join('');
    box.querySelectorAll('.rvrow').forEach(function (row) {
      var id = row.getAttribute('data-rv');
      function num(elm) { var v = Number(elm.value); return isFinite(v) ? v : 0; }
      row.querySelector('[data-rv-name]').addEventListener('input', function (ev) {
        var r = updateReveal(id, { name: ev.target.value });
        if (!r.ok) say(/forbidden-name/.test(r.reason) ? 'That name carries a word a visual detail may not: choose another.' : (/bad-name/.test(r.reason) ? 'A feature needs a name — letters and spaces.' : 'Not changed: ' + r.reason));
      });
      row.querySelector('[data-rv-type]').addEventListener('change', function (ev) { updateReveal(id, { type: ev.target.value }); });
      row.querySelector('[data-rv-a]').addEventListener('change', function (ev) {
        var a = Number(ev.target.value);
        var r = updateReveal(id, { lights: { a: a } });
        if (!r.ok) { say('A feature cannot point at the light it stands on — choose another light, or the centre.'); renderRevealRows(); }
      });
      row.querySelector('[data-rv-b]').addEventListener('change', function (ev) {
        var b = ev.target.value === '' ? null : Number(ev.target.value);
        var r = updateReveal(id, { lights: { b: b } });
        if (!r.ok) { say('A feature cannot point at the light it stands on — choose another light, or the centre.'); renderRevealRows(); }
      });
      row.querySelectorAll('[data-rv-off]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var f = state.reveal.features[revealIndex(id)]; if (!f) return;
          var off = [f.offset[0], f.offset[1]]; off[Number(inp.getAttribute('data-rv-off'))] = num(inp);
          updateReveal(id, { offset: off });
        });
      });
      row.querySelector('[data-rv-size]').addEventListener('input', function (ev) { updateReveal(id, { size: num(ev.target) }); });
      row.querySelector('[data-rv-angle]').addEventListener('input', function (ev) { updateReveal(id, { angle: num(ev.target) }); });
      row.querySelectorAll('[data-rv-param]').forEach(function (inp) {
        inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', function () {
          var patch = {}; patch[inp.getAttribute('data-rv-param')] = inp.type === 'checkbox' ? inp.checked : (inp.tagName === 'SELECT' ? inp.value : num(inp));
          updateReveal(id, { params: patch });
        });
      });
      row.querySelector('[data-rv-del]').addEventListener('click', function () { removeReveal(id); say(''); });
    });
  }

  // The blueprint's semantic reveal suggestions — names the assistant
  // offered ("MANE", "TAIL TUFT") — as one-press additions. Semantic
  // only: the type is the closed vocabulary's or the researcher's, and
  // the place is a light whose role matches the suggested feature, or
  // the first light.
  function renderRevealSuggestions() {
    var box = el('[data-reveal-suggest]');
    if (!box) return;
    var Ref = global.LabReference;
    var bp = (Ref && Ref.current) ? Ref.current() : null;
    var list = (bp && Array.isArray(bp.reveal)) ? bp.reveal : [];
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<span class="note">Suggested by the reference (semantic only — you choose the type and the place):</span> ' +
      list.map(function (s, i) {
        var have = state.reveal.features.some(function (f) { return f.name === s.name; });
        return '<button class="quiet rvs' + (have ? ' have' : '') + '" data-rv-sugg="' + i + '"' + (have ? ' disabled' : '') + '>+ ' + esc(s.name.toLowerCase()) + (s.kind ? ' · ' + esc(s.kind) : '') + '</button>';
      }).join(' ');
    box.querySelectorAll('[data-rv-sugg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = list[Number(b.getAttribute('data-rv-sugg'))];
        if (!s) return;
        var a = 0;
        if (s.near) state.roles.forEach(function (r, i) { if (r === s.near && a === 0) a = i; });
        var r = addReveal(s.kind || 'contour', a, null, s.name);
        say(r.ok ? 'Added ' + s.name.toLowerCase() + ' as a ' + (s.kind || 'contour') + ' at light ' + a + ' — place it on the reveal preview, then choose its numbers.' : 'Not added: ' + r.reason);
      });
    });
  }

  function renderReveal() {
    var sec = el('[data-reveal-section]');
    if (!sec) return;
    if (revealRowsEpoch !== revealEpoch) { renderRevealRows(); revealRowsEpoch = revealEpoch; }
    // the add-row selects follow the lights, and only re-populate when
    // the lights change (so a choice is never reset under the pointer)
    var key2 = state.points.length + '|' + state.roles.join(',');
    if (key2 !== revealSelectsKey) {
      revealSelectsKey = key2;
      var sa = el('[data-reveal-add-a]'), sb = el('[data-reveal-add-b]');
      if (sa) sa.innerHTML = lightOptions(0, false);
      if (sb) sb.innerHTML = lightOptions(null, true);
    }
    var dur = el('[data-reveal-duration]'); if (dur && Number(dur.value) !== state.reveal.durationS) dur.value = state.reveal.durationS;
    var au = el('[data-reveal-authoring]'); if (au) au.checked = revealAuthoring;
    var cnt = el('[data-reveal-count]'); if (cnt) cnt.textContent = state.reveal.features.length + ' feature' + (state.reveal.features.length === 1 ? '' : 's') + ' · hold ' + state.reveal.durationS + 's';
    var play = el('[data-reveal-play]'); if (play) play.disabled = !state.reveal.features.length || !state.points.length;
    renderRevealSuggestions();
    ensureRevealLoop();
  }

  function wireReveal() {
    var c = el('[data-canvas-reveal]');
    var R = global.LabReveal;
    if (c && R) {
      function xy(ev) { var r = c.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top, r.width, r.height]; }
      c.addEventListener('pointerdown', function (ev) {
        if (revealPlay || revealForced || !revealAuthoring) return;
        var q = xy(ev), P = state.points.map(function (p) { return toScreen(p, q[2], q[3]); });
        var best = null, bd = 18;
        state.reveal.features.forEach(function (f) {
          var o = R.originOf(f, P); if (!o) return;
          var d = Math.hypot(o[0] - q[0], o[1] - q[1]);
          if (d < bd) { bd = d; best = f; }
        });
        if (!best) return;
        revealDrag = { id: best.id, x: q[0], y: q[1] };
        record(); history.coalesce = true;           // one drag, one undo step
        c.setPointerCapture(ev.pointerId);
      });
      c.addEventListener('pointermove', function (ev) {
        if (!revealDrag) return;
        var q = xy(ev), P = state.points.map(function (p) { return toScreen(p, q[2], q[3]); });
        var f = state.reveal.features[revealIndex(revealDrag.id)]; if (!f) { revealDrag = null; return; }
        var d = R.offsetDelta(f, P, q[0] - revealDrag.x, q[1] - revealDrag.y);
        revealDrag.x = q[0]; revealDrag.y = q[1];
        var off = [Math.round((f.offset[0] + d[0]) * 100) / 100, Math.round((f.offset[1] + d[1]) * 100) / 100];
        updateReveal(f.id, { offset: off });
        var row = el('[data-rv="' + f.id + '"]');
        if (row) { var i0 = row.querySelector('[data-rv-off="0"]'), i1 = row.querySelector('[data-rv-off="1"]'); if (i0) i0.value = off[0]; if (i1) i1.value = off[1]; }
      });
      function up() { if (revealDrag) { history.coalesce = false; unrecordIfSame(); } revealDrag = null; }
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    }
    var add = el('[data-reveal-add]'); if (add) add.addEventListener('click', function () {
      var type = (el('[data-reveal-add-type]') || {}).value || 'contour';
      var a = Number((el('[data-reveal-add-a]') || {}).value || 0);
      var bv = (el('[data-reveal-add-b]') || {}).value; var b = (bv === '' || bv === undefined) ? null : Number(bv);
      var name = (el('[data-reveal-add-name]') || {}).value || '';
      var r = addReveal(type, a, b, name);
      say(r.ok ? 'Added ' + r.feature.name.toLowerCase() + ' — drag its ring on the reveal preview to place it; the numbers beside it shape it.' :
        (/no-lights/.test(r.reason) ? 'Place the figure first — a reveal feature is anchored to its points.' : 'Not added: ' + r.reason.replace(/-/g, ' ') + '.'));
      var nm = el('[data-reveal-add-name]'); if (nm && r.ok) nm.value = '';
    });
    var dur = el('[data-reveal-duration]'); if (dur) dur.addEventListener('change', function () { setRevealDuration(dur.value); });
    var au = el('[data-reveal-authoring]'); if (au) au.addEventListener('change', function () { revealAuthoring = au.checked; revealForced = null; revealEpoch++; emit(); });
    var play = el('[data-reveal-play]'); if (play) play.addEventListener('click', function () { var r = revealStart(); say(r.ok ? '' : 'Add a reveal feature first.'); });
    var rr = el('[data-reset-reveal]'); if (rr) rr.addEventListener('click', function () {
      var r = resetReveal();
      say(r.removed ? 'Reveal reset — ' + r.removed + ' feature' + (r.removed === 1 ? '' : 's') + ' removed. Points, connections and missing marks are exactly as they were. Undo brings the reveal back.' : 'No reveal features to reset.');
    });
    var rs = el('[data-reveal-research]'); if (rs) rs.addEventListener('click', function () {
      var D = global.LabRevealData;
      if (!D || !D.fixtures) { say('The research set is not loaded.'); return; }
      var r = importJSON(JSON.stringify({ fixtures: D.fixtures }));
      say(r.ok ? 'Imported the research set — ' + r.added + ' creature fixture(s), each with its reveal-only features. Open one from the Fixtures list.' : 'Not imported: ' + r.reason);
    });
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
          // A suggested point within reach (the reference layer's, when
          // one is showing) answers with its own place; otherwise the
          // light lands exactly where the author pressed. From here on
          // it is an ordinary light either way.
          var Ref = global.LabReference;
          var sn = (Ref && Ref.snap) ? Ref.snap(u) : null;
          var role = null;
          if (sn) { u = [sn.x, sn.y]; role = sn.name || null; }
          var r = addPoint(u[0], u[1], role);
          if (!r.ok) say(overBudget()
            ? 'The figure already has ' + state.points.length + ' points — more than this ' + state.budget + '-point budget holds. Take some away, or choose a larger budget.'
            : 'This budget is full — ' + state.budget + ' points. Choose a larger budget or take one away.');
          // Accepting a feature's suggestion brings that feature into
          // focus, so its related points appear for the next press.
          else if (role && Ref && Ref.focus && Ref.focused && Ref.focused() !== role) Ref.focus(role);
        }
      } else if (mode === 'move') {
        if (pi !== -1) { dragging = pi; record(); history.coalesce = true; canvas.setPointerCapture(ev.pointerId); }
      } else if (mode === 'delete') {
        if (pi !== -1) {
          var dr = deletePoint(pi);
          if (dr.ok) say('Removed point ' + pi + (dr.joinsRemoved || dr.droppedReveal.length
            ? ' — ' + (dr.joinsRemoved ? dr.joinsRemoved + ' connection' + (dr.joinsRemoved === 1 ? '' : 's') : '') + (dr.joinsRemoved && dr.droppedReveal.length ? ' and ' : '') + (dr.droppedReveal.length ? dr.droppedReveal.length + ' reveal feature' + (dr.droppedReveal.length === 1 ? '' : 's') : '') + ' went with it. Undo brings them back.'
            : '.'));
        }
      } else if (mode === 'join') {
        if (pi !== -1) {
          var before = selection();
          selectLight(pi);
          var after = selection();
          if (after.a !== null && after.b === null) say('Point ' + after.a + ' selected — select another point to connect them, or a connection to change it.');
          else if (after.a === null) say('');
          else if (after.joined) say('Connected ' + after.a + ' and ' + after.b + '. Press MISSING to leave it for the child to complete, or UNJOIN to take it away.');
          else if (before.a !== null) say('Disconnected ' + after.a + ' and ' + after.b + '. JOIN connects them again; Undo does too.');
        } else {
          ji = joinAt(x, y, w, h);
          if (ji !== -1) { selectJoin(ji); var sj = selection(); say('Connection ' + sj.a + '–' + sj.b + ' selected' + (sj.missing ? ' (missing)' : '') + ' — UNJOIN removes it, MISSING ' + (sj.missing ? 'restores it.' : 'leaves it for the child to complete.')); }
          else { clearSelection(); emit(); }
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
    function up() { if (dragging !== null) { history.coalesce = false; unrecordIfSame(); } dragging = null; }
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
      ['points', m.points + ' / ' + m.budget + ' (' + m.percentUsed + '%)' + (m.overBudget ? ' — EXCEEDS the selected budget by ' + m.overBudget : '')],
      ['all points placed', m.allPlaced ? 'yes' : (m.overBudget ? 'over budget' : 'no')],
      ['connections', String(m.connections)],
      ['missing connections', String(m.missing)],
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
          (m.overBudget
            ? 'The figure has ' + m.points + ' points and the selected budget is ' + m.budget + ' — it exceeds the budget by ' + m.overBudget + '. Nothing was removed; take points away by hand, or choose a larger budget.'
            : m.aboveProduction
            ? 'The real Ether performs up to ' + m.productionBudget + ' lights. A ' + m.budget + '-light figure can be judged here and cannot be played there — the runtime is not changed by this tool.'
            : (m.missing === 0 ? 'Mark at least one join as missing — a figure with no gap is not unfinished.'
                               : 'The real validator refuses this figure: ' + (m.validator ? m.validator.reasons.join(', ') : '')));
      }
    }
    renderApproval(m);
  }

  function renderApproval(m) {
    var btn = el('[data-approve]'), box = el('[data-approved]'), why = el('[data-approve-why]');
    if (btn) btn.disabled = !state.points.length || !!m.overBudget || !!state.approved;
    if (why) {
      why.textContent = state.approved ? '' :
        (!state.points.length ? 'Place at least one light to have a figure to approve.'
          : m.overBudget ? 'The figure exceeds the selected budget by ' + m.overBudget + ' — take points away or choose a larger budget before approving.'
          : '');
    }
    var sec = el('[data-approve-section]');
    if (sec) sec.setAttribute('data-approve-state', state.approved ? 'approved' : 'unapproved');
    var sum = el('[data-approve-summary]');
    if (sum) {
      var st = status();
      sum.innerHTML = [
        ['CREATURE', st.name || '— (unnamed)'],
        ['POINTS', st.points + ' of ' + st.budget + (st.overBudget ? ' — over by ' + st.overBudget : '')],
        ['CONNECTIONS', String(st.connections)],
        ['MISSING CONNECTIONS', String(st.missing)],
        ['REVEAL FEATURES', String(st.reveal)],
        ['STATUS', st.state]
      ].map(function (r) { return '<div class="mrow"><span class="mk">' + r[0] + '</span><span class="mv">' + esc(r[1]) + '</span></div>'; }).join('');
    }
    if (!box) return;
    if (!state.approved) {
      box.hidden = true; box.innerHTML = '';
      var out = el('[data-approved-out]'); if (out) { out.hidden = true; out.value = ''; }
      return;
    }
    var a = state.approved;
    box.hidden = false;
    box.innerHTML = '<div class="approved-head">APPROVED FIGURE</div>' +
      '<div class="mrow"><span class="mk">approved</span><span class="mv">' + esc(a.approvedAt) + '</span></div>' +
      '<div class="mrow"><span class="mk">budget</span><span class="mv">' + a.budget + '</span></div>' +
      '<div class="mrow"><span class="mk">points · connections · missing</span><span class="mv">' + a.points.length + ' · ' + a.joins.length + ' · ' + a.missing.length + '</span></div>' +
      '<div class="mrow"><span class="mk">feature associations</span><span class="mv">' + (a.roles.length ? esc(a.roles.map(function (r) { return r.light + ':' + r.feature; }).join(' · ')) : '— (every light placed freehand)') + '</span></div>' +
      '<div class="mrow"><span class="mk">reveal-only features (separate section)</span><span class="mv">' + (a.reveal && a.reveal.features.length ? esc(a.reveal.features.map(function (f) { return f.name + ' (' + f.type + ')'; }).join(' · ')) + ' · ' + a.reveal.durationS + 's' : '— none') + '</span></div>' +
      '<div class="note">Frozen as authored. Nothing was activated, published or put in a pool; no hint, gap, challenge or awakening was made. Any edit to the figure clears the approval — approve again to refreeze it.</div>';
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
          '<span class="fi">' + (r.points || []).length + ' points · ' + (r.joins || []).length + ' connections · ' + (r.missing || []).length + ' missing</span>' +
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
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-open');
        if (isDirty() && state.points.length && armedOpen !== id) {
          armedOpen = id;
          say('Opening this fixture will replace the creature you are working on, which has unsaved changes. Press Open again to replace it, or Save fixture first.');
          return;
        }
        armedOpen = null;
        var r = load(id); say(r.ok ? '' : 'Could not open it: ' + String(r.reason).replace(/-/g, ' ') + '.');
      });
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
      return '<div class="ctile"><div class="ctitle">' + r.budget + ' points</div>' +
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

  // THE STATUS STRIP, the history buttons, the Connect controls and the
  // TEST readout — the workflow made visible. Every value here is a word
  // a researcher reads; the validator's own reasons stay in Advanced.
  function renderWorkflow() {
    var st = status();
    var n1 = el('[data-status-name]'); if (n1) n1.textContent = st.name ? st.name.toUpperCase() : 'NEW CREATURE';
    var n2 = el('[data-status-line]'); if (n2) n2.textContent = st.line;
    var n3 = el('[data-status-state]'); if (n3) { n3.textContent = st.state; n3.setAttribute('data-state', st.state.toLowerCase().replace(/ /g, '-')); }
    var n4 = el('[data-status-next]'); if (n4) n4.textContent = st.next;
    var n5 = el('[data-status-origin]'); if (n5) { n5.textContent = st.origin === 'generated' ? 'GENERATED' : st.origin === 'generated-edited' ? 'GENERATED · EDITED' : 'AUTHORED'; n5.setAttribute('data-origin', st.origin); n5.hidden = !state.points.length; }
    var hd = historyDepth();
    var un = el('[data-undo]'); if (un) { un.disabled = !hd.undo; un.title = hd.undo ? 'Undo (' + hd.undo + ')' : 'Nothing to undo'; }
    var rd = el('[data-redo]'); if (rd) { rd.disabled = !hd.redo; rd.title = hd.redo ? 'Redo (' + hd.redo + ')' : 'Nothing to redo'; }
    var x = selection();
    var jb = el('[data-join]'); if (jb) jb.disabled = !x.canJoin;
    var ub = el('[data-unjoin]'); if (ub) ub.disabled = !x.canUnjoin;
    var mb = el('[data-missing]'); if (mb) { mb.disabled = !x.canMissing; mb.textContent = x.missing ? 'Restore connection' : 'Mark missing'; }
    var sr = el('[data-selection]');
    if (sr) sr.textContent = x.a === null ? (mode === 'join' ? 'Nothing selected — click a point, or a connection.' : 'Choose the Connect tool, then click a point.')
      : x.b === null ? 'Selected: point ' + x.a
      : x.joined ? 'Selected: connection ' + x.a + '–' + x.b + (x.missing ? ' (missing — the child completes it)' : ' (connected)')
      : 'Selected: points ' + x.a + ' and ' + x.b + ' (not connected)';
    var rp = el('[data-reset-points]'); if (rp) rp.disabled = !state.points.length;
    var rc = el('[data-reset-connections]'); if (rc) rc.disabled = !state.joins.length;
    var rv = el('[data-reset-reveal]'); if (rv) rv.disabled = !state.reveal.features.length && state.reveal.durationS === 4;
    var ts = el('[data-test-state]');
    if (ts) {
      var f = revealForced;
      ts.textContent = revealPlay ? 'COME ALIVE — the reveal is playing' : f === 'unfinished' ? 'UNFINISHED — what the child first meets' : f === 'complete' ? 'COMPLETE — every connection made' : f === 'after' ? 'COME ALIVE — done; the plain creature remains' : f === 'reveal' ? 'COME ALIVE — the reveal held' : 'Authoring view — the complete creature with its reveal features';
    }
    doc.querySelectorAll('[data-test]').forEach(function (b) {
      var k = b.getAttribute('data-test');
      b.classList.toggle('on', (k === 'unfinished' && revealForced === 'unfinished') || (k === 'complete' && revealForced === 'complete') || (k === 'alive' && (!!revealPlay || revealForced === 'after' || revealForced === 'reveal')) || (k === 'authoring' && !revealForced && !revealPlay));
    });
  }

  function render() {
    var cc = el('[data-canvas-complete]'), cu = el('[data-canvas-unfinished]');
    var Ref = global.LabReference;
    var Tr = global.LabTranslate;
    var under = !!(Ref && Ref.isShowing && Ref.isShowing()) || !!(Tr && Tr.underlayShowing && Tr.underlayShowing());
    if (cc) draw(cc, state, { editing: true, numbers: showNumbers, transparent: under });
    // never the reference OUTLINE: this is what a child meets — but the
    // suggested points are marked on it faintly, as the starting point on
    // the bare sky (see drawSuggestedMarks)
    if (cu) draw(cu, state, { unfinished: true, suggest: true });
    var sf = el('[data-suggest-flag]'); if (sf) sf.hidden = !(Ref && Ref.suggestions && Ref.suggestions().length);
    doc.querySelectorAll('[data-budget]').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-budget')) === state.budget);
    });
    var bl = el('[data-budget-label]');
    if (bl) bl.textContent = 'TESTING ' + state.budget + ' POINTS' + (state.budget > PRODUCTION_BUDGET ? ' — Lab authoring / research budget · production currently supports ' + PRODUCTION_BUDGET : ' — the production budget') +
      (overBudget() ? ' · FIGURE EXCEEDS BUDGET (' + state.points.length + ' lights)' : '');
    doc.body.classList.toggle('over-budget', overBudget() > 0);
    doc.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    var nm = el('[data-name]'); if (nm && nm.value !== state.name) nm.value = state.name;
    var hn = el('[data-hint]'); if (hn && hn.value !== state.hint) hn.value = state.hint;
    var nt = el('[data-notes]'); if (nt && nt.value !== state.notes) nt.value = state.notes;
    var tz = el('[data-tease]'); if (tz) tz.checked = !!state.tease;
    var op = el('[data-opened]'); if (op) op.textContent = (state.id ? ('fixture ' + state.id) : 'unsaved figure') + (isDirty() && state.points.length ? ' · unsaved changes' : '');
    renderWorkflow();
    renderMetrics();
    if (judgedEpoch !== figureEpoch) { renderJudgement(); judgedEpoch = figureEpoch; }
    renderFixtures();
    renderCompare();
    renderReveal();
  }

  function wire() {
    var cc = el('[data-canvas-complete]');
    if (cc) wireCanvas(cc);
    doc.querySelectorAll('[data-budget]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = setBudget(Number(b.getAttribute('data-budget')));
        say(!r.ok ? 'Not a budget.' : r.overBudget
          ? 'The figure has ' + r.lights + ' points — ' + r.overBudget + ' more than this ' + state.budget + '-point budget holds. It is kept whole; nothing is trimmed for you. Take points away by hand if you want it to fit.'
          : '');
      });
    });
    doc.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode'); clearSelection();
        if (mode === 'join') {
          var jr = joinInOrder();
          say(jr.lights < 2 ? 'Place two or more lights first.'
            : jr.added ? 'Joined the lights in their order — ' + jr.added + ' new join' + (jr.added === 1 ? '' : 's') + '. Click a point and another point to connect or disconnect them; click a line to select a connection, then Unjoin or Mark missing.'
            : 'The lights are already joined in their order. Click a point and another point to connect or disconnect them; click a line to select a connection, then Unjoin or Mark missing.');
        }
        emit();
      });
    });
    var num = el('[data-numbers]');
    if (num) num.addEventListener('change', function () { showNumbers = num.checked; emit(); });
    var nm = el('[data-name]'); if (nm) nm.addEventListener('input', function () { state.name = nm.value; nameGenerated = false; renderMetrics(); });
    var hn = el('[data-hint]'); if (hn) hn.addEventListener('input', function () { state.hint = hn.value; });
    var nt = el('[data-notes]'); if (nt) nt.addEventListener('input', function () { state.notes = nt.value; });
    var tz = el('[data-tease]'); if (tz) tz.addEventListener('change', function () { state.tease = tz.checked; });
    // RESET EVERYTHING asks first — an inline confirmation, never a
    // browser dialog — and says what it will remove.
    var rs = el('[data-reset]'); if (rs) rs.addEventListener('click', function () {
      var box = el('[data-reset-confirm-box]'); if (box) { box.hidden = false; } else { reset(); say(''); }
    });
    var rc = el('[data-reset-confirm]'); if (rc) rc.addEventListener('click', function () {
      var box = el('[data-reset-confirm-box]'); if (box) box.hidden = true;
      reset();
      say('Started again — points, connections, missing marks and reveal are gone; the label and notes too. The reference, if one is showing, is still there.');
    });
    var rx = el('[data-reset-cancel]'); if (rx) rx.addEventListener('click', function () { var box = el('[data-reset-confirm-box]'); if (box) box.hidden = true; say(''); });
    var rpt = el('[data-reset-points]'); if (rpt) rpt.addEventListener('click', function () {
      var r = resetPoints();
      say('Points reset' + (r.placed ? ' — the ' + r.placed + ' suggested points are placed again as the starting figure' : ' — every point removed') + '. Connections went with them' + (r.revealDropped ? ', and so did ' + r.revealDropped + ' reveal feature' + (r.revealDropped === 1 ? '' : 's') + ' that stood on them' : '') + '. Undo brings it all back.');
    });
    var rcn = el('[data-reset-connections]'); if (rcn) rcn.addEventListener('click', function () {
      var r = resetConnections();
      say(r.removed ? 'Connections reset — ' + r.removed + ' removed, every point exactly where it was, the reveal untouched. Undo brings them back.' : 'No connections to reset.');
    });
    var un = el('[data-undo]'); if (un) un.addEventListener('click', function () { var r = undo(); say(r.ok ? 'Undone.' + (r.undoLeft ? ' (' + r.undoLeft + ' more)' : '') : 'Nothing to undo.'); });
    var rd = el('[data-redo]'); if (rd) rd.addEventListener('click', function () { var r = redo(); say(r.ok ? 'Redone.' : 'Nothing to redo.'); });
    doc.addEventListener('keydown', function (ev) {
      var t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); }
      else if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'y' || ev.key === 'Y')) { ev.preventDefault(); redo(); }
    });
    var jb = el('[data-join]'); if (jb) jb.addEventListener('click', function () { var r = joinSelected(); say(r.ok ? 'Connected ' + r.selection.a + ' and ' + r.selection.b + '.' : 'Select two points that are not connected, then press JOIN.'); });
    var ub = el('[data-unjoin]'); if (ub) ub.addEventListener('click', function () { var r = unjoinSelected(); say(r.ok ? 'Disconnected ' + r.selection.a + ' and ' + r.selection.b + '. JOIN or Undo brings it back.' : 'Select a connection first — click a line, or two connected points.'); });
    var mb = el('[data-missing]'); if (mb) mb.addEventListener('click', function () { var r = toggleMissingSelected(); say(r.ok ? (r.missing ? 'Marked missing — the child will make this connection. It shows dashed here and is absent on the JUDGE pane.' : 'Connection restored.') : 'Select a connection first — click a line, or two connected points.'); });
    var jo = el('[data-join-order]'); if (jo) jo.addEventListener('click', function () {
      var jr = joinInOrder();
      say(jr.lights < 2 ? 'Place two or more points first.' : jr.added ? 'Connected the points in their order — ' + jr.added + ' new connection' + (jr.added === 1 ? '' : 's') + '. Existing connections and missing marks were kept.' : 'The points are already connected in their order.');
    });
    doc.querySelectorAll('[data-test]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-test');
        // the state is shown FIRST and the tested mark (which re-renders
        // the strip and the readout) second, so the readout names the
        // state that is actually on the canvas
        if (k === 'unfinished') { revealShow('unfinished'); markTested(); say('UNFINISHED — this is what the child first meets: the missing connections are simply not there.'); }
        else if (k === 'complete') { revealShow('complete'); markTested(); say('COMPLETE — every connection made, no reveal yet.'); }
        else if (k === 'alive') {
          if (state.reveal.features.length) { var r = revealStart(); markTested(); say(r.ok ? 'COME ALIVE — the reveal plays: completion, a short response, the features emerge, hold, fade. For the awakening and the roaming, press ▶ Play in Ether.' : ''); }
          else { revealShow('complete'); markTested(); say('COME ALIVE — no reveal features yet, so the complete creature is all there is to show here. Add one in REVEAL, or press ▶ Play in Ether to see it wake and roam.'); }
        }
        else { revealShow(null); emit(); say(''); }
      });
    });
    var dm = el('[data-demo]'); if (dm) dm.addEventListener('click', function () { demoRing(); say('A neutral ring at this budget — not a creature, only the tool working.'); });
    var sv = el('[data-save]'); if (sv) sv.addEventListener('click', function () {
      var r = save(); say(r.ok ? 'Saved as ' + r.id + '.' : (/exceeds-budget/.test(r.reason || '') ? 'Not saved: the figure exceeds the selected budget. Take points away or choose a larger budget first — nothing is trimmed for you.' : 'Could not save — this browser refused storage.'));
    });
    // OPEN a fixture over unsaved work asks for a second press — the
    // current figure would be replaced, and that must never be silent.
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
    var ps = el('[data-ref-place]'); if (ps) ps.addEventListener('click', function () {
      var r = placeSuggestions();
      say(r.ok ? (r.placed ? 'Placed ' + r.placed + ' suggested point' + (r.placed === 1 ? '' : 's') + ' as points — yours to move, delete or add to.' : 'Every suggested place already holds a light, or the budget is full.') : 'No reference is showing — nothing to place.');
    });
    var ap = el('[data-approve]'); if (ap) ap.addEventListener('click', function () {
      var r = approve();
      say(r.ok ? 'Figure approved — frozen as the research artifact. Save fixture keeps it with the fixture.' : 'Not approved: ' + String(r.reason).replace(/-/g, ' ') + '.');
    });
    var ax = el('[data-approved-export]'); if (ax) ax.addEventListener('click', function () {
      var out = el('[data-approved-out]'); var txt = exportApproved();
      if (out && txt) { out.value = txt; out.hidden = false; out.select(); }
    });
    var play = el('[data-play]'); if (play) play.addEventListener('click', function () {
      if (!playable()) return;
      var cand = candidateFor(state);
      var Host = global.LabPreviewHost;
      if (!Host) { say('The preview host is not loaded.'); return; }
      // The hint travels BESIDE the candidate, never inside it; the
      // creature's name travels nowhere.
      // The reveal-only features travel BESIDE the candidate too — the
      // Lab draws them over the real sky after completion, and the
      // interpreter never sees them.
      var r = Host.open(cand, 'shape-' + (state.id || 'unsaved'), function () {}, 'play',
                        { hint: state.hint || '', tease: state.tease ? 'delayed' : false, reveal: revealOf() });
      if (r.ok) markTested();
      say(r.ok ? '' : 'The browser refused the preview tab (popup blocked).');
    });
    wireReveal();
    global.addEventListener('resize', render);
    // the sticky centre's offset is the top bar's measured height, so the
    // panes never move when a control below the fold scrolls into view
    var syncTop = function () {
      var tb = el('[data-topbar]');
      if (tb && doc.documentElement) doc.documentElement.style.setProperty('--lab-top', (tb.offsetHeight + 14) + 'px');
    };
    syncTop();
    global.addEventListener('resize', syncTop);
    // the header wraps differently as the budget label changes, so the
    // top bar's height is watched rather than measured once
    if (typeof global.ResizeObserver === 'function') { var tbEl = el('[data-topbar]'); if (tbEl) new global.ResizeObserver(syncTop).observe(tbEl); }
    listeners.push(syncTop);
    listeners.push(render);
    render();
    consumeHandoff();
  }

  // A ONE-SHOT NOTE FROM THE CANDIDATE GALLERY. The gallery hands the
  // exact geometry of a candidate here to be edited; the note is read
  // once and deleted, so a refresh never re-opens it, and it is never
  // saved until the researcher presses Save. Loading the page with no
  // note writes nothing and changes nothing.
  var HANDOFF_KEY = 'vihu.lab.shape.handoff';
  function consumeHandoff() {
    var raw = null;
    try { raw = global.sessionStorage.getItem(HANDOFF_KEY); } catch (e) { return; }
    if (!raw) return;
    try { global.sessionStorage.removeItem(HANDOFF_KEY); } catch (e) {}
    var rec;
    try { rec = JSON.parse(raw); } catch (e) { return; }
    if (!rec || typeof rec !== 'object') return;
    rec.id = null;
    var r = hydrate(rec);
    emit();
    say(r.ok ? 'Opened from the Candidate Gallery — an unsaved figure until you press Save fixture.'
             : 'The gallery note could not be opened: ' + r.reason.replace(/-/g, ' ') + '.');
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }

  global.ShapeLab = {
    BUDGETS: BUDGETS.slice(),
    PRODUCTION_BUDGET: PRODUCTION_BUDGET,
    STORE_KEY: STORE_KEY,
    HANDOFF_KEY: HANDOFF_KEY,
    LAB_VERSION: LAB_VERSION,
    // editing
    setBudget: setBudget, addPoint: addPoint, movePoint: movePoint, deletePoint: deletePoint,
    toggleJoin: toggleJoin, joinInOrder: joinInOrder, toggleGap: toggleGap, reset: reset, demoRing: demoRing,
    approve: approve, exportApproved: exportApproved, APPROVED_KIND: APPROVED_KIND,
    placeSuggestions: placeSuggestions,
    setMode: function (m) { mode = m; clearSelection(); emit(); },
    // the researcher workflow: history, selection, scoped resets, status
    undo: undo, redo: redo, historyDepth: historyDepth,
    selection: selection, selectLight: selectLight, selectJoin: selectJoin,
    joinSelected: joinSelected, unjoinSelected: unjoinSelected, toggleMissingSelected: toggleMissingSelected,
    resetPoints: resetPoints, resetConnections: resetConnections, resetReveal: resetReveal, resetAll: reset,
    status: status, markTested: markTested, isDirty: isDirty,
    setName: setName, setHint: setHint, setNotes: setNotes, setTease: setTease,
    setJudgement: setJudgement, setAuthoring: setAuthoring,
    // reveal-only features (labReveal.js)
    REVEAL_KIND: REVEAL_KIND,
    addReveal: addReveal, updateReveal: updateReveal, removeReveal: removeReveal,
    setRevealDuration: setRevealDuration, reveal: revealOf,
    revealPlay: revealStart, revealStop: revealStop, revealShow: revealShow, revealStatus: revealStatus,
    setRevealAuthoring: function (v) { revealAuthoring = !!v; revealEpoch++; emit(); },
    // the one projection, for anything that must line up with the editor
    scaleFor: scaleFor, project: toScreen, unproject: toUnit,
    observe: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    // reading
    state: function () { return JSON.parse(JSON.stringify(serialize())); },
    figure: function () { return figureOf(state); },
    roles: function () { return rolesOf(state); },
    loadGenerated: loadGenerated, origin: origin,
    originTaken: originTaken,
    approved: function () { return state.approved ? JSON.parse(JSON.stringify(state.approved)) : null; },
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
