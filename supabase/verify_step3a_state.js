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
  // ---- IS THIS STEP 3A's CODE? ASK WHAT IT CAN DO, NOT WHAT IT SAYS.
  //
  // The build string was bumped to '3A' AFTER Step 3A was first
  // deployable, so a correct Step 3A deployment can honestly report
  // '1N.5' — and the first draft of this check told the product owner
  // to redeploy a function that was already right. Twice now a version
  // label has been the wrong instrument (Decisions 42, 49).
  //
  // `modelCompanions` is the honest signal: the probe only reports it
  // at all from Step 3A onward, so its PRESENCE is the deploy and its
  // CONTENTS are the gate.
  const isStep3A = Array.isArray(p.modelCompanions);
  if (!isStep3A)  need.push('DEPLOY the function — this server predates Step 3A (build "' + p.build + '")');
  else if (p.build !== '3A') console.log('[note] Step 3A code is live; its build stamp reads "'
    + p.build + '" because the stamp was bumped after you deployed. Harmless — the next deploy says "3A".');
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
