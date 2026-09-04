// Sky Protection Edge Function — the safe place a Magic Card is kept.
//
// A child recognises themselves by their Magic Card. A parent protects
// it. That is the whole of this feature, and the shape of it matters:
//
//   The parent email is NOT the child's account.
//   It is not a login, not a password, not an identity and not a
//   profile. Nothing anywhere signs in with it. It is an address a
//   Magic Card is posted to, so that a child who loses their card,
//   forgets their constellation or picks up a different device can
//   always be recognised again.
//
// Two actions, and neither of them is authentication:
//
//   1. protect  { identityId, email }
//      Send this Creator's Magic Card to that address. The client has
//      already written the address onto its own identity row (owner-
//      only RLS); this function reads the card and posts it.
//
//   2. recover  { email }
//      Send EVERY Magic Card protected by that address. This is the
//      new-device case, where the browser knows nothing at all — the
//      only thing a child can offer is "my parent's address", and the
//      only thing that comes back is an email to that address. Nothing
//      is ever revealed to the browser, so controlling the inbox is
//      the whole of the check, which is exactly right for something
//      that is not an account.
//
// ONE PARENT EMAIL MAY PROTECT SEVERAL CHILDREN, so every message
// names its Creator and a recovery email lists each sky separately.
// Siblings sharing one address is the normal case, not an edge case.
//
// Deploy (from the repo root):
//   supabase secrets set \
//     RESEND_API_KEY=re_... \
//     SKY_FROM_EMAIL="Lumo from VihuPlanet <lumo@vihuplanet.com>" \
//     SKY_REPLY_TO=someone@real.example
//   supabase functions deploy sky-protection --project-ref <your-project-ref>
//
// SEND OVER HTTP, NOT THROUGH A MAILBOX. This started the other way
// round — sending through the domain's own mailbox needs no DNS work,
// which is genuinely attractive — and it cost two days to find out why
// that is the wrong shape:
//
//   A mailbox's SMTP is a HUMAN LOGIN CHANNEL. It is gated by the
//   things human logins are gated by, and none of them are visible to
//   the thing trying to send. The first mailbox tried here refused
//   every SMTP authentication with 535 while accepting the identical
//   password in webmail — from three independent clients, two auth
//   mechanisms, two ports and three networks. Nothing was
//   misconfigured; the provider simply does not let that mailbox send.
//   A provider can decide that silently, at any time, for a mailbox
//   that worked yesterday.
//
// The failure modes that remain even when it does work are worse than
// the one that is easy to see: a mailbox cannot tell you whether the
// mail arrived or went to spam, and an SMTP login from an edge
// runtime's shifting egress IPs is exactly what a large provider
// challenges — which fails INTERMITTENTLY, so it passes testing and
// breaks a week later, and a Magic Card that silently does not arrive
// is a lost sky. Losing skies is the one thing this feature exists to
// prevent.
//
// SMTP is kept, and still wins when SMTP_HOST is set, because it is a
// real escape hatch and it is twenty lines. It is not the recommended
// path.
//
// A from address on a domain with no mailbox behind it is a send-only
// address, so SKY_REPLY_TO must point somewhere a person reads. A
// parent replying to ask a question about their child's sky should
// reach a human, not a bounce.
//
// Failure convention mirrors the family-album function and
// js/themeRepositoryClient.js: expected failures come back as
// 200 { ok:false, error:'<reason>' } so the client always gets a
// readable, non-throwing answer. An unconfigured deployment (no mail
// key) is an expected failure, not a crash — the product degrades to
// "we could not post it right now", never to a broken share.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Sprint 1A, CLAUDE.md -> Decision 30. See the AUTHORIZATION note at
// the head of the request handler below for what this closes and why it
// was the most serious of the three findings. (Deliberately NOT naming
// the serve call here: tools/family-photos-test cuts this file at the
// first occurrence of that literal in order to load the letter
// composers, so a comment mentioning it truncates the file and takes
// the whole letter section down. Learned the hard way.)
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

const CONSTELLATION_NAMES: Record<string, string> = {
  ORION: 'Orion',
  CASSIOPEIA: 'Cassiopeia',
  URSA_MAJOR: 'Ursa Major',
  CYGNUS: 'Cygnus',
  LYRA: 'Lyra',
};

type Identity = {
  id: string;
  serial_no: number;
  nickname: string;
  constellation: string;
  pattern: number[][];
  claimed_at: string;
};

// Which of the two moments this is. They are genuinely different
// messages — one arrives the day a parent chooses to keep a sky safe,
// the other on the day a card has been lost — so only the opening
// changes; everything a parent needs is in both, because the second
// one may be the only copy left.
type Kind = 'protect' | 'recover';

