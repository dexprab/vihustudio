# Backlog

A place to drop bugs and feature requests as you find/think of them, at any pace. I check this file when we start a work session and pick items up — no need to wait for me to be "free" to write something down.

**How to use it:**
- Add a new line under the right section, in plain language — a screenshot description, a repro step, a half-formed idea. No need to format it carefully.
- I'll investigate, ask a clarifying question inline (right here in the file, or in chat) if something's ambiguous, and check items off (`- [x]`) once shipped, usually referencing the CLAUDE.md sprint entry that covers it.
- Nothing here is a commitment or a queue order — I'll use judgment on sequencing, and may batch related items together.

## Bugs

- Draw your own functionality in builder should be same as draw your own feature in studio.
- Give rotation capability to places in builder and studio
- Frame style comes over the art.
- reordering z axis within experience
- Studio scene <img width="451" height="367" alt="image" src="https://github.com/user-attachments/assets/2f5fe1ac-81fd-4bd3-b278-05ef48e50980" /> is not same as what was authored in builder <img width="292" height="300" alt="image" src="https://github.com/user-attachments/assets/65ac639d-ef51-4f71-85fc-593fa4f634c3" /> places shapes , places placeholder art, background transparency are few of the points which are in direct conflict.




## Feature Requests

- Extend background-remover utility. Keep the same essence. replace the existing image editor during image upload in studio with this. when a image is uploaded in studio let it pass through Image Studio (renaming background-remover). It should allow user to crop, remove background, flip, rotate
- We need a tutorial or a starting instruction for the kids first visit. what to do , how to do , where to do, when to do.
- Connect with one specific folder of either google drive or google photos so that kids can pick their photos from there and parents can upload pics there. this will make using orignal arts easy and smooth.
- Printable story writing pages, color sheets , sketches. various book sizes.

## Done

- [x] Restore loses orientation (landscape→portrait) — CLAUDE.md: "BACKLOG.md — Restore Loses Orientation."
- [x] Performance with 20+ objects on Scene — CLAUDE.md: "BACKLOG.md — Performance with 20+ Objects on Scene."
- [x] For all shapes, choose either solid colors or manually color using brush strokes (Doodle-style) — CLAUDE.md: "BACKLOG.md — Shapes: 'Solid Fill' vs. 'Paint Inside' Toggle."
- [x] Fill style and alignment buttons don't visually update on click (effect applies, button state frozen) — CLAUDE.md: "BACKLOG.md — Fix Single-Select Icon-Row Buttons Not Visually Updating on Click."
- [x] Default state of "Add Something" in the right pane should be open — CLAUDE.md: "BACKLOG.md — Add Something Default-Open Right Pane."
- [x] Add image option also in background — CLAUDE.md: "BACKLOG.md — Add Image Option to Page Background (root Studio only)."
- [x] Doodle drawn vs doodle shown has differences in line stroke thickness and space covered; also leakage from doodle sketch area to outside area, same with shape when painted — CLAUDE.md: "BACKLOG.md — Doodle/Shape Fidelity: Real-Render Leakage Clip + Pad Aspect-Ratio Correction (root Studio only)."
- [x] Color change swatch should be made available where ever colors are used. a standard rainbow color circle should be used for color picker. Doodle area does not have color picker — CLAUDE.md: "BACKLOG.md — Bugs 1, 4, 6 Shipped Together."
- [x] In shapes for all letters add lowercase also — CLAUDE.md: "BACKLOG.md — Bugs 1, 4, 6 Shipped Together."
- [x] Color and Image can co-exist in background. color is always behind the image not in front. Rename Background color section to Background. The image uploaded need to pass through image studio and also need to support all options which other images objects have got — CLAUDE.md: "BACKLOG.md — Bugs 1, 4, 6 Shipped Together."
- [x] +Experience button needs to be in scene stack also — CLAUDE.md: "BACKLOG.md Batch 1 — Bugs E + D."
- [x] Graphics within experience in builder do not rotate on moving the rotation slider — CLAUDE.md: "BACKLOG.md Batch 1 — Bugs E + D."
- [x] For texts allow these curves — CLAUDE.md: "BACKLOG.md — Batch 2 (Bug G): Curved Text End to End..."
- [x] Companion does not always load in studio it just shows blank circle — Resolved by real Quill pose art uploaded (Companion Engine's existing graceful-degradation onerror-fallback correctly handles a missing pose file already; the blank circle only appeared because Quill's own pose files hadn't yet been supplied).
- [x] Add image option in frame styles in builder — CLAUDE.md: "Bug 4 — Image option in Frame Styles (root Studio): a genuine rotation-aware cover-fit fix for all three image-cover call sites in renderer/slideRenderer.js's Frame-fill pipeline" and preceding "Image-Typed Frame Variations" sprints. Frame Style now accepts a real image option (frameOrnamentImage + frameOrnamentImageRotation), mat and border also support image via existing frameImage; every image-cover call site is rotation-aware.
- [x] Allow builder to add more places to the scene — already fully implemented by the earlier "Multiple Artwork Places Per Page" sprint. Every Scene has an "+ Add a Place" button in both the Scene Stack sidebar and the Place activity panel; addHolder assigns unique ids and distinct positions; convergeScene compiles every Place with placeRects (position/size/shape/frame/Guardrails); both engines render every Place independently. Verified end to end via a real Playwright walkthrough (`bug551_uicheck.js`, 9/9): a 1-Place Scene grows to 2, then 3 Places on real button clicks, with correct names "Place, Place 2, Place 3".

(Checked-off items move here once shipped, with a one-line pointer to the CLAUDE.md entry.)
