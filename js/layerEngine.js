// layerEngine.js — Sprint 9.6 (Museum Gallery Theme Support).
//
// The Independent Layer System. Layers are NOT part of containership
// (Book -> Slide -> Frame -> Holder -> Element) — they're an
// orthogonal system that can decorate any of those four scopes.
// A theme's `layerPack` is a flat array of:
//   {
//     id, type: 'text'|'sticker'|'decoration',
//     target: 'slide'|'frame'|'holder'|'element',
//     anchor, offsetX, offsetY, zIndex, visible, scope,
//     rect: {x,y,w,h} (optional, fractional, overrides anchor placement),
//     text: {...} | sticker: {...} | decoration: {...}   // per-type payload
//   }
// `scope` (optional) is a Layout id a layer is restricted to — omitted
// (every layer authored before Builder Convergence) means global, exactly
// as before; the caller (SlideRenderer._activeLayerPack) is what actually
// filters by it, this module only defines the field's existence.
//
// This module is intentionally small: it filters a layer pack down to
// "every layer that targets scope X, in z-order" and resolves an
// anchor string to a point within a rect — the same anchor vocabulary
// (top/bottom-left/center/right) already used by
// handlePosition/pageNumber/bookTitlePosition, generalized rather than
// reinvented. It has NO canvas-2d code of its own; the actual drawing
// primitives are supplied by the caller (SlideRenderer) as `helpers`,
// so there is exactly one place in the codebase that knows how to draw
// text/stickers/decorations onto the canvas — this module never
// becomes a second rendering engine.
//
// Scope discipline (per the sprint spec): built generically enough for
// any future theme to declare layers at any of the four target scopes,
// but only as deep as Museum Gallery — this sprint's one consumer —
// actually needs. No animation, no behavior system, no per-layer
// interactivity.
const LayerEngine=(function(){
  'use strict';

  function _isVisible(layer){ return layer && layer.visible!==false; }

  // Every layer targeting `target`, in ascending zIndex order (stable
  // for equal zIndex — Array.sort is stable in every engine this app
  // ships to).
  function forTarget(pack,target){
    if(!Array.isArray(pack)) return [];
    return pack
      .filter(function(l){ return l && l.target===target && _isVisible(l); })
      .sort(function(a,b){ return (a.zIndex||0)-(b.zIndex||0); });
  }

  // Resolves a named anchor to a point + alignment within `rect`. Same
  // 9-point vocabulary as the existing handle/pageNumber/bookTitle
  // position controls, just scoped to an arbitrary rect instead of
  // always the full canvas.
  function resolveAnchor(anchor,rect){
    const a=anchor||'bottom-center';
    const vAlign=a.indexOf('top')===0 ? 'top' : a.indexOf('bottom')===0 ? 'bottom' : 'middle';
    const hAlign=a.indexOf('left')!==-1 ? 'left' : a.indexOf('right')!==-1 ? 'right' : 'center';
    const x=hAlign==='left' ? rect.x : hAlign==='right' ? rect.x+rect.w : rect.x+rect.w/2;
    const y=vAlign==='top' ? rect.y : vAlign==='bottom' ? rect.y+rect.h : rect.y+rect.h/2;
    return {x:x,y:y,hAlign:hAlign,vAlign:vAlign};
  }

  // A layer's own optional `rect` (fractional {x,y,w,h} within the
  // target's rect) is how a Builder-Convergence-authored Layer (a
  // Scene's own free-form Place/Decoration/Text position — no anchor
  // vocabulary of its own) places itself. Absent `rect` (every layer
  // authored before this), `layerRect` stays null and the anchor
  // resolves against the target rect exactly as before — zero
  // behavior change for any pre-existing theme.
  function _resolveLayerRect(layer,rect){
    const r=layer && layer.rect;
    if(!r || typeof r.x!=='number' || typeof r.y!=='number') return null;
    return {
      x:rect.x+r.x*rect.w,
      y:rect.y+r.y*rect.h,
      w:(typeof r.w==='number'?r.w:0)*rect.w,
      h:(typeof r.h==='number'?r.h:0)*rect.h
    };
  }

  // Renders every layer targeting `target` against `rect`, dispatching
  // to whichever `helpers.draw<Type>` the caller supplied. A helper the
  // caller omits simply means that layer type is skipped at this call
  // site — e.g. SlideRenderer only wires drawSticker at the Frame call
  // site because Museum Gallery's Wax Seal is the only sticker layer
  // this sprint ships, not because the engine can't do more.
  function render(pack,target,rect,helpers){
    if(!rect || !helpers) return;
    forTarget(pack,target).forEach(function(layer){
      const layerRect=_resolveLayerRect(layer,rect);
      const anchor=resolveAnchor(layer.anchor,layerRect||rect);
      anchor.x+=(typeof layer.offsetX==='number')?layer.offsetX:0;
      anchor.y+=(typeof layer.offsetY==='number')?layer.offsetY:0;
      if(layer.type==='text' && typeof helpers.drawText==='function') helpers.drawText(layer,anchor,rect,layerRect);
      else if(layer.type==='sticker' && typeof helpers.drawSticker==='function') helpers.drawSticker(layer,anchor,rect,layerRect);
      else if(layer.type==='decoration' && typeof helpers.drawDecoration==='function') helpers.drawDecoration(layer,anchor,rect,layerRect);
    });
  }

  function hasLayer(pack,id){
    return Array.isArray(pack) && pack.some(function(l){ return l && l.id===id; });
  }

  const api={
    forTarget:forTarget,
    resolveAnchor:resolveAnchor,
    render:render,
    hasLayer:hasLayer
  };
  try{ window.LayerEngine=api; }catch(e){}
  return api;
})();
