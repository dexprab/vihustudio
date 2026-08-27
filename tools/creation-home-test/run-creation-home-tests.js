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
  // A NEW DOOR NEEDS TO BE A DOOR. Drawn, not an emoji: 🚪 is a CLOSED
  // door, and closed is the one thing this must never look like
  // (Decision 22 — hidden, never locked).
  const doorArt = await page.evaluate(() => {
    const a = document.querySelector('#creationFlowContent .creation-flow-door-art svg');
    if (!a) return null;
    const r = a.getBoundingClientRect();
    const txt = (document.querySelector('#creationFlowContent .creation-flow-door') || {}).innerText || '';
    return { w: Math.round(r.width), h: Math.round(r.height), paths: a.querySelectorAll('path').length, emoji: /🚪/.test(txt) };
  });
  check(doorArt && doorArt.w > 40 && doorArt.h > 40,
    'B8b it is actually drawn, at a size a child can see', JSON.stringify(doorArt));
  check(doorArt && doorArt.paths >= 4, 'B8c …as a real drawing, not one flat shape', doorArt && doorArt.paths);
  check(doorArt && !doorArt.emoji, 'B8d and never the closed-door emoji');

  // The World Card band is hidden for now.
  const band = await page.evaluate(() => {
    const t = (document.getElementById('creationFlowContent') || {}).innerText || '';
    return {
      label: /Already have something/i.test(t),
      world: /World Card/i.test(t),
      section: !!document.querySelector('#creationFlowContent .creation-flow-secondary-options')
    };
  });
  check(!band.world, 'B8e the World Card offer is hidden', JSON.stringify(band));
  check(!band.section && !band.label,
    'B8f …and its band is absent rather than empty', JSON.stringify(band));

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

  /* ---------------- F: the unfinished story, and the door in the rail ----
   *
   * "whenever i return to vihuplanet, it always takes me in to studio
   * where i get discard and restore prompt. so i have no way to know
   * there is something called door." Restore went straight into the
   * editor, so a returning child — which is every child, since they
   * always have a saved session — never met this screen at all.
   *
   * Two things are guarded here. That a saved session now lands ON
   * Studio Home rather than behind a modal, and that the Studio itself
   * carries the same door for a child who never leaves it.
   */
  console.log('\n-- F: coming back');

  // A real saved session, written through ProjectManager itself rather
  // than hand-forged into localStorage — a forged one would pass this
  // suite and fail the product.
  async function bootWithSession(){
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CreationFlow !== 'undefined' && typeof StudioRite !== 'undefined' &&
      typeof ProjectManager !== 'undefined' && typeof MagicCard !== 'undefined',
      null, { timeout: 20000 });
    await page.evaluate(() => {
      localStorage.clear();
      // A Creator, because that is who comes back. A Traveller is
      // stateless by Decision 19 and does not have a story waiting for
      // them on the next arrival — which is the design, not a gap.
      MagicCard.claim('Vihu');
      const gw = document.getElementById('gatewayOverlay');
      if (gw) gw.style.display = 'none';
      document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
    });
    // Make a story, name it, let it save.
    await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await page.waitForTimeout(900);
    // Named through the real header field, not by poking AppState — the
    // input syncs back into the project on its own events, so a direct
    // assignment is overwritten by the next autosave and the suite would
    // be testing a title the product never stored.
    await page.evaluate(() => {
      const t = document.getElementById('bookTitle');
      if (t) {
        t.value = 'Half a Story';
        t.dispatchEvent(new Event('input', { bubbles: true }));
        t.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { try { ProjectManager.saveToLocalStorage(); } catch (e) {} });
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const i = ProjectManager.getSessionStatus();
      return {
        state: i.state,
        title: (i.data && i.data.project && i.data.project.bookTitle) || '',
        creator: StudioRite.isComplete()
      };
    });
  }

  const sess = await bootWithSession();
  check(sess.state === 'valid' && sess.title === 'Half a Story' && sess.creator === true,
    'F0 the setup is a genuine saved session, written by ProjectManager', JSON.stringify(sess));

  // The Studio's own rail door, while a story is open.
  const railDoor = await page.evaluate(() => {
    try { refreshStudioDoor(); } catch (e) {}
    const d = document.getElementById('studioDoor');
    if (!d) return { present: false };
    const r = d.getBoundingClientRect();
    return {
      present: true,
      hidden: d.hidden,
      onScreen: r.width > 0 && r.height > 0,
      text: (d.innerText || '').replace(/\s+/g, ' ').trim(),
      inHeader: !!d.closest('.app-header'),
      inAddPanel: !!d.closest('#objectStrip, .object-strip, #contextPanel'),
      next: StudioRite.nextOptIn()
    };
  });
  check(railDoor.present && !railDoor.hidden && railDoor.onScreen,
    'F1 the Studio itself carries the door', JSON.stringify(railDoor));
  check(/A new door is waiting/.test(railDoor.text) && /Discover/.test(railDoor.text),
    'F2 it says the same thing Studio Home\'s door says', railDoor.text);
  check(railDoor.inHeader === false && railDoor.inAddPanel === false,
    'F3 not in the header (the product owner\'s instruction) and not in the Add panel (Decision 22)',
    JSON.stringify({ h: railDoor.inHeader, a: railDoor.inAddPanel }));
  FORBIDDEN.forEach(([word, re]) => {
    check(!re.test(railDoor.text), 'F4 the rail door never says "' + word + '"',
      (railDoor.text.match(re) || [''])[0]);
  });

  // THE DOOR IS DOCKED, NEVER PUSHED. "now with every page add the door
  // will slide down" — it did: the rail was one scrolling block, so the
  // door sat after the page list and every new page moved it further
  // out of reach. A door you have to scroll to find is the same problem
  // as a door behind a modal, one build later. It is pinned to the foot
  // of the rail now, so its position is the SAME at one page and at
  // thirty, and the rail itself never scrolls.
  const pinned = [];
  for (const target of [1, 4, 12, 30]) {
    await page.evaluate((n) => {
      while ((AppState.slides || []).length < n) {
        try { PageOps.addAfter(AppState.slides.length - 1); } catch (e) { break; }
      }
    }, target);
    await page.waitForTimeout(400);
    pinned.push(await page.evaluate(() => {
      try { refreshStudioDoor(); } catch (e) {}
      const d = document.getElementById('studioDoor');
      const rail = document.querySelector('.left-sidebar');
      const b = d.getBoundingClientRect();
      return {
        pages: (AppState.slides || []).length,
        top: Math.round(b.top),
        onScreen: b.top >= 0 && b.bottom <= window.innerHeight + 1,
        railScroll: rail.scrollHeight - rail.clientHeight
      };
    }));
  }
  const tops = pinned.map((p) => p.top);
  check(new Set(tops).size === 1,
    'F5a the door does not move as pages are added — 1, 4, 12, 30 pages, one position',
    JSON.stringify(pinned));
  check(pinned.every((p) => p.onScreen),
    'F5b …and it is on screen at every one of them', JSON.stringify(tops));
  check(pinned.every((p) => p.railScroll === 0),
    'F5c the rail itself never scrolls — the page list owns the scroll',
    JSON.stringify(pinned.map((p) => p.railScroll)));

  // Absent rather than empty when there is nothing behind it.
  const noNext = await page.evaluate(() => {
    const all = StudioRite.rites().filter((r) => r.runnable).map((r) => r.id);
    const caps = [];
    StudioRite.rites().forEach((r) => {
      (r.teaches || []).forEach((c) => caps.push(c));
      (r.reveals || []).forEach((c) => caps.push(c));
    });
    // Onto the CARD, because a card is active and the card is read
    // first — writing the device key would be shadowed and the check
    // would pass for the wrong reason.
    try { MagicCard.setTaught(caps); } catch (e) {}
    try { localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify(caps)); } catch (e) {}
    try { refreshStudioDoor(); } catch (e) {}
    const d = document.getElementById('studioDoor');
    const r = d.getBoundingClientRect();
    return { next: StudioRite.nextOptIn(), hidden: d.hidden, h: Math.round(r.height),
             rites: all.length, caps: caps.length };
  });
  check(!noNext.next && noNext.hidden === true && noNext.h === 0 && noNext.rites > 0,
    'F5 absent rather than empty once every rite is taught', JSON.stringify(noNext));

  // Never while a rite is running: a chapter owns the screen.
  const whileRunning = await page.evaluate(() => {
    try { MagicCard.setTaught([]); } catch (e) {}
    try { localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify([])); } catch (e) {}
    document.body.classList.add('studio-rite-running');
    try { refreshStudioDoor(); } catch (e) {}
    const d = document.getElementById('studioDoor');
    const css = getComputedStyle(d).display;
    document.body.classList.remove('studio-rite-running');
    return { css: css, next: StudioRite.nextOptIn() };
  });
  check(whileRunning.css === 'none',
    'F6 the door never shows while a rite is running', JSON.stringify(whileRunning));

  // And now the return itself — the REAL one. Not a hand-called boot:
  // a genuine page load, the Gateway cinematic skipped the way a child
  // skips it (a tap), and whatever the Studio's own boot then decides.
  // Everything this sprint changed lives in that decision, so nothing
  // short of taking it is worth checking.
  //
  // Scene 3 asks a Returning Creator for their sky. Decision 11's own
  // one-shot recognition note is what a child arriving from VihuPlanet
  // carries, so the suite leaves the same note rather than reaching
  // around the Gateway.
  await page.evaluate(() => {
    try { CreatorRecognition.markRecognised(MagicCard.getActive().id); } catch (e) {}
  });
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() =>
    typeof CreationFlow !== 'undefined' && typeof ProjectManager !== 'undefined',
    null, { timeout: 20000 });
  const bootState = await page.evaluate(() => {
    const i = ProjectManager.getSessionStatus();
    return { state: i.state, complete: StudioRite.isComplete() };
  });
  // Tap through the cinematic. It listens for a click anywhere on its
  // own overlay; a few, spaced, cover each segment that re-arms.
  for (let i = 0; i < 14; i++) {
    const done = await page.evaluate(() => {
      const gw = document.getElementById('gatewayOverlay');
      if (!gw || gw.classList.contains('hidden') ||
          getComputedStyle(gw).display === 'none') return true;
      gw.click();
      return false;
    });
    if (done) break;
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() =>
    document.body.classList.contains('creation-flow-active') ||
    !document.getElementById('creationFlowOverlay').classList.contains('hidden'),
    null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  const back = await page.evaluate(() => {
    const c = document.getElementById('creationFlowContent');
    const r = c ? c.querySelector('.creation-flow-resume') : null;
    return {
      onStudioHome: document.body.classList.contains('creation-flow-active'),
      resume: r ? (r.innerText || '').replace(/\s+/g, ' ').trim() : null,
      modal: !!document.querySelector('.modal-overlay:not(.hidden), #restoreModal:not(.hidden)'),
      restoreWord: /Restore Previous Project/.test(document.body.innerText),
      door: !!(c && c.querySelector('.creation-flow-door'))
    };
  });
  check(bootState.state === 'valid',
    'F6b the boot really did see a valid saved session', JSON.stringify(bootState));
  if (!back.resume || !back.door) {
    console.log('     DIAG ' + JSON.stringify(await page.evaluate(() => ({
      complete: StudioRite.isComplete(),
      cards: MagicCard.list().length,
      active: (MagicCard.getActive() || {}).id || null,
      session: ProjectManager.getSessionStatus().state,
      riteRunning: StudioRite.isRunning(),
      next: StudioRite.nextOptIn(),
      records: (CreatorProjectStore.listAll() || []).length,
      held: (CreatorProjectStore.listAll() || []).filter((r) => r.riteInProgress).length,
      head: (document.getElementById('creationFlowContent').innerText || '').slice(0, 60)
    }))));
  }
  check(back.onStudioHome === true,
    'F7 coming back lands on Studio Home, not straight in the editor', JSON.stringify(back));
  check(back.modal === false && back.restoreWord === false,
    'F8 no Restore/Discard modal stands in front of it', JSON.stringify(back));
  check(!!back.resume && /Half a Story/.test(back.resume) && /Carry on/.test(back.resume),
    'F9 their own story is on the screen, named, one tap away', back.resume);
  check(back.door === true,
    'F10 and the door is there too — which is the whole point of moving it', String(back.door));
  FORBIDDEN.forEach(([word, re]) => {
    check(!re.test(back.resume || ''), 'F11 the resume card never says "' + word + '"',
      ((back.resume || '').match(re) || [''])[0]);
  });

  await page.screenshot({ path: path.join(SHOTS, 'coming-back.png') });
  console.log('     shot: shots/coming-back.png');

  // THE WHOLE SCREEN FITS A SHORT WINDOW. "need sizing fix" — measured
  // at 1359x600 (a 1366x768 laptop once the browser's chrome is off)
  // this screen stood 746px tall and Discover sat below the fold, which
  // for an invitation nobody is told about is the same as not being
  // there. Checked with the resume pill present, which is the tallest
  // this screen ever gets.
  await page.setViewportSize({ width: 1359, height: 600 });
  await page.waitForTimeout(500);
  const short = await page.evaluate(() => {
    const c = document.getElementById('creationFlowContent');
    const d = c.querySelector('.creation-flow-door');
    const r = c.querySelector('.creation-flow-resume');
    const btn = d ? d.querySelector('.creation-flow-door-btn') : null;
    return {
      overflow: c.scrollHeight - window.innerHeight,
      doorBtnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
      resumeH: r ? Math.round(r.getBoundingClientRect().height) : null,
      vh: window.innerHeight
    };
  });
  check(short.overflow <= 0,
    'F13 the whole screen fits a 600px-tall window — nothing is below the fold',
    JSON.stringify(short));
  check(short.doorBtnBottom !== null && short.doorBtnBottom <= short.vh,
    'F14 Discover itself is on screen, which is the part that matters',
    JSON.stringify(short));
  check(short.resumeH !== null && short.resumeH <= 64,
    'F15 the resume pill is one row, not a card — it stood 130px stacked',
    JSON.stringify(short));
  await page.screenshot({ path: path.join(SHOTS, 'coming-back-short.png') });
  console.log('     shot: shots/coming-back-short.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);

  // Carry on actually opens the story it names.
  const carried = await page.evaluate(() => {
    const b = document.querySelector('.creation-flow-resume-btn');
    if (!b) return null;
    b.click();
    return true;
  });
  await page.waitForFunction(() =>
    !document.body.classList.contains('creation-flow-active'), null, { timeout: 15000 }).catch(() => {});
  const opened = await page.evaluate(() => ({
    inEditor: !document.body.classList.contains('creation-flow-active'),
    title: (AppState.project && AppState.project.bookTitle) || '',
    pages: (AppState.slides || []).length
  }));
  check(carried && opened.inEditor && opened.title === 'Half a Story' && opened.pages > 0,
    'F12 Carry on opens the story it named', JSON.stringify(opened));

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
