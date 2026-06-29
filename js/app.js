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
const leftThemeCardEl=document.getElementById('leftThemeCard');
const themePickerModal=document.getElementById('themePickerModal');
const themePickerClose=document.getElementById('themePickerClose');
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
  try{ ThemeEngine.buildLeftPaneCard(); }catch(e){}
  try{ ThemeEngine.buildDesigner(); }catch(e){}
}

// Card Designer foundation bootstrap (Sprint 4.1) — mount the reusable
// component into its right-pane host. Sprint 4.2 wires the Image section to
// the active slide. Sprint 4.3 adds Text selection + override controls via
// getSelectedTextElement / setSelectedTextElement / getTextDefaults hooks.
let _selectedTextElement=null;
let _textDragState=null; // {elementId, startClientX, startClientY, sx, sy, baseOffX, baseOffY, moved}
const _TEXT_BASE_DEFAULTS={fontWeight:'normal',fontStyle:'normal',opacity:1,letterSpacing:0,lineHeight:1.2};

function _getTextDefaults(elementId){
  const theme=(typeof ThemeEngine!=='undefined')?ThemeEngine.getActiveTheme():null;
  const opts=(typeof ThemeEngine!=='undefined')?ThemeEngine.getOptions():null;
  if(!theme||!opts){
    return Object.assign({fontSize:24,fontFamily:'Arial',color:'#FFFFFF',alignment:'left'},_TEXT_BASE_DEFAULTS);
  }
  switch(elementId){
    case 'story-text':
      return Object.assign({fontSize:theme.storyText.size,fontFamily:theme.storyText.font,color:theme.storyText.color,alignment:'left'},_TEXT_BASE_DEFAULTS);
    case 'footer': {
      let size=theme.footerText.size;
      if(opts.footerStyle==='modern') size=Math.round(size*1.1);
      else if(opts.footerStyle==='minimal') size=Math.round(size*0.75);
      const pos=opts.bookTitlePosition||'bottom-left';
      const align=pos==='bottom-center'?'center':(pos==='bottom-right'?'right':'left');
      return Object.assign({fontSize:size,fontFamily:theme.footerText.font,color:theme.footerText.color,alignment:align},_TEXT_BASE_DEFAULTS);
    }
    case 'page-number': {
      const align=opts.pageNumber==='bottom-center'?'center':'left';
      return Object.assign({fontSize:theme.footerText.size,fontFamily:theme.footerText.font,color:theme.footerText.color,alignment:align},_TEXT_BASE_DEFAULTS);
    }
    case 'handle': {
      const pos=opts.handlePosition||'top-right';
      const align=(pos==='top-left'||pos==='bottom-left')?'left':'right';
      return Object.assign({fontSize:theme.watermark.size,fontFamily:theme.watermark.font,color:theme.watermark.color,alignment:align},_TEXT_BASE_DEFAULTS);
    }
    default:
      return Object.assign({fontSize:24,fontFamily:'Arial',color:'#FFFFFF',alignment:'left'},_TEXT_BASE_DEFAULTS);
  }
}

function _ensureTextPosition(slide,id){
  if(!slide.metadata) slide.metadata={};
  if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
  if(!slide.metadata.cardOverrides.textElements) slide.metadata.cardOverrides.textElements={};
  if(!slide.metadata.cardOverrides.textElements[id]) slide.metadata.cardOverrides.textElements[id]={};
  const entry=slide.metadata.cardOverrides.textElements[id];
  if(!entry.position) entry.position={offsetX:0,offsetY:0};
  if(typeof entry.position.offsetX!=='number') entry.position.offsetX=0;
  if(typeof entry.position.offsetY!=='number') entry.position.offsetY=0;
  return entry.position;
}

if(typeof CardDesigner!=='undefined'){
  try{ CardDesigner.mount(document.getElementById('cardDesignerRoot')); }catch(e){}
  try{
    CardDesigner.configure({
      getCurrentSlide:function(){ return AppState.slides[AppState.currentSlide]; },
      redraw:function(){ if(typeof window.redrawPreview==='function') window.redrawPreview(); },
      markDirty:function(){ if(window.ProjectManager) ProjectManager.markDirty(); },
      getSelectedTextElement:function(){ return _selectedTextElement; },
      setSelectedTextElement:function(id){ _setSelectedTextElement(id); },
      getTextDefaults:_getTextDefaults
    });
  }catch(e){}
}

