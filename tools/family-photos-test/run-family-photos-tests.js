// tools/family-photos-test/run-family-photos-tests.js — a parent hands
// over a family photo album by email, without an account.
//
// Three things are under test and they fail in completely different
// ways, which is why this is one suite rather than three:
//
//   A. THE SQL, EXECUTED. Not read — RUN, against a real PostgreSQL,
//      with the two tables copied verbatim from supabase/schema.sql
//      including family_albums' own INSERT policy. That policy IS the
//      obstacle this feature exists to get past:
//        with check (owner_id = auth.uid()::text)
//      so A1 proves a parent's own session genuinely cannot make the
//      row, and A5 proves the SECURITY DEFINER function can — with the
//      row landing on the CHILD's owner_id. Everything the token design
//      promises (reusable, never expiring, capped, one per child,
//      dedup-as-success) is asserted by doing it, not by inspecting the
//      file.
//
//   B. THE PAGE, ON A REAL BROWSER. family-photos.html imports nothing
//      — no CDN, no esm.sh — so unlike tools/invite-test/ the real
//      handlers can be driven directly; the page exposes them for that
//      purpose. Only `fetch` is stubbed, at the network edge, because
//      this sandbox has no outbound network at all.
//
//   C. THE LETTER. The album passage lives in the sky-protection Edge
//      Function, which is Deno TypeScript; it is transpiled and its
//      composers are called, so the assertions are about the message a
//      parent would actually receive rather than about source text.
//
// WHAT THE SANDBOX CANNOT PROVE, and is stated rather than papered
// over: nothing here reaches Supabase, Resend or Google. No mail has
// been sent, no Edge Function has been deployed and run, and no live
// Google Photos album has been fetched. The SQL is real; the delivery
// is not.
//
// Run:
//   NODE_PATH=/opt/node22/lib/node_modules node tools/family-photos-test/run-family-photos-tests.js
//
// The SQL section needs a PostgreSQL to talk to. It will use
// $FP_TEST_PG (a psql connection string) when set; otherwise it boots a
// throwaway cluster with initdb/pg_ctl and tears it down afterwards. If
// neither is possible the section reports SKIPPED — loudly, and the run
// is marked incomplete rather than green.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8791;

let pass = 0, fail = 0, skip = 0;
const ok = (n, x) => { pass++; console.log('  ok   ' + n + (x ? '  (' + x + ')' : '')); };
const no = (n, x) => { fail++; console.log('  FAIL ' + n + (x ? '  (' + x + ')' : '')); };
const ck = (c, n, x) => c ? ok(n, x) : no(n, x);
const sk = (n, x) => { skip++; console.log('  SKIP ' + n + (x ? '  (' + x + ')' : '')); };

// ===================================================================
// A. THE SQL, EXECUTED
// ===================================================================

const PGDIR = path.join(os.tmpdir(), 'vihu-fp-pgdata');
const PGPORT = '55433';
let pgEnv = null;      // env for psql
let pgOwn = false;     // did we start it, and must we stop it

function sh(cmd, opts) {
  return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
}

function tryBootPostgres() {
  if (process.env.FP_TEST_PG) {
    return { PGDATABASE: undefined, __conn: process.env.FP_TEST_PG };
  }
  let bin = '';
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'initdb'))) { bin = c; break; }
  }
  if (!bin) { try { bin = path.dirname(sh('which initdb').trim()); } catch (e) { return null; } }
  if (!bin) return null;

  try { sh(`"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`); } catch (e) { /* not running */ }
  try { fs.rmSync(PGDIR, { recursive: true, force: true }); } catch (e) { /* fine */ }
  fs.mkdirSync(PGDIR, { recursive: true });

  // initdb refuses to run as root, so when we are root the cluster is
  // owned by a throwaway account. Everywhere else it runs as us.
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const wrap = (c) => asRoot ? `su pgvihutest -c ${JSON.stringify(c)}` : c;
  if (asRoot) {
    try { sh('id -u pgvihutest'); } catch (e) { try { sh('useradd -M pgvihutest'); } catch (e2) { return null; } }
    sh(`chown -R pgvihutest "${PGDIR}" && chmod 700 "${PGDIR}"`);
  }
  try {
    sh(wrap(`"${bin}/initdb" -D "${PGDIR}" -A trust -U postgres`));
    sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" -o "-p ${PGPORT} -k /tmp" -l "${PGDIR}/log" start`));
  } catch (e) { return null; }
  pgOwn = true;
  return { PGHOST: '/tmp', PGPORT, PGUSER: 'postgres' };
}

