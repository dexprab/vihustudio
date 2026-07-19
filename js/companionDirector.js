// js/companionDirector.js — Studio integration for the Companion
// Platform, aligned to the VihuPlanet Companion Canon (Companion Canon
// Freeze & Asset Integration sprint).
//
// js/companionEngine.js (the generic runtime) is UNCHANGED by this
// sprint — not one line. Everything below is Studio-specific
// orchestration: which REGISTERED entity to show, and which of its own
// canonical poses a given Studio moment maps to. The engine still has
// zero idea whether it's rendering a Story Egg or a Companion — it
// only ever receives a plain id (resolved from the registry) and a
// plain pose name (resolved from the small MODES table below).
//
// ---------- The Canon, in code terms ----------
// A Visitor is not yet a Creator, and does not have a companion.
// Every Visitor is instead represented by a Story Egg (registry role
// "visitor") — no face, no limbs, never speaks, expressed only through
// pose. Only after a Magic Card is claimed (or recalled) does a
// Creator's journey officially begin: the Story Egg disappears
// permanently for that device, and Lumo — the Guardian of Story
// Companions, owned by VihuPlanet, never claimable, not the user's own
// future personal companion — becomes the ongoing presence, greeting
// with the exact same pose animations Sprint C1/C1v2 already built.
//
// This file expresses that as ONE small, data-driven MODES table
// (visitor / creator), never as literal `if (id === 'story-egg')` /
// `if (id === 'lumo')` branches — see MODES below. Which entity id
// actually gets loaded for a given mode is resolved generically too,
// by matching the current mode's own `role` against
// assets/registry.json's own `role` field — adding a third registry
// entry for a future "personal companion" role needs no change here
// at all.
(function(){
  'use strict';

  const IDLE_SLEEP_MS=120000;      // "No interaction for 2 minutes -> sleep." Studio policy, not a companion property.
  const TYPING_COOLDOWN_MS=4000;   // Don't re-fire the typing pose on every keystroke.

  // Real, canonical Companion Packages live at the repo-root assets/
  // folder (assets/lumo/, assets/story-egg/, assets/registry.json) —
  // NOT assets/companions/, which was this file's own original,
  // mistaken assumption during the Companion Canon Freeze sprint,
  // corrected once the real uploaded asset folders landed. This is the
  // one place that base path is named; CompanionEngine's own default
  // ('assets/companions/') is untouched since the engine itself stays
  // fully generic about where a caller's packages happen to live.
  const ASSETS_BASE='assets/';

  // "Avoid overlapping dialogs or menus" — the small, closed set of
  // Studio-owned overlays this file (and only this file) is allowed to
  // know about. Every one of these follows the same convention already
  // established across this codebase: a container that gains/loses a
  // plain ".hidden" class. #magicCardOverlay covers the Identity Gate,
  // the Awakening ceremony, AND Home — all three modes of the same
  // element. Creation Flow's own overlay is deliberately NOT in this
  // list — a companion (Egg or Lumo) is meant to be visible there.
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

  // The whole Canon, as data. `role` is what's matched against a
  // registry entry's own `role` field (see _resolveEntityId below);
  // `speaks` is Canon 1's "never speaks" for the Egg, made structural
  // rather than accidental (nothing here relies on the Egg simply
  // having no personality.json to speak from); `bootPose`/`wakePose`
  // and the four Studio-event -> pose mappings are each entity's own
  // canonical pose vocabulary, exactly as the Canon names them —
  // Visitor and Creator intentionally use DIFFERENT pose names for the
  // same Studio moment (e.g. "creating content" is "think" for Lumo,
  // "thinking" for the Egg) because that's what the two frozen pose
  // lists actually are, not a special case for either entity.
  const MODES={
    visitor:{
      role:'visitor',
      speaks:false,
      bootPose:'idle',
      wakePose:'idle', // no "just returned" flourish pose exists for a limbless Egg
      // 'newPage' is the Story Egg Interaction & Presence sprint's own
      // addition to the Canon's event table ("New Page -> excited") —
      // deliberately added only here, not to creator's own poses below,
      // since this sprint's scope is the Story Egg specifically; an
      // unmapped event key is already a safe no-op in notify() (see
      // the 'page-added' branch), so Lumo's choreography is untouched.
      poses:{ typing:'curious', creating:'thinking', artwork:'excited', publish:'hatching', newPage:'excited' }
    },
    creator:{
      role:'guardian',
      speaks:true,
      bootPose:'wave',
      wakePose:'wave',
      poses:{ typing:'curious', creating:'think', artwork:'celebrate', publish:'celebrate' }
    }
  };

  const CompanionDirector=(function(){
    let engine=null;
    let ready=false;
    let asleep=false;
    let currentMode=null;
    let idleTimer=null;
    let typingCooldownUntil=0;
    let typingListenerBound=false;
    let occlusionObserver=null;
    let occlusionPending=false;
    let occludedForBusyUI=false;
    let wasVisibleBeforeOcclusion=true;
    let firstArtworkSeen=false;

    function safe(fn){
      try{ fn(); }catch(e){ /* a companion hiccup must never break Studio */ }
    }

    // Emotional Behaviour — "several pages created -> glow gradually
    // becomes richer" / "story progresses -> particles increase
    // slightly." A plain page-count threshold, translated into the
    // engine's own generic numeric richness level (setRichness has no
    // idea what page count is — this is the one place that meaning
    // lives). AppState is the same bare global every other Studio
    // module (js/pageOps.js included) already reads directly.
    function currentRichness(){
      try{
        const n=(typeof AppState!=='undefined' && AppState.slides) ? AppState.slides.length : 0;
        if(n>=6) return 2;
        if(n>=3) return 1;
        return 0;
      }catch(e){ return 0; }
    }

    function modeCfg(){ return MODES[currentMode]||MODES.visitor; }

    function resetIdleTimer(){
      if(idleTimer) clearTimeout(idleTimer);
      idleTimer=setTimeout(function(){
        if(!ready || asleep) return;
        asleep=true;
        // 'sleep' is declared in BOTH mode vocabularies (Canon 1 and
        // Canon 2 both list it), so the frozen sleep() convenience
        // method is always safe to call directly here.
        safe(function(){ engine.sleep(); });
      },IDLE_SLEEP_MS);
    }

    function onActivity(){
      if(ready && asleep){
        asleep=false;
        safe(function(){
          const cfg=modeCfg();
          // Not engine.wake() — that convenience method is hardcoded
          // to 'wave', a pose the Egg doesn't declare. setState() with
          // the current mode's own wake pose is the generic
          // equivalent, still calling nothing but the frozen public API.
          engine.setState(cfg.wakePose);
          if(cfg.speaks) engine.speak(MESSAGES.idleWake);
        });
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
      safe(function(){ engine.setState(modeCfg().poses.typing); });
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
    // (Lumo's own three), picking one at random each boot; falls back
    // to the one hardcoded default message only for a package with no
    // personality.json at all (the Egg never reaches this — Canon 1's
    // "never speaks" is enforced structurally by MODES.visitor.speaks,
    // this fallback is only ever exercised for a future speaking
    // companion authored without its own greetings).
    function pickGreeting(){
      const p=engine.getPersonality();
      if(p && Array.isArray(p.greetings) && p.greetings.length){
        return p.greetings[Math.floor(Math.random()*p.greetings.length)];
      }
      return MESSAGES.open;
    }

    // Whether this browser currently has a Creator identity active —
    // the ONE place this file reads Studio's own Magic Card state to
    // decide Visitor vs Creator. A missing/unavailable MagicCard module
    // defaults to Visitor, the safe, canon-correct default.
    function detectMode(){
      try{
        if(typeof MagicCard!=='undefined' && MagicCard.getActive()) return 'creator';
      }catch(e){}
      return 'visitor';
    }

    // Resolves which registry entity id serves a given mode, by
    // matching MODES[mode].role against each registry entry's own
    // `role` field — no id is ever hardcoded here. 'lumo' is the one,
    // final, disclosed fallback literal if the registry can't be
    // reached or has no matching entry at all (a genuinely rare,
    // already-disclosed degrade path carried over from the prior
    // sprint's own precedent), so Studio always shows SOME companion
    // rather than silently none.
    function _resolveEntityId(list,mode){
      const cfg=MODES[mode];
      const entry=(list||[]).find(function(e){ return e.role===cfg.role; });
      if(entry) return entry.id;
      return (list && list[0] && list[0].id) || 'lumo';
    }

    function _mountEntity(id,mode,onReady){
      engine.load(id).then(function(){
        currentMode=mode;
        ready=true;
        engine.show();
        const cfg=modeCfg();
        engine.setState(cfg.bootPose);
        if(cfg.speaks) engine.speak(pickGreeting());
        if(onReady) onReady();
      }).catch(function(){
        engine=null;
        ready=false;
      });
    }

    /**
     * Boots the companion for this Studio session. Safe to call more
     * than once — later calls are ignored once a companion is already
     * loaded, so multiple defensive init() call sites never double-
     * mount the widget.
     * @param {object} [opts]
     * @param {string} [opts.companionId] Explicit override, bypassing
     *   mode/registry resolution entirely (used by tests).
     */
    function init(opts){
      if(engine) return;
      if(typeof window.CompanionEngine==='undefined') return;
      opts=opts||{};
      engine=new window.CompanionEngine({assetsBase:ASSETS_BASE});
      if(opts.companionId){
        _mountEntity(opts.companionId,detectMode(),bindReady);
        return;
      }
      const mode=detectMode();
      window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(list){
        _mountEntity(_resolveEntityId(list,mode),mode,bindReady);
      }).catch(function(){
        // Registry fetch itself failed (not just "no matching role") —
        // _resolveEntityId's own fallback (an empty list has no [0])
        // already resolves to the one, final 'lumo' literal, so this
        // reuses the exact same resolution function/fallback rather
        // than duplicating a second literal.
        _mountEntity(_resolveEntityId([],mode),mode,bindReady);
      });
    }

    function bindReady(){
      bindGlobalListeners();
      bindOcclusionWatcher();
    }

    /**
     * Translates a named Studio moment into a state change + optional
     * speech bubble, per the current mode's own MODES entry.
     * @param {string} event one of: 'story-started' | 'artwork-added' |
     *   'published' | 'creator-born' | 'ceremony-closed' | 'page-added'
     */
    function notify(event){
      if(!ready || !engine) return;
      safe(function(){
        // Canon 3 — "Magic Card -> Lumo Ceremony -> Creator": fired
        // once, at the exact moment a Visitor claims or recalls a
        // Magic Card (js/magicCard.js's claim()/adopt()). Swaps the
        // active entity from the Story Egg to Lumo via the frozen
        // unload()+load() pair — the same mechanism the engine's own
        // docs named as ready for "a future switch companion UI." The
        // Magic Card overlay is always open at this exact moment (it's
        // what's calling this), so the occlusion watcher already keeps
        // the swap invisible until that overlay itself closes.
        if(event==='creator-born'){
          if(currentMode==='creator') return;
          window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(list){
            const id=_resolveEntityId(list,'creator');
            engine.unload();
            return engine.load(id);
          }).then(function(){
            currentMode='creator';
            const cfg=modeCfg();
            engine.show();
            engine.setState(cfg.bootPose);
            if(cfg.speaks) engine.speak(pickGreeting());
          }).catch(function(){});
          return;
        }
        // The Awakening ceremony always closes through exactly one
        // function (js/magicCardUI.js's _finishAwakening), regardless
        // of outcome. If a Creator was just born, 'creator-born'
        // already handled everything above. If the child is still a
        // Visitor (declined/deferred), the Egg may be sitting in
        // 'hatching' from the Publish moment that opened the ceremony
        // — settle it back to a quiet idle rather than leaving it
        // mid-hatch indefinitely.
        if(event==='ceremony-closed'){
          if(currentMode==='visitor') engine.setState('idle');
          return;
        }
        const cfg=modeCfg();
        if(event==='story-started'){
          engine.setState(cfg.poses.creating);
          if(cfg.speaks) engine.speak(MESSAGES.storyStarted);
          if(engine.setRichness) engine.setRichness(currentRichness());
        }else if(event==='artwork-added'){
          engine.setState(cfg.poses.artwork);
          if(cfg.speaks) engine.speak(MESSAGES.artworkAdded);
          // Emotional Behaviour — "user creates first artwork -> brighter
          // glow," a one-shot flourish distinct from the persistent
          // richness level below (which only ever grows with page count).
          if(!firstArtworkSeen && engine.boostGlow){ firstArtworkSeen=true; engine.boostGlow(); }
        }else if(event==='published'){
          engine.setState(cfg.poses.publish);
          if(cfg.speaks) engine.speak(MESSAGES.published);
        }else if(event==='page-added'){
          // "New Page -> excited," Story Egg only (see MODES.visitor's
          // own 'newPage' key above) — an event with no mapped pose in
          // the current mode (Creator today) is a safe, silent no-op.
          const pose=cfg.poses.newPage;
          if(pose) engine.setState(pose);
          if(engine.setRichness) engine.setRichness(currentRichness());
        }
      });
    }

    return { init:init, notify:notify };
  })();

  try{ window.CompanionDirector=CompanionDirector; }catch(e){}
})();
