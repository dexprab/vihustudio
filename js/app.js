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
// Sprint 6.5 (Object Designer) — canvas selection state for scene elements
// (Frame, decorations). The renderer paints a gold outline + resize handles
// around the selected element and `_resizeDragState` drives handle drags.
let _selectedSceneElement=null;
let _selectedSceneElementType=null;
let _resizeDragState=null;
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
      getTextDefaults:_getTextDefaults,
      // Sprint 6.6 — sticker selection bridge so the Card Designer's
      // Sticker section can read + drive the active object.
      getSelectedSceneElement:function(){ return _selectedSceneElement; },
      getSelectedSceneElementType:function(){ return _selectedSceneElementType; },
      setSelectedSceneElement:function(id,type){ _setSelectedSceneElement(id,type); }
    });
  }catch(e){}
}

// Story Designer bootstrap (Sprint 5.0) — owns content only; live edits
// flow through the existing draw() / markDirty chain via hidden plumbing
// inputs and a tiny per-slide metadata override for footerText / handle.
if(typeof PageDesigner!=='undefined'){
  try{ PageDesigner.mount(document.getElementById('pageDesignerRoot')); }catch(e){}
  try{
    PageDesigner.configure({
      getCurrentSlide:function(){ return AppState.slides[AppState.currentSlide]; },
      redraw:function(){ if(typeof window.redrawPreview==='function') window.redrawPreview(); },
      markDirty:function(){ if(window.ProjectManager) ProjectManager.markDirty(); }
    });
  }catch(e){}
}

// Sprint 6.6.1 — Preview Studio is no longer mounted in the editor. The
// editor is always the live preview; publishing belongs to Publish
// Studio (Sprint 8.0). The PreviewStudio module remains on disk so
// future Publish Studio work can lift its platform renderer logic.

