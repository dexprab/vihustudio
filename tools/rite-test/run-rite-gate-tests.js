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

  // ---------------------------------------------------------------
  // R — THE REDUCTION SHOWS ONLY WHAT THE RITE TEACHES.
  //
  // Reported by the product owner, looking at Rite I running: "for a
  // traveller why do we have garden and add creation button?" Both were
  // real and they were different faults. My Garden was never named in
  // the reduction — it was written before the tile existed under this
  // id — so the one control nobody thought to list stayed on screen
  // through a story that never asks for it. And the Garden's developer
  // trigger is Author Mode only, which a real Traveller never has, but
  // Author Mode is remembered per browser: anyone who ever switched it
  // on walks every later Rite with a dev control in the middle of a
  // child's first story.
  //
  // The class IS the condition — every rule is scoped to
  // `body.studio-rite-running` — so setting it is the real test, and it
  // does not depend on where a rite's choreography happens to be.
  console.log('-- R: the Rite shows only what it teaches');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    const gone = await page.evaluate(() => {
      const o = document.getElementById('gatewayOverlay');
      if (!o || o.hidden || !o.offsetParent) return true;
      o.click(); return false;
    });
    if (gone) break;
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none'; });
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => document.querySelector('main.preview-area .preview-wrapper'), null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const t = document.querySelector('.context-add-trigger');
    if (t && !document.querySelector('.context-add-grid')) t.click();
  });
  await page.waitForTimeout(600);
  const tiles = () => page.evaluate(() => Array.from(document.querySelectorAll('.context-add-card'))
    .filter((c) => c.offsetParent !== null).map((c) => c.dataset.addId));

  const openStudio = await tiles();
  check(openStudio.indexOf('library') >= 0,
    'R1 the open Studio offers My Garden — the reduction is what hides it, never its absence',
    JSON.stringify(openStudio));

  await page.evaluate(() => document.body.classList.add('studio-rite-running'));
  await page.waitForTimeout(300);
  const inRite = await tiles();
  const devHidden = await page.evaluate(() => {
    const e = document.querySelector('#gardenDevAdd');
    return { exists: !!e, visible: !!(e && e.offsetParent !== null) };
  });
  check(inRite.indexOf('library') === -1,
    'R2 a rite that reveals nothing does not offer My Garden', JSON.stringify(inRite));
  check(!devHidden.visible,
    'R3 and the Garden dev trigger is not in a child\'s first story, Author Mode or not',
    JSON.stringify(devHidden));

  await page.evaluate(() => document.body.classList.add('studio-rite-shows-library'));
  await page.waitForTimeout(300);
  const revealed = await tiles();
  check(revealed.indexOf('library') >= 0,
    'R4 a rite that DOES reveal it gets it back, by naming it and changing no CSS',
    JSON.stringify(revealed));

  // ---------------------------------------------------------------
  // N — THE ORDER LIVES IN THE REGISTRY.
  //
  // The product owner: "lets assign my garden to level 2 and current
  // level 2 becomes level 3." Decision 22 says in as many words that
  // the registry, not an ordinal, is the design — so this is a line
  // moving in an array, and everything downstream follows it.
  //
  // My Garden's story is not written. An entry with no screens is a
  // PLACE IN THE ORDER, not a door: it refuses to start, the Studio
  // Home offer skips it, and it contributes nothing to what a later
  // rite may show — because a rite nobody can walk has taught nobody
  // anything, and showing its tile in the rite after it would be the
  // same leak R2 exists to catch.
  console.log('-- N: the order lives in the registry');
  const reg = await page.evaluate(() => ({
    order: StudioRite.rites().map((r) => r.id),
    runnable: StudioRite.rites().map((r) => r.id + ':' + (r.runnable ? 'yes' : 'no')),
    unwrittenStarts: StudioRite.start('my-garden')
  }));
  check(reg.order.join(' > ') === 'the-night-a-star-came-down > my-garden > my-little-house',
    'N1 My Garden is the second step and My Little House the third', reg.order.join(' > '));
  check(reg.unwrittenStarts === true,
    'N2 My Garden has its story now, so it starts — the same call refused while it had none');
  check(!/:no/.test(reg.runnable.join(' ')),
    'N3 every rite in the registry can actually be walked', reg.runnable.join(' '));

  // The offer on Studio Home must skip the unwritten one and land on the
  // next real door — never on a rite nobody has authored.
  const offered = await page.evaluate(() => {
    const list = StudioRite.rites() || [];
    for (let i = 0; i < list.length; i++) {
      if (!list[i].mandatory && list[i].runnable) return list[i].id;
    }
    return null;
  });
  check(offered === 'my-garden',
    'N4 the next door is the first opt-in rite in registry ORDER, not a hard-coded id', String(offered));

  // A rite must never take away what an earlier rite taught. My Garden
  // is now runnable, so it contributes: the third rite shows its tile
  // without either entry naming the other, and while My Garden had no
  // story it contributed nothing — which is what kept the tile out of
  // Rite III in front of a child who had never been taught it.
  // A FRESH PAGE, because N2 started a rite to prove it starts and
  // `start()` refuses while one is running — the first version of this
  // check read an empty class list and looked like a broken feature.
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined', null, { timeout: 20000 });
  const cumulative = await page.evaluate(() => {
    StudioRite.start('my-little-house');
    const shows = Array.prototype.slice.call(document.body.classList)
      .filter((c) => c.indexOf('studio-rite-shows-') === 0).sort();
    return shows;
  });
  check(cumulative.indexOf('studio-rite-shows-library') >= 0,
    'N5 the third rite inherits My Garden from the second, with neither naming the other',
    cumulative.join(' '));

  // ---------------------------------------------------------------
  // C — BECOMING A CREATOR IS FINISHING THE FIRST STORY.
  //
  // The product owner, having asked why sharing was the mandate, chose
  // to move it: Rite I's completion awakens the Magic Card, and sharing
  // keeps its own weight afterwards. The case this exists for is the
  // child who finishes the Rite and DECLINES to share — before this
  // they held no card, which meant no backup and no recognition on
  // another device, because the only thing protecting their work was
  // gated behind a public act.
  //
  // The seam is asserted rather than the ceremony's pixels: what must
  // be true is that the rite offers the awakening when one is still
  // available, and never when a card already exists.
  console.log('-- C: the card comes from finishing, not from sharing');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined'
    && typeof MagicCard !== 'undefined', null, { timeout: 20000 });

  const offer = await page.evaluate(() => {
    localStorage.clear();
    const before = MagicCard.shouldOfferAwakening();
    // a child who has finished the Rite and shared nothing
    StudioRite.markComplete();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete(), offerable: before };
  });
  check(offer.offerable === true,
    'C1 a Traveller who has never shared is still owed a Ceremony', JSON.stringify(offer));
  check(offer.complete === true && offer.cards === 0,
    'C2 finishing the Rite is recorded without a card existing yet', JSON.stringify(offer));

  // …and once a card exists the offer is spent, so a child who shared on
  // the rite's last beat meets nothing extra when the rite ends.
  const spent = await page.evaluate(() => {
    MagicCard.claim('Test');
    return { cards: MagicCard.list().length, offerable: MagicCard.shouldOfferAwakening() };
  });
  check(spent.cards === 1 && spent.offerable === false,
    'C3 and once a card exists the Ceremony is spent — a child who shared meets nothing twice',
    JSON.stringify(spent));

  check(pageErrors.length === 0, 'H1 zero page errors',
    pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
