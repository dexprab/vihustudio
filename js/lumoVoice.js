// js/lumoVoice.js — Lumo's recorded voice lines, one small ID-keyed lookup.
//
// Mirrors js/gatewayAudio.js's own proven discipline exactly: no autoplay,
// playback fires ONLY from inside a real click/keydown-originated call
// chain (every caller of LumoVoice.play() sits inside a user-gesture
// handler), one shared volume constant, cached Audio objects, every
// failure swallowed defensively so a missing/broken clip can never break
// the screen it's attached to.
//
// Lines are staged incrementally at assets/lumo/voice/lumo-NN-<id>.mp3 as
// real recordings arrive (see CLAUDE.md's own running disclosure) — an id
// with no entry below, or whose file 404s, is a normal, silent no-op:
// the on-screen text still reveals via its own typewriter animation with
// no audio, exactly as it did before any recording existed.
(function(){
  'use strict';

  const VOLUME=0.85;
  const BASE='assets/lumo/voice/';

  // Populated one line at a time as real recordings are supplied — never
  // guessed at or stubbed with a placeholder file. Only 'tapgrid' is real
  // today; the rest of Lumo's ~16 other lines (Gateway greeting/reunion,
  // Creator Ceremony beats) are staged here as their own recordings land.
  const LINES={
    tapgrid:'lumo-01-tapgrid.mp3'
  };

  const cache={};

  function play(id){
    try{
      const file=LINES[id];
      if(!file) return;
      let audio=cache[id];
      if(!audio){
        audio=new Audio(BASE+file);
        audio.volume=VOLUME;
        cache[id]=audio;
      }
      audio.currentTime=0;
      audio.play().catch(function(){});
    }catch(e){}
  }

  const LumoVoice={ play:play };
  try{ window.LumoVoice=LumoVoice; }catch(e){}
})();
