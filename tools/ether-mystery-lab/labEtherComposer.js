// tools/ether-mystery-lab/labEtherComposer.js — THE DETERMINISTIC ETHER
// COMPOSER: an Ether Translation Plan in, a complete Ether figure out.
//
// SPRINT — Ether creature translation, image → Ether, proof V1
// (Decision 58, Lab only).
//
// THE DIVISION OF LABOUR. The model decides MEANING: which masses
// exist and how big they are, what the dominant gesture is and which
// masses lie along it, what attaches to what and on which side, what
// must survive, how complex the figure should be. This file decides
// GEOMETRY: where every light stands, which lights are joined, how
// many there are, that the figure fits the sky, and what is wrong with
// it. The model never emits a coordinate and this file never reads one
// from it — the plan validator refuses them by name before anything
// gets here.
//
// GESTURE FIRST — the hard product rule. A creature is not head + body
// + legs + tail placed independently and then joined. The composer
// lays the SPINE of the dominant gesture first (upright, grounded,
// flowing, coiled, diagonal, spread, rearing…), bent by the plan's
// curve, and gives every mass on the flow its stretch of that spine.
// Only then are the other masses attached, each by its RELATIONSHIP to
// a mass already standing — rising from the top of it, extending from
// the back of it, spanning from it, surrounding it, supporting it from
// below — using a small controlled vocabulary of composition primitives:
//
//   FLOW        the spine — the run of masses along the dominant gesture
//   MASS        a body of some size and shape, given a stretch of spine
//               and, when it dominates, a width pair so it has volume
//   TAPER       something that leaves a mass and thins to a tip (a
//               tail, a trunk, a neck), curling as it goes
//   SPAN        something that reaches out and back from a mass (a
//               wing, a fin, an ear), a root and a tip and a trailing
//               corner
//   BRANCH      limbs that leave a mass toward the ground (legs)
//   TERMINAL    a small thing at the end of something (a horn, a beak,
//               a tusk, a lantern) — one light, joined to its parent
//   ENCLOSURE   something that surrounds a mass (a mane, a halo, a
//               cloud) — a ring of lights around it
//   TRANSITION  the join between two masses on the flow — a light at
//               the boundary, which is what makes a neck a neck
//   ATTACHMENT  the light on a parent where a child joins it
//
// NO CREATURE CATALOGUE. There is no `if (dragon)`, no species, no
// template. A plan for a wibble with three tapers and an enclosure
// composes exactly as a plan for anything else. The suite scans this
// file for creature words and fails on one.
//
// A LIGHT IS SPENT WHERE IT SAYS SOMETHING. Every candidate light
// carries a priority — the spine's ends and transitions first (they
// are the gesture), then the dominant mass's volume, then whatever the
// plan says must survive, then the diagnostic structures, then the
// secondary ones — and the budget, derived from the plan's complexity,
// cuts the list from the bottom. A light that only exists because a
// feature exists is the last to be kept.
//
// V2 — THE OPEN VOCABULARY (Ether grammar V2, close the loop). Beyond
// its base primitives the composer has SEVEN renderer capabilities,
// generic and closed (labVocabulary.js → CAPABILITIES), applied per
// mass from a resolved vocabulary decision that arrives as DATA in
// opts.caps — never read from a name, never from a species:
//
//   OUTLINE     a span or taper is closed into a silhouette — a trailing
//               edge back to the body, a base width — so it is a shape
//   CURL        a taper bends back on itself as it thins
//   FLARE       the end of a taper or terminal widens into two
//   LOBE        a mass gets a broad flat far edge instead of a point
//   CONTINUOUS  two flow masses become one form: no boundary light, and
//               their silhouettes join across
//   SWEEP       a reaching structure leans back, forward, up or down
//   MIRROR      the structure is reflected across the flow
//
// THE ORDER OF CONSTRUCTION is the product's own: 1. the primary
// GESTURE (the spine), 2. the primary SILHOUETTE (volume, lobes, the
// outlines of what reaches out), 3. STRUCTURAL relationships (what
// attaches to what), 4. DIAGNOSTIC features (kept by priority), 5.
// REVEAL-ONLY features (never composed as lights — returned for the
// reveal). Nothing is head + body + leg + leg + tail placed apart.
//
// WHAT COMES OUT is data for the Shape Lab: points in the editor's own
// unit space, a role (mass label) per point, the complete connection
// graph, the budget chosen, and diagnostics a person can read —
// components, crossings, merged lights, masses that got no light.

