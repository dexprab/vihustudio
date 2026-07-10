// tools/platform-status/js/platformStatus.js — Platform Hardening,
// Platform Status & Repository Reset.
//
// A read-only diagnostic page plus one destructive action (Reset). Reuses
// the exact same Repository abstraction (js/themeRepositoryClient.js)
// Builder's Publish screen and Studio's boot sequence already depend on —
// this page adds no new repository concept, it only asks the existing
// interface questions it already knows how to answer (list/getStats) or
// two new, narrowly-scoped ones (getStats/reset, added to
// ThemeRepositoryClient itself so the UI never touches Supabase directly).
//
// Deliberately does NOT call ThemeRegistry.refreshFromRepository()/
// .list()/.getCatalog() — those would pull in this browser's own
// hardcoded built-in Official Story/Artwork themes and any locally-
// imported Themes sitting in this same origin's localStorage, silently
// inflating this page's counts with data unrelated to the Supabase
// repositories it's reporting on. Only the pure, side-effect-free
// ThemeRegistry.validatePackage(pkg) is reused, to confirm a discovered
// repository Theme would actually register cleanly — the same check
// refreshFromRepository() itself runs internally.
(function () {
    'use strict';

    const PROJECT_STORE_KEY = 'vihu-world-builder-projects';
    const BUILD_INFO_URL = '../world-builder/build-info.json';

    const els = {
        health: document.getElementById('ps-health-list'),
        builder: document.getElementById('ps-builder-fields'),
        repoOfficial: document.getElementById('ps-repo-official'),
        repoPersonal: document.getElementById('ps-repo-personal'),
        registry: document.getElementById('ps-registry-fields'),
        studio: document.getElementById('ps-studio-fields'),
        summary: document.getElementById('ps-summary-text'),
        resetOpenBtn: document.getElementById('ps-reset-open-btn'),
        resetResult: document.getElementById('ps-reset-result'),
        modal: document.getElementById('ps-reset-modal'),
        modalCancel: document.getElementById('ps-modal-cancel'),
        modalConfirm: document.getElementById('ps-modal-confirm'),
        refreshBtn: document.getElementById('ps-refresh-btn'),
        footer: document.getElementById('ps-footer')
    };

    function fieldList(container, rows) {
        container.innerHTML = '';
        rows.forEach(function (row) {
            const dt = document.createElement('dt');
            dt.textContent = row[0];
            const dd = document.createElement('dd');
            dd.textContent = row[1];
            container.appendChild(dt);
            container.appendChild(dd);
        });
    }

    function healthItem(label, state) {
        // state: 'green' | 'yellow' | 'red'
        const dot = state === 'green' ? '🟢' : state === 'yellow' ? '🟡' : '🔴';
        const li = document.createElement('li');
        li.innerHTML = '<span class="ps-dot">' + dot + '</span> ' + label;
        return li;
    }

    // ---------- Builder section (read-only; never mutates Project data) ----------

    function fetchBuildInfo() {
        return fetch(BUILD_INFO_URL, { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('no build-info.json'); return r.json(); })
            .catch(function () { return null; });
    }

    function mostRecentProject() {
        try {
            const raw = localStorage.getItem(PROJECT_STORE_KEY);
            if (!raw) return null;
            const list = JSON.parse(raw);
            if (!Array.isArray(list) || !list.length) return null;
            return list.slice().sort(function (a, b) {
                return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            })[0];
        } catch (e) { return null; }
    }

    // ---------- Repository / Theme Registry sections ----------

    function safeStats(repositoryId) {
        return window.ThemeRepositoryClient.getStats(repositoryId)
            .then(function (stats) { return { ok: true, stats: stats }; })
            .catch(function (e) { return { ok: false, error: (e && e.message) || String(e) }; });
    }

    // Mirrors ThemeRegistry.refreshFromRepository()'s own internal logic
    // (list -> load -> validatePackage per entry) without ever touching
    // the live registry — see the file header for why.
    function discoveredCountFor(repositoryId) {
        return window.ThemeRepositoryClient.list(repositoryId).then(function (entries) {
            return Promise.all((entries || []).map(function (entry) {
                return window.ThemeRepositoryClient.load(repositoryId, entry.theme_id).then(function (pkg) {
                    const problems = window.ThemeRegistry.validatePackage(pkg);
                    return problems.length === 0;
                }).catch(function () { return false; });
            }));
        }).then(function (flags) {
            return flags.filter(Boolean).length;
        });
    }

    function formatCount(n, noun) {
        return n + ' ' + noun + (n === 1 ? '' : 's');
    }

    // ---------- Full status pass ----------

    function runStatusCheck() {
        els.summary.textContent = 'Checking…';
        fieldList(els.builder, [['Version', '…'], ['Current Theme', '…'], ['Build Status', '…'], ['Last Build', '…']]);
        fieldList(els.repoOfficial, [['Themes', '…'], ['Assets', '…']]);
        fieldList(els.repoPersonal, [['Themes', '…'], ['Assets', '…']]);
        fieldList(els.registry, [['Discovered Themes', '…'], ['Official', '…'], ['Personal', '…']]);
        fieldList(els.studio, [['Theme Registry', '…'], ['Theme Discovery', '…']]);
        els.health.innerHTML = '';

        const health = {};

        const builderP = fetchBuildInfo().then(function (info) {
            const project = mostRecentProject();
            const version = info ? (info.version || 'unknown') : 'unavailable';
            health.builder = info ? 'green' : 'yellow';

            const rows = [['Version', version]];
            if (project) {
                rows.push(['Current Theme', project.name || project.id || 'Untitled World']);
                rows.push(['Build Status', project.lastBuild ? 'Built' : 'Not built yet']);
                rows.push(['Last Build', project.lastBuild ? new Date(project.lastBuild.builtAt).toLocaleString() : '—']);
                health.buildPipeline = project.lastBuild ? 'green' : 'yellow';
            } else {
                rows.push(['Current Theme', 'No World Project open in this browser']);
                rows.push(['Build Status', '—']);
                rows.push(['Last Build', '—']);
                health.buildPipeline = 'yellow';
            }
            fieldList(els.builder, rows);
        });

        const configuredP = window.ThemeRepositoryClient.isConfigured();

        const repoP = configuredP.then(function (configured) {
            health.repoConnection = configured ? 'green' : 'red';
            if (!configured) {
                fieldList(els.repoOfficial, [['Themes', 'not configured'], ['Assets', 'not configured']]);
                fieldList(els.repoPersonal, [['Themes', 'not configured'], ['Assets', 'not configured']]);
                health.repoOfficial = 'red';
                health.repoPersonal = 'red';
                return { official: null, personal: null };
            }
            return Promise.all([safeStats('official'), safeStats('personal')]).then(function (results) {
                const off = results[0], per = results[1];
                if (off.ok) {
                    fieldList(els.repoOfficial, [['Themes', String(off.stats.themeCount)], ['Assets', String(off.stats.assetCount)]]);
                    health.repoOfficial = 'green';
                } else {
                    fieldList(els.repoOfficial, [['Themes', 'error'], ['Assets', off.error]]);
                    health.repoOfficial = 'red';
                }
                if (per.ok) {
                    fieldList(els.repoPersonal, [['Themes', String(per.stats.themeCount)], ['Assets', String(per.stats.assetCount)]]);
                    health.repoPersonal = 'green';
                } else {
                    fieldList(els.repoPersonal, [['Themes', 'error'], ['Assets', per.error]]);
                    health.repoPersonal = 'red';
                }
                return { official: off.ok ? off.stats : null, personal: per.ok ? per.stats : null };
            });
        });

        const registryP = configuredP.then(function (configured) {
            if (!configured) {
                fieldList(els.registry, [['Discovered Themes', '0'], ['Official', '0'], ['Personal', '0']]);
                fieldList(els.studio, [['Theme Registry', typeof window.ThemeRegistry !== 'undefined' ? '✓ Loaded' : '✗ Missing'], ['Theme Discovery', 'Not configured']]);
                health.registry = 'yellow';
                health.studioDiscovery = 'red';
                return null;
            }
            return Promise.all([discoveredCountFor('official'), discoveredCountFor('personal')])
                .then(function (counts) {
                    const off = counts[0], per = counts[1];
                    fieldList(els.registry, [['Discovered Themes', String(off + per)], ['Official', String(off)], ['Personal', String(per)]]);
                    fieldList(els.studio, [['Theme Registry', 'connected'], ['Theme Discovery', 'working']]);
                    health.registry = 'green';
                    health.studioDiscovery = 'green';
                    return { official: off, personal: per };
                })
                .catch(function (e) {
                    fieldList(els.registry, [['Discovered Themes', 'error'], ['Official', '—'], ['Personal', '—']]);
                    fieldList(els.studio, [['Theme Registry', 'connected'], ['Theme Discovery', '✗ ' + ((e && e.message) || 'failed')]]);
                    health.registry = 'red';
                    health.studioDiscovery = 'red';
                    return null;
                });
        });

        return Promise.all([builderP, repoP, registryP]).then(function (results) {
            const repoStats = results[1];
            const registryStats = results[2];

            els.health.innerHTML = '';
            [
                ['Builder', health.builder],
                ['Build Pipeline', health.buildPipeline],
                ['Repository Connection', health.repoConnection],
                ['Official Repository', health.repoOfficial],
                ['Personal Repository', health.repoPersonal],
                ['Theme Registry', health.registry],
                ['Studio Discovery', health.studioDiscovery]
            ].forEach(function (pair) { els.health.appendChild(healthItem(pair[0], pair[1])); });

            const summaryLines = [
                'Platform Status', '',
                'Builder',
                (health.builder === 'green' ? '✓' : '⚠') + ' Ready', '',
                'Repository',
                (health.repoConnection === 'green' ? '✓ Connected' : '✗ Not connected'), ''
            ];
            if (repoStats && repoStats.official) {
                summaryLines.push('Official Repository');
                summaryLines.push(formatCount(repoStats.official.themeCount, 'Theme'));
                summaryLines.push(formatCount(repoStats.official.assetCount, 'Asset'));
                summaryLines.push('');
            }
            if (repoStats && repoStats.personal) {
                summaryLines.push('Personal Repository');
                summaryLines.push(formatCount(repoStats.personal.themeCount, 'Theme'));
                summaryLines.push(formatCount(repoStats.personal.assetCount, 'Asset'));
                summaryLines.push('');
            }
            summaryLines.push('Theme Registry');
            summaryLines.push(registryStats ? formatCount(registryStats.official + registryStats.personal, 'Theme') + ' Available' : 'unavailable');
            summaryLines.push('');
            summaryLines.push('Studio');
            summaryLines.push(health.studioDiscovery === 'green' ? '✓ Connected' : '✗ Not connected');
            els.summary.textContent = summaryLines.join('\n');
        });
    }

    // ---------- Repository Reset ----------

    function openResetModal() { els.modal.classList.remove('ps-hidden'); }
    function closeResetModal() { els.modal.classList.add('ps-hidden'); }

    function showResetResult(cls, text) {
        els.resetResult.className = 'ps-reset-result ' + cls;
        els.resetResult.textContent = text;
    }

    function doReset() {
        closeResetModal();
        els.resetOpenBtn.disabled = true;
        showResetResult('', 'Resetting…');
        Promise.all([
            window.ThemeRepositoryClient.reset('official'),
            window.ThemeRepositoryClient.reset('personal')
        ]).then(function (results) {
            const totalThemes = results.reduce(function (a, r) { return a + (r && r.deletedThemes || 0); }, 0);
            showResetResult('ps-ok', '✓ Reset complete — ' + totalThemes + ' published Theme(s) removed from both repositories. Builder Projects were not affected.');
            return runStatusCheck();
        }).catch(function (e) {
            showResetResult('ps-fail', '⚠️ Reset failed: ' + ((e && e.message) || 'unknown error'));
        }).then(function () {
            els.resetOpenBtn.disabled = false;
        });
    }

    els.resetOpenBtn.addEventListener('click', openResetModal);
    els.modalCancel.addEventListener('click', closeResetModal);
    els.modalConfirm.addEventListener('click', doReset);
    els.modal.addEventListener('click', function (e) { if (e.target === els.modal) closeResetModal(); });
    els.refreshBtn.addEventListener('click', runStatusCheck);

    fetch(BUILD_INFO_URL, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (info) {
            els.footer.textContent = 'Platform Status' + (info && info.build ? ' | Build ' + info.build : '') + ' | Development';
        })
        .catch(function () {});

    runStatusCheck();
})();
