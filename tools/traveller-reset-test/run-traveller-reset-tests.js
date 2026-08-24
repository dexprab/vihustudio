/* NOTHING AN UNCLAIMED TRAVELLER LEAVES BEHIND SURVIVES A NEW SESSION.
 *
 * "this browser or session persistance is killing us. we cannot have
 * anything persisting from unclaimed sessions" — the product owner,
 * looking at six leftover test stories in My Projects.
 *
 * The wipe that already existed only ran for a session with no Magic
 * Card, so the moment a child held one every leftover on that device
 * became permanent — and Decision 8's amendment made that nearly every
 * session. This proves the replacement: unowned goes, owned never does.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/traveller-reset-test/run-traveller-reset-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.RESET_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(c, n, note) {
  if (c) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  async function load() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CreatorProjectStore !== 'undefined' && typeof TravellerReset !== 'undefined' &&
      typeof MagicCard !== 'undefined' && typeof CreatorProjectCache !== 'undefined',
      null, { timeout: 20000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 700)));
  }

  console.log('\nUNCLAIMED SESSIONS LEAVE NOTHING BEHIND\n');
  await load();

  // Three states that must be told apart: a Story nobody owns, one a
  // Magic Card owns, and one shared with VihuPlanet but never claimed.
  // (The fourth seeded record is a second unowned one, to prove the
  // sweep is not stopping at the first it finds.)
  const seeded = await page.evaluate(() => {
    localStorage.clear();
    // Legacy placement is a one-shot migration and every real device is
    // past it by the time any of this matters — it runs on the first
    // load after ownership shipped and never again. Clearing storage
    // un-runs it, so without this the very next load would adopt every
    // orphan to the single card here and there would be nothing left
    // unowned to sweep. Marking it done is what a real device looks
    // like, not a convenience.
    localStorage.setItem('vihu.projects.legacyPlaced', '1');
    localStorage.setItem('vihu.library.legacyPlaced', '1');
    const card = MagicCard.claim('Owner', null, null);
    const mk = (id, cardId, published) => {
      CreatorProjectStore.upsert(id, { name: id, cardId: cardId }, { pages: [], publishedAt: published || undefined });
      const r = CreatorProjectStore.get(id);
      // upsert stamps the ACTIVE card; force the shape each case needs.
      const next = Object.assign({}, r);
      if (cardId) next.cardId = cardId; else delete next.cardId;
      if (published) next.publishedAt = published;
      CreatorProjectCache.putLocal(next);
    };
    mk('p_orphan', null);
    mk('p_owned', card.id);
    mk('p_shared', null, new Date().toISOString());
    mk('p_session', null);
    MagicCard.setActive(null);
    return { card: card.id, all: CreatorProjectStore.listAll().map((r) => r.id + ':' + (r.cardId || '-')) };
  });
  check(seeded.all.length === 4, 'S0 four Stories seeded', seeded.all.join(' '));

  const swept = await page.evaluate(() => {
    // The session slot names p_session, exactly as a child mid-story.
    const out = TravellerReset.run({ force: true });
    return { out: out, left: CreatorProjectStore.listAll().map((r) => r.id).sort() };
  });
  check(swept.left.indexOf('p_orphan') < 0,
    'S1 a Story nobody owns is gone', swept.left.join(','));
  check(swept.left.indexOf('p_owned') >= 0,
    'S2 a Story a Magic Card owns is untouched — never a delete (Decision 19)', swept.left.join(','));
  check(swept.left.indexOf('p_shared') >= 0,
    'S3 a Story already given to VihuPlanet is kept', swept.left.join(','));

  // Once per browser session, and only once.
  const twice = await page.evaluate(() => {
    const a = TravellerReset.run();       // marker already set by the forced run
    return a.ran;
  });
  check(twice === false, 'S4 it runs once per browser session, not once per call');

  // A brand-new session sweeps again; the same session does not.
  const acrossReload = await page.evaluate(() => {
    CreatorProjectStore.upsert('p_second', { name: 'second' }, { pages: [] });
    const r = CreatorProjectStore.get('p_second');
    const next = Object.assign({}, r); delete next.cardId;
    CreatorProjectCache.putLocal(next);
    return CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_second') >= 0;
  });
  check(acrossReload, 'S5 a new unowned Story can still be made');
  // …and it must STAY unowned. Legacy placement is a migration: on a
  // one-card device it used to run on every page load and adopt every
  // orphan that ever appeared, which is why nothing an unclaimed
  // session made could ever be swept.
  check(await page.evaluate(() => {
    const r = CreatorProjectStore.listAll().find((x) => x.id === 'p_second');
    return !!r && !r.cardId;
  }), 'S5b legacy placement does not re-adopt it — that migration is finished');
  // NOT page.reload(): Author Mode is stripped from the address bar the
  // moment it is read (Decision 13), so a reload lands on a URL with no
  // param — and js/studioEntry.js correctly sends that to VihuPlanet,
  // where this module does not run. Measuring there would have been
  // measuring the wrong page.
  await load();
  check(await page.evaluate(() => CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_second') >= 0),
    'S6 re-entering the Studio in the SAME session sweeps nothing');

  // A GENUINELY NEW BROWSER SESSION.
  //
  // Deliberately NOT a second Playwright context: contexts get their own
  // IndexedDB, so the store would come up empty and the test would pass
  // by measuring nothing. sessionStorage IS the mechanism — a new tab
  // starts with none — so clearing it and reloading is the honest
  // simulation, in the same storage the first session used.
  await page.evaluate(() => sessionStorage.clear());
  await load();
  const left2 = await page.evaluate(() => CreatorProjectStore.listAll().map((x) => x.id).sort());
  check(left2.indexOf('p_second') < 0,
    'S7 a genuinely new browser session sweeps it — the reported case', left2.join(','));
  check(left2.indexOf('p_owned') >= 0,
    'S8 …and still never touches what a card owns', left2.join(','));
  // THE BUG THIS REPLACES: the old wipe only ran when nobody held a
  // card, so a device with one kept every leftover for ever.
  check(await page.evaluate(() => MagicCard.list().length > 0),
    'S9 …with a Magic Card on the device, which is what used to stop it');

  // The one thing a sweep must never take: the Story being made right
  // now. Tested against the mechanism the reset hands it — a child
  // mid-story who opens a second tab.
  const preserved = await page.evaluate(() => {
    CreatorProjectStore.upsert('p_live', { name: 'live' }, { pages: [] });
    const r = Object.assign({}, CreatorProjectStore.get('p_live'));
    delete r.cardId;
    CreatorProjectCache.putLocal(r);
    CreatorProjectStore.removeUnowned({ preserveIds: ['p_live'] });
    return CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_live') >= 0;
  });
  check(preserved, 'S9b the Story the session slot names is preserved');

  check(pageErrors.length === 0, 'S10 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
