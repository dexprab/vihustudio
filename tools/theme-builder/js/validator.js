// Theme Validation Engine

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
                requiredFields: ['name', 'id', 'version', 'author', 'minimumStudioVersion'],
                stringFields: ['name', 'id', 'author', 'description'],
                versionFormat: /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/
            },
            metadata: {
                requiredFields: ['displayName', 'description', 'category'],
                stringFields: ['displayName', 'description', 'category']
            },
            theme: {
                requiredFields: ['id', 'name']
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
        await this.validateLayouts(result);
        await this.validateFrames(result);
        await this.validateLayerPacks(result);
        await this.validateAssets(result);
        await this.validateReferences(result);

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

        // Check required folders
        for (const folder of this.validationRules.structure.requiredFolders) {
            const exists = structure[`has${this.capitalize(folder)}`] || structure.folders[folder];
            details[folder] = exists;
            if (!exists) {
                result.errors.push(`Missing required folder: ${folder}/`);
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
            if (!(field in manifest)) {
                result.errors.push(`manifest.json missing required field: ${field}`);
            } else {
                details[field] = manifest[field];
            }
        }

        // Validate ID format
        if (manifest.id && !this.validateId(manifest.id)) {
            result.errors.push(`manifest.id "${manifest.id}" must be lowercase alphanumeric with hyphens (3-50 chars)`);
        }

        // Validate version format
        if (manifest.version && !this.validationRules.manifest.versionFormat.test(manifest.version)) {
            result.errors.push(`manifest.version "${manifest.version}" must be semantic (e.g., 1.0.0)`);
        }

        // Validate minimumStudioVersion
        if (manifest.minimumStudioVersion && !this.validationRules.manifest.versionFormat.test(manifest.minimumStudioVersion)) {
            result.warnings.push(`manifestminimumStudioVersion has unusual format: ${manifest.minimumStudioVersion}`);
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
     * Validate theme.json
     */
    async validateTheme(result) {
        const theme = projectLoader.currentProject?.theme;
        const details = {};

        if (!theme) {
            result.errors.push('theme.json is empty or invalid JSON');
            result.details.theme = details;
            return;
        }

        // Check required fields
        for (const field of this.validationRules.theme.requiredFields) {
            if (!(field in theme)) {
                result.errors.push(`theme.json missing required field: ${field}`);
            } else {
                details[field] = theme[field];
            }
        }

        // Validate theme ID format
        if (theme.id && !this.validateId(theme.id)) {
            result.errors.push(`theme.id "${theme.id}" must be lowercase alphanumeric with hyphens`);
        }

        result.details.theme = details;
    }

    /**
     * Validate layouts folder
     */
    async validateLayouts(result) {
        const layoutFiles = projectLoader.getFilesInFolder('layouts');
        const details = {
            count: layoutFiles.length,
            files: []
        };

        for (const file of layoutFiles) {
            if (file.endsWith('.json')) {
                const content = await projectLoader.getFileContent(file);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    details.files.push({ file, valid: true });
                } else {
                    result.errors.push(`Invalid JSON in ${file}`);
                    details.files.push({ file, valid: false });
                }
            }
        }

        result.details.layouts = details;
    }

    /**
     * Validate frames folder
     */
    async validateFrames(result) {
        const frameFiles = projectLoader.getFilesInFolder('frames');
        const details = {
            count: frameFiles.length,
            files: []
        };

        for (const file of frameFiles) {
            if (file.endsWith('.json')) {
                const content = await projectLoader.getFileContent(file);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    details.files.push({ file, valid: true });
                } else {
                    result.errors.push(`Invalid JSON in ${file}`);
                    details.files.push({ file, valid: false });
                }
            }
        }

        result.details.frames = details;
    }

    /**
     * Validate layer-packs folder
     */
    async validateLayerPacks(result) {
        const layerFiles = projectLoader.getFilesInFolder('layer-packs');
        const details = {
            count: layerFiles.length,
            files: []
        };

        for (const file of layerFiles) {
            if (file.endsWith('.json')) {
                const content = await projectLoader.getFileContent(file);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    details.files.push({ file, valid: true });
                } else {
                    result.errors.push(`Invalid JSON in ${file}`);
                    details.files.push({ file, valid: false });
                }
            }
        }

        result.details.layerPacks = details;
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
     * Validate references between files
     */
    async validateReferences(result) {
        // This would validate that layouts reference valid frames, etc.
        // For now, basic implementation
        const details = {
            checked: true
        };

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
