// tools/ether-mystery-lab/labReveal.js — REVEAL-ONLY CREATURE FEATURES.
//
// SPRINT — Shape Lab: Reveal-Only Creature Features (Decision 58).
//
// THE DISTINCTION THIS FILE EXISTS FOR:
//
//     DOTS + JOINS            = THE CHALLENGE
//     REVEAL-ONLY FEATURES    = THE PAYOFF
//
// A reveal-only feature is a small visual detail — a mane, a wing
// membrane, a set of stripes, a pair of horns — that appears ONLY after
// the Creature Mystery's figure is completely solved, stays a few
// seconds, and fades. It is not a star. It is not connected by the
// child. It is not a puzzle piece. It is not part of the completion
// condition and cannot affect whether the figure is complete. It cannot
// be tapped, moved, selected or deleted by a child. It is purely
// visual, and it exists to give the completed creature its emotional
// and visual impact.
//
// WHAT IS HERE.
//   - The DATA MODEL: a feature is a name, one of SEVEN generic visual
//     types, an ANCHOR into the authored figure (two light indices),
//     a placement (offset, size, angle) and a few numeric parameters.
//   - The SANITIZER: deny by shape (Decision 33). An unknown key at any
//     depth is refused by name, every number is clamped to a written
//     bound, every string is a short label from a closed alphabet, and
//     a name carrying the product's boundary vocabulary is refused.
//   - The ANCHOR FRAME: everything is expressed relative to two of the
//     author's own lights, so moving a light moves the feature — the
//     authored figure is authoritative, never the blueprint outline.
//   - The RENDERER: seven primitives drawn in the Ether's own palette
//     onto a supplied 2D context, from SCREEN positions of the lights
//     the caller supplies. It knows nothing about the editor, the
//     preview, the interpreter or any creature.
//   - The TIMELINE: completion → a short response → features emerge →
//     hold → fade → gone. No countdown, no remaining time, nothing on
//     screen but light.
//
// WHAT IS NOT HERE, BY CONSTRUCTION.
//   - No creature catalogue and no `subject ===` branch. A lion's mane
//     and a mermaid's hair are the SAME primitive with different
//     numbers. The suite scans this file for creature names.
//   - No geometry of the figure. This file never adds, moves or joins a
//     light; it has no reference to the editor's editing API.
//   - No randomness (Math.random appears nowhere): every mote and every
//     wobble is seeded from the feature's own index, so a replay is a
//     replay.
//   - No storage, no network, no timer of its own. The caller owns the
//     clock and the canvas.
//   - No image, no SVG, no path data from anywhere but the numbers a
//     researcher typed.
//
// LAB ONLY. Nothing here is loaded by the product, and the candidate
// that reaches the Ether interpreter never carries a reveal feature:
// the features travel BESIDE a candidate exactly as the leading hint
// and the tease already do, drawn by the Lab over the real sky.

