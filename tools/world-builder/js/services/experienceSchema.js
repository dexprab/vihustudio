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

    const EXPERIENCE_TYPES = [
        { value: 'frame', label: 'Frame', icon: '🖼️' },
        { value: 'decoration', label: 'Decoration', icon: '✨' },
        { value: 'atmosphere', label: 'Atmosphere', icon: '🌫️' },
        { value: 'lighting', label: 'Lighting', icon: '💡' },
        { value: 'text-style', label: 'Text Style', icon: '✍️' }
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

    return {
        EXPERIENCE_TYPES: EXPERIENCE_TYPES,
        EXPERIENCE_ATTACHMENTS: EXPERIENCE_ATTACHMENTS,
        LIFECYCLE_LABELS: LIFECYCLE_LABELS,
        findType: findType,
        lifecycleInfo: lifecycleInfo
    };
})();
try { window.ExperienceSchema = ExperienceSchema; } catch (e) {}
