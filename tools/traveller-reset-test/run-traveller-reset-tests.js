/* A TRAVELLER IS STATELESS.
 *
 * "i would like to keep travellers stateless. once they are out of
 * vihuplanet once the vihuplanet is reloaded, anything not attached
 * with a card lets remove that." — the product owner.
 *
 * So: if it is not attached to a Magic Card it does not survive a
 * VihuPlanet load. Stories, drawings, letters, the garden, and the
 * record that the Rite was completed — the child walks all 23 beats
 * again. Owned work is never touched, which is what lets this run for
 * everybody rather than only for a session holding nothing.
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
    return TravellerReset.run({ preserveSession: false }).then(function (out) {
      return { out: out, left: CreatorProjectStore.listAll().map((r) => r.id).sort() };
    });
  });
  check(swept.left.indexOf('p_orphan') < 0,
    'S1 a Story nobody owns is gone', swept.left.join(','));
  check(swept.left.indexOf('p_owned') >= 0,
    'S2 a Story a Magic Card owns is untouched — never a delete (Decision 19)', swept.left.join(','));
  // NOT exempt any more. "anything not attached with a card" — and a
  // shared Story lives in the Ether from the platform's own shared feed
  // (Decision 15), so the local record is not what keeps it there.
  check(swept.left.indexOf('p_shared') < 0,
    'S3 a shared Story with no card behind it goes too', swept.left.join(','));

  // THE RITE RECORD GOES WITH IT — the child walks all 23 beats again.
  const riteGone = await page.evaluate(() => ({
    flag: localStorage.getItem(StudioRite.FLAG_KEY),
    taught: localStorage.getItem(StudioRite.TAUGHT_KEY),
    complete: StudioRite.isComplete()
  }));
  check(riteGone.flag === null && riteGone.taught === null && riteGone.complete === false,
    'S4 a Traveller who did the Rite is asked to walk it again', JSON.stringify(riteGone));

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
  // THE BOUNDARY IS VIHUPLANET, and this is the reported journey:
  // make something unclaimed, go home, come back. Deliberately a real
  // navigation to index.html rather than a simulated "new session" —
  // there is no marker any more, because arriving at VihuPlanet IS the
  // fresh start (Decisions 10 and 23) and that is the whole design.
  //
  // Not page.reload() for the Studio either: Author Mode is stripped
  // from the address bar the moment it is read (Decision 13), so a
  // reload lands on a URL with no param and js/studioEntry.js correctly
  // sends it home. Measuring there would be measuring the wrong page.
  await page.evaluate(() => { try { StudioRite.markComplete(); } catch (e) {} });
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof TravellerReset !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1800)));
  const atHome = await page.evaluate(() => ({
    left: CreatorProjectStore.listAll().map((x) => x.id).sort(),
    rite: localStorage.getItem('vihu.studioRite.v1'),
    cards: MagicCard.list().length
  }));
  check(atHome.left.indexOf('p_second') < 0,
    'S6 loading VihuPlanet removes what no card is attached to', atHome.left.join(','));
  check(atHome.left.indexOf('p_owned') >= 0,
    'S7 …and never what a card owns', atHome.left.join(','));
  check(atHome.rite === null,
    'S7b …and the Rite has to be walked again', String(atHome.rite));
  // THE BUG THIS REPLACES: the old wipe only ran when nobody held a
  // card, so one card on the device made every leftover permanent.
  check(atHome.cards > 0,
    'S8 …with a Magic Card on the device, which is what used to stop it');

  await load();
  check(await page.evaluate(() => CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_second') < 0),
    'S9 coming back to the Studio, it is still gone');

  // THE STORY THE PAGE WAS OPENED TO SHOW survives that one load —
  // Story Birth (?born=) and a deep link (?story=) would otherwise
  // delete the thing they exist to display. Intent may cross; state
  // may not (Decision 23).
  await page.evaluate(() => {
    CreatorProjectStore.upsert('p_born', { name: 'born' }, { pages: [] });
    const r = Object.assign({}, CreatorProjectStore.get('p_born')); delete r.cardId;
    CreatorProjectCache.putLocal(r);
  });
  await page.goto(BASE + '/index.html?born=p_born');
  await page.waitForFunction(() => typeof TravellerReset !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1800)));
  check(await page.evaluate(() => CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_born') >= 0),
    'S9c a Story arriving through ?born= is not deleted out from under itself');
  await page.goto(BASE + '/index.html');
  await page.waitForFunction(() => typeof TravellerReset !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1800)));
  check(await page.evaluate(() => CreatorProjectStore.listAll().map((x) => x.id).indexOf('p_born') < 0),
    'S9d …and nothing is remembered: the next load takes it');

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
