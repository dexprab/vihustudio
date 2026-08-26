// ============================================================================
// family-album — DASHBOARD-PASTE VARIANT (single file)
// ============================================================================
// GENERATED — do not edit. This is index.ts with every local import
// inlined, for deploying via the Supabase Dashboard's in-browser editor
// (no CLI needed):
//
//   Dashboard → Edge Functions → Deploy a new function → Via Editor
//   → name it exactly:  family-album
//   → replace the template with this entire file → Deploy
//   (leave "Verify JWT" at its default ON — the function does its own
//    caller check on top of it; see CLAUDE.md → Decision 30)
//
// Regenerate: node tools/edge-auth-test/sync-shared.js
// ============================================================================
// Family Album Edge Function — VihuStudio's server-side reader for public
// Google Photos shared albums (the "Family Photos" feature).
//
// Why this exists at all: Google Photos has no official no-sign-in API, and
// the browser can't fetch the public album page directly (CORS). This
// function does the two things the client can't:
//
//   1. LIST (default): GET ?url=<shared album link>  (or POST {albumUrl})
//      Fetches the public album page server-side, extracts the inline photo
//      list (see ./parse.js for the proven extraction algorithm), and
//      returns clean JSON: { ok, count, photos: [{ uid, url, width, height,
//      imageUpdateDate, albumAddDate }] }. Each `url` is an
//      lh3.googleusercontent.com BASE url — the client appends a sizing
//      suffix ('=w300-h300' thumbnails, '=w2048-h2048' full picks).
//
//   2. IMAGE PROXY (fallback): GET ?img=<googleusercontent url>
//      Streams the image bytes back with CORS headers — used only if direct
//      lh3 loads turn out to taint the canvas in the client (the go/no-go
//      test page, tools/family-album-test/, answers that question). One
//      image per pick at most — never a browsing-time cost.
//
// This is deliberately NOT an open proxy: album fetches are restricted to
// Google Photos hosts, image fetches to *.googleusercontent.com.
//
// Failure convention mirrors js/themeRepositoryClient.js: expected failures
// come back as 200 { ok:false, error:'<reason>' } so the client always gets
// a readable, non-throwing answer; only malformed requests get 4xx.
//
// Deploy (from the repo root, one-time Supabase CLI setup assumed):
//   supabase functions deploy family-album --project-ref <your-project-ref>
// Callers send their own Supabase SESSION as Authorization and the anon
// key as `apikey` (the gateway routes on it and it authorises nothing).
// This note used to say the anon key was the credential "which satisfies
// the default verify_jwt gate" — an accurate description of a gate that
// let anybody through, since that key is public. See Decision 30.

import JSON5 from 'npm:json5@2.2.3';
// ===== BEGIN INLINED parse.js =====
// Family Album — shared-album page parser (pure, dependency-free ESM).
//
// A public Google Photos shared album page embeds its photo list inline in
// the HTML inside AF_initDataCallback({...}) script blocks — no JS rendering
// is needed to read it. This module extracts and walks that structure.
//
// The extraction algorithm is a port of the approach proven by
// yumetodo/google-photos-album-image-url-fetch, a library that has run a
// daily automated validity check against a live shared album for years —
// i.e. this exact page format has been stable long-term. If Google ever
// reshuffles the album page markup, THIS FILE (plus the JSON5 step in
// index.ts) is the entire breakage surface — nothing in Studio knows or
// cares where the photo list came from.
//
// Kept as plain .js (not .ts) deliberately so the same file runs unmodified
// in BOTH the Deno Edge Function (index.ts imports it) and a Node unit test
// (this sandbox cannot reach any Google host, so the parser is verified
// against a realistic fixture in Node; the live page is verified by the
// project owner via tools/family-album-test/).

/**
 * Phase 1: pull the raw JS-object-literal text out of the largest
 * AF_initDataCallback({...}) block that mentions `data`.
 * Returns null when no candidate block exists.
 *
 * The regex is kept verbatim from the reference library — it is the part
 * with years of daily-CI proof behind it.
 */
