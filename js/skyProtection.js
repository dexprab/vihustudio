// skyProtection.js — Protect Your Sky.
//
// Children recognise themselves through their Magic Card. Parents
// protect the Magic Card. That sentence is the entire design, and the
// thing it rules out is as important as the thing it allows:
//
//   The parent email is NOT the child's account.
//   Nothing signs in with it. It is never an identity, never a
//   password, never a profile and never a login. It is the safe place
//   the Magic Card is kept, and that is all it will ever be.
//
// The Magic Card remains the primary identity inside VihuPlanet. This
// module only makes sure a copy of it exists somewhere a child cannot
// lose.
//
// ---------------------------------------------------------------
// WHEN IT IS ASKED FOR, AND WHEN IT IS NOT
//
// Only before a story joins VihuPlanet. Making a story needs no email.
// Finishing a story needs no email. Every artifact — the book, the PDF,
// the Magic Creation, the images — is produced and handed over with
// nothing asked for at all, because none of those leaves the child's
// own device and none of them can be lost by losing a card.
//
// Sharing is different, and only sharing: a story that joins the Ether
// is reachable through the Magic Card and through nothing else, so the
// moment before that is the honest moment to make sure the card cannot
// be lost. It is asked once, it can always be skipped, and skipping
// never blocks anything.
// ---------------------------------------------------------------
//
// The email itself is sent by supabase/functions/sky-protection — the
// browser cannot send mail, and a Magic Card is not something to hand
// to a third-party form. An unconfigured or unreachable deployment is a
// normal, handled state everywhere in this file: the child still shares
// their story.

