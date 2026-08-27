/* Run one of the Studio's browser modules in Node, unmodified.
 *
 * The Studio's files are IIFEs that assign themselves to `window`.
 * Rather than teach them about Node — which would put a second code
 * path into a security boundary, and the whole point is that the
 * preview exercises THE REAL FILE — each is evaluated in a small vm
 * context with a stub window and whatever siblings it needs.
 *
 * The sandbox has no `fetch`, no `XMLHttpRequest`, no sockets and no
 * `require`. A module that reached for the network in here would throw
 * rather than succeed quietly.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadModules(names, extraGlobals) {
  const sandbox = Object.assign({ console: console, Date: Date, Math: Math, JSON: JSON },
    extraGlobals || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  names.forEach(function (name) {
    const src = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8');
    vm.runInContext(src, sandbox, { filename: 'js/' + name + '.js' });
  });
  return sandbox;
}

module.exports = { loadModules: loadModules, ROOT: ROOT };