function _setSelectedTextElement(id){
  _selectedTextElement=id||null;
  if(typeof window.redrawPreview==='function') window.redrawPreview();
  if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
  if(id){
    // Auto-activate Card Designer tab and Text section.
    const cardTabBtn=document.querySelector('.tab-btn[data-tab="card"]');
    if(cardTabBtn && !cardTabBtn.classList.contains('active')) cardTabBtn.click();
    const textSection=document.querySelector('[data-card-section="text"]');
    if(textSection && textSection.classList.contains('collapsed')){
      const header=textSection.querySelector('.designer-group-title');
      if(header) header.click();
    }
  }
}
if(leftThemeCardEl){
  leftThemeCardEl.addEventListener('click',function(){
    if(typeof ThemeEngine!=='undefined') ThemeEngine.openThemePicker();
  });
}
if(themePickerClose){
  themePickerClose.addEventListener('click',function(){
    if(typeof ThemeEngine!=='undefined') ThemeEngine.closeThemePicker();
  });
}
if(themePickerModal){
  themePickerModal.addEventListener('click',function(e){
    if(e.target===themePickerModal){
      if(typeof ThemeEngine!=='undefined') ThemeEngine.closeThemePicker();
    }
  });
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

// Designer Palette collapsible sections (T3.3.4 refinement) — permanent vertical list,
// each section independently expandable/collapsible; pure presentation.
// Scoped to Theme Designer sections (those carry data-section); the Card
// Designer's own sections carry data-card-section and CardDesigner.mount()
// binds their collapse handlers itself, so they would double-toggle if this
// selector caught them too.
document.querySelectorAll('[data-section] [data-collapsible-toggle]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const group=btn.closest('.designer-group');
    if(!group) return;
    const collapsed=group.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded',collapsed?'false':'true');
  });
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
 // Re-sync the Card Designer's Image section with the newly-active slide.
 if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
 _updateCanvasCursor();
};

function draw(){
 if(!AppState.slides.length)return;
 const s=AppState.slides[AppState.currentSlide];
 s.storyBeat=story.value;
 s.page=page.value;
 s.totalPages=AppState.slides.length;
 const theme=(typeof ThemeEngine!=='undefined')?ThemeEngine.getActiveTheme():null;
 const themeOptions=(typeof ThemeEngine!=='undefined')?ThemeEngine.getOptions():null;
 const imageView=(s.metadata && s.metadata.imageView) || null;
 const overrides=(s.metadata && s.metadata.cardOverrides) || null;
 const dragActiveId=(_textDragState && _textDragState.moved) ? _textDragState.elementId : null;
 SlideRenderer.render({image:s.image,storyBeat:s.storyBeat,bookTitle:title.value,page:s.page,totalPages:s.totalPages,theme:theme,themeOptions:themeOptions,imageView:imageView,overrides:overrides,selectedTextElement:_selectedTextElement,dragActiveId:dragActiveId});
 if(s.thumbnail){
   if(!s._lastStory || s._lastStory!==s.storyBeat){ delete s.thumbnail; }
 }
 s._lastStory=s.storyBeat;
}

