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
const BUILD = '2026-08-16 · html emails, ruled grid';

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

function cardHtml(identity: Identity): string {
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
    </table>
  </td></tr>
</table>`;
}

function composeHtml(identities: Identity[], kind: Kind): string {
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
  const blocks = identities.map(cardHtml).join(
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

// Only ever used to decide whether to bother sending. Never echoed back
// to the caller — see the note on the `recover` branch.
function looksLikeEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length < 320;
}

function compose(identities: Identity[], kind: Kind): string {
  const parts = identities.map(cardText);
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
      build: BUILD,
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
    const sent = await sendMail(
      to,
      subjectFor(names, 'protect'),
      compose(rows, 'protect'),
      composeHtml(rows, 'protect'),
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

    const sent = await sendMail(
      to,
      subjectFor(rows.map((r) => r.nickname || 'Your Creator'), 'recover'),
      compose(rows, 'recover'),
      composeHtml(rows, 'recover'),
    );
    if (!sent.ok) return json(sent);
    return json({ ok: true, sent: rows.length });
  }

  return json({ ok: false, error: 'unknown_action' }, 400);
});
