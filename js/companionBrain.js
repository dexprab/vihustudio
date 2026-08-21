// js/companionBrain.js — Companion Intelligence, Phase 1: NOTICING.
//
// Situation + event -> an INTENT. Deterministic rules only; there is no
// model here, no network call, no provider, and nothing in this file
// knows one could ever exist. docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md
// §2.4 (the intent object), §4 (C1/C2/C3/C7 — every capability below
// needs no AI at all) and §6.3 (restraint).
//
// ---------- The one thing this file is really about ----------
// "The most likely failure mode is not a wrong answer — it is a
// Companion that won't stop talking." (§6.3.) A Companion that comments
// on everything stops being company and becomes a notification system,
// and the product's own canon forbids exactly that:
// docs/COMPANION_CANON.md — "a companion is not an assistant, a chatbot,
// a teacher, or an AI tutor."
//
// So SILENCE IS THE DEFAULT AND SPEECH MUST BE EARNED. Every rule below
// returns {} unless it has something true, specific and useful to say,
// and four hard limits sit above all of them:
//
//   1. Traveller silence is absolute, and it is a GATE AT THE TOP
//      rather than a filter at the end. The Story Egg never speaks
//      (Companion Canon V2; MODES.traveller.speaks:false). A Traveller
//      tick returns {} before a single rule is evaluated.
//   2. Cooldown — nothing is said within COOLDOWN_MS of the last thing
//      said, including lines the Director itself spoke. The Director
//      reports those through noteSpoken(), so the two cannot talk over
//      each other.
//   3. Novelty — a given rule speaks AT MOST ONCE per session. There is
//      no "did you know" that comes back. This, not a line counter, is
//      what bounds how much a Companion ever says: the rule set is
//      finite, so the session is too.
//   4. Settling — nothing at all is said in the first SETTLE_MS. A
//      child who has just opened their story is looking at their story.
//
// ---------- Where the words come from ----------
// Platform lines live here, authored, in the same spirit as
// js/companionDirector.js's own MESSAGES table. A Companion Package may
// override any of them by shipping a `lines` map in its personality.json,
// which keeps "add a companion" a zero-code act (§5, knowledge tiers:
// Package overrides Platform). Nothing needs authoring for a new
// companion to work — it simply speaks in the platform's voice until
// somebody gives it its own.
//
// personality.json's `neverSays` list has been described since the first
// Companion sprint as "authored policy data for a future AI-driven
// speech feature to respect, disclosed as currently inert." It is no
// longer inert: every line this Brain proposes is checked against it,
// and a line containing a forbidden phrase is dropped rather than
// softened. A dropped line is silence, which is always a safe answer.
const CompanionBrain=(function(){

  const COOLDOWN_MS=45000;   // between any two spoken lines
  const SETTLE_MS=15000;     // quiet on arrival

  // ---------- Moving of its own accord ----------
  // A creature with a place it likes to be, that sometimes goes
  // somewhere else. The restraint here is different in kind from the
  // restraint on speech: a line INTERRUPTS and must be earned, while a
  // move at the far edge of a child's vision costs them nothing — but a
  // thing that keeps moving while you are trying to work is the most
  // distracting object on a screen. So it moves rarely, never while
  // anything is happening, and never twice in quick succession.
  const ROAM_GAP_MS=45000;   // at least this long between two moves
  const ROAM_QUIET_MS=12000; // and only after this long with nothing happening
  const ROAM_CHANCE=0.5;     // and even then, only sometimes
  const ROAM_STYLES=['glide','roll','drift'];

  // ---------- Platform lines ----------
  // Written to the house rules: never blames, never says "error",
  // "wrong", "invalid" or "you can't", never names a control, never
  // instructs. A Companion observes; it does not teach. Compare
  // js/publishValidator.js's own header — these are the same nudges in
  // a friend's voice rather than a checklist's.
  const LINES={
    // C2 — noticing absence. Keyed by the validator's own fixHint, so
    // a new validator rule arrives here by its hint and nothing has to
    // be kept in step by hand.
    'book-title':"Your story doesn't have a name yet.",
    'add-cover':"There's no cover on your story yet.",
    'empty-page':"There's a page waiting with nothing on it yet.",

    // C3 — guardrail explanation. The single most useful true thing a
    // Companion can say in this Studio, because the child has just
    // discovered a limit and nothing else on screen explains it.
    'world-fixed':"That one belongs to this world — it likes to stay where it is.",
    'world-moveable':"That one belongs to this world, but you can move it wherever you like.",

    // C7 — contextual encouragement. Tied to something real that just
    // happened, never a generic compliment on a timer.
    'growing':"Your story is getting longer.",
    'full-page':"There's a lot happening on this page."
  };

  // ---------- PLAY ----------
  // Three things a child DOES to the Companion, and they are a
  // different kind of event from everything else in this file. The
  // rules above are the Companion volunteering something; these are a
  // child poking a creature and waiting to see what it does. So the
  // restraint that exists to stop it nagging does not apply: play is
  // ANSWERED, every time, as often as they like.
  //
  // What still applies is not talking over itself — each gesture has a
  // short gap of its own, and a spoken line still starts the shared
  // clock so the Companion does not giggle and then immediately
  // volunteer something about the story.
  //
  // Three gestures, three feelings, stated by the product owner:
  // "poking is clicking, tickling is hovering over it. both different
  // action warrants different feelings."
  const PLAY={
    // Hovering. Being tickled: helpless giggling.
    tickle:{
      gap:6000,
      pose:['happy','celebrate','wave','curious'],
      emotion:'happy',
      lines:[
        "Hee hee! That tickles!",
        "Ooh, stop… no, don't stop!",
        "Hee! Not there, that's my giggly bit.",
        "You found my ticklish spot!",
        "Hehe — I'm very ticklish, you know."
      ]
    },
    // Clicking. Being poked: startled, then delighted.
    poke:{
      gap:1500,
      pose:['surprised','celebrate','curious','wave'],
      emotion:'surprised',
      lines:[
        "Oi! You poked me!",
        "Boop! Right back at you.",
        "Hey — I felt that!",
        "Poke me again. Go on, I dare you.",
        "Ooh! You're quick."
      ]
    },
    // Dragging. Being carried somewhere new.
    carry:{
      gap:1200,
      pose:['wave','happy','celebrate','curious'],
      emotion:'happy',
      lines:[
        "Whooooosh!",
        "Here I go!",
        "Where do you want me?",
        "Wheee! Put me down here?",
        "Flying! Look at me go."
      ]
    }
  };

  let _lines=LINES;
  let _play=PLAY;
  let _never=[];

  // ---------- Restraint state ----------
  // Session-scoped and deliberately in memory only: a Companion that
  // remembered across days would need a store, a card scope and a
  // migration, and would still be wrong the first time a child came
  // back to a story they had changed. Persistent memory is explicitly
  // out of scope (§Explicitly out of scope).
  let _lastSpokeAt=0;
  let _startedAt=0;
  const _said={};
  // Per-gesture: when it last answered, and which line it used — so the
  // same one never lands twice running. A child who hears the identical
  // giggle twice has learned it is a recording, which is the same rule
  // the World Host's greetings already follow.
  const _playAt={};
  const _playLast={};
  let _roamedAt=0;
  let _stirredAt=0;      // the last time ANYTHING happened
  let _roamLast=null;

  function _now(){ try{ return Date.now(); }catch(e){ return 0; } }

  function _quiet(){
    const now=_now();
    if(!_startedAt) _startedAt=now;
    if((now-_startedAt)<SETTLE_MS) return true;
    if(_lastSpokeAt && (now-_lastSpokeAt)<COOLDOWN_MS) return true;
    return false;
  }

  // The loaded package's own policy, applied identically to a noticed
  // line and a giggle: a forbidden phrase means the line is not said.
  function _forbidden(t){
    for(let i=0;i<_never.length;i++){
      const bad=String(_never[i]||'').toLowerCase();
      if(bad && String(t).toLowerCase().indexOf(bad)!==-1) return true;
    }
    return false;
  }

  function _line(key){
    const t=_lines[key];
    if(!t) return null;
    // The package's own policy, finally enforced. A forbidden phrase
    // means the line is not said at all — never rewritten, because
    // rewriting somebody's authored policy line is how a voice drifts.
    if(_forbidden(t)) return null;
    return t;
  }

  // A rule speaks by calling this. It returns {} — silence — if the
  // rule has already had its turn this session, so a rule never has to
  // remember whether it has fired.
  function _say(source,key,pose){
    if(_said[source]) return {};
    const text=_line(key);
    if(!text) return {};
    _said[source]=true;
    // Start the cooldown here rather than trusting the caller to report
    // back. The Director does call noteSpoken(), but a Brain whose
    // restraint depends on somebody else remembering to tell it the
    // time is not restrained — it is lucky.
    _lastSpokeAt=_now();
    return {say:text, pose:pose||'curious', source:'rule:'+source, confidence:1};
  }

  // ---------- Rules ----------
  // Ordered by how immediate they are to the child: something they just
  // touched beats something about the story as a whole. Exactly one
  // rule may speak per tick — the first that has anything to say.

  // C3 — the child selected a World-owned object. They have just met a
  // guardrail; this is the only moment where explaining one is an
  // answer to a question they actually asked.
  function _guardrail(s){
    const sel=s.selection;
    if(!sel || sel.owner!=='world') return {};
    if(sel.editable) return {};           // nothing has limited them yet
    return sel.moveable
      ? _say('world-moveable','world-moveable','curious')
      : _say('world-fixed','world-fixed','curious');
  }

  // C2 — the story itself is missing something, in the validator's own
  // judgement. Only ever the FIRST notice, and only ever once: a
  // Companion reading out a list is a checklist with a face.
  function _absence(s){
    if(!s.notices || !s.notices.length) return {};
    // A child on their very first page has not "forgotten" a cover or a
    // name — they have simply not got there yet, and saying so would be
    // the nagging this whole file exists to prevent.
    if(s.pages<2) return {};
    for(let i=0;i<s.notices.length;i++){
      const n=s.notices[i];
      if(!n||!n.fixHint) continue;
      const out=_say('notice-'+n.fixHint,n.fixHint,'think');
      if(out.say) return out;
    }
    return {};
  }

  // C7 — something real just grew. Tied to the story's own size, not to
  // a timer, so it can only ever land just after the child did it.
  function _encourage(s,event){
    if(event==='page-added' && s.pages>=3) return _say('growing','growing','celebrate');
    if(s.objects && s.objects.total>=8) return _say('full-page','full-page','celebrate');
    return {};
  }

  // C1 — situational reaction. Pose only, never speech: the Companion
  // simply looks like it is watching what is happening. This is the
  // cheapest capability in the whole architecture and probably the one
  // a child feels most, and it costs nothing — no words, no cooldown,
  // no risk of interrupting anybody.
  function _react(s,event){
    if(event==='page-added') return {pose:'celebrate',source:'react:page-added',confidence:1};
    if(s.selection) return {pose:'curious',source:'react:selection',confidence:1};
    if(s.objects && s.objects.total>0) return {pose:'think',source:'react:working',confidence:1};
    return {};
  }

  /**
   * A child played with the Companion. Answered as often as they like:
   * novelty and the settling window deliberately do NOT apply, because
   * this is a reply to something they just did rather than the
   * Companion deciding to speak.
   *
   * A Traveller gets the movement and no words — the Story Egg
   * accompanies through animation only and never speaks
   * (docs/COMPANION_CANON.md), which is the same canon the top of
   * decide() enforces, applied to the same effect here.
   *
   * @param {string} gesture 'tickle' | 'poke' | 'carry'
   * @param {object} [opts] {mode:'creator'|'traveller'}
   * @returns {object} An intent, or {} if this gesture answered a
   *   moment ago.
   */
  function play(gesture,opts){
    try{
      const cfg=_play[gesture];
      if(!cfg) return {};
      const now=_now();
      _stirredAt=now;         // a child is right there; do not wander off
      if(_playAt[gesture] && (now-_playAt[gesture])<cfg.gap) return {};
      _playAt[gesture]=now;

      const intent={ poseChain:cfg.pose.slice(), source:'play:'+gesture, confidence:1 };

      const mode=(opts&&opts.mode)||'creator';
      if(mode!=='creator') return intent;      // movement, never words

      const pool=[];
      for(let i=0;i<cfg.lines.length;i++){
        const t=cfg.lines[i];
        if(t===_playLast[gesture]) continue;
        if(_forbidden(t)) continue;
        pool.push(t);
      }
      if(!pool.length) return intent;
      const text=pool[Math.floor(Math.random()*pool.length)];
      _playLast[gesture]=text;
      intent.say=text;
      intent.emotion=cfg.emotion;
      // Play speaks, so the Companion has just used its voice — the
      // story rules wait their turn exactly as they would after any
      // other line.
      _lastSpokeAt=now;
      return intent;
    }catch(e){ return {}; }
  }

  /**
   * The single contract with the Director.
   * @param {object} snapshot From CompanionContext.snapshot().
   * @param {string} [event] The Director's own event name, if this tick
   *   was caused by one ('page-added', 'artwork-added', ...).
   * @param {object} [opts] {mode:'creator'|'traveller'}
   * @returns {object} An intent. `{}` means say nothing and do nothing,
   *   which is the overwhelmingly common answer and is meant to be.
   */
  function decide(snapshot,event,opts){
    try{
      if(!snapshot) return {};
      // GATE 1 — Traveller silence, before any rule runs. The Story Egg
      // has no voice at all, so there is nothing here to filter later.
      const mode=(opts&&opts.mode)||'creator';
      if(mode!=='creator') return {};

      if(!_startedAt) _startedAt=_now();
      _stirredAt=_now();      // something happened; the Companion holds still

      // GATES 2-4 — settling, cooldown. A quiet tick may still change
      // the Companion's FACE (C1 costs nobody anything); it may not
      // produce a word.
      if(_quiet()) return _react(snapshot,event);

      let out=_guardrail(snapshot);
      if(out&&out.say) return out;
      out=_encourage(snapshot,event);
      if(out&&out.say) return out;
      out=_absence(snapshot);
      if(out&&out.say) return out;

      return _react(snapshot,event);
    }catch(e){ return {}; }
  }

  /**
   * May the Companion move somewhere else right now, and how?
   *
   * Answers `{}` almost every time it is asked. Four things must all
   * be true: the arrival settling is over, nothing has happened for a
   * while, it has not moved recently, and a coin comes up right — that
   * last one because a creature that moved on a reliable schedule would
   * be a screensaver.
   *
   * The style is never the same twice running, so the three ways of
   * travelling stay three rather than blurring into one.
   *
   * @returns {object} {style} or {}
   */
  function roam(){
    try{
      const now=_now();
      if(!_startedAt) _startedAt=now;
      if((now-_startedAt)<SETTLE_MS) return {};
      if(_stirredAt && (now-_stirredAt)<ROAM_QUIET_MS) return {};
      if(_roamedAt && (now-_roamedAt)<ROAM_GAP_MS) return {};
      if(Math.random()>=ROAM_CHANCE) return {};

      const pool=ROAM_STYLES.filter(function(x){ return x!==_roamLast; });
      const style=pool[Math.floor(Math.random()*pool.length)];
      _roamLast=style;
      _roamedAt=now;
      return {style:style, source:'roam:'+style};
    }catch(e){ return {}; }
  }

  /** The Studio saw the child do something. Holds the Companion still. */
  function stir(){ _stirredAt=_now(); }

  /**
   * Told by the Director whenever ANYTHING was spoken — including the
   * Director's own scripted lines. Without this the two would talk over
   * each other, since only the Director knows about its own MESSAGES.
   */
  function noteSpoken(){ _lastSpokeAt=_now(); }

  /**
   * The loaded Companion Package's own voice policy: `lines` overrides
   * platform copy, `neverSays` forbids phrases outright. Both optional;
   * a package that ships neither speaks in the platform's voice.
   */
  function usePolicy(personality){
    _lines=LINES;
    _play=PLAY;
    _never=[];
    try{
      if(!personality) return;
      if(Array.isArray(personality.neverSays)) _never=personality.neverSays.slice();
      // A package may give its own creature its own giggles, keeping
      // "add a companion" a zero-code act: personality.play.tickle =
      // ["...", "..."]. Anything it does not name keeps the platform's.
      if(personality.play && typeof personality.play==='object'){
        const merged={};
        for(const g in PLAY){
          if(!Object.prototype.hasOwnProperty.call(PLAY,g)) continue;
          const own=personality.play[g];
          merged[g]=(own && Array.isArray(own.lines) && own.lines.length)
            ? Object.assign({},PLAY[g],{lines:own.lines.slice()})
            : PLAY[g];
        }
        _play=merged;
      }
      if(personality.lines && typeof personality.lines==='object'){
        const merged={};
        for(const k in LINES) if(Object.prototype.hasOwnProperty.call(LINES,k)) merged[k]=LINES[k];
        for(const k in personality.lines) if(Object.prototype.hasOwnProperty.call(personality.lines,k)) merged[k]=personality.lines[k];
        _lines=merged;
      }
    }catch(e){}
  }

  /**
   * Test seam. Resets restraint state; never called by the Studio.
   * `{aged:true}` additionally backdates the session past the settling
   * window, so a suite can exercise a rule without sleeping through it
   * — the alternative being either a fifteen-second wait per rule or a
   * mocked clock, and a mocked clock would stop the test measuring the
   * real restraint that is the whole point of this file.
   */
  function _reset(opts){
    _lastSpokeAt=0;
    _startedAt=(opts&&opts.aged)?(_now()-SETTLE_MS-1000):0;
    for(const k in _said) if(Object.prototype.hasOwnProperty.call(_said,k)) delete _said[k];
    for(const k in _playAt) if(Object.prototype.hasOwnProperty.call(_playAt,k)) delete _playAt[k];
    for(const k in _playLast) if(Object.prototype.hasOwnProperty.call(_playLast,k)) delete _playLast[k];
    _roamedAt=0; _roamLast=null;
    _stirredAt=(opts&&opts.aged)?(_now()-ROAM_QUIET_MS-1000):0;
  }

  return {
    decide:decide,
    play:play,
    roam:roam,
    stir:stir,
    noteSpoken:noteSpoken,
    usePolicy:usePolicy,
    _reset:_reset,
    COOLDOWN_MS:COOLDOWN_MS,
    SETTLE_MS:SETTLE_MS,
    ROAM_GAP_MS:ROAM_GAP_MS,
    ROAM_QUIET_MS:ROAM_QUIET_MS
  };
})();
try{ window.CompanionBrain=CompanionBrain; }catch(e){}
