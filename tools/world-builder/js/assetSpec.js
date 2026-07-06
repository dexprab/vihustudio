// js/assetSpec.js — Sprint B2.0. The World Asset Spec contract, as data.
// docs/WORLD_ASSET_SPEC.md documents this exact schema in prose; this
// module is its Builder-readable mirror, the same relationship
// js/services/constants.js already has with docs/THEME_PROJECT_SPEC.md.
// The Assets Workspace state (js/worldBuilderApp.js) renders entirely
// from AssetSpec.resolve(project) — there is no per-category or
// per-slot markup hardcoded in the Assets screen itself.
const AssetSpec = (function () {
    'use strict';

    // Fixed, generic optional slots for categories not derived from the
    // Project's own authored data. Deliberately modest — a World is not
    // required to fill any of these to be valid and buildable; only
    // Identity's two slots are required (see docs/WORLD_ASSET_SPEC.md).
    const CATEGORIES = [
        {
            id: 'identity',
            label: 'Identity',
            description: 'The two images every World must have.',
            slots: [
                {
                    id: 'thumbnail', displayName: 'Thumbnail', required: true,
                    path: 'thumbnail.png', formats: ['png', 'jpg', 'webp'],
                    recommendedDimensions: '512×512', recommendedResolution: '72–150 DPI',
                    usedBy: 'manifest.thumbnail — this World\'s card in every World-picker list',
                    purpose: 'Identifies this World at a glance.',
                    previewType: 'square',
                    validationRules: ['Square aspect recommended', 'Must be a raster image']
                },
                {
                    id: 'hero', displayName: 'Hero Image', required: true,
                    path: 'preview.png', formats: ['png', 'jpg', 'webp'],
                    recommendedDimensions: '1600×1200', recommendedResolution: '72–150 DPI',
                    usedBy: 'metadata.previewImage — this World\'s larger identity image',
                    purpose: 'A bigger, richer image representing this World.',
                    previewType: 'landscape',
                    validationRules: ['Landscape aspect recommended']
                }
            ]
        },
        {
            id: 'frames',
            label: 'Frames',
            description: 'An optional preview image per Frame Variation this World authors.',
            dynamic: 'frames'
        },
        {
            id: 'textures',
            label: 'Textures',
            description: 'Optional paper/material textures a Frame can reference.',
            slots: [
                { id: 'canvas', displayName: 'Canvas Texture', required: false, path: 'assets/textures/canvas.png', formats: ['png', 'jpg'], recommendedDimensions: '512×512', recommendedResolution: '72 DPI', usedBy: 'Frame paper texture', purpose: 'A tileable canvas/paper texture.', previewType: 'square', validationRules: ['Should tile seamlessly'] },
                { id: 'linen', displayName: 'Linen Texture', required: false, path: 'assets/textures/linen.png', formats: ['png', 'jpg'], recommendedDimensions: '512×512', recommendedResolution: '72 DPI', usedBy: 'Frame paper texture', purpose: 'A tileable linen texture.', previewType: 'square', validationRules: ['Should tile seamlessly'] }
            ]
        },
        {
            id: 'decorations',
            label: 'Decorations',
            description: 'Optional decorative stickers or motifs a Layer Pack can place.',
            slots: [
                { id: 'motif-1', displayName: 'Decoration 1', required: false, path: 'assets/decorations/motif-1.png', formats: ['png'], recommendedDimensions: '256×256', recommendedResolution: '72 DPI', usedBy: 'A sticker-type Layer', purpose: 'A decorative motif.', previewType: 'square', validationRules: ['Transparent background recommended'] },
                { id: 'motif-2', displayName: 'Decoration 2', required: false, path: 'assets/decorations/motif-2.png', formats: ['png'], recommendedDimensions: '256×256', recommendedResolution: '72 DPI', usedBy: 'A sticker-type Layer', purpose: 'A decorative motif.', previewType: 'square', validationRules: ['Transparent background recommended'] }
            ]
        },
        {
            id: 'icons',
            label: 'Icons',
            description: 'Optional small icon glyphs, for when an emoji placeholder is not enough.',
            slots: [
                { id: 'icon-1', displayName: 'Icon 1', required: false, path: 'assets/icons/icon-1.png', formats: ['png', 'svg'], recommendedDimensions: '64×64', recommendedResolution: '72 DPI', usedBy: 'World or Representation thumbnail', purpose: 'A small icon glyph.', previewType: 'square', validationRules: ['Transparent background recommended'] }
            ]
        },
        {
            id: 'fonts',
            label: 'Fonts',
            description: 'Optional custom fonts for this World\'s typography.',
            slots: [
                { id: 'display-font', displayName: 'Display Font', required: false, path: 'assets/fonts/display.woff2', formats: ['woff2', 'ttf'], recommendedDimensions: '—', recommendedResolution: '—', usedBy: 'storyText/caption typography', purpose: 'A custom display font.', previewType: 'none', validationRules: ['Must be a valid font file'] }
            ]
        },
        {
            id: 'backgrounds',
            label: 'Backgrounds',
            description: 'Optional full-bleed background art a Layout can use.',
            slots: [
                { id: 'bg-1', displayName: 'Background 1', required: false, path: 'assets/backgrounds/bg-1.png', formats: ['png', 'jpg'], recommendedDimensions: '1600×1200', recommendedResolution: '72 DPI', usedBy: 'Slide/page background', purpose: 'A full-bleed background image.', previewType: 'landscape', validationRules: ['Landscape aspect recommended'] }
            ]
        }
    ];

    function _frameSlots(project) {
        if (!window.ProjectModel) return [];
        return window.ProjectModel.frames(project).map(function (f) {
            return {
                id: f.id, displayName: f.name + ' Preview', required: false,
                path: 'assets/frames/' + f.id + '.png', formats: ['png', 'jpg'],
                recommendedDimensions: '512×512', recommendedResolution: '72 DPI',
                usedBy: 'Frame "' + f.name + '" picker preview',
                purpose: 'A preview thumbnail for this Frame Variation.',
                previewType: 'square',
                validationRules: ['Square aspect recommended']
            };
        });
    }

    // Every category, fully resolved for one project — dynamic
    // categories expanded, every slot's `filled` computed from the
    // project's own files.
    function resolve(project) {
        return CATEGORIES.map(function (cat) {
            const rawSlots = cat.dynamic === 'frames' ? _frameSlots(project) : (cat.slots || []);
            const slots = rawSlots.map(function (slot) {
                return Object.assign({}, slot, {
                    category: cat.id,
                    filled: !!(project.files && project.files[slot.path])
                });
            });
            return { id: cat.id, label: cat.label, description: cat.description, slots: slots };
        });
    }

    function stats(project) {
        const categories = resolve(project);
        let total = 0, filled = 0;
        const requiredMissing = [];
        categories.forEach(function (cat) {
            cat.slots.forEach(function (slot) {
                total++;
                if (slot.filled) filled++;
                else if (slot.required) requiredMissing.push(cat.label + ' → ' + slot.displayName);
            });
        });
        return { total: total, filled: filled, requiredMissing: requiredMissing };
    }

    return { resolve: resolve, stats: stats };
})();
try { window.AssetSpec = AssetSpec; } catch (e) {}
