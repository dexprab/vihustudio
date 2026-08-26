// creator-born — Lumo writes when a new Creator is born.
//
// "as soon as a new creator is born i would like to get email from lumo
// at prabhakarsharma83@gmail.com" — the product owner.
//
// Called by the `creator_born` trigger on magic_card_identities (see
// supabase/migrations_admin_console.sql). A row arriving in that table
// IS a child becoming a Creator: CLAUDE.md -> Decision 11, "A Creator is
// someone holding a claimed Magic Card."
//
// Sending mirrors supabase/functions/sky-protection exactly — the same
// two transports, the same environment variables, the same "an
// unconfigured deployment is a handled state" discipline. Nothing new
// was invented for delivery.
//
// WHAT IT DOES NOT SEND. No parent email, no constellation pattern, no
// story content, no card id beyond the short human code. This is a note
// saying somebody arrived, to one fixed address; the roll behind the
// admin login is where the detail lives, and that is deliberate — an
// inbox is not an access-controlled surface.
//
// Deploy:
//   supabase functions deploy creator-born
//
// LEAVE JWT VERIFICATION ON — do NOT pass --no-verify-jwt. This function
// sends mail, so an unauthenticated one is a way for anybody who learns
// the URL to fill an inbox. The trigger that calls it sends the service
// role key (supabase/migrations_admin_console.sql), so it is unaffected.
// The cost is only that a browser tab cannot test it: a plain GET
// returns UNAUTHORIZED_NO_AUTH_HEADER from Supabase's gateway before
// reaching this code, which is the gateway working rather than a fault.
// Test with the anon key, which is public by design:
//   curl -i <url> -H "Authorization: Bearer <anon key>"
// Environment (already set for sky-protection):
//   RESEND_API_KEY + SKY_FROM_EMAIL, or SMTP_HOST/SMTP_USER/SMTP_PASS
// Optional:
//   CREATOR_BORN_TO   the address to write to; defaults below.

const BUILD = '2026-08-18 · creator born, in Lumo’s voice';
const DEFAULT_TO = 'prabhakarsharma83@gmail.com';

function env(name: string): string {
  return (Deno.env.get(name) || '').trim();
}

function esc(s: string): string {
  return String(s || '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Lumo's own voice — the Guardian who greets a child at both thresholds
// (docs/COMPANION_CANON.md). Warm, short, never a dashboard summary; this
// is a note from somebody who was there, not an analytics alert.
function compose(p: Record<string, string>) {
  const who = p.nickname && p.nickname.trim() ? p.nickname.trim() : 'Someone new';
  const companion = (p.companion || '').trim();
  const species = (p.species || '').trim();

  const subject = `${who} became a Creator ✨`;

  const lines = [
    `${who} just claimed their Magic Card.`,
    '',
    companion
      ? `${companion}${species ? ` the ${species}` : ''} woke up beside them, and the two of them are bonded now — that part only happens once.`
      : `Their Companion has not woken yet.`,
    '',
    `Card ${p.code || '—'}`,
    p.claimedAt ? `${new Date(p.claimedAt).toUTCString()}` : '',
    '',
    `There is one more sky in VihuPlanet than there was this morning.`,
    '',
    '— Lumo',
  ].filter((l) => l !== undefined);

  const text = lines.join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#0d1220;padding:28px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;margin:0 auto;background:#151c2e;border-radius:14px;">
<tr><td style="padding:26px 26px 8px;font:600 19px/1.3 Georgia,serif;color:#e7eaf3;">
${esc(who)} became a Creator ✨
</td></tr>
<tr><td style="padding:0 26px 6px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#a6adbf;">
${esc(who)} just claimed their Magic Card.
</td></tr>
<tr><td style="padding:0 26px 6px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#a6adbf;">
${companion
      ? `${esc(companion)}${species ? ` the ${esc(species)}` : ''} woke up beside them, and the two of them are bonded now — that part only happens once.`
      : `Their Companion has not woken yet.`}
</td></tr>
<tr><td style="padding:14px 26px 0;font:400 13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#6e7893;">
Card ${esc(p.code || '—')}${p.claimedAt ? `<br>${esc(new Date(p.claimedAt).toUTCString())}` : ''}
</td></tr>
<tr><td style="padding:18px 26px 26px;font:400 15px/1.6 Georgia,serif;color:#dfb169;">
There is one more sky in VihuPlanet than there was this morning.<br>— Lumo
</td></tr>
</table></body></html>`;

  return { subject, text, html };
}

async function sendViaResend(to: string, subject: string, text: string, html: string) {
  const key = env('RESEND_API_KEY');
  const from = env('SKY_FROM_EMAIL') || 'Lumo <onboarding@resend.dev>';
  if (!key) return { ok: false, error: 'no RESEND_API_KEY' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// ---------------------------------------------------------------
// A SERVER-TO-SERVER CALLER, AND ONLY THAT (Sprint 1A, Decision 30)
//
// Nothing in a browser calls this. Its only caller is Postgres itself:
// notify_creator_born() in supabase/migrations_admin_console.sql fires
// it through pg_net with the SERVICE ROLE key it keeps in
// platform_settings. The header above already says "an unauthenticated
// one is a way for anybody who learns the URL" to send mail — and left
// it at verify_jwt, which the public anon key satisfies.
//
// So this is the strictest of the three caller classes: a real session
// is not enough, because no session should ever be here. The shared
// module compares the presented token against the service key in
// constant time and refuses everything else, including a perfectly
// valid child's session.
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

async function serviceOnly(req: Request) {
  return await guard(req, {
    env: {
      supabaseUrl: env('SUPABASE_URL'),
      anonKey: env('SUPABASE_ANON_KEY'),
      serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    },
    require: 'service',
  });
}

Deno.serve(async (req) => {
  const pass = await serviceOnly(req);
  if (!pass.ok) {
    return new Response(JSON.stringify(pass.body), {
      status: pass.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET') {
    // Same ping shape sky-protection uses, and for the same reason: a
    // deployment that is running the OLD copy is otherwise invisible,
    // which cost a real afternoon once.
    return new Response(
      JSON.stringify({
        ok: true,
        build: BUILD,
        to: env('CREATOR_BORN_TO') || DEFAULT_TO,
        transport: env('RESEND_API_KEY') ? 'resend' : (env('SMTP_HOST') ? 'smtp' : 'none'),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch (_e) { /* an empty note is still a note */ }

  const to = env('CREATOR_BORN_TO') || DEFAULT_TO;
  const { subject, text, html } = compose(body);

  let sent: { ok: boolean; error?: string } = { ok: false, error: 'no transport configured' };
  if (env('RESEND_API_KEY')) sent = await sendViaResend(to, subject, text, html);

  // Always 200. The caller is a database trigger on a child's Creator
  // Ceremony, and nothing about that moment may depend on a mail server
  // — the trigger swallows failures too, so this is belt and braces on
  // purpose.
  return new Response(JSON.stringify({ ok: true, delivered: sent.ok, detail: sent.error || null }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
