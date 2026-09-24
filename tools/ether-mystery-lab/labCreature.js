// tools/ether-mystery-lab/labCreature.js — PROMPT. CHOOSE. THE LAB DOES
// THE REST.
//
// SPRINT — Simplify Creature Shape Lab: AI does the authoring (Decision 58).
//
// The researcher provides exactly two things: WHAT SHOULD EXIST (a
// prompt) and WHICH GENERATED IMAGE to use. Everything else — how many
// lights, where they stand, how they join, which joins are left out,
// the leading hint, the reveal features and where they attach, the
// reveal timing, the come-alive sequence — is generated here and
// reviewed, never authored by hand. The manual editor survives under
// ADVANCED / RESEARCH for inspection and emergency correction; it is
// not the workflow.
//
// THE PIPELINE
//
//   prompt ──► image model (three candidates) ──► the researcher chooses
//          ──► text model reads THAT image (vision) ──► an ENCODING
//          ──► compile() turns the encoding into an authored figure
//          ──► ShapeLab.loadFigure() — the same state the editor edits
//          ──► review: UNFINISHED · COMPLETE · COME ALIVE
//          ──► APPROVE · REFINE · TRY ANOTHER IMAGE · TRY ANOTHER
//              ETHER INTERPRETATION
//
// THE SOURCE IMAGE IS THE CREATIVE AUTHORITY. The text model is handed
// the chosen image and told to encode what is IN it — the pose, the
// viewpoint, the visible parts — never a generic idea of the animal the
// prompt named. The prompt travels beside the image only so the model
// knows what it was made from.
//
// WHAT THIS FILE DECIDES BY ITSELF, MECHANICALLY, WITH EVERY REPAIR
// NAMED. A model's encoding is DATA and is validated by shape: an
// unknown key is dropped by name, a forbidden key refuses the whole
// reply, a bound is a bound. The compiler then guarantees what the
// contract asks for and a model will not reliably deliver: ONE
// connected figure (components are joined at their closest lights), no
// light left joined to nothing, missing connections that EXIST in the
// complete figure (never invented), never a gap that strands a light,
// and reveal features anchored to real lights of the figure. Where the
// model gave nothing usable the compiler chooses — the widest joins
// whose removal strands nobody — and says so.
//
// ONE SESSION AT A TIME, AND A LATE ANSWER IS DROPPED. Every prompt
// starts a completely new creature session: the epoch advances, every
// in-flight request is cancelled, the editor is reset, the reference is
// discarded. A response that arrives for an earlier epoch — or an
// earlier generation within the same session — is refused rather than
// applied, so a slow image model can never paint a mermaid into a panda.
//
// WHAT NEVER HAPPENS HERE. No production file is loaded, no pool entry
// is written, no Ether is mounted. Nothing is stored between visits
// except through the Shape Lab's own fixture store when the researcher
// presses APPROVE. No key is held here (labConnection.js owns
// transport). No creature catalogue: there is no `subject ===` anywhere,
// and the fixture stand-ins say they are fixtures.

