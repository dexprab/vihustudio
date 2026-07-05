// Theme Build Engine

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
     * Package theme files into structure
     */
    async packageTheme() {
        const package_ = {
            manifest: null,
            metadata: null,
            theme: null,
            layouts: [],
            frames: [],
            layerPacks: [],
            assets: [],
            preview: null,
            thumbnail: null,
            readme: null
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

        // Get layouts
        for (const layoutFile of projectLoader.getFilesInFolder('layouts')) {
            if (layoutFile.endsWith('.json')) {
                const content = await projectLoader.getFileContent(layoutFile);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    package_.layouts.push({
                        file: layoutFile,
                        data: json
                    });
                }
            }
        }

        // Get frames
        for (const frameFile of projectLoader.getFilesInFolder('frames')) {
            if (frameFile.endsWith('.json')) {
                const content = await projectLoader.getFileContent(frameFile);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    package_.frames.push({
                        file: frameFile,
                        data: json
                    });
                }
            }
        }

        // Get layer packs
        for (const layerFile of projectLoader.getFilesInFolder('layer-packs')) {
            if (layerFile.endsWith('.json')) {
                const content = await projectLoader.getFileContent(layerFile);
                const json = projectLoader.parseJSON(content);
                if (json) {
                    package_.layerPacks.push({
                        file: layerFile,
                        data: json
                    });
                }
            }
        }

        // Get assets
        package_.assets = projectLoader.getFilesInFolder('assets');

        // Get preview and thumbnail (if available)
        if (projectLoader.projectStructure.hasPreview) {
            package_.preview = projectLoader.currentProject.files['preview.png'];
        }
        if (projectLoader.projectStructure.hasThumbnail) {
            package_.thumbnail = projectLoader.currentProject.files['thumbnail.png'];
        }

        // Get README
        if (projectLoader.projectStructure.hasReadme) {
            const readmeContent = await projectLoader.getFileContent('README.md');
            package_.readme = readmeContent;
        }

        return package_;
    }

    /**
     * Generate .vtheme package file
     */
    async generateVThemePackage(packageData) {
        const manifest = packageData.manifest;
        const themeName = manifest?.name?.replace(/\s+/g, '_') || 'theme';
        const version = manifest?.version || '0.0.1';

        // Create package structure
        const vthemeStructure = {
            version: '1.0',
            format: 'vtheme',
            manifest: packageData.manifest,
            metadata: packageData.metadata,
            theme: packageData.theme,
            layouts: this.serializeArray(packageData.layouts),
            frames: this.serializeArray(packageData.frames),
            layerPacks: this.serializeArray(packageData.layerPacks),
            assets: packageData.assets,
            preview: packageData.preview ? 'included' : null,
            thumbnail: packageData.thumbnail ? 'included' : null,
            readme: packageData.readme ? 'included' : null,
            builtAt: new Date().toISOString(),
            builtWith: `${TB_NAME} v${TB_VERSION}`
        };

        // Create blob and generate download
        const blob = new Blob([JSON.stringify(vthemeStructure, null, 2)], {
            type: 'application/json'
        });

        return {
            filename: `${themeName}.vtheme`,
            blob: blob,
            manifest: manifest,
            size: blob.size
        };
    }

    /**
     * Serialize array of objects for packaging
     */
    serializeArray(arr) {
        return arr.map(item => ({
            file: item.file,
            data: item.data
        }));
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