function stopPostgres() {
  if (!pgOwn) return;
  let bin = '';
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'pg_ctl'))) { bin = c; break; }
  }
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const c = `"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`;
  try { sh(asRoot ? `su pgvihutest -c ${JSON.stringify(c)}` : c); } catch (e) { /* going away anyway */ }
  try { fs.rmSync(PGDIR, { recursive: true, force: true }); } catch (e) { /* fine */ }
}

// Every statement goes through psql in unaligned/tuples-only mode, so
// what comes back is exactly the value the database produced.
function q(sql, db) {
  const env = { ...process.env, ...(pgEnv || {}) };
  const conn = pgEnv && pgEnv.__conn ? pgEnv.__conn : `-d ${db || 'fptest'}`;
  const args = pgEnv && pgEnv.__conn ? [pgEnv.__conn] : ['-d', db || 'fptest'];
  void conn;
  const r = cp.spawnSync('psql', ['-tA', '-v', 'ON_ERROR_STOP=1', ...args, '-c', sql],
    { env, encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), code: r.status };
}

// A block that runs as the PARENT's browser session: the `anon` role
// with an auth.uid() that is not the child's. This is the whole point —
// every attach in this suite is performed by somebody who could not
// have written the row themselves.
function asParent(sql) {
  return q(['begin;',
    "set local role anon;",
    "set local \"test.uid\" = '22222222-2222-2222-2222-222222222222';",
    sql,
    'commit;'].join('\n'));
}

const CHILD_UID = '11111111-1111-1111-1111-111111111111';
const SIB_UID = '33333333-3333-3333-3333-333333333333';

