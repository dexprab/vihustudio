# Theme → Creator Map

**Status:** Canonical. Maintain going forward whenever a theme field is
added, or a Creator surface that reads/edits/renders one changes.
**Scope:** This document answers a different question than
`docs/THEME_CONTRACT.md`. That ledger asks *"does Studio's code consume
this field at all"* (Produced?/Consumed?/parity). This document asks the
product question: for a given field in a `.vtheme` package, **where does
a creator ever see it, can they change it, and where does that change
land** — screen by screen, control by control. It does not restate
`docs/THEME_PROJECT_SPEC.md` (the authoring schema) or
`docs/VTHEME_PACKAGE_SPEC.md` (the compiled shape) — both stay the
authoritative field lists. This document is the index from "a field in
the package" to "a place in the running app."

---

## 0. The method — how to build/verify a row in this table

For any theme field `X`, four questions, in this order:

1. **Consumed?** Grep `X` in `renderer/slideRenderer.js` and
   `js/themeEngine.js` — does a real draw call or `resolveTheme()`/
   `getOptions()` path read it? (`docs/THEME_CONTRACT.md` already answers
   this for every field the compiled package can carry — check there
   first before re-deriving it.)
2. **Shown?** Grep `X` (or the `themeOptions.*` key it resolves through)
   in `index.html` (World Designer tab, `data-section='...'`), `js/
   workspaceBuilder.js`'s `CONTROL_CATALOG`, `js/cardDesigner.js`, `js/
   pageDesigner.js`, and `js/contextPanel.js`. One of these builds the
   actual control (or read-only display) a creator sees.
3. **Editable?** If a control exists, what does its `input`/`change`
   handler write to — `AppState.project.themeOptions.*` (a **global**
   override, every page), `slide.overrides.*` (a **per-card** override),
   or `slide.metadata.*` (**per-page content**, e.g. Museum Caption
   fields)? A field with no control anywhere is Builder-owned, not
   creator-editable — Layer Pack entries are the main example (see §6).
4. **Reflected?** Where does the edited value actually show up —
   `SlideRenderer.render()`'s canvas (always, if consumed), thumbnails
   (`ThumbnailEngine`, invalidated by `_invalidateThumbnails`), the
   Object Strip (`js/objectStrip.js`, only for things with a real bbox —
   see the Layer Pack fix below), and/or Publish Studio's render (same
   `SlideRenderer.render()` call, WYSIWYE — byte-identical to canvas).

Panel-id → Creator-screen wiring (confirmed from real call sites, not
inferred):

| `WorkspaceBuilder.layout()` panelId | Called from | Creator screen / section |
|---|---|---|
| `'slide'` | `js/pageDesigner.js:815` | Page Designer → Story tab → Decorations group |
| `'frame'` | `js/cardDesigner.js:713,837` | Card Designer → Picture section → Frame Look + Frame Style |
| `'holder.image'` | `js/cardDesigner.js:424,840` | Card Designer → Picture section (presentation controls) |
| `'holder.text'` | `js/cardDesigner.js:1976,2008` | Card Designer → Text section |
| `'holder.sticker'` | `js/cardDesigner.js:1159,1174` | Card Designer → Sticker section |

---

## 1. Manifest & identity (`manifest.*`)

| Field | Consumed by | Shown in Creator | Editable by creator? | Reflected in |
|---|---|---|---|---|
| `id`, `name`, `description` | `ThemeRegistry.getCatalog()`, `ThemeEngine._renderThemeCard()` | Screen 2 World card (`js/creationFlow.js` `_themePreview`), header World readout (`js/app.js` `_updateHeaderContext`, click → opens World picker), in-editor "Choose Your World" modal (`#themePickerModal`) | **No** — Builder-authored, read-only in Creator | Screen 2, header, World picker modal |
| `themeIcon`, `previewImage`, `purpose`, `mood`, `bestFor`, `notRecommendedFor` | `ThemeEngine._renderThemeCard()` when present | Theme Library picker card (icon/hero image/blurb) | No | World picker modal card |
| `category`, `tags` | Registry catalog only | Not shown anywhere in Creator today | No | — |
| `supportedCreationTypes` | `js/creationFlow.js` Screen 1/2 filtering | Determines **which Creation Type cards this World is offered under** — not a visible field, a filter | No (no Builder authoring surface either — see `THEME_CONTRACT.md` §3, disclosed gap) | Screen 1/2 discoverability only |

