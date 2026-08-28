/* tools/companion-enable-test/function-server.js
 *
 * THE REAL EDGE FUNCTION, SERVED OVER HTTP, LOCALLY.
 *
 * companion-chat/index.ts is plain JavaScript in a .ts file and exports
 * its own handler, so this imports THAT FILE — there is no second copy
 * of the endpoint anywhere — and bridges Node's http server to the
 * Request/Response objects it already speaks.
 *
 * ---------------------------------------------------------------
 * WHAT THIS IS NOT
 *
 * IT IS NOT A DEPLOYMENT, and nothing that uses it may say it is. This
 * environment's network policy refuses the Supabase host outright
 * (`CONNECT tunnel failed, response 403`), so the live function is
 * untouched and unmeasured. What this proves is the CONTRACT: the real
 * browser surface, the real handler, the real Mind, and the real
 * response shape, with the network hop and the identity provider
 * standing in.
 *
 * The database behind it is a stub of the real tables — the same shape
 * tools/companion-mind-test uses, and for the same reason: everything
 * the server is allowed to know about who owns what lives there, and
 * nothing the client sends can change a row in it.
 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'companion-chat', 'index.ts');

const USER_TOKEN = 'enable.suite.session.token';
const SUPABASE_URL = 'https://project.example';

// Everything the handler is allowed to read. Deliberately a stub rather
// than the live project: §14 forbids inserting test rows into
// production, and this suite must be able to prove memory recall.
const DB = { cards: [], memories: [], projects: [] };
let outbound = [];
let dbWrites = 0;

function reset() {
  outbound = [];
  dbWrites = 0;
  DB.cards = [
    { id: 'card_leafy', owner_id: 'user-po', companion_id: 'leafy',
      companion_name: 'Leafy', companion_species: 'Bloomling' },
    { id: 'card_leo', owner_id: 'user-po', companion_id: 'leosaurus',
      companion_name: 'Leo', companion_species: 'Lantern Lion' },
    { id: 'card_quill', owner_id: 'user-po', companion_id: 'quill',
      companion_name: 'Quill', companion_species: 'Ink Spirit' },
    { id: 'card_nimbus', owner_id: 'user-po', companion_id: 'nimbus',
      companion_name: 'Nimbus', companion_species: 'Dream Sprite' },
  ];
  DB.memories = [];
  DB.projects = [];
}
reset();

function slides() {
  return [
    { storyBeat: 'The little fox stepped into the forest.', image: 'data:x',
      metadata: { stickers: [{}, {}] } },
    { storyBeat: 'It was very quiet.', metadata: { stickers: [] } },
    { storyBeat: 'Then something moved.', metadata: { stickers: [] } },
  ];
}

function stubFetch() {
  return async function (url, init) {
    const u = String(url);
    const method = String((init && init.method) || 'GET').toUpperCase();
    outbound.push({ url: u, method: method });
    if (u.indexOf('/auth/v1/user') !== -1) {
      const auth = (init && init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
      const token = String(auth).replace(/^Bearer\s+/i, '');
      if (token === USER_TOKEN) {
        return new Response(JSON.stringify({ id: 'user-po', email: 'nobody@example.test' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ msg: 'invalid' }), { status: 401 });
    }
    if (/\/rest\/v1\/(magic_card_identities|creator_companion_memory|creator_projects)/.test(u)
        && method !== 'GET') dbWrites++;
    if (u.indexOf('/rest/v1/magic_card_identities') !== -1) {
      const m = /[?&]id=eq\.([^&]+)/.exec(u);
      const owner = /[?&]owner_id=eq\.([^&]+)/.exec(u);
      let rows = DB.cards.slice();
      if (m) rows = rows.filter((r) => r.id === decodeURIComponent(m[1]));
      if (owner) rows = rows.filter((r) => r.owner_id === decodeURIComponent(owner[1]));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/magic_card_recalls') !== -1) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/creator_projects') !== -1) {
      const id = /[?&]id=eq\.([^&]+)/.exec(u);
      let rows = DB.projects.slice();
      if (id) rows = rows.filter((r) => r.id === decodeURIComponent(id[1]));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/creator_companion_memory') !== -1) {
      const owner = /[?&]owner_id=eq\.([^&]+)/.exec(u);
      let rows = DB.memories.slice();
      if (owner) rows = rows.filter((r) => r.owner_id === decodeURIComponent(owner[1]));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/rpc/edge_rate_limit_hit') !== -1) {
      return new Response(JSON.stringify({ allowed: true, remaining: 39, retry_after: 900 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // ANYTHING ELSE IS RECORDED AND REFUSED. If a provider were ever
    // reached it would land here, and the suite counts it.
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

async function loadHandler(env) {
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const tmp = path.join(os.tmpdir(), 'vihu-enable-fn-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);
  try { fs.unlinkSync(tmp); } catch (e) {}
  const base = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: 'anon.key.value',
    SUPABASE_SERVICE_ROLE_KEY: 'service.key.value',
    COMPANION_MODEL_PROVIDER: 'mock',
  };
  const all = Object.assign(base, env || {});
  return { M: M, handler: M.makeHandler({
    env: (n) => (all[n] == null ? '' : String(all[n])),
    fetchImpl: stubFetch(),
    now: () => Date.now(),
  }) };
}

async function start(port, env) {
  const { M, handler } = await loadHandler(env);
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k] = String(v);
    let out;
    try {
      out = await handler(new Request('http://local' + req.url, {
        method: req.method, headers: headers,
        body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : body,
      }));
    } catch (e) {
      out = new Response(JSON.stringify({ ok: false, reason: 'handler-threw', detail: String(e && e.message) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const text = await out.text();
    const h = {};
    out.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(out.status, h);
    res.end(text);
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, M, DB, slides,
    token: USER_TOKEN,
    outbound: () => outbound.slice(),
    writes: () => dbWrites,
    reset: reset,
    stop: () => new Promise((r) => server.close(r)) };
}

module.exports = { start, USER_TOKEN, DB, slides, reset,
  outbound: () => outbound.slice(), writes: () => dbWrites };
