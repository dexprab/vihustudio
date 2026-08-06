# Magic Publish — Sprint Roadmap

**Status: approved plan. This is the execution roadmap for the proposal in
`docs/MAGIC_PUBLISH_ARCHITECTURE.md`.**

Nine sprints, each independently shippable and independently verified. The
ordering is deliberate: customer-visible magic ships first, and the
underlying platform strengthens later without rewriting the experience.

---

## Sprint M1 — Magic Publish Foundation

**Goal.** Introduce Magic Publish as a new publish capability without
changing existing publishing behaviour.

**Scope.** Study the current Publish pipeline and `StoryDestinations`.
Implement the plumbing required for Magic Publish.

**Deliverables**

- Register a new Magic Publish destination.
- New `js/magicReveal.js`.
- Wire the destination into the Publish pipeline.
- No UI changes.
- No renderer modifications (unless absolutely required).
- No animation yet.

**Success criteria.** Publishing recognizes Magic Publish as a valid
destination. No regression to PDF, Carousel, Story Reel, or any existing
destination.

---

## Sprint M2 — Layer Decomposition Engine

**Goal.** Teach VihuStudio how to peel a page apart.

**Scope.** Implement `revealStages(slide)`. The function derives reveal
stages purely from the final page. No history. No timeline.

**Stages**

```
Blank → World → Artwork → Decorations → Text → Finished
```

Stages collapse automatically when empty.

**Deliverables**

- `revealStages()`
- Layer grouping
- Stage generator
- Unit verification

**Success criteria.** Given any slide, Magic Publish generates meaningful
reveal stages without changing the original slide.

---

## Sprint M3 — Frame Rendering

**Goal.** Convert reveal stages into rendered frames. Reuse existing
rendering. Do not build a second renderer.

**Scope**

```
For every reveal stage → SlideRenderer.render() → Bitmap
```

No video yet.

**Deliverables**

- Frame rendering
- Off-screen rendering
- Memory cleanup
- Performance validation

**Success criteria.** Every stage produces a rendered image identical to
normal story rendering.

---

## Sprint M4 — Magic Animation

**Goal.** Bring pages to life. This sprint is entirely about delight.

**Scope.** Extend `ReelComposer` to support crossfade, fade, gentle scale,
and soft movement. Avoid flashy effects. Everything should feel
storybook-like.

**Animation language**

| Element | Behaviour |
|---|---|
| Background | Wash in |
| Objects | Fade + rise |
| Text | Draw word-by-word |
| Final page | Pause |

**Deliverables**

- New transition mode
- Animation timing
- Animation configuration

**Success criteria.** A single page feels magical without showing editor UI.

---

## Sprint M5 — Magic Strip

**Goal.** Generate a static visual showing the creative journey.

**Scope.** Produce `Blank → World → Artwork → Decorations → Text →
Finished`. Support both Strip and Grid layouts.

**Deliverables.** Magic Strip renderer.

**Success criteria.** Every published story automatically produces a
printable Magic Strip.

---

## Sprint M6 — Publish Celebration

**Goal.** Publishing should become an experience, not an export.

**Scope.** Replace `Publishing...` with

```
✨ Preparing Story
✨ Creating Magic
✓ Book Ready
✓ Magic Ready
```

The Celebration page automatically plays the Magic Creation. No download
required. Downloads remain available.

**Deliverables.** New Publish celebration flow.

**Success criteria.** The child watches the animation immediately after
publishing.

---

## Sprint M7 — Audio & Polish

**Goal.** Add emotion.

**Scope.** Audio priority: narration, then ambient music, then silence.

**Closing card**

```
Story Title
✨ Created in VihuPlanet
```

Optional: Story Companion cameo.

**Deliverables.** Audio mix, closing sequence, brand polish.

**Success criteria.** Magic Creation feels complete.

---

## Sprint M8 — Performance & QA

**Goal.** Production readiness.

**Scope.** Stress testing, large stories, long books, theme validation,
Museum Gallery verification, memory profiling, regression testing.

**Success criteria.** No regression across existing publishing
capabilities.

---

## Sprint M9 — Launch Readiness

**Goal.** Create a feature people talk about.

**Scope.** Review animation quality, timing, transitions, delight,
consistency, and branding.

**Output.** Launch-ready Magic Publish.

---

## Out of scope

Explicitly do **not** implement:

- Timeline
- Replay Engine
- Version History
- Undo
- Diagnostics
- Companion Integration
- Analytics
- AI
- Social posting
- Cloud processing
- Background workers

Those belong to future initiatives.

---

## Product acceptance tests

| # | Test |
|---|---|
| 1 | A creator should never have to press Record. |
| 2 | A creator should never edit a reel. |
| 3 | The animation must never expose editor UI. |
| 4 | The animation should feel intentionally choreographed rather than replayed. |
| 5 | Publishing should feel like a celebration rather than a file export. |
| 6 | A parent watching the animation should naturally ask: *"How did VihuPlanet do that?"* |

---

## Final milestone (after M9)

Only after Magic Publish has shipped and proven its value does the next
initiative open: the **Creative Timeline Platform**.

At that point the implementation is elegant, because the only thing that
changes is the frame provider:

```
Magic Publish v1                 Magic Publish v2
Finished Page                    Creative Timeline
      │                                │
      ▼                                ▼
Layer Decomposition              Real History Frames
      │                                │
      ▼                                ▼
    Frames                             │
      │                                │
      ▼                                ▼
Magic Renderer  ────── unchanged ───── Magic Renderer
```

The renderer, animations, publish flow, celebration UI, and Magic Strip all
remain unchanged. That separation is what makes this roadmap robust: ship
customer-visible magic first, then strengthen the underlying platform
without rewriting the experience.
