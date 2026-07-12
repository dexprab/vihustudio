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
  // Sprint 9.0.3 — Story Destinations. A new stage sits between
  // Almost Ready and Publishing: the child picks HOW they want to
  // enjoy their story (Book / Carousel / Reel) and, within that,
  // one format. The Publishing + Celebration stages become
  // destination-driven — no more hardcoded "PDF" verbiage.
  const STAGES={
    READ:'read',
    ALMOST_READY:'almost-ready',
    DESTINATION:'destination',
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
    _bodies[STAGES.DESTINATION]=_buildDestinationBody();
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
    return _slides().length;
  }

  function _renderReadPage(){
    if(!_readCanvas) return;
    const slides=_slides();
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
  // --- Stage 2 · Almost Ready ---------------------------------------
  // Validation runs every time the child enters this stage so the
  // nudges reflect the slide state as of right now.
  let _almostBackBtn=null;
  let _almostBadge=null;
  let _almostHeadline=null;
  let _almostMessage=null;
  let _almostCoverHost=null;
  let _almostCoverCanvas=null;
  let _almostCoverInfo=null;
  let _almostNudgeList=null;
  let _almostPublishBtn=null;

  function _buildAlmostReadyBody(){
    const body=document.createElement('section');
    body.className='publish-studio-body publish-studio-body-almost hidden';

    const back=document.createElement('button');
    back.type='button';
    back.className='publish-back-link';
    back.innerHTML='<span class="publish-back-arrow">←</span> Back to Reading';
    back.addEventListener('click',function(){ _setStage(STAGES.READ); });
    _almostBackBtn=back;
    body.appendChild(back);

    const center=document.createElement('div');
    center.className='publish-almost-center';

    _almostBadge=document.createElement('div');
    _almostBadge.className='publish-almost-badge';
    center.appendChild(_almostBadge);

    _almostHeadline=document.createElement('div');
    _almostHeadline.className='publish-almost-headline';
    center.appendChild(_almostHeadline);

    _almostMessage=document.createElement('p');
    _almostMessage.className='publish-almost-message';
    center.appendChild(_almostMessage);

    // Clean state — cover preview tile.
    _almostCoverHost=document.createElement('div');
    _almostCoverHost.className='publish-almost-cover-host hidden';
    _almostCoverCanvas=document.createElement('canvas');
    _almostCoverCanvas.width=1080;
    _almostCoverCanvas.height=1350;
    _almostCoverCanvas.className='publish-almost-cover-canvas';
    _almostCoverHost.appendChild(_almostCoverCanvas);
    _almostCoverInfo=document.createElement('div');
    _almostCoverInfo.className='publish-almost-cover-info';
    _almostCoverHost.appendChild(_almostCoverInfo);
    center.appendChild(_almostCoverHost);

    // Nudge state — list of cards.
    _almostNudgeList=document.createElement('div');
    _almostNudgeList.className='publish-nudges hidden';
    center.appendChild(_almostNudgeList);

    // Primary action — same label whether nudges are present or not.
    // Per the locked spec, never "Publish Anyway"; the choice is the
    // child's to make.
    _almostPublishBtn=document.createElement('button');
    _almostPublishBtn.type='button';
    _almostPublishBtn.className='publish-primary-btn';
    _almostPublishBtn.innerHTML='<span class="publish-primary-glyph">📖</span><span class="publish-primary-label">Choose Story Destination</span>';
    // Sprint 9.0.3 — the primary action no longer jumps straight to
    // publishing. It lands the child in the destination picker so
    // they choose HOW they want to enjoy their story before software
    // picks the file format.
    _almostPublishBtn.addEventListener('click',function(){ _setStage(STAGES.DESTINATION); });
    center.appendChild(_almostPublishBtn);

    body.appendChild(center);
    return body;
  }

  function _enterAlmostReady(){
    const slides=_slides();
    const project=(typeof AppState!=='undefined') ? AppState.project : null;
    const nudges=(typeof PublishValidator!=='undefined')
      ? PublishValidator.run(slides, project) : [];

    if(nudges.length===0){
      if(_almostBadge) _almostBadge.textContent='🎉';
      _almostHeadline.textContent='Your book looks ready!';
      _almostMessage.textContent='';
      _almostCoverHost.classList.remove('hidden');
      _almostNudgeList.classList.add('hidden');
      _renderAlmostCover();
    }else{
      if(_almostBadge) _almostBadge.textContent='💡';
      _almostHeadline.textContent='A few helpful tips';
      _almostMessage.textContent='Have a quick look — or publish your book anyway when you’re ready.';
      _almostCoverHost.classList.add('hidden');
      _almostNudgeList.classList.remove('hidden');
      _renderAlmostNudges(nudges);
    }
  }

  // --- Stage 2.5 · Choose Story Destination -------------------------
  // The heart of Sprint 9.0. Children choose HOW they want to enjoy
  // their story. Story Book → PDF (Digital / Print-ready). Story
  // Carousel → PNGs (Instagram Portrait / Square). Story Reel →
  // Coming Soon (architecture-ready). Every card is a plain button;
  // format sub-cards appear inline when a destination is selected,
  // so the choice is one screen deep — no dialogs, no wizards.
  let _destBody=null;
  let _destGrid=null;
  let _destContinueBtn=null;
  let _destComingSoonMsg=null;
  let _chosenDestinationId=null;
  let _chosenFormatId=null;

  function _buildDestinationBody(){
    _destBody=document.createElement('section');
    _destBody.className='publish-studio-body publish-studio-body-destination hidden';

    const back=document.createElement('button');
    back.type='button';
    back.className='publish-back-link';
    back.innerHTML='<span class="publish-back-arrow">←</span> Back';
    back.addEventListener('click',function(){ _setStage(STAGES.ALMOST_READY); });
    _destBody.appendChild(back);

    const center=document.createElement('div');
    center.className='publish-destination-center';

    const headline=document.createElement('div');
    headline.className='publish-destination-headline';
    headline.textContent='Choose Story Destination';
    center.appendChild(headline);

    const message=document.createElement('p');
    message.className='publish-destination-message';
    message.textContent='How would you like to enjoy your story?';
    center.appendChild(message);

    _destGrid=document.createElement('div');
    _destGrid.className='publish-destination-grid';
    center.appendChild(_destGrid);

    _destComingSoonMsg=document.createElement('div');
    _destComingSoonMsg.className='publish-destination-comingsoon hidden';
    _destComingSoonMsg.textContent='Story Reel is coming soon — check back after we film it. 🎬';
    center.appendChild(_destComingSoonMsg);

    _destContinueBtn=document.createElement('button');
    _destContinueBtn.type='button';
    _destContinueBtn.className='publish-primary-btn publish-destination-continue';
    _destContinueBtn.disabled=true;
    _destContinueBtn.innerHTML='<span class="publish-primary-glyph">✨</span><span class="publish-primary-label">Continue</span>';
    _destContinueBtn.addEventListener('click',function(){ _confirmDestination(); });
    center.appendChild(_destContinueBtn);

    _destBody.appendChild(center);
    return _destBody;
  }

  function _enterDestination(){
    // Reset selection every time the child arrives at this stage.
    _chosenDestinationId=null;
    _chosenFormatId=null;
    _destContinueBtn.disabled=true;
    _destComingSoonMsg.classList.add('hidden');
    _renderDestinationGrid();
  }

  function _renderDestinationGrid(){
    if(!_destGrid || typeof StoryDestinations==='undefined') return;
    _destGrid.innerHTML='';
    StoryDestinations.list().forEach(function(dest){
      const card=document.createElement('button');
      card.type='button';
      card.className='publish-destination-card';
      card.setAttribute('data-destination-id',dest.id);
      if(dest.comingSoon) card.classList.add('is-coming-soon');

      const head=document.createElement('div');
      head.className='publish-destination-card-head';
      const glyph=document.createElement('div');
      glyph.className='publish-destination-card-glyph';
      glyph.textContent=dest.glyph;
      head.appendChild(glyph);
      const title=document.createElement('div');
      title.className='publish-destination-card-title';
      title.textContent=dest.label;
      head.appendChild(title);
      if(dest.comingSoon){
        const chip=document.createElement('span');
        chip.className='publish-destination-card-chip';
        chip.textContent='Coming Soon';
        head.appendChild(chip);
      }
      card.appendChild(head);

      const tagline=document.createElement('div');
      tagline.className='publish-destination-card-tagline';
      tagline.textContent=dest.tagline;
      card.appendChild(tagline);

      const formatList=document.createElement('div');
      formatList.className='publish-destination-formats hidden';
      dest.formats.forEach(function(fmt){
        const fbtn=document.createElement('button');
        fbtn.type='button';
        fbtn.className='publish-destination-format';
        fbtn.setAttribute('data-format-id',fmt.id);
        const fLabel=document.createElement('div');
        fLabel.className='publish-destination-format-label';
        fLabel.textContent=fmt.label;
        fbtn.appendChild(fLabel);
        const fDesc=document.createElement('div');
        fDesc.className='publish-destination-format-desc';
        fDesc.textContent=fmt.description||'';
        fbtn.appendChild(fDesc);
        fbtn.addEventListener('click',function(e){
          e.stopPropagation();
          _pickFormat(dest, fmt);
        });
        formatList.appendChild(fbtn);
      });
      card.appendChild(formatList);

      card.addEventListener('click',function(){
        _pickDestination(dest);
      });
      _destGrid.appendChild(card);
    });
  }

  function _pickDestination(dest){
    _chosenDestinationId=dest.id;
    _chosenFormatId=null;
    _destComingSoonMsg.classList.toggle('hidden', !dest.comingSoon);
    _destGrid.querySelectorAll('.publish-destination-card').forEach(function(el){
      const on=el.getAttribute('data-destination-id')===dest.id;
      el.classList.toggle('is-selected', on);
      const formats=el.querySelector('.publish-destination-formats');
      if(formats) formats.classList.toggle('hidden', !on);
      // Clear any previously-picked format highlight when re-entering.
      el.querySelectorAll('.publish-destination-format').forEach(function(f){ f.classList.remove('is-selected'); });
    });
    // Coming-Soon destinations can be selected + read but can't
    // continue — the button stays disabled so the child sees the
    // note without hitting a broken flow.
    _destContinueBtn.disabled=true;
  }
  function _pickFormat(dest, fmt){
    _chosenDestinationId=dest.id;
    _chosenFormatId=fmt.id;
    const card=_destGrid.querySelector('.publish-destination-card[data-destination-id="'+dest.id+'"]');
    if(card){
      card.querySelectorAll('.publish-destination-format').forEach(function(f){
        f.classList.toggle('is-selected', f.getAttribute('data-format-id')===fmt.id);
      });
    }
    // Reel is comingSoon → never lets the child continue in v1.
    _destContinueBtn.disabled=!!dest.comingSoon;
  }
  function _confirmDestination(){
    if(!_chosenDestinationId || !_chosenFormatId) return;
    _setStage(STAGES.PUBLISHING);
  }

  function _renderAlmostCover(){
    if(!_almostCoverCanvas) return;
    const slides=_slides();
    if(slides.length===0) return;
    // Prefer the slide with role=cover; fall back to the first slide.
    let cover=slides.find(function(s){ return s && s.pageType==='cover'; });
    if(!cover) cover=slides[0];
    const editorCanvas=document.getElementById('previewCanvas');
    try{
      SlideRenderer.init(_almostCoverCanvas);
      const titleEl=document.getElementById('bookTitle');
      const payload=SlideRenderer.buildPayload(cover,{
        page:1,
        totalPages:slides.length,
        defaultBookTitle:titleEl?titleEl.value:''
      });
      SlideRenderer.render(payload);
    }catch(e){}
    try{ if(editorCanvas) SlideRenderer.init(editorCanvas); }catch(e){}

    const title=(AppState.project && (AppState.project.bookTitle||AppState.project.title))||'Untitled';
    const author=(AppState.project && AppState.project.author)||'';
    const lines=[title];
    if(author) lines.push('by '+author);
    lines.push(slides.length+' page'+(slides.length===1?'':'s'));
    _almostCoverInfo.innerHTML='';
    lines.forEach(function(t,i){
      const ln=document.createElement('div');
      ln.className=i===0?'publish-almost-cover-title':'publish-almost-cover-meta';
      ln.textContent=t;
      _almostCoverInfo.appendChild(ln);
    });
  }

  function _renderAlmostNudges(nudges){
    _almostNudgeList.innerHTML='';
    nudges.forEach(function(n){
      const card=document.createElement('div');
      card.className='publish-nudge-card';
      const icon=document.createElement('div');
      icon.className='publish-nudge-icon';
      icon.textContent='💡';
      card.appendChild(icon);
      const text=document.createElement('div');
      text.className='publish-nudge-text';
      text.textContent=n.message;
      card.appendChild(text);
      const action=document.createElement('button');
      action.type='button';
      action.className='publish-nudge-fix';
      action.textContent='Fix in Editor';
      action.addEventListener('click',function(){ _fixInEditor(n); });
      card.appendChild(action);
      _almostNudgeList.appendChild(card);
    });
  }

  // "Fix in Editor" — close the studio, jump to the offending slide,
  // and route the right pane to the relevant designer. Friendly, never
  // technical.
  function _fixInEditor(nudge){
    _close();
    if(typeof nudge.slideIndex==='number' && typeof window.showSlide==='function'){
      try{ window.showSlide(nudge.slideIndex); }catch(e){}
    }
    const hint=nudge.fixHint;
    if(hint==='book-title'){
      // The book title rides in the hidden #bookTitle input — focus it
      // by routing to the Story tab where the Page Designer can be
      // edited. Future sprints can surface a dedicated Book Details
      // panel; for now we land the child in a useful spot.
      _activateTab('story');
    }else if(hint==='empty-page' || hint==='text-overflow'){
      _activateTab('story');
    }else if(hint==='low-quality'){
      _activateTab('card');
    }else if(hint==='add-cover'){
      _activateTab('story');
    }
  }
  function _activateTab(name){
    const btn=document.querySelector('.tab-btn[data-tab="'+name+'"]');
    if(btn && !btn.classList.contains('active')) btn.click();
  }
  // --- Stage 3 · Publishing -----------------------------------------
  // Children publish books. Software exports files. Every visible
  // label in this stage uses creative verbs (Painting, Stitching,
  // Wrapping). Cancellation never emits a partial file — the PDF is
  // only assembled at the very end of the loop.
  const PUBLISH_MESSAGES=[
    'Painting your pages…',
    'Adding the finishing touches…',
    'Binding your book…',
    'Wrapping it with care…',
    'Almost ready…'
  ];
  // PDF page size — 7.5" × 9.375" at 144 DPI matches the editor's
  // native 1080×1350 canvas without resampling, so what the child saw
  // in the editor is what lands in the file. (PDF points: 72 per inch.)
  const PDF_PAGE_W_PT=540;
  const PDF_PAGE_H_PT=675;
  const PDF_RENDER_W=1080;
  const PDF_RENDER_H=1350;

  let _pubBody=null;
  let _pubGlyph=null;
  let _pubMessage=null;
  let _pubBar=null;
  let _pubProgressText=null;
  let _pubCancelBtn=null;
  let _publishCancelled=false;
  let _publishOutputBlob=null;

  function _buildPublishingBody(){
    _pubBody=document.createElement('section');
    _pubBody.className='publish-studio-body publish-studio-body-publishing hidden';

    const center=document.createElement('div');
    center.className='publish-publishing-center';

    _pubGlyph=document.createElement('div');
    _pubGlyph.className='publish-publishing-glyph';
    _pubGlyph.textContent='📖✨';
    center.appendChild(_pubGlyph);

    _pubMessage=document.createElement('div');
    _pubMessage.className='publish-publishing-message';
    _pubMessage.textContent='Painting your pages…';
    center.appendChild(_pubMessage);

    const barWrap=document.createElement('div');
    barWrap.className='publish-publishing-barwrap';
    _pubBar=document.createElement('div');
    _pubBar.className='publish-publishing-bar';
    barWrap.appendChild(_pubBar);
    center.appendChild(barWrap);

    _pubProgressText=document.createElement('div');
    _pubProgressText.className='publish-publishing-progress';
    _pubProgressText.textContent='Page 0 of 0';
    center.appendChild(_pubProgressText);

    _pubCancelBtn=document.createElement('button');
    _pubCancelBtn.type='button';
    _pubCancelBtn.className='publish-publishing-cancel';
    _pubCancelBtn.textContent='Cancel';
    _pubCancelBtn.addEventListener('click',function(){
      _publishCancelled=true;
    });
    center.appendChild(_pubCancelBtn);

    _pubBody.appendChild(center);
    return _pubBody;
  }

  // Sprint 9.0.3 — the Publishing stage now dispatches through
  // StoryDestinations. The state machine still runs the same
  // per-page render loop (one page per requestAnimationFrame,
  // cancel checked at every iteration, no partial file emitted),
  // but the render / encode / finalise steps come from the chosen
  // destination so future destinations plug in for free.
  let _publishOutputMeta=null;   // { blob, mime, filename, celebrateLabel, celebrateGlyph }
  let _publishDestination=null;
  let _publishFormat=null;

  function _enterPublishing(){
    _publishCancelled=false;
    _publishOutputBlob=null;
    _publishOutputMeta=null;
    const slides=_slides();
    if(slides.length===0){
      _setStage(STAGES.ALMOST_READY);
      return;
    }
    // Resolve the chosen destination + format. Fallback to Book /
    // Digital PDF if the child somehow skipped the destination
    // picker (backwards-compat with the legacy shell entry).
    if(typeof StoryDestinations==='undefined'){
      _setStage(STAGES.ALMOST_READY);
      return;
    }
    _publishDestination=StoryDestinations.find(_chosenDestinationId)
                     || StoryDestinations.find('book');
    _publishFormat=StoryDestinations.findFormat(
      _publishDestination.id,
      _chosenFormatId
    ) || _publishDestination.formats[0];
    // Reel + any other Coming-Soon destination must not enter
    // Publishing — the destination picker's continue button already
    // guards this, but this second gate keeps the state machine
    // honest.
    if(_publishDestination.comingSoon){
      _setStage(STAGES.DESTINATION);
      return;
    }
    _updateProgress(0, slides.length);
    _pubMessage.textContent=PUBLISH_MESSAGES[0];
    _renderNextPage(0, slides, []);
  }

  function _updateProgress(done, total){
    if(!_pubBar) return;
    const pct=total>0 ? Math.round((done/total)*100) : 0;
    _pubBar.style.width=pct+'%';
    _pubProgressText.textContent='Page '+done+' of '+total;
    // Rotate the playful message based on progress.
    const stage=Math.min(PUBLISH_MESSAGES.length-1,
      Math.floor((done/Math.max(1,total))*PUBLISH_MESSAGES.length));
    _pubMessage.textContent=PUBLISH_MESSAGES[stage];
  }

  function _renderNextPage(idx, slides, payloads){
    if(_publishCancelled){
      // Aborted. No file ever emitted; just bounce back to Almost
      // Ready — cancel-honesty is a locked product principle.
      _setStage(STAGES.ALMOST_READY);
      return;
    }
    if(idx>=slides.length){
      _finalizePublish(payloads);
      return;
    }
    // Render this slide through the chosen destination.
    const slide=slides[idx];
    const off=_publishDestination.createCanvas(_publishFormat);
    const ctx={index:idx, total:slides.length, format:_publishFormat};
    try{
      _publishDestination.renderPage(off, slide, ctx);
      const payload=_publishDestination.encodePage(off, _publishFormat, ctx);
      if(payload) payloads.push(payload);
    }catch(e){}

    _updateProgress(idx+1, slides.length);

    // Yield to the next frame so the bar / message can paint.
    requestAnimationFrame(function(){
      _renderNextPage(idx+1, slides, payloads);
    });
  }

  function _finalizePublish(payloads){
    if(_publishCancelled){
      _setStage(STAGES.ALMOST_READY);
      return;
    }
    let out=null;
    try{
      out=_publishDestination.finish(payloads, _publishFormat);
    }catch(e){ out=null; }
    _publishOutputMeta=out;
    _publishOutputBlob=out ? out.blob : null;
    _setStage(STAGES.CELEBRATION);
  }

  function _publishedBlob(){ return _publishOutputBlob; }
  function _publishedFilename(){
    if(_publishOutputMeta && _publishOutputMeta.filename) return _publishOutputMeta.filename;
    const t=(AppState.project && (AppState.project.bookTitle||AppState.project.title))||'my-story';
    const safe=String(t).replace(/[^a-z0-9_\-]+/gi,'_').replace(/^_+|_+$/g,'')||'my-story';
    return safe+'.pdf';
  }
  function _downloadPublished(){
    if(!_publishOutputBlob) return false;
    const url=URL.createObjectURL(_publishOutputBlob);
    const a=document.createElement('a');
    a.href=url;
    a.download=_publishedFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    return true;
  }
  // --- Stage 4 · Celebration ----------------------------------------
  // The five-second emotional payoff. Confetti rains, the cover sits
  // on a CSS-perspective-tilted card, and a single primary 📖 Get My
  // Book button hands the child their finished work. Nothing
  // auto-closes; the child stays in the moment until they leave.
  let _celebBody=null;
  let _celebConfetti=null;
  let _celebCoverCanvas=null;
  let _celebTitle=null;
  let _celebSubtitle=null;
  let _celebDownloadBtn=null;
  let _celebReadyMsg=null;

  function _buildCelebrationBody(){
    _celebBody=document.createElement('section');
    _celebBody.className='publish-studio-body publish-studio-body-celebration hidden';

    // Confetti layer.
    _celebConfetti=document.createElement('div');
    _celebConfetti.className='publish-confetti';
    _celebBody.appendChild(_celebConfetti);

    const center=document.createElement('div');
    center.className='publish-celebration-center';

    const headline=document.createElement('div');
    headline.className='publish-celebration-headline';
    headline.innerHTML='<span class="publish-celebration-emoji">🎉</span> Congratulations!';
    center.appendChild(headline);

    // Sprint 9.0.5 — destination-aware message. The generic
    // "Your story is now a real book!" reads wrong when the child
    // chose Carousel; every destination gets its own celebratory
    // line resolved in _enterCelebration().
    const message=document.createElement('div');
    message.className='publish-celebration-message publish-celebration-message-generic';
    message.textContent='Your story is now a real book!';
    center.appendChild(message);

    // 3D-tilted cover.
    const stand=document.createElement('div');
    stand.className='publish-celebration-stand';
    const book=document.createElement('div');
    book.className='publish-celebration-book';
    _celebCoverCanvas=document.createElement('canvas');
    _celebCoverCanvas.width=1080;
    _celebCoverCanvas.height=1350;
    _celebCoverCanvas.className='publish-celebration-cover';
    book.appendChild(_celebCoverCanvas);
    stand.appendChild(book);
    center.appendChild(stand);

    _celebTitle=document.createElement('div');
    _celebTitle.className='publish-celebration-title';
    center.appendChild(_celebTitle);

    _celebSubtitle=document.createElement('div');
    _celebSubtitle.className='publish-celebration-subtitle';
    center.appendChild(_celebSubtitle);

    // Primary action.
    _celebDownloadBtn=document.createElement('button');
    _celebDownloadBtn.type='button';
    _celebDownloadBtn.className='publish-celebration-download';
    _celebDownloadBtn.innerHTML='<span class="publish-celebration-download-glyph">📥</span><span>Get My Book</span>';
    _celebDownloadBtn.addEventListener('click',function(){
      const ok=_downloadPublished();
      if(ok){
        _celebReadyMsg.classList.remove('hidden');
        _celebDownloadBtn.classList.add('is-given');
      }
    });
    center.appendChild(_celebDownloadBtn);

    _celebReadyMsg=document.createElement('div');
    _celebReadyMsg.className='publish-celebration-ready hidden';
    _celebReadyMsg.innerHTML='<span>✓</span> Your book is ready. Download again any time.';
    center.appendChild(_celebReadyMsg);

    // Secondary actions.
    const secondary=document.createElement('div');
    secondary.className='publish-celebration-secondary';
    const keep=document.createElement('button');
    keep.type='button';
    keep.className='publish-celebration-secondary-btn';
    keep.innerHTML='<span>✏️</span> Keep Editing';
    keep.addEventListener('click',function(){ _close(); });
    secondary.appendChild(keep);
    const another=document.createElement('button');
    another.type='button';
    another.className='publish-celebration-secondary-btn';
    another.innerHTML='<span>📖</span> Make Another Story';
    another.addEventListener('click',function(){ _makeAnotherStory(); });
    secondary.appendChild(another);
    center.appendChild(secondary);

    _celebBody.appendChild(center);
    return _celebBody;
  }

  function _enterCelebration(){
    if(!_celebBody) return;
    // Reset between celebrations.
    _celebReadyMsg.classList.add('hidden');
    _celebDownloadBtn.classList.remove('is-given');

    // Sprint 9.0.3 — destination-aware Celebration copy. Story Book →
    // "Get My Book". Story Carousel → "Download Images" (or
    // "Download Image" for single-page). The blob + filename came
    // through _publishOutputMeta; the label + glyph are the same
    // metadata the destination emitted from `finish()`.
    const dest=_publishDestination;
    const label=(_publishOutputMeta && _publishOutputMeta.celebrateLabel)
              || (dest && dest.formats && 'Get My Story')
              || 'Get My Story';
    const glyph=(_publishOutputMeta && _publishOutputMeta.celebrateGlyph) || '📥';
    _celebDownloadBtn.innerHTML='<span class="publish-celebration-download-glyph">'+glyph+'</span><span>'+label+'</span>';
    // Sprint 9.0.5 — destination-aware headline message. Reads
    // right for every destination without polluting the shell
    // with per-destination branches.
    const msgEl=_celebBody.querySelector('.publish-celebration-message-generic');
    if(msgEl){
      if(dest && dest.id==='carousel'){
        msgEl.textContent='Your story is now a shareable carousel!';
      }else if(dest && dest.id==='book'){
        msgEl.textContent='Your story is now a real book!';
      }else{
        msgEl.textContent='Your story is ready!';
      }
    }
    // Ready-message language matches the destination too.
    const readyGlyph='<span>✓</span> ';
    const readyMsg=(dest && dest.id==='carousel')
      ? readyGlyph+'Your images are ready. Download again any time.'
      : readyGlyph+'Your book is ready. Download again any time.';
    _celebReadyMsg.innerHTML=readyMsg;

    // Spawn confetti — DOM nodes with CSS keyframes. ~60 particles is
    // enough to feel celebratory without taxing the GPU.
    _celebConfetti.innerHTML='';
    const COLORS=['#FFCB45','#FF6B6B','#4ECDC4','#7B61FF','#FFE17A','#FF8FA3'];
    for(let i=0;i<60;i++){
      const p=document.createElement('span');
      p.className='publish-confetti-particle';
      p.style.background=COLORS[i%COLORS.length];
      p.style.left=Math.random()*100+'%';
      p.style.animationDelay=(Math.random()*1.6).toFixed(2)+'s';
      p.style.animationDuration=(2.5+Math.random()*1.8).toFixed(2)+'s';
      p.style.transform='rotate('+Math.floor(Math.random()*360)+'deg)';
      _celebConfetti.appendChild(p);
    }

    // Render the cover into the celebration canvas via the canonical
    // path — children see their real book on the celebration screen.
    const slides=_slides();
    if(slides.length>0){
      let cover=slides.find(function(s){ return s && s.pageType==='cover'; });
      if(!cover) cover=slides[0];
      const editorCanvas=document.getElementById('previewCanvas');
      try{
        SlideRenderer.init(_celebCoverCanvas);
        const titleEl=document.getElementById('bookTitle');
        const payload=SlideRenderer.buildPayload(cover,{
          page:1,
          totalPages:slides.length,
          defaultBookTitle:titleEl?titleEl.value:''
        });
        SlideRenderer.render(payload);
      }catch(e){}
      try{ if(editorCanvas) SlideRenderer.init(editorCanvas); }catch(e){}
    }

    // Title + author readout.
    const title=(AppState.project && (AppState.project.bookTitle||AppState.project.title))||'My Story';
    const author=(AppState.project && AppState.project.author)||'';
    _celebTitle.textContent=title;
    _celebSubtitle.textContent=author ? 'by '+author : '';
  }

  function _makeAnotherStory(){
    // Confirmation — never lose progress without a clear yes.
    const ok=window.confirm('Start a brand-new story? Your current book is already published — this will give you a fresh page to begin.');
    if(!ok) return;
    // Reset the project to a clean slate.
    try{
      if(typeof AppState!=='undefined'){
        AppState.slides=[];
        AppState.currentSlide=0;
        if(AppState.project){
          AppState.project.bookTitle='';
          AppState.project.title='';
          AppState.project.author='';
        }
      }
      if(typeof ProjectManager!=='undefined' && typeof ProjectManager.discardSession==='function'){
        ProjectManager.discardSession();
      }
      // Soft reload — the simplest path back to a true clean slate.
      window.location.reload();
    }catch(e){
      _close();
    }
  }

  // -------- Stage state machine -------------------------------------
  function _setStage(next){
    if(!_modal) return;
    _state.stage=next;
    Object.keys(_bodies).forEach(function(k){
      _bodies[k].classList.toggle('hidden', k!==next);
    });
    if(next===STAGES.READ) _enterRead();
    else if(next===STAGES.ALMOST_READY) _enterAlmostReady();
    else if(next===STAGES.DESTINATION) _enterDestination();
    else if(next===STAGES.PUBLISHING) _enterPublishing();
    else if(next===STAGES.CELEBRATION) _enterCelebration();
  }

  // -------- Lifecycle ------------------------------------------------
  // Sprint 9.1.4 — Publish This Page support. `open({slides:[slide]})`
  // publishes a single-page slice. The scope stays live inside the
  // studio via _slides(); every stage that reads AppState.slides now
  // reads _slides() so the single-page loop reuses the full pipeline
  // (Read → Almost Ready → Destination → Publishing → Celebration)
  // without duplication.
  let _slidesOverride=null;
  function _slides(){
    if(Array.isArray(_slidesOverride) && _slidesOverride.length>0) return _slidesOverride;
    return (typeof AppState!=='undefined' && Array.isArray(AppState.slides)) ? AppState.slides : [];
  }
  function open(opts){
    _ensureModal();
    if(opts && Array.isArray(opts.slides) && opts.slides.length>0){
      _slidesOverride=opts.slides.slice();
    }else{
      _slidesOverride=null;
    }
    if(!_hasSlides()){
      // Nothing to publish yet. Nudge inside the editor — Sprint 8.1.1
      // keeps the studio's empty-state simple while the rest of the
      // stages light up.
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
    return _slides().length>0;
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
    _setStage:_setStage,
    _publishedBlob:_publishedBlob,
    _publishedFilename:_publishedFilename,
    _downloadPublished:_downloadPublished
  };
  try{ window.PublishStudio=api; }catch(e){}
  return api;
})();
