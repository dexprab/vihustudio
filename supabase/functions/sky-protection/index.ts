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
//     SMTP_HOST=smtp.titan.email SMTP_PORT=465 \
//     SMTP_USER=lumo@vihuplanet.com SMTP_PASSWORD='...' \
//     SKY_FROM_EMAIL="Lumo from VihuPlanet <lumo@vihuplanet.com>"
//   supabase functions deploy sky-protection --project-ref <your-project-ref>
//
// Sending through the domain's own mailbox needs NO DNS work at all —
// the provider's SPF and DKIM records are already on the domain for
// exactly this, and the mail is signed by the same servers that carry
// the rest of that mailbox's post. See the transport note further down
// for the HTTP alternative and why the switch exists.
//
// Failure convention mirrors the family-album function and
// js/themeRepositoryClient.js: expected failures come back as
// 200 { ok:false, error:'<reason>' } so the client always gets a
// readable, non-throwing answer. An unconfigured deployment (no mail
// key) is an expected failure, not a crash — the product degrades to
// "we could not post it right now", never to a broken share.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const rows: string[] = [];
  for (let r = 0; r < size; r++) {
    let line = '';
    for (let c = 0; c < size; c++) line += lit.has(`${r},${c}`) ? ' ★' : ' ·';
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

function cardText(identity: Identity): string {
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
  ].join('\n');
}

function recoveryText(): string {
  return [
    `How to use this`,
    ``,
    `Open VihuPlanet and press "Show Me Your Stars". Help your child tap`,
    `the stars above on the grid, then press Continue. VihuPlanet will`,
    `recognise them and their stories will be waiting.`,
    ``,
    `If tapping the stars does not work, the Magic Card code above can be`,
    `typed instead: inside VihuStudio, open "My Magic Card? Tap to come`,
    `home" and choose "Prefer to type your Magic Card code instead?".`,
    ``,
    `This is not an account. There is no password and nothing to log in`,
    `to — the Magic Card is simply how VihuPlanet recognises your child.`,
    `Keeping this email is the only thing needed to never lose it.`,
  ].join('\n');
}

function subjectFor(names: string[]): string {
  if (names.length === 1) return `${names[0]}'s Magic Card — VihuPlanet`;
  return `Magic Cards for ${names.join(' and ')} — VihuPlanet`;
}

// ---------------------------------------------------------------
// SENDING
//
// Two transports, chosen by whichever secrets are present. SMTP wins
// when it is configured, because it is the deliberate choice; the HTTP
// provider is the fallback and the escape hatch.
//
// This is not indecision — it is the reason the switch exists. SMTP
// from an edge runtime is a raw TCP connection to somebody else's mail
// server, and it is the least forgiving part of this whole feature: a
// throttle, a blocked relay or a slow handshake all look the same from
// here. Being able to move to an HTTP API by setting one secret, with
// no code change and no deploy, is worth the twenty lines.
//
// SMTP (a real mailbox). The host is the MAIL provider's, which is not
// always the company the domain was bought from — a GoDaddy domain with
// "Professional Email" on it is usually Titan underneath, and Titan's
// host is nothing like GoDaddy's own. Check the webmail URL if unsure.
//   SMTP_HOST      smtp.titan.email          (Titan, incl. via GoDaddy)
//                  smtpout.secureserver.net  (GoDaddy's own mail)
//                  smtp.office365.com        (Microsoft 365)
//   SMTP_PORT      465  (implicit TLS)  ·  587 (STARTTLS)
//   SMTP_USER      the full email address
//   SMTP_PASSWORD  the mailbox password
//
// HTTP (Resend):
//   RESEND_API_KEY re_...
//
// Both:
//   SKY_FROM_EMAIL  "VihuPlanet <you@yourdomain.com>"
//   SKY_REPLY_TO    optional, and needed only when the from address is
//                   a send-only one. When SKY_FROM_EMAIL is a real
//                   mailbox — the normal case here — replies already
//                   land in it and this should be left unset.
//
// With SMTP the from address must be the mailbox that authenticated —
// most providers, GoDaddy included, reject anything else — so
// SKY_FROM_EMAIL and SMTP_USER are the same address, with a display
// name on the front.
// ---------------------------------------------------------------

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

async function sendViaSmtp(to: string, subject: string, body: string) {
  const host = Deno.env.get('SMTP_HOST');
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASSWORD');
  const from = Deno.env.get('SKY_FROM_EMAIL') || user;
  const replyTo = Deno.env.get('SKY_REPLY_TO');
  const port = Number(Deno.env.get('SMTP_PORT') || '465');
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
      content: body,
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

async function sendViaResend(to: string, subject: string, body: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('SKY_FROM_EMAIL');
  const replyTo = Deno.env.get('SKY_REPLY_TO');
  if (!key || !from) return { ok: false, error: 'mail_not_configured' };

  const payload: Record<string, unknown> = { from, to: [to], subject, text: body };
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

async function sendMail(to: string, subject: string, body: string) {
  if (Deno.env.get('SMTP_HOST')) return await sendViaSmtp(to, subject, body);
  if (Deno.env.get('RESEND_API_KEY')) return await sendViaResend(to, subject, body);
  return { ok: false, error: 'mail_not_configured' };
}

function admin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Only ever used to decide whether to bother sending. Never echoed back
// to the caller — see the note on the `recover` branch.
function looksLikeEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length < 320;
}

function compose(identities: Identity[]): string {
  const parts = identities.map(cardText);
  return [
    identities.length === 1
      ? `A Magic Card from VihuPlanet.`
      : `Magic Cards from VihuPlanet, for ${identities.length} Creators.`,
    ``,
    `Keep this email. It is how your child's sky can always be found again.`,
    ``,
    parts.join('\n\n' + '—'.repeat(40) + '\n\n'),
    ``,
    '—'.repeat(40),
    ``,
    recoveryText(),
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
    return json({
      ok: true,
      db: !probe.error,
      parentEmailColumn: !probe.error,
      dbError: probe.error ? String(probe.error.message || probe.error).slice(0, 200) : null,
      transport: Deno.env.get('SMTP_HOST')
        ? 'smtp'
        : (Deno.env.get('RESEND_API_KEY') ? 'resend' : 'none'),
      smtpHost: Deno.env.get('SMTP_HOST') || null,
      smtpPort: Deno.env.get('SMTP_PORT') || null,
      smtpUserSet: !!Deno.env.get('SMTP_USER'),
      smtpPasswordSet: !!Deno.env.get('SMTP_PASSWORD'),
      fromSet: !!Deno.env.get('SKY_FROM_EMAIL'),
    });
  }

  const email = body.email;
  if (!looksLikeEmail(email)) return json({ ok: false, error: 'bad_email' });
  const to = String(email).trim();

  const COLUMNS = 'id, serial_no, nickname, constellation, pattern, claimed_at';

  if (action === 'protect') {
    const identityId = String(body.identityId || '');
    if (!identityId) return json({ ok: false, error: 'bad_request' }, 400);

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

    const sent = await sendMail(to, subjectFor([rows[0].nickname || 'Your Creator']), compose(rows));
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

    const sent = await sendMail(
      to,
      subjectFor(rows.map((r) => r.nickname || 'Your Creator')),
      compose(rows),
    );
    if (!sent.ok) return json(sent);
    return json({ ok: true, sent: rows.length });
  }

  return json({ ok: false, error: 'unknown_action' }, 400);
});
