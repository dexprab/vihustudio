// tools/ether-mystery-lab/labPreview.js — the Lab's Ether preview.
//
// SPRINT — Ether Mystery Lab: Visual Experience Preview (Decision 58).
//
// WHAT THIS IS. A reviewer presses ▶ PLAY IN ETHER and this document
// builds a controlled universe, hands ONE candidate to the REAL
// Mystery interpreter through the SAME seam the Experience Composer
// uses (candidates() → begin(key, ctx)), wires the SAME touch
// ownership chain (a tap on the sky reaches the ripple, and the posed
// mystery is asked FIRST), and gets out of the way. The purpose is
// "what would this feel like to a child", so there is no game UI over
// the sky, no caption, no step list and nothing that explains the
// Mystery — whether it explains itself is the thing being judged.
//
// WHAT THIS IS NOT. It is not a second Mystery engine and not a second
// Ether renderer: every pixel on the sky is drawn by
// vihuplanet/runtime/, js/etherLife.js, js/etherRipple.js and
// js/etherMystery.js, unmodified. Nothing here interprets a candidate,
// draws an element, or decides what an outcome looks like. If a
// candidate names a capability the interpreter cannot perform,
// labPreviewSupport.js says so and this file refuses to open rather
// than approximating it.
//
// WHAT THIS IS NOT, PART TWO. It is not the Composer. The Composer
// owns WHEN a mystery may be offered — phase, rarity, novelty, quiet,
// the visit's own temperament — and none of that is a question a
// review has. The reviewer's press IS the "when", exactly as the
// Composer's own perform() is in the live sky. So the Composer is not
// mounted, the creature layer is mounted CONDUCTED (its scheduler
// stood down, so nothing crosses the sky unasked and the preview is
// about the candidate rather than about whatever else happened to
// pass), and its blooms and marks — which the interpreter reaches for
// on a discovery and on a residue — work exactly as they do live.
//
// ISOLATION. This document is opened in a TAB OF ITS OWN and closed on
// exit, which is what "disposable" means here rather than a promise to
// tidy up. It never loads assets/ether/experience-pool.js, so the
// production pool is not merely left alone — it is out of reach. There
// is no network call of any kind here, and nothing can touch a
// Creator, a card, a memory, a social record or the live Ether: none
// of those modules is loaded either. The ONE storage key this document
// writes is the runtime's own `vp-runtime-seed`, set deliberately so a
// replay is a replay (see below) — and it is PUT BACK on exit, because
// this tab is reused across plays and the key must be left as it was
// found. A tab is its own top-level browsing context, so unlike the
// frame this used to be, that write cannot reach the Lab page at all.
//
// DETERMINISM. A seeded generator replaces Math.random for the whole
// run before anything is created, so the same candidate and the same
// seed lay the sky out identically — the star field, the creations'
// places, and every placement the interpreter draws. What is NOT
// claimed is frame-for-frame identity: breathing, drifting and
// twinkling are driven by the wall clock, so two runs are the same
// composition rather than the same film.

