// tools/ether-mystery-lab/labTranslate.js — IMAGE UNDERSTANDING → ETHER
// TRANSLATION PLAN → (composer) → a complete Ether figure in the Shape Lab.
//
// SPRINT — Ether creature translation, image → Ether, proof V1
// (Decision 58, Lab only).
//
// THE PLAN IS THE CONTRACT BETWEEN MEANING AND GEOMETRY. The model,
// looking at the chosen picture WITH its own understanding beside it,
// answers only structural questions in a controlled vocabulary: which
// masses, of what size, kind and shape; the dominant gesture and which
// masses lie along it, root to head; what attaches to what, by which
// relation, on which side; what is exaggerated; what must survive; what
// to simplify; what is reveal-only; how complex the figure should be.
// It never emits a coordinate, a shape or code — those keys are refused
// by name before a plan exists, and every string is scanned for the
// shapes of geometry and executable text.
//
// NOTHING IS RESTATED. Subject, character, the gesture sentence,
// diagnostic features and reveal candidates already live in the image
// understanding (labImagine.js); the plan carries only what the
// composer needs on top, and the page shows both side by side.
//
// THE COMPOSER IS DETERMINISTIC AND THE MODEL NEVER DRAWS. The plan goes
// to labEtherComposer.js, which is a pure function; the figure comes back
// as points, roles and joins and is loaded into the Shape Lab as one
// GENERATED figure, in one history step, under the budget the composer
// chose. Every manual tool still works on it — that is the whole
// point: inspect, adjust, approve; never delete and rebuild.
//
// STOPS HERE. No missing joins are chosen, no hint is written, nothing
// wakes up, nothing reaches the Ether. Later stages can tell the
// complete structure from what could be left missing because every join
// carries its reason (flow, volume, attach, span, taper, limb, ring).
//
// NO CREATURE CATALOGUE. There is no species word and no `subject ===`
// anywhere in this file; the suite scans for both.

