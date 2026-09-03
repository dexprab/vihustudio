// etherLife.js — the Ether's own life. Mythical beings that pass
// through the universe, rarely, and sometimes answer being noticed.
//
// SPRINT — Ether Traveller Experience: First 20 Seconds.
//
// The Ether is not a Story browser: Stories are things that live
// INSIDE it, and a fresh Traveller should learn through experience —
// never through instruction — that this place can be explored and that
// exploring leads somewhere. This layer is the "something moves across
// the Traveller's path" half of that teaching: a vast, gentle creature
// drawn in starlight crosses the sky soon after a child first looks at
// the universe, and occasionally, much later, another one does.
//
// WHAT A CREATURE IS. A constellation being: a handful of paper-cream
// stars joined by faint lines, breathing, undulating, carried across
// the field on its own slow path. Procedural, in the Ether's own
// palette, no images and no animation library — Decision 9's "alive
// through behaviour, not illustration" applies to a whale exactly as
// it applies to the mist. Stars are paper-cream, never white.
//
// RARITY IS THE DESIGN. One early crossing for a fresh Traveller — the
// 20-second rule is a behavioural target, so the first hook arrives
// inside it — and then minutes of nothing. A creature that is always
// on screen is wallpaper; one that is occasionally there is a
// question. The objective is "did I just see that?", never clutter.
//
// INTERACTION, NOT DECORATION. A creature has the same nearness the
// Story Spirits have — prox is distance from the centre of the screen,
// because the Traveller IS the centre — and noticing it (turning
// toward it, or touching it) makes it respond. The whale's response is
// the one built end-to-end: it slows, arcs gently away, and breathes
// out a trail of guide-motes that lead toward something worth finding.
// WHAT it leads to is never this file's decision: a composer
// (js/etherDiscovery.js) is asked, and this layer only shows the
// answer. Creatures guide discovery; they are not a game system.
//
// HOW IT PLUGS IN. Entirely through seams the runtime already
// exposes — universe.ether, universe.camera.offsetFor(), the manager's
// entities (read only, exactly as a renderer may), universe.on() and
// universe.isRunning(). No file under vihuplanet/runtime/ is edited to
// make creatures exist, which is Decision 9's own test. The layer owns
// one canvas, inserted beneath the story plane so a whale passes
// BEHIND the Stories with the near dust still swimming in front, and
// it is pointer-events: none — a tap meant for a Spirit can never be
// intercepted by the sky.
//
// A TRAVELLER IS STATELESS (Decision 19). Nothing here is stored,
// anywhere: which creatures passed and what was discovered die with
// the page, so every arrival in the Ether is a fresh one.
//
// REDUCED MOTION. A creature crossing the sky is exactly the kind of
// unrequested motion the setting exists to silence — the same call the
// Ambient System makes for shooting stars — so under reduced motion
// this layer mounts inert: no encounters, no trail, nothing scheduled.
//
// NO SCORES, NO PROGRESSION. An encounter earns nothing countable and
// nothing is kept. The loop it serves is the product's own:
// explore → discover → a creation → "someone made this" →
// "I could make something too."

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // The creature registry. DATA, never a branch: a new being is a new
  // entry here (and, if it guides, a response the composer can serve),
  // not a rewrite of the layer. Points are a normalized skeleton
  // (x -1 tail .. 1 head), links join them, and everything else is
  // temperament: how big, how deep, how fast, how rare, and what it
  // does when a Traveller notices it.
  //
  //   response: 'guide'  it asks the composer for a target and breathes
  //                      out a trail of motes that lead there (whale)
  //             'pulse'  it answers with light — a soft ring, a swell —
  //                      and moves on (jellyfish)
  //             'glint'  it is only ever almost-seen: fast, faint, a
  //                      brief sparkle behind it (starbird)
  // ---------------------------------------------------------------
  var CREATURES = {
    whale: {
      id: 'whale',
      span: 520,            // field px, nose to fluke
      parallax: 0.82,       // just behind the story plane — vast, far
      speed: 42,            // field px/s — stately, still a crossing
      alpha: 0.8,
      wave: { amp: 14, freq: 0.55 },
      response: 'guide',
      points: [
        [ 1.00,  0.02], [ 0.78, -0.14], [ 0.44, -0.24], [ 0.04, -0.26],
        [-0.38, -0.19], [-0.72, -0.06], [-1.00, -0.26], [-0.93,  0.18],
        [-0.48,  0.16], [ 0.02,  0.22], [ 0.58,  0.20], [ 0.80, -0.01]
      ],
      links: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],   // the back
        [5, 6], [5, 7],                            // the fluke
        [5, 8], [8, 9], [9, 10], [10, 0]           // the belly, the jaw
      ],
      eye: 11
    },
    jellyfish: {
      id: 'jellyfish',
      span: 190,
      parallax: 0.9,
      speed: 12,
      alpha: 0.7,
      wave: { amp: 22, freq: 0.35 },
      response: 'pulse',
      points: [
        [ 0.00, -0.55], [-0.55, -0.15], [ 0.55, -0.15],
        [-0.40,  0.55], [-0.05,  0.75], [ 0.35,  0.60], [ 0.00,  0.10]
      ],
      links: [[0, 1], [0, 2], [1, 6], [2, 6], [6, 3], [6, 4], [6, 5]],
      eye: 0
    },
    starbird: {
      id: 'starbird',
      span: 240,
      parallax: 1.06,       // in front of the stories — a near flicker
      speed: 150,
      alpha: 0.55,
      wave: { amp: 26, freq: 1.4 },
      response: 'glint',
      points: [
        [ 1.00, 0.00], [ 0.45, -0.10], [-0.15, -0.42], [-0.75, -0.60],
        [-0.15,  0.10], [-0.85,  0.28], [-1.00, 0.02]
      ],
      links: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 6]],
      eye: 0
    }
  };

  // ---------------------------------------------------------------
  // Scheduling. The first crossing arrives while a fresh Traveller is
  // still deciding what this place is — inside the 20-second window,
  // never instantly (the arrival turn is already speaking) and never
  // delayed to fill it. After that, minutes: rarity is what keeps a
  // creature an event. Overridable so a suite can compress time
  // without the product carrying a test clock.
  // ---------------------------------------------------------------
  var TIMES = {
    firstArrival: [6.5, 10],
    between: [95, 220],
    trailLife: 50,          // s a trail waits before giving up, gently
    noticeHold: 0.45,       // s of sustained nearness before it counts
    respondDelay: 0.5       // being noticed is felt a beat later
  };

  // Later crossings are usually the whale again, sometimes not.
  var LATER_PICKS = [
    ['whale', 0.5], ['jellyfish', 0.3], ['starbird', 0.2]
  ];

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function coin() { return Math.random() < 0.5 ? -1 : 1; }

  function hexRgb(hex) {
    var h = String(hex || '#F1EAD0').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  // One soft radial sprite per colour, drawn once and scaled at draw
  // time — the same economy the Ether Renderer runs on.
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

    var ether = universe.ether;
    var camera = universe.camera;
    var times = opts.times || TIMES;

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

    // ---------- reduced motion mounts inert ----------
    //
    // The API surface stays whole so callers never branch; it simply
    // never does anything. The universe is a still, complete picture
    // there, and a whale swimming through it would un-still it.
    if (Env && Env.reducedMotion()) {
      return {
        quiet: true,
        creatures: function () { return Object.keys(CREATURES); },
        active: function () { return null; },
        trail: function () { return null; },
        summon: function () { return null; },
        setComposer: function () {},
        on: on, off: off,
        times: times,
        destroy: function () {}
      };
    }

    // ---------- the canvas ----------
    //
    // Beneath the story plane: a creature is part of the sky, so
    // Spirits drift in front of it and the foreground dust in front of
    // both. pointer-events: none — the layer is looked at, never
    // touched directly; touches are read off the universe root below.
    var canvas = global.document.createElement('canvas');
    canvas.className = 'vp-ether-life';
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var storyLayerEl = universe.root.querySelector('.vp-story-layer');
    if (storyLayerEl) universe.root.insertBefore(canvas, storyLayerEl);
    else universe.root.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var dpr = Env.dpr();
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

    // ---------- state ----------
    var composer = opts.composer || null;
    var enc = null;          // the current encounter, or null
    var trail = null;        // the current guide trail, or null
    var nextAt = rand(times.firstArrival[0], times.firstArrival[1]);
    var hadFirst = false;
    var elapsed = 0;
    var time = 0;
    var destroyed = false;
    var camScratch = { x: 0, y: 0 };
    var camStory = { x: 0, y: 0 };

    // The nearest whole-field copy — the same wrap the Spirits use, so
    // a creature crosses the seam without vanishing at it.
    function nearestCopy(v, span, centre) {
      if (!(span > 0)) return v;
      return v - Math.round((v - centre) / span) * span;
    }

    function pickLater() {
      var r = Math.random(), acc = 0;
      for (var i = 0; i < LATER_PICKS.length; i++) {
        acc += LATER_PICKS[i][1];
        if (r <= acc) return LATER_PICKS[i][0];
      }
      return 'whale';
    }

    // ---------- an encounter ----------
    function summon(id) {
      var def = CREATURES[id || 'whale'];
      if (!def || enc) return null;

      var cam = camera.offsetFor(def.parallax, camScratch);
      var dir = coin();
      var vw = ether.viewWidth, vh = ether.viewHeight;
      // Enter with the nose already at the edge of the VIEW — spawned
      // in field coordinates, so if the child turns away mid-crossing
      // the creature stays where it is in the sky rather than
      // following the screen around. A place has residents, not
      // decals. 0.45 of the span puts the head at the screen's edge at
      // the moment of arrival: the crossing begins where it can be
      // seen beginning, which is what makes the first one land inside
      // the 20-second window instead of spending it off stage.
      var screenX = dir > 0 ? -def.span * 0.45 : vw + def.span * 0.45;
      var screenY = vh * (0.5 + rand(-0.2, 0.2));
      enc = {
        id: def.id,
        def: def,
        dir: dir,
        pos: { x: screenX - cam.x, y: screenY - cam.y },
        baseY: screenY - cam.y,
        veer: 0,              // the arc away when noticed
        speedScale: 1,
        swell: 0,             // glow of being noticed
        prox: 0,
        noticed: 0,
        noticedFor: 0,
        responded: false,
        respondIn: -1,
        pulse: 0,             // jellyfish's answer
        born: time,
        screen: { x: 0, y: 0 },
        alive: true
      };
      emit('creature:arrived', { id: def.id });
      return enc.id;
    }

    // A creature was genuinely noticed: turned toward, or touched.
    function notice() {
      if (!enc || enc.responded || enc.respondIn >= 0) return;
      enc.respondIn = times.respondDelay;
      emit('creature:noticed', { id: enc.id });
    }

    function respond() {
      if (!enc || enc.responded) return;
      enc.responded = true;
      enc.swell = 1;

      if (enc.def.response === 'guide') {
        // It arcs a little away from the Traveller — noticed, not
        // caught — and breathes out the trail.
        enc.veer = (enc.screen.y < ether.viewHeight * 0.5 ? -1 : 1) * 46;
        enc.speedScale = 0.45;
        beginTrail();
      } else if (enc.def.response === 'pulse') {
        enc.pulse = 1;
      }
      // 'glint' creatures respond by having already gone.
      emit('creature:responded', { id: enc.id, response: enc.def.response });
    }

    // ---------- the guide trail ----------
    //
    // The whale's breath: a run of small lights from where it was
    // toward something worth finding. The composer decides WHAT — a
    // Story Spirit drifting unseen, or, when the Ether holds no
    // eligible Story, a small wonder of the sky's own. Following the
    // trail is just looking along it: the motes pulse toward the
    // target, and the target is far enough that finding it teaches the
    // universe turns.
    function beginTrail() {
      if (trail || !composer) return;
      var target = null;
      try { target = composer({ creature: enc.id }); } catch (e) {}
      if (!target) return;

      var cam = camera.offsetFor(ether.depth.stories, camStory);
      // From the creature's head, converted onto the story plane.
      var from = {
        x: enc.screen.x + enc.def.span * 0.5 * enc.dir - cam.x,
        y: enc.screen.y - cam.y
      };
      var to = { x: target.x, y: target.y };
      // The nearest copy of the target to the trail's start, so the
      // trail never points the long way round a universe that wraps.
      to.x = nearestCopy(to.x, ether.width, from.x);
      to.y = nearestCopy(to.y, ether.height, from.y);

      var dx = to.x - from.x, dy = to.y - from.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var count = Math.max(7, Math.min(13, Math.round(dist / 130)));
      // A gentle bow perpendicular to the line — breath drifts, it
      // does not shoot.
      var bow = Math.min(120, dist * 0.18) * coin();
      var px = -dy / dist, py = dx / dist;
      var motes = [];
      for (var i = 0; i < count; i++) {
        var t = (i + 1) / (count + 1);
        var arc = Math.sin(t * Math.PI) * bow;
        motes.push({
          x: from.x + dx * t + px * arc,
          y: from.y + dy * t + py * arc,
          delay: 0.6 + i * 0.28,       // they appear one after another
          tw: Math.random() * Math.PI * 2
        });
      }
      trail = {
        motes: motes,
        target: target,
        from: from,
        born: time,
        state: 'guiding',   // guiding → found → gone
        foundAt: 0,
        bloom: null
      };
      emit('trail:begun', { target: { kind: target.kind, id: target.id || null } });
    }

    function targetProx(cam) {
      var t = trail.target;
      if (t.kind === 'story' && t.entity) {
        // The Spirits already computed it this frame; read, never write.
        return t.entity.prox || 0;
      }
      var sx = nearestCopy(t.x + cam.x, ether.width, ether.viewWidth * 0.5);
      var sy = nearestCopy(t.y + cam.y, ether.height, ether.viewHeight * 0.5);
      var ddx = sx - ether.viewWidth * 0.5, ddy = sy - ether.viewHeight * 0.5;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      var far = Math.min(ether.viewWidth, ether.viewHeight) * 0.4;
      return Util.smooth(1 - Util.clamp(dist / far, 0, 1));
    }

    function updateTrail(dt) {
      if (!trail) return;
      var age = time - trail.born;
      var cam = camera.offsetFor(ether.depth.stories, camStory);

      if (trail.state === 'guiding') {
        if (targetProx(cam) > 0.55) {
          trail.state = 'found';
          trail.foundAt = time;
          // A wonder blooms; a Story needs nothing added to it — its
          // own light and cover are the discovery, and the trail
          // simply arrives and settles.
          if (trail.target.kind === 'wonder') {
            trail.bloom = { born: time };
          }
          emit('trail:found', {
            target: { kind: trail.target.kind, id: trail.target.id || null }
          });
        } else if (age > times.trailLife) {
          trail.state = 'gone';
          trail = null;
          emit('trail:faded', {});
          return;
        }
      } else if (trail.state === 'found') {
        // The motes have said their piece; they settle and go.
        if (time - trail.foundAt > (trail.bloom ? 7 : 2.4)) {
          trail = null;
          emit('trail:gone', {});
        }
      }
    }

    // ---------- per-frame ----------
    var lastNow = null;

    function frame(now) {
      if (destroyed) return;
      global.requestAnimationFrame(frame);

      if (lastNow === null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      // The universe's clock is stopped while a child reads (the
      // portal) — the sky freezes, and so does everything living in
      // it. While a Spirit is merely being met the universe gently
      // slows; the creatures slow with it rather than swimming at full
      // speed through a held moment.
      if (!universe.isRunning || !universe.isRunning()) { draw(); return; }
      var open = false;
      try { open = universe.focus && universe.focus.isOpen(); } catch (e) {}
      if (open) dt *= 0.28;

      time += dt;
      elapsed += dt;

      if (!enc && elapsed >= nextAt) {
        // The first crossing is always the whale — the one being whose
        // response is built end-to-end, so a fresh Traveller's first
        // encounter is the one that can lead somewhere.
        summon(hadFirst ? pickLater() : 'whale');
        hadFirst = true;
      }

      if (enc) updateEncounter(dt);
      updateTrail(dt);
      draw();
    }

    function updateEncounter(dt) {
      var def = enc.def;
      enc.pos.x += def.speed * enc.speedScale * enc.dir * dt;
      // The veer eases in once noticed and dies away on its own — an
      // arc, not a new heading; the wave is its ordinary swimming.
      if (enc.veer) {
        enc.baseY += enc.veer * dt * 0.4;
        enc.veer *= Math.max(0, 1 - dt * 0.5);
      }
      enc.pos.y = enc.baseY + Math.sin(time * def.wave.freq) * def.wave.amp * 0.4;

      var cam = camera.offsetFor(def.parallax, camScratch);
      enc.screen.x = nearestCopy(enc.pos.x + cam.x, ether.width, ether.viewWidth * 0.5);
      enc.screen.y = nearestCopy(enc.pos.y + cam.y, ether.height, ether.viewHeight * 0.5);

      // Nearness, the Spirits' own sentence: distance from the centre
      // of the screen, because the Traveller IS the centre.
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var ddx = enc.screen.x - cx, ddy = enc.screen.y - cy;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      var shortest = Math.min(ether.viewWidth, ether.viewHeight);
      enc.prox = Util.smooth(1 - Util.clamp(
        (dist - shortest * 0.14) / (shortest * 0.5 - shortest * 0.14), 0, 1));

      // Notice LAGS nearness — being noticed happens to the creature a
      // moment after the child turns toward it, exactly as it does to
      // a Spirit. A readout of the pointer would be a cursor effect.
      enc.noticed += (enc.prox - enc.noticed) * (1 - Math.exp(-2.1 * dt));

      if (!enc.responded && enc.respondIn < 0 && def.response !== 'glint') {
        if (enc.noticed > 0.5) {
          enc.noticedFor += dt;
          if (enc.noticedFor >= times.noticeHold) notice();
        } else {
          enc.noticedFor = 0;
        }
      }
      if (enc.respondIn >= 0) {
        enc.respondIn -= dt;
        if (enc.respondIn < 0) respond();
      }

      if (enc.swell > 0) enc.swell = Math.max(0, enc.swell - dt * 0.35);
      if (enc.pulse > 0) enc.pulse = Math.max(0, enc.pulse - dt * 0.45);
      if (enc.responded) enc.speedScale += (1 - enc.speedScale) * dt * 0.4;

      // Gone once past the far side of the view, with room to spare.
      var beyond = def.span * 0.8;
      if ((enc.dir > 0 && enc.screen.x > ether.viewWidth + beyond) ||
          (enc.dir < 0 && enc.screen.x < -beyond)) {
        emit('creature:gone', { id: enc.id });
        enc = null;
        nextAt = elapsed + rand(times.between[0], times.between[1]);
      }
    }

    // A touch on the sky. The canvas takes no pointer events; the host
    // page asks on the universe root's behalf.
    function onRootClick(ev) {
      if (!enc || enc.responded) return;
      var rect = universe.root.getBoundingClientRect();
      var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      var half = enc.def.span * 0.55;
      if (Math.abs(x - enc.screen.x) < half &&
          Math.abs(y - enc.screen.y) < half * 0.7) {
        notice();
      }
    }
    universe.root.addEventListener('click', onRootClick);

    // ---------- drawing ----------
    function draw() {
      var w = canvas.width, h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!enc && !trail) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var breath = (ether.ambient && ether.ambient.breath) || 1;

      if (trail) drawTrail(breath);
      if (enc) drawCreature(breath);
    }

    function drawCreature(breath) {
      var def = enc.def;
      var half = def.span * 0.5;
      var sx = enc.screen.x, sy = enc.screen.y;

      // Fade in from the edge, out at the far one, and glow a little
      // for being noticed.
      var offEdge = Math.max(0, -sx, sx - ether.viewWidth);
      var edgeIn = Util.clamp(1 - offEdge / half, 0.35, 1);
      var a = def.alpha * breath * (0.55 + enc.noticed * 0.3 + enc.swell * 0.15) * edgeIn;

      // Undulation: the further from the head, the more the body
      // moves — a swimmer, not a rigid sign dragged across the sky.
      var pts = [];
      for (var i = 0; i < def.points.length; i++) {
        var p = def.points[i];
        var sway = Math.sin(time * def.wave.freq + (1 - p[0]) * 1.6) *
                   def.wave.amp * (0.35 + (1 - p[0]) * 0.35);
        pts.push([
          sx + p[0] * half * enc.dir,
          sy + p[1] * half * 0.62 + sway
        ]);
      }

      // The body: faint lines between the stars.
      ctx.strokeStyle = rgba(starRgb, 0.30 * a);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (var l = 0; l < def.links.length; l++) {
        var link = def.links[l];
        ctx.moveTo(pts[link[0]][0], pts[link[0]][1]);
        ctx.lineTo(pts[link[1]][0], pts[link[1]][1]);
      }
      ctx.stroke();

      // The stars themselves, each with its own faint twinkle.
      for (i = 0; i < pts.length; i++) {
        var tw = 0.75 + 0.25 * Math.sin(time * 1.3 + i * 1.9);
        var r = (i === def.eye ? 7.5 : 4.6) * tw;
        ctx.globalAlpha = a * tw;
        ctx.drawImage(starSprite, pts[i][0] - r * 2, pts[i][1] - r * 2, r * 4, r * 4);
      }

      // A soft warm heart, brighter for being noticed.
      ctx.globalAlpha = a * (0.35 + enc.noticed * 0.45);
      var hr = half * 0.5;
      ctx.drawImage(glowSprite, sx - hr, sy - hr, hr * 2, hr * 2);

      // The jellyfish's answer: one slow ring of light.
      if (enc.pulse > 0) {
        var pr = (1 - enc.pulse) * def.span * 1.1 + 20;
        ctx.globalAlpha = enc.pulse * 0.5 * breath;
        ctx.strokeStyle = rgba(glowRgb, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // The starbird's glints: brief sparks shed behind it.
      if (def.response === 'glint') {
        for (i = 1; i <= 4; i++) {
          var gx = sx - enc.dir * (half * 0.5 + i * 34);
          var gy = sy + Math.sin(time * 3 + i) * 10;
          ctx.globalAlpha = a * (0.5 - i * 0.1);
          ctx.drawImage(starSprite, gx - 5, gy - 5, 10, 10);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawTrail(breath) {
      var cam = camera.offsetFor(ether.depth.stories, camStory);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var age = time - trail.born;
      var found = trail.state === 'found';
      var settle = found ? Util.clamp((time - trail.foundAt) / 2.2, 0, 1) : 0;

      // The pulse that says WHICH WAY: a brightness wave running along
      // the trail toward the target, over and over, wordlessly.
      var wave = (time * 0.45) % 1;

      for (var i = 0; i < trail.motes.length; i++) {
        var m = trail.motes[i];
        var lifeT = Util.clamp((age - m.delay) / 0.9, 0, 1);
        if (lifeT <= 0) continue;
        var t = (i + 1) / (trail.motes.length + 1);
        var along = 1 - Math.abs(t - wave) * 3;
        var pulse = Math.max(0, along);
        var tw = 0.7 + 0.3 * Math.sin(time * 1.7 + m.tw);
        var a = 0.5 * lifeT * tw * breath * (1 - settle) * (0.65 + pulse * 0.6);

        var mx = nearestCopy(m.x + cam.x, ether.width, cx);
        var my = nearestCopy(m.y + cam.y, ether.height, cy);
        var r = 3.4 + pulse * 2.2;
        ctx.globalAlpha = a;
        ctx.drawImage(starSprite, mx - r * 2, my - r * 2, r * 4, r * 4);
      }

      // A wonder found: a small being of stars blooms where the trail
      // ended, shines a few seconds, and goes — the sky answering a
      // child who followed, with nothing to collect and nothing kept.
      if (trail.bloom) {
        var bAge = time - trail.bloom.born;
        var up = Util.smooth(Util.clamp(bAge / 1.4, 0, 1));
        var down = Util.clamp((bAge - 4.5) / 1.6, 0, 1);
        var ba = up * (1 - down) * breath;
        if (ba > 0) {
          var t2 = trail.target;
          var bx = nearestCopy(t2.x + cam.x, ether.width, cx);
          var by = nearestCopy(t2.y + cam.y, ether.height, cy);
          var fig = CREATURES.starbird;
          var bh = 60;
          ctx.strokeStyle = rgba(starRgb, 0.4 * ba);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (var l2 = 0; l2 < fig.links.length; l2++) {
            var lk = fig.links[l2];
            ctx.moveTo(bx + fig.points[lk[0]][0] * bh, by + fig.points[lk[0]][1] * bh);
            ctx.lineTo(bx + fig.points[lk[1]][0] * bh, by + fig.points[lk[1]][1] * bh);
          }
          ctx.stroke();
          for (var p2 = 0; p2 < fig.points.length; p2++) {
            var twb = 0.7 + 0.3 * Math.sin(time * 2 + p2 * 2.1);
            ctx.globalAlpha = ba * twb;
            var br = 5 * twb;
            ctx.drawImage(starSprite,
              bx + fig.points[p2][0] * bh - br * 2,
              by + fig.points[p2][1] * bh - br * 2, br * 4, br * 4);
          }
          ctx.globalAlpha = ba * 0.5;
          ctx.drawImage(glowSprite, bx - bh, by - bh, bh * 2, bh * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    global.requestAnimationFrame(frame);

    return {
      quiet: false,
      creatures: function () { return Object.keys(CREATURES); },
      active: function () {
        if (!enc) return null;
        return {
          id: enc.id,
          screen: { x: enc.screen.x, y: enc.screen.y },
          prox: enc.prox,
          noticed: enc.noticed,
          responded: enc.responded,
          response: enc.def.response
        };
      },
      trail: function () {
        if (!trail) return null;
        return {
          state: trail.state,
          motes: trail.motes.length,
          target: { kind: trail.target.kind, id: trail.target.id || null,
                    x: trail.target.x, y: trail.target.y }
        };
      },
      summon: summon,
      setComposer: function (fn) { composer = fn; },
      on: on, off: off,
      times: times,
      destroy: function () {
        destroyed = true;
        universe.root.removeEventListener('click', onRootClick);
        universe.off('ether:resized', sizeCanvas);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  global.EtherLife = {
    CREATURES: CREATURES,
    TIMES: TIMES,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
