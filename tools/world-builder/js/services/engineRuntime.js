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
    // `radiusOverride` lets a Frame's own `cornerRadius` field (below)
    // control rounding directly, distinct from the Holder's own fixed
    // 8%-of-min-dimension 'rounded' Shape default.
    function _shapePath(ctx, x, y, w, h, shape, radiusOverride) {
        ctx.beginPath();
        if (shape === 'circle') {
            const r = Math.min(w, h) / 2;
            ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
        } else if (typeof radiusOverride === 'number' && radiusOverride > 0 && shape !== 'circle') {
            _roundedRectPath(ctx, x, y, w, h, Math.min(radiusOverride, Math.min(w, h) / 2));
        } else if (shape === 'rounded') {
            _roundedRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.08);
        } else {
            ctx.rect(x, y, w, h);
        }
    }

    // A Frame Theme Asset's Shadow presets (Frames screen's own "Shadow"
    // field) — none/soft/floating/gallery, each a concrete blur/offset
    // pair rather than a single hardcoded look.
    const SHADOW_PRESETS = {
        none: null,
        soft: { blur: 8, offsetY: 2, color: 'rgba(0,0,0,0.18)' },
        floating: { blur: 20, offsetY: 8, color: 'rgba(0,0,0,0.28)' },
        gallery: { blur: 30, offsetY: 10, color: 'rgba(0,0,0,0.35)' }
    };

    // Paints a Holder: its internal Holder Stack (today: Engine-level
    // placeholder chrome only — no Holder Layers/Content Layer are yet
    // separately authored in Builder V2, Scene Model §7 open item 1),
    // clipped to Shape, resolved per Frame (if one is placed — Scene
    // Model §2's one cross-reference), inset by Padding, and resolved
    // per Fit (Engine Canon §6: Position/Size/Shape/Padding/Fit are all
    // Theme Author controls on a Holder). An empty, not-yet-filled
    // Holder showing placeholder chrome is itself an Engine-level rule
    // (Engine Canon §6: "shows Engine-level placeholder chrome...
    // which is Engine UI, not a Theme Asset"), not a Builder-only
    // stand-in.
    //
    // AV-003 — every field the Frames screen actually authors
    // (`js/worldBuilderApp.js`'s `_renderFramesPanel`: wallTone,
    // borderColor, cornerRadius, shadow, inset, matWidth, defaultMargin,
    // frameThickness) is consumed here now. Before this pass, only
    // `borderColor`/`frameThickness` were ever read — every other field
    // persisted correctly (Frames screen → `ProjectModel.setFrameFieldValue`)
    // but had literally no code path into either rendering surface, the
    // "common point where the Frame model stops influencing rendering"
    // the ticket asked to find: this function, not any one property's
    // own handler. Bands, outside in, mirror a real museum frame's
    // cross-section: wall margin (defaultMargin+inset, wallTone) → frame
    // border (frameThickness, borderColor, cornerRadius) → mat
    // (matWidth) → content (Holder's own padding, then Fit).
    function _paintHolder(ctx, holder, graph) {
        if (holder.permissions && holder.permissions.visible === false) return;
        const rect = rectFor(holder, graph);
        // `resolveFrame` resolves a Frame *id* to its fields — the
        // caller passes `holder.frame` (the id), matching the resolver's
        // own contract (`worldBuilderApp.js`'s `_holderFrameFields`).
        const fields = holder.frame ? (graph.resolveFrame(holder.frame) || {}) : null;
        const borderColor = (fields && fields.borderColor) || '#C9B79C';
        const thicknessPx = Math.max(0, fields && typeof fields.frameThickness === 'number' ? fields.frameThickness : 4) * graph.width * 0.001;
        const wallTone = fields && fields.wallTone;
        const marginPx = Math.max(0, ((fields && fields.defaultMargin) || 0) + ((fields && fields.inset) || 0)) * graph.width * 0.001;
        const matPx = Math.max(0, (fields && fields.matWidth) || 0) * graph.width * 0.001;
        const cornerRadiusPx = fields && typeof fields.cornerRadius === 'number' ? Math.max(0, fields.cornerRadius) * graph.width * 0.001 : 0;
        const shadowPreset = SHADOW_PRESETS[(fields && fields.shadow) || 'none'];

        // Each band below is a concentric *filled* shape, outside in —
        // never a centered stroke, which would need error-prone
        // half-thickness bookkeeping to line up flush against its
        // neighbors. `_band` insets the Holder's own rect by a running
        // total and shrinks the corner radius by the same amount, so
        // every band's outer edge exactly meets the previous band's
        // inner edge with no gap and no overlap.
        function _band(insetPx, color) {
            const x = rect.x + insetPx, y = rect.y + insetPx;
            const w = Math.max(0, rect.w - insetPx * 2), h = Math.max(0, rect.h - insetPx * 2);
            const r = Math.max(0, cornerRadiusPx - insetPx);
            _shapePath(ctx, x, y, w, h, holder.shape, r);
            ctx.fillStyle = color;
            ctx.fill();
            return { x: x, y: y, w: w, h: h };
        }

        // Outermost band: the wall margin (defaultMargin + inset,
        // wallTone) — this is also where Shadow is cast, since a
        // shadow belongs to the whole framed object, not just its
        // border. Drawn once, separately, so the shadow doesn't also
        // apply to every band stacked on top of it.
        ctx.save();
        if (shadowPreset) {
            ctx.shadowColor = shadowPreset.color;
            ctx.shadowBlur = shadowPreset.blur;
            ctx.shadowOffsetY = shadowPreset.offsetY;
        }
        _band(0, (marginPx > 0 && wallTone) ? wallTone : '#E4DCCB');
        ctx.restore(); // shadow must not leak into the bands drawn below

        ctx.save();
        _shapePath(ctx, rect.x, rect.y, rect.w, rect.h, holder.shape, cornerRadiusPx);
        ctx.clip();

        // Frame border band, inset by the wall margin.
        if (thicknessPx > 0) _band(marginPx, borderColor);

        // Mat band, inset by the border's own thickness — a fixed,
        // neutral mat-board tone regardless of wallTone (traditionally
        // white/cream regardless of the wall behind the frame).
        if (matPx > 0) _band(marginPx + thicknessPx, '#F5F2EA');

        // Content band — the Holder's own Padding (Engine Canon §6:
        // "inset between the Holder's edge and its content"), applied
        // after the Frame's own mat, so the two compose rather than
        // overriding each other.
        const paddingPx = Math.max(0, (holder.padding || 0) * graph.width * 0.001);
        const contentRect = _band(marginPx + thicknessPx + matPx + paddingPx, matPx > 0 ? '#F5F2EA' : '#E4DCCB');
        const cx = contentRect.x, cy = contentRect.y, cw = contentRect.w, chgt = contentRect.h;

        // Fit — how the (placeholder standing in for the) Primary
        // Element resolves against the Holder's own bounds (Engine
        // Canon §6): 'fit' sizes it to sit fully inside the content
        // rect (today's long-standing default), 'fill' sizes it larger
        // so it visibly overflows/crops at the Shape clip, 'original'
        // renders it at a fixed size independent of the Holder's own
        // dimensions — the same three-way distinction the existing
        // Engine V1 image viewer already draws for a real photo,
        // applied here to the placeholder since no Primary Element is
        // authored yet (Scene Model §7 open item 1).
        let glyphSize;
        if (holder.fit === 'fill') {
            glyphSize = Math.min(cw, chgt) * 0.55;
        } else if (holder.fit === 'original') {
            glyphSize = 64;
        } else {
            glyphSize = Math.min(cw, chgt) * 0.3;
        }
        ctx.fillStyle = '#9C8B6E';
        ctx.font = Math.round(Math.max(0, glyphSize)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🖼️', cx + cw / 2, cy + chgt / 2);
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
