// js/storyPlayer.js — Play My Story.
//
// A full-screen reading of the child's own story: page after page, with
// each page's recorded narration playing over it. Read-only — it never
// mutates the project, never writes a file, and never asks a question.
//
// WHY IT EXISTS. Two gaps met here. A child could make a story and had
// no way to simply *watch* it without going through Publish, which is an
// export flow with formats and downloads in it. And per-page narration
// (js/contextPanel.js writes slide.metadata.narration = {ref,durationMs})
// has been recordable since the Voice MVP with NOWHERE TO PLAY: the only
// consumer is js/reelComposer.js, which bakes it into an exported video.
// A child could record their own voice onto a page and never once hear
// it back inside the Studio. This is that surface.
//
// RENDERING. Every page is drawn by SlideRenderer.buildPayload +
// render — the exact pair the editor canvas and Publish already use, so
// what a child watches here is the same page Publish will reproduce
// (Creator Rule 5). There is no second renderer and no second layout.
//
// THE ONE SHARP EDGE. SlideRenderer.init() retargets a MODULE-LEVEL
// canvas: whoever calls it last owns the renderer. So the player must
// hand the editor's canvas back when it closes, and force a redraw —
// exactly the discipline js/creationFlow.js and js/pageOps.js already
// follow around their own throwaway canvases. Every exit path routes
// through close() for that reason.
const StoryPlayer=(function(){
  'use strict';

  // How long a page with no narration stays up. Long enough to look at a
  // picture, short enough that a three-page story does not become a wait.
  const SILENT_PAGE_MS=4200;
  // A narrated page holds until the clip ends; this is only the ceiling
  // for a clip that never fires 'ended' (a decode failure, a revoked
  // object URL), so the story can never stall on one page.
  const NARRATION_CAP_MS=60000;

  let _els=null;        // {overlay,canvas,prev,next,close,counter}
  let _slides=null;
  let _i=0;
  let _timer=null;
  let _audio=null;
  let _returnTo=0;
  let _open=false;
  let _onClose=null;

  function isOpen(){ return _open; }

  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!=null) e.textContent=text;
    return e;
  }

  function _build(){
    const overlay=_el('div','story-player');
    const stage=_el('div','story-player-stage');
    const canvas=document.createElement('canvas');
    canvas.className='story-player-canvas';
    stage.appendChild(canvas);

    const close=_el('button','story-player-close','✕');
    close.type='button';
    close.setAttribute('aria-label','Close');

    const prev=_el('button','story-player-nav story-player-prev','‹');
    prev.type='button'; prev.setAttribute('aria-label','Page before');
    const next=_el('button','story-player-nav story-player-next','›');
    next.type='button'; next.setAttribute('aria-label','Next page');

    const counter=_el('div','story-player-counter');

    overlay.appendChild(stage);
    overlay.appendChild(prev);
    overlay.appendChild(next);
    overlay.appendChild(close);
    overlay.appendChild(counter);
    document.body.appendChild(overlay);
    return {overlay:overlay,stage:stage,canvas:canvas,prev:prev,next:next,close:close,counter:counter};
  }

  function _clearTimer(){ if(_timer){ clearTimeout(_timer); _timer=null; } }

  function _stopAudio(){
    if(!_audio) return;
    try{ _audio.pause(); }catch(e){}
    try{ _audio.onended=null; _audio.onerror=null; }catch(e){}
    _audio=null;
  }

  // Draws page `i` and starts whatever holds it on screen — its own
  // narration if it has one, a plain timer if it does not.
  function _show(i){
    if(!_els) return;
    _clearTimer(); _stopAudio();
    _i=Math.max(0,Math.min(i,_slides.length-1));
    const slide=_slides[_i];

    try{
      SlideRenderer.init(_els.canvas,{adaptiveViewport:true});
      const title=document.getElementById('bookTitle');
      SlideRenderer.render(SlideRenderer.buildPayload(slide,{
        page:_i+1,
        totalPages:_slides.length,
        defaultBookTitle:title?title.value:''
      }));
    }catch(e){}

    _els.counter.textContent=(_i+1)+' / '+_slides.length;
    _els.prev.disabled=(_i===0);

    const ref=slide&&slide.metadata&&slide.metadata.narration&&slide.metadata.narration.ref;
    if(ref && typeof AssetStore!=='undefined' && AssetStore.resolve){
      const at=_i;   // a child can tap on while this resolves
      AssetStore.resolve(ref).then(function(src){
        if(!_open || at!==_i || !src) { if(at===_i) _holdSilently(); return; }
        try{
          _audio=new Audio(src);
          _audio.onended=function(){ _advance(); };
          _audio.onerror=function(){ _holdSilently(); };
          const p=_audio.play();
          if(p&&p.catch) p.catch(function(){ _holdSilently(); });
          _timer=setTimeout(_advance,NARRATION_CAP_MS);
        }catch(e){ _holdSilently(); }
      }).catch(function(){ if(at===_i) _holdSilently(); });
    }else{
      _holdSilently();
    }
  }

  function _holdSilently(){
    _clearTimer();
    _timer=setTimeout(_advance,SILENT_PAGE_MS);
  }

  function _advance(){
    if(!_open) return;
    if(_i>=_slides.length-1){ close(); return; }
    _show(_i+1);
  }

  function _back(){
    if(!_open||_i<=0) return;
    _show(_i-1);
  }

  function _onKey(ev){
    if(!_open) return;
    if(ev.key==='Escape'){ ev.preventDefault(); close(); }
    else if(ev.key==='ArrowRight'||ev.key===' '){ ev.preventDefault(); _advance(); }
    else if(ev.key==='ArrowLeft'){ ev.preventDefault(); _back(); }
  }

  // opts.slides  — defaults to the whole project
  // opts.onClose — called once, after the editor has been restored
  function open(opts){
    opts=opts||{};
    if(_open) return false;
    let slides=opts.slides;
    try{ if(!slides) slides=(AppState&&AppState.slides)||[]; }catch(e){ slides=[]; }
    if(!slides||!slides.length) return false;

    _slides=slides;
    _onClose=opts.onClose||null;
    try{ _returnTo=(AppState&&AppState.currentSlide)||0; }catch(e){ _returnTo=0; }

    _els=_build();
    _open=true;
    try{ document.body.classList.add('story-player-open'); }catch(e){}

    _els.close.addEventListener('click',function(ev){ ev.stopPropagation(); close(); });
    _els.next.addEventListener('click',function(ev){ ev.stopPropagation(); _advance(); });
    _els.prev.addEventListener('click',function(ev){ ev.stopPropagation(); _back(); });
    // Tapping the page itself moves on. A child should not have to find a
    // control to turn a page in their own story.
    _els.stage.addEventListener('click',function(){ _advance(); });
    document.addEventListener('keydown',_onKey,true);

    requestAnimationFrame(function(){
      if(_els) _els.overlay.classList.add('story-player-in');
    });
    _show(0);
    return true;
  }

  function close(){
    if(!_open) return;
    _open=false;
    _clearTimer(); _stopAudio();
    try{ document.removeEventListener('keydown',_onKey,true); }catch(e){}
    try{ document.body.classList.remove('story-player-open'); }catch(e){}
    try{ if(_els&&_els.overlay.parentNode) _els.overlay.parentNode.removeChild(_els.overlay); }catch(e){}
    _els=null; _slides=null;

    // Hand the renderer back. init() alone re-points it but does not
    // repaint, and a page that resized the canvas for a non-portrait
    // Scene would otherwise be left mid-swap — the same reason
    // js/app.js's own comment gives for forcing a redraw after Publish
    // Studio restores.
    try{
      const editor=document.getElementById('previewCanvas');
      if(editor && typeof SlideRenderer!=='undefined') SlideRenderer.init(editor,{adaptiveViewport:true});
    }catch(e){}
    try{
      if(typeof PageRuntime!=='undefined' && PageRuntime.openPage) PageRuntime.openPage(_returnTo);
      else if(typeof window.redrawPreview==='function') window.redrawPreview();
    }catch(e){}

    const cb=_onClose; _onClose=null;
    if(cb){ try{ cb(); }catch(e){} }
  }

  return { open:open, close:close, isOpen:isOpen };
})();
try{ window.StoryPlayer=StoryPlayer; }catch(e){}
