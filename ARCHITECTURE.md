# VihuStudio Architecture

This document describes the current implementation of the VihuStudio repository as observed in the main branch at commit 0e3d819 (2026-06-27).

One-line summary

A tiny, browser-first static single-page application that allows uploading image files, editing per-page text, and rendering a phone-style preview into an HTML5 canvas. The runtime is plain browser JavaScript with one global AppState and a separate SlideRenderer that draws slides to a canvas.

## High-level components

```mermaid
flowchart LR
  subgraph Browser
    A[index.html] --> B(js/state.js)
    A --> C(renderer/slideRenderer.js)
    A --> D(js/app.js)
    D -->|reads/writes| B
    D -->|calls| C
  end

  subgraph RuntimeFlow
    U[User uploads images] --> D
    D -->|create Image objects| AppState[AppState.slides]
    AppState --> D
    D -->|calls| C[SlideRenderer.render()]
    C --> Canvas[<canvas id=previewCanvas>]
  end
```

## Files and roles (current implementation)

- index.html
  - Single HTML entry point and layout. Exposes DOM elements with specific IDs used by the JS codebase: `uploadBtn`, `scanUpload`, `slideList`, `previewCanvas`, `bookTitle`, `storyBeat`, `pageNumber`, `totalPages`, etc.
  - Loads scripts in this order: `js/state.js`, `renderer/slideRenderer.js`, `js/app.js`.

- js/state.js
  - Defines a single global `AppState` object:
    - `project` (title, theme)
    - `slides` (array of slide objects)
    - `currentSlide` (index)
  - There is no persistence, no accessors; state is mutated directly.

- js/app.js
  - Main DOM wiring and application logic executed on `DOMContentLoaded`.
  - Responsible for: file input handling, creating Image objects(), pushing slide objects to `AppState.slides`, rendering the slide list, changing current slide, syncing inputs to the current slide, and invoking the renderer.
  - Hooks (examples): `uploadBtn.onclick`, `upload.onchange`, slide list item `.onclick`, and `oninput` handlers attached for live preview.
  - Uses `URL.createObjectURL(file)` to load images into Image elements; does not call `URL.revokeObjectURL`.

- renderer/slideRenderer.js
  - Exposes a global `SlideRenderer` object with `init(canvasEl)` and `render(payload)` methods.
  - `init` sets canvas width/height and 2D context. `render` draws background, a white panel, and text onto the canvas. It expects payload containing keys like `image`, `storyBeat`, `bookTitle`, `page`, and `totalPages`.

- css/style.css
  - Contains CSS variables, a three-column grid layout (#app), and styles for sidebar, preview, and props pane.

## Runtime shape

- index.html loads scripts in a strict order. `js/app.js` assumes `AppState` and `SlideRenderer` are present. If script order changes the app will break at runtime.
- AppState is the single source of truth in memory. The renderer is stateless (draws when called) and depends on the data passed in.
- There is no server; all operations are in-browser and in-memory.

## Important implementation facts (do not change without coordination)

- Global names used by code: `AppState`, `SlideRenderer`.
- DOM id selectors used directly in `js/app.js`: `uploadBtn`, `scanUpload`, `storyBeat`, `bookTitle`, `pageNumber`, `totalPages`, `slideList`, `previewCanvas`.
- `SlideRenderer.init(canvasEl)` is called before `SlideRenderer.render(...)` anywhere.

