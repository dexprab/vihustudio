// js/gatewayAudio.js — Creator Gateway, real click-triggered sound only.
//
// Mirrors vihuplanet/js/heroAudio.js's own proven discipline exactly: no
// autoplay, no ambient/looping background music, one shared volume
// constant, playback fires ONLY from inside a real click/keydown handler.
// The two .wav files this reads (assets/audio/gateway/) are one-time
// COPIES of already-existing, generically-appropriate sounds from
// vihuplanet/assets/audio/ (a separate, disconnected sibling app — see
// CLAUDE.md's own "no cross-product coupling" decision) — copied in as
// new, disclosed, product-owned Product Assets for this milestone, never
// a live code/asset dependency on that other app. See
// assets/audio/gateway/README.md for the full disclosure, including the
// standing gap this does NOT close: no real "peaceful ambient music"
// exists anywhere in this sandbox to source or record, so the Gateway's
// Scenes 1-3 play silently except for the one soft transition sound
// wired below.
(function(){
  'use strict';

  const VOLUME=0.5;
  const BASE='assets/audio/gateway/';
  const cache={};

  function play(name){
    try{
      let audio=cache[name];
      if(!audio){
        audio=new Audio(BASE+name);
        audio.volume=VOLUME;
        cache[name]=audio;
      }
      audio.currentTime=0;
      // .catch swallows the browser's own autoplay-policy rejection —
      // this call only ever fires from inside a real click handler, so
      // that rejection should never actually fire, but a companion
      // hiccup must never break the Gateway (the exact same defensive
      // discipline js/companionDirector.js's own safe() wrapper uses).
      audio.play().catch(function(){});
    }catch(e){}
  }

  const GatewayAudio={
    // Wired to the Gateway's own tap-to-continue affordance.
    tapContinue:function(){ play('transition-breeze.wav'); },
    // Reserved for a future click-triggered Gateway moment — not called
    // anywhere yet this milestone, disclosed rather than silently unused.
    lumoArrive:function(){ play('telescope-click.wav'); }
  };

  try{ window.GatewayAudio=GatewayAudio; }catch(e){}
})();
