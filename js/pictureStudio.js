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
    showOriginal:false,
    // Redesign Ship A — Before/After slider position (0..100). When
    // background removal is applied AND this slider is between 0 and
    // 100 exclusive, _render() draws the original on the left portion
    // and the background-removed result on the right portion, with a
    // hairline divider at the split. At 0, shows only the original;
    // at 100 (default), shows only the removed-background result.
    beforeAfterPct:100
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
  // Redesign — two-view flow (Result / Edit) mirroring the standalone
  // Image Studio tool's own kid-friendly UX. Result View shows on open
  // with two big CTAs (Looks Great / Make It Better). Make It Better
  // switches to Edit View, whose tile toolbar reveals a per-tool
  // sub-panel when active. _view/_activeTool drive `data-view` and
  // `data-active-tool` attributes on _root that CSS uses to swap
  // visibility — the canvas element itself is persistent across both
  // views, only the surrounding chrome changes.
  let _view='result', _activeTool=null;
  let _resultPanel=null, _editPanel=null;
  let _tileButtons=null, _subPanels=null;
  let _brightenTile=null;
  // Redesign Ship A — Before / After comparison slider inside the Remove
  // Background sub-panel. Appears the moment _bgRemovedImg is set (see
  // _onBgResult). Two overlapping canvases + a range input drive a
  // clip-path reveal, exactly mirroring the standalone
  // tools/background-remover/'s own updateBeforeAfterClip() pattern.
  let _baCompareWrap=null, _baStage=null;
  let _baCanvasBefore=null, _baCanvasAfter=null;
  let _baSlider=null, _baHint=null;

  // Whichever image the rotate/flip/enhance/bake pipeline should treat
  // as its source. Background-removed if applied, else original.
  function _activeImg(){ return _bgRemovedImg||_origImg; }

  // -------- DOM build (lazy; reuses the same modal across opens) ----
  //
  // Two-view flow, mirroring the standalone Image Studio tool's own
  // kid-friendly UX:
  //   * Result View  — shown on open once the picture loads. A big
  //     canvas + two big CTAs ("😊 Looks Great" / "✨ Make It Better").
  //     If the picture is already good, one tap ships it.
  //   * Edit View    — activated by "Make It Better". Same canvas, but
  //     a tile toolbar beneath it (Remove Background / Turn or Flip /
  //     Bigger or Smaller / Brighten / Peek Original / Start Over).
  //     Selecting a tile reveals its own sub-panel; only one is visible
  //     at a time. Save Picture at the bottom applies and closes.
  //
  // The `_stage`/`_canvas` DOM is persistent across both views — only
  // the surrounding chrome swaps (via `data-view` on _root plus
  // `data-active-tool` for the sub-panel dispatch). This means every
  // pre-existing render/bake code path (_render/_bake/_wireStageInteractions)
  // keeps working with zero change.
  function _buildModal(){
    _modal=document.createElement('div');
    _modal.className='picture-studio-modal hidden';

    _root=document.createElement('div');
    _root.className='picture-studio';
    _root.setAttribute('data-view','result');

    // Header — shared across both views
    const header=document.createElement('div');
    header.className='picture-studio-header';
    const title=document.createElement('div');
    title.className='picture-studio-title';
    title.textContent='🖼️ Image Studio';
    header.appendChild(title);
    const sub=document.createElement('div');
    sub.className='picture-studio-subtitle';
    sub.textContent="Let's make your picture just right!";
    header.appendChild(sub);
    const close=document.createElement('button');
    close.type='button';
    close.className='picture-studio-close';
    close.setAttribute('aria-label','Close');
    close.textContent='✕';
    close.addEventListener('click',_cancel);
    header.appendChild(close);
    _root.appendChild(header);

    // Body wrapper — column layout in Result view (stage on top,
    // result CTAs beneath); row layout in Edit view (stage on left,
    // tools aside on right). The .picture-studio[data-view=...] rule
    // in style.css drives which direction it takes on any given open.
    const body=document.createElement('div');
    body.className='picture-studio-body';

    // Stage (canvas preview) — persistent across both views.
    // Redesign Ship A — the stage now carries a checkerboard pattern
    // (via CSS .checkerboard) instead of a flat dark fill, so a
    // background-removed picture visibly reads as transparent rather
    // than opaque black. The canvas itself is made transparent in CSS
    // so the checkerboard shows through wherever the drawn image has
    // alpha < 1.
    _stage=document.createElement('div');
    _stage.className='picture-studio-stage checkerboard';
    _canvas=document.createElement('canvas');
    _canvas.className='picture-studio-canvas';
    _ctx=_canvas.getContext('2d');
    try{ _ctx.imageSmoothingEnabled=true; _ctx.imageSmoothingQuality='high'; }catch(e){}
    _stage.appendChild(_canvas);
    body.appendChild(_stage);
    _wireStageInteractions();

    // Result view — big CTAs beneath the canvas
    _resultPanel=document.createElement('div');
    _resultPanel.className='picture-studio-result-view';
    const rHeadline=document.createElement('div');
    rHeadline.className='picture-studio-result-headline';
    rHeadline.textContent='🎉 Your picture is ready!';
    _resultPanel.appendChild(rHeadline);
    const rActions=document.createElement('div');
    rActions.className='picture-studio-result-actions';
    const looksGreat=document.createElement('button');
    looksGreat.type='button';
    looksGreat.className='picture-studio-cta-btn picture-studio-cta-primary';
    looksGreat.textContent='😊 Looks Great';
    looksGreat.addEventListener('click',_apply);
    rActions.appendChild(looksGreat);
    const makeBetter=document.createElement('button');
    makeBetter.type='button';
    makeBetter.className='picture-studio-cta-btn picture-studio-cta-secondary';
    makeBetter.textContent='✨ Make It Better';
    makeBetter.addEventListener('click',function(){ _setView('edit'); });
    rActions.appendChild(makeBetter);
    _resultPanel.appendChild(rActions);
    body.appendChild(_resultPanel);

    // Edit view — right-side tools aside (tile toolbar + sub-panels).
    // Redesign Ship A — laid out on the right of the stage in Edit
    // view (parity with the standalone tools/background-remover/
    // .controls-panel.kids-controls layout the user's own governing
    // request cited), rather than beneath the canvas as before. The
    // save/back footer moves OUT of this panel to sit at the very
    // bottom of the modal so it stays visible regardless of how tall
    // the tools aside grows.
    _editPanel=document.createElement('div');
    _editPanel.className='picture-studio-edit-view';
    const editHint=document.createElement('p');
    editHint.className='picture-studio-edit-hint';
    editHint.textContent='Tap a tool.';
    _editPanel.appendChild(editHint);

    const toolGrid=document.createElement('div');
    toolGrid.className='picture-studio-tool-grid';
    _tileButtons={};
    // Tools that open their own sub-panel
    _tileButtons.bg=_buildTile(toolGrid,'✨','Remove Background',function(){ _toggleActiveTool('bg'); });
    _tileButtons.flip=_buildTile(toolGrid,'🔄','Turn or Flip',function(){ _toggleActiveTool('flip'); });
    _tileButtons.zoom=_buildTile(toolGrid,'🔍','Bigger / Smaller',function(){ _toggleActiveTool('zoom'); });
    // One-tap toggle — Brighten flips _state.enhance directly, no sub-panel.
    _brightenTile=_buildTile(toolGrid,'✨','Brighten',function(){
      _state.enhance=!_state.enhance;
      _brightenTile.classList.toggle('active',!!_state.enhance);
      _render();
    });
    _tileButtons.brighten=_brightenTile;
    // Hold-to-peek — Peek Original is a press-and-hold tile, no sub-panel.
    _tileButtons.peek=_buildTile(toolGrid,'👁️','Peek Original',null,{hold:true});
    _tileButtons.reset=_buildTile(toolGrid,'↶','Start Over',function(){ _toggleActiveTool('reset'); });
    _editPanel.appendChild(toolGrid);

    // Sub-panels area — one per tool, hidden by default
    _subPanels={};
    const subWrap=document.createElement('div');
    subWrap.className='picture-studio-subpanels';
    _subPanels.bg=_buildBgSubPanel();
    _subPanels.flip=_buildFlipSubPanel();
    _subPanels.zoom=_buildZoomSubPanel();
    _subPanels.reset=_buildResetSubPanel();
    Object.keys(_subPanels).forEach(function(k){ subWrap.appendChild(_subPanels[k]); });
    _editPanel.appendChild(subWrap);

    // Edit view mounts inside body as the right-side aside beside the
    // stage; body is what actually goes into _root. Footer is a sibling
    // of body (see below), never a child of _editPanel — so it stays
    // pinned at the bottom of the modal regardless of tools-aside height.
    body.appendChild(_editPanel);
    _root.appendChild(body);

    // Edit footer — Back to picture + Save. Sits at modal bottom, shown
    // only in Edit view via .picture-studio[data-view=result] .picture-
    // studio-edit-footer { display:none } in style.css.
    const editFooter=document.createElement('div');
    editFooter.className='picture-studio-edit-footer';
    const back=document.createElement('button');
    back.type='button';
    back.className='picture-studio-back-link';
    back.textContent='← Back to picture';
    back.addEventListener('click',function(){ _toggleActiveTool(null); _setView('result'); });
    editFooter.appendChild(back);
    const save=document.createElement('button');
    save.type='button';
    save.className='picture-studio-cta-btn picture-studio-cta-primary picture-studio-save-btn';
    save.textContent='💾 Save Picture';
    save.addEventListener('click',_apply);
    editFooter.appendChild(save);
    _root.appendChild(editFooter);

    _modal.appendChild(_root);
    _modal.addEventListener('click',function(e){
      // Click on backdrop (the modal itself) cancels; clicks inside the
      // .picture-studio panel are ignored here.
      if(e.target===_modal) _cancel();
    });
    document.body.appendChild(_modal);
    _refreshBgControls();
  }

  // Build one big tool tile — icon on top, label below, optional
  // hold-to-preview behaviour for the Peek Original tile.
  function _buildTile(parent,glyph,label,onClick,opts){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='picture-studio-tile';
    const g=document.createElement('span');
    g.className='picture-studio-tile-icon';
    g.textContent=glyph||'';
    btn.appendChild(g);
    const t=document.createElement('span');
    t.className='picture-studio-tile-label';
    t.textContent=label||'';
    btn.appendChild(t);
    if(opts && opts.hold){
      // Press-and-hold to peek the pristine original.
      btn.addEventListener('mousedown',function(){ _state.showOriginal=true; _render(); btn.classList.add('active'); });
      const stop=function(){ if(_state.showOriginal){ _state.showOriginal=false; _render(); btn.classList.remove('active'); } };
      btn.addEventListener('mouseup',stop);
      btn.addEventListener('mouseleave',stop);
      btn.addEventListener('touchstart',function(){ _state.showOriginal=true; _render(); btn.classList.add('active'); });
      btn.addEventListener('touchend',stop);
    }else if(typeof onClick==='function'){
      btn.addEventListener('click',onClick);
    }
    parent.appendChild(btn);
    return btn;
  }

  // -------- Sub-panels (one per tool) -------------------------------
  function _buildBgSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','bg');
    const intro=document.createElement('p');
    intro.className='picture-studio-subpanel-hint';
    intro.textContent="Tap Remove and I'll try to erase the background.";
    p.appendChild(intro);
    const row=document.createElement('div');
    row.className='picture-studio-subpanel-row';
    _bgRemoveBtn=document.createElement('button');
    _bgRemoveBtn.type='button';
    _bgRemoveBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-primary';
    _bgRemoveBtn.textContent='✨ Remove Background';
    _bgRemoveBtn.addEventListener('click',_startBgRemoval);
    row.appendChild(_bgRemoveBtn);
    _bgUndoBtn=document.createElement('button');
    _bgUndoBtn.type='button';
    _bgUndoBtn.className='picture-studio-subpanel-btn';
    _bgUndoBtn.textContent='↩ Undo';
    _bgUndoBtn.addEventListener('click',_undoBgRemoval);
    row.appendChild(_bgUndoBtn);
    p.appendChild(row);
    _bgStatusEl=document.createElement('div');
    _bgStatusEl.className='picture-studio-subpanel-status';
    _bgStatusEl.textContent='';
    p.appendChild(_bgStatusEl);
    // Before / After slider — mirrors the standalone tools/background-
    // remover/'s own beforeAfter slider. Hidden until a background
    // removal has actually landed (see _refreshBgControls); dragging
    // it drives _state.beforeAfterPct which _render() reads to draw
    // the original on the left and the bg-removed result on the right,
    // separated by a hairline. At 100 (default), only the result shows.
    _baCompareWrap=document.createElement('div');
    _baCompareWrap.className='picture-studio-ba-compare hidden';
    const baLabel=document.createElement('div');
    baLabel.className='picture-studio-ba-label';
    baLabel.textContent='Before ⇄ After';
    _baCompareWrap.appendChild(baLabel);
    _baSlider=document.createElement('input');
    _baSlider.type='range';
    _baSlider.min='0';
    _baSlider.max='100';
    _baSlider.value=String(_state.beforeAfterPct);
    _baSlider.className='picture-studio-ba-slider';
    _baSlider.addEventListener('input',function(){
      _state.beforeAfterPct=parseInt(_baSlider.value,10);
      _render();
    });
    _baCompareWrap.appendChild(_baSlider);
    _baHint=document.createElement('div');
    _baHint.className='picture-studio-ba-hint';
    _baHint.textContent='Drag to compare.';
    _baCompareWrap.appendChild(_baHint);
    p.appendChild(_baCompareWrap);
    return p;
  }
  function _buildFlipSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','flip');
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Turn or flip your picture.';
    p.appendChild(hint);
    const row=document.createElement('div');
    row.className='picture-studio-subpanel-row';
    const mk=function(label,glyph,onClick){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-subpanel-btn';
      const g=document.createElement('span');
      g.className='picture-studio-subpanel-btn-glyph';
      g.textContent=glyph;
      b.appendChild(g);
      const t=document.createElement('span');
      t.textContent=label;
      b.appendChild(t);
      b.addEventListener('click',onClick);
      row.appendChild(b);
    };
    mk('Turn Left','↺',function(){ _state.rotation=(_state.rotation+270)%360; _render(); });
    mk('Turn Right','↻',function(){ _state.rotation=(_state.rotation+90)%360; _render(); });
    mk('Flip ↔','↔',function(){ _state.flipH=!_state.flipH; _render(); });
    p.appendChild(row);
    return p;
  }
  function _buildZoomSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','zoom');
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Make your picture bigger or smaller.';
    p.appendChild(hint);
    const row=document.createElement('div');
    row.className='picture-studio-subpanel-row';
    const mk=function(label,glyph,onClick){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-subpanel-btn';
      const g=document.createElement('span');
      g.className='picture-studio-subpanel-btn-glyph';
      g.textContent=glyph;
      b.appendChild(g);
      const t=document.createElement('span');
      t.textContent=label;
      b.appendChild(t);
      b.addEventListener('click',onClick);
      row.appendChild(b);
    };
    mk('Bigger','🔍+',function(){ _setZoom(_state.zoom*1.15); });
    mk('Smaller','🔍−',function(){ _setZoom(_state.zoom/1.15); });
    mk('Fit','▭',function(){ _state.zoom=1; _state.panX=0; _state.panY=0; _render(); });
    p.appendChild(row);
    return p;
  }
  function _buildResetSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','reset');
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Undo every change and start over on this picture?';
    p.appendChild(hint);
    const row=document.createElement('div');
    row.className='picture-studio-subpanel-row';
    const yes=document.createElement('button');
    yes.type='button';
    yes.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-danger';
    yes.textContent='Yes, start over';
    yes.addEventListener('click',function(){
      const keepMode=_state.mode;
      _state=Object.assign({},DEFAULT_STATE,{mode:keepMode});
      _bgRemovedImg=null;
      _bgRemovedDataURL=null;
      if(_bgStatusEl) _bgStatusEl.textContent='';
      _refreshBgControls();
      if(_brightenTile) _brightenTile.classList.remove('active');
      _toggleActiveTool(null);
      _render();
    });
    row.appendChild(yes);
    p.appendChild(row);
    return p;
  }

  // -------- View + active-tool state --------------------------------
  function _setView(v){
    _view=v;
    if(_root) _root.setAttribute('data-view',v);
    // Any active sub-panel closes when returning to result view.
    if(v==='result') _toggleActiveTool(null);
    // Re-render after CSS-driven layout change in case the stage size
    // changed (the tile toolbar/sub-panels take real vertical room).
    setTimeout(function(){ if(_origImg) _render(); },30);
  }
  // Click a tile to open its sub-panel; click the SAME tile again to
  // close it; click a different tile to switch. `null` closes any open
  // sub-panel and clears every tile's active state.
  function _toggleActiveTool(tool){
    if(_activeTool===tool) tool=null;
    _activeTool=tool;
    if(_root) _root.setAttribute('data-active-tool',tool||'');
    if(_tileButtons){
      ['bg','flip','zoom','reset'].forEach(function(k){
        if(_tileButtons[k]) _tileButtons[k].classList.toggle('active',_activeTool===k);
      });
    }
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
    _state.beforeAfterPct=100;
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
    // Before/After slider is only meaningful once a background removal
    // has actually landed — otherwise there's nothing to compare against.
    if(_baCompareWrap){
      _baCompareWrap.classList.toggle('hidden',!_bgRemovedImg);
      if(!_bgRemovedImg){
        _state.beforeAfterPct=100;
        if(_baSlider) _baSlider.value='100';
      }
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
    // Redesign Ship A — the canvas is now transparent so the underlying
    // .checkerboard stage pattern reads through wherever the drawn
    // image itself has alpha < 1. No flat fill here; a pure clearRect
    // is enough to reset between frames.
    _ctx.clearRect(0,0,cw,ch);

    const fit=_fitScale();
    const z=fit*_state.zoom;
    // Before / After compare — when bg removal is applied AND the
    // slider is anywhere between 0 and 100 exclusive, draw the ORIGINAL
    // on the left portion (0..pct) and the RESULT on the right portion
    // (pct..100). At 0 the user sees only the original; at 100 (the
    // default) they see only the result. Uses ctx.clip() rects rather
    // than compositing tricks so both halves share the same fit/pan/
    // rotate/flip/enhance pipeline byte-for-byte with a plain render.
    const compareActive=!!_bgRemovedImg && _state.beforeAfterPct>0 && _state.beforeAfterPct<100 && !_state.showOriginal;
    const pctX=Math.round(cw*(_state.beforeAfterPct/100));

    function _paintOne(sourceImg){
      _ctx.save();
      if(_state.enhance && !_state.showOriginal){
        _ctx.filter=ENHANCE_FILTER;
      }
      _ctx.translate(cw/2+_state.panX, ch/2+_state.panY);
      _ctx.rotate(_state.rotation*Math.PI/180);
      if(_state.flipH && !_state.showOriginal) _ctx.scale(-1,1);
      const iw=sourceImg.width, ih=sourceImg.height;
      _ctx.drawImage(sourceImg, -iw*z/2, -ih*z/2, iw*z, ih*z);
      _ctx.restore();
    }

    if(compareActive){
      // Left portion — pristine original.
      _ctx.save();
      _ctx.beginPath();
      _ctx.rect(0,0,pctX,ch);
      _ctx.clip();
      _paintOne(_origImg);
      _ctx.restore();
      // Right portion — background-removed result.
      _ctx.save();
      _ctx.beginPath();
      _ctx.rect(pctX,0,cw-pctX,ch);
      _ctx.clip();
      _paintOne(img);
      _ctx.restore();
      // Hairline divider so the split is genuinely visible even when
      // the two halves happen to render as very similar pixel content.
      _ctx.save();
      _ctx.strokeStyle='#FFCB45';
      _ctx.lineWidth=2;
      _ctx.beginPath();
      _ctx.moveTo(pctX,0);
      _ctx.lineTo(pctX,ch);
      _ctx.stroke();
      _ctx.restore();
    }else{
      // Plain render. While holding Before/After (peek gesture), always
      // show the pristine original even if background removal is
      // currently applied. Sizing reads from whichever image will
      // actually be drawn — bg removal may crop empty margins, so
      // img.width ≠ _origImg.width.
      const drawImg=_state.showOriginal?_origImg:img;
      _paintOne(drawImg);
    }

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
    // Always start on Result View for a fresh open, regardless of what
    // the modal was on when it was last closed.
    _view='result';
    _activeTool=null;
    if(_root){
      _root.setAttribute('data-view','result');
      _root.setAttribute('data-active-tool','');
    }
    if(_tileButtons){
      Object.keys(_tileButtons).forEach(function(k){
        if(_tileButtons[k]) _tileButtons[k].classList.remove('active');
      });
    }
    if(_bgStatusEl) _bgStatusEl.textContent='';
    _modal.classList.remove('hidden');
    // Focus trap minimal — escape closes.
    document.addEventListener('keydown',_onKeyDown);

    // Accept (a) an Image already loaded, (b) a data URL (or, Phase C, a
    // durable vihu-asset: reference), (c) a File.
    if(input instanceof HTMLImageElement){
      _origImg=input;
      _refreshBgControls();
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
        img.onload=function(){ _origImg=img; _refreshBgControls(); _render(); };
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
        img.onload=function(){ _origImg=img; _refreshBgControls(); _render(); };
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
    // Reset view/tool state so a re-open starts cleanly on Result View.
    // Otherwise closing while a tile is active leaves stale .active
    // classes and a lingering data-active-tool for the next open.
    _view='result';
    _activeTool=null;
    if(_root){
      _root.setAttribute('data-view','result');
      _root.setAttribute('data-active-tool','');
    }
    if(_tileButtons){
      Object.keys(_tileButtons).forEach(function(k){
        if(_tileButtons[k]) _tileButtons[k].classList.remove('active');
      });
    }
    if(_bgStatusEl) _bgStatusEl.textContent='';
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