function sqlSection() {
  console.log('\nA. THE SQL, EXECUTED  (supabase/migrations_family_album_link.sql)');

  pgEnv = tryBootPostgres();
  if (!pgEnv) {
    sk('A1-A16  the whole SQL section',
      'no PostgreSQL — set FP_TEST_PG or install postgresql to run these');
    return;
  }

  const base = pgEnv.__conn ? null : 'postgres';
  if (base) {
    q('drop database if exists fptest;', base);
    q('create database fptest;', base);
  }

  const load = (file) => {
    const env = { ...process.env, ...pgEnv };
    const args = pgEnv.__conn ? [pgEnv.__conn] : ['-d', 'fptest'];
    const r = cp.spawnSync('psql', ['-q', '-v', 'ON_ERROR_STOP=1', ...args, '-f', file],
      { env, encoding: 'utf8' });
    return r.status === 0 ? '' : (r.stderr || 'failed');
  };

  const fixErr = load(path.join(__dirname, 'fixture.sql'));
  if (fixErr) { no('A0  the fixture loads', fixErr.split('\n')[0]); return; }

  // A0 — THE MIGRATION RUNS AT ALL, and runs TWICE. The file says
  // "safe to re-run" at the top; that is a promise, so it is tested.
  const m1 = load(path.join(ROOT, 'supabase', 'migrations_family_album_link.sql'));
  const m2 = load(path.join(ROOT, 'supabase', 'migrations_family_album_link.sql'));
  ck(!m1 && !m2, 'A0  the migration applies, and applies twice', 'safe to re-run');
  if (m1 || m2) return;

  q(`insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern)
     values ('card_a','${CHILD_UID}','Vihaan','ORION','[[1,2]]'),
            ('card_b','${SIB_UID}','Meera','LYRA','[[3,4]]');`);

  // ---- A1. THE OBSTACLE IS REAL ----------------------------------
  const blocked = q(['begin;', 'set local role anon;',
    `set local "test.uid" = '22222222-2222-2222-2222-222222222222';`,
    `insert into public.family_albums(id,owner_id,album_url)
       values ('direct','${CHILD_UID}','https://photos.app.goo.gl/nope');`,
    'rollback;'].join('\n'));
  ck(/row-level security/i.test(blocked.err),
    'A1  a parent\'s own session CANNOT insert against the child\'s owner_id',
    'family_albums_insert refuses it');

  // ---- A2/A3. Minting ---------------------------------------------
  const t1 = q("select public.family_album_link_mint('card_a');").out;
  const t2 = q("select public.family_album_link_mint('card_a');").out;
  ck(!!t1 && t1 === t2, 'A2  one link per child — minting again returns the same one',
    'so a filed letter and a later one carry the same link');
  const tb = q("select public.family_album_link_mint('card_b');").out;
  ck(!!tb && tb !== t1, 'A3  a sibling gets their own link', 'never a shared one');
  ck(q("select coalesce(public.family_album_link_mint('no_such_card'),'<null>');").out === '<null>',
    'A3b a card that does not exist gets no link', 'rather than a link pointing at nothing');

  // ---- A4. Nobody but the letter's sender can mint -----------------
  const mintAnon = q(['begin;', 'set local role anon;',
    `select public.family_album_link_mint('card_a');`, 'rollback;'].join('\n'));
  ck(/permission denied/i.test(mintAnon.err),
    'A4  a browser cannot mint a link for a card it names',
    'or it could attach albums to a stranger\'s child');
  const readAnon = q(['begin;', 'set local role anon;',
    'select * from public.family_album_links;', 'rollback;'].join('\n'));
  ck(/permission denied/i.test(readAnon.err),
    'A4b nobody can list links, or turn one back into a child',
    'RLS on, no policies at all');

  // ---- A5. THE THING THIS ALL EXISTS FOR ---------------------------
  const r5 = asParent(`select public.family_album_attach('${t1}','https://photos.app.goo.gl/holiday')::text;`);
  ck(/"ok": true/.test(r5.out) && /"already": false/.test(r5.out),
    'A5  the parent\'s session attaches an album', 'through the definer function');
  ck(q(`select owner_id from public.family_albums where album_url='https://photos.app.goo.gl/holiday';`).out === CHILD_UID,
    'A5b the row landed on the CHILD\'s owner_id', 'not the parent\'s session');
  // psql prints a command tag for BEGIN/SET/ROLLBACK too, so the count
  // is one line among several rather than the last one.
  const childSees = q(['begin;', 'set local role anon;', `set local "test.uid" = '${CHILD_UID}';`,
    `select count(*) from public.family_albums where album_url='https://photos.app.goo.gl/holiday';`,
    'rollback;'].join('\n')).out.split('\n').map((l) => l.trim());
  ck(childSees.includes('1'),
    'A5c and the CHILD\'s own Studio can read it', 'family_albums_select, as the owner');

  // ---- A6. Reusable, which is the design decision ------------------
  const r6 = asParent(`select public.family_album_attach('${t1}','https://photos.google.com/share/school')::text;`);
  ck(/"ok": true/.test(r6.out),
    'A6  the SAME link attaches a SECOND album later',
    'reusable on purpose — a second album must not need a second email');

  // ---- A7. No expiry -----------------------------------------------
  q(`update public.family_album_links set created_at = now() - interval '400 days' where token='${t1}';`);
  const r7 = asParent(`select public.family_album_attach('${t1}','https://photos.app.goo.gl/aged')::text;`);
  ck(/"ok": true/.test(r7.out),
    'A7  a link filed away for over a year still works',
    'no expiry — the ceiling is what bounds it instead');

  // ---- A8. The same album twice is a success, not a duplicate ------
  const before8 = q(`select albums_added from public.family_album_links where token='${t1}';`).out;
  const r8 = asParent(`select public.family_album_attach('${t1}','https://photos.app.goo.gl/holiday')::text;`);
  const after8 = q(`select albums_added from public.family_album_links where token='${t1}';`).out;
  ck(/"ok": true/.test(r8.out) && /"already": true/.test(r8.out),
    'A8  the same album again is answered ok+already', 'a parent is never told off');
  ck(q(`select count(*) from public.family_albums where album_url='https://photos.app.goo.gl/holiday';`).out === '1',
    'A8b and makes no second row', 'one album, one row');
  ck(before8 === after8, 'A8c and costs nothing against the ceiling', 'nothing was added');

  // ---- A9. The allow-list, enforced where a page cannot be bypassed -
  const bad = {
    'a different site': 'https://drive.google.com/x',
    'a look-alike host behind userinfo': 'https://photos.app.goo.gl@evil.example/x',
    'a look-alike suffix': 'https://notphotos.google.com/x',
    'plain http': 'http://photos.app.goo.gl/x',
    'a port on the end': 'https://photos.app.goo.gl:8443/x',
    'not a link at all': 'holiday photos',
  };
  let badOk = true, badWhich = '';
  for (const [what, url] of Object.entries(bad)) {
    const r = asParent(`select public.family_album_attach('${t1}',${JSON.stringify(url).replace(/"/g, "'")})::text;`);
    if (!/"reason": "not_an_album"/.test(r.out)) { badOk = false; badWhich = what; }
  }
  ck(badOk, 'A9  every non-album link is refused server-side', badWhich || '6 shapes');
  ck(/"reason": "no_link"/.test(asParent(`select public.family_album_attach('${t1}','')::text;`).out),
    'A9b an empty box is answered without a lookup', 'no_link');

  // ---- A10. An unknown link does nothing, calmly -------------------
  const rowsBefore = q('select count(*) from public.family_albums;').out;
  const r10 = asParent(`select public.family_album_attach('nosuchlink','https://photos.app.goo.gl/x')::text;`);
  ck(/"reason": "unknown_link"/.test(r10.out) && !/ERROR/i.test(r10.err),
    'A10  an unknown or stale link answers, never raises', 'the invite_reached discipline');
  ck(q('select count(*) from public.family_albums;').out === rowsBefore,
    'A10b and changes nothing', 'no row, no bookkeeping');

  // ---- A11. It reveals nothing about the child ---------------------
  const keys = q(`select string_agg(k,',' order by k) from jsonb_object_keys(
                    (select public.family_album_attach('${t1}','https://photos.app.goo.gl/holiday'))) k;`).out;
  ck(keys === 'already,ok',
    'A11  the answer says only whether it worked', keys || '(empty)');
  const keys2 = q(`select string_agg(k,',' order by k) from jsonb_object_keys(
                    (select public.family_album_attach('nosuchlink','https://photos.app.goo.gl/x'))) k;`).out;
  ck(keys2 === 'ok,reason' && !/vihaan/i.test(keys2),
    'A11b and a refusal names no child either', keys2 || '(empty)');

  // ---- A12. The ceiling --------------------------------------------
  let hitCeiling = false;
  for (let i = 0; i < 40; i++) {
    const r = asParent(`select public.family_album_attach('${t1}','https://photos.app.goo.gl/bulk${i}')::text;`);
    if (/"reason": "enough_albums"/.test(r.out)) { hitCeiling = true; break; }
  }
  ck(hitCeiling, 'A12  a link runs out at the ceiling', 'what replaces an expiry');
  ck(Number(q(`select albums_added from public.family_album_links where token='${t1}';`).out) === 24,
    'A12b and stops exactly there', '24');
  ck(!/"ok": true/.test(asParent(`select public.family_album_attach('${t1}','https://photos.app.goo.gl/onemore')::text;`).out),
    'A12c and stays stopped', 'not a rolling window');

  // ---- A13. A sibling's link is untouched by any of that -----------
  ck(/"ok": true/.test(asParent(`select public.family_album_attach('${tb}','https://photos.app.goo.gl/meera')::text;`).out),
    'A13  one child\'s ceiling is not another\'s', 'the counter is per link');
  ck(q(`select owner_id from public.family_albums where album_url='https://photos.app.goo.gl/meera';`).out === SIB_UID,
    'A13b and each link attaches to its own child', 'never the wrong sky');

  // ---- A14. The link dies with the card ----------------------------
  q(`delete from public.magic_card_identities where id='card_b';`);
  ck(q(`select count(*) from public.family_album_links where token='${tb}';`).out === '0',
    'A14  a link cannot outlive the card it names', 'on delete cascade');

  // ---- A15. Nothing here is an expiry, and nothing is a session ----
  const cols = q(`select string_agg(column_name,',' order by column_name)
                  from information_schema.columns
                  where table_name='family_album_links';`).out;
  ck(cols === 'albums_added,created_at,identity_id,last_used_at,token',
    'A15  the link stores four facts and no expiry', cols);
  ck(!/expire|expires_at|used_at_once|password|email/i.test(cols),
    'A15b and nothing on it is a credential or an address', 'it is not an identity');
}