// WHICH BUILD IS ACTUALLY RUNNING.
//
// An Edge Function runs the copy uploaded to the project, not the file
// in the repository, and there is no CI here that deploys it — so the
// two drift silently and the only symptom is an email that looks
// unchanged. Working that out from the wording of a message is slow and
// ambiguous; `{"action":"ping"}` now answers it outright.
//
// Bump this whenever the mail itself changes.
const BUILD = '2026-08-23 · family album passage';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// A pattern is a set of [row, col] pairs on a 10x10 sky. Drawn as text
// so the email is readable in any client, including one that blocks
// images — a recovery mail that needs pictures to work is not a
// recovery mail.
function skyDiagram(pattern: number[][]): string {
  const size = 10;
  const lit = new Set((pattern || []).map((p) => `${p[0]},${p[1]}`));
  // Numbered down the side and along the top, the same as the drawn
  // version — the stars are listed as "row 2, column 3" and counting
  // squares to check one against the other is the parent's job
  // otherwise.
  //
  // THREE characters per cell, not two. At two the tenth column's two
  // digits sit directly against the ninth and the heading reads "910".
  // Thirty-three columns of monospace still fits any mail client.
  const w3 = (s: string | number) => String(s).padStart(3);
  const rows: string[] = [];
  let head = '   ';
  for (let c = 0; c < size; c++) head += w3(c + 1);
  rows.push(head);
  for (let r = 0; r < size; r++) {
    let line = String(r + 1).padStart(2) + ' ';
    for (let c = 0; c < size; c++) line += w3(lit.has(`${r},${c}`) ? '★' : '·');
    rows.push(line);
  }
  return rows.join('\n');
}

function orderedTaps(pattern: number[][]): string {
  return (pattern || [])
    .map((p, i) => `${i + 1}. row ${p[0] + 1}, column ${p[1] + 1}`)
    .join('\n');
}

// Deliberately plain. This is a message a parent files away and finds
// again in a year, so it is text an inbox search can hit, not a
// marketing template.
// The one code a parent can actually type back in.
//
// The table has TWO identifiers and only one of them works here. The
// `code` column is "MC-00042", and `recall_magic_card()`'s typed branch
// does not look at it — it matches
// upper(constellation || lpad(serial_no,5,'0')), i.e. "CYGNUS00042".
// js/magicCard.js's _captureRecallCode() builds exactly this string for
// the printed card, and its comment says why: never print something
// that would fail if typed back in. A recovery email is the last place
// that rule may be broken, since the parent reading it has nothing else
// left to try.
function recallCode(identity: Identity): string {
  const serial = String(identity.serial_no == null ? '' : identity.serial_no);
  if (!serial) return '';
  return (identity.constellation || '').toUpperCase() + serial.padStart(5, '0');
}

// ---------------------------------------------------------------
// THE FAMILY ALBUM ASK — the one thing this letter carries besides the
// card itself, and the reason it rides here rather than in a message of
// its own.
//
// A parent is reachable at exactly one moment. Beyond convenience that
// keeps a line uncrossed: the parent email is STORAGE, not a channel,
// and a second kind of message to it turns it into a mailing list —
// with frequency, and unsubscribe, and everything that follows. One
// letter keeps the line where it is. Asked for by the product owner in
// those terms: "add it in first email."
//
// THE PASSAGE SITS INSIDE THE CARD, not at the foot of the letter. One
// address may protect several children, so a letter can carry two cards
// — and "here is a link for photos" under both of them would be a
// question about which child. Inside the card it is unambiguously
// Vihaan's link, next to Vihaan's stars.
//
// IT IS AN OFFER AND IT SAYS SO. Everything else in the product works
// without it, the letter says exactly that, and nothing anywhere nags a
// parent who ignores it.
//
// THE TWO FACTS THAT MUST NOT BE BURIED. A shared Google Photos album
// is shared BY LINK: anybody holding the link can see those photos.
// And nothing is uploaded — VihuPlanet keeps the link and the pictures
// stay in the parent's own Google account. Both are in the first three
// lines of the passage, in the plain text as much as in the HTML,
// because plenty of people read mail with images off and the plain part
// is not a fallback here, it is the message.
const ALBUM_BASE = () =>
  (secret('SKY_BASE_URL') || 'https://vihuplanet.com').replace(/\/+$/, '');

function albumPageUrl(token: string): string {
  return `${ALBUM_BASE()}/family-photos.html?k=${encodeURIComponent(token)}`;
}

