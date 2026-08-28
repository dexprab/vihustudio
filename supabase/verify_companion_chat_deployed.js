// supabase/verify_companion_chat_deployed.js
//
// PASTE THIS INTO THE STUDIO'S CONSOLE, signed in, on any page of
// VihuStudio. It answers one question: IS THE DEPLOYED companion-chat
// THE ONE IN THIS CHECKOUT?
//
// ---------------------------------------------------------------
// WHY THE BUILD STRING IS NOT THE ANSWER
//
// The function reports `BUILD` on GET, and it has read '1N' since the
// first deployment — through Sprint 1N.1's `pages` fix and Sprint
// 1N.5's Mind corrections alike. So a stale server and a fresh one say
// the same word, and everything looks healthy. That is the Decision 42
// failure exactly: a letter was rewritten, tested, committed and pushed
// while every invitation going out was still the old one, and the only
// symptom available was a person saying it looked the same.
//
// So this asks the server to BEHAVE, on sentences whose answer changed.
// Every expectation below is proved through the real handler by
// tools/companion-mind-test (K4b, K4c) rather than asserted here.
//
// ---------------------------------------------------------------
// IT WRITES NOTHING AND COSTS NOTHING
//
// One GET (which the rate limiter deliberately does not count) and two
// POSTs that carry no story and no memory. Nothing is stored, no
// provider is reached — with COMPANION_MIND_ENABLED on, the handler
// answers and returns before makeProvider() exists in the file.
(async () => {
  const cfg = await fetch('supabase-config.json').then((r) => r.json());
  const s = await ThemeRepositoryClient.getSession();
  if (!s || !s.access_token) { console.error('Not signed in — open the Studio first.'); return; }
  const url = cfg.url.replace(/\/+$/, '') + '/functions/v1/companion-chat';
  const H = { Authorization: 'Bearer ' + s.access_token, apikey: cfg.anonKey,
              'Content-Type': 'application/json' };

  // ---- 1. THE FLAGS -------------------------------------------
  const probe = await fetch(url, { headers: H }).then((r) => r.json());
  const flags = {
    reachable: probe.ok === true,
    mindEnabled: probe.mindEnabled === true,          // must be TRUE
    productionEnabled: probe.productionEnabled === false, // must be FALSE
    zdrIrrelevant: probe.syntheticEnabled === false,  // must be FALSE
    build: probe.build
  };

  // ---- 2. THE BEHAVIOUR THAT SEPARATES OLD FROM NEW -----------
  const card = (typeof MagicCard !== 'undefined' && MagicCard.getActive)
    ? (MagicCard.getActive() || {}).id : null;
  const say = (text) => fetch(url, { method: 'POST', headers: H,
    body: JSON.stringify({ cardId: card, storyId: null, pageId: null,
      conversation: [{ speaker: 'creator', text: text }] }) })
    .then((r) => r.json()).then((b) => (b && b.reply) || '');

  const next = await say('What could happen next?');
  const good = await say('Is this story any good?');

  const checks = {
    // Before 1N.5: "I don't know that one." Now: the Creator's to choose.
    'Mind is 1N.5 — creative-suggestion': /yours to (choose|decide)/i.test(next),
    // Before 1N.5: answered as a story fact. Now: the Companion never grades.
    'Mind is 1N.5 — work-judgement': /don'?t think about it|only notice|only look|only come and look/i.test(good),
  };

  // ---- 3. THE `pages` FIX, if a story is open ------------------
  //
  // The one thing that needs a real story. Before the fix, authorizeStory
  // read `record.data.slides` — a key the store has never written — so
  // EVERY story authorized as zero pages and this came back "I don't
  // know". Open a story first if this reads SKIPPED.
  let pagesFix = 'SKIPPED — open a story, then run this again';
  const sid = (typeof AppState !== 'undefined' && AppState.project) ? AppState.project.id : null;
  if (sid) {
    const r = await fetch(url, { method: 'POST', headers: H,
      body: JSON.stringify({ cardId: card, storyId: sid, pageId: 0,
        conversation: [{ speaker: 'creator', text: 'How many pages are there?' }] }) })
      .then((x) => x.json());
    const said = (r && r.reply) || '';
    pagesFix = /\b\d+\s+pages?\b|there'?s one page/i.test(said)
      ? 'PASS — ' + JSON.stringify(said)
      : 'FAIL — ' + JSON.stringify(said) + ' (the server is still reading `slides`)';
  }

  console.table(Object.assign({}, flags, checks, { pagesFix: pagesFix }));
  const verdict = flags.reachable && flags.mindEnabled && flags.productionEnabled &&
    Object.values(checks).every(Boolean) && !/^FAIL/.test(pagesFix);
  console.log(verdict
    ? '%cDEPLOYED — this is the current build.'
    : '%cNOT the current build, or a flag is wrong. See the table.',
    'font-weight:bold;font-size:14px;color:' + (verdict ? '#2a8' : '#c33'));
})();
