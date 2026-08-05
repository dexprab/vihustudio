// Family Album — shared-album page parser (pure, dependency-free ESM).
//
// A public Google Photos shared album page embeds its photo list inline in
// the HTML inside AF_initDataCallback({...}) script blocks — no JS rendering
// is needed to read it. This module extracts and walks that structure.
//
// The extraction algorithm is a port of the approach proven by
// yumetodo/google-photos-album-image-url-fetch, a library that has run a
// daily automated validity check against a live shared album for years —
// i.e. this exact page format has been stable long-term. If Google ever
// reshuffles the album page markup, THIS FILE (plus the JSON5 step in
// index.ts) is the entire breakage surface — nothing in Studio knows or
// cares where the photo list came from.
//
// Kept as plain .js (not .ts) deliberately so the same file runs unmodified
// in BOTH the Deno Edge Function (index.ts imports it) and a Node unit test
// (this sandbox cannot reach any Google host, so the parser is verified
// against a realistic fixture in Node; the live page is verified by the
// project owner via tools/family-album-test/).

/**
 * Phase 1: pull the raw JS-object-literal text out of the largest
 * AF_initDataCallback({...}) block that mentions `data`.
 * Returns null when no candidate block exists.
 *
 * The regex is kept verbatim from the reference library — it is the part
 * with years of daily-CI proof behind it.
 */
export function extractInitData(html) {
  if (typeof html !== 'string' || !html) return null;
  const re = /(?<=AF_initDataCallback\()(?=.*data)(\{[\s\S]*?)(\);<\/script>)/g;
  let best = '';
  for (const m of html.matchAll(re)) {
    if (m[1].length > best.length) best = m[1];
  }
  return best || null;
}

/**
 * Phase 3: walk the loose-parsed object into a clean photo list.
 * (Phase 2 — loose-JSON parsing of the object literal — happens in the
 * caller, since it needs a JSON5 parser and this module stays dependency-free.)
 *
 * Shape of each media entry inside parsed.data[1]:
 *   e[0]              stable media uid (string)
 *   e[1]              [baseUrl, width, height]
 *   e[2]              image update date (ms epoch)
 *   e[5]              album add date (ms epoch)
 *
 * The returned `url` is an lh3.googleusercontent.com BASE url — append a
 * sizing suffix before use: '=w300-h300' (thumbnail), '=w2048-h2048' (full
 * pick). Google's CDN does the resizing.
 *
 * Returns null when the structure doesn't match (a signal the page format
 * changed); malformed individual entries are skipped, never fatal.
 */
export function parseAlbumData(parsed) {
  if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) return null;
  const d = parsed.data;
  if (!Array.isArray(d) || d.length < 2) return null;
  const arr = d[1];
  if (!Array.isArray(arr)) return null;
  const out = [];
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
