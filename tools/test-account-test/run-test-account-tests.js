/* TEST ACCOUNTS — the development utility that mints an account at a
 * chosen point in the journey, with a chosen Companion.
 *
 * What matters here is that the utility tells no lies about the
 * product: the rite levels must come from StudioRite's own registry
 * (never a copied list), the card it mints must be exactly what
 * claim() + setTaught() produce, the door Studio Home would offer must
 * be the one the level implies, and "Enter the Studio now" must
 * actually land in the Studio — Decision 23's gate bounces a load with
 * no entry pass back to VihuPlanet, so arriving AND staying is the
 * proof the pass was minted.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/test-account-test/run-test-account-tests.js
 */
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.TESTACCT_PORT || 8796);
const BASE = 'http://127.0.0.1:' + PORT;

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  console.log('\nTEST ACCOUNTS — a card at any point in the journey, honestly\n');
  const server = spawn('node',
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)],
    { stdio: 'ignore' });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    // The harness has no platform; the config 404s and every platform
    // write inside claim() degrades silently, exactly as offline does.
    await page.route('**/supabase-config.json', (r) => r.fulfill({ status: 404, body: '' }));

    const open = async () => {
      await page.goto(BASE + '/tools/test-account/index.html');
      await page.waitForFunction(() =>
        typeof MagicCard !== 'undefined' && typeof StudioRite !== 'undefined' &&
        document.querySelectorAll('.start').length > 0 &&
        (document.querySelectorAll('.mate').length > 0 ||
         document.querySelector('#mates .warnnote')), null, { timeout: 20000 });
    };
    await open();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await open();

    // ---- T1: the choices are the product's own ---------------------
    const mates = await page.evaluate(async () => {
      const reg = await fetch('/assets/registry.json').then((r) => r.json());
      const want = reg.companions.filter((c) => c.role === 'companion').map((c) => c.name).sort();
      const got = Array.from(document.querySelectorAll('.mate b')).map((b) => b.textContent).sort();
      return { want, got };
    });
    ck(mates.got.length === mates.want.length &&
       mates.got.every((n, i) => n === mates.want[i]),
       'T1  EVERY COMPANION IN THE REGISTRY IS OFFERED — and nobody else', mates.got.join(','));

    const starts = await page.evaluate(() => {
      const runnable = StudioRite.rites().filter((r) => r.runnable);
      return {
        runnable: runnable.map((r) => r.id),
        options: Array.from(document.querySelectorAll('.start b')).map((b) => b.textContent),
      };
    });
    ck(starts.options.length === starts.runnable.length + 1 &&
       /fresh Traveller/.test(starts.options[0]) &&
       /Everything taught/.test(starts.options[starts.options.length - 1]) &&
       starts.runnable.slice(1).every((id, i) => starts.options[i + 1].indexOf(id) !== -1),
       'T2  THE LEVELS ARE READ OFF THE REGISTRY — one per runnable rite, never a copied list',
       starts.options.join(' | '));

    // ---- T3: a "Story Rite 2 waiting" account ----------------------
    const made2 = await page.evaluate(() => {
      document.getElementById('nick').value = 'RiteTwo';
      const quill = Array.from(document.querySelectorAll('.mate'))
        .find((m) => m.querySelector('b').textContent === 'Quill');
      quill.click();
      document.querySelector('.start[data-i="1"]').click();
      document.getElementById('make').click();
      const card = MagicCard.getActive();
      const runnable = StudioRite.rites().filter((r) => r.runnable);
      const grant = (r) => r.teaches.concat(r.reveals);
      return {
        nick: card && card.nickname, companion: card && card.companionId,
        species: card && card.companionSpecies,
        taught: (card && card.taught || []).slice().sort(),
        want: grant(runnable[0]).slice().sort(),
        next: StudioRite.nextOptIn(), wantNext: runnable[1] ? runnable[1].id : null,
        shown: !document.getElementById('made').classList.contains('hidden'),
      };
    });
    ck(made2.nick === 'RiteTwo' && made2.companion === 'quill' && made2.species === 'Ink Spirit',
       'T3  THE CARD IS MINTED WITH THE CHOSEN COMPANION — id and species from the registry');
    ck(JSON.stringify(made2.taught) === JSON.stringify(made2.want) && made2.taught.length > 0,
       'T3b and taught is EXACTLY the mandatory rite\'s grant — teaches ∪ reveals, nothing else',
       made2.taught.join(','));
    ck(made2.next === made2.wantNext && made2.shown,
       'T3c so the door Studio Home offers is the second runnable rite', String(made2.next));

    // ---- T4: "Story Rite 3 waiting" --------------------------------
    const made3 = await page.evaluate(() => {
      document.getElementById('nick').value = 'RiteThree';
      document.querySelector('.start[data-i="2"]').click();
      document.getElementById('make').click();
      const card = MagicCard.getActive();
      const runnable = StudioRite.rites().filter((r) => r.runnable);
      const grant = (r) => r.teaches.concat(r.reveals);
      return {
        taught: (card && card.taught || []).slice().sort(),
        want: grant(runnable[0]).concat(grant(runnable[1])).slice().sort(),
        next: StudioRite.nextOptIn(), wantNext: runnable[2] ? runnable[2].id : null,
      };
    });
    ck(JSON.stringify(made3.taught) === JSON.stringify(made3.want) &&
       made3.next === made3.wantNext,
       'T4  RITE 3 WAITING — the first two rites\' grants, and the third door offered',
       String(made3.next));

    // ---- T5: everything taught -------------------------------------
    const madeAll = await page.evaluate(() => {
      document.getElementById('nick').value = 'AllOfIt';
      const last = document.querySelectorAll('.start').length - 1;
      document.querySelector('.start[data-i="' + last + '"]').click();
      document.getElementById('make').click();
      return { next: StudioRite.nextOptIn() };
    });
    ck(madeAll.next === null,
       'T5  EVERYTHING TAUGHT — no door waiting, the full Studio');

    // ---- T6: fresh Traveller ---------------------------------------
    const fresh = await page.evaluate(() => {
      document.querySelector('.start[data-i="0"]').click();
      document.getElementById('make').click();
      return {
        active: MagicCard.getActive(),
        cards: MagicCard.list().length,
        flag: localStorage.getItem(StudioRite.FLAG_KEY),
        taughtKey: localStorage.getItem(StudioRite.TAUGHT_KEY),
      };
    });
    ck(fresh.active === null && fresh.cards === 3 &&
       fresh.flag === null && fresh.taughtKey === null,
       'T6  A FRESH TRAVELLER holds no card and no rite record — and the existing cards are NEVER deleted',
       fresh.cards + ' cards kept');

    // ---- T7: the Studio door actually opens ------------------------
    // Switch back to a real account first, then press the panel's own
    // Enter the Studio. Landing on studio.html and STAYING there is
    // the proof: Decision 23's inline gate sends a passless load back
    // to VihuPlanet, so a missing StudioEntry.pass() cannot pass this.
    await page.evaluate(() => {
      const use = document.querySelector('#cards .use');
      if (use) use.click();
    });
    await page.click('#goStudio');
    await page.waitForURL('**/studio.html*', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const landed = page.url();
    ck(/studio\.html/.test(landed) && !/index\.html/.test(landed),
       'T7  ENTER THE STUDIO NOW lands in the Studio and stays — the entry pass was minted', landed);

    ck(pageErrors.length === 0, 'T8  zero page errors across the whole journey',
       pageErrors.slice(0, 2).join(' | ') || 'clean');
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('\n' + (failed ? 'FAILED' : 'PASSED') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
})();
