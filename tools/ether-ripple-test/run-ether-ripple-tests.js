/* SPRINT — ETHER: EXPLORATION NUDGE & ETHER RIPPLE.
 *
 * Two connected additions, one suite:
 *
 *   the NUDGE — "There's more out there." with a quieter input hint —
 *   the one line of instruction VihuPlanet carries (a deliberate,
 *   recorded amendment of Decision 10's wordlessness), appearing for
 *   a fresh still Traveller and gone the moment exploration begins;
 *
 *   the RIPPLE — a deliberate tap on the empty Ether is acknowledged
 *   by an organic wavefront of light from the exact touched place,
 *   and the Experience Composer alone decides whether anything MORE
 *   answers — mostly, deliberately, nothing does.
 *
 * Sections:
 *   S. statics — boundaries hold before a browser opens
 *   M. the model — the composer's touch policy in Node, pumped clock
 *   B. the browser — the real page, the real journey, real taps
 *
 * Suite-culture rules honoured: comments are stripped before any
 * vocabulary scan; the Node harness builds its own universe and its
 * own providers rather than deriving fixtures from the code under
 * test; taps probe for open sky the way a finger does; and four
 * load-bearing checks were proved by temporarily reverting the
 * behaviour and watching them go red:
 *   · the creature hit-region skip removed from the ripple's
 *     listener → B5 red (a tap on the whale also rippled)
 *   · the min-gap dampener removed → B3 red (eight rapid taps became
 *     eight ripples — the tapping game the brief forbids)
 *   · the nudge's stillness-reset dismissal removed → B8 red (the
 *     invitation outlived the exploration it invited)
 *   · the arrival/orientation refusal removed from onTouch → M1 red
 *     (a fresh Traveller's first tap could be answered with content)
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8903 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-ripple-test/run-ether-ripple-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_RIPPLE_PORT || 8903);
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

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  // =================================================================
  console.log('\nS. STATICS');
  // =================================================================
  const rippleSrc = fs.readFileSync(path.join(ROOT, 'js/etherRipple.js'), 'utf8');
  const rippleCode = stripComments(rippleSrc);
  const homeSrc = fs.readFileSync(path.join(ROOT, 'js/vihuplanetHome.js'), 'utf8');
  const expSrc = fs.readFileSync(path.join(ROOT, 'js/etherExperience.js'), 'utf8');
  const expCode = stripComments(expSrc);

  // S1 — Decision 9's own test: the protected runtime files never
  // learned the ripple or the nudge exist.
  {
    const protectedFiles = [
      'vihuplanet/runtime/physics/physics.js',
      'vihuplanet/runtime/stories/storyManager.js',
      'vihuplanet/runtime/ether/etherRenderer.js',
      'vihuplanet/runtime/core/universe.js',
      'vihuplanet/runtime/ambient/ambientSystem.js'
    ];
    let clean = true, dirty = '';
    for (const f of protectedFiles) {
      const s = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      if (/ripple|nudge|EtherRipple|EtherExperience|EtherLife/i.test(s)) {
        clean = false; dirty = f; break;
      }
    }
    ck(clean, 'S1  the protected runtime files gained no reference', dirty);
  }

  // S2 — a Traveller is stateless (Decision 19): no storage API in
  // the ripple layer, and none in the nudge's own block.
  {
    const noStore = !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(rippleCode);
    ck(noStore, 'S2  no storage API in the ripple layer');
    const nudgeBlock = stripComments(homeSrc.slice(
      homeSrc.indexOf('the exploration nudge'), homeSrc.indexOf('function enterTheEther')));
    ck(nudgeBlock.length > 200 &&
       !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(nudgeBlock),
       'S2b and none in the nudge block');
  }

  // S3 — no gamification vocabulary anywhere in the new layer
  // (comments stripped first — the word-inside-its-own-prose family).
  {
    const gam = /\b(score|scores|streak|badge|reward|rewards|xp|leaderboard|rank|combo|points)\b/i;
    ck(!gam.test(rippleCode), 'S3  no gamification vocabulary in the ripple layer');
  }

  // S4 — no independent ripple scheduler: nothing in the layer runs
  // on a clock of its own; the only rAF is the draw loop, and only a
  // real tap (or the Composer's echo) makes a ripple.
  {
    ck(!/setInterval|setTimeout/.test(rippleCode),
       'S4  no timer of any kind in the ripple layer');
  }

  // S5 — the copy is the brief's, verbatim: the invitation, and both
  // input hints (desktop and touch).
  {
    ck(homeSrc.indexOf('There’s more out there.') !== -1,
       'S5  the invitation is the product owner\'s sentence');
    ck(homeSrc.indexOf('(Use the arrow keys to explore)') !== -1 &&
       homeSrc.indexOf('(Swipe to explore)') !== -1,
       'S5b both input hints exist, quieter than the sentence');
  }

  // S6 — every touch response names a real rarity tier, so the touch
  // table cannot drift away from the composer's own vocabulary.
  {
    const block = expSrc.slice(expSrc.indexOf('var TOUCH_RESPONSES'),
                               expSrc.indexOf('var visitTouch'));
    const tiers = [...block.matchAll(/rarity:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const known = ['common', 'uncommon', 'rare', 'very_rare', 'exceptional'];
    ck(tiers.length === 3 && tiers.every((t) => known.includes(t)),
       'S6  the touch responses ride the composer\'s own rarity tiers',
       tiers.join(','));
  }

  // S7 — the composer's touch policy is reactive, never scheduled:
  // etherExperience gained no timer either (it never had one).
  ck(!/setInterval|setTimeout/.test(expCode),
     'S7  the composer still runs on its one frame clock');

  // =================================================================
  console.log('\nM. THE MODEL — the composer\'s touch policy, pumped');
  // =================================================================
  // The harness builds its own universe and providers — fixtures are
  // never derived from the code under test.
  function makeWorld(opts) {
    opts = opts || {};
    const handlers = {};
    const lifeHandlers = {};
    const world = {
      stillValue: 999, entities: opts.entities || [], focusOpen: false,
      summons: [], marks: [], blooms: [], becks: 0, echoes: [],
      frames: [], now: 0
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
      quiet: false, conducted: true,
      times: { firstArrival: [6.5, 10], between: [95, 220], trailLife: 50,
               noticeHold: 0.45, respondDelay: 0.5, beckonAfter: 16,
               beckonSpacing: 22, beckonLife: 7, beckons: 2 },
      active: () => world.enc || null,
      trail: () => world.trailLive || null,
      beckon: () => ({ active: false, given: world.becks, stopped: true }),
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
    // The suite's own ripple provider: only the seams the composer
    // is allowed to use.
    const rippleHandlers = {};
    const ripple = {
      quiet: false,
      on: (e, fn) => { (rippleHandlers[e] = rippleHandlers[e] || []).push(fn); },
      off: () => {},
      echoAt: (x, y) => { world.echoes.push({ x, y }); return true; }
    };
    function emitLife(e, p) { (lifeHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }
    function emitRipple(e, p) { (rippleHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }

    const g = {
      location: { search: '' },
      requestAnimationFrame: (fn) => { world.frames.push(fn); },
      VihuPlanet: { Util: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
                            smooth: (t) => t * t * (3 - 2 * t) } },
      EtherDiscovery: {
        attach: () => ({ on: () => {} }),
        pickWonder: (u, near) => near
          ? { kind: 'wonder', id: null, x: near.x, y: near.y }
          : { kind: 'wonder', id: null, x: 0, y: 0 }
      },
      console: { info: () => {} }
    };
    const src = fs.readFileSync(path.join(ROOT, 'js/etherExperience.js'), 'utf8');
    new Function('window', src + '\n//# sourceURL=etherExperience.js')(g);

    return {
      world, universe, life, ripple, g, emitLife, emitRipple,
      mount: (o) => g.EtherExperience.mount(universe, life,
        Object.assign({ ripple }, o)),
      pump: (exp, seconds) => {
        const frameSim = 0.04 * (exp.__scale || 1);
        const target = (world.simTime || 0) + seconds;
        let guard = 0;
        while ((world.simTime || 0) < target && guard++ < 400000) {
          world.simTime = (world.simTime || 0) + frameSim;
          world.now += 40;
          world.frames.splice(0).forEach((fn) => fn(world.now));
        }
      }
    };
  }
  // Walk a mounted composer out of arrival/orientation: let the first
  // crossing happen and leave, and let the Traveller "turn".
  function walkIn(h, exp) {
    h.pump(exp, 12);
    if (h.world.enc) { const id = h.world.enc.id; h.world.enc = null; h.emitLife('creature:gone', { id }); }
    h.world.stillValue = 1;   // turning
    h.pump(exp, 2);
    h.world.stillValue = 30;
    h.pump(exp, 2);
  }

  // M1 — a fresh Traveller's first taps meet the ripple alone: in
  // arrival and orientation the composer refuses by name.
  {
    const h = makeWorld();
    const exp = h.mount();
    h.pump(exp, 1);
    const out = exp.touchNow({ x: 100, y: 100 });
    const d = exp.diagnostics().decisions.filter((x) => x.touch);
    ck(out === null && d.length === 1 && d[0].chosen === 'ripple-only' &&
       /arrival|orientation/.test(d[0].why),
       'M1  the arrival meets the ripple alone', d[0] && d[0].why);
  }

  // M2 — the early-visit hold: even past orientation, the sky never
  // answers the first taps (touchReadyAt is drawn at 20–60s).
  {
    const h = makeWorld();
    const exp = h.mount();
    h.pump(exp, 12);
    if (h.world.enc) { const id = h.world.enc.id; h.world.enc = null; h.emitLife('creature:gone', { id }); }
    h.world.stillValue = 1; h.pump(exp, 1); h.world.stillValue = 30;
    const out = exp.touchNow({ x: 100, y: 100 });
    const d = exp.diagnostics().decisions.filter((x) => x.touch).pop();
    ck(out === null && d.chosen === 'ripple-only',
       'M2  the first post-orientation tap is still ripple-only', d.why);
  }

  // M3 — the sky CAN answer, and the answer is performed through the
  // providers' own seams. Driven across many attempts because the
  // policy is deliberately mostly-quiet.
  {
    const h = makeWorld();
    const exp = h.mount();
    exp.__scale = 1;
    walkIn(h, exp);
    exp.setTimeScale(20);
    let composed = null;
    for (let i = 0; i < 40 && !composed; i++) {
      h.pump(exp, 8);             // 160 conducted seconds per loop
      if (h.world.enc) { const id = h.world.enc.id; h.world.enc = null; h.emitLife('creature:gone', { id }); }
      composed = exp.touchNow({ x: 500, y: 300 });
    }
    ck(!!composed, 'M3  the composer can choose a further answer', composed);
    const before = h.world.echoes.length + h.world.marks.length + h.world.blooms.length;
    h.pump(exp, 6);
    const after = h.world.echoes.length + h.world.marks.length + h.world.blooms.length;
    ck(after === before + 1,
       'M3b and exactly one answer arrives, through a provider seam',
       'echoes ' + h.world.echoes.length + ' marks ' + h.world.marks.length +
       ' blooms ' + h.world.blooms.length);
    const dg = exp.diagnostics();
    ck(dg.touch && Array.isArray(dg.touch.responses) &&
       dg.touch.responses.some((r) => r.performed > 0),
       'M3c the diagnostics say which, for a console and nobody else');
  }

  // M4 — tapping cannot be farmed: across ten minutes of steady taps
  // the composed answers stay rare and capped, and the majority of
  // taps are ripple-only. (Each response performs at most twice per
  // visit, so the ceiling is six.)
  {
    const h = makeWorld();
    const exp = h.mount();
    walkIn(h, exp);
    exp.setTimeScale(10);
    let composedCount = 0, total = 0;
    for (let i = 0; i < 60; i++) {
      h.pump(exp, 1);             // 10 conducted seconds between taps
      if (h.world.enc) { const id = h.world.enc.id; h.world.enc = null; h.emitLife('creature:gone', { id }); }
      total++;
      if (exp.touchNow({ x: 200 + i, y: 300 })) composedCount++;
    }
    ck(composedCount <= 6 && composedCount < total * 0.2,
       'M4  a burst of touches cannot become a game',
       composedCount + ' answered of ' + total);
  }

  // M5 — while the sky is already speaking (a crossing is live), a
  // touch is ripple-only, by name.
  {
    const h = makeWorld();
    const exp = h.mount();
    walkIn(h, exp);
    exp.setTimeScale(20);
    h.pump(exp, 10);
    h.world.enc = { id: 'whale', manner: {} };
    const out = exp.touchNow({ x: 100, y: 100 });
    const d = exp.diagnostics().decisions.filter((x) => x.touch).pop();
    ck(out === null && d.chosen === 'ripple-only' && /already speaking/.test(d.why),
       'M5  a live crossing owns the moment', d.why);
  }

  // M6 — a touch the sky chose to answer becomes an anchor, so a
  // later experience can echo the place the child marked.
  {
    const h = makeWorld();
    const exp = h.mount();
    walkIn(h, exp);
    exp.setTimeScale(20);
    let composed = null;
    for (let i = 0; i < 40 && !composed; i++) {
      h.pump(exp, 8);
      if (h.world.enc) { const id = h.world.enc.id; h.world.enc = null; h.emitLife('creature:gone', { id }); }
      composed = exp.touchNow({ x: 777, y: 333 });
    }
    const anchors = exp.anchors();
    ck(!!composed && anchors.some((a) => a.why === 'touched' && a.x === 777),
       'M6  an answered touch becomes a place the sky remembers',
       JSON.stringify(anchors.map((a) => a.why)));
  }

  // =================================================================
  console.log('\nB. THE BROWSER — the real page, the real journey');
  // =================================================================
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  async function freshPage(ctxOpts, noThreshold) {
    const context = await browser.newContext(Object.assign(
      { viewport: { width: 1440, height: 900 } }, ctxOpts || {}));
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    await page.goto(BASE + '/index.html');
    await page.waitForSelector('[data-begin]', { timeout: 20000 });
    if (!noThreshold) {
      await page.click('[data-begin]');
      await page.waitForFunction(() => window.vihuEtherRipple !== undefined,
        null, { timeout: 15000 }).catch(() => {});
    }
    return { context, page };
  }
  // A tap the way a child taps: on the sky, inside the dead zone so
  // the parked pointer never starts edge-steering by accident.
  const SKY = { x: 620, y: 280 };

  // B1 — a deliberate tap on empty Ether ripples, from the touched
  // place, and the Composer is told.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(1000);
    // Nothing has been tapped: nothing ripples on its own.
    const before = await page.evaluate(() => window.vihuEtherRipple.touches());
    ck(before === 0, 'B1  an untouched sky never ripples by itself');
    await page.mouse.click(SKY.x, SKY.y);
    const seen = await page.evaluate(() => ({
      touches: window.vihuEtherRipple.touches(),
      active: window.vihuEtherRipple.active(),
      touchDecisions: window.vihuEtherComposer
        ? window.vihuEtherComposer.diagnostics().decisions.filter((d) => d.touch).length
        : -1
    }));
    const r = seen.active[0];
    ck(seen.touches === 1 && r && r.kind === 'wave',
       'B1b a tap on the empty field ripples', JSON.stringify(seen.active));
    ck(r && Math.abs(r.screen.x - SKY.x) < 60 && Math.abs(r.screen.y - SKY.y) < 60,
       'B1c and the wave begins where the finger was',
       r && Math.round(r.screen.x) + ',' + Math.round(r.screen.y));
    ck(seen.touchDecisions === 1,
       'B1d the Composer heard about it, once, and decided');
    await page.screenshot({ path: path.join(SHOTS, 'b1-ripple.png') });
    ck(page.errors.length === 0, 'B1e zero page errors', page.errors[0]);
    await context.close();
  }

  // B2 — a drag never ripples: the traveller's own click-suppression
  // eats the click a drag ends in, and no movement event makes one.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(600);
    await page.mouse.move(500, 400);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(500 + i * 25, 400, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const touches = await page.evaluate(() => window.vihuEtherRipple.touches());
    ck(touches === 0, 'B2  a drag turns the sky and never ripples it',
       'touches ' + touches);
    await context.close();
  }

  // B3 — rapid tapping is dampened: taps faster than a breath apart
  // are one touch, and a burst never reaches the Composer as a
  // composed answer.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(600);
    for (let i = 0; i < 8; i++) {
      await page.mouse.click(SKY.x + i * 6, SKY.y);
      await page.waitForTimeout(110);
    }
    const seen = await page.evaluate(() => ({
      touches: window.vihuEtherRipple.touches(),
      interest: window.vihuEtherRipple.interest(),
      composed: window.vihuEtherComposer
        ? window.vihuEtherComposer.diagnostics().decisions
            .filter((d) => d.touch && d.chosen !== 'ripple-only').length
        : -1
    }));
    ck(seen.touches <= 4, 'B3  eight rapid taps become at most a few touches',
       'touches ' + seen.touches);
    ck(seen.interest < 1, 'B3b and each one spends a little of the sky\'s interest',
       'interest ' + seen.interest.toFixed(2));
    ck(seen.composed === 0, 'B3c none of the burst composed an answer');
    await context.close();
  }

  // B4 — tap ownership around a Spirit: opening is the Spirit's,
  // the closing sky-tap is the universe's own gesture and does NOT
  // also ripple, and afterwards the sky answers again.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(800);
    // Find a Spirit the way a finger does: probe its visible box.
    const spot = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.vp-story'));
      for (const c of cards) {
        const img = c.querySelector('.vp-story-image') || c;
        const r = img.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (x > 40 && x < innerWidth - 40 && y > 40 && y < innerHeight - 40) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest('.vp-story')) return { x, y };
        }
      }
      return null;
    });
    if (!spot) {
      fail('B4  no reachable Spirit to measure ownership against');
    } else {
      const t0 = await page.evaluate(() => window.vihuEtherRipple.touches());
      await page.mouse.click(spot.x, spot.y);
      await page.waitForFunction(() => window.vihuPlanetUniverse.focus.isOpen(),
        null, { timeout: 8000 }).catch(() => {});
      const opened = await page.evaluate(() => ({
        open: window.vihuPlanetUniverse.focus.isOpen(),
        touches: window.vihuEtherRipple.touches()
      }));
      ck(opened.open && opened.touches === t0,
         'B4  a tap on a Spirit belongs to the Spirit', JSON.stringify(opened));
      // The sky tap that sends it home is one tap with one meaning.
      await page.mouse.click(SKY.x, SKY.y + 200);
      await page.waitForTimeout(250);
      const closing = await page.evaluate(() => window.vihuEtherRipple.touches());
      ck(closing === t0,
         'B4b the sky tap that sends a story home does not also ripple');
      await page.waitForFunction(() => !window.vihuPlanetUniverse.focus.isOpen(),
        null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.mouse.click(SKY.x, SKY.y);
      const after = await page.evaluate(() => window.vihuEtherRipple.touches());
      ck(after === t0 + 1, 'B4c and afterwards the sky answers again');
    }
    await context.close();
  }

  // B5 — tap ownership around a creature: its hit region is the
  // creature layer's, and the sky never answers the same tap.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__noticed = 0;
      window.vihuEtherLife.on('creature:noticed', () => { window.__noticed++; });
      window.vihuEtherLife.summon('whale', { respond: 'default', speed: 2.0 });
    });
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 260 && a.screen.x < 1180;
    }, null, { timeout: 60000 });
    // Probe for a visible part of the creature over open sky.
    const spot = await page.evaluate(() => {
      const a = window.vihuEtherLife.active();
      const tries = [[0, 0], [-80, 0], [80, 0], [0, -40], [0, 40], [-140, 0], [140, 0]];
      for (const t of tries) {
        const x = a.screen.x + t[0], y = a.screen.y + t[1];
        if (x < 20 || x > innerWidth - 20 || y < 20 || y > innerHeight - 20) continue;
        const el = document.elementFromPoint(x, y);
        if (el && el.closest && el.closest('.vp-story')) continue;
        return { x, y };
      }
      return null;
    });
    if (!spot) {
      fail('B5  no clear point on the creature to tap');
    } else {
      const t0 = await page.evaluate(() => window.vihuEtherRipple.touches());
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(400);
      const seen = await page.evaluate(() => ({
        noticed: window.__noticed,
        touches: window.vihuEtherRipple.touches()
      }));
      ck(seen.noticed >= 1 && seen.touches === t0,
         'B5  a tap on the whale is the whale\'s, and the sky stays quiet',
         JSON.stringify(seen));
    }
    await context.close();
  }

  // B6 — navigation is intact: the arrow keys still turn the
  // universe, exactly as before.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(400);
    const x0 = await page.evaluate(() => window.vihuPlanetUniverse.camera.offsetFor(1).x);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowRight');
    const x1 = await page.evaluate(() => window.vihuPlanetUniverse.camera.offsetFor(1).x);
    ck(Math.abs(x1 - x0) > 40, 'B6  the arrow keys still turn the universe',
       Math.round(Math.abs(x1 - x0)) + 'px');
    await context.close();
  }

  // B7/B8 — the nudge: appears for a fresh still Traveller, with the
  // desktop wording, and disappears the moment exploration begins —
  // never to return this visit.
  {
    const { context, page } = await freshPage();
    await page.waitForSelector('[data-nudge].is-in', { timeout: 14000 })
      .catch(() => {});
    const nudge = await page.evaluate(() => {
      const el = document.querySelector('[data-nudge]');
      if (!el) return null;
      return {
        line: el.querySelector('.vp-explore-nudge-line').textContent,
        hint: el.querySelector('.vp-explore-nudge-hint').textContent
      };
    });
    ck(!!nudge && nudge.line === 'There’s more out there.',
       'B7  a fresh still Traveller is invited', nudge && nudge.line);
    ck(!!nudge && nudge.hint === '(Use the arrow keys to explore)',
       'B7b with the keyboard\'s own hint', nudge && nudge.hint);
    await page.screenshot({ path: path.join(SHOTS, 'b7-nudge.png') });
    // It never blocks a tap: the sky under the words is still the
    // child's (the element takes no pointer events).
    const inert = await page.evaluate(() => {
      const el = document.querySelector('[data-nudge]');
      return el && getComputedStyle(el).pointerEvents === 'none';
    });
    ck(inert === true, 'B7c and it never blocks an interaction');
    // Exploring dismisses it, at once and for the visit.
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(1600);
    const gone = await page.evaluate(() => !document.querySelector('[data-nudge]'));
    ck(gone, 'B8  exploring answers it, and the words go at once');
    await page.waitForTimeout(9000);
    const stillGone = await page.evaluate(() => !document.querySelector('[data-nudge]'));
    ck(stillGone, 'B8b and it never returns this visit');
    ck(page.errors.length === 0, 'B8c zero page errors', page.errors[0]);
    await context.close();
  }

  // B9 — the unanswered nudge withdraws on its own and does not come
  // back: an invitation, never a nag.
  {
    const { context, page } = await freshPage();
    await page.waitForSelector('[data-nudge].is-in', { timeout: 14000 })
      .catch(() => {});
    const shown = await page.evaluate(() => !!document.querySelector('[data-nudge]'));
    await page.waitForTimeout(9000);
    const later = await page.evaluate(() => !document.querySelector('[data-nudge]'));
    ck(shown && later, 'B9  unanswered, it withdraws by itself and stays away');
    await context.close();
  }

  // B10 — a touch environment gets the touch words.
  {
    const { context, page } = await freshPage({
      hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 }
    });
    await page.waitForSelector('[data-nudge].is-in', { timeout: 14000 })
      .catch(() => {});
    const hint = await page.evaluate(() => {
      const el = document.querySelector('.vp-explore-nudge-hint');
      return el ? el.textContent : null;
    });
    ck(hint === '(Swipe to explore)', 'B10 a finger is told to swipe', hint);
    await context.close();
  }

  // B11 — reduced motion: the invitation is text and may remain; a
  // tap is still acknowledged, but by a STILL glow — nothing travels
  // and the Composer is not consulted (its mount is inert there).
  {
    const { context, page } = await freshPage({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    await page.mouse.click(SKY.x, SKY.y);
    const seen = await page.evaluate(() => ({
      reduced: window.vihuEtherRipple.reduced,
      active: window.vihuEtherRipple.active(),
      lifeQuiet: window.vihuEtherLife.quiet === true
    }));
    ck(seen.reduced === true && seen.lifeQuiet &&
       seen.active.length === 1 && seen.active[0].kind === 'still',
       'B11 reduced motion: a still acknowledgment, nothing travelling',
       JSON.stringify(seen.active));
    await page.waitForSelector('[data-nudge]', { timeout: 14000 }).catch(() => {});
    const nudge = await page.evaluate(() => !!document.querySelector('[data-nudge]'));
    ck(nudge, 'B11b the invitation\'s words remain — text is not motion');
    await context.close();
  }

  // B12 — a Traveller is stateless: the whole visit left no nudge or
  // ripple record in any browser store.
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(1000);
    await page.mouse.click(SKY.x, SKY.y);
    await page.waitForTimeout(500);
    const keys = await page.evaluate(() => {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) {}
      try { for (let i = 0; i < sessionStorage.length; i++) out.push(sessionStorage.key(i)); } catch (e) {}
      return out;
    });
    ck(!keys.some((k) => /nudge|ripple/i.test(k || '')),
       'B12 nothing about any of this is stored anywhere',
       keys.filter((k) => /nudge|ripple/i.test(k || '')).join(','));
    await context.close();
  }

  // B13 — the Composer's echo answers through the ripple layer's own
  // seam, and it draws (the wiring the M section composed through,
  // proved on the real canvas).
  {
    const { context, page } = await freshPage();
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => {
      window.vihuEtherRipple.echoAt(700, 300);
      return window.vihuEtherRipple.active();
    });
    ck(seen.length === 1 && seen[0].kind === 'echo',
       'B13 the sky can answer back through the same fabric',
       JSON.stringify(seen));
    await context.close();
  }

  // =================================================================
  console.log('\nT. TOUCH — the same Ether under a finger (Chromium touch');
  console.log('   emulation over real device profiles; no touch hardware');
  console.log('   exists in this environment and none is claimed)');
  // =================================================================
  const PHONE = {
    hasTouch: true, isMobile: true, deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 }
  };
  // A real finger through the CDP: touchStart, moves, touchEnd — the
  // events the traveller's own handlers read, not a synthesized click.
  async function touchDrag(page, from, to, steps, msPerStep) {
    const cdp = await page.context().newCDPSession(page);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: from.x + (to.x - from.x) * (i / steps),
                 y: from.y + (to.y - from.y) * (i / steps) });
    }
    await cdp.send('Input.dispatchTouchEvent',
      { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent',
        { type: 'touchMove', touchPoints: [{ x: pts[i].x, y: pts[i].y, id: 1 }] });
      if (msPerStep) await page.waitForTimeout(msPerStep);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  const yawOf = (page) =>
    page.evaluate(() => window.vihuPlanetUniverse.camera.offsetFor(1).x);
  const stillOf = (page) =>
    page.evaluate(() => window.vihuPlanetUniverse.traveller.stillSeconds());

  // T1 — a finger's tap ripples from the touched place; a finger's
  // swipe turns the sky and never ripples. The two gestures coexist.
  {
    const { context, page } = await freshPage(PHONE);
    // Past the arrival turn, so camera measurements are the child's.
    await page.waitForTimeout(8000);
    await page.touchscreen.tap(200, 300);
    await page.waitForTimeout(250);
    const afterTap = await page.evaluate(() => ({
      touches: window.vihuEtherRipple.touches(),
      active: window.vihuEtherRipple.active()
    }));
    const r = afterTap.active[0];
    ck(afterTap.touches === 1 && r && r.kind === 'wave' &&
       Math.abs(r.screen.x - 200) < 60 && Math.abs(r.screen.y - 300) < 60,
       'T1  a finger\'s tap ripples where the finger was',
       JSON.stringify(afterTap.active));
    const y0 = await yawOf(page);
    await touchDrag(page, { x: 300, y: 400 }, { x: 100, y: 400 }, 12, 16);
    await page.waitForTimeout(250);
    const y1 = await yawOf(page);
    const afterSwipe = await page.evaluate(() => window.vihuEtherRipple.touches());
    ck(Math.abs(y1 - y0) > 30 && afterSwipe === 1,
       'T1b a finger\'s swipe turns the sky and never ripples it',
       'yaw ' + (y1 - y0).toFixed(1) + ', touches ' + afterSwipe);
    ck(page.errors.length === 0, 'T1c zero page errors on the phone profile',
       page.errors[0]);
    await context.close();
  }

  // T2 — a tap is not a swipe: a finger's few pixels of wobble moves
  // the camera no more than the sky's own ambient drift, and does not
  // silence the invitations (stillness keeps accruing through a tap).
  // Load-bearing: TOUCH_STARTS_AT in core/traveller.js.
  {
    const { context, page } = await freshPage(PHONE);
    await page.waitForTimeout(9000);
    // Control: what the ambient camera does with NO input at all.
    const a0 = await yawOf(page);
    await page.waitForTimeout(400);
    const a1 = await yawOf(page);
    const ambient = a1 - a0;
    // The same window around a 3px jittery tap.
    const s0 = await stillOf(page);
    const b0 = await yawOf(page);
    await touchDrag(page, { x: 220, y: 350 }, { x: 223, y: 352 }, 2, 16);
    await page.waitForTimeout(368);
    const b1 = await yawOf(page);
    const s1 = await stillOf(page);
    ck(Math.abs((b1 - b0) - ambient) < 1.0,
       'T2  a jittery tap moves the camera no more than ambient drift',
       'tap window ' + (b1 - b0).toFixed(2) + ' vs ambient ' + ambient.toFixed(2));
    ck(s1 > s0, 'T2b and a tap never resets stillness — the invitations keep their clock',
       'still ' + s0.toFixed(1) + ' -> ' + s1.toFixed(1));
    // A real swipe DOES reset it: the slop must not deafen the sky.
    await touchDrag(page, { x: 300, y: 400 }, { x: 200, y: 400 }, 8, 16);
    const s2 = await stillOf(page);
    ck(s2 < 1, 'T2c while a real swipe still answers the glance\'s question',
       'still ' + s2.toFixed(2));
    // T2d/T2e — the PRODUCT's own slop, driven with synthetic touch
    // events straight into the handlers. Chromium's gesture recognizer
    // withholds sub-slop touchmove from the page (measured: a broken
    // build's stillness survived a CDP jitter untouched), so the CDP
    // path above cannot see this guard at all — while iOS Safari
    // delivers touchmove with no slop of its own, which is exactly the
    // browser this rule exists for. Load-bearing and revert-proved:
    // without TOUCH_STARTS_AT the jitter resets stillness to 0.
    const syn = await page.evaluate(() => {
      const u = window.vihuPlanetUniverse;
      const root = u.root;
      function tev(type, x, y) {
        const t = new Touch({ identifier: 1, target: root, clientX: x, clientY: y });
        return new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [t],
          changedTouches: [t], bubbles: true, cancelable: true
        });
      }
      const s0 = u.traveller.stillSeconds();
      root.dispatchEvent(tev('touchstart', 220, 350));
      root.dispatchEvent(tev('touchmove', 222, 351));
      root.dispatchEvent(tev('touchmove', 223, 352));
      root.dispatchEvent(tev('touchend', 223, 352));
      const s1 = u.traveller.stillSeconds();
      root.dispatchEvent(tev('touchstart', 300, 400));
      for (let i = 1; i <= 6; i++) {
        root.dispatchEvent(tev('touchmove', 300 - i * 5, 400));
      }
      root.dispatchEvent(tev('touchend', 270, 400));
      const s2 = u.traveller.stillSeconds();
      return { s0: s0, s1: s1, s2: s2 };
    });
    ck(syn.s1 >= syn.s0,
       'T2d the traveller\'s own slop holds where a browser delivers every wobble',
       'still ' + syn.s0.toFixed(2) + ' -> ' + syn.s1.toFixed(2));
    ck(syn.s2 === 0,
       'T2e and the same handler still answers a real swipe past the slop',
       'still ' + syn.s2.toFixed(2));
    await context.close();
  }

  // T3 — a swipe's trailing click is eaten by the traveller's own
  // bound, not only by the browser's goodwill. Chromium suppresses
  // that click itself, so this drives a synthetic one straight into
  // the capture listener within the bound. Load-bearing: the
  // touchend swallow in core/traveller.js.
  {
    const { context, page } = await freshPage(PHONE);
    await page.waitForTimeout(1500);
    await touchDrag(page, { x: 300, y: 400 }, { x: 250, y: 400 }, 4, 16);
    const seen = await page.evaluate(() => {
      const root = window.vihuPlanetUniverse.root;
      const ev = new MouseEvent('click',
        { bubbles: true, cancelable: true, clientX: 250, clientY: 400 });
      root.dispatchEvent(ev);
      return { touches: window.vihuEtherRipple.touches(),
               defaultPrevented: ev.defaultPrevented };
    });
    ck(seen.touches === 0 && seen.defaultPrevented,
       'T3  the sky\'s own hands eat a swipe\'s trailing click',
       JSON.stringify(seen));
    await context.close();
  }

  // T4 — the ripple's spread belongs to the sky it spreads in: on a
  // 390px phone a wave reaches ~164px, on the desktop the full 235,
  // and the floor keeps it visible on any view. Measured at the
  // touch, on the real mounted layer.
  {
    const { context, page } = await freshPage(PHONE);
    await page.waitForTimeout(600);
    const phone = await page.evaluate(() => {
      const u = window.vihuPlanetUniverse;
      window.vihuEtherRipple.touch(120, 200);
      return {
        reach: window.EtherRipple.reachFor(u.ether),
        cap: window.EtherRipple.TUNING.reach,
        floor: window.EtherRipple.TUNING.reachMin,
        short: Math.min(u.ether.viewWidth, u.ether.viewHeight)
      };
    });
    ck(Math.abs(phone.reach - phone.short * 0.42) < 1 && phone.reach < phone.cap &&
       phone.reach >= phone.floor,
       'T4  a phone\'s ripple reaches a fraction of its own view',
       JSON.stringify(phone));
    await context.close();
    // ...and the desktop is untouched: its short edge earns the cap.
    const d = await freshPage();
    const desk = await d.page.evaluate(() =>
      window.EtherRipple.reachFor(window.vihuPlanetUniverse.ether));
    ck(desk === 235, 'T4b the desktop\'s wave is exactly what it always was',
       'reach ' + desk);
    await d.context.close();
  }

  // T5 — phone held sideways: the invitation's words clear the two
  // permanent actions (measured overlapping by 5px before the fix).
  // Load-bearing: the px floor under .vp-explore-nudge's bottom.
  {
    const { context, page } = await freshPage({
      hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      viewport: { width: 844, height: 390 }
    });
    await page.waitForSelector('[data-nudge].is-in', { timeout: 14000 })
      .catch(() => {});
    const geo = await page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect() : null;
      };
      return { nudge: r('[data-nudge]'), actions: r('[data-actions]') };
    });
    ck(!!geo.nudge && !!geo.actions && geo.nudge.bottom <= geo.actions.top - 4,
       'T5  sideways, the invitation stands clear of the two actions',
       geo.nudge && ('nudge b ' + Math.round(geo.nudge.bottom) +
                     ' vs actions t ' + Math.round(geo.actions.top)));
    await context.close();
  }

  // T5b — upright on a phone, the full-width actions row must not sit
  // on the corner controls (measured before the fix: it covered the
  // identity line AND Find a Creator). Load-bearing: the narrow-view
  // actions lift in css/vihuplanet-home.css.
  {
    const { context, page } = await freshPage(PHONE);
    await page.waitForTimeout(1200);
    const geo = await page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden) return null;
        return el.getBoundingClientRect();
      };
      const hit = (a, b) => !!a && !!b &&
        a.left < b.right && a.right > b.left &&
        a.top < b.bottom && a.bottom > b.top;
      const actions = r('[data-actions]');
      return {
        vsFind: hit(actions, r('[data-find]')),
        vsIdentity: hit(actions, r('[data-identity]')),
        actionsT: actions && Math.round(actions.top)
      };
    });
    ck(geo.vsFind === false && geo.vsIdentity === false,
       'T5b upright, the actions never sit on the corner controls',
       JSON.stringify(geo));
    // ...and on a small phone held sideways (640×360) the lifted
    // actions and the invitation still keep their distance.
    await page.setViewportSize({ width: 640, height: 360 });
    await page.waitForTimeout(400);
    const short = await page.evaluate(() => {
      // The nudge itself is once-per-visit and may already be gone —
      // measure where its CSS would PUT one, with a probe element in
      // the real stylesheet's own class.
      const a = document.querySelector('[data-actions]');
      const probe = document.createElement('div');
      probe.className = 'vp-explore-nudge';
      probe.textContent = 'probe';
      (document.querySelector('.vp-home') || document.body).appendChild(probe);
      const nb = probe.getBoundingClientRect().bottom;
      probe.remove();
      return {
        nudgeBottom: Math.round(nb),
        actionsTop: a ? Math.round(a.getBoundingClientRect().top) : null
      };
    });
    ck(short.actionsTop !== null && short.nudgeBottom <= short.actionsTop - 4,
       'T5c and a small sideways phone keeps them apart too',
       JSON.stringify(short));
    await context.close();
  }

  // T6 — a device with BOTH inputs is read by what the hands are
  // doing: a fine pointer says arrow keys until the first real touch,
  // which flips the answer to swipe for the rest of the visit.
  // Chromium's emulation couples hasTouch with a COARSE pointer, so a
  // genuine convertible (fine pointer + touchscreen) cannot be
  // emulated here — the touchstart is dispatched synthetically into
  // the same listener a real screen would fire, and that limit is
  // stated rather than papered over.
  {
    const { context, page } = await freshPage();
    const coarse = await page.evaluate(() =>
      window.matchMedia('(pointer: coarse)').matches);
    await page.evaluate(() => window.dispatchEvent(new Event('touchstart')));
    await page.waitForSelector('[data-nudge].is-in', { timeout: 14000 })
      .catch(() => {});
    const hint = await page.evaluate(() => {
      const el = document.querySelector('.vp-explore-nudge-hint');
      return el ? el.textContent : null;
    });
    ck(coarse === false && hint === '(Swipe to explore)',
       'T6  a fine-pointer screen that has been touched is told to swipe',
       'coarse ' + coarse + ', hint ' + hint);
    await context.close();
  }

  await browser.close();

  // =================================================================
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
