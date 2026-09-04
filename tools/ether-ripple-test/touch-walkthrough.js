// touch-walkthrough.js — the 13-step manual touch test, as a committed
// harness (the ether-life walkthrough's own precedent: a scripted
// stand-in for a person, driving the product only the way a child
// does, screenshotting every beat).
//
// HONEST DISCLOSURE, printed as well as written: this environment has
// no touch hardware. Every gesture here is Chromium touch EMULATION
// over real device profiles — real touchstart/touchmove/touchend
// through the CDP, real taps through the emulated touchscreen — and
// nothing in its results claims a finger on glass. What it proves is
// the product's own handling of the events a finger produces.
//
// The thirteen steps, per touch profile:
//   1 fresh Traveller arrives          8 swipe-after-tap turns, no ripple
//   2 the nudge appears (swipe words)  9 a Spirit tap opens the Spirit
//   3 a swipe turns the sky           10 a creature answers its own tap
//   4 the nudge goes, and stays gone  11 minutes of exploring stay smooth
//   5 a tap ripples                   12 rotate: everything re-fits
//   6 ...from the touched place       13 resume: swipe and tap still work
//   7 a second tap ripples again
//
// Run: node tools/ether-ripple-test/touch-walkthrough.js
// Env: ETHER_RIPPLE_PORT (default 8903, the suite's own port),
//      EXPLORE_S (step 11's exploring time, default 90 seconds).
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = Number(process.env.ETHER_RIPPLE_PORT || 8903);
const BASE = 'http://127.0.0.1:' + PORT;
const EXPLORE_S = Number(process.env.EXPLORE_S || 90);
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PROFILES = [
  { name: 'phone-portrait', dpr: 3, w: 390, h: 844 },
  { name: 'small-tablet-portrait', dpr: 2, w: 768, h: 1024 },
  { name: 'tablet-landscape', dpr: 2, w: 1024, h: 768 }
];