(function (global) {
  'use strict';

  var SIZES = { dominant: 0.30, large: 0.24, medium: 0.18, small: 0.13, tiny: 0.08 };
  var WEIGHTS = { dominant: 3.0, large: 2.2, medium: 1.5, small: 1.0, tiny: 0.6 };
  var TREAT = { dominant: 1.3, oversized: 1.4, elongated: 1.6, compressed: 0.6, small: 0.7, keep: 1.0 };
  var LENGTHS = { dominant: 1.0, large: 0.8, medium: 0.6, small: 0.42, tiny: 0.26 };
  var CAPS = { simple: 10, moderate: 14, rich: 20 };
  var BUDGETS = [8, 10, 12, 16, 18, 20];
  var FIT = 1.1;                       // the figure fills [-FIT, FIT]; the editor clamps at 1.4
  var MERGE = 0.11;                    // two lights this close are one light

  // ---------------------------------------------------------------
  // vectors
  // ---------------------------------------------------------------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l]; }
  function perp(a) { return [-a[1], a[0]]; }
  function dist(a, b) { return len(sub(a, b)); }
  function rot(a, ang) { var c = Math.cos(ang), s = Math.sin(ang); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; }

  // ---------------------------------------------------------------
  // THE SPINE. Root → tip along the dominant gesture, in a unit sky
  // where y goes DOWN. Facing decides which way the head end points.
  // ---------------------------------------------------------------
  function facingDir(facing) {
    if (facing === 'right' || facing === 'three-quarter-right') return [1, 0];
    if (facing === 'front') return [0, 1];
    return [-1, 0];
  }
  function spineFor(gesture) {
    var f = facingDir(gesture.facing);
    var fx = f[0] === 0 ? -1 : f[0];         // a front-facing figure leans as if facing left
    var root, tip;
    switch (gesture.kind) {
      case 'grounded': case 'reaching': root = [-0.95 * fx, 0.12]; tip = [0.95 * fx, -0.12]; break;
      case 'flowing': root = [-0.75 * fx, 0.9]; tip = [0.6 * fx, -0.85]; break;
      case 'coiled': root = [-0.55 * fx, 0.8]; tip = [0.55 * fx, -0.7]; break;
      case 'diagonal': root = [-0.85 * fx, 0.85]; tip = [0.85 * fx, -0.85]; break;
      case 'rearing': root = [-0.55 * fx, 0.85]; tip = [0.45 * fx, -0.85]; break;
      case 'spread': root = [-0.6 * fx, 0.25]; tip = [0.6 * fx, -0.2]; break;
      case 'seated': root = [0, 0.7]; tip = [0, -0.75]; break;
      case 'floating': root = [0, 0.8]; tip = [0, -0.85]; break;
      default: root = [0, 0.9]; tip = [0, -0.9];             // upright
    }
    var amp = { straight: 0, gentle: 0.12, 'c-curve': 0.3, 's-curve': 0.3 }[gesture.curve] || 0;
    var s = gesture.curve === 's-curve';
    var axis = sub(tip, root), n = perp(norm(axis));
    // a curve bends away from the facing side, so a curled figure reads
    // as leaning INTO its own facing
    var sign = gesture.kind === 'upright' || gesture.kind === 'seated' || gesture.kind === 'floating' ? -fx : 1;
    return {
      at: function (t) {
        var off = s ? Math.sin(2 * Math.PI * t) : Math.sin(Math.PI * t);
        return add(add(root, mul(axis, t)), mul(n, amp * off * sign));
      },
      dir: function (t) {
        var a = this.at(Math.max(0, t - 0.01)), b = this.at(Math.min(1, t + 0.01));
        return norm(sub(b, a));
      },
      length: len(axis),
      facing: f, fx: fx
    };
  }

  // ---------------------------------------------------------------
  // THE COMPOSER
  // ---------------------------------------------------------------
  function compose(plan, opts) {
    opts = opts || {};
    if (!plan || !Array.isArray(plan.masses) || !plan.gesture) return { ok: false, reason: 'no-plan' };
    var byId = {};
    plan.masses.forEach(function (m) { byId[m.id] = m; });
    var treat = {};
    (plan.proportion || []).forEach(function (p) { treat[p.mass] = TREAT[p.treat] || 1; });
    var survive = {};
    (plan.mustSurvive || []).forEach(function (id) { survive[id] = true; });
    // the resolved vocabulary: per mass, the capabilities the compiler may
    // use — {outline, curl, flare, lobe, continuous, sweep:<dir>, mirror,
    // revealOnly}. Absent means the base vocabulary alone.
    var caps = opts.caps || {};
    function capOf(id, k) { return caps[id] ? caps[id][k] : undefined; }
    var revealOnlyIds = plan.masses.filter(function (m) { return capOf(m.id, 'revealOnly'); }).map(function (m) { return m.id; });
    var flowIds = (plan.gesture.flow || []).filter(function (id) { return byId[id] && !capOf(id, 'revealOnly'); });
    if (flowIds.length < 2) return { ok: false, reason: 'flow-too-short' };
    var spine = spineFor(plan.gesture);

    // priorities: lower is kept first
    // ESSENTIALS BEFORE EXTRAS: a light that gives a mass its existence
    // (a spine end, a transition, a root and a tip, a foot, a ring) is
    // allocated before any light that only refines one (a tail's mid, a
    // wing's trailing corner or second tip) — so a tight budget drops the
    // second wing tip before it drops the feet. EXTRA is added to the
    // priority of every refining light.
    // WHAT MUST SURVIVE OUTRANKS WHAT MERELY HAS VOLUME. The first round of
    // real plans (17 pictures) dropped an elephant's ear, tusk, legs and
    // tail — every one of them on the model's own mustSurvive list — while
    // keeping the width pairs of its head and trunk, because a width light
    // sat above a survive attachment in this table. A width pair only
    // refines a mass the spine already gives a stretch to; an attachment
    // the model said must survive is a thing that is otherwise absent.
    var PRI = { spineEnd: 1, transition: 1, survive: 2, dominantWidth: 3, diagnostic: 4, groundedFeet: 4, surviveWidth: 5, largeWidth: 6, secondary: 7, extra: 10 };

    var cands = [];          // { p:[x,y], mass, pri, needs:[cand idx], tag }
    var joins = [];          // { a: cand idx, b: cand idx, why }
    var placed = {};         // mass id → { c:[x,y], r, dir:[x,y], points:[cand idx], onFlow }
    var log = [];

    // A candidate standing where one already stands IS that light: it
    // takes the better priority and both masses claim it. (A tail's root on
    // a body's edge and the body's own width light are one light — the
    // first draft counted both against the budget and then merged them,
    // which cost a real light for nothing.)
    function light(p, mass, pri, needs, tag, hang) {
      for (var k = 0; k < cands.length; k++) {
        if (dist(cands[k].p, p) < MERGE) {
          cands[k].pri = Math.min(cands[k].pri, pri);
          if (cands[k].hang == null && hang != null && hang !== k) cands[k].hang = hang;
          cands[k].tag += (cands[k].tag ? ' + ' : '') + mass + ' ' + tag;
          if (placed[mass] && placed[mass].points.indexOf(k) === -1) placed[mass].points.push(k);
          log.push('light for "' + mass + '" (' + tag + ') shares the light of "' + cands[k].mass + '"');
          return k;
        }
      }
      cands.push({ p: p, mass: mass, pri: pri, needs: needs || [], tag: tag || '', hang: hang == null ? null : hang });
      var i = cands.length - 1;
      if (placed[mass]) placed[mass].points.push(i);
      return i;
    }
    function join(a, b, why) { if (a !== b && a != null && b != null) joins.push({ a: a, b: b, why: why || '' }); }
    function massRadius(m) { return (SIZES[m.size] || SIZES.medium) * (treat[m.id] === TREAT.compressed ? 0.8 : treat[m.id] === TREAT.oversized || treat[m.id] === TREAT.dominant ? 1.15 : 1); }
    function massLength(m) { return (LENGTHS[m.size] || LENGTHS.medium) * (treat[m.id] || 1); }
    function priFor(m) { return survive[m.id] ? PRI.survive : (m.role === 'diagnostic' ? PRI.diagnostic : PRI.secondary); }
    // HOW FAR A MASS REACHES in a direction. A flow mass is not a disc:
    // along the spine it reaches to the end of its stretch (half the
    // extent), across it to its width — so a thing rising from the top
    // of a head starts at the head's TOP LIGHT and not at a circle drawn
    // inside it (measured: a pair of horns had one horn land on the head's
    // own tip and vanish into it, and an enclosure's crown did the same).
    function reachOf(parent, d) {
      if (!parent.onFlow || !parent.extent) return parent.r;
      var along = Math.abs(d[0] * parent.dir[0] + d[1] * parent.dir[1]);
      var across = Math.sqrt(Math.max(0, 1 - along * along));
      var a = parent.extent / 2, b = parent.r;
      return Math.sqrt(along * along * a * a + across * across * b * b);
    }
    function nearestPoint(massId, p) {
      var pl = placed[massId]; if (!pl || !pl.points.length) return null;
      var best = null, bd = Infinity;
      pl.points.forEach(function (i) { var d = dist(cands[i].p, p); if (d < bd) { bd = d; best = i; } });
      return best;
    }

    // ---- 1. the flow: stretches of spine by weight ----
    var weights = flowIds.map(function (id) { var m = byId[id]; return (WEIGHTS[m.size] || 1.5) * (treat[id] || 1); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var t = 0, bounds = [];
    flowIds.forEach(function (id, i) { var w = weights[i] / total; bounds.push([t, t + w]); t += w; });
    flowIds.forEach(function (id, i) {
      var m = byId[id];
      var tc = (bounds[i][0] + bounds[i][1]) / 2;
      placed[id] = { c: spine.at(tc), r: massRadius(m) * (bounds[i][1] - bounds[i][0] > 0.15 ? 1 : 0.7), dir: spine.dir(tc), t: tc, extent: (bounds[i][1] - bounds[i][0]) * spine.length, points: [], onFlow: true };
    });
    // the spine's ends and its transitions — the gesture itself
    var spineLights = [];
    flowIds.forEach(function (id, i) {
      if (i === 0) spineLights.push(light(spine.at(0), id, PRI.spineEnd, [], 'root end'));
      var tEnd = bounds[i][1];
      var owner = i === flowIds.length - 1 ? id : flowIds[i + 1];
      var last = i === flowIds.length - 1;
      var continuous = !last && (capOf(id, 'continuous') || capOf(owner, 'continuous'));
      var li = light(spine.at(tEnd), owner, last ? PRI.spineEnd : PRI.transition, [], last ? 'tip end' : 'transition ' + id + '→' + owner);
      // CONTINUOUS: one form changes into the next with no boundary — the
      // transition light is never kept, and the flow joins straight across
      // it (a dropped light's joins climb to what it hung from)
      if (continuous) { cands[li].skip = true; cands[li].hang = spineLights[spineLights.length - 1]; log.push('"' + id + '" flows continuously into "' + owner + '": no boundary light'); }
      spineLights.push(li);
    });
    for (var k = 1; k < spineLights.length; k++) join(spineLights[k - 1], spineLights[k], 'flow');
    // volume for the masses that dominate the flow: a width pair across the spine
    var widths = [];
    flowIds.forEach(function (id, i) {
      var m = byId[id];
      var big = m.size === 'dominant' || treat[id] === TREAT.dominant || treat[id] === TREAT.oversized;
      var large = m.size === 'large';
      var lobe = !!capOf(id, 'lobe');
      if (!big && !large && !lobe) return;
      var pl = placed[id];
      var n = perp(pl.dir);
      var half = pl.r * (m.shape === 'wide' || m.shape === 'round' ? 1.0 : m.shape === 'thin' || m.shape === 'long' ? 0.55 : 0.8);
      var wp = big ? PRI.dominantWidth : (survive[id] || lobe ? PRI.surviveWidth : PRI.largeWidth);
      // LOBE: the volume sits at the mass's far end and the two lights are
      // joined to each other — a broad flat edge rather than a diamond
      var c = lobe ? add(pl.c, mul(pl.dir, (pl.extent || 0) * 0.32)) : pl.c;
      // a width light hangs from the spine light that bounds its mass, so
      // anything joined to it when it is dropped climbs back to the spine
      var a = light(add(c, mul(n, half)), id, wp, [], lobe ? 'lobe edge' : 'width', spineLights[i]);
      var b = light(add(c, mul(n, -half)), id, wp, [], lobe ? 'lobe edge' : 'width', spineLights[i]);
      widths[i] = { a: a, b: b };
      // each side joins the two spine lights that bound this mass — a diamond of volume
      join(a, spineLights[i], 'volume'); join(a, spineLights[i + 1], 'volume');
      join(b, spineLights[i], 'volume'); join(b, spineLights[i + 1], 'volume');
      if (lobe) join(a, b, 'lobe');
    });
    // CONTINUOUS silhouettes: where one form flows into the next, each
    // side's edge joins across, so the outline is unbroken
    flowIds.forEach(function (id, i) {
      var next = flowIds[i + 1];
      if (!next || !widths[i] || !widths[i + 1]) return;
      if (!(capOf(id, 'continuous') || capOf(next, 'continuous'))) return;
      join(widths[i].a, widths[i + 1].a, 'continuous'); join(widths[i].b, widths[i + 1].b, 'continuous');
    });

    // ---- 2. attachments, by relationship, until nothing new can be placed ----
    var rels = (plan.relationships || []).filter(function (r) { return !capOf(r.from, 'revealOnly') && !capOf(r.to, 'revealOnly'); });
    var guard = 0;
    while (rels.length && guard++ < 40) {
      var progressed = false;
      for (var ri = 0; ri < rels.length; ri++) {
        var rel = rels[ri];
        var fromPlaced = !!placed[rel.from], toPlaced = !!placed[rel.to];
        if (fromPlaced && toPlaced) { rels.splice(ri, 1); ri--; continue; }     // both stand already (a flow pair) — the flow joined them
        if (!fromPlaced && !toPlaced) continue;                                   // wait for a parent
        var childId = fromPlaced ? rel.to : rel.from;
        var parentId = fromPlaced ? rel.from : rel.to;
        var childIsFrom = !fromPlaced;
        attach(byId[childId], byId[parentId], rel, childIsFrom);
        rels.splice(ri, 1); ri--; progressed = true;
      }
      if (!progressed) break;
    }
    var orphans = plan.masses.filter(function (m) { return !placed[m.id] && !capOf(m.id, 'revealOnly'); }).map(function (m) { return m.id; });
    // a mass nobody related to anything: hang it off the largest flow mass so it is not lost, and say so
    orphans.forEach(function (id) {
      var parent = flowIds[0];
      flowIds.forEach(function (f) { if (placed[f].r > placed[parent].r) parent = f; });
      log.push('mass "' + id + '" had no relationship — attached to "' + parent + '" at the back');
      attach(byId[id], byId[parent], { from: id, relation: 'attaches-to', to: parent, side: 'back' }, true);
    });

    // the direction ACROSS a mass — perpendicular to its flow, or simply
    // sideways for one that stands off the flow — and a vector reflected
    // across an axis, which is how the other half of a pair is placed
    function mirrorAxis(parent) { var v = parent.onFlow ? perp(parent.dir) : [1, 0]; return v[0] < 0 ? mul(v, -1) : v; }
    function reflect(v, axis) { var a = norm(axis), k = 2 * (v[0] * a[0] + v[1] * a[1]); return [k * a[0] - v[0], k * a[1] - v[1]]; }
    function sideVector(side, parent) {
      var f = spine.facing;
      var fwd = [f[0] || -spine.fx * 0, f[1]];         // front for a side view is the facing; for a front view, "front" means toward the viewer → use down
      var facingX = spine.fx;
      switch (side) {
        case 'top': return [0, -1];
        case 'bottom': return [0, 1];
        case 'front': return f[1] ? [0, 1] : [facingX, 0];
        case 'back': return f[1] ? [0, -1] : [-facingX, 0];
        case 'left': return [-1, 0];
        case 'right': return [1, 0];
        case 'around': case 'both': default: return parent.onFlow ? perp(parent.dir) : [0, -1];
      }
    }
    function defaultSide(rel, childIsFrom) {
      switch (rel.relation) {
        case 'rises-from': return 'top';
        case 'hangs-from': return 'bottom';
        case 'supports': return childIsFrom ? 'bottom' : 'top';
        case 'extends-from': return 'back';
        case 'spans-from': return 'top';
        case 'surrounds': return 'around';
        case 'pairs-with': return 'both';
        default: return 'back';
      }
    }

    function attach(child, parentMass, rel, childIsFrom) {
      if (!child || !parentMass || placed[child.id]) return;
      var parent = placed[parentMass.id];
      var side = rel.side || defaultSide(rel, childIsFrom);
      var d = norm(sideVector(side, parent));
      var pri = priFor(child);
      var L = massLength(child);
      var r = massRadius(child);
      var root = add(parent.c, mul(d, reachOf(parent, d)));
      var anchor = nearestPoint(parentMass.id, root);
      var kind = child.kind;
      var sym = rel.symmetric === true || side === 'both' || !!capOf(child.id, 'mirror');
      var cOutline = !!capOf(child.id, 'outline'), cCurl = !!capOf(child.id, 'curl'), cFlare = !!capOf(child.id, 'flare'), cSweep = capOf(child.id, 'sweep') || null;
      placed[child.id] = { c: add(root, mul(d, L / 2)), r: r, dir: d, points: [], onFlow: false };

      if (kind === 'taper') {
        // a tail, a trunk, a neck: root at the parent's edge, a tip L away,
        // curling: the mid-point bends up and the tip comes back a little
        var up = [0, -1];
        // SWEEP leans the whole taper: up lifts it, down drops it, back and
        // forward pull it along the body
        var lift = cSweep === 'up' ? 1.6 : cSweep === 'down' ? -0.6 : 1;
        var along0 = cSweep === 'back' ? (parent.onFlow ? mul(parent.dir, -1) : [-spine.fx, 0]) : cSweep === 'forward' ? (parent.onFlow ? parent.dir : [spine.fx, 0]) : null;
        var dd = along0 ? norm(add(mul(d, 0.6), mul(along0, 0.8))) : d;
        var mid = add(add(root, mul(dd, L * (cCurl ? 0.55 : 0.5))), mul(up, L * (cCurl ? 0.5 : 0.28) * lift));
        // CURL: the tip climbs above the mid and comes back over it toward
        // the body, so the taper bends on itself rather than pointing away
        var tip = cCurl ? add(add(root, mul(dd, L * 0.4)), mul(up, L * 0.98 * lift))
          : add(add(root, mul(dd, L * 0.95)), mul(up, L * 0.55 * (child.size === 'tiny' ? 0.3 : 1) * lift));
        var iRoot = light(root, child.id, Math.min(pri, PRI.diagnostic), [], 'root', anchor);
        var iMid, iTip;
        if (cFlare) {
          // FLARE: the tip is a fork — two lights across the taper's own
          // direction, each joined to the mid and to each other
          iMid = light(mid, child.id, Math.min(pri, PRI.diagnostic), [iRoot], 'mid', iRoot);
          var across = perp(norm(sub(tip, mid)));
          var fa = light(add(tip, mul(across, L * 0.3)), child.id, pri, [iMid], 'fork tip', iMid);
          var fb = light(add(tip, mul(across, -L * 0.3)), child.id, pri, [iMid], 'fork tip', iMid);
          join(anchor, iRoot, 'attach'); join(iRoot, iMid, 'taper'); join(iMid, fa, 'flare'); join(iMid, fb, 'flare'); join(fa, fb, 'flare');
          iTip = fa;
        } else {
          iTip = light(tip, child.id, pri, [iRoot], 'tip', iRoot);
          iMid = light(mid, child.id, cCurl ? Math.min(pri, PRI.diagnostic) : PRI.extra + (survive[child.id] ? 0 : 2), [iRoot, iTip], 'mid', iRoot);
          join(anchor, iRoot, 'attach'); join(iRoot, iMid, 'taper'); join(iMid, iTip, 'taper');
          // when the mid is dropped the root still meets the tip
          cands[iMid].fallbackJoin = [iRoot, iTip];
        }
        if (cOutline) {
          // OUTLINE: a base width across the root, each edge joined to the
          // mid — the taper is a shape with a body, not a line
          var acrossR = perp(d);
          var oa = light(add(root, mul(acrossR, r * 0.7)), child.id, Math.min(pri, PRI.diagnostic) + 1, [iRoot], 'edge', iRoot);
          var ob = light(add(root, mul(acrossR, -r * 0.7)), child.id, Math.min(pri, PRI.diagnostic) + 1, [iRoot], 'edge', iRoot);
          join(anchor, oa, 'outline'); join(anchor, ob, 'outline'); join(oa, iMid, 'outline'); join(ob, iMid, 'outline');
        }
        placed[child.id].c = mid;
      } else if (kind === 'span') {
        // a wing, a fin, an ear: from a root on the parent to a tip, with a
        // trailing corner so the span has a shape. WHERE it reaches is the
        // SIDE's: a span on the left reaches left and up, on the right,
        // right and up; a span on the back leans back, from the top it
        // rises, from the front it reaches forward — and it always rises,
        // never dropping below its root (the first draft sent a second wing
        // downward, measured). A span on BOTH sides is a MIRRORED PAIR
        // across the figure — the first real round gave a dragon whose
        // wings the model called symmetric ONE wing, reaching back, because
        // the pair was a side-view afterthought filed under EXTRA.
        var back = [-spine.fx, 0], up = [0, -1], fwd = [spine.fx, 0];
        var lateral = side === 'left' || side === 'right';
        // A PAIR IS MIRRORED ACROSS THE FLOW ONLY WHERE THE VIEWER SEES BOTH
        // SIDES — a spine standing upright or facing the viewer. On a side
        // view (a horizontal spine) the far one of a pair leaves the same
        // root more steeply; reflecting it across the spine would put one
        // wing above the body and one below it (measured on an elephant's
        // ears). A mass already given a lateral side IS one of a pair.
        var seesBoth = !parent.onFlow || Math.abs(parent.dir[1]) >= Math.abs(parent.dir[0]);
        var mirrored = !lateral && seesBoth && (side === 'both' || side === 'around' || !!capOf(child.id, 'mirror'));
        if (!lateral && !mirrored && capOf(child.id, 'mirror')) sym = true;
        var lean = lateral || mirrored ? add(mul(lateral ? d : mirrorAxis(parent), 1), mul(up, 0.75))
          : side === 'top' ? add(mul(back, 0.5), mul(up, 1)) : side === 'front' ? add(mul(fwd, 1), mul(up, 0.5)) : add(mul(back, 1), mul(up, 0.75));
        // SWEEP: the tip falls behind the shoulder (back), reaches ahead
        // (forward), rises (up) or droops (down) — the one line a swept
        // wing has and a level one does not
        // "back" and "forward" are along the FLOW the span leaves — behind
        // the shoulder is toward the root end of the spine, not world-left
        var rearward = parent.onFlow ? mul(parent.dir, -1) : back, ahead = parent.onFlow ? parent.dir : fwd;
        if (cSweep === 'back') lean = add(lean, mul(rearward, 1.3));
        else if (cSweep === 'forward') lean = add(lean, mul(ahead, 1.3));
        else if (cSweep === 'up') lean = add(lean, mul(up, 1.4));
        else if (cSweep === 'down') lean = add(add(lean, mul(up, -1.2)), [0, 0.6]);
        var reach = norm(lean);
        var spanRoot = mirrored ? add(parent.c, mul(mirrorAxis(parent), parent.r * 0.6)) : root;
        var spanAnchor = mirrored ? nearestPoint(parentMass.id, spanRoot) : anchor;
        function oneSpan(r0, reachV, along, tipPri, cornerPri, label) {
          var tipS = add(r0, mul(reachV, L * 1.15));
          var corner = add(r0, mul(norm(add(mul(reachV, 0.35), mul(along, 1))), L * 0.7));
          var iR = light(r0, child.id, Math.min(pri, PRI.diagnostic), [], 'root' + label, spanAnchor);
          var iT = light(tipS, child.id, tipPri, [iR], 'tip' + label, iR);
          // OUTLINE: the trailing corner is silhouette, kept with the tip,
          // and a second root closes the shape back onto the body — a
          // leading edge AND a trailing edge, a wing rather than a stick
          var iC = light(corner, child.id, cOutline ? Math.min(pri, PRI.diagnostic) + 1 : cornerPri, [iR, iT], 'trailing corner' + label, iR);
          join(spanAnchor, iR, 'attach'); join(iR, iT, 'span'); join(iT, iC, 'span');
          if (cOutline) {
            var r2 = add(r0, mul(norm(along), Math.max(0.1, parent.r * 0.7)));
            var a2 = nearestPoint(parentMass.id, r2);
            var iR2 = light(r2, child.id, Math.min(pri, PRI.diagnostic) + 1, [iR], 'trailing root' + label, iR);
            join(iC, iR2, 'outline'); join(iR2, iR, 'outline'); join(a2, iR2, 'attach');
          } else join(iC, iR, 'span');
          return { root: iR, tip: iT, tipAt: tipS };
        }
        var along1 = lateral || mirrored ? (mirrored ? mirrorAxis(parent) : d) : (side === 'front' ? fwd : back);
        var first = oneSpan(spanRoot, reach, along1, pri, PRI.extra + 2, '');
        if (mirrored) {
          // the other wing: the same span reflected across the spine
          var m = mirrorAxis(parent);
          var reach2 = reflect(reach, parent.dir), along2 = mul(m, -1);
          var r2 = add(parent.c, mul(m, -parent.r * 0.6));
          spanAnchor = nearestPoint(parentMass.id, r2);
          oneSpan(r2, reach2, along2, pri, PRI.extra + 2, ' (other side)');
        } else if (sym) {
          // a side view of a pair: the far span leaves the same root more
          // steeply — a refinement, kept only when the budget allows
          var steep = norm(add(mul(reach, 0.45), mul(up, 1)));
          var iT2 = light(add(spanRoot, mul(steep, L * 1.05)), child.id, PRI.extra + 1, [first.root], 'second tip', first.root);
          join(first.root, iT2, 'span');
        }
        placed[child.id].c = first.tipAt;
      } else if (kind === 'branch') {
        // limbs. Toward the ground (bottom, or unspecified under a standing
        // figure): two feet under the parent, spread along its flow. Out to
        // a side (front, back, left, right, both): a limb reaching that way
        // and a little down, and a mirrored pair for BOTH — the first real
        // round put a dragon's ARMS, filed as front-and-symmetric, under its
        // feet, because every branch was a leg.
        var feetPri = plan.gesture.kind === 'grounded' || plan.gesture.kind === 'reaching' || plan.gesture.kind === 'upright' || plan.gesture.kind === 'seated' ? Math.min(pri, PRI.groundedFeet) : pri;
        if (side === 'bottom' || side === 'top') {
          var along = parent.onFlow ? parent.dir : [1, 0];
          var drop = side === 'top' ? [0, -1] : [0, 1];
          var spreadV = Math.abs(along[0]) > Math.abs(along[1]) ? [1, 0] : [1, 0];
          var half = Math.max(parent.r * 0.7, (parent.extent || 0) * 0.38);
          var f1 = add(add(parent.c, mul(spreadV, half)), mul(drop, parent.r + L * 0.7));
          var f2 = add(add(parent.c, mul(spreadV, -half)), mul(drop, parent.r + L * 0.7));
          var a1 = nearestPoint(parentMass.id, f1), a2 = nearestPoint(parentMass.id, f2);
          var i1 = light(f1, child.id, feetPri, [], 'foot', a1);
          var i2 = light(f2, child.id, feetPri, [], 'foot', a2);
          join(a1, i1, 'limb'); join(a2, i2, 'limb');
        } else {
          var downish = [0, 1];
          var limbs = side === 'both' || side === 'around' ? [mirrorAxis(parent), mul(mirrorAxis(parent), -1)] : [d];
          limbs.forEach(function (dv, li) {
            var r0 = add(parent.c, mul(dv, parent.r));
            var end = add(add(r0, mul(dv, L * 0.85)), mul(downish, L * 0.35));
            var aL = nearestPoint(parentMass.id, r0);
            var iE = light(end, child.id, li === 0 ? Math.min(pri, feetPri) : Math.min(pri, feetPri), [], 'limb end' + (li ? ' (other side)' : ''), aL);
            join(aL, iE, 'limb');
          });
        }
      } else if (kind === 'terminal') {
        // one small thing at the end of something; a pair spreads across
        var tipT = add(root, mul(d, Math.max(0.12, L * 0.5)));
        if (cFlare && !sym) {
          // FLARE: the terminal widens into two, joined — a fan, a fork
          var acrossT = perp(d);
          var iBase = light(add(root, mul(d, L * 0.2)), child.id, Math.min(pri, PRI.diagnostic), [], 'base', anchor);
          var fa2 = light(add(tipT, mul(acrossT, L * 0.35)), child.id, pri, [iBase], 'flare tip', iBase);
          var fb2 = light(add(tipT, mul(acrossT, -L * 0.35)), child.id, pri, [iBase], 'flare tip', iBase);
          join(anchor, iBase, 'attach'); join(iBase, fa2, 'flare'); join(iBase, fb2, 'flare'); join(fa2, fb2, 'flare');
        } else if (sym) {
          var across = perp(d);
          var i1t = light(add(tipT, mul(across, parent.r * 0.45)), child.id, pri, [], 'tip', anchor);
          var i2t = light(add(tipT, mul(across, -parent.r * 0.45)), child.id, pri + 1, [], 'tip', anchor);
          join(anchor, i1t, 'attach'); join(anchor, i2t, 'attach');
        } else {
          var iTt = light(tipT, child.id, pri, [], 'tip', anchor);
          join(anchor, iTt, 'attach');
        }
      } else if (kind === 'enclosure') {
        // a ring around the parent: three lights, looped, one spoke to the parent
        // wide enough to clear the parent's own width lights (at 1.45 the
        // ring's side lights fell onto them and the enclosure vanished)
        var R = parent.r * 1.85;   // for a mass off the flow; a flow mass's ring follows its real edge, per light
        // centred on the parent's OUTWARD direction (the head end of the flow
        // faces away from the body), so the ring stands around the outside of
        // the mass rather than between it and its neighbour
        // — unless the plan NAMES a side, in which case the ring stands on
        // that side of the mass (a crescent on the right of a bird is not
        // a ring about its head — measured, it landed on the head)
        var named = side !== 'around' && side !== 'both' && rel.side;
        var base = named ? Math.atan2(d[1], d[0]) : parent.onFlow ? Math.atan2(parent.dir[1], parent.dir[0]) : -Math.PI / 2;
        var ring = [];
        [-Math.PI * 0.5, 0, Math.PI * 0.5].forEach(function (a, i) {
          var ang = base + a;
          var dv = [Math.cos(ang), Math.sin(ang)];
          var Ri = Math.max(R, reachOf(parent, dv) + Math.max(0.14, parent.r * 0.6));
          ring.push(light(add(parent.c, mul(dv, Ri)), child.id, pri + (i === 1 ? 0 : 1), [], 'ring', i === 1 ? anchor : null));
        });
        join(ring[0], ring[1], 'ring'); join(ring[1], ring[2], 'ring');
        join(anchor, ring[1], 'attach');
        cands[ring[1]].needs = []; cands[ring[0]].needs = [ring[1]]; cands[ring[2]].needs = [ring[1]];
        cands[ring[0]].hang = ring[1]; cands[ring[2]].hang = ring[1];
      } else if (kind === 'flow') {
        // a second run of body leaving the first (a torso rising from a horse
        // body): root at the parent, a tip L away, straight, so a head can sit on it
        var iRf = light(root, child.id, Math.min(pri, PRI.transition), [], 'root', anchor);
        var iTf = light(add(root, mul(d, L)), child.id, Math.min(pri, PRI.transition), [iRf], 'tip', iRf);
        join(anchor, iRf, 'attach'); join(iRf, iTf, 'flow');
        placed[child.id] = { c: add(root, mul(d, L / 2)), r: r, dir: d, points: [iRf, iTf], onFlow: true };
        placed[child.id].points = [iRf, iTf];
      } else {
        // a plain mass hanging off another: one light at its centre — or,
        // LOBED, two lights across its far edge joined to each other
        var cM = add(root, mul(d, r));
        if (capOf(child.id, 'lobe')) {
          var acrossM = perp(d);
          var la = light(add(add(root, mul(d, r * 1.4)), mul(acrossM, r * 0.9)), child.id, pri, [], 'lobe edge', anchor);
          var lb = light(add(add(root, mul(d, r * 1.4)), mul(acrossM, -r * 0.9)), child.id, pri, [], 'lobe edge', anchor);
          join(anchor, la, 'attach'); join(anchor, lb, 'attach'); join(la, lb, 'lobe');
        } else {
          var iM = light(cM, child.id, pri, [], 'centre', anchor);
          join(anchor, iM, 'attach');
        }
        placed[child.id].c = cM;
      }
    }

    // ---- 3. the budget, and which lights are kept ----
    // THE BUDGET IS AUTOMATIC. Complexity sets how much room a figure
    // gets beyond its essentials; the essentials — the spine and every
    // light that gives a must-survive mass its existence — set the floor,
    // so a plan that names five things that must survive is never told
    // "simple" means four of them go. The ceiling is the runtime's own.
    var cap = CAPS[plan.complexity] || CAPS.moderate;
    var floor = cands.filter(function (c) { return c.pri <= PRI.survive; }).length;
    cap = Math.min(BUDGETS[BUDGETS.length - 1], Math.max(cap, floor));
    if (opts.cap) cap = Math.min(cap, opts.cap);
    var order = cands.map(function (c, i) { return i; }).sort(function (a, b) { return cands[a].pri - cands[b].pri || a - b; });
    var kept = {};
    var count = 0;
    order.forEach(function (i) {
      if (kept[i] || cands[i].skip) return;
      var need = [i].concat(cands[i].needs.filter(function (n) { return !kept[n] && !cands[n].skip; }));
      if (need.some(function (n) { return cands[n].skip; })) return;
      if (count + need.length > cap) return;
      need.forEach(function (n) { kept[n] = true; });
      count += need.length;
    });
    // dependencies: a light whose needs were not kept is dropped with them
    var changed = true;
    while (changed) {
      changed = false;
      Object.keys(kept).forEach(function (i) { if (cands[i].needs.some(function (n) { return !kept[n]; })) { delete kept[i]; changed = true; } });
    }

    // ---- 4. collect, merge, join ----
    var index = {};
    var points = [], roles = [], tags = [], massOf = [];
    order.forEach(function (i) {
      if (!kept[i]) return;
      // merge with a kept light standing on the same spot
      var dup = -1;
      for (var j = 0; j < points.length; j++) if (dist(points[j], cands[i].p) < MERGE) { dup = j; break; }
      if (dup !== -1) { index[i] = dup; log.push('light for "' + cands[i].mass + '" (' + cands[i].tag + ') merged into light ' + dup); return; }
      index[i] = points.length;
      points.push(cands[i].p.slice()); roles.push(byId[cands[i].mass] ? (byId[cands[i].mass].label || cands[i].mass) : cands[i].mass); tags.push(cands[i].tag); massOf.push(cands[i].mass);
    });
    var edges = {};
    function addEdge(a, b, why) {
      if (a == null || b == null) return;
      var ia = index[a], ib = index[b];
      if (ia === undefined || ib === undefined || ia === ib) return;
      var key = Math.min(ia, ib) + '-' + Math.max(ia, ib);
      if (!edges[key]) edges[key] = { a: Math.min(ia, ib), b: Math.max(ia, ib), why: why };
    }
    // A JOIN NEVER DIES WITH THE LIGHT IT WAS MADE TO. A kept light whose
    // partner was dropped joins what THAT light hung from, and so on up,
    // until a kept light — so a figure is one piece by construction (the
    // first real round left a quill pen floating beside its bird when the
    // arm holding it was dropped for budget).
    function climb(i, seen) {
      seen = seen || {};
      while (i != null && index[i] === undefined && !seen[i]) { seen[i] = true; i = cands[i].hang; }
      return i != null && index[i] !== undefined ? i : null;
    }
    joins.forEach(function (j) {
      var a = index[j.a] === undefined ? climb(j.a) : j.a, b = index[j.b] === undefined ? climb(j.b) : j.b;
      if (a == null || b == null) return;
      addEdge(a, b, (index[j.a] === undefined || index[j.b] === undefined) ? j.why + ' (rejoined)' : j.why);
    });
    // a dropped mid-light: its neighbours meet directly
    cands.forEach(function (c, i) { if (!kept[i] && c.fallbackJoin) addEdge(c.fallbackJoin[0], c.fallbackJoin[1], 'taper (mid dropped)'); });
    var joinList = Object.keys(edges).map(function (k) { return edges[k]; });

    // ---- 5. fit the sky ----
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    var w = Math.max(0.2, maxX - minX), h = Math.max(0.2, maxY - minY);
    var scale = (2 * FIT) / Math.max(w, h);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    points = points.map(function (p) { return [Math.round((p[0] - cx) * scale * 100) / 100, Math.round((p[1] - cy) * scale * 100) / 100]; });

    // ---- 6. diagnostics ----
    var budget = BUDGETS.filter(function (b) { return b >= points.length; })[0] || BUDGETS[BUDGETS.length - 1];
    // a mass is dropped when NO kept light is its — a light it shares with
    // another mass (a fin on the very tip of a tail) is still its light
    var dropped = plan.masses.filter(function (m) { if (capOf(m.id, 'revealOnly')) return false; var pl = placed[m.id]; return !pl || !pl.points.some(function (i) { return index[i] !== undefined; }); }).map(function (m) { return m.id; });
    var usedCaps = {};
    Object.keys(caps).forEach(function (id) { Object.keys(caps[id] || {}).forEach(function (k) { if (k !== 'revealOnly' && byId[id]) usedCaps[k] = true; }); });
    var diag = {
      candidates: cands.length, kept: points.length, cap: cap, budget: budget,
      vocabulary: { mode: opts.caps ? 'extended' : 'base', capabilities: Object.keys(usedCaps), revealOnly: revealOnlyIds },
      order: ['gesture', 'silhouette', 'structure', 'diagnostic', 'reveal-only'],
      components: components(points.length, joinList),
      crossings: crossings(points, joinList),
      dropped: dropped, merged: log.filter(function (l) { return /merged|shares the light/.test(l); }).length,
      notes: log,
      allocation: points.map(function (p, i) { return { light: i, mass: massOf[i], tag: tags[i], p: p }; })
    };
    return { ok: true, points: points, roles: roles, joins: joinList, budget: budget, masses: massOf, gesture: plan.gesture.kind, diagnostics: diag };
  }

  // ---------------------------------------------------------------
  // graph checks
  // ---------------------------------------------------------------
  function components(n, joins) {
    var parent = []; for (var i = 0; i < n; i++) parent.push(i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    joins.forEach(function (j) { var a = find(j.a), b = find(j.b); if (a !== b) parent[a] = b; });
    var roots = {}; for (var k = 0; k < n; k++) roots[find(k)] = true;
    return n ? Object.keys(roots).length : 0;
  }
  function segsCross(p1, p2, p3, p4) {
    function o(a, b, c) { var v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]); return v > 1e-9 ? 1 : v < -1e-9 ? 2 : 0; }
    var o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
    return o1 !== o2 && o3 !== o4 && o1 && o2 && o3 && o4;
  }
  function crossings(points, joins) {
    var n = 0;
    for (var i = 0; i < joins.length; i++) for (var j = i + 1; j < joins.length; j++) {
      var a = joins[i], b = joins[j];
      if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
      if (segsCross(points[a.a], points[a.b], points[b.a], points[b.b])) n++;
    }
    return n;
  }

  var api = {
    SIZES: SIZES, WEIGHTS: WEIGHTS, TREAT: TREAT, CAPS: CAPS, BUDGETS: BUDGETS.slice(), FIT: FIT, MERGE: MERGE,
    PRIMITIVES: ['flow', 'mass', 'taper', 'span', 'branch', 'terminal', 'enclosure', 'transition', 'attachment'],
    compose: compose, spineFor: spineFor, components: components, crossings: crossings
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabEtherComposer = api;
  else global.LabEtherComposer = api;
})(typeof window !== 'undefined' ? window : this);
