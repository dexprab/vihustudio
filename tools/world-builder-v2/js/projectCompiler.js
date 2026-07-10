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

    async function _toBlob(path, value) {
        if (path.endsWith('.json')) {
            return new Blob([JSON.stringify(value)], { type: 'application/json' });
        }
        if (path.endsWith('.md')) {
            return new Blob([String(value)], { type: 'text/plain' });
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
