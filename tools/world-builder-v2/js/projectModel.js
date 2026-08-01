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

    // Platform Hardening Sprint — docs/THEME_PROJECT_SPEC.md §6 defines a
    // Frame's real field set as background/frame/paper/shadow/matWidth/
    // frameThickness/borderColor/wallTone; `renderer/slideRenderer.js`'s
    // `_artworkBorder()` resolves its mat fill and frame-ornament design
    // ONLY from `fields.background`/`fields.frame` (via
    // ARTWORK_BACKGROUND_FILL/ARTWORK_FRAME_PRESET) — fields this
    // Builder's own Frames screen never asked for, so every
    // Builder-authored Frame Variation compiled with neither one, and
    // rendered in real Studio with no mat fill and no frame ornament at
    // all (only the border stroke/wall tone came through). Retrofitted
    // here, on every read, the same way `_ensureHolderDefaults` repairs a
    // Holder authored before one of its fields existed — no migration
    // step, no UI change, every already-authored Frame (including a
    // Theme mid-authoring, like Museum Gallery) is repaired the next time
    // it's opened.
    function _ensureFrameFieldDefaults(frame) {
        if (!frame) return frame;
        if (!frame.fields) frame.fields = {};
        const f = frame.fields;
        if (f.background === undefined) f.background = 'white';
        if (f.frame === undefined) f.frame = 'white-mat';
        if (f.paper === undefined) f.paper = 'smooth';
        if (f.matWidth === undefined) f.matWidth = 20;
        if (f.frameThickness === undefined) f.frameThickness = 4;
        if (f.borderColor === undefined) f.borderColor = '#1D3457';
        if (f.wallTone === undefined) f.wallTone = '#F4F1EC';
        if (f.shadow === undefined) f.shadow = 'soft';
        // `frameImage` (Feature 1 -- image-typed Frame Variations): a
        // Collection asset reference (`vihu-asset:...`/`data:...`), used as
        // the mat/background fill in place of a flat colour when
        // `f.background==='image'`. Additive, defaults to null (no image
        // authored) exactly like every other field above -- every Frame
        // Variation authored before this feature simply never has one.
        if (f.frameImage === undefined) f.frameImage = null;
        // `frameImageRotation` (degrees, clockwise) -- "spin/rotate is
        // missing" once Background = Image. Mirrors the identical
        // rotate-around-rect-centre convention every other Universal
        // Content rotation field already uses (Image/Graphics/Text
        // Experience content) -- additive, defaults to 0 (no rotation),
        // so every Frame authored before this exists renders identically.
        if (f.frameImageRotation === undefined) f.frameImageRotation = 0;
        // `matColor` -- Simplify Place & Frame Authoring: a real "pick any
        // colour" mat option (Background='color'). Only meaningful once
        // that value is chosen; a reasonable default burgundy so a Frame
        // switched to Solid Colour never starts on an undefined swatch.
        if (f.matColor === undefined) f.matColor = '#8B2C3B';
        // Simplify Place & Frame Authoring -- "where ever we are using
        // colors an option of transparent color needs to be there."
        // Mirrors the exact Colour-Experience-content convention
        // already shipped (colorValue/colorOpacity/colorTransparent,
        // Builder V3.1) rather than overloading the colour string
        // itself with a special "transparent" value -- a checkbox
        // alongside each colour swatch, independent of whatever hex
        // value sits underneath it. Defaults to false for every Frame
        // that predates this feature (a real, already-authored Frame's
        // wall/border/mat were always concrete, visible colours, never
        // transparent) -- a brand-new Frame's own transparent baseline
        // is set explicitly by _defaultFrameFields() below, so these
        // "if undefined" checks never fire for it and stay reserved
        // for genuine backward-compat reconciliation only.
        if (f.wallToneTransparent === undefined) f.wallToneTransparent = false;
        if (f.borderColorTransparent === undefined) f.borderColorTransparent = false;
        if (f.matColorTransparent === undefined) f.matColorTransparent = false;
        return frame;
    }

    function frames(project) {
        const list = _filesWithPrefix(project, 'frames/').map(function (e) { return _ensureFrameFieldDefaults(e.data); });
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

    // Simplify Place & Frame Authoring -- "a place with no customization
    // ... is just a hook and make no difference. it should be exactly
    // same [as transparent]." A brand-new Frame (from "+ Create Frame"
    // only -- the Frame Style Gallery immediately overwrites these with
    // a real preset's own `fields`) should render exactly like a Place
    // with no Frame at all: zero visible wall/border/mat/shadow. Every
    // value below is set explicitly, not left `undefined`, precisely so
    // `_ensureFrameFieldDefaults`'s own backward-compat reconciliation
    // (reserved for a Frame authored before one of these fields
    // existed, which always resolves to a concrete, visible look) never
    // overwrites this transparent baseline the first time the new
    // Frame is read.
    function _defaultFrameFields() {
        return {
            background: 'transparent', frame: 'none', paper: 'smooth',
            matWidth: 0, frameThickness: 0, defaultMargin: 0,
            borderColor: '#1D3457', borderColorTransparent: true,
            wallTone: '#F4F1EC', wallToneTransparent: true,
            matColor: '#8B2C3B', matColorTransparent: true,
            shadow: 'none',
            frameImage: null, frameImageRotation: 0
        };
    }

    function addFrame(project) {
        const existingIds = frames(project).map(function (f) { return f.id; });
        const id = _uniqueId(existingIds, 'new-frame');
        const frame = { id: id, name: 'New Frame', description: '', fields: _defaultFrameFields() };
        setFrame(project, frame);
        return frame;
    }

    // Neither addFrame nor duplicateFrame uniquify a Frame's own display
    // NAME (only its id, via _uniqueId above) -- used by the Frame Style
    // Gallery so two "Classic White" clicks in a row don't produce two
    // identically-named records with no visible way to tell them apart.
    function _uniqueFrameName(project, baseName) {
        const existingNames = frames(project).map(function (f) { return f.name; });
        if (existingNames.indexOf(baseName) === -1) return baseName;
        let n = 2;
        while (existingNames.indexOf(baseName + ' ' + n) !== -1) { n++; }
        return baseName + ' ' + n;
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

    // A deleted Frame must never survive as a dangling reference — every
    // place a Frame id can be pointed at from (a Representation's
    // `defaultFrame`, a Scene Holder's `frame`) is cleared back to `null`
    // in the same operation that removes the Frame itself. `null` is the
    // schema's own pre-existing "no Frame chosen" state (the same value
    // `addRepresentation`/`_holdersFor` seed when there's nothing to
    // default to) — never a fabricated replacement id.
    function deleteFrame(project, frameId) {
        delete project.files['frames/' + frameId + '.json'];
        if (Array.isArray(project.frameOrder)) {
            project.frameOrder = project.frameOrder.filter(function (id) { return id !== frameId; });
        }
        _clearFrameReferences(project, frameId);
    }

    function _clearFrameReferences(project, frameId) {
        const reps = representations(project);
        let repsChanged = false;
        reps.forEach(function (rep) {
            if (rep.defaultFrame === frameId) { rep.defaultFrame = null; repsChanged = true; }
        });
        if (repsChanged) setRepresentations(project, reps);

        scenes(project).forEach(function (scene) {
            let sceneChanged = false;
            (scene.holders || []).forEach(function (holder) {
                if (holder.frame === frameId) { holder.frame = null; sceneChanged = true; }
            });
            if (sceneChanged) setScene(project, scene);
        });
    }

    // Read-time repair for Themes authored before this integrity guarantee
    // existed (or edited by a Builder version that didn't yet clear
    // references on delete) — the exact same "reconcile lazily, mutate,
    // never crash" pattern `_ordered`/`_ensureHolderDefaults` already use
    // elsewhere in this file. Call once when a Project is opened; returns
    // true if anything was actually repaired, so the caller can decide
    // whether to persist / log.
    function reconcileFrameReferences(project) {
        const frameIds = frames(project).map(function (f) { return f.id; });
        let changed = false;

        const reps = representations(project);
        let repsChanged = false;
        reps.forEach(function (rep) {
            if (rep.defaultFrame && frameIds.indexOf(rep.defaultFrame) === -1) {
                rep.defaultFrame = null;
                repsChanged = true;
            }
        });
        if (repsChanged) { setRepresentations(project, reps); changed = true; }

        scenes(project).forEach(function (scene) {
            let sceneChanged = false;
            (scene.holders || []).forEach(function (holder) {
                if (holder.frame && frameIds.indexOf(holder.frame) === -1) {
                    holder.frame = null;
                    sceneChanged = true;
                }
            });
            if (sceneChanged) { setScene(project, scene); changed = true; }
        });

        return changed;
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
    // Collection (Platform Hardening — a Theme-scoped, deduplicated
    // asset registry). "Any asset added while authoring a Scene also
    // goes into Collection; a Scene always refers to the asset that's
    // in Collection; builder can delete from Collection but not
    // Creator; Collection can hold assets used in Scenes and others the
    // Builder wants Creator to have access to for customization."
    //
    // A Collection entry is a derived, ref-indexed side table — NOT a
    // new indirection layer. `experience.properties.imageSrc`/
    // `.graphicSrc` and the mirrored `layer.image` field never change
    // shape: they still hold a plain `vihu-asset:`/`data:` string,
    // exactly what AssetStore.resolve()/ThemeRegistry.resolveAssetRef()/
    // externalizeSceneImage()/the Draft Asset Architecture migration
    // accessor all already expect. A Collection entry's own `.ref`
    // field is literally that same string — "connecting to an existing
    // Collection asset" means writing that entry's `.ref` back onto a
    // different Experience's `imageSrc`/`graphicSrc`, the identical
    // write path a fresh upload already uses.
    //
    // Mirrors the Frame CRUD pattern above 1:1 (a Frame is its own
    // file, referenced by id, deleted by nulling every dangling
    // reference in the same operation, "AV-012") — the one real
    // difference is Collection needs no separate Scene-Layer scan the
    // way Frame's `_clearFrameReferences` does: `layer.image` has
    // exactly one producer today, the Experience mirror chain
    // (`_syncUniversalContent`) — no direct-to-Scene-Layer
    // decoration-image upload UI exists anywhere in this codebase.
    // ---------------------------------------------------------------

    function collectionAssets(project) {
        const list = _filesWithPrefix(project, 'collection/').map(function (e) { return e.data; });
        return _ordered(project, 'collectionOrder', list);
    }

    function findCollectionAsset(project, id) {
        return collectionAssets(project).find(function (a) { return a.id === id; }) || null;
    }

    // AssetStore.put() mints a brand-new random assetId on every call
    // (js/assetStore.js's own id generator), so two genuinely different
    // uploads never collide on `ref` — a plain linear scan by ref-value
    // match is reliable and needs no separate index structure.
    function findCollectionAssetByRef(project, ref) {
        if (!ref) return null;
        return collectionAssets(project).find(function (a) { return a.ref === ref; }) || null;
    }

    function setCollectionAsset(project, entry) {
        project.files['collection/' + entry.id + '.json'] = entry;
    }

    // The one entry point "any asset added to a Scene also goes into
    // Collection" is realized through — called from
    // updateExperienceProperty below for every real producer (a picker
    // upload, the Decoration glyph-rasterization path) with zero
    // per-caller changes needed elsewhere. Idempotent: a ref already
    // registered is simply touched (bumped updatedAt), never
    // duplicated — this is also how "reuse" is expressed: registering
    // the same ref a second time (because a Theme Author picked an
    // existing Collection entry rather than uploading a new one) is a
    // clean no-op, not a second entry.
    function registerCollectionAsset(project, ref, meta) {
        if (!ref) return null;
        const existing = findCollectionAssetByRef(project, ref);
        if (existing) {
            existing.updatedAt = Date.now();
            setCollectionAsset(project, existing);
            return existing;
        }
        meta = meta || {};
        const existingIds = collectionAssets(project).map(function (a) { return a.id; });
        const id = _uniqueId(existingIds, 'asset');
        const now = Date.now();
        const entry = {
            id: id,
            name: meta.name || 'Untitled Asset',
            kind: meta.kind || 'image',
            ref: ref,
            availableToCreator: false,
            createdAt: now,
            updatedAt: now
        };
        setCollectionAsset(project, entry);
        return entry;
    }

    // Repoints an already-registered Collection entry's own `.ref` to a
    // new string for the SAME underlying bytes — the migration-retarget
    // fix. Draft Asset Architecture's own lazy migration
    // (AssetStore.migrateFieldsOnSave, called from
    // worldBuilderApp.js's _collectMigrationAccessors) can rewrite an
    // Experience's imageSrc/graphicSrc from a legacy data: URI to a
    // vihu-asset: reference for the exact same bytes, entirely
    // independent of Collection — without this, a naive ref-indexed
    // lookup would either orphan the existing entry (its own .ref now
    // points at a string nothing holds anymore) or spawn a wasteful
    // duplicate the next time that string is registered. Never creates,
    // never duplicates — a no-op if no entry is currently registered
    // under oldRef.
    function retargetCollectionAssetRef(project, oldRef, newRef) {
        if (!oldRef || !newRef || oldRef === newRef) return null;
        const entry = findCollectionAssetByRef(project, oldRef);
        if (!entry) return null;
        entry.ref = newRef;
        entry.updatedAt = Date.now();
        setCollectionAsset(project, entry);
        return entry;
    }

    function renameCollectionAsset(project, id, name) {
        const entry = findCollectionAsset(project, id);
        if (!entry) return null;
        entry.name = name;
        entry.updatedAt = Date.now();
        return entry;
    }

    function setCollectionAssetAvailability(project, id, available) {
        const entry = findCollectionAsset(project, id);
        if (!entry) return null;
        entry.availableToCreator = !!available;
        entry.updatedAt = Date.now();
        return entry;
    }

    // Every Experience currently referencing this Collection entry —
    // used by the Manage Collection delete confirmation to show "used
    // by N Experiences" before a Builder commits to deleting.
    //
    // Multi-Asset Experience Parts: scans every part in `parts[]`, not
    // just the flat top-level imageSrc/graphicSrc mirror -- that mirror
    // only ever reflects parts[0] ("the primary part"), so scanning it
    // alone would silently undercount (or miss entirely) a reference
    // held by part 2-5, and would double-count nothing either way since
    // a part's own props are the one real source of truth here.
    //
    // Feature 1 (image-typed Frame Variations): also scans every Frame's
    // own `fields.frameImage`, its own separate producer of Collection
    // refs (registered explicitly from the Frames screen, not through
    // updateExperienceProperty's imageSrc/graphicSrc hook — see
    // `_renderFramesPanel`'s onCommit in worldBuilderApp.js) — the same
    // AV-012 "never leave a dangling reference" discipline this whole
    // function already applies to Experiences.
    function collectionAssetUsageCount(project, id) {
        const entry = findCollectionAsset(project, id);
        if (!entry) return 0;
        let count = 0;
        experiences(project).forEach(function (exp) {
            (exp.properties.parts || []).forEach(function (part) {
                const props = part.props || {};
                if (props.imageSrc === entry.ref || props.graphicSrc === entry.ref) count++;
            });
        });
        frames(project).forEach(function (fr) {
            if (fr.fields && fr.fields.frameImage === entry.ref) count++;
        });
        return count;
    }

    // Builder-only — never reachable from any Creator-facing code path
    // ("builder can delete from collection but not creator"). Nulls
    // every part's own imageSrc/graphicSrc currently equal to this
    // entry's own ref — never blocks, never fabricates a substitute —
    // the exact discipline already established for Frame
    // (_clearFrameReferences, "AV-012"). Routed through
    // updateExperiencePartProperty (not updateExperienceProperty) so a
    // reference held by part 2-5 is nulled on that SPECIFIC part rather
    // than accidentally overwriting whatever parts[0] independently
    // holds; the function's own existing parts[0]-mirror logic still
    // correctly updates the flat top-level fields when the nulled part
    // happens to be parts[0]. Fires the existing Engine Adapter re-sync
    // (_syncExperienceAttachments) for every affected part, so Working
    // View/Runtime Preview both correctly clear, never left showing a
    // stale image for a reference that no longer resolves to anything.
    //
    // Feature 1: also nulls any Frame's own `fields.frameImage` matching
    // this entry's ref — via setFrameFieldValue directly (a plain Frame
    // has no Experience-mirror re-sync to fire at all; an
    // Experience-backed Frame's own fields are re-derived from its
    // properties by `_mirrorFrame` on the very next unrelated edit
    // regardless, so nulling the Frame's own field here is enough to
    // stop it rendering immediately without needing a second write path
    // through updateExperienceProperty).
    function deleteCollectionAsset(project, id) {
        const entry = findCollectionAsset(project, id);
        if (!entry) return false;
        delete project.files['collection/' + id + '.json'];
        if (Array.isArray(project.collectionOrder)) {
            project.collectionOrder = project.collectionOrder.filter(function (x) { return x !== id; });
        }
        experiences(project).forEach(function (exp) {
            (exp.properties.parts || []).forEach(function (part) {
                const props = part.props || {};
                if (props.imageSrc === entry.ref) updateExperiencePartProperty(project, exp.id, part.id, 'imageSrc', null);
                if (props.graphicSrc === entry.ref) updateExperiencePartProperty(project, exp.id, part.id, 'graphicSrc', null);
            });
        });
        frames(project).forEach(function (fr) {
            if (fr.fields && fr.fields.frameImage === entry.ref) setFrameFieldValue(project, fr.id, 'frameImage', null);
        });
        return true;
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

    // `opacity` (0..1, default 1) — a real, user-requested "set the
    // background colour as transparent" capability, added on top of the
    // pre-existing colour-only signature (every existing caller omits it
    // and keeps its exact opaque behaviour, byte-for-byte). Deliberately
    // reuses the SAME "an ordinary full-bleed fill Scene Layer, not a
    // special field" mechanism this function already established — a
    // Layer's own `opacity` is already a real, already-rendered field
    // (Universal Experience Content's Opacity slider) — so a fully
    // transparent background is just this Layer at opacity 0, no new
    // Engine capability, matching Engine Invariant 8 exactly.
    function setSceneBackground(project, sceneId, color, opacity) {
        const op = (typeof opacity === 'number') ? opacity : 1;
        const existing = _bottomFillLayer(project, sceneId);
        if (existing) {
            existing.color = color;
            existing.opacity = op;
            return existing;
        }
        const layer = addSceneLayer(project, sceneId, {
            kind: 'fill', name: 'Background', color: color,
            position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, atBottom: true
        });
        layer.opacity = op;
        return layer;
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
        if (!exp.type) exp.type = (window.ExperienceSchema && window.ExperienceSchema.DEFAULT_EXPERIENCE_TYPE) || 'decoration';
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
        _ensureUniversalContentDefaults(exp);
        _ensurePartsDefaults(exp);
        // Only-one-content-type-at-a-time — a direct product simplification
        // request, after Builder V3.1 deliberately let every Experience
        // hold Text+Image+Graphics+Colour simultaneously. `contentKind`
        // ('text'|'image'|'graphics'|'colour') is which one is actually
        // active; `_syncUniversalContent` below only ever mirrors that one,
        // regardless of what stray data might sit in the other fields, so
        // this is enforced at the Engine Adapter boundary, not just hidden
        // in the Inspector. Inferred once, read-time, for any Experience
        // that predates this field (the same reconciliation pattern as
        // every other field on this object) — picks whichever section
        // already has real content rather than defaulting blind and
        // silently hiding an author's existing work.
        if (!exp.contentKind) exp.contentKind = _inferContentKind(exp.properties);
        if (!exp.createdAt) exp.createdAt = exp.updatedAt || Date.now();
        if (!exp.updatedAt) exp.updatedAt = exp.createdAt;
        return exp;
    }

    // Builder V3.1 — Universal Experience Authoring. Every Experience
    // gets the four universal content fields (js/services/
    // experienceSchema.js's `defaultUniversalContent`), read-time-
    // reconciled exactly like every other "authored before this field
    // existed" migration in this file (`_ensureHolderDefaults`/
    // `_ensureStack`'s own pattern). A pre-existing Frame/Decoration/
    // Text Experience's legacy fields (`color`, `image`, `text`, `font`,
    // `fontSize`, `align`, `matWidth`, ...) are never deleted or
    // reinterpreted — only copied once into the new namespaced fields,
    // so the Inspector shows sensible starting content instead of a
    // blank slate, and — because the Engine Adapter now renders
    // Scene/Free hosting from these same namespaced fields going
    // forward — a migrated Experience keeps rendering identically to
    // before this milestone (the copied values start out identical).
    function _ensureUniversalContentDefaults(exp) {
        const props = exp.properties;
        const defaults = (window.ExperienceSchema && window.ExperienceSchema.defaultUniversalContent()) || {};
        Object.keys(defaults).forEach(function (key) {
            if (props[key] === undefined) props[key] = defaults[key];
        });
        if (exp._universalMigrated) return;
        if (exp.type === 'decoration') {
            // `color` on a legacy Decoration SceneLayer was already
            // inert (`_paintLayer`'s decoration branch never reads
            // `.color`) — copy the value so the Colour picker isn't
            // blank, but leave `colorTransparent` at its fresh default
            // (true) so a pre-existing Decoration's render is provably
            // unaffected; an author must deliberately uncheck
            // Transparent to make it visible for the first time.
            if (props.color !== undefined) props.colorValue = props.color;
            if (props.image) props.imageSrc = props.image;
        } else if (exp.type === 'text') {
            if (props.text !== undefined) props.textContent = props.text;
            if (props.font) props.textFont = props.font;
            if (props.fontSize) props.textSize = props.fontSize;
            if (props.align) props.textAlign = props.align;
            if (props.color) props.textColor = props.color;
        }
        exp._universalMigrated = true;
    }

    // Priority mirrors the existing Gallery/Nursery card-thumbnail
    // preference (`_experienceCard` in worldBuilderApp.js: Image, then
    // Graphics, then a non-transparent Colour) with Text slotted in
    // ahead of Colour, since real text content is a more deliberate
    // authoring choice than a leftover default fill colour. A brand-new
    // Experience with nothing populated yet starts on Text — the
    // friendliest, lowest-friction thing to type into first.
    function _inferContentKind(props) {
        if (props.imageSrc) return 'image';
        if (props.graphicSrc || props.graphicShape) return 'graphics';
        if (props.textContent && props.textContent.trim()) return 'text';
        if (props.colorTransparent === false) return 'colour';
        return 'text';
    }

    // Multi-Asset Experience Parts — "incorporate multiple assets in
    // single experience... combinations... not exceeding 5." Wraps
    // every pre-existing single-`contentKind` Experience (including a
    // brand-new one from `addExperience` below, and every Experience
    // authored before this feature existed) into a one-entry `parts`
    // array on first touch — the exact same lazy, read-time
    // reconciliation discipline `_ensureHolderDefaults`/`_ordered`
    // already use elsewhere in this file. No proactive sweep; a Project
    // never re-opened in v2 simply never gets `parts` written to disk.
    // Idempotent — an Experience already carrying real `parts` is left
    // completely untouched.
    function _ensurePartsDefaults(exp) {
        const props = exp.properties;
        if (Array.isArray(props.parts) && props.parts.length) return;
        const kind = exp.contentKind || _inferContentKind(props);
        const schema = window.ExperienceSchema;
        const keys = (schema && schema.PART_FIELD_KEYS && schema.PART_FIELD_KEYS[kind]) || [];
        const partProps = {};
        keys.forEach(function (k) { partProps[k] = props[k]; });
        props.parts = [{ id: _uniqueId([], kind + '-part'), kind: kind, props: partProps }];
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
        // Builder V3.1 — an author never picks a Type anymore; contextual
        // creation (Place/Decorations/Text quick-create) still passes one
        // internally for Engine Adapter dispatch, but a bare "+ New
        // Experience" (the Nursery) always defaults here.
        const type = spec.type || (window.ExperienceSchema && window.ExperienceSchema.DEFAULT_EXPERIENCE_TYPE) || 'decoration';
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
            properties: (window.ExperienceSchema && window.ExperienceSchema.defaultProperties(type, spec.hostedBy)) || {},
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
        // The legacy Content Kind selector (pre-dates Multi-Asset
        // Experience Parts, retired by Phase 4's real part-list UI in
        // favour of explicit Add/Remove-a-Part) still switches which
        // single section is "active" via a bare `contentKind` patch —
        // with no concept of parts[0] at all. Left unhandled, a fresh
        // Experience's very first content-kind pick (contentKind starts
        // 'text' at creation, per _inferContentKind) would silently
        // mirror nothing: parts[0].kind stays 'text' forever, so
        // updateExperienceProperty's later `imageSrc` write never lands
        // in a props bag that has that key at all. Per this feature's
        // own disclosed scope ("changing an existing part's kind —
        // remove + re-add instead"), genuinely swap parts[0] for a
        // fresh part under a NEW id when the kind changes — the id
        // change is what makes the existing orphan sweep in
        // _syncUniversalContent correctly delete whatever mirrored
        // Layer the old kind had (its own fields/`.kind` would
        // otherwise be wrong for the new content, if reused in place)
        // while a brand-new, correctly-typed Layer is created for the
        // new kind on the very next sync.
        //
        // The new part's own props are read straight off the flat
        // `experience.properties` bag (never fresh, blank defaults) —
        // Builder V3.1 already guarantees every one of the four kinds'
        // fields sits there simultaneously (_ensureUniversalContentDefaults),
        // so this naturally picks up whatever a Theme Author already
        // typed for this kind, whether that happened before this exact
        // kind switch or after an earlier one — matching the pre-parts
        // flat-bag model's own "switching kinds never loses data"
        // guarantee exactly, just re-derived at swap time instead of
        // being true for free.
        if (patch && patch.contentKind) {
            const parts = experience.properties.parts;
            if (Array.isArray(parts) && parts[0] && parts[0].kind !== patch.contentKind) {
                const schema = window.ExperienceSchema;
                const keys = (schema && schema.PART_FIELD_KEYS && schema.PART_FIELD_KEYS[patch.contentKind]) || [];
                const newProps = {};
                keys.forEach(function (k) { newProps[k] = experience.properties[k]; });
                parts[0] = {
                    id: _uniqueId(parts.map(function (p) { return p.id; }), patch.contentKind + '-part'),
                    kind: patch.contentKind,
                    props: newProps
                };
                Object.assign(experience.properties, newProps);
            }
        }
        // Matches updateExperienceProperty's own re-sync below — a patch
        // through this generic path (e.g. contentKind, switching which
        // single content section is active) can affect what the Engine
        // Adapter should be mirroring just as much as a Properties edit
        // can, so it gets the identical re-sync rather than silently
        // leaving Working View/Runtime Preview showing stale content
        // until some other, unrelated edit happens to trigger one.
        _syncExperienceAttachments(project, experience);
        return experience;
    }

    function updateExperienceProperty(project, id, key, value) {
        const experience = findExperience(project, id);
        if (!experience) return null;
        if (!experience.properties) experience.properties = {};
        experience.properties[key] = value;
        experience.updatedAt = Date.now();
        // Multi-Asset Experience Parts — the real content now lives at
        // experience.properties.parts[0].props (the "primary" part);
        // the flat top-level fields written above are kept as a live
        // mirror of it, not retired, since v1 (and anything else that
        // still only reads the flat fields) shares the same
        // localStorage key as v2 and must keep seeing something correct
        // rather than blank/stale. Every legacy caller of this function
        // (Frame fields; any pre-Phase-4 Universal Content edit) keeps
        // working byte-identically — this only adds a second write.
        const primaryPart = (experience.properties.parts || [])[0];
        if (primaryPart && primaryPart.props && key in primaryPart.props) primaryPart.props[key] = value;
        // Collection auto-registration (Platform Hardening) — "any
        // asset am adding to any scene gets added into collection
        // also." One chokepoint covers every current and future
        // producer (the Experience content picker's upload branch, the
        // Decoration glyph-rasterization path) with zero per-caller
        // changes needed. A null/cleared value (e.g. Collection's own
        // Builder-only delete nulling a dangling reference) never
        // registers anything.
        if ((key === 'imageSrc' || key === 'graphicSrc') && value) {
            registerCollectionAsset(project, value, { kind: key === 'imageSrc' ? 'image' : 'graphic', name: experience.name });
        }
        _syncExperienceAttachments(project, experience);
        return experience;
    }

    // The real, part-scoped setter — every Multi-Asset Experience Parts
    // UI control (Phase 4) writes through this, never the legacy
    // updateExperienceProperty above directly. Mirrors up to the flat
    // top-level fields (and contentKind) only when the edited part IS
    // parts[0] — see updateExperienceProperty's own comment for why
    // that mirror exists at all.
    function updateExperiencePartProperty(project, id, partId, key, value) {
        const experience = findExperience(project, id);
        if (!experience) return null;
        const parts = experience.properties.parts || [];
        const part = parts.find(function (p) { return p.id === partId; });
        if (!part) return null;
        if (!part.props) part.props = {};
        part.props[key] = value;
        experience.updatedAt = Date.now();
        if (parts[0] && parts[0].id === partId) {
            experience.properties[key] = value;
            experience.contentKind = part.kind;
        }
        if ((key === 'imageSrc' || key === 'graphicSrc') && value) {
            registerCollectionAsset(project, value, { kind: key === 'imageSrc' ? 'image' : 'graphic', name: experience.name });
        }
        _syncExperienceAttachments(project, experience);
        return experience;
    }

    // Model-layer cap enforcement, not just a disabled UI button —
    // matches this file's own established convention (e.g.
    // deleteExperience already refuses at the model function for a
    // non-Nurturing Experience, never only via a hidden button).
    function addExperiencePart(project, experienceId, kind) {
        const experience = findExperience(project, experienceId);
        if (!experience) return null;
        const parts = experience.properties.parts;
        const schema = window.ExperienceSchema;
        const max = (schema && schema.MAX_EXPERIENCE_PARTS) || 5;
        if (!Array.isArray(parts) || parts.length >= max) return null;
        const existingIds = parts.map(function (p) { return p.id; });
        const part = {
            id: _uniqueId(existingIds, kind + '-part'),
            kind: kind,
            props: (schema && schema.defaultPartProps(kind, experience.hostedBy)) || {}
        };
        parts.push(part);
        experience.updatedAt = Date.now();
        _syncExperienceAttachments(project, experience);
        return part;
    }

    // An Experience always keeps at least one part — refuses rather
    // than ever leaving `parts` empty, the same "never a degenerate
    // empty state" discipline this file already applies elsewhere
    // (e.g. an Experience is always born with real default Properties,
    // never blank ones).
    function removeExperiencePart(project, experienceId, partId) {
        const experience = findExperience(project, experienceId);
        if (!experience) return false;
        const parts = experience.properties.parts;
        if (!Array.isArray(parts) || parts.length <= 1) return false;
        const idx = parts.findIndex(function (p) { return p.id === partId; });
        if (idx === -1) return false;
        parts.splice(idx, 1);
        experience.updatedAt = Date.now();
        if (parts[0]) {
            Object.assign(experience.properties, parts[0].props);
            experience.contentKind = parts[0].kind;
        }
        // _syncExperienceAttachments -> _syncUniversalContent also runs
        // the orphan sweep that removes the deleted part's own mirrored
        // Scene Layer (Phase 2).
        _syncExperienceAttachments(project, experience);
        return true;
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
                if (!window.ExperienceSchema.rendersWhenHosted(experience.type, 'place')) return;
                if (experience.type === 'frame') {
                    // Unchanged — a Frame Experience Hosted By Place
                    // projects its whole identity onto the Place's own
                    // Frame slot (a reference, not a rect), exactly as
                    // before "Extend Experiences to Places."
                    _mirrorFrame(project, experience);
                    updateHolder(project, a.sceneId, a.placeId, { frame: experience.id });
                } else {
                    // "Extend Experiences to Places" — every other type
                    // (decoration/text, the ones authors actually create
                    // through any real flow today) now mirrors its own
                    // Universal Content parts as ordinary Scene Layers,
                    // exactly like Scene/Free hosting already do, just
                    // tagged to paint alongside this specific Place
                    // instead of the whole Scene/canvas.
                    _syncUniversalContent(project, a.sceneId, experience, 'place', a.placeId);
                }
            } else {
                // Scene or Free — Builder V3.1 Universal Experience
                // Authoring: every Experience, regardless of `type`,
                // projects its four universal content sections (Text/
                // Image/Graphics/Colour) the same way.
                _syncUniversalContent(project, a.sceneId, experience, experience.hostedBy === 'scene' ? 'scene' : 'free');
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

    // `partId` identifies exactly one of an Experience's own
    // `properties.parts` entries (Multi-Asset Experience Parts — "up to
    // 5 assets per Experience, repeats of the same kind allowed") — the
    // real lookup key a mirrored Scene Layer needs now, since two parts
    // can share one `kind` with nothing else to tell them apart.
    // `partId === undefined` still matches the one genuinely older tier
    // this file has to recognize on its own: a pre-Builder-V3.1 legacy
    // single mirrored layer with neither a `contentSlot` nor a `partId`
    // at all — Frame's old Decoration/Text single-Layer-per-Experience
    // mechanism (see `_claimLegacyMirrorLayer`). `layer.contentSlot`
    // (`'color'`/`'text'`/`'image'`/`'graphic'`) is kept, unchanged in
    // shape, as a non-identity classification tag only — still useful
    // for anything reading a mirrored Layer that only cares "what kind
    // of content is this," never for finding it.
    function _findMirroredLayer(project, sceneId, experienceId, partId) {
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        return (scene.layers || []).find(function (l) {
            return l.sourceExperienceId === experienceId && (partId === undefined ? (!l.contentSlot && !l.partId) : l.partId === partId);
        }) || null;
    }

    // A pre-existing (pre-Builder-V3.1) Experience already mirrored a
    // single mirrored Layer with no `contentSlot` tag — reusing it in
    // place (rather than leaving it orphaned and creating a fresh one)
    // means the Wax Seal/Museum Caption/etc an author already
    // positioned keeps its exact Scene position the first time its
    // owning Experience is touched under the new Universal model,
    // instead of visually duplicating or jumping to a fresh default
    // rect. Only ever attempted for `parts[0]` (the caller enforces
    // this) — the one part that could possibly already have such a
    // layer, since this tier predates every content-kind concept this
    // file has.
    function _claimLegacyMirrorLayer(project, sceneId, experience, wantKind) {
        const legacy = _findMirroredLayer(project, sceneId, experience.id, undefined);
        if (!legacy || legacy.kind !== wantKind) return null;
        return legacy;
    }

    // The Multi-Asset Experience Parts sibling of the above — a
    // V3.1-era mirrored Layer, already tagged with `contentSlot`, but
    // authored before `partId` existed. Claimed in place for `parts[0]`
    // only, the one part that could possibly already have one,
    // preventing every already-authored Experience (including the
    // real, on-disk Museum Gallery Theme) from visually duplicating or
    // jumping the first time it's re-synced under this feature.
    function _claimUntaggedPartLayer(project, sceneId, experience, part) {
        if (experience.properties.parts[0] !== part) return null;
        const scene = findScene(project, sceneId);
        if (!scene) return null;
        const slotForKind = { colour: 'color', text: 'text', image: 'image', graphics: 'graphic' }[part.kind];
        if (!slotForKind) return null;
        return (scene.layers || []).find(function (l) {
            return l.sourceExperienceId === experience.id && l.contentSlot === slotForKind && !l.partId;
        }) || null;
    }

    function _removeMirroredLayer(project, sceneId, experienceId, partId) {
        const layer = _findMirroredLayer(project, sceneId, experienceId, partId);
        if (layer) deleteSceneLayer(project, sceneId, layer.id);
    }

    // The rect a Free-hosted Experience's active content occupies —
    // originally the bounding box of whichever *of Text/Image/Graphics*
    // had content, so a simultaneously-rendered Colour fill read as "a
    // backdrop behind what's here." Only-one-content-type-at-a-time
    // retires that premise: Colour is now itself a `kind`, not a
    // backdrop for a different kind rendering alongside it, so when
    // `kind === 'colour'` there is no longer any "what's here" to back
    // up — it gets the same sensible default rect as "nothing
    // populated yet." For every other kind, this returns that one
    // kind's own rect if it has real content, gated exactly like
    // `_syncPartLayer`'s own render gate so a stray, inactive section's
    // leftover Transform can never influence this either. Still a
    // plain function of one part's own `props` bag and `kind` — every
    // caller now passes `part.props`/`part.kind`, unchanged in
    // signature and behavior.
    function _universalContentFootprint(props, kind) {
        if (kind === 'image' && props.imageSrc) {
            return { x: props.imageX, y: props.imageY, w: props.imageW, h: props.imageH };
        }
        if (kind === 'graphics' && props.graphicSrc) {
            return { x: props.graphicX, y: props.graphicY, w: props.graphicW, h: props.graphicH };
        }
        if (kind === 'text' && props.textContent && props.textContent.trim()) {
            return { x: props.textX, y: props.textY, w: props.textW, h: props.textH };
        }
        return { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
    }

    // Two same-kind parts on one Experience get numbered labels ("Image
    // 2") on their own mirrored Layers so builder.js's compiled
    // label/js/objectStrip.js's Object Strip card never read
    // identically for both — see _syncUniversalContent's own comment.
    function _partKindLabel(kind) {
        if (kind === 'image') return 'Image';
        if (kind === 'graphics') return 'Graphics';
        if (kind === 'text') return 'Text';
        if (kind === 'colour') return 'Colour';
        return 'Content';
    }

    // Builder V3.1 Universal Experience Authoring, extended for
    // Multi-Asset Experience Parts — "incorporate multiple assets in
    // single experience... combinations... not exceeding 5," with
    // repeats of the same kind allowed — and for "Extend Experiences to
    // Places" (a new `fillMode==='place'`, `placeId` naming which
    // Place). `experience.properties.parts` is guaranteed non-empty by
    // `_ensurePartsDefaults`; array order is paint order, matching
    // Scene's own `stack`/`addSceneLayer`-appends convention. Only the
    // FIRST `colour`-kind part, and only when Scene-hosted, may become
    // the Scene's own full-bleed background (the existing, unchanged
    // mechanism) — every other part, including a colour part beyond the
    // first, any colour part when Free-hosted, or ANY part at all when
    // Place-hosted (Colour included — a Place has no separate
    // "background" concept of its own the way a Scene does), mirrors as
    // an ordinary positioned Scene Layer below, each keyed by its own
    // `part.id` so N parts sharing one `kind` never collide.
    function _syncUniversalContent(project, sceneId, experience, fillMode, placeId) {
        const parts = experience.properties.parts || [];

        const backgroundPart = fillMode === 'scene' ? (parts.find(function (p) { return p.kind === 'colour'; }) || null) : null;
        if (backgroundPart) {
            // Hosted by the Scene itself — the existing full-bleed
            // background fill mechanism, not a new Engine capability.
            //
            // Transparent forces the background to opacity 0 (rendered
            // as literally nothing — engineRuntime.js's _paintLayer/
            // renderer/slideRenderer.js's fill-kind branch both already
            // early-return/no-op at opacity<=0), otherwise the Opacity
            // slider's own value applies. render()/render(s) in both
            // engines skip their opaque backdrop fallback whenever this
            // full-bleed Layer exists (any opacity), so a fully
            // transparent one now genuinely shows through to whatever
            // sits behind the canvas — not a hardcoded cream fallback —
            // while every Scene that never touches Colour at all keeps
            // that fallback completely unchanged.
            const opacity = backgroundPart.props.colorTransparent ? 0 : (typeof backgroundPart.props.colorOpacity === 'number' ? backgroundPart.props.colorOpacity : 1);
            setSceneBackground(project, sceneId, backgroundPart.props.colorValue || '#F4F1EC', opacity);
        }

        // Layer-name disambiguation — builder.js copies a Layer's own
        // `name` verbatim into the compiled Layer Pack entry's `label`,
        // which js/objectStrip.js (root Studio) uses as the Object
        // Strip card's own label with zero Experience-grouping
        // awareness of its own. A second part of the same kind gets a
        // numbered suffix (" — Image 2") so its own card never reads
        // identically to the first's; a single part of a given kind
        // keeps its exact pre-multi-part name (Colour's own
        // " — Colour" suffix, Text/Image/Graphics unsuffixed).
        const kindCounts = {};
        const liveMirroredPartIds = [];

        parts.forEach(function (part) {
            if (part === backgroundPart) return; // already the Scene's own background — no separate Layer
            kindCounts[part.kind] = (kindCounts[part.kind] || 0) + 1;
            const ordinal = kindCounts[part.kind];
            const isPrimaryPart = parts[0] === part;
            liveMirroredPartIds.push(part.id);
            _syncPartLayer(project, sceneId, experience, part, fillMode, ordinal, isPrimaryPart, placeId);
        });

        // Orphan sweep — a mirrored Layer whose partId no longer names
        // a live part (a Remove-a-Part action) is deleted, matching
        // AV-012's own "never leave a dangling reference behind"
        // discipline already established for Frame.
        const scene = findScene(project, sceneId);
        if (scene) {
            (scene.layers || []).slice().forEach(function (l) {
                if (l.sourceExperienceId === experience.id && l.partId && liveMirroredPartIds.indexOf(l.partId) === -1) {
                    deleteSceneLayer(project, sceneId, l.id);
                }
            });
        }
    }

    // One part's own mirrored Scene Layer — the generalized body of
    // what used to be three separate hardcoded blocks (Colour/Text/
    // Image-or-Graphics) directly inside _syncUniversalContent,
    // unchanged in behavior for the pre-multi-part single-part case.
    // `isPrimaryPart` gates BOTH claim tiers (`_claimUntaggedPartLayer`/
    // `_claimLegacyMirrorLayer`) to `parts[0]` only — the one part that
    // could possibly already have a pre-existing mirrored Layer from
    // before this feature (or before Universal Content itself) existed;
    // a part added later via `addExperiencePart` always starts fresh.
    // `placeId` (only meaningful when `fillMode==='place'`) tags the
    // mirrored Layer with `hostPlaceId` — "Extend Experiences to
    // Places": the compile step (js/services/builder.js's
    // `convergeSceneLayer`) reads this to converge onto a new
    // `target:'place'` scope, and both render engines resolve such a
    // Layer's rect from its own Place's *current* geometry at paint
    // time (never a copied/stale snapshot) — so the position/size this
    // function still writes below (unchanged from the Scene/Free case)
    // are genuinely fractional *within the Place*, not the Canvas, for
    // a Place-hosted part; `defaultUniversalContent`'s own `fillBleed`
    // seeding already treats `hostedBy==='place'` the same as `'scene'`
    // for exactly this reason.
    function _syncPartLayer(project, sceneId, experience, part, fillMode, ordinal, isPrimaryPart, placeId) {
        const props = part.props || {};
        const kind = part.kind;
        const nameSuffix = ordinal > 1 ? (' — ' + _partKindLabel(kind) + ' ' + ordinal) : (kind === 'colour' ? ' — Colour' : '');
        const layerName = experience.name + nameSuffix;
        const hostPlaceId = fillMode === 'place' ? placeId : null;

        if (kind === 'colour') {
            // A Colour part that isn't the Scene's own background
            // (beyond the first, or Free-hosted) mirrors as an ordinary
            // fill Layer — unless it's fully Transparent, in which case
            // there is nothing to render and no Layer is kept at all.
            if (props.colorTransparent === false) {
                const rect = _universalContentFootprint(props, kind);
                let layer = _findMirroredLayer(project, sceneId, experience.id, part.id);
                if (!layer && isPrimaryPart) layer = _claimUntaggedPartLayer(project, sceneId, experience, part);
                if (layer) {
                    layer.partId = part.id;
                    layer.contentSlot = 'color';
                    Object.assign(layer, {
                        name: layerName, color: props.colorValue, opacity: props.colorOpacity,
                        position: { x: rect.x, y: rect.y }, size: { w: rect.w, h: rect.h },
                        hostPlaceId: hostPlaceId
                    });
                } else {
                    const created = addSceneLayer(project, sceneId, {
                        kind: 'fill', name: layerName, color: props.colorValue,
                        position: { x: rect.x, y: rect.y }, size: { w: rect.w, h: rect.h }, atBottom: true
                    });
                    created.opacity = props.colorOpacity;
                    created.sourceExperienceId = experience.id;
                    created.contentSlot = 'color';
                    created.partId = part.id;
                    created.hostPlaceId = hostPlaceId;
                }
            } else {
                _removeMirroredLayer(project, sceneId, experience.id, part.id);
            }
            return;
        }

        if (kind === 'text') {
            if (props.textContent && props.textContent.trim()) {
                let layer = _findMirroredLayer(project, sceneId, experience.id, part.id);
                if (!layer && isPrimaryPart) {
                    layer = _claimUntaggedPartLayer(project, sceneId, experience, part) || _claimLegacyMirrorLayer(project, sceneId, experience, 'text');
                    if (layer) {
                        props.textX = layer.position.x; props.textY = layer.position.y;
                        props.textW = layer.size.w; props.textH = layer.size.h;
                    }
                }
                if (layer) {
                    layer.partId = part.id;
                    layer.contentSlot = 'text';
                    Object.assign(layer, {
                        name: layerName, text: props.textContent, font: props.textFont, fontSize: props.textSize,
                        align: props.textAlign, color: props.textColor, opacity: props.textOpacity,
                        rotation: props.textRotation || 0, shapeFill: !!props.textShapeFill,
                        // Bug G Rework — curveStyle (None/Arc/Wave/Circle) drives
                        // which deformation the renderers apply; curve is the
                        // amount slider (used by Arc + Wave, ignored by Circle).
                        // A Layer with only curve set and no curveStyle is
                        // treated as 'arc' by the renderers for backward compat.
                        curveStyle: props.textCurveStyle || 'none',
                        curve: props.textCurve || 0,
                        position: { x: props.textX, y: props.textY }, size: { w: props.textW, h: props.textH },
                        hostedByScene: fillMode === 'scene', hostPlaceId: hostPlaceId
                    });
                } else {
                    const created = addSceneLayer(project, sceneId, {
                        kind: 'text', name: layerName, text: props.textContent, font: props.textFont, fontSize: props.textSize, align: props.textAlign,
                        position: { x: props.textX, y: props.textY }, size: { w: props.textW, h: props.textH }
                    });
                    created.color = props.textColor;
                    created.opacity = props.textOpacity;
                    created.rotation = props.textRotation || 0;
                    created.shapeFill = !!props.textShapeFill;
                    created.curveStyle = props.textCurveStyle || 'none';
                    created.curve = props.textCurve || 0;
                    created.sourceExperienceId = experience.id;
                    created.contentSlot = 'text';
                    created.partId = part.id;
                    created.hostedByScene = fillMode === 'scene';
                    created.hostPlaceId = hostPlaceId;
                }
            } else {
                _removeMirroredLayer(project, sceneId, experience.id, part.id);
            }
            return;
        }

        // Image and Graphics — both a Layer's `.image` field (the same
        // Runtime mechanism); Graphics may instead hold an author-drawn
        // Shape, mutually exclusive with an uploaded image by
        // construction (the Inspector clears one when the other is
        // picked).
        const isImage = kind === 'image';
        const src = isImage ? props.imageSrc : (kind === 'graphics' ? props.graphicSrc : null);
        const shapeKind = (kind === 'graphics' && !src) ? props.graphicShape : null;
        const xKey = isImage ? 'imageX' : 'graphicX', yKey = isImage ? 'imageY' : 'graphicY';
        const wKey = isImage ? 'imageW' : 'graphicW', hKey = isImage ? 'imageH' : 'graphicH';
        const opKey = isImage ? 'imageOpacity' : 'graphicOpacity';
        if (src || shapeKind) {
            let layer = _findMirroredLayer(project, sceneId, experience.id, part.id);
            if (!layer && isPrimaryPart) {
                layer = _claimUntaggedPartLayer(project, sceneId, experience, part) || _claimLegacyMirrorLayer(project, sceneId, experience, 'decoration');
                if (layer) {
                    props[xKey] = layer.position.x; props[yKey] = layer.position.y;
                    props[wKey] = layer.size.w; props[hKey] = layer.size.h;
                }
            }
            const position = { x: props[xKey], y: props[yKey] };
            const size = { w: props[wKey], h: props[hKey] };
            // Only the Image section has a Fit control (Graphics' own
            // Properties are Upload/Replace/Remove/Preview/Opacity
            // only, per the spec) — `layer.fit` stays undefined for a
            // Graphics Layer, which `engineRuntime.js`'s `_paintLayer`
            // already defaults to 'fit' (contain).
            const fit = isImage ? (props.imageFit || 'fit') : undefined;
            // Bug E fix: Graphics section's Rotation slider (worldBuilderApp.js
            // line ~9113) is ALWAYS shown for Graphics content — both uploaded
            // image AND Shape — writing to props.graphicRotation. Previously
            // this Engine Adapter only read graphicRotation when a Shape was
            // set (`shapeKind ? ... : 0`), silently hardcoding 0 for a plain
            // uploaded Graphics image so the Rotation slider persisted a value
            // that never reached the mirrored Scene Layer. Now read
            // graphicRotation for any graphic slot, image or Shape alike.
            const rotation = isImage ? (props.imageRotation || 0) : (props.graphicRotation || 0);
            // `shape: null` in the non-shape branch is deliberate — it
            // clears a stale shape when an author switches a Graphics
            // section from a Shape back to an uploaded image on an
            // already-mirrored Layer.
            const shapeFields = shapeKind ? {
                shape: shapeKind, shapeFillColor: props.graphicFillColor,
                shapeFillOpacity: props.graphicFillOpacity, shapeStrokeColor: props.graphicStrokeColor,
                shapeStrokeOpacity: props.graphicStrokeOpacity, shapeStrokeWidth: props.graphicStrokeWidth,
                customPath: props.graphicCustomPath
            } : { shape: null, customPath: null };
            if (layer) {
                layer.partId = part.id;
                layer.contentSlot = isImage ? 'image' : 'graphic';
                Object.assign(layer, { name: layerName, image: src || null, opacity: props[opKey], fit: fit, rotation: rotation, position: position, size: size, hostedByScene: fillMode === 'scene', hostPlaceId: hostPlaceId }, shapeFields);
            } else {
                // A real, pre-existing bug found while testing —
                // addSceneLayer's own Object.assign only ever copies a
                // fixed field set from `spec` (id/name/kind/color/glyph/
                // position/size/permissions/decorationSlot, plus
                // sourceExperienceId and text-kind fields when present)
                // — `image` was never one of them, so a brand-new Image/
                // Graphics Layer's own image was silently discarded and
                // the Layer created with no image at all; only a later
                // edit (which hits the `Object.assign(layer, {...})`
                // update branch above, a real mutation with no such
                // filter) ever actually set it. Explicit post-creation
                // assignment here, matching opacity/fit/
                // sourceExperienceId/contentSlot/partId's own existing
                // pattern on the very next lines, fixes it at the same
                // place those are already set rather than touching
                // addSceneLayer's generic field list.
                const created = addSceneLayer(project, sceneId, { kind: 'decoration', name: layerName, position: position, size: size });
                created.image = src || null;
                created.opacity = props[opKey];
                created.fit = fit;
                created.rotation = rotation;
                created.sourceExperienceId = experience.id;
                created.contentSlot = isImage ? 'image' : 'graphic';
                created.partId = part.id;
                created.hostedByScene = fillMode === 'scene';
                created.hostPlaceId = hostPlaceId;
                Object.assign(created, shapeFields);
            }
        } else {
            _removeMirroredLayer(project, sceneId, experience.id, part.id);
        }
    }

    function _clearMirror(project, experience, entry) {
        if (experience.type === 'frame' && entry.placeId) {
            const holder = findHolder(project, entry.sceneId, entry.placeId);
            if (holder && holder.frame === experience.id) updateHolder(project, entry.sceneId, entry.placeId, { frame: null });
        } else {
            // "Extend Experiences to Places" — a real, previously-latent
            // gap: this branch used to only run for Scene/Free hosting
            // (`!entry.placeId`), since Place-hosting only ever meant
            // `type==='frame'` before this feature, and that case is
            // already handled above. Now that a non-'frame' Experience
            // Hosted By Place ALSO mirrors ordinary Scene Layers (tagged
            // `hostPlaceId`), detaching one must clean those up too, or
            // they'd sit orphaned on the Scene forever — this is exactly
            // the `else` case (every host EXCEPT a Frame-hosted Place).
            //
            // Every current part's own mirrored Layer, found by partId
            // — the normal, common case once an Experience has been
            // synced at least once under the Multi-Asset Experience
            // Parts model.
            (experience.properties.parts || []).forEach(function (part) {
                _removeMirroredLayer(project, entry.sceneId, experience.id, part.id);
            });
            // Two older, narrower tiers a mirrored Layer might still be
            // sitting in if this Experience is detached before ever
            // being re-synced under a newer model: a truly ancient
            // (pre-Builder-V3.1) single layer with no contentSlot tag
            // at all, or a V3.1-era one tagged only by contentSlot with
            // no partId yet.
            _removeMirroredLayer(project, entry.sceneId, experience.id, undefined);
            const scene = findScene(project, entry.sceneId);
            if (scene) {
                (scene.layers || []).slice().forEach(function (l) {
                    if (l.sourceExperienceId === experience.id && l.contentSlot && !l.partId) {
                        deleteSceneLayer(project, entry.sceneId, l.id);
                    }
                });
            }
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
        _uniqueFrameName: _uniqueFrameName,
        deleteFrame: deleteFrame,
        setFrameField: setFrameField,
        setFrameFieldValue: setFrameFieldValue,
        moveFrame: moveFrame,
        reconcileFrameReferences: reconcileFrameReferences,
        collectionAssets: collectionAssets,
        findCollectionAsset: findCollectionAsset,
        findCollectionAssetByRef: findCollectionAssetByRef,
        setCollectionAsset: setCollectionAsset,
        registerCollectionAsset: registerCollectionAsset,
        retargetCollectionAssetRef: retargetCollectionAssetRef,
        renameCollectionAsset: renameCollectionAsset,
        setCollectionAssetAvailability: setCollectionAssetAvailability,
        collectionAssetUsageCount: collectionAssetUsageCount,
        deleteCollectionAsset: deleteCollectionAsset,
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
        updateExperiencePartProperty: updateExperiencePartProperty,
        addExperiencePart: addExperiencePart,
        removeExperiencePart: removeExperiencePart,
        // Multi-Asset Experience Parts (Phase 4) — the exact same kind
        // label _syncUniversalContent's own compiled Layer-name suffix
        // already uses, exported so the Inspector's card-title
        // disambiguation can never drift from what actually ends up in
        // the compiled Layer Pack's own `label` field.
        partKindLabel: _partKindLabel,
        deleteExperience: deleteExperience,
        graduateToPersonal: graduateToPersonal,
        graduateToPublic: graduateToPublic,
        attachExperience: attachExperience,
        detachExperience: detachExperience,
        usageOf: usageOf,
        findMirroredSceneLayer: _findMirroredLayer,
        // Builder V3.1 — Working View Experience Studio: the same rect
        // math the Engine Adapter already uses to size a Free-hosted
        // Colour fill (`_universalContentFootprint`), exposed read-only
        // so Working View can crop its isolated Experience view to just
        // this Experience's own populated content instead of the whole
        // Scene, without a second, independently-derived implementation.
        experienceContentFootprint: _universalContentFootprint,
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
