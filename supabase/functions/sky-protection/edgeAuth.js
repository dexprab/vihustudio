// supabase/functions/_shared/edgeAuth.js — who is calling, and may they.
//
// ---------------------------------------------------------------
// WHY THIS EXISTS
//
// Every Edge Function in this product used to be reached with the
// PUBLIC anon key. It is served from supabase-config.json on a public
// site out of a public repository, so "Authorization: Bearer <anonKey>"
// is a header anybody can copy — and it satisfies Supabase's own
// verify_jwt gate, because the anon key genuinely is a valid JWT.
// supabase/functions/family-album/index.ts said so in its own deploy
// note: "Calls authenticate with the project's anon key ... which
// satisfies the default verify_jwt gate."
//
// So the gate was open and nothing behind it asked who had come
// through. Measured consequences, both real:
//
//   · voice-speak spends money at ElevenLabs on every miss, for
//     anybody who cares to call it.
//   · sky-protection took a client-supplied `identityId`, wrote the
//     caller's chosen email onto THAT card, and posted the card's
//     nickname, constellation and serial to it. Its own comment said
//     recover "can never be pointed at a card by anybody who did not
//     just prove they hold it" — and nothing proved anything.
//
// This module is the fix, once, so no function grows its own.
//
// ---------------------------------------------------------------
// THE RULE
//
//     authenticated user  →  authorized resource  →  permitted operation
//
// and never
//
//     client says "I own X"  →  server trusts X
//
// The browser already holds a real Supabase session
// (signInAnonymously(), js/themeRepositoryClient.js). Anonymous is not
// the same as unauthenticated: an anonymous user has a real `sub` that
// the auth server issued and can verify, which is exactly what RLS
// already leans on everywhere in supabase/schema.sql. So nothing new
// is introduced here — no password, no email login, no OAuth, no
// second identity system. The session that already exists is simply
// USED rather than ignored.
//
// ---------------------------------------------------------------
// THIS FILE IS THE SOURCE OF TRUTH, AND IT IS VENDORED
//
// A byte-identical copy of it sits in each Edge Function's own folder
// as `edgeAuth.js`, and that is what the functions import — `./`, never
// `../_shared/`.
//
// WHY, since a single shared module is obviously the better shape:
// `_shared/` is a CLI-only bundling convention ("any folder starting
// with an underscore gets pulled into the function bundle by deploy"),
// and it is not carried by a deploy made from the Supabase Dashboard.
// Measured, on this project, from the real deploy:
//
//   Module not found "file:///tmp/user_fn_<ref>_<uuid>_4/_shared/
//   edgeAuth.js" at .../source/index.ts:60:31
//
// Every other function in this repository has always been
// self-contained; `_shared/` was introduced by this sprint without
// first checking how this project actually deploys. A security fix that
// only lands if you happen to use one particular tool is not a fix.
//
// So the deploy no longer depends on the tool. The cost is five copies,
// and it is paid for by tools/edge-auth-test, which asserts every copy
// is byte-identical to this file — drift is a test failure, never a
// silent divergence between what one function enforces and another
// does. After editing THIS file, run:
//
//   node tools/edge-auth-test/sync-shared.js
//
// ---------------------------------------------------------------
// WHY PLAIN .js AND NOT .ts
//
// So it can be tested. supabase/functions/family-album/parse.js is the
// established precedent in this repo: a plain ESM module imported by a
// Deno index.ts and exercised from Node by tools/family-album-test/.
// Deno imports it unchanged; Node imports it unchanged; there is no
// build step, which is the whole architecture of this project.
//
// Every impure edge is INJECTED — `fetchImpl` for the auth server, a
// `db` object for Postgres — so the suite drives the real decision
// logic without a network and without a deployment. What cannot be
// proved that way is stated in the test file rather than implied.

