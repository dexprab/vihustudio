window.addEventListener('DOMContentLoaded',()=>{
const uploadBtn=document.getElementById('uploadBtn');
const upload=document.getElementById('scanUpload');
const story=document.getElementById('storyBeat');
const title=document.getElementById('bookTitle');
const page=document.getElementById('pageNumber');
const total=document.getElementById('totalPages');
const previewCanvas=document.getElementById('previewCanvas');
SlideRenderer.init(previewCanvas);
// initialize thumbnail engine AFTER renderer has been initialized for preview
if(window.ThumbnailEngine||typeof ThumbnailEngine!=='undefined'){
  try{ ThumbnailEngine.init(previewCanvas); }catch(e){}
}

uploadBtn.onclick=()=>upload.click();
upload.onchange=e=>{
 [...e.target.files].forEach((file,i)=>{
   const img=new Image();
   img.onload=()=>{
      const slideObj={id:Date.now()+i,image:img,storyBeat:'',page:AppState.slides.length+1,totalPages:0};
      AppState.slides.push(slideObj);
      renderList();
      // generate thumbnail for this slide
      try{ ThumbnailEngine.generate(slideObj).then(src=>{
         const el=document.querySelector('#slideList [data-index="'+(AppState.slides.length-1)+'"] img');
         if(el && src) el.src=src;
      }); }catch(e){}
      if(AppState.slides.length===1) showSlide(0);
   };
   img.src=URL.createObjectURL(file);
 });
};
function renderList(){
 const list=document.getElementById('slideList');
 list.innerHTML='';
 AppState.slides.forEach((s,i)=>{
   const d=document.createElement('div');
   d.className='thumb';
   d.setAttribute('data-index',i);

   const img=document.createElement('img');
   if(s.thumbnail) img.src=s.thumbnail; else{
     // placeholder while thumbnail is generated
     const ph=document.createElement('div'); ph.className='placeholder'; ph.textContent='Page '+(i+1);
     d.appendChild(ph);
   }

   // if thumbnail exists, append the image
   if(s.thumbnail) d.appendChild(img);

   const lbl=document.createElement('div'); lbl.className='page-label'; lbl.textContent='Page '+(i+1);
   d.appendChild(lbl);

   d.onclick=()=>showSlide(i);
   if(i===AppState.currentSlide) d.classList.add('selected');
   list.appendChild(d);

   // if no thumbnail, kick off generation and replace placeholder when ready
   if(!s.thumbnail){
     try{ ThumbnailEngine.generate(s).then(src=>{
        const container=document.querySelector('#slideList [data-index="'+i+'"]');
        if(container && src){
          // remove placeholder
          const ph=container.querySelector('.placeholder'); if(ph) ph.remove();
          const im=new Image(); im.src=src; im.onload=()=>{
            container.insertBefore(im, container.querySelector('.page-label'));
          };
        }
     }); }catch(e){}
   }
 });
}
function showSlide(i){
 AppState.currentSlide=i;
 const s=AppState.slides[i];
 story.value=s.storyBeat;
 page.value=s.page;
 total.value=AppState.slides.length;
 draw();
 // update selection highlight
 document.querySelectorAll('#slideList .thumb').forEach(el=>el.classList.remove('selected'));
 const sel=document.querySelector('#slideList [data-index="'+i+'"]'); if(sel) sel.classList.add('selected');
}
function draw(){
 if(!AppState.slides.length)return;
 const s=AppState.slides[AppState.currentSlide];
 s.storyBeat=story.value;
 s.page=page.value;
 s.totalPages=AppState.slides.length;
 SlideRenderer.render({image:s.image,storyBeat:s.storyBeat,bookTitle:title.value,page:s.page,totalPages:s.totalPages});
 // mark thumbnail stale so it will be regenerated next time if content changed
 if(s.thumbnail){
   // lightweight check: if storyBeat changed, clear thumbnail
   if(!s._lastStory || s._lastStory!==s.storyBeat){ delete s.thumbnail; }
 }
 s._lastStory=s.storyBeat;
}
[story,title,page,total].forEach(el=>el.oninput=draw);
});