// ===================================================================
// C. THE LETTER
// ===================================================================

// The Edge Function is Deno TypeScript with two remote imports and a
// Deno.serve at the bottom. Strip the imports, cut at the server, stub
// Deno.env, and the composers are ordinary functions that can be
// called — so what is asserted is the message a parent receives.
function loadLetter() {
  let ts;
  try { ts = require('typescript'); } catch (e) { return null; }
  const file = path.join(ROOT, 'supabase', 'functions', 'sky-protection', 'index.ts');
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/^import .*$/gm, '');
  src = src.slice(0, src.indexOf('Deno.serve('));
  src += `
globalThis.Deno = { env: { get: (n) => (n === 'SKY_BASE_URL' ? 'https://vihuplanet.com' : '') } };
module.exports = { compose, composeHtml, cardText, albumPageUrl, BUILD };
`;
  const js = ts.transpileModule(src, { compilerOptions: { target: 'es2022', module: 'commonjs' } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, require);
  return m.exports;
}

const IDENT = (id, name, con) => ({
  id, serial_no: 125, nickname: name, constellation: con,
  pattern: [[1, 2], [3, 4], [5, 1]], claimed_at: '2026-01-01T00:00:00Z',
});

function letterSection() {
  console.log('\nC. THE LETTER  (supabase/functions/sky-protection)');
  const L = loadLetter();
  if (!L) { sk('C1-C9  the letter section', 'typescript not resolvable'); return; }

  const one = [IDENT('card_a', 'Vihaan', 'ORION')];
  const two = [IDENT('card_a', 'Vihaan', 'ORION'), IDENT('card_b', 'Meera', 'LYRA')];
  const TOK = 'aaaabbbbccccddddeeeeffff';
  const TOK2 = '1111222233334444555566';

  const text = L.compose(one, 'protect', [TOK]);
  const html = L.composeHtml(one, 'protect', [TOK]);
  const link = L.albumPageUrl(TOK);

  ck(text.includes(link), 'C1  the plain text carries the link', link.slice(0, 46) + '…');
  ck(html.includes(link), 'C1b the HTML carries the same link', 'one link, two renderings');

  // THE TWO FACTS, in the plain text as much as in the HTML — plenty of
  // people read mail with images off, and the plain part is not a
  // fallback here, it is the message.
  const uploadedT = /Nothing is uploaded/.test(text);
  const byLinkT = /shared by link/.test(text) && /anyone who has that link can see/i.test(text);
  ck(uploadedT, 'C2  the plain text says plainly that nothing is uploaded');
  ck(byLinkT, 'C2b the plain text says plainly that the album is shared by link');
  ck(/Nothing is uploaded/.test(html), 'C2c the HTML says it too');
  ck(/shared by link/.test(html) && /anyone who has that link can see/i.test(html),
    'C2d the HTML says the other one too');

  // Neither fact is buried: both are inside the passage, above the
  // closing "optional" line rather than after it.
  const iUp = text.indexOf('Nothing is uploaded');
  const iBy = text.indexOf('shared by link');
  const iOpt = text.indexOf('entirely optional');
  ck(iUp > 0 && iBy > iUp && iOpt > iBy,
    'C3  both facts come before the optional line, not in small print after it');

  ck(/entirely optional/i.test(text) && /Everything else works/i.test(text),
    'C4  the passage says the whole thing is optional', 'an offer, never a nag');

  // THE PASSAGE SITS INSIDE THE CARD. One address may protect several
  // children, so a letter can carry two cards — and a single link at the
  // foot would be a question about which child.
  const t2 = L.compose(two, 'recover', [TOK, TOK2]);
  const iVih = t2.indexOf('Family photos for Vihaan');
  const iMee = t2.indexOf('Family photos for Meera');
  ck(iVih > 0 && iMee > iVih, 'C5  siblings each get their own passage, named');
  ck(t2.includes(L.albumPageUrl(TOK)) && t2.includes(L.albumPageUrl(TOK2)),
    'C5b and their own link', 'never a shared one');
  ck(t2.indexOf(L.albumPageUrl(TOK)) < iMee,
    'C5c each link sits inside its own card', 'unambiguously whose photos');

  // AN UNCONFIGURED DEPLOYMENT IS A HANDLED STATE. If the migration was
  // never run the mint returns nothing, and the only correct consequence
  // is the letter a parent has always received.
  const bare = L.compose(one, 'protect', []);
  const bareHtml = L.composeHtml(one, 'protect', []);
  ck(!/Family photos/.test(bare) && !/family-photos.html/.test(bare),
    'C6  with no link the letter carries no album passage at all');
  ck(!/Family photos/.test(bareHtml), 'C6b nor does the HTML');
  ck(/ORION00125/.test(bare) && /★/.test(bare) && /Show Me Your Stars/.test(bare),
    'C6c and the card itself is untouched', 'the child still gets their sky');

  // The letter is a parent's letter: no technical words anywhere in the
  // passage it gained.
  const passage = text.slice(iUp - 400, iOpt + 200);
  const banned = /\b(token|API|invalid|failed|error|unauthori[sz]ed|authenticate|endpoint|database|RPC)\b/i;
  ck(!banned.test(passage), 'C7  the passage uses no technical word',
    (passage.match(banned) || [''])[0] || 'clean');
  ck(!/\bpassword\b|\baccount\b.*\bcreate\b|\bsign in\b|\blog in\b/i.test(passage),
    'C7b and never asks anybody to make an account');

  ck(!TOK.includes('vihaan') && !new RegExp(TOK).test(text.replace(link, '')),
    'C8  the link appears once, in the passage, and nowhere else');

  ck(/family album passage/.test(L.BUILD),
    'C9  the BUILD constant names this change', L.BUILD);
}

