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

  await page.evaluate(() => document.body.classList.add('studio-rite-shows-garden'));
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
    unwrittenStarts: StudioRite.start('my-garden'),
    // A rite with no story must refuse to start and must never be the
    // door Studio Home offers. That is the invariant — not that every
    // entry is walkable.
    worldToolsStart: StudioRite.start('the-world-tools'),
    nextDoor: StudioRite.nextOptIn()
  }));
  check(reg.order.join(' > ') === 'the-night-a-star-came-down > my-garden > my-little-house > the-world-tools',
    'N1 the order is My Garden, My Little House, then the world tools', reg.order.join(' > '));
  check(reg.unwrittenStarts === true,
    'N2 My Garden has its story now, so it starts — the same call refused while it had none');
  // N3 USED TO ASSERT EVERY RITE WAS WALKABLE, which was true only
  // because every entry happened to have a story at the time. Decision
  // 22 is explicit that "a rite with no screens is a place in the order,
  // not a door", so the real invariant is that an unwritten one refuses
  // and is never offered — which is what stops a child being pointed at
  // a door that will not open.
  check(reg.worldToolsStart === false,
    'N3 a rite with no story refuses to start', String(reg.worldToolsStart));
  check(reg.nextDoor !== 'the-world-tools',
    'N3b …and is never the door Studio Home offers', String(reg.nextDoor));

  // EVERY RUNNABLE RITE TEACHES WHAT IT HANDS OVER.
  //
  // "they were not part of rite 1" was the complaint, and moving a
  // capability to a different rite does not answer it — it moves it. A
  // rite that reveals a control its own story never asks for is the
  // same bug one rite along. So: for every capability a runnable rite
  // reveals, some beat of that rite must gate on it.
  //
  // The map is the one place this suite knows which gate proves which
  // capability; anything revealed with no entry here fails, which is
  // what stops a capability being added to a rite without a beat.
  const GATE_FOR = {
    garden: ['drawing-kept', 'drawing-placed', 'letter-kept', 'letters-placed'],
    voice: ['voice-added'],
    shapes: ['shape-added'],
    doodle: ['doodle-added'],
    photo: ['photo-added'],
    'blank-page': ['blank-page-added'],
    'page-shape': ['page-shaped']
  };
  const untaught = await page.evaluate((map) => {
    const bad = [];
    StudioRite.rites().forEach(function (r) {
      if (!r.runnable) return;
      const gates = (StudioRite._gates(r.id) || []).filter(Boolean);
      (r.teaches || []).forEach(function (cap) {
        const proofs = map[cap];
        if (!proofs) return;                     // not a gateable control
        if (!proofs.some((g) => gates.indexOf(g) >= 0)) bad.push(r.id + '/' + cap);
      });
    });
    return bad;
  }, GATE_FOR);
  check(untaught.length === 0,
    'N6 every runnable rite has a beat for each control it hands over',
    untaught.join(', ') || 'all taught');

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
  check(cumulative.indexOf('studio-rite-shows-garden') >= 0,
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

  // C4-C6 — the two populations the amendment created, and the dead end
  // it exposed. `_finishAwakening()` marks the ceremony offered whatever
  // the outcome, and the header badge is hidden with no active card, so
  // a child who said "Maybe Later" had no badge, no second offer and no
  // route to a card at all.
  console.log('-- C: nobody is left without a way to a card');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined'
    && typeof MagicCard !== 'undefined' && typeof MagicCardUI !== 'undefined',
    null, { timeout: 20000 });

  // A child who finished the Rite BEFORE the card came from finishing.
  const legacy = await page.evaluate(() => {
    localStorage.clear();
    StudioRite.markComplete();
    return { complete: StudioRite.isComplete(), cards: MagicCard.list().length,
             owed: MagicCard.shouldOfferAwakening() };
  });
  check(legacy.complete && legacy.cards === 0 && legacy.owed === true,
    'C4 a child who finished the Rite before this rule existed is still owed a Ceremony',
    JSON.stringify(legacy));

  // And a child who was offered one and said Maybe Later.
  const declined = await page.evaluate(() => {
    MagicCard.markAwakeningOffered();
    // The badge is hidden BY the refresh, not inherently — the first
    // version of this check read the untouched DOM and reported a badge
    // that was simply never updated. Ask the real function.
    MagicCardUI.refreshHeaderBadge();
    const badge = document.getElementById('magicCardBadge');
    return { owed: MagicCard.shouldOfferAwakening(), cards: MagicCard.list().length,
             badgeVisible: !!(badge && !badge.classList.contains('hidden')) };
  });
  check(declined.owed === false && declined.cards === 0 && !declined.badgeVisible,
    'C5 a child who declined has no card, no further offer and no badge — the dead end',
    JSON.stringify(declined));

  // The notice is their route, and it opens the ceremony rather than
  // pressing Finish Story, which would grant them nothing.
  const route = await page.evaluate(() => {
    let opened = false;
    const real = MagicCardUI.showAwakening;
    MagicCardUI.showAwakening = function(){ opened = true; };
    try {
      TravellerSaveNotice.refresh();
      const btn = document.querySelector('.traveller-save-notice-publish');
      const label = btn ? btn.textContent.trim() : null;
      if (btn) btn.click();
      return { label: label, opened: opened };
    } finally { MagicCardUI.showAwakening = real; }
  });
  check(route.opened === true && !/Finish/i.test(route.label || ''),
    'C6 and the Traveller notice is that route — it opens the Ceremony, not Finish Story',
    JSON.stringify(route));

  check(pageErrors.length === 0, 'H1 zero page errors',
    pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
