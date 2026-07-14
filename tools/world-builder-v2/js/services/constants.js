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
// renderer/slideRenderer.js already paints it and no hand-authored
// theme is meant to pick it in the Layer Pack editor (LAYER_TARGETS_OPTS
// in worldBuilderApp.js deliberately still offers only the original
// four), but it must still be a VALID target here: a real compiled
// Theme's layerPack can legitimately contain 'overlay' entries (every
// Scene-converged Text/Image Decoration uses it), and any code path
// that re-validates that compiled output as ordinary layer-pack JSON
// -- e.g. the Clone Official Theme feature's Scene-synthesis
// materializer -- must not reject its own platform's real output.
const LAYER_TARGETS = ['slide', 'frame', 'holder', 'element', 'overlay'];
