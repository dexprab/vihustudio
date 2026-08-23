# Indexing Policy — What Search Engines May Keep, and What They May Not

The rule in one sentence: **public knowledge is indexed; the application is
not.** A search engine's job here is to answer *"what is VihuPlanet?"* — it
is never a second door into the Studio, a child's projects, or a
development tool.

## INDEX — the public knowledge surface

| URL | What it is | How it's marked |
| --- | --- | --- |
| `https://vihuplanet.com/` | VihuPlanet itself — the universe, the one entrance | `index,follow,max-image-preview:large`; canonical to itself; in the sitemap. **The home is never noindexed, under any future change.** |
| `https://vihuplanet.com/about` | The written answer: every public entity, one page, anchored (`#vihustudio`, `#stories`, `#books`, `#characters`, `#worlds`, `#garden`, `#ether`) | `index,follow`; canonical to itself; in the sitemap |

One canonical URL per entity: VihuPlanet's is `/`; every other entity's is
its `/about` anchor. This sprint deliberately chose one anchored page over
seven thin ones (`/vihustudio`, `/stories`, …): the entities are chapters of
one explanation, GitHub Pages needs no routing for either shape, and a
single strong page is honest where seven near-empty ones would be an SEO
posture. If an entity ever grows enough real public content to deserve its
own page, it can be promoted then — with `/about` linking to it, keeping
one canonical URL.

## NOINDEX — application, runtime and internal surfaces

Marked with `<meta name="robots" content="noindex">` in the page itself:

- **`/studio.html`** — the Studio is an application, and Decision 23's
  entry gate sends every direct visit back to VihuPlanet anyway; an indexed
  Studio is a door that closes on arrival. (Verified: the meta tag sits
  above the entry-gate script and changes nothing about it.)
- **`/vihuplanet/`** — the legacy Hero chapter, retained but no longer the
  entrance; a second page titled "VihuPlanet" would compete with the real
  one.
- **`/vihuplanet/ether/`** — a deep-link forwarding shim; renders nothing
  without JavaScript.
- **`/family-photos.html`** — the page a parent reaches from the Magic Card
  letter to hand over a family photo album (Decision 14). `noindex,nofollow`:
  it is reached by a letter, never found, and it does nothing at all without
  the link that letter carries. It is parent-facing rather than admin, so it
  is meta-tagged like the other application pages rather than living under
  `/admin/`.

Blocked from crawling entirely in `robots.txt` (they are internal, and
there are too many to meta-tag individually):

- **`/admin/`** — the product owner's console.
- **`/tools/`** — development tools (world builders, audio mixer, platform
  status, voice audition, garden tests, …).
- **`/supabase/`** — platform functions and migrations source.

Not addressable as pages at all, so no marking needed: creator state,
Builder internals, editor state, per-child content (IndexedDB /
platform-side, never a public URL), temporary states and debug panels.

## Sitemap rules

`sitemap.xml` contains **only** absolute canonical public URLs — today
exactly two. Never: application pages, `/vihuplanet/` internals, tool
pages, query-string URLs (`?story=`, `?born=`, `?author=`), or anything
noindexed. A URL enters the sitemap only when it also enters the INDEX
table above.

## robots.txt rules

- Normal crawling is allowed for every agent; **Googlebot is never given a
  special rule and never blocked.**
- `OAI-SearchBot` is explicitly allowed (OpenAI's search crawler).
- **`GPTBot` is blocked** (`Disallow: /`) — decided by the product owner
  after the sprint shipped. VihuPlanet's content is not model-training
  material. This costs nothing in search or ChatGPT-search visibility:
  `OAI-SearchBot`, which powers ChatGPT's search and citations, remains
  explicitly allowed.
- The sitemap is referenced absolutely: `https://vihuplanet.com/sitemap.xml`.

## Standing rules for future pages

1. A new public knowledge page gets: exactly one `<title>`, one canonical,
   one meta description, OG tags without duplicates, entry in
   `sitemap.xml`, and language from `docs/VIHUPLANET_ENTITY_CANON.md`.
2. A new application page gets `noindex` from its first commit.
3. Nothing child-private is ever given a public URL, so nothing
   child-private ever needs an indexing decision.
