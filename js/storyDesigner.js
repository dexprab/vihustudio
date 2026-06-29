// StoryDesigner — owns slide CONTENT only (Story Text, Footer, Handle, Page
// Number, Page Type). Visual presentation stays in CardDesigner / ThemeEngine.
// Sprint 5.0: foundation module with mount / configure / refresh /
// focusField API. The shape mirrors CardDesigner so future AI-assisted
// writing features can attach via the same host-callback contract.
const StoryDesigner=(function(){
  const PAGE_TYPES=[
    {value:'story',label:'Story'},
    {value:'cover',label:'Cover'},
    {value:'cta',label:'CTA'},
    {value:'blank',label:'Blank'}
  ];
  const DEFAULT_HANDLE='@vihuplanet';

  let mountedContainer=null;
  let mountedRoot=null;
  let host=null;
  // Suppress per-input listeners during programmatic refresh so syncing UI
  // values from the model never triggers another redraw/markDirty cycle.
  let suppressInput=false;

  function _currentSlide(){
    if(!host||typeof host.getCurrentSlide!=='function') return null;
    try{ return host.getCurrentSlide(); }catch(e){ return null; }
  }

  function _projectBookTitle(){
    if(typeof AppState==='undefined' || !AppState.project) return '';
    return AppState.project.bookTitle||'';
  }

  function _syncHidden(id,value,fireInput){
    const el=document.getElementById(id);
    if(!el) return;
    if(el.value!==value){
      el.value=value;
      if(fireInput){
        try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
      }
    }
  }

  function _commitContent(){
    const s=_currentSlide();
    if(s) delete s.thumbnail;
    if(host){
      if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
      if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    }
  }

  function _buildContent(root){
    const intro=document.createElement('p');
    intro.className='story-intro';
    intro.textContent='Edit page content. Visual styling lives in the Card Designer.';
    root.appendChild(intro);

    // Story Text — Sprint 5.1 adds stats chips + overflow chip + expand btn.
    const stHeader=document.createElement('div');
    stHeader.className='story-text-header';
    const stLabel=document.createElement('label');
    stLabel.className='story-field-label';
    stLabel.textContent='Story Text';
    stHeader.appendChild(stLabel);
    const expandBtn=document.createElement('button');
    expandBtn.type='button';
    expandBtn.className='story-expand-btn';
    expandBtn.title='Open expanded editor';
    expandBtn.textContent='⛶';
    expandBtn.addEventListener('click',_openExpandedEditor);
    stHeader.appendChild(expandBtn);
    root.appendChild(stHeader);

    const statsRow=document.createElement('div');
    statsRow.className='story-stats-row';
    statsRow.innerHTML='<span class="stat-chip">Chars <span class="story-char-count">0</span></span>'+
      '<span class="stat-chip">Words <span class="story-word-count">0</span></span>'+
      '<span class="stat-chip story-overflow-chip" id="storyOverflowChip">✅ Fits</span>';
    root.appendChild(statsRow);

    const storyText=document.createElement('textarea');
    storyText.className='story-text-input input-field textarea';
    storyText.rows=4;
    storyText.placeholder='What happens on this page?';
    storyText.addEventListener('input',function(){
      if(suppressInput) return;
      _syncHidden('storyBeat',storyText.value,true);
      _refreshStats(storyText.value);
      _refreshValidation();
      _refreshExpandedEditor();
    });
    root.appendChild(storyText);

    // Footer
    const ftLabel=document.createElement('label');
    ftLabel.className='story-field-label';
    ftLabel.textContent='Footer';
    root.appendChild(ftLabel);
    const footer=document.createElement('input');
    footer.type='text';
    footer.className='story-footer-input input-field';
    footer.placeholder='Footer text (defaults to book title)';
    footer.addEventListener('input',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      if(!s.metadata) s.metadata={};
      s.metadata.footerText=footer.value;
      _commitContent();
    });
    root.appendChild(footer);

    // Handle
    const hLabel=document.createElement('label');
    hLabel.className='story-field-label';
    hLabel.textContent='Handle';
    root.appendChild(hLabel);
    const handle=document.createElement('input');
    handle.type='text';
    handle.className='story-handle-input input-field';
    handle.placeholder=DEFAULT_HANDLE;
    handle.addEventListener('input',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      if(!s.metadata) s.metadata={};
      s.metadata.handle=handle.value;
      _commitContent();
    });
    root.appendChild(handle);

    // Page Number + Page Type on one row
    const row=document.createElement('div');
    row.className='story-row-2';
    const pCell=document.createElement('div');
    pCell.className='story-cell';
    const pLabel=document.createElement('label');
    pLabel.className='story-field-label';
    pLabel.textContent='Page Number';
    pCell.appendChild(pLabel);
    const pageInput=document.createElement('input');
    pageInput.type='text';
    pageInput.className='story-page-input input-field';
    pageInput.addEventListener('input',function(){
      if(suppressInput) return;
      // Route through #pageNumber so existing draw + markDirty hooks fire.
      _syncHidden('pageNumber',pageInput.value,true);
    });
    pCell.appendChild(pageInput);
    row.appendChild(pCell);
    const tCell=document.createElement('div');
    tCell.className='story-cell';
    const tLabel=document.createElement('label');
    tLabel.className='story-field-label';
    tLabel.textContent='Page Type';
    tCell.appendChild(tLabel);
    const typeSel=document.createElement('select');
    typeSel.className='story-pagetype-select input-field';
    PAGE_TYPES.forEach(function(p){
      const opt=document.createElement('option');
      opt.value=p.value; opt.textContent=p.label;
      typeSel.appendChild(opt);
    });
    typeSel.addEventListener('change',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      s.pageType=typeSel.value;
      _commitContent();
    });
    tCell.appendChild(typeSel);
    row.appendChild(tCell);
    root.appendChild(row);

    // --- Review (collapsible, Sprint 5.1) ----------------------------
    const reviewBody=_makeStorySubgroup(root,'review','Review');
    [
      ['review-empty','Empty story'],
      ['review-overflow','Story overflow'],
      ['review-missing-image','Missing image'],
      ['review-missing-footer','Missing footer'],
      ['review-missing-handle','Missing handle']
    ].forEach(function(pair){
      const item=document.createElement('div');
      item.className='story-review-item';
      item.setAttribute('data-review-id',pair[0]);
      item.innerHTML='<span class="story-review-icon">✅</span><span class="story-review-label">'+pair[1]+'</span>';
      reviewBody.appendChild(item);
    });

    // --- Search (collapsible, Sprint 5.1) ----------------------------
    const searchBody=_makeStorySubgroup(root,'search','Search');
    const findLabel=document.createElement('label');
    findLabel.className='story-field-label';
    findLabel.textContent='Find';
    searchBody.appendChild(findLabel);
    const findInput=document.createElement('input');
    findInput.type='text';
    findInput.className='story-find-input input-field';
    findInput.placeholder='Find within current story';
    searchBody.appendChild(findInput);
    const findStatus=document.createElement('div');
    findStatus.className='story-find-status';
    findStatus.textContent='0 matches';
    searchBody.appendChild(findStatus);
    const repLabel=document.createElement('label');
    repLabel.className='story-field-label';
    repLabel.textContent='Replace with';
    searchBody.appendChild(repLabel);
    const repInput=document.createElement('input');
    repInput.type='text';
    repInput.className='story-replace-input input-field';
    repInput.placeholder='Replacement text';
    searchBody.appendChild(repInput);
    const replaceBtn=document.createElement('button');
    replaceBtn.type='button';
    replaceBtn.className='story-replace-btn story-op-btn';
    replaceBtn.textContent='Replace All';
    replaceBtn.addEventListener('click',function(){
      _replaceAll(findInput.value,repInput.value);
    });
    searchBody.appendChild(replaceBtn);
    findInput.addEventListener('input',function(){ _refreshFind(); });

    // --- Story Operations (collapsible, Sprint 5.1) ------------------
    const opsBody=_makeStorySubgroup(root,'operations','Story Operations');
    [
      ['Duplicate Page', _duplicatePage],
      ['Split Page', _splitPage],
      ['Merge with Next Page', _mergeWithNext],
      ['Move Selected Text → Next Page', _moveSelectedToNext],
      ['Clear Story', _clearStory],
      ['Copy Story', _copyStory],
      ['Paste Story', _pasteStory]
    ].forEach(function(pair){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='story-op-btn';
      btn.textContent=pair[0];
      btn.addEventListener('click',pair[1]);
      opsBody.appendChild(btn);
    });

    // --- Actions -----------------------------------------------------
    const actionsLabel=document.createElement('div');
    actionsLabel.className='designer-sublabel';
    actionsLabel.textContent='Actions';
    root.appendChild(actionsLabel);

    const resetBtn=document.createElement('button');
    resetBtn.type='button';
    resetBtn.className='story-reset-btn';
    resetBtn.textContent='↺ Reset Story';
    resetBtn.addEventListener('click',_resetStory);
    root.appendChild(resetBtn);

    const applyBtn=document.createElement('button');
    applyBtn.type='button';
    applyBtn.className='story-apply-btn';
    applyBtn.textContent='Apply to Selected Pages';
    applyBtn.disabled=true;
    applyBtn.title='Coming in a future sprint';
    root.appendChild(applyBtn);
  }

  // Reuses the .image-subgroup collapse pattern so behavior matches the
  // Card Designer's Composition / Light / Color subgroups.
  function _makeStorySubgroup(parent,id,title){
    const sub=document.createElement('div');
    sub.className='image-subgroup story-subgroup';
    sub.setAttribute('data-story-group',id);
    const header=document.createElement('button');
    header.type='button';
    header.className='image-subgroup-title';
    header.setAttribute('aria-expanded','true');
    header.setAttribute('data-collapsible-toggle','');
    const t=document.createElement('span');
    t.className='image-subgroup-title-text';
    t.textContent=title;
    header.appendChild(t);
    const chev=document.createElement('span');
    chev.className='designer-group-chevron';
    chev.setAttribute('aria-hidden','true');
    chev.textContent='▾';
    header.appendChild(chev);
    sub.appendChild(header);
    header.addEventListener('click',function(){
      const collapsed=sub.classList.toggle('collapsed');
      header.setAttribute('aria-expanded',collapsed?'false':'true');
    });
    const body=document.createElement('div');
    body.className='image-subgroup-body';
    sub.appendChild(body);
    parent.appendChild(sub);
    return body;
  }

  // --- Stats / overflow ---------------------------------------------
  function _countWords(text){
    if(!text) return 0;
    const m=text.trim().match(/\S+/g);
    return m?m.length:0;
  }

  function _refreshStats(text){
    if(!mountedRoot) return;
    const t=(typeof text==='string')?text:((mountedRoot.querySelector('.story-text-input')||{}).value||'');
    const c=mountedRoot.querySelector('.story-char-count');
    const w=mountedRoot.querySelector('.story-word-count');
    if(c) c.textContent=String(t.length);
    if(w) w.textContent=String(_countWords(t));
    const ec=document.querySelector('.expand-char-count');
    const ew=document.querySelector('.expand-word-count');
    if(ec) ec.textContent=String(t.length);
    if(ew) ew.textContent=String(_countWords(t));
  }

  // Reads the renderer's last text-element list — the renderer is the
  // source of truth for layout / overflow.
  function _renderedStoryElement(){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getTextElements!=='function') return null;
    try{
      const els=SlideRenderer.getTextElements();
      return els.find(function(e){ return e.id==='story-text'; }) || null;
    }catch(e){ return null; }
  }

  function _refreshOverflowChip(){
    const rendered=_renderedStoryElement();
    const overflows=!!(rendered && rendered.overflow);
    const chip=mountedRoot && mountedRoot.querySelector('.story-overflow-chip');
    if(chip){
      chip.textContent=overflows?'⚠ Overflow':'✅ Fits';
      chip.classList.toggle('chip-warn',overflows);
    }
    const expandChip=document.getElementById('expandOverflowChip');
    if(expandChip){
      expandChip.textContent=overflows?'⚠ Story exceeds available space':'✅ Fits on Page';
      expandChip.classList.toggle('chip-warn',overflows);
    }
  }

  // --- Validation indicators ----------------------------------------
  function _refreshValidation(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const rendered=_renderedStoryElement();
    const checks={
      'review-empty': !(s && s.storyBeat && s.storyBeat.trim().length>0),
      'review-overflow': !!(rendered && rendered.overflow),
      'review-missing-image': !!(s && s.pageType!=='blank' && !s.image),
      'review-missing-footer': !(s && (
        (s.metadata && typeof s.metadata.footerText==='string' && s.metadata.footerText.length>0)
        || _projectBookTitle().length>0
      )),
      'review-missing-handle': !(s && s.metadata && typeof s.metadata.handle==='string' && s.metadata.handle.length>0) && false
        // Handle defaults to @vihuplanet — only count as missing when
        // explicitly cleared. The boolean above is therefore always false
        // unless the user has typed an empty string; preserved as the
        // canonical hook for that future check.
    };
    Object.keys(checks).forEach(function(id){
      const item=mountedRoot.querySelector('[data-review-id="'+id+'"]');
      if(!item) return;
      const bad=checks[id];
      const icon=item.querySelector('.story-review-icon');
      if(icon) icon.textContent=bad?'⚠':'✅';
      item.classList.toggle('review-warn',bad);
    });
    _refreshOverflowChip();
  }

  function _refreshFind(){
    if(!mountedRoot) return;
    const findEl=mountedRoot.querySelector('.story-find-input');
    const statusEl=mountedRoot.querySelector('.story-find-status');
    if(!findEl||!statusEl) return;
    const s=_currentSlide();
    const text=(s&&s.storyBeat)||'';
    const needle=findEl.value;
    if(!needle){ statusEl.textContent='0 matches'; return; }
    const re=new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    const matches=text.match(re);
    statusEl.textContent=(matches?matches.length:0)+' match'+((matches&&matches.length===1)?'':'es');
  }

  function _replaceAll(needle,replacement){
    if(!needle) return;
    const s=_currentSlide();
    if(!s) return;
    const re=new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
    const updated=(s.storyBeat||'').replace(re,replacement||'');
    _setStoryText(updated);
    _refreshFind();
  }

  // --- Story operations ---------------------------------------------
  function _duplicatePage(){
    if(typeof PageOps==='undefined') return;
    PageOps.duplicatePage(AppState.currentSlide);
  }
  function _splitPage(){
    if(typeof PageOps==='undefined') return;
    const ta=mountedRoot && mountedRoot.querySelector('.story-text-input');
    const text=(ta && ta.value) || '';
    const cursor=(ta && typeof ta.selectionStart==='number') ? ta.selectionStart : Math.floor(text.length/2);
    PageOps.splitPage(AppState.currentSlide,text.slice(0,cursor),text.slice(cursor));
  }
  function _mergeWithNext(){
    if(typeof PageOps==='undefined') return;
    PageOps.mergeWithNext(AppState.currentSlide);
  }
  function _moveSelectedToNext(){
    const ta=mountedRoot && mountedRoot.querySelector('.story-text-input');
    if(!ta) return;
    const start=ta.selectionStart, end=ta.selectionEnd;
    if(start===end) return;
    const original=ta.value;
    const selected=original.slice(start,end);
    if(!selected) return;
    const remaining=original.slice(0,start)+original.slice(end);
    // Apply remaining to current slide first.
    _setStoryText(remaining);
    // Ensure a next page exists.
    if(AppState.currentSlide+1>=AppState.slides.length){
      if(typeof PageOps==='undefined') return;
      PageOps.addAfter(AppState.currentSlide);
    }
    const nextIdx=AppState.currentSlide+1;
    const next=AppState.slides[nextIdx];
    if(!next) return;
    next.storyBeat=selected + (next.storyBeat?'\n\n'+next.storyBeat:'');
    delete next.thumbnail;
    if(host&&typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    if(typeof window.showSlide==='function') window.showSlide(nextIdx);
  }
  function _clearStory(){
    _setStoryText('');
  }
  function _copyStory(){
    const s=_currentSlide();
    const text=(s&&s.storyBeat)||'';
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).catch(function(){});
    }
  }
  function _pasteStory(){
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){ _setStoryText(t||''); }).catch(function(){});
    }
  }

  // --- Story text setter (single source for stats refresh + sync) ---
  function _setStoryText(value){
    const s=_currentSlide();
    if(s) s.storyBeat=value;
    _syncHidden('storyBeat',value,true);
    const ta=mountedRoot && mountedRoot.querySelector('.story-text-input');
    if(ta && ta.value!==value){ suppressInput=true; ta.value=value; suppressInput=false; }
    const exTa=document.getElementById('storyExpandTextarea');
    if(exTa && exTa.value!==value){ exTa.value=value; }
    _refreshStats(value);
    _refreshValidation();
    _refreshFind();
  }

  // --- Expanded editor ----------------------------------------------
  function _openExpandedEditor(){
    const modal=document.getElementById('storyExpandModal');
    const ta=document.getElementById('storyExpandTextarea');
    const s=_currentSlide();
    if(!modal||!ta) return;
    ta.value=(s&&s.storyBeat)||'';
    modal.classList.remove('hidden');
    setTimeout(function(){ ta.focus(); },0);
    _refreshStats(ta.value);
    _refreshOverflowChip();
  }
  function _closeExpandedEditor(){
    const modal=document.getElementById('storyExpandModal');
    if(modal) modal.classList.add('hidden');
  }
  function _refreshExpandedEditor(){
    const exTa=document.getElementById('storyExpandTextarea');
    if(!exTa) return;
    const s=_currentSlide();
    const v=(s&&s.storyBeat)||'';
    if(exTa.value!==v) exTa.value=v;
  }

  // Wire the modal once — safe to call multiple times; the second mount
  // detects an already-bound modal via the data attribute.
  function _wireExpandedEditor(){
    const modal=document.getElementById('storyExpandModal');
    const ta=document.getElementById('storyExpandTextarea');
    const closeBtn=document.getElementById('storyExpandClose');
    if(!modal||modal.getAttribute('data-wired')==='1') return;
    modal.setAttribute('data-wired','1');
    if(ta){
      ta.addEventListener('input',function(){
        _setStoryText(ta.value);
      });
    }
    if(closeBtn){ closeBtn.addEventListener('click',_closeExpandedEditor); }
    modal.addEventListener('click',function(e){ if(e.target===modal) _closeExpandedEditor(); });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape' && !modal.classList.contains('hidden')) _closeExpandedEditor();
    });
  }

  function _resetStory(){
    const s=_currentSlide();
    if(!s) return;
    s.storyBeat='';
    if(s.metadata){
      delete s.metadata.footerText;
      delete s.metadata.handle;
    }
    s.pageType='story';
    // Push the cleared values out to the hidden plumbing so #storyBeat
    // matches before draw() reads from it.
    _syncHidden('storyBeat','',true);
    _commitContent();
    _refresh();
  }

  // Sync the visible Story Designer inputs from the current slide. Called
  // from app.js whenever the active slide changes or a hidden plumbing
  // value changes (e.g. via PageOps page renumbering).
  function _refresh(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const storyText=mountedRoot.querySelector('.story-text-input');
    const footer=mountedRoot.querySelector('.story-footer-input');
    const handle=mountedRoot.querySelector('.story-handle-input');
    const pageInput=mountedRoot.querySelector('.story-page-input');
    const typeSel=mountedRoot.querySelector('.story-pagetype-select');

    suppressInput=true;
    try{
      if(storyText) storyText.value=(s && s.storyBeat) || '';
      if(footer){
        const ft=(s && s.metadata && typeof s.metadata.footerText==='string')
          ? s.metadata.footerText
          : _projectBookTitle();
        footer.value=ft;
      }
      if(handle){
        const hv=(s && s.metadata && typeof s.metadata.handle==='string')
          ? s.metadata.handle
          : DEFAULT_HANDLE;
        handle.value=hv;
      }
      if(pageInput) pageInput.value=s ? String(s.page||'') : '';
      if(typeSel) typeSel.value=s ? (s.pageType||'story') : 'story';
    }finally{
      suppressInput=false;
    }
    // Sprint 5.1 — keep stats / validation / search / expanded editor in sync.
    _refreshStats();
    _refreshValidation();
    _refreshFind();
    _refreshExpandedEditor();
  }

  // Selection sync hook — called when CardDesigner has a text element
  // selected and the user switches to the Story tab. Focuses the
  // corresponding content field (and selects its text where applicable).
  function focusField(elementId){
    if(!mountedRoot) return;
    const map={
      'story-text':'.story-text-input',
      'footer':'.story-footer-input',
      'handle':'.story-handle-input',
      'page-number':'.story-page-input'
    };
    const sel=map[elementId];
    if(!sel) return;
    const el=mountedRoot.querySelector(sel);
    if(el && typeof el.focus==='function'){
      try{ el.focus(); if(typeof el.select==='function') el.select(); }catch(e){}
    }
  }

  function mount(container){
    if(!container) return null;
    if(container.__storyDesignerRoot){
      mountedContainer=container;
      mountedRoot=container.__storyDesignerRoot;
      _wireExpandedEditor();
      _refresh();
      return mountedRoot;
    }
    container.innerHTML='';
    const root=document.createElement('div');
    root.className='story-designer';
    _buildContent(root);
    container.appendChild(root);
    container.__storyDesignerRoot=root;
    mountedContainer=container;
    mountedRoot=root;
    _wireExpandedEditor();
    _refresh();
    return root;
  }

  function unmount(container){
    if(!container) return;
    container.innerHTML='';
    delete container.__storyDesignerRoot;
    if(mountedContainer===container){
      mountedContainer=null;
      mountedRoot=null;
    }
  }

  function configure(cfg){
    host=cfg||null;
    _refresh();
  }

  function refresh(){ _refresh(); }

  const api={
    PAGE_TYPES:PAGE_TYPES,
    DEFAULT_HANDLE:DEFAULT_HANDLE,
    mount:mount,
    unmount:unmount,
    configure:configure,
    refresh:refresh,
    focusField:focusField
  };
  try{ window.StoryDesigner=api; }catch(e){}
  return api;
})();