// ---------------------------------------------------------------
// THE ONE CONFIGURATION POINT
//
// Every limit in the product lives here. Do not scatter limits into
// individual functions — the same discipline js/gardenEngine.js's own
// LIFECYCLE object holds ("Do not scatter timing constants"), for the
// same reason: these will be tuned, and tuning them must be one edit
// in one place that a person can read in full.
//
// `windowSeconds` is a FIXED window, not a sliding one. A fixed window
// is one row and one atomic upsert; a sliding window needs a log of
// timestamps per caller, which is a bigger thing to store and to reason
// about for a product this size. The cost is the standard one: a caller
// can spend `max` at the very end of one window and `max` again at the
// start of the next. Conservative limits make that harmless.
//
// Any value may be overridden per deployment by an environment
// variable, so a limit can be tightened on a live project without a
// redeploy of this file: EDGE_LIMIT_<BUCKET>_MAX and
// EDGE_LIMIT_<BUCKET>_WINDOW, bucket upper-cased with '-' → '_'.
export const LIMITS = {
  // Generated speech. Costs money at the provider on every cache miss,
  // and a child's session speaks a handful of lines an hour — 60 an
  // hour is generous for real use and ruinous for nobody.
  'voice-speak': { max: 60, windowSeconds: 3600 },

  // Sends email. Deliberately the tightest thing here: a child protects
  // their sky once, and a recovery is a rare act by a worried grown-up.
  'sky-protection': { max: 6, windowSeconds: 3600 },

  // Fetches a third-party page and proxies images. Not metered by a
  // provider, but it is outbound traffic on our name, so it is bounded.
  'family-album': { max: 120, windowSeconds: 3600 },

  // Admin-only, and an administrator sending more than this in an hour
  // is a mistake rather than a workflow.
  'invite-send': { max: 30, windowSeconds: 3600 },

  // RESERVED for Sprint 1B. The endpoint does not exist yet and must
  // not be created by this sprint; the limit is written here now so the
  // endpoint cannot ship without one, which is the whole reason this
  // module was built before it. Deliberately low: a conversation is a
  // few turns, and every turn costs money twice (a model call and a
  // speech call).
  'companion-chat': { max: 40, windowSeconds: 3600 },
};

// The safe failure shape. Consistent everywhere, and it never carries a
// token, a key, an owner id, a card, a Storage URL, a provider message
// or a stack. A caller learns THAT it was refused and the one word for
// why — which is all a browser can act on anyway.
//
// Note the status: 401 for "we do not know who you are", 403 for "we
// know, and no", 429 for "too much". Everything else in this product
// answers 200 with {ok:false, reason} so a caller needs no error
// handling (voice-speak's own convention) — that stays true for its
// OWN failures. An authorization refusal is different in kind and is
// allowed to be a real status, because no child-facing path can ever
// produce one: a child's browser always carries its session.
export const REFUSALS = {
  unauthorized: 401,   // no session, bad session, or the anon key alone
  forbidden: 403,      // a real session, but not for this resource
  rate_limited: 429,
};

export function refusal(reason, extra) {
  const body = { ok: false, reason: reason };
  if (extra && typeof extra.retryAfter === 'number') body.retryAfter = extra.retryAfter;
  return { status: REFUSALS[reason] || 403, body: body };
}

// ---------------------------------------------------------------
// THE TOKEN
//
// Exactly one place parses the header, so no function invents a second
// way to read it. Returns null for anything that is not a bearer token,
// including an empty bearer — "Bearer " with nothing after it is a
// missing credential, not a credential that happens to be blank.
export function bearerToken(req) {
  let raw = '';
  try {
    raw = (req && req.headers && typeof req.headers.get === 'function')
      ? (req.headers.get('authorization') || req.headers.get('Authorization') || '')
      : '';
  } catch (e) { return null; }
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(String(raw));
  return m ? m[1] : null;
}

