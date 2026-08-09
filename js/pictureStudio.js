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
  // _bgRemovedImg is the CANVAS currently being displayed and edited — it
  // is set either by a real background removal OR (since the removal
  // became opt-in) lazily by _ensureWorkingBuffer when a pixel tool such
  // as Trim needs something to operate on. _bgRemovalDone is the separate,
  // narrower question "did the worker actually run?", which is what the
  // Remove Paper tile, the Before/After compare and the erase brush key
  // off — none of those mean anything without a genuine removal.
  let _bgRemovalDone=false;
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
  // Optional multi-picture handler. A caller that can place several
  // pictures at once (Add Something → Photo, today) opts in by passing
  // options.onApplyMany; every existing caller passes only onApply and
  // is completely unaffected, which is why extraction could be added
  // without touching any of the eleven open() call sites.
  let _onApplyMany=null;
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

  // ---------- Doodle layer (ported from Studio's Draw Your Own) -----
  // The product owner's own framing: "we already have a draw your own
  // functionality in studio why cant we add that into image studio ?"
  // — so this is a REUSE of js/cardDesigner.js's already-shipped doodle
  // and shape stack (exported there as CardDesigner.drawDoodleStroke /
  // .buildShapeSilhouettePath / .DOODLE_MEDIA / .shapeLetterChar /
  // .padLetterFont), never a second implementation. Nothing about the
  // stroke-rendering algorithms, the four media, or the shape geometry
  // is re-authored here; only the coordinate space differs.
  //
  // The layer is stored as VECTOR data on `_state.doodle`, in
  // coordinates FRACTIONAL to the source image (0..1 on each axis), so
  // it is resolution-independent and survives zoom/pan freely. Two entry
  // shapes:
  //   {type:'stroke', points:[{x,y}…], color, width, medium}
  //   {type:'shape',  shape, x, y, w, h, fill, fillOn, stroke, strokeOn, strokeW}
  // A stroke's `width` (and a shape's `strokeW`) is an ABSOLUTE pixel
  // value against the SOURCE image's own dimensions — the exact same
  // convention Studio's own doodle stickers use against their object box
  // — so the one shared painter just multiplies by whatever scale it is
  // drawing at.
  //
  // Composition point: _paintDoodleLayer is called immediately after the
  // `drawImage(source, …)` call in BOTH _paintOne (preview) and _bake
  // (output), INSIDE the same already-applied translate/rotate/flip
  // transform — so the drawing inherits pan, zoom, rotation, flip and
  // fit-scaling automatically in both places, with no second transform
  // to keep in sync and no way for preview and output to disagree.
  const DOODLE_SIZE_FRACTIONS={small:0.008, medium:0.018, large:0.038};
  let _doodleLive=null;            // in-flight freehand stroke
  let _doodleShapeDrag=null;       // in-flight shape placement drag
  let _doodleMode='freehand';      // 'freehand' | 'shape'
  let _doodleMedium='crayon';
  let _doodleColor='#E63946';
  let _doodleSize='medium';
  let _doodleShape='circle';
  let _doodleShapeFill='#F4A300';
  let _doodleShapeFillOn=true;
  let _doodleShapeStroke='#1D3457';
  let _doodleShapeStrokeOn=false;
  let _doodleShapeStrokeSize='medium';
  let _doodleColourKit=null;
  let _doodleColourKitHost=null;
  let _doodleShapeFillKit=null;
  let _doodleShapeStrokeKit=null;
  let _doodleUndoBtn=null;
  let _doodleClearBtn=null;
  let _doodleShapeGrid=null;
  let _doodleMediumBtns=null;
  let _doodleSizeBtns=null;

  // ---------- Cut Out Objects / Outline / Colour Fill -----------------
  // The product owner's own framing: "i like the sheet extractor
  // implementation. i would like to add it into image studio" — so these
  // three tools REUSE tools/sheet-extractor's already-shipped, already-
  // verified engines (window.extractSheet, window.TileEditor) rather than
  // re-authoring any of the detection, tracing, ink-fill or per-op pixel
  // maths here. Both modules are loaded by index.html and were confirmed
  // free of module-level DOM side effects; TileEditor's own modal and its
  // .se-te-* CSS are deliberately NOT used — only its seven pure ops,
  // and only the two Image Studio genuinely lacks.
  //
  // Five of the seven Sheet Extractor tile tools already exist natively
  // here and are deliberately not rebuilt (crop → ✂️ Trim Picture, eraser
  // → ✨ Remove Paper's alpha brush, rotate + flip → 🔄 Turn / Flip, shape
  // draw → 🎨 Draw's shape mode). Genuinely missing, and added here:
  // colour OUTLINE and bucket colour FILL — plus EXTRACTION, absent
  // entirely, which is the headline of the request.
  let _extractTile=null;
  let _extractSubPanel=null;
  let _extractBusy=false;
  let _extractItems=null;          // [{objectUrl,pixelBuffer,…}] from extractSheet
  let _extractGrid=null;
  let _extractStatusEl=null;
  let _extractRunBtn=null;
  let _extractUseAllBtn=null;
  let _extractMode='sheet';        // 'sheet' | 'scan' — detection axis
  let _extractInk=false;           // render axis: copy pixels vs. redraw as ink
  let _extractInkColor='#000000';
  // Detection sensitivity is TWO different knobs on two different scales,
  // because the two detectors measure genuinely different things: sheet
  // mode is a Euclidean colour distance from ONE sampled background,
  // scan mode is a per-pixel delta against the paper's own local mean.
  // Keeping them separate is what lets a creator flip modes back and
  // forth without having their tuning silently reinterpreted.
  let _extractThreshold=24;        // sheet mode
  let _extractInkDelta=18;         // scan mode
  let _extractThresholdRow=null;
  let _extractInkDeltaRow=null;
  let _extractInkColorRow=null;
  let _extractModeBtns=null;
  let _extractInkToggle=null;
  // Search areas, in working-buffer pixels. Deliberately their OWN
  // storage rather than reusing _cropRect: _refreshBgControls arms the
  // destructive Keep This / Trash It pair off _cropRect, and marking out
  // where to LOOK for objects must never arm a control that TRIMS the
  // picture. A creator can mark SEVERAL areas — each becomes its own
  // extractSheet pass cropped to that area's bounding box, and the
  // results merge into one grid (_runExtractPasses). Shapes: rectangle,
  // circle, freehand. A non-rectangular shape still crops to its own
  // BOUNDING BOX for detection — pre-masking the source to the shape was
  // rejected, because sampleBackground reads the four bbox corners and
  // for any non-rect shape all four lie outside it, handing every pass a
  // fabricated white background. Instead objects whose CENTRE falls
  // outside the shape are dropped after detection (_pointInArea). The
  // marked shape says "look here", never "cut along this line".
  let _extractAreas=[];            // [{kind:'rect'|'circle'|'free', bbox:{x,y,width,height}, points?}]
  let _areaDrag=null;              // in-flight marking gesture {kind,sx,sy,points?}
  let _areaShape='rect';           // which marker the next drag draws
  let _extractAreaSvg=null;        // the on-stage overlay the areas render into
  let _areaShapeBtns=null;
  let _extractAreaBtn=null;
  let _extractAreaHintEl=null;
  // Nothing is picked by default — the product owner's own report was
  // "all tiles are selected by default", and an all-ticked grid makes
  // 🧩 Make One Picture grab every stray before the creator has chosen
  // anything. Ticking is now the deliberate act. ✓ Use All is unaffected:
  // _applyAllExtracted iterates _extractItems directly and never reads
  // this set, so "all" still genuinely means all.
  let _extractPicked=null;         // Set of indices into _extractItems
  let _extractComposeBtn=null;

  let _outlineTile=null;
  let _outlineSubPanel=null;
  let _outlineWidth=6;
  let _outlineColor='#1D3457';
  let _outlineApplyBtn=null;
  let _outlineUndoBtn=null;
  let _outlineSnapshot=null;       // {data,width,height,doodle} for Undo

  let _fillTile=null;
  let _fillSubPanel=null;
  let _fillColor='#F4A300';
  let _fillTolerance=32;
  let _fillUndoBtn=null;
  let _fillSnapshot=null;          // {data,width,height} for Undo

  function _cd(){ try{ return window.CardDesigner||null; }catch(e){ return null; } }

  // The two Sheet Extractor engines, read defensively at the point of
  // use — exactly the `typeof X!=='undefined'` shape every other
  // cross-module read in Studio uses, so a deployment that somehow ships
  // without them degrades to the tool simply staying disabled rather
  // than throwing on open().
  function _tileEditor(){ try{ return window.TileEditor||null; }catch(e){ return null; } }
  function _extractFn(){
    try{ return (typeof window.extractSheet==='function')?window.extractSheet:null; }
    catch(e){ return null; }
  }

  // #RRGGBB → [r,g,b]. Both engines take plain RGB triples.
  function _hexToRgb(hex){
    const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));
    if(!m) return [0,0,0];
    const n=parseInt(m[1],16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  }

  // The one shared tail for any operation that swaps _workingBuffer for a
  // new one. _syncBgCanvas already resizes _bgRemovedImg when the buffer's
  // dimensions change (added for crop), so an op that grows the buffer —
  // TileEditor.outline grows it by `width` on every side — needs no extra
  // plumbing at all.
  //
  // Clearing the cleanup history whenever dimensions change is not
  // optional: those entries are pixel INDICES into the old buffer, so
  // replaying one against a differently-sized buffer would corrupt it.
  // Recentring follows _applyCrop / _trashCropArea's own established
  // rule — only when the dimensions actually moved.
  function _swapWorkingBuffer(next){
    if(!next||!_workingBuffer) return;
    const resized=(next.width!==_workingBuffer.width||next.height!==_workingBuffer.height);
    _workingBuffer=next;
    if(resized){
      _cleanupHistory=[];
      _cleanupRedoStack=[];
      _state.panX=0; _state.panY=0;
      _state.beforeAfterPct=100;
      if(_baSlider) _baSlider.value='100';
    }
    _syncBgCanvas();
    _refreshBgControls();
    _render();
  }

  function _snapshotBuffer(withDoodle){
    if(!_workingBuffer) return null;
    const snap={
      data:new Uint8ClampedArray(_workingBuffer.data),
      width:_workingBuffer.width,
      height:_workingBuffer.height
    };
    if(withDoodle) snap.doodle=_cloneDoodleLayer(_state.doodle);
    return snap;
  }

  function _restoreSnapshot(snap){
    if(!snap) return;
    _workingBuffer={
      data:new Uint8ClampedArray(snap.data),
      width:snap.width,
      height:snap.height
    };
    if(snap.doodle) _state.doodle=_cloneDoodleLayer(snap.doodle);
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _state.panX=0; _state.panY=0;
    _syncBgCanvas();
    _refreshBgControls();
    _render();
  }

  // A stroke/outline width in SOURCE-IMAGE pixels for the chosen size
  // key, derived from the picture's own smaller dimension so "Medium"
  // reads the same relative weight on a small snapshot and a big photo
  // alike rather than being a fixed pixel count that vanishes on one and
  // overwhelms the other.
  function _doodleWidthPx(sizeKey){
    const img=_activeImg();
    const minDim=img?Math.min(img.width,img.height):320;
    const frac=DOODLE_SIZE_FRACTIONS[sizeKey]||DOODLE_SIZE_FRACTIONS.medium;
    return Math.max(2,Math.round(minDim*frac));
  }

  // Paint the whole doodle layer into `g`, mapping fractional coords
  // onto the rect (dx,dy,dw,dh) the source image was just drawn at.
  // `srcW` is the source image's own natural width, used only to scale
  // stored absolute stroke widths into this caller's pixel space.
  function _paintDoodleLayer(g,dx,dy,dw,dh,srcW){
    const items=_state.doodle;
    const live=_doodleLive;
    const shapeDrag=_doodleShapeDrag;
    if((!items||!items.length) && !live && !shapeDrag) return;
    const scale=dw/Math.max(1,srcW);
    g.save();
    // Enhance's own colour filter belongs to the photograph, not to the
    // child's drawing on top of it — a picked red must stay that red.
    try{ g.filter='none'; }catch(e){}
    // Clip to the picture itself so a stroke (or a shape placed near an
    // edge, or anything left partly outside by a later crop) can never
    // paint onto the surrounding stage.
    g.beginPath();
    g.rect(dx,dy,dw,dh);
    g.clip();
    const mapPt=function(p){ return {x:dx+p.x*dw, y:dy+p.y*dh}; };
    const paintStroke=function(it){
      const CD=_cd();
      if(!CD||typeof CD.drawDoodleStroke!=='function') return;
      if(!it.points||it.points.length<2) return;
      g.save();
      g.globalAlpha=1;
      g.lineCap='round';
      g.lineJoin='round';
      CD.drawDoodleStroke(g,it.points,mapPt,it.color,Math.max(1,(it.width||6)*scale),it.medium,1);
      g.restore();
    };
    (items||[]).forEach(function(it){
      if(it && it.type==='shape') _paintDoodleShape(g,it,dx,dy,dw,dh,scale);
      else if(it) paintStroke(it);
    });
    if(live) paintStroke(live);
    if(shapeDrag && shapeDrag.preview) _paintDoodleShape(g,shapeDrag.preview,dx,dy,dw,dh,scale);
    g.restore();
  }

  function _paintDoodleShape(g,it,dx,dy,dw,dh,scale){
    const CD=_cd();
    if(!CD||typeof CD.buildShapeSilhouettePath!=='function') return;
    const x=dx+it.x*dw, y=dy+it.y*dh;
    const w=Math.max(1,it.w*dw), h=Math.max(1,it.h*dh);
    const strokeW=it.strokeOn?Math.max(1,(it.strokeW||4)*scale):0;
    const built=CD.buildShapeSilhouettePath(it.shape,1000,it.customStrokes);
    g.save();
    g.globalAlpha=1;
    if(built && built.kind==='letter'){
      // Letters/numbers have no plottable path — draw the glyph itself,
      // sized to fit via the very same helper the Studio pads use so a
      // letter's own proportions never get anisotropically stretched.
      g.textAlign='center';
      g.textBaseline='middle';
      if(typeof CD.padLetterFont==='function') CD.padLetterFont(g,built.ch,w,h);
      else g.font='bold '+(h*0.82)+'px sans-serif';
      if(it.fillOn!==false){ g.fillStyle=it.fill||'#E63946'; g.fillText(built.ch,x+w/2,y+h/2); }
      if(strokeW>0){ g.lineWidth=strokeW; g.strokeStyle=it.stroke||'#1D3457'; g.strokeText(built.ch,x+w/2,y+h/2); }
    }else if(built && built.path){
      // Transform the unit-1000 silhouette into place via DOMMatrix so
      // the OUTLINE keeps a uniform width — scaling the context instead
      // would stretch the stroke anisotropically for a non-square shape.
      let placed=null;
      try{
        placed=new Path2D();
        placed.addPath(built.path,new DOMMatrix().translate(x,y).scale(w/1000,h/1000));
      }catch(e){ placed=null; }
      if(placed){
        if(it.fillOn!==false){ g.fillStyle=it.fill||'#E63946'; g.fill(placed); }
        if(strokeW>0){ g.lineWidth=strokeW; g.strokeStyle=it.stroke||'#1D3457'; g.stroke(placed); }
      }else{
        // Fallback for any engine without DOMMatrix-aware addPath: scale
        // the context instead. Fill stays exact; the outline's width is
        // approximated, disclosed rather than silently wrong.
        g.translate(x,y);
        g.scale(w/1000,h/1000);
        if(it.fillOn!==false){ g.fillStyle=it.fill||'#E63946'; g.fill(built.path); }
        if(strokeW>0){ g.lineWidth=strokeW*(1000/Math.max(w,h)); g.strokeStyle=it.stroke||'#1D3457'; g.stroke(built.path); }
      }
    }
    g.restore();
  }

  function _cloneDoodleLayer(items){
    return (items||[]).map(function(it){
      const copy=Object.assign({},it);
      if(Array.isArray(it.points)) copy.points=it.points.map(function(p){ return {x:p.x,y:p.y}; });
      return copy;
    });
  }

  // Keep This (crop) shrinks the picture, so every fraction stored
  // against the OLD frame has to be re-expressed against the new one.
  // Anything that falls outside simply lands outside — _paintDoodleLayer
  // clips to the picture rect, so a stroke half-inside the kept area
  // still shows its kept half and nothing more.
  function _remapDoodleForCrop(bounds,oldW,oldH){
    const items=_state.doodle;
    if(!items||!items.length) return;
    const bx=bounds.x/oldW, by=bounds.y/oldH;
    const bw=bounds.width/oldW, bh=bounds.height/oldH;
    if(!(bw>0)||!(bh>0)) return;
    const remapX=function(x){ return (x-bx)/bw; };
    const remapY=function(y){ return (y-by)/bh; };
    items.forEach(function(it){
      if(it.type==='shape'){
        const x2=remapX(it.x), y2=remapY(it.y);
        it.w=it.w/bw; it.h=it.h/bh;
        it.x=x2; it.y=y2;
      }else if(Array.isArray(it.points)){
        it.points=it.points.map(function(p){ return {x:remapX(p.x), y:remapY(p.y)}; });
      }
    });
  }

  // Inverse of _paintOne's full transform — screen point to a 0..1
  // fraction of the source image. Unlike _screenToContent (which only
  // ever runs after background removal has reset rotation/flip to 0 and
  // so deliberately ignores both), drawing is available at ANY time, so
  // this one genuinely undoes translate → rotate → flip in order.
  function _screenToImageFraction(clientX,clientY){
    const img=_activeImg();
    if(!img||!_canvas) return null;
    const rect=_canvas.getBoundingClientRect();
    if(!rect.width||!rect.height) return null;
    const sx=(clientX-rect.left)*(_canvas.width/rect.width);
    const sy=(clientY-rect.top)*(_canvas.height/rect.height);
    const eff=_effSize();
    const s=_stageRect();
    const fit=Math.min(s.w/eff.w,s.h/eff.h);
    const z=fit*_state.zoom;
    let ux=sx-(_canvas.width/2+_state.panX);
    let uy=sy-(_canvas.height/2+_state.panY);
    const a=-_state.rotation*Math.PI/180;
    const rx=ux*Math.cos(a)-uy*Math.sin(a);
    const ry=ux*Math.sin(a)+uy*Math.cos(a);
    const fx2=_state.flipH?-rx:rx;
    const iw=img.width*z, ih=img.height*z;
    return {x:(fx2+iw/2)/iw, y:(ry+ih/2)/ih};
  }
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
    // Gate on _bgRemovalDone, not _bgRemovedImg: since Trim can now
    // materialize a working buffer of its own, _bgRemovedImg may already
    // exist without the worker ever having run — and the child would
    // still be waiting on their paper to disappear.
    _tileButtons.removeMore=_buildTile(toolGrid,'✨','Remove Paper',function(){
      if(!_bgRemovalDone && !_bgBusy) _startBgRemoval();
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
    // Draw — the full Studio doodle stack (four media, colour kits,
    // thicknesses, shapes with fill + outline), reusing
    // js/cardDesigner.js's own already-shipped drawing/geometry
    // functions rather than a second implementation.
    _tileButtons.draw=_buildTile(toolGrid,'🎨','Draw',function(){ _toggleActiveTool('draw'); },{key:'draw'});
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
    // The three Sheet Extractor tools. Cut Out Objects is the headline —
    // it finds every separate drawing on one photographed sheet. Outline
    // and Colour Fill are the two of Sheet Extractor's seven per-tile
    // tools Image Studio genuinely lacked; the other five already exist
    // above (crop → Trim Picture, eraser → Remove Paper's alpha brush,
    // rotate + flip → Turn / Flip, shape draw → Draw).
    _extractTile=_buildTile(toolGrid,'✂️','Cut Out Objects',function(){ _toggleActiveTool('extract'); },{key:'extract'});
    _tileButtons.extract=_extractTile;
    _outlineTile=_buildTile(toolGrid,'🖊','Outline',function(){ _toggleActiveTool('outline'); },{key:'outline'});
    _tileButtons.outline=_outlineTile;
    _fillTile=_buildTile(toolGrid,'🪣','Colour Fill',function(){ _toggleActiveTool('fill'); },{key:'fill'});
    _tileButtons.fill=_fillTile;
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
    _subPanels.draw=_buildDrawSubPanel();
    _subPanels.flip=_buildFlipSubPanel();
    _subPanels.crop=_buildCropSubPanel();
    _subPanels.extract=_buildExtractSubPanel();
    _subPanels.outline=_buildOutlineSubPanel();
    _subPanels.fill=_buildFillSubPanel();
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

    // Ask B — the compose panel mounts as a flex sibling of the stage inside
    // body, so a child arranges the pieces BESIDE the picture rather than on
    // top of it, and the original edit is never lost while they work. Its
    // dependencies are handed over here rather than reached for from inside
    // the panel, so composePanel.js never touches this closure. PngEncoder is
    // a bare global (never window.PngEncoder — see the sheet extractor's own
    // call sites), so it needs the typeof guard: a missing script tag would
    // otherwise be a silent ReferenceError at call time.
    if(typeof ComposePanel!=='undefined'){
      ComposePanel.configure({
        mount:body,
        tileEditor:_tileEditor(),
        pngEncoder:(typeof PngEncoder!=='undefined'?PngEncoder:null),
        onUsePicture:_applyComposedPicture
      });
    }

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
      _bgRemovalDone=false;
      _bgRemovedDataURL=null;
      _workingBuffer=null;
      _cleanupHistory=[];
      _cleanupRedoStack=[];
      _brushMode=null;
      _cropRect=null;
      _preCropSnapshot=null;
      // The Sheet Extractor tools all describe the picture that just went
      // away: cutouts of it, and undo snapshots sized to it. Restoring one
      // of those against a fresh picture would be meaningless at best and
      // wrong-sized at worst, so they go with it.
      _clearExtractResults();
      _extractBusy=false;
      _outlineSnapshot=null;
      _fillSnapshot=null;
      if(_extractStatusEl) _extractStatusEl.textContent='';
      _refreshExtractControls();
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

  // -------- Cut Out Objects sub-panel -------------------------------
  // Runs tools/sheet-extractor's own extractSheet over the picture and
  // shows every separate object it found. Tapping one swaps it in as the
  // picture being edited; "Use All" hands every cutout back at once via
  // the optional onApplyMany contract (see open()).
  //
  // The two axes are exposed exactly as Sheet Extractor names them:
  // detection (Objects on a background / Drawing on paper) decides HOW
  // things are found, ink fill decides how each one is DRAWN. All four
  // combinations are valid, which is why they're two controls and not
  // one mode switch.
  function _buildExtractSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','extract');
    _extractSubPanel=p;
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Find every separate thing in your picture.';
    p.appendChild(hint);

    // Search areas. Marking a shape on the picture tells the finder where
    // to LOOK, so whatever sits outside it is never found in the first
    // place — a cleaner answer to stray objects than finding them and
    // unticking them afterwards. Several areas can be marked, each running
    // as its own extractSheet pass (_runExtractPasses); the shape picker
    // below decides what the next drag draws.
    _extractAreaHintEl=document.createElement('p');
    _extractAreaHintEl.className='picture-studio-subpanel-hint';
    p.appendChild(_extractAreaHintEl);

    // Marker shape: rectangle, circle, freehand.
    const shapeRow=document.createElement('div');
    shapeRow.className='picture-studio-subpanel-row';
    _areaShapeBtns={};
    [['rect','▭','Box'],['circle','◯','Circle'],['free','✎','Draw']].forEach(function(m){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-subpanel-btn picture-studio-area-shape-btn';
      const g=document.createElement('span');
      g.className='picture-studio-subpanel-btn-glyph';
      g.textContent=m[1];
      b.appendChild(g);
      const t=document.createElement('span');
      t.textContent=m[2];
      b.appendChild(t);
      b.addEventListener('click',function(){
        _areaShape=m[0];
        _refreshExtractControls();
      });
      _areaShapeBtns[m[0]]=b;
      shapeRow.appendChild(b);
    });
    p.appendChild(shapeRow);

    _extractAreaBtn=document.createElement('button');
    _extractAreaBtn.type='button';
    _extractAreaBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _extractAreaBtn.textContent='↺ Search whole picture';
    _extractAreaBtn.addEventListener('click',function(){
      _extractAreas=[];
      _areaDrag=null;
      _syncAreaSvg();
      _refreshExtractControls();
    });
    p.appendChild(_extractAreaBtn);

    // Detection axis.
    const modeRow=document.createElement('div');
    modeRow.className='picture-studio-subpanel-row';
    _extractModeBtns={};
    [['sheet','🎨','Cut-outs'],['scan','✏️','Drawing']].forEach(function(m){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-subpanel-btn';
      const g=document.createElement('span');
      g.className='picture-studio-subpanel-btn-glyph';
      g.textContent=m[1];
      b.appendChild(g);
      const t=document.createElement('span');
      t.textContent=m[2];
      b.appendChild(t);
      b.addEventListener('click',function(){
        _extractMode=m[0];
        // Ink fill follows the mode's own sensible default the moment the
        // mode changes — a drawing wants redrawing as clean ink, a sheet
        // of coloured cut-outs wants its real colours kept. Either can
        // still be flipped afterwards; this only sets the starting point.
        _extractInk=(m[0]==='scan');
        _refreshExtractControls();
      });
      _extractModeBtns[m[0]]=b;
      modeRow.appendChild(b);
    });
    p.appendChild(modeRow);

    // Render axis.
    const inkRow=document.createElement('div');
    inkRow.className='picture-studio-subpanel-row';
    _extractInkToggle=document.createElement('button');
    _extractInkToggle.type='button';
    _extractInkToggle.className='picture-studio-subpanel-btn';
    _extractInkToggle.addEventListener('click',function(){
      _extractInk=!_extractInk;
      _refreshExtractControls();
    });
    inkRow.appendChild(_extractInkToggle);
    p.appendChild(inkRow);

    // Sheet-mode sensitivity: how far a pixel's colour must sit from the
    // sampled background before it counts as part of an object.
    _extractThresholdRow=document.createElement('div');
    _extractThresholdRow.className='picture-studio-subpanel-row';
    const thLabel=document.createElement('span');
    thLabel.className='picture-studio-subpanel-label';
    thLabel.textContent='Sensitivity';
    _extractThresholdRow.appendChild(thLabel);
    const thSlider=document.createElement('input');
    thSlider.type='range';
    thSlider.min='6';
    thSlider.max='90';
    thSlider.value=String(_extractThreshold);
    thSlider.className='picture-studio-strength-slider';
    thSlider.setAttribute('aria-label','How different from the background');
    thSlider.addEventListener('input',function(){
      _extractThreshold=parseInt(thSlider.value,10)||24;
    });
    _extractThresholdRow.appendChild(thSlider);
    p.appendChild(_extractThresholdRow);

    // Scan-mode sensitivity: how much darker than the paper right there
    // a pixel must be. A different scale measuring a different thing, so
    // deliberately its own control (see the state block's own note).
    _extractInkDeltaRow=document.createElement('div');
    _extractInkDeltaRow.className='picture-studio-subpanel-row';
    const idLabel=document.createElement('span');
    idLabel.className='picture-studio-subpanel-label';
    idLabel.textContent='Sensitivity';
    _extractInkDeltaRow.appendChild(idLabel);
    const idSlider=document.createElement('input');
    idSlider.type='range';
    idSlider.min='4';
    idSlider.max='60';
    idSlider.value=String(_extractInkDelta);
    idSlider.className='picture-studio-strength-slider';
    idSlider.setAttribute('aria-label','How dark a line must be');
    idSlider.addEventListener('input',function(){
      _extractInkDelta=parseInt(idSlider.value,10)||18;
    });
    _extractInkDeltaRow.appendChild(idSlider);
    p.appendChild(_extractInkDeltaRow);

    // Ink colour — only meaningful when ink fill is on.
    _extractInkColorRow=document.createElement('div');
    _extractInkColorRow.className='picture-studio-subpanel-row';
    const icLabel=document.createElement('span');
    icLabel.className='picture-studio-subpanel-label';
    icLabel.textContent='Ink colour';
    _extractInkColorRow.appendChild(icLabel);
    const icInput=document.createElement('input');
    icInput.type='color';
    icInput.value=_extractInkColor;
    icInput.className='picture-studio-color-input';
    icInput.setAttribute('aria-label','Ink colour');
    icInput.addEventListener('input',function(){ _extractInkColor=icInput.value; });
    _extractInkColorRow.appendChild(icInput);
    p.appendChild(_extractInkColorRow);

    _extractRunBtn=document.createElement('button');
    _extractRunBtn.type='button';
    _extractRunBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-primary';
    _extractRunBtn.textContent='✂️ Find Objects';
    _extractRunBtn.addEventListener('click',_runExtract);
    p.appendChild(_extractRunBtn);

    _extractStatusEl=document.createElement('p');
    _extractStatusEl.className='picture-studio-subpanel-status';
    p.appendChild(_extractStatusEl);

    _extractGrid=document.createElement('div');
    _extractGrid.className='picture-studio-extract-grid';
    p.appendChild(_extractGrid);

    _extractUseAllBtn=document.createElement('button');
    _extractUseAllBtn.type='button';
    _extractUseAllBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _extractUseAllBtn.textContent='✓ Use All';
    _extractUseAllBtn.addEventListener('click',_applyAllExtracted);
    p.appendChild(_extractUseAllBtn);

    // Compose: lay the ticked cutouts out side by side as ONE new picture,
    // which then simply becomes the picture being edited — so every other
    // tool works on it and the ordinary Apply path hands it back. Distinct
    // from Use All, which returns each cutout as its own separate picture.
    _extractComposeBtn=document.createElement('button');
    _extractComposeBtn.type='button';
    _extractComposeBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-primary';
    _extractComposeBtn.textContent='🧩 Make One Picture';
    _extractComposeBtn.addEventListener('click',_composeExtracted);
    p.appendChild(_extractComposeBtn);

    _refreshExtractControls();
    return p;
  }

  // -------- Outline sub-panel ---------------------------------------
  // TileEditor.outline traces the picture's own edge and stamps a band of
  // colour around it, GROWING the buffer by `width` on every side so the
  // new outline has somewhere to live. _swapWorkingBuffer handles the
  // resize (via _syncBgCanvas) with no extra plumbing.
  function _buildOutlineSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','outline');
    _outlineSubPanel=p;
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Draw a coloured edge all the way around your picture.';
    p.appendChild(hint);

    const wRow=document.createElement('div');
    wRow.className='picture-studio-subpanel-row';
    const wLabel=document.createElement('span');
    wLabel.className='picture-studio-subpanel-label';
    wLabel.textContent='How thick';
    wRow.appendChild(wLabel);
    const wSlider=document.createElement('input');
    wSlider.type='range';
    wSlider.min='1';
    wSlider.max='24';
    wSlider.value=String(_outlineWidth);
    wSlider.className='picture-studio-strength-slider';
    wSlider.setAttribute('aria-label','Outline thickness');
    wSlider.addEventListener('input',function(){
      _outlineWidth=parseInt(wSlider.value,10)||6;
    });
    wRow.appendChild(wSlider);
    p.appendChild(wRow);

    const cRow=document.createElement('div');
    cRow.className='picture-studio-subpanel-row';
    const cLabel=document.createElement('span');
    cLabel.className='picture-studio-subpanel-label';
    cLabel.textContent='Colour';
    cRow.appendChild(cLabel);
    const cInput=document.createElement('input');
    cInput.type='color';
    cInput.value=_outlineColor;
    cInput.className='picture-studio-color-input';
    cInput.setAttribute('aria-label','Outline colour');
    cInput.addEventListener('input',function(){ _outlineColor=cInput.value; });
    cRow.appendChild(cInput);
    p.appendChild(cRow);

    _outlineApplyBtn=document.createElement('button');
    _outlineApplyBtn.type='button';
    _outlineApplyBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-primary';
    _outlineApplyBtn.textContent='🖊 Add Outline';
    _outlineApplyBtn.addEventListener('click',_applyOutline);
    p.appendChild(_outlineApplyBtn);

    _outlineUndoBtn=document.createElement('button');
    _outlineUndoBtn.type='button';
    _outlineUndoBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _outlineUndoBtn.textContent='↩ Undo Outline';
    _outlineUndoBtn.addEventListener('click',function(){
      if(!_outlineSnapshot) return;
      _restoreSnapshot(_outlineSnapshot);
      _outlineSnapshot=null;
      _refreshBgControls();
    });
    p.appendChild(_outlineUndoBtn);
    return p;
  }

  // -------- Colour Fill sub-panel -----------------------------------
  // The tap itself lands on the canvas (see _wireStageInteractions), so
  // this panel only carries the colour, the tolerance and the undo.
  function _buildFillSubPanel(){
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','fill');
    _fillSubPanel=p;
    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Pick a colour, then tap a part of your picture to fill it.';
    p.appendChild(hint);

    const cRow=document.createElement('div');
    cRow.className='picture-studio-subpanel-row';
    const cLabel=document.createElement('span');
    cLabel.className='picture-studio-subpanel-label';
    cLabel.textContent='Colour';
    cRow.appendChild(cLabel);
    const cInput=document.createElement('input');
    cInput.type='color';
    cInput.value=_fillColor;
    cInput.className='picture-studio-color-input';
    cInput.setAttribute('aria-label','Fill colour');
    cInput.addEventListener('input',function(){ _fillColor=cInput.value; });
    cRow.appendChild(cInput);
    p.appendChild(cRow);

    const tRow=document.createElement('div');
    tRow.className='picture-studio-subpanel-row';
    const tLabel=document.createElement('span');
    tLabel.className='picture-studio-subpanel-label';
    tLabel.textContent='How far it spreads';
    tRow.appendChild(tLabel);
    const tSlider=document.createElement('input');
    tSlider.type='range';
    tSlider.min='0';
    tSlider.max='120';
    tSlider.value=String(_fillTolerance);
    tSlider.className='picture-studio-strength-slider';
    tSlider.setAttribute('aria-label','Fill spread');
    tSlider.addEventListener('input',function(){
      _fillTolerance=parseInt(tSlider.value,10)||0;
    });
    tRow.appendChild(tSlider);
    p.appendChild(tRow);

    _fillUndoBtn=document.createElement('button');
    _fillUndoBtn.type='button';
    _fillUndoBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-sm';
    _fillUndoBtn.textContent='↩ Undo Fill';
    _fillUndoBtn.addEventListener('click',function(){
      if(!_fillSnapshot) return;
      _restoreSnapshot(_fillSnapshot);
      _fillSnapshot=null;
      _refreshBgControls();
    });
    p.appendChild(_fillUndoBtn);
    return p;
  }

  // -------- Cut Out Objects behaviour -------------------------------
  function _refreshExtractControls(){
    if(_extractModeBtns){
      Object.keys(_extractModeBtns).forEach(function(k){
        _extractModeBtns[k].classList.toggle('active',_extractMode===k);
      });
    }
    if(_extractInkToggle){
      _extractInkToggle.textContent=_extractInk?'🖍 Redraw as ink':'🎨 Keep real colours';
      _extractInkToggle.classList.toggle('active',!!_extractInk);
    }
    // The two sensitivity sliders measure genuinely different things, so
    // only the one belonging to the active detector is ever shown.
    if(_extractThresholdRow) _extractThresholdRow.classList.toggle('hidden',_extractMode!=='sheet');
    if(_extractInkDeltaRow) _extractInkDeltaRow.classList.toggle('hidden',_extractMode!=='scan');
    if(_extractInkColorRow) _extractInkColorRow.classList.toggle('hidden',!_extractInk);
    if(_extractRunBtn){
      _extractRunBtn.disabled=(_extractBusy||!_origImg||!_extractFn());
      _extractRunBtn.textContent=_extractBusy?'✂️ Finding…':'✂️ Find Objects';
    }
    // Shape picker: highlight whichever marker the next drag will draw.
    if(_areaShapeBtns){
      Object.keys(_areaShapeBtns).forEach(function(k){
        _areaShapeBtns[k].classList.toggle('active',_areaShape===k);
      });
    }
    // Search areas: the hint always says which state we're in (none, one,
    // several), and the reset button only exists while there is something
    // to reset.
    if(_extractAreaHintEl){
      const na=_extractAreas.length;
      _extractAreaHintEl.textContent=na===0
        ?'Mark out part of the picture to search just there. Mark several!'
        :(na===1
          ?'Looking inside your marked area only.'
          :('Looking inside your '+na+' marked areas only.'));
    }
    if(_extractAreaBtn) _extractAreaBtn.classList.toggle('hidden',_extractAreas.length===0);
    const n=(_extractItems&&_extractItems.length)||0;
    const picked=_extractPickedCount();
    if(_extractUseAllBtn){
      _extractUseAllBtn.classList.toggle('hidden',n<2);
      _extractUseAllBtn.textContent='✓ Use All '+n;
    }
    if(_extractComposeBtn){
      // Composing one picture out of a single cutout would just be a
      // slower "tap it", so the button only appears once there are at
      // least two ticked things to actually put together.
      _extractComposeBtn.classList.toggle('hidden',picked<2);
      _extractComposeBtn.textContent='🧩 Make One Picture ('+picked+')';
    }
  }

  function _extractPickedCount(){
    return _extractPicked?_extractPicked.size:0;
  }

  function _clearExtractResults(){
    if(_extractItems){
      _extractItems.forEach(function(it){
        try{ if(it&&it.objectUrl) URL.revokeObjectURL(it.objectUrl); }catch(e){}
      });
    }
    _extractItems=null;
    _extractPicked=null;
    if(_extractGrid) _extractGrid.innerHTML='';
  }

  function _runExtract(){
    const fn=_extractFn();
    if(!fn||_extractBusy) return;
    if(!_ensureWorkingBuffer()) return;
    // extractSheet loads its input with `new Image()`, so it needs a URL
    // rather than a canvas or a buffer. The displayed canvas already IS
    // the current picture (bg removal, crops, doodle-free) so exporting
    // it is both correct and the smallest possible bridge — no change to
    // the shipped, verified extractor.
    let src=null;
    try{ src=_bgRemovedImg?_bgRemovedImg.toDataURL('image/png'):null; }catch(e){ src=null; }
    if(!src){
      if(_extractStatusEl) _extractStatusEl.textContent='Couldn’t read this picture.';
      return;
    }
    _clearExtractResults();
    _extractBusy=true;
    if(_extractStatusEl) _extractStatusEl.textContent='Looking for objects…';
    _refreshExtractControls();
    const opts={
      mode:_extractMode,
      inkFill:_extractInk,
      threshold:_extractThreshold,
      inkDelta:_extractInkDelta,
      inkColor:_hexToRgb(_extractInkColor)
    };
    // One pass per marked area (or one whole-picture pass when nothing is
    // marked). extractSheet itself is never modified — each area's own
    // bounding box goes through the extractor's existing `crop` option,
    // and a circle/freehand shape then drops anything whose centre falls
    // outside the shape. Pre-masking the source to the shape was rejected:
    // sampleBackground reads the four crop-corner pixels, and for any
    // non-rectangular shape all four corners lie outside it, so a masked
    // source would hand every pass a fabricated white background.
    _runExtractPasses(fn,src,opts,_extractAreas.slice()).then(function(items){
      _extractBusy=false;
      _extractItems=items.length?items:null;
      // Nothing is picked by default (Ask C) — the product owner's own
      // report was "all tiles are selected by default". ✓ Use All is
      // unaffected: _applyAllExtracted iterates _extractItems directly
      // and never reads this set.
      _extractPicked=_extractItems?new Set():null;
      _renderExtractGrid();
      if(_extractStatusEl){
        _extractStatusEl.textContent=items.length
          ?('Found '+items.length+(items.length===1?' thing. Tap it to use it.':' things. Tap one to use it.'))
          :'Nothing found — try moving the slider.';
      }
      _refreshExtractControls();
    }).catch(function(){
      _extractBusy=false;
      _clearExtractResults();
      if(_extractStatusEl) _extractStatusEl.textContent='Couldn’t find anything this time.';
      _refreshExtractControls();
    });
  }

  // Runs one extractSheet pass per marked area and merges the results.
  // Sequential rather than parallel — each pass decodes the same source
  // image, and running them one at a time keeps peak memory at a single
  // decode. Per-area failures are swallowed (one bad area must not lose
  // the others' finds); rejected and duplicate items get their object
  // URLs revoked so nothing leaks.
  function _runExtractPasses(fn,src,baseOpts,areas){
    if(!areas.length){
      return Promise.resolve(fn(src,baseOpts)).then(function(res){
        return (res&&res.items)||[];
      });
    }
    const merged=[];
    let chain=Promise.resolve();
    areas.forEach(function(area){
      chain=chain.then(function(){
        const opts=Object.assign({},baseOpts,{
          crop:{
            x:area.bbox.x,
            y:area.bbox.y,
            w:area.bbox.width,
            h:area.bbox.height
          }
        });
        return Promise.resolve(fn(src,opts)).then(function(res){
          const items=(res&&res.items)||[];
          // The extractor reports boxes relative to the crop it was given
          // and echoes the clamped crop back, so converting to source
          // coordinates is one addition per axis.
          const ox=(res&&res.crop&&res.crop.x)||0;
          const oy=(res&&res.crop&&res.crop.y)||0;
          items.forEach(function(it){
            // The extractor's items carry bboxOriginal {x,y,w,h} (the tight
            // box recomputed from the undilated mask) — there is no "box"
            // field, and the fields are w/h, never width/height.
            const box=it.bboxOriginal||{x:0,y:0,w:0,h:0};
            const sx=box.x+ox, sy=box.y+oy;
            const cx=sx+box.w/2, cy=sy+box.h/2;
            // A circle/freehand area keeps only objects whose CENTRE is
            // inside the shape — "look here", not "cut along this line".
            // For a rectangle this is a no-op (the crop already was the
            // rectangle), so shipped behaviour is unchanged there.
            if(!_pointInArea(cx,cy,area)){
              try{ if(it.objectUrl) URL.revokeObjectURL(it.objectUrl); }catch(e){}
              return;
            }
            // De-dup across overlapping areas: the same physical object
            // found twice has near-identical source-space centre and size.
            const dup=merged.some(function(m){
              return Math.abs(m._srcCx-cx)<4&&Math.abs(m._srcCy-cy)<4&&
                     Math.abs(m._srcW-box.w)<4&&Math.abs(m._srcH-box.h)<4;
            });
            if(dup){
              try{ if(it.objectUrl) URL.revokeObjectURL(it.objectUrl); }catch(e){}
              return;
            }
            it._srcCx=cx; it._srcCy=cy; it._srcW=box.w; it._srcH=box.h;
            merged.push(it);
          });
        }).catch(function(){ /* keep the other areas' finds */ });
      });
    });
    return chain.then(function(){ return merged; });
  }

  // Is a source-pixel point inside a marked area's own shape?
  function _pointInArea(px,py,area){
    const b=area.bbox;
    if(px<b.x||py<b.y||px>b.x+b.width||py>b.y+b.height) return false;
    if(area.kind==='circle'){
      // The stored bbox IS the ellipse's bounding box.
      const rx=b.width/2, ry=b.height/2;
      if(rx<1||ry<1) return true;
      const dx=(px-(b.x+rx))/rx, dy=(py-(b.y+ry))/ry;
      return dx*dx+dy*dy<=1;
    }
    if(area.kind==='free'&&area.points&&area.points.length>=3){
      // Ray casting over the traced polygon.
      let inside=false;
      const pts=area.points;
      for(let i=0,j=pts.length-1;i<pts.length;j=i++){
        const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
        if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=true;
      }
      return inside;
    }
    return true;
  }

  // Each result gets its own card: a numbered badge (so the reading order
  // the extractor already sorts by is actually visible), a real pixel-size
  // readout (a 6x6 speck is instantly recognisable as a stray) and a tick
  // for keeping it out of Use All / Make One Picture. The picture itself
  // stays its own button whose click means "just use this one", so the
  // long-standing tap-a-tile behaviour is untouched.
  function _renderExtractGrid(){
    if(!_extractGrid) return;
    _extractGrid.innerHTML='';
    if(!_extractItems) return;
    _extractItems.forEach(function(it,i){
      const pb=it.pixelBuffer||{};
      const card=document.createElement('div');
      card.className='picture-studio-extract-card';

      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-extract-tile';
      b.setAttribute('aria-label','Use object '+(i+1));
      const img=document.createElement('img');
      img.src=it.objectUrl;
      img.alt='';
      b.appendChild(img);
      b.addEventListener('click',function(){ _useExtracted(it); });

      const num=document.createElement('span');
      num.className='picture-studio-extract-num';
      num.textContent=String(i+1);
      b.appendChild(num);

      const tick=document.createElement('button');
      tick.type='button';
      tick.className='picture-studio-extract-pick';
      const syncTick=function(){
        const on=!!(_extractPicked&&_extractPicked.has(i));
        tick.classList.toggle('active',on);
        tick.textContent=on?'✓':'';
        tick.setAttribute('aria-pressed',on?'true':'false');
        tick.setAttribute('aria-label',(on?'Leave out object ':'Include object ')+(i+1));
      };
      tick.addEventListener('click',function(e){
        // The tick sits on top of the picture button, so without this the
        // same tap would also mean "use just this one" and close the grid.
        e.stopPropagation();
        if(!_extractPicked) _extractPicked=new Set();
        if(_extractPicked.has(i)) _extractPicked.delete(i);
        else _extractPicked.add(i);
        syncTick();
        _refreshExtractControls();
      });
      syncTick();
      b.appendChild(tick);
      card.appendChild(b);

      const size=document.createElement('span');
      size.className='picture-studio-extract-size';
      size.textContent=(pb.width||0)+'×'+(pb.height||0);
      card.appendChild(size);

      _extractGrid.appendChild(card);
    });
  }

  // Tapping a cutout makes it the picture being edited — every other
  // tool (Draw, Outline, Colour Fill, Trim) then applies to it, which is
  // the whole point of bringing extraction in here rather than leaving
  // it as a separate download-and-re-upload trip.
  function _useExtracted(item){
    if(!item||!item.pixelBuffer) return;
    const pb=item.pixelBuffer;
    _swapWorkingBuffer({
      data:new Uint8ClampedArray(pb.data),
      width:pb.width,
      height:pb.height
    });
    // A cutout is a fresh picture: the doodle layer and the outline/fill
    // undo snapshots all describe the OLD one and would be meaningless
    // (and, for the snapshots, wrong-sized) against this one.
    _state.doodle=[];
    _outlineSnapshot=null;
    _fillSnapshot=null;
    _clearExtractResults();
    if(_extractStatusEl) _extractStatusEl.textContent='';
    _refreshExtractControls();
    _toggleActiveTool(null);
  }

  // Hand the ticked cutouts to the compose panel, which lays them out as
  // ONE new picture the child can arrange. Only once they tap "Use This
  // Picture" does the arrangement become the picture being edited — so
  // Draw, Outline, Colour Fill and Trim all apply to it, and the ordinary
  // Apply path hands it back as a single image. Distinct from Use All,
  // which returns each cutout as its own separate picture.
  function _composeExtracted(){
    const items=_extractItems||[];
    if(!items.length||!_extractPicked) return;
    const picked=[];
    items.forEach(function(it,i){
      if(_extractPicked.has(i)&&it&&it.pixelBuffer&&it.pixelBuffer.width>0&&it.pixelBuffer.height>0){
        picked.push(it.pixelBuffer);
      }
    });
    if(picked.length<2) return;
    // Ask B: composing happens in a side panel BESIDE the picture, so the
    // original edit is never lost while the child arranges the pieces.
    // The destructive apply (the old shelf-pack-into-_swapWorkingBuffer
    // path) now runs only from the onUsePicture callback configured at
    // boot — the panel itself never touches the working buffer.
    if(typeof ComposePanel!=='undefined'&&ComposePanel.open(picked)){
      if(_extractStatusEl) _extractStatusEl.textContent='Arrange your pieces in the side panel, then tap “Use This Picture.”';
    }
  }

  // The destructive half of composing: ComposePanel bakes the arranged
  // sheet into one picture and hands it here (via configure() at boot).
  // Same reset discipline as any fresh picture — the doodle layer and the
  // outline/fill undo snapshots all describe the old one and would be
  // wrong-sized against this one.
  function _applyComposedPicture(pb){
    if(!pb||!pb.data||!(pb.width>0)||!(pb.height>0)) return;
    _swapWorkingBuffer({data:pb.data,width:pb.width,height:pb.height});
    _state.doodle=[];
    _outlineSnapshot=null;
    _fillSnapshot=null;
    _clearExtractResults();
    if(_extractStatusEl) _extractStatusEl.textContent='';
    _refreshExtractControls();
    _toggleActiveTool(null);
  }

  // "Use All" hands every cutout back at once. Only a caller that opted
  // in with options.onApplyMany can receive several pictures, so without
  // one this degrades to taking the first cutout as the picture being
  // edited — which is still a useful outcome, never a dead button.
  //
  // Each cutout is read from its OWN PngEncoder blob rather than being
  // re-drawn through a <canvas>: a canvas backing store is premultiplied
  // and round-tripping through one corrupts partial alpha, which is the
  // exact discipline the Sheet Extractor's own encoder exists to keep.
  function _applyAllExtracted(){
    const items=_extractItems||[];
    if(!items.length) return;
    if(typeof _onApplyMany!=='function'){
      _useExtracted(items[0]);
      return;
    }
    const mode=_state.mode;
    Promise.all(items.map(function(it){
      return new Promise(function(resolve){
        const pb=it.pixelBuffer||{};
        const done=function(dataURL){
          resolve(dataURL?{
            dataURL:dataURL,
            width:pb.width||0,
            height:pb.height||0,
            imageView:{ mode:mode, fit:mode }
          }:null);
        };
        if(!it.blob){ done(null); return; }
        const reader=new FileReader();
        reader.onload=function(){ done(reader.result); };
        reader.onerror=function(){ done(null); };
        try{ reader.readAsDataURL(it.blob); }catch(e){ done(null); }
      });
    })).then(function(results){
      const out=results.filter(Boolean);
      if(!out.length) return;
      // Capture the callback BEFORE tearing down: _hide() nulls
      // _onApplyMany (it does not null _onApply, which is why the
      // single-picture _apply() path never hit this), so reading it after
      // _hide() threw "not a function" straight into the catch below and
      // silently dropped every cutout on the floor.
      const done=_onApplyMany;
      _hide();
      try{ done(out); }catch(e){}
    });
  }

  // -------- Outline + Colour Fill behaviour -------------------------
  function _applyOutline(){
    const te=_tileEditor();
    if(!te||typeof te.outline!=='function') return;
    if(!_ensureWorkingBuffer()) return;
    _outlineSnapshot=_snapshotBuffer(true);
    const next=te.outline(_workingBuffer,_outlineWidth,_hexToRgb(_outlineColor));
    if(!next) return;
    _swapWorkingBuffer(next);
  }

  function _fillAt(clientX,clientY){
    const te=_tileEditor();
    if(!te||typeof te.bucketFill!=='function') return;
    if(!_ensureWorkingBuffer()) return;
    const pt=_screenToContent(clientX,clientY,_workingBuffer.width,_workingBuffer.height);
    if(!pt) return;
    _fillSnapshot=_snapshotBuffer(false);
    const next=te.bucketFill(
      _workingBuffer,
      Math.floor(pt.x),
      Math.floor(pt.y),
      _hexToRgb(_fillColor),
      _fillTolerance
    );
    if(!next) return;
    _swapWorkingBuffer(next);
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
    draw: 'Pick a colour, then draw right on your picture.',
    crop: 'Drag on your picture to choose what to keep.',
    flip: 'Turn or flip your picture.',
    extract: 'Find every separate thing in your picture.',
    outline: 'Draw a line all the way around your picture.',
    fill: 'Pick a colour, then tap a part of your picture.',
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
      ['draw','crop','flip','brighten','peek','extract','outline','fill','reset'].forEach(function(k){
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
    // Entering it: materialize the pixel buffer up front (rather than on
    // the first drag) so rotation/flip are baked before the child starts
    // dragging — the picture must not visibly change mid-gesture.
    //
    // (Cut Out Objects no longer borrows this box — its search areas draw
    // through their own SVG overlay, _syncAreaSvg, so the crop box is
    // exclusively Trim Picture's again.)
    if(tool!=='crop'){ _tearDownCropBox(); }
    else if(_ensureWorkingBuffer()){ _render(); }
    // The three Sheet Extractor tools all operate on the pixel buffer, so
    // each materializes it on entry for the same reason crop does: rotation
    // and flip get baked before the child acts, never mid-gesture. Leaving
    // Cut Out Objects also drops any results still on screen, so re-opening
    // it never shows cutouts of a picture that has since been edited.
    if(tool==='extract'||tool==='outline'||tool==='fill'){
      if(_ensureWorkingBuffer()) _render();
    }
    if(tool==='extract') _refreshExtractControls();
    else {
      _clearExtractResults();
      // The marked areas and the shapes on screen are one thing, so they
      // are dropped together — a hint reading "Looking inside your marked
      // area only." with no shape visible would simply be untrue.
      _extractAreas=[];
      _areaDrag=null;
      _syncAreaSvg();
      // Ask B — the compose panel holds pieces cut from results we have just
      // dropped, so it goes with them. This one hook covers the _setView
      // ('result') path too, since that calls _toggleActiveTool(null) itself,
      // and it is what closes the panel after a successful bake (the apply
      // callback ends on the same call). close() is idempotent, so a later
      // explicit close can never double-fire into anything.
      if(typeof ComposePanel!=='undefined') ComposePanel.close();
    }
    // Leaving draw mode: drop any in-flight gesture so a half-drawn
    // stroke can never be committed by a later, unrelated mouseup.
    if(tool!=='draw'){ _doodleLive=null; _doodleShapeDrag=null; }
    else _refreshDrawControls();
    _updateStageCursor();
  }
  function _updateStageCursor(){
    if(!_stage) return;
    if(_brushMode==='erase') _stage.style.cursor='crosshair';
    else if(_activeTool==='draw') _stage.style.cursor='crosshair';
    else if(_activeTool==='fill') _stage.style.cursor='crosshair';
    else if(_activeTool==='extract') _stage.style.cursor='crosshair';
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
    _bgRemovalDone=true;
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
  // Materialize a mutable pixel buffer for the picture as it is right
  // now, WITHOUT running the background worker. Trimming a photo has
  // nothing to do with removing its paper, so a pixel tool must not be
  // held hostage to a removal the child never asked for.
  //
  // Rotate/flip ARE baked in here, exactly as _startBgRemoval already
  // bakes them, because _screenToContent (which converts a drag box into
  // buffer pixels) has always assumed an un-rotated buffer. Baking is
  // what makes "what you see is what you trim" exact. The doodle layer is
  // deliberately NOT baked — it stays a separate vector layer drawn on
  // top, matching every other path through this module.
  function _ensureWorkingBuffer(){
    if(_workingBuffer) return true;
    if(!_origImg) return false;
    const buf=_bakeSourceForBg();
    if(!buf) return false;
    _workingBuffer={
      data:new Uint8ClampedArray(buf.data),
      width:buf.width,
      height:buf.height
    };
    const c=document.createElement('canvas');
    c.width=buf.width; c.height=buf.height;
    c.getContext('2d').putImageData(
      new ImageData(new Uint8ClampedArray(_workingBuffer.data),buf.width,buf.height),0,0
    );
    _bgRemovedImg=c;
    _bgRemovedDataURL=null;
    // The bake consumed rotation/flip; leaving them applied would
    // double-transform on the next render (same reset _onBgResult does).
    _state.rotation=0;
    _state.flipH=false;
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    return true;
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
    _bgRemovalDone=false;
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
      _bgRemoveBtn.classList.toggle('active',_bgRemovalDone);
    }
    if(_bgUndoBtn){
      _bgUndoBtn.disabled=_bgBusy||!_bgRemovalDone;
    }
    // Before/After slider is only meaningful once a background removal
    // has actually landed — otherwise there's nothing to compare against.
    // (_bgRemovedImg alone would un-hide it after a plain Trim, where
    // "before" and "after" are the same picture.)
    if(_baCompareWrap){
      _baCompareWrap.classList.toggle('hidden',!_bgRemovalDone);
      if(!_bgRemovalDone){
        _state.beforeAfterPct=100;
        if(_baSlider) _baSlider.value='100';
      }
    }
    // The erase brush edits alpha the removal produced, so it likewise
    // only makes sense once the worker has genuinely run.
    if(_brushSubPanel){
      _brushSubPanel.classList.toggle('hidden',!_bgRemovalDone);
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
    // Trimming has nothing to do with removing paper — it only needs a
    // picture. The working buffer is materialized lazily when the tool is
    // actually entered (_ensureWorkingBuffer), so the gate here is simply
    // "is there a picture at all".
    if(_cropTile) _cropTile.disabled=!_origImg;
    if(_cropApplyBtn) _cropApplyBtn.disabled=!(_cropRect&&_workingBuffer);
    if(_cropTrashBtn) _cropTrashBtn.disabled=!(_cropRect&&_workingBuffer);
    if(_cropResetBtn) _cropResetBtn.disabled=!_preCropSnapshot;
    // The three Sheet Extractor tools gate exactly like Trim does — they
    // need a picture, nothing more, since each materializes the working
    // buffer itself on entry. Their two undo buttons gate on whether a
    // snapshot actually exists, which is the only honest answer.
    if(_extractTile) _extractTile.disabled=!_origImg;
    if(_outlineTile) _outlineTile.disabled=!_origImg;
    if(_fillTile) _fillTile.disabled=!_origImg;
    if(_outlineUndoBtn) _outlineUndoBtn.disabled=!_outlineSnapshot;
    if(_fillUndoBtn) _fillUndoBtn.disabled=!_fillSnapshot;
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

  // ---------- Doodle gestures ---------------------------------------
  function _startDoodleGesture(clientX,clientY){
    const f=_screenToImageFraction(clientX,clientY);
    if(!f) return;
    if(_doodleMode==='shape'){
      _doodleShapeDrag={ox:f.x,oy:f.y,preview:null};
      _updateShapeDragPreview(f.x,f.y);
    }else{
      _doodleLive={
        type:'stroke',
        points:[{x:f.x,y:f.y}],
        color:_doodleColor,
        width:_doodleWidthPx(_doodleSize),
        medium:_doodleMedium
      };
    }
    _render();
  }
  function _moveDoodleGesture(clientX,clientY){
    const f=_screenToImageFraction(clientX,clientY);
    if(!f) return;
    if(_doodleShapeDrag){
      _updateShapeDragPreview(f.x,f.y);
    }else if(_doodleLive){
      const pts=_doodleLive.points;
      const last=pts[pts.length-1];
      // Same 2px point-thinning threshold Studio's own doodle pad uses,
      // expressed here in source-image pixels so it means the same thing
      // regardless of how far the picture is zoomed in.
      const img=_activeImg();
      const minDim=img?Math.min(img.width,img.height):320;
      const dx=(f.x-last.x)*minDim, dy=(f.y-last.y)*minDim;
      if(dx*dx+dy*dy<4) return;
      pts.push({x:f.x,y:f.y});
    }
    _render();
  }
  function _updateShapeDragPreview(x,y){
    const d=_doodleShapeDrag;
    if(!d) return;
    d.preview={
      type:'shape',
      shape:_doodleShape,
      x:Math.min(d.ox,x), y:Math.min(d.oy,y),
      w:Math.abs(x-d.ox), h:Math.abs(y-d.oy),
      fill:_doodleShapeFill, fillOn:_doodleShapeFillOn,
      stroke:_doodleShapeStroke, strokeOn:_doodleShapeStrokeOn,
      strokeW:_doodleWidthPx(_doodleShapeStrokeSize)
    };
  }
  function _endDoodleGesture(){
    if(_doodleShapeDrag){
      const p=_doodleShapeDrag.preview;
      _doodleShapeDrag=null;
      if(p){
        // A plain tap (no real drag) stamps a comfortable default-sized
        // shape centred on the tap rather than a zero-area nothing —
        // a child shouldn't have to know they were supposed to drag.
        if(p.w<0.02||p.h<0.02){
          const cxf=p.x+p.w/2, cyf=p.y+p.h/2;
          p.w=0.25; p.h=0.25; p.x=cxf-0.125; p.y=cyf-0.125;
        }
        _state.doodle.push(p);
      }
    }else if(_doodleLive){
      if(_doodleLive.points.length>=2) _state.doodle.push(_doodleLive);
      _doodleLive=null;
    }
    _refreshDrawControls();
    _render();
  }
  function _undoDoodle(){
    if(!_state.doodle||!_state.doodle.length) return;
    _state.doodle.pop();
    _refreshDrawControls();
    _render();
  }
  function _clearDoodle(){
    if(!_state.doodle||!_state.doodle.length) return;
    _state.doodle=[];
    _refreshDrawControls();
    _render();
  }
  function _refreshDrawControls(){
    const count=(_state.doodle||[]).length;
    if(_doodleUndoBtn) _doodleUndoBtn.disabled=!count;
    if(_doodleClearBtn) _doodleClearBtn.disabled=!count;
    if(_root) _root.setAttribute('data-draw-mode',_doodleMode);
    if(_doodleMediumBtns){
      Object.keys(_doodleMediumBtns).forEach(function(k){
        _doodleMediumBtns[k].classList.toggle('active',k===_doodleMedium);
      });
    }
    if(_doodleSizeBtns){
      Object.keys(_doodleSizeBtns).forEach(function(k){
        _doodleSizeBtns[k].classList.toggle('active',k===_doodleSize);
      });
    }
    if(_doodleShapeGrid){
      Array.prototype.forEach.call(_doodleShapeGrid.querySelectorAll('.picture-studio-shape-tile'),function(b){
        b.classList.toggle('active',b.getAttribute('data-shape')===_doodleShape);
      });
    }
  }

  // The Draw sub-panel — freehand (four media, colour, thickness) and
  // shapes (silhouette picker, fill, outline), plus Undo/Clear. Every
  // drawing behaviour behind it is CardDesigner's own; this is only the
  // control surface.
  function _buildDrawSubPanel(){
    const CD=_cd();
    const p=document.createElement('div');
    p.className='picture-studio-subpanel';
    p.setAttribute('data-tool','draw');

    const hint=document.createElement('p');
    hint.className='picture-studio-subpanel-hint';
    hint.textContent='Pick a colour, then draw right on your picture.';
    p.appendChild(hint);

    // Mode: Freehand vs. Shape.
    const modeRow=document.createElement('div');
    modeRow.className='picture-studio-draw-mode-row';
    const modeBtns={};
    [['freehand','✏️','Draw'],['shape','🔷','Shapes']].forEach(function(m){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-draw-mode-btn';
      b.innerHTML='<span aria-hidden="true">'+m[1]+'</span><span>'+m[2]+'</span>';
      b.addEventListener('click',function(){
        _doodleMode=m[0];
        Object.keys(modeBtns).forEach(function(k){ modeBtns[k].classList.toggle('active',k===_doodleMode); });
        _refreshDrawControls();
      });
      modeBtns[m[0]]=b;
      modeRow.appendChild(b);
    });
    modeBtns.freehand.classList.add('active');
    p.appendChild(modeRow);

    // ---- Freehand group ----
    const freeGroup=document.createElement('div');
    freeGroup.className='picture-studio-draw-group picture-studio-draw-freehand';

    const media=(CD&&CD.DOODLE_MEDIA)||[];
    const mediumRow=document.createElement('div');
    mediumRow.className='picture-studio-draw-media-row';
    _doodleMediumBtns={};
    media.forEach(function(m){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-draw-media-btn';
      b.title=m.label;
      b.innerHTML='<span class="picture-studio-draw-media-icon" aria-hidden="true">'+m.icon+'</span><span class="picture-studio-draw-media-label">'+m.label+'</span>';
      b.addEventListener('click',function(){
        _doodleMedium=m.id;
        // Each medium carries its own curated palette (Studio's own
        // design), so switching medium rebuilds the swatches and lands
        // the pen on that palette's first colour rather than leaving a
        // stale colour that doesn't belong to it.
        _doodleColor=(m.palette&&m.palette[0])||_doodleColor;
        _rebuildDoodleColourKit();
        _refreshDrawControls();
      });
      _doodleMediumBtns[m.id]=b;
      mediumRow.appendChild(b);
    });
    freeGroup.appendChild(mediumRow);
    if(media.length && media[0].palette) _doodleColor=media[0].palette[0];

    _doodleColourKitHost=document.createElement('div');
    _doodleColourKitHost.className='picture-studio-draw-colour-host';
    freeGroup.appendChild(_doodleColourKitHost);

    const sizeRow=document.createElement('div');
    sizeRow.className='picture-studio-draw-size-row';
    _doodleSizeBtns={};
    [['small',10],['medium',16],['large',24]].forEach(function(s){
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-draw-size-btn';
      b.title=s[0];
      const dot=document.createElement('span');
      dot.className='picture-studio-draw-size-dot';
      dot.style.width=s[1]+'px';
      dot.style.height=s[1]+'px';
      b.appendChild(dot);
      b.addEventListener('click',function(){ _doodleSize=s[0]; _refreshDrawControls(); });
      _doodleSizeBtns[s[0]]=b;
      sizeRow.appendChild(b);
    });
    freeGroup.appendChild(sizeRow);
    p.appendChild(freeGroup);

    // ---- Shape group ----
    const shapeGroup=document.createElement('div');
    shapeGroup.className='picture-studio-draw-group picture-studio-draw-shape';

    _doodleShapeGrid=document.createElement('div');
    _doodleShapeGrid.className='picture-studio-shape-grid';
    let kinds=[];
    try{ kinds=(window.StickerLibrary&&window.StickerLibrary.SHAPE_KINDS)||[]; }catch(e){ kinds=[]; }
    kinds.forEach(function(k){
      // 'custom' is Studio's own draw-your-own-silhouette shape, which
      // needs its own separate drawing pad to author — out of scope here
      // (Image Studio's freehand mode already covers "draw any line you
      // like"), so it is deliberately not offered rather than shown as a
      // tile that would stamp an empty silhouette.
      if(k.value==='custom') return;
      const b=document.createElement('button');
      b.type='button';
      b.className='picture-studio-shape-tile';
      b.setAttribute('data-shape',k.value);
      b.title=k.label||k.value;
      b.textContent=k.icon||'▢';
      b.addEventListener('click',function(){ _doodleShape=k.value; _refreshDrawControls(); });
      _doodleShapeGrid.appendChild(b);
    });
    shapeGroup.appendChild(_doodleShapeGrid);

    const fillLbl=document.createElement('div');
    fillLbl.className='picture-studio-draw-sublabel';
    fillLbl.textContent='Inside colour';
    shapeGroup.appendChild(fillLbl);
    if(CD&&typeof CD.buildColourKit==='function'){
      _doodleShapeFillKit=CD.buildColourKit(shapeGroup,{
        value:_doodleShapeFill,
        showTransparent:true,
        transparent:!_doodleShapeFillOn,
        onChange:function(v){ _doodleShapeFill=v; _doodleShapeFillOn=true; },
        onTransparentChange:function(t){ _doodleShapeFillOn=!t; }
      });
    }

    const outLbl=document.createElement('div');
    outLbl.className='picture-studio-draw-sublabel';
    outLbl.textContent='Outline colour';
    shapeGroup.appendChild(outLbl);
    if(CD&&typeof CD.buildColourKit==='function'){
      _doodleShapeStrokeKit=CD.buildColourKit(shapeGroup,{
        value:_doodleShapeStroke,
        showTransparent:true,
        transparent:!_doodleShapeStrokeOn,
        onChange:function(v){ _doodleShapeStroke=v; _doodleShapeStrokeOn=true; },
        onTransparentChange:function(t){ _doodleShapeStrokeOn=!t; }
      });
    }
    p.appendChild(shapeGroup);

    // ---- Undo / Clear (shared by both modes) ----
    const actions=document.createElement('div');
    actions.className='picture-studio-subpanel-row';
    _doodleUndoBtn=document.createElement('button');
    _doodleUndoBtn.type='button';
    _doodleUndoBtn.className='picture-studio-subpanel-btn';
    _doodleUndoBtn.textContent='↩ Undo';
    _doodleUndoBtn.addEventListener('click',_undoDoodle);
    actions.appendChild(_doodleUndoBtn);
    _doodleClearBtn=document.createElement('button');
    _doodleClearBtn.type='button';
    _doodleClearBtn.className='picture-studio-subpanel-btn picture-studio-subpanel-btn-danger';
    _doodleClearBtn.textContent='🗑 Clear All';
    _doodleClearBtn.addEventListener('click',_clearDoodle);
    actions.appendChild(_doodleClearBtn);
    p.appendChild(actions);

    _rebuildDoodleColourKit();
    _refreshDrawControls();
    return p;
  }
  function _rebuildDoodleColourKit(){
    const CD=_cd();
    if(!_doodleColourKitHost||!CD||typeof CD.buildColourKit!=='function') return;
    _doodleColourKitHost.innerHTML='';
    let palette=null;
    ((CD.DOODLE_MEDIA)||[]).forEach(function(m){ if(m.id===_doodleMedium) palette=m.palette; });
    _doodleColourKit=CD.buildColourKit(_doodleColourKitHost,{
      palette:palette||undefined,
      value:_doodleColor,
      onChange:function(v){ _doodleColor=v; }
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
      if(_activeTool==='draw'){
        _startDoodleGesture(e.clientX,e.clientY);
        e.preventDefault();
        return;
      }
      // Crop draws a box to TRIM to. Cut Out Objects marks out where to
      // SEARCH — a rectangle, circle or freehand shape, so it has its own
      // gesture (_startAreaDrag) drawing into its own SVG overlay rather
      // than borrowing the crop box.
      if(_activeTool==='crop'){
        _startCropDrag(e.clientX,e.clientY);
        e.preventDefault();
        return;
      }
      if(_activeTool==='extract'){
        _startAreaDrag(e.clientX,e.clientY);
        e.preventDefault();
        return;
      }
      // Colour Fill is a tap, not a drag — one flood fill per press, so it
      // never installs a _drag and never pans.
      if(_activeTool==='fill'){
        _fillAt(e.clientX,e.clientY);
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
      if(_doodleLive||_doodleShapeDrag){
        _moveDoodleGesture(e.clientX,e.clientY);
        return;
      }
      if(_brushPainting){
        _paintAt(e.clientX,e.clientY);
        return;
      }
      if(_cropDrag){
        _updateCropDrag(e.clientX,e.clientY);
        return;
      }
      if(_areaDrag){
        _updateAreaDrag(e.clientX,e.clientY);
        return;
      }
      if(!_drag) return;
      _state.panX=_drag.px+(e.clientX-_drag.sx);
      _state.panY=_drag.py+(e.clientY-_drag.sy);
      _render();
    });
    window.addEventListener('mouseup',function(){
      if(_doodleLive||_doodleShapeDrag){ _endDoodleGesture(); }
      if(_brushPainting){ _finishStroke(); }
      if(_cropDrag){ _finishCropDrag(); }
      if(_areaDrag){ _finishAreaDrag(); }
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
    if(!_ensureWorkingBuffer()) return;
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
    // Trim Picture only — Cut Out Objects' search areas draw through their
    // own SVG overlay (_startAreaDrag and friends), never this box, so
    // marking out where to LOOK can never arm a control that TRIMS.
    const commit=function(box){
      _cropRect=box;
      _refreshBgControls();
    };
    // On mouseup we've already been fed the last mousemove; snapshot
    // the box's current screen-rect and convert both corners.
    const rect=_cropBoxEl.getBoundingClientRect();
    _cropDrag=null;
    if(rect.width<4||rect.height<4){
      // Ignore tiny/accidental drags. For Cut Out Objects that also means a
      // stray tap clears whatever area was marked, so the panel's hint can
      // never claim a marked area with no box left on screen.
      _tearDownCropBox();
      commit(null);
      return;
    }
    // Coordinates resolve against the WORKING BUFFER, which is the space
    // _cropPixelBuffer actually operates in. (_bgRemovedImg is drawn from
    // that same buffer so the dimensions match, but the buffer is the
    // source of truth and is what stays correct if the two ever diverge.)
    if(!_workingBuffer){ _tearDownCropBox(); commit(null); return; }
    const bw=_workingBuffer.width, bh=_workingBuffer.height;
    const topLeft=_screenToContent(rect.left,rect.top,bw,bh);
    const botRight=_screenToContent(rect.right,rect.bottom,bw,bh);
    if(!topLeft||!botRight){
      // Selection extends outside the image — clamp to image bounds so
      // the crop is still a valid rectangle.
      const clamp=function(p){
        if(!p) return null;
        return {
          x:Math.max(0,Math.min(bw-1,p.x)),
          y:Math.max(0,Math.min(bh-1,p.y))
        };
      };
      const tl=clamp(topLeft);
      const br=clamp(botRight);
      // If either corner still couldn't be resolved (drag started well
      // outside the image), fall back to (0,0)..(w,h) — treats the drag
      // as "crop to full image", a safe no-op that never throws.
      commit({
        x:tl?Math.round(tl.x):0,
        y:tl?Math.round(tl.y):0,
        width:Math.round((br?br.x:bw)-(tl?tl.x:0)),
        height:Math.round((br?br.y:bh)-(tl?tl.y:0))
      });
    }else{
      commit({
        x:Math.round(topLeft.x),
        y:Math.round(topLeft.y),
        width:Math.round(botRight.x-topLeft.x),
        height:Math.round(botRight.y-topLeft.y)
      });
    }
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

  // ---------- Cut Out Objects: search areas ------------------------
  // The child marks out where to LOOK — a rectangle, a circle, or a
  // freehand shape — and extraction runs one pass per marked area
  // (_runExtractPasses). Each area is stored in WORKING-BUFFER pixels
  // ({kind,bbox,points?}) so it survives zoom/pan, and is drawn back to
  // the stage through its own SVG overlay (_syncAreaSvg) rather than
  // borrowing Trim Picture's crop box.
  //
  // A note on why coordinates clamp rather than drop: _screenToContent
  // returns null for a point outside the image, but a freehand trace
  // that wanders off the edge must stay a CLOSED shape — dropping the
  // out-of-bounds points would tear a hole in the outline, so the
  // caller clamps to the image bounds instead.
  function _areaPointFromScreen(clientX,clientY){
    if(!_workingBuffer) return null;
    const bw=_workingBuffer.width, bh=_workingBuffer.height;
    const p=_screenToContent(clientX,clientY,bw,bh);
    if(p) return {x:p.x,y:p.y};
    // Out of bounds — recompute the unclamped point by probing the
    // stage geometry directly (same math as _screenToContent, minus
    // the bounds check), then clamp.
    const rect=_canvas.getBoundingClientRect();
    if(!rect.width||!rect.height) return null;
    const sx=(clientX-rect.left)*(_canvas.width/rect.width);
    const sy=(clientY-rect.top)*(_canvas.height/rect.height);
    const s=_stageRect();
    const fit=Math.min(s.w/bw,s.h/bh);
    const z=fit*_state.zoom;
    if(!z) return null;
    const cx=(sx-_canvas.width/2-_state.panX)/z + bw/2;
    const cy=(sy-_canvas.height/2-_state.panY)/z + bh/2;
    return {
      x:Math.max(0,Math.min(bw-1,cx)),
      y:Math.max(0,Math.min(bh-1,cy))
    };
  }
  function _startAreaDrag(clientX,clientY){
    if(!_ensureWorkingBuffer()) return;
    const p=_areaPointFromScreen(clientX,clientY);
    if(!p) return;
    _areaDrag={kind:_areaShape,sx:p.x,sy:p.y,cx:p.x,cy:p.y};
    if(_areaShape==='free') _areaDrag.points=[{x:p.x,y:p.y}];
    _syncAreaSvg();
  }
  function _updateAreaDrag(clientX,clientY){
    if(!_areaDrag) return;
    const p=_areaPointFromScreen(clientX,clientY);
    if(!p) return;
    _areaDrag.cx=p.x;
    _areaDrag.cy=p.y;
    if(_areaDrag.kind==='free') _areaDrag.points.push({x:p.x,y:p.y});
    _syncAreaSvg();
  }
  function _finishAreaDrag(){
    if(!_areaDrag) return;
    const d=_areaDrag;
    _areaDrag=null;
    let bbox;
    if(d.kind==='free'){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      (d.points||[]).forEach(function(p){
        if(p.x<minX) minX=p.x;
        if(p.y<minY) minY=p.y;
        if(p.x>maxX) maxX=p.x;
        if(p.y>maxY) maxY=p.y;
      });
      bbox={x:minX,y:minY,width:maxX-minX,height:maxY-minY};
    }else{
      bbox={
        x:Math.min(d.sx,d.cx),
        y:Math.min(d.sy,d.cy),
        width:Math.abs(d.cx-d.sx),
        height:Math.abs(d.cy-d.sy)
      };
    }
    // Ignore tiny/accidental drags — same 4px rule the crop box uses,
    // except here it means "keep whatever was already marked" rather
    // than clearing anything.
    if(!isFinite(bbox.x)||bbox.width<4||bbox.height<4){
      _syncAreaSvg();
      _refreshExtractControls();
      return;
    }
    bbox={
      x:Math.round(bbox.x),y:Math.round(bbox.y),
      width:Math.round(bbox.width),height:Math.round(bbox.height)
    };
    const area={kind:d.kind,bbox:bbox};
    if(d.kind==='free'){
      area.points=d.points.map(function(p){
        return {x:Math.round(p.x),y:Math.round(p.y)};
      });
    }
    _extractAreas.push(area);
    _syncAreaSvg();
    _refreshExtractControls();
  }
  // Working-buffer pixel -> CSS px relative to _stage. The exact
  // inverse of _screenToContent (see there for the forward math);
  // the same image-px -> logical canvas-px -> CSS-px chain
  // _updateBrushCursorSize already walks for the brush circle.
  function _bufferToStage(bx,by){
    if(!_workingBuffer||!_canvas||!_stage) return null;
    const rect=_canvas.getBoundingClientRect();
    const stageRect=_stage.getBoundingClientRect();
    if(!rect.width||!rect.height) return null;
    const bw=_workingBuffer.width, bh=_workingBuffer.height;
    const s=_stageRect();
    const fit=Math.min(s.w/bw,s.h/bh);
    const z=fit*_state.zoom;
    const sx=(bx-bw/2)*z + _canvas.width/2  + _state.panX;
    const sy=(by-bh/2)*z + _canvas.height/2 + _state.panY;
    return {
      x:sx*(rect.width/_canvas.width) + rect.left - stageRect.left,
      y:sy*(rect.height/_canvas.height) + rect.top - stageRect.top
    };
  }
  function _syncAreaSvg(){
    if(!_stage) return;
    const anything=_extractAreas.length>0||!!_areaDrag;
    if(!_extractAreaSvg){
      if(!anything) return;   // nothing to show, nothing to build
      _extractAreaSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      _extractAreaSvg.setAttribute('class','picture-studio-area-svg');
      _stage.appendChild(_extractAreaSvg);
    }
    while(_extractAreaSvg.firstChild) _extractAreaSvg.removeChild(_extractAreaSvg.firstChild);
    if(!anything){
      _extractAreaSvg.classList.add('hidden');
      return;
    }
    _extractAreaSvg.classList.remove('hidden');
    const NS='http://www.w3.org/2000/svg';
    const drawOne=function(kind,bbox,points,inFlight){
      let el=null;
      if(kind==='free'){
        if(!points||points.length<2) return;
        el=document.createElementNS(NS,'polyline');
        el.setAttribute('points',points.map(function(p){
          const q=_bufferToStage(p.x,p.y);
          return q?(q.x.toFixed(1)+','+q.y.toFixed(1)):'';
        }).filter(Boolean).join(' '));
      }else{
        const tl=_bufferToStage(bbox.x,bbox.y);
        const br=_bufferToStage(bbox.x+bbox.width,bbox.y+bbox.height);
        if(!tl||!br) return;
        if(kind==='circle'){
          el=document.createElementNS(NS,'ellipse');
          el.setAttribute('cx',((tl.x+br.x)/2).toFixed(1));
          el.setAttribute('cy',((tl.y+br.y)/2).toFixed(1));
          el.setAttribute('rx',(Math.abs(br.x-tl.x)/2).toFixed(1));
          el.setAttribute('ry',(Math.abs(br.y-tl.y)/2).toFixed(1));
        }else{
          el=document.createElementNS(NS,'rect');
          el.setAttribute('x',Math.min(tl.x,br.x).toFixed(1));
          el.setAttribute('y',Math.min(tl.y,br.y).toFixed(1));
          el.setAttribute('width',Math.abs(br.x-tl.x).toFixed(1));
          el.setAttribute('height',Math.abs(br.y-tl.y).toFixed(1));
        }
      }
      if(!el) return;
      el.setAttribute('class','picture-studio-area-shape'+(inFlight?' picture-studio-area-shape-drafting':''));
      _extractAreaSvg.appendChild(el);
    };
    _extractAreas.forEach(function(a){ drawOne(a.kind,a.bbox,a.points,false); });
    if(_areaDrag){
      const d=_areaDrag;
      if(d.kind==='free'){
        drawOne('free',null,d.points,true);
      }else{
        drawOne(d.kind,{
          x:Math.min(d.sx,d.cx),y:Math.min(d.sy,d.cy),
          width:Math.abs(d.cx-d.sx),height:Math.abs(d.cy-d.sy)
        },null,true);
      }
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
      height:_workingBuffer.height,
      // Keep This changes the picture's own dimensions, so every
      // fractional doodle coordinate has to be re-expressed against the
      // new, smaller frame (below). Snapshot the layer as it was so Undo
      // Trim genuinely restores the drawing too, not just the pixels.
      doodle:_cloneDoodleLayer(_state.doodle)
    };
    _remapDoodleForCrop(bounds,_workingBuffer.width,_workingBuffer.height);
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
    // Only Keep This ever remaps the doodle layer (it is the one op that
    // changes the picture's dimensions); Trash It leaves it untouched
    // and therefore snapshots nothing to restore here.
    if(_preCropSnapshot.doodle) _state.doodle=_cloneDoodleLayer(_preCropSnapshot.doodle);
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
    if(!_ensureWorkingBuffer()) return;
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
      // Doodle layer — composited INSIDE the same transform, right on
      // top of the picture it was drawn on, so pan/zoom/rotate/flip all
      // apply to it exactly as they do to the photograph. Skipped while
      // peeking the pristine original (that tile means "show me what I
      // started with", drawing included).
      if(!_state.showOriginal) _paintDoodleLayer(_ctx,-iw*z/2,-ih*z/2,iw*z,ih*z,iw);
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
    // Same call, same transform, same fractional data as the preview's
    // own _paintOne — ONE shared painter is what guarantees "what you
    // see is what you get" here, rather than two implementations kept in
    // sync by hand.
    _paintDoodleLayer(oc,-iw/2,-ih/2,iw,ih,iw);

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
    // Optional, and every existing caller omits it — which is exactly why
    // extraction could be added without touching a single open() call site.
    _onApplyMany=options.onApplyMany||null;
    _onCancel=options.onCancel||null;
    _state=Object.assign({},DEFAULT_STATE,{mode:options.defaultMode||'fit'});
    // Doodle layer — deliberately assigned here rather than sitting in
    // DEFAULT_STATE, because Object.assign copies an array by REFERENCE:
    // a `doodle:[]` in DEFAULT_STATE would be the SAME array for every
    // session, so a previous picture's drawing would bleed into the next
    // one. A fresh literal per open is the whole fix.
    _state.doodle=[];
    _doodleLive=null;
    _doodleShapeDrag=null;
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
    // Ask B — a modal dismissal never routes through _toggleActiveTool, so the
    // compose panel needs its own hook here. It holds pieces cut from results
    // that are about to be dropped, so it goes with them. close() is
    // idempotent, so overlapping with the _toggleActiveTool hook is harmless.
    if(typeof ComposePanel!=='undefined') ComposePanel.close();
    _origImg=null;
    _bgRemovedImg=null;
    _bgRemovalDone=false;
    _bgRemovedDataURL=null;
    _bgBusy=false;
    _drag=null;
    // _workingBuffer and _bgRemovedImg are a matched pair: _ensureWorkingBuffer
    // materializes them together, and _syncCanvasFromBuffer requires both.
    // Dropping one without the other left the module in a state its own
    // invariant forbids — _ensureWorkingBuffer would early-return on the stale
    // buffer and never re-mint _bgRemovedImg, so on a re-open EVERY pixel tool
    // (extract, crop, outline, fill, erase) silently operated on the previous
    // picture's pixels and painted nothing. The other two reset sites
    // (_undoBgRemoval, "Yes, start over") already null the pair together; this
    // one didn't. The rest below is the same "drop everything that describes
    // the picture that just went away" reasoning the extractor comment further
    // down already states — a re-open must never offer an Undo Trim that would
    // restore a completely different picture.
    _workingBuffer=null;
    _cleanupHistory=[];
    _cleanupRedoStack=[];
    _brushMode=null;
    _cropRect=null;
    _preCropSnapshot=null;
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
    // Sheet Extractor tools — drop every cutout (revoking its object URL,
    // since _clearExtractResults owns that) and both undo snapshots, so a
    // re-open can never offer an undo that would restore a completely
    // different picture, nor show cutouts of one.
    _clearExtractResults();
    _extractBusy=false;
    _outlineSnapshot=null;
    _fillSnapshot=null;
    _onApplyMany=null;
    // Search areas are in working-buffer pixels of the picture that just went
    // away, so they go with it — a re-open must never say "Looking inside your
    // marked area only." about areas traced on a different picture. _areaShape
    // deliberately survives: it's a tool preference (like _extractInk), not
    // picture state.
    _extractAreas=[];
    _areaDrag=null;
    _syncAreaSvg();
    if(_extractStatusEl) _extractStatusEl.textContent='';
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