(function (global) {
  'use strict';

  var doc = global.document;
  var Support = global.LabPreviewSupport;
  var Research = global.LabResearch;

  // ---------------------------------------------------------------
  // The seeded generator. mulberry32 — small, well-behaved, and the
  // whole reason a replay is a replay.
  // ---------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------
  // The preview world. Three creations with real covers, drawn as SVG
  // data URIs so the preview adds no binary asset and no request —
  // the runtime sandbox's own approach, for the same reason. They are
  // seeded through universe.seed(), which is the one public way
  // anything enters the Ether, and they reach the Mystery interpreter
  // only through js/etherCreationLens.js, exactly as a real Spirit
  // does.
  // ---------------------------------------------------------------
  var PREVIEW_TITLES = [
    'The lantern that walked home',
    'A door at the bottom of the garden',
    'Seven ways to catch a cloud'
  ];
  function cover(i) {
    var pairs = [['#8E7CB0', '#4C6E76'], ['#E8B871', '#8E7CB0'], ['#7EB1CE', '#1E2842']];
    var p = pairs[i % pairs.length];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">' +
      '<stop offset="0" stop-color="' + p[0] + '"/>' +
      '<stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>' +
      '<rect width="120" height="160" fill="url(#g)"/>' +
      '<circle cx="' + (34 + i * 15) + '" cy="' + (40 + i * 9) + '" r="' + (12 + i * 4) +
      '" fill="#F1EAD0" opacity="0.32"/>' +
      '<path d="M0 ' + (108 + i * 8) + ' Q30 ' + (88 + i * 6) + ' 60 ' + (104 + i * 5) +
      ' T120 ' + (98 + i * 6) + ' V160 H0 Z" fill="#1E2842" opacity="0.44"/></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function previewCreations() {
    var out = [];
    for (var i = 0; i < 3; i++) {
      out.push({
        id: 'preview-creation-' + i,
        title: PREVIEW_TITLES[i],
        cover: cover(i),
        creator: null,
        publishedAt: null,
        source: { preview: true }
      });
    }
    return out;
  }

  // ---------------------------------------------------------------
  // One run: build, pose, and hold everything needed to take it down.
  // ---------------------------------------------------------------
  var run = null;          // the live run, or null
  var current = null;      // { candidate, seed }
  var finished = false;    // the exit report has been sent
  var epoch = null;        // which of the Lab's presses this document is
  var realRandom = Math.random;
  var priorSeedKey = null; // what sessionStorage held before the preview
  var seedKeyTaken = false;

  function el(sel) { return doc.querySelector(sel); }

  function teardown() {
    if (run && run.teaseRaf) { try { global.cancelAnimationFrame(run.teaseRaf); } catch (e) {} }
    stopTease();
    if (run && run.hintTimer) { try { global.clearTimeout(run.hintTimer); } catch (e) {} }
    if (!run) return;
    try { if (run.mystery) run.mystery.destroy(); } catch (e) {}
    try { if (run.ripple) run.ripple.destroy(); } catch (e) {}
    try { if (run.life) run.life.destroy(); } catch (e) {}
    try { if (run.universe) { run.universe.stop(); run.universe.destroy(); } } catch (e) {}
    var host = el('[data-universe]');
    if (host) host.innerHTML = '';
    Math.random = realRandom;
    // The runtime's own session seed is put back exactly as it was.
    // sessionStorage is per TOP-LEVEL CONTEXT, so a preview in its own
    // tab cannot reach the Lab's — but this tab is REUSED across plays,
    // so the key is still the one thing a run leaves behind, and it is
    // still put back. (When this was a frame the two shared an origin
    // and the write WAS visible to the Lab, measured by this sprint's
    // own check going red; the tab removes that reach rather than the
    // discipline.)
    if (seedKeyTaken) {
      try {
        if (priorSeedKey === null) global.sessionStorage.removeItem('vp-runtime-seed');
        else global.sessionStorage.setItem('vp-runtime-seed', priorSeedKey);
      } catch (e) {}
      seedKeyTaken = false;
      priorSeedKey = null;
    }
    run = null;
  }

  function unavailable(why) {
    var box = el('[data-unavailable]');
    var line = el('[data-unavailable-why]');
    if (line) line.textContent = why;
    if (box) box.classList.add('on');
    var chrome = el('[data-chrome]');
    if (chrome) chrome.hidden = true;
    var hintEl = el('[data-hint]');
    if (hintEl) { hintEl.classList.remove('on'); hintEl.textContent = ''; }
  }

  // The demonstration report — what the preview actually DID, read off
  // the interpreter's own events rather than off the candidate. It is
  // secondary information shown after the reviewer leaves; nothing of
  // it appears over the sky.
  function newReport(candidate) {
    var plain = Support.plain(candidate);
    return {
      id: candidate.id || null,
      mystery: plain.mystery,
      action: plain.action,
      discovery: plain.discovery,
      next: plain.next,
      staged: [],
      happened: {
        posed: false, elements: 0, engaged: 0,
        ending: null, discovery: null, residue: false
      }
    };
  }

  // mode: 'play' — a VALID candidate, exactly as the sky would perform it.
  //       'try'  — an INVALID candidate whose idea the existing Ether can
  //                still show. The interpreter is handed a grammar that
  //                delegates to the REAL validator and stands over the four
  //                DESIGN reasons LabResearch names (RESEARCH_WAIVED) — never
  //                a capability, never a bound, never the privacy boundary.
  //                What is performed is still the interpreter's own drawing,
  //                and a candidate the real validator refuses for any other
  //                reason is refused here too.
  // opts.hint — the leading hint (§4), supplied BY THE LAB rather than
  // carried inside a candidate: the interpreter draws no text, and a
  // production Mystery still says nothing. It names what kind of thing
  // is waiting; it never explains the interaction.
  function play(candidate, seed, mode, opts) {
    teardown();
    finished = false;
    mode = (mode === 'try') ? 'try' : 'play';
    var hintText = (opts && typeof opts.hint === 'string') ? opts.hint : '';
    var teasing = (opts && opts.tease) || false;   // false | 'always' | 'delayed'
    var box = el('[data-unavailable]');
    if (box) box.classList.remove('on');
    var badge = el('[data-try-badge]');
    if (badge) badge.hidden = (mode !== 'try');

    var sup = Support.support(candidate);
    if (!sup.ok) {
      current = { candidate: candidate, seed: seed, mode: mode, report: newReport(candidate) };
      current.report.unavailable = sup.reasons;
      unavailable(Support.whyUnavailable(sup.reasons).join('; and '));
      post('unavailable', { reasons: sup.reasons, report: current.report });
      return;
    }

    var report = newReport(candidate);
    report.mode = mode;
    sup.notes.forEach(function (n) { report.staged.push(n); });
    current = { candidate: candidate, seed: seed, mode: mode, report: report };

    // Everything from here is seeded. Installed BEFORE the universe is
    // created, because the star field, the currents and where the
    // creations come to rest are all part of "the same sky".
    var n = seedFrom(String(seed) + '|' + (candidate.id || ''));
    Math.random = mulberry32(n);

    // AND THE RUNTIME'S OWN SESSION SEED IS SET RATHER THAN DRAWN.
    // vihuplanet/runtime/core/rng.js mints one on its FIRST call and
    // reads it back for ever after — so a fresh document and a replay
    // consume a different number of draws, and the second sky came out
    // different from the first. Measured, not reasoned about: the
    // first play placed a ring at 509,516 and every replay at 779,544.
    // The preview writes the key itself, in its own throwaway frame,
    // so the whole sky — star field, currents, drift — is a function
    // of the preview seed. It is the runtime's own documented key and
    // the only storage this document touches.
    try {
      priorSeedKey = global.sessionStorage.getItem('vp-runtime-seed');
      global.sessionStorage.setItem('vp-runtime-seed', String(n));
      seedKeyTaken = true;
    } catch (e) {}

    var VihuPlanet = global.VihuPlanet;
    var host = el('[data-universe]');
    if (!VihuPlanet || !host) {
      unavailable('The Ether could not be built in this preview.');
      return;
    }
    var universe = VihuPlanet.Universe.create({ mount: host });
    if (!universe) {
      unavailable('The Ether could not be built in this preview.');
      return;
    }
    universe.start();
    universe.seed(previewCreations());

    // The creature layer, CONDUCTED: no crossings of its own, and its
    // blooms and marks available to the interpreter exactly as live.
    var life = null;
    try { life = global.EtherLife.mount(universe, { conducted: true }); } catch (e) {}

    // The touch layer, unmodified. It owns how the sky acknowledges a
    // tap; below, the posed mystery is asked about that tap first —
    // the same order js/etherExperience.js uses.
    var ripple = null;
    try { ripple = global.EtherRipple.mount(universe, {}); } catch (e) {}
    if (ripple && ripple.setLife) ripple.setLife(life);

    // The REAL interpreter, over a pool of exactly this one candidate.
    // The pool is re-validated by the interpreter's own loader, so a
    // candidate that could not stand in the sky cannot be previewed
    // either — and the production pool is not loaded in this document
    // at all.
    var mystery = null;
    var researchGrammar = (mode === 'try' && Research)
      ? Research.researchGrammar(global.EtherGrammar) : null;
    try {
      mystery = global.EtherMystery.mount(universe, {
        life: life,
        grammar: researchGrammar || undefined,
        pool: {
          experiences: [{ status: 'active', source: 'lab-preview', candidate: candidate }]
        }
      });
    } catch (e) { mystery = null; }

    run = { universe: universe, life: life, ripple: ripple, mystery: mystery };

    if (!mystery) {
      unavailable('The Ether could not be built in this preview.');
      return;
    }
    if (mystery.quiet) {
      // Reduced motion: js/etherMystery.js mounts inert, deliberately,
      // and this preview does not talk it out of that — a preview that
      // played what the runtime refuses to play would be a lie about
      // the runtime.
      unavailable('This browser asks for reduced motion, and the Ether ' +
        'holds a generated mystery back for exactly that reason. ' +
        'Turn reduced motion off to review this one.');
      return;
    }

    var loadReport = mystery.poolReport();
    var bad = loadReport.filter(function (r) { return !r.ok; })[0];
    if (bad) {
      unavailable('The sky refused this one at the door: ' + bad.reasons.join(', '));
      post('unavailable', { reasons: bad.reasons, report: report });
      return;
    }

    // A place already met. An anchored candidate is ABOUT somewhere
    // the visit has been, and a preview has no earlier — so one is
    // staged, with the sky's own faint mark through the same call a
    // residue uses, and the reviewer is told it was staged rather than
    // being left to think the sky remembered something.
    var anchor = null;
    if ((candidate.ingredients || {}).anchor === true && life && life.markAt) {
      var ang = Math.random() * Math.PI * 2;
      var reach = Math.min(universe.ether.viewWidth, universe.ether.viewHeight) * 0.34;
      var lookNow = lookPoint(universe);
      anchor = { x: lookNow.x + Math.cos(ang) * reach,
                 y: lookNow.y + Math.sin(ang) * reach * 0.7 };
      try { life.markAt(anchor.x, anchor.y, { life: 90 }); } catch (e) {}
    }

    // Availability, asked of the interpreter itself — its reasons, not
    // ours. (The Composer asks exactly this before it chooses.)
    var offer = mystery.candidates();
    var mine = offer.offer.filter(function (o) { return o.key === candidate.id; })[0];
    if (!mine) {
      var refused = offer.refused.filter(function (r) { return r.id === candidate.id; })[0];
      unavailable('The Ether has nothing to build this from right now — ' +
        (refused ? refused.because : 'no reason given') + '.');
      post('unavailable', { reasons: [refused ? refused.because : 'not-offered'],
                            report: report });
      return;
    }

    mystery.on('mystery:engaged', function () { report.happened.engaged++; });
    mystery.on('mystery:resolved', function (p) {
      report.happened.ending = 'discovery';
      report.happened.discovery = p && p.discovery;
    });
    mystery.on('mystery:dissolved', function () {
      if (!report.happened.ending) report.happened.ending = 'unresolved';
    });
    mystery.on('mystery:residue', function () { report.happened.residue = true; });

    // The touch ownership chain, exactly as the live sky has it: the
    // ripple answers the tap, and the posed mystery is asked FIRST
    // about where it landed.
    if (ripple && ripple.on) {
      ripple.on('touched', function (p) {
        try { mystery.touchAt(p.x, p.y); } catch (e) {}
      });
    }

    var began = mystery.begin(candidate.id, {
      look: lookPoint(universe),
      anchor: anchor
    });
    if (!began) {
      unavailable('The Ether could not pose this one just now.');
      post('unavailable', { reasons: ['begin-refused'], report: report });
      return;
    }
    var inst = mystery.instrument();
    report.happened.posed = true;
    report.happened.elements = inst ? inst.elements.length : 0;

    var chrome = el('[data-chrome]');
    if (chrome) chrome.hidden = false;

    // The hint arrives a moment AFTER the pattern, so the lights are
    // the first thing seen and the words answer a question the child
    // has already started asking. It goes when the creature is whole —
    // from then on the thing speaks for itself.
    if (hintText) {
      var hint = el('[data-hint]');
      if (hint) {
        hint.textContent = hintText;
        run.hintTimer = global.setTimeout(function () {
          if (run && run.mystery === mystery) hint.classList.add('on');
        }, 900);
        mystery.on('mystery:joined', function (d) {
          if (d && d.left === 0) hint.classList.remove('on');
        });
      }
    }
    if (teasing) startTease(mystery, universe, teasing === true ? 'always' : teasing);
    post('playing', { id: candidate.id, elements: report.happened.elements });
  }

  // ---------------------------------------------------------------
  // THE TEASE — "these two belong together", said by light alone.
  //
  // It draws NOTHING of the mystery: the figure, its lights, its
  // joins and every response to a touch are the real interpreter's,
  // and this reads that interpreter's own instrument() and adds one
  // suggestion over the top. Two rules keep it a suggestion rather
  // than an answer. The two endpoints of a still-missing join breathe
  // TOGETHER, which is the only thing in the sky that does, so the
  // pair reads as a pair; and the almost-line between them is drawn
  // from both ends inward and is faintest in the middle, so it never
  // closes — the world leans toward the gap without filling it.
  //
  // Not one word, no arrow, no marker, nothing to press. It stops the
  // moment the shape is whole: past that the creature speaks for
  // itself, exactly as the leading hint already withdraws.
  // ---------------------------------------------------------------
  var TEASE = {
    haloR: 17,          // of the node's own halo, at the pulse's peak
    haloAlpha: 0.34,
    lineAlpha: 0.26,
    dots: 9,            // along the almost-line, ends inward
    inset: 0.14,        // how far short of each light the dots start
    breathe: 1.15       // radians per second — slower than a heartbeat
  };

  function stopTease() {
    teaseState = null;
    var c = el('[data-tease]');
    if (!c) return;
    c.hidden = true;
    try {
      var g = c.getContext('2d');
      if (g) g.clearRect(0, 0, c.width, c.height);
    } catch (e) {}
  }

  // ---------------------------------------------------------------
  // THE DELAYED AID — the world leaning in only AFTER a child has
  // tried, and only ever toward ONE gap.
  //
  // Five rules, and each is a refusal as much as a behaviour:
  //   it is not there at first, so nothing is explained in advance;
  //   it waits for two genuine attempts that did not land, so it
  //     answers effort rather than arrival;
  //   it names ONE missing join and never every possible connection;
  //   the dashes stop well short of the middle, so it can never
  //     close the join it is about — it says "these two", never "do
  //     this";
  //   it goes the instant the join is made, and fades on its own if
  //     it is not — then waits for two more tries before returning.
  //
  // Not a word, not an arrow, not a marker, nothing to press, and no
  // count of tries anywhere on screen. What the interpreter does with
  // a wrong pair — a small shiver, and nothing said — is untouched.
  //
  // AN ATTEMPT IS A SELECTION THAT ENDED WITHOUT A JOIN, and that is
  // read from the interpreter's own instrument() rather than from an
  // event, because the interpreter deliberately emits nothing when a
  // pair does not belong ("NOTHING BLAMES"). A child who chooses one
  // light and lets it go again counts, which is right: they tried.
  // ---------------------------------------------------------------
  var DELAY = {
    afterTries: 2,      // genuine attempts before the world leans in
    inMs: 1100,         // grows
    holdMs: 4500,
    outMs: 1600,        // and fades
    dashes: 7,          // per half — the middle is never drawn
    from: 0.12,         // where the dashes start, short of the light
    clear: 0.20         // half-width of the untouched middle, in u
  };

  var teaseState = null;

  function teaseReport() { return teaseState ? {
    mode: teaseState.mode, tries: teaseState.tries, phase: teaseState.phase,
    target: teaseState.target, alpha: Math.round(teaseState.alpha * 1000) / 1000,
    shown: teaseState.shown
  } : null; }

  function startTease(mystery, universe, mode) {
    var canvas = el('[data-tease]');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    canvas.hidden = false;
    teaseState = { mode: mode, tries: 0, phase: 'waiting', target: null,
                   alpha: 0, shown: 0, since: 0, sel: null, left: null };

    // The interpreter holds its lights in FIELD coordinates and the
    // sky wraps, so a screen position is the same three lines it uses
    // itself. A coordinate transform, never a second renderer.
    function nearestCopy(v, span, centre) {
      if (!(span > 0)) return v;
      return v - Math.round((v - centre) / span) * span;
    }

    function frame(t) {
      if (!run || run.mystery !== mystery) return;
      run.teaseRaf = global.requestAnimationFrame(frame);

      var dpr = Math.min(2, global.devicePixelRatio || 1);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var inst = null;
      try { inst = mystery.instrument(); } catch (e) {}
      if (!inst || !inst.arrangement || inst.arrangement.missingLeft === 0) {
        stopTease();
        return;
      }

      // ---- what this mode is allowed to draw, and when ----
      var links = inst.arrangement.links;
      var envelope = 1;
      if (teaseState && teaseState.mode === 'delayed') {
        var st = teaseState;
        var sel = inst.arrangement.selected;
        var left = inst.arrangement.missingLeft;

        // An attempt that did not land: a light was chosen, it is no
        // longer chosen, and nothing was joined by it.
        if (st.left === null) st.left = left;
        if (st.sel !== null && sel === null && left === st.left) st.tries++;
        st.sel = sel;

        // A JOIN LANDED — the aid goes at once, whichever join it was.
        if (left < st.left) {
          st.phase = 'waiting'; st.target = null; st.alpha = 0;
          st.tries = 0; st.since = t;
        }
        st.left = left;

        if (st.phase === 'waiting') {
          if (st.tries >= DELAY.afterTries) {
            // THE WIDEST GAP, NOT THE FIRST ONE. Two lights a finger's
            // width apart already look like a pair; two on opposite
            // sides of the shape do not, and that is where a child who
            // has tried twice is actually stuck. Deterministic, so the
            // same sky always leans the same way.
            var pick = null, far = -1;
            for (var q = 0; q < links.length; q++) {
              if (links[q].present) continue;
              var EA = inst.elements[links[q].a], EB = inst.elements[links[q].b];
              if (!EA || !EB) continue;
              var dd = (EA.x - EB.x) * (EA.x - EB.x) + (EA.y - EB.y) * (EA.y - EB.y);
              if (dd > far) { far = dd; pick = q; }
            }
            if (pick !== null) {
              st.phase = 'in'; st.target = pick; st.since = t; st.shown++;
            }
          }
        } else if (st.target === null || !links[st.target] || links[st.target].present) {
          st.phase = 'waiting'; st.target = null; st.alpha = 0; st.tries = 0;
        } else {
          var since = t - st.since;
          if (st.phase === 'in') {
            envelope = Math.min(1, since / DELAY.inMs);
            if (since >= DELAY.inMs) { st.phase = 'hold'; st.since = t; envelope = 1; }
          } else if (st.phase === 'hold') {
            envelope = 1;
            if (since >= DELAY.holdMs) { st.phase = 'out'; st.since = t; }
          } else {
            envelope = Math.max(0, 1 - since / DELAY.outMs);
            if (since >= DELAY.outMs) {
              st.phase = 'waiting'; st.target = null; st.tries = 0; envelope = 0;
            }
          }
        }
        st.alpha = (st.phase === 'waiting') ? 0 : envelope;
        if (st.phase === 'waiting') return;      // nothing on screen at all
      }

      var cam = { x: 0 }, span = 0;
      try {
        cam = universe.camera.offsetFor(universe.ether.depth.stories, { x: 0, y: 0 });
        span = universe.ether.width;
      } catch (e) {}

      // One clock for every pair on screen, so two lights that belong
      // together rise and fall as one — which is the whole signal.
      var pulse = 0.5 + 0.5 * Math.sin((t / 1000) * TEASE.breathe);
      var lift = 0.35 + 0.65 * pulse;

      // ONE GAP, NEVER ALL OF THEM, in delayed mode. The always-on
      // variation (Falcon C) is unchanged and still answers every
      // missing join, because that is the thing it was built to ask.
      var drawable = (teaseState && teaseState.mode === 'delayed')
        ? [links[teaseState.target]]
        : links;

      drawable.forEach(function (L) {
        if (!L || L.present) return;
        var A = inst.elements[L.a], B = inst.elements[L.b];
        if (!A || !B || A.hidden || B.hidden) return;
        var ax = nearestCopy(A.x + cam.x, span, w * 0.5), ay = A.y;
        var bx = nearestCopy(B.x + cam.x, span, w * 0.5), by = B.y;

        if (teaseState && teaseState.mode === 'delayed') {
          // A DASHED LINE THAT CANNOT CLOSE. The dashes run in from
          // each light and stop DELAY.clear short of the midpoint, so
          // the middle of the segment is never painted at any alpha —
          // it is an unfinished line about an unfinished join, and it
          // could not be mistaken for the join itself. Drawn from both
          // ends inward and thinning as it goes, so it reads as two
          // lights reaching for each other rather than as an arrow
          // pointing one way.
          ctx.lineCap = 'butt';
          for (var d = 0; d < DELAY.dashes; d++) {
            var span = (0.5 - DELAY.clear) - DELAY.from;
            var u0 = DELAY.from + (d / DELAY.dashes) * span;
            var u1 = u0 + span / DELAY.dashes * 0.55;
            var fade = 1 - (d / DELAY.dashes) * 0.72;
            var da = TEASE.lineAlpha * lift * envelope * fade;
            if (da <= 0.004) continue;
            ctx.strokeStyle = 'rgba(241,234,208,' + da.toFixed(3) + ')';
            ctx.lineWidth = 1.3;
            [[u0, u1], [1 - u1, 1 - u0]].forEach(function (seg) {
              ctx.beginPath();
              ctx.moveTo(ax + (bx - ax) * seg[0], ay + (by - ay) * seg[0]);
              ctx.lineTo(ax + (bx - ax) * seg[1], ay + (by - ay) * seg[1]);
              ctx.stroke();
            });
          }
        } else {
          // The almost-line: dots from both ends, palest in the middle,
          // and no dot is ever placed at the midpoint itself.
          for (var i = 0; i < TEASE.dots; i++) {
            var u = TEASE.inset + (i / (TEASE.dots - 1)) * (1 - TEASE.inset * 2);
            var mid = 1 - Math.abs(u - 0.5) * 2;        // 0 at the ends, 1 in the middle
            var a = TEASE.lineAlpha * lift * (1 - mid * 0.82);
            if (a <= 0.005) continue;
            ctx.beginPath();
            ctx.arc(ax + (bx - ax) * u, ay + (by - ay) * u, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(241,234,208,' + a.toFixed(3) + ')';
            ctx.fill();
          }
        }

        // And the two lights answer each other.
        [[ax, ay], [bx, by]].forEach(function (p) {
          var r = TEASE.haloR * (0.72 + 0.28 * pulse);
          var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          g.addColorStop(0, 'rgba(241,234,208,' + (TEASE.haloAlpha * lift * envelope).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(241,234,208,0)');
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        });
      });
    }
    run.teaseRaf = global.requestAnimationFrame(frame);
  }

  function lookPoint(universe) {
    var ether = universe.ether, camera = universe.camera;
    var cam = camera.offsetFor(ether.depth.stories, { x: 0, y: 0 });
    return { x: ether.viewWidth * 0.5 - cam.x, y: ether.viewHeight * 0.5 - cam.y };
  }

  // ---------------------------------------------------------------
  // Talking to the Lab. postMessage both ways: the candidate arrives
  // as structured data and the report goes back the same way. Nothing
  // is stored on either side.
  //
  // The Lab is whoever OPENED this document — its opener when this is
  // a tab, which is how the Lab opens it, and its parent frame if it
  // is ever embedded again. Opened directly with neither (a developer
  // typing the URL, and the suite's own determinism checks), there is
  // simply nobody to tell and the preview still plays.
  // ---------------------------------------------------------------
  function labWindow() {
    try {
      if (global.parent && global.parent !== global) return global.parent;
      if (global.opener && global.opener !== global) return global.opener;
    } catch (e) {}
    return null;
  }
  function post(type, payload) {
    try {
      var target = labWindow();
      if (!target) return;
      var msg = { type: 'lab-preview:' + type };
      var src = payload || {};
      Object.keys(src).forEach(function (k) { msg[k] = src[k]; });
      target.postMessage(msg, '*');
    } catch (e) {}
  }

  function exitNow() {
    if (finished) return;
    finished = true;
    var report = current ? current.report : null;
    // Whatever the interpreter last recorded outranks what the events
    // happened to catch — the outcomes ring is its own account.
    if (run && run.mystery && report) {
      try {
        var outs = run.mystery.outcomes();
        var last = outs[outs.length - 1];
        if (last) {
          report.happened.ending = last.ending;
          report.happened.discovery = last.discovery;
          report.happened.engaged = last.engaged;
        }
      } catch (e) {}
    }
    teardown();
    post('exit', { report: report, epoch: epoch });
  }

  function wire() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        if (act === 'exit') exitNow();
        else if (act === 'replay' && current) play(current.candidate, current.seed, current.mode);
      });
    });
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') exitNow();
    });
    // A reviewer may close the tab with the browser's own ✕ rather than
    // with Exit Preview. The trip still happened, so the demonstration
    // still goes home — the Lab clears its callback on the first report
    // it receives, so this can never deliver a second one.
    global.addEventListener('pagehide', function () { exitNow(); });
    global.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || d.type !== 'lab-preview:play') return;
      epoch = (typeof d.epoch === 'number') ? d.epoch : null;
      play(d.candidate, d.seed, d.mode, { hint: d.hint, tease: d.tease || false });
    });
    post('ready', {});
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
  else wire();

  // The suite's window in. Never anything a reviewer sees.
  global.LabPreview = {
    play: play,
    exit: exitNow,
    teardown: teardown,
    report: function () { return current ? current.report : null; },
    instrument: function () {
      return (run && run.mystery) ? run.mystery.instrument() : null;
    },
    // What is ALIVE in the preview sky. A completed figure outlives its
    // own mystery, so `instrument()` going null is no longer the end of
    // anything — this is how the suite watches it roam.
    alive: function () {
      return (run && run.mystery && run.mystery.wanderers)
        ? run.mystery.wanderers() : [];
    },
    mystery: function () { return run ? run.mystery : null; },
    universe: function () { return run ? run.universe : null; },
    ripple: function () { return run ? run.ripple : null; },
    candidate: function () { return current ? current.candidate : null; },
    mode: function () { return current ? (current.mode || 'play') : null; },
    tease: teaseReport,
    stories: function () {
      if (!run || !run.universe) return [];
      try { return run.universe.stories.all(); } catch (e) { return []; }
    }
  };
})(typeof window !== 'undefined' ? window : this);
