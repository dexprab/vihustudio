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

    // A Layer converges to `target:'slide'` (drawn first/behind every
    // Place) at compile time exactly when it's explicitly Scene-hosted,
    // or is a true full-bleed Colour fill — tools/world-builder-v2/js/
    // services/builder.js's convergeSceneLayer's own `target` computation,
    // mirrored here byte-for-byte so this module and the compile step can
    // never silently disagree about which Layers are "background."
    function _isBackgroundLayer(layer) {
        const size = layer.size || { w: 0, h: 0 };
        const isFullBleed = (size.w || 0) >= 0.98 && (size.h || 0) >= 0.98;
        return layer.hostedByScene === true || (layer.kind === 'fill' && isFullBleed);
    }

    // ---------------------------------------------------------------
    // render — Engine Canon §5 pipeline step 4: paint the Scene Stack
    // bottom to top. `visible` is the only Base Object property that
    // gates output (Engine Invariant 22); `editable`/`moveable`/
    // `clickable` are never read here.
    //
    // Creator Governing Rule #1 (Fidelity) — a real, confirmed bug found
    // tracing a user-reported "Studio shows a blank canvas" report all
    // the way to a real .vtheme file: this function used to paint
    // `graph.stack` in exact raw authored order with no regard for the
    // z-order bucketing convergeSceneLayer (above) actually applies at
    // compile time. A Theme Author who positions a Free-hosted "cover
    // background" image at the very bottom of their Scene Stack — the
    // natural way to intend something as a background — sees it render
    // correctly, behind everything, right here in Working View/Runtime
    // Preview, since this function simply drew the stack in its own
    // order with no bucketing of any kind. But at compile time, ONLY
    // Scene-hosted (or full-bleed-fill) Layers converge onto
    // `target:'slide'` (drawn first); every other Layer — including that
    // same Free-hosted "background" image — converges onto
    // `target:'overlay'` (drawn dead LAST, on top of literally
    // everything), regardless of where it actually sat in the authored
    // Stack. The Theme Author never saw any signal in Builder that this
    // divergence was coming — Working View lied about what would
    // actually get Published. Bucketing this function's own paint order
    // to match `convergeSceneLayer` exactly — background Layers first,
    // then Places (their own relative order among themselves unchanged),
    // then every remaining Layer — makes Working View/Runtime Preview a
    // truthful proxy for the real compiled output, matching AV-004/
    // AV-005's own "Runtime Preview is frozen — always exactly the
    // published reader output" principle. This reorders PAINT ONLY, via
    // a local array built fresh on every call — `graph.stack` itself is
    // never mutated, so hit-testing (worldBuilderApp.js's own mousedown
    // handler, which reads `ProjectModel.sceneStack` directly, a
    // completely separate source built from the live Project, not this
    // graph) is unaffected.
    // ---------------------------------------------------------------
    // Real, user-requested "set the background colour as transparent" —
    // `js/projectModel.js`'s `setSceneBackground` (the Scene-hosted
    // Colour Experience's own mechanism, Blueprint §9) is an ordinary
    // full-bleed fill Layer pinned to the Stack's own bottom, exactly
    // like every other Layer (Engine Invariant 8 — Canvas has no
    // background property of its own). Whenever one exists, it IS the
    // Scene's deliberate background — regardless of its own opacity —
    // so the fallback backdrop below must never paint underneath it,
    // even when the Layer itself is fully transparent (opacity 0): only
    // then does "transparent" actually mean see-through rather than a
    // hardcoded cream fill quietly showing through the gaps.
    function _hasExplicitBottomFill(graph) {
        const bottom = graph.stack[0];
        if (!bottom || bottom.type !== 'layer' || bottom.object.kind !== 'fill') return false;
        const size = bottom.object.size || { w: 0, h: 0 };
        return (size.w || 0) >= 0.98 && (size.h || 0) >= 0.98;
    }

    function render(ctx, graph) {
        const w = graph.width, h = graph.height;
        ctx.clearRect(0, 0, w, h);
        // The Scene's own default backdrop — what a genuinely empty
        // Canvas (no fill Layer at all) paints as. A Scene with a
        // background fill Layer (the common case, `setSceneBackground`)
        // paints over this entirely; nothing about this backdrop is
        // itself "the background" (Engine Invariant 8 — Canvas has no
        // background property). Skipped outright when an explicit
        // full-bleed background Layer already exists (any opacity,
        // including fully transparent) — see `_hasExplicitBottomFill`'s
        // own comment. A Scene that has never touched Colour at all is
        // completely unaffected; this only ever engages once an author
        // deliberately authors a Scene background.
        if (!_hasExplicitBottomFill(graph)) {
            ctx.fillStyle = '#F4F1EC';
            ctx.fillRect(0, 0, w, h);
        }

        // "Extend Experiences to Places" — a Layer tagged `hostPlaceId`
        // (js/projectModel.js's `_syncPartLayer`) is anchored to one
        // specific Place, not the whole Scene/canvas — a completely
        // different axis from the slide/overlay z-order bucketing
        // below, so it must never enter that split at all. It paints
        // alongside its own Holder instead, immediately after that
        // Holder's own chrome, inside the `middle` loop — grouped here
        // by which Holder id it names.
        const placeLayersById = {};
        const before = [], middle = [], after = [];
        graph.stack.forEach(function (entry) {
            if (entry.type === 'holder') { middle.push(entry); return; }
            if (entry.object.hostPlaceId) {
                const list = placeLayersById[entry.object.hostPlaceId] || (placeLayersById[entry.object.hostPlaceId] = []);
                list.push(entry);
                return;
            }
            (_isBackgroundLayer(entry.object) ? before : after).push(entry);
        });

        before.forEach(function (entry) { _paintLayer(ctx, entry.object, graph); });
        middle.forEach(function (entry) {
            const holder = entry.object;
            // Whole-Place rotation (Theme-Author-authored `holder.rotation`,
            // degrees clockwise around the Place's own centre) applies as a
            // ctx transform to the entire Place-paint unit — the Place's
            // own chrome (_paintHolder) AND every Place-hosted Layer
            // anchored to it — so a rotated Frame's mat/border/ornament and
            // every decoration/text riding along with it all pivot together
            // as one unit, never independently. Story-Author-side rotation
            // (gated on `rotatable`, written via SceneEngine.setContentOverride
            // in root Studio's Selection Action Strip) is layered on top of
            // this same base via a matching wrap in the render caller once
            // that half ships; for Builder's own preview this branch always
            // sees the Theme-Author's authored value directly.
            const rotDeg = (typeof holder.rotation === 'number') ? holder.rotation : 0;
            const rect = rectFor(holder, graph);
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            if (rotDeg) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotDeg * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }
            _paintHolder(ctx, holder, graph);
            // A Place-hosted Layer never paints past a hidden Place —
            // content anchored to something not itself shown has
            // nothing to anchor to.
            if (!(holder.permissions && holder.permissions.visible === false)) {
                const placeLayers = placeLayersById[holder.id] || [];
                placeLayers.forEach(function (layerEntry) {
                    _paintLayerAtPlace(ctx, layerEntry.object, holder, graph);
                });
            }
            if (rotDeg) ctx.restore();
        });
        after.forEach(function (entry) { _paintLayer(ctx, entry.object, graph); });
    }

    // Paints a `hostPlaceId`-tagged Layer inside its own Holder's
    // CURRENT rect — resolved fresh from the Holder's live geometry on
    // every call (never a copied/stale snapshot, so a moved/resized
    // Place is never a source of staleness for what's anchored to it).
    // The Layer's own fractional position/size are unchanged fields
    // (`_syncPartLayer` never forces them to a full-bleed {0,0,1,1} —
    // they stay real, independently editable Transform values exactly
    // like a Scene/Free-hosted part's own) but are now interpreted
    // relative to the Place's own rect rather than the Canvas: a
    // translated ctx plus a small scoped sub-graph (own width/height =
    // the Place's own pixel size) means every existing, unmodified
    // interior calculation — rectFor, textFootprint, rotation pivots,
    // shape geometry — keeps working exactly as it already does for a
    // Scene/Free-hosted Layer, just inside the Place's own local
    // coordinate space instead of the whole Canvas's.
    function _paintLayerAtPlace(ctx, layer, holder, graph) {
        const placeRect = rectFor(holder, graph);
        if (placeRect.w <= 0 || placeRect.h <= 0) return;
        const placeGraph = {
            width: placeRect.w,
            height: placeRect.h,
            resolveLayerImage: graph.resolveLayerImage
        };
        ctx.save();
        ctx.translate(placeRect.x, placeRect.y);
        _paintLayer(ctx, layer, placeGraph);
        ctx.restore();
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

    // Simplify Place & Frame Authoring — "Mat Surface"'s own chosen
    // value (`fields.background`) has always been silently ignored by
    // the mat band below, which painted one universal flat '#F5F2EA'
    // regardless. Mirrors root Studio's own real Reader-facing
    // ARTWORK_BACKGROUND_FILL table exactly (renderer/slideRenderer.js)
    // so Builder's preview and the compiled/Published Theme finally
    // agree on what each Mat Surface choice actually looks like.
    // 'transparent'/'color'/'image' are resolved separately in
    // `_paintHolder` itself, never through this flat lookup.
    const MAT_MATERIAL_FILL = {
        white: '#ffffff', cream: '#F7F1E3', 'kraft-paper': '#C9A66B',
        'watercolor-paper': '#F5F0E6', 'notebook-paper': '#F4F6FA',
        black: '#000000', 'bulletin-board': '#C9A876'
    };

    // Mirrors root Studio's own real ARTWORK_FRAME_PRESET's own
    // cornerRadius column exactly, so "Frame Style" visibly changes
    // Builder's own preview the same way it already changes a
    // Published Theme's real render. Corner Radius's own raw-number
    // control is removed from the Frames screen (§4) — corner rounding
    // is now always DERIVED from the chosen Frame Style, matching what
    // Studio's Reader-facing renderer has always actually done, never a
    // second, independent dial a Theme Author could set inconsistently.
    const FRAME_ORNAMENT_PRESET = {
        'none': { cornerRadius: 0 },
        'white-mat': { cornerRadius: 0 },
        'floating': { cornerRadius: 8 },
        'wood': { cornerRadius: 6 },
        'polaroid': { cornerRadius: 0 },
        'tape': { cornerRadius: 0 },
        'bulletin-board': { cornerRadius: 0 },
        // Bug 4 (BACKLOG.md) -- Frame Style = Image: the ornament is a
        // Story-Author-authored picture drawn as an overlay onto the
        // frame's own outer border band. No inherent corner rounding of
        // its own (0), so a hard rectangular image reads as authored;
        // a rounded picture is achieved via the image itself, not this
        // preset.
        'image': { cornerRadius: 0 }
    };

    // A small, purely-additive, decoration-only distinguishing cue per
    // Frame Style — corner radius alone leaves 5 of 7 values visually
    // identical, so a Theme Author picking "Wood" or "Tape" from the
    // relabeled Frame Style dropdown sees *something* actually change,
    // not just a control that silently does nothing. Never changes
    // geometry/hit-testing — purely a few extra strokes/shapes layered
    // on top of the already-painted bands. `matRect` may be null when
    // no mat band was drawn (matPx===0); every cue degrades gracefully
    // in that case, falling back to the frame's own outer `rect`.
    function _paintFrameOrnament(ctx, rect, insets, fields, matRect, matIsTransparent, graph) {
        const style = (fields && fields.frame) || 'none';
        const isBulletinBoard = style === 'bulletin-board' || (fields && fields.background === 'bulletin-board');
        if (style === 'none' || style === 'white-mat') return; // confirmed visually identical to real Studio too — correct parity, not a gap.

        // Bug 4 -- Frame Style = Image: overlay a picture as the frame's
        // own ornament, drawn on the border band (rect between marginPx
        // and matInset). Rotated around that band's own centre, mirroring
        // the identical convention frameImage above and every other
        // Universal Content rotation control already uses. Resolved via
        // graph.resolveLayerImage exactly like frameImage does, so a
        // still-decoding image degrades to nothing rather than a broken
        // glyph. Isolated in its own save/restore/clip so no downstream
        // ornament draw can leak into it.
        if (style === 'image' && fields.frameOrnamentImage && graph && typeof graph.resolveLayerImage === 'function') {
            const ornImg = graph.resolveLayerImage(fields.frameOrnamentImage);
            if (ornImg) {
                // BACKLOG.md -- Frame style comes over the art: clip the
                // ornament picture to the frame BAND only (outer XOR
                // interior content rect via evenodd), never the interior
                // artwork region. Mirrors root Studio's _bandOnlyClip
                // helper and slideRenderer.js's _ornamentWooden's own
                // already-correct evenodd technique. `insets.marginPx`
                // is the wall-band boundary; `insets.contentInset` is
                // where interior artwork begins -- the band between
                // them is what an image ornament may legitimately paint.
                const ornRect = { x: rect.x + insets.marginPx, y: rect.y + insets.marginPx,
                                  w: Math.max(0, rect.w - insets.marginPx * 2), h: Math.max(0, rect.h - insets.marginPx * 2) };
                const innerRect = { x: rect.x + insets.contentInset, y: rect.y + insets.contentInset,
                                    w: Math.max(0, rect.w - insets.contentInset * 2), h: Math.max(0, rect.h - insets.contentInset * 2) };
                if (ornRect.w > 0 && ornRect.h > 0) {
                    const rot = fields.frameOrnamentImageRotation || 0;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(ornRect.x, ornRect.y, ornRect.w, ornRect.h);
                    if (innerRect.w > 0 && innerRect.h > 0) {
                        ctx.rect(innerRect.x, innerRect.y, innerRect.w, innerRect.h);
                    }
                    try { ctx.clip('evenodd'); } catch (e) { ctx.clip(); }
                    if (rot) {
                        const rcx = ornRect.x + ornRect.w / 2, rcy = ornRect.y + ornRect.h / 2;
                        ctx.translate(rcx, rcy);
                        ctx.rotate(rot * Math.PI / 180);
                        ctx.translate(-rcx, -rcy);
                    }
                    _drawImageWithFit(ctx, ornImg, ornRect, 'fill');
                    ctx.restore();
                }
            }
            return; // Image ornament stands on its own -- no other cue layers on top.
        }

        ctx.save();
        if (style === 'wood' && insets.thicknessPx > 0) {
            // 2-3 thin darker "grain" lines across the border band.
            const bx = rect.x + insets.borderInset, by = rect.y + insets.borderInset;
            const bw = Math.max(0, rect.w - insets.borderInset * 2);
            ctx.strokeStyle = 'rgba(60,35,15,0.35)';
            ctx.lineWidth = Math.max(1, insets.thicknessPx * 0.18);
            const lines = 3;
            for (let i = 1; i <= lines; i++) {
                const ly = by + (insets.thicknessPx * i) / (lines + 1);
                ctx.beginPath();
                ctx.moveTo(bx, ly);
                ctx.lineTo(bx + bw, ly);
                ctx.stroke();
            }
        } else if (style === 'polaroid' && matRect && !matIsTransparent) {
            // A single thin line near the bottom of the mat band — a
            // caption-baseline stand-in (a real Polaroid's own wide
            // bottom border is where a caption would be written).
            ctx.strokeStyle = 'rgba(0,0,0,0.20)';
            ctx.lineWidth = 1.5;
            const ly = matRect.y + matRect.h * 0.84;
            ctx.beginPath();
            ctx.moveTo(matRect.x + matRect.w * 0.12, ly);
            ctx.lineTo(matRect.x + matRect.w * 0.88, ly);
            ctx.stroke();
        } else if (style === 'tape') {
            // Two small semi-transparent tan rectangles at the top
            // corners, like real tape holding the picture down.
            const tw = Math.max(14, rect.w * 0.09), th = Math.max(10, tw * 0.55);
            ctx.fillStyle = 'rgba(214,196,150,0.55)';
            ctx.fillRect(rect.x + rect.w * 0.08, rect.y - th * 0.3, tw, th);
            ctx.fillRect(rect.x + rect.w * 0.92 - tw, rect.y - th * 0.3, tw, th);
        } else if (isBulletinBoard) {
            // 4 small dark dot "pins" near the mat's (or, absent a mat,
            // the frame's own) corners.
            const pr = matRect || rect;
            const dot = Math.max(2.5, rect.w * 0.006);
            const pad = dot * 2.2;
            ctx.fillStyle = 'rgba(40,30,20,0.55)';
            [
                [pr.x + pad, pr.y + pad], [pr.x + pr.w - pad, pr.y + pad],
                [pr.x + pad, pr.y + pr.h - pad], [pr.x + pr.w - pad, pr.y + pr.h - pad]
            ].forEach(function (p) {
                ctx.beginPath();
                ctx.arc(p[0], p[1], dot, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        ctx.restore();
    }

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
        // Simplify Place & Frame Authoring — Corner Radius's own raw
        // control is gone; radius is now always derived from the
        // chosen Frame Style, mirroring root Studio's real renderer.
        const ornamentCornerRadius = (FRAME_ORNAMENT_PRESET[(fields && fields.frame) || 'none'] || FRAME_ORNAMENT_PRESET.none).cornerRadius;
        const cornerRadiusPx = ornamentCornerRadius * graph.width * 0.001;
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

        // Simplify Place & Frame Authoring — "a place with no
        // customization... should be as good as transparent." Each of
        // the three colour fields now has its own Transparent flag; when
        // set, that band's fill is skipped entirely (a fully transparent
        // fillStyle, never a fallback opaque tone) rather than painting
        // something nobody asked for. Every check below defaults `false`
        // for any pre-existing Frame with no such flag ever authored
        // (`_ensureFrameFieldDefaults`), so this is a pure no-op for
        // backward compatibility.
        const wallTransparent = !!(fields && fields.wallToneTransparent);
        const borderTransparent = !!(fields && fields.borderColorTransparent);

        // Outermost band: the wall margin (defaultMargin + inset,
        // wallTone) — this is also where Shadow is cast, since a
        // shadow belongs to the whole framed object, not just its
        // border. Drawn once, separately, so the shadow doesn't also
        // apply to every band stacked on top of it.
        ctx.save();
        if (shadowPreset && !wallTransparent) {
            ctx.shadowColor = shadowPreset.color;
            ctx.shadowBlur = shadowPreset.blur;
            ctx.shadowOffsetY = shadowPreset.offsetY;
        }
        _band(0, wallTransparent ? 'rgba(0,0,0,0)' : ((marginPx > 0 && wallTone) ? wallTone : '#E4DCCB'));
        ctx.restore(); // shadow must not leak into the bands drawn below

        ctx.save();
        _shapePath(ctx, rect.x, rect.y, rect.w, rect.h, holder.shape, cornerRadiusPx);
        ctx.clip();

        // Frame border band, inset by the wall margin.
        if (thicknessPx > 0) _band(insets.borderInset, borderTransparent ? 'rgba(0,0,0,0)' : borderColor);

        // Mat band, inset by the border's own thickness. Simplify Place &
        // Frame Authoring — "Mat Surface"'s own chosen value now
        // actually resolves to a real colour (`MAT_MATERIAL_FILL`,
        // mirroring root Studio's real Reader-facing render exactly)
        // instead of a single hardcoded '#F5F2EA' every value used to
        // paint identically; 'color' resolves the new Solid Colour
        // swatch (`matColor`, itself Transparent-capable); 'transparent'
        // and matColorTransparent both skip the fill outright.
        //
        // Feature 1 — Image-typed Frame Variations. `fields.background`
        // also offers a genuine `'image'` option (Frames screen,
        // worldBuilderApp.js `_renderFramesPanel`); when set, and the
        // referenced `frameImage` resolves to a real, already-loaded
        // Image (`graph.resolveLayerImage`, the identical "host
        // resolves, this module only draws" cache/redraw pattern
        // Decoration images already use above), it's painted covering
        // ('fill') the exact same mat-band rect the flat colour fill
        // already computed — the flat fill still draws first (a
        // sensible base/fallback for a transparent-PNG source, and the
        // whole reason `_band` still runs unconditionally here), the
        // image simply layers on top when one is actually authored.
        const bg = fields && fields.background;
        let matFillColor = '#F5F2EA'; // unchanged legacy fallback -- unset/unrecognized background
        if (bg === 'color') {
            matFillColor = (fields.matColorTransparent) ? 'rgba(0,0,0,0)' : ((fields.matColor) || '#8B2C3B');
        } else if (bg === 'transparent') {
            matFillColor = 'rgba(0,0,0,0)';
        } else if (bg && MAT_MATERIAL_FILL[bg]) {
            matFillColor = MAT_MATERIAL_FILL[bg];
        }
        const matIsTransparent = matFillColor === 'rgba(0,0,0,0)';
        let matRect = null;
        if (matPx > 0) {
            matRect = _band(insets.matInset, matFillColor);
            if (bg === 'image' && fields.frameImage) {
                const bgImg = graph.resolveLayerImage(fields.frameImage);
                if (bgImg) {
                    // "spin/rotate is missing" -- rotated around the mat
                    // band's own rect centre, the identical convention
                    // already used for Image/Graphics/Text Experience
                    // content rotation above (line ~703), so this reads as
                    // the same, established capability, not a special case.
                    const bgRotation = fields.frameImageRotation || 0;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(matRect.x, matRect.y, matRect.w, matRect.h);
                    ctx.clip();
                    if (bgRotation) {
                        const bcx = matRect.x + matRect.w / 2, bcy = matRect.y + matRect.h / 2;
                        ctx.translate(bcx, bcy);
                        ctx.rotate(bgRotation * Math.PI / 180);
                        ctx.translate(-bcx, -bcy);
                    }
                    _drawImageWithFit(ctx, bgImg, matRect, 'fill');
                    ctx.restore();
                }
            }
        }

        // A small, additive distinguishing cue per Frame Style — see
        // `_paintFrameOrnament`'s own header comment. Painted after the
        // mat (so it sits on top of it, matching a real frame's own
        // wood-grain/tape/pin ornament) and before the content band.
        _paintFrameOrnament(ctx, rect, insets, fields, matRect, matIsTransparent, graph);

        // Content band — the Holder's own Padding (Engine Canon §6:
        // "inset between the Holder's edge and its content"), applied
        // after the Frame's own mat, so the two compose rather than
        // overriding each other. Its own fallback now respects the same
        // transparency signals as its neighbors -- a genuinely
        // all-transparent Frame (every band above skipped) doesn't
        // invent its own opaque backdrop here either.
        const contentFallback = (matPx > 0 && !matIsTransparent) ? matFillColor : (wallTransparent ? 'rgba(0,0,0,0)' : '#E4DCCB');
        const contentRect = _band(insets.contentInset, contentFallback);
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
    // pixel size, 'stretch' (a real, user-requested addition — no
    // uniform-scale option existed anywhere in this codebase before it —
    // scales both axes independently to exactly match `rect`, never
    // cropping and never leaving a gap, at the cost of distorting the
    // image's own aspect ratio) draws it at exactly rect.w x rect.h.
    // Pure geometry, no Scene Model/Engine V2 pipeline change — just how
    // a Holder's content resolves an image it's handed.
    function _drawImageWithFit(ctx, img, rect, fit) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;
        if (fit === 'stretch') {
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
            return;
        }
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
    //
    // Real, user-reported gap: pressing Enter in a Text Experience's
    // Words/Content field always inserts a real '\n' (a plain textarea's
    // own native behaviour) -- but this function used to split only on
    // ' ', so an embedded '\n' was silently absorbed mid-word-wrap with
    // zero visible line break. Fixed by splitting on '\n' into paragraphs
    // first, then word-wrapping each paragraph independently -- a blank
    // paragraph (from '\n\n') still pushes an empty line, preserving the
    // author's own blank-line spacing. For any text with no '\n' at all
    // (every pre-existing single-paragraph Text Experience), paragraphs
    // is just [text] and this is byte-identical to the original
    // algorithm -- purely additive, no regression.
    function _wrapLines(ctx, text, maxWidth) {
        const paragraphs = (text || '').split('\n');
        const lines = [];
        paragraphs.forEach(function (paragraph) {
            const words = paragraph.split(' ');
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
        });
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

    // Bug G — "For texts allow these curves." One line of text drawn
    // along an arc, character-by-character (each glyph translated to
    // its position on the arc, then rotated so its baseline is tangent
    // to the arc at that point). arcDeg = total angular span (0 = flat,
    // caller falls through; positive = concave-down/smile arc; negative
    // = concave-up/frown arc). anchorX/anchorY = the LINE's own
    // centerpoint. Requires ctx.font/fillStyle already set. Kept in
    // lockstep, by hand, with root Studio's renderer/slideRenderer.js
    // own _drawCurvedTextLine.
    function _drawCurvedTextLine(ctx, line, anchorX, anchorY, arcDeg, drawKind) {
        if (!line || !arcDeg) return false;
        const arcRad = arcDeg * Math.PI / 180;
        const totalW = ctx.measureText(line).width;
        if (totalW <= 0) return false;
        const absArc = Math.abs(arcRad);
        const radius = totalW / absArc;
        const sign = arcRad > 0 ? 1 : -1;
        const chars = Array.from(line);
        const savedAlign = ctx.textAlign;
        let cumW = 0;
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const chW = ctx.measureText(ch).width;
            const angleFromCenter = ((cumW + chW / 2) - totalW / 2) / radius;
            const posX = anchorX + radius * Math.sin(angleFromCenter);
            const posYOff = radius * (1 - Math.cos(angleFromCenter));
            const posY = anchorY - sign * posYOff;
            const rot = sign * angleFromCenter;
            ctx.save();
            ctx.translate(posX, posY);
            ctx.rotate(rot);
            ctx.textAlign = 'center';
            if (drawKind === 'stroke') ctx.strokeText(ch, 0, 0);
            else ctx.fillText(ch, 0, 0);
            ctx.restore();
            cumW += chW;
        }
        ctx.textAlign = savedAlign;
        return true;
    }

    // Bug G Rework — Wave style. Straight horizontal X progression along
    // the baseline, Y follows a sine wave. amplitude = Math.abs(amount) *
    // 0.3 in px (so a 0..180 amount slider maps to 0..54px amplitude,
    // roughly matching Arc's own perceptual range at similar amount
    // values); amount sign flips the wave's starting direction. period
    // is derived as textWidth/2.5 so 2-3 full waves always show
    // regardless of text length, reading unambiguously as wavy text.
    // Character glyphs stay upright (unlike Arc, which rotates each
    // glyph tangent to the arc) so the effect reads as text bouncing
    // along a wavy baseline rather than glyphs tumbling. Kept in
    // lockstep, by hand, with renderer/slideRenderer.js's own mirror.
    function _drawWaveTextLine(ctx, line, anchorX, anchorY, amount, drawKind) {
        if (!line || !amount) return false;
        const totalW = ctx.measureText(line).width;
        if (totalW <= 0) return false;
        const amplitude = Math.abs(amount) * 0.3;
        const sign = amount >= 0 ? 1 : -1;
        const period = Math.max(60, totalW / 2.5);
        const chars = Array.from(line);
        const savedAlign = ctx.textAlign;
        const startX = anchorX - totalW / 2;
        let cumW = 0;
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const chW = ctx.measureText(ch).width;
            const cx = startX + cumW + chW / 2;
            const waveY = sign * Math.sin(((cx - startX) / period) * 2 * Math.PI) * amplitude;
            ctx.save();
            ctx.translate(cx, anchorY + waveY);
            ctx.textAlign = 'center';
            if (drawKind === 'stroke') ctx.strokeText(ch, 0, 0);
            else ctx.fillText(ch, 0, 0);
            ctx.restore();
            cumW += chW;
        }
        ctx.textAlign = savedAlign;
        return true;
    }

    // Bug G Rework — Circle style. Full 360° wrap; text closes back on
    // itself into a real circle. Radius derived directly from text width
    // (2πr = textWidth), so amount is deliberately unused (the UI
    // disables the Amount slider whenever Circle is selected). Text
    // starts at 12 o'clock and reads clockwise, matching how you'd
    // naturally read a circular label on paper. Each glyph rotates
    // tangent to the circle, exactly like Arc, so glyph orientation is
    // consistent with the direction the eye is scanning. Kept in
    // lockstep, by hand, with renderer/slideRenderer.js's own mirror.
    function _drawCircleTextLine(ctx, line, anchorX, anchorY, drawKind) {
        if (!line) return false;
        const totalW = ctx.measureText(line).width;
        if (totalW <= 0) return false;
        const radius = totalW / (2 * Math.PI);
        const chars = Array.from(line);
        const savedAlign = ctx.textAlign;
        let cumW = 0;
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const chW = ctx.measureText(ch).width;
            const angle = ((cumW + chW / 2) / totalW) * 2 * Math.PI - Math.PI / 2;
            const posX = anchorX + (radius + radius) * Math.cos(angle) * 0.5;
            const posY = anchorY + radius + radius * Math.sin(angle);
            const rot = angle + Math.PI / 2;
            ctx.save();
            ctx.translate(posX, posY);
            ctx.rotate(rot);
            ctx.textAlign = 'center';
            if (drawKind === 'stroke') ctx.strokeText(ch, 0, 0);
            else ctx.fillText(ch, 0, 0);
            ctx.restore();
            cumW += chW;
        }
        ctx.textAlign = savedAlign;
        return true;
    }

    // Bug G Rework — unified dispatcher. Style-first routing so the
    // renderer never has to care what "amount" means for a given style.
    // Backward compat: an older Layer with `curve` set but no
    // `curveStyle` (compiled before this rework existed) is treated as
    // 'arc', matching the original Bug G behaviour byte-for-byte.
    // Returns true iff a styled line was actually drawn; false when the
    // style is 'none' / absent-and-no-legacy-amount, letting the caller
    // fall through to a straight `_drawWrappedText` path.
    function _drawStyledTextLine(ctx, line, anchorX, anchorY, curveStyle, amount, drawKind) {
        const effectiveStyle = curveStyle && curveStyle !== 'none' ? curveStyle : (amount ? 'arc' : 'none');
        if (effectiveStyle === 'arc') return _drawCurvedTextLine(ctx, line, anchorX, anchorY, amount, drawKind);
        if (effectiveStyle === 'wave') return _drawWaveTextLine(ctx, line, anchorX, anchorY, amount, drawKind);
        if (effectiveStyle === 'circle') return _drawCircleTextLine(ctx, line, anchorX, anchorY, drawKind);
        return false;
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

    // "what do we call this kind of fonts" — a colorful, geometric-shape-
    // filled letter style ("stained-glass"/faceted lettering). Rendered as
    // a real Fill Style option for ANY text object, in ANY font, working
    // automatically for the full alphabet and every digit — never
    // per-glyph authored art — via a canvas glyph-as-clip-mask technique:
    // render the real text once to build a solid alpha mask, then use
    // source-in compositing so a filled geometric pattern only shows
    // through where the glyphs actually are, then stroke a white outline
    // on top. Kept in lockstep, by hand, with renderer/slideRenderer.js's
    // own mirrored copy of this same technique — the two rendering
    // engines share no drawing module, matching this codebase's
    // established precedent.
    const SHAPE_MOSAIC_PALETTE = ['#FF3B6B', '#FFC94D', '#4FD1C5', '#7C5CFC', '#FF8A5B', '#3DDC84'];

    // One deterministic ("same input, same pixels" — this codebase's own
    // established rule for any generative visual effect, e.g. the Spray
    // Doodle medium) cell motif, cycled by row/column index, never
    // Math.random — a redraw of the identical text always looks identical.
    function _paintShapeMosaicCell(ctx, cx, cy, cell, colorA, colorB, variant) {
        const half = cell / 2;
        ctx.save();
        ctx.translate(cx, cy);
        const v = variant % 3;
        if (v === 0) {
            ctx.fillStyle = colorA;
            ctx.beginPath(); ctx.moveTo(-half, -half); ctx.lineTo(0, 0); ctx.lineTo(-half, half); ctx.closePath(); ctx.fill();
            ctx.fillStyle = colorB;
            ctx.beginPath(); ctx.moveTo(half, -half); ctx.lineTo(0, 0); ctx.lineTo(half, half); ctx.closePath(); ctx.fill();
        } else if (v === 1) {
            ctx.fillStyle = colorA; ctx.fillRect(-half, -half, cell, cell);
            ctx.fillStyle = colorB;
            ctx.beginPath(); ctx.moveTo(0, -half); ctx.lineTo(half, 0); ctx.lineTo(0, half); ctx.lineTo(-half, 0); ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = colorA; ctx.fillRect(-half, -half, cell, cell);
            ctx.fillStyle = colorB;
            ctx.beginPath(); ctx.moveTo(-half, -half); ctx.lineTo(half, -half); ctx.lineTo(-half, half); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(half, -half); ctx.lineTo(half, half); ctx.lineTo(-half, half); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    function _fillShapeMosaicPattern(ctx, w, h, cellSize) {
        const cols = Math.ceil(w / cellSize) + 1;
        const rows = Math.ceil(h / cellSize) + 1;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const idxA = (row * 7 + col * 3) % SHAPE_MOSAIC_PALETTE.length;
                const idxB = (row * 7 + col * 3 + 2 + SHAPE_MOSAIC_PALETTE.length) % SHAPE_MOSAIC_PALETTE.length;
                const variant = row * 5 + col * 2;
                _paintShapeMosaicCell(ctx, col * cellSize + cellSize / 2, row * cellSize + cellSize / 2, cellSize, SHAPE_MOSAIC_PALETTE[idxA], SHAPE_MOSAIC_PALETTE[idxB], variant);
            }
        }
    }

    // mainCtx: the real canvas context currently drawing (already
    // transformed for rotation, if any — the final drawImage call below
    // respects whatever transform is active, so this works transparently
    // whether the caller rotated first or not). bx/by/bw/bh: the natural
    // (untransformed) text-block bbox, in the exact same coordinate space
    // drawTextFn's own fillText/strokeText calls use. drawTextFn(targetCtx,
    // isStroke): replicates the caller's own per-line loop against
    // whatever ctx it's handed — false builds the solid-black alpha mask,
    // true draws the white outline pass — so the mosaic fill can never
    // drift out of sync with what a plain solid fill would have drawn.
    function _drawShapeMosaicTextBlock(mainCtx, bx, by, bw, bh, drawTextFn) {
        const pad = Math.max(4, Math.ceil(bh * 0.2));
        const w = Math.max(1, Math.ceil(bw + pad * 2));
        const h = Math.max(1, Math.ceil(bh + pad * 2));
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const octx = off.getContext('2d');
        octx.save();
        octx.translate(-bx + pad, -by + pad);
        drawTextFn(octx, false);
        octx.restore();
        // The mosaic pattern is built on its OWN, separate offscreen canvas
        // first (plain source-over, so each cell's own two fill() calls
        // never interfere with each other), then composited onto the glyph
        // mask via exactly ONE drawImage call under source-in — a real bug
        // found and fixed here, not assumed correct: source-in composites
        // per DRAW CALL, not cumulatively, over the whole canvas. Looping
        // several fill() calls directly under source-in (the original
        // approach) let every later cell's fill erase every earlier cell's
        // already-composited result — a pixel "untouched by this call"
        // counts as fully transparent source, multiplied against dest
        // alpha = 0, wiping out whatever was already painted there,
        // regardless of the fact it had already composited correctly on a
        // prior call. Confirmed via a decisive reproduction: the old code
        // rendered only the final white outline stroke, zero mosaic
        // colour, for any text with 2+ shape cells. Kept in lockstep, by
        // hand, with renderer/slideRenderer.js's own mirrored fix.
        const pattern = document.createElement('canvas');
        pattern.width = w; pattern.height = h;
        const pctx = pattern.getContext('2d');
        _fillShapeMosaicPattern(pctx, w, h, Math.max(18, Math.round(bh * 0.4)));
        octx.globalCompositeOperation = 'source-in';
        octx.drawImage(pattern, 0, 0);
        octx.globalCompositeOperation = 'source-over';
        octx.save();
        octx.translate(-bx + pad, -by + pad);
        drawTextFn(octx, true);
        octx.restore();
        mainCtx.drawImage(off, bx - pad, by - pad);
    }

    // Paints a Scene Layer — a Decoration (`kind: 'fill' | 'decoration'`)
    // or Text (`kind: 'text'`), Scene Model §2's own vocabulary.
    //
    // Builder V3.1 Universal Experience Authoring — `layer.opacity`
    // (0..1, defaulting to 1 when unset so every pre-existing Layer
    // renders exactly as before) is a small, generic addition read here
    // for every Layer kind alike, since Opacity is one of the four
    // universal content sections' own Properties (Text/Image/Graphics/
    // Colour all list it) — not a per-type special case.
    function _paintLayer(ctx, layer, graph) {
        if (layer.permissions && layer.permissions.visible === false) return;
        const rect = rectFor(layer, graph);
        const opacity = typeof layer.opacity === 'number' ? Math.max(0, Math.min(1, layer.opacity)) : 1;
        if (opacity <= 0) return;

        if (layer.kind === 'fill') {
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = layer.color;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.restore();
        } else if (layer.kind === 'text') {
            // Rotation — "add rotation to text, and graphics in builder."
            // Real bug found afterward: "the current rotation is moving
            // the object all around the canvas in circular motion...
            // needs to rotate 360 degree tied down at its centre, like
            // we did for image, like we have in studio." Root cause: this
            // used to pivot on the Layer's *declared* box (rect, from
            // rectFor()) — the same convention the Decoration branch
            // below correctly uses, since an Image/Shape's declared box
            // IS its visible content. A Text Layer's declared box is
            // only ever a wrap-width/creation-time placeholder height
            // (AV-006/AV-010's own finding — textFootprint()'s entire
            // reason for existing), completely decoupled from where the
            // real glyphs sit once actual content exists. Pivoting on
            // that declared box's own center swung the visible text
            // through a wide arc around empty space as the angle
            // changed — reading exactly as "moving around the canvas"
            // rather than spinning in place. Fixed by pivoting on
            // textFootprint()'s own real, measured center instead — the
            // identical extent this module already reports for hit-
            // testing/dragging, so painting and interaction can never
            // disagree about where the text's true center is. Matches
            // root Studio's own _layerDrawText, which already rotates
            // around a point derived from real rendered content, never a
            // raw declared box.
            const textRotation = typeof layer.rotation === 'number' ? layer.rotation : 0;
            ctx.save();
            ctx.globalAlpha = opacity;
            if (textRotation) {
                const footprint = textFootprint(ctx, layer, graph);
                const tcx = footprint.x + footprint.w / 2, tcy = footprint.y + footprint.h / 2;
                ctx.translate(tcx, tcy);
                ctx.rotate(textRotation * Math.PI / 180);
                ctx.translate(-tcx, -tcy);
            }
            ctx.font = (layer.fontSize || 48) + 'px ' + (layer.font || 'Georgia, serif');
            ctx.textAlign = layer.align || 'left';
            ctx.textBaseline = 'top';
            const tx = layer.align === 'center' ? rect.x + rect.w / 2 : (layer.align === 'right' ? rect.x + rect.w : rect.x);
            // "what do we call this kind of fonts" — layer.shapeFill is a
            // real Fill Style choice, Solid (below, byte-identical to
            // before this feature) vs. Shapes (a colorful geometric-mosaic
            // fill clipped to the real glyph shapes, working for any text
            // in any font with no per-glyph art) — mirrors root Studio's
            // own _layerDrawText shapeFill branch exactly. Builder's Text
            // Layers have no underline/strikethrough concept of their own
            // (a Story-Author-only capability added later, on top of
            // whatever Builder authored), so unlike the root Studio
            // mirror, there's no decoration pass to draw here either way.
            // Bug G Rework — resolve Style/Amount once, upfront, so both
            // the plain-colour and shape-mosaic paths dispatch through
            // the same styled renderer. curveStyle='none' means always
            // straight regardless of curve value; absent/undefined
            // curveStyle with a nonzero curve amount is treated as 'arc'
            // by _drawStyledTextLine (byte-identical to the original
            // Bug G behaviour, so every already-compiled Layer renders
            // exactly as before).
            const curveStyle = layer.curveStyle || (layer.curve ? 'arc' : 'none');
            const curveAmount = typeof layer.curve === 'number' ? layer.curve : 0;
            const isCurved = curveStyle !== 'none' && (curveStyle === 'circle' || curveAmount !== 0);
            const lineHeightPx = (layer.fontSize || 48) * 1.25;
            const wrapped = _wrapLines(ctx, layer.text || '', rect.w);
            let maxLW = 0;
            wrapped.forEach(function (line) {
                const lw = ctx.measureText(line).width;
                if (lw > maxLW) maxLW = lw;
            });
            // Bug G Rework — one shared line-drawer that handles all four
            // styles (None/Arc/Wave/Circle) plus fallback to straight
            // _drawWrappedText for 'none'. Used by both the shape-mosaic
            // drawTextFn (below) AND the plain-colour path, so the two
            // can never disagree on how a curved line renders.
            const drawLinesTo = function (targetCtx, isStroke, colorFillOverride) {
                targetCtx.font = ctx.font;
                targetCtx.textAlign = layer.align || 'left';
                targetCtx.textBaseline = 'top';
                if (isStroke) {
                    targetCtx.strokeStyle = '#FFFFFF';
                    targetCtx.lineWidth = Math.max(1.5, (layer.fontSize || 48) * 0.05);
                } else if (colorFillOverride) {
                    targetCtx.fillStyle = colorFillOverride;
                } else {
                    targetCtx.fillStyle = '#000000';
                }
                if (!isCurved) {
                    if (isStroke) {
                        wrapped.forEach(function (line, i) {
                            targetCtx.strokeText(line, tx, rect.y + i * lineHeightPx);
                        });
                    } else {
                        wrapped.forEach(function (line, i) {
                            targetCtx.fillText(line, tx, rect.y + i * lineHeightPx);
                        });
                    }
                    return;
                }
                for (let i = 0; i < wrapped.length; i++) {
                    const line = wrapped[i];
                    const lw = targetCtx.measureText(line).width;
                    let cx = tx;
                    if (layer.align === 'left' || !layer.align) cx = tx + lw / 2;
                    else if (layer.align === 'right') cx = tx - lw / 2;
                    _drawStyledTextLine(targetCtx, line, cx, rect.y + i * lineHeightPx, curveStyle, curveAmount, isStroke ? 'stroke' : 'fill');
                }
            };
            if (layer.shapeFill) {
                // Bug G Rework — Shape-Mosaic Fill Style must respect
                // Curve Style too (the earlier ship shipped Curve for
                // solid-fill text only, silently skipping it for
                // shapeFill). The mask+composite mechanism doesn't care
                // HOW glyphs are drawn onto the mask, only that they
                // ARE — so drawLinesTo, which already knows how to
                // dispatch through _drawStyledTextLine per line, is
                // fed straight into _drawShapeMosaicTextBlock. Bbox is
                // expanded to fit whatever curved reach the style
                // produces (arc/wave add vertical amplitude; circle
                // becomes roughly square at 2*radius), so a curved
                // shape-fill glyph is never clipped by too small an
                // offscreen mask canvas.
                let bx = tx;
                if (layer.align === 'center') bx = tx - maxLW / 2;
                else if (layer.align === 'right') bx = tx - maxLW;
                let by = rect.y;
                let bw = maxLW;
                let bh = wrapped.length * lineHeightPx;
                if (isCurved) {
                    if (curveStyle === 'arc') {
                        const arcRad = Math.abs(curveAmount * Math.PI / 180);
                        const radius = maxLW / Math.max(0.001, arcRad);
                        const bulge = radius * (1 - Math.cos(arcRad / 2));
                        bh += Math.abs(bulge) + (layer.fontSize || 48);
                        if (curveAmount < 0) by -= Math.abs(bulge);
                    } else if (curveStyle === 'wave') {
                        const amp = Math.abs(curveAmount) * 0.3;
                        bh += amp * 2 + (layer.fontSize || 48) * 0.3;
                        by -= amp;
                    } else if (curveStyle === 'circle') {
                        const cr = maxLW / (2 * Math.PI);
                        const diameter = 2 * cr + (layer.fontSize || 48) * 1.2;
                        bx = tx - diameter / 2;
                        by = rect.y;
                        bw = diameter;
                        bh = diameter;
                    }
                }
                const drawTextFn = function (targetCtx, isStroke) { drawLinesTo(targetCtx, isStroke, null); };
                _drawShapeMosaicTextBlock(ctx, bx, by, bw, bh, drawTextFn);
            } else {
                drawLinesTo(ctx, false, layer.color || '#1D3457');
            }
            ctx.restore();
        } else {
            // Decoration — a Universal Experience's Shape, Image, or
            // Graphics section (Builder V3.1), or a legacy Glyph. A
            // Shape (an author-drawn circle/star/arrow/speech-bubble/
            // banner, real fill+outline rather than a fixed-colour
            // emoji) takes priority when present, since it's the most
            // deliberately-authored of the three; otherwise a real,
            // loaded Image (resolved by the host, never this module —
            // see `load`'s `resolveLayerImage`) is preferred, falling
            // back to the existing glyph rendering. `rotation` (degrees,
            // clockwise) is generic to the whole Decoration branch, not
            // Shape-only, so an uploaded Graphics image can be rotated
            // too — applied around the Layer's own rect centre so
            // rotating never changes where its bounding box sits.
            const rotation = typeof layer.rotation === 'number' ? layer.rotation : 0;
            ctx.save();
            ctx.globalAlpha = opacity;
            if (rotation) {
                const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
                ctx.translate(cx, cy);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }
            if (layer.shape) {
                _drawShape(ctx, layer.shape, rect, layer.shapeFillColor, layer.shapeStrokeColor, layer.shapeStrokeWidth, layer.shapeFillOpacity, layer.shapeStrokeOpacity, layer.customPath, layer.fillMode, layer.paintStrokes);
            } else {
                const img = layer.image ? graph.resolveLayerImage(layer.image) : null;
                if (img) {
                    // `fit` (Universal Image's own Fit control) defaults
                    // to 'fit' (contain) — a Graphics asset has no Fit
                    // control of its own (Properties: Upload/Replace/
                    // Remove/Preview/Opacity only) and always contains.
                    _drawImageWithFit(ctx, img, rect, layer.fit || 'fit');
                } else {
                    ctx.font = Math.round(Math.min(rect.w, rect.h)) + 'px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(layer.glyph, rect.x + rect.w / 2, rect.y + rect.h / 2);
                }
            }
            ctx.restore();
        }
    }

    // Letter/Number shapes — "alphabets, numbers should also be part of
    // shapes... your second interpretation is correct. the literal one.":
    // a standalone, pickable Shape kind per A-Z/0-9 (ExperienceSchema
    // .SHAPE_KINDS), drawn as real, colourable/outlinable/rotatable glyph
    // text rather than a hand-plotted vector path (36 hand-authored
    // outlines would be impractical and lower quality than the browser's
    // own font rendering) — mirrored by hand into
    // renderer/slideRenderer.js's own _drawLetterShape for the real
    // Reader-facing Runtime.
    function _shapeLetterChar(kind) {
        if (typeof kind !== 'string') return null;
        if (kind.indexOf('letter-') === 0) return kind.slice(7);
        if (kind.indexOf('number-') === 0) return kind.slice(7);
        return null;
    }
    // Shared by _drawLetterShape (Solid) and _drawLetterShapePaint (Paint
    // Inside) so the two modes' auto-fit sizing can never drift apart —
    // mutates ctx.font/.textAlign/.textBaseline as a side effect (both
    // callers need them set before they measure/draw) and returns the
    // resolved font size in px. Mirrors renderer/slideRenderer.js's own
    // _letterFont exactly.
    function _letterFont(ctx, ch, rect) {
        let fontSize = rect.h * 0.82;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        const maxW = rect.w * 0.86;
        const measured = ctx.measureText(ch).width;
        if (measured > maxW && measured > 0) {
            fontSize = fontSize * (maxW / measured);
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
        }
        return fontSize;
    }
    function _drawLetterShape(ctx, ch, rect, cx, cy, fillColor, strokeColor, strokeWidth, fillOpacity, strokeOpacity) {
        _letterFont(ctx, ch, rect);
        const baseAlpha = ctx.globalAlpha;
        const fillA = typeof fillOpacity === 'number' ? Math.max(0, Math.min(1, fillOpacity)) : 1;
        const strokeA = typeof strokeOpacity === 'number' ? Math.max(0, Math.min(1, strokeOpacity)) : 1;
        // No fillEnabled gate here — _drawShape's own caller never has one
        // either (only renderer/slideRenderer.js's decoration-kind fill
        // path exposes "Outline Only"), matching this function's own
        // always-fills convention for every other kind.
        ctx.fillStyle = fillColor || '#F0B429';
        ctx.globalAlpha = baseAlpha * fillA;
        ctx.fillText(ch, cx, cy);
        if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeColor || '#24406B';
            ctx.globalAlpha = baseAlpha * strokeA;
            ctx.strokeText(ch, cx, cy);
        }
        ctx.globalAlpha = baseAlpha;
    }

    // Letter/Number Paint Inside — fillText/strokeText produce no plottable
    // path to clip Doodle's own strokes against, so this mirrors the
    // established offscreen-canvas-plus-compositing technique
    // renderer/slideRenderer.js's own _drawLetterShapePaint uses (which
    // itself mirrors _buildRecoloredStickerCanvas' "Colour This" pattern):
    // a `mask` canvas holds the glyph's own opaque silhouette; a `paint`
    // canvas holds the real, live-drawn strokes (via _drawDoodleStrokes,
    // retargeting through explicit ctx params rather than a module-level
    // shared context — this module is stateless, unlike Studio's own
    // slideRenderer.js which relies on `x`/`c`); destination-in then
    // composites the two so only the ink inside the glyph survives.
    // Outline (strokeText) stays unconditional and unclipped, drawn
    // straight onto the real ctx.
    function _drawLetterShapePaint(ctx, ch, rect, cx, cy, style) {
        const fontSize = _letterFont(ctx, ch, rect);
        const baseAlpha = ctx.globalAlpha;
        const fillA = typeof style.fillOpacity === 'number' ? Math.max(0, Math.min(1, style.fillOpacity)) : 1;
        const strokeA = typeof style.strokeOpacity === 'number' ? Math.max(0, Math.min(1, style.strokeOpacity)) : 1;
        if (Array.isArray(style.paintStrokes) && style.paintStrokes.length) {
            const pad = Math.max(rect.w, rect.h) * 0.08;
            const bx = rect.x - pad, by = rect.y - pad, bw = rect.w + pad * 2, bh = rect.h + pad * 2;
            const scale = 2; // supersample for quality
            const cw = Math.max(1, Math.round(bw * scale)), ch2 = Math.max(1, Math.round(bh * scale));

            const mask = document.createElement('canvas');
            mask.width = cw; mask.height = ch2;
            const mctx = mask.getContext('2d');
            mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
            mctx.font = 'bold ' + (fontSize * scale) + 'px sans-serif';
            mctx.fillStyle = '#000';
            mctx.fillText(ch, (cx - bx) * scale, (cy - by) * scale);

            const paint = document.createElement('canvas');
            paint.width = cw; paint.height = ch2;
            const pctx = paint.getContext('2d');
            pctx.setTransform(scale, 0, 0, scale, -bx * scale, -by * scale);
            _drawDoodleStrokes(pctx, style.paintStrokes, rect, fillA);

            // Clip the painted strokes to exactly the glyph's own ink.
            pctx.setTransform(1, 0, 0, 1, 0, 0);
            pctx.globalCompositeOperation = 'destination-in';
            pctx.drawImage(mask, 0, 0);

            ctx.drawImage(paint, bx, by, bw, bh);
        }
        if (style.strokeWidth > 0) {
            ctx.lineWidth = style.strokeWidth;
            ctx.strokeStyle = style.strokeColor || '#24406B';
            ctx.globalAlpha = baseAlpha * strokeA;
            ctx.strokeText(ch, cx, cy);
        }
        ctx.globalAlpha = baseAlpha;
    }

    // Coloring Kit — Crayon/Pastel/Brush/Spray stroke rendering,
    // hand-mirrored from renderer/slideRenderer.js's own
    // _drawDoodleStrokeOnCtx / _doodleBrushTaper / _sprayHash (which in
    // turn mirror js/cardDesigner.js's own copies). The two rendering
    // engines share no drawing module, matching this codebase's
    // established Shape-pad/real-renderer duplication discipline. A
    // stroke with no `medium` field (every doodle drawn before this
    // feature shipped) always renders through the final `else` branch
    // below, byte-identical to the original algorithm.
    //
    // Studio's version uses the module-level shared `x` context; this
    // module is stateless and takes ctx as an explicit first parameter
    // in every function — otherwise byte-identical logic.
    function _doodleBrushTaper(t) {
        if (t < 0.15) return 0.35 + (t / 0.15) * 0.65;
        if (t > 0.85) return 0.35 + ((1 - t) / 0.15) * 0.65;
        return 1;
    }
    // A deterministic (never Math.random — so a Spray stroke renders
    // identically on every redraw) GLSL-style sine hash. Mirrors
    // renderer/slideRenderer.js's own _sprayHash exactly.
    function _sprayHash(i, k) {
        const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
        return v - Math.floor(v);
    }
    function _drawDoodleStrokeOnCtx(ctx, points, rect, color, width, medium, baseAlpha) {
        const mapPt = function (p) { return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h }; };
        const col = color || '#24406B';
        const w = typeof width === 'number' ? width : 6;
        if (medium === 'pastel') {
            ctx.save();
            ctx.globalAlpha = baseAlpha * 0.55;
            ctx.shadowColor = col;
            ctx.shadowBlur = w * 1.1;
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(1, w * 0.85);
            ctx.beginPath();
            points.forEach(function (p, i) { const m = mapPt(p); if (i === 0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y); });
            ctx.stroke();
            ctx.restore();
        } else if (medium === 'brush') {
            ctx.save();
            ctx.globalAlpha = baseAlpha;
            ctx.strokeStyle = col;
            const n = points.length;
            for (let i = 0; i < n - 1; i++) {
                const t = i / Math.max(1, n - 1);
                ctx.lineWidth = Math.max(1, w * _doodleBrushTaper(t));
                const p1 = mapPt(points[i]), p2 = mapPt(points[i + 1]);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
            ctx.restore();
        } else if (medium === 'crayon') {
            ctx.save();
            const passes = [{ dx: 0, dy: 0, ws: 1, as: 0.55 }, { dx: 1, dy: -1, ws: 0.85, as: 0.32 }, { dx: -1, dy: 1, ws: 0.7, as: 0.28 }];
            passes.forEach(function (pass) {
                ctx.globalAlpha = baseAlpha * pass.as;
                ctx.strokeStyle = col;
                ctx.lineWidth = Math.max(1, w * pass.ws);
                ctx.beginPath();
                points.forEach(function (p, i) {
                    const m = mapPt(p);
                    const px = m.x + pass.dx, py = m.y + pass.dy;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                });
                ctx.stroke();
            });
            ctx.restore();
        } else if (medium === 'spray') {
            ctx.save();
            ctx.fillStyle = col;
            const dotsPerPoint = 5;
            const radius = Math.max(4, w * 1.4);
            points.forEach(function (p, i) {
                const m = mapPt(p);
                for (let k = 0; k < dotsPerPoint; k++) {
                    const h1 = _sprayHash(i, k), h2 = _sprayHash(i + 1000, k);
                    const angle = h1 * Math.PI * 2;
                    const dist = h2 * radius;
                    const dotR = Math.max(0.6, w * 0.09 * (0.5 + h1));
                    ctx.globalAlpha = baseAlpha * (0.28 + 0.35 * h2);
                    ctx.beginPath();
                    ctx.arc(m.x + Math.cos(angle) * dist, m.y + Math.sin(angle) * dist, dotR, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.restore();
        } else {
            ctx.globalAlpha = baseAlpha;
            ctx.beginPath();
            points.forEach(function (p, i) { const m = mapPt(p); if (i === 0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y); });
            ctx.lineWidth = w;
            ctx.strokeStyle = col;
            ctx.stroke();
        }
    }
    function _drawDoodleStrokes(ctx, strokes, rect, alpha) {
        if (!Array.isArray(strokes) || !strokes.length) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const a = (typeof alpha === 'number') ? Math.max(0, Math.min(1, alpha)) : 1;
        strokes.forEach(function (s) {
            if (!s || !Array.isArray(s.points) || s.points.length < 2) return;
            _drawDoodleStrokeOnCtx(ctx, s.points, rect, s.color, s.width, s.medium, a);
        });
        ctx.restore();
    }

    // A regular N-sided polygon inscribed in the same rx/ry ellipse
    // `circle` already uses, point-up (matching `star`'s own starting
    // angle) — shared by every basic straight-edged polygon
    // (triangle/pentagon/hexagon/octagon) so each is one line of
    // geometry, not four near-duplicate hand-plotted paths.
    //
    // The Path2D variant used by _drawShape (Paint Inside requires the
    // shape's own path to survive Doodle's own beginPath() calls per
    // stroke — see _paintShapePathTail's own doc comment for why).
    function _regularPolygonPathFor(path, cx, cy, rx, ry, sides) {
        const start = -Math.PI / 2;
        const step = (Math.PI * 2) / sides;
        path.moveTo(cx + Math.cos(start) * rx, cy + Math.sin(start) * ry);
        for (let i = 1; i < sides; i++) {
            const a = start + step * i;
            path.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        }
        path.closePath();
    }

    // The shared fill/outline tail for every plotted-path Shape (every
    // kind except letter/number, which paints via fillText/strokeText —
    // see _drawLetterShape / _drawLetterShapePaint — and has no
    // plottable path for this function to work with at all).
    //
    // "Solid Fill" (the default, style.fillMode!=='paint') is the
    // original, unchanged flat fill(path) behaviour — every Shape
    // authored before Paint Inside existed renders byte-identically
    // forever, since fillMode is always undefined for it.
    //
    // "Paint Inside" (style.fillMode==='paint') reuses Doodle's own
    // multi-stroke/multi-colour/medium renderer (_drawDoodleStrokes,
    // which itself calls _drawDoodleStrokeOnCtx per stroke) directly —
    // zero duplicated per-medium drawing logic — clipped to this
    // shape's own real silhouette via the Path2D built by the caller
    // (never a faked bounding-box clip). No strokes yet drawn (an
    // empty/absent paintStrokes array) means nothing is filled at all,
    // matching Doodle's own "blank until you draw" convention.
    //
    // Why Path2D and not the ctx's own "current path": Canvas 2D's
    // current path is a single mutable object that lives outside the
    // save/restore state stack. Building a shape's outline directly on
    // ctx via beginPath()+moveTo()+lineTo()..., then calling
    // _drawDoodleStrokes (which internally calls ctx.beginPath() per
    // stroke), would clobber the shape's own path before the outline
    // stroke needed it. Path2D objects are independent of the current
    // path and support fill(path)/clip(path)/stroke(path).
    //
    // The outline (stroke(path)) is unconditional in both modes —
    // Outline stays a separate, always-available control regardless of
    // which fill mode is active, per the shipped product decision.
    function _paintShapePathTail(ctx, path, rect, style) {
        const baseAlpha = ctx.globalAlpha;
        const fillA = (typeof style.fillOpacity === 'number') ? Math.max(0, Math.min(1, style.fillOpacity)) : 1;
        const strokeA = (typeof style.strokeOpacity === 'number') ? Math.max(0, Math.min(1, style.strokeOpacity)) : 1;
        if (style.fillMode === 'paint') {
            if (Array.isArray(style.paintStrokes) && style.paintStrokes.length) {
                ctx.save();
                ctx.clip(path);
                _drawDoodleStrokes(ctx, style.paintStrokes, rect, baseAlpha * fillA);
                ctx.restore();
            }
        } else if (style.fillEnabled !== false) {
            ctx.fillStyle = style.fillColor || '#F0B429';
            ctx.globalAlpha = baseAlpha * fillA;
            ctx.fill(path);
        }
        if (style.strokeWidth > 0) {
            ctx.lineWidth = style.strokeWidth;
            ctx.strokeStyle = style.strokeColor || '#24406B';
            ctx.globalAlpha = baseAlpha * strokeA;
            ctx.stroke(path);
        }
        ctx.globalAlpha = baseAlpha;
    }

    // Draws one of ExperienceSchema.SHAPE_KINDS as a real vector path
    // filled with `fillColor` and, when `strokeWidth` is greater than
    // zero, outlined with `strokeColor` at that width — genuine
    // recolourable shapes rather than a fixed-colour rasterized emoji,
    // per the Builder authoring request this was built for. Every shape
    // is drawn inscribed in `rect`, so the same Transform (position/
    // size, Builder V3.1's Graphics X/Y/W/H) that already places an
    // uploaded image places a Shape identically. `fillOpacity`/
    // `strokeOpacity` (0..1, each defaulting to 1) let fill and outline
    // carry independent transparency — composed with (multiplied
    // against), not replacing, the Layer's own overall `opacity` that
    // `_paintLayer` already set into `ctx.globalAlpha` before calling
    // here, so a half-opacity Layer with a half-opacity Outline reads
    // as one authoring decision layered on another, not two that fight.
    // `customPath` (only meaningful for kind === 'custom', the "Draw
    // Your Own" shape) is an array of {x,y} points, each 0..1
    // fractional within the Draw pad the creator sketched on —
    // deliberately the same fractional-rect vocabulary every other
    // Shape/Holder/Layer already uses, so mapping it onto `rect` here
    // is the same placement math, not a new coordinate system.
    function _drawShape(ctx, kind, rect, fillColor, strokeColor, strokeWidth, fillOpacity, strokeOpacity, customPath, fillMode, paintStrokes) {
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        const rx = rect.w / 2, ry = rect.h / 2;
        // Pack every fill/outline field into one style object handed to
        // both the letter path and the plotted-path tail, so the two
        // never drift on how each field is interpreted.
        const style = {
            fillColor: fillColor,
            strokeColor: strokeColor,
            strokeWidth: strokeWidth,
            fillOpacity: fillOpacity,
            strokeOpacity: strokeOpacity,
            fillMode: fillMode,
            paintStrokes: paintStrokes
        };
        // Letter/Number kinds bypass the shared path-based fill()/
        // stroke() tail entirely — fillText/strokeText already implement
        // their own fill+stroke. Rotation is unaffected either way: the
        // caller (_paintLayer) already applies it to ctx before this
        // function ever runs, for every kind. Paint Inside uses its own
        // dedicated alpha-mask-composite function (_drawLetterShapePaint)
        // rather than sharing _paintShapePathTail — see that function's
        // own doc comment for why fillText has no plottable path to
        // clip Doodle's own strokes against.
        const letterCh = _shapeLetterChar(kind);
        if (letterCh) {
            if (fillMode === 'paint') {
                _drawLetterShapePaint(ctx, letterCh, rect, cx, cy, style);
            } else {
                _drawLetterShape(ctx, letterCh, rect, cx, cy, fillColor, strokeColor, strokeWidth, fillOpacity, strokeOpacity);
            }
            return;
        }
        // Built onto an independent Path2D — see _paintShapePathTail's
        // own doc comment for why this must never be built directly on
        // ctx's own current path.
        const path = new Path2D();
        if (kind === 'circle') {
            path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        } else if (kind === 'rectangle') {
            path.rect(rect.x, rect.y, rect.w, rect.h);
        } else if (kind === 'rounded-rectangle') {
            const r = Math.min(rect.w, rect.h) * 0.2;
            path.moveTo(rect.x + r, rect.y);
            path.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
            path.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
            path.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
            path.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
            path.closePath();
        } else if (kind === 'custom') {
            if (Array.isArray(customPath) && customPath.length >= 2) {
                customPath.forEach(function (p, i) {
                    const px = rect.x + p.x * rect.w, py = rect.y + p.y * rect.h;
                    if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
                });
                path.closePath();
            } else {
                // Nothing drawn yet — a plain circle placeholder so the
                // Experience is never invisible the instant the tile is
                // picked, exactly like every other shape's own default.
                path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            }
        } else if (kind === 'triangle') {
            _regularPolygonPathFor(path, cx, cy, rx, ry, 3);
        } else if (kind === 'diamond') {
            path.moveTo(cx, rect.y);
            path.lineTo(rect.x + rect.w, cy);
            path.lineTo(cx, rect.y + rect.h);
            path.lineTo(rect.x, cy);
            path.closePath();
        } else if (kind === 'pentagon') {
            _regularPolygonPathFor(path, cx, cy, rx, ry, 5);
        } else if (kind === 'hexagon') {
            _regularPolygonPathFor(path, cx, cy, rx, ry, 6);
        } else if (kind === 'octagon') {
            _regularPolygonPathFor(path, cx, cy, rx, ry, 8);
        } else if (kind === 'star') {
            const spikes = 5, outerRx = rx, outerRy = ry, innerRx = rx * 0.42, innerRy = ry * 0.42;
            let rot = -Math.PI / 2;
            const step = Math.PI / spikes;
            path.moveTo(cx + Math.cos(rot) * outerRx, cy + Math.sin(rot) * outerRy);
            for (let i = 0; i < spikes; i++) {
                rot += step;
                path.lineTo(cx + Math.cos(rot) * innerRx, cy + Math.sin(rot) * innerRy);
                rot += step;
                path.lineTo(cx + Math.cos(rot) * outerRx, cy + Math.sin(rot) * outerRy);
            }
            path.closePath();
        } else if (kind === 'cross') {
            const tw = rect.w * 0.34, th = rect.h * 0.34;
            const x0 = rect.x, y0 = rect.y, w = rect.w, h = rect.h;
            const cx1 = x0 + (w - tw) / 2, cx2 = x0 + (w + tw) / 2;
            const cy1 = y0 + (h - th) / 2, cy2 = y0 + (h + th) / 2;
            path.moveTo(cx1, y0); path.lineTo(cx2, y0); path.lineTo(cx2, cy1);
            path.lineTo(x0 + w, cy1); path.lineTo(x0 + w, cy2); path.lineTo(cx2, cy2);
            path.lineTo(cx2, y0 + h); path.lineTo(cx1, y0 + h); path.lineTo(cx1, cy2);
            path.lineTo(x0, cy2); path.lineTo(x0, cy1); path.lineTo(cx1, cy1);
            path.closePath();
        } else if (kind === 'trapezoid') {
            path.moveTo(rect.x + rect.w * 0.2, rect.y);
            path.lineTo(rect.x + rect.w * 0.8, rect.y);
            path.lineTo(rect.x + rect.w, rect.y + rect.h);
            path.lineTo(rect.x, rect.y + rect.h);
            path.closePath();
        } else if (kind === 'parallelogram') {
            const skew = rect.w * 0.2;
            path.moveTo(rect.x + skew, rect.y);
            path.lineTo(rect.x + rect.w, rect.y);
            path.lineTo(rect.x + rect.w - skew, rect.y + rect.h);
            path.lineTo(rect.x, rect.y + rect.h);
            path.closePath();
        } else if (kind === 'arrow') {
            const shaftTop = cy - ry * 0.28, shaftBottom = cy + ry * 0.28, headX = rect.x + rect.w * 0.62;
            path.moveTo(rect.x, shaftTop);
            path.lineTo(headX, shaftTop);
            path.lineTo(headX, cy - ry * 0.62);
            path.lineTo(rect.x + rect.w, cy);
            path.lineTo(headX, cy + ry * 0.62);
            path.lineTo(headX, shaftBottom);
            path.lineTo(rect.x, shaftBottom);
            path.closePath();
        } else if (kind === 'speech-bubble') {
            // Two subpaths in one fill/stroke — the rounded body plus
            // the tail triangle, matching renderer/slideRenderer.js's
            // own Path2D construction exactly.
            const r = Math.min(rect.w, rect.h) * 0.18, bodyBottom = rect.y + rect.h * 0.78, bh = bodyBottom - rect.y;
            path.moveTo(rect.x + r, rect.y);
            path.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + bh, r);
            path.arcTo(rect.x + rect.w, rect.y + bh, rect.x, rect.y + bh, r);
            path.arcTo(rect.x, rect.y + bh, rect.x, rect.y, r);
            path.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
            path.closePath();
            path.moveTo(rect.x + rect.w * 0.22, bodyBottom);
            path.lineTo(rect.x + rect.w * 0.12, rect.y + rect.h);
            path.lineTo(rect.x + rect.w * 0.38, bodyBottom);
            path.closePath();
        } else if (kind === 'banner') {
            const notch = rect.w * 0.14;
            path.moveTo(rect.x, rect.y);
            path.lineTo(rect.x + rect.w, rect.y);
            path.lineTo(rect.x + rect.w - notch, cy);
            path.lineTo(rect.x + rect.w, rect.y + rect.h);
            path.lineTo(rect.x, rect.y + rect.h);
            path.lineTo(rect.x + notch, cy);
            path.closePath();
        } else {
            path.rect(rect.x, rect.y, rect.w, rect.h);
        }
        _paintShapePathTail(ctx, path, rect, style);
    }

    return {
        load: load,
        render: render,
        rectFor: rectFor,
        holderBands: holderBands,
        textFootprint: textFootprint,
        // Builder V3.1 — Working View Experience Studio: exposes the
        // exact same Layer-painting primitive `render()` already uses
        // internally, so an isolated single-Experience view (a small
        // canvas showing just that Experience's own content, cropped
        // away from the rest of the Scene) can reuse it directly rather
        // than reimplementing Text/Image/Graphics/Colour painting a
        // second time. Takes a plain `{kind, position, size, ...}`
        // object exactly like any Scene Layer — the caller decides what
        // `graph` (width/height/resolveLayerImage) means for its own
        // canvas, this function has no opinion about it.
        paintLayer: _paintLayer
    };
})();

if (typeof window !== 'undefined') window.EngineV2Runtime = EngineV2Runtime;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineV2Runtime;
