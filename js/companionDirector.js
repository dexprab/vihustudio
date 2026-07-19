// js/companionDirector.js — Studio integration for the Companion
// Platform (Sprint C1, Companion Platform v1).
//
// This file is deliberately NOT part of the Companion Engine
// (js/companionEngine.js) — it is the one place in the codebase
// allowed to know when "Studio opened," "the user started creating,"
// "the user is typing," "artwork was inserted," "nothing has happened
// for a while," "the story was published," or "a Studio dialog is
// open right now" occur, and to translate each of those Creator-
// specific moments into a generic CompanionEngine call. The engine
// itself stays 100% companion-agnostic; this director stays 100%
// state-machine-agnostic about *which* companion is on screen — the
// default companion to boot is read from assets/companions/registry.json
// (the first entry) when no explicit id is given, with 'lumo' as the
// one, final, disclosed fallback if the registry can't be reached at
// all — a single literal, not a branch. Swapping in a future companion
// needs a one-line registry.json edit (or an explicit opts.companionId),
// nothing inside companionEngine.js and nothing else in this file.
//
// Timing that belongs to the *companion itself* (how long a wave or a
// celebration lasts before settling back to idle) deliberately lives
// nowhere in this file — js/companionEngine.js's own setState() reads
// that straight from the loaded package's animations.json and handles
// it internally. What stays here is genuinely Studio's own policy, not
// the companion's: how long Studio waits before considering itself
// idle (IDLE_SLEEP_MS), and how often typing is allowed to re-trigger
// "curious" (TYPING_COOLDOWN_MS) — neither is a property of Lumo, both
// would apply identically to any future companion.
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

  // "Avoid overlapping dialogs or menus" — the small, closed set of
  // Studio-owned overlays this file (and only this file) is allowed to
  // know about. Every one of these follows the same convention already
  // established across this codebase: a container that gains/loses a
  // plain ".hidden" class. When any of them is open, the companion is
  // simply hidden (engine.hide(), the exact same fade every other
  // hide() call already uses) rather than repositioned — the lowest-
  // risk way to guarantee it never sits on top of a dialog's own
  // controls, since this file has no reliable way to know a future
  // dialog's own geometry in advance. Creation Flow's own overlay is
  // deliberately NOT in this list — the companion is meant to be
  // visible there (that's where the boot "wave" greeting happens).
  const BUSY_SELECTORS=[
    '#restoreModal:not(.hidden)',
    '#themePickerModal:not(.hidden)',
    '.publish-studio-modal:not(.hidden)',
    '#magicCardOverlay:not(.hidden)'
  ];

  const MESSAGES={
    open:"Let's imagine!",
    storyStarted:"I can't wait to see your story!",
    artworkAdded:"That looks magical!",
    published:"Your story is ready!",
    idleWake:"Welcome back!"
  };

  const CompanionDirector=(function(){
    let engine=null;
    let ready=false;
    let asleep=false;
    let idleTimer=null;
    let typingCooldownUntil=0;
    let typingListenerBound=false;
    let occlusionObserver=null;
    let occlusionPending=false;
    let occludedForBusyUI=false;
    let wasVisibleBeforeOcclusion=true;

    function safe(fn){
      try{ fn(); }catch(e){ /* a companion hiccup must never break Studio */ }
    }

    function resetIdleTimer(){
      if(idleTimer) clearTimeout(idleTimer);
      idleTimer=setTimeout(function(){
        if(!ready || asleep) return;
        asleep=true;
        safe(function(){ engine.sleep(); });
      },IDLE_SLEEP_MS);
    }

    function onActivity(){
      if(ready && asleep){
        asleep=false;
        // "User interacts again -> wave -> idle." wake() sets state to
        // 'wave'; the loaded package's own animations.json (Lumo's
        // own wave duration) is what actually settles it back to idle
        // afterward — no timer of any kind lives in this file.
        safe(function(){ engine.wake(); engine.speak(MESSAGES.idleWake); });
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

    function isStudioBusy(){
      for(let i=0;i<BUSY_SELECTORS.length;i++){
        if(document.querySelector(BUSY_SELECTORS[i])) return true;
      }
      return false;
    }

    function updateOcclusion(){
      if(!ready || !engine) return;
      const busy=isStudioBusy();
      if(busy && !occludedForBusyUI){
        occludedForBusyUI=true;
        wasVisibleBeforeOcclusion=engine.isVisible();
        if(wasVisibleBeforeOcclusion) safe(function(){ engine.hide(); });
      }else if(!busy && occludedForBusyUI){
        occludedForBusyUI=false;
        if(wasVisibleBeforeOcclusion) safe(function(){ engine.show(); });
      }
    }

    function bindOcclusionWatcher(){
      if(occlusionObserver) return;
      occlusionObserver=new MutationObserver(function(){
        // A single dialog opening/closing can trigger several class/
        // childList mutations in one go — coalesce them into one
        // occlusion check per animation frame rather than one per
        // mutation record.
        if(occlusionPending) return;
        occlusionPending=true;
        requestAnimationFrame(function(){
          occlusionPending=false;
          updateOcclusion();
        });
      });
      occlusionObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      updateOcclusion();
    }

    // Prefers the loaded package's own personality.json greetings
    // (Lumo's own three), picking one at random each boot for a
    // little authored variety; falls back to the one hardcoded default
    // message only for a package with no personality.json at all.
    function pickGreeting(){
      const p=engine.getPersonality();
      if(p && Array.isArray(p.greetings) && p.greetings.length){
        return p.greetings[Math.floor(Math.random()*p.greetings.length)];
      }
      return MESSAGES.open;
    }

    function bootWithId(id){
      const companionId=id||'lumo'; // the one, final, disclosed fallback — see this file's own header comment
      engine=new window.CompanionEngine();
      engine.load(companionId).then(function(){
        ready=true;
        engine.show();
        engine.setState('wave'); // auto-reverts to idle per the package's own animations.json, no timer here
        engine.speak(pickGreeting());
        bindGlobalListeners();
        bindOcclusionWatcher();
      }).catch(function(){
        // No companion.json / broken package — Studio boots exactly
        // as it always has, just without a companion this session.
        engine=null;
      });
    }

    /**
     * Boots the companion for this Studio session. Safe to call more
     * than once — later calls are ignored once a companion is already
     * loaded, so multiple defensive init() call sites never double-
     * mount the widget.
     * @param {object} [opts]
     * @param {string} [opts.companionId] Explicit override. When
     *   omitted, the default companion is read from the first entry of
     *   assets/companions/registry.json — 'lumo' only if that registry
     *   can't be reached or is empty.
     */
    function init(opts){
      if(engine) return;
      if(typeof window.CompanionEngine==='undefined') return;
      opts=opts||{};
      if(opts.companionId){
        bootWithId(opts.companionId);
      }else if(typeof window.CompanionEngine.loadRegistry==='function'){
        window.CompanionEngine.loadRegistry().then(function(list){
          bootWithId(list && list.length ? list[0].id : null);
        }).catch(function(){ bootWithId(null); });
      }else{
        bootWithId(null);
      }
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
          // celebrate auto-reverts to idle per the package's own
          // animations.json duration/transition — no timer here.
          engine.setState('celebrate');
          engine.speak(MESSAGES.artworkAdded);
        }else if(event==='published'){
          engine.setState('celebrate');
          engine.speak(MESSAGES.published);
        }
      });
    }

    return { init:init, notify:notify };
  })();

  try{ window.CompanionDirector=CompanionDirector; }catch(e){}
})();
