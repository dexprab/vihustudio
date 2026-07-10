// Theme Validation Engine
//
// TB-4.6 — Runtime Alignment. Every rule here enforces
// docs/THEME_PROJECT_SPEC.md §11 exactly, using the same field names
// and enums the real import path (js/themeRegistry.js's
// REQUIRED_MANIFEST_FIELDS/REQUIRED_THEME_FIELDS/THEME_TYPES) already
// checks — so a project that validates here is guaranteed to pass
// ThemeRegistry.importPackage(), not just Theme Builder's own opinion
// of "valid".

class ValidationEngine {
    constructor() {
        this.validationRules = this.initializeRules();
        this.lastValidationResult = null;
    }

    /**
     * Initialize validation rules
     */
    initializeRules() {
        return {
            structure: {
                requiredFolders: ['layouts', 'frames', 'layer-packs'],
                requiredFiles: ['manifest.json', 'metadata.json', 'theme.json'],
                requiredAssets: ['preview.png', 'thumbnail.png']
            },
            manifest: {
                // Matches js/themeRegistry.js's REQUIRED_MANIFEST_FIELDS
                // one-for-one, plus builderVersion — a Theme-Builder-only
                // authoring gate (spec §2), not a runtime concern.
                requiredFields: [
                    'id', 'name', 'version', 'builderVersion', 'minStudioVersion',
                    'author', 'description', 'category', 'tags', 'thumbnail',
                    'createdDate', 'updatedDate'
                ],
                stringFields: ['id', 'name', 'author', 'description'],
                versionFormat: /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/
            },
            metadata: {
                requiredFields: ['displayName', 'description', 'category'],
                stringFields: ['displayName', 'description', 'category']
            },
            theme: {
                requiredFields: ['id', 'name'],
                // Matches js/themeRegistry.js's REQUIRED_THEME_FIELDS /
                // REQUIRED_ARTWORK_THEME_FIELDS exactly.
                requiredFieldsByType: {
                    story: ['frame', 'panel', 'storyText', 'footerText', 'watermark'],
                    artwork: []
                }
            },
            ids: {
                pattern: /^[a-z0-9-]+$/,
                minLength: 3,
                maxLength: 50
            }
        };
    }

    /**
     * Validate a theme project
     */
    async validate() {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            details: {}
        };

        if (!projectLoader.isLoaded()) {
            result.isValid = false;
            result.errors.push('No project loaded');
            this.lastValidationResult = result;
            return result;
        }

        // Run all validations
        await this.validateStructure(result);
        await this.validateManifest(result);
        await this.validateMetadata(result);
        await this.validateTheme(result);
        const layouts = await this.validateLayouts(result);
        const frames = await this.validateFrames(result);
        const layerEntries = await this.validateLayerPacks(result);
        const representations = await this.validateRepresentations(result);
        await this.validateAssets(result);
        await this.validateReferences(result, { layouts, frames, layerEntries, representations });

