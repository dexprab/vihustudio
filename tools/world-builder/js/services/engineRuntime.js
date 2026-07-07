// js/services/engineRuntime.js — the native Engine V2 Runtime
// (docs/ENGINE_V2_SCENE_MODEL.md §5, LOCK V2-04: "Validation, Runtime,
// Build, and Publish will all operate directly on the canonical Scene
// Model — no translation layer to Engine V1, and no permanent parallel
// Runtime architecture."). This module is the first real implementation
// of that decision: it loads a canonical Scene (the exact
// `scenes/<id>.json` shape `js/projectModel.js` already writes — Scene
// Model §2/§3) and paints its Scene Stack bottom to top, per Engine
// Canon §5's rendering pipeline, with no intermediate or translated
// form anywhere in between.
//
// Deliberately generic: this module reads only the Scene object it is
// given (plus one injected `resolveFrame` callback for the model's one
// cross-reference, a Holder's Frame Theme Asset id — Scene Model §2).
// It never reads `window.ProjectModel`, `currentProject`, selection
// state, or any other Builder-only global, so it can be called from
// Working View, Runtime Preview, a Scene Library thumbnail, or (in a
// future integration outside this Builder-only implementation phase) a
// genuine reader-facing Runtime, with zero code change — the same
// engine, not a Builder-flavored approximation of one.
//
// What this module does NOT draw, on purpose: Safe Area guides,
// selection outlines, and resize handles are Builder-only authoring
// affordances (Blueprint §7, Engine Canon §5 step 5 — `editable`/
// `moveable`/`clickable` are editing-surface concerns a published
// render never shows). Those are layered on top by the host
// (`tools/world-builder/js/worldBuilderApp.js`) after calling `render`,
// never inside this module.
const EngineV2Runtime = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // load — Engine Canon §5 pipeline steps 1-3: resolve the active
    // Scene's Canvas frame and its Scene Stack. Returns a plain object
    // describing the paint-ready graph; never mutates the Scene.
    // ---------------------------------------------------------------
    function load(scene, resolveFrame) {
        if (!scene || !scene.canvas) {
            throw new Error('EngineV2Runtime.load requires a Scene with a canvas (Engine Canon §4 — a Scene without a Canvas is not a Scene)');
        }
        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);
        const holders = scene.holders || [];
        const layers = scene.layers || [];
        const stack = (scene.stack || []).map(function (entry) {
            if (entry.type === 'holder') {
                const holder = holders.filter(function (h) { return h.id === entry.id; })[0];
                return holder ? { type: 'holder', object: holder } : null;
            }
            const layer = layers.filter(function (l) { return l.id === entry.id; })[0];
            return layer ? { type: 'layer', object: layer } : null;
        }).filter(function (entry) { return entry !== null; });

        return {
            scene: scene,
            width: aspect.width,
            height: aspect.height,
            aspect: aspect,
            stack: stack,
            resolveFrame: typeof resolveFrame === 'function' ? resolveFrame : function () { return null; }
        };
    }

    // A fractional {position, size} (0..1, relative to the Canvas frame
    // — Scene Model §2's own rule for every Holder and Scene Layer) in
    // pixel terms, for whichever canvas size this graph resolved to.
    function rectFor(object, graph) {
        return {
            x: object.position.x * graph.width,
            y: object.position.y * graph.height,
            w: object.size.w * graph.width,
            h: object.size.h * graph.height
        };
    }

    // ---------------------------------------------------------------
    // render — Engine Canon §5 pipeline step 4: paint the Scene Stack
    // bottom to top. `visible` is the only Base Object property that
    // gates output (Engine Invariant 22); `editable`/`moveable`/
    // `clickable` are never read here.
    // ---------------------------------------------------------------
    function render(ctx, graph) {
        const w = graph.width, h = graph.height;
        ctx.clearRect(0, 0, w, h);
        // The Scene's own default backdrop — what a genuinely empty
        // Canvas (no fill Layer at all) paints as. A Scene with a
        // background fill Layer (the common case, `setSceneBackground`)
        // paints over this entirely; nothing about this backdrop is
        // itself "the background" (Engine Invariant 8 — Canvas has no
        // background property).
        ctx.fillStyle = '#F4F1EC';
        ctx.fillRect(0, 0, w, h);

        graph.stack.forEach(function (entry) {
            if (entry.type === 'holder') _paintHolder(ctx, entry.object, graph);
            else _paintLayer(ctx, entry.object, graph);
        });
    }

    function _roundedRectPath(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // A Holder's Shape (Engine Canon §6) is a clip/mask, unrelated to a
    // "Shape" Element a Theme Author might place as a decoration.
    function _shapePath(ctx, x, y, w, h, shape) {
        ctx.beginPath();
        if (shape === 'circle') {
            const r = Math.min(w, h) / 2;
            ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
        } else if (shape === 'rounded') {
            _roundedRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.08);
        } else {
            ctx.rect(x, y, w, h);
        }
    }

    // Paints a Holder: its internal Holder Stack (today: Engine-level
    // placeholder chrome only — no Holder Layers/Content Layer are yet
    // separately authored in Builder V2, Scene Model §7 open item 1),
    // clipped to Shape, resolved per Frame (if one is placed — Scene
    // Model §2's one cross-reference). An empty, not-yet-filled Holder
    // showing placeholder chrome is itself an Engine-level rule (Engine
    // Canon §6: "shows Engine-level placeholder chrome... which is
    // Engine UI, not a Theme Asset"), not a Builder-only stand-in.
    function _paintHolder(ctx, holder, graph) {
        if (holder.permissions && holder.permissions.visible === false) return;
        const rect = rectFor(holder, graph);
        const fields = holder.frame ? (graph.resolveFrame(holder.frame) || {}) : null;
        const borderColor = (fields && fields.borderColor) || '#C9B79C';
        const thickness = fields && typeof fields.frameThickness === 'number' ? fields.frameThickness : 4;

        ctx.save();
        _shapePath(ctx, rect.x, rect.y, rect.w, rect.h, holder.shape);
        ctx.fillStyle = '#E4DCCB';
        ctx.fill();
        if (thickness > 0) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = Math.max(2, graph.width * 0.001 * thickness);
            ctx.stroke();
        }
        ctx.clip();
        ctx.fillStyle = '#9C8B6E';
        ctx.font = Math.round(Math.min(rect.w, rect.h) * 0.3) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🖼️', rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.restore();
    }

    // Top-down word wrap for a text Element's own bounding box — starts
    // at the box's own top edge (`textBaseline='top'`), unlike a
    // vertically-centered message (that's a Builder-only Scenes-Library
    // empty-state concern, out of this module's scope entirely).
    function _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = (text || '').split(' ');
        let line = '';
        let cy = y;
        words.forEach(function (word) {
            const test = line + word + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line.trim(), x, cy);
                line = word + ' ';
                cy += lineHeight;
            } else {
                line = test;
            }
        });
        ctx.fillText(line.trim(), x, cy);
    }

    // Paints a Scene Layer — a Decoration (`kind: 'fill' | 'decoration'`)
    // or Text (`kind: 'text'`), Scene Model §2's own vocabulary.
    function _paintLayer(ctx, layer, graph) {
        if (layer.permissions && layer.permissions.visible === false) return;
        const rect = rectFor(layer, graph);

        if (layer.kind === 'fill') {
            ctx.fillStyle = layer.color;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        } else if (layer.kind === 'text') {
            ctx.save();
            ctx.fillStyle = layer.color || '#1D3457';
            ctx.font = (layer.fontSize || 48) + 'px ' + (layer.font || 'Georgia, serif');
            ctx.textAlign = layer.align || 'left';
            ctx.textBaseline = 'top';
            const tx = layer.align === 'center' ? rect.x + rect.w / 2 : (layer.align === 'right' ? rect.x + rect.w : rect.x);
            _drawWrappedText(ctx, layer.text || '', tx, rect.y, rect.w, (layer.fontSize || 48) * 1.25);
            ctx.restore();
        } else {
            ctx.save();
            ctx.font = Math.round(Math.min(rect.w, rect.h)) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(layer.glyph, rect.x + rect.w / 2, rect.y + rect.h / 2);
            ctx.restore();
        }
    }

    return {
        load: load,
        render: render,
        rectFor: rectFor
    };
})();

if (typeof window !== 'undefined') window.EngineV2Runtime = EngineV2Runtime;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineV2Runtime;
