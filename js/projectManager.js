const ProjectManager=(function(){
  const STORAGE_KEY='vihustudio-session';
  const PROJECT_VERSION='1.0';
  const AUTOSAVE_DEBOUNCE_MS=500;
  const ALLOWED_PAGE_TYPES=['story','cover','cta','blank'];

  let autosaveTimer=null;
  let statusCallback=null;
  let suppressDirty=false;

  function setStatusCallback(cb){ statusCallback=cb; }

  function setStatus(s){
    if(statusCallback){ try{ statusCallback(s); }catch(e){} }
  }

  function normalizePageType(t,hasImage){
    if(ALLOWED_PAGE_TYPES.indexOf(t)!==-1) return t;
    return hasImage?'story':'blank';
  }

  function imageToDataURL(slide){
    if(!slide||!slide.image) return null;
    if(slide._imageDataURL) return slide._imageDataURL;
    try{
      const img=slide.image;
      const w=img.naturalWidth||img.width||0;
      const h=img.naturalHeight||img.height||0;
      if(!w||!h) return null;
      const c=document.createElement('canvas');
      c.width=w; c.height=h;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      const data=c.toDataURL('image/jpeg',0.92);
      slide._imageDataURL=data;
      return data;
    }catch(e){ return null; }
  }

  function readDomString(id){
    const el=document.getElementById(id);
    return el?(el.value||''):'';
  }

  function writeDomString(id,v){
    const el=document.getElementById(id);
    if(el) el.value=v||'';
  }

  function serialize(){
    const now=new Date().toISOString();
    if(!AppState.project) AppState.project={};
    if(!AppState.project.createdDate) AppState.project.createdDate=now;
    AppState.project.modifiedDate=now;

    const pages=AppState.slides.map(function(s){
      return {
        pageType:normalizePageType(s.pageType,!!s.image),
        image:imageToDataURL(s),
        thumbnail:s.thumbnail||null,
        storyBeat:s.storyBeat||'',
        storyDraft:s.storyDraft||'',
        metadata:s.metadata||{}
      };
    });

    return {
      version:PROJECT_VERSION,
      project:{
        title:readDomString('projectTitle')||AppState.project.title||'',
        author:readDomString('projectAuthorName')||AppState.project.author||'',
        bookTitle:readDomString('bookTitle')||AppState.project.bookTitle||'',
        theme:readDomString('themeSelect')||AppState.project.theme||'default',
        createdDate:AppState.project.createdDate,
        modifiedDate:AppState.project.modifiedDate
      },
      pages:pages,
      settings:{
        darkMode:document.body.classList.contains('dark-theme'),
        selectedTheme:readDomString('themeSelect')||'default'
      },
      session:{
        currentPage:AppState.currentSlide||0,
        uiState:{}
      }
    };
  }

  function loadImageFromDataURL(dataURL){
    return new Promise(function(resolve){
      if(!dataURL){ resolve(null); return; }
      const img=new Image();
      img.onload=function(){ resolve(img); };
      img.onerror=function(){ resolve(null); };
      img.src=dataURL;
    });
  }

  function validatePayload(p){
    if(!p||typeof p!=='object') throw new Error('Invalid project file');
    if(!p.version||typeof p.version!=='string') throw new Error('Missing project version');
    const major=parseInt(String(p.version).split('.')[0],10);
    const myMajor=parseInt(PROJECT_VERSION.split('.')[0],10);
    if(isNaN(major)||major>myMajor) throw new Error('Project version '+p.version+' is newer than supported '+PROJECT_VERSION);
    if(!Array.isArray(p.pages)) throw new Error('Project pages missing');
  }

  async function deserialize(payload){
    validatePayload(payload);
    suppressDirty=true;
    try{
      const project=payload.project||{};
      const settings=payload.settings||{};
      const session=payload.session||{};

      AppState.project={
        title:project.title||'',
        author:project.author||'',
        bookTitle:project.bookTitle||'',
        theme:project.theme||'default',
        createdDate:project.createdDate||new Date().toISOString(),
        modifiedDate:project.modifiedDate||new Date().toISOString()
      };

      writeDomString('projectTitle',AppState.project.title);
      writeDomString('projectAuthorName',AppState.project.author);
      writeDomString('bookTitle',AppState.project.bookTitle);
      writeDomString('themeSelect',AppState.project.theme);

      const total=payload.pages.length;
      const slides=[];
      for(let i=0;i<total;i++){
        const p=payload.pages[i];
        const img=await loadImageFromDataURL(p.image);
        const slide={
          id:Date.now()+i,
          image:img,
          thumbnail:p.thumbnail||null,
          storyBeat:p.storyBeat||'',
          storyDraft:p.storyDraft||'',
          pageType:normalizePageType(p.pageType,!!img),
          metadata:p.metadata||{},
          page:i+1,
          totalPages:total
        };
        if(p.image) slide._imageDataURL=p.image;
        slides.push(slide);
      }
      AppState.slides=slides;
      AppState.currentSlide=Math.max(0,Math.min(session.currentPage||0,Math.max(0,slides.length-1)));

      if(typeof ThemeManager!=='undefined'){
        try{ ThemeManager.applyTheme(settings.darkMode?'dark':'light'); }catch(e){}
      }
      if(typeof ThemeEngine!=='undefined'){
        try{ ThemeEngine.applyTheme(AppState.project.theme,{silent:true}); }catch(e){}
      }

      if(typeof window.renderList==='function') window.renderList();
      if(typeof window.renderTimeline==='function') window.renderTimeline();
      if(slides.length>0 && typeof window.showSlide==='function') window.showSlide(AppState.currentSlide);
    }finally{
      suppressDirty=false;
    }
  }

  function _writeStorage(){
    setStatus('saving');
    try{
      const data=serialize();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      setStatus('saved');
      return true;
    }catch(e){
      setStatus('failed');
      return false;
    }
  }

  function saveToLocalStorage(){ return _writeStorage(); }

  function markDirty(){
    if(suppressDirty) return;
    setStatus('unsaved');
    if(autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(_writeStorage,AUTOSAVE_DEBOUNCE_MS);
  }

  function readSessionRaw(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }

  function getSessionStatus(){
    const raw=readSessionRaw();
    if(!raw) return {state:'none'};
    let data;
    try{ data=JSON.parse(raw); }catch(e){ return {state:'corrupt',reason:'parse'}; }
    try{ validatePayload(data); }catch(e){ return {state:'corrupt',reason:e.message}; }
    if(!data.pages||data.pages.length===0) return {state:'empty'};
    return {state:'valid',data:data,title:(data.project&&data.project.title)||'Untitled'};
  }

  async function restoreSession(){
    const info=getSessionStatus();
    if(info.state!=='valid') return false;
    await deserialize(info.data);
    return true;
  }

  function discardSession(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  function _sanitizeFilename(name){
    return (name||'project').replace(/[^a-z0-9_\-]+/gi,'_').replace(/^_+|_+$/g,'')||'project';
  }

  function saveProjectAs(filename){
    try{
      const data=serialize();
      const json=JSON.stringify(data,null,2);
      const blob=new Blob([json],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=_sanitizeFilename(filename||data.project.title)+'.vihu';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); },1000);
      setStatus('saved');
      return true;
    }catch(e){
      setStatus('failed');
      return false;
    }
  }

  function openProject(file){
    return new Promise(function(resolve,reject){
      const reader=new FileReader();
      reader.onload=async function(){
        try{
          const data=JSON.parse(reader.result);
          await deserialize(data);
          _writeStorage();
          resolve(true);
        }catch(e){ reject(e); }
      };
      reader.onerror=function(){ reject(new Error('Failed to read file')); };
      reader.readAsText(file);
    });
  }

  const api={
    PROJECT_VERSION:PROJECT_VERSION,
    AUTOSAVE_DEBOUNCE_MS:AUTOSAVE_DEBOUNCE_MS,
    setStatusCallback:setStatusCallback,
    markDirty:markDirty,
    saveToLocalStorage:saveToLocalStorage,
    serialize:serialize,
    deserialize:deserialize,
    saveProjectAs:saveProjectAs,
    openProject:openProject,
    getSessionStatus:getSessionStatus,
    restoreSession:restoreSession,
    discardSession:discardSession
  };
  try{ window.ProjectManager=api; }catch(e){}
  return api;
})();
