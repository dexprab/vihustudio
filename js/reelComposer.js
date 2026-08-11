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
//                                started the moment its page appears;
//                                an optional ambient bed loops under
//                                the whole reel at a low level.
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

  // MP4 FIRST, and only when a REAL codec string says so.
  //
  // WebM is the wrong default for the people these videos are made for:
  // it does not play in iOS Photos, in Messages, or in most of the
  // places a parent actually sends a child's story. Chromium has
  // supported H.264 recording since 126 and Safari has always done MP4,
  // so on the browsers this product is used in, MP4 is available — it
  // was simply never asked for, because the old list put webm first and
  // left bare 'video/mp4' as a last resort.
  //
  // The explicit avc1 strings come first BECAUSE bare 'video/mp4' cannot
  // be trusted: measured on the Chromium bundled here (141), every
  // explicit H.264 string reports false while bare 'video/mp4' reports
  // TRUE — a build with no proprietary codecs still claiming the
  // container. Preferring the bare string would hand that build a
  // container it cannot fill. Asking for the codec is the only question
  // whose answer means anything, so the bare string is dropped entirely
  // rather than kept as a fallback.
  const MIME_CANDIDATES=[
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',   // H.264 baseline + AAC
    'video/mp4;codecs=avc1.4d002a,mp4a.40.2',   // H.264 main + AAC
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
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
  // A floor, not a policy — it exists so a frame with no hold at all
  // never flashes past. Lowered from 300ms in M4 because a word frame
  // is deliberately brief; no existing caller ever asked for less than
  // 300 (Story Reel's own floor is 1500), so this is inert for them.
  const MIN_FRAME_MS=60;
  const VIDEO_BPS=6000000;   // 6 Mbps — generous for 1080×1920@30
  // Default level for an ambient bed. Low on purpose: a bed is
  // atmosphere under a child's artwork, never the thing being
  // listened to. A caller can override per compose.
  const AMBIENT_GAIN=0.22;

  // ---------- Animation language (roadmap M4) ----------
  // Background → wash in · Objects → fade + rise · Text → draw
  // word-by-word · Final page → pause. All four are transitions
  // BETWEEN two already-rendered frames, which is what makes them
  // cheap: the reveal hands over bitmaps that differ only in what has
  // just arrived, so a plain crossfade already reads as "only the new
  // thing appeared" — every unchanged pixel blends to itself and does
  // not move. That is the whole trick, and it costs nothing: no
  // masking pass, no diffing, no extra canvases on top of the ones
  // M3 already accounts for.
  const WASH_MS=620;   // a page settling in — slow, pure crossfade
  const RISE_MS=460;   // an object arriving — crossfade plus a lift
  const DRAW_MS=110;   // one word group appearing
  const RISE_PX=14;    // how far below its place an arriving object starts
  // The lift is spent early, on purpose. Drawing the incoming frame
  // offset means the parts that did NOT change are briefly doubled
  // against themselves; keeping the offset alive only while the
  // incoming frame is faint turns that into a soft halo rather than a
  // visible double image, and by the time it is legible it has landed.
  const RISE_SETTLE=0.45;

  // ---------- Arrival ----------
  // The motion the architecture asked for and M4 could not deliver:
  // "fade + ~2% rise + overshoot-and-settle on scale (1.04 → 1.00) …
  // the overshoot is what makes it feel PLACED BY HAND rather than
  // switched on." A whole-frame crossfade cannot scale one object, so
  // paintRise shipped with fade plus an undersized lift and no pop.
  //
  // paintArrival takes the one extra piece of knowledge that unlocks
  // it — WHERE the object landed — and splits the frame in two: an
  // ordinary crossfade everywhere else, real motion inside that
  // rectangle alone. Because unchanged pixels never move, the lift no
  // longer has to be spent early to hide a double image, so it can be
  // both big enough to read and slow enough to feel deliberate.
  const ARRIVAL_MS=560;            // one object, start to settled
  const ARRIVAL_RISE_PX=38;        // ~2% of a 1920-tall frame — the spec's own figure
  const ARRIVAL_START_SCALE=0.94;  // a touch small, so it grows into place
  const ARRIVAL_OVERSHOOT=1.04;    // the pop past its own size
  const ARRIVAL_PEAK_AT=0.62;      // where that pop lands, in progress
  const ARRIVAL_CLIP_PAD=0.08;     // clip margin, so the peak cannot crop the object

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
  function _easeOutCubic(t){ return 1-Math.pow(1-t,3); }
  function _clamp01(t){ return Math.max(0, Math.min(1, t)); }

  // Grow, overshoot, settle. Takes RAW progress — the easing is inside,
  // so a caller cannot accidentally double-ease it and flatten the pop.
  function _arrivalScale(p){
    if(p>=1) return 1;
    if(p<=0) return ARRIVAL_START_SCALE;
    if(p<ARRIVAL_PEAK_AT){
      const u=_easeOutCubic(p/ARRIVAL_PEAK_AT);
      return ARRIVAL_START_SCALE+(ARRIVAL_OVERSHOOT-ARRIVAL_START_SCALE)*u;
    }
    const u=_easeOutCubic((p-ARRIVAL_PEAK_AT)/(1-ARRIVAL_PEAK_AT));
    return ARRIVAL_OVERSHOOT+(1-ARRIVAL_OVERSHOOT)*u;
  }

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

  // Wash — a straight crossfade. `from` may be null, in which case the
  // frame rises out of black, which is how the very first page of a
  // story arrives. Because consecutive reveal frames are identical
  // except for what has just arrived, this reads as the new thing
  // fading up while everything already on the page holds perfectly
  // still. Pure, like paintPageTurn, so it can be driven directly.
  function paintWash(g, from, to, raw, W, H){
    const t=_easeInOutSine(_clamp01(raw));
    g.globalAlpha=1;
    g.fillStyle='#000'; g.fillRect(0,0,W,H);
    if(from){ try{ g.drawImage(from,0,0,W,H); }catch(e){} }
    if(to){
      try{ g.globalAlpha=t; g.drawImage(to,0,0,W,H); }catch(e){}
    }
    g.globalAlpha=1;
  }

  // Rise — the same crossfade, with the incoming frame starting a
  // little low and lifting into place. An object arriving should feel
  // set down rather than switched on.
  function paintRise(g, from, to, raw, W, H, risePx){
    const t=_easeOutCubic(_clamp01(raw));
    g.globalAlpha=1;
    g.fillStyle='#000'; g.fillRect(0,0,W,H);
    if(from){ try{ g.drawImage(from,0,0,W,H); }catch(e){} }
    if(!to){ g.globalAlpha=1; return; }
    const settle=Math.min(1, t/RISE_SETTLE);
    const dy=(typeof risePx==='number'?risePx:RISE_PX)*(1-settle);
    try{ g.globalAlpha=t; g.drawImage(to,0,dy,W,H); }catch(e){}
    g.globalAlpha=1;
  }

  // Arrival — ONE object being set down, rather than a whole page
  // fading. `rect` is where that object landed, in this frame's own
  // pixels. Outside it the incoming frame crossfades exactly as a wash
  // would; inside it, the frame is lifted and scaled about the rect's
  // own centre, so the object grows into place and settles out of a
  // slight overshoot while every other pixel on the page holds
  // perfectly still.
  //
  // The clip is padded past the rect, because a 1.04 peak would
  // otherwise crop the object at its own edge. That padding ring shows
  // background pixels scaled by up to 4% — a real, bounded cost of not
  // having the object on a layer of its own, and small enough at 8%
  // padding to read as a soft breath around the thing arriving.
  //
  // Falls back to paintRise when there is no usable rect, which is the
  // honest reading of "something arrived, but not where".
  function paintArrival(g, from, to, raw, W, H, risePx, rect){
    if(!rect||!(rect.w>0)||!(rect.h>0)||!from||!to){
      paintRise(g, from, to, raw, W, H, risePx);
      return;
    }
    const p=_clamp01(raw);
    const t=_easeOutCubic(p);
    g.globalAlpha=1;
    g.fillStyle='#000'; g.fillRect(0,0,W,H);
    try{ g.drawImage(from,0,0,W,H); }catch(e){}

    const padX=rect.w*ARRIVAL_CLIP_PAD, padY=rect.h*ARRIVAL_CLIP_PAD;
    const rx=rect.x-padX, ry=rect.y-padY;
    const rw=rect.w+padX*2, rh=rect.h+padY*2;

    // Everywhere else: an ordinary crossfade. Nothing here is expected
    // to change, but a stage boundary can quietly resolve something
    // else (an authoring placeholder switching off, say), and blending
    // is the honest way to carry that rather than freezing it.
    try{
      g.save();
      g.beginPath();
      g.rect(0,0,W,H);
      g.rect(rx,ry,rw,rh);
      g.clip('evenodd');
      g.globalAlpha=t;
      g.drawImage(to,0,0,W,H);
      g.restore();
    }catch(e){ try{ g.restore(); }catch(e2){} }

    // The object itself.
    try{
      g.save();
      g.beginPath();
      g.rect(rx,ry,rw,rh);
      g.clip();
      const s=_arrivalScale(p);
      const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
      const lift=(typeof risePx==='number')?risePx:ARRIVAL_RISE_PX;
      g.translate(cx,cy);
      g.scale(s,s);
      g.translate(-cx,-cy);
      g.globalAlpha=t;
      g.drawImage(to,0,lift*(1-t),W,H);
      g.restore();
    }catch(e){ try{ g.restore(); }catch(e2){} }

    g.globalAlpha=1;
  }

  // Which painter a named transition uses, and how long it runs by
  // default. 'draw' is a wash on a short fuse: a word group should
  // appear, not fade in.
  const TRANSITIONS={
    'page-turn':{paint:paintPageTurn, ms:TURN_MS},
    'wash':{paint:paintWash, ms:WASH_MS},
    'rise':{paint:paintRise, ms:RISE_MS},
    'arrival':{paint:paintArrival, ms:ARRIVAL_MS},
    'draw':{paint:paintWash, ms:DRAW_MS}
  };

  // pages: [{bitmap:<canvas|image>, narrationBuffer:<AudioBuffer|null>, holdMs:<number>,
  //          transition?:'page-turn'|'wash'|'rise'|'arrival'|'draw'|'none', transitionMs?:<number>,
  //          arrivalRect?:{x,y,w,h}}]
  //        `arrivalRect` is read only by the 'arrival' transition, and
  //        is in this frame's own pixels: where the object that just
  //        arrived actually landed. Without it, 'arrival' degrades to
  //        a whole-frame rise.
  // opts:  {width, height, fps, transition, transitionMs, risePx,
  //         ambientBuffer, ambientGain}
  //        `transition`/`transitionMs` are the DEFAULT for every page;
  //        a page's own fields win. That is what lets one reel turn
  //        between pages and wash, rise or draw within them.
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
      const defaultKind=(opts&&opts.transition)||'page-turn';
      const defaultMs=(opts&&typeof opts.transitionMs==='number')?opts.transitionMs:null;
      // Deliberately null rather than RISE_PX: each painter then falls
      // back to its OWN lift. paintRise keeps its conservative 14px
      // (its offset moves the whole frame, so it still has to be small
      // and spent early); paintArrival gets the spec's ~2%, which it
      // can afford because unchanged pixels never move under it.
      const risePx=(opts&&typeof opts.risePx==='number')?opts.risePx:null;

      // What plays on the way INTO this page, and for how long. A
      // page's own request wins over the reel-wide default; an
      // unknown name, or one with no time to run in, is a hard cut.
      function _transitionFor(p){
        const kind=(p&&p.transition)||defaultKind;
        const def=TRANSITIONS[kind];
        if(!def) return null;
        let ms=(p&&typeof p.transitionMs==='number')?p.transitionMs
              :(defaultMs!==null?defaultMs:def.ms);
        if(!(ms>0)) return null;
        return {paint:def.paint, durMs:ms, kind:kind};
      }

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

      // An optional ambient bed, looped under the whole reel at a low
      // level. This is a WHOLE-REEL layer, not a per-page one: the
      // caller decides whether a bed belongs at all (a story carrying
      // the child's own narration deliberately gets none, so a quiet
      // voice is never competed with), and once it does, it simply
      // runs from first frame to last. Absent `ambientBuffer` nothing
      // here allocates, so every existing caller is untouched.
      let ambient=null, ambientGain=null;
      if(actx&&audioDest&&opts&&opts.ambientBuffer){
        try{
          ambient=actx.createBufferSource();
          ambient.buffer=opts.ambientBuffer;
          ambient.loop=true;
          ambientGain=actx.createGain();
          ambientGain.gain.value=(typeof opts.ambientGain==='number')?opts.ambientGain:AMBIENT_GAIN;
          ambient.connect(ambientGain);
          ambientGain.connect(audioDest);
          ambient.start();
        }catch(e){ ambient=null; ambientGain=null; }
      }

      function stopAudio(){
        if(silence){
          try{ silence.stop(); }catch(e){}
          try{ silence.disconnect(); }catch(e){}
          silence=null;
        }
        if(ambient){
          try{ ambient.stop(); }catch(e){}
          try{ ambient.disconnect(); }catch(e){}
          ambient=null;
        }
        if(ambientGain){
          try{ ambientGain.disconnect(); }catch(e){}
          ambientGain=null;
        }
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
        stopAudio();
        reject((e&&e.error)||new Error('reel-recorder-error'));
      };
      rec.onstop=function(){
        // dataavailable is spec-guaranteed to fire before stop, so
        // every chunk has landed by the time this runs.
        if(done) return; done=true;
        try{ cancelAnimationFrame(raf); }catch(err){}
        stopAudio();
        const type=(rec.mimeType||mime||'video/webm').split(';')[0];
        resolve({ blob:new Blob(chunks,{type:type}), mime:type });
      };

      // The repaint loop — keeps the captured track emitting frames
      // even while a page just sits there (which is the whole point
      // of a slideshow). It also owns the turn's own progress, read
      // from the same clock the sequencer's timer uses, so the two can
      // never disagree about what should be on screen.
      let trans=null;   // {paint, from, to, startedAt, durMs, rect}
      function draw(){
        if(done) return;
        if(trans){
          const el=(_nowMs()-trans.startedAt)/trans.durMs;
          if(el<1){
            trans.paint(g, trans.from, trans.to, el, width, height, risePx, trans.rect);
            raf=requestAnimationFrame(draw);
            return;
          }
          trans=null;
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
        setTimeout(nextPage, Math.max(MIN_FRAME_MS, p.holdMs||3000));
      }
      function nextPage(){
        if(done) return;
        if(i>=pages.length){
          setTimeout(function(){ try{ rec.stop(); }catch(e){} }, END_TAIL_MS);
          return;
        }
        const p=pages[i++]||{};
        const prev=currentBitmap;
        const tr=p.bitmap?_transitionFor(p):null;
        // A wash can start from nothing — that is how page one rises
        // out of black. Everything else needs a frame to come from.
        if(tr&&(prev||tr.paint===paintWash)){
          trans={ paint:tr.paint, from:prev, to:p.bitmap, startedAt:_nowMs(), durMs:tr.durMs, rect:p.arrivalRect||null };
          setTimeout(function(){ settlePage(p); }, tr.durMs);
          return;
        }
        settlePage(p);
      }

      try{ rec.start(250); }catch(e){ reject(e); return; }
      draw();
      setTimeout(nextPage, START_LEAD_MS);
    });
  }

  const api={
    isSupported:isSupported, decodeAudio:decodeAudio, compose:compose,
    paintPageTurn:paintPageTurn, paintWash:paintWash, paintRise:paintRise,
    paintArrival:paintArrival,
    // Timings, exposed so the reveal can reason about total runtime
    // and so verification can drive a painter without guessing.
    TURN_MS:TURN_MS, WASH_MS:WASH_MS, RISE_MS:RISE_MS, DRAW_MS:DRAW_MS, RISE_PX:RISE_PX,
    ARRIVAL_MS:ARRIVAL_MS, ARRIVAL_RISE_PX:ARRIVAL_RISE_PX,
    ARRIVAL_START_SCALE:ARRIVAL_START_SCALE, ARRIVAL_OVERSHOOT:ARRIVAL_OVERSHOOT,
    ARRIVAL_PEAK_AT:ARRIVAL_PEAK_AT, ARRIVAL_CLIP_PAD:ARRIVAL_CLIP_PAD,
    AMBIENT_GAIN:AMBIENT_GAIN
  };
  try{ window.ReelComposer=api; }catch(e){}
  return api;
})();
