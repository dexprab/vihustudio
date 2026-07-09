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
                name: rects.length > 1 ? 'Place ' + (i + 1) : 'Place',
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
            name: 'Place ' + (n + 1),
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
    // The Scene Stack + Scene Layers (Builder V2 — Blueprint §9
    // "Decorations" slice; Engine V2 Canon §5, §7). The Scene Stack is
    // the single ordered sequence of Scene Layers and Holders together
    // that paints bottom to top (Canon §5) — "bring forward / send
    // backward" is the one Builder verb that covers everything this
    // ordering would otherwise require a Layer Stack panel for
    // (Blueprint §9). Reconciled lazily on read, the same pattern
    // `_ordered` already uses for frameOrder/sceneOrder, so a Scene
    // authored before `stack` existed never crashes.
    //
    // Decorations here are simple placed Elements (an emoji glyph, or a
    // full-bleed colour fill standing in for "the background," Engine
    // Canon §4 — there is no separate background field). A real Theme
    // Decoration Pack browsing system (Engine Canon §9) does not exist
    // in this Builder yet — that is Theme Assets consolidation, out of
    // this slice's scope, and is a disclosed limitation, not a silent
    // one.
    // ---------------------------------------------------------------

    function _defaultLayerPermissions() {
        return { moveable: true, editable: true, visible: true };
    }

    function _ensureSceneLayerDefaults(layer) {
        if (!layer) return layer;
        if (!layer.permissions) layer.permissions = _defaultLayerPermissions();
        if (layer.decorationSlot === undefined) layer.decorationSlot = false;
        if (layer.kind === 'text') {
            if (layer.text === undefined) layer.text = '';
            if (!layer.font) layer.font = 'Georgia, serif';
            if (!layer.fontSize) layer.fontSize = 48;
            if (!layer.align) layer.align = 'left';
        }
        return layer;
    }

    function _ensureStack(scene) {
        if (!Array.isArray(scene.layers)) scene.layers = [];
        if (!Array.isArray(scene.stack)) {
            scene.stack = scene.holders.map(function (h) { return { type: 'holder', id: h.id }; });
        }
        const holderIds = scene.holders.map(function (h) { return h.id; });
        const layerIds = scene.layers.map(function (l) { return l.id; });
        scene.stack = scene.stack.filter(function (e) {
            return e.type === 'holder' ? holderIds.indexOf(e.id) !== -1 : layerIds.indexOf(e.id) !== -1;
        });
        holderIds.forEach(function (id) {
            if (!scene.stack.some(function (e) { return e.type === 'holder' && e.id === id; })) {
                scene.stack.push({ type: 'holder', id: id });
            }
        });
        layerIds.forEach(function (id) {
            if (!scene.stack.some(function (e) { return e.type === 'layer' && e.id === id; })) {
                scene.stack.push({ type: 'layer', id: id });
            }
        });
        return scene.stack;
    }

    function sceneStack(project, sceneId) {
        const scene = findScene(project, sceneId);
        if (!scene) return [];
        return _ensureStack(scene);
    }

    function findSceneLayer(project, sceneId, layerId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        const layer = (scene.layers || []).find(function (l) { return l.id === layerId; }) || null;
        return _ensureSceneLayerDefaults(layer);
    }

    function updateSceneLayer(project, sceneId, layerId, patch) {
        const layer = findSceneLayer(project, sceneId, layerId);
        if (layer) Object.assign(layer, patch);
        return layer;
    }

    function _defaultLayerName(kind) {
        if (kind === 'fill') return 'Background';
        if (kind === 'text') return 'Text';
        return 'Decoration';
    }

    function addSceneLayer(project, sceneId, spec) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        _ensureStack(scene);
        const existingIds = scene.layers.map(function (l) { return l.id; });
        const id = _uniqueId(existingIds, spec.kind === 'fill' ? 'background' : (spec.kind === 'text' ? 'text' : 'decoration'));
        const layer = Object.assign({
            id: id,
            name: spec.name || _defaultLayerName(spec.kind),
            kind: spec.kind,
            color: spec.color || '#F4F1EC',
            glyph: spec.glyph || '✨',
            // A new Decoration/Text used to spawn dead-center (0.4, 0.4)
            // — directly on top of a Scene's usual Place, so it was
            // often invisible or accidentally selected instead of the
            // artwork right after creation (Builder V3 MEP finding).
            // Spawning lower on the Canvas, clear of a typical Place's
            // extent, still leaves it exactly as draggable as before —
            // just not born hidden under the one thing every Museum
            // Gallery Scene already has.
            position: spec.position || { x: 0.38, y: 0.82 },
            size: spec.size || { w: 0.14, h: 0.14 },
            permissions: _defaultLayerPermissions(),
            decorationSlot: false
        }, spec.sourceExperienceId ? { sourceExperienceId: spec.sourceExperienceId } : {}, spec.kind === 'text' ? {
            text: spec.text || '',
            font: spec.font || 'Georgia, serif',
            fontSize: spec.fontSize || 48,
            align: spec.align || 'left'
        } : {});
        scene.layers.push(layer);
        scene.stack.push({ type: 'layer', id: id });
        if (spec.atBottom) {
            scene.stack = scene.stack.filter(function (e) { return !(e.type === 'layer' && e.id === id); });
            scene.stack.unshift({ type: 'layer', id: id });
        }
        return layer;
    }

    function deleteSceneLayer(project, sceneId, layerId) {
        const scene = findScene(project, sceneId);
        if (!scene) return;
        scene.layers = (scene.layers || []).filter(function (l) { return l.id !== layerId; });
        if (Array.isArray(scene.stack)) {
            scene.stack = scene.stack.filter(function (e) { return !(e.type === 'layer' && e.id === layerId); });
        }
    }

    // "Bring forward" / "send backward" — the single verb Blueprint §9
    // uses in place of a Layer Stack panel a Theme Author would
    // otherwise need to understand.
    function moveInStack(project, sceneId, type, id, direction) {
        const scene = findScene(project, sceneId);
        if (!scene) return;
        _ensureStack(scene);
        const idx = scene.stack.findIndex(function (e) { return e.type === type && e.id === id; });
        if (idx === -1) return;
        const swapWith = direction === 'forward' ? idx + 1 : idx - 1;
        if (swapWith < 0 || swapWith >= scene.stack.length) return;
        const tmp = scene.stack[idx];
        scene.stack[idx] = scene.stack[swapWith];
        scene.stack[swapWith] = tmp;
    }

    // "Set the background" (Blueprint §9) is a convenience action, not a
    // structural concept of its own (Engine Canon §4 — Canvas has no
    // background property; a special `scene.background` field would be
    // exactly the "second way to do something Elements-in-Layers already
    // do" Invariant 8 forbids). This reuses, or creates, an ordinary
    // full-bleed fill Scene Layer pinned to the bottom of the Stack.
    function _bottomFillLayer(project, sceneId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        _ensureStack(scene);
        const bottom = scene.stack[0];
        if (!bottom || bottom.type !== 'layer') return null;
        const layer = findSceneLayer(project, sceneId, bottom.id);
        if (layer && layer.kind === 'fill' && layer.size.w >= 0.99 && layer.size.h >= 0.99) return layer;
        return null;
    }

    function setSceneBackground(project, sceneId, color) {
        const existing = _bottomFillLayer(project, sceneId);
        if (existing) {
            existing.color = color;
            return existing;
        }
        return addSceneLayer(project, sceneId, {
            kind: 'fill', name: 'Background', color: color,
            position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, atBottom: true
        });
    }

    function getSceneBackgroundColor(project, sceneId) {
        const layer = _bottomFillLayer(project, sceneId);
        return layer ? layer.color : '#F4F1EC';
    }

    // ---------------------------------------------------------------
    // Experiences (Builder V3 Milestone 2 — Experience Foundation).
    // A generic Builder authoring concept (docs/BUILDER_V3_EXPERIENCE_STUDIO.md,
    // docs/BUILDER_V2_EXPERIENCE_CANON.md): an Experience enriches
    // Foundation (a Scene or a Place) but is never owned by either —
    // ownership always belongs to the Theme (the World), matching every
    // other Theme-scoped collection here (Frames, Layer Packs). This is
    // deliberately NOT modeled around Frame — Frame is one Experience
    // *type* among an open, extensible vocabulary
    // (js/services/experienceSchema.js's EXPERIENCE_TYPES), never a
    // hardcoded shape of its own. Milestone 2 scope only: every
    // Experience is created Nurturing (Canon Decision #2) with no real
    // Hosting and no Graduation yet — `host`/`scopeSceneId` exist on
    // the shape now so Milestone 3 has somewhere to write, but nothing
    // in this milestone sets them to anything but null.
    // ---------------------------------------------------------------

    function experiences(project) {
        const list = _filesWithPrefix(project, 'experiences/').map(function (e) {
            return _ensureExperienceDefaults(e.data);
        });
        return _ordered(project, 'experienceOrder', list);
    }

    function findExperience(project, id) {
        return experiences(project).find(function (e) { return e.id === id; }) || null;
    }

    function setExperience(project, experience) {
        project.files['experiences/' + experience.id + '.json'] = experience;
    }

    // Read-time reconciliation for a project saved before a given field
    // existed — the same pattern `_ensureHolderDefaults`/`_ensureStack`
    // already use, so an older project never crashes and never needs an
    // explicit migration step. Milestone 3 replaced the Milestone 2
    // placeholder singular `host` with a real `attachments` array (a
    // Public Experience may attach to many Hosts at once); the Canon
    // Alignment Sprint replaces the two-way `attachment` field
    // ('attached'/'free') with the product model's own three-way
    // `hostedBy` ('place'/'scene'/'free') — an old 'attached' record
    // means "hosted by a Place" (that was the only real Place-hosting
    // this Builder ever offered), so the migration is lossless.
    function _ensureExperienceDefaults(exp) {
        if (!exp) return exp;
        if (typeof exp.description !== 'string') exp.description = '';
        if (!exp.type) exp.type = (window.ExperienceSchema && window.ExperienceSchema.EXPERIENCE_TYPES[0].value) || 'frame';
        if (!exp.hostedBy) exp.hostedBy = (exp.attachment === 'attached') ? 'place' : (exp.attachment || 'free');
        delete exp.attachment;
        if (!exp.lifecycle) exp.lifecycle = 'nurturing';
        if (exp.scopeSceneId === undefined) exp.scopeSceneId = null;
        if (!Array.isArray(exp.attachments)) {
            exp.attachments = (exp.host && exp.host.sceneId) ? [exp.host] : [];
        }
        delete exp.host;
        if (!Array.isArray(exp.tags)) exp.tags = [];
        if (!exp.properties || typeof exp.properties !== 'object') exp.properties = {};
        if (!exp.createdAt) exp.createdAt = exp.updatedAt || Date.now();
        if (!exp.updatedAt) exp.updatedAt = exp.createdAt;
        return exp;
    }

    // Placeholder creation (Milestone 2) plus real type-specific
    // Properties, seeded from js/services/experienceSchema.js's
    // `defaultProperties(type)` so the Inspector (Milestone 3) always
    // has something sensible to edit immediately, matching the existing
    // Frame/Decoration/Text authoring surfaces' own default values.
    // Always born Nurturing (Canon Decision #2).
    function addExperience(project, spec) {
        spec = spec || {};
        const existingIds = experiences(project).map(function (e) { return e.id; });
        const base = spec.name ? _slug(spec.name) : 'experience';
        const id = _uniqueId(existingIds, base);
        const now = Date.now();
        const type = spec.type || (window.ExperienceSchema && window.ExperienceSchema.EXPERIENCE_TYPES[0].value);
        const experience = _ensureExperienceDefaults({
            id: id,
            name: spec.name || 'New Experience',
            description: spec.description || '',
            type: type,
            hostedBy: spec.hostedBy,
            lifecycle: 'nurturing',
            scopeSceneId: null,
            attachments: [],
            tags: [],
            properties: (window.ExperienceSchema && window.ExperienceSchema.defaultProperties(type)) || {},
            createdAt: now,
            updatedAt: now
        });
        setExperience(project, experience);
        return experience;
    }

    function updateExperience(project, id, patch) {
        const experience = findExperience(project, id);
        if (!experience) return null;
        Object.assign(experience, patch);
        experience.updatedAt = Date.now();
        return experience;
    }

    function updateExperienceProperty(project, id, key, value) {
        const experience = findExperience(project, id);
        if (!experience) return null;
        if (!experience.properties) experience.properties = {};
        experience.properties[key] = value;
        experience.updatedAt = Date.now();
        _syncExperienceAttachments(project, experience);
        return experience;
    }

    // Delete exists only for Nurturing Experiences (Canon Decision #9)
    // — enforced here, at the single choke point every deletion call
    // passes through, not left to the UI to remember.
    function deleteExperience(project, id) {
        const experience = findExperience(project, id);
        if (!experience || experience.lifecycle !== 'nurturing') return false;
        delete project.files['experiences/' + id + '.json'];
        if (Array.isArray(project.experienceOrder)) {
            project.experienceOrder = project.experienceOrder.filter(function (x) { return x !== id; });
        }
        return true;
    }

    // ---------------------------------------------------------------
    // Graduation (Builder V3 Milestone 3) — the Creative Journey's one
    // fork, never a ladder: Nurturing graduates directly to Personal
    // (choosing which Scene it belongs to) or straight to Public; a
    // Personal Experience may later choose to become Public. There is
    // no reverse path and nothing ever returns to the Nursery — Theme
    // Experiences are permanent (Canon Decisions #6, #8).
    // ---------------------------------------------------------------

    function graduateToPersonal(project, id, sceneId) {
        const experience = findExperience(project, id);
        if (!experience || experience.lifecycle !== 'nurturing') return false;
        if (!findScene(project, sceneId)) return false;
        experience.lifecycle = 'personal';
        experience.scopeSceneId = sceneId;
        experience.updatedAt = Date.now();
        return true;
    }

    function graduateToPublic(project, id) {
        const experience = findExperience(project, id);
        if (!experience) return false;
        if (experience.lifecycle === 'public') return true;
        if (experience.lifecycle !== 'nurturing' && experience.lifecycle !== 'personal') return false;
        experience.lifecycle = 'public';
        experience.updatedAt = Date.now();
        return true;
    }

    // ---------------------------------------------------------------
    // Hosting (Builder V3 Milestone 3, renamed from "Attachment" by the
    // Canon Alignment Sprint) — real Usage, real rendering wherever the
    // Engine Adapter already has a mechanism to project onto
    // (js/services/experienceSchema.js's `rendersWhenHosted` documents
    // exactly which type+Hosted-By combinations that is today). A
    // Nurturing Experience can never be hosted for real (Canon: "cannot
    // yet be attached"); a Personal Experience may only host within its
    // own `scopeSceneId` ("belongs to one Scene only"); a Public
    // Experience may host wherever compatible.
    //
    // Each real usage entry is still `{sceneId, placeId}` — placeId set
    // means "lives inside this one Place," placeId null means the
    // Experience's own `hostedBy` ('scene' or 'free') decides whether it
    // fills the whole Scene or roams it independently; see
    // _syncExperienceAttachments below, the Engine Adapter boundary
    // where that product distinction is translated into a real render.
    // ---------------------------------------------------------------

    function _sameAttachment(a, b) {
        return a.sceneId === b.sceneId && (a.placeId || null) === (b.placeId || null);
    }

    function attachExperience(project, id, target) {
        const experience = findExperience(project, id);
        if (!experience || !target || !target.sceneId) return false;
        if (experience.lifecycle === 'nurturing') return false;
        if (experience.lifecycle === 'personal' && target.sceneId !== experience.scopeSceneId) return false;
        if (target.placeId && !findHolder(project, target.sceneId, target.placeId)) return false;
        if (!target.placeId && !findScene(project, target.sceneId)) return false;

        const entry = { sceneId: target.sceneId, placeId: target.placeId || null };
        if (!experience.attachments.some(function (a) { return _sameAttachment(a, entry); })) {
            experience.attachments.push(entry);
        }
        _syncExperienceAttachments(project, experience);
        return true;
    }

    function detachExperience(project, id, target) {
        const experience = findExperience(project, id);
        if (!experience || !target) return false;
        const entry = { sceneId: target.sceneId, placeId: target.placeId || null };
        experience.attachments = experience.attachments.filter(function (a) { return !_sameAttachment(a, entry); });
        _clearMirror(project, experience, entry);
        return true;
    }

    function usageOf(project, id) {
        const experience = findExperience(project, id);
        if (!experience) return [];
        return experience.attachments.map(function (a) {
            const scene = findScene(project, a.sceneId);
            const place = a.placeId && scene ? (scene.holders || []).find(function (h) { return h.id === a.placeId; }) : null;
            return {
                sceneId: a.sceneId,
                placeId: a.placeId || null,
                sceneName: scene ? scene.name : '(deleted Scene)',
                placeName: place ? place.name : null
            };
        });
    }

    // The Engine Adapter — the one place a Builder-facing Experience
    // (Hosted By Place/Scene/Free) is projected into Engine V2's own,
    // unmodified rendering mechanisms (a Place's `frame` slot; a
    // Scene's full-bleed background fill Layer; a Scene's ordinary
    // `layers` array), never a change to js/services/engineRuntime.js
    // or the Scene Model itself (Canon Alignment Objective 5 —
    // Experience ↓ Frame ↓ Scene Layer ↓ Runtime is this function's own
    // chain, and it alone should ever know that chain exists). Re-synced
    // on every host and on every property edit so an Experience's
    // Inspector is the single place a Theme Author edits its look,
    // regardless of how many Hosts use it.
    function _syncExperienceAttachments(project, experience) {
        if (!window.ExperienceSchema) return;
        experience.attachments.forEach(function (a) {
            if (a.placeId) {
                // Hosted by a Place.
                if (!window.ExperienceSchema.rendersWhenHosted(experience.type, 'place')) return;
                if (experience.type === 'frame') {
                    _mirrorFrame(project, experience);
                    updateHolder(project, a.sceneId, a.placeId, { frame: experience.id });
                }
            } else if (experience.hostedBy === 'scene') {
                // Hosted by the Scene itself — projects onto the Scene's
                // existing full-bleed background fill mechanism, not a
                // new Engine capability.
                if (!window.ExperienceSchema.rendersWhenHosted(experience.type, 'scene')) return;
                const color = (experience.properties && experience.properties.color) || '#F4F1EC';
                setSceneBackground(project, a.sceneId, color);
            } else {
                // Free — roams the Scene as its own independent Layer.
                if (!window.ExperienceSchema.rendersWhenHosted(experience.type, 'free')) return;
                if (experience.type === 'decoration' || experience.type === 'text') {
                    _mirrorSceneLayer(project, a.sceneId, experience);
                }
            }
        });
    }

    function _mirrorFrame(project, experience) {
        setFrame(project, {
            id: experience.id,
            name: experience.name,
            description: 'Mirrored from Experience "' + experience.name + '".',
            fields: Object.assign({}, experience.properties)
        });
    }

    function _findMirroredLayer(project, sceneId, experienceId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        return (scene.layers || []).find(function (l) { return l.sourceExperienceId === experienceId; }) || null;
    }

    function _mirrorSceneLayer(project, sceneId, experience) {
        const existing = _findMirroredLayer(project, sceneId, experience.id);
        const props = experience.properties || {};
        if (existing) {
            Object.assign(existing, experience.type === 'text'
                ? { name: experience.name, text: props.text, font: props.font, fontSize: props.fontSize, align: props.align }
                // Image and Glyph are both simply optional properties,
                // never mutually exclusive (Builder V3 MEP) — both are
                // mirrored so the Runtime can prefer Image when present.
                : { name: experience.name, glyph: props.glyph, color: props.color, image: props.image });
            return existing;
        }
        return addSceneLayer(project, sceneId, Object.assign({
            name: experience.name,
            kind: experience.type === 'text' ? 'text' : 'decoration',
            sourceExperienceId: experience.id
        }, props));
    }

    function _clearMirror(project, experience, entry) {
        if (experience.type === 'frame' && entry.placeId) {
            const holder = findHolder(project, entry.sceneId, entry.placeId);
            if (holder && holder.frame === experience.id) updateHolder(project, entry.sceneId, entry.placeId, { frame: null });
        } else if ((experience.type === 'decoration' || experience.type === 'text') && !entry.placeId) {
            const layer = _findMirroredLayer(project, entry.sceneId, experience.id);
            if (layer) deleteSceneLayer(project, entry.sceneId, layer.id);
        }
    }

    // A plain, standalone validation hook — not yet wired into the
    // Validation screen until this milestone (see below, "Experiences"
    // category added to _renderValidationPanel). Nurturing Experiences
    // are never checked, since they aren't part of the Theme yet
    // ("Nursery items are ignored").
    function validateExperiences(project) {
        const findings = [];
        experiences(project).forEach(function (exp) {
            if (exp.lifecycle === 'nurturing') return;
            if (!exp.name || !exp.name.trim()) {
                findings.push({ level: 'error', experienceId: exp.id, message: 'An Experience is missing a name.' });
            }
            if (exp.lifecycle === 'personal' && !findScene(project, exp.scopeSceneId)) {
                findings.push({ level: 'error', experienceId: exp.id, message: '"' + exp.name + '" belongs to a Scene that no longer exists.' });
            }
            exp.attachments.forEach(function (a) {
                if (!findScene(project, a.sceneId)) {
                    findings.push({ level: 'error', experienceId: exp.id, message: '"' + exp.name + '" is attached to a Scene that no longer exists.' });
                } else if (a.placeId && !findHolder(project, a.sceneId, a.placeId)) {
                    findings.push({ level: 'error', experienceId: exp.id, message: '"' + exp.name + '" is attached to a Place that no longer exists.' });
                } else if (exp.lifecycle === 'personal' && a.sceneId !== exp.scopeSceneId) {
                    findings.push({ level: 'error', experienceId: exp.id, message: '"' + exp.name + '" is Personal to one Scene but attached elsewhere.' });
                }
            });
        });
        return findings;
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
        sceneStack: sceneStack,
        findSceneLayer: findSceneLayer,
        updateSceneLayer: updateSceneLayer,
        addSceneLayer: addSceneLayer,
        deleteSceneLayer: deleteSceneLayer,
        moveInStack: moveInStack,
        setSceneBackground: setSceneBackground,
        getSceneBackgroundColor: getSceneBackgroundColor,
        experiences: experiences,
        findExperience: findExperience,
        setExperience: setExperience,
        addExperience: addExperience,
        updateExperience: updateExperience,
        updateExperienceProperty: updateExperienceProperty,
        deleteExperience: deleteExperience,
        graduateToPersonal: graduateToPersonal,
        graduateToPublic: graduateToPublic,
        attachExperience: attachExperience,
        detachExperience: detachExperience,
        usageOf: usageOf,
        findMirroredSceneLayer: _findMirroredLayer,
        validateExperiences: validateExperiences,
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
