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
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
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

  // Show me your stars hands VihuPlanet the intent, and it is one-shot.
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
  await page.waitForTimeout(1500);
  check(/[?&]stars=1/.test(page.url()) || /index\.html/.test(page.url()),
    'G7 Show me your stars hands VihuPlanet the intent', page.url());

  // Crossing the threshold honours it, and it is consumed — a refresh
  // is an ordinary arrival, never a camera opening on its own.
  await page.waitForTimeout(1200);
  const afterCross = await page.evaluate(() => {
    const t = document.querySelector('[data-begin]') || document.querySelector('.vp-threshold');
    if (t) t.click();
    return null;
  });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    url: window.location.search,
    scanOpen: !!(document.querySelector('[data-scan]') && !document.querySelector('[data-scan]').hidden)
  }));
  check(!/stars=1/.test(state.url), 'G8 the intent is consumed and stripped', state.url || '(none)');
  check(state.scanOpen, 'G9 …and the stars flow actually opened', JSON.stringify(state));

  check(pageErrors.length === 0, 'G10 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
