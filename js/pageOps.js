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

  // Sprint 6.4 — WYSIWYE. Export now resolves the page through the SAME
  // SlideRenderer.buildPayload helper that Preview and Thumbnail use, so
  // every override layer (scene / element overrides / image view / card
  // overrides / theme / page content) is preserved. The exported PNG is
  // pixel-identical to the canvas preview at export resolution.
  function exportPage(index){
    if(index<0||index>=AppState.slides.length) return false;
    if(typeof SlideRenderer==='undefined') return false;
    const previewCanvas=document.getElementById('previewCanvas');
    if(!previewCanvas) return false;
    const slide=AppState.slides[index];
    const titleEl=document.getElementById('bookTitle');
    const bookTitleVal=titleEl?titleEl.value:'';
    const totalPages=AppState.slides.length;

    try{
      const temp=document.createElement('canvas');
      SlideRenderer.init(temp);
      SlideRenderer.render(SlideRenderer.buildPayload(slide,{
        page:String(index+1),
        totalPages:totalPages,
        defaultBookTitle:bookTitleVal
      }));
      const dataURL=temp.toDataURL('image/png');

      // Restore renderer back to the preview canvas — re-render the
      // currently-visible page so the editor view stays correct.
      SlideRenderer.init(previewCanvas);
      const cur=AppState.slides[AppState.currentSlide];
      if(cur){
        try{
          SlideRenderer.render(SlideRenderer.buildPayload(cur,{
            page:cur.page||String(AppState.currentSlide+1),
            totalPages:totalPages,
            defaultBookTitle:bookTitleVal
          }));
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
      try{ SlideRenderer.init(previewCanvas); }catch(_){}
      return false;
    }
  }

  // Sprint 5.1 — Story Operations: split a slide's storyBeat into two
  // sibling slides, and merge a slide's storyBeat with the next slide's.
  // Both reuse the existing _afterMutation pipeline so renumbering /
  // navigation refresh / autosave fire automatically.
  function splitPage(index,firstHalf,secondHalf){
    if(index<0||index>=AppState.slides.length) return false;
    const slide=AppState.slides[index];
    slide.storyBeat=firstHalf||'';
    delete slide.thumbnail;
    const inserted=_createBlankSlide();
    inserted.storyBeat=secondHalf||'';
    // Inherit page type so a split Cover stays a cover-shaped split if
    // ever needed; otherwise stay 'story' since the original is 'blank'
    // only when there was no image.
    inserted.pageType=slide.pageType==='cover'?'story':(slide.pageType||'story');
    delete inserted.thumbnail;
    AppState.slides.splice(index+1,0,inserted);
    _afterMutation(index+1);
    return true;
  }

  // Sprint 8.2 — drag-and-drop reorder. Honors fixed positions: a
  // Cover-role page is locked at index 0, an End-role page is locked at
  // the last index. Story pages move freely between them. Selection
  // follows the moved page so the editor stays on the same story.
  function _firstStoryIdx(){
    // The lowest index a story page is allowed to occupy. Cover anchors
    // index 0 when present.
    return (AppState.slides.length>0 && AppState.slides[0].pageType==='cover') ? 1 : 0;
  }
  function _lastStoryIdx(){
    // The highest index a story page is allowed to occupy. End anchors
    // the last slot when present.
    const n=AppState.slides.length;
    if(n===0) return -1;
    return (AppState.slides[n-1].pageType==='end') ? n-2 : n-1;
  }
  function canMove(index){
    if(index<0||index>=AppState.slides.length) return false;
    const t=AppState.slides[index].pageType;
    return t!=='cover' && t!=='end';
  }
  function reorderPage(fromIdx,toIdx){
    if(fromIdx===toIdx) return false;
    if(fromIdx<0||fromIdx>=AppState.slides.length) return false;
    if(!canMove(fromIdx)) return false;
    // Clamp the drop position into the moveable range.
    const minIdx=_firstStoryIdx();
    const maxIdx=_lastStoryIdx();
    let target=Math.max(minIdx,Math.min(toIdx,maxIdx));
    // splice math: removing first shifts later indices by 1.
    const adjusted=(target>fromIdx) ? target : target;
    if(adjusted===fromIdx) return false;
    const wasSelected=AppState.currentSlide===fromIdx;
    const moved=AppState.slides.splice(fromIdx,1)[0];
    const insertAt=(adjusted>fromIdx) ? adjusted : adjusted;
    AppState.slides.splice(insertAt,0,moved);
    // Track where the moved page landed so selection can follow it.
    const landed=AppState.slides.indexOf(moved);
    if(wasSelected){
      _afterMutation(landed);
    }else{
      // Preserve the previously-selected page when something else moved.
      const prevSelectedSlide=AppState.slides[AppState.currentSlide];
      _recalcPageNumbers();
      _refreshNavigation();
      // Re-anchor selection to whatever slide was previously selected
      // (its index may have shifted).
      const idx=AppState.slides.indexOf(prevSelectedSlide);
      if(idx!==-1) _refreshSelection(idx);
      _persist();
    }
    return true;
  }
  // Sprint 8.2 — child-friendly page rename. Persists at slide.name and
  // shows in the thumbnail label; an empty name resets to the default
  // "Page X" label without touching anything else.
  function renamePage(index,name){
    if(index<0||index>=AppState.slides.length) return false;
    const slide=AppState.slides[index];
    const trimmed=typeof name==='string' ? name.trim() : '';
    if(trimmed){
      slide.name=trimmed;
    }else{
      delete slide.name;
    }
    _refreshNavigation();
    _persist();
    return true;
  }

  function mergeWithNext(index){
    if(index<0||index>=AppState.slides.length-1) return false;
    const current=AppState.slides[index];
    const next=AppState.slides[index+1];
    const joiner=(current.storyBeat && next.storyBeat) ? '\n\n' : '';
    current.storyBeat=(current.storyBeat||'')+joiner+(next.storyBeat||'');
    delete current.thumbnail;
    AppState.slides.splice(index+1,1);
    _afterMutation(index);
    return true;
  }

  return {
    duplicatePage:duplicatePage,
    deletePage:deletePage,
    insertBlankPage:insertBlankPage,
    addBefore:addBefore,
    addAfter:addAfter,
    moveToEnd:moveToEnd,
    setAsCover:setAsCover,
    exportPage:exportPage,
    splitPage:splitPage,
    mergeWithNext:mergeWithNext,
    // Sprint 8.2 — page management enhancement
    reorderPage:reorderPage,
    renamePage:renamePage,
    canMove:canMove
  };
})();
try{ window.PageOps=PageOps; }catch(e){}