// Sticker Studio bootstrap (Sprint 6.6) — browse + insert stickers. The
// studio inserts into SceneEngine, then asks the host to select the new
// instance so the gold outline + resize handles appear immediately.
if(typeof StickerStudio!=='undefined'){
  try{ StickerStudio.mount(document.getElementById('stickerStudioRoot')); }catch(e){}
  try{
    StickerStudio.configure({
      getCurrentSlide:function(){ return AppState.slides[AppState.currentSlide]; },
      redraw:function(){ if(typeof window.redrawPreview==='function') window.redrawPreview(); },
      markDirty:function(){ if(window.ProjectManager) ProjectManager.markDirty(); },
      setSelectedSticker:function(id,type){ _setSelectedSceneElement(id,type||'sticker'); },
      refreshThumbnails:function(){
        const s=AppState.slides[AppState.currentSlide];
        if(s && typeof ThumbnailEngine!=='undefined'){
          try{ ThumbnailEngine.generate(s).then(function(){
            if(typeof renderList==='function') renderList();
            if(typeof renderTimeline==='function') renderTimeline();
          }); }catch(e){}
        }
      }
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

// Sprint 6.5 (Object Designer) — selecting a scene element auto-routes
// to the right pane's correct designer. Sprint 6.6.1 — the Universal
// Object principle: every editable object — Frame, Sticker, Text,
// Decoration — opens its controls in the Card Designer ("Object
// Designer") the instant it's selected. Tab activation happens FIRST so
// no subsequent refresh can accidentally race the selection back to
// another tab.
function _activateTab(tabId){
  const btn=document.querySelector('.tab-btn[data-tab="'+tabId+'"]');
  if(btn && !btn.classList.contains('active')) btn.click();
}
window.setSelectedSceneElement=function(id,elementType){ _setSelectedSceneElement(id,elementType); };
function _setSelectedSceneElement(id, elementType){
  _selectedSceneElement=id||null;
  _selectedSceneElementType=id ? (elementType||null) : null;
  if(_selectedSceneElement && _selectedTextElement){
    // Mutually exclusive — selecting a scene element clears any text
    // selection so the right pane shows one clear context.
    _selectedTextElement=null;
  }
  // Tab activation FIRST — any refresh that runs afterward sees the
  // correct active tab. Sprint 8.3 (Universal Object Consistency):
  // Frame / Sticker / Text → Card Designer (full Object Designer
  // controls). Decorations → Story tab (the Page Designer's Element
  // checklist now carries Lock alongside visibility + reset, so the
  // child has one row per element with the same shape).
  if(id){
    if(elementType==='image-holder' || elementType==='text-holder' ||
       elementType==='text' || elementType==='sticker'){
      _activateTab('card');
    }else if(elementType==='decoration'){
      _activateTab('story');
    }
  }
  if(typeof window.redrawPreview==='function') window.redrawPreview();
  if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
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

// Sprint 6.7 — single-file uploads now route through Picture Studio so
// the child can prepare the picture before it lands on the page.
// Multi-file uploads keep the bulk-import flow (children importing a
// whole scanned book shouldn't be stopped at every page).
function _insertPreparedSlide(dataUrl, mode){
  const img=new Image();
  img.onload=function(){
    const slideObj={
      id:Date.now(),
      image:img,
      _imageDataURL:dataUrl,
      storyBeat:'',
      pageType:'story',
      page:AppState.slides.length+1,
      totalPages:0,
      metadata:{
        cardOverrides:{ image:{ mode:mode||'fit', fit:mode||'fit', scale:1, offsetX:0, offsetY:0 } }
      }
    };
    AppState.slides.push(slideObj);
    renderList();
    renderTimeline();
    const idx=AppState.slides.length-1;
    showSlide(idx);
    if(typeof ThumbnailEngine!=='undefined'){
      try{ ThumbnailEngine.generate(slideObj).then(function(){
        renderList(); renderTimeline();
      }); }catch(e){}
    }
    markDirty();
    // Route the right pane to the Card Designer so the child can keep
    // editing the picture immediately.
    const cardTabBtn=document.querySelector('.tab-btn[data-tab="card"]');
    if(cardTabBtn && !cardTabBtn.classList.contains('active')) cardTabBtn.click();
    if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(e){} }
  };
  img.src=dataUrl;
}

upload.onchange=e=>{
 const files=[...e.target.files];
 e.target.value='';
 if(files.length===0) return;
 if(files.length===1 && typeof PictureStudio!=='undefined'){
   PictureStudio.open(files[0],{
     defaultMode:'fit',
     onApply:function(result){
       _insertPreparedSlide(result.dataURL, result.imageView && result.imageView.mode);
     },
     onCancel:function(){ /* child chose not to add the picture */ }
   });
   return;
 }
 // Bulk import — original Sprint 6.3 fidelity path. Each file's ORIGINAL
 // encoding (PNG → PNG, JPEG → JPEG) is the canonical source.
 const newSlides=[];
 let loaded=0;
 files.forEach((file,i)=>{
   const reader=new FileReader();
   reader.onload=ev=>{
     const dataUrl=ev.target.result;
     const img=new Image();
     img.onload=()=>{
       const slideObj={id:Date.now()+i,image:img,_imageDataURL:dataUrl,storyBeat:'',pageType:'story',page:AppState.slides.length+newSlides.length+1,totalPages:0};
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
         }); }catch(err){}
       }
       markDirty();
     };
     img.src=dataUrl;
   };
   reader.readAsDataURL(file);
 });
};

// Sprint 8.1 retired the visible Export button; Sprint 8.3.4 guards the
// dormant handler so removing the hidden node later (or stripping the
// HTML completely) can't throw. Children publish books, not files.
if(exportBtn){
  exportBtn.onclick=()=>{
    alert('Export feature coming in Sprint 3');
  };
}