// A MISSING LINK IS A HANDLED STATE, and it is the important one: if
// this deployment has not had migrations_family_album_link.sql run
// against it, the mint call fails, the token is empty, and the letter
// goes out as the letter it has always been. The child still gets their
// card. Nothing anywhere claims an album can be added when it cannot.
function albumText(identity: Identity, token: string): string {
  if (!token) return '';
  const name = identity.nickname || 'them';
  return [
    ``,
    `Family photos for ${name}`,
    ``,
    `If you would like ${name}'s own photographs to be there when they`,
    `make a story, share a Google Photos album and paste the link here:`,
    ``,
    `  ${albumPageUrl(token)}`,
    ``,
    `Nothing is uploaded. VihuPlanet only remembers the link, and the`,
    `photos stay in your own Google account.`,
    ``,
    `A shared album is shared by link — anyone who has that link can see`,
    `those photos — so choose an album you are happy to share that way.`,
    ``,
    `This is entirely optional, now or ever. Everything else works`,
    `without it, and you can come back to that page any time to add`,
    `another album.`,
  ].join('\n');
}

function albumHtml(identity: Identity, token: string): string {
  if (!token) return '';
  const name = esc(identity.nickname || 'them');
  const url = albumPageUrl(token);
  return `
<tr><td style="padding:18px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;border-top:1px solid ${LINE};">
    <tr><td style="padding:16px 0 0 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;">Family photos for ${name}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${INK};padding-top:8px;">
        If you would like ${name}&rsquo;s own photographs to be there when they make a story, share a Google Photos album and paste the link here:
      </div>
      <!-- A real, visible URL, not a styled button with the address
           hidden behind it. A parent may print this letter, may read it
           in a client that strips links, and may reasonably want to see
           where they are being sent before they go. -->
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;padding-top:10px;word-break:break-all;">
        <a href="${esc(url)}" style="color:${GOLD};font-weight:bold;">${esc(url)}</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65;color:${MUTED};padding-top:10px;">
        <strong style="color:${INK};">Nothing is uploaded.</strong> VihuPlanet only remembers the link, and the photos stay in your own Google account.
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65;color:${MUTED};padding-top:6px;">
        <strong style="color:${INK};">A shared album is shared by link</strong> &mdash; anyone who has that link can see those photos &mdash; so choose an album you are happy to share that way.
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65;color:${MUTED};padding-top:6px;">
        Entirely optional, now or ever. Everything else works without it, and you can come back to that page any time to add another album.
      </div>
    </td></tr>
  </table>
</td></tr>`;
}

function cardText(identity: Identity, albumToken = ''): string {
  const name = identity.nickname || 'This Creator';
  const constellation = CONSTELLATION_NAMES[identity.constellation] || identity.constellation;
  const code = recallCode(identity);
  return [
    `Creator: ${name}`,
    ``,
    code ? `Magic Card code: ${code}` : `Magic Card code: (this card has no code yet)`,
    `Constellation:   ${constellation}`,
    ``,
    `Their sky, star by star (tap these on the Mark Your Stars screen —`,
    `the order does not matter, only which stars):`,
    ``,
    orderedTaps(identity.pattern),
    ``,
    `The same sky, drawn:`,
    ``,
    skyDiagram(identity.pattern),
    albumText(identity, albumToken),
  ].join('\n');
}

// THE ONLY INSTRUCTIONS THAT ARE ALLOWED HERE ARE ONES THAT WORK.
//
// This used to send a parent to "My Magic Card? Tap to come home" in
// VihuStudio for the typed-code path. That control was removed once
// VihuPlanet became the front door and recognition moved there, so the
// instruction pointed at nothing. Measured on a fresh profile with no
// cards: the Gateway plays its cinematic and closes, and no typed-code
// entry is reachable at all.
//
// So the star path is the whole of it, and the star path is verified:
// ⭐ Show Me Your Stars opens the camera, ✏️ Draw Your Stars opens the
// board, tap the sky, Continue.
function recoveryText(): string {
  return [
    `How to use this`,
    ``,
    `1. Open VihuPlanet.`,
    `2. Press "Show Me Your Stars".`,
    `3. If you have the printed card to hand, hold it up to the camera.`,
    `   Otherwise choose "Draw Your Stars".`,
    `4. Tap the stars shown above, then press Continue.`,
    ``,
    `The order does not matter — only which stars. VihuPlanet will`,
    `recognise your child and their stories will be waiting.`,
    ``,
    `This is not an account. There is no password and nothing to log in`,
    `to — the Magic Card is simply how VihuPlanet recognises your child.`,
    `Keeping this email is the only thing needed to never lose it.`,
  ].join('\n');
}

function subjectFor(names: string[], kind: Kind): string {
  // A parent searches an inbox a year later, so the subject carries the
  // child's name and the words "Magic Card" in both cases. Only the
  // verb changes, because "here is the card you asked for" and "your
  // child's card is now safe" are different messages arriving on
  // different days.
  // "Vihaan and Meera's Magic Card" reads as one card belonging to a
  // pair. Siblings on one address is the normal case here, so the
  // plural form is the one that has to be right.
  const who = names.length === 1 ? names[0] : names.join(' and ');
  if (names.length > 1) return `Magic Cards for ${who} — VihuPlanet`;
  return kind === 'recover'
    ? `${who}'s Magic Card — VihuPlanet`
    : `${who}'s sky is safe — VihuPlanet Magic Card`;
}

