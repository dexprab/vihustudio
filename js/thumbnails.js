const ThumbnailEngine=(function(){
  let previewCanvas=null;
  let queue=Promise.resolve();
  let generatingCount=0;
  let totalToGenerate=0;
  let onProgressUpdate=null;

  function init(preview){ previewCanvas=preview; }

  function setProgressCallback(cb){ onProgressUpdate=cb; }

  function _notifyProgress(){
    if(onProgressUpdate) try{ onProgressUpdate({generating:generatingCount,total:totalToGenerate}); }catch(e){}
  }

  function generate(slide){
    if(!previewCanvas) return Promise.resolve(null);
    if(slide.thumbnail) return Promise.resolve(slide.thumbnail);

    generatingCount++;
    totalToGenerate++;
    _notifyProgress();

    queue = queue.then(()=> new Promise((resolve)=>{
      try{
        // Sprint 9.0.2 — WYSIWYE. Render at dpr:1 so the temp bitmap
        // stays predictably sized for the thumb downscale.
        // Scene Viewport sprint — a manual presize here (reading
        // getCanvasSize(slide) up front) would be immediately clobbered
        // by init()'s own unconditional reset to the canonical default,
        // exactly the same as it always was pre-adaptiveViewport (init()
        // has always forced its own size regardless of what a caller
        // presized beforehand — confirmed by reading the original code).
        // Opting this temp canvas into adaptiveViewport instead lets
        // render()'s own resolution step size it correctly to this
        // slide's real Scene Viewport, the same mechanism the live
        // editor canvas already uses.
        const temp=document.createElement('canvas');
        SlideRenderer.init(temp,{dpr:1,adaptiveViewport:true});

        // Sprint 6.4 — WYSIWYE. Resolve via the shared helper so the
        // thumbnail is a faithful miniature of the preview / export.
        const titleEl=document.getElementById('bookTitle');
        const payload=SlideRenderer.buildPayload(slide,{
          defaultBookTitle: titleEl ? titleEl.value : ''
        });

        try{
          SlideRenderer.render(payload);
        }catch(e){ /* ensure we continue */ }

        const thumbW=110; const thumbH=Math.round((thumbW * temp.height)/temp.width);
        const thumbCanvas=document.createElement('canvas'); thumbCanvas.width=thumbW; thumbCanvas.height=thumbH;
        const tctx=thumbCanvas.getContext('2d');
        // Sprint 6.3 — match SlideRenderer.init quality so the temp→thumb
        // downscale also uses high-quality interpolation.
        try{ tctx.imageSmoothingEnabled=true; tctx.imageSmoothingQuality='high'; }catch(e){}
        tctx.fillStyle='#fff'; tctx.fillRect(0,0,thumbW,thumbH);
        tctx.drawImage(temp,0,0,thumbW,thumbH);
        const dataUrl=thumbCanvas.toDataURL('image/png');
        slide.thumbnail=dataUrl;

        SlideRenderer.init(previewCanvas);
        const currentIdx=AppState.currentSlide||0;
        const current=AppState.slides[currentIdx];
        if(current){
          try{
            const _titleEl=document.getElementById('bookTitle');
            SlideRenderer.render(SlideRenderer.buildPayload(current,{
              defaultBookTitle: _titleEl ? _titleEl.value : ''
            }));
          }catch(e){}
        }

        generatingCount--;
        _notifyProgress();
        resolve(dataUrl);
      }catch(err){
        generatingCount--;
        _notifyProgress();
        resolve(null);
      }
    }));
    return queue;
  }

  function generateBatch(slides){
    // Queue all slides without blocking UI
    const promises=slides.map(s=> !s.thumbnail ? generate(s) : Promise.resolve(s.thumbnail));
    return Promise.all(promises);
  }

  function getProgress(){
    return {generating:generatingCount,total:totalToGenerate};
  }

  return {init,generate,generateBatch,setProgressCallback,getProgress};
})();
