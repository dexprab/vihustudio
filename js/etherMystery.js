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
    outcomesKept: 24     // diagnostics ring bound
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

      // Assembly point for 'gather': the centroid of the pieces.
      var cxs = 0, cys = 0;
      elements.forEach(function (el) { cxs += el.home.x; cys += el.home.y; });
      var assembly = { x: cxs / elements.length, y: cys / elements.length };

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
        assembly: assembly,
        creation: creation ? {
          id: creation.projection.id,
          entity: creation.entity,
          title: creation.projection.title
        } : null,
        img: img,
        born: time,
        lifeS: Math.min(con.lifeS || LIMITS.lifeS, grammar.CAPABILITIES.bounds.lifeS),
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
      inst.closeAt = time + LIMITS.fadeS;
      inst.elements.forEach(function (el) {
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
          // this canvas, nothing written to the entity.
          pushEffect({ kind: 'travel', from: { x: at.x, y: at.y },
                       entity: inst.creation.entity, t: 0, dur: 2.8 });
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
      var tappable = bestEl.armed.some(function (r) { return r.action === 'tap'; });
      if (tappable && !bestEl.engaged) engageEl(bestEl, 'tap');
      else bestEl.tw += 2;   // a small acknowledging shiver either way
      return true;           // a posed thing is never empty sky
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

    function update(dt) {
      for (var i = effects.length - 1; i >= 0; i--) {
        effects[i].t += dt;
        if (effects[i].kind === 'travel' && effects[i].t >= effects[i].dur &&
            !effects[i].landed) {
          effects[i].landed = true;
          var ent = effects[i].entity;
          var at2 = (ent && ent.position) ? { x: ent.position.x, y: ent.position.y }
                                          : effects[i].from;
          pushEffect({ kind: 'halo', at: at2, entity: ent, t: 0, dur: 6 });
        }
        var lifespan = effects[i].kind === 'travel'
          ? effects[i].dur + 0.2 : effects[i].dur;
        if (effects[i].t > lifespan) effects.splice(i, 1);
      }
      if (!inst) return;

      if (inst.state === 'closing') {
        inst.elements.forEach(function (el) {
          el.alpha = Math.max(0, el.alpha - dt / LIMITS.fadeS);
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
      if (!inst && !effects.length) {
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
        if (inst.behaviour === 'link') {
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
        for (i = 0; i < inst.elements.length; i++) {
          var el = inst.elements[i];
          if (el.alpha <= 0.01) continue;
          sx = nearestCopy(el.x + cam.x, ether.width, cx);
          sy = nearestCopy(el.y + cam.y, ether.height, cy);
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
          elements: inst.elements.map(function (el) {
            return { role: el.role, show: el.show, x: el.x, y: el.y,
                     alpha: Math.round(el.alpha * 100) / 100,
                     engaged: el.engaged, hidden: el.hidden,
                     prox: Math.round(el.prox * 100) / 100 };
          }),
          effects: effects.map(function (f) { return f.kind; })
        };
      },
      outcomes: function () { return outcomes.slice(); },
      diagnostics: function () {
        return {
          quiet: false,
          pool: loaded.report.slice(),
          activeKeys: loaded.active.map(function (a) { return a.id; }),
          live: inst ? { key: inst.key, state: inst.state } : null,
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
