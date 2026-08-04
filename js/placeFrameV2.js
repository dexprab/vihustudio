// placeFrameV2 — Place · Frame · Paper · Art Model V2 — Phase 1: Foundation.
//
// Frozen spec: docs/PLACE_FRAME_MODEL_V2.md
// Companion artifact (same figures rendered as SVG):
//   https://claude.ai/code/artifact/30f89733-69f1-49ac-af38-257127c65dec
//
// ==============================================================
// What this module IS (Phase 1)
// ==============================================================
// A namespace of shared model constants and pure functions that
// every future V2 phase will import from — no side effects, no
// wiring into the existing render or compile pipelines yet. Load
// order in index.html is irrelevant this phase because nothing
// calls anything here.
//
// Phase 2/3 (render side, Studio + Builder v2) will add a V2 code
// path in slideRenderer.js / engineRuntime.js guarded by a
// slide-level opt-in field; those phases consume the pure helpers
// below. Phase 5 (compile side) will teach builder.js to emit V2
// fields. Phase 7 retires the old Frame Variation fields.
//
// ==============================================================
// Model summary — see the frozen spec for the full rationale
// ==============================================================
// Containment:  Scene ⊃ Place ⊃ Frame ⊃ {Paper, Art}
//   Place is a virtual (builder-only) authoring anchor — position,
//   rotation, permissions. Frame is the outermost VISIBLE layer.
//   Paper and Art are siblings inside Frame.
//
// Draw order (z, back → front):
//   Paper (back)  →  Art (middle)  →  Frame (top)
//
// Every visible layer takes ONE primary content type from the
// same vocabulary — Image · Color · Shape · Experience — with
// Experience always ADDITIVE (never replaces primary content).
//
// Frame is the only layer with its own separate border.
// ==============================================================
(function(){
  'use strict';
  if(typeof window === 'undefined') return;

  // ---------- Layer kinds & draw order ----------

  const LAYER_KIND = Object.freeze({
    FRAME: 'frame',
    PAPER: 'paper',
    ART:   'art'
  });

  // Back-to-front paint order (spec §1.2). Never mutate this
  // array — callers should copy if they need to filter.
  const DRAW_ORDER = Object.freeze([
    LAYER_KIND.PAPER,
    LAYER_KIND.ART,
    LAYER_KIND.FRAME
  ]);

  // ---------- Content slots ----------

  const CONTENT_SLOT = Object.freeze({
    IMAGE:      'image',
    COLOR:      'color',
    SHAPE:      'shape',
    EXPERIENCE: 'experience'
  });

  // Which primary content types each layer accepts (spec §2 / §3).
  // Frame has no Color slot (its "colour" is the border colour,
  // handled separately, not a content slot).
  const LAYER_SLOTS = Object.freeze({
    [LAYER_KIND.FRAME]: Object.freeze([
      CONTENT_SLOT.IMAGE, CONTENT_SLOT.SHAPE, CONTENT_SLOT.EXPERIENCE
    ]),
    [LAYER_KIND.PAPER]: Object.freeze([
      CONTENT_SLOT.IMAGE, CONTENT_SLOT.COLOR, CONTENT_SLOT.SHAPE, CONTENT_SLOT.EXPERIENCE
    ]),
    [LAYER_KIND.ART]:   Object.freeze([
      CONTENT_SLOT.IMAGE, CONTENT_SLOT.COLOR, CONTENT_SLOT.SHAPE, CONTENT_SLOT.EXPERIENCE
    ])
  });

  function layerAcceptsSlot(layer, slot){
    const slots = LAYER_SLOTS[layer];
    if(!slots) return false;
    for(let i = 0; i < slots.length; i++){
      if(slots[i] === slot) return true;
    }
    return false;
  }

  // ---------- Border ownership ----------

  // Only Frame has its own separate border in V2 (spec §2).
  // Art's border was dropped; Paper never had one.
  const LAYER_HAS_BORDER = Object.freeze({
    [LAYER_KIND.FRAME]: true,
    [LAYER_KIND.PAPER]: false,
    [LAYER_KIND.ART]:   false
  });

  // ---------- Shape mode ----------

  // Frame declares a real geometry (Rectangle / Circle / Rounded).
  // Paper/Art declare a fit mode that inherits shape from a parent
  // or sibling — 'Fit Frame' means "take Frame's shape". Spec §2's
  // "Default shape" row.
  const SHAPE_MODE = Object.freeze({
    GEOMETRY: 'geometry',
    FIT:      'fit'
  });

  const LAYER_SHAPE_MODE = Object.freeze({
    [LAYER_KIND.FRAME]: SHAPE_MODE.GEOMETRY,
    [LAYER_KIND.PAPER]: SHAPE_MODE.FIT,
    [LAYER_KIND.ART]:   SHAPE_MODE.FIT
  });

  const FRAME_GEOMETRIES = Object.freeze(['rectangle', 'circle', 'rounded']);
  const PAPER_FIT_MODES  = Object.freeze(['fit-art', 'fit-frame', 'original']);
  const ART_FIT_MODES    = Object.freeze(['fit-frame', 'original']);

  // ---------- Bounds resolution ----------

  // Which layer bounds which. Frame is bounded by Scene; Paper and
  // Art are bounded by Frame (spec §2 "Max size" row).
  //
  // Returns the string identifier of the bounding parent — a caller
  // passes that identifier plus the parent's rect to
  // resolveLayerBounds() below.
  function parentOf(layer){
    if(layer === LAYER_KIND.FRAME) return 'scene';
    if(layer === LAYER_KIND.PAPER) return LAYER_KIND.FRAME;
    if(layer === LAYER_KIND.ART)   return LAYER_KIND.FRAME;
    return null;
  }

  // Clamp a layer's proposed rect to its parent's rect, honouring
  // "cannot outgrow parent" (spec §2 "Max size"). All rects are
  // {x, y, w, h} in the parent's own coordinate space.
  //
  // Missing / undefined fields on `proposed` fall back to the full
  // parent rect (a Paper with no explicit size fills the Frame).
  // Zero or negative w/h resolves to zero (the layer is absent —
  // spec §2 "Min size: 0").
  function resolveLayerBounds(proposed, parentRect){
    const px = (parentRect && typeof parentRect.x === 'number') ? parentRect.x : 0;
    const py = (parentRect && typeof parentRect.y === 'number') ? parentRect.y : 0;
    const pw = (parentRect && typeof parentRect.w === 'number') ? Math.max(0, parentRect.w) : 0;
    const ph = (parentRect && typeof parentRect.h === 'number') ? Math.max(0, parentRect.h) : 0;
    if(!proposed){
      return {x: px, y: py, w: pw, h: ph};
    }
    const wantW = (typeof proposed.w === 'number') ? proposed.w : pw;
    const wantH = (typeof proposed.h === 'number') ? proposed.h : ph;
    const wantX = (typeof proposed.x === 'number') ? proposed.x : px;
    const wantY = (typeof proposed.y === 'number') ? proposed.y : py;
    const w = Math.max(0, Math.min(wantW, pw));
    const h = Math.max(0, Math.min(wantH, ph));
    // A layer can be positioned anywhere inside its parent but its
    // far edge cannot cross the parent's far edge.
    const x = Math.max(px, Math.min(wantX, px + pw - w));
    const y = Math.max(py, Math.min(wantY, py + ph - h));
    return {x: x, y: y, w: w, h: h};
  }

  // Return input layer models sorted back-to-front per DRAW_ORDER.
  // A layer omitted from the input is omitted from the output.
  // Layers with a kind not in DRAW_ORDER are dropped (defensive).
  function resolveDrawOrder(layerModels){
    if(!Array.isArray(layerModels)) return [];
    const byKind = Object.create(null);
    for(let i = 0; i < layerModels.length; i++){
      const l = layerModels[i];
      if(l && l.kind) byKind[l.kind] = l;
    }
    const out = [];
    for(let i = 0; i < DRAW_ORDER.length; i++){
      const layer = byKind[DRAW_ORDER[i]];
      if(layer) out.push(layer);
    }
    return out;
  }

  // ---------- Experience is always additive ----------

  // Spec §3 decision log: Experience never replaces primary
  // content — always composites on top. This helper exists purely
  // for callers who want to be explicit about the invariant. It
  // does not read or write anything; it returns the constant true
  // (or false when the layer has no Experience attached).
  function experienceAugmentsLayer(layerModel){
    if(!layerModel || !layerModel.experience) return false;
    return true;
  }

  // ---------- Transform stack ----------

  // Application order (spec §4). Applied in this exact sequence so
  // a rotated Frame keeps a Paper/Art that tilts within it rather
  // than fighting it.
  const TRANSFORM_ORDER = Object.freeze([
    'rotation',    // 2D Z-axis, degrees. Around layer centre.
    'tilt',        // 3D X/Y skew, two independent axes. Phase 4.
    'perspective', // Vanishing-point warp. Phase 4.
    'resize'       // Width / height overrides within layer bounds.
  ]);

  // Apply the transform stack to a Canvas 2D context, in spec §4
  // order. `transforms` is {rotation, tilt, perspective, resize}
  // (any field optional). `centre` is {x, y} in the current context
  // coordinate space — the anchor around which rotation/tilt
  // operate. Caller is responsible for the surrounding
  // ctx.save()/restore().
  //
  // Phase 1 implements Rotation and Resize (existing capabilities);
  // Tilt and Perspective are stubs that Phase 4 will fill in.
  // Stubs are silent no-ops — a caller passing a Tilt value today
  // will not throw but also will not see the effect until Phase 4.
  function applyTransformStack(ctx, transforms, centre){
    if(!ctx || !transforms) return;
    const cx = (centre && typeof centre.x === 'number') ? centre.x : 0;
    const cy = (centre && typeof centre.y === 'number') ? centre.y : 0;
    // 1. Rotation — anchor at centre.
    if(typeof transforms.rotation === 'number' && transforms.rotation !== 0){
      ctx.translate(cx, cy);
      ctx.rotate(transforms.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
    }
    // 2. Tilt — 3D X/Y skew approximated as an affine shear (spec §4's
    //    own "canvas setTransform covers affine skew"). tilt.x shears
    //    vertically (y' = y + tan(x°)·dx — the top of the layer leans
    //    toward/away like a card tipped on its horizontal axis) and
    //    tilt.y shears horizontally, both anchored at centre, each
    //    clamped ±45° so tan() stays ≤ 1 and the layer never smears
    //    into a degenerate sliver.
    if(transforms.tilt && typeof transforms.tilt === 'object'){
      const tx = Math.max(-45, Math.min(45, (typeof transforms.tilt.x === 'number') ? transforms.tilt.x : 0));
      const ty = Math.max(-45, Math.min(45, (typeof transforms.tilt.y === 'number') ? transforms.tilt.y : 0));
      if(tx !== 0 || ty !== 0){
        ctx.translate(cx, cy);
        ctx.transform(1, Math.tan(tx * Math.PI / 180), Math.tan(ty * Math.PI / 180), 1, 0, 0);
        ctx.translate(-cx, -cy);
      }
    }
    // 3. Perspective — Phase 15 implements a strip-subdivision warp in
    //    the render engines directly (a Canvas 2D context transform
    //    cannot express a non-affine warp, so there is nothing for this
    //    shared affine helper to apply). Documented rather than
    //    silently omitted.
    // if(transforms.perspective){ /* engines implement */ }
    // 4. Resize — width/height overrides. Applied as a scale around
    //    centre; caller has already clamped bounds via
    //    resolveLayerBounds so we don't re-clamp here.
    if(transforms.resize && typeof transforms.resize === 'object'){
      const sx = (typeof transforms.resize.sx === 'number' && transforms.resize.sx > 0) ? transforms.resize.sx : 1;
      const sy = (typeof transforms.resize.sy === 'number' && transforms.resize.sy > 0) ? transforms.resize.sy : 1;
      if(sx !== 1 || sy !== 1){
        ctx.translate(cx, cy);
        ctx.scale(sx, sy);
        ctx.translate(-cx, -cy);
      }
    }
  }

  // ---------- Public API ----------

  window.PlaceFrameV2 = Object.freeze({
    // Constants
    LAYER_KIND: LAYER_KIND,
    DRAW_ORDER: DRAW_ORDER,
    CONTENT_SLOT: CONTENT_SLOT,
    LAYER_SLOTS: LAYER_SLOTS,
    LAYER_HAS_BORDER: LAYER_HAS_BORDER,
    SHAPE_MODE: SHAPE_MODE,
    LAYER_SHAPE_MODE: LAYER_SHAPE_MODE,
    FRAME_GEOMETRIES: FRAME_GEOMETRIES,
    PAPER_FIT_MODES: PAPER_FIT_MODES,
    ART_FIT_MODES: ART_FIT_MODES,
    TRANSFORM_ORDER: TRANSFORM_ORDER,
    // Helpers
    layerAcceptsSlot: layerAcceptsSlot,
    parentOf: parentOf,
    resolveLayerBounds: resolveLayerBounds,
    resolveDrawOrder: resolveDrawOrder,
    experienceAugmentsLayer: experienceAugmentsLayer,
    applyTransformStack: applyTransformStack
  });
})();
