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
  // NOT A WALL: a capability no runnable rite reveals has no door, so
  // it is never hidden. From This World and Voice stay until the rite
  // that teaches them exists and names them.
  check(afterI.indexOf('fromWorld') >= 0 && afterI.indexOf('voice') >= 0,
    'B6 controls no rite can teach are never hidden — a shelf, not a wall', afterI.join(','));
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
  check(afterII.indexOf('shapes') < 0, 'C4 …and the third rite\'s tiles still are not', afterII.join(','));

  // ---- D: everything taught
  console.log('-- D: after every rite');
  await page.evaluate(() => {
    MagicCard.setTaught(MagicCard.taught().concat(['shapes','doodle','photo','blank-page']));
  });
  await boot();
  const afterIII = await tiles();
  check(afterIII.length >= 8, 'D1 every tile is back', afterIII.join(','));
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
  check((await tiles()).length >= 8, 'G2 they keep every control they have had for weeks');
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-garden',
    'G3 …and the next door is still offered — they have walked no story yet');
  // Walking it must record the story, not swallow the whole ladder.
  await page.evaluate(() => {
    MagicCard.setTaught(['legacy-studio', 'garden', 'handwriting', 'library']);
  });
  await boot();
  check((await tiles()).length >= 8, 'G4 after that story they still keep everything');
  check(await page.evaluate(() => StudioRite.nextOptIn()) === 'my-little-house',
    'G5 …and the door after it is offered, not swallowed');
  check(await page.evaluate(() => StudioRite.taught().indexOf('shapes') >= 0),
    'G6 legacy widens the controls');

  check(pageErrors.length === 0, 'F1 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
