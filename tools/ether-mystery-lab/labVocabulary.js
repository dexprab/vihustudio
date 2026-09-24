// tools/ether-mystery-lab/labVocabulary.js — THE OPEN ETHER VOCABULARY:
// what a visual MEANS, what the compiler can DRAW, and the seam between
// them where a model may propose a meaning the vocabulary lacks.
//
// SPRINT — Ether grammar V2, close the loop (Decision 58, Lab only).
//
// THREE THINGS, KEPT APART.
//
//   A. SEMANTIC VOCABULARY — what a visual relationship means. The base
//      terms are the composer's own composition primitives (flow, mass,
//      taper, span, branch, terminal, enclosure, transition, attachment).
//      This list may GROW: a model looking at a picture may find that no
//      term expresses what it sees and propose one.
//
//   B. AN EXTENSION PROPOSAL — declarative data, never code. A name, a
//      meaning, why the current vocabulary is insufficient, what visual
//      relationship it expresses, which existing terms it composes with,
//      what it affects (silhouette · structure · identity · reveal),
//      examples — and a CONSTRUCTION: one base term plus a handful of
//      renderer capabilities from the closed list below. That is how a
//      meaning reaches the compiler without a line of code: the model
//      says "a wing membrane is a span, outlined, swept back, mirrored",
//      and the compiler either can do every one of those things or it
//      says NOT EXPRESSIBLE and names what it cannot do.
//
//   C. RENDERER CAPABILITIES — the closed, reviewable list of what the
//      deterministic compiler can actually draw beyond its base
//      primitives. Seven, and every one generic: outline · curl · flare
//      · lobe · continuous · sweep · mirror. No creature word anywhere;
//      no capability exists for one species. Adding a capability is a
//      code change in the composer, reviewed; a proposal can never add
//      one by naming it.
//
// THE VOCABULARY DECISION. For a picture, with its understanding and its
// plan beside it, the model answers exactly one of SUPPORTED ·
// EXTENSION_REQUIRED · NOT_EXPRESSIBLE, proposes extensions if it must,
// binds terms to the plan's masses, offers reveal-only features from the
// reveal vocabulary, and writes the leading hint. The compiler then
// decides, per extension, whether the construction is made of things it
// can do. RESEARCH ONLY: nothing here is persisted into a fixture,
// nothing reaches a candidate, and nothing reaches production.
//
// NO CREATURE CATALOGUE. There is no species word and no `subject ===`
// in this file; the suite scans for both. A proposal carrying a key that
// would scope it to one creature (species, subject, creature, onlyFor,
// when, if) is refused by name — a rule for one animal is exactly what
// this experiment exists to avoid.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // A. the semantic vocabulary — base terms, with meanings
  // ---------------------------------------------------------------
  var SEMANTIC = {
    flow: { meaning: 'the run of masses along the dominant gesture — the main body line', affects: ['structure', 'silhouette'] },
    mass: { meaning: 'a body of some size and shape, given a stretch of the flow and, when it dominates, volume across it', affects: ['silhouette'] },
    taper: { meaning: 'something that leaves a mass and thins to a tip — a tail, a trunk, a neck', affects: ['silhouette', 'identity'] },
    span: { meaning: 'something that reaches out and back from a mass — a wing, a fin, an ear', affects: ['silhouette', 'identity'] },
    branch: { meaning: 'limbs that leave a mass toward the ground or out to a side', affects: ['structure'] },
    terminal: { meaning: 'a small thing at the end of something — a horn, a beak, a tusk', affects: ['identity'] },
    enclosure: { meaning: 'something that surrounds a mass — a mane, a halo, a cloud', affects: ['silhouette', 'identity'] },
    transition: { meaning: 'the boundary between two masses on the flow — what makes a neck a neck', affects: ['structure'] },
    attachment: { meaning: 'the place on a parent where a child structure joins it', affects: ['structure'] }
  };

  // ---------------------------------------------------------------
  // C. renderer capabilities — closed, deterministic, generic
  // ---------------------------------------------------------------
  var CAPABILITIES = {
    outline: { meaning: 'a reaching structure is closed into a silhouette: a leading edge AND a trailing edge back to the body, so it reads as a shape and not a stick', on: ['span', 'taper'] },
    curl: { meaning: 'a taper bends back on itself as it thins, so the tip returns toward the body instead of pointing away', on: ['taper'] },
    flare: { meaning: 'the end of a taper or terminal widens into two — a fork, a fan, a pair of lobes', on: ['taper', 'terminal'] },
    lobe: { meaning: 'a mass is given a broad flat far edge instead of a pointed one — a crown, a brow, a wide top', on: ['mass'] },
    continuous: { meaning: 'two masses on the flow become one continuous form: no boundary light, and their silhouettes join across', on: ['flow', 'mass', 'transition'] },
    sweep: { meaning: 'a reaching structure leans in a named direction — back behind the shoulder, forward, up, or down', on: ['span', 'taper'], values: ['back', 'forward', 'up', 'down'] },
    mirror: { meaning: 'the structure exists once on each side of the body, reflected across the flow', on: ['span', 'branch', 'terminal', 'taper'] }
  };
  var AFFECTS = ['silhouette', 'structure', 'identity', 'reveal'];
  var DECISIONS = ['SUPPORTED', 'EXTENSION_REQUIRED', 'NOT_EXPRESSIBLE'];
  var REVEAL_TYPES = ['contour', 'fill', 'lines', 'texture', 'spike', 'glow', 'motes'];
  // A REVEAL CANDIDATE is semantic data: what it is, why it matters, how
  // much, what part it plays, how it should arrive. The compiler
  // classifies each — SUPPORTED_REVEAL when its kind is one of the seven
  // reveal primitives and it names a mass; REQUIRES_EXTENSION when the
  // model needed a word the renderer has no primitive for (kept as
  // research information, never implemented by itself); NOT_SUITABLE
  // when it attaches to nothing.
  var REVEAL_ROLES = ['diagnostic', 'character', 'texture', 'accent', 'magic'];
  var REVEAL_APPEARANCES = ['emerge', 'appear', 'glow', 'unfold', 'wake'];
  var REVEAL_IMPORTANCE = ['high', 'medium', 'low'];
  var REVEAL_SUPPORT = ['SUPPORTED_REVEAL', 'REQUIRES_EXTENSION', 'NOT_SUITABLE_FOR_REVEAL'];
  var LIMITS = { extensionsMax: 6, nameChars: 32, textChars: 240, examplesMax: 5, composesMax: 4, modifiersMax: 4, applyMax: 12, termsPerMass: 3, revealMax: 4, hintMin: 8, hintMax: 90 };

  // Keys that would scope a proposal to one creature, or turn it into
  // geometry or code — refused BY NAME at any depth.
  var FORBIDDEN_KEYS = ['species', 'subject', 'creature', 'animal', 'onlyFor', 'appliesTo', 'when', 'if', 'else', 'condition', 'rule', 'template',
    'points', 'point', 'x', 'y', 'coordinates', 'coords', 'polygon', 'polyline', 'path', 'svg', 'canvas', 'code', 'script', 'function', 'js', 'html', 'css',
    'draw', 'render', 'renderer', 'geometry', 'angle', 'radius', 'position', 'positions', 'anchor', 'anchors',
    'url', 'href', 'src', 'image', 'img', 'base64', 'data', 'token', 'key', 'card', 'cardId', 'owner', 'email', 'memories', 'memory', 'orbit', 'circle',
    'username', 'creator', 'companion', 'story', 'session', 'pattern', 'cells', 'constellation', 'stars'];
  var BAD_TEXT = /https?:\/\/|\bwww\.|data:|<[a-z/!?]|\bsk-[A-Za-z0-9_-]{8,}/i;
  var GEOMETRIC_TEXT = /\[\s*-?\d|\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d|\b\d+\s*px\b|<svg|<path|\bd="|-?\d+\.\d+\s*,\s*-?\d+\.\d+|\bviewBox\b/i;
  var EXECUTABLE_TEXT = /function\s*\(|=>|\bctx\.|\beval\(|\brequire\(|\bimport\s|console\.|\$\{|\{\{|;\s*\}|<\/?[a-z]+>|===|!==|\bif\s*\(/i;
  // A hint is an invitation, never an instruction: none of these may be
  // in it, nor a digit, nor the subject's own name.
  var HINT_INSTRUCTION = /\b(connect|join|tap|click|press|touch|dot|dots|line|lines|draw|complete|finish|puzzle|solve|link|point|points|star|stars|light|lights)\b/i;
  var HINT_UNKIND = /\b(kill|dead|die|dies|death|blood|bleed|scary|monster|attack|hurt|weapon)\b/i;
  // A hint names a being's NATURE — a hunter of the open sky, a giant of
  // the frozen north — never its anatomy: a line that lists wings and
  // horns is the answer read out, not an invitation (the first real run:
  // "a mythical creature with wings and fiery breath").
  var HINT_PARTS = /\b(wings?|tails?|horns?|arms?|legs?|fins?|trunks?|ears?|manes?|claws?|beaks?|teeth|tusks?|paws?|feathers?|scales|tentacles?|hooves|snout|spikes?)\b/i;

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
  function token(v, n) { return typeof v === 'string' ? v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n || LIMITS.nameChars) : ''; }
  function text(v, n) { return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n || LIMITS.textChars) : ''; }
  function list(v, max, f) { if (!Array.isArray(v)) return []; return v.slice(0, max).map(f).filter(function (x) { return x; }); }

  // ---------------------------------------------------------------
  // B. an extension proposal — validated, and judged by the compiler
  // ---------------------------------------------------------------
  // construction: { base: <semantic term>, modifiers: [ capability | capability:value ] }
  function parseModifier(m) {
    var s = typeof m === 'string' ? m.trim().toLowerCase() : '';
    var parts = s.split(':');
    var cap = token(parts[0]), val = parts.length > 1 ? token(parts.slice(1).join(':')) : null;
    if (!cap) return null;
    return { cap: cap, value: val };
  }
  function validateExtension(raw, i, vocabulary) {
    var where = 'extensions[' + i + ']';
    var reasons = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['bad-extension:' + i] };
    var name = token(raw.name);
    if (!name || name.length < 3) reasons.push('bad-name:' + where);
    if (SEMANTIC[name] || CAPABILITIES[name]) reasons.push('name-is-already-a-term:' + where + ':' + name);
    var meaning = text(raw.meaning), why = text(raw.whyNeeded), expresses = text(raw.expresses), effect = text(raw.visualEffect);
    if (!meaning) reasons.push('no-meaning:' + where);
    if (!why) reasons.push('no-why:' + where);
    var composes = list(raw.composesWith, LIMITS.composesMax, function (t) { return token(t); });
    // it composes with existing vocabulary: a semantic term, a compiler
    // capability, or an extension proposed beside it (the first real run
    // refused "outline/flare" as unknown — a capability IS vocabulary)
    var unknownComposes = composes.filter(function (t) { return !SEMANTIC[t] && !CAPABILITIES[t] && !(vocabulary && vocabulary[t]); });
    if (!composes.length) reasons.push('composes-with-nothing:' + where);
    if (unknownComposes.length) reasons.push('composes-with-unknown-term:' + where + ':' + unknownComposes.join('/'));
    var affects = list(raw.affects, AFFECTS.length, function (a) { var t = token(a); return AFFECTS.indexOf(t) !== -1 ? t : null; });
    if (!affects.length) reasons.push('affects-nothing:' + where);
    var examples = list(raw.examples, LIMITS.examplesMax, function (e) { return text(e, 120); });
    var c = raw.construction;
    var construction = null;
    if (!c || typeof c !== 'object' || Array.isArray(c)) reasons.push('no-construction:' + where);
    else {
      Object.keys(c).forEach(function (k) { if (['base', 'modifiers'].indexOf(k) === -1) reasons.push('unknown-key:' + where + '.construction.' + k); });
      var base = token(c.base);
      if (!SEMANTIC[base]) reasons.push('construction-base-not-a-term:' + where + ':' + (base || '?'));
      var mods = list(c.modifiers, LIMITS.modifiersMax, parseModifier);
      construction = { base: base, modifiers: mods };
    }
    Object.keys(raw).forEach(function (k) { if (['name', 'meaning', 'whyNeeded', 'expresses', 'composesWith', 'affects', 'examples', 'construction', 'visualEffect'].indexOf(k) === -1) reasons.push('unknown-key:' + where + '.' + k); });
    if (reasons.length) return { ok: false, reasons: reasons, name: name || null };
    return { ok: true, reasons: [], extension: { name: name, meaning: meaning, whyNeeded: why, expresses: expresses, visualEffect: effect, composesWith: composes, affects: affects, examples: examples, construction: construction, status: 'RESEARCH ONLY' } };
  }

  // THE COMPILER'S VERDICT on a proposal: is every modifier a capability
  // it has, on a base it applies to? A meaning the compiler cannot draw
  // is NOT EXPRESSIBLE, and the reason is the capability's name — never a
  // guess, never an approximation.
  function expressible(ext) {
    if (!ext || !ext.construction) return { ok: false, reasons: ['no-construction'] };
    var reasons = [], caps = {};
    var base = ext.construction.base;
    if (!SEMANTIC[base]) return { ok: false, reasons: ['base-not-a-term:' + base] };
    ext.construction.modifiers.forEach(function (m) {
      var cap = CAPABILITIES[m.cap];
      if (!cap) { reasons.push('no-such-capability:' + m.cap); return; }
      if (cap.on.indexOf(base) === -1) { reasons.push('capability-not-on-base:' + m.cap + '/' + base); return; }
      if (cap.values) {
        if (!m.value || cap.values.indexOf(m.value) === -1) { reasons.push('capability-needs-a-value:' + m.cap + ':' + cap.values.join('|')); return; }
        caps[m.cap] = m.value;
      } else caps[m.cap] = true;
    });
    if (reasons.length) return { ok: false, reasons: reasons };
    return { ok: true, reasons: [], base: base, caps: caps };
  }

  // ---------------------------------------------------------------
  // THE DECISION — validated whole
  // ---------------------------------------------------------------
  function validHint(h, subject) {
    var s = text(h, 120);
    if (!s) return { ok: false, reason: 'empty' };
    if (s.length < LIMITS.hintMin || s.length > LIMITS.hintMax) return { ok: false, reason: 'length' };
    if (/\d/.test(s)) return { ok: false, reason: 'digit' };
    if (badText(s)) return { ok: false, reason: 'bad-text' };
    if (HINT_INSTRUCTION.test(s)) return { ok: false, reason: 'instruction' };
    if (HINT_UNKIND.test(s)) return { ok: false, reason: 'unkind' };
    if (HINT_PARTS.test(s)) return { ok: false, reason: 'names-a-part' };
    // the subject's own NAME may not be in the hint; a describing word in
    // the subject line — small, young, winged, friendly — may, because a
    // hint that says "something small and young is waiting" reveals nothing
    var GENERIC = /^(a|an|the|of|with|from|and|that|this|some|kind|small|little|big|large|tiny|giant|huge|being|creature|thing|animal|young|baby|old|smiling|happy|friendly|cute|winged|flying|swimming|standing|sitting|magical|mythical|gentle|wild|strong|brave|curious|playful|sleepy|bright|dark|golden|silver|blue|green|red|white|black|creatures|beings)$/;
    var words = String(subject || '').toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 2 && !GENERIC.test(w); });
    for (var i = 0; i < words.length; i++) if (new RegExp('\\b' + words[i] + 's?\\b', 'i').test(s)) return { ok: false, reason: 'names-the-subject:' + words[i] };
    return { ok: true, hint: /[.!…]$/.test(s) ? s : s + '…' };
  }

  function validateDecision(raw, plan, subject) {
    var reasons = [], repairs = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], repairs: [] };
    walkKeys(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    walkText(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    Object.keys(raw).forEach(function (k) { if (['decision', 'reason', 'extensions', 'apply', 'revealCandidates', 'hint'].indexOf(k) === -1) reasons.push('unknown-key:' + k); });
    var decision = typeof raw.decision === 'string' ? raw.decision.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
    if (DECISIONS.indexOf(decision) === -1) reasons.push('bad-decision');
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    var extensions = [], refused = [];
    var proposedNames = {};
    (Array.isArray(raw.extensions) ? raw.extensions.slice(0, LIMITS.extensionsMax) : []).forEach(function (e, i) {
      var v = validateExtension(e, i, proposedNames);
      if (v.ok) {
        if (proposedNames[v.extension.name]) { refused.push({ name: v.extension.name, reasons: ['duplicate'] }); return; }
        proposedNames[v.extension.name] = true;
        var ex = expressible(v.extension);
        v.extension.compiler = ex.ok ? { ok: true, base: ex.base, caps: ex.caps } : { ok: false, reasons: ex.reasons };
        extensions.push(v.extension);
      } else refused.push({ name: v.name, reasons: v.reasons });
    });
    if (decision === 'EXTENSION_REQUIRED' && !extensions.length && !refused.length) { repairs.push('EXTENSION_REQUIRED with no extension → SUPPORTED'); decision = 'SUPPORTED'; }
    var ids = {};
    (plan && plan.masses || []).forEach(function (m) { ids[m.id] = true; });
    var apply = [];
    (Array.isArray(raw.apply) ? raw.apply.slice(0, LIMITS.applyMax) : []).forEach(function (a, i) {
      if (!a || typeof a !== 'object') { repairs.push('apply[' + i + '] dropped'); return; }
      Object.keys(a).forEach(function (k) { if (['mass', 'terms'].indexOf(k) === -1) reasons.push('unknown-key:apply[' + i + '].' + k); });
      var id = token(a.mass);
      if (!ids[id]) { repairs.push('apply[' + i + '] names no mass — dropped'); return; }
      var terms = list(a.terms, LIMITS.termsPerMass, function (t) { return token(t); }).filter(function (t) { return SEMANTIC[t] || proposedNames[t] || CAPABILITIES[t] || /^sweep:/.test(t); });
      if (!terms.length) { repairs.push('apply[' + i + '] names no known term — dropped'); return; }
      apply.push({ mass: id, terms: terms });
    });
    var reveal = [];
    (Array.isArray(raw.revealCandidates) ? raw.revealCandidates.slice(0, LIMITS.revealMax) : []).forEach(function (r, i) {
      if (!r || typeof r !== 'object') { repairs.push('revealCandidates[' + i + '] dropped'); return; }
      Object.keys(r).forEach(function (k) { if (['name', 'reason', 'importance', 'role', 'appearance', 'near', 'kind'].indexOf(k) === -1) reasons.push('unknown-key:revealCandidates[' + i + '].' + k); });
      var name = text(r.name, 24).toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name) { repairs.push('revealCandidates[' + i + '] has no name — dropped'); return; }
      var kind = token(r.kind), near = token(r.near);
      var role = REVEAL_ROLES.indexOf(token(r.role)) !== -1 ? token(r.role) : 'character';
      var appearance = REVEAL_APPEARANCES.indexOf(token(r.appearance)) !== -1 ? token(r.appearance) : 'appear';
      var importance = REVEAL_IMPORTANCE.indexOf(token(r.importance)) !== -1 ? token(r.importance) : 'medium';
      var support, why;
      if (!ids[near]) { support = 'NOT_SUITABLE_FOR_REVEAL'; why = 'it names no part of the figure to attach to'; }
      else if (REVEAL_TYPES.indexOf(kind) !== -1) { support = 'SUPPORTED_REVEAL'; why = 'drawn as ' + kind; }
      else { support = 'REQUIRES_EXTENSION'; why = 'no reveal primitive for "' + (kind || '?') + '" — research information only'; }
      reveal.push({ name: name, reason: text(r.reason, 160), importance: importance, role: role, appearance: appearance, near: ids[near] ? near : null, kind: REVEAL_TYPES.indexOf(kind) !== -1 ? kind : null, wanted: kind || null, support: support, why: why });
    });
    var hint = null;
    if (raw.hint !== undefined) {
      var vh = validHint(raw.hint, subject);
      if (vh.ok) hint = vh.hint; else repairs.push('hint refused (' + vh.reason + ')');
    }
    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    return { ok: true, reasons: [], repairs: repairs, decision: { decision: decision, reason: text(raw.reason), extensions: extensions, refused: refused, apply: apply, revealCandidates: reveal, hint: hint } };
  }
  function parseDecision(txt, plan, subject) {
    if (typeof txt !== 'string' || !txt.trim()) return { ok: false, reasons: ['empty'], repairs: [] };
    var t = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'], repairs: [] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'], repairs: [] }; }
    }
    return validateDecision(obj, plan, subject);
  }

  // ---------------------------------------------------------------
  // THE REQUEST. Text only: the understanding, the plan, and the
  // vocabulary as it stands. The picture is attached by the transport
  // when the caller has one.
  // ---------------------------------------------------------------
  function decisionMessages(analysis, plan) {
    if (!analysis || !plan) return { ok: false, reason: 'no-plan' };
    var vocab = Object.keys(SEMANTIC).map(function (k) { return k + ' — ' + SEMANTIC[k].meaning; });
    var caps = Object.keys(CAPABILITIES).map(function (k) { var c = CAPABILITIES[k]; return k + (c.values ? ' (' + c.values.join('|') + ')' : '') + ' — ' + c.meaning + ' [on: ' + c.on.join(', ') + ']'; });
    var ctx = { subject: analysis.subject, composition: analysis.composition, architecture: analysis.architecture, diagnosticFeatures: analysis.diagnosticFeatures, gesture: analysis.gesture, abstraction: analysis.abstraction, revealCandidates: analysis.revealCandidates };
    var system = [
      'You are the vocabulary reviewer between a picture of a being and a drawing system that places a handful of bright points and joins some with straight lines. You will see the picture, the description written of it, the structural plan already made for it, and the CURRENT ETHER VOCABULARY — the meanings the system has, and the closed list of what its compiler can draw. Answer ONE question: can this visual be expressed faithfully with the current vocabulary?',
      'Return exactly one decision: SUPPORTED (every visual relationship that carries this being\'s identity has a term), EXTENSION_REQUIRED (the being needs a visual relationship no term expresses — propose it), or NOT_EXPRESSIBLE (what carries its identity cannot be made of points and lines at all).',
      'AN EXTENSION IS A MEANING, NEVER A DRAWING. It names a GENERIC visual relationship — never a body part of one kind of animal, never a rule for one creature. Ask "what visual relationship does this picture need?", not "is there a term for a wing". A wing may need: a span, outlined so it is a shape, swept back, mirrored. A flowing tail may need: a taper that is continuous with the body and curls. Give each extension a construction: ONE base term from the vocabulary and up to four modifiers from the compiler\'s capability list (sweep needs a value, e.g. "sweep:back"). If a needed modifier is not on that list, name your own word for it anyway — the compiler will say it cannot draw it, and that is the honest answer.',
      'CURRENT VOCABULARY (semantic terms):\n' + vocab.join('\n'),
      'COMPILER CAPABILITIES (the only modifiers that can be drawn):\n' + caps.join('\n'),
      'Then BIND terms to the plan\'s masses in "apply": for each mass that should be drawn with a base term\'s capability or with one of your extensions, name the mass and the terms (an extension by its name; a capability directly by its name, sweep as "sweep:back").',
      'REVEAL CANDIDATES. Points build the being; the reveal makes it come alive. A reveal feature is something visible in THIS picture that contributes to identity or character, can be withheld without destroying recognition of the unfinished being, and adds impact when it appears after completion — horns, an eye that lights, back spikes, a mane, flowing hair, a tail tuft, tusks, feather detail, a wing\'s membrane. Never a structural part (a body, a head, the legs, the wing structure). Offer up to four, most important first, each near a mass of the plan: name, reason, importance (high | medium | low), role (diagnostic | character | texture | accent | magic), appearance (emerge | appear | glow | unfold | wake), and kind — the reveal primitive it would be drawn with: contour (flowing strokes: mane, hair), fill (a soft silhouette: membrane, fin, lobe), lines (accents across a part: stripes, feathers, rings), texture (a field of small marks: scales), spike (tapered appendages: horns, tusks, ridges), glow (one soft light: an eye, a lantern), motes (drifting lights). If none of those seven fits, give your own word for the kind — the compiler will say it needs an extension.',
      'And write a leading HINT: one short child-friendly line that says what KIND of being is waiting — its nature, where it lives, what it does — without naming it and without telling anyone what to do. Like "A hunter of the open sky is waiting…" or "A giant of the frozen north is waiting…" or "Something ancient is waiting to wake…". NEVER list its body parts (no wings, tail, horns, arms, fins, trunk, ears, mane); a line that describes what it looks like is the answer read out, not an invitation. Never the subject\'s name, never an instruction, never a number.',
      'Words only. Never a coordinate, an outline, a number, SVG, code or markup. Answer with ONE JSON object and nothing else:',
      '{',
      '  "decision": "SUPPORTED | EXTENSION_REQUIRED | NOT_EXPRESSIBLE",',
      '  "reason": "one sentence",',
      '  "extensions": [ { "name": "a-short-hyphenated-name", "meaning": "...", "whyNeeded": "why the current vocabulary is insufficient", "expresses": "the visual relationship it expresses", "visualEffect": "what changes on the figure", "composesWith": ["existing terms"], "affects": ["silhouette | structure | identity | reveal"], "examples": ["visual situations where it is useful"], "construction": { "base": "a base term", "modifiers": ["capability", "sweep:back"] } } ],',
      '  "apply": [ { "mass": "a mass id from the plan", "terms": ["an extension name or a capability"] } ],',
      '  "revealCandidates": [ { "name": "CAPITALS", "reason": "why it matters after completion", "importance": "high | medium | low", "role": "diagnostic | character | texture | accent | magic", "appearance": "emerge | appear | glow | unfold | wake", "near": "a mass id", "kind": "contour | fill | lines | texture | spike | glow | motes" } ],',
      '  "hint": "..."',
      '}',
      'No other keys.'
    ].join('\n');
    var user = 'The description of the picture:\n' + JSON.stringify(ctx, null, 1) + '\nThe structural plan already made from it:\n' + JSON.stringify({ masses: plan.masses, gesture: plan.gesture, relationships: plan.relationships, mustSurvive: plan.mustSurvive }, null, 1) + '\nDecide whether the current vocabulary can express this being, and answer in the shape above.';
    return { ok: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  // THE FIXTURE DECISION — for a session with no model: SUPPORTED, no
  // extension, no binding, a generic hint. It says it is a fixture.
  function fixtureDecision() {
    return JSON.stringify({ decision: 'SUPPORTED', reason: 'Fixture: no model looked, so the vocabulary is taken as sufficient and nothing is bound.', extensions: [], apply: [], revealCandidates: [], hint: 'Something is waiting…' });
  }

  // ---------------------------------------------------------------
  // RESOLVE — the compiler's own step: a decision becomes, per mass,
  // the set of capabilities the composer may use. Mode 'base' ignores
  // every extension and every binding (the current vocabulary alone);
  // mode 'extended' honours the bindings whose constructions the
  // compiler can express. An extension the compiler refused contributes
  // NOTHING, and says so.
  // ---------------------------------------------------------------
  function resolve(decision, mode) {
    var out = { mode: mode === 'extended' ? 'extended' : 'base', caps: {}, used: [], notExpressible: [], ignored: [] };
    if (out.mode === 'base' || !decision) return out;
    var byName = {};
    (decision.extensions || []).forEach(function (e) { byName[e.name] = e; });
    (decision.apply || []).forEach(function (a) {
      var caps = out.caps[a.mass] || (out.caps[a.mass] = {});
      a.terms.forEach(function (t) {
        var m = parseModifier(t);
        if (byName[t]) {
          var ex = byName[t];
          if (ex.affects.length === 1 && ex.affects[0] === 'reveal') { caps.revealOnly = true; if (out.used.indexOf(t) === -1) out.used.push(t); }
          else if (ex.compiler && ex.compiler.ok) { Object.keys(ex.compiler.caps).forEach(function (k) { caps[k] = ex.compiler.caps[k]; }); if (out.used.indexOf(t) === -1) out.used.push(t); }
          else out.notExpressible.push({ mass: a.mass, term: t, reasons: (ex.compiler && ex.compiler.reasons) || ['refused'] });
        } else if (m && CAPABILITIES[m.cap]) {
          var cap = CAPABILITIES[m.cap];
          if (cap.values) { if (m.value && cap.values.indexOf(m.value) !== -1) caps[m.cap] = m.value; else out.ignored.push(a.mass + ':' + t); }
          else caps[m.cap] = true;
        } else if (!SEMANTIC[t]) out.ignored.push(a.mass + ':' + t);
      });
    });
    return out;
  }

  var api = {
    SEMANTIC: SEMANTIC, CAPABILITIES: CAPABILITIES, AFFECTS: AFFECTS.slice(), DECISIONS: DECISIONS.slice(), REVEAL_TYPES: REVEAL_TYPES.slice(), LIMITS: LIMITS, FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(),
    REVEAL_ROLES: REVEAL_ROLES.slice(), REVEAL_APPEARANCES: REVEAL_APPEARANCES.slice(), REVEAL_IMPORTANCE: REVEAL_IMPORTANCE.slice(), REVEAL_SUPPORT: REVEAL_SUPPORT.slice(),
    validateExtension: validateExtension, expressible: expressible, validateDecision: validateDecision, parseDecision: parseDecision, validHint: validHint,
    decisionMessages: decisionMessages, fixtureDecision: fixtureDecision, resolve: resolve
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabVocabulary = api;
  else global.LabVocabulary = api;
})(typeof window !== 'undefined' ? window : this);
