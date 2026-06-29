// ImageViewEngine — Sprint 6.3.1
//
// One Image View Engine. The original artwork is sacred — the renderer
// never stretches, squashes, recompresses, or independently scales the
// pixels. Every Story / Cover / Hook / End page renders through this
// module so the math is provably uniform.
//
// The Image Holder is a *viewport*. The original image sits behind it.
// View ops: Fit / Fill (mode), Zoom (uniform), Pan X / Y, Reset.
//
// Backward-compatibility: `normalize()` accepts both the new field names
// (`mode`, `zoom`, `panX`, `panY`) and the legacy Sprint 4.2 keys
// (`fit`, `scale`, `offsetX`, `offsetY`). Existing saved projects keep
// working without any data migration.
const ImageViewEngine=(function(){
  const DEFAULT_VIEW={mode:'fit',zoom:1,panX:0,panY:0};
  // Aspect ratio tolerance for the runtime tripwire — generous enough to
  // absorb floating-point error, tight enough to catch real distortions.
  const EPSILON=0.001;

  function normalize(raw){
    if(!raw) return Object.assign({},DEFAULT_VIEW);
    const mode=(raw.mode==='fill' || raw.fit==='fill') ? 'fill' : 'fit';
    const zoom=(typeof raw.zoom==='number'&&isFinite(raw.zoom)&&raw.zoom>0)
      ? raw.zoom
      : (typeof raw.scale==='number'&&isFinite(raw.scale)&&raw.scale>0)
        ? raw.scale
        : 1;
    const panX=(typeof raw.panX==='number'&&isFinite(raw.panX))
      ? raw.panX
      : (typeof raw.offsetX==='number'&&isFinite(raw.offsetX))
        ? raw.offsetX
        : 0;
    const panY=(typeof raw.panY==='number'&&isFinite(raw.panY))
      ? raw.panY
      : (typeof raw.offsetY==='number'&&isFinite(raw.offsetY))
        ? raw.offsetY
        : 0;
    return {mode:mode,zoom:zoom,panX:panX,panY:panY};
  }

  // Pure geometry: given source dims, holder dims, and a view, return the
  // destination rectangle the renderer should pass to drawImage. ONE
  // scale factor is applied to both axes — aspect ratio is preserved by
  // construction.
  function compute(imgW,imgH,holderW,holderH,raw){
    if(!imgW||!imgH||!holderW||!holderH){
      return {dw:0,dh:0,panX:0,panY:0,scale:1,base:1,zoom:1,mode:'fit'};
    }
    const v=normalize(raw);
    const base=v.mode==='fill'
      ? Math.max(holderW/imgW, holderH/imgH)
      : Math.min(holderW/imgW, holderH/imgH);
    const scale=base*v.zoom;
    return {
      dw:imgW*scale,
      dh:imgH*scale,
      panX:v.panX,
      panY:v.panY,
      scale:scale,
      base:base,
      zoom:v.zoom,
      mode:v.mode
    };
  }

  // High-level: clip to the holder rect and draw the image inside it.
  // Returns the rendered destination rect for downstream verification.
  function drawInto(ctx,img,holderRect,raw){
    if(!ctx||!img||!img.width||!img.height||!holderRect) return null;
    const rx=holderRect.x, ry=holderRect.y, rw=holderRect.w, rh=holderRect.h;
    const c=compute(img.width,img.height,rw,rh,raw);
    const cx=rx+rw/2, cy=ry+rh/2;
    const dx=cx-c.dw/2+c.panX;
    const dy=cy-c.dh/2+c.panY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx,ry,rw,rh);
    ctx.clip();
    ctx.drawImage(img,dx,dy,c.dw,c.dh);
    ctx.restore();
    verifyAspectRatio(img.width,img.height,c.dw,c.dh);
    return {dx:dx,dy:dy,dw:c.dw,dh:c.dh};
  }

  // Development tripwire — never throws. The renderer never reaches this
  // path with a distortion under correct construction, but if a future
  // change introduces an independent X/Y scale this surfaces it loudly
  // in the console without breaking production.
  function verifyAspectRatio(iw,ih,dw,dh){
    if(iw<=0||ih<=0||dw<=0||dh<=0) return;
    const original=iw/ih;
    const rendered=dw/dh;
    if(Math.abs(original-rendered) > EPSILON){
      try{
        console.warn('[ImageViewEngine] Aspect ratio mismatch — the renderer must never stretch the original image.',
          {originalRatio:original,renderedRatio:rendered,iw:iw,ih:ih,dw:dw,dh:dh});
      }catch(e){}
    }
  }

  function reset(){ return Object.assign({},DEFAULT_VIEW); }

  const api={
    DEFAULT_VIEW:DEFAULT_VIEW,
    EPSILON:EPSILON,
    normalize:normalize,
    compute:compute,
    drawInto:drawInto,
    verifyAspectRatio:verifyAspectRatio,
    reset:reset
  };
  try{ window.ImageViewEngine=api; }catch(e){}
  return api;
})();
