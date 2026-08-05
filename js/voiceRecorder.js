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
  let _stream=null;
  let _chunks=[];
  let _startedAt=0;
  let _tickTimer=null;
  let _maxTimer=null;
  let _stopPending=null; // {resolve,reject} while a stop() awaits onstop

  function _releaseStream(){
    if(_stream){
      try{ _stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
    }
    _stream=null;
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
      return navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        _stream=stream;
        _chunks=[];
        const mime=_preferredMime();
        try{
          _recorder=mime ? new MediaRecorder(stream,{mimeType:mime}) : new MediaRecorder(stream);
        }catch(e){
          _recorder=new MediaRecorder(stream);
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
        _startedAt=Date.now();
        _recorder.start();
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