(function (global) {
  'use strict';

  var VERSION = 'creature-lab-1';
  var IMAGE_MODEL = 'gpt-image-2';
  var TEXT_MODEL = 'gpt-4.1';
  var COORD = 1.3;                       // the Ether's bound on a light (unit space)
  var FIT_EXTENT = 1.12;                 // a compiled figure reaches this far from its centre
  var LIMITS = {
    promptChars: 120,
    refineChars: 200,
    images: 3,
    pointsMin: 8, pointsMax: 30,
    missingMin: 1, missingMax: 5,
    revealsMin: 1, revealsMax: 5,
    hintChars: 90, nameChars: 24, sentenceChars: 220,
    holdS: [1.5, 10]
  };
  var ROLES = ['IDENTITY', 'LIFE', 'MAGIC'];
  var DEFAULT_BUDGETS = [8, 10, 12, 16, 18, 20, 24, 30];
  var FALLBACK_HINT = 'Something is waiting in the dark…';

  // The product's boundary vocabulary. A reply carrying any of these as
  // a KEY, at any depth, is refused whole — the same list the blueprint
  // layer refuses, minus the words that are this contract's own fields.
  var FORBIDDEN_KEYS = ['pattern', 'cells', 'constellation', 'stars', 'card', 'cardId', 'owner', 'ownerId',
    'email', 'memories', 'memory', 'orbit', 'circle', 'username', 'url', 'href', 'src', 'image', 'img',
    'base64', 'svg', 'html', 'script', 'code', 'candidate'];
  var FORBIDDEN_NAME = /\b(CARD|STAR|STARS|CONSTELLATION|MEMORY|MEMORIES|EMAIL|STORY|STORIES|COMPANION|KEY|TOKEN|PASSWORD|OWNER|CREATOR|USERNAME)\b/;
  var TOP_KEYS = ['creature', 'seen', 'confidence', 'points', 'joins', 'missing', 'hint', 'reveals', 'alive', 'holdSeconds'];
  var POINT_KEYS = ['name', 'x', 'y'];
  var REVEAL_KEYS = ['name', 'kind', 'role', 'at', 'toward', 'why', 'size'];
  var ALIVE_KEYS = ['gesture', 'movement'];

  // The come-alive timeline, in milliseconds from the last join. Written
  // down in one place; nothing on screen ever shows a number from it.
  var ALIVE = {
    settleMs: 500,        // the completed figure, as drawn
    blazeMs: 800,         // the world answers: every light flares
    revealAt: 1300,       // reveal features begin to emerge
    gatherAt: 2200,       // the figure draws itself in — a living thing is not a diagram
    gatherMs: 1400,
    gatherScale: 0.72,
    roamAt: 4400,         // it sets off
    firstLegMs: 3000,     // one heading first (going somewhere), then wandering (looking around)
    speed: 0.22,          // unit space per second
    keepAlpha: 0.55       // reveal features settle to this and travel with the creature
  };

  var doc = global.document;

  // ---------------------------------------------------------------
  // TEXT HYGIENE
  // ---------------------------------------------------------------
  function cleanPrompt(p) {
    var s = String(p == null ? '' : p).trim().replace(/\s+/g, ' ');
    if (!s || s.length > LIMITS.promptChars) return null;
    if (!/^[A-Za-z][A-Za-z0-9 ,.'\-!?]*$/.test(s)) return null;
    return s;
  }
  function cleanRefine(v) {
    if (v == null) return '';
    var s = String(v).trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (s.length > LIMITS.refineChars) return null;
    if (!/^[A-Za-z0-9 ,.;:'"!?()\-]*$/.test(s)) return null;
    return s;
  }
  function badText(s) {
    return typeof s !== 'string' || !s.trim() ||
      /https?:|data:|vihu-asset:|<[a-z!\/]|base64|\.(png|jpg|jpeg|gif|svg|webp)\b/i.test(s);
  }
  function sentence(v, max) {
    if (badText(v)) return '';
    return String(v).trim().replace(/\s+/g, ' ').slice(0, max || LIMITS.sentenceChars);
  }
  // A NAME IS STRIPPED OF THE BOUNDARY VOCABULARY, NEVER REFUSED FOR IT.
  // Measured on the first real run: the prompt says "made of stars", so
  // the model called the creature STAR PANDA, and STAR is a Magic Card
  // word the reveal layer refuses in a feature name. Refusing the whole
  // encoding for that would refuse every creature these prompts make.
  // The word goes and the repair is named; only a name with nothing left
  // is a defect.
  function stripForbidden(v) {
    var t = String(v == null ? '' : v).replace(FORBIDDEN_NAME, ' ').replace(/\s+/g, ' ').trim();
    // "FALCON OF STARS" → "FALCON OF" → "FALCON": a connector left dangling
    // at either end by the strip goes with it
    for (var guard = 0; guard < 4; guard++) t = t.replace(/^(?:OF|MADE|WITH|THE|A|AN|IN|FROM|AND)\s+|\s+(?:OF|MADE|WITH|THE|A|AN|IN|FROM|AND)$/, '').trim();
    if (/^(?:OF|MADE|WITH|THE|A|AN|IN|FROM|AND)$/.test(t)) t = '';   // a connector alone is not a name
    return t;
  }
  function cleanName(v) {
    var s = stripForbidden(String(v == null ? '' : v).toUpperCase().replace(/[^A-Z ]+/g, ' ')).replace(/\s+/g, ' ').trim();
    if (s.length > LIMITS.nameChars) s = s.slice(0, LIMITS.nameChars).replace(/\s+\S*$/, '').trim() || s.slice(0, LIMITS.nameChars).trim();
    return s;
  }
  // A hint is one short leading line: plain words, plain punctuation,
  // and NEVER the creature's own name — it names the kind of thing
  // waiting, and a line that says PANDA has answered the question.
  function cleanHint(v, creature) {
    if (badText(v)) return null;
    var s = String(v).trim().replace(/\s+/g, ' ');
    if (!/^[A-Za-z0-9 ,.;:'"!?()\-…]*$/.test(s)) return null;
    if (s.length > LIMITS.hintChars) s = s.slice(0, LIMITS.hintChars).replace(/\s+\S*$/, '') + '…';
    var words = cleanName(creature).split(' ').filter(function (w) { return w.length > 3; });
    var up = s.toUpperCase();
    for (var i = 0; i < words.length; i++) {
      if (new RegExp('\\b' + words[i] + 'S?\\b').test(up)) return null;
    }
    return s;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round2(v) { return Math.round(v * 100) / 100; }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { var x = seed >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x % 100000) / 100000; }; }

  // ---------------------------------------------------------------
  // THE TWO REQUESTS
  // ---------------------------------------------------------------
  // The image prompt is the researcher's own words plus one line that
  // keeps the picture usable as a source: a whole creature, centred, on
  // a dark sky. Recorded in the trace so nobody wonders what was sent.
  function imagePrompt(prompt) {
    var p = cleanPrompt(prompt);
    if (!p) return null;
    return p + '. One whole creature, its entire body visible and centred, clearly silhouetted against a dark night sky. No text, no frame, no other figures.';
  }

  var CONTRACT = [
    'You encode ONE image of a creature into a small figure of lights for a night-sky drawing tool: bright points joined by straight lines. The child will see the figure with a few connections MISSING, complete it by tapping, and the creature comes alive. Interpret the ACTUAL image you are shown — its pose, its viewpoint, the parts that are visible — never a generic idea of the animal named in the prompt.',
    '',
    'Answer with ONE JSON object and nothing else, exactly this shape:',
    '{',
    '  "creature": CAPITALS ≤ 24 chars — what the image shows (PANDA, MERMAID, BABY DRAGON…),',
    '  "seen": one sentence — the pose, the viewpoint (side, front, three-quarter), what is visible and what is hidden in THIS image,',
    '  "confidence": number 0..1 — how surely a figure of lights can carry this image\'s identity,',
    '  "points": [ ' + LIMITS.pointsMin + ' to ' + LIMITS.pointsMax + ' of { "name": CAPITALS ≤ 24 chars (HEAD, LEFT EAR, TAIL TIP…), "x": number, "y": number } ] — the FEWEST lights that preserve the silhouette and the important visible structure (a simple creature needs fewer, a winged or many-limbed one more); every light must be a real place on the creature in this image; "x" and "y" are PERCENTAGES of the image width and height (0 at the left/top edge, 100 at the right/bottom edge) — read each light off the picture as a place in the frame,',
    '  "joins": [ "a-b", … ] — straight connections between point indices (0-based) forming ONE connected figure. PREFER AN OUTLINE TO A SKELETON: put the lights along the silhouette\'s outer edge and join them AROUND it, so the joined figure encloses the body the way the picture\'s edge does (a bird is its wing edges and tail, not a spine with sticks); add an interior light only for something the silhouette alone cannot carry — an eye, the root of a wing — and join it to the outline,',
    '  "missing": [ "a-b", … ] — 2 to ' + LIMITS.missingMax + ' entries COPIED from joins: the connections to leave out so the figure is visibly unfinished yet still recognisable; choose ones whose completion materially improves the figure and gives a natural reason to investigate; never a connection that would leave a light joined to nothing,',
    '  "hint": string ≤ ' + LIMITS.hintChars + ' chars — one short leading line spoken before the child looks, naming the KIND of thing waiting and never its name, never an instruction: "A hunter of the open sky is waiting…", "A quiet giant is waiting in the deep…",',
    '  "reveals": [ 2 to ' + LIMITS.revealsMax + ' of { "name": CAPITALS ≤ 24 chars, "kind": "contour" (flowing strokes: fur, hair, mane) | "fill" (a soft silhouette: a patch, a membrane, a fin) | "lines" (accents across a part: stripes, ribs, feathers) | "texture" (a field of small marks: scales, spots) | "spike" (tapered appendages: horns, claws, spines) | "glow" (one soft light: an eye, a lantern) | "motes" (a few drifting lights: sparks, dust), "role": "IDENTITY" | "LIFE" | "MAGIC", "at": a points[].name, "toward": a points[].name or null (which way the feature extends), "why": one short sentence } ] — ask: what is MISSING from the simplified figure that would make the completed creature feel substantially more like this image? Never random details,',
    '  "alive": { "gesture": one sentence — the one dominant gesture the whole figure should read as, "movement": one sentence — how this creature would move once alive, in words },',
    '  "holdSeconds": number ' + LIMITS.holdS[0] + '..' + LIMITS.holdS[1] + ' — how long the reveal should stay before settling',
    '}',
    'No other keys. No URLs, no images, no markup, no text outside the JSON. Every "at" and "toward" must be a name from points[]. Every entry of missing must be an entry of joins.'
  ].join('\n');

  // extractionMessages(prompt, imageDataUrl, {refine, previous}) — the
  // request for the text model. The image is the chosen candidate as a
  // data URL (its bytes came from the image model, never from anybody's
  // device). A REFINE round carries the researcher's instruction and the
  // previous encoding, so the model revises rather than starts over.
  function extractionMessages(prompt, imageDataUrl, opts) {
    opts = opts || {};
    var p = cleanPrompt(prompt);
    if (!p) return { ok: false, reason: 'bad-prompt' };
    if (typeof imageDataUrl !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/=]+$/.test(imageDataUrl)) return { ok: false, reason: 'bad-image' };
    var refine = cleanRefine(opts.refine);
    if (refine === null) return { ok: false, reason: 'bad-refine' };
    var text = 'Prompt the image was made from: ' + p + '\nEncode THIS image.';
    if (refine) {
      text += '\nThe researcher asks for a revision: "' + refine + '". Revise the previous encoding to honour it while keeping everything that already worked; the image is unchanged.';
      if (opts.previous && typeof opts.previous === 'object') text += '\nPrevious encoding:\n' + JSON.stringify(opts.previous);
    } else if (opts.another) {
      text += '\nGive a DIFFERENT encoding from the previous one — a different choice of lights, joins, missing connections or reveal features — while still interpreting this same image faithfully.';
      if (opts.previous && typeof opts.previous === 'object') text += '\nPrevious encoding (do not repeat it):\n' + JSON.stringify(opts.previous);
    }
    return {
      ok: true, prompt: p, refine: refine,
      messages: [
        { role: 'system', content: CONTRACT },
        { role: 'user', content: [
          { type: 'text', text: text },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
        ] }
      ]
    };
  }

  // ---------------------------------------------------------------
  // THE VALIDATOR — deny by shape. A CLEAN copy is built field by field;
  // the model's own object is never used. Unknown keys are DROPPED by
  // name (a model will add a field; refusing the whole reply for one is
  // the Contract Repair lesson from the other side); a forbidden key at
  // any depth REFUSES the whole reply; a structural failure — too few
  // lights, no joins, no usable coordinates — refuses too, because
  // nothing can be built from it.
  // ---------------------------------------------------------------
  function walkKeys(o, out) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (v) { walkKeys(v, out); }); return; }
    Object.keys(o).forEach(function (k) {
      if (FORBIDDEN_KEYS.indexOf(k) !== -1) out.push(k);
      walkKeys(o[k], out);
    });
  }
  // A JOIN ARRIVES IN WHATEVER FORM THE MODEL CHOSE, AND IS READ. The
  // contract asks for "a-b"; measured on the real run, replies also
  // wrote [a, b] pairs, {"a":…,"b":…} objects, a dash of another kind,
  // and two light NAMES ("HEAD-NECK") — and a whole creature was refused
  // as no-usable-joins for it. The form is normalised here and named as
  // a repair (`join-form:…`); an index past the figure or a name the
  // figure does not have is still a bad join.
  var JOIN_KEYS = [['a', 'b'], ['from', 'to'], ['start', 'end'], ['i', 'j'], ['source', 'target'], ['p1', 'p2'], ['first', 'second']];
  function joinKey(v, n, names, forms) {
    var a = null, b = null, form = null;
    if (typeof v === 'string') {
      var t = v.trim();
      var m = /^(\d{1,2})\s*[-–—,:>]+\s*(\d{1,2})$/.exec(t) || /^(\d{1,2})\s+(?:to|and)\s+(\d{1,2})$/i.exec(t);
      if (m) { a = Number(m[1]); b = Number(m[2]); if (!/^\d{1,2}-\d{1,2}$/.test(t)) form = 'separator'; }
      else if (names) {
        var parts = t.split(/\s*(?:—|–|->|→|\bto\b|,|\|)\s*|\s-\s|-(?=[A-Za-z])/).filter(Boolean);
        if (parts.length === 2) {
          a = names[cleanName(parts[0])]; b = names[cleanName(parts[1])];
          if (a === undefined || b === undefined) return null;
          form = 'names';
        }
      }
    } else if (Array.isArray(v) && v.length === 2) {
      a = v[0]; b = v[1]; form = 'pair';
      if (typeof a === 'string' && names && !/^\d+$/.test(a)) { a = names[cleanName(a)]; b = names[cleanName(b)]; form = 'name-pair'; }
      else { a = Number(a); b = Number(b); }
    } else if (v && typeof v === 'object') {
      for (var k = 0; k < JOIN_KEYS.length; k++) {
        if (v[JOIN_KEYS[k][0]] !== undefined && v[JOIN_KEYS[k][1]] !== undefined) { a = v[JOIN_KEYS[k][0]]; b = v[JOIN_KEYS[k][1]]; form = 'object'; break; }
      }
      if (form === null && Array.isArray(v.points) && v.points.length === 2) { a = v.points[0]; b = v.points[1]; form = 'object'; }
      if (typeof a === 'string' && names && !/^\d+$/.test(a)) { a = names[cleanName(a)]; b = names[cleanName(b)]; form = 'object-names'; }
      else { a = Number(a); b = Number(b); }
    }
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a < 0 || b < 0 || a >= n || b >= n) return null;
    if (form && forms) forms[form] = (forms[form] || 0) + 1;
    return Math.min(a, b) + '-' + Math.max(a, b);
  }

  function validate(raw) {
    var reasons = [], repairs = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], repairs: [] };
    var forb = [];
    walkKeys(raw, forb);
    if (forb.length) return { ok: false, reasons: ['forbidden-key:' + forb.join(',')], repairs: [] };
    Object.keys(raw).forEach(function (k) { if (TOP_KEYS.indexOf(k) === -1) repairs.push('drop-unknown-key:' + k); });

    var out = {};
    out.creature = cleanName(raw.creature) || 'CREATURE';
    if (!cleanName(raw.creature)) repairs.push('creature-name-defaulted');
    else if (FORBIDDEN_NAME.test(String(raw.creature).toUpperCase())) repairs.push('creature-name-stripped');
    out.seen = sentence(raw.seen);
    out.confidence = isNum(raw.confidence) ? round2(clamp(raw.confidence, 0, 1)) : 0.5;
    if (!isNum(raw.confidence)) repairs.push('confidence-defaulted');

    // points
    var pts = [];
    if (!Array.isArray(raw.points)) reasons.push('no-points');
    else {
      raw.points.forEach(function (p, i) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) { repairs.push('drop-bad-point:' + i); return; }
        Object.keys(p).forEach(function (k) { if (POINT_KEYS.indexOf(k) === -1) repairs.push('drop-unknown-key:points[' + i + '].' + k); });
        if (!isNum(p.x) || !isNum(p.y)) { repairs.push('drop-point-without-coordinates:' + i); return; }
        // PERCENT OF THE FRAME, NOT UNIT SPACE. Measured on the same real
        // panda picture: asked for unit coordinates the model produced two
        // overlapping blobs; asked for percentages of the image it produced
        // a seated panda — ears, cheeks, chin, a rounded body. A vision
        // model places a light as a place in the picture it is looking at;
        // the conversion to the Ether's unit space is arithmetic and is ours.
        var px = p.x, py = p.y;
        if (px < 0 || px > 100 || py < 0 || py > 100) repairs.push('clamp-point:' + i);
        p = { name: p.name, x: ((clamp(px, 0, 100) / 100) * 2 - 1) * COORD, y: ((clamp(py, 0, 100) / 100) * 2 - 1) * COORD };
        var nm = cleanName(p.name) || ('LIGHT ' + (pts.length + 1));
        if (!cleanName(p.name)) repairs.push('point-name-defaulted:' + i);
        else if (FORBIDDEN_NAME.test(String(p.name).toUpperCase())) repairs.push('point-name-stripped:' + i);
        var x = round2(clamp(p.x, -COORD, COORD)), y = round2(clamp(p.y, -COORD, COORD));
        pts.push({ name: nm, x: x, y: y, from: i });
      });
      if (pts.length < LIMITS.pointsMin) reasons.push('too-few-points:' + pts.length);
      if (pts.length > LIMITS.pointsMax) reasons.push('too-many-points:' + pts.length);
    }
    out.points = pts;
    // a dropped point renumbers the ones after it, so joins are mapped
    // through the surviving indices
    var map = {};
    pts.forEach(function (p, i) { map[p.from] = i; });
    function remap(key) {
      if (!key) return null;
      var ab = key.split('-').map(Number);
      if (map[ab[0]] === undefined || map[ab[1]] === undefined) return null;
      var a = map[ab[0]], b = map[ab[1]];
      if (a === b) return null;
      return Math.min(a, b) + '-' + Math.max(a, b);
    }
    var rawN = Array.isArray(raw.points) ? raw.points.length : 0;
    // light NAMES → raw index, so a join written as two names resolves
    var names = {};
    if (Array.isArray(raw.points)) raw.points.forEach(function (p, i) { var nm = p && cleanName(p.name); if (nm && names[nm] === undefined) names[nm] = i; });
    var forms = {};
    var joins = [], seen = {};
    if (!Array.isArray(raw.joins)) reasons.push('no-joins');
    else raw.joins.forEach(function (j, i) {
      var k = remap(joinKey(j, rawN, names, forms));
      if (!k) { repairs.push('drop-bad-join:' + i); return; }
      if (seen[k]) { repairs.push('drop-duplicate-join:' + i); return; }
      seen[k] = 1; joins.push(k);
    });
    if (Array.isArray(raw.joins) && !joins.length && pts.length) reasons.push('no-usable-joins');
    Object.keys(forms).forEach(function (f) { repairs.push('join-form:' + f + ':' + forms[f]); });
    out.joins = joins;
    var missing = [], mseen = {};
    if (raw.missing !== undefined && !Array.isArray(raw.missing)) repairs.push('drop-bad-missing');
    else (raw.missing || []).forEach(function (j, i) {
      var k = remap(joinKey(j, rawN, names, null));
      if (!k) { repairs.push('drop-bad-missing:' + i); return; }
      if (!seen[k]) { repairs.push('drop-invented-missing:' + k); return; }   // never a connection that does not exist
      if (mseen[k]) return;
      mseen[k] = 1; missing.push(k);
    });
    out.missing = missing;

    var hint = cleanHint(raw.hint, out.creature);
    if (hint === null) { repairs.push(raw.hint === undefined ? 'hint-absent' : 'hint-refused'); hint = ''; }
    out.hint = hint;

    var reveals = [];
    if (raw.reveals !== undefined && !Array.isArray(raw.reveals)) repairs.push('drop-bad-reveals');
    else (raw.reveals || []).forEach(function (r, i) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) { repairs.push('drop-bad-reveal:' + i); return; }
      Object.keys(r).forEach(function (k) { if (REVEAL_KEYS.indexOf(k) === -1) repairs.push('drop-unknown-key:reveals[' + i + '].' + k); });
      var R = global.LabReveal;
      var kinds = R ? R.TYPES : ['contour', 'fill', 'lines', 'texture', 'spike', 'glow', 'motes'];
      var kind = kinds.indexOf(r.kind) !== -1 ? r.kind : null;
      if (!kind) { repairs.push('drop-reveal-unknown-kind:' + i); return; }
      var nm = cleanName(r.name);
      if (!nm) { repairs.push('drop-reveal-unnamed:' + i); return; }
      if (FORBIDDEN_NAME.test(String(r.name).toUpperCase())) repairs.push('reveal-name-stripped:' + i);
      var role = ROLES.indexOf(String(r.role || '').toUpperCase()) !== -1 ? String(r.role).toUpperCase() : (kind === 'glow' || kind === 'motes' ? 'MAGIC' : 'IDENTITY');
      if (ROLES.indexOf(String(r.role || '').toUpperCase()) === -1) repairs.push('reveal-role-classified:' + i);
      var size = isNum(r.size) ? round2(clamp(r.size, 0.2, 4)) : 1;
      reveals.push({ name: nm, kind: kind, role: role, at: r.at == null ? null : String(r.at), toward: r.toward == null ? null : String(r.toward), why: sentence(r.why, 160), size: size });
    });
    if (reveals.length > LIMITS.revealsMax) { repairs.push('trim-reveals:' + reveals.length); reveals = reveals.slice(0, LIMITS.revealsMax); }
    out.reveals = reveals;

    var alive = { gesture: '', movement: '' };
    if (raw.alive && typeof raw.alive === 'object' && !Array.isArray(raw.alive)) {
      Object.keys(raw.alive).forEach(function (k) { if (ALIVE_KEYS.indexOf(k) === -1) repairs.push('drop-unknown-key:alive.' + k); });
      alive.gesture = sentence(raw.alive.gesture); alive.movement = sentence(raw.alive.movement);
    } else if (raw.alive !== undefined) repairs.push('drop-bad-alive');
    out.alive = alive;
    var hold = isNum(raw.holdSeconds) ? Math.round(clamp(raw.holdSeconds, LIMITS.holdS[0], LIMITS.holdS[1]) * 10) / 10 : 4;
    if (!isNum(raw.holdSeconds)) repairs.push('hold-defaulted');
    out.holdSeconds = hold;

    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    return { ok: true, reasons: [], repairs: repairs, extraction: out };
  }

  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reasons: ['empty'], repairs: [] };
    var t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var obj;
    try { obj = JSON.parse(t); } catch (e) {
      var a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a === -1 || b <= a) return { ok: false, reasons: ['not-json'], repairs: [] };
      try { obj = JSON.parse(t.slice(a, b + 1)); } catch (e2) { return { ok: false, reasons: ['not-json'], repairs: [] }; }
    }
    return validate(obj);
  }

  // ---------------------------------------------------------------
  // THE COMPILER — a clean encoding becomes an authored figure the
  // editor can hold. Every guarantee the contract asks for and a model
  // will not reliably keep is enforced HERE, mechanically, and every
  // intervention is named in `repairs`.
  // ---------------------------------------------------------------
  function dist(P, a, b) { var dx = P[a].x - P[b].x, dy = P[a].y - P[b].y; return Math.sqrt(dx * dx + dy * dy); }
  function componentsOf(n, joins) {
    var parent = [];
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    joins.forEach(function (k) { var ab = k.split('-').map(Number); var ra = find(ab[0]), rb = find(ab[1]); if (ra !== rb) parent[ra] = rb; });
    var groups = {};
    for (var j = 0; j < n; j++) { var r = find(j); (groups[r] = groups[r] || []).push(j); }
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }
  function degrees(n, joins) {
    var d = [];
    for (var i = 0; i < n; i++) d[i] = 0;
    joins.forEach(function (k) { var ab = k.split('-').map(Number); d[ab[0]]++; d[ab[1]]++; });
    return d;
  }
  // Gaps must leave every light joined to SOMETHING: a detached part
  // reads (two lights still joined to each other); a detached point reads
  // as a stray star, and the sky is already full of those. Both recorded
  // findings of the creature experiments, enforced together.
  function strands(n, joins, gaps) {
    var kept = joins.filter(function (k) { return gaps.indexOf(k) === -1; });
    return degrees(n, kept).some(function (d) { return d === 0; });
  }
  function targetMissing(n, joinCount) {
    var t = n <= 10 ? 2 : (n <= 20 ? 3 : 4);
    return Math.max(LIMITS.missingMin, Math.min(LIMITS.missingMax, t, Math.floor(joinCount / 4) || 1));
  }
  // Resolve a reveal's `at` / `toward` to a light: an exact name, then
  // a name containing it, then a numeric index the model wrote instead
  // of a name (measured on a real reply), else null.
  function resolveLight(ref, pts) {
    if (ref == null) return null;
    var s = String(ref).trim();
    if (/^\d{1,2}$/.test(s)) { var i = Number(s); return i < pts.length ? i : null; }
    var nm = cleanName(s);
    if (!nm) return null;
    for (var a = 0; a < pts.length; a++) if (pts[a].name === nm) return a;
    for (var b = 0; b < pts.length; b++) if (pts[b].name.indexOf(nm) !== -1 || nm.indexOf(pts[b].name) !== -1) return b;
    return null;
  }

  function compile(ext, budgets) {
    budgets = Array.isArray(budgets) && budgets.length ? budgets.slice().sort(function (a, b) { return a - b; }) : DEFAULT_BUDGETS;
    var repairs = [], reasons = [];
    if (!ext || !Array.isArray(ext.points)) return { ok: false, reasons: ['no-extraction'], repairs: [] };
    var pts = ext.points.map(function (p) { return { name: p.name, x: p.x, y: p.y }; });
    var n = pts.length;
    if (n < LIMITS.pointsMin || n > LIMITS.pointsMax) return { ok: false, reasons: ['points-out-of-range:' + n], repairs: [] };
    // FIT TO THE FRAME. A creature centred in its picture occupies the
    // middle of it, so read off as percentages it arrives small; the
    // figure is scaled about its centre, aspect kept, until its widest
    // extent reaches most of the sky. The SHAPE is the model's; the size
    // is the Lab's, and the repair says so.
    (function fit() {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      pts.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      var ext2 = Math.max(maxX - minX, maxY - minY);
      if (!(ext2 > 0.01)) return;
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, k = (FIT_EXTENT * 2) / ext2;
      if (Math.abs(k - 1) < 0.02) return;
      pts.forEach(function (p) { p.x = round2(cx * 0 + (p.x - cx) * k); p.y = round2((p.y - cy) * k); });
      repairs.push('fitted:' + Math.round(k * 100) / 100);
    })();
    var joins = (ext.joins || []).slice();

    // ONE connected figure: join components at their closest lights.
    var comps = componentsOf(n, joins);
    var joinedComponents = 0;
    while (comps.length > 1) {
      var best = null;
      for (var ci = 1; ci < comps.length; ci++) {
        comps[0].forEach(function (a) { comps[ci].forEach(function (b) {
          var d = dist(pts, a, b);
          if (!best || d < best.d) best = { a: a, b: b, d: d };
        }); });
      }
      joins.push(Math.min(best.a, best.b) + '-' + Math.max(best.a, best.b));
      joinedComponents++;
      comps = componentsOf(n, joins);
    }
    if (joinedComponents) repairs.push('joined-components:' + joinedComponents);

    // Missing connections: the model's, filtered; then the compiler's own
    // choice where the model gave too few. Never invented — every gap is
    // a join of the complete figure — and never a stranded light.
    var gaps = [];
    var source = 'model';
    (ext.missing || []).forEach(function (k) {
      if (joins.indexOf(k) === -1) { repairs.push('drop-invented-missing:' + k); return; }
      if (gaps.length >= LIMITS.missingMax) { repairs.push('drop-extra-missing:' + k); return; }
      if (strands(n, joins, gaps.concat([k]))) { repairs.push('drop-stranding-missing:' + k); return; }
      gaps.push(k);
    });
    var target = targetMissing(n, joins.length);
    if (gaps.length < target) {
      // widest first — a wide gap reads as a gap; two lights a finger's
      // width apart already look like a pair
      var ranked = joins.filter(function (k) { return gaps.indexOf(k) === -1; })
        .map(function (k) { var ab = k.split('-').map(Number); return { k: k, d: dist(pts, ab[0], ab[1]) }; })
        .sort(function (a, b) { return b.d - a.d; });
      var used = {};
      gaps.forEach(function (k) { k.split('-').forEach(function (i) { used[i] = 1; }); });
      var before = gaps.length;
      for (var r = 0; r < ranked.length && gaps.length < target; r++) {
        var ab = ranked[r].k.split('-');
        if (used[ab[0]] || used[ab[1]]) continue;                     // spread the gaps around the figure
        if (strands(n, joins, gaps.concat([ranked[r].k]))) continue;
        gaps.push(ranked[r].k); used[ab[0]] = 1; used[ab[1]] = 1;
      }
      if (gaps.length > before) { repairs.push('chose-missing:' + (gaps.length - before)); source = before ? 'mixed' : 'auto'; }
    }
    if (!gaps.length) reasons.push('no-usable-missing');

    // Reveal features, anchored to real lights.
    var R = global.LabReveal;
    var features = [], roles = [], dropped = 0, seq = 0;
    (ext.reveals || []).forEach(function (rv, i) {
      var a = resolveLight(rv.at, pts);
      if (a === null) {
        // the model named a part the figure does not have: the feature
        // goes on the light nearest the figure's centre of mass rather
        // than nowhere, and the repair says so
        var cx = 0, cy = 0; pts.forEach(function (p) { cx += p.x / n; cy += p.y / n; });
        var bi = 0, bd = Infinity;
        pts.forEach(function (p, k) { var d = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy); if (d < bd) { bd = d; bi = k; } });
        a = bi; repairs.push('reveal-anchored-at-centre:' + i);
      }
      var b = resolveLight(rv.toward, pts);
      if (b === a) b = null;
      var f = R ? R.make(rv.kind, a, b, rv.name, ++seq) : { id: 'rf-' + (++seq), name: rv.name, type: rv.kind, lights: { a: a, b: b }, offset: [0, 0], size: 1, angle: 0, params: {} };
      f.size = rv.size;
      features.push(f);
      roles.push({ id: f.id, name: f.name, role: rv.role, why: rv.why });
    });
    if (R) {
      var sane = R.sanitize({ durationS: ext.holdSeconds, features: features }, n);
      if (!sane.ok) {
        // sanitize refuses the whole block; drop the offenders by index
        // and try once more, naming each
        var bad = {};
        sane.reasons.forEach(function (x) { var m = /:(\d+)$/.exec(x); if (m) bad[Number(m[1])] = 1; });
        var kept = [], keptRoles = [];
        features.forEach(function (f, i) { if (bad[i]) { dropped++; repairs.push('drop-reveal-refused:' + i); } else { kept.push(f); keptRoles.push(roles[i]); } });
        features = kept; roles = keptRoles;
        sane = R.sanitize({ durationS: ext.holdSeconds, features: features }, n);
        if (!sane.ok) { features = []; roles = []; repairs.push('drop-all-reveals:' + sane.reasons.join(',')); }
      }
      if (sane.ok) features = sane.features;
    }
    if (!features.length) repairs.push('no-reveal-features');

    var hint = ext.hint || FALLBACK_HINT;
    if (!ext.hint) repairs.push('hint-fallback');
    var budget = null;
    for (var bi2 = 0; bi2 < budgets.length; bi2++) if (budgets[bi2] >= n) { budget = budgets[bi2]; break; }
    if (budget === null) return { ok: false, reasons: ['no-budget-holds:' + n], repairs: repairs };
    if (reasons.length) return { ok: false, reasons: reasons, repairs: repairs };
    return {
      ok: true, reasons: [], repairs: repairs,
      authored: {
        creature: ext.creature, seen: ext.seen, confidence: ext.confidence,
        budget: budget,
        points: pts.map(function (p) { return [p.x, p.y]; }),
        roles: pts.map(function (p) { return p.name; }),
        joins: joins,
        missing: gaps.map(function (k) { return joins.indexOf(k); }),
        missingSource: source,
        hint: hint,
        reveal: { durationS: ext.holdSeconds, features: features },
        revealRoles: roles,
        alive: ext.alive || { gesture: '', movement: '' },
        playableInEther: n <= 8
      }
    };
  }

  // ---------------------------------------------------------------
  // FIXTURES — for a session with no model. Deliberately generic and
  // deliberately labelled: an SVG that says FIXTURE, and an encoding of
  // a generic body plan that says it is not an interpretation of the
  // image. Seeded from the prompt and the attempt, so "try another"
  // gives another.
  // ---------------------------------------------------------------
  function fixtureImages(prompt, n, attempt) {
    var out = [];
    var p = cleanPrompt(prompt) || 'creature';
    for (var i = 0; i < (n || LIMITS.images); i++) {
      var r = rng(hash(p + '|' + (attempt || 0) + '|' + i));
      var stars = '';
      for (var s = 0; s < 40; s++) stars += '<circle cx="' + Math.round(r() * 512) + '" cy="' + Math.round(r() * 512) + '" r="' + (0.6 + r() * 1.4).toFixed(1) + '" fill="#f1ead0" opacity="' + (0.3 + r() * 0.7).toFixed(2) + '"/>';
      var rx = 90 + Math.round(r() * 60), ry = 110 + Math.round(r() * 60), hx = 256 + Math.round((r() - 0.5) * 60), hy = 150 + Math.round(r() * 40);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
        '<rect width="512" height="512" fill="#0d1120"/>' + stars +
        '<ellipse cx="256" cy="300" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="#e8d9a8" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/>' +
        '<circle cx="' + hx + '" cy="' + hy + '" r="' + (50 + Math.round(r() * 20)) + '" fill="none" stroke="#e8d9a8" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/>' +
        '<text x="256" y="470" fill="#9a96a8" font-family="sans-serif" font-size="22" text-anchor="middle">FIXTURE IMAGE ' + String.fromCharCode(65 + i) + ' — no model</text>' +
        '<text x="256" y="496" fill="#6a667a" font-family="sans-serif" font-size="14" text-anchor="middle">a stand-in, not a picture of anything</text></svg>';
      out.push('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    }
    return out;
  }

  function fixtureExtraction(prompt, attempt) {
    var r = rng(hash((cleanPrompt(prompt) || 'creature') + '|x|' + (attempt || 0)));
    function j(v) { return Math.round(50 + v * 36 + (r() - 0.5) * 5); }   // percent of the frame, as the contract asks
    // a generic quadruped body plan — twelve lights, one body, a head,
    // two ears, four legs, a tail. The same for every prompt on purpose.
    var P = [
      ['HEAD', j(-0.85), j(-0.55)], ['LEFT EAR', j(-1.05), j(-0.9)], ['RIGHT EAR', j(-0.6), j(-0.95)],
      ['NECK', j(-0.45), j(-0.35)], ['BACK', j(0.2), j(-0.45)], ['RUMP', j(0.85), j(-0.3)],
      ['TAIL TIP', j(1.2), j(-0.75)], ['CHEST', j(-0.4), j(0.15)], ['BELLY', j(0.3), j(0.2)],
      ['FRONT FOOT', j(-0.45), j(0.85)], ['BACK FOOT', j(0.75), j(0.85)], ['HIP', j(0.8), j(0.2)]
    ];
    var joins = ['0-1', '0-2', '0-3', '3-4', '4-5', '5-6', '3-7', '7-8', '8-11', '11-5', '7-9', '11-10'];
    var pool = ['3-4', '4-5', '7-8', '8-11'];
    var pick = Math.floor(r() * pool.length);
    return {
      creature: 'FIXTURE CREATURE',
      seen: 'A fixture: a generic body plan standing in for the image, not an interpretation of it.',
      confidence: 0.5,
      points: P.map(function (p) { return { name: p[0], x: p[1], y: p[2] }; }),
      joins: joins,
      missing: [pool[pick], pool[(pick + 2) % pool.length]],
      hint: FALLBACK_HINT,
      reveals: [
        { name: 'EYES', kind: 'glow', role: 'LIFE', at: 'HEAD', toward: null, why: 'A fixture eye, so the reveal path runs.' },
        { name: 'COAT', kind: 'contour', role: 'IDENTITY', at: 'BACK', toward: 'RUMP', why: 'A fixture coat along the back.' },
        { name: 'SPARK', kind: 'motes', role: 'MAGIC', at: 'TAIL TIP', toward: null, why: 'A fixture spark at the tail.' }
      ],
      alive: { gesture: 'A generic standing pose.', movement: 'It would walk, in a generic way.' },
      holdSeconds: 3 + Math.round(r() * 20) / 10
    };
  }

  // ---------------------------------------------------------------
  // THE SESSION
  // ---------------------------------------------------------------
  var epoch = 0;
  var session = null;
  var listeners = [];
  var stage = { state: 'complete', alive: null, raf: 0, canvas: null };
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  function fresh(prompt) {
    epoch++;
    return {
      id: 'cs-' + epoch, epoch: epoch, gen: 0,
      prompt: prompt, imagePrompt: imagePrompt(prompt),
      images: [], chosen: null, source: null,
      raw: null, extraction: null, authored: null,
      status: 'empty', note: '', busy: null,
      last: { images: null, extraction: null },
      log: []
    };
  }
  function log(s, step, note) { if (!s) return; s.log.push({ at: new Date().toISOString(), step: step, note: note || '' }); if (s.log.length > 80) s.log.shift(); }
  function live(s, gen) { return !!(session && s === session && session.epoch === epoch && (gen === undefined || gen === session.gen)); }

  // NEW SESSION: nothing survives. In-flight requests are cancelled,
  // the editor is emptied, the reference goes, the stage stops.
  function newSession(prompt) {
    var p = cleanPrompt(prompt);
    if (!p) return { ok: false, reason: 'bad-prompt' };
    var Conn = global.LabConnection, S = global.ShapeLab, Ref = global.LabReference;
    if (Conn && Conn.cancelAll) Conn.cancelAll(); else if (Conn && Conn.cancel) Conn.cancel();
    stopAlive();
    if (Ref && Ref.discard) { try { Ref.discard(); } catch (e) { /* held */ } }
    if (S && S.reset) S.reset();
    session = fresh(p);
    log(session, 'new-session', 'epoch ' + session.epoch);
    emit();
    return { ok: true, epoch: session.epoch };
  }

  function sourceLabel(mode, model) {
    if (mode === 'fixture') return 'FIXTURE';
    return 'LLM — ' + (mode === 'direct' ? 'Direct (dev)' : 'Endpoint') + (model ? ' · ' + model : '');
  }

  // IMAGINE — three candidates for the prompt. Each is its own bounded
  // request; a partial set (two of three) is still offered, a failed set
  // is a sentence and never a fixture.
  function imagine(s) {
    var Conn = global.LabConnection;
    if (!Conn || !Conn.images) { s.status = 'failed'; s.note = 'The connection module is not loaded.'; emit(); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
    var gen = ++s.gen;
    var mode = Conn.status().mode;
    if (mode !== 'fixture' && /not configured/.test(Conn.status().line)) {
      s.status = s.images.length ? 'choose' : 'empty';
      s.note = sourceLabel(mode) + ' is selected but not configured — set it up under Advanced, or choose Fixture. Nothing was generated and no fixture was substituted.';
      s.last.images = { mode: mode, outcome: 'not-configured' };
      emit();
      return Promise.resolve({ ok: false, reason: 'not-configured' });
    }
    s.status = 'imagining'; s.busy = 'images'; s.note = 'Imagining "' + s.prompt + '" — ' + sourceLabel(mode) + '…';
    s.images = []; s.chosen = null; s.authored = null; s.extraction = null; s.raw = null;
    var S = global.ShapeLab; if (S && S.reset) S.reset();
    stopAlive();
    var t0 = Date.now();
    log(s, 'imagine', 'gen ' + gen + ' · ' + sourceLabel(mode));
    emit();
    return Conn.images({
      prompt: s.imagePrompt, n: LIMITS.images,
      fixture: function () { return fixtureImages(s.prompt, LIMITS.images, gen); }
    }).then(function (r) {
      if (!live(s, gen)) { log(s, 'stale-dropped', 'images for gen ' + gen + ' arrived after gen ' + (session ? session.gen : '-')); return { ok: false, reason: 'stale' }; }
      s.busy = null;
      var ms = Date.now() - t0;
      if (!r || !r.ok || !r.images || !r.images.length) {
        var reason = (r && r.reason) || 'unavailable';
        s.status = 'failed'; s.note = 'No image could be made — ' + reason + ' (' + sourceLabel(mode) + '). No fixture was substituted. Try again, or choose Fixture under Advanced.';
        s.last.images = { mode: mode, outcome: 'failed', reason: reason, ms: ms };
        log(s, 'images-failed', reason);
        emit();
        return { ok: false, reason: reason };
      }
      // THE ID CARRIES THE SESSION. Measured on the real run: the panda's
      // and the dragon's chosen pictures were both `im-1-0`, so the source
      // pane's "is this the image I am showing?" check said yes and the
      // dragon was built — correctly, from its own picture — under the
      // panda's portrait. A leak of exactly the kind a new session forbids.
      s.images = r.images.map(function (im, i) { return { id: 'im-' + s.epoch + '-' + gen + '-' + i, dataUrl: im.dataUrl, source: im.source, model: im.model || null }; });
      s.source = r.images[0].source;
      s.status = 'choose';
      s.note = s.images.length + ' image' + (s.images.length === 1 ? '' : 's') + ' from ' + sourceLabel(mode, r.images[0].model) + (r.failed ? ' (' + r.failed + ' did not arrive)' : '') + ' — choose the one you like.';
      s.last.images = { mode: mode, outcome: r.images[0].source, model: r.images[0].model || null, count: s.images.length, failed: r.failed || 0, ms: ms, prompt: s.imagePrompt };
      log(s, 'images', s.images.length + ' in ' + ms + 'ms');
      emit();
      return { ok: true, count: s.images.length };
    });
  }

  // BUILD — the chosen image is read by the text model, the encoding is
  // validated and compiled, and the result is loaded into the editor's
  // own state. `opts.refine` and `opts.another` are the two re-runs.
  function build(s, opts) {
    opts = opts || {};
    var Conn = global.LabConnection, S = global.ShapeLab;
    var im = s.images[s.chosen];
    if (!im) return Promise.resolve({ ok: false, reason: 'no-image' });
    var gen = ++s.gen;
    var mode = Conn.status().mode;
    var m = extractionMessages(s.prompt, im.dataUrl, { refine: opts.refine, another: opts.another, previous: s.extraction });
    if (!m.ok) {
      if (mode === 'fixture' && m.reason === 'bad-image') {
        // a fixture image is an SVG data URL, which is not a photo the
        // contract can carry; the fixture extractor answers instead
        m = { ok: true, messages: [], fixtureOnly: true };
      } else {
        s.note = m.reason === 'bad-refine' ? 'The refinement could not be sent — plain words and punctuation only, up to ' + LIMITS.refineChars + ' characters.' : 'That image cannot be sent (' + m.reason + ').';
        emit();
        return Promise.resolve({ ok: false, reason: m.reason });
      }
    }
    if (mode !== 'fixture' && m.fixtureOnly) { s.note = 'A fixture image cannot be read by a model — choose Fixture, or make real images first.'; emit(); return Promise.resolve({ ok: false, reason: 'fixture-image' }); }
    s.status = 'building'; s.busy = 'extraction';
    s.note = 'BUILDING CREATURE… reading the chosen image — ' + sourceLabel(mode, mode === 'fixture' ? null : TEXT_MODEL) + (opts.refine ? ' · refining: "' + m.refine + '"' : (opts.another ? ' · another interpretation' : '')) + '.';
    stopAlive();
    var t0 = Date.now();
    var attempt = gen;
    log(s, opts.refine ? 'refine' : (opts.another ? 'another-interpretation' : 'build'), 'gen ' + gen + ' · image ' + im.id);
    emit();
    return Conn.generate({
      messages: m.messages,
      params: { model: TEXT_MODEL, temperature: opts.another ? 1.0 : 0.6 },
      fixture: function () { return JSON.stringify(fixtureExtraction(s.prompt, attempt)); }
    }).then(function (r) {
      if (!live(s, gen)) { log(s, 'stale-dropped', 'encoding for gen ' + gen + ' arrived late'); return { ok: false, reason: 'stale' }; }
      s.busy = null;
      var ms = Date.now() - t0;
      var rec = { mode: mode, model: (r && r.model) || (mode === 'fixture' ? null : TEXT_MODEL), ms: ms, refine: m.refine || '', another: !!opts.another, outcome: 'pending', parse: null, compile: null };
      s.last.extraction = rec;
      // A FAILED READ NEVER TAKES THE CREATURE YOU HAD. An earlier build
      // stays on screen and in the editor; the note says so.
      var kept = s.authored ? ' The creature you had is still here.' : '';
      if (!r || !r.ok) {
        var reason = (r && r.reason) || 'unavailable';
        rec.outcome = 'failed'; rec.reason = reason;
        s.status = 'failed'; s.note = 'The creature could not be built — ' + reason + ' (' + sourceLabel(mode) + '). No fixture was substituted. Try another Ether interpretation, or another image.' + kept;
        log(s, 'build-failed', reason); emit();
        return { ok: false, reason: reason };
      }
      s.raw = String(r.text || '');
      rec.rawChars = s.raw.length; rec.source = r.source;
      var v = parse(s.raw);
      rec.parse = { ok: v.ok, reasons: v.reasons, repairs: v.repairs };
      if (!v.ok) {
        rec.outcome = 'rejected';
        s.status = 'failed'; s.note = 'The model\'s encoding could not be used — ' + v.reasons.slice(0, 3).join(', ') + '. Nothing was loaded. Try another Ether interpretation.' + kept;
        log(s, 'encoding-rejected', v.reasons.join(',')); emit();
        return { ok: false, reason: 'invalid-encoding', reasons: v.reasons };
      }
      var c = compile(v.extraction, S ? S.BUDGETS : null);
      rec.compile = { ok: c.ok, reasons: c.reasons, repairs: c.repairs };
      if (!c.ok) {
        rec.outcome = 'uncompilable';
        s.status = 'failed'; s.note = 'The encoding could not become a figure — ' + c.reasons.join(', ') + '. Nothing was loaded. Try another Ether interpretation.' + kept;
        log(s, 'compile-failed', c.reasons.join(',')); emit();
        return { ok: false, reason: 'uncompilable', reasons: c.reasons };
      }
      s.extraction = v.extraction;
      s.authored = c.authored;
      rec.outcome = r.source === 'fixture' ? 'fixture' : 'generated';
      rec.confidence = c.authored.confidence;
      if (S && S.loadFigure) {
        var lr = S.loadFigure({
          budget: c.authored.budget, points: c.authored.points, joins: c.authored.joins, missing: c.authored.missing,
          roles: c.authored.roles, reveal: c.authored.reveal, hint: c.authored.hint, name: c.authored.creature,
          authoring: { subject: c.authored.creature, referenceUsed: true, source: r.source }
        });
        rec.loaded = !!(lr && lr.ok);
        if (!lr || !lr.ok) { s.status = 'failed'; s.note = 'The editor refused the figure (' + (lr && lr.reason) + ').'; log(s, 'load-refused', lr && lr.reason); emit(); return { ok: false, reason: 'load-refused' }; }
      }
      s.status = 'ready';
      s.note = (r.source === 'fixture' ? 'FIXTURE creature built — a generic body plan standing in, not an interpretation of the image.' : 'Creature built from the chosen image (' + sourceLabel(mode, rec.model) + ').') + ' Review it: UNFINISHED · COMPLETE · COME ALIVE.';
      stage.state = 'complete';
      log(s, 'ready', c.authored.points.length + ' points · ' + c.authored.missing.length + ' missing · ' + c.authored.reveal.features.length + ' reveals');
      emit();
      return { ok: true, authored: c.authored };
    });
  }

  function create(prompt) {
    var r = newSession(prompt);
    if (!r.ok) return Promise.resolve(r);
    return imagine(session);
  }
  function choose(i) {
    var s = session;
    if (!s || s.status === 'imagining') return Promise.resolve({ ok: false, reason: 'no-session' });
    if (!s.images[i]) return Promise.resolve({ ok: false, reason: 'no-such-image' });
    s.chosen = i;
    return build(s, {});
  }
  function refine(text) {
    var s = session;
    if (!s || s.chosen === null || s.busy) return Promise.resolve({ ok: false, reason: 'nothing-to-refine' });
    var t = cleanRefine(text);
    if (!t) { s.note = t === null ? 'The refinement could not be sent — plain words and punctuation only, up to ' + LIMITS.refineChars + ' characters.' : 'Say what should change — "make it larger", "keep the wings more recognisable", "use fewer points".'; emit(); return Promise.resolve({ ok: false, reason: 'bad-refine' }); }
    return build(s, { refine: t });
  }
  function anotherImage() {
    var s = session;
    if (!s || s.busy) return Promise.resolve({ ok: false, reason: 'no-session' });
    return imagine(s);
  }
  function anotherInterpretation() {
    var s = session;
    if (!s || s.chosen === null || s.busy) return Promise.resolve({ ok: false, reason: 'nothing-chosen' });
    return build(s, { another: true });
  }
  function cancel() {
    var s = session;
    var Conn = global.LabConnection;
    if (Conn && Conn.cancelAll) Conn.cancelAll(); else if (Conn && Conn.cancel) Conn.cancel();
    if (!s) return { ok: false };
    s.gen++;                                 // whatever arrives now is stale
    s.busy = null;
    s.status = s.authored ? 'ready' : (s.images.length ? 'choose' : 'empty');
    s.note = 'Cancelled. ' + (s.authored ? 'The creature you had is still here.' : (s.images.length ? 'The images you had are still here.' : 'Nothing was made.'));
    log(s, 'cancel', '');
    emit();
    return { ok: true };
  }
  function approve() {
    var S = global.ShapeLab, s = session;
    if (!S || !s || !s.authored) return { ok: false, reason: 'nothing-to-approve' };
    var a = S.approve();
    if (!a.ok) return a;
    var sv = S.save();
    log(s, 'approved', sv && sv.id ? sv.id : '');
    s.note = 'Approved and kept as a fixture' + (sv && sv.id ? ' (' + sv.id + ')' : '') + '. Nothing was activated in production.';
    emit();
    return { ok: true, id: sv && sv.id, approved: a.approved };
  }

  // The snapshot a suite or a panel reads: never the image bytes.
  function snapshot() {
    if (!session) return null;
    var s = session;
    return {
      id: s.id, epoch: s.epoch, gen: s.gen, prompt: s.prompt, imagePrompt: s.imagePrompt,
      status: s.status, busy: s.busy, note: s.note, source: s.source,
      images: s.images.map(function (im) { return { id: im.id, source: im.source, model: im.model, bytes: im.dataUrl.length }; }),
      chosen: s.chosen,
      creature: s.authored ? s.authored.creature : null,
      points: s.authored ? s.authored.points.length : 0,
      missing: s.authored ? s.authored.missing.length : 0,
      reveals: s.authored ? s.authored.reveal.features.length : 0,
      confidence: s.authored ? s.authored.confidence : null,
      last: JSON.parse(JSON.stringify(s.last)),
      log: s.log.slice()
    };
  }

  // ---------------------------------------------------------------
  // THE STAGE — UNFINISHED · COMPLETE · COME ALIVE, drawn from the
  // editor's own state (so an Advanced correction shows at once).
  // ---------------------------------------------------------------
  function likeOf() {
    var S = global.ShapeLab;
    if (!S) return null;
    var st = S.state();
    return {
      budget: st.budget,
      points: st.points.map(function (p) { return [p[0], p[1]]; }),
      joins: st.joins.map(function (j, i) { var ab = String(j).split('-').map(Number); return { a: ab[0], b: ab[1], gap: (st.missing || []).indexOf(i) !== -1 }; }),
      reveal: st.reveal || { durationS: 4, features: [] }
    };
  }
  function drawStatic(canvas, unfinished) {
    var S = global.ShapeLab, like = likeOf();
    if (!S || !like || !canvas) return 0;
    S.draw(canvas, like, { unfinished: !!unfinished });
    return like.points.length;
  }

  function stopAlive() {
    if (stage.raf && global.cancelAnimationFrame) global.cancelAnimationFrame(stage.raf);
    stage.raf = 0; stage.alive = null;
  }
  function easeOut(u) { u = clamp(u, 0, 1); return 1 - (1 - u) * (1 - u) * (1 - u); }
  function easeInOut(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  function aliveFrame(now) {
    stage.raf = 0;
    var A = stage.alive, c = stage.canvas, S = global.ShapeLab, R = global.LabReveal;
    if (!A || !c || !S) return;
    var ms = now - A.t0;
    var like = A.like;
    var n = like.points.length;
    var phase = ms < ALIVE.settleMs ? 'settle' : ms < ALIVE.revealAt ? 'blaze' : ms < ALIVE.gatherAt ? 'reveal' : ms < ALIVE.roamAt ? 'gather' : (ms < ALIVE.roamAt + ALIVE.firstLegMs ? 'alive' : 'roam');
    // scale: gather, then breathe
    var g = ms < ALIVE.gatherAt ? 1 : 1 - (1 - ALIVE.gatherScale) * easeInOut((ms - ALIVE.gatherAt) / ALIVE.gatherMs);
    var breathe = ms > ALIVE.gatherAt ? 1 + 0.02 * Math.sin((ms - ALIVE.gatherAt) / 1000 * Math.PI * 2 / 2.6) * easeInOut((ms - ALIVE.gatherAt) / ALIVE.gatherMs) : 1;
    var scale = g * breathe;
    // roaming: one heading first, then wandering, steered back from the edge
    if (ms >= ALIVE.roamAt) {
      var dt = Math.min(0.05, (now - A.lastNow) / 1000);
      var since = ms - ALIVE.roamAt;
      var wander = since > ALIVE.firstLegMs ? 0.9 * Math.sin(since / 1000 * 0.7 + A.seed) + 0.5 * Math.sin(since / 1000 * 1.9 + A.seed * 2) : 0.15 * Math.sin(since / 1000 * 1.3);
      A.heading += wander * dt;
      var rr = Math.sqrt(A.pos[0] * A.pos[0] + A.pos[1] * A.pos[1]);
      if (rr > 0.5) { var back = Math.atan2(-A.pos[1], -A.pos[0]); var diff = Math.atan2(Math.sin(back - A.heading), Math.cos(back - A.heading)); A.heading += diff * dt * 1.8; }
      var pause = since > ALIVE.firstLegMs ? 0.55 + 0.45 * Math.sin(since / 1000 * 0.45 + A.seed) : 1.2;
      var v = ALIVE.speed * Math.max(0, pause);
      A.pos[0] += Math.cos(A.heading) * v * dt; A.pos[1] += Math.sin(A.heading) * v * dt;
      A.travelled += v * dt;
    }
    A.lastNow = now;
    var und = ms > ALIVE.gatherAt ? easeInOut((ms - ALIVE.gatherAt) / ALIVE.gatherMs) : 0;
    var pts = like.points.map(function (p, i) {
      var x = A.cx + (p[0] - A.cx) * scale + A.pos[0];
      var y = A.cy + (p[1] - A.cy) * scale + A.pos[1] + und * 0.025 * Math.sin(ms / 1000 * 3 + i * 0.6);
      return [x, y];
    });
    S.draw(c, { budget: like.budget, points: pts, joins: like.joins }, { unfinished: false });
    var w = c.clientWidth || c.width, h = c.clientHeight || c.height;
    var ctx = c.getContext('2d');
    var P = pts.map(function (p) { return S.project(p, w, h); });
    // the blaze: every light flares, and the light goes out as it settles
    if (ms >= ALIVE.settleMs && ms < ALIVE.settleMs + ALIVE.blazeMs + 600) {
      var u = (ms - ALIVE.settleMs) / (ALIVE.blazeMs + 600);
      var bell = Math.sin(Math.PI * clamp(u, 0, 1));
      var r = Math.max(14, Math.min(w, h) / 12);
      P.forEach(function (p) {
        var rg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        rg.addColorStop(0, 'rgba(232,196,134,' + (0.55 * bell).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(232,196,134,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
      });
    }
    var painted = 0;
    var feats = like.reveal.features;
    if (R && feats.length && ms >= ALIVE.revealAt - R.TIMING.afterMs) {
      var rms = ms - ALIVE.revealAt + R.TIMING.afterMs;
      var hold = like.reveal.durationS;
      painted = R.draw(ctx, feats, P, ms / 1000, function (i) {
        var e = R.envelope(rms, i, feats.length, hold);
        // the features do not fade away: they settle and travel with the creature
        if (e.phase === 'out' || e.phase === 'done') return { phase: 'kept', alpha: Math.max(e.alpha, ALIVE.keepAlpha), growth: 1 };
        return e;
      });
    }
    A.frame++; A.ms = ms; A.phase = phase; A.scale = scale; A.painted = painted;
    stage.raf = global.requestAnimationFrame(aliveFrame);
  }

  function showState(name) {
    var S = global.ShapeLab;
    var c = stage.canvas || (doc && doc.querySelector('[data-cr-stage]'));
    stage.canvas = c;
    if (!S || !c) return { ok: false, reason: 'no-stage' };
    if (name !== 'unfinished' && name !== 'complete' && name !== 'alive') return { ok: false, reason: 'unknown-state' };
    stopAlive();
    stage.state = name;
    if (name === 'alive') {
      var like = likeOf();
      if (!like || !like.points.length) return { ok: false, reason: 'no-figure' };
      var cx = 0, cy = 0; like.points.forEach(function (p) { cx += p[0] / like.points.length; cy += p[1] / like.points.length; });
      var seed = (hash(JSON.stringify(like.points)) % 1000) / 1000 * Math.PI * 2;
      var now = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
      // it sets off AWAY from the nearer edge, so the first leg is a real departure
      var heading = Math.atan2(-cy, -cx) + (seed - Math.PI) * 0.35;
      stage.alive = { t0: now, lastNow: now, like: like, cx: cx, cy: cy, pos: [0, 0], heading: heading, seed: seed, travelled: 0, frame: 0, ms: 0, phase: 'settle', scale: 1, painted: 0 };
      if (global.requestAnimationFrame) stage.raf = global.requestAnimationFrame(aliveFrame); else aliveFrame(now);
    } else {
      drawStatic(c, name === 'unfinished');
    }
    if (S.markTested) S.markTested();
    paintStates();
    return { ok: true, state: name };
  }
  function stageStatus() {
    var A = stage.alive;
    return { state: stage.state, playing: !!A, ms: A ? Math.round(A.ms) : 0, phase: A ? A.phase : null, frame: A ? A.frame : 0,
             scale: A ? round2(A.scale) : 1, pos: A ? [round2(A.pos[0]), round2(A.pos[1])] : [0, 0], travelled: A ? round2(A.travelled) : 0, painted: A ? A.painted : 0 };
  }

  // ---------------------------------------------------------------
  // THE PAGE
  // ---------------------------------------------------------------
  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function paintStates() {
    if (!doc) return;
    doc.querySelectorAll('[data-cr-state]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cr-state') === stage.state); });
    var line = el('[data-cr-stateline]');
    if (line) line.textContent = stage.state === 'alive' ? 'COME ALIVE — the last join lands, the world answers, the features emerge, and it sets off.' : stage.state === 'unfinished' ? 'UNFINISHED — what the child meets: the missing connections are simply not there.' : 'COMPLETE — the figure whole, as it stands once the child has joined the last light.';
  }

  function render() {
    if (!doc) return;
    var s = session, S = global.ShapeLab;
    var st = S ? S.state() : null;
    var status = s ? s.status : 'empty';
    doc.body.setAttribute('data-cr-phase', status);
    var note = el('[data-cr-status]'); if (note) note.textContent = s ? s.note : 'Say what should exist, and press CREATE.';
    var sec = function (name, show) { var e = el('[data-cr-section="' + name + '"]'); if (e) e.hidden = !show; };
    var hasImages = !!(s && s.images.length);
    sec('choose', hasImages);
    sec('building', status === 'building');
    var ready = !!(s && s.authored && st && st.points.length);
    sec('result', ready);
    sec('experience', ready);
    var busy = !!(s && s.busy);
    var cr = el('[data-cr-create]'); if (cr) cr.disabled = busy;
    var cn = el('[data-cr-cancel]'); if (cn) cn.hidden = !busy;
    // images
    var tiles = el('[data-cr-images]');
    if (tiles && s) {
      var key = s.images.map(function (im) { return im.id; }).join(',') + '|' + s.chosen + '|' + status;
      if (tiles.getAttribute('data-key') !== key) {
        tiles.setAttribute('data-key', key);
        tiles.innerHTML = s.images.map(function (im, i) {
          return '<figure class="cr-tile' + (s.chosen === i ? ' chosen' : '') + '" data-cr-image="' + i + '">' +
            '<img src="' + im.dataUrl + '" alt="candidate image ' + String.fromCharCode(65 + i) + '">' +
            '<figcaption><span>' + String.fromCharCode(65 + i) + (im.source === 'fixture' ? ' · FIXTURE' : '') + '</span>' +
            '<button data-cr-use="' + i + '" class="primary">' + (s.chosen === i ? (status === 'failed' ? 'Try again' : 'Chosen ✓') : 'Use this') + '</button></figcaption></figure>';
        }).join('');
      }
      tiles.querySelectorAll('[data-cr-use]').forEach(function (b) { b.disabled = busy; });
    }
    doc.querySelectorAll('[data-cr-another-image]').forEach(function (ai) { ai.disabled = busy || !s; });
    // a build that failed leaves the researcher in the CHOOSE step with a
    // way to read the same picture again, beside a way to make new ones
    var rt = el('[data-cr-retry]'); if (rt) { rt.hidden = !(s && status === 'failed' && s.chosen !== null); rt.disabled = busy; }
    doc.querySelectorAll('[data-cr-another-interp]').forEach(function (an) { an.disabled = busy || !s || s.chosen === null; });
    var rf = el('[data-cr-refine]'); if (rf) { rf.disabled = busy || !s || s.chosen === null; }
    var ap = el('[data-cr-approve]'); if (ap) { ap.disabled = busy || !ready; ap.textContent = st && st.approved ? 'Approved ✓' : 'Approve'; }
    // the result
    if (ready) {
      var src = el('[data-cr-source]');
      if (src && s.images[s.chosen] && src.getAttribute('data-id') !== s.images[s.chosen].id) { src.setAttribute('data-id', s.images[s.chosen].id); src.src = s.images[s.chosen].dataUrl; }
      var ec = el('[data-cr-ether]'); if (ec) drawStatic(ec, false);
      var sum = el('[data-cr-summary]');
      if (sum) sum.textContent = (st.name || s.authored.creature) + ' · ' + st.points.length + ' points · ' + (st.missing || []).length + ' missing · ' + ((st.reveal && st.reveal.features) || []).length + ' reveals' + (s.source === 'fixture' ? ' · FIXTURE' : '');
      var hn = el('[data-cr-hint]'); if (hn && hn.value !== st.hint) hn.value = st.hint;
      var ms = el('[data-cr-missing]'); if (ms) ms.textContent = (st.missing || []).length + ' connection' + ((st.missing || []).length === 1 ? '' : 's') + (s.authored.missingSource === 'auto' ? ' (chosen by the Lab: the model gave none usable)' : s.authored.missingSource === 'mixed' ? ' (the model\'s, topped up by the Lab)' : '');
      var rl = el('[data-cr-reveals]');
      if (rl) {
        var rolesById = {}; (s.authored.revealRoles || []).forEach(function (r) { rolesById[r.id] = r; });
        var feats = (st.reveal && st.reveal.features) || [];
        rl.innerHTML = feats.length ? feats.map(function (f) {
          var r = rolesById[f.id];
          return '<li><b>' + esc(f.name) + '</b> <span class="cr-role">' + esc(r ? r.role : '') + '</span> <span class="dim">' + esc(f.type) + (r && r.why ? ' — ' + r.why : '') + '</span></li>';
        }).join('') : '<li class="dim">no reveal features</li>';
      }
      var al = el('[data-cr-alive]'); if (al) al.textContent = [s.authored.alive.gesture, s.authored.alive.movement].filter(Boolean).join(' ');
      var sn = el('[data-cr-seen]'); if (sn) sn.textContent = s.authored.seen ? 'The model saw: ' + s.authored.seen : '';
      var pl = el('[data-cr-play]'); if (pl) { pl.hidden = !(S.playable && S.playable()); }
      var pn = el('[data-cr-playnote]'); if (pn) pn.hidden = !!(S.playable && S.playable());
      if (stage.state !== 'alive') { var stc = el('[data-cr-stage]'); if (stc) { stage.canvas = stc; drawStatic(stc, stage.state === 'unfinished'); } }
    }
    paintStates();
    renderAdvanced();
  }

  function renderAdvanced() {
    var s = session;
    var tr = el('[data-cr-trace]'); if (tr) tr.textContent = s ? JSON.stringify(snapshot(), null, 2) : 'no session';
    var raw = el('[data-cr-raw]'); if (raw) raw.textContent = s && s.raw ? s.raw : '—';
    var ex = el('[data-cr-extraction]'); if (ex) ex.textContent = s && s.extraction ? JSON.stringify(s.extraction, null, 2) : '—';
    var au = el('[data-cr-authored]'); if (au) au.textContent = s && s.authored ? JSON.stringify(s.authored, null, 2) : '—';
    var cf = el('[data-cr-confidence]'); if (cf) cf.textContent = s && s.authored ? String(s.authored.confidence) : '—';
    var si = el('[data-cr-source-adv]');
    if (si && s && s.chosen !== null && s.images[s.chosen]) { if (si.getAttribute('data-id') !== s.images[s.chosen].id) { si.setAttribute('data-id', s.images[s.chosen].id); si.src = s.images[s.chosen].dataUrl; } si.hidden = false; }
    else if (si) si.hidden = true;
    var lg = el('[data-cr-log]'); if (lg) lg.textContent = s ? s.log.map(function (e) { return e.at.slice(11, 19) + ' ' + e.step + (e.note ? ' — ' + e.note : ''); }).join('\n') : '—';
  }

  function wire() {
    if (!doc) return;
    var S = global.ShapeLab;
    // shape.html#advanced — a developer's link straight to the machinery
    try { if (/\badvanced\b/.test(global.location.hash)) { var adv = el('[data-advanced]'); if (adv) adv.open = true; } } catch (e) { /* held */ }
    var input = el('[data-cr-prompt]');
    var go = function () {
      var r = cleanPrompt(input ? input.value : '');
      if (!r) { var n0 = el('[data-cr-status]'); if (n0) n0.textContent = 'Say what should exist in plain words — letters, numbers, spaces and simple punctuation, up to ' + LIMITS.promptChars + ' characters.'; return; }
      create(r);
    };
    var cr = el('[data-cr-create]'); if (cr) cr.addEventListener('click', go);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    var tiles = el('[data-cr-images]');
    if (tiles) tiles.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cr-use]');
      if (!b) return;
      choose(Number(b.getAttribute('data-cr-use')));
    });
    doc.querySelectorAll('[data-cr-another-image]').forEach(function (ai) { ai.addEventListener('click', function () { anotherImage(); }); });
    doc.querySelectorAll('[data-cr-another-interp]').forEach(function (an) { an.addEventListener('click', function () { anotherInterpretation(); }); });
    var rt = el('[data-cr-retry]'); if (rt) rt.addEventListener('click', function () { anotherInterpretation(); });
    var rf = el('[data-cr-refine]'); if (rf) rf.addEventListener('click', function () { var t = el('[data-cr-refine-text]'); refine(t ? t.value : ''); });
    var rt = el('[data-cr-refine-text]'); if (rt) rt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); refine(rt.value); } });
    var ap = el('[data-cr-approve]'); if (ap) ap.addEventListener('click', function () { var r = approve(); if (!r.ok) { var n1 = el('[data-cr-status]'); if (n1) n1.textContent = 'Nothing to approve yet (' + r.reason + ').'; } });
    var cn = el('[data-cr-cancel]'); if (cn) cn.addEventListener('click', function () { cancel(); });
    doc.querySelectorAll('[data-cr-state]').forEach(function (b) { b.addEventListener('click', function () { showState(b.getAttribute('data-cr-state')); }); });
    var hn = el('[data-cr-hint]'); if (hn) hn.addEventListener('input', function () { if (S && S.setHint) S.setHint(hn.value); });
    var pl = el('[data-cr-play]'); if (pl) pl.addEventListener('click', function () { var real = el('[data-play]'); if (real && !real.disabled) real.click(); });
    if (S && S.observe) S.observe(render);
    listeners.push(render);
    render();
  }
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }

  global.LabCreature = {
    VERSION: VERSION, LIMITS: JSON.parse(JSON.stringify(LIMITS)), ALIVE: JSON.parse(JSON.stringify(ALIVE)),
    IMAGE_MODEL: IMAGE_MODEL, TEXT_MODEL: TEXT_MODEL, ROLES: ROLES.slice(), FORBIDDEN_KEYS: FORBIDDEN_KEYS.slice(),
    CONTRACT: CONTRACT, FALLBACK_HINT: FALLBACK_HINT,
    // pure
    cleanPrompt: cleanPrompt, cleanRefine: cleanRefine, cleanHint: cleanHint, imagePrompt: imagePrompt,
    extractionMessages: extractionMessages, parse: parse, validate: validate, compile: compile,
    fixtureImages: fixtureImages, fixtureExtraction: fixtureExtraction, resolveLight: resolveLight,
    // the session
    newSession: newSession, create: create, choose: choose, refine: refine,
    anotherImage: anotherImage, anotherInterpretation: anotherInterpretation, cancel: cancel, approve: approve,
    session: snapshot, epoch: function () { return epoch; },
    extraction: function () { return session && session.extraction ? JSON.parse(JSON.stringify(session.extraction)) : null; },
    authored: function () { return session && session.authored ? JSON.parse(JSON.stringify(session.authored)) : null; },
    raw: function () { return session ? session.raw : null; },
    imageOf: function (i) { return session && session.images[i] ? session.images[i].dataUrl : null; },
    // the stage
    showState: showState, stopAlive: stopAlive, stageStatus: stageStatus,
    observe: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
