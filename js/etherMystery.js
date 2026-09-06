// etherMystery.js — the approved experience pool and the deterministic
// interpreter that performs validated experience DATA in the Ether.
//
// SPRINT — Generative Mystery & Challenge Engine.
//
// WHAT THIS LAYER IS. A provider, exactly as js/etherLife.js and
// js/etherRipple.js are providers: it owns HOW a generated Mystery
// looks and moves — fragments of a creation's public cover, faint
// stars, small lights, a soft veil, a joining line — and it gives up
// every WHEN/WHETHER decision to the Experience Composer
// (js/etherExperience.js), which remains the one runtime authority.
// This file has no scheduler, offers nothing unprompted, and begins an
// experience only when the Composer asks it to.
//
// WHAT IT PERFORMS IS DATA, NEVER CODE. The pool
// (assets/ether/experience-pool.js) holds candidate experiences in the
// strict schema js/etherGrammar.js defines. Every entry is validated
// AGAIN at load — an entry that fails, whatever file it arrived in, is
// refused with its reasons named and can never be selected. The
// interpreter reads only schema fields and performs only the approved
// capability vocabulary; there is nothing here that could execute a
// generated string, and no model, no generator and no network exists
// anywhere in this file. Generation is an asynchronous, offline
// concern (tools/ether-mystery-lab/); a child's tap never waits on
// anything but this code.
//
// ONE MYSTERY AT A TIME, BOUNDED IN EVERYTHING: at most one live
// instance, a hard ceiling on placed things, a hard lifetime after
// which an untaken Mystery dissolves (unresolved is a first-class
// ending), a bounded effects list, one canvas, one image. Nothing
// accumulates across experiences and nothing survives the page —
// a Traveller is stateless (Decision 19) and no storage API appears
// in this file.
//
// HOW A CHILD ENGAGES — the approved interaction vocabulary only:
// tap (generous radius, touch first-class), approach (turning until
// near — the creatures' own notice grammar, requiring a recent act),
// dwell (looking a while), return (leaving and coming back this
// visit), wait. Nothing needs hover, a keyboard, precision or speed.
// A tap that lands on a posed Mystery belongs to the Mystery — the
// Composer asks this layer first, before its own touch answers.
//
// HOW IT PLUGS IN. One canvas beneath the story plane, pointer-events
// none, reading only the seams the runtime already exposes (ether,
// camera.offsetFor, stories.all, traveller.stillSeconds, focus,
// isRunning). No file under vihuplanet/runtime/ is edited — Decision
// 9's own test — and nothing is ever written to an entity: a revealed
// creation is answered with light drawn HERE at the Spirit's place,
// the jellyfish's own precedent.