// A JWT's payload, WITHOUT verifying it. Used for exactly two things
// and never for authorization:
//
//   · telling the anon key apart from a user token before spending a
//     network round trip on it (the anon key carries role 'anon' and
//     no `sub`, so it can be refused locally);
//   · recognising the service-role key for a server-to-server caller,
//     which is then checked by CONSTANT-TIME COMPARISON against the
//     real secret rather than trusted from its claims.
//
// Nothing here decides that a caller IS somebody. The auth server does
// that, in resolveCaller() below.
export function peekClaims(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = (typeof atob === 'function')
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
    let out = '';
    for (let i = 0; i < bin.length; i++) out += '%' + ('00' + bin.charCodeAt(i).toString(16)).slice(-2);
    return JSON.parse(decodeURIComponent(out));
  } catch (e) { return null; }
}

// Length-independent comparison for the one secret this module ever
// compares by value. Not because a timing attack on an Edge Function is
// likely, but because writing `a === b` for a credential teaches the
// next person the wrong habit.
export function secretsMatch(a, b) {
  const x = String(a == null ? '' : a);
  const y = String(b == null ? '' : b);
  if (!x || !y) return false;
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    diff |= (x.charCodeAt(i % x.length) || 0) ^ (y.charCodeAt(i % y.length) || 0);
  }
  return diff === 0;
}

// ---------------------------------------------------------------
// WHO IS CALLING
//
// Three kinds of caller exist in this product and they are genuinely
// different, so they are named rather than collapsed:
//
//   'user'     a browser holding a Supabase session — anonymous
//              (every child) or a real signed-in account (the admin
//              console). This is nearly everything.
//   'service'  Postgres calling out through pg_net with the service
//              role key. supabase/migrations_admin_console.sql's
//              notify_creator_born() trigger is the only one today.
//   null       refused.
//
// The user branch asks the AUTH SERVER, every time. A locally-decoded
// JWT is not proof: the signature is what makes it proof, and verifying
// a signature here would mean holding the JWT secret in every function.
// GoTrue's /auth/v1/user endpoint already does exactly this job, is one
// request, and is the same check RLS performs on the database side —
// so this cannot drift away from what the rest of the product believes.
//
// @param {Request} req
// @param {object}  env  { supabaseUrl, anonKey, serviceKey }
// @param {object} [opts] { fetchImpl }
// @returns {Promise<{ok:true,kind,userId,email,isAnonymous}|{ok:false,reason}>}
export async function resolveCaller(req, env, opts) {
  const token = bearerToken(req);
  if (!token) return { ok: false, reason: 'unauthorized' };

  const url = (env && env.supabaseUrl ? String(env.supabaseUrl) : '').replace(/\/+$/, '');
  const anonKey = (env && env.anonKey) || '';
  const serviceKey = (env && env.serviceKey) || '';

  // A server-to-server caller. Checked against the real secret, never
  // believed from its own claims — a token that merely SAYS
  // role:service_role proves nothing at all.
  if (serviceKey && secretsMatch(token, serviceKey)) {
    return { ok: true, kind: 'service', userId: null, email: null, isAnonymous: false };
  }

  // The public anon key, presented alone. This is the exact call every
  // client in this product used to make, and it is now the exact call
  // that is refused. Caught locally so an obviously-anonymous key never
  // costs a round trip.
  const claims = peekClaims(token);
  if (claims && !claims.sub && claims.role === 'anon') {
    return { ok: false, reason: 'unauthorized' };
  }
  if (anonKey && secretsMatch(token, anonKey)) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!url || !anonKey) return { ok: false, reason: 'unauthorized' };

  const doFetch = (opts && opts.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { ok: false, reason: 'unauthorized' };

  let res;
  try {
    res = await doFetch(url + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: anonKey },
    });
  } catch (e) {
    // The auth server could not be reached. FAIL CLOSED. Everywhere
    // else in this product an unreadable signal means yes (DeviceGate,
    // grandfathering) because the cost of a wrong no lands on a child.
    // Here the cost of a wrong yes lands on a child's data and on a
    // metered account, so the default flips. It is the one place in
    // VihuPlanet that is deliberately the other way round.
    return { ok: false, reason: 'unauthorized' };
  }
  if (!res || !res.ok) return { ok: false, reason: 'unauthorized' };

  let user;
  try { user = await res.json(); } catch (e) { return { ok: false, reason: 'unauthorized' }; }
  const id = user && (user.id || (user.user && user.user.id));
  if (!id) return { ok: false, reason: 'unauthorized' };

  const u = (user && user.user) ? user.user : user;
  return {
    ok: true,
    kind: 'user',
    userId: String(id),
    email: (u && u.email) ? String(u.email) : null,
    // GoTrue's own flag, the same signal js/themeRepositoryClient.js
    // already prefers over "has an email at all".
    isAnonymous: (typeof u.is_anonymous === 'boolean') ? u.is_anonymous : !u.email,
  };
}

