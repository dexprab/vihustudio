// etherRipple.js — the Ether notices a touch.
//
// SPRINT — Exploration Nudge & Ether Ripple.
//
// When a Traveller deliberately taps the empty Ether, the Ether
// answers: a slow, irregular wavefront of light spreads from the
// exact place they touched, a few faint star-motes stir near it, and
// then the sky is as it was. The emotional meaning is "the Ether
// noticed me" — it is not a game mechanic, not a reward, and not a UI
// click effect. The wavefront is deliberately organic: its radius is
// modulated by slow harmonics with phases drawn fresh for every
// touch, so no two ripples are the same shape and none of them reads
// as a button ring.
//
// A RIPPLE IS ALWAYS AN INTERACTION, NOT ALWAYS A DISCOVERY. The
// acknowledgment — the ripple itself — is this layer's, immediate,
// the same grammar as a creature's swell-ack (V2.1): a child is never
// left wondering whether the sky felt their touch. WHETHER anything
// more answers is never this file's decision: it emits one event and
// the Experience Composer (js/etherExperience.js) reasons over world
// state, very often choosing nothing further — which is a valid and
// important outcome. There is no scheduler in this file: nothing here
// runs on a clock of its own, nothing is offered unprompted, and the
// only thing that can make a ripple is a real tap.
//
// TAP OWNERSHIP (Decision 58's own order, unchanged):
//   · a tap on a Story Spirit belongs to the Spirit;
//   · a tap in a creature's hit region belongs to the creature layer
//     (even a 'none'-manner passage that chooses not to answer — a
//     being is not empty sky);
//   · a plain tap on open sky while a Spirit is focused CLOSES the
//     Spirit (the universe's own gesture, universe.js) and does NOT
//     also ripple — one tap has one meaning, and answering it twice
//     would turn a deliberate "send it home" into noise;
//   · a drag never ripples: the traveller's own click-suppression
//     (core/traveller.js) eats the click a drag ends in before it can
//     reach this listener, so no second drag detector exists here;
//   · everything left — an intentional tap on the empty field — is
//     the ripple's.
//
// RAPID TAPPING NEVER BECOMES A GAME. Two dampeners, neither of them
// a counter a child could see: taps faster than a breath apart are
// one touch, not several; and the sky's interest is a small reservoir
// that each ripple spends and quiet slowly refills, so a burst of
// taps gets visibly fainter ripples and the Composer is only ever
// told about unhurried ones. Nothing is locked, nothing is announced,
// and a child who simply stops for a moment finds the sky as awake as
// ever.
//
// REDUCED MOTION. An expanding wave is motion, and this layer follows
// the product's own line (core/traveller.js): what the child does
// deliberately is answered, what they did not ask for is silenced. So
// under reduced motion a tap is still acknowledged — a soft, still
// glow at the touched place that fades by opacity alone — and nothing
// travels, nothing stirs, and the Composer is not consulted (its own
// mount is inert there anyway).
//
// A TRAVELLER IS STATELESS (Decision 19). Nothing here is stored
// anywhere; every ripple dies on its own inside two seconds and the
// whole layer dies with the page.
//
// HOW IT PLUGS IN. Exactly as js/etherLife.js does: one canvas
// beneath the story plane, pointer-events none, reading only the
// seams the runtime already exposes (ether, camera.offsetFor, focus,
// isRunning). No file under vihuplanet/runtime/ is edited — Decision
// 9's own test.

