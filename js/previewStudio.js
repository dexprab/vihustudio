// PreviewStudio — Sprint 6.6 Platform Preview Studio
//
// The fourth workspace tab. Displays a live miniature of the active page
// inside each enabled publishing platform's viewport — Instagram Carousel,
// Reel, Book, Print, Website. Reuses the existing SlideRenderer pipeline
// verbatim: same SlideRenderer.buildPayload, same SlideRenderer.render,
// same page bytes that Sprint 6.4 WYSIWYE guarantees match Export. The
// platform-specific bit is purely how the rendered page is composited
// into the platform-shaped preview canvas.
//
// No layout changes, no second renderer, no project mutation. The studio
// is read-only by design — children see how the page will look on each
// platform without ever clicking through to a publish step.

const PreviewStudio=(function(){
  const STORAGE_KEY='vihu.previewStudio.platforms.v1';
  const PAGE_W=1080, PAGE_H=1350;

  // Platform definitions. Each platform names its canonical export canvas
  // dimensions plus a backdrop color used for letterboxing when the page
  // ratio doesn't match. The lightbox preview is the same renderer with
  // a larger card surface.
  const PLATFORMS=[
    {id:'instagram-carousel', icon:'📱', name:'Instagram Carousel', width:1080, height:1350, backdrop:'#101010', defaultEnabled:true},
    {id:'instagram-reel',     icon:'🎥', name:'Instagram Reel',     width:1080, height:1920, backdrop:'#101010', defaultEnabled:true},
    {id:'book',               icon:'📖', name:'Book',               width:1200, height:1600, backdrop:'#F1ECDF', defaultEnabled:true},
    {id:'print',              icon:'🖨', name:'Print',              width:2480, height:3508, backdrop:'#FFFFFF', defaultEnabled:false},
    {id:'website',            icon:'🌐', name:'Website',            width:1920, height:1080, backdrop:'#22272E', defaultEnabled:false}
  ];
  // Miniature display target (CSS width). Card canvas runs at the platform
  // aspect ratio scaled to fit this width — keeps cards visually balanced.
  const CARD_WIDTH=180;

  let mountedRoot=null;
  let host=null;
  let enabledIds=new Set();
  let refreshScheduled=false;
  let mainCanvas=null;

  function _loadEnabled(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)){ enabledIds=new Set(parsed); return; }
      }
    }catch(e){}
    enabledIds=new Set(PLATFORMS.filter(function(p){ return p.defaultEnabled; }).map(function(p){ return p.id; }));
  }
  function _persistEnabled(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(enabledIds))); }catch(e){}
  }

  function _currentSlide(){
    if(!host || typeof host.getCurrentSlide!=='function') return null;
    try{ return host.getCurrentSlide(); }catch(e){ return null; }
  }

  // Render the active slide into a 1080×1350 temp canvas using the
  // canonical SlideRenderer pipeline (same payload as Preview and Export).
  // Returns the temp canvas so the caller can composite it into a
  // platform-shaped surface.
  function _renderPageToTemp(){
    const slide=_currentSlide();
    if(!slide || typeof SlideRenderer==='undefined') return null;
    const temp=document.createElement('canvas');
    SlideRenderer.init(temp);
    const titleEl=document.getElementById('bookTitle');
    const payload=SlideRenderer.buildPayload(slide,{
      defaultBookTitle: titleEl ? titleEl.value : ''
    });
    try{ SlideRenderer.render(payload); }catch(e){ /* swallow */ }
    if(mainCanvas){ try{ SlideRenderer.init(mainCanvas); }catch(e){} }
    return temp;
  }

  // Compose the 1080×1350 page rendering into a platform-shaped canvas
  // with "contain" letterboxing. The page is centered; backdrop fills the
  // rest. This is the only non-renderer math in the studio.
  function _renderPlatformIntoCanvas(cv, platform, pageCanvas){
    const ctx=cv.getContext('2d');
    try{ ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; }catch(e){}
    ctx.fillStyle=platform.backdrop;
    ctx.fillRect(0,0,cv.width,cv.height);
    if(!pageCanvas) return;
    const sx=cv.width/PAGE_W, sy=cv.height/PAGE_H;
    const sc=Math.min(sx,sy);
    const dw=PAGE_W*sc, dh=PAGE_H*sc;
    const dx=(cv.width-dw)/2, dy=(cv.height-dh)/2;
    ctx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, dx, dy, dw, dh);
  }

  function _statusFor(platform){
    // Aspect-aware confidence note. The 1080×1350 page is the source of
    // truth. When a platform is wider or taller than the page, the
    // miniature shows letterbox bars — call that out without making it
    // alarming.
    const pageRatio=PAGE_W/PAGE_H;
    const platRatio=platform.width/platform.height;
    if(Math.abs(pageRatio-platRatio)<0.02) return {kind:'ready', text:'✅ Ready'};
    if(platRatio<pageRatio) return {kind:'note', text:'⚠ Page sits inside taller frame'};
    return {kind:'note', text:'⚠ Page sits inside wider frame'};
  }

  function _buildChip(platform){
    const chip=document.createElement('button');
    chip.type='button';
    chip.className='preview-chip';
    chip.setAttribute('data-platform',platform.id);
    chip.innerHTML='<span class="preview-chip-icon">'+platform.icon+'</span> <span class="preview-chip-name">'+platform.name+'</span> <span class="preview-chip-check">✓</span>';
    chip.addEventListener('click',function(){ _toggle(platform.id); });
    return chip;
  }

  function _buildCard(platform){
    const card=document.createElement('div');
    card.className='preview-card';
    card.setAttribute('data-platform',platform.id);
    const header=document.createElement('div');
    header.className='preview-card-header';
    header.innerHTML='<span class="preview-card-icon">'+platform.icon+'</span><span class="preview-card-name">'+platform.name+'</span>';
    card.appendChild(header);

    const cvWrap=document.createElement('button');
    cvWrap.type='button';
    cvWrap.className='preview-card-canvas-wrap';
    const cv=document.createElement('canvas');
    cv.className='preview-card-canvas';
    // Render at 2× CSS density for sharper miniatures.
    const cvW=CARD_WIDTH*2;
    const cvH=Math.round(cvW * platform.height / platform.width);
    cv.width=cvW; cv.height=cvH;
    cv.style.width=CARD_WIDTH+'px';
    cv.style.height=Math.round(CARD_WIDTH * platform.height / platform.width)+'px';
    cvWrap.appendChild(cv);
    cvWrap.addEventListener('click',function(){ _openLightbox(platform); });
    card.appendChild(cvWrap);

    const meta=document.createElement('div');
    meta.className='preview-card-meta';
    meta.innerHTML='<span class="preview-card-dims">'+platform.width+' × '+platform.height+'</span><span class="preview-card-status"></span>';
    card.appendChild(meta);
    return card;
  }

  function _toggle(platformId){
    if(enabledIds.has(platformId)) enabledIds.delete(platformId);
    else enabledIds.add(platformId);
    _persistEnabled();
    _syncChipState();
    _rebuildCardList();
  }

  function _syncChipState(){
    if(!mountedRoot) return;
    mountedRoot.querySelectorAll('.preview-chip').forEach(function(chip){
      chip.classList.toggle('active', enabledIds.has(chip.getAttribute('data-platform')));
    });
  }

  function _rebuildCardList(){
    if(!mountedRoot) return;
    const cardList=mountedRoot.querySelector('.preview-card-list');
    if(!cardList) return;
    cardList.innerHTML='';
    if(enabledIds.size===0){
      const empty=document.createElement('p');
      empty.className='preview-empty';
      empty.textContent='Pick a platform above to see a live preview.';
      cardList.appendChild(empty);
      return;
    }
    PLATFORMS.forEach(function(p){
      if(!enabledIds.has(p.id)) return;
      cardList.appendChild(_buildCard(p));
    });
    refresh();
  }

  function mount(container){
    if(!container) return null;
    mountedRoot=container;
    container.innerHTML='';
    _loadEnabled();

    const header=document.createElement('div');
    header.className='preview-studio-header';
    header.innerHTML='<h3 class="preview-studio-title">Preview Studio</h3><p class="preview-studio-intro">See how this page looks on every platform — live.</p>';
    container.appendChild(header);

    const chipRow=document.createElement('div');
    chipRow.className='preview-chip-row';
    PLATFORMS.forEach(function(p){ chipRow.appendChild(_buildChip(p)); });
    container.appendChild(chipRow);

    const cardList=document.createElement('div');
    cardList.className='preview-card-list';
    container.appendChild(cardList);

    _syncChipState();
    _rebuildCardList();
    return container;
  }

  function configure(cfg){
    host=cfg||null;
    mainCanvas=cfg && cfg.getMainCanvas ? cfg.getMainCanvas() : document.getElementById('previewCanvas');
  }

  // Refresh all enabled previews. Debounced — multiple calls in the same
  // tick coalesce to a single render pass.
  function refresh(){
    if(refreshScheduled) return;
    refreshScheduled=true;
    requestAnimationFrame(function(){
      refreshScheduled=false;
      _refreshNow();
    });
  }

  function _refreshNow(){
    if(!mountedRoot) return;
    if(!isActive()) return; // skip work when the tab isn't visible
    const pageCanvas=_renderPageToTemp();
    if(!pageCanvas) return;
    PLATFORMS.forEach(function(p){
      if(!enabledIds.has(p.id)) return;
      const card=mountedRoot.querySelector('.preview-card[data-platform="'+p.id+'"]');
      if(!card) return;
      const cv=card.querySelector('.preview-card-canvas');
      if(cv){ _renderPlatformIntoCanvas(cv, p, pageCanvas); }
      const status=_statusFor(p);
      const statusEl=card.querySelector('.preview-card-status');
      if(statusEl){
        statusEl.textContent=status.text;
        statusEl.setAttribute('data-status-kind',status.kind);
      }
    });
  }

  // Whether the Preview tab is the currently-active tab. The host can
  // skip refresh work while the tab is hidden.
  function isActive(){
    const tabBtn=document.querySelector('.tab-btn[data-tab="preview"]');
    return tabBtn ? tabBtn.classList.contains('active') : false;
  }

  // --- Enlarged Preview (lightbox) ---------------------------------------
  function _openLightbox(platform){
    const modal=document.getElementById('previewLightboxModal');
    if(!modal) return;
    const title=document.getElementById('previewLightboxTitle');
    const body=document.getElementById('previewLightboxBody');
    const footer=document.getElementById('previewLightboxFooter');
    if(title) title.textContent=platform.icon+' '+platform.name;
    if(body){
      body.innerHTML='';
      const wrap=document.createElement('div');
      wrap.className='preview-lightbox-canvas-wrap';
      const cv=document.createElement('canvas');
      cv.className='preview-lightbox-canvas';
      // Render at platform native resolution so the modal stays crisp.
      cv.width=platform.width;
      cv.height=platform.height;
      // CSS scaling keeps the modal sensible — the longer dimension
      // caps at 70vh.
      const ratio=platform.width/platform.height;
      cv.style.maxHeight='70vh';
      cv.style.maxWidth='min(70vw, '+Math.round(70*ratio)+'vh)';
      wrap.appendChild(cv);
      body.appendChild(wrap);

      const pageCanvas=_renderPageToTemp();
      _renderPlatformIntoCanvas(cv, platform, pageCanvas);
    }
    if(footer){
      footer.innerHTML='';
      const dims=document.createElement('span');
      dims.className='preview-lightbox-dims';
      dims.textContent=platform.width+' × '+platform.height;
      footer.appendChild(dims);
      const status=_statusFor(platform);
      const st=document.createElement('span');
      st.className='preview-lightbox-status';
      st.setAttribute('data-status-kind',status.kind);
      st.textContent=status.text;
      footer.appendChild(st);
      // Page navigation for Instagram-style platforms.
      if(platform.id==='instagram-carousel' || platform.id==='instagram-reel' || platform.id==='book'){
        const nav=document.createElement('div');
        nav.className='preview-lightbox-nav';
        const prev=document.createElement('button');
        prev.type='button'; prev.className='preview-lightbox-nav-btn'; prev.textContent='‹';
        prev.addEventListener('click',function(){ _stepLightboxPage(-1, platform); });
        const next=document.createElement('button');
        next.type='button'; next.className='preview-lightbox-nav-btn'; next.textContent='›';
        next.addEventListener('click',function(){ _stepLightboxPage(1, platform); });
        const counter=document.createElement('span');
        counter.id='previewLightboxCounter';
        counter.className='preview-lightbox-counter';
        const total=(typeof AppState!=='undefined' && AppState.slides) ? AppState.slides.length : 1;
        const cur=(typeof AppState!=='undefined') ? (AppState.currentSlide+1) : 1;
        counter.textContent=cur+' / '+total;
        nav.appendChild(prev); nav.appendChild(counter); nav.appendChild(next);
        footer.appendChild(nav);
      }
    }
    modal.classList.remove('hidden');
  }

  function _closeLightbox(){
    const modal=document.getElementById('previewLightboxModal');
    if(modal) modal.classList.add('hidden');
  }

  function _stepLightboxPage(delta, platform){
    if(typeof AppState==='undefined' || !AppState.slides || !AppState.slides.length) return;
    const next=Math.max(0, Math.min(AppState.slides.length-1, AppState.currentSlide+delta));
    if(next===AppState.currentSlide) return;
    if(typeof window.showSlide==='function'){
      window.showSlide(next);
    }else{
      AppState.currentSlide=next;
    }
    // Re-render the lightbox canvas with the new slide.
    const modal=document.getElementById('previewLightboxModal');
    if(!modal) return;
    const cv=modal.querySelector('.preview-lightbox-canvas');
    if(!cv) return;
    const pageCanvas=_renderPageToTemp();
    _renderPlatformIntoCanvas(cv, platform, pageCanvas);
    const counter=document.getElementById('previewLightboxCounter');
    if(counter) counter.textContent=(AppState.currentSlide+1)+' / '+AppState.slides.length;
  }

  // Wire up the lightbox close button + overlay click + Escape key the
  // moment the module loads. Idempotent — only binds once.
  function _wireLightboxControls(){
    const modal=document.getElementById('previewLightboxModal');
    if(!modal || modal.__previewWired) return;
    modal.__previewWired=true;
    const closeBtn=document.getElementById('previewLightboxClose');
    if(closeBtn) closeBtn.addEventListener('click', _closeLightbox);
    modal.addEventListener('click', function(e){ if(e.target===modal) _closeLightbox(); });
    document.addEventListener('keydown', function(e){
      if(e.key==='Escape' && !modal.classList.contains('hidden')) _closeLightbox();
    });
  }
  try{ _wireLightboxControls(); }catch(e){}
  // Late-binding in case the DOM isn't ready when the script loads.
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', _wireLightboxControls);
  }

  const api={
    PLATFORMS:PLATFORMS,
    mount:mount,
    configure:configure,
    refresh:refresh,
    isActive:isActive
  };
  try{ window.PreviewStudio=api; }catch(e){}
  return api;
})();
