/* A STORY'S VOICE — how long a child waits before they hear it.
 *
 * Reported by the product owner: "in ether if a story has audio, it
 * takes too long to load. kids wont be able to wait for this long."
 *
 * The chain, measured against the code rather than guessed at: the
 * portal HOLDS the arrival page's narration until the Companion has
 * finished greeting (Decision 26) — and playVoice() was also the thing
 * that FETCHED it. So nothing was even asked for until the greeting
 * ended, and only then came a signed URL from Storage (two round trips
 * for a Story somebody else shared, because the current session can
 * never own their folder) and then the audio file itself.
 *
 * Loading is not playing. The welcome still comes first; the voice is
 * simply fetched while Lumo is talking instead of afterwards.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/ether-voice-test/run-ether-voice-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.ETHER_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

const PROJECT = 'proj_test_voice';
const OWNER = 'owner-who-recorded-it';
const GREETING_MS = 2500;   // how long the Companion takes to welcome
const SIGN_MS = 400;        // one Storage round trip

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Only the Audio spy can go in before the page: every module here is
  // declared with a top-level `const`, which is a LEXICAL global — so
  // replacing window.EtherFeed is invisible to js/vihuplanetHome.js,
  // which resolves the binding and not the property. (The same trap
  // Decision 40 already records.) The modules are therefore MUTATED in
  // place once they exist, before the threshold is crossed and before
  // anything they own has been called.
  await page.addInitScript(() => {
    window.__log = [];
    const t0 = Date.now();
    const mark = (what, extra) => window.__log.push({ at: Date.now() - t0, what, extra: extra || null });
    window.__mark = mark;
    const RealAudio = window.Audio;
    window.Audio = function (src) {
      const el = new RealAudio(src);
      el.play = function () { mark('play', el.src || '(warmed)'); return Promise.resolve(); };
      const load = el.load ? el.load.bind(el) : null;
      el.load = function () { mark('load', el.src); if (load) { try { load(); } catch (e) {} } };
      return el;
    };
    window.Audio.prototype = RealAudio.prototype;
  });

  console.log('\nA STORY\'S VOICE\n');

  await page.goto(BASE + '/index.html');
  await page.waitForSelector('[data-begin]', { timeout: 20000 });
  await page.waitForFunction(() =>
    typeof EtherFeed !== 'undefined' && typeof AssetStore !== 'undefined' &&
    typeof EtherHost !== 'undefined', null, { timeout: 20000 });

  await page.evaluate(({ PROJECT, OWNER, GREETING_MS, SIGN_MS }) => {
    const mark = window.__mark;
    const STORY = {
      id: 'story-under-test',
      title: 'The Tiny Forest',
      creator: 'Vihu',
      origin: 'creator',
      publishedAt: new Date().toISOString(),
      pages: 2,
      hasAudio: true,
      cheers: 0, grown: false, growth: 0,
      source: { projectId: PROJECT, origin: 'creator', companion: null },
    };
    const PAGE_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    EtherFeed.attach = (universe) => { universe.seed([STORY]); return Promise.resolve([STORY]); };
    EtherFeed.load = () => Promise.resolve([STORY]);
    EtherFeed.pagesOf = () => [PAGE_IMG, PAGE_IMG];
    EtherFeed.tintsOf = () => ['#123456', '#654321'];
    EtherFeed.audioOf = () => ['vihu-asset:aaaaaaaa', 'vihu-asset:bbbbbbbb'];
    EtherFeed.ownerOf = () => OWNER;

    // The one thing under test is WHEN this is called, and with what.
    AssetStore.resolve = (ref, opts) => {
      mark('resolve', { ref: ref, prefer: (opts && opts.preferOwnerId) || null,
                        fallback: (opts && opts.ownerId) || null });
      return new Promise((r) => setTimeout(() => r('blob:signed/' + ref), SIGN_MS));
    };

    // A Companion that greets, slowly, exactly as the real one does.
    EtherHost.open = (story, opts) => {
      mark('greeting-starts');
      setTimeout(() => {
        mark('greeting-ends');
        try { opts && opts.openingDone && opts.openingDone(); } catch (e) {}
      }, GREETING_MS);
    };
    EtherHost.turned = () => {};
    EtherHost.close = () => {};
  }, { PROJECT, OWNER, GREETING_MS, SIGN_MS });

  await page.click('[data-begin]');
  await page.waitForFunction(() => !!document.querySelector('.vp-story'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  // Meet the Spirit. Clicked through the DOM rather than by pointer: a
  // Spirit drifts, and its own nearness reveal can leave it below
  // Playwright's visibility bar while being perfectly real.
  await page.evaluate(() => { document.querySelector('.vp-story').click(); });
  await page.waitForSelector('[data-act="read"]:not([disabled])', { timeout: 10000 });
  const metAt = await page.evaluate(() => window.__log.slice());
  check(metAt.some((e) => e.what === 'resolve'),
    'V1 meeting a Spirit already starts fetching its voice — the wait begins before the child does',
    JSON.stringify(metAt.filter((e) => e.what === 'resolve')));

  // Step in.
  await page.evaluate(() => { document.querySelector('[data-act="read"]').click(); });
  await page.waitForTimeout(GREETING_MS + 1500);

  const log = await page.evaluate(() => window.__log.slice());
  const first = (what) => log.find((e) => e.what === what);
  const resolves = log.filter((e) => e.what === 'resolve');
  // THE STORY'S VOICE, not the universe's. AudioManager's own ambience
  // is playing the whole time (Decision 39) and it is an <audio> element
  // like any other — the first draft of this check read `forest.mp3` as
  // the child's story starting, and reported a narration that had not
  // happened yet.
  const played = log.find((e) => e.what === 'play' && /signed/.test(String(e.extra || '')));
  const greetEnd = first('greeting-ends');

  check(!!played, 'V2 the story does speak', JSON.stringify(played || null));
  check(!!greetEnd && !!resolves.length && resolves[0].at < greetEnd.at,
    'V3 …and it was fetched WHILE the Companion was greeting, not after',
    JSON.stringify({ firstResolve: resolves[0] && resolves[0].at, greetingEnds: greetEnd && greetEnd.at }));
  check(!!played && !!greetEnd && played.at >= greetEnd.at - 60,
    'V4 …and still waits its turn — Decision 26 is untouched',
    JSON.stringify({ play: played && played.at, greetingEnds: greetEnd && greetEnd.at }));
  check(!!played && !!greetEnd && (played.at - greetEnd.at) < SIGN_MS,
    'V5 …and starts within a breath of the greeting ending, not a round trip later',
    JSON.stringify({ gapMs: played && greetEnd ? played.at - greetEnd.at : null, oneRoundTrip: SIGN_MS }));
  check(resolves.every((e) => e.extra && e.extra.prefer === OWNER),
    'V6 the folder asked for first is the one that actually holds the recording',
    JSON.stringify(resolves.map((e) => e.extra)));

  // One page ahead, and no more.
  const refs = new Set(resolves.map((e) => e.extra && e.extra.ref));
  check(refs.size <= 2, 'V7 one page ahead, never the whole story',
    Array.from(refs).join(', '));

  check(pageErrors.length === 0, 'V8 zero page errors', pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
