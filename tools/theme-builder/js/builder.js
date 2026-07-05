// Theme Build Engine
//
// TB-4.6 — Runtime Alignment. generateVThemePackage() now emits
// exactly the shape ThemeEngine.importThemeFile() / ThemeRegistry.
// importPackage() consume today — the legacy flat
// { manifest, theme, assets } package (js/themeRegistry.js's own
// header comment calls this "the .vtheme package format"). No zip
// step is introduced: the flat format is already the runtime's first-
// class, fully-supported contract, so compiling straight to it is the
// smallest change that closes the gap (see docs/VTHEME_PACKAGE_SPEC.md).

class BuildEngine {
    constructor() {
        this.buildHistory = [];
        this.currentBuild = null;
    }

    /**
     * Build theme package
     * @returns {Promise<Object>} Build result
     */
    async build() {
        const buildResult = {
            success: false,
            startTime: new Date(),
            endTime: null,
            themeName: null,
            version: null,
            packageSize: 0,
            validationPassed: false,
            validationReport: null,
            warnings: [],
            errors: [],
            packageData: null
        };

        this.currentBuild = buildResult;

        try {
            // Step 1: Validate
            const validationResult = await validator.validate();
            buildResult.validationReport = validationResult;
            buildResult.validationPassed = validationResult.isValid;

            if (!validationResult.isValid) {
                buildResult.errors = validationResult.errors;
                buildResult.warnings = validationResult.warnings;
                buildResult.endTime = new Date();
                this.buildHistory.push(buildResult);
                return buildResult;
            }

            // Step 2: Package
            const packageData = await this.packageTheme();
            buildResult.packageData = packageData;

            // Step 3: Generate .vtheme
            const vthemeFile = await this.generateVThemePackage(packageData);
            buildResult.packageFile = vthemeFile;
            buildResult.packageSize = this.estimateSize(vthemeFile);

            // Extract metadata for report
            const manifest = projectLoader.currentProject?.manifest;
            buildResult.themeName = manifest?.name || 'Unknown Theme';
            buildResult.version = manifest?.version || '0.0.1';

            buildResult.success = true;
            buildResult.endTime = new Date();

            this.buildHistory.push(buildResult);
            return buildResult;
        } catch (error) {
            buildResult.errors.push(`Build failed: ${error.message}`);
            buildResult.endTime = new Date();
            this.buildHistory.push(buildResult);
            return buildResult;
        }
    }

