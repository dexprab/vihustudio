const ProjectManager=(function(){
  const STORAGE_KEY='vihustudio-session';
  const PROJECT_VERSION='1.0';
  const AUTOSAVE_DEBOUNCE_MS=500;
  // Sprint 6.0 extends the allowed list with 'hook' and 'end' (the new
  // Page Designer roles); 'cta' and 'blank' are retained for backward
  // compatibility with projects saved before Sprint 6.0.
  const ALLOWED_PAGE_TYPES=['story','cover','cta','blank','hook','end'];

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
    // Sprint 6.3 fidelity: if the upload pipeline already captured the
    // original bytes (app.js / Page Designer image manager both do
    // `FileReader.readAsDataURL`), return them verbatim — no canvas
    // re-encoding. This is now the common path.
    if(slide._imageDataURL) return slide._imageDataURL;
    try{
      const img=slide.image;
      const w=img.naturalWidth||img.width||0;
      const h=img.naturalHeight||img.height||0;
      if(!w||!h) return null;
      const c=document.createElement('canvas');
      c.width=w; c.height=h;
      const ctx=c.getContext('2d');
      // High-quality interpolation for the (rare) re-encode fallback.
      try{ ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; }catch(_){}
      ctx.drawImage(img,0,0,w,h);
      // Sprint 6.3 — was 'image/jpeg' at 0.92 (lossy). Switch to lossless
      // PNG so pencil texture / contrast / tonal range survive the fallback.
      const data=c.toDataURL('image/png');
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
        id:AppState.project.id||null,
        title:readDomString('projectTitle')||AppState.project.title||'',
        author:readDomString('projectAuthorName')||AppState.project.author||'',
        bookTitle:readDomString('bookTitle')||AppState.project.bookTitle||'',
        theme:readDomString('themeSelect')||AppState.project.theme||'default',
        themeOptions:AppState.project.themeOptions||null,
        // Draft Asset Architecture, Phase E — carried forward on every
        // re-save so a Magic-Card-recalled project (js/magicCard.js's
        // _pullRecalledProjects stamps this once, at adoption time)
        // still resolves any pre-recall vihu-asset: reference correctly
        // after a later reload — see deserialize()'s own comment below.
        recallOwnerId:AppState.project.recallOwnerId||null,
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

  // Platform Hardening — Draft Asset Architecture, Phase C. A stored
  // field (a page's own serialized image, a Place's own dataURL) may now
  // be a durable vihu-asset: reference instead of a raw data: URI --
  // resolve it to a real, directly-usable src (warm cache -> IndexedDB ->
  // a signed Storage URL) before ever handing it to loadImageFromDataURL,
  // which only ever knew how to load a real URL. A legacy data: URI (or
  // null) passes through unchanged, same-tick, so untouched old sessions
  // rehydrate exactly as they always have. Total failure (offline + never
  // cached) resolves null, matching AssetStore.resolve()'s own contract --
  // the picture simply doesn't load this time (same as a broken/missing
  // image already did before this phase); the original reference itself
  // is never discarded (see below), so a later load can still recover it.
  //
  // `fallbackOwnerId` (Phase E) is threaded through to AssetStore.resolve()'s
  // own `opts.ownerId` -- only ever consulted by AssetStore as a SECOND
  // attempt after the current session's own owner id fails, so passing it
  // unconditionally for every field on a Magic-Card-recalled project (see
  // deserialize() below) is safe: a genuinely local reference (including a
  // brand-new upload made on this device after the recall) still resolves
  // via the fast, correct, current-session path first and never even
  // reaches the fallback.
  function _resolveMaybeRef(value,fallbackOwnerId){
    if(typeof window!=='undefined' && window.AssetStore && typeof value==='string' && value.indexOf('vihu-asset:')===0){
      return window.AssetStore.resolve(value,fallbackOwnerId?{ownerId:fallbackOwnerId}:undefined);
    }
    return Promise.resolve(value);
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
        id:project.id||null,
        title:project.title||'',
        author:project.author||'',
        bookTitle:project.bookTitle||'',
        theme:project.theme||'default',
        themeOptions:project.themeOptions||null,
        // Draft Asset Architecture, Phase E — a Magic-Card-recalled
        // project (js/magicCard.js's _pullRecalledProjects) stamps the
        // ORIGINAL device's own owner id here at adoption time, before
        // this project is ever opened locally. Any vihu-asset: reference
        // this payload still carries from before the recall belongs to
        // that owner, not this device's own session — AssetStore.resolve()
        // needs it as a fallback (see _resolveMaybeRef above). Absent for
        // every ordinary (non-recalled) project — most everything reading
        // this project's images never needs it at all.
        recallOwnerId:project.recallOwnerId||null,
        createdDate:project.createdDate||new Date().toISOString(),
        modifiedDate:project.modifiedDate||new Date().toISOString()
      };

      writeDomString('projectTitle',AppState.project.title);
      writeDomString('projectAuthorName',AppState.project.author);
      writeDomString('bookTitle',AppState.project.bookTitle);
      writeDomString('themeSelect',AppState.project.theme);

      const recallOwnerId=AppState.project.recallOwnerId;
      const total=payload.pages.length;
      const slides=[];
      for(let i=0;i<total;i++){
        const p=payload.pages[i];
        const img=await loadImageFromDataURL(await _resolveMaybeRef(p.image,recallOwnerId));
        const slide={
          id:Date.now()+i,
          image:img,
          thumbnail:p.thumbnail||null,
          storyBeat:p.storyBeat||'',
          storyDraft:p.storyDraft||'',
          pageType:normalizePageType(p.pageType,!!img),
          metadata:p.metadata||{},
          // Draft Asset Architecture, Phase E — carried per-slide (not
          // just on AppState.project) so renderer/slideRenderer.js's own
          // render-time image resolution (_ensureDecorationImage, for a
          // World-owned Scene Object override) can read it straight off
          // the slide it was handed, matching that module's deliberate
          // "never reach into AppState directly" discipline.
          recallOwnerId:recallOwnerId||null,
          page:i+1,
          totalPages:total
        };
        if(p.image) slide._imageDataURL=p.image;
        // Multiple Artwork Places Per Page — Place 1's picture is
        // rehydrated above via the exact pre-existing loadImageFromDataURL
        // call; every extra Place's own dataURL (slide.metadata.
        // placeContent[id].dataURL, already carried through wholesale by
        // `metadata` above, needing no serialize() change) gets the same
        // async rehydration into a sibling runtime cache, slide._placeImages,
        // never persisted directly.
        const placeContent=slide.metadata && slide.metadata.placeContent;
        if(placeContent){
          const placeIds=Object.keys(placeContent);
          for(let pi=0;pi<placeIds.length;pi++){
            const pid=placeIds[pi];
            const dataURL=placeContent[pid] && placeContent[pid].dataURL;
            if(!dataURL) continue;
            const placeImg=await loadImageFromDataURL(await _resolveMaybeRef(dataURL,recallOwnerId));
            if(placeImg){
              if(!slide._placeImages) slide._placeImages={};
              slide._placeImages[pid]=placeImg;
            }
          }
        }
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

  // Item 1 — "show running projects without going through Screen 1."
  // Every real project gets a stable id the first time it's ever saved
  // (a brand-new project from Creation Flow, or a legacy session from
  // before this feature existed) so it can be found again later via
  // CreatorProjectStore.list() — this never replaces the single-session
  // restore slot above (STORAGE_KEY), it rides alongside it.
  function _ensureProjectId(){
    if(!AppState.project) AppState.project={};
    if(!AppState.project.id && typeof CreatorProjectStore!=='undefined'){
      AppState.project.id=CreatorProjectStore.newId();
    }
    return AppState.project.id||null;
  }

  // Magic Card Identity Evolution, Phase 2 — the "continuous cloud
  // mirror once claimed" architecture: local stays authoritative and
  // this is fire-and-forget, debounced on its own separate timer from
  // the local write above (mirrors worldBuilderApp.js's own
  // _scheduleCloudSync exactly). A Traveller (no claimed Magic Card)
  // never reaches CreatorProjectSync.push at all — this is the one
  // guard that keeps a Traveller's own projects 100% local forever.
  //
  // Cloud-Primary Project Storage, Phase 4 — this function no longer
  // pushes to Supabase directly. CreatorProjectStore.upsert() (called
  // by _syncProjectStore, right before this) already durably enqueues +
  // drains the sync through js/creatorProjectCache.js the instant the
  // record is written — durable because it survives this tab closing
  // before the timer below ever fires, unlike the plain setTimeout this
  // function used to be. This function's only remaining job is a
  // prompt, debounced nudge via CreatorProjectCache.enqueueSync(id)
  // (mirroring worldBuilderApp.js's own simplified _scheduleCloudSync
  // exactly); both the immediate _scheduleDrainSoon() call already
  // inside putLocal() and this function's own separate nudge are safe
  // to run redundantly, since the underlying drain timer is a single
  // shared, idempotent debounce.
  //
  // "why i dont have red, orange, green in studio... we might even use
  // companion for this" — this is the one place Studio knows a real
  // sync attempt is about to begin (the settled outcome itself arrives
  // later, via js/creatorProjectCache.js's own onSyncStateChange
  // pub/sub, subscribed to directly by js/companionDirector.js). A
  // plain, defensive notify() call, matching the exact hook shape every
  // other Studio-event -> companion moment in this codebase already
  // uses (js/app.js's artwork-added, js/creationFlow.js's
  // story-started, etc.) — a missing/broken CompanionDirector can never
  // affect whether the real sync itself proceeds.
  const CLOUD_PROJECT_SYNC_DEBOUNCE_MS=2000;
  let _cloudProjectSyncTimer=null;
  function _scheduleCloudProjectSync(id){
    if(typeof CreatorProjectCache==='undefined' || typeof MagicCard==='undefined' || !MagicCard.getActive()) return;
    if(_cloudProjectSyncTimer) clearTimeout(_cloudProjectSyncTimer);
    _cloudProjectSyncTimer=setTimeout(function(){
      _cloudProjectSyncTimer=null;
      CreatorProjectCache.enqueueSync(id);
      try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('project-sync-pending'); }catch(e){}
    },CLOUD_PROJECT_SYNC_DEBOUNCE_MS);
  }

  // Platform Hardening — Draft Asset Architecture, Phase D (migration
  // activation). Walks AppState.slides for every known image-bearing
  // string field this Project can carry a raw `data:` URI in and
  // returns {get,set} accessor pairs for AssetStore.migrateFieldsOnSave()
  // — Place 1's own _imageDataURL, every extra Place's own
  // placeContent[id].dataURL, and every World-owned Scene Object content
  // override's own .image field (SceneEngine.setContentOverride).
  //
  // `slide.thumbnail` is deliberately NOT included — a disclosed scope
  // decision, not an oversight: unlike the three fields above (already
  // rewired end-to-end in Phase C, every real read site resolving a
  // vihu-asset: reference correctly), slide.thumbnail is read directly
  // as an <img>.src at several call sites this Phase never touched
  // (js/app.js's page-strip/thumbnail-grid renders, js/creatorProjectStore.js/
  // js/magicCardUI.js's own Story/My-Projects cards) — migrating it here
  // would produce a genuinely broken thumbnail the instant it shrank to
  // a reference those sites don't know how to resolve. Thumbnails are
  // also small, derived, and regenerated on demand (ThumbnailEngine),
  // nowhere near the scale that caused the original quota bug, so the
  // benefit doesn't justify rewiring every one of those read sites too.
  function _collectMigrationAccessors(){
    const jobs=[];
    (AppState.slides||[]).forEach(function(slide){
      if(typeof slide._imageDataURL==='string'){
        jobs.push({
          get:function(){ return slide._imageDataURL; },
          set:function(ref){ slide._imageDataURL=ref; }
        });
      }
      const placeContent=slide.metadata&&slide.metadata.placeContent;
      if(placeContent){
        Object.keys(placeContent).forEach(function(pid){
          const entry=placeContent[pid];
          if(entry && typeof entry.dataURL==='string'){
            jobs.push({
              get:function(){ return entry.dataURL; },
              set:function(ref){ entry.dataURL=ref; }
            });
          }
        });
      }
      const overrides=slide.metadata&&slide.metadata.elementOverrides;
      if(overrides){
        Object.keys(overrides).forEach(function(id){
          const entry=overrides[id];
          if(entry && typeof entry.image==='string'){
            jobs.push({
              get:function(){ return entry.image; },
              set:function(ref){ entry.image=ref; }
            });
          }
        });
      }
    });
    return jobs;
  }

  // Fired only as a background side effect of an already-successful
  // local save (mirrors worldBuilderApp.js's own _scheduleAssetMigration
  // exactly) — never on read, never a proactive sweep. Debounced
  // separately from the synchronous local write, since most saves have
  // nothing left to migrate and re-walking every slide on every
  // keystroke would be wasted work. A field migrateFieldsOnSave couldn't
  // put() (offline, etc.) is simply left as-is and retried on the next
  // save; a project with zero legacy fields resolves with nothing
  // changed, so no extra local save fires for it.
  const ASSET_MIGRATION_DEBOUNCE_MS=1500;
  let _assetMigrationTimer=null;
  function _scheduleAssetMigration(){
    if(typeof window==='undefined' || !window.AssetStore || typeof window.AssetStore.migrateFieldsOnSave!=='function') return;
    const id=_ensureProjectId();
    if(!id) return;
    clearTimeout(_assetMigrationTimer);
    _assetMigrationTimer=setTimeout(function(){
      const accessors=_collectMigrationAccessors();
      if(!accessors.length) return;
      const before=accessors.map(function(a){ return a.get(); });
      window.AssetStore.migrateFieldsOnSave('creator',id,accessors).then(function(){
        const changed=accessors.some(function(a,i){ return a.get()!==before[i]; });
        if(!changed) return;
        _writeStorage();
      });
    },ASSET_MIGRATION_DEBOUNCE_MS);
  }

  function _syncProjectStore(data){
    if(typeof CreatorProjectStore==='undefined') return;
    const id=_ensureProjectId();
    if(!id) return;
    // data was already serialized with the (pre-id-assignment) project
    // fields above — patch the id in rather than re-serializing.
    if(data && data.project) data.project.id=id;
    const firstThumb=(AppState.slides&&AppState.slides[0]&&AppState.slides[0].thumbnail)||null;
    try{
      CreatorProjectStore.upsert(id,{
        name:(data&&data.project&&(data.project.bookTitle||data.project.title))||'Untitled',
        thumbnail:firstThumb
      },data);
      _scheduleCloudProjectSync(id);
    }catch(e){}
  }

  function _writeStorage(){
    setStatus('saving');
    try{
      const data=serialize();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      _syncProjectStore(data);
      setStatus('saved');
      // Phase D — only a write that actually reached localStorage is
      // worth walking the live slides for legacy data: fields to migrate.
      _scheduleAssetMigration();
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
    // Any parsed-and-validated session is restorable — even before the first
    // page is uploaded, partial state (theme, title, options) is real user
    // work that must survive a reload.
    return {
      state:'valid',
      data:data,
      title:(data.project&&data.project.title)||'Untitled',
      pageCount:(data.pages||[]).length
    };
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

  // Platform Hardening — Draft Asset Architecture, Phase C (plan §8). A
  // portable .vihu file must stay self-contained outside this app's own
  // Supabase project, so any vihu-asset: reference in the built payload
  // needs hydrating back to a real, embedded data: URI before the file is
  // written — every accessor pair here is a plain {get,set} over one
  // asset-bearing field in the JUST-SERIALIZED payload (never the live
  // AppState.slides objects), so this never mutates what's actually
  // persisted to localStorage/cloud, only the one-off exported copy.
  function _collectExportAssetAccessors(payload){
    const jobs=[];
    (payload.pages||[]).forEach(function(page){
      jobs.push({ get:function(){ return page.image; }, set:function(v){ page.image=v; } });
      const md=page.metadata;
      if(md && md.placeContent){
        Object.keys(md.placeContent).forEach(function(pid){
          const entry=md.placeContent[pid];
          if(entry) jobs.push({ get:function(){ return entry.dataURL; }, set:function(v){ entry.dataURL=v; } });
        });
      }
      if(md && md.elementOverrides){
        Object.keys(md.elementOverrides).forEach(function(oid){
          const entry=md.elementOverrides[oid];
          if(entry && typeof entry.image!=='undefined') jobs.push({ get:function(){ return entry.image; }, set:function(v){ entry.image=v; } });
        });
      }
    });
    return jobs;
  }

  async function _hydratePayloadForExport(payload){
    if(typeof window==='undefined' || !window.AssetStore) return payload;
    const accessors=_collectExportAssetAccessors(payload);
    for(let i=0;i<accessors.length;i++){
      const a=accessors[i];
      const v=a.get();
      if(typeof v==='string' && v.indexOf('vihu-asset:')===0){
        try{
          const dataURL=await window.AssetStore.hydrateForExport(v);
          if(dataURL) a.set(dataURL);
          // else: leave the un-hydrated reference in place — a real,
          // disclosed, rare failure (offline + never cached); the
          // exported file still opens, just without that one picture.
        }catch(e){ /* leave the un-hydrated reference in place */ }
      }
    }
    return payload;
  }

  async function saveProjectAs(filename){
    try{
      const data=serialize();
      await _hydratePayloadForExport(data);
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

  // Item 1 — opens a record from CreatorProjectStore.list() directly
  // (no file, no dialog) — the "My Projects" entry point on Creation
  // Flow Screen 1 calls this to jump straight into the editor.
  async function openProjectRecord(record){
    if(!record||!record.data) return false;
    await deserialize(record.data);
    _writeStorage();
    return true;
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
    openProjectRecord:openProjectRecord,
    getSessionStatus:getSessionStatus,
    restoreSession:restoreSession,
    discardSession:discardSession,
    // Platform Hardening — Draft Asset Architecture, Phase C. Exposes the
    // same lazy id-minting _writeStorage()/_syncProjectStore() already use
    // internally, so an upload producer (js/app.js, js/contextPanel.js,
    // js/pageDesigner.js) can get a stable projectId for AssetStore.put()
    // even on a brand-new project's very first upload, before any save has
    // ever run — guaranteeing exactly one id is ever minted per project,
    // never a race between two producers minting two different ones.
    ensureProjectId:_ensureProjectId
  };
  try{ window.ProjectManager=api; }catch(e){}
  return api;
})();
