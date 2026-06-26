window.addEventListener('DOMContentLoaded',()=>{
const uploadBtn=document.getElementById('uploadBtn');
const upload=document.getElementById('scanUpload');
const story=document.getElementById('storyBeat');
const title=document.getElementById('bookTitle');
const page=document.getElementById('pageNumber');
const total=document.getElementById('totalPages');
SlideRenderer.init(document.getElementById('previewCanvas'));
uploadBtn.onclick=()=>upload.click();
upload.onchange=e=>{
 [...e.target.files].forEach((file,i)=>{
   const img=new Image();
   img.onload=()=>{
      AppState.slides.push({id:Date.now()+i,image:img,storyBeat:'',page:AppState.slides.length+1,totalPages:0});
      renderList();
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
   d.textContent='Page '+(i+1);
   d.onclick=()=>showSlide(i);
   list.appendChild(d);
 });
}
function showSlide(i){
 AppState.currentSlide=i;
 const s=AppState.slides[i];
 story.value=s.storyBeat;
 page.value=s.page;
 total.value=AppState.slides.length;
 draw();
}
function draw(){
 if(!AppState.slides.length)return;
 const s=AppState.slides[AppState.currentSlide];
 s.storyBeat=story.value;
 s.page=page.value;
 s.totalPages=AppState.slides.length;
 SlideRenderer.render({image:s.image,storyBeat:s.storyBeat,bookTitle:title.value,page:s.page,totalPages:s.totalPages});
}
[story,title,page,total].forEach(el=>el.oninput=draw);
});