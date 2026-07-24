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
            representations: [],
            assets: {}
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
        // TB-4.7 — Theme Driven Representations. Optional, unlike the
        // three folders above — a theme with no representations/ folder
        // compiles with theme.representations simply absent (Studio's
        // Creation Flow already treats "no representations" as "skip
        // Step 3", the same as before this existed).
        package_.representations = await this.collectFolder('representations');

        // Builder Convergence Sprint — a Scene (Engine V2's own
        // authoring model: Scene -> Place/Layer -> Runtime Preview) has
        // no compiled representation of its own; it converges into the
        // exact same Layout/Representation/Layer Pack vocabulary every
        // hand-authored theme.json already uses, so Publish/Repository/
        // Studio need zero Scene-specific code — this is the one and
        // only place that translation happens. A project with no
        // scenes/ folder (every theme authored before Scenes existed)
        // converges zero entries, appending nothing to any of the four
        // arrays above — byte-identical output, same as before this
        // sprint.
        await this.convergeScenes(package_);

        // Assets — flattened to a { relativePath: dataURI } map, paths
        // relative to assets/ (spec §8), exactly the shape
        // js/zipReader.js + themeEngine.js's _buildPackageFromZipFiles
        // already produce for a zipped package.
        for (const file of projectLoader.getFilesInFolder('assets')) {
            const relPath = file.replace(/^assets\//, '');
            const dataURL = await projectLoader.getFileAsDataURL(file);
            if (dataURL) package_.assets[relPath] = dataURL;
        }

        // Asset Repository Transition — preview.png / thumbnail.png join
        // the SAME assets map every assets/* file already uses, keyed by
        // their own root-level filename, instead of a separate
        // previewDataURL/thumbnailDataURL pair that buildManifest() used
        // to embed directly into the manifest. manifest.thumbnail /
        // manifest.previewImage stay plain relative-path references
        // (buildManifest() below) — the theme's own definition never
        // carries embedded bytes; only this map does, and only this map
        // is what Publish uploads to a repository.
        if (projectLoader.projectStructure.hasPreview) {
            const dataURL = await projectLoader.getFileAsDataURL('preview.png');
            if (dataURL) package_.assets['preview.png'] = dataURL;
        }
        if (projectLoader.projectStructure.hasThumbnail) {
            const dataURL = await projectLoader.getFileAsDataURL('thumbnail.png');
            if (dataURL) package_.assets['thumbnail.png'] = dataURL;
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
     * Builder Convergence Sprint — walks every scenes/*.json file and
     * appends each Scene's converged Layout/Representation/Layer Pack
     * entries + externalized image assets directly onto the same
     * package_ arrays collectFolder() already populated from
     * layouts/frames/layer-packs/representations. This is the ONE
     * place Scene content becomes canonical Theme content: Publish,
     * Export, the Repository, and Studio all consume whatever this
     * function produced with no separate Scene-aware code anywhere
     * else in the pipeline.
     */
    async convergeScenes(package_) {
        // Happy Flow Completion Sprint — root cause traced live: Creation
        // Flow's Screen 2 (js/creationFlow.js's paintPreview) always
        // starts its Representation carousel at index 0 and "Start
        // Creating" reads whichever index is current — a real Theme
        // Author who never swipes the carousel gets reps[0]. Every World
        // Builder template (templates.js) seeds legacy, unfilled
        // Representations (e.g. Artwork Gallery's "Showcase"/"Portrait"/
        // "Quote", pointing at empty template Layouts) INTO
        // representations/all.json, compiled first by packageTheme()'s
        // collectFolder('representations') call above — a Scene's own
        // converged Representation (real, authored content) was being
        // appended AFTER those, landing last in the array. A Theme
        // Author who authors a Scene and publishes never sees their own
        // content by default; Studio wasn't substituting a fallback
        // Theme (the Theme itself applies correctly) — it was correctly
        // rendering the FIRST Representation in the array, which simply
        // wasn't the authored one. Fixed by collecting every Scene's
        // converged Representation separately and prepending them ahead
        // of the legacy, collectFolder-derived ones: a Scene a Theme
        // Author actually filled in is real content and belongs first;
        // an untouched template scaffold is not. Layouts/Frame
        // Variations/Layer Pack ordering is unaffected (Layer Pack
        // entries are resolved by `scope` match, never by array
        // position; Layouts/Frames are resolved by id, never by "first
        // in array" — the only ordering-sensitive consumer of this
        // array is Creation Flow's own reps[0] default).
        const sceneRepresentations = [];
        for (const file of projectLoader.getFilesInFolder('scenes')) {
            if (!file.endsWith('.json')) continue;
            const content = await projectLoader.getFileContent(file);
            const scene = projectLoader.parseJSON(content);
            if (!scene || !scene.id) continue;
            const rep = await this.convergeScene(scene, package_);
            if (rep) sceneRepresentations.push(rep);
        }
        if (sceneRepresentations.length) {
            package_.representations = sceneRepresentations.concat(package_.representations);
        }
    }

    /**
     * One Scene converges into exactly one Layout + one Representation
     * (both keyed 'scene-<id>' so a slide using this Representation's
     * `layout` field resolves back to this same Layout, and a Layer
     * Pack entry's `scope` — see below — matches slide.metadata.layout
     * at render time, per renderer/slideRenderer.js's _activeLayerPack).
     *
     * Only the Scene's first Place's Frame reference converges onto the
     * Representation's defaultFrame — Engine V1 has exactly one Holder
     * per page (docs/THEME_PROJECT_SPEC.md §5's "holders: Reserved,
     * always 1 in V1"), a pre-existing, disclosed ceiling this sprint
     * does not lift. Every Scene Layer (Background fill / Decoration /
     * Text — Holders themselves aside) converges via convergeSceneLayer
     * below, in Scene Stack order so z-ordering survives the trip.
     */
    async convergeScene(scene, package_) {
        const layoutId = 'scene-' + scene.id;
        const aspect = (scene.canvas && scene.canvas.aspectRatio) || 'portrait';

        package_.layouts.push({
            id: layoutId,
            name: scene.name || 'Scene',
            aspect: aspect,
            description: 'Converged from Builder Scene "' + (scene.name || scene.id) + '"',
            captionPosition: 'below',
            padding: 24,
            spacing: 16,
            alignment: 'center'
        });

        const holders = Array.isArray(scene.holders) ? scene.holders : [];
        const firstHolder = holders[0] || null;

        const representation = {
            id: layoutId,
            name: scene.name || 'Scene',
            description: '',
            layout: layoutId,
            defaultFrame: (firstHolder && firstHolder.frame) || null,
            defaultLayerPack: null,
            background: null,
            actions: []
        };

        const stack = Array.isArray(scene.stack) ? scene.stack : [];
        const layersById = {};
        (Array.isArray(scene.layers) ? scene.layers : []).forEach(function (l) { layersById[l.id] = l; });

        let z = 0;
        for (const entry of stack) {
            z += 1;
            if (!entry || entry.type !== 'layer') continue;
            const layer = layersById[entry.id];
            if (!layer) continue;
            const compiled = await this.convergeSceneLayer(scene, layer, z, layoutId, package_);
            if (compiled) package_.layerPack.push(compiled);
        }

        return representation;
    }

    /**
     * One Scene Layer converges into one Layer Pack entry. `rect`
     * (fractional, matching js/layerEngine.js's new optional field) is
     * how a Scene's own free-form position/size survives — every
     * pre-existing Layer Pack entry has no `rect` and keeps resolving
     * via anchor/offset exactly as before. `scope` restricts this entry
     * to the one Layout/Representation this Scene converged into, so
     * one theme with many converged Scenes never cross-contaminates
     * (renderer/slideRenderer.js's _activeLayerPack filters on it).
     */
    async convergeSceneLayer(scene, layer, zIndex, layoutId, package_) {
        const position = layer.position || { x: 0, y: 0 };
        const size = layer.size || { w: 0, h: 0 };
        const rect = { x: position.x || 0, y: position.y || 0, w: size.w || 0, h: size.h || 0 };
        const alpha = (typeof layer.opacity === 'number') ? layer.opacity : undefined;
        const visible = !(layer.permissions && layer.permissions.visible === false);
        // A true full-bleed fill (Scene Background, position 0,0 size
        // 1,1 — see js/projectModel.js's setSceneBackground) is wall-
        // level content that belongs BEHIND the Frame/Panel, exactly
        // like Museum Gallery's own Gallery Spotlight Layer — so it
        // converges onto the existing `target:'slide'` scope, which
        // renders first. Every other Scene Layer (an image, partial-
        // rect colour patch, or text) is foreground content authored to
        // sit above the artwork — Engine V1's existing slide/frame/
        // holder/element targets all render at specific points *inside*
        // the Frame/Panel pipeline (some gated on a border/image
        // existing at all), which is the wrong place for that. These
        // converge onto the new `target:'overlay'` scope instead
        // (renderer/slideRenderer.js's render(s), a 5th target painted
        // unconditionally on top of everything).
        const isFullBleed = rect.w >= 0.98 && rect.h >= 0.98;
        const target = (layer.kind === 'fill' && isFullBleed) ? 'slide' : 'overlay';
        const base = {
            id: 'scene-' + scene.id + '-' + layer.id,
            target: target,
            scope: layoutId,
            rect: rect,
            zIndex: zIndex,
            visible: visible
        };

        if (layer.kind === 'text') {
            // Creator Governing Rule 1 (Fidelity) fix, kept in lockstep
            // with the identical fix in tools/world-builder-v2's own
            // builder.js -- this used to hardcode anchor:'top-left'
            // regardless of the Scene Layer's own real align field,
            // silently discarding a centred/right-aligned Text
            // Experience's alignment on the way from Builder into
            // Creator/Studio. Vertical positioning stays 'top' always;
            // only the horizontal anchor now derives from the authored
            // align, matching layerEngine.js's own resolveAnchor
            // vocabulary.
            const hAnchor = layer.align === 'center' ? 'top-center' : layer.align === 'right' ? 'top-right' : 'top-left';
            return Object.assign({}, base, {
                type: 'text',
                anchor: hAnchor,
                text: {
                    content: layer.text || '',
                    font: layer.font || 'Georgia, serif',
                    size: layer.fontSize || 48,
                    color: layer.color || '#333333'
                }
            });
        }

        if (layer.kind === 'fill') {
            return Object.assign({}, base, {
                type: 'decoration',
                anchor: 'top-left',
                decoration: { kind: 'fill', color: layer.color || '#F4F1EC', alpha: alpha }
            });
        }

        if (layer.kind === 'decoration' && layer.image) {
            const assetPath = this.externalizeSceneImage(scene, layer, package_);
            return Object.assign({}, base, {
                type: 'decoration',
                anchor: 'top-left',
                // Fidelity fix — default Fit aligned to 'fit' (contain),
                // matching this version's own engineRuntime.js _paintLayer
                // default exactly (same fix applied to world-builder-v2's
                // builder.js) — the compile step previously hardcoded
                // 'fill' (cover, crops) regardless, so an unset Fit choice
                // rendered differently in Builder's own preview than in
                // the compiled/Published Theme Studio actually shows.
                decoration: { kind: 'image', image: assetPath, fit: layer.fit || 'fit', alpha: alpha }
            });
        }

        if (layer.kind === 'decoration') {
            // A glyph-only Decoration (no image uploaded) has no Layer
            // Pack decoration kind of its own — 'sticker' already IS
            // "draw this glyph at this point" (Sprint 9.6's existing
            // vocabulary), so it converges there instead of inventing a
            // second glyph-drawing path.
            return Object.assign({}, base, {
                type: 'sticker',
                anchor: 'top-left',
                sticker: { glyph: layer.glyph || '✨', size: 36 }
            });
        }

        return null;
    }

    /**
     * A Scene Layer's `.image` field is always a raw data URI (Builder
     * upload fields never write a project-relative asset path for
     * Scene content — see js/projectModel.js's _syncUniversalContent) —
     * so it must be externalized into the SAME package_.assets map
     * every assets/*, preview.png and thumbnail.png entry already uses
     * (packageTheme(), above), replacing it with a plain relative-path
     * reference resolved at render time via
     * ThemeRegistry.resolveAssetRef() — identical discipline to the
     * Asset Repository Transition sprint's own externalization fix.
     */
    externalizeSceneImage(scene, layer, package_) {
        const relPath = 'scenes/' + scene.id + '/' + layer.id + '.png';
        if (typeof layer.image === 'string' && layer.image.indexOf('data:') === 0) {
            package_.assets[relPath] = layer.image;
        }
        return relPath;
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
     * _buildPackageFromZipFiles uses for a zipped package).
     *
     * Asset Repository Transition — manifest.thumbnail / .previewImage
     * are left exactly as manifest.json/metadata.json declared them
     * (ordinarily the plain relative-path placeholders 'thumbnail.png'/
     * 'preview.png'), never overwritten with embedded bytes. The real
     * bytes live only in the assets map (packageTheme(), above) — the
     * code consuming these fields is responsible for resolving the
     * reference against that map (ThemeRegistry.getAsset() /
     * .resolveAssetRef(), same convention validator.js's
     * findAssetPaths() already established for every Layout/Frame/
     * Layer/Representation image field).
     */
    buildManifest(packageData) {
        const manifest = Object.assign({}, packageData.manifest);
        const metadata = packageData.metadata || {};

        Object.keys(metadata).forEach(key => {
            if (manifest[key] === undefined) manifest[key] = metadata[key];
        });

        return manifest;
    }

    /**
     * Build the runtime theme object — theme.json's own fields (minus
     * id/name duplication, which stay for clarity but must already
     * equal the manifest's per validation) plus layouts/frameVariations/
     * layerPack/representations flattened onto it (spec §4's compiled
     * shape).
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
        // TB-4.7 — only set when the project actually has any, so a
        // theme with no representations/ folder compiles with the key
        // simply absent (matching frameVariations' own convention above)
        // rather than an empty array Studio would have to special-case.
        if (theme.representations === undefined && packageData.representations.length) {
            theme.representations = packageData.representations;
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
