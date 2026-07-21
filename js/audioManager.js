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

  const FOUNDATION_BASE='assets/audio/foundation/';
  const WORLDS_BASE='assets/audio/worlds/';

  // Five Foundation layers, each with its own fixed relative volume -- a
  // deliberate mix, not five equal levels. These starting values are a
  // placeholder balance, not a creative judgment this module is able to make on
  // its own; they're deliberately just one small, easily-editable table, meant
  // to be re-tuned by ear once the five real files can actually be heard mixed
  // together.
  const FOUNDATION_LAYERS=[
    {file:'air.mp3',volume:0.5},
    {file:'harmony.mp3',volume:0.4},
    {file:'magic.mp3',volume:0.3},
    {file:'forest.mp3',volume:0.35},
    {file:'wind.mp3',volume:0.3}
  ];

  const MUTE_KEY='vihu-audio-muted';
  const VOLUME_KEY='vihu-audio-volume';
  const DEFAULT_VOLUME=0.6;
  const WORLD_FADE_MS=2000;
  const MUTE_FADE_MS=300;

  let _initialized=false;
  let _muted=false;
  let _masterVolume=DEFAULT_VOLUME;
  let _foundationEls=[]; // [{el, baseVolume}]
  let _worldEl=null;
  let _worldRefsKey=null; // JSON-stringified current World ambience refs, for the no-op re-entry check
  let _unlockHandler=null;
  let _fadeTimers=[]; // active setInterval ids, cleared defensively on shutdown

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
        return {el:el,baseVolume:layer.volume};
      });
    }catch(e){ _foundationEls=[]; }
    _installUnlockListener();
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
  }

  // ambienceRefs: array of filenames (resolved against assets/audio/worlds/) or
  // already-qualified paths, e.g. ['forest.mp3']. A no-op if the exact same
  // refs are already the active World ambience. Never called with a Theme
  // object -- the caller (js/themeEngine.js) already extracted the plain array.
  function playWorld(ambienceRefs){
    if(!_initialized) return;
    if(!ambienceRefs || !ambienceRefs.length){ stopWorld(); return; }
    const key=JSON.stringify(ambienceRefs);
    if(key===_worldRefsKey) return; // already playing this exact World ambience
    _worldRefsKey=key;

    const src=_resolveWorldRef(ambienceRefs[0]);
    const oldEl=_worldEl;
    let newEl;
    try{
      newEl=new Audio(src);
      newEl.loop=true;
      newEl.preload='auto';
      newEl.__baseVolume=1;
      newEl.volume=0;
    }catch(e){ newEl=null; }

    if(oldEl){
      _ramp(oldEl,oldEl.volume,0,WORLD_FADE_MS,function(){
        try{ oldEl.pause(); }catch(e){}
      });
    }
    _worldEl=newEl;
    if(newEl){
      try{
        newEl.play().catch(function(){});
      }catch(e){}
      _ramp(newEl,0,_effectiveVolume(1),WORLD_FADE_MS);
    }
  }

  function stopWorld(){
    if(!_worldEl){ _worldRefsKey=null; return; }
    const el=_worldEl;
    _worldEl=null;
    _worldRefsKey=null;
    _ramp(el,el.volume,0,WORLD_FADE_MS,function(){
      try{ el.pause(); }catch(e){}
    });
  }

  function setMuted(bool){
    _muted=!!bool;
    _persistMuted();
    _foundationEls.forEach(function(entry){
      _ramp(entry.el,entry.el.volume,_effectiveVolume(entry.baseVolume),MUTE_FADE_MS);
    });
    if(_worldEl) _ramp(_worldEl,_worldEl.volume,_effectiveVolume(_worldEl.__baseVolume||1),MUTE_FADE_MS);
  }

  function isMuted(){ return _muted; }

  function setVolume(n){
    if(typeof n!=='number' || !isFinite(n)) return;
    _masterVolume=Math.max(0,Math.min(1,n));
    _persistVolume();
    _applyVolumesInstantly();
  }

  function getVolume(){ return _masterVolume; }

  function shutdown(){
    _fadeTimers.forEach(function(id){ clearInterval(id); });
    _fadeTimers=[];
    _foundationEls.forEach(function(entry){
      try{ entry.el.pause(); entry.el.src=''; }catch(e){}
    });
    _foundationEls=[];
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
    playFoundation:playFoundation,
    playWorld:playWorld,
    stopWorld:stopWorld,
    setMuted:setMuted,
    isMuted:isMuted,
    setVolume:setVolume,
    getVolume:getVolume,
    shutdown:shutdown
  };
  try{ window.AudioManager=AudioManager; }catch(e){}
})();
