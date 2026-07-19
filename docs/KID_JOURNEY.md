# The Kid's Journey — First Screen to Publishing, Visitor and Creator

**Status:** Canonical. A living reference doc, not a sprint note — update it screen
by screen as the product changes, per the process at the bottom of this file.
**Scope:** Every screen a child actually sees in Creator, from the very first
tap through publishing a finished story — with real screenshots, not
wireframes, captured by driving the live app. Told twice where the product
genuinely forks: once as a **Visitor** (never claims a Magic Card), once as a
**Creator** (claims one). Everywhere else, the journey is identical for both,
and this doc says so rather than duplicating screenshots that would be
pixel-identical.

This doc supersedes nothing — it sits alongside `docs/STUDIO_CREATION_JOURNEY_V1.md`
(the original Screen1→Publish stage contract, still correct at the product-behaviour
level) and `docs/WORLD_CARD_PLATFORM.md` (the Magic Card / World Card technical
reference). This is the one place both are shown together, in order, as a real
child would actually experience them.

**A note on the screenshots' content:** Studio ships with zero built-in Worlds
today (Repository-only — see `js/themeRegistry.js`'s own disclosure). These
screenshots were captured against two small demo Worlds seeded directly into
`localStorage` for the purpose of this walkthrough (a "Storybook Classic"-shaped
Story World, a "Museum Gallery"-shaped Artwork World) — real product code,
synthetic content. Every screen, button, and flow shown is exactly what a real
family sees; only the specific World names/art are stand-ins.

---

## Who's a Visitor, who's a Creator?

There is no sign-in, sign-up, email, or password anywhere in Creator. The
**only** identity distinction the product makes is whether a child has ever
tapped **Claim It** on their own Magic Card:

- **Visitor** — hasn't claimed a card yet (or has actively said "not now").
  Everything works. Nothing is held back. Their project lives safely in this
  browser's local storage, same as it always has.
- **Creator** — has claimed a Magic Card. Gets a small header badge, a
  "Magic Card Home" screen, is greeted by name on the next reboot, and — as of
  Magic Card Phase 2 — their identity and projects quietly back up to the
  cloud so their card can call their work home on a different device.

A Magic Card is never offered during onboarding or from a settings menu — it
**awakens** the moment a child completes their first Publish, and the child
decides whether to claim it. See §7 below.

---

## Stage 1 — Screen 1: What Shall We Create Today?

The very first thing every child sees, Visitor or Creator, on a fresh boot
with nothing in progress.

![Screen 1 — Choose What To Create](journey/01-screen1-choose-what-to-create.png)

Six Creation Type cards (Tell a Story / Showcase My Artwork / Create Quotes /
Write a Poem / Make a Greeting Card / More Ideas) over the illustrated Story
Meadow scene, each rising into place with its own small stagger on arrival
and reacting to a tap or hover rather than sitting static. The "?" top-right
is a real, tap-to-open popover (not a hover-only tooltip, which never fires
on a touch device) with a one-line orientation. Two option cards — grouped
under one "Already have something?" heading, each with its own icon circle
and accent tint — sit at the bottom for a **returning** Visitor or Creator on
a **new device** with nothing local yet: "Have a World Card? Redeem it here" (a
World Card — someone shared a World with them) and "My Magic Card? Tap to
come home" (their own identity/projects, recalled from the cloud). Both are
covered in §9.

A child with existing local projects also sees a "📂 My Projects `<count>`"
pill here — covered in §8, since it only appears once a project actually
exists.

---

## Stage 2 — Screen 2: Choose Your Creative World

Tapping a Creation Type card moves to Screen 2 — pick a World, then a page
style ("Representation") to begin with.

![Screen 2 — a richer Artwork World with a Representation carousel](journey/02-screen2-artwork-world-carousel.png)

Left column: **Vihu Worlds** (official) and **World Library** (imported/
published-by-others) as two horizontally-scrolling rows. Right column: the
selected World's identity plus a **swipe carousel** of its own Representations
— this World has three (Showcase / Portrait / Quote), each its own real
rendered preview. "Start Creating →" always acts on whichever slide is
currently centred, however it got there — no separate select-then-confirm
step.

![Screen 2 — a simpler Story World with no Representations](journey/03-screen2-story-world-selected.png)

A World with no Representations of its own (most Story Worlds) still shows
one real preview slide — never a dead carousel — and "Start Creating →"
proceeds with no representation override, exactly as if the World had never
had the concept at all.

---

## Stage 3 — Workspace: Personalize (default view)

"Start Creating" lands directly in the editor. Nothing is selected yet, so
the right panel shows **Personalize** — Rule 4 of Creator's five Governing
Rules (see CLAUDE.md's "Creator Governing Rules"): the tools for adding a new
personal layer or changing the page itself.

![Workspace — default Personalize view](journey/04-workspace-default-personalize.png)

Header: World name, Open/Save As, dark-mode toggle, Publish. Left: page strip
(one page so far). Center: the live canvas — this World has a Place ("Tap to
add your artwork") the child hasn't filled yet. Bottom: the **Object Strip**,
a horizontally-scrolling read-out of every object on the page, green-dot
editable vs. lock-badge part-of-the-World. Right: Personalize, collapsed to
its two always-available actions — **+ Add Something** and **Background
Colour**.

---

## Stage 4 — Workspace: Add Something

Tapping **+ Add Something** expands a small grid of what a child can add to
this page — themselves, not the World.

![Workspace — Add Something accordion open](journey/05-workspace-add-something-open.png)

Emojis (stickers/decorations/shapes, one combined shelf), Shapes (real vector
geometry — outline or filled), and Text are live capabilities today; Note,
Doodle, and Voice are honestly labelled "Soon" rather than faked.

---

## Stage 5 — Workspace: Refine (an object selected)

The moment something real is added — or any existing object is tapped —
Personalize collapses to a quiet strip and **Refine** (Rule 3) takes the room
it gave up: whatever controls that specific object actually supports.

![Workspace — Refine panel for a selected sticker](journey/06-workspace-object-selected-refine.png)

A real sticker, just inserted and auto-selected: Size, Spin, See-Through,
Flip, and — because every sticker in the whole 500+ catalog supports it —
**Colour This** (Inside / Shade / Outline), the Auto Duotone recolour system.
The Object Strip now shows a third card for it; the small "🔒 Back" strip
above Refine reopens Personalize without losing this selection.

---

## Stage 6 — Publish: Read My Story

Tapping **Publish** in the header opens Publish Studio's first stage — a
quiet, real preview of the finished book, exactly as the canvas rendered it
(Governing Rule 5: Publish honours the runtime view of the center pane, never
a second reconstruction).

![Publish — Read My Story](journey/07-publish-read-my-story.png)

---

## Stage 7 — Publish: Almost Ready

![Publish — Almost Ready](journey/08-publish-almost-ready.png)

A friendly readiness check — a 🎉 badge when the book looks genuinely
finished, gentle nudges otherwise, never a hard block.

---

## Stage 8 — Publish: Choose Story Destination

![Publish — Choose Story Destination](journey/09-publish-choose-destination.png)

Story Adventure (read/save/print), Story Carousel (Instagram-ready PNGs),
Story Reel (Coming Soon, plug-in ready). Picking one reveals its own format
options before Continue unlocks.

![Publish — a destination and format picked](journey/10-publish-destination-format-picked.png)

---

## Stage 9 — Publish: Publishing

![Publish — encoding in progress](journey/11-publish-publishing-progress.png)

Every page is rendered and encoded for real, right here — not simulated.
This is also the exact moment, on a child's **first ever** publish, that a
new thing happens next: **the Awakening**.

---

## Stage 10 — The Awakening (where Visitor and Creator fork)

The instant the first real Publish completes, before the usual Celebration
screen, a Magic Card wakes up.

![The Awakening — a sky forming](journey/12-awakening-reveal.png)

A real constellation is generated and drawn star by star, unhurried. Once
it settles: **"It's yours, if you'd like it."** Tapping through reveals the
actual choice — this is the one screen where a child decides which role they'll be.

![The Awakening — Claim It / Maybe Later / Just Exploring for Now](journey/13-awakening-claim-choice.png)

- **Claim It** → becomes a **Creator** (§10a below).
- **Maybe Later** or **Just Exploring for Now** → stays a **Visitor** (§10b
  below) — both decline identically; the only difference is tone, and neither
  is ever asked again (`MagicCard.shouldOfferAwakening()` fires at most once
  per browser).

---

### Stage 10a — Creator path: claiming the card

Tapping **Claim It** asks for a nickname, then shows the card exactly as it
will always look from now on — real, two-sided, downloadable, printable —
before continuing.

![The Awakening — nickname prompt](journey/14-awakening-nickname-prompt.png)

![The Awakening — First Claimed Moment, front and back](journey/15-awakening-first-claimed-moment.png)

**Front** is the child's own identity card (nickname, "Creator since…", a
quiet decorative starfield — never the real tappable pattern). **Back** is
the real, permanent constellation — the literal credential a future device
would need to call this identity home — shown here in full because this is
the one legitimate "save it now" moment, same as a 2FA app showing backup
codes once at generation time. Download Front, Download Back, and Print all
work right here.

Continuing hands off into the ordinary Celebration screen the child would
have reached anyway:

![Publish — Celebration, now as a Creator](journey/16-publish-celebration-creator.png)

From here on, a small badge — that same, real constellation's *decorative*
stand-in, never the real pattern — sits permanently in the header:

![Workspace header — the Magic Card badge](journey/17-workspace-header-badge.png)

Tapping it opens **Magic Card Home**, which leads with the identity card
itself (Back face reveal-gated by default — see CLAUDE.md's "Magic Card Home
— One Constellation, Not Two" for why this screen doesn't *also* show a
separate ambient sky above the card, which used to be a real, reported bug):

![Magic Card Home — leads with the reveal-gated card](journey/18-magic-card-home-leading-card.png)

![Magic Card Home — Back face revealed on tap](journey/19-magic-card-home-revealed.png)

Below the card: the child's nickname, "Creator since…", and a small strip of
their own recent stories.

---

### Stage 10b — Visitor path: staying a Visitor

Tapping **Maybe Later** or **Just Exploring for Now** skips straight to the
same Celebration screen — visually and functionally identical to the Creator
one, because it is the same screen:

![Publish — Celebration, as a Visitor (no card claimed)](journey/24-publish-celebration-visitor.png)

Nothing else about this session changed. No badge, no card, no cloud sync —
this browser's project is exactly as local and exactly as safe as it always
was. Reboot and it's obvious nothing was held back:

![Reboot as a Visitor — no Identity Gate, no header badge](journey/25-visitor-reboot-no-gate-no-badge.png)

Straight back to the ordinary "Restore Previous Project?" prompt this app has
always shown — no Magic Card screen ever intercepts it.

---

## Stage 11 — My Projects (both roles, works identically)

Reachable from Screen 1 the moment any real local project exists — Visitor
or Creator alike, since `CreatorProjectStore` is `localStorage`-based and
has nothing to do with whether a Magic Card is claimed.

![Screen 1 — the My Projects pill](journey/20-screen1-my-projects-entry.png)

![My Projects — pick up any local project directly](journey/21-screen1-my-projects-grid.png)

A grid of every project this browser knows about — thumbnail, name, "Edited
X ago" — tapping one opens it directly, bypassing Screen 1/2 entirely.

---

## Stage 12 — Reboot as a returning Creator: the Identity Gate

A Creator's *next* reboot (any session after the one they claimed on) is the
one place their journey diverges structurally from a Visitor's.

![Reboot — Welcome back, by name](journey/22-identity-gate-welcome-back.png)

Shown automatically, before Screen 1 — "Continue My Journey" proceeds into
whatever boot would normally happen next (the restore prompt, or Screen 1 on
a truly fresh project). "Not you?" opens a picker, for a shared family device
with more than one claimed card:

![Reboot — Shared Device picker, two children's cards](journey/23-identity-gate-shared-device-picker.png)

One tile per claimed card (each showing its own decorative sky, never the
real pattern), plus **🌱 Begin Exploring** (proceed as a plain Visitor for
this session, no claiming) and **✨ Recall a different card** (a real,
different identity, cloud-recalled onto *this* device via its own tap-the-
stars or typed-code flow — the same widget Screen 1's own "Already have a
Magic Card?" toggle opens, per §9 below).

---

## Stage 13 — Coming home to a different device (either role)

Two quiet, collapsed entry points on Screen 1 (visible in the Stage 1
screenshot above) exist specifically for a **fresh device with nothing local
yet** — the actual "second device" case neither role's screens above cover:

- **"🔮 Have a World Card? Redeem it here"** — a World Card someone shared: tap the
  same star pattern printed on that physical/shared card to unlock its World
  in this device's World Library. Nothing to do with identity.
- **"✨ My Magic Card? Tap to come home"** — a Creator's *own*
  identity, recalled: tap their own card's real pattern (or type its
  human-readable code) and `recall_magic_card()` adopts their identity plus a
  fresh, independent copy of every cloud-backed project onto this device —
  never overwriting the original device's own copy.

Both reuse the exact same tap-the-stars grid mechanic (`js/creationFlow.js`'s
`_cardBuildGrid`/`_cardRedrawLiveLines`), just pointed at two different
backends — a World Card unlocks a *World*, a Magic Card recalls an *identity*.
See `docs/WORLD_CARD_PLATFORM.md` §6.2 for why these are deliberately two
separate systems, not one.

---

## How to update this doc, screen by screen

Every screenshot above is produced by one real script, checked into this
folder alongside the images it produces:

- `docs/journey/capture_screenshots.js` — the walkthrough itself (both
  role branches, in order, with the exact selectors/waits needed to reach
  each screen for real).
- `docs/journey/harness.js` — the shared local-server + demo-World-seeding
  harness it depends on (the same one this repo's other Creator UI Playwright
  suites already use).

To refresh a screenshot after a real product change, edit the relevant `shot(...)`
step in `capture_screenshots.js` (add a new one the same way if a new screen
needs covering), then run it with Playwright available on `NODE_PATH`:

```bash
NODE_PATH=/opt/node22/lib/node_modules node docs/journey/capture_screenshots.js
```

It regenerates every numbered PNG in `docs/journey/` in one pass. Keep the
filenames' leading numbers in sync with this document's own image references
if you insert or remove a step — the script and this doc are meant to be
edited together, not independently.
