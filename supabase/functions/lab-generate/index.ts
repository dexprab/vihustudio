// lab-generate — the Ether Mystery Lab's generation endpoint.
//
// SPRINT — Ether Mystery Lab (Decision 58). ADMINISTRATORS ONLY.
//
// ---------------------------------------------------------------
// WHAT THIS IS, AND WHAT IT IS NOT
//
// The browser Lab (tools/ether-mystery-lab/index.html) is a DEVELOPER
// research instrument: it assembles a generation request from the
// Ether's own vocabulary (js/etherGrammar.js's contract, the Creation
// Lens's projections, the constellation family library) and asks a
// real model for Mystery/Challenge CANDIDATES — structured data in the
// 0766 candidate schema, never code. This function is the secure path
// for that ask: the provider key lives HERE, in the function's own
// environment, and nowhere else (Decision 25's rule, applied again).
//
// It is NOT part of the Ether runtime. No child-facing path reaches
// it, nothing in the Ether runtime knows it exists, and the Composer
// stays deterministic — a candidate this function returns is DATA that
// still has to pass the one validator, a human review, and a reviewed
// commit before any child can meet it (the canon-repository pattern).
//
// ---------------------------------------------------------------
// WHY IT IS A THIN RELAY AND NOT A PROMPT OWNER
//
// The prompt lives in ONE place — tools/ether-mystery-lab/labKit.js —
// because the Lab's Direct (dev-only) mode and this endpoint must send
// the IDENTICAL contract, or the first real experiment would be
// comparing two different generators. The prompt is reviewable product
// research, not a secret; the KEY is the secret, and the key is the
// whole reason this function exists. What this function adds on top of
// the relay: the session-derived caller, the administrators-only gate
// (the invite-send precedent — a metered relay wearing our name is
// admin business), the rate bucket, bounded requests (Decision 49: a
// promise that cannot settle is not a failure mode this product may
// have), and the guarantee that no provider error text and no key ever
// reaches a browser.
//
// AMENDS Decision 34's "companion-chat is the only place in VihuPlanet
// that knows OpenAI exists" — this is now the second, recorded in
// CLAUDE.md's Decision 58 clauses. Same posture: the provider host is
// named exactly once, failures are HTTP 200 with a one-word reason,
// and the reply never names the provider.
//
// CONFIGURATION:
//   OPENAI_API_KEY    required for real generation (shared with
//                     companion-chat — one account, one key, one place
//                     per function's own env)
//   LAB_MODEL         optional, default gpt-4o-mini
//
// Deploy: supabase/DEPLOY_lab_generate.md.

const BUILD = 'LAB1';

// ===== BEGIN GENERATED edgeAuth — do not edit below this line =====
// Generated from supabase/functions/_shared/edgeAuth.js, which is the
// readable original with every decision explained. Regenerate with:
//   node tools/edge-auth-test/sync-shared.js
const LIMITS = {
  'voice-speak': { max: 60, windowSeconds: 3600 },

  'sky-protection': { max: 6, windowSeconds: 3600 },

  'family-album': { max: 120, windowSeconds: 3600 },

  'invite-send': { max: 30, windowSeconds: 3600 },

  'companion-chat': { max: 40, windowSeconds: 3600 },

  'creation-share': { max: 20, windowSeconds: 3600 },

  'lab-generate': { max: 30, windowSeconds: 3600 },
};

const REFUSALS = {
  unauthorized: 401,   // no session, bad session, or the anon key alone
  forbidden: 403,      // a real session, but not for this resource
  rate_limited: 429,
};

function refusal(reason, extra) {
  const body = { ok: false, reason: reason };
  if (extra && typeof extra.retryAfter === 'number') body.retryAfter = extra.retryAfter;
  return { status: REFUSALS[reason] || 403, body: body };
}

function bearerToken(req) {
  let raw = '';
  try {
    raw = (req && req.headers && typeof req.headers.get === 'function')
      ? (req.headers.get('authorization') || req.headers.get('Authorization') || '')
      : '';
  } catch (e) { return null; }
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(String(raw));
  return m ? m[1] : null;
}

