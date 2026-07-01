# Sprint 9.1 — Validation Evidence

All screenshots + assets in this directory are the observable proof
that Sprint 9.1's acceptance criteria are met. They were generated
in headless Chromium at `deviceScaleFactor=1`, viewport `1440 × 900`,
against the code at HEAD.

## WYSIWYE parity

| File                              | What it shows                                    |
|-----------------------------------|--------------------------------------------------|
| `editor-preview.png`              | Full editor screenshot — canvas + sidebars.     |
| `editor-canvas.png`               | Editor canvas alone, rendered at native 1080 × 1350 through the shared `SlideRenderer.render` path. |
| `carousel-portrait-page-2.png`    | The same slide published through Story Carousel (Instagram Portrait). |
| `carousel-square-page-2.png`      | Same slide as Instagram Square (1080 × 1080 centre-cropped). |
| `book-page-2.jpg`                 | Same slide as it lives inside the Digital PDF (JPEG embedded in the PDF page). |

**Pixel parity confirmation.** `editor-canvas.png` and
`carousel-portrait-page-2.png` share `SHA-256 = 86e6910993d29932`
— the editor bitmap and the shipped Carousel Portrait PNG are
byte-identical. The Story Book JPEG (`book-page-2.jpg`) draws from
the exact same source pixels — the delta is JPEG's inherent lossy
compression (46 KB vs 64 KB PNG), not a different render.

## Theme Designer global behaviour

| File                       | What it shows                                                  |
|----------------------------|----------------------------------------------------------------|
| `theme-before.png`         | The editor with the storyText theme colour at its default.    |
| `theme-after.png`          | Same viewport after a single Theme Designer colour change.    |
| `theme-thumbnails.png`     | Zoom into the left sidebar — every page's thumbnail has updated to reflect the colour change. |
| `theme-typography.png`     | Zoom into the Theme Designer panel showing the Typography section. |

Before the change: thumbnails SHA-256 =
`baebdc936ebf, ed888defdc37, 37e8737e076d` (cover, story, end).
After: `1e455ca71170, a16d751a47b8, ef780bd104c4` — all three
thumbnails updated, proving Theme changes propagate to every page
without any object or page selection.

## Publishing language & page management

| File                       | What it shows                                                  |
|----------------------------|----------------------------------------------------------------|
| `publish-button.png`       | Top toolbar — only the `📖 Publish` button; the Export button is gone from the DOM. |
| `page-context-menu.png`    | Right-click / ⋮ menu open on a page. Six items in the sprint-specified order: `📖 Publish This Page`, `📋 Duplicate Page`, `⬆ Move Page Up`, `⬇ Move Page Down`, `➕ Add Blank Page After`, `🗑 Delete Page`. Rename Page is removed. |

Publish This Page verified: a 4-page book (cover, A, B, end) →
right-click page A → Publish This Page → Story Book / Digital PDF
→ output PDF contains **exactly 1 embedded JPEG** (~30 KB), not 4.
The full-book Publish path from the header emits 4 JPEGs, unchanged.

## Automated verification scripts

The scripts that produced these files live in
`scratchpad/verify-*.js` (excluded from the repo — they depend on a
local Playwright install). Their measurements are inlined into the
Sprint 9.1.5 commit body for reproducibility.