// Sprint 8.1.1 — Publish button opens Publish Studio. The editor stays
// exactly as it was underneath; closing the studio returns control with
// no state change.
const publishBtn=document.getElementById('publishBtn');
if(publishBtn){
  publishBtn.onclick=function(){
    if(typeof PublishStudio==='undefined') return;
    PublishStudio.open();
  };
}

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
    // Sprint 5.0 — selection sync: when the user switches to the Story tab
    // with a Card Designer text element selected, focus the matching field.
    if(tab==='story' && _selectedTextElement && typeof PageDesigner!=='undefined'){
      try{ PageDesigner.focusField(_selectedTextElement); }catch(e){}
    }
    // Sprint 6.6 — activating the Stickers tab re-renders so favorites /
    // recents are fresh after any insertion that happened from the
    // canvas side.
    if(tab==='stickers' && typeof StickerStudio!=='undefined'){
      try{ StickerStudio.refresh(); }catch(e){}
    }
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
 const canMove=(typeof PageOps!=='undefined' && typeof PageOps.canMove==='function')
   ? PageOps.canMove : function(){ return true; };
 AppState.slides.forEach((s,i)=>{
   const d=document.createElement('div');
   d.className='thumb';
   // Sprint 8.2 — Cover/End are anchored at the ends. Only movable
   // pages are draggable; the rest still respond to click + ⋮ menu.
   const movable=canMove(i);
   if(movable) d.setAttribute('draggable','true');
   if(s.pageType==='cover') d.classList.add('thumb-fixed','thumb-fixed-cover');
   if(s.pageType==='end') d.classList.add('thumb-fixed','thumb-fixed-end');
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

   const lbl=document.createElement('div'); lbl.className='page-label';
   lbl.textContent=(s && typeof s.name==='string' && s.name) ? s.name : ('Page '+(i+1));
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
 _wireSlideListDnD(list);
};

// Sprint 8.2 — HTML5 drag-and-drop reorder for the left page list.
// The thumbs themselves are the drag handles; an insertion indicator
// element gets re-positioned between them as the child drags. Fixed
// pages (Cover / End) are non-draggable and never accept drops.
let _slideDragSourceIdx=null;
let _slideDropIndicator=null;
function _wireSlideListDnD(list){
  if(!list) return;
  // One reusable insertion indicator. It floats absolutely so the
  // surrounding thumb layout doesn't shift while we move it around.
  if(!_slideDropIndicator){
    _slideDropIndicator=document.createElement('div');
    _slideDropIndicator.className='slide-drop-indicator hidden';
    document.body.appendChild(_slideDropIndicator);
  }

  list.addEventListener('dragstart',function(e){
    const t=e.target.closest('.thumb');
    if(!t) return;
    if(t.getAttribute('draggable')!=='true'){ e.preventDefault(); return; }
    _slideDragSourceIdx=parseInt(t.getAttribute('data-index'),10);
    try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',String(_slideDragSourceIdx)); }catch(_){}
    // Defer the styling so the browser uses the original element as the
    // drag image; if we set it synchronously, the ghost shows the
    // muted thumb.
    setTimeout(function(){ t.classList.add('is-dragging'); },0);
  });

  list.addEventListener('dragend',function(){
    list.querySelectorAll('.thumb.is-dragging').forEach(function(el){ el.classList.remove('is-dragging'); });
    _hideDropIndicator();
    _slideDragSourceIdx=null;
  });

  list.addEventListener('dragover',function(e){
    if(_slideDragSourceIdx===null) return;
    e.preventDefault();
    try{ e.dataTransfer.dropEffect='move'; }catch(_){}
    const dropIdx=_computeDropIndex(list,e.clientY);
    _showDropIndicator(list,dropIdx);
  });

  list.addEventListener('dragleave',function(e){
    // Only hide when the cursor leaves the list bounds entirely.
    const rel=e.relatedTarget;
    if(rel && list.contains(rel)) return;
    _hideDropIndicator();
  });

  list.addEventListener('drop',function(e){
    if(_slideDragSourceIdx===null) return;
    e.preventDefault();
    const dropIdx=_computeDropIndex(list,e.clientY);
    _hideDropIndicator();
    if(typeof PageOps!=='undefined' && typeof PageOps.reorderPage==='function'){
      // splice insertion: the dropIdx is where the moved page WILL
      // sit. PageOps.reorderPage already clamps to the moveable range
      // (between Cover and End).
      const from=_slideDragSourceIdx;
      const to=dropIdx>from ? dropIdx-1 : dropIdx;
      _slideDragSourceIdx=null;
      PageOps.reorderPage(from,to);
    }else{
      _slideDragSourceIdx=null;
    }
  });
}

function _computeDropIndex(list,clientY){
  // The insertion index = how many thumbs sit fully above the cursor.
  // We use each thumb's midpoint as the split line.
  const thumbs=list.querySelectorAll('.thumb');
  let idx=thumbs.length;
  for(let i=0;i<thumbs.length;i++){
    const t=thumbs[i];
    const r=t.getBoundingClientRect();
    if(clientY < r.top + r.height/2){ idx=i; break; }
  }
  return idx;
}

function _showDropIndicator(list,dropIdx){
  if(!_slideDropIndicator) return;
  const thumbs=list.querySelectorAll('.thumb');
  const listRect=list.getBoundingClientRect();
  let top;
  if(dropIdx>=thumbs.length){
    const last=thumbs[thumbs.length-1];
    if(!last) return;
    const r=last.getBoundingClientRect();
    top=r.bottom-listRect.top+list.scrollTop-3;
  }else{
    const t=thumbs[dropIdx];
    const r=t.getBoundingClientRect();
    top=r.top-listRect.top+list.scrollTop-3;
  }
  _slideDropIndicator.style.left=(listRect.left+8)+'px';
  _slideDropIndicator.style.top=(listRect.top+top)+'px';
  _slideDropIndicator.style.width=(listRect.width-16)+'px';
  _slideDropIndicator.classList.remove('hidden');
}
function _hideDropIndicator(){
  if(_slideDropIndicator) _slideDropIndicator.classList.add('hidden');
}

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
 // Re-sync the Story Designer's content fields (Sprint 5.0).
 if(typeof PageDesigner!=='undefined'){ try{ PageDesigner.refresh(); }catch(e){} }
 _updateCanvasCursor();
};