(function (global) {
  'use strict';

  var VERSION = 'reveal-1';
  var TYPES = ['contour', 'fill', 'lines', 'texture', 'spike', 'glow', 'motes'];

  // The Ether's own light: paper-cream, a touch of the Studio's gold.
  var CREAM = [241, 234, 208];
  var GOLD = [232, 196, 134];

  var LIMITS = {
    featuresMax: 8,
    nameChars: 24,
    durationS: [1.5, 10],        // the hold, in seconds — configurable, never a countdown
    offset: 2.0,                 // |dx|,|dy| in frame units
    size: [0.2, 4],
    angle: [-180, 180]
  };

  // THE TIMELINE. `afterMs` is the figure's own blaze — the world answers
  // the completion first, and only then do the features come. Each
  // feature emerges a beat after the one before it, holds for the
  // configured duration, and fades. None of these is shown anywhere.
  var TIMING = {
    afterMs: 380,
    inMs: 900,
    staggerMs: 140,
    outMs: 1300,
    defaultHoldS: 4
  };

  // THE VOCABULARY — seven generic primitives, each with a handful of
  // bounded numbers. Deliberately small: enough to test whether a
  // temporary reveal makes a completed creature feel alive, and not one
  // primitive more. Every parameter is written down here with its
  // default and its bounds, and the sanitizer reads THIS table.
  var PARAMS = {
    contour: {
      strands: { def: 7, min: 1, max: 12, step: 1, label: 'strands' },
      radius:  { def: 0.9, min: 0.1, max: 2.5, step: 0.05, label: 'reach' },
      sweep:   { def: 300, min: 20, max: 360, step: 5, label: 'sweep °' },
      wave:    { def: 0.5, min: 0, max: 1, step: 0.05, label: 'wave' },
      spread:  { def: 0.35, min: 0, max: 1, step: 0.05, label: 'spread' },
      mode:    { def: 'around', options: ['around', 'radial'], label: 'mode' }
    },
    fill: {
      shape:   { def: 'membrane', options: ['membrane', 'fan', 'lobe'], label: 'shape' },
      bulge:   { def: 0.35, min: -1, max: 1, step: 0.05, label: 'bulge' },
      width:   { def: 0.8, min: 0.05, max: 2.5, step: 0.05, label: 'width' }
    },
    lines: {
      count:   { def: 6, min: 1, max: 16, step: 1, label: 'count' },
      length:  { def: 0.6, min: 0.05, max: 2.5, step: 0.05, label: 'length' },
      tilt:    { def: 90, min: -90, max: 90, step: 5, label: 'tilt °' },
      curve:   { def: 0.3, min: -1, max: 1, step: 0.05, label: 'curve' },
      taper:   { def: 0.5, min: 0, max: 1, step: 0.05, label: 'taper' }
    },
    texture: {
      rows:    { def: 4, min: 1, max: 8, step: 1, label: 'rows' },
      cols:    { def: 6, min: 1, max: 12, step: 1, label: 'columns' },
      dot:     { def: 0.07, min: 0.01, max: 0.3, step: 0.01, label: 'mark' },
      width:   { def: 1.0, min: 0.1, max: 2.5, step: 0.05, label: 'width' },
      height:  { def: 0.5, min: 0.05, max: 2.5, step: 0.05, label: 'height' }
    },
    spike: {
      count:   { def: 2, min: 1, max: 12, step: 1, label: 'count' },
      length:  { def: 0.5, min: 0.05, max: 2.5, step: 0.05, label: 'length' },
      width:   { def: 0.22, min: 0.02, max: 1, step: 0.01, label: 'base' },
      curve:   { def: 0.3, min: -1, max: 1, step: 0.05, label: 'curve' },
      spread:  { def: 40, min: 0, max: 180, step: 5, label: 'spread °' },
      along:   { def: false, bool: true, label: 'along the join' }
    },
    glow: {
      radius:    { def: 0.25, min: 0.02, max: 2.5, step: 0.01, label: 'radius' },
      intensity: { def: 0.8, min: 0, max: 1, step: 0.05, label: 'intensity' },
      pulse:     { def: 0.5, min: 0, max: 1, step: 0.05, label: 'pulse' }
    },
    motes: {
      count:   { def: 12, min: 1, max: 40, step: 1, label: 'count' },
      radius:  { def: 0.5, min: 0.05, max: 2.5, step: 0.05, label: 'reach' },
      drift:   { def: 0.5, min: 0, max: 1, step: 0.05, label: 'drift' },
      dot:     { def: 0.04, min: 0.01, max: 0.2, step: 0.01, label: 'mark' }
    }
  };

  // What a feature record may hold, and nothing else.
  var FEATURE_KEYS = ['id', 'name', 'type', 'anchor', 'offset', 'size', 'angle', 'params'];
  var ANCHOR_KEYS = ['a', 'b'];
  var BLOCK_KEYS = ['durationS', 'features'];

  // A name may never carry the product's boundary vocabulary: nothing
  // about identity, credentials, memory or a Story belongs in a visual
  // detail's label.
  var FORBIDDEN_WORDS = /\b(CARD|STAR|STARS|CONSTELLATION|MEMORY|MEMORIES|EMAIL|STORY|STORIES|COMPANION|KEY|TOKEN|PASSWORD|CREATOR|TRAVELLER|ORBIT|CIRCLE|USERNAME)\b/;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round2(v) { return Math.round(v * 100) / 100; }

  function cleanName(v) {
    var raw = typeof v === 'string' ? v.trim().toUpperCase() : '';
    var out = raw.replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (out.length > LIMITS.nameChars) {
      var head = out.slice(0, LIMITS.nameChars + 1), cut = head.lastIndexOf(' ');
      out = (cut > 0 ? head.slice(0, cut) : out.slice(0, LIMITS.nameChars)).trim();
    }
    return out;
  }

  function defaults(type) {
    var out = {}, tab = PARAMS[type] || {};
    Object.keys(tab).forEach(function (k) { out[k] = tab[k].def; });
    return out;
  }

  // Clamp one parameter to its written bound. Unknown → undefined.
  function cleanParam(type, k, v) {
    var spec = (PARAMS[type] || {})[k];
    if (!spec) return undefined;
    if (spec.options) return spec.options.indexOf(v) !== -1 ? v : spec.def;
    if (spec.bool) return typeof v === 'boolean' ? v : spec.def;
    if (!isNum(v)) return spec.def;
    var c = clamp(v, spec.min, spec.max);
    if (spec.step >= 1) c = Math.round(c);
    return Math.round(c * 1000) / 1000;
  }

  // ---------------------------------------------------------------
  // THE SANITIZER — deny by shape. Returns a CLEAN copy built field by
  // field, never the object it was handed. `pointCount` is how many
  // lights the figure has: an anchor past it has nowhere to be.
  // ---------------------------------------------------------------
  function sanitizeFeature(raw, i, pointCount, reasons) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { reasons.push('bad-feature:' + i); return null; }
    Object.keys(raw).forEach(function (k) { if (FEATURE_KEYS.indexOf(k) === -1) reasons.push('unknown-key:features[' + i + '].' + k); });
    var type = TYPES.indexOf(raw.type) !== -1 ? raw.type : null;
    if (!type) reasons.push('bad-type:' + i);
    var name = cleanName(raw.name);
    if (!name) reasons.push('bad-name:' + i);
    else if (FORBIDDEN_WORDS.test(name)) reasons.push('forbidden-name:' + i);
    var anchor = raw.anchor;
    if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) { reasons.push('bad-anchor:' + i); anchor = { a: 0, b: null }; }
    else Object.keys(anchor).forEach(function (k) { if (ANCHOR_KEYS.indexOf(k) === -1) reasons.push('unknown-key:features[' + i + '].anchor.' + k); });
    var a = anchor.a, b = anchor.b === undefined ? null : anchor.b;
    if (!Number.isInteger(a) || a < 0 || (isNum(pointCount) && a >= pointCount)) reasons.push('bad-anchor-a:' + i);
    if (b !== null && (!Number.isInteger(b) || b < 0 || (isNum(pointCount) && b >= pointCount) || b === a)) reasons.push('bad-anchor-b:' + i);
    var off = raw.offset === undefined ? [0, 0] : raw.offset;
    if (!Array.isArray(off) || off.length !== 2 || !isNum(off[0]) || !isNum(off[1])) { reasons.push('bad-offset:' + i); off = [0, 0]; }
    var size = raw.size === undefined ? 1 : raw.size;
    if (!isNum(size)) { reasons.push('bad-size:' + i); size = 1; }
    var angle = raw.angle === undefined ? 0 : raw.angle;
    if (!isNum(angle)) { reasons.push('bad-angle:' + i); angle = 0; }
    var params = defaults(type || 'glow');
    if (raw.params !== undefined) {
      if (!raw.params || typeof raw.params !== 'object' || Array.isArray(raw.params)) reasons.push('bad-params:' + i);
      else Object.keys(raw.params).forEach(function (k) {
        if (!type || !PARAMS[type][k]) { reasons.push('unknown-key:features[' + i + '].params.' + k); return; }
        params[k] = cleanParam(type, k, raw.params[k]);
      });
    }
    var id = typeof raw.id === 'string' && /^rf-[a-z0-9]{1,12}$/.test(raw.id) ? raw.id : 'rf-' + (i + 1);
    return {
      id: id, name: name, type: type || 'glow',
      anchor: { a: Number.isInteger(a) ? a : 0, b: b },
      offset: [round2(clamp(off[0], -LIMITS.offset, LIMITS.offset)), round2(clamp(off[1], -LIMITS.offset, LIMITS.offset))],
      size: round2(clamp(size, LIMITS.size[0], LIMITS.size[1])),
      angle: Math.round(clamp(angle, LIMITS.angle[0], LIMITS.angle[1])),
      params: params
    };
  }

  // The whole block: { durationS, features }. Absent → empty, valid.
  function sanitize(raw, pointCount) {
    var reasons = [];
    if (raw === undefined || raw === null) return { ok: true, reasons: [], durationS: TIMING.defaultHoldS, features: [] };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reasons: ['not-an-object'], durationS: TIMING.defaultHoldS, features: [] };
    Object.keys(raw).forEach(function (k) { if (BLOCK_KEYS.indexOf(k) === -1) reasons.push('unknown-key:' + k); });
    var d = raw.durationS === undefined ? TIMING.defaultHoldS : raw.durationS;
    if (!isNum(d)) { reasons.push('bad-duration'); d = TIMING.defaultHoldS; }
    d = Math.round(clamp(d, LIMITS.durationS[0], LIMITS.durationS[1]) * 10) / 10;
    var feats = [];
    if (raw.features !== undefined) {
      if (!Array.isArray(raw.features)) reasons.push('bad-features');
      else if (raw.features.length > LIMITS.featuresMax) reasons.push('too-many-features:' + raw.features.length);
      else raw.features.forEach(function (f, i) { var c = sanitizeFeature(f, i, pointCount, reasons); if (c) feats.push(c); });
    }
    var ids = {};
    feats.forEach(function (f, i) { if (ids[f.id]) reasons.push('duplicate-id:' + i); ids[f.id] = 1; });
    if (reasons.length) return { ok: false, reasons: reasons, durationS: d, features: [] };
    return { ok: true, reasons: [], durationS: d, features: feats };
  }

  // A light was deleted at index i: every feature anchored to it has
  // nowhere to be and is dropped; every anchor after it moves down one.
  function onPointDeleted(features, i) {
    var kept = [], dropped = [];
    (features || []).forEach(function (f) {
      var a = f.anchor.a, b = f.anchor.b;
      if (a === i || b === i) { dropped.push(f.name); return; }
      var g = JSON.parse(JSON.stringify(f));
      if (a > i) g.anchor.a = a - 1;
      if (b !== null && b > i) g.anchor.b = b - 1;
      kept.push(g);
    });
    return { features: kept, dropped: dropped };
  }

  function make(type, a, b, name, seq) {
    if (TYPES.indexOf(type) === -1) type = 'contour';
    return {
      id: 'rf-' + String(seq || 1).toString(36),
      name: cleanName(name) || type.toUpperCase(),
      type: type,
      anchor: { a: Number.isInteger(a) ? a : 0, b: (Number.isInteger(b) && b !== a) ? b : null },
      offset: [0, 0], size: 1, angle: 0,
      params: defaults(type)
    };
  }

  // ---------------------------------------------------------------
  // THE ANCHOR FRAME. A feature lives in a frame made of two of the
  // author's own lights: origin at A, x-axis toward B (or toward the
  // figure's centre when B is not given), unit length |AB|. Move A and
  // the feature moves; move B and it turns and scales with the part it
  // belongs to. The blueprint outline is never consulted — it was an
  // authoring reference, and the author's final figure is authoritative.
  //
  // `P` is the lights in SCREEN space ([x,y] per light), so one frame
  // function serves the editor, the preview and any later surface.
  // ---------------------------------------------------------------
  function centroid(P) {
    var x = 0, y = 0, n = P.length || 1;
    P.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / n, y / n];
  }

  function frameOf(f, P) {
    var A = P[f.anchor.a];
    if (!A) return null;
    var B = f.anchor.b === null ? centroid(P) : P[f.anchor.b];
    if (!B) return null;
    var dx = B[0] - A[0], dy = B[1] - A[1];
    var unit = Math.hypot(dx, dy);
    if (unit < 1e-6) { dx = 1; dy = 0; unit = 1; }
    // A frame needs a real length; a degenerate pair reads the figure's
    // spread instead so a feature is never zero-sized.
    var spread = 0;
    if (unit < 4) {
      var c = centroid(P);
      P.forEach(function (p) { spread = Math.max(spread, Math.hypot(p[0] - c[0], p[1] - c[1])); });
      unit = Math.max(unit, spread * 0.5, 4);
    }
    var ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
    var ox = A[0] + (f.offset[0] * ux - f.offset[1] * uy) * unit;   // offset in the un-rotated frame
    var oy = A[1] + (f.offset[0] * uy + f.offset[1] * ux) * unit;
    var rad = (f.angle || 0) * Math.PI / 180;
    var fx = [ux * Math.cos(rad) - uy * Math.sin(rad), ux * Math.sin(rad) + uy * Math.cos(rad)];
    var fy = [-fx[1], fx[0]];
    return { ox: ox, oy: oy, k: unit * (f.size || 1), unit: unit, ux: ux, uy: uy, fx: fx, fy: fy };
  }

  // local (lx, ly) → screen
  function L(F, lx, ly) {
    return [F.ox + F.k * (lx * F.fx[0] + ly * F.fy[0]), F.oy + F.k * (lx * F.fx[1] + ly * F.fy[1])];
  }

  // A screen delta → a change of offset, in frame units.
  function offsetDelta(f, P, dx, dy) {
    var F = frameOf(f, P);
    if (!F) return [0, 0];
    return [(dx * F.ux + dy * F.uy) / F.unit, (-dx * F.uy + dy * F.ux) / F.unit];
  }

  // ---------------------------------------------------------------
  // THE TIMELINE — per feature: 0 before it emerges, 1 while it holds,
  // back to 0 as it fades. Pure function of milliseconds since the
  // figure was completed. `growth` is the emergence curve used for
  // "the mane grows out"; `alpha` is the light.
  // ---------------------------------------------------------------
  function easeOut(u) { return 1 - (1 - u) * (1 - u) * (1 - u); }
  function easeInOut(u) { return u * u * (3 - 2 * u); }

  function envelope(ms, index, total, durationS) {
    var hold = (isNum(durationS) ? durationS : TIMING.defaultHoldS) * 1000;
    var start = TIMING.afterMs + index * TIMING.staggerMs;
    var inEnd = start + TIMING.inMs;
    // every feature begins to fade together, once the LAST one has held
    var lastIn = TIMING.afterMs + Math.max(0, total - 1) * TIMING.staggerMs + TIMING.inMs;
    var outStart = lastIn + hold;
    var outEnd = outStart + TIMING.outMs;
    if (ms < start) return { phase: 'response', alpha: 0, growth: 0 };
    if (ms < inEnd) { var u = easeOut((ms - start) / TIMING.inMs); return { phase: 'in', alpha: u, growth: u }; }
    if (ms < outStart) return { phase: 'hold', alpha: 1, growth: 1 };
    if (ms < outEnd) { var v = 1 - easeInOut((ms - outStart) / TIMING.outMs); return { phase: 'out', alpha: v, growth: 1 }; }
    return { phase: 'done', alpha: 0, growth: 1 };
  }

  function totalMs(total, durationS) {
    var hold = (isNum(durationS) ? durationS : TIMING.defaultHoldS) * 1000;
    return TIMING.afterMs + Math.max(0, total - 1) * TIMING.staggerMs + TIMING.inMs + hold + TIMING.outMs;
  }

  // ---------------------------------------------------------------
  // THE RENDERER. Seven primitives, one style. `ctx` is any 2D context;
  // `P` the lights in screen space; `t` seconds (for the slow flow of
  // light — nothing here is timed by it); `env(index)` gives each
  // feature its envelope. Alpha is never above what the envelope
  // allows, and nothing is drawn at envelope 0.
  // ---------------------------------------------------------------
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }

  // Two passes make a stroke read as LIGHT rather than as ink: a wide
  // faint pass and a thin bright one. Cheaper than shadowBlur, and it
  // is the way the Ether's own currents are drawn.
  function glowStroke(ctx, path, a, wide, thin, colour) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(colour || CREAM, a * 0.28); ctx.lineWidth = wide;
    ctx.beginPath(); path(ctx); ctx.stroke();
    ctx.strokeStyle = rgba(colour || CREAM, a); ctx.lineWidth = thin;
    ctx.beginPath(); path(ctx); ctx.stroke();
  }

  // deterministic wobble seeded by integers — never Math.random
  function noise(i, j) {
    var s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawContour(ctx, f, F, t, e, idx) {
    var p = f.params, n = p.strands, base = p.radius;
    var sweep = p.sweep * Math.PI / 180;
    var lw = Math.max(1, F.k / 90);
    for (var s = 0; s < n; s++) {
      var frac = n > 1 ? s / (n - 1) : 0.5;
      var sa = 0.9 - frac * 0.55;
      var pts = [];
      if (p.mode === 'radial') {
        // strands radiating from the anchor, away from B
        var ang = Math.PI + (frac - 0.5) * sweep;
        var len = base * (0.7 + 0.3 * noise(idx, s)) * e.growth;
        var wob = 0.18 * p.wave;
        var STEPS = 12;
        for (var q = 0; q <= STEPS; q++) {
          var u = q / STEPS, r = u * len;
          var bend = Math.sin(u * 2.2 + t * 1.3 + s) * wob * r + (frac - 0.5) * 0.25 * r;
          pts.push(L(F, Math.cos(ang) * r - Math.sin(ang) * bend, Math.sin(ang) * r + Math.cos(ang) * bend));
        }
      } else {
        // arcs around the anchor, centred away from B
        var r0 = base * (1 + (frac - 0.5) * p.spread);
        var half = sweep * 0.5 * e.growth;
        var STEPS2 = 28;
        for (var q2 = 0; q2 <= STEPS2; q2++) {
          var th = Math.PI + (-half + (q2 / STEPS2) * half * 2);
          var rr = r0 * (1 + p.wave * 0.11 * Math.sin(th * 5 + t * 1.6 + s * 1.7));
          pts.push(L(F, Math.cos(th) * rr, Math.sin(th) * rr));
        }
      }
      if (pts.length < 2) continue;
      var path = function (c) { pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); };
      glowStroke(ctx, path, e.alpha * sa, lw * 5, lw, s % 3 === 1 ? GOLD : CREAM);
    }
  }

  function drawFill(ctx, f, F, t, e) {
    var p = f.params;
    var breathe = 0.92 + 0.08 * Math.sin(t * 1.1);
    var a = e.alpha * 0.11 * breathe, g = e.growth;
    var pts = [];
    var q, STEPS = 24;
    if (p.shape === 'membrane') {
      // the region between the straight A→B and a curve sagging from it
      pts.push(L(F, 0, 0)); pts.push(L(F, 1, 0));
      for (q = STEPS; q >= 0; q--) {
        var u = q / STEPS;
        var sag = 4 * u * (1 - u) * p.bulge * g;
        pts.push(L(F, u, sag));
      }
    } else if (p.shape === 'fan') {
      var half = (0.35 + 1.05 * Math.abs(p.bulge)) * 0.5;      // half-angle, radians
      pts.push(L(F, 0, 0));
      for (q = 0; q <= STEPS; q++) {
        var th = -half + (q / STEPS) * half * 2;
        var r = g * (1 + 0.06 * Math.sin(t * 0.9 + q));
        pts.push(L(F, Math.cos(th) * r, Math.sin(th) * r));
      }
    } else {
      // lobe: an ellipse between A and B
      for (q = 0; q <= STEPS; q++) {
        var th2 = (q / STEPS) * Math.PI * 2;
        pts.push(L(F, 0.5 + Math.cos(th2) * 0.5 * g, Math.sin(th2) * p.width * 0.5 * g));
      }
    }
    var path = function (c) { pts.forEach(function (pt, i) { if (i) c.lineTo(pt[0], pt[1]); else c.moveTo(pt[0], pt[1]); }); c.closePath(); };
    var o = L(F, 0.5, 0);
    var grad = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], F.k * 1.1);
    grad.addColorStop(0, rgba(GOLD, a * 1.25)); grad.addColorStop(1, rgba(CREAM, a * 0.45));
    ctx.fillStyle = grad; ctx.beginPath(); path(ctx); ctx.fill();
    glowStroke(ctx, path, e.alpha * 0.32, Math.max(1, F.k / 70) * 3, Math.max(0.8, F.k / 140));
  }

  function drawLines(ctx, f, F, t, e, idx) {
    var p = f.params, n = p.count;
    var tilt = p.tilt * Math.PI / 180;
    var lw = Math.max(1, F.k / 110);
    for (var i = 0; i < n; i++) {
      var u = n > 1 ? 0.1 + 0.8 * (i / (n - 1)) : 0.5;
      // each line grows out from its middle, a beat after the last
      var own = clamp((e.growth * (n + 2) - i) / 2.5, 0, 1);
      if (own <= 0) continue;
      var half = p.length * 0.5 * own;
      var dirx = Math.cos(tilt), diry = Math.sin(tilt);
      var bend = p.curve * 0.35 * half;
      var pts = [];
      for (var q = 0; q <= 10; q++) {
        var v = -1 + (q / 10) * 2;
        var lx = u + dirx * v * half - diry * bend * (1 - v * v);
        var ly = diry * v * half + dirx * bend * (1 - v * v);
        pts.push(L(F, lx, ly));
      }
      var fade = 1 - p.taper * Math.abs(i / Math.max(1, n - 1) - 0.5) * 1.4;
      var path = function (c) { pts.forEach(function (q2, k) { if (k) c.lineTo(q2[0], q2[1]); else c.moveTo(q2[0], q2[1]); }); };
      glowStroke(ctx, path, e.alpha * 0.85 * Math.max(0.25, fade) * (0.9 + 0.1 * Math.sin(t * 1.4 + i)), lw * 4.5, lw * 1.2, i % 2 ? GOLD : CREAM);
    }
  }

  function drawTexture(ctx, f, F, t, e, idx) {
    var p = f.params, rows = p.rows, cols = p.cols, total = rows * cols;
    var r = p.dot * F.k;
    var k = 0;
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++, k++) {
        if (k / total > e.growth) continue;
        var shift = (i % 2) * 0.5;
        var u = 0.5 - p.width * 0.5 + (cols > 1 ? ((j + shift) / (cols - 1 + 0.5)) * p.width : p.width * 0.5);
        var v = rows > 1 ? (-p.height * 0.5 + (i / (rows - 1)) * p.height) : 0;
        var c = L(F, u, v);
        var tw = 0.55 + 0.45 * Math.sin(t * 1.8 + noise(i, j) * 6.28);
        var a = e.alpha * 0.7 * tw;
        // a scale: an arc open toward −y in the frame, the way scales lie
        ctx.strokeStyle = rgba(j % 2 ? GOLD : CREAM, a);
        ctx.lineWidth = Math.max(0.7, r * 0.28);
        ctx.beginPath();
        var ang0 = Math.atan2(F.fy[1], F.fy[0]);
        ctx.arc(c[0], c[1], Math.max(1, r), ang0 - 2.05, ang0 + 2.05);
        ctx.stroke();
      }
    }
  }

  function drawSpike(ctx, f, F, t, e, idx) {
    var p = f.params, n = p.count;
    var spread = p.spread * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var frac = n > 1 ? i / (n - 1) : 0.5;
      var own = clamp((e.growth * (n + 1.5) - i * 0.6) / 2.2, 0, 1);
      if (own <= 0) continue;
      var bx, by, dir;
      if (p.along) {
        // spaced along A→B, standing off it toward −y
        bx = n > 1 ? 0.15 + 0.7 * frac : 0.5; by = 0;
        dir = -Math.PI / 2;
        var lenA = p.length * (0.75 + 0.25 * Math.sin(frac * Math.PI)) * own;
        spikePath(ctx, F, bx, by, dir, lenA, p.width * 0.6, p.curve, e.alpha, t, i);
      } else {
        // fanned at the anchor around +x
        bx = 0; by = 0;
        dir = (frac - 0.5) * spread;
        spikePath(ctx, F, bx, by, dir, p.length * own, p.width, p.curve * (frac < 0.5 ? -1 : 1), e.alpha, t, i);
      }
    }
  }

  function spikePath(ctx, F, bx, by, dir, len, width, curve, alpha, t, i) {
    var cx = Math.cos(dir), cy = Math.sin(dir);
    var px = -cy, py = cx;                                   // across the spike
    var tipBend = curve * 0.5 * len;
    var sway = 0.03 * len * Math.sin(t * 1.2 + i);
    var tip = [bx + cx * len + px * (tipBend + sway), by + cy * len + py * (tipBend + sway)];
    var l1 = [bx + px * width * 0.5, by + py * width * 0.5];
    var l2 = [bx - px * width * 0.5, by - py * width * 0.5];
    var m1 = [bx + cx * len * 0.5 + px * (width * 0.28 + tipBend * 0.35), by + cy * len * 0.5 + py * (width * 0.28 + tipBend * 0.35)];
    var m2 = [bx + cx * len * 0.5 - px * (width * 0.28 - tipBend * 0.35), by + cy * len * 0.5 - py * (width * 0.28 - tipBend * 0.35)];
    var S = [l1, m1, tip, m2, l2].map(function (q) { return L(F, q[0], q[1]); });
    var path = function (c) {
      c.moveTo(S[0][0], S[0][1]);
      c.quadraticCurveTo(S[1][0], S[1][1], S[2][0], S[2][1]);
      c.quadraticCurveTo(S[3][0], S[3][1], S[4][0], S[4][1]);
      c.closePath();
    };
    var base = L(F, bx, by), tp = S[2];
    var grad = ctx.createLinearGradient(base[0], base[1], tp[0], tp[1]);
    grad.addColorStop(0, rgba(CREAM, alpha * 0.34)); grad.addColorStop(1, rgba(GOLD, alpha * 0.16));
    ctx.fillStyle = grad; ctx.beginPath(); path(ctx); ctx.fill();
    glowStroke(ctx, path, alpha * 0.8, Math.max(1, F.k / 80) * 4, Math.max(1, F.k / 120));
  }

  function drawGlow(ctx, f, F, t, e) {
    var p = f.params;
    var pulse = 1 - p.pulse * 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2));
    var r = Math.max(1.5, p.radius * F.k * e.growth * pulse);
    var o = L(F, 0, 0);
    var a = e.alpha * p.intensity;
    var g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], r);
    g.addColorStop(0, rgba(CREAM, a)); g.addColorStop(0.35, rgba(GOLD, a * 0.55)); g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o[0], o[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(CREAM, a);
    ctx.beginPath(); ctx.arc(o[0], o[1], Math.max(1, r * 0.16), 0, Math.PI * 2); ctx.fill();
  }

  function drawMotes(ctx, f, F, t, e, idx) {
    var p = f.params, n = p.count;
    for (var i = 0; i < n; i++) {
      if (i / n > e.growth) continue;
      var ang = noise(idx + 1, i) * Math.PI * 2 + t * 0.12 * p.drift * (i % 2 ? 1 : -1);
      var rr = p.radius * (0.25 + 0.75 * noise(i, idx + 7)) * (1 + 0.12 * p.drift * Math.sin(t * 0.7 + i));
      var o = L(F, Math.cos(ang) * rr, Math.sin(ang) * rr);
      var tw = 0.45 + 0.55 * Math.sin(t * 2.4 + noise(i, 3) * 6.28);
      var r = Math.max(1, p.dot * F.k) * (0.7 + 0.3 * tw);
      var a = e.alpha * tw;
      var g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], r * 3);
      g.addColorStop(0, rgba(CREAM, a)); g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o[0], o[1], r * 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  var DRAW = { contour: drawContour, fill: drawFill, lines: drawLines, texture: drawTexture, spike: drawSpike, glow: drawGlow, motes: drawMotes };

  // Draw every feature whose envelope allows it. Returns how many were
  // painted, so a caller can say whether anything is on screen.
  function draw(ctx, features, P, t, envFor) {
    var painted = 0;
    (features || []).forEach(function (f, i) {
      var e = envFor ? envFor(i) : { alpha: 1, growth: 1, phase: 'hold' };
      if (!e || e.alpha <= 0.002) return;
      var F = frameOf(f, P);
      if (!F) return;
      ctx.save();
      try { DRAW[f.type](ctx, f, F, t || 0, e, i); painted++; } catch (err) { /* a bad number never breaks the sky */ }
      ctx.restore();
    });
    return painted;
  }

  global.LabReveal = {
    VERSION: VERSION,
    TYPES: TYPES.slice(),
    LIMITS: JSON.parse(JSON.stringify(LIMITS)),
    TIMING: JSON.parse(JSON.stringify(TIMING)),
    PARAMS: JSON.parse(JSON.stringify(PARAMS)),
    defaults: defaults,
    cleanName: cleanName,
    cleanParam: cleanParam,
    sanitize: sanitize,
    make: make,
    onPointDeleted: onPointDeleted,
    frameOf: frameOf,
    originOf: function (f, P) { var F = frameOf(f, P); return F ? [F.ox, F.oy] : null; },
    offsetDelta: offsetDelta,
    envelope: envelope,
    totalMs: totalMs,
    draw: draw
  };
})(typeof window !== 'undefined' ? window : this);
