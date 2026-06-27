const PageOps=(function(){
  function duplicatePage(index){
    if(index<0 || index>=AppState.slides.length) return false;
    const original=AppState.slides[index];
    const dup={
      id:Date.now(),
      image:original.image,
      storyBeat:original.storyBeat,
      page:original.page,
      totalPages:original.totalPages,
      _lastStory:original._lastStory
    };
    AppState.slides.splice(index+1,0,dup);
    AppState.currentSlide=index+1;
    try{ window.renderList(); }catch(e){}
    try{ window.showSlide(index+1); }catch(e){}
    try{ ThumbnailEngine.generate(dup); }catch(e){}
    return true;
  }

  function deletePage(index){
    if(index<0 || index>=AppState.slides.length) return false;
    const msg='Delete page '+(index+1)+' of '+AppState.slides.length+'? This cannot be undone.';
    if(!confirm(msg)) return false;
    AppState.slides.splice(index,1);
    if(AppState.slides.length===0){
      AppState.currentSlide=0;
    }else if(AppState.currentSlide>=AppState.slides.length){
      AppState.currentSlide=AppState.slides.length-1;
    }
    try{ window.renderList(); }catch(e){}
    try{ window.showSlide(AppState.currentSlide); }catch(e){}
    return true;
  }

  function insertBlankPage(index){
    const insertAt=index+1;
    const blank={
      id:Date.now(),
      image:null,
      storyBeat:'',
      page:insertAt,
      totalPages:AppState.slides.length+1,
      _lastStory:''
    };
    AppState.slides.splice(insertAt,0,blank);
    AppState.currentSlide=insertAt;
    try{ window.renderList(); }catch(e){}
    try{ window.showSlide(insertAt); }catch(e){}
    // generate placeholder thumbnail for blank page
    try{
      const blankCanvas=document.createElement('canvas');
      blankCanvas.width=110;
      blankCanvas.height=80;
      const ctx=blankCanvas.getContext('2d');
      ctx.fillStyle='#f0f0f0';
      ctx.fillRect(0,0,110,80);
      ctx.fillStyle='#999';
      ctx.font='11px Arial';
      ctx.textAlign='center';
      ctx.fillText('Blank',55,40);
      blank.thumbnail=blankCanvas.toDataURL('image/png');
    }catch(e){}
    return true;
  }

  return {duplicatePage,deletePage,insertBlankPage};
})();
