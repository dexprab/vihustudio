/* SPRINT R6 — THE CONVERSATION GAP LOG.
 *
 * Product-learning instrumentation, never Companion memory: every time
 * a Companion cannot adequately answer, the exchange is recorded with a
 * classification so recurring gaps can be reviewed and the knowledge,
 * context or instructions improved.
 *
 *   P. THE DATABASE, EXECUTED (supabase/migrations_gap_log.sql)
 *      · insert is session-derived, never claimed; unauthenticated is
 *        refused
 *      · the table is unreadable by any client — RLS on, NO policies;
 *        review is administrators only (is_platform_admin)
 *      · rate-capped per session; text capped at the door;
 *        classification whitelisted
 *   G. THE CLASSIFIER, UNIT-PROVED (vm — the real module)
 *      · "What happens when I Keep a Gift?" → vihuplanet_knowledge_missing
 *        (the owner's own example of a gap the product should close)
 *      · "What is a volcano?" → model_capability (the owner's own
 *        example of a gap that is NOT a missing canon)
 *      · an adequate answer logs NOTHING; deliberate silence logs
 *        NOTHING; a boundary logs as by-design, never an open defect
 *      · the local buffer is capped; no entry carries a card, a name
 *        or a memory; the module cannot reach CompanionMemory
 *   E. THE REAL SURFACE (browser)
 *      · an unanswerable question through the real chat lands in the
 *        log with surface, screen and companion — and writes NO memory
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-gap-test/run-companion-gap-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.GAP_PORT || 8809);
const BASE = 'http://127.0.0.1:' + PORT;
const PGDIR = '/tmp/vihu-gap-pg';
const PGPORT = 55449;

let passed = 0, failed = 0, skipped = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function sk(n, why) { skipped++; console.log('  --   ' + n + '  (' + why + ')'); }
function ck(c, n, note) { (c ? ok : no)(n, note); }
function section(t) { console.log('\n' + t); }
function sh(c) { return cp.execSync(c, { encoding: 'utf8' }); }

const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';

// ===================================================================
section('P. THE DATABASE, EXECUTED  (supabase/migrations_gap_log.sql)');
// ===================================================================
(function () {
  const pg = startPg();
  if (!pg) { sk('P1-P9  the whole database section', 'no PostgreSQL'); return; }
  try {
    let err = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (err) { no('P0  the fixture loads', err.split('\n')[0]); return; }
    const m1 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_gap_log.sql'));
    const m2 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_gap_log.sql'));
    ck(!m1 && !m2, 'P0  the migration applies, and applies twice', m1 || m2 || 'clean');
    if (m1 || m2) return;
    psql(pg, 'grant select, insert, update, delete on public.conversation_gaps to anon, authenticated;');

    const call = (uid, fn, args) => {
      const r = asSession(pg, uid, `select public.${fn}(${args});`);
      try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); }
      catch (e) { return {}; }
    };

    let r = call(A_UID, 'gap_log_insert',
      `'{"surface":"studio","companion":"leafy","said":"what happens when I keep a gift?","reply":"I don''t know that one.","classification":"vihuplanet_knowledge_missing"}'::jsonb`);
    ck(r.ok === true, 'P1  A VERIFIED SESSION MAY REPORT ITS OWN GAP', JSON.stringify(r));
    const noUid = psql2(pg, ['begin;', 'set local role anon;',
      `select public.gap_log_insert('{"said":"x"}'::jsonb);`, 'commit;'].join('\n'));
    ck(/unauthorized/.test(noUid.out),
       'P2  AND NOBODY ELSE — no session, no report', noUid.out.slice(0, 60));

    const readB = asSession(pg, B_UID, 'select count(*) from public.conversation_gaps;');
    ck(/^0$/m.test(readB.out || '') || readB.code !== 0,
       'P3  THE TABLE IS UNREADABLE BY ANY CLIENT — RLS on, no policies, the review function is the only window',
       (readB.out || readB.err || '').slice(0, 40));

    // a SIGNED-IN session that is not an administrator (role
    // authenticated, no admin email) — the anon role is refused even
    // earlier, by the grant itself
    const rev = psql2(pg, ['begin;', 'set local role authenticated;',
      `set local "test.uid" = '${B_UID}';`,
      `select public.gap_log_review(50, null);`, 'commit;'].join('\n'));
    let revBody = {};
    try { revBody = JSON.parse(lines(rev).find((l) => l.startsWith('{')) || '{}'); } catch (e) {}
    ck(revBody.ok === false && revBody.reason === 'not_yours',
       'P4  REVIEW REFUSES A NON-ADMINISTRATOR', JSON.stringify(revBody));
    psql(pg, `insert into public.platform_admins(email, note) values ('owner@test', 'suite') on conflict do nothing;`);
    const adm = psql2(pg, ['begin;', 'set local role authenticated;',
      `set local "test.uid" = '${B_UID}';`, `set local "test.email" = 'owner@test';`,
      `select public.gap_log_review(50, null);`, 'commit;'].join('\n'));
    let admBody = {};
    try { admBody = JSON.parse(lines(adm).find((l) => l.startsWith('{')) || '{}'); } catch (e) {}
    ck(admBody.ok === true && Array.isArray(admBody.gaps) && admBody.gaps.length === 1
       && admBody.gaps[0].classification === 'vihuplanet_knowledge_missing'
       && admBody.gaps[0].resolution === 'open',
       'P5  AN ADMINISTRATOR REVIEWS — newest first, classification and status carried',
       JSON.stringify(admBody.gaps && admBody.gaps[0] && admBody.gaps[0].classification));

    r = call(A_UID, 'gap_log_insert',
      `'{"said":"q","reply":"a","classification":"totally_made_up"}'::jsonb`);
    const cls = psql(pg, `select classification from public.conversation_gaps order by id desc limit 1;`);
    ck(r.ok === true && cls === 'other',
       'P6  AN UNKNOWN CLASSIFICATION IS STORED AS other — the whitelist is the server\'s, not the client\'s', cls);

    call(A_UID, 'gap_log_insert',
      `'{"said":"${'x'.repeat(2000)}","reply":"r"}'::jsonb`);
    const len = psql(pg, `select length(said) from public.conversation_gaps order by id desc limit 1;`);
    ck(Number(len) <= 500,
       'P7  TEXT IS CAPPED AT THE DOOR — the log can never become free storage', len + ' chars kept');

    // the rate cap: burn the hour's allowance and watch the door shut
    for (let i = 0; i < 45; i++) {
      call(A_UID, 'gap_log_insert', `'{"said":"burn ${i}","reply":"r"}'::jsonb`);
    }
    r = call(A_UID, 'gap_log_insert', `'{"said":"one more","reply":"r"}'::jsonb`);
    ck(r.ok === false && r.reason === 'rate',
       'P8  RATE-CAPPED PER SESSION PER HOUR', JSON.stringify(r));

    const idRow = psql(pg, `select id from public.conversation_gaps order by id asc limit 1;`);
    const rr = psql2(pg, ['begin;', 'set local role authenticated;',
      `set local "test.uid" = '${B_UID}';`,
      `select public.gap_log_resolve(${idRow}, 'reviewed');`, 'commit;'].join('\n'));
    ck(/not_yours/.test(rr.out),
       'P9a RESOLVE REFUSES A NON-ADMINISTRATOR', (rr.out || '').slice(0, 50));
    const res = psql2(pg, ['begin;', 'set local role authenticated;',
      `set local "test.uid" = '${B_UID}';`, `set local "test.email" = 'owner@test';`,
      `select public.gap_log_resolve(${idRow}, 'reviewed');`, 'commit;'].join('\n'));
    const after = psql(pg, `select resolution from public.conversation_gaps where id = ${idRow};`);
    ck(/"ok"\s*:\s*true/.test(res.out) && after === 'reviewed',
       'P9b AND WORKS FOR ONE — a reviewed gap is marked, never deleted', after);
  } finally { stopPg(pg); }
})();

// ===================================================================
section('G. THE CLASSIFIER, UNIT-PROVED  (the real js/companionGapLog.js)');
// ===================================================================
{
  const src = fs.readFileSync(path.join(ROOT, 'js', 'companionGapLog.js'), 'utf8');
  const store = {};
  const box = vm.createContext({
    console: console, setTimeout: setTimeout,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    window: {},
  });
  vm.runInContext(src + '\n;this.G = CompanionGapLog;', box);
  const G = box.G;

  // The owner's own two examples, side by side — the line between a
  // gap the product should close and a gap that is not a missing canon.
  const keep = G.consider({ surface: 'studio', companion: 'leafy',
    said: 'What happens when I Keep a Gift?',
    reply: "I don't know that one. I'd only be guessing.", intent: 'unknown' });
  ck(!!keep && keep.classification === 'vihuplanet_knowledge_missing'
     && keep.resolution === 'open',
     'G1  "What happens when I Keep a Gift?" → vihuplanet_knowledge_missing, open',
     keep && keep.classification);
  const volcano = G.consider({ surface: 'studio', companion: 'leafy',
    said: 'What is a volcano?',
    reply: "I don't know that one. I'd only be guessing.", intent: 'unknown' });
  ck(!!volcano && volcano.classification === 'model_capability',
     'G2  "What is a volcano?" → model_capability — a general unknown is NEVER a canon candidate',
     volcano && volcano.classification);

  ck(G.consider({ said: 'who are you?', reply: "I'm Leo. I keep the lamp lit round here.",
       intent: 'identity', certainty: 'known' }) === null,
     'G3  AN ADEQUATE ANSWER LOGS NOTHING');
  ck(G.consider({ said: '', reply: '', intent: 'unknown' }) === null,
     'G3b AND DELIBERATE SILENCE (an empty turn) LOGS NOTHING');

  const refusal = G.consider({ said: 'what stars are on their card?',
    reply: "That's not something I ever say.", intent: 'stars', certainty: 'refused' });
  ck(!!refusal && refusal.classification === 'safety_restriction'
     && refusal.resolution === 'by-design',
     'G4  A BOUNDARY HOLDING IS LOGGED AS by-design — the product working, never an open defect',
     refusal && refusal.resolution);

  const tech = G.consider({ said: 'hello?', reply: "I didn't catch that. Say it again?",
    reason: 'unavailable' });
  ck(!!tech && tech.classification === 'technical_failure',
     'G5  A ROUND TRIP THAT FAILED → technical_failure');

  const where = G.consider({ said: 'where is the add button?',
    reply: "I don't know that one.", intent: 'unknown' });
  ck(!!where && where.classification === 'studio_knowledge_missing',
     'G6  "where is the add button?" → studio_knowledge_missing', where && where.classification);
  const story = G.consider({ said: 'what should the ending be like in general',
    reply: "I don't know yet.", intent: 'unknown' });
  ck(!!story && story.classification === 'story_context_missing',
     'G7  a question about the story\'s own shape → story_context_missing', story && story.classification);

  for (let i = 0; i < 250; i++) {
    G.consider({ said: 'filler question ' + i, reply: "I don't know.", intent: 'unknown' });
  }
  ck(G.list().length <= 200,
     'G8  THE LOCAL BUFFER IS CAPPED — a ring, never a hoard', G.list().length + ' kept');

  const entryKeys = Object.keys(keep).sort().join(',');
  ck(entryKeys.indexOf('card') === -1 && entryKeys.indexOf('nick') === -1
     && entryKeys.indexOf('user') === -1,
     'G9  NO ENTRY CARRIES A CARD, A NICKNAME OR A USERNAME — instrumentation holds no identity',
     entryKeys);
  // Structural, comments stripped: the log can NEVER become memory.
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  ck(!/CompanionMemory|\bremember\s*\(|MagicCard|CompanionName/.test(bare),
     'G10 THE MODULE CANNOT REACH MEMORY OR IDENTITY — CompanionMemory, MagicCard and the memory API appear nowhere in its code');
  G.clear();
  ck(G.list().length === 0, 'G11 and clear() empties the local copy');
}

// ===================================================================
(async function browserRun() {
  section('E. THE REAL SURFACE  (browser — one unanswerable question)');
  const web = cp.spawn(process.execPath,
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)],
    { stdio: 'ignore' });
  const stopWeb = function () { try { web.kill(); } catch (e) {} };
  process.on('exit', stopWeb);
  await new Promise(function (resolve) {
    const tryOne = function (n) {
      require('http').get(BASE + '/studio.html', function (r) { r.resume(); resolve(); })
        .on('error', function () {
          if (n <= 0) { resolve(); return; }
          setTimeout(function () { tryOne(n - 1); }, 200);
        });
    };
    tryOne(25);
  });
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
  await page.route('**/supabase-config.json', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
    typeof CompanionChat !== 'undefined' && typeof CompanionGapLog !== 'undefined',
    null, { timeout: 20000 });
  const out = await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    const card = MagicCard.claim('Vihaan', null, { companionId: 'leafy' });
    MagicCard.setActive(card.id);
    const memBefore = (typeof CompanionMemory !== 'undefined' && CompanionMemory.list)
      ? CompanionMemory.list().length : 0;
    // A question nobody could answer, straight through the real ask
    // path — the deterministic Mind answers it honestly, and R6 logs it.
    const r = await CompanionChat.ask('what is the airspeed of a swallow?');
    const memAfter = (typeof CompanionMemory !== 'undefined' && CompanionMemory.list)
      ? CompanionMemory.list().length : 0;
    return { reply: r && r.reply, log: CompanionGapLog.list(),
             memBefore: memBefore, memAfter: memAfter };
  });
  const entry = (out.log || [])[out.log.length - 1] || null;
  ck(!!entry && entry.surface === 'studio' && entry.companion === 'leafy'
     && /airspeed/.test(entry.said) && entry.classification === 'model_capability',
     'E1  THE REAL CHAT LOGS ITS OWN GAP — surface, companion, the question, and an honest classification',
     entry ? JSON.stringify({ cls: entry.classification, screen: entry.screen }) : 'no entry');
  ck(out.memBefore === out.memAfter,
     'E2  AND WROTE NO MEMORY — the log is instrumentation, never remembering',
     out.memBefore + ' -> ' + out.memAfter);
  ck(pageErrors.length === 0, 'E3  zero page errors', pageErrors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();
  stopWeb();
  console.log('\n' + (failed === 0
    ? 'ALL GREEN — ' + passed + ' passed, 0 failed' + (skipped ? ', ' + skipped + ' skipped' : '')
    : 'FAILURES — ' + passed + ' passed, ' + failed + ' failed'));
  if (failed) failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})();

