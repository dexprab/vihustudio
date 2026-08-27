/* THE ATMOSPHERE — what a child actually hears while they make a story.
 *
 * The bug this suite was written for: "the created story in its
 * background track music does not have ambience music. it looks like
 * only single track plays in it."
 *
 * Measured, and it was exactly that. The Foundation bed is WEATHER —
 * forest and wind, with the other three layers deliberately at zero
 * (js/audioManager.js -> FOUNDATION_LAYERS) — and the MUSIC is whatever
 * World ambience plays on top of it. js/themeEngine.js called
 * `AudioManager.stopWorld()` for any Theme that declares no ambience of
 * its own, which is every Theme today, so the moment a story applied its
 * Theme the music stopped and never came back.
 *
 * That `else` was written as "a graceful no-op" at a time when there was
 * no default ambience to lose. DEFAULT_WORLD_AMBIENCE arriving turned it
 * into a mute that nobody chose.
 *
 * NOTHING HERE READS THE CODE. Every check measures the elements that
 * are actually playing and their live volume, because a check that reads
 * the same call the product reads would have agreed with the bug.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/atmosphere-test/run-atmosphere-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.ATMOS_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

const WEATHER = /foundation\/(forest|wind)\.mp3/;
const MUSIC = /worlds\/[a-z]+\.mp3/;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    // A child unlocks sound with a real tap; a headless run has no way to
    // make one that the autoplay policy accepts for MEDIA. This removes
    // the gate, not the behaviour — every play() call under test is the
    // product's own.
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1359, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Every element AudioManager builds is `new Audio(src)` and never
  // enters the document, so there is nothing to query for. The
  // constructor is the seam, and it is the honest one: what is recorded
  // is every clip the product ever made, and `layers()` then asks which
  // of them are running and above silence right now.
  await page.addInitScript(() => {
    window.__made = [];
    const RealAudio = window.Audio;
    window.Audio = function (src) { const el = new RealAudio(src); window.__made.push(el); return el; };
    window.Audio.prototype = RealAudio.prototype;
    window.__layers = () => window.__made
      .filter((e) => !e.paused && e.volume > 0.001)
      .map((e) => decodeURIComponent((e.src || '').split('/').slice(-2).join('/')));
  });

  console.log('\nTHE ATMOSPHERE\n');

  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() =>
    typeof AudioManager !== 'undefined' && typeof ThemeEngine !== 'undefined' &&
    typeof MagicCard !== 'undefined' && typeof CreationFlow !== 'undefined' &&
    typeof StudioRite !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    const c = MagicCard.claim('Vihu'); MagicCard.setActive(c.id);
    const caps = [];
    for (const r of StudioRite.rites()) caps.push.apply(caps, (r.teaches || []).concat(r.reveals || []));
    MagicCard.setTaught(caps);
    const gw = document.getElementById('gatewayOverlay'); if (gw) gw.style.display = 'none';
    document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
  });
  await page.evaluate(() => { try { AudioManager.init(); } catch (e) {} });
  await page.mouse.click(700, 400);
  await page.evaluate(() => { try { AudioManager.playFoundation(); } catch (e) {} });
  await page.waitForTimeout(3500);

  const opening = await page.evaluate(() => window.__layers());
  check(opening.filter((s) => /foundation\/(forest|wind)\.mp3/.test(s)).length === 2,
    'A1 the Foundation bed is weather, and both of its layers are playing',
    JSON.stringify(opening));
  check(opening.some((s) => /worlds\/[a-z]+\.mp3/.test(s)),
    'A2 …and a place has MUSIC over it, before any story exists',
    JSON.stringify(opening));
  const silentThree = await page.evaluate(() => AudioManager.getFoundationLayers()
    .filter((l) => !l.volume).map((l) => l.file));
  check(silentThree.length === 3,
    'A3 the other three Foundation layers are deliberately silent — not an oversight',
    silentThree.join(', '));

  // THE REGRESSION. Applying a Theme is what every story does on the way
  // in, and it used to take the music with it.
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForTimeout(4000);
  const making = await page.evaluate(() => window.__layers());
  check(making.filter((s) => /foundation\/(forest|wind)\.mp3/.test(s)).length === 2,
    'A4 the weather is still there once a story is open', JSON.stringify(making));
  check(making.some((s) => /worlds\/[a-z]+\.mp3/.test(s)),
    'A5 AND THE MUSIC SURVIVES IT — a Theme with no ambience of its own asks for nothing, not for silence',
    JSON.stringify(making));

  // A World that DOES declare its own music still wins the slot, and
  // handing the slot back must land on the default rather than on
  // nothing. Driven through AudioManager's own API because no shipped
  // Theme declares ambience today — which is precisely why the `else`
  // branch is the one that runs for every child.
  const handover = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    AudioManager.playWorld(['forest.mp3']);
    await wait(3200);
    const withWorld = window.__layers();
    ThemeEngine.applyArtworkTheme(null, { silent: true });
    await wait(3600);
    return { withWorld: withWorld, after: window.__layers() };
  });
  check(handover.withWorld.some((s) => /worlds\/forest\.mp3/.test(s)),
    'A6 a World that declares its own music still wins the slot',
    JSON.stringify(handover.withWorld));
  check(handover.after.some((s) => /worlds\/[a-z]+\.mp3/.test(s)) &&
        !handover.after.some((s) => /worlds\/forest\.mp3/.test(s)),
    'A7 clearing it hands the slot back to the default, never to silence',
    JSON.stringify(handover.after));

  // Silence must stay ASKABLE. The fix is that no Theme asks for it by
  // accident, not that it stopped existing.
  const stopped = await page.evaluate(async () => {
    AudioManager.stopWorld();
    await new Promise((r) => setTimeout(r, 3200));
    return window.__layers();
  });
  check(!stopped.some((s) => /worlds\/[a-z]+\.mp3/.test(s)),
    'A8 stopWorld() still genuinely stops — silence is asked for, never assumed',
    JSON.stringify(stopped));

  check(pageErrors.length === 0, 'A9 zero page errors', pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
