// tools/ether-mystery-lab/labImagine.js — PROMPT → ARTISTIC VISUAL →
// CHOOSE / REFINE → IMAGE UNDERSTANDING. The Shape Lab's new front door.
//
// SPRINT — Shape Lab: prompt → artistic creature → image understanding,
// proof V1 (Decision 58, Lab only).
//
// WHAT THIS IS. A researcher says what should exist — "a smiling dragon
// with enormous wings" stays exactly that sentence, never reduced to a
// noun — and gets several artistic interpretations to look at. They
// choose one, refine the idea if they like, and the CHOSEN IMAGE is then
// read by the model's image understanding into a structured, semantic
// description: subject, character, composition, masses, diagnostic
// features, modifiers, proportion, gesture, what should survive an
// abstraction, and what could be a reveal-only payoff.
//
// WHAT THIS IS NOT. It stops there. Nothing in this file turns an image
// into points, joins, missing joins or reveal geometry, and nothing in it
// reaches the Ether. The analysis contract has no field for any of those
// and refuses them by name (deny by shape — Decision 33's discipline).
//
// THE ARTISTIC SOURCE IS A PROVIDER, AND ONE OF THEM IS UNAVAILABLE
// TODAY. Two providers stand behind CREATE: `fixture` — existing
// artwork (the product's own Companions and openly-licensed creature
// art, labArtworkData.js), CHOSEN rather than generated — and
// `openai-image` — a real image model through LabConnection.imagine().
// The account this sprint ran on has no image-generation access, so
// the second answers UNAVAILABLE; that answer comes from the transport
// (the provider's own `no-image-model`), never from a flag written here,
// so the day the account has an image model nothing in this file
// changes. The UI says ARTISTIC SOURCE: Fixture, and never implies a
// model drew what a person chose.
//
// THE IMAGE IS THE SOURCE OF TRUTH. The understanding step is asked to
// describe what is VISIBLE. The creative prompt travels as context and
// the model is told plainly that where the picture and the prompt
// disagree, the picture wins — and to say so in `promptFidelity`.
//
// LABELLED AT THE TRANSPORT, NEVER GUESSED FROM A REPLY: `fixture`
// (existing artwork), `generated` (a real image model), `uploaded` (the
// researcher's own picture). A failed real call FAILS on screen and
// keeps whatever was there; nothing is ever substituted.
//
// NO CREATURE CATALOGUE. No `subject === …`, no species branch, no
// hidden picture. The fixture gallery is ordered by word overlap over
// DATA and the researcher chooses by looking.
//
// NOTHING PERSISTS. Ideas, the selection and the analysis live in this
// closure for the life of the page. No storage, no export, no fixture
// record carries an image or an analysis.

