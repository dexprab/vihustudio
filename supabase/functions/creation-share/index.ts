// Creation Share Edge Function — "Look what I made."
//
// A child presses SEND. Everything an adult needs — the address, the
// secure link, the letter, the delivery — happens here, because none
// of it belongs in a child's interface (the sprint's own rule: no
// email, no URLs, no PDF, no QR anywhere a child can see).
//
// Two actions and one public image:
//
//   POST { action:'mint', projectId, payload, identityId? }
//     Sweep the payload by SHAPE (whitelist — an unknown key at any
//     depth is refused, never trimmed), then mint the creation's one
//     stable token via creation_share_mint. Returns { token, url,
//     watchUrl }. This is what the Story Card's QR and the hub use.
//
//   POST { action:'send', projectId, payload, identityId?, email? }
//     Mint, then post the letter. The address is the card's own
//     parent_email wherever one is on file — an address already on
//     file is never asked for again (Decision 14) — and only when
//     the card has none does the child's "Who should I send it to?"
//     answer arrive in `email`. A first-given address is kept on the
//     card (only where none exists, never overwriting), because the
//     safe place a Magic Card is kept and the address a creation
//     goes to are the same grown-up.
//
//   GET ?cover=<token>
//     The creation's first page, as an image, for the letter itself.
//     Gmail strips data: images, so the letter references this
//     instead. TOKEN-authenticated, exactly like look.html: holding
//     the token IS the invitation, so this path deliberately runs
//     before the session gate. It reveals precisely what the landing
//     page already shows.
//
//   GET (bare)
//     Deployment probe. Booleans and a build string, nothing else.
//
// THE SWEEP IS A CONSTRUCTION, NEVER A CLEANUP. What reaches
// creation_shares is built key by key from the contract; a payload
// carrying anything else — a memory, a card id, a constellation, a
// conversation, a field invented next year — is refused whole with
// the key's NAME (structure, never content). A well-shaped lie about
// the child's own creation is the child sharing their own bytes; a
// private field can simply never arrive by being adjacent to one
// that is allowed (Decision 33's reasoning, applied to the share).
//
// The privacy contract with the resolve side: what this function
// stores is the ONLY thing creation_share_resolve can ever return.
// No owner, no card, no project id, no session, no address.
//
// Deploy note: the ?cover= route is fetched by <img> tags in mail
// clients, which cannot send headers — deploy with verify_jwt OFF
// (supabase functions deploy creation-share --no-verify-jwt). The
// session gate inside this file is what protects the POST actions,
// exactly as every other function here already works.
//
// Failure convention: expected failures answer 200 { ok:false,
// reason } (the voice-speak convention); authorization refusals keep
// their real statuses (401/403/429) because no child-facing path can
// produce one.

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

const BUILD = 'LW2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------
// The share payload contract. One place, written out by hand.
// ---------------------------------------------------------------
const SHARE_TYPES = ['moment', 'sequence', 'story'];
const SHARE_LIMITS = {
  title: 120,
  creator: 60,
  pages: 24,
  watch: 40,
  // Characters of data-URI, not bytes — a 1024px reading-size JPEG
  // runs 100–300 KB of base64; a 640px watch frame far less. The
  // caps are ceilings against abuse, not targets.
  pageImage: 900000,
  watchImage: 400000,
  total: 8 * 1024 * 1024,
  holdMin: 100,
  holdMax: 8000,
};
const IMAGE_RE = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const ETHER_RE = /^[A-Za-z0-9_-]{1,64}$/;

function refuse(key) {
  return { ok: false, reason: 'not-shareable', key: key || null };
}

function sweepPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return refuse('payload');

  const allowed = ['v', 'type', 'title', 'creatorName', 'pages', 'watch', 'madeIn', 'ether'];
  for (const k of Object.keys(p)) {
    if (allowed.indexOf(k) === -1) return refuse(k);
  }

  if (p.v !== 1) return refuse('v');
  if (SHARE_TYPES.indexOf(p.type) === -1) return refuse('type');
  if (typeof p.title !== 'string' || p.title.length > SHARE_LIMITS.title) return refuse('title');
  if (typeof p.creatorName !== 'string' || p.creatorName.length > SHARE_LIMITS.creator) return refuse('creatorName');
  if (p.madeIn !== 'vihuplanet') return refuse('madeIn');

  if (!Array.isArray(p.pages) || p.pages.length < 1 || p.pages.length > SHARE_LIMITS.pages) return refuse('pages');
  const pages = [];
  for (const entry of p.pages) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return refuse('pages');
    for (const k of Object.keys(entry)) {
      if (k !== 'image') return refuse(k);
    }
    if (typeof entry.image !== 'string' || entry.image.length > SHARE_LIMITS.pageImage) return refuse('image');
    if (!IMAGE_RE.test(entry.image)) return refuse('image');
    pages.push({ image: entry.image });
  }

  const watch = [];
  if (p.watch != null) {
    if (!Array.isArray(p.watch) || p.watch.length > SHARE_LIMITS.watch) return refuse('watch');
    for (const entry of p.watch) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return refuse('watch');
      for (const k of Object.keys(entry)) {
        if (k !== 'image' && k !== 'holdMs') return refuse(k);
      }
      if (typeof entry.image !== 'string' || entry.image.length > SHARE_LIMITS.watchImage) return refuse('image');
      if (!IMAGE_RE.test(entry.image)) return refuse('image');
      let hold = Number(entry.holdMs);
      if (!isFinite(hold)) hold = 900;
      hold = Math.max(SHARE_LIMITS.holdMin, Math.min(SHARE_LIMITS.holdMax, Math.round(hold)));
      watch.push({ image: entry.image, holdMs: hold });
    }
  }

  const clean = {
    v: 1,
    type: p.type,
    title: p.title.trim(),
    creatorName: p.creatorName.trim(),
    pages: pages,
    watch: watch,
    madeIn: 'vihuplanet',
  };
  // Public-only by construction: the Ether deep link is the project
  // id Decision 9 already made public FOR SHARED STORIES; for an
  // unshared one a forged value resolves to nothing, because the
  // Ether only opens records the shared feed actually carries.
  if (p.ether != null) {
    if (typeof p.ether !== 'string' || !ETHER_RE.test(p.ether)) return refuse('ether');
    clean.ether = p.ether;
  }

  if (JSON.stringify(clean).length > SHARE_LIMITS.total) return refuse('total');
  return { ok: true, clean: clean };
}

// ---------------------------------------------------------------
// Small REST write helper. edgeAuth's restDb is deliberately
// read-only; the ONE write this function makes (keeping a first
// parent address on an authorized card, and only where none exists)
// gets the smallest thing that can make it, not a client library.
// ---------------------------------------------------------------
async function restPatch(url, serviceKey, table, filters, patch, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const base = String(url || '').replace(/\/+$/, '');
  if (!base || !serviceKey) return { ok: false };
  try {
    const res = await doFetch(base + '/rest/v1/' + encodeURIComponent(table) + '?' + filters, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false };
  }
}

// ---------------------------------------------------------------
// The letter. Both halves say the same things in the same order
// (Decision 42: the plain part is not a fallback, it is the
// message), and the markup stays modest — one image, text links,
// no masthead, no pill grid — because the campaign-shaped letter
// is the one Gmail files under Promotions.
// ---------------------------------------------------------------
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function letterFor(name, title, links) {
  const who = name || 'Someone you love';
  const made = title ? ('created “' + title + '”') : 'made something new';
  const subject = name ? (name + ' made something!') : 'Look what I made!';

  const text = [
    who + ' ' + made + ' in VihuPlanet.',
    '',
    'Watch how it was made:',
    links.watchUrl,
    '',
    'See the creation:',
    links.url,
    '',
    'Print it and keep it:',
    'A foldable little book: ' + links.foldable,
    'A little card to give away: ' + links.card,
    '',
    'Want to share it?',
    'WhatsApp: ' + links.whatsapp,
    'Instagram: ' + links.instagram,
    '',
    'This letter only opens a window onto the creation — it stays',
    'exactly where it was made. VihuPlanet is where children make,',
    'keep and share their own stories.',
  ].join('\n');

  const html = [
    '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#232323;">',
    '<p style="font-size:20px;margin:24px 0 6px;">' + esc(who) + ' ' + esc(made) + ' in VihuPlanet.</p>',
    '<p style="margin:18px 0;"><img src="' + esc(links.coverUrl) + '" alt="' + esc(title || 'The creation') + '" style="max-width:100%;border-radius:10px;" /></p>',
    '<p style="margin:14px 0;"><a href="' + esc(links.watchUrl) + '">▶ Watch how it was made</a></p>',
    '<p style="margin:14px 0;"><a href="' + esc(links.url) + '">See the creation</a></p>',
    '<p style="margin:22px 0 6px;">Print it and keep it:</p>',
    '<p style="margin:6px 0;"><a href="' + esc(links.foldable) + '">📄 A foldable little book</a> · <a href="' + esc(links.card) + '">🃏 A little card to give away</a></p>',
    '<p style="margin:22px 0 6px;">Want to share it?</p>',
    '<p style="margin:6px 0;"><a href="' + esc(links.whatsapp) + '">WhatsApp</a> · <a href="' + esc(links.instagram) + '">Instagram</a></p>',
    '<p style="margin:26px 0 24px;color:#6b6b6b;font-size:13px;">This letter only opens a window onto the creation — it stays exactly where it was made. VihuPlanet is where children make, keep and share their own stories.</p>',
    '</div>',
  ].join('\n');

  return { subject: subject, text: text, html: html };
}

