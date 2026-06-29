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
        const w = previewCanvas.width || previewCanvas.clientWidth || 1080;
        const h = previewCanvas.height || previewCanvas.clientHeight || 1350;
        const temp=document.createElement('canvas'); temp.width=w; temp.height=h;

        SlideRenderer.init(temp);

        const titleEl=document.getElementById('bookTitle');
        const theme=(typeof ThemeEngine!=='undefined')?ThemeEngine.getActiveTheme():null;
        const themeOptions=(typeof ThemeEngine!=='undefined')?ThemeEngine.getOptions():null;
        const payload={
          image: slide.image,
          storyBeat: slide.storyBeat || '',
          bookTitle: titleEl? titleEl.value : '',
          page: slide.page || 1,
          totalPages: slide.totalPages || 0,
          theme: theme,
          themeOptions: themeOptions,
          imageView: (slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.image) || (slide.metadata && slide.metadata.imageView) || null,
          overrides: (slide.metadata && slide.metadata.cardOverrides) || null
        };

        try{
          SlideRenderer.render(payload);
        }catch(e){ /* ensure we continue */ }

        const thumbW=110; const thumbH=Math.round((thumbW * temp.height)/temp.width);
        const thumbCanvas=document.createElement('canvas'); thumbCanvas.width=thumbW; thumbCanvas.height=thumbH;
        const tctx=thumbCanvas.getContext('2d');
        tctx.fillStyle='#fff'; tctx.fillRect(0,0,thumbW,thumbH);
        tctx.drawImage(temp,0,0,thumbW,thumbH);
        const dataUrl=thumbCanvas.toDataURL('image/png');
        slide.thumbnail=dataUrl;

        SlideRenderer.init(previewCanvas);
        const currentIdx=AppState.currentSlide||0;
        const current=AppState.slides[currentIdx];
        if(current){
          try{ SlideRenderer.render({image:current.image,storyBeat:current.storyBeat||'',bookTitle:document.getElementById('bookTitle')?document.getElementById('bookTitle').value:'',page:current.page||1,totalPages:current.totalPages||0,theme:theme,themeOptions:themeOptions,imageView:(current.metadata&&current.metadata.cardOverrides&&current.metadata.cardOverrides.image)||(current.metadata&&current.metadata.imageView)||null,overrides:(current.metadata&&current.metadata.cardOverrides)||null}); }catch(e){}
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
