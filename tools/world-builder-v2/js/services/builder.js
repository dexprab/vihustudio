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

        // Collection Phase 4 — Compile-Time Dedup. A Theme's Collection
        // registry (tools/world-builder-v2/js/projectModel.js's
        // collectionAssets()) compiles onto the package the exact same
        // way as layouts/frameVariations/layerPack/representations above
        // — metadata only (id/name/kind/ref/availableToCreator), never
        // itself holding embedded bytes. This is purely an internal
        // lookup table for convergeScenes()/externalizeSceneImage() below
        // in this phase — theme.collectionAssets (Creator-facing
        // availability metadata on the compiled .vtheme) is a later,
        // separately-scoped phase; a Theme with zero collection/ files
        // compiles this to [] and every downstream lookup is a clean
        // miss, so nothing here changes output for a Theme that hasn't
        // adopted Collection.
        package_.collectionAssets = await this.collectFolder('collection');

        // Feature 1 — Image-typed Frame Variations. A Frame's own
        // fields.frameImage (authored via the Frames screen's Collection
        // picker) needs the identical externalize-at-compile-time
        // treatment every other image-bearing field already gets — a
        // Frame Variation file isn't a Scene Layer, so this runs as its
        // own small pass over package_.frameVariations rather than
        // through convergeSceneLayer/externalizeSceneImage; it needs
        // both frameVariations and collectionAssets, and nothing else,
        // so it runs right here, before convergeScenes(), whose own
        // Scene-Layer dedup is a completely independent concern. A Frame
        // with no frameImage (every Frame authored before this feature,
        // or one whose background isn't 'image') is left untouched.
        await this._externalizeFrameVariationImages(package_);

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

        // Collection Phase 5 — Creator-Facing Availability Metadata. Every
        // Collection entry the Theme Author flagged "Let Creators use this
        // too" (availableToCreator, ProjectModel.setCollectionAssetAvailability)
        // must reach the compiled package regardless of whether any Layer
        // currently references it -- that's the whole point of the flag
        // ("collection can have assets which are used in scenes and others
        // which builder would want creator to have access for
        // customization," the user's own words). package_.collectionAssets
        // (above) still carries every entry's own internal .ref -- a
        // Builder-session detail that must never leak into a published
        // Theme -- so this builds a SEPARATE, sanitized array
        // (creatorCollectionAssets) with id/name/kind/relPath/
        // availableToCreator only, assigned onto theme.collectionAssets by
        // buildTheme() below, mirroring the exact frameVariations/
        // layerPack/representations pattern already established there. A
        // Theme with zero availableToCreator entries produces [] here and
        // theme.collectionAssets stays simply absent -- the same
        // "omitted, not an empty array" convention every sibling field
        // above already uses.
        package_.creatorCollectionAssets = [];
        for (const entry of (package_.collectionAssets || [])) {
            if (!entry || entry.availableToCreator !== true) continue;
            const relPath = await this._embedCollectionEntry(entry, package_);
            package_.creatorCollectionAssets.push({
                id: entry.id,
                name: entry.name || null,
                kind: entry.kind || 'image',
                relPath: relPath,
                availableToCreator: true
            });
        }

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
        // Collection Phase 4 — Compile-Time Dedup. One ref-keyed lookup
        // built once per build, threaded down through convergeScene ->
        // convergeSceneLayer -> externalizeSceneImage — every call site
        // below the Scene-file loop stays a plain, cheap object lookup,
        // never re-deriving this map per Layer.
        const refToEntry = {};
        (package_.collectionAssets || []).forEach(function (entry) {
            if (entry && entry.ref) refToEntry[entry.ref] = entry;
        });

        const sceneRepresentations = [];
        for (const file of projectLoader.getFilesInFolder('scenes')) {
            if (!file.endsWith('.json')) continue;
            const content = await projectLoader.getFileContent(file);
            const scene = projectLoader.parseJSON(content);
            if (!scene || !scene.id) continue;
            const rep = await this.convergeScene(scene, package_, refToEntry);
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
     * Multiple Artwork Places Per Page — the Scene's first Place's Frame
     * reference still converges onto the Representation's defaultFrame
     * alone (a pre-existing, backward-compatible default every reader of
     * `defaultFrame` — e.g. _seedDefaultFrameVariation — already expects),
     * but every Place now ALSO converges, in full, onto the new additive
     * `placeRects` array below — position/size/shape/padding/fit/frame
     * for each one, in scene.holders' own array order (Place 1, Place
     * 2, ...). This is what lets renderer/slideRenderer.js render and
     * independently edit as many artwork areas as a Theme Author
     * actually authored, instead of only ever the first. Absent on any
     * Layout compiled before this change (and on anything compiled by
     * tools/world-builder/, v1, which is untouched) — Studio must treat
     * a missing/empty placeRects as "exactly one implicit Place."
     * Every Scene Layer (Background fill / Decoration / Text — Places
     * themselves aside) converges via convergeSceneLayer below, in
     * Scene Stack order so z-ordering survives the trip.
     */
    async convergeScene(scene, package_, refToEntry) {
        const layoutId = 'scene-' + scene.id;
        const aspect = (scene.canvas && scene.canvas.aspectRatio) || 'portrait';

        const holders = Array.isArray(scene.holders) ? scene.holders : [];
        const firstHolder = holders[0] || null;

        package_.layouts.push({
            id: layoutId,
            name: scene.name || 'Scene',
            aspect: aspect,
            description: 'Converged from Builder Scene "' + (scene.name || scene.id) + '"',
            captionPosition: 'below',
            padding: 24,
            spacing: 16,
            alignment: 'center',
            // Studio has no other way to tell "this Scene genuinely has
            // zero Places" apart from "it has one Place but no Frame
            // chosen yet" (both produce defaultFrame:null below) — a
            // real Layout field Sprint 9.6 already reserved for this
            // exact purpose ("holders: Reserved... in V1") but no
            // producer ever populated. Recording the real count here is
            // what lets renderer/slideRenderer.js's _resolveBorder and
            // js/objectStrip.js's Artwork Place card skip fabricating a
            // picture area for a Scene that never authored one.
            holders: holders.length,
            // Multiple Artwork Places Per Page — every Place's own
            // fractional rect/shape/fit/Frame, additive alongside the
            // bare count above. Each entry's `position`/`size` are
            // fractions of the SAME "stage" as Builder's own Scene
            // canvas — Studio's renderer maps them onto whichever single
            // panel rect the page's Layout aspect already resolves to.
            placeRects: holders.map(function (h) {
                // Guardrails — mirrors convergeSceneLayer's own permissions
                // derivation exactly (moveable/editable/visible, all
                // defaulting open when `permissions` is absent, matching
                // what _ensureHolderDefaults/_defaultHolderPermissions()
                // already stamp onto every real, live Holder). Until now
                // this fell straight through the floor: World Builder's own
                // Place permission block ("Can a Story Author move this?" /
                // "...change this?" / "...see this at all?") wrote to
                // h.permissions correctly, but convergeScene never read it
                // at all — a Theme Author's guardrails had zero effect in
                // Creator. Studio's own render-time defaulting for an
                // ALREADY-compiled placeRects entry deliberately differs
                // (absent moveable/editable resolves to false/locked there,
                // not true) to keep every theme published before this fix
                // byte-identical — see renderer/slideRenderer.js's
                // _resolvePlacePermissions.
                const visible = !(h.permissions && h.permissions.visible === false);
                const moveable = !(h.permissions && h.permissions.moveable === false);
                const editable = !(h.permissions && h.permissions.editable === false);
                // "change the size and shape of place if story author has
                // allowed it" — a genuinely new, opt-in-only capability,
                // deliberately compiled with the OPPOSITE default from the
                // three permissions above: those default open (absent
                // means "not explicitly closed"), because
                // _defaultHolderPermissions() always stamps all three
                // true for a real, live Holder, so absent is a rare edge
                // case treated as "not yet locked." `resizable` is never
                // stamped by that same function at all — it's absent on
                // every Place, old or new, until a Theme Author
                // explicitly checks the new "Can a Story Author change
                // its size or shape?" box — so absent here must mean
                // CLOSED, or every already-authored Place across every
                // World would silently gain resize/shape capability the
                // next time its Theme is Built, with nobody ever having
                // opted in. Matches renderer/slideRenderer.js's own
                // read-side _resolvePlacePermissions (`resizable:
                // p.resizable===true`), which the same reasoning already
                // governs for an already-compiled entry with no
                // `resizable` key at all.
                const resizable = !!(h.permissions && h.permissions.resizable === true);
                return {
                    id: h.id,
                    name: h.name || null,
                    position: { x: (h.position && h.position.x) || 0, y: (h.position && h.position.y) || 0 },
                    size: { w: (h.size && h.size.w) || 0, h: (h.size && h.size.h) || 0 },
                    shape: h.shape || 'rectangle',
                    padding: (typeof h.padding === 'number') ? h.padding : 0,
                    fit: h.fit || 'fit',
                    frame: h.frame || null,
                    visible: visible,
                    moveable: moveable,
                    editable: editable,
                    resizable: resizable
                };
            })
        });

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
            const compiled = await this.convergeSceneLayer(scene, layer, z, layoutId, package_, refToEntry);
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
    async convergeSceneLayer(scene, layer, zIndex, layoutId, package_, refToEntry) {
        const position = layer.position || { x: 0, y: 0 };
        const size = layer.size || { w: 0, h: 0 };
        const rect = { x: position.x || 0, y: position.y || 0, w: size.w || 0, h: size.h || 0 };
        const alpha = (typeof layer.opacity === 'number') ? layer.opacity : undefined;
        const visible = !(layer.permissions && layer.permissions.visible === false);
        // Creator Reconciliation Sprint — moveable/editable mirror the
        // visible line above exactly, the same "absent permissions object
        // defaults open" reasoning: a Scene Layer that was positioned but
        // never individually reopened for permission editing (Builder's
        // own _ensureSceneLayerDefaults only runs on-demand via
        // findSceneLayer, not at Build time) reaches here with
        // `permissions` still undefined, and this resolves it to `true`
        // for all three fields — identical to what that reconciler would
        // have stamped, so no separate reconciliation call is needed.
        // This is the one place Builder's own Scene Object permissions
        // (js/projectModel.js's holder/layer `.permissions`) finally
        // reach the compiled package Studio actually renders from —
        // renderer/slideRenderer.js's _pushLayerObject reads these two
        // fields straight off this compiled entry.
        const moveable = !(layer.permissions && layer.permissions.moveable === false);
        const editable = !(layer.permissions && layer.permissions.editable === false);
        // Honour World-Owned Object Commitments sprint — "Let the Story
        // Author add their own decorations here too" (the 4th
        // permission-block checkbox, stored as `layer.decorationSlot`,
        // a boolean sibling of `.permissions`, not inside it) was never
        // copied into the compiled package at all — dead data on both
        // sides until now. Absent (every Layer authored before this),
        // `!!undefined` resolves to `false`, unchanged.
        const decorationSlot = !!layer.decorationSlot;
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
        //
        // A real, user-reported bug: a Theme Author's own "Hosted by
        // Scene" choice (js/projectModel.js's _syncUniversalContent)
        // only ever completed this "wall-level content" treatment for a
        // Colour fill (`kind:'fill'`) — an Image/Graphics/Text Layer the
        // author explicitly hosted on the Scene (intending it as a
        // photographic background, not foreground decoration) still fell
        // through to 'overlay' and painted on top of literally
        // everything, including the Place's own Frame/placeholder. The
        // `hostedByScene` marker _syncUniversalContent now stamps onto
        // every kind of mirrored Layer (not just 'fill') closes that gap
        // — "Hosted by Scene" now uniformly means wall-level/behind,
        // regardless of what content the author put there.
        // "Hosted by Scene" is now a resizable/repositionable mode — an
        // author can shrink or offset a Scene-hosted Layer instead of
        // being pinned to full bleed by the Inspector's own self-heal.
        // The distinction from Free-hosted is therefore *z-order*, not
        // size: Scene-hosted always converges onto `target:'slide'` so it
        // still renders BEFORE the Frame/Panel (behind the picture),
        // whatever its rect. Free-hosted continues to converge onto
        // 'overlay' (in front of everything). A pre-hostedBy plain
        // `kind:'fill'` background (Blueprint §9's own "set the
        // background", predating the hostedBy concept) still resolves to
        // 'slide' only when it's genuinely full-bleed, preserving
        // backward-compat for every Scene Layer authored before this
        // capability change.
        const isFullBleed = rect.w >= 0.98 && rect.h >= 0.98;
        // "Extend Experiences to Places" — a Layer explicitly Hosted By
        // a specific Place (js/projectModel.js's `_syncUniversalContent`
        // 'place' fillMode, `layer.hostPlaceId`) converges onto a new
        // `target:'place'` scope, carrying which Place via `placeId`
        // below — distinct from both the existing 'slide' (wall-level,
        // behind every Place) and 'overlay' (drawn last, on top of
        // everything) scopes, since this content belongs alongside one
        // specific Place, not the whole Scene. Checked first: a Layer
        // can only ever be tagged with one host at a time
        // (js/projectModel.js's `_syncPartLayer` always sets
        // `hostedByScene`/`hostPlaceId` together, one true/set and the
        // other false/cleared, on every sync).
        const target = layer.hostPlaceId
            ? 'place'
            : ((layer.hostedByScene === true)
                ? 'slide'
                : ((layer.kind === 'fill' && isFullBleed) ? 'slide' : 'overlay'));
        const base = {
            id: 'scene-' + scene.id + '-' + layer.id,
            // Studio's own _humanizeLayerId fallback only ever had the
            // compiled id to guess from (e.g. "scene-single-holder-abc-
            // bg1"), which — since every Layer on one Scene shares that
            // same Scene-id prefix — reads as visually-identical,
            // truncated Object Strip cards no matter how many distinct
            // Layers a Scene actually has. Builder already has the real,
            // author-facing name right here (layer.name, e.g.
            // "Background", or an Experience's own name) — carrying it
            // through as label is what lets each converged Layer show
            // its own real name instead.
            label: layer.name || undefined,
            target: target,
            scope: layoutId,
            rect: rect,
            zIndex: zIndex,
            visible: visible,
            moveable: moveable,
            editable: editable,
            decorationSlot: decorationSlot
        };
        if (layer.hostPlaceId) base.placeId = layer.hostPlaceId;

        if (layer.kind === 'text') {
            // Creator Governing Rule 1 (Fidelity) — "Nothing about a
            // Scene's geometry, layout, or content is silently discarded
            // or substituted on the way into Creator." This used to
            // hardcode anchor:'top-left' regardless of the Scene Layer's
            // own real align field (left/center/right, set via the
            // Universal Text Experience's Alignment dropdown and already
            // correctly honoured by engineRuntime.js's own _paintLayer in
            // Builder's Working View/Runtime Preview) -- so a centred or
            // right-aligned Text Experience rendered correctly in Builder
            // but always came back left-aligned once compiled/Published,
            // a real, confirmed Fidelity violation. Vertical positioning
            // stays 'top' always (both this compiled path's own
            // _layerDrawText and engineRuntime.js's _paintLayer anchor a
            // text Layer's rect at its own top edge regardless of
            // alignment) -- only the horizontal anchor now derives from
            // the authored align, matching layerEngine.js's own
            // 9-point resolveAnchor vocabulary exactly.
            const hAnchor = layer.align === 'center' ? 'top-center' : layer.align === 'right' ? 'top-right' : 'top-left';
            return Object.assign({}, base, {
                type: 'text',
                anchor: hAnchor,
                text: {
                    content: layer.text || '',
                    font: layer.font || 'Georgia, serif',
                    size: layer.fontSize || 48,
                    color: layer.color || '#333333',
                    // "add rotation to text, and graphics in builder" — a
                    // Text Experience's own Rotation control (Builder's
                    // Working View/Runtime Preview already honour it via
                    // engineRuntime.js's _paintLayer) was silently dropped
                    // at compile time, unlike the sibling image/shape
                    // Decoration branches below, which already carry
                    // rotation through. Root Studio's renderer/
                    // slideRenderer.js's _layerDrawText reads this as
                    // t.rotation.
                    rotation: layer.rotation || 0
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
            const assetPath = await this.externalizeSceneImage(scene, layer, package_, refToEntry);
            return Object.assign({}, base, {
                type: 'decoration',
                anchor: 'top-left',
                // Fidelity fix — default Fit aligned to 'fit' (contain),
                // matching engineRuntime.js's own _paintLayer default
                // exactly; the compile step previously hardcoded 'fill'
                // (cover, crops) here regardless, so an unset Fit choice
                // rendered differently in Builder's own Working View/
                // Runtime Preview than in the compiled/Published Theme a
                // Story Author actually sees in Studio. `rotation` is now
                // also carried through (previously only reached the
                // compiled package for a Shape kind, never an uploaded
                // Image, even though _paintLayer already applies it to
                // both uniformly) so a future authoring path that sets it
                // isn't silently dropped, matching the identical field
                // already compiled for kind:'shape' below.
                decoration: { kind: 'image', image: assetPath, fit: layer.fit || 'fit', rotation: layer.rotation || 0, alpha: alpha }
            });
        }

        if (layer.kind === 'decoration' && layer.shape) {
            // A Graphics section's author-drawn Shape (Builder V3.1 —
            // real fill+outline+rotation, not a fixed-colour glyph) —
            // converges onto its own decoration kind rather than
            // falling into the glyph/sticker branch below, whose
            // `layer.glyph` a Shape never sets.
            return Object.assign({}, base, {
                type: 'decoration',
                anchor: 'top-left',
                decoration: {
                    kind: 'shape', shape: layer.shape,
                    fillColor: layer.shapeFillColor, fillOpacity: layer.shapeFillOpacity,
                    strokeColor: layer.shapeStrokeColor, strokeOpacity: layer.shapeStrokeOpacity,
                    strokeWidth: layer.shapeStrokeWidth, rotation: layer.rotation, alpha: alpha,
                    customPath: layer.customPath || null
                }
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
     * A Scene Layer's `.image` field is a raw data URI (a legacy upload,
     * or a Studio-side rehydration) OR, since the Draft Asset
     * Architecture's Phase B upload rewiring, a durable
     * `vihu-asset:<surface>:<projectId>:<assetId>` reference
     * (js/assetStore.js) — either way it must be externalized into the
     * SAME package_.assets map every assets/*, preview.png and
     * thumbnail.png entry already uses (packageTheme(), above),
     * replacing it with a plain relative-path reference resolved at
     * render time via ThemeRegistry.resolveAssetRef() — identical
     * discipline to the Asset Repository Transition sprint's own
     * externalization fix. A vihu-asset: reference is resolved through
     * AssetStore first (warm cache / IndexedDB / a signed Storage URL)
     * before being embedded — this function is already async (called
     * with `await` from convergeSceneLayer above), so no caller change
     * beyond that one await was needed.
     */
    async externalizeSceneImage(scene, layer, package_, refToEntry) {
        // Collection Phase 4 — Compile-Time Dedup. When this Layer's own
        // `.image` matches a Collection entry's `.ref` exactly (the
        // identical string, whether a vihu-asset: reference or a legacy
        // raw data: URI — Collection is a ref-indexed side table, never a
        // translation layer, per the plan's own corrected headline design
        // decision), converge onto that entry's OWN stable compiled key
        // (`collection/<id>.png`) via the shared _embedCollectionEntry
        // helper (Phase 5 also calls it directly, for an entry with no
        // Layer at all — see packageTheme()) instead of minting a fresh
        // scenes/<sceneId>/<layerId>.png for every Layer independently —
        // this is the one place "reduces data load on builder by
        // remapping to same asset used in different experiences" (the
        // user's own words) is actually realized: N Experiences sharing
        // one Collection asset compile to exactly one embedded image, not
        // N duplicates. A Layer whose image isn't a registered Collection
        // entry (every Theme authored before Collection existed, or
        // content Phase 1's auto-registration hook never saw) falls
        // through to exactly today's per-Layer relPath — fully backward
        // compatible.
        const collectionEntry = (refToEntry && layer.image) ? refToEntry[layer.image] : null;
        if (collectionEntry) {
            return await this._embedCollectionEntry(collectionEntry, package_);
        }

        const relPath = 'scenes/' + scene.id + '/' + layer.id + '.png';
        let src = layer.image;
        if (typeof src === 'string' && src.indexOf('vihu-asset:') === 0) {
            // Root-caused via a real, live report ("Paper BG" -- a Scene
            // Decoration image -- rendering as a broken image in Studio,
            // with a 404 for the bare relPath itself, proving nothing was
            // ever embedded at package_.assets[relPath]). The old code
            // called AssetStore.resolve() here and only embedded the
            // result if it happened to be a data: URI -- but resolve()
            // deliberately never returns one for a vihu-asset: reference
            // (it resolves to a warm blob: object URL or a signed Storage
            // https: URL, per docs/DRAFT_ASSET_ARCHITECTURE.md), so that
            // check always failed silently for every real upload since
            // Draft Asset Architecture's Phase B shipped, and this
            // function kept returning relPath as if externalization had
            // succeeded regardless. AssetStore.hydrateForExport() is the
            // module's own existing, already-tested inverse of put() --
            // it resolves a ref straight to a real, durable, embeddable
            // data: URI (checking the local IndexedDB blob directly
            // before ever falling back to a network fetch), matching
            // every other package_.assets entry's own shape -- reused
            // here rather than reimplementing its own fetch+FileReader
            // logic a second time.
            src = (typeof window !== 'undefined' && window.AssetStore)
                ? await window.AssetStore.hydrateForExport(src).catch(function () { return null; })
                : null;
        }
        if (typeof src === 'string' && src.indexOf('data:') === 0) {
            package_.assets[relPath] = src;
        }
        return relPath;
    }

    /**
     * Shared hydrate-and-embed step for a Collection entry
     * (id/name/kind/ref/availableToCreator, ProjectModel.collectionAssets()'s
     * own shape) — resolves `entry.ref` (a vihu-asset: reference or a
     * legacy data: URI, exactly like a Scene Layer's own `.image` field,
     * since a Collection entry's `.ref` IS that same string by design —
     * "Collection is a derived, ref-indexed side table," never a
     * translation layer) into real bytes at this entry's own stable
     * compiled key, `collection/<id>.png`. Two call sites share this one
     * implementation: externalizeSceneImage() above (Phase 4's own
     * dedup path, when a Layer's image matches a registered ref) and
     * packageTheme() below (Phase 5 — an availableToCreator entry with
     * no Layer pointing at it at all still needs its bytes embedded, or
     * theme.collectionAssets' own relPath would resolve to nothing).
     * Memoized — a relPath already present in package_.assets is
     * returned immediately with no re-hydration, so calling this twice
     * for the same entry (once via dedup, once via the availableToCreator
     * sweep) never re-fetches identical bytes a second time.
     */
    async _embedCollectionEntry(entry, package_) {
        const relPath = 'collection/' + entry.id + '.png';
        if (package_.assets[relPath]) return relPath;

        let src = entry.ref;
        if (typeof src === 'string' && src.indexOf('vihu-asset:') === 0) {
            src = (typeof window !== 'undefined' && window.AssetStore)
                ? await window.AssetStore.hydrateForExport(src).catch(function () { return null; })
                : null;
        }
        if (typeof src === 'string' && src.indexOf('data:') === 0) {
            package_.assets[relPath] = src;
        }
        return relPath;
    }

    /**
     * Feature 1 — Image-typed Frame Variations. Walks every compiled
     * Frame Variation (package_.frameVariations, already collected from
     * frames/*.json by packageTheme() above) and, for any with a real
     * fields.frameImage set, externalizes it into package_.assets —
     * mirroring externalizeSceneImage()'s own two-branch shape exactly
     * (reuse Collection's compile-time dedup when the ref is a
     * registered Collection asset; otherwise hydrate-and-embed directly
     * at a Frame-specific relPath), so a Frame's background image is
     * compiled with the same "reference, not embedded bytes" discipline
     * every other image-bearing field in this codebase already follows.
     *
     * The Frames screen's own onCommit handler
     * (worldBuilderApp.js's _renderFramesPanel) always calls
     * registerCollectionAsset() when a frameImage is set, so the
     * Collection-hit branch below is the expected, common case; the
     * fallback (a raw vihu-asset:/data: frameImage with no matching
     * Collection entry — e.g. manually-edited JSON, or a package
     * imported from outside this Builder) is a defensive path, not the
     * norm.
     *
     * Rewrites fields.frameImage to the resulting relPath in place —
     * package_.frameVariations is compiled onto theme.frameVariations by
     * buildTheme() further down this pipeline, so the rewritten relPath
     * (never the original vihu-asset:/data: string) is exactly what
     * reaches the published Theme; every consumer (engineRuntime.js's
     * resolveLayerImage, root Studio's ThemeRegistry.resolveAssetRef)
     * already expects a plain relative-path reference here, matching
     * every sibling image field's own compiled shape.
     */
    async _externalizeFrameVariationImages(package_) {
        const frameVariations = package_.frameVariations || [];
        if (!frameVariations.length) return;

        const refToEntry = {};
        (package_.collectionAssets || []).forEach(function (entry) {
            if (entry && entry.ref) refToEntry[entry.ref] = entry;
        });

        for (const frame of frameVariations) {
            const fields = frame && frame.fields;
            if (!fields || !fields.frameImage) continue;

            const collectionEntry = refToEntry[fields.frameImage];
            if (collectionEntry) {
                fields.frameImage = await this._embedCollectionEntry(collectionEntry, package_);
                continue;
            }

            // Defensive fallback — mirrors externalizeSceneImage()'s own
            // no-Collection-match branch, but at a Frame-specific relPath
            // since a Frame Variation isn't a Scene Layer.
            const relPath = 'frames/' + frame.id + '-image.png';
            let src = fields.frameImage;
            if (typeof src === 'string' && src.indexOf('vihu-asset:') === 0) {
                src = (typeof window !== 'undefined' && window.AssetStore)
                    ? await window.AssetStore.hydrateForExport(src).catch(function () { return null; })
                    : null;
            }
            if (typeof src === 'string' && src.indexOf('data:') === 0) {
                package_.assets[relPath] = src;
            }
            fields.frameImage = relPath;
        }
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
     * layerPack/representations/collectionAssets flattened onto it
     * (spec §4's compiled shape, docs/VTHEME_PACKAGE_SPEC.md).
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
        // Collection Phase 5 — Creator-Facing Availability Metadata.
        // packageData.creatorCollectionAssets (packageTheme(), above) is
        // already the sanitized id/name/kind/relPath/availableToCreator
        // array — never packageData.collectionAssets itself, which still
        // carries every entry's internal .ref and must never leak into a
        // published Theme. Same "only when non-empty" convention as
        // representations above — a theme with zero availableToCreator
        // entries compiles with the key simply absent.
        if (theme.collectionAssets === undefined && packageData.creatorCollectionAssets && packageData.creatorCollectionAssets.length) {
            theme.collectionAssets = packageData.creatorCollectionAssets;
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
