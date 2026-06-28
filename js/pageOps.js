const PageOps=(function(){
  // --- Internal helpers (not exposed) ---

  function _persist(){
    try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
  }

  function _recalcPageNumbers(){
    const total=AppState.slides.length;
    AppState.slides.forEach(function(s,i){
      s.page=String(i+1);
      s.totalPages=total;
    });
  }

  function _refreshNavigation(){
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
  }

  function _refreshSelection(idx){
    const n=AppState.slides.length;
    if(n===0){ AppState.currentSlide=0; return; }
    const clamped=Math.max(0,Math.min(idx,n-1));
    AppState.currentSlide=clamped;
    try{ if(typeof window.showSlide==='function') window.showSlide(clamped); }catch(e){}
  }

  function _reorderPages(fromIdx,toIdx){
    if(fromIdx===toIdx) return;
    if(fromIdx<0||fromIdx>=AppState.slides.length) return;
    const moved=AppState.slides.splice(fromIdx,1)[0];
    const clampedTo=Math.max(0,Math.min(toIdx,AppState.slides.length));
    AppState.slides.splice(clampedTo,0,moved);
  }

  function _createBlankThumbnail(){
    try{
      const c=document.createElement('canvas');
      c.width=110; c.height=80;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#f0f0f0'; ctx.fillRect(0,0,110,80);
      ctx.fillStyle='#999'; ctx.font='11px Arial'; ctx.textAlign='center';
      ctx.fillText('Blank',55,40);
      return c.toDataURL('image/png');
    }catch(e){ return null; }
  }

  function _createBlankSlide(){
    return {
      id:Date.now()+Math.floor(Math.random()*1000),
      image:null,
      thumbnail:_createBlankThumbnail(),
      storyBeat:'',
      storyDraft:'',
      pageType:'blank',
      metadata:{},
      page:'1',
      totalPages:0,
      _lastStory:''
    };
  }

  function _afterMutation(selectIdx){
    _recalcPageNumbers();
    _refreshNavigation();
    _refreshSelection(selectIdx);
    _persist();
  }

  // --- Public API ---

  function duplicatePage(index){
    if(index<0||index>=AppState.slides.length) return false;
    const original=AppState.slides[index];
    const dup={
      id:Date.now()+Math.floor(Math.random()*1000),
      image:original.image,
      thumbnail:original.thumbnail||null,
      storyBeat:original.storyBeat,
      storyDraft:original.storyDraft||'',
      pageType:original.pageType==='cover'?'story':(original.pageType||'story'),
      metadata:Object.assign({},original.metadata||{}),
      page:original.page,
      totalPages:original.totalPages,
      _lastStory:original._lastStory,
      _imageDataURL:original._imageDataURL
    };
    AppState.slides.splice(index+1,0,dup);
    _afterMutation(index+1);
    if(!dup.thumbnail){ try{ ThumbnailEngine.generate(dup); }catch(e){} }
    return true;
  }

  function deletePage(index){
    if(index<0||index>=AppState.slides.length) return false;
    const msg='Delete page '+(index+1)+' of '+AppState.slides.length+'? This cannot be undone.';
    if(!confirm(msg)) return false;
    AppState.slides.splice(index,1);
    const next=AppState.slides.length===0?0:Math.min(index,AppState.slides.length-1);
    _afterMutation(next);
    return true;
  }

  function insertBlankPage(index){
    const insertAt=index+1;
    AppState.slides.splice(insertAt,0,_createBlankSlide());
    _afterMutation(insertAt);
    return true;
  }

  function addBefore(index){
    if(AppState.slides.length===0){
      AppState.slides.push(_createBlankSlide());
      _afterMutation(0);
      return true;
    }
    const insertAt=Math.max(0,index);
    AppState.slides.splice(insertAt,0,_createBlankSlide());
    _afterMutation(insertAt);
    return true;
  }

  function addAfter(index){
    if(AppState.slides.length===0){
      AppState.slides.push(_createBlankSlide());
      _afterMutation(0);
      return true;
    }
    const insertAt=Math.min(index+1,AppState.slides.length);
    AppState.slides.splice(insertAt,0,_createBlankSlide());
    _afterMutation(insertAt);
    return true;
  }

  function moveToEnd(index){
    if(index<0||index>=AppState.slides.length) return false;
    const lastIdx=AppState.slides.length-1;
    if(index===lastIdx){
      _refreshSelection(lastIdx);
      return true;
    }
    _reorderPages(index,lastIdx);
    _afterMutation(lastIdx);
    return true;
  }

  function setAsCover(index){
    if(index<0||index>=AppState.slides.length) return false;
    AppState.slides.forEach(function(s){
      if(s.pageType==='cover') s.pageType='story';
    });
    const target=AppState.slides[index];
    target.pageType='cover';
    if(index!==0) _reorderPages(index,0);
    _afterMutation(0);
    return true;
  }

  function exportPage(index){
    if(index<0||index>=AppState.slides.length) return false;
    if(typeof SlideRenderer==='undefined') return false;
    const previewCanvas=document.getElementById('previewCanvas');
    if(!previewCanvas) return false;
    const slide=AppState.slides[index];
    const titleEl=document.getElementById('bookTitle');
    const bookTitleVal=titleEl?titleEl.value:'';

    try{
      const temp=document.createElement('canvas');
      SlideRenderer.init(temp);
      SlideRenderer.render({
        image:slide.image,
        storyBeat:slide.storyBeat||'',
        bookTitle:bookTitleVal,
        page:String(index+1),
        totalPages:AppState.slides.length
      });
      const dataURL=temp.toDataURL('image/png');

      // Restore renderer back to the preview canvas
      SlideRenderer.init(previewCanvas);
      const cur=AppState.slides[AppState.currentSlide];
      if(cur){
        try{
          SlideRenderer.render({
            image:cur.image,
            storyBeat:cur.storyBeat||'',
            bookTitle:bookTitleVal,
            page:cur.page||String(AppState.currentSlide+1),
            totalPages:AppState.slides.length
          });
        }catch(e){}
      }

      const num=String(index+1).padStart(3,'0');
      const a=document.createElement('a');
      a.href=dataURL;
      a.download='Page '+num+'.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }catch(e){
      // Restore renderer even on failure
      try{ SlideRenderer.init(previewCanvas); }catch(_){}
      return false;
    }
  }

  return {
    duplicatePage:duplicatePage,
    deletePage:deletePage,
    insertBlankPage:insertBlankPage,
    addBefore:addBefore,
    addAfter:addAfter,
    moveToEnd:moveToEnd,
    setAsCover:setAsCover,
    exportPage:exportPage
  };
})();
try{ window.PageOps=PageOps; }catch(e){}
