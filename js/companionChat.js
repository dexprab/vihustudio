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
  // ---------------------------------------------------------------
  // A PROMISE THAT CANNOT SETTLE IS NOT A FAILURE MODE THIS PRODUCT
  // MAY HAVE.
  //
  // `.catch` handles a REJECTION. It does nothing at all for a request
  // that simply never comes back — a captive portal that accepts the
  // connection and answers nothing, a dead link that never resets, a
  // cold start that hangs. The browser's own timeout for that is
  // minutes, and on some paths there is none.
  //
  // Measured consequences before this, all three permanent for the rest
  // of the session:
  //
  //   · `ask()`'s POST hanging left `_busy` true FOREVER, so the child
  //     could never send another message and the dots span on.
  //   · `_config()` caches its promise, so ONE hung fetch of
  //     supabase-config.json silenced the Companion for the whole visit.
  //   · js/vihuVoice.js's `_inflight[key]` is deleted on both settle
  //     paths and on neither non-settle path, so a hung voice request
  //     poisoned that line for good.
  //
  // `_token()` was already capped, by somebody who had met this. These
  // are the rest of them.
  const CONFIG_TIMEOUT_MS = 6000;
  const ASK_TIMEOUT_MS = 12000;

  /**
   * A fetch that always settles, and RELEASES THE SOCKET rather than
   * only giving up on it — an abort rejects the fetch, which the
   * existing `.catch` already reads as unavailable.
   */
  function _fetchBounded(url, init, ms) {
    let ctl = null;
    try { ctl = new AbortController(); } catch (e) { ctl = null; }
    const opts = ctl ? Object.assign({}, init || {}, { signal: ctl.signal }) : (init || {});
    let timer = null;
    const started = fetch(url, opts);
    const capped = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        try { if (ctl) ctl.abort(); } catch (e) {}
        reject(new Error('timeout'));
      }, ms);
    });
    return Promise.race([started, capped]).then(function (r) {
      clearTimeout(timer); return r;
    }, function (e) {
      clearTimeout(timer); throw e;
    });
  }

  /** Whatever happens, an answer. Never a promise left open. */
  function _settled(promise, ms, fallback) {
    return Promise.race([
      Promise.resolve(promise).catch(function () { return fallback; }),
      new Promise(function (resolve) { setTimeout(function () { resolve(fallback); }, ms); })
    ]);
  }

  let _turns = [];
  let _open = false;
  let _busy = false;
  // THE WORDS, WAITING FOR THEIR VOICE — Sprint 3A.1. Set while an
  // answer is being held behind its audio, so every way the wait can end
  // badly (the hold ringing, the voice bell, a failure) reaches the same
  // one function and the child cannot be left looking at a blank panel.
  let _pendingReveal = null;
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

  /**
   * WHICH STORY — and on Studio Home too, which is the gap Step 3E
   * closes. js/companionLive.js falls back to the session slot that
   * Studio Home is already reading to render "You were making
   * something", so a child there can ask what they are making and get
   * an answer. No new state, no new store.
   */
  function _storyId() {
    try {
      if (typeof CompanionLive !== 'undefined' && CompanionLive.story) {
        const s = CompanionLive.story();
        if (s && s.id) return s.id;
      }
    } catch (e) {}
    try {
      return (typeof AppState !== 'undefined' && AppState.project && AppState.project.id) || null;
    } catch (e) { return null; }
  }

  /**
   * WHERE THE CHILD IS STANDING, as locators — never as context. The
   * server decides what any of it means; this only says which screen
   * and how far from UTC. Absent when the module is not loaded, and the
   * turn works exactly as it did before.
   */
  function _live() {
    try {
      if (typeof CompanionLive === 'undefined' || !CompanionLive.locators) return {};
      const l = CompanionLive.locators();
      const out = {};
      if (l.surface) out.surface = l.surface;
      if (typeof l.utcOffsetMinutes === 'number') out.utcOffsetMinutes = l.utcOffsetMinutes;
      return out;
    } catch (e) { return {}; }
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
    // A FAILURE IS NOT REMEMBERED. The promise is cached so the file is
    // read once, and caching a `null` would mean one bad moment — a
    // refresh mid-flight, a network blink — silencing the Companion for
    // the rest of the visit. It is forgotten on failure so the next
    // turn tries again; it is a small local file and the browser has it.
    _cfgPromise = _fetchBounded(CONFIG_URL, { cache: 'no-store' }, CONFIG_TIMEOUT_MS)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { return (cfg && cfg.url && cfg.anonKey) ? cfg : null; })
      .catch(function () { return null; })
      .then(function (cfg) { if (!cfg) _cfgPromise = null; return cfg; });
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
    // WHAT THE TWO OF THEM ARE TALKING ABOUT. The conversation layer
    // holds the thread now, so the Mind is TOLD it rather than working
    // it out again from the turns — two readings of the same thing is
    // two things that can disagree, and they did: the Mind asked
    // "which one?" about a dragon the conversation layer was holding.
    try {
      if (typeof CompanionConversation !== 'undefined') {
        const th = (CompanionConversation.state() || {}).thread;
        if (th && th.subject) p.thread = { subject: th.subject };
      }
    } catch (e) {}
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
  // ---------------------------------------------------------------
  // WHO OWNS THIS TURN — Sprint 1N.4
  //
  // THE MIND GETS FIRST REFUSAL, ALWAYS. It is what knows the stars are
  // never told, that a Creator's private things stay private, that a
  // judgement is refused and an injection changes no authority — and
  // its rules are ORDERED so those come before anything else. A
  // conversational reading that could reach around them would be a way
  // round every boundary in this product.
  //
  // So js/companionConversation.js is offered a turn only where the
  // Mind has classified it `unknown`: the ordinary middle of a child's
  // sentence, which used to fall on the floor. Everything the Mind
  // recognises is still answered by the Mind, unchanged.
  function _conversationOwns(said, ctx, mind) {
    try {
      if (typeof CompanionConversation === 'undefined') return null;
      if (!mind || !mind.classify) return null;
      // FIRST REFUSAL. Anything with a name in the taxonomy is the
      // Mind's, and this layer does not get to see it.
      if (mind.classify(said, 'creator') !== 'unknown') return null;
      return CompanionConversation.consider(said, ctx);
    } catch (e) { return null; }
  }

  /** The Mind, or nothing. One place to ask, so no caller re-derives it. */
  function mindOf() {
    try { return (typeof CompanionMind !== 'undefined') ? CompanionMind : {}; }
    catch (e) { return {}; }
  }

  function _answerHere(said) {
    let mind = null;
    try { mind = (typeof CompanionMind !== 'undefined') ? CompanionMind : null; } catch (e) {}
    if (!mind || !mind.answer) return null;
    const ctx = _localContext();
    if (!ctx) return null;

    const conv = _conversationOwns(said, ctx, mind);
    if (conv && conv.reply) {
      return { reply: conv.reply, speak: conv.speak, intent: 'conversation', local: true };
    }

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
    return { reply: a.reply, speak: a.speak, intent: a.intent,
             certainty: a.certainty, local: local };
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

  // ---------------------------------------------------------------
  // DOES THIS COMPANION HAVE A REAL MIND? — Step 3B.
  //
  // The browser has to know, because it decides whether an unknown
  // question is answered here or carried to the model. It asks the
  // function's own GET probe, which has reported `modelCompanions` since
  // Step 3A: ids only, no key, no organisation, nothing an attacker
  // learns anything from — the same rule every other field on that probe
  // follows.
  //
  // ONCE PER SESSION, and it costs a child nothing: it is fired when the
  // surface OPENS, so by the time anybody has finished typing it is
  // already here. A model-routed question waits for it because that
  // question is making a round trip anyway; every local answer — every
  // boundary, every refusal — is unchanged and still instant.
  //
  // UNREADABLE MEANS NO. A probe that fails, times out or answers
  // something unexpected leaves the Companion exactly as it was before
  // this sprint: honest local uncertainty, with no network needed. The
  // one place this codebase fails closed is a privacy gate; this is not
  // one, and failing closed here would mean a child whose network
  // blinked losing the deterministic answer as well.
  const PROBE_TIMEOUT_MS = 5000;
  let _probe = null;

  function _mindProbe() {
    if (_probe) return _probe;
    _probe = Promise.all([_config(), _token()]).then(function (both) {
      const cfg = both[0], token = both[1];
      if (!cfg || !cfg.url || !token) return null;
      return _fetchBounded(cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN, {
        headers: { Authorization: 'Bearer ' + token, apikey: cfg.anonKey },
      }, PROBE_TIMEOUT_MS)
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (b) {
          return (b && b.ok && Array.isArray(b.modelCompanions)) ? b.modelCompanions : null;
        })
        .catch(function () { return null; });
    }).catch(function () { return null; })
      .then(function (list) {
        // A FAILURE IS NOT REMEMBERED. Caching a null would cost the
        // whole session for one blink of the network — the same lesson
        // Decision 49 records for the config cache.
        if (list === null) _probe = null;
        return list;
      });
    return _probe;
  }

  /** Has THIS Companion got one? Never "is a model configured". */
  function _hasRealMind() {
    const cid = _companionId();
    if (!cid) return Promise.resolve(false);
    return _mindProbe().then(function (list) {
      return !!list && list.indexOf(String(cid).toLowerCase()) !== -1;
    });
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
    const answerLocally = function () {
      if (here.reply) _turns.push({ speaker: 'companion', text: here.reply });
      _turns = _turns.slice(-MAX_TURNS);
      _observe(said, here.reply, { intent: here.intent, certainty: here.certainty });
      return { ok: true, reply: here.reply, speak: here.speak, where: 'local' };
    };
    if (here && here.local) {
      // A REAL MIND OUTRANKS THE HONEST SHRUG — Step 3B. Two intents
      // only (js/companionMind.js -> MODEL_ROUTED): a question nobody
      // could answer, and a question about the world outside. Every
      // other local answer is a boundary or a card fact and is returned
      // here exactly as it always was.
      const routed = (mindOf().MODEL_ROUTED || []).indexOf(here.intent) !== -1;
      if (!routed) return Promise.resolve(answerLocally());
      return _hasRealMind().then(function (yes) {
        if (!yes) return answerLocally();
        return _remote(said, here);
      }, function () { return answerLocally(); });
    }

    return _remote(said, here);
  }

  /** The server's turn — it holds the records, and now the world too. */
  function _remote(said, here) {
    const cardId = _cardId();
    return Promise.all([_config(), _token()]).then(function (both) {
      const cfg = both[0], token = both[1];
      if (!cfg || !cfg.url) return { ok: false, reason: 'unavailable' };
      if (!token) return { ok: false, reason: 'unavailable' };
      return _fetchBounded(cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN, {
        method: 'POST',
        headers: {
          // The SESSION, not the anon key — Sprint 1A's rule. `apikey`
          // stays the anon key because Supabase's gateway routes on it.
          Authorization: 'Bearer ' + token,
          apikey: cfg.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(Object.assign({
          cardId: cardId,
          storyId: _storyId(),
          pageId: _pageId(),
          conversation: _turns,
        }, _live())),
      }, ASK_TIMEOUT_MS).then(function (r) {
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
        // EVERY TURN IS SEEN, whoever answered it. A story fact comes
        // from the server, and the thread a child is holding must
        // survive one — otherwise asking how many pages there are would
        // forget the dragon.
        _observe(said, reply);
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
      // AND A WORD FOR IT — Sprint 3A.1 §2/§18. The dots say "something
      // is happening"; they cannot say WHICH something, and thinking and
      // getting ready to speak are different things to be told. Still
      // aria-hidden: it is a state indicator, not the answer, and the
      // bar carries aria-busy for anyone listening rather than looking.
      '<p class="companion-chat-dots" aria-hidden="true" hidden>' +
        '<em class="companion-chat-wait"></em>' +
        '<span></span><span></span><span></span></p>' +
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
      wait: bar.querySelector('.companion-chat-wait'),
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
  // WAITING FOR AN ANSWER, AND WAITING FOR ITS VOICE, ARE DIFFERENT
  // THINGS TO BE TOLD — Sprint 1N.6.
  //
  // The dots mean "still deciding". Once the words are on screen the
  // child is not waiting to find out WHAT their Companion said, only to
  // hear it, so the dots go and a quieter mark takes over. Keeping the
  // dots up through the voice fetch told a child their Companion had
  // not made its mind up when it plainly had.
  // SPRINT 3A.1 — `voice-preparing` JOINED BOTH LISTS, and that is the
  // whole shape of the change. It used to happen AFTER the words were
  // up, so the dots were rightly down and the field was rightly the
  // child's again. It now happens BEFORE them: the child is still
  // waiting, so the indicator is still up and the field is still held.
  // The WORDS change, because a Companion that has decided what to say
  // is not thinking any more (§5).
  const THINKS = ['sending', 'thinking', 'voice-preparing'];
  const HOLDS = ['sending', 'received', 'thinking', 'voice-preparing'];
  // THE FIELD IS HELD ONLY WHILE THERE IS NO ANSWER, and that is
  // unchanged — it is simply that "no answer yet" now lasts until the
  // words are on screen. Once they are, the child may say the next
  // thing even mid-sentence: §21 lists a new turn as a thing that
  // cancels the old audio, which only means anything if a new turn can
  // begin while one is being spoken. Decision 50 chose this and the
  // voice is not a queue a child has to wait out.
  const WAIT_WORDS = { thinking: 'is thinking', 'voice-preparing': 'is getting ready' };

  function _phase(name) {
    _lastState = name;
    if (!_els) return;
    _els.bar.setAttribute('data-state', name);
    _els.dots.hidden = (THINKS.indexOf(name) === -1);
    if (_els.wait) _els.wait.textContent = WAIT_WORDS[name] ? (_name() + ' ' + WAIT_WORDS[name]) : '';
    // NOT a running commentary. One attribute a screen reader can use to
    // know the panel is working on something, instead of an announcement
    // per transition — §32.
    try { _els.said.setAttribute('aria-busy', HOLDS.indexOf(name) !== -1 ? 'true' : 'false'); } catch (e) {}
    _els.send.disabled = (HOLDS.indexOf(name) !== -1);
    _els.input.disabled = (HOLDS.indexOf(name) !== -1);
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
    _pose('conversation-sending');
    _renderStarters();
    const t0 = Date.now();
    // ---- THE TURN'S OWN RHYTHM — Sprint 1N.6 --------------------
    //
    // js/companionTurn.js decides WHICH of the six things is true and
    // when to give up on each; this decides what that looks like. The
    // machine is shared with the Ether so a rhythm cannot be fixed on
    // one surface and left broken on the other.
    // NO ORPHANS — §21. A new turn replaces the old one whole: its
    // machine, its audio and the answer it was still holding. Without
    // this, a reveal from an abandoned turn could paint the previous
    // answer over the one being asked for now.
    if (_turn) _turn.cancel();
    _pendingReveal = null;
    const turn = _turn = _newTurn(els);
    turn.send();
    // AND THE SURFACE CANNOT STICK, WHATEVER ask() DOES. Every promise
    // inside it is bounded, and this is the floor under all of them: if
    // a future change adds one that is not, the child still gets their
    // turn back rather than a field they can never send from again.
    // `_busy` staying true is the failure this exists to make
    // impossible.
    _settled(ask(said), ASK_TIMEOUT_MS + 2000, { ok: false, reason: 'unavailable' })
      .then(function (r) {
      // A BEAT, NOT A PERFORMANCE. The deterministic answer is already
      // here; this is the smallest pause that reads as a turn being
      // taken, and it is subtracted rather than added — a slow server
      // answer waits for nothing extra.
      if (turn !== _turn) return;   // a newer turn owns the surface
      const spent = Date.now() - t0;
      // THE BEAT IS FOR AN ANSWER THAT ARRIVED IN NO TIME AT ALL, and
      // for nothing else. Decision 47: a reply that lands in under a
      // frame reads as a glitch rather than as a turn being taken. It
      // is SUBTRACTED — a slow answer waits for nothing extra — and the
      // moment the machine has shown a thinking state instead, the hold
      // it asks for replaces this one rather than stacking on it.
      const held = turn.answered();
      const wait = held > 0 ? held : Math.max(0, BEAT_MS - spent);
      const words = r.ok ? (r.reply || '') : _unheard();
      setTimeout(function () {
        if (turn !== _turn) return;
        _lastMs = Date.now() - t0;
        _present(turn, els, words);
      }, wait);
    });
  }

  // ---------------------------------------------------------------
  // ONE CONVERSATIONAL EVENT — Sprint 3A.1 §1/§6.
  //
  // The first real model turn was: words appear, two or three seconds of
  // nothing, then Leo speaks. A child does not read that as a fast
  // answer with a slow voice — they read it as their Companion writing
  // something and then refusing to say it.
  //
  // So the words are HELD behind their own voice, and released the
  // instant the audio is in hand. Nothing is delayed to achieve that:
  // the hold ends when the sound is ready, or when HOLD_MS says the
  // child has waited long enough, whichever comes first.
  //
  // NOTHING IS EVER LOST TO IT. There are four ways out and every one of
  // them puts the words on screen: the audio arrives, the hold rings,
  // the voice fails, or there was never going to be one.

  function _present(turn, els, words) {
    const cid = _companionId();
    const willSpeak = _willSpeakText(words);
    if (!willSpeak) { _reveal(turn, els, words, null); return; }
    // THE FACE CARRIES THE WHOLE WAIT. The Director holds a scripted
    // pose only briefly and this wait can outlast it, so it is
    // re-asserted rather than letting the Companion look finished while
    // it is about to speak.
    _pose('conversation-speaking');
    let out = false;
    const go = function (play, stillComing) {
      if (out || turn !== _turn) return;
      out = true;
      _pendingReveal = null;
      _reveal(turn, els, words, play, stillComing);
    };
    // THE ACCESSIBILITY EXCEPTION, WITH TEETH — §7. A voice that is
    // slow, unreachable or simply having a bad day must never cost a
    // child the answer they already have a right to.
    // THE TURN IS NOT OVER WHEN THE HOLD RINGS. The words go up, but a
    // voice is still coming, so the Companion must not be told to look
    // finished — measured: `conversation-answered` fired here dropped
    // the face to idle and it was still idle while Leo was speaking.
    _pendingReveal = function () { go(null, true); };
    turn.preparingVoice(_pendingReveal);
    CompanionSpeak.ready(words, cid, {
      onSpeaking: function () { if (turn === _turn) turn.speakingNow(); }
    }).then(function (play) {
      if (turn !== _turn) return;
      turn.voiceReady();
      // THE HOLD ALREADY RANG AND THE WORDS ARE UP. The voice is still
      // the same answer, so it is said rather than thrown away — this is
      // the degraded case this sprint exists to make rare, not a second
      // failure to add on top of a slow one.
      if (out) {
        // The hold rang first. Either the voice joins late, or it was
        // never coming — and in the second case the turn ends HERE,
        // rather than waiting on a bell three and a half seconds away
        // with the Companion's face frozen mid-thought.
        if (play) _sayLate(turn, play);
        else { _pose('conversation-answered'); if (turn === _turn) { turn.done(); _phase('ready'); } }
        return;
      }
      go(play);
    }, function () { go(null); });
  }

  /** The words go up, and their sound starts in the same task. */
  function _reveal(turn, els, words, play, stillComing) {
    _busy = false;
    _pendingReveal = null;
    els.said.textContent = words;
    turn.shown();
    _phase('response-ready');
    // SILENCE SHOWS NOTHING. Not an error, not an ellipsis, not a
    // placeholder — an empty reply with speak:false is the Companion
    // choosing to be quiet, and :empty hides the line entirely so there
    // is no hole shaped like a missing answer. A FAILURE IS NOT A
    // SILENCE: the round trip not coming back gets one authored line,
    // with no status code, no provider and no reason.
    //
    // THE ANSWER IS WHAT THE CHILD LOOKS AT. The body scrolls, so a long
    // exchange must bring the newest line into view rather than leaving
    // it below the fold of its own box.
    try {
      const body = els.bar.querySelector('.companion-chat-body');
      if (body) body.scrollTop = body.scrollHeight;
    } catch (e) {}
    try { els.input.focus(); } catch (e) {}
    if (!play) {
      // ONLY IF NOTHING IS STILL COMING. `conversation-answered` is what
      // tells the Companion the turn is finished, and saying so while
      // its voice is still being fetched is the pose bug above.
      if (stillComing) return;
      _pose('conversation-answered');
      setTimeout(function () {
        if (turn !== _turn) return;
        if (_lastState === 'response-ready') { _phase('ready'); turn.done(); }
      }, SETTLE_MS);
      return;
    }
    // THE SAME TASK. The words are in the DOM one statement above and
    // the sound starts here, so the distance between them is a function
    // call rather than a round trip. Nothing is delayed to line them
    // up — §6 asks for as close to zero as practical, and this is what
    // practical means without inventing a wait.
    // AND THE FACE IS RE-ASSERTED AS THE SOUND STARTS. The Director
    // holds a scripted pose only briefly so an ambient reaction cannot
    // overwrite it (Decision 29) — and this sprint made the wait LONGER
    // than that hold, because the words are now held behind the audio.
    // Measured: the pose was right through thinking and preparing and
    // had dropped to idle by the time the Companion actually spoke.
    // ONE POSE CARRIES THE WHOLE TURN, so it is re-asserted here rather
    // than left to expire in the middle of one.
    _pose('conversation-speaking');
    if (_els && _els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    play().then(function (spoke) {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      _lastSpoke = !!spoke;
      if (turn !== _turn) return;
      turn.done();
      _phase('ready');
      _pose('conversation-answered');
    });
  }

  /**
   * The hold rang first and the words went up without their voice. It
   * still says them — it is the same answer, and cutting it would be a
   * second failure stacked on a slow one — but the turn is already the
   * child's again, so nothing is locked and nothing waits on it.
   */
  function _sayLate(turn, play) {
    // IT IS STILL THE COMPANION SPEAKING, so it still looks like it.
    _pose('conversation-speaking');
    if (_els && _els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    play().then(function (spoke) {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      _lastSpoke = !!spoke;
      _pose('conversation-answered');
      if (turn === _turn) { turn.done(); if (_lastState !== 'idle') _phase('ready'); }
    });
  }

  /**
   * A turn's machine, wired to this surface.
   *
   * NOTHING HERE INVENTS A WAIT. Every state is entered because
   * something actually happened or because a bell rang, and every bell
   * ends the state rather than extending it.
   */
  function _newTurn(els) {
    return CompanionTurn.create({
      onState: function (name) {
        if (['sending', 'received', 'thinking', 'response-ready',
             'voice-preparing', 'speaking'].indexOf(name) !== -1) _phase(name);
      },
      onGiveUp: function (kind) {
        if (kind === 'answer') {
          // THINKING NEVER LASTS FOR EVER. One authored line, no status
          // code and no provider — and the field is the child's again.
          if (els && els.said && !els.said.textContent) els.said.textContent = _unheard();
          _busy = false;
          _phase('ready');
          _pose('conversation-answered');
          return;
        }
        // A VOICE THAT NEVER ARRIVED COSTS THE CHILD NOTHING — and
        // since Sprint 3A.1 that means REVEALING THE ANSWER, not just
        // ending quietly: the words may still be held behind it. The
        // hold's own bell rings first in every ordinary case; this is
        // the floor under it.
        if (_pendingReveal) { const r = _pendingReveal; _pendingReveal = null; try { r(); } catch (e) {} }
        _aloudStop();
        _phase('ready');
        _pose('conversation-answered');
      }
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
   * Whose voice. Read from the active card and never from anywhere the
   * caller could have chosen — the same authority the placeholder uses.
   */
  function _companionId() {
    try {
      const c = (typeof MagicCard !== 'undefined' && MagicCard.getActive) ? MagicCard.getActive() : null;
      return c ? c.companionId : null;
    } catch (e) { return null; }
  }

  /**
   * Is a voice going to follow this answer?
   *
   * SPRINT 3A.1 — IT TAKES THE WORDS RATHER THAN READING THE SCREEN.
   * It used to ask what was in `.companion-chat-said`, which was fine
   * while the answer was painted first and spoken second. Now the answer
   * is held BEHIND its voice, so at the moment this has to decide there
   * is nothing on screen to read and the old form would have said no,
   * every time, for every turn.
   */
  function _willSpeakText(words) {
    try {
      if (typeof CompanionSpeak === 'undefined') return false;
      if (!_voiceOn()) return false;
      if (!String(words || '').trim()) return false;
      return CompanionSpeak.supported();
    } catch (e) { return false; }
  }

  /**
   * Say what is already on screen. Sprint 3A.1 took this off the turn's
   * own path — a turn now prepares its voice BEFORE revealing its words
   * — and it is kept for the one caller that legitimately speaks
   * something already displayed: the mute button being switched back on.
   */
  function _aloud(turn) {
    if (typeof CompanionSpeak === 'undefined' || !_els) return;
    if (!_voiceOn()) return;
    // EXACTLY WHAT IS ON SCREEN. Read off the element the child is
    // looking at, so there is no second copy that could differ from it
    // and no route to anything the privacy layer has not approved.
    const shown = (_els.said.textContent || '').trim();
    if (!shown) return;
    const cid = _companionId();
    if (_els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    const mine = turn && turn === _turn ? turn : null;
    _pose('conversation-speaking');
    CompanionSpeak.say(shown, cid, {
      onSpeaking: function () { if (mine && mine === _turn) mine.speakingNow(); }
    }).then(function (spoke) {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      if (mine && mine === _turn) { mine.done(); _phase('ready'); }
      _pose('conversation-answered');
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
  let _turn = null;

  function _observe(said, reply, meta) {
    try {
      if (typeof CompanionConversation !== 'undefined') {
        // THE MIND'S OWN DIAGNOSTICS TRAVEL WITH THE TURN — Sprint
        // 1N.5. `certainty` already says which answers were refusals,
        // so the conversation layer can hold a boundary through a bare
        // follow-up without keeping a second list that could disagree
        // with the taxonomy. Absent for a server answer, which is
        // correct: the server answers facts, never boundaries.
        CompanionConversation.observe(said, reply, meta || null);
      }
    } catch (e) {}
  }

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
    // NO BELL FROM AN ABANDONED TURN. Cancelling first means a timer
    // that was already in flight cannot repaint a closed surface or
    // start a voice for a conversation nobody is having (§15, §G).
    if (_turn) { _turn.cancel(); _turn = null; }
    _pendingReveal = null;
    _phase('idle');
    // THE CONVERSATION GOES WITH IT. Nothing is stored, so closing is
    // the whole of forgetting — the turns, and the question that was
    // half-asked. What a child CALLS their Companion is not part of
    // that: it is a setting they chose, not something they said.
    _turns = [];
    _awaiting = false;
    _spoke = false;
    // THE CONVERSATION STATE GOES WITH THE CONVERSATION. It is not a
    // memory and must not behave like one: closing forgets the thread,
    // the pending question and the window, exactly as it forgets the
    // turns.
    try {
      if (typeof CompanionConversation !== 'undefined') CompanionConversation.reset();
    } catch (e) {}
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
    // WHERE THE TIME WENT — Sprint 3A.1 §8. Numbers and nothing else:
    // no question, no answer, no Companion, no card. Never persisted,
    // never sent anywhere, and it dies with the turn.
    marks: function () { return _turn ? _turn.marks() : null; },
    displayName: _name,
    canonicalName: _canonicalName,
    BEAT_MS: BEAT_MS,
    // PUBLISHED SO A SUITE CAN WAIT EXACTLY AS LONG AS THE PRODUCT
    // DOES, rather than guessing — and so "a hung request always comes
    // back" is a number somebody can read rather than a claim.
    ASK_TIMEOUT_MS: ASK_TIMEOUT_MS,
    // The turn's own thresholds, so a suite waits exactly as long as the
    // product does rather than guessing at it.
    turnState: function () { return _turn ? _turn.state() : 'idle'; },
    CONFIG_TIMEOUT_MS: CONFIG_TIMEOUT_MS,
    CONVERSATION_OFFERED: CONVERSATION_OFFERED,
    MAX_TURNS: MAX_TURNS,
    MAX_CHARS: MAX_CHARS,
  };
  try { window.CompanionChat = api; } catch (e) {}
  return api;
})();
