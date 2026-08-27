/* THE INVITE DESK — what the page says when the post office refuses.
 *
 * Reported by the product owner, looking at the live console:
 *   "The invite-send function is refusing the key (401) — it is
 *    deployed but rejecting this call."
 *
 * That sentence was the page's only word for every refusal, and it named
 * the wrong thing twice. The key is one of several ways a 401 happens;
 * and a 403 — which is the refusal Sprint 1A actually introduced, "this
 * account is not on the administrators list" — never reached it at all:
 * it fell through to the success branch and rendered as
 * "Post office: undefined". So the failure the hardening was most likely
 * to cause was the one failure this page could not say out loud.
 *
 * 401 and 403 are different problems in different places. This suite
 * drives the real page with the real branch logic and a stubbed post
 * office, and reads the sentence a person would actually see.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/invite-desk-test/run-invite-desk-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.INVITE_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

// A stub for the one module this page imports from the network. It is a
// stub of the CLIENT, never of the page: every branch under test is the
// page's own code, reached the way the browser reaches it.
const SUPA_STUB = (signedIn) => `
export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: ${signedIn ? "{ access_token: 'a-real-looking-token' }" : 'null'} } }),
      refreshSession: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
    },
    rpc: async () => ({ data: [], error: null }),
  };
}`;

async function say(browser, { signedIn = true, status = 200, body = null, fail = false }) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://esm.sh/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: SUPA_STUB(signedIn) }));
  await page.route('**/functions/v1/invite-send', (route) => {
    if (fail) return route.abort('failed');
    route.fulfill({ status: status, contentType: 'application/json',
      body: JSON.stringify(body || {}) });
  });
  await page.goto(BASE + '/admin/invites.html');
  await page.waitForTimeout(1400);
  const text = await page.evaluate(() => {
    const el = document.getElementById('mailState');
    return el ? el.textContent.trim() : null;
  });
  await page.close();
  return { text: text || '', errors: errors };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  console.log('\nTHE INVITE DESK\n');

  const open = await say(browser, { status: 200, body: { ok: true, mail: 'resend', from: 'set', build: 'b1' } });
  check(/Post office: resend/.test(open.text),
    'I1 a working post office says so', open.text);

  const unset = await say(browser, { status: 200, body: { ok: true, mail: 'none', from: 'unset', build: 'b1' } });
  check(/Email is not configured yet/.test(unset.text),
    'I2 …and an unconfigured one is about the mail keys, not about the caller', unset.text);

  // THE REGRESSION. 403 used to fall through to the success branch and
  // render "Post office: undefined".
  const notAdmin = await say(browser, { status: 403, body: { ok: false, reason: 'forbidden' } });
  check(/not an administrator/i.test(notAdmin.text),
    'I3 403 says the account is not an administrator — it used to say "Post office: undefined"',
    notAdmin.text);
  check(!/Post office/.test(notAdmin.text) && !/undefined/.test(notAdmin.text),
    'I4 …and never renders as a working post office', notAdmin.text);
  check(!/key/i.test(notAdmin.text),
    'I5 …and never blames the key, which has nothing to do with it', notAdmin.text);

  const unknown = await say(browser, { status: 401, body: { ok: false, reason: 'unauthorized' } });
  check(/did not recognise this sign-in/i.test(unknown.text) && /SUPABASE_ANON_KEY/.test(unknown.text),
    'I6 401 names the two places it can come from, and points at the function environment',
    unknown.text);
  check(!/not an administrator/i.test(unknown.text),
    'I7 …and is not confused with the other refusal', unknown.text);

  const busy = await say(browser, { status: 429, body: { ok: false, reason: 'rate_limited' } });
  check(/Too many just now/.test(busy.text),
    'I8 429 is a pause, not a fault', busy.text);

  const gone = await say(browser, { status: 404, body: {} });
  check(/not deployed yet/.test(gone.text),
    'I9 404 is still "not deployed"', gone.text);

  const dead = await say(browser, { fail: true });
  check(/could not be reached/.test(dead.text),
    'I10 an unreachable post office is reported as unreachable, never as undeployed', dead.text);

  // A SIGNED-OUT PAGE IS ITS OWN ANSWER. The old headers fell back to
  // the anon key, which since Sprint 1A can only ever be refused — so
  // "I am not signed in" arrived as a 401 about the deployment.
  const out = await say(browser, { signedIn: false, status: 401, body: { ok: false, reason: 'unauthorized' } });
  check(out.text === '' || /not signed in/i.test(out.text),
    'I11 a signed-out page never reports a deployment problem', JSON.stringify(out.text));

  const allErrors = [].concat(open.errors, unset.errors, notAdmin.errors, unknown.errors,
    busy.errors, gone.errors, dead.errors, out.errors);
  check(allErrors.length === 0, 'I12 zero page errors', allErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
