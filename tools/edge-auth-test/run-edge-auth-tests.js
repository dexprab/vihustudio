/* tools/edge-auth-test/run-edge-auth-tests.js — nobody gets in on a
 * public key any more.
 *
 * Sprint 1A, CLAUDE.md -> Decision 30. Three things are under test and
 * they fail in completely different ways, which is why this is one
 * suite rather than three:
 *
 *   A. THE SHARED MODULE, EXECUTED. supabase/functions/_shared/
 *      edgeAuth.js is imported and CALLED — not read — with the auth
 *      server stubbed at the network edge. Every impure edge in that
 *      module is injected for exactly this reason, so what is asserted
 *      is the real decision the real code makes.
 *
 *   B. THE SQL, EXECUTED. supabase/migrations_edge_rate_limit.sql is
 *      RUN against a real PostgreSQL, and the limiter is driven until
 *      it refuses. A rate limiter that has never actually refused
 *      anything is a comment.
 *
 *   C. THE FUNCTIONS AND THEIR CLIENTS, READ. The five Edge Functions
 *      are Deno TypeScript and cannot be executed here, so what is
 *      checked is that each one is wired to the gate and that no client
 *      still sends the anon key as its credential. This is the weakest
 *      section and it is labelled as such below rather than dressed up.
 *
 * WHAT THIS SANDBOX CANNOT PROVE, stated rather than papered over:
 * nothing here reaches Supabase. No Edge Function has been deployed, no
 * GoTrue has issued a token, and the migration has not been run against
 * the live project. The SQL is real and the module's logic is real; the
 * deployment is not. Section C's own assertions are about source text,
 * which is the one place in this file where passing is weaker evidence
 * than elsewhere.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/edge-auth-test/run-edge-auth-tests.js
 *
 * The SQL section needs a PostgreSQL. It uses $EA_TEST_PG when set;
 * otherwise it boots a throwaway cluster with initdb/pg_ctl and tears
 * it down afterwards. If neither is possible the section reports
 * SKIPPED — loudly, and the run is marked incomplete rather than green.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0, skipped = 0;
const ok = (n, note) => { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); };
const bad = (n, note) => { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); };
const sk = (n, note) => { skipped++; console.log('  skip ' + n + (note ? '  (' + note + ')' : '')); };
const check = (cond, n, note) => (cond ? ok : bad)(n, note);

// ===================================================================
// Fixtures — the two token shapes that actually matter
// ===================================================================

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// A JWT of the right SHAPE. Nothing here verifies signatures — the auth
// server does that, which is the whole point of resolveCaller asking it
// — so the payload is what matters and the signature is a placeholder.
function jwt(payload) {
  return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url(payload) + '.' + 'sig';
}

// The real thing this sprint exists to refuse: the project's PUBLIC
// anon key. Same claim shape Supabase issues — a role and no subject.
const ANON_KEY = jwt({ iss: 'supabase', role: 'anon', iat: 1782898286, exp: 2098474286 });
const SERVICE_KEY = jwt({ iss: 'supabase', role: 'service_role', iat: 1782898286, exp: 2098474286 });
const USER_TOKEN = jwt({ sub: 'user-aaaa', role: 'authenticated', is_anonymous: true });
const OTHER_TOKEN = jwt({ sub: 'user-bbbb', role: 'authenticated', is_anonymous: true });
const ADMIN_TOKEN = jwt({ sub: 'user-adm', role: 'authenticated', email: 'boss@vihuplanet.com' });

const ENV = { supabaseUrl: 'https://project.supabase.co', anonKey: ANON_KEY, serviceKey: SERVICE_KEY };

// The auth server, stubbed at the network edge. It knows three tokens
// and rejects everything else, exactly as GoTrue would.
const USERS = {
  [USER_TOKEN]: { id: 'user-aaaa', is_anonymous: true, email: null },
  [OTHER_TOKEN]: { id: 'user-bbbb', is_anonymous: true, email: null },
  [ADMIN_TOKEN]: { id: 'user-adm', is_anonymous: false, email: 'Boss@VihuPlanet.com' },
};
let authCalls = 0;
function stubFetch(unreachable) {
  return async function (url, init) {
    authCalls++;
    if (unreachable) throw new Error('network down');
    const auth = (init && init.headers && init.headers.Authorization) || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const user = USERS[token];
    if (!user) return { ok: false, status: 401, json: async () => ({ msg: 'bad jwt' }) };
    return { ok: true, status: 200, json: async () => user };
  };
}

function req(headers) {
  const h = headers || {};
  return { method: 'POST', headers: { get: (k) => h[String(k).toLowerCase()] || null } };
}
const withToken = (t) => req({ authorization: 'Bearer ' + t });

// A database stand-in for the two ownership tables and the RPC. Section
// B replaces the RPC half with a real PostgreSQL.
function fakeDb(spec) {
  return {
    async rpc(name, args) { return spec.rpc ? spec.rpc(name, args) : { data: null, error: { message: 'no rpc' } }; },
    from(table) {
      const filters = {};
      const b = {
        select() { return b; },
        eq(c, v) { filters[c] = v; return b; },
        limit() { return b; },
        then(res, rej) {
          const rows = (spec[table] || []).filter((r) =>
            Object.keys(filters).every((k) => String(r[k]) === String(filters[k])));
          return Promise.resolve({ data: rows, error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
}

// ===================================================================
(async function main() {
  const A = await import('file://' + path.join(ROOT, 'supabase', 'functions', '_shared', 'edgeAuth.js'));

  // =================================================================
  console.log('\nA. THE GATE  (supabase/functions/_shared/edgeAuth.js, executed)');
  // =================================================================

  // --- 1. Missing Authorization header -> rejected -----------------
  {
    const r = await A.resolveCaller(req({}), ENV, { fetchImpl: stubFetch() });
    check(r.ok === false && r.reason === 'unauthorized', 'A1  no Authorization header is refused');
    const g = await A.guard(req({}), { env: ENV, require: 'user', fetchImpl: stubFetch() });
    check(g.ok === false && g.status === 401 && g.body.reason === 'unauthorized',
      'A1b guard answers 401 {ok:false,reason:"unauthorized"}');
    check(Object.keys(g.body).join(',') === 'ok,reason',
      'A1c the refusal body carries nothing else', JSON.stringify(g.body));
  }

  // A bearer with nothing after it is a missing credential, not a blank one.
  {
    const r = await A.resolveCaller(req({ authorization: 'Bearer ' }), ENV, { fetchImpl: stubFetch() });
    check(r.ok === false, 'A1d an empty bearer is refused');
    const r2 = await A.resolveCaller(req({ authorization: USER_TOKEN }), ENV, { fetchImpl: stubFetch() });
    check(r2.ok === false, 'A1e a token with no Bearer scheme is refused');
  }

  // --- 2. Invalid JWT -> rejected ----------------------------------
  {
    const r = await A.resolveCaller(withToken('not-a-jwt-at-all'), ENV, { fetchImpl: stubFetch() });
    check(r.ok === false && r.reason === 'unauthorized', 'A2  a malformed token is refused');
    const r2 = await A.resolveCaller(withToken(jwt({ sub: 'ghost', role: 'authenticated' })), ENV, { fetchImpl: stubFetch() });
    check(r2.ok === false, 'A2b a well-formed token the auth server does not know is refused');
  }

  // --- THE ONE THIS SPRINT EXISTS FOR ------------------------------
  {
    const before = authCalls;
    const r = await A.resolveCaller(withToken(ANON_KEY), ENV, { fetchImpl: stubFetch() });
    check(r.ok === false && r.reason === 'unauthorized',
      'A3  THE PUBLIC ANON KEY, PRESENTED ALONE, IS REFUSED');
    check(authCalls === before,
      'A3b and it costs no round trip — refused locally on its own claims');
  }

  // --- 3. Valid session -> caller derived server-side ---------------
  {
    const r = await A.resolveCaller(withToken(USER_TOKEN), ENV, { fetchImpl: stubFetch() });
    check(r.ok === true && r.kind === 'user' && r.userId === 'user-aaaa',
      'A4  a real session resolves to the id THE AUTH SERVER returned');
    check(r.isAnonymous === true,
      'A4b an anonymous session is still a caller — the product has no other kind');
  }

  // --- 4. Client-supplied owner_id does NOT override identity -------
  {
    // The shape of the old attack: a body claiming to be somebody.
    const forged = { method: 'POST', headers: { get: (k) => (String(k).toLowerCase() === 'authorization' ? 'Bearer ' + USER_TOKEN : null) },
                     body: { owner_id: 'user-bbbb', userId: 'user-bbbb', cardId: 'card-b' } };
    const r = await A.resolveCaller(forged, ENV, { fetchImpl: stubFetch() });
    check(r.ok === true && r.userId === 'user-aaaa',
      'A5  a body claiming owner_id/userId cannot change who the caller is');
  }

  // --- 5 & 6. Client-supplied cardId does not grant access ----------
  {
    const db = fakeDb({
      magic_card_identities: [
        { id: 'card-a', owner_id: 'user-aaaa' },
        { id: 'card-b', owner_id: 'user-bbbb' },
      ],
      magic_card_recalls: [{ id: 'r1', identity_id: 'card-b', recaller_id: 'user-cccc' }],
    });
    const me = await A.resolveCaller(withToken(USER_TOKEN), ENV, { fetchImpl: stubFetch() });

    const mine = await A.authorizeCardAccess(db, 'card-a', me);
    check(mine.ok === true, 'A6  a Creator may act on their OWN Magic Card');

    const theirs = await A.authorizeCardAccess(db, 'card-b', me);
    check(theirs.ok === false && theirs.reason === 'forbidden',
      'A7  NAMING SOMEBODY ELSE\'S cardId DOES NOT GRANT ACCESS');

    const ghost = await A.authorizeCardAccess(db, 'card-zzz', me);
    check(ghost.ok === false && ghost.reason === theirs.reason,
      'A7b a card that does not exist answers IDENTICALLY — no oracle for real ids');

    // Cross-device recall must keep working: adopt() keeps the original
    // identity_id and never re-stamps owner_id, so the recall proof is
    // the only thing that entitles a Creator at their grandmother's.
    const recaller = await A.resolveCaller(withToken(OTHER_TOKEN), ENV, { fetchImpl: stubFetch() });
    const db2 = fakeDb({
      magic_card_identities: [{ id: 'card-a', owner_id: 'user-aaaa' }],
      magic_card_recalls: [{ id: 'r2', identity_id: 'card-a', recaller_id: 'user-bbbb' }],
    });
    const proven = await A.authorizeCardAccess(db2, 'card-a', recaller);
    check(proven.ok === true,
      'A8  a PROVEN recall still entitles a Creator on a strange device');

    const unproven = await A.authorizeCardAccess(fakeDb({
      magic_card_identities: [{ id: 'card-a', owner_id: 'user-aaaa' }],
      magic_card_recalls: [],
    }), 'card-a', recaller);
    check(unproven.ok === false,
      'A8b without that proof the same caller is refused');
  }

  // --- The three caller classes stay distinct ----------------------
  {
    const svc = await A.resolveCaller(withToken(SERVICE_KEY), ENV, { fetchImpl: stubFetch() });
    check(svc.ok === true && svc.kind === 'service', 'A9  the service key resolves as a service caller');

    const g = await A.guard(withToken(SERVICE_KEY), { env: ENV, require: 'user', fetchImpl: stubFetch() });
    check(g.ok === false && g.status === 403, 'A9b a service caller may not stand in for a user');

    const g2 = await A.guard(withToken(USER_TOKEN), { env: ENV, require: 'service', fetchImpl: stubFetch() });
    check(g2.ok === false && g2.status === 403,
      'A9c a real child\'s session may NOT reach a service-only function');

    // A token that merely CLAIMS to be the service role proves nothing.
    const liar = jwt({ role: 'service_role', sub: null });
    const g3 = await A.resolveCaller(withToken(liar), ENV, { fetchImpl: stubFetch() });
    check(g3.ok === false, 'A9d a token claiming role:service_role is not believed');
  }

  // --- Administrators -----------------------------------------------
  {
    const db = fakeDb({ platform_admins: [{ email: 'boss@vihuplanet.com' }] });
    const admin = await A.resolveCaller(withToken(ADMIN_TOKEN), ENV, { fetchImpl: stubFetch() });
    check(await A.isPlatformAdmin(db, admin) === true,
      'A10 an administrator is recognised by the email the AUTH SERVER returned');
    const child = await A.resolveCaller(withToken(USER_TOKEN), ENV, { fetchImpl: stubFetch() });
    check(await A.isPlatformAdmin(db, child) === false,
      'A10b an anonymous session is never an administrator');
  }

  // --- Fail CLOSED when the auth server cannot be reached -----------
  {
    const r = await A.resolveCaller(withToken(USER_TOKEN), ENV, { fetchImpl: stubFetch(true) });
    check(r.ok === false && r.reason === 'unauthorized',
      'A11 an unreachable auth server refuses — the one place in VihuPlanet that fails closed');
  }

  // --- The one configuration point ----------------------------------
  {
    check(!!A.LIMITS['companion-chat'],
      'A12 the companion-chat allowance exists BEFORE the endpoint does');
    const base = A.limitFor('voice-speak', null);
    check(base.max === A.LIMITS['voice-speak'].max, 'A12b limitFor reads the table');
    const over = A.limitFor('voice-speak', { get: (n) => (n === 'EDGE_LIMIT_VOICE_SPEAK_MAX' ? '7' : '') });
    check(over.max === 7, 'A12c a deployment may override a limit without a redeploy');
    const junk = A.limitFor('voice-speak', { get: () => 'nonsense' });
    check(junk.max === base.max, 'A12d an unreadable override falls back rather than opening up');
    check(A.limitFor('no-such-bucket', null) === null, 'A12e an unknown bucket has no limit to read');
  }

  // --- Nothing sensitive is ever in a refusal ------------------------
  {
    const bodies = [];
    for (const t of ['', ANON_KEY, 'garbage', SERVICE_KEY]) {
      const g = await A.guard(t ? withToken(t) : req({}), { env: ENV, require: 'user', fetchImpl: stubFetch() });
      if (!g.ok) bodies.push(JSON.stringify(g.body));
    }
    const blob = bodies.join('|');
    const leaks = [ANON_KEY, SERVICE_KEY, USER_TOKEN, 'user-aaaa', 'project.supabase.co', 'stack', 'at Object.']
      .filter((s) => blob.indexOf(s) !== -1);
    check(leaks.length === 0, 'A13 no refusal body carries a key, a token, an id, a host or a trace',
      leaks.join(','));
  }

  // =================================================================
  console.log('\nB. THE LIMITER  (supabase/migrations_edge_rate_limit.sql, executed)');
  // =================================================================
  const pg = startPg();
  if (!pg) {
    sk('B1-B7  the limiter section', 'no PostgreSQL available');
  } else {
    try {
      psqlFile(pg, path.join(__dirname, 'fixture.sql'));

      // THE VERIFIER, BEFORE THE MIGRATION. Somebody will run these in
      // the wrong order, and the answer they get has to say so rather
      // than raising a Postgres error at them.
      const early = psqlFile(pg, path.join(ROOT, 'supabase', 'verify_edge_rate_limit.sql'));
      check(/MIGRATION NOT APPLIED/.test(early) && /FAIL/.test(early),
        'B0  run before the migration, the verifier says so in words');

      const mig = psqlFile(pg, path.join(ROOT, 'supabase', 'migrations_edge_rate_limit.sql'));
      ok('B1  the migration runs against a real PostgreSQL');

      // A MIGRATION MUST BE INERT. Pasted into the Supabase SQL Editor it
      // has to produce "Success. No rows returned" — not a JSON blob a
      // person then has to interpret. Reported by the product owner
      // looking at exactly such a blob and reading it as an error; it was
      // in fact the first probe passing, which is the whole problem.
      check(!/\(\d+ rows?\)/.test(mig) && !/allowed/.test(mig),
        'B1b the migration returns no rows and runs no probes',
        mig.trim().split('\n').filter((l) => !/NOTICE|already exists/.test(l)).join(' ').slice(0, 60) || 'silent');
      const after = psql(pg, 'select count(*) from public.edge_rate_limits;').trim();
      check(after === '0', 'B1c and it counted nothing against anybody', after + ' rows');

      // NOW the verifier, and every row of it must say PASS.
      const ver = psqlFile(pg, path.join(ROOT, 'supabase', 'verify_edge_rate_limit.sql'));
      const verdicts = (ver.match(/\b(PASS|FAIL)\b/g) || []);
      check(verdicts.length >= 15 && verdicts.every((v) => v === 'PASS'),
        'B1d the verifier answers PASS on every check',
        verdicts.length + ' checks, ' + verdicts.filter((v) => v === 'FAIL').length + ' failed');
      check(/── OVERALL ──/.test(ver) && /all checks pass/.test(ver),
        'B1e and leads with one overall verdict rather than a wall of JSON');
      const left = psql(pg, "select count(*) from public.edge_rate_limits where bucket = '__verify__';").trim();
      check(left === '0', 'B1f the verifier leaves nothing behind — safe on a live project', left + ' rows');

      const rls = psql(pg, "select relrowsecurity from pg_class where oid='public.edge_rate_limits'::regclass;");
      const pol = psql(pg, "select count(*) from pg_policies where tablename='edge_rate_limits';");
      check(rls.indexOf('t') !== -1 && pol.trim() === '0',
        'B2  RLS is on with zero policies — only the definer function may read it');

      // AN HOUR-LONG WINDOW, not a minute. With a 60s window the suite
      // could straddle a rollover between B3 and B5 — the subject would
      // get a fresh allowance and "stays refused" would fail for a
      // reason that has nothing to do with the limiter. A real flake,
      // seen once. The window under test is the test's own choice; the
      // product's live windows live in edgeAuth.js -> LIMITS.
      const WIN = 3600;
      const hit = (subj, lim) =>
        JSON.parse(psql(pg, `select public.edge_rate_limit_hit('t','${subj}',${lim},${WIN});`).trim());

      const a1 = hit('sub-a', 2), a2 = hit('sub-a', 2), a3 = hit('sub-a', 2);
      check(a1.allowed === true && a2.allowed === true && a3.allowed === false,
        'B3  THE LIMITER ACTUALLY REFUSES — allowed, allowed, then no');
      check(a1.remaining === 1 && a2.remaining === 0 && a3.remaining === 0,
        'B3b remaining counts down and never goes negative');
      check(a3.retry_after > 0 && a3.retry_after <= WIN,
        'B3c a refusal says when to come back, and nothing else', 'retry_after=' + a3.retry_after);

      const b1 = hit('sub-b', 2);
      check(b1.allowed === true, 'B4  one caller cannot spend another caller\'s allowance');

      check(hit('sub-a', 2).allowed === false,
        'B5  a refused caller stays refused for the rest of the window');

      const zero = JSON.parse(psql(pg, "select public.edge_rate_limit_hit('t','sub-c',0,3600);").trim());
      check(zero.allowed === false, 'B6  a limit of zero means closed, never unlimited');
      const nameless = JSON.parse(psql(pg, "select public.edge_rate_limit_hit('t','',5,3600);").trim());
      check(nameless.allowed === false, 'B6b an unattributable call is refused');

      // The rows carry a bucket, an opaque subject, a window and a
      // count. Never a card, an email, a story or a request body.
      const cols = psql(pg, "select string_agg(column_name,',' order by ordinal_position) " +
        "from information_schema.columns where table_name='edge_rate_limits';").trim();
      check(cols === 'bucket,subject,window_start,hits',
        'B7  the table can answer "how many" and nothing else', cols);

      // The module's own client, driven against the REAL function.
      const realDb = { async rpc(name, args) {
        const row = psql(pg, `select public.${name}('${args.p_bucket}','${args.p_subject}',${args.p_limit},${args.p_window_seconds});`);
        return { data: JSON.parse(row.trim()), error: null };
      } };
      // THE MAX ONLY. A stub answering '2' to every name also set
      // EDGE_LIMIT_VOICE_SPEAK_WINDOW=2, so this ran against a TWO-SECOND
      // window and failed whenever the three calls straddled a rollover —
      // once in eight runs, measured. The same rollover hazard B3/B5
      // already guard against with a long window, arriving through the
      // env stub instead. "Flake" was not the root cause.
      const maxOnly = { get: (n) => (/_MAX$/.test(n) ? '2' : '') };
      const r1 = await A.checkRateLimit(realDb, 'voice-speak', 'sub-d', maxOnly);
      const r2 = await A.checkRateLimit(realDb, 'voice-speak', 'sub-d', maxOnly);
      const r3 = await A.checkRateLimit(realDb, 'voice-speak', 'sub-d', maxOnly);
      check(r1.allowed && r2.allowed && !r3.allowed,
        'B8  checkRateLimit() drives the real SQL to a real refusal');

      const g = await A.guard(withToken(USER_TOKEN), {
        env: ENV, require: 'user', bucket: 'voice-speak', db: realDb,
        envGet: (n) => (n === 'EDGE_LIMIT_VOICE_SPEAK_MAX' ? '0' : ''), fetchImpl: stubFetch(),
      });
      check(g.ok === false && g.status === 429 && g.body.reason === 'rate_limited',
        'B9  RATE LIMIT EXCEEDED -> 429 {ok:false,reason:"rate_limited"}');
      check(typeof g.body.retryAfter === 'number' && !('remaining' in g.body),
        'B9b the 429 body says when to retry and reveals no usage figures');

      // Broken limiter must not take the product down.
      const brokenDb = { async rpc() { return { data: null, error: { message: 'relation does not exist' } }; } };
      const open = await A.checkRateLimit(brokenDb, 'voice-speak', 'sub-e', null);
      check(open.allowed === true && open.counted === false,
        'B10 an unrun migration FAILS OPEN — a broken limiter is a cost, not an outage');
    } catch (e) {
      bad('B*  the limiter section threw', String(e.message || e).slice(0, 160));
    } finally { stopPg(pg); }
  }

  // =================================================================
  console.log('\nC. THE WIRING  (source text — the weakest section, see the header)');
  // =================================================================
  {
    const fn = (n) => fs.readFileSync(path.join(ROOT, 'supabase', 'functions', n, 'index.ts'), 'utf8');

    const gated = ['voice-speak', 'sky-protection', 'family-album', 'invite-send', 'creator-born'];

    // ONE FILE PER FUNCTION. Two attempts at fewer copies both failed on
    // the real deploy: `../_shared/` is CLI-only, and a sibling
    // `./edgeAuth.js` "just keeps vanishing" from two of the five
    // functions — an EMPTY one vanishes too, so it is neither size nor
    // content. A file that cannot be added cannot be depended on, and a
    // single file cannot half-arrive.
    gated.forEach((n) => {
      const src = fn(n);
      check(/BEGIN GENERATED edgeAuth/.test(src) && /END GENERATED edgeAuth/.test(src),
        'C1  ' + n + ' carries the gate inline');
      check(/guard\(req/.test(src), 'C1a ' + n + ' calls it');
    });

    // Nothing may be imported from a file the deploy might not carry.
    // `./parse.js` is family-album's own, predates this sprint and has
    // always deployed — the rule is about files THIS sprint added.
    gated.forEach((n) => {
      const src = fn(n).replace(/^\s*\/\/.*$/gm, '');
      check(!/edgeAuth\.js'/.test(src),
        'C1b ' + n + ' imports no separate auth file at all');
      check(!fs.existsSync(path.join(ROOT, 'supabase', 'functions', n, 'edgeAuth.js')),
        'C1b2 ' + n + ' has no stale copy left on disk');
    });

    // ONE SOURCE OF TRUTH. Asked of the REAL generator rather than a
    // reimplementation of it: a second copy of the inlining rule in this
    // file could disagree with the one that writes the files, and then
    // this check would be passing on its own opinion.
    let synced = true;
    try { sh('node ' + JSON.stringify(path.join(ROOT, 'tools', 'edge-auth-test', 'sync-shared.js')) + ' --check'); }
    catch (e) { synced = false; }
    check(synced, 'C1c every inlined block matches what the generator produces');

    // THE CODE THAT DEPLOYS IS THE CODE UNDER TEST. The block is the
    // canonical module with its full-line comments removed and `export`
    // dropped; "same behaviour" is asserted by RUNNING what is actually
    // in index.ts, not by trusting the generator.
    const block = (() => {
      const src = fn('sky-protection');
      const a = src.indexOf('BEGIN GENERATED edgeAuth');
      const b = src.indexOf('// ===== END GENERATED edgeAuth =====');
      return src.slice(src.indexOf('\n', a) + 1, b);
    })();
    const tmp = path.join(require('os').tmpdir(), 'vihu-inlined-gate.mjs');
    fs.writeFileSync(tmp, block +
      '\nexport { LIMITS, resolveCaller, authorizeCardAccess, guard, limitFor };\n');
    const V = await import('file://' + tmp);

    check(JSON.stringify(V.LIMITS) === JSON.stringify(A.LIMITS),
      'C1e the inlined gate carries the same LIMITS table');

    const vAnon = await V.resolveCaller(withToken(ANON_KEY), ENV, { fetchImpl: stubFetch() });
    check(vAnon.ok === false && vAnon.reason === 'unauthorized',
      'C1f the inlined gate refuses the public anon key');

    const vUser = await V.resolveCaller(withToken(USER_TOKEN), ENV, { fetchImpl: stubFetch() });
    check(vUser.ok === true && vUser.userId === 'user-aaaa',
      'C1g the inlined gate derives the caller from the auth server');

    const vDb = fakeDb({
      magic_card_identities: [{ id: 'card-a', owner_id: 'user-aaaa' }, { id: 'card-b', owner_id: 'user-bbbb' }],
      magic_card_recalls: [],
    });
    check((await V.authorizeCardAccess(vDb, 'card-a', vUser)).ok === true &&
          (await V.authorizeCardAccess(vDb, 'card-b', vUser)).ok === false,
      'C1h the inlined gate enforces card ownership identically');

    const vGuard = await V.guard(req({}), { env: ENV, require: 'user', fetchImpl: stubFetch() });
    check(vGuard.ok === false && vGuard.status === 401 &&
          JSON.stringify(vGuard.body) === '{"ok":false,"reason":"unauthorized"}',
      'C1i and refuses with the same safe body');
    fs.unlinkSync(tmp);

    check(/require:\s*'service'/.test(fn('creator-born')),
      'C2  creator-born is service-only — no browser session may reach it');
    check(/isPlatformAdmin\(/.test(fn('invite-send')),
      'C3  invite-send is administrators only');
    check(/authorizeCardAccess\(/.test(fn('sky-protection')),
      'C4  sky-protection proves the caller owns the card before posting it');

    // The gate must precede the work in every one of them.
    gated.forEach((n) => {
      const src = fn(n);
      const gateAt = src.search(/guard\(req/);
      const serveAt = src.search(/Deno\.serve\(/);
      check(gateAt > -1 && (gateAt < serveAt || /const pass = await/.test(src)),
        'C5  ' + n + ' gates before it works');
    });

    // No CLIENT still offers the anon key as its own credential.
    const clients = ['js/vihuVoice.js', 'js/skyProtection.js', 'js/familyAlbum.js', 'admin/invites.html'];
    clients.forEach((rel) => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const bearerAnon = /['"]?Authorization['"]?\s*:\s*'Bearer '\s*\+\s*cfg\.anonKey/.test(src);
      check(!bearerAnon, 'C6  ' + rel + ' no longer sends the anon key as Authorization');
      check(/apikey/.test(src), 'C6b ' + rel + ' still sends apikey for gateway routing');
    });

    // The new dependency on the voice path is BOUNDED. Getting a
    // session costs ~600ms the first time in a browser, and
    // CompanionEngine holds the words for only 2500ms — so an
    // unbounded wait here would delay a child's first line. Caught by
    // the Companion suite's own V2 failing once in six runs.
    const vv = fs.readFileSync(path.join(ROOT, 'js', 'vihuVoice.js'), 'utf8');
    check(/TOKEN_WAIT_MS/.test(vv) && /Promise\.race/.test(vv),
      'C6c the voice path caps how long it will wait for a session');
    const cap = /TOKEN_WAIT_MS\s*=\s*(\d+)/.exec(vv);
    check(cap && Number(cap[1]) < 2500,
      'C6d and that cap sits inside the engine\'s own VOICE_WAIT_MS budget',
      cap ? cap[1] + 'ms' : 'not found');
    check(/if \(!token\)/.test(vv),
      'C6e no session means no call at all — a refusal never reaches the provider');

    // The audition room needs the module that establishes a session, or
    // it is silent — a real consequence of the stricter gate.
    const aud = fs.readFileSync(path.join(ROOT, 'tools', 'voice-audition', 'index.html'), 'utf8');
    check(/themeRepositoryClient\.js/.test(aud),
      'C7  the audition room loads the module that establishes a session');

    // Behaviour that must NOT have changed in voice-speak.
    const vs = fn('voice-speak');
    ['MAX_CHARS = 600', 'api.elevenlabs.io', 'cacheKey', 'audio/mpeg', "reason: 'no-voice'"]
      .forEach((needle) => check(vs.indexOf(needle) !== -1,
        'C8  voice-speak still has ' + needle));

    // Canon and the decision record.
    const canon = fs.readFileSync(path.join(ROOT, 'docs', 'COMPANION_CANON.md'), 'utf8');
    check(canon.indexOf('| Notice a hidden or off-page object | Remember the child across sessions |') === -1,
      'C9  the canon rule forbidding cross-session memory is gone');
    check(/Remember meaningful experiences, conversations and creations shared with its Creator/.test(canon),
      'C9b the canon now permits meaningful shared memory');
    check(/never a log of everything the\s+Creator does/.test(canon),
      'C9c and bounds it — meaningful moments, never a log');
    check(/opinion about the world; never about the\s+work/.test(canon),
      'C9d the opinion/critique boundary is stated');
    check(/The Guide responsibility must work with no network and no AI/.test(canon),
      'C9e the no-AI guarantee is scoped to the Guide, not deleted');
    check(/VihuStudio never depends on an external model/.test(canon),
      'C9f and VihuStudio itself still never depends on a model');

    const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
    check(/### 30\. A Companion Remembers What Was Shared/.test(claude),
      'C10 CLAUDE.md carries Decision 30');
    check(/### 29\./.test(claude) && /### 28\./.test(claude),
      'C10b and no earlier decision was renumbered');
    ['TIER 3', 'Images never leave VihuPlanet', 'Privacy / Relevance Gate',
     'intelligence service, never the Companion', 'Rate limiting exists before']
      .forEach((needle) => check(claude.indexOf(needle) !== -1,
        'C10c Decision 30 records "' + needle + '"'));
  }

  // =================================================================
  console.log('\n' + (failed ? 'FAILED' : (skipped ? 'PASSED (incomplete)' : 'PASSED')) +
    ' — ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// ===================================================================
// A throwaway PostgreSQL, the same shape tools/family-photos-test uses.
// ===================================================================
const PGDIR = '/tmp/vihu-edge-auth-pg';
const PGPORT = 55433;

function sh(cmd) { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

function startPg() {
  if (process.env.EA_TEST_PG) return { conn: process.env.EA_TEST_PG, own: false };
  let bin = null;
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'initdb'))) { bin = c; break; }
  }
  if (!bin) { try { bin = path.dirname(sh('which initdb').trim()); } catch (e) { return null; } }
  // initdb and pg_ctl both refuse to run as root, so as root every
  // cluster command is wrapped — the same wrapping family-photos-test
  // does. STOPPING must be wrapped too: the first draft of this file
  // wrapped only the start, so `pg_ctl stop` failed silently as root and
  // left an orphaned postmaster holding the port. The next run then
  // deleted its data directory and could never bind again, so the whole
  // section reported "no PostgreSQL available" — a green-looking skip
  // caused entirely by the harness. Caught by this suite failing on its
  // own second run.
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) { /* not running */ }
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

function psql(pg, sql) {
  return sh(`psql ${pg.conn} -X -q -t -A -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`);
}
function psqlFile(pg, file) {
  return sh(`psql ${pg.conn} -X -q -v ON_ERROR_STOP=1 -f "${file}"`);
}
