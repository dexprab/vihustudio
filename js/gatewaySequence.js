// js/gatewaySequence.js — The Traveller Gateway (VihuPlanet Canon Milestone
// 1, reworked under "Canon Update Sprint — Traveller Gateway Rework V1.1",
// given a full cinematic polish pass under "Cinematic Polish Sprint —
// Traveller Gateway V1", then a real hand-supplied Gate video replaced the
// CSS-drawn arch outright, "Lumo Guards the Gate" restaged the Gate scene
// around that real video, the Story Egg and Lumo were pulled OUT of the
// Gate scene entirely ("remove egg and lumo from the scene... in next
// scene let lumo interact with the traveller"), a SECOND real video (this
// one with Lumo, and the Story Egg, baked directly into its own footage)
// then replaced that whole multi-scene composited pipeline for the
// TRAVELLER path outright, and finally a THIRD real video — "essentially
// same video but w/o egg" — did the exact same thing for the RETURNING
// CREATOR path, retiring the last of the old CSS-composited machinery
// (Lumo's flying figure, the Gate's halo/particle/rune-spark effects, the
// separate Approach/Journey/Arrival/Awaken/Open/dolly beat sequence) for
// good. Both paths now share ONE mechanism — see runVideoSequence() below
// — differing only in which real clip plays and what's said. Two ideas
// that were previously conflated are kept explicitly separate:
//
//   Traveller Journey  — WHO is arriving (a Returning Creator or a
//                         first-time Traveller). A branching DECISION,
//                         resolved silently before Scene 1 ever paints.
//                         It is NOT the Gateway itself.
//
//   Traveller Gateway  — the physical cinematic journey from the Sky into
//                         the Hall of Creation. It always begins in the
//                         Sky and always ends inside the Hall. EVERY
//                         person experiences it — a Returning Creator and
//                         a first-time Traveller alike. "The only
//                         difference is what happens before the gates
//                         open."
//
// The shared mechanism, runVideoSequence(video,opts) — one real,
// continuous clip, played in two segments with the interaction happening
// in the pause between them:
//   1. Mount the real Gate video (own clip per path — see
//      assets/video/gateway/README.md), paused on its own first frame.
//   2. A deliberate hold on the closed, glowing doors before anything
//      moves — "i dont want lumo to enter as soon as the page has
//      loaded."
//   3. For a Returning Creator ONLY (opts.preLines set): the recognition
//      line plays first, HEARD not witnessed — nobody is visible on
//      screen yet but the Gate itself, which the Traveller trusts enough
//      to approach on the strength of a voice alone — then the existing
//      Creator Signature tap challenge verifies who they are
//      (js/magicCardUI.js's MagicCardUI.beginCreatorSignature, reused
//      through one minimal, leaner entry point rather than
//      reimplemented; Lumo is the Gatekeeper in both experiences, so the
//      Gateway is briefly, non-destructively hidden — never torn down,
//      no timers reset — for this one interlude, reading as one
//      continuous encounter rather than a hand-off). "retry or continue
//      as traveller. options" — a wrong pattern already lets someone
//      retry in place indefinitely; giving up now shows an explicit
//      choice (Try Again / Continue as a Traveller) instead of silently
//      deciding for them. Choosing "Continue as a Traveller" swaps the
//      still-unplayed no-egg clip out for the real Traveller clip and
//      restarts this same function with the Traveller's own opts — a
//      declined check genuinely BECOMES the Traveller experience, not
//      a cleared identity riding along on the Returning Creator's own
//      reunion-toned video. A first-time
//      Traveller has no preLines at all and skips straight to segment 1
//      — there is nobody to recognize yet.
//   4. Segment 1 plays — Lumo flies in (its own real, already-filmed
//      footage) and lands, standing, wings spread — then pauses exactly
//      there.
//   5. opts.pauseLines play IN PERSON, over that held frame — Lumo
//      actually visible for the first time this whole sequence, speaking
//      directly to whoever just arrived. The richer 5-line title/
//      subtitle sequence for a first-time Traveller; a short, warm
//      reunion pair for a Returning Creator.
//   6. A closing pause, then Segment 2 resumes from the exact same
//      timestamp Segment 1 paused at (a genuine no-op seek, so nothing
//      is skipped) and plays to the clip's own real end — Lumo flies off
//      through the now-open doors into the light.
//   7. A brief final flash, then onComplete() — the Hall of Creation
//      (internally: Studio's own boot sequence) is never visible before
//      this moment, for anyone, regardless of path.
//
// Lumo's canon, frozen: welcomes Travellers, recognizes Returning
// Creators, verifies Creator Signatures, guards the Gate, opens the
// Gate — and never enters the Hall, never becomes anyone's companion.
// "The Hall belongs to the Creator. The Gateway belongs to Lumo." The
// Story Egg and any bonded Story Companion only ever MOUNT AS THE HALL'S
// OWN ambient companion inside the Hall (js/companionDirector.js's own
// init(), called from Studio's boot sequence AFTER this whole file's
// onComplete() fires) — resolved independently by companionDirector.js,
// never mounted or referenced here. (The Traveller path's own clip shows
// the Story Egg being carried through the Gate purely as cinematic
// footage — this file itself still never references the Egg as a
// concept at all.)
//
// Plays automatically, every launch, at the very front of boot — see
// js/app.js's bootstrapSession IIFE, which calls GatewaySequence.begin
// unconditionally and hands its onComplete() straight into Studio's own
// _beginBoot(), never back through the standalone Identity Gate — the
// Identity beat above already did that job, for whichever path applied.
//
// Required "Tap to Begin" gate — closes the real remaining gap the
// "Ambience Threaded Through Every Screen + Real Preload Gate" sprint
// left open: js/app.js's own bootWithPreloadGate() correctly calls
// AudioManager.init()/LumoVoice.preload() early and shows a spinner
// until they're ready, but NOTHING in that flow ever calls
// AudioManager.playFoundation() or waits for a real user gesture — a
// spinner (or a timeout) is not a gesture, so the browser's autoplay
// policy still silently blocks every un-muted audio.play() call
// (ambience AND every LumoVoice line) until the user's first real
// click/tap ANYWHERE on the page (js/audioManager.js's own
// _installUnlockListener does catch that first real gesture — but if a
// Traveller never clicks anything before the whole cinematic auto-plays
// through on its own, ambience simply never starts). That's the exact
// remaining explanation for "i cleared cached and reloaded the page the
// ambience and lumo voice did not came even for traveller" persisting
// even after that sprint shipped. Fixed here, the one real caller of
// audio playback in this automatic sequence, with showBeginGate() below
// — a small, required "✨ Tap to Begin ✨" prompt whose own tap/keydown is
// a real, synchronous gesture: AudioManager.playFoundation() fires
// directly inside that handler (ambience genuinely starts there and
// plays through literally every later Gateway screen), and every LATER
// scheduled LumoVoice call for the rest of the page's life is allowed
// too, since browser autoplay policy treats "has the user interacted
// with this page at all" as sticky for the whole document, not just the
// exact call made inside the gesture handler itself.
//
// A disclosed, deliberate scope decision on Audio: earlier feedback asked
// for "subtle layers — wind, birds, magic, deep stone resonance" on top of
// the existing ambience. No real audio matching any of those exists
// anywhere in this sandbox (only two unrelated click/transition sounds,
// see js/gatewayAudio.js's own README), and — more fundamentally —
// js/gatewayAudio.js's whole existing discipline (mirroring
// vihuplanet/js/heroAudio.js) is "no autoplay, no ambient/looping
// background music, playback fires ONLY from inside a real click/keydown
// handler." Wiring an autoplaying ambience layer into this automatic
// sequence would mean silently reversing that established, deliberate
// policy — a real architecture decision, not a polish-sprint call to make
// unilaterally. Left as a disclosed, unchanged gap rather than either
// fabricating a mismatched sound or quietly breaking the no-autoplay rule.
// Every video used here is muted with no audio track at all, so none of
// this is affected either way.
(function(){
  'use strict';

  const ASSETS_BASE='assets/';
  // sessionStorage marker for "has the Gateway already run once in this
  // tab's own browser session" -- see the My-Projects-clearing block
  // inside begin() below.
  const GATEWAY_SESSION_MARKER='vihu-gateway-session-entered';
  // A brief settle before anything happens — mounting the very first
  // Gate video takes a beat to fade in.
  const GATE_SETTLE_MS=600;
  const TAP_HINT_DELAY_MS=3600;
  // Each entry is {title, subtitle} — a short spoken line plus a
  // smaller, quieter second line underneath it (see the reference text
  // sequence board: "Welcome, Traveller." / "You've found the Gateway."
  // etc.), rendered by playLines() below as two stacked lines inside
  // the one shared bubble rather than a single flat sentence.
  const GREETING_LINES=[
    {title:'Welcome, Traveller.',subtitle:"You've found the Gateway."},
    {title:'I am Lumo.',subtitle:"It's wonderful to meet you."},
    {title:'Guardian of Story Companions.',subtitle:'I help stories come to life.'},
    {title:'Every Creator begins here.',subtitle:'And every story begins with a spark of imagination.'},
    {title:"I've been waiting for you.",subtitle:'Shall we begin? ✨'}
  ];
  // Real recorded Lumo voice for each GREETING_LINES entry — title clip
  // then subtitle clip, played back to back via LumoVoice.playSequence()
  // while both lines of text are already visible together in one bubble
  // (see js/lumoVoice.js). One entry per GREETING_LINES index, same
  // order.
  const GREETING_VOICE_IDS=[
    ['greeting1','greeting1b'],
    ['greeting2','greeting2b'],
    ['greeting3','greeting3b'],
    ['greeting4','greeting4b'],
    ['greeting5','greeting5b']
  ];
  // Returning Creator's own recognition line — played first, HEARD not
  // witnessed (nobody visible yet but the Gate itself), before the
  // Creator Signature challenge verifies who's arrived.
  const RETURNING_LINES=[
    'Welcome home.',
    'Show me your stars.'
  ];
  const RETURNING_VOICE_IDS=['returning1','returning2'];
  const RETURNING_LINE_MS=2200;
  const RETURNING_LINE_GAP_MS=650;
  // GREETING_LINE_MS/GREETING_GAP_MS/GREETING_END_PAUSE_MS govern the
  // in-person pause-point dialogue for BOTH paths (the Traveller's own
  // richer 5-line greeting, and the Returning Creator's own short
  // LUMO_ARRIVAL_RETURNING_LINES reunion pair, below) — a longer hold
  // than a flat sentence needs, since it's now always a two-line
  // title+subtitle for the Traveller and a real in-person moment either
  // way; playLines() also stretches its own fade-in/fade-out portion of
  // this duration (see gateway-line-in's percentages in css/style.css)
  // rather than a fixed snap. "we need to allow more time to kids...
  // increase all timings by 800ms" — every one of these three got the
  // identical +800ms, keeping their relative proportions (the fade's
  // own 26%/74% split) exactly the same, just slower end to end.
  const GREETING_LINE_MS=3400;
  // GREETING_END_PAUSE_MS — "the traveller greeting looks unfinished
  // ending abruptly": the pause-point dialogue used to vanish and the
  // video resume in the very same instant, with no beat to let the last
  // line land before the scene moves on; this holds on the empty,
  // silent frame for a moment first before Segment 2 resumes.
  const GREETING_GAP_MS=1800;
  const GREETING_END_PAUSE_MS=2000;

  // The Returning Creator's own reunion-toned pair, spoken IN PERSON at
  // the video's own pause point (see runVideoSequence's pauseLines,
  // below) — short and distinct from the Traveller's own first-meeting
  // GREETING_LINES, since a returning Creator already knows who Lumo is.
  const LUMO_ARRIVAL_RETURNING_LINES=[
    "It's good to see you again.",
    'Welcome back to your story.'
  ];
  const LUMO_ARRIVAL_RETURNING_VOICE_IDS=['arrivalReturning1','arrivalReturning2'];

  // ---- The single continuous Gate+Lumo clip, one per path. ----
  // "show the doors for 2 sec and than let lumo enter sequence till he
  // put the egg down. at this point there should be the interaction
  // sequence... post interaction... continue with the video sequence
  // [from where it paused] till end. post end show the studio home
  // screen." — built for the Traveller path first; "lets get into
  // creator path. i have uploaded another video for you. its
  // essentially same video but w/o egg" then unified the Returning
  // Creator path onto the identical mechanism. One video, played in two
  // segments with the interaction happening in the gap between them.
  const GATE_FINAL_VIDEO_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final.mp4';
  const GATE_FINAL_POSTER_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final-poster.jpg';
  const GATE_FINAL_NOEGG_VIDEO_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final-no-egg.mp4';
  const GATE_FINAL_NOEGG_POSTER_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final-noegg-poster.jpg';
  // A deliberate extra hold on the closed, glowing doors before any
  // playback starts at all — "i dont want lumo to enter as soon as the
  // page has loaded." On top of GATE_SETTLE_MS's own small fade-in
  // settle (600ms), giving roughly 2.6s of stillness before Segment 1
  // begins; the footage's own first ~2s (doors alone, no Lumo) then
  // extends that further before Lumo actually becomes visible in frame.
  // For the Returning Creator (which has its own preLines/Creator
  // Signature check first), this hold sits right before Segment 1
  // starts instead — after verification resolves, not before the
  // recognition line — so Lumo still gets a deliberate beat before it
  // appears on either path.
  const GATE_HOLD_MS=2000;
  // Segment 1 plays from the start up to this timestamp, then pauses —
  // Lumo has landed and is standing there, wings still spread (with the
  // Story Egg between its feet on the Traveller's own clip). This exact
  // held frame is where the interaction plays, in person, rather than
  // heard over an empty screen. Confirmed via ffmpeg frame extraction
  // to hold the same standing pose on BOTH clips through ~5.5s.
  const PAUSE_AT_S=5;
  // Segment 2 resumes from the SAME timestamp Segment 1 paused at —
  // "the sequence of him picking up the egg seems to be chopped off...
  // lumo seems to be abruptly flying." The video was originally resumed
  // from 7.5s, hard-skipping the real footage between 5-7.3s (a genuine
  // frame-by-frame check confirmed this is exactly where Lumo crouches
  // and leaps into flight, on both clips) — so Segment 2 used to open
  // mid-air, already airborne, with the actual liftoff never shown at
  // all. Resuming from exactly PAUSE_AT_S costs nothing visually during
  // the dialogue pause and removes the hard seek/jump-cut entirely —
  // playVideoSegmentTo() already snaps the video's own currentTime to
  // PAUSE_AT_S when it pauses, so resuming from the same value is a
  // genuine no-op seek; the video simply un-pauses exactly where it
  // left off and the crouch/liftoff/flight all play in full,
  // continuously, for the first time.
  const RESUME_AT_S=PAUSE_AT_S;
  // A brief settle after the "lumoLanding" line so it's fully heard
  // before the in-person greeting/recognition lines begin talking over
  // it -- matches the clip's own real ~2.7s length plus a small buffer.
  const LUMO_LANDING_HOLD_MS=2900;
  // Safety-only fallback timers: the real waits are driven by
  // video.currentTime/the 'ended' event; these only fire if playback
  // stalls or an event never arrives, so Studio's boot can never hang
  // behind this file.
  const SEGMENT1_FALLBACK_MS=6500;
  const SEGMENT2_FALLBACK_MS=11000;
  // The Traveller path's own final beat — see playFinalFlash below.
  const THRESHOLD_MS=1150;

  function prefersReducedMotion(){
    try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  function el(tag,className){
    const e=document.createElement(tag);
    if(className) e.className=className;
    return e;
  }

  const GatewaySequence=(function(){
    let overlay=null, content=null;
    let timers=[];
    let skipRequested=false;
    let advanceFn=null;

    function clearTimers(){
      timers.forEach(function(t){ clearTimeout(t); });
      timers=[];
    }
    function after(ms,fn){
      const t=setTimeout(fn,ms);
      timers.push(t);
      return t;
    }

    function ensureDom(){
      overlay=document.getElementById('gatewayOverlay');
      content=document.getElementById('gatewayContent');
      return !!(overlay&&content);
    }

    function showTapHint(){
      if(!content||skipRequested) return;
      const hint=el('div','gateway-tap-hint');
      hint.textContent='✦ tap to continue ✦';
      content.appendChild(hint);
    }

    // The ONE required tap/keydown the whole Gateway now waits on before
    // anything plays — see this file's own header comment for the real
    // remaining bug this fixes (ambience/Lumo voice silently blocked by
    // the browser's autoplay-gesture policy — a spinner-based preload
    // gate alone never satisfies it). Deliberately shown regardless of
    // prefers-reduced-motion — this isn't a visual flourish to skip, it's
    // the one mechanically necessary step that makes every later
    // audio.play() call in this file (and AudioManager's) reliable; only
    // its own CSS transition/pulse animation is disabled under reduced
    // motion (see .gateway-begin-gate's own reduced-motion override in
    // css/style.css), matching how the Creator Signature check itself is
    // never skipped by reduced motion either. `onProceed` is called via
    // setTimeout(...,0), NOT synchronously — confirmed via a live DOM
    // MutationObserver trace that calling it synchronously let the
    // still-bubbling tap event immediately re-trigger wireSkip()'s
    // whole-overlay skip-click listener (added to `overlay`, an ancestor
    // the event hadn't yet bubbled past), collapsing the entire cinematic
    // in one tick; deferring to the next macrotask guarantees the
    // originating click has fully finished dispatching first.
    function showBeginGate(onProceed){
      // Buffering (unlike playback) needs no gesture at all — kicked off
      // here too (js/app.js's own bootWithPreloadGate() already primes
      // this earlier, so this is a cheap, idempotent no-op in practice,
      // safe to call again).
      try{ if(typeof LumoVoice!=='undefined' && LumoVoice.preload) LumoVoice.preload(); }catch(e){}

      const gate=el('div','gateway-begin-gate');
      const inner=el('div','gateway-begin-gate-inner');
      inner.textContent='✨ Tap to Begin ✨';
      gate.setAttribute('tabindex','0');
      gate.setAttribute('role','button');
      gate.setAttribute('aria-label','Tap to begin');
      gate.appendChild(inner);
      content.appendChild(gate);
      requestAnimationFrame(function(){ gate.classList.add('gateway-begin-gate-in'); });

      let proceeded=false;
      function proceed(){
        if(proceeded) return;
        proceeded=true;
        gate.removeEventListener('click',proceed);
        gate.removeEventListener('keydown',onKey);
        // A real, synchronous gesture just fired — the one moment every
        // subsequent audio.play() call in this file can reliably rely
        // on, regardless of autoplay-heuristic history or a just-
        // cleared cache. This part stays synchronous, inside the real
        // gesture, on purpose.
        try{
          if(typeof AudioManager!=='undefined'){
            AudioManager.init();
            AudioManager.playFoundation();
          }
        }catch(e){}
        if(gate.parentNode) gate.parentNode.removeChild(gate);
        // Deferred — see this function's own header comment above for
        // why onProceed() must never run inside the same still-bubbling
        // click event that triggered this handler.
        setTimeout(onProceed,0);
      }
      function onKey(e){ if(e.key==='Enter'||e.key===' ') proceed(); }
      gate.addEventListener('click',proceed);
      gate.addEventListener('keydown',onKey);
      try{ gate.focus(); }catch(e){}
    }

    function onSkipKey(e){
      if(e.key==='Enter'||e.key===' ') onSkipClick();
    }
    function onSkipClick(){
      // While Scene 3's Creator Signature interlude is showing, the
      // Gateway overlay is display:none — this listener simply never
      // fires (a hidden element receives no click), so the interlude's
      // own "← Back" is the only escape hatch there, by construction.
      if(skipRequested||!advanceFn) return;
      skipRequested=true;
      try{ if(typeof window.GatewayAudio!=='undefined') window.GatewayAudio.tapContinue(); }catch(e){}
      clearTimers();
      advanceFn();
    }
    function wireSkip(finish){
      advanceFn=finish;
      overlay.addEventListener('click',onSkipClick);
      overlay.addEventListener('keydown',onSkipKey);
    }
    function unwireSkip(){
      if(!overlay) return;
      overlay.removeEventListener('click',onSkipClick);
      overlay.removeEventListener('keydown',onSkipKey);
      advanceFn=null;
    }

    // Reveals `lines` one at a time, each staying up for lineMs with a
    // gapMs pause before the next — the epic's own "natural paced
    // lines... [pause]" framing, made real, shared by both the
    // Traveller greeting and the Returning Creator's shorter welcome.
    // No tutorials/UI instructions anywhere in either array by design.
    // `reduced` genuinely shortens each line's own hold time at the JS
    // level (not just a CSS backstop) — six real scenes is long enough
    // that a reduced-motion boot must still resolve quickly.
    //
    // `voiceIds` (optional) is a parallel array, one entry per line —
    // each entry either null (no recording for this line yet), a single
    // LumoVoice id, or an array of ids (a title clip followed by its own
    // subtitle clip, played back to back via LumoVoice.playSequence()).
    // A line's REAL hold time becomes max(lineMs, its own recorded
    // voice's total duration + a short trailing pause) — several of the
    // Traveller greeting's own recorded lines genuinely run longer than
    // the original fixed lineMs (one pair alone is ~7.6s), so a flat
    // timer would either cut the voice off mid-sentence or race ahead of
    // it; this keeps the text on screen exactly as long as Lumo is still
    // speaking, and simply falls back to the original fixed lineMs for
    // any line with no recording (or under reduced motion, where voice
    // playback is skipped entirely, matching every other flourish in
    // this file).
    function playLines(lines,lineMs,gapMs,reduced,onDone,voiceIds){
      if(reduced){ lineMs=120; gapMs=0; }
      const bubble=el('div','gateway-greeting-bubble');
      content.appendChild(bubble);
      let i=0;
      function nextLine(){
        if(skipRequested) return;
        if(i>=lines.length){ onDone(bubble); return; }
        bubble.classList.remove('gateway-greeting-in');
        const line=lines[i];
        const voice=voiceIds?voiceIds[i]:null;
        // A line can be either a plain string (Returning Creator's
        // welcome, Lumo's own in-person arrival lines) or a
        // {title,subtitle} pair (the Traveller greeting's own richer
        // two-line text sequence) -- rendered as two stacked children
        // instead of one flat sentence when it's the latter.
        if(line&&typeof line==='object'){
          bubble.textContent='';
          const title=el('div','gateway-greeting-title');
          title.textContent=line.title;
          bubble.appendChild(title);
          if(line.subtitle){
            const sub=el('div','gateway-greeting-subtitle');
            sub.textContent=line.subtitle;
            bubble.appendChild(sub);
          }
        }else{
          bubble.textContent=line;
        }
        let effectiveMs=lineMs;
        if(!reduced && voice && typeof window.LumoVoice!=='undefined'){
          const voiceMs=LumoVoice.durationMs(voice);
          if(voiceMs>0) effectiveMs=Math.max(lineMs,voiceMs+400);
          LumoVoice.playSequence(voice);
        }
        // The fade itself (see gateway-line-in in css/style.css) now
        // scales its own duration to whatever lineMs this specific
        // caller passed, rather than a CSS-side value that could drift
        // out of sync with it -- "let it appear gradually and disappear
        // gradually" applies to every text moment (Traveller greeting,
        // Returning Creator's welcome, Lumo's in-person arrival lines)
        // using each one's own already-tuned hold time, not just a
        // fixed 2000ms. An inline style always wins over the stylesheet
        // rule it's overriding, with no !important needed.
        bubble.style.animationDuration=effectiveMs+'ms';
        void bubble.offsetWidth; // force reflow so the fade-in re-triggers every line
        bubble.classList.add('gateway-greeting-in');
        i++;
        after(effectiveMs+gapMs,nextLine);
      }
      nextLine();
    }

    // Preloads a Gate video as early as possible — called from the very
    // start of begin(), long before it's needed, so its several MB has as
    // much runtime as possible to buffer. Kept off-screen (not merely
    // off-DOM — some browsers pause loading a detached element) via
    // .gateway-preload-hidden until mountFinalGate() moves this SAME
    // element (never a fresh one) into the visible frame, preserving
    // whatever it already downloaded. Muted + no audio track at all, so
    // this never touches the no-autoplay-audio policy above. Takes the
    // src/poster explicitly since the two paths preload two different
    // clips (see GATE_FINAL_VIDEO_SRC/GATE_FINAL_NOEGG_VIDEO_SRC above).
    function preloadFinalGateVideo(src,poster){
      try{
        const video=el('video','gateway-preload-hidden');
        video.muted=true;
        video.playsInline=true;
        video.preload='auto';
        video.poster=poster;
        video.src=src;
        video.setAttribute('aria-hidden','true');
        return video;
      }catch(e){ return null; }
    }

    // Mounts the Gate video full-bleed and alone — the whole magic (the
    // glowing runes, Lumo, the doors opening, the light beyond) is baked
    // into its own footage, so there is no separate CSS halo/particle/
    // spark layer to add on top of it. `video` is the SAME element
    // preloadFinalGateVideo mounted earlier, simply moved into the
    // visible frame here, never recreated, so none of its buffered
    // download is lost.
    function mountFinalGate(video){
      const wrap=el('div','gateway-gates-wrap');
      const gate=el('div','gateway-gates');
      const frame=el('div','gateway-gate-video-frame');
      if(video){
        video.classList.remove('gateway-preload-hidden');
        video.classList.add('gateway-gate-video');
        frame.appendChild(video);
      }
      gate.appendChild(frame);
      wrap.appendChild(gate);
      content.appendChild(wrap);
      requestAnimationFrame(function(){ wrap.classList.add('gateway-gates-visible'); });
      return {wrap:wrap,video:video||null};
    }

    // Plays the video from wherever it currently sits up to `toS`
    // seconds, then pauses and snaps exactly to that timestamp —
    // 'timeupdate' fires at an irregular cadence, so the snap guarantees
    // a precise visual landing on the held frame regardless of exactly
    // when the event fired. A duration-based fallback timer guarantees
    // this can never hang Studio's own boot if playback stalls or
    // 'timeupdate' never arrives. Reduced motion never actually plays —
    // it jumps straight to the target timestamp and resolves almost
    // immediately.
    function playVideoSegmentTo(video,toS,fallbackMs,reduced,onDone){
      if(!video){ after(200,onDone); return; }
      if(reduced){
        try{ video.currentTime=toS; }catch(e){}
        after(120,onDone);
        return;
      }
      let settled=false;
      function finish(){
        if(settled||skipRequested) return;
        settled=true;
        video.removeEventListener('timeupdate',onTime);
        try{ video.pause(); video.currentTime=toS; }catch(e){}
        onDone();
      }
      function onTime(){
        if(video.currentTime>=toS-0.05) finish();
      }
      video.addEventListener('timeupdate',onTime);
      try{
        const p=video.play();
        if(p&&p.catch) p.catch(function(){});
      }catch(e){}
      after(fallbackMs,finish);
    }

    // Resumes the video from `fromS` and plays it all the way to its
    // real natural end (the video's own genuine 'ended' event) — never
    // an artificial stopping point, this is the clip's own final
    // footage: Lumo picks the Egg back up and carries it through the
    // open door into the light. A duration-based fallback guarantees
    // this can never hang Studio's boot if 'ended' never arrives.
    function playVideoSegmentToEnd(video,fromS,fallbackMs,reduced,onDone){
      if(!video){ after(200,onDone); return; }
      if(reduced){ after(150,onDone); return; }
      let settled=false;
      function finish(){
        if(settled||skipRequested) return;
        settled=true;
        video.removeEventListener('ended',finish);
        onDone();
      }
      video.addEventListener('ended',finish);
      try{
        video.currentTime=fromS;
        const p=video.play();
        if(p&&p.catch) p.catch(function(){});
      }catch(e){}
      const remaining=(isFinite(video.duration)&&video.duration>fromS)
        ? Math.ceil((video.duration-fromS)*1000)+800
        : fallbackMs;
      after(remaining,finish);
    }

    // Both paths' own final beat — a brief flash before the cut to the
    // Hall. No forward camera dolly here — the video's own final
    // seconds already read as a camera-through-the-light moment on
    // their own; stacking a CSS zoom on top would double up rather
    // than add anything.
    function playFinalFlash(reduced,onDone){
      if(skipRequested) return;
      const flash=el('div','gateway-threshold-flash');
      content.appendChild(flash);
      requestAnimationFrame(function(){
        flash.classList.add('gateway-threshold-flash-in');
      });
      after(reduced?150:THRESHOLD_MS,onDone);
    }

    /**
     * Plays the full Traveller Gateway once, then calls onComplete() —
     * always, even on any internal failure (a missing overlay in the
     * DOM, an unreachable registry, a companion package that can't be
     * resolved, an unavailable Creator Signature challenge). Studio's
     * own boot sequence must never hang behind this. Session detection
     * (Returning Creator vs. Traveller) happens once, silently, before
     * Scene 1 ever paints — never re-checked mid-flight. Safe to call
     * more than once in a session (each call is fully self-contained),
     * though today's one real caller (js/app.js's bootstrapSession)
     * only ever calls it once per load.
     * @param {function} onComplete
     */
    function begin(onComplete){
      onComplete=onComplete||function(){};
      if(!ensureDom()){ onComplete(); return; }

      let gateVideoEl=null;
      let gateEls=null;
      const done=function(){
        clearTimers();
        unwireSkip();
        try{ if(gateVideoEl) gateVideoEl.pause(); }catch(e){}
        overlay.classList.add('hidden');
        overlay.classList.remove('gateway-mode-hidden-for-signature');
        content.innerHTML='';
        skipRequested=false;
        try{ onComplete(); }catch(e){}
      };

      overlay.classList.remove('hidden','gateway-mode-hidden-for-signature');
      content.innerHTML='';
      skipRequested=false;

      const reduced=prefersReducedMotion();

      // Session detection happens before the Gateway — "The Traveller
      // Journey ends before the Gateway begins" — computed once, up
      // front, with no visuals of its own. It also decides WHICH Gate
      // video to preload — the two paths use genuinely different
      // footage. Kicked off immediately below (before the "Tap to
      // Begin" gate even shows) regardless of the gate — buffering,
      // unlike playback, needs no gesture at all, so the several MB of
      // video gets the maximum possible head start either way; only the
      // gate's own visible mounting + audio-line playback (inside
      // showBeginGate's own callback, below) waits on the tap.
      let isReturning=false, card=null;
      try{
        if(typeof MagicCard!=='undefined'){
          const known=MagicCard.list();
          if(known&&known.length>0){
            isReturning=true;
            card=MagicCard.getActive()||known[0];
          }
        }
      }catch(e){}

      // "if the system has identified its a traveller than all the
      // caches should be cleared. traveller should not see projects of
      // previous creators" -- "the cache clean should only be requested
      // when its entry sequence" (a genuinely NEW browser session, not
      // every reload) -- scoped to just My Projects (CreatorProjectStore),
      // per explicit direction. sessionStorage starts empty in every new
      // tab/window but survives an in-page reload within the same one,
      // so it's the exact "is this session's very first Gateway entry"
      // signal needed; the marker is set unconditionally (both paths)
      // so a Returning Creator boot also correctly counts as "already
      // entered" for the rest of that tab session.
      try{
        const isNewSession=!sessionStorage.getItem(GATEWAY_SESSION_MARKER);
        sessionStorage.setItem(GATEWAY_SESSION_MARKER,'1');
        if(isNewSession&&!isReturning&&typeof CreatorProjectStore!=='undefined'&&CreatorProjectStore.clearAll){
          CreatorProjectStore.clearAll();
        }
      }catch(e){}

      if(isReturning){
        gateVideoEl=preloadFinalGateVideo(GATE_FINAL_NOEGG_VIDEO_SRC,GATE_FINAL_NOEGG_POSTER_SRC);
      }else{
        gateVideoEl=preloadFinalGateVideo(GATE_FINAL_VIDEO_SRC,GATE_FINAL_POSTER_SRC);
      }
      if(gateVideoEl) content.appendChild(gateVideoEl);

      // The shared mechanism — see the header comment's own numbered
      // walkthrough. `opts`:
      //   preLines   — lines spoken BEFORE Segment 1 starts, over the
      //                still-closed doors (Returning Creator only — a
      //                first-time Traveller has nobody to recognize
      //                yet, so it's null there and Segment 1 begins
      //                immediately after the hold).
      //   verify     — whether preLines is followed by the real Creator
      //                Signature tap challenge before Lumo appears.
      //   pauseLines — lines spoken IN PERSON once Segment 1 pauses
      //                with Lumo standing there.
      function runVideoSequence(video,opts){
        gateEls=mountFinalGate(video);
        function beginSegment1(){
          after(reduced?0:GATE_HOLD_MS,function(){
            if(skipRequested) return;
            // Lumo becomes visible flying in right as Segment 1 starts
            // (the footage's own first ~2s is doors alone) -- a real,
            // atmospheric line, not gated on anything downstream.
            try{ if(typeof LumoVoice!=='undefined') LumoVoice.play('lumoFlying'); }catch(e){}
            playVideoSegmentTo(video,PAUSE_AT_S,SEGMENT1_FALLBACK_MS,reduced,function(){
              if(skipRequested) return;
              // Segment 1 has just paused -- Lumo has landed and is
              // standing there. Speak the landing beat, then let its own
              // duration settle before the in-person greeting begins, so
              // the two lines don't talk over each other.
              try{ if(typeof LumoVoice!=='undefined') LumoVoice.play('lumoLanding'); }catch(e){}
              after(reduced?0:LUMO_LANDING_HOLD_MS,function(){
                if(skipRequested) return;
                playLines(opts.pauseLines,GREETING_LINE_MS,GREETING_GAP_MS,reduced,function(bubble){
                  if(bubble&&bubble.parentNode) bubble.parentNode.removeChild(bubble);
                  if(skipRequested) return;
                  after(reduced?0:GREETING_END_PAUSE_MS,function(){
                    if(skipRequested) return;
                    playVideoSegmentToEnd(video,RESUME_AT_S,SEGMENT2_FALLBACK_MS,reduced,function(){
                      if(skipRequested) return;
                      playFinalFlash(reduced,done);
                    });
                  });
                },opts.pauseVoiceIds);
              });
            });
          });
        }
        after(reduced?0:GATE_SETTLE_MS,function(){
          if(skipRequested) return;
          if(!opts.preLines){ beginSegment1(); return; }
          playLines(opts.preLines,RETURNING_LINE_MS,RETURNING_LINE_GAP_MS,reduced,function(bubble){
            if(skipRequested) return;
            if(!opts.verify||typeof MagicCardUI==='undefined'||!MagicCardUI.beginCreatorSignature){
              // No Creator Signature challenge could be reached — a
              // real, honest degrade straight into Segment 1, never a
              // Gateway that hangs Studio's own boot behind a feature
              // that isn't there.
              beginSegment1();
              return;
            }
            if(bubble&&bubble.parentNode) bubble.parentNode.removeChild(bubble);
            // Lumo is the Gatekeeper in both experiences — hiding the
            // Gateway (never tearing it down) for this one interlude
            // reads as one continuous encounter, not a hand-off.
            overlay.classList.add('gateway-mode-hidden-for-signature');
            MagicCardUI.beginCreatorSignature(card,function(success){
              overlay.classList.remove('gateway-mode-hidden-for-signature');
              if(skipRequested) return;
              if(success){
                beginSegment1();
                return;
              }
              // "Continue as a Traveller" — a declined check never
              // blocks the physical Gateway, but it must genuinely
              // BECOME the Traveller experience (its own clip, its own
              // first-meeting greeting), not quietly clear the identity
              // while still playing the Returning Creator's own reunion-
              // toned video and lines underneath it. Nothing has visibly
              // played yet at this point (still the closed-doors frame),
              // so swapping the mounted video out here is a clean cut,
              // not a jarring one.
              try{ if(typeof MagicCard!=='undefined') MagicCard.setActive(null); }catch(e){}
              if(gateEls&&gateEls.wrap&&gateEls.wrap.parentNode) gateEls.wrap.parentNode.removeChild(gateEls.wrap);
              try{ if(video) video.pause(); }catch(e){}
              gateVideoEl=preloadFinalGateVideo(GATE_FINAL_VIDEO_SRC,GATE_FINAL_POSTER_SRC);
              if(gateVideoEl) content.appendChild(gateVideoEl);
              runVideoSequence(gateVideoEl,{preLines:null,verify:false,pauseLines:GREETING_LINES,pauseVoiceIds:GREETING_VOICE_IDS});
            });
          },opts.preVoiceIds);
        });
      }

      // Everything from here down waits on the one required "Tap to
      // Begin" gesture — see this file's own header comment for why
      // (ambience/Lumo voice were still being silently blocked by the
      // browser's own autoplay policy even after the spinner-based
      // preload gate). wireSkip() is deliberately attached only AFTER
      // the gate resolves (and only via showBeginGate's own deferred
      // onProceed callback — never synchronously inside the tap's own
      // click handler), so the gate's own tap is never mistaken for the
      // whole-overlay skip-click.
      showBeginGate(function(){
        wireSkip(done);
        after(reduced?800:TAP_HINT_DELAY_MS,showTapHint);

        if(isReturning){
          runVideoSequence(gateVideoEl,{preLines:RETURNING_LINES,preVoiceIds:RETURNING_VOICE_IDS,verify:true,pauseLines:LUMO_ARRIVAL_RETURNING_LINES,pauseVoiceIds:LUMO_ARRIVAL_RETURNING_VOICE_IDS});
        }else{
          runVideoSequence(gateVideoEl,{preLines:null,verify:false,pauseLines:GREETING_LINES,pauseVoiceIds:GREETING_VOICE_IDS});
        }
      });
    }

    return {begin:begin};
  })();

  try{ window.GatewaySequence=GatewaySequence; }catch(e){}
})();
