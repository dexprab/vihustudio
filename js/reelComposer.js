// =============================================================
// VihuStudio — Reel Composer (Voice MVP Ship 3)
// -------------------------------------------------------------
// A pure composition engine with no UI of its own — the same
// module discipline js/voiceRecorder.js established (module =
// engine, caller = UI). Turns a list of already-rendered page
// bitmaps + optional decoded narration clips into one real video
// file, entirely in the browser, zero server involvement:
//
//   canvas.captureStream(fps)  → the video track. A rAF repaint
//                                loop keeps frames flowing — a
//                                canvas nobody draws to may stop
//                                emitting frames entirely.
//   AudioContext +
//   createMediaStreamDestination() → the audio track. Each page's
//                                narration is an AudioBufferSourceNode
//                                started the moment its page appears.
//   MediaRecorder              → stitches both tracks into webm
//                                (mp4 only as a Safari-shaped
//                                fallback preference).
//
// This is the codebase's FIRST AudioContext (checked — nothing
// else constructs one). Under autoplay policy it may start
// suspended; the publish flow's own clicks give the page sticky
// activation, so resume() during Publishing works. If it somehow
// stays suspended the video still records — with silence — never
// a crash.
//
// Composition happens in REAL TIME (MediaRecorder records a live
// stream), so a reel carrying 30 seconds of narration takes ~30
// seconds to film. The caller owns the messaging for that wait —
// see PublishStudio's finishingMessage handling.
// =============================================================

