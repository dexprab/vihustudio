// js/services/framePresets.js — Simplify Place & Frame Authoring. A
// small, plain data catalog (mirrors engineSchema.js/experienceSchema.js's
// own sibling-file shape) for the Frame Style Gallery: instead of
// starting a new Frame Variation from a blank, hand-tuned baseline, an
// author picks a ready-made look and fine-tunes from there.
//
// Base matWidth/frameThickness/borderColor/wallTone/shadow values for
// the 7 named presets are taken verbatim from the real, already-authored
// official-worlds/MuseumGallery/frames/*.json files (Classic White,
// Warm Ivory, Natural Linen, Dark Gallery, Floating Frame, Black Matte,
// Gold Accent) — those fields already existed and were already tuned
// for Museum Gallery; only background/frame/paper (never authored
// there, since that Theme predates any UI for them) and, for one
// preset, matColor are newly invented here for this feature. 3 further
// presets (Snapshot Corkboard/Polaroid Snap/Taped Sketch) round out
// coverage of every remaining `frame`/`background`/`paper` enum value
// at least once — confirmed by hand-checking the table in the plan
// this catalog implements, not merely asserted.
const FramePresets = (function () {
    'use strict';

    const CATALOG = [
        {
            id: 'classic-white',
            name: 'Classic White',
            description: 'A clean white mat and matching wall — simple, timeless, gallery-standard.',
            swatchColor: '#ffffff',
            fields: {
                matWidth: 24, frameThickness: 2, borderColor: '#ffffff', wallTone: '#ffffff', shadow: 'soft',
                background: 'white', frame: 'white-mat', paper: 'smooth'
            }
        },
        {
            id: 'warm-ivory',
            name: 'Warm Ivory',
            description: 'A soft cream mat and a warm ivory wall — cozy, not clinical.',
            swatchColor: '#f2e8d5',
            fields: {
                matWidth: 26, frameThickness: 3, borderColor: '#d9c7a3', wallTone: '#f2e8d5', shadow: 'soft',
                background: 'cream', frame: 'none', paper: 'smooth'
            }
        },
        {
            id: 'natural-linen',
            name: 'Natural Linen',
            description: 'A textured kraft-paper mat and a muted linen wall, wrapped in real wood.',
            swatchColor: '#e9e2d0',
            fields: {
                matWidth: 24, frameThickness: 2, borderColor: '#c7b99b', wallTone: '#e9e2d0', shadow: 'soft',
                background: 'kraft-paper', frame: 'wood', paper: 'kraft'
            }
        },
        {
            id: 'dark-gallery',
            name: 'Dark Gallery',
            description: 'A dramatic dark wall behind a bright white mat, like a night exhibition.',
            swatchColor: '#1d1f24',
            fields: {
                matWidth: 22, frameThickness: 2, borderColor: '#2a2a2a', wallTone: '#1d1f24', shadow: 'floating',
                background: 'black', frame: 'floating', paper: 'smooth'
            }
        },
        {
            id: 'floating-frame',
            name: 'Floating Frame',
            description: 'No border line at all — the picture appears to float above a wide white mat.',
            swatchColor: '#ffffff',
            fields: {
                matWidth: 56, frameThickness: 0, borderColor: '#ffffff', wallTone: '#ffffff', shadow: 'floating',
                background: 'transparent', frame: 'floating', paper: 'smooth'
            }
        },
        {
            id: 'black-matte',
            name: 'Black Matte',
            description: 'A bold black mat and border on a light wall — modern and graphic.',
            swatchColor: '#0a0a0a',
            fields: {
                matWidth: 20, frameThickness: 2, borderColor: '#0a0a0a', wallTone: '#d6d6d6', shadow: 'floating',
                background: 'watercolor-paper', frame: 'tape', paper: 'watercolor'
            }
        },
        {
            id: 'gold-ornate',
            name: 'Gold Ornate',
            description: 'A rich burgundy mat inside a warm, premium gold border — the classic ornate gallery look.',
            swatchColor: '#c9a227',
            fields: {
                matWidth: 24, frameThickness: 4, borderColor: '#c9a227', wallTone: '#f8f2e4', shadow: 'gallery',
                background: 'color', matColor: '#8B2C3B', frame: 'wood', paper: 'canvas'
            }
        },
        {
            id: 'snapshot-corkboard',
            name: 'Snapshot Corkboard',
            description: 'Pinned right to a real corkboard — casual and playful.',
            swatchColor: '#c49a6c',
            fields: {
                matWidth: 18, frameThickness: 0, borderColor: '#8a6d3b', wallTone: '#c49a6c', shadow: 'soft',
                background: 'bulletin-board', frame: 'bulletin-board', paper: 'handmade'
            }
        },
        {
            id: 'polaroid-snap',
            name: 'Polaroid Snap',
            description: 'A classic instant-photo look — a thick white bottom border, ready for a caption.',
            swatchColor: '#ffffff',
            fields: {
                matWidth: 16, frameThickness: 0, borderColor: '#ffffff', wallTone: '#eeeeee', shadow: 'soft',
                background: 'white', frame: 'polaroid', paper: 'smooth'
            }
        },
        {
            id: 'taped-sketch',
            name: 'Taped Sketch',
            description: 'A notebook-paper mat taped up at the corners, like a page pulled from a sketchbook.',
            swatchColor: '#f5f0e6',
            fields: {
                matWidth: 20, frameThickness: 1, borderColor: '#cfc8b8', wallTone: '#f5f0e6', shadow: 'none',
                background: 'notebook-paper', frame: 'tape', paper: 'notebook'
            }
        }
    ];

    function get(id) {
        return CATALOG.find(function (p) { return p.id === id; }) || null;
    }

    return { CATALOG: CATALOG, get: get };
})();

try { window.FramePresets = FramePresets; } catch (e) {}
