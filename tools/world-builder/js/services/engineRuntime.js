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
    // `representativeImage` (EV-002) — an optional, already-loaded
    // `Image`, standing in for the not-yet-authored Primary Element
    // (Scene Model §7 open item 1) inside an empty Holder. Like
    // `resolveFrame`, this is the caller's own concern to resolve (the
    // World's own authored Hero Image/Thumbnail, `worldBuilderApp.js`'s
    // `_representativeArtworkImage`) — this module only ever draws
    // whatever `Image` it's handed, or falls back to Engine-level
    // placeholder chrome when none is given.
    //
    // `resolveLayerImage` (Builder V3 MEP, Decoration Image support) —
    // an optional callback, `function(dataURI) -> Image|null`, the same
    // "caller resolves, module only draws" shape as `resolveFrame`: a
    // Scene Layer's `image` field is just a data URI string in the Scene
    // Model (Engine Canon §7 — no new field type), and *loading* that
    // string into a real, paintable `Image` (necessarily asynchronous)
    // is the host's concern (`worldBuilderApp.js`'s own image cache),
    // never this module's — this keeps `_paintLayer` synchronous and
    // this module free of any redraw-triggering side effect.
    function load(scene, resolveFrame, representativeImage, resolveLayerImage) {
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
            resolveFrame: typeof resolveFrame === 'function' ? resolveFrame : function () { return null; },
            representativeImage: representativeImage || null,
            resolveLayerImage: typeof resolveLayerImage === 'function' ? resolveLayerImage : function () { return null; }
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
    // The Holder's own Frame-band geometry, shared by the actual paint
    // routine below and by `holderBands` (the read-only query Builder-
    // only Working View overlays use, AV-004) — one source of truth for
    // "where does each band sit," so an authoring guide can never drift
    // from what was actually painted.
    function _holderInsets(holder, fields, graph) {
        const thicknessPx = Math.max(0, fields && typeof fields.frameThickness === 'number' ? fields.frameThickness : 4) * graph.width * 0.001;
        const marginPx = Math.max(0, ((fields && fields.defaultMargin) || 0) + ((fields && fields.inset) || 0)) * graph.width * 0.001;
        const matPx = Math.max(0, (fields && fields.matWidth) || 0) * graph.width * 0.001;
        const paddingPx = Math.max(0, (holder.padding || 0) * graph.width * 0.001);
        return {
            thicknessPx: thicknessPx,
            marginPx: marginPx,
            matPx: matPx,
            paddingPx: paddingPx,
            borderInset: marginPx,
            matInset: marginPx + thicknessPx,
            contentInset: marginPx + thicknessPx + matPx + paddingPx
        };
    }

    function _paintHolder(ctx, holder, graph) {
        if (holder.permissions && holder.permissions.visible === false) return;
        const rect = rectFor(holder, graph);
        // `resolveFrame` resolves a Frame *id* to its fields — the
        // caller passes `holder.frame` (the id), matching the resolver's
        // own contract (`worldBuilderApp.js`'s `_holderFrameFields`).
        const fields = holder.frame ? (graph.resolveFrame(holder.frame) || {}) : null;
        const borderColor = (fields && fields.borderColor) || '#C9B79C';
        const wallTone = fields && fields.wallTone;
        const insets = _holderInsets(holder, fields, graph);
        const thicknessPx = insets.thicknessPx, marginPx = insets.marginPx, matPx = insets.matPx;
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
        if (thicknessPx > 0) _band(insets.borderInset, borderColor);

        // Mat band, inset by the border's own thickness — a fixed,
        // neutral mat-board tone regardless of wallTone (traditionally
        // white/cream regardless of the wall behind the frame).
        if (matPx > 0) _band(insets.matInset, '#F5F2EA');

        // Content band — the Holder's own Padding (Engine Canon §6:
        // "inset between the Holder's edge and its content"), applied
        // after the Frame's own mat, so the two compose rather than
        // overriding each other.
        const contentRect = _band(insets.contentInset, matPx > 0 ? '#F5F2EA' : '#E4DCCB');
        const cx = contentRect.x, cy = contentRect.y, cw = contentRect.w, chgt = contentRect.h;

        // Fit — how the Primary Element resolves against the Holder's
        // own content bounds (Engine Canon §6): 'fit' (contain) sizes it
        // to sit fully inside the content rect, 'fill' (cover) sizes it
        // to cover the whole content rect and crops the overflow,
        // 'original' renders it at native size — the same vocabulary the
        // existing Engine V1 image viewer already draws for a real
        // photo. Since no Primary Element is separately authored yet
        // (Scene Model §7 open item 1), a Theme's own representative
        // artwork (EV-002 — the World's authored Hero Image/Thumbnail,
        // resolved by the caller and handed in as `graph.
        // representativeImage`) stands in for it when available, clipped
        // to the content rect so 'fill' genuinely crops rather than
        // merely growing a centered icon; the emoji glyph remains the
        // fallback only when no artwork has been authored at all.
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, cw, chgt);
        ctx.clip();
        if (graph.representativeImage) {
            _drawImageWithFit(ctx, graph.representativeImage, { x: cx, y: cy, w: cw, h: chgt }, holder.fit);
        } else {
            // AV-007 — 'fill' must actually overflow the content rect
            // (previously 0.55 of it, i.e. always smaller, so it could
            // never crop against the clip above and read as barely
            // different from 'fit'); 'original' stays a fixed size.
            let glyphSize;
            if (holder.fit === 'fill') {
                glyphSize = Math.min(cw, chgt) * 1.4;
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
        }
        ctx.restore();
        ctx.restore();
    }

    // AV-007/EV-002 — object-fit-style scaling for a real representative
    // image: 'fit' contains (letterboxed, no crop), 'fill' covers (crops
    // overflow at the caller's own clip), 'original' draws at native
    // pixel size. Pure geometry, no Scene Model/Engine V2 pipeline change
    // — just how a Holder's content resolves an image it's handed.
    function _drawImageWithFit(ctx, img, rect, fit) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;
        let dw, dh;
        if (fit === 'original') {
            dw = iw;
            dh = ih;
        } else {
            const scale = fit === 'fill'
                ? Math.max(rect.w / iw, rect.h / ih)
                : Math.min(rect.w / iw, rect.h / ih);
            dw = iw * scale;
            dh = ih * scale;
        }
        const dx = rect.x + (rect.w - dw) / 2;
        const dy = rect.y + (rect.h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    // AV-004 — a read-only query, never a draw call: returns the exact
    // band rects `_paintHolder` just painted (outer Holder edge / wall
    // margin's inner edge / frame border's inner edge / mat's inner
    // edge, i.e. the content rect), plus which optional bands are
    // actually present. This is what lets Working View draw Builder-
    // only authoring guide lines at the Holder's *real* boundaries
    // without a second, independently-derived geometry — the "no
    // second renderer" constraint applies to guides too, not just
    // pixels: a guide computed from different math than the paint
    // routine could silently drift out of sync with what's actually
    // drawn.
    function holderBands(holder, graph) {
        const rect = rectFor(holder, graph);
        const fields = holder.frame ? (graph.resolveFrame(holder.frame) || {}) : null;
        const insets = _holderInsets(holder, fields, graph);
        function rectAt(insetPx) {
            return {
                x: rect.x + insetPx, y: rect.y + insetPx,
                w: Math.max(0, rect.w - insetPx * 2), h: Math.max(0, rect.h - insetPx * 2)
            };
        }
        return {
            outer: rectAt(0),
            border: rectAt(insets.borderInset),
            mat: rectAt(insets.matInset),
            content: rectAt(insets.contentInset),
            hasWall: insets.marginPx > 0,
            hasFrame: insets.thicknessPx > 0,
            hasMat: insets.matPx > 0,
            hasPadding: insets.paddingPx > 0
        };
    }

    // Line-wrap measurement shared by _drawWrappedText (paint) and
    // textFootprint (query, AV-006) — extracted so painting and
    // measuring can never diverge, the same one-source-of-truth pattern
    // AV-004's _holderInsets/holderBands already established.
    function _wrapLines(ctx, text, maxWidth) {
        const words = (text || '').split(' ');
        const lines = [];
        let line = '';
        words.forEach(function (word) {
            const test = line + word + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line.trim());
                line = word + ' ';
            } else {
                line = test;
            }
        });
        lines.push(line.trim());
        return lines;
    }

    // Top-down word wrap for a text Element's own bounding box — starts
    // at the box's own top edge (`textBaseline='top'`), unlike a
    // vertically-centered message (that's a Builder-only Scenes-Library
    // empty-state concern, out of this module's scope entirely).
    function _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        _wrapLines(ctx, text, maxWidth).forEach(function (line, i) {
            ctx.fillText(line, x, y + i * lineHeight);
        });
    }

    // AV-006/AV-010 — a text Layer's declared position/size box is only
    // ever a wrap-width and a creation-time placeholder height (Scene
    // Model §3 gives every Layer a generic fractional rect, but unlike a
    // Holder or Decoration — whose rect literally is what gets drawn —
    // a text Layer's actual rendered extent depends on its own content,
    // completely decoupled from that declared box once real words are
    // typed). Builder-side hit-testing/dragging clamped against the
    // declared box produced a real, invisible movement barrier whenever
    // the rendered text was smaller than the box in either dimension (a
    // real authoring bug, not a rendering one — Runtime output is
    // unaffected). AV-006 fixed height; AV-010 fixes width the same
    // way — measuring the widest wrapped line (never wider than the
    // declared wrap width, since that's still the wrap boundary) and
    // offsetting by `align` exactly as `_paintLayer` does, so a short
    // line of centred/right-aligned text reports the true glyph
    // position, not the declared box's own left edge. This is a pure,
    // read-only measurement of what _paintLayer actually renders, reusing
    // _wrapLines so it can never drift from the real paint. Only an
    // explicit fixed-width text container (not a capability this Builder
    // has built yet) would need to keep the declared box's own width —
    // by default every text Layer auto-sizes to its content.
    function textFootprint(ctx, layer, graph) {
        const rect = rectFor(layer, graph);
        ctx.save();
        ctx.font = (layer.fontSize || 48) + 'px ' + (layer.font || 'Georgia, serif');
        const lineHeight = (layer.fontSize || 48) * 1.25;
        const lines = _wrapLines(ctx, layer.text || '', rect.w);
        let maxLineWidth = 0;
        lines.forEach(function (line) {
            const lw = ctx.measureText(line).width;
            if (lw > maxLineWidth) maxLineWidth = lw;
        });
        ctx.restore();
        const h = Math.max(lineHeight, lines.length * lineHeight);
        const w = Math.min(rect.w, Math.max(1, maxLineWidth));
        const align = layer.align || 'left';
        const x = align === 'center' ? rect.x + (rect.w - w) / 2
            : align === 'right' ? rect.x + rect.w - w
            : rect.x;
        return {
            x: x,
            y: rect.y,
            w: w,
            h: Math.min(h, graph.height - rect.y)
        };
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
            // Decoration — Image and Glyph are both simply optional
            // properties on the same Layer (Builder V3 MEP), never
            // mutually exclusive in the model; a real, loaded Image
            // (resolved by the host, never this module — see `load`'s
            // `resolveLayerImage`) is preferred when available, falling
            // back to the existing glyph rendering otherwise.
            const img = layer.image ? graph.resolveLayerImage(layer.image) : null;
            if (img) {
                ctx.save();
                _drawImageWithFit(ctx, img, rect, 'fit');
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
    }

    return {
        load: load,
        render: render,
        rectFor: rectFor,
        holderBands: holderBands,
        textFootprint: textFootprint
    };
})();

if (typeof window !== 'undefined') window.EngineV2Runtime = EngineV2Runtime;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineV2Runtime;