// ---------------------------------------------------------------
// THE SAME MESSAGE, DRAWN
//
// Every client renders the plain-text part; this is for the ones that
// can do better. Rules it is built under, all of them forced by what
// email clients actually do rather than by taste:
//
//   · NO IMAGES, at all. Not a logo, not the card, not the sky. A
//     recovery mail that needs pictures to work is not a recovery mail,
//     and the sky is the one thing here that MUST survive an inbox with
//     images turned off. It is drawn as table cells.
//   · Tables and inline styles only. No <style> block, no class names,
//     no flexbox, no grid — Outlook still renders with Word.
//   · A LIGHT body. VihuPlanet is a night sky and the temptation is to
//     make the whole mail one; a parent may print this and file it, and
//     a full-bleed dark email prints as a sheet of ink. The sky panel
//     is dark because the sky is the part that means something dark;
//     everything around it is paper.
//   · No web fonts. A font that fails to load takes the layout with it.
// ---------------------------------------------------------------
const INK = '#1D2440';
const MUTED = '#5C6584';
const GOLD = '#B57F1E';
const PAPER = '#FFFDF7';
const LINE = '#E4DECB';
const NIGHT = '#141A2E';
// The grid's own numbers, on the night panel. Brighter than an unlit
// cell so they read as ruling rather than as faint stars, and far
// dimmer than a lit one so they never compete with the sky itself.
const LABEL = '#707C9E';
const STAR = '#F0C978';

