window.addEventListener('DOMContentLoaded',()=>{
const uploadBtn=document.getElementById('uploadBtn');
const upload=document.getElementById('scanUpload');
const story=document.getElementById('storyBeat');
const title=document.getElementById('bookTitle');
const page=document.getElementById('pageNumber');
const total=document.getElementById('totalPages');
const previewCanvas=document.getElementById('previewCanvas');
const contextMenu=document.getElementById('contextMenu');
const exportBtn=document.getElementById('exportBtn');
const tabs=document.querySelectorAll('.tab-btn');
const projectTitleEl=document.getElementById('projectTitle');
const projectAuthorEl=document.getElementById('projectAuthorName');
const themeSelectEl=document.getElementById('themeSelect');
const themeToggleEl=document.getElementById('themeToggle');
const saveBtn=document.getElementById('saveBtn');
const openBtn=document.getElementById('openBtn');
const openInput=document.getElementById('openProjectInput');
const autosaveStatus=document.getElementById('autosaveStatus');
const restoreModal=document.getElementById('restoreModal');
const restoreTitle=document.getElementById('restoreModalTitle');
const restoreBody=document.getElementById('restoreModalBody');
const restorePrimary=document.getElementById('restoreModalPrimary');
const restoreSecondary=document.getElementById('restoreModalSecondary');
let contextMenuTarget=null;
let contextMenuPos={x:0,y:0};

SlideRenderer.init(previewCanvas);
if(window.ThumbnailEngine||typeof ThumbnailEngine!=='undefined'){
  try{ ThumbnailEngine.init(previewCanvas); }catch(e){}
}

// Theme Engine bootstrap
if(typeof ThemeEngine!=='undefined'){
  try{ ThemeEngine.populateSelector(themeSelectEl); }catch(e){}
  try{ ThemeEngine.buildCards(document.getElementById('themeCards')); }catch(e){}
  try{ ThemeEngine.buildDesigner(); }catch(e){}
  if(themeSelectEl){
    themeSelectEl.addEventListener('change',function(){
      ThemeEngine.applyTheme(themeSelectEl.value);
    });
  }
}

const STATUS_LABEL={saving:'Saving...',saved:'Saved',failed:'Save Failed',unsaved:'Unsaved'};
function setAutosaveStatus(state){
  if(!autosaveStatus) return;
  autosaveStatus.textContent=STATUS_LABEL[state]||'';
  autosaveStatus.classList.toggle('is-saving',state==='saving');
  autosaveStatus.classList.toggle('is-failed',state==='failed');
}
if(window.ProjectManager){
  ProjectManager.setStatusCallback(setAutosaveStatus);
  setAutosaveStatus('saved');
}
function markDirty(){ if(window.ProjectManager) ProjectManager.markDirty(); }

uploadBtn.onclick=()=>upload.click();
upload.onchange=e=>{
 const files=[...e.target.files];
 const newSlides=[];
 let loaded=0;

 files.forEach((file,i)=>{
   const img=new Image();
   img.onload=()=>{
      const slideObj={id:Date.now()+i,image:img,storyBeat:'',pageType:'story',page:AppState.slides.length+newSlides.length+1,totalPages:0};
      newSlides.push(slideObj);
      AppState.slides.push(slideObj);
      loaded++;
      renderList();
      renderTimeline();
      if(AppState.slides.length===1) showSlide(0);
      if(loaded===files.length && newSlides.length>0){
        try{ ThumbnailEngine.generateBatch(newSlides).then(()=>{
           newSlides.forEach((s,idx)=>{
             const el=document.querySelector('#slideList [data-index="'+(AppState.slides.indexOf(s))+'"] img');
             if(el && s.thumbnail) el.src=s.thumbnail;
             const tEl=document.querySelector('#timelineList [data-index="'+(AppState.slides.indexOf(s))+'"] img');
             if(tEl && s.thumbnail) tEl.src=s.thumbnail;
           });
           markDirty();
        }); }catch(e){}
      }
      markDirty();
   };
   img.src=URL.createObjectURL(file);
 });
 // allow re-uploading the same file later
 e.target.value='';
};

exportBtn.onclick=()=>{
  alert('Export feature coming in Sprint 3');
};

if(saveBtn){
  saveBtn.onclick=()=>{
    if(!window.ProjectManager) return;
    const titleVal=(projectTitleEl&&projectTitleEl.value)||'project';
    ProjectManager.saveProjectAs(titleVal);
  };
}

if(openBtn && openInput){
  openBtn.onclick=()=>openInput.click();
  openInput.onchange=async (e)=>{
    const file=e.target.files && e.target.files[0];
    if(!file) return;
    try{
      await ProjectManager.openProject(file);
      setAutosaveStatus('saved');
    }catch(err){
      alert('Could not open project: '+(err&&err.message?err.message:'unknown error'));
      setAutosaveStatus('failed');
    }
    e.target.value='';
  };
}

tabs.forEach(btn=>{
  btn.onclick=()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('active'));
    btn.classList.add('active');
    const tab=btn.getAttribute('data-tab');
    const content=document.getElementById(tab+'-tab');
    if(content) content.classList.add('active');
  };
});

