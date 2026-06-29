// PageDesigner — page-centric content editor. Story Designer (Sprint 5.x)
// evolved into a role-aware shell where "What is this page?" is the first
// decision, and the editor below adapts. Roles: Story (default), Cover,
// Hook, End.
//
// Sprint 6.0 (Roles & Scenes):
//   - Per-role descriptions update under the selector.
//   - Story Title is shared content across Story / Hook / End and lives
//     at `slide.metadata.storyTitle`.
//   - Scenes are page-specific visual presets for Cover / Hook / End and
//     persist at `slide.metadata.scene` (foundation only — captures the
//     selection; visual application lands in a future sprint without a
//     renderer architecture change).
//   - Each role's editor is its own closure so adding a new role later
//     only touches its builder + refresh + scene list. The user always
//     sees one editor; never separate tabs.
//
// Host contract is unchanged from Sprint 5.x: mount / unmount / configure
// / refresh / focusField. Legacy `window.StoryDesigner` alias preserved.
const PageDesigner=(function(){
  const ROLES=[
    {id:'story',label:'Story',emoji:'📖',description:'Tell what happens on this page of your story.'},
    {id:'cover',label:'Cover',emoji:'📘',description:'Introduce your story and invite readers into your adventure.'},
    {id:'hook', label:'Hook', emoji:'🪝',description:'Leave readers excited and encourage them to follow your next adventure.'},
    {id:'end',  label:'End',  emoji:'🏁',description:'Give your story a warm and memorable ending.'}
  ];
  const DEFAULT_ROLE='story';
  const DEFAULT_HANDLE='@vihuplanet';
  const HELPER_TEXT='Choose the role of this page in your story.';

  // Per-role scene presets. Foundation only stores the selection — a
  // future sprint maps each scene to renderer-friendly card overrides.
  const SCENES={
    cover:[
      {id:'adventure', emoji:'🗺️', label:'Adventure'},
      {id:'space',     emoji:'🚀', label:'Space'},
      {id:'jungle',    emoji:'🌴', label:'Jungle'},
      {id:'ocean',     emoji:'🌊', label:'Ocean'},
      {id:'princess',  emoji:'👑', label:'Princess'},
      {id:'minimal',   emoji:'🤍', label:'Minimal'}
    ],
    hook:[
      {id:'stars',       emoji:'⭐', label:'Stars'},
      {id:'balloons',    emoji:'🎈', label:'Balloons'},
      {id:'space',       emoji:'🚀', label:'Space'},
      {id:'thank-you',   emoji:'❤️', label:'Thank You'},
      {id:'celebration', emoji:'🎉', label:'Celebration'},
      {id:'read-more',   emoji:'📚', label:'Read More'}
    ],
    end:[
      {id:'good-night',     emoji:'🌙', label:'Good Night'},
      {id:'thank-you',      emoji:'❤️', label:'Thank You'},
      {id:'rainbow',        emoji:'🌈', label:'Rainbow'},
      {id:'next-adventure', emoji:'🚀', label:'Next Adventure'},
      {id:'celebration',    emoji:'🎉', label:'Celebration'},
      {id:'the-end',        emoji:'📖', label:'The End'}
    ]
  };

  let mountedContainer=null;
  let mountedRoot=null;
  let editorBody=null;
  let host=null;
  let suppressInput=false;

  // --- Generic helpers ----------------------------------------------
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
  function _renderedStoryElement(){
    if(typeof SlideRenderer==='undefined' || typeof SlideRenderer.getTextElements!=='function') return null;
    try{
      return SlideRenderer.getTextElements().find(function(e){ return e.id==='story-text'; }) || null;
    }catch(e){ return null; }
  }
  function _ensureRoleData(slide,key){
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata[key]) slide.metadata[key]={};
    return slide.metadata[key];
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

  // --- Shared field builders ----------------------------------------
  function _makeLabel(text){
    const lbl=document.createElement('label');
    lbl.className='story-field-label';
    lbl.textContent=text;
    return lbl;
  }
  function _makeTextInput(opts){
    const el=opts.multiline ? document.createElement('textarea') : document.createElement('input');
    if(!opts.multiline) el.type='text';
    el.className='input-field '+(opts.multiline?'textarea ':'')+(opts.cls||'');
    if(opts.placeholder) el.placeholder=opts.placeholder;
    if(opts.multiline) el.rows=opts.rows||3;
    if(opts.dataAttr) el.setAttribute(opts.dataAttr[0],opts.dataAttr[1]);
    el.addEventListener('input',function(){
      if(suppressInput) return;
      opts.onChange(el.value);
    });
    return el;
  }
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

  // Story Title — shared content across Story / Hook / End.
  function _appendStoryTitle(body){
    body.appendChild(_makeLabel('Story Title'));
    const input=_makeTextInput({
      cls:'story-title-input',
      placeholder:'The title of your story',
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        if(!s.metadata) s.metadata={};
        s.metadata.storyTitle=v;
        _commitContent();
      }
    });
    body.appendChild(input);
  }
  // Handle — shared across Story / Hook / End.
  function _appendHandle(body){
    body.appendChild(_makeLabel('Handle'));
    const input=_makeTextInput({
      cls:'story-handle-input',
      placeholder:DEFAULT_HANDLE,
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        if(!s.metadata) s.metadata={};
        s.metadata.handle=v;
        _commitContent();
      }
    });
    body.appendChild(input);
  }

  // --- Role selector + helper + description -------------------------
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

    // Helper line, static.
    const helper=document.createElement('p');
    helper.className='page-role-helper';
    helper.textContent=HELPER_TEXT;
    parent.appendChild(helper);

    // Per-role description, updates on role change.
    const desc=document.createElement('p');
    desc.className='page-role-description';
    parent.appendChild(desc);

    const divider=document.createElement('hr');
    divider.className='story-divider';
    parent.appendChild(divider);
  }
  function _refreshRoleSelector(){
    if(!mountedRoot) return;
    const active=_currentRole();
    mountedRoot.querySelectorAll('.page-role-card').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-role')===active);
    });
    const desc=mountedRoot.querySelector('.page-role-description');
    if(desc){
      const R=ROLES.find(function(r){ return r.id===active; });
      desc.textContent=R?R.description:'';
    }
  }

  // --- Scene cards (Cover / Hook / End) -----------------------------
  function _appendSceneCards(body,roleId){
    const scenes=SCENES[roleId];
    if(!scenes||scenes.length===0) return;
    const label=document.createElement('div');
    label.className='page-scene-label';
    label.textContent='Scene';
    body.appendChild(label);
    const row=document.createElement('div');
    row.className='page-scene-row';
    row.setAttribute('data-scene-role',roleId);
    scenes.forEach(function(sc){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='page-scene-card';
      btn.setAttribute('data-scene',sc.id);
      const e=document.createElement('span');
      e.className='page-scene-emoji';
      e.textContent=sc.emoji;
      btn.appendChild(e);
      const n=document.createElement('span');
      n.className='page-scene-name';
      n.textContent=sc.label;
      btn.appendChild(n);
      btn.addEventListener('click',function(){
        const s=_currentSlide(); if(!s) return;
        if(!s.metadata) s.metadata={};
        if(s.metadata.scene===sc.id){
          delete s.metadata.scene;
        }else{
          s.metadata.scene=sc.id;
        }
        _refreshSceneCards();
        _commitContent();
      });
      row.appendChild(btn);
    });
    body.appendChild(row);
  }
  function _refreshSceneCards(){
    if(!editorBody) return;
    const s=_currentSlide();
    const active=(s && s.metadata && typeof s.metadata.scene==='string') ? s.metadata.scene : null;
    editorBody.querySelectorAll('.page-scene-card').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-scene')===active);
    });
  }

  // --- Story role editor --------------------------------------------
  function _buildStoryEditor(body){
    _appendStoryTitle(body);

    body.appendChild(_makeLabel('Story Beat'));
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

    body.appendChild(_makeLabel('Footer'));
    const footer=_makeTextInput({
      cls:'story-footer-input',
      placeholder:'Footer text (defaults to book title)',
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        if(!s.metadata) s.metadata={};
        s.metadata.footerText=v;
        _commitContent();
      }
    });
    body.appendChild(footer);

    _appendHandle(body);
  }
  function _refreshStoryInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    suppressInput=true;
    try{
      const title=editorBody.querySelector('.story-title-input');
      if(title) title.value=(s && s.metadata && typeof s.metadata.storyTitle==='string') ? s.metadata.storyTitle : '';
      const storyText=editorBody.querySelector('.story-text-input');
      if(storyText) storyText.value=(s && s.storyBeat) || '';
      const footer=editorBody.querySelector('.story-footer-input');
      if(footer){
        const ft=(s && s.metadata && typeof s.metadata.footerText==='string')
          ? s.metadata.footerText
          : _projectBookTitle();
        footer.value=ft;
      }
      const handle=editorBody.querySelector('.story-handle-input');
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

  // --- Cover role editor --------------------------------------------
  function _buildCoverEditor(body){
    body.appendChild(_makeLabel('Title'));
    body.appendChild(_makeTextInput({
      cls:'cover-title-input',
      placeholder:'Book title',
      dataAttr:['data-cover-field','title'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'cover').title=v;
        _commitContent();
      }
    }));
    body.appendChild(_makeLabel('Subtitle'));
    body.appendChild(_makeTextInput({
      cls:'cover-subtitle-input',
      placeholder:'Subtitle (optional)',
      dataAttr:['data-cover-field','subtitle'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'cover').subtitle=v;
        _commitContent();
      }
    }));
    body.appendChild(_makeLabel('Author'));
    body.appendChild(_makeTextInput({
      cls:'cover-author-input',
      placeholder:'Author',
      dataAttr:['data-cover-field','author'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'cover').author=v;
        _commitContent();
      }
    }));
    body.appendChild(_makePlaceholder('Cover Image','Edit the image in the Card Designer.'));
    _appendSceneCards(body,'cover');
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

  // --- Hook role editor ---------------------------------------------
  function _buildHookEditor(body){
    _appendStoryTitle(body);
    body.appendChild(_makeLabel('Heading'));
    body.appendChild(_makeTextInput({
      cls:'hook-heading-input',
      placeholder:'Big hook line',
      dataAttr:['data-hook-field','heading'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'hook').heading=v;
        _commitContent();
      }
    }));
    body.appendChild(_makeLabel('Message'));
    body.appendChild(_makeTextInput({
      cls:'hook-message-input',
      multiline:true,
      rows:3,
      placeholder:'Short message',
      dataAttr:['data-hook-field','message'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'hook').message=v;
        _commitContent();
      }
    }));
    _appendHandle(body);
    body.appendChild(_makePlaceholder('Optional Image','Edit the image in the Card Designer.'));
    body.appendChild(_makePlaceholder('QR Code','QR generator lands in a future sprint.'));
    _appendSceneCards(body,'hook');
  }
  function _refreshHookInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const data=(s && s.metadata && s.metadata.hook) || {};
    suppressInput=true;
    try{
      const title=editorBody.querySelector('.story-title-input');
      if(title) title.value=(s && s.metadata && typeof s.metadata.storyTitle==='string') ? s.metadata.storyTitle : '';
      editorBody.querySelectorAll('[data-hook-field]').forEach(function(el){
        const k=el.getAttribute('data-hook-field');
        el.value=(typeof data[k]==='string') ? data[k] : '';
      });
      const handle=editorBody.querySelector('.story-handle-input');
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

  // --- End role editor ----------------------------------------------
  function _buildEndEditor(body){
    _appendStoryTitle(body);
    body.appendChild(_makeLabel('Ending Title'));
    body.appendChild(_makeTextInput({
      cls:'end-endingtitle-input',
      placeholder:'The End',
      dataAttr:['data-end-field','endingTitle'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'end').endingTitle=v;
        _commitContent();
      }
    }));
    body.appendChild(_makeLabel('Message'));
    body.appendChild(_makeTextInput({
      cls:'end-message-input',
      multiline:true,
      rows:3,
      placeholder:'Sign-off message',
      dataAttr:['data-end-field','message'],
      onChange:function(v){
        const s=_currentSlide(); if(!s) return;
        _ensureRoleData(s,'end').message=v;
        _commitContent();
      }
    }));
    _appendHandle(body);
    body.appendChild(_makePlaceholder('Optional Image','Edit the image in the Card Designer.'));
    _appendSceneCards(body,'end');
  }
  function _refreshEndInputs(){
    if(!editorBody) return;
    const s=_currentSlide();
    const data=(s && s.metadata && s.metadata.end) || {};
    suppressInput=true;
    try{
      const title=editorBody.querySelector('.story-title-input');
      if(title) title.value=(s && s.metadata && typeof s.metadata.storyTitle==='string') ? s.metadata.storyTitle : '';
      editorBody.querySelectorAll('[data-end-field]').forEach(function(el){
        const k=el.getAttribute('data-end-field');
        el.value=(typeof data[k]==='string') ? data[k] : '';
      });
      const handle=editorBody.querySelector('.story-handle-input');
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

  // --- Indicators (Story only) --------------------------------------
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

  function _renderEditor(){
    if(!editorBody) return;
    editorBody.innerHTML='';
    const role=_currentRole();
    editorBody.setAttribute('data-rendered-role',role);
    if(role==='story') _buildStoryEditor(editorBody);
    else if(role==='cover') _buildCoverEditor(editorBody);
    else if(role==='hook')  _buildHookEditor(editorBody);
    else if(role==='end')   _buildEndEditor(editorBody);
    _refresh();
  }

  function _refresh(){
    if(!mountedRoot) return;
    const role=_currentRole();
    if(role==='story'){ _refreshStoryInputs(); _refreshIndicators(); }
    else if(role==='cover'){ _refreshCoverInputs(); }
    else if(role==='hook'){  _refreshHookInputs();  }
    else if(role==='end'){   _refreshEndInputs();   }
    _refreshRoleSelector();
    _refreshSceneCards();
  }

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
    const role=_currentRole();
    const current=editorBody ? editorBody.getAttribute('data-rendered-role') : null;
    if(current!==role){
      _renderEditor();
    }else{
      _refresh();
    }
  }

  const api={
    ROLES:ROLES,
    SCENES:SCENES,
    DEFAULT_ROLE:DEFAULT_ROLE,
    DEFAULT_HANDLE:DEFAULT_HANDLE,
    mount:mount,
    unmount:unmount,
    configure:configure,
    refresh:refresh,
    focusField:focusField
  };
  try{ window.PageDesigner=api; }catch(e){}
  // Compat alias preserved from the Story Designer era.
  try{ window.StoryDesigner=api; }catch(e){}
  return api;
})();
