// =============================================================
// VihuStudio — Creation Playback (Sprint LOOK WHAT I MADE 1.1)
// -------------------------------------------------------------
// The ONE player for a Magic Creation replay — the hub's 🎬
// Watch, the parent's landing, the scanned card's deep entry.
// One creation moment, one treatment (the sprint's §8): the
// frames come from the same CreationShare snapshot everywhere,
// and this file is how they are shown everywhere.
//
// WHY IT EXISTS: the first player swapped one <img>'s src per
// frame and restarted an opacity animation from 0.25 on every
// swap — a visible flicker on every single stage, which reads as
// a technical reconstruction rather than a making. The fix is
// the pipeline, not a loading screen:
//
//   preload → stable stage → transition
//
//   * EVERY frame is decoded before the first one shows.
//     img.decode() is a real promise the browser resolves only
//     once pixels exist (the Magic Card print race's own lesson)
//     — so no frame can ever arrive blank.
//   * The stage is ONE element with a FIXED aspect ratio taken
//     from the first frame, built once and never torn down —
//     no layout jumps, no DOM rebuild between stages, and a
//     replay reuses the same surface.
//   * Frames advance by CROSSFADE between two stacked layers.
//     The old frame stays fully visible underneath until the new
//     one has faded in over it, so there is no instant at which
//     the stage shows less than a whole frame.
//
// MUSIC: a Magic Creation is an experience, so it is scored — by
// the SAME reusable bed both exported films already share
// (assets/audio/foundation/harmony.mp3, Decision 39's
// AMBIENT_BED_FILE). One continuous track for the whole replay:
// started once, never restarted between frames, faded out after
// the finished creation has had its rest, stopped dead the
// moment the experience closes, and restarted cleanly on replay.
// Nothing is generated or stored per creation — the creation
// decides the pictures, the music is the common magical
// presentation.
//
// The child's own global audio setting is respected twice over:
// where AudioManager is present (the Studio) its isMuted() is
// the authority and the Studio's atmosphere is DUCKED under the
// music while it plays (released on stop — the duck is never
// persisted, Decision 26's rule); anywhere else (look.html) the
// same 'vihu-audio-muted' key is read directly. The player also
// carries its own small 🔊 button — a mute for THIS playback,
// because a parent at work and a child in a quiet room both need
// one — which changes nothing global and remembers nothing.
// =============================================================

