// invite-send — Lumo writes to somebody, and asks them to come.
//
// Asked for by the product owner: "creating an invite for vihuplanet
// which can be mailed by lumo."
//
// ---------------------------------------------------------------
// WHO THIS LETTER IS ACTUALLY FOR
//
// A grown-up. An email address belongs to a parent, and a parent is the
// one who decides whether a child opens anything. So the letter is
// written for a grown-up to READ and a child to be shown — warm rather
// than cute, short rather than salesy, and it says plainly what the
// place is before it invites anybody into it.
//
// It is signed by Lumo because Lumo is the one who welcomes people to
// VihuPlanet (Canon 2) and belongs to the universe rather than to any
// child. It is NOT written in a child's voice, and it never pretends a
// specific child sent it.
//
// ---------------------------------------------------------------
// WHAT IT NEVER DOES
//
// No tracking pixel. No open-beacon image. No "click here to confirm
// you are a real person." The only thing that records anything is the
// child's own browser arriving at VihuPlanet through the link, which
// is a visit, not surveillance — and the link itself carries a token
// that names an INVITATION and never a person.
//
// No urgency, no countdown, no "your spot expires". This is an
// invitation to a quiet place, and the copy has to sound like one.
//
// ---------------------------------------------------------------
// CONFIGURATION — the same secrets sky-protection already uses, because
// it is the same mailbox doing the sending. Nothing new to set up if
// Sky Protection already works.
//
//   RESEND_API_KEY   re_...            (or SMTP_HOST/USER/PASSWORD)
//   SKY_FROM_EMAIL   "VihuPlanet <hello@vihuplanet.com>"
//   SKY_REPLY_TO     optional
//   INVITE_BASE_URL  optional, defaults to https://vihuplanet.com
//
// A missing key is a HANDLED state, not a crash: the function answers
// 200 with {ok:false, reason} so the admin page can show a plain
// sentence rather than a stack trace, exactly as voice-speak does.

// Sprint 1A, CLAUDE.md -> Decision 30 — see the ADMINISTRATORS ONLY
// note inside Deno.serve() below.
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

// Bump whenever the letter itself changes — an Edge Function runs the
// copy uploaded to the project, not the file in the repository, and
// there is no CI here that deploys it. `{"action":"ping"}` answers
// which build is actually live.
const BUILD = '2026-08-23 · paper letter, two Ether books';