## 2. Core rendering fields (`theme.frame/panel/storyText/footerText/watermark`)

| Field | Consumed by | Shown in Creator | Editable by creator? | Reflected in |
|---|---|---|---|---|
| `frame.color` (outer book-frame colour) | `_frameColor` in `renderer/slideRenderer.js` | Not directly — World Designer has no raw frame-colour control; only reachable via `themeOptions.colours` override below, which targets Page Background, not this field | Not independently | Canvas, thumbnails, Publish |
| `panel.color` | `resolveTheme()` | World Designer → **Colours** → Story Panel (`#themePanelColor`) | Yes — global override, `themeOptions.colours.panel` | Canvas, thumbnails, Publish, every page at once |
| `storyText.font/size/color` | `resolveTheme()`'s `_scaledFont` | World Designer → **Typography** → Story Font / Text Size / Text Color (`#themeStoryFont`/`#themeTextScale`/`#themeTextColor`) | Yes — global override, `themeOptions.typography.{font,sizeScale,color}` | Canvas Story Text, thumbnails, Publish |
| `footerText.*`, `watermark.*` | `_drawFooter`/handle draw calls | Not independently controllable — Branding section controls *visibility/position*, not font/colour, for these | Partially (see §2b) | Canvas footer/handle, Publish |

### 2b. Branding visibility/position (`themeOptions.*`, seeded from `_defaultOptionsFor`/`AppState.project.themeOptions`)

| Field | Consumed by | Shown in Creator | Editable by creator? | Reflected in |
|---|---|---|---|---|
| `bookTitleVisibility`, `bookTitlePosition` | `_drawFooter` | World Designer → **Branding** → Book Title Visibility/Position | Yes — global, `themeOptions.bookTitleVisibility/bookTitlePosition` (default **hidden**, per the "Book Title / Page Number Off By Default" fix) | Canvas footer, Object Strip's "Footer" card (only when visible), Publish |
| `handleVisibility`, `handlePosition` | `_drawHandle` | World Designer → **Branding** → Handle Visibility/Position | Yes — global, `themeOptions.handleVisibility/handlePosition` (default **show**, but an empty Handle renders nothing since the `@vihuplanet` fallback removal) | Canvas handle, Object Strip's "Handle" card, Publish |
| `pageNumber` (position/hidden) | `_drawPageNumber` | World Designer → **Navigation** → Page Numbers (`#pageNumberStyles`) | Yes — global, `themeOptions.pageNumber` (default **hidden**) | Canvas, Object Strip's "Page Number" card, Publish |
| `panelStyle`, `footerStyle`, `variant` | `resolveTheme()` | World Designer → **Book Style** (Variant/Story Panel) + **Branding** (Footer) | Yes — global | Canvas panel chrome, Publish |
| `decorations[]` | `_drawDecorations` | World Designer → **Decorations** (`#decorationsList`), theme-gated per §3 below | Yes — global toggle list | Canvas, Publish |

## 3. Presentation Presets (`theme.slide` / `theme.holder`, resolved via `js/themePresets.js`)

These are **defaults**, not directly-editable raw fields — a theme names
`presentation:'gallery'` and `ThemePresets.resolveSlide/resolveFrame`
expand it into the same `themeOptions` shape as §2b/§4 above.

| Field | Consumed by | Shown in Creator | Editable? | Reflected in |
|---|---|---|---|---|
| `theme.slide` (panelStyle/footerStyle/pageNumber/bookTitle*/handle*/decorations defaults) | `js/themeEngine.js` `_defaultOptionsFor` | Same World Designer controls as §2b — a theme's `slide` preset only changes the **starting value** those controls show; the controls themselves don't know the preset exists | Yes, via the same controls (an edit becomes a `themeOptions` override, winning over the preset) | Same as §2b |
| `theme.holder` (cornerRadius/padding/shadow/fill defaults) | `_defaultOptionsFor` → `base.holder` | World Designer → **Picture Frame Defaults** (Corner Radius/Border Size/Shadow) | Yes — global default; a per-card Frame Style override (§4) still wins over this | Canvas Picture Frame, Publish |

