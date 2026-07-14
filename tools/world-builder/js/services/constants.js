// World Builder — internal Build service constants.
//
// Sprint B1.0 — retired alongside the rest of the old Theme Compiler UI:
// PAGES/PAGE_METADATA/VALIDATION_STATES/BUILD_STATES/EVENTS (dashboard
// navigation + pub/sub state for a UI that no longer exists). Only the
// runtime-contract mirror survives, because validator.js still checks
// against it — these enums are not this tool's own invention, they
// mirror the exact contract docs/THEME_PROJECT_SPEC.md defines and
// js/themeRegistry.js / renderer/slideRenderer.js already consume, so
// the validator checks against the same values the importer and
// renderer do.
const THEME_TYPES = ['story', 'artwork'];
const DEFAULT_THEME_TYPE = 'story';
const LAYOUT_ASPECTS = ['portrait', 'landscape', 'square', 'wide', 'quote', 'full-bleed'];
const LAYER_TYPES = ['text', 'sticker', 'decoration'];
// 'overlay' is the Builder Convergence Sprint's 5th containership
// scope (docs/THEME_PROJECT_SPEC.md §7, docs/THEME_CONTRACT.md §6) --
// this builder.js's own convergeScenes() already emits it for every
// Scene-converged Text/Image Decoration (see convergeSceneLayer's
// target selection a few lines below in builder.js), so the validator
// must accept it too; found and fixed as the same latent gap that
// blocked cloning an Official Theme in world-builder-v2 (its own
// constants.js carries the identical fix, same reasoning).
const LAYER_TARGETS = ['slide', 'frame', 'holder', 'element', 'overlay'];
