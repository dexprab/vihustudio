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
// Every one of Lumo's ~23 spoken lines in the app is covered here now (the
// tap-grid gatekeeper greeting; the Traveller Gateway's 5-line greeting,
// title+subtitle each recorded as its own clip; the Returning Creator's
// short "Welcome home / Show me your stars" recognition pair; the
// Returning Creator's own "It's good to see you again" reunion pair; the
// Creator Ceremony's two Guardian beats; the Creator Signature
// sky-recognition challenge's 4 lines -- prompt/wrong-tap/fresh-decoys/
// success; and the Gate video's own flying-in/landing beats) -- see
// CLAUDE.md's own running disclosure of this batch.
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
//
// Real bug fix ("the audio does not play always, may be initialization
// and load time lag"): every clip used to be created lazily, on the very
// call that plays it, with no lead time to fetch/decode -- a genuine
// race play() could lose silently. preload(ids) now primes clips ahead
// of need -- js/app.js calls it with no argument at Studio boot, priming
// the whole ~1.3MB set at once -- and a real play()/canplay retry
// replaces the old silent give-up if a clip still wasn't ready.
(function(){
  'use strict';

  const VOLUME=0.85;
  const BASE='assets/lumo/voice/';

  const LINES={
    // "i have recorded all the prompts" — the real voices, uploaded as
    // vlumo-*.mp3 and swapped in over the original placeholder clips (git
    // mv, so every filename below is unchanged); durations re-measured
    // via ffprobe against the real files, since a re-recorded line rarely
    // runs the exact same length as its placeholder.
    tapgrid:{file:'lumo-01-tapgrid.mp3',ms:3866},

    // Studio Rite — re-recorded, one continuous take per screen.
    //
    // These are registered WHOLE rather than cut into a clip per line,
    // which is a change from the first attempt (riteS1L1/S1L2/... with
    // from/to offsets into one file). Cutting means a boundary that is a
    // few frames out clips a word off the start or end of a line, and
    // there is no way to notice that from a waveform. Playing the take
    // whole cannot truncate anything; js/studioRite.js instead reveals
    // each line of text at a measured cue, so a cue that is slightly out
    // only shows a line slightly early or late while the performance
    // itself stays intact. The pacing is then the recording's own.
    //
    // Durations measured by decoding each file and reading its real
    // length, not from the encoder's header.
    riteScreen1:{file:'lumo-screen1-redone.mp3',ms:13240},
    riteScreen2:{file:'lumo-screen2-redone.mp3',ms:20510},
    riteScreen3:{file:'lumo-screen3-redone.mp3',ms:8360},
    riteScreen4:{file:'lumo-screen4-redone.mp3',ms:5720},
    riteScreen5:{file:'lumo-screen5-redone.mp3',ms:7000},
    riteScreen6:{file:'lumo-screen6-redone.mp3',ms:5330},
    riteScreen7:{file:'lumo-screen7-redone.mp3',ms:11960},

    // Screens 8-23, recorded later and measured the same way. Lumo used
    // to fall silent from screen 8 onward, so a child heard a guide
    // through the opening and then made the rest of their first story
    // with a narrator who had stopped speaking.
    riteScreen8:{file:'lumo-screen8-redone.mp3',ms:4989},
    riteScreen9:{file:'lumo-screen9-redone.mp3',ms:4206},
    riteScreen10:{file:'lumo-screen10-redone.mp3',ms:2194},
    riteScreen11:{file:'lumo-screen11-redone.mp3',ms:7628},
    riteScreen12:{file:'lumo-screen12-redone.mp3',ms:3709},
    riteScreen13:{file:'lumo-screen13-redone.mp3',ms:5956},
    riteScreen14:{file:'lumo-screen14-redone.mp3',ms:11154},
    riteScreen15:{file:'lumo-screen15-redone.mp3',ms:1724},
    riteScreen16:{file:'lumo-screen16-redone.mp3',ms:4598},
    riteScreen17:{file:'lumo-screen17-redone.mp3',ms:5486},
    riteScreen18:{file:'lumo-screen18-redone.mp3',ms:6766},
    riteScreen19:{file:'lumo-screen19-redone.mp3',ms:4362},
    riteScreen20:{file:'lumo-screen20-redone.mp3',ms:4676},
    riteScreen21:{file:'lumo-screen21-redone.mp3',ms:4519},
    riteScreen22:{file:'lumo-screen22-redone.mp3',ms:10188},
    riteScreen23:{file:'lumo-screen23-redone.mp3',ms:8281},

    // Traveller Gateway greeting -- title then subtitle, one real clip
    // each, played back to back (see playSequence()) while both lines of
    // text are already visible together in one bubble.
    greeting1:{file:'lumo-02-greeting1.mp3',ms:1228},
    greeting1b:{file:'lumo-03-greeting1b.mp3',ms:2273},
    greeting2:{file:'lumo-04-greeting2.mp3',ms:1567},
    greeting2b:{file:'lumo-05-greeting2b.mp3',ms:2351},
    greeting3:{file:'lumo-06-greeting3.mp3',ms:2586},
    greeting3b:{file:'lumo-07-greeting3b.mp3',ms:2429},
    greeting4:{file:'lumo-08-greeting4.mp3',ms:2429},
    greeting4b:{file:'lumo-09-greeting4b.mp3',ms:4362},
    greeting5:{file:'lumo-10-greeting5.mp3',ms:1959},
    greeting5b:{file:'lumo-11-greeting5b.mp3',ms:1411},

    // Returning Creator -- recognition line, heard before the star-tap
    // check (over the still-closed gate).
    returning1:{file:'lumo-12-returning1.mp3',ms:1646},
    returning2:{file:'lumo-13-returning2.mp3',ms:1724},

    // Returning Creator -- reunion pair, spoken in person once Lumo lands.
    arrivalReturning1:{file:'lumo-14-arrivalreturning1.mp3',ms:2194},
    arrivalReturning2:{file:'lumo-15-arrivalreturning2.mp3',ms:2351},

    // Creator Ceremony -- Lumo's two Guardian beats.
    ceremony1:{file:'lumo-16-ceremony1.mp3',ms:2429},
    ceremony2:{file:'lumo-17-ceremony2.mp3',ms:2194},

    // Creator Signature sky-recognition challenge -- the gatekeeper's
    // own 4 spoken lines (prompt / wrong tap / fresh decoys / success).
    skyPrompt:{file:'lumo-18-skyprompt.mp3',ms:3396},
    skyWrong:{file:'lumo-19-skywrong.mp3',ms:2926},
    skyFresh:{file:'lumo-20-skyfresh.mp3',ms:4598},
    skySuccess:{file:'lumo-21-skysuccess.mp3',ms:2429},

    // Traveller Gateway -- the single Gate video's own Segment 1: Lumo
    // becomes visible flying in (lumoFlying, fired as Segment 1 starts),
    // then lands and settles with the Story Egg between its feet
    // (lumoLanding, fired the instant Segment 1 pauses, just before the
    // in-person greeting/recognition lines begin).
    lumoFlying:{file:'lumo-22-flying.mp3',ms:2712},
    lumoLanding:{file:'lumo-23-landing.mp3',ms:2712}
  };

  const cache={};

  function _audioFor(id){
    const entry=LINES[id];
    if(!entry) return null;
    let audio=cache[id];
    if(!audio){
      audio=new Audio(BASE+entry.file);
      audio.volume=VOLUME;
      // Explicit, not just relying on the constructor's own implicit
      // fetch -- the strongest hint to start buffering right away, same
      // as js/audioManager.js's own Foundation layers already do.
      audio.preload='auto';
      cache[id]=audio;
    }
    return audio;
  }

  // Real, confirmed bug: a freshly-created Audio element's play() call can
  // race the network/decode and reject (readyState too low), and every
  // caller here swallowed that silently -- "the audio does not play
  // always, may be its initialization and load time lag," exactly. If the
  // element genuinely wasn't ready yet, wait for it to actually become
  // playable and try exactly once more instead of silently giving up.
  // currentTime cannot be set before metadata exists, so defer if the
  // element has not loaded far enough yet.
  function _seek(audio,t){
    try{
      if(audio.readyState>=1){ audio.currentTime=t; return; }
      audio.addEventListener('loadedmetadata',function once(){
        try{ audio.currentTime=t; }catch(e){}
      },{once:true});
    }catch(e){}
  }

  // Stops a clip at its segment end and fires a real 'ended' event, so
  // playSequence()'s existing chaining keeps working unchanged for
  // offset-based entries.
  function _armSegmentEnd(audio,to){
    if(!(to>0)) return;
    if(audio.__vhSegGuard){ audio.removeEventListener('timeupdate',audio.__vhSegGuard); }
    const guard=function(){
      if(audio.currentTime>=to){
        audio.removeEventListener('timeupdate',guard);
        audio.__vhSegGuard=null;
        try{ audio.pause(); }catch(e){}
        try{ audio.dispatchEvent(new Event('ended')); }catch(e){}
      }
    };
    audio.__vhSegGuard=guard;
    audio.addEventListener('timeupdate',guard);
  }

  function _playWithRetry(audio,onSettle,seg){
    _seek(audio,(seg&&seg.from)||0);
    _armSegmentEnd(audio,seg&&seg.to);
    let played=false;
    const p=audio.play();
    if(p && typeof p.then==='function'){
      p.then(function(){ played=true; if(onSettle) onSettle(); }).catch(function(){
        if(played) return;
        if(audio.readyState<2){ // below HAVE_CURRENT_DATA -- the load-lag case
          const retry=function(){
            audio.removeEventListener('canplay',retry);
            _seek(audio,(seg&&seg.from)||0);
            audio.play().then(function(){ if(onSettle) onSettle(); })
              .catch(function(){ if(onSettle) onSettle(); });
          };
          audio.addEventListener('canplay',retry,{once:true});
        }else if(onSettle){ onSettle(); }
      });
    }else if(onSettle){ onSettle(); }
  }

  // ONE LUMO, ONE VOICE. Reported by the product owner on the stars
  // screen: "if i choose my stars very quickly the lines spoken by
  // lumo overlaps." Every line lives in its own cached Audio element,
  // and play() never stopped the one already talking — so a fast child
  // (or any two screens handing over quickly) had Lumo speaking over
  // himself. js/studioRite.js already stopped its own previous line by
  // hand, which is this rule existing in one caller; it belongs in the
  // one module that owns the voice, so every screen gets it. Starting
  // a new line now ends the previous one mid-sentence — the way a
  // person changes what they are saying — and cancels any pending
  // playSequence chain. A LOOPING clip is exempt both ways: it is
  // staged ambience (the Gate's flight sound), deliberately concurrent
  // with spoken lines and ended by its own choreography's stop().
  let _current=null;
  let _seqGen=0;
  function _silence(){
    _seqGen++;
    const audio=_current;
    _current=null;
    if(!audio) return;
    try{
      if(audio.__vhSegGuard){
        audio.removeEventListener('timeupdate',audio.__vhSegGuard);
        audio.__vhSegGuard=null;
      }
      if(!audio.paused) audio.pause();
      audio.currentTime=0;
    }catch(e){}
  }

  // "is the audio not in loop on second fly of lumo?" -- confirmed: it
  // wasn't. A single clip (~2.7s) played once while Segment 2's own
  // flight footage runs roughly 10s, so the audio ended and went silent
  // for the rest of the flight. opts.loop repeats the clip until stop()
  // is called (or the page unloads); every other caller keeps the exact
  // same one-shot behaviour by simply not passing it.
  function play(id,opts){
    try{
      const loop=!!(opts&&opts.loop);
      if(!loop) _silence();
      const audio=_audioFor(id);
      if(!audio) return;
      const entry=LINES[id];
      // An offset entry must never loop — looping would replay the whole
      // file, not the segment.
      audio.loop=loop&&!(entry&&entry.to);
      if(!loop) _current=audio;
      _playWithRetry(audio,null,entry);
    }catch(e){}
  }

  // Stops a looping (or still-playing) clip started via play(id,{loop:
  // true}) and resets it so a later play() of the same id starts clean.
  function stop(id){
    try{
      const audio=cache[id];
      if(!audio) return;
      audio.loop=false;
      audio.pause();
      audio.currentTime=0;
      if(_current===audio) _current=null;
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
      // One voice: a sequence takes the floor exactly like a single
      // line, and a LATER play()/playSequence() takes it back — the
      // generation token kills this chain so a clip that ends after
      // the hand-off cannot chain its successor over the new line.
      _silence();
      const my=_seqGen;
      const list=Array.isArray(ids)?ids:[ids];
      let i=0;
      function next(){
        if(my!==_seqGen) return;
        if(i>=list.length) return;
        const audio=_audioFor(list[i]);
        i++;
        if(!audio){ next(); return; }
        _current=audio;
        audio.removeEventListener('ended',next);
        audio.addEventListener('ended',next,{once:true});
        _playWithRetry(audio,function(){
          // A clip that never actually became playable (retry also
          // failed) won't fire 'ended' on its own -- move on rather than
          // silently stall the rest of the sequence forever.
          if(my!==_seqGen) return;
          if(audio.paused && audio.currentTime===0){
            audio.removeEventListener('ended',next);
            next();
          }
        });
      }
      next();
    }catch(e){}
  }

  // Primes one, several, or (with no argument) every known line ahead of
  // actual playback time -- the real fix for the load-lag bug: giving the
  // browser real lead time to fetch/decode before play()/playSequence()
  // is ever called, rather than lazily creating the element at the exact
  // moment it's needed. Safe to call as early and as often as useful (a
  // no-op for an id already cached); the full 17-clip set is ~1.3MB
  // total, small enough to prime unconditionally at Studio boot.
  function preload(ids){
    try{
      const list=ids?(Array.isArray(ids)?ids:[ids]):Object.keys(LINES);
      list.forEach(function(id){ _audioFor(id); });
    }catch(e){}
  }

  // A real preload-gate signal, matching js/audioManager.js's own
  // whenFoundationReady() -- resolves once every clip currently primed
  // via preload() has buffered enough to play through (or already had),
  // racing a bounded timeout. Only ever checks whatever's already in
  // `cache` -- call preload(ids) first so there's something to wait on;
  // an empty cache resolves immediately.
  function whenReady(ids,timeoutMs){
    const list=ids?(Array.isArray(ids)?ids:[ids]):Object.keys(cache);
    if(!list.length) return Promise.resolve();
    const ms=(typeof timeoutMs==='number'&&isFinite(timeoutMs))?timeoutMs:4000;
    const perClip=list.map(function(id){
      return new Promise(function(resolve){
        const audio=cache[id];
        if(!audio || audio.readyState>=3){ resolve(); return; }
        const done=function(){
          audio.removeEventListener('canplaythrough',done);
          audio.removeEventListener('error',done);
          resolve();
        };
        audio.addEventListener('canplaythrough',done,{once:true});
        audio.addEventListener('error',done,{once:true});
      });
    });
    const timeout=new Promise(function(resolve){ setTimeout(resolve,ms); });
    return Promise.race([Promise.all(perClip),timeout]);
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

  const LumoVoice={ play:play, stop:stop, playSequence:playSequence, durationMs:durationMs, preload:preload, whenReady:whenReady };
  try{ window.LumoVoice=LumoVoice; }catch(e){}
})();
