# Place · Frame · Paper · Art — Model V2

Frozen spec for a three-layer render model replacing the current Frame Variation schema. Each visible layer is optional, sized within its parent, and picks its content from a small shared vocabulary. Nothing outgrows Frame; Frame lives inside a scene-bounded Place.

Companion artifact (source of this doc, with the same figures rendered as SVG):
`https://claude.ai/code/artifact/30f89733-69f1-49ac-af38-257127c65dec`

---

## 1. The mental model

### 1.1 Containment

Place is a *virtual* authoring anchor — it carries position, rotation, and author permissions but paints nothing. Frame is the outermost *visible* layer, scene-bounded, and can hold its own Image/Shape/Experience content plus its own separate border. Inside Frame, Paper and Art are siblings — either can be absent; wherever Paper is absent, the Scene shows through.

```
Scene ────────────────────────────────────────────────────────────
│  wall / background — shows through wherever Paper is absent
│
│   Place ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
│   │  builder-only virtual anchor · position, rotation, permissions
│   │
│   │   ┌── Frame ─────────────────────────────────────────┐
│   │   │  scene-bounded · Image / Shape / Experience     │
│   │   │  own border                                      │
│   │   │                                                  │
│   │   │   ┌── Paper ──────┐    ┌── Art ──────────┐       │
│   │   │   │ sibling·≤Frame│    │ sibling·≤Frame  │       │
│   │   │   │ Image·Color·  │    │ Image·Color·    │       │
│   │   │   │ Shape·Exp.    │    │ Shape·Exp.      │       │
│   │   │   │ no border     │    │ no border       │       │
│   │   │   └───────────────┘    └─────────────────┘       │
│   │   │                        ↑                         │
│   │   │        no Paper here → Scene shows through       │
│   │   └──────────────────────────────────────────────────┘
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
└─────────────────────────────────────────────────────────────────
```

**Containment is orthogonal to draw order.** A nested layer can (and does) draw on top of its parent — see §1.2.

### 1.2 Draw order (z-axis) — Frame on top, Art middle, Paper at the back

Draw order matches a real matted picture:

```
   front ↑
         │   ═══════════════════  Frame     border, tape, ornament, wood grain — always visible
         │
         │   ───────────────────  Art       the picture, sitting on the mat
         │
         │   ───────────────────  Paper     the mat — visible only where Art doesn't cover it
   back  ↓
```

