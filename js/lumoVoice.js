// js/lumoVoice.js — Lumo's recorded voice lines, one small ID-keyed lookup.
//
// Mirrors js/gatewayAudio.js's own proven discipline exactly: no autoplay,
// playback fires ONLY from inside a real click/keydown-originated call
// chain (every caller of LumoVoice.play()/playSequence() sits inside a
// user-gesture handler, or downstream of one -- e.g. the Traveller
// Gateway's own tap-to-begin), one shared volume constant, cached Audio
// objects, every failure swallowed defensively so a missing/broken clip
// can never break the screen it's attached to.
//
// Every one of Lumo's ~17 spoken lines in the app is covered here now (the
// tap-grid gatekeeper greeting; the Traveller Gateway's 5-line greeting,
// title+subtitle each recorded as its own clip; the Returning Creator's
// short "Welcome home / Show me your stars" recognition pair; the
// Returning Creator's own "It's good to see you again" reunion pair; and
// the Creator Ceremony's two Guardian beats) -- see CLAUDE.md's own
// running disclosure of this batch.
//
// `ms` is each clip's own real, measured duration (via ffprobe at the
// moment it was staged) -- exposed synchronously via durationMs() so a
// caller (js/gatewaySequence.js's playLines()) can stretch a beat's
// on-screen hold time to genuinely fit the recorded voice instead of
// guessing or cutting it off mid-sentence. If a line is ever re-recorded
// with a different length, this value needs a matching manual update --
// a disclosed, deliberate trade-off against the complexity/risk of
// loading real <audio> metadata asynchronously mid-sequence for a small,
// already-final batch of known clips.
(function(){
  'use strict';

  const VOLUME=0.85;
  const BASE='assets/lumo/voice/';

  const LINES={
    tapgrid:{file:'lumo-01-tapgrid.mp3',ms:5407},

    // Traveller Gateway greeting -- title then subtitle, one real clip
    // each, played back to back (see playSequence()) while both lines of
    // text are already visible together in one bubble.
    greeting1:{file:'lumo-02-greeting1.mp3',ms:1881},
    greeting1b:{file:'lumo-03-greeting1b.mp3',ms:2116},
    greeting2:{file:'lumo-04-greeting2.mp3',ms:1646},
    greeting2b:{file:'lumo-05-greeting2b.mp3',ms:1802},
    greeting3:{file:'lumo-06-greeting3.mp3',ms:2691},
    greeting3b:{file:'lumo-07-greeting3b.mp3',ms:2508},
    greeting4:{file:'lumo-08-greeting4.mp3',ms:2926},
    greeting4b:{file:'lumo-09-greeting4b.mp3',ms:4676},
    greeting5:{file:'lumo-10-greeting5.mp3',ms:1724},
    greeting5b:{file:'lumo-11-greeting5b.mp3',ms:3239},

    // Returning Creator -- recognition line, heard before the star-tap
    // check (over the still-closed gate).
    returning1:{file:'lumo-12-returning1.mp3',ms:1306},
    returning2:{file:'lumo-13-returning2.mp3',ms:1646},

    // Returning Creator -- reunion pair, spoken in person once Lumo lands.
    arrivalReturning1:{file:'lumo-14-arrivalreturning1.mp3',ms:1802},
    arrivalReturning2:{file:'lumo-15-arrivalreturning2.mp3',ms:2273},

    // Creator Ceremony -- Lumo's two Guardian beats.
    ceremony1:{file:'lumo-16-ceremony1.mp3',ms:2038},
    ceremony2:{file:'lumo-17-ceremony2.mp3',ms:2351}
  };

  const cache={};

  function _audioFor(id){
    const entry=LINES[id];
    if(!entry) return null;
    let audio=cache[id];
    if(!audio){
      audio=new Audio(BASE+entry.file);
      audio.volume=VOLUME;
      cache[id]=audio;
    }
    return audio;
  }

  function play(id){
    try{
      const audio=_audioFor(id);
      if(!audio) return;
      audio.currentTime=0;
      audio.play().catch(function(){});
    }catch(e){}
  }

  // Plays one or several ids back to back (a title clip followed by its
  // own subtitle clip, for the Traveller Gateway's two-clip greeting
  // lines) -- best-effort, chained off each clip's own real 'ended'
  // event so they never overlap. `ids` may be a single string, an array,
  // null/undefined (a normal no-op, matching play()'s own convention), or
  // contain an id with no real recording (skipped silently).
  function playSequence(ids){
    try{
      if(!ids) return;
      const list=Array.isArray(ids)?ids:[ids];
      let i=0;
      function next(){
        if(i>=list.length) return;
        const audio=_audioFor(list[i]);
        i++;
        if(!audio){ next(); return; }
        audio.currentTime=0;
        audio.removeEventListener('ended',next);
        audio.addEventListener('ended',next,{once:true});
        audio.play().catch(function(){ next(); });
      }
      next();
    }catch(e){}
  }

  // Synchronous, since every duration here is a known, pre-measured
  // constant (see the module header) -- no metadata-loading race to
  // manage. `ids` may be a single string, an array, or falsy (0ms).
  function durationMs(ids){
    if(!ids) return 0;
    const list=Array.isArray(ids)?ids:[ids];
    let total=0;
    for(let i=0;i<list.length;i++){
      const entry=LINES[list[i]];
      if(entry) total+=entry.ms;
    }
    return total;
  }

  const LumoVoice={ play:play, playSequence:playSequence, durationMs:durationMs };
  try{ window.LumoVoice=LumoVoice; }catch(e){}
})();
