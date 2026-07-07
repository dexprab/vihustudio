// js/services/engineSchema.js — Builder V2. The small, fixed vocabulary
// Engine V2 Canon defines for Canvas (docs/ENGINE_V2_CANON.md §4) and
// Engine Scene Templates (§10): Aspect Ratio choices, their derived pixel
// Size (Blueprint §7 — "Size is not an independent lever... derived from
// one fixed base resolution," never a Theme-Author-typed number), and the
// starting Holder arrangement each Engine Scene Template pre-populates.
//
// This is authoring-time data, also consumed directly by the native
// Engine V2 Runtime (`js/services/engineRuntime.js`, LOCK V2-04) for
// pixel-size resolution — the same vocabulary, not a second copy of it.
// It has no relationship to the Engine V1 pipeline (`js/themeEngine.js`,
// `renderer/slideRenderer.js`), which still speaks Engine V1's
// Representation/Layout/Frame/Layer-Pack vocabulary and remains legacy,
// unmodified, per `docs/ENGINE_V2_SCENE_MODEL.md` §6. No Engine V2
// compiled-package *format* exists yet in any frozen document — that
// gap (Build's exact output shape) is deliberate and documented, not
// silently bridged here.
const EngineSchema = (function () {
    'use strict';

    // Continuous with Engine V1's own proven aspect vocabulary
    // (Blueprint §7). `safeArea` is a label only, shown verbatim in the
    // Scene Header's glance (Vision §2) — never a numeric field a Theme
    // Author edits directly.
    const ASPECT_RATIOS = {
        portrait: { label: 'Portrait', icon: '📄', width: 1080, height: 1350, safeArea: 'Instagram Safe Area', safeInset: 0.06 },
        square: { label: 'Square', icon: '⬛', width: 1080, height: 1080, safeArea: 'Instagram Safe Area', safeInset: 0.06 },
        landscape: { label: 'Landscape', icon: '🖼️', width: 1350, height: 1080, safeArea: 'Standard Safe Area', safeInset: 0.05 },
        wide: { label: 'Wide', icon: '📐', width: 1600, height: 900, safeArea: 'Standard Safe Area', safeInset: 0.05 },
        'full-bleed': { label: 'Full Bleed', icon: '🌌', width: 1080, height: 1920, safeArea: 'Edge-to-Edge (no Safe Area)', safeInset: 0 },
        quote: { label: 'Quote', icon: '💬', width: 1080, height: 1350, safeArea: 'Instagram Safe Area', safeInset: 0.08 }
    };

    const ASPECT_ORDER = ['portrait', 'landscape', 'square', 'wide', 'full-bleed', 'quote'];

    // Fractional (0..1) Holder rects, independent of pixel size, so the
    // same starting arrangement applies regardless of which Aspect Ratio
    // a Scene Template defaults to.
    const HOLDER_LAYOUTS = {
        none: [],
        single: [{ x: 0.10, y: 0.12, w: 0.80, h: 0.62 }],
        dual: [
            { x: 0.06, y: 0.18, w: 0.42, h: 0.58 },
            { x: 0.52, y: 0.18, w: 0.42, h: 0.58 }
        ],
        triple: [
            { x: 0.05, y: 0.20, w: 0.28, h: 0.50 },
            { x: 0.36, y: 0.20, w: 0.28, h: 0.50 },
            { x: 0.67, y: 0.20, w: 0.28, h: 0.50 }
        ],
        grid4: [
            { x: 0.06, y: 0.08, w: 0.40, h: 0.40 },
            { x: 0.54, y: 0.08, w: 0.40, h: 0.40 },
            { x: 0.06, y: 0.52, w: 0.40, h: 0.40 },
            { x: 0.54, y: 0.52, w: 0.40, h: 0.40 }
        ],
        grid6: [
            { x: 0.04, y: 0.10, w: 0.29, h: 0.38 },
            { x: 0.355, y: 0.10, w: 0.29, h: 0.38 },
            { x: 0.67, y: 0.10, w: 0.29, h: 0.38 },
            { x: 0.04, y: 0.52, w: 0.29, h: 0.38 },
            { x: 0.355, y: 0.52, w: 0.29, h: 0.38 },
            { x: 0.67, y: 0.52, w: 0.29, h: 0.38 }
        ]
    };

    // The fixed set of Engine Scene Templates a new Scene must start
    // from (Engine Canon §10, §12 item 2 — "no persisted link" is this
    // canon's own assumption, so a Scene records which Template it
    // started from purely as display provenance, never a live binding a
    // "reset to template" tool could later use).
    const SCENE_TEMPLATES = [
        { id: 'single-holder', name: 'Single Holder', icon: '🖼️', description: 'One photo, presented simply.', defaultAspect: 'portrait', holderLayout: 'single' },
        { id: 'dual-holder', name: 'Dual Holder', icon: '🖇️', description: 'Two photos, side by side.', defaultAspect: 'landscape', holderLayout: 'dual' },
        { id: 'quote', name: 'Quote', icon: '💬', description: 'Words alone — no photo.', defaultAspect: 'quote', holderLayout: 'none' },
        { id: 'cover', name: 'Cover', icon: '📕', description: 'A title page for this World.', defaultAspect: 'portrait', holderLayout: 'single' },
        { id: 'timeline', name: 'Timeline', icon: '🕰️', description: 'A sequence of moments.', defaultAspect: 'landscape', holderLayout: 'triple' },
        { id: 'comic', name: 'Comic', icon: '💥', description: 'Panels telling one beat.', defaultAspect: 'square', holderLayout: 'grid4' },
        { id: 'gallery', name: 'Gallery', icon: '🖼️', description: 'Many photos, one page.', defaultAspect: 'wide', holderLayout: 'grid6' }
    ];

    function findSceneTemplate(id) {
        return SCENE_TEMPLATES.find(function (t) { return t.id === id; }) || SCENE_TEMPLATES[0];
    }

    function aspectInfo(aspectId) {
        return ASPECT_RATIOS[aspectId] || ASPECT_RATIOS.portrait;
    }

    // Holder vocabulary (Engine Canon §6 — Shape is the Holder's own
    // clip/mask, Fit is how the Primary Element resolves against its
    // bounds; both continuous with the current engine's proven set).
    const HOLDER_SHAPES = [
        { value: 'rectangle', label: 'Rectangle' },
        { value: 'rounded', label: 'Rounded Rectangle' },
        { value: 'circle', label: 'Circle' }
    ];

    const HOLDER_FITS = [
        { value: 'fit', label: 'Fit (show the whole photo)' },
        { value: 'fill', label: 'Fill (crop to the frame)' },
        { value: 'original', label: 'Original (natural size)' }
    ];

    return {
        ASPECT_RATIOS: ASPECT_RATIOS,
        ASPECT_ORDER: ASPECT_ORDER,
        HOLDER_LAYOUTS: HOLDER_LAYOUTS,
        SCENE_TEMPLATES: SCENE_TEMPLATES,
        HOLDER_SHAPES: HOLDER_SHAPES,
        HOLDER_FITS: HOLDER_FITS,
        findSceneTemplate: findSceneTemplate,
        aspectInfo: aspectInfo
    };
})();
try { window.EngineSchema = EngineSchema; } catch (e) {}
