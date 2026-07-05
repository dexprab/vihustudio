# Theme Builder

A standalone web application for authoring, validating, and building official VihuStudio themes.

## Purpose

Theme Builder is the birthplace of every Official Theme. It provides a professional, creative studio environment for theme authors to:

- Create and configure themes
- Organize layouts and frames
- Manage layers and assets
- Validate theme structure
- Build and package themes

## Architecture

Theme Builder is built as a single-page application (SPA) using vanilla JavaScript, HTML, and CSS—matching VihuStudio's technology stack.

### Core Modules

- **constants.js** - Application constants and configuration
- **eventBus.js** - Lightweight event system for decoupled communication
- **state.js** - Central state management
- **ui.js** - UI rendering and interaction
- **router.js** - Client-side routing
- **app.js** - Main application orchestration

### State Management

The application maintains central state through `ThemeBuilderState`:

- `currentTheme` - Active theme project
- `selectedSection` - Current workspace page
- `isDirty` - Unsaved changes flag
- `validationState` - Theme validation status
- `buildState` - Build process state
- `themes` - List of available themes

### Event System

Communication between modules uses `EventBus`:

- `themeChanged` - Theme was modified
- `sectionChanged` - User navigated to a new section
- `validationUpdated` - Validation state changed
- `buildStarted` - Build process started
- `buildCompleted` - Build process completed
- `stateUpdated` - State changed

## Folder Structure

```
tools/
  theme-builder/
    index.html              # Application shell
    css/
      theme-builder.css    # Styles
    js/
      app.js              # Main application
      router.js           # Navigation routing
      ui.js               # UI management
      state.js            # State management
      eventBus.js         # Event system
      constants.js        # Constants
    assets/               # Images, icons, etc.
    themes/               # Theme projects
    README.md            # This file
```

## Workspace Pages

### Dashboard
Overview of theme projects and recent activity.

### Theme
Configure theme properties, metadata, and settings.

### Layouts
Design and manage theme layouts.

### Frames
Create and organize frame components.

### Layers
Organize and manage layer packs.

### Assets
Upload and manage theme assets.

### Preview
Preview theme rendering (future).

### Build
Build and package themes (future).

## Theme Model

Each theme is a complete project containing:

```javascript
{
  id: "unique-id",
  name: "Museum Gallery",
  version: "1.0.0",
  created: "2026-07-05T00:00:00Z",
  manifest: {},           // Theme manifest
  metadata: {},           // Theme metadata
  layouts: [],            // Layout definitions
  frames: [],             // Frame components
  layers: [],             // Layer packs
  assets: [],             // Asset files
  buildOutput: null       // Compiled theme
}
```

## Usage

### Initialize Application

```javascript
// Automatically initializes on DOM ready
app.init();
```

### Create a Theme

```javascript
const theme = app.createTheme('My Theme');
```

### Navigate

```javascript
router.navigateTo('theme');
appState.setSelectedSection('layouts');
```

### Build

```javascript
app.buildTheme();
```

### Global Access (Development)

```javascript
// Access via window.ThemeBuilder
window.ThemeBuilder.app
window.ThemeBuilder.appState
window.ThemeBuilder.eventBus
window.ThemeBuilder.ui
window.ThemeBuilder.router
```

## Future Roadmap

**Sprint TB-2**
- Theme validation system
- Theme compiler
- Theme packaging

**Sprint TB-3**
- Theme preview rendering
- Theme import/export
- Theme designer UI

**Sprint TB-4**
- Theme publishing
- Version management
- Collaboration features

## Design Language

- Professional, minimal aesthetic
- Large, generous spacing
- Clean typography
- Creative studio feel
- No developer-oriented UI

## Code Quality

- Small, focused modules
- Clear, descriptive naming
- No duplicate logic
- No placeholder code
- Production-ready quality

## Relationship with VihuStudio

Theme Builder is the official tool for creating VihuStudio themes. All official themes (Museum Gallery, Storybook Classic, Comic Pop, Sketchbook, Watercolor Portfolio) are authored here.

Themes created in Theme Builder integrate directly with VihuStudio's theme system.

## Browser Support

- Modern browsers with ES6 support
- GitHub Pages compatible
- No build step required
- No external dependencies