    /**
     * Package theme files into structure. Each collection is flattened
     * to plain preset objects (one file may hold one object or an
     * array — spec §5/§6/§7), not wrapped in { file, data } pairs, so
     * generateVThemePackage() can merge them straight onto `theme`.
     */
    async packageTheme() {
        const package_ = {
            manifest: null,
            metadata: null,
            theme: null,
            layouts: [],
            frameVariations: [],
            layerPack: [],
            assets: {},
            previewDataURL: null,
            thumbnailDataURL: null
        };

        // Get core files
        if (projectLoader.projectStructure.hasManifest) {
            package_.manifest = projectLoader.currentProject.manifest;
        }
        if (projectLoader.projectStructure.hasMetadata) {
            package_.metadata = projectLoader.currentProject.metadata;
        }
        if (projectLoader.projectStructure.hasTheme) {
            package_.theme = projectLoader.currentProject.theme;
        }

        package_.layouts = await this.collectFolder('layouts');
        package_.frameVariations = await this.collectFolder('frames');
        package_.layerPack = await this.collectFolder('layer-packs');

        // Assets — flattened to a { relativePath: dataURI } map, paths
        // relative to assets/ (spec §8), exactly the shape
        // js/zipReader.js + themeEngine.js's _buildPackageFromZipFiles
        // already produce for a zipped package.
        for (const file of projectLoader.getFilesInFolder('assets')) {
            const relPath = file.replace(/^assets\//, '');
            const dataURL = await projectLoader.getFileAsDataURL(file);
            if (dataURL) package_.assets[relPath] = dataURL;
        }

        // preview.png / thumbnail.png — embedded as data URIs so the
        // compiled package carries real image bytes, not a placeholder
        // string.
        if (projectLoader.projectStructure.hasPreview) {
            package_.previewDataURL = await projectLoader.getFileAsDataURL('preview.png');
        }
        if (projectLoader.projectStructure.hasThumbnail) {
            package_.thumbnailDataURL = await projectLoader.getFileAsDataURL('thumbnail.png');
        }

        return package_;
    }

    /**
     * Parse every .json file in a folder into a flat array of preset
     * objects, in whichever combination of single-object and array
     * files the author used.
     */
    async collectFolder(folder) {
        const out = [];
        for (const file of projectLoader.getFilesInFolder(folder)) {
            if (!file.endsWith('.json')) continue;
            const content = await projectLoader.getFileContent(file);
            const json = projectLoader.parseJSON(content);
            if (Array.isArray(json)) out.push(...json);
            else if (json) out.push(json);
        }
        return out;
    }

    /**
     * Generate .vtheme package file — the canonical
     * { manifest, theme, assets } shape ThemeRegistry.importPackage()
     * consumes directly, no conversion step required.
     */
    async generateVThemePackage(packageData) {
        const manifest = this.buildManifest(packageData);
        const theme = this.buildTheme(packageData, manifest);
        const assets = packageData.assets || {};

        const pkg = { manifest, theme, assets };

        const blob = new Blob([JSON.stringify(pkg, null, 2)], {
            type: 'application/json'
        });

        return {
            filename: `${manifest.id || 'theme'}.vtheme`,
            blob: blob,
            manifest: manifest,
            size: blob.size
        };
    }

    /**
     * Build the runtime manifest — starts from manifest.json, merges
     * metadata.json's rich fields additively (never overwriting a
     * field the manifest already set, same rule
     * _buildPackageFromZipFiles uses for a zipped package), and embeds
     * preview.png/thumbnail.png as data URIs onto the exact fields the
     * runtime already reads (manifest.thumbnail / manifest.previewImage).
     */
    buildManifest(packageData) {
        const manifest = Object.assign({}, packageData.manifest);
        const metadata = packageData.metadata || {};

        Object.keys(metadata).forEach(key => {
            if (manifest[key] === undefined) manifest[key] = metadata[key];
        });

        if (packageData.thumbnailDataURL && (!manifest.thumbnail || manifest.thumbnail === 'thumbnail.png')) {
            manifest.thumbnail = packageData.thumbnailDataURL;
        }
        if (packageData.previewDataURL && (!manifest.previewImage || manifest.previewImage === 'preview.png')) {
            manifest.previewImage = packageData.previewDataURL;
        }

        return manifest;
    }

    /**
     * Build the runtime theme object — theme.json's own fields (minus
     * id/name duplication, which stay for clarity but must already
     * equal the manifest's per validation) plus layouts/frameVariations/
     * layerPack flattened onto it (spec §4's compiled shape).
     */
    buildTheme(packageData, manifest) {
        const theme = Object.assign({}, packageData.theme);
        theme.id = manifest.id;
        theme.name = manifest.name;

        if (theme.layouts === undefined && packageData.layouts.length) {
            theme.layouts = packageData.layouts;
        }
        if (theme.frameVariations === undefined && packageData.frameVariations.length) {
            theme.frameVariations = packageData.frameVariations;
        }
        if (theme.layerPack === undefined) {
            theme.layerPack = packageData.layerPack;
        }

        return theme;
    }

    /**
     * Estimate package size
     */
    estimateSize(vthemeFile) {
        return vthemeFile.blob.size;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Download generated package
     */
    downloadPackage(vthemeFile) {
        const url = URL.createObjectURL(vthemeFile.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = vthemeFile.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Get build history
     */
    getHistory() {
        return this.buildHistory;
    }

    /**
     * Get current build status
     */
    getCurrentBuild() {
        return this.currentBuild;
    }

    /**
     * Format build report for display
     */
    formatReport(buildResult) {
        return {
            success: buildResult.success,
            themeName: buildResult.themeName,
            version: buildResult.version,
            buildTime: this.calculateDuration(buildResult.startTime, buildResult.endTime),
            packageSize: this.formatFileSize(buildResult.packageSize),
            validationPassed: buildResult.validationPassed,
            errors: buildResult.errors,
            warnings: buildResult.warnings,
            timestamp: buildResult.endTime.toISOString()
        };
    }

    /**
     * Calculate build duration
     */
    calculateDuration(startTime, endTime) {
        if (!startTime || !endTime) return '0ms';
        const ms = endTime - startTime;
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }

    /**
     * Can build (validation passed)
     */
    canBuild() {
        const lastValidation = validator.getLastResult();
        return lastValidation && lastValidation.isValid;
    }
}

// Create global build engine instance
const builder = new BuildEngine();
