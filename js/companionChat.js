// js/companionChat.js — a Creator talking to their Companion.
//
// Sprint 1F. The first real conversation, and the smallest surface that
// can carry one.
//
// ---------------------------------------------------------------
// THE STORY STAYS PRIMARY
//
// This is not a chat panel. A chat panel is a product that happens to
// have a story behind it, and Decision 24's attention hierarchy —
// story → story content → interactive elements → Companion → UI —
// forbids it in as many words.
//
// So: one small line at the foot of the workspace, a single field, and
// the Companion's answer shown once and then let go. It covers nothing,
// it remembers nothing, and Escape closes it. A child who never opens
// it never meets it.
//
// ---------------------------------------------------------------
// THE BROWSER IS A LOCATOR
//
// This file sends four things: which card, which story, which page, and
// what was just said. It does NOT send the canon, the personality, the
// memories, the story's name or the page's prose — every one of those is
// read server-side from VihuPlanet's own records, because a client that
// could describe a page could describe one that says something else
// (Sprint 1F), and a client that could supply memories could invent them
// (Sprint 1E.1).
//
// ---------------------------------------------------------------
// NOTHING IS PERSISTED
//
// The turns live in a variable for as long as the surface is open, and
// go when it closes. No storage, no memory write, no history sent on the
// next visit. Turning a conversation into a memory is Sprint 1G's, and
// this file must not leave a place for it.
//
// It also touches no Companion runtime file: companionEngine,
// companionBrain, companionDirector and companionContext are unchanged,
// no pose is set, and no voice is played. `speak` comes back and is
// deliberately ignored.
const CompanionChat = (function () {
  'use strict';

  const FN = 'companion-chat';
  const MAX_TURNS = 12;          // matches the server's own window
  const MAX_CHARS = 600;
  const TOKEN_WAIT_MS = 1200;    // js/vihuVoice.js's own bounded wait

  let _turns = [];
  let _open = false;
  let _busy = false;
  let _els = null;

  // ---------------------------------------------------------------
  // WHO AND WHERE — locators only.

  function _cardId() {
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive) ? MagicCard.getActive() : null;
      return (c && c.id) || null;
    } catch (e) { return null; }
  }

  function _storyId() {
    try {
      return (typeof AppState !== 'undefined' && AppState.project && AppState.project.id) || null;
    } catch (e) { return null; }
  }

  function _pageId() {
    try {
      return (typeof AppState !== 'undefined' && typeof AppState.currentSlide === 'number')
        ? AppState.currentSlide : 0;
    } catch (e) { return 0; }
  }

  // ---------------------------------------------------------------
  // THE PLATFORM

  // The same file js/vihuVoice.js reads, the same way. It carries the
  // project url and the anon key — the key that routes a request to
  // this project and authorises nothing (Sprint 1A).
  const CONFIG_URL = 'supabase-config.json';
  let _cfgPromise = null;
  function _config() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { return (cfg && cfg.url && cfg.anonKey) ? cfg : null; })
      .catch(function () { return null; });
    return _cfgPromise;
  }

  function _token() {
    try {
      if (typeof ThemeRepositoryClient === 'undefined' || !ThemeRepositoryClient.getSession) return Promise.resolve(null);
      const session = ThemeRepositoryClient.getSession()
        .then(function (s) { return (s && s.access_token) ? s.access_token : null; })
        .catch(function () { return null; });
      const capped = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, TOKEN_WAIT_MS); });
      return Promise.race([session, capped]);
    } catch (e) { return Promise.resolve(null); }
  }

  /**
   * @returns {Promise<{ok:boolean, reply?:string, speak?:boolean, reason?:string}>}
   *   A failure of any kind — no platform, no session, the function
   *   refusing, the provider unreachable — comes back as {ok:false} and
   *   the surface simply says nothing. A child never meets a status
   *   code, which is Canon 5's own rule for the Companion's voice.
   */
  function ask(text) {
    const said = String(text || '').trim().slice(0, MAX_CHARS);
    if (!said) return Promise.resolve({ ok: false, reason: 'empty' });

    const cardId = _cardId();
    if (!cardId) return Promise.resolve({ ok: false, reason: 'no-card' });

    _turns.push({ speaker: 'creator', text: said });
    _turns = _turns.slice(-MAX_TURNS);

    return Promise.all([_config(), _token()]).then(function (both) {
      const cfg = both[0], token = both[1];
      if (!cfg || !cfg.url) return { ok: false, reason: 'unavailable' };
      if (!token) return { ok: false, reason: 'unavailable' };
      return fetch(cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN, {
        method: 'POST',
        headers: {
          // The SESSION, not the anon key — Sprint 1A's rule. `apikey`
          // stays the anon key because Supabase's gateway routes on it.
          Authorization: 'Bearer ' + token,
          apikey: cfg.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: cardId,
          storyId: _storyId(),
          pageId: _pageId(),
          conversation: _turns,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return null; });
      }).then(function (body) {
        if (!body || !body.ok || typeof body.reply !== 'string') {
          return { ok: false, reason: 'unavailable' };
        }
        // SILENCE IS A SUCCESS. An empty reply with speak:false is the
        // Companion choosing not to say anything, and it must not be
        // dressed up as a failure or filled with something friendly.
        if (body.reply) _turns.push({ speaker: 'companion', text: body.reply });
        _turns = _turns.slice(-MAX_TURNS);
        return { ok: true, reply: body.reply, speak: !!body.speak };
      }).catch(function () { return { ok: false, reason: 'unavailable' }; });
    });
  }

  // ---------------------------------------------------------------
  // THE SURFACE
  //
  // Built once, lazily, and only in the Studio. It is a strip, not a
  // window: one row, at the foot of the workspace, above nothing.

  /**
   * WHICHEVER SCREEN OWNS THE WORKSPACE RIGHT NOW.
   *
   * Studio Home renders as a full-screen overlay ON TOP of
   * main.preview-area, so a surface mounted into the workspace while it
   * is up is in the document and behind the screen. Measured: a query
   * happily reported "💬 Talk to Leo" while the screenshot showed
   * nothing at all. Present and unusable is worse than absent, so the
   * host is asked for rather than assumed — and the surface MOVES when
   * the screen underneath it changes.
   */
  function _host() {
    if (document.body.classList.contains('creation-flow-active')) {
      const overlay = document.querySelector('.creation-flow-overlay');
      if (overlay) return overlay;
    }
    return document.querySelector('main.preview-area');
  }

  function _build() {
    if (_els) return _els;
    const host = _host() || document.body;

    const bar = document.createElement('div');
    bar.className = 'companion-chat';
    bar.hidden = true;
    bar.innerHTML =
      '<p class="companion-chat-said" aria-live="polite"></p>' +
      '<form class="companion-chat-row">' +
        '<input class="companion-chat-input" type="text" maxlength="' + MAX_CHARS + '" ' +
          // NOT a hard-coded name. This was 'Say something to Leafy',
          // the one place in the whole runtime where a single Companion
          // was written into the product — found in Sprint 1K.1 while
          // proving the Presence architecture is Companion-aware. A
          // Creator bonded to Leo would have been asked to say
          // something to somebody else's Companion until open() reset
          // it. _name() reads the active card, which is the only
          // authority for who this is.
          'autocomplete="off" placeholder="Say something to ' + _name() + '">' +
        '<button class="companion-chat-send" type="submit">Say it</button>' +
        '<button class="companion-chat-close" type="button" title="Close">✕</button>' +
      '</form>';
    host.appendChild(bar);

    const els = {
      bar: bar,
      said: bar.querySelector('.companion-chat-said'),
      form: bar.querySelector('.companion-chat-row'),
      input: bar.querySelector('.companion-chat-input'),
      send: bar.querySelector('.companion-chat-send'),
    };

    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      _send();
    });
    bar.querySelector('.companion-chat-close').addEventListener('click', function () { close(); });
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    _els = els;
    return els;
  }

  function _name() {
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive) ? MagicCard.getActive() : null;
      return (c && c.companionName) || 'your companion';
    } catch (e) { return 'your companion'; }
  }

  function _send() {
    if (_busy) return;
    const els = _build();
    const said = els.input.value.trim();
    if (!said) return;
    _busy = true;
    els.input.value = '';
    els.send.disabled = true;
    // No spinner and no "thinking…" — this sprint measures latency
    // rather than decorating it, and a loading state is a UX decision
    // that has not been taken yet.
    els.said.textContent = '';
    const t0 = Date.now();
    ask(said).then(function (r) {
      _busy = false;
      els.send.disabled = false;
      _lastMs = Date.now() - t0;
      // NOTHING IS SHOWN WHEN THERE IS NOTHING TO SAY. Not an error,
      // not an ellipsis, not "…". A Companion is allowed to be quiet.
      els.said.textContent = (r.ok && r.reply) ? r.reply : '';
      try { els.input.focus(); } catch (e) {}
    });
  }

  let _lastMs = 0;

  function open() {
    const els = _build();
    const host = _host();
    if (host && els.bar.parentElement !== host) host.appendChild(els.bar);
    els.bar.hidden = false;
    _open = true;
    els.said.textContent = '';
    els.input.placeholder = 'Say something to ' + _name();
    try { els.input.focus(); } catch (e) {}
  }

  function close() {
    if (!_els) return;
    _els.bar.hidden = true;
    _els.input.value = '';
    _els.said.textContent = '';
    _open = false;
    // THE CONVERSATION GOES WITH IT. Nothing is stored, so closing is
    // the whole of forgetting.
    _turns = [];
  }

  function toggle() { _open ? close() : open(); }

  // ---------------------------------------------------------------
  // THE WAY IN
  //
  // One small pill at the foot of the workspace. It is the whole of the
  // entry: no menu item, no toolbar button, no tile in the Add panel —
  // Decision 22 closed that surface by name, and a tile there would read
  // as "more tools" rather than as somebody to talk to.
  //
  // ONLY FOR A CREATOR. A Traveller has no Companion of their own
  // (Canon 8), so there is nobody for them to speak to and the pill is
  // never made. It is also hidden while a rite is running: a chapter
  // owns the screen, and Lumo is already speaking.
  function _mountOpener() {
    if (!_cardId()) return;
    // A CHAPTER OWNS THE SCREEN. The one place the way in is never
    // offered — Lumo is already speaking, and the Rite's own band is
    // where a child's attention belongs.
    if (document.body.classList.contains('studio-rite-running')) return;
    const host = _host();
    if (!host) return;
    // ALREADY THERE — but perhaps in the screen the child has just
    // left. Studio Home and the editor are different hosts, and the
    // Companion is mounted once, so without this the pill would appear
    // on whichever screen happened to be up first and never again.
    const existing = document.querySelector('.companion-chat-open');
    if (existing) {
      if (existing.parentElement !== host) {
        host.appendChild(existing);
        if (_els && _els.bar) host.appendChild(_els.bar);
      }
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'companion-chat-open';
    b.textContent = '💬 Talk to ' + _name();
    b.addEventListener('click', function () { toggle(); });
    host.appendChild(b);
    if (_els && _els.bar && _els.bar.parentElement !== host) host.appendChild(_els.bar);
  }

  const CONVERSATION_OFFERED = true;

  /**
   * Put the way in on screen. Respects CONVERSATION_OFFERED, so that
   * constant is the ONE place that decides whether the Studio offers a
   * conversation — before this, anything calling mount() got the pill
   * whatever the constant said, which made it a suggestion rather than
   * a switch.
   */
  function mount() {
    if (!CONVERSATION_OFFERED) return;
    try { _mountOpener(); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // THE STUDIO OFFERS IT NOW — Sprint 1N.1, Step 4.
  //
  // Sprint 1K switched this OFF, and was right to: Decision 36 built the
  // surface and Decision 34 left both production gates shut, so a child
  // pressing "Talk to Leafy" met silence. That silence was correct and
  // the door was not — a door that is always silent is worse than no
  // door, and it was the one thing in the Studio claiming conversational
  // intelligence already existed when it did not.
  //
  // A reply can come back now. Sprint 1N built the deterministic
  // Companion Mind (Decision 46) and 1N.1 walked it through the real
  // Studio for all four Companions; the product owner deployed
  // companion-chat and set COMPANION_MIND_ENABLED on the server, and
  // this is the last of the four steps in
  // supabase/DEPLOY_companion_mind.md.
  //
  // THE ORDER MATTERED, AND IT WAS MEASURED. With that server flag
  // unset a Creator request does not fall through to silence — it falls
  // into the synthetic FIXTURE branch and the mock answers from an
  // invented story, so a child would be told about a story they never
  // made. That is why the flag went first and this constant went last,
  // and it is why this line is worth nothing on its own.
  //
  // STILL NOT A PROBE AND NOT A FETCH. Whether the server has the Mind
  // switched on is a question only the server can answer, and asking it
  // on every Studio boot would be a network call for every child to pay
  // for a fact that changes once. It stays a constant, and the function's
  // own GET probe is where a developer asks (Step 3 of the runbook).
  if (CONVERSATION_OFFERED) {
    // Rides the pulse the Studio already fires on every page mutation —
    // the same seam js/companionMemoryEvents.js uses. No polling, and no
    // existing Studio file changed to make this appear.
    try {
      if (typeof PageRuntime !== 'undefined' && PageRuntime.observe) {
        PageRuntime.observe(function () { mount(); });
      }
    } catch (e) {}
    try { if (document.readyState !== 'loading') setTimeout(mount, 0); }
    catch (e) {}
  }

  const api = {
    ask: ask,
    open: open,
    close: close,
    toggle: toggle,
    mount: mount,
    isOpen: function () { return _open; },
    turns: function () { return _turns.slice(); },
    lastMs: function () { return _lastMs; },
    CONVERSATION_OFFERED: CONVERSATION_OFFERED,
    MAX_TURNS: MAX_TURNS,
    MAX_CHARS: MAX_CHARS,
  };
  try { window.CompanionChat = api; } catch (e) {}
  return api;
})();