// ===================================================================
// B. THE PAGE
// ===================================================================

// A faithful stand-in for family_album_attach at the network edge. The
// SQL section proves the real one; this one lets the page's own
// branches be driven, including the ones a working database never
// produces.
const SERVER_SCRIPT = (mode) => `
  window.__calls = [];
  window.fetch = function (url, init) {
    window.__calls.push(String(url));
    if (String(url).indexOf('supabase-config.json') !== -1) {
      ${mode === 'unconfigured'
    ? "return Promise.resolve({ ok: false, json: function(){ return Promise.resolve(null); } });"
    : "return Promise.resolve({ ok: true, json: function(){ return Promise.resolve({url:'https://example.supabase.co', anonKey:'anon'}); } });"}
    }
    ${mode === 'throw' ? "return Promise.reject(new Error('offline'));" : ''}
    ${mode === 'http500' ? "return Promise.resolve({ ok: false, json: function(){ return Promise.resolve({}); } });" : ''}
    var body = ${JSON.stringify(
    mode === 'already' ? { ok: true, already: true }
      : mode === 'unknown' ? { ok: false, reason: 'unknown_link' }
        : mode === 'full' ? { ok: false, reason: 'enough_albums' }
          : mode === 'refused' ? { ok: false, reason: 'not_an_album' }
            : { ok: true, already: false })};
    return Promise.resolve({ ok: true, json: function(){ return Promise.resolve(body); } });
  };
`;

