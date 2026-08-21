// js/companionDirector.js — Studio integration for the Companion
// Platform, aligned to the VihuPlanet Companion Canon V2 — Guardian &
// Creator Bond (docs/COMPANION_CANON.md).
//
// js/companionEngine.js (the generic runtime) is UNCHANGED by this
// sprint — not one line. Everything below is Studio-specific
// orchestration: which REGISTERED entity to show, and which of its own
// canonical poses a given Studio moment maps to. The engine still has
// zero idea whether it's rendering a Story Egg, Lumo, or a bonded Story
// Companion — it only ever receives a plain id (resolved from the
// registry) and a plain pose name.
//
// ---------- Companion Canon V2, in code terms ----------
// A Traveller is not yet a Creator, and does not have a companion. Every
// Traveller is instead represented by a Story Egg (registry role
// "traveller") — no face, no limbs, never speaks, expressed only through
// pose. The Story Egg belongs to nobody; it is waiting for a Creator.
//
// The first successful Publish is the Creator Ceremony (Canon: "Traveller
// -> Story Egg -> Create -> First Publish -> Magic Card awakens -> Lumo
// arrives -> Lumo blesses the Story Egg -> Story Egg hatches -> A Story
// Companion is born -> The Companion chooses the Creator -> Magic Card
// is permanently bonded -> Creator Journey begins"). The whole
// ceremony's beat-by-beat script is getCeremonySequence() below — pure
// data, rendered by js/magicCardUI.js's own big centered ceremony
// stage, never wired into this file's own ambient boot/notify
// choreography.
//
// Lumo — the Guardian of Story Companions, keeper of Creator Ceremonies,
// official mascot of VihuPlanet — is NOT the Creator's own companion.
// Lumo welcomes every Creator during the ceremony but bonds with none of
// them and is never shown on a Magic Card. Once a Creator Ceremony
// completes, the Creator's ongoing companion is the SPECIFIC Story
// Companion the ceremony randomly assigned and bonded onto their Magic
// Card (js/magicCard.js's assignBondedCompanion()/claim()) — not a
// role-based "whichever guardian exists" lookup the way earlier
// Companion Canon revisions used. Resolving that specific, per-Creator
// companion id is _resolveCreatorCompanionId() below; it is the one
// real behavioural change this sprint makes to the ambient companion
// widget (traveller/story-egg choreography is completely untouched).
//
// Which entity id actually gets loaded is still resolved generically,
// never as a literal `if (id === 'story-egg')` / `if (id === 'lumo')`
// branch — by matching a registry entry's own `role` field (traveller ->
// Story Egg, guardian -> Lumo, companion -> whichever Story Companion a
// Creator is bonded to) or, for the Creator case, by the exact id
// recorded on the active Magic Card. Adding a third, fourth, hundredth
// `role:"companion"` registry entry needs no change here at all — see
// docs/COMPANION_CANON.md's own "Future Scalability" section.
(function(){
  'use strict';

  const IDLE_SLEEP_MS=120000;      // "No interaction for 2 minutes -> sleep." Studio policy, not a companion property.
  const TYPING_COOLDOWN_MS=4000;   // Don't re-fire the typing pose on every keystroke.
  const ROAM_TICK_MS=7000;         // How often the Companion is ASKED whether it wants to move.

  // Real, canonical Companion Packages live at the repo-root assets/
  // folder (assets/lumo/, assets/story-egg/, assets/nimbus/,
  // assets/quill/, assets/registry.json) — NOT assets/companions/,
  // which was this file's own original, mistaken assumption during the
  // Companion Canon Freeze sprint, corrected once the real uploaded
  // asset folders landed. This is the one place that base path is
  // named; CompanionEngine's own default ('assets/companions/') is
  // untouched since the engine itself stays fully generic about where
  // a caller's packages happen to live.
  const ASSETS_BASE='assets/';

  // "Avoid overlapping dialogs or menus" — the small, closed set of
  // Studio-owned overlays this file (and only this file) is allowed to
  // know about. Every one of these follows the same convention already
  // established across this codebase: a container that gains/loses a
  // plain ".hidden" class. Creation Flow's own overlay is deliberately
  // NOT in this list — a companion (Egg or Companion) is meant to be
  // visible there. Publish Studio is ALSO deliberately not in this list
  // anymore — "Publish studio screen 1,2,3: companion/egg is missing"
  // (Read/Almost Ready/Choose Destination) reverses an earlier sprint's
  // own "avoids clutter over functional UI" reasoning for hiding it
  // there; the companion staying present through the whole Publish
  // journey (all five stages, since there is no separate per-stage
  // selector to scope this to only three of them) reads as genuine
  // companionship at the moment a Story Author needs it most, not
  // clutter.
  const BUSY_SELECTORS=[
    '#restoreModal:not(.hidden)',
    '#themePickerModal:not(.hidden)'
  ];
  // #magicCardOverlay is deliberately NOT one of the plain
  // BUSY_SELECTORS above — it's an override, checked first. It covers
  // the Identity Gate, the Creator Ceremony, AND Home. A ceremony can
  // still open on top of another genuinely busy dialog (e.g. a restore
  // prompt), so treating the overlay as just another busy dialog to
  // hide behind would make the Story Egg's own "hatching" pose and the
  // whole Egg -> Lumo -> Companion ceremony invisible — exactly the
  // moment this pose vocabulary exists to show.
  const CEREMONY_SELECTOR='#magicCardOverlay:not(.hidden)';

  const MESSAGES={
    open:"Let's imagine!",
    storyStarted:"I can't wait to see your story!",
    artworkAdded:"That looks magical!",
    published:"Your story is ready!",
    idleWake:"Welcome back!"
  };

  // The whole Canon, as data. `role` is what's matched against a
  // registry entry's own `role` field for the traveller Story Egg
  // lookup (see _resolveEntityIdByRole below) — MODES.creator has no
  // `role` at all, since which SPECIFIC Story Companion a Creator's
  // widget shows is resolved per-Creator (their own Magic Card's
  // bonded companionId), never by a role match against "whichever
  // companion happens to be registered." `speaks` is Canon 1's "never
  // speaks" for the Egg, made structural rather than accidental
  // (nothing here relies on the Egg simply having no personality.json
  // to speak from); `bootPose`/`wakePose` and the four Studio-event ->
  // pose mappings are each entity's own canonical pose vocabulary —
  // Traveller and Creator intentionally use DIFFERENT pose names for the
  // same Studio moment (e.g. "creating content" is "think" for a Story
  // Companion, "thinking" for the Egg) because that's what the two
  // frozen pose lists actually are, not a special case for either
  // entity. Every Story Companion (Companion Pose Contract v2,
  // docs/COMPANION_CANON.md) declares the exact same 'wave'/'curious'/
  // 'think'/'celebrate'/'sleep' poses MODES.creator already names, so
  // this table needs zero change per companion.
  const MODES={
    traveller:{
      role:'traveller',
      speaks:false,
      bootPose:'idle',
      wakePose:'idle', // no "just returned" flourish pose exists for a limbless Egg
      // 'newPage' is the Story Egg Interaction & Presence sprint's own
      // addition to the Canon's event table ("New Page -> excited") —
      // deliberately added only here, not to creator's own poses below,
      // since this sprint's scope is the Story Egg specifically; an
      // unmapped event key is already a safe no-op in notify() (see
      // the 'page-added' branch), so a Story Companion's own choreography
      // is untouched.
      poses:{ typing:'curious', creating:'thinking', artwork:'excited', publish:'hatching', newPage:'excited' }
    },
    creator:{
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

    function modeCfg(){ return MODES[currentMode]||MODES.traveller; }

    function resetIdleTimer(){
      if(idleTimer) clearTimeout(idleTimer);
      idleTimer=setTimeout(function(){
        if(!ready || asleep) return;
        asleep=true;
        // 'sleep' is declared in BOTH mode vocabularies (Story Egg and
        // every Story Companion alike), so the frozen sleep() convenience
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
          if(cfg.speaks) _say(MESSAGES.idleWake);
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
      safe(function(){
        engine.setState(modeCfg().poses.typing); _holdPose();
        if(typeof CompanionBrain!=='undefined' && CompanionBrain.stir) CompanionBrain.stir();
      });
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
      if(document.querySelector(CEREMONY_SELECTOR)) return false;
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

    // Prefers the loaded package's own personality.json greetings,
    // picking one at random each boot; falls back to the one hardcoded
    // default message only for a package with no personality.json at
    // all (the Egg never reaches this — Canon 1's "never speaks" is
    // enforced structurally by MODES.traveller.speaks; a Story Companion
    // authored without its own greetings falls back the same way Lumo
    // itself would).
    // ---------- Companion Intelligence: one voice, one clock ----------
    // Every spoken line in this file goes through here so that
    // js/companionBrain.js knows when the Companion last said
    // something. Without it the Brain would happily notice something
    // two seconds after the Director's own scripted greeting, and the
    // child would be talked at twice about different things. The Brain
    // owns the cooldown; this is how it learns the Director used it.
    // How long a deliberately-scripted pose is protected from the
    // Brain's ambient reactions. Adding artwork sets 'celebrate' and
    // then mutates the page — which fires PageRuntime.notify() in the
    // same frame — so without this hold the Companion would celebrate
    // for a few milliseconds and then go back to looking thoughtful,
    // and nobody would ever see it. Speech has its own, much longer,
    // cooldown in the Brain; this is only about the face.
    const SCRIPTED_POSE_HOLD_MS=6000;
    let poseHeldUntil=0;
    function _holdPose(){ try{ poseHeldUntil=Date.now()+SCRIPTED_POSE_HOLD_MS; }catch(e){} }
    function _posesHeld(){ try{ return Date.now()<poseHeldUntil; }catch(e){ return false; } }

    function _say(text,opts){
      if(!engine) return;
      engine.speak(text,opts);
      _holdPose();
      safe(function(){
        if(typeof CompanionBrain!=='undefined' && CompanionBrain.noteSpoken) CompanionBrain.noteSpoken();
      });
    }

    // ---------- Companion Intelligence: the tick ----------
    // docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md §6.2. A signal
    // arrives; ask what is true (CompanionContext), ask what to do
    // (CompanionBrain), apply it through the Engine's frozen API. The
    // Brain almost always answers "nothing", which is the point.
    //
    // The signal is js/pageRuntime.js's existing observer list — the
    // same seam js/studioRite.js already watches the child's own
    // actions through. NO POLLING IS INTRODUCED: notify() already fires
    // exactly once per meaningful mutation, and this is one more
    // subscriber on a dispatch that was happening anyway.
    //
    // Everything here is optional in the strictest sense. If either new
    // module is missing, unloaded or throws, this becomes a no-op and
    // the Studio behaves exactly as it did before Companion
    // Intelligence existed — the fail-open property is structural
    // (§3.2), not a setting.
    function _tick(event){
      if(!ready || !engine || asleep) return;
      safe(function(){
        if(typeof CompanionContext==='undefined' || typeof CompanionBrain==='undefined') return;
        const cfg=modeCfg();
        const intent=CompanionBrain.decide(
          CompanionContext.snapshot(), event||null, {mode:currentMode}
        );
        if(!intent) return;
        // A pose costs nobody anything and never interrupts; a line is
        // gated by the Brain's own restraint and by this mode's canon
        // right to speak at all (the Story Egg has none).
        if(intent.pose && !_posesHeld()) engine.setState(intent.pose);
        if(intent.say && cfg.speaks) _say(intent.say);
      });
    }

    // ---------- The child plays with the Companion ----------
    // A hover, a tap and a carry are the three things a child can do
    // TO the Companion, and each gets its own answer. This is the one
    // place in the whole system where speech is not rationed: the
    // child asked, so the Companion replies, every time.
    //
    // POSES DEGRADE TO WHAT THE PACKAGE ACTUALLY HAS. The packs are
    // unevenly complete — Quill has no happy and no surprised — so the
    // Brain sends a PREFERENCE chain and this picks the first pose the
    // loaded package really declares. Without it a giggle would land
    // on Quill's default idle face and read as nothing at all.
    function _pose(chain){
      try{
        if(!chain || !chain.length) return null;
        const have=(engine.getStates&&engine.getStates())||[];
        for(let i=0;i<chain.length;i++){
          if(have.indexOf(chain[i])!==-1) return chain[i];
        }
      }catch(e){}
      return null;
    }

    function _played(gesture){
      if(!ready || !engine) return;
      safe(function(){
        if(typeof CompanionBrain==='undefined' || !CompanionBrain.play) return;
        // Being played with wakes it. A child poking a sleeping
        // Companion expects it to wake up, not to be ignored.
        if(asleep){ asleep=false; }
        resetIdleTimer();
        const intent=CompanionBrain.play(gesture,{mode:currentMode})||{};
        if(!intent.source) return;                 // answered a moment ago
        const pose=_pose(intent.poseChain);
        if(pose){ engine.setState(pose); _holdPose(); }
        // The feeling is sent explicitly here, unlike everywhere else:
        // the POSE may have degraded to something the package happens
        // to own, and the voice should still sound tickled rather than
        // sounding like whatever face was available.
        const cfg=modeCfg();
        if(intent.say && cfg.speaks) _say(intent.say,{emotion:intent.emotion});
      });
    }

    // ---------- Free will: finding somewhere to be ----------
    // The Companion may move itself, and the ONLY hard rule is that it
    // never puts itself over the child's work or over a control. This
    // file is the one that knows the Studio's layout (the Engine must
    // not learn it), so the measuring happens here, against the real
    // elements, the same discipline js/gardenRenderer.js already uses
    // for the Garden's own reserve: measured geometry, never a guess
    // and never a z-index and some judgement.
    //
    // Anything in this list is somewhere the Companion may not sit.
    // A selector that matches nothing is simply skipped, so a Studio
    // screen without an object strip (or a future one with a new
    // panel) needs no special case here.
    const KEEP_OUT=[
      '.app-header',
      'main.preview-area .preview-wrapper',
      '#objectStripList',
      '#selectionActionStrip',
      '.build-info',
      '.creation-scene-signpost'
    ];

    function _keepOutRects(){
      const out=[];
      for(let i=0;i<KEEP_OUT.length;i++){
        let els=[];
        try{ els=document.querySelectorAll(KEEP_OUT[i]); }catch(e){ continue; }
        for(let j=0;j<els.length;j++){
          const el=els[j];
          if(!el || !el.offsetParent && el.tagName!=='BODY') continue;
          const r=el.getBoundingClientRect();
          if(r.width>0 && r.height>0) out.push(r);
        }
      }
      return out;
    }

    function _clear(box,rects,pad){
      for(let i=0;i<rects.length;i++){
        const r=rects[i];
        const disjoint = box.right<=r.left-pad || box.left>=r.right+pad ||
                         box.bottom<=r.top-pad || box.top>=r.bottom+pad;
        if(!disjoint) return false;
      }
      return true;
    }

    // Every place the Companion could stand right now, measured. A
    // coarse grid rather than a handful of named corners, so the set of
    // possible homes changes with the window, with the page size and
    // with whatever panels happen to be open — which is what makes this
    // read as choosing a spot rather than cycling four of them.
    function _freeSpots(){
      const el=document.querySelector('.companion-widget');
      if(!el) return [];
      const me=el.getBoundingClientRect();
      const w=me.width||120, h=me.height||140;
      const rects=_keepOutRects();
      const margin=10, pad=8;
      const spots=[];
      const cols=9, rows=6;
      for(let cx=0;cx<cols;cx++){
        for(let cy=0;cy<rows;cy++){
          const left=margin+(cx/(cols-1))*(window.innerWidth-w-margin*2);
          const top=margin+(cy/(rows-1))*(window.innerHeight-h-margin*2);
          if(left<margin || top<margin) continue;
          const box={left:left, top:top, right:left+w, bottom:top+h};
          if(box.right>window.innerWidth-margin || box.bottom>window.innerHeight-margin) continue;
          if(!_clear(box,rects,pad)) continue;
          spots.push({left:left, top:top});
        }
      }
      return spots;
    }

    // A Companion drifting about behind an open dialog is the wrong
    // kind of alive — the child is answering a question, and movement
    // at the edge of the screen is exactly the distraction this whole
    // feature is supposed to avoid. Rather than trying to DODGE every
    // overlay (a list that would go stale the day somebody adds one),
    // it simply holds still while any of them is up.
    const OVERLAYS=[
      '.modal', '.creation-flow-overlay', '.gateway-overlay',
      '.magic-card-overlay', '.hw-studio-modal', '[role="dialog"]'
    ];

    function _overlayOpen(){
      for(let i=0;i<OVERLAYS.length;i++){
        let els=[];
        try{ els=document.querySelectorAll(OVERLAYS[i]); }catch(e){ continue; }
        for(let j=0;j<els.length;j++){
          const el=els[j];
          if(!el || el.hidden) continue;
          if(!el.offsetParent) continue;                 // display:none / detached
          const r=el.getBoundingClientRect();
          if(r.width>40 && r.height>40) return true;
        }
      }
      return false;
    }

    function _roam(){
      if(!ready || !engine || !engine.roamTo) return;
      safe(function(){
        if(typeof CompanionBrain==='undefined' || !CompanionBrain.roam) return;
        if(_overlayOpen()){
          // Not merely skipped: the Brain is told the room is busy, so
          // the quiet period starts again once the dialog closes rather
          // than the Companion bolting the instant it does.
          if(CompanionBrain.stir) CompanionBrain.stir();
          return;
        }
        const el=document.querySelector('.companion-widget');
        if(!el) return;
        const decision=CompanionBrain.roam();
        if(!decision || !decision.style) return;

        const spots=_freeSpots();
        if(!spots.length) return;
        const me=el.getBoundingClientRect();

        // Somewhere genuinely else. A "move" of twenty pixels reads as a
        // glitch rather than as a decision, so anywhere too close to
        // where it already is does not count as a destination at all.
        const far=spots.filter(function(s){
          const dx=s.left-me.left, dy=s.top-me.top;
          return Math.sqrt(dx*dx+dy*dy)>140;
        });
        const pool=far.length?far:spots;
        const pick=pool[Math.floor(Math.random()*pool.length)];
        if(!pick) return;
        engine.roamTo(pick.left,pick.top,decision.style);
      });
    }

    // Roaming is the one thing here that CANNOT ride an existing
    // signal, and it is worth being plain about the cost: the whole
    // point is to move while the child is doing nothing, and when a
    // child is doing nothing, nothing fires. So this is a real timer —
    // a slow one, doing nothing but asking the Brain a question it
    // almost always answers no to.
    let _roamTimer=null;
    function _watchRoam(){
      if(_roamTimer) return;
      _roamTimer=setInterval(function(){
        safe(function(){ if(!asleep) _roam(); });
      },ROAM_TICK_MS);
    }

    let _unplay=null;
    function _watchPlay(){
      if(_unplay) return;
      safe(function(){
        const handler=function(e){
          const g=e && e.detail && e.detail.gesture;
          if(g) _played(g);
        };
        document.addEventListener('vihu:companion-gesture',handler);
        _unplay=function(){ document.removeEventListener('vihu:companion-gesture',handler); };
      });
    }

    let _unobserve=null;
    function _watchPage(){
      if(_unobserve) return;
      safe(function(){
        if(typeof PageRuntime==='undefined' || !PageRuntime.observe) return;
        _unobserve=PageRuntime.observe(function(){ _tick(null); });
      });
    }

    function pickGreeting(){
      const p=engine.getPersonality();
      if(p && Array.isArray(p.greetings) && p.greetings.length){
        return p.greetings[Math.floor(Math.random()*p.greetings.length)];
      }
      return MESSAGES.open;
    }

    // Whether this browser currently has a Creator identity active —
    // the ONE place this file reads Studio's own Magic Card state to
    // decide Traveller vs Creator. A missing/unavailable MagicCard module
    // defaults to Traveller, the safe, canon-correct default.
    function detectMode(){
      try{
        if(typeof MagicCard!=='undefined' && MagicCard.getActive()) return 'creator';
      }catch(e){}
      return 'traveller';
    }

    // Resolves which registry entity id serves a given ROLE (never an
    // id hardcoded here). 'lumo' is the one, final, disclosed fallback
    // literal if the registry can't be reached or has no matching entry
    // at all (a genuinely rare, already-disclosed degrade path carried
    // over from the prior sprint's own precedent), so Studio always
    // shows SOME companion rather than silently none.
    function _resolveEntityIdByRole(list,role){
      const entry=(list||[]).find(function(e){ return e.role===role; });
      if(entry) return entry.id;
      return (list && list[0] && list[0].id) || 'lumo';
    }

    // Traveller-only convenience: MODES.traveller is the one remaining mode
    // whose entity is a plain role match.
    function _resolveEntityId(list,mode){
      return _resolveEntityIdByRole(list,MODES[mode].role);
    }

    // Companion Canon V2 — resolves the SPECIFIC Story Companion a
    // Creator is bonded to, never a role match against "whichever
    // companion happens to exist." Returns a Promise<string id>
    // (unlike the synchronous role lookups above) because a legacy
    // Magic Card claimed before this sprint has no companionId at all,
    // and closing that gap means calling MagicCard.ensureBondedCompanion()
    // — a real, one-time async retroactive bond, using the exact same
    // random-assign mechanism the Creator Ceremony itself uses — so a
    // pre-existing Creator is never left companion-less or silently
    // defaulted to Lumo (the Guardian never bonds with anyone, per
    // Canon: "Lumo does not bond with any kid").
    function _resolveCreatorCompanionId(list){
      let active=null;
      try{ if(typeof MagicCard!=='undefined') active=MagicCard.getActive(); }catch(e){}
      if(active && active.companionId){
        const stillReal=(list||[]).some(function(e){ return e.id===active.companionId && e.role==='companion'; });
        if(stillReal) return Promise.resolve(active.companionId);
      }
      if(active && typeof MagicCard!=='undefined' && MagicCard.ensureBondedCompanion){
        return MagicCard.ensureBondedCompanion(active.id).then(function(fields){
          return (fields && fields.companionId) ? fields.companionId : _resolveEntityIdByRole(list,'companion');
        }).catch(function(){ return _resolveEntityIdByRole(list,'companion'); });
      }
      return Promise.resolve(_resolveEntityIdByRole(list,'companion'));
    }

    // One small seam both init() and the 'creator-born' notify handler
    // funnel through, so the two never risk disagreeing about how a
    // mode resolves its entity id.
    function _resolveIdForMode(mode,list){
      if(mode==='creator') return _resolveCreatorCompanionId(list);
      return Promise.resolve(_resolveEntityId(list,mode));
    }

    // "overall on studio screen sometimes the companion does not load"
    // -- traced, not guessed: engine.load(id)'s own fetch(companion.json)
    // had zero retry, and _mountEntity's catch below permanently gave up
    // (engine=null) with nothing anywhere re-attempting init() for the
    // rest of the session -- a single transient network blip (a cold
    // static-host request, a brief connectivity hiccup) meant no
    // companion for that whole visit, with no visible error and no
    // recovery. One bounded retry with a short delay recovers exactly
    // that class of failure without masking a genuinely broken/missing
    // package (which still fails, correctly, after the retry).
    const LOAD_RETRY_ATTEMPTS=2;
    const LOAD_RETRY_DELAY_MS=700;
    function _loadWithRetry(id,attemptsLeft){
      return engine.load(id).catch(function(err){
        if(attemptsLeft<=1) throw err;
        return new Promise(function(resolve){ setTimeout(resolve,LOAD_RETRY_DELAY_MS); })
          .then(function(){ return _loadWithRetry(id,attemptsLeft-1); });
      });
    }

    function _mountEntity(id,mode,onReady){
      _loadWithRetry(id,LOAD_RETRY_ATTEMPTS).then(function(){
        currentMode=mode;
        ready=true;
        engine.show();
        const cfg=modeCfg();
        engine.setState(cfg.bootPose);
        if(cfg.speaks) _say(pickGreeting());
        // The loaded Companion Package's own `lines` overrides and its
        // `neverSays` policy — which has been documented as "inert,
        // awaiting a speech feature to respect it" since the first
        // Companion sprint, and is respected from here on.
        safe(function(){
          if(typeof CompanionBrain!=='undefined' && CompanionBrain.usePolicy){
            CompanionBrain.usePolicy(engine.getPersonality());
          }
        });
        _watchPage();
        _watchPlay();
        _watchRoam();
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
        return _resolveIdForMode(mode,list).then(function(id){ _mountEntity(id,mode,bindReady); });
      }).catch(function(){
        // Registry fetch itself failed (not just "no matching role") —
        // reuses the exact same resolution function/fallback rather
        // than duplicating a second literal.
        _resolveIdForMode(mode,[]).then(function(id){ _mountEntity(id,mode,bindReady); });
      });
    }

    function bindReady(){
      bindGlobalListeners();
      bindOcclusionWatcher();
      bindCloudSyncBadge();
    }

    // "why i dont have red, orange, green in studio... we might even
    // use companion for this" — subscribes once (bindReady() only ever
    // runs once, on the original boot-time mount, and stays correct
    // across a later Creator Ceremony entity swap since this
    // subscription lives at the module level, not on any one engine
    // instance) to js/creatorProjectCache.js's own onSyncStateChange
    // pub/sub, translating a real settled cloud-sync outcome into one
    // of CompanionEngine.setSyncBadge()'s three generic states. Ignores
    // a settle event for a project id that's no longer the one actually
    // open (AppState.project.id) — a background retry can legitimately
    // finish after a Story Author has already switched to a different
    // Story. A Traveller (no claimed Magic Card) never reaches this at
    // all in practice, since js/projectManager.js's own
    // _scheduleCloudProjectSync already gates every real cloud sync
    // attempt on MagicCard.getActive() — the currentMode!=='creator'
    // check here is a defensive backstop, not the primary gate.
    function bindCloudSyncBadge(){
      if(typeof CreatorProjectCache==='undefined' || typeof CreatorProjectCache.onSyncStateChange!=='function') return;
      CreatorProjectCache.onSyncStateChange(function(id,outcome){
        safe(function(){
          if(!ready || !engine || !engine.setSyncBadge || currentMode!=='creator') return;
          const activeId=(typeof AppState!=='undefined' && AppState.project) ? AppState.project.id : null;
          if(activeId && id!==activeId) return;
          if(outcome==='synced'){
            engine.setSyncBadge('good');
            if(engine.boostGlow) engine.boostGlow(); // a little one-shot flourish — "safely tucked away"
          }else if(outcome==='conflict' || outcome==='failed'){
            engine.setSyncBadge('attention');
          }else if(outcome==='unavailable'){
            engine.setSyncBadge(null); // lost Creator identity mid-flight — nothing honest left to show
          }
        });
      });
    }

    /**
     * Companion Canon V2 — the Creator Ceremony, as pure data. Returns
     * an ordered array of "beats", each {entity, pose, effect, speech,
     * durationMs} — encoding the Canon's own sequence exactly: Story
     * Egg -> Glow -> Cracks -> Lumo appears -> Blessing -> Companion
     * Hatching pose -> Companion Hero pose. `entity` is one of 'egg' /
     * 'guardian' / 'companion' — js/magicCardUI.js's own ceremony stage
     * is what actually resolves each of those against the registry and
     * paints an image; this function has zero DOM/timer knowledge of
     * its own, so it (and the sequence itself) is reusable for any
     * future companion with no change here — only companionId/Name/
     * Species vary per Creator.
     * @param {string} companionId
     * @param {string} companionName
     * @param {string} companionSpecies
     * @returns {Array<object>}
     */
    function getCeremonySequence(companionId,companionName,companionSpecies){
      const name=companionName||'your companion';
      return [
        {entity:'egg',pose:'idle',effect:null,speech:null,durationMs:900},
        {entity:'egg',pose:'magic',effect:'glow',speech:null,durationMs:1800},
        {entity:'egg',pose:'hatching',effect:'cracks',speech:null,durationMs:1800},
        {entity:'guardian',pose:'wave',effect:null,speech:'A new light is stirring…',voiceId:'ceremony1',durationMs:2400},
        {entity:'guardian',pose:'celebrate',effect:'blessing',speech:'I bless this Story Egg.',voiceId:'ceremony2',durationMs:2600},
        {entity:'companion',pose:'hatching',effect:'cracks',speech:null,durationMs:1800},
        {entity:'companion',pose:'hero',effect:null,speech:'Hello! I’m '+name+'. Let’s make magic together.',durationMs:2800}
      ];
    }

    /**
     * Translates a named Studio moment into a state change + optional
     * speech bubble, per the current mode's own MODES entry.
     * @param {string} event one of: 'story-started' | 'artwork-added' |
     *   'published' | 'creator-born' | 'ceremony-closed' | 'page-added' |
     *   'project-sync-pending'
     */
    function notify(event){
      if(!ready || !engine) return;
      safe(function(){
        // The one moment js/projectManager.js's own _scheduleCloudProjectSync
        // knows a real cloud-sync attempt is about to begin — the
        // settled outcome (synced/conflict/failed/unavailable) arrives
        // separately, later, via bindCloudSyncBadge()'s own subscription
        // above. A Traveller never reaches this (that scheduler already
        // gates on MagicCard.getActive()), so the mode check here is a
        // defensive backstop, not the primary gate.
        if(event==='project-sync-pending'){
          if(currentMode==='creator' && engine.setSyncBadge) engine.setSyncBadge('busy');
          return;
        }
        // Companion Canon V2 — the literal "Story Egg hatches -> A
        // Story Companion is born" moment: fired once, right after the
        // Creator Ceremony finishes claiming/bonding
        // (js/magicCard.js's claim()/adopt()). Swaps the active entity
        // from the Story Egg to the Creator's own bonded Story
        // Companion via the frozen unload()+load() pair. The Magic
        // Card overlay is always open at this exact moment (it's what's
        // calling this), so the occlusion watcher already keeps the
        // swap invisible until that overlay itself closes.
        if(event==='creator-born'){
          if(currentMode==='creator') return;
          window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(list){
            return _resolveIdForMode('creator',list);
          }).then(function(id){
            engine.unload();
            return engine.load(id);
          }).then(function(){
            currentMode='creator';
            const cfg=modeCfg();
            engine.show();
            engine.setState(cfg.bootPose);
            if(cfg.speaks) _say(pickGreeting());
          }).catch(function(){});
          return;
        }
        // The Creator Ceremony always closes through exactly one
        // function (js/magicCardUI.js's _finishAwakening), regardless
        // of outcome. If a Creator was just born, 'creator-born'
        // already handled everything above. If the child is still a
        // Traveller (declined/deferred), the Egg may be sitting in
        // 'hatching' from the Publish moment that opened the ceremony
        // — settle it back to a quiet idle rather than leaving it
        // mid-hatch indefinitely.
        if(event==='ceremony-closed'){
          if(currentMode==='traveller') engine.setState('idle');
          return;
        }
        const cfg=modeCfg();
        if(event==='story-started'){
          engine.setState(cfg.poses.creating);
          if(cfg.speaks) _say(MESSAGES.storyStarted);
          if(engine.setRichness) engine.setRichness(currentRichness());
        }else if(event==='artwork-added'){
          engine.setState(cfg.poses.artwork);
          if(cfg.speaks) _say(MESSAGES.artworkAdded);
          // Emotional Behaviour — "user creates first artwork -> brighter
          // glow," a one-shot flourish distinct from the persistent
          // richness level below (which only ever grows with page count).
          if(!firstArtworkSeen && engine.boostGlow){ firstArtworkSeen=true; engine.boostGlow(); }
        }else if(event==='published'){
          engine.setState(cfg.poses.publish);
          if(cfg.speaks) _say(MESSAGES.published);
        }else if(event==='page-added'){
          // "New Page -> excited," Story Egg only (see MODES.traveller's
          // own 'newPage' key above) — an event with no mapped pose in
          // the current mode (Creator today) is a safe, silent no-op.
          const pose=cfg.poses.newPage;
          if(pose){ engine.setState(pose); _holdPose(); }
          _tick('page-added');
          if(engine.setRichness) engine.setRichness(currentRichness());
        }
      });
    }

    return { init:init, notify:notify, getCeremonySequence:getCeremonySequence };
  })();

  try{ window.CompanionDirector=CompanionDirector; }catch(e){}
})();