        result.isValid = result.errors.length === 0;
        this.lastValidationResult = result;
        return result;
    }

    /**
     * Validate folder structure
     */
    async validateStructure(result) {
        const structure = projectLoader.projectStructure;
        const details = {};

        // Check required folders — must exist AND contain at least one
        // .json file (an empty folder is not a valid Layer Pack/Layout/
        // Frame source, per spec §11).
        for (const folder of this.validationRules.structure.requiredFolders) {
            const exists = structure[`has${this.capitalize(folder)}`] || structure.folders[folder];
            details[folder] = exists;
            if (!exists) {
                result.errors.push(`Missing required folder: ${folder}/`);
                continue;
            }
            const jsonFiles = projectLoader.getFilesInFolder(folder).filter(f => f.endsWith('.json'));
            if (jsonFiles.length === 0) {
                result.errors.push(`Folder ${folder}/ exists but contains no .json files`);
            }
        }

        // Check required files
        for (const file of this.validationRules.structure.requiredFiles) {
            const exists = structure[`has${this.capitalize(file.split('.')[0])}`];
            details[file] = exists;
            if (!exists) {
                result.errors.push(`Missing required file: ${file}`);
            }
        }

        // Check assets
        if (!structure.hasPreview) {
            result.warnings.push('Missing preview.png (recommended)');
        }
        if (!structure.hasThumbnail) {
            result.warnings.push('Missing thumbnail.png (recommended)');
        }
        if (!structure.hasReadme) {
            result.warnings.push('Missing README.md (recommended)');
        }

        result.details.structure = details;
    }

    /**
     * Validate manifest.json
     */
    async validateManifest(result) {
        const manifest = projectLoader.currentProject?.manifest;
        const details = {};

        if (!manifest) {
            result.errors.push('manifest.json is empty or invalid JSON');
            result.details.manifest = details;
            return;
        }

        // Check required fields
        for (const field of this.validationRules.manifest.requiredFields) {
            if (!(field in manifest) || manifest[field] === null || manifest[field] === undefined) {
                result.errors.push(`manifest.json missing required field: ${field}`);
            } else {
                details[field] = manifest[field];
            }
        }

        // Validate ID format
        if (manifest.id && !this.validateId(manifest.id)) {
            result.errors.push(`manifest.id "${manifest.id}" must be lowercase alphanumeric with hyphens (3-50 chars)`);
        }

        // Validate version formats
        if (manifest.version && !this.validationRules.manifest.versionFormat.test(manifest.version)) {
            result.errors.push(`manifest.version "${manifest.version}" must be semantic (e.g., 1.0.0)`);
        }
        if (manifest.builderVersion && !this.validationRules.manifest.versionFormat.test(manifest.builderVersion)) {
            result.errors.push(`manifest.builderVersion "${manifest.builderVersion}" must be semantic (e.g., 1.0.0)`);
        }
        if (manifest.minStudioVersion && !this.validationRules.manifest.versionFormat.test(manifest.minStudioVersion)) {
            result.errors.push(`manifest.minStudioVersion "${manifest.minStudioVersion}" must be semantic (e.g., 9.5.0)`);
        }

        // Validate type
        if (manifest.type !== undefined && THEME_TYPES.indexOf(manifest.type) === -1) {
            result.warnings.push(`manifest.type "${manifest.type}" is not recognized — normalizes to "${DEFAULT_THEME_TYPE}" at import`);
        }

        result.details.manifest = details;
    }

    /**
     * Validate metadata.json
     */
    async validateMetadata(result) {
        const metadata = projectLoader.currentProject?.metadata;
        const details = {};

        if (!metadata) {
            result.errors.push('metadata.json is empty or invalid JSON');
            result.details.metadata = details;
            return;
        }

        // Check required fields
        for (const field of this.validationRules.metadata.requiredFields) {
            if (!(field in metadata)) {
                result.errors.push(`metadata.json missing required field: ${field}`);
            } else {
                details[field] = metadata[field];
            }
        }

        result.details.metadata = details;
    }

    /**
     * Effective theme type — normalizes an absent/unrecognized
     * manifest.type to 'story', exactly like ThemeRegistry._normalizeManifest.
     */
    effectiveType(manifest) {
        return (manifest && THEME_TYPES.indexOf(manifest.type) !== -1) ? manifest.type : DEFAULT_THEME_TYPE;
    }

    /**
     * Validate theme.json
     */
    async validateTheme(result) {
        const theme = projectLoader.currentProject?.theme;
        const manifest = projectLoader.currentProject?.manifest;
        const details = {};

        if (!theme) {
            result.errors.push('theme.json is empty or invalid JSON');
            result.details.theme = details;
            return;
        }

        // Check base required fields
        for (const field of this.validationRules.theme.requiredFields) {
            if (!(field in theme)) {
                result.errors.push(`theme.json missing required field: ${field}`);
            } else {
                details[field] = theme[field];
            }
        }

        // theme.id / theme.name must equal manifest's — an internal
        // consistency error, not a warning (spec §11).
        if (manifest) {
            if (theme.id !== undefined && manifest.id !== undefined && theme.id !== manifest.id) {
                result.errors.push(`theme.id "${theme.id}" does not match manifest.id "${manifest.id}"`);
            }
            if (theme.name !== undefined && manifest.name !== undefined && theme.name !== manifest.name) {
                result.errors.push(`theme.name "${theme.name}" does not match manifest.name "${manifest.name}"`);
            }
        }

        // Type-specific required fields (story needs frame/panel/
        // storyText/footerText/watermark; artwork needs nothing beyond
        // id/name already checked above).
        const type = this.effectiveType(manifest);
        const extraRequired = this.validationRules.theme.requiredFieldsByType[type] || [];
        for (const field of extraRequired) {
            if (!theme[field]) {
                result.errors.push(`theme.json missing required field for type "${type}": ${field}`);
            }
        }

        // Validate theme ID format
        if (theme.id && !this.validateId(theme.id)) {
            result.errors.push(`theme.id "${theme.id}" must be lowercase alphanumeric with hyphens`);
        }

        result.details.theme = details;
    }

    /**
     * Parse every .json file in a folder into a flat list of entries
     * (a file may hold one object or an array of them — spec §5/§6/§7).
     * Returns [{ ...entry, __file }] for downstream reference/duplicate-
     * id checks, and records per-file valid/invalid detail.
     */
    async collectFolderEntries(folder, result, detailKey) {
        const files = projectLoader.getFilesInFolder(folder).filter(f => f.endsWith('.json'));
        const details = { count: files.length, files: [] };
        const entries = [];

        for (const file of files) {
            const content = await projectLoader.getFileContent(file);
            const json = projectLoader.parseJSON(content);
            if (json === null) {
                result.errors.push(`Invalid JSON in ${file}`);
                details.files.push({ file, valid: false });
                continue;
            }
            details.files.push({ file, valid: true });
            const items = Array.isArray(json) ? json : [json];
            items.forEach(item => {
                if (item && typeof item === 'object') {
                    entries.push(Object.assign({ __file: file }, item));
                }
            });
        }

        result.details[detailKey] = details;
        return entries;
    }

    /**
     * Validate layouts folder
     */
    async validateLayouts(result) {
        return this.collectFolderEntries('layouts', result, 'layouts');
    }

    /**
     * Validate frames folder
     */
    async validateFrames(result) {
        return this.collectFolderEntries('frames', result, 'frames');
    }

    /**
     * Validate layer-packs folder
     */
    async validateLayerPacks(result) {
        return this.collectFolderEntries('layer-packs', result, 'layerPacks');
    }

    /**
     * Validate representations folder (TB-4.7 — Theme Driven
     * Representations; requirement added by the Builder & Studio
     * Alignment Sprint). The `representations/` folder itself stays
     * optional — a Scene (`scenes/*.json`) converges into its own
     * Representation at Build time (builder.js's convergeScenes()), so
     * a Theme authored entirely through Scenes with no hand-written
     * `representations/` file is completely valid. What the Platform
     * Representation Contract actually requires is that the COMPILED
     * Theme end up with at least one Representation from either source
     * — never a specific name, never more than one as a minimum. This
     * is the only structural requirement; which names an author uses,
     * and how many beyond one, are entirely up to them.
     */
    async validateRepresentations(result) {
        const representations = await this.collectFolderEntries('representations', result, 'representations');
        const sceneFiles = projectLoader.getFilesInFolder('scenes').filter(function (f) { return f.endsWith('.json'); });
        if (representations.length === 0 && sceneFiles.length === 0) {
            result.errors.push('Theme must contain at least one Representation — add one under representations/, or add a Scene (which converges into one automatically at Build)');
        }
        return representations;
    }

    /**
     * Validate assets folder
     */
    async validateAssets(result) {
        const assetFiles = projectLoader.getFilesInFolder('assets');
        const details = {
            count: assetFiles.length,
            files: assetFiles
        };

        result.details.assets = details;
    }

    /**
     * Check for duplicate ids within one collection (Layouts, Frames,
     * or the entire compiled Layer Pack) — each scope is independent
     * (spec §11). Layouts/Frames also require a display "name" (shown
     * in their pickers); a Layer Pack entry does not — spec §7 lists no
     * "name" field for Layers, and real production entries (e.g.
     * "page-number", "handle") never carry one.
     */
    checkDuplicateIds(entries, label, result, requireName) {
        const seen = new Map();
        entries.forEach(entry => {
            if (!entry.id) {
                result.errors.push(`${label} entry in ${entry.__file} is missing "id"`);
                return;
            }
            if (!this.validateId(entry.id)) {
                result.errors.push(`${label} id "${entry.id}" (${entry.__file}) must be lowercase alphanumeric with hyphens (3-50 chars)`);
            }
            if (requireName && !entry.name) {
                result.errors.push(`${label} "${entry.id}" (${entry.__file}) is missing "name"`);
            }
            if (seen.has(entry.id)) {
                result.errors.push(`Duplicate ${label.toLowerCase()} id "${entry.id}" in ${seen.get(entry.id)} and ${entry.__file}`);
            } else {
                seen.set(entry.id, entry.__file);
            }
        });
    }

    /**
     * Recursively collect string values that look like asset
     * references (an image extension) so they can be checked against
     * assets/ — spec §8's "reference is relative to assets/" rule.
     */
    findAssetPaths(obj, out) {
        out = out || [];
        if (!obj || typeof obj !== 'object') return out;
        for (const key of Object.keys(obj)) {
            if (key === '__file') continue;
            const value = obj[key];
            if (typeof value === 'string') {
                if (/\.(png|jpe?g|svg|webp)$/i.test(value) && !/^(data:|https?:)/i.test(value)) {
                    out.push(value.replace(/^assets\//, ''));
                }
            } else if (value && typeof value === 'object') {
                this.findAssetPaths(value, out);
            }
        }
        return out;
    }

    /**
     * Validate references between files — duplicate ids, broken
     * cross-references, and asset paths. Spec §11 "Reference rules" /
     * "Missing assets".
     */
    async validateReferences(result, collected) {
        const { layouts, frames, layerEntries, representations } = collected;
        const reps = representations || [];
        const details = { checked: true, duplicates: [], brokenReferences: [], missingAssets: [] };

        this.checkDuplicateIds(layouts, 'Layout', result, true);
        this.checkDuplicateIds(frames, 'Frame', result, true);
        this.checkDuplicateIds(layerEntries, 'Layer', result, false);
        this.checkDuplicateIds(reps, 'Representation', result, true);

        const frameIds = new Set(frames.map(f => f.id).filter(Boolean));
        layouts.forEach(layout => {
            if (layout.aspect && LAYOUT_ASPECTS.indexOf(layout.aspect) === -1) {
                result.warnings.push(`Layout "${layout.id}" has unrecognized aspect "${layout.aspect}" — falls back to the legacy fixed panel`);
            }
            (layout.supportedFrames || []).forEach(frameId => {
                if (!frameIds.has(frameId)) {
                    result.errors.push(`Layout "${layout.id}" references unknown frame "${frameId}" in supportedFrames`);
                    details.brokenReferences.push({ from: layout.id, to: frameId, type: 'supportedFrames' });
                }
            });
        });

        // Representations reference this project's own Layouts/Frames —
        // a broken reference here would silently resolve to nothing at
        // runtime, so it fails validation instead (spec §11 "Reference
        // rules").
        const layoutIds = new Set(layouts.map(l => l.id).filter(Boolean));
        reps.forEach(rep => {
            if (rep.layout && !layoutIds.has(rep.layout)) {
                result.errors.push(`Representation "${rep.id}" references unknown layout "${rep.layout}"`);
                details.brokenReferences.push({ from: rep.id, to: rep.layout, type: 'representation.layout' });
            }
            if (rep.defaultFrame && !frameIds.has(rep.defaultFrame)) {
                result.errors.push(`Representation "${rep.id}" references unknown frame "${rep.defaultFrame}" in defaultFrame`);
                details.brokenReferences.push({ from: rep.id, to: rep.defaultFrame, type: 'representation.defaultFrame' });
            }
        });

        layerEntries.forEach(layer => {
            if (layer.type && LAYER_TYPES.indexOf(layer.type) === -1) {
                result.errors.push(`Layer "${layer.id}" has invalid type "${layer.type}" (must be one of: ${LAYER_TYPES.join(', ')})`);
            }
            if (layer.target && LAYER_TARGETS.indexOf(layer.target) === -1) {
                result.errors.push(`Layer "${layer.id}" has invalid target "${layer.target}" (must be one of: ${LAYER_TARGETS.join(', ')})`);
            }
        });

        // Asset path references from layouts/frames/layer-packs JSON.
        const assetFiles = new Set(
            projectLoader.getFilesInFolder('assets').map(f => f.replace(/^assets\//, ''))
        );
        const checkAssetRefs = (entries, label) => {
            entries.forEach(entry => {
                this.findAssetPaths(entry).forEach(relPath => {
                    if (!assetFiles.has(relPath)) {
                        result.errors.push(`${label} "${entry.id || entry.__file}" references missing asset "${relPath}"`);
                        details.missingAssets.push(relPath);
                    }
                });
            });
        };
        checkAssetRefs(layouts, 'Layout');
        checkAssetRefs(frames, 'Frame');
        checkAssetRefs(layerEntries, 'Layer');
        checkAssetRefs(reps, 'Representation');

        // manifest.thumbnail / metadata.previewImage, when a relative
        // path (not a data URI or remote URL), must resolve to a real
        // project file.
        const manifest = projectLoader.currentProject?.manifest || {};
        const metadata = projectLoader.currentProject?.metadata || {};
        const structure = projectLoader.projectStructure;
        [
            { field: 'manifest.thumbnail', value: manifest.thumbnail },
            { field: 'metadata.previewImage', value: metadata.previewImage }
        ].forEach(({ field, value }) => {
            if (!value || /^(data:|https?:)/i.test(value)) return;
            const exists = (value in (structure?.files || {}))
                || (value === 'thumbnail.png' && structure?.hasThumbnail)
                || (value === 'preview.png' && structure?.hasPreview);
            if (!exists) {
                result.errors.push(`${field} references "${value}" which does not exist in the project`);
                details.missingAssets.push(value);
            }
        });

        result.details.references = details;
    }

    /**
     * Validate ID format
     */
    validateId(id) {
        const rule = this.validationRules.ids;
        return (
            rule.pattern.test(id) &&
            id.length >= rule.minLength &&
            id.length <= rule.maxLength
        );
    }

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Get last validation result
     */
    getLastResult() {
        return this.lastValidationResult;
    }

    /**
     * Format validation report for display
     */
    formatReport(result) {
        return {
            status: result.isValid ? 'VALID' : 'INVALID',
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
            errors: result.errors,
            warnings: result.warnings,
            details: result.details
        };
    }
}

// Create global validation engine instance
const validator = new ValidationEngine();