// ---------------------------------------------------------------
// MAY THEY TOUCH THIS CARD
//
// The ownership question every function that names a Magic Card has to
// ask, in one place. Two ways to be entitled, and the second is not a
// convenience — it is what keeps cross-device recall working:
//
//   1. The identity's own owner_id is this caller. True on the device
//      that CLAIMED the card (js/magicCard.js's _pushIdentitySnapshot
//      stamps owner_id from session.user.id).
//   2. This caller has PROVEN a recall of that identity — a row in
//      magic_card_recalls, which only recall_magic_card()'s SECURITY
//      DEFINER body can ever write. That table has no insert policy for
//      any client role, so a row in it is real proof.
//
// This is has_magic_recall_grant()'s own logic (supabase/schema.sql),
// expressed for a service-role caller: that function reads auth.uid(),
// and inside an Edge Function using the service role auth.uid() is
// null. Same proof, same table, asked the way this caller can ask it.
//
// Note WHY (2) is needed at all: js/magicCard.js's adopt() keeps the
// ORIGINAL identity_id on a recalled device and never re-stamps
// owner_id, so a Creator recognised at their grandmother's house is
// legitimately not the owner of their own card row. Without this branch
// Sky Protection would refuse them.
//
// @param {object} db  a supabase-js client holding the SERVICE role
// @returns {Promise<{ok:true,identity}|{ok:false,reason}>}
export async function authorizeCardAccess(db, identityId, caller, columns) {
  if (!db || !identityId || !caller || !caller.ok) {
    return { ok: false, reason: 'unauthorized' };
  }
  // A service caller is Postgres itself and has already been through
  // its own gate; it is not acting for a browser and has no card.
  if (caller.kind !== 'user') return { ok: false, reason: 'forbidden' };

  const cols = columns || 'id, owner_id';
  const want = cols.indexOf('owner_id') === -1 ? (cols + ', owner_id') : cols;

  let row = null;
  try {
    const res = await db.from('magic_card_identities').select(want).eq('id', identityId).limit(1);
    if (res.error) return { ok: false, reason: 'forbidden' };
    row = (res.data || [])[0] || null;
  } catch (e) { return { ok: false, reason: 'forbidden' }; }

  // A card that does not exist and a card belonging to somebody else
  // answer IDENTICALLY. Otherwise this becomes an oracle for which
  // Magic Card ids are real — the same reasoning sky-protection's own
  // `recover` branch already uses for addresses ("saying 'no skies
  // here' would turn this into an oracle").
  if (!row) return { ok: false, reason: 'forbidden' };

  if (row.owner_id && String(row.owner_id) === caller.userId) {
    return { ok: true, identity: row };
  }

  try {
    const res = await db.from('magic_card_recalls')
      .select('id').eq('identity_id', identityId).eq('recaller_id', caller.userId).limit(1);
    if (!res.error && (res.data || []).length) return { ok: true, identity: row };
  } catch (e) { /* falls through to the refusal below */ }

  return { ok: false, reason: 'forbidden' };
}