function esc(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The sky, as a 10x10 table. Each cell is a fixed square so the grid
// stays square when a client rescales text, and the lit ones carry a
// glyph as well as a colour — a parent reading this on a monochrome
// screen, or colour-blind, still sees which stars are theirs.
// RULED, like a chart.
//
// The stars are also listed as "row 2, col 3", and without numbers down
// the side and along the top a parent has to count squares with a
// finger to check one against the other. The grid is the thing being
// read from, so it carries its own coordinates.
//
// The labels are deliberately dim. They are scaffolding for an adult
// checking their work, not part of the sky.
function skyHtml(pattern: number[][]): string {
  const size = 10;
  const lit = new Set((pattern || []).map((p) => `${p[0]},${p[1]}`));
  const label = `font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:22px;color:${LABEL};`;
  const cell = 'width:22px;height:22px;';

  // The column numbers, with an empty corner above the row numbers.
  let head = `<td style="${cell}"></td>`;
  for (let c = 0; c < size; c++) {
    head += `<td width="22" align="center" valign="middle" style="${cell}${label}">${c + 1}</td>`;
  }
  const rows: string[] = [`<tr>${head}</tr>`];

  for (let r = 0; r < size; r++) {
    let tds = `<td width="22" align="center" valign="middle" style="${cell}${label}">${r + 1}</td>`;
    for (let c = 0; c < size; c++) {
      const on = lit.has(`${r},${c}`);
      tds += `<td width="22" height="22" align="center" valign="middle" style="${cell}`
        + `font-family:Georgia,'Times New Roman',serif;font-size:${on ? 15 : 11}px;line-height:22px;`
        + `color:${on ? STAR : '#3A4463'};">${on ? '&#9733;' : '&middot;'}</td>`;
    }
    rows.push(`<tr>${tds}</tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"`
    + ` style="border-collapse:collapse;background:${NIGHT};border-radius:10px;">`
    + `<tr><td style="padding:10px 12px 12px 10px;"><table role="presentation" cellpadding="0" cellspacing="0"`
    + ` border="0" style="border-collapse:collapse;">${rows.join('')}</table></td></tr></table>`;
}

function cardHtml(identity: Identity, albumToken = ''): string {
  const name = esc(identity.nickname || 'This Creator');
  const constellation = esc(
    CONSTELLATION_NAMES[identity.constellation] || identity.constellation || '',
  );
  const code = recallCode(identity);
  const taps = (identity.pattern || [])
    .map((p) => `row ${p[0] + 1}, col ${p[1] + 1}`)
    .join(' &nbsp;·&nbsp; ');

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-collapse:collapse;border:1px solid ${LINE};border-radius:14px;background:${PAPER};">
  <tr><td style="padding:22px 24px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.25;color:${INK};font-weight:bold;">${name}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};padding-top:3px;">
      ${constellation ? 'The ' + constellation + ' sky' : 'Their sky'}
    </div>

    <!-- STACKED, NOT TWO COLUMNS.
         A sky (240px) beside a list of stars cannot shrink below about
         540px, so on a 390px phone the whole mail overflowed and had to
         be scrolled sideways — measured at 622px wide in a 390px
         viewport. Media queries would fix it in the clients that keep a
         <style> block and not in the ones that strip it, which is the
         wrong half to be right in for a recovery mail. Stacking is
         correct everywhere and costs a desktop reader nothing. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td style="padding:16px 0 0 0;">${skyHtml(identity.pattern)}</td></tr>
      <tr><td style="padding:18px 0 0 0;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;">Their stars</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${INK};padding-top:4px;">${taps}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};padding-top:6px;">The order does not matter &mdash; only which stars.</div>
      </td></tr>
      ${code ? `<tr><td style="padding:14px 0 0 0;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;">Card code</div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.4;color:${GOLD};font-weight:bold;padding-top:2px;">${esc(code)}</div>
      </td></tr>` : ''}
      ${albumHtml(identity, albumToken)}
    </table>
  </td></tr>
</table>`;
}

// `albumTokens` is parallel to `identities` — one link per child, in the
// same order — and an empty string at any position simply means that
// card carries no album passage. It is a plain array rather than a map
// keyed by id so a caller cannot half-fill it by accident.
function composeHtml(identities: Identity[], kind: Kind, albumTokens: string[] = []): string {
  const many = identities.length > 1;
  const lede = kind === 'recover'
    ? (many
      ? `Here are the Magic Cards kept safe at this address. Each one belongs to a different Creator.`
      : `Here is the Magic Card kept safe at this address.`)
    : (many
      ? `${identities.length} skies are now safe with you.`
      : `Their sky is now safe with you.`);

  // cardHtml returns a COMPLETE table, so the separator is a spacer and
  // nothing else. It used to close a <table> that was never opened and
  // reopen another, which is invalid markup — the browser recovered by
  // hoisting the second card out of the container, so with two siblings
  // the second one broke the width of the mail.
  const blocks = identities.map((idn, i) => cardHtml(idn, albumTokens[i] || '')).join(
    `<div style="height:16px;line-height:16px;font-size:16px;">&nbsp;</div>`,
  );

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Magic Card — VihuPlanet</title></head>
<body style="margin:0;padding:0;background:#F4F1E8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Keep this email — it is how your child's sky can always be found again.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1E8;">
<tr><td align="center" style="padding:28px 12px;">
  <!-- width:100% + max-width, NOT a width="600" attribute. The
       attribute is a hard width a phone cannot shrink: measured at
       624px inside a 320px viewport, i.e. sideways scrolling on every
       narrow screen. -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <tr><td style="padding:0 0 18px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};">&#10022; VihuPlanet</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${INK};padding-top:6px;">${esc(lede)}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};padding-top:8px;">
        Keep this email. A Magic Card is how VihuPlanet recognises your child &mdash; there is no account, no password and nothing to sign in to, so this is the one thing worth keeping.
      </div>
    </td></tr>

    <tr><td>${blocks}</td></tr>

    <tr><td style="padding:22px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;border-top:1px solid ${LINE};">
        <tr><td style="padding:18px 2px 0 2px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">If the card is ever lost</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:${INK};padding-top:8px;">
            1. Open VihuPlanet.<br>
            2. Press <strong>Show Me Your Stars</strong>.<br>
            3. Hold the printed card up to the camera &mdash; or choose <strong>Draw Your Stars</strong>.<br>
            4. Tap the stars shown above, then press <strong>Continue</strong>.
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${MUTED};padding-top:12px;">
            Their stories will be waiting, on any device.
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:26px 2px 0 2px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
        Sent because someone chose to keep this sky safe. VihuPlanet never asks a child for an email address.
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------
// SENDING
//
// Two transports, chosen by whichever secrets are present. SMTP wins
// when SMTP_HOST is set — which is now the ESCAPE HATCH rather than the
// recommendation. See the note at the top of this file for what
// changed and why; the short version is that a mailbox's SMTP is a
// human login channel and behaves like one.
//
// The switch is why that discovery cost a secret rather than a sprint:
// the transport moved with no code change and no deploy. That is worth
// the twenty lines on its own, and it is worth keeping now that the
// preference has flipped — the next thing to go wrong will be on the
// HTTP side, and the way back is the same one secret.
//
// HTTP (Resend) — the recommended path:
//   RESEND_API_KEY  re_...
//
// SMTP (a real mailbox) — the escape hatch. The host is the MAIL
// provider's, which is not always the company the domain was bought
// from — a GoDaddy domain with "Professional Email" on it is usually
// Titan underneath, and Titan's host is nothing like GoDaddy's own.
// Check the webmail URL if unsure.
//   SMTP_HOST      smtp.titan.email          (Titan, incl. via GoDaddy)
//                  smtpout.secureserver.net  (GoDaddy's own mail)
//                  smtp.office365.com        (Microsoft 365)
//   SMTP_PORT      465  (implicit TLS)  ·  587 (STARTTLS)
//   SMTP_USER      the full email address
//   SMTP_PASSWORD  the mailbox password
//
// Both:
//   SKY_FROM_EMAIL  "VihuPlanet <you@yourdomain.com>"
//   SKY_REPLY_TO    where a parent's reply should land. Needed whenever
//                   the from address is send-only — a domain sending
//                   over HTTP with no mailbox behind it is exactly
//                   that, and is the normal case now. Leave it unset
//                   only when SKY_FROM_EMAIL is a real inbox somebody
//                   reads.
//
// With SMTP the from address must be the mailbox that authenticated —
// most providers, GoDaddy included, reject anything else — so
// SKY_FROM_EMAIL and SMTP_USER are the same address, with a display
// name on the front.
// ---------------------------------------------------------------

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

// A secret typed into a dashboard field, or set through a shell, picks
// up characters nobody meant to send: a trailing newline from a paste,
// a leading space, or the quotes from `SMTP_PASSWORD='...'` stored
// literally rather than consumed by the shell. Every one of those
// reaches the mail server as part of the password and comes back as
// 535 authentication failed, which reads exactly like a wrong password
// and is not one.
//
// Passwords do not legitimately begin or end with whitespace or a
// matched pair of quotes, so removing them can only ever fix this and
// never break a working credential.
function secret(name: string): string {
  let v = (Deno.env.get(name) || '').trim();
  if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function sendViaSmtp(to: string, subject: string, body: string, html: string) {
  const host = secret('SMTP_HOST');
  const user = secret('SMTP_USER');
  const pass = secret('SMTP_PASSWORD');
  const from = secret('SKY_FROM_EMAIL') || user;
  const replyTo = secret('SKY_REPLY_TO');
  const port = Number(secret('SMTP_PORT') || '465');
  if (!host || !user || !pass || !from) return { ok: false, error: 'mail_not_configured' };

  let client: SMTPClient | null = null;
  try {
    client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        // 465 is implicit TLS from the first byte; 587 opens in the
        // clear and upgrades with STARTTLS, which denomailer does for
        // itself. Getting this pair wrong is the usual reason a send
        // hangs rather than fails.
        tls: port === 465,
        auth: { username: user, password: pass },
      },
    });
    await client.send({
      from,
      to,
      subject,
      // BOTH parts, always. The text is not a courtesy fallback here —
      // it is the copy a parent's inbox search will hit in a year, and
      // the one that survives a client that strips markup outright.
      content: body,
      html,
      replyTo: replyTo || undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'mail_send_failed', detail: String(e).slice(0, 300) };
  } finally {
    // Never let a failed close mask a successful send.
    try { await client?.close(); } catch { /* ignore */ }
  }
}

async function sendViaResend(to: string, subject: string, body: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('SKY_FROM_EMAIL');
  const replyTo = Deno.env.get('SKY_REPLY_TO');
  if (!key || !from) return { ok: false, error: 'mail_not_configured' };

  const payload: Record<string, unknown> = { from, to: [to], subject, text: body, html };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: 'mail_send_failed', detail: detail.slice(0, 300) };
  }
  return { ok: true };
}

async function sendMail(to: string, subject: string, body: string, html: string) {
  if (Deno.env.get('SMTP_HOST')) return await sendViaSmtp(to, subject, body, html);
  if (Deno.env.get('RESEND_API_KEY')) return await sendViaResend(to, subject, body, html);
  return { ok: false, error: 'mail_not_configured' };
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ONE LINK PER CHILD, FETCHED OR MINTED, AND NEVER FATAL.
//
// `family_album_link_mint` is idempotent — one row per identity — so
// calling it on every letter returns the link that already exists. The
// `protect` letter and a later `recover` letter therefore carry the SAME
// link, which is what makes a filed letter or a bookmark keep working.
//
// EVERY FAILURE IS AN EMPTY STRING, deliberately. If
// migrations_family_album_link.sql has not been run against this
// deployment the RPC does not exist, and the only correct consequence is
// that the letter goes out as the letter it has always been: the child
// still gets their card, and nothing anywhere offers a parent something
// that would not work. Never let this throw — a missing album passage
// must not cost a sky.
async function albumTokensFor(
  db: ReturnType<typeof createClient>,
  identities: Identity[],
): Promise<string[]> {
  const out: string[] = [];
  for (const identity of identities) {
    let token = '';
    try {
      const { data, error } = await db.rpc('family_album_link_mint', {
        p_identity_id: identity.id,
      });
      if (!error && typeof data === 'string') token = data;
    } catch {
      token = '';
    }
    out.push(token);
  }
  return out;
}

// Only ever used to decide whether to bother sending. Never echoed back
// to the caller — see the note on the `recover` branch.
function looksLikeEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length < 320;
}

function compose(identities: Identity[], kind: Kind, albumTokens: string[] = []): string {
  // THE PLAIN TEXT IS A FIRST-CLASS CITIZEN, not a fallback. Plenty of
  // people read mail with images off or in a client that strips markup,
  // and the album passage — including both of the things about it that
  // must not be buried — is written out in full here, not summarised.
  const parts = identities.map((idn, i) => cardText(idn, albumTokens[i] || ''));
  const many = identities.length > 1;
  const lede = kind === 'recover'
    ? (many
      ? `Here are the Magic Cards kept safe at this address.`
      : `Here is the Magic Card kept safe at this address.`)
    : (many
      ? `${identities.length} skies are now safe with you.`
      : `Their sky is now safe with you.`);
  return [
    lede,
    ``,
    `Keep this email. It is how your child's sky can always be found again.`,
    ``,
    parts.join('\n\n' + '—'.repeat(40) + '\n\n'),
    ``,
    '—'.repeat(40),
    ``,
    recoveryText(),
    ``,
    `Sent because someone chose to keep this sky safe. VihuPlanet never`,
    `asks a child for an email address.`,
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const db = admin();
  if (!db) return json({ ok: false, error: 'not_configured' });

  const action = String(body.action || 'protect');

  // ---------------------------------------------------------------
  // AUTHORIZATION (Sprint 1A, CLAUDE.md -> Decision 30)
  //
  // THE HOLE THIS CLOSES, stated plainly because it was real and it
  // was ours: `protect` took an `identityId` straight from the request
  // body, looked up whatever card carried it, WROTE the caller's chosen
  // address onto that card, and posted the card — nickname,
  // constellation and serial — to the address they gave. The only thing
  // in front of it was Supabase's verify_jwt gate, which the PUBLIC
  // anon key satisfies. So anybody who read supabase-config.json could
  // point a stranger's child's Magic Card at their own inbox and be
  // sent it.
  //
  // The comment on the `parent_email` write below has always said this
  // was safe "so `recover` can never be pointed at a card by anybody
  // who did not just prove they hold it." Nothing proved anything. Now
  // something does.
  //
  //   protect  the caller must own the identity, or have PROVEN a
  //            recall of it (js/magicCard.js's adopt() keeps the
  //            original identity_id and never re-stamps owner_id, so a
  //            Creator recognised at their grandmother's house is
  //            legitimately not its owner — magic_card_recalls is what
  //            makes them entitled anyway).
  //   recover  any real session. There is nothing to own: this is the
  //            path for a child on a brand-new device with no card at
  //            all, and Decision 14 is explicit that controlling the
  //            inbox is the whole of the check. What it gains is a
  //            rate limit, because it sends mail.
  //   ping     any real session. Its own note below says it is
  //            "deliberately reachable with the anon key"; that is no
  //            longer true of anything here, and it loses nothing — it
  //            reports booleans about this deployment and every browser
  //            in the product holds a session.
  const pass = await guard(req, {
    env: {
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
      serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    },
    require: 'user',
    // A deployment probe costs nothing and must not be able to exhaust
    // the allowance that letters need.
    bucket: action === 'ping' ? '' : 'sky-protection',
    db,
    envGet: (n: string) => Deno.env.get(n) || '',
  });
  if (!pass.ok) return json(pass.body, pass.status);

  // A deployment check, and nothing else. Five different things make
  // this feature say "I could not reach them just now", and from a
  // browser they are indistinguishable — so there is one call that
  // answers, without sending anything, whether the function is running,
  // whether the database can be read, whether the parent_email column
  // was ever added, and which transport the secrets selected.
  //
  // It reports BOOLEANS and a transport name. Never a secret, never an
  // address, never a card. Deliberately reachable with the anon key,
  // because the anon key is public and the answer tells an attacker
  // only that a mail feature exists, which the product already says.
  if (action === 'ping') {
    const probe = await db.from('magic_card_identities').select('parent_email').limit(1);
    // Was migrations_family_album_link.sql ever run here? Without it the
    // letter is correct and complete but carries no album passage, and
    // that is indistinguishable from the outside — so it is answered
    // outright, the same reasoning `parentEmailColumn` above already
    // used. A boolean and nothing else: never a token, never a child.
    const albumProbe = await db.from('family_album_links').select('token').limit(1);
    return json({
      ok: true,
      build: BUILD,
      familyAlbumLinks: !albumProbe.error,
      albumBase: ALBUM_BASE(),
      // Proof the HTML build is live without sending anything: the
      // length of the message this deployment would actually generate.
      // Zero means an old, text-only copy is running.
      htmlBytes: composeHtml(
        [{ id: '', serial_no: 1, nickname: 'Sample', constellation: 'LYRA',
           pattern: [[0, 0]], claimed_at: '' }],
        'recover',
      ).length,
      db: !probe.error,
      parentEmailColumn: !probe.error,
      dbError: probe.error ? String(probe.error.message || probe.error).slice(0, 200) : null,
      transport: Deno.env.get('SMTP_HOST')
        ? 'smtp'
        : (Deno.env.get('RESEND_API_KEY') ? 'resend' : 'none'),
      smtpHost: secret('SMTP_HOST') || null,
      smtpPort: secret('SMTP_PORT') || null,
      smtpUserSet: !!secret('SMTP_USER'),
      smtpPasswordSet: !!secret('SMTP_PASSWORD'),
      fromSet: !!secret('SKY_FROM_EMAIL'),

      // 535 from a mail server means "that credential is wrong", and it
      // says the same thing whether the password is genuinely wrong or
      // merely carries a stray quote, a trailing newline or an address
      // that is not the full mailbox. These distinguish those without
      // revealing anything: shapes and matches, never a value and never
      // a length.
      smtpUserIsFullAddress: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secret('SMTP_USER')),
      smtpPasswordWasWrapped:
        (Deno.env.get('SMTP_PASSWORD') || '') !== secret('SMTP_PASSWORD'),
      // With SMTP the from address must be the mailbox that
      // authenticated — most providers, Titan included, reject anything
      // else. A display name on the front is fine; a different address
      // is not.
      fromMatchesUser: (function () {
        const u = secret('SMTP_USER').toLowerCase();
        const f = secret('SKY_FROM_EMAIL').toLowerCase();
        if (!u) return false;
        if (!f) return true; // falls back to the user
        const inAngles = f.match(/<([^>]+)>/);
        return (inAngles ? inAngles[1].trim() : f.trim()) === u;
      })(),
    });
  }

  const email = body.email;
  if (!looksLikeEmail(email)) return json({ ok: false, error: 'bad_email' });
  const to = String(email).trim();

  const COLUMNS = 'id, serial_no, nickname, constellation, pattern, claimed_at';

  if (action === 'protect') {
    const identityId = String(body.identityId || '');
    if (!identityId) return json({ ok: false, error: 'bad_request' }, 400);

    // OWNERSHIP, BEFORE ANYTHING IS READ OR WRITTEN. A card that does
    // not exist and a card belonging to somebody else answer
    // identically — the same reasoning `recover` below already uses for
    // addresses, so this cannot become an oracle for which Magic Card
    // ids are real.
    const owns = await authorizeCardAccess(db, identityId, pass.caller, COLUMNS);
    if (!owns.ok) return json({ ok: false, reason: 'forbidden' }, 403);

    const { data, error } = await db
      .from('magic_card_identities')
      .select(COLUMNS)
      .eq('id', identityId)
      .limit(1);
    if (error) return json({ ok: false, error: 'lookup_failed' });
    const rows = (data || []) as Identity[];
    if (!rows.length) return json({ ok: false, error: 'no_such_card' });

    // The address is written here rather than trusted from the client's
    // own row update, so `recover` can never be pointed at a card by
    // anybody who did not just prove they hold it.
    await db.from('magic_card_identities')
      .update({ parent_email: to })
      .eq('id', identityId);

    const names = [rows[0].nickname || 'Your Creator'];
    const albumTokens = await albumTokensFor(db, rows);
    const sent = await sendMail(
      to,
      subjectFor(names, 'protect'),
      compose(rows, 'protect', albumTokens),
      composeHtml(rows, 'protect', albumTokens),
    );
    if (!sent.ok) return json(sent);
    return json({ ok: true, sent: 1 });
  }

  if (action === 'recover') {
    const { data, error } = await db
      .from('magic_card_identities')
      .select(COLUMNS)
      .eq('parent_email', to)
      .order('claimed_at', { ascending: true });
    if (error) return json({ ok: false, error: 'lookup_failed' });
    const rows = (data || []) as Identity[];

    // Always the same answer, whether or not that address protects
    // anything. Saying "no skies here" would turn this into an oracle
    // for which addresses are in the product, and the child on the
    // other end of it does not need to know either — their parent
    // either receives an email or does not.
    if (!rows.length) return json({ ok: true, sent: 0 });

    const albumTokens = await albumTokensFor(db, rows);
    const sent = await sendMail(
      to,
      subjectFor(rows.map((r) => r.nickname || 'Your Creator'), 'recover'),
      compose(rows, 'recover', albumTokens),
      composeHtml(rows, 'recover', albumTokens),
    );
    if (!sent.ok) return json(sent);
    return json({ ok: true, sent: rows.length });
  }

  return json({ ok: false, error: 'unknown_action' }, 400);
});
