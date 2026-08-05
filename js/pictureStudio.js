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
  // Ship C — background-removal strength slider. Null = auto-detect (worker's
  // own detectBackground picks a tolerance based on the picture). A number
  // overrides that. Higher tolerance = more pixels considered "background"
  // = more aggressive removal. Slider lives inside the brush sub-panel
  // (shown only once removal has landed); dragging it re-invokes
  // _startBgRemoval with the override, which resets the working buffer
  // (any in-progress brush strokes are discarded — the exact right
  // trade, since strokes made against a different removal are no longer
  // meaningful anyway).
  let _bgStrengthSlider=null;
  let _bgStrengthOverride=null;   // null = auto; number = tolerance override
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
  // Contextual-collapse redesign — the edit-hint paragraph and the "✓ Done" /
  // "← Back" buttons all live at module scope so _toggleActiveTool can retitle
  // the hint per active tool ("Pick a brush size, then paint...") and toggle
  // both buttons' visibility (shown only while a tool is engaged). Back and
  // Done route to the identical _toggleActiveTool(null); Back reads as the
  // conventional "go back" affordance for touch, Done reads as "I'm finished
  // with this tool" for keyboard/click users — same outcome, two doorways.
  let _editHint=null, _editDoneBtn=null, _editBackBtn=null;
  // Ship B Refinements — always-visible kid zoom slider (🔍 [range] 🔎)
  // above the tool grid; replaces the previous Bigger/Smaller tile +
  // sub-panel entirely. Range is 5..400 (percent), mapped to _state.zoom
  // via /100.
  let _kidZoomSlider=null;
  // Ship B Refinements — magic overlay ("✨ Making the paper disappear...")
  // shown while on-demand background removal is in flight. Ported from
  // tools/background-remover/'s .magic-overlay pattern. Sparkle glyph +
  // message paragraph, absolutely positioned inside the modal.
  let _magicOverlay=null, _magicMessage=null;
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

  // Ship B — brush painting + crop, ported from tools/background-remover/
  // (cleanupBrush.js + cropper.js). The working buffer is the mutable
  // truth once bg removal has landed; _bgRemovedImg is a Canvas that
  // putImageData's from it after every stroke tick (no Image() roundtrip
  // per tick, would be too slow at 60Hz). On brush activation, _bgRemovedImg
  // stays a Canvas; on Apply, _bake reads _bgRemovedImg (Canvas) via
  // drawImage exactly like an Image, so downstream is unchanged.
  let _workingBuffer=null;
  // Brush mode: 'erase' | null. The old 'restore' mode was retired when
  // Bring It Back was rewired to per-stroke undo (matching what the Oops
  // tile used to do — Oops itself was removed in the same ship, since
  // Bring It Back now does its job).
  let _brushMode=null;             // 'erase' | null
  let _brushRadius=45;             // radius in image px; 45 = default 90 diameter
  const BRUSH_SIZE_CHOICES={small:15, medium:45, large:110}; // radii
  let _brushSizeKey='medium';
  let _cleanupHistory=[];          // [{changes: Map<pixelIndex, priorAlpha>}, ...]
  let _cleanupRedoStack=[];
  let _strokeChanges=null;         // Map filled during an in-progress drag
  let _brushPainting=false;
  let _brushSubPanel=null;
  let _brushRemoveBtn=null, _brushRestoreBtn=null;
  let _brushSizeBtns=null, _brushUndoBtn=null, _brushRedoBtn=null;
  let _brushCursor=null;
  // Ship C — floating scissors cursor overlay shown whenever the crop tool
  // is active. Mirrors _brushCursor's own DOM/pointer-tracking discipline
  // (position:absolute inside _stage, pointer-events:none) so it never
  // intercepts the crop-selection drag gesture the canvas listeners own.
  // Reads as ✂️ hovering at the pointer — a real, kid-friendly visual cue
  // that "you're now trimming," rather than the ordinary crosshair the
  // native cursor style would show alone.
  let _scissorsCursor=null;
  // Crop state — the pending rect (in working-buffer pixel space) plus
  // a pre-crop snapshot so Reset Crop can restore. Crop is only reachable
  // once _bgRemovedImg exists (Ship B scope: the crop tool crops the
  // bg-removed picture itself, so it can only meaningfully act on a
  // buffer that exists).
  let _cropTile=null;
  let _cropSubPanel=null;
  let _cropRect=null;              // {x,y,width,height} in working-buffer px
  let _cropDrag=null;              // {sx,sy,x0,y0} while drawing selection
  let _cropBoxEl=null;             // DOM overlay showing the pending selection
  let _preCropSnapshot=null;       // {buffer, width, height} for Reset Crop
  let _cropApplyBtn=null, _cropResetBtn=null, _cropTrashBtn=null;

  // Ported from tools/background-remover/js/cleanupBrush.js. See that
  // module's own doc comment for the soft-edge falloff rationale — the
  // brush's inner 55% is full-strength, fading linearly out to zero at
  // the outer edge. Only alpha is ever touched; RGB is preserved so a
  // restore later gives back the exact original colour.
  function _paintAlphaCircle(pb,cx,cy,radius,targetAlpha,onBeforeChange){
    var width=pb.width, height=pb.height, data=pb.data;
    var minX=Math.max(0,Math.floor(cx-radius));
    var maxX=Math.min(width-1,Math.ceil(cx+radius));
    var minY=Math.max(0,Math.floor(cy-radius));
    var maxY=Math.min(height-1,Math.ceil(cy+radius));
    if(minX>maxX||minY>maxY) return null;
    var innerRadius=radius*0.55;
    var falloffRange=Math.max(radius-innerRadius,0.0001);
    for(var y=minY;y<=maxY;y++){
      for(var x=minX;x<=maxX;x++){
        var dx=x+0.5-cx, dy=y+0.5-cy;
        var dist=Math.sqrt(dx*dx+dy*dy);
        if(dist>radius) continue;
        var falloff=dist<=innerRadius?0:(dist-innerRadius)/falloffRange;
        var pixelIndex=y*width+x;
        var alphaOffset=pixelIndex*4+3;
        var currentAlpha=data[alphaOffset];
        var newAlpha=Math.round(currentAlpha*falloff+targetAlpha*(1-falloff));
        if(newAlpha!==currentAlpha){
          if(onBeforeChange) onBeforeChange(pixelIndex,currentAlpha);
          data[alphaOffset]=newAlpha;
        }
      }
    }
    return {x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
  }
  // Ported from tools/background-remover/js/cropper.js.
  function _cropPixelBuffer(pb,bounds){
    var srcData=pb.data, srcWidth=pb.width;
    var out=new Uint8ClampedArray(bounds.width*bounds.height*4);
    for(var row=0;row<bounds.height;row++){
      var srcRowStart=((bounds.y+row)*srcWidth+bounds.x)*4;
      var dstRowStart=row*bounds.width*4;
      out.set(srcData.subarray(srcRowStart,srcRowStart+bounds.width*4),dstRowStart);
    }
    return {data:out,width:bounds.width,height:bounds.height};
  }
  // Dual of _cropPixelBuffer — keeps buffer dimensions unchanged and
  // instead zeroes every RGBA channel of pixels INSIDE `bounds` to
  // fully transparent, leaving everything OUTSIDE the box untouched.
  // Used by Trash It, the sibling of Keep This: the two operate on the
  // same selection box with opposite intents (keep-inside vs discard-
  // inside). Since dimensions never change, pan/beforeAfter/BA-slider
  // state stays valid — no recentering needed by the caller.
  function _trashPixelsInBox(pb,bounds){
    var out=new Uint8ClampedArray(pb.data);
    var w=pb.width;
    for(var row=0;row<bounds.height;row++){
      var rowBase=((bounds.y+row)*w+bounds.x)*4;
      for(var col=0;col<bounds.width;col++){
        out[rowBase+col*4+0]=0;
        out[rowBase+col*4+1]=0;
        out[rowBase+col*4+2]=0;
        out[rowBase+col*4+3]=0;
      }
    }
    return {data:out,width:pb.width,height:pb.height};
  }

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
    // Ship B Refinements — circular brush cursor overlay. Follows the
    // mouse whenever a brush mode (Remove More / Bring It Back) is
    // active. `pointer-events:none` so it never intercepts the actual
    // paint gesture (which flows through the canvas's own listeners).
    // Sized live to `_brushRadius * effective_zoom` in CSS px.
    _brushCursor=document.createElement('div');
    _brushCursor.className='picture-studio-brush-cursor hidden';
    _stage.appendChild(_brushCursor);
    // Ship C — floating ✂️ overlay for crop mode (see _scissorsCursor
    // declaration comment). Hidden by default; _updateStageCursor toggles
    // visibility whenever _activeTool==='crop', and the shared mousemove
    // handler keeps its position tracking the pointer.
    _scissorsCursor=document.createElement('div');
    _scissorsCursor.className='picture-studio-scissors-cursor hidden';
    _scissorsCursor.textContent='✂️';
    _scissorsCursor.setAttribute('aria-hidden','true');
    _stage.appendChild(_scissorsCursor);
    // Ship B Refinements — magic overlay shown while on-demand background
    // removal is in flight. Ported from tools/background-remover/'s
    // .magic-overlay pattern. Absolutely-positioned inside the stage so
    // it covers the canvas + brush cursor together while removal runs.
    _magicOverlay=document.createElement('div');
    _magicOverlay.className='picture-studio-magic-overlay hidden';
    const magicSparkle=document.createElement('div');
    magicSparkle.className='picture-studio-magic-sparkle';
    magicSparkle.setAttribute('aria-hidden','true');
    magicSparkle.textContent='✨';
    _magicOverlay.appendChild(magicSparkle);
    _magicMessage=document.createElement('p');
    _magicMessage.className='picture-studio-magic-message';
    _magicMessage.textContent='✨ Making the paper disappear...';
    _magicOverlay.appendChild(_magicMessage);
    _stage.appendChild(_magicOverlay);
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
    _editHint=document.createElement('p');
    _editHint.className='picture-studio-edit-hint';
    _editHint.textContent='Tap a tool, then touch your picture.';
    _editPanel.appendChild(_editHint);

    // Ship B Refinements — always-visible kid zoom slider row (🔍 [slider] 🔎),
    // ported from tools/background-remover/'s own .kid-zoom-row pattern.
    // Previously a Bigger/Smaller tile → sub-panel; now a single control
    // sitting above the tool grid where it's reachable from any tool state.
    // Value is 5..400 (percent); we map to _state.zoom via /100.
    const zoomRow=document.createElement('div');
    zoomRow.className='picture-studio-kid-zoom-row';
    const zoomIconSmall=document.createElement('span');
    zoomIconSmall.className='picture-studio-kid-zoom-glyph';
    zoomIconSmall.setAttribute('aria-hidden','true');
    zoomIconSmall.textContent='🔍';
    zoomRow.appendChild(zoomIconSmall);
    const zoomSlider=document.createElement('input');
    zoomSlider.type='range';
    zoomSlider.min='5';
    zoomSlider.max='400';
    zoomSlider.value='100';
    zoomSlider.className='picture-studio-kid-zoom-slider';
    zoomSlider.setAttribute('aria-label','Make the picture bigger or smaller');
    zoomSlider.addEventListener('input',function(){
      _setZoom(parseInt(zoomSlider.value,10)/100);
    });
    zoomRow.appendChild(zoomSlider);
    const zoomIconBig=document.createElement('span');
    zoomIconBig.className='picture-studio-kid-zoom-glyph';
    zoomIconBig.setAttribute('aria-hidden','true');
    zoomIconBig.textContent='🔎';
    zoomRow.appendChild(zoomIconBig);
    _editPanel.appendChild(zoomRow);
    _kidZoomSlider=zoomSlider;

    const toolGrid=document.createElement('div');
    toolGrid.className='picture-studio-tool-grid';
    _tileButtons={};
    // Ship B Refinements — primary tiles match tools/background-remover/'s
    // own kid-friendly toolbar exactly: Remove Paper / Bring It Back /
    // Trim Picture / Turn-Flip / Oops (per-stroke undo). Bigger/Smaller
    // is the always-visible slider above, not a tile.
    //
    // Product decision — background removal is ON-DEMAND, never a
    // default: open() shows the ORIGINAL picture on the Result view and
    // never auto-runs the worker. The first tap here kicks the removal
    // itself (the "✨ Making the paper disappear..." magic overlay shows
    // while it runs) AND arms the erase brush, so once removal lands the
    // child can keep refining by hand — one tile, both jobs. Brush
    // strokes made while removal is still in flight are safely no-ops
    // (_paintAt guards on _workingBuffer). Label is "Remove Paper"
    // (matching the overlay's own language) since pre-removal there is
    // nothing yet to remove "more" of.
    _tileButtons.removeMore=_buildTile(toolGrid,'✨','Remove Paper',function(){
      if(!_bgRemovedImg && !_bgBusy) _startBgRemoval();
      _brushMode=(_brushMode==='erase')?null:'erase';
      const want=_brushMode?'brush':null;
      if(_activeTool!==want) _toggleActiveTool(want);
      else{ _refreshBgControls(); _updateStageCursor(); _updateBrushCursorVisibility(); }
    },{key:'removeMore'});
    // Bring It Back is now per-stroke undo (it used to enter a 'restore'
    // brush mode; the old Oops tile — which did per-stroke undo — is
    // retired since Bring It Back now does its job in one tap, matching
    // the affordance's own emotional read for a child ("bring back what
    // I just accidentally removed").
    _tileButtons.bringBack=_buildTile(toolGrid,'❤️','Bring It Back',function(){ _undoBrushStroke(); },{key:'bringBack'});
    _cropTile=_buildTile(toolGrid,'✂️','Trim Picture',function(){ _toggleActiveTool('crop'); },{key:'crop'});
    _tileButtons.crop=_cropTile;
    _tileButtons.flip=_buildTile(toolGrid,'🔄','Turn / Flip',function(){ _toggleActiveTool('flip'); },{key:'flip'});
    _brightenTile=_buildTile(toolGrid,'💡','Brighten',function(){
      _state.enhance=!_state.enhance;
      _brightenTile.classList.toggle('active',!!_state.enhance);
      _render();
    },{key:'brighten'});
    _tileButtons.brighten=_brightenTile;
    _tileButtons.peek=_buildTile(toolGrid,'👁️','Peek Original',null,{hold:true,key:'peek'});
    _tileButtons.reset=_buildTile(toolGrid,'🔄','New Picture',function(){ _toggleActiveTool('reset'); },{key:'reset'});
    _editPanel.appendChild(toolGrid);

    // Sub-panels area — one per tool, hidden by default. Ship B
    // Refinements: 'brush' sub-panel (was inside 'bg') hosts size +
    // Before/After compare. Bigger/Smaller sub-panel retired.
    //
    // Contextual-collapse redesign — sub-panels live back inside `_editPanel`
    // (a prior interim ship briefly moved them onto the stage as an
    // absolute-positioned overlay to eliminate the right-pane scrollbar,
    // but the overlay obscured the very canvas a Story Author was trying
    // to paint on — traded one bad state for a worse one). The right fix
    // is contextual collapse: when a tool is active, CSS hides every tile
    // NOT relevant to that tool via the `data-tile-key` attribute filter
    // (see .picture-studio[data-active-tool] rules in style.css), leaving
    // just the active tool's tile + its sub-panel + a "✓ Done" button —
    // one focused thing at a time, kid-friendly, no scroll structurally
    // because there's simply less content in the pane once collapsed, and
    // nothing ever overlaps the canvas.
    _subPanels={};
    const subWrap=document.createElement('div');
    subWrap.className='picture-studio-subpanels';
    _subPanels.brush=_buildBrushSubPanel();
    _subPanels.flip=_buildFlipSubPanel();
    _subPanels.crop=_buildCropSubPanel();
    _subPanels.reset=_buildResetSubPanel();
    Object.keys(_subPanels).forEach(function(k){ subWrap.appendChild(_subPanels[k]); });
    _editPanel.appendChild(subWrap);

    // Contextual-collapse redesign — "← Back" and "✓ Done" buttons, shown
    // only while a tool is active (CSS hides them both when `data-active-tool`
    // is empty). Sit side-by-side at the bottom of the right pane so a Story
    // Author always has a clear, kid-friendly way back to the full tile grid,
    // reachable from every sub-panel uniformly. Both routes call
    // _toggleActiveTool(null) — Back reads as the conventional touch-first
    // "go back" affordance, Done reads as "I'm finished with this tool" for
    // keyboard/mouse users. Same outcome, two doorways.
    const editActionsRow=document.createElement('div');
    editActionsRow.className='picture-studio-edit-actions-row';
    _editBackBtn=document.createElement('button');
    _editBackBtn.type='button';
    _editBackBtn.className='picture-studio-edit-back-btn';
    _editBackBtn.textContent='← Back';
    _editBackBtn.addEventListener('click',function(){ _toggleActiveTool(null); });
    editActionsRow.appendChild(_editBackBtn);
    _editDoneBtn=document.createElement('button');
    _editDoneBtn.type='button';
    _editDoneBtn.className='picture-studio-edit-done-btn';
    _editDoneBtn.textContent='✓ Done';
    _editDoneBtn.addEventListener('click',function(){ _toggleActiveTool(null); });
    editActionsRow.appendChild(_editDoneBtn);
    _editPanel.appendChild(editActionsRow);

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
    // Contextual right-pane redesign: a `data-tile-key` attribute lets CSS
    // selectively hide every tile except the ones relevant to the currently
    // active tool once one is engaged (see .picture-studio[data-active-tool]
    // rules in style.css). Set by the caller via opts.key.
    if(opts && opts.key) btn.setAttribute('data-tile-key',opts.key);
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
  // Ship B Refinements — Brush sub-panel (was the "bg" sub-panel).
  // Background removal is on-demand (the ✨ Remove Paper tile kicks
  // _startBgRemoval + the magic overlay), so this sub-panel needs no
  // a top "Remove Background" button / undo / status line. It hosts only
  // the Before/After compare slider + the brush size + Undo/Redo — the
  // brush mode itself (erase / restore) is picked directly from the two
  // primary tiles ("Remove More" / "Bring It Back") that dispatch here.
  function _buildBrushSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','brush');
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Pick a brush size, then paint on your picture.';
    p.appendChild(hint);
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
    // Brush controls — size + Undo/Redo. Revealed only once a bg
    // removal has landed (kicked on demand by the ✨ tile). Ported from
    // tools/background-remover/ (cleanupBrush.js).
    _brushSubPanel=document.createElement('div');
    _brushSubPanel.className='picture-studio-brush-panel hidden';
    const sizeRow=document.createElement('div');
    sizeRow.className='picture-studio-subpanel-row';
    const sizeLabel=document.createElement('span');
    sizeLabel.className='picture-studio-subpanel-label';
    sizeLabel.textContent='How big?';
    sizeRow.appendChild(sizeLabel);
    _brushSizeBtns={};
    // Visual size choice: each button shows a real circle sized
    // proportionally to its brush radius (small=15/medium=45/large=110
    // image px). The rendered circles use a fixed on-screen diameter
    // scale of 10px/12px/22px — big enough to distinguish at a glance,
    // small enough to fit three across the sub-panel row alongside the
    // "How big?" label. A visual > text label — a child does not need
    // to read "Medium" to know the middle circle is medium.
    const SIZE_VISUAL_PX={small:10,medium:16,large:24};
    const SIZE_ARIA={small:'Small brush',medium:'Medium brush',large:'Large brush'};
    ['small','medium','large'].forEach(function(k){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-subpanel-btn picture-studio-brush-size-btn';
      b.setAttribute('aria-label',SIZE_ARIA[k]);
      b.setAttribute('title',SIZE_ARIA[k]);
      const dot=document.createElement('span');
      dot.className='picture-studio-brush-size-dot';
      dot.style.width=SIZE_VISUAL_PX[k]+'px';
      dot.style.height=SIZE_VISUAL_PX[k]+'px';
      b.appendChild(dot);
      b.addEventListener('click',function(){
        _brushSizeKey=k;
        _brushRadius=BRUSH_SIZE_CHOICES[k];
        _refreshBgControls();
        _updateBrushCursorSize();
      });
      sizeRow.appendChild(b);
      _brushSizeBtns[k]=b;
    });
    _brushSubPanel.appendChild(sizeRow);
    // Ship C — background-removal strength slider. Higher = more
    // pixels considered background = more aggressive removal. Uses
    // 'change' (release), not 'input' (drag tick), because re-running
    // BG removal is a worker roundtrip and resets any in-progress
    // brush strokes (see _onBgResult) — spamming it on every drag
    // pixel would be slow AND destroy the user's current work
    // dozens of times per drag. Slider value 0..100 maps to worker
    // tolerance 0..100 directly; a value that never changes from the
    // initial 50 leaves _bgStrengthOverride null so the worker keeps
    // auto-detecting per picture (its own smarter default).
    const strengthRow=document.createElement('div');
    strengthRow.className='picture-studio-subpanel-row';
    const strengthLabel=document.createElement('span');
    strengthLabel.className='picture-studio-subpanel-label';
    strengthLabel.textContent='How strong?';
    strengthRow.appendChild(strengthLabel);
    _bgStrengthSlider=document.createElement('input');
    _bgStrengthSlider.type='range';
    _bgStrengthSlider.min='0';
    _bgStrengthSlider.max='100';
    _bgStrengthSlider.value='50';
    _bgStrengthSlider.className='picture-studio-strength-slider';
    _bgStrengthSlider.setAttribute('aria-label','Background removal strength');
    _bgStrengthSlider.addEventListener('change',function(){
      const pct=parseInt(_bgStrengthSlider.value,10);
      _bgStrengthOverride=pct;
      _startBgRemoval();
    });
    strengthRow.appendChild(_bgStrengthSlider);
    _brushSubPanel.appendChild(strengthRow);
    const undoRow=document.createElement('div');
    undoRow.className='picture-studio-subpanel-row';
    _brushUndoBtn=document.createElement('button');
    _brushUndoBtn.type='button';
    _brushUndoBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _brushUndoBtn.textContent='↶ Undo';
    _brushUndoBtn.addEventListener('click',_undoBrushStroke);
    undoRow.appendChild(_brushUndoBtn);
    _brushRedoBtn=document.createElement('button');
    _brushRedoBtn.type='button';
    _brushRedoBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _brushRedoBtn.textContent='↷ Redo';
    _brushRedoBtn.addEventListener('click',_redoBrushStroke);
    undoRow.appendChild(_brushRedoBtn);
    _brushSubPanel.appendChild(undoRow);
    p.appendChild(_brushSubPanel);
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
      _workingBuffer=null;
      _cleanupHistory=[];
      _cleanupRedoStack=[];
      _brushMode=null;
      _cropRect=null;
      _preCropSnapshot=null;
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
  // Ship B — Crop sub-panel. Only meaningful once bg removal has landed
  // (so there's a working buffer to crop). Selection is drawn on the
  // stage via a floating overlay DIV positioned in screen coords, then
  // converted to working-buffer coordinates on Apply.
  function _buildCropSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','crop');
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    // Rewritten to match the two-way action row below — a Story Author
    // picks a box, then either keeps only what's inside it (Keep This)
    // or throws only what's inside it away (Trash It). Both operate on
    // the same box and both back off via Undo Trim.
    hint.textContent='Drag a box around a part of your picture.';
    p.appendChild(hint);
    const row=document.createElement('div');
    row.className='picture-studio-subpanel-row';
    // Trash It sits first (left) because "get rid of this part" is the
    // more common gesture on a real photo — the coral pill matches its
    // destructive semantics (removes content) vs. Keep This which is
    // constructive (preserves the box, discards everything outside it).
    // Both share _preCropSnapshot so Undo Trim works either way.
    _cropTrashBtn=document.createElement('button');
    _cropTrashBtn.type='button';
    _cropTrashBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-danger';
    _cropTrashBtn.textContent='🗑 Trash It';
    _cropTrashBtn.addEventListener('click',_trashCropArea);
    row.appendChild(_cropTrashBtn);
    _cropApplyBtn=document.createElement('button');
    _cropApplyBtn.type='button';
    _cropApplyBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-primary';
    _cropApplyBtn.textContent='✓ Keep This';
    _cropApplyBtn.addEventListener('click',_applyCrop);
    row.appendChild(_cropApplyBtn);
    p.appendChild(row);
    _cropResetBtn=document.createElement('button');
    _cropResetBtn.type='button';
    _cropResetBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    // Reads as an action, matches the reference sheet's wording, and
    // honestly describes what happens either way — the last Trash It
    // or Keep This is reverted from _preCropSnapshot.
    _cropResetBtn.textContent='↩ Undo Trim';
    _cropResetBtn.addEventListener('click',_resetCrop);
    p.appendChild(_cropResetBtn);
    const auto=document.createElement('button');
    auto.type='button';
    auto.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    auto.textContent='✨ Auto Crop to Content';
    auto.addEventListener('click',_autoCrop);
    p.appendChild(auto);
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
  // Contextual-collapse redesign — per-tool hint text shown at the top of
  // the right pane. The default (no tool active) reads as an invitation
  // to explore; each active tool restates what the sub-controls beneath
  // it are about to do, so a Story Author never has to guess what they
  // just tapped. Kept as a data map rather than an if/else chain so a
  // future tool can be added by extending exactly this one place.
  const _EDIT_HINTS={
    '': 'Tap a tool, then touch your picture.',
    brush: 'Pick a brush size, then paint on your picture.',
    crop: 'Drag on your picture to choose what to keep.',
    flip: 'Turn or flip your picture.',
    reset: 'Start over with a fresh picture?'
  };

  function _toggleActiveTool(tool){
    if(_activeTool===tool) tool=null;
    _activeTool=tool;
    if(_root) _root.setAttribute('data-active-tool',tool||'');
    if(_editHint) _editHint.textContent=_EDIT_HINTS[tool||'']||_EDIT_HINTS[''];
    if(_tileButtons){
      // Primary tile grid: removeMore/bringBack/crop/flip/brighten/peek/
      // reset. The 'crop'/'flip'/'reset' entries drive their own sub-panels
      // (data-active-tool); 'removeMore' toggles _brushMode + activates the
      // shared 'brush' sub-panel via _toggleActiveTool('brush') from its
      // own click handler, so its .active class is driven by _refreshBgControls
      // reading _brushMode, not by this list. 'bringBack' is a one-shot
      // undo — never gets an active state at all.
      ['crop','flip','brighten','peek','reset'].forEach(function(k){
        if(_tileButtons[k]) _tileButtons[k].classList.toggle('active',_activeTool===k);
      });
    }
    // Ship B — leaving brush mode: clear brush selection so a subsequent
    // re-open of the brush sub-panel doesn't inherit a stale brush.
    if(tool!=='brush'){
      _brushMode=null;
      _refreshBgControls();
      _updateBrushCursorVisibility();
    }else{
      // Entering brush mode: size the circular cursor to match the
      // current brush radius before the first mousemove ever fires.
      _updateBrushCursorVisibility();
      _updateBrushCursorSize();
    }
    // Leaving crop mode: tear down the on-stage selection overlay if any.
    if(tool!=='crop'){ _tearDownCropBox(); }
    _updateStageCursor();
  }
  function _updateStageCursor(){
    if(!_stage) return;
    if(_brushMode==='erase') _stage.style.cursor='crosshair';
    else if(_activeTool==='crop') _stage.style.cursor='none';
    else _stage.style.cursor='';
    // Ship C — the ✂️ scissors overlay stands in for the cursor while
    // crop is active, so `cursor:none` hides the native pointer to let it
    // read cleanly on its own.
    if(_scissorsCursor) _scissorsCursor.classList.toggle('hidden',_activeTool!=='crop');
  }

  function _setZoom(z){
    _state.zoom=Math.max(0.05,Math.min(4,z));
    _render();
    // Ship B Refinements — keep the always-visible kid zoom slider in
    // sync with wheel-driven zoom changes so the two never disagree.
    if(_kidZoomSlider){
      const pct=Math.round(_state.zoom*100);
      if(String(pct)!==_kidZoomSlider.value) _kidZoomSlider.value=String(pct);
    }
    // Live-resize the brush cursor to match the new effective radius on screen.
    _updateBrushCursorSize();
  }

  // Ship B Refinements — show/hide the circular brush cursor overlay.
  // Called from tile handlers whenever brush mode toggles on/off.
  function _updateBrushCursorVisibility(){
    if(!_brushCursor) return;
    const on=(_brushMode==='erase');
    _brushCursor.classList.toggle('hidden',!on);
  }

  // Ship B Refinements — resize the circular brush cursor to match the
  // brush's effective on-screen diameter. Called on brush size change,
  // zoom change, and whenever the cursor is first shown.
  function _updateBrushCursorSize(){
    if(!_brushCursor||!_canvas) return;
    const rect=_canvas.getBoundingClientRect();
    // Fallback if the canvas hasn't laid out yet (fresh open before
    // first render): compute against the stage's own rect.
    if(!rect.width){
      _brushCursor.style.width='0px';
      _brushCursor.style.height='0px';
      return;
    }
    const img=_activeImg();
    if(!img){ return; }
    // Match _screenToContent's own scale math but in reverse: image-px →
    // logical canvas-px → CSS-px.
    const eff=_effSize();
    const s=_stageRect();
    const fit=Math.min(s.w/eff.w,s.h/eff.h);
    const z=fit*_state.zoom;                       // logical px per image px
    const logicalToCss=rect.width/_canvas.width;   // CSS px per logical px
    const diameterCss=_brushRadius*2*z*logicalToCss;
    _brushCursor.style.width=diameterCss+'px';
    _brushCursor.style.height=diameterCss+'px';
    // Nudge the origin so `transform: translate(-50%, -50%)` in CSS
    // centres the circle on the cursor position (see mousemove below).
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
    // Ship B Refinements — show the magic overlay while removal runs.
    if(_magicOverlay) _magicOverlay.classList.remove('hidden');
    _refreshBgControls();
    // Transfer the pixel buffer's underlying ArrayBuffer so the main
    // thread doesn't hold a duplicate copy — same discipline the
    // standalone tool's app.js already established.
    try{
      const opts={strategy:'white-paper', autoCrop:true, featherRadius:1};
      // Ship C — thread the strength-slider override in. Null passes through
      // to the worker as-is (its own default: auto-detect). A number
      // overrides tolerance directly (see worker.js:47).
      if(_bgStrengthOverride!=null) opts.tolerance=_bgStrengthOverride;
      worker.postMessage({
        type:'process',
        jobId:_bgJobId,
        pixelBuffer:buf,
        options:opts
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
    // Ship B — keep the pixel buffer alive as the mutable source of
    // truth. Brush strokes mutate its alpha in place, then _syncBgCanvas
    // putImageData's the buffer back onto _bgRemovedImg (a Canvas, not
    // an Image) so the visible preview updates without an async
    // Image().onload roundtrip per mousemove tick. drawImage accepts a
    // Canvas identically to an Image, so _render/_bake/_bakeSourceForBg
    // all keep working unchanged.
    _workingBuffer={data:new Uint8ClampedArray(pb.data),width:pb.width,height:pb.height};
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    const c=document.createElement('canvas');
    c.width=pb.width; c.height=pb.height;
    const cx=c.getContext('2d');
    cx.putImageData(new ImageData(new Uint8ClampedArray(_workingBuffer.data),pb.width,pb.height),0,0);
    _bgRemovedImg=c;
    _bgRemovedDataURL=null; // recomputed on demand from the live canvas
    _bgBusy=false;
    // Reset rotation/flip since _bakeSourceForBg already baked them
    // into the new source — leaving them applied would double-rotate
    // the result. Zoom/pan/mode preserved.
    _state.rotation=0;
    _state.flipH=false;
    if(_bgStatusEl) _bgStatusEl.textContent='Background removed.';
    // Ship B Refinements — hide the magic overlay once removal lands.
    if(_magicOverlay) _magicOverlay.classList.add('hidden');
    _refreshBgControls();
    _render();
  }
  // Push the working buffer's current pixels onto _bgRemovedImg (a
  // Canvas). Called after every brush stroke tick so the visible preview
  // stays in sync with the buffer without an Image() roundtrip.
  function _syncBgCanvas(){
    if(!_bgRemovedImg||!_workingBuffer) return;
    // If a crop just changed the buffer's size, resize the canvas too.
    if(_bgRemovedImg.width!==_workingBuffer.width||_bgRemovedImg.height!==_workingBuffer.height){
      _bgRemovedImg.width=_workingBuffer.width;
      _bgRemovedImg.height=_workingBuffer.height;
    }
    const cx=_bgRemovedImg.getContext('2d');
    cx.putImageData(new ImageData(new Uint8ClampedArray(_workingBuffer.data),_workingBuffer.width,_workingBuffer.height),0,0);
  }
  function _onBgError(msg){
    _bgBusy=false;
    if(_bgStatusEl) _bgStatusEl.textContent='Removal failed — '+(msg.message||'try again')+'.';
    // Ship B Refinements — hide the magic overlay on failure too. The
    // failure leaves the original picture visible with no bg removed, so
    // the user can still edit/save/cancel; the tile grid + always-visible
    // zoom slider remain fully functional either way.
    if(_magicOverlay) _magicOverlay.classList.add('hidden');
    _refreshBgControls();
  }
  function _undoBgRemoval(){
    if(_bgBusy) return;
    _bgRemovedImg=null;
    _bgRemovedDataURL=null;
    _workingBuffer=null;
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _brushMode=null;
    _cropRect=null;
    _preCropSnapshot=null;
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
    // Ship B — brush + crop controls only make sense after a bg removal.
    if(_brushSubPanel){
      _brushSubPanel.classList.toggle('hidden',!_bgRemovedImg);
    }
    if(_brushRemoveBtn) _brushRemoveBtn.classList.toggle('active',_brushMode==='erase');
    if(_brushRestoreBtn) _brushRestoreBtn.classList.toggle('active',_brushMode==='restore');
    if(_brushSizeBtns){
      Object.keys(_brushSizeBtns).forEach(function(k){
        _brushSizeBtns[k].classList.toggle('active',_brushSizeKey===k);
      });
    }
    if(_brushUndoBtn) _brushUndoBtn.disabled=!(_cleanupHistory&&_cleanupHistory.length);
    if(_brushRedoBtn) _brushRedoBtn.disabled=!(_cleanupRedoStack&&_cleanupRedoStack.length);
    if(_cropTile) _cropTile.disabled=!_bgRemovedImg;
    if(_cropApplyBtn) _cropApplyBtn.disabled=!(_cropRect&&_bgRemovedImg);
    if(_cropTrashBtn) _cropTrashBtn.disabled=!(_cropRect&&_bgRemovedImg);
    if(_cropResetBtn) _cropResetBtn.disabled=!_preCropSnapshot;
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
      // Ship B — mode-aware routing:
      //   • Brush mode (Remove More / Bring It Back): each mousedown starts
      //     a new stroke; paintAt handles the point + subsequent drags via
      //     _brushPainting flag.
      //   • Crop mode: mousedown starts a selection drag; the overlay DIV
      //     tracks it in screen coords, finalized on mouseup into content
      //     coords.
      //   • Default: pan/zoom, as before.
      if(_brushMode==='erase'||_brushMode==='restore'){
        _brushPainting=true;
        _strokeChanges=new Map();
        _paintAt(e.clientX,e.clientY);
        e.preventDefault();
        return;
      }
      if(_activeTool==='crop'){
        _startCropDrag(e.clientX,e.clientY);
        e.preventDefault();
        return;
      }
      _drag={sx:e.clientX,sy:e.clientY,px:_state.panX,py:_state.panY};
      e.preventDefault();
    });
    window.addEventListener('mousemove',function(e){
      // Ship B Refinements — always keep the circular brush cursor
      // tracking the pointer whenever a brush mode is active, whether
      // or not a paint gesture is in flight. CSS `translate(-50%,-50%)`
      // centres the DIV on this exact point.
      if(_brushMode==='erase'&&_brushCursor&&_stage){
        const stageRect=_stage.getBoundingClientRect();
        _brushCursor.style.left=(e.clientX-stageRect.left)+'px';
        _brushCursor.style.top=(e.clientY-stageRect.top)+'px';
      }
      // Ship C — track the ✂️ scissors overlay to the pointer whenever
      // the crop tool is active. Uses the same stage-relative coordinate
      // conversion the brush cursor already uses.
      if(_activeTool==='crop'&&_scissorsCursor&&_stage){
        const stageRect2=_stage.getBoundingClientRect();
        _scissorsCursor.style.left=(e.clientX-stageRect2.left)+'px';
        _scissorsCursor.style.top=(e.clientY-stageRect2.top)+'px';
      }
      if(_brushPainting){
        _paintAt(e.clientX,e.clientY);
        return;
      }
      if(_cropDrag){
        _updateCropDrag(e.clientX,e.clientY);
        return;
      }
      if(!_drag) return;
      _state.panX=_drag.px+(e.clientX-_drag.sx);
      _state.panY=_drag.py+(e.clientY-_drag.sy);
      _render();
    });
    window.addEventListener('mouseup',function(){
      if(_brushPainting){ _finishStroke(); }
      if(_cropDrag){ _finishCropDrag(); }
      _drag=null;
    });
    _canvas.addEventListener('wheel',function(e){
      // Wheel keeps meaning zoom, even in brush/crop mode — a Story Author
      // will zoom in to paint precisely on small areas.
      e.preventDefault();
      _setZoom(_state.zoom*(e.deltaY<0?1.10:1/1.10));
    },{passive:false});
  }

  // ---------- Ship B: Brush painting -------------------------------
  // Convert a client (screen) point into working-buffer coordinates,
  // then call _paintAlphaCircle to mutate alpha in place. Only run while
  // the bg-removed image exists (_workingBuffer set) and a brush mode
  // is active. _syncBgCanvas repaints _bgRemovedImg after each tick.
  function _paintAt(clientX,clientY){
    if(!_workingBuffer||!_bgRemovedImg||!_canvas) return;
    const contentPoint=_screenToContent(clientX,clientY,_bgRemovedImg.width,_bgRemovedImg.height);
    if(!contentPoint) return;
    const targetAlpha=(_brushMode==='erase')?0:255;
    // Skip already-touched pixels so an undo stack entry never
    // over-writes the true starting alpha (per cleanupBrush.js discipline).
    const onBefore=function(pixelIndex,priorAlpha){
      if(!_strokeChanges.has(pixelIndex)) _strokeChanges.set(pixelIndex,priorAlpha);
    };
    _paintAlphaCircle(_workingBuffer,contentPoint.x,contentPoint.y,_brushRadius,targetAlpha,onBefore);
    _syncBgCanvas();
    _render();
  }
  // Inverse of _paintOne's transform. Since bg removal resets rotation
  // and flip to 0 (see _onBgResult), only pan + zoom apply here — the
  // math simplifies to: content = (screen - canvasCenter - pan) / (fit*zoom)
  // + imageCenter. If a future change lets brush painting run before bg
  // removal, this needs to also invert rotate/flip.
  function _screenToContent(clientX,clientY,imgW,imgH){
    const rect=_canvas.getBoundingClientRect();
    const cssToLogicalX=_canvas.width/rect.width;
    const cssToLogicalY=_canvas.height/rect.height;
    const sx=(clientX-rect.left)*cssToLogicalX;
    const sy=(clientY-rect.top)*cssToLogicalY;
    const cw=_canvas.width, ch=_canvas.height;
    const eff={w:imgW,h:imgH};   // rotation is always 0 after bg removal
    const s=_stageRect();
    const fit=Math.min(s.w/eff.w,s.h/eff.h);
    const z=fit*_state.zoom;
    // Screen point → offset from canvas centre → subtract pan → divide
    // by z → shift back to image top-left origin.
    const cx=(sx-cw/2-_state.panX)/z + imgW/2;
    const cy=(sy-ch/2-_state.panY)/z + imgH/2;
    if(cx<0||cy<0||cx>=imgW||cy>=imgH) return null;
    return {x:cx,y:cy};
  }
  function _finishStroke(){
    _brushPainting=false;
    if(_strokeChanges&&_strokeChanges.size){
      _cleanupHistory.push({changes:_strokeChanges});
      _cleanupRedoStack=[]; // any new stroke invalidates the redo trail
    }
    _strokeChanges=null;
    _refreshBgControls();
  }
  function _undoBrushStroke(){
    if(!_cleanupHistory.length||!_workingBuffer) return;
    const entry=_cleanupHistory.pop();
    const currentSnapshot=new Map();
    entry.changes.forEach(function(priorAlpha,pixelIndex){
      const alphaOffset=pixelIndex*4+3;
      currentSnapshot.set(pixelIndex,_workingBuffer.data[alphaOffset]);
      _workingBuffer.data[alphaOffset]=priorAlpha;
    });
    _cleanupRedoStack.push({changes:currentSnapshot});
    _syncBgCanvas();
    _render();
    _refreshBgControls();
  }
  function _redoBrushStroke(){
    if(!_cleanupRedoStack.length||!_workingBuffer) return;
    const entry=_cleanupRedoStack.pop();
    const inverse=new Map();
    entry.changes.forEach(function(nextAlpha,pixelIndex){
      const alphaOffset=pixelIndex*4+3;
      inverse.set(pixelIndex,_workingBuffer.data[alphaOffset]);
      _workingBuffer.data[alphaOffset]=nextAlpha;
    });
    _cleanupHistory.push({changes:inverse});
    _syncBgCanvas();
    _render();
    _refreshBgControls();
  }

  // ---------- Ship B: Crop ----------------------------------------
  // The crop selection lives as a DOM overlay positioned in screen
  // coords over _stage; on Apply, its screen rect is converted to
  // working-buffer coordinates via _screenToContent and passed to
  // _cropPixelBuffer. _preCropSnapshot enables Reset Crop.
  function _startCropDrag(clientX,clientY){
    if(!_workingBuffer) return;
    const stageRect=_stage.getBoundingClientRect();
    _cropDrag={
      sx:clientX,sy:clientY,
      ox:stageRect.left,oy:stageRect.top
    };
    _ensureCropBox();
    _cropBoxEl.style.left=(clientX-stageRect.left)+'px';
    _cropBoxEl.style.top=(clientY-stageRect.top)+'px';
    _cropBoxEl.style.width='0px';
    _cropBoxEl.style.height='0px';
    _cropBoxEl.classList.remove('hidden');
  }
  function _updateCropDrag(clientX,clientY){
    if(!_cropDrag||!_cropBoxEl) return;
    const x=Math.min(_cropDrag.sx,clientX)-_cropDrag.ox;
    const y=Math.min(_cropDrag.sy,clientY)-_cropDrag.oy;
    const w=Math.abs(clientX-_cropDrag.sx);
    const h=Math.abs(clientY-_cropDrag.sy);
    _cropBoxEl.style.left=x+'px';
    _cropBoxEl.style.top=y+'px';
    _cropBoxEl.style.width=w+'px';
    _cropBoxEl.style.height=h+'px';
  }
  function _finishCropDrag(){
    if(!_cropDrag) return;
    const startX=Math.min(_cropDrag.sx,_lastMouseClientX());
    // On mouseup we've already been fed the last mousemove; snapshot
    // the box's current screen-rect and convert both corners.
    const rect=_cropBoxEl.getBoundingClientRect();
    _cropDrag=null;
    if(rect.width<4||rect.height<4){
      // Ignore tiny/accidental drags.
      _tearDownCropBox();
      _cropRect=null;
      _refreshBgControls();
      return;
    }
    const topLeft=_screenToContent(rect.left,rect.top,_bgRemovedImg.width,_bgRemovedImg.height);
    const botRight=_screenToContent(rect.right,rect.bottom,_bgRemovedImg.width,_bgRemovedImg.height);
    if(!topLeft||!botRight){
      // Selection extends outside the image — clamp to image bounds so
      // the crop is still a valid rectangle.
      const clamp=function(p){
        if(!p) return null;
        return {
          x:Math.max(0,Math.min(_bgRemovedImg.width-1,p.x)),
          y:Math.max(0,Math.min(_bgRemovedImg.height-1,p.y))
        };
      };
      const tl=clamp(topLeft||_screenToContent(rect.left,rect.top,_bgRemovedImg.width,_bgRemovedImg.height));
      const br=clamp(botRight||_screenToContent(rect.right,rect.bottom,_bgRemovedImg.width,_bgRemovedImg.height));
      // If either corner still couldn't be resolved (drag started well
      // outside the image), fall back to (0,0)..(w,h) — treats the drag
      // as "crop to full image", a safe no-op that never throws.
      _cropRect={
        x:tl?Math.round(tl.x):0,
        y:tl?Math.round(tl.y):0,
        width:Math.round((br?br.x:_bgRemovedImg.width)-(tl?tl.x:0)),
        height:Math.round((br?br.y:_bgRemovedImg.height)-(tl?tl.y:0))
      };
    }else{
      _cropRect={
        x:Math.round(topLeft.x),
        y:Math.round(topLeft.y),
        width:Math.round(botRight.x-topLeft.x),
        height:Math.round(botRight.y-topLeft.y)
      };
    }
    _refreshBgControls();
  }
  // For _finishCropDrag: the last mousemove's client coord isn't tracked
  // explicitly, so this reads the crop box's own current right edge
  // (already updated by the most-recent _updateCropDrag).
  function _lastMouseClientX(){
    if(!_cropBoxEl) return 0;
    const r=_cropBoxEl.getBoundingClientRect();
    return r.right;
  }
  function _ensureCropBox(){
    if(_cropBoxEl) return _cropBoxEl;
    _cropBoxEl=document.createElement('div');
    _cropBoxEl.className='picture-studio-crop-box hidden';
    _stage.appendChild(_cropBoxEl);
    return _cropBoxEl;
  }
  function _tearDownCropBox(){
    if(_cropBoxEl){
      _cropBoxEl.classList.add('hidden');
      _cropBoxEl.style.width='0px';
      _cropBoxEl.style.height='0px';
    }
  }
  function _applyCrop(){
    if(!_cropRect||!_workingBuffer) return;
    // Clamp again defensively.
    const bounds={
      x:Math.max(0,Math.min(_workingBuffer.width-1,_cropRect.x)),
      y:Math.max(0,Math.min(_workingBuffer.height-1,_cropRect.y)),
      width:Math.max(1,Math.min(_workingBuffer.width-_cropRect.x,_cropRect.width)),
      height:Math.max(1,Math.min(_workingBuffer.height-_cropRect.y,_cropRect.height))
    };
    _preCropSnapshot={
      data:new Uint8ClampedArray(_workingBuffer.data),
      width:_workingBuffer.width,
      height:_workingBuffer.height
    };
    _workingBuffer=_cropPixelBuffer(_workingBuffer,bounds);
    // Any cleanup history from the old (larger) buffer no longer maps
    // onto the new pixel indices — clear so undo can never corrupt.
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _cropRect=null;
    _tearDownCropBox();
    // Recenter after crop — the fit-scale will change with the new,
    // typically-smaller dimensions.
    _state.panX=0; _state.panY=0;
    _state.beforeAfterPct=100; // compare no longer meaningful vs. original
    if(_baSlider) _baSlider.value='100';
    _syncBgCanvas();
    _refreshBgControls();
    _render();
  }
  // Dual of _applyCrop — keeps buffer dimensions unchanged and instead
  // clears every pixel INSIDE the selected box to fully transparent,
  // leaving everything outside untouched. Same _preCropSnapshot backing,
  // so "Undo Trim" reverts either op. Since buffer size doesn't change,
  // pan/beforeAfter/BA-slider all stay valid without a reset — the fit
  // math never sees a new dimension. Stroke history IS cleared so a
  // later undo can never restore a stroke that painted where content is
  // now deliberately gone (matches Keep This's own clear-history rule).
  function _trashCropArea(){
    if(!_cropRect||!_workingBuffer) return;
    const bounds={
      x:Math.max(0,Math.min(_workingBuffer.width-1,_cropRect.x)),
      y:Math.max(0,Math.min(_workingBuffer.height-1,_cropRect.y)),
      width:Math.max(1,Math.min(_workingBuffer.width-_cropRect.x,_cropRect.width)),
      height:Math.max(1,Math.min(_workingBuffer.height-_cropRect.y,_cropRect.height))
    };
    _preCropSnapshot={
      data:new Uint8ClampedArray(_workingBuffer.data),
      width:_workingBuffer.width,
      height:_workingBuffer.height
    };
    _workingBuffer=_trashPixelsInBox(_workingBuffer,bounds);
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _cropRect=null;
    _tearDownCropBox();
    // Deliberately do NOT recenter or reset the BA slider — dimensions
    // are unchanged, so any prior compare/pan state is still meaningful.
    _syncBgCanvas();
    _refreshBgControls();
    _render();
  }
  function _resetCrop(){
    if(!_preCropSnapshot) return;
    _workingBuffer={
      data:new Uint8ClampedArray(_preCropSnapshot.data),
      width:_preCropSnapshot.width,
      height:_preCropSnapshot.height
    };
    _preCropSnapshot=null;
    _cropRect=null;
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _state.panX=0; _state.panY=0;
    _tearDownCropBox();
    _syncBgCanvas();
    _refreshBgControls();
    _render();
  }
  // Auto Crop — reuses cleanupBrush's own findContentBounds equivalent
  // (inline pixel scan) to pick the tightest rect containing every
  // non-transparent pixel. If the whole image is transparent, no-op.
  function _autoCrop(){
    if(!_workingBuffer) return;
    const data=_workingBuffer.data, w=_workingBuffer.width, h=_workingBuffer.height;
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++){
      const rowBase=y*w;
      for(let x=0;x<w;x++){
        const a=data[(rowBase+x)*4+3];
        if(a>8){
          if(x<minX) minX=x;
          if(x>maxX) maxX=x;
          if(y<minY) minY=y;
          if(y>maxY) maxY=y;
        }
      }
    }
    if(maxX<minX||maxY<minY) return;
    _cropRect={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
    _applyCrop();
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
      // Product decision — the Result view (Looks Great / Make It
      // Better) shows the ORIGINAL picture; background removal never
      // auto-runs on open. It is on-demand only, via the ✨ Remove
      // Paper tile in the Edit view (which shows the same magic
      // overlay while it runs).
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
    // Ship C — reset the BG strength override so the next picture opens
    // with the worker's own auto-detected default rather than inheriting
    // the previous session's tolerance. Slider defaults back to 50 in
    // _refreshBgControls' sync pass on next open.
    _bgStrengthOverride=null;
    if(_bgStrengthSlider) _bgStrengthSlider.value='50';
    // Ship B Refinements — hide the magic overlay if it was still up
    // (e.g. cancel/close while bg removal was mid-flight).
    if(_magicOverlay) _magicOverlay.classList.add('hidden');
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
