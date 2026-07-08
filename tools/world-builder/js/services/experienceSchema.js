// js/services/experienceSchema.js — Builder V3 Milestone 2. The small,
// open vocabulary for Experiences: a Builder-only authoring concept
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
const ExperienceSchema = (function () {
    'use strict';

    // `renders` discloses honestly, per type, which Attachment mode (if
    // any) Engine V2 can actually paint today — Milestone 3's own
    // "stop and document gaps" finding, not a limitation invented here.
    // Frame projects onto a Place's existing single Frame slot
    // (Engine Canon §9's Frame Resolution); Decoration/Text project onto
    // a Scene's existing Layer array (Engine Canon §7) when Free. There
    // is no Holder Layer mechanism yet (Scene Model §7, still an open
    // question) for anything to attach to a Place *except* Frame — so
    // "attached" Decoration/Text/Atmosphere/Lighting, and any Attachment
    // for Atmosphere/Lighting at all, record real Usage but paint
    // nothing yet. This is disclosed to the Theme Author directly
    // (worldBuilderApp.js's Inspector), never silently pretended.
    const EXPERIENCE_TYPES = [
        { value: 'frame', label: 'Frame', icon: '🖼️', renders: { attached: true, free: false } },
        { value: 'decoration', label: 'Decoration', icon: '✨', renders: { attached: false, free: true } },
        { value: 'text', label: 'Text', icon: '✍️', renders: { attached: false, free: true } },
        { value: 'atmosphere', label: 'Atmosphere', icon: '🌫️', renders: { attached: false, free: false } },
        { value: 'lighting', label: 'Lighting', icon: '💡', renders: { attached: false, free: false } },
        { value: 'text-style', label: 'Text Style', icon: '🔤', renders: { attached: false, free: false } }
    ];

    // Attachment (Attached/Free) is independent of Lifecycle/Ownership —
    // this is the *intended* attachment kind, chosen at creation time,
    // before any real placement exists (Milestone 3).
    const EXPERIENCE_ATTACHMENTS = [
        { value: 'attached', label: 'Attached — lives inside a Place' },
        { value: 'free', label: 'Free — roams a Scene' }
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

    // Whether `type` can actually be painted by Engine V2 today when
    // attached the given way (`'attached'` or `'free'`) — see the
    // EXPERIENCE_TYPES comment above for why this isn't uniformly true.
    function rendersWhenAttached(type, attachment) {
        const t = findType(type);
        return !!(t.renders && t.renders[attachment]);
    }

    return {
        EXPERIENCE_TYPES: EXPERIENCE_TYPES,
        EXPERIENCE_ATTACHMENTS: EXPERIENCE_ATTACHMENTS,
        LIFECYCLE_LABELS: LIFECYCLE_LABELS,
        findType: findType,
        lifecycleInfo: lifecycleInfo,
        defaultProperties: defaultProperties,
        rendersWhenAttached: rendersWhenAttached
    };
})();
try { window.ExperienceSchema = ExperienceSchema; } catch (e) {}