window.renderList=function(){
 const list=document.getElementById('slideList');
 list.innerHTML='';
 AppState.slides.forEach((s,i)=>{
   const d=document.createElement('div');
   d.className='thumb';
   d.setAttribute('data-index',i);

   const menuBtn=document.createElement('button');
   menuBtn.className='thumb-menu-btn';
   menuBtn.textContent='⋮';
   menuBtn.onclick=(e)=>{
     e.stopPropagation();
     showContextMenu(e,i);
   };
   d.appendChild(menuBtn);

   const img=document.createElement('img');
   if(s.thumbnail) img.src=s.thumbnail; else{
     const ph=document.createElement('div'); ph.className='placeholder'; ph.textContent='Page '+(i+1);
     d.appendChild(ph);
   }

   if(s.thumbnail) d.appendChild(img);

   const lbl=document.createElement('div'); lbl.className='page-label'; lbl.textContent='Page '+(i+1);
   d.appendChild(lbl);

   d.onclick=()=>showSlide(i);
   if(i===AppState.currentSlide) d.classList.add('selected');
   list.appendChild(d);

   if(!s.thumbnail){
     try{ ThumbnailEngine.generate(s).then(src=>{
        const container=document.querySelector('#slideList [data-index="'+i+'"]');
        if(container && src){
          const ph=container.querySelector('.placeholder'); if(ph) ph.remove();
          const im=new Image(); im.src=src; im.onload=()=>{
            container.insertBefore(im, container.querySelector('.page-label'));
          };
        }
     }); }catch(e){}
   }
 });
};

window.renderTimeline=function(){
 const timeline=document.getElementById('timelineList');
 timeline.innerHTML='';
 AppState.slides.forEach((s,i)=>{
   const t=document.createElement('div');
   t.className='timeline-thumb';
   t.setAttribute('data-index',i);
   t.title='Page '+(i+1);

   if(s.thumbnail){
     const img=document.createElement('img');
     img.src=s.thumbnail;
     t.appendChild(img);
   }else{
     const ph=document.createElement('div'); ph.className='placeholder'; ph.textContent='Page '+(i+1);
     t.appendChild(ph);
   }

   if(i===AppState.currentSlide) t.classList.add('active');
   t.onclick=()=>showSlide(i);
   timeline.appendChild(t);

   if(!s.thumbnail){
     try{ ThumbnailEngine.generate(s).then(src=>{
        const container=document.querySelector('#timelineList [data-index="'+i+'"]');
        if(container && src){
          const ph=container.querySelector('.placeholder'); if(ph) ph.remove();
          const im=document.createElement('img'); im.src=src;
          container.appendChild(im);
        }
     }); }catch(e){}
   }
 });
};

window.showSlide=function(i){
 AppState.currentSlide=i;
 const s=AppState.slides[i];
 if(!s) return;
 story.value=s.storyBeat;
 page.value=s.page;
 total.value=AppState.slides.length;
 draw();
 document.querySelectorAll('#slideList .thumb').forEach(el=>el.classList.remove('selected'));
 const sel=document.querySelector('#slideList [data-index="'+i+'"]'); if(sel) sel.classList.add('selected');
 document.querySelectorAll('#timelineList .timeline-thumb').forEach(el=>el.classList.remove('active'));
 const tsel=document.querySelector('#timelineList [data-index="'+i+'"]'); if(tsel) tsel.classList.add('active');
};

function draw(){
 if(!AppState.slides.length)return;
 const s=AppState.slides[AppState.currentSlide];
 s.storyBeat=story.value;
 s.page=page.value;
 s.totalPages=AppState.slides.length;
 const theme=(typeof ThemeEngine!=='undefined')?ThemeEngine.getActiveTheme():null;
 const themeOptions=(typeof ThemeEngine!=='undefined')?ThemeEngine.getOptions():null;
 SlideRenderer.render({image:s.image,storyBeat:s.storyBeat,bookTitle:title.value,page:s.page,totalPages:s.totalPages,theme:theme,themeOptions:themeOptions});
 if(s.thumbnail){
   if(!s._lastStory || s._lastStory!==s.storyBeat){ delete s.thumbnail; }
 }
 s._lastStory=s.storyBeat;
}

