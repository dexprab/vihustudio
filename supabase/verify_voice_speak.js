/* DOES THE COMPANION'S VOICE WORK, AND IF NOT, WHICH LINK IS BROKEN?
 *
 * Paste the whole file into the browser console (F12) ON THE STUDIO
 * (studio.html), signed in as yourself, with your card active. It walks
 * the exact chain a conversation reply's voice takes and names the first
 * link that fails — instead of the child-facing symptom, which is
 * deliberately just silence (Decision 25).
 *
 * The chain: mute setting -> the Companion has a voiceId in the
 * registry -> platform config + session -> the voice-speak function
 * answers its GET (deployed? key configured?) -> a REAL generate with
 * the exact request the product builds (VihuVoice.resolve) -> audio
 * bytes come back.
 *
 * Every step is bounded (Decision 49) — this script always reaches a
 * verdict. It makes at most one tiny ephemeral generate, which is one
 * short provider call.
 */
(async () => {
  const STEP_MS = 12000;
  const log = (...a) => console.log('[voice]', ...a);
  const bounded = (p, ms, what) => Promise.race([
    p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' took over ' + ms + 'ms')), ms)),
  ]);
  const out = {};
  try {
    // ---- A. the room: is the voice simply muted? --------------------
    let muted = false;
    try { muted = localStorage.getItem('vihu.companion.voice') === 'off'; } catch (e) {}
    out.muted = muted;

    // ---- B. who is speaking, and do they have a voice? --------------
    const card = (typeof MagicCard !== 'undefined' && MagicCard.getActive)
      ? (MagicCard.getActive() || null) : null;
    const cid = card && card.companionId ? String(card.companionId) : null;
    out.companion = cid || '(no card / no bond)';
    out.hasVoiceId = cid
      ? await bounded(VihuVoice.canSpeak(cid), STEP_MS, 'canSpeak')
      : false;

    // ---- C. platform + session --------------------------------------
    const cfg = await bounded(fetch('supabase-config.json').then((r) => r.json()),
      STEP_MS, 'config').catch(() => null);
    out.platform = !!(cfg && cfg.url && cfg.anonKey);
    let token = null;
    try {
      const s = await bounded(ThemeRepositoryClient.getSession(), STEP_MS, 'session');
      token = s && s.access_token ? s.access_token : null;
    } catch (e) {}
    out.session = !!token;

    // ---- D. the function: deployed, and does it hold a key? ---------
    let fn = null;
    if (out.platform && token) {
      const base = cfg.url.replace(/\/+$/, '') + '/functions/v1/voice-speak';
      const H = { Authorization: 'Bearer ' + token, apikey: cfg.anonKey };
      log('D  GET voice-speak…');
      const ping = await bounded(fetch(base, { headers: H }), STEP_MS, 'GET')
        .then((r) => r.json()).catch((e) => ({ error: String(e).slice(0, 160) }));
      log('   →', JSON.stringify(ping));
      fn = ping;
      out.fnReachable = !!(ping && ping.ok === true);
      out.fnBuild = ping && ping.build || '(none)';
      out.providerKeyConfigured = !!(ping && ping.configured);

      // ---- E. a REAL generate, with the product's own request -------
      // VihuVoice.resolve builds exactly what _generate sends — voice,
      // model, settings, text — so this measures the real path, not an
      // approximation of it. Ephemeral, so nothing is kept.
      if (out.hasVoiceId && out.fnReachable && out.providerKeyConfigured) {
        const req = await bounded(
          VihuVoice.resolve({ characterId: cid, text: 'Hello! Can you hear me?' }),
          STEP_MS, 'resolve');
        log('E  POST a real line as ' + cid + ' (voice ' + (req && req.voiceId) + ', model ' + (req && req.modelId) + ')…');
        const t0 = Date.now();
        const r = await bounded(fetch(base, {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: req.characterId, voiceId: req.voiceId, modelId: req.modelId,
            settings: req.settings, text: req.text, ephemeral: true,
          }),
        }), 30000, 'generate').catch((e) => ({ __err: String(e).slice(0, 160) }));
        if (r.__err) {
          out.generate = 'UNREACHABLE — ' + r.__err;
        } else {
          const type = r.headers.get('Content-Type') || '';
          if (r.ok && type.indexOf('audio') !== -1) {
            const b = await r.blob();
            out.generate = 'AUDIO — ' + b.size + ' bytes in ' + (Date.now() - t0) + 'ms'
              + ' (served by ' + (r.headers.get('X-Vihu-Voice') || '?') + ')';
            // Offer it to the ear: pasting into the console counts as a
            // gesture in most browsers, so this usually just plays.
            try {
              const a = new Audio(URL.createObjectURL(b));
              await a.play().then(() => log('E  …and it is PLAYING now.'),
                (e) => log('E  bytes are good; playback needs a click first (' + e.name + ')'));
            } catch (e) {}
          } else {
            const t = await r.text().catch(() => '');
            out.generate = 'REFUSED ' + r.status + ' — ' + t.slice(0, 200);
          }
        }
      } else {
        out.generate = 'skipped — see the earlier rows';
      }
    } else {
      out.fnReachable = false;
      out.generate = 'skipped — no platform or no session';
    }

    // ---- verdict ----------------------------------------------------
    console.table(out);
    const audioOk = /^AUDIO/.test(String(out.generate || ''));
    console.log('%c' + (
      out.muted ? 'MUTED — the 🔊 button is off; unmute and Leo speaks. Nothing else is wrong.'
      : !out.hasVoiceId ? 'NO VOICE ID — ' + out.companion + ' has no voiceId in assets/registry.json.'
      : !out.session ? 'NO SESSION — the browser is not signed in to the platform; refresh the page.'
      : !out.fnReachable ? 'THE FUNCTION DID NOT ANSWER — voice-speak is not deployed or not reachable.'
      : !out.providerKeyConfigured ? 'NO PROVIDER KEY — set ELEVENLABS_API_KEY on the voice-speak function.'
      : audioOk ? 'THE VOICE PATH WORKS — audio came back. If Leo is still silent in Talk, it is timing or playback, not generation: say something and watch the console for [VihuVoice] lines.'
      : 'GENERATION FAILED — see the `generate` row: that text is the provider/function\'s own reason.'
    ), 'font-weight:bold;font-size:14px;color:' + (audioOk && !out.muted ? '#2a8' : '#c33'));
  } catch (e) {
    console.error('[voice] stopped:', e);
  }
})();