const TOKEN = 'aaaabbbbccccddddeeeeffff';

async function pageSection() {
  console.log('\nB. THE PAGE  (family-photos.html)');
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { sk('B1-B17  the page section', 'playwright not resolvable'); return; }

  const server = cp.spawn(process.execPath,
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)],
    { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));

  const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const ctx = await b.newContext({ viewport: { width: 520, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  const BASE = 'http://127.0.0.1:' + PORT + '/family-photos.html';

  async function boot(mode, withToken) {
    await page.goto(BASE + (withToken === false ? '' : '?k=' + TOKEN));
    await page.evaluate(SERVER_SCRIPT(mode));
    // The page memoises the config it resolved, and every boot is a
    // fresh document, so a stub set here is the only one it ever sees.
    await page.evaluate(() => { window.__calls = []; });
  }
  const press = async (url) => {
    if (url !== undefined) await page.fill('#albumUrl', url);
    await page.evaluate(() => window.__familyPhotos.submit());
    return page.evaluate(() => ({
      msg: document.getElementById('msg').textContent,
      more: document.getElementById('msgMore').textContent,
      done: document.getElementById('msg').classList.contains('done'),
      calls: window.__calls.length,
      field: document.getElementById('albumUrl').value,
    }));
  };

  // ---- B1/B2. A real album link is accepted ------------------------
  await boot('ok');
  let r = await press('https://photos.app.goo.gl/kX3vQ9abc');
  ck(r.done && /Done\./.test(r.msg), 'B1  a photos.app.goo.gl album is accepted', r.msg);
  ck(/Nothing was uploaded/i.test(r.more) && /stay in your Google account/i.test(r.more),
    'B1b and the confirmation repeats that nothing was uploaded');
  ck(r.field === '', 'B1c and the box is emptied for the next one');

  await boot('ok');
  r = await press('https://photos.google.com/share/AF1QipXyz');
  ck(r.done && /Done\./.test(r.msg), 'B2  a photos.google.com album is accepted too', r.msg);

  // ---- B3. The allow-list, the way the existing one behaves --------
  const refusals = {
    'a Drive link': 'https://drive.google.com/drive/folders/abc',
    'a photo, not an album': 'https://lh3.googleusercontent.com/x',
    'a look-alike host': 'https://photos.app.goo.gl.evil.example/x',
    'a look-alike behind userinfo': 'https://photos.app.goo.gl@evil.example/x',
    'plain http': 'http://photos.app.goo.gl/x',
    'words, not a link': 'the holiday album',
  };
  let allRefused = true, sample = '', reachedNetwork = false, which = '';
  for (const [what, url] of Object.entries(refusals)) {
    await boot('ok');
    const rr = await press(url);
    if (rr.done) { allRefused = false; which = what; }
    if (rr.calls !== 0) { reachedNetwork = true; which = what; }
    sample = rr.msg;
  }
  ck(allRefused, 'B3  every non-album link is refused', which || '6 shapes');
  ck(!reachedNetwork, 'B3b and refused before anything is sent', 'the same allow-list, client-side');
  ck(/different kind of link/i.test(sample), 'B3c and the wording blames nobody', sample);

  // ---- B4. An empty box --------------------------------------------
  await boot('ok');
  r = await press('');
  ck(!r.done && /nothing in the box/i.test(r.msg) && r.calls === 0,
    'B4  an empty box is answered without sending anything', r.msg);

  // ---- B5. Opened without the letter's link ------------------------
  await boot('ok', false);
  const greeted = await page.evaluate(() => document.getElementById('msg').textContent);
  ck(/cannot tell whose photos/i.test(greeted),
    'B5  a page opened without the letter says so on arrival', greeted);
  r = await press('https://photos.app.goo.gl/kX3vQ9abc');
  ck(!r.done && r.calls === 0,
    'B5b and pressing sends nothing', 'nothing to attach it to');
  ck(/Nothing was changed/i.test(r.more), 'B5c and says nothing was changed');

  // ---- B6/B7. The platform is not reachable ------------------------
  for (const [mode, name] of [['unconfigured', 'B6  an unconfigured deployment'],
  ['throw', 'B7  the network refusing outright'],
  ['http500', 'B7b the platform answering badly']]) {
    await boot(mode);
    r = await press('https://photos.app.goo.gl/kX3vQ9abc');
    ck(!r.done && /Could not reach VihuPlanet/i.test(r.msg) && !/Done/.test(r.msg),
      name + ' is calm, and never says Done', r.msg);
    ck(/Nothing was lost/i.test(r.more), name.slice(0, 4) + '  and says nothing was lost');
  }

  // ---- B8. Answers from the platform -------------------------------
  await boot('unknown');
  r = await press('https://photos.app.goo.gl/kX3vQ9abc');
  ck(!r.done && /cannot tell whose photos/i.test(r.msg),
    'B8  an unrecognised link is calm', r.msg);
  await boot('full');
  r = await press('https://photos.app.goo.gl/kX3vQ9abc');
  ck(!r.done && /plenty of albums here already/i.test(r.msg),
    'B8b a full list is calm, and says what to do', r.msg);
  await boot('already');
  r = await press('https://photos.app.goo.gl/kX3vQ9abc');
  ck(r.done && /already here/i.test(r.msg),
    'B8c an album already there reads as a success', r.msg);

  // ---- B9. NOTHING ANYWHERE BLAMES OR GETS TECHNICAL ---------------
  const banned = /\b(invalid|failed|failure|error|unauthori[sz]ed|forbidden|denied|token|API|endpoint|database|server|wrong|incorrect|not found)\b/i;
  const everyMessage = await page.evaluate(() => {
    const reasons = ['not_an_album', 'no_link', 'unknown_link', 'enough_albums', 'unreachable', 'anything_else'];
    return reasons.map((x) => window.__familyPhotos.wordFor(x).join(' ')).join(' \n ');
  });
  const bad = everyMessage.match(banned);
  ck(!bad, 'B9  no message the page can produce blames anybody or gets technical',
    bad ? bad[0] : '6 messages, clean');
  const visible = await page.evaluate(() => document.body.innerText);
  const badVisible = visible.match(banned);
  ck(!badVisible, 'B9b nor does anything printed on the page',
    badVisible ? badVisible[0] : 'clean');
  // NOT a word ban — the page's own footer says there is no account
  // here and nothing to sign in to, which is the reassurance, not the
  // ask. What must not exist is a place to type a credential or a
  // control that offers one.
  const asks = await page.evaluate(() => {
    const creds = document.querySelectorAll(
      'input[type=password],input[type=email],input[name*=user i],input[name*=pass i]').length;
    const controls = Array.from(document.querySelectorAll('button,a'))
      .map((e) => (e.textContent || '').trim())
      .filter((t) => /^(sign ?in|log ?in|sign ?up|register|create an account|continue with)/i.test(t));
    return { creds, controls, footer: document.querySelector('.foot').innerText };
  });
  ck(asks.creds === 0 && asks.controls.length === 0,
    'B9c nothing on the page asks for a credential or offers a sign-in',
    asks.controls.join(', ') || (asks.creds + ' credential field(s)'));
  ck(/no account here and nothing to sign in to/i.test(asks.footer),
    'B9d and it says so outright', 'Decisions 11 and 14');

  // ---- B10. THE TWO FACTS ARE ABOVE THE FIELD ----------------------
  const geom = await page.evaluate(() => {
    const p = document.querySelector('.plainly').getBoundingClientRect();
    const f = document.getElementById('albumUrl').getBoundingClientRect();
    return { plainlyBottom: p.bottom, fieldTop: f.top, text: document.querySelector('.plainly').innerText };
  });
  ck(geom.plainlyBottom <= geom.fieldTop,
    'B10  both facts are stated ABOVE the field', 'not small print underneath');
  ck(/Nothing is uploaded/.test(geom.text), 'B10b nothing is uploaded, said plainly');
  ck(/shared by link/i.test(geom.text) && /Anyone who has that link can see/i.test(geom.text),
    'B10c shared by link, said plainly');

  // ---- B11. The link is never shown --------------------------------
  ck(!visible.includes(TOKEN), 'B11  the link from the letter is never printed on screen');

  // ---- B12. One field, one button ----------------------------------
  const shape = await page.evaluate(() => ({
    inputs: document.querySelectorAll('input,textarea,select').length,
    buttons: document.querySelectorAll('button').length,
    robots: (document.querySelector('meta[name=robots]') || {}).content || '',
  }));
  ck(shape.inputs === 1, 'B12  one field', shape.inputs + ' input(s)');
  ck(shape.buttons === 1, 'B12b one button', shape.buttons + ' button(s)');
  ck(/noindex/.test(shape.robots), 'B12c and the page is noindex', shape.robots);

  // ---- B13. The button cannot be pressed twice into flight ---------
  await boot('ok');
  const raced = await page.evaluate(async () => {
    document.getElementById('albumUrl').value = 'https://photos.app.goo.gl/kX3vQ9abc';
    const p = window.__familyPhotos.submit();
    const midFlight = document.getElementById('addBtn').disabled;
    await p;
    return { midFlight, after: document.getElementById('addBtn').disabled };
  });
  ck(raced.midFlight && !raced.after,
    'B13  the button is held while a press is in flight, and released after');

  ck(errs.length === 0, 'B14  no page errors anywhere in the run', errs[0] || 'clean');

  await b.close();
  server.kill();
}

// ===================================================================

(async () => {
  console.log('\nFAMILY PHOTOS BY EMAIL — a parent hands over an album without an account\n');
  try { sqlSection(); } finally { stopPostgres(); }
  letterSection();
  await pageSection();
  console.log('\n' + '─'.repeat(64));
  console.log(`  ${pass} passed · ${fail} failed` + (skip ? ` · ${skip} skipped` : ''));
  if (skip) console.log('  INCOMPLETE — a skipped section proved nothing.');
  console.log('');
  process.exit(fail ? 1 : 0);
})();
