// ---- WHERE AM I? -------------------------------------------------
// Paste into the Studio console, signed in. Read-only: one GET.
(async () => {
  const cfg = await fetch('supabase-config.json', {cache:'no-store'}).then(r => r.json());
  const s = await ThemeRepositoryClient.getSession();
  const r = await fetch(cfg.url.replace(/\/+$/,'') + '/functions/v1/companion-chat',
    { headers: { Authorization: 'Bearer ' + s.access_token, apikey: cfg.anonKey } });
  const p = await r.json();
  console.log(p);
  const need = [];
  // ---- IS THIS THE STEP 3A CODE, AND IS IT THE FIXED ONE?
  //
  // Two separate questions, and the first draft of this check could
  // only ask the first. `modelCompanions` is reported by the probe from
  // Step 3A onward, so its PRESENCE says the routing exists — but the
  // FIRST Step 3A deploy carried a real bug (the fixture's Companion was
  // overwritten before the model gate read its id, so the controlled
  // first call was answered by the deterministic Mind and looked exactly
  // like a working deployment). Presence alone would have called that
  // done.
  //
  // So the build string is used for the SECOND question only, and it now
  // means something: '3A.1' is the first build that can pass the first
  // call. Decision 49 — a version label is the wrong instrument for "is
  // this deployed at all", and the right one for "which one is it".
  const isStep3A = Array.isArray(p.modelCompanions);
  const FIXED = '3A.1';
  if (!isStep3A)  need.push('DEPLOY the function — this server predates Step 3A (build "' + p.build + '")');
  else if (p.build !== FIXED)
    need.push('REDEPLOY the function — this is an early Step 3A build ("' + p.build
      + '") whose first call is answered by the deterministic Mind. The fix is build "' + FIXED + '".');
  if (p.provider !== 'openai')     need.push('set COMPANION_MODEL_PROVIDER = openai   (now: "' + p.provider + '")');
  if (!p.configured)               need.push('OPENAI_API_KEY is not visible to the function');
  if (isStep3A && !p.modelCompanions.includes('leosaurus'))
                                   need.push('set COMPANION_MODEL_COMPANIONS = leosaurus');
  if (!p.syntheticEnabled && !p.productionEnabled)
                                   need.push('set COMPANION_SYNTHETIC_ENABLED = true   (for the safe first call)');
  console.log(need.length ? '%cSTILL TO DO:\n  · ' + need.join('\n  · ')
                          : '%cREADY — run the first call.',
    'font-size:13px;font-weight:bold;color:' + (need.length ? '#c33' : '#2a8'));
})();
