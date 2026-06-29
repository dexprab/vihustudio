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

    // Story Text
    const stLabel=document.createElement('label');
    stLabel.className='story-field-label';
    stLabel.textContent='Story Text';
    root.appendChild(stLabel);
    const storyText=document.createElement('textarea');
    storyText.className='story-text-input input-field textarea';
    storyText.rows=4;
    storyText.placeholder='What happens on this page?';
    storyText.addEventListener('input',function(){
      if(suppressInput) return;
      // Sync to the legacy hidden #storyBeat so the existing app.js draw
      // and markDirty listeners fire — keeps the data plumbing untouched.
      _syncHidden('storyBeat',storyText.value,true);
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

    // Actions
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
