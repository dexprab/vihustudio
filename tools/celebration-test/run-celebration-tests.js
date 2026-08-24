/* THE CELEBRATION — verification suite for the finish-story screen.
 *
 * Written after "story is missing": the celebration rendered with no
 * cover, no film and no title, because a rework had removed the line
 * that declared `dest` while two later reads of it survived. The
 * function threw a ReferenceError partway through, and everything after
 * the throw — the film, the artifacts and the title — simply never ran.
 *
 * Nothing tested this screen. Three commits of rework landed on it in a
 * row and none of them could have caught that, so this suite exists to
 * make the celebration the one screen a publish is actually driven to.
 *
 * It drives the REAL publish: a blank story through the real
 * CreationFlow, the real Finish Story button on the Read stage, the
 * real bundle (a PDF and a Magic Creation are genuinely produced), and
 * then asks the live celebration what it is showing.
 *
 * NOT Author Mode. PublishTarget.current() answers CANON whenever
 * Author Mode is on, and the canon celebration deliberately hides Take
 * My Story — so the one sanctioned direct door into the Studio is the
 * wrong door for this screen. A Studio entry pass is minted instead
 * (js/studioEntry.js), which is exactly what the real journey does.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/celebration-test/run-celebration-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = Number(process.env.CELEB_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
function ok(name, note) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
function fail(name, note) { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
function check(cond, name, note) { (cond ? ok : fail)(name, note); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // ---- boot the editor the way a child reaches it -------------------
  await page.goto(BASE + '/index.html');
  await page.evaluate(() => {
    try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
    try { sessionStorage.setItem('vihu.studioEntry.pass', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/studio.html');
  await page.waitForFunction(
    () => typeof CreationFlow !== 'undefined' && typeof PublishStudio !== 'undefined',
    null, { timeout: 20000 });
  // The Traveller Gateway cinematic covers the workspace on entry.
  for (let i = 0; i < 6; i++) {
    const gone = await page.evaluate(() => {
      const ov = document.getElementById('gatewayOverlay');
      if (!ov || ov.hidden || !ov.offsetParent) return true;
      ov.click(); return false;
    });
    if (gone) break;
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { const ov = document.getElementById('gatewayOverlay'); if (ov) ov.style.display = 'none'; });
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => {
    const w = document.querySelector('main.preview-area .preview-wrapper');
    return w && w.getBoundingClientRect().width > 100;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const target = await page.evaluate(() => { try { return PublishTarget.current(); } catch (e) { return 'err'; } });
  check(target === 'creator', 'C0 publishing as a Creator, not Canon', target);

  await page.evaluate(() => {
    const t = document.getElementById('bookTitle');
    if (t) { t.value = 'The Green Place'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(400);

  // ---- the real publish ---------------------------------------------
  console.log('-- driving the real Finish Story');
  await page.evaluate(() => { PublishStudio.open(); });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => PublishStudio.getStage() === PublishStudio.STAGES.READ),
    'C1 Finish Story opens on Reading');
  await page.screenshot({ path: path.join(SHOTS, 'read.png') });

  const pressed = await page.evaluate(() => {
    const lab = document.querySelector('.publish-read-publish-label');
    const b = lab && lab.closest('button');
    if (!b) return false;
    b.click(); return true;
  });
  check(pressed, 'C2 the Reading stage has a finish button to press');

  let reached = true;
  try {
    await page.waitForFunction(
      () => PublishStudio.getStage() === PublishStudio.STAGES.CELEBRATION,
      null, { timeout: 240000 });
  } catch (e) { reached = false; }
  check(reached, 'C3 one press reaches the celebration — no readiness stop in between',
    reached ? '' : await page.evaluate(() => PublishStudio.getStage()));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, 'celebration.png') });

  // ---- THE REGRESSION THIS SUITE EXISTS FOR -------------------------
  // A thrown error mid-render leaves a screen that looks merely empty,
  // so the error itself is the assertion, not a footnote to one.
  check(pageErrors.length === 0, 'C4 the celebration renders with zero page errors',
    pageErrors.slice(0, 3).join(' | '));

  const seen = await page.evaluate(() => {
    function shown(sel) {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 8 && r.height > 8 };
    }
    const v = document.querySelector('.publish-celebration-video');
    return {
      artifacts: PublishStudio._bundleArtifacts(),
      title: ((document.querySelector('.publish-celebration-title') || {}).textContent || '').trim(),
      message: ((document.querySelector('.publish-celebration-message-generic') || {}).textContent || '').trim(),
      cover: shown('.publish-celebration-cover'),
      video: shown('.publish-celebration-video'),
      videoSized: v ? (v.videoWidth > 0 && v.videoHeight > 0) : false,
      // A canvas that was never drawn into is fully transparent, and it
      // is the exact shape "story is missing" took: an element with
      // real size showing nothing at all. Visible is not the same as
      // drawn, so the pixels are asked directly.
      coverDrawn: (function () {
        const c = document.querySelector('.publish-celebration-cover');
        if (!c || c.classList.contains('hidden')) return null;
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4 * 997) if (d[i] > 0) return true;
          return false;
        } catch (e) { return null; }
      })(),
      choices: Array.from(document.querySelectorAll('.publish-celebration-choice-label'))
        .filter((e) => e.closest('button') && !e.closest('button').hidden)
        .map((e) => e.textContent.trim()),
      body: (document.querySelector('.publish-celebration-body') || document.body).innerText
    };
  });

  check(seen.title === 'The Green Place', 'C5 the story is named on the celebration', JSON.stringify(seen.title));
  const artIds = Object.keys(seen.artifacts).filter((k) => seen.artifacts[k]);
  check(artIds.indexOf('book') >= 0, 'C6 the book is produced', artIds.join(','));
  check(!!seen.artifacts.magic, 'C7 the Magic Creation is produced');
  // Exactly one of the two lives in the stand, and whichever it is has
  // real size — "story is missing" was both of them at zero.
  const oneShowing = (seen.video && seen.video.vis) !== (seen.cover && seen.cover.vis);
  check(oneShowing, 'C8 exactly one of the film and the cover fills the stand',
    JSON.stringify({ video: seen.video, cover: seen.cover }));
  check(seen.videoSized, 'C9 the Magic Creation has real frames', JSON.stringify(seen.video));
  check(seen.coverDrawn !== false, 'C9b a shown cover has actually been drawn into', String(seen.coverDrawn));
  check(/came to life/.test(seen.message), 'C10 the line is about the film that is playing', seen.message);

  // ---- Decision 12: two equal choices, no downloads page ------------
  check(seen.choices.length === 2, 'C11 exactly two choices', seen.choices.join(' / '));
  check(seen.choices.indexOf('Take My Story') === 0 && /VihuPlanet/.test(seen.choices[1] || ''),
    'C12 the two choices are Take My Story and Share with VihuPlanet', seen.choices.join(' / '));
  check(!/Get My Adventure|Get My Story|Get My Book/i.test(seen.body),
    'C13 the gold duplicate download button is gone');
  check(!/Publish/i.test(seen.body), 'C14 nothing on the screen says Publish to a child');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
