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

  // pages: [{bitmap:<canvas|image>, narrationBuffer:<AudioBuffer|null>, holdMs:<number>}]
  // opts:  {width, height, fps}
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

      const canvas=document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const g=canvas.getContext('2d');
      g.fillStyle='#000'; g.fillRect(0,0,width,height);

      const actx=_audioCtx();
      try{ if(actx&&actx.state==='suspended') actx.resume(); }catch(e){}
      let audioDest=null;
      try{ audioDest=actx?actx.createMediaStreamDestination():null; }catch(e){ audioDest=null; }

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
        reject((e&&e.error)||new Error('reel-recorder-error'));
      };
      rec.onstop=function(){
        // dataavailable is spec-guaranteed to fire before stop, so
        // every chunk has landed by the time this runs.
        if(done) return; done=true;
        try{ cancelAnimationFrame(raf); }catch(err){}
        const type=(rec.mimeType||mime||'video/webm').split(';')[0];
        resolve({ blob:new Blob(chunks,{type:type}), mime:type });
      };

      // The repaint loop — keeps the captured track emitting frames
      // even while a page just sits there (which is the whole point
      // of a slideshow).
      function draw(){
        if(done) return;
        g.fillStyle='#000'; g.fillRect(0,0,width,height);
        if(currentBitmap){ try{ g.drawImage(currentBitmap,0,0,width,height); }catch(e){} }
        raf=requestAnimationFrame(draw);
      }

      let i=0;
      function nextPage(){
        if(done) return;
        if(i>=pages.length){
          setTimeout(function(){ try{ rec.stop(); }catch(e){} }, END_TAIL_MS);
          return;
        }
        const p=pages[i++]||{};
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

      try{ rec.start(250); }catch(e){ reject(e); return; }
      draw();
      setTimeout(nextPage, START_LEAD_MS);
    });
  }

  const api={ isSupported:isSupported, decodeAudio:decodeAudio, compose:compose };
  try{ window.ReelComposer=api; }catch(e){}
  return api;
})();