function extractInitData(html) {
  if (typeof html !== 'string' || !html) return null;
  const re = /(?<=AF_initDataCallback\()(?=.*data)(\{[\s\S]*?)(\);<\/script>)/g;
  let best = '';
  for (const m of html.matchAll(re)) {
    if (m[1].length > best.length) best = m[1];
  }
  return best || null;
}

/**
 * Phase 3: walk the loose-parsed object into a clean photo list.
 * (Phase 2 — loose-JSON parsing of the object literal — happens in the
 * caller, since it needs a JSON5 parser and this module stays dependency-free.)
 *
 * Shape of each media entry inside parsed.data[1]:
 *   e[0]              stable media uid (string)
 *   e[1]              [baseUrl, width, height]
 *   e[2]              image update date (ms epoch)
 *   e[5]              album add date (ms epoch)
 *
 * The returned `url` is an lh3.googleusercontent.com BASE url — append a
 * sizing suffix before use: '=w300-h300' (thumbnail), '=w2048-h2048' (full
 * pick). Google's CDN does the resizing.
 *
 * Returns null when the structure doesn't match (a signal the page format
 * changed); malformed individual entries are skipped, never fatal.
 */
function parseAlbumData(parsed) {
  if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) return null;
  const d = parsed.data;
  if (!Array.isArray(d) || d.length < 2) return null;
  const arr = d[1];
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const e of arr) {
    if (!Array.isArray(e) || e.length < 6) continue;
    const uid = e[0];
    const detail = e[1];
    const imageUpdateDate = e[2];
    const albumAddDate = e[5];
    if (typeof uid !== 'string' || !Array.isArray(detail) || detail.length < 3) continue;
    const url = detail[0];
    const width = detail[1];
    const height = detail[2];
    if (typeof url !== 'string' || typeof width !== 'number' || typeof height !== 'number') continue;
    if (typeof imageUpdateDate !== 'number' || typeof albumAddDate !== 'number') continue;
    out.push({ uid, url, width, height, imageUpdateDate, albumAddDate });
  }
  return out;
}
// ===== END INLINED parse.js =====

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// A real browser UA — Google serves the plain inline-data page shape this
// parser expects to ordinary browsers.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const ALBUM_HOSTS = ['photos.app.goo.gl', 'photos.google.com'];

function isAllowedAlbumUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALBUM_HOSTS.includes(u.hostname);
  } catch (_e) {
    return false;
  }
}

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'googleusercontent.com' || u.hostname.endsWith('.googleusercontent.com'))
    );
  } catch (_e) {
    return false;
  }
}

// Sprint 1A, CLAUDE.md -> Decision 30. The deploy note above says this
// function "authenticate[s] with the project's anon key ... which
// satisfies the default verify_jwt gate" — which was an accurate
// description of a gate that let anybody through, since that key is
// public. This is an outbound fetcher and an image proxy on our own
// name, so it now asks who is calling and bounds how often.
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
    res = await doFetch(url + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: anonKey },
    });
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const pass = await guard(req, {
    env: { supabaseUrl: SUPA_URL, anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '', serviceKey: SERVICE },
    require: 'user',
    bucket: 'family-album',
    db: restDb(SUPA_URL, SERVICE),
    envGet: (n: string) => Deno.env.get(n) || '',
  });
  if (!pass.ok) return json(pass.body, pass.status);

  try {
    const u = new URL(req.url);

    // ---- mode 2: image byte proxy (CORS fallback only) ----
    const img = u.searchParams.get('img');
    if (img) {
      if (!isAllowedImageUrl(img)) return json({ ok: false, error: 'bad_image_host' }, 400);
      const upstream = await fetch(img, { headers: { 'User-Agent': UA } });
      if (!upstream.ok || !upstream.body) {
        return json({ ok: false, error: 'image_fetch_failed', status: upstream.status });
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // ---- mode 1: album listing ----
    let albumUrl = u.searchParams.get('url') || '';
    if (!albumUrl && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      albumUrl = (body && typeof body.albumUrl === 'string' && body.albumUrl) || '';
    }
    if (!isAllowedAlbumUrl(albumUrl)) return json({ ok: false, error: 'bad_album_url' }, 400);

    const res = await fetch(albumUrl, { redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!res.ok) return json({ ok: false, error: 'album_fetch_failed', status: res.status });
    const html = await res.text();

    const raw = extractInitData(html);
    if (!raw) return json({ ok: false, error: 'parse_failed_phase1' });

    let parsed: unknown;
    try {
      parsed = JSON5.parse(raw);
    } catch (_e) {
      return json({ ok: false, error: 'parse_failed_phase2' });
    }

    const photos = parseAlbumData(parsed);
    if (photos === null) return json({ ok: false, error: 'parse_failed_phase3' });

    return json({ ok: true, count: photos.length, photos });
  } catch (e) {
    return json({ ok: false, error: 'unexpected: ' + ((e as Error)?.message || String(e)) });
  }
});
