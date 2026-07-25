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
      let dataUrl=null;
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
        dataUrl=thumbCanvas.toDataURL('image/png');
        slide.thumbnail=dataUrl;
      }catch(err){
        // A real, confirmed root cause behind a "Studio center pane
        // frozen" bug: drawing a cross-origin image with no CORS
        // clearance (a Supabase Storage signed URL AssetStore.resolve()
        // can hand back, now fixed at the source in projectManager.js /
        // slideRenderer.js / pictureStudio.js) silently taints `temp`,
        // then `thumbCanvas` via the drawImage above, and
        // thumbCanvas.toDataURL() throws a SecurityError right here.
        // dataUrl simply stays null — slide.thumbnail is never set, so
        // the next call to generate() for this slide retries on its own.
        // The one thing that must never happen, whatever throws here, is
        // skipping the restore below.
      }
      // A real, confirmed bug: this restore step used to sit INSIDE the
      // same try block as the risky render/encode work above, with no
      // guarantee it would ever run — any exception thrown before it
      // (previously just a theoretical "ensure we continue" concern;
      // confirmed for real by the tainted-canvas SecurityError above)
      // jumped straight to the catch block and skipped it entirely,
      // leaving SlideRenderer's one shared canvas target permanently
      // stuck pointing at this now-discarded `temp` canvas for the rest
      // of the session — every later edit kept updating the model
      // correctly (the Words field, the render tree, Object Strip all
      // read the model directly) while the VISIBLE #previewCanvas never
      // got touched again, reading exactly like a frozen canvas. Moved
      // outside the try/catch above so it unconditionally runs whether
      // the render/encode succeeded or threw — the same discipline
      // js/publishStudio.js's own three swap-restore pairs and
      // js/storyDestinations.js's _renderSlideInto already use.
      //
      // window.redrawPreview() is the same real choke point every other
      // "something changed off to the side, please repaint correctly"
      // case already uses (_ensureDecorationImage's/_ensureStickerImage's
      // own onload nudge) -- it reads whichever slide/selection is
      // actually current and stamps it correctly.
      SlideRenderer.init(previewCanvas);
      if(typeof window.redrawPreview==='function'){
        try{ window.redrawPreview(); }catch(e){}
      }

      generatingCount--;
      _notifyProgress();
      resolve(dataUrl);
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