const ReelComposer=(function(){
  'use strict';

  // Lazy AudioContext singleton — created on first decode/compose,
  // reused for the life of the page (browsers cap live contexts).
  let _ctx=null;
  function _audioCtx(){
    if(_ctx) return _ctx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    try{ _ctx=new AC(); }catch(e){ _ctx=null; }
    return _ctx;
  }

  function isSupported(){
    return typeof window.MediaRecorder!=='undefined'
      && typeof HTMLCanvasElement!=='undefined'
      && typeof HTMLCanvasElement.prototype.captureStream==='function'
      && !!(window.AudioContext||window.webkitAudioContext);
  }

  // Preference order mirrors voiceRecorder.js's own audio list —
  // expect webm in practice on Chromium; mp4 is the fallback shape.
  const MIME_CANDIDATES=[
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  function _pickMime(){
    if(typeof MediaRecorder==='undefined'||typeof MediaRecorder.isTypeSupported!=='function') return '';
    for(let i=0;i<MIME_CANDIDATES.length;i++){
      try{ if(MediaRecorder.isTypeSupported(MIME_CANDIDATES[i])) return MIME_CANDIDATES[i]; }catch(e){}
    }
    return '';
  }

  // Decode narration bytes (webm/opus from the recorder, or whatever
  // a Story Author imported — wav/mp3/m4a) into an AudioBuffer ready
  // to schedule. Resolves null on any failure — a page whose clip
  // can't decode still appears in the reel, just silent. The decoded
  // buffer's own .duration is the clip's REAL length — the honest
  // source, since narration.durationMs can legitimately be 0 for an
  // imported file whose metadata probe failed (voice MVP Ship 1's
  // own disclosed webm/opus-import case).
  function decodeAudio(arrayBuffer){
    const ctx=_audioCtx();
    if(!ctx||!arrayBuffer) return Promise.resolve(null);
    return new Promise(function(resolve){
      try{
        // Callback form — the broadest-compat decodeAudioData signature.
        ctx.decodeAudioData(arrayBuffer, function(buf){ resolve(buf||null); }, function(){ resolve(null); });
      }catch(e){ resolve(null); }
    });
  }

  const START_LEAD_MS=150;   // let the recorder spin up before page 1
  const END_TAIL_MS=350;     // hold the last frame briefly before stop
  const MIN_PAGE_HOLD_MS=300;
  const VIDEO_BPS=6000000;   // 6 Mbps — generous for 1080×1920@30

  // ---------- Page turn ----------
  // A storybook leaf sweeping right-to-left off the spine, uncovering
  // the next page beneath it. Deliberately a 2D illusion assembled
  // from vertical strips rather than a real 3D transform: canvas 2D
  // has no perspective to work with, and the strip-with-a-bulge model
  // reads convincingly as paper at 30fps while staying cheap enough to
  // run inside the capture loop without dropping frames. What sells it
  // is not the geometry alone but the light — the leaf darkens toward
  // the spine as it angles away, catches a bright band along its
  // curved free edge, and casts a soft shadow onto the page it is
  // uncovering.
  const TURN_MS=520;             // one page turn, start to finish
  const TURN_STRIPS=48;          // vertical slices — enough to curve smoothly
  const TURN_BULGE=0.05;         // how far the free edge lifts, mid-turn
  const TURN_SHADOW_FRAC=0.075;  // cast-shadow width as a fraction of the frame

  function _nowMs(){
    try{ if(typeof performance!=='undefined'&&performance.now) return performance.now(); }catch(e){}
    return Date.now();
  }
  function _easeInOutSine(t){ return 0.5-0.5*Math.cos(Math.PI*t); }

  // Paints one frame of the turn. `raw` is linear 0..1 progress; the
  // easing lives here so every caller gets the same motion. Pure — no
  // state, no side effects beyond the context handed in — so it can be
  // driven directly with known bitmaps to check the geometry.
  function paintPageTurn(g, from, to, raw, W, H){
    const t=Math.max(0, Math.min(1, _easeInOutSine(Math.max(0, Math.min(1, raw)))));
    g.fillStyle='#000'; g.fillRect(0,0,W,H);
    if(to){ try{ g.drawImage(to,0,0,W,H); }catch(e){} }
    const foldX=W*(1-t);
    if(!from||foldX<=1) return;

    // The shadow the lifted leaf throws onto the page it is uncovering
    // — strongest right at the fold, fading away to the right.
    try{
      const shW=Math.min(W*TURN_SHADOW_FRAC, 110);
      const sh=g.createLinearGradient(foldX,0,foldX+shW,0);
      sh.addColorStop(0,'rgba(0,0,0,0.34)');
      sh.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=sh;
      g.fillRect(foldX,0,shW,H);
    }catch(e){}

    // The leaf: the outgoing page squeezed toward the spine, drawn in
    // strips so its free edge can bow outward as it lifts. Each strip
    // is drawn a pixel wider than its own slot so no seams show.
    const sw=from.width||W, sh2=from.height||H;
    const curve=Math.sin(Math.PI*t);
    for(let k=0;k<TURN_STRIPS;k++){
      const u0=k/TURN_STRIPS, u1=(k+1)/TURN_STRIPS;
      const dW=(u1-u0)*foldX;
      if(dW<=0) continue;
      const dH=H*(1+TURN_BULGE*curve*Math.pow(u0,1.5));
      try{
        g.drawImage(from,
          u0*sw, 0, (u1-u0)*sw, sh2,
          u0*foldX, (H-dH)/2, dW+1, dH);
      }catch(e){}
    }

    // Light across the leaf: dark at the spine where the paper angles
    // away, a bright band near the curved free edge.
    try{
      const lg=g.createLinearGradient(0,0,foldX,0);
      lg.addColorStop(0,'rgba(0,0,0,'+(0.30*t).toFixed(3)+')');
      lg.addColorStop(0.55,'rgba(0,0,0,'+(0.08*t).toFixed(3)+')');
      lg.addColorStop(0.86,'rgba(255,255,255,'+(0.12*curve).toFixed(3)+')');
      lg.addColorStop(1,'rgba(0,0,0,'+(0.16*t).toFixed(3)+')');
      g.fillStyle=lg;
      g.fillRect(0,0,foldX,H);
    }catch(e){}
  }

  // pages: [{bitmap:<canvas|image>, narrationBuffer:<AudioBuffer|null>, holdMs:<number>}]
  // opts:  {width, height, fps, transition:'page-turn'|'none', transitionMs}
  // → Promise<{blob, mime}> — rejects only on a structural failure
  //   (unsupported browser, recorder refused to start); a silent or
  //   undecodable clip never rejects.
  function compose(pages, opts){
    return new Promise(function(resolve, reject){
      if(!isSupported()){ reject(new Error('reel-unsupported')); return; }
      if(!pages||pages.length===0){ reject(new Error('reel-empty')); return; }
      const width=(opts&&opts.width)||1080;
      const height=(opts&&opts.height)||1920;
      const fps=(opts&&opts.fps)||30;
      const turnMs=(opts&&typeof opts.transitionMs==='number')?opts.transitionMs:TURN_MS;
      const useTurn=!(opts&&opts.transition==='none')&&turnMs>0;

      const canvas=document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const g=canvas.getContext('2d');
      g.fillStyle='#000'; g.fillRect(0,0,width,height);

      const actx=_audioCtx();
      try{ if(actx&&actx.state==='suspended') actx.resume(); }catch(e){}
      let audioDest=null;
      try{ audioDest=actx?actx.createMediaStreamDestination():null; }catch(e){ audioDest=null; }

      // Keep the audio track genuinely alive for the whole recording.
      // createMediaStreamDestination()'s track reports "live" even when
      // nothing is ever connected to it — but it delivers no samples,
      // and the muxer sits waiting for audio that never arrives,
      // finishing with a single empty chunk and a zero-byte file. A
      // reel where no page carries narration is the ordinary case for a
      // child who simply hasn't recorded their voice, so the track is
      // fed real silence from start to stop. (Verified directly: the
      // same reel composes to 0 bytes without this and ~83KB with it.)
      let silence=null;
      if(actx&&audioDest){
        try{
          if(typeof actx.createConstantSource==='function'){
            silence=actx.createConstantSource();
            silence.offset.value=0;
          }else{
            const quiet=actx.createBuffer(1, Math.max(1, Math.round(actx.sampleRate*0.5)), actx.sampleRate);
            silence=actx.createBufferSource();
            silence.buffer=quiet;
            silence.loop=true;
          }
          silence.connect(audioDest);
          silence.start();
        }catch(e){ silence=null; }
      }
      function stopSilence(){
        if(!silence) return;
        try{ silence.stop(); }catch(e){}
        try{ silence.disconnect(); }catch(e){}
        silence=null;
      }

      let stream=null;
      try{
        const v=canvas.captureStream(fps);
        const tracks=v.getVideoTracks().slice();
        if(audioDest) audioDest.stream.getAudioTracks().forEach(function(t){ tracks.push(t); });
        stream=new MediaStream(tracks);
      }catch(e){ reject(e); return; }

      const mime=_pickMime();
      let rec=null;
      try{
        rec=mime?new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:VIDEO_BPS})
                :new MediaRecorder(stream);
      }catch(e){ reject(e); return; }

      const chunks=[];
      let raf=0;
      let currentBitmap=null;
      let done=false;

      rec.ondataavailable=function(e){ if(e.data&&e.data.size>0) chunks.push(e.data); };
      rec.onerror=function(e){
        if(done) return; done=true;
        try{ cancelAnimationFrame(raf); }catch(err){}
        stopSilence();
        reject((e&&e.error)||new Error('reel-recorder-error'));
      };
      rec.onstop=function(){
        // dataavailable is spec-guaranteed to fire before stop, so
        // every chunk has landed by the time this runs.
        if(done) return; done=true;
        try{ cancelAnimationFrame(raf); }catch(err){}
        stopSilence();
        const type=(rec.mimeType||mime||'video/webm').split(';')[0];
        resolve({ blob:new Blob(chunks,{type:type}), mime:type });
      };

      // The repaint loop — keeps the captured track emitting frames
      // even while a page just sits there (which is the whole point
      // of a slideshow). It also owns the turn's own progress, read
      // from the same clock the sequencer's timer uses, so the two can
      // never disagree about what should be on screen.
      let turn=null;   // {from, to, startedAt, durMs}
      function draw(){
        if(done) return;
        if(turn){
          const el=(_nowMs()-turn.startedAt)/turn.durMs;
          if(el<1){
            paintPageTurn(g, turn.from, turn.to, el, width, height);
            raf=requestAnimationFrame(draw);
            return;
          }
          turn=null;
        }
        g.fillStyle='#000'; g.fillRect(0,0,width,height);
        if(currentBitmap){ try{ g.drawImage(currentBitmap,0,0,width,height); }catch(e){} }
        raf=requestAnimationFrame(draw);
      }

      let i=0;
      // A page's own hold time — and its narration — begin only once
      // the turn onto it has finished, so a clip is never spoken over
      // a half-turned page and no page loses screen time to the turn.
      function settlePage(p){
        if(done) return;
        currentBitmap=p.bitmap||null;
        if(p.narrationBuffer&&actx&&audioDest){
          try{
            const src=actx.createBufferSource();
            src.buffer=p.narrationBuffer;
            src.connect(audioDest);
            src.start();
          }catch(e){}
        }
        setTimeout(nextPage, Math.max(MIN_PAGE_HOLD_MS, p.holdMs||3000));
      }
      function nextPage(){
        if(done) return;
        if(i>=pages.length){
          setTimeout(function(){ try{ rec.stop(); }catch(e){} }, END_TAIL_MS);
          return;
        }
        const p=pages[i++]||{};
        const prev=currentBitmap;
        // The first page simply appears; every page after it turns in.
        if(useTurn&&prev&&p.bitmap){
          turn={ from:prev, to:p.bitmap, startedAt:_nowMs(), durMs:turnMs };
          setTimeout(function(){ settlePage(p); }, turnMs);
          return;
        }
        settlePage(p);
      }

      try{ rec.start(250); }catch(e){ reject(e); return; }
      draw();
      setTimeout(nextPage, START_LEAD_MS);
    });
  }

  const api={ isSupported:isSupported, decodeAudio:decodeAudio, compose:compose, paintPageTurn:paintPageTurn };
  try{ window.ReelComposer=api; }catch(e){}
  return api;
})();
