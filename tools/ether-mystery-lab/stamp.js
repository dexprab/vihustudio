#!/usr/bin/env node
/* tools/ether-mystery-lab/stamp.js — the Lab's scripts carry a stamp of
 * their own contents, so a browser can never serve a stale one.
 *
 * WHY. The product owner pressed the new Join tool and nothing joined:
 * shape.html had arrived fresh (its help text was the new wording) and
 * labShape.js had not — a versionless script the browser was still
 * holding from the visit before. The Studio pins every script with
 * `?v=<build>` for exactly this; the Lab pinned nothing. The recurring
 * lesson of this repository, one more time: THE THING SERVED IS THE
 * THING UNDER TEST, and a script tag with no stamp is a promise that
 * the browser will fetch what is on disk, which it does not make.
 *
 * WHAT. Every `<script src>` on every Lab page is rewritten to carry
 * `?lab=<stamp>`, where the stamp is a hash of the CONTENTS of every
 * file those pages load — the Lab's own modules and the production
 * files it reuses alike. Change any of them and the stamp changes, so
 * the browser fetches again; change nothing and it is byte-stable. The
 * build stamp (`?v=0769` on the product pages) is untouched: it names
 * what shipped to a child, and the Lab ships nothing to a child.
 *
 * GENERATED, AND THE SUITE ASKS THE GENERATOR. A hand-bumped number is
 * a promise nobody can keep (Decision 30); the suite runs this file
 * with --check and fails on drift, so a Lab change that forgot to
 * restamp cannot pass.
 *
 *   node tools/ether-mystery-lab/stamp.js          rewrite, and report
 *   node tools/ether-mystery-lab/stamp.js --check  report only, exit 1 on drift
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LAB = path.resolve(__dirname);
const PAGES = ['index.html', 'gallery.html', 'shape.html', 'preview.html'];
const TAG = /<script src="([^"?]+)(?:\?lab=[0-9a-f]+)?"><\/script>/g;

function referenced() {
  const files = new Set();
  PAGES.forEach((page) => {
    const html = fs.readFileSync(path.join(LAB, page), 'utf8');
    for (const m of html.matchAll(TAG)) files.add(path.resolve(LAB, m[1]));
  });
  return [...files].sort();
}

function stamp() {
  const h = crypto.createHash('sha1');
  referenced().forEach((f) => { h.update(path.relative(LAB, f)); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); });
  return h.digest('hex').slice(0, 10);
}

function rewrite(html, s) {
  return html.replace(TAG, (_, src) => '<script src="' + src + '?lab=' + s + '"></script>');
}

function main(check) {
  const s = stamp();
  let drift = 0;
  PAGES.forEach((page) => {
    const file = path.join(LAB, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = rewrite(html, s);
    if (next === html) { console.log('  ok   ' + page + ' · lab=' + s); return; }
    drift++;
    if (check) { console.log('  DRIFT ' + page + ' · expected lab=' + s); return; }
    fs.writeFileSync(file, next);
    console.log('  wrote ' + page + ' · lab=' + s);
  });
  if (check && drift) { console.log('run: node tools/ether-mystery-lab/stamp.js'); process.exit(1); }
}

if (require.main === module) main(process.argv.includes('--check'));
module.exports = { stamp, referenced, rewrite, PAGES };
