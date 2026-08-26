// Family Album Edge Function — VihuStudio's server-side reader for public
// Google Photos shared albums (the "Family Photos" feature).
//
// Why this exists at all: Google Photos has no official no-sign-in API, and
// the browser can't fetch the public album page directly (CORS). This
// function does the two things the client can't:
//
//   1. LIST (default): GET ?url=<shared album link>  (or POST {albumUrl})
//      Fetches the public album page server-side, extracts the inline photo
//      list (see ./parse.js for the proven extraction algorithm), and
//      returns clean JSON: { ok, count, photos: [{ uid, url, width, height,
//      imageUpdateDate, albumAddDate }] }. Each `url` is an
//      lh3.googleusercontent.com BASE url — the client appends a sizing
//      suffix ('=w300-h300' thumbnails, '=w2048-h2048' full picks).
//
//   2. IMAGE PROXY (fallback): GET ?img=<googleusercontent url>
//      Streams the image bytes back with CORS headers — used only if direct
//      lh3 loads turn out to taint the canvas in the client (the go/no-go
//      test page, tools/family-album-test/, answers that question). One
//      image per pick at most — never a browsing-time cost.
//
// This is deliberately NOT an open proxy: album fetches are restricted to
// Google Photos hosts, image fetches to *.googleusercontent.com.
//
// Failure convention mirrors js/themeRepositoryClient.js: expected failures
// come back as 200 { ok:false, error:'<reason>' } so the client always gets
// a readable, non-throwing answer; only malformed requests get 4xx.
//
// Deploy (from the repo root, one-time Supabase CLI setup assumed):
//   supabase functions deploy family-album --project-ref <your-project-ref>
// Callers send their own Supabase SESSION as Authorization and the anon
// key as `apikey` (the gateway routes on it and it authorises nothing).
// This note used to say the anon key was the credential "which satisfies
// the default verify_jwt gate" — an accurate description of a gate that
// let anybody through, since that key is public. See Decision 30.

import JSON5 from 'npm:json5@2.2.3';
import { extractInitData, parseAlbumData } from './parse.js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// A real browser UA — Google serves the plain inline-data page shape this
// parser expects to ordinary browsers.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const ALBUM_HOSTS = ['photos.app.goo.gl', 'photos.google.com'];

function isAllowedAlbumUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALBUM_HOSTS.includes(u.hostname);
  } catch (_e) {
    return false;
  }
}

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'googleusercontent.com' || u.hostname.endsWith('.googleusercontent.com'))
    );
  } catch (_e) {
    return false;
  }
}

// Sprint 1A, CLAUDE.md -> Decision 30. The deploy note above says this
// function "authenticate[s] with the project's anon key ... which
// satisfies the default verify_jwt gate" — which was an accurate
// description of a gate that let anybody through, since that key is
// public. This is an outbound fetcher and an image proxy on our own
// name, so it now asks who is calling and bounds how often.
import { guard, restDb } from './edgeAuth.js';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const pass = await guard(req, {
    env: { supabaseUrl: SUPA_URL, anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '', serviceKey: SERVICE },
    require: 'user',
    bucket: 'family-album',
    db: restDb(SUPA_URL, SERVICE),
    envGet: (n: string) => Deno.env.get(n) || '',
  });
  if (!pass.ok) return json(pass.body, pass.status);

  try {
    const u = new URL(req.url);

    // ---- mode 2: image byte proxy (CORS fallback only) ----
    const img = u.searchParams.get('img');
    if (img) {
      if (!isAllowedImageUrl(img)) return json({ ok: false, error: 'bad_image_host' }, 400);
      const upstream = await fetch(img, { headers: { 'User-Agent': UA } });
      if (!upstream.ok || !upstream.body) {
        return json({ ok: false, error: 'image_fetch_failed', status: upstream.status });
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // ---- mode 1: album listing ----
    let albumUrl = u.searchParams.get('url') || '';
    if (!albumUrl && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      albumUrl = (body && typeof body.albumUrl === 'string' && body.albumUrl) || '';
    }
    if (!isAllowedAlbumUrl(albumUrl)) return json({ ok: false, error: 'bad_album_url' }, 400);

    const res = await fetch(albumUrl, { redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!res.ok) return json({ ok: false, error: 'album_fetch_failed', status: res.status });
    const html = await res.text();

    const raw = extractInitData(html);
    if (!raw) return json({ ok: false, error: 'parse_failed_phase1' });

    let parsed: unknown;
    try {
      parsed = JSON5.parse(raw);
    } catch (_e) {
      return json({ ok: false, error: 'parse_failed_phase2' });
    }

    const photos = parseAlbumData(parsed);
    if (photos === null) return json({ ok: false, error: 'parse_failed_phase3' });

    return json({ ok: true, count: photos.length, photos });
  } catch (e) {
    return json({ ok: false, error: 'unexpected: ' + ((e as Error)?.message || String(e)) });
  }
});
