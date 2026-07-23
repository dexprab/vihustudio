// js/projectCompiler.js — Sprint B2.0. Feeds an in-memory, Builder-
// owned World Project (js/projectModel.js's file map) into the
// unmodified `validator.js` / `builder.js` engines, exactly the "future
// Build stage can feed it to the same unmodified validator.js/builder.js
// with no translation layer" docs/WORLD_PROJECT_CONTRACT.md already
// promised. Those two engines only ever talk to the global
// `projectLoader` singleton (js/services/projectLoader.js) — this
// module's entire job is populating that singleton from our in-memory
// data instead of a real folder picked via <input webkitdirectory>, so
// Validation/Build reuse the exact same rules a hand-authored Theme
// Project is checked against, not a second, parallel opinion of
// "valid."
const ProjectCompiler = (function () {
    'use strict';

    // Assets are stored as data URI strings (js/projectModel.js's
    // setAsset/setIdentityAsset); fetch() on a data: URI is a standard,
    // synchronous-cost, zero-network browser operation that turns it
    // back into a real Blob, which is what projectLoader's own
    // FileReader-based readFile()/readFileAsDataURL() require.
    async function _dataURLToBlob(dataURL) {
        const resp = await fetch(dataURL);
        return await resp.blob();
    }

    // Platform Hardening — Draft Asset Architecture, Phase B. A top-level
    // project.files entry (Identity thumbnail/hero, an Assets-screen
    // slot) may now hold a durable `vihu-asset:<surface>:<projectId>:
    // <assetId>` reference (js/assetStore.js) instead of an embedded
    // data: URI — resolve it to a real src (warm cache, IndexedDB, or a
    // signed Storage URL) and fetch that, exactly the same "fetch()
    // turns it back into a Blob" technique _dataURLToBlob already uses
    // for a data: URI, just with one resolution step first. A ref that
    // can't be resolved at all (offline + never cached, or AssetStore
    // itself unavailable) throws a clear, disclosed error rather than
    // silently falling through to the byte-encode-the-string-itself
    // fallback below, which would corrupt the asset.
    async function _toBlob(path, value) {
        if (path.endsWith('.json')) {
            return new Blob([JSON.stringify(value)], { type: 'application/json' });
        }
        if (path.endsWith('.md')) {
            return new Blob([String(value)], { type: 'text/plain' });
        }
        if (typeof value === 'string' && value.indexOf('vihu-asset:') === 0) {
            if (typeof window === 'undefined' || !window.AssetStore) {
                throw new Error('Asset ' + value + ' could not be resolved for Build (AssetStore unavailable).');
            }
            const src = await window.AssetStore.resolve(value);
            if (!src) {
                throw new Error('Asset ' + value + ' could not be resolved for Build.');
            }
            return await _dataURLToBlob(src);
        }
        if (typeof value === 'string' && value.indexOf('data:') === 0) {
            return await _dataURLToBlob(value);
        }
        return new Blob([String(value)]);
    }

    function _folderOf(path) {
        const parts = path.split('/');
        return parts.length > 1 ? parts[0] : null;
    }

    // Populates the global `projectLoader` singleton exactly the shape
    // its own `loadProjectFromFiles`/`buildStructure` would have
    // produced from a real folder pick — the only difference is the
    // source of truth is our in-memory project.files, not the File
    // System Access API.
    async function loadIntoProjectLoader(project) {
        const paths = Object.keys(project.files);
        const filesBlobMap = {};
        for (const path of paths) {
            filesBlobMap[path] = await _toBlob(path, project.files[path]);
        }

        const folders = {};
        paths.forEach(function (path) {
            const folder = _folderOf(path);
            if (folder) {
                if (!folders[folder]) folders[folder] = [];
                folders[folder].push(path);
            }
        });

        // A real, user-reported bug: `folders['scenes']` above is built
        // from raw `Object.keys(project.files)` insertion order — the
        // order Scenes were CREATED in, not the order "Reorder Scenes"
        // (drag-and-drop, backed by `project.sceneOrder`) actually shows
        // in the Scenes Library. `builder.js`'s `convergeScenes()` walks
        // this array directly and has no other way to know the authored
        // display order, so a Theme Author who reordered Scenes in the
        // Builder UI got a compiled Representation order that silently
        // reverted to creation order the moment it reached Creator.
        // `ProjectModel.scenes(project)` already correctly resolves
        // `sceneOrder` (used everywhere else in the Builder UI) — this
        // is the one adapter boundary that can still see the full,
        // live `project` object (unlike `builder.js`/`projectLoader`,
        // which only ever see `project.files`), so re-sorting here is
        // the correct, minimal fix rather than teaching the frozen
        // `builder.js` service about `ProjectModel` at all.
        if (folders.scenes && typeof ProjectModel !== 'undefined' && ProjectModel.scenes) {
            const orderedIds = ProjectModel.scenes(project).map(function (s) { return s.id; });
            folders.scenes.sort(function (a, b) {
                const idA = a.replace(/^scenes\//, '').replace(/\.json$/, '');
                const idB = b.replace(/^scenes\//, '').replace(/\.json$/, '');
                const ia = orderedIds.indexOf(idA);
                const ib = orderedIds.indexOf(idB);
                return (ia === -1 ? orderedIds.length : ia) - (ib === -1 ? orderedIds.length : ib);
            });
        }

        const hasFolder = function (name) { return paths.some(function (p) { return p.indexOf(name + '/') === 0; }); };
        const hasFile = function (name) { return paths.indexOf(name) !== -1; };

        projectLoader.currentProject = {
            name: project.name,
            version: ProjectModel.manifest(project).version,
            author: ProjectModel.manifest(project).author,
            description: project.description,
            files: filesBlobMap,
            manifest: ProjectModel.manifest(project),
            metadata: ProjectModel.metadata(project),
            theme: ProjectModel.theme(project)
        };

        projectLoader.projectStructure = {
            hasManifest: hasFile('manifest.json'),
            hasMetadata: hasFile('metadata.json'),
            hasTheme: hasFile('theme.json'),
            hasLayouts: hasFolder('layouts'),
            hasFrames: hasFolder('frames'),
            hasLayerPacks: hasFolder('layer-packs'),
            hasAssets: hasFolder('assets'),
            hasPreview: hasFile('preview.png'),
            hasThumbnail: hasFile('thumbnail.png'),
            hasReadme: hasFile('README.md'),
            files: filesBlobMap,
            folders: folders
        };
    }

    async function runValidation(project) {
        await loadIntoProjectLoader(project);
        return await validator.validate();
    }

    async function runBuild(project) {
        await loadIntoProjectLoader(project);
        return await builder.build();
    }

    return {
        loadIntoProjectLoader: loadIntoProjectLoader,
        runValidation: runValidation,
        runBuild: runBuild
    };
})();
try { window.ProjectCompiler = ProjectCompiler; } catch (e) {}