function peekClaims(token) {
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

function secretsMatch(a, b) {
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

const AUTH_TIMEOUT_MS = 8000;

async function resolveCaller(req, env, opts) {
  const token = bearerToken(req);
  if (!token) return { ok: false, reason: 'unauthorized' };

  const url = (env && env.supabaseUrl ? String(env.supabaseUrl) : '').replace(/\/+$/, '');
  const anonKey = (env && env.anonKey) || '';
  const serviceKey = (env && env.serviceKey) || '';

  if (serviceKey && secretsMatch(token, serviceKey)) {
    return { ok: true, kind: 'service', userId: null, email: null, isAnonymous: false };
  }

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
    let ctl = null;
    try { ctl = new AbortController(); } catch (e) { ctl = null; }
    let bell = null;
    const capped = new Promise(function (_, reject) {
      bell = setTimeout(function () {
        try { if (ctl) ctl.abort(); } catch (e) {}
        reject(new Error('auth-timeout'));
      }, AUTH_TIMEOUT_MS);
    });
    try {
      res = await Promise.race([
        doFetch(url + '/auth/v1/user', Object.assign(
          { headers: { Authorization: 'Bearer ' + token, apikey: anonKey } },
          ctl ? { signal: ctl.signal } : null)),
        capped,
      ]);
    } finally {
      clearTimeout(bell);
    }
  } catch (e) {
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
    isAnonymous: (typeof u.is_anonymous === 'boolean') ? u.is_anonymous : !u.email,
  };
}

async function authorizeCardAccess(db, identityId, caller, columns) {
  if (!db || !identityId || !caller || !caller.ok) {
    return { ok: false, reason: 'unauthorized' };
  }
  if (caller.kind !== 'user') return { ok: false, reason: 'forbidden' };

  const cols = columns || 'id, owner_id';
  const want = cols.indexOf('owner_id') === -1 ? (cols + ', owner_id') : cols;

  let row = null;
  try {
    const res = await db.from('magic_card_identities').select(want).eq('id', identityId).limit(1);
    if (res.error) return { ok: false, reason: 'forbidden' };
    row = (res.data || [])[0] || null;
  } catch (e) { return { ok: false, reason: 'forbidden' }; }

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

async function isPlatformAdmin(db, caller) {
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

async function checkRateLimit(db, bucket, subject, env) {
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

function limitFor(bucket, env) {
  const base = LIMITS[bucket];
  if (!base) return null;
  const key = String(bucket).toUpperCase().replace(/-/g, '_');
  const read = (env && typeof env.get === 'function') ? env.get : null;
  const num = function (name, fallback) {
    if (!read) return fallback;
    const raw = read(name);
    if (raw == null || String(raw).trim() === '') return fallback;
    const n = Number(raw);
    return (isFinite(n) && n >= 0) ? Math.floor(n) : fallback;
  };
  return {
    max: num('EDGE_LIMIT_' + key + '_MAX', base.max),
    windowSeconds: num('EDGE_LIMIT_' + key + '_WINDOW', base.windowSeconds),
  };
}

function restDb(url, serviceKey, fetchImpl) {
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

async function guard(req, opts) {
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

// ===== END GENERATED edgeAuth =====

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const PROVIDER_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

// Bounds on what a caller may relay. Generous for a research batch,
// impossible for abuse: at most a handful of messages, each capped,
// and the model name must look like a model name rather than a path.
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 60000;
const MODEL_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;

// Decision 49 — every network promise on a path somebody waits on
// needs a bound, and this one aborts as well as races.
async function boundedFetch(doFetch: typeof fetch, url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => { try { ctl.abort(); } catch { /* held */ } }, ms);
  try {
    const race = await Promise.race([
      doFetch(url, { ...init, signal: ctl.signal }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms + 500)),
    ]);
    return race as Response | null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// The deployed artifact is the tested artifact (companion-chat's own
// pattern): the handler takes its environment and its fetch as
// injectable dependencies, Deno serves it, a suite imports it.
type Deps = { env: (n: string) => string; fetchImpl?: typeof fetch };

function makeHandler(deps: Deps) {
  const env = deps.env;
  const doFetch: typeof fetch = deps.fetchImpl || fetch;
  return async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ---------------------------------------------------------------
  // ADMINISTRATORS ONLY (the invite-send precedent, Decision 30).
  //
  // This relays to a metered provider on our account. Reached with the
  // public anon key it would be a free, world-callable LLM — the exact
  // failure Decision 30 records. The caller is derived from the
  // verified session; platform_admins is asked with the email the AUTH
  // SERVER returned, never one the client sent.
  const SUPA_URL = env('SUPABASE_URL');
  const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY');
  const db = (SUPA_URL && SERVICE) ? restDb(SUPA_URL, SERVICE, doFetch) : null;
  const pass = await guard(req, {
    env: { supabaseUrl: SUPA_URL, anonKey: env('SUPABASE_ANON_KEY'), serviceKey: SERVICE },
    require: 'user',
    bucket: 'lab-generate',
    db,
    envGet: env,
    fetchImpl: doFetch,
  });
  if (!pass.ok) return json(pass.body, pass.status);
  if (!(await isPlatformAdmin(db, pass.caller))) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const key = env('OPENAI_API_KEY');

  // Which build is live and whether a provider key is configured at
  // all — the Lab's "Test connection" button, so a missing key is a
  // sentence on screen rather than a mystery. The key itself never
  // travels, in either direction.
  if (payload.action === 'ping') {
    return json({
      ok: true,
      build: BUILD,
      provider: key ? 'configured' : 'none',
      model: env('LAB_MODEL') || DEFAULT_MODEL,
    });
  }

  if (payload.action !== 'generate') return json({ ok: false, reason: 'unknown-action' });
  if (!key) return json({ ok: false, reason: 'not-configured' });

  // The messages the Lab built (labKit.js is the one prompt owner).
  // Validated for SHAPE and BOUNDS only — the content is the Lab's own
  // research contract, already privacy-swept in the browser, and this
  // function adds no second copy of that sweep because it adds no
  // second source of data: everything it relays came from the one
  // labKit builder or it is refused here by shape.
  const msgs = payload.messages;
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > MAX_MESSAGES) {
    return json({ ok: false, reason: 'bad-messages' });
  }
  for (const m of msgs) {
    if (!m || typeof m !== 'object') return json({ ok: false, reason: 'bad-messages' });
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      return json({ ok: false, reason: 'bad-messages' });
    }
    if (typeof content !== 'string' || !content || content.length > MAX_MESSAGE_CHARS) {
      return json({ ok: false, reason: 'bad-messages' });
    }
  }

  let model = String(payload.model || env('LAB_MODEL') || DEFAULT_MODEL);
  if (!MODEL_RE.test(model)) model = DEFAULT_MODEL;

  // ONE attempt, bounded. No retry loop — the Lab's own rule (§20 of
  // the brief): the developer deliberately requests another batch.
  const res = await boundedFetch(doFetch, PROVIDER_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: msgs,
      response_format: { type: 'json_object' },
      temperature: typeof payload.temperature === 'number' &&
        payload.temperature >= 0 && payload.temperature <= 1.5
        ? payload.temperature : 0.9,
    }),
  }, 110000);

  // Failure is one word, and it never carries provider text, a request
  // id or the key — which provider answered is configuration, and the
  // ping is where a developer asks that.
  if (!res) return json({ ok: false, reason: 'unavailable' });
  if (!res.ok) {
    return json({ ok: false, reason: res.status === 429 ? 'provider-busy' : 'unavailable' });
  }

  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { return json({ ok: false, reason: 'malformed' }); }
  const choices = body.choices;
  const first = Array.isArray(choices) ? choices[0] as Record<string, unknown> : null;
  const message = first && typeof first.message === 'object' ? first.message as Record<string, unknown> : null;
  const text = message && typeof message.content === 'string' ? message.content : '';
  if (!text) return json({ ok: false, reason: 'malformed' });

  // What leaves: the model's structured TEXT (the Lab parses and
  // validates it), the model that answered, and the build. Nothing
  // else — no usage ids, no provider metadata, no echo of the request.
  return json({ ok: true, text, model, build: BUILD });
};
}

// Deno serves it; a test imports it. Guarded rather than unconditional,
// which is companion-chat's own one deviation and buys exactly that.
const handler = makeHandler({ env: (n: string) => (typeof Deno !== 'undefined' ? (Deno.env.get(n) || '') : '') });
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(handler);

export { makeHandler, handler, BUILD, DEFAULT_MODEL, MAX_MESSAGES, MAX_MESSAGE_CHARS };
