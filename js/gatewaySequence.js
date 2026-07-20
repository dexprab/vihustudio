// js/gatewaySequence.js — The Traveller Gateway (VihuPlanet Canon Milestone
// 1, reworked under "Canon Update Sprint — Traveller Gateway Rework V1.1",
// given a full cinematic polish pass under "Cinematic Polish Sprint —
// Traveller Gateway V1", then a real hand-supplied Gate video replaced the
// CSS-drawn arch outright, "Lumo Guards the Gate" restaged Scenes 2-6
// around that real video, and finally the Story Egg and Lumo were pulled
// OUT of the Gate scene entirely: "remove egg and lumo from the scene.
// let it be just the gate. welcome traveller and open the gate. in next
// scene let lumo interact with the traveller." — see the header comments
// further down and in css/style.css for the full account of each change.
// Two ideas that were previously conflated are kept explicitly separate:
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
//                         open" (Scene 3).
//
// Seven scenes, always in this order:
//   1-2. The Sky / The Gate — one immediate opening beat: the real Gate
//                            footage (paused on its own first frame)
//                            mounts the instant the sequence begins, with
//                            no async registry fetch to wait on and
//                            nothing else sharing the stage with it —
//                            "let it be just the gate." The ambient sky
//                            decorations (clouds/particles/rays/haze,
//                            static in index.html) are simply the
//                            backdrop the Gate sits in front of from
//                            frame one. Identical for everyone.
//   3. Identity           — THE BRANCH, and where it ends. A Returning
//                            Creator is recognized ("Welcome home... show
//                            me your stars") and verified via the
//                            existing Creator Signature tap challenge; a
//                            first-time Traveller hears the original
//                            welcome, unchanged, with no mention of
//                            Creator verification or Magic Cards. Neither
//                            branch transitions into Studio or into the
//                            standalone Identity Gate here — both simply
//                            continue into Scene 4. These lines are
//                            HEARD, not witnessed — nobody is visible on
//                            screen yet but the Gate itself, which the
//                            Traveller trusts enough to approach on the
//                            strength of a voice alone.
//   4-5. Approach / Journey Through the Sky — a real cinematic transition
//                            (~7-8s): the TRAVELLER moves, not the Gate —
//                            parallax near/far layers stream past while
//                            the Gate itself grows only modestly, still
//                            bottom-anchored, alone.
//   6. The Gates Open     — Arrival (one deliberate, large Gate growth —
//                            "the doors dominate the screen"), a real
//                            silent Pause (anticipation, nothing new
//                            happens), then magic sparks gather at the
//                            Gate's own runes right as the real Gate
//                            footage (see assets/video/gateway/README.md)
//                            starts playing — its own already-filmed
//                            opening motion carrying both "the runes
//                            ignite" and "the doors slowly unlock, warm
//                            light floods through." This is "welcome
//                            traveller and open the gate" — the Gate
//                            opens entirely on its own, with nobody
//                            beside it.
//   7. Lumo Arrives       — "in next scene let lumo interact with the
//                            traveller." The FIRST moment Lumo is
//                            actually seen this whole sequence: once the
//                            doors have finished opening, Lumo flies in
//                            (the same real flight-video mechanism as
//                            before) and lands at a guard post beside the
//                            now-open doorway, raising one wing and
//                            speaking a short, personal greeting — a real
//                            interaction, in person, now that the
//                            Traveller has proven themselves worthy of
//                            passage. Then a genuine forward camera dolly
//                            + bloom, and only then the final threshold
//                            flash. onComplete() only fires after that
//                            flash — the Hall of Creation (internally:
//                            Studio's own boot sequence) is never visible
//                            before this moment, for anyone, regardless
//                            of path.
//
// Lumo's canon, frozen: welcomes Travellers, recognizes Returning
// Creators, verifies Creator Signatures, guards the Gate, opens the
// Gate — and never enters the Hall, never becomes anyone's companion.
// "The Hall belongs to the Creator. The Gateway belongs to Lumo." The
// Story Egg and any bonded Story Companion only ever MOUNT AS THE HALL'S
// OWN ambient companion inside the Hall (js/companionDirector.js's own
// init(), called from Studio's boot sequence AFTER this whole file's
// onComplete() fires) — the Story Egg has no presence anywhere in this
// file at all; it is purely a Hall concept, resolved independently by
// companionDirector.js, never mounted or referenced here.
//
// Plays automatically, every launch, at the very front of boot — see
// js/app.js's bootstrapSession IIFE, which calls GatewaySequence.begin
// unconditionally and hands its onComplete() straight into Studio's own
// _beginBoot(), never back through the standalone Identity Gate — Scene 3
// above already did that job, for whichever path applied.
//
// Scene 3's Returning-Creator branch reuses js/magicCardUI.js's existing,
// already-polished Creator Signature tap-grid through one minimal, leaner
// entry point — MagicCardUI.beginCreatorSignature(card, onResult) — rather
// than reimplementing any of it. Lumo is the Gatekeeper in both
// experiences, so the Gateway is briefly, non-destructively hidden — never
// torn down, no timers reset — for the one interlude that challenge needs.
//
// Every one of Lumo's behaviours (flight/landing/breathing/blink/cursor-
// tilt/wing-raise/idle wing-flutter/tail sway) is a deliberate CSS-
// transform illusion on ONE flat companion image — no independently-
// animatable wing/tail/eye art layers exist or are fabricated here (see
// css/style.css's own matching comments). "Restrained animation... avoid
// exaggerated cartoon animation... Lumo should feel noble" (Cinematic
// Polish Sprint) governs every keyframe here — small amplitudes, generous
// holds, no bouncing.
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
//
// The Gate itself, in Scene 6, is a real video (see
// assets/video/gateway/README.md) — direct feedback on the original
// CSS-only version of the Gate ("nope, its so bad") led to a real,
// hand-supplied clip replacing it outright, muted (it carries no audio
// track at all) and started via video.play() only once the Gateway
// actually reaches the Awaken beat — never autoplaying ambient sound,
// so the no-autoplay-audio policy above is completely unaffected. A
// further round of feedback ("why dont we make this starting point of
// the traveller animation") is what moved the Gate's own mounting from
// deep inside Scene 6 up to Scene 2 — see mountGates() below. Lumo's own
// mounting (mountLumo(), unchanged since it was built) has since moved
// again, from that same Scene 2 to the very end, Scene 7 — see
// playLumoArrival() below.
//
// A SECOND real Gate video (assets/video/gateway/gate-sequence-final.mp4,
// audio-stripped — see assets/video/gateway/README.md) tells the whole
// "doors alone -> Lumo arrives carrying the Story Egg -> lands and
// presents it -> picks it back up and carries it through the now-open
// door" arc in one continuous shot, no compositing needed. Used for the
// TRAVELLER (first-time) path only — see runTravellerGateway() below.
// The Returning Creator path is deliberately left completely untouched,
// still the original seven-scene, two-video, CSS-composited pipeline
// above: this second clip visibly carries the Story Egg the whole time,
// and per this file's own frozen canon (the Egg is purely a Hall/
// Ceremony concept, never a Gateway one) that doesn't obviously fit a
// Returning Creator, who has already been through their own Ceremony —
// "am unsure [how the returning path should work], i would have to
// remove the egg from the sequence altogether... for now lets just
// focus on traveller first." Revisit once that's resolved.
(function(){
  'use strict';

  const ASSETS_BASE='assets/';
  const GATE_VIDEO_SRC=ASSETS_BASE+'video/gateway/gate-sequence.mp4';
  const GATE_POSTER_SRC=ASSETS_BASE+'video/gateway/gate-poster.jpg';
  // "instead of static png portrait fly in this dragon" — a real,
  // hand-supplied clip (isolated Lumo, solid black background, 5.04s,
  // no baked-in gate/environment — see assets/video/gateway/README.md)
  // replaces the static PNG for the arrival beat outright. mountLumo()
  // still uses the existing .gateway-lumo-arrive CSS keyframe (1.8s,
  // unchanged) to fly the whole video element in from off-screen — only
  // WHAT'S being flown in changed, not the choreography that flies it.
  const LUMO_FLY_VIDEO_SRC=ASSETS_BASE+'video/gateway/lumo-flying.mp4';
  // Same fallback discipline as GATE_POSTER_SRC above: a frame-0 still
  // (Lumo mid-wave, isolated on the identical solid-black background the
  // real clip uses) shown until the video actually has a frame to paint —
  // covers a slow connection, and, in this sandbox specifically, a
  // headless Chromium build with no real H.264 decoder at all (a standing,
  // already-documented limitation for the Gate video too).
  const LUMO_FLY_POSTER_SRC=ASSETS_BASE+'video/gateway/lumo-flying-poster.jpg';

  // How long the video plays before crossfading to the static settled
  // portrait — matches the clip's own real ~5.04s length (with a small
  // buffer so the crossfade starts a beat before the very last frame,
  // never right at a potential end-of-buffer stutter). The .gateway-
  // lumo-arrive transform (off-screen -> guard post) still only takes
  // its own hardcoded 1.8s regardless of this value — once landed, the
  // video keeps playing its own internal flight motion in place for the
  // rest of this window before the swap.
  const FLIGHT_MS=4900;
  // A brief pause after the Gate mounts, before Scene 3's dialogue
  // begins — nothing to fetch or settle anymore (the old version of
  // this constant, LUMO_TO_GREETING_MS, existed to give Lumo's own
  // just-mounted flight-in a beat before speaking; the Gate needs no
  // equivalent registry fetch, this is purely a visual settle).
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
  const LINE_MS=2000;
  const LINE_GAP_MS=550;
  const RETURNING_LINES=[
    'Welcome home.',
    'Show me your stars.'
  ];
  const RETURNING_LINE_MS=2200;
  const RETURNING_LINE_GAP_MS=650;
  // Traveller-only pacing — "increase blank time to 1000ms." Kept as
  // its own constants, distinct from the shared LINE_GAP_MS above
  // (still used by the Returning Creator's own Lumo-arrival lines, see
  // playLumoArrival below), so this change is scoped to only what the
  // user is actually looking at rather than silently retiming the
  // Returning path too. GREETING_END_PAUSE_MS is new — "the traveller
  // greeting looks unfinished ending abruptly": the 4th line used to
  // vanish and the video resumed in the very same instant, with no beat
  // to let the last line land before the scene moves on; this holds on
  // the empty, silent frame for a moment first (the same "real silence,
  // nothing new happens" principle already used elsewhere in this file
  // for the Returning path's own Pause beat).
  const GREETING_GAP_MS=1000;
  const GREETING_END_PAUSE_MS=1200;

  // Scene 7 — Lumo Arrives. "In next scene let lumo interact with the
  // traveller" — the first, and only, lines Lumo actually speaks IN
  // PERSON, once the doors are open and it has flown in to greet
  // whoever just walked up to them. Deliberately short and distinct
  // from Scene 3's own (unseen) lines — a returning Creator already
  // knows who Lumo is, so it gets a warmer, reunion-toned pair rather
  // than a repeated introduction.
  const LUMO_ARRIVAL_LINES=[
    'Well met, Traveller.',
    'Come — your story is waiting.'
  ];
  const LUMO_ARRIVAL_RETURNING_LINES=[
    "It's good to see you again.",
    'Welcome back to your story.'
  ];
  // Same role as GATE_SETTLE_MS above, reused here for the pause
  // between Lumo's own flight-in landing and the first arrival line.
  const LUMO_LANDING_PAUSE_MS=600;

  // ---- Traveller-only path: the single continuous Gate+Lumo clip. ----
  // "show the doors for 2 sec and than let lumo enter sequence till he
  // put the egg down. at this point there should be the interaction
  // sequence... post interaction... continue with the video sequence
  // from 7.5 sec onwards till end. post end show the studio home
  // screen." One video, played in two segments with the greeting/
  // interaction happening in the gap between them.
  const GATE_FINAL_VIDEO_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final.mp4';
  const GATE_FINAL_POSTER_SRC=ASSETS_BASE+'video/gateway/gate-sequence-final-poster.jpg';
  // A deliberate extra hold on the closed, glowing doors before any
  // playback starts at all — "i dont want lumo to enter as soon as the
  // page has loaded." On top of GATE_SETTLE_MS's own small fade-in
  // settle (600ms), giving roughly 2.6s of stillness before Segment 1
  // begins; the footage's own first ~2s (doors alone, no Lumo) then
  // extends that further before Lumo actually becomes visible in frame.
  const GATE_HOLD_MS=2000;
  // Segment 1 plays from the start up to this timestamp, then pauses —
  // Lumo has landed and set the Story Egg down between its feet, wings
  // still spread. This exact held frame is where the interaction (the
  // greeting) plays, in person, rather than heard over an empty screen.
  const PAUSE_AT_S=5;
  // Segment 2 resumes from this timestamp (skipping the brief "Lumo
  // crouches to pick the Egg back up" transition) through to the video's
  // real natural end — Lumo turns, carries the Egg through the now-open
  // door, into the light.
  const RESUME_AT_S=7.5;
  // Safety-only fallback timers (this file's own established discipline
  // — see playGateOpen's own OPEN_FALLBACK_MS): the real waits are
  // driven by video.currentTime/the 'ended' event; these only fire if
  // playback stalls or an event never arrives, so Studio's boot can
  // never hang behind this file.
  const SEGMENT1_FALLBACK_MS=6500;
  const SEGMENT2_FALLBACK_MS=9000;

  // Scene 4 — Approach lead-in. A single quiet "wind rises" beat before
  // the world starts streaming past — the Gate itself is already visible
  // (mounted back in Scene 2), so there is no separate reveal to stage.
  const WIND_RISE_MS=1500;

  // Scene 5 — Journey Through the Sky. Within the epic's own "~5-8s"
  // window; the world moves, not the Gate (Principle 2). Its own real
  // duration also drives the Gate's own modest widening — see
  // .gateway-gates-wrap.gateway-gates-journey in css/style.css.
  const JOURNEY_MS=7400;

  // Scene 6 — The Gates Open, staged as its own five beats.
  const ARRIVE_MS=2400;        // the one deliberate, large Gate growth.
  const PAUSE_MS=2200;         // Principle 5 — do nothing. Real silence.
  const SPARK_LEAD_MS=250;
  const AWAKEN_MS=900;         // magic sparks read before the real footage's own opening motion (playGateOpen, below) takes over.
  const OPEN_FALLBACK_MS=7000; // safety only — the real wait is the video's own 'ended' event; this timer only fires if metadata/ended never arrives.
  const DOLLY_MS=2100;         // forward camera dolly + bloom.
  const THRESHOLD_MS=1150;     // the final light-flood / pass-through flash.

  function prefersReducedMotion(){
    try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  function el(tag,className){
    const e=document.createElement(tag);
    if(className) e.className=className;
    return e;
  }

  function fetchJSON(url){
    return fetch(url).then(function(res){ return res.ok?res.json():null; }).catch(function(){ return null; });
  }

  // Resolves Lumo's own hero portrait purely from the registry's
  // role:'guardian' entry — never a hardcoded id, matching this
  // codebase's own established "no if(id==='lumo')" discipline.
  function resolveLumo(){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      return Promise.resolve(null);
    }
    return window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(list){
      const entry=(list||[]).find(function(e){ return e.role==='guardian'; });
      if(!entry) return null;
      const basePath=ASSETS_BASE+entry.path;
      return fetchJSON(basePath+'companion.json').then(function(pkg){
        if(!pkg) return null;
        const heroFile=(pkg.states&&(pkg.states.hero||pkg.states.idle))||'idle.png';
        return {name:entry.name||'Lumo',src:basePath+heroFile};
      });
    }).catch(function(){ return null; });
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

    // Mounts Lumo's own portrait with the flight-in/landing/settle
    // sequence, a cursor-follow tilt, and a small always-present tail
    // ("wing flutter, tail movement" — Cinematic Polish Sprint,
    // restrained throughout) — the same standing-in-for-"eye tracking"
    // technique companionEngine.js's own corner widget already
    // established, reapplied here at the Gateway's own larger scale.
    // .gateway-lumo-guard is added SYNCHRONOUSLY, before the flight-in
    // keyframe even plays — the whole stage (shadow+portrait+wing+tail)
    // is offset to its watch post beside the (already open) Gate from
    // the very first frame, so Lumo's own relative flight-in animation
    // (on the <img>, unchanged) composes with that offset and Lumo
    // visibly flies in from further off-screen and lands exactly at its
    // guard position. Unchanged since it was first built — only WHEN it
    // is called has moved, from Scene 2 to Scene 7, see
    // playLumoArrival() below. Lumo then simply stays there for the
    // rest of the sequence; only .gateway-lumo-magic (the wing-raise
    // greeting, now Scene 7's own beat rather than Scene 6's) is ever
    // toggled again. Returns a cleanup function removing the one
    // document-level listener this adds; the DOM node itself is torn
    // down wholesale by done()'s own content.innerHTML='' on
    // completion.
    function mountLumo(lumo,reduced){
      const stage=el('div','gateway-lumo-stage gateway-lumo-guard');
      const shadow=el('div','gateway-lumo-shadow');
      // The static hero portrait is still what Lumo settles into once
      // it lands — only the ARRIVAL itself now uses the real video (see
      // LUMO_FLY_VIDEO_SRC above). It starts .gateway-lumo-pending
      // (invisible) whenever a video is playing the arrival instead, so
      // the two never show at once; reduced motion skips the video
      // entirely and the portrait is simply already settled.
      const img=el('img','gateway-lumo-portrait');
      img.src=lumo.src;
      img.alt=lumo.name;
      const wing=el('div','gateway-lumo-wing');
      const tail=el('div','gateway-lumo-tail');
      let flyVideo=null;
      if(reduced){
        img.classList.add('gateway-lumo-settled');
      }else{
        img.classList.add('gateway-lumo-pending');
        flyVideo=el('video','gateway-lumo-portrait gateway-lumo-flying gateway-lumo-flyvideo');
        flyVideo.muted=true;
        flyVideo.playsInline=true;
        flyVideo.preload='auto';
        flyVideo.poster=LUMO_FLY_POSTER_SRC;
        flyVideo.src=LUMO_FLY_VIDEO_SRC;
      }
      stage.appendChild(shadow);
      if(flyVideo) stage.appendChild(flyVideo);
      stage.appendChild(img);
      stage.appendChild(tail);
      stage.appendChild(wing);
      content.appendChild(stage);
      if(flyVideo){
        try{ flyVideo.play().catch(function(){}); }catch(e){}
      }
      const onMove=function(e){
        try{
          const rect=stage.getBoundingClientRect();
          const cx=rect.left+rect.width/2;
          const dx=Math.max(-1,Math.min(1,(e.clientX-cx)/(rect.width/2)));
          img.style.setProperty('--gateway-tilt',(dx*6).toFixed(2)+'deg');
        }catch(err){}
      };
      if(!reduced) document.addEventListener('mousemove',onMove);
      after(reduced?0:FLIGHT_MS,function(){
        if(flyVideo){
          flyVideo.classList.add('gateway-lumo-flyvideo-out');
          after(260,function(){
            if(flyVideo&&flyVideo.parentNode){
              try{ flyVideo.pause(); }catch(e){}
              flyVideo.parentNode.removeChild(flyVideo);
            }
          });
          img.classList.remove('gateway-lumo-pending');
        }
        img.classList.add('gateway-lumo-settled');
        stage.classList.add('gateway-lumo-idle');
      });
      return {
        stage:stage,
        img:img,
        cleanup:function cleanup(){
          document.removeEventListener('mousemove',onMove);
          // Defensive, matching the Gate video's own discipline (done()
          // already pauses gateVideoEl before tearing it down) — if the
          // Traveller taps to skip mid-arrival, content.innerHTML=''
          // removes this element regardless, but pausing first stops it
          // decoding/playing in the background a moment sooner.
          if(flyVideo){ try{ flyVideo.pause(); }catch(e){} }
        }
      };
    }

    // Reveals `lines` one at a time, each staying up for lineMs with a
    // gapMs pause before the next — the epic's own "natural paced
    // lines... [pause]" framing, made real, shared by both the
    // Traveller greeting and the Returning Creator's shorter welcome.
    // No tutorials/UI instructions anywhere in either array by design.
    // `reduced` genuinely shortens each line's own hold time at the JS
    // level (not just a CSS backstop) — six real scenes is long enough
    // that a reduced-motion boot must still resolve quickly.
    function playLines(lines,lineMs,gapMs,reduced,onDone){
      if(reduced){ lineMs=120; gapMs=0; }
      const bubble=el('div','gateway-greeting-bubble');
      content.appendChild(bubble);
      let i=0;
      function nextLine(){
        if(skipRequested) return;
        if(i>=lines.length){ onDone(bubble); return; }
        bubble.classList.remove('gateway-greeting-in');
        const line=lines[i];
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
        void bubble.offsetWidth; // force reflow so the fade-in re-triggers every line
        bubble.classList.add('gateway-greeting-in');
        i++;
        after(lineMs+gapMs,nextLine);
      }
      nextLine();
    }

    // Preloads the real Gate video as early as possible — called from the
    // very start of begin(), long before Scene 2 needs it, so its ~4.5MB
    // has as much runtime as possible to buffer. Kept off-screen (not
    // merely off-DOM — some browsers pause loading a detached element) via
    // .gateway-preload-hidden until mountGates() moves this SAME element
    // (never a fresh one) into the visible frame, preserving whatever it
    // already downloaded. Muted + no audio track at all, so this never
    // touches the no-autoplay-audio policy above.
    function preloadGateVideo(){
      try{
        const video=el('video','gateway-preload-hidden');
        video.muted=true;
        video.playsInline=true;
        video.preload='auto';
        video.poster=GATE_POSTER_SRC;
        video.src=GATE_VIDEO_SRC;
        video.setAttribute('aria-hidden','true');
        return video;
      }catch(e){ return null; }
    }

    // Scene 2 — mounts the Gate (its real footage, paused on its own
    // first frame, at a modest resting size — see .gateway-gates-wrap in
    // css/style.css) alone: "remove egg and lumo from the scene. let it
    // be just the gate." `video` is the SAME element preloadGateVideo
    // mounted earlier, simply moved into the visible frame here, never
    // recreated, so none of its buffered download is lost. Returns the
    // element refs every later phase animates.
    function mountGates(video){
      const wrap=el('div','gateway-gates-wrap');
      const gate=el('div','gateway-gates');
      gate.appendChild(el('div','gateway-gate-halo'));
      const frame=el('div','gateway-gate-video-frame');
      if(video){
        video.classList.remove('gateway-preload-hidden');
        video.classList.add('gateway-gate-video');
        frame.appendChild(video);
      }
      gate.appendChild(frame);
      ['gp1','gp2','gp3','gp4','gp5'].forEach(function(cls){
        gate.appendChild(el('span','gateway-gate-gather-particle '+cls));
      });
      wrap.appendChild(gate);
      content.appendChild(wrap);
      requestAnimationFrame(function(){ wrap.classList.add('gateway-gates-visible'); });
      return {wrap:wrap,video:video||null};
    }

    // ---- Traveller-only path helpers (see the header comment's own
    // "A SECOND real Gate video" note) — the Returning Creator path
    // above is completely untouched and never calls any of these. ----

    // Same idea as preloadGateVideo() above, pointed at the second real
    // clip instead — kept off-screen until mountFinalGate() moves this
    // SAME element into the visible frame.
    function preloadFinalGateVideo(){
      try{
        const video=el('video','gateway-preload-hidden');
        video.muted=true;
        video.playsInline=true;
        video.preload='auto';
        video.poster=GATE_FINAL_POSTER_SRC;
        video.src=GATE_FINAL_VIDEO_SRC;
        video.setAttribute('aria-hidden','true');
        return video;
      }catch(e){ return null; }
    }

    // Mounts the second Gate video full-bleed and alone, reusing the
    // exact same full-bleed wrapper CSS as mountGates() above
    // (.gateway-gates-wrap/.gateway-gates/.gateway-gate-video-frame) —
    // but skips the halo/gather-particle children entirely: this clip
    // already has its own magic (the Egg's glow, the runes, the light)
    // baked into its own footage, so there is nothing left for a
    // separate CSS spark layer to add.
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

    // The Traveller path's own final beat — a brief flash before the cut
    // to the Hall, reusing the exact same .gateway-threshold-flash CSS
    // the returning path's playThreshold() uses. No forward camera dolly
    // here — the video's own final seconds already read as a camera-
    // through-the-light moment on their own; stacking a CSS zoom on top
    // would double up rather than add anything.
    function playFinalFlash(reduced,onDone){
      if(skipRequested) return;
      const flash=el('div','gateway-threshold-flash');
      content.appendChild(flash);
      requestAnimationFrame(function(){
        flash.classList.add('gateway-threshold-flash-in');
      });
      after(reduced?150:THRESHOLD_MS,onDone);
    }

    // Scene 4 — Approach lead-in. A single quiet beat before the Journey
    // (Scene 5) — the Gate itself needs no reveal of its own, it has been
    // visible since Scene 2. "Remove the environment elements" retired
    // the ambient wind-streak decorations this beat used to speed up; the
    // pause itself (and its place in the six-scene pipeline) is kept.
    function playApproachLeadIn(reduced,onDone){
      after(reduced?0:WIND_RISE_MS,onDone);
    }

    // Scene 5 — "Do NOT teleport. Travel." Principle 2: the TRAVELLER
    // moves, the Gate does not — the Gate itself grows modestly (its own
    // Journey zoom, .gateway-gates-wrap.gateway-gates-journey) while
    // Lumo stays fixed at its guard post the whole time (Lumo no longer
    // flies ahead leading a multi-leg journey — see "Lumo Guards the
    // Gate" in the header comment above). "Remove the environment
    // elements" retired the streaming cloud/mountain/bird parallax bands
    // that used to cross the screen here — the real, full-bleed video
    // already reads as travel on its own. The one deliberate large
    // growth is reserved for Arrival, below.
    function playJourney(gateEls,reduced,onDone){
      gateEls.wrap.classList.add('gateway-gates-journey');
      after(reduced?250:JOURNEY_MS,onDone);
    }

    // Scene 6, beat 1 — Arrival. Principle 4: ONE deliberate, large Gate
    // growth so the doors genuinely dominate the screen — "massive,
    // timeless, sacred" — never simulated by scaling continuously
    // through the Journey. Lumo stays exactly where it already is (its
    // .gateway-lumo-guard position never changes) — its elevated z-index
    // (see css/style.css) keeps it visibly standing in front of the now-
    // massive doorway rather than being buried underneath it. Then, beat
    // 2 — Principle 5's real anticipation Pause: nothing new happens,
    // only the Gate's own halo glow quiets slightly (.gateway-hush)
    // before the magic begins.
    function playArrival(gateEls,reduced,onDone){
      gateEls.wrap.classList.remove('gateway-gates-journey');
      gateEls.wrap.classList.add('gateway-gates-arrive');
      after(reduced?150:ARRIVE_MS,function(){
        if(skipRequested) return;
        overlay.classList.add('gateway-hush');
        after(reduced?150:PAUSE_MS,function(){
          overlay.classList.remove('gateway-hush');
          onDone();
        });
      });
    }

    // Scene 6, beat 3 — "Magic begins." Nobody is beside the Gate at
    // this point (Lumo doesn't arrive until Scene 7, below) — the Gate
    // opens entirely on its own: a small burst of gold sparks gathers
    // and travels across its own runes, which ignite one at a time
    // rather than all at once ("ancient mechanisms awaken... locks
    // awaken"). "Welcome traveller and open the gate."
    function spawnMagicSparks(){
      const wrap=el('div','gateway-magic-sparks');
      for(let i=0;i<5;i++){
        const s=el('span','gateway-magic-spark');
        s.style.setProperty('--si',String(i));
        wrap.appendChild(s);
      }
      content.appendChild(wrap);
    }
    function playGateAwaken(gateEls,reduced,onDone){
      after(reduced?100:SPARK_LEAD_MS,function(){
        if(skipRequested) return;
        spawnMagicSparks();
        gateEls.wrap.classList.add('gateway-gates-awaken');
        // The real footage's own opening motion IS the "doors open" beat
        // (see playGateOpen, below) — never played under reduced motion,
        // matching every other new animation this sprint added.
        if(gateEls.video&&!reduced){
          try{
            const p=gateEls.video.play();
            if(p&&p.catch) p.catch(function(){});
          }catch(e){}
        }
        after(reduced?150:AWAKEN_MS,onDone);
      });
    }

    // Scene 6, beat 4 — Principle 6: the stone doors slowly unlocking and
    // swinging outward, warm light pouring through the widening gap, is
    // the real Gate footage's own already-filmed motion (started in
    // playGateAwaken, above) — this beat simply waits for it to finish,
    // via the video's genuine 'ended' event, rather than a fixed CSS
    // animation timer. A duration-based fallback guarantees Studio's own
    // boot never hangs behind this even if metadata/ended never arrives
    // (a network hiccup, a future browser without support for this file).
    function playGateOpen(gateEls,reduced,onDone){
      const video=gateEls.video;
      if(reduced||!video){
        after(200,onDone);
        return;
      }
      let settled=false;
      function finish(){
        if(settled) return;
        settled=true;
        video.removeEventListener('ended',finish);
        onDone();
      }
      video.addEventListener('ended',finish);
      const fallbackMs=(isFinite(video.duration)&&video.duration>0)
        ? Math.ceil(video.duration*1000)+800
        : OPEN_FALLBACK_MS;
      after(fallbackMs,finish);
    }

    // Scene 7's own final beat — crossing the threshold. A genuine
    // forward camera dolly (the whole overlay — sky, Gate, and Lumo
    // together — scales up and brightens, "soft bloom") plays BEFORE
    // the final flash, rather than jumping straight from Lumo's own
    // greeting to a flood. Principle 7: the flash holds at full opacity
    // before the cut, so the Hall is never glimpsed mid-transition.
    function playThreshold(reduced,onDone){
      overlay.classList.add('gateway-threshold-dolly');
      after(reduced?150:DOLLY_MS,function(){
        if(skipRequested) return;
        const flash=el('div','gateway-threshold-flash');
        content.appendChild(flash);
        requestAnimationFrame(function(){
          flash.classList.add('gateway-threshold-flash-in');
        });
        after(reduced?150:THRESHOLD_MS,onDone);
      });
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

      let cleanupLumo=null;
      let lumoRef=null;
      let gateVideoEl=null;
      let gateEls=null;
      const done=function(){
        clearTimers();
        unwireSkip();
        try{ if(cleanupLumo) cleanupLumo(); }catch(e){}
        try{ if(gateVideoEl) gateVideoEl.pause(); }catch(e){}
        overlay.classList.add('hidden');
        overlay.classList.remove('gateway-mode-hidden-for-signature','gateway-hush','gateway-threshold-dolly');
        content.innerHTML='';
        skipRequested=false;
        try{ onComplete(); }catch(e){}
      };

      overlay.classList.remove('hidden','gateway-mode-hidden-for-signature','gateway-hush','gateway-threshold-dolly');
      content.innerHTML='';
      skipRequested=false;
      wireSkip(done);

      const reduced=prefersReducedMotion();
      after(reduced?800:TAP_HINT_DELAY_MS,showTapHint);

      // Session detection happens before the Gateway — "The Traveller
      // Journey ends before the Gateway begins" — computed once, up
      // front, with no visuals of its own. It now also decides WHICH
      // Gate video to preload (see the header comment's own "A SECOND
      // real Gate video" note) — the two paths use genuinely different
      // footage, so there is no single video to kick off before this
      // resolves.
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

      // Scene 7 — "in next scene let lumo interact with the traveller."
      // The doors have just finished opening (playGateOpen has already
      // called onDone below) — Lumo flies in for the very first time
      // this whole sequence and lands at its guard post beside them,
      // raising one wing as it speaks a short, personal greeting.
      // lumoRef/cleanupLumo are written into begin()'s own outer
      // closure exactly like every other per-scene element, so a
      // tap-to-skip mid-arrival still cleans up correctly via the
      // shared done() path. Degrades gracefully straight to onDone()
      // if the Guardian's own art can't be resolved at all — Studio's
      // boot must never hang behind a missing asset.
      function playLumoArrival(onDone){
        resolveLumo().then(function(lumo){
          if(skipRequested) return;
          if(!lumo){ onDone(); return; }
          lumoRef=mountLumo(lumo,reduced);
          cleanupLumo=lumoRef.cleanup;
          after(reduced?0:LUMO_LANDING_PAUSE_MS,function(){
            if(skipRequested) return;
            lumoRef.stage.classList.add('gateway-lumo-magic');
            const lines=isReturning?LUMO_ARRIVAL_RETURNING_LINES:LUMO_ARRIVAL_LINES;
            playLines(lines,LINE_MS,LINE_GAP_MS,reduced,function(bubble){
              if(bubble&&bubble.parentNode) bubble.parentNode.removeChild(bubble);
              onDone();
            });
          });
        }).catch(function(){
          if(!skipRequested) onDone();
        });
      }

      // Scenes 4-7 — the transition this sprint exists to fix, now
      // ending with Lumo's own in-person arrival rather than a straight
      // cut to the threshold. Each beat is its own small function
      // above, chained here in order. gateEls is guaranteed to exist by
      // the time this runs — mounted synchronously back in Scene 2 (see
      // the block right after this function).
      function runGatesSequence(){
        if(skipRequested) return;
        playApproachLeadIn(reduced,function(){
          if(skipRequested) return;
          playJourney(gateEls,reduced,function(){
            if(skipRequested) return;
            playArrival(gateEls,reduced,function(){
              if(skipRequested) return;
              playGateAwaken(gateEls,reduced,function(){
                if(skipRequested) return;
                playGateOpen(gateEls,reduced,function(){
                  if(skipRequested) return;
                  playLumoArrival(function(){
                    if(skipRequested) return;
                    playThreshold(reduced,function(){
                      if(skipRequested) return;
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      }

      // Scene 3 — the branch, and where it ends. Neither outcome ever
      // transitions into Studio or into the standalone Identity Gate
      // here; both simply continue into Scene 4 above.
      function runScene3(){
        if(skipRequested) return;
        if(isReturning&&card){
          playLines(RETURNING_LINES,RETURNING_LINE_MS,RETURNING_LINE_GAP_MS,reduced,function(bubble){
            if(skipRequested) return;
            if(typeof MagicCardUI==='undefined'||!MagicCardUI.beginCreatorSignature){
              // No Creator Signature challenge could be reached — a
              // real, honest degrade straight into the Gates, never a
              // Gateway that hangs Studio's own boot behind a feature
              // that isn't there.
              runGatesSequence();
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
              if(!success){
                // A declined/failed check never blocks the physical
                // Gateway — it simply proceeds without a recognized
                // identity, exactly like a first-time Traveller would.
                try{ if(typeof MagicCard!=='undefined') MagicCard.setActive(null); }catch(e){}
              }
              runGatesSequence();
            });
          });
        }else{
          playLines(GREETING_LINES,LINE_MS,LINE_GAP_MS,reduced,function(bubble){
            if(bubble&&bubble.parentNode) bubble.parentNode.removeChild(bubble);
            runGatesSequence();
          });
        }
      }

      // Traveller path — "show the doors for 2 sec and than let lumo
      // enter sequence till he put the egg down. at this point there
      // should be the interaction sequence with traveller... post
      // interaction... continue with the video sequence from 7.5 sec
      // onwards till end. post end show the studio home screen." One
      // continuous clip, played in two segments with the greeting in
      // the gap between them — no separate Approach/Journey/Arrival/
      // Awaken/Open/Lumo-arrival scenes needed, the video already tells
      // that whole story on its own.
      function runTravellerGateway(){
        gateEls=mountFinalGate(gateVideoEl);
        after(reduced?0:(GATE_SETTLE_MS+GATE_HOLD_MS),function(){
          if(skipRequested) return;
          playVideoSegmentTo(gateVideoEl,PAUSE_AT_S,SEGMENT1_FALLBACK_MS,reduced,function(){
            if(skipRequested) return;
            playLines(GREETING_LINES,LINE_MS,GREETING_GAP_MS,reduced,function(bubble){
              if(bubble&&bubble.parentNode) bubble.parentNode.removeChild(bubble);
              if(skipRequested) return;
              after(reduced?0:GREETING_END_PAUSE_MS,function(){
                if(skipRequested) return;
                playVideoSegmentToEnd(gateVideoEl,RESUME_AT_S,SEGMENT2_FALLBACK_MS,reduced,function(){
                  if(skipRequested) return;
                  playFinalFlash(reduced,done);
                });
              });
            });
          });
        });
      }

      // "use the gate sequence for the point go, we dont need any sky
      // sequence" — the Gate is the very first thing shown, not eased
      // into after a separate atmosphere-only pause. The ambient sky
      // decorations (clouds/particles/rays/haze, static in index.html)
      // still form the backdrop the Gate sits in front of.
      if(isReturning){
        // Unchanged, still the original seven-scene, two-video pipeline
        // — see the header comment's own "A SECOND real Gate video"
        // note for why this path is deliberately left exactly as-is.
        gateVideoEl=preloadGateVideo();
        if(gateVideoEl) content.appendChild(gateVideoEl);
        gateEls=mountGates(gateVideoEl);
        after(reduced?0:GATE_SETTLE_MS,runScene3);
      }else{
        gateVideoEl=preloadFinalGateVideo();
        if(gateVideoEl) content.appendChild(gateVideoEl);
        runTravellerGateway();
      }
    }

    return {begin:begin};
  })();

  try{ window.GatewaySequence=GatewaySequence; }catch(e){}
})();
