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
  // THE NAMING EXCHANGE'S ONE PIECE OF STATE, and it lives no longer
  // than the surface does. What a child CALLS their Companion is kept
  // (js/companionName.js); whether a name is being waited for is not,
  // because a half-finished question is not a relationship setting.
  let _awaiting = false;
  let _lastState = 'idle';
  // THE SUGGESTIONS GO THE MOMENT THE CHILD SPEAKS, not when the first
  // turn lands. Measured: _turns is filled inside ask(), so re-rendering
  // on the press left all four chips up through the whole exchange and
  // pushed the answer below the fold of its own scroll box.
  let _spoke = false;

  // A BRIEF BEAT, NEVER A PRETEND ONE. The deterministic answer arrives
  // in under a millisecond, and a reply that appears in the same frame
  // as the press reads as a glitch rather than as somebody answering.
  // This is the smallest pause that reads as a turn being taken; it is
  // not a "thinking" animation and nothing here waits on a clock to
  // decide what to say.
  const BEAT_MS = 320;
  const SETTLE_MS = 140;

  // ---------------------------------------------------------------
  // THE COMPANION IS HEARD AS WELL AS SEEN
  //
  // The product owner's instruction: "say it out loud should always be
  // on. the companion should always be heard and seen. if creator wants
  // to turn down heard part they can simply mute the say it loud
  // button."
  //
  // So speaking is the DEFAULT and the button is a MUTE rather than a
  // play control. Muting also stops whatever is being said, because
  // "stop talking" and "be quiet" are the same thought to the child
  // pressing it.
  //
  // THE TEXT IS UNAFFECTED, ALWAYS. Muting silences the voice and
  // changes nothing on screen — a child who cannot hear, or who is
  // somewhere they have to be quiet, reads exactly what everybody else
  // reads. Kept per DEVICE rather than per card: it is about the room a
  // child is sitting in, not about who they are.
  const VOICE_KEY = 'vihu.companion.voice';

  function _voiceOn() {
    try { return localStorage.getItem(VOICE_KEY) !== 'off'; }
    catch (e) { return true; }
  }
  function _setVoiceOn(on) {
    try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch (e) {}
    _paintVoiceButton();
  }
  function _paintVoiceButton() {
    if (!_els || !_els.speak) return;
    const on = _voiceOn();
    _els.speak.textContent = on ? '🔊' : '🔇';
    _els.speak.title = on ? 'Mute' : 'Let me be heard';
    _els.speak.setAttribute('aria-label', on ? 'Mute the Companion' : 'Unmute the Companion');
    _els.speak.setAttribute('aria-pressed', on ? 'false' : 'true');
  }

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
  /**
   * The context the browser is allowed to build.
   *
   * FOUR THINGS, AND NOT ONE OF THEM IS A RECORD: who the Companion is
   * (from the active card, the same authority the Studio uses to decide
   * whose portrait is on screen), what this child calls it, whether a
   * name is being waited for, and the turns of this conversation. There
   * is deliberately no `storyContext` and no `memories` — a browser that
   * could supply either could invent either, which is the whole of
   * Sprints 1E.1 and 1F, and a question that needs one is sent to the
   * server instead.
   */
  function _localContext() {
    // THE PERCEPTION LAYER OWNS THIS NOW — Sprint 1N.3.
    //
    // js/companionPerception.js answers "what may this Companion know,
    // on this surface", and it is a whitelist rather than a copy: a
    // field added to a card or a project tomorrow cannot arrive here by
    // being adjacent to one that is already allowed. This file no
    // longer decides; it asks.
    let p = null;
    try {
      if (typeof CompanionPerception !== 'undefined' && CompanionPerception.studio) {
        p = CompanionPerception.studio();
      }
    } catch (e) { p = null; }
    if (!p) return null;
    let called = null;
    try {
      if (typeof CompanionName !== 'undefined' && CompanionName.get) called = CompanionName.get();
    } catch (e) {}
    // The Mind reads the Companion under `personality` and the naming
    // exchange under `naming`; the perception is the source of both, so
    // this is a projection of it rather than a second gathering.
    p.personality = { name: p.companion.name, species: p.companion.species };
    p.naming = { called: called, awaiting: _awaiting };
    p.conversation = _turns.slice();
    return p;
  }

  /**
   * The answer, if this is one of ours. Null means "the server's".
   *
   * The Mind is asked either way — there is ONE taxonomy and it decides
   * what a sentence means. What this function decides is only WHERE the
   * answer may honestly come from, and it reads that off the Mind's own
   * published list rather than keeping a second one.
   */
  function _answerHere(said) {
    let mind = null;
    try { mind = (typeof CompanionMind !== 'undefined') ? CompanionMind : null; } catch (e) {}
    if (!mind || !mind.answer) return null;
    const ctx = _localContext();
    if (!ctx) return null;
    let a = null;
    try { a = mind.answer(said, ctx); } catch (e) { return null; }
    if (!a) return null;
    // THE ACTION IS APPLIED WHATEVER HAPPENS NEXT. A child who asks how
    // many pages there are while a name is being waited for has changed
    // the subject, and the waiting stops even though the answer itself
    // is the server's.
    _applyAction(a.action);
    const local = (mind.LOCAL_INTENTS || []).indexOf(a.intent) !== -1;
    // NOT LOCAL IS NOT NOTHING. The answer is kept either way, so that
    // if the server has nothing to say the honest uncertainty line can
    // still be given rather than a blank — see ask().
    return { reply: a.reply, speak: a.speak, intent: a.intent, local: local };
  }

  function _applyAction(action) {
    if (!action || !action.type) return;
    if (action.type === 'await-name') { _awaiting = true; return; }
    if (action.type === 'stop-await') { _awaiting = false; return; }
    if (action.type === 'tell-fact') {
      // TOLD, NOT REMEMBERED. It goes to the relationship store, which
      // is not js/companionMemory.js and cannot become a Bond Moment.
      try {
        if (typeof CompanionFacts !== 'undefined' && CompanionFacts.tell) {
          CompanionFacts.tell(action.key, action.value);
        }
      } catch (e) {}
      return;
    }
    if (action.type === 'set-name') {
      _awaiting = false;
      try {
        if (typeof CompanionName !== 'undefined' && CompanionName.set) CompanionName.set(action.name);
      } catch (e) {}
      // WHAT THEY CALL IT IS WHAT THE SCREEN CALLS IT, from this moment.
      try { _refreshNames(); } catch (e) {}
    }
  }

  function ask(text) {
    const said = String(text || '').trim().slice(0, MAX_CHARS);
    if (!said) return Promise.resolve({ ok: false, reason: 'empty' });

    const cardId = _cardId();
    if (!cardId) return Promise.resolve({ ok: false, reason: 'no-card' });

    _turns.push({ speaker: 'creator', text: said });
    _turns = _turns.slice(-MAX_TURNS);

    // ---- WHAT THE BROWSER MAY ANSWER FOR ITSELF -------------------
    //
    // The line is js/companionMind.js -> LOCAL_INTENTS, and it is
    // stated there. In short: the SERVER answers what only the RECORDS
    // can prove — the story's name, its length, this page, what the two
    // of them have done together — and nothing about that moved. The
    // BROWSER answers what the CARD already proves and what is a
    // constant sentence, and one thing the server CANNOT answer at all:
    // what this child calls their Companion, which is relationship
    // state with no column behind it.
    //
    // A browser lying to itself about its own card lies only to itself.
    // None of these answers reads a record, so there is nothing of
    // anybody else's to reach.
    const here = _answerHere(said);
    if (here && here.local) {
      if (here.reply) _turns.push({ speaker: 'companion', text: here.reply });
      _turns = _turns.slice(-MAX_TURNS);
      return Promise.resolve({ ok: true, reply: here.reply, speak: here.speak, where: 'local' });
    }

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
        // UNKNOWN IS NEVER SILENCE — Sprint 1N.3.
        //
        // The records are the server's and its answer wins whenever it
        // has one. When it has nothing to say — a question it did not
        // understand, or a deployment that predates the uncertainty
        // ladder — the honest line the Mind already produced here is
        // used instead of a blank. A question a child asked never just
        // disappears.
        // NARROWLY, AND ONLY FOR THE LADDER. The fallback exists to
        // guarantee that an unknown question never disappears — not to
        // second-guess the server. When the server, which holds the
        // records, deliberately says nothing about a STORY, that is its
        // answer and it stands. `unknown` is answered here anyway
        // (LOCAL_INTENTS), so this is a backstop for a deployment whose
        // taxonomy has drifted, and nothing more.
        let reply = body.reply;
        if (!reply && here && here.intent === 'unknown' && here.reply) reply = here.reply;
        if (reply) _turns.push({ speaker: 'companion', text: reply });
        _turns = _turns.slice(-MAX_TURNS);
        return { ok: true, reply: reply, speak: !!body.speak || !!reply };
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
   * DOCKED, NOT FLOATING — restored by the product owner after seeing
   * both: "i liked the docked position in studio better than this
   * always. use docked position in studio home as well in studio."
   *
   * Sprint 1N.3 first anchored the surface to the Companion's own
   * circle, which fixed a real defect (on Studio Home the old pill sat
   * in the garden and ran off the left edge) and introduced a new
   * feeling: a panel that moves about is a thing you have to find. A
   * dock is in the same place every time, on every screen, which is
   * what a five-year-old needs from the way in to a conversation.
   *
   * So it docks at the foot of whichever screen owns the workspace —
   * the editor's own column, or Studio Home's overlay when that is up.
   * Studio Home renders OVER main.preview-area, so a surface mounted
   * into the workspace while it is showing is in the document and
   * behind the screen; the host is asked for rather than assumed, and
   * the surface MOVES when the screen underneath it changes.
   *
   * TAPPING THE COMPANION STILL OPENS IT. That is kept from the
   * floating version — it costs nothing, it is what a child tries
   * first, and it needs no control of its own.
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
    bar.setAttribute('data-state', 'idle');
    bar.innerHTML =
      // THINGS A CHILD COULD SAY, not a menu of what the Companion can
      // do. No category headings, no intent names, nothing that reads
      // as a settings screen — the internal taxonomy stays internal.
      // THE CONTENT SCROLLS; THE FIELD NEVER MOVES. Measured, the band
      // under the page is exactly 218px at 1440x900, 1366x700 and
      // 1280x800 alike — so the surface is capped to fit inside it and
      // whatever it holds scrolls, rather than the surface growing up
      // into the child's own page.
      '<div class="companion-chat-body">' +
      '<div class="companion-chat-starters" hidden>' +
        '<p class="companion-chat-starters-lead"></p>' +
        '<div class="companion-chat-starter-row"></div>' +
      '</div>' +
      '<p class="companion-chat-you" hidden></p>' +
      // NOT announced. Three dots are an animation, and a screen reader
      // reading "…" on every turn is the noise Sprint 1N.2 asked to
      // avoid; the ANSWER is what gets announced, once, below.
      '<p class="companion-chat-dots" aria-hidden="true" hidden><span></span><span></span><span></span></p>' +
      '<p class="companion-chat-said" role="status" aria-live="polite"></p>' +
      // WHAT THE MICROPHONE IS DOING, in words, so a child never has to
      // guess whether it is on. Announced politely, like the answer.
      '<p class="companion-chat-heard" role="status" aria-live="polite" hidden></p>' +
      '</div>' +
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
        '<button class="companion-chat-mic" type="button" title="Talk out loud" ' +
          'aria-label="Talk out loud" hidden>🎤</button>' +
        '<button class="companion-chat-send" type="submit">Say it</button>' +
        '<button class="companion-chat-close" type="button" title="Close" aria-label="Close">✕</button>' +
      '</form>';
    host.appendChild(bar);

    const els = {
      bar: bar,
      said: bar.querySelector('.companion-chat-said'),
      you: bar.querySelector('.companion-chat-you'),
      dots: bar.querySelector('.companion-chat-dots'),
      starters: bar.querySelector('.companion-chat-starters'),
      startersLead: bar.querySelector('.companion-chat-starters-lead'),
      starterRow: bar.querySelector('.companion-chat-starter-row'),
      form: bar.querySelector('.companion-chat-row'),
      input: bar.querySelector('.companion-chat-input'),
      send: bar.querySelector('.companion-chat-send'),
      mic: bar.querySelector('.companion-chat-mic'),
      heard: bar.querySelector('.companion-chat-heard'),
      speak: bar.querySelector('.companion-chat-speak'),
    };
    els.input.setAttribute('aria-label', 'Say something to ' + _name());

    // ---- THE MICROPHONE, AND ONLY IF THERE IS ONE ------------------
    // Offered only where the browser can actually hear, and taken away
    // for good if a child says no once. Never a page listener: this is
    // a button, and pressing it is the only thing that opens anything.
    try {
      if (typeof CompanionListen !== 'undefined' && CompanionListen.supported()) {
        els.mic.hidden = false;
        els.mic.addEventListener('click', function () { _mic(); });
      }
    } catch (e) {}

    // ---- THE VOICE, WHICH IS ON ----------------------------------
    // A SETTING, NOT AN ACTION, so it is there from the moment the
    // surface is: a child can turn the voice off before ever hearing
    // it. Offered only where something could actually speak.
    try {
      if (typeof CompanionSpeak !== 'undefined' && CompanionSpeak.supported()) {
        const sp = document.createElement('button');
        sp.type = 'button';
        sp.className = 'companion-chat-speak';
        sp.addEventListener('click', function () {
          const on = _voiceOn();
          if (on) _aloudStop();          // muting stops what is being said
          _setVoiceOn(!on);
        });
        els.form.insertBefore(sp, els.send);
        els.speak = sp;
        _els = els;              // _paintVoiceButton reads it
        _paintVoiceButton();
      }
    } catch (e) {}

    // ---- THE HANDLERS. RESTORED, AND THE REASON IS RECORDED --------
    //
    // These were lost in an edit and it was not a cosmetic loss: with no
    // `submit` listener the form NAVIGATED, `studio.html` reloaded with
    // no entry pass, Decision 23's gate did its job, and pressing "Say
    // it" threw the child out of the Studio to VihuPlanet. Measured —
    // the URL went from studio.html to index.html on one press.
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      _send();
    });
    bar.querySelector('.companion-chat-close').addEventListener('click', function () { close(); });
    // Escape closes, from the field and from anywhere in the surface.
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    _els = els;
    return els;
  }

  /**
   * WHAT A CHILD CALLS THEIR COMPANION, which is what every child-facing
   * word on this surface uses. The canonical name is unchanged and is
   * what the Companion says when asked who it is — a child choosing to
   * call Leo "Spark" is not a rename of Leo.
   */
  function _name() {
    try {
      if (typeof CompanionName !== 'undefined' && CompanionName.get) {
        const mine = CompanionName.get();
        if (mine) return mine;
      }
    } catch (e) {}
    return _canonicalName();
  }

  function _canonicalName() {
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive) ? MagicCard.getActive() : null;
      return (c && c.companionName) || 'your companion';
    } catch (e) { return 'your companion'; }
  }

  /** The pill, the placeholder and the starters, after a name changes. */
  function _refreshNames() {
    const n = _name();
    try {
      const pill = document.querySelector('.companion-chat-open');
      if (pill) pill.textContent = '💬 Talk to ' + n;
    } catch (e) {}
    if (!_els) return;
    try {
      _els.input.placeholder = 'Say something to ' + n;
      _els.input.setAttribute('aria-label', 'Say something to ' + n);
    } catch (e) {}
    _renderStarters();
  }

  // ---------------------------------------------------------------
  // THINGS A CHILD COULD SAY
  //
  // FOUR AT MOST, AND EVERY ONE OF THEM HAS A REAL ANSWER. A suggestion
  // the Companion would meet with silence teaches a child that talking
  // to it does not work, so each of these is a sentence the
  // deterministic Mind actually classifies.
  //
  // NOTHING HERE IS PERSONALISED THAT IS NOT REAL. The memory
  // suggestion is offered only when a memory exists to answer it —
  // asking "what did we make together?" of a Companion that has nothing
  // is a promise the next second breaks.
  function _starters() {
    // SURFACE-AWARE, because a suggestion the current context cannot
    // answer teaches a child that talking does not work. On Studio Home
    // there is no story, so no story question is offered; in the editor
    // there is, so one is.
    let surface = 'studio-home';
    try {
      if (typeof CompanionPerception !== 'undefined' && CompanionPerception.surfaceNow) {
        surface = CompanionPerception.surfaceNow();
      }
    } catch (e) {}
    const inStory = (surface === 'story-editor') && !!_storyId();
    const list = ['Who are you?'];
    let named = null, toldName = null;
    try {
      if (typeof CompanionName !== 'undefined' && CompanionName.get) named = CompanionName.get();
    } catch (e) {}
    try {
      if (typeof CompanionFacts !== 'undefined' && CompanionFacts.get) toldName = CompanionFacts.get('name');
    } catch (e) {}
    list.push(named ? 'Can I change your name?' : 'Can I give you a name?');
    if (inStory) {
      list.push('What story am I making?');
      list.push(_hasMemory() ? 'What did we make together?' : 'What should happen next?');
    } else {
      // ONLY ONCE THERE IS AN ANSWER. "What's my name?" before a child
      // has told their Companion anything is a question that lands on
      // "you haven't told me yet" — true, but a poor first impression,
      // so it is offered after they have.
      list.push(toldName ? "What's my name?" : 'Where are we?');
      list.push('What can we do?');
    }
    return list;
  }

  function _hasMemory() {
    try {
      if (typeof CompanionMemory === 'undefined' || !CompanionMemory.list) return false;
      const l = CompanionMemory.list({ limit: 1 });
      return Array.isArray(l) && l.length > 0;
    } catch (e) { return false; }
  }

  function _renderStarters() {
    if (!_els) return;
    // THEY GO WHEN THE CONVERSATION STARTS. They are for a child who
    // does not know what to say, and once somebody has said something
    // they are in the way.
    const show = !_spoke && _turns.length === 0;
    _els.starters.hidden = !show;
    if (!show) { _els.starterRow.innerHTML = ''; return; }
    _els.startersLead.textContent = 'Try asking ' + _name() + '…';
    _els.starterRow.innerHTML = '';
    _starters().forEach(function (text) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'companion-chat-starter';
      b.textContent = text;
      // IT FILLS THE FIELD; IT NEVER SENDS. A child can change it, add
      // to it, or leave it alone — which is the whole difference
      // between a suggestion and a command, and it is how a child
      // learns that the field is theirs.
      b.addEventListener('click', function () {
        _els.input.value = text;
        try { _els.input.focus(); } catch (e) {}
        try {
          _els.input.setSelectionRange(text.length, text.length);
        } catch (e) {}
      });
      _els.starterRow.appendChild(b);
    });
  }

  // ---------------------------------------------------------------
  // THE RHYTHM
  //
  //   idle -> sending -> responding -> ready
  //
  // Four named states and nothing invented between them. `sending` is
  // what makes the press feel received; `responding` is the answer
  // arriving; `ready` is the field being the child's again. The pose
  // rides the Director's own event table, so no new pose vocabulary is
  // introduced and a Companion that does not declare one degrades the
  // way it already does.
  // NAMED `_phase`, NOT `_setState`. The conversation's phase is not a
  // Companion pose, and the two must not read as one thing — a suite
  // scanning this file for `setState(` (the Engine's own API, which this
  // file may never call) matched the local helper and reported the
  // surface reaching into the Engine when it does not.
  function _phase(name) {
    _lastState = name;
    if (!_els) return;
    _els.bar.setAttribute('data-state', name);
    _els.dots.hidden = (name !== 'sending');
    _els.send.disabled = (name === 'sending');
    _els.input.disabled = (name === 'sending');
  }

  function _pose(event) {
    try {
      if (typeof CompanionDirector !== 'undefined' && CompanionDirector.notify) {
        CompanionDirector.notify(event);
      }
    } catch (e) {}
  }

  function _send() {
    // R2 — ONE PRESS, ONE TURN. A second press while the first is in
    // flight is not a second question.
    if (_busy) return;
    const els = _build();
    const said = els.input.value.trim();
    if (!said) return;
    _busy = true;
    // THE PRESS IS ACKNOWLEDGED BEFORE ANYTHING ELSE HAPPENS. The
    // child's own words go up, the field empties, and the Companion
    // looks at them — so "did it hear me?" is answered in the same
    // frame as the press rather than at the end of a round trip.
    els.input.value = '';
    els.you.textContent = said;
    els.you.hidden = false;
    els.said.textContent = '';
    _spoke = true;
    // NEITHER OUTLIVES A TURN. A microphone still open would be
    // listening to nobody, and a voice still speaking would be talking
    // over the next answer.
    try { if (typeof CompanionListen !== 'undefined') CompanionListen.stop(); } catch (e) {}
    _micState('stopped');
    _aloudStop();
    _phase('sending');
    _pose('conversation-sending');
    _renderStarters();
    const t0 = Date.now();
    ask(said).then(function (r) {
      // A BEAT, NOT A PERFORMANCE. The deterministic answer is already
      // here; this is the smallest pause that reads as a turn being
      // taken, and it is subtracted rather than added — a slow server
      // answer waits for nothing extra.
      const spent = Date.now() - t0;
      const wait = Math.max(0, BEAT_MS - spent);
      setTimeout(function () {
        _busy = false;
        _lastMs = Date.now() - t0;
        _phase('responding');
        _pose('conversation-answered');
        // SILENCE SHOWS NOTHING. Not an error, not an ellipsis, not a
        // placeholder — an empty reply with speak:false is the
        // Companion choosing to be quiet, and :empty hides the line
        // entirely so there is no hole shaped like a missing answer.
        //
        // A FAILURE IS NOT A SILENCE. The round trip not coming back is
        // a different thing from nothing to say, and leaving a child
        // wondering whether they were heard is the one outcome worth
        // avoiding. One authored line, no status code, no provider, no
        // reason.
        if (r.ok) els.said.textContent = r.reply || '';
        else els.said.textContent = _unheard();
        // AND IT IS SAID OUT LOUD, unless the child has muted it. An
        // empty reply is not spoken — silence is a real answer and
        // there is nothing to say.
        _aloud();
        // THE ANSWER IS WHAT THE CHILD LOOKS AT. The body scrolls, so a
        // long exchange must bring the newest line into view rather than
        // leaving it below the fold of its own box.
        try {
          const body = els.bar.querySelector('.companion-chat-body');
          if (body) body.scrollTop = body.scrollHeight;
        } catch (e) {}
        try { els.input.focus(); } catch (e) {}
        setTimeout(function () { if (_lastState === 'responding') _phase('ready'); }, SETTLE_MS);
      }, wait);
    });
  }

  // ---------------------------------------------------------------
  // TALKING OUT LOUD
  //
  // Two buttons and no listeners anywhere else. The microphone opens on
  // a press and closes on a press, on the answer coming back, and on the
  // conversation closing; the voice speaks a string that is already on
  // screen and stops on all three of the same things.

  function _micState(state) {
    if (!_els) return;
    const on = (state === 'listening');
    _els.bar.setAttribute('data-mic', on ? 'on' : 'off');
    if (_els.mic) {
      _els.mic.setAttribute('aria-pressed', on ? 'true' : 'false');
      _els.mic.textContent = on ? '⏹' : '🎤';
      _els.mic.title = on ? 'Stop listening' : 'Talk out loud';
      _els.mic.setAttribute('aria-label', on ? 'Stop listening' : 'Talk out loud');
    }
    const heard = _els.heard;
    if (!heard) return;
    if (state === 'listening') { heard.textContent = 'Listening…'; heard.hidden = false; return; }
    if (state === 'nothing') {
      // NOT AN ERROR, AND NEVER AN EMPTY SEND. Nothing usable came back,
      // so it says so and the field is the child's again.
      heard.textContent = "I didn't hear that. Try again?";
      heard.hidden = false; return;
    }
    if (state === 'blocked') {
      // ASKED ONCE, REFUSED ONCE, NEVER ASKED AGAIN. No browser error
      // text, and Talk carries on exactly as it was.
      heard.textContent = "I can't hear you right now. You can type instead.";
      heard.hidden = false;
      if (_els.mic) _els.mic.hidden = true;
      return;
    }
    heard.textContent = '';
    heard.hidden = true;
  }

  function _mic() {
    if (typeof CompanionListen === 'undefined') return;
    if (CompanionListen.isListening()) { CompanionListen.stop(); _micState('stopped'); return; }
    // A CHILD'S OWN VOICE STOPS THE COMPANION'S. Two of them at once is
    // the one thing this must not do.
    _aloudStop();
    CompanionListen.start({
      onText: function (words) {
        if (!_els) return;
        // IT LANDS IN THE FIELD AND STOPS THERE. The child reads what
        // was understood, changes it if it is wrong, and presses Say it
        // themselves — down the identical path a typed sentence takes.
        _els.input.value = words;
        try { _els.input.focus(); } catch (e) {}
        try { _els.input.setSelectionRange(words.length, words.length); } catch (e) {}
      },
      onState: function (state) { _micState(state); }
    });
  }

  /**
   * SAY THE ANSWER. Called automatically when one arrives, because the
   * Companion is heard as well as seen; skipped when the child has
   * muted it. Never anything but the string already on screen.
   */
  function _aloud() {
    if (typeof CompanionSpeak === 'undefined' || !_els) return;
    if (!_voiceOn()) return;
    // EXACTLY WHAT IS ON SCREEN. Read off the element the child is
    // looking at, so there is no second copy that could differ from it
    // and no route to anything the privacy layer has not approved.
    const shown = (_els.said.textContent || '').trim();
    if (!shown) return;
    let cid = null;
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive) ? MagicCard.getActive() : null;
      cid = c ? c.companionId : null;
    } catch (e) {}
    if (_els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    CompanionSpeak.say(shown, cid).then(function (spoke) {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      // NOT SPOKEN IS NOT A FAILURE A CHILD MEETS. The answer is on
      // screen and always was; there is no browser voice here to say it
      // with, and saying so every turn would be a nag about something
      // they cannot change.
      _lastSpoke = !!spoke;
    });
  }

  function _aloudStop() {
    try { if (typeof CompanionSpeak !== 'undefined') CompanionSpeak.stop(); } catch (e) {}
    if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
  }

  let _lastSpoke = false;

  function _unheard() {
    try {
      if (typeof CompanionMind !== 'undefined' && CompanionMind.PLATFORM &&
          CompanionMind.PLATFORM.unheard) return CompanionMind.PLATFORM.unheard;
    } catch (e) {}
    return "I didn't catch that. Say it again?";
  }

  let _lastMs = 0;

  function open() {
    const els = _build();
    const host = _host();
    if (host && els.bar.parentElement !== host) host.appendChild(els.bar);
    els.bar.hidden = false;
    _open = true;
    els.said.textContent = '';
    els.you.textContent = '';
    els.you.hidden = true;
    _spoke = false;
    _phase('idle');
    _paintVoiceButton();
    _refreshNames();
    _renderStarters();
    try { els.input.focus(); } catch (e) {}
  }

  function close() {
    if (!_els) return;
    _els.bar.hidden = true;
    _els.input.value = '';
    _els.said.textContent = '';
    _els.you.textContent = '';
    _els.you.hidden = true;
    _open = false;
    _busy = false;
    _phase('idle');
    // THE CONVERSATION GOES WITH IT. Nothing is stored, so closing is
    // the whole of forgetting — the turns, and the question that was
    // half-asked. What a child CALLS their Companion is not part of
    // that: it is a setting they chose, not something they said.
    _turns = [];
    _awaiting = false;
    _spoke = false;
    // A MICROPHONE MUST NEVER OUTLIVE THE SURFACE THAT OPENED IT, and
    // neither may a voice. Both are shut here, and this is the only
    // place either of them needs to be remembered about.
    try { if (typeof CompanionListen !== 'undefined') CompanionListen.stop(); } catch (e) {}
    _aloudStop();
    _micState('stopped');
    if (_els.heard) { _els.heard.textContent = ''; _els.heard.hidden = true; }
  }

  function toggle() { _open ? close() : open(); }

  // ---------------------------------------------------------------
  // THE WAY IN IS THE COMPANION
  //
  // Two ways in, and they are the same way in: tap the Companion, or
  // tap the small label that sits under them. There is no control
  // parked anywhere else — no menu item, no toolbar button, no tile in
  // the Add panel (Decision 22 closed that surface by name, and a tile
  // there would read as "more tools" rather than as somebody to talk
  // to).
  //
  // ONLY FOR A CREATOR. A Traveller has no Companion of their own
  // (Canon 8), so there is nobody for them to speak to and nothing is
  // made. It is also absent while a rite is running: a chapter owns the
  // screen, and Lumo is already speaking.
  function _mountOpener() {
    if (!_cardId()) return;
    // A CHAPTER OWNS THE SCREEN. The one place the way in is never
    // offered — Lumo is already speaking, and the Rite's own band is
    // where a child's attention belongs.
    if (document.body.classList.contains('studio-rite-running')) return;
    const host = _host();
    if (!host) return;
    // ALREADY THERE — but perhaps in the screen the child has just
    // left. Studio Home and the editor are different hosts and the
    // surface is built once, so without this the way in would appear on
    // whichever screen happened to be up first and never again.
    let b = document.querySelector('.companion-chat-open');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'companion-chat-open';
      b.addEventListener('click', function () { toggle(); });
      host.appendChild(b);
    } else if (b.parentElement !== host) {
      host.appendChild(b);
    }
    if (_els && _els.bar && _els.bar.parentElement !== host) host.appendChild(_els.bar);
    b.textContent = '💬 Talk to ' + _name();
  }

  // TAPPING THE COMPANION OPENS IT TOO. js/companionEngine.js already
  // tells the document apart from a tap and a drag — `poke` is a tap
  // that never crossed the drag threshold — so this is a listener on an
  // event that already existed and NOT a change to that file. The
  // docked way in is still there; this is simply the other thing a
  // child tries.
  try {
    document.addEventListener('vihu:companion-gesture', function (e) {
      const g = e && e.detail && e.detail.gesture;
      if (g !== 'poke') return;
      if (!CONVERSATION_OFFERED) return;
      if (!_cardId()) return;
      if (document.body.classList.contains('studio-rite-running')) return;
      toggle();
    });
  } catch (e) {}

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
    state: function () { return _lastState; },
    starters: _starters,
    awaitingName: function () { return _awaiting; },
    mic: _mic,
    aloud: _aloud,
    voiceOn: _voiceOn,
    setVoiceOn: _setVoiceOn,
    spokeLast: function () { return _lastSpoke; },
    displayName: _name,
    canonicalName: _canonicalName,
    BEAT_MS: BEAT_MS,
    CONVERSATION_OFFERED: CONVERSATION_OFFERED,
    MAX_TURNS: MAX_TURNS,
    MAX_CHARS: MAX_CHARS,
  };
  try { window.CompanionChat = api; } catch (e) {}
  return api;
})();
