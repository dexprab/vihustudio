// js/projectModel.js — Sprint B1.1. Small accessor/mutator layer over a
// World Project's file map (js/projectStore.js's `project.files`, shaped
// per docs/WORLD_PROJECT_CONTRACT.md). The Builder Workspace never pokes
// at `project.files['...json']` directly — every read and every edit
// goes through here, so the file-map shape stays a private detail the
// Workspace UI doesn't need to know twice.
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

    function layouts(project) {
        return _filesWithPrefix(project, 'layouts/').map(function (e) { return e.data; });
    }

    function frames(project) {
        return _filesWithPrefix(project, 'frames/').map(function (e) { return e.data; });
    }

    function findLayout(project, id) {
        return layouts(project).find(function (l) { return l.id === id; }) || null;
    }

    function findFrame(project, id) {
        return frames(project).find(function (f) { return f.id === id; }) || null;
    }

    function setLayout(project, layout) {
        project.files['layouts/' + layout.id + '.json'] = layout;
    }

    function findRepresentation(project, id) {
        return representations(project).find(function (r) { return r.id === id; }) || null;
    }

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
    }

    function creationTypes(project) {
        return theme(project).supportedCreationTypes || [];
    }

    function setRepresentationField(project, repId, field, value) {
        const rep = findRepresentation(project, repId);
        if (rep) rep[field] = value;
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

    function addLayout(project) {
        const existingIds = layouts(project).map(function (l) { return l.id; });
        const id = _uniqueId(existingIds, 'new-layout');
        const layout = {
            id: id,
            aspect: 'portrait',
            captionPosition: 'below',
            padding: 24,
            spacing: 16,
            alignment: 'center'
        };
        setLayout(project, layout);
        return layout;
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
        setIdentity: setIdentity,
        creationTypes: creationTypes
    };
})();
try { window.ProjectModel = ProjectModel; } catch (e) {}
