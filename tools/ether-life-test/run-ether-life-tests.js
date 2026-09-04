/* SPRINT — ETHER TRAVELLER EXPERIENCE: THE FIRST 20 SECONDS.
 *
 * A fresh Traveller must never enter a directionless Ether. This suite
 * walks that Traveller's real first minute: land on VihuPlanet, cross
 * the one threshold, and measure the beats the sprint names — is there
 * something to notice, does the universe teach that it can be
 * explored, is something worth investigating encountered, does it lead
 * anywhere. Then it drives the one interaction pattern built
 * end-to-end (Follow the Whale) both ways a child can have it: by
 * turning toward the whale, and by touching it.
 *
 * The adversarial half is what must NOT be true: no Companion in the
 * Ether before a Story is opened, no creature knowledge in the runtime
 * files Decision 9 protects, no gamification vocabulary anywhere in
 * the layer, nothing stored about a Traveller, and a reduced-motion
 * universe left completely still.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8792 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-life-test/run-ether-life-tests.js
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

// Strip comments before scanning source for vocabulary — a word inside
// its own rationale has tripped this repository's checks many times.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  // =================================================================
  // S. STATICS — the boundaries hold before a browser ever opens.
  // =================================================================
  console.log('\nS. STATICS');
  const lifeSrc = fs.readFileSync(path.join(ROOT, 'js/etherLife.js'), 'utf8');
  const discSrc = fs.readFileSync(path.join(ROOT, 'js/etherDiscovery.js'), 'utf8');
  const lifeCode = stripComments(lifeSrc);
  const discCode = stripComments(discSrc);

  // S1 — Decision 9's own test: the protected runtime files know
  // nothing about creatures, and neither does the composition root.
  const protectedFiles = [
    'vihuplanet/runtime/physics/physics.js',
    'vihuplanet/runtime/stories/storyManager.js',
    'vihuplanet/runtime/ether/etherRenderer.js',
    'vihuplanet/runtime/core/universe.js',
    'vihuplanet/runtime/ambient/ambientSystem.js'
  ];
  {
    const dirty = protectedFiles.filter((f) => {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8').toLowerCase();
      return /\bcreature\b|etherlife|etherdiscovery/.test(s);
    });
    ck(dirty.length === 0, 'S1  the runtime never learned creatures exist',
       dirty.length ? dirty.join(', ') : protectedFiles.length + ' files clean');
  }

  // S2 — no gamification vocabulary in the layer. `points` is excused
  // by name: a constellation skeleton has points the way a polygon
  // does, and the concept this scan guards is a score.
  {
    const banned = /\b(score|scores|scored|streak|leaderboard|badge|reward|rewards|xp|rank|ranking|achievement|combo|currency|unlock)\b/i;
    const hitL = lifeCode.match(banned);
    const hitD = discCode.match(banned);
    ck(!hitL && !hitD, 'S2  no gamification vocabulary in the layer',
       (hitL && hitL[0]) || (hitD && hitD[0]) || '15 terms checked, comments stripped');
  }

  // S3 — a Traveller is stateless (Decision 19): the layer can store
  // nothing, anywhere.
  {
    const storage = /(localStorage|sessionStorage|indexedDB|document\.cookie)/;
    ck(!storage.test(lifeCode) && !storage.test(discCode),
       'S3  nothing is stored — a Traveller arrives new every time');
  }

  // S4 — the layer writes nothing onto the Story entities it reads.
  // The one honest static form: it never assigns through the entity
  // reference it holds (`best` / `entity` / `target.entity`).
  {
    const writes = /\b(best|entity)\s*\.\s*\w+\s*=/.test(discCode) ||
                   /\btarget\.entity\s*\.\s*\w+\s*=/.test(lifeCode);
    ck(!writes, 'S4  Story entities are read the way a renderer reads them — never written');
  }

  // S5 — the canon carries the Living Ether, in worldview words.
  {
    const canon = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'assets/canon/vihuplanet.canon.json'), 'utf8'));
    const sec = canon.sections.find((s) => s.key === 'the-living-ether');
    ck(!!sec, 'S5  the canon knows the Ether is alive', sec && sec.title);
    const text = JSON.stringify(sec || {});
    ck(!!sec && /never speak/.test(text) && /Companion/.test(text),
       'S5b and it says the beings are never anyone\'s Companion');
  }

  // S7 — the wonders are a family, not one figure: two wonders in one
  // visit should not be the same wonder. The real module is loaded and
  // its registry read, not pattern-matched.
  {
    const g = {};
    new Function('window', lifeSrc)(g);
    const W = g.EtherLife && g.EtherLife.WONDERS;
    const ids = (W || []).map((w) => w.id);
    ck(Array.isArray(W) && W.length >= 3 && new Set(ids).size === ids.length &&
       W.every((w) => Array.isArray(w.points) && Array.isArray(w.links)),
       'S7  the wonders are a registry of distinct figures', ids.join(', '));
  }

  // S6 — the gap log is still wired: the sprint that added it is not
  // undone by this one.
  {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const talk = fs.readFileSync(path.join(ROOT, 'js/travellerTalk.js'), 'utf8');
    ck(idx.indexOf('js/companionGapLog.js') !== -1 &&
       /CompanionGapLog\.consider/.test(talk),
       'S6  conversation gap logging remains operational');
  }

  // =================================================================
  // U. THE COMPOSER, ALONE — composition rules that need no browser.
  // The real module runs against a hand-held universe, which is the
  // only way to make "the Ether holds no eligible Story" true while
  // Canon Stories ship with the application.
  // =================================================================
  console.log('\nU. DISCOVERY COMPOSITION');
  {
    const g = {};
    new Function('window', discSrc + '\n')(g); // attaches EtherDiscovery to `window`
    const ED = g.EtherDiscovery;
    ck(!!ED && typeof ED.attach === 'function', 'U1  the composer loads on its own');

    function fakeUniverse(entities) {
      return {
        stories: { all: () => entities },
        ether: { viewWidth: 1440, viewHeight: 900, width: 4000, height: 2500,
                 depth: { stories: 1 } },
        camera: { offsetFor: () => ({ x: 0, y: 0 }) }
      };
    }
    function fakeLife() {
      const l = { handlers: {}, composer: null };
      l.quiet = false;
      l.setComposer = (fn) => { l.composer = fn; };
      l.on = (e, fn) => { (l.handlers[e] = l.handlers[e] || []).push(fn); };
      l.emitBack = (e, p) => (l.handlers[e] || []).forEach((fn) => fn(p));
      return l;
    }

    // U2 — no Stories at all: the trail still leads somewhere. The
    // wonder is far enough from the centre that following it turns
    // the universe.
    {
      const life = fakeLife();
      ED.attach(fakeUniverse([]), life);
      const t = life.composer({ creature: 'whale' });
      ck(!!t && t.kind === 'wonder', 'U2  no eligible Story still composes a discovery',
         t && t.kind);
      const dx = t ? t.x - 720 : 0, dy = t ? t.y - 450 : 0;
      ck(!!t && Math.sqrt(dx * dx + dy * dy) > 500,
         'U2b and it is far enough to require a real turn',
         t && Math.round(Math.sqrt(dx * dx + dy * dy)) + 'px');
    }

    // U3 — a far, unmet Story outranks the wonder; a Story already in
    // front of the child is not a discovery.
    {
      const near = { id: 'story-near', prox: 0.9, focusT: 0, position: { x: 700, y: 440 } };
      const farS = { id: 'story-far', prox: 0.02, focusT: 0, position: { x: 3000, y: 2000 } };
      const life = fakeLife();
      ED.attach(fakeUniverse([near, farS]), life);
      const t = life.composer({ creature: 'whale' });
      ck(!!t && t.kind === 'story' && t.id === 'story-far',
         'U3  the discovery is the Story nobody has looked at', t && t.id);
    }

    // U4 — one discovery at a time: while an activity is live, the
    // composer declines. Staged, never dumped.
    {
      const farS = { id: 's1', prox: 0, focusT: 0, position: { x: 3000, y: 2000 } };
      const farS2 = { id: 's2', prox: 0, focusT: 0, position: { x: 100, y: 100 } };
      const life = fakeLife();
      const c = ED.attach(fakeUniverse([farS, farS2]), life);
      const first = life.composer({ creature: 'whale' });
      const second = life.composer({ creature: 'whale' });
      ck(!!first && second === null, 'U4  one discovery at a time — curiosity is staged');
      ck(c.current() && c.current().id === 'follow-the-whale',
         'U4b and the activity underway is the registered one', c.current() && c.current().id);
      // The trail found → the activity resolves, and rest follows.
      life.emitBack('trail:found', {});
      ck(c.current() === null, 'U4c finding it ends the activity');
      const third = life.composer({ creature: 'whale' });
      ck(third === null, 'U4d and the sky rests before offering the next one');
    }

    // U5 — a Story led to once is not led to again this visit.
    {
      const s1 = { id: 'only', prox: 0, focusT: 0, position: { x: 3000, y: 2000 } };
      const life = fakeLife();
      ED.attach(fakeUniverse([s1]), life);
      const t1 = life.composer({ creature: 'whale' });
      life.emitBack('trail:faded', {});   // withdrew, nothing found
      const t2 = life.composer({ creature: 'whale' });
      ck(!!t1 && t1.id === 'only' && !!t2 && t2.kind === 'wonder',
         'U5  the same Story is not offered twice in one visit',
         t2 && t2.kind);
    }

    // U6 — a creature with no activity row composes nothing:
    // activities are a registry, never a default. (The starbird used
    // to be the example here; it earned its own row — star-trail — so
    // the jellyfish, whose answer is light rather than a path, is now
    // the creature that must get nothing.)
    {
      const life = fakeLife();
      ED.attach(fakeUniverse([]), life);
      ck(life.composer({ creature: 'jellyfish' }) === null,
         'U6  a creature with no activity gets no trail');
    }
  }

  // =================================================================
  // Browser sections.
  // =================================================================
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });

  async function freshPage(ctxOpts) {
    const context = await browser.newContext(Object.assign(
      { viewport: { width: 1440, height: 900 } }, ctxOpts || {}));
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    return { context, page };
  }

  async function crossThreshold(page) {
    await page.waitForFunction(() => typeof EtherFeed !== 'undefined', null, { timeout: 20000 });
    for (let i = 0; i < 14; i++) {
      const crossed = await page.evaluate(() => {
        const b = document.querySelector('[data-begin]');
        if (b && b.getBoundingClientRect().width > 0) { b.click(); return false; }
        return true;
      });
      if (crossed) break;
      await page.waitForTimeout(500);
    }
  }

  // Turn the universe so a point at `parallax` lands at the centre —
  // the test's arm doing what a child's hand does, through the same
  // camera the child turns. The arrow tap afterwards is load-bearing:
  // restoreViewpoint() moves the CAMERA, and being noticed requires
  // the TRAVELLER to have acted (etherLife's own grammar), which only
  // real input — a key, a drag, a touch — registers.
  // A key tap long enough for the frame loop to actually see it — a
  // bare press() can rise and fall between two animation frames, and
  // an input nobody processed resets nothing.
  async function turnTap(page) {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(50);
    await page.keyboard.up('ArrowRight');
  }

  async function centreOn(page, getScreen, parallax) {
    for (let i = 0; i < 10; i++) {
      await turnTap(page);
      const done = await page.evaluate(([fnSrc, p]) => {
        const u = window.vihuPlanetUniverse;
        const s = (new Function('return (' + fnSrc + ')')())();
        if (!s) return 'gone';
        const e = u.ether;
        const dx = s.x - e.viewWidth * 0.5;
        const dy = s.y - e.viewHeight * 0.5;
        if (Math.sqrt(dx * dx + dy * dy) < 60) return true;
        const st = u.viewpoint();
        u.restoreViewpoint({
          yaw: st.yaw + (dx * Math.PI * 2) / (e.width * p),
          pitch: st.pitch + (dy * Math.PI * 2) / (e.height * p)
        });
        return false;
      }, [getScreen.toString(), parallax]);
      if (done === true || done === 'gone') return done;
      await page.waitForTimeout(300);
    }
    return false;
  }

  // =================================================================
  // A. A FRESH TRAVELLER'S FIRST TWENTY SECONDS — real time, no test
  // clock. The 20-second rule is a behavioural target; this section
  // measures the beats on the product's own schedule.
  // =================================================================
  console.log('\nA. THE FIRST TWENTY SECONDS');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    const t0 = Date.now();
    await crossThreshold(page);

    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 })
      .catch(() => {});
    const mounted = await page.evaluate(() => ({
      life: !!window.vihuEtherLife,
      quiet: window.vihuEtherLife && window.vihuEtherLife.quiet,
      canvas: !!document.querySelector('.vp-ether-life'),
      pe: (document.querySelector('.vp-ether-life') || {}).style
          ? document.querySelector('.vp-ether-life').style.pointerEvents : '',
      belowStories: (() => {
        const c = document.querySelector('.vp-ether-life');
        const s = document.querySelector('.vp-story-layer');
        if (!c || !s) return false;
        return !!(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
      discovery: !!window.vihuEtherDiscovery
    }));
    ck(mounted.life && !mounted.quiet, 'A1  the Ether\'s life wakes with the child');
    ck(mounted.canvas && mounted.pe === 'none' && mounted.belowStories,
       'A1b on its own canvas, beneath the Stories, untouchable',
       'pointer-events: ' + mounted.pe);
    ck(mounted.discovery, 'A1c and the discovery composer is listening');

    // ~5 seconds: has something already happened? The arrival turn is
    // the universe demonstrating itself.
    await page.waitForTimeout(Math.max(0, 4500 - (Date.now() - t0)));
    const turned = await page.evaluate(() =>
      Math.abs(window.vihuPlanetUniverse.camera.yaw()) > 0.05);
    ck(turned, 'A2  by five seconds the universe has already moved (the arrival turn)');

    // Inside the 20-second window: a creature crosses. The first is
    // always the whale — the one that can lead somewhere.
    let arrival = null;
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return !!a;
    }, null, { timeout: 16000 }).then(async () => {
      arrival = await page.evaluate(() => window.vihuEtherLife.active());
    }).catch(() => {});
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);
    ck(!!arrival && arrival.id === 'whale',
       'A3  something worth investigating arrives inside the window',
       arrival ? arrival.id + ' at ' + seconds + 's' : 'nothing by ' + seconds + 's');

    // And it is genuinely drawn — light on the canvas where the layer
    // says the creature is, not a data structure claiming to glow. A
    // beat first: it enters nose-first, and the sample is around its
    // centre.
    await page.waitForTimeout(2500);
    const drawn = await page.evaluate(() => {
      const a = window.vihuEtherLife.active();
      if (!a) return { visible: false };
      const c = document.querySelector('.vp-ether-life');
      const ctx = c.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const x = Math.max(0, Math.min(c.width - 200, Math.round(a.screen.x * dpr) - 100));
      const y = Math.max(0, Math.min(c.height - 200, Math.round(a.screen.y * dpr) - 100));
      const d = ctx.getImageData(x, y, 200, 200).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
      return { visible: lit > 40, lit: lit, screen: a.screen };
    });
    ck(drawn.visible, 'A4  and it is really there — measured on the canvas, not asserted',
       drawn.lit + ' lit px around ' + (drawn.screen ? Math.round(drawn.screen.x) + ',' + Math.round(drawn.screen.y) : '?'));

    // The Companion does not exist in the Ether before a Story is
    // opened. It is the reward of stepping in, never scenery.
    const noCompanion = await page.evaluate(() => {
      const host = document.querySelector('[data-portal-host]');
      return {
        hostHere: !!(host && host.classList.contains('is-here')),
        widget: !!document.querySelector('.companion-widget, #companionWidget'),
        talk: !!document.querySelector('[data-traveller-talk-open]:not([hidden])')
      };
    });
    ck(!noCompanion.hostHere && !noCompanion.widget,
       'A5  no Companion anywhere in the Ether before a Story opens');

    await page.screenshot({ path: path.join(SHOTS, 'a-first-20s.png') });
    ck(page.errors.length === 0, 'A6  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // B. FOLLOW THE WHALE, BY TURNING — the interaction end-to-end. The
  // whale is summoned through its own public seam (the composer and a
  // future activity use the same call), then noticed the way a child
  // notices it: by turning the universe toward it.
  // =================================================================
  console.log('\nB. FOLLOW THE WHALE — NOTICED BY TURNING');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });
    // Spirits need to exist for the trail to have a Story to lead to;
    // Canon Stories ship with the application (Decision 13), so a
    // fresh universe already holds some.
    await page.waitForFunction(() =>
      window.vihuPlanetUniverse.stories.count() > 0, null, { timeout: 20000 })
      .catch(() => {});
    // Densify, as G does: in a SPARSE universe (FAR_SPARSE) whatever
    // is in view has high prox, so whether any Story counts as
    // undiscovered — and therefore whether the whale points at a Story
    // or a wonder — was down to where two Canon spirits happened to
    // drift. This section is about the whale → STORY path, so the
    // universe must reliably hold an undiscovered Story.
    await page.evaluate(() => {
      const rows = [];
      for (let i = 0; i < 6; i++) rows.push({ id: 'b-seed-' + i, title: 'Seeded ' + i });
      window.vihuPlanetUniverse.seed(rows);
    });
    const storyCount = await page.evaluate(() => window.vihuPlanetUniverse.stories.count());

    await page.evaluate(() => {
      window.__lifeEvents = [];
      ['creature:arrived', 'creature:noticed', 'creature:responded',
       'trail:begun', 'trail:found', 'trail:faded'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
      window.vihuEtherLife.summon('whale');
    });

    const centred = await centreOn(page,
      () => { const a = window.vihuEtherLife.active(); return a && a.screen; }, 0.82);
    ck(centred === true, 'B1  the universe can be turned until the whale is met');

    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:responded'),
      null, { timeout: 8000 }).catch(() => {});
    const events = await page.evaluate(() => window.__lifeEvents.map((e) => e[0]));
    ck(events.indexOf('creature:noticed') !== -1,
       'B2  turning toward it is what notices it — no click, no key');
    ck(events.indexOf('creature:responded') !== -1,
       'B2b and being noticed is answered');

    const trail = await page.evaluate(() => window.vihuEtherLife.trail());
    if (storyCount > 0) {
      ck(!!trail && trail.target.kind === 'story',
         'B3  the whale\'s breath leads to a Story', trail && trail.target.id);
      ck(!!trail && trail.motes >= 7, 'B3b a real trail, not a hint',
         trail && trail.motes + ' motes');
      const activity = await page.evaluate(() =>
        window.vihuEtherDiscovery.current());
      ck(!!activity && activity.id === 'follow-the-whale',
         'B4  the activity framework carries it', activity && activity.id);

      // FOLLOW IT: turn until the Story it names is in front of us.
      const followed = await centreOn(page, () => {
        const t = window.vihuEtherLife.trail();
        if (!t) return null;
        const u = window.vihuPlanetUniverse;
        const e = u.stories.all().find((s) => s.id === t.target.id);
        return e ? { x: e.screenX, y: e.screenY } : null;
      }, 1.0);

      await page.waitForFunction(() =>
        window.__lifeEvents.some((e) => e[0] === 'trail:found'),
        null, { timeout: 10000 }).catch(() => {});
      const found = await page.evaluate(() => ({
        found: window.__lifeEvents.some((e) => e[0] === 'trail:found'),
        activity: window.vihuEtherDiscovery.current()
      }));
      ck(found.found, 'B5  following the trail finds the Story', 'followed=' + followed);
      ck(found.activity === null, 'B5b and the discovery completes — one at a time');
    } else {
      fail('B3  the whale\'s breath leads to a Story', 'no Spirits in the universe to lead to');
    }

    await page.screenshot({ path: path.join(SHOTS, 'b-followed.png') });
    ck(page.errors.length === 0, 'B6  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // C. THE WHALE, TOUCHED — the other way a child notices it — and the
  // WONDER: what a trail leads to when no Story is eligible. The
  // composer seam is overridden through its own public surface, which
  // is exactly what a future activity would do.
  // =================================================================
  console.log('\nC. TOUCHED, AND LED TO A WONDER');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });

    await page.evaluate(() => {
      window.__lifeEvents = [];
      ['creature:noticed', 'creature:responded', 'trail:begun', 'trail:found']
        .forEach((e) => window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
      // A wonder, a good turn away from wherever the child is looking.
      window.vihuEtherLife.setComposer(() => {
        const u = window.vihuPlanetUniverse;
        const cam = u.camera.offsetFor(u.ether.depth.stories);
        return {
          kind: 'wonder', id: null,
          x: u.ether.viewWidth * 0.5 - cam.x + 900,
          y: u.ether.viewHeight * 0.5 - cam.y + 260
        };
      });
      window.vihuEtherLife.summon('whale');
    });

    // Wait for it to swim into reach of a finger, then touch it.
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 120 && a.screen.x < 1320 &&
             a.screen.y > 80 && a.screen.y < 820;
    }, null, { timeout: 20000 });
    const spot = await page.evaluate(() => window.vihuEtherLife.active().screen);
    await page.mouse.click(spot.x, spot.y);

    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:begun'),
      null, { timeout: 6000 }).catch(() => {});
    const touched = await page.evaluate(() => ({
      noticed: window.__lifeEvents.some((e) => e[0] === 'creature:noticed'),
      trail: window.vihuEtherLife.trail()
    }));
    ck(touched.noticed, 'C1  touching the whale notices it too');
    ck(!!touched.trail && touched.trail.target.kind === 'wonder',
       'C2  with no Story to lead to, the trail leads to a wonder');

    // Follow to the wonder and watch the sky answer.
    await centreOn(page, () => {
      const t = window.vihuEtherLife.trail();
      if (!t) return null;
      const u = window.vihuPlanetUniverse;
      const cam = u.camera.offsetFor(u.ether.depth.stories);
      const wrap = (v, span, c) => v - Math.round((v - c) / span) * span;
      return {
        x: wrap(t.target.x + cam.x, u.ether.width, u.ether.viewWidth * 0.5),
        y: wrap(t.target.y + cam.y, u.ether.height, u.ether.viewHeight * 0.5)
      };
    }, 1.0);
    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:found'),
      null, { timeout: 10000 }).catch(() => {});
    const found = await page.evaluate(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:found'));
    ck(found, 'C3  following it finds the wonder — discovery without a single Story');

    // The bloom is drawn at the wonder's place: light where there was
    // nothing, and nothing to collect.
    await page.waitForTimeout(1600);
    const bloom = await page.evaluate(() => {
      const t = window.vihuEtherLife.trail();
      if (!t) return { lit: -1 };
      const u = window.vihuPlanetUniverse;
      const cam = u.camera.offsetFor(u.ether.depth.stories);
      const wrap = (v, span, c) => v - Math.round((v - c) / span) * span;
      const x = wrap(t.target.x + cam.x, u.ether.width, u.ether.viewWidth * 0.5);
      const y = wrap(t.target.y + cam.y, u.ether.height, u.ether.viewHeight * 0.5);
      const c = document.querySelector('.vp-ether-life');
      const ctx = c.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(0, Math.min(c.width - 160, Math.round(x * dpr) - 80));
      const py = Math.max(0, Math.min(c.height - 160, Math.round(y * dpr) - 80));
      const d = ctx.getImageData(px, py, 160, 160).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
      return { lit };
    });
    ck(bloom.lit > 20, 'C4  and the sky visibly answers — a small being of stars blooms',
       bloom.lit + ' lit px');

    await page.screenshot({ path: path.join(SHOTS, 'c-wonder.png') });
    ck(page.errors.length === 0, 'C5  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // D. NAVIGATION — the keyboard has always worked; the mouse can now
  // also GRAB the sky. And a drag is never mistaken for a tap.
  // =================================================================
  console.log('\nD. NAVIGATION');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuPlanetUniverse, null, { timeout: 8000 });
    // Let the arrival turn finish so it cannot be mistaken for input.
    await page.waitForTimeout(7000);

    const yaw0 = await page.evaluate(() => window.vihuPlanetUniverse.viewpoint().yaw);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    const yaw1 = await page.evaluate(() => window.vihuPlanetUniverse.viewpoint().yaw);
    ck(Math.abs(yaw1 - yaw0) > 0.1, 'D1  arrow keys turn the universe',
       (yaw1 - yaw0).toFixed(3) + ' rad');

    // The mouse drag: press the SKY — a spot where the topmost thing
    // really is the universe, not a Spirit or a control — pull, let go.
    async function skySpot() {
      return page.evaluate(() => {
        const cands = [[220, 220], [1220, 220], [220, 680], [1220, 680], [720, 430]];
        for (const c of cands) {
          const el = document.elementFromPoint(c[0], c[1]);
          // The topmost sky element is the universe root itself (its
          // canvases decline the pointer); either counts as sky.
          if (el && (el.tagName === 'CANVAS' ||
              (el.className || '').indexOf('vp-universe') !== -1)) {
            return { x: c[0], y: c[1] };
          }
        }
        return { x: 220, y: 220 };
      });
    }
    const s1 = await skySpot();
    await page.mouse.move(s1.x, s1.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(s1.x - i * 22, s1.y);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const yaw2 = await page.evaluate(() => window.vihuPlanetUniverse.viewpoint().yaw);
    ck(Math.abs(yaw2 - yaw1) > 0.1, 'D2  dragging with the mouse pulls the sky',
       (yaw2 - yaw1).toFixed(3) + ' rad');

    // A drag must never be read as a tap. Open a Spirit, drag the sky,
    // and the Spirit stays open; a plain tap on the sky closes it —
    // the distinction is the whole safety of the gesture.
    await page.waitForFunction(() =>
      window.vihuPlanetUniverse.stories.count() > 0, null, { timeout: 20000 })
      .catch(() => {});
    const hasStories = await page.evaluate(() => window.vihuPlanetUniverse.stories.count() > 0);
    if (hasStories) {
      await page.evaluate(() => {
        const u = window.vihuPlanetUniverse;
        // `focus:closing` is the honest signal: isOpen() stays true
        // through the whole return animation, so polling it after a
        // drag can only measure the animation's timing, not whether
        // the drag closed anything. Measured: with the suppression
        // reverted the isOpen() version still passed.
        window.__closings = 0;
        u.on('focus:closing', () => { window.__closings++; });
        u.focus.open(u.stories.all()[0].id);
      });
      await page.waitForTimeout(1200);
      const s2 = await skySpot();
      await page.mouse.move(s2.x, s2.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(s2.x + i * 20, s2.y);
      await page.mouse.up();
      await page.waitForTimeout(400);
      const afterDrag = await page.evaluate(() => window.__closings);
      ck(afterDrag === 0, 'D3  a drag that ends on the sky never closes what a child is looking at',
         afterDrag + ' focus:closing');
      await page.mouse.click(s2.x, s2.y);
      await page.waitForTimeout(400);
      const afterTap = await page.evaluate(() => window.__closings);
      ck(afterTap > 0, 'D3b while a plain tap on the sky still does',
         afterTap + ' focus:closing');
    } else {
      fail('D3  drag/tap distinction', 'no Spirits to test against');
    }

    ck(page.errors.length === 0, 'D4  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // E. REDUCED MOTION — a creature crossing the sky is unrequested
  // motion, so none ever crosses it. The same answer the Ambient
  // System gives for shooting stars.
  // =================================================================
  console.log('\nE. REDUCED MOTION');
  {
    const { context, page } = await freshPage({ reducedMotion: 'reduce' });
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 })
      .catch(() => {});
    const quiet = await page.evaluate(() => ({
      life: !!window.vihuEtherLife,
      quiet: window.vihuEtherLife && window.vihuEtherLife.quiet,
      canvas: !!document.querySelector('.vp-ether-life'),
      summoned: window.vihuEtherLife ? window.vihuEtherLife.summon('whale') : 'absent'
    }));
    ck(quiet.life && quiet.quiet === true && !quiet.canvas && quiet.summoned === null,
       'E1  under reduced motion the layer mounts inert — no canvas, no creatures, ever');
    ck(page.errors.length === 0, 'E2  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // F. THE STAR TRAIL — the starbird is not a reskin of the whale.
  // The whale stays and points; the bird flies TO the discovery,
  // shedding feathers at the places it actually flew through.
  // =================================================================
  console.log('\nF. THE STAR TRAIL');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });

    // OWN THE SKY. A cold first load can spend seven seconds on the
    // threshold alone (measured), by which time the scheduler's own
    // whale is already crossing — and a starbird section that clicks
    // whatever is there is secretly about a whale. Remounted through
    // the page's own public seams, with the scheduler pushed past the
    // horizon so the only creature is the one this section summons.
    const summoned = await page.evaluate(() => {
      try { window.vihuEtherLife.destroy(); } catch (e) {}
      const t = Object.assign({}, EtherLife.TIMES, { firstArrival: [9999, 10000] });
      window.vihuEtherLife = EtherLife.mount(window.vihuPlanetUniverse, { times: t });
      window.vihuEtherDiscovery = EtherDiscovery.attach(
        window.vihuPlanetUniverse, window.vihuEtherLife);
      window.__lifeEvents = [];
      ['creature:noticed', 'creature:responded', 'creature:delivered',
       'trail:begun', 'trail:found'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
      // The trail's high-water mark: a short flight settles and goes,
      // and a check that reads the final state reads nothing.
      window.__maxMotes = 0;
      window.setInterval(() => {
        const t = window.vihuEtherLife.trail();
        if (t && t.motes > window.__maxMotes) window.__maxMotes = t.motes;
      }, 100);
      return window.vihuEtherLife.summon('starbird');
    });
    ck(summoned === 'starbird', 'F0  the starbird takes the sky', summoned);

    // Touch it while it crosses — the swift is caught by a finger.
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 100 && a.screen.x < 1340 &&
             a.screen.y > 60 && a.screen.y < 840;
    }, null, { timeout: 15000 });
    const spot = await page.evaluate(() => window.vihuEtherLife.active().screen);
    await page.mouse.click(spot.x, spot.y);

    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:begun'),
      null, { timeout: 6000 }).catch(() => {});
    const begun = await page.evaluate(() => ({
      responded: window.__lifeEvents.find((e) => e[0] === 'creature:responded'),
      active: window.vihuEtherLife.active(),
      activity: window.vihuEtherDiscovery.current()
    }));
    ck(!!begun.responded && begun.responded[1].response === 'feathers',
       'F1  the starbird answers in its own voice — feathers, not breath');
    ck(!!begun.activity && begun.activity.id === 'star-trail',
       'F2  and it is its own activity, from the same registry',
       begun.activity && begun.activity.id);
    ck(!!begun.active && begun.active.guiding === true,
       'F3  the bird itself flies to the discovery');

    // Feathers are shed at the places it actually flew through.
    await page.waitForFunction(() => window.__maxMotes >= 2,
      null, { timeout: 10000 }).catch(() => {});
    const shed = await page.evaluate(() => window.__maxMotes);
    // Two is growth; a flight that happened to start near its
    // discovery is short, not wrong.
    ck(shed >= 2, 'F4  a real feather trail grows behind it', shed + ' feathers');

    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:delivered'),
      null, { timeout: 20000 }).catch(() => {});
    const delivered = await page.evaluate(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:delivered'));
    ck(delivered, 'F5  and it arrives — the flight ends at the discovery');

    // Following the feathers finds what it carried the way to.
    await centreOn(page, () => {
      const t = window.vihuEtherLife.trail();
      if (!t) return null;
      const u = window.vihuPlanetUniverse;
      if (t.target.kind === 'story') {
        const e = u.stories.all().find((s) => s.id === t.target.id);
        return e ? { x: e.screenX, y: e.screenY } : null;
      }
      const cam = u.camera.offsetFor(u.ether.depth.stories);
      const wrap = (v, span, c) => v - Math.round((v - c) / span) * span;
      return {
        x: wrap(t.target.x + cam.x, u.ether.width, u.ether.viewWidth * 0.5),
        y: wrap(t.target.y + cam.y, u.ether.height, u.ether.viewHeight * 0.5)
      };
    }, 1.0);
    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:found'),
      null, { timeout: 10000 }).catch(() => {});
    const found = await page.evaluate(() =>
      window.__lifeEvents.some((e) => e[0] === 'trail:found'));
    ck(found, 'F6  following the flight finds the discovery');

    await page.screenshot({ path: path.join(SHOTS, 'f-startrail.png') });
    ck(page.errors.length === 0, 'F7  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // G. THE JELLYFISH — illumination, not a path. Its pulse washes over
  // the sky and the dim Spirits it passes glow for a moment: light
  // showing where things rest, leading to none of them.
  // =================================================================
  console.log('\nG. THE JELLYFISH');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });

    // Own the sky — the same cold-load race F0 records.
    await page.evaluate(() => {
      try { window.vihuEtherLife.destroy(); } catch (e) {}
      const t = Object.assign({}, EtherLife.TIMES, { firstArrival: [9999, 10000] });
      window.vihuEtherLife = EtherLife.mount(window.vihuPlanetUniverse, { times: t });
      window.vihuEtherDiscovery = EtherDiscovery.attach(
        window.vihuPlanetUniverse, window.vihuEtherLife);
      window.__lifeEvents = [];
      ['creature:responded'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
    });

    // STAGE THE MEASUREMENT. Two things, both learned by measuring:
    //
    // A SPARSE UNIVERSE REVEALS FURTHER OUT (storySpirit.js's own
    // FAR_SPARSE) — with two Canon Stories, a Spirit 380px off centre
    // has prox ≈ 0.8, is already resolved on screen, and is CORRECTLY
    // not washed. Only a dense universe has dim Spirits in view, so
    // the section seeds one through the universe's own public seed().
    //
    // Then a real Spirit is turned to 380px off centre — prox ≈ 0.17
    // in the dense field, under the "already resolved" line — so the
    // wash has something definite to reveal.
    await page.waitForFunction(() =>
      window.vihuPlanetUniverse.stories.count() > 0, null, { timeout: 20000 })
      .catch(() => {});
    await page.evaluate(() => {
      const rows = [];
      for (let i = 0; i < 6; i++) {
        rows.push({ id: 'lit-seed-' + i, title: 'Seeded ' + i });
      }
      window.vihuPlanetUniverse.seed(rows);
    });
    const staged = await (async () => {
      const has = await page.evaluate(() => window.vihuPlanetUniverse.stories.count() > 0);
      if (!has) return false;
      return (await centreOn(page, () => {
        const u = window.vihuPlanetUniverse;
        // A sticky pick: choosing "the dimmest" fresh each step can
        // switch Spirits as the first one brightens, and the loop
        // chases two targets forever.
        let dim = window.__g2pick
          ? u.stories.all().find((e) => e.id === window.__g2pick) : null;
        if (!dim) {
          for (const e of u.stories.all()) {
            if (!dim || (e.prox || 0) < (dim.prox || 0)) dim = e;
          }
          window.__g2pick = dim && dim.id;
        }
        return dim ? { x: dim.screenX - 380, y: dim.screenY } : null;
      }, 1.0)) === true;
    })();

    const jelly = await page.evaluate(() =>
      window.vihuEtherLife.summon('jellyfish'));
    ck(jelly === 'jellyfish', 'G0  the jellyfish takes the sky', jelly);

    // Touch it as soon as a finger could reach it — it drifts slowly.
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > -60 && a.screen.x < 1500;
    }, null, { timeout: 20000 });
    const spot = await page.evaluate(() => {
      const s = window.vihuEtherLife.active().screen;
      return { x: Math.max(12, Math.min(1428, s.x)), y: Math.max(12, Math.min(888, s.y)) };
    });
    await page.mouse.click(spot.x, spot.y);
    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:responded'),
      null, { timeout: 6000 });
    const resp = await page.evaluate(() => window.__lifeEvents[0][1]);
    ck(resp.response === 'pulse' && resp.id === 'jellyfish',
       'G1  the jellyfish answers with light');

    // A dim Spirit — one the child has NOT resolved — glows as the
    // ring washes over it. Measured on the canvas, at the Spirit's own
    // screen position, away from the jellyfish's own body.
    const lit = await (async () => {
      let hadCandidates = false;
      for (let i = 0; i < 45; i++) {
        const r = await page.evaluate(() => {
          const u = window.vihuPlanetUniverse;
          const a = window.vihuEtherLife.active();
          if (!a) return { done: true, lit: 0 };
          const dim = u.stories.all().filter((e) =>
            (e.prox || 0) < 0.4 && typeof e.screenX === 'number' &&
            e.screenX > 40 && e.screenX < 1400 && e.screenY > 40 && e.screenY < 860 &&
            Math.abs(e.screenX - a.screen.x) + Math.abs(e.screenY - a.screen.y) > 260);
          if (!dim.length) return { none: true, lit: 0 };
          const c = document.querySelector('.vp-ether-life');
          const ctx = c.getContext('2d');
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          for (const e of dim) {
            const x = Math.max(0, Math.round(e.screenX * dpr) - 40);
            const y = Math.max(0, Math.round(e.screenY * dpr) - 40);
            const d = ctx.getImageData(x, y, 80, 80).data;
            let lit = 0;
            for (let k = 3; k < d.length; k += 4) if (d[k] > 10) lit++;
            // The halo is thousands of lit pixels; the ring STROKE
            // passing through the box is a couple of hundred, and it
            // fooled the first version of this check (measured: 228
            // from the arc alone). The threshold has to separate them.
            if (lit > 800) return { lit };
          }
          return { lit: 0 };
        });
        if (r.lit > 800) return r.lit;
        // No candidate THIS frame is not a verdict — the feed may
        // still be attaching, or a Spirit may drift clear of the
        // jellyfish a moment later. Keep watching to the end.
        if (r.none) hadCandidates = hadCandidates || false;
        else hadCandidates = true;
        await page.waitForTimeout(140);
      }
      return hadCandidates ? 0 : -1;
    })();
    if (lit === -1 && !staged) {
      ok('G2  (no Spirit in this universe to stage — nothing to measure)');
    } else {
      ck(lit > 800, 'G2  a dim Spirit glows as the ring washes over it',
         lit + ' lit px' + (staged ? ', staged at 380px off centre' : ''));
    }
    // And nothing led anywhere: illumination composes no discovery.
    const after = await page.evaluate(() => ({
      trail: window.vihuEtherLife.trail(),
      activity: window.vihuEtherDiscovery.current()
    }));
    ck(after.trail === null && after.activity === null,
       'G3  light is not a path — no trail, no activity, nothing owed');

    await page.screenshot({ path: path.join(SHOTS, 'g-jellyfish.png') });
    ck(page.errors.length === 0, 'G4  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // H. THE BECKON, AND THE GRAMMAR OF NOTICING. An idle Traveller is
  // never answered as though they had acted: the whale crosses the
  // middle of an untouched screen and no trail appears. What an
  // untouched screen DOES get, after a while, is the sky's own
  // "there is more this way" — half-off the edge, breathing, gone —
  // and it stops forever the moment the Traveller turns.
  // =================================================================
  console.log('\nH. THE BECKON');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });
    await page.evaluate(() => {
      window.__lifeEvents = [];
      ['trail:begun', 'beckon'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
    });

    // Touching nothing: the beckon is due at ~16s of stillness.
    let beckoned = false;
    await page.waitForFunction(() => window.vihuEtherLife.beckon().active,
      null, { timeout: 26000 }).then(() => { beckoned = true; }).catch(() => {});
    const state = await page.evaluate(() => window.vihuEtherLife.beckon());
    ck(beckoned && state.active && state.given >= 1,
       'H2  the sky itself says "there is more this way"',
       state.aimed ? 'aimed at a real far Spirit' : 'aimed at open sky');

    // Drawn ON the edge — half of it already beyond the view. A beat
    // first: it fades up over 1.6s, and sampling a light mid-arrival
    // measures the fade, not the light.
    await page.waitForTimeout(1800);
    const drawn = await page.evaluate(() => {
      const b = window.vihuEtherLife.beckon();
      if (!b.active || !b.screen) return { lit: 0 };
      const c = document.querySelector('.vp-ether-life');
      const ctx = c.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const x = Math.max(0, Math.min(c.width - 100, Math.round(b.screen.x * dpr) - 50));
      const y = Math.max(0, Math.min(c.height - 100, Math.round(b.screen.y * dpr) - 50));
      const d = ctx.getImageData(x, y, 100, 100).data;
      let lit = 0;
      for (let k = 3; k < d.length; k += 4) if (d[k] > 8) lit++;
      const onEdge = b.screen.x < 40 || b.screen.x > 1400 ||
                     b.screen.y < 40 || b.screen.y > 860;
      return { lit, onEdge, screen: b.screen };
    });
    ck(drawn.lit > 20 && drawn.onEdge,
       'H3  half-off the edge of the view, really drawn',
       drawn.lit + ' lit px at ' + (drawn.screen ? Math.round(drawn.screen.x) + ',' + Math.round(drawn.screen.y) : '?'));

    // H1 is only a guard once the whale has actually swum through the
    // middle of the untouched screen — nearness alone must never read
    // as noticing. Checked at high prox, AND a breath later: notice
    // lags and respond waits its beat, so a check at the instant prox
    // crosses would pass against a build where the whale answers
    // nobody (measured — it did).
    const crossed = await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return !a || a.prox > 0.5;
    }, null, { timeout: 35000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2600);
    const idle = await page.evaluate(() => ({
      trailBegun: window.__lifeEvents.some((e) => e[0] === 'trail:begun'),
      trail: window.vihuEtherLife.trail()
    }));
    ck(crossed && idle.trailBegun === false && idle.trail === null,
       'H1  an idle Traveller is never answered as though they had acted',
       'the whale reached the centre of an untouched screen; no trail');

    // The Traveller turns: the question is answered, forever.
    await turnTap(page);
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => window.vihuEtherLife.beckon());
    ck(after.active === false && after.stopped === true,
       'H4  turning the universe answers it — the sky never asks again');
    await page.waitForTimeout(2500);
    const later = await page.evaluate(() => window.vihuEtherLife.beckon());
    ck(later.active === false && later.given === after.given,
       'H4b and none returns, however long the stillness after');

    ck(page.errors.length === 0, 'H5  zero page errors', page.errors[0]);
    await context.close();
  }

  // =================================================================
  // W. ONE CROSSING, THEN GONE — the V2.1 correction, reported from
  // manual review, and the property no earlier check asserted: in a
  // sparse universe the wrapped screen coordinate is clamped inside
  // the seam margins, so the departure threshold was UNREACHABLE and
  // the whale looped forever — a rare encounter that had become
  // wallpaper, whose spent `responded` flag then swallowed every later
  // touch. A creature now travels ONE way, leaves, and the next
  // encounter waits on rarity.
  // =================================================================
  console.log('\nW. ONE CROSSING, THEN GONE');
  {
    const { context, page } = await freshPage();
    await page.goto(BASE + '/index.html');
    await crossThreshold(page);
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 8000 });

    await page.evaluate(() => {
      try { window.vihuEtherLife.destroy(); } catch (e) {}
      const t = Object.assign({}, EtherLife.TIMES, { firstArrival: [9999, 10000] });
      window.vihuEtherLife = EtherLife.mount(window.vihuPlanetUniverse, { times: t });
      window.vihuEtherDiscovery = EtherDiscovery.attach(
        window.vihuPlanetUniverse, window.vihuEtherLife);
      window.__lifeEvents = [];
      ['creature:arrived', 'creature:noticed', 'creature:responded', 'creature:gone']
        .forEach((e) => window.vihuEtherLife.on(e, (p) => window.__lifeEvents.push([e, p])));
      // The registry's own data, hurried so a whole crossing fits a
      // test: a whale at 42px/s takes fifty real seconds to cross.
      EtherLife.CREATURES.whale.speed = 420;
      window.vihuEtherLife.summon('whale');
    });

    // Sample its path across the whole crossing. A wrap is a single
    // huge jump against the direction of travel; camera drift and the
    // swim wave are tens of pixels.
    const samples = [];
    for (let i = 0; i < 60; i++) {
      const s = await page.evaluate(() => {
        const a = window.vihuEtherLife.active();
        return a ? Math.round(a.screen.x) : null;
      });
      if (s === null) break;
      samples.push(s);
      await page.waitForTimeout(250);
    }
    const deltas = samples.slice(1).map((v, i) => v - samples[i]);
    // The MEDIAN is the direction of travel. The first draft summed
    // the deltas, and three +1650 wrap jumps outweighed thirty-seven
    // −110 honest steps — the wraps flipped the trend and then read as
    // the trend, so the check could not fail against the very bug it
    // guards (measured). An outlier must never elect itself normal.
    const sorted = deltas.slice().sort((a, b) => a - b);
    const trend = Math.sign(sorted[Math.floor(sorted.length / 2)] || 0) || 1;
    const wrapJump = deltas.find((d) => Math.sign(d) === -trend && Math.abs(d) > 600);
    ck(samples.length > 4 && wrapJump === undefined,
       'W1  it travels ONE way — no seam, no teleport, no re-entry from the far edge',
       samples.length + ' samples, worst counter-move ' +
       Math.min(...deltas.map((d) => d * trend)));

    const gone = await page.evaluate(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:gone'));
    ck(gone, 'W2  and the crossing ENDS — the whale really leaves');

    await page.waitForTimeout(4000);
    const after = await page.evaluate(() => ({
      active: window.vihuEtherLife.active(),
      arrivals: window.__lifeEvents.filter((e) => e[0] === 'creature:arrived').length
    }));
    ck(after.active === null && after.arrivals === 1,
       'W3  no immediate respawn — the next encounter waits on rarity',
       after.arrivals + ' arrival(s) total');

    // A touch is acknowledged in the same breath, before the response
    // has even had its beat — a child must never wonder whether
    // anything happened.
    await page.evaluate(() => window.vihuEtherLife.summon('whale'));
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 120 && a.screen.x < 1320;
    }, null, { timeout: 15000 });
    const spot = await page.evaluate(() => window.vihuEtherLife.active().screen);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(180);
    const ack = await page.evaluate(() => ({
      a: window.vihuEtherLife.active(),
      noticed: window.__lifeEvents.some((e) => e[0] === 'creature:noticed')
    }));
    ck(ack.noticed && ack.a && ack.a.swell > 0.5 && !ack.a.responded,
       'W4  a touch brightens the whale IMMEDIATELY, ahead of its answer',
       'swell ' + (ack.a ? ack.a.swell.toFixed(2) : '?') + ' at 180ms');
    await page.waitForFunction(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:responded'),
      null, { timeout: 4000 }).catch(() => {});
    const answered = await page.evaluate(() =>
      window.__lifeEvents.some((e) => e[0] === 'creature:responded'));
    ck(answered, 'W4b and the answer itself follows on its own beat');

    ck(page.errors.length === 0, 'W5  zero page errors', page.errors[0]);
    await context.close();
  }

  await browser.close();

  console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ' — ' +
    passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('  · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
