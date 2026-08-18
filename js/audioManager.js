// js/audioManager.js — the Minimum Lovable Atmosphere System (MLAS), V1.
//
// One module, no Director, no scheduling, no rotation, no procedural anything —
// per docs/ATMOSPHERE_V1_BLUEPRINT.md, the frozen V1 implementation spec. Mirrors
// js/gatewayAudio.js's/js/lumoVoice.js's own proven discipline exactly: plain
// HTMLAudioElement, no autoplay, playback only ever starts from inside a real
// user-gesture handler, every failure swallowed defensively.
//
// Foundation is NOT a single track. All five ElevenLabs-generated layers (Air,
// Harmony, Magic, Forest, Wind) loop simultaneously, always, at their own fixed
// relative volumes below -- forming one composite always-on sound. This is a
// direct, explicit product correction over an earlier draft of this module's own
// design doc, which wrongly assumed a single Foundation track: "the
// simplification was architectural, not experiential... the AudioManager simply
// loads the five Foundation layers, applies fixed volumes, loops them
// indefinitely and optionally overlays a World ambience layer."
//
// World ambience is optional, resolved generically from whatever a Theme's own
// audio.ambience array declares -- AudioManager never knows what a "Theme" or
// "World" is, only ever receives plain filename/path strings from a caller that
// already resolved them (see js/themeEngine.js's applyTheme()/applyArtworkTheme()
// hooks). No hardcoded World ids anywhere in this file.
(function(){
  'use strict';

  // Resolved relative to this script's own file (js/audioManager.js sits one
  // folder below the project root, where assets/ lives) rather than the page
  // that loaded it -- a bare relative path would otherwise resolve
  // differently for index.html (project root) vs. a nested tool page like
  // tools/audio-mixer/index.html (two folders deeper), silently 404ing there
  // even though the real files exist -- mirroring the identical fix already
  // established for js/themeRepositoryClient.js's own supabase-config.json path.
  const AUDIO_ROOT=(function(){
    const scriptEl=document.currentScript;
    return scriptEl ? new URL('../assets/audio/',scriptEl.src).href : 'assets/audio/';
  })();
  const FOUNDATION_BASE=AUDIO_ROOT+'foundation/';
  const WORLDS_BASE=AUDIO_ROOT+'worlds/';

  // Five Foundation layers, each with its own fixed relative volume -- a
  // deliberate mix, not five equal levels. Tuned by ear in
  // tools/audio-mixer/ and pasted back here, which is the whole loop that
  // tool exists for.
  //
  // THREE OF THE FIVE ARE DELIBERATELY SILENT. That is not an oversight to
  // be helpfully corrected. Measured, the old mix was 73% air.mp3, and
  // air/harmony/magic are all held pitches (spectral flatness 0.21, 0.09,
  // 0.13 where 1.0 is noise) -- so what a child heard was two sustained
  // tones with almost no texture under them, which is how suspense is
  // scored. Reported as "the music sounds like a horror movie music".
  //
  // What is left is the two textural layers: wind (0.47 flatness) at about
  // three quarters of the bed and forest (0.61, the most textural of the
  // five) at the rest. The bed is now weather rather than music, and the
  // music is whatever World ambience plays on top of it.
  const FOUNDATION_LAYERS=[
    {file:'air.mp3',volume:0},
    {file:'harmony.mp3',volume:0},
    {file:'magic.mp3',volume:0},
    {file:'forest.mp3',volume:0.35},
    {file:'wind.mp3',volume:0.15}
  ];

  const MUTE_KEY='vihu-audio-muted';
  const VOLUME_KEY='vihu-audio-volume';
  const DEFAULT_VOLUME=0.55;
  // A World ambience layer's own level, against the Foundation bed it sits
  // on top of. It used to be hard-coded to 1 at the point the element was
  // built, with no way to say otherwise, so nothing else could ever be
  // auditioned; tools/audio-mixer/ now has a fader for it.
  //
  // At 0.33 a World track still sits well above the bed -- measured against
  // the shipped Foundation mix, the five tracks in assets/audio/worlds/ run
  // seven to eight times the bed's own level at this setting. That is the intended shape rather than an imbalance:
  // the Foundation layers are weather now, and the World track is the
  // music.
  const DEFAULT_WORLD_VOLUME=0.33;

  // THE MUSIC OF THE PLACE, when no World has said otherwise.
  //
  // The Foundation bed is weather now (see FOUNDATION_LAYERS above), so
  // without this there is texture and no music at all. One of these plays,
  // then another, chosen at random and never the same one twice running,
  // handing over with the same crossfade playWorld uses between Worlds.
  // Chosen by the product owner after listening to all five uploaded tracks.
  //
  // They are not equal lengths -- a and c run 45 seconds each, e runs 150 --
  // so e is heard for more of any given visit than the other two. That is a
  // property of the tracks rather than something this list can express; the
  // ORDER here means nothing now, only the membership does.
  //
  // It is the DEFAULT, never an override: a Theme that declares its own
  // audio.ambience replaces this through the ordinary playWorld path, and
  // nothing here knows that Themes exist.
  const DEFAULT_WORLD_AMBIENCE=['a.mp3','c.mp3','e.mp3'];
  const DEFAULT_WORLD_FADE_MS=2700;
  const DEFAULT_MUTE_FADE_MS=300;

  let _initialized=false;
  let _muted=false;
  let _masterVolume=DEFAULT_VOLUME;
  let _foundationEls=[]; // [{el, baseVolume, file}]
  let _worldEl=null;
  let _worldSequence=[];      // the World refs in play; more than one alternates
  let _worldIndex=0;
  let _worldAdvanceTimer=null;
  let _worldRefsKey=null; // JSON-stringified current World ambience refs, for the no-op re-entry check
  let _unlockHandler=null;
  let _fadeTimers=[]; // active setInterval ids, cleared defensively on shutdown

  // Mutable fade timings -- a temporary mixing-console affordance (see
  // tools/audio-mixer/) so the actual crossfade/mute feel can be dialed in by
  // ear; every existing caller that never touches these keeps the exact same
  // defaults this module always shipped with.
  let _worldFadeMs=DEFAULT_WORLD_FADE_MS;
  let _worldVolume=DEFAULT_WORLD_VOLUME;
  let _muteFadeMs=DEFAULT_MUTE_FADE_MS;

  function _readPrefs(){
    try{
      const m=localStorage.getItem(MUTE_KEY);
      if(m!==null) _muted=(m==='1');
      const v=localStorage.getItem(VOLUME_KEY);
      if(v!==null){
        const n=parseFloat(v);
        if(isFinite(n) && n>=0 && n<=1) _masterVolume=n;
      }
    }catch(e){}
  }

  function _persistMuted(){
    try{ localStorage.setItem(MUTE_KEY,_muted?'1':'0'); }catch(e){}
  }

  function _persistVolume(){
    try{ localStorage.setItem(VOLUME_KEY,String(_masterVolume)); }catch(e){}
  }

  // The one place "how loud should this element actually be right now" is
  // decided -- baseVolume (a layer's own fixed mix level, or 1 for the single
  // World element) times the master multiplier, zeroed entirely while muted.
  function _effectiveVolume(baseVolume){
    if(_muted) return 0;
    return Math.max(0,Math.min(1,baseVolume*_masterVolume));
  }

  function _applyVolumesInstantly(){
    _foundationEls.forEach(function(entry){
      try{ entry.el.volume=_effectiveVolume(entry.baseVolume); }catch(e){}
    });
    if(_worldEl){
      try{ _worldEl.volume=_effectiveVolume(_worldEl.__baseVolume||1); }catch(e){}
    }
  }

  // A small, generic linear ramp -- deliberately not equal-power, not
  // per-layer-curved, per the frozen "no complex ducking / no DSP" scope. Steps
  // over `ms`, calling onDone (if given) once settled. Returns nothing; caller
  // doesn't need to track it since the timer clears itself.
  function _ramp(el,fromVol,toVol,ms,onDone){
    if(!el){ if(onDone) onDone(); return; }
    const steps=Math.max(1,Math.round(ms/50));
    let i=0;
    try{ el.volume=Math.max(0,Math.min(1,fromVol)); }catch(e){}
    const timer=setInterval(function(){
      i++;
      const t=i/steps;
      const v=fromVol+(toVol-fromVol)*t;
      try{ el.volume=Math.max(0,Math.min(1,v)); }catch(e){}
      if(i>=steps){
        clearInterval(timer);
        _fadeTimers=_fadeTimers.filter(function(id){ return id!==timer; });
        if(onDone) onDone();
      }
    },50);
    _fadeTimers.push(timer);
  }

  // Mirrors ThemeRegistry.resolveAssetRef()'s own dual-mode resolution in
  // spirit (already-a-usable-src vs. a bare reference needing resolution) --
  // not called directly, since that function is scoped to a Theme package's
  // own compiled image/font assets map, and World ambience for V1 lives in a
  // fixed, non-package location.
  function _resolveWorldRef(ref){
    if(!ref) return ref;
    if(/^(data:|https?:|assets\/)/i.test(ref)) return ref;
    return WORLDS_BASE+ref;
  }

  function _installUnlockListener(){
    if(_unlockHandler) return;
    _unlockHandler=function(){
      _foundationEls.forEach(function(entry){
        try{ entry.el.play().catch(function(){}); }catch(e){}
      });
      document.removeEventListener('pointerdown',_unlockHandler,true);
      document.removeEventListener('keydown',_unlockHandler,true);
      _unlockHandler=null;
    };
    document.addEventListener('pointerdown',_unlockHandler,true);
    document.addEventListener('keydown',_unlockHandler,true);
  }

  function init(){
    if(_initialized) return;
    _initialized=true;
    _readPrefs();
    try{
      _foundationEls=FOUNDATION_LAYERS.map(function(layer){
        const el=new Audio(FOUNDATION_BASE+layer.file);
        el.loop=true;
        el.preload='auto';
        el.volume=_effectiveVolume(layer.volume);
        return {el:el,baseVolume:layer.volume,file:layer.file};
      });
    }catch(e){ _foundationEls=[]; }
    _installUnlockListener();
  }

  // A real preload-gate signal ("something which can hold the screens till
  // everything is loaded and ready") -- resolves once every Foundation layer
  // has buffered enough to play through without stalling (or already has,
  // checked via readyState first so an already-cached repeat load resolves
  // instantly), racing a bounded timeout so a slow/broken connection can
  // never hang boot forever. A no-op-resolved Promise if init() hasn't run.
  function whenFoundationReady(timeoutMs){
    if(!_initialized || !_foundationEls.length) return Promise.resolve();
    const ms=(typeof timeoutMs==='number'&&isFinite(timeoutMs))?timeoutMs:4000;
    const perEl=_foundationEls.map(function(entry){
      return new Promise(function(resolve){
        const el=entry.el;
        if(el.readyState>=3){ resolve(); return; } // HAVE_FUTURE_DATA
        const done=function(){
          el.removeEventListener('canplaythrough',done);
          el.removeEventListener('error',done);
          resolve();
        };
        el.addEventListener('canplaythrough',done,{once:true});
        el.addEventListener('error',done,{once:true});
      });
    });
    const timeout=new Promise(function(resolve){ setTimeout(resolve,ms); });
    return Promise.race([Promise.all(perEl),timeout]);
  }

  // Safe to call any time after init() -- a no-op if already playing (the
  // unlock listener already starts everything on the first real gesture; this
  // exists for a caller that wants to explicitly ensure playback has begun,
  // e.g. after a later gesture if the very first one somehow missed).
  function playFoundation(){
    if(!_initialized) return;
    _foundationEls.forEach(function(entry){
      try{
        if(entry.el.paused) entry.el.play().catch(function(){});
      }catch(e){}
    });
    // Started from here rather than from init(), for the reason every other
    // playback in this module is: it has to begin inside a real user gesture
    // or the browser blocks it. Only when nothing else is already playing, so
    // a World that got in first is never interrupted by the default.
    if(!_worldEl && DEFAULT_WORLD_AMBIENCE.length) playWorld(DEFAULT_WORLD_AMBIENCE);
  }

  // ambienceRefs: array of filenames (resolved against assets/audio/worlds/) or
  // already-qualified paths, e.g. ['forest.mp3']. A no-op if the exact same
  // refs are already the active World ambience. Never called with a Theme
  // object -- the caller (js/themeEngine.js) already extracted the plain array.
  //
  // MORE THAN ONE REF IS A SET TO CHOOSE FROM. The signature always took an
  // array and only ever played [0]; more than one entry now means "any of
  // these, one after another", which is what the array shape always implied.
  // One track alone still loops exactly as it always did, so every existing
  // caller is unaffected.
  //
  // The change of hands is the same crossfade playWorld already performs
  // between two different Worlds -- one track ramps down over the World Fade
  // while the next ramps up -- so a turn never lands on a silence or a seam.
  function playWorld(ambienceRefs){
    if(!_initialized) return;
    if(!ambienceRefs || !ambienceRefs.length){ stopWorld(); return; }
    const key=JSON.stringify(ambienceRefs);
    if(key===_worldRefsKey) return; // already playing this exact World ambience
    _worldRefsKey=key;
    _worldSequence=ambienceRefs.slice();
    // Where it starts is chosen too, or every arrival in VihuPlanet would
    // open on the same track and the randomness would only begin after the
    // first hand-over -- which is the part of it a child is least likely to
    // still be there for.
    _worldIndex=_worldSequence.length>1
      ? Math.floor(Math.random()*_worldSequence.length) : 0;
    _startWorldTrack();
  }

  // Builds the element for _worldSequence[_worldIndex], crossfading whatever
  // is currently playing out underneath it.
  function _startWorldTrack(){
    const refs=_worldSequence;
    if(!refs || !refs.length) return;
    const alternating=refs.length>1;
    const src=_resolveWorldRef(refs[_worldIndex % refs.length]);
    const oldEl=_worldEl;
    let newEl;
    try{
      newEl=new Audio(src);
      // A single track loops itself, as it always has. A sequence must not:
      // it has to reach its own end for there to be a moment to hand over on.
      newEl.loop=!alternating;
      newEl.preload='auto';
      newEl.__baseVolume=_worldVolume;
      newEl.volume=0;
    }catch(e){ newEl=null; }

    _clearWorldAdvance();
    if(oldEl){
      _ramp(oldEl,oldEl.volume,0,_worldFadeMs,function(){
        try{ oldEl.pause(); }catch(e){}
      });
    }
    _worldEl=newEl;
    if(!newEl) return;
    try{
      newEl.play().catch(function(){});
    }catch(e){}
    _ramp(newEl,0,_effectiveVolume(_worldVolume),_worldFadeMs);
    if(alternating) _scheduleWorldAdvance(newEl);
  }

  // The hand-over starts one World Fade BEFORE the track ends, so the two
  // overlap and the change is a crossfade rather than a cut. 'ended' is kept
  // as a backstop for anything whose duration never resolves (a stream, a
  // metadata failure) -- there it becomes a plain cut, which is still better
  // than the music stopping for good.
  function _scheduleWorldAdvance(el){
    function advance(){
      if(el!==_worldEl) return;          // superseded by a real World already
      _clearWorldAdvance();
      _worldIndex=_nextWorldIndex();
      _startWorldTrack();
    }
    el.addEventListener('ended',advance);
    el.__advanceOnEnded=advance;
    function arm(){
      const d=el.duration;
      if(!isFinite(d) || d<=0) return;   // 'ended' will have to do it
      const ms=Math.max(500,(d*1000)-_worldFadeMs);
      _clearWorldAdvance();
      el.addEventListener('ended',advance);
      el.__advanceOnEnded=advance;
      _worldAdvanceTimer=setTimeout(advance,ms);
    }
    if(isFinite(el.duration) && el.duration>0) arm();
    else el.addEventListener('loadedmetadata',arm,{once:true});
  }

  // WHICH TRACK COMES NEXT. Any of them except the one just heard.
  //
  // Chosen rather than taken in turns, so the place does not run to a
  // timetable a child could learn -- and the one exclusion is what keeps
  // "random" from meaning the same forty-five seconds twice in a row, which
  // is the one thing an ambience must never do. With two tracks that leaves
  // exactly one answer, so a pair still simply alternates.
  //
  // Math.random, deliberately, and NOT the runtime's seeded Rng. The seeded
  // generator exists so that every viewer sees the same Ether; what one
  // child happens to hear on one visit is theirs, and has no business being
  // shared or reproducible. Same reasoning the arrival turn already uses
  // (CLAUDE.md -> Decision 10).
  function _nextWorldIndex(){
    var n=_worldSequence.length;
    if(n<2) return 0;
    var i=Math.floor(Math.random()*(n-1));
    return i>=_worldIndex ? i+1 : i;
  }

  function _clearWorldAdvance(){
    if(_worldAdvanceTimer){ clearTimeout(_worldAdvanceTimer); _worldAdvanceTimer=null; }
  }

  function stopWorld(){
    _clearWorldAdvance();
    _worldSequence=[];
    _worldIndex=0;
    if(!_worldEl){ _worldRefsKey=null; return; }
    const el=_worldEl;
    _worldEl=null;
    _worldRefsKey=null;
    _ramp(el,el.volume,0,_worldFadeMs,function(){
      try{ el.pause(); }catch(e){}
    });
  }

  // A World ambience layer's level against the Foundation bed. Mirrors
  // setLayerVolume() exactly -- same clamp, same _effectiveVolume() pass --
  // except it also has to reach a track that is already playing, so the
  // mixer's slider can be heard while it is moved rather than only on the
  // next Play. The mute fade is used rather than the World fade: this is a
  // level change, not a World arriving or leaving.
  function setWorldVolume(vol){
    if(typeof vol!=='number' || !isFinite(vol)) return;
    _worldVolume=Math.max(0,Math.min(1,vol));
    if(_worldEl){
      _worldEl.__baseVolume=_worldVolume;
      _ramp(_worldEl,_worldEl.volume,_effectiveVolume(_worldVolume),_muteFadeMs);
    }
  }

  function getWorldVolume(){ return _worldVolume; }

  function setMuted(bool){
    _muted=!!bool;
    _persistMuted();
    _foundationEls.forEach(function(entry){
      _ramp(entry.el,entry.el.volume,_effectiveVolume(entry.baseVolume),_muteFadeMs);
    });
    if(_worldEl) _ramp(_worldEl,_worldEl.volume,_effectiveVolume(_worldEl.__baseVolume||1),_muteFadeMs);
  }

  function isMuted(){ return _muted; }

  function setVolume(n){
    if(typeof n!=='number' || !isFinite(n)) return;
    _masterVolume=Math.max(0,Math.min(1,n));
    _persistVolume();
    _applyVolumesInstantly();
  }

  function getVolume(){ return _masterVolume; }

  // ---- Temporary mixing-console API (see tools/audio-mixer/) ----
  // Additive only -- every method below is a new capability layered on top
  // of the existing playback/volume machinery above; nothing here changes
  // what any pre-existing caller (js/app.js, js/themeEngine.js) does.

  // Returns a plain, disconnected snapshot -- [{file, volume}] -- of each
  // Foundation layer's own filename and current relative mix level, so a
  // caller can build a per-layer control without reaching into internals.
  function getFoundationLayers(){
    return _foundationEls.map(function(entry){
      return {file:entry.file, volume:entry.baseVolume};
    });
  }

  // Adjusts one Foundation layer's own relative mix level live -- the exact
  // per-file entries in FOUNDATION_LAYERS at the top of this file, found by
  // filename (e.g. 'air.mp3'). A no-op if init() hasn't run yet or the file
  // name doesn't match a real layer.
  function setLayerVolume(file,vol){
    if(typeof vol!=='number' || !isFinite(vol)) return;
    const clamped=Math.max(0,Math.min(1,vol));
    const entry=_foundationEls.filter(function(e){ return e.file===file; })[0];
    if(!entry) return;
    entry.baseVolume=clamped;
    try{ entry.el.volume=_effectiveVolume(clamped); }catch(e){}
  }

  function getLayerVolume(file){
    const entry=_foundationEls.filter(function(e){ return e.file===file; })[0];
    return entry ? entry.baseVolume : null;
  }

  // World-ambience crossfade duration (playWorld()/stopWorld()'s own ramp).
  function setWorldFadeMs(ms){ if(typeof ms==='number' && isFinite(ms) && ms>=0) _worldFadeMs=ms; }
  function getWorldFadeMs(){ return _worldFadeMs; }

  // Mute/unmute ramp duration.
  function setMuteFadeMs(ms){ if(typeof ms==='number' && isFinite(ms) && ms>=0) _muteFadeMs=ms; }
  function getMuteFadeMs(){ return _muteFadeMs; }

  function shutdown(){
    _fadeTimers.forEach(function(id){ clearInterval(id); });
    _fadeTimers=[];
    _foundationEls.forEach(function(entry){
      try{ entry.el.pause(); entry.el.src=''; }catch(e){}
    });
    _foundationEls=[];
    _clearWorldAdvance();
    _worldSequence=[];
    if(_worldEl){
      try{ _worldEl.pause(); _worldEl.src=''; }catch(e){}
      _worldEl=null;
    }
    _worldRefsKey=null;
    if(_unlockHandler){
      document.removeEventListener('pointerdown',_unlockHandler,true);
      document.removeEventListener('keydown',_unlockHandler,true);
      _unlockHandler=null;
    }
    _initialized=false;
  }

  const AudioManager={
    init:init,
    whenFoundationReady:whenFoundationReady,
    playFoundation:playFoundation,
    playWorld:playWorld,
    stopWorld:stopWorld,
    setMuted:setMuted,
    isMuted:isMuted,
    setVolume:setVolume,
    getVolume:getVolume,
    shutdown:shutdown,
    getFoundationLayers:getFoundationLayers,
    setLayerVolume:setLayerVolume,
    getLayerVolume:getLayerVolume,
    setWorldVolume:setWorldVolume,
    getWorldVolume:getWorldVolume,
    setWorldFadeMs:setWorldFadeMs,
    getWorldFadeMs:getWorldFadeMs,
    setMuteFadeMs:setMuteFadeMs,
    getMuteFadeMs:getMuteFadeMs
  };
  try{ window.AudioManager=AudioManager; }catch(e){}
})();
