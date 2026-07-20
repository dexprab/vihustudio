// js/gatewaySequence.js — The Traveller Gateway (VihuPlanet Canon Milestone
// 1, reworked under "Canon Update Sprint — Traveller Gateway Rework V1.1",
// then given a full cinematic polish pass under "Cinematic Polish Sprint —
// Traveller Gateway V1"). Two ideas that were previously conflated are kept
// explicitly separate:
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
//   4. The Gates Appear   — a slow REVEAL, never a pop/fade: wind rises,
//                            a golden light glows behind the still-hidden
//                            Gate, curtain clouds part onto a dark
//                            silhouette, then the silhouette brightens
//                            into real stone with texture, and particles
//                            gather onto it.
//   5. Journey Through the Sky — a real cinematic transition (~7-8s): the
//                            TRAVELLER moves, not the Gate — parallax
//                            near/far layers stream past while Lumo leads
//                            with a real "fly a leg, glance back, wait,
//                            continue" sequence; the Gate itself grows
//                            only modestly here.
//   6. The Gates Open     — Arrival (one deliberate, large Gate growth —
//                            "the doors dominate the screen"), a real
//                            silent Pause (anticipation, nothing new
//                            happens), then Lumo raises one wing and
//                            magic begins, the runes ignite one at a
//                            time, the stone doors slowly unlock, warm
//                            golden light floods through, a genuine
//                            forward camera dolly + bloom, and only then
//                            the final threshold flash. onComplete() only
//                            fires after that flash — the Hall of
//                            Creation (internally: Studio's own boot
//                            sequence) is never visible before this
//                            moment, for anyone, regardless of path.
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
// tilt/leading/turning/wing-raise/idle wing-flutter/tail sway) is a
// deliberate CSS-transform illusion on ONE flat companion image — no
// independently-animatable wing/tail/eye art layers exist or are
// fabricated here (see css/style.css's own matching comments). "Restrained
// animation... avoid exaggerated cartoon animation... Lumo should feel
// noble" (Cinematic Polish Sprint) governs every new keyframe added this
// pass — small amplitudes, generous holds, no bouncing.
//
// A disclosed, deliberate scope decision on Audio: the sprint's own brief
// asks for "subtle layers — wind, birds, magic, deep stone resonance" on
// top of the existing ambience. No real audio matching any of those exists
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
(function(){
  'use strict';

  const ASSETS_BASE='assets/';

  // Scenes 1-3 timing is UNCHANGED this sprint — "The Sky works. Lumo
  // works. The greeting works... This sprint is about fixing [the
  // transition]," per the brief's own Current Assessment. Only Scenes
  // 4-6 below received real creative investment.
  const SCENE1_MS=2400;
  const FLIGHT_MS=1800;
  const LUMO_TO_GREETING_MS=600;
  const TAP_HINT_DELAY_MS=3600;
  const GREETING_LINES=[
    'Welcome, Traveller.',
    'I am Lumo.',
    'Guardian of Story Companions.',
    'Every Creator begins here.'
  ];
  const LINE_MS=2000;
  const LINE_GAP_MS=550;
  const RETURNING_LINES=[
    'Welcome home.',
    'Show me your stars.'
  ];
  const RETURNING_LINE_MS=2200;
  const RETURNING_LINE_GAP_MS=650;

  // Scene 4 — The Gates Appear. Four real, sequenced beats (Principle 1):
  // wind rises, a golden light glows behind the still-hidden Gate, the
  // curtains part onto a dark silhouette, the silhouette brightens into
  // real stone with gathering particles.
  const WIND_RISE_MS=1500;
  const GLOW_RISE_MS=1300;
  const SILHOUETTE_MS=1900;
  const DETAIL_MS=1700;

  // Scene 5 — Journey Through the Sky. Within the epic's own "~5-8s"
  // window; the world moves, not the Gate (Principle 2).
  const JOURNEY_MS=7400;

  // Scene 6 — The Gates Open, staged as its own five beats.
  const ARRIVE_MS=2400;        // the one deliberate, large Gate growth.
  const PAUSE_MS=2200;         // Principle 5 — do nothing. Real silence.
  const WING_RAISE_LEAD_MS=250;
  const AWAKEN_MS=2100;        // runes ignite, magic sparks travel.
  const OPEN_MS=3800;          // doors slowly unlock, light floods.
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
    // Every later scene (Journey, Arrival, Magic) toggles classes on the
    // returned `stage` element so the shadow/portrait/wing/tail all move
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
      const tail=el('div','gateway-lumo-tail');
      stage.appendChild(shadow);
      stage.appendChild(img);
      stage.appendChild(tail);
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
        stage.classList.add('gateway-lumo-idle');
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

    // Scene 4 — mounts the Gate (initially small, distant, fully hidden:
    // no opacity, no colour, no light) plus two "curtain" cloud shapes
    // obscuring it, and the small set of elements every later beat needs
    // — a halo (Stage A's rising light), a stonework texture overlay
    // (Stage C's detail), and five gathering particles (Stage C).
    // Returns the element refs every later phase animates.
    function mountGates(){
      const wrap=el('div','gateway-gates-wrap');
      const gate=el('div','gateway-gates');
      gate.appendChild(el('div','gateway-gate-halo'));
      gate.appendChild(el('div','gateway-gate-glow'));
      const arch=el('div','gateway-gate-arch');
      arch.appendChild(el('div','gateway-gate-stonework'));
      gate.appendChild(arch);
      gate.appendChild(el('div','gateway-gate-leaf gateway-gate-leaf-left'));
      gate.appendChild(el('div','gateway-gate-leaf gateway-gate-leaf-right'));
      const r1=el('span','gateway-gate-rune gateway-gate-rune-1'); r1.textContent='✦';
      const r2=el('span','gateway-gate-rune gateway-gate-rune-2'); r2.textContent='✧';
      const r3=el('span','gateway-gate-rune gateway-gate-rune-3'); r3.textContent='✦';
      gate.appendChild(r1); gate.appendChild(r2); gate.appendChild(r3);
      ['gp1','gp2','gp3','gp4','gp5'].forEach(function(cls){
        gate.appendChild(el('span','gateway-gate-gather-particle '+cls));
      });
      wrap.appendChild(gate);
      const curtainL=el('div','gateway-curtain-cloud gateway-curtain-left');
      const curtainR=el('div','gateway-curtain-cloud gateway-curtain-right');
      content.appendChild(wrap);
      content.appendChild(curtainL);
      content.appendChild(curtainR);
      return {wrap:wrap,curtainL:curtainL,curtainR:curtainR};
    }

    // Principle 1 — the Gate is REVEALED, never popped or faded in one
    // step. Four real, JS-sequenced beats: wind rises; a golden light
    // glows behind the still-hidden Gate; the curtains part onto a dark
    // silhouette ("the child should feel the gate was always there,
    // hidden beyond the clouds"); the silhouette brightens into real
    // stone with texture while particles gather onto it.
    function playGateReveal(gateEls,lumoRef,reduced,onDone){
      // Lumo rests dead-center after Scene 3 (the greeting), and the
      // Gate reveals dead-center too — left untouched, the two would
      // collide right on screen the instant the Gate's silhouette
      // appears. Lumo steps aside first, so the Gate reveals into open
      // sky beside him rather than materializing inside him.
      if(lumoRef&&lumoRef.stage){
        lumoRef.stage.classList.remove('gateway-lumo-idle');
        lumoRef.stage.classList.add('gateway-lumo-yield');
      }
      overlay.classList.add('gateway-wind-rising');
      after(reduced?0:WIND_RISE_MS,function(){
        if(skipRequested) return;
        gateEls.wrap.classList.add('gateway-gates-glow-rise');
        after(reduced?0:GLOW_RISE_MS,function(){
          if(skipRequested) return;
          gateEls.curtainL.classList.add('gateway-curtain-parted');
          gateEls.curtainR.classList.add('gateway-curtain-parted');
          gateEls.wrap.classList.add('gateway-gates-silhouette');
          after(reduced?0:SILHOUETTE_MS,function(){
            if(skipRequested) return;
            gateEls.wrap.classList.add('gateway-gates-detail');
            after(reduced?0:DETAIL_MS,function(){
              overlay.classList.remove('gateway-wind-rising');
              onDone();
            });
          });
        });
      });
    }

    // Scene 5 — "Do NOT teleport. Travel." Principle 2: the TRAVELLER
    // moves, the Gate does not — a real parallax world (near: big, fast,
    // brighter; far: small, slow, faint) streams past while Lumo leads
    // with its own multi-leg "fly, glance back, wait, continue"
    // sequence (Principle 3). The Gate itself only grows modestly here
    // (see .gateway-gates-approach-modest) — the one deliberate large
    // growth is reserved for Arrival, below.
    function playJourney(gateEls,lumoRef,reduced,onDone){
      overlay.classList.add('gateway-journey-active');
      gateEls.wrap.classList.add('gateway-gates-journey');
      if(lumoRef&&lumoRef.stage){
        lumoRef.stage.classList.remove('gateway-lumo-idle','gateway-lumo-yield');
        lumoRef.stage.classList.add('gateway-lumo-lead');
      }
      const extras=el('div','gateway-journey-extras');
      ['☁️','🏝️'].forEach(function(g,i){
        const s=el('span','gateway-journey-near');
        s.textContent=g;
        s.style.setProperty('--i',String(i));
        extras.appendChild(s);
      });
      ['🗻','☁️','🕊️'].forEach(function(g,i){
        const s=el('span','gateway-journey-far');
        s.textContent=g;
        s.style.setProperty('--i',String(i));
        extras.appendChild(s);
      });
      content.appendChild(extras);
      after(reduced?250:JOURNEY_MS,onDone);
    }

    // Scene 6, beat 1 — Arrival. Principle 4: ONE deliberate, large Gate
    // growth so the doors genuinely dominate the screen — "massive,
    // timeless, sacred" — never simulated by scaling continuously
    // through the Journey. Lumo settles facing the Gate at exactly the
    // position the Journey's own keyframe ended on, so the hand-off is
    // invisible. Then, beat 2 — Principle 5's real anticipation Pause:
    // nothing new happens, only the ambient wind/particles/rays quiet
    // slightly (.gateway-hush) before the magic begins.
    function playArrival(gateEls,lumoRef,reduced,onDone){
      overlay.classList.remove('gateway-journey-active');
      gateEls.wrap.classList.remove('gateway-gates-journey');
      gateEls.wrap.classList.add('gateway-gates-arrive');
      if(lumoRef&&lumoRef.stage){
        lumoRef.stage.classList.remove('gateway-lumo-lead');
        lumoRef.stage.classList.add('gateway-lumo-arrived');
      }
      after(reduced?150:ARRIVE_MS,function(){
        if(skipRequested) return;
        overlay.classList.add('gateway-hush');
        after(reduced?150:PAUSE_MS,function(){
          overlay.classList.remove('gateway-hush');
          onDone();
        });
      });
    }

    // Scene 6, beat 3 — "Only then... Lumo raises one wing. Magic
    // begins." A small burst of gold sparks travels from Lumo's raised
    // wing toward the Gate; the runes ignite one at a time rather than
    // all at once ("ancient mechanisms awaken... locks awaken").
    function spawnMagicSparks(){
      const wrap=el('div','gateway-magic-sparks');
      for(let i=0;i<5;i++){
        const s=el('span','gateway-magic-spark');
        s.style.setProperty('--si',String(i));
        wrap.appendChild(s);
      }
      content.appendChild(wrap);
    }
    function playGateAwaken(gateEls,lumoRef,reduced,onDone){
      if(lumoRef&&lumoRef.stage) lumoRef.stage.classList.add('gateway-lumo-magic');
      after(reduced?100:WING_RAISE_LEAD_MS,function(){
        if(skipRequested) return;
        spawnMagicSparks();
        gateEls.wrap.classList.add('gateway-gates-awaken');
        after(reduced?150:AWAKEN_MS,onDone);
      });
    }

    // Scene 6, beat 4 — Principle 6: the stone doors slowly unlock and
    // swing outward; warm golden light pours through the widening gap.
    // Never rushed — OPEN_MS is deliberately the single longest beat in
    // the whole finale.
    function playGateOpen(gateEls,reduced,onDone){
      gateEls.wrap.classList.add('gateway-gates-open');
      after(reduced?200:OPEN_MS,onDone);
    }

    // Scene 6, beat 5 — crossing the threshold. A genuine forward camera
    // dolly (the whole overlay — sky and Gate together — scales up and
    // brightens, "soft bloom") plays BEFORE the final flash, rather than
    // jumping straight from open doors to a flood. Principle 7: the
    // flash holds at full opacity before the cut, so the Hall is never
    // glimpsed mid-transition.
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
      const done=function(){
        clearTimers();
        unwireSkip();
        try{ if(cleanupLumo) cleanupLumo(); }catch(e){}
        overlay.classList.add('hidden');
        overlay.classList.remove('gateway-journey-active','gateway-mode-hidden-for-signature','gateway-wind-rising','gateway-hush','gateway-threshold-dolly');
        content.innerHTML='';
        skipRequested=false;
        try{ onComplete(); }catch(e){}
      };

      overlay.classList.remove('hidden','gateway-journey-active','gateway-mode-hidden-for-signature','gateway-wind-rising','gateway-hush','gateway-threshold-dolly');
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

      // Scenes 4-6 — the transition this sprint exists to fix. Each
      // beat is its own small function above, chained here in the
      // frozen order the seven principles describe.
      function runGatesSequence(){
        if(skipRequested) return;
        const gateEls=mountGates();
        playGateReveal(gateEls,lumoRef,reduced,function(){
          if(skipRequested) return;
          playJourney(gateEls,lumoRef,reduced,function(){
            if(skipRequested) return;
            playArrival(gateEls,lumoRef,reduced,function(){
              if(skipRequested) return;
              playGateAwaken(gateEls,lumoRef,reduced,function(){
                if(skipRequested) return;
                playGateOpen(gateEls,reduced,function(){
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
