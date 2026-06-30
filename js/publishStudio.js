// PublishStudio — Sprint 8.1.
//
// The final chapter of creating a story. Publish Studio is a temporary
// full-screen modal (same lazy lifecycle as Picture Studio). It owns
// four stages — Read → Almost Ready → Publishing → Celebration — and
// always returns control to the editor exactly as the child left it.
//
// Product principles (locked):
//   * Children publish books. Software exports files. Every visible
//     label avoids technical jargon.
//   * The editor is the live preview; Publish Studio NEVER paints into
//     the editor canvas, NEVER persists studio-only state to the
//     project, and NEVER mounts a permanent tab.
//   * WYSIWYE is non-negotiable. Every page rendered inside the studio
//     flows through `SlideRenderer.buildPayload → SlideRenderer.render`
//     — the same path the editor + PageOps export already use.
//
// Sprint 8.1.1 ships the shell: modal scaffold, stage state machine,
// keyboard + ✕ close, and a Publish button in the editor header. Stage
// bodies are placeholders that subsequent milestones (8.1.2 Read,
// 8.1.3 Almost Ready, 8.1.4 Publishing, 8.1.5 Celebration) light up.
const PublishStudio=(function(){
  const STAGES={
    READ:'read',
    ALMOST_READY:'almost-ready',
    PUBLISHING:'publishing',
    CELEBRATION:'celebration'
  };

  let _modal=null;
  let _root=null;
  let _bodies={};   // { read, 'almost-ready', publishing, celebration }
  let _state={ stage:STAGES.READ, page:0 };
  let _opened=false;
  // Read stage internals — populated by _buildReadBody.
  let _readCanvas=null;
  let _readCaption=null;
  let _readDots=null;
  let _readPrevBtn=null;
  let _readNextBtn=null;
  let _readPublishBtn=null;
  let _readAnimating=false;

  // -------- DOM build (lazy; reuses the same modal across opens) ----
  function _ensureModal(){
    if(_modal) return _modal;
    _modal=document.createElement('div');
    _modal.className='publish-studio-modal hidden';
    // Full-screen modal has no visible backdrop area — children close
    // via the ✕ in the header or by pressing Escape.

    _root=document.createElement('div');
    _root.className='publish-studio';

    // Header — just the studio title and a close affordance. Stage
    // chrome (back-to-reading, etc.) lives inside each stage body so
    // every stage controls its own framing.
    const header=document.createElement('div');
    header.className='publish-studio-header';
    const brand=document.createElement('div');
    brand.className='publish-studio-brand';
    brand.textContent='📖 Publish Studio';
    header.appendChild(brand);
    const close=document.createElement('button');
    close.type='button';
    close.className='publish-studio-close';
    close.setAttribute('aria-label','Close');
    close.textContent='✕';
    close.addEventListener('click',function(){ _close(); });
    header.appendChild(close);
    _root.appendChild(header);

    // Stage host. Each stage gets its own pre-built body that the
    // shell shows / hides; building once avoids tearing down expensive
    // chrome (canvases, confetti, etc.) between stage transitions.
    const stage=document.createElement('div');
    stage.className='publish-studio-stage';
    _bodies[STAGES.READ]=_buildReadBody();
    _bodies[STAGES.ALMOST_READY]=_buildAlmostReadyBody();
    _bodies[STAGES.PUBLISHING]=_buildPublishingBody();
    _bodies[STAGES.CELEBRATION]=_buildCelebrationBody();
    Object.keys(_bodies).forEach(function(k){ stage.appendChild(_bodies[k]); });
    _root.appendChild(stage);

    _modal.appendChild(_root);
    document.body.appendChild(_modal);
    return _modal;
  }

  // Placeholder bodies — Sprint 8.1.1 just establishes the slots so
  // future milestones can light them up without touching the shell.
  function _placeholderBody(klass,label){
    const el=document.createElement('section');
    el.className='publish-studio-body '+klass+' hidden';
    const inner=document.createElement('div');
    inner.className='publish-studio-placeholder';
    inner.textContent=label;
    el.appendChild(inner);
    return el;
  }
  // --- Stage 1 · Read My Story --------------------------------------
  // Per-page rendering routes through SlideRenderer.buildPayload +
  // render — the same canonical path the editor + Export use. Sprint
  // 6.4 WYSIWYE preserved by construction.
  function _buildReadBody(){
    const body=document.createElement('section');
    body.className='publish-studio-body publish-studio-body-read hidden';

    // Navigation column: ◀
    _readPrevBtn=document.createElement('button');
    _readPrevBtn.type='button';
    _readPrevBtn.className='publish-read-nav publish-read-nav-prev';
    _readPrevBtn.setAttribute('aria-label','Previous page');
    _readPrevBtn.textContent='◀';
    _readPrevBtn.addEventListener('click',function(){ _goto(_state.page-1); });
    body.appendChild(_readPrevBtn);

    // Center stage: the book.
    const center=document.createElement('div');
    center.className='publish-read-center';
    const book=document.createElement('div');
    book.className='publish-read-book';
    _readCanvas=document.createElement('canvas');
    _readCanvas.width=1080;
    _readCanvas.height=1350;
    _readCanvas.className='publish-read-canvas';
    book.appendChild(_readCanvas);
    center.appendChild(book);

    _readCaption=document.createElement('div');
    _readCaption.className='publish-read-caption';
    center.appendChild(_readCaption);

    _readDots=document.createElement('div');
    _readDots.className='publish-read-dots';
    center.appendChild(_readDots);

    _readPublishBtn=document.createElement('button');
    _readPublishBtn.type='button';
    _readPublishBtn.className='publish-read-publish';
    _readPublishBtn.innerHTML='<span class="publish-read-publish-glyph">📖</span><span class="publish-read-publish-label">Publish My Book</span>';
    _readPublishBtn.addEventListener('click',function(){ _setStage(STAGES.ALMOST_READY); });
    center.appendChild(_readPublishBtn);

    body.appendChild(center);

    // Navigation column: ▶
    _readNextBtn=document.createElement('button');
    _readNextBtn.type='button';
    _readNextBtn.className='publish-read-nav publish-read-nav-next';
    _readNextBtn.setAttribute('aria-label','Next page');
    _readNextBtn.textContent='▶';
    _readNextBtn.addEventListener('click',function(){ _goto(_state.page+1); });
    body.appendChild(_readNextBtn);

    return body;
  }

  function _slideCount(){
    return (typeof AppState!=='undefined' && Array.isArray(AppState.slides))
      ? AppState.slides.length : 0;
  }

  function _renderReadPage(){
    if(!_readCanvas) return;
    const slides=AppState.slides||[];
    const n=slides.length;
    if(n===0) return;
    const idx=Math.max(0,Math.min(_state.page, n-1));
    const slide=slides[idx];

    // Routed through the canonical render path. We re-init the renderer
    // onto the studio's canvas, render, then re-init back to the
    // editor canvas so the editor's preview stays available the moment
    // the studio closes.
    const editorCanvas=document.getElementById('previewCanvas');
    try{
      SlideRenderer.init(_readCanvas);
      const titleEl=document.getElementById('bookTitle');
      const payload=SlideRenderer.buildPayload(slide,{
        page: idx+1,
        totalPages: n,
        defaultBookTitle: titleEl ? titleEl.value : ''
      });
      SlideRenderer.render(payload);
    }catch(e){}
    try{ if(editorCanvas) SlideRenderer.init(editorCanvas); }catch(e){}

    _refreshReadChrome(idx, n);
  }

  function _refreshReadChrome(idx, n){
    const isFirst=idx===0;
    const isLast=idx===n-1;

    // Caption — friendly per-position copy.
    if(_readCaption){
      if(isFirst) _readCaption.textContent='Cover · Tap ▶ to start reading';
      else if(isLast) _readCaption.textContent='The End · Ready to publish?';
      else _readCaption.textContent='Page '+(idx+1)+' of '+n;
    }

    // Nav buttons — hide at the ends so the affordance matches the
    // canvas (no chevron when there's nothing to flip to).
    if(_readPrevBtn) _readPrevBtn.style.visibility=isFirst?'hidden':'visible';
    if(_readNextBtn) _readNextBtn.style.visibility=isLast?'hidden':'visible';

    // Dots — clickable jump targets.
    if(_readDots){
      _readDots.innerHTML='';
      for(let i=0;i<n;i++){
        const d=document.createElement('button');
        d.type='button';
        d.className='publish-read-dot'+(i===idx?' is-active':'');
        d.setAttribute('aria-label','Go to page '+(i+1));
        d.addEventListener('click',function(){ _goto(i); });
        _readDots.appendChild(d);
      }
    }

    // Publish button grows on the End page, stays modest elsewhere.
    if(_readPublishBtn){
      _readPublishBtn.classList.toggle('is-promoted', isLast);
    }
  }

  function _goto(nextPage){
    if(_readAnimating) return;
    const n=_slideCount();
    if(n===0) return;
    const target=Math.max(0,Math.min(nextPage, n-1));
    if(target===_state.page){ _renderReadPage(); return; }
    const direction=target>_state.page?'forward':'back';
    _state.page=target;
    _animateFlip(direction);
  }

  function _animateFlip(direction){
    if(!_readCanvas) { _renderReadPage(); return; }
    _readAnimating=true;
    // CSS class drives the animation; the canvas is repainted mid-flip
    // so the new page is already in place when the flip lands.
    const book=_readCanvas.parentNode;
    if(!book){ _renderReadPage(); _readAnimating=false; return; }
    book.classList.add('is-flipping');
    book.classList.add(direction==='forward' ? 'flip-forward' : 'flip-back');
    // Render the new page roughly at the midpoint so the back side of
    // the flip already shows the new content.
    setTimeout(_renderReadPage, 160);
    setTimeout(function(){
      book.classList.remove('is-flipping','flip-forward','flip-back');
      _readAnimating=false;
    },340);
  }

  function _enterRead(){
    _state.page=0;
    _renderReadPage();
  }
  function _onReadKey(e){
    if(_state.stage!==STAGES.READ) return;
    if(e.key==='ArrowRight' || e.key===' '){
      e.preventDefault(); _goto(_state.page+1);
    }else if(e.key==='ArrowLeft'){
      e.preventDefault(); _goto(_state.page-1);
    }else if(e.key==='Home'){
      e.preventDefault(); _goto(0);
    }else if(e.key==='End'){
      e.preventDefault(); _goto(_slideCount()-1);
    }
  }
  function _buildAlmostReadyBody(){
    return _placeholderBody('publish-studio-body-almost','✨ Almost Ready · coming next');
  }
  function _buildPublishingBody(){
    return _placeholderBody('publish-studio-body-publishing','📕 Painting your book · coming next');
  }
  function _buildCelebrationBody(){
    return _placeholderBody('publish-studio-body-celebration','🎉 Celebration · coming next');
  }

  // -------- Stage state machine -------------------------------------
  function _setStage(next){
    if(!_modal) return;
    _state.stage=next;
    Object.keys(_bodies).forEach(function(k){
      _bodies[k].classList.toggle('hidden', k!==next);
    });
    if(next===STAGES.READ) _enterRead();
  }

  // -------- Lifecycle ------------------------------------------------
  function open(){
    _ensureModal();
    if(!_hasSlides()){
      // Nothing to publish yet. Nudge inside the editor — Sprint 8.1.1
      // keeps the studio's empty-state simple while the rest of the
      // stages light up. A future milestone can swap this for a
      // friendlier in-studio empty state.
      try{ alert('Add a page to your story before you publish.'); }catch(e){}
      return;
    }
    _state={ stage:STAGES.READ };
    _setStage(STAGES.READ);
    _modal.classList.remove('hidden');
    _opened=true;
    document.addEventListener('keydown',_onKeyDown);
  }

  function close(){ _close(); }

  function _close(){
    if(!_modal) return;
    _modal.classList.add('hidden');
    _opened=false;
    document.removeEventListener('keydown',_onKeyDown);
  }

  function _onKeyDown(e){
    if(!_opened) return;
    if(e.key==='Escape'){ e.preventDefault(); _close(); return; }
    _onReadKey(e);
  }

  function _hasSlides(){
    return typeof AppState!=='undefined'
      && Array.isArray(AppState.slides)
      && AppState.slides.length>0;
  }

  function isOpen(){ return _opened; }
  function getStage(){ return _state.stage; }

  const api={
    STAGES:STAGES,
    open:open,
    close:close,
    isOpen:isOpen,
    getStage:getStage,
    // Internal — exposed for the test harness only.
    _setStage:_setStage
  };
  try{ window.PublishStudio=api; }catch(e){}
  return api;
})();
