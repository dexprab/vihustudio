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
let contextMenuTarget=null;
let contextMenuPos={x:0,y:0};

SlideRenderer.init(previewCanvas);
if(window.ThumbnailEngine||typeof ThumbnailEngine!=='undefined'){
  try{ ThumbnailEngine.init(previewCanvas); }catch(e){}
}

uploadBtn.onclick=()=>upload.click();
upload.onchange=e=>{
 const files=[...e.target.files];
 const newSlides=[];
 let loaded=0;

 files.forEach((file,i)=>{
   const img=new Image();
   img.onload=()=>{
      const slideObj={id:Date.now()+i,image:img,storyBeat:'',page:AppState.slides.length+newSlides.length+1,totalPages:0};
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
        }); }catch(e){}
      }
   };
   img.src=URL.createObjectURL(file);
 });
};

exportBtn.onclick=()=>{
  alert('Export feature coming in Sprint 3');
};

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
   menuBtn.textContent='\u22ee';
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
 SlideRenderer.render({image:s.image,storyBeat:s.storyBeat,bookTitle:title.value,page:s.page,totalPages:s.totalPages});
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
 }
});

const contextItems=contextMenu.querySelectorAll('.context-item');
contextItems.forEach(item=>{
 item.onclick=(e)=>{
   e.preventDefault();
   const action=item.getAttribute('data-action');
   closeContextMenu();
   if(contextMenuTarget<0) return;
   
   if(action==='duplicate'){
     PageOps.duplicatePage(contextMenuTarget);
     renderTimeline();
   }else if(action==='delete'){
     PageOps.deletePage(contextMenuTarget);
     renderTimeline();
   }else if(action==='blank'){
     PageOps.insertBlankPage(contextMenuTarget);
     renderTimeline();
   }else if(action==='export-page'){
     alert('Export page feature coming in Sprint 3');
   }else if(action==='set-cover'){
     alert('Set as cover feature coming in Sprint 3');
   }else if(action==='add-before'){
     alert('Add before feature coming in Sprint 3');
   }else if(action==='add-after'){
     alert('Add after feature coming in Sprint 3');
   }else if(action==='move-end'){
     alert('Move to end feature coming in Sprint 3');
   }
 };
});

[story,title,page,total].forEach(el=>el.oninput=draw);
});
