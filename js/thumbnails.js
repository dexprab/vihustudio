const ThumbnailEngine=(function(){
  // Simple thumbnail engine that reuses SlideRenderer by temporarily swapping its canvas.
  // All operations are queued to avoid concurrent re-inits.
  let previewCanvas=null;
  let queue=Promise.resolve();

  function init(preview){ previewCanvas=preview; }

  function generate(slide){
    if(!previewCanvas) return Promise.resolve(null);
    // If thumbnail already exists, return it
    if(slide.thumbnail) return Promise.resolve(slide.thumbnail);

    // Queue thumbnail generation to avoid races
    queue = queue.then(()=> new Promise((resolve)=>{
      try{
        // create a temporary canvas with same intrinsic size as previewCanvas
        const w = previewCanvas.width || previewCanvas.clientWidth || 1080;
        const h = previewCanvas.height || previewCanvas.clientHeight || 1350;
        const temp=document.createElement('canvas'); temp.width=w; temp.height=h;

        // swap renderer to temp canvas
        SlideRenderer.init(temp);

        // prepare payload similar to app.draw usage
        const titleEl=document.getElementById('bookTitle');
        const payload={
          image: slide.image,
          storyBeat: slide.storyBeat || '',
          bookTitle: titleEl? titleEl.value : '',
          page: slide.page || 1,
          totalPages: slide.totalPages || 0
        };

        try{
          SlideRenderer.render(payload);
        }catch(e){ /* ensure we continue */ }

        // draw scaled thumbnail
        const thumbW=110; const thumbH=Math.round((thumbW * temp.height)/temp.width);
        const thumbCanvas=document.createElement('canvas'); thumbCanvas.width=thumbW; thumbCanvas.height=thumbH;
        const tctx=thumbCanvas.getContext('2d');
        tctx.fillStyle='#fff'; tctx.fillRect(0,0,thumbW,thumbH);
        tctx.drawImage(temp,0,0,thumbW,thumbH);
        const dataUrl=thumbCanvas.toDataURL('image/png');
        slide.thumbnail=dataUrl;

        // restore renderer to preview canvas and re-render current slide
        SlideRenderer.init(previewCanvas);
        const currentIdx=AppState.currentSlide||0;
        const current=AppState.slides[currentIdx];
        if(current){
          try{ SlideRenderer.render({image:current.image,storyBeat:current.storyBeat||'',bookTitle:document.getElementById('bookTitle')?document.getElementById('bookTitle').value:'',page:current.page||1,totalPages:current.totalPages||0}); }catch(e){}
        }

        resolve(dataUrl);
      }catch(err){
        resolve(null);
      }
    }));
    return queue;
  }

  return {init,generate};
})();
