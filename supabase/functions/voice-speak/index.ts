// voice-speak — the only place in VihuPlanet that knows ElevenLabs exists.
//
// Sprint: Vihu Voice Foundation. The child-facing runtime asks for
// "this character, these words" and gets audio back; it never sees a
// provider, a voice id, a model or a key.
//
// ---------------------------------------------------------------
// WHY THIS FUNCTION EXISTS AT ALL
//
// The ElevenLabs key must never reach a browser — their own docs say so
// and it is the sprint's one non-negotiable. VihuPlanet is a static site
// with no server of its own, so the boundary is a Supabase Edge
// Function, which is the boundary this project already uses for
// sky-protection and creator-born. Nothing new was invented for it.
//
// The client sends: { characterId, voiceId, modelId, settings, text }.
//
// It sends the voiceId rather than the key because the voiceId is not a
// secret — it is content, it lives in assets/registry.json, and keeping
// the resolution client-side is what lets a voice be changed without
// redeploying this function. The KEY is the secret, and it only ever
// lives here.
//
// ---------------------------------------------------------------
// CACHING
//
// VihuPlanet's dialogue is mostly static, so regenerating it is paying
// twice for the same sound. The cache key is the whole request — voice,
// model, settings and text — so changing any of them is a different
// sound and correctly misses. Stored in Supabase Storage, which this
// project already has; no asset pipeline was built for this.
//
// Deploy:
//   supabase functions deploy voice-speak
// Secrets (Edge Functions -> voice-speak -> Secrets):
//   ELEVENLABS_API_KEY   required
//   VOICE_CACHE_BUCKET   optional, defaults to 'voice-cache'
//
// Leave JWT verification ON. This spends money per call, so an
// unauthenticated one is somebody else's bill.

const BUILD = '2026-08-18 · vihu voice · models probe';
const TTS_ROOT = 'https://api.elevenlabs.io/v1/text-to-speech';
const MAX_CHARS = 600; // a spoken line, not a chapter

function env(n: string) { return (Deno.env.get(n) || '').trim(); }

// EVERY header a caller actually sends must be listed here, or the
// browser refuses the request before it is made and the caller sees
// "TypeError: Failed to fetch" with no further detail.
//
// This bit me: the first version listed only authorization and
// content-type, while js/vihuVoice.js and the audition page both send
// `apikey` as well — so the preflight was refused and NOTHING worked,
// not merely the status ping. The two functions in this project that
// already work from a browser (sky-protection, family-album) both list
// the full set, and this now matches them exactly rather than being
// trimmed to what looked sufficient.
//
// It is also why a mocked test suite cannot catch this class of bug:
// intercepting the request in the test harness bypasses CORS entirely,
// so 84 passing checks said nothing about whether a real browser would
// allow the call.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// The cache key is the entire request. Anything that would change the
// sound changes the key, so a re-tuned voice is never served the old
// take out of the cache.
async function cacheKey(p: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify({
    v: p.voiceId, m: p.modelId, s: p.settings ?? null, t: p.text,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function storage(path: string, method: 'GET' | 'POST', body?: Uint8Array) {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = env('VOICE_CACHE_BUCKET') || 'voice-cache';
  if (!url || !key) return null;
  return await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' } : {}),
    },
    body,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method === 'GET') {
    // ?models=1 — WHICH MODELS DOES THIS ACCOUNT ACTUALLY HAVE?
    //
    // Added after a real dead end: emotion was not audible, and the
    // candidate explanations were "the model id is wrong", "this account
    // cannot use that model" and "the tags are wrong" — three different
    // problems that all present as "sounds the same", and all of which
    // were being answered from memory rather than from fact.
    //
    // The provider knows. Asking it is one request, and it ends the
    // guessing: the ids returned here are the only ids worth putting in
    // assets/registry.json. It returns model metadata and no
    // credential — the key stays here, as always.
    const apiKey0 = env('ELEVENLABS_API_KEY');
    if (new URL(req.url).searchParams.has('models')) {
      if (!apiKey0) return json({ ok: false, reason: 'not-configured' }, 200);
      try {
        const r = await fetch('https://api.elevenlabs.io/v1/models', {
          headers: { 'xi-api-key': apiKey0 },
        });
        const body = await r.json();
        if (!r.ok) return json({ ok: false, reason: 'provider', status: r.status, detail: body }, 200);
        return json({
          ok: true,
          models: (Array.isArray(body) ? body : []).map((m: Record<string, unknown>) => ({
            model_id: m.model_id,
            name: m.name,
            tts: m.can_do_text_to_speech,
            // The provider's own answer to "what settings does this
            // model take", which is exactly what we were guessing at.
            style: m.can_use_style,
            speaker_boost: m.can_use_speaker_boost,
          })),
        });
      } catch (e) {
        return json({ ok: false, reason: 'unreachable', detail: String(e).slice(0, 200) }, 200);
      }
    }

    return json({
      ok: true,
      build: BUILD,
      configured: !!apiKey0,
      cache: env('VOICE_CACHE_BUCKET') || 'voice-cache',
    });
  }

  let p: Record<string, unknown> = {};
  try { p = await req.json(); } catch (_e) { /* handled below */ }

  const text = String(p.text || '').trim();
  const voiceId = String(p.voiceId || '').trim();
  const modelId = String(p.modelId || 'eleven_turbo_v2_5').trim();

  // A character with no voice yet is a real, expected state — the voice
  // ids are filled in by hand once they are chosen in ElevenLabs. It is
  // not an error and must never read as one: the caller falls silent and
  // the child's experience carries on (sprint §13).
  if (!text || !voiceId) return json({ ok: false, reason: 'no-voice' }, 200);
  if (text.length > MAX_CHARS) return json({ ok: false, reason: 'too-long' }, 200);

  const key = await cacheKey({ ...p, text, voiceId, modelId });
  const path = `${key}.mp3`;

  // Cached already? Serve it and never call the provider.
  const hit = await storage(path, 'GET');
  if (hit && hit.ok) {
    return new Response(await hit.arrayBuffer(), {
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Vihu-Voice': 'cache' },
    });
  }

  const apiKey = env('ELEVENLABS_API_KEY');
  if (!apiKey) return json({ ok: false, reason: 'not-configured' }, 200);

  const settings = (p.settings && typeof p.settings === 'object') ? p.settings : {};
  const res = await fetch(`${TTS_ROOT}/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: settings }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.error('elevenlabs', res.status, body);
    // `detail` is for whoever is fixing it, and NEVER for a child: no
    // caller in the product renders it, js/vihuVoice.js writes it to the
    // console, and the audition room shows it. Without it a refused
    // request is indistinguishable from every other kind of quiet, which
    // made moving between model families pure guesswork — the models
    // take different settings, and "silence" was the only symptom of
    // getting that wrong.
    //
    // It cannot leak the key: this is the provider's own error body, and
    // a provider does not echo credentials back. Truncated regardless.
    return json({ ok: false, reason: 'provider', status: res.status, detail: body }, 200);
  }

  const audio = new Uint8Array(await res.arrayBuffer());
  // Fire-and-forget: a cache write failing costs a regeneration later,
  // never this line of speech.
  storage(path, 'POST', audio).catch(() => {});

  return new Response(audio, {
    headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Vihu-Voice': 'fresh' },
  });
});
