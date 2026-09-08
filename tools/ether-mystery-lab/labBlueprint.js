// CREATE FROM CREATURE — the authoring BLUEPRINT. LAB ONLY.
//
// The eventual product: a child enters "Tiger", the system helps with a
// visual reference, and the CHILD builds the Ether figure over it —
// place points, connect, simplify, choose gaps, add a hint, test, save.
// The child is the author. The model is an assistant.
//
// What this file owns is the contract between the two:
//
//   - THE MODEL IS RESPONSIBLE FOR SEMANTIC HELP ONLY. "What makes a
//     tiger recognisable?" It answers with a structured blueprint — the
//     creature's identity, its primary silhouette, its diagnostic
//     features with their relative importance, which features to spend
//     an 8 / 12 / 16 / 20 point budget on — and a temporary VISUAL
//     REFERENCE: a rough sketch made of ellipses, polygons and lines in
//     the editor's own unit space.
//   - THE MODEL IS NOT RESPONSIBLE FOR THE FINAL CREATURE. The schema has
//     no field for final points, final joins or final gaps, and a reply
//     carrying any is refused as an unknown key. Nothing the model
//     returns can become the Ether figure; only the author's own lights
//     and joins can.
//   - THE REFERENCE IS AUTHORING-ONLY. It is drawn behind the editor,
//     never on the unfinished pane, never in a fixture, never in a
//     candidate, never in the preview, never in the Ether. It is
//     discarded when the author is done.
//   - THE ONLY THING SENT TO A MODEL IS THE SUBJECT plus this generic
//     contract. No card, no Stars, no memory, no Story, no name of a
//     child: `messagesFor(subject)` takes one string and the suite
//     proves the request contains nothing else.
//   - NOTHING HERE KNOWS ANY CREATURE. There is no creature list, no
//     `if (subject === …)`, no rendering branch per animal. A fixture
//     blueprint — for a session with no model — is one deliberately
//     GENERIC body plan, the same for "tiger" and "wibble", and it says so.
//   - NO RECOGNISABILITY SCORE. A blueprint may name features; nothing
//     in it, and nothing here, says whether the author's figure is good.
(function (global) {
  'use strict';

  var COORD = 1.3;                              // the editor's own reach
  // The Lab's six authoring budgets. A blueprint's own budget lists name
  // the four canonical ones (8 · 12 · 16 · 20); 10 and 18 are optional in
  // a reply and, when absent, read the nearest smaller list. Production
  // is still 8, and none of this touches it.
  var BUDGETS = [8, 10, 12, 16, 18, 20];
  var REQUIRED_BUDGETS = [8, 12, 16, 20];
  var LIMITS = {
    subjectChars: 40,
    textChars: 240,
    nameChars: 24,
    featuresMin: 3, featuresMax: 12,
    revealMax: 8,
    sketchMax: 24, polyPointsMax: 24,
    importanceMin: 1, importanceMax: 3
  };

  // Keys a blueprint may never carry, at any depth — the product's own
  // boundary words (Stars, cards, memories…) and everything that would
  // smuggle an image or a link into authoring data.
  // The Lab's seven reveal kinds — restated here so a blueprint reply can
  // be validated with labReveal.js absent (this file runs in Node too).
  var REVEAL_KINDS = ['contour', 'fill', 'lines', 'texture', 'spike', 'glow', 'motes'];

  var FORBIDDEN_KEYS = ['pattern', 'cells', 'constellation', 'stars', 'card', 'cardId', 'owner', 'ownerId',
    'email', 'memories', 'memory', 'orbit', 'circle', 'username', 'url', 'href', 'src', 'image', 'img',
    'data', 'base64', 'svg', 'html', 'joins', 'gaps', 'missing', 'hint', 'tease', 'candidate'];

  // The schema, written down so the contract and the validator cannot
  // drift: every key, its type, and what may go in it.
  var SCHEMA = {
    top: {
      subject: 'string — the subject as understood, ≤ 40 chars',
      silhouette: 'string — one sentence: the primary silhouette and the viewing angle (side / top / front)',
      features: 'array of 3–12 feature objects, most diagnostic first',
      budgets: 'object with the keys "8", "12", "16", "20" (optionally "10" and "18"): for each, an array of feature names (from features[].name) worth spending that budget on, ≤ budget entries',
      sketch: 'DEPRECATED — optional, ≤ 24 primitives, validated for compatibility and NOT shown: the visual reference is the Creature Outline (labOutline.js), composed from the features',
      reveal: 'optional — array of ≤ 8 reveal-only suggestions: visual details that would appear only AFTER the figure is complete, as pure payoff (a mane, a wing membrane, stripes); semantic names only, never geometry'
    },
    // A reveal suggestion is SEMANTIC: a name, optionally which of the
    // Lab's seven visual kinds fits, and which feature it sits near. The
    // Lab interprets and draws; the assistant never returns a shape.
    reveal: {
      name: 'string — a short label in capitals, letters/spaces only, ≤ 24 chars (MANE, TAIL TUFT, WING MEMBRANE…)',
      kind: 'optional — one of contour | fill | lines | texture | spike | glow | motes; anything else is dropped and the researcher chooses',
      near: 'optional — a features[].name this detail belongs to'
    },
    feature: {
      name: 'string — a short body-part label in capitals, letters/spaces only, ≤ 24 chars (HEAD, EAR, TAIL, WING…); a hyphen, digit or other mark is turned into a space, a longer name is cut at a word',
      importance: 'integer 1–3 — 3 = the creature is not itself without it',
      why: 'string — one short sentence on why it is diagnostic',
      anchor: '[x, y] — where on the reference this feature sits; unit space, x right, y DOWN, |x|,|y| ≤ 1.3'
    },
    primitive: {
      kind: '"ellipse" | "polygon" | "line"',
      c: 'ellipse only — [cx, cy] centre',
      r: 'ellipse only — [rx, ry] radii, each 0.02–1.3',
      rot: 'ellipse only, optional — rotation in radians',
      points: 'polygon/line only — 2–24 [x, y] points',
      closed: 'polygon only, optional boolean'
    }
  };

  // ---------------------------------------------------------------
  // THE REQUEST. One string in; two messages out; nothing else.
  // ---------------------------------------------------------------
  function cleanSubject(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
    if (!s || s.length > LIMITS.subjectChars) return null;
    if (!/^[A-Za-z][A-Za-z0-9 '\-]*$/.test(s)) return null;
    return s;
  }

  function messagesFor(subject) {
    var s = cleanSubject(subject);
    if (!s) return { ok: false, reason: 'bad-subject' };
    var system = [
      'You are an authoring assistant for a night-sky drawing tool. A person will build a creature as a small figure of lights: a few bright points joined by straight lines. Your job is SEMANTIC HELP — what makes the subject recognisable — plus a rough visual reference to draw over. You do NOT draw the final figure; the person does. Never return final points, joins, gaps or hints.',
      '',
      'Answer with ONE JSON object and nothing else, exactly this shape:',
      '{',
      '  "subject": string (≤ 40 chars, the subject as you understood it),',
      '  "silhouette": string (one sentence: the primary silhouette and the best viewing angle — side, top or front — for a line drawing),',
      '  "features": [ 3 to 12 of { "name": CAPITALS ≤ 24 chars (HEAD, EAR, TAIL, WING…), "importance": 1|2|3, "why": one short sentence, "anchor": [x, y] } ], most diagnostic first,',
      '  "budgets": { "8": [feature names], "12": [feature names], "16": [feature names], "20": [feature names] } — which features are worth spending that many points on; each list at most that many names, all taken from features[].name,',
      '  "sketch": [ up to 24 of { "kind": "ellipse", "c": [x, y], "r": [rx, ry], "rot": radians } | { "kind": "polygon", "points": [[x, y], …], "closed": true } | { "kind": "line", "points": [[x, y], …] } ] — a rough outline of the whole creature, big and simple, made of these primitives only,',
      '  "reveal": [ up to 8 of { "name": CAPITALS ≤ 24 chars (MANE, TAIL TUFT, WING MEMBRANE, HORNS…), "kind": one of "contour" (flowing strokes) | "fill" (a soft silhouette) | "lines" (accents across a part) | "texture" (a field of small marks) | "spike" (tapered appendages) | "glow" (one soft light) | "motes" (a few drifting lights), "near": a features[].name } ] — optional: visual details that give the finished creature its character, to be shown only AFTER the figure is complete as a brief payoff; names and kinds only, never points, never shapes.',
      '}',
      '',
      'Coordinates: unit space, x to the right, y DOWNWARD, every |x| and |y| ≤ 1.3; use most of that range so the figure is large. Every feature anchor must lie on the sketch. No other keys. No URLs, no images, no markup, no text outside the JSON. Do not judge or rate anything; describe what is there.'
    ].join('\n');
    var user = 'Subject: ' + s;
    return { ok: true, subject: s, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  // ---------------------------------------------------------------
  // THE VALIDATOR — deny by shape (Decision 33's discipline). A key not
  // in the schema is refused by name; a value that looks like a link,
  // an image or markup is refused; a bound is a bound. What comes out is
  // a CLEAN copy built field by field, never the model's object.
  // ---------------------------------------------------------------
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function pt(v) { return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && Math.abs(v[0]) <= COORD && Math.abs(v[1]) <= COORD; }
  function badText(s) {
    return typeof s !== 'string' || !s.trim() || s.length > LIMITS.textChars ||
      /https?:|data:|vihu-asset:|<[a-z!\/]|base64|\.(png|jpg|jpeg|gif|svg|webp)\b/i.test(s);
  }
  function walkKeys(o, path, out) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v, i) { walkKeys(v, path + '[' + i + ']', out); }); return; }
    Object.keys(o).forEach(function (k) {
      if (FORBIDDEN_KEYS.indexOf(k) !== -1) out.push('forbidden-key:' + path + '.' + k);
      walkKeys(o[k], path + '.' + k, out);
    });
  }

  // A FEATURE NAME IS REPAIRED MECHANICALLY, AND THE REPAIR IS NAMED.
  // The product owner's first real dragon came back refused whole —
  // `bad-feature-name:5, bad-feature-name:6` — because a real model
  // writes "WING-MEMBRANE", "2 HORNS" or "TAIL (TIP)" for a body part,
  // and the rule is capitals, letters and spaces, at most 24. A label
  // with a hyphen in it is not a bad blueprint. So anything that is not
  // a letter or a space becomes a space, runs of spaces collapse, and a
  // name over the cap is cut at a word boundary — one rule, reported on
  // every name it touched (`repairs`), never a guess about meaning. A
  // name with no letters left is still refused, and says which.
  function cleanName(v, log, where) {
    var raw = typeof v === 'string' ? v.trim().toUpperCase() : '';
    var out = raw.replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (out.length > LIMITS.nameChars) {
      var head = out.slice(0, LIMITS.nameChars + 1), cut = head.lastIndexOf(' ');
      out = (cut > 0 ? head.slice(0, cut) : out.slice(0, LIMITS.nameChars)).trim();
    }
    if (log && where && out !== raw) log.push(where + ' "' + raw.slice(0, 40) + '" → "' + out + '"');
    return out;
  }

  function validate(raw) {
    var reasons = [], repairs = [], offending = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'] };
    walkKeys(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons };

    var allowedTop = Object.keys(SCHEMA.top);
    Object.keys(raw).forEach(function (k) { if (allowedTop.indexOf(k) === -1) reasons.push('unknown-key:' + k); });
    if (badText(raw.subject) || raw.subject.length > LIMITS.subjectChars) reasons.push('bad-subject');
    if (badText(raw.silhouette)) reasons.push('bad-silhouette');

    var names = {};
    var features = [];
    if (!Array.isArray(raw.features) || raw.features.length < LIMITS.featuresMin || raw.features.length > LIMITS.featuresMax) {
      reasons.push('bad-features-count');
    } else {
      raw.features.forEach(function (f, i) {
        if (!f || typeof f !== 'object' || Array.isArray(f)) { reasons.push('bad-feature:' + i); return; }
        Object.keys(f).forEach(function (k) { if (!SCHEMA.feature[k]) reasons.push('unknown-key:features[' + i + '].' + k); });
        var name = cleanName(f.name, repairs, 'feature ' + i);
        if (!name || name.length > LIMITS.nameChars || !/^[A-Z][A-Z ]*$/.test(name)) {
          reasons.push('bad-feature-name:' + i);
          offending.push({ index: i, name: typeof f.name === 'string' ? f.name.slice(0, 40) : String(f.name) });
        }
        if (names[name]) reasons.push('duplicate-feature:' + name);
        names[name] = true;
        var imp = f.importance;
        if (!(Number.isInteger(imp) && imp >= LIMITS.importanceMin && imp <= LIMITS.importanceMax)) reasons.push('bad-importance:' + i);
        if (badText(f.why)) reasons.push('bad-why:' + i);
        if (!pt(f.anchor)) reasons.push('bad-anchor:' + i);
        features.push({ name: name, importance: imp, why: String(f.why || '').trim(), anchor: pt(f.anchor) ? [f.anchor[0], f.anchor[1]] : [0, 0] });
      });
    }

    var budgets = {};
    if (!raw.budgets || typeof raw.budgets !== 'object' || Array.isArray(raw.budgets)) {
      reasons.push('bad-budgets');
    } else {
      var keys = Object.keys(raw.budgets).sort(function (a, b) { return Number(a) - Number(b); });
      var keysOk = REQUIRED_BUDGETS.every(function (b) { return keys.indexOf(String(b)) !== -1; }) &&
                   keys.every(function (k) { return BUDGETS.indexOf(Number(k)) !== -1; });
      if (!keysOk) reasons.push('bad-budget-keys:' + keys.join('/'));
      BUDGETS.forEach(function (b) {
        if (keys.indexOf(String(b)) === -1) return;          // 10 and 18 are optional
        var list = raw.budgets[String(b)];
        if (!Array.isArray(list) || list.length > b) { reasons.push('bad-budget-list:' + b); budgets[String(b)] = []; return; }
        var seen = {}, out = [];
        list.forEach(function (n) {
          var u = cleanName(n);
          if (!names[u]) { reasons.push('budget-names-unknown-feature:' + b); return; }
          if (!seen[u]) { seen[u] = true; out.push(u); }
        });
        budgets[String(b)] = out;
      });
    }

    // The sketch is deprecated: accepted when present (an older prompt or
    // a model that still returns one), never required, never shown.
    var sketch = [];
    if (raw.sketch !== undefined && (!Array.isArray(raw.sketch) || raw.sketch.length > LIMITS.sketchMax)) {
      reasons.push('bad-sketch-count');
    } else if (Array.isArray(raw.sketch)) {
      raw.sketch.forEach(function (p, i) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) { reasons.push('bad-primitive:' + i); return; }
        Object.keys(p).forEach(function (k) { if (!SCHEMA.primitive[k]) reasons.push('unknown-key:sketch[' + i + '].' + k); });
        if (p.kind === 'ellipse') {
          var rOk = Array.isArray(p.r) && p.r.length === 2 && isNum(p.r[0]) && isNum(p.r[1]) &&
            p.r[0] >= 0.02 && p.r[1] >= 0.02 && p.r[0] <= COORD && p.r[1] <= COORD;
          if (!pt(p.c) || !rOk || (p.rot !== undefined && !isNum(p.rot))) { reasons.push('bad-ellipse:' + i); return; }
          sketch.push({ kind: 'ellipse', c: [p.c[0], p.c[1]], r: [p.r[0], p.r[1]], rot: isNum(p.rot) ? p.rot : 0 });
        } else if (p.kind === 'polygon' || p.kind === 'line') {
          var ptsOk = Array.isArray(p.points) && p.points.length >= 2 && p.points.length <= LIMITS.polyPointsMax && p.points.every(pt);
          if (!ptsOk || (p.closed !== undefined && typeof p.closed !== 'boolean')) { reasons.push('bad-' + p.kind + ':' + i); return; }
          sketch.push({ kind: p.kind, points: p.points.map(function (q) { return [q[0], q[1]]; }), closed: p.kind === 'polygon' ? p.closed !== false : false });
        } else {
          reasons.push('bad-primitive-kind:' + i);
        }
      });
    }

    // REVEAL SUGGESTIONS — optional and semantic. Keys are refused by
    // name; a name is tidied exactly as a feature's is; an unknown kind or
    // an unknown `near` is dropped and RECORDED as a repair rather than
    // refusing a blueprint whose figure is fine.
    var reveal = [];
    if (raw.reveal !== undefined) {
      if (!Array.isArray(raw.reveal) || raw.reveal.length > LIMITS.revealMax) reasons.push('bad-reveal-count');
      else raw.reveal.forEach(function (r, i) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) { reasons.push('bad-reveal:' + i); return; }
        Object.keys(r).forEach(function (k) { if (!SCHEMA.reveal[k]) reasons.push('unknown-key:reveal[' + i + '].' + k); });
        var nm = cleanName(r.name, repairs, 'reveal ' + i);
        if (!nm || !/^[A-Z][A-Z ]*$/.test(nm)) { reasons.push('bad-reveal-name:' + i); return; }
        var kind = null;
        if (r.kind !== undefined) {
          if (REVEAL_KINDS.indexOf(r.kind) !== -1) kind = r.kind;
          else repairs.push('reveal ' + i + ' kind "' + String(r.kind).slice(0, 24) + '" → unset (not one of the seven)');
        }
        var near = null;
        if (r.near !== undefined) {
          var nn = cleanName(r.near);
          if (names[nn]) near = nn; else repairs.push('reveal ' + i + ' near "' + String(r.near).slice(0, 24) + '" → unset (names no feature)');
        }
        reveal.push({ name: nm, kind: kind, near: near });
      });
    }

    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs, offending: offending };
    return { ok: true, reasons: [], repairs: repairs, offending: [], blueprint: {
      subject: String(raw.subject).trim(),
      silhouette: String(raw.silhouette).trim(),
      features: features,
      budgets: budgets,
      sketch: sketch,
      reveal: reveal
    } };
  }

  // A model's reply is TEXT until proven otherwise.
  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reasons: ['empty'] };
    var t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'] }; }
    }
    return validate(obj);
  }

  // ---------------------------------------------------------------
  // THE FIXTURE — for a session with no model. Deliberately GENERIC:
  // one body plan, the same for every subject, that says what it is.
  // It exercises the pipeline; it does not pretend to know the animal.
  // ---------------------------------------------------------------
  function fixture(subject) {
    var s = cleanSubject(subject) || 'creature';
    return validate({
      subject: s,
      silhouette: 'FIXTURE — a generic side-on body plan standing in for "' + s + '"; not the creature, only the pipeline.',
      features: [
        { name: 'HEAD', importance: 3, why: 'Where a creature is looked at first.', anchor: [-0.85, -0.45] },
        { name: 'BODY', importance: 3, why: 'The mass everything else hangs from.', anchor: [0.1, 0.0] },
        { name: 'TAIL', importance: 2, why: 'Often the second thing that names an animal.', anchor: [1.05, -0.35] },
        { name: 'FRONT LEG', importance: 2, why: 'A leg says it stands.', anchor: [-0.45, 0.75] },
        { name: 'BACK LEG', importance: 2, why: 'A second leg says it walks.', anchor: [0.6, 0.75] },
        { name: 'EAR', importance: 1, why: 'A small mark that helps a head read as a head.', anchor: [-0.95, -0.85] }
      ],
      budgets: {
        '8': ['HEAD', 'BODY', 'TAIL', 'FRONT LEG', 'BACK LEG'],
        '12': ['HEAD', 'BODY', 'TAIL', 'FRONT LEG', 'BACK LEG', 'EAR'],
        '16': ['HEAD', 'BODY', 'TAIL', 'FRONT LEG', 'BACK LEG', 'EAR'],
        '20': ['HEAD', 'BODY', 'TAIL', 'FRONT LEG', 'BACK LEG', 'EAR']
      },
      // generic, like the body plan: a crest at the head, a tuft at the tail
      reveal: [
        { name: 'CREST', kind: 'contour', near: 'HEAD' },
        { name: 'TAIL TUFT', kind: 'contour', near: 'TAIL' }
      ],
      sketch: [
        { kind: 'ellipse', c: [0.1, 0.0], r: [0.75, 0.42], rot: 0 },
        { kind: 'ellipse', c: [-0.85, -0.45], r: [0.3, 0.26], rot: 0 },
        { kind: 'polygon', points: [[-0.95, -0.85], [-1.05, -0.62], [-0.8, -0.68]], closed: true },
        { kind: 'line', points: [[-0.5, 0.35], [-0.45, 0.85]] },
        { kind: 'line', points: [[0.55, 0.35], [0.6, 0.85]] },
        { kind: 'line', points: [[0.8, -0.15], [1.05, -0.35], [1.2, -0.7]] }
      ]
    });
  }

  // ---------------------------------------------------------------
  // SUGGESTIONS — where a point COULD go for a budget, RANKED.
  //
  // The blueprint says WHICH features a budget is worth spending on (its
  // own budget lists) and HOW MUCH each matters (importance); the outline
  // says WHERE those features are, as landmarks with a level — 1 the
  // part's defining point, 2 a structural place, 3 a detail place. A
  // suggestion's priority is the feature's importance first and the
  // landmark's level second, so:
  //   - budget 8 takes the defining points of the most diagnostic
  //     features (a head, a body, a beak, a trunk, the wing tips);
  //   - a larger budget ADDS structure (a shoulder, a rump, a wing root)
  //     and then detail (a knee, a trailing edge) — useful places, never
  //     filler;
  //   - a smaller budget drops the lowest-priority marks first, so what
  //     survives is what the blueprint itself calls diagnostic.
  // One ranking serves every budget: budget N is the first N of it, so
  // going 8 → 12 only ever adds marks and 12 → 8 only ever removes them.
  // Pure: it places nothing, stores nothing, and never reads the figure.
  // ---------------------------------------------------------------
  var DEDUPE = 0.07;                 // two landmarks this close are one place

  // The blueprint's own list for this budget: its own if it named one,
  // else the nearest smaller budget it did name; no lists → every feature.
  function listFor(bp, budget) {
    var lists = bp.budgets || {};
    var have = Object.keys(lists).map(Number).filter(function (b) { return Array.isArray(lists[b]) && lists[b].length; }).sort(function (a, b) { return a - b; });
    if (!have.length) return null;
    var pick = null;
    have.forEach(function (b) { if (b <= budget) pick = b; });
    if (pick === null) pick = have[0];
    return lists[String(pick)];
  }

  function candidates(bp, outline) {
    if (!bp || !Array.isArray(bp.features)) return [];
    var order = {}, byName = {};
    bp.features.forEach(function (f, i) { order[f.name] = i; byName[f.name] = f; });
    var lm = (outline && Array.isArray(outline.landmarks)) ? outline.landmarks : [];
    var covered = {};
    var out = lm.filter(function (l) { return byName[l.name]; }).map(function (l, i) {
      covered[l.name] = true;
      return { name: l.name, label: l.label || l.name.toLowerCase(), x: l.x, y: l.y, level: l.level || 1, importance: byName[l.name].importance, seq: i };
    });
    // A feature the outline could not place keeps the blueprint's own
    // anchor as its one defining point.
    bp.features.forEach(function (f, i) {
      if (covered[f.name]) return;
      out.push({ name: f.name, label: f.name.toLowerCase(), x: f.anchor[0], y: f.anchor[1], level: 1, importance: f.importance, seq: 1000 + i });
    });
    // importance first; a structural place is worth less than a defining
    // point and a detail place less again; a feature's second, third and
    // fourth marks at one level each count a little less than its first,
    // so four feet do not crowd out a tail.
    var seen = {};
    out.forEach(function (c) {
      var k = c.name + '#' + c.level, dup = seen[k] || 0; seen[k] = dup + 1;
      c.priority = c.importance * 10 - (c.level - 1) * 14 - dup * 3;
    });
    out.sort(function (a, b) {
      return (b.priority - a.priority) || (order[a.name] - order[b.name]) || (a.level - b.level) || (a.seq - b.seq);
    });
    // Two marks on one place are one mark: the higher-ranked stays.
    var kept = [];
    out.forEach(function (c) {
      if (kept.some(function (k) { return Math.hypot(k.x - c.x, k.y - c.y) < DEDUPE; })) return;
      kept.push(c);
    });
    return kept;
  }

  // `outline` — the composed Creature Outline (with `landmarks`), or, for
  // compatibility, the old anchors map {NAME: [[x,y],…]}, or nothing.
  function suggestions(bp, budget, outline) {
    if (!bp || !bp.features) return [];
    budget = Number(budget) || 0;
    var o = outline;
    if (outline && !outline.landmarks && !outline.paths && typeof outline === 'object') {
      // an anchors map: every entry is a level-1 landmark
      var lmk = [];
      Object.keys(outline).forEach(function (n) { (outline[n] || []).forEach(function (q) { lmk.push({ name: n, label: n.toLowerCase(), x: q[0], y: q[1], level: 1 }); }); });
      o = { landmarks: lmk };
    }
    var allowed = listFor(bp, budget);
    var ranked = candidates(bp, o).filter(function (c) { return !allowed || allowed.indexOf(c.name) !== -1; });
    return ranked.slice(0, budget).map(function (c, i) {
      return { name: c.name, label: c.label, x: c.x, y: c.y, importance: c.importance, level: c.level, rank: i + 1 };
    });
  }

  // Every landmark of ONE feature, in rank order and at every level —
  // what a light focus on a feature exposes (a wing: its tip, its root,
  // its leading and trailing edges). Not bounded by the budget: the
  // budget bounds what is suggested unasked, not what may be looked at.
  function related(bp, outline, name) {
    var n = String(name || '').toUpperCase();
    return candidates(bp, outline).filter(function (c) { return c.name === n; }).map(function (c) {
      return { name: c.name, label: c.label, x: c.x, y: c.y, importance: c.importance, level: c.level };
    });
  }

  global.LabBlueprint = {
    SCHEMA: SCHEMA, LIMITS: LIMITS, REVEAL_KINDS: REVEAL_KINDS.slice(), BUDGETS: BUDGETS.slice(), REQUIRED_BUDGETS: REQUIRED_BUDGETS.slice(), FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(), COORD: COORD,
    cleanSubject: cleanSubject, cleanName: cleanName, messagesFor: messagesFor, validate: validate, parse: parse,
    fixture: fixture, suggestions: suggestions, related: related, listFor: listFor
  };
})(typeof window !== 'undefined' ? window : this);
