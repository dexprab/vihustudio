/* THE MANUAL ACCEPTANCE WALKTHROUGH — Ether V2.1, §9 of the brief.
 *
 * Not a unit suite: a scripted stand-in for a person at the keyboard.
 * It drives the product ONLY the way a child does — the threshold is
 * clicked with the mouse, turning is real held arrow keys, the whale
 * is clicked with the mouse — and it never summons, remounts, or
 * reconfigures anything. State reads are observation only (the same
 * glance a tester gives the console), and every beat is screenshotted
 * so a person can review what the Traveller actually saw.
 *
 *   Test A+D  passive: whale appears once, crosses, never responds,
 *             leaves, does not come back
 *   Test B    turn toward it with the arrow keys → noticed →
 *             responded → guide-motes
 *   Test C    click it → immediate brightening → response → motes
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8792 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-life-test/walkthrough.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:' + (process.env.ETHER_PORT || 8792);
const SHOTS = path.join(__dirname, 'shots', 'walkthrough');
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });

  async function freshTraveller() {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    await page.goto(BASE + '/index.html');
    // The one threshold, crossed the way a child crosses it: a click.
    await page.waitForSelector('[data-begin]', { timeout: 20000 });
    await page.click('[data-begin]');
    await page.waitForFunction(() => !!window.vihuEtherLife, null, { timeout: 15000 });
    await page.evaluate(() => {
      window.__ev = [];
      ['creature:arrived', 'creature:noticed', 'creature:responded',
       'creature:gone', 'trail:begun'].forEach((e) =>
        window.vihuEtherLife.on(e, (p) => window.__ev.push([e, Date.now()])));
    });
    return { context, page };
  }

  const seen = (page, e) => page.evaluate((x) =>
    window.__ev.some((r) => r[0] === x), e);
  const whale = (page) => page.evaluate(() => window.vihuEtherLife.active());

  // ================================================================
  console.log('\nTEST A + D — PASSIVE. Hands off, the whole visit.');
  {
    const { context, page } = await freshTraveller();
    await page.waitForFunction(() => !!window.vihuEtherLife.active(),
      null, { timeout: 16000 }).catch(() => {});
    const a1 = await whale(page);
    ck(!!a1 && a1.id === 'whale', 'A1  the whale appears, once, on its own time');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SHOTS, 'A-entering.png') });

    // Let the whole crossing play out, touching nothing.
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 500 && a.screen.x < 940;
    }, null, { timeout: 40000 }).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, 'A-crossing.png') });

    await page.waitForFunction(() =>
      window.__ev.some((r) => r[0] === 'creature:gone'), null, { timeout: 75000 })
      .catch(() => {});
    const goneAt = await seen(page, 'creature:gone');
    ck(goneAt, 'A2  it crosses the field once and LEAVES');
    ck(!(await seen(page, 'creature:responded')) && !(await seen(page, 'trail:begun')),
       'A3  a passive Traveller is never answered — no response, no trail');

    // And it stays gone: no wrap, no immediate re-entry.
    await page.waitForTimeout(15000);
    const later = await page.evaluate(() => ({
      active: window.vihuEtherLife.active(),
      arrivals: window.__ev.filter((r) => r[0] === 'creature:arrived').length
    }));
    ck(later.active === null && later.arrivals === 1,
       'A4/D  gone means gone — the next encounter waits on rarity',
       later.arrivals + ' arrival(s) across the visit');
    await page.screenshot({ path: path.join(SHOTS, 'D-after-gone.png') });
    ck(page.errors.length === 0, 'A5  zero page errors', page.errors[0]);
    await context.close();
  }

  // ================================================================
  console.log('\nTEST B — TURN TOWARD IT. Real arrow keys, held.');
  {
    const { context, page } = await freshTraveller();
    await page.waitForFunction(() => !!window.vihuEtherLife.active(),
      null, { timeout: 16000 });

    // Turn the way a child does: hold the arrow that moves the sky
    // toward the whale, glance, correct, hold again.
    let met = false;
    for (let i = 0; i < 40 && !met; i++) {
      const a = await whale(page);
      if (!a) break;
      const dx = a.screen.x - 720, dy = a.screen.y - 450;
      if (Math.abs(dx) < 90 && Math.abs(dy) < 90) { met = true; break; }
      const key = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft')
        : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await page.keyboard.down(key);
      await page.waitForTimeout(320);
      await page.keyboard.up(key);
    }
    ck(met, 'B1  the universe can be turned until the whale is before you');

    await page.waitForFunction(() =>
      window.__ev.some((r) => r[0] === 'creature:responded'), null, { timeout: 8000 })
      .catch(() => {});
    ck(await seen(page, 'creature:noticed'), 'B2  turning toward it is what notices it');
    ck(await seen(page, 'creature:responded'), 'B3  and it answers');
    await page.waitForTimeout(2600);   // let the first motes fade up
    const trail = await page.evaluate(() => window.vihuEtherLife.trail());
    ck(!!trail && (trail.target.kind === 'story' || trail.target.kind === 'wonder'),
       'B4  the breath points at something REAL', trail && trail.target.kind +
       (trail.target.id ? ' ' + trail.target.id : ''));
    await page.screenshot({ path: path.join(SHOTS, 'B-motes.png') });
    ck(page.errors.length === 0, 'B5  zero page errors', page.errors[0]);
    await context.close();
  }

  // ================================================================
  console.log('\nTEST C — CLICK IT. A real click, one visible answer.');
  {
    const { context, page } = await freshTraveller();
    await page.waitForFunction(() => {
      const a = window.vihuEtherLife.active();
      return a && a.screen.x > 140 && a.screen.x < 1300 &&
             a.screen.y > 100 && a.screen.y < 800;
    }, null, { timeout: 30000 });
    await page.screenshot({ path: path.join(SHOTS, 'C-before-click.png') });
    const spot = await page.evaluate(() => window.vihuEtherLife.active().screen);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(250);
    const ack = await whale(page);
    ck(!!ack && ack.swell > 0.5, 'C1  the whale brightens the moment it is touched',
       'swell ' + (ack ? ack.swell.toFixed(2) : '?'));
    await page.screenshot({ path: path.join(SHOTS, 'C-acknowledged.png') });
    await page.waitForFunction(() =>
      window.__ev.some((r) => r[0] === 'creature:responded'), null, { timeout: 5000 })
      .catch(() => {});
    ck(await seen(page, 'creature:responded'), 'C2  then answers');
    await page.waitForTimeout(3200);
    const trail = await page.evaluate(() => window.vihuEtherLife.trail());
    ck(!!trail, 'C3  and the guide-motes are there', trail && trail.motes + ' motes toward ' + trail.target.kind);
    await page.screenshot({ path: path.join(SHOTS, 'C-motes.png') });
    ck(page.errors.length === 0, 'C4  zero page errors', page.errors[0]);
    await context.close();
  }

  await browser.close();
  console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('  · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