// ---------------------------------------------------------------
// IS THIS AN ADMINISTRATOR
//
// is_platform_admin() (supabase/migrations_admin_console.sql) matches
// on auth.jwt() ->> 'email', which an Edge Function using the service
// role cannot supply. Same table, same comparison, asked with the email
// the AUTH SERVER returned for this token — never one the client sent.
//
// An anonymous session can never be an administrator however its email
// column reads, so that is refused before the table is consulted.
export async function isPlatformAdmin(db, caller) {
  if (!db || !caller || !caller.ok || caller.kind !== 'user') return false;
  if (caller.isAnonymous || !caller.email) return false;
  try {
    const res = await db.from('platform_admins').select('email');
    if (res.error) return false;
    const mine = caller.email.toLowerCase();
    return (res.data || []).some(function (r) {
      return r && String(r.email || '').toLowerCase() === mine;
    });
  } catch (e) { return false; }
}

// ---------------------------------------------------------------
// HOW MUCH IS TOO MUCH
//
// One Postgres call, one row, atomic. The counting happens inside
// edge_rate_limit_hit() (supabase/migrations_edge_rate_limit.sql) with
// an INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so two concurrent
// requests can never both read "0 so far" and both be allowed.
//
// No Redis, no external service, no second database. Postgres is
// already here and this is one small table.
//
// FAILS OPEN, deliberately and narrowly. If the migration has not been
// run yet, or the table is unreachable, the call is ALLOWED — a
// rate limiter that takes the product down when it is itself broken has
// turned a cost control into an outage. The authorization above does
// NOT fail open; only this does, and the difference is that a missing
// limiter costs money while a missing auth check costs a child's data.
//
// @param {object} db  a supabase-js client holding the SERVICE role
// @param {string} bucket  a key in LIMITS
// @param {string} subject the caller's own user id — never anything
//        the client supplied, or a caller could reset their own count
//        by inventing a new one
// @param {object} [env] { get(name) } for the per-deployment overrides
export async function checkRateLimit(db, bucket, subject, env) {
  const cfg = limitFor(bucket, env);
  if (!cfg) return { allowed: true, limit: 0, remaining: 0, retryAfter: 0, counted: false };
  if (!db || !subject) return { allowed: true, limit: cfg.max, remaining: cfg.max, retryAfter: 0, counted: false };

  try {
    const res = await db.rpc('edge_rate_limit_hit', {
      p_bucket: bucket,
      p_subject: String(subject),
      p_limit: cfg.max,
      p_window_seconds: cfg.windowSeconds,
    });
    if (res.error || !res.data) {
      return { allowed: true, limit: cfg.max, remaining: cfg.max, retryAfter: 0, counted: false };
    }
    const d = res.data;
    return {
      allowed: d.allowed !== false,
      limit: cfg.max,
      remaining: Math.max(0, Number(d.remaining) || 0),
      retryAfter: Math.max(0, Number(d.retry_after) || 0),
      counted: true,
    };
  } catch (e) {
    return { allowed: true, limit: cfg.max, remaining: cfg.max, retryAfter: 0, counted: false };
  }
}

// The limit in force for a bucket, after any per-deployment override.
// Exported because the test suite asserts the override actually takes
// effect rather than assuming the reader wired it up.
export function limitFor(bucket, env) {
  const base = LIMITS[bucket];
  if (!base) return null;
  const key = String(bucket).toUpperCase().replace(/-/g, '_');
  const read = (env && typeof env.get === 'function') ? env.get : null;
  const num = function (name, fallback) {
    if (!read) return fallback;
    const raw = read(name);
    if (raw == null || String(raw).trim() === '') return fallback;
    const n = Number(raw);
    // ZERO IS A VALID OVERRIDE AND IT MEANS CLOSED, matching
    // edge_rate_limit_hit()'s own rule ("a limit of zero means closed,
    // never unlimited"). Two layers disagreeing about what 0 means is
    // how a kill switch turns into an open door. Anything that is not a
    // non-negative number — a typo, an empty string, a word — falls back
    // to the value in the table rather than opening anything up.
    return (isFinite(n) && n >= 0) ? Math.floor(n) : fallback;
  };
  return {
    max: num('EDGE_LIMIT_' + key + '_MAX', base.max),
    windowSeconds: num('EDGE_LIMIT_' + key + '_WINDOW', base.windowSeconds),
  };
}

