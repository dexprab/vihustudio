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

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Bump whenever the letter itself changes — an Edge Function runs the
// copy uploaded to the project, not the file in the repository, and
// there is no CI here that deploys it. `{"action":"ping"}` answers
// which build is actually live.
const BUILD = '2026-08-23 · first letter';

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
  return 'Somebody left a door open on VihuPlanet';
}

function textFor(link: string, note: string): string {
  const lines = [
    'Hello.',
    '',
    'I am Lumo. I look after a place called VihuPlanet.',
    '',
    'It is a quiet universe where children make stories — their own',
    'words, their own drawings, their own handwriting — and, if they',
    'want to, let those stories drift out into the sky where other',
    'children can find them.',
    '',
    'There is no account to make and nothing to pay. A child follows a',
    'little story, makes some choices, changes something, and by the',
    'end they have made something that was not there before.',
    '',
    'If that sounds like someone in your house, the door is here:',
    '',
    link,
    '',
  ];
  if (note) {
    lines.push(note, '');
  }
  lines.push(
    'Best to open it on a laptop — stories are made the wide way.',
    '',
    'Lumo',
    'Guardian of Story Companions, VihuPlanet',
  );
  return lines.join('\n');
}

function htmlFor(link: string, note: string): string {
  const noteBlock = note
    ? `<p style="margin:0 0 18px;padding:12px 14px;background:#1d3457;border-left:3px solid #e8b871;
         color:#f1ead0;font-style:italic">${esc(note)}</p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#101d33;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#101d33;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#1d3457;border-radius:10px;overflow:hidden;
                    font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <tr><td style="padding:30px 30px 6px;text-align:center;">
          <div style="font-size:34px;line-height:1">✦</div>
          <h1 style="margin:10px 0 0;font:400 27px/1.2 Georgia,serif;color:#ffe9b8;">
            VihuPlanet
          </h1>
          <p style="margin:6px 0 0;color:#8792af;font-size:13px;">
            a place where children's stories live
          </p>
        </td></tr>

        <tr><td style="padding:22px 30px 4px;color:#e7eaf3;font-size:15px;line-height:1.65;">
          <p style="margin:0 0 14px;">Hello.</p>
          <p style="margin:0 0 14px;">
            I am <strong style="color:#ffe9b8;">Lumo</strong>. I look after a place called
            VihuPlanet.
          </p>
          <p style="margin:0 0 14px;">
            It is a quiet universe where children make stories — their own words, their own
            drawings, their own handwriting — and, if they want to, let those stories drift
            out into the sky where other children can find them.
          </p>
          <p style="margin:0 0 20px;">
            There is no account to make and nothing to pay. A child follows a little story,
            makes some choices, changes something, and by the end they have made something
            that was not there before.
          </p>
          ${noteBlock}
        </td></tr>

        <tr><td style="padding:2px 30px 26px;text-align:center;">
          <a href="${esc(link)}"
             style="display:inline-block;padding:13px 30px;border-radius:999px;
                    background:#e8b871;color:#22314c;font-weight:700;font-size:15px;
                    text-decoration:none;">Open the door</a>
          <p style="margin:14px 0 0;color:#8792af;font-size:12px;line-height:1.5;">
            Best on a laptop — stories are made the wide way.
          </p>
        </td></tr>

        <tr><td style="padding:16px 30px 26px;border-top:1px solid #33507e;
                       color:#8792af;font-size:12px;line-height:1.6;">
          <p style="margin:0 0 4px;color:#c6cbda;">Lumo</p>
          <p style="margin:0;">Guardian of Story Companions, VihuPlanet</p>
          <p style="margin:12px 0 0;word-break:break-all;">
            If the button does not work: <span style="color:#c6cbda;">${esc(link)}</span>
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
