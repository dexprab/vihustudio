# LOOK WHAT I MADE — Creation → Share / Print / Watch

The architecture of the Creation Share system. The product decision is
`CLAUDE.md` → Decision 52; this file is the detail behind it.

## The one primitive

Everything starts from **CreationShare** (`js/creationShare.js`):

```
CreationShare
├── creationId          the project record's id (internal only)
├── creationType        moment | sequence | story — INFERRED, never asked
├── title               the child's chosen name, or '' (never 'Untitled')
├── creatorName         from the record (stamped from the Magic Card)
├── pages[]             the record's own pages
└── vihuplanetEntry     the Ether deep link, ONLY for a published creation
```

Type inference (`typeOf`): more than one content page → **story**; one
page carrying two or more authored marks (stickers, artwork, extra
place content, words) → **sequence**; otherwise **moment**. Each type
speaks its own sentence (`says()`): *Look what I made · Look what
happened · Read my story*.

`snapshot(record, slides)` builds the **shareable payload** — the ONLY
thing that ever leaves the device:

```
{ v:1, type, title, creatorName,
  pages:[{image}],          reading-size JPEGs (ThumbnailEngine.generateRead, 1024px)
  watch:[{image, holdMs}],  the MAKING as frames (MagicReveal → fitToBudget → 640px)
  madeIn:'vihuplanet',
  ether? }                  the project id ONLY when publishedAt exists (already
                            the public deep link per Decision 9)
```

The watch frames are why no video ever needs to be stored or uploaded:
`MagicReveal.revealStages()` is a pure function of the final saved
page, so the making can be re-derived at share time and REPLAYED
wherever the snapshot travels — the hub's 🎬 Watch, the parent's
letter, the scanned card. Budget: ≤28 frames per share, 4–12 per page.

## The player (Sprint 1.1)

