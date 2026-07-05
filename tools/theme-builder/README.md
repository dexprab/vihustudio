# Theme Builder

A lightweight compiler for creating and validating VihuStudio themes.

## Overview

Theme Builder V1 is a **read-only theme validator and compiler**. It takes a Theme Project folder, validates it against requirements, and produces a valid `.vtheme` package for import into VihuStudio.

```
Theme Project Folder
    ↓ [Load]
Dashboard & Validation
    ↓ [Validate]
Validation Report
    ↓ [Build]
.vtheme Package
    ↓ [Download]
Import into VihuStudio
```

## Theme Builder Philosophy

Theme Builder is a **compiler**, not a visual editor.

**Input:** Theme Project folder  
**Process:** Validate → Package → Generate  
**Output:** ThemeName.vtheme (directly importable)

Visual editing belongs to Theme Designer V2.

## What Theme Builder Does

✓ Reads Theme Project folders  
✓ Detects project structure  
✓ Validates all components  
✓ Reports errors and warnings  
✓ Prevents invalid builds  
✓ Generates `.vtheme` packages  
✓ Provides download capability  

## What Theme Builder Does NOT Do

✗ Visual editing  
✗ Theme design  
✗ Live preview  
✗ Frame/layout editing  
✗ Asset editing  
✗ Publishing  

## Theme Project Structure

A valid Theme Project folder contains:

```
MuseumGallery/
├── manifest.json          (Required: theme metadata)
├── metadata.json          (Required: display info)
├── theme.json             (Required: theme configuration)
├── layouts/               (Required: layout definitions)
├── frames/                (Required: frame components)
├── layer-packs/           (Required: layer definitions)
├── representations/       (Optional: complete page styles Studio's Creation Flow offers)
├── assets/                (Required: theme assets)
├── preview.png            (Recommended: preview image)
├── thumbnail.png          (Recommended: thumbnail)
└── README.md              (Recommended: documentation)
```

### manifest.json

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "version": "1.0.0",
  "builderVersion": "1.0.0",
  "minStudioVersion": "9.5.0",
  "author": "VihuStudio",
  "description": "A classic gallery-inspired theme",
  "category": "Official",
  "tags": ["gallery", "art", "museum"],
  "thumbnail": "thumbnail.png",
  "createdDate": "2026-01-01",
  "updatedDate": "2026-01-01"
}
```

`minStudioVersion` (not `minimumStudioVersion`) is the field the real
VihuStudio import path checks — see `docs/THEME_PROJECT_SPEC.md` §2 and
`docs/VTHEME_PACKAGE_SPEC.md`. Every field above is required — the exact
list `js/themeRegistry.js`'s `REQUIRED_MANIFEST_FIELDS` checks, plus
`builderVersion` (a Theme Builder-only authoring gate).

### metadata.json

```json
{
  "displayName": "Museum Gallery",
  "description": "A classic gallery-inspired theme",
  "category": "Portfolio",
  "tags": ["gallery", "portfolio", "classic"]
}
```

### theme.json

`theme.json` is **not** the runtime theme object — it's the small set of
theme-wide defaults the compiler starts from before folding in `layouts/`,
`frames/`, and `layer-packs/`. See `docs/THEME_PROJECT_SPEC.md` §4.

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "presentation": "gallery"
}
```

`id`/`name` must exactly match `manifest.json`'s — a project where they
differ fails validation. A Story Theme (`manifest.type` absent or
`"story"`) additionally requires `frame`, `panel`, `storyText`,
`footerText`, `watermark` on `theme.json`.

## Validation Engine

Validates all aspects of a theme project:

### Structure Validation
- ✓ Required folders exist
- ✓ Required files exist  
- ✓ Optional assets present

### File Validation
- ✓ JSON files are valid
- ✓ Required fields present
- ✓ Field types correct

### ID Validation
- ✓ Theme IDs are lowercase alphanumeric with hyphens
- ✓ IDs are 3-50 characters
- ✓ No duplicate IDs

### Version Validation
- ✓ Semantic version format (e.g., 1.0.0)
- ✓ Minimum Studio Version specified

