// Shared Playwright harness for Creator UI visual verification.
// Injects a minimal but representative Story theme (Storybook Classic
// shape) purely for local screenshot testing -- Studio ships with zero
// built-in themes today (Repository-only), so without this Screen 2 /
// Workspace would be empty in this sandboxed, network-blocked
// environment. This is test scaffolding only, never touches the repo.
const path = require('path');
const http = require('http');
const fs = require('fs');

function loadPlaywright() {
    try { return require('playwright'); }
    catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
}

const REPO_ROOT = '/home/user/vihustudio';
const CHROME_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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

async function launch(viewport) {
    const { chromium } = loadPlaywright();
    const server = await startServer(REPO_ROOT);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME_PATH });
    const page = await browser.newPage({ viewport: viewport || { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/404|ERR_TUNNEL|supabase/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    return { browser, page, server, errors };
}

// Registers two representative demo themes (a Story theme with no
// Representations, an Artwork theme with 3 Representations + real
// gradient "photos" as data-URI thumbnails) so Screen 2 / Workspace
// have real content to screenshot against.
async function seedDemoThemes(page) {
    await page.evaluate(() => {
        function dataSwatch(w, h, hex1, hex2) {
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, hex1); g.addColorStop(1, hex2);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            return c.toDataURL('image/png');
        }
        const storyTheme = {
            id: 'storybook-classic', name: 'Storybook Classic',
            description: 'Warm, rounded, friendly -- traditional children’s book.',
            supportedCreationTypes: ['story'],
            frame: { color: '#1D3457' }, panel: { color: '#FFFFFF' },
            storyText: { font: 'Georgia, serif', size: 56, color: '#FFFFFF' },
            footerText: { font: 'Georgia, serif', size: 24, color: '#FFFFFF' },
            watermark: { font: 'Georgia, serif', size: 24, color: '#FFFFFF' }
        };
        const galleryTheme = {
            id: 'demo-museum-gallery', name: 'Museum Gallery',
            description: 'Explore, learn and tell amazing stories.',
            supportedCreationTypes: ['artwork'],
            themeIcon: '🏛️',
            previewImage: dataSwatch(600, 750, '#f4ecd8', '#dcae5a'),
            frame: { color: '#1D3457' }, panel: { color: '#FFFFFF' },
            representations: [
                { id: 'showcase', name: 'Showcase', description: 'Big and bold, the classic gallery look.', layout: 'landscape', thumbnail: dataSwatch(600, 450, '#efe3c8', '#c99a4d') },
                { id: 'portrait', name: 'Portrait', description: 'Tall and elegant, like a real frame.', layout: 'portrait', thumbnail: dataSwatch(450, 600, '#e7d9c0', '#b98644') },
                { id: 'quote', name: 'Quote', description: 'Words take center stage.', layout: 'quote', thumbnail: dataSwatch(450, 600, '#f7ede0', '#e2b978') }
            ]
        };
        window.ThemeRegistry.registerOfficial([storyTheme], 'story');
        window.ThemeRegistry.registerOfficial([galleryTheme], 'artwork');
    });
}

module.exports = { launch, seedDemoThemes };
