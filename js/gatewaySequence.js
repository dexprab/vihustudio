// js/gatewaySequence.js — The Creator Gateway (VihuPlanet Canon
// Milestone 1). Scenes 1-3 of the epic's own six: The Sky (arrival,
// anticipation — no menus/editor/cards/tools visible), Lumo's Arrival
// (a real, orchestrated flight-and-landing, not a teleport), and the
// Greeting (paced narrative speech lines — no tutorials, no UI
// instructions). Plays once, automatically, at the very front of every
// boot (see js/app.js's bootstrapSession IIFE) before Studio's own
// existing Identity Gate / Creation Flow ever runs — "never feel like
// opening software; feel like arriving in another world."
//
// Scenes 4-6 (Traveller Choice / Creator Signature composition, the
// Gates of Creation, the Hall of Creation reveal) are a disclosed,
// deliberate gap this milestone does NOT build. Today, onComplete() IS
// Scenes 4-6, for real: it's literally the boot sequence's own
// pre-existing next step (MagicCardUI.checkIdentityGate or _beginBoot),
// completely unmodified — the Gateway composes in FRONT of that
// already-canon-aligned machinery (js/magicCardUI.js's own Identity
// Gate/Creator Signature tap challenge, js/companionDirector.js's own
// Traveller/Creator resolution), it does not replace or duplicate any
// of it. A future milestone re-themes that hand-off into a real Scene
// 4/5/6 staging.
//
// Lumo's flight/landing/breathing/blink/cursor-tilt "aliveness" is a
// deliberate CSS-transform illusion on ONE flat companion image — no
// independently-animatable wing/tail/eye art layers exist or are
// fabricated here, matching the exact technique already proven for the
// Magic Card Identity Gate's own "flying guard" gatekeeper header
// (css/style.css's .magic-card-gatekeeper-* rules). js/companionEngine.js
// (the generic corner-widget runtime) is NOT used to mount this portrait
// — the Gateway stage is a separate, much larger-scale presentation,
// resolved independently via CompanionEngine.loadRegistry() + a raw
// <img>, the same pattern js/magicCardUI.js's own Creator Ceremony
// stage already established for its own big centered staging. Nothing
// here ever mutates a live CompanionEngine instance's own state.
(function(){
  'use strict';

  const ASSETS_BASE='assets/';
  const SCENE1_MS=2400;          // "a few seconds" of sky before Lumo arrives.
  const FLIGHT_MS=1800;          // Lumo's own flight-in + landing settle.
  const LUMO_TO_GREETING_MS=600; // a breath after landing, before speaking.
  const TAP_HINT_DELAY_MS=3200;  // when the quiet "tap to continue" hint appears.
  const GREETING_LINES=[
    'Welcome, Traveller.',
    'I am Lumo.',
    'Guardian of Story Companions.',
    'Every Creator begins here.'
  ];
  const LINE_MS=2000;
  const LINE_GAP_MS=550; // the epic's own "[pause]" between lines.

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
    // Returns a cleanup function removing the one document-level
    // listener this adds; the DOM node itself is torn down wholesale by
    // begin()'s own content.innerHTML='' on completion.
    function mountLumo(lumo,reduced){
      const stage=el('div','gateway-lumo-stage');
      const shadow=el('div','gateway-lumo-shadow');
      const img=el('img','gateway-lumo-portrait gateway-lumo-flying');
      img.src=lumo.src;
      img.alt=lumo.name;
      stage.appendChild(shadow);
      stage.appendChild(img);
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
      return function cleanup(){ document.removeEventListener('mousemove',onMove); };
    }

    // Reveals GREETING_LINES one at a time, each staying up for LINE_MS
    // with a LINE_GAP_MS pause before the next — the epic's own "natural
    // paced lines... [pause]" framing, made real. No tutorials/UI
    // instructions anywhere in this array by design.
    function playGreeting(onDone){
      const bubble=el('div','gateway-greeting-bubble');
      content.appendChild(bubble);
      let i=0;
      function nextLine(){
        if(skipRequested) return;
        if(i>=GREETING_LINES.length){ onDone(); return; }
        bubble.classList.remove('gateway-greeting-in');
        bubble.textContent=GREETING_LINES[i];
        void bubble.offsetWidth; // force reflow so the fade-in re-triggers every line
        bubble.classList.add('gateway-greeting-in');
        i++;
        after(LINE_MS+LINE_GAP_MS,nextLine);
      }
      nextLine();
    }

    /**
     * Plays the Gateway once, then calls onComplete() — always, even on
     * any internal failure (a missing overlay in the DOM, an
     * unreachable registry, a companion package that can't be
     * resolved). Studio's own boot sequence must never hang behind
     * this. Safe to call more than once in a session (each call is
     * fully self-contained), though today's one real caller
     * (js/app.js's bootstrapSession) only ever calls it once per load.
     * @param {function} onComplete
     */
    function begin(onComplete){
      onComplete=onComplete||function(){};
      if(!ensureDom()){ onComplete(); return; }

      let cleanupLumo=null;
      const done=function(){
        clearTimers();
        unwireSkip();
        try{ if(cleanupLumo) cleanupLumo(); }catch(e){}
        overlay.classList.add('hidden');
        content.innerHTML='';
        skipRequested=false;
        try{ onComplete(); }catch(e){}
      };

      overlay.classList.remove('hidden');
      content.innerHTML='';
      skipRequested=false;
      wireSkip(done);

      const reduced=prefersReducedMotion();
      after(reduced?800:TAP_HINT_DELAY_MS,showTapHint);

      after(reduced?0:SCENE1_MS,function(){
        if(skipRequested) return;
        resolveLumo().then(function(lumo){
          if(skipRequested) return;
          if(!lumo){
            // No Guardian could be resolved (registry unreachable, a
            // package that failed to load, etc.) — a real, honest
            // degrade straight to the text-only Greeting, never a
            // broken image or a Gateway that hangs Studio's own boot.
            playGreeting(done);
            return;
          }
          cleanupLumo=mountLumo(lumo,reduced);
          after(reduced?0:LUMO_TO_GREETING_MS,function(){
            if(!skipRequested) playGreeting(done);
          });
        }).catch(function(){ if(!skipRequested) playGreeting(done); });
      });
    }

    return {begin:begin};
  })();

  try{ window.GatewaySequence=GatewaySequence; }catch(e){}
})();
