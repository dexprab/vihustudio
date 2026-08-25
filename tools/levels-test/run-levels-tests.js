/* THE STUDIO A CHILD MEETS IS THE ONE THEY COMPLETED A RITE IN.
 *
 * Decision 22's persistence: the Rite's reduction outlives the Rite.
 * Written after the product owner finished Rite I and was handed all
 * nine Add tiles — "the right pane is wrong. it should not have options
 * from rites which are yet to come."
 *
 * Drives the REAL Studio and asks the live Add panel what it is
 * offering, for each of the states a child can actually be in.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/levels-test/run-levels-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.LEVELS_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function ok(n, note) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function check(c, n, note) { (c ? ok : fail)(n, note); }

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  async function boot() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(
      () => typeof StudioRite !== 'undefined' && typeof MagicCard !== 'undefined'
         && typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
    for (let i = 0; i < 6; i++) {
      const gone = await page.evaluate(() => {
        const ov = document.getElementById('gatewayOverlay');
        if (!ov || ov.hidden || !ov.offsetParent) return true;
        ov.click(); return false;
      });
      if (gone) break;
      await page.waitForTimeout(600);
    }
    await page.evaluate(() => { const ov = document.getElementById('gatewayOverlay'); if (ov) ov.style.display = 'none'; });
    await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await page.waitForFunction(() => {
      const w = document.querySelector('main.preview-area .preview-wrapper');
      return w && w.getBoundingClientRect().width > 100;
    }, null, { timeout: 20000 });
    await page.waitForTimeout(500);
  }

  // What the Add panel is actually offering, measured rather than read
  // from the class list — display:none is the whole mechanism.
  async function tiles() {
    return page.evaluate(() => Array.from(document.querySelectorAll('.context-add-card'))
      .filter((e) => e.getBoundingClientRect().width > 4)
      .map((e) => e.getAttribute('data-add-id')).sort());
  }
  async function addPageVisible() {
    return page.evaluate(() => {
      const b = document.getElementById('addPageBtn');
      return !!(b && b.getBoundingClientRect().width > 4);
    });
  }

  // ---- A: nobody has a record — grandfathered, nothing is taken away
  console.log('-- A: a Studio that was here before the record existed');
  await boot();
  const gf = await page.evaluate(() => StudioRite.isGrandfathered());
  check(gf === true, 'A1 no record anywhere reads as grandfathered', String(gf));
  const allTiles = await tiles();
  check(allTiles.length >= 8, 'A2 a grandfathered Creator keeps every tile', allTiles.join(','));
  check(await addPageVisible(), 'A3 …and + Add Page');
  check(await page.evaluate(() => !document.body.classList.contains('studio-gated')),
    'A4 no gating class is written at all');

  // ---- B: a child who has done only the first rite
  console.log('-- B: after the first story');
  // ON A CARD, which is where the record lives for anybody who keeps it.
  // The device copy exists only for the seconds between Rite I finishing
  // and the Ceremony minting a card, and js/travellerReset.js removes it
  // on the next arrival — a Traveller is stateless, so seeding there
  // would be seeding something designed not to survive.
  await page.evaluate(() => {
    const c = MagicCard.claim('Rite I', null, null);
    MagicCard.setActive(c.id);
    MagicCard.setTaught(
      ['emoji','background','resize','rotate','move','text','copy-page','story-name','play','finish','share']);
  });
  await boot();
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === false,
    'B1 a record exists, so nothing is grandfathered');
  const afterI = await tiles();
  check(afterI.indexOf('shapes') < 0 && afterI.indexOf('doodle') < 0 && afterI.indexOf('photo') < 0,
    'B2 Shapes, Doodle and Photo are not there — no rite has taught them', afterI.join(','));
  check(afterI.indexOf('library') < 0, 'B3 My Garden is not there either', afterI.join(','));
  // The Emojis tile's own id is `stickers` — the capability the rite
  // records is `emoji`. Two vocabularies that must not be assumed equal.
  check(afterI.indexOf('stickers') >= 0 && afterI.indexOf('text') >= 0,
    'B4 Emojis and Text — what the first story is made of — are', afterI.join(','));
  check(!(await addPageVisible()), 'B5 + Add Page is not there; the first story copies a page');
  // The Background panel's own Picture section rides with Photo — the
  // leak Decision 22 already records once, closed here too.
  check(await page.evaluate(() => {
    const e = document.querySelector('.context-bg-picture-section');
    return !e || e.getBoundingClientRect().height < 2;
  }), 'B5b the Background panel\'s Picture section rides with Photo');
  // AND THE WORLD TOOLS GO TOO. They were left visible on the reasoning
  // that no rite could teach them, so hiding them would be a wall rather
  // than a shelf; the product owner read the same screen the other way —
  // "remove page shape, from this world, voice from here they were not
  // part of rite 1" — and three controls a child's story never mentions
  // are not a shelf either. They are named by a registry entry that has
  // no story yet, so the door and the tiles arrive together.
  check(afterI.indexOf('fromWorld') < 0 && afterI.indexOf('voice') < 0,
    'B6 From This World and Voice are not there either', afterI.join(','));
  check(await page.evaluate(() => {
    const t = document.querySelector('.context-set-tile[data-set-id="pageShape"]');
    return !t || t.getBoundingClientRect().width < 4;
  }), 'B6b …and neither is Page Shape');
  check(afterI.length === 2, 'B6c the first rite\'s Studio is exactly two tiles', afterI.join(','));
  // Hidden, never locked.
  const locks = await page.evaluate(() => (document.querySelector('.context-add-grid') || document.body).innerText);
  check(!/level|lock|🔒|unlock|progress/i.test(locks),
    'B7 no padlock, no level and nothing to compare', JSON.stringify(locks.slice(0, 80)));

  // ---- C: the next door
  console.log('-- C: which door Studio Home offers next');
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-garden',
    'C1 a child who has done only the first rite is offered My Garden');
  await page.evaluate(() => {
    MagicCard.setTaught(MagicCard.taught().concat(['garden','handwriting','library']));
  });
  await boot();
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-little-house',
    'C2 once taught, that door stops being offered and the next one appears');
  const afterII = await tiles();
  check(afterII.indexOf('library') >= 0, 'C3 My Garden is there now', afterII.join(','));
  check(afterII.indexOf('fromWorld') < 0, 'C3b …and the world tools still are not', afterII.join(','));
  check(afterII.indexOf('shapes') < 0, 'C4 …and the third rite\'s tiles still are not', afterII.join(','));

  // ---- D: everything taught
  console.log('-- D: after every rite');
  await page.evaluate(() => {
    MagicCard.setTaught(MagicCard.taught().concat(['shapes','doodle','photo','blank-page']));
  });
  await boot();
  const afterIII = await tiles();
  // Seven, not nine: the world tools belong to a rite nobody has
  // written, so finishing every rite that EXISTS does not hand them over.
  check(afterIII.indexOf('shapes') >= 0 && afterIII.indexOf('doodle') >= 0
        && afterIII.indexOf('photo') >= 0 && afterIII.indexOf('library') >= 0,
    'D1 every tile the written rites teach is back', afterIII.join(','));
  check(afterIII.indexOf('fromWorld') < 0 && afterIII.indexOf('voice') < 0,
    'D1b …and the world tools wait for the story that teaches them', afterIII.join(','));
  check(await addPageVisible(), 'D2 …and + Add Page');
  check(await page.evaluate(() => StudioRite.nextOptIn()) === null,
    'D3 there is no next door, so the offer is absent rather than empty');

  // ---- E: the record travels on the card
  console.log('-- E: it travels on the Magic Card');
  const carried = await page.evaluate(() => {
    // The real window: Rite I's grant writes the device record, and the
    // Ceremony mints a card moments later in the same page life. Nothing
    // resets in between — TravellerReset runs at arrival, not mid-story.
    MagicCard.setActive(null);
    localStorage.setItem(StudioRite.TAUGHT_KEY,
      JSON.stringify(['emoji','text','shapes','doodle','photo','blank-page']));
    const c = MagicCard.claim('Test', null, null);
    return { taught: MagicCard.taught(), id: c && c.id };
  });
  check(Array.isArray(carried.taught) && carried.taught.indexOf('shapes') >= 0,
    'E1 claiming a card sweeps the Traveller record onto it', JSON.stringify(carried.taught && carried.taught.length));
  // The record is the card's now, so wiping the device changes nothing.
  await page.evaluate(() => { localStorage.removeItem(StudioRite.TAUGHT_KEY); });
  await boot();
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === false,
    'E2 with the device record gone, the card still answers');
  check((await tiles()).indexOf('shapes') >= 0, 'E3 …and the Studio is still the one they earned');
  // A card minted with nothing swept carries an EMPTY array, never an
  // absent one — absence is what grandfathering means.
  const fresh = await page.evaluate(() => {
    localStorage.removeItem(StudioRite.TAUGHT_KEY);
    const c = MagicCard.claim('Fresh', null, null);
    MagicCard.setActive(c.id);
    return MagicCard.taught();
  });
  check(Array.isArray(fresh) && fresh.length === 0,
    'E4 a card claimed with nothing to sweep is empty, not absent', JSON.stringify(fresh));
  await boot();
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === false,
    'E5 …so that child is gated, not grandfathered');

  // ---- G: an existing Creator, who has never TAKEN an opt-in rite
  // Controls and doors are different questions, and grandfathering
  // answers only the first. Widening both hid the whole progression
  // from everybody who used the product before the record existed.
  console.log('-- G: somebody who was here before the record existed');
  // A CARD WITH NO TAUGHT RECORD is what a pre-existing Creator is now.
  // Not a bare completion flag: a Traveller is stateless, so
  // js/travellerReset.js clears that flag on arrival and somebody
  // holding no card genuinely IS a new child. The card is the only
  // thing that can say "I was here before the record existed".
  await page.evaluate(() => {
    localStorage.clear();
    // The backfill (§K) already ran on this device — that is the world
    // from now on. It stamps only the cards standing there at the moment
    // it runs; this one arrives afterwards, so absence still means
    // grandfathered, which is the promise the migration was chosen on.
    localStorage.setItem('vihu.magicCard.taughtBackfilled', '1');
    const c = MagicCard.claim('Veteran', null, null);
    MagicCard.setActive(c.id);
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    cards.forEach(function (x) { delete x.taught; });   // claimed before the record existed
    localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    localStorage.removeItem(StudioRite.TAUGHT_KEY);
  });
  await boot();
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === true,
    'G1 no record + a Studio already used reads as grandfathered');
  const gTiles = await tiles();
  check(gTiles.indexOf('fromWorld') >= 0 && gTiles.indexOf('voice') >= 0 && gTiles.length >= 8,
    'G2 they keep every control they have had for weeks — the world tools included',
    gTiles.join(','));
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-garden',
    'G3 …and the next door is still offered — they have walked no story yet');
  // Walking it must record the story, not swallow the whole ladder.
  await page.evaluate(() => {
    MagicCard.setTaught(['legacy-studio', 'garden', 'handwriting', 'library']);
  });
  await boot();
  check((await tiles()).length >= 8, 'G4 after that story they still keep everything');
  check(await page.evaluate(() => StudioRite.taught().indexOf('world') >= 0),
    'G4b …including capabilities no written rite teaches');
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-little-house',
    'G5 …and the door after it is offered, not swallowed');
  check(await page.evaluate(() => StudioRite.taught().indexOf('shapes') >= 0),
    'G6 legacy widens the controls');

  // ---- H: A CARD LEFT ACTIVE FROM AN EARLIER RUN
  //
  // "my studio post rite 1. same issue. am seeing tiles for next rites
  // already activated." The grant asked isComplete() to decide whether
  // this Studio predated the record — and since build 0634 wipes the
  // rite flag on every arrival, at that moment isComplete() means
  // exactly "is a Magic Card in hand", which is the test Decision 22
  // already recorded as dead.
  console.log('-- H: a card already in hand when the first rite finishes');
  await page.evaluate(() => {
    localStorage.clear();
    // An older card, claimed before the record existed.
    const old = MagicCard.claim('Old', null, null);
    MagicCard.setActive(old.id);
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    cards.forEach(function (c) { delete c.taught; });
    localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    localStorage.removeItem(StudioRite.TAUGHT_KEY);
  });
  const chain = await page.evaluate(() => {
    // Exactly what Rite I's completion does, in order: the grant lands
    // on the device while the OLD card is still active, and the
    // Ceremony mints a new one a beat later.
    const RITE_I = ['emoji','background','resize','rotate','move','text',
                    'copy-page','story-name','play','finish','share'];
    // (the grant's own legacy branch, reached through the real path)
    localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify(['legacy-studio'].concat(RITE_I)));
    const fresh = MagicCard.claim('New', null, null);
    MagicCard.setActive(fresh.id);
    return { taught: MagicCard.taught() };
  });
  check(chain.taught && chain.taught.indexOf('legacy-studio') < 0,
    'H1 a brand-new card never inherits somebody else\'s legacy', JSON.stringify(chain.taught));
  await boot();
  const afterOwner = await tiles();
  check(afterOwner.indexOf('shapes') < 0 && afterOwner.indexOf('library') < 0
        && afterOwner.indexOf('fromWorld') < 0,
    'H2 …so the Studio after the first rite is the one that rite taught',
    afterOwner.join(','));
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === false,
    'H3 …and that child is gated, not grandfathered');

  // ---- J: THE REPAIR, for cards build 0639 already stamped
  //
  // "as of now there is no card which has started story rite 2. i would
  // suggest migration." — the product owner, and that fact is what makes
  // it safe: the worst it can do to a correctly-marked legacy card is
  // hand it the Studio Rite I teaches, which is the one that card has
  // actually earned.
  console.log('-- J: repairing a card that inherited legacy');
  const before = await page.evaluate(() => {
    localStorage.clear();
    // Exactly what 0639 left behind: an older card correctly marked,
    // and a brand-new one that inherited the mark through the sweep.
    const rec = ['legacy-studio', 'emoji', 'text', 'story-name'];
    const old = MagicCard.claim('Old', null, null);
    const fresh = MagicCard.claim('New', null, null);
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    cards.forEach(function (c) { c.taught = rec.slice(); });
    // …and a veteran who has finished no rite since: no record at all.
    cards.push({ id: 'card-veteran', nickname: 'Vet', constellation: 'ORION',
                 pattern: [[0, 0]], claimedAt: new Date(0).toISOString(),
                 lastActiveAt: new Date(0).toISOString() });
    localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    localStorage.removeItem('vihu.magicCard.legacyRepaired');
    // The backfill is not what is under test here, and it would stamp
    // the record-less veteran below before this check could look at it.
    localStorage.setItem('vihu.magicCard.taughtBackfilled', '1');
    MagicCard.setActive(fresh.id);
    return { taught: MagicCard.taught(), grandfathered: StudioRite.isGrandfathered() };
  });
  check(before.grandfathered === true,
    'J0 the card 0639 minted is grandfathered before the repair', JSON.stringify(before.taught));

  await boot();   // the repair runs once at load
  const after = await page.evaluate(() => {
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    const vet = cards.find(function (c) { return c.id === 'card-veteran'; });
    return {
      taught: MagicCard.taught(),
      grandfathered: StudioRite.isGrandfathered(),
      anyLegacy: cards.some(function (c) { return (c.taught || []).indexOf('legacy-studio') >= 0; }),
      vetUntouched: !!vet && !('taught' in vet)
    };
  });
  check(after.anyLegacy === false, 'J1 no card carries the inherited mark any more');
  check(after.grandfathered === false, 'J2 …so that child is gated again');
  check(JSON.stringify(after.taught) === JSON.stringify(['emoji', 'text', 'story-name']),
    'J3 …and keeps exactly what the rite actually taught it', JSON.stringify(after.taught));
  check(after.vetUntouched,
    'J4 the legacy repair leaves a record-less veteran alone');
  const jTiles = await tiles();
  check(jTiles.indexOf('shapes') < 0 && jTiles.indexOf('library') < 0,
    'J5 …and the Studio is the one that rite taught', jTiles.join(','));
  // One-shot: it must not keep running and must not fight a later grant.
  await page.evaluate(() => MagicCard.setTaught(MagicCard.taught().concat(['legacy-studio'])));
  await boot();
  check(await page.evaluate(() => MagicCard.taught().indexOf('legacy-studio') >= 0),
    'J6 it is one-shot per device — a later legacy mark is left alone');

  // ---- K: THE BACKFILL, for a card that never had a record at all
  //
  // "{'taught':null,'gf':true,'gated':false,'cards':[{'n':'Vihu01'}]}" —
  // the product owner's own identity on build 0641. It predates the
  // record, absence means grandfathered, and the 0641 repair correctly
  // did not touch it. His decision, on his own fact that no card has
  // started Rite II: stamp what Rite I teaches.
  console.log('-- K: a card that never had a record');
  await page.evaluate(() => {
    localStorage.clear();
    const c = MagicCard.claim('Vihu01', null, null);
    MagicCard.setActive(c.id);
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    cards.forEach((x) => delete x.taught);
    localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    localStorage.removeItem('vihu.magicCard.taughtBackfilled');
  });
  await boot();
  const backfilled = await page.evaluate(() => ({
    taught: MagicCard.taught(),
    gf: StudioRite.isGrandfathered(),
    gated: document.body.classList.contains('studio-gated')
  }));
  check(Array.isArray(backfilled.taught) && backfilled.taught.indexOf('emoji') >= 0,
    'K1 it is stamped with what the first rite teaches', JSON.stringify(backfilled.taught));
  check(backfilled.taught.indexOf('shapes') < 0 && backfilled.taught.indexOf('library') < 0,
    'K2 …and with nothing a later rite teaches', JSON.stringify(backfilled.taught));
  check(backfilled.gf === false && backfilled.gated === true,
    'K3 …so that Creator is gated rather than grandfathered', JSON.stringify(backfilled));
  const kTiles = await tiles();
  check(kTiles.length === 2 && kTiles.indexOf('stickers') >= 0 && kTiles.indexOf('text') >= 0,
    'K4 …and meets the Studio the first rite taught: Emojis and Text', kTiles.join(','));

  // THE PROMISE THE MIGRATION WAS CHOSEN ON: absence-grandfathering
  // stays the LIVE rule. Only the cards standing there at the moment it
  // ran are stamped; a card that arrives afterwards — recalled onto a
  // deployment whose column is missing, say — keeps every control.
  await page.evaluate(() => {
    const cards = JSON.parse(localStorage.getItem('vihu-magic-cards'));
    cards.push({ id: 'card-later', nickname: 'Later', constellation: 'ORION',
                 pattern: [[1, 1]], claimedAt: new Date().toISOString(),
                 lastActiveAt: new Date().toISOString() });
    localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    MagicCard.setActive('card-later');
  });
  await boot();
  check(await page.evaluate(() => StudioRite.isGrandfathered()) === true,
    'K5 a card arriving AFTER the backfill still keeps every control');
  check((await tiles()).length >= 8, 'K6 …the fail-open path is intact');

  check(pageErrors.length === 0, 'F1 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
