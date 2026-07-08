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
    const EXPERIENCE_TYPES = [
        { value: 'frame', label: 'Frame', icon: '🖼️', renders: { place: true, scene: false, free: false } },
        { value: 'decoration', label: 'Decoration', icon: '✨', renders: { place: false, scene: true, free: true } },
        { value: 'text', label: 'Text', icon: '✍️', renders: { place: false, scene: false, free: true } },
        { value: 'atmosphere', label: 'Atmosphere', icon: '🌫️', renders: { place: false, scene: false, free: false } },
        { value: 'lighting', label: 'Lighting', icon: '💡', renders: { place: false, scene: false, free: false } },
        { value: 'text-style', label: 'Text Style', icon: '🔤', renders: { place: false, scene: false, free: false } }
    ];

    // Hosted By is independent of Lifecycle/Ownership — this is the
    // *intended* hosting, chosen at creation time, before any real
    // placement exists (Milestone 3), and later exercised for real by
    // Attach/Reuse Existing.
    const EXPERIENCE_HOSTS = [
        { value: 'place', label: 'A Place — lives inside one Place' },
        { value: 'scene', label: 'A Scene — fills the whole Scene' },
        { value: 'free', label: 'Free — roams a Scene on its own' }
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
    function defaultProperties(type) {
        switch (type) {
            case 'frame':
                return { matWidth: 20, frameThickness: 4, borderColor: '#1D3457', wallTone: '#F4F1EC', shadow: 'soft' };
            case 'decoration':
                return { glyph: '✨', color: '#F4F1EC' };
            case 'text':
                return { text: '', font: 'Georgia, serif', fontSize: 48, align: 'left', color: '#1D3457' };
            case 'text-style':
                return { font: 'Georgia, serif', fontSize: 48, align: 'left', color: '#1D3457' };
            default:
                return { color: '#F4F1EC' };
        }
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
        LIFECYCLE_LABELS: LIFECYCLE_LABELS,
        findType: findType,
        lifecycleInfo: lifecycleInfo,
        defaultProperties: defaultProperties,
        rendersWhenHosted: rendersWhenHosted
    };
})();
try { window.ExperienceSchema = ExperienceSchema; } catch (e) {}
