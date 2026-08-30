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
  if (p.build !== '3A')            need.push('DEPLOY the function — server says build "' + p.build + '", Step 3A is "3A"');
  if (p.provider !== 'openai')     need.push('set COMPANION_MODEL_PROVIDER = openai   (now: "' + p.provider + '")');
  if (!p.configured)               need.push('OPENAI_API_KEY is not visible to the function');
  if (!(p.modelCompanions||[]).includes('leosaurus'))
                                   need.push('set COMPANION_MODEL_COMPANIONS = leosaurus');
  if (!p.syntheticEnabled && !p.productionEnabled)
                                   need.push('set COMPANION_SYNTHETIC_ENABLED = true   (for the safe first call)');
  console.log(need.length ? '%cSTILL TO DO:\n  · ' + need.join('\n  · ')
                          : '%cREADY — run the first call.',
    'font-size:13px;font-weight:bold;color:' + (need.length ? '#c33' : '#2a8'));
})();