### Reference Validation
- ✓ No two Layouts share an id; no two Frame Variations share an id; no
  two Layers across the entire compiled Layer Pack share an id (checked
  across every file under `layer-packs/`, not just one); no two
  Representations across `representations/` share an id
- ✓ Every `supportedFrames` entry in a Layout names a real Frame id
- ✓ Every Layer's `type`/`target` is one of the allowed values
- ✓ Every Representation's `layout` names a real Layout id; every
  Representation's `defaultFrame`, if set, names a real Frame id
- ✓ Every asset path referenced from `layouts/`/`frames/`/`layer-packs/`/
  `representations/` resolves to a real file under `assets/`
- ✓ `manifest.thumbnail` / `metadata.previewImage`, if a relative path,
  resolve to a real project file

## Build Engine

Converts validated themes into `.vtheme` packages:

### Build Process
1. **Validate** - Run full validation (prevents invalid builds)
2. **Package** - Organize all files
3. **Generate** - Create `.vtheme` file
4. **Report** - Display build summary

### Package Format

`.vtheme` files are the canonical flat runtime package
`ThemeRegistry.importPackage()` consumes directly — see
`docs/VTHEME_PACKAGE_SPEC.md` for the full contract:

```json
{
  "manifest": { "...": "manifest.json + metadata.json, merged" },
  "theme": {
    "...": "theme.json's own fields",
    "layouts": ["...flattened from layouts/*.json"],
    "frameVariations": ["...flattened from frames/*.json"],
    "layerPack": ["...flattened from layer-packs/*.json"],
    "representations": ["...flattened from representations/*.json — omitted if none"]
  },
  "assets": { "relative/path.png": "data:image/png;base64,..." }
}
```

`preview.png`/`thumbnail.png` are embedded as real data URIs on
`manifest.previewImage`/`manifest.thumbnail` — no placeholder strings, no
per-collection `{file, data}` wrappers, no build-provenance envelope.

## Dashboard

Displays project overview:

- Project Name
- Version
- Author
- File Count
- Structure Status (with ✓/✗ indicators)

## Validation Report

Shows validation results:

### Valid Projects
```
✓ VALID
All checks passed!
```

### Invalid Projects
```
✗ INVALID

Errors (3)
- Missing required folder: layouts/
- Invalid JSON in frames/hero.json
- manifest.id "Museum Gallery" must be lowercase alphanumeric

Warnings (1)
- Missing preview.png (recommended)
```

## Build Report

After successful build:

```
✓ Build Successful

Theme Name: Museum Gallery
Version: 1.0.0
Build Time: 245ms
Package Size: 2.3 MB
Timestamp: 2026-07-05 10:45:30 AM

Package ready for download
```

## Usage Workflow

### 1. Load Project

Click **"Load Project"** button  
Select theme project folder  
Dashboard displays project info

### 2. Validate

Click **"Validate"** button  
Review validation report  
Fix any errors shown

### 3. Build

Click **"Build"** button (enabled only after validation passes)  
Wait for build to complete  
Download `.vtheme` file automatically

### 4. Import

Open VihuStudio  
Import downloaded `.vtheme` file  
Theme is ready to use  
No code changes required

## API Reference

### Global Access

```javascript
window.ThemeBuilder.app          // Main app instance
window.ThemeBuilder.projectLoader // Project loading
window.ThemeBuilder.validator     // Validation engine
window.ThemeBuilder.builder       // Build engine
window.ThemeBuilder.appState      // State management
window.ThemeBuilder.ui            // UI controller
window.ThemeBuilder.eventBus      // Event system
```

### Project Loader

```javascript
// Load from FileList
await projectLoader.loadProjectFromFiles(files);

// Get project info
projectLoader.getProjectInfo();

// Check if loaded
projectLoader.isLoaded();
```

### Validator

```javascript
// Run validation
const result = await validator.validate();

// Result structure
{
  isValid: boolean,
  errors: string[],
  warnings: string[],
  details: { ... }
}
```

### Builder

```javascript
// Build theme
const result = await builder.build();

// Download package
builder.downloadPackage(result.packageFile);

// Get build history
builder.getHistory();
```

