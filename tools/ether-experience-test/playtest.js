/* THE MANUAL PLAYTEST — Ether Experience Architecture, four horizons.
 *
 * Not a unit suite: a scripted stand-in for a child at the keyboard,
 * driving the product only the way a child does — the threshold
 * clicked, turning by real held arrow keys, creatures clicked with
 * the mouse — screenshotting every beat so a person can review what
 * the Traveller actually saw, and printing the composer's own
 * timeline at the end so the sequence can be judged as an EXPERIENCE.
 *
 *   Horizon A —   0–20 s   does something make me want to look?
 *   Horizon B —  20 s–5 m  did exploring actually reveal something?
 *   Horizon C —  5–20 m    is there more depth than I first understood?
 *                          (real time — this is the long real session)
 *   Horizon D —  20–60 m   can I predict the Ether? (the answer must
 *                          be no) — REAL TIME when run with HOUR=1,
 *                          otherwise the composed hour is exercised by
 *                          the suite's pumped-clock harness (M2/M3)
 *                          and this horizon extends C's evidence.
 *
 * State reads are observation only — the same glance a tester gives
 * the console. Nothing is summoned, remounted or reconfigured.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8792 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-experience-test/playtest.js [--minutes=20]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:' + (process.env.ETHER_PORT || 8792);
const SHOTS = path.join(__dirname, 'shots', 'playtest');
const MINUTES = Number((process.argv.find((a) => a.startsWith('--minutes=')) || '').split('=')[1] || 20);
let notes = [];
function note(s) { notes.push(s); console.log('  ' + s); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('[data-begin]', { timeout: 20000 });
  const t0 = Date.now();
  await page.click('[data-begin]');
  await page.waitForFunction(() => !!window.vihuEtherComposer, null, { timeout: 15000 });
  await page.evaluate(() => {
    window.__beats = [];
    const push = (k) => (p) => window.__beats.push([Date.now(), k, p || null]);
    ['creature:arrived', 'creature:noticed', 'creature:responded',
     'creature:gone', 'trail:begun', 'trail:found', 'trail:faded',
     'beckon', 'bloom', 'mark'].forEach((e) =>
      window.vihuEtherLife.on(e, push(e)));
  });
  const secs = () => ((Date.now() - t0) / 1000).toFixed(0);
  const shoot = (name) => page.screenshot({ path: path.join(SHOTS, name) });
  const beats = () => page.evaluate(() => window.__beats.map((b) => b[1]));
  const active = () => page.evaluate(() =>
    window.vihuEtherLife.active());

  // A child's gestures, real input only.
  async function turnBriefly(key, ms) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  }
  async function turnToward(getSpot, maxSteps) {
    for (let i = 0; i < (maxSteps || 30); i++) {
      const s = await page.evaluate(getSpot);
      if (!s) return false;
      const dx = s.x - 720, dy = s.y - 450;
      if (Math.abs(dx) < 110 && Math.abs(dy) < 110) return true;
      const key = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft')
        : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await turnBriefly(key, 300);
    }
    return false;
  }

  // ================================================================
  console.log('\nHORIZON A — the first twenty seconds (real time)');
  {
    await page.waitForTimeout(Math.max(0, 8000 - (Date.now() - t0)));
    await shoot('A-08s.png');
    await page.waitForFunction(() => !!window.vihuEtherLife.active(),
      null, { timeout: 16000 }).catch(() => {});
    const a = await active();
    note('A ' + secs() + 's: ' + (a
      ? 'a ' + a.id + ' is crossing — something to look at, unasked'
      : 'NOTHING on the sky yet — the hook missed the window'));
    await page.waitForTimeout(Math.max(0, 20000 - (Date.now() - t0)));
    await shoot('A-20s.png');
  }

  // ================================================================
  console.log('\nHORIZON B — to five minutes: explore, and be answered');
  {
    // The child notices the first creature by turning toward it, and
    // follows whatever it offers.
    const met = await turnToward(() => {
      const a = window.vihuEtherLife.active();
      return a ? a.screen : null;
    });
    note('B ' + secs() + 's: turned toward the crossing — ' + (met ? 'met it' : 'it had gone'));
    await page.waitForTimeout(2500);
    let tr = await page.evaluate(() => window.vihuEtherLife.trail());
    if (!tr) {
      const a = await active();
      if (a && !a.responded) {
        await page.mouse.click(
          Math.max(10, Math.min(1430, a.screen.x)),
          Math.max(10, Math.min(890, a.screen.y)));
        await page.waitForTimeout(2000);
        tr = await page.evaluate(() => window.vihuEtherLife.trail());
      }
    }
    if (tr) {
      note('B ' + secs() + 's: it answered — a trail toward a ' + tr.target.kind);
      await shoot('B-trail.png');
      const followed = await turnToward(() => {
        const t = window.vihuEtherLife.trail();
        if (!t) return null;
        const u = window.vihuPlanetUniverse;
        const cam = u.camera.offsetFor(u.ether.depth.stories);
        const wrap = (v, span, c) => v - Math.round((v - c) / span) * span;
        return { x: wrap(t.target.x + cam.x, u.ether.width, 720),
                 y: wrap(t.target.y + cam.y, u.ether.height, 450) };
      }, 40);
      await page.waitForTimeout(2500);
      note('B ' + secs() + 's: followed the trail — ' +
           (followed ? 'and arrived at the far end' : 'and lost it'));
      await shoot('B-found.png');
    } else {
      const a = await active();
      note('B ' + secs() + 's: this one ' + (a && a.responded
        ? 'answered without leading anywhere (' + (a.respondMode || a.response) + ') — a mystery kept'
        : 'offered nothing yet — the sky is patient'));
      await shoot('B-unresolved.png');
    }
    // Wander a little, then rest, the way a child does.
    await turnBriefly('ArrowRight', 1800);
    await page.waitForTimeout(4000);
    await turnBriefly('ArrowLeft', 900);
    await page.waitForTimeout(Math.max(0, 300000 - (Date.now() - t0)));
    const ph = await page.evaluate(() => window.vihuEtherComposer.phase());
    const st = await page.evaluate(() => window.vihuEtherComposer.state());
    note('B 300s: phase ' + ph + ' · found ' + st.found +
         ' · sectors ' + st.sectorsVisited + ' · events so far: ' +
         (await beats()).join(' → '));
    await shoot('B-5min.png');
  }

  // ================================================================
  console.log('\nHORIZON C/D — a long real sitting (' + MINUTES + ' minutes)');
  {
    // The child settles into a rhythm: look around, sit still, touch
    // what passes, drift away, come back — the composer must answer
    // with variety, quiet included, and no readable schedule.
    const endAt = t0 + MINUTES * 60000;
    let shots = 0;
    while (Date.now() < endAt) {
      const a = await active();
      if (a && !a.responded && Math.random() < 0.6) {
        // Sometimes the child goes to it; sometimes they only watch.
        const met = await turnToward(() => {
          const x = window.vihuEtherLife.active();
          return x ? x.screen : null;
        }, 18);
        if (met && Math.random() < 0.5) {
          const s = await active();
          if (s) await page.mouse.click(
            Math.max(10, Math.min(1430, s.screen.x)),
            Math.max(10, Math.min(890, s.screen.y)));
        }
        await shoot('C-event-' + (++shots) + '.png');
      } else if (Math.random() < 0.35) {
        await turnBriefly(Math.random() < 0.5 ? 'ArrowRight' : 'ArrowLeft',
                          600 + Math.random() * 1600);
      }
      // Follow any live trail to its end, most of the time.
      const tr = await page.evaluate(() => window.vihuEtherLife.trail());
      if (tr && tr.state === 'guiding' && Math.random() < 0.7) {
        await turnToward(() => {
          const t = window.vihuEtherLife.trail();
          if (!t) return null;
          const u = window.vihuPlanetUniverse;
          const cam = u.camera.offsetFor(u.ether.depth.stories);
          const wrap = (v, span, c) => v - Math.round((v - c) / span) * span;
          return { x: wrap(t.target.x + cam.x, u.ether.width, 720),
                   y: wrap(t.target.y + cam.y, u.ether.height, 450) };
        }, 40);
        await shoot('C-followed-' + (++shots) + '.png');
      }
      await page.waitForTimeout(4000 + Math.random() * 9000);
    }
    await shoot('C-end.png');

    // The verdicts, judged from what actually happened.
    const timeline = await page.evaluate(() => window.__beats.map((b) =>
      [((b[0]) / 1000), b[1]]));
    const hist = await page.evaluate(() => window.vihuEtherComposer.history());
    const st = await page.evaluate(() => window.vihuEtherComposer.state());
    const led = await page.evaluate(() => window.vihuEtherComposer.ledger());
    const diag = await page.evaluate(() => {
      const d = window.vihuEtherComposer.diagnostics();
      return { decisions: d.decisions.length,
               quiets: d.decisions.filter((x) => x.chosen === 'quiet').length };
    });

    console.log('\n  — the sitting, as the composer lived it —');
    hist.forEach((h) => console.log('    ' + String(h.t).padStart(7) + 's  ' +
      h.pattern + (h.family && h.pattern.indexOf(h.family) === -1 ? ':' + h.family : '') +
      '  → ' + h.outcome + '  [' + h.interaction + ' / ' + h.depth + ']'));

    const patterns = new Set(hist.map((h) => h.pattern));
    let consec = 0;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].pattern === hist[i - 1].pattern) consec++;
    }
    const ts = hist.map((h) => h.t);
    const gaps = []; for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (gaps.length || 1));

    note('C/D ' + secs() + 's: ' + hist.length + ' experiences · ' +
         patterns.size + ' patterns · ' + consec + ' consecutive repeats');
    note('C/D gaps: mean ' + mean.toFixed(0) + 's, sd ' + sd.toFixed(0) +
         's, cv ' + (mean ? (sd / mean).toFixed(2) : '—') +
         ' — a schedule this spread cannot be recited');
    note('C/D composer: ' + diag.decisions + ' decisions, ' + diag.quiets +
         ' of them QUIET — silence chosen, not defaulted');
    note('C/D phase at the end: ' + st.found + ' found, phase ' +
         (await page.evaluate(() => window.vihuEtherComposer.phase())));
    note('C/D ledger: ' + Object.keys(led.stories).length +
         ' Stories carry a depth; creatures met: ' +
         Object.keys(led.creatures).join(', '));
    note('C/D page errors: ' + page.errors.length);
  }

  fs.writeFileSync(path.join(SHOTS, 'playtest-notes.txt'), notes.join('\n') + '\n');
  await browser.close();
  console.log('\nDone — review the screenshots and the timeline above as an EXPERIENCE.');
  console.log('shots: ' + SHOTS);
})().catch((e) => { console.error(e); process.exit(1); });
