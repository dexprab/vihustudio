// supabase/verify_companion_chat_deployed.js
//
// PASTE THIS INTO THE STUDIO'S CONSOLE, signed in, on any page of
// VihuStudio. Two questions, in this order:
//
//   1. DOES THE FUNCTION ANSWER AT ALL — and if not, WHOSE fault is it?
//   2. If it answers, is it the build in this checkout?
//
// ---------------------------------------------------------------
// IT DIAGNOSES RATHER THAN JUST FAILING.
//
// The first version reported "the function did not answer" and stopped,
// which is true and useless: a function that is not deployed, a gateway
// that is down, a hung call INSIDE the function and a browser blocking
// the request all look identical from there. So it separates them:
//
//   · a BARE GET, with no custom headers, so no CORS preflight and no
//     auth — the platform gateway answers 401 fast if the function
//     exists at all. A fast 401 means DEPLOYED AND REACHABLE, and moves
//     the problem inside the function.
//   · an OPTIONS preflight on its own, so a CORS failure is named as
//     one rather than looking like a hang.
//   · the SAME bare GET against a sibling function (voice-speak), which
//     separates "this function is broken" from "no Edge Function is
//     reachable from here".
//
// ---------------------------------------------------------------
// AND IT CANNOT HANG.
//
// The product owner pasted the first draft and got `Promise {<pending>}`
// for ever — every await was unbounded, so one call that never returned
// took the whole script and printed nothing, not even the step it had
// reached. Every step is bounded now, prints as it happens, and clears
// its own timer so a finished step cannot log a timeout afterwards.
// THE BUILD THIS CHECKOUT EXPECTS. Kept in step by the suite rather
// than by hand — tools/companion-mind-test reads BOTH this constant and
// the function's own `BUILD` and fails if they disagree, so a stale
// number here cannot quietly pass a stale deployment.
//
// A MISMATCH IS A WARNING, NOT A VERDICT. `BUILD` read '1N' through
// three sprints, so it is only authoritative from the first deploy that
// carries a bumped one; the behavioural checks below are what actually
// decide, and they are proved through the real handler by K4b/K4c.
const EXPECTED_BUILD = '3E';

