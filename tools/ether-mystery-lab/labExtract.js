// tools/ether-mystery-lab/labExtract.js — IMAGE → ETHER EXTRACTION, the
// simplest bridge: the vision model looks at the chosen picture and
// proposes the Ether interpretation DIRECTLY — points in normalized image
// coordinates, the connections of the complete figure, which of them to
// leave missing, the reveal features, a hint — and the Shape Lab takes it
// as a starting figure the researcher corrects.
//
// SPRINT — Image → Ether creature, end-to-end closure (Decision 58, Lab
// only). It deliberately replaces the semantic-compiler route as the
// primary path: the image model creates, the vision model understands,
// the Shape Lab corrects, the existing Ether runtime makes it alive.
//
// COORDINATES ARE ALLOWED HERE, AND THAT IS A RESEARCH DECISION. This is
// a researcher tool: a normalized x,y in the source image is the model's
// proposed interpretation of a picture, not production geometry — the
// researcher moves, adds and deletes every point, and only an approved
// figure goes anywhere. The plan and decision contracts of the earlier
// sprints still refuse a coordinate; this contract asks for one.
//
// VALIDATE, REPAIR ON RECORD, REFUSE WHAT CANNOT BE REPAIRED. The
// application never crashes because the model returned too many points,
// a coordinate off the picture, duplicate ids, a connection to a point
// that does not exist, a self-connection, a reveal anchored to nothing,
// or something that is not JSON. What has one obvious repair is repaired
// and the repair is written down; what has none is refused with the
// reason named.
//
// NO CREATURE CATALOGUE. No species word in this file's code and no
// `subject ===`; the suite scans for both. The examples the contract
// shows the model are the brief's own and are text, not branches.

