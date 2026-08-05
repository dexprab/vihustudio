// ============================================================================
// family-album — DASHBOARD-PASTE VARIANT (single file)
// ============================================================================
// This is index.ts + parse.js merged into ONE file, for deploying via the
// Supabase Dashboard's in-browser editor (no CLI needed):
//
//   Dashboard → Edge Functions → Deploy a new function → Via Editor
//   → name it exactly:  family-album
//   → replace the template with this entire file → Deploy
//   (leave "Verify JWT" at its default ON — callers send the anon key)
//
// KEEP IN LOCKSTEP: index.ts + parse.js in this folder are the canonical
// source; any change there must be mirrored here by hand (same discipline
// as this repo's twin rendering engines). Behaviour is identical.
// ============================================================================

import JSON5 from 'npm:json5@2.2.3';

// ---------------------------------------------------------------------------
// parse.js (inlined) — see that file for full commentary. Short version:
// a public shared-album page embeds its photo list in AF_initDataCallback
// blocks; extraction ported from the daily-CI-proven approach of
// yumetodo/google-photos-album-image-url-fetch. If Google reshuffles the
// page format, this section is the entire breakage surface.
// ---------------------------------------------------------------------------

function extractInitData(html: string): string | null {
  if (typeof html !== 'string' || !html) return null;
  const re = /(?<=AF_initDataCallback\()(?=.*data)(\{[\s\S]*?)(\);<\/script>)/g;
  let best = '';
  for (const m of html.matchAll(re)) {
    if (m[1].length > best.length) best = m[1];
  }
  return best || null;
}

interface AlbumPhoto {
  uid: string;
  url: string;
  width: number;
  height: number;
  imageUpdateDate: number;
  albumAddDate: number;
}

function parseAlbumData(parsed: unknown): AlbumPhoto[] | null {
  if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) return null;
  const d = (parsed as { data: unknown }).data;
  if (!Array.isArray(d) || d.length < 2) return null;
  const arr = d[1];
  if (!Array.isArray(arr)) return null;
  const out: AlbumPhoto[] = [];
  for (const e of arr) {
    if (!Array.isArray(e) || e.length < 6) continue;
    const uid = e[0];
    const detail = e[1];
    const imageUpdateDate = e[2];
    const albumAddDate = e[5];
    if (typeof uid !== 'string' || !Array.isArray(detail) || detail.length < 3) continue;
    const url = detail[0];
    const width = detail[1];
    const height = detail[2];
    if (typeof url !== 'string' || typeof width !== 'number' || typeof height !== 'number') continue;
    if (typeof imageUpdateDate !== 'number' || typeof albumAddDate !== 'number') continue;
    out.push({ uid, url, width, height, imageUpdateDate, albumAddDate });
  }
  return out;
}

// ---------------------------------------------------------------------------
// index.ts (inlined) — LIST mode (?url= / POST {albumUrl}) + image byte-proxy
// fallback (?img=). Host-validated on both modes; never an open proxy.
// Expected failures return 200 {ok:false, error} (themeRepositoryClient's
// own convention); only malformed requests get 4xx.
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
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
