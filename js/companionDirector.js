// js/companionDirector.js — Studio integration for the Companion Engine
// (Sprint C1, Lumo v1).
//
// This file is deliberately NOT part of the Companion Engine
// (js/companionEngine.js) — it is the one place in the codebase
// allowed to know when "Studio opened," "the user started creating,"
// "the user is typing," "artwork was inserted," "nothing has happened
// for a while," or "the story was published" occur, and to translate
// each of those Creator-specific moments into a generic
// CompanionEngine.setState()/.speak() call. The engine itself stays
// 100% companion-agnostic; this director stays 100% state-machine-
// agnostic about *which* companion is on screen — companionId is a
// plain configuration value (defaulting to 'lumo', the only package
// that ships today), never a hardcoded branch. Swapping in a future
// companion package needs a one-line default change here, nothing
// inside companionEngine.js.
//
// Every hook site elsewhere in the app is a single, defensive,
// try/catch-guarded line calling CompanionDirector.notify(event) —
// the same "thin hook into a dedicated module" pattern already
// established for PageRuntime/ObjectStrip/ContextPanel/MagicCard
// throughout this codebase.
(function(){
  'use strict';

  const IDLE_SLEEP_MS=120000;      // "No interaction for 2 minutes -> sleep."
  const TYPING_COOLDOWN_MS=4000;   // Don't re-fire "curious" on every keystroke.
  const BOOT_WAVE_MS=3000;         // "Studio opens -> wave -> (3s) -> idle."
  const WAKE_WAVE_MS=2000;         // "User interacts again -> wave -> idle."
  const CELEBRATE_HOLD_MS=2000;    // "...celebrate -> (2s) -> idle."

  const MESSAGES={
    open:"Let's imagine!",
    storyStarted:"I can't wait to see your story!",
    artworkAdded:"That's wonderful!",
    published:"Your story is ready!"
  };

  const CompanionDirector=(function(){
    let engine=null;
    let ready=false;
    let asleep=false;
    let idleTimer=null;
    let typingCooldownUntil=0;
    let typingListenerBound=false;

    function safe(fn){
      try{ fn(); }catch(e){ /* a companion hiccup must never break Studio */ }
    }

    function resetIdleTimer(){
      if(idleTimer) clearTimeout(idleTimer);
      idleTimer=setTimeout(function(){
        if(!ready || asleep) return;
        asleep=true;
        safe(function(){ engine.setState('sleep'); });
      },IDLE_SLEEP_MS);
    }

    function onActivity(){
      if(ready && asleep){
        asleep=false;
        safe(function(){ engine.setState('wave'); });
        setTimeout(function(){ safe(function(){ if(ready) engine.setState('idle'); }); },WAKE_WAVE_MS);
      }
      resetIdleTimer();
    }

    function isTypingTarget(el){
      if(!el) return false;
      const tag=(el.tagName||'').toLowerCase();
      if(tag==='textarea') return true;
      if(tag==='input'){
        const type=(el.getAttribute('type')||'text').toLowerCase();
        return type==='text' || type==='search';
      }
      return false;
    }

    function onTypingActivity(e){
      if(!ready) return;
      // Only reacts inside the real Workspace, not while Creation
      // Flow's own onboarding screens (Screen 1/2) are showing — those
      // have no "story" yet for typing to be curious ABOUT.
      if(document.body.classList.contains('creation-flow-active')) return;
      if(!isTypingTarget(e.target)) return;
      const now=Date.now();
      if(now<typingCooldownUntil) return;
      typingCooldownUntil=now+TYPING_COOLDOWN_MS;
      safe(function(){ engine.setState('curious'); });
    }

    function bindGlobalListeners(){
      ['mousemove','mousedown','keydown','touchstart','wheel'].forEach(function(type){
        document.addEventListener(type,onActivity,{passive:true});
      });
      if(!typingListenerBound){
        document.addEventListener('input',onTypingActivity,true);
        typingListenerBound=true;
      }
      resetIdleTimer();
    }

    /**
     * Boots the companion for this Studio session. Safe to call more
     * than once — later calls are ignored once a companion is already
     * loaded, so multiple defensive init() call sites never double-
     * mount the widget.
     * @param {object} [opts]
     * @param {string} [opts.companionId] Defaults to 'lumo' — the only
     *   Companion Package that ships today. A configuration value, not
     *   a hardcoded behavioural branch.
     */
    function init(opts){
      if(engine) return;
      if(typeof window.CompanionEngine==='undefined') return;
      opts=opts||{};
      const companionId=opts.companionId||'lumo';
      engine=new window.CompanionEngine();
      engine.load(companionId).then(function(){
        ready=true;
        engine.show();
        engine.setState('wave');
        engine.speak(MESSAGES.open);
        setTimeout(function(){ safe(function(){ if(ready) engine.setState('idle'); }); },BOOT_WAVE_MS);
        bindGlobalListeners();
      }).catch(function(){
        // No companion.json / broken package — Studio boots exactly
        // as it always has, just without a companion this session.
        engine=null;
      });
    }

    /**
     * Translates a named Studio moment into a state change + optional
     * speech bubble. Silently ignored before the companion has
     * finished loading or if it failed to load at all.
     * @param {string} event one of: 'story-started' | 'artwork-added' | 'published'
     */
    function notify(event){
      if(!ready || !engine) return;
      safe(function(){
        if(event==='story-started'){
          engine.setState('think');
          engine.speak(MESSAGES.storyStarted);
        }else if(event==='artwork-added'){
          engine.setState('celebrate');
          engine.speak(MESSAGES.artworkAdded);
          setTimeout(function(){ safe(function(){ if(ready) engine.setState('idle'); }); },CELEBRATE_HOLD_MS);
        }else if(event==='published'){
          engine.setState('celebrate');
          engine.speak(MESSAGES.published);
          setTimeout(function(){ safe(function(){ if(ready) engine.setState('idle'); }); },CELEBRATE_HOLD_MS);
        }
      });
    }

    return { init:init, notify:notify };
  })();

  try{ window.CompanionDirector=CompanionDirector; }catch(e){}
})();
