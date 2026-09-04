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
  //   response: 'guide'    it asks the composer for a target and
  //                        breathes out a trail of motes that lead
  //                        there, staying where it is (whale)
  //             'pulse'    it answers with light — one wide slow ring
  //                        that briefly ILLUMINATES the dim Spirits it
  //                        washes over, showing a Traveller where
  //                        things rest without leading them anywhere
  //                        (jellyfish)
  //             'feathers' it flies TO the discovery itself, shedding
  //                        a trail of feather-glints behind it as it
  //                        goes — the trail is its flight, not its
  //                        breath (starbird)
  //
  //   A response is a distinct behaviour, never a reskin: the whale
  //   points, the starbird carries, the jellyfish reveals. A future
  //   creature adds a response kind of its own here and in respond().
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
      // A reveal is light, not a discovery being granted, so asking
      // for it again is as honest as tapping a lamp again — and the
      // jellyfish drifts for minutes, so "once per crossing" read as
      // broken the second time a child touched it (reported by the
      // product owner: "I was only able to click once on it"). A
      // TOUCH may ask again; merely keeping it centred still answers
      // once, or looking at it would strobe.
      repeatable: true,
      // And the light GATHERS between rings — ten seconds from one
      // fire to the next, the product owner's own number. A touch
      // while it is gathering still glows warmly (never ignored), it
      // simply does not ring yet.
      recharge: 10,
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
      response: 'feathers',
      // Fast enough that sustained nearness is hard to hold on it — a
      // swift needs a swift notice, or only a click could ever catch
      // one.
      notice: { hold: 0.15 },
      shimmer: true,        // sparks shed behind it even unnoticed
      points: [
        [ 1.00, 0.00], [ 0.45, -0.10], [-0.15, -0.42], [-0.75, -0.60],
        [-0.15,  0.10], [-0.85,  0.28], [-1.00, 0.02]
      ],
      links: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 6]],
      eye: 0
    }
  };

  // ---------------------------------------------------------------
  // The wonders. When a trail ends at no Story, the sky itself
  // answers: a small figure of stars blooms where the trail ends,
  // shines a few seconds, and goes. A small seeded family rather than
  // one fixed figure, so two wonders in one visit are not the same
  // wonder — variety in the FORM, never more objects (the Garden's own
  // rule). Figures only: points and links, drawn exactly as a
  // creature's skeleton is.
  // ---------------------------------------------------------------
  var WONDERS = [
    { id: 'bird', points: CREATURES.starbird.points, links: CREATURES.starbird.links },
    {
      id: 'skyfish',
      points: [
        [ 1.00,  0.00], [ 0.40, -0.34], [-0.30, -0.30], [-0.72,  0.00],
        [-0.30,  0.30], [ 0.40,  0.34], [-1.00, -0.30], [-1.00,  0.30]
      ],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [3, 7]]
    },
    {
      id: 'starflower',
      points: [
        [ 0.00,  1.00], [ 0.00,  0.20], [ 0.00, -0.62], [-0.56, -0.14],
        [ 0.56, -0.14], [-0.36, -0.52], [ 0.36, -0.52]
      ],
      links: [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]]
    }
  ];

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
    respondDelay: 0.5,      // being noticed is felt a beat later

    // The beckon: a soft light half-off the edge of the view, for a
    // Traveller who has been still a while — the environment saying
    // "there is more this way" without one word. It waits longer than
    // the glance (Decision 10's camera lean at ~11s), so the two
    // arrive as different sentences rather than a chorus; it gives up
    // after two; and it stops FOREVER the moment the Traveller turns
    // the universe themselves, because the question it exists to ask
    // has been answered.
    beckonAfter: 16,        // s of stillness before the first one
    beckonSpacing: 22,      // and further stillness between them
    beckonLife: 7,          // s each one breathes before withdrawing
    beckons: 2              // then the sky stops suggesting
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

    // EXPERIMENTAL BRANCH — conducted mode. When an Experience
    // Composer owns the sky (js/etherExperience.js), this layer stops
    // scheduling anything of its own: no internal next-crossing clock
    // and no idle beckon clock. Everything else — drawing, movement,
    // the notice grammar, the trail machinery, departure — is
    // unchanged, because those are HOW a being behaves, and manner is
    // the one thing a conductor may vary. A bare mount() without the
    // flag behaves exactly as it always has, which is what keeps every
    // existing suite that remounts through this public API honest.
    var conducted = !!opts.conducted;

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
        conducted: conducted,
        creatures: function () { return Object.keys(CREATURES); },
        active: function () { return null; },
        trail: function () { return null; },
        beckon: function () { return null; },
        summon: function () { return null; },
        beckonNow: function () { return null; },
        bloomAt: function () { return null; },
        markAt: function () { return null; },
        blooms: function () { return []; },
        marks: function () { return []; },
        setComposer: function () {},
        setScout: function () {},
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
    var scout = opts.scout || null;   // "is there something far worth
                                      // looking toward?" — composition's
    var enc = null;          // the current encounter, or null
    var trail = null;        // the current guide trail, or null
    var beck = null;         // the current beckon, or null
    var blooms = [];         // free-standing wonders (experimental branch)
    var marks = [];          // faint sky anomalies (experimental branch)
    var becksGiven = 0;
    var becksStopped = false;
    var prevStill = 0;
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

    // Seconds since the Traveller last turned the universe THEMSELVES
    // — the traveller's own accounting, which the arrival turn and the
    // glance deliberately do not reset (they move the camera, not the
    // child's hand).
    function stillNow() {
      try {
        return (universe.traveller && universe.traveller.stillSeconds)
          ? universe.traveller.stillSeconds() : 0;
      } catch (e) { return 0; }
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
    //
    // `manner` (optional, experimental branch) is how a conductor
    // varies a crossing without touching how a being behaves:
    //   dir      +1 / -1                (which way it crosses)
    //   yFrac    0..1 of the view height (which band it crosses in)
    //   scale    0.3..1  drawn size/alpha (a small dim one is FAR)
    //   speed    multiplier on its own pace
    //   respond  'default' | 'acknowledge' | 'shy' | 'none'
    //   via      {x,y} on the story plane the crossing should pass
    //            near (a path that happens to cross an old place)
    // Defaults reproduce today's behaviour exactly.
    function summon(id, manner) {
      var def = CREATURES[id || 'whale'];
      if (!def || enc) return null;
      manner = manner || {};

      var cam = camera.offsetFor(def.parallax, camScratch);
      var dir = (manner.dir === 1 || manner.dir === -1) ? manner.dir : coin();
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
      var screenY;
      if (manner.via && typeof manner.via.x === 'number') {
        // A crossing routed through a place something already
        // happened: hold the band the anchor sits in, so the path
        // passes it. The child made the first mark; the sky answers
        // by happening to pass through it.
        var camS0 = camera.offsetFor(ether.depth.stories, camStory);
        var viaY = nearestCopy(manner.via.y + camS0.y, ether.height, vh * 0.5);
        screenY = Math.max(vh * 0.12, Math.min(vh * 0.88, viaY));
      } else if (typeof manner.yFrac === 'number') {
        screenY = vh * Math.max(0.06, Math.min(0.94, manner.yFrac));
      } else {
        screenY = vh * (0.5 + rand(-0.2, 0.2));
      }
      enc = {
        id: def.id,
        def: def,
        manner: {
          respond: manner.respond || 'default',
          scale: (typeof manner.scale === 'number' && manner.scale > 0)
                   ? Math.min(1.4, Math.max(0.25, manner.scale)) : 1,
          speed: (typeof manner.speed === 'number' && manner.speed > 0)
                   ? Math.min(2.5, Math.max(0.3, manner.speed)) : 1
        },
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
        firedAt: -1,          // when that answer last rang
        guiding: null,        // starbird's flight to a discovery
        born: time,
        screen: { x: 0, y: 0 },
        alive: true
      };
      emit('creature:arrived', { id: def.id });
      return enc.id;
    }

    // A creature was genuinely noticed: turned toward, or touched.
    //
    // THE ACKNOWLEDGMENT IS IMMEDIATE even though the response keeps
    // its beat: the creature brightens in the same breath as the
    // touch, so a child is never left wondering whether anything
    // happened while the respondDelay runs. Perceptibly connected
    // first, naturally answered a moment later.
    // May this creature answer AGAIN? Only a repeatable one, only
    // after its last answer has fully run out AND its light has
    // gathered again (the recharge), and only to a touch — the caller
    // decides which gesture is asking.
    function mayRepeat() {
      return !!(enc && enc.responded && enc.def.repeatable &&
                enc.pulse <= 0 && enc.respondIn < 0 &&
                (enc.firedAt < 0 || time - enc.firedAt >= (enc.def.recharge || 0)));
    }

    function notice() {
      if (!enc || enc.respondIn >= 0) return;
      if (enc.responded && !mayRepeat()) return;
      enc.swell = Math.max(enc.swell, 0.8);
      enc.respondIn = times.respondDelay;
      emit('creature:noticed', { id: enc.id });
    }

    // The Spirits a reveal has any business lighting: still dim —
    // unresolved in front of the child — wherever they rest, on
    // screen or beyond its edges.
    function dimSpirits() {
      var out = [];
      var entities = [];
      try { entities = universe.stories.all() || []; } catch (e) { return out; }
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (e && (e.prox || 0) <= 0.5 && typeof e.screenX === 'number') out.push(e);
      }
      return out;
    }

    function respond() {
      if (!enc) return;
      if (enc.responded && !mayRepeat()) return;
      enc.responded = true;
      enc.swell = 1;

      // A conductor's manner outranks the creature's own response —
      // never its behaviour vocabulary, only WHICH of its answers
      // this crossing gives. 'acknowledge': it brightens, shifts a
      // little, and keeps its way — noticed, and that is the whole of
      // it (a mystery is allowed to stay one). 'shy': it startles and
      // leaves — being noticed is not always welcome.
      if (enc.manner && enc.manner.respond === 'acknowledge') {
        enc.veer = (enc.screen.y < ether.viewHeight * 0.5 ? -1 : 1) * 24;
        emit('creature:responded', { id: enc.id, response: 'acknowledge' });
        return;
      }
      if (enc.manner && enc.manner.respond === 'shy') {
        enc.veer = (enc.screen.y < ether.viewHeight * 0.5 ? -1 : 1) * 90;
        enc.speedScale = 2.2;
        enc.fleeing = true;
        emit('creature:responded', { id: enc.id, response: 'shy' });
        return;
      }

      if (enc.def.response === 'guide') {
        // The whale points. It near-pauses — a breath — arcs a little
        // away from the Traveller (noticed, not caught) and breathes
        // out the trail, staying on its own way.
        enc.veer = (enc.screen.y < ether.viewHeight * 0.5 ? -1 : 1) * 46;
        enc.speedScale = 0.28;
        beginTrail();
      } else if (enc.def.response === 'pulse') {
        // The jellyfish reveals. One wide slow ring, and the dim
        // Spirits it washes over glow for a moment — in view as a
        // halo on the Spirit itself, beyond the view as a KINDLE at
        // the edge in its direction, so the reveal is a reason to
        // turn rather than a light show for the already-seen.
        //
        // AND A RING NEVER FIRES OVER NOTHING. Reported by the
        // product owner as "a blast of outgoing circle and then
        // nothing": in a sparse universe almost everything in view is
        // already resolved (storySpirit's FAR_SPARSE), so the wash
        // had no audience and the answer read as a malfunction. With
        // nothing anywhere to reveal, the jellyfish answers with its
        // own light alone — the swell — which is a smaller true
        // answer instead of a large empty one.
        if (dimSpirits().length) {
          enc.pulse = 1;
          enc.firedAt = time;   // the recharge counts from the fire
        }
      } else if (enc.def.response === 'feathers') {
        // The starbird carries. It turns and flies TO the discovery
        // itself, shedding feather-glints behind it as it goes: the
        // trail IS its flight. What it flies to is still the
        // composer's to say, exactly as the whale's breath is.
        beginFlight();
      }
      emit('creature:responded', { id: enc.id, response: enc.def.response });
    }

    // ---------- the starbird's flight ----------
    //
    // Distinct from the whale on purpose: the whale stays and points,
    // the starbird goes and shows. Its trail starts EMPTY and is shed
    // feather by feather at the places the bird actually flew through,
    // so following it is retracing a real flight rather than reading a
    // drawn line.
    function beginFlight() {
      if (trail || !composer) return;
      var target = null;
      try { target = composer({ creature: enc.id }); } catch (e) {}
      if (!target) return;
      enc.guiding = { target: target, lastShed: 0, shedEvery: 0.5 };
      var camS = camera.offsetFor(ether.depth.stories, camStory);
      trail = {
        // The first feather falls where the flight begins — a trail
        // has a start, and a short flight still leaves one.
        motes: [{
          x: enc.screen.x - camS.x,
          y: enc.screen.y - camS.y,
          delay: 0,
          tw: Math.random() * Math.PI * 2
        }],
        target: target,
        from: { x: enc.screen.x, y: enc.screen.y },
        born: time,
        state: 'guiding',
        foundAt: 0,
        bloom: null,
        shed: true
      };
      emit('trail:begun', { target: { kind: target.kind, id: target.id || null } });
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
          // simply arrives and settles. Which figure blooms is this
          // moment's own — one visitor's wonder has no business being
          // reproducible (the arrival turn's reasoning, Decision 10).
          if (trail.target.kind === 'wonder') {
            trail.bloom = {
              born: time,
              fig: WONDERS[Math.floor(Math.random() * WONDERS.length)]
            };
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

      if (!conducted && !enc && elapsed >= nextAt) {
        // The first crossing is always the whale — the one being whose
        // response is built end-to-end, so a fresh Traveller's first
        // encounter is the one that can lead somewhere. (In conducted
        // mode the Experience Composer owns this decision entirely.)
        summon(hadFirst ? pickLater() : 'whale');
        hadFirst = true;
      }

      updateBeckon(dt, open);
      updateBlooms();
      updateMarks();
      if (enc) updateEncounter(dt);
      updateTrail(dt);
      draw();
    }

    // ---------- the beckon ----------
    //
    // The environment's own "there is more this way": a soft light
    // half-off the edge of the view, breathing, for a Traveller who
    // has been still a while. Aimed at something REAL when composition
    // knows of one — a far Spirit nobody has looked at — so it is a
    // pointer to the world, not an effect; a random edge only when the
    // sky is genuinely empty. Anchored in field coordinates, so
    // turning toward it brings it in, which is the whole lesson.
    //
    // Like the glance (Decision 10), it stops forever the moment the
    // Traveller turns the universe themselves: the question — can this
    // place be explored? — has been answered, and a place that keeps
    // asking is a place that is nagging.
    function updateBeckon(dt, open) {
      var still = stillNow();

      if (still < prevStill - 0.4) {
        // They turned it. That is the whole answer — never ask again.
        becksStopped = true;
        beck = null;
      }
      prevStill = still;

      if (beck) {
        beck.age += dt;
        // It drifts a little further out as it breathes — something
        // half-seen LEAVING the view is what says "beyond here".
        beck.x += beck.driftX * dt;
        beck.y += beck.driftY * dt;
        if (beck.age > times.beckonLife) beck = null;
        return;
      }

      if (becksStopped || becksGiven >= times.beckons) return;
      if (trail || open) return;   // never while something is already speaking
      if (conducted) return;       // the Composer says when — beckonNow()
      if (still < times.beckonAfter + becksGiven * times.beckonSpacing) return;

      spawnBeckon();
    }

    // Offer a beckon now — the conducted-mode seam. The POLICY guards
    // stay here (never past the cap, never after the Traveller has
    // answered by turning, never while a trail or a portal is
    // speaking), so a conductor can decide WHEN without ever being
    // able to make the sky nag.
    function beckonNow() {
      if (beck || becksStopped || becksGiven >= times.beckons) return null;
      var open = false;
      try { open = universe.focus && universe.focus.isOpen(); } catch (e) {}
      if (trail || open) return null;
      spawnBeckon();
      return beck ? { given: becksGiven, aimed: beck.aimed } : null;
    }

    function spawnBeckon() {
      // Where. A far Spirit's direction when the scout knows one;
      // otherwise any edge, because "more sky" is also true.
      var cam = camera.offsetFor(ether.depth.stories, camStory);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var angle = null;
      var aimed = null;
      if (scout) {
        try { aimed = scout(); } catch (e) {}
      }
      if (aimed) {
        var asx = nearestCopy(aimed.x + cam.x, ether.width, cx);
        var asy = nearestCopy(aimed.y + cam.y, ether.height, cy);
        angle = Math.atan2(asy - cy, asx - cx);
      } else {
        angle = Math.random() * Math.PI * 2;
      }
      // The point where a ray at `angle` from the centre meets the
      // view's edge — the beckon sits ON that edge, half of it beyond.
      var dx = Math.cos(angle), dy = Math.sin(angle);
      var tEdge = Math.min(
        Math.abs(dx) > 1e-4 ? (dx > 0 ? (ether.viewWidth - cx) / dx : -cx / dx) : 1e9,
        Math.abs(dy) > 1e-4 ? (dy > 0 ? (ether.viewHeight - cy) / dy : -cy / dy) : 1e9
      );
      var ex = cx + dx * tEdge, ey = cy + dy * tEdge;
      beck = {
        // Field-anchored, drifting a little further out over its life.
        x: ex - cam.x, y: ey - cam.y,
        driftX: dx * 2.2, driftY: dy * 2.2,
        age: 0,
        aimed: !!aimed
      };
      becksGiven++;
      emit('beckon', { aimed: beck.aimed });
    }

    // ---------- free-standing wonders and sky anomalies ----------
    //
    // Experimental branch. A bloom is the trail's own wonder, unhooked
    // from any trail: a small figure of stars that comes into being
    // somewhere, shines a few seconds, and goes — the sky having a
    // moment of its own, sometimes exactly where something else once
    // happened. A mark is quieter still: a few faint stars that were
    // not there before, breathing, unexplained, gone in under a
    // minute. Neither leads anywhere, neither is a control, and
    // neither is ever announced.
    function bloomAt(x, y, figId) {
      var fig = null;
      for (var i = 0; i < WONDERS.length; i++) {
        if (WONDERS[i].id === figId) { fig = WONDERS[i]; break; }
      }
      if (!fig) fig = WONDERS[Math.floor(Math.random() * WONDERS.length)];
      var b = { x: x, y: y, born: time, fig: fig, life: 7 };
      blooms.push(b);
      emit('bloom', { fig: fig.id });
      return fig.id;
    }

    function markAt(x, y, opts) {
      opts = opts || {};
      var pts = [];
      var n = 3 + Math.floor(Math.random() * 2);
      for (var i = 0; i < n; i++) {
        pts.push([rand(-34, 34), rand(-26, 26), Math.random() * Math.PI * 2]);
      }
      marks.push({
        x: x, y: y, pts: pts, born: time,
        life: Math.max(6, Math.min(90, opts.life || 25))
      });
      emit('mark', {});
      return true;
    }

    function updateBlooms() {
      for (var i = blooms.length - 1; i >= 0; i--) {
        if (time - blooms[i].born > blooms[i].life) blooms.splice(i, 1);
      }
    }
    function updateMarks() {
      for (var i = marks.length - 1; i >= 0; i--) {
        if (time - marks[i].born > marks[i].life) marks.splice(i, 1);
      }
    }

    function updateEncounter(dt) {
      var def = enc.def;

      if (enc.guiding) {
        // The starbird flying to its discovery. Steered in SCREEN
        // space toward the target's screen position — the same wrap
        // and the same camera every layer reads — and moving its own
        // field position by the result, so a child who turns away
        // mid-flight leaves a bird still flying where it really is.
        var camS = camera.offsetFor(ether.depth.stories, camStory);
        var tg = enc.guiding.target;
        var tsx = nearestCopy(tg.x + camS.x, ether.width, ether.viewWidth * 0.5);
        var tsy = nearestCopy(tg.y + camS.y, ether.height, ether.viewHeight * 0.5);
        var gdx = tsx - enc.screen.x, gdy = tsy - enc.screen.y;
        var gdist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
        if (gdist < 130) {
          // Delivered. A small flare, a last feather where the flight
          // ended — a trail has an end as surely as a start, and even
          // the shortest flight leaves both — and the bird flies on
          // the way it was going; the discovery is the trail's now.
          if (trail && trail.shed && trail.state === 'guiding' &&
              trail.motes.length < 18) {
            trail.motes.push({
              x: enc.screen.x - camS.x,
              y: enc.screen.y - camS.y,
              delay: time - trail.born,
              tw: Math.random() * Math.PI * 2
            });
          }
          enc.swell = 1;
          enc.guiding = null;
          enc.baseY = enc.pos.y;
          emit('creature:delivered', { id: enc.id });
        } else {
          enc.pos.x += (gdx / gdist) * def.speed * dt;
          enc.pos.y += (gdy / gdist) * def.speed * dt;
          enc.baseY = enc.pos.y;
          if (Math.abs(gdx) > 4) enc.dir = gdx >= 0 ? 1 : -1;
          // Shed a feather at the place it actually is.
          enc.guiding.lastShed += dt;
          if (trail && trail.shed && trail.state === 'guiding' &&
              enc.guiding.lastShed >= enc.guiding.shedEvery &&
              trail.motes.length < 18) {
            enc.guiding.lastShed = 0;
            trail.motes.push({
              x: enc.screen.x - camS.x,
              y: enc.screen.y - camS.y,
              // Its own shed moment, so each feather fades up where and
              // WHEN the bird actually passed.
              delay: time - trail.born,
              tw: Math.random() * Math.PI * 2
            });
          }
        }
      } else {
        enc.pos.x += def.speed * enc.speedScale *
                     (enc.manner ? enc.manner.speed : 1) * enc.dir * dt;
        // The veer eases in once noticed and dies away on its own — an
        // arc, not a new heading; the wave is its ordinary swimming.
        if (enc.veer) {
          enc.baseY += enc.veer * dt * 0.4;
          enc.veer *= Math.max(0, 1 - dt * 0.5);
        }
        enc.pos.y = enc.baseY + Math.sin(time * def.wave.freq) * def.wave.amp * 0.4;
      }

      // UNWRAPPED, DELIBERATELY — and this is V2.1's whole fix. The
      // wrap exists for things that BELONG to the sky (Spirits, trail
      // motes, the beckon), so a child turning a full circle finds
      // them again. A creature is a visitor passing through, and
      // wrapping it made leaving impossible: in a sparse universe the
      // field is only the view plus the seam margins, so the wrapped
      // screen coordinate is clamped within ±(field/2) of the centre
      // and the departure threshold below was UNREACHABLE — measured,
      // the whale hit the seam at screen.x 1600 and reappeared at
      // -160, forever. A rare encounter had become wallpaper, and a
      // whale that never leaves keeps `responded` for the rest of the
      // visit, which is why a later touch appeared to do nothing.
      //
      // The stated cost: a child who turns a long way off a crossing
      // creature may lose it past the departure line. A transient
      // being going unseen is the design — "did I just see that?" —
      // where a permanent one was the bug.
      var cam = camera.offsetFor(def.parallax, camScratch);
      enc.screen.x = enc.pos.x + cam.x;
      enc.screen.y = enc.pos.y + cam.y;

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

      if (!enc.responded && enc.respondIn < 0) {
        // A swift needs a swift notice: each creature may carry its
        // own hold, or take the layer's.
        //
        // AND NEARNESS ALONE IS NOT NOTICING. A creature crossing the
        // sky passes through the middle of the screen on its own, so
        // prox rises for an idle Traveller who never did anything —
        // and a whale that answers nobody with a trail has broken the
        // whole grammar (Traveller approaches → creature notices).
        // Being noticed therefore requires the Traveller to have
        // TURNED recently; a touch is always an act and comes through
        // notice() directly.
        var hold = (def.notice && def.notice.hold) || times.noticeHold;
        // A 'none' manner is a passage that cannot be caught — small,
        // far, and already leaving. Nearness never arms on it.
        if (enc.manner && enc.manner.respond === 'none') { hold = Infinity; }
        if (enc.noticed > 0.5 && stillNow() < 3 && hold !== Infinity) {
          enc.noticedFor += dt;
          if (enc.noticedFor >= hold) notice();
        } else {
          enc.noticedFor = 0;
        }
      }
      if (enc.respondIn >= 0) {
        enc.respondIn -= dt;
        if (enc.respondIn < 0) respond();
      }

      if (enc.swell > 0) enc.swell = Math.max(0, enc.swell - dt * 0.35);
      // The jellyfish's ring runs down slowly — it has a whole sky to
      // wash over, and a reveal that is over in a blink reveals
      // nothing.
      if (enc.pulse > 0) enc.pulse = Math.max(0, enc.pulse - dt * 0.22);
      if (enc.responded && !enc.guiding) {
        // A fleeing creature stays fled; every other response eases
        // back to its own pace.
        enc.speedScale += ((enc.fleeing ? 2.2 : 1) - enc.speedScale) * dt * 0.4;
      }

      // ONE CROSSING, THEN GONE. Past the far side of the view, with
      // room to spare, the encounter is over: the creature disappears
      // and the NEXT one waits on the rarity schedule — never a wrap,
      // never an immediate re-entry. (Never mid-flight, though: a bird
      // carrying a Traveller somewhere may legitimately cross the edge
      // on the way there.)
      if (!enc.guiding) {
        var beyond = def.span * 0.8;
        if ((enc.dir > 0 && enc.screen.x > ether.viewWidth + beyond) ||
            (enc.dir < 0 && enc.screen.x < -beyond)) {
          emit('creature:gone', { id: enc.id });
          enc = null;
          nextAt = elapsed + rand(times.between[0], times.between[1]);
        }
      }
    }

    // A touch on the sky. The canvas takes no pointer events; the host
    // page asks on the universe root's behalf. The hit region is the
    // creature's span with a margin — generous enough that nobody has
    // to hit a procedural star exactly, following the creature's own
    // screen position frame by frame, and never the whole screen.
    //
    // A touch that landed on a Story Spirit belongs to the Spirit: a
    // creature passing behind a card must not answer the tap that
    // opened the card.
    function onRootClick(ev) {
      if (!enc) return;
      // A 'none' manner is a passage that cannot be caught — the
      // conductor asked for a crossing that answers nothing, so a
      // touch is not an ask it can grant. (V2.2's mid-recharge
      // swell-ack below is for a creature that CAN answer and is
      // gathering its light; this one never answers at all.)
      if (enc.manner && enc.manner.respond === 'none') return;
      if (ev.target && ev.target.closest && ev.target.closest('.vp-story')) return;
      var rect = universe.root.getBoundingClientRect();
      var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      var half = enc.def.span * 0.55;
      if (Math.abs(x - enc.screen.x) >= half ||
          Math.abs(y - enc.screen.y) >= half * 0.7) return;
      if (enc.responded && !mayRepeat()) {
        // Still gathering its light. The touch is never ignored — a
        // warm glow says "I hear you" — the ring simply is not ready.
        enc.swell = Math.max(enc.swell, 0.45);
        return;
      }
      notice();
    }
    universe.root.addEventListener('click', onRootClick);

    // ---------- drawing ----------
    function draw() {
      var w = canvas.width, h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!enc && !trail && !beck && !blooms.length && !marks.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var breath = (ether.ambient && ether.ambient.breath) || 1;

      if (marks.length) drawMarks(breath);
      if (beck) drawBeckon(breath);
      if (blooms.length) drawBlooms(breath);
      if (trail) drawTrail(breath);
      if (enc) drawCreature(breath);
    }

    // A free-standing wonder: the same figure family a trail's end
    // blooms, drawn by the same rules, wherever the sky chose.
    function drawBlooms(breath) {
      var cam = camera.offsetFor(ether.depth.stories, camStory);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      for (var i = 0; i < blooms.length; i++) {
        var b = blooms[i];
        var bAge = time - b.born;
        var up = Util.smooth(Util.clamp(bAge / 1.4, 0, 1));
        var down = Util.clamp((bAge - (b.life - 2.5)) / 1.6, 0, 1);
        var ba = up * (1 - down) * breath;
        if (ba <= 0) continue;
        var bx = nearestCopy(b.x + cam.x, ether.width, cx);
        var by = nearestCopy(b.y + cam.y, ether.height, cy);
        var fig = b.fig;
        var bh = 60;
        ctx.strokeStyle = rgba(starRgb, 0.4 * ba);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var l = 0; l < fig.links.length; l++) {
          var lk = fig.links[l];
          ctx.moveTo(bx + fig.points[lk[0]][0] * bh, by + fig.points[lk[0]][1] * bh);
          ctx.lineTo(bx + fig.points[lk[1]][0] * bh, by + fig.points[lk[1]][1] * bh);
        }
        ctx.stroke();
        for (var p = 0; p < fig.points.length; p++) {
          var tw = 0.7 + 0.3 * Math.sin(time * 2 + p * 2.1);
          ctx.globalAlpha = ba * tw;
          var br = 5 * tw;
          ctx.drawImage(starSprite,
            bx + fig.points[p][0] * bh - br * 2,
            by + fig.points[p][1] * bh - br * 2, br * 4, br * 4);
        }
        ctx.globalAlpha = ba * 0.5;
        ctx.drawImage(glowSprite, bx - bh, by - bh, bh * 2, bh * 2);
      }
      ctx.globalAlpha = 1;
    }

    // The anomalies: a few stars that were not there before, faint
    // enough to be doubted, breathing, and gone. Deliberately dimmer
    // than anything else this layer draws — a mark is a question.
    function drawMarks(breath) {
      var cam = camera.offsetFor(ether.depth.stories, camStory);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        var age = time - m.born;
        var up = Util.smooth(Util.clamp(age / 2.2, 0, 1));
        var down = Util.clamp((age - (m.life - 3)) / 3, 0, 1);
        var ma = up * (1 - down) * breath * 0.4;
        if (ma <= 0) continue;
        var mx = nearestCopy(m.x + cam.x, ether.width, cx);
        var my = nearestCopy(m.y + cam.y, ether.height, cy);
        for (var p = 0; p < m.pts.length; p++) {
          var pt = m.pts[p];
          var tw = 0.6 + 0.4 * Math.sin(time * 1.1 + pt[2]);
          ctx.globalAlpha = ma * tw;
          var r = 3.4 * tw;
          ctx.drawImage(starSprite,
            mx + pt[0] - r * 2, my + pt[1] - r * 2, r * 4, r * 4);
        }
      }
      ctx.globalAlpha = 1;
    }

    // The beckon: one soft light sitting on the edge of the view, half
    // of it already beyond — breathing, drifting a little further out,
    // and gone. Nothing about it is a control; it is the sky having
    // something a little way over there.
    function drawBeckon(breath) {
      var cam = camera.offsetFor(ether.depth.stories, camStory);
      var cx = ether.viewWidth * 0.5, cy = ether.viewHeight * 0.5;
      var sx = nearestCopy(beck.x + cam.x, ether.width, cx);
      var sy = nearestCopy(beck.y + cam.y, ether.height, cy);
      var up = Util.smooth(Util.clamp(beck.age / 1.6, 0, 1));
      var down = Util.smooth(Util.clamp(
        (beck.age - (times.beckonLife - 1.8)) / 1.8, 0, 1));
      var slow = 0.65 + 0.35 * Math.sin(time * 0.9);
      var a = up * (1 - down) * slow * breath;
      if (a <= 0) return;
      ctx.globalAlpha = a * 0.5;
      ctx.drawImage(glowSprite, sx - 64, sy - 64, 128, 128);
      ctx.globalAlpha = a * 0.85;
      ctx.drawImage(starSprite, sx - 14, sy - 14, 28, 28);
      ctx.globalAlpha = 1;
    }

    function drawCreature(breath) {
      var def = enc.def;
      var mScale = enc.manner ? enc.manner.scale : 1;
      var half = def.span * 0.5 * mScale;
      var sx = enc.screen.x, sy = enc.screen.y;

      // Fade in from the edge, out at the far one, and glow a little
      // for being noticed.
      var offEdge = Math.max(0, -sx, sx - ether.viewWidth);
      var edgeIn = Util.clamp(1 - offEdge / half, 0.35, 1);
      // The swell is the acknowledgment a child sees, so it carries
      // real weight — a brightening that could be missed is no
      // acknowledgment at all.
      var a = def.alpha * breath * (0.55 + enc.noticed * 0.3 + enc.swell * 0.3) *
              edgeIn * (0.45 + 0.55 * mScale);

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

      // A soft warm heart, brighter for being noticed — and brightest
      // in the moment of acknowledging a touch.
      ctx.globalAlpha = Math.min(1, a * (0.35 + enc.noticed * 0.45 + enc.swell * 0.6));
      var hr = half * 0.5;
      ctx.drawImage(glowSprite, sx - hr, sy - hr, hr * 2, hr * 2);

      // The jellyfish's answer: one wide slow ring of light, and the
      // dim Spirits it washes over glow for a moment. Illumination,
      // not a path: it shows a Traveller where things rest and leads
      // them to none of them — every halo is drawn HERE, on this
      // layer's own canvas, and nothing on any entity is written.
      if (enc.pulse > 0 && def.response === 'pulse') {
        // The ring sweeps the WHOLE visible sky — a reveal that cannot
        // reach a Spirit across the view cannot do its one job, and
        // measured, a Spirit 1150px from the jellyfish was never
        // washed at a reach of 0.85 short edges (765px).
        var reach = Math.sqrt(ether.viewWidth * ether.viewWidth +
                              ether.viewHeight * ether.viewHeight) * 0.78;
        var pr = (1 - enc.pulse) * reach + 24;
        ctx.globalAlpha = enc.pulse * 0.5 * breath;
        ctx.strokeStyle = rgba(glowRgb, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.stroke();

        var band = 110;
        var vw = ether.viewWidth, vh = ether.viewHeight;
        var vcx = vw * 0.5, vcy = vh * 0.5;
        var dims = dimSpirits();
        for (var s = 0; s < dims.length; s++) {
          var ent = dims[s];
          var edx = ent.screenX - sx, edy = ent.screenY - sy;
          var ed = Math.sqrt(edx * edx + edy * edy);
          var wash = Math.max(0, 1 - Math.abs(ed - pr) / band);
          if (wash <= 0) continue;
          // The reveal keeps its brightness to the far side of the
          // view — tied linearly to the run-down, the wash was
          // near-invisible exactly where it matters most, on the
          // Spirits furthest from the light.
          var envl = Util.clamp(enc.pulse * 3, 0, 1);
          var inView = ent.screenX > -20 && ent.screenX < vw + 20 &&
                       ent.screenY > -20 && ent.screenY < vh + 20;
          if (inView) {
            ctx.globalAlpha = wash * envl * 0.6 * breath;
            ctx.drawImage(glowSprite, ent.screenX - 46, ent.screenY - 46, 92, 92);
            ctx.globalAlpha = wash * envl * 0.8 * breath;
            ctx.drawImage(starSprite, ent.screenX - 10, ent.screenY - 10, 20, 20);
          } else {
            // A Spirit resting BEYOND the view kindles at the edge in
            // its direction — the beckon's own geometry, worn for a
            // moment. A halo drawn at off-screen coordinates reveals
            // nothing (the sparse-sky "blast then nothing" report),
            // and the whole point of a reveal is a reason to TURN.
            var rdx = ent.screenX - vcx, rdy = ent.screenY - vcy;
            var tEdge = Math.min(
              Math.abs(rdx) > 1e-4 ? (rdx > 0 ? (vw - vcx) / rdx : -vcx / rdx) : 1e9,
              Math.abs(rdy) > 1e-4 ? (rdy > 0 ? (vh - vcy) / rdy : -vcy / rdy) : 1e9
            );
            var kx = vcx + rdx * tEdge, ky = vcy + rdy * tEdge;
            ctx.globalAlpha = wash * envl * 0.55 * breath;
            ctx.drawImage(glowSprite, kx - 52, ky - 52, 104, 104);
            ctx.globalAlpha = wash * envl * 0.8 * breath;
            ctx.drawImage(starSprite, kx - 11, ky - 11, 22, 22);
          }
        }
      }

      // The starbird's glints: brief sparks shed behind it.
      if (def.shimmer) {
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
        var a = 0.6 * lifeT * tw * breath * (1 - settle) * (0.65 + pulse * 0.6);

        var mx = nearestCopy(m.x + cam.x, ether.width, cx);
        var my = nearestCopy(m.y + cam.y, ether.height, cy);
        var r = 4.0 + pulse * 2.4;
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
          var fig = trail.bloom.fig || WONDERS[0];
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
      conducted: conducted,
      creatures: function () { return Object.keys(CREATURES); },
      active: function () {
        if (!enc) return null;
        return {
          id: enc.id,
          screen: { x: enc.screen.x, y: enc.screen.y },
          prox: enc.prox,
          noticed: enc.noticed,
          responded: enc.responded,
          response: enc.def.response,
          respondMode: enc.manner ? enc.manner.respond : 'default',
          guiding: !!enc.guiding,
          pulse: enc.pulse,
          swell: enc.swell
        };
      },
      beckon: function () {
        return {
          active: !!beck,
          aimed: beck ? beck.aimed : false,
          screen: beck ? (function () {
            var cam = camera.offsetFor(ether.depth.stories, camStory);
            return {
              x: nearestCopy(beck.x + cam.x, ether.width, ether.viewWidth * 0.5),
              y: nearestCopy(beck.y + cam.y, ether.height, ether.viewHeight * 0.5)
            };
          })() : null,
          given: becksGiven,
          stopped: becksStopped
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
      beckonNow: beckonNow,
      bloomAt: bloomAt,
      markAt: markAt,
      blooms: function () {
        return blooms.map(function (b) { return { fig: b.fig.id, x: b.x, y: b.y }; });
      },
      marks: function () {
        return marks.map(function (m) { return { x: m.x, y: m.y }; });
      },
      setComposer: function (fn) { composer = fn; },
      setScout: function (fn) { scout = fn; },
      on: on, off: off,
      times: times,
      destroy: function () {
        destroyed = true;
        universe.root.removeEventListener('click', onRootClick);
        universe.off('ether:resized', sizeCanvas);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        // A conductor holding this instance must learn it is gone —
        // a suite that remounts through the public API would otherwise
        // leave the Composer conducting a stage that no longer exists.
        emit('destroyed', {});
      }
    };
  }

  global.EtherLife = {
    CREATURES: CREATURES,
    WONDERS: WONDERS,
    TIMES: TIMES,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