const CreationPlayback=(function(){
  'use strict';

  const MUSIC_SRC='assets/audio/foundation/harmony.mp3';
  const MUTE_KEY='vihu-audio-muted';
  const FADE_MS=260;          // the crossfade between frames
  const MUSIC_VOLUME=0.45;
  const MUSIC_FADE_OUT_MS=1800;
  const HOLD_MIN=350, HOLD_MAX=3200;

  // The player styles itself, once per document — it serves two
  // different pages (the Studio hub and look.html), and a second
  // hand-kept copy of these rules is a second thing to drift.
  let _styled=false;
  function _ensureStyles(){
    if(_styled) return;
    _styled=true;
    try{
      const st=document.createElement('style');
      st.textContent=
        '.cp-stage{position:relative;width:100%;max-width:100%;margin:0 auto;overflow:hidden;border-radius:10px;}'+
        '.cp-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity '+(FADE_MS/1000)+'s ease;}'+
        '.cp-mute{position:absolute;right:8px;bottom:8px;z-index:3;width:34px !important;height:34px;margin:0 !important;padding:0;'+
          'border:none;border-radius:50%;background:rgba(20,20,30,0.45);color:#fff;font-size:15px;cursor:pointer;}'+
        '@media print{.cp-stage{display:none;}}';
      document.head.appendChild(st);
    }catch(e){}
  }

  function _reducedMotion(){
    try{ return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  function _globallyMuted(){
    try{
      if(typeof AudioManager!=='undefined'&&AudioManager.isMuted) return !!AudioManager.isMuted();
    }catch(e){}
    try{ return localStorage.getItem(MUTE_KEY)==='1'; }catch(e){ return false; }
  }

  function _decode(src){
    return new Promise(function(resolve){
      const img=new Image();
      const done=function(){ resolve(img.naturalWidth?img:null); };
      if(typeof img.decode==='function'){
        img.src=src;
        img.decode().then(done,function(){
          // decode() can reject for a still-renderable image;
          // fall back to load events rather than dropping a frame.
          if(img.complete) done();
          else{ img.onload=done; img.onerror=function(){ resolve(null); }; }
        });
      }else{
        img.onload=done; img.onerror=function(){ resolve(null); };
        img.src=src;
      }
    });
  }

  // container — an element to own; emptied once at mount, then the
  //             stage inside it is stable for the player's life.
  // opts.frames — [{image, holdMs}]; the last frame is the finished
  //             creation and rests on screen.
  // opts.music — false to run silent (default true).
  // opts.onDone — called once when the last frame has landed.
  function mount(container,opts){
    const o=opts||{};
    const frames=(o.frames||[]).filter(function(f){ return f&&f.image; });
    const wantMusic=o.music!==false;
    const reduced=_reducedMotion();

    let destroyed=false;
    let timer=null;
    let audio=null;
    let audioFadeTimer=null;
    let playbackMuted=false;
    let layers=null, stage=null, muteBtn=null;
    let front=0; // index into layers of the layer currently showing

    _ensureStyles();
    while(container.firstChild) container.removeChild(container.firstChild);
    stage=document.createElement('div');
    stage.className='cp-stage';
    container.appendChild(stage);

    // ---------- music ----------
    function _duck(level){
      try{
        if(typeof AudioManager!=='undefined'&&AudioManager.duckFor) AudioManager.duckFor(level,600);
      }catch(e){}
    }
    function _musicStart(){
      if(!wantMusic||_globallyMuted()||playbackMuted) return;
      try{
        if(!audio){
          audio=new Audio(MUSIC_SRC);
          audio.loop=true;
          // Marked so a measurement can tell the player's own bed
          // from AudioManager's foundation layer of the same file
          // (which idles at volume zero) — the atmosphere suite's
          // "a check that hears the wrong sound proves nothing".
          try{ audio.__cpBed=true; }catch(e){}
        }
        if(audioFadeTimer){ clearInterval(audioFadeTimer); audioFadeTimer=null; }
        audio.volume=MUSIC_VOLUME;
        audio.currentTime=0;
        const p=audio.play();
        if(p&&p.catch) p.catch(function(){ /* autoplay refused: the pictures play on */ });
        _duck(0.25);
      }catch(e){}
    }
    function _musicFadeOut(){
      if(!audio||audio.paused) return;
      if(audioFadeTimer) clearInterval(audioFadeTimer);
      const step=Math.max(0.02,MUSIC_VOLUME*50/MUSIC_FADE_OUT_MS);
      audioFadeTimer=setInterval(function(){
        if(!audio){ clearInterval(audioFadeTimer); audioFadeTimer=null; return; }
        const v=audio.volume-step;
        if(v<=0.01){
          try{ audio.pause(); }catch(e){}
          clearInterval(audioFadeTimer); audioFadeTimer=null;
          _duck(1);
        }else audio.volume=v;
      },50);
    }
    function _musicStop(){
      if(audioFadeTimer){ clearInterval(audioFadeTimer); audioFadeTimer=null; }
      if(audio){ try{ audio.pause(); audio.currentTime=0; }catch(e){} }
      _duck(1);
    }

    // ---------- the stage ----------
    function _buildLayers(first){
      // The stage's shape is the first frame's and never changes —
      // a fixed aspect is what makes 28 frames one surface.
      stage.style.aspectRatio=first.naturalWidth+' / '+first.naturalHeight;
      layers=[document.createElement('img'),document.createElement('img')];
      layers.forEach(function(img,i){
        img.className='cp-layer';
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.style.opacity=(i===0)?'1':'0';
        if(reduced) img.style.transition='none';
        stage.appendChild(img);
      });
      if(wantMusic){
        muteBtn=document.createElement('button');
        muteBtn.type='button';
        muteBtn.className='cp-mute';
        muteBtn.setAttribute('aria-label','Music on or off');
        muteBtn.textContent=_globallyMuted()?'🔇':'🔊';
        muteBtn.addEventListener('click',function(){
          playbackMuted=!playbackMuted;
          muteBtn.textContent=(playbackMuted||_globallyMuted())?'🔇':'🔊';
          if(playbackMuted) _musicStop();
          else _musicStart();
        });
        stage.appendChild(muteBtn);
      }
    }

    function _show(img,immediate){
      if(immediate){
        // The opening frame lands whole on the visible layer — the
        // reveal's own first stage is the empty page, so the
        // experience begins on a complete frame, never on a fade
        // out of nothing.
        layers[front].src=img.src;
        return;
      }
      const back=layers[1-front];
      back.src=img.src;             // already decoded — instant pixels
      back.style.zIndex='2';
      layers[front].style.zIndex='1';
      // The old frame stays whole underneath while the new one
      // fades in over it. Frames are opaque, so at every moment
      // the stage shows at least one complete frame.
      void back.offsetWidth;
      back.style.opacity='1';
      const old=layers[front];
      front=1-front;
      setTimeout(function(){
        if(destroyed) return;
        old.style.opacity='0';       // safely hidden behind the new one
      },reduced?0:FADE_MS+40);
    }

    let decoded=null;
    const readyPromise=Promise.all(frames.map(function(f){ return _decode(f.image); }))
      .then(function(imgs){
        decoded=imgs.map(function(img,i){ return img?{img:img,holdMs:frames[i].holdMs}:null; })
                    .filter(Boolean);
        return decoded.length>0;
      });

    function _run(){
      let i=0;
      function step(){
        if(destroyed) return;
        const f=decoded[i];
        _show(f.img,i===0);
        i++;
        if(i<decoded.length){
          timer=setTimeout(step,Math.max(HOLD_MIN,Math.min(HOLD_MAX,f.holdMs||900)));
        }else{
          timer=null;
          // The finished creation rests; the music takes its bow.
          setTimeout(function(){ if(!destroyed) _musicFadeOut(); },1200);
          // ALWAYS a macrotask. A one-frame making reaches here
          // synchronously inside play()'s own resolution, and a
          // caller still inside its .then() would then paint OVER
          // whatever onDone put on screen — a real bug the suite
          // caught as a vanished "Watch again" button.
          if(o.onDone) setTimeout(function(){ if(!destroyed){ try{ o.onDone(); }catch(e){} } },0);
        }
      }
      step();
    }

    function play(){
      return readyPromise.then(function(ok){
        if(destroyed||!ok) return false;
        if(!layers) _buildLayers(decoded[0].img);
        if(timer){ clearTimeout(timer); timer=null; }
        _musicStart();
        _run();
        return true;
      });
    }

    function replay(){
      if(destroyed) return Promise.resolve(false);
      if(timer){ clearTimeout(timer); timer=null; }
      return play();
    }

    function destroy(){
      destroyed=true;
      if(timer){ clearTimeout(timer); timer=null; }
      _musicStop();
      audio=null;
    }

    return { play:play, replay:replay, destroy:destroy,
             ready:function(){ return readyPromise; } };
  }

  const api={ mount:mount, MUSIC_SRC:MUSIC_SRC, FADE_MS:FADE_MS };
  try{ window.CreationPlayback=api; }catch(e){}
  return api;
})();