## Architecture

### Modules

- **constants.js** - Application constants
- **eventBus.js** - Pub/sub event system
- **state.js** - Central state management
- **projectLoader.js** - Project detection and loading
- **validator.js** - Theme validation engine
- **builder.js** - Theme packaging and building
- **ui.js** - UI rendering and interaction
- **router.js** - Navigation routing
- **app.js** - Application orchestration

### State Management

Central state stores:

```javascript
{
  currentTheme: { ... },      // Loaded project
  selectedSection: "dashboard",
  isDirty: false,
  validationState: "Unknown",
  buildState: "ready"
}
```

### Event System

Key events:

- `THEME_CHANGED` - Project loaded/changed
- `VALIDATION_UPDATED` - Validation completed
- `BUILD_STARTED` - Build process started
- `BUILD_COMPLETED` - Build process finished
- `NAVIGATION_CHANGED` - Page changed

## Browser Support

- Modern browsers with ES6 support
- Chrome, Firefox, Safari, Edge
- GitHub Pages compatible
- No build step required
- No external dependencies

## Development

### Running Locally

```bash
# Open in browser
open tools/theme-builder/index.html

# Or serve via HTTP
python -m http.server 8000
# Visit http://localhost:8000/tools/theme-builder/
```

### Console API

```javascript
// Check application status
window.ThemeBuilder.app.getInfo();

// Access current state
window.ThemeBuilder.appState.getState();

// Manually load project
await window.ThemeBuilder.app.loadProject(files);

// Validate
await window.ThemeBuilder.app.validateProject();

// Build
await window.ThemeBuilder.app.buildProject();
```

## Theme Builder V1 Freeze

Theme Builder V1 is **frozen** as a stable compiler as of TB-4.6 (Theme
Builder Runtime Alignment) — the point where a compiled `.vtheme` first
imports into VihuStudio without manual editing, compatibility shims, or a
conversion step. Verified end-to-end by
`tools/theme-builder/verify/goldenBuild.js`, which drives the real Theme
Builder tool and the real VihuStudio runtime through
Validate → Compile → Import → Register → Render.

Future visual editing features go into **Theme Designer V2**, which will reuse the Theme Builder compiler underneath.

Workflow will be:

```
Theme Designer (Visual Editing)
           ↓
Theme Builder (Compiler)
           ↓
.vtheme Package
           ↓
VihuStudio Import
```

## Roadmap

**TB-2** - Complete
✓ Project loading
✓ Validation engine
✓ Build engine
✓ Package generation

**TB-4.5** - Complete
✓ `docs/THEME_PROJECT_SPEC.md` — canonical Theme Project specification

**TB-4.6** - Complete
✓ Manifest contract aligned on `minStudioVersion` (Theme Builder, Theme
  Registry, Theme Engine, both spec docs)
✓ Compiled package aligned on the canonical flat `{manifest, theme,
  assets}` format
✓ Real reference/duplicate-id validation
✓ `docs/VTHEME_PACKAGE_SPEC.md` — canonical compiled-package specification
✓ Golden build verification (`tools/theme-builder/verify/goldenBuild.js`)

**TB-4.7 (Current)** - Complete
✓ Optional `representations/` folder — validated (duplicate ids,
  layout/defaultFrame reference checks) and compiled into
  `theme.representations`
✓ Theme Import registers a package's `representations` the same way it
  already does layouts/frames/layer-packs
✓ Studio's Creation Flow / Context Panel read Representations from the
  active theme instead of a hardcoded Museum Gallery list — see
  `docs/THEME_PROJECT_SPEC.md` §8

**TB-3** (Future)  
- Theme Designer UI
- Visual frame editor
- Layout editor
- Live preview

**TB-4** (Future)  
- Publishing
- Version management
- Theme marketplace

## License

Part of VihuStudio. All rights reserved.

## Support

For issues with Theme Builder, check:

1. Validation report for specific errors
2. Console for debug logs (F12 → Console)
3. Theme project structure against documentation
4. File formats (JSON validity, required fields)
