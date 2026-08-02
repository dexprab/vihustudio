// PictureStudio — Sprint 6.7 · Feature 1 Phase 2 (Image Studio).
//
// A temporary preparation workspace that appears whenever a child
// uploads a picture. Picture Studio is NOT a permanent tab; it is a
// modal overlay that opens, prepares the picture, applies, and closes.
//
// Product principle (locked):
//   Beautify the original. Never replace the original.
//   Picture Studio only improves the uploaded picture.
//
// Architecture:
//   * Stateless module — no global persistence; every open() drives a
//     fresh modal lifecycle.
//   * Transforms (rotate / flip / enhance / crop) are baked into a new
//     bitmap on Apply so the existing renderer path stays unchanged.
//   * The output is { dataURL, imageView:{mode} } — the caller writes
//     these onto the active slide and switches to the Card Designer.
//   * Feature 1 Phase 2 (BACKLOG.md line 16): background removal is
//     now a real, reachable toolbar group here — the identical Web
//     Worker pipeline the standalone Image Studio tool
//     (tools/background-remover/) already established, invoked as an
//     ES module Worker directly against the tool's own worker.js so
//     the pipeline is genuinely shared, not duplicated. Result is a
//     new "source image" the existing rotate/flip/crop/enhance stack
//     draws from unchanged; Undo BG reverts to the original. The
//     public open() API is untouched, so every one of the ~7 existing
//     call sites across app.js/contextPanel.js/pageDesigner.js works
//     with zero change.
const PictureStudio=(function(){
  const DEFAULT_STATE={
    rotation:0,     // 0 / 90 / 180 / 270
    flipH:false,
    zoom:1,         // 1 = fit-to-stage; >1 zooms in (crops); range 0.5..4
    panX:0,
    panY:0,         // pan in stage pixels
    enhance:false,
    mode:'fit',     // 'fit' | 'fill' for downstream image holder
    showOriginal:false
  };

  // Auto Enhance is intentionally subtle so the original always reads.
  // The same multipliers are used in both the live preview filter and
  // the bake — what you see is what you get.
  const ENHANCE_FILTER='brightness(1.10) contrast(1.10) saturate(1.10)';

  let _modal=null, _root=null;
  let _stage=null, _canvas=null, _ctx=null;
  let _origImg=null;
  // Feature 1 Phase 2 — the background-removed image, if the user has
  // applied Remove Background. When set, _render()/_bake() draw from
  // it instead of _origImg; the original stays reachable via Undo BG.
  // The rotate/flip/crop/enhance stack keeps working unchanged because
  // it always reads whichever image _activeImg() reports.
  let _bgRemovedImg=null;
  let _bgRemovedDataURL=null;
  let _bgWorker=null;
  let _bgJobId=0;
  let _bgBusy=false;
  let _bgStatusEl=null, _bgRemoveBtn=null, _bgUndoBtn=null;
  let _state=Object.assign({},DEFAULT_STATE);
  let _onApply=null, _onCancel=null;
  let _drag=null;

  // Whichever image the rotate/flip/enhance/bake pipeline should treat
  // as its source. Background-removed if applied, else original.
  function _activeImg(){ return _bgRemovedImg||_origImg; }

  // -------- DOM build (lazy; reuses the same modal across opens) ----
  function _buildModal(){
    _modal=document.createElement('div');
    _modal.className='picture-studio-modal hidden';

    _root=document.createElement('div');
    _root.className='picture-studio';

    // Header
    const header=document.createElement('div');
    header.className='picture-studio-header';
    const title=document.createElement('div');
    title.className='picture-studio-title';
    title.textContent='🖼️ Image Studio';
    header.appendChild(title);
    const sub=document.createElement('div');
    sub.className='picture-studio-subtitle';
    sub.textContent='Get your picture ready — crop, rotate, flip, enhance, or remove its background.';
    header.appendChild(sub);
    const close=document.createElement('button');
    close.type='button';
    close.className='picture-studio-close';
    close.setAttribute('aria-label','Close');
    close.textContent='✕';
    close.addEventListener('click',_cancel);
    header.appendChild(close);
    _root.appendChild(header);

    // Stage (preview)
    _stage=document.createElement('div');
    _stage.className='picture-studio-stage';
    _canvas=document.createElement('canvas');
    _canvas.className='picture-studio-canvas';
    _ctx=_canvas.getContext('2d');
    try{ _ctx.imageSmoothingEnabled=true; _ctx.imageSmoothingQuality='high'; }catch(e){}
    _stage.appendChild(_canvas);
    _root.appendChild(_stage);
    _wireStageInteractions();

    // Toolbar
    const toolbar=document.createElement('div');
    toolbar.className='picture-studio-toolbar';

    _buildToolGroup(toolbar,'Crop',[
      {label:'Zoom In',  glyph:'🔍+', click:function(){ _setZoom(_state.zoom*1.15); }},
      {label:'Zoom Out', glyph:'🔍−', click:function(){ _setZoom(_state.zoom/1.15); }}
    ]);

    _buildToolGroup(toolbar,'Rotate',[
      {label:'Left',  glyph:'↺', click:function(){ _state.rotation=(_state.rotation+270)%360; _render(); }},
      {label:'Right', glyph:'↻', click:function(){ _state.rotation=(_state.rotation+90)%360; _render(); }}
    ]);

    _buildToolGroup(toolbar,'Flip',[
      {label:'Flip', glyph:'↔', click:function(){ _state.flipH=!_state.flipH; _render(); }}
    ]);

    _buildToolGroup(toolbar,'Improve',[
      {label:'Auto Enhance', glyph:'✨', click:function(){ _state.enhance=!_state.enhance; _refreshToggles(); _render(); }, toggleKey:'enhance'},
      {label:'Before / After', glyph:'👁', hold:true}
    ]);

    // Background removal — the one genuinely new capability the
    // standalone Image Studio tool (tools/background-remover/) already
    // shipped and Phase 2 folds back into Studio. The Remove button
    // ships the current source image (already respecting whatever
    // rotate/flip the user has applied — see _bakeSourceForBg) to the
    // tool's own ES module Worker, then swaps the result in as the new
    // source for the rest of the rotate/flip/crop/enhance stack. Undo
    // reverts to the pristine original.
    const bgGroup=_buildToolGroup(toolbar,'Background',[
      {label:'Remove', glyph:'🪄', click:_startBgRemoval},
      {label:'Undo BG', glyph:'↩', click:_undoBgRemoval}
    ]);
    // Track the two buttons + a tiny status line so we can enable /
    // disable / label them without re-querying the DOM each time.
    const bgBtns=bgGroup?bgGroup.querySelectorAll('.picture-studio-tool-btn'):[];
    if(bgBtns.length){
      _bgRemoveBtn=bgBtns[0];
      _bgUndoBtn=bgBtns[1];
    }
    _bgStatusEl=document.createElement('div');
    _bgStatusEl.className='picture-studio-tool-status';
    _bgStatusEl.textContent='';
    if(bgGroup) bgGroup.appendChild(_bgStatusEl);
    _refreshBgControls();

    _buildToolGroup(toolbar,'Show',[
      {label:'Fit',  glyph:'▭', click:function(){ _state.mode='fit'; _refreshToggles(); }, toggleKey:'mode:fit'},
      {label:'Fill', glyph:'▣', click:function(){ _state.mode='fill'; _refreshToggles(); }, toggleKey:'mode:fill'}
    ]);

    _buildToolGroup(toolbar,'Reset',[
      {label:'Reset', glyph:'🔄', click:function(){
        const keepMode=_state.mode;
        _state=Object.assign({},DEFAULT_STATE,{mode:keepMode});
        _refreshToggles(); _render();
      }}
    ]);

    _root.appendChild(toolbar);

    // Footer (Apply / Cancel)
    const footer=document.createElement('div');
    footer.className='picture-studio-footer';
    const cancel=document.createElement('button');
    cancel.type='button';
    cancel.className='picture-studio-btn picture-studio-cancel-btn';
    cancel.textContent='Cancel';
    cancel.addEventListener('click',_cancel);
    footer.appendChild(cancel);
    const apply=document.createElement('button');
    apply.type='button';
    apply.className='picture-studio-btn picture-studio-apply-btn';
    apply.textContent='Apply';
    apply.addEventListener('click',_apply);
    footer.appendChild(apply);
    _root.appendChild(footer);

    _modal.appendChild(_root);
    _modal.addEventListener('click',function(e){
      // Click on backdrop (the modal itself) cancels; clicks inside the
      // .picture-studio panel are ignored here.
      if(e.target===_modal) _cancel();
    });
    document.body.appendChild(_modal);
  }

  function _buildToolGroup(parent,label,buttons){
    const g=document.createElement('div');
    g.className='picture-studio-tool-group';
    const lbl=document.createElement('div');
    lbl.className='picture-studio-tool-group-label';
    lbl.textContent=label;
    g.appendChild(lbl);
    const row=document.createElement('div');
    row.className='picture-studio-tool-row';
    buttons.forEach(function(b){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='picture-studio-tool-btn';
      if(b.toggleKey) btn.setAttribute('data-toggle',b.toggleKey);
      const glyph=document.createElement('span');
      glyph.className='picture-studio-tool-glyph';
      glyph.textContent=b.glyph||'';
      btn.appendChild(glyph);
      const text=document.createElement('span');
      text.className='picture-studio-tool-label';
      text.textContent=b.label||'';
      btn.appendChild(text);
      if(b.hold){
        // Before / After — hold to peek the original.
        btn.addEventListener('mousedown',function(){ _state.showOriginal=true; _render(); });
        btn.addEventListener('mouseup',function(){ _state.showOriginal=false; _render(); });
        btn.addEventListener('mouseleave',function(){ _state.showOriginal=false; _render(); });
        btn.addEventListener('touchstart',function(){ _state.showOriginal=true; _render(); });
        btn.addEventListener('touchend',function(){ _state.showOriginal=false; _render(); });
      }else if(typeof b.click==='function'){
        btn.addEventListener('click',b.click);
      }
      row.appendChild(btn);
    });
    g.appendChild(row);
    parent.appendChild(g);
    return g;
  }

  function _setZoom(z){
    _state.zoom=Math.max(0.5,Math.min(4,z));
    _render();
  }

  // -------- Background removal (Feature 1 Phase 2) ------------------
  // Runs the standalone Image Studio tool's own ES module Worker
  // pipeline directly — the tool's worker.js composes background
  // detection / removal / feathering / auto-crop from its own
  // sub-modules, so there's exactly one canonical implementation
  // of "how removal works" and Studio invokes it verbatim.
  function _bgWorkerUrl(){
    // Resolve relative to this script tag's own location so it works
    // whether Studio is served from repo root or a nested path in a
    // future dev/preview environment. Same technique themeRepositoryClient
    // already uses for its config file.
    try{
      const scripts=document.getElementsByTagName('script');
      for(let i=0;i<scripts.length;i++){
        const src=scripts[i].getAttribute('src')||'';
        // Match with or without the ?v= cache-bust query.
        if(src.indexOf('js/pictureStudio.js')!==-1){
          return new URL('../tools/background-remover/js/worker.js', new URL(scripts[i].src, document.baseURI)).href;
        }
      }
    }catch(e){}
    // Fallback: assume Studio is at the repo root.
    return 'tools/background-remover/js/worker.js';
  }
  function _ensureBgWorker(){
    if(_bgWorker) return _bgWorker;
    try{
      _bgWorker=new Worker(_bgWorkerUrl(),{type:'module'});
      _bgWorker.onmessage=function(ev){
        const msg=ev.data||{};
        if(msg.type==='result') _onBgResult(msg);
        else if(msg.type==='error') _onBgError(msg);
      };
      _bgWorker.onerror=function(){
        _bgBusy=false;
        if(_bgStatusEl) _bgStatusEl.textContent='Removal failed — try again.';
        _refreshBgControls();
      };
    }catch(e){
      _bgWorker=null;
      if(_bgStatusEl) _bgStatusEl.textContent='Background removal is not available in this browser.';
    }
    return _bgWorker;
  }
  // Extract the CURRENT visible source (respecting rotation + flip so
  // "remove the background of the picture I'm looking at" reads
  // right) as a fresh RGBA pixel buffer for the worker. Zoom/pan are
  // deliberately NOT baked in here — Crop happens after removal, so a
  // user can pan around a removed cutout the same way they can pan an
  // ordinary picture.
  function _bakeSourceForBg(){
    const img=_activeImg();
    if(!img) return null;
    const rot=_state.rotation;
    const swap=(rot%180!==0);
    const w=swap?img.height:img.width;
    const h=swap?img.width:img.height;
    const c=document.createElement('canvas');
    c.width=w; c.height=h;
    const cx=c.getContext('2d');
    cx.save();
    cx.translate(w/2,h/2);
    cx.rotate(rot*Math.PI/180);
    if(_state.flipH) cx.scale(-1,1);
    cx.drawImage(img,-img.width/2,-img.height/2,img.width,img.height);
    cx.restore();
    let data;
    try{ data=cx.getImageData(0,0,w,h); }
    catch(e){ return null; } // tainted canvas — should be rare since AssetStore now sets crossOrigin
    return {data:data.data, width:w, height:h};
  }
  function _startBgRemoval(){
    if(_bgBusy||!_activeImg()) return;
    const buf=_bakeSourceForBg();
    if(!buf){
      if(_bgStatusEl) _bgStatusEl.textContent='Could not read this picture.';
      return;
    }
    const worker=_ensureBgWorker();
    if(!worker) return;
    _bgBusy=true;
    _bgJobId++;
    if(_bgStatusEl) _bgStatusEl.textContent='Removing background…';
    _refreshBgControls();
    // Transfer the pixel buffer's underlying ArrayBuffer so the main
    // thread doesn't hold a duplicate copy — same discipline the
    // standalone tool's app.js already established.
    try{
      worker.postMessage({
        type:'process',
        jobId:_bgJobId,
        pixelBuffer:buf,
        options:{strategy:'white-paper', autoCrop:true, featherRadius:1}
      },[buf.data.buffer]);
    }catch(e){
      _bgBusy=false;
      if(_bgStatusEl) _bgStatusEl.textContent='Removal failed — try again.';
      _refreshBgControls();
    }
  }
  function _onBgResult(msg){
    if(msg.jobId!==_bgJobId){ _bgBusy=false; _refreshBgControls(); return; }
    const pb=msg.pixelBuffer;
    if(!pb){ _bgBusy=false; _refreshBgControls(); return; }
    // Rebuild an HTMLImageElement from the processed buffer so the rest
    // of the pipeline (which draws with drawImage) keeps working
    // unchanged. Route through canvas.toDataURL() rather than the raw
    // bytes so downstream Apply()/_bake() can still call toDataURL()
    // on its own output canvas without surprises.
    const c=document.createElement('canvas');
    c.width=pb.width; c.height=pb.height;
    const cx=c.getContext('2d');
    cx.putImageData(new ImageData(new Uint8ClampedArray(pb.data),pb.width,pb.height),0,0);
    const dataURL=c.toDataURL('image/png');
    const img=new Image();
    img.onload=function(){
      _bgRemovedImg=img;
      _bgRemovedDataURL=dataURL;
      _bgBusy=false;
      // Reset rotation/flip since _bakeSourceForBg already baked them
      // into the new source — leaving them applied would double-rotate
      // the result. Zoom/pan/mode preserved.
      _state.rotation=0;
      _state.flipH=false;
      if(_bgStatusEl) _bgStatusEl.textContent='Background removed.';
      _refreshBgControls();
      _render();
    };
    img.src=dataURL;
  }
  function _onBgError(msg){
    _bgBusy=false;
    if(_bgStatusEl) _bgStatusEl.textContent='Removal failed — '+(msg.message||'try again')+'.';
    _refreshBgControls();
  }
  function _undoBgRemoval(){
    if(_bgBusy) return;
    _bgRemovedImg=null;
    _bgRemovedDataURL=null;
    _state.rotation=0;
    _state.flipH=false;
    _state.panX=0;
    _state.panY=0;
    _state.zoom=1;
    if(_bgStatusEl) _bgStatusEl.textContent='';
    _refreshBgControls();
    _render();
  }
  function _refreshBgControls(){
    if(_bgRemoveBtn){
      _bgRemoveBtn.disabled=_bgBusy||!_origImg;
      _bgRemoveBtn.classList.toggle('active',!!_bgRemovedImg);
    }
    if(_bgUndoBtn){
      _bgUndoBtn.disabled=_bgBusy||!_bgRemovedImg;
    }
  }

  function _refreshToggles(){
    if(!_root) return;
    _root.querySelectorAll('[data-toggle]').forEach(function(b){
      const k=b.getAttribute('data-toggle');
      let active=false;
      if(k==='enhance') active=!!_state.enhance;
      else if(k==='mode:fit') active=_state.mode==='fit';
      else if(k==='mode:fill') active=_state.mode==='fill';
      b.classList.toggle('active',active);
    });
  }

  function _wireStageInteractions(){
    _canvas.addEventListener('mousedown',function(e){
      _drag={sx:e.clientX,sy:e.clientY,px:_state.panX,py:_state.panY};
      e.preventDefault();
    });
    window.addEventListener('mousemove',function(e){
      if(!_drag) return;
      _state.panX=_drag.px+(e.clientX-_drag.sx);
      _state.panY=_drag.py+(e.clientY-_drag.sy);
      _render();
    });
    window.addEventListener('mouseup',function(){ _drag=null; });
    _canvas.addEventListener('wheel',function(e){
      e.preventDefault();
      _setZoom(_state.zoom*(e.deltaY<0?1.10:1/1.10));
    },{passive:false});
  }

  // -------- Geometry helpers ----------------------------------------
  // Effective image size after rotation. 90° / 270° swap w/h.
  function _effSize(){
    const rot=_state.rotation;
    const img=_activeImg();
    return (rot%180!==0)
      ? {w:img.height,h:img.width}
      : {w:img.width,h:img.height};
  }
  // Stage area allocated to the canvas. Uses the live element size so
  // the picture scales with the modal.
  function _stageRect(){
    if(!_stage) return {w:800,h:600};
    const r=_stage.getBoundingClientRect();
    // Leave a small inner padding so the picture never touches the edges.
    return {w:Math.max(200,r.width-32),h:Math.max(160,r.height-32)};
  }
  function _fitScale(){
    const e=_effSize();
    const s=_stageRect();
    return Math.min(s.w/e.w, s.h/e.h);
  }

  // -------- Render preview ------------------------------------------
  function _render(){
    const img=_activeImg();
    if(!img||!_canvas||!_ctx) return;
    const s=_stageRect();
    if(_canvas.width!==Math.round(s.w) || _canvas.height!==Math.round(s.h)){
      _canvas.width=Math.round(s.w);
      _canvas.height=Math.round(s.h);
    }
    const cw=_canvas.width, ch=_canvas.height;
    _ctx.save();
    _ctx.clearRect(0,0,cw,ch);
    // Soft checker so transparent pictures still read.
    _ctx.fillStyle='#1a1d24';
    _ctx.fillRect(0,0,cw,ch);

    const fit=_fitScale();
    const z=fit*_state.zoom;
    if(_state.enhance && !_state.showOriginal){
      _ctx.filter=ENHANCE_FILTER;
    }
    _ctx.translate(cw/2+_state.panX, ch/2+_state.panY);
    _ctx.rotate(_state.rotation*Math.PI/180);
    if(_state.flipH && !_state.showOriginal) _ctx.scale(-1,1);
    // While holding Before/After, always show the pristine original,
    // even if background removal is currently applied. This is the one
    // place the "peek what you started from" gesture must genuinely
    // bypass every downstream transform, including bg removal. Sizing
    // reads from whichever image will actually be drawn — bg removal
    // may crop out empty margins, so img.width ≠ _origImg.width.
    const drawImg=_state.showOriginal?_origImg:img;
    const iw=drawImg.width, ih=drawImg.height;
    _ctx.drawImage(drawImg, -iw*z/2, -ih*z/2, iw*z, ih*z);
    _ctx.restore();

    // Small hint badge while the user holds Before / After.
    if(_state.showOriginal){
      _ctx.save();
      _ctx.fillStyle='rgba(0,0,0,0.55)';
      _ctx.fillRect(12,12,108,28);
      _ctx.fillStyle='#FFFFFF';
      _ctx.font='600 14px sans-serif';
      _ctx.textBaseline='middle';
      _ctx.fillText('Original',24,12+14);
      _ctx.restore();
    }
  }

  // -------- Bake (capture the current view at original-pixel density)
  // The output is whatever's visible inside the preview canvas, but
  // rendered at the original image's pixel density. Default zoom (1)
  // captures the whole image without quality loss; zoom > 1 captures a
  // free-aspect crop with the pan deciding which subarea is preserved.
  function _bake(){
    const eff=_effSize();
    const s=_stageRect();
    const fit=Math.min(s.w/eff.w, s.h/eff.h);
    const z=fit*_state.zoom; // CSS-px scale used in the preview
    // Output dims = preview canvas dims rescaled to original density.
    // We use the natural canvas size (round to integers) so the bake
    // matches what the user saw.
    const cw=Math.max(2,Math.round(s.w));
    const ch=Math.max(2,Math.round(s.h));
    const outW=Math.max(2,Math.round(cw/z));
    const outH=Math.max(2,Math.round(ch/z));

    const out=document.createElement('canvas');
    out.width=outW;
    out.height=outH;
    const oc=out.getContext('2d');
    try{ oc.imageSmoothingEnabled=true; oc.imageSmoothingQuality='high'; }catch(e){}
    if(_state.enhance) oc.filter=ENHANCE_FILTER;
    // Pan in preview pixels → original-density pixels.
    const panX=_state.panX/z;
    const panY=_state.panY/z;
    oc.translate(outW/2+panX, outH/2+panY);
    oc.rotate(_state.rotation*Math.PI/180);
    if(_state.flipH) oc.scale(-1,1);
    const src=_activeImg();
    const iw=src.width, ih=src.height;
    oc.drawImage(src, -iw/2, -ih/2, iw, ih);

    // Output as PNG (lossless). Children's projects are small and the
    // file format never re-encodes after this point.
    return {
      dataURL: out.toDataURL('image/png'),
      width: outW,
      height: outH,
      imageView: { mode: _state.mode, fit: _state.mode }
    };
  }

  // -------- Lifecycle ------------------------------------------------
  function open(input,options){
    if(!_modal) _buildModal();
    options=options||{};
    _onApply=options.onApply||null;
    _onCancel=options.onCancel||null;
    _state=Object.assign({},DEFAULT_STATE,{mode:options.defaultMode||'fit'});
    _refreshToggles();
    _modal.classList.remove('hidden');
    // Focus trap minimal — escape closes.
    document.addEventListener('keydown',_onKeyDown);

    // Accept (a) an Image already loaded, (b) a data URL (or, Phase C, a
    // durable vihu-asset: reference), (c) a File.
    if(input instanceof HTMLImageElement){
      _origImg=input;
      _render();
    }else if(typeof input==='string'){
      const loadImg=function(src){
        const img=new Image();
        // Same root cause as js/projectManager.js's loadImageFromDataURL
        // — `src` may be a genuinely cross-origin Supabase Storage
        // signed URL (a Place/Scene-Object picture resolved via
        // AssetStore.resolve() above), and drawing it with no
        // `crossOrigin` set silently taints _render()'s own preview
        // canvas, breaking Apply's own out.toDataURL() bake step with a
        // SecurityError. Harmless for the plain-string/data: fallback
        // path below, which also calls this same function.
        img.crossOrigin='anonymous';
        img.onload=function(){ _origImg=img; _render(); };
        img.src=src;
      };
      // Platform Hardening — Draft Asset Architecture, Phase C. `input`
      // may be a vihu-asset: reference (a Place/Scene-Object picture not
      // yet rehydrated into a cached Image object, so its own Crop/Rotate
      // re-edit falls back to the raw string field) — resolve it first. A
      // legacy data: URI (or any other string) resolves through the same
      // call, same-tick, with zero behaviour change. Phase E —
      // options.fallbackOwnerId (the current slide's own recallOwnerId,
      // threaded in by the caller) is passed to AssetStore.resolve() as
      // its own opts.ownerId fallback, so a Magic-Card-recalled Place's
      // picture still resolves on the recalling device.
      if(input.indexOf('vihu-asset:')===0 && typeof window.AssetStore!=='undefined'){
        window.AssetStore.resolve(input,options.fallbackOwnerId?{ownerId:options.fallbackOwnerId}:undefined).then(function(src){ if(src) loadImg(src); });
      }else{
        loadImg(input);
      }
    }else if(input && typeof File!=='undefined' && input instanceof File){
      const reader=new FileReader();
      reader.onload=function(ev){
        const img=new Image();
        img.onload=function(){ _origImg=img; _render(); };
        img.src=ev.target.result;
      };
      reader.readAsDataURL(input);
    }
    // Re-render after layout in case the stage size changed since the
    // last open.
    setTimeout(function(){ if(_origImg) _render(); },50);
  }

  function _onKeyDown(e){
    if(!_modal || _modal.classList.contains('hidden')) return;
    if(e.key==='Escape'){ _cancel(); }
    else if(e.key==='Enter' && !e.shiftKey){ _apply(); }
  }

  function _apply(){
    if(!_origImg){ _cancel(); return; }
    const result=_bake();
    _hide();
    if(typeof _onApply==='function'){
      try{ _onApply(result); }catch(e){}
    }
  }

  function _cancel(){
    _hide();
    if(typeof _onCancel==='function'){
      try{ _onCancel(); }catch(e){}
    }
  }

  function _hide(){
    if(_modal) _modal.classList.add('hidden');
    _origImg=null;
    _bgRemovedImg=null;
    _bgRemovedDataURL=null;
    _bgBusy=false;
    _drag=null;
    _refreshBgControls();
    document.removeEventListener('keydown',_onKeyDown);
  }

  function isOpen(){
    return !!(_modal && !_modal.classList.contains('hidden'));
  }

  const api={ open:open, isOpen:isOpen };
  try{ window.PictureStudio=api; }catch(e){}
  return api;
})();
