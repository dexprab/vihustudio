# Discoverability Audit — VihuPlanet Public Surface

State of the public surface **before** the Discoverability & Entity Foundation
sprint (2026-08-21). This is the record of what a search engine, an AI crawler
or a link-unfurler found when it arrived at https://vihuplanet.com — kept so
the sprint's changes can be judged against what was actually there, not
against what anybody assumed was there.

## Hosting facts

- **Deployment**: GitHub Pages serving the repository root as static files.
- **Domain**: `vihuplanet.com` (the `CNAME` file at the root; that file is the
  single source of the domain).
- **Extensionless routes**: GitHub Pages serves `about.html` at `/about`, so
  clean entity routes need no routing changes.
- **No `.nojekyll`**: Pages runs the default Jekyll pass. None of the public
  files begin with `_`, so nothing is being swallowed; noted, not changed.

## What existed before this sprint

### `index.html` (VihuPlanet — the universe)

- `<title>VihuPlanet</title>` — the name alone, nothing about what it is.
- `lang="en"` on `<html>`. Charset and viewport metas present.
- Inline SVG favicon (the ✿ glyph, candle-warm) — a data URI, no icon file.
- **No** meta description. **No** canonical. **No** robots meta.
- **No** Open Graph tags of any kind. A shared link unfurled to nothing.
- **No** Twitter card tags.
- **No** JSON-LD / structured data.
- Three stylesheet links carrying `?v=0596` cache-busters (52 `v=`
  occurrences across the file including script tags).

### `studio.html` (VihuStudio — the Hall of Creation)

- `<title>VihuStudio · the Hall of Creation</title>`.
- **No** robots meta — an application page that was fully indexable, even
  though Decision 23's entry gate sends every direct visit back to
  VihuPlanet, so an indexed studio.html was a door that closes on arrival.
- No description, canonical, OG, Twitter, or structured data (correct for an
  application page — the gap was only the missing noindex).

### Site-wide files

| File | Before |
| --- | --- |
| `robots.txt` | **did not exist** — crawlers got a 404 and assumed allow-all with no sitemap reference |
| `sitemap.xml` | **did not exist** |
| `llms.txt` | **did not exist** |
| `manifest.json` / web app manifest | **does not exist** (not created by this sprint either — nothing installs VihuPlanet as an app today) |
| Any OG/social image | **does not exist** — `assets/brand/` holds only a README; `assets/icons/logo.png` is an empty placeholder file |

A repo-wide grep for `og:`, `application/ld+json` and `meta name="description"`
across every `.html` file returned **zero** matches: no page anywhere in the
product carried social metadata or structured data.

### Public routes (what a crawler could reach)

Crawlable and *meant* for people arriving from outside:

- `/` — VihuPlanet itself. The universe. The only real public page.

Reachable but application or internal, none carrying noindex before this
sprint:

- `/studio.html` — the Studio application (Decision 23 bounces direct loads
  home; it should never be in an index).
- `/vihuplanet/` — the legacy Hero chapter (pre-VP1 experience, retained).
- `/vihuplanet/ether/` — a deep-link shim that forwards `?story=` links to
  the root (Sprint VP1); renders blank without JavaScript.
- `/admin/` — the product owner's console.
- `/tools/*` — ten internal development tools (world builders, audio mixer,
  platform status, voice audition, …).
- `/official-worlds/`, `/themes/`, `/assets/`, `/supabase/` — data and asset
  directories.

### Index vs noindex candidates identified

- **INDEX**: `/` (never noindex the home — it is the product's front door),
  plus the public knowledge surface this sprint creates (`/about`).
- **NOINDEX or robots-disallowed**: `studio.html`, `/vihuplanet/` legacy
  Hero, `/vihuplanet/ether/` shim, `/admin/`, `/tools/`, `/supabase/`.
  Full policy: `docs/INDEXING_POLICY.md`.

### House files that do exist (recorded per audit instructions)

`AI_GUIDE.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `TASKS.md` and
`BACKLOG.md` all exist at the repository root. None of them is a public
web page and none is referenced by the public surface.

## Summary of the gap

VihuPlanet was invisible on purpose to nobody: there was simply no machine-
readable account of what it is. No description, no canonical, no entity
statement, no sitemap, no robots file, no crawlable page that says what
VihuPlanet, VihuStudio or My Garden are — and the one application page that
should be kept *out* of indexes carried nothing keeping it out. Everything
this sprint adds is additive head metadata and new public files; the visible
experience of `index.html` is bit-identical (verified by JS-disabled
pixel comparison at 1440×900).