// ---------------------------------------------------------------
// A DATABASE HANDLE FOR A FUNCTION THAT HAS NO IMPORTS
//
// supabase/functions/voice-speak/index.ts deliberately imports nothing
// at all — it talks to Storage over plain fetch. Making it pull in
// esm.sh/@supabase/supabase-js just to count a rate-limit hit would add
// a dependency, a cold-start cost and a supply-chain surface to the one
// function on the hot path of a child hearing a voice.
//
// So this is the smallest handle that satisfies what this module
// actually uses: rpc(), and from().select().eq().limit(). Nothing more
// is implemented, on purpose — an adapter that grows toward being a
// client is a client, badly. A function that already holds a real
// supabase-js client (sky-protection, family-album, invite-send) passes
// that instead and this is never constructed.
//
// The SERVICE role key goes in the headers and never leaves this
// process. It is the same key those functions already use.
export function restDb(url, serviceKey, fetchImpl) {
  const base = String(url || '').replace(/\/+$/, '');
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!base || !serviceKey || !doFetch) return null;
  const headers = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
  };

  async function rpc(name, args) {
    try {
      const res = await doFetch(base + '/rest/v1/rpc/' + encodeURIComponent(name), {
        method: 'POST', headers: headers, body: JSON.stringify(args || {}),
      });
      if (!res.ok) return { data: null, error: { status: res.status } };
      return { data: await res.json(), error: null };
    } catch (e) { return { data: null, error: { message: 'unreachable' } }; }
  }

  function from(table) {
    const filters = [];
    let cols = '*', cap = '';
    const builder = {
      select(c) { if (c) cols = c; return builder; },
      eq(col, val) { filters.push(encodeURIComponent(col) + '=eq.' + encodeURIComponent(val)); return builder; },
      limit(n) { cap = '&limit=' + Number(n); return builder; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    async function run() {
      try {
        const q = '?select=' + encodeURIComponent(cols) + (filters.length ? '&' + filters.join('&') : '') + cap;
        const res = await doFetch(base + '/rest/v1/' + encodeURIComponent(table) + q, { headers: headers });
        if (!res.ok) return { data: null, error: { status: res.status } };
        return { data: await res.json(), error: null };
      } catch (e) { return { data: null, error: { message: 'unreachable' } }; }
    }
    return builder;
  }

  return { rpc: rpc, from: from };
}

// ---------------------------------------------------------------
// THE WHOLE GATE, FOR A FUNCTION THAT JUST WANTS TO BE SAFE
//
// resolveCaller + rate limit, in the order that matters: identity
// first, because the rate-limit subject must be a caller we have
// actually verified. Counting an unauthenticated request would let
// anybody spend a stranger's allowance simply by claiming to be them.
//
// Returns { ok:true, caller } or { ok:false, status, body } ready to
// send back verbatim.
export async function guard(req, opts) {
  const o = opts || {};
  const caller = await resolveCaller(req, o.env || {}, { fetchImpl: o.fetchImpl });
  if (!caller.ok) {
    const r = refusal('unauthorized');
    return { ok: false, status: r.status, body: r.body };
  }
  if (o.require === 'service' && caller.kind !== 'service') {
    const r = refusal('forbidden');
    return { ok: false, status: r.status, body: r.body };
  }
  if (o.require === 'user' && caller.kind !== 'user') {
    const r = refusal('forbidden');
    return { ok: false, status: r.status, body: r.body };
  }

  if (o.bucket && caller.kind === 'user') {
    const rl = await checkRateLimit(o.db, o.bucket, caller.userId, o.envGet ? { get: o.envGet } : null);
    if (!rl.allowed) {
      const r = refusal('rate_limited', { retryAfter: rl.retryAfter });
      return { ok: false, status: r.status, body: r.body, retryAfter: rl.retryAfter };
    }
  }
  return { ok: true, caller: caller };
}