let passed = 0, failed = 0;
const failures = [];
function ck(cond, name, note) {
  if (cond) { passed++; console.log('  ok   ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(name); console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

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
const touchesOf = (page) =>
  page.evaluate(() => window.vihuEtherRipple.touches());

async function frameStats(page, seconds) {
  return page.evaluate((secs) => new Promise((resolve) => {
    const deltas = []; let last = null;
    function tick(now) {
      if (last !== null) deltas.push(now - last);
      last = now;
      if (deltas.length && deltas.reduce((a, b) => a + b, 0) > secs * 1000) {
        deltas.sort((a, b) => a - b);
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        resolve({ fps: +(1000 / avg).toFixed(1),
                  p95Ms: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1) });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), seconds);
}

// An empty-sky point inside the dead zone: probe a grid for a spot
// whose element is the universe root or one of its canvases — and
// never inside a passing creature's hit box, because a tap there is
// the creature's (the natural first whale crossing overlaps step 5's
// timing on a narrow phone, and a harness must tap like a child who
// is aiming at empty sky).
async function skySpot(page) {
  return page.evaluate(() => {
    const w = innerWidth, h = innerHeight;
    let box = null;
    try {
      const a = window.vihuEtherLife && window.vihuEtherLife.active &&
        window.vihuEtherLife.active();
      if (a) {
        const CR = window.EtherLife && window.EtherLife.CREATURES;
        const span = (CR && CR[a.id] && CR[a.id].span) || 300;
        box = { x: a.screen.x, y: a.screen.y, hw: span * 0.55, hh: span * 0.55 * 0.7 };
      }
    } catch (e) {}
    for (const fx of [0.5, 0.42, 0.58, 0.36, 0.64]) {
      for (const fy of [0.38, 0.3, 0.46, 0.25]) {
        const x = w * fx, y = h * fy;
        if (box && Math.abs(x - box.x) < box.hw + 20 &&
            Math.abs(y - box.y) < box.hh + 20) continue;
        const el = document.elementFromPoint(x, y);
        if (!el) continue;
        if (el.closest && (el.closest('.vp-story') || el.closest('button') ||
            el.closest('.vp-actions'))) continue;
        return { x, y };
      }
    }
    return null;
  });
}

async function run(profile) {
  console.log('\n=== ' + profile.name + ' (' + profile.w + 'x' + profile.h +
              ' @' + profile.dpr + 'x, Chromium touch emulation) ===');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const context = await browser.newContext({
    viewport: { width: profile.w, height: profile.h },
    deviceScaleFactor: profile.dpr, hasTouch: true, isMobile: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot(
    { path: path.join(SHOTS, 'walk-' + profile.name + '-' + n + '.png') });

  // 1 — a fresh Traveller arrives, through the one threshold.
  await page.goto(BASE + '/index.html');
  await page.waitForSelector('[data-begin]', { timeout: 20000 });
  await shot('01-threshold');
  await page.tap('[data-begin]');
  await page.waitForFunction(() => !!window.vihuEtherRipple, null, { timeout: 15000 });
  ck(true, '1  a fresh Traveller crosses the threshold by tapping');

  // 2 — the nudge appears with the swipe words (the arrival turn runs
  // ~4.2–6.5s; the nudge waits on ~7s of stillness after it).
  await page.waitForSelector('[data-nudge].is-in', { timeout: 16000 }).catch(() => {});
  const nudge = await page.evaluate(() => {
    const el = document.querySelector('[data-nudge]');
    return el ? el.querySelector('.vp-explore-nudge-hint').textContent : null;
  });
  await shot('02-nudge');
  ck(nudge === '(Swipe to explore)', '2  the invitation appears, worded for a finger', nudge);

  // 3 — a swipe turns the sky.
  const y0 = await yawOf(page);
  await touchDrag(page, { x: profile.w * 0.7, y: profile.h * 0.5 },
                  { x: profile.w * 0.25, y: profile.h * 0.5 }, 12, 16);
  await page.waitForTimeout(400);
  const y1 = await yawOf(page);
  ck(Math.abs(y1 - y0) > 30, '3  a swipe turns the universe',
     Math.round(Math.abs(y1 - y0)) + 'px');
  ck(await touchesOf(page) === 0, '3b and the swipe made no ripple');

  // 4 — exploring answered the invitation; it goes and stays gone.
  await page.waitForTimeout(1500);
  const gone = await page.evaluate(() => !document.querySelector('[data-nudge]'));
  await page.waitForTimeout(9000);
  const stillGone = await page.evaluate(() => !document.querySelector('[data-nudge]'));
  ck(gone && stillGone, '4  the invitation goes at once and never returns');

  // 5/6 — a tap ripples, from the touched place. The whale's span is
  // 520px, so a crossing can blanket a 390px phone entirely for a
  // while — a child waits for it to pass and taps the empty sky they
  // can actually see, and so does the harness (and a tap in the
  // whale's drifting margin is retried rather than miscounted).
  let sky1 = null, ripple = null;
  for (let i = 0; i < 30 && !sky1; i++) {
    sky1 = await skySpot(page);
    if (!sky1) await page.waitForTimeout(1000);
  }
  ck(!!sky1, '5  there is open sky to touch');
  if (sky1) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = await touchesOf(page);
      await page.touchscreen.tap(sky1.x, sky1.y);
      await page.waitForTimeout(200);
      if (await touchesOf(page) > t0) {
        ripple = await page.evaluate(() => window.vihuEtherRipple.active()[0] || null);
        break;
      }
      await page.waitForTimeout(800);
      sky1 = await skySpot(page) || sky1;
    }
    await shot('05-ripple');
    ck(!!ripple && ripple.kind === 'wave', '5b the tap ripples');
    ck(!!ripple && Math.abs(ripple.screen.x - sky1.x) < 60 &&
       Math.abs(ripple.screen.y - sky1.y) < 60,
       '6  from the exact touched place',
       ripple && Math.round(ripple.screen.x) + ',' + Math.round(ripple.screen.y) +
       ' vs ' + Math.round(sky1.x) + ',' + Math.round(sky1.y));
  }

  // 7 — a second, unhurried tap ripples again (probed fresh: the sky
  // drifts, and a fixed offset from the first tap can land on a
  // Spirit that has wandered under it — that tap would rightly be the
  // Spirit's).
  await page.waitForTimeout(700);
  const t7a = await touchesOf(page);
  let done7 = false;
  for (let attempt = 0; attempt < 3 && !done7; attempt++) {
    const sky2 = await skySpot(page);
    if (sky2) {
      await page.touchscreen.tap(sky2.x, sky2.y);
      await page.waitForTimeout(200);
      done7 = await touchesOf(page) > t7a;
    }
    if (!done7) await page.waitForTimeout(900);
  }
  ck(done7, '7  a second tap is answered too');

  // 8 — a swipe straight after a tap still turns, and never ripples.
  const y8 = await yawOf(page);
  const t8 = await touchesOf(page);
  await touchDrag(page, { x: profile.w * 0.3, y: profile.h * 0.55 },
                  { x: profile.w * 0.72, y: profile.h * 0.55 }, 10, 16);
  await page.waitForTimeout(400);
  ck(Math.abs(await yawOf(page) - y8) > 30 && await touchesOf(page) === t8,
     '8  swipe-after-tap turns the sky and makes no ripple');

  // 9 — a tap on a Spirit belongs to the Spirit. A sparse sky on a
  // narrow view may be facing empty space, so the harness does what a
  // child does: swipes around until a Story drifts into view.
  const findSpirit = () => page.evaluate(() => {
    const w = innerWidth, h = innerHeight;
    for (let fx = 0.15; fx <= 0.85; fx += 0.07) {
      for (let fy = 0.15; fy <= 0.75; fy += 0.08) {
        const el = document.elementFromPoint(w * fx, h * fy);
        if (el && el.closest && el.closest('.vp-story')) {
          return { x: w * fx, y: h * fy };
        }
      }
    }
    return null;
  });
  let spirit = await findSpirit();
  for (let i = 0; i < 8 && !spirit; i++) {
    await touchDrag(page, { x: profile.w * 0.75, y: profile.h * 0.5 },
                    { x: profile.w * 0.2, y: profile.h * 0.5 }, 8, 16);
    await page.waitForTimeout(1200);
    spirit = await findSpirit();
  }
  if (!spirit) {
    ck(false, '9  no Spirit drifted into view to tap');
  } else {
    await page.touchscreen.tap(spirit.x, spirit.y);
    await page.waitForTimeout(900);
    const open = await page.evaluate(() => window.vihuPlanetUniverse.focus.isOpen());
    await shot('09-spirit');
    ck(open, '9  a tap on a Spirit opens the Spirit');
    // ...and the sky tap that sends it home does not ripple.
    const t9 = await touchesOf(page);
    await page.touchscreen.tap(profile.w * 0.5, profile.h * 0.12);
    await page.waitForTimeout(1200);
    ck(await touchesOf(page) === t9, '9b the closing sky-tap does not also ripple');
    await page.waitForTimeout(1500);
  }

  // 10 — a creature answers its own tap; the sky stays quiet. A
  // natural crossing may still be up this far into a visit, and one
  // being at a time is the layer's own rule — wait it out first.
  await page.waitForFunction(() => !window.vihuEtherLife.active(),
    null, { timeout: 90000 }).catch(() => {});
  await page.evaluate(() => {
    window.__noticed = 0;
    window.vihuEtherLife.on('creature:noticed', () => { window.__noticed++; });
    window.vihuEtherLife.summon('whale', { respond: 'default', speed: 1.6 });
  });
  const onscreen = await page.waitForFunction(() => {
    const a = window.vihuEtherLife.active();
    return a && a.screen.x > 80 && a.screen.x < innerWidth - 80 &&
           a.screen.y > 60 && a.screen.y < innerHeight - 60;
  }, null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!onscreen) {
    ck(false, '10 the summoned whale never crossed the view');
  } else {
    // The whale is 520px wide and a Spirit may be drifting in front
    // of parts of it — probe a spread of points, and give the
    // crossing a few moments to clear whatever blocks every one.
    let spot = null;
    for (let i = 0; i < 10 && !spot; i++) {
      spot = await page.evaluate(() => {
        const a = window.vihuEtherLife.active();
        if (!a) return null;
        const tries = [[0, 0], [-80, 0], [80, 0], [0, -40], [0, 40],
                       [-150, 0], [150, 0], [-80, -50], [80, 50]];
        for (const t of tries) {
          const x = a.screen.x + t[0], y = a.screen.y + t[1];
          if (x < 20 || x > innerWidth - 20 || y < 20 || y > innerHeight - 20) continue;
          const el = document.elementFromPoint(x, y);
          if (el && el.closest && el.closest('.vp-story')) continue;
          return { x, y };
        }
        return null;
      });
      if (!spot) await page.waitForTimeout(700);
    }
    if (!spot) {
      ck(false, '10 no clear point on the whale to tap');
    } else {
      const t10 = await touchesOf(page);
      await page.touchscreen.tap(spot.x, spot.y);
      await page.waitForTimeout(500);
      await shot('10-whale');
      const seen = await page.evaluate(() => window.__noticed);
      const t10b = await touchesOf(page);
      ck(seen >= 1 && t10b === t10,
         '10 a tap on the whale is the whale\'s, and the sky stays quiet',
         'noticed ' + seen + ', touches ' + t10 + ' -> ' + t10b);
    }
  }

  // 11 — minutes of ordinary exploring: swipes, pauses, a tap or two.
  // Frame pacing must not degrade and the DOM must not grow.
  const fps0 = await frameStats(page, 6);
  const dom0 = await page.evaluate(() => document.querySelectorAll('*').length);
  const rounds = Math.max(4, Math.floor(EXPLORE_S / 8));
  for (let i = 0; i < rounds; i++) {
    const dir = i % 2 ? 1 : -1;
    await touchDrag(page,
      { x: profile.w * (0.5 - dir * 0.22), y: profile.h * 0.5 },
      { x: profile.w * (0.5 + dir * 0.22), y: profile.h * 0.5 }, 8, 16);
    await page.waitForTimeout(5200);
    if (i % 3 === 2) {
      const s = await skySpot(page);
      if (s) await page.touchscreen.tap(s.x, s.y);
    }
  }
  const fps1 = await frameStats(page, 6);
  const dom1 = await page.evaluate(() => document.querySelectorAll('*').length);
  // NO DEGRADATION is the assertion, deliberately not an absolute
  // fps: this build container renders tablet-sized canvases in
  // software with no GPU, so an absolute floor here would measure the
  // container, not the product. The numbers are printed so a run on
  // real hardware reads them directly.
  ck(fps1.fps > fps0.fps * 0.75 &&
     fps1.p95Ms <= Math.max(40, fps0.p95Ms * 1.6),
     '11 minutes of exploring do not degrade the frame clock',
     fps0.fps + ' -> ' + fps1.fps + ' fps, p95 ' + fps0.p95Ms + ' -> ' +
     fps1.p95Ms + 'ms');
  ck(Math.abs(dom1 - dom0) <= 12, '11b and the DOM does not grow',
     dom0 + ' -> ' + dom1 + ' nodes');

  // 12 — rotate. No forced-orientation screen; everything re-fits.
  await page.setViewportSize({ width: profile.h, height: profile.w });
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => {
    const a = document.querySelector('[data-actions]');
    const r = a ? a.getBoundingClientRect() : null;
    const overlays = Array.from(document.querySelectorAll('.vp-device-gate, [data-rotate]'))
      .filter((el) => el.offsetParent !== null);
    return {
      actionsFit: !!r && r.bottom <= innerHeight + 1 && r.left >= -1 &&
                  r.right <= innerWidth + 1,
      forcedScreens: overlays.length,
      canvas: (document.querySelector('.vp-ether-ripple') || {}).width
    };
  });
  await shot('12-rotated');
  ck(fit.actionsFit && fit.forcedScreens === 0,
     '12 rotated: the actions re-fit and nothing demands an orientation',
     JSON.stringify(fit));

  // 13 — resume: both gestures still work in the new orientation.
  const y13 = await yawOf(page);
  await touchDrag(page, { x: profile.h * 0.7, y: profile.w * 0.5 },
                  { x: profile.h * 0.3, y: profile.w * 0.5 }, 10, 16);
  await page.waitForTimeout(400);
  const turned = Math.abs(await yawOf(page) - y13) > 30;
  const t13 = await touchesOf(page);
  const s13 = await skySpot(page);
  if (s13) await page.touchscreen.tap(s13.x, s13.y);
  await page.waitForTimeout(700);
  const rippled = await touchesOf(page) === t13 + 1;
  await shot('13-resumed');
  ck(turned && rippled, '13 after rotating, a swipe still turns and a tap still ripples',
     'turned ' + turned + ', rippled ' + rippled);
  ck(errors.length === 0, '13b zero page errors across all thirteen steps', errors[0]);

  await browser.close();
}

(async () => {
  // The suite's own rule: the thing under test is the thing SERVED.
  await new Promise((resolve, reject) => {
    http.get(BASE + '/version.txt', (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => { console.log('served build: ' + s.trim()); resolve(); });
    }).on('error', () => {
      reject(new Error('no server on ' + BASE + ' — start one from this tree first'));
    });
  });
  console.log('NOTE: Chromium touch emulation over device profiles.');
  console.log('      No touch hardware exists here and none is claimed.');
  for (const p of PROFILES) await run(p);
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) { console.log('Failures:'); failures.forEach((f) => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