(function (global) {
  'use strict';

  var LIMITS = {
    pieces: 10,          // total placed things, hard ceiling
    effects: 4,          // transient lights at once
    lifeS: 90,           // default seconds before an untaken mystery dissolves
    fadeS: 2.4,          // seconds the closing fade takes
    appearS: 2.0,        // seconds an element takes to arrive
    outcomesKept: 24,    // diagnostics ring bound
    wanderers: 2         // completed figures roaming the sky at once
  };

  // THE UNFINISHED PATTERN — the one primitive that makes the
  // canonical experience expressible: a figure of lights, some joined
  // and some not, that a child can read and complete.
  //
  // WHY IT IS ITS OWN THING AND NOT A DRESSED-UP 'mark'. Measured on
  // the shipped pool: 'mark' and 'glint' draw with the SAME sprite as
  // the ambient star field, so the more faithfully the interpreter
  // performs them the better they hide — 0.002-0.007% of the screen.
  // The largest primitive before this was the veil at 156px on a
  // ~1650px diagonal. A pattern is a FIGURE rather than a thing: its
  // ring spans about two thirds of the short edge, so what a child
  // notices is an arrangement, at Ether scale, from across the sky.
  //
  // EVERY NUMBER IS A FRACTION OF THE SKY, never a pixel constant, so
  // a phone gets a pattern that fills its screen exactly as a laptop
  // does. Measured: short edge 900 -> 306px radius (a 612px figure);
  // short edge 390 -> 140px radius (a 280px figure, 72% of the width).
  var PATTERN = {
    radiusFrac: 0.34,    // of the short edge
    radiusMin: 140,      // never smaller than a phone's own figure
    radiusMax: 420,      // never so large the whole of it cannot be seen
    squash: 0.82,        // a little flatter than a circle, so it fits
    jitter: 0.05,        // radians — hand-drawn, never mechanical
    coreFrac: 0.017,     // node core, of the short edge
    coreMin: 7,
    coreMax: 16,
    joinS: 0.55,         // a new link draws itself over this long
    igniteS: 1.6,        // the completed figure blazes for this long
    // A COMPLETED FIGURE IS NOT DISMISSED. It stays, blazes, takes a
    // breath, and only then leaves under its own power — long enough
    // for a child to understand that they did not make it disappear.
    wakeS: 4.4,
    // AND THEN IT ROAMS. Every number here is about a living thing
    // looking around rather than a reward travelling to a destination:
    // a slow speed, a heading that wanders, and real pauses.
    roam: {
      // IT SETS OFF, AND THEN IT EXPLORES. Measured on the first
      // build: a pure wander at 0.42 rad/s curled back on itself and
      // covered 73px in sixteen seconds — which reads as drifting in
      // place, not as leaving. So the first leg holds one heading and
      // is quicker (it is going somewhere), and only then does the
      // heading start to wander (it is looking around).
      departS: 3.5,
      departSpeed: 30,
      departTurn: 0.35,            // even setting off, it is not a ruler
      speedMin: 13, speedMax: 26,  // field px per second, afterwards
      turn: 0.3,                   // radians per second of wandering
      // AND ITS OWN GENTLE BIAS. Measured: the wander is two summed
      // sines whose phase comes from the wanderer's seed, and for some
      // seeds that sum sits near zero for ten seconds — so whether the
      // thing curved at all was a coin toss, and a straight line is
      // exactly what it must never draw. A small per-wanderer curl
      // means every one of them arcs, and no seed produces a ruler.
      curl: 0.11,                  // radians per second, its own way
      restEvery: [8, 16],          // seconds between pauses
      restFor: [3, 8],             // and how long it stops to look
      settleS: 3.2,                // waking brightness eases to resting
      restGlow: 0.58,
      swim: 0.13,                  // how much the figure undulates
      // A SHAPE GATHERS ITSELF UP WHEN IT WAKES. The posed figure is
      // spread out to be read across the sky; a living thing is not a
      // diagram, so it draws in as it comes alive — which is the
      // clearest thing on screen that says it CHANGED rather than
      // simply carried on.
      gather: 0.72,
      breath: 0.045,
      leaveS: 6                    // an evicted wanderer drifts out
    },
    sweepFrac: 0.72      // the awakening's ring, of the view diagonal
  };

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function hexRgb(hex) {
    var h = String(hex || '#F1EAD0').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }
  function makeSprite(doc, rgb) {
    var c = doc.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, rgba(rgb, 0.9));
    grad.addColorStop(0.35, rgba(rgb, 0.34));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  // ---------------------------------------------------------------
  // Pool loading: re-validate everything, refuse what fails, and say
  // why. The pool file is data shipped with the application (the
  // canon-repository pattern) — no fetch, no network, no wait.
  // ---------------------------------------------------------------
  function loadPool(poolData, grammar) {
    var report = [];
    var active = [];
    var entries = (poolData && Array.isArray(poolData.experiences))
      ? poolData.experiences : [];
    var signatures = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i] || {};
      var cand = e.candidate;
      var v = grammar.validate(cand, { existing: signatures });
      var row = {
        id: (cand && cand.id) || 'entry-' + i,
        status: e.status || 'unknown',
        source: e.source || 'unknown',
        ok: v.ok,
        reasons: v.reasons
      };
      report.push(row);
      if (!v.ok) continue;
      signatures.push(grammar.signature(cand));
      if (e.status !== 'active') continue;   // retired/rejected: never selectable
      active.push({ id: cand.id, candidate: cand, source: row.source });
    }
    return { report: report, active: active };
  }

  function mount(universe, opts) {
    opts = opts || {};
    if (!universe || !universe.root || !universe.ether || !universe.camera) return null;

    var VihuPlanet = global.VihuPlanet;
    var Util = VihuPlanet && VihuPlanet.Util;
    var Env = VihuPlanet && VihuPlanet.Env;
    var grammar = opts.grammar || global.EtherGrammar;
    var lens = opts.lens || global.EtherCreationLens;
    if (!Util || !grammar || !lens) return null;

    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function off(evt, fn) {
      var l = listeners[evt];
      if (l) { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
    }
    function emit(evt, payload) {
      var l = listeners[evt];
      if (!l) return;
      for (var i = 0; i < l.length; i++) {
        try { l[i](payload); } catch (e) {}
      }
    }

    var reduced = !!(Env && Env.reducedMotion && Env.reducedMotion());
    var poolData = opts.pool || global.EtherExperiencePool || null;
    var loaded = loadPool(poolData, grammar);

    var debug = false;
    try { debug = /[?&]etherdebug=1/.test(global.location.search); } catch (e) {}
    function dlog(what) {
      if (debug) { try { console.info('[ether-mystery]', what); } catch (e) {} }
    }
    loaded.report.forEach(function (r) {
      if (!r.ok) dlog({ loadRejected: r.id, reasons: r.reasons });
    });

    // Reduced motion: a generated mystery is unrequested motion, so
    // the whole layer mounts inert — a real API that never performs,
    // so no caller branches (the creature layer's own rule).
    if (reduced) {
      return {
        quiet: true,
        poolReport: function () { return loaded.report.slice(); },
        candidates: function () {
          return { offer: [], refused: loaded.active.map(function (a) {
            return { id: a.id, because: 'reduced-motion' };
          }) };
        },
        begin: function () { return null; },
        live: function () { return null; },
        wanderers: function () { return []; },
        touchAt: function () { return false; },
        instrument: function () { return null; },
        diagnostics: function () { return { quiet: true, pool: loaded.report.slice() }; },
        setTimeScale: function () {},
        on: on, off: off,
        destroy: function () { emit('destroyed', {}); }
      };
    }

    var ether = universe.ether;
    var camera = universe.camera;
    var life = opts.life || null;   // for blooms and long marks only

    // ---------- the canvas: beneath the story plane ----------
    var canvas = global.document.createElement('canvas');
    canvas.className = 'vp-ether-mystery';
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var storyLayerEl = universe.root.querySelector('.vp-story-layer');
    if (storyLayerEl) universe.root.insertBefore(canvas, storyLayerEl);
    else universe.root.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var dpr = (Env && Env.dpr) ? Env.dpr() : 1;
    function sizeCanvas() {
      canvas.width = Math.max(1, Math.round(ether.viewWidth * dpr));
      canvas.height = Math.max(1, Math.round(ether.viewHeight * dpr));
    }
    sizeCanvas();
    universe.on('ether:resized', sizeCanvas);

    var starRgb = hexRgb(ether.palette && ether.palette.star);
    var glowRgb = hexRgb(ether.palette && ether.palette.glow);
    var starSprite = makeSprite(global.document, starRgb);
    var glowSprite = makeSprite(global.document, glowRgb);

    // ---------- session state (dies with the page) ----------
    var inst = null;           // the one live instance, or null
    // A COMPLETED FIGURE OUTLIVES ITS MYSTERY. Wanderers are not part
    // of the instance and are not effects: an effect is a transient
    // light with a duration, and this is a living thing that stays in
    // the sky for the rest of the visit. Bounded (LIMITS.wanderers)
    // rather than unlimited, because nothing in this layer may ever
    // accumulate — but bounded is not the same as temporary.
    var wanderers = [];
    var effects = [];          // transient lights, bounded
    var outcomes = [];         // diagnostics ring
    var time = 0;
    var timeScale = 1;
    var destroyed = false;
    var camScratch = { x: 0, y: 0 };

    function nearestCopy(v, span, centre) {
      if (!(span > 0)) return v;
      return v - Math.round((v - centre) / span) * span;
    }
    function stillNow() {
      try {
        return (universe.traveller && universe.traveller.stillSeconds)
          ? universe.traveller.stillSeconds() : 0;
      } catch (e) { return 0; }
    }
    function portalOpen() {
      try { return universe.focus && universe.focus.isOpen(); } catch (e) { return false; }
    }
    function shortEdge() { return Math.min(ether.viewWidth, ether.viewHeight); }
    function lookPoint() {
      var cam = camera.offsetFor(ether.depth.stories, camScratch);
      return { x: ether.viewWidth * 0.5 - cam.x, y: ether.viewHeight * 0.5 - cam.y };
    }

    // ---------- creation binding ----------
    // Which public creation could serve this candidate right now.
    // Preference is the discovery composition's own: far and unmet —
    // something already in front of the child is not a mystery.
    function findCreation(cand) {
      var ing = (cand && cand.ingredients) || {};
      if (ing.creation !== true) return null;
      var entities = [];
      try { entities = universe.stories.all() || []; } catch (e) { return null; }
      var best = null, bestFit = -1;
      for (var i = 0; i < entities.length; i++) {
        var p = lens.project(entities[i]);
        if (!p) continue;
        if (typeof ing.minPages === 'number' && p.pages < ing.minPages) continue;
        var prox = entities[i].prox || 0;
        var fit = (1 - prox) + Math.random() * 0.25;
        if (fit > bestFit) { bestFit = fit; best = { projection: p, entity: entities[i] }; }
      }
      return best;
    }

    // ---------- candidates: what could be offered right now ----------
    // The Composer applies phase, novelty, rarity and quiet on top;
    // this only answers availability, with reasons.
    function candidates() {
      var offer = [], refused = [];
      if (inst) {
        loaded.active.forEach(function (a) {
          refused.push({ id: a.id, because: 'mystery-live' });
        });
        return { offer: offer, refused: refused };
      }
      loaded.active.forEach(function (a) {
        var c = a.candidate;
        var ing = c.ingredients || {};
        if (ing.creation === true && !findCreation(c)) {
          refused.push({ id: a.id, because: 'no-suitable-creation' });
          return;
        }
        var con = c.constraints || {};
        offer.push({
          id: 'mystery:' + c.grammar,     // novelty identity IS the grammar
          key: a.id,
          grammar: c.grammar,
          rarity: con.rarity || 'uncommon',
          outcome: ((c.outcome || {}).possible || [])[0] || 'unresolved',
          phases: con.phases || ['exploration', 'deep'],
          notBefore: con.notBefore || 0,
          needsAnchor: ing.anchor === true ? 60 : 0,
          oncePerVisit: con.oncePerVisit === true,
          expects: c.title || c.id
        });
      });
      return { offer: offer, refused: refused };
    }

    // ---------- placement ----------
    function placePoints(place, count, look, ctx2) {
      var pts = [];
      var short = shortEdge();
      var big = Math.max(ether.viewWidth, ether.viewHeight);
      var i, ang, d, base;
      if (place === 'scattered') {
        for (i = 0; i < count; i++) {
          ang = (i / count) * Math.PI * 2 + rand(-0.5, 0.5);
          d = short * rand(0.16, 0.42);
          pts.push({ x: look.x + Math.cos(ang) * d,
                     y: look.y + Math.sin(ang) * d * 0.72 });
        }
        return pts;
      }
      if (place === 'ring') {
        var r0 = short * rand(0.24, 0.32);
        var turn = rand(0, Math.PI * 2);
        for (i = 0; i < count; i++) {
          ang = turn + (i / count) * Math.PI * 2 + rand(-0.18, 0.18);
          pts.push({ x: look.x + Math.cos(ang) * r0,
                     y: look.y + Math.sin(ang) * r0 * 0.75 });
        }
        return pts;
      }
      if (place === 'toward-creation' && ctx2.creationAt) {
        var dx = ctx2.creationAt.x - look.x, dy = ctx2.creationAt.y - look.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var reach = Math.min(len, big * 0.7);
        for (i = 0; i < count; i++) {
          var f = (i + 1) / (count + 1);
          pts.push({ x: look.x + (dx / len) * reach * f + rand(-24, 24),
                     y: look.y + (dy / len) * reach * f + rand(-18, 18) });
        }
        return pts;
      }
      // Clustered placements: one drawn point, pieces jittered near it.
      if (place === 'at-anchor' && ctx2.anchor) {
        base = { x: ctx2.anchor.x, y: ctx2.anchor.y };
      } else if (place === 'far' || (place === 'at-anchor' && !ctx2.anchor) ||
                 place === 'toward-creation') {
        ang = rand(0, Math.PI * 2);
        d = big * rand(0.45, 0.72);
        base = { x: look.x + Math.cos(ang) * d, y: look.y + Math.sin(ang) * d * 0.6 };
      } else { // near-look
        ang = rand(0, Math.PI * 2);
        d = short * rand(0.14, 0.3);
        base = { x: look.x + Math.cos(ang) * d, y: look.y + Math.sin(ang) * d * 0.7 };
      }
      for (i = 0; i < count; i++) {
        pts.push({ x: base.x + rand(-40, 40), y: base.y + rand(-30, 30) });
      }
      return pts;
    }

    // Cover regions for shards: an n-piece grid over the cover.
    function coverRegions(n) {
      var cols = Math.ceil(Math.sqrt(n));
      var rows = Math.ceil(n / cols);
      var out = [];
      for (var i = 0; i < n; i++) {
        var cx2 = i % cols, cy2 = Math.floor(i / cols);
        out.push({
          sx: cx2 / cols, sy: cy2 / rows, sw: 1 / cols, sh: 1 / rows,
          // where this piece sits when the pieces come together
          slotX: (cx2 + 0.5) / cols - 0.5, slotY: (cy2 + 0.5) / rows - 0.5
        });
      }
      return out;
    }

    // ---------- the unfinished pattern ----------
    // Nodes are laid out as a FIGURE — evenly around a ring, or along
    // an open arc — rather than as scattered pieces, because the whole
    // tease is that the arrangement is obviously deliberate and just
    // as obviously not finished. Consecutive nodes are joined; a few
    // of those joins are LEFT OUT, and the gaps are drawn as nothing
    // at all. There is no dashed hint, no marker and no instruction:
    // a child sees a shape that wants to be whole.
    // `spec` is the candidate's own `arrangement` block — named that
    // rather than `pattern`, because in this product 'pattern' is a
    // Magic Card's constellation and a guarded key (js/etherGrammar.js
    // says why). The experience is still the Unfinished Pattern.
    function layoutPattern(spec, nodes, look) {
      var short = shortEdge();
      var r = clamp(short * PATTERN.radiusFrac, PATTERN.radiusMin, PATTERN.radiusMax);
      var n = nodes.length;
      // A FIGURE, WHEN THE ARRANGEMENT CARRIES ONE. Points and the
      // relationships between them, so the lights can stand in a way
      // that suggests they are SOMETHING before they are whole. It is
      // the same size, the same lights and the same two-tap joining;
      // only where the lights stand and what belongs to what differ.
      if (spec.figure && Array.isArray(spec.figure.points) &&
          spec.figure.points.length === n) {
        return layoutFigure(spec.figure, nodes, look, r);
      }
      var turn = rand(0, Math.PI * 2);
      var arc = spec.shape === 'arc';
      var span = arc ? Math.PI * 1.15 : Math.PI * 2;
      var i;
      for (i = 0; i < n; i++) {
        var f = arc ? (i / Math.max(1, n - 1)) : (i / n);
        var ang = turn + f * span + rand(-PATTERN.jitter, PATTERN.jitter);
        var el = nodes[i];
        el.x = el.home.x = look.x + Math.cos(ang) * r;
        el.y = el.home.y = look.y + Math.sin(ang) * r * PATTERN.squash;
        el.node = i;
        // THE FIGURE'S OWN SHAPE, kept in polar form. It is what wakes
        // and swims once the figure is whole, and it is the only thing
        // a wanderer inherits — a shape, not a mystery.
        el.polar = { ang: ang, r: r };
      }
      // Links join consecutive nodes; a ring closes, an arc does not.
      var links = [];
      var count = arc ? (n - 1) : n;
      for (i = 0; i < count; i++) {
        links.push({ a: i, b: (i + 1) % n, present: true, joinedAt: -1 });
      }
      // Which joins are missing. The validator already guarantees at
      // least two survive, so the figure can always still be read.
      var order = [];
      for (i = 0; i < links.length; i++) order.push(i);
      for (i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
      var missing = Math.min(spec.missing || 1, links.length - 2);
      for (i = 0; i < missing; i++) links[order[i]].present = false;
      return {
        shape: spec.shape, nodes: nodes, links: links,
        cx: look.x, cy: look.y, radius: r,
        missingLeft: missing, sel: null, igniteAt: -1
      };
    }

    // A FIGURE IS PLACED AS AUTHORED, at the ring's own scale. The
    // longest reach of the points becomes the radius the ring would
    // have had, so a figure is exactly as big on the sky as the shape
    // it replaces — on a phone as on a laptop, since the radius is a
    // fraction of the short edge either way.
    //
    // `polar` is stored PRE-SQUASHED: the waking beat and the wanderer
    // both rebuild a node as cos(ang)*r and sin(ang)*r*squash, so the
    // y is divided by squash here and multiplied back there. Without
    // that, a figure would change its proportions at the exact moment
    // it came alive — and what a child completed must be what wakes.
    function layoutFigure(fig, nodes, look, r) {
      var n = nodes.length, i;
      // Hand-set on the sky rather than mechanically level, and only a
      // little: a figure has an up, and losing it would cost the very
      // thing the points were authored for.
      var turn = rand(-0.09, 0.09);
      var ct = Math.cos(turn), st = Math.sin(turn);
      var reach = 0;
      for (i = 0; i < n; i++) {
        reach = Math.max(reach, Math.abs(fig.points[i][0]),
                                Math.abs(fig.points[i][1]));
      }
      var k = r / (reach || 1);
      for (i = 0; i < n; i++) {
        var px = fig.points[i][0] * k, py = fig.points[i][1] * k;
        var x = px * ct - py * st;
        var y = px * st + py * ct;
        var el = nodes[i];
        el.x = el.home.x = look.x + x;
        el.y = el.home.y = look.y + y;
        el.node = i;
        var ys = y / PATTERN.squash;
        el.polar = { ang: Math.atan2(ys, x), r: Math.sqrt(x * x + ys * ys) };
      }
      // The joins are the figure's own relationships — a body to a
      // limb, a limb to its tip — rather than "each light to the next
      // one round", which is why a figure may branch and a ring may
      // not.
      var links = [];
      for (i = 0; i < fig.joins.length; i++) {
        // "a-b" rather than [a, b]: a list of integer pairs is what a
        // Magic Card's constellation looks like, and the Stars scans
        // match that shape (js/etherGrammar.js says why).
        var ab = String(fig.joins[i]).split('-');
        links.push({ a: Number(ab[0]), b: Number(ab[1]),
                     present: true, joinedAt: -1 });
      }
      // WHICH joins are missing is authored, never drawn at random: on
      // a figure the gap is the missing piece of its identity.
      for (i = 0; i < fig.gaps.length; i++) {
        if (links[fig.gaps[i]]) links[fig.gaps[i]].present = false;
      }
      return {
        shape: 'figure', nodes: nodes, links: links,
        cx: look.x, cy: look.y, radius: r,
        missingLeft: fig.gaps.length, sel: null, igniteAt: -1
      };
    }

    // ---------- the figure comes alive ----------
    // THE COMPLETION IS THE BEGINNING OF THE DISCOVERY, NOT THE END OF
    // IT. A child who joins the last light has not solved a puzzle and
    // been paid; they have found out what the thing IS. So the figure
    // is never dissolved, never swapped for a reward, and never tidied
    // away: it takes a breath where it stands, and then it goes off
    // into the Ether under its own power. The question the child is
    // left holding is "where is it going?", which is the next mystery
    // rather than the end of this one.
    function awaken(pat) {
      // Only the SHAPE travels. A wanderer carries no candidate, no
      // grammar, no creation and no outcome — it is a living thing
      // now, and it knows nothing about having been a question.
      var pts = pat.nodes.map(function (el) {
        return { ang: el.polar.ang, r: el.polar.r, tw: el.tw };
      });
      var w = {
        pts: pts,
        links: pat.links.map(function (L) { return { a: L.a, b: L.b }; }),
        cx: pat.cx, cy: pat.cy,
        heading: rand(0, Math.PI * 2),
        speed: rand(PATTERN.roam.speedMin, PATTERN.roam.speedMax),
        seed: Math.random() * 1000,
        curl: (Math.random() < 0.5 ? -1 : 1) *
              rand(PATTERN.roam.curl * 0.6, PATTERN.roam.curl),
        t: 0, born: time,
        glow: 1,                       // eases to its resting brightness
        scale: PATTERN.roam.gather,    // already drawn in, from the wake
        rest: 0,
        restAt: rand(PATTERN.roam.restEvery[0], PATTERN.roam.restEvery[1]),
        leaving: -1
      };
      wanderers.push(w);
      // THE CEILING PUSHES THE OLDEST OUT SLOWLY, never abruptly: it
      // drifts on and dims rather than vanishing, so a child watching
      // one never sees the sky delete something.
      var alive = wanderers.filter(function (o) { return o.leaving < 0; });
      while (alive.length > LIMITS.wanderers) {
        alive.shift().leaving = time;
      }
      emit('mystery:alive', { nodes: pts.length, at: { x: w.cx, y: w.cy } });
      dlog({ alive: pts.length, at: { x: Math.round(w.cx), y: Math.round(w.cy) } });
      return w;
    }

    // ---------- begin: the Composer chose this experience ----------
    function begin(key, beginCtx) {
      if (inst || destroyed) return null;
      beginCtx = beginCtx || {};
      var entry = null;
      for (var i = 0; i < loaded.active.length; i++) {
        if (loaded.active[i].id === key) { entry = loaded.active[i]; break; }
      }
      if (!entry) return null;
      var c = entry.candidate;
      var ing = c.ingredients || {};

      var creation = null;
      if (ing.creation === true) {
        creation = findCreation(c);
        if (!creation) return null;
      }

      var look = beginCtx.look || lookPoint();
      var pctx = {
        anchor: beginCtx.anchor || null,
        creationAt: creation && creation.projection.at ? creation.projection.at : null
      };

      // Which roles the child's own actions arm, and which rules.
      var rules = (c.engage || []).map(function (e) {
        return { action: e.action, on: e.on || null, seconds: e.seconds || null,
                 waited: false };
      });
      function armedActions(role) {
        var out2 = [];
        rules.forEach(function (r) {
          if (r.action === 'wait') return;
          if (!r.on || r.on === role) out2.push(r);
        });
        return out2;
      }

      var beh = (c.behaviour && c.behaviour.onEngage) || null;
      var elements = [];
      var total = 0;
      (c.elements || []).forEach(function (def, di) {
        var n = def.count || 1;
        if (total + n > LIMITS.pieces) n = Math.max(0, LIMITS.pieces - total);
        total += n;
        var pts = placePoints(def.place, n, look, pctx);
        var regions = def.show === 'shard' ? coverRegions(n) : null;
        var opener = null;
        for (var ri = 0; ri < rules.length; ri++) {
          if (rules[ri].action !== 'wait') { opener = rules[ri]; break; }
        }
        for (var k = 0; k < n; k++) {
          var armed = armedActions(def.role);
          // Interpreter rules for beginnings: under 'reveal' an
          // unarmed element hides beneath the first armed one until
          // the veil answers; under 'drift-away' everything except
          // what the FIRST rule names is the path — it appears only
          // once the opening thing engages and begins to leave.
          var hidden = false;
          if (beh === 'reveal') hidden = !armed.length;
          else if (beh === 'drift-away') {
            hidden = !(opener && (!opener.on || opener.on === def.role));
          }
          elements.push({
            role: def.role, show: def.show,
            x: pts[k].x, y: pts[k].y,
            home: { x: pts[k].x, y: pts[k].y },
            armed: armed,
            engaged: false, engagedAt: -1,
            alpha: 0, target: hidden ? 0 : 1,
            hidden: hidden, appearAt: -1,
            tw: Math.random() * Math.PI * 2,
            dwell: 0, wasNear: false, awayFor: 0, prox: 0,
            region: regions ? regions[k] : null,
            order: elements.length
          });
        }
      });
      // 'reveal': co-locate hidden elements with the first armed one.
      if (beh === 'reveal') {
        var host = null;
        elements.forEach(function (el) { if (!host && el.armed.length) host = el; });
        if (host) {
          elements.forEach(function (el) {
            if (el.hidden) {
              el.x = host.x + rand(-6, 6); el.y = host.y + rand(-4, 4);
              el.home = { x: el.x, y: el.y };
            }
          });
        }
      }
      if (!elements.length) return null;

      // The pattern: node elements are re-placed as a figure, and the
      // figure replaces "every armed element engaged" as what finishing
      // means (see resolveDone).
      var pattern = null;
      if (c.arrangement) {
        var nodeEls = elements.filter(function (el) { return el.show === 'node'; });
        if (nodeEls.length >= 4) pattern = layoutPattern(c.arrangement, nodeEls, look);
      }

      // Assembly point for 'gather': the centroid of the pieces. A
      // pattern's is its own centre, which is where the figure blazes.
      var cxs = 0, cys = 0;
      elements.forEach(function (el) { cxs += el.home.x; cys += el.home.y; });
      var assembly = pattern
        ? { x: pattern.cx, y: pattern.cy }
        : { x: cxs / elements.length, y: cys / elements.length };

      var img = null;
      if (creation) {
        img = new global.Image();
        img.src = creation.projection.cover;
      }

      var con = c.constraints || {};
      inst = {
        key: key, grammar: c.grammar,
        candidate: c,
        source: entry.source,
        behaviour: beh,
        pace: (c.behaviour && c.behaviour.pace) || 'slow',
        rules: rules,
        elements: elements,
        pattern: pattern,
        assembly: assembly,
        creation: creation ? {
          id: creation.projection.id,
          entity: creation.entity,
          title: creation.projection.title
        } : null,
        img: img,
        born: time,
        lifeS: Math.min(con.lifeS || LIMITS.lifeS, grammar.CAPABILITIES.bounds.lifeS),
        fadeS: LIMITS.fadeS,
        state: 'posed',        // posed → closing → gone
        ending: null,
        closeAt: 0,
        engagedCount: 0
      };
      emit('mystery:begun', { key: key, grammar: c.grammar,
                              creation: inst.creation ? inst.creation.id : null });
      dlog({ begun: key, grammar: c.grammar, source: entry.source,
             creation: inst.creation ? inst.creation.id : null,
             elements: elements.length });
      return key;
    }

    // ---------- engagement ----------
    function engageEl(el, how) {
      if (el.engaged || !inst) return;
      el.engaged = true;
      el.engagedAt = time;
      inst.engagedCount++;
      emit('mystery:engaged', { key: inst.key, grammar: inst.grammar,
                                role: el.role, how: how });
      // 'drift-away': the engaged thing leaves, and the path appears.
      if (inst.behaviour === 'drift-away') {
        el.leaving = true;
        var step = 0;
        inst.elements.forEach(function (o) {
          if (o.hidden && o.appearAt < 0) { o.appearAt = time + 0.8 + step * 1.3; step++; }
        });
      }
      if (inst.behaviour === 'dissolve') el.leaving = true;
    }

    function resolveDone() {
      // Every armed element engaged, every wait rule elapsed.
      if (!inst) return false;
      var allWaited = true;
      inst.rules.forEach(function (r) {
        if (r.action === 'wait' && !r.waited) allWaited = false;
      });
      if (!allWaited) return false;
      // A PATTERN IS FINISHED WHEN THE FIGURE IS WHOLE, never when
      // some number of things have been touched. A node sitting
      // between two joins that were there from the start is never
      // engaged and never needs to be — what the child did is complete
      // the shape, and the shape is what the world can see.
      if (inst.pattern) return inst.pattern.missingLeft === 0;
      for (var i = 0; i < inst.elements.length; i++) {
        var el = inst.elements[i];
        if (el.armed.length && !el.engaged) return false;
      }
      return true;
    }

    function residueAt(when, x, y) {
      var res = (inst.candidate.outcome || {}).residue;
      if (!res) return;
      var w = res.when || 'resolved';
      if (w !== 'either' && w !== when) return;
      if (life && life.markAt) {
        try { life.markAt(x + rand(-20, 20), y + rand(-14, 14), { life: rand(45, 75) }); }
        catch (e) {}
      }
      emit('mystery:residue', { x: x, y: y, from: inst.key });
      dlog({ residue: inst.key, at: { x: Math.round(x), y: Math.round(y) } });
    }

    function pushEffect(fx) {
      effects.push(fx);
      if (effects.length > LIMITS.effects) effects.shift();
    }

    function endInstance(ending, discovery) {
      var at = inst.assembly;
      var record = {
        key: inst.key, grammar: inst.grammar, ending: ending,
        discovery: discovery || null, engaged: inst.engagedCount,
        t: Math.round(time * 10) / 10
      };
      outcomes.push(record);
      if (outcomes.length > LIMITS.outcomesKept) outcomes.shift();
      inst.state = 'closing';
      inst.ending = ending;
      // A COMPLETED FIGURE DOES NOT FADE — the closing window is where
      // it wakes instead, and it is longer for exactly that reason.
      // An untaken or unresolved one lets go the ordinary way.
      inst.waking = !!(inst.pattern && ending === 'discovery');
      inst.fadeS = inst.waking ? PATTERN.wakeS : LIMITS.fadeS;
      inst.closeAt = time + inst.fadeS;
      inst.elements.forEach(function (el) {
        if (inst.waking && el.show === 'node') return;   // it stays lit
        el.target = 0;
        // A discovery lets what was hidden be SEEN for a breath as
        // everything closes — the veil parts before the light leaves.
        if (ending === 'discovery' && el.hidden) {
          el.hidden = false;
          el.alpha = Math.max(el.alpha, 0.85);
        }
      });
      if (ending === 'discovery') {
        emit('mystery:resolved', {
          key: inst.key, grammar: inst.grammar, discovery: discovery,
          storyId: inst.creation ? inst.creation.id : null,
          at: { x: at.x, y: at.y }
        });
        residueAt('resolved', at.x, at.y);
      } else {
        emit('mystery:dissolved', {
          key: inst.key, grammar: inst.grammar,
          engaged: inst.engagedCount > 0
        });
        residueAt('dissolved', at.x, at.y);
      }
      dlog({ ended: inst.key, ending: ending, discovery: discovery || null,
             engaged: inst.engagedCount });
    }

    function resolve() {
      var possible = ((inst.candidate.outcome || {}).possible || ['unresolved']).slice();
      var pick = possible[Math.floor(Math.random() * possible.length)];
      if (pick === 'discovery') {
        var kind = (inst.candidate.outcome || {}).discovery || 'wonder';
        var at = inst.assembly;
        if (kind === 'creation-revealed' && inst.creation) {
          // A light leaves the answered mystery and travels to the
          // creation's own Spirit, resting there a while — drawn on
          // this canvas, nothing written to the entity. The CREATION
          // ITSELF NEVER MOVES AND IS NEVER WRITTEN TO: what awakens is
          // the Ether's answer around its Spirit, which is the
          // jellyfish's own precedent and Decision 9's own rule.
          //
          // A COMPLETED PATTERN IS ANSWERED AT ETHER SCALE, because
          // the payoff must be proportional to what the child did: the
          // figure blazes, the light crosses the sky, and where it
          // lands a ring sweeps out across the whole view.
          var big = !!inst.pattern;
          if (big) inst.pattern.igniteAt = time;
          pushEffect({ kind: 'travel', from: { x: at.x, y: at.y },
                       entity: inst.creation.entity, t: 0,
                       dur: big ? 3.2 : 2.8, big: big });
        } else if (kind === 'wonder') {
          if (life && life.bloomAt) {
            try { life.bloomAt(at.x + rand(-20, 20), at.y + rand(-14, 14)); } catch (e) {}
          }
        } else { // 'place'
          pushEffect({ kind: 'halo', at: { x: at.x, y: at.y }, t: 0, dur: 6 });
        }
        endInstance('discovery', kind);
      } else {
        endInstance(pick === 'dissolve' ? 'dissolve' : 'unresolved', null);
      }
    }

    // ---------- the touch: the Composer asks this layer first ----------
    function touchAt(fx, fy) {
      if (!inst || inst.state !== 'posed') return false;
      var radius = Math.max(70, shortEdge() * 0.08);
      var bestEl = null, bestD = radius;
      for (var i = 0; i < inst.elements.length; i++) {
        var el = inst.elements[i];
        if (el.alpha < 0.15) continue;
        var dx = nearestCopy(el.x, ether.width, fx) - fx;
        var dy = el.y - fy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) { bestD = d; bestEl = el; }
      }
      if (!bestEl) return false;
      if (inst.pattern && bestEl.show === 'node') return tapNode(bestEl);
      var tappable = bestEl.armed.some(function (r) { return r.action === 'tap'; });
      if (tappable && !bestEl.engaged) engageEl(bestEl, 'tap');
      else bestEl.tw += 2;   // a small acknowledging shiver either way
      return true;           // a posed thing is never empty sky
    }

    // JOINING TWO LIGHTS, WITH THE GESTURE THE ETHER ALREADY OWNS.
    // The Traveller's drag turns the sky (Decision 58) and that is the
    // one navigation gesture there is — so drag is NOT given a second
    // meaning here. Two taps join two nodes: the first chooses, the
    // second says which one it belongs to. That is enough for the whole
    // canonical experience and costs the sky nothing.
    //
    // NOTHING BLAMES. A pair that is not a missing join simply releases
    // with a small shiver — no message, no sound of being wrong, no
    // count of tries. A child may tap all day.
    function tapNode(el) {
      var pat = inst.pattern;
      if (pat.sel === el) { el.sel = false; pat.sel = null; el.tw += 1; return true; }
      if (!pat.sel) { pat.sel = el; el.sel = true; return true; }
      var a = pat.sel, b = el;
      a.sel = false; pat.sel = null;
      var joined = null;
      for (var i = 0; i < pat.links.length; i++) {
        var L = pat.links[i];
        if (L.present) continue;
        if ((L.a === a.node && L.b === b.node) || (L.a === b.node && L.b === a.node)) {
          joined = L; break;
        }
      }
      if (!joined) { a.tw += 2; b.tw += 2; return true; }
      joined.present = true;
      joined.joinedAt = time;
      pat.missingLeft--;
      // Both ends count as engaged, so the ordinary diagnostics and
      // the 'engaged' event say what happened; the figure, not the
      // count, is still what decides finishing.
      engageEl(a, 'tap');
      engageEl(b, 'tap');
      emit('mystery:joined', { key: inst.key, a: a.node, b: b.node,
                               left: pat.missingLeft });
      dlog({ joined: [a.node, b.node], left: pat.missingLeft });
      return true;
    }

    // ---------- the frame ----------
    var lastNow = null;
    function frame(now) {
      if (destroyed) return;
      global.requestAnimationFrame(frame);
      if (lastNow === null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000) * timeScale;
      lastNow = now;
      if (!universe.isRunning || !universe.isRunning()) { draw(); return; }
      if (portalOpen()) dt *= 0.28;   // the sky slows with the universe
      time += dt;
      update(dt);
      draw();
    }

    // A LIVING THING LOOKING AROUND, never a path to a destination.
    // The heading wanders on its own two slow waves, it stops to look
    // at things, and it swims — the ring it used to be breathes in and
    // out as it goes. Nothing here aims at anything: there is no
    // target, no route and no arrival.
    function roam(dt) {
      var R = PATTERN.roam;
      for (var i = wanderers.length - 1; i >= 0; i--) {
        var w = wanderers[i];
        w.t += dt;
        // The waking brightness settles to a resting one. It stays
        // visible — a child must be able to follow it — but it stops
        // being the loudest thing in the sky.
        var settle = clamp(w.t / R.settleS, 0, 1);
        w.glow = 1 - (1 - R.restGlow) * settle;
        if (w.leaving >= 0) {
          w.glow *= clamp(1 - (time - w.leaving) / R.leaveS, 0, 1);
          if (time - w.leaving > R.leaveS) { wanderers.splice(i, 1); continue; }
        }
        // Pauses. It stops, looks, and goes on somewhere else.
        if (w.rest > 0) {
          w.rest -= dt;
          if (w.rest <= 0) {
            w.restAt = w.t + rand(R.restEvery[0], R.restEvery[1]);
            w.speed = rand(R.speedMin, R.speedMax);
            w.heading += rand(-1.2, 1.2);
          }
        } else if (w.t >= w.restAt) {
          w.rest = rand(R.restFor[0], R.restFor[1]);
        }
        var moving = w.rest > 0 ? 0 : 1;
        // Even the first leg drifts a little — a straight line is the
        // one thing a living thing never draws.
        var departing = w.t < R.departS;
        w.heading += (w.curl +
                      (Math.sin(w.t * 0.13 + w.seed) +
                       Math.sin(w.t * 0.29 + w.seed * 1.7) * 0.5) * R.turn) *
                     dt * (departing ? R.departTurn : 1);
        var speed = departing
          ? R.departSpeed * clamp(w.t / 1.2, 0, 1)   // it gathers pace
          : w.speed;
        w.cx += Math.cos(w.heading) * speed * moving * dt;
        w.cy += Math.sin(w.heading) * speed * moving * dt * 0.72;
        // It keeps breathing wherever it is — resting included.
        w.scale = R.gather + R.breath * Math.sin(w.t * 0.95 + w.seed);
      }
    }

    function update(dt) {
      roam(dt);
      for (var i = effects.length - 1; i >= 0; i--) {
        effects[i].t += dt;
        if (effects[i].kind === 'travel' && effects[i].t >= effects[i].dur &&
            !effects[i].landed) {
          effects[i].landed = true;
          var ent = effects[i].entity;
          var big2 = !!effects[i].big;
          var at2 = (ent && ent.position) ? { x: ent.position.x, y: ent.position.y }
                                          : effects[i].from;
          pushEffect({ kind: 'halo', at: at2, entity: ent, t: 0, dur: big2 ? 9 : 6 });
          // The Ether itself answers, once, across the whole sky.
          if (big2) pushEffect({ kind: 'sweep', at: at2, entity: ent, t: 0, dur: 2.8 });
        }
        var lifespan = effects[i].kind === 'travel'
          ? effects[i].dur + 0.2 : effects[i].dur;
        if (effects[i].t > lifespan) effects.splice(i, 1);
      }
      if (!inst) return;

      if (inst.state === 'closing') {
        if (inst.waking) {
          // THE FIGURE TAKES A BREATH WHERE IT STANDS. The blaze runs
          // down, the ring softens out of its geometry and begins to
          // undulate — this beat exists so a child sees that what they
          // completed is alive, before it is anywhere else.
          var pat = inst.pattern;
          var R0 = PATTERN.roam;
          var wake = clamp(1 - (inst.closeAt - time) / inst.fadeS, 0, 1);
          var we = wake * wake * (3 - 2 * wake);
          pat.wake = wake;
          // It draws itself in and breathes — a shape becoming a being.
          var gather = 1 - (1 - R0.gather) * we +
                       R0.breath * we * Math.sin(time * 2.1);
          for (var wi = 0; wi < pat.nodes.length; wi++) {
            var wn = pat.nodes[wi];
            wn.alpha = Math.min(1, wn.alpha + dt * 2);
            var swim = gather * (1 + R0.swim * we *
              Math.sin(time * 1.05 + wi * 0.9));
            var ang = wn.polar.ang + 0.07 * we * Math.sin(time * 0.7 + wi);
            wn.x = pat.cx + Math.cos(ang) * wn.polar.r * swim;
            wn.y = pat.cy + Math.sin(ang) * wn.polar.r * PATTERN.squash * swim;
          }
          if (time >= inst.closeAt) { awaken(pat); inst = null; }
          return;
        }
        inst.elements.forEach(function (el) {
          el.alpha = Math.max(0, el.alpha - dt / (inst.fadeS || LIMITS.fadeS));
        });
        if (time >= inst.closeAt) { inst = null; }
        return;
      }

      var age = time - inst.born;
      var still = stillNow();
      var recentAct = still < 3;
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var cam = camera.offsetFor(ether.depth.stories, camScratch);
      var short = shortEdge();

      // Wait rules.
      inst.rules.forEach(function (r) {
        if (r.action === 'wait' && !r.waited && age >= (r.seconds || 20)) {
          r.waited = true;
        }
      });

      var pace = inst.pace === 'still' ? 0 : inst.pace === 'drifting' ? 1.4 : 0.7;

      for (var k = 0; k < inst.elements.length; k++) {
        var el = inst.elements[k];

        // Appearance: elements ease in; hidden ones on their cue.
        if (el.hidden && el.appearAt >= 0 && time >= el.appearAt) {
          el.hidden = false; el.target = 1;
        }
        var want = el.leaving ? 0 : el.target;
        el.alpha += clamp(want - el.alpha, -dt / 1.4, dt / LIMITS.appearS);

        // A slow breathing drift, never faster than the sky's own.
        el.x = el.home.x + Math.sin(time * 0.22 + el.tw) * 6 * pace;
        el.y = el.home.y + Math.cos(time * 0.18 + el.tw * 1.3) * 4 * pace;

        // Gather: engaged pieces come together at the assembly.
        if (inst.behaviour === 'gather' && el.engaged) {
          var slotX = inst.assembly.x + (el.region ? el.region.slotX * 96 : 0);
          var slotY = inst.assembly.y + (el.region ? el.region.slotY * 128 : 0);
          el.home.x += (slotX - el.home.x) * Math.min(1, dt * 1.6);
          el.home.y += (slotY - el.home.y) * Math.min(1, dt * 1.6);
        }
        if (el.leaving && inst.behaviour === 'drift-away') {
          el.home.x += Math.cos(el.tw) * 26 * dt;
          el.home.y += Math.sin(el.tw) * 18 * dt;
        }

        // Proximity: how near the centre of the view this element is.
        var sx = nearestCopy(el.x + cam.x, ether.width, cx);
        var sy = nearestCopy(el.y + cam.y, ether.height, cy);
        var d = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy));
        el.prox = clamp(1 - d / (short * 0.55), 0, 1);

        if (el.alpha < 0.15 || el.engaged) continue;

        // The notice grammar: nearness counts only after a recent act.
        for (var r2 = 0; r2 < el.armed.length; r2++) {
          var rule = el.armed[r2];
          if (rule.action === 'approach' && el.prox > 0.55 && recentAct) {
            engageEl(el, 'approach');
            break;
          }
          if (rule.action === 'dwell') {
            if (el.prox > 0.4 && still < 8) {
              el.dwell += dt;
              if (el.dwell >= (rule.seconds || 2.5)) { engageEl(el, 'dwell'); break; }
            }
          }
          if (rule.action === 'return') {
            if (el.prox > 0.5) el.wasNear = true;
            if (el.wasNear && el.prox < 0.12) el.awayFor += dt;
            if (el.awayFor > 6 && el.prox > 0.55 && recentAct) {
              engageEl(el, 'return');
              break;
            }
          }
        }
      }

      if (resolveDone()) { resolve(); return; }

      // An untaken mystery dissolves — the question stays open, and
      // nothing was owed (unresolved is a first-class ending).
      if (age > inst.lifeS) {
        endInstance(inst.engagedCount > 0 ? 'unresolved' : 'dissolve', null);
      }
    }

    // ---------- drawing ----------
    // The stage is empty most of the visit, and an empty stage must
    // cost nothing: the canvas is cleared once when the last thing
    // fades and never scrubbed per idle frame — a full-screen clear
    // every frame is real fill cost on a phone, paid for nothing.
    var stageDirty = false;

    function drawStarsAt(sx, sy, alpha, seed) {
      for (var i = 0; i < 3; i++) {
        var a2 = seed + i * 2.1;
        var tw = 0.55 + 0.45 * Math.sin(time * 1.7 + a2 * 3);
        var msz = 2.6 * tw;
        ctx.globalAlpha = alpha * tw;
        ctx.drawImage(starSprite,
          sx + Math.cos(a2) * (10 + i * 9) - msz * 2,
          sy + Math.sin(a2) * (8 + i * 7) - msz * 2,
          msz * 4, msz * 4);
      }
    }

    function draw() {
      if (!inst && !effects.length && !wanderers.length) {
        if (stageDirty) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          stageDirty = false;
        }
        return;
      }
      stageDirty = true;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var breath = (ether.ambient && ether.ambient.breath) || 1;
      var cam = camera.offsetFor(ether.depth.stories, camScratch);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var i, sx, sy;

      if (inst) {
        var imgReady = inst.img && inst.img.complete && inst.img.naturalWidth > 0;
        // Links first, beneath the things they join.
        if (inst.behaviour === 'link' && !inst.pattern) {
          var joined = inst.elements.filter(function (el) { return el.engaged; })
            .sort(function (a, b) { return a.engagedAt - b.engagedAt; });
          if (joined.length >= 2) {
            ctx.strokeStyle = rgba(glowRgb, 0.28 * breath);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (i = 0; i < joined.length; i++) {
              sx = nearestCopy(joined[i].x + cam.x, ether.width, cx);
              sy = nearestCopy(joined[i].y + cam.y, ether.height, cy);
              if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
        }
        // THE FIGURE IS DRAWN AS ONE THING, from its own centre, so it
        // can never tear across the sky's seam: every node is placed
        // relative to the centre's resolved copy rather than resolved
        // on its own.
        var pat = inst.pattern;
        var patC = null;
        if (pat) {
          patC = {
            x: nearestCopy(pat.cx + cam.x, ether.width, cx),
            y: nearestCopy(pat.cy + cam.y, ether.height, cy)
          };
          var alive = pat.nodes.length ? pat.nodes[0].alpha : 0;
          var blaze = 0;
          if (pat.igniteAt >= 0) {
            blaze = clamp(1 - (time - pat.igniteAt) / PATTERN.igniteS, 0, 1);
          }
          ctx.lineCap = 'round';
          for (i = 0; i < pat.links.length; i++) {
            var L = pat.links[i];
            if (!L.present) continue;      // a gap is drawn as nothing
            var na = pat.nodes[L.a], nb = pat.nodes[L.b];
            var ax = patC.x + (na.x - pat.cx), ay = patC.y + (na.y - pat.cy);
            var bx = patC.x + (nb.x - pat.cx), by = patC.y + (nb.y - pat.cy);
            // A just-joined link draws itself along, once.
            var grow = 1;
            var fresh = 0;
            if (L.joinedAt >= 0) {
              var jt = (time - L.joinedAt) / PATTERN.joinS;
              grow = clamp(jt, 0, 1);
              fresh = clamp(1 - (time - L.joinedAt) / 1.6, 0, 1);
            }
            ctx.strokeStyle = rgba(glowRgb,
              alive * breath * (0.26 + 0.5 * fresh + 0.62 * blaze));
            ctx.lineWidth = 1.5 + 2.4 * fresh + 3 * blaze;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + (bx - ax) * grow, ay + (by - ay) * grow);
            ctx.stroke();
          }
          ctx.lineWidth = 1;
        }

        for (i = 0; i < inst.elements.length; i++) {
          var el = inst.elements[i];
          if (el.alpha <= 0.01) continue;
          if (patC && el.show === 'node') {
            sx = patC.x + (el.x - pat.cx);
            sy = patC.y + (el.y - pat.cy);
          } else {
            sx = nearestCopy(el.x + cam.x, ether.width, cx);
            sy = nearestCopy(el.y + cam.y, ether.height, cy);
          }
          var a = el.alpha * breath;
          var lift = el.engaged ? 1.18 : 1;

          if (el.show === 'shard') {
            ctx.globalAlpha = a * 0.4;
            ctx.drawImage(glowSprite, sx - 40, sy - 40, 80, 80);
            if (imgReady && el.region) {
              var iw = inst.img.naturalWidth, ih = inst.img.naturalHeight;
              var pw = 52 * lift, phh = pw * ((el.region.sh * ih) / (el.region.sw * iw) || 1.33);
              phh = clamp(phh, 26, 96);
              ctx.globalAlpha = a * 0.88;
              ctx.drawImage(inst.img,
                el.region.sx * iw, el.region.sy * ih,
                el.region.sw * iw, el.region.sh * ih,
                sx - pw / 2, sy - phh / 2, pw, phh);
            } else {
              drawStarsAt(sx, sy, a * 0.8, el.tw);
            }
          } else if (el.show === 'glint') {
            var tw2 = 0.5 + 0.5 * Math.sin(time * 1.9 + el.tw);
            var gsz = (el.engaged ? 5.2 : 3.6) * (0.7 + 0.5 * tw2);
            ctx.globalAlpha = a * (0.5 + 0.4 * tw2);
            ctx.drawImage(starSprite, sx - gsz * 2, sy - gsz * 2, gsz * 4, gsz * 4);
          } else if (el.show === 'mark') {
            drawStarsAt(sx, sy, a * 0.7, el.tw);
          } else if (el.show === 'veil') {
            ctx.globalAlpha = a * 0.55;
            ctx.drawImage(glowSprite, sx - 78, sy - 66, 156, 132);
            ctx.globalAlpha = a * 0.35;
            ctx.drawImage(glowSprite, sx - 46, sy - 40, 92, 80);
          } else if (el.show === 'node') {
            // A NODE IS A LIGHT WITH A CORE, not a star sprite: the
            // ambient sky is made of star sprites, so anything drawn
            // with one is camouflaged by construction. A node is sized
            // as a fraction of the sky and carries a wide soft halo, so
            // the figure reads from across the view.
            var core = clamp(shortEdge() * PATTERN.coreFrac,
                             PATTERN.coreMin, PATTERN.coreMax);
            var pulse = 0.86 + 0.14 * Math.sin(time * 1.15 + el.tw);
            var chosen = el.sel ? 1 : 0;
            var blz = (inst.pattern && inst.pattern.igniteAt >= 0)
              ? clamp(1 - (time - inst.pattern.igniteAt) / PATTERN.igniteS, 0, 1) : 0;
            var halo = core * (4.4 + 1.6 * chosen + 3.2 * blz);
            ctx.globalAlpha = a * (0.34 + 0.24 * chosen + 0.4 * blz) * pulse;
            ctx.drawImage(glowSprite, sx - halo, sy - halo, halo * 2, halo * 2);
            ctx.globalAlpha = a * (0.9 + 0.1 * blz);
            ctx.fillStyle = rgba(starRgb, 1);
            ctx.beginPath();
            ctx.arc(sx, sy, core * (0.62 + 0.16 * chosen + 0.3 * blz) * pulse,
                    0, Math.PI * 2);
            ctx.fill();
            // The chosen node wears a quiet ring — the only thing that
            // says "this one is in your hand", and it says it without
            // a word.
            if (el.sel) {
              ctx.strokeStyle = rgba(starRgb, a * 0.55 * pulse);
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(sx, sy, core * 1.9, 0, Math.PI * 2);
              ctx.stroke();
              ctx.lineWidth = 1;
            }
          } else if (el.show === 'link') {
            // a link element is a faint short line of its own
            ctx.strokeStyle = rgba(glowRgb, a * 0.3);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - 16, sy);
            ctx.lineTo(sx + 16, sy);
            ctx.stroke();
          }
        }
      }

      // THE WANDERERS — drawn before the effects and after the posed
      // mystery, because they belong to the sky rather than to any
      // question. They WRAP, unlike the creature layer's visitors: a
      // being that crossed once is met once, and this one lives here
      // now, so turning the universe can find it again.
      for (i = 0; i < wanderers.length; i++) {
        var w = wanderers[i];
        var wx = nearestCopy(w.cx + cam.x, ether.width, cx);
        var wy = nearestCopy(w.cy + cam.y, ether.height, cy);
        var wcore = clamp(shortEdge() * PATTERN.coreFrac,
                          PATTERN.coreMin, PATTERN.coreMax);
        var wa = w.glow * breath;
        var wpts = [];
        for (var pi = 0; pi < w.pts.length; pi++) {
          var pt = w.pts[pi];
          // It swims: the ring it used to be breathes as it travels,
          // which is the whole difference between a shape and a being.
          var sw = w.scale * (1 + PATTERN.roam.swim *
            Math.sin(w.t * 1.05 + pi * 0.9 + w.seed));
          var pa = pt.ang + 0.07 * Math.sin(w.t * 0.7 + pi + w.seed);
          wpts.push({
            x: wx + Math.cos(pa) * pt.r * sw,
            y: wy + Math.sin(pa) * pt.r * PATTERN.squash * sw
          });
        }
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(glowRgb, wa * 0.3);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var li = 0; li < w.links.length; li++) {
          var wl = w.links[li];
          ctx.moveTo(wpts[wl.a].x, wpts[wl.a].y);
          ctx.lineTo(wpts[wl.b].x, wpts[wl.b].y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        for (var ni = 0; ni < wpts.length; ni++) {
          var tw3 = 0.88 + 0.12 * Math.sin(w.t * 1.3 + ni * 1.7 + w.seed);
          ctx.globalAlpha = wa * 0.3 * tw3;
          ctx.drawImage(glowSprite,
            wpts[ni].x - wcore * 3.6, wpts[ni].y - wcore * 3.6,
            wcore * 7.2, wcore * 7.2);
          ctx.globalAlpha = wa * tw3;
          ctx.fillStyle = rgba(starRgb, 1);
          ctx.beginPath();
          ctx.arc(wpts[ni].x, wpts[ni].y, wcore * 0.6 * tw3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (i = 0; i < effects.length; i++) {
        var fx = effects[i];
        if (fx.kind === 'travel') {
          var t = clamp(fx.t / fx.dur, 0, 1);
          var eased = t * t * (3 - 2 * t);
          var ent = fx.entity;
          var tox = (ent && ent.position) ? ent.position.x : fx.from.x;
          var toy = (ent && ent.position) ? ent.position.y : fx.from.y;
          var px = fx.from.x + (tox - fx.from.x) * eased;
          var py = fx.from.y + (toy - fx.from.y) * eased;
          sx = nearestCopy(px + cam.x, ether.width, cx);
          sy = nearestCopy(py + cam.y, ether.height, cy);
          ctx.globalAlpha = 0.7 * breath * (0.5 + 0.5 * Math.sin(time * 3));
          ctx.drawImage(glowSprite, sx - 14, sy - 14, 28, 28);
        } else if (fx.kind === 'sweep') {
          // The Ether's own answer: one wide ring leaving the awakened
          // Spirit and crossing the whole view. Drawn here, on this
          // canvas — nothing is written to the entity, and nothing
          // about the creation itself is touched.
          var ent3 = fx.entity;
          var wx = (ent3 && ent3.position) ? ent3.position.x : fx.at.x;
          var wy = (ent3 && ent3.position) ? ent3.position.y : fx.at.y;
          sx = nearestCopy(wx + cam.x, ether.width, cx);
          sy = nearestCopy(wy + cam.y, ether.height, cy);
          var reach = Math.sqrt(ether.viewWidth * ether.viewWidth +
                                ether.viewHeight * ether.viewHeight) * PATTERN.sweepFrac;
          var wt = clamp(fx.t / fx.dur, 0, 1);
          var rr = reach * (wt * (2 - wt));         // out fast, then easing
          ctx.globalAlpha = 0.34 * (1 - wt) * breath;
          ctx.strokeStyle = rgba(glowRgb, 1);
          ctx.lineWidth = 2.4 + 6 * (1 - wt);
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, rr), 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        } else if (fx.kind === 'halo') {
          var ent2 = fx.entity;
          var hx = (ent2 && ent2.position) ? ent2.position.x : fx.at.x;
          var hy = (ent2 && ent2.position) ? ent2.position.y : fx.at.y;
          sx = nearestCopy(hx + cam.x, ether.width, cx);
          sy = nearestCopy(hy + cam.y, ether.height, cy);
          var fadeT = 1 - clamp((fx.t - fx.dur * 0.7) / (fx.dur * 0.3), 0, 1);
          var pulse = 0.6 + 0.4 * Math.sin(time * 1.4);
          ctx.globalAlpha = 0.4 * fadeT * pulse * breath;
          ctx.drawImage(glowSprite, sx - 70, sy - 70, 140, 140);
          ctx.globalAlpha = 0.3 * fadeT * breath;
          ctx.drawImage(glowSprite, sx - 34, sy - 34, 68, 68);
        }
      }
      ctx.globalAlpha = 1;
    }

    global.requestAnimationFrame(frame);

    return {
      quiet: false,
      poolReport: function () { return loaded.report.slice(); },
      candidates: candidates,
      begin: begin,
      live: function () {
        if (!inst || inst.state !== 'posed') return null;
        return { key: inst.key, grammar: inst.grammar,
                 engaged: inst.engagedCount,
                 creation: inst.creation ? inst.creation.id : null };
      },
      touchAt: touchAt,
      // The suite's window into the one instance — positions, alphas,
      // rules — never anything a child sees.
      instrument: function () {
        if (!inst) return null;
        return {
          key: inst.key, grammar: inst.grammar, state: inst.state,
          age: Math.round((time - inst.born) * 10) / 10,
          behaviour: inst.behaviour,
          creation: inst.creation ? inst.creation.id : null,
          arrangement: inst.pattern ? {
            shape: inst.pattern.shape,
            nodes: inst.pattern.nodes.length,
            radius: Math.round(inst.pattern.radius),
            centre: { x: inst.pattern.cx, y: inst.pattern.cy },
            missingLeft: inst.pattern.missingLeft,
            selected: inst.pattern.sel ? inst.pattern.sel.node : null,
            links: inst.pattern.links.map(function (L) {
              return { a: L.a, b: L.b, present: L.present };
            })
          } : null,
          elements: inst.elements.map(function (el) {
            return { role: el.role, show: el.show, x: el.x, y: el.y,
                     alpha: Math.round(el.alpha * 100) / 100,
                     engaged: el.engaged, hidden: el.hidden,
                     prox: Math.round(el.prox * 100) / 100 };
          }),
          effects: effects.map(function (f) { return f.kind; })
        };
      },
      // What is alive in the sky right now. Positions and shape only —
      // a wanderer holds nothing else, so there is nothing else to
      // report. It is the suite's and the Lab's window, exactly as
      // instrument() is, and never anything a child reads.
      wanderers: function () {
        return wanderers.map(function (w) {
          return {
            nodes: w.pts.length, links: w.links.length,
            x: w.cx, y: w.cy, age: Math.round((time - w.born) * 10) / 10,
            glow: Math.round(w.glow * 100) / 100,
            resting: w.rest > 0, leaving: w.leaving >= 0
          };
        });
      },
      outcomes: function () { return outcomes.slice(); },
      diagnostics: function () {
        return {
          quiet: false,
          pool: loaded.report.slice(),
          activeKeys: loaded.active.map(function (a) { return a.id; }),
          live: inst ? { key: inst.key, state: inst.state } : null,
          alive: wanderers.length,
          outcomes: outcomes.slice()
        };
      },
      setTimeScale: function (k) {
        if (typeof k === 'number' && k > 0 && k <= 600) timeScale = k;
      },
      on: on, off: off,
      destroy: function () {
        destroyed = true;
        universe.off('ether:resized', sizeCanvas);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        emit('destroyed', {});
      }
    };
  }

  global.EtherMystery = {
    LIMITS: LIMITS,
    loadPool: loadPool,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