// THE BOOKS ARE REAL, AND THEY ARE CANON.
//
// The product owner's design puts two Ether books beside the letter,
// because "there are already stories here, come choose one" is a
// different invitation from "come join our creative platform" — and it
// is the true one.
//
// They are CANON STORIES (CLAUDE.md → Decision 13): made by the team,
// owned by nobody, shipped with the application. A CHILD'S shared story
// must never appear here — putting somebody's child in an outreach
// email is not ours to do, whatever the Ether's own visibility rules
// say.
//
// The covers are the stories' own thumbnails, lifted from
// vihuplanet/canon/ into assets/invite/ so they have a hosted URL:
// email clients do not reliably render data: URIs, and Gmail strips
// them outright. DISCLOSED COUPLING — these mirror canon.json by hand,
// so adding or renaming a Canon Story means updating this list too.
//
// `id` IS THE DEEP LINK, and it only works because these are Canon.
// js/etherFeed.js sets a Story's `projectId` to the record's own id, and
// js/vihuplanetHome.js opens whatever `?story=` names once the Ether is
// alive. Canon ships WITH the application, so it sits in everybody's
// Ether — these two are the only stories on the platform whose link
// resolves for a total stranger. A child's own story link would not,
// and must not.
const BOOKS: Array<{ name: string; img: string; id: string }> = [
  { name: 'The falling star', img: 'assets/invite/falling-star.png', id: 'canon_the_falling_star' },
  { name: 'Little Seed🌻',    img: 'assets/invite/little-seed.png',  id: 'canon_little_seed' },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function secret(name: string): string {
  let v = (Deno.env.get(name) || '').trim();
  if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

// ---------------------------------------------------------------
// THE LETTER
// ---------------------------------------------------------------
// One idea per line, and the whole thing readable in the preview pane
// of a phone without opening it. The plain-text version is not an
// afterthought: plenty of people read mail with images off, and this
// has to work whole in that state.

function subjectFor(): string {
  return 'I left a door open for you';
}

function textFor(link: string, note: string): string {
  const lines = [
    'Hello,',
    '',
    'I found a little door in VihuPlanet.',
    '',
    'I opened it. There was a story inside.',
    'It had a beginning... but no ending.',
    '',
    'I thought about finishing it myself.',
    'But then I wondered: what if YOU finished it?',
    '',
    'You could choose what happens. You could change things.',
    'You could even leave something of your own behind.',
    '',
    'So I left the door open:',
    '',
    link,
    '',
  ];
  // WHERE THE HTML PUTS IT. The two halves used to place the sender's own
  // note two paragraphs apart — the letter has it between the door and
  // the reassurance, the plain text had it after both — which nobody
  // chose and nobody could see. The plain part is not a fallback: it is
  // what a reader with images off actually gets.
  if (note) lines.push(note, '');
  lines.push(
    'You do not need an account. You do not need to pay anything.',
    'Just come in. I will show you where the story begins.',
    '',
    'Two stories are waiting in the Ether. Which will you open first?',
    '',
    ...BOOKS.flatMap((b) => ['  ' + b.name, '  ' + link + '&story=' + b.id, '']),
    '',
    'With a smile,',
    'Lumo',
    'Keeper of VihuPlanet',
    '',
    '---',
    'For parents: VihuPlanet is a safe creative space where children can',
    'explore stories, make choices, and gradually learn to create their own.',
    'No payment or account is required to begin. Best on a laptop.',
  );
  return lines.join('\n');
}

function htmlFor(link: string, note: string): string {
  const base = (secret('INVITE_BASE_URL') || 'https://vihuplanet.com').replace(/\/+$/, '');

  // PAPER, NOT A DASHBOARD. Cream ground, VihuPlanet navy ink, a few
  // very restrained Ether marks, and small hand-drawn shapes rather
  // than glowing effects. No gradients, no sparkle graphics, no
  // character art, no oversized fantasy imagery.
  const cream = '#F7F3E9', paper = '#FBF8F1', navy = '#1D3457';
  const ink = '#22314C', soft = '#5C6B84', gold = '#A8762A', rule = '#DCD3C0';

  const noteBlock = note
    ? `<p style="margin:0 0 16px;padding:11px 13px;background:#F2EDE0;border-left:3px solid ${gold};
         color:${ink};font-style:italic;font-size:14px;line-height:1.55;">${esc(note)}</p>`
    : '';

  // The two books. With images off this still reads — every cover
  // carries its story's name as alt text, and the caption above says
  // what they are.
  // EVERY BOOK IS ITS OWN DOOR. Three links now go to the same place;
  // the two covers simply arrive pointing at something. A child drawn
  // to a particular story should be able to follow that rather than be
  // told to press a general button instead — and the invite token rides
  // along on all three, so the journey is recorded whichever they take.
  //
  // It does NOT drop them into a reader. VihuPlanet's threshold comes
  // first, the universe turns, and only then does the camera find that
  // Spirit — "a link that snaps straight to a Spirit never shows them
  // where the story lives" (js/vihuplanetHome.js).
  const books = BOOKS.map((b) => {
    const to = `${link}&story=${encodeURIComponent(b.id)}`;
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin:0 0 16px;"><tr><td align="center">
      <a href="${esc(to)}" style="text-decoration:none;color:${navy};">
        <img src="${esc(base + '/' + b.img)}" width="150" alt="${esc(b.name)}"
             style="display:block;width:150px;max-width:100%;height:auto;border:1px solid ${rule};
                    border-radius:3px;background:${paper};">
        <div style="margin:7px 0 0;font:400 14px/1.3 Georgia,serif;color:${navy};
                    text-decoration:none;">${esc(b.name)}</div>
      </a>
    </td></tr></table>`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  /* Stacks the letter and the books on a phone. Clients that ignore
     this keep the two columns, which is still readable at 600px. */
  @media only screen and (max-width:540px){
    .col{display:block !important;width:100% !important;max-width:100% !important;}
    .colr{padding-top:22px !important;}
  }
</style></head>
<body style="margin:0;padding:0;background:${navy};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${navy};">
 <tr><td align="center" style="padding:26px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:600px;background:${cream};border-radius:6px;
                font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

   <!-- masthead -->
   <tr><td align="center" style="padding:30px 26px 6px;">
     <div style="font-size:16px;color:${navy};line-height:1">&#10022;</div>
     <div style="margin:8px 0 0;font:400 30px/1.15 Georgia,serif;color:${navy};">VihuPlanet</div>
     <div style="margin:5px 0 0;font-size:12.5px;color:${soft};">
       a quiet place where children's stories live</div>
   </td></tr>

   <tr><td style="padding:20px 26px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>

     <!-- the letter -->
     <td class="col" width="56%" valign="top"
         style="padding-right:18px;font-size:14.5px;line-height:1.62;color:${ink};">
       <div style="font:400 23px/1.2 Georgia,serif;color:${navy};margin:0 0 14px;">Hello,</div>
       <p style="margin:0 0 12px;">I found a little door in VihuPlanet.</p>
       <p style="margin:0 0 12px;">I opened it.<br>There was a story inside.<br>
          It had a beginning&#8230;<br>but no ending.</p>
       <p style="margin:0 0 12px;">I thought about finishing it myself.</p>
       <p style="margin:0 0 6px;">But then I wondered:</p>
       <p style="margin:0 0 14px;font:400 19px/1.3 Georgia,serif;color:${gold};">
          What if you finished it?</p>
       <p style="margin:0 0 12px;">You could choose what happens.<br>
          You could change things.<br>
          You could even leave something of your own behind.</p>
       <p style="margin:0 0 18px;">So I left the door open.</p>
       ${noteBlock}

       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
         <tr><td align="center" bgcolor="${navy}" style="border-radius:999px;">
           <a href="${esc(link)}"
              style="display:inline-block;padding:13px 30px;font-size:15.5px;font-weight:600;
                     color:${cream};text-decoration:none;font-family:Georgia,serif;">
             Open the Door &#9733;</a>
         </td></tr>
       </table>

       <p style="margin:0 0 3px;font-size:13.5px;color:${ink};">&#9734; You don't need an account.</p>
       <p style="margin:0 0 10px;font-size:13.5px;color:${ink};">&#9825; You don't need to pay anything.</p>
       <p style="margin:0 0 6px;font:400 17px/1.3 Georgia,serif;color:${gold};">Just come in.</p>
       <p style="margin:0 0 20px;font-size:13.5px;">I'll show you where the story begins.</p>

       <p style="margin:0 0 2px;font-size:13.5px;color:${soft};">With a smile,</p>
       <p style="margin:0;font:italic 400 21px/1.2 Georgia,serif;color:${navy};">Lumo &#9734;</p>
       <p style="margin:2px 0 0;font-size:12.5px;color:${soft};">Keeper of VihuPlanet</p>
     </td>

     <!-- the two books -->
     <td class="col colr" width="44%" valign="top" style="padding-left:6px;">
       <p style="margin:0 0 14px;text-align:center;font:400 15px/1.45 Georgia,serif;color:${navy};">
         Two stories from the Ether<br>are waiting for you.</p>
       ${books}
       <p style="margin:4px 0 0;text-align:center;font:400 14px/1.4 Georgia,serif;color:${gold};">
         Which one will you open first?</p>
     </td>

    </tr></table>
   </td></tr>

   <!-- for parents -->
   <tr><td style="padding:24px 26px 28px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="background:#F1ECDF;border:1px solid ${rule};border-radius:4px;">
       <tr><td style="padding:14px 16px;">
         <div style="font-size:13px;font-weight:700;color:${navy};margin:0 0 4px;">For parents</div>
         <div style="font-size:12.5px;line-height:1.6;color:${soft};">
           VihuPlanet is a safe creative space where children can explore stories, make choices,
           and gradually learn to create their own. No payment or account is required to begin.
           Best opened on a laptop.
         </div>
       </td></tr>
     </table>
     <p style="margin:14px 0 0;font-size:11.5px;line-height:1.5;color:${soft};word-break:break-all;">
       If the button does not work: <span style="color:${ink};">${esc(link)}</span>
     </p>
   </td></tr>

  </table>
 </td></tr>
</table>
</body></html>`;
}

// ---------------------------------------------------------------
// SENDING
// ---------------------------------------------------------------

async function sendViaResend(to: string, subject: string, text: string, html: string) {
  const key = secret('RESEND_API_KEY');
  const from = secret('SKY_FROM_EMAIL');
  const replyTo = secret('SKY_REPLY_TO');
  if (!key || !from) return { ok: false, error: 'mail_not_configured' };

  const payload: Record<string, unknown> = { from, to: [to], subject, text, html };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // ---------------------------------------------------------------
  // ADMINISTRATORS ONLY (Sprint 1A, CLAUDE.md -> Decision 30)
  //
  // This sends mail to an address of the caller's choosing with a note
  // of the caller's choosing, signed by Lumo. Reached with the public
  // anon key, that is an open relay wearing our name — and the admin
  // console that calls it was already signed in with a real account
  // (admin/invites.html's own signInWithPassword), so the credential
  // to use was sitting there unused.
  //
  // is_platform_admin() (supabase/migrations_admin_console.sql) matches
  // on auth.jwt() ->> 'email', which a service-role caller cannot
  // supply — so the shared module asks platform_admins directly, with
  // the email the AUTH SERVER returned for this token and never one the
  // client sent. Same table, same comparison, asked the way this caller
  // can ask it. An anonymous session can never pass, whatever it claims.
  const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const db = (SUPA_URL && SERVICE) ? restDb(SUPA_URL, SERVICE) : null;
  const pass = await guard(req, {
    env: { supabaseUrl: SUPA_URL, anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '', serviceKey: SERVICE },
    require: 'user',
    bucket: 'invite-send',
    db,
    envGet: (n: string) => Deno.env.get(n) || '',
  });
  if (!pass.ok) return json(pass.body, pass.status);
  if (!(await isPlatformAdmin(db, pass.caller))) {
    return json({ ok: false, reason: 'forbidden' }, 403);
  }

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { payload = {}; }

  // Which build is live, and whether mail is configured at all. The
  // admin page calls this before offering to send anything, so a
  // missing key is a sentence on screen rather than a failed send.
  if (payload.action === 'ping') {
    return json({
      ok: true,
      build: BUILD,
      mail: secret('RESEND_API_KEY') ? 'resend' : (secret('SMTP_HOST') ? 'smtp' : 'none'),
      from: secret('SKY_FROM_EMAIL') ? 'set' : 'unset',
    });
  }

  const to = String(payload.to || '').trim();
  const token = String(payload.token || '').trim();
  const note = String(payload.note || '').trim().slice(0, 300);
  const base = (secret('INVITE_BASE_URL') || 'https://vihuplanet.com').replace(/\/+$/, '');

  if (!to || !token) return json({ ok: false, reason: 'missing_fields' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ ok: false, reason: 'bad_address' });
  if (!/^[a-z0-9]{8,64}$/i.test(token)) return json({ ok: false, reason: 'bad_token' });

  const link = `${base}/?invite=${encodeURIComponent(token)}`;
  const sent = await sendViaResend(to, subjectFor(), textFor(link, note), htmlFor(link, note));

  // 200 EVEN WHEN IT FAILED. The caller treats "not ok" as a sentence
  // to show, never as an exception to handle — the same contract
  // voice-speak uses, for the same reason.
  if (!sent.ok) return json({ ok: false, reason: sent.error, detail: (sent as { detail?: string }).detail });
  return json({ ok: true, link });
});
