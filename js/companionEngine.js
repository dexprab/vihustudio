// js/companionEngine.js — Companion Engine Foundation (Sprint C1, Lumo v1).
//
// A generic runtime for Companion Packages (assets/companions/<id>/
// companion.json + one PNG per declared state). The engine knows
// nothing about any specific companion — it only understands the
// Companion Package Contract: a manifest naming a defaultState and a
// map of state name -> image filename. Lumo is the first package that
// exercises this contract; every future companion (Nimbus, Moss, Nova,
// ...) is just another folder under assets/companions/ with the same
// shape, loadable with zero changes to this file. There is, and must
// never be, a branch here that reads a companion's id to decide
// behaviour (e.g. `if (id === 'lumo')`) — every decision this class
// makes is driven entirely by the loaded package's own declared data.
//
// Today's runtime behaviour is image swapping only, by design (this
// sprint's own stated goal is the contract + runtime + state engine,
// not animation) — but every public method is written so a later
// version can grow real capability behind the exact same signature:
// setState() could ease-crossfade or drive a sprite-sheet animation
// instead of a hard swap; a companion package could declare a sound
// clip alongside an image and setState() could play it; speak() could
// grow a typewriter effect or TTS; show()/hide() could add motion. None
// of that requires widening this class's public API.
(function(){
  'use strict';

  const DEFAULT_SPEAK_DURATION_MS = 4200;

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
      this._state=null;
      this._visible=false;
      this._root=null;
      this._imgEl=null;
      this._bubbleEl=null;
      this._speakTimer=null;
    }

    // ---------- Loading ----------

    /**
     * Loads a Companion Package by id: fetches
     * assets/companions/<id>/companion.json, validates its shape, and
     * preloads every declared state's image (plus hero.png, when
     * present, as a non-blocking best-effort extra — a missing hero
     * image never fails the load). Resolves with the loaded manifest.
     * Safe to call again later to switch companions; the previous
     * package's own preloaded images are simply dropped.
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
          return this._preloadStates(base,pkg).then(()=>{
            this._package=pkg;
            this._basePath=base;
            this._state=pkg.defaultState;
            if(this._imgEl) this._applyState(this._state);
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
    }

    getState(){ return this._state; }

    // The one place a state name becomes a rendered image. A future
    // version with animation/particle/sound capability extends this
    // single method (or the package's own per-state data), never the
    // public setState() signature above.
    _applyState(state){
      this._ensureDom();
      if(!this._package) return;
      const file=this._package.states[state];
      if(!file) return;
      this._imgEl.src=this._basePath+file;
      this._imgEl.alt=(this._package.name||this._package.id)+' — '+state;
    }

    // ---------- Speech ----------

    /**
     * Shows a simple rounded speech bubble above the companion with
     * static text (no AI, no typing effect this sprint) for
     * speakDurationMs, resetting the timer if called again before it
     * elapses.
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
      },this._speakDurationMs);
    }

    // ---------- Teardown ----------

    /** Removes the widget from the DOM and clears all engine state. */
    destroy(){
      if(this._speakTimer){ clearTimeout(this._speakTimer); this._speakTimer=null; }
      if(this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
      this._root=null;
      this._imgEl=null;
      this._bubbleEl=null;
      this._package=null;
      this._basePath=null;
      this._state=null;
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

      const portrait=document.createElement('div');
      portrait.className='companion-portrait';
      const img=document.createElement('img');
      img.className='companion-portrait-img';
      img.alt='';
      portrait.appendChild(img);
      root.appendChild(portrait);

      document.body.appendChild(root);

      this._root=root;
      this._bubbleEl=bubble;
      this._imgEl=img;

      if(this._package) this._applyState(this._state);
    }
  }

  try{ window.CompanionEngine=CompanionEngine; }catch(e){}
})();
