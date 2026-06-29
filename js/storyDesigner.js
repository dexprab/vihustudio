// StoryDesigner — owns slide CONTENT only.
// Sprint 5.0: foundation (Story Text, Footer, Handle, Page Number, Page Type).
// Sprint 5.1: stats + overflow chips, expanded editor modal, Review / Search /
//             Operations sub-groups.
// Sprint 5.2: simplified to the Vihaan-first layout — Story Beat + inline
//             char/word counts + conditional overflow warning + Footer +
//             Handle + Page Type. Review / Search / Operations / Expanded
//             Editor / modal / Page Number / Reset Story / Apply buttons all
//             removed from the UI. The PageOps operation methods (Split /
//             Merge / Duplicate) remain available on `window.PageOps` for
//             future use. Host contract (`mount`/`configure`/`refresh`/
//             `focusField`) is unchanged so app.js wiring stays untouched.
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

  function _countWords(text){
    if(!text) return 0;
    const m=text.trim().match(/\S+/g);
    return m?m.length:0;
  }

  // Reads the renderer's last text-element list — the renderer is the
  // source of truth for layout / overflow. The Story Designer never
  // duplicates layout math.
  function _renderedStoryElement(){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getTextElements!=='function') return null;
    try{
      const els=SlideRenderer.getTextElements();
      return els.find(function(e){ return e.id==='story-text'; }) || null;
    }catch(e){ return null; }
  }

  function _refreshIndicators(){
    if(!mountedRoot) return;
    const ta=mountedRoot.querySelector('.story-text-input');
    const text=ta ? ta.value : '';
    const charEl=mountedRoot.querySelector('.story-char-count');
    const wordEl=mountedRoot.querySelector('.story-word-count');
    if(charEl) charEl.textContent=String(text.length);
    if(wordEl) wordEl.textContent=String(_countWords(text));
    const warning=mountedRoot.querySelector('.story-overflow-warning');
    if(warning){
      const rendered=_renderedStoryElement();
      const overflows=!!(rendered && rendered.overflow);
      warning.classList.toggle('hidden',!overflows);
    }
  }

  function _buildContent(root){
    // Story Beat
    const stLabel=document.createElement('label');
    stLabel.className='story-field-label';
    stLabel.textContent='Story Beat';
    root.appendChild(stLabel);

    const storyText=document.createElement('textarea');
    storyText.className='story-text-input input-field textarea';
    storyText.rows=4;
    storyText.placeholder='What happens on this page?';
    storyText.addEventListener('input',function(){
      if(suppressInput) return;
      // Route through the legacy hidden #storyBeat so the existing app.js
      // draw + markDirty listeners fire — keeps the data plumbing untouched.
      _syncHidden('storyBeat',storyText.value,true);
      _refreshIndicators();
    });
    root.appendChild(storyText);

    // Inline stats — Characters / Words on their own lines
    const stats=document.createElement('div');
    stats.className='story-stats-inline';
    stats.innerHTML='<div>Characters: <strong class="story-char-count">0</strong></div>'+
      '<div>Words: <strong class="story-word-count">0</strong></div>';
    root.appendChild(stats);

    // Overflow warning — only shown when applicable
    const warning=document.createElement('div');
    warning.className='story-overflow-warning hidden';
    warning.textContent='⚠ Story may not fit on this page.';
    root.appendChild(warning);

    const divider=document.createElement('hr');
    divider.className='story-divider';
    root.appendChild(divider);

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

    // Page Type
    const tLabel=document.createElement('label');
    tLabel.className='story-field-label';
    tLabel.textContent='Page Type';
    root.appendChild(tLabel);
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
    root.appendChild(typeSel);
  }

  // Sync the visible Story Designer inputs from the current slide. Called
  // when the active slide changes or when an upstream model write needs
  // to be reflected.
  function _refresh(){
    if(!mountedRoot) return;
    const s=_currentSlide();
    const storyText=mountedRoot.querySelector('.story-text-input');
    const footer=mountedRoot.querySelector('.story-footer-input');
    const handle=mountedRoot.querySelector('.story-handle-input');
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
      if(typeSel) typeSel.value=s ? (s.pageType||'story') : 'story';
    }finally{
      suppressInput=false;
    }
    _refreshIndicators();
  }

  // Selection sync hook — called when CardDesigner has a text element
  // selected and the user switches to the Story tab. Focuses the
  // corresponding content field where one exists (page-number no longer
  // has a content field in the simplified layout).
  function focusField(elementId){
    if(!mountedRoot) return;
    const map={
      'story-text':'.story-text-input',
      'footer':'.story-footer-input',
      'handle':'.story-handle-input'
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
