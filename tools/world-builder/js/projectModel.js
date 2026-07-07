// js/projectModel.js — Sprint B1.1, extended in Sprint B2.0. The single
// accessor/mutator layer over a World Project's file map (js/projectStore.js's
// `project.files`, shaped per docs/WORLD_PROJECT_CONTRACT.md). The Builder
// Workspace never pokes at `project.files['...json']` directly — every
// read and every edit goes through here, so the file-map shape stays a
// private detail the Workspace UI doesn't need to know twice.
//
// Sprint B2.0 adds Frame CRUD, multi-Layer-Pack CRUD, and Asset
// read/write helpers, and fixes two schema bugs the real validator.js
// would have rejected (see FIRST_OFFICIAL_WORLD_REPORT.md): Layouts
// were missing the required `name` field, and Frame presentation
// fields must live under a nested `fields` object
// (docs/THEME_PROJECT_SPEC.md §5/§6), not flat on the entry.
const ProjectModel = (function () {
    'use strict';

    function manifest(project) { return project.files['manifest.json']; }
    function metadata(project) { return project.files['metadata.json']; }
    function theme(project) { return project.files['theme.json']; }

    function representations(project) {
        return project.files['representations/all.json'] || [];
    }

    function setRepresentations(project, list) {
        project.files['representations/all.json'] = list;
    }

    function _filesWithPrefix(project, prefix) {
        return Object.keys(project.files)
            .filter(function (k) { return k.indexOf(prefix) === 0; })
            .map(function (k) { return { key: k, data: project.files[k] }; });
    }

    function _slug(name) {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    }

    function _uniqueId(existingIds, base) {
        let id = base;
        let n = 2;
        while (existingIds.indexOf(id) !== -1) { id = base + '-' + n; n++; }
        return id;
    }

    // ---------------------------------------------------------------
    // Layouts
    // ---------------------------------------------------------------

    function layouts(project) {
        return _filesWithPrefix(project, 'layouts/').map(function (e) { return e.data; });
    }

    function findLayout(project, id) {
        return layouts(project).find(function (l) { return l.id === id; }) || null;
    }

    function setLayout(project, layout) {
        project.files['layouts/' + layout.id + '.json'] = layout;
    }

    function addLayout(project) {
        const existingIds = layouts(project).map(function (l) { return l.id; });
        const id = _uniqueId(existingIds, 'new-layout');
        const layout = {
            id: id,
            name: 'New Layout',
            aspect: 'portrait',
            description: '',
            captionPosition: 'below',
            padding: 24,
            spacing: 16,
            alignment: 'center'
        };
        setLayout(project, layout);
        return layout;
    }

    // ---------------------------------------------------------------
    // Frames (Sprint B2.0 — full CRUD)
    // ---------------------------------------------------------------

    function frames(project) {
        const list = _filesWithPrefix(project, 'frames/').map(function (e) { return e.data; });
        return _ordered(project, 'frameOrder', list);
    }

    function findFrame(project, id) {
        return frames(project).find(function (f) { return f.id === id; }) || null;
    }

    function setFrame(project, frame) {
        project.files['frames/' + frame.id + '.json'] = frame;
    }

    // Keeps a Builder-only display order (`project.frameOrder`) in sync
    // with whatever frames actually exist — reconciled lazily so a
    // project created before this field existed (or one edited by
    // deleting/adding frames) never crashes on a stale id.
    function _ordered(project, key, list) {
        const ids = list.map(function (item) { return item.id; });
        let order = project[key];
        if (!Array.isArray(order)) order = [];
        order = order.filter(function (id) { return ids.indexOf(id) !== -1; });
        ids.forEach(function (id) { if (order.indexOf(id) === -1) order.push(id); });
        project[key] = order;
        const byId = {};
        list.forEach(function (item) { byId[item.id] = item; });
        return order.map(function (id) { return byId[id]; }).filter(Boolean);
    }

    function _defaultFrameFields() {
        return { matWidth: 20, frameThickness: 4, borderColor: '#1D3457', wallTone: '#F4F1EC' };
    }

    function addFrame(project) {
        const existingIds = frames(project).map(function (f) { return f.id; });
        const id = _uniqueId(existingIds, 'new-frame');
        const frame = { id: id, name: 'New Frame', description: '', fields: _defaultFrameFields() };
        setFrame(project, frame);
        return frame;
    }

    function duplicateFrame(project, frameId) {
        const source = findFrame(project, frameId);
        if (!source) return null;
        const existingIds = frames(project).map(function (f) { return f.id; });
        const id = _uniqueId(existingIds, source.id + '-copy');
        const copy = {
            id: id,
            name: source.name + ' Copy',
            description: source.description || '',
            fields: Object.assign({}, source.fields)
        };
        setFrame(project, copy);
        return copy;
    }

    function deleteFrame(project, frameId) {
        delete project.files['frames/' + frameId + '.json'];
        if (Array.isArray(project.frameOrder)) {
            project.frameOrder = project.frameOrder.filter(function (id) { return id !== frameId; });
        }
    }

    function setFrameField(project, frameId, field, value) {
        const frame = findFrame(project, frameId);
        if (frame) frame[field] = value;
    }

    function setFrameFieldValue(project, frameId, key, value) {
        const frame = findFrame(project, frameId);
        if (!frame) return;
        if (!frame.fields) frame.fields = {};
        frame.fields[key] = value;
    }

    function moveFrame(project, frameId, direction) {
        frames(project); // ensures project.frameOrder is reconciled
        const order = project.frameOrder;
        const idx = order.indexOf(frameId);
        if (idx === -1) return;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= order.length) return;
        const tmp = order[idx];
        order[idx] = order[swapWith];
        order[swapWith] = tmp;
    }

    // ---------------------------------------------------------------
    // Layer Packs (Sprint B2.0 — multiple named packs; the compiled
    // Runtime still merges every layer-packs/*.json file into one flat
    // theme.layerPack array (docs/THEME_PROJECT_SPEC.md §7, unchanged) —
    // "packs" are a Builder-only authoring/organization concept.
    // ---------------------------------------------------------------

    function _ensureLayerPacksMeta(project) {
        if (!project.layerPacks || typeof project.layerPacks !== 'object') {
            project.layerPacks = { names: {}, order: [] };
        }
        if (!project.layerPacks.names) project.layerPacks.names = {};
        if (!Array.isArray(project.layerPacks.order)) project.layerPacks.order = [];

        const fileIds = _filesWithPrefix(project, 'layer-packs/').map(function (e) {
            return e.key.slice('layer-packs/'.length).replace(/\.json$/, '');
        });
        project.layerPacks.order = project.layerPacks.order.filter(function (id) {
            return fileIds.indexOf(id) !== -1;
        });
        fileIds.forEach(function (id) {
            if (project.layerPacks.order.indexOf(id) === -1) project.layerPacks.order.push(id);
            if (!project.layerPacks.names[id]) project.layerPacks.names[id] = _capitalize(id);
        });
        return project.layerPacks;
    }

    function _capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
    }

    function listLayerPacks(project) {
        const meta = _ensureLayerPacksMeta(project);
        return meta.order.map(function (id) {
            return {
                id: id,
                name: meta.names[id] || _capitalize(id),
                layers: project.files['layer-packs/' + id + '.json'] || []
            };
        });
    }

    function getLayerPack(project, packId) {
        _ensureLayerPacksMeta(project);
        return project.files['layer-packs/' + packId + '.json'] || null;
    }

    function addLayerPack(project) {
        const meta = _ensureLayerPacksMeta(project);
        const id = _uniqueId(meta.order, 'pack');
        project.files['layer-packs/' + id + '.json'] = [];
        meta.order.push(id);
        meta.names[id] = 'New Pack';
        return { id: id, name: meta.names[id], layers: [] };
    }

    function duplicateLayerPack(project, packId) {
        const meta = _ensureLayerPacksMeta(project);
        const source = project.files['layer-packs/' + packId + '.json'];
        if (!source) return null;
        const id = _uniqueId(meta.order, packId + '-copy');
        project.files['layer-packs/' + id + '.json'] = JSON.parse(JSON.stringify(source));
        meta.order.push(id);
        meta.names[id] = (meta.names[packId] || _capitalize(packId)) + ' Copy';
        return { id: id, name: meta.names[id], layers: project.files['layer-packs/' + id + '.json'] };
    }

    function renameLayerPack(project, packId, newName) {
        const meta = _ensureLayerPacksMeta(project);
        meta.names[packId] = newName;
    }

    // Refuses to delete the last remaining pack — an empty layer-packs/
    // folder fails the required-folder validation check (spec §11).
    function deleteLayerPack(project, packId) {
        const meta = _ensureLayerPacksMeta(project);
        if (meta.order.length <= 1) return false;
        delete project.files['layer-packs/' + packId + '.json'];
        delete meta.names[packId];
        meta.order = meta.order.filter(function (id) { return id !== packId; });
        if (theme(project).defaultLayerPack === packId) {
            theme(project).defaultLayerPack = meta.order[0];
        }
        return true;
    }

    function setDefaultLayerPack(project, packId) {
        theme(project).defaultLayerPack = packId;
    }

    function getDefaultLayerPack(project) {
        return theme(project).defaultLayerPack || _ensureLayerPacksMeta(project).order[0] || null;
    }

    function _defaultLayerFor(target) {
        return {
            id: 'new-layer',
            type: 'text',
            target: target || 'holder',
            anchor: 'bottom-center',
            offsetX: 0,
            offsetY: 0,
            zIndex: 1,
            visible: true,
            locked: false
        };
    }

    function addLayer(project, packId) {
        const layers = getLayerPack(project, packId);
        if (!layers) return null;
        const existingIds = layers.map(function (l) { return l.id; });
        const id = _uniqueId(existingIds, 'new-layer');
        const layer = Object.assign(_defaultLayerFor('holder'), { id: id });
        layers.push(layer);
        return layer;
    }

    function findLayer(project, packId, layerId) {
        const layers = getLayerPack(project, packId) || [];
        return layers.find(function (l) { return l.id === layerId; }) || null;
    }

    function updateLayer(project, packId, layerId, patch) {
        const layer = findLayer(project, packId, layerId);
        if (layer) Object.assign(layer, patch);
        return layer;
    }

    function deleteLayer(project, packId, layerId) {
        const layers = getLayerPack(project, packId);
        if (!layers) return;
        const idx = layers.findIndex(function (l) { return l.id === layerId; });
        if (idx !== -1) layers.splice(idx, 1);
    }

    function moveLayer(project, packId, layerId, direction) {
        const layers = getLayerPack(project, packId);
        if (!layers) return;
        const idx = layers.findIndex(function (l) { return l.id === layerId; });
        if (idx === -1) return;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= layers.length) return;
        const tmp = layers[idx];
        layers[idx] = layers[swapWith];
        layers[swapWith] = tmp;
    }

    // ---------------------------------------------------------------
    // Scenes (Builder V2 — Engine V2 Canon §2, §10). A Scene is the one
    // object a Theme Author now authors directly: Canvas configuration
    // (Aspect Ratio, Safe Area label) plus its starting Holders, seeded
    // from an Engine Scene Template and freely curated afterward. This
    // is genuinely new, additive data — it does not replace or migrate
    // `representations/`, `layouts/`, `frames/`, or `layer-packs/`,
    // which Validate/Build/Publish still compile from unchanged, since
    // no Engine V2 compiled-package format exists yet in any frozen
    // document (see docs/BUILDER_V2_VISION.md's own implementation
    // report for this gap, disclosed rather than silently bridged).
    // ---------------------------------------------------------------

    function scenes(project) {
        const list = _filesWithPrefix(project, 'scenes/').map(function (e) { return e.data; });
        return _ordered(project, 'sceneOrder', list);
    }

    function findScene(project, id) {
        return scenes(project).find(function (s) { return s.id === id; }) || null;
    }

    function setScene(project, scene) {
        project.files['scenes/' + scene.id + '.json'] = scene;
    }

    function _defaultHolderPermissions() {
        return { moveable: true, editable: true, visible: true };
    }

    function _holdersFor(layoutId) {
        const rects = (window.EngineSchema && window.EngineSchema.HOLDER_LAYOUTS[layoutId]) || [];
        return rects.map(function (r, i) {
            return {
                id: 'holder-' + (i + 1),
                name: rects.length > 1 ? 'Holder ' + (i + 1) : 'Holder',
                position: { x: r.x, y: r.y },
                size: { w: r.w, h: r.h },
                shape: 'rectangle',
                padding: 0,
                fit: 'fit',
                frame: null,
                permissions: _defaultHolderPermissions()
            };
        });
    }

    // Retrofits defaults onto a Holder authored before a given field
    // existed (e.g. Scenes created before `permissions` shipped) —
    // read-time reconciliation, the same pattern `_ordered` already uses
    // for stale ids, so nothing crashes and nothing needs a migration.
    function _ensureHolderDefaults(holder) {
        if (!holder) return holder;
        if (!holder.permissions) holder.permissions = _defaultHolderPermissions();
        if (!holder.shape) holder.shape = 'rectangle';
        if (holder.padding === undefined || holder.padding === null) holder.padding = 0;
        if (!holder.fit) holder.fit = 'fit';
        return holder;
    }

    // Creates a Scene from an Engine Scene Template — never from a blank
    // Canvas (Engine Invariant 4). `startedFrom` is informational
    // provenance only, per Engine Canon §12 item 2's own "no persisted
    // link" assumption — nothing reads it to offer a "reset to template"
    // action.
    function addScene(project, templateId) {
        const template = window.EngineSchema.findSceneTemplate(templateId);
        const existingIds = scenes(project).map(function (s) { return s.id; });
        const id = _uniqueId(existingIds, template.id);
        const aspect = template.defaultAspect;
        const scene = {
            id: id,
            name: template.name,
            startedFrom: template.id,
            canvas: {
                aspectRatio: aspect,
                safeArea: window.EngineSchema.aspectInfo(aspect).safeArea
            },
            holders: _holdersFor(template.holderLayout),
            layers: []
        };
        setScene(project, scene);
        return scene;
    }

    function renameScene(project, id, name) {
        const scene = findScene(project, id);
        if (scene) scene.name = name;
    }

    function duplicateScene(project, id) {
        const source = findScene(project, id);
        if (!source) return null;
        const existingIds = scenes(project).map(function (s) { return s.id; });
        const newId = _uniqueId(existingIds, id + '-copy');
        const copy = JSON.parse(JSON.stringify(source));
        copy.id = newId;
        copy.name = source.name + ' Copy';
        setScene(project, copy);
        return copy;
    }

    function deleteScene(project, id) {
        delete project.files['scenes/' + id + '.json'];
        if (Array.isArray(project.sceneOrder)) {
            project.sceneOrder = project.sceneOrder.filter(function (x) { return x !== id; });
        }
    }

    function moveScene(project, id, direction) {
        scenes(project); // ensures project.sceneOrder is reconciled
        const order = project.sceneOrder;
        const idx = order.indexOf(id);
        if (idx === -1) return;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= order.length) return;
        const tmp = order[idx];
        order[idx] = order[swapWith];
        order[swapWith] = tmp;
    }

    // The one Scene Configuration edit this slice implements (Vision
    // §2's "how Scene Configuration is actually edited") — changing
    // Aspect Ratio also refreshes the Safe Area label, since the two are
    // not independently choosable (Engine Canon §4).
    function setSceneAspect(project, id, aspectId) {
        const scene = findScene(project, id);
        if (!scene) return;
        scene.canvas.aspectRatio = aspectId;
        scene.canvas.safeArea = window.EngineSchema.aspectInfo(aspectId).safeArea;
    }

    // ---------------------------------------------------------------
    // Holders (Builder V2 — Blueprint §8 "Place" slice; Engine V2 Canon
    // §6, §10). The Engine places no upper bound on a Scene's Holder
    // count (Canon §2: "Holder (0..N)") — Add/Remove here is the same
    // pattern Scenes already uses for itself, so a Scene stays curatable
    // past whatever count its starting Template happened to choose.
    // ---------------------------------------------------------------

    function findHolder(project, sceneId, holderId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        const holder = scene.holders.find(function (h) { return h.id === holderId; }) || null;
        return _ensureHolderDefaults(holder);
    }

    function updateHolder(project, sceneId, holderId, patch) {
        const holder = findHolder(project, sceneId, holderId);
        if (holder) Object.assign(holder, patch);
        return holder;
    }

    function addHolder(project, sceneId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        const existingIds = scene.holders.map(function (h) { return h.id; });
        const id = _uniqueId(existingIds, 'holder');
        const n = scene.holders.length;
        const offset = (n % 4) * 0.04;
        const holder = {
            id: id,
            name: 'Holder ' + (n + 1),
            position: { x: 0.15 + offset, y: 0.15 + offset },
            size: { w: 0.6, h: 0.5 },
            shape: 'rectangle',
            padding: 0,
            fit: 'fit',
            frame: null,
            permissions: _defaultHolderPermissions()
        };
        scene.holders.push(holder);
        return holder;
    }

    function deleteHolder(project, sceneId, holderId) {
        const scene = findScene(project, sceneId);
        if (!scene) return;
        scene.holders = scene.holders.filter(function (h) { return h.id !== holderId; });
    }

    // ---------------------------------------------------------------
    // Assets (Sprint B2.0)
    // ---------------------------------------------------------------

    const IDENTITY_PATHS = { thumbnail: 'thumbnail.png', hero: 'preview.png' };

    function setIdentityAsset(project, slotId, dataURL) {
        const path = IDENTITY_PATHS[slotId];
        if (!path) return;
        project.files[path] = dataURL;
        if (slotId === 'thumbnail') manifest(project).thumbnail = path;
        if (slotId === 'hero') metadata(project).previewImage = path;
    }

    function getAsset(project, path) {
        return project.files[path] || null;
    }

    function setAsset(project, path, dataURL) {
        project.files[path] = dataURL;
    }

    function removeAsset(project, path) {
        delete project.files[path];
    }

    // ---------------------------------------------------------------
    // Representations
    // ---------------------------------------------------------------

    function findRepresentation(project, id) {
        return representations(project).find(function (r) { return r.id === id; }) || null;
    }

    function setRepresentationField(project, repId, field, value) {
        const rep = findRepresentation(project, repId);
        if (rep) rep[field] = value;
    }

    function addRepresentation(project) {
        const reps = representations(project);
        const existingIds = reps.map(function (r) { return r.id; });
        const id = _uniqueId(existingIds, 'new-representation');
        const firstLayout = layouts(project)[0];
        const firstFrame = frames(project)[0];
        const rep = {
            id: id,
            name: 'New Representation',
            description: '',
            thumbnail: '✨',
            layout: firstLayout ? firstLayout.id : null,
            defaultFrame: firstFrame ? firstFrame.id : null,
            defaultLayerPack: null,
            background: null,
            actions: []
        };
        reps.push(rep);
        setRepresentations(project, reps);
        return rep;
    }

    // ---------------------------------------------------------------
    // Overview / identity
    // ---------------------------------------------------------------

    // Applies Overview-state edits: World Name / Tagline / Description /
    // Publisher / Version. Keeps manifest.json, metadata.json and the
    // project's own list-card fields (name/tagline/description/icon,
    // read directly by js/worldBuilderApp.js's My World Projects list)
    // all in sync — there is exactly one source of truth per field, but
    // it is mirrored in three places for three different readers.
    function setIdentity(project, patch) {
        const man = manifest(project);
        const meta = metadata(project);
        if (patch.name !== undefined) {
            project.name = patch.name;
            man.name = patch.name;
            meta.displayName = patch.name;
            // theme.name must equal manifest.name (validator.js's
            // cross-check, docs/THEME_PROJECT_SPEC.md §11) — a real gap
            // discovered in Sprint B2.0: renaming a World in Overview
            // previously left theme.json.name stale, so validation
            // failed the instant a creator renamed their World. See
            // FIRST_OFFICIAL_WORLD_REPORT.md.
            theme(project).name = patch.name;
        }
        if (patch.tagline !== undefined) {
            project.tagline = patch.tagline;
            man.description = patch.tagline;
        }
        if (patch.description !== undefined) {
            project.description = patch.description;
            meta.description = patch.description;
        }
        if (patch.publisher !== undefined) {
            man.author = patch.publisher;
        }
        if (patch.version !== undefined) {
            man.version = patch.version;
        }
        if (patch.icon !== undefined) {
            project.icon = patch.icon;
            meta.themeIcon = patch.icon;
        }
        if (patch.purpose !== undefined) {
            meta.purpose = patch.purpose;
        }
        if (patch.mood !== undefined) {
            meta.mood = patch.mood;
        }
        // World Id (Sprint B2.0) — manifest.id and theme.id must be
        // identical (validator.js's cross-check); both update together.
        // Kebab-case is enforced by the caller (Overview panel), not
        // here, so this stays a plain, unconditional write.
        if (patch.id !== undefined) {
            man.id = patch.id;
            theme(project).id = patch.id;
        }

        // README.md is regenerated from the current Overview fields on
        // every identity edit — a real gap discovered in Sprint B2.0:
        // it was previously written once at template-creation time and
        // never refreshed, so a renamed World shipped a README still
        // titled after its original template. README.md is documentation
        // only (never read by Validate/Build, docs/WORLD_PROJECT_CONTRACT.md's
        // own contents table), so regenerating it here is always safe.
        if (patch.name !== undefined || patch.tagline !== undefined || patch.description !== undefined) {
            project.files['README.md'] = '# ' + project.name + '\n\n' + (project.tagline || '') + '\n\n' + (project.description || '') + '\n';
        }
    }

    const ALL_CREATION_TYPES = ['story', 'artwork', 'quote', 'card', 'poem', 'artwork-collection'];

    function creationTypes(project) {
        return theme(project).supportedCreationTypes || [];
    }

    function toggleCreationType(project, type) {
        const th = theme(project);
        const list = th.supportedCreationTypes || (th.supportedCreationTypes = []);
        const idx = list.indexOf(type);
        if (idx === -1) list.push(type); else list.splice(idx, 1);
    }

    return {
        manifest: manifest,
        metadata: metadata,
        theme: theme,
        representations: representations,
        setRepresentations: setRepresentations,
        findRepresentation: findRepresentation,
        setRepresentationField: setRepresentationField,
        addRepresentation: addRepresentation,
        layouts: layouts,
        findLayout: findLayout,
        setLayout: setLayout,
        addLayout: addLayout,
        frames: frames,
        findFrame: findFrame,
        setFrame: setFrame,
        addFrame: addFrame,
        duplicateFrame: duplicateFrame,
        deleteFrame: deleteFrame,
        setFrameField: setFrameField,
        setFrameFieldValue: setFrameFieldValue,
        moveFrame: moveFrame,
        listLayerPacks: listLayerPacks,
        getLayerPack: getLayerPack,
        addLayerPack: addLayerPack,
        duplicateLayerPack: duplicateLayerPack,
        renameLayerPack: renameLayerPack,
        deleteLayerPack: deleteLayerPack,
        setDefaultLayerPack: setDefaultLayerPack,
        getDefaultLayerPack: getDefaultLayerPack,
        addLayer: addLayer,
        findLayer: findLayer,
        updateLayer: updateLayer,
        deleteLayer: deleteLayer,
        moveLayer: moveLayer,
        scenes: scenes,
        findScene: findScene,
        setScene: setScene,
        addScene: addScene,
        renameScene: renameScene,
        duplicateScene: duplicateScene,
        deleteScene: deleteScene,
        moveScene: moveScene,
        setSceneAspect: setSceneAspect,
        findHolder: findHolder,
        updateHolder: updateHolder,
        addHolder: addHolder,
        deleteHolder: deleteHolder,
        setIdentityAsset: setIdentityAsset,
        getAsset: getAsset,
        setAsset: setAsset,
        removeAsset: removeAsset,
        setIdentity: setIdentity,
        creationTypes: creationTypes,
        toggleCreationType: toggleCreationType,
        ALL_CREATION_TYPES: ALL_CREATION_TYPES
    };
})();
try { window.ProjectModel = ProjectModel; } catch (e) {}
