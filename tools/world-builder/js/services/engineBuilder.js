// js/services/engineBuilder.js — Engine V2 Build
// (docs/ENGINE_V2_SCENE_MODEL.md §5, LOCK V2-02/V2-04). Compiles a
// validated World's Scenes into a package — a pure function from the
// canonical Scene Model to a package object, never a stage that
// requires additional undocumented fields (§5's own "Build is a pure
// function from Scene Model to package" rule).
//
// Package format is a genuine implementation decision this module
// makes, not an architectural one — Scene Model §5 explicitly declines
// to pick a format ("Do not invent compiled package formats as the
// canonical representation... an ordinary implementation decision for
// whoever builds Build"). This is a plain, disclosed choice: a flat
// JSON envelope (`format`/`formatVersion`) carrying World identity
// (manifest/metadata/theme — unchanged in shape from Engine V1, Scene
// Model §2's own World row), every Scene exactly as authored, and every
// Frame a Scene's Holders might reference (the model's one
// cross-reference, Scene Model §2). No `assets/` folder — every Frame
// field is an enum resolved to a drawn canvas routine today, not a
// raster image, the same reasoning Museum Gallery's own Engine V1
// package used. Deliberately not named `.vtheme` and not shaped like
// one — Engine V1's compiled format and this one are not
// interchangeable, and giving them the same name would misleadingly
// suggest they were (LOCK V2-04 — no translation layer, no merging).
const EngineV2Builder = (function () {
    'use strict';

    // Requires Engine V2 Validation to report zero errors first —
    // mirrors Engine V1's own established Build-requires-Validation
    // convention (tools/world-builder/js/services/builder.js via
    // js/projectCompiler.js). Warnings do not block Build; only errors
    // do, since a warning (e.g. "Stack needed automatic repair") is
    // already corrected by the time Build reads the reconciled data.
    function build(project) {
        const validation = window.EngineV2Validator.validate(project);
        if (!validation.isValid) {
            return { ok: false, errors: validation.errors, warnings: validation.warnings };
        }

        const pkg = {
            format: 'engine-v2-world-package',
            formatVersion: 1,
            manifest: window.ProjectModel.manifest(project),
            metadata: window.ProjectModel.metadata(project),
            theme: window.ProjectModel.theme(project),
            scenes: window.ProjectModel.scenes(project),
            frames: window.ProjectModel.frames(project),
            builtAt: new Date().toISOString()
        };

        return { ok: true, package: pkg, warnings: validation.warnings };
    }

    return { build: build };
})();

if (typeof window !== 'undefined') window.EngineV2Builder = EngineV2Builder;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineV2Builder;