(function (global) {
  'use strict';

  var BUDGETS = [8, 10, 12, 16, 18, 20];
  var LIMITS = { pointsMin: 3, idChars: 12, featureChars: 24, missingMax: 3, revealMax: 6, reasonChars: 160, hintMin: 8, hintMax: 90, textChars: 300 };
  var REVEAL_TYPES = ['diagnostic', 'character', 'accent', 'magic'];
  // how a reveal TYPE is first drawn — a starting kind the researcher may
  // change on the row before accepting; generic, never per creature
  var KIND_FOR_TYPE = { diagnostic: 'spike', character: 'contour', accent: 'lines', magic: 'glow' };
  // …and the feature's own NAME says more than its type about how it is
  // drawn: an eye glows, fur is a texture, stripes are lines, a mane is a
  // contour, a horn is a spike. Visual words, never creature words.
  var KIND_FOR_WORD = [
    [/\b(eyes?|glow|light|lantern|spark|shine|gleam)\b/i, 'glow'],
    [/\b(fur|scales?|patch|patches|speckle|freckle|texture|dots?)\b/i, 'texture'],
    [/\b(stripes?|lines?|feathers?|rings?|veins?|ridges?|baleen)\b/i, 'lines'],
    [/\b(mane|hair|tuft|whiskers?|frill|flow|crest)\b/i, 'contour'],
    [/\b(horns?|spikes?|tusks?|claws?|talons?|fangs?|antlers?|thorns?)\b/i, 'spike'],
    [/\b(membranes?|fins?|sails?|webs?)\b/i, 'fill'],
    [/\b(motes?|dust|sparkles?|stardust|shimmer)\b/i, 'motes']
  ];
  function kindFor(name, type) { for (var i = 0; i < KIND_FOR_WORD.length; i++) if (KIND_FOR_WORD[i][0].test(name || '')) return KIND_FOR_WORD[i][1]; return KIND_FOR_TYPE[type] || 'contour'; }
  var KINDS = ['contour', 'fill', 'lines', 'texture', 'spike', 'glow', 'motes'];
  var FIT = 1.1;                       // the figure fills [-FIT, FIT] of the editor's unit space
  var BAD_TEXT = /https?:\/\/|\bwww\.|data:|<[a-z/!?]|\bsk-[A-Za-z0-9_-]{8,}|function\s*\(|=>|\beval\(|\$\{|<\/?[a-z]+>/i;
  var HINT_INSTRUCTION = /\b(connect|join|tap|click|press|touch|dot|dots|line|lines|draw|complete|finish|puzzle|solve|link|point|points)\b/i;
  var HINT_UNKIND = /\b(kill|dead|die|dies|death|blood|bleed|scary|monster|attack|hurt|weapon)\b/i;
  // keys that would carry a private thing — refused by name at any depth
  var FORBIDDEN_KEYS = ['card', 'cardId', 'owner', 'ownerId', 'email', 'memories', 'memory', 'orbit', 'circle', 'username', 'creator', 'companion', 'story', 'session', 'token', 'key', 'pattern', 'cells', 'constellation', 'stars', 'code', 'script', 'svg', 'html', 'url', 'href', 'src'];

  function token(v) { return typeof v === 'string' ? v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.idChars) : ''; }
  function text(v, n) { return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n || LIMITS.textChars) : ''; }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null); }
  function walkKeys(o, path, out) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v, i) { walkKeys(v, path + '[' + i + ']', out); }); return; }
    Object.keys(o).forEach(function (k) { if (FORBIDDEN_KEYS.indexOf(k) !== -1) out.push('forbidden-key:' + (path ? path + '.' : '') + k); walkKeys(o[k], (path ? path + '.' : '') + k, out); });
  }
  function walkText(o, path, out) {
    if (typeof o === 'string') { if (BAD_TEXT.test(o)) out.push('bad-text:' + path); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v, i) { walkText(v, path + '[' + i + ']', out); }); return; }
    Object.keys(o).forEach(function (k) { walkText(o[k], (path ? path + '.' : '') + k, out); });
  }

  // ---------------------------------------------------------------
  // THE REQUEST — one contract, the budget in it, the picture attached
  // by the transport
  // ---------------------------------------------------------------
  function extractMessages(budget) {
    var n = BUDGETS.indexOf(Number(budget)) !== -1 ? Number(budget) : 12;
    var system = [
      'You are looking at a picture of a being. Produce its ETHER EXTRACTION: a simplified star-figure a child could complete — a small number of bright points joined by straight lines — that clearly becomes the SAME IDEA as the picture. The picture is the source of truth: describe what is actually there, never what a name suggests.',
      'POINTS. Choose the MINIMUM useful points, at most ' + n + ', that make the being recognisable as a silhouette of lines. Prioritise, in this order: 1. the overall silhouette, 2. the major gesture (the main body line), 3. the important transitions (neck, hips, shoulder), 4. diagnostic features (what makes THIS being itself), 5. meaningful terminals (a tip, a tusk), 6. symmetry where it is visually important. Do NOT force every anatomical detail into points — this is a simplified interpretation, not a tracing. Give each point an id (p1, p2, …), its position in the picture as NORMALIZED coordinates (x from 0 at the left to 1 at the right, y from 0 at the top to 1 at the bottom), and one short feature word (head, tail tip, wing tip, front foot…).',
      'CONNECTIONS. The lines of the COMPLETE figure: which points are joined. The result must read as one being in one piece — every point joined to at least one other, the silhouette closed where the picture closes it, and no line that crosses the body for no reason.',
      'MISSING CONNECTIONS. From those connections choose ' + (n <= 8 ? 'one or two' : 'two or three') + ' that will be LEFT OUT to make the unfinished mystery a child completes. Not at random: the unfinished figure must still be intriguing and keep enough identity, the missing relationship must be visibly noticeable, completing it must make sense, and completion must produce a meaningful improvement. Prefer a join BETWEEN parts (a neck, a wing root, a tail root) over a join inside a part; never leave a point with no line at all. Say why for each.',
      'REVEAL FEATURES. Separately from the points: two to five features visible in THIS picture that contribute to identity or character, can be withheld without destroying recognition of the unfinished figure, and add impact when they appear after completion — horns, an eye that lights, back spikes, a mane, flowing hair, a tail tuft, a wing\'s membrane, an ear patch. Never a structural part (the body, the head, the legs). Each has a name, a reason, a type (diagnostic | character | accent | magic) and near: the point ids it belongs beside.',
      'HINT. One short child-friendly line that says what KIND of being is waiting — its nature, where it lives, what it does — without naming it, without listing its body parts, and without telling anyone what to do: like "A hunter of the open sky is waiting…" or "A quiet giant is waiting in the deep…" or "Something ancient is waiting to wake…".',
      'CONFIDENCE. Three numbers from 0 to 1: overall, identity (would the completed figure be recognised), structure (are the points and lines a coherent one-piece figure).',
      'Answer with ONE JSON object and nothing else, exactly this shape:',
      '{ "subject": "what the picture shows, in a few words",',
      '  "points": [ { "id": "p1", "x": 0.42, "y": 0.18, "feature": "head" } ],',
      '  "connections": [ { "a": "p1", "b": "p2" } ],',
      '  "missingConnections": [ { "a": "p4", "b": "p7", "reason": "why this one" } ],',
      '  "revealFeatures": [ { "name": "Horns", "reason": "distinctive identity feature", "type": "diagnostic", "near": ["p3"] } ],',
      '  "hint": "…",',
      '  "confidence": { "overall": 0.0, "identity": 0.0, "structure": 0.0 } }',
      'No other keys. No SVG, no code, no markup, no text outside the JSON.'
    ].join('\n');
    var user = 'The picture is attached. Give its Ether extraction at ' + n + ' points at most.';
    return { ok: true, budget: n, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  }

  // ---------------------------------------------------------------
  // THE VALIDATOR — repair on record, refuse what cannot be repaired
  // ---------------------------------------------------------------
  function validateExtraction(raw, budget) {
    var n = BUDGETS.indexOf(Number(budget)) !== -1 ? Number(budget) : 12;
    var reasons = [], repairs = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], repairs: [] };
    walkKeys(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    walkText(raw, '', reasons);
    if (reasons.length) return { ok: false, reasons: reasons, repairs: [] };
    Object.keys(raw).forEach(function (k) { if (['subject', 'points', 'connections', 'missingConnections', 'revealFeatures', 'hint', 'confidence'].indexOf(k) === -1) { repairs.push('unknown key "' + k + '" ignored'); } });
    if (!Array.isArray(raw.points)) return { ok: false, reasons: ['no-points'], repairs: repairs };

    // points: unique ids, numeric coordinates on the picture, at most the budget
    var points = [], index = {};
    raw.points.forEach(function (p, i) {
      if (!p || typeof p !== 'object') { repairs.push('points[' + i + '] dropped (not an object)'); return; }
      var id = token(p.id) || ('p' + (i + 1));
      if (!token(p.id)) repairs.push('points[' + i + '] had no id → ' + id);
      if (index[id] !== undefined) { repairs.push('points[' + i + '] duplicate id "' + id + '" dropped'); return; }
      var x = num(p.x), y = num(p.y);
      if (x === null || y === null) { reasons.push('bad-coordinate:points[' + i + ']'); return; }
      if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) { reasons.push('coordinate-off-the-picture:points[' + i + ']'); return; }
      var cx = Math.min(1, Math.max(0, x)), cy = Math.min(1, Math.max(0, y));
      if (cx !== x || cy !== y) repairs.push('points[' + i + '] clamped onto the picture');
      if (points.length >= n) { repairs.push('points[' + i + '] beyond the budget of ' + n + ' dropped'); return; }
      index[id] = points.length;
      points.push({ id: id, x: cx, y: cy, feature: (text(p.feature, LIMITS.featureChars) || 'point').toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'POINT' });
    });
    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    if (points.length < LIMITS.pointsMin) return { ok: false, reasons: ['too-few-points:' + points.length], repairs: repairs };

    // connections: existing ids, no self, no duplicate
    var joins = [], seen = {};
    function addJoin(a, b, where) {
      var ia = index[token(a)], ib = index[token(b)];
      if (ia === undefined || ib === undefined) { repairs.push(where + ' names a point that does not exist — dropped'); return -1; }
      if (ia === ib) { repairs.push(where + ' joins a point to itself — dropped'); return -1; }
      var k = Math.min(ia, ib) + '-' + Math.max(ia, ib);
      if (seen[k] !== undefined) return seen[k];
      seen[k] = joins.length;
      joins.push({ a: Math.min(ia, ib), b: Math.max(ia, ib) });
      return seen[k];
    }
    (Array.isArray(raw.connections) ? raw.connections : []).forEach(function (c, i) { if (c && typeof c === 'object') addJoin(c.a, c.b, 'connections[' + i + ']'); else repairs.push('connections[' + i + '] dropped'); });
    if (!Array.isArray(raw.connections)) repairs.push('no connections given');
    if (joins.length < 2) return { ok: false, reasons: ['too-few-connections:' + joins.length], repairs: repairs };

    // missing: among the connections (added if the model forgot to list
    // one), at most three, never a stray point, at least two remaining
    var missing = [], gaps = [];
    var degree = points.map(function () { return 0; });
    joins.forEach(function (j) { degree[j.a]++; degree[j.b]++; });
    (Array.isArray(raw.missingConnections) ? raw.missingConnections.slice(0, LIMITS.missingMax + 2) : []).forEach(function (m, i) {
      if (!m || typeof m !== 'object') { repairs.push('missingConnections[' + i + '] dropped'); return; }
      if (missing.length >= LIMITS.missingMax) { repairs.push('missingConnections[' + i + '] beyond three — dropped'); return; }
      var ia = index[token(m.a)], ib = index[token(m.b)];
      if (ia === undefined || ib === undefined || ia === ib) { repairs.push('missingConnections[' + i + '] names no real pair — dropped'); return; }
      var k = Math.min(ia, ib) + '-' + Math.max(ia, ib);
      var ji = seen[k];
      if (ji === undefined) { ji = addJoin(m.a, m.b, 'missingConnections[' + i + ']'); repairs.push('missingConnections[' + i + '] was not among the connections — added as one, then left missing'); degree[ia]++; degree[ib]++; }
      if (missing.indexOf(ji) !== -1) return;
      if (degree[ia] < 2 || degree[ib] < 2) { repairs.push('missingConnections[' + i + '] would leave a lone point — kept as a connection instead'); return; }
      if (joins.length - missing.length - 1 < 2) { repairs.push('missingConnections[' + i + '] would leave fewer than two connections — kept'); return; }
      missing.push(ji); degree[ia]--; degree[ib]--;
      gaps.push({ join: ji, reason: text(m.reason, LIMITS.reasonChars) });
    });
    // WHEN NONE OF THE MODEL'S CHOICES CAN BE LEFT OUT (every one would
    // strand a point), the Lab chooses instead, by the one rule the
    // creature experiments settled: the widest connections whose both
    // ends keep another line, never two sharing a point — and says so
    if (!missing.length) {
      var order = joins.map(function (j, i) { return i; }).filter(function (i) { return degree[joins[i].a] >= 2 && degree[joins[i].b] >= 2; })
        .sort(function (x, y) { return Math.hypot(points[joins[y].a].x - points[joins[y].b].x, points[joins[y].a].y - points[joins[y].b].y) - Math.hypot(points[joins[x].a].x - points[joins[x].b].x, points[joins[x].a].y - points[joins[x].b].y) || x - y; });
      var used = {}, want = n <= 8 ? 1 : 2;
      order.forEach(function (i) {
        if (missing.length >= want) return;
        var j = joins[i];
        if (used[j.a] || used[j.b] || degree[j.a] < 2 || degree[j.b] < 2 || joins.length - missing.length - 1 < 2) return;
        missing.push(i); used[j.a] = true; used[j.b] = true; degree[j.a]--; degree[j.b]--;
        gaps.push({ join: i, reason: 'chosen by the Lab — none of the model\'s could be left out without stranding a point' });
      });
      if (missing.length) repairs.push('missing connections chosen by the Lab (the model\'s would each strand a point)');
    }
    missing.sort(function (x, y) { return x - y; });

    // reveal features: a name, a reason, a type, anchored to real points
    var reveal = [];
    (Array.isArray(raw.revealFeatures) ? raw.revealFeatures.slice(0, LIMITS.revealMax + 2) : []).forEach(function (r, i) {
      if (!r || typeof r !== 'object') { repairs.push('revealFeatures[' + i + '] dropped'); return; }
      if (reveal.length >= LIMITS.revealMax) { repairs.push('revealFeatures[' + i + '] beyond six — dropped'); return; }
      var name = text(r.name, 24).toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name) { repairs.push('revealFeatures[' + i + '] has no name — dropped'); return; }
      var type = REVEAL_TYPES.indexOf(token(r.type)) !== -1 ? token(r.type) : 'character';
      if (REVEAL_TYPES.indexOf(token(r.type)) === -1) repairs.push('revealFeatures[' + i + '].type "' + String(r.type).slice(0, 16) + '" → character');
      var near = (Array.isArray(r.near) ? r.near : [r.near]).map(function (id) { return index[token(id)]; }).filter(function (ix) { return ix !== undefined; });
      near = near.filter(function (ix, k) { return near.indexOf(ix) === k; });
      if (!near.length) { repairs.push('revealFeatures[' + i + '] "' + name + '" anchored to no real point — dropped'); return; }
      reveal.push({ name: name, reason: text(r.reason, LIMITS.reasonChars), type: type, near: near, kind: kindFor(name, type) });
    });

    // hint: an invitation, never an instruction; the fallback is honest
    var hint = null, hs = text(raw.hint, 120);
    if (hs) {
      if (hs.length < LIMITS.hintMin || hs.length > LIMITS.hintMax) repairs.push('hint refused (length)');
      else if (/\d/.test(hs)) repairs.push('hint refused (digit)');
      else if (HINT_INSTRUCTION.test(hs)) repairs.push('hint refused (instruction)');
      else if (HINT_UNKIND.test(hs)) repairs.push('hint refused (unkind)');
      else hint = /[.!…]$/.test(hs) ? hs : hs + '…';
    }
    var c = raw.confidence && typeof raw.confidence === 'object' ? raw.confidence : {};
    function conf(k) { var v = num(c[k]); return v === null ? null : Math.round(Math.min(1, Math.max(0, v)) * 100) / 100; }
    var confidence = { overall: conf('overall'), identity: conf('identity'), structure: conf('structure') };

    return { ok: true, reasons: [], repairs: repairs, extraction: { subject: text(raw.subject, 60) || 'unnamed', budget: n, points: points, joins: joins, missing: missing, gaps: gaps, revealFeatures: reveal, hint: hint, confidence: confidence } };
  }
  function parseExtraction(txt, budget) {
    if (typeof txt !== 'string' || !txt.trim()) return { ok: false, reasons: ['empty'], repairs: [] };
    var t = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'], repairs: [] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'], repairs: [] }; }
    }
    return validateExtraction(obj, budget);
  }

  // THE EDITOR'S SPACE, ALIGNED TO THE PICTURE. A point at (x, y) in the
  // picture lands exactly where the SOURCE UNDER underlay draws that spot,
  // so AUTHOR over the source answers the researcher's one question —
  // does the figure sit on the creature? — by eye. The underlay draws the
  // picture centred at 0.86 of the pane's short side and the editor's unit
  // is 0.46 of that side over COORD 1.4, so the picture's half-extent is
  // 0.43 / 0.46 × 1.4 units; a picture that is not square is narrower on
  // its short axis by its own aspect. Nothing is re-fitted: a small
  // creature in a big picture is a small figure, which is the truth.
  var PICTURE_HALF = 0.43 / 0.46 * 1.4;
  function toEditor(points, aspect) {
    var r = aspect > 0 ? aspect : 1;
    var hx = PICTURE_HALF * (r >= 1 ? 1 : r), hy = PICTURE_HALF * (r >= 1 ? 1 / r : 1);
    return points.map(function (p) { return [Math.round((p.x - 0.5) * 2 * hx * 100) / 100, Math.round((p.y - 0.5) * 2 * hy * 100) / 100]; });
  }

  // THE FIXTURE EXTRACTION — for a session with no model: a generic ring
  // of N points labelled FIXTURE, one gap, a generic hint. It says it is
  // one and describes nothing in the picture.
  function fixtureExtraction(budget) {
    var n = BUDGETS.indexOf(Number(budget)) !== -1 ? Number(budget) : 8;
    var pts = [], conns = [];
    for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2; pts.push({ id: 'p' + (i + 1), x: 0.5 + 0.38 * Math.cos(a), y: 0.5 + 0.38 * Math.sin(a), feature: 'fixture ' + (i + 1) }); }
    for (var k = 0; k < n; k++) conns.push({ a: 'p' + (k + 1), b: 'p' + ((k + 1) % n + 1) });
    return JSON.stringify({ subject: 'a fixture ring — no model looked', points: pts, connections: conns, missingConnections: [{ a: 'p1', b: 'p2', reason: 'fixture' }], revealFeatures: [], hint: 'Something is waiting…', confidence: { overall: 0, identity: 0, structure: 0 } });
  }

  // ---------------------------------------------------------------
  // THE FLOW ON THE PAGE
  // ---------------------------------------------------------------
  var doc = global.document;
  var state = { extraction: null, meta: null, busy: false, last: null, accepted: {}, rejected: {}, kinds: {}, imageId: null };
  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(msg, kind) { var n = el('[data-extract-status]'); if (n) { n.textContent = msg || ''; n.className = 'say extract-status' + (kind ? ' ' + kind : ''); } }
  function connMode() { var C = global.LabConnection; return C ? C.status().mode : 'fixture'; }
  function unconfigured() { var C = global.LabConnection; return !!C && connMode() !== 'fixture' && /not configured/.test(C.status().line); }
  function budgetNow() { var S = global.ShapeLab; return S ? S.state().budget : 12; }

  // UNDERSTAND & BUILD ETHER: the picture → the model → validated →
  // loaded as one generated figure, its gaps marked, its hint written,
  // its reveal features offered.
  function extract(opts) {
    opts = opts || {};
    var I = global.LabImagine, C = global.LabConnection, S = global.ShapeLab;
    if (!I || !C || !S) { status('A module is not loaded.', 'warn'); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
    var img = I.selectedImageBytes ? I.selectedImageBytes() : null;
    if (!img) { status('Choose a picture first — the extraction is read from the picture.', 'warn'); return Promise.resolve({ ok: false, reason: 'no-image' }); }
    if (state.busy) return Promise.resolve({ ok: false, reason: 'busy' });
    var budget = opts.budget || budgetNow();
    var mode = connMode();
    var kept = state.extraction ? 'The figure you had is still here.' : 'Nothing changed.';
    var trace = { stage: 'extract', mode: mode, budget: budget, imageId: img.id, request: null, answer: null, parse: null, outcome: 'pending' };
    state.last = trace;
    if (unconfigured()) {
      trace.request = 'not sent — the source is selected but not configured'; trace.outcome = 'not-configured';
      status('The source is selected but not configured — set it under Advanced, or choose Fixture. Nothing was extracted. ' + kept, 'warn'); render();
      return Promise.resolve({ ok: false, reason: 'not-configured' });
    }
    var m = extractMessages(budget);
    trace.request = mode === 'fixture' ? 'none — fixture mode answers with a ring that says it is one' : 'sent through LabConnection (' + mode + '): the extraction contract and the picture — nothing else';
    state.busy = true; render();
    status(mode === 'fixture' ? 'Fixture: a ring of ' + budget + ' points, not the creature…' : 'Reading the picture and building the Ether figure at ' + budget + ' points (' + mode + ')…');
    return C.understand({ messages: m.messages, image: { mime: img.mime, b64: img.b64 }, fixture: function () { return fixtureExtraction(budget); }, maxTokens: 3000 }).then(function (r) {
      state.busy = false;
      if (!r || !r.ok) {
        var reason = (r && r.reason) || 'unavailable';
        trace.answer = { ok: false, reason: reason }; trace.outcome = 'failed';
        status('The extraction failed — ' + reason + ' (' + mode + '). No fixture was substituted. ' + kept, 'warn'); render();
        return { ok: false, reason: reason };
      }
      trace.answer = { ok: true, source: r.source, model: r.model || null, chars: String(r.text || '').length };
      var v = parseExtraction(r.text, budget);
      trace.parse = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
      if (!v.ok) {
        trace.outcome = 'rejected';
        status('The extraction was refused — ' + v.reasons.slice(0, 3).join(', ') + '. Nothing was loaded. ' + kept, 'warn'); render();
        return { ok: false, reason: 'invalid-extraction', reasons: v.reasons };
      }
      var loaded = load(v.extraction, r.source === 'fixture' ? 'fixture' : 'extraction');
      state.extraction = v.extraction;
      state.meta = { source: r.source, mode: mode, model: r.model || null, repairs: v.repairs || [], at: Date.now(), imageId: img.id, budget: budget };
      state.accepted = {}; state.rejected = {}; state.kinds = {}; state.imageId = img.id;
      trace.outcome = r.source === 'fixture' ? 'fixture' : 'generated';
      var e = v.extraction;
      status((r.source === 'fixture' ? 'Fixture ring loaded — not the creature. ' : 'Ether figure extracted (' + (r.model || mode) + '): ' + e.subject + ' — ') + e.points.length + ' points, ' + e.joins.length + ' connections, ' + e.missing.length + ' missing, ' + e.revealFeatures.length + ' reveal suggestion' + (e.revealFeatures.length === 1 ? '' : 's') + (e.hint ? ', a hint' : '') + (e.confidence.identity != null ? ' · identity ' + e.confidence.identity : '') + '. Judge it on the right; correct anything.', 'ok');
      render();
      return { ok: true, source: r.source, points: e.points.length, loaded: loaded };
    }).catch(function () {
      state.busy = false; trace.answer = { ok: false, reason: 'error' }; trace.outcome = 'failed';
      status('The extraction failed (' + mode + '). ' + kept, 'warn'); render();
      return { ok: false, reason: 'error' };
    });
  }

  function load(e, source) {
    var S = global.ShapeLab, T = global.LabTranslate;
    var pts = toEditor(e.points, T && T.sourceAspect ? T.sourceAspect() : 1);
    // ONE generated figure, ONE history step: the gaps the model named
    // and its hint land WITH the points and joins, so the figure reads
    // GENERATED — not GENERATED · EDITED — until the researcher touches it
    var loaded = S.loadGenerated({ budget: e.budget, points: pts, roles: e.points.map(function (p) { return p.feature; }), joins: e.joins.map(function (j, i) { return { a: j.a, b: j.b, gap: e.missing.indexOf(i) !== -1 }; }), source: source === 'fixture' ? 'fixture' : 'translation', subject: e.subject, hint: e.hint || 'Something is waiting…' });
    return loaded;
  }

  // ---------------------------------------------------------------
  // REVEAL SUGGESTIONS — accept (as the kind chosen on the row), reject
  // ---------------------------------------------------------------
  function suggestions() {
    var e = state.extraction;
    if (!e) return [];
    return e.revealFeatures.map(function (r, i) {
      return { index: i, name: r.name, reason: r.reason, type: r.type, near: r.near, kind: state.kinds[i] || r.kind, state: state.accepted[i] ? 'accepted' : state.rejected[i] ? 'rejected' : 'offered' };
    });
  }
  function acceptReveal(i, kind) {
    var S = global.ShapeLab;
    var s = suggestions()[i];
    if (!s || !S) return { ok: false, reason: 'no-such-suggestion' };
    var k = KINDS.indexOf(kind) !== -1 ? kind : s.kind;
    var st = S.state();
    var a = s.near[0], b = null, best = Infinity;
    if (!st.points[a]) return { ok: false, reason: 'anchor-gone' };
    // B is the nearest other anchor, or the nearest other light — a small
    // frame, which the researcher resizes from there
    var pool = s.near.length > 1 ? s.near.slice(1) : st.points.map(function (p, ix) { return ix; }).filter(function (ix) { return ix !== a; });
    pool.forEach(function (ix) { if (!st.points[ix]) return; var d = Math.hypot(st.points[ix][0] - st.points[a][0], st.points[ix][1] - st.points[a][1]); if (d < best) { best = d; b = ix; } });
    var r = S.addReveal(k, a, b, s.name);
    if (!r.ok) return r;
    state.accepted[i] = r.id; delete state.rejected[i];
    render();
    return { ok: true, id: r.id, kind: k };
  }
  function rejectReveal(i) { if (!suggestions()[i]) return { ok: false, reason: 'no-such-suggestion' }; state.rejected[i] = true; delete state.accepted[i]; render(); return { ok: true }; }
  function setKind(i, kind) { if (KINDS.indexOf(kind) !== -1) state.kinds[i] = kind; render(); }

  // ---------------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------------
  function renderPanel() {
    var box = el('[data-extract-panel]');
    if (!box) return;
    var e = state.extraction, m = state.meta || {};
    if (!e) { box.innerHTML = '<div class="note">Nothing extracted yet. Choose a picture, then press Understand &amp; Build Ether.</div>'; return; }
    function h(t) { return '<div class="an-h">' + esc(t) + '</div>'; }
    var rows = [];
    rows.push('<div class="srcbadge ' + (m.source === 'fixture' ? 'fixture' : 'llm') + '">' + (m.source === 'fixture' ? 'FIXTURE — a ring, no model looked' : 'ETHER EXTRACTION (' + esc(m.model || m.mode) + ') · read from the picture') + '</div>');
    rows.push(h('Subject') + '<div class="an-v">' + esc(e.subject) + ' · ' + e.points.length + ' points at a budget of ' + e.budget + '</div>');
    rows.push(h('Points') + '<div class="an-v">' + e.points.map(function (p, i) { return i + ' ' + esc(p.feature.toLowerCase()); }).join(' · ') + '</div>');
    rows.push(h('Missing connections') + (e.gaps.length ? '<ul class="an-list">' + e.gaps.map(function (g) { var j = e.joins[g.join]; return '<li><b>' + esc(e.points[j.a].feature.toLowerCase()) + ' ↔ ' + esc(e.points[j.b].feature.toLowerCase()) + '</b>' + (g.reason ? ' — ' + esc(g.reason) : '') + '</li>'; }).join('') + '</ul>' : '<div class="an-v">none kept</div>'));
    rows.push(h('Reveal suggestions') + (e.revealFeatures.length ? '<ul class="an-list">' + e.revealFeatures.map(function (r) { return '<li><b>' + esc(r.name) + '</b> — ' + esc(r.type) + (r.reason ? ' · ' + esc(r.reason) : '') + '</li>'; }).join('') + '</ul>' : '<div class="an-v">none</div>'));
    rows.push(h('Hint') + '<div class="an-v">' + (e.hint ? '“' + esc(e.hint) + '”' : 'none given — the fallback is used') + '</div>');
    if (e.confidence.overall != null) rows.push(h('Confidence') + '<div class="an-v">overall ' + e.confidence.overall + ' · identity ' + e.confidence.identity + ' · structure ' + e.confidence.structure + '</div>');
    if (m.repairs && m.repairs.length) rows.push(h('Tidied') + '<div class="an-v">' + esc(m.repairs.join(' · ')) + '</div>');
    box.innerHTML = rows.join('');
  }
  function renderSuggestions() {
    var box = el('[data-reveal-extracted]');
    if (!box) return;
    var list = suggestions();
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    var m = state.meta || {};
    var rows = ['<div class="srclabel">Suggested reveals' + (m.source === 'fixture' ? ' — fixture' : ' — read from the picture') + '</div>'];
    list.forEach(function (s) {
      var mark = s.state === 'accepted' ? '☑' : s.state === 'rejected' ? '☒' : '☐';
      rows.push('<div class="rv-sugg ' + esc(s.state) + '" data-rv-ex="' + s.index + '">' +
        '<div class="rv-sugg-h">' + mark + ' <b>' + esc(s.name) + '</b> <span class="rv-sugg-meta">' + esc(s.type) + ' · near ' + esc(s.near.join(', ')) + '</span></div>' +
        '<div class="rv-sugg-why">' + esc(s.reason || '') + '</div>' +
        '<div class="row rv-sugg-actions">' +
        (s.state !== 'accepted' ? '<select data-rv-ex-kind="' + s.index + '" style="width:auto">' + KINDS.map(function (k) { return '<option value="' + k + '"' + (k === s.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select><button class="quiet" data-rv-ex-accept="' + s.index + '">Accept</button>' : '') +
        (s.state !== 'rejected' ? '<button class="quiet" data-rv-ex-reject="' + s.index + '">Reject</button>' : '') +
        (s.state === 'accepted' ? '<span class="note">accepted — edit it in the list above like any feature</span>' : '') +
        '</div></div>');
    });
    box.innerHTML = rows.join('');
    box.querySelectorAll('[data-rv-ex-accept]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-rv-ex-accept')); var sel = box.querySelector('[data-rv-ex-kind="' + i + '"]'); var r = acceptReveal(i, sel ? sel.value : null); if (!r.ok) status('Not added: ' + r.reason, 'warn'); }); });
    box.querySelectorAll('[data-rv-ex-reject]').forEach(function (b) { b.addEventListener('click', function () { rejectReveal(Number(b.getAttribute('data-rv-ex-reject'))); }); });
    box.querySelectorAll('[data-rv-ex-kind]').forEach(function (s) { s.addEventListener('change', function () { state.kinds[Number(s.getAttribute('data-rv-ex-kind'))] = s.value; }); });
  }
  function renderDiag() {
    var box = el('[data-extract-diag]');
    if (!box) return;
    var t = state.last;
    if (!t) { box.innerHTML = '<div class="note">Nothing extracted yet.</div>'; return; }
    function row(k, v, cls) { return '<div class="trow"><span class="tk">' + esc(k) + '</span><span class="tv' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span></div>'; }
    var rows = [row('extract · connection', t.mode), row('extract · budget', String(t.budget)), row('extract · request', t.request || '—')];
    if (t.answer) rows.push(t.answer.ok ? row('extract · answer', 'received · labelled ' + t.answer.source + (t.answer.model ? ' · model ' + t.answer.model : '') + ' · ' + t.answer.chars + ' chars', 'good') : row('extract · answer', 'failed — ' + t.answer.reason, 'bad'));
    if (t.parse) rows.push(t.parse.ok ? row('extract · checked', 'accepted' + (t.parse.repairs.length ? ' · tidied: ' + t.parse.repairs.join(' · ') : ''), 'good') : row('extract · checked', 'refused — ' + t.parse.reasons.join(', '), 'bad'));
    rows.push(row('outcome', t.outcome, /failed|rejected|not-configured/.test(t.outcome) ? 'bad' : 'good'));
    if (state.extraction) rows.push(row('extraction', JSON.stringify(state.extraction)));
    box.innerHTML = rows.join('');
  }
  function render() {
    if (!doc) return;
    var I = global.LabImagine;
    var ready = !!(I && I.selectedImage && I.selectedImage());
    var go = el('[data-extract-go]'); if (go) { go.disabled = !ready || state.busy; go.textContent = 'Understand & Build Ether at ' + budgetNow() + ' points'; }
    var sec = el('[data-extract-section]'); if (sec) sec.setAttribute('data-extract-outcome', state.last ? state.last.outcome : 'none');
    renderPanel(); renderSuggestions(); renderDiag();
  }

  var lastBudget = null, budgetTimer = null;
  function wire() {
    var go = el('[data-extract-go]'); if (go) go.addEventListener('click', function () { extract(); });
    var I = global.LabImagine; if (I && I.observe) I.observe(render);
    var S = global.ShapeLab;
    if (S && S.observe) S.observe(function () {
      // the researcher changed the budget: the SAME picture is read again
      // at the new budget, never a new creature — asked once the change
      // has settled, and only while an extraction of that picture exists
      var b = S.state().budget;
      if (lastBudget === null) lastBudget = b;
      if (b !== lastBudget) {
        lastBudget = b;
        if (state.extraction && state.meta && !state.busy && I && I.selectedImage && I.selectedImage() && I.selectedImage().id === state.imageId && state.meta.budget !== b) {
          if (budgetTimer) global.clearTimeout(budgetTimer);
          budgetTimer = global.setTimeout(function () { extract({ budget: b }); }, 600);
        }
      }
      renderSuggestions(); var g = el('[data-extract-go]'); if (g) g.textContent = 'Understand & Build Ether at ' + b + ' points';
    });
    render();
  }
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire); else wire(); }

  var api = {
    BUDGETS: BUDGETS.slice(), LIMITS: LIMITS, REVEAL_TYPES: REVEAL_TYPES.slice(), KINDS: KINDS.slice(), KIND_FOR_TYPE: KIND_FOR_TYPE, FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(), FIT: FIT, PICTURE_HALF: PICTURE_HALF,
    kindFor: kindFor, extractMessages: extractMessages, validateExtraction: validateExtraction, parseExtraction: parseExtraction, fixtureExtraction: fixtureExtraction, toEditor: toEditor,
    extract: extract, load: load, acceptReveal: acceptReveal, rejectReveal: rejectReveal, setKind: setKind, suggestions: suggestions,
    extraction: function () { return state.extraction ? JSON.parse(JSON.stringify(state.extraction)) : null; },
    meta: function () { return state.meta ? JSON.parse(JSON.stringify(state.meta)) : null; },
    last: function () { return state.last ? JSON.parse(JSON.stringify(state.last)) : null; },
    render: render
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabExtract = api;
  else global.LabExtract = api;
})(typeof window !== 'undefined' ? window : this);
