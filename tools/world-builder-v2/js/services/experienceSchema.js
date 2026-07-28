// js/services/experienceSchema.js — Builder V3. The small, open
// vocabulary for Experiences: a Builder-only authoring concept
// (docs/BUILDER_V3_EXPERIENCE_STUDIO.md, docs/BUILDER_V2_EXPERIENCE_CANON.md)
// that enriches Foundation (a Scene or a Place) without ever being owned
// by either — ownership always belongs to the Theme. This is
// deliberately separate from js/services/engineSchema.js — Experience
// is explicitly a Builder concept, never an Engine V2 Canon one
// ("It is not an Engine concept," Experience Canon §2).
//
// EXPERIENCE_TYPES is a starting vocabulary, not a closed enum baked
// into CRUD logic elsewhere — adding a future Experience type never
// requires touching js/projectModel.js's Experience functions, only
// this list. Frame is one entry among many, never a hardcoded shape of
// its own (Milestone 2's own explicit instruction: "Do not build around
// Frames. Frames should become one Experience type.").
//
// Canon Alignment Sprint: "Attachment" (a two-way Attached/Free split)
// is replaced by "Hosted By" (Place / Scene / Free) — the product
// model's own vocabulary for where an Experience lives, independent of
// how any particular engine happens to implement that hosting. Whether
// and how a hosted Experience actually paints is an Engine Adapter
// concern (see projectModel.js's _syncExperienceAttachments) — this
// schema only records what the author intended.
const ExperienceSchema = (function () {
    'use strict';

    // `renders` discloses honestly, per type, which Hosted-By mode (if
    // any) the current Engine Adapter can actually paint today —
    // Milestone 3's own "stop and document gaps" finding, not a
    // limitation invented here. This is Engine Adapter metadata riding
    // on a product field: it tells the Inspector what to disclose, but
    // the Hosted-By choice itself remains a product concept regardless
    // of what any engine can currently do with it (Canon Alignment
    // Objective 3 — the field's purpose here is honest disclosure, not
    // engine capability control).
    // "Extend Experiences to Places" — a Theme Author can create only
    // `decoration`-type Experiences through any real, everyday authoring
    // flow (Builder V3.1 retired the Type picker), and `decoration`/
    // `text` already render at Scene/Free via the Universal Content
    // Layer-mirroring mechanism (js/projectModel.js's
    // `_syncUniversalContent`) — Place-hosting now uses that exact same
    // mechanism, just anchored to a specific Place's own rect instead of
    // the whole Scene/canvas (see `_syncExperienceAttachments`'s Place
    // branch and its new `fillMode==='place'` case). `frame` keeps its
    // own separate, unchanged `place:true` (the pre-existing Frame-
    // mirror path, `_mirrorFrame`). `atmosphere`/`lighting`/`text-style`
    // stay `false` on every axis — genuinely reserved vocabulary with no
    // adapter anywhere, unaffected by this change.
    const EXPERIENCE_TYPES = [
        { value: 'frame', label: 'Frame', icon: '🖼️', renders: { place: true, scene: false, free: false } },
        { value: 'decoration', label: 'Decoration', icon: '✨', renders: { place: true, scene: true, free: true } },
        { value: 'text', label: 'Text', icon: '✍️', renders: { place: true, scene: false, free: true } },
        { value: 'atmosphere', label: 'Atmosphere', icon: '🌫️', renders: { place: false, scene: false, free: false } },
        { value: 'lighting', label: 'Lighting', icon: '💡', renders: { place: false, scene: false, free: false } },
        { value: 'text-style', label: 'Text Style', icon: '🔤', renders: { place: false, scene: false, free: false } }
    ];

    // Builder V3.1 — Universal Experience Authoring. The Type picker
    // (EXPERIENCE_TYPES above) no longer adds authoring value — an
    // author never chooses one again. `type` stays as internal Engine
    // Adapter plumbing only (dispatch for the legacy Frame/Text mirror
    // paths, `rendersWhenHosted`'s Place-hosting disclosure); every new
    // Experience an author creates defaults to this value, per this
    // milestone's own explicit instruction ("may default to the
    // existing Decoration implementation. ... This is an implementation
    // detail only.").
    const DEFAULT_EXPERIENCE_TYPE = 'decoration';

    // The four universal content sections every Experience exposes,
    // regardless of `type` ("Do not hide sections based on Type").
    // Namespaced field names (`textContent`, `imageSrc`, `graphicSrc`,
    // `colorValue`, ...) are deliberately new and distinct from every
    // legacy per-type field (`text`, `image`, `color`, `font`...) so
    // this is purely additive — a pre-existing Frame/Decoration/Text
    // Experience's legacy fields are never touched or reinterpreted,
    // only migrated-copied into these new fields once
    // (js/projectModel.js's `_ensureExperienceDefaults`), so its
    // historical rendering is provably unaffected by this milestone.
    // hostedBy (optional): when 'scene' OR 'place', seed every content
    // section's Transform to full-bleed (0,0,1,1) — 'scene' fills the
    // whole Scene; 'place' fills the whole Place its own fractional rect
    // is resolved against ("Extend Experiences to Places" — a Place-
    // hosted part's position/size are interpreted relative to the
    // Place's own current rect at paint time, never the Scene's, so
    // "full bleed" here means "fills the Place," not the Canvas). Both
    // are editable/resizable afterward, unlike the one, unrelated
    // read-only case that remains (a `type:'frame'` Experience Hosted By
    // Place still projects onto the Place's own Frame slot via
    // `_mirrorFrame`, never onto one of these ordinary Layers — see
    // worldBuilderApp.js's `_contentTransformFields`). Any other value
    // (or omitted) keeps the small partial-rect defaults that a
    // Free-hosted Experience has always started with.
    function defaultUniversalContent(hostedBy) {
        const fillBleed = hostedBy === 'scene' || hostedBy === 'place';
        return {
            // Text
            textContent: '',
            textFont: 'Georgia, serif',
            textSize: 32,
            textWeight: 'normal',
            textAlign: 'left',
            textColor: '#1D3457',
            textOpacity: 1,
            textRotation: 0,
            textX: fillBleed ? 0 : 0.1, textY: fillBleed ? 0 : 0.1, textW: fillBleed ? 1 : 0.6, textH: fillBleed ? 1 : 0.25,
            // Image
            imageSrc: null,
            imageFit: 'fit',
            imageOpacity: 1,
            imageRotation: 0,
            imageX: fillBleed ? 0 : 0.1, imageY: fillBleed ? 0 : 0.4, imageW: fillBleed ? 1 : 0.4, imageH: fillBleed ? 1 : 0.4,
            // Graphics (reusable SVG/PNG visual assets — icons, stickers)
            graphicSrc: null,
            graphicOpacity: 1,
            graphicX: fillBleed ? 0 : 0.55, graphicY: fillBleed ? 0 : 0.4, graphicW: fillBleed ? 1 : 0.3, graphicH: fillBleed ? 1 : 0.3,
            // A Graphics section may alternatively hold an author-drawn
            // Shape (SHAPE_KINDS below) instead of an uploaded image —
            // mutually exclusive with graphicSrc by construction (the
            // Inspector clears one when the other is picked). Shares the
            // same graphicX/Y/W/H Transform and graphicOpacity a Graphics
            // image already has; only the styling is shape-specific.
            graphicShape: null,
            graphicFillColor: '#F0B429',
            graphicFillOpacity: 1,
            graphicStrokeColor: '#24406B',
            graphicStrokeOpacity: 1,
            graphicStrokeWidth: 0,
            graphicRotation: 0,
            // Only populated when graphicShape === 'custom' (the "Draw
            // Your Own" shape, SHAPE_KINDS below) — an array of
            // {x,y} points, each 0..1 fractional within the shape's own
            // Draw pad, later mapped onto whatever rect the Transform
            // places it at (identical placement math every other
            // shape/image already uses). Null until the creator has
            // actually drawn something.
            graphicCustomPath: null,
            // Colour — a fill behind whatever other content exists;
            // `colorTransparent` defaults true so a brand-new Experience
            // with only Text/Image/Graphics never paints an unwanted
            // opaque box.
            colorValue: '#F4F1EC',
            colorOpacity: 1,
            colorTransparent: true
        };
    }

    // Multi-Asset Experience Parts — "incorporate multiple assets in
    // single experience... combinations... not exceeding 5," with
    // repeats of the same kind allowed (e.g. two Image parts). An
    // Experience's real content lives at `experience.properties.parts`,
    // an array of up to MAX_EXPERIENCE_PARTS `{id, kind, props}`
    // objects — `props` reuses the EXACT field names
    // `defaultUniversalContent` already defines for that kind, just
    // nested one level into the part instead of sitting flat on
    // `experience.properties`, so every existing literal-string-keyed
    // call site (Transform builders, Collection's registration hook,
    // the compile step) needs no rename, only a different read
    // location. PART_FIELD_KEYS is the one place that enumerates which
    // of `defaultUniversalContent`'s keys belong to which kind, so
    // `defaultPartProps` below never duplicates a hardcoded default —
    // it always derives from that one real source.
    const MAX_EXPERIENCE_PARTS = 5;
    const PART_FIELD_KEYS = {
        text: ['textContent', 'textFont', 'textSize', 'textWeight', 'textAlign', 'textColor', 'textOpacity', 'textRotation', 'textX', 'textY', 'textW', 'textH'],
        image: ['imageSrc', 'imageFit', 'imageOpacity', 'imageRotation', 'imageX', 'imageY', 'imageW', 'imageH'],
        graphics: ['graphicSrc', 'graphicOpacity', 'graphicX', 'graphicY', 'graphicW', 'graphicH', 'graphicShape', 'graphicFillColor', 'graphicFillOpacity', 'graphicStrokeColor', 'graphicStrokeOpacity', 'graphicStrokeWidth', 'graphicRotation', 'graphicCustomPath'],
        colour: ['colorValue', 'colorOpacity', 'colorTransparent']
    };
    function defaultPartProps(kind, hostedBy) {
        const all = defaultUniversalContent(hostedBy);
        const keys = PART_FIELD_KEYS[kind] || PART_FIELD_KEYS.text;
        const out = {};
        keys.forEach(function (k) { out[k] = all[k]; });
        return out;
    }

    // Hosted By is independent of Lifecycle/Ownership — this is the
    // *intended* hosting, chosen at creation time, before any real
    // placement exists (Milestone 3), and later exercised for real by
    // Attach/Reuse Existing.
    const EXPERIENCE_HOSTS = [
        { value: 'place', label: 'A Place — lives inside one Place' },
        { value: 'scene', label: 'A Scene — behind the picture frame, full bleed by default' },
        { value: 'free', label: 'Free — in front of the picture, position and size however you like' }
    ];

    // Author-drawable shapes for the Graphics section's "Pick a Shape"
    // mode — real vector primitives (filled, outlined, resized, rotated
    // per the Experience's own Transform), not a rasterized emoji
    // glyph, since a glyph's own colours can never be recoloured.
    // `engineRuntime.js`'s `_drawShape` is the one place that knows how
    // to actually draw each kind (mirrored by hand in
    // `renderer/slideRenderer.js`'s `_layerDrawShape` for the real
    // Reader-facing Runtime — see that file's own header comment). The
    // basic-geometry primitives (rectangle/triangle/diamond/pentagon/
    // hexagon/octagon/cross/trapezoid/parallelogram) were added
    // alongside the original five decorative shapes so a Theme Author
    // has the standard drawing-tool shape set, not just a handful of
    // ornamental ones.
    const SHAPE_KINDS = [
        { value: 'circle', label: 'Circle', icon: '●' },
        { value: 'rectangle', label: 'Rectangle', icon: '▭' },
        { value: 'rounded-rectangle', label: 'Rounded Rectangle', icon: '▢' },
        { value: 'triangle', label: 'Triangle', icon: '▲' },
        { value: 'diamond', label: 'Diamond', icon: '◆' },
        { value: 'pentagon', label: 'Pentagon', icon: '⬟' },
        { value: 'hexagon', label: 'Hexagon', icon: '⬢' },
        { value: 'octagon', label: 'Octagon', icon: '🛑' },
        { value: 'star', label: 'Star', icon: '★' },
        { value: 'cross', label: 'Cross', icon: '➕' },
        { value: 'trapezoid', label: 'Trapezoid', icon: '⏢' },
        { value: 'parallelogram', label: 'Parallelogram', icon: '▱' },
        { value: 'arrow', label: 'Arrow', icon: '➜' },
        { value: 'speech-bubble', label: 'Speech Bubble', icon: '💬' },
        { value: 'banner', label: 'Banner', icon: '🎗️' },
        // A blank canvas rather than a fixed geometry — see
        // graphicCustomPath above and worldBuilderApp.js's Draw pad.
        { value: 'custom', label: 'Draw Your Own', icon: '✏️' }
    ];

    const LIFECYCLE_LABELS = {
        nurturing: { icon: '🌱', label: 'Nurturing' },
        personal: { icon: '👤', label: 'Personal' },
        public: { icon: '🌍', label: 'Public' }
    };

    function findType(value) {
        return EXPERIENCE_TYPES.find(function (t) { return t.value === value; }) || EXPERIENCE_TYPES[0];
    }

    function lifecycleInfo(lifecycle) {
        return LIFECYCLE_LABELS[lifecycle] || LIFECYCLE_LABELS.nurturing;
    }

    // Mirrors the field shape the existing, proven authoring surface for
    // each type already uses — a Frame Experience's Properties are
    // exactly `_defaultFrameFields()`'s shape (js/projectModel.js), a
    // Decoration/Text Experience's match the existing SceneLayer `kind`
    // fields — so the Milestone 3 mirroring bridge (attachExperience)
    // never has to translate between two different field vocabularies
    // for the same visual idea.
    function defaultProperties(type, hostedBy) {
        let legacy;
        switch (type) {
            case 'frame':
                legacy = { matWidth: 20, frameThickness: 4, borderColor: '#1D3457', wallTone: '#F4F1EC', shadow: 'soft' };
                break;
            case 'decoration':
                legacy = { glyph: '✨', color: '#F4F1EC' };
                break;
            case 'text':
                legacy = { text: '', font: 'Georgia, serif', fontSize: 48, align: 'left', color: '#1D3457' };
                break;
            case 'text-style':
                legacy = { font: 'Georgia, serif', fontSize: 48, align: 'left', color: '#1D3457' };
                break;
            default:
                legacy = { color: '#F4F1EC' };
        }
        // Every Experience gets the universal content sections too,
        // regardless of `type` — legacy fields above remain what the
        // Engine Adapter's Place-hosted Frame mirror reads (unchanged);
        // the universal fields are what Scene/Free hosting now renders.
        // hostedBy is forwarded so a Scene-hosted Experience starts with
        // full-bleed Transforms (matches the pre-editable-sliders default
        // behavior); every other host uses the pre-existing small rects.
        return Object.assign({}, legacy, defaultUniversalContent(hostedBy));
    }

    // Whether `type` can actually be painted by the current Engine
    // Adapter today when hosted the given way (`'place'`, `'scene'`, or
    // `'free'`) — see the EXPERIENCE_TYPES comment above for why this
    // isn't uniformly true.
    function rendersWhenHosted(type, hostedBy) {
        const t = findType(type);
        return !!(t.renders && t.renders[hostedBy]);
    }

    return {
        EXPERIENCE_TYPES: EXPERIENCE_TYPES,
        EXPERIENCE_HOSTS: EXPERIENCE_HOSTS,
        SHAPE_KINDS: SHAPE_KINDS,
        LIFECYCLE_LABELS: LIFECYCLE_LABELS,
        DEFAULT_EXPERIENCE_TYPE: DEFAULT_EXPERIENCE_TYPE,
        MAX_EXPERIENCE_PARTS: MAX_EXPERIENCE_PARTS,
        PART_FIELD_KEYS: PART_FIELD_KEYS,
        findType: findType,
        lifecycleInfo: lifecycleInfo,
        defaultProperties: defaultProperties,
        defaultUniversalContent: defaultUniversalContent,
        defaultPartProps: defaultPartProps,
        rendersWhenHosted: rendersWhenHosted
    };
})();
try { window.ExperienceSchema = ExperienceSchema; } catch (e) {}