function showContextMenu(e,index){
 contextMenuTarget=index;
 const rect=e.target.getBoundingClientRect();
 let x=rect.right+10;
 let y=rect.top;

 const menuWidth=160;
 const menuHeight=280;
 const windowWidth=window.innerWidth;
 const windowHeight=window.innerHeight;

 if(x+menuWidth>windowWidth) x=rect.left-menuWidth-10;
 if(y+menuHeight>windowHeight) y=windowHeight-menuHeight-10;

 contextMenu.style.left=x+'px';
 contextMenu.style.top=y+'px';
 contextMenu.classList.remove('hidden');
 contextMenuPos={x,y};
}

function closeContextMenu(){
 contextMenu.classList.add('hidden');
 contextMenuTarget=null;
}

document.addEventListener('click',(e)=>{
 if(!e.target.closest('.context-menu') && !e.target.closest('.thumb-menu-btn')){
   closeContextMenu();
 }
});

document.addEventListener('keydown',(e)=>{
 if(e.key==='Escape'){
   closeContextMenu();
   if(restoreModal && !restoreModal.classList.contains('hidden')){
     hideRestoreModal();
   }
 }
});

const CONTEXT_ACTIONS={
  'duplicate':'duplicatePage',
  'delete':'deletePage',
  'blank':'insertBlankPage',
  'add-before':'addBefore',
  'add-after':'addAfter',
  'move-end':'moveToEnd',
  'set-cover':'setAsCover',
  'export-page':'exportPage'
};
const contextItems=contextMenu.querySelectorAll('.context-item');
contextItems.forEach(item=>{
 item.onclick=(e)=>{
   e.preventDefault();
   const action=item.getAttribute('data-action');
   const target=contextMenuTarget;
   closeContextMenu();
   if(target===null||target<0) return;
   const method=CONTEXT_ACTIONS[action];
   if(!method||typeof PageOps[method]!=='function') return;
   try{ PageOps[method](target); }catch(err){ /* swallow */ }
 };
});

[story,title,page,total].forEach(el=>el.oninput=draw);

// Persistence-aware input listeners (do not interfere with draw())
[story,title,page,projectTitleEl,projectAuthorEl].forEach(el=>{
  if(!el) return;
  el.addEventListener('input',markDirty);
});
if(themeSelectEl){ themeSelectEl.addEventListener('change',markDirty); }
if(themeToggleEl){ themeToggleEl.addEventListener('click',()=>setTimeout(markDirty,0)); }

// Restore-modal helpers
function showRestoreModal(opts){
  if(!restoreModal) return;
  restoreTitle.textContent=opts.title||'Restore Previous Project?';
  restoreBody.textContent=opts.body||'You have a session from your previous visit.';
  restorePrimary.textContent=opts.primary||'Restore';
  restoreSecondary.textContent=opts.secondary||'Discard';
  restoreModal.classList.remove('hidden');
  restorePrimary.onclick=async ()=>{
    hideRestoreModal();
    if(opts.onPrimary) await opts.onPrimary();
  };
  restoreSecondary.onclick=async ()=>{
    hideRestoreModal();
    if(opts.onSecondary) await opts.onSecondary();
  };
}
function hideRestoreModal(){ if(restoreModal) restoreModal.classList.add('hidden'); }

// Session bootstrap
(function bootstrapSession(){
  if(!window.ProjectManager){ setAutosaveStatus('saved'); return; }
  const info=ProjectManager.getSessionStatus();
  if(info.state==='valid'){
    showRestoreModal({
      title:'Restore Previous Project?',
      body:'Continue working on “'+(info.title||'Untitled')+'” from your last session?',
      primary:'Restore',
      secondary:'Discard',
      onPrimary:async ()=>{
        try{ await ProjectManager.restoreSession(); setAutosaveStatus('saved'); }
        catch(e){ ProjectManager.discardSession(); setAutosaveStatus('failed'); }
      },
      onSecondary:()=>{ ProjectManager.discardSession(); setAutosaveStatus('saved'); }
    });
  }else if(info.state==='corrupt'){
    showRestoreModal({
      title:'Saved Session Unavailable',
      body:'Your previous session could not be loaded (it may be corrupted or from a newer version).',
      primary:'Start New Project',
      secondary:'Discard Saved Session',
      onPrimary:()=>{ ProjectManager.discardSession(); setAutosaveStatus('saved'); },
      onSecondary:()=>{ ProjectManager.discardSession(); setAutosaveStatus('saved'); }
    });
  }else{
    setAutosaveStatus('saved');
  }
})();
});
