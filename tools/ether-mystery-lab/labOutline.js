// CREATURE OUTLINE REFERENCE — the visual authoring guide. LAB ONLY.
//
// The assistant's semantic blueprint says WHAT makes a creature
// recognisable — HEAD, EARS, MUZZLE, TRUNK, WINGS, TAIL… — and it says it
// well. What it drew badly was the picture: an LLM's ellipses and
// polygons came out as generic blobs. So the picture is no longer the
// assistant's. This file turns the blueprint's FEATURES into a simple,
// monochrome outline an author can place Ether lights over.
//
// WHAT IT IS.
//   - A deterministic, LAB-ONLY reference implementation. It is not
//     provider-generated and never claims to be: every outline it
//     produces is labelled `lab-parts`, and the panel says so in words.
//     It exists to validate the authoring workflow — blueprint → outline
//     → the author's own lights — and to leave a seam
//     (`LabOutline.compose(bp, {provider})`) where a real outline
//     provider can stand later without the Shape Lab changing.
//   - A PARTS vocabulary keyed on FEATURE NAMES, never on subjects. HEAD,
//     EAR, MUZZLE, BEAK, TRUNK, TUSK, HORN, MANE, NECK, BODY, WING, LEG,
//     TAIL, FIN, ARM, MANTLE, SHELL, HUMP, CREST — and the body ARCHETYPE
//     (quadruped · winged · cephalopod · finned · limbless) is inferred from
//     which of those the blueprint names. There is no `subject === …`
//     anywhere and no creature catalogue: a tiger and a wibble go through
//     the same table, and what comes out is whatever their features say.
//   - Monochrome, no eyes, no fur, no texture, no text. Texture features
//     the blueprint names (STRIPES, SPOTS, FUR, FEATHERS, SCALES, EYES,
//     WHISKERS, CLAWS) are recorded as NOT DRAWN rather than faked.
//
// WHAT IT IS NOT.
//   - Not the creature. Nothing here reaches a fixture, a candidate, the
//     preview, the pool or the Ether; the composer returns geometry in
//     the editor's own unit space and the reference layer draws it on
//     the pointer-inert underlay and nowhere else.
//   - Not an auto-tracer. It never places a light, never proposes a join
//     and never decides a gap. It returns ANCHORS — where each drawn
//     feature sits — so the existing suggested-point mechanism can put its
//     faint marks on the outline; accepting one is still the author's
//     click and the light is still theirs.
// LANDMARKS (Adaptive Suggested Points sprint). Beside its anchors,
// every builder now names the places on a part a light could usefully
// stand, each with a LEVEL: 1 = the part's defining point (a head, a
// foot, a wing tip, a beak), 2 = a structural place (a shoulder, a rump,
// a wing root, the base of a tail), 3 = a detail place (a knee, the
// middle of a tail, the trailing edge of a wing). The composer maps them
// onto the blueprint's own feature names; `LabBlueprint.suggestions()`
// ranks them by the feature's importance and the level, so a small
// budget takes the defining points of the most diagnostic features and a
// larger one adds structure and then detail. Nothing here places a
// light: a landmark is a place a person may accept, move away from, or
// ignore.
(function (global) {
  'use strict';

  var COORD = 1.3;

  // ---------------------------------------------------------------
  // THE PART VOCABULARY — feature words → parts, plus the modifiers a
  // feature name may carry (LARGE EARS, LONG NECK, HOOKED BEAK…).
  // ---------------------------------------------------------------
  var PARTS = [
    { part: 'trunk',   re: /\bTRUNK\b/ },
    { part: 'tusks',   re: /\bTUSKS?\b/ },
    { part: 'horns',   re: /\b(HORNS?|ANTLERS?)\b/ },
    { part: 'mane',    re: /\bMANE\b/ },
    { part: 'beak',    re: /\b(BEAK|BILL)\b/ },
    { part: 'muzzle',  re: /\b(MUZZLE|SNOUT|NOSE|JAWS?|MOUTH|CHIN)\b/ },
    { part: 'ears',    re: /\bEARS?\b/ },
    { part: 'head',    re: /\b(HEAD|SKULL|FACE)\b/ },
    { part: 'neck',    re: /\bNECK\b/ },
    { part: 'hump',    re: /\bHUMPS?\b/ },
    { part: 'shell',   re: /\b(SHELL|CARAPACE)\b/ },
    { part: 'mantle',  re: /\b(MANTLE|HOOD)\b/ },
    { part: 'crest',   re: /\b(CREST|COMB|PLUME)\b/ },
    { part: 'wings',   re: /\bWINGS?\b/ },
    { part: 'fluke',   re: /\b(FLUKES?|TAIL FIN)\b/ },
    { part: 'fins',    re: /\b(FINS?|FLIPPERS?)\b/ },
    { part: 'arms',    re: /\b(ARMS?|TENTACLES?)\b/ },
    { part: 'tail',    re: /\bTAIL\b/ },
    { part: 'legs',    re: /\b(LEGS?|PAWS?|FEET|FOOT|HOOVES|HOOF|HAUNCH(ES)?)\b/ },
    { part: 'body',    re: /\b(BODY|TORSO|BACK|CHEST|BELLY|FLANKS?|SHOULDERS?)\b/ }
  ];
  // Detail and texture the outline deliberately does not draw.
  var NOT_DRAWN = /\b(STRIPES?|SPOTS?|FUR|FEATHERS?|SCALES?|EYES?|WHISKERS?|CLAWS?|TEETH|TOOTH|FANGS?|PATTERN|MARKINGS?|COLOU?R|SKIN|HIDE|COAT|SUCKERS?|WRINKLES?|NOSTRILS?)\b/;
  var NUMBER_WORDS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, TWELVE: 12 };

  function modifiers(name) {
    var n = ' ' + name + ' ';
    var m = { big: /\b(LARGE|BIG|HUGE|MASSIVE|BROAD|WIDE|HEAVY|THICK|STOUT|POWERFUL|MUSCULAR|BULKY)\b/.test(n),
              small: /\b(SMALL|TINY|SHORT|STUBBY|LITTLE|THIN|SLENDER|NARROW)\b/.test(n),
              long: /\bLONG\b/.test(n),
              pointed: /\b(POINTED|POINTY|SHARP|ERECT|UPRIGHT)\b/.test(n),
              round: /\b(ROUND|ROUNDED|FLOPPY|FLAPPY|WIDE)\b/.test(n),
              hooked: /\b(HOOKED|CURVED|SHARP)\b/.test(n),
              forked: /\bFORKED\b/.test(n),
              bushy: /\b(BUSHY|FLUFFY|TUFTED)\b/.test(n),
              front: /\b(FRONT|FORE)\b/.test(n),
              hind: /\b(HIND|BACK|REAR)\b/.test(n),
              count: 0 };
    var num = n.match(/\b(\d{1,2})\b/);
    if (num) m.count = Number(num[1]);
    Object.keys(NUMBER_WORDS).forEach(function (w) { if (new RegExp('\\b' + w + '\\b').test(n)) m.count = NUMBER_WORDS[w]; });
    if (/\b(PAIR OF|TWO)\b/.test(n)) m.count = m.count || 2;
    return m;
  }

  // Read the blueprint's features into a plan: which parts, with which
  // modifiers, and which feature name each part answers to.
  function plan(bp) {
    var out = { parts: {}, notDrawn: [], unplaced: [], names: {} };
    (bp.features || []).forEach(function (f) {
      var name = String(f.name || '').toUpperCase();
      if (NOT_DRAWN.test(name) && !PARTS.some(function (p) { return p.re.test(name) && p.part !== 'body'; })) { out.notDrawn.push(name); return; }
      var hit = null;
      for (var i = 0; i < PARTS.length; i++) { if (PARTS[i].re.test(name)) { hit = PARTS[i].part; break; } }
      if (!hit) { out.unplaced.push(name); return; }
      var mod = modifiers(name);
      var slot = out.parts[hit];
      if (!slot) { slot = out.parts[hit] = { mods: [], names: [] }; }
      slot.mods.push(mod); slot.names.push(name);
      // legs named FRONT and HIND separately are still one part with two
      // feature names; each name gets its own anchor.
    });
    return out;
  }

  function has(p, part) { return !!p.parts[part]; }
  function mod(p, part, key) { var s = p.parts[part]; return !!(s && s.mods.some(function (m) { return m[key]; })); }
  function count(p, part, dflt) { var s = p.parts[part]; if (!s) return dflt; var c = 0; s.mods.forEach(function (m) { if (m.count > c) c = m.count; }); return c || dflt; }

  // The body archetype is a reading of the parts, never of the subject.
  function archetype(p) {
    if (has(p, 'wings') && !has(p, 'mantle')) return 'winged';
    if (has(p, 'mantle') || (has(p, 'arms') && !has(p, 'legs'))) return 'cephalopod';
    if ((has(p, 'fins') || has(p, 'fluke')) && !has(p, 'legs')) return 'finned';
    if (!has(p, 'legs') && !has(p, 'wings') && !has(p, 'fins') && !has(p, 'arms') && (has(p, 'tail') || has(p, 'body'))) return 'limbless';
    return 'quadruped';
  }

  // ---------------------------------------------------------------
  // GEOMETRY HELPERS — Catmull-Rom sampling, so a few control points make
  // a clean curve rather than a polygon.
  // ---------------------------------------------------------------
  function smooth(ctrl, closed, per) {
    per = per || 7;
    var n = ctrl.length, pts = [];
    if (n < 2) return ctrl.slice();
    var segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) {
      var p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      if (!closed) { if (i === 0) p0 = p1; if (i === n - 2) p3 = p2; }
      for (var j = 0; j < per; j++) {
        var t = j / per, t2 = t * t, t3 = t2 * t;
        pts.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    if (!closed) pts.push(ctrl[n - 1].slice());
    return pts;
  }
  function ellipse(cx, cy, rx, ry, rot, n) {
    n = n || 28; rot = rot || 0;
    var pts = [], c = Math.cos(rot), s = Math.sin(rot);
    for (var i = 0; i < n; i++) {
      var t = (i / n) * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return pts;
  }
  // A tapered tube along a smooth spine: width w0 at the start, w1 at the end.
  function tube(spine, w0, w1) {
    var c = smooth(spine, false, 6), left = [], right = [];
    for (var i = 0; i < c.length; i++) {
      var a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L, w = (w0 + (w1 - w0) * (i / (c.length - 1))) / 2;
      left.push([c[i][0] + nx * w, c[i][1] + ny * w]);
      right.push([c[i][0] - nx * w, c[i][1] - ny * w]);
    }
    return left.concat(right.reverse());
  }
  function scaleAll(paths, k, ox, oy) {
    return paths.map(function (p) { return { closed: p.closed, part: p.part, pts: p.pts.map(function (q) { return [q[0] * k + (ox || 0), q[1] * k + (oy || 0)]; }) }; });
  }
  function scalePt(q, k, ox, oy) { return [q[0] * k + (ox || 0), q[1] * k + (oy || 0)]; }

  // ---------------------------------------------------------------
  // ARCHETYPES. Each returns paths + per-part anchors in a local frame
  // roughly ±1.2; the composer fits the whole to the editor's reach.
  // ---------------------------------------------------------------
  function quadruped(p) {
    var paths = [], anchors = {}, marks = [];
    function mark(part, label, x, y, level) { marks.push({ part: part, label: label, x: x, y: y, level: level }); }
    var bodyK = mod(p, 'body', 'big') ? 1.18 : (mod(p, 'body', 'small') ? 0.9 : 1);
    var legW = mod(p, 'legs', 'big') ? 0.24 : (mod(p, 'legs', 'small') ? 0.1 : 0.16);
    var legN = Math.min(4, Math.max(2, count(p, 'legs', 4)));
    var neckL = has(p, 'neck') ? (mod(p, 'neck', 'long') ? 0.7 : 0.25) : 0.08;
    var headR = 0.3 * (mod(p, 'head', 'big') ? 1.25 : (mod(p, 'head', 'small') ? 0.8 : 1));
    // BODY — a long torso with a gently arched back.
    var bx = 0.1, by = 0.05, rx = 0.66 * bodyK, ry = 0.3 * bodyK;
    var body = smooth([[bx - rx * 0.85, by - ry * 0.9], [bx - rx * 0.3, by - ry * 1.05], [bx + rx * 0.45, by - ry * 0.98], [bx + rx * 0.95, by - ry * 0.55],
      [bx + rx * 1.0, by + ry * 0.25], [bx + rx * 0.7, by + ry * 0.95], [bx, by + ry * 1.05], [bx - rx * 0.7, by + ry * 0.95], [bx - rx * 1.02, by + ry * 0.3]], true);
    if (has(p, 'hump')) { body = smooth([[bx - rx * 0.85, by - ry * 0.9], [bx - rx * 0.3, by - ry * 1.1], [bx + rx * 0.1, by - ry * 1.9], [bx + rx * 0.5, by - ry * 1.05], [bx + rx * 0.95, by - ry * 0.55],
      [bx + rx * 1.0, by + ry * 0.25], [bx + rx * 0.7, by + ry * 0.95], [bx, by + ry * 1.05], [bx - rx * 0.7, by + ry * 0.95], [bx - rx * 1.02, by + ry * 0.3]], true); anchors.hump = [[bx + rx * 0.1, by - ry * 1.7]]; }
    paths.push({ part: 'body', closed: true, pts: body });
    anchors.body = [[bx, by]];
    mark('body', 'rump', bx + rx * 0.9, by - ry * 0.5, 2);
    mark('body', 'back', bx, by - ry * 1.0, 3);
    mark('body', 'belly', bx, by + ry * 1.02, 3);
    mark('body', 'chest', bx - rx * 0.98, by + ry * 0.35, 3);
    if (has(p, 'shell')) { paths.push({ part: 'shell', closed: true, pts: ellipse(bx, by - ry * 0.3, rx * 0.9, ry * 1.1) }); anchors.shell = [[bx, by - ry * 0.8]]; }
    // NECK and HEAD — the head sits forward of the chest, up with the neck.
    var shoulder = [bx - rx * 0.78, by - ry * 0.55];
    var hx = shoulder[0] - 0.22 - neckL * 0.35, hy = shoulder[1] - 0.12 - neckL * 0.95;
    mark('body', 'shoulder', shoulder[0], shoulder[1], 2);
    if (has(p, 'neck') || neckL > 0.1) {
      paths.push({ part: 'neck', closed: true, pts: tube([[shoulder[0] + 0.12, shoulder[1] + 0.18], [ (shoulder[0] + hx) / 2 + 0.02, (shoulder[1] + hy) / 2 ], [hx + 0.05, hy + 0.05]], 0.34 * bodyK, 0.26) });
      anchors.neck = [[(shoulder[0] + hx) / 2, (shoulder[1] + hy) / 2]];
      mark('neck', 'nape', (shoulder[0] + hx) / 2 + 0.08, (shoulder[1] + hy) / 2 - 0.16 * bodyK, 3);
    }
    paths.push({ part: 'head', closed: true, pts: ellipse(hx, hy, headR * 1.05, headR) });
    anchors.head = [[hx, hy]];
    mark('head', 'crown', hx, hy - headR, 3);
    if (!has(p, 'muzzle') && !has(p, 'trunk')) mark('head', 'chin', hx - headR * 0.6, hy + headR * 0.8, 3);
    // MUZZLE — forward and a little down from the head.
    if (has(p, 'muzzle') && !has(p, 'trunk')) {
      var mL = mod(p, 'muzzle', 'long') ? 0.3 : 0.16, mx = hx - headR * 0.75 - mL * 0.5, my = hy + headR * 0.25;
      paths.push({ part: 'muzzle', closed: true, pts: ellipse(mx, my, mL * 0.9, headR * 0.5, -0.15) });
      anchors.muzzle = [[mx - mL * 0.6, my]];
      mark('muzzle', 'bridge', hx - headR * 0.9, hy - headR * 0.15, 3);
    }
    // TRUNK — from the front of the head, curving down.
    if (has(p, 'trunk')) {
      var t0 = [hx - headR * 0.8, hy + headR * 0.15];
      paths.push({ part: 'trunk', closed: true, pts: tube([t0, [t0[0] - 0.18, t0[1] + 0.3], [t0[0] - 0.14, t0[1] + 0.62], [t0[0] - 0.02, t0[1] + 0.88]], 0.2, 0.08) });
      anchors.trunk = [[t0[0] - 0.03, t0[1] + 0.86]];
      mark('trunk', 'trunk base', t0[0], t0[1], 2);
      mark('trunk', 'trunk middle', t0[0] - 0.16, t0[1] + 0.46, 3);
    }
    // TUSKS — two curves forward from under the head.
    if (has(p, 'tusks')) {
      var u0 = [hx - headR * 0.55, hy + headR * 0.55];
      paths.push({ part: 'tusks', closed: true, pts: tube([u0, [u0[0] - 0.2, u0[1] + 0.12], [u0[0] - 0.36, u0[1] + 0.02]], 0.07, 0.02) });
      anchors.tusks = [[u0[0] - 0.34, u0[1] + 0.03]];
    }
    // EARS — pointed on top, or big round ones behind the head.
    if (has(p, 'ears')) {
      var big = mod(p, 'ears', 'big') || mod(p, 'ears', 'round');
      if (big) {
        var er = headR * 1.35;
        paths.push({ part: 'ears', closed: true, pts: smooth([[hx + headR * 0.2, hy - headR * 0.9], [hx + headR * 0.9, hy - er * 1.05], [hx + headR * 0.9 + er * 0.8, hy - er * 0.5], [hx + headR * 0.9 + er * 0.7, hy + er * 0.6], [hx + headR * 0.7, hy + er * 0.85], [hx + headR * 0.2, hy + headR * 0.6]], true, 5) });
        anchors.ears = [[hx + headR * 0.9 + er * 0.4, hy - er * 0.2]];
      } else {
        var eh = headR * (mod(p, 'ears', 'small') ? 0.55 : 0.85);
        var e1 = [hx - headR * 0.35, hy - headR * 0.8], e2 = [hx + headR * 0.45, hy - headR * 0.75];
        paths.push({ part: 'ears', closed: true, pts: [[e1[0] - headR * 0.3, e1[1] + 0.02], [e1[0], e1[1] - eh], [e1[0] + headR * 0.3, e1[1] + 0.02]] });
        paths.push({ part: 'ears', closed: true, pts: [[e2[0] - headR * 0.3, e2[1] + 0.02], [e2[0] + headR * 0.05, e2[1] - eh], [e2[0] + headR * 0.32, e2[1] + 0.02]] });
        anchors.ears = [[e1[0], e1[1] - eh * 0.8], [e2[0] + headR * 0.05, e2[1] - eh * 0.8]];
      }
    }
    // HORNS — two curved spikes up from the head.
    if (has(p, 'horns')) {
      var h0 = [hx + headR * 0.3, hy - headR * 0.8];
      paths.push({ part: 'horns', closed: true, pts: tube([h0, [h0[0] + 0.1, h0[1] - 0.25], [h0[0] + 0.05, h0[1] - 0.45]], 0.09, 0.02) });
      anchors.horns = [[h0[0] + 0.05, h0[1] - 0.43]];
    }
    // MANE — a ruff of points around the head.
    if (has(p, 'mane')) {
      var ruff = [], R = headR * 1.7;
      for (var i = 0; i < 18; i++) { var a = (i / 18) * Math.PI * 2, r = i % 2 ? R : R * 0.82; ruff.push([hx + headR * 0.35 + Math.cos(a) * r, hy + Math.sin(a) * r]); }
      paths.push({ part: 'mane', closed: true, pts: ruff });
      anchors.mane = [[hx + headR * 0.35, hy - R]];
      mark('mane', 'mane back', hx + headR * 0.35 + R, hy, 2);
      mark('mane', 'mane chin', hx + headR * 0.35, hy + R, 3);
    }
    // LEGS — front pair and hind pair, feet a little wider.
    var legTop = by + ry * 0.75, legBot = by + ry + 0.62 * bodyK;
    var legXs = legN >= 4 ? [bx - rx * 0.72, bx - rx * 0.36, bx + rx * 0.36, bx + rx * 0.74] : [bx - rx * 0.4, bx + rx * 0.45];
    var frontA = [], hindA = [];
    legXs.forEach(function (lx, i) {
      var hind = i >= legXs.length / 2, w = legW, foot = legW * 0.55;
      // A clean tapering column with a small foot; the hind pair carries a haunch.
      var pts = hind
        ? smooth([[lx - w * 0.9, legTop - 0.12], [lx + w * 1.1, legTop - 0.05], [lx + w * 0.7, (legTop + legBot) / 2], [lx + w * 0.55, legBot], [lx + w * 0.55 + foot, legBot + 0.04],
                  [lx - w * 0.5, legBot + 0.04], [lx - w * 0.45, (legTop + legBot) / 2 + 0.05]], true, 5)
        : [[lx - w * 0.7, legTop - 0.05], [lx + w * 0.7, legTop - 0.05], [lx + w * 0.5, legBot], [lx + w * 0.5 + foot, legBot + 0.04], [lx - w * 0.55, legBot + 0.04], [lx - w * 0.55, legBot]];
      paths.push({ part: 'legs', closed: true, pts: pts });
      (hind ? hindA : frontA).push([lx + (hind ? w * 0.2 : 0), legBot - 0.02]);
      mark(hind ? 'legsHind' : 'legsFront', (hind ? 'hind' : 'front') + ' knee', lx + (hind ? w * 0.55 : 0), (legTop + legBot) / 2, 3);
    });
    anchors.legs = frontA.concat(hindA); anchors.legsFront = frontA; anchors.legsHind = hindA;
    // TAIL — long curve up and back, short and hanging, or bushy.
    if (has(p, 'tail')) {
      var tx = bx + rx * 0.98, ty = by - ry * 0.25;
      var lng = mod(p, 'tail', 'long') || !(mod(p, 'tail', 'small')), bushy = mod(p, 'tail', 'bushy');
      var spine = lng ? [[tx, ty], [tx + 0.25, ty - 0.15], [tx + 0.42, ty - 0.45], [tx + 0.36, ty - 0.72]] : [[tx, ty], [tx + 0.08, ty + 0.25], [tx + 0.06, ty + 0.5]];
      paths.push({ part: 'tail', closed: true, pts: tube(spine, bushy ? 0.22 : 0.1, bushy ? 0.16 : 0.04) });
      var tip = spine[spine.length - 1]; anchors.tail = [[tip[0], tip[1]]];
      mark('tail', 'tail base', tx, ty, 2);
      var midS = spine[Math.floor(spine.length / 2)]; mark('tail', 'tail middle', midS[0], midS[1], 3);
    }
    return { paths: paths, anchors: anchors, marks: marks };
  }

  function winged(p) {
    var paths = [], anchors = {}, marks = [];
    function mark(part, label, x, y, level) { marks.push({ part: part, label: label, x: x, y: y, level: level }); }
    var wingK = mod(p, 'wings', 'small') ? 0.45 : (mod(p, 'wings', 'big') || mod(p, 'wings', 'long') ? 1.15 : 1);
    var headR = 0.19;
    // BODY — a teardrop, head end up.
    paths.push({ part: 'body', closed: true, pts: smooth([[0, -0.42], [0.2, -0.2], [0.22, 0.2], [0.1, 0.5], [-0.1, 0.5], [-0.22, 0.2], [-0.2, -0.2]], true) });
    anchors.body = [[0, 0.05]];
    mark('body', 'breast', 0, -0.28, 2);
    mark('body', 'vent', 0, 0.42, 3);
    paths.push({ part: 'head', closed: true, pts: ellipse(0, -0.56, headR, headR * 0.95) });
    anchors.head = [[0, -0.56]];
    mark('head', 'crown', 0, -0.56 - headR * 0.9, 3);
    if (has(p, 'beak')) {
      var hooked = mod(p, 'beak', 'hooked');
      var bk = hooked ? [[-0.07, -0.68], [0.0, -0.86], [0.09, -0.74], [0.04, -0.7]] : [[-0.07, -0.68], [0.0, -0.92], [0.07, -0.68]];
      paths.push({ part: 'beak', closed: true, pts: bk });
      anchors.beak = [[0, -0.84]];
    }
    if (has(p, 'crest')) { paths.push({ part: 'crest', closed: true, pts: [[-0.02, -0.7], [0.08, -0.9], [0.14, -0.72]] }); anchors.crest = [[0.1, -0.86]]; }
    if (has(p, 'neck') && mod(p, 'neck', 'long')) { paths.push({ part: 'neck', closed: true, pts: tube([[0, -0.4], [0, -0.7], [0, -1.0]], 0.16, 0.12) }); anchors.neck = [[0, -0.7]];
      paths[1] = { part: 'head', closed: true, pts: ellipse(0, -1.1, headR, headR * 0.95) }; anchors.head = [[0, -1.1]]; if (anchors.beak) { paths.forEach(function (q) { if (q.part === 'beak') q.pts = q.pts.map(function (v) { return [v[0], v[1] - 0.54]; }); }); anchors.beak = [[0, -1.38]]; } }
    // WINGS — spread, one each side, a feathered trailing edge.
    if (has(p, 'wings')) {
      [-1, 1].forEach(function (sgn) {
        var span = 1.05 * wingK;
        // Leading edge swept forward, a pointed tip, and a trailing edge
        // scalloped into primary feathers.
        var lead = smooth([[sgn * 0.16, -0.3], [sgn * (0.16 + span * 0.4), -0.4 - 0.1 * wingK], [sgn * (0.16 + span * 0.8), -0.3], [sgn * (0.16 + span * 1.05), -0.12]], false, 6);
        var trail = [];
        var tips = 5;
        for (var i = 0; i <= tips; i++) {
          var f = i / tips, x = sgn * (0.16 + span * (1.02 - f * 0.86)), yBase = -0.12 + f * 0.34, yTip = yBase + 0.12 * (1 - f * 0.6);
          trail.push([x, yTip]);
          if (i < tips) trail.push([sgn * (0.16 + span * (1.02 - (f + 0.5 / tips) * 0.86)), yBase + 0.02 + f * 0.05]);
        }
        var w = lead.concat(trail, [[sgn * 0.2, 0.2]]);
        paths.push({ part: 'wings', closed: true, pts: w });
        anchors.wings = (anchors.wings || []).concat([[sgn * (0.16 + span * 0.95), -0.16]]);
        var side = sgn < 0 ? 'left ' : 'right ';
        mark('wings', side + 'wing root', sgn * 0.2, -0.22, 2);
        mark('wings', side + 'leading edge', sgn * (0.16 + span * 0.45), -0.42 - 0.08 * wingK, 3);
        mark('wings', side + 'trailing edge', sgn * (0.16 + span * 0.5), 0.12, 3);
      });
    }
    if (has(p, 'tail')) {
      var forked = mod(p, 'tail', 'forked'), lng = mod(p, 'tail', 'long');
      var tl = lng ? 0.75 : 0.45;
      var t = forked ? [[-0.12, 0.45], [-0.3, 0.45 + tl], [-0.02, 0.45 + tl * 0.6], [0.02, 0.45 + tl * 0.6], [0.3, 0.45 + tl], [0.12, 0.45]]
                     : [[-0.12, 0.45], [-0.3, 0.45 + tl], [-0.2, 0.42 + tl], [-0.1, 0.5 + tl], [0, 0.45 + tl], [0.1, 0.5 + tl], [0.2, 0.42 + tl], [0.3, 0.45 + tl], [0.12, 0.45]];
      paths.push({ part: 'tail', closed: true, pts: t });
      anchors.tail = [[0, 0.45 + tl * 0.9]];
      mark('tail', 'tail base', 0, 0.47, 2);
      mark('tail', 'left tail corner', -0.28, 0.45 + tl * 0.95, 3);
      mark('tail', 'right tail corner', 0.28, 0.45 + tl * 0.95, 3);
    }
    if (has(p, 'legs')) {
      [-1, 1].forEach(function (sgn) {
        paths.push({ part: 'legs', closed: true, pts: tube([[sgn * 0.08, 0.42], [sgn * 0.1, 0.62]], 0.06, 0.04).concat([[sgn * 0.18, 0.66], [sgn * 0.02, 0.66]]) });
      });
      anchors.legs = [[-0.1, 0.62], [0.1, 0.62]];
    }
    return { paths: paths, anchors: anchors, marks: marks };
  }

  function cephalopod(p) {
    var paths = [], anchors = {}, marks = [];
    function mark(part, label, x, y, level) { marks.push({ part: part, label: label, x: x, y: y, level: level }); }
    var n = Math.min(12, Math.max(4, count(p, 'arms', 8)));
    // MANTLE — a dome, narrowing to a head band.
    paths.push({ part: 'mantle', closed: true, pts: smooth([[0, -1.05], [0.4, -0.85], [0.5, -0.4], [0.42, -0.02], [0, 0.08], [-0.42, -0.02], [-0.5, -0.4], [-0.4, -0.85]], true) });
    anchors.mantle = [[0, -0.62]];
    mark('mantle', 'mantle top', 0, -1.02, 2);
    mark('mantle', 'left side', -0.48, -0.42, 3);
    mark('mantle', 'right side', 0.48, -0.42, 3);
    if (has(p, 'head')) { anchors.head = [[0, -0.1]]; mark('head', 'left cheek', -0.4, -0.05, 3); mark('head', 'right cheek', 0.4, -0.05, 3); }
    // ARMS — a fan of tapered curls from the base.
    var arms = [];
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n, x0 = -0.42 + f * 0.84, spread = (f - 0.5) * 2;
      var sgn = i % 2 ? 1 : -1;
      var spine = [[x0, 0.02], [x0 + spread * 0.25, 0.42], [x0 + spread * 0.55 + sgn * 0.08, 0.8], [x0 + spread * 0.75 + sgn * 0.2, 1.02 - Math.abs(spread) * 0.25]];
      paths.push({ part: 'arms', closed: true, pts: tube(spine, 0.14, 0.03) });
      arms.push(spine[spine.length - 1]);
      mark('arms', 'arm ' + (i + 1) + ' bend', spine[2][0], spine[2][1], 3);
    }
    anchors.arms = arms;
    if (has(p, 'fins')) { paths.push({ part: 'fins', closed: true, pts: [[0.44, -0.75], [0.7, -0.95], [0.5, -0.45]] }); paths.push({ part: 'fins', closed: true, pts: [[-0.44, -0.75], [-0.7, -0.95], [-0.5, -0.45]] }); anchors.fins = [[0.62, -0.85], [-0.62, -0.85]]; }
    return { paths: paths, anchors: anchors, marks: marks };
  }

  function finned(p) {
    var paths = [], anchors = {}, marks = [];
    function mark(part, label, x, y, level) { marks.push({ part: part, label: label, x: x, y: y, level: level }); }
    var big = mod(p, 'body', 'big');
    var ry = big ? 0.42 : 0.3;
    paths.push({ part: 'body', closed: true, pts: smooth([[-1.0, 0], [-0.6, -ry], [0.1, -ry * 0.95], [0.6, -ry * 0.45], [0.8, 0], [0.6, ry * 0.45], [0.1, ry * 0.95], [-0.6, ry]], true) });
    anchors.body = [[-0.2, 0]]; anchors.head = [[-0.8, 0]];
    mark('body', 'back', -0.1, -ry * 0.95, 2);
    mark('body', 'belly', -0.1, ry * 0.95, 2);
    mark('body', 'tail root', 0.6, 0, 3);
    mark('head', 'brow', -0.7, -ry * 0.6, 3);
    if (has(p, 'muzzle')) anchors.muzzle = [[-1.0, 0]];
    var fl = has(p, 'fluke') || has(p, 'tail');
    if (fl || has(p, 'fins')) {
      var forked = !mod(p, 'tail', 'round');
      var t = forked ? [[0.78, -0.08], [1.15, -0.42], [1.02, 0], [1.15, 0.42], [0.78, 0.08]] : [[0.78, -0.1], [1.1, -0.3], [1.1, 0.3], [0.78, 0.1]];
      paths.push({ part: fl ? (has(p, 'fluke') ? 'fluke' : 'tail') : 'fins', closed: true, pts: t });
      anchors[has(p, 'fluke') ? 'fluke' : 'tail'] = [[1.1, 0]];
      var tp = has(p, 'fluke') ? 'fluke' : 'tail';
      if (forked) { mark(tp, 'upper ' + tp + ' tip', 1.15, -0.42, 2); mark(tp, 'lower ' + tp + ' tip', 1.15, 0.42, 2); }
      mark(tp, tp + ' base', 0.8, 0, 3);
    }
    if (has(p, 'fins')) {
      paths.push({ part: 'fins', closed: true, pts: [[-0.2, -ry * 0.9], [0.05, -ry * 1.7], [0.3, -ry * 0.7]] });
      paths.push({ part: 'fins', closed: true, pts: [[-0.45, ry * 0.5], [-0.2, ry * 1.25], [-0.05, ry * 0.7]] });
      anchors.fins = [[0.05, -ry * 1.6], [-0.2, ry * 1.2]];
      mark('fins', 'dorsal fin base', -0.2, -ry * 0.9, 3);
      mark('fins', 'lower fin base', -0.45, ry * 0.5, 3);
    }
    return { paths: paths, anchors: anchors, marks: marks };
  }

  function limbless(p) {
    var paths = [], anchors = {}, marks = [];
    function mark(part, label, x, y, level) { marks.push({ part: part, label: label, x: x, y: y, level: level }); }
    var spine = [[-1.05, 0.55], [-0.6, 0.1], [-0.1, 0.45], [0.4, 0.05], [0.85, 0.4], [1.15, -0.15]];
    paths.push({ part: 'body', closed: true, pts: tube(spine, 0.22, 0.05) });
    paths.push({ part: 'head', closed: true, pts: ellipse(-1.12, 0.55, 0.16, 0.11, -0.7) });
    anchors.head = [[-1.15, 0.5]]; anchors.body = [[-0.1, 0.45]]; anchors.tail = [[1.15, -0.15]];
    mark('body', 'first bend', spine[1][0], spine[1][1], 2);
    mark('body', 'third bend', spine[3][0], spine[3][1], 2);
    mark('body', 'fourth bend', spine[4][0], spine[4][1], 3);
    mark('tail', 'tail base', (spine[4][0] + spine[5][0]) / 2, (spine[4][1] + spine[5][1]) / 2, 3);
    if (has(p, 'crest')) { paths.push({ part: 'crest', closed: true, pts: [[-1.05, 0.42], [-0.9, 0.2], [-0.82, 0.48]] }); anchors.crest = [[-0.9, 0.24]]; }
    return { paths: paths, anchors: anchors, marks: marks };
  }

  var ARCHETYPES = { quadruped: quadruped, winged: winged, cephalopod: cephalopod, finned: finned, limbless: limbless };

  // Fit the composed outline into the editor's reach, uniformly, with a
  // margin — one frame for every budget, so 8- and 20-point figures over
  // the same creature are comparable.
  function fit(paths, anchors, marks) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    paths.forEach(function (p) { p.pts.forEach(function (q) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }); });
    var w = maxX - minX || 1, h = maxY - minY || 1, reach = COORD * 0.92;
    var k = Math.min((reach * 2) / w, (reach * 2) / h);
    var ox = -(minX + maxX) / 2 * k, oy = -(minY + maxY) / 2 * k;
    var out = scaleAll(paths, k, ox, oy), an = {};
    Object.keys(anchors).forEach(function (key) { an[key] = anchors[key].map(function (q) { return scalePt(q, k, ox, oy); }); });
    var mk = (marks || []).map(function (m) { var q = scalePt([m.x, m.y], k, ox, oy); return { part: m.part, label: m.label, x: q[0], y: q[1], level: m.level }; });
    return { paths: out, anchors: an, marks: mk };
  }

  // Map the blueprint's own feature NAMES to anchors, so the suggested
  // points and the labels land on the outline. A feature the outline did
  // not draw gets no anchor.
  function anchorsByFeature(bp, p, an) {
    var out = {};
    (bp.features || []).forEach(function (f) {
      var name = String(f.name || '').toUpperCase(), hit = null;
      for (var i = 0; i < PARTS.length; i++) { if (PARTS[i].re.test(name)) { hit = PARTS[i].part; break; } }
      if (!hit) return;
      var m = modifiers(name);
      var list = an[hit];
      if (hit === 'legs' && m.front && an.legsFront) list = an.legsFront;
      if (hit === 'legs' && m.hind && an.legsHind) list = an.legsHind;
      if (list && list.length) out[name] = list.map(function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; });
    });
    return out;
  }

  // LANDMARKS BY FEATURE — every place a light could usefully stand, per
  // blueprint feature name: the part's anchors as level 1 (its defining
  // points, labelled by the part), then the builder's own structural and
  // detail marks. A feature the outline did not draw contributes no
  // landmark; the blueprint's own anchor stands in for it downstream.
  // Front/hind legs named separately each get their own column of marks.
  function landmarksByFeature(bp, p, an, marks) {
    var out = [];
    function r2(v) { return Math.round(v * 100) / 100; }
    (bp.features || []).forEach(function (f) {
      var name = String(f.name || '').toUpperCase(), hit = null;
      for (var i = 0; i < PARTS.length; i++) { if (PARTS[i].re.test(name)) { hit = PARTS[i].part; break; } }
      if (!hit) return;
      var m = modifiers(name);
      var key = hit, markKeys = [hit];
      if (hit === 'legs') {
        if (m.front && an.legsFront) { key = 'legsFront'; markKeys = ['legsFront']; }
        else if (m.hind && an.legsHind) { key = 'legsHind'; markKeys = ['legsHind']; }
        else markKeys = ['legsFront', 'legsHind'];
      }
      var primary = an[key] || [];
      primary.forEach(function (q, i) {
        var label = hit === 'legs' ? ((key === 'legsHind' || (key === 'legs' && i >= primary.length / 2)) ? 'hind foot' : 'front foot')
                  : hit === 'wings' ? (i === 0 ? 'left wing tip' : 'right wing tip')
                  : hit === 'arms' ? ('arm ' + (i + 1) + ' tip')
                  : hit === 'ears' ? (primary.length > 1 ? (i === 0 ? 'left ear' : 'right ear') : 'ear')
                  : hit === 'fins' ? (i === 0 ? 'dorsal fin' : 'lower fin')
                  : (hit === 'tail' || hit === 'trunk' || hit === 'tusks' || hit === 'horns' || hit === 'beak' || hit === 'fluke' || hit === 'muzzle') ? hit.replace(/s$/, '') + ' tip'
                  : hit;
        out.push({ name: name, part: hit, label: label, x: r2(q[0]), y: r2(q[1]), level: 1 });
      });
      (marks || []).forEach(function (mk) {
        if (markKeys.indexOf(mk.part) === -1) return;
        out.push({ name: name, part: hit, label: mk.label, x: r2(mk.x), y: r2(mk.y), level: mk.level });
      });
    });
    return out;
  }

  // ---------------------------------------------------------------
  // THE SEAM. `compose(bp)` is what the reference layer calls; the
  // deterministic parts composer is the only provider today, and it says
  // so. A real outline provider later is another entry in PROVIDERS and
  // nothing in the Shape Lab changes.
  // ---------------------------------------------------------------
  function composeParts(bp) {
    var p = plan(bp);
    var kind = archetype(p);
    var built = ARCHETYPES[kind](p);
    var fitted = fit(built.paths, built.anchors, built.marks);
    return {
      source: 'lab-parts',
      label: 'Lab-only deterministic outline — parts composed from the blueprint\'s features; not provider-generated',
      archetype: kind,
      drawn: Object.keys(p.parts),
      notDrawn: p.notDrawn,
      unplaced: p.unplaced,
      paths: fitted.paths,
      anchors: anchorsByFeature(bp, p, fitted.anchors),
      landmarks: landmarksByFeature(bp, p, fitted.anchors, fitted.marks)
    };
  }

  var PROVIDERS = { parts: composeParts };

  function compose(bp, opts) {
    opts = opts || {};
    if (!bp || !Array.isArray(bp.features)) return null;
    var provider = PROVIDERS[opts.provider || 'parts'];
    if (!provider) return null;
    return provider(bp);
  }

  global.LabOutline = {
    COORD: COORD,
    PARTS: PARTS.map(function (x) { return x.part; }),
    ARCHETYPES: Object.keys(ARCHETYPES),
    compose: compose,
    plan: plan,
    archetype: function (bp) { return archetype(plan(bp)); },
    providers: function () { return Object.keys(PROVIDERS); }
  };
})(typeof window !== 'undefined' ? window : this);
