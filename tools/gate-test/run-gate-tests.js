/* THE STUDIO'S RECOGNITION GATE — the corner case it could not answer.
 *
 * "this screen comes if i click on create story from ether and there is
 * already a logged in account. i would like to add show your stars flow
 * here also. thats to cover one corner case if creator is new to this
 * login. and back should take you back to ether." — the product owner.
 *
 * The sky grid can only offer skies found on THIS device, so a Creator
 * arriving on a machine that has never met them has nothing to tap:
 * every tile is somebody else's or a decoy, and three wrong tries later
 * they are a Traveller by default. Recognition of that kind lives at
 * VihuPlanet and only there (Decisions 10, 11, 16), so this hands over
 * an intent rather than growing a second copy of the flow.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/gate-test/run-gate-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = Number(process.env.GATE_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
function check(c, n, note) {
  if (c) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  // A fake camera, so the real openCamera()/scan() path runs rather
  // than being skipped as "no camera" — the point is that the flow
  // opens HERE, and that cannot be measured without one.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  console.log('\nTHE RECOGNITION GATE\n');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCardUI !== 'undefined' && typeof MagicCard !== 'undefined',
    null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    const gw = document.getElementById('gatewayOverlay'); if (gw) gw.style.display = 'none';
  });
  await page.waitForTimeout(400);

  // The real screen, reached the way the Gateway reaches it.
  await page.evaluate(() => {
    const c = MagicCard.claim('Vihaan', null, null);
    MagicCardUI.beginCreatorSignature(c, function () {});
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, 'gate.png') });

  const screen = await page.evaluate(() => {
    const p = document.querySelector('.magic-card-gate-panel');
    const btns = Array.from(document.querySelectorAll('.magic-card-gate-notyou'))
      .map((b) => b.textContent.trim());
    return {
      prompt: /skies is yours/i.test((p || {}).innerText || ''),
      tiles: document.querySelectorAll('.magic-card-sky-card, .magic-card-sky-grid > *').length,
      btns: btns
    };
  });
  check(screen.prompt, 'G1 the sky challenge is on screen');
  check(screen.btns.some((t) => /Show me your stars/i.test(t)),
    'G2 it offers Show me your stars — the Creator this device has never met',
    screen.btns.join(' / '));
  check(screen.btns.some((t) => /Continue as a Traveller/i.test(t)),
    'G3 …and continuing as a Traveller is still reachable, in one tap not two',
    screen.btns.join(' / '));
  check(screen.btns.some((t) => /Back to the Ether/i.test(t)),
    'G4 …and Back says it leaves for the Ether', screen.btns.join(' / '));
  check(!screen.btns.some((t) => /^← Back$/.test(t)),
    'G5 the bare "← Back" that opened one more question is gone', screen.btns.join(' / '));

  // Back leaves for the Ether.
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.magic-card-gate-notyou'))
      .find((b) => /Back to the Ether/i.test(b.textContent)).click();
  });
  await page.waitForTimeout(1200);
  check(/index\.html/.test(page.url()) || !/studio\.html/.test(page.url()),
    'G6 Back actually goes to the Ether', page.url());

  // THE STARS FLOW OPENS HERE. It used to hand VihuPlanet an intent and
  // leave; the product owner overruled that — "the show me your stars
  // flow need to open camera right here not redirect to ether."
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCardUI !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => {
    const gw = document.getElementById('gatewayOverlay'); if (gw) gw.style.display = 'none';
    MagicCardUI.beginCreatorSignature(MagicCard.list()[0], function () {});
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.magic-card-gate-notyou'))
      .find((b) => /Show me your stars/i.test(b.textContent)).click();
  });
  await page.waitForTimeout(2500);
  const scan = await page.evaluate(() => {
    const w = document.querySelector('.magic-card-scan-window');
    const v = w && w.querySelector('video');
    return {
      url: window.location.pathname,
      hasWindow: !!w,
      live: !!(w && w.classList.contains('is-live')),
      playing: !!(v && v.videoWidth > 0),
      say: ((document.querySelector('.magic-card-scan-say') || {}).textContent || '').trim(),
      ways: Array.from(document.querySelectorAll('.magic-card-gate-notyou')).map((b) => b.textContent.trim())
    };
  });
  check(/studio\.html/.test(scan.url), 'G7 it never leaves the Studio', scan.url);
  check(scan.hasWindow, 'G7b the camera opens right here', JSON.stringify(scan.hasWindow));
  check(scan.live && scan.playing, 'G7c …and it is a real camera, running', JSON.stringify(scan));
  check(!/fail|invalid|not found|error/i.test(scan.say),
    'G8 the language never blames', JSON.stringify(scan.say));
  check(scan.ways.some((t) => /Back to the skies/i.test(t)),
    'G8b there is a way back to the skies', scan.ways.join(' / '));
  // Decision 16: Draw Your Stars is the way in whenever the camera
  // cannot be used, and is NEVER styled as an error state — so it is
  // there from the first second, at the same weight as Try again.
  check(scan.ways.some((t) => /Draw your stars/i.test(t)),
    'G8c ✏️ Draw your stars is offered, before anything goes wrong', scan.ways.join(' / '));
  const decor = await page.evaluate(() => {
    const w = document.querySelector('.magic-card-scan-window');
    const r = w.getBoundingClientRect();
    const hold = w.querySelector('.magic-card-scan-hold');
    const txt = (document.querySelector('.magic-card-gate-panel') || {}).innerText || '';
    return { ratio: +(r.width / r.height).toFixed(2), hold: !!hold, pct: /\d+\s*%/.test(txt) };
  });
  // 700/980 = 0.714 — the Magic Card's own shape, not a room's.
  check(Math.abs(decor.ratio - 0.714) < 0.05,
    'G8d the window is the card\'s shape, not a landscape webcam', String(decor.ratio));
  check(decor.hold, 'G8e …with somewhere to hold it');
  check(!decor.pct, 'G8f …and it never counts at the child');
  await page.screenshot({ path: path.join(SHOTS, 'scan.png') });

  // Draw your stars opens the board this file already owns.
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.magic-card-gate-notyou'))
      .find((b) => /Draw your stars/i.test(b.textContent)).click();
  });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => !!document.querySelector('.magic-card-tapgrid-board')
    && !document.querySelector('.magic-card-scan-window')),
    'G8g it opens the drawing board, and the camera is released');
  await page.screenshot({ path: path.join(SHOTS, 'draw.png') });

  // …and Back from the board returns to the skies. EXACT text: the
  // challenge's own way out reads "← Back to the Ether", and a loose
  // /← Back/ match would leave the Studio the moment the board is
  // gone — which is a race, not a test.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.magic-card-gate-notyou'))
      .find((x) => x.textContent.trim() === '← Back');
    if (b) b.click();
  });
  await page.waitForFunction(() => !!document.querySelector('.magic-card-sky-grid'),
    null, { timeout: 15000 });
  check(/studio\.html/.test(page.url()) === true, 'G8h Back from the board stays in the Studio', page.url());
  check(await page.evaluate(() => !!document.querySelector('.magic-card-sky-grid')
    && !document.querySelector('.magic-card-tapgrid-board')),
    'G8i …and returns to the four skies');

  // THE WAYS OUT ARE ONE ROW, not a stack that eats the skies' height.
  const layout = await page.evaluate(() => {
    const row = document.querySelector('.magic-card-gate-ways');
    const kids = row ? Array.from(row.children) : [];
    const tops = kids.map((k) => Math.round(k.getBoundingClientRect().top));
    const svgs = Array.from(document.querySelectorAll('.magic-card-sky-grid svg'))
      .map((s) => Math.round(s.getBoundingClientRect().width));
    return { count: kids.length, sameRow: tops.length > 1 && Math.max.apply(null, tops) - Math.min.apply(null, tops) < 12, svgs: svgs };
  });
  check(layout.count === 3 && layout.sameRow,
    'G9b the three ways out sit side by side', JSON.stringify(layout));
  check(layout.svgs.length > 0 && Math.min.apply(null, layout.svgs) >= 90,
    'G9c …so the four skies keep a size a child can tell apart', JSON.stringify(layout.svgs));

  // The fitter settles and stays settled. NOT the reported flicker —
  // that was the stale document, and this was measured with and without
  // the observer guards at two viewport sizes before saying so. This
  // check exists so a future screen that adds one more element finds
  // out here rather than in front of a child.
  await page.waitForTimeout(1500);   // let the return finish settling
  const stable = await page.evaluate(() => new Promise((res) => {
    const g = document.querySelector('.magic-card-sky-grid');
    const seen = [];
    let n = 0;
    const t = setInterval(() => {
      seen.push(Math.round(g.getBoundingClientRect().width));
      if (++n >= 12) { clearInterval(t); res(seen); }
    }, 120);
  }));
  check(new Set(stable).size === 1,
    'G9d the sky grid settles and stays settled',
    JSON.stringify(stable));

  // ---- THE STALE DOCUMENT, which is what the flicker actually was ----
  //
  // `?v=` busts every script and NOTHING busts the document that names
  // them, so a browser holding a cached index.html/studio.html keeps
  // asking for exactly the old scripts it already knows about. From the
  // outside that is one load showing the old screen and the next
  // showing the new one: "the screen is flickering between old and new
  // screen". js/buildStamp.js already detected it and waited to be
  // tapped; it now fixes itself once.
  console.log('-- the stale document');
  // Every URL this page navigates to, captured — buildStamp strips the
  // buster from the address bar on the next mount (a shared link must
  // not carry somebody else's build number), so reading page.url()
  // afterwards would show it already cleaned up.
  const navs = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.evaluate(() => {
    // Pretend this page is a build behind by answering version.txt with
    // something newer. Nothing else about the mechanism is faked — the
    // navigation that follows is the real one.
    const real = window.fetch;
    window.fetch = function (u) {
      if (String(u).indexOf('version.txt') >= 0) {
        return Promise.resolve({ ok: true, text: function () { return Promise.resolve('9999'); } });
      }
      return real.apply(window, arguments);
    };
    sessionStorage.removeItem('vihu.buildStamp.tried');
    document.querySelectorAll('[data-build-stamp]').forEach((n) => n.remove());
    const stamp = document.querySelector('script[src*="buildStamp"]');
    const sc = document.createElement('script');
    sc.src = stamp ? stamp.src : 'js/buildStamp.js';
    document.body.appendChild(sc);
  });
  await page.waitForTimeout(3000);
  check(navs.some((u) => /[?&]b=9999/.test(u)),
    'G9e a page a build behind refetches itself, once', JSON.stringify(navs.slice(-2)));
  check(await page.evaluate(() => sessionStorage.getItem('vihu.buildStamp.tried') === '9999'),
    'G9f …and remembers it tried, so a cache that ignores the query cannot loop');

  check(pageErrors.length === 0, 'G10 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
