// voice-speak — the only place in VihuPlanet that knows ElevenLabs exists.
//
// Sprint: Vihu Voice Foundation. The child-facing runtime asks for
// "this character, these words" and gets audio back; it never sees a
// provider, a voice id, a model or a key.
//
// ---------------------------------------------------------------
// WHY THIS FUNCTION EXISTS AT ALL
//
// The ElevenLabs key must never reach a browser — their own docs say so
// and it is the sprint's one non-negotiable. VihuPlanet is a static site
// with no server of its own, so the boundary is a Supabase Edge
// Function, which is the boundary this project already uses for
// sky-protection and creator-born. Nothing new was invented for it.
//
// The client sends: { characterId, voiceId, modelId, settings, text }.
//
// It sends the voiceId rather than the key because the voiceId is not a
// secret — it is content, it lives in assets/registry.json, and keeping
// the resolution client-side is what lets a voice be changed without
// redeploying this function. The KEY is the secret, and it only ever
// lives here.
//
// ---------------------------------------------------------------
// CACHING
//
// VihuPlanet's dialogue is mostly static, so regenerating it is paying
// twice for the same sound. The cache key is the whole request — voice,
// model, settings and text — so changing any of them is a different
// sound and correctly misses. Stored in Supabase Storage, which this
// project already has; no asset pipeline was built for this.
//
// Deploy:
//   supabase functions deploy voice-speak
// Secrets (Edge Functions -> voice-speak -> Secrets):
//   ELEVENLABS_API_KEY   required
//   VOICE_CACHE_BUCKET   optional, defaults to 'voice-cache'
//
// Leave JWT verification ON. This spends money per call, so an
// unauthenticated one is somebody else's bill.
//
// ---------------------------------------------------------------
// AND THAT NOTE WAS TRUE AND NOT ENOUGH (Sprint 1A, Decision 30).
//
// Supabase's verify_jwt gate is satisfied by the PUBLIC anon key, which
// this site serves from supabase-config.json out of a public
// repository — so "leave JWT verification on" meant "anybody who views
// source may spend our ElevenLabs balance." Nothing here asked who had
// come through the gate.
//
// It now does, through supabase/functions/_shared/edgeAuth.js: the
// caller is resolved from their real Supabase session (anonymous is
// fine — every browser has one) and counted against the 'voice-speak'
// allowance in that module's own LIMITS table.
//
// NOTHING ELSE CHANGED. Not the generation, not the ElevenLabs call,
// not the settings, not the cache keys, not the audio format, not the
// 200-with-a-reason convention, not the timing contract js/vihuVoice.js
// depends on. This is a gate in front of the same function.
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

const BUILD = '2026-08-30 · vihu voice · ephemeral + pass-through';
const TTS_ROOT = 'https://api.elevenlabs.io/v1/text-to-speech';
const MAX_CHARS = 600; // a spoken line, not a chapter

function env(n: string) { return (Deno.env.get(n) || '').trim(); }

// EVERY header a caller actually sends must be listed here, or the
// browser refuses the request before it is made and the caller sees
// "TypeError: Failed to fetch" with no further detail.
//
// This bit me: the first version listed only authorization and
// content-type, while js/vihuVoice.js and the audition page both send
// `apikey` as well — so the preflight was refused and NOTHING worked,
// not merely the status ping. The two functions in this project that
// already work from a browser (sky-protection, family-album) both list
// the full set, and this now matches them exactly rather than being
// trimmed to what looked sufficient.
//
// It is also why a mocked test suite cannot catch this class of bug:
// intercepting the request in the test harness bypasses CORS entirely,
// so 84 passing checks said nothing about whether a real browser would
// allow the call.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  // A cross-origin caller sees no response header it is not told it may
  // see. Both of these are diagnostics — which path served the line, and
  // how long the provider took — and without this they were invisible to
  // the browser that had just received them.
  'Access-Control-Expose-Headers': 'X-Vihu-Voice, X-Vihu-Provider-Ms',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// The cache key is the entire request. Anything that would change the
