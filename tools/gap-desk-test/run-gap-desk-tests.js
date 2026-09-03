/* THE GAP REVIEW DESK — what an administrator actually sees (Sprint R6.1).
 *
 * admin/gaps.html is the reading half of Decision 57's learning loop, and
 * this drives the REAL page with a stubbed client, the invite desk's own
 * discipline: every branch under test is the page's code, reached the way
 * a browser reaches it, and what is asserted is the sentence or the row a
 * person would actually see.
 *
 * The stub is of the CLIENT (supabase-js at its esm.sh import), never of
 * the page. Its rpc records every call and answers from a scenario the
 * test declares, so "the resolve button calls gap_log_resolve with this
 * row's id" is measured as traffic rather than read off the source.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8797 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/gap-desk-test/run-gap-desk-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.GAP_DESK_PORT || 8797);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok   ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

// The client stub. `window.__scenario.rpc(name, args)` decides every rpc
// answer, so a test declares behaviour per scenario; every call lands in
// `window.__rpcCalls` for the traffic assertions.
const SUPA_STUB = (signedIn) => `
export function createClient() {
  globalThis.__rpcCalls = [];
  return {
    auth: {
      getSession: async () => ({ data: { session: ${signedIn ? "{ access_token: 't' }" : 'null'} } }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
    },
    rpc: async (name, args) => {
      globalThis.__rpcCalls.push({ name, args });
      const s = globalThis.__scenario || {};
      return (s.rpc ? s.rpc(name, args) : { data: null, error: null });
    },
  };
}`;

// A believable review answer. `said` below deliberately carries markup in
// one row — a child's sentence is DATA, and the desk must show it as text.
const GAPS = [
  { id: 1, at: '2026-09-03T10:00:00Z', surface: 'studio', screen: 'story-editor',
    companion: 'leafy', said: 'What happens when I Keep a Gift?',
    reply: "I don't know that one. I'd only be guessing.",
    context: [{ s: 'creator', t: 'hello' }, { s: 'companion', t: 'Hey!' }],
    classification: 'vihuplanet_knowledge_missing', resolution: 'open' },
  { id: 2, at: '2026-09-03T10:05:00Z', surface: 'ether', screen: '',
    companion: 'quill', said: '<img src=x onerror="window.__xss=1">',
    reply: '', context: null,
    classification: 'model_capability', resolution: 'open' },
  { id: 3, at: '2026-09-03T10:07:00Z', surface: 'studio', screen: 'studio-home',
    companion: 'leo', said: 'keep this a secret',
    reply: "I'm no good at hiding things.", context: null,
    classification: 'safety_restriction', resolution: 'by-design' },
];

async function open(browser, { signedIn = true, scenario }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(scenario || 'globalThis.__scenario = {};');
  await page.route('https://esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_STUB(signedIn) }));
  await page.goto(BASE + '/admin/gaps.html');
  await page.waitForTimeout(900);
  return { page, errors };
}

const OK_SCENARIO = `globalThis.__scenario = {
  gaps: ${JSON.stringify(GAPS)},
  rpc(name, args) {
    if (name === 'gap_log_review') {
      const st = args && args.p_status;
      const rows = st ? this.gaps.filter((g) => g.resolution === st) : this.gaps;
      return { data: { ok: true, gaps: rows }, error: null };
    }
    if (name === 'gap_log_resolve') {
      const g = this.gaps.find((x) => x.id === (args && args.p_id));
      if (g) g.resolution = args.p_status;
      return { data: { ok: true }, error: null };
    }
    return { data: null, error: null };
  },
};`;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  console.log('\nTHE GAP REVIEW DESK\n');
  const allErrors = [];

  // ---- D1: not signed in — the gate, and nothing else -------------
  {
    const { page, errors } = await open(browser, { signedIn: false });
    const gate = await page.evaluate(() => ({
      gate: !document.getElementById('gate').classList.contains('hidden'),
      desk: document.getElementById('desk').classList.contains('hidden'),
      calls: (globalThis.__rpcCalls || []).length,
    }));
    check(gate.gate && gate.desk && gate.calls === 0,
      'D1  not signed in: the gate stands and nothing is asked of the platform',
      JSON.stringify(gate));
    allErrors.push(...errors); await page.close();
  }

  // ---- D2: an administrator sees the open gaps --------------------
  {
    const { page, errors } = await open(browser, { scenario: OK_SCENARIO });
    const seen = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#rows tr')];
      return {
        desk: !document.getElementById('desk').classList.contains('hidden'),
        rows: rows.length,
        firstSaid: rows[0] ? rows[0].querySelector('.said').textContent : '',
        firstReply: rows[0] ? rows[0].querySelector('.reply').textContent : '',
        firstCls: rows[0] ? rows[0].querySelector('.cls').textContent : '',
        silent: rows[1] ? rows[1].querySelector('.reply').classList.contains('silent') : false,
        reviewArgs: (globalThis.__rpcCalls || []).find((c) => c.name === 'gap_log_review'),
      };
    });
    check(seen.desk && seen.rows === 2
      && /Keep a Gift/.test(seen.firstSaid) && /only be guessing/.test(seen.firstReply)
      && /VihuPlanet knowledge missing/.test(seen.firstCls),
      'D2  an administrator sees the open gaps, question and answer together',
      seen.rows + ' rows, ' + JSON.stringify(seen.firstCls));
    check(seen.reviewArgs && seen.reviewArgs.args && seen.reviewArgs.args.p_status === 'open',
      'D2b and OPEN is the working set — the server filter, not a client trim',
      JSON.stringify(seen.reviewArgs && seen.reviewArgs.args));
    check(seen.silent,
      'D2c a Companion that said nothing reads as "said nothing", never as a hole');

    // ---- D3: A CHILD'S SENTENCE IS DATA, NEVER MARKUP -------------
    const xss = await page.evaluate(() => ({
      ran: !!window.__xss,
      imgs: document.querySelectorAll('#rows img').length,
      shown: [...document.querySelectorAll('#rows .said')]
        .some((el) => /onerror/.test(el.textContent)),
    }));
    check(!xss.ran && xss.imgs === 0 && xss.shown,
      'D3  a sentence carrying markup renders as text — nothing executes',
      JSON.stringify(xss));

    // ---- D4: resolve is real traffic, and the desk reloads --------
    await page.evaluate(() => {
      [...document.querySelectorAll('#rows button[data-to]')]
        .find((b) => b.dataset.to === 'addressed').click();
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      resolve: (globalThis.__rpcCalls || []).find((c) => c.name === 'gap_log_resolve'),
      rows: document.querySelectorAll('#rows tr').length,
    }));
    check(after.resolve && after.resolve.args.p_id === 1
      && after.resolve.args.p_status === 'addressed' && after.rows === 1,
      'D4  "addressed" calls gap_log_resolve with THAT row and the list reloads',
      JSON.stringify(after.resolve && after.resolve.args) + ', ' + after.rows + ' open left');

    // ---- D5: the status filter is the server\'s own ---------------
    await page.evaluate(() => {
      [...document.querySelectorAll('#statusRow .chip')]
        .find((b) => b.dataset.status === 'by-design').click();
    });
    await page.waitForTimeout(400);
    const byDesign = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#rows tr')];
      const last = (globalThis.__rpcCalls || []).filter((c) => c.name === 'gap_log_review').pop();
      return {
        p_status: last && last.args && last.args.p_status,
        rows: rows.length,
        res: rows[0] ? rows[0].querySelector('.res').textContent : '',
        reopen: rows[0] ? [...rows[0].querySelectorAll('button[data-to]')].map((b) => b.dataset.to) : [],
      };
    });
    check(byDesign.p_status === 'by-design' && byDesign.rows === 1
      && byDesign.res === 'by-design' && String(byDesign.reopen) === 'open',
      'D5  a boundary that held shows as by-design, with reopen as its only action',
      JSON.stringify(byDesign));
    allErrors.push(...errors); await page.close();
  }

  // ---- D6: the refusals say WHICH problem -------------------------
  {
    const notAdmin = `globalThis.__scenario = { rpc(name) {
      if (name === 'gap_log_review') return { data: { ok: false, reason: 'not_yours' }, error: null };
      return { data: null, error: null };
    } };`;
    const { page, errors } = await open(browser, { scenario: notAdmin });
    const msg = await page.evaluate(() => document.getElementById('msg').textContent);
    check(/not an administrator/i.test(msg) && !/not_yours|error|500/i.test(msg),
      'D6  not an administrator is its own sentence — no codes, no jargon',
      JSON.stringify(msg));
    allErrors.push(...errors); await page.close();
  }
  {
    const noMigration = `globalThis.__scenario = { rpc(name) {
      return { data: null, error: { message:
        'Could not find the function public.gap_log_review(p_limit, p_status) in the schema cache' } };
    } };`;
    const { page, errors } = await open(browser, { scenario: noMigration });
    const msg = await page.evaluate(() => document.getElementById('msg').textContent);
    check(/migrations_gap_log\.sql/.test(msg),
      'D6b a missing function names the migration to run, not a broken page',
      JSON.stringify(msg));
    allErrors.push(...errors); await page.close();
  }

  // ---- D7: an empty open set is a kind sentence -------------------
  {
    const empty = `globalThis.__scenario = { rpc(name) {
      if (name === 'gap_log_review') return { data: { ok: true, gaps: [] }, error: null };
      return { data: null, error: null };
    } };`;
    const { page, errors } = await open(browser, { scenario: empty });
    const state = await page.evaluate(() => ({
      empty: document.getElementById('empty').textContent,
      hidden: document.getElementById('empty').classList.contains('hidden'),
    }));
    check(!state.hidden && /No open gaps/.test(state.empty),
      'D7  no open gaps is good news and reads like it', JSON.stringify(state.empty));
    allErrors.push(...errors); await page.close();
  }

  check(allErrors.length === 0, 'Z1  zero page errors across every journey',
    allErrors.slice(0, 2).join(' | ') || 'none');

  await browser.close();
  const verdict = failed === 0
    ? 'ALL GREEN — ' + passed + ' passed, 0 failed'
    : 'FAILURES — ' + passed + ' passed, ' + failed + ' failed';
  console.log('\n' + verdict);
  process.exit(failed === 0 ? 0 : 1);
})();
