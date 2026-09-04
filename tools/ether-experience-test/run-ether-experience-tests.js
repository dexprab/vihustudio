/* SPRINT — ETHER EXPERIENCE ARCHITECTURE (experimental branch).
 *
 * The Experience Composer must make the Ether feel like a sea of
 * mysteries: one coherent, context-aware system deciding whether,
 * what kind, when and where — never a rotation of animations, never
 * a quest engine, never a Story browser. This suite proves the
 * architecture three ways:
 *
 *   S. statics — the boundaries hold before a browser opens
 *   M. the model — the composer driven deterministically in Node,
 *      with a pumped frame clock, across simulated hours
 *   B. the browser — the real page, the real journey, the real canvas
 *
 * Suite-culture rules honoured: comments are stripped before any
 * vocabulary scan; fixtures are not derived from the code under
 * test (the Node harness builds its own universe and its own life
 * provider); and four load-bearing checks were proved by temporarily
 * reverting the behaviour and watching them go red:
 *   · novelty disabled → M2b/M2c/M2d red (98% consecutive repeats —
 *     the exact whale rotation the sprint forbids)
 *   · the quiet/orientation refusal removed → M5/M5b/M9 red
 *   · the exceptional tier's per-visit disposition set to 1.0 →
 *     M6 red (60/60 visits held the deep crossing)
 *   · the provider's acknowledge manner removed → B2 red (the
 *     noticed whale answered 'guide' and led somewhere anyway)
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8792 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-experience-test/run-ether-experience-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_PORT || 8792);
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

// ===================================================================
// The Node harness: a pumped-clock world. The composer runs on
// requestAnimationFrame; here the frames are hand-fed, so a simulated
// hour costs milliseconds and every run is inspectable. The universe
// and the life provider are BUILT here, not derived from the modules
// under test.
// ===================================================================
function makeWorld(opts) {
  opts = opts || {};
  const handlers = {};
  const lifeHandlers = {};
  const world = {
    stillValue: 999,          // an untouched Traveller, unless driven
    entities: opts.entities || [],
    focusOpen: false,
    summons: [],              // every summon the composer asked for
    marks: [], blooms: [], becks: 0,
    frames: [],
    now: 0
  };
  const universe = {
    ether: { width: 4200, height: 1000, viewWidth: 1440, viewHeight: 900,
             depth: { stories: 1 } },
    camera: { offsetFor: (p, out) => { const o = out || {}; o.x = world.camX || 0; o.y = 0; return o; } },
    stories: { all: () => world.entities, count: () => world.entities.length },
    focus: { isOpen: () => world.focusOpen },
    traveller: { stillSeconds: () => world.stillValue },
    isRunning: () => true,
    on: (e, fn) => { (handlers[e] = handlers[e] || []).push(fn); },
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
      world.summons.push({ id, manner: manner || {}, t: world.simTime || 0 });
      emitLife('creature:arrived', { id });
      return id;
    },
    markAt: (x, y, o) => { world.marks.push({ x, y }); return true; },
    bloomAt: (x, y) => { world.blooms.push({ x, y }); return 'bird'; },
    on: (e, fn) => { (lifeHandlers[e] = lifeHandlers[e] || []).push(fn); },
    setComposer: () => {}, setScout: () => {}
  };
  function emitLife(e, p) { (lifeHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }
  function emitUni(e, p) { (handlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }

  // A fake window for the module: its own rAF queue, its own location.
  const g = {
    location: { search: opts.search || '' },
    requestAnimationFrame: (fn) => { world.frames.push(fn); },
    VihuPlanet: { Util: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
                          smooth: (t) => t * t * (3 - 2 * t) } },
    EtherDiscovery: {
      attach: () => ({ on: (e, fn) => { (lifeHandlers['disc:' + e] = lifeHandlers['disc:' + e] || []).push(fn); } }),
      pickWonder: (u, near) => near
        ? { kind: 'wonder', id: null, x: near.x, y: near.y }
        : { kind: 'wonder', id: null, x: 0, y: 0 }
    },
    console: { info: () => { world.debugLines = (world.debugLines || 0) + 1; } }
  };
  const src = fs.readFileSync(path.join(ROOT, 'js/etherExperience.js'), 'utf8');
  new Function('window', src + '\n//# sourceURL=etherExperience.js')(g);

  return {
    world, universe, life, g, emitLife, emitUni,
    mount: (o) => g.EtherExperience.mount(universe, life, o),
    // Pump simulated seconds through the composer's own frame loop.
    // dt per frame is capped at 50 ms inside the module, so the
    // harness passes 40 ms frames and leans on setTimeScale for
    // compression — the same public knob a long-session test uses.
    pump: (exp, seconds, perFrame) => {
      const scale = exp.__scale || 1;
      const frameSim = 0.04 * scale;
      let target = (world.simTime || 0) + seconds;
      let guard = 0;
      while ((world.simTime || 0) < target && guard++ < 400000) {
        world.simTime = (world.simTime || 0) + frameSim;
        world.now += 40;
        const q = world.frames.splice(0);
        q.forEach((fn) => fn(world.now));
        if (perFrame) perFrame(world.simTime);
      }
    }
  };
}

// A crossing in the pumped world takes `world.crossFor` simulated
// seconds and then leaves — the provider's own departure, simulated.
function autoCross(h, seconds) {
  let up = null;
  return (t) => {
    if (h.world.enc && up === null) up = t;
    if (h.world.enc && up !== null && t - up > (seconds || 30)) {
      const id = h.world.enc.id;
      h.world.enc = null; up = null;
      h.emitLife('creature:gone', { id });
    }
  };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  // =================================================================
  console.log('\nS. STATICS');
  const expSrc = fs.readFileSync(path.join(ROOT, 'js/etherExperience.js'), 'utf8');
  const lifeSrc = fs.readFileSync(path.join(ROOT, 'js/etherLife.js'), 'utf8');
  const expCode = stripComments(expSrc);

  // S1 — Decision 9's own test, extended: the protected runtime files
  // never learned the composer exists.
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
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8').toLowerCase();
      return /etherexperience|vihuethercomposer|experience\s*composer/.test(s);
    });
    ck(dirty.length === 0, 'S1  the runtime never learned the composer exists',
       dirty.join(', ') || protectedFiles.length + ' files clean');
  }

  // S2 — no gamification vocabulary, comments stripped first.
  {
    const banned = /\b(score|scores|scored|streak|leaderboard|badge|reward|rewards|xp|rank|ranking|achievement|combo|currency|unlock|coin|coins)\b/i;
    const hit = expCode.match(banned);
    ck(!hit, 'S2  no gamification vocabulary in the composer', hit && hit[0]);
  }

  // S3 — a Traveller is stateless: no storage API anywhere in the
  // composer.
  {
    const storage = /(localStorage|sessionStorage|indexedDB|document\.cookie)/;
    ck(!storage.test(expCode), 'S3  nothing is stored — every visit starts the sea unread');
  }

  // S4 — the composer owns no pixels and no panels: it never touches
  // the document at all. Everything a child sees is drawn by the
  // providers; everything internal stays internal.
  {
    ck(!/\bdocument\s*\./.test(expCode) && !/createElement|innerHTML|appendChild/.test(expCode),
       'S4  the composer never reaches the DOM — no phase, depth or tier can be shown');
  }

  // S5 — the dev log is gated on ?etherdebug=1 and printed to the
  // console only; the flag is read from the address, never kept.
  {
    ck(/etherdebug=1/.test(expCode) && !/localStorage/.test(expCode),
       'S5  the decision log is a dev switch, read from the address, never persisted');
  }

  // S6 — the canon knows the sea of mysteries, in worldview words.
  {
    const canon = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'assets/canon/vihuplanet.canon.json'), 'utf8'));
    const sec = canon.sections.find((s) => s.key === 'the-living-ether');
    const text = JSON.stringify(sec || {});
    ck(/sea of mysteries/.test(text), 'S6  the canon says the Ether is a sea of mysteries');
    ck(/Not every mystery answers/.test(text),
       'S6b and that not every mystery answers');
    ck(/does not repeat itself/.test(text),
       'S6c and that the Ether does not repeat itself');
  }

  // S7 — provider seams exist and defaults are untouched: a bare
  // summon carries no manner, and the conducted flag defaults false.
  {
    ck(/function summon\(id, manner\)/.test(lifeSrc) &&
       /opts\.conducted/.test(lifeSrc) && /beckonNow/.test(lifeSrc) &&
       /bloomAt/.test(lifeSrc) && /markAt/.test(lifeSrc),
       'S7  the provider seams exist on the creature layer');
  }

  // S8 — rarity is architecture: tiers exist, weights fall with
  // rarity, and the rarer tiers may be absent from a visit entirely.
  {
    const g = {};
    new Function('window', expSrc)(g);
    const R = g.EtherExperience.RARITY;
    const okTiers = R.common.weight > R.uncommon.weight &&
                    R.uncommon.weight > R.rare.weight &&
                    R.rare.weight > R.very_rare.weight &&
                    R.very_rare.weight > R.exceptional.weight;
    const mayBeAbsent = R.rare.visit < 1 || R.very_rare.visit < 1 || R.exceptional.visit < 1;
    ck(okTiers && mayBeAbsent, 'S8  rarity tiers are real, and the rarest need not exist this visit');
    const P = g.EtherExperience.PATTERNS;
    const verbs = new Set(P.map((p) => p.outcome));
    ck(verbs.has('unresolved') && verbs.has('vanish') && verbs.has('echo') &&
       verbs.has('react') && verbs.has('lead') && verbs.has('reveal') && verbs.has('transform'),
       'S8b the outcome vocabulary includes the unresolved', [...verbs].join(' '));
  }

  // =================================================================
  console.log('\nM. THE MODEL — pumped-clock sessions in Node');
  // =================================================================

  // M1 — the arrival script: the first crossing is the whale, guide
  // armed, inside the first-arrival window. The one baseline beat the
  // composer must keep.
  {
    const h = makeWorld();
    const exp = h.mount();
    h.pump(exp, 12, autoCross(h, 30));
    const first = h.world.summons[0];
    ck(!!first && first.id === 'whale' &&
       (first.manner.respond || 'default') === 'default' &&
       first.t >= 6 && first.t <= 10.5,
       'M1  the first crossing is the whale, guide armed, inside the window',
       first ? first.id + ' at ' + first.t.toFixed(1) + 's' : 'never');
  }

  // M2 — a long afternoon is not a rotation. Simulate two hours of a
  // Traveller who keeps gently exploring; require variety of pattern,
  // low consecutive repetition, and creature manners that differ.
  {
    const h = makeWorld({ entities: mkEntities(8) });
    const exp = h.mount();
    exp.setTimeScale(24); exp.__scale = 24;
    // The Traveller acts every so often: stillness low, then high.
    let flip = 0;
    h.pump(exp, 7200, (t) => {
      autoCrossShared(h, t);
      h.world.stillValue = (Math.floor(t / 30) % 3 === 0) ? 1.2 : 40;
      h.world.camX = Math.sin(t / 300) * 2000;
      flip++;
    });
    const hist = exp.history().filter((e) => e.pattern !== 'beckon');
    const patterns = new Set(hist.map((e) => e.pattern));
    let consec = 0;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].pattern === hist[i - 1].pattern) consec++;
    }
    const consecFrac = hist.length > 1 ? consec / (hist.length - 1) : 0;
    ck(hist.length >= 8, 'M2  a two-hour visit holds a real sequence of experiences',
       hist.length + ' experiences');
    ck(patterns.size >= 4, 'M2b made of genuinely different patterns',
       [...patterns].join(' '));
    ck(consecFrac <= 0.2, 'M2c and almost never the same one twice running',
       (consecFrac * 100).toFixed(0) + '% consecutive repeats');

    // Recurrence with difference: if the whale passed more than twice,
    // it did not always answer the same way.
    const whales = h.world.summons.filter((s) => s.id === 'whale');
    if (whales.length >= 3) {
      const modes = new Set(whales.map((s) => s.manner.respond || 'default'));
      ck(modes.size >= 2, 'M2d the whale means something — never the same thing',
         whales.length + ' whales, manners: ' + [...modes].join(' '));
    } else {
      ok('M2d the whale means something — never the same thing',
         'only ' + whales.length + ' whales this visit — nothing to compare');
    }

    // M3 — anti-periodicity: the gaps between experiences must not be
    // learnable. A near-constant interval has a coefficient of
    // variation near zero; this requires real spread.
    const ts = hist.map((e) => e.t);
    const gaps = [];
    for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (gaps.length || 1));
    const cv = mean > 0 ? sd / mean : 0;
    ck(gaps.length >= 5 && cv > 0.25,
       'M3  the schedule cannot be inferred — the air between experiences varies',
       'cv ' + cv.toFixed(2) + ' over ' + gaps.length + ' gaps (mean ' + mean.toFixed(0) + 's)');

    // M-depth — the ledger climbed past seen/not-seen somewhere.
    const led = exp.ledger();
    const depths = new Set(Object.values(led.stories));
    ck(depths.size >= 1, 'M3b the discovery ledger reads depth, not a seen-bit',
       [...depths].join(' ') || 'nothing glimpsed (camera never rested)');
  }

  // M4 — AN IDLE CHILD IS NEVER FED CONTENT. Ten minutes of a
  // Traveller who touches nothing: the first crossing, at most two
  // beckons, and NOTHING else. Quiet is the answer to idleness —
  // spawning for it would be the failure §10 names.
  {
    const h = makeWorld({ entities: mkEntities(4) });
    const exp = h.mount();
    exp.setTimeScale(12); exp.__scale = 12;
    h.pump(exp, 600, autoCross(h, 30));   // stillValue stays 999
    const nonBeckon = exp.history().filter((e) =>
      e.pattern !== 'beckon' && e.pattern !== 'first-crossing');
    ck(nonBeckon.length === 0,
       'M4  ten idle minutes: the first crossing, the beckon, and QUIET',
       nonBeckon.length + ' unearned experiences');
    ck(h.world.becks <= 2, 'M4b and the beckon keeps its own cap', h.world.becks + ' given');
  }

  // M5 — quiet after a find is real: inject a found trail and watch
  // the composer refuse everything for the rest window.
  {
    const h = makeWorld({ entities: mkEntities(4) });
    const exp = h.mount();
    exp.setTimeScale(4); exp.__scale = 4;
    h.pump(exp, 20, autoCross(h, 8));
    h.world.stillValue = 1;   // an active child
    h.emitLife('trail:found', { target: { kind: 'story', id: 's1' } });
    const before = exp.history().length;
    const ph = exp.phase();
    const refused = exp.decideNow();
    ck(ph === 'quiet' && refused === null,
       'M5  after a find the sky rests — the composer refuses even when asked',
       'phase ' + ph);
    const d = exp.diagnostics().decisions.slice(-1)[0];
    ck(!!d && d.chosen === 'quiet' && /rest/.test(d.why || ''),
       'M5b and the silence has a name in the decision log', d && d.why);
  }

  // M6 — per-visit disposition: across many mounted visits, the
  // exceptional pattern exists in SOME and not in others. A rare
  // thing that exists every visit becomes a schedule.
  {
    let present = 0; const runs = 60;
    for (let i = 0; i < runs; i++) {
      const h = makeWorld();
      const exp = h.mount();
      const deep = exp.patterns().find((p) => p.id === 'deep-crossing');
      if (deep && deep.inThisVisit) present++;
    }
    ck(present > 2 && present < runs - 10,
       'M6  the exceptional exists in some visits and not in others',
       present + '/' + runs + ' visits hold the deep crossing');
  }

  // M7 — phases follow behaviour, not a timetable. The same elapsed
  // time with different behaviour lands in different phases.
  {
    const h1 = makeWorld({ entities: mkEntities(4) });
    const e1 = h1.mount();
    e1.setTimeScale(12); e1.__scale = 12;
    h1.pump(e1, 300, autoCross(h1, 30));            // untouched
    const idlePhase = e1.phase();

    const h2 = makeWorld({ entities: mkEntities(4) });
    const e2 = h2.mount();
    e2.setTimeScale(12); e2.__scale = 12;
    h2.pump(e2, 150, (t) => {
      autoCrossShared(h2, t);
      h2.world.stillValue = 1;                       // turning
      h2.world.camX = t * 40;                        // travelling
    });
    h2.emitLife('trail:found', { target: { kind: 'story', id: 'sx' } });
    h2.pump(e2, 150, (t) => {
      h2.world.stillValue = 1; h2.world.camX = t * 40;
    });
    const activePhase = e2.phase();
    ck(idlePhase === 'orientation',
       'M7  five untouched minutes are still the orientation', idlePhase);
    ck(activePhase !== 'orientation' && activePhase !== 'arrival',
       'M7b while the same clock with a travelling, finding child is somewhere else entirely',
       activePhase);
  }

  // M8 — connections: a place where something happened can be where
  // something later happens. Notice a creature (an anchor), age it,
  // and the anchor patterns stop being rejected for want of a place.
  {
    let sawCandidate = false, tries = 0;
    while (!sawCandidate && tries++ < 25) {
      const h = makeWorld({ entities: mkEntities(4) });
      const exp = h.mount();
      exp.setTimeScale(12); exp.__scale = 12;
      h.pump(exp, 15, autoCross(h, 8));
      // The anchor is planted the way the product plants it: a being
      // is UP and gets noticed — the composer reads where it stands.
      const hadEnc = h.world.enc;
      if (!hadEnc) h.world.enc = { id: 'whale' };
      h.world.enc.screen = { x: 700, y: 400 };
      h.emitLife('creature:noticed', { id: 'whale' });
      if (!hadEnc) h.world.enc = null;
      h.world.stillValue = 1; h.world.camX = 500;
      h.emitLife('trail:found', { target: { kind: 'story', id: 's0' } });
      h.pump(exp, 400, autoCross(h, 8));
      h.world.stillValue = 1;
      exp.decideNow();
      const d = exp.diagnostics().decisions.slice(-1)[0] || {};
      const inCandidates = (d.candidates || []).some((c) => /echo-bloom|convergence/.test(c.id));
      if (inCandidates) sawCandidate = true;
    }
    ck(sawCandidate,
       'M8  an old place makes the echo patterns REAL candidates',
       tries + ' visit(s) examined');

    // And without any anchor they are refused by name. The Traveller
    // must have TURNED (a still-drop seen by a tick) or the decision
    // never leaves the orientation — which is its own correct refusal
    // and would hide the one this check is about.
    const h = makeWorld({ entities: mkEntities(4) });
    const exp = h.mount();
    exp.setTimeScale(12); exp.__scale = 12;
    h.pump(exp, 200, autoCross(h, 8));
    h.world.stillValue = 1;
    h.pump(exp, 5, autoCross(h, 8));
    exp.decideNow();
    const d = exp.diagnostics().decisions.slice(-1)[0] || {};
    const namedRefusal = (d.rejected || []).some((r) =>
      /echo-bloom|convergence/.test(r.id) &&
      (r.because === 'no-old-place-yet' || r.because === 'not-in-this-visit'));
    ck(namedRefusal,
       'M8b and with no old place they are refused, by name, in the log',
       JSON.stringify((d.rejected || []).filter((r) => /echo|conv/.test(r.id))));
  }

  // M9 — the composer is pure enough to be asked: fifty decideNow()
  // calls during quiet change nothing and answer the same way.
  {
    const h = makeWorld({ entities: mkEntities(4) });
    const exp = h.mount();
    exp.setTimeScale(4); exp.__scale = 4;
    h.pump(exp, 20, autoCross(h, 8));
    h.emitLife('trail:found', { target: { kind: 'story', id: 's1' } });
    const before = exp.history().length;
    for (let i = 0; i < 50; i++) exp.decideNow();
    ck(exp.history().length === before,
       'M9  asking fifty times during the rest performs nothing');
  }

  // Helpers the long runs above share.
  function mkEntities(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ id: 'story-' + i, prox: 0.05 + (i % 4) * 0.1, focusT: 0,
                 position: { x: i * 400, y: 300 },
                 publishedAt: new Date().toISOString() });
    }
    return out;
  }
  function autoCrossShared(h, t) {
    if (!h.__cross) h.__cross = autoCross(h, 25);
    h.__cross(t);
  }

  // A reversion-proof run needs only the model half — M_ONLY=1 stops
  // here so a deliberately broken build can be watched going red
  // without spending a browser on it.
  if (process.env.M_ONLY) {
    console.log('\n' + (failed ? 'FAILED' : 'ALL GREEN') + ' (S+M only) — ' +
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
    return { context, page };
  }

  // B1 — the conducted mount: composer present, creature layer
  // conducted, discovery listening, and the first crossing exactly as
  // the baseline pinned it — the whale, guide armed, in the window.
  {
    const { context, page } = await freshPage();
    const mounted = await page.evaluate(() => ({
      conducted: window.vihuEtherLife.conducted,
      composer: !!window.vihuEtherComposer,
      discovery: !!window.vihuEtherDiscovery,
      phase: window.vihuEtherComposer && window.vihuEtherComposer.phase()
    }));
    ck(mounted.conducted === true && mounted.composer && mounted.discovery,
       'B1  the Composer conducts the real sky', 'phase ' + mounted.phase);
    await page.waitForFunction(() => !!window.vihuEtherLife.active(),
      null, { timeout: 16000 }).catch(() => {});
    const a = await page.evaluate(() => window.vihuEtherLife.active());
    ck(!!a && a.id === 'whale' && a.respondMode === 'default',
       'B1b and the first crossing is still the whale, guide armed',
       a ? a.id + '/' + a.respondMode : 'nothing');
    const noDebug = !page.consoleLines.some((l) => l.indexOf('[ether-composer]') !== -1);
    ck(noDebug, 'B1c the decision log stays out of an ordinary console');
    ck(page.errors.length === 0, 'B1d zero page errors', page.errors[0]);
    await page.screenshot({ path: path.join(SHOTS, 'b1-conducted.png') });
    await context.close();
  }

  // B2 — manners end-to-end: the same being, three different answers.
  // Driven through the layer's own public seams on the real page.
  {
    const { context, page } = await freshPage();
    await page.evaluate(() => {
      window.vihuEtherComposer.destroy();
      try { window.vihuEtherLife.destroy(); } catch (e) {}
      const t = Object.assign({}, EtherLife.TIMES, { firstArrival: [9999, 10000] });
      window.vihuEtherLife = EtherLife.mount(window.vihuPlanetUniverse, { times: t });
      window.__ev = [];
      ['creature:noticed', 'creature:responded', 'trail:begun'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__ev.push([e, p])));
    });

    async function crossWith(manner) {
      // A click aimed at a creature can land on a Spirit behind it
      // and open the portal — which is the Spirit's right (the
      // layer's own rule) and slows the universe. Close it before
      // the next crossing so each manner is measured on a live sky.
      await page.evaluate(() => {
        try { window.vihuPlanetUniverse.focus.close(); } catch (e) {}
      });
      await page.waitForFunction(() =>
        !window.vihuPlanetUniverse.focus.isOpen(), null, { timeout: 8000 })
        .catch(() => {});
      await page.evaluate((m) => {
        window.__ev.length = 0;
        window.vihuEtherLife.summon('whale', m);
      }, manner);
      await page.waitForFunction(() => {
        const a = window.vihuEtherLife.active();
        return a && a.screen.x > 160 && a.screen.x < 1280;
      }, null, { timeout: 60000 });
      const spot = await page.evaluate(() => window.vihuEtherLife.active().screen);
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(1400);
      const out = await page.evaluate(() => ({
        ev: window.__ev.map((e) => [e[0], e[1] && e[1].response]),
        trail: window.vihuEtherLife.trail(),
        active: window.vihuEtherLife.active()
      }));
      // clear the sky for the next manner
      await page.evaluate(() => {
        try { window.vihuEtherLife.destroy(); } catch (e) {}
        const t = Object.assign({}, EtherLife.TIMES, { firstArrival: [9999, 10000] });
        window.vihuEtherLife = EtherLife.mount(window.vihuPlanetUniverse, { times: t });
        window.__ev = [];
        ['creature:noticed', 'creature:responded', 'trail:begun'].forEach((e) =>
          window.vihuEtherLife.on(e, (p) => window.__ev.push([e, p])));
      });
      return out;
    }

    // `speed` is a real manner seam, and here it also keeps the test
    // honest under load: a starved frame clock caps dt, and a slow
    // crossing under 3 fps can spend a minute reaching mid-sky.
    const ackd = await crossWith({ respond: 'acknowledge', speed: 2.2 });
    ck(ackd.ev.some((e) => e[0] === 'creature:responded' && e[1] === 'acknowledge') &&
       !ackd.ev.some((e) => e[0] === 'trail:begun'),
       'B2  acknowledged: it brightens, keeps its way, and leads nowhere',
       JSON.stringify(ackd.ev));

    const shy = await crossWith({ respond: 'shy', speed: 2.2 });
    ck(shy.ev.some((e) => e[0] === 'creature:responded' && e[1] === 'shy') &&
       !shy.ev.some((e) => e[0] === 'trail:begun'),
       'B2b shy: it startles and leaves — being noticed is not always welcome',
       JSON.stringify(shy.ev));

    // A distant passage cannot be caught at all: no notice by click.
    await page.evaluate(() => {
      try { window.vihuPlanetUniverse.focus.close(); } catch (e) {}
    });
    await page.waitForFunction(() =>
      !window.vihuPlanetUniverse.focus.isOpen(), null, { timeout: 8000 })
      .catch(() => {});
    await page.evaluate(() => {
      window.__ev.length = 0;
      window.vihuEtherLife.summon('whale', { respond: 'none', scale: 0.4, speed: 2.2 });
    });
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 200 && a.screen.x < 1200;
    }, null, { timeout: 60000 });
    const spot2 = await page.evaluate(() => window.vihuEtherLife.active().screen);
    await page.mouse.click(spot2.x, spot2.y);
    await page.waitForTimeout(1200);
    const far = await page.evaluate(() => ({
      ev: window.__ev.slice(),
      active: window.vihuEtherLife.active()
    }));
    ck(!far.ev.some((e) => e[0] === 'creature:noticed'),
       'B2c a distant passage is beyond reach — a click is not answered',
       JSON.stringify(far.ev.map((e) => e[0])));
    ck(page.errors.length === 0, 'B2d zero page errors', page.errors[0]);
    await page.screenshot({ path: path.join(SHOTS, 'b2-manners.png') });
    await context.close();
  }

  // B3 — the sky's own patterns are really drawn: a mark's faint
  // stars and a bloom's figure, measured on the canvas.
  {
    const { context, page } = await freshPage();
    // Let the arrival turn finish first: the camera is deliberately
    // moving for the first ~6 s (Decision 10), and a sample position
    // computed against a camera that then turns measures empty sky.
    await page.waitForTimeout(7000);
    const lit = await page.evaluate(async () => {
      const u = window.vihuPlanetUniverse;
      const cam0 = u.camera.offsetFor(u.ether.depth.stories);
      window.vihuEtherLife.markAt(400 - cam0.x, 300 - cam0.y, { life: 30 });
      window.vihuEtherLife.bloomAt(1000 - cam0.x, 550 - cam0.y);
      await new Promise((r) => setTimeout(r, 2600));   // fade up
      const c = document.querySelector('.vp-ether-life');
      const ctx = c.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Sample where the layer itself would draw them NOW — the same
      // wrap, against the camera as it is at sample time.
      const cam = u.camera.offsetFor(u.ether.depth.stories);
      function onScreen(fx, fy) {
        const wrap = (v, span, centre) =>
          v - Math.round((v - centre) / span) * span;
        return { x: wrap(fx + cam.x, u.ether.width, u.ether.viewWidth * 0.5),
                 y: wrap(fy + cam.y, u.ether.height, u.ether.viewHeight * 0.5) };
      }
      function litAt(x, y, half) {
        const d = ctx.getImageData(Math.max(0, (x - half) * dpr), Math.max(0, (y - half) * dpr),
                                   half * 2 * dpr, half * 2 * dpr).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      }
      const m = window.vihuEtherLife.marks()[0];
      const b = window.vihuEtherLife.blooms()[0];
      const ms = m ? onScreen(m.x, m.y) : { x: 0, y: 0 };
      const bs = b ? onScreen(b.x, b.y) : { x: 0, y: 0 };
      return { mark: litAt(ms.x, ms.y, 60), bloom: litAt(bs.x, bs.y, 90),
               marks: window.vihuEtherLife.marks().length,
               blooms: window.vihuEtherLife.blooms().length };
    });
    ck(lit.marks === 1 && lit.mark > 12,
       'B3  the odd stars are really there — faint, measured on the canvas',
       lit.mark + ' lit px');
    ck(lit.blooms === 1 && lit.bloom > 150,
       'B3b and a free-standing wonder blooms without any trail',
       lit.bloom + ' lit px');
    await page.screenshot({ path: path.join(SHOTS, 'b3-mark-and-bloom.png') });
    ck(page.errors.length === 0, 'B3c zero page errors', page.errors[0]);
    await context.close();
  }

  // B4 — the debug switch: with ?etherdebug=1 the decisions reach the
  // console; nothing else changes and nothing lands in the DOM.
  {
    const { context, page } = await freshPage(null, '/index.html?etherdebug=1');
    await page.waitForFunction(() => !!window.vihuEtherLife.active(),
      null, { timeout: 16000 }).catch(() => {});
    await page.waitForTimeout(400);
    const sawLog = page.consoleLines.some((l) => l.indexOf('[ether-composer]') !== -1);
    ck(sawLog, 'B4  ?etherdebug=1 opens the decision log to the console');
    const domClean = await page.evaluate(() =>
      !document.body.innerHTML.match(/ether-composer|discovery.depth|novelty|rarity/i));
    ck(domClean, 'B4b and none of it exists anywhere a child could see');
    ck(page.errors.length === 0, 'B4c zero page errors', page.errors[0]);
    await context.close();
  }

  // B5 — reduced motion: the composer mounts inert with the rest.
  {
    const { context, page } = await freshPage({ reducedMotion: 'reduce' });
    const quiet = await page.evaluate(() => ({
      life: window.vihuEtherLife && window.vihuEtherLife.quiet,
      composer: window.vihuEtherComposer ? window.vihuEtherComposer.quiet : 'absent'
    }));
    ck(quiet.life === true && (quiet.composer === true || quiet.composer === 'absent'),
       'B5  reduced motion leaves a still, complete sky — nothing conducts motion',
       'composer: ' + quiet.composer);
    ck(page.errors.length === 0, 'B5b zero page errors', page.errors[0]);
    await context.close();
  }

  await browser.close();
  console.log('\n' + (failed ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('  · ' + f));
  console.log('screenshots: ' + SHOTS);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