Also gates **which controls are non-empty at all** for a theme with no
`editor` block but a `presentation` id (`docs/CLAUDE.md`'s Sprint 9.5
entry) — `WorkspaceBuilder`'s `_editorSectionFor` falls back to
`ThemePresets.listHolderPresets(...)`'s `editorControls` metadata.

## 4. Layouts (`theme.layouts[]` — id/name/aspect/composition/supportedFrames)

| Field | Consumed by | Shown in Creator | Editable? | Reflected in |
|---|---|---|---|---|
| Whole Layout entry | `_resolveLayout`/`_panelRectFor` in `renderer/slideRenderer.js` | **Not directly** — a creator never picks a raw Layout. They pick a **Representation** (§7), whose `layout` field points at one of these. Also reachable via `WorkspaceBuilder`'s `layout` control (`CONTROL_CATALOG.layout`, stored `slide.metadata.layout`) when a theme's `editor.slide` exposes it, and via Context Panel's "🔄 Change Look" (Representation carousel) | Indirectly — via Representation choice at Story creation (Screen 2 carousel) or "Change Look" later | Canvas panel geometry, composition (below/right/quote), Object Strip's Artwork card position |

## 5. Frame Variations (`theme.frameVariations[]` — `fields.{background,frame,paper,shadow,matWidth,frameThickness,borderColor,wallTone}`)