(function (global) {
  'use strict';

  // The interaction grammar, in one place.
  var TUNING = {
    minGap: 0.35,      // s — taps faster than this are one touch
    spend: 0.22,       // interest each ripple costs
    regen: 0.06,       // interest refilled per quiet second
    speakAt: 0.5,      // below this the Composer is not even told
    waveLife: 1.9,     // s a wavefront takes to spread and go
    echoLife: 1.6,     // s a returning wave takes to arrive
    stillLife: 1.2,    // s the reduced-motion glow takes to fade
    reach: 235,        // px the wavefront spreads, at desktop size
    reachMin: 120,     // px it never shrinks below — visible on any view
    reachFrac: 0.42    // of the view's short edge, where that is smaller
  };
  // A ripple's spread belongs to the sky it spreads in. 235px is right
  // for a laptop and is 60% of a phone's width — a wave that big reads
  // as the whole screen flashing rather than light leaving the touched
  // place. Each ripple takes the smaller of the desktop reach and a
  // fraction of the view's short edge, measured AT THE TOUCH (a
  // rotation mid-flight does not resize a wave already travelling):
  // 390px phone → 164 · 768 tablet → 235 (capped) · desktop → 235.
  function reachFor(ether) {
    var short = Math.min(ether.viewWidth || 0, ether.viewHeight || 0);
    if (!(short > 0)) return TUNING.reach;
    return Math.max(TUNING.reachMin,
                    Math.min(TUNING.reach, short * TUNING.reachFrac));
  }

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function hexRgb(hex) {
    var h = String(hex || '#F1EAD0').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }
  function makeSprite(rgb) {
    var c = global.document.createElement('canvas');
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

  function mount(universe, opts) {
    opts = opts || {};
    if (!universe || !universe.root || !universe.ether || !universe.camera) return null;

    var VihuPlanet = global.VihuPlanet;
    var Util = VihuPlanet && VihuPlanet.Util;
    var Env = VihuPlanet && VihuPlanet.Env;
    if (!Util) return null;

    var reduced = !!(Env && Env.reducedMotion && Env.reducedMotion());
    var life = opts.life || null;   // the creature layer, for tap ownership
    var ether = universe.ether;
    var camera = universe.camera;

    // ---------- events ----------
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

    // ---------- the canvas ----------
    // Beneath the story plane, like the creature layer: the ripple is
    // part of the sky and the Spirits drift in front of it.
    var canvas = global.document.createElement('canvas');
    canvas.className = 'vp-ether-ripple';
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
    var starSprite = makeSprite(starRgb);
    var glowSprite = makeSprite(glowRgb);

    // ---------- state (session-only, dies with the page) ----------
    var ripples = [];        // live waves, echoes, still glows
    var interest = 1;        // the sky's reservoir; taps spend it
    var lastTapAt = -999;
    var touches = 0;         // asked by a suite, shown to nobody
    var time = 0;
    var destroyed = false;
    var camScratch = { x: 0, y: 0 };

    function nearestCopy(v, span, centre) {
      if (!(span > 0)) return v;
      return v - Math.round((v - centre) / span) * span;
    }

    // ---------- a touch ----------
    function touch(sx, sy) {
      if (time - lastTapAt < TUNING.minGap) return null;
      lastTapAt = time;
      var strength = Util.clamp(interest, 0.2, 1);
      interest = Math.max(0, interest - TUNING.spend);

      var cam = camera.offsetFor(ether.depth.stories, camScratch);
      var fx = sx - cam.x, fy = sy - cam.y;   // field, on the story plane
      var r = {
        kind: reduced ? 'still' : 'wave',
        fx: fx, fy: fy, born: time, strength: strength,
        reach: reachFor(ether),
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        motes: []
      };
      if (!reduced) {
        // A few faint star-motes stir near the touch — the nearby
        // environment reacting, drawn on this layer's own canvas
        // (nothing the renderer owns is ever written).
        var n = 5 + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) {
          var ang = Math.random() * Math.PI * 2;
          r.motes.push({
            ang: ang,
            r0: rand(18, 60),
            drift: rand(22, 55),
            tw: Math.random() * Math.PI * 2
          });
        }
      }
      ripples.push(r);
      if (ripples.length > 6) ripples.shift();
      touches++;
      // The Composer hears only unhurried touches: a burst never
      // reaches composition at all, so tapping cannot be farmed for
      // an answer.
      if (!reduced && strength >= TUNING.speakAt) {
        emit('touched', { x: fx, y: fy, screen: { x: sx, y: sy }, strength: strength });
      }
      return { strength: strength };
    }

    // The Composer's one way of answering through this layer: a
    // fainter wave returning to the touched place a moment later —
    // the sky answering back from the distance.
    function echoAt(fx, fy) {
      if (reduced) return null;
      ripples.push({
        kind: 'echo', fx: fx, fy: fy, born: time,
        strength: 0.8, reach: reachFor(ether),
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        motes: []
      });
      if (ripples.length > 6) ripples.shift();
      emit('echo', {});
      return true;
    }

    // ---------- the tap listener ----------
    // The canvas takes no pointer events; taps are read off the
    // universe root, the same seam the creature layer already uses.
    function onRootClick(ev) {
      // Only a tap that landed on the sky itself: the universe root,
      // or a canvas child of it (the renderer's, this layer's). A tap
      // on a Spirit, a button, an overlay or a panel is that thing's.
      var t = ev.target;
      var onSky = (t === universe.root) ||
        (t && t.tagName === 'CANVAS' && t.parentNode === universe.root);
      if (!onSky) return;
      // While a Spirit is focused, a sky tap SENDS IT HOME — the
      // universe's own gesture (universe.js). One tap, one meaning:
      // it does not also ripple.
      try {
        if (universe.focus && universe.focus.isOpen && universe.focus.isOpen()) return;
      } catch (e) {}
      var rect = universe.root.getBoundingClientRect();
      var rx = ev.clientX - rect.left, ry = ev.clientY - rect.top;
      // A creature's hit region is the creature layer's — the same
      // box its own listener claims, so the two can never both answer
      // one tap.
      if (life && life.active) {
        try {
          var a = life.active();
          if (a) {
            var CR = global.EtherLife && global.EtherLife.CREATURES;
            var span = (CR && CR[a.id] && CR[a.id].span) || 300;
            var half = span * 0.55;
            if (Math.abs(rx - a.screen.x) < half &&
                Math.abs(ry - a.screen.y) < half * 0.7) return;
          }
        } catch (e2) {}
      }
      touch(rx, ry);
    }
    universe.root.addEventListener('click', onRootClick);

    // ---------- per-frame ----------
    var lastNow = null;
    function frame(now) {
      if (destroyed) return;
      global.requestAnimationFrame(frame);
      if (lastNow === null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      if (!universe.isRunning || !universe.isRunning()) { draw(); return; }
      time += dt;
      interest = Math.min(1, interest + TUNING.regen * dt);
      for (var i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        var lifeS = r.kind === 'echo' ? TUNING.echoLife
                  : r.kind === 'still' ? TUNING.stillLife : TUNING.waveLife;
        if (time - r.born > lifeS) ripples.splice(i, 1);
      }
      draw();
    }

    // ---------- drawing ----------
    function draw() {
      var w = canvas.width, h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!ripples.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var breath = (ether.ambient && ether.ambient.breath) || 1;
      var cam = camera.offsetFor(ether.depth.stories, camScratch);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;

      for (var i = 0; i < ripples.length; i++) {
        var r = ripples[i];
        var sx = nearestCopy(r.fx + cam.x, ether.width, cx);
        var sy = nearestCopy(r.fy + cam.y, ether.height, cy);
        var age = time - r.born;

        if (r.kind === 'still') {
          // Reduced motion: a soft, stationary acknowledgment that
          // fades by opacity alone. Nothing travels.
          var sa = (1 - Util.clamp(age / TUNING.stillLife, 0, 1)) * 0.5 * r.strength;
          if (sa <= 0) continue;
          ctx.globalAlpha = sa;
          ctx.drawImage(glowSprite, sx - 46, sy - 46, 92, 92);
          continue;
        }

        var lifeS = r.kind === 'echo' ? TUNING.echoLife : TUNING.waveLife;
        var t = Util.clamp(age / lifeS, 0, 1);
        var eased = 1 - Math.pow(1 - t, 2);
        // The wave spreads out; the echo arrives back in.
        var reach = r.reach || TUNING.reach;
        var radius = r.kind === 'echo'
          ? (1 - eased) * reach * 0.8 + 26
          : eased * reach * (0.6 + 0.4 * r.strength) + 12;
        var fade = r.kind === 'echo'
          ? Util.clamp(t * 3, 0, 1) * (1 - Util.clamp((t - 0.75) / 0.25, 0, 1))
          : (1 - t);
        var a = fade * (r.kind === 'echo' ? 0.2 : 0.3) * r.strength * breath;
        if (a <= 0) continue;

        // The wavefront: an irregular ring of light — a living
        // fabric answering, never a UI circle. The radius is
        // modulated by two slow harmonics whose phases belong to
        // this one touch.
        ctx.strokeStyle = rgba(glowRgb, a);
        ctx.lineWidth = r.kind === 'echo' ? 1.1 : 1.5;
        ctx.beginPath();
        var SEG = 44;
        for (var s = 0; s <= SEG; s++) {
          var th = (s / SEG) * Math.PI * 2;
          var mod = 1 + 0.07 * Math.sin(th * 5 + r.ph1 + time * 0.8)
                      + 0.05 * Math.sin(th * 3 - r.ph2 + time * 0.5);
          var px = sx + Math.cos(th) * radius * mod;
          var py = sy + Math.sin(th) * radius * mod * 0.82;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        if (r.kind === 'wave') {
          // The first breath of light at the touched place itself.
          var bloomA = Math.max(0, 1 - age / 0.7) * 0.45 * r.strength * breath;
          if (bloomA > 0) {
            ctx.globalAlpha = bloomA;
            ctx.drawImage(glowSprite, sx - 40, sy - 40, 80, 80);
          }
          // The nearby stir: faint motes easing outward and settling.
          for (var m = 0; m < r.motes.length; m++) {
            var mo = r.motes[m];
            var mr = mo.r0 + eased * mo.drift;
            var tw = 0.6 + 0.4 * Math.sin(time * 2.1 + mo.tw);
            ctx.globalAlpha = (1 - t) * 0.4 * r.strength * tw * breath;
            var msz = 3.2 * tw;
            ctx.drawImage(starSprite,
              sx + Math.cos(mo.ang) * mr - msz * 2,
              sy + Math.sin(mo.ang) * mr * 0.82 - msz * 2,
              msz * 4, msz * 4);
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }

    global.requestAnimationFrame(frame);

    return {
      quiet: false,
      reduced: reduced,
      on: on, off: off,
      touch: touch,       // the same path a real tap takes, for a suite
      echoAt: echoAt,
      setLife: function (l) { life = l || null; },
      active: function () {
        var cam = camera.offsetFor(ether.depth.stories, camScratch);
        var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
        return ripples.map(function (r) {
          return {
            kind: r.kind, strength: r.strength,
            age: Math.round((time - r.born) * 100) / 100,
            screen: {
              x: nearestCopy(r.fx + cam.x, ether.width, cx),
              y: nearestCopy(r.fy + cam.y, ether.height, cy)
            }
          };
        });
      },
      touches: function () { return touches; },
      interest: function () { return interest; },
      tuning: TUNING,
      destroy: function () {
        destroyed = true;
        universe.root.removeEventListener('click', onRootClick);
        universe.off('ether:resized', sizeCanvas);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        emit('destroyed', {});
      }
    };
  }

  global.EtherRipple = {
    TUNING: TUNING,
    reachFor: reachFor,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