(function (global) {
  'use strict';

  var LIMITS = {
    promptMin: 3, promptChars: 200,
    refineChars: 200, refinementsMax: 6,
    options: 3, optionsMax: 4,
    imageBytes: 6 * 1024 * 1024,        // an uploaded or generated image, decoded
    generationsKept: 12,                // sets of ideas kept for "bring back previous"
    text: 400, phrase: 80,              // one analysis sentence / one list item
    listMax: 10
  };
  var OPTIONS_DEFAULT = LIMITS.options;
  var IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
  var SOURCES = ['fixture', 'generated', 'uploaded'];
  var AGREEMENTS = ['matches', 'partly', 'differs'];

  // THE ARTISTIC IMAGE GENERATION PROVIDERS. A table, never a branch:
  // adding a provider is a row and a transport, not an edit here.
  var PROVIDERS = {
    'fixture': { id: 'fixture', label: 'Fixture — existing artwork', kind: 'fixture', line: 'Existing pictures — the product\'s own Companions and openly-licensed creature art — chosen by you, never generated. Nothing is sent anywhere to make them.' },
    'openai-image': { id: 'openai-image', label: 'OpenAI image generation', kind: 'model', line: 'A real image model, through the connection chosen under Source. Reports UNAVAILABLE when the account has no image model; nothing is substituted.' }
  };

  // Keys that would turn a description into geometry, code, a reference
  // to a private thing, or a runtime instruction. Refused BY NAME at any
  // depth, and the whole analysis is refused with them.
  var FORBIDDEN_KEYS = ['points', 'point', 'joins', 'join', 'missing', 'gaps', 'gap', 'x', 'y', 'coordinates', 'coords',
    'polygon', 'polyline', 'path', 'paths', 'svg', 'pixels', 'px', 'anchor', 'anchors', 'position', 'positions',
    'geometry', 'shape', 'shapes', 'canvas', 'code', 'script', 'html', 'css', 'js', 'url', 'href', 'src', 'image', 'img',
    'base64', 'data', 'reveal', 'hint', 'tease', 'candidate', 'arrangement', 'figure',
    'pattern', 'cells', 'constellation', 'stars', 'card', 'cardId', 'owner', 'ownerId', 'email', 'memories', 'memory',
    'orbit', 'circle', 'username', 'creator', 'companion', 'story', 'session', 'token', 'key'];

  // Text that is not a description: a link, a data URI, markup, code, a
  // coordinate, a pixel measure, something shaped like a credential.
  var BAD_TEXT = /https?:\/\/|\bwww\.|data:|<[a-z/!?]|\bsk-[A-Za-z0-9_-]{8,}/i;
  var GEOMETRIC_TEXT = /\[\s*-?\d|\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d|\b\d+\s*px\b|<svg|<path|\bd="|\bM\s*\d+[\s,]\d|\d+\s*,\s*\d+\s*(?:,|\)|\])|\bviewBox\b/i;
  var EXECUTABLE_TEXT = /function\s*\(|=>|\bctx\.|\beval\(|\brequire\(|\bimport\s|console\.|\$\{|\{\{|;\s*\}|<\/?[a-z]+>/i;

  // ---------------------------------------------------------------
  // THE ANALYSIS CONTRACT — written down, so the prompt, the validator
  // and the page cannot drift. Every value is a word, a sentence or a
  // list of them. Nothing here is a number, a position or a shape.
  // ---------------------------------------------------------------
  var SCHEMA = {
    subject: 'string — what is depicted, in a few words (a real animal, a mythical being, a hybrid, an invented creature)',
    character: 'array of 1–6 short words or phrases — what the visual communicates (graceful, playful, majestic, sleepy…)',
    composition: 'string — one or two sentences: the dominant visual organisation (a long flowing gesture, a compact grounded body, a sweeping diagonal, an expansive wing span…)',
    architecture: 'array of 1–8 phrases or sentences — the major masses and how they relate to each other (what sits on what, what grows from where, what hangs from what); conventional anatomy is NOT forced on an image that does not contain it',
    diagnosticFeatures: 'array of 1–10 short names — the features that make THIS concept recognisable (mane, horns, hooked beak, broad tail fin, trunk…)',
    modifiers: 'array of 0–8 short phrases — the creative modifications actually visible (smiling, oversized, tiny, winged, curled, long-tailed, multi-armed…)',
    proportion: 'string — one or two sentences: what is exaggerated, compressed or dominant, in words',
    gesture: 'string — one or two sentences: how the whole creature flows through space, and whether it reads as ONE coherent gesture or as a collection of parts',
    abstraction: 'object { survives: array of 1–8 phrases (what must survive a translation into a few lights and lines), doNotDrawLiterally: array of 0–8 phrases, note: optional sentence }',
    revealCandidates: 'array of 0–8 short names — features that could be a reveal-only payoff later (a mane, a wing membrane, stripes); names only, never geometry',
    promptFidelity: 'object { agreement: "matches" | "partly" | "differs", differences: array of 0–6 phrases } — whether the PICTURE shows what the prompt asked for; the picture is described as it is'
  };
  var REQUIRED = ['subject', 'character', 'composition', 'architecture', 'diagnosticFeatures', 'proportion', 'gesture', 'abstraction'];

  // ---------------------------------------------------------------
  // THE RESEARCHER'S WORDS — validated, never rewritten.
  // ---------------------------------------------------------------
  function cleanText(v, max) {
    if (v == null) return '';
    var s = String(v).trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (s.length > max) return null;
    if (!/^[A-Za-z0-9 ,.;:'"!?()&\-]*$/.test(s)) return null;
    if (BAD_TEXT.test(s) || EXECUTABLE_TEXT.test(s)) return null;
    if (!/[A-Za-z]/.test(s)) return null;
    return s;
  }
  function cleanPrompt(p) {
    var s = cleanText(p, LIMITS.promptChars);
    if (s === null || !s) return null;
    if (s.length < LIMITS.promptMin) return null;
    return s;
  }
  function cleanRefinement(r) {
    var s = cleanText(r, LIMITS.refineChars);
    if (s === null) return null;
    return s;                                     // '' means no refinement
  }
  function cleanRefinements(list) {
    var out = [];
    (list || []).forEach(function (r) { var c = cleanRefinement(r); if (c) out.push(c); });
    return out.slice(0, LIMITS.refinementsMax);
  }

  // ---------------------------------------------------------------
  // THE GENERATION PROMPT. The researcher's creative intent, verbatim,
  // then the refinements in order, then fixed PRESENTATION constraints —
  // what makes the picture useful as source material. No style is
  // imposed: a real animal, a hybrid, an invented being, an emotional
  // expression are all the researcher's to ask for.
  // ---------------------------------------------------------------
  var PRESENTATION = 'Presentation: one single creature, full body, the whole subject visible and centred, with a clear readable silhouette; expressive and characterful; on a plain uncluttered background. No text, no letters, no labels, no watermark, no interface, no borders, no diagram, and no second creature competing for attention. A finished, visually coherent piece of artwork suitable for a later study of its shape.';

  function imagePrompt(prompt, refinements) {
    var p = cleanPrompt(prompt);
    if (!p) return { ok: false, reason: 'bad-prompt' };
    var rs = cleanRefinements(refinements);
    var lines = [p + (/[.!?]$/.test(p) ? '' : '.')];
    rs.forEach(function (r) { lines.push('Refinement: ' + r + (/[.!?]$/.test(r) ? '' : '.')); });
    lines.push(PRESENTATION);
    return { ok: true, prompt: p, refinements: rs, text: lines.join('\n') };
  }

  // ---------------------------------------------------------------
  // THE UNDERSTANDING REQUEST. The image is attached by the transport;
  // this builds the words around it. The picture is the source of truth
  // and the contract says so in the model's own instructions.
  // ---------------------------------------------------------------
  function understandMessages(prompt, refinements) {
    var p = cleanPrompt(prompt);
    var rs = cleanRefinements(refinements);
    var system = [
      'You are studying ONE picture of a creature for a designer who will later translate it into a very abstract form — a handful of bright points joined by straight lines. Describe what is ACTUALLY VISIBLE in the picture, as a COMPOSITION: not only what the creature is, but how its masses sit together, where its parts attach, what its whole body is doing, and what makes this particular picture read as what it is. Words only.',
      'The creative prompt that produced the picture is given as context. The PICTURE is the source of truth: if it shows something the prompt did not ask for, or lacks something the prompt asked for, describe the picture as it is and record the difference in promptFidelity. Never describe a feature that is not visible.',
      'Answer with ONE JSON object and nothing else, exactly this shape:',
      '{',
      '  "subject": ' + SCHEMA.subject + ',',
      '  "character": ' + SCHEMA.character + ',',
      '  "composition": ' + SCHEMA.composition + ',',
      '  "architecture": ' + SCHEMA.architecture + ',',
      '  "diagnosticFeatures": ' + SCHEMA.diagnosticFeatures + ',',
      '  "modifiers": ' + SCHEMA.modifiers + ',',
      '  "proportion": ' + SCHEMA.proportion + ',',
      '  "gesture": ' + SCHEMA.gesture + ',',
      '  "abstraction": ' + SCHEMA.abstraction + ',',
      '  "revealCandidates": ' + SCHEMA.revealCandidates + ',',
      '  "promptFidelity": ' + SCHEMA.promptFidelity,
      '}',
      'Rules: every value is a word, a phrase, a sentence or a list of them. No coordinates, no pixel measures, no positions as numbers, no SVG, no paths, no polygons, no points, no joins, no code, no markup, no links. No other keys. Do not rate the picture; describe it. For a hybrid or a modified creature, say where one part becomes another and how the added parts relate to the body. The gesture field must say whether the creature reads as one coherent visual gesture or as a collection of parts.'
    ].join('\n');
    var user = 'Creative prompt: ' + (p || '(none given — describe the picture alone)') + rs.map(function (r) { return '\nRefinement: ' + r; }).join('') + '\nThe picture is attached. Describe what it shows.';
    return { ok: true, prompt: p || '', refinements: rs, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  // ---------------------------------------------------------------
  // THE VALIDATOR — deny by shape. An unknown key at any depth is
  // refused by name; a forbidden key refuses the whole analysis; a value
  // that is not words is refused; bounds are bounds. What comes out is a
  // CLEAN copy built field by field, never the model's object.
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
  function wordy(v, path, max, reasons, repairs, required) {
    if (v === undefined || v === null || v === '') { if (required) reasons.push('missing:' + path); return null; }
    if (typeof v !== 'string') { reasons.push('not-a-word:' + path); return null; }
    var s = v.trim().replace(/\s+/g, ' ');
    if (!s) { if (required) reasons.push('missing:' + path); return null; }
    if (badText(s)) { reasons.push('bad-text:' + path); return null; }
    if (s.length > max) {
      var cut = s.slice(0, max).replace(/\s+\S*$/, '');
      repairs.push(path + ' cut at a word (' + s.length + ' → ' + cut.length + ' chars)');
      s = cut;
    }
    return s;
  }
  function wordList(v, path, min, max, reasons, repairs, itemMax) {
    if (v === undefined || v === null) { if (min > 0) reasons.push('missing:' + path); return []; }
    if (!Array.isArray(v)) { reasons.push('not-a-list:' + path); return []; }
    if (v.length > max) { repairs.push(path + ' cut to ' + max + ' items (had ' + v.length + ')'); v = v.slice(0, max); }
    var out = [];
    v.forEach(function (item, i) { var w = wordy(item, path + '[' + i + ']', itemMax || LIMITS.phrase, reasons, repairs, false); if (w) out.push(w); });
    if (out.length < min) reasons.push('too-few:' + path);
    return out;
  }

  function validateAnalysis(raw) {
    var reasons = [], repairs = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], repairs: [] };
    walkKeys(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    Object.keys(raw).forEach(function (k) { if (!SCHEMA[k]) reasons.push('unknown-key:' + k); });
    REQUIRED.forEach(function (k) { if (raw[k] === undefined || raw[k] === null) reasons.push('missing:' + k); });
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };

    var out = {};
    out.subject = wordy(raw.subject, 'subject', LIMITS.phrase, reasons, repairs, true);
    out.character = wordList(raw.character, 'character', 1, 6, reasons, repairs);
    out.composition = wordy(raw.composition, 'composition', LIMITS.text, reasons, repairs, true);
    out.architecture = wordList(raw.architecture, 'architecture', 1, 8, reasons, repairs, LIMITS.text);
    out.diagnosticFeatures = wordList(raw.diagnosticFeatures, 'diagnosticFeatures', 1, LIMITS.listMax, reasons, repairs);
    out.modifiers = wordList(raw.modifiers, 'modifiers', 0, 8, reasons, repairs);
    out.proportion = wordy(raw.proportion, 'proportion', LIMITS.text, reasons, repairs, true);
    out.gesture = wordy(raw.gesture, 'gesture', LIMITS.text, reasons, repairs, true);

    var ab = raw.abstraction;
    if (!ab || typeof ab !== 'object' || Array.isArray(ab)) { reasons.push('bad-abstraction'); }
    else {
      Object.keys(ab).forEach(function (k) { if (['survives', 'doNotDrawLiterally', 'note'].indexOf(k) === -1) reasons.push('unknown-key:abstraction.' + k); });
      out.abstraction = {
        survives: wordList(ab.survives, 'abstraction.survives', 1, 8, reasons, repairs),
        doNotDrawLiterally: wordList(ab.doNotDrawLiterally, 'abstraction.doNotDrawLiterally', 0, 8, reasons, repairs),
        note: wordy(ab.note, 'abstraction.note', LIMITS.text, reasons, repairs, false)
      };
    }
    out.revealCandidates = wordList(raw.revealCandidates, 'revealCandidates', 0, 8, reasons, repairs);

    var pf = raw.promptFidelity;
    if (pf === undefined || pf === null) { out.promptFidelity = null; }
    else if (typeof pf !== 'object' || Array.isArray(pf)) { reasons.push('bad-promptFidelity'); }
    else {
      Object.keys(pf).forEach(function (k) { if (['agreement', 'differences'].indexOf(k) === -1) reasons.push('unknown-key:promptFidelity.' + k); });
      var ag = typeof pf.agreement === 'string' ? pf.agreement.trim().toLowerCase() : '';
      if (AGREEMENTS.indexOf(ag) === -1) { repairs.push('promptFidelity.agreement "' + String(pf.agreement).slice(0, 24) + '" → unknown (not one of ' + AGREEMENTS.join('/') + ')'); ag = 'unknown'; }
      out.promptFidelity = { agreement: ag, differences: wordList(pf.differences, 'promptFidelity.differences', 0, 6, reasons, repairs) };
    }

    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    return { ok: true, reasons: [], repairs: repairs, analysis: out };
  }

  // A model's reply is TEXT until proven an analysis.
  function parseAnalysis(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reasons: ['empty'], repairs: [] };
    var t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'], repairs: [] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'], repairs: [] }; }
    }
    return validateAnalysis(obj);
  }

  // ---------------------------------------------------------------
  // THE FIXTURE ARTISTIC SOURCE — existing artwork, ordered for a prompt.
  // Word overlap over DATA (the manifest's tags), never a branch on a
  // subject; a prompt no entry matches shows the gallery unordered.
  // ---------------------------------------------------------------
  function words(s) { return String(s || '').toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length >= 3; }); }
  function rankArtwork(prompt, entries) {
    var pw = words(prompt);
    var scored = (entries || []).map(function (e, i) {
      var tags = (e.tags || []).map(function (t) { return String(t).toLowerCase(); }).concat(words(e.title));
      var n = 0;
      pw.forEach(function (w) { if (tags.some(function (t) { return t === w || t.indexOf(w) === 0 || w.indexOf(t) === 0; })) n++; });
      return { entry: e, score: n, i: i };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return scored.map(function (s) { return { entry: s.entry, score: s.score }; });
  }

  // The fixture analysis — for a session with no model at all. It says
  // it is a fixture and describes nothing it has not seen.
  function fixtureAnalysis(prompt, title) {
    var p = cleanPrompt(prompt) || 'the creature';
    return JSON.stringify({
      subject: 'FIXTURE — no model read this picture' + (title ? ' (' + String(title).slice(0, 40) + ')' : ''),
      character: ['unread'],
      composition: 'Not described: no model looked at the picture in fixture mode. This placeholder exists so the pipeline can be walked without one.',
      architecture: ['not described — no model was asked'],
      diagnosticFeatures: ['none read'],
      modifiers: [],
      proportion: 'Not described — no model was asked.',
      gesture: 'Not described — no model was asked; nothing here is an observation.',
      abstraction: { survives: ['unknown until a model reads the picture'], doNotDrawLiterally: [], note: 'Choose LLM — Endpoint or LLM — Direct under Source to have the model read the picture of ' + p + '.' },
      revealCandidates: [],
      promptFidelity: { agreement: 'differs', differences: ['nothing was compared — this is a fixture placeholder, not an observation'] }
    });
  }

  // ---------------------------------------------------------------
  // THE SESSION — what the researcher has made in this page. Kept in a
  // closure; never stored. Every set of ideas is kept until the page
  // goes (bounded), so "bring back previous" is always honest.
  // ---------------------------------------------------------------
  var state = {
    prompt: '', refinements: [],
    provider: 'fixture',                // an ARTISTIC SOURCE — a key of PROVIDERS
    generations: [],                    // [{ id, prompt, refinements, source, provider, mode, model, images: [{id, index, mime, b64, dataUrl, source, model, label, title, credit}], at }]
    shown: null,                        // generation id on screen
    selected: null,                     // { generationId, imageId } — survives showing another set
    analysis: null,                     // { ...clean, source, mode, model, imageId, imageSource, at }
    busy: null,                         // null | 'imagine' | 'understand'
    last: null, lastImagine: null, lastUnderstand: null
  };
  var listeners = [];
  var idSeq = 0;
  var highlight = null;                 // the idea a click has picked out, before USE
  function nextId(prefix) { idSeq++; return prefix + '-' + idSeq; }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* held */ } }); if (doc) render(); }

  function sourceLabel(source, model, mode) {
    if (source === 'fixture') return 'FIXTURE — existing artwork, chosen not generated';
    if (source === 'uploaded') return 'UPLOADED — your own picture';
    if (source === 'generated') return 'IMAGE MODEL' + (model ? ' (' + model + ')' : '') + (mode ? ' · ' + mode : '');
    return String(source || '');
  }
  function connMode() { var C = global.LabConnection; return C ? C.status().mode : 'fixture'; }
  function unconfigured() { var C = global.LabConnection; return !!C && connMode() !== 'fixture' && /not configured/.test(C.status().line); }

  function generation(id) { return state.generations.filter(function (g) { return g.id === id; })[0] || null; }
  function shownGeneration() { return generation(state.shown); }
  function selectedImage() {
    if (!state.selected) return null;
    var g = generation(state.selected.generationId);
    if (!g) return null;
    return g.images.filter(function (im) { return im.id === state.selected.imageId; })[0] || null;
  }

  function keep(gen) {
    state.generations.push(gen);
    while (state.generations.length > LIMITS.generationsKept) {
      var dropped = state.generations.shift();
      if (state.selected && state.selected.generationId === dropped.id) state.selected = null;
    }
    state.shown = gen.id;
  }

  // Reads one of the Lab's own artwork files (a relative path on this
  // origin, never a provider) into a data URL. The browser only.
  function loadArtwork(entry) {
    if (typeof fetch !== 'function' || typeof FileReader === 'undefined') return Promise.resolve(null);
    var file = String(entry.file || '');
    if (/^[a-z]+:|^\/\//i.test(file)) return Promise.resolve(null);     // relative paths only
    return fetch(file).then(function (r) { return r.ok ? r.blob() : null; }).then(function (blob) {
      if (!blob || blob.size > LIMITS.imageBytes) return null;
      var mime = IMAGE_MIMES.indexOf(blob.type) !== -1 ? blob.type : (/\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png');
      return new Promise(function (resolve) {
        var rd = new FileReader();
        rd.onerror = function () { resolve(null); };
        rd.onload = function () { var d = String(rd.result || ''); resolve(d ? { mime: mime, b64: d.slice(d.indexOf(',') + 1), dataUrl: d, title: entry.title, credit: entry.credit, artworkId: entry.id } : null); };
        rd.readAsDataURL(blob);
      });
    }).catch(function () { return null; });
  }

  // ---------------------------------------------------------------
  // CREATE — one explicit press → one set of ideas. Refinement adds a
  // line and makes a new set; "try another" makes a new set from the
  // same words; nothing already made is thrown away.
  // ---------------------------------------------------------------
  function create(prompt, opts) {
    opts = opts || {};
    var C = global.LabConnection;
    var refinements = opts.refinements || [];
    var g = imagePrompt(prompt, refinements);
    if (!g.ok) { status('Say what should exist — a few plain words, up to 200 characters, no links or markup. Nothing was created.', 'warn'); return Promise.resolve({ ok: false, reason: g.reason }); }
    if (state.busy) return Promise.resolve({ ok: false, reason: 'busy' });
    var provider = PROVIDERS[state.provider] || PROVIDERS.fixture;
    var mode = connMode();
    var n = Math.max(1, Math.min(LIMITS.optionsMax, opts.count || OPTIONS_DEFAULT));
    var kept = state.generations.length ? 'The ideas you already have are still here.' : 'Nothing changed.';
    var trace = { stage: 'imagine', provider: provider.id, providerLabel: provider.label, mode: mode, prompt: g.prompt, refinements: g.refinements.length, count: n, request: null, answer: null, outcome: 'pending' };
    state.last = trace; state.lastImagine = trace;
    state.prompt = g.prompt; state.refinements = g.refinements;

    var work;
    if (provider.kind === 'fixture') {
      var D = global.LabArtworkData;
      var entries = D ? D.entries : [];
      trace.request = 'none — the fixture artistic source reads existing pictures from this Lab and sends nothing anywhere';
      state.busy = 'imagine'; emit();
      status('Fetching the artwork gallery (fixture)…');
      var ranked = rankArtwork(g.prompt, entries);
      work = Promise.all(ranked.map(function (r) { return loadArtwork(r.entry); })).then(function (pics) {
        var images = pics.filter(Boolean);
        if (!images.length) return { ok: false, reason: 'no-artwork' };
        return { ok: true, source: 'fixture', model: null, images: images };
      });
    } else {
      if (!C) { status('The connection module is not loaded.', 'warn'); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
      if (mode === 'fixture' || unconfigured()) {
        trace.request = 'not sent — ' + provider.label + ' needs a connection (LLM — Endpoint or LLM — Direct under Source)'; trace.outcome = 'not-configured';
        status(provider.label + ' needs a real connection — choose LLM — Endpoint or LLM — Direct under Source and configure it under Advanced, or choose the Fixture artistic source. Nothing was created. ' + kept, 'warn');
        emit();
        return Promise.resolve({ ok: false, reason: 'not-configured' });
      }
      trace.request = 'sent through LabConnection (' + mode + ') to the image model';
      state.busy = 'imagine'; emit();
      status('Asking the image model for ' + n + ' interpretations of "' + g.prompt + '"…');
      work = C.imagine({ prompt: g.text, n: n }).then(function (r) {
        if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
        var images = (r.images || []).filter(function (im) { return im && typeof im.b64 === 'string' && im.b64.length > 64; }).map(function (im) {
          var mime = IMAGE_MIMES.indexOf(im.mime) !== -1 ? im.mime : 'image/png';
          return { mime: mime, b64: im.b64, dataUrl: 'data:' + mime + ';base64,' + im.b64 };
        });
        if (!images.length) return { ok: false, reason: 'malformed' };
        return { ok: true, source: r.source === 'fixture' ? 'fixture' : 'generated', model: r.model || null, images: images };
      });
    }
    return work.then(function (r) {
      state.busy = null;
      if (!r.ok) {
        trace.answer = { ok: false, reason: r.reason };
        trace.outcome = r.reason === 'no-image-model' ? 'unavailable' : 'failed';
        status(r.reason === 'no-image-model'
          ? provider.label + ' is UNAVAILABLE — the account has no image model (the provider answered "no image model"). Choose the Fixture artistic source. Nothing was replaced. ' + kept
          : 'Creating failed — ' + r.reason + ' (' + provider.label + ' · ' + mode + '). Nothing was replaced. ' + kept, 'warn');
        emit();
        return { ok: false, reason: r.reason };
      }
      var gen = { id: nextId('ideas'), prompt: g.prompt, refinements: g.refinements.slice(), source: r.source, provider: provider.id, mode: mode, model: r.model || null, at: Date.now(), images: [] };
      r.images.forEach(function (im, i) {
        gen.images.push({ id: nextId('img'), index: i, mime: im.mime, b64: im.b64, dataUrl: im.dataUrl, source: r.source, model: r.model || null, label: sourceLabel(r.source, r.model, mode), title: im.title || null, credit: im.credit || null, artworkId: im.artworkId || null });
      });
      keep(gen);
      trace.answer = { ok: true, source: r.source, model: r.model || null, images: gen.images.length };
      trace.outcome = r.source;
      status(r.source === 'fixture'
        ? gen.images.length + ' existing pictures (ARTISTIC SOURCE: Fixture) — ordered for "' + g.prompt + '", chosen by you, not generated. Choose one.'
        : gen.images.length + ' idea' + (gen.images.length === 1 ? '' : 's') + ' ready (' + sourceLabel(r.source, r.model, mode) + '). Choose one.', 'ok');
      emit();
      return { ok: true, id: gen.id, images: gen.images.length, source: r.source };
    }).catch(function () {
      state.busy = null; trace.answer = { ok: false, reason: 'error' }; trace.outcome = 'failed';
      status('Creating failed (' + provider.label + '). Nothing was replaced. ' + kept, 'warn'); emit();
      return { ok: false, reason: 'error' };
    });
  }

  function another() {
    var g = shownGeneration();
    return create(g ? g.prompt : state.prompt, { refinements: g ? g.refinements : state.refinements });
  }

  // REFINE — the original words stay; the refinement is one more line.
  function refine(text) {
    var g = shownGeneration();
    if (!g && !state.prompt) return Promise.resolve({ ok: false, reason: 'nothing-to-refine' });
    var r = cleanRefinement(text);
    if (r === null || !r) { status('Say what to change — plain words, up to 200 characters. Nothing was created.', 'warn'); return Promise.resolve({ ok: false, reason: 'bad-refinement' }); }
    var base = g ? g.refinements : state.refinements;
    if (base.length >= LIMITS.refinementsMax) { status('That idea has been refined ' + LIMITS.refinementsMax + ' times — start a fresh prompt for more. Nothing was created.', 'warn'); return Promise.resolve({ ok: false, reason: 'too-many-refinements' }); }
    return create(g ? g.prompt : state.prompt, { refinements: base.concat([r]) });
  }

  function showPrevious() {
    var i = state.generations.findIndex(function (g) { return g.id === state.shown; });
    if (i <= 0) return { ok: false, reason: 'no-previous' };
    state.shown = state.generations[i - 1].id; emit(); return { ok: true, id: state.shown };
  }
  function showNext() {
    var i = state.generations.findIndex(function (g) { return g.id === state.shown; });
    if (i === -1 || i >= state.generations.length - 1) return { ok: false, reason: 'no-next' };
    state.shown = state.generations[i + 1].id; emit(); return { ok: true, id: state.shown };
  }
  function show(id) { if (!generation(id)) return { ok: false, reason: 'no-such-set' }; state.shown = id; emit(); return { ok: true }; }

  // SELECT is a highlight; USE makes it the creative source and reads it.
  function select(imageId) {
    var g = shownGeneration();
    if (!g || !g.images.some(function (im) { return im.id === imageId; })) return { ok: false, reason: 'no-such-image' };
    highlight = imageId; emit(); return { ok: true };
  }
  function use(imageId) {
    var id = imageId || highlight;
    var g = state.generations.filter(function (gg) { return gg.images.some(function (im) { return im.id === id; }); })[0];
    if (!g) return Promise.resolve({ ok: false, reason: 'no-such-image' });
    state.selected = { generationId: g.id, imageId: id };
    highlight = null;
    emit();
    return understand();
  }
  function unselect() { state.selected = null; state.analysis = null; emit(); return { ok: true }; }

  // BRING AN IMAGE — the researcher's own picture becomes a one-image
  // set labelled UPLOADED, and is used straight away.
  function bringImage(file) {
    if (!file || typeof file !== 'object') return Promise.resolve({ ok: false, reason: 'no-file' });
    if (IMAGE_MIMES.indexOf(file.type) === -1) { status('That is not a PNG, JPEG or WebP picture. Nothing changed.', 'warn'); return Promise.resolve({ ok: false, reason: 'bad-mime' }); }
    if (file.size > LIMITS.imageBytes) { status('That picture is over ' + Math.round(LIMITS.imageBytes / 1048576) + ' MB. Nothing changed.', 'warn'); return Promise.resolve({ ok: false, reason: 'too-big' }); }
    return new Promise(function (resolve) {
      var rd = new FileReader();
      rd.onerror = function () { resolve({ ok: false, reason: 'unreadable' }); };
      rd.onload = function () {
        var dataUrl = String(rd.result || '');
        var b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (!b64) return resolve({ ok: false, reason: 'unreadable' });
        var gen = { id: nextId('ideas'), prompt: state.prompt || '', refinements: [], source: 'uploaded', provider: 'uploaded', mode: 'none', model: null, at: Date.now(), images: [] };
        gen.images.push({ id: nextId('img'), index: 0, mime: file.type, b64: b64, dataUrl: dataUrl, source: 'uploaded', model: null, label: sourceLabel('uploaded'), title: String(file.name || 'your picture').slice(0, 60), credit: null, artworkId: null });
        keep(gen);
        state.last = state.lastImagine = { stage: 'imagine', provider: 'uploaded', providerLabel: 'Your own picture', mode: 'none', prompt: gen.prompt, refinements: 0, count: 1, request: 'none — a picture from your own computer, read here', answer: { ok: true, source: 'uploaded', model: null, images: 1 }, outcome: 'uploaded' };
        status('Your picture is in (UPLOADED). Reading it…', 'ok');
        resolve(use(gen.images[0].id));
      };
      rd.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------
  // UNDERSTAND — the selected picture goes to the model's image
  // understanding; the reply is TEXT until the validator says otherwise,
  // and a refused or failed reply leaves the analysis in use untouched.
  // ---------------------------------------------------------------
  function understand() {
    var C = global.LabConnection;
    var im = selectedImage();
    if (!im) return Promise.resolve({ ok: false, reason: 'nothing-selected' });
    if (state.busy) return Promise.resolve({ ok: false, reason: 'busy' });
    if (!C) return Promise.resolve({ ok: false, reason: 'not-loaded' });
    var g = generation(state.selected.generationId);
    var mode = connMode();
    var kept = state.analysis ? 'The understanding you had is still here.' : 'Nothing changed.';
    var m = understandMessages(g.prompt, g.refinements);
    var trace = { stage: 'understand', mode: mode, imageId: im.id, imageSource: im.source, imageTitle: im.title || null, imageBytes: Math.round(im.b64.length * 0.75), request: null, answer: null, parse: null, outcome: 'pending' };
    state.last = trace; state.lastUnderstand = trace;
    if (unconfigured()) {
      trace.request = 'not sent — the source is selected but not configured'; trace.outcome = 'not-configured';
      understandStatus('The source is selected but not configured — set it under Advanced, or choose Fixture. The picture was not read. ' + kept, 'warn'); emit();
      return Promise.resolve({ ok: false, reason: 'not-configured' });
    }
    trace.request = mode === 'fixture' ? 'none — fixture mode answers with a placeholder that says no model looked' : 'sent through LabConnection (' + mode + '): the fixed contract, the creative prompt, and the picture (' + im.mime + ', ' + trace.imageBytes + ' bytes) — nothing else';
    state.busy = 'understand'; emit();
    var reading = mode === 'fixture' ? 'Fixture: answering with a placeholder — no model looks at the picture…' : 'Reading the picture (' + mode + ') — this takes a few seconds…';
    understandStatus(reading);
    if (mode !== 'fixture') tickStartFor(reading);
    return C.understand({
      messages: m.messages, image: { mime: im.mime, b64: im.b64 },
      fixture: function () { return fixtureAnalysis(g.prompt, im.title); }
    }).then(function (r) {
      state.busy = null; tickStop();
      if (!r || !r.ok) {
        var reason = (r && r.reason) || 'unavailable';
        trace.answer = { ok: false, reason: reason }; trace.outcome = 'failed';
        understandStatus('Reading the picture failed — ' + reason + ' (' + mode + '). No fixture was substituted. ' + kept, 'warn'); emit();
        return { ok: false, reason: reason };
      }
      trace.answer = { ok: true, source: r.source, model: r.model || null, chars: String(r.text || '').length };
      var v = parseAnalysis(r.text);
      trace.parse = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
      if (!v.ok) {
        trace.outcome = 'rejected';
        understandStatus('The analysis was refused by the validator — ' + v.reasons.slice(0, 3).join(', ') + (v.reasons.length > 3 ? '…' : '') + '. No fixture was substituted. ' + kept, 'warn'); emit();
        return { ok: false, reason: 'invalid-analysis', reasons: v.reasons };
      }
      trace.outcome = r.source === 'fixture' ? 'fixture' : 'generated';
      state.analysis = Object.assign({}, v.analysis, { source: r.source, mode: mode, model: r.model || null, imageId: im.id, imageSource: im.source, imageTitle: im.title || null, at: Date.now(), repairs: v.repairs || [] });
      understandStatus(r.source === 'fixture'
        ? 'Fixture placeholder in place — no model looked at the picture, and it says so. Choose LLM — Endpoint or LLM — Direct under Source to read it for real.'
        : 'Understood (' + (r.model || mode) + '). ' + (v.repairs && v.repairs.length ? v.repairs.length + ' value' + (v.repairs.length === 1 ? '' : 's') + ' tidied. ' : '') + 'This is what the picture shows.', 'ok');
      emit();
      return { ok: true, source: r.source };
    }).catch(function () {
      state.busy = null; tickStop(); trace.answer = { ok: false, reason: 'error' }; trace.outcome = 'failed';
      understandStatus('Reading the picture failed (' + mode + '). ' + kept, 'warn'); emit();
      return { ok: false, reason: 'error' };
    });
  }

  function setProvider(id) { if (PROVIDERS[id]) { state.provider = id; emit(); } return state.provider; }

  // ---------------------------------------------------------------
  // THE PAGE
  // ---------------------------------------------------------------
  var doc = global.document;
  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(msg, kind) { var n = el('[data-imagine-status]'); if (n) { n.textContent = msg || ''; n.className = 'say imagine-status' + (kind ? ' ' + kind : ''); } }
  // The read's status is written in BOTH places — under the selected
  // picture and on the top line under the prompt — because on a narrow
  // screen the selected block and the Understanding panel sit below the
  // fold, and a top line that still said "Reading it…" after the read had
  // finished looked like a hang (reported by the product owner).
  function understandStatus(msg, kind) {
    var n = el('[data-imagine-understand-status]'); if (n) { n.textContent = msg || ''; n.className = 'say imagine-status' + (kind ? ' ' + kind : ''); }
    status(msg, kind);
  }
  // While a read is in flight the line counts the seconds, so a slow model
  // (a large picture at high detail takes ten seconds or so) reads as
  // working rather than stuck.
  var ticker = null, tickStart = 0, tickBase = '';
  function tickStartFor(base) {
    tickStop(); tickStart = Date.now(); tickBase = base;
    ticker = setInterval(function () {
      if (state.busy !== 'understand') { tickStop(); return; }
      understandStatus(tickBase + ' ' + Math.round((Date.now() - tickStart) / 1000) + 's');
    }, 1000);
  }
  function tickStop() { if (ticker) { clearInterval(ticker); ticker = null; } }

  function pageState() {
    if (state.busy === 'imagine') return 'creating';
    if (state.busy === 'understand') return 'understanding';
    if (state.analysis) return 'understood';
    if (state.selected) return 'selected';
    if (state.generations.length) return 'ideas';
    return 'idle';
  }

  function tagFor(im) { return im.source === 'fixture' ? 'FIXTURE' : im.source === 'uploaded' ? 'UPLOADED' : 'IMAGE MODEL'; }

  function renderOptions() {
    var box = el('[data-imagine-options]');
    if (!box) return;
    var g = shownGeneration();
    box.innerHTML = '';
    if (!g) return;
    g.images.forEach(function (im) {
      var card = doc.createElement('div');
      card.className = 'idea' + (highlight === im.id ? ' on' : '') + (state.selected && state.selected.imageId === im.id ? ' chosen' : '');
      card.setAttribute('data-imagine-option', im.id);
      card.setAttribute('role', 'button');
      card.setAttribute('title', (im.title ? im.title + ' — ' : '') + im.label);
      var img = doc.createElement('img');
      img.alt = 'Idea ' + (im.index + 1) + (im.title ? ' — ' + im.title : '') + ' — ' + im.label;
      img.src = im.dataUrl;
      card.appendChild(img);
      var tag = doc.createElement('span'); tag.className = 'tag'; tag.textContent = tagFor(im) + ' · ' + (im.index + 1);
      card.appendChild(tag);
      if (im.title) { var cap = doc.createElement('span'); cap.className = 'cap'; cap.textContent = im.title; card.appendChild(cap); }
      if (state.selected && state.selected.imageId === im.id) { var s = doc.createElement('span'); s.className = 'tag chosen'; s.textContent = 'SELECTED'; card.appendChild(s); }
      card.addEventListener('click', function () { select(im.id); });
      card.addEventListener('dblclick', function () { use(im.id); });
      box.appendChild(card);
    });
  }

  function renderSelected() {
    var box = el('[data-imagine-selected-img]');
    if (!box) return;
    box.innerHTML = '';
    var im = selectedImage();
    if (!im) return;
    var img = doc.createElement('img'); img.alt = 'Selected creature — ' + (im.title ? im.title + ' — ' : '') + im.label; img.src = im.dataUrl;
    box.appendChild(img);
    var l = el('[data-imagine-selected-label]'); if (l) l.textContent = (im.title ? im.title + ' · ' : '') + im.label + (im.credit ? ' · ' + im.credit : '');
    var sm = el('[data-imagine-summary]');
    if (sm) {
      var a = state.analysis;
      sm.textContent = !a ? '' : (a.source === 'fixture' ? 'Placeholder in place (no model looked). ' : 'Understood as: ' + a.subject + ' — ' + a.character.join(', ') + '. ') + 'The full understanding is in the Understanding panel.';
      sm.hidden = !a;
    }
    var sh = el('[data-imagine-show]'); if (sh) sh.disabled = !state.analysis;
  }

  function chips(list) { return (list || []).map(function (w) { return '<span class="an-chip">' + esc(w) + '</span>'; }).join(' '); }
  function renderPanel() {
    var box = el('[data-imagine-panel]');
    if (!box) return;
    var a = state.analysis;
    var badge = el('[data-imagine-panel-source]');
    if (!a) {
      box.innerHTML = '<div class="note">Nothing understood yet. Create, choose a picture and press Use this creature — the picture you choose is what gets read.</div>';
      if (badge) { badge.textContent = ''; badge.className = 'srcbadge'; }
      return;
    }
    if (badge) { badge.textContent = a.source === 'fixture' ? 'FIXTURE — a placeholder, no model looked at the picture' : 'IMAGE UNDERSTANDING' + (a.model ? ' (' + a.model + ')' : '') + ' · ' + a.mode + ' · read from a ' + a.imageSource + ' picture'; badge.className = 'srcbadge ' + (a.source === 'fixture' ? 'fixture' : 'llm'); }
    function h(t) { return '<div class="an-h">' + esc(t) + '</div>'; }
    function p(t) { return '<div class="an-v">' + esc(t) + '</div>'; }
    var rows = [];
    rows.push('<div class="an-subject">' + esc(a.subject) + '</div>');
    rows.push(h('Character') + p(a.character.join(' · ')));
    rows.push(h('Primary composition') + p(a.composition));
    rows.push(h('Body and masses') + '<ul class="an-list">' + a.architecture.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>');
    rows.push(h('Diagnostic features') + '<div class="an-v">' + chips(a.diagnosticFeatures) + '</div>');
    if (a.modifiers.length) rows.push(h('Modifiers') + '<div class="an-v">' + chips(a.modifiers) + '</div>');
    rows.push(h('Proportion and emphasis') + p(a.proportion));
    rows.push(h('Gesture and flow') + p(a.gesture));
    rows.push(h('What should survive the abstraction') + '<div class="an-v">' + chips(a.abstraction.survives) + '</div>');
    if (a.abstraction.doNotDrawLiterally.length) rows.push(h('Do not draw literally') + '<div class="an-v">' + chips(a.abstraction.doNotDrawLiterally) + '</div>');
    if (a.abstraction.note) rows.push(p(a.abstraction.note));
    if (a.revealCandidates.length) rows.push(h('Could be a reveal payoff') + '<div class="an-v">' + chips(a.revealCandidates) + '</div>');
    if (a.promptFidelity) {
      var f = a.promptFidelity;
      rows.push(h('Against the prompt') + '<div class="an-v an-fid-' + esc(f.agreement) + '">' + (f.agreement === 'matches' ? 'The picture shows what the prompt asked for.' : f.agreement === 'partly' ? 'The picture partly matches the prompt.' : f.agreement === 'differs' ? 'The picture differs from the prompt — it is described as it is.' : 'Agreement not stated.') + (f.differences.length ? '<ul class="an-list">' + f.differences.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</div>');
    }
    box.innerHTML = rows.join('');
  }

  function renderTrace() {
    var box = el('[data-imagine-trace]');
    if (!box) return;
    function row(k, v, cls) { return '<div class="trow"><span class="tk">' + esc(k) + '</span><span class="tv' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span></div>'; }
    var rows = [];
    var t = state.lastImagine;
    if (t) {
      rows.push(row('ideas · artistic source', t.providerLabel + ' · connection ' + t.mode), row('ideas · prompt', t.prompt || '—'), row('ideas · refinements', String(t.refinements || 0)), row('ideas · request', t.request || '—'));
      if (t.answer) rows.push(t.answer.ok ? row('ideas · answer', t.answer.images + ' picture(s) · labelled ' + t.answer.source + (t.answer.model ? ' · model ' + t.answer.model : ''), 'good') : row('ideas · answer', 'failed — ' + t.answer.reason, 'bad'));
      rows.push(row('ideas · outcome', t.outcome, /failed|not-configured|unavailable/.test(t.outcome) ? 'bad' : 'good'));
    }
    var u = state.lastUnderstand;
    if (u) {
      rows.push(row('understanding · connection', u.mode), row('understanding · picture', u.imageSource + (u.imageTitle ? ' · ' + u.imageTitle : '') + ' · ' + u.imageBytes + ' bytes'), row('understanding · request', u.request || '—'));
      if (u.answer) rows.push(u.answer.ok ? row('understanding · answer', 'received · labelled ' + u.answer.source + (u.answer.model ? ' · model ' + u.answer.model : '') + ' · ' + u.answer.chars + ' chars', 'good') : row('understanding · answer', 'failed — ' + u.answer.reason, 'bad'));
      if (u.parse) rows.push(u.parse.ok ? row('understanding · validator', 'accepted' + (u.parse.repairs.length ? ' · tidied: ' + u.parse.repairs.join(' · ') : ''), 'good') : row('understanding · validator', 'refused — ' + u.parse.reasons.join(', '), 'bad'));
      rows.push(row('understanding · outcome', u.outcome, /failed|rejected|not-configured/.test(u.outcome) ? 'bad' : 'good'));
    }
    box.innerHTML = rows.length ? rows.join('') : '<div class="note">Nothing created yet.</div>';
  }

  function render() {
    if (!doc) return;
    var sec = el('[data-imagine-section]');
    if (sec) { sec.setAttribute('data-imagine-state', pageState()); sec.setAttribute('data-imagine-outcome', state.lastImagine ? state.lastImagine.outcome : 'none'); sec.setAttribute('data-understand-outcome', state.lastUnderstand ? state.lastUnderstand.outcome : 'none'); sec.setAttribute('data-imagine-provider', state.provider); }
    var g = shownGeneration();
    var ideas = el('[data-imagine-ideas]'); if (ideas) ideas.hidden = !g;
    var i = state.generations.findIndex(function (gg) { return gg.id === state.shown; });
    var setLabel = el('[data-imagine-set]');
    if (setLabel) setLabel.textContent = g ? ('Set ' + (i + 1) + ' of ' + state.generations.length + ' · ' + g.prompt + (g.refinements.length ? ' · refined: ' + g.refinements.join(' / ') : '') + ' · ' + sourceLabel(g.source, g.model, g.mode)) : '';
    var busy = !!state.busy;
    var b = function (sel, on) { var n = el(sel); if (n) n.disabled = !on; };
    b('[data-imagine-create]', !busy);
    b('[data-imagine-another]', !!g && !busy);
    b('[data-imagine-refine-go]', !!g && !busy);
    b('[data-imagine-prev]', i > 0 && !busy);
    b('[data-imagine-next]', i !== -1 && i < state.generations.length - 1 && !busy);
    var nx = el('[data-imagine-next]'); if (nx) nx.hidden = !(i !== -1 && i < state.generations.length - 1);
    b('[data-imagine-use]', !!highlight && !busy);
    b('[data-imagine-understand]', !!state.selected && !busy);
    b('[data-imagine-unselect]', !!state.selected && !busy);
    b('[data-imagine-copy]', !!state.analysis);
    var selBox = el('[data-imagine-selected]'); if (selBox) selBox.hidden = !state.selected;
    doc.querySelectorAll('[data-imagine-provider-pick]').forEach(function (bb) { bb.classList.toggle('on', bb.getAttribute('data-imagine-provider-pick') === state.provider); bb.disabled = busy; });
    var pl = el('[data-imagine-provider-line]'); if (pl) pl.textContent = 'ARTISTIC SOURCE — ' + (PROVIDERS[state.provider] || PROVIDERS.fixture).label + '. ' + (PROVIDERS[state.provider] || PROVIDERS.fixture).line;
    renderOptions(); renderSelected(); renderPanel(); renderTrace();
  }

  function wire() {
    var promptEl = el('[data-imagine-prompt]');
    var go = el('[data-imagine-create]');
    var run = function () { create(promptEl ? promptEl.value : ''); };
    if (go) go.addEventListener('click', run);
    if (promptEl) promptEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); run(); } });
    var an = el('[data-imagine-another]'); if (an) an.addEventListener('click', function () { another(); });
    var rf = el('[data-imagine-refine]'), rg = el('[data-imagine-refine-go]');
    var doRefine = function () { refine(rf ? rf.value : '').then(function (r) { if (r.ok && rf) rf.value = ''; }); };
    if (rg) rg.addEventListener('click', doRefine);
    if (rf) rf.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); doRefine(); } });
    var pv = el('[data-imagine-prev]'); if (pv) pv.addEventListener('click', function () { showPrevious(); });
    var nx = el('[data-imagine-next]'); if (nx) nx.addEventListener('click', function () { showNext(); });
    var useBtn = el('[data-imagine-use]'); if (useBtn) useBtn.addEventListener('click', function () { use(); });
    var ub = el('[data-imagine-understand]'); if (ub) ub.addEventListener('click', function () { understand(); });
    var un = el('[data-imagine-unselect]'); if (un) un.addEventListener('click', function () { unselect(); status('Choose another picture, or create more.'); });
    var sh = el('[data-imagine-show]'); if (sh) sh.addEventListener('click', function () { var pn = el('[data-imagine-panel]'); if (pn && pn.scrollIntoView) pn.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    var file = el('[data-imagine-file]'); if (file) file.addEventListener('change', function () { var f = file.files && file.files[0]; if (f) bringImage(f); file.value = ''; });
    doc.querySelectorAll('[data-imagine-provider-pick]').forEach(function (bb) { bb.addEventListener('click', function () { setProvider(bb.getAttribute('data-imagine-provider-pick')); }); });
    var cp = el('[data-imagine-copy]');
    if (cp) cp.addEventListener('click', function () {
      var ta = el('[data-imagine-json]'); if (!ta) return;
      ta.value = state.analysis ? JSON.stringify(state.analysis, null, 1) : '';
      ta.hidden = !ta.value; if (!ta.hidden) ta.select();
    });
    // the connection control is shared with the reference flow; repaint when it changes
    doc.querySelectorAll('[data-conn-mode]').forEach(function (bb) { bb.addEventListener('click', function () { setTimeout(render, 0); }); });
    render();
  }
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire); else wire(); }

  var api = {
    LIMITS: LIMITS, SCHEMA: SCHEMA, REQUIRED: REQUIRED.slice(), FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(), IMAGE_MIMES: IMAGE_MIMES.slice(), SOURCES: SOURCES.slice(), AGREEMENTS: AGREEMENTS.slice(),
    PROVIDERS: JSON.parse(JSON.stringify(PROVIDERS)), PRESENTATION: PRESENTATION,
    cleanPrompt: cleanPrompt, cleanRefinement: cleanRefinement, cleanRefinements: cleanRefinements,
    imagePrompt: imagePrompt, understandMessages: understandMessages, validateAnalysis: validateAnalysis, parseAnalysis: parseAnalysis,
    rankArtwork: rankArtwork, fixtureAnalysis: fixtureAnalysis, sourceLabel: sourceLabel,
    create: create, another: another, refine: refine, showPrevious: showPrevious, showNext: showNext, show: show,
    select: select, use: use, unselect: unselect, understand: understand, bringImage: bringImage, setProvider: setProvider,
    observe: function (f) { listeners.push(f); },
    state: function () {
      return {
        prompt: state.prompt, refinements: state.refinements.slice(), provider: state.provider, shown: state.shown, selected: state.selected ? Object.assign({}, state.selected) : null,
        highlight: highlight, busy: state.busy, page: pageState(),
        generations: state.generations.map(function (g) { return { id: g.id, prompt: g.prompt, refinements: g.refinements.slice(), source: g.source, provider: g.provider, mode: g.mode, model: g.model, images: g.images.map(function (im) { return { id: im.id, index: im.index, mime: im.mime, bytes: Math.round(im.b64.length * 0.75), source: im.source, model: im.model, label: im.label, title: im.title, artworkId: im.artworkId }; }) }; })
      };
    },
    selectedImage: function () { var im = selectedImage(); return im ? { id: im.id, mime: im.mime, bytes: Math.round(im.b64.length * 0.75), source: im.source, label: im.label, title: im.title, artworkId: im.artworkId, dataUrl: im.dataUrl } : null; },
    // the bytes of the selected picture, for the one caller that sends it
    // onward through the same transport (the translation plan)
    selectedImageBytes: function () { var im = selectedImage(); return im ? { id: im.id, mime: im.mime, b64: im.b64, source: im.source, title: im.title } : null; },
    analysis: function () { return state.analysis ? JSON.parse(JSON.stringify(state.analysis)) : null; },
    last: function () { return state.last ? JSON.parse(JSON.stringify(state.last)) : null; },
    lastImagine: function () { return state.lastImagine ? JSON.parse(JSON.stringify(state.lastImagine)) : null; },
    lastUnderstand: function () { return state.lastUnderstand ? JSON.parse(JSON.stringify(state.lastUnderstand)) : null; },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabImagine = api;
  else global.LabImagine = api;
})(typeof window !== 'undefined' ? window : this);
