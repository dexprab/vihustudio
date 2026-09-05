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
// ISOLATION. This document is loaded in an iframe and thrown away on
// exit, which is what "disposable" means here rather than a promise to
// tidy up. It never loads assets/ether/experience-pool.js, so the
// production pool is not merely left alone — it is out of reach. There
// no network call of any kind here, and nothing can touch a Creator, a
// card, a memory, a social record or the live Ether: none of those
// modules is loaded either. The ONE storage key this document writes
// is the runtime's own `vp-runtime-seed`, set deliberately so a replay
// is a replay (see below) — and it is PUT BACK on exit, because
// sessionStorage is per origin and the Lab page underneath can see it.
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
  var realRandom = Math.random;
  var priorSeedKey = null; // what sessionStorage held before the preview
  var seedKeyTaken = false;

  function el(sel) { return doc.querySelector(sel); }

  function teardown() {
    if (!run) return;
    try { if (run.mystery) run.mystery.destroy(); } catch (e) {}
    try { if (run.ripple) run.ripple.destroy(); } catch (e) {}
    try { if (run.life) run.life.destroy(); } catch (e) {}
    try { if (run.universe) { run.universe.stop(); run.universe.destroy(); } } catch (e) {}
    var host = el('[data-universe]');
    if (host) host.innerHTML = '';
    Math.random = realRandom;
    // The runtime's own session seed is put back exactly as it was.
    // sessionStorage is per ORIGIN rather than per document — measured,
    // by this sprint's own check going red — so the frame's write is
    // visible to the Lab page underneath it. Nothing there reads it,
    // but leaving it would be the preview altering the document that
    // opened it, which is the one thing "disposable" must mean.
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
  function play(candidate, seed, mode) {
    teardown();
    mode = (mode === 'try') ? 'try' : 'play';
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
    post('playing', { id: candidate.id, elements: report.happened.elements });
  }

  function lookPoint(universe) {
    var ether = universe.ether, camera = universe.camera;
    var cam = camera.offsetFor(ether.depth.stories, { x: 0, y: 0 });
    return { x: ether.viewWidth * 0.5 - cam.x, y: ether.viewHeight * 0.5 - cam.y };
  }

  // ---------------------------------------------------------------
  // Talking to the Lab. postMessage both ways: the candidate arrives
  // as structured data and the report goes back the same way. Nothing
  // is stored on either side of the frame.
  // ---------------------------------------------------------------
  function post(type, payload) {
    try {
      if (global.parent && global.parent !== global) {
        var msg = { type: 'lab-preview:' + type };
        var src = payload || {};
        Object.keys(src).forEach(function (k) { msg[k] = src[k]; });
        global.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }

  function exitNow() {
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
    post('exit', { report: report });
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
    global.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || d.type !== 'lab-preview:play') return;
      play(d.candidate, d.seed, d.mode);
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
    universe: function () { return run ? run.universe : null; },
    ripple: function () { return run ? run.ripple : null; },
    candidate: function () { return current ? current.candidate : null; },
    mode: function () { return current ? (current.mode || 'play') : null; },
    stories: function () {
      if (!run || !run.universe) return [];
      try { return run.universe.stories.all(); } catch (e) { return []; }
    }
  };
})(typeof window !== 'undefined' ? window : this);