(function (global) {
  'use strict';

  var LIMITS = { massesMin: 2, massesMax: 12, idChars: 24, labelChars: 24, relationshipsMax: 16, flowMin: 2, flowMax: 6, listMax: 8, text: 300 };
  var ROLES = ['primary', 'secondary', 'diagnostic'];
  var KINDS = ['mass', 'flow', 'taper', 'span', 'branch', 'terminal', 'enclosure'];
  var SIZES = ['dominant', 'large', 'medium', 'small', 'tiny'];
  var SHAPES = ['round', 'oval', 'long', 'wide', 'thin', 'flat'];
  var GESTURES = ['upright', 'seated', 'grounded', 'reaching', 'flowing', 'coiled', 'diagonal', 'spread', 'rearing', 'floating'];
  var CURVES = ['straight', 'gentle', 'c-curve', 's-curve'];
  var FACINGS = ['left', 'right', 'front', 'three-quarter-left', 'three-quarter-right'];
  var RELATIONS = ['supports', 'rises-from', 'extends-from', 'hangs-from', 'flows-into', 'surrounds', 'attaches-to', 'spans-from', 'pairs-with'];
  var SIDES = ['top', 'bottom', 'front', 'back', 'left', 'right', 'around', 'both'];
  var TREATS = ['dominant', 'oversized', 'elongated', 'compressed', 'small', 'keep'];
  var COMPLEXITIES = ['simple', 'moderate', 'rich'];

  // Keys that would turn a plan into geometry, code, or a reference to a
  // private thing — refused BY NAME at any depth, and the whole plan
  // with them. (The same discipline as the analysis validator.)
  var FORBIDDEN_KEYS = ['points', 'point', 'joins', 'join', 'missing', 'gaps', 'gap', 'x', 'y', 'coordinates', 'coords', 'polygon', 'polyline',
    'path', 'paths', 'svg', 'pixels', 'px', 'anchor', 'anchors', 'position', 'positions', 'geometry', 'canvas', 'code', 'script', 'html', 'css', 'js',
    'url', 'href', 'src', 'image', 'img', 'base64', 'data', 'reveal', 'hint', 'tease', 'candidate', 'arrangement', 'figure', 'angle', 'radius',
    'pattern', 'cells', 'constellation', 'stars', 'card', 'cardId', 'owner', 'ownerId', 'email', 'memories', 'memory', 'orbit', 'circle',
    'username', 'creator', 'companion', 'story', 'session', 'token', 'key'];
  var BAD_TEXT = /https?:\/\/|\bwww\.|data:|<[a-z/!?]|\bsk-[A-Za-z0-9_-]{8,}/i;
  // (a decimal pair in a sentence — "the head sits at 0.2, 0.4" — is a
  // coordinate wearing prose, and is refused with the rest)
  var GEOMETRIC_TEXT = /\[\s*-?\d|\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d|\b\d+\s*px\b|<svg|<path|\bd="|\d+\s*,\s*\d+\s*(?:,|\)|\])|-?\d+\.\d+\s*,\s*-?\d+\.\d+|\bviewBox\b/i;
  var EXECUTABLE_TEXT = /function\s*\(|=>|\bctx\.|\beval\(|\brequire\(|\bimport\s|console\.|\$\{|\{\{|;\s*\}|<\/?[a-z]+>/i;

  var SCHEMA = {
    masses: 'array of 2–12 { id: a short lowercase word (letters and hyphens, unique), label: CAPITALS ≤ 24 chars, role: primary | secondary | diagnostic, kind: mass | flow | taper | span | branch | terminal | enclosure, size: dominant | large | medium | small | tiny, shape: round | oval | long | wide | thin | flat } — the major masses and structures of THIS picture; no anatomy is forced on a picture that lacks it',
    gesture: '{ kind: ' + GESTURES.join(' | ') + ', flow: array of 2–6 mass ids along the MAIN BODY LINE, in order from the rear or base to the head or front, curve: ' + CURVES.join(' | ') + ', facing: ' + FACINGS.join(' | ') + ', note: one sentence — how the whole figure should feel when it stands and when it moves }',
    relationships: 'array of 1–16 { from: mass id, relation: ' + RELATIONS.join(' | ') + ', to: mass id, side: ' + SIDES.join(' | ') + ' (optional), symmetric: true | false (optional — a pair, one each side) } — how the masses that are NOT on the flow attach to the ones that are: what rises from what, extends from the back of what, spans from what, surrounds what, supports what from below',
    proportion: 'array of 0–8 { mass: mass id, treat: ' + TREATS.join(' | ') + ' } — what is exaggerated, dominant, elongated, compressed or small in THIS picture',
    mustSurvive: 'array of 1–6 mass ids — the structures the figure is not itself without',
    simplify: 'array of 0–8 short phrases — what should be abstracted away',
    revealOnly: 'array of 0–8 short phrases — details that need not be in the first structure and could appear later as a payoff (an expression, spikes, feathers, a pattern)',
    complexity: 'simple | moderate | rich — how many lights the structure deserves: simple for a compact figure of few masses, rich for a figure with several structures that must all read',
    movement: 'one sentence — how the completed figure should move once alive, in words'
  };

  // ---------------------------------------------------------------
  // THE REQUEST. The picture is attached by the transport (the same
  // understand() call the analysis uses); the analysis rides as context.
  // ---------------------------------------------------------------
  function planMessages(analysis) {
    if (!analysis || typeof analysis !== 'object') return { ok: false, reason: 'no-analysis' };
    var ctx = {
      subject: analysis.subject, character: analysis.character, composition: analysis.composition, architecture: analysis.architecture,
      diagnosticFeatures: analysis.diagnosticFeatures, modifiers: analysis.modifiers, proportion: analysis.proportion, gesture: analysis.gesture,
      abstraction: analysis.abstraction, revealCandidates: analysis.revealCandidates
    };
    var system = [
      'You are the structural translator between a picture of a creature and a drawing system that can only place a handful of bright points and join some of them with straight lines. You will be shown the picture and the description already written of it. Answer ONLY structural questions, in the controlled vocabulary below, about what is ACTUALLY VISIBLE. Never invent a part the picture does not show. Words only: never a coordinate, a shape outline, a number for a position, SVG, code or markup.',
      'GESTURE FIRST. Decide the dominant gesture of the whole figure and which masses lie along its MAIN BODY LINE (the flow), in order from the rear or base to the head or front. Everything else is attached to that line by a relationship: what rises from the top of what, what extends from the back of what, what spans out from what, what surrounds what, what supports what from below. A figure is never a list of parts; it is a flow with things attached.',
      'RELATIONSHIPS ARE THE POINT. For every mass that is not on the flow, give at least one relationship to a mass that is (or to one already attached). Say which side. Say when it is a pair (symmetric). For a hybrid, say where one architecture becomes the other. Use these relations only: ' + RELATIONS.join(', ') + '.',
      'KINDS: mass (a body or head), flow (a second run of body leaving the first, such as a torso rising from a four-legged body), taper (something that leaves a mass and thins to a tip — a tail, a trunk, a neck), span (something that reaches out and back — a wing, a fin, an ear), branch (limbs toward the ground), terminal (a small thing at the end of something — a horn, a beak, a tusk, a lantern), enclosure (something around a mass — a mane, a halo, a cloud).',
      'Answer with ONE JSON object and nothing else, exactly this shape:',
      '{',
      '  "masses": ' + SCHEMA.masses + ',',
      '  "gesture": ' + SCHEMA.gesture + ',',
      '  "relationships": ' + SCHEMA.relationships + ',',
      '  "proportion": ' + SCHEMA.proportion + ',',
      '  "mustSurvive": ' + SCHEMA.mustSurvive + ',',
      '  "simplify": ' + SCHEMA.simplify + ',',
      '  "revealOnly": ' + SCHEMA.revealOnly + ',',
      '  "complexity": ' + SCHEMA.complexity + ',',
      '  "movement": ' + SCHEMA.movement,
      '}',
      'Rules: every id used anywhere must be one of masses[].id. A mass on the flow is not also attached by a relationship to its flow neighbour. Legs are one branch mass, not four. A pair (two wings, two horns, two ears) is ONE mass with symmetric: true. Do not add a mass for texture, colour, an expression or a pattern — those go in simplify or revealOnly. No other keys.'
    ].join('\n');
    var user = 'The description already written of this picture:\n' + JSON.stringify(ctx, null, 1) + '\nThe picture is attached. Give the structural plan for it.';
    return { ok: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  // ---------------------------------------------------------------
  // THE VALIDATOR — deny by shape. Vocabulary drift is REPAIRED and
  // recorded (a model writes "wing" where "span" was asked); structure
  // that cannot be composed is REFUSED (an id nobody declared, a flow of
  // one, a relationship of a mass to itself, a coordinate anywhere).
  // ---------------------------------------------------------------
  function walkKeys(o, path, out) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v, i) { walkKeys(v, path + '[' + i + ']', out); }); return; }
    Object.keys(o).forEach(function (k) {
      if (FORBIDDEN_KEYS.indexOf(k) !== -1) out.push('forbidden-key:' + (path ? path + '.' : '') + k);
      walkKeys(o[k], (path ? path + '.' : '') + k, out);
    });
  }
  function badText(s) { return BAD_TEXT.test(s) || GEOMETRIC_TEXT.test(s) || EXECUTABLE_TEXT.test(s); }
  function walkText(o, path, out) {
    if (typeof o === 'string') { if (badText(o)) out.push('bad-text:' + path); return; }
    if (typeof o === 'number') { out.push('number:' + path); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v, i) { walkText(v, path + '[' + i + ']', out); }); return; }
    Object.keys(o).forEach(function (k) { walkText(o[k], (path ? path + '.' : '') + k, out); });
  }
  function token(v) { return typeof v === 'string' ? v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.idChars) : ''; }
  function pick(v, list, fallback, repairs, where) {
    var t = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (list.indexOf(t) !== -1) return t;
    if (v !== undefined && v !== null && v !== '') repairs.push(where + ' "' + String(v).slice(0, 24) + '" → ' + fallback);
    return fallback;
  }
  function phrases(v, path, max, reasons, repairs) {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) { reasons.push('not-a-list:' + path); return []; }
    if (v.length > max) { repairs.push(path + ' cut to ' + max); v = v.slice(0, max); }
    var out = [];
    v.forEach(function (s, i) { if (typeof s !== 'string' || !s.trim()) { reasons.push('not-a-word:' + path + '[' + i + ']'); return; } out.push(s.trim().replace(/\s+/g, ' ').slice(0, 80)); });
    return out;
  }

  function validatePlan(raw) {
    var reasons = [], repairs = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], repairs: [] };
    walkKeys(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    // a number ANYWHERE is a coordinate in disguise (`symmetric` is the one
    // boolean the contract allows, and a boolean is not a number)
    walkText(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    Object.keys(raw).forEach(function (k) { if (!SCHEMA[k]) reasons.push('unknown-key:' + k); });
    if (!Array.isArray(raw.masses) || raw.masses.length < LIMITS.massesMin || raw.masses.length > LIMITS.massesMax) reasons.push('bad-masses-count');
    if (!raw.gesture || typeof raw.gesture !== 'object' || Array.isArray(raw.gesture)) reasons.push('bad-gesture');
    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };

    var ids = {};
    var masses = [];
    raw.masses.forEach(function (m, i) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) { reasons.push('bad-mass:' + i); return; }
      Object.keys(m).forEach(function (k) { if (['id', 'label', 'role', 'kind', 'size', 'shape'].indexOf(k) === -1) reasons.push('unknown-key:masses[' + i + '].' + k); });
      var id = token(m.id);
      if (!id) { reasons.push('bad-mass-id:' + i); return; }
      if (ids[id]) { reasons.push('duplicate-mass:' + id); return; }
      ids[id] = true;
      var label = typeof m.label === 'string' ? m.label.toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.labelChars) : '';
      if (!label) { label = id.toUpperCase().replace(/-/g, ' '); repairs.push('masses[' + i + '].label → from id'); }
      masses.push({ id: id, label: label, role: pick(m.role, ROLES, 'secondary', repairs, 'masses[' + i + '].role'), kind: pick(m.kind, KINDS, 'mass', repairs, 'masses[' + i + '].kind'),
        size: pick(m.size, SIZES, 'medium', repairs, 'masses[' + i + '].size'), shape: pick(m.shape, SHAPES, 'oval', repairs, 'masses[' + i + '].shape') });
    });

    var g = raw.gesture;
    Object.keys(g).forEach(function (k) { if (['kind', 'flow', 'curve', 'facing', 'note'].indexOf(k) === -1) reasons.push('unknown-key:gesture.' + k); });
    var flow = Array.isArray(g.flow) ? g.flow.map(token).filter(function (id) { return id; }) : [];
    var flowUnknown = flow.filter(function (id) { return !ids[id]; });
    if (flowUnknown.length) reasons.push('flow-names-unknown-mass:' + flowUnknown.join('/'));
    flow = flow.filter(function (id, i) { return ids[id] && flow.indexOf(id) === i; });
    if (flow.length < LIMITS.flowMin) reasons.push('flow-too-short');
    if (flow.length > LIMITS.flowMax) { repairs.push('gesture.flow cut to ' + LIMITS.flowMax); flow = flow.slice(0, LIMITS.flowMax); }
    var gesture = { kind: pick(g.kind, GESTURES, 'upright', repairs, 'gesture.kind'), flow: flow, curve: pick(g.curve, CURVES, 'gentle', repairs, 'gesture.curve'),
      facing: pick(g.facing, FACINGS, 'left', repairs, 'gesture.facing'), note: typeof g.note === 'string' ? g.note.trim().slice(0, LIMITS.text) : '' };

    var relationships = [];
    if (raw.relationships !== undefined) {
      if (!Array.isArray(raw.relationships)) reasons.push('not-a-list:relationships');
      else {
        if (raw.relationships.length > LIMITS.relationshipsMax) { repairs.push('relationships cut to ' + LIMITS.relationshipsMax); }
        raw.relationships.slice(0, LIMITS.relationshipsMax).forEach(function (r, i) {
          if (!r || typeof r !== 'object' || Array.isArray(r)) { reasons.push('bad-relationship:' + i); return; }
          Object.keys(r).forEach(function (k) { if (['from', 'relation', 'to', 'side', 'symmetric'].indexOf(k) === -1) reasons.push('unknown-key:relationships[' + i + '].' + k); });
          var from = token(r.from), to = token(r.to);
          if (!ids[from] || !ids[to]) { reasons.push('relationship-names-unknown-mass:' + i); return; }
          if (from === to) { reasons.push('self-relationship:' + from); return; }
          var rel = { from: from, relation: pick(r.relation, RELATIONS, 'attaches-to', repairs, 'relationships[' + i + '].relation'), to: to };
          if (r.side !== undefined) { var sd = pick(r.side, SIDES, null, repairs, 'relationships[' + i + '].side'); if (sd) rel.side = sd; }
          if (r.symmetric !== undefined) { if (typeof r.symmetric === 'boolean') rel.symmetric = r.symmetric; else repairs.push('relationships[' + i + '].symmetric dropped (not a boolean)'); }
          relationships.push(rel);
        });
      }
    }
    // every mass off the flow must be reachable through relationships, or the composer would have to guess
    var reachable = {}; flow.forEach(function (id) { reachable[id] = true; });
    var grew = true;
    while (grew) { grew = false; relationships.forEach(function (r) { if (reachable[r.from] && !reachable[r.to]) { reachable[r.to] = true; grew = true; } if (reachable[r.to] && !reachable[r.from]) { reachable[r.from] = true; grew = true; } }); }
    var unreachable = masses.filter(function (m) { return !reachable[m.id]; }).map(function (m) { return m.id; });
    if (unreachable.length) repairs.push('no relationship reaches: ' + unreachable.join(', ') + ' (the composer will hang them off the largest flow mass and say so)');

    var proportion = [];
    if (raw.proportion !== undefined) {
      if (!Array.isArray(raw.proportion)) reasons.push('not-a-list:proportion');
      else raw.proportion.slice(0, 8).forEach(function (p, i) {
        if (!p || typeof p !== 'object') { reasons.push('bad-proportion:' + i); return; }
        Object.keys(p).forEach(function (k) { if (['mass', 'treat'].indexOf(k) === -1) reasons.push('unknown-key:proportion[' + i + '].' + k); });
        var id = token(p.mass);
        if (!ids[id]) { repairs.push('proportion[' + i + '] names no mass — dropped'); return; }
        proportion.push({ mass: id, treat: pick(p.treat, TREATS, 'keep', repairs, 'proportion[' + i + '].treat') });
      });
    }
    var mustSurvive = [];
    if (!Array.isArray(raw.mustSurvive) || !raw.mustSurvive.length) reasons.push('missing:mustSurvive');
    else raw.mustSurvive.slice(0, 6).forEach(function (v, i) { var id = token(v); if (ids[id]) { if (mustSurvive.indexOf(id) === -1) mustSurvive.push(id); } else repairs.push('mustSurvive[' + i + '] names no mass — dropped'); });
    var simplify = phrases(raw.simplify, 'simplify', LIMITS.listMax, reasons, repairs);
    var revealOnly = phrases(raw.revealOnly, 'revealOnly', LIMITS.listMax, reasons, repairs);
    var complexity = pick(raw.complexity, COMPLEXITIES, 'moderate', repairs, 'complexity');
    var movement = typeof raw.movement === 'string' ? raw.movement.trim().replace(/\s+/g, ' ').slice(0, LIMITS.text) : '';

    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    return { ok: true, reasons: [], repairs: repairs, plan: { masses: masses, gesture: gesture, relationships: relationships, proportion: proportion, mustSurvive: mustSurvive, simplify: simplify, revealOnly: revealOnly, complexity: complexity, movement: movement } };
  }

  function parsePlan(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reasons: ['empty'], repairs: [] };
    var t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'], repairs: [] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'], repairs: [] }; }
    }
    return validatePlan(obj);
  }

  // THE FIXTURE PLAN — for a session with no model. One generic upright
  // figure for every picture, labelled on its face; it exercises the
  // composer and the Shape Lab, and describes no creature.
  function fixturePlan() {
    return JSON.stringify({
      masses: [
        { id: 'base', label: 'FIXTURE BASE', role: 'primary', kind: 'mass', size: 'dominant', shape: 'oval' },
        { id: 'top', label: 'FIXTURE TOP', role: 'primary', kind: 'mass', size: 'large', shape: 'round' },
        { id: 'trail', label: 'FIXTURE TRAIL', role: 'secondary', kind: 'taper', size: 'medium', shape: 'long' },
        { id: 'stand', label: 'FIXTURE STAND', role: 'secondary', kind: 'branch', size: 'small', shape: 'thin' }
      ],
      gesture: { kind: 'upright', flow: ['base', 'top'], curve: 'gentle', facing: 'left', note: 'A fixture: a generic upright stand-in, not a creature.' },
      relationships: [ { from: 'trail', relation: 'extends-from', to: 'base', side: 'back' }, { from: 'stand', relation: 'supports', to: 'base', side: 'bottom' } ],
      proportion: [ { mass: 'top', treat: 'oversized' } ], mustSurvive: ['base', 'top'], simplify: ['everything — this is a fixture'], revealOnly: [],
      complexity: 'simple', movement: 'It does not move; it is a fixture.'
    });
  }

  // ---------------------------------------------------------------
  // THE FLOW ON THE PAGE
  // ---------------------------------------------------------------
  var doc = global.document;
  var state = { plan: null, planMeta: null, figure: null, last: null, busy: false, underlay: true };
  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(msg, kind) { var n = el('[data-translate-status]'); if (n) { n.textContent = msg || ''; n.className = 'say translate-status' + (kind ? ' ' + kind : ''); } }
  function connMode() { var C = global.LabConnection; return C ? C.status().mode : 'fixture'; }
  function unconfigured() { var C = global.LabConnection; return !!C && connMode() !== 'fixture' && /not configured/.test(C.status().line); }

  // CREATE ETHER CREATURE: plan (the model, with the picture) → compose
  // (deterministic) → load (one generated figure, one history step).
  function translate() {
    var I = global.LabImagine, C = global.LabConnection, K = global.LabEtherComposer, S = global.ShapeLab;
    if (!I || !C || !K || !S) { status('A module is not loaded.', 'warn'); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
    var analysis = I.analysis();
    var img = I.selectedImageBytes ? I.selectedImageBytes() : null;
    if (!analysis || !img) { status('Choose a picture and let it be read first — the plan is drawn from the picture and its understanding together.', 'warn'); return Promise.resolve({ ok: false, reason: 'nothing-understood' }); }
    if (state.busy) return Promise.resolve({ ok: false, reason: 'busy' });
    var mode = connMode();
    var kept = state.figure ? 'The generated figure you had is still here.' : 'Nothing changed.';
    var m = planMessages(analysis);
    var trace = { stage: 'translate', mode: mode, imageId: img.id, request: null, answer: null, parse: null, compose: null, outcome: 'pending' };
    state.last = trace;
    if (unconfigured()) {
      trace.request = 'not sent — the source is selected but not configured'; trace.outcome = 'not-configured';
      status('The source is selected but not configured — set it under Advanced, or choose Fixture. No plan was made. ' + kept, 'warn'); render();
      return Promise.resolve({ ok: false, reason: 'not-configured' });
    }
    trace.request = mode === 'fixture' ? 'none — fixture mode answers with a generic plan that says it is one' : 'sent through LabConnection (' + mode + '): the plan contract, the picture\'s understanding, and the picture — nothing else';
    state.busy = true; render();
    status(mode === 'fixture' ? 'Fixture: composing a generic stand-in plan…' : 'Asking for the structural plan (' + mode + ') — the picture and its understanding go together…');
    return C.understand({ messages: m.messages, image: { mime: img.mime, b64: img.b64 }, fixture: fixturePlan }).then(function (r) {
      state.busy = false;
      if (!r || !r.ok) {
        var reason = (r && r.reason) || 'unavailable';
        trace.answer = { ok: false, reason: reason }; trace.outcome = 'failed';
        status('The plan request failed — ' + reason + ' (' + mode + '). No fixture was substituted. ' + kept, 'warn'); render();
        return { ok: false, reason: reason };
      }
      trace.answer = { ok: true, source: r.source, model: r.model || null, chars: String(r.text || '').length };
      var v = parsePlan(r.text);
      trace.parse = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
      if (!v.ok) {
        trace.outcome = 'rejected';
        status('The plan was refused by the validator — ' + v.reasons.slice(0, 3).join(', ') + (v.reasons.length > 3 ? '…' : '') + '. Nothing was composed. ' + kept, 'warn'); render();
        return { ok: false, reason: 'invalid-plan', reasons: v.reasons };
      }
      var fig = K.compose(v.plan);
      trace.compose = fig.ok ? { ok: true, points: fig.points.length, joins: fig.joins.length, budget: fig.budget, components: fig.diagnostics.components, crossings: fig.diagnostics.crossings, dropped: fig.diagnostics.dropped } : { ok: false, reason: fig.reason };
      if (!fig.ok) {
        trace.outcome = 'uncomposable';
        status('The plan could not be composed — ' + fig.reason + '. ' + kept, 'warn'); render();
        return { ok: false, reason: fig.reason };
      }
      state.plan = v.plan; state.planMeta = { source: r.source, mode: mode, model: r.model || null, repairs: v.repairs || [], at: Date.now(), imageId: img.id, imageTitle: img.title || null };
      state.figure = fig;
      var loaded = S.loadGenerated({ budget: fig.budget, points: fig.points, roles: fig.roles, joins: fig.joins, source: r.source === 'fixture' ? 'fixture' : 'translation', subject: analysis.subject });
      trace.outcome = r.source === 'fixture' ? 'fixture' : 'generated';
      status((r.source === 'fixture' ? 'Fixture plan composed — a generic stand-in, not the creature. ' : 'Ether creature generated (' + (r.model || mode) + '): ') + fig.points.length + ' lights, ' + fig.joins.length + ' connections, ' + fig.diagnostics.components + ' piece' + (fig.diagnostics.components === 1 ? '' : 's') + (fig.diagnostics.crossings ? ', ' + fig.diagnostics.crossings + ' crossing' + (fig.diagnostics.crossings === 1 ? '' : 's') : '') + (fig.diagnostics.dropped.length ? ', no light for: ' + fig.diagnostics.dropped.join(', ') : '') + '. Judge it on the right, then adjust or approve.', 'ok');
      render();
      return { ok: true, source: r.source, points: fig.points.length, loaded: loaded };
    }).catch(function () {
      state.busy = false; trace.answer = { ok: false, reason: 'error' }; trace.outcome = 'failed';
      status('The plan request failed (' + mode + '). ' + kept, 'warn'); render();
      return { ok: false, reason: 'error' };
    });
  }

  // ---------------------------------------------------------------
  // THE SOURCE PANE and the underlay under AUTHOR
  // ---------------------------------------------------------------
  var underCanvas = null;
  function underlayShowing() { var I = global.LabImagine; return !!(state.underlay && I && I.selectedImage && I.selectedImage()); }
  function mountUnderlay() {
    var ed = el('[data-canvas-complete]');
    if (!ed || underCanvas) return;
    underCanvas = doc.createElement('canvas');
    underCanvas.className = 'source-layer';
    underCanvas.setAttribute('data-source-underlay', '');
    underCanvas.setAttribute('aria-hidden', 'true');
    ed.parentNode.insertBefore(underCanvas, ed);
  }
  var underImg = null, underImgSrc = null;
  function drawUnderlay() {
    if (!underCanvas) return;
    var ed = el('[data-canvas-complete]');
    var I = global.LabImagine;
    var sel = I && I.selectedImage ? I.selectedImage() : null;
    var showing = underlayShowing() && !!sel;
    underCanvas.hidden = !showing;
    if (!showing || !ed) return;
    var w = ed.clientWidth, h = ed.clientHeight, dpr = Math.min(2, global.devicePixelRatio || 1);
    underCanvas.style.width = w + 'px'; underCanvas.style.height = h + 'px';
    underCanvas.style.left = ed.offsetLeft + 'px'; underCanvas.style.top = ed.offsetTop + 'px';
    if (underCanvas.width !== Math.round(w * dpr)) underCanvas.width = Math.round(w * dpr);
    if (underCanvas.height !== Math.round(h * dpr)) underCanvas.height = Math.round(h * dpr);
    var g = underCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#161C33'); grad.addColorStop(1, '#1E2440');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    function paint() {
      if (!underImg || !underImg.complete || !underImg.naturalWidth) return;
      var s = Math.min(w / underImg.naturalWidth, h / underImg.naturalHeight) * 0.86;
      var dw = underImg.naturalWidth * s, dh = underImg.naturalHeight * s;
      g.globalAlpha = 0.34; g.drawImage(underImg, (w - dw) / 2, (h - dh) / 2, dw, dh); g.globalAlpha = 1;
    }
    if (underImgSrc !== sel.dataUrl) {
      underImgSrc = sel.dataUrl; underImg = new Image();
      underImg.onload = function () { drawUnderlay(); if (global.ShapeLab && global.ShapeLab.render) global.ShapeLab.render(); };
      underImg.src = sel.dataUrl;
    } else paint();
  }
  function setUnderlay(v) { state.underlay = !!v; render(); if (global.ShapeLab && global.ShapeLab.render) global.ShapeLab.render(); return state.underlay; }

  function renderSource() {
    var box = el('[data-source-img]');
    var pane = el('[data-source-pane]');
    var I = global.LabImagine;
    var sel = I && I.selectedImage ? I.selectedImage() : null;
    if (pane) pane.hidden = !sel;
    var stage = el('[data-stage]'); if (stage) stage.classList.toggle('with-source', !!sel);
    if (!box) return;
    box.innerHTML = '';
    if (!sel) return;
    var img = doc.createElement('img'); img.alt = 'Source — ' + (sel.title || sel.label); img.src = sel.dataUrl;
    box.appendChild(img);
    var cap = el('[data-source-caption]'); if (cap) cap.textContent = (sel.title ? sel.title + ' · ' : '') + sel.label;
  }

  function renderPanel() {
    var box = el('[data-translate-panel]');
    if (!box) return;
    var p = state.plan;
    if (!p) { box.innerHTML = '<div class="note">No plan yet. Once a picture has been read, press Create Ether creature.</div>'; return; }
    function h(t) { return '<div class="an-h">' + esc(t) + '</div>'; }
    var rows = [];
    var meta = state.planMeta || {};
    rows.push('<div class="srcbadge ' + (meta.source === 'fixture' ? 'fixture' : 'llm') + '">' + (meta.source === 'fixture' ? 'FIXTURE — a generic stand-in plan' : 'ETHER TRANSLATION PLAN (' + (meta.model || meta.mode) + ') · from the picture and its understanding') + '</div>');
    rows.push(h('Gesture') + '<div class="an-v">' + esc(p.gesture.kind) + ' · ' + esc(p.gesture.curve) + ' · facing ' + esc(p.gesture.facing) + ' · flow: ' + esc(p.gesture.flow.join(' → ')) + (p.gesture.note ? '<br>' + esc(p.gesture.note) : '') + '</div>');
    rows.push(h('Masses') + '<ul class="an-list">' + p.masses.map(function (m) { return '<li><b>' + esc(m.label) + '</b> — ' + esc(m.role) + ' · ' + esc(m.kind) + ' · ' + esc(m.size) + ' · ' + esc(m.shape) + '</li>'; }).join('') + '</ul>');
    rows.push(h('Relationships') + '<ul class="an-list">' + p.relationships.map(function (r) { return '<li>' + esc(r.from) + ' <i>' + esc(r.relation) + '</i> ' + esc(r.to) + (r.side ? ' · ' + esc(r.side) : '') + (r.symmetric ? ' · pair' : '') + '</li>'; }).join('') + '</ul>');
    if (p.proportion.length) rows.push(h('Proportion') + '<div class="an-v">' + p.proportion.map(function (x) { return esc(x.mass) + ': ' + esc(x.treat); }).join(' · ') + '</div>');
    rows.push(h('Must survive') + '<div class="an-v">' + esc(p.mustSurvive.join(', ')) + '</div>');
    if (p.simplify.length) rows.push(h('Simplify') + '<div class="an-v">' + esc(p.simplify.join(' · ')) + '</div>');
    if (p.revealOnly.length) rows.push(h('Could be a reveal payoff') + '<div class="an-v">' + esc(p.revealOnly.join(' · ')) + '</div>');
    rows.push(h('Complexity') + '<div class="an-v">' + esc(p.complexity) + (state.figure ? ' → ' + state.figure.points.length + ' lights, budget ' + state.figure.budget : '') + '</div>');
    if (p.movement) rows.push(h('Movement') + '<div class="an-v">' + esc(p.movement) + '</div>');
    if (meta.repairs && meta.repairs.length) rows.push(h('Tidied by the validator') + '<div class="an-v">' + esc(meta.repairs.join(' · ')) + '</div>');
    box.innerHTML = rows.join('');
  }

  function renderDiagnostics() {
    var box = el('[data-translate-diag]');
    if (!box) return;
    var f = state.figure, t = state.last;
    if (!f && !t) { box.innerHTML = '<div class="note">Nothing generated yet.</div>'; return; }
    function row(k, v, cls) { return '<div class="trow"><span class="tk">' + esc(k) + '</span><span class="tv' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span></div>'; }
    var rows = [];
    if (t) {
      rows.push(row('plan · connection', t.mode), row('plan · request', t.request || '—'));
      if (t.answer) rows.push(t.answer.ok ? row('plan · answer', 'received · labelled ' + t.answer.source + (t.answer.model ? ' · model ' + t.answer.model : '') + ' · ' + t.answer.chars + ' chars', 'good') : row('plan · answer', 'failed — ' + t.answer.reason, 'bad'));
      if (t.parse) rows.push(t.parse.ok ? row('plan · validator', 'accepted' + (t.parse.repairs.length ? ' · tidied: ' + t.parse.repairs.join(' · ') : ''), 'good') : row('plan · validator', 'refused — ' + t.parse.reasons.join(', '), 'bad'));
      if (t.compose) rows.push(t.compose.ok ? row('composer', t.compose.points + ' lights · ' + t.compose.joins + ' connections · budget ' + t.compose.budget + ' · ' + t.compose.components + ' piece(s) · ' + t.compose.crossings + ' crossing(s)' + (t.compose.dropped.length ? ' · no light for ' + t.compose.dropped.join(', ') : ''), t.compose.components === 1 ? 'good' : 'bad') : row('composer', 'could not compose — ' + t.compose.reason, 'bad'));
      rows.push(row('outcome', t.outcome, /failed|rejected|not-configured|uncomposable/.test(t.outcome) ? 'bad' : 'good'));
    }
    if (f) {
      rows.push(row('budget decision', 'complexity ' + (state.plan ? state.plan.complexity : '?') + ' → cap ' + f.diagnostics.cap + ' · ' + f.diagnostics.candidates + ' candidate lights → ' + f.diagnostics.kept + ' kept → budget ' + f.budget));
      f.diagnostics.allocation.forEach(function (a) { rows.push(row('light ' + a.light, a.mass + ' · ' + a.tag)); });
      f.joins.forEach(function (j) { rows.push(row('connection ' + j.a + '–' + j.b, j.why)); });
      f.diagnostics.notes.forEach(function (n) { rows.push(row('note', n)); });
    }
    box.innerHTML = rows.join('');
  }

  function render() {
    if (!doc) return;
    var I = global.LabImagine;
    var ready = !!(I && I.analysis && I.analysis() && I.selectedImage && I.selectedImage());
    var b = el('[data-translate-go]'); if (b) b.disabled = !ready || state.busy;
    var sec = el('[data-translate-section]'); if (sec) { sec.setAttribute('data-translate-outcome', state.last ? state.last.outcome : 'none'); }
    var tg = el('[data-source-under]'); if (tg) { tg.textContent = 'SOURCE UNDER — ' + (state.underlay ? 'ON' : 'OFF'); tg.classList.toggle('on', state.underlay); tg.disabled = !(I && I.selectedImage && I.selectedImage()); }
    var cp = el('[data-translate-copy]'); if (cp) cp.disabled = !state.plan;
    renderSource(); mountUnderlay(); drawUnderlay(); renderPanel(); renderDiagnostics();
  }

  function wire() {
    var go = el('[data-translate-go]'); if (go) go.addEventListener('click', function () { translate(); });
    var tg = el('[data-source-under]'); if (tg) tg.addEventListener('click', function () { setUnderlay(!state.underlay); });
    var cp = el('[data-translate-copy]');
    if (cp) cp.addEventListener('click', function () { var ta = el('[data-translate-json]'); if (!ta) return; ta.value = state.plan ? JSON.stringify({ plan: state.plan, figure: state.figure && { points: state.figure.points, roles: state.figure.roles, joins: state.figure.joins, budget: state.figure.budget } }, null, 1) : ''; ta.hidden = !ta.value; if (!ta.hidden) ta.select(); });
    var I = global.LabImagine; if (I && I.observe) I.observe(render);
    var S = global.ShapeLab; if (S && S.observe) S.observe(function () { drawUnderlay(); });
    global.addEventListener('resize', function () { drawUnderlay(); });
    render();
  }
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire); else wire(); }

  var api = {
    LIMITS: LIMITS, SCHEMA: SCHEMA, ROLES: ROLES.slice(), KINDS: KINDS.slice(), SIZES: SIZES.slice(), SHAPES: SHAPES.slice(), GESTURES: GESTURES.slice(), CURVES: CURVES.slice(),
    FACINGS: FACINGS.slice(), RELATIONS: RELATIONS.slice(), SIDES: SIDES.slice(), TREATS: TREATS.slice(), COMPLEXITIES: COMPLEXITIES.slice(), FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(),
    planMessages: planMessages, validatePlan: validatePlan, parsePlan: parsePlan, fixturePlan: fixturePlan,
    translate: translate, setUnderlay: setUnderlay, underlayShowing: underlayShowing,
    plan: function () { return state.plan ? JSON.parse(JSON.stringify(state.plan)) : null; },
    planMeta: function () { return state.planMeta ? JSON.parse(JSON.stringify(state.planMeta)) : null; },
    figure: function () { return state.figure ? JSON.parse(JSON.stringify(state.figure)) : null; },
    last: function () { return state.last ? JSON.parse(JSON.stringify(state.last)) : null; },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabTranslate = api;
  else global.LabTranslate = api;
})(typeof window !== 'undefined' ? window : this);