- Paper is the mat behind, visible only in the mat gap (the area Art doesn't cover).
- Art sits on the mat.
- Frame's border + ornament sit on top of Art and Paper.

### 1.3 Two current bugs this resolves by construction

- **Tapes disappearing when border is removed.** Today the tape ornament draws inside the same `if(_border)` branch as the border stroke, so removing the border silently removes the ornament. In V2, Frame's Shape/Image content (tape, wood grain, ornament image) is a separate concern from Frame's Border property; removing the border cannot affect Frame's own content, because Frame lives above everything else in the stack regardless.
- **Wall showing through where Paper is absent.** Falls out of the containment + draw order naturally: if Paper is absent, nothing renders at that z-level, so the Scene's own background fills the gap between Art's own edge and Frame's inner edge.

---

## 2. Property grammar

Every visible layer honours the same shared vocabulary. Frame's row differs only where the layer's role demands it (no Color slot; the outer bound is the Scene, not another layer; the "default shape" is a real geometry choice rather than a fit mode).

| Property | Frame | Paper | Art |
| --- | --- | --- | --- |
| What it can be | `Image · Shape · Experience` | `Image · Color · Shape · Experience` | `Image · Color · Shape · Experience` |
| Mandatory | No | No | No |
| Max size | Cannot outgrow *Scene* | Cannot outgrow *Frame* | Cannot outgrow *Frame* |
| Draw order (z) | **Top / front** | Middle | Back |
| Min size | `0` | `0` | `0` |
| Author permission | Honor | Honor | Honor |
| Separate border | **Yes** | No | No *(deferred)* |
| Default shape | `Rectangle · Circle · Rounded` | `Fit Art · Fit Frame · Original` | `Fit Frame · Original` |
| Rotation *(2D Z-axis)* | Allowed | Allowed | Allowed |
| Tilt *(3D X/Y skew)* | Allowed | Allowed | Allowed |
| Resize | Allowed | Allowed | Allowed |
| Perspective *(vanishing point)* | Allowed | Allowed | Allowed |

*Default shape* is a single concept expressed two ways: Frame declares a geometry directly; Paper and Art declare a fit mode that inherits the shape of a sibling or parent. Deliberate — `Fit Frame` makes Paper take Frame's shape automatically, so a rounded Frame gets a rounded Paper for free.

---

## 3. Content slots — one of four things per layer

Each visible layer holds one primary content type. An **Experience** is a special content type that is **always additive** — it composites on top of whatever the layer already holds (or on top of nothing) and works uniformly on all three layers. There is no replace mode; Experience never displaces the layer's own primary content.

| Slot | Frame | Paper | Art | What it looks like today |
| --- | :-: | :-: | :-: | --- |
| Image | ✓ | ✓ | ✓ | Frame's `frameOrnamentImage`, Paper's `frameImage`, Art's Story-Author-uploaded picture |
| Color | — | ✓ | ✓ | Paper's `matColor`; Art doesn't have this today |
| Shape | ✓ | ✓ | ✓ | Frame's `frame` enum (wood/polaroid/tape/…); Paper/Art don't have this today |
| Experience | ✓ | ✓ | ✓ | Today Experience is a top-level object with parts; new model lets it attach to any layer as an *additive* overlay — never replaces the layer's primary content |

---

## 4. Transform stack

Uniformly allowed on all three layers. Applied in the order below so a rotated Frame keeps a Paper/Art that tilts within it rather than fighting it.

1. **Rotation** — 2D Z-axis (today's only transform). Around the layer's centre. Value `0–359°`.
2. **Tilt** — 3D X/Y skew. New capability. Two independent axes.
3. **Perspective** — vanishing-point warp. New capability. Anchor point + strength.
4. **Resize** — width / height overrides within the layer's own max bounds.

**Capability expansion — approved, in scope for V2.** Today's renderer only does 2D rotation. Tilt and Perspective are genuinely new draw pipelines (canvas `setTransform` covers affine skew; perspective needs a 4-point mapping or a WebGL step). Cost acknowledged and accepted — both belong in the spec.

---

## 5. Today's fields → new model

Every current Frame Variation and Place field, and where it lands. Fields marked *retire* collapse into the new grammar or move to a different owner.

| Current field | Owner today | New owner | Notes |
| --- | --- | --- | --- |
| `frame` | Frame Var | Frame · Shape slot | Ornament enums become authored Shape values |
| `frameOrnamentImage` | Frame Var | Frame · Image slot | + rotation |
| `frameOrnamentImageRotation` | Frame Var | Frame · Rotation transform | Folds into general Rotation |
| `frameThickness` | Frame Var | Frame · Border | Border is a separate layer property (Yes/No + thickness) |
| `borderColor` | Frame Var | Frame · Border | Colour of the separate border |
| `borderColorTransparent` | Frame Var | *retire* | Border = No expresses this cleanly |
| `shadow` | Frame Var | Frame · property | Stays a Frame property; a broader Effects concept (glow/blur/filter) is deferred to a later iteration |
| `defaultMargin` | Frame Var | *retire* | Frame is now scene-bounded; margin from Scene edge is Place.position |
| `background` | Frame Var | Paper · slot choice | `'color'`/`'image'`/enum-texture become slot types |
| `matColor` / `matColorTransparent` | Frame Var | Paper · Color slot | Transparent = absent |
| `frameImage` / `frameImageRotation` | Frame Var | Paper · Image slot | Rotation folds into Paper's Rotation transform |
| `matWidth` | Frame Var | Paper · size (relative to Frame) | A Paper smaller than Frame produces the mat gap |
| `paper` | Frame Var | *retire* | Paper is a concept defined by what occupies its slot — linen/canvas/watercolor become an author choice (Image upload, Shape, or Color), not a separate texture attribute |
| `inset` | Frame Var | *retire* | Redundant with Paper size |
| `wallTone` / `wallToneTransparent` | Frame Var | Scene · background | Wall is a Scene concern; Frame stops carrying it |
| `shape` (place) | Place | Frame · Default Shape | Rectangle/Circle/Rounded |
| `fit` (place) | Place | Art · Default Shape (Fit Frame / Original) | |
| `padding` | Place | Frame · internal padding | Distance from Frame edge to Paper/Art bounds |
| `rotation` (place) | Place | Place · Rotation (anchors Frame) | Place still owns the peg's own tilt |
| `permissions.*` | Place | Place · Author Permissions (Honor per layer) | Same flags, applied per layer via the "Honor" cell |

---

## 6. Decisions log

All six open questions from v1 of the proposal are resolved. Recorded here so the reasoning survives.

| Question | Decision |
| --- | --- |
| **Experience — replace or augment?** | **Additive only.** Experience always composites onto the layer's own content (or onto nothing) and works uniformly regardless of what already occupies the layer. No replace mode; no per-layer checkbox. |
| **Shadow's home — Frame property or Effects concept?** | **Stays a Frame property.** A broader Effects concept (glow, blur, filter grade) is deferred to a later iteration — not needed for V2. |
| **Paper texture vs. Paper shape?** | **Neither — Paper is a concept defined by what occupies it.** The current `paper` enum (linen/canvas/watercolor) retires; a Theme Author who wants a linen finish uploads a linen image (or picks a Shape/Color) into Paper's slot. No separate texture attribute. |
| **Border on Art — kept or dropped?** | **Dropped for this iteration.** Art carries no separate border in V2 (property grammar updated above). Revisit only if a real need surfaces. |
| **Transform cost — Tilt + Perspective?** | **Approved, in scope for V2.** The pipeline expansion cost is acknowledged and accepted. |
| **Migration path for published Themes?** | **No migration burden.** Product is still in development, not live. Published/authored Themes on the current schema don't need to be honoured — clean cut is fine. |

---

## 7. Status

This is a frozen product-canon document — approved architecture, not yet implemented. Per this repository's standing rule (CLAUDE.md → Development Rules), the model above governs any future work touching Place/Frame/Paper/Art rendering, but implementation itself remains a separately-scoped effort awaiting its own approval and phased rollout.

Companion frozen documents this model interacts with, not superseded by it:

- `docs/ENGINE_V2_SCENE_MODEL.md` — Scene / Canvas / Holder / Layer / Element ownership.
- `docs/THEME_PROJECT_SPEC.md` §6 — Frame Variation field list (governs today's schema until V2 lands).
- `docs/THEME_CONTRACT.md` — Studio consumer parity with compiled themes.
- CLAUDE.md → Creator Governing Rules #1 (Fidelity) and #5 (Publish Fidelity) — Publish must honour whatever the center pane renders under this new model.
