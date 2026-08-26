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
async function serviceOnly(req: Request) {
  const { guard } = await import('./edgeAuth.js');
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