// ---- pg helpers (the social-sky suite's own) ----------------------
function startPg() {
  if (process.env.GAP_TEST_PG) return { conn: process.env.GAP_TEST_PG, own: false };
  let bin = null;
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'initdb'))) { bin = c; break; }
  }
  if (!bin) { try { bin = path.dirname(sh('which initdb').trim()); } catch (e) { return null; } }
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) {}
  try { fs.rmSync(PGDIR, { recursive: true, force: true }); } catch (e) {}
  try {
    fs.mkdirSync(PGDIR, { recursive: true });
    if (asRoot) sh(`chown postgres "${PGDIR}"`);
    sh(wrap(`"${bin}/initdb" -D "${PGDIR}" -A trust -U postgres`));
    sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" -o "-p ${PGPORT} -k /tmp" -l "${PGDIR}/log" start`));
    return { conn: `-h /tmp -p ${PGPORT} -U postgres`, own: true, bin };
  } catch (e) { return null; }
}
function stopPg(pg) {
  if (!pg || !pg.own) return;
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${pg.bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) {}
}
function run(pg, args) {
  const r = cp.spawnSync('psql', [...pg.conn.split(' ').filter(Boolean), '-X', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), code: r.status };
}
function psql(pg, sql) { return run(pg, ['-q', '-t', '-A', '-c', sql]).out; }
function psql2(pg, sql) { return run(pg, ['-q', '-t', '-A', '-c', sql]); }
function loadFile(pg, file) { const r = run(pg, ['-q', '-f', file]); return r.code === 0 ? '' : (r.err || 'failed'); }
function lines(r) { return (r.out || '').split('\n').map((l) => l.trim()); }
function asSession(pg, uid, sql) {
  return psql2(pg, ['begin;', 'set local role anon;',
    `set local "test.uid" = '${uid}';`, sql, 'commit;'].join('\n'));
}