// A secret typed into a dashboard field picks up quotes and
// whitespace nobody meant to send (sky-protection's own lesson).
function cleanSecret(v) {
  let s = String(v || '').trim();
  if (s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

async function sendViaResend(env, fetchImpl, to, subject, text, html) {
  const key = cleanSecret(env('RESEND_API_KEY'));
  const from = cleanSecret(env('SKY_FROM_EMAIL'));
  const replyTo = cleanSecret(env('SKY_REPLY_TO'));
  if (!key || !from) return { ok: false, reason: 'mail_not_configured' };
  const doFetch = fetchImpl || fetch;
  const payload = { from: from, to: [to], subject: subject, text: text, html: html };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const res = await doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, reason: 'mail_send_failed' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'mail_send_failed' };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function linksFor(env, token) {
  const base = (cleanSecret(env('SKY_BASE_URL')) || 'https://vihuplanet.com').replace(/\/+$/, '');
  const url = base + '/look.html?t=' + encodeURIComponent(token);
  const watchUrl = url + '&watch=1';
  const supa = String(env('SUPABASE_URL') || '').replace(/\/+$/, '');
  return {
    url: url,
    watchUrl: watchUrl,
    coverUrl: supa + '/functions/v1/creation-share?cover=' + encodeURIComponent(token),
    // wa.me is WhatsApp's own share URL and needs nothing but text.
    whatsapp: 'https://wa.me/?text=' + encodeURIComponent('Look what was made in VihuPlanet! ' + url),
    // Instagram publishes no web prefill; the honest route is the
    // landing page's native share sheet, which includes Instagram on
    // a phone. Recorded as a disclosed limit in the decision entry.
    instagram: url + '&share=1',
    // 1.1.5 — the letter's print doors. The landing composes the
    // foldable and the Story Card from the SAME snapshot (the same
    // composers the Studio hub uses), so a parent can print without
    // the child's device. The switches open the preview directly.
    foldable: url + '&print=foldable',
    card: url + '&print=card',
  };
}

function makeHandler(deps) {
  const env = deps.env;

  return async function handler(req) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

    const url = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const db = restDb(url, serviceKey, deps.fetchImpl);

    // THE COVER, BEFORE THE GATE. An <img> in a mail client cannot
    // send a header, and the token is the capability — this shows
    // exactly what the landing page the same token opens already
    // shows, and nothing else.
    if (req.method === 'GET') {
      let coverToken = '';
      try { coverToken = new URL(req.url).searchParams.get('cover') || ''; } catch (e) { /* fall through */ }
      if (coverToken) {
        if (!db) return json({ ok: false, reason: 'not_configured' });
        const res = await db.rpc('creation_share_resolve', { p_token: coverToken });
        const answer = res && res.data;
        const creation = answer && answer.ok && answer.creation;
        const image = creation && creation.pages && creation.pages[0] && creation.pages[0].image;
        if (!image) return json({ ok: false, reason: 'unknown' }, 404);
        const comma = image.indexOf(',');
        const meta = image.slice(5, image.indexOf(';'));
        const bytes = Uint8Array.from(atob(image.slice(comma + 1)), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': meta || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }

    // IDENTITY FIRST for everything else. Only a POST is counted
    // against the allowance; the bare GET is a deployment probe.
    const pass = await guard(req, {
      env: { supabaseUrl: url, anonKey: env('SUPABASE_ANON_KEY'), serviceKey: serviceKey },
      require: 'user',
      bucket: req.method === 'POST' ? 'creation-share' : '',
      db: db,
      envGet: (n) => env(n),
      fetchImpl: deps.fetchImpl,
    });
    if (!pass.ok) return json(pass.body, pass.status);

    if (req.method === 'GET') {
      // Booleans and a build string. Never a secret, never a token.
      const probe = db ? await db.from('creation_shares').select('token').limit(1) : { error: { message: 'no db' } };
      return json({
        ok: true,
        build: BUILD,
        creationShares: !(probe && probe.error),
        mail: !!cleanSecret(env('RESEND_API_KEY')) && !!cleanSecret(env('SKY_FROM_EMAIL')),
        base: (cleanSecret(env('SKY_BASE_URL')) || 'https://vihuplanet.com').replace(/\/+$/, ''),
      });
    }

    if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);
    if (!db) return json({ ok: false, reason: 'not_configured' });

    let body;
    try { body = await req.json(); } catch (e) { return json({ ok: false, reason: 'bad_request' }, 400); }
    const action = String(body.action || 'mint');
    if (action !== 'mint' && action !== 'send') return json({ ok: false, reason: 'bad_request' }, 400);

    const projectId = String(body.projectId || '').trim();
    if (!ETHER_RE.test(projectId)) return json({ ok: false, reason: 'bad_request' }, 400);

    // A cardId from the client is a SELECTOR, never an assertion —
    // naming somebody else's is a 403 (the sky-protection rule).
    let identity = null;
    const identityId = String(body.identityId || '').trim();
    if (identityId) {
      const access = await authorizeCardAccess(db, identityId, pass.caller, 'id, nickname, parent_email');
      if (!access.ok) {
        const r = refusal(access.reason);
        return json(r.body, r.status);
      }
      identity = access.identity;
    }

    const swept = sweepPayload(body.payload);
    if (!swept.ok) return json(swept);

    const minted = await db.rpc('creation_share_mint', {
      p_owner_id: pass.caller.userId,
      p_identity_id: identityId || null,
      p_project_id: projectId,
      p_payload: swept.clean,
    });
    const token = minted && typeof minted.data === 'string' ? minted.data : null;
    if (!token) return json({ ok: false, reason: 'not_configured' });

    const links = linksFor(env, token);

    if (action === 'mint') {
      return json({ ok: true, token: token, url: links.url, watchUrl: links.watchUrl });
    }

    // ---- send ----
    // The DESTINATION and the SAVED ADDRESS are two different
    // things (Sprint 1.1 §6). A provided email is the child's
    // one-time "Send this to…" choice and wins for THIS delivery;
    // with none provided, the card's own parent_email is the
    // default. Nothing about an override is ever stored — the
    // is.null guard below keeps the saved address a fill-once
    // fact, so the next share still defaults to it.
    const onFile = identity && cleanSecret(identity.parent_email) && EMAIL_RE.test(cleanSecret(identity.parent_email))
      ? cleanSecret(identity.parent_email) : '';
    const given = cleanSecret(body.email);
    const to = (EMAIL_RE.test(given) ? given : '') || onFile;
    if (!to) {
      // Not an error — the answer to "who should I send it to?" has
      // not been given yet, and the hub asks it in the child's words.
      return json({ ok: false, reason: 'no-recipient', token: token, url: links.url, watchUrl: links.watchUrl });
    }

    // A first-given address is kept on the card — only where none
    // exists (parent_email=is.null keeps this a fill, never an
    // overwrite), and only on a card this caller just proved they
    // hold. The safe place the card is kept and the address the
    // creation goes to are the same grown-up (Decision 14, amended
    // by this sprint's decision entry).
    //
    // `once` marks a one-time "Send this to…" choice (Sprint 1.1):
    // an override is a destination, never an address to keep, even
    // when the card happens to have none on file yet.
    if (!onFile && identity && identity.id && body.once !== true) {
      await restPatch(url, serviceKey, 'magic_card_identities',
        'id=eq.' + encodeURIComponent(identity.id) + '&parent_email=is.null',
        { parent_email: to }, deps.fetchImpl);
    }

    const name = swept.clean.creatorName || (identity && identity.nickname) || '';
    const letter = letterFor(name, swept.clean.title, links);
    const sent = await sendViaResend(env, deps.fetchImpl, to, letter.subject, letter.text, letter.html);
    if (!sent.ok) return json({ ok: false, reason: sent.reason, token: token, url: links.url, watchUrl: links.watchUrl });

    return json({
      ok: true,
      sent: true,
      token: token,
      url: links.url,
      watchUrl: links.watchUrl,
      // Whether the address was already on file — the hub words the
      // confirmation with it. NEVER the address itself.
      parentKnown: !!onFile,
    });
  };
}

// Deno serves it; a test imports it. Guarded rather than
// unconditional, which is what lets the suite drive the deployed
// artifact with real Request objects (the companion-chat idiom).
const handler = makeHandler({ env: (n) => (typeof Deno !== 'undefined' ? (Deno.env.get(n) || '') : '') });
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(handler);

export {
  makeHandler, handler, sweepPayload, letterFor, linksFor, BUILD, SHARE_LIMITS,
};