function draw(){
 if(!AppState.slides.length)return;
 const s=AppState.slides[AppState.currentSlide];
 s.storyBeat=story.value;
 s.page=page.value;
 s.totalPages=AppState.slides.length;
 // Sprint 6.4 — Preview, Thumbnail, and Export resolve through the same
 // SlideRenderer.buildPayload helper so WYSIWYE holds. Editor-only chrome
 // (selectedTextElement / dragActiveId) layers on top — Export omits them.
 const payload=SlideRenderer.buildPayload(s,{
   page:s.page,
   totalPages:s.totalPages,
   defaultBookTitle:title.value
 });
 payload.selectedTextElement=_selectedTextElement;
 payload.selectedSceneElement=_selectedSceneElement;
 payload.dragActiveId=(_textDragState && _textDragState.moved) ? _textDragState.elementId : null;
 SlideRenderer.render(payload);
 if(s.thumbnail){
   if(!s._lastStory || s._lastStory!==s.storyBeat){ delete s.thumbnail; }
 }
 s._lastStory=s.storyBeat;
}

// Exposed redraw used by CardDesigner.configure({redraw}). Lighter-weight
// than showSlide — it skips the input/highlight resync that only matters
// when switching slides.
window.redrawPreview=function(){
  draw();
  // Sprint 5.1 — overflow + validation derive from the renderer's bbox
  // cache, so refresh them once draw() has populated it.
  if(typeof PageDesigner!=='undefined'){ try{ PageDesigner.refresh(); }catch(e){} }
};

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

