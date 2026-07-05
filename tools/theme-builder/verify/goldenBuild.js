#!/usr/bin/env node
// Golden Build Verification (TB-4.6 Task 4)
//
// Drives the REAL Theme Builder tool and the REAL VihuStudio runtime in a
// headless browser — no reimplementation, no mocked import path. Proves:
//
//   Theme Project -> Validate -> Compile -> Import -> Register -> Render
//
// completes for a valid fixture with no manual intervention, and that an
// invalid fixture is correctly rejected at validation. "Render" here means
// the imported theme resolves through ThemeEngine/ThemeRegistry into a
// full runtime theme object and can be applied as the active Artwork
// Theme — not a pixel-level canvas comparison (out of scope for this
// sprint; see docs/THEME_PROJECT_SPEC.md's Reserved Future Sections for
// where a screenshot-diff harness would eventually live).
//
// Usage: node tools/theme-builder/verify/goldenBuild.js

const fs = require('fs');
const path = require('path');
const http = require('http');

function loadPlaywright() {
    try { return require('playwright'); }
    catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const GOLDEN_FIXTURE = path.join(__dirname, 'fixtures', 'golden-theme');
const INVALID_FIXTURE = path.join(__dirname, 'fixtures', 'invalid-theme');
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startServer(root) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let reqPath = decodeURIComponent(req.url.split('?')[0]);
            if (reqPath === '/') reqPath = '/index.html';
            const filePath = path.join(root, reqPath);
            if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found: ' + reqPath); return; }
                const ext = path.extname(filePath);
                res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

let failures = 0;
function assert(condition, message) {
    if (condition) { console.log(`  \x1b[32m✓\x1b[0m ${message}`); }
    else { console.log(`  \x1b[31m✗\x1b[0m ${message}`); failures++; }
}

async function loadAndBuild(page, fixtureDir) {
    await page.goto('about:blank');
    await page.goto(`${page.__baseURL}/tools/theme-builder/index.html`);
    await page.waitForSelector('#actionLoad');

    const input = await page.$('#fileInput');
    await input.setInputFiles(fixtureDir);
    await page.waitForSelector('.dashboard-grid', { timeout: 5000 });

    await page.click('#actionValidate');
    await page.waitForSelector('.validation-report', { timeout: 5000 });
    const validationStatus = await page.$eval('#footerValidation', el => el.textContent.trim());
    const errors = await page.$$eval('.report-section.errors li', els => els.map(e => e.textContent));
    const warnings = await page.$$eval('.report-section.warnings li', els => els.map(e => e.textContent));

    let downloadPromise = null;
    let built = null;
    if (validationStatus === 'VALID') {
        downloadPromise = page.waitForEvent('download');
        await page.click('#actionBuild');
        const download = await downloadPromise;
        const tmpPath = await download.path();
        const text = fs.readFileSync(tmpPath, 'utf8');
        built = JSON.parse(text);
    }

    return { validationStatus, errors, warnings, built };
}

async function main() {
    const { chromium } = loadPlaywright();
    const server = await startServer(REPO_ROOT);
    const port = server.address().port;
    const baseURL = `http://127.0.0.1:${port}`;

    const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
    const context = await browser.newContext();

    try {
        // ---- 1. Invalid fixture: must fail validation, never build ----
        console.log('\n[1] Invalid Theme Project — must fail validation');
        const page1 = await context.newPage();
        page1.__baseURL = baseURL;
        const invalidResult = await loadAndBuild(page1, INVALID_FIXTURE);
        assert(invalidResult.validationStatus === 'INVALID', `validation status is INVALID (got "${invalidResult.validationStatus}")`);
        assert(invalidResult.built === null, 'build was not offered (Build stays disabled after a failed validation)');
        assert(
            invalidResult.errors.some(e => /missing required field: builderVersion/i.test(e)),
            'reports missing manifest.builderVersion'
        );
        assert(
            invalidResult.errors.some(e => /Duplicate layer id "dup-layer"/i.test(e)),
            'reports the cross-file duplicate layer id'
        );
        assert(
            invalidResult.errors.some(e => /references unknown frame "nonexistent-frame"/i.test(e)),
            'reports the broken supportedFrames reference'
        );
        assert(
            invalidResult.errors.some(e => /invalid target "not-a-real-target"/i.test(e)),
            'reports the invalid Layer target'
        );
        assert(
            invalidResult.errors.some(e => /Duplicate representation id "dup-rep"/i.test(e)),
            'reports the cross-entry duplicate representation id (TB-4.7)'
        );
        assert(
            invalidResult.errors.some(e => /Representation "dup-rep" references unknown layout "nonexistent-layout"/i.test(e)),
            'reports the broken Representation.layout reference (TB-4.7)'
        );
        assert(
            invalidResult.errors.some(e => /Representation "dup-rep" references unknown frame "nonexistent-frame" in defaultFrame/i.test(e)),
            'reports the broken Representation.defaultFrame reference (TB-4.7)'
        );
        await page1.close();

        // ---- 2. Golden fixture: Validate -> Compile ----
        console.log('\n[2] Golden Theme Project — Validate -> Compile');
        const page2 = await context.newPage();
        page2.__baseURL = baseURL;
        const goldenResult = await loadAndBuild(page2, GOLDEN_FIXTURE);
        assert(goldenResult.validationStatus === 'VALID', `validation status is VALID (got "${goldenResult.validationStatus}", errors: ${goldenResult.errors.join('; ')})`);
        assert(!!goldenResult.built, 'Build produced a .vtheme package');
        await page2.close();

        const pkg = goldenResult.built;
        assert(!!pkg && !!pkg.manifest && !!pkg.theme && !!pkg.assets, 'compiled package has exactly {manifest, theme, assets}');
        assert(pkg.manifest.id === 'golden-test-theme', 'compiled manifest.id is correct');
        assert(pkg.manifest.minStudioVersion === '9.5.0', 'compiled manifest.minStudioVersion is present (canonical field name)');
        assert(typeof pkg.manifest.thumbnail === 'string' && pkg.manifest.thumbnail.startsWith('data:image/'), 'manifest.thumbnail is a real embedded data URI, not a placeholder');
        assert(typeof pkg.manifest.previewImage === 'string' && pkg.manifest.previewImage.startsWith('data:image/'), 'manifest.previewImage is a real embedded data URI');
        assert(Array.isArray(pkg.theme.layouts) && pkg.theme.layouts.length === 1 && pkg.theme.layouts[0].id === 'portrait', 'theme.layouts is a flattened array (not {file,data} pairs)');
        assert(Array.isArray(pkg.theme.frameVariations) && pkg.theme.frameVariations[0].id === 'classic-white', 'theme.frameVariations is a flattened array');
        assert(Array.isArray(pkg.theme.layerPack) && pkg.theme.layerPack.length === 2, 'theme.layerPack is a flattened array');
        assert(!!pkg.assets['textures/linen.png'] && pkg.assets['textures/linen.png'].startsWith('data:image/'), 'assets map resolves the referenced texture to a real data URI');
        assert(
            Array.isArray(pkg.theme.representations) && pkg.theme.representations.length === 1
                && pkg.theme.representations[0].id === 'portrait-view'
                && pkg.theme.representations[0].layout === 'portrait'
                && pkg.theme.representations[0].defaultFrame === 'classic-white',
            'theme.representations is a flattened array (TB-4.7)'
        );

        // ---- 3. Import -> Register -> Render, against the REAL app ----
        console.log('\n[3] Import compiled package into the real VihuStudio runtime');
        const page3 = await context.newPage();
        const consoleErrors = [];
        page3.on('pageerror', e => consoleErrors.push(String(e)));
        await page3.goto(`${baseURL}/index.html`);
        await page3.waitForFunction(() => typeof window.ThemeRegistry !== 'undefined' && typeof window.ThemeEngine !== 'undefined');

        const importResult = await page3.evaluate(async (pkgJson) => {
            const file = new File([JSON.stringify(pkgJson)], 'golden-test-theme.vtheme', { type: 'application/json' });
            const buffer = await file.arrayBuffer();
            // Mirrors ThemeEngine.importThemeFile's own decode branch for a
            // non-zip file, then the real ThemeRegistry.importPackage().
            let parsed;
            try { parsed = JSON.parse(new TextDecoder('utf-8').decode(buffer)); }
            catch (e) { return { ok: false, error: 'not valid JSON: ' + e.message }; }
            const result = window.ThemeRegistry.importPackage(parsed, { onDuplicate: 'replace' });
            if (!result.ok) return { ok: false, problems: result.problems, duplicate: result.duplicate };

            const registered = window.ThemeRegistry.hasTheme('golden-test-theme');
            const record = window.ThemeRegistry.getRecord('golden-test-theme');
            const resolved = window.ThemeEngine.getTheme('golden-test-theme');
            const applied = window.ThemeEngine.applyArtworkTheme('golden-test-theme', { silent: true });
            const activeId = window.ThemeEngine.getActiveArtworkThemeId();

            return {
                ok: true,
                registered,
                source: record && record.source,
                type: record && record.manifest && record.manifest.type,
                layoutsCount: resolved && Array.isArray(resolved.layouts) ? resolved.layouts.length : -1,
                frameVariationsCount: resolved && Array.isArray(resolved.frameVariations) ? resolved.frameVariations.length : -1,
                layerPackCount: resolved && Array.isArray(resolved.layerPack) ? resolved.layerPack.length : -1,
                representationsCount: resolved && Array.isArray(resolved.representations) ? resolved.representations.length : -1,
                representationName: resolved && Array.isArray(resolved.representations) && resolved.representations[0] && resolved.representations[0].name,
                appliedId: applied && applied.id,
                activeId
            };
        }, pkg);

        assert(importResult.ok, `ThemeRegistry.importPackage() succeeded (${JSON.stringify(importResult.problems || importResult.error || '')})`);
        if (importResult.ok) {
            assert(importResult.registered, 'ThemeRegistry.hasTheme("golden-test-theme") is true — Register step complete');
            assert(importResult.source === 'imported', 'theme record source is "imported"');
            assert(importResult.type === 'artwork', 'theme type normalized correctly');
            assert(importResult.layoutsCount === 1, 'ThemeEngine.getTheme() resolves theme.layouts (Render-ready shape)');
            assert(importResult.frameVariationsCount === 1, 'ThemeEngine.getTheme() resolves theme.frameVariations');
            assert(importResult.layerPackCount === 2, 'ThemeEngine.getTheme() resolves theme.layerPack');
            assert(importResult.representationsCount === 1 && importResult.representationName === 'Portrait View', 'ThemeEngine.getTheme() resolves theme.representations (TB-4.7 — Studio would read this, never a hardcoded name)');
            assert(importResult.appliedId === 'golden-test-theme' && importResult.activeId === 'golden-test-theme', 'ThemeEngine.applyArtworkTheme() activates the imported theme — Render step complete');
        }
        assert(consoleErrors.length === 0, `no uncaught page errors during import (${consoleErrors.join('; ')})`);
        await page3.close();
    } finally {
        await browser.close();
        server.close();
    }

    console.log(`\n${failures === 0 ? '\x1b[32mGOLDEN BUILD: PASS' : '\x1b[31mGOLDEN BUILD: FAIL (' + failures + ' assertion(s))'}\x1b[0m\n`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
