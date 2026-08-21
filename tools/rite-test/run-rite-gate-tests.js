/* THE RITE GATE — who is sent through the Studio Rite, and who is not.
 *
 * The Rite is the one mandatory thing in the product (Decision 8), so
 * being wrong in either direction is expensive: a child who has never
 * created anything let straight into the Studio, or a Creator made to
 * sit through it again.
 *
 * The bug this suite was written for: the grandfather clause asked
 * `MagicCard.list().length > 0` — "does anybody on this laptop hold a
 * card" — which is a fact about the DEVICE. A sibling's card sent a
 * brand-new child straight past the Rite. Same bug class as Decision 19.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/rite-test/run-rite-gate-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.RITE_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() =>
    typeof MagicCard !== 'undefined' && typeof StudioRite !== 'undefined',
    null, { timeout: 20000 });

  console.log('\nTHE RITE GATE\n');

  // A brand-new child on a clean machine must be sent through it.
  const clean = await page.evaluate(() => {
    localStorage.clear();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete() };
  });
  check(clean.complete === false, 'G1 a first-time child is sent through the Rite',
    JSON.stringify(clean));

  // A recognised Creator is grandfathered — Decision 8, unchanged.
  const creator = await page.evaluate(() => {
    const c = MagicCard.claim('Recognised');
    MagicCard.setActive(c.id);
    return { active: !!MagicCard.getActive(), complete: StudioRite.isComplete() };
  });
  check(creator.complete === true, 'G2 a recognised Creator is not made to repeat it',
    JSON.stringify(creator));

  // THE REGRESSION. A second child, not recognised, on a machine that
  // holds somebody else's card. The card exists; it is not theirs.
  const sibling = await page.evaluate(() => {
    localStorage.removeItem('vihu-magic-card-active-id');
    return {
      cardsOnDevice: MagicCard.list().length,
      active: MagicCard.getActive() ? 'yes' : 'no',
      complete: StudioRite.isComplete()
    };
  });
  check(sibling.cardsOnDevice > 0 && sibling.active === 'no',
    'G3 the shared-device case is genuinely set up', JSON.stringify(sibling));
  check(sibling.complete === false,
    "G4 a sibling's card does NOT grandfather a new child", JSON.stringify(sibling));

  // A pointer to a card that no longer exists grandfathers nobody.
  const stale = await page.evaluate(() => {
    localStorage.setItem('vihu-magic-card-active-id', 'card-that-never-existed');
    return { active: MagicCard.getActive() ? 'yes' : 'no', complete: StudioRite.isComplete() };
  });
  check(stale.complete === false, 'G5 a stale card pointer grandfathers nobody',
    JSON.stringify(stale));

  // The flag still works for the child who earned it — including a
  // Traveller who completed the Rite and declined to share.
  const flagged = await page.evaluate(() => {
    localStorage.clear();
    StudioRite.markComplete();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete() };
  });
  check(flagged.cards === 0 && flagged.complete === true,
    'G6 a Traveller who finished the Rite keeps the Studio', JSON.stringify(flagged));

  check(pageErrors.length === 0, 'H1 zero page errors',
    pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
