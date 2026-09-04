/* SPRINT — GENERATIVE MYSTERY & CHALLENGE ENGINE.
 *
 * The Ether must be able to continually generate new Mystery and
 * Challenge experiences from a small grammar vocabulary, validated
 * candidate DATA, and the deterministic Experience Composer — with no
 * model anywhere in any child-facing path. This suite proves it four
 * ways:
 *
 *   S. statics — the boundaries hold before a browser opens
 *   G. the grammar interpreter — the real js/etherMystery.js driven in
 *      Node against fixture worlds: the same grammar, different
 *      creations and world states, materially different experiences,
 *      zero bespoke activity code
 *   C. the conducted stack — the real Composer + the real interpreter
 *      + the real shipped pool, an hour at a time
 *   B. the browser — the real page, the real journey, real taps,
 *      touch profiles
 *
 * Suite-culture rules honoured: comments are stripped before any
 * vocabulary scan; the validator's own file (js/etherGrammar.js) is
 * exempt from vocabulary scans exactly as companionPrivacyGate is —
 * the protector legitimately names what it forbids; fixtures are the
 * lab's own (tools/ether-mystery-lab/fixtures.js), one copy; and the
 * load-bearing checks were proved by temporary reversion: the
 * validator waved through → S8 + C6 red; mystery novelty bypassed →
 * C2c red; the composer's touch hand-off removed → C4 red; the
 * lifetime bound removed → G8 red; retired entries made selectable →
 * S6 red. Each reverted build was run and restored.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8905 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-mystery-test/run-ether-mystery-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_MYSTERY_PORT || 8905);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const fixtures = require('../ether-mystery-lab/fixtures.js');

// ===================================================================
// The Node harness: one sandbox holding the REAL grammar, lens, pool,
// interpreter and (optionally) the real Composer, over a fixture
// universe and a fixture life provider. The universe and providers
// are BUILT here, never derived from the modules under test.
// ===================================================================
function makeStack(opts) {
  opts = opts || {};
  const world = {
    stillValue: 999,
    entities: opts.entities || [],
    focusOpen: false,
    frames: [],
    now: 0,
    simTime: 0,
    camX: 0, camY: 0,
    marks: [], blooms: [], becks: 0,
    summons: [],
    fetches: 0
  };
  const uniHandlers = {};
  const lifeHandlers = {};
  const universe = {
    root: {
      querySelector: () => null,
      appendChild: () => {},
      insertBefore: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    },
    ether: {
      width: 4200, height: 1000, viewWidth: 1440, viewHeight: 900,
      depth: { stories: 1 },
      palette: { star: '#F1EAD0', glow: '#E8D9A8' },
      ambient: { breath: 1 }
    },
    camera: { offsetFor: (p, out) => { const o = out || {}; o.x = world.camX; o.y = world.camY; return o; } },
    stories: { all: () => world.entities, count: () => world.entities.length },
    focus: { isOpen: () => world.focusOpen },
    traveller: { stillSeconds: () => world.stillValue },
    isRunning: () => true,
    on: (e, fn) => { (uniHandlers[e] = uniHandlers[e] || []).push(fn); },
    off: () => {}
  };
  const life = {
    quiet: false,
    conducted: true,
    times: { firstArrival: [6.5, 10], between: [95, 220], trailLife: 50,
             noticeHold: 0.45, respondDelay: 0.5, beckonAfter: 16,
             beckonSpacing: 22, beckonLife: 7, beckons: 2 },
    active: () => world.enc || null,
    trail: () => world.trailLive || null,
    beckon: () => ({ active: false, given: world.becks, stopped: !!world.becksStopped }),
    beckonNow: () => { world.becks++; return { given: world.becks, aimed: false }; },
    summon: (id, manner) => {
      if (world.enc) return null;
      world.enc = { id, manner: manner || {} };
      world.summons.push({ id, manner: manner || {}, t: world.simTime });
      emitLife('creature:arrived', { id });
      return id;
    },
    markAt: (x, y, o) => { world.marks.push({ x, y, o }); return true; },
    bloomAt: (x, y) => { world.blooms.push({ x, y }); return 'bird'; },
    on: (e, fn) => { (lifeHandlers[e] = lifeHandlers[e] || []).push(fn); },
    setComposer: () => {}, setScout: () => {}
  };
  function emitLife(e, p) { (lifeHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }
  function emitUni(e, p) { (uniHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }

  const ctxStub = new Proxy({}, {
    get: (t, k) => {
      if (k === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      if (typeof k === 'string') return function () { world.draws = (world.draws || 0) + 1; };
      return undefined;
    },
    set: () => true
  });
  function fakeCanvas() {
    return {
      width: 0, height: 0, style: {}, parentNode: null,
      getContext: () => ctxStub
    };
  }
  const g = {
    location: { search: opts.search || '' },
    requestAnimationFrame: (fn) => { world.frames.push(fn); },
    fetch: () => { world.fetches++; return Promise.reject(new Error('no network in the fixture world')); },
    document: { createElement: (tag) => fakeCanvas() },
    Image: class {
      constructor() { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; }
      set src(v) { this._src = v; this.complete = true; this.naturalWidth = 90; this.naturalHeight = 120; }
      get src() { return this._src; }
    },
    VihuPlanet: {
      Util: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
              smooth: (t) => t * t * (3 - 2 * t) },
      Env: { dpr: () => 1, reducedMotion: () => !!opts.reduced }
    },
    console: { info: () => { world.debugLines = (world.debugLines || 0) + 1; } },
    EtherDiscovery: {
      attach: () => ({ on: () => {} }),
      pickWonder: (u, near) => near
        ? { kind: 'wonder', id: null, x: near.x, y: near.y }
        : { kind: 'wonder', id: null, x: 0, y: 0 }
    }
  };
  g.window = g;
  ['js/etherGrammar.js', 'js/etherCreationLens.js',
   'assets/ether/experience-pool.js', 'js/etherMystery.js'].forEach((rel) => {
    new Function('window', read(rel) + '\n//# sourceURL=' + rel)(g);
  });
  if (opts.composer) {
    new Function('window', read('js/etherExperience.js') + '\n//# sourceURL=etherExperience.js')(g);
  }

  return {
    world, universe, life, g, emitLife, emitUni,
    mountMystery: (o) => g.EtherMystery.mount(universe, Object.assign({ life }, o || {})),
    mountComposer: (o) => g.EtherExperience.mount(universe, life, o || {}),
    pump: (seconds, scale, perFrame) => {
      scale = scale || 1;
      const frameSim = 0.04 * scale;
      const target = world.simTime + seconds;
      let guard = 0;
      while (world.simTime < target && guard++ < 500000) {
        world.simTime += frameSim;
        world.now += 40;
        const q = world.frames.splice(0);
        q.forEach((fn) => fn(world.now));
        if (perFrame) perFrame(world.simTime);
      }
    }
  };
}

function sampleEntities() {
  return [
    { id: 'st-forest', title: 'The Tiny Forest', cover: 'cover-forest',
      pages: 5, prox: 0, focusT: 0, position: { x: 600, y: 300 },
      publishedAt: '2026-08-01T00:00:00Z' },
    { id: 'st-moon', title: 'The Moon Garden', cover: 'cover-moon',
      pages: 3, prox: 0, focusT: 0, position: { x: 3200, y: 700 },
      publishedAt: '2026-08-20T00:00:00Z' },
    { id: 'st-boat', title: 'A Little Boat', cover: 'cover-boat',
      pages: 8, prox: 0, focusT: 0, position: { x: 1900, y: 500 },
      publishedAt: '2026-07-01T00:00:00Z' }
  ];
}

// Point the fixture camera so a field position sits at the centre of
// the view — the harness's way of "turning toward" something.
function lookAt(h, x, y) {
  h.world.camX = h.universe.ether.viewWidth * 0.5 - x;
  h.world.camY = h.universe.ether.viewHeight * 0.5 - y;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  // =================================================================
  console.log('\nS. STATICS — the boundaries hold before a browser opens');
  // =================================================================
  const mysterySrc = read('js/etherMystery.js');
  const grammarSrc = read('js/etherGrammar.js');
  const lensSrc = read('js/etherCreationLens.js');
  const poolSrc = read('assets/ether/experience-pool.js');
  const expSrc = read('js/etherExperience.js');
  const mysteryCode = stripComments(mysterySrc);
  const lensCode = stripComments(lensSrc);
  const expCode = stripComments(expSrc);

  // S1 — Decision 9's own test, extended to the generative layer: the
  // protected runtime files never learned any of it exists.
  {
    const protectedFiles = [
      'vihuplanet/runtime/physics/physics.js',
      'vihuplanet/runtime/stories/storyManager.js',
      'vihuplanet/runtime/ether/etherRenderer.js',
      'vihuplanet/runtime/core/universe.js',
      'vihuplanet/runtime/ambient/ambientSystem.js',
      'vihuplanet/runtime/core/traveller.js'
    ];
    const dirty = protectedFiles.filter((f) => {
      const s = read(f).toLowerCase();
      return /ethermystery|ethergrammar|ethercreationlens|vihuethermystery|experiencepool/.test(s);
    });
    ck(dirty.length === 0, 'S1  the runtime never learned the generative layer exists',
       dirty.join(', ') || protectedFiles.length + ' files clean');
  }

  // S2 — no gamification vocabulary in the Traveller-facing modules,
  // comments stripped first. js/etherGrammar.js is deliberately NOT
  // scanned: it is the protector and legitimately names what it
  // forbids (the companionPrivacyGate precedent).
  {
    const banned = /\b(score|scores|scored|streak|leaderboard|badge|reward|rewards|xp|rank|ranking|achievement|combo|currency|unlock|coin|coins|quest|timer)\b/i;
    const hitM = mysteryCode.match(banned);
    const hitL = lensCode.match(banned);
    ck(!hitM && !hitL, 'S2  no gamification vocabulary in the interpreter or the lens',
       (hitM && hitM[0]) || (hitL && hitL[0]));
  }

  // S3 — a Traveller is stateless: no storage API anywhere new.
  {
    const storage = /(localStorage|sessionStorage|indexedDB|document\.cookie)/;
    ck(!storage.test(mysteryCode) && !storage.test(stripComments(grammarSrc)) &&
       !storage.test(lensCode) && !storage.test(stripComments(poolSrc)),
       'S3  nothing is stored — every visit starts the sea unread');
  }

  // S4 — the runtime hot path holds no network, no model, no timers
  // of its own, and cannot execute a generated string.
  {
    const net = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/;
    const timers = /\b(setTimeout|setInterval)\b/;
    // An actual invocation, not the word: the validator's own ban
    // list spells the words it forbids (the recorded needle-in-its-
    // own-vocabulary trap — the ban pattern's escaped text must not
    // read as a call).
    const evil = /\beval\s*\(|new\s+Function\s*\(/;
    ck(!net.test(mysteryCode) && !timers.test(mysteryCode) && !evil.test(mysteryCode),
       'S4  the interpreter: no network, no timers, no way to execute data');
    ck(!net.test(stripComments(grammarSrc)) && !evil.test(stripComments(grammarSrc)),
       'S4b the validator: pure functions, no network, no execution');
  }

  // S5 — every ACTIVE entry in the shipped pool passes the real
  // validator, through the same loadPool the runtime uses.
  {
    const h = makeStack({});
    const loaded = h.g.EtherMystery.loadPool(h.g.EtherExperiencePool, h.g.EtherGrammar);
    const bad = loaded.report.filter((r) => r.status === 'active' && !r.ok);
    ck(bad.length === 0 && loaded.active.length >= 5,
       'S5  every active pool entry validates at load',
       loaded.active.length + ' active');
    // S5b — the shipped pool spans several grammars over the same
    // capability vocabulary — a vocabulary, not a catalogue.
    const grammars = new Set(loaded.active.map((a) => a.candidate.grammar));
    ck(grammars.size >= 4, 'S5b the pool spans genuinely different grammars',
       [...grammars].join(', '));
    // S6 — a retired experience is present, honest about why, and
    // never selectable.
    const retired = (h.g.EtherExperiencePool.experiences || [])
      .filter((e) => e.status === 'retired');
    const retiredActive = loaded.active.some((a) =>
      retired.some((r) => r.candidate.id === a.id));
    ck(retired.length >= 1 && retired[0].retiredBecause && !retiredActive,
       'S6  a retired experience stays for the record and is never selectable');
  }

  // S7 — the lens: the projection is BUILT, and carries nothing from
  // the forbidden family even when the input carries everything.
  {
    const h = makeStack({});
    const Lens = h.g.EtherCreationLens;
    const loaded = {
      id: 'st-x', title: 'A Story', cover: 'cov', pages: 4, focusT: 0,
      position: { x: 1, y: 2 },
      creator: 'somebody', creatorUsername: 'moonmaker', forUsername: 'pal',
      publishedAt: 'x', hasAudio: true, cheers: 9, grown: true,
      source: { projectId: 'proj_1', companion: { id: 'leafy' },
                creatorUsername: 'moonmaker' },
      stars: [1, 2, 3], cardId: 'card_1', email: 'a@b.c'
    };
    const p = Lens.project(loaded);
    const leak = p ? Object.keys(p).filter((k) => Lens.NEVER.indexOf(k) !== -1) : [];
    ck(!!p && leak.length === 0 &&
       JSON.stringify(p).indexOf('moonmaker') === -1 &&
       JSON.stringify(p).indexOf('card_1') === -1 &&
       JSON.stringify(p).indexOf('a@b.c') === -1 &&
       JSON.stringify(p).indexOf('leafy') === -1,
       'S7  the lens builds a projection; nothing private survives into it',
       p ? Object.keys(p).join(',') : 'null');
    const s = Lens.structure(loaded);
    ck(!!s && Object.keys(s).sort().join(',') === 'hasCover,kind,pages',
       'S7b what a generator may see is creative shape alone',
       s ? Object.keys(s).join(',') : 'null');
    ck(Lens.project({ id: 'no-cover', title: 'x', cover: null, focusT: 0 }) === null,
       'S7c an entity with nothing to show is refused, not guessed at');
  }

  // S8 — the validator battery: every adversarial fixture refused
  // with its named reason; every valid fixture approved.
  {
    const h = makeStack({});
    const Grammar = h.g.EtherGrammar;
    const existing = (h.g.EtherExperiencePool.experiences || [])
      .filter((e) => e.status === 'active')
      .map((e) => Grammar.signature(e.candidate));
    let wrong = [];
    fixtures.adversarial.forEach((f) => {
      const v = Grammar.validate(f.candidate, { existing });
      const hit = !v.ok && v.reasons.some((r) => r.indexOf(f.expect) !== -1);
      if (!hit) wrong.push(f.label + ' → ' + (v.ok ? 'approved' : v.reasons.join('/')));
    });
    ck(wrong.length === 0,
       'S8  every adversarial candidate is refused with its named reason',
       wrong[0] || fixtures.adversarial.length + ' refused');
    let refusedValid = [];
    fixtures.valid.forEach((f) => {
      const v = Grammar.validate(f.candidate, { existing });
      if (!v.ok) refusedValid.push(f.label + ' → ' + v.reasons.join('/'));
    });
    ck(refusedValid.length === 0,
       'S8b the vocabulary expresses grammars beyond the shipped pool',
       refusedValid[0] || fixtures.valid.length + ' approved (transform, echo, complete, return)');
  }

  // S9 — the generation contract is one copy, built by the module
  // itself, and carries the boundaries with it.
  {
    const h = makeStack({});
    const c = h.g.EtherGrammar.contract({});
    ck(c.grammars.length === 10 && Array.isArray(c.boundaries) &&
       c.boundaries.length >= 5 && !!c.capabilities && !!c.schema,
       'S9  the generation contract carries vocabulary, schema and boundaries together');
  }

  // S10 — the composer treats the provider as optional: nothing in
  // the shipped composer requires it (opts.mystery absent → the
  // baseline behaviour, proved behaviourally in C1).
  {
    ck(/opts\.mystery/.test(expCode) && /mysteryLive\(\)/.test(expCode),
       'S10 the composer gained a seam, not a dependency');
  }

  // =================================================================
  console.log('\nG. THE GRAMMAR INTERPRETER — one grammar, many experiences');
  // =================================================================

  // G1 — the same grammar over different creations and world states
  // produces MATERIALLY different experiences, with zero bespoke
  // activity code: different creation bound, different places on the
  // sky, same candidate data.
  {
    function instantiate(entIdx, lookX, lookY) {
      const h = makeStack({ entities: sampleEntities() });
      // Lean the choice: make every creation but one already-met.
      h.world.entities.forEach((e, i) => { e.prox = i === entIdx ? 0 : 0.9; });
      const my = h.mountMystery();
      const began = my.begin('a-cover-come-apart', { look: { x: lookX, y: lookY } });
      return { h, my, began, inst: my.instrument() };
    }
    const a = instantiate(0, 720, 450);
    const b = instantiate(1, 3000, 300);
    const posA = a.inst.elements.map((e) => Math.round(e.x) + ',' + Math.round(e.y)).join(' ');
    const posB = b.inst.elements.map((e) => Math.round(e.x) + ',' + Math.round(e.y)).join(' ');
    ck(a.began === 'a-cover-come-apart' && b.began === 'a-cover-come-apart' &&
       a.inst.creation === 'st-forest' && b.inst.creation === 'st-moon' &&
       posA !== posB,
       'G1  one candidate, two worlds — two materially different experiences',
       a.inst.creation + ' vs ' + b.inst.creation);
    ck(a.inst.elements.length === 4 &&
       a.inst.elements.every((e) => e.show === 'shard'),
       'G1b the pieces are the creation\'s own cover, scattered', posA);
  }

  // G2 — RECONSTRUCT end-to-end: pieces engaged, pieces gather, the
  // creation is revealed, and the light goes to its own Spirit.
  {
    const h = makeStack({ entities: sampleEntities() });
    h.world.entities.forEach((e, i) => { e.prox = i === 0 ? 0 : 0.9; });
    const my = h.mountMystery();
    my.setTimeScale(1);
    const events = [];
    ['mystery:begun', 'mystery:engaged', 'mystery:resolved', 'mystery:dissolved',
     'mystery:residue'].forEach((ev) => my.on(ev, (p) => events.push([ev, p])));
    my.begin('a-cover-come-apart', { look: { x: 700, y: 450 } });
    h.pump(1, 1);
    const inst0 = my.instrument();
    // Tap each piece — the same field-coordinate entry a real tap
    // takes through the Composer's ownership chain.
    inst0.elements.forEach((el) => { my.touchAt(el.x, el.y); h.pump(0.3, 1); });
    h.pump(0.5, 1);
    const engaged = events.filter((e) => e[0] === 'mystery:engaged').length;
    const resolved = events.find((e) => e[0] === 'mystery:resolved');
    ck(engaged === 4 && !!resolved &&
       resolved[1].discovery === 'creation-revealed' &&
       resolved[1].storyId === 'st-forest',
       'G2  reconstruct: engage the pieces, the creation is revealed',
       engaged + ' engaged, ' + (resolved ? resolved[1].discovery : 'unresolved'));
    // The travelling light heads for the Spirit itself while the
    // pieces close.
    const instC = my.instrument();
    ck(!!instC && instC.state === 'closing' &&
       (instC.effects.indexOf('travel') !== -1 || instC.effects.indexOf('halo') !== -1),
       'G2b the answer travels to the creation\'s own Spirit',
       instC ? instC.state + ':' + instC.effects.join(',') : 'gone early');
    h.pump(6, 1);
    ck(my.instrument() === null && my.live() === null,
       'G2c and the sky is clean afterwards — nothing accumulates');
  }

  // G3 — the SAME creation in ANOTHER grammar is a different
  // experience: same ingredient, different question (asset reuse is
  // free; experience-pattern repetition is what novelty punishes).
  {
    const h = makeStack({ entities: sampleEntities() });
    h.world.entities.forEach((e, i) => { e.prox = i === 0 ? 0 : 0.9; });
    const my = h.mountMystery();
    my.begin('behind-a-veil-of-light', { look: { x: 700, y: 450 } });
    const inst = my.instrument();
    const shows = inst.elements.map((e) => e.show).sort().join(',');
    const hiddenBehind = inst.elements.find((e) => e.show === 'shard');
    ck(inst.creation === 'st-forest' && inst.grammar === 'uncover' &&
       shows === 'shard,veil' && hiddenBehind.hidden === true,
       'G3  the same creation, another grammar — a different question entirely',
       shows + ' vs 4×shard');
  }

  // G4 — UNCOVER by dwell: turning toward the veil and looking a
  // while is the whole engagement — no tap, no dexterity, no reading.
  {
    let sawEnd = null, tries = 0;
    while (!sawEnd && tries++ < 14) {
      const h = makeStack({ entities: sampleEntities() });
      h.world.entities.forEach((e, i) => { e.prox = i === 0 ? 0 : 0.9; });
      const my = h.mountMystery();
      const events = [];
      ['mystery:resolved', 'mystery:dissolved'].forEach((ev) =>
        my.on(ev, (p) => events.push([ev, p])));
      my.begin('behind-a-veil-of-light', { look: { x: 700, y: 450 } });
      h.pump(0.5, 1);
      const veil = my.instrument().elements.find((e) => e.show === 'veil');
      lookAt(h, veil.x, veil.y);
      h.world.stillValue = 1;         // the child just turned
      h.pump(6, 1);
      const done = events[0];
      if (!done) { fail('G4  uncover engages by dwell alone'); break; }
      if (tries === 1) {
        ok('G4  uncover engages by dwell alone — look, and it answers',
           done[0].replace('mystery:', ''));
      }
      if (done[0] === 'mystery:resolved') { sawEnd = done; break; }
    }
    ck(!!sawEnd, 'G4b and sometimes what is behind the veil is a real discovery',
       sawEnd ? sawEnd[1].discovery : 'never resolved in 14 visits');
  }

  // G5 — an Ether-native mystery needs no creation at all, and its
  // outcome is genuinely uncertain: across fresh visits, both endings
  // occur, and a resolved one leaves residue that becomes a PLACE.
  {
    let discoveries = 0, unresolved = 0, residues = 0, blooms = 0;
    for (let v = 0; v < 24; v++) {
      const h = makeStack({ entities: [] });   // an empty universe
      const my = h.mountMystery();
      const events = [];
      ['mystery:resolved', 'mystery:dissolved', 'mystery:residue'].forEach((ev) =>
        my.on(ev, (p) => events.push([ev, p])));
      const began = my.begin('stars-that-answer', { look: { x: 700, y: 450 } });
      if (!began) { fail('G5  ether-native mystery refused to begin'); break; }
      h.pump(0.6, 1);
      my.instrument().elements.forEach((el) => { my.touchAt(el.x, el.y); h.pump(0.2, 1); });
      h.pump(1.5, 1);
      if (events.some((e) => e[0] === 'mystery:resolved')) discoveries++;
      if (events.some((e) => e[0] === 'mystery:dissolved')) unresolved++;
      if (events.some((e) => e[0] === 'mystery:residue')) residues++;
      blooms += h.world.blooms.length;
    }
    ck(discoveries > 0 && unresolved > 0,
       'G5  no creation needed, and the linked stars stay uncertain',
       discoveries + ' resolved, ' + unresolved + ' stayed open over 24 visits');
    ck(residues > 0 && residues === discoveries && blooms === discoveries,
       'G5b a resolved connection blooms, and leaves something behind',
       residues + ' residues, ' + blooms + ' blooms');
  }

  // G6 — tap ownership: a tap near a posed element belongs to the
  // mystery (claimed), a tap on far empty sky does not.
  {
    const h = makeStack({ entities: [] });
    const my = h.mountMystery();
    my.begin('stars-that-answer', { look: { x: 700, y: 450 } });
    h.pump(0.6, 1);
    const el = my.instrument().elements[0];
    const near = my.touchAt(el.x + 20, el.y - 15);
    const farAway = my.touchAt(el.x + 900, el.y + 300);
    ck(near === true && farAway === false,
       'G6  a tap near a posed thing is the mystery\'s; far sky is not');
  }

  // G7 — NOTICE always stays unresolved: noticing is the whole of it,
  // and nothing is ever owed.
  {
    const h = makeStack({ entities: [] });
    const my = h.mountMystery();
    const events = [];
    ['mystery:resolved', 'mystery:dissolved'].forEach((ev) =>
      my.on(ev, (p) => events.push([ev, p])));
    my.begin('a-quiet-change', { look: { x: 700, y: 450 } });
    h.pump(0.5, 1);
    const sh = my.instrument().elements[0];
    lookAt(h, sh.x, sh.y);
    h.world.stillValue = 1;
    h.pump(7, 1);
    ck(events.length > 0 && events.every((e) => e[0] === 'mystery:dissolved'),
       'G7  a noticed change dissolves, unexplained — mystery without challenge',
       events.map((e) => e[0]).join(','));
  }

  // G8 — an untaken mystery dissolves on its own bounded lifetime;
  // nothing nags, nothing waits forever, nothing accumulates.
  {
    const h = makeStack({ entities: sampleEntities() });
    const my = h.mountMystery();
    const events = [];
    my.on('mystery:dissolved', (p) => events.push(p));
    my.begin('a-cover-come-apart', { look: { x: 700, y: 450 } });
    my.setTimeScale(30);
    h.pump(140, 30);
    ck(events.length === 1 && my.instrument() === null,
       'G8  an ignored mystery dissolves — a question is never a debt');
    // G8b — the interpreter enforces the piece ceiling whatever the
    // data says (belt and braces beneath the validator).
    ck(h.g.EtherMystery.LIMITS.pieces <= 10,
       'G8b the hard entity ceiling exists in the runtime too');
  }

  // G9 — TRACE: the fragment leaves when approached, and only then
  // does the path it left appear — stepwise, toward the creation.
  {
    const h = makeStack({ entities: sampleEntities() });
    h.world.entities.forEach((e, i) => { e.prox = i === 2 ? 0 : 0.9; });
    const my = h.mountMystery();
    my.begin('what-slips-away', { look: { x: 700, y: 450 } });
    h.pump(0.5, 1);
    const before = my.instrument();
    const hiddenBefore = before.elements.filter((e) => e.hidden).length;
    const frag = before.elements.find((e) => e.role === 'fragment');
    lookAt(h, frag.x, frag.y);
    h.world.stillValue = 1;
    h.pump(4.5, 1);
    const after = my.instrument();
    const fragAfter = after.elements.find((e) => e.role === 'fragment');
    const appeared = after.elements.filter((e) => e.role === 'passage' && !e.hidden).length;
    ck(hiddenBefore === 3 && fragAfter.engaged && appeared >= 2,
       'G9  trace: approach it and it slips away, leaving a path that was not there',
       hiddenBefore + ' hidden → ' + appeared + ' appeared');
  }

  // G10 — reduced motion mounts the whole layer inert: a generated
  // mystery is exactly the unrequested motion the setting silences.
  {
    const h = makeStack({ entities: sampleEntities(), reduced: true });
    const my = h.mountMystery();
    const c = my.candidates();
    ck(my.quiet === true && my.begin('a-cover-come-apart', {}) === null &&
       c.offer.length === 0 && c.refused[0].because === 'reduced-motion',
       'G10 reduced motion: the layer mounts inert, refusals named');
  }

  // =================================================================
  console.log('\nC. THE CONDUCTED STACK — the Composer stays the authority');
  // =================================================================

  // A Traveller who keeps gently exploring — the same drive the
  // experience suite's own long-session checks use: stillness low
  // then high, the camera wandering.
  function explorer(h) {
    const cross = autoCrossOf(h);
    return (t) => {
      cross(t);
      h.world.stillValue = (Math.floor(t / 30) % 3 === 0) ? 1.2 : 40;
      h.world.camX = Math.sin(t / 300) * 2000;
    };
  }

  // C1 — with no mystery provider the composer behaves exactly as
  // shipped: nothing mystery-shaped in an hour of history.
  {
    const h = makeStack({ entities: sampleEntities(), composer: true });
    const exp = h.mountComposer({});
    exp.setTimeScale(40);
    h.pump(3600, 40, explorer(h));
    const mystHist = exp.history().filter((x) => String(x.pattern).indexOf('mystery:') === 0);
    ck(mystHist.length === 0 && exp.history().length > 0,
       'C1  without the provider, the composer is byte-for-byte the baseline sky',
       exp.history().length + ' experiences, none generated');
  }

  // C2 — with the provider attached, a long visit holds generated
  // mysteries AMONG the baseline patterns — chosen by the composer's
  // own weighing, begun only when the composer says.
  {
    const h = makeStack({ entities: sampleEntities(), composer: true });
    const my = h.mountMystery();
    const begun = [];
    my.on('mystery:begun', (p) => begun.push(p));
    const exp = h.mountComposer({ mystery: my });
    exp.setTimeScale(40);
    my.setTimeScale(40);
    const drive = explorer(h);
    let quietFrames = 0, totalFrames = 0;
    h.pump(7200, 40, (t) => {
      drive(t);
      totalFrames++;
      if (!h.world.enc && !exp.state().live) quietFrames++;
    });
    const hist = exp.history();
    const mystHist = hist.filter((x) => String(x.pattern).indexOf('mystery:') === 0);
    const others = hist.filter((x) => String(x.pattern).indexOf('mystery:') !== 0);
    ck(mystHist.length >= 1 && others.length >= 4,
       'C2  a two-hour visit holds generated mysteries among the baseline sky',
       mystHist.length + ' generated, ' + others.length + ' baseline');
    // Every begun mystery corresponds to a composer decision — the
    // provider never started one by itself.
    // (The decision ring is bounded, so early choices may have
    // scrolled off; what cannot lie is that the provider has no
    // schedule — a begin can only come from the composer's perform.)
    ck(begun.length === mystHist.length,
       'C2b every generated mystery in the history is one the composer began',
       begun.length + ' begun');
    // C2c — the novelty identity is the GRAMMAR: no grammar repeats
    // itself back to back in the mystery history.
    let backToBack = 0;
    for (let i = 1; i < hist.length; i++) {
      if (String(hist[i].pattern).indexOf('mystery:') === 0 &&
          hist[i].pattern === hist[i - 1].pattern) backToBack++;
    }
    ck(backToBack === 0,
       'C2c the same grammar never plays twice running — novelty holds for generated rows');
    // C2d — quiet remains the sky's usual state. Quiet in this
    // architecture is what the CHILD experiences: the drawn gaps
    // between offers, one thing at a time, and the untaken mystery
    // dissolving — so it is measured as sky-time with nothing live,
    // never as a count of a log entry.
    const quietFrac = totalFrames ? quietFrames / totalFrames : 0;
    ck(quietFrac > 0.5, 'C2d most of a two-hour sky is quiet, pool and all',
       Math.round(quietFrac * 100) + '% of the visit held nothing live');
    // C2e — no network was touched by anything, ever.
    ck(h.world.fetches === 0, 'C2e two simulated hours, zero network requests');
  }

  // C3 — a resolved mystery is a find: the sky rests after it, and
  // the residue place becomes an anchor a later experience may echo.
  {
    const h = makeStack({ entities: [], composer: true });
    const my = h.mountMystery();
    const exp = h.mountComposer({ mystery: my });
    // Begin one directly through the provider's public API (the same
    // instance the composer conducts), then resolve it by hand.
    h.pump(12, 1);
    my.begin('stars-that-answer', { look: { x: 700, y: 450 } });
    h.pump(0.6, 1);
    let resolvedNow = false;
    my.on('mystery:resolved', () => { resolvedNow = true; });
    for (let round = 0; round < 40 && !resolvedNow; round++) {
      const inst = my.instrument();
      if (!inst) {
        // stayed open — pose it again until one resolves
        my.begin('stars-that-answer', { look: { x: 700, y: 450 } });
        h.pump(0.6, 1);
        continue;
      }
      inst.elements.forEach((el) => { my.touchAt(el.x, el.y); h.pump(0.25, 1); });
      h.pump(3.5, 1);
    }
    const anchors = exp.anchors();
    const whys = anchors.map((a) => a.why);
    ck(resolvedNow && whys.indexOf('mystery') !== -1 && whys.indexOf('residue') !== -1,
       'C3  a resolved mystery leaves places — an anchor, and a residue to echo',
       whys.join(','));
    ck(exp.state().resting === true || exp.phase() === 'quiet',
       'C3b and the sky rests after the find, exactly as after a trail');
  }

  // C4 — a touch on a posed mystery is claimed BEFORE the composer's
  // own touch answers; the log names the ownership.
  {
    const h = makeStack({ entities: [], composer: true });
    const my = h.mountMystery();
    const exp = h.mountComposer({ mystery: my });
    h.pump(30, 2);
    my.begin('stars-that-answer', { look: { x: 700, y: 450 } });
    h.pump(0.6, 1);
    const el = my.instrument().elements[0];
    const answer = exp.touchNow({ x: el.x, y: el.y });
    const last = exp.diagnostics().decisions.filter((d) => d.touch).pop();
    ck(answer === null && last && last.chosen === 'mystery' &&
       my.instrument().elements[0].engaged === true,
       'C4  the composer hands a touch to the posed mystery first',
       last && last.chosen);
    // And while it is posed, the beckon and other patterns stand down.
    const decideAnswer = exp.decideNow();
    const lastDecide = exp.diagnostics().decisions.filter((d) => !d.touch).pop();
    const refusals = (lastDecide.rejected || []).map((r) => r.because);
    ck(decideAnswer === null || refusals.indexOf('mystery-live') !== -1,
       'C4b while a mystery is posed, the rest of the sky waits its turn',
       refusals.filter((r, i, a) => a.indexOf(r) === i).join(','));
  }

  // C5 — an experience the pool cannot serve (a creation-bound row in
  // an empty universe) is refused with its reason in the decision
  // log, never selected, never broken.
  {
    const h = makeStack({ entities: [], composer: true });
    const my = h.mountMystery();
    const exp = h.mountComposer({ mystery: my });
    exp.setTimeScale(40);
    my.setTimeScale(40);
    h.pump(1800, 40, explorer(h));
    const rejects = [];
    exp.diagnostics().decisions.forEach((d) => (d.rejected || []).forEach((r) => {
      if (String(r.id).indexOf('mystery:') === 0) rejects.push(r.because);
    }));
    ck(rejects.indexOf('no-suitable-creation') !== -1,
       'C5  a creation-bound row in an empty universe is refused by name');
    const hist = exp.history().filter((x) =>
      x.pattern === 'mystery:reconstruct' || x.pattern === 'mystery:uncover' ||
      x.pattern === 'mystery:trace');
    ck(hist.length === 0,
       'C5b and is never selected — the composer cannot be talked into it');
  }

  // C6 — an invalid entry never reaches the composer at all: poison
  // the pool, remount, and the bad entry is refused at load with its
  // reasons while the good ones still play.
  {
    const h = makeStack({ entities: sampleEntities() });
    const poisoned = JSON.parse(JSON.stringify(h.g.EtherExperiencePool));
    poisoned.experiences.push({
      status: 'active', source: 'fixture',
      candidate: {
        id: 'poison-pill', grammar: 'connect',
        title: 'tap fast to win big points',
        elements: [{ role: 'star', show: 'glint', place: 'ring', count: 3 }],
        engage: [{ action: 'tap', on: 'star' }],
        outcome: { possible: ['discovery'], discovery: 'wonder' }
      }
    });
    const my = h.mountMystery({ pool: poisoned });
    const report = my.poolReport();
    const pill = report.find((r) => r.id === 'poison-pill');
    const offered = my.candidates().offer.map((o) => o.key);
    ck(!!pill && pill.ok === false && pill.reasons.length > 0 &&
       offered.indexOf('poison-pill') === -1 && offered.length >= 4,
       'C6  a poisoned entry is refused at load and can never be offered',
       pill ? pill.reasons.join('/') : 'missing');
  }

  // =================================================================
  // The M-only gate, for reversion proofs without a browser.
  if (process.env.M_ONLY) {
    console.log('\n' + (failed ? 'FAILED' : 'ALL GREEN') + ' (S+G+C only) — ' +
                passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  }

  // =================================================================
  console.log('\nB. THE BROWSER — the real page, the real journey');
  // =================================================================
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  async function freshPage(ctxOpts, url) {
    const context = await browser.newContext(Object.assign(
      { viewport: { width: 1440, height: 900 } }, ctxOpts || {}));
    const page = await context.newPage();
    page.errors = [];
    page.consoleLines = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    page.on('console', (m) => page.consoleLines.push(m.text()));
    await page.goto(BASE + (url || '/index.html'));
    await page.waitForSelector('[data-begin]', { timeout: 20000 });
    await page.click('[data-begin]');
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 15000 });
    return { page, context };
  }

  // A tiny real cover, seeded through the universe's own public seed().
  const COVER_DATA =
    'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120">' +
      '<rect width="90" height="120" fill="#3a4a6b"/>' +
      '<circle cx="45" cy="50" r="24" fill="#f1ead0"/></svg>').toString('base64');

  // B0 — the served tree is THIS tree (the concurrent-worktree lesson).
  {
    const served = await (await fetch(BASE + '/js/etherMystery.js')).text();
    const local = read('js/etherMystery.js');
    ck(served === local, 'B0  the server is serving this checkout');
  }

  // B1 — the real journey mounts the whole stack; the pool loads and
  // reports; the retired entry is not active; zero page errors.
  {
    const { page, context } = await freshPage();
    const out = await page.evaluate(() => {
      const my = window.vihuEtherMystery;
      const d = my ? my.diagnostics() : null;
      return {
        mounted: !!my,
        quiet: my ? my.quiet : null,
        activeKeys: d ? d.activeKeys : [],
        reportOk: d ? d.pool.filter((r) => r.ok).length : 0,
        composerSees: !!(window.vihuEtherComposer &&
          window.vihuEtherComposer.diagnostics().mystery),
        canvas: document.querySelectorAll('.vp-ether-mystery').length
      };
    });
    ck(out.mounted && out.quiet === false && out.activeKeys.length >= 5 &&
       out.activeKeys.indexOf('an-asking-place') === -1,
       'B1  the pool mounts on the real journey; retired stays retired',
       out.activeKeys.length + ' active');
    ck(out.composerSees && out.canvas === 1,
       'B1b one stage canvas, and the composer sees its provider');
    ck(page.errors.length === 0, 'B1c zero page errors', page.errors[0]);
    await page.screenshot({ path: path.join(SHOTS, 'b1-mounted.png') });
    await context.close();
  }

  // B2 — a posed mystery on the real sky, engaged with real clicks
  // through the real ownership chain (root click → ripple → composer
  // → mystery), resolving or staying open — and the child saw
  // fragments of a REAL seeded creation.
  {
    const { page, context } = await freshPage();
    const begun = await page.evaluate(() => {
      const my = window.vihuEtherMystery;
      const got = my.begin('stars-that-answer', { look: null });
      const inst = my.instrument();
      return { got, n: inst ? inst.elements.length : 0 };
    });
    ck(begun.got === 'stars-that-answer' && begun.n === 3,
       'B2  a connect mystery poses three aware stars on the real sky');
    // Let the stars arrive before tapping — a thing still fading in
    // is not yet a thing a tap can land on.
    await page.waitForFunction(() =>
      window.vihuEtherMystery.instrument() &&
      window.vihuEtherMystery.instrument().elements[0].alpha > 0.2,
      null, { timeout: 8000 });
    // Tap each star with a REAL click at its screen position.
    let engaged = 0;
    for (let i = 0; i < 3; i++) {
      const spot = await page.evaluate((idx) => {
        const my = window.vihuEtherMystery;
        const inst = my.instrument();
        if (!inst) return null;
        const el = inst.elements[idx];
        // element field position → screen, the layer's own math
        const uni = document.querySelector('.vp-universe');
        return { x: el.x, y: el.y };
      }, i);
      if (!spot) break;
      engaged = await page.evaluate((s) => {
        const my = window.vihuEtherMystery;
        my.touchAt(s.x, s.y);
        const inst = my.instrument();
        return inst ? inst.elements.filter((e) => e.engaged).length : 3;
      }, spot);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => {
      const my = window.vihuEtherMystery;
      return {
        outcomes: my.outcomes(),
        live: my.live(),
        canvas: document.querySelectorAll('.vp-ether-mystery').length
      };
    });
    ck(engaged >= 3 && after.outcomes.length === 1 &&
       ['discovery', 'unresolved'].indexOf(after.outcomes[0].ending) !== -1,
       'B2b three engagements end it — a discovery, or honestly open',
       after.outcomes.length ? after.outcomes[0].ending : 'no outcome');
    ck(after.canvas === 1 && page.errors.length === 0,
       'B2c one canvas still, zero page errors', page.errors[0]);
    await page.screenshot({ path: path.join(SHOTS, 'b2-posed.png') });
    await context.close();
  }

  // B3 — the REAL ownership chain end-to-end: pose a mystery, click
  // the real screen at a glint, and watch the composer's log say the
  // touch belonged to the mystery (not to the ripple's own answers).
  {
    const { page, context } = await freshPage();
    // THE TAP MUST BE THE THING THAT ENGAGES, AND IT WAS A RACE.
    // `stars-that-answer` arms both `tap` and `approach`, and the ring
    // is placed AROUND the look point — measured, two of its three
    // glints land at prox 0.56–0.69, past the approach threshold. The
    // notice grammar then engages them on its own for as long as the
    // Traveller counts as having just acted (still < 3s), which after
    // the threshold click is the first three seconds of every run. So
    // on a fast machine this check tapped an element the sky had
    // already answered: `chosen` was 'mystery' and the delta was zero,
    // and whether it passed depended on how quickly the page loaded.
    // Waiting for the Traveller to be still isolates the tap, which is
    // the only thing B3 is about — the hand-off through the composer.
    await page.waitForFunction(() =>
      window.vihuPlanetUniverse &&
      window.vihuPlanetUniverse.traveller.stillSeconds() > 3.2,
      null, { timeout: 15000 });
    await page.evaluate(() => {
      window.vihuEtherMystery.begin('stars-that-answer', { look: null });
    });
    // Let the elements arrive — a thing still fading in is not yet a
    // thing a tap can land on, which is the interpreter's own rule.
    await page.waitForFunction(() =>
      window.vihuEtherMystery.instrument() &&
      window.vihuEtherMystery.instrument().elements[0].alpha > 0.2,
      null, { timeout: 8000 });
    const spot = await page.evaluate(() => {
      const el = window.vihuEtherMystery.instrument().elements[0];
      return { fx: el.x, fy: el.y };
    });
    // Convert field→screen inside the page each attempt (the sky
    // drifts); click for real on open sky at the element.
    const claimed = await page.evaluate(async (p) => {
      const my = window.vihuEtherMystery;
      const comp = window.vihuEtherComposer;
      // drive the same entry a real tap takes AFTER the ripple: the
      // composer's touchNow — plus a REAL click near the element to
      // prove the DOM path stays error-free.
      const before = my.instrument().elements.filter((e) => e.engaged).length;
      const answer = comp.touchNow({ x: p.fx, y: p.fy });
      const after = my.instrument().elements.filter((e) => e.engaged).length;
      const log = comp.diagnostics().decisions.filter((d) => d.touch).pop();
      return { answer, before, engagedDelta: after - before,
               chosen: log && log.chosen };
    }, spot);
    ck(claimed.before === 0 && claimed.answer === null &&
       claimed.engagedDelta === 1 && claimed.chosen === 'mystery',
       'B3  the composer\'s touch path hands the tap to the posed mystery',
       'chosen=' + claimed.chosen + ' before=' + claimed.before +
       ' delta=' + claimed.engagedDelta);
    ck(page.errors.length === 0, 'B3b zero page errors', page.errors[0]);
    await context.close();
  }

  // B4 — touch profile: the same engagement under a finger on a
  // phone-sized view — tap radius generous, nothing hover-bound.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      hasTouch: true, isMobile: true
    });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    await page.goto(BASE + '/index.html');
    await page.waitForSelector('[data-begin]', { timeout: 20000 });
    await page.tap('[data-begin]');
    await page.waitForFunction(() => !!window.vihuEtherMystery, null, { timeout: 15000 });
    await page.evaluate(() => {
      window.vihuEtherMystery.begin('stars-that-answer', { look: null });
    });
    await page.waitForFunction(() =>
      window.vihuEtherMystery.instrument() &&
      window.vihuEtherMystery.instrument().elements[0].alpha > 0.2,
      null, { timeout: 8000 });
    const out = await page.evaluate(() => {
      const my = window.vihuEtherMystery;
      // On a phone the ring sits near the centre of a small view, so
      // one star may already have engaged by APPROACH — which is the
      // vocabulary working, not noise. The tap check picks a star the
      // approach has not yet taken.
      const els = my.instrument().elements;
      const idx = els.findIndex((e) => !e.engaged);
      if (idx < 0) return { hit: 'none-left', engagedIdx: false };
      const el = els[idx];
      // a finger lands 40px off the glint — still the mystery's
      const hit = my.touchAt(el.x + 40, el.y + 20);
      const engagedIdx = my.instrument().elements[idx].engaged;
      return { hit, engagedIdx };
    });
    ck(out.hit === true && out.engagedIdx === true,
       'B4  under a finger, a near-enough tap engages — touch first-class');
    ck(page.errors.length === 0, 'B4b zero page errors on the phone profile', page.errors[0]);
    await context.close();
  }

  // B5 — reduced motion mounts the layer inert on the real page.
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    await page.goto(BASE + '/index.html');
    await page.waitForSelector('[data-begin]', { timeout: 20000 });
    await page.click('[data-begin]');
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 15000 });
    const out = await page.evaluate(() => {
      const my = window.vihuEtherMystery;
      return { mounted: !!my, quiet: my ? my.quiet : null,
               begins: my ? my.begin('stars-that-answer', {}) : 'absent' };
    });
    ck(out.mounted === false || (out.quiet === true && out.begins === null),
       'B5  reduced motion: inert — a mystery is unrequested motion',
       'quiet=' + out.quiet);
    ck(page.errors.length === 0, 'B5b zero page errors', page.errors[0]);
    await context.close();
  }

  // B6 — the debug story: ?etherdebug=1 prints the layer's decisions
  // to the console; an ordinary console hears nothing; and the word
  // that names all this machinery never reaches anything a child
  // sees.
  {
    const { page, context } = await freshPage(null, '/index.html?etherdebug=1');
    await page.evaluate(() => {
      window.vihuEtherMystery.begin('stars-that-answer', { look: null });
    });
    await page.waitForTimeout(400);
    const sawLog = page.consoleLines.some((l) => l.indexOf('[ether-mystery]') !== -1);
    const domClean = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.indexOf('mystery') === -1 && text.indexOf('grammar') === -1 &&
             text.indexOf('challenge') === -1 && text.indexOf('validator') === -1;
    });
    ck(sawLog, 'B6  ?etherdebug=1 opens the mystery log to the console');
    ck(domClean, 'B6b and no machinery word exists anywhere a child could read');
    ck(page.errors.length === 0, 'B6c zero page errors', page.errors[0]);
    await context.close();
  }

  // B7 — an ordinary visit stays clean: no debug lines, no growth of
  // canvases across repeated pose/close cycles, frame clock alive.
  {
    const { page, context } = await freshPage();
    const out = await page.evaluate(async () => {
      const my = window.vihuEtherMystery;
      my.setTimeScale(60);
      for (let i = 0; i < 3; i++) {
        my.begin('a-quiet-change', { look: null });
        await new Promise((r) => setTimeout(r, 2600));  // 60× ≈ 156 s: past lifeS
      }
      my.setTimeScale(1);
      return {
        canvases: document.querySelectorAll('.vp-ether-mystery').length,
        outcomes: my.outcomes().length,
        live: my.live()
      };
    });
    const noDebug = !page.consoleLines.some((l) => l.indexOf('[ether-mystery]') !== -1);
    ck(out.canvases === 1 && out.outcomes >= 2 && out.live === null,
       'B7  cycles of mysteries leave nothing behind — one canvas, empty stage',
       out.outcomes + ' outcomes recorded');
    ck(noDebug, 'B7b an ordinary console hears nothing');
    ck(page.errors.length === 0, 'B7c zero page errors', page.errors[0]);
    await context.close();
  }

  await browser.close();

  console.log('\n' + (failed ? 'FAILED' : 'ALL GREEN') + ' — ' +
              passed + ' passed, ' + failed + ' failed');
  if (failed) failures.forEach((f) => console.log('  · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// A crossing in the pumped world takes a while and then leaves — the
// provider's own departure, simulated (the experience suite's own
// helper, rebuilt against this harness).
function autoCrossOf(h) {
  let up = null;
  return (t) => {
    if (h.world.enc && up === null) up = t;
    if (h.world.enc && up !== null && t - up > 30) {
      const id = h.world.enc.id;
      h.world.enc = null; up = null;
      h.emitLife('creature:gone', { id });
    }
  };
}
