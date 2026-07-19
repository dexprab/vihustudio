// js/companionEngine.js — Companion Platform v1 (Sprint C1, Lumo v1).
//
// A generic runtime for Companion Packages (assets/companions/<id>/
// companion.json + optional personality.json + optional animations.json
// + one PNG per declared state). The engine knows nothing about any
// specific companion — it only understands the Companion Package
// Contract: a manifest naming a defaultState and a map of state name ->
// image filename, an optional personality description, and an optional
// state-transition/duration table. Lumo is the first package that
// exercises this contract; every future companion (Nimbus, Moss, Nova,
// ...) is just another folder under assets/companions/ with the same
// shape, loadable with zero changes to this file. There is, and must
// never be, a branch here that reads a companion's id to decide
// behaviour (e.g. `if (id === 'lumo')`) — every decision this class
// makes is driven entirely by the loaded package's own declared data.
//
// A companion is a creative friend, never an assistant/chatbot/teacher/
// AI tutor — it does not critique or score a child's work. This engine
// enforces none of that by code (there is nothing here that generates
// speech on its own to police); a package's own personality.json
// "neverSays" list is authored policy data for a future AI-driven
// speech feature to respect, disclosed as currently inert since every
// message this sprint speaks is static, curated, human-authored text.
//
// Image swapping (state -> picture) plus package-declared auto-
// transitions/timing is today's real behaviour — but every public
// method is written so a later version can grow real capability behind
// the exact same signature: setState() could ease-crossfade or drive a
// sprite-sheet animation instead of a hard swap; a companion package
// could declare a sound clip alongside an image and setState() could
// play it; speak() could grow a typewriter effect or TTS; show()/hide()
// could add motion (they already do, via CSS). None of that requires
// widening this class's public API, which is frozen as of this sprint:
// load/unload/show/hide/setState/getState/speak/wake/sleep/destroy.
(function(){
  'use strict';

  const DEFAULT_SPEAK_DURATION_MS = 4200;
  const POSITION_STORAGE_KEY = 'vihu-companion-widget-position';
  const BLINK_MIN_MS = 3000;
  const BLINK_MAX_MS = 7000;
  const BLINK_HOLD_MS = 140;

  class CompanionEngine{
    /**
     * @param {object} [opts]
     * @param {string} [opts.assetsBase] Base path to the companions/
     *   folder. Defaults to 'assets/companions/' (relative, matching
     *   this codebase's own convention throughout index.html/CSS).
     * @param {number} [opts.speakDurationMs] How long speak() keeps a
     *   bubble visible before auto-hiding, unless replaced sooner.
     */
    constructor(opts){
      opts=opts||{};
      this._assetsBase=opts.assetsBase||'assets/companions/';
      this._speakDurationMs=opts.speakDurationMs||DEFAULT_SPEAK_DURATION_MS;
      this._package=null;
      this._personality=null;
      this._animations=null;
      this._basePath=null;
      this._state=null;
      this._visible=false;
      this._root=null;
      this._imgEl=null;
      this._bubbleEl=null;
      this._portraitWrapEl=null;
      this._speakTimer=null;
      this._autoTransitionTimer=null;
      this._blinkTimer=null;
      this._dragCleanup=null;
      this._resizeHandler=null;
    }

    // ---------- Loading ----------

    /**
     * Loads a Companion Package by id: fetches
     * assets/companions/<id>/companion.json, validates its shape,
     * preloads every declared state's image, and best-effort loads two
     * optional sibling files — personality.json (traits/greetings/
     * neverSays) and animations.json (state -> transition target and
     * state -> auto-revert duration) — neither of which is required;
     * a package with neither still loads and behaves exactly as a
     * companion.json-only package always has. Resolves with the loaded
     * companion.json manifest. Safe to call again later to switch
     * companions (equivalent to unload() then a fresh load()); the
     * previous package's own preloaded images are simply dropped.
     * @param {string} id
     * @returns {Promise<object>}
     */
    load(id){
      if(!id || typeof id!=='string'){
        return Promise.reject(new Error('CompanionEngine.load(id) requires a companion id'));
      }
      const base=this._assetsBase+id+'/';
      return fetch(base+'companion.json')
        .then(function(res){
          if(!res.ok) throw new Error('companion.json not found for "'+id+'" ('+res.status+')');
          return res.json();
        })
        .then((pkg)=>{
          this._validatePackage(pkg);
          return Promise.all([
            this._preloadStates(base,pkg),
            this._fetchOptionalJSON(base+'personality.json'),
            this._fetchOptionalJSON(base+'animations.json')
          ]).then((results)=>{
            const personality=results[1];
            const animations=results[2];
            this._package=pkg;
            this._basePath=base;
            this._personality=personality;
            this._animations=animations;
            this._state=pkg.defaultState;
            if(this._imgEl) this._applyState(this._state);
            this._scheduleBlinkLoop();
            return pkg;
          });
        });
    }

    _validatePackage(pkg){
      if(!pkg || typeof pkg!=='object') throw new Error('companion.json did not parse to an object');
      if(!pkg.id || !pkg.defaultState || !pkg.states || typeof pkg.states!=='object'){
        throw new Error('companion.json is missing required fields (id/defaultState/states)');
      }
      if(!pkg.states[pkg.defaultState]){
        throw new Error('companion.json\'s defaultState "'+pkg.defaultState+'" has no matching entry in states');
      }
    }

    _preloadStates(base,pkg){
      const names=Object.keys(pkg.states);
      const loads=names.map((name)=>this._preloadOne(base+pkg.states[name]));
      return Promise.all(loads);
    }

    _preloadOne(src){
      return new Promise((resolve)=>{
        const img=new Image();
        // A single broken/missing state image degrades gracefully
        // rather than failing the whole package load — setState()
        // itself will simply show whatever the <img> resolves to
        // (a broken-image glyph in the worst case) rather than
        // blocking every other state from working.
        img.onload=()=>resolve(img);
        img.onerror=()=>resolve(img);
        img.src=src;
      });
    }

    // A missing/malformed optional file (personality.json,
    // animations.json, registry.json) is a completely normal state,
    // not an error — every caller of this helper resolves to null
    // rather than rejecting.
    _fetchOptionalJSON(url){
      return fetch(url).then(function(res){
        if(!res.ok) return null;
        return res.json().catch(function(){ return null; });
      }).catch(function(){ return null; });
    }

    /** The loaded package's personality.json contents, or null. */
    getPersonality(){ return this._personality; }

    /** The loaded package's animations.json contents, or null. */
    getAnimations(){ return this._animations; }

    /**
     * Discards the currently loaded package (images, personality,
     * animations, state, all pending timers) and hides the widget,
     * without removing it from the DOM — a subsequent load() reuses
     * the same mounted widget rather than recreating it. Distinct from
     * destroy(): unload() is "nothing is showing right now," destroy()
     * is "this engine instance is done and its DOM is gone."
     */
    unload(){
      if(this._autoTransitionTimer){ clearTimeout(this._autoTransitionTimer); this._autoTransitionTimer=null; }
      if(this._speakTimer){ clearTimeout(this._speakTimer); this._speakTimer=null; }
      if(this._blinkTimer){ clearTimeout(this._blinkTimer); this._blinkTimer=null; }
      if(this._bubbleEl) this._bubbleEl.classList.add('companion-bubble-hidden');
      this.hide();
      if(this._root) this._root.removeAttribute('data-companion-state');
      this._package=null;
      this._basePath=null;
      this._personality=null;
      this._animations=null;
      this._state=null;
    }

    // ---------- Visibility ----------

    /** Mounts (once) and reveals the companion widget. */
    show(){
      this._ensureDom();
      this._root.classList.remove('companion-hidden');
      this._visible=true;
    }

    /** Hides the companion widget without discarding loaded state. */
    hide(){
      if(this._root) this._root.classList.add('companion-hidden');
      this._visible=false;
    }

    isVisible(){ return this._visible; }

    // ---------- State ----------

    /**
     * Switches the companion's displayed state. An unknown state name
     * (a package with a smaller state vocabulary than the caller
     * expects, or a simple typo) falls back to the package's own
     * defaultState with a console warning rather than throwing —
     * matching the engine's own "never crash the host app" discipline.
     * If the loaded package's animations.json declares a duration for
     * the resolved state, this schedules an automatic transition to
     * whatever state animations.json's own "transitions" map names for
     * it once that duration elapses (cancelled/rescheduled by any
     * later setState() call) — entirely package-driven; this class has
     * no hardcoded knowledge of which states are "temporary."
     * @param {string} state
     */
    setState(state){
      if(!this._package){
        console.warn('CompanionEngine.setState() called before load() resolved — ignored.');
        return;
      }
      const resolved=this._package.states[state] ? state : this._package.defaultState;
      if(resolved!==state){
        console.warn('CompanionEngine: unknown state "'+state+'" for companion "'+this._package.id+'" — falling back to "'+resolved+'".');
      }
      this._state=resolved;
      this._applyState(resolved);
      this._scheduleAutoTransition(resolved);
    }

    getState(){ return this._state; }

    // The one place a state name becomes a rendered image (and a
    // data-companion-state attribute CSS reacts to for the micro-polish
    // effects — talk pulse, celebrate bounce, sleep Zzz — none of
    // which this class knows the meaning of; it only names the current
    // state). A future version with animation/particle/sound
    // capability extends this single method (or the package's own
    // per-state data), never the public setState() signature above.
    _applyState(state){
      this._ensureDom();
      if(!this._package) return;
      const file=this._package.states[state];
      if(!file) return;
      this._imgEl.src=this._basePath+file;
      this._imgEl.alt=(this._package.name||this._package.id)+' — '+state;
      this._root.setAttribute('data-companion-state',state);
    }

    _scheduleAutoTransition(state){
      if(this._autoTransitionTimer){ clearTimeout(this._autoTransitionTimer); this._autoTransitionTimer=null; }
      const anims=this._animations;
      if(!anims || !anims.durations || !anims.durations[state]) return;
      const nextState=anims.transitions && anims.transitions[state];
      if(!nextState) return;
      const ms=anims.durations[state];
      this._autoTransitionTimer=setTimeout(()=>{
        this._autoTransitionTimer=null;
        this.setState(nextState);
      },ms);
    }

    /**
     * Semantic convenience for "the user came back" — sets state to
     * 'wave'. If the package's animations.json declares a wave
     * duration (Lumo's own does, per its own transitions/durations
     * table), setState()'s own auto-transition mechanism reverts to
     * whatever state wave is declared to transition to (idle, for
     * Lumo) with no separate timer here — "wake -> wave -> idle" is
     * entirely package-driven, not a hardcoded engine behaviour.
     */
    wake(){
      if(!this._package) return;
      this.setState('wave');
    }

    /** Semantic convenience for "nothing has happened in a while." */
    sleep(){
      if(!this._package) return;
      this.setState('sleep');
    }

    // ---------- Speech ----------

    /**
     * Shows a simple rounded speech bubble above the companion with
     * static text (no AI, no typing effect this sprint) for
     * speakDurationMs, resetting the timer if called again before it
     * elapses. If the companion is in the 'talk' state when the
     * bubble's own timer elapses, and the loaded package's
     * animations.json declares where 'talk' should settle afterward,
     * this follows it — the exact same package-driven transition
     * mechanism setState()'s own duration-based auto-transitions use,
     * just keyed off the speech bubble's own lifetime instead of a
     * fixed state duration (how long someone has something to say
     * varies, unlike wave/celebrate's fixed timing).
     * @param {string} text
     */
    speak(text){
      this._ensureDom();
      if(this._speakTimer){ clearTimeout(this._speakTimer); this._speakTimer=null; }
      if(!text){ this._bubbleEl.classList.add('companion-bubble-hidden'); return; }
      this._bubbleEl.textContent=String(text);
      this._bubbleEl.classList.remove('companion-bubble-hidden');
      this._speakTimer=setTimeout(()=>{
        this._bubbleEl.classList.add('companion-bubble-hidden');
        this._speakTimer=null;
        const anims=this._animations;
        if(this._state==='talk' && anims && anims.transitions && anims.transitions.talk){
          this.setState(anims.transitions.talk);
        }
      },this._speakDurationMs);
    }

    // ---------- Micro polish: blink (future-ready, inert without a
    // package-declared 'blink' state — Lumo declares none today) ----------

    _scheduleBlinkLoop(){
      if(this._blinkTimer){ clearTimeout(this._blinkTimer); this._blinkTimer=null; }
      if(!this._package || !this._package.states || !this._package.states.blink) return;
      const delay=BLINK_MIN_MS+Math.random()*(BLINK_MAX_MS-BLINK_MIN_MS);
      this._blinkTimer=setTimeout(()=>{
        this._doBlink();
        this._scheduleBlinkLoop();
      },delay);
    }

    // Deliberately bypasses setState()/_applyState() — a blink is a
    // brief visual flourish, never a real state change (it must not
    // reset the current state's own auto-transition timer, and only
    // ever happens while the companion is otherwise resting).
    _doBlink(){
      if(!this._imgEl || !this._package || this._state!=='idle') return;
      const blinkFile=this._package.states.blink;
      const restoreState=this._state;
      this._imgEl.src=this._basePath+blinkFile;
      setTimeout(()=>{
        if(this._imgEl && this._package && this._state===restoreState){
          this._imgEl.src=this._basePath+this._package.states[restoreState];
        }
      },BLINK_HOLD_MS);
    }

    // ---------- Teardown ----------

    /** Removes the widget from the DOM and clears all engine state. */
    destroy(){
      this.unload();
      this._teardownDrag();
      if(this._resizeHandler){ window.removeEventListener('resize',this._resizeHandler); this._resizeHandler=null; }
      if(this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
      this._root=null;
      this._imgEl=null;
      this._bubbleEl=null;
      this._portraitWrapEl=null;
      this._visible=false;
    }

    // ---------- DOM ----------

    _ensureDom(){
      if(this._root) return;
      const root=document.createElement('div');
      root.className='companion-widget companion-hidden';

      const bubble=document.createElement('div');
      bubble.className='companion-bubble companion-bubble-hidden';
      root.appendChild(bubble);

      const portraitWrap=document.createElement('div');
      portraitWrap.className='companion-portrait-wrap';

      const portrait=document.createElement('div');
      portrait.className='companion-portrait';
      const img=document.createElement('img');
      img.className='companion-portrait-img';
      img.alt='';
      portrait.appendChild(img);
      portraitWrap.appendChild(portrait);

      const zzz=document.createElement('span');
      zzz.className='companion-zzz';
      zzz.setAttribute('aria-hidden','true');
      zzz.textContent='💤'; // 💤
      portraitWrap.appendChild(zzz);

      root.appendChild(portraitWrap);

      document.body.appendChild(root);

      this._root=root;
      this._bubbleEl=bubble;
      this._imgEl=img;
      this._portraitWrapEl=portraitWrap;

      this._restorePosition();
      this._wireDrag(portraitWrap);
      this._resizeHandler=()=>this._clampToViewport();
      window.addEventListener('resize',this._resizeHandler);

      if(this._package) this._applyState(this._state);
    }

    // ---------- Draggable position, remembered per browser session ----------

    _wireDrag(handle){
      let dragging=false, moved=false, startX=0, startY=0, startLeft=0, startTop=0;
      const onMove=(e)=>{
        if(!dragging || !this._root) return;
        const point=e.touches?e.touches[0]:e;
        const dx=point.clientX-startX, dy=point.clientY-startY;
        if(Math.abs(dx)>3 || Math.abs(dy)>3) moved=true;
        const rect=this._root.getBoundingClientRect();
        const maxLeft=Math.max(4,window.innerWidth-rect.width-4);
        const maxTop=Math.max(4,window.innerHeight-rect.height-4);
        const left=Math.max(4,Math.min(startLeft+dx,maxLeft));
        const top=Math.max(4,Math.min(startTop+dy,maxTop));
        this._root.style.left=left+'px';
        this._root.style.top=top+'px';
        this._root.style.right='auto';
        this._root.style.bottom='auto';
        if(e.cancelable) e.preventDefault();
      };
      const onUp=()=>{
        if(!dragging) return;
        dragging=false;
        if(this._root) this._root.classList.remove('companion-dragging');
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        document.removeEventListener('touchmove',onMove);
        document.removeEventListener('touchend',onUp);
        if(moved) this._savePosition();
      };
      const onDown=(e)=>{
        if(!this._root) return;
        dragging=true; moved=false;
        const rect=this._root.getBoundingClientRect();
        const point=e.touches?e.touches[0]:e;
        startX=point.clientX; startY=point.clientY;
        startLeft=rect.left; startTop=rect.top;
        this._root.classList.add('companion-dragging');
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
        document.addEventListener('touchmove',onMove,{passive:false});
        document.addEventListener('touchend',onUp);
        e.preventDefault();
      };
      handle.addEventListener('mousedown',onDown);
      handle.addEventListener('touchstart',onDown,{passive:false});
      this._dragCleanup=()=>{
        handle.removeEventListener('mousedown',onDown);
        handle.removeEventListener('touchstart',onDown);
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        document.removeEventListener('touchmove',onMove);
        document.removeEventListener('touchend',onUp);
      };
    }

    _teardownDrag(){
      if(this._dragCleanup){ this._dragCleanup(); this._dragCleanup=null; }
    }

    _savePosition(){
      if(!this._root) return;
      try{
        const rect=this._root.getBoundingClientRect();
        sessionStorage.setItem(POSITION_STORAGE_KEY,JSON.stringify({left:rect.left,top:rect.top}));
      }catch(e){ /* sessionStorage unavailable (private mode, etc.) — position simply isn't remembered */ }
    }

    _restorePosition(){
      if(!this._root) return;
      let saved=null;
      try{ saved=JSON.parse(sessionStorage.getItem(POSITION_STORAGE_KEY)); }catch(e){ saved=null; }
      if(!saved || typeof saved.left!=='number' || typeof saved.top!=='number') return;
      const w=this._root.offsetWidth||120, h=this._root.offsetHeight||140;
      const left=Math.max(4,Math.min(saved.left,window.innerWidth-w-4));
      const top=Math.max(4,Math.min(saved.top,window.innerHeight-h-4));
      this._root.style.left=left+'px';
      this._root.style.top=top+'px';
      this._root.style.right='auto';
      this._root.style.bottom='auto';
    }

    // Only re-clamps a widget the user (or a restored session) has
    // actually moved off its default CSS-anchored corner — a never-
    // dragged widget's position is left entirely to the stylesheet.
    _clampToViewport(){
      if(!this._root || !this._root.style.left) return;
      const rect=this._root.getBoundingClientRect();
      const maxLeft=Math.max(4,window.innerWidth-rect.width-4);
      const maxTop=Math.max(4,window.innerHeight-rect.height-4);
      const left=Math.max(4,Math.min(rect.left,maxLeft));
      const top=Math.max(4,Math.min(rect.top,maxTop));
      if(left!==rect.left) this._root.style.left=left+'px';
      if(top!==rect.top) this._root.style.top=top+'px';
    }
  }

  /**
   * Reads assets/companions/registry.json — a plain listing of every
   * installed Companion Package ({id,name,species,path}) — so a future
   * "choose your companion" UI (or CompanionDirector's own default-
   * companion pick) can discover what's available without this file
   * or any caller knowing a specific id in advance. Adding a new
   * companion is exactly: drop its folder under assets/companions/,
   * add one entry here — zero runtime code changes anywhere. Resolves
   * to [] (never rejects) if the registry is missing or malformed.
   * @param {string} [assetsBase] Defaults to 'assets/companions/'.
   * @returns {Promise<Array<object>>}
   */
  CompanionEngine.loadRegistry=function(assetsBase){
    const base=assetsBase||'assets/companions/';
    return fetch(base+'registry.json').then(function(res){
      if(!res.ok) return {companions:[]};
      return res.json().catch(function(){ return {companions:[]}; });
    }).then(function(data){
      return (data && Array.isArray(data.companions)) ? data.companions : [];
    }).catch(function(){ return []; });
  };

  try{ window.CompanionEngine=CompanionEngine; }catch(e){}
})();