// Sprint 8.2 — context menu trimmed to four child-friendly actions:
// Rename Page, Duplicate Page, Add Blank Page After, Delete Page.
// The wider PageOps API (setAsCover / addBefore / moveToEnd / exportPage
// / splitPage / mergeWithNext) is retained for programmatic callers; the
// menu just no longer exposes the clutter.
const CONTEXT_ACTIONS={
  'duplicate':'duplicatePage',
  'delete':'deletePage',
  'add-after':'addAfter',
  'rename':'__rename'
};
function _promptRenamePage(index){
  if(index<0||index>=AppState.slides.length) return;
  const slide=AppState.slides[index];
  const current=(slide && typeof slide.name==='string') ? slide.name : '';
  const next=window.prompt('What should we call this page?',current);
  // null = Cancel; '' = clear (restore default "Page X" label).
  if(next===null) return;
  if(typeof PageOps!=='undefined' && typeof PageOps.renamePage==='function'){
    PageOps.renamePage(index,next);
  }
}
const contextItems=contextMenu.querySelectorAll('.context-item');
contextItems.forEach(item=>{
 item.onclick=(e)=>{
   e.preventDefault();
   const action=item.getAttribute('data-action');
   const target=contextMenuTarget;
   closeContextMenu();
   if(target===null||target<0) return;
   const method=CONTEXT_ACTIONS[action];
   if(!method) return;
   if(method==='__rename'){ _promptRenamePage(target); return; }
   if(typeof PageOps[method]!=='function') return;
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
const SCENE_DRAG_THRESHOLD=3;
let _sceneDragState=null; // {elementId, startClientX, startClientY, sx, sy, baseX, baseY, moved}

function _hitTestSceneElement(canvasX,canvasY){
  if(typeof SlideRenderer.getSceneElements!=='function') return null;
  const els=SlideRenderer.getSceneElements();
  // Iterate top-down so the highest-z element wins.
  for(let i=els.length-1;i>=0;i--){
    const el=els[i];
    if(!el || el.visible===false) continue;
    // Skip background — full-canvas hit is unhelpful for dragging.
    if(el.id==='background') continue;
    if(canvasX>=el.bx && canvasX<=el.bx+el.bw && canvasY>=el.by && canvasY<=el.by+el.bh){
      return el;
    }
  }
  return null;
}

// Sprint 6.5 (Object Designer) — hit-test the 8 resize handles around the
// currently-selected scene element, if any. Returns the handle position
// string ('nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e') or null.
function _hitTestResizeHandle(canvasX,canvasY){
  if(!_selectedSceneElement) return null;
  if(typeof SlideRenderer.getResizeHandlesFor!=='function') return null;
  const handles=SlideRenderer.getResizeHandlesFor(_selectedSceneElement);
  if(!handles.length) return null;
  const r=(typeof SlideRenderer.getHandleRadius==='function')?SlideRenderer.getHandleRadius():12;
  // Generous hit slop so children can hit a handle with a fat fingertip.
  const slop=r*1.4;
  for(let i=0;i<handles.length;i++){
    const h=handles[i];
    const dx=canvasX-h.x, dy=canvasY-h.y;
    if(dx*dx+dy*dy<=slop*slop) return h.pos;
  }
  return null;
}

previewCanvas.addEventListener('mousedown',function(e){
  const s=AppState.slides[AppState.currentSlide];
  if(!s) return;
  const c=_canvasCoords(e);

  // Sprint 6.5 — resize handle hit-test takes priority over everything.
  const handlePos=_hitTestResizeHandle(c.x,c.y);
  if(handlePos){
    const els=SlideRenderer.getSceneElements();
    const bbox=els.find(function(el){ return el.id===_selectedSceneElement; });
    if(bbox){
      _resizeDragState={
        elementId:_selectedSceneElement,
        elementType:bbox.type,
        handle:handlePos,
        startClientX:e.clientX, startClientY:e.clientY,
        sx:c.sx, sy:c.sy,
        baseX:bbox.bx+bbox.bw/2, baseY:bbox.by+bbox.bh/2,
        baseW:bbox.bw, baseH:bbox.bh,
        moved:false
      };
      previewCanvas.classList.add('canvas-text-dragging');
      e.preventDefault();
      return;
    }
  }

  // Sprint 4.5 — Shift+click inside the panel sets the focal point at the
  // clicked location (relative to the cropped image source). Pre-empts both
  // text selection and image pan.
  if(e.shiftKey && s.image && _isInsidePanel(c.x,c.y) && typeof CardDesigner!=='undefined'){
    const view=CardDesigner.getActiveImageView();
    if(view){
      const SR=SlideRenderer;
      const r=(typeof SR.getPanelRect==='function')?SR.getPanelRect():{x:70,y:185,w:940,h:930};
      const innerX=r.x+20, innerY=r.y+20, innerW=r.w-40, innerH=r.h-40;
      const fx=Math.max(0,Math.min(1,(c.x-innerX)/innerW));
      const fy=Math.max(0,Math.min(1,(c.y-innerY)/innerH));
      view.focalX=fx;
      view.focalY=fy;
      delete s.thumbnail;
      draw();
      try{ CardDesigner.refresh(); }catch(err){}
      markDirty();
      e.preventDefault();
      return;
    }
  }

  // Sprint 6.1 — Scene element drag. Sprint 6.5 (Object Designer): the
  // click now ALSO selects the element (paints the gold outline + handles
  // and routes the right pane), so a quick click without drag still
  // performs object selection. The drag itself activates only after the
  // mouse moves past SCENE_DRAG_THRESHOLD.
  const sceneHit=_hitTestSceneElement(c.x,c.y);
  if(sceneHit){
    // Sprint 6.6 — stickers persist in their own array, so their base
    // position comes off the sticker record directly. Sprint 8.3 —
    // locked propagates through the bbox for every scene-element type
    // (Frame, decoration, …) so the same lock primitive guards every
    // object. Locked objects are still selectable but never drag.
    let baseX, baseY, locked=false;
    if(sceneHit.type==='sticker' && typeof SceneEngine!=='undefined'){
      const st=SceneEngine.findSticker(s,sceneHit.id);
      baseX=(st && typeof st.x==='number') ? st.x : (sceneHit.bx + sceneHit.bw/2);
      baseY=(st && typeof st.y==='number') ? st.y : (sceneHit.by + sceneHit.bh/2);
      locked=!!(st && st.locked);
    }else{
      const pos=(s.metadata && s.metadata.elementOverrides && s.metadata.elementOverrides[sceneHit.id] && s.metadata.elementOverrides[sceneHit.id].position) || {};
      baseX=(typeof pos.x==='number') ? pos.x : (sceneHit.bx + sceneHit.bw/2);
      baseY=(typeof pos.y==='number') ? pos.y : (sceneHit.by + sceneHit.bh/2);
      locked=!!sceneHit.locked;
    }
    _sceneDragState={
      elementId:sceneHit.id,
      elementType:sceneHit.type,
      startClientX:e.clientX,startClientY:e.clientY,
      sx:c.sx,sy:c.sy,
      baseX:baseX,baseY:baseY,
      locked:locked,
      moved:false
    };
    // Selection happens immediately so the gold outline + handles appear
    // even on a tap without drag.
    _setSelectedSceneElement(sceneHit.id, sceneHit.type);
    e.preventDefault();
    return;
  }

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

  // Clicked empty space — clear any text/scene selection so the canvas
  // is back to a blank slate.
  if(_selectedTextElement){
    _setSelectedTextElement(null);
  }
  if(_selectedSceneElement){
    _setSelectedSceneElement(null,null);
  }
});

// Sprint 6.5 (Object Designer) — hover cursor over resize handles.
previewCanvas.addEventListener('mousemove',function(e){
  if(_resizeDragState || _sceneDragState || _textDragState || _panState) return;
  const c=_canvasCoords(e);
  const h=_hitTestResizeHandle(c.x,c.y);
  if(h){
    const CURSOR={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'};
    previewCanvas.style.cursor=CURSOR[h]||'default';
  }else{
    previewCanvas.style.cursor='';
  }
});

document.addEventListener('mousemove',function(e){
  // Sprint 6.5 (Object Designer) — handle resize drag. Each handle drives
  // a different combination of position + size changes. Minimum 60×60 so
  // the Frame can't be shrunk to a sliver.
  if(_resizeDragState){
    const s=AppState.slides[AppState.currentSlide];
    if(!s) return;
    const dx=(e.clientX-_resizeDragState.startClientX)*_resizeDragState.sx;
    const dy=(e.clientY-_resizeDragState.startClientY)*_resizeDragState.sy;
    if(!_resizeDragState.moved){
      if(Math.abs(dx)+Math.abs(dy)<3) return;
      _resizeDragState.moved=true;
    }
    const h=_resizeDragState.handle;
    let dw=0, dh=0;
    if(h==='e' || h==='ne' || h==='se') dw=dx;
    if(h==='w' || h==='nw' || h==='sw') dw=-dx;
    if(h==='s' || h==='se' || h==='sw') dh=dy;
    if(h==='n' || h==='ne' || h==='nw') dh=-dy;
    const MIN=60;
    // Sprint 6.6 — sticker corner drags preserve aspect ratio by default
    // so stickers stay recognisable as resized. Side handles still do
    // 1-axis scaling for fine-tuning.
    let newW=Math.max(MIN, _resizeDragState.baseW+dw);
    let newH=Math.max(MIN, _resizeDragState.baseH+dh);
    if(_resizeDragState.elementType==='sticker' && (h==='nw'||h==='ne'||h==='sw'||h==='se')){
      const aspect=_resizeDragState.baseW/_resizeDragState.baseH;
      if(Math.abs(dw) > Math.abs(dh)*aspect){
        newH=Math.max(MIN, newW/aspect);
      }else{
        newW=Math.max(MIN, newH*aspect);
      }
    }
    // Position drift: side opposite the drag stays anchored, so the
    // center moves by half the size delta in the right direction.
    let cx=_resizeDragState.baseX, cy=_resizeDragState.baseY;
    if(h==='e' || h==='ne' || h==='se') cx=_resizeDragState.baseX+(newW-_resizeDragState.baseW)/2;
    if(h==='w' || h==='nw' || h==='sw') cx=_resizeDragState.baseX-(newW-_resizeDragState.baseW)/2;
    if(h==='s' || h==='se' || h==='sw') cy=_resizeDragState.baseY+(newH-_resizeDragState.baseH)/2;
    if(h==='n' || h==='ne' || h==='nw') cy=_resizeDragState.baseY-(newH-_resizeDragState.baseH)/2;
    if(_resizeDragState.elementType==='sticker'){
      // Sticker resize goes through the sticker mutation path so the
      // change persists at slide.metadata.stickers[*].
      if(typeof SceneEngine!=='undefined'){
        SceneEngine.updateSticker(s, _resizeDragState.elementId, {w:newW, h:newH, x:cx, y:cy});
      }
    }else{
      if(typeof SceneEngine!=='undefined'){
        SceneEngine.setSize(s, _resizeDragState.elementId, {w:newW, h:newH});
        SceneEngine.setPosition(s, _resizeDragState.elementId, {x:cx, y:cy});
      }
    }
    delete s.thumbnail;
    draw();
    return;
  }

  // Sprint 6.1 — Scene element drag
  if(_sceneDragState){
    const s=AppState.slides[AppState.currentSlide];
    if(!s) return;
    if(_sceneDragState.locked) return;
    const dx=(e.clientX-_sceneDragState.startClientX)*_sceneDragState.sx;
    const dy=(e.clientY-_sceneDragState.startClientY)*_sceneDragState.sy;
    if(!_sceneDragState.moved){
      if(Math.abs(dx)+Math.abs(dy)<SCENE_DRAG_THRESHOLD) return;
      _sceneDragState.moved=true;
      previewCanvas.classList.add('canvas-text-dragging');
    }
    if(typeof SceneEngine==='undefined') return;
    if(_sceneDragState.elementType==='sticker'){
      SceneEngine.updateSticker(s,_sceneDragState.elementId,{x:_sceneDragState.baseX+dx, y:_sceneDragState.baseY+dy});
    }else{
      SceneEngine.setPosition(s,_sceneDragState.elementId,{x:_sceneDragState.baseX+dx, y:_sceneDragState.baseY+dy});
    }
    delete s.thumbnail;
    draw();
    return;
  }

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

  // Image pan (Sprint 4.2, migrated path in Sprint 4.5)
  if(!_panState) return;
  const s2=AppState.slides[AppState.currentSlide];
  if(!s2) return;
  const view=(typeof CardDesigner!=='undefined') ? CardDesigner.getActiveImageView() : null;
  if(!view) return;
  const dx2=(e.clientX-_panState.startX)*_panState.sx;
  const dy2=(e.clientY-_panState.startY)*_panState.sy;
  view.offsetX=_panState.offX+dx2;
  view.offsetY=_panState.offY+dy2;
  delete s2.thumbnail;
  draw();
});

document.addEventListener('mouseup',function(){
  // Sprint 6.5 (Object Designer) — resize drag end
  if(_resizeDragState){
    const wasMoved=_resizeDragState.moved;
    _resizeDragState=null;
    previewCanvas.classList.remove('canvas-text-dragging');
    if(wasMoved){
      markDirty();
      const s=AppState.slides[AppState.currentSlide];
      if(s && typeof ThumbnailEngine!=='undefined'){
        try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(e){}
      }
      if(typeof PageDesigner!=='undefined'){ try{ PageDesigner.refresh(); }catch(e){} }
    }
    return;
  }

  // Sprint 6.1 — Scene drag end
  if(_sceneDragState){
    const wasMoved=_sceneDragState.moved;
    _sceneDragState=null;
    previewCanvas.classList.remove('canvas-text-dragging');
    if(wasMoved){
      markDirty();
      const s=AppState.slides[AppState.currentSlide];
      if(s && typeof ThumbnailEngine!=='undefined'){
        try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(e){}
      }
      if(typeof PageDesigner!=='undefined'){ try{ PageDesigner.refresh(); }catch(e){} }
    }
    return;
  }

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
  const active=document.activeElement;
  if(active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.tagName==='SELECT')) return;
  const s=AppState.slides[AppState.currentSlide];
  if(!s) return;

  // Sprint 6.6 — keyboard shortcuts for selected sticker. Delete keys
  // remove; arrow keys nudge by 1px (Shift = 10px).
  if(_selectedSceneElement && typeof SceneEngine!=='undefined'){
    const st=SceneEngine.findSticker(s,_selectedSceneElement);
    if(st){
      if(e.key==='Delete' || e.key==='Backspace'){
        e.preventDefault();
        SceneEngine.removeSticker(s,_selectedSceneElement);
        _setSelectedSceneElement(null,null);
        delete s.thumbnail;
        draw();
        markDirty();
        if(typeof ThumbnailEngine!=='undefined'){
          try{ ThumbnailEngine.generate(s).then(function(){ if(typeof renderList==='function') renderList(); if(typeof renderTimeline==='function') renderTimeline(); }); }catch(err){}
        }
        return;
      }
      const sd=ARROW_DELTAS[e.key];
      if(sd && !st.locked){
        e.preventDefault();
        const step=e.shiftKey?10:1;
        SceneEngine.updateSticker(s,_selectedSceneElement,{
          x:(st.x||540)+sd[0]*step,
          y:(st.y||675)+sd[1]*step
        });
        delete s.thumbnail;
        draw();
        markDirty();
        if(typeof CardDesigner!=='undefined'){ try{ CardDesigner.refresh(); }catch(err){} }
        return;
      }
    }
  }

  if(!_selectedTextElement) return;
  const d=ARROW_DELTAS[e.key];
  if(!d) return;
  e.preventDefault();
  const step=e.shiftKey?10:1;
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
