/* ============================================================
 * Voice Recorder — the mic engine behind Studio's per-page
 * narration (Locked Product Decision #4 — Audio Studio: "per-card
 * narration, record/import audio, audio linked to cards").
 *
 * Engine only, deliberately: no DOM/UI of its own — the Voice panel
 * in js/contextPanel.js owns every visual — mirroring the
 * AudioManager/gatewayAudio "module = engine, caller = UI"
 * convention this codebase already established for audio.
 *
 * One recording at a time (a page has one narration; there is no
 * multi-track concept anywhere), so the module holds one recorder's
 * worth of state rather than instances. start() → the caller's own
 * onTick drives its timer UI; stop() resolves the finished clip as
 * {blob, durationMs, mimeType}; cancel() discards. The duration is
 * measured by OUR OWN clock, never the blob's metadata — Chrome's
 * MediaRecorder webm output famously reports Infinity duration, so
 * the wall clock is the honest source.
 * ============================================================ */
(function(){
  'use strict';

  let _recorder=null;
  let _stream=null;          // the raw microphone
  let _outStream=null;       // what is actually recorded (see _shape)
  let _ctx=null;             // the shaping graph's AudioContext
  let _analyser=null;
  let _levelTimer=null;
  let _chunks=[];
  let _startedAt=0;
  let _tickTimer=null;
  let _maxTimer=null;
  let _stopPending=null; // {resolve,reject} while a stop() awaits onstop

  // WHICH ATTEMPT IS STILL THE CURRENT ONE.
  //
  // Measured, and a real leak: cancel() called while getUserMedia was
  // still pending did nothing at all, because there was no recorder yet
  // to cancel. The request then resolved into a recorder that started
  // recording with nobody watching — microphone light on, and the next
  // start() rejecting as 'busy' — from a panel the child had already
  // closed. Every step after an await now checks that it is still the
  // attempt that was asked for.
  let _gen=0;

  // How long to let the microphone settle before the caller is allowed
  // to tell a child to speak. Real hardware takes a moment to open even
  // when permission was granted long ago, and MediaRecorder's first
  // moments can be silence — so the wait ends on EVIDENCE (the analyser
  // seeing the signal move) and falls back to the clock.
  const WARMUP_MAX_MS=700;
  const WARMUP_MIN_MS=120;
  // A DELIBERATE margin, held after the microphone is seen to be live.
  //
  // Measured across takes: resolving the moment signal appeared left
  // between 11ms of margin and 13ms of loss — which is to say none, and
  // whether a child's first syllable survived came down to luck. This
  // is a sixth of a second of guaranteed recorded lead-in, and nobody
  // will ever notice it except as their own first word being there.
  const WARMUP_HOLD_MS=150;
  // A chunk every quarter second rather than one blob at the end. It
  // costs nothing and means a recording interrupted by anything at all
  // still has everything up to that moment.
  const TIMESLICE_MS=250;

  function _releaseStream(){
    if(_levelTimer){ clearInterval(_levelTimer); _levelTimer=null; }
    if(_stream){
      try{ _stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
    }
    if(_outStream){
      try{ _outStream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
    }
    if(_ctx){
      try{ _ctx.close(); }catch(e){}
    }
    _stream=null; _outStream=null; _ctx=null; _analyser=null;
  }

  // ---------------------------------------------------------------
  // WHAT THE MICROPHONE IS ASKED FOR.
  //
  // `{audio:true}` takes the browser's defaults, and those defaults are
  // tuned for a video call rather than for a child telling a story:
  //
  //   · autoGainControl rides the level up in every gap between words,
  //     so the room's own hiss swells and ducks around the voice. That
  //     pumping is most of what "too scratchy" is.
  //   · echoCancellation exists to subtract a far-end talker from the
  //     signal. There is no far end here, and it costs a real voice
  //     some body and adds warble as it adapts.
  //   · noiseSuppression is the one that genuinely helps a laptop mic,
  //     so it is the one kept.
  //
  // Asked for, never demanded: `ideal` throughout, and a plain
  // `{audio:true}` retry if a device refuses the lot, because a
  // recording that is merely ordinary beats no recording at all.
  // ---------------------------------------------------------------
  function _constraints(){
    return {audio:{
      channelCount:{ideal:1},
      sampleRate:{ideal:48000},
      echoCancellation:{ideal:false},
      noiseSuppression:{ideal:true},
      autoGainControl:{ideal:false}
    }};
  }

  function _open(){
    return navigator.mediaDevices.getUserMedia(_constraints()).catch(function(err){
      const name=err && err.name;
      // Only a constraint problem is worth a second, humbler ask. A
      // refusal is a refusal and must not be re-prompted.
      if(name==='OverconstrainedError' || name==='ConstraintNotSatisfiedError' || name==='TypeError'){
        return navigator.mediaDevices.getUserMedia({audio:true});
      }
      throw err;
    });
  }

  // ---------------------------------------------------------------
  // SHAPING, IN PLACE OF AUTOMATIC GAIN.
  //
  // With autoGainControl off the signal is clean but can be quiet, so
  // the level is handled here instead, where it can be done gently and
  // predictably rather than by an algorithm designed for phone calls:
  //
  //   highpass 80Hz — desk thumps, chair creaks, the low rumble a
  //                   laptop's own fan puts into its own microphone
  //   compressor    — a soft knee well above the noise floor, so a
  //                   quiet child is lifted and a loud one is caught,
  //                   without the noise between words moving at all
  //   makeup gain   — a fixed, modest lift; fixed is the point
  //
  // The analyser on the end is not decoration: it is how start() knows
  // the microphone is genuinely running (below), and how the panel can
  // show a child that they are being heard.
  //
  // If any of this is unavailable the raw stream is recorded exactly as
  // before — the graph is an improvement, never a dependency.
  // ---------------------------------------------------------------
  function _shape(stream){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC || typeof MediaStreamAudioDestinationNode==='undefined'){
      return {stream:stream,analyser:null,ctx:null};
    }
    try{
      const ctx=new AC();
      const src=ctx.createMediaStreamSource(stream);

      const hp=ctx.createBiquadFilter();
      hp.type='highpass';
      hp.frequency.value=80;

      const comp=ctx.createDynamicsCompressor();
      comp.threshold.value=-28;
      comp.knee.value=24;
      comp.ratio.value=3;
      comp.attack.value=0.006;
      comp.release.value=0.22;

      const gain=ctx.createGain();
      gain.gain.value=1.25;

      // A CEILING THAT CANNOT BE CROSSED.
      //
      // Measured, and it was my own fault: a fixed makeup gain of 1.6
      // took a full-scale source to a peak of 1.012 — hard clipping,
      // which is the harshest, most genuinely scratchy thing a
      // recording can contain. A gentler gain alone would only make it
      // less likely rather than impossible, so the last thing in the
      // chain is a soft curve: linear where a voice actually lives,
      // bending smoothly as it approaches the ceiling and never
      // reaching it.
      const limiter=ctx.createWaveShaper();
      const N=1024, curve=new Float32Array(N);
      for(let i=0;i<N;i++){
        const x=(i/(N-1))*2-1;
        curve[i]=Math.tanh(x*1.2)/Math.tanh(1.2)*0.97;
      }
      limiter.curve=curve;
      limiter.oversample='2x';

      const analyser=ctx.createAnalyser();
      analyser.fftSize=1024;
      analyser.smoothingTimeConstant=0.5;

      const dest=ctx.createMediaStreamDestination();
      // ONE channel. A microphone is one microphone, and a stereo file
      // of it is two copies of the same voice at twice the size.
      try{ dest.channelCount=1; }catch(e){}
      src.connect(hp); hp.connect(comp); comp.connect(gain); gain.connect(limiter);
      limiter.connect(analyser); limiter.connect(dest);
      return {stream:dest.stream,analyser:analyser,ctx:ctx};
    }catch(e){
      return {stream:stream,analyser:null,ctx:null};
    }
  }

  function _level(){
    if(!_analyser) return 0;
    const buf=new Uint8Array(_analyser.fftSize);
    try{ _analyser.getByteTimeDomainData(buf); }catch(e){ return 0; }
    let peak=0;
    for(let i=0;i<buf.length;i++){
      const v=Math.abs(buf[i]-128)/128;
      if(v>peak) peak=v;
    }
    return peak;
  }

  // THE MICROPHONE IS RUNNING WHEN IT IS RUNNING, not when it was
  // asked for. Resolves as soon as the signal moves at all — which on
  // real hardware is the moment it is genuinely live — and otherwise
  // after a bounded wait, so a silent room still gets to record.
  function _warmUp(){
    return new Promise(function(resolve){
      const began=Date.now();
      const done=function(){ setTimeout(resolve,WARMUP_HOLD_MS); };
      if(!_analyser){ setTimeout(done,WARMUP_MIN_MS); return; }
      (function look(){
        const waited=Date.now()-began;
        if(waited>=WARMUP_MAX_MS){ done(); return; }
        if(waited>=WARMUP_MIN_MS && _level()>0.004){ done(); return; }
        setTimeout(look,20);
      })();
    });
  }
  function _clearTimers(){
    if(_tickTimer){ clearInterval(_tickTimer); _tickTimer=null; }
    if(_maxTimer){ clearTimeout(_maxTimer); _maxTimer=null; }
  }

  function _preferredMime(){
    if(typeof MediaRecorder==='undefined' || typeof MediaRecorder.isTypeSupported!=='function') return '';
    const prefs=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    for(let i=0;i<prefs.length;i++){
      try{ if(MediaRecorder.isTypeSupported(prefs[i])) return prefs[i]; }catch(e){}
    }
    return '';
  }

  const api={
    // Mutable on purpose: the Voice panel reads it fresh per recording,
    // and tests shorten it to exercise the auto-stop without a real
    // 60-second wait.
    DEFAULT_MAX_MS: 60000,

    isSupported: function(){
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
        typeof window.MediaRecorder!=='undefined');
    },

    isRecording: function(){
      return !!(_recorder && _recorder.state==='recording');
    },

    // opts: { maxMs, onTick(elapsedMs,maxMs), onAutoStop() }
    // Resolves once recording has genuinely started; rejects with
    // {reason:'unsupported'|'denied'|'error'} so the panel can show an
    // honest, kid-friendly message per cause.
    start: function(opts){
      opts=opts||{};
      const maxMs=typeof opts.maxMs==='number' ? opts.maxMs : api.DEFAULT_MAX_MS;
      if(!api.isSupported()) return Promise.reject({reason:'unsupported'});
      if(api.isRecording()) return Promise.reject({reason:'busy'});
      const mine=++_gen;
      return _open().then(function(stream){
        // Abandoned while the microphone was being asked for. Hand the
        // device straight back rather than recording into a void.
        if(mine!==_gen){
          try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
          return Promise.reject({reason:'cancelled'});
        }
        _stream=stream;
        _chunks=[];
        const shaped=_shape(stream);
        _outStream=shaped.stream;
        _analyser=shaped.analyser;
        _ctx=shaped.ctx;
        const mime=_preferredMime();
        // A real bitrate, stated. Chrome's unstated default for a mono
        // Opus track is thin enough to hear on sibilants, and 128k of
        // speech is a rounding error against the pictures a Story
        // already carries.
        const cfg=mime ? {mimeType:mime,audioBitsPerSecond:128000}
                       : {audioBitsPerSecond:128000};
        try{
          _recorder=new MediaRecorder(_outStream,cfg);
        }catch(e){
          try{ _recorder=new MediaRecorder(_outStream); }
          catch(e2){ _recorder=new MediaRecorder(stream); }
        }
        _recorder.ondataavailable=function(ev){
          if(ev.data && ev.data.size>0) _chunks.push(ev.data);
        };
        _recorder.onstop=function(){
          _clearTimers();
          const durationMs=Math.max(0,Date.now()-_startedAt);
          const mimeType=(_recorder && _recorder.mimeType) || 'audio/webm';
          const blob=new Blob(_chunks,{type:mimeType});
          _chunks=[];
          _recorder=null;
          _releaseStream();
          if(_stopPending){
            const p=_stopPending; _stopPending=null;
            p.resolve({blob:blob, durationMs:durationMs, mimeType:mimeType});
          }
        };
        // RECORDING BEGINS BEFORE THE CHILD IS INVITED TO SPEAK.
        //
        // This is the fix for "it misses the starting", and the missing
        // time was never one thing. The panel painted "I'm listening…"
        // and only THEN asked for the microphone, so the permission
        // check and the device opening — hundreds of milliseconds even
        // when permission was granted long ago — happened while a child
        // was already talking. On top of that, a recorder's own first
        // moments can be silence while the encoder starts.
        //
        // So the order is now: open, start recording, wait until the
        // microphone is genuinely running, and only then resolve — and
        // the panel says nothing until this resolves. Whatever warm-up
        // is spent lands in the file as a little silence at the front,
        // which is exactly where harmless belongs.
        // Set here as well as after the warm-up, so it is never zero:
        // a stop() or an auto-stop arriving DURING the warm-up would
        // otherwise measure the clip against the epoch and report a
        // duration of fifty-odd years.
        _startedAt=Date.now();
        _recorder.start(TIMESLICE_MS);
        if(typeof opts.onLevel==='function' && _analyser){
          _levelTimer=setInterval(function(){ opts.onLevel(_level()); },100);
        }
        return _warmUp().then(function(){
          // Cancelled or stopped while the microphone was still
          // opening — closing the panel is enough to do it — so there
          // is nothing left to arm.
          if(mine!==_gen || !api.isRecording()) return;
          // The clock starts when the microphone is really listening,
          // so the timer a child watches counts THEIR time and not the
          // hardware's.
          _startedAt=Date.now();
          if(typeof opts.onTick==='function'){
            _tickTimer=setInterval(function(){
              opts.onTick(Date.now()-_startedAt, maxMs);
            },200);
          }
          if(maxMs>0){
            _maxTimer=setTimeout(function(){
              if(api.isRecording() && typeof opts.onAutoStop==='function') opts.onAutoStop();
            },maxMs);
          }
        });
      }).catch(function(err){
        _releaseStream();
        if(err && err.reason) return Promise.reject(err);
        const name=err && err.name;
        if(name==='NotAllowedError' || name==='PermissionDeniedError' || name==='SecurityError'){
          return Promise.reject({reason:'denied'});
        }
        return Promise.reject({reason:'error'});
      });
    },

    // Resolves {blob, durationMs, mimeType} once the recorder flushes.
    stop: function(){
      if(!api.isRecording()){
        _clearTimers(); _releaseStream();
        return Promise.reject({reason:'not-recording'});
      }
      return new Promise(function(resolve,reject){
        _stopPending={resolve:resolve,reject:reject};
        try{ _recorder.stop(); }
        catch(e){ _stopPending=null; _clearTimers(); _releaseStream(); reject({reason:'error'}); }
      });
    },

    // Discard everything — no clip is produced.
    cancel: function(){
      // Invalidates any in-flight start() as well as any live recorder
      // — see _gen above.
      _gen++;
      _clearTimers();
      _stopPending=null;
      if(_recorder){
        // Swallow the flush entirely: onstop still fires, but with no
        // pending stop() there is nothing to resolve into.
        try{ _recorder.onstop=null; _recorder.ondataavailable=null; _recorder.stop(); }catch(e){}
        _recorder=null;
      }
      _chunks=[];
      _releaseStream();
    }
  };

  window.VoiceRecorder=api;
})();
