/* A tiny static server for the suite. Serves the REPOSITORY ROOT (so the
 * page at /tools/bring-it-alive/ and the real photographs at
 * /tools/imagebed/ are both reachable) on the port given as argv[2],
 * default 8765. No dependencies — the sandbox has no npm install.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = Number(process.argv[2] || 8765);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.JPG': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('not found: ' + url);
  }
}).listen(PORT, () => console.log('serving ' + ROOT + ' on :' + PORT));
