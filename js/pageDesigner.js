// PageDesigner — page-centric content editor. Replaces the Sprint 5.x
// Story Designer with a role-aware shell: the user picks "What is this
// page?" (Story / Cover / Hook / End) at the top and the fields below
// adapt to that role. The renderer is untouched; the role only changes
// which content slots are exposed in the editor.
//
// The host contract (mount / unmount / configure / refresh / focusField)
// matches the previous Story Designer so app.js wiring stays unchanged
// after the rename. Each role's editor is a closure (`_buildStoryEditor`,
// `_buildCoverEditor`, `_buildHookEditor`, `_buildEndEditor`) so the
// module stays a single file while remaining modular per role.
const PageDesigner=(function(){
  const ROLES=[
    {id:'story',label:'Story',emoji:'📖'},
    {id:'cover',label:'Cover',emoji:'📘'},
    {id:'hook', label:'Hook', emoji:'🪝'},
    {id:'end',  label:'End',  emoji:'🏁'}
  ];
  const DEFAULT_ROLE='story';
  const DEFAULT_HANDLE='@vihuplanet';

  let mountedContainer=null;
  let mountedRoot=null;
  let editorBody=null; // swappable inner container for role-specific UI
  let host=null;
  // Suppress per-input listeners during programmatic refresh so syncing
  // UI values from the model never re-fires a redraw / markDirty cycle.
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
  // Renderer is the source of truth for overflow — Story Designer never
  // duplicates layout math (Sprint 5.1 pattern preserved).
  function _renderedStoryElement(){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getTextElements!=='function') return null;
    try{
      const els=SlideRenderer.getTextElements();
      return els.find(function(e){ return e.id==='story-text'; }) || null;
    }catch(e){ return null; }
  }

  // --- Role helpers --------------------------------------------------
  function _currentRole(){
    const s=_currentSlide();
    if(!s) return DEFAULT_ROLE;
    return ROLES.some(function(R){ return R.id===s.pageType; }) ? s.pageType : DEFAULT_ROLE;
  }
  function _setRole(roleId){
    const s=_currentSlide();
    if(!s) return;
    if(!ROLES.some(function(R){ return R.id===roleId; })) return;
    if(s.pageType===roleId) return;
    s.pageType=roleId;
    delete s.thumbnail;
    _refreshRoleSelector();
    _renderEditor();
    _commitContent();
  }
  function _ensureRoleData(slide,key){
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata[key]) slide.metadata[key]={};
    return slide.metadata[key];
  }

  // --- Role selector (top of the panel) ------------------------------
  function _buildRoleSelector(parent){
    const label=document.createElement('div');
    label.className='page-role-label';
    label.textContent='What is this page?';
    parent.appendChild(label);
    const row=document.createElement('div');
    row.className='page-role-row';
    ROLES.forEach(function(R){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='page-role-card';
      btn.setAttribute('data-role',R.id);
      const e=document.createElement('span');
      e.className='page-role-emoji';
      e.textContent=R.emoji;
      btn.appendChild(e);
      const n=document.createElement('span');
      n.className='page-role-name';
      n.textContent=R.label;
      btn.appendChild(n);
      btn.addEventListener('click',function(){ _setRole(R.id); });
      row.appendChild(btn);
    });
    parent.appendChild(row);
    const div=document.createElement('hr');
    div.className='story-divider';
    parent.appendChild(div);
  }
  function _refreshRoleSelector(){
    if(!mountedRoot) return;
    const active=_currentRole();
    mountedRoot.querySelectorAll('.page-role-card').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-role')===active);
    });
  }

  // --- Story role editor --------------------------------------------
  function _buildStoryEditor(body){
    const stLabel=document.createElement('label');
    stLabel.className='story-field-label';
    stLabel.textContent='Story Beat';
    body.appendChild(stLabel);

    const storyText=document.createElement('textarea');
    storyText.className='story-text-input input-field textarea';
    storyText.rows=4;
    storyText.placeholder='What happens on this page?';
    storyText.addEventListener('input',function(){
      if(suppressInput) return;
      _syncHidden('storyBeat',storyText.value,true);
      _refreshIndicators();
    });
    body.appendChild(storyText);

    const stats=document.createElement('div');
    stats.className='story-stats-inline';
    stats.innerHTML='<div>Characters: <strong class="story-char-count">0</strong></div>'+
      '<div>Words: <strong class="story-word-count">0</strong></div>';
    body.appendChild(stats);

    const warning=document.createElement('div');
    warning.className='story-overflow-warning hidden';
    warning.textContent='⚠ Story may not fit on this page.';
    body.appendChild(warning);

    const divider=document.createElement('hr');
    divider.className='story-divider';
    body.appendChild(divider);

    const ftLabel=document.createElement('label');
    ftLabel.className='story-field-label';
    ftLabel.textContent='Footer';
    body.appendChild(ftLabel);
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
    body.appendChild(footer);

    const hLabel=document.createElement('label');
    hLabel.className='story-field-label';
    hLabel.textContent='Handle';
    body.appendChild(hLabel);
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
    body.appendChild(handle);
  }

  function _refreshStoryInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const storyText=editorBody.querySelector('.story-text-input');
    const footer=editorBody.querySelector('.story-footer-input');
    const handle=editorBody.querySelector('.story-handle-input');
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
    }finally{
      suppressInput=false;
    }
  }

  // --- Cover role editor (Sprint 6.0 foundation) ---------------------
  function _coverField(parent,key,label,placeholder){
    const lbl=document.createElement('label');
    lbl.className='story-field-label';
    lbl.textContent=label;
    parent.appendChild(lbl);
    const input=document.createElement('input');
    input.type='text';
    input.className='input-field cover-'+key+'-input';
    input.placeholder=placeholder;
    input.setAttribute('data-cover-field',key);
    input.addEventListener('input',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      _ensureRoleData(s,'cover')[key]=input.value;
      _commitContent();
    });
    parent.appendChild(input);
  }
  function _buildCoverEditor(body){
    _coverField(body,'title','Title','Book title');
    _coverField(body,'subtitle','Subtitle','Subtitle (optional)');
    _coverField(body,'author','Author','Author');
    body.appendChild(_makePlaceholder('Cover Image','Image editor lands in a future sprint.'));
  }
  function _refreshCoverInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const data=(s && s.metadata && s.metadata.cover) || {};
    suppressInput=true;
    try{
      editorBody.querySelectorAll('[data-cover-field]').forEach(function(el){
        const k=el.getAttribute('data-cover-field');
        el.value=(typeof data[k]==='string') ? data[k] : '';
      });
    }finally{
      suppressInput=false;
    }
  }

  // --- Hook role editor (Sprint 6.0 foundation) ----------------------
  function _hookField(parent,key,label,placeholder,multiline){
    const lbl=document.createElement('label');
    lbl.className='story-field-label';
    lbl.textContent=label;
    parent.appendChild(lbl);
    const input=multiline ? document.createElement('textarea') : document.createElement('input');
    if(!multiline) input.type='text';
    input.className=(multiline?'input-field textarea ':'input-field ')+'hook-'+key+'-input';
    input.placeholder=placeholder;
    input.setAttribute('data-hook-field',key);
    if(multiline) input.rows=3;
    input.addEventListener('input',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      _ensureRoleData(s,'hook')[key]=input.value;
      _commitContent();
    });
    parent.appendChild(input);
  }
  function _buildHookEditor(body){
    _hookField(body,'heading','Heading','Big hook line',false);
    _hookField(body,'message','Message','Short message',true);
    body.appendChild(_makePlaceholder('QR Code','QR generator lands in a future sprint.'));
    body.appendChild(_makePlaceholder('Social Handle','Brand handle styling lands in a future sprint.'));
  }
  function _refreshHookInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const data=(s && s.metadata && s.metadata.hook) || {};
    suppressInput=true;
    try{
      editorBody.querySelectorAll('[data-hook-field]').forEach(function(el){
        const k=el.getAttribute('data-hook-field');
        el.value=(typeof data[k]==='string') ? data[k] : '';
      });
    }finally{
      suppressInput=false;
    }
  }

  // --- End role editor (Sprint 6.0 foundation) -----------------------
  function _endField(parent,key,label,placeholder,multiline){
    const lbl=document.createElement('label');
    lbl.className='story-field-label';
    lbl.textContent=label;
    parent.appendChild(lbl);
    const input=multiline ? document.createElement('textarea') : document.createElement('input');
    if(!multiline) input.type='text';
    input.className=(multiline?'input-field textarea ':'input-field ')+'end-'+key+'-input';
    input.placeholder=placeholder;
    input.setAttribute('data-end-field',key);
    if(multiline) input.rows=3;
    input.addEventListener('input',function(){
      if(suppressInput) return;
      const s=_currentSlide();
      if(!s) return;
      _ensureRoleData(s,'end')[key]=input.value;
      _commitContent();
    });
    parent.appendChild(input);
  }
  function _buildEndEditor(body){
    _endField(body,'title','Title','The End',false);
    _endField(body,'message','Message','Sign-off message',true);
    body.appendChild(_makePlaceholder('Illustration','Illustration editor lands in a future sprint.'));
  }
  function _refreshEndInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const data=(s && s.metadata && s.metadata.end) || {};
    suppressInput=true;
    try{
      editorBody.querySelectorAll('[data-end-field]').forEach(function(el){
        const k=el.getAttribute('data-end-field');
        el.value=(typeof data[k]==='string') ? data[k] : '';
      });
    }finally{
      suppressInput=false;
    }
  }

  // Shared placeholder card for the foundation editors.
  function _makePlaceholder(title,subtext){
    const ph=document.createElement('div');
    ph.className='page-placeholder';
    const t=document.createElement('div');
    t.className='page-placeholder-title';
    t.textContent=title;
    ph.appendChild(t);
    const s=document.createElement('div');
    s.className='page-placeholder-subtext';
    s.textContent=subtext;
    ph.appendChild(s);
    return ph;
  }

  // --- Indicators (Story only, harmless on other roles) --------------
  function _refreshIndicators(){
    if(!editorBody) return;
    const ta=editorBody.querySelector('.story-text-input');
    const text=ta ? ta.value : '';
    const charEl=editorBody.querySelector('.story-char-count');
    const wordEl=editorBody.querySelector('.story-word-count');
    if(charEl) charEl.textContent=String(text.length);
    if(wordEl) wordEl.textContent=String(_countWords(text));
    const warning=editorBody.querySelector('.story-overflow-warning');
    if(warning){
      const rendered=_renderedStoryElement();
      const overflows=!!(rendered && rendered.overflow);
      warning.classList.toggle('hidden',!overflows);
    }
  }

  // --- Editor render dispatch ----------------------------------------
  function _renderEditor(){
    if(!editorBody) return;
    editorBody.innerHTML='';
    const role=_currentRole();
    if(role==='story') _buildStoryEditor(editorBody);
    else if(role==='cover') _buildCoverEditor(editorBody);
    else if(role==='hook')  _buildHookEditor(editorBody);
    else if(role==='end')   _buildEndEditor(editorBody);
    _refresh();
  }

  // Sync the visible inputs from the current slide. Routed by role.
  function _refresh(){
    if(!mountedRoot) return;
    const role=_currentRole();
    if(role==='story'){ _refreshStoryInputs(); _refreshIndicators(); }
    else if(role==='cover'){ _refreshCoverInputs(); }
    else if(role==='hook'){  _refreshHookInputs();  }
    else if(role==='end'){   _refreshEndInputs();   }
    _refreshRoleSelector();
  }

  // Selection sync hook — only meaningful for the Story role since
  // the other roles don't have Card Designer text targets yet.
  function focusField(elementId){
    if(!editorBody) return;
    const role=_currentRole();
    if(role!=='story') return;
    const map={
      'story-text':'.story-text-input',
      'footer':'.story-footer-input',
      'handle':'.story-handle-input'
    };
    const sel=map[elementId];
    if(!sel) return;
    const el=editorBody.querySelector(sel);
    if(el && typeof el.focus==='function'){
      try{ el.focus(); if(typeof el.select==='function') el.select(); }catch(e){}
    }
  }

  function mount(container){
    if(!container) return null;
    if(container.__pageDesignerRoot){
      mountedContainer=container;
      mountedRoot=container.__pageDesignerRoot;
      editorBody=mountedRoot.querySelector('.page-editor-body');
      _renderEditor();
      return mountedRoot;
    }
    container.innerHTML='';
    const root=document.createElement('div');
    root.className='page-designer';
    _buildRoleSelector(root);
    const eb=document.createElement('div');
    eb.className='page-editor-body';
    root.appendChild(eb);
    container.appendChild(root);
    container.__pageDesignerRoot=root;
    mountedContainer=container;
    mountedRoot=root;
    editorBody=eb;
    _renderEditor();
    return root;
  }

  function unmount(container){
    if(!container) return;
    container.innerHTML='';
    delete container.__pageDesignerRoot;
    if(mountedContainer===container){
      mountedContainer=null;
      mountedRoot=null;
      editorBody=null;
    }
  }

  function configure(cfg){
    host=cfg||null;
    if(mountedRoot) _renderEditor();
  }

  function refresh(){
    if(!mountedRoot) return;
    // If the slide's role changed externally, rebuild the editor.
    const role=_currentRole();
    const current=editorBody && editorBody.firstChild ? editorBody.getAttribute('data-rendered-role') : null;
    if(current!==role){
      if(editorBody) editorBody.setAttribute('data-rendered-role',role);
      _renderEditor();
    }else{
      _refresh();
    }
  }

  const api={
    ROLES:ROLES,
    DEFAULT_ROLE:DEFAULT_ROLE,
    DEFAULT_HANDLE:DEFAULT_HANDLE,
    mount:mount,
    unmount:unmount,
    configure:configure,
    refresh:refresh,
    focusField:focusField
  };
  try{ window.PageDesigner=api; }catch(e){}
  // Sprint 6.0 compat: app.js + thumbnails + ThemeEngine call window.StoryDesigner
  // at a few points (e.g. window.redrawPreview). Alias preserves the call sites
  // without touching them this sprint.
  try{ window.StoryDesigner=api; }catch(e){}
  return api;
})();