`js/creationPlayback.js` is the ONE way those frames are shown,
everywhere — it styles itself, so both documents share one copy of
everything. Pipeline: preload → stable stage → transition. Every frame
is `img.decode()`d before the first shows; the stage takes its aspect
from the first frame and is never torn down; frames advance by
crossfade between two stacked layers with the old frame whole
underneath, so no instant shows less than a complete frame (the
opening frame lands instantly — the reveal's own first stage is the
empty page). Music (corrected at 0708): `assets/audio/worlds/a.mp3` —
one of the owner-supplied World tracks, the product's actual MUSIC.
The first pick, harmony.mp3 (the films' quiet under-bed), is a
held-pitch drone and was reported as horror-movie music the moment it
played solo and foreground; the films keep it, quiet, under content.
One continuous looped track per replay, faded out after the finished
creation rests, stopped on destroy, clean restart on replay. Global mute (`vihu-audio-muted` /
`AudioManager.isMuted()`) is respected; where AudioManager exists the
Studio atmosphere ducks under the music (`duckFor`, released on stop);
a per-playback speaker on the stage mutes this playback only — and
its icon is driven by whether sound is ACTUALLY being made (1.1.1):
play()'s own success path alone says 🔊, so on a page where autoplay
was refused (the parent's landing) it says 🔇 honestly and the press
that follows starts the music with the gesture the browser was
waiting for. `onDone` is
always a macrotask — a one-frame making otherwise completes inside
`play()`'s own resolution and the caller paints over whatever onDone
put up (a real bug the suite caught).

## The child's surface

`js/lookWhatIMade.js` — the hub. Preview first, then four doors:
💌 Share with Parent · 📄 Print Foldable · 🃏 Print Story Card ·
🎬 Watch. No email/URL/PDF/QR vocabulary anywhere (the suite sweeps
for it); the single exception is the "Who should I send it to?" ask,
which reuses the Share Ceremony's own established wording for a
grown-up's address.

Entry points: the `#lookBtn` story action in the header (wakes/sleeps
on `refreshStoryActions` exactly like Play and Finish; held during
rites) and the ✨ Look nested action on My Projects cards (the 🗑
Delete pattern), which opens the record and then the hub. **The Finish
celebration is untouched** — Decision 12's two equal choices stand.

## The physical loops

- **Foldable** (`js/foldableComposer.js`) — the classic one-sheet
  eight-panel zine. The slit turns the 4×2 grid into one CYCLE of
  eight panels (`B4→T4→T3→T2→T1→B1→B2→B3`), reading order follows the
  cycle, top row prints rotated. The suite re-derives the cycle from
  the sheet's own adjacency (edges minus the slit) and checks every
  consecutive reading pair is physically joined — the composer's table
  cannot quietly disagree with paper. A story's foldable holds its
  first six pages (said visibly when longer); a moment/sequence
  foldable holds the MAKING with the finished creation last.
  **Sprint 1.1**: when the creation's share door can be minted, the
  sheet gives its right edge (`CARD_STRIP_W`) to a tear-off Story Card
  strip — front and back at their exact 750×1050 print size behind one
  straight ✂ cut, drawn by `StoryCardComposer.cells()` so the strip
  and the standalone card are ONE drawing; the zine keeps its own
  imposition in the remaining area (`zineW`), or the whole sheet when
  there is no door. `compose()` also returns the upright panel bitmaps
  in reading order (`panels`), which is what the hub's folded-book
  preview flips through. The hub's foldable view is three beats: the
  open sheet · **Fold it ✨** (a stylised fold gesture on the same
  bitmap; skipped under reduced motion) · the finished little book,
  tappable to turn its pages, with the card presented beside it and
  **How to fold it** (1.1.1) — five small pictures, few words. The
  open-sheet view also offers **☀️ Plain paper** (1.1.1): the whole
  sheet recomposed from `CreationShare.snapshot(record, slides,
  {plain:true})`, which renders CLONES of the pages carrying a white
  background override through the identical pipeline (the renderer's
  own seam — a page's `metadata.cardOverrides.background` wins over
  the World's wall tone, and chrome text re-picks dark ink itself).
  The plain filter runs before cloning, or the white override would
  make a blank page count as content. Preview-before-print holds
  through the toggle; the shared payload is never plain.
- **Story Card** (`js/storyCardComposer.js`) — 750×1050 (2.5×3.5in @
  300dpi), night-sky front with the creation, back with a QR carrying
  the share URL on a white quiet zone (the Data Matrix lab's first
  measured rule). QR encoder: vendored bwip-js (`js/vendor/`), loaded
  lazily only when a card composes. The lab's "do not integrate"
  verdict was about camouflaging a symbol into card art; a plain
  printed QR is the opposite case.
- **Printing** — the Magic Card's own proven mechanism: an offscreen
  print sheet, `img.decode()` before `window.print()`, a blanket
  `@media print` rule that exempts exactly the print sheets, and a
  per-print injected `@page` orientation so the foldable prints
  landscape without re-orienting the Magic Card's portrait printing.
  Preview and print use the SAME bitmaps, so they match by
  construction.

## The platform

- `supabase/migrations_creation_share.sql` — `creation_shares`
  (token · owner_id · identity_id · project_id · payload), RLS on
  with **no policies**; `creation_share_mint` (service_role only,
  idempotent per owner+project — ONE STABLE TOKEN per creation, so a
  printed card never dies; re-minting refreshes the snapshot) and
  `creation_share_resolve` (anon-callable, returns the payload and
  nothing else; unknown and malformed tokens answer identically).
  `supabase/verify_creation_share.sql` checks it in one word per row.
- `supabase/functions/creation-share/index.ts` — edgeAuth-gated
  (`creation-share` bucket, 20/hr), `makeHandler` testable idiom.
  POST `mint` sweeps the payload BY SHAPE (whitelist; an unknown key
  at any depth refuses the whole payload naming the key) and mints.
  POST `send` mints, resolves the recipient — a provided address wins
  for THIS delivery (the child's one-time "Send this to…" choice,
  Sprint 1.1), else the card's own `parent_email` (never asked again
  when on file). A first-given address is kept on the card only where
  none exists (`parent_email=is.null` guard) and never when the
  request carries `once:true` — an override is a destination, not an
  address to keep. The hub shows the saved address before Send in a
  DIRECTLY editable prefilled field (1.1.1 — no Edit button in the
  way); the saved address is never overwritten and stays the next
  share's default. The letter goes via Resend. GET `?cover=<token>` serves the creation's first page as an
  image for the letter (mail clients strip `data:` images), gated by
  the token itself. Deploy with `--no-verify-jwt` (the cover is
  fetched by `<img>` tags that cannot send headers); the session gate
  inside the file protects every POST.
- The letter: subject "«name» made something!", one cover image, text
  links (Watch · See · Print the foldable little book · Print the
  little card · WhatsApp · Instagram), both halves in the same order —
  the Decision 42 learnings applied, no campaign shapes. The print
  links are `&print=foldable` / `&print=card` switches on the landing
  (1.1.5): a parent prints both keepsakes from the letter alone,
  without the child's device.

## Deep entry

`look.html` — standalone, noindex, adult-facing (the
`family-photos.html` precedent). Resolves `?t=<token>` through the
anon REST RPC, renders "Look what «name» made" + the exact creation:
Watch replay, page-by-page reader, "Come see VihuPlanet" doorway, and
the Ether door when the creation is public there. `?watch=1` plays the
making first (the letter's WATCH button); `?share=1` is the
Instagram/onward route via the native share sheet; `?print=foldable` /
`?print=card` (1.1.5) land in a preview of the composed sheet-plus-
guide or card front-and-back, with 🖨 Print one press away — the SAME
`FoldableComposer` / `StoryCardComposer` the Studio hub uses, fed the
resolved snapshot, so there is one drawing of each thing on both
surfaces. The two print doors also stand on the landing for anyone who
arrives without a switch. An unknown token is one gentle sentence.
Never generic Home.

## Privacy contract

What travels is CONSTRUCTED, never trimmed: the sweep in the Edge
Function is the only door into `creation_shares`, and the resolve
function can only ever return what the sweep admitted. No memory, no
Stars, no card id, no session, no project id (the `ether` field is
public-by-construction), no conversation, no address. The token is 24
random hex chars minted server-side; nothing can list or count shares
from a browser.

## Disclosed limits

- **Instagram has no web prefill.** The letter's Instagram button
  opens the landing with its native share sheet, which includes
  Instagram on a phone. Recorded, not worked around.
- **Narration audio does not travel** with a share in v1. Pages and
  making frames only.
- **☀️ Plain paper is everywhere a print button is (1.2), and the
  plain PAGES travel where they can.** Plain pages are re-rendered
  from the live story through the renderer's background seam, which
  only the Studio has — so the hub now merges them into every
  uploaded payload as `pagesPlain`, and the landing's toggle prints
  the full plain sheet for shares that carry them. An older share, and
  the Ether (whose feed holds only baked pixels), still get the
  toggle: the composers' paper palette — everything the paper itself
  draws goes to ink, and the pages print as they were shared.
- **The exported Magic Creation video itself is not shared** — the
  watch replay is the same making, derived live. A parent who wants
  the mp4 gets it the way the child does: 📦 Take My Story.
- **A foldable holds six inner pages**; a longer story keeps its first
  six and the preview says so in the child's own words.
- **Not verified against the live Supabase project** from the build
  environment (its network policy refuses the host). The runbook is
  `supabase/DEPLOY_creation_share.md`; the suite proves the deployed
  artifact and the SQL is covered by `verify_creation_share.sql`.

## Files

`js/creationShare.js` · `js/creationShareClient.js` ·
`js/lookWhatIMade.js` · `js/foldableComposer.js` ·
`js/storyCardComposer.js` · `js/vendor/bwip-js-min.js` · `look.html` ·
`supabase/migrations_creation_share.sql` ·
`supabase/verify_creation_share.sql` ·
`supabase/functions/creation-share/index.ts` ·
`supabase/DEPLOY_creation_share.md` ·
`tools/look-share-test/run-look-share-tests.js`

## Sharing from the Ether (1.2)

A story met in the Ether can be sent onwards: the Preview's Share
action opens `js/etherShare.js` — an overlay on the living universe —
with three doors (💌 Send it to someone · 📄 Print a little book ·
🃏 Print a little card). The payload is assembled from what the Ether
already shows (the feed's page images, the story's name, its maker;
`ether: <projectId>`), so nothing private exists to leak and the
server's sweep refuses anything unexpected anyway. The printed QR is
the story's own public `?story=` deep link — no mint or upload is
needed to print — while the send door mints under the viewer's own
session, always `once:true` and never with an identityId, so sharing
somebody's story onwards stores nothing on anybody's card. The card's
QR is drawn at an integer multiple of bwip's modules with smoothing
off: a non-integer rescale decoded or not depending on the mask
pattern the content happened to produce (measured). Both keepsakes
carry the written address vihuplanet.com. Suite:
`tools/ether-share-test/`.