// sound changes the key, so a re-tuned voice is never served the old
// take out of the cache.
async function cacheKey(p: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify({
    v: p.voiceId, m: p.modelId, s: p.settings ?? null, t: p.text,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function storage(path: string, method: 'GET' | 'POST', body?: Uint8Array) {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = env('VOICE_CACHE_BUCKET') || 'voice-cache';
  if (!url || !key) return null;
  return await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' } : {}),
    },
    body,
  });
}

// The gate, in one place, for every method that is not a preflight.
// A preflight carries no credentials by definition — refusing it would
// mean the browser never sends the real request and the caller sees
// "TypeError: Failed to fetch" with no further detail, which is the
// exact class of bug the CORS note above was written about.
async function gate(req: Request, bucket: string) {
  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return await guard(req, {
    env: { supabaseUrl: url, anonKey: env('SUPABASE_ANON_KEY'), serviceKey },
    require: 'user',
    bucket,
    db: restDb(url, serviceKey),
    envGet: (n: string) => Deno.env.get(n) || '',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Identity first, before a single byte of the body is read and long
  // before the provider is touched. Only a POST is counted against the
  // allowance — the GET branches are a deployment probe that costs
  // nothing, and spending a child's speech allowance on a status check
  // would make the diagnostic the thing that breaks the product.
  const pass = await gate(req, req.method === 'POST' ? 'voice-speak' : '');
  if (!pass.ok) return json(pass.body, pass.status);

  if (req.method === 'GET') {
    // ?models=1 — WHICH MODELS DOES THIS ACCOUNT ACTUALLY HAVE?
    //
    // Added after a real dead end: emotion was not audible, and the
    // candidate explanations were "the model id is wrong", "this account
    // cannot use that model" and "the tags are wrong" — three different
    // problems that all present as "sounds the same", and all of which
    // were being answered from memory rather than from fact.
    //
    // The provider knows. Asking it is one request, and it ends the
    // guessing: the ids returned here are the only ids worth putting in
    // assets/registry.json. It returns model metadata and no
    // credential — the key stays here, as always.
    const apiKey0 = env('ELEVENLABS_API_KEY');
    if (new URL(req.url).searchParams.has('models')) {
      if (!apiKey0) return json({ ok: false, reason: 'not-configured' }, 200);
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/models', {
          headers: { 'xi-api-key': apiKey0 },
        });
        const body = await r.json();
        if (!r.ok) return json({ ok: false, reason: 'provider', status: r.status, detail: body }, 200);
        return json({
          ok: true,
          models: (Array.isArray(body) ? body : []).map((m: Record<string, unknown>) => ({
            model_id: m.model_id,
            name: m.name,
            tts: m.can_do_text_to_speech,
            // The provider's own answer to "what settings does this
            // model take", which is exactly what we were guessing at.
            style: m.can_use_style,
            speaker_boost: m.can_use_speaker_boost,
          })),
        });
      } catch (e) {
        return json({ ok: false, reason: 'unreachable', detail: String(e).slice(0, 200) }, 200);
      }
    }

    return json({
      ok: true,
      build: BUILD,
      configured: !!apiKey0,
      cache: env('VOICE_CACHE_BUCKET') || 'voice-cache',
    });
  }

  let p: Record<string, unknown> = {};
  try { p = await req.json(); } catch (_e) { /* handled below */ }

  const text = String(p.text || '').trim();
  const voiceId = String(p.voiceId || '').trim();
  const modelId = String(p.modelId || 'eleven_turbo_v2_5').trim();

  // A character with no voice yet is a real, expected state — the voice
  // ids are filled in by hand once they are chosen in ElevenLabs. It is
  // not an error and must never read as one: the caller falls silent and
  // the child's experience carries on (sprint §13).
  if (!text || !voiceId) return json({ ok: false, reason: 'no-voice' }, 200);
  if (text.length > MAX_CHARS) return json({ ok: false, reason: 'too-long' }, 200);

  // ---- EPHEMERAL LINES — Sprint 3A.1 -------------------------------
  //
  // A conversation reply is said once, to one child, and never again, so
  // the cache can only ever miss on it — and a miss here is not free: it
  // is a Storage round trip inside the request the child is waiting on,
  // taken before the provider is even called. The write afterwards is
  // worse than useless: it is private one-shot audio kept for nobody,
  // which the sprint forbids outright (§16).
  //
  // A caller that says the line is ephemeral gets neither. Everything
  // else — recorded lines, rite lines, the World Host's greetings, the
  // audition room — is unchanged and still cached both ways.
  const ephemeral = p.ephemeral === true;
  const key = ephemeral ? '' : await cacheKey({ ...p, text, voiceId, modelId });
  const path = `${key}.mp3`;

  // Cached already? Serve it and never call the provider.
  if (!ephemeral) {
    const hit = await storage(path, 'GET');
    if (hit && hit.ok) {
      return new Response(await hit.arrayBuffer(), {
        headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Vihu-Voice': 'cache' },
      });
    }
  }

  const apiKey = env('ELEVENLABS_API_KEY');
  if (!apiKey) return json({ ok: false, reason: 'not-configured' }, 200);

  const settings = (p.settings && typeof p.settings === 'object') ? p.settings : {};
  // AUDIO FORMAT IS A KNOB, NOT A REWRITE — §15.
  //
  // Unset means EXACTLY what shipped before: no `output_format` on the
  // query, so ElevenLabs answers in its own default (mp3_44100_128). A
  // shorter format is a real transfer saving and a real change to how a
  // Companion sounds, and this environment cannot hear either — so it is
  // offered as one environment variable to be A/B'd against real ears,
  // and defaults to changing nothing. e.g. mp3_22050_32.
  const fmt = env('ELEVENLABS_OUTPUT_FORMAT');
  const q = fmt ? `?output_format=${encodeURIComponent(fmt)}` : '';
  const t5 = Date.now();
  const res = await fetch(`${TTS_ROOT}/${encodeURIComponent(voiceId)}${q}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: settings }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.error('elevenlabs', res.status, body);
    // `detail` is for whoever is fixing it, and NEVER for a child: no
    // caller in the product renders it, js/vihuVoice.js writes it to the
    // console, and the audition room shows it. Without it a refused
    // request is indistinguishable from every other kind of quiet, which
    // made moving between model families pure guesswork — the models
    // take different settings, and "silence" was the only symptom of
    // getting that wrong.
    //
    // It cannot leak the key: this is the provider's own error body, and
    // a provider does not echo credentials back. Truncated regardless.
    return json({ ok: false, reason: 'provider', status: res.status, detail: body }, 200);
  }

  // ---- THE BYTES GO STRAIGHT THROUGH — Sprint 3A.1 §13 -------------
  //
  // This used to `await res.arrayBuffer()` and only then answer, which
  // made the two hops STRICTLY SEQUENTIAL: every byte had to arrive from
  // the provider before the first one left for the browser. Passing the
  // body through overlaps them, and for an ephemeral line there is
  // nothing to collect, so it is a plain hand-off.
  //
  // A cached line still needs the whole thing, and tee() is what lets it
  // have both: one branch to the child now, one gathered for the write.
  // The write stays fire-and-forget — a cache miss later is not worth a
  // millisecond of a child's wait.
  const took = String(Date.now() - t5);
  const head = {
    ...cors,
    'Content-Type': 'audio/mpeg',
    'X-Vihu-Voice': ephemeral ? 'ephemeral' : 'fresh',
    // Timing only. No text, no voice id, no child, no key — a number a
    // suite and a console can read, and nothing worth reading in a log.
    'X-Vihu-Provider-Ms': took,
  };
  if (!res.body) {
    const audio = new Uint8Array(await res.arrayBuffer());
    if (!ephemeral) storage(path, 'POST', audio).catch(() => {});
    return new Response(audio, { headers: head });
  }
  if (ephemeral) return new Response(res.body, { headers: head });
  const [toChild, toCache] = res.body.tee();
  (async () => {
    try {
      const buf = new Uint8Array(await new Response(toCache).arrayBuffer());
      await storage(path, 'POST', buf);
    } catch (_e) { /* a cache write failing costs a regeneration, never speech */ }
  })();
  return new Response(toChild, { headers: head });
});
