// Dev tool: temporarily break this sprint's five fixes (node revert-proof.js break)
// and restore them (node revert-proof.js restore), for the revert proofs.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const EDITS = [
  // NOTE: a broken form must NEVER be '' — s.replace('', line) inserts
  // at position 0 of the file, which put a top-level `return` at the
  // head of traveller.js on restore (legal to `node --check`'s
  // CommonJS reading, a SyntaxError in the browser). A marker comment
  // keeps break/restore symmetric.
  {
    file: 'vihuplanet/runtime/core/traveller.js',
    fixed: '      if (drag.moved <= TOUCH_STARTS_AT) return;  // still a tap, camera holds',
    broken: '      /* revert-proof: touch slop removed */'
  },
  {
    file: 'vihuplanet/runtime/core/traveller.js',
    fixed: `    function onTouchEnd() {
      if (drag && drag.moved > TOUCH_STARTS_AT) {
        // A swipe is a swipe even where the browser forgets to
        // suppress its trailing click — same bound as the mouse path.
        swallowClickUntil = Date.now() + 300;
      }
      drag = null;
    }`,
    broken: '    function onTouchEnd() { drag = null; }'
  },
  {
    file: 'js/etherRipple.js',
    fixed: '  function reachFor(ether) {\n    var short',
    broken: '  function reachFor(ether) {\n    return TUNING.reach;\n    var short'
  },
  {
    file: 'css/vihuplanet-home.css',
    fixed: `  bottom: max(calc(16vh + env(safe-area-inset-bottom, 0px)),
              calc(88px + env(safe-area-inset-bottom, 0px)));`,
    broken: '  bottom: calc(16vh + env(safe-area-inset-bottom, 0px));'
  },
  {
    file: 'css/vihuplanet-home.css',
    fixed: `@media (max-width: 820px) {
  .vp-actions {
    bottom: calc(4.2rem + env(safe-area-inset-bottom, 0px));
  }`,
    broken: `@media (max-width: 820px) {
  .vp-actions {
    /* revert-proof: narrow-view lift removed */
  }`
  },
  {
    file: 'js/vihuplanetHome.js',
    fixed: `      return (coarse || sawTouch)
        ? '(Swipe to explore)' : '(Use the arrow keys to explore)';`,
    broken: "      return coarse ? '(Swipe to explore)' : '(Use the arrow keys to explore)';"
  }
];

const mode = process.argv[2];
if (mode !== 'break' && mode !== 'restore') {
  console.error('usage: node revert-proof.js break|restore');
  process.exit(2);
}
for (const e of EDITS) {
  const p = path.join(ROOT, e.file);
  let s = fs.readFileSync(p, 'utf8');
  const from = mode === 'break' ? e.fixed : e.broken;
  const to = mode === 'break' ? e.broken : e.fixed;
  if (!s.includes(from)) {
    console.error('NOT FOUND in ' + e.file + ': ' + from.slice(0, 60));
    process.exit(1);
  }
  s = s.replace(from, to);
  fs.writeFileSync(p, s);
  console.log(mode + ': ' + e.file + ' — ' + to.slice(0, 50).replace(/\n/g, ' '));
}