const SkyProtection = (function () {
  'use strict';

  var FN_NAME = 'sky-protection';

  // Remembered per browser so a child is never asked twice, and so
  // recovery on this device needs no typing at all. It is a copy of
  // what the platform holds, not the record of it.
  var EMAIL_KEY = 'vihu-sky-parent-email';
  var SKIPPED_KEY = 'vihu-sky-protection-skipped';
  // Set when an address is taken but the card could not be posted yet
  // (there was no card), cleared the moment one is successfully sent.
  // catchUp() acts ONLY on this, which is what keeps it from mailing a
  // second identical copy to a child who already had a card when they
  // gave the address — protect() has already sent that one.
  var PENDING_KEY = 'vihu-sky-protection-pending';

  var CONFIG_URL = (function () {
    var el = document.currentScript;
    return el ? new URL('../supabase-config.json', el.src).href : 'supabase-config.json';
  })();

  var _cfgPromise = null;
  function _config() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { return (cfg && cfg.url && cfg.anonKey) ? cfg : null; })
      .catch(function () { return null; });
    return _cfgPromise;
  }

  // ---------- what this browser remembers ----------

  function parentEmail() {
    try { return localStorage.getItem(EMAIL_KEY) || null; } catch (e) { return null; }
  }

  function _rememberEmail(email) {
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
    try { localStorage.removeItem(SKIPPED_KEY); } catch (e) {}
  }

  function _markPending() {
    try { localStorage.setItem(PENDING_KEY, '1'); } catch (e) {}
  }
  function _clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
  }
  function _isPending() {
    try { return localStorage.getItem(PENDING_KEY) === '1'; } catch (e) { return false; }
  }

  function hasProtection() { return !!parentEmail(); }

  function markSkipped() {
    try { localStorage.setItem(SKIPPED_KEY, '1'); } catch (e) {}
  }

  function wasSkipped() {
    try { return localStorage.getItem(SKIPPED_KEY) === '1'; } catch (e) { return false; }
  }

  // ---------- the address ----------
  //
  // Checked only well enough to catch a typo before a child is told
  // their card is safe when it is not. It is never verified, because
  // verifying it would be the first step of building the account this
  // sprint exists not to build.
  function looksLikeEmail(v) {
    var s = String(v || '').trim();
    return s.length > 4 && s.length < 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  // ---------- sending ----------

  // The child is told one gentle thing when this fails, and that is
  // right — "I could not reach them just now" is all a child needs and
  // all a child should get. It is NOT enough for whoever has to fix it:
  // five different things produce that one sentence (no config, no
  // network, a missing column, an unknown card, a mail server saying
  // no), and they are indistinguishable from the outside.
  //
  // So the reason is written to the console, where a child never looks
  // and a grown-up always can. Never to the screen.
  function _note(action, res, status) {
    try {
      if (res && res.ok) return;
      console.warn('[SkyProtection] ' + action + ' failed —',
        (res && res.error) || 'no_answer',
        status ? '(HTTP ' + status + ')' : '',
        (res && res.detail) || '');
    } catch (e) {}
  }

  // THE SESSION, NOT THE ANON KEY (Sprint 1A, CLAUDE.md -> Decision 30).
  //
  // The function now proves the caller owns the Magic Card it is being
  // asked to post, and it can only do that if it knows who called. The
  // browser already holds a real anonymous Supabase session — the same
  // one whose auth.uid() owns this card's row in the first place — so
  // sending its access token is the whole change here. Nothing a child
  // sees, nothing new to sign into.
  function _token() {
    try {
      if (typeof ThemeRepositoryClient === 'undefined' || !ThemeRepositoryClient.getSession) {
        return Promise.resolve(null);
      }
      return ThemeRepositoryClient.getSession()
        .then(function (s) { return (s && s.access_token) ? s.access_token : null; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function _call(payload) {
    return Promise.all([_config(), _token()]).then(function (both) {
      var cfg = both[0], token = both[1];
      if (!cfg) {
        var missing = { ok: false, error: 'not_configured' };
        _note(payload.action, missing);
        return missing;
      }
      // No session, no call. Reported as the same handled state every
      // other unreachable-platform case already is, so the child still
      // shares their story and VihuPlanet never claims a sky is safe
      // when it is not (Decision 14).
      if (!token) {
        var noSession = { ok: false, error: 'not_configured' };
        _note(payload.action, noSession);
        return noSession;
      }
      var url = cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN_NAME;
      var status = 0;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': cfg.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(function (r) {
        status = r.status;
        // A gateway that refuses the call, or a worker that dies mid
        // boot, does not always answer in JSON. Falling back to the
        // raw text keeps the reason readable instead of turning every
        // one of those into the same 'unreachable'.
        return r.text().then(function (t) {
          try { return JSON.parse(t); }
          catch (e) { return { ok: false, error: 'bad_answer', detail: t.slice(0, 300) }; }
        });
      }).then(function (res) {
        _note(payload.action, res, status);
        return res;
      }).catch(function (e) {
        var res = { ok: false, error: 'unreachable', detail: String(e).slice(0, 300) };
        _note(payload.action, res, status);
        return res;
      });
    }).catch(function () { return { ok: false, error: 'unreachable' }; });
  }

  function _activeCardId() {
    try {
      var card = (typeof MagicCard !== 'undefined') && MagicCard.getActive();
      return (card && card.id) || null;
    } catch (e) { return null; }
  }

  // Post this Creator's Magic Card to that address, and remember the
  // address so nobody is asked again.
  //
  // A child who has not claimed a Magic Card YET is a real case and not
  // an error: Canon 6 puts the Creator Ceremony after sharing, so on a
  // first share the card does not exist at the moment this is asked.
  // The address is remembered now and the card is posted the moment
  // there is one — see catchUp(). Telling a child their sky is safe
  // before it is would be the one thing this feature must not do, so
  // the wording for that case is its own.
  function protect(email) {
    if (!looksLikeEmail(email)) {
      return Promise.resolve({ ok: false, error: 'bad_email' });
    }
    var to = String(email).trim();
    var id = _activeCardId();
    _rememberEmail(to);

    if (!id) { _markPending(); return Promise.resolve({ ok: true, pending: true, sent: 0 }); }
    // Still pending until the send actually succeeds — an unreachable
    // or unconfigured deployment must leave the card waiting to be
    // posted, not silently drop it.
    _markPending();
    return _call({ action: 'protect', identityId: id, email: to })
      .then(function (res) {
        if (res && res.ok) { _clearPending(); return { ok: true, sent: res.sent || 1 }; }
        return res || { ok: false };
      });
  }

  // Send the latest card again, to the address already known. Used
  // where the brief says no interaction is required: a returning child
  // whose parent is already protecting them, and a child who has lost
  // their card on a device that still remembers them.
  function resend() {
    var to = parentEmail();
    if (!to) return Promise.resolve({ ok: false, error: 'no_email' });
    var id = _activeCardId();
    if (!id) return recoverByEmail(to);
    return _call({ action: 'protect', identityId: id, email: to });
  }

  // The new-device case, where this browser knows nothing at all. The
  // only thing a child can offer is their parent's address, and the
  // only thing that happens is an email to that address — nothing comes
  // back here. Controlling the inbox IS the check, which is exactly
  // right for something that is not an account, and it is also why the
  // answer is identical whether or not that address protects anything.
  //
  // One address may protect several children; this sends every sky it
  // protects, each one named.
  function recoverByEmail(email) {
    if (!looksLikeEmail(email)) return Promise.resolve({ ok: false, error: 'bad_email' });
    var to = String(email).trim();
    return _call({ action: 'recover', email: to }).then(function (res) {
      if (res && res.ok) _rememberEmail(to);
      return res || { ok: false };
    });
  }

  // Called when a Magic Card is minted, for the child who gave an
  // address before they had one. Silent, and safe to call always: with
  // no stored address it does nothing.
  function catchUp() {
    var to = parentEmail();
    var id = _activeCardId();
    if (!to || !id) return Promise.resolve({ ok: false, error: 'nothing_to_do' });
    // Only when a card is genuinely still owed. Without this, a child
    // who already HAD a card when they gave the address gets the same
    // Magic Card twice — protect() sent it, and this would send it
    // again the moment anything called catchUp().
    if (!_isPending()) return Promise.resolve({ ok: false, error: 'nothing_to_do' });
    return _call({ action: 'protect', identityId: id, email: to })
      .then(function (res) {
        if (res && res.ok) _clearPending();
        return res;
      });
  }

  // Deployment check, from the console, sending nothing:
  //   SkyProtection.ping().then(console.log)
  // Answers which of the layers is the one that is wrong — the config
  // file, the function, the database column, or the mail secrets.
  function ping() { return _call({ action: 'ping' }); }

  var api = {
    ping: ping,
    parentEmail: parentEmail,
    hasProtection: hasProtection,
    wasSkipped: wasSkipped,
    markSkipped: markSkipped,
    looksLikeEmail: looksLikeEmail,
    protect: protect,
    resend: resend,
    recoverByEmail: recoverByEmail,
    catchUp: catchUp
  };
  try { window.SkyProtection = api; } catch (e) {}
  return api;
})();
