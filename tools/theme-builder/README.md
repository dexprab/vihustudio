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
├── assets/                (Required: theme assets)
├── preview.png            (Recommended: preview image)
├── thumbnail.png          (Recommended: thumbnail)
└── README.md              (Recommended: documentation)
```

### manifest.json

```json
{
  "name": "Museum Gallery",
  "id": "museum-gallery",
  "version": "1.0.0",
  "author": "VihuStudio",
  "minimumStudioVersion": "1.0.0",
  "description": "A classic gallery-inspired theme"
}
```

### metadata.json

```json
{
  "displayName": "Museum Gallery",
  "description": "A classic gallery-inspired theme",
  "category": "Portfolio",
  "tags": ["gallery", "portfolio", "classic"],
  "colors": ["#000000", "#FFFFFF"]
}
```

### theme.json

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "layouts": ["gallery", "list", "grid"],
  "frames": ["hero", "content", "footer"]
}
```

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
- ✓ All referenced files exist
- ✓ No broken asset paths
- ✓ No missing dependencies

## Build Engine

Converts validated themes into `.vtheme` packages:

### Build Process
1. **Validate** - Run full validation (prevents invalid builds)
2. **Package** - Organize all files
3. **Generate** - Create `.vtheme` file
4. **Report** - Display build summary

### Package Format

`.vtheme` files contain:

```json
{
  "version": "1.0",
  "format": "vtheme",
  "manifest": {...},
  "metadata": {...},
  "theme": {...},
  "layouts": [...],
  "frames": [...],
  "layerPacks": [...],
  "assets": [...],
  "preview": "included",
  "thumbnail": "included",
  "readme": "included",
  "builtAt": "2026-07-05T00:00:00Z",
  "builtWith": "Theme Builder v1.0.0-TB"
}
```

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

After TB-2 completion, Theme Builder V1 is **frozen** as a stable compiler.

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

**TB-2 (Current)** - Complete  
✓ Project loading  
✓ Validation engine  
✓ Build engine  
✓ Package generation  

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