(async () => {
  const log = (...a) => console.log('[verify]', ...a);
  const STEP_MS = 12000;

  // A bound that cleans up after itself. The first version left its
  // timer running, so a step that had already succeeded logged "TIMED
  // OUT" seconds later — noise that reads like a second failure.
  function cap(p, ms, fallback, label) {
    let t = null;
    const timer = new Promise((res) => {
      t = setTimeout(() => { log(label, 'TIMED OUT after', ms + 'ms'); res(fallback); }, ms);
    });
    return Promise.race([
      Promise.resolve(p).catch((e) => { log(label, 'failed:', String(e).slice(0, 140)); return fallback; }),
      timer,
    ]).then((v) => { clearTimeout(t); return v; });
  }

  // Status and body, never a bare json() that hides a 404 behind a
  // parse error.
  const probe = (u, init, ms, label) => cap(
    fetch(u, init).then(async (r) => ({
      status: r.status,
      body: await r.text().then((t) => t.slice(0, 300)).catch(() => ''),
    })), ms || STEP_MS, { status: 0, body: '(no answer)' }, label);

  try {
    log('reading supabase-config.json…');
    const cfg = await cap(fetch('supabase-config.json', { cache: 'no-store' }).then((r) => r.json()),
                          6000, null, 'config');
    if (!cfg || !cfg.url) { console.error('[verify] no supabase-config.json — stopping.'); return; }
    const base = cfg.url.replace(/\/+$/, '') + '/functions/v1/';
    log('config ok →', cfg.url);

    // =========================================================
    // A. IS IT THERE, AND IS ANYTHING THERE?
    // =========================================================
    log('A1 bare GET companion-chat (no headers, no preflight, no auth)…');
    const bare = await probe(base + 'companion-chat', {}, 10000, 'bare GET');
    log('   →', bare.status, JSON.stringify(bare.body));

    log('A2 the same, against a sibling function (voice-speak)…');
    const sib = await probe(base + 'voice-speak', {}, 10000, 'sibling GET');
    log('   →', sib.status, JSON.stringify(sib.body));

    log('A3 the CORS preflight on its own…');
    const pre = await probe(base + 'companion-chat', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'GET',
                 'Access-Control-Request-Headers': 'authorization, apikey, content-type' },
    }, 8000, 'preflight');
    log('   →', pre.status);

    const reach = {
      'companion-chat answers': bare.status !== 0,
      'a sibling answers': sib.status !== 0,
      'preflight answers': pre.status !== 0,
    };
    if (bare.status === 0) {
      console.table(reach);
      console.error(sib.status === 0
        ? '[verify] NO Edge Function answered. The project or the network is the problem, not this function.'
        : '[verify] companion-chat alone did not answer, while a sibling did. '
          + 'The deployment is hung or broken — redeploy it and watch the function logs.');
      return;
    }
    if (bare.status === 404) {
      console.table(reach);
      console.error('[verify] 404 — there is no function called companion-chat on this project.');
      return;
    }
    log('companion-chat is deployed and reachable (bare GET → ' + bare.status + ').');

    // =========================================================
    // B. THE AUTHENTICATED PROBE
    // =========================================================
    log('B1 getting the session…');
    const s = await cap(
      (typeof ThemeRepositoryClient !== 'undefined' && ThemeRepositoryClient.getSession)
        ? ThemeRepositoryClient.getSession() : Promise.resolve(null),
      4000, null, 'session');
    if (!s || !s.access_token) {
      console.error('[verify] no session. Open the Studio, let it settle, then run this again.');
      return;
    }
    const H = { Authorization: 'Bearer ' + s.access_token, apikey: cfg.anonKey };
    log('B2 GET the probe, authenticated…');
    const got = await probe(base + 'companion-chat', { headers: H }, STEP_MS, 'probe');
    log('   →', got.status, got.body);
    let p = null;
    try { p = JSON.parse(got.body); } catch (e) { p = null; }
    if (!p || p.ok !== true) {
      console.table(Object.assign({}, reach, { authenticatedStatus: got.status }));
      console.error(got.status === 0
        ? '[verify] the bare GET answered but the authenticated one did not. '
          + 'That points INSIDE the function — the auth gate calls /auth/v1/user and waits. '
          + 'Check the function logs for a request that never finished.'
        : '[verify] the probe answered ' + got.status + ' — see the body above.');
      return;
    }
    const flags = {
      reachable: true,
      mindEnabled: p.mindEnabled === true,            // must be TRUE
      productionClosed: p.productionEnabled === false, // must be FALSE
      syntheticClosed: p.syntheticEnabled === false,   // must be FALSE
      build: p.build || '(none)',
    };

    // =========================================================
    // C. IS IT THIS BUILD? — the build string cannot say, so ask it
    //    to BEHAVE. `BUILD` has read '1N' since the first deployment,
    //    through the `pages` fix and through 1N.5, so a stale server
    //    and a fresh one say the same word. Both expectations below are
    //    proved through the real handler by tools/companion-mind-test
    //    (K4b, K4c) rather than asserted here.
    // =========================================================
    const card = (typeof MagicCard !== 'undefined' && MagicCard.getActive)
      ? ((MagicCard.getActive() || {}).id || null) : null;
    const say = async (text, storyId, pageId) => {
      const r = await probe(base + 'companion-chat', {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H),
        body: JSON.stringify({ cardId: card, storyId: storyId || null,
          pageId: pageId == null ? null : pageId,
          conversation: [{ speaker: 'creator', text }] }),
      }, STEP_MS, 'say(' + text.slice(0, 22) + '…)');
      try { return (JSON.parse(r.body) || {}).reply || ''; } catch (e) { return ''; }
    };

    log('C1 two sentences whose answer changed in 1N.5…');
    const next = await say('What could happen next?');
    log('   "What could happen next?" →', JSON.stringify(next));
    const good = await say('Is this story any good?');
    log('   "Is this story any good?" →', JSON.stringify(good));
    const checks = {
      mind_1N5_creative: /yours to (choose|decide)/i.test(next),
      mind_1N5_judgement: /don'?t think about it|only notice|only look|only come and look/i.test(good),
    };

    // The one thing that needs a real story. Before the fix,
    // authorizeStory read `record.data.slides` — a key the store has
    // never written — so EVERY story authorized as zero pages.
    let pagesFix = 'SKIPPED — open a story, then run this again';
    const sid = (typeof AppState !== 'undefined' && AppState.project) ? AppState.project.id : null;
    if (sid) {
      log('C2 a story is open — checking the `pages` fix…');
      const said = await say('How many pages are there?', sid, 0);
      log('   →', JSON.stringify(said));
      pagesFix = /\b\d+\s+pages?\b|there'?s one page/i.test(said)
        ? 'PASS — ' + JSON.stringify(said)
        : 'FAIL — ' + JSON.stringify(said) + ' (the server is still reading `slides`)';
    }

    if (flags.build !== EXPECTED_BUILD) {
      log('NOTE: the server reports build ' + JSON.stringify(flags.build) +
          ' and this checkout expects ' + JSON.stringify(EXPECTED_BUILD) + '.');
      log('      Expected until the next deploy — `BUILD` was not bumped for 1N.1 or 1N.5,');
      log('      so it only starts meaning something from the first deploy that carries a new one.');
      log('      The behavioural checks below are what decide.');
    }
    console.table(Object.assign({}, flags, checks,
      { buildMatchesCheckout: flags.build === EXPECTED_BUILD, pagesFix }));
    const verdict = flags.mindEnabled && flags.productionClosed &&
      Object.values(checks).every(Boolean) && !/^FAIL/.test(pagesFix);
    console.log(verdict
      ? '%cDEPLOYED — this is the current build.'
      : '%cNOT the current build, or a flag is wrong. See the table.',
      'font-weight:bold;font-size:14px;color:' + (verdict ? '#2a8' : '#c33'));
  } catch (e) {
    console.error('[verify] stopped:', e);
  }
})();