// Exposed redraw used by CardDesigner.configure({redraw}). Lighter-weight
// than showSlide — it skips the input/highlight resync that only matters
// when switching slides.
window.redrawPreview=draw;

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
   if(themePickerModal && !themePickerModal.classList.contains('hidden')){
     if(typeof ThemeEngine!=='undefined') ThemeEngine.closeThemePicker();
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
if(themeToggleEl){ themeToggleEl.addEventListener('click',()=>setTimeout(markDirty,0)); }

// --- Canvas pan (Sprint 4.2) ---------------------------------------------
// Drag inside the panel rect translates the image's offsetX/offsetY in
// canvas-pixel space. The original Image object is never touched — only
// slide.metadata.imageView is mutated.
let _panState=null;

function _canvasCoords(e){
  const rect=previewCanvas.getBoundingClientRect();
  const sx=previewCanvas.width/rect.width;
  const sy=previewCanvas.height/rect.height;
  return {
    x:(e.clientX-rect.left)*sx,
    y:(e.clientY-rect.top)*sy,
    sx:sx, sy:sy
  };
}

function _isInsidePanel(canvasX,canvasY){
  if(typeof SlideRenderer.getPanelRect!=='function') return false;
  const r=SlideRenderer.getPanelRect();
  return canvasX>=r.x && canvasX<=r.x+r.w && canvasY>=r.y && canvasY<=r.y+r.h;
}

function _updateCanvasCursor(){
  if(!previewCanvas) return;
  const s=AppState.slides[AppState.currentSlide];
  if(s && s.image){
    previewCanvas.classList.add('canvas-pannable');
  }else{
    previewCanvas.classList.remove('canvas-pannable');
  }
}

function _hitTestText(canvasX,canvasY){
  if(typeof SlideRenderer.getTextElements!=='function') return null;
  const els=SlideRenderer.getTextElements();
  for(let i=els.length-1;i>=0;i--){
    const el=els[i];
    if(canvasX>=el.bx && canvasX<=el.bx+el.bw && canvasY>=el.by && canvasY<=el.by+el.bh){
      return el;
    }
  }
  return null;
}

const TEXT_DRAG_THRESHOLD=3;

previewCanvas.addEventListener('mousedown',function(e){
  const s=AppState.slides[AppState.currentSlide];
  if(!s) return;
  const c=_canvasCoords(e);

  // Sprint 4.3 — text selection takes priority over image pan.
  // Sprint 4.4 — same gesture also primes a drag; movement past
  // TEXT_DRAG_THRESHOLD activates it.
  const hit=_hitTestText(c.x,c.y);
  if(hit){
    _setSelectedTextElement(hit.id);
    const ovMap=(s.metadata && s.metadata.cardOverrides && s.metadata.cardOverrides.textElements)||{};
    const pos=(ovMap[hit.id] && ovMap[hit.id].position)||{};
    _textDragState={
      elementId:hit.id,
      startClientX:e.clientX,startClientY:e.clientY,
      sx:c.sx,sy:c.sy,
      baseOffX:pos.offsetX||0,baseOffY:pos.offsetY||0,
      moved:false
    };
    e.preventDefault();
    return;
  }

  // Image pan inside the panel rect (Sprint 4.2 behavior).
  if(s.image && _isInsidePanel(c.x,c.y) && typeof CardDesigner!=='undefined'){
    const v=CardDesigner.getActiveImageView();
    if(v){
      _panState={startX:e.clientX,startY:e.clientY,sx:c.sx,sy:c.sy,offX:v.offsetX||0,offY:v.offsetY||0};
      previewCanvas.classList.add('canvas-panning');
      e.preventDefault();
      return;
    }
  }

  // Clicked empty space — clear any text selection.
  if(_selectedTextElement){
    _setSelectedTextElement(null);
  }
});

document.addEventListener('mousemove',function(e){
  // Text drag (Sprint 4.4)
  if(_textDragState){
    const s=AppState.slides[AppState.currentSlide];
    if(!s) return;
    const dx=(e.clientX-_textDragState.startClientX)*_textDragState.sx;
    const dy=(e.clientY-_textDragState.startClientY)*_textDragState.sy;
    if(!_textDragState.moved){
      if(Math.abs(dx)+Math.abs(dy)<TEXT_DRAG_THRESHOLD) return;
      _textDragState.moved=true;
      previewCanvas.classList.add('canvas-text-dragging');
    }
    const pos=_ensureTextPosition(s,_textDragState.elementId);
    pos.offsetX=_textDragState.baseOffX+dx;
    pos.offsetY=_textDragState.baseOffY+dy;
    delete s.thumbnail;
    draw();
    if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(err){} }
    return;
  }

  // Image pan (Sprint 4.2)
  if(!_panState) return;
  const s2=AppState.slides[AppState.currentSlide];
  if(!s2) return;
  if(!s2.metadata||!s2.metadata.imageView) return;
  const dx2=(e.clientX-_panState.startX)*_panState.sx;
  const dy2=(e.clientY-_panState.startY)*_panState.sy;
  s2.metadata.imageView.offsetX=_panState.offX+dx2;
  s2.metadata.imageView.offsetY=_panState.offY+dy2;
  delete s2.thumbnail;
  draw();
});

document.addEventListener('mouseup',function(){
  // Text drag end
  if(_textDragState){
    const wasMoved=_textDragState.moved;
    _textDragState=null;
    previewCanvas.classList.remove('canvas-text-dragging');
    if(wasMoved){
      markDirty();
      const s=AppState.slides[AppState.currentSlide];
      if(s && typeof ThumbnailEngine!=='undefined'){
        try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(e){}
      }
      // Redraw without dragActiveId so guides disappear.
      draw();
    }
    return;
  }

  // Image pan end
  if(!_panState) return;
  _panState=null;
  previewCanvas.classList.remove('canvas-panning');
  // Persist + refresh thumbnails once at the end of the gesture, so the
  // mousemove path stays at 60fps.
  markDirty();
  const s=AppState.slides[AppState.currentSlide];
  if(s && typeof ThumbnailEngine!=='undefined'){
    try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(e){}
  }
});

// Arrow-key nudge for selected text (Sprint 4.4) — 1px, Shift = 10px.
// Skipped when the user is typing in an input/textarea/select so the
// existing Story Beat / Page Number / Theme controls are unaffected.
const ARROW_DELTAS={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
document.addEventListener('keydown',function(e){
  if(!_selectedTextElement) return;
  const active=document.activeElement;
  if(active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.tagName==='SELECT')) return;
  const d=ARROW_DELTAS[e.key];
  if(!d) return;
  e.preventDefault();
  const step=e.shiftKey?10:1;
  const s=AppState.slides[AppState.currentSlide];
  if(!s) return;
  const pos=_ensureTextPosition(s,_selectedTextElement);
  pos.offsetX=(pos.offsetX||0)+d[0]*step;
  pos.offsetY=(pos.offsetY||0)+d[1]*step;
  delete s.thumbnail;
  draw();
  if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(err){} }
  markDirty();
  // Regenerate thumbnail asynchronously
  if(typeof ThumbnailEngine!=='undefined'){
    try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(err){}
  }
});

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
    const hasPages=(info.pageCount||0)>0;
    const body=hasPages
      ? 'Continue working on “'+(info.title||'Untitled')+'” from your last session?'
      : 'Pick up where you left off on “'+(info.title||'Untitled')+'” — your project setup is saved.';
    showRestoreModal({
      title:'Restore Previous Project?',
      body:body,
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
