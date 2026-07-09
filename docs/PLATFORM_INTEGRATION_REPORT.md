# Platform Integration Sprint Report — Builder → Studio

Repository: `dexprab/vihustudio`. This report accompanies the Platform
Integration Sprint — a **proof** sprint, not a feature sprint, per its own
explicit instruction: "the objective is not to build more. The objective is
to prove the platform." No product code was changed. The pipeline already
worked; this sprint exercised it for real, end to end, with no mocks and no
manual file copying, and records what was found.

## What was proven

A single, continuous Playwright session — one browser, two pages sharing one
origin's `localStorage`, exactly the way a real person would use two browser
tabs — walked through all ten of the sprint's numbered success criteria
without any manual step, without any test-only shortcut, and without
touching a single line of application code:

1. **Create a Theme in Builder** — a real World Project ("Platform
   Integration Gallery") authored from the Artwork Gallery template: real
   Overview identity (name, description), two genuinely content-bearing
   uploaded PNG images (Thumbnail + Hero), and a real Frame Experience
   ("Emerald Frame," border colour `#2a5c3e`) created through Scene → Place
   → "+ Add Experience" → "Create & Host," then edited via its own
   Experience Inspector.
2. **Validation passes** — Scenes ✅, Experiences ✅, World Contract ✅ (0
   errors, 0 warnings across Representations/Layouts/Frames/Layer
   Packs/Assets/References/Metadata/Version).
3. **Build succeeds** — "🎁 Build World Package" produced a real 21.84 KB
   `.vtheme` package (`my-artwork-gallery-<id>.vtheme`), version 1.0.0.
4. **Publish succeeds** — "🏛️ Publish to Official Themes" reported "✓
   Published 'Platform Integration Gallery' — VihuStudio will discover it
   automatically the next time it loads," and the exact built package landed
   in the shared `localStorage['vihu.themeRegistry.imported.v1']` key.
5. **Open Studio** — a second Playwright `page` in the *same browser
   context* (not a fresh context, not `storageState()` serialization)
   navigated to `index.html`, proving genuine same-origin sharing rather
   than a test harness shortcut.
6. **The published Theme appears automatically** — `ThemeRegistry.list()`
   on the freshly-opened Studio page returned 9 themes, including "Platform
   Integration Gallery," with zero explicit import step of any kind.
7. **Create a Story using that Theme** — Studio's own Creation Flow (a
   fresh session with nothing saved auto-opens it, per existing
   Sprint 10.0 behaviour): Screen 1 "Showcase My Artwork" → Screen 2 found
   "Platform Integration Gallery" in the Vihu Worlds row → its real
   Representation carousel showed Showcase / Portrait / Quote (exactly the
   3 Representations authored in Builder) → Start Creating on "Showcase."
8. **Add real artifacts** — a second, genuinely distinct, freshly-generated
   PNG (an 80×80 gradient, not a placeholder or 1×1 pixel) was uploaded
   through Studio's ordinary Upload Images → Picture Studio → Apply path
   and became a real page in the story, with real `cardOverrides` persisted.
9. **Publish the Story** — Studio's own five-stage Publish Studio flow (Read
   My Story → Almost Ready → Choose Story Destination → Publishing →
   Celebration), destination Story Carousel, format Instagram Portrait.
10. **Reader renders the Story correctly** — the Celebration screen's "📥
    Download Images" button triggered a real browser download
    (`The_Worst_Birthday_Ever_carousel_portrait.zip`, 228,521 bytes)
    containing `page-01.png` / `page-02.png`. `page-02.png` shows the exact
    uploaded gradient artwork rendered at full 1080-class Instagram Portrait
    resolution, with the theme's page background, footer title, and page
    number — genuine Reader-facing output, not a mock.

Zero console errors on either the Builder page or the Studio page at any
point in the run.

## The real integration mechanism, confirmed

`tools/world-builder/index.html` loads `../../js/themeRegistry.js` and
`../../renderer/slideRenderer.js` directly — the exact same files, same
origin, as the root Studio app. `publishToOfficialThemes()` calls
`window.ThemeRegistry.importPackage(pkg, {onDuplicate:'replace'})`, which
writes straight to `localStorage['vihu.themeRegistry.imported.v1']` — the
identical key Studio's own boot sequence (`_loadImported()`) reads. This is
not a new mechanism; it was implemented and documented in a much earlier
sprint. This sprint's contribution is proving it end to end with a real
authored Theme, a real authored Story, and a real published output, rather
than asserting it from code inspection alone.

## Discovered, non-blocking findings (disclosed, not fixed)

Per the sprint's own explicit scope — "no Builder polish beyond issues that
literally block the integration pipeline," "Studio must be treated strictly
as a consumer" — the following were found and are recorded here rather than
patched, since none of them prevented any of the ten success criteria:

- **Global Navigation has no direct Representations/Layouts/Frames/Layer-
  Packs item** (established since Builder V2 Slice 1) — Frame is only
  reachable via a Scene → Place → Frame Experience or the "Manage Frames"
  bridge link. This did not block Theme creation, Validation, Build, or
  Publish; the template's own seeded Representations/Layouts compiled and
  validated correctly with zero errors.
- **The Artwork Gallery template's default Representations carry no
  `editCaption`/`editQuote` action** — Studio's Context Panel only shows
  Title/Artist/Age/Date fields when the active Representation declares
  `actions:['editCaption']` (`js/contextPanel.js`'s `_appendCaptionOrQuote`,
  driven by data, not a hardcoded id check — confirmed correct). The
  template-generated Representations used in this proof don't set that
  field, so no Caption fields appeared for "Showcase." This is a content-
  authoring completeness gap in `tools/world-builder/js/templates.js`'s
  starter data, already named as open technical debt in the Sprint B2.0
  report ("no ... per-Representation `supportedCreationTypes` authoring...
  none of which block a World from validating, building, publishing, or
  importing correctly") — unrelated to this sprint's integration-pipeline
  scope, and not fixed here.
- **A single-file image upload always creates a new page** rather than
  filling an existing Representation page's picture placeholder in place —
  pre-existing, disclosed behaviour (Sprint 10.0's own "uploading always
  created a new page" note; "Replace Artwork" only applies to a page that
  *already* has a picture). This is why the uploaded artwork in this proof
  landed on a second page with no `layout`/Frame Variation of its own,
  rather than on the Representation-carrying first page — a real authoring-
  ergonomics detail, not an integration defect. The downloaded Reader output
  is correct for the page as authored.

None of these block Create → Validate → Build → Publish → Discover →
Author → Publish → Read. No code changes were made for any of them, per
the sprint's explicit "do not optimize, do not redesign" instruction.

## Verification

A single Node/Playwright script drove the entire flow in one browser
context: Builder authoring → Validation → Build → Publish, then a second
`page` in the same context opening Studio, confirming automatic theme
discovery, running Creation Flow, authoring real content, and completing
Studio's own Publish Studio flow through to a real, inspected file
download. Zero console/page errors throughout either page.

## Release Recommendation

The platform handoff works exactly as the product intends: a Theme authored
in World Builder becomes available in Studio's Creation Flow with no manual
step, and a Story authored against it publishes to genuine Reader-facing
output. No Builder or Studio code changes were required or made. The two
disclosed findings above are content/ergonomics gaps for a future sprint to
pick up deliberately — not integration blockers.