| Field | Consumed by | Shown in Creator | Editable? | Reflected in |
|---|---|---|---|---|
| Whole Frame Variation | `_artworkBorder`/`_resolveWallTone` in `renderer/slideRenderer.js`, via `_resolveArtworkFields` (see §8's correction — **not** the Sprint 6.5 Picture Border pipeline) | Card Designer → Picture section → **Frame Variations** control (`CONTROL_CATALOG.frameVariation`, colour-swatch tiles built from `theme.frameVariations` — Creator V2 Wireframe Precision Pass) — reachable only if the theme's `editor.frame.sections` (or `editor.holder.image.sections`) includes `frameVariation` | Yes — **per-card**, but only takes effect when the card has an image **and** an Artwork Theme is active (`_resolveBorder`'s `hasImage && _artworkTheme(s)` gate); stored as just the chosen variation's `id` at `slide.metadata.cardOverrides.artwork.frameVariation` (verified directly — corrects an earlier draft of this doc, which wrongly said `slide.overrides.border`, a completely different bag used by the Sprint 6.5 Picture Border controls). The full field values are resolved at render time by `_resolveArtworkFields` looking the id back up in `theme.frameVariations`, never copied onto the override itself. | Canvas Picture Frame (mat/border/wall-tone/shadow bands), Publish, thumbnails — **only for a Story/Cover/etc. page that both has a picture and has an Artwork Theme applied**; on a plain Story-only project this control has no visible effect even if shown. |
| `fields.cornerRadius`/`inset`/`defaultMargin` | **Nothing** in the real renderer — Builder-preview-only (see `THEME_CONTRACT.md` §9, disclosed gap) | Not shown in Creator at all | No | Nowhere in a published Theme |

## 6. Layer Pack (`theme.layerPack[]` — theme-declared text/sticker/decoration at `slide`/`frame`/`holder`/`element`/`overlay` targets)

| Aspect | Detail |
|---|---|
| Consumed by | `renderer/slideRenderer.js`'s `_renderLayers`/`LayerEngine.render`, one call per containership scope |
| Shown in Creator | **As of the "Layer Pack content now selectable" fix**: `js/objectStrip.js` lists every rendered Layer Pack entry as a 🔒 "Part of the world" card (label from `layer.label` or a humanized id, e.g. `wax-seal` → "Wax Seal") |
| Editable by creator? | **No, by design** — `locked:true` always. Clicking a card routes to the matching Card Designer section (`text`→Text, `sticker`→Sticker, `decoration`→Decoration via `TYPE_TO_SECTIONS`) but that section has no control bound to the Layer Pack entry itself — it's theme-fixed content, not a creator object |
| The one indirect "edit" path | A `museumCaption`-sourced text Layer *reads from* `slide.metadata.artworkTitle/artist/age/date` — which **is** creator-editable, via the `museumCaption` Workspace control (§8) or Context Panel's Caption field group (§7). Editing those fields changes what the Layer Pack renders without editing the Layer Pack entry itself. Same relationship for `quoteText`/`_drawQuoteText`. |
| Reflected in | Canvas (always, if the theme has one), Object Strip (now), Publish. **Never** in Card Designer's own editable controls. |

## 7. Representations (`theme.representations[]` — id/name/description/thumbnail/layout/defaultFrame/defaultLayerPack/background/actions)

| Field | Consumed by | Shown in Creator | Editable? | Reflected in |
|---|---|---|---|---|
| Whole Representation | `js/creationFlow.js` (`_representationsForTheme`, Screen 2 carousel), `js/contextPanel.js` (`_activeRepresentations`, "Change Look") | Screen 2's Preview carousel (pick one at Story creation) and Context Panel's "🔄 Change Look" button later | Creator **picks** one (writes `slide.metadata.layout` + applies `defaultFrame`); does not edit the Representation's own fields | Canvas layout/frame on Start Creating or after Change Look |
| `actions` (`editCaption`/`editQuote`) | `js/contextPanel.js` lines ~300-320 | Decides which field group the no-selection Context Panel default view shows | N/A (theme-authored gate) | Which of §8's `museumCaption`/`quoteText` controls even appear |

## 8. Editor block (`theme.editor.{slide,frame,holder}`) → Dynamic Workspace controls

This is the field group with the richest Creator surface — it decides
which controls Card/Page Designer show at all, in what order. Full
`CONTROL_CATALOG` → storage mapping:

**Correction (verified against real code after an earlier draft of this
table got the storage locations wrong):** `paper`/`mat`/`presentation`/
`artworkFrame`/`lighting`/`caption` do **not** share the Sprint 6.5
Picture Border bag (`slide.metadata.cardOverrides.border`) — they write
into a separate, Sprint-9.4-introduced bag,
`slide.metadata.cardOverrides.artwork` (`js/workspaceBuilder.js`'s
`_readArtwork`/`_ensureArtwork`), read back at render time only inside
`renderer/slideRenderer.js`'s `_resolveArtworkFields`/`_resolveBorder` —
**gated on the card both having an image and an Artwork Theme being
active** (`hasImage && _artworkTheme(s)`). On a Story-only project with
no Artwork Theme, these controls (if a theme's `editor` block exposes
them at all) are inert even though they render normally. `stickerShadow`
was checked directly (`grep stickerShadow renderer/slideRenderer.js`) and
is **never read anywhere** — it is a real, still-open "written but not
consumed" gap, exactly the state `js/workspaceBuilder.js`'s own file
header discloses as a Sprint 9.4 starting condition that a later sprint
never actually closed for this one field (unlike `paper`/`presentation`/
`artworkFrame`/`lighting`/`caption`/`mat`, which Sprint 9.6 did wire up).

| Control id | Panel | Storage on edit | Consumed by | Verified effect |
|---|---|---|---|---|
| `paper` | `frame` | `slide.metadata.cardOverrides.artwork.paper` | `_resolveArtworkFields` → `_artworkBorder` | Yes — paper texture fill |
| `mat` | `frame` | `...artwork.composition` | same | Yes — mat layout (center/margin/floating) |
| `presentation` | `holder.image` | `...artwork.presentation` | `ThemePresets.resolveHolder('image',...)` (slideRenderer.js:271,334) | Yes |
| `artworkFrame` | `holder.image` | `...artwork.frame` | `_resolveArtworkFields` → `_artworkBorder` | Yes — frame design (white-mat/tape/floating) |
| `lighting` | `holder.image` | `...artwork.lighting` | `_drawArtworkLighting(rect, art.lighting)` (slideRenderer.js:729) | Yes |
| `caption` | `holder.image` | `...artwork.caption` | switch on `art.caption` (slideRenderer.js:878-892) | Yes |
| `stickerShadow` | `holder.sticker` | `slide.metadata.cardOverrides.artwork.stickerShadow` (boolean) | **nothing** — confirmed zero matches in `renderer/slideRenderer.js` | **No — genuinely inert.** Shown/toggleable, never rendered. |
| `frameVariation` | `frame` | `slide.metadata.cardOverrides.artwork.frameVariation` (the variation's `id` only) | `_resolveArtworkFields` looks the id up in `theme.frameVariations` at render time | Yes, same gating as §5 |
| `layout` | `slide` | `slide.metadata.layout` | `_resolveLayout` | Yes |
| `museumCaption` | `slide` | `slide.metadata.{artworkTitle,artist,age,date}` | `_drawMuseumCaption` (via Layer Pack, §6) | Yes |
| `quoteText` | `slide` | `slide.metadata.{quoteText,quoteAttribution}` | `_drawQuoteText` | Yes |
| `background`/`decorations`/`title` (core, DEFAULT_CONFIG) | `slide` | `slide.metadata`/page background | Page Designer's Story tab | Yes |
| `frameStyle`/`fill`/`border`/`radius`/`shadow` (core) | `frame` | `slide.metadata.cardOverrides.border` (Sprint 6.5 Picture Border bag — a *different* bag from the artwork one above; reaches the renderer as `payload.overrides.border`, see `_resolveBorder`) | `_artworkBorder`/`_drawPictureFrameStroke` | Yes |
| `typography`/`alignment` (core) | `holder.text` | per-text-element override (`slide.overrides.textElements[id]` on the render payload) | Text element draw | Yes |

Three distinct storage bags exist, easy to conflate and worth naming
explicitly: `slide.metadata.cardOverrides.border` (Picture Border —
frameStyle/fill/border/radius/shadow), `slide.metadata.cardOverrides.artwork`
(Sprint 9.4/9.6 Holder presentation controls — paper/mat/presentation/
artworkFrame/lighting/caption/stickerShadow/frameVariation), and
`slide.metadata.{layout,artworkTitle,...}` directly on metadata for
per-page **content** (layout/museumCaption/quoteText) rather than a
per-card presentation override. Overrides are choices about *how* the
theme presents things on this one card; metadata fields are the
creator's own *content*.

## 9. Assets (`assets/*` → compiled `assets` map)

| Aspect | Detail |
|---|---|
| Consumed by | `ThemeRegistry.resolveAssetRef(id,value)`/`getAsset(id,path)` |
| Shown in Creator | Wherever a field resolving through it is shown — Representation thumbnails (Screen 2 carousel), World card previewImage/thumbnail. Never browsable as a raw asset list. |
| Editable? | No — Builder-owned bytes |
| Reflected in | Screen 2, World picker modal, wherever the referencing field renders |

## 10. Things a theme does **not** reach in Creator at all

- `fields.cornerRadius`/`inset`/`defaultMargin` on a Frame Variation (§5) — Builder-preview-only, disclosed gap.
- `supportedCreationTypes` (§1) — filters discoverability, never a visible/editable field.
- Layer Pack entries themselves (§6) — visible (Object Strip) and selectable, never editable.
- **`stickerShadow`** (§8) — shown as a real toggle in Card Designer's Sticker section when a theme's `editor.holder.sticker` exposes it, writes to a real field, and is **never read anywhere in `renderer/slideRenderer.js`** (confirmed by direct grep, zero matches) — a genuine "control exists, does nothing" gap, not yet closed the way Sprint 9.6 closed the same class of gap for `paper`/`presentation`/`artworkFrame`/`lighting`/`caption`/`mat`.
- Any World Builder Scene/Experience/Place authoring concept — none of that vocabulary crosses into Creator; only the **compiled, converged output** (Layouts/Representations/Layer Pack/Frame Variations) ever does, per the Builder Convergence Sprint's own "one canonical pipeline" decision.

---

## Maintenance

Update this map in the same change that adds a theme field, a new
Creator control, or a new Object Strip/Context Panel routing path — the
same discipline `docs/THEME_CONTRACT.md` already asks for its own parity
rows. If a field is Produced+Consumed per `THEME_CONTRACT.md` but has no
row here, that's itself worth flagging: it means the field affects
rendering but has **zero Creator-facing surface** — worth a deliberate
decision (add a control, or add it to §10 as an intentional gap), not an
oversight.
