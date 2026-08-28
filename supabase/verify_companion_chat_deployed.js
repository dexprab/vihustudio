// supabase/verify_companion_chat_deployed.js
//
// PASTE THIS INTO THE STUDIO'S CONSOLE, signed in, on any page of
// VihuStudio. It answers one question: IS THE DEPLOYED companion-chat
// THE ONE IN THIS CHECKOUT?
//
// ---------------------------------------------------------------
// IT CANNOT HANG, AND THE FIRST VERSION OF IT DID.
//
// The product owner pasted the first draft and got `Promise {<pending>}`
// and nothing else, for ever. Every `await` in it was unbounded, so one
// call that never came back took the whole script with it and printed
// NOTHING — not even which step it had reached. A verifier that can
// hang is worse than no verifier: it looks like a broken deployment
// when it is a broken check.
//
// So: every step is bounded, every step prints as it happens, and the
// script always reaches a verdict. `ThemeRepositoryClient.getSession()`
// is capped for the same reason js/companionChat.js caps it — somebody
// had already met this.
//
// ---------------------------------------------------------------
// WHY THE BUILD STRING IS NOT THE ANSWER
//
// The function reports `BUILD` on GET, and it has read '1N' since the
// first deployment — through Sprint 1N.1's `pages` fix and Sprint
// 1N.5's Mind corrections alike. So a stale server and a fresh one say
// the same word, and everything looks healthy. That is the Decision 42
// failure exactly.
//
// So this asks the server to BEHAVE, on sentences whose answer changed.
// Every expectation below is proved through the real handler by
// tools/companion-mind-test (K4b, K4c) rather than asserted here.
//
// ---------------------------------------------------------------
// IT WRITES NOTHING AND COSTS NOTHING
//
// One GET (which the rate limiter deliberately does not count) and two
// POSTs that carry no story and no memory. Nothing is stored, and no
// provider is reached — with COMPANION_MIND_ENABLED on, the handler
// answers and returns before makeProvider() exists in the file.
(async () => {
  const STEP_MS = 12000;
  const log = (...a) => console.log('[verify]', ...a);

  // Nothing below can outlive its own budget.
  const cap = (p, ms, fallback, label) => Promise.race([
    Promise.resolve(p).catch((e) => { log(label, 'failed:', String(e).slice(0, 120)); return fallback; }),
    new Promise((res) => setTimeout(() => { log(label, 'TIMED OUT after', ms + 'ms'); res(fallback); }, ms)),
  ]);
  const getJSON = (url, init, ms, label) => cap(
    fetch(url, init).then((r) => r.json().catch(() => null)), ms || STEP_MS, null, label);

  try {
    log('reading supabase-config.json…');
    const cfg = await cap(fetch('supabase-config.json', { cache: 'no-store' }).then((r) => r.json()),
                          6000, null, 'config');
    if (!cfg || !cfg.url) { console.error('[verify] no supabase-config.json — stopping.'); return; }
    log('config ok →', cfg.url);

    log('getting the session…');
    const s = await cap(
      (typeof ThemeRepositoryClient !== 'undefined' && ThemeRepositoryClient.getSession)
        ? ThemeRepositoryClient.getSession() : Promise.resolve(null),
      4000, null, 'session');
    if (!s || !s.access_token) {
      console.error('[verify] no session. Open the Studio and let it settle, then run this again.');
      return;
    }
    log('session ok');

    const url = cfg.url.replace(/\/+$/, '') + '/functions/v1/companion-chat';
    const H = { Authorization: 'Bearer ' + s.access_token, apikey: cfg.anonKey,
                'Content-Type': 'application/json' };

    // ---- 1. THE FLAGS -----------------------------------------
    log('GET the probe…');
    const probe = await getJSON(url, { headers: H }, STEP_MS, 'probe') || {};
    const flags = {
      reachable: probe.ok === true,
      mindEnabled: probe.mindEnabled === true,           // must be TRUE
      productionClosed: probe.productionEnabled === false, // must be FALSE
      syntheticClosed: probe.syntheticEnabled === false,   // must be FALSE
      build: probe.build || '(none)',
    };
    log('probe →', JSON.stringify(probe));
    if (!flags.reachable) {
      console.error('[verify] the function did not answer. Nothing below can be judged.');
      console.table(flags);
      return;
    }

    // ---- 2. THE BEHAVIOUR THAT SEPARATES OLD FROM NEW ---------
    const card = (typeof MagicCard !== 'undefined' && MagicCard.getActive)
      ? ((MagicCard.getActive() || {}).id || null) : null;
    const say = (text, storyId, pageId) => getJSON(url, {
      method: 'POST', headers: H,
      body: JSON.stringify({ cardId: card, storyId: storyId || null, pageId: pageId == null ? null : pageId,
        conversation: [{ speaker: 'creator', text }] }),
    }, STEP_MS, 'say(' + text.slice(0, 24) + '…)').then((b) => (b && b.reply) || '');

    log('asking two sentences whose answer changed in 1N.5…');
    const next = await say('What could happen next?');
    log('  "What could happen next?"  →', JSON.stringify(next));
    const good = await say('Is this story any good?');
    log('  "Is this story any good?"  →', JSON.stringify(good));

    const checks = {
      // Before 1N.5: "I don't know that one." Now: the Creator's to choose.
      'mind_1N5_creative': /yours to (choose|decide)/i.test(next),
      // Before 1N.5: answered as a story fact. Now: the Companion never grades.
      'mind_1N5_judgement': /don'?t think about it|only notice|only look|only come and look/i.test(good),
    };

    // ---- 3. THE `pages` FIX, if a story is open ----------------
    //
    // The one thing that needs a real story. Before the fix,
    // authorizeStory read `record.data.slides` — a key the store has
    // never written — so EVERY story authorized as zero pages and this
    // came back "I don't know".
    let pagesFix = 'SKIPPED — open a story, then run this again';
    const sid = (typeof AppState !== 'undefined' && AppState.project) ? AppState.project.id : null;
    if (sid) {
      log('a story is open — checking the `pages` fix…');
      const said = await say('How many pages are there?', sid, 0);
      log('  "How many pages are there?" →', JSON.stringify(said));
      pagesFix = /\b\d+\s+pages?\b|there'?s one page/i.test(said)
        ? 'PASS — ' + JSON.stringify(said)
        : 'FAIL — ' + JSON.stringify(said) + ' (the server is still reading `slides`)';
    }

    console.table(Object.assign({}, flags, checks, { pagesFix }));
    const verdict = flags.reachable && flags.mindEnabled && flags.productionClosed &&
      Object.values(checks).every(Boolean) && !/^FAIL/.test(pagesFix);
    console.log(verdict
      ? '%cDEPLOYED — this is the current build.'
      : '%cNOT the current build, or a flag is wrong. See the table.',
      'font-weight:bold;font-size:14px;color:' + (verdict ? '#2a8' : '#c33'));
  } catch (e) {
    console.error('[verify] stopped:', e);
  }
})();
