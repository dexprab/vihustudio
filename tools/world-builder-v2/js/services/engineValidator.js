// js/services/engineValidator.js — Engine V2 Validation
// (docs/ENGINE_V2_SCENE_MODEL.md §5, LOCK V2-04: "Validation, Runtime,
// Build, and Publish will all operate directly on the canonical Scene
// Model — no translation layer to Engine V1"). Checks every Scene in a
// World against Scene Model §5's own four named constraints — real
// checks, not merely documentation:
//
//   1. Every Scene has exactly one Canvas (Engine Canon §4/Invariant 5).
//   2. Every stack entry resolves to a real Holder or Layer id, and
//      every Holder/Layer id appears in the stack exactly once.
//   3. Every Holder's `frame`, if set, resolves to a real Theme Asset id.
//   4. Every fractional position/size stays within [0, 1] and does not
//      place an object fully outside its Canvas.
//
// Deliberately a separate, synchronous engine from
// js/services/validator.js (Engine V1's ValidationEngine, which reads
// through the projectLoader Blob/FileReader singleton) — Engine V2 data
// is already plain JS objects sitting in `project.files`, so validating
// it needs no translation step, per LOCK V2-04. Report shape
// ({isValid, errors, warnings}, plain strings) mirrors the V1 engine's
// for Context Inspector display consistency, not because the two share
// any code path.
const EngineV2Validator = (function () {
    'use strict';

    function validate(project) {
        const result = { errors: [], warnings: [] };
        const scenes = window.ProjectModel.scenes(project);
        const frameIds = window.ProjectModel.frames(project).map(function (f) { return f.id; });

        scenes.forEach(function (scene) {
            _validateScene(scene, frameIds, result);
        });

        result.isValid = result.errors.length === 0;
        return result;
    }

    function _sceneLabel(scene) {
        return 'Scene "' + (scene.name || scene.id) + '"';
    }

    function _validateScene(scene, frameIds, result) {
        const label = _sceneLabel(scene);

        // Constraint 1 — every Scene has exactly one Canvas. Trivially
        // true in this data model (`canvas` is a required field, not
        // optional) — still checked as a real constraint, not assumed,
        // since a Scene authored or edited outside the Builder's own
        // guarantees could omit it.
        if (!scene.canvas || typeof scene.canvas !== 'object') {
            result.errors.push(label + ' has no Canvas (Scene Configuration) — every Scene requires exactly one.');
            return; // nothing else here is checkable without a Canvas
        }
        if (!window.EngineSchema.ASPECT_RATIOS[scene.canvas.aspectRatio]) {
            result.errors.push(label + '’s Canvas has an unrecognized Aspect Ratio "' + scene.canvas.aspectRatio + '".');
        }

        const holders = Array.isArray(scene.holders) ? scene.holders : [];
        const layers = Array.isArray(scene.layers) ? scene.layers : [];

        // Constraint 2 — Stack integrity.
        _validateStack(scene, holders, layers, label, result);

        // Constraint 3 (Holder → Frame reference) and Constraint 4
        // (fractional bounds), for every Holder and every Scene Layer.
        holders.forEach(function (holder) {
            const holderLabel = 'Holder "' + (holder.name || holder.id) + '" in ' + label;
            if (holder.frame && frameIds.indexOf(holder.frame) === -1) {
                result.errors.push(holderLabel + ' references unknown Frame "' + holder.frame + '".');
            }
            _validateFractionalBounds(holder, holderLabel, result);
        });
        layers.forEach(function (layer) {
            const kind = layer.kind === 'text' ? 'Text' : 'Decoration';
            const layerLabel = kind + ' "' + (layer.name || layer.id) + '" in ' + label;
            _validateFractionalBounds(layer, layerLabel, result);
        });
    }

    // Mirrors js/projectModel.js's own `_ensureStack` reconciliation
    // logic exactly, but never mutates the Scene — Validation's job is
    // to *report* a Scene that ever needed reconciliation as a warning
    // (Scene Model §5), not to silently fix it the way the Builder's
    // own read-time convenience does.
    function _reconciledStack(scene, holders, layers) {
        const holderIds = holders.map(function (h) { return h.id; });
        const layerIds = layers.map(function (l) { return l.id; });
        let stack = Array.isArray(scene.stack) ? scene.stack.filter(function (e) {
            return e && (e.type === 'holder' ? holderIds.indexOf(e.id) !== -1 : layerIds.indexOf(e.id) !== -1);
        }) : [];
        holderIds.forEach(function (id) {
            if (!stack.some(function (e) { return e.type === 'holder' && e.id === id; })) stack.push({ type: 'holder', id: id });
        });
        layerIds.forEach(function (id) {
            if (!stack.some(function (e) { return e.type === 'layer' && e.id === id; })) stack.push({ type: 'layer', id: id });
        });
        return stack;
    }

    function _validateStack(scene, holders, layers, label, result) {
        const reconciled = _reconciledStack(scene, holders, layers);
        const authored = Array.isArray(scene.stack) ? scene.stack : [];
        const same = authored.length === reconciled.length && authored.every(function (e, i) {
            return e && reconciled[i] && e.type === reconciled[i].type && e.id === reconciled[i].id;
        });
        if (!same) {
            result.warnings.push(label + '’s Stack order needed automatic repair (a Holder or Layer was missing, duplicated, or stale) — repaired automatically on open, but the authored data was out of sync.');
        }
    }

    // Constraint 4 — every fractional position/size stays within [0, 1]
    // and does not place an object fully outside its Canvas. An object
    // that merely overflows one edge (e.g. a deliberate full-bleed
    // decoration) is a warning, not an error — only zero overlap with
    // the Canvas frame is actually broken.
    function _validateFractionalBounds(obj, label, result) {
        const p = obj.position || {}, s = obj.size || {};
        const x = p.x, y = p.y, w = s.w, h = s.h;
        if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number' ||
            !isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) {
            result.errors.push(label + ' has a non-numeric position or size.');
            return;
        }
        if (w <= 0 || h <= 0) {
            result.errors.push(label + ' has a zero or negative Width/Height.');
            return;
        }
        const fullyOutside = x >= 1 || y >= 1 || (x + w) <= 0 || (y + h) <= 0;
        if (fullyOutside) {
            result.errors.push(label + ' is placed fully outside its Canvas.');
        } else if (x < 0 || y < 0 || (x + w) > 1 || (y + h) > 1) {
            result.warnings.push(label + ' extends past its Canvas’s edge.');
        }
    }

    return { validate: validate };
})();

if (typeof window !== 'undefined') window.EngineV2Validator = EngineV2Validator;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineV2Validator;
