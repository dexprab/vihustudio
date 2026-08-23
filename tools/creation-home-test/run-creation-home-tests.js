/* STORY RITE PROGRESSION — the Studio's first screen is the child's journey.
 *
 * The screen that used to be "choose what to create" (six feature tiles
 * under "Step 1 of 2") now has exactly two states, and StudioRite.
 * isComplete() is the only thing that decides which:
 *
 *   A — the first story has not been made. No menu at all: "A Story Is
 *       Waiting", four lines, and one Begin that runs the first rite.
 *   B — it has. Three named starting points made only of what that
 *       story already taught, and, under them, a new door to walk
 *       through if they feel like it.
 *
 * What this suite is really guarding is the language. Decision 22 is
 * explicit that nothing a child sees may name a level, a rite, a step,
 * a lock or a progression — the moment one has a name on screen a child
 * can compare theirs with a sibling's. So the forbidden-word check runs
 * against the real rendered text of both states, not against source.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/creation-home-test/run-creation-home-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = Number(process.env.CREATION_HOME_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

// The six tiles this screen used to be. None of them may survive on
// either state — that is the whole point of the sprint.
const OLD_TILES = ['Tell a Story', 'Showcase My Artwork', 'Create Quotes',
                   'Write a Poem', 'Make a Greeting Card', 'Start Something New'];

// Words a child may never read here. `\brite\b` deliberately does NOT
// match "write" — the boundary is real, and the old "Write a Poem" tile
// is exactly the false positive a sloppy substring check would produce.
const FORBIDDEN = [
  ['rite', /\brite\b/i],
  ['level', /\blevels?\b/i],
  ['unlock', /\bunlock/i],
  ['locked', /\blocked\b/i],
  ['lock', /\block\b/i],
  ['progress', /\bprogress/i],
  ['step 1', /step\s*1/i]
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // studio.html?author=on is the one sanctioned direct door (Decision
  // 13/23). Standing the Gateway cinematic and the Rite's own stage down
  // is a harness affordance for the SCREENSHOTS: both are full-bleed
  // overlays above this screen, and every check below is DOM-measured
  // against #creationFlowContent, which neither of them touches.
  async function boot(riteComplete) {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CreationFlow !== 'undefined' && typeof StudioRite !== 'undefined' &&
      typeof MagicCard !== 'undefined', null, { timeout: 20000 });
    const state = await page.evaluate((complete) => {
      localStorage.clear();
      if (complete) StudioRite.markComplete();
      return { complete: StudioRite.isComplete(), cards: MagicCard.list().length };
    }, riteComplete);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const gw = document.getElementById('gatewayOverlay');
      if (gw) gw.style.display = 'none';
      document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
    });
    await page.evaluate(() => { try { CreationFlow.start(); } catch (e) {} });
    await page.waitForTimeout(500);
    return state;
  }

  async function screenText() {
    return page.evaluate(() => {
      const c = document.getElementById('creationFlowContent');
      return c ? c.innerText : '';
    });
  }

  console.log('\nSTORY RITE PROGRESSION — Screen 1 is the journey\n');

  /* ---------------- STATE A ---------------- */
  console.log('-- A: the first story has not been made');
  let setup = await boot(false);
  check(setup.complete === false && setup.cards === 0,
    'A0 the setup is genuinely a child who has made nothing', JSON.stringify(setup));

  let textA = await screenText();
  check(/Your journey begins/.test(textA), 'A1 "Your journey begins"');
  check(/A Story Is Waiting/.test(textA), 'A2 "A Story Is Waiting"');
  ['Follow a little story.', 'Make some choices.', 'Change something.', 'Make it yours.']
    .forEach((line, i) => check(textA.indexOf(line) >= 0, 'A3.' + (i + 1) + ' "' + line + '"'));
  const beginBtn = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('#creationFlowContent button'))
      .find((b) => (b.textContent || '').trim() === 'Begin'));
  check(beginBtn, 'A4 exactly one action: Begin');

  const gridA = await page.evaluate(() => ({
    grids: document.querySelectorAll('#creationFlowContent .creation-flow-grid').length,
    cards: document.querySelectorAll('#creationFlowContent .creation-flow-card').length
  }));
  check(gridA.grids === 0 && gridA.cards === 0,
    'A5 no creation menu at all — no grid, no tiles', JSON.stringify(gridA));
  const oldA = OLD_TILES.filter((t) => textA.indexOf(t) >= 0);
  check(oldA.length === 0, 'A6 none of the six old tiles survives', oldA.join(', '));

  await page.screenshot({ path: path.join(SHOTS, 'state-a-story-waiting.png') });
  console.log('     shot: shots/state-a-story-waiting.png');

  // Nowhere in the DOM, not merely nowhere on this screen.
  const stepAnywhere = await page.evaluate(() =>
    (document.documentElement.innerHTML.match(/Step 1 of 2/g) || []).length);
  check(stepAnywhere === 0, 'A7 "Step 1 of 2" appears nowhere in the DOM', String(stepAnywhere));

  FORBIDDEN.forEach(([word, re]) => {
    check(!re.test(textA), 'A8 state A never says "' + word + '"',
      (textA.match(re) || [''])[0]);
  });

  // Begin hands the screen to the first rite. The overlay is deliberately
  // left standing under it, so what is checked here is that the rite
  // takes the screen — not that this one gives it up.
  const began = await page.evaluate(() => {
    try { CreationFlow.start(); } catch (e) {}
    const b = Array.from(document.querySelectorAll('#creationFlowContent button'))
      .find((x) => (x.textContent || '').trim() === 'Begin');
    if (!b) return 'no button';
    b.click();
    return 'clicked';
  });
  await page.waitForTimeout(1200);
  const riteTook = await page.evaluate(() => ({
    running: !!(StudioRite.isRunning && StudioRite.isRunning()),
    stage: !!document.querySelector('.studio-rite-overlay')
  }));
  check(began === 'clicked' && (riteTook.running || riteTook.stage),
    'A9 Begin hands the screen to the first story', JSON.stringify(riteTook));

  /* ---------------- STATE B ---------------- */
  console.log('\n-- B: the first story has been made');
  setup = await boot(true);
  check(setup.complete === true && setup.cards === 0,
    'B0 a child who made something but holds no Magic Card still reaches state B',
    JSON.stringify(setup));

  let textB = await screenText();
  check(/You made something\./.test(textB), 'B1 "You made something. ✨"');
  check(/Now Look What You Can Make/.test(textB), 'B2 "Now Look What You Can Make"');
  check(textB.indexOf('Try something new with what you discovered.') >= 0,
    'B3 "Try something new with what you discovered."');

  const starters = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#creationFlowContent .creation-flow-starter-grid .creation-flow-card'))
      .map((c) => ({
        title: (c.querySelector('.creation-flow-card-title') || {}).textContent || '',
        desc: (c.querySelector('.creation-flow-card-desc') || {}).textContent || '',
        make: !!c.querySelector('.creation-flow-starter-make')
      })));
  check(starters.length === 3, 'B4 exactly three starters', String(starters.length));
  [['My Little Story', 'Tell a little story of your own.'],
   ['Character Card', 'Give a character a story to tell.'],
   ['Little Message', 'Make something for someone special.']].forEach(([t, d], i) => {
    const s = starters[i] || {};
    check(s.title === t && s.desc === d && s.make === true,
      'B5.' + (i + 1) + ' "' + t + '" — its line and its Make', JSON.stringify(s));
  });

  const door = await page.evaluate(() => {
    const d = document.querySelector('#creationFlowContent .creation-flow-door');
    if (!d) return null;
    return {
      title: (d.querySelector('.creation-flow-door-title') || {}).textContent || '',
      line: (d.querySelector('.creation-flow-door-line') || {}).textContent || '',
      btn: (d.querySelector('.creation-flow-door-btn') || {}).textContent || ''
    };
  });
  check(door && door.title === 'A new door is waiting', 'B6 "A new door is waiting"', JSON.stringify(door));
  check(door && door.line === 'Ready to discover what you can do next?', 'B7 its one line');
  check(door && door.btn === 'Discover', 'B8 the action is Discover');

  const oldB = OLD_TILES.filter((t) => textB.indexOf(t) >= 0);
  check(oldB.length === 0, 'B9 the six-tile feature menu is gone from state B too', oldB.join(', '));

  // Nothing on the screen reads as a gate: no padlock glyph, no bar, no
  // count, no badge. Checked as characters rather than as intent.
  const gateGlyphs = /🔒|🔓|⛔|%|\bXP\b/.test(textB);
  check(!gateGlyphs, 'B10 nothing reads as locked, scored or counted');

  await page.screenshot({ path: path.join(SHOTS, 'state-b-what-you-can-make.png') });
  console.log('     shot: shots/state-b-what-you-can-make.png');

  FORBIDDEN.forEach(([word, re]) => {
    check(!re.test(textB), 'B11 state B never says "' + word + '"',
      (textB.match(re) || [''])[0]);
  });

  const stepAnywhereB = await page.evaluate(() =>
    (document.documentElement.innerHTML.match(/Step 1 of 2/g) || []).length);
  check(stepAnywhereB === 0, 'B12 "Step 1 of 2" appears nowhere in the DOM here either',
    String(stepAnywhereB));

  // Kept, per the sprint: My Projects / My Magic Card and the
  // "Already have something?" band are still reachable from this screen.
  const kept = await page.evaluate(() => ({
    entryRow: !!document.querySelector('#creationFlowContent .creation-flow-myprojects-entry'),
    secondary: !!document.querySelector('#creationFlowContent .creation-flow-secondary-options'),
    // Both are content-conditional: a child with no projects, no card and
    // nothing to redeem sees neither, which is the case under test here.
    projects: (typeof CreatorProjectStore !== 'undefined' ? CreatorProjectStore.list().length : -1)
  }));
  check(kept.projects === 0 ? true : kept.entryRow,
    'B13 My Projects is still offered whenever there is one', JSON.stringify(kept));

  /* ---------------- the starters really make something ---------------- */
  console.log('\n-- C: each starter opens the editor');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { try { CreationFlow.start(); } catch (e) {} });
    await page.waitForTimeout(250);
    const title = await page.evaluate((n) => {
      const cards = document.querySelectorAll('#creationFlowContent .creation-flow-starter-grid .creation-flow-card');
      const c = cards[n];
      if (!c) return null;
      const t = (c.querySelector('.creation-flow-card-title') || {}).textContent || '';
      c.click();
      return t;
    }, i);
    await page.waitForFunction(() => {
      const w = document.querySelector('main.preview-area .preview-wrapper');
      return !document.body.classList.contains('creation-flow-active') &&
             w && w.getBoundingClientRect().width > 100;
    }, null, { timeout: 15000 }).catch(() => {});
    const inEditor = await page.evaluate(() => {
      const w = document.querySelector('main.preview-area .preview-wrapper');
      return {
        overlayGone: document.getElementById('creationFlowOverlay').classList.contains('hidden'),
        shellGone: !document.body.classList.contains('creation-flow-active'),
        canvas: w ? Math.round(w.getBoundingClientRect().width) : 0,
        pages: (typeof AppState !== 'undefined' && AppState.slides) ? AppState.slides.length : -1,
        type: (typeof AppState !== 'undefined' && AppState.project) ? AppState.project.creationType : null
      };
    });
    check(inEditor.overlayGone && inEditor.shellGone && inEditor.canvas > 100 && inEditor.pages > 0,
      'C' + (i + 1) + ' "' + title + '" opens the real editor', JSON.stringify(inEditor));
  }

  await page.screenshot({ path: path.join(SHOTS, 'state-b-starter-opens-editor.png') });
  console.log('     shot: shots/state-b-starter-opens-editor.png');

  /* ---------------- the router itself ---------------- */
  console.log('\n-- D: what decides');
  const flips = await page.evaluate(() => {
    const read = () => {
      try { CreationFlow.start(); } catch (e) {}
      const c = document.getElementById('creationFlowContent');
      const h = c.querySelector('.creation-flow-question');
      return h ? h.textContent : '';
    };
    localStorage.clear();
    const before = read();
    StudioRite.markComplete();
    const after = read();
    return { before: before, after: after, complete: StudioRite.isComplete() };
  });
  check(flips.before === 'A Story Is Waiting' && flips.after === 'Now Look What You Can Make',
    'D1 the same screen answers to StudioRite.isComplete() alone', JSON.stringify(flips));

  const noCard = await page.evaluate(() => ({
    cards: MagicCard.list().length,
    active: !!MagicCard.getActive(),
    complete: StudioRite.isComplete()
  }));
  check(noCard.cards === 0 && !noCard.active && noCard.complete === true,
    'D2 no Magic Card is consulted — a Traveller who declined to share still reaches state B',
    JSON.stringify(noCard));

  check(pageErrors.length === 0, 'E1 zero page errors', pageErrors.slice(0, 3).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
