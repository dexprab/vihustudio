// js/gatewaySequence.js — The Traveller Gateway (VihuPlanet Canon Milestone
// 1, reworked under the "Canon Update Sprint — Traveller Gateway Rework
// (V1.1)" specification). Two ideas that were previously conflated are now
// kept explicitly separate:
//
//   Traveller Journey  — WHO is arriving (a Returning Creator or a
//                         first-time Traveller). A branching DECISION,
//                         resolved silently before Scene 1 ever paints.
//                         It is NOT the Gateway itself.
//
//   Traveller Gateway  — the physical cinematic journey from the Sky into
//                         the Hall of Creation. It always begins in the
//                         Sky and always ends inside the Hall.
//                         EVERY person experiences it — a Returning
//                         Creator and a first-time Traveller alike. "The
//                         only difference is what happens before the
//                         gates open" (Scene 3).
//
// Six scenes, always in this order:
//   1. The Sky            — arrival, anticipation. Identical for everyone.
//   2. Lumo's Arrival     — a real flight-and-landing. Identical for
//                            everyone.
//   3. Identity           — THE BRANCH, and where it ends. A Returning
//                            Creator is recognized ("Welcome home... show
//                            me your stars") and verified via the
//                            existing Creator Signature tap challenge; a
//                            first-time Traveller hears the original
//                            4-line greeting, unchanged, with no mention
//                            of Creator verification or Magic Cards.
//                            Neither branch transitions into Studio or
//                            into the standalone Identity Gate here —
//                            both simply continue into Scene 4.
//   4. The Gates Appear   — a slow reveal. No sudden appearance.
//   5. Journey Through the Sky — a real cinematic transition (~5-8s),
//                            never a teleport: cloud bridge, floating
//                            islands, birds, particles, Lumo flying
//                            ahead, the gates growing larger.
//   6. The Gates Open     — Lumo turns back, raises one wing, magic
//                            flows, ancient constellations illuminate,
//                            the stone doors slowly unlock, warm golden
//                            light floods through, the camera passes the
//                            threshold. Only THEN does onComplete() fire
//                            — the Hall of Creation (internally: Studio's
//                            own boot sequence) is never visible before
//                            this moment, for anyone, regardless of path.
//
// Lumo's canon, frozen: welcomes Travellers, recognizes Returning
// Creators, verifies Creator Signatures, summons the Gates, opens the
// Gates — and never enters the Hall, never becomes anyone's companion.
// "The Hall belongs to the Creator. The Gateway belongs to Lumo." Story
// Egg and any bonded Story Companion only ever mount inside the Hall
// (js/companionDirector.js's own init(), called from Studio's boot
// sequence AFTER this whole file's onComplete() fires) — never here.
//
// Plays automatically, every launch, at the very front of boot — see
// js/app.js's bootstrapSession IIFE, which now calls GatewaySequence.begin
// unconditionally (the prior "only for a device with no known Magic Card"
// gate is exactly what this rework's own "Remove Legacy Flow" instruction
// retires) and hands its onComplete() straight into Studio's own
// _beginBoot(), never back through the standalone Identity Gate — Scene 3
// above already did that job, for whichever path applied.
//
// Scene 3's Returning-Creator branch reuses js/magicCardUI.js's existing,
// already-polished Creator Signature tap-grid (star-glow, decoy
// camouflage, board-fit sizing) through one new, minimal, leaner entry
// point — MagicCardUI.beginCreatorSignature(card, onResult) — rather than
// reimplementing any of it or routing through the heavier, picker-capable
// checkIdentityGate(). Since that challenge's own overlay sits at a LOWER
// z-index than the Gateway's (so the Gateway can safely sit "just above"
// every other overlay as a defensive default the rest of the time), the
// Gateway is briefly, non-destructively hidden — never torn down, no
// timers reset — for the one interlude that challenge needs, then shown
// again the instant it resolves. Lumo is the Gatekeeper in both
// experiences, so this reads as one continuous encounter with one actor,
// never a hand-off to someone else.
//
// Lumo's flight/landing/breathing/blink/cursor-tilt/turn/wing-raise
// "aliveness" is a deliberate CSS-transform illusion on ONE flat
// companion image — no independently-animatable wing/tail/eye art layers
// exist or are fabricated here, matching the exact technique already
// proven for the Magic Card Identity Gate's own "flying guard" gatekeeper
// header (css/style.css's .magic-card-gatekeeper-* rules); "raises one
// wing" (Scene 6) is realized the same honest, disclosed way — a small,
// separate CSS wing shape revealed and rotated alongside the portrait,
// not a second art asset. js/companionEngine.js (the generic corner-
// widget runtime) is NOT used to mount any of this — the Gateway stage is
// a separate, much larger-scale presentation, resolved independently via
// CompanionEngine.loadRegistry() + a raw <img>, the same pattern
// js/magicCardUI.js's own Creator Ceremony stage already established for
// its own big centered staging. Nothing here ever mutates a live
// CompanionEngine instance's own state.
(function(){
  'use strict';

  const ASSETS_BASE='assets/';
  const SCENE1_MS=2400;            // Scene 1 — a few seconds of sky before Lumo arrives.
  const FLIGHT_MS=1800;            // Scene 2 — Lumo's own flight-in + landing settle.
  const LUMO_TO_GREETING_MS=600;   // a breath after landing, before speaking.
  const TAP_HINT_DELAY_MS=3600;    // when the quiet "tap to continue" hint appears.
  const GREETING_LINES=[           // Scene 3 — Traveller branch. Unchanged from Milestone 1.
    'Welcome, Traveller.',
    'I am Lumo.',
    'Guardian of Story Companions.',
    'Every Creator begins here.'
  ];
  const LINE_MS=2000;
  const LINE_GAP_MS=550;           // the epic's own "[pause]" between lines.
  const RETURNING_LINES=[          // Scene 3 — Returning Creator branch.
    'Welcome home.',
    'Show me your stars.'
  ];
  const RETURNING_LINE_MS=2200;
  const RETURNING_LINE_GAP_MS=650;
  const GATES_APPEAR_MS=2800;      // Scene 4 — the slow curtain-parting reveal.
  const JOURNEY_MS=6800;           // Scene 5 — within the epic's own "~5-8s" window.
  const GATES_OPEN_MS=3400;        // Scene 6 — turn, wing, magic, doors unlocking.
  const THRESHOLD_MS=900;          // the final light-flood / pass-through flash.

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
    // sequence and a cursor-follow tilt — the same standing-in-for-"eye
    // tracking" technique companionEngine.js's own corner widget already
    // established, reapplied here at the Gateway's own larger scale.
    // Every later scene (Journey, Gates Open) toggles classes on the
    // returned `stage` element so the shadow/portrait/wing all move
    // together as one figure. Returns a cleanup function removing the
    // one document-level listener this adds; the DOM node itself is torn
    // down wholesale by done()'s own content.innerHTML='' on completion.
    function mountLumo(lumo,reduced){
      const stage=el('div','gateway-lumo-stage');
      const shadow=el('div','gateway-lumo-shadow');
      const img=el('img','gateway-lumo-portrait gateway-lumo-flying');
      img.src=lumo.src;
      img.alt=lumo.name;
      const wing=el('div','gateway-lumo-wing');
      stage.appendChild(shadow);
      stage.appendChild(img);
      stage.appendChild(wing);
      content.appendChild(stage);
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
        img.classList.remove('gateway-lumo-flying');
        img.classList.add('gateway-lumo-settled');
      });
      return {
        stage:stage,
        img:img,
        cleanup:function cleanup(){ document.removeEventListener('mousemove',onMove); }
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
        bubble.textContent=lines[i];
        void bubble.offsetWidth; // force reflow so the fade-in re-triggers every line
        bubble.classList.add('gateway-greeting-in');
        i++;
        after(lineMs+gapMs,nextLine);
      }
      nextLine();
    }

    // Scene 4 — mounts the Gates (initially small, distant, hidden) plus
    // two "curtain" cloud shapes obscuring them, then triggers the slow
    // parting-and-reveal. Returns the element refs Scenes 5-6 animate.
    function mountGates(){
      const wrap=el('div','gateway-gates-wrap');
      const gate=el('div','gateway-gates');
      gate.appendChild(el('div','gateway-gate-glow'));
      gate.appendChild(el('div','gateway-gate-arch'));
      gate.appendChild(el('div','gateway-gate-leaf gateway-gate-leaf-left'));
      gate.appendChild(el('div','gateway-gate-leaf gateway-gate-leaf-right'));
      const r1=el('span','gateway-gate-rune gateway-gate-rune-1'); r1.textContent='✦';
      const r2=el('span','gateway-gate-rune gateway-gate-rune-2'); r2.textContent='✧';
      const r3=el('span','gateway-gate-rune gateway-gate-rune-3'); r3.textContent='✦';
      gate.appendChild(r1); gate.appendChild(r2); gate.appendChild(r3);
      wrap.appendChild(gate);
      const curtainL=el('div','gateway-curtain-cloud gateway-curtain-left');
      const curtainR=el('div','gateway-curtain-cloud gateway-curtain-right');
      content.appendChild(wrap);
      content.appendChild(curtainL);
      content.appendChild(curtainR);
      return {wrap:wrap,curtainL:curtainL,curtainR:curtainR};
    }

    function playGatesAppear(gateEls,reduced,onDone){
      requestAnimationFrame(function(){
        gateEls.wrap.classList.add('gateway-gates-reveal');
        gateEls.curtainL.classList.add('gateway-curtain-parted');
        gateEls.curtainR.classList.add('gateway-curtain-parted');
      });
      after(reduced?250:GATES_APPEAR_MS,onDone);
    }

    // Scene 5 — "Do NOT teleport. Travel." The gates grow larger over
    // the whole duration (approach), Lumo's own stage drifts ahead with
    // an occasional look-back flip, and a handful of extra floating
    // islands stream past for a genuine sense of forward motion — on top
    // of the ambient sky's own clouds/birds/particles, sped up for the
    // same reason while this scene is active.
    function playJourney(gateEls,lumoRef,reduced,onDone){
      overlay.classList.add('gateway-journey-active');
      gateEls.wrap.classList.add('gateway-gates-journey');
      if(lumoRef&&lumoRef.stage) lumoRef.stage.classList.add('gateway-lumo-journey');
      const extras=el('div','gateway-journey-extras');
      const glyphs=['🏝️','☁️','🕊️'];
      for(let i=0;i<3;i++){
        const isl=el('span','gateway-journey-island');
        isl.textContent=glyphs[i];
        isl.style.setProperty('--i',String(i));
        extras.appendChild(isl);
      }
      content.appendChild(extras);
      after(reduced?250:JOURNEY_MS,onDone);
    }

    // Scene 6 — Lumo reaches the gates, turns back toward the Traveller
    // (a flip transform — see this file's own header on the illusion),
    // raises one wing, magic flows, the constellations illuminate, the
    // stone doors slowly unlock, and warm golden light floods through.
    // Only after the threshold-crossing flash finishes does onDone()
    // (and, from begin(), onComplete()) fire — the Hall is never visible
    // before this moment.
    function playGatesOpen(gateEls,lumoRef,reduced,onDone){
      if(lumoRef&&lumoRef.stage){
        lumoRef.stage.classList.remove('gateway-lumo-journey');
        lumoRef.stage.classList.add('gateway-lumo-turn');
      }
      requestAnimationFrame(function(){
        gateEls.wrap.classList.add('gateway-gates-open');
      });
      after(reduced?200:GATES_OPEN_MS,function(){
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
      const done=function(){
        clearTimers();
        unwireSkip();
        try{ if(cleanupLumo) cleanupLumo(); }catch(e){}
        overlay.classList.add('hidden');
        overlay.classList.remove('gateway-journey-active','gateway-mode-hidden-for-signature');
        content.innerHTML='';
        skipRequested=false;
        try{ onComplete(); }catch(e){}
      };

      overlay.classList.remove('hidden','gateway-journey-active','gateway-mode-hidden-for-signature');
      content.innerHTML='';
      skipRequested=false;
      wireSkip(done);

      const reduced=prefersReducedMotion();
      after(reduced?800:TAP_HINT_DELAY_MS,showTapHint);

      // Session detection happens before the Gateway — "The Traveller
      // Journey ends before the Gateway begins" — computed once, up
      // front, with no visuals of its own; Scene 3 below is simply the
      // first moment that content differs between the two outcomes.
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

      function runGatesSequence(){
        if(skipRequested) return;
        const gateEls=mountGates();
        playGatesAppear(gateEls,reduced,function(){
          if(skipRequested) return;
          playJourney(gateEls,lumoRef,reduced,function(){
            if(skipRequested) return;
            playGatesOpen(gateEls,lumoRef,reduced,function(){
              if(skipRequested) return;
              done();
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

      after(reduced?0:SCENE1_MS,function(){
        if(skipRequested) return;
        resolveLumo().then(function(lumo){
          if(skipRequested) return;
          if(!lumo){
            runScene3();
            return;
          }
          lumoRef=mountLumo(lumo,reduced);
          cleanupLumo=lumoRef.cleanup;
          after(reduced?0:LUMO_TO_GREETING_MS,function(){
            if(!skipRequested) runScene3();
          });
        }).catch(function(){ if(!skipRequested) runScene3(); });
      });
    }

    return {begin:begin};
  })();

  try{ window.GatewaySequence=GatewaySequence; }catch(e){}
})();
