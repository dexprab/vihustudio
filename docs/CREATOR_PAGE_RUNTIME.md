# Creator Page Runtime

**Sprint:** Creator Runtime Pass Sprint — Promote the Center Pane into
the Page Runtime.
**Status:** Canonical. Created by this sprint; maintain going forward
whenever Object Strip, Context Panel, page navigation, Save, or Publish
change how they read or mutate the active page.
**Scope:** This document is Creator-side only. It does not restate the
Theme Contract (`docs/THEME_CONTRACT.md`), the Builder-authored render
tree/object-ownership model (Creator Reconciliation Sprint — see
`CLAUDE.md`'s matching entry), or the rendering engine itself
(`renderer/slideRenderer.js`). Its own, distinct job: who owns "what page
is active, what's rendered on it, and what's selected right now," and
how every surrounding panel reads and mutates that state.

---

## 1. What this sprint changed, and what it didn't

This is a **promotion**, not a rewrite. Investigation found that most of
the "Page Runtime" concept the sprint asked for already existed in
Creator, just scattered across `js/app.js` with no single name and two
divergent notify sequences. `js/pageRuntime.js` is a new, thin
ownership/dispatch layer that wraps the exact functions that already did
the real work — it does not reimplement rendering, hit-testing, or
selection logic.

**Unchanged, because investigation confirmed they already satisfied the
sprint's own requirements:**

- `renderer/slideRenderer.js` — the rendering engine itself. Page Runtime
  calls into it (`getSceneElements()`/`getTextElements()`); it never
  duplicates what it does.
- **Save** (`js/projectManager.js`'s `serialize()`) — already serializes
  only the Active Page's real content, with zero UI-state leakage (no
  selection, no scroll position, no panel-open state).
- **Publish** (`js/storyDestinations.js`, `js/publishStudio.js`,
  `js/pdfWriter.js`) — already renders through the identical
  `SlideRenderer.buildPayload()`+`.render()` pair as the editor canvas,
  on the same live slide reference, with zero bypasses.

**Fixed, because investigation found them broken or duplicated:**

1. No single render/notify funnel — `draw()` was called directly from
   ~10 drag-handler sites, and two different "notify everyone"
   sequences existed (the selection setters' 4-call tail vs. `showSlide`'s
   own 6-call tail).
2. **A confirmed real bug** — `showSlide()` never cleared selection, so
   a selection from page N could open editing controls on page N+1 that
   don't correspond to anything real there.
3. `PageOps.reorderPage`/`moveToEnd` duplicated or short-circuited the
   otherwise-uniform `_afterMutation` pipeline instead of going through
   it consistently.
4. "Start Creating" triggered three independent, redundant re-render
   sequences on one click.

---

## 2. Runtime ownership

`js/pageRuntime.js` (`window.PageRuntime`) is the single owner of:

- **Active Page** — `AppState.slides[AppState.currentSlide]`. Every
  panel should read this via `PageRuntime.getActivePage()` instead of
  re-deriving it from `AppState` directly. (`CardDesigner`, `PageDesigner`,
  `StickerStudio`, `ContextPanel`, and `ObjectStrip` all now source their
  `getCurrentSlide` host binding from `PageRuntime.getActivePage()`.)
- **Rendered objects** — the render tree Creator Reconciliation Sprint
  already established as Creator's object model
  (`SlideRenderer.getSceneElements()`/`getTextElements()`).
  `PageRuntime.getRenderedObjects()` names that existing contract as the
  Runtime's own object-discovery API; it invents no new shape.
- **Selection** — `PageRuntime.getSelection()` returns
  `{sceneId, sceneType, textId}`, read from the same
  `_selectedSceneElement`/`_selectedSceneElementType`/`_selectedTextElement`
  module-scope variables in `js/app.js` that have always been the single
  selection state (confirmed by investigation: no bypass exists anywhere
  in the file).

Page Runtime is **not** responsible for rendering pixels, hit-testing
clicks, or deciding what a selected object's controls look like — those
stay exactly where they were (`renderer/slideRenderer.js`,
`js/app.js`'s mouse handlers, `js/cardDesigner.js`/`js/contextPanel.js`).

### Wiring

`js/app.js` calls `PageRuntime.configure({...})` once, near the top of
its `DOMContentLoaded` handler, with closures over its own existing
module-scope selection variables and functions:

```js
PageRuntime.configure({
  getSlides: () => AppState.slides,
  getCurrentIndex: () => AppState.currentSlide,
  getSelectedTextElement: () => _selectedTextElement,
  getSelectedSceneElement: () => _selectedSceneElement,
  getSelectedSceneElementType: () => _selectedSceneElementType,
  setSelectedTextElement: (id) => _setSelectedTextElement(id),
  setSelectedSceneElement: (id, type) => _setSelectedSceneElement(id, type),
  showSlide: (i) => window.showSlide(i),
  redrawPreview: () => window.redrawPreview()
});
```

This is the same `configure({...})` host-binding pattern
`js/objectStrip.js`/`js/contextPanel.js` already used before this
sprint — Page Runtime is a consumer of that pattern, not a new one.

---

## 3. Active Page lifecycle

`window.showSlide(i)` remains the one real choke point every page-change
path already funnels through — confirmed by investigation, every one of
these calls it directly:

- Thumbnail clicks (`renderList()`/`renderTimeline()`)
- `PageOps._refreshSelection()` (every page mutation — add/delete/
  duplicate/reorder/etc.)
- `ProjectManager`'s session-restore path
- `js/creationFlow.js`'s "Start Creating"
- `js/publishStudio.js`'s "Fix in Editor"
- `js/themeEngine.js`'s theme-apply path

Because no bypass exists, the fix for the confirmed selection-survives-
a-page-switch bug lives **inside `showSlide` itself**, not only inside
`PageRuntime.openPage()` — every one of the callers above gets the fix
for free:

```js
window.showSlide = function(i){
  _selectedTextElement = null;
  _selectedSceneElement = null;
  _selectedSceneElementType = null;
  AppState.currentSlide = i;
  // ...DOM sync, thumbnail highlight...
  PageRuntime.notify();
  _updateHeaderContext();
  _updateCanvasCursor();
};
```

`PageRuntime.openPage(index)` is a thin, named delegate to
`host.showSlide(index)` — consumers external to `js/app.js` should call
this instead of reaching for `window.showSlide` directly, but the actual
selection-teardown guarantee holds regardless of which door a caller
uses.

---

## 4. Object discovery

`PageRuntime.getRenderedObjects()` returns
`{scene: SlideRenderer.getSceneElements(), text: SlideRenderer.getTextElements()}`
— the exact render tree the Creator Reconciliation Sprint established as
the one object model, now exposed through a named Runtime accessor
instead of every consumer calling `SlideRenderer` directly.

`js/objectStrip.js`'s `refresh()` builds its card list from
`PageRuntime.getRenderedObjects()` (falling back to direct
`SlideRenderer` calls only if `PageRuntime` somehow isn't loaded). Two
synthetic entries — Background and Artwork (on a Story-role page with an
image) — remain page-level concepts with no independent render-tree
bbox, exactly as the Creator Reconciliation Sprint disclosed; Page
Runtime doesn't invent bboxes for them.

---

## 5. Selection lifecycle

Page Runtime exposes **two** explicit mutation entry points for
selection, not one type-dispatching function:

```js
PageRuntime.selectSceneObject(id, type)  // any Scene Object, INCLUDING type:'text'
PageRuntime.selectTextObject(id)         // Story Theme text furniture only
PageRuntime.clearSelection()             // clears both channels
```

**Why two functions, not `selectObject(id, type)` dispatching on
`type==='text'`:** a Scene Object can itself legitimately carry
`type:'text'` — a Layer Pack text entry like a Museum Caption is a Scene
Object of type `'text'`, selected via
`window.setSelectedSceneElement(id,'text')` and read back through
`SlideRenderer.getSceneElements()`. This is a *completely different*
selection channel from Story Theme text furniture (Story Text/Handle/
Footer/Page Number — a small fixed set read from
`SlideRenderer.getTextElements()` and selected via
`window.setSelectedTextElement(id)`). An earlier draft of this module
collapsed both onto one `selectObject(id,type)` function that inferred
the channel from `type==='text'`, which silently rerouted a selected
Museum-Caption-shaped Scene Object into the wrong channel — caught by
the Runtime Pass Playwright verification (see §8), fixed by splitting
into two explicitly-named functions before this sprint shipped. `id` and
`type` alone are never enough to disambiguate; which function you call
is the disambiguator.

`js/objectStrip.js`'s card `onClick` handlers call these directly
(`_selectScene`/`_selectText` internal helpers) instead of reaching into
`window.setSelectedSceneElement`/`window.setSelectedTextElement`
globals — falling back to the raw globals only if `PageRuntime` isn't
loaded.

`PageRuntime.selectionIsValid()` answers "does the current selection
still refer to something actually rendered on the active page right
now?" — `'image-holder'` (the synthetic Artwork selection) is always
valid; everything else is checked against `getRenderedObjects()`.
`js/contextPanel.js`'s `refresh()` uses this exact check (via its own
`_findSceneObject`, now sourced from `PageRuntime.getRenderedObjects().scene`)
**before** deciding whether to open any Card Designer section at all —
not only before choosing disclosure wording, which was the pre-sprint
gap. A selection left over from a different page, or a since-removed
object, now falls through to the default "nothing selected" view instead
of opening a live-looking but id-blind editor.

---

## 6. The Runtime Pass

One dispatch function, `PageRuntime.notify()`, replaces the two
divergent sequences that existed before this sprint:

```js
function notify(){
  host.redrawPreview();              // draw() + PageDesigner.refresh()
  CardDesigner.refresh();
  ContextPanel.refresh();
  ObjectStrip.refresh();
}
```

Both selection setters (`_setSelectedTextElement`/`_setSelectedSceneElement`
in `js/app.js`) and `showSlide` now end with this single call instead of
each hand-assembling its own subset. `js/creationFlow.js`'s "Start
Creating" (`_finish`) calls `PageRuntime.openPage(AppState.currentSlide)`
once at the end instead of three independent re-render sequences
(`PageOps.addBefore`'s own pipeline and `ThemeEngine.apply*`'s own
internal `renderList`/`showSlide` calls already cover most of what those
three sequences were doing).

**Deliberately not folded into `notify()`:** the ~10 direct `draw()`
calls inside continuous mousemove drag-tick handlers (resize/scene/text
drag, image pan). These are a *correct*, pre-existing performance
decision — the code's own comments call out staying at 60fps during a
drag by skipping the full panel-refresh cost on every tick — not an
oversight. Their matching `mouseup` drag-end handlers already call the
full refresh sequence (`markDirty`, `ThumbnailEngine.generate`,
`renderList`/`renderTimeline`, `PageDesigner.refresh`) once the gesture
completes. Routing every mousemove tick through `notify()` would have
been a real performance regression for a fix the sprint didn't ask for;
this was investigated and deliberately left alone.

The full Runtime Pass this sprint verifies end-to-end: **Load Theme →
Open Book → Open Page → Render Builder-authored Page → Discover all
rendered objects → Allow object selection → Synchronize all UI surfaces
→ Modify supported objects → Save Story Author changes → Reload
correctly → Publish correctly** — with no panel reconstructing page
state independently anywhere along that path.

---

## 7. Public API

```js
PageRuntime.configure(bindings)          // wire host functions (js/app.js only)

// Read
PageRuntime.getActivePage()              // → the active slide object
PageRuntime.getRenderedObjects()         // → {scene:[...], text:[...]}
PageRuntime.getSelection()               // → {sceneId, sceneType, textId}
PageRuntime.selectionIsValid()           // → does the selection still resolve?

// Mutate
PageRuntime.selectSceneObject(id, type)  // any Scene Object (incl. type:'text')
PageRuntime.selectTextObject(id)         // Story Theme text furniture only
PageRuntime.clearSelection()             // clears both channels
PageRuntime.openPage(index)              // delegates to showSlide (selection-safe)

// Dispatch
PageRuntime.notify()                     // the one "redraw + refresh every panel" call
```

---

## 8. Consumer responsibilities

| Consumer | Before this sprint | After this sprint |
|---|---|---|
| `js/objectStrip.js` | Read `SlideRenderer` directly; wrote via `window.setSelectedSceneElement`/`setSelectedTextElement` globals | Reads via `PageRuntime.getRenderedObjects()`; writes via `PageRuntime.selectSceneObject`/`selectTextObject`/`clearSelection` |
| `js/contextPanel.js` | Read `SlideRenderer.getSceneElements()` directly in `_findSceneObject`; opened a section before checking the object still existed | Reads via `PageRuntime.getRenderedObjects().scene`; checks existence **before** opening any section |
| `js/cardDesigner.js` / `js/pageDesigner.js` / `js/stickerStudio.js` | `getCurrentSlide` host binding read `AppState.slides[AppState.currentSlide]` directly | `getCurrentSlide` host binding reads `PageRuntime.getActivePage()` — same value, one owner |
| `js/pageOps.js` | `reorderPage`'s "not selected" branch hand-duplicated `_afterMutation`'s own steps; `moveToEnd` short-circuited past the pipeline entirely | Both always go through `_afterMutation` |
| `js/creationFlow.js` | "Start Creating" ran `redrawPreview()` + `renderList()` + `showSlide()` + `ContextPanel.refresh()` explicitly, on top of what `PageOps`/`ThemeEngine` already did internally | Calls `PageRuntime.openPage(AppState.currentSlide)` once |
| **Save** (`js/projectManager.js`) | Already correct | Unchanged |
| **Publish** (`js/storyDestinations.js`, `js/publishStudio.js`, `js/pdfWriter.js`) | Already correct | Unchanged |

---

## 9. Verification

A new Playwright harness test
(`runtime_pass_test.js`, scratch-only, not committed to the repo) drove
the real app end-to-end and confirmed:

- `PageRuntime`'s API surface is present and correctly named.
- Selecting a sticker on page 1, then calling `showSlide(1)`, clears
  selection: `getSelection()` returns all-null, Card Designer's tab is
  no longer forced visible, Context Panel shows the default "Tap
  anything on the page to edit it" view, and Object Strip shows nothing
  selected.
- The same holds when the page mutation comes from `PageOps.duplicatePage`
  rather than a direct `showSlide` call — selection set on the
  pre-duplicate page is cleared once the duplicate becomes active.
- `PageRuntime.selectionIsValid()` correctly returns `false` for a
  selection id that doesn't resolve to anything in the current render
  tree.
- Zero console errors throughout.

This surfaced and fixed the `selectSceneObject`/`selectTextObject` split
described in §5 — a Museum-Caption-shaped Scene Object (type:'text',
owner:'world') was being silently routed into the wrong selection
channel by an earlier single-function `selectObject(id,type)` design,
confirmed via `scene_object_test.js` before the split (clicking Museum
Caption after Wax Seal left the Context Panel showing Wax Seal's own
banner) and after (clicking Museum Caption correctly shows its own
"This is part of the World." banner).

Full regression across the existing Creator Playwright suite
(`regression.js`, `final_qa.js`, `frame_variation_test3.js`,
`ws_check.js`, `publish_stages.js`, `lang_check.js`, `baseline3.js`,
`scene_object_test.js`, `sticker_owner_check.js`, `diag_layerpack3.js`)
passes unchanged, zero console errors. Two pre-existing, already-stale
test failures (`objstrip_check.js`, `ctx_states2.js`) were confirmed
(via `git stash` in the preceding Creator Reconciliation Sprint) to fail
identically on the unmodified codebase — unrelated to this sprint,
carried forward unresolved as pre-existing debt, not a new regression.
