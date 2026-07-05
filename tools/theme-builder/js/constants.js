// Theme Builder Constants

const TB_VERSION = '1.2.0-TB';
const TB_NAME = 'Theme Builder';

const PAGES = {
    DASHBOARD: 'dashboard',
    THEME: 'theme',
    LAYOUTS: 'layouts',
    FRAMES: 'frames',
    LAYERS: 'layers',
    ASSETS: 'assets',
    PREVIEW: 'preview',
    BUILD: 'build'
};

const PAGE_METADATA = {
    [PAGES.DASHBOARD]: {
        title: 'Dashboard',
        description: 'Overview of your theme project',
        icon: '📊'
    },
    [PAGES.THEME]: {
        title: 'Theme',
        description: 'Configure theme properties and settings',
        icon: '🎨'
    },
    [PAGES.LAYOUTS]: {
        title: 'Layouts',
        description: 'Design theme layouts',
        icon: '📐'
    },
    [PAGES.FRAMES]: {
        title: 'Frames',
        description: 'Manage frame components',
        icon: '🖼️'
    },
    [PAGES.LAYERS]: {
        title: 'Layers',
        description: 'Organize layer packs',
        icon: '📚'
    },
    [PAGES.ASSETS]: {
        title: 'Assets',
        description: 'Manage theme assets',
        icon: '📦'
    },
    [PAGES.PREVIEW]: {
        title: 'Preview',
        description: 'Preview theme rendering',
        icon: '👁️'
    },
    [PAGES.BUILD]: {
        title: 'Build',
        description: 'Build and package theme',
        icon: '🔨'
    }
};

const VALIDATION_STATES = {
    VALID: 'Valid',
    INVALID: 'Invalid',
    PENDING: 'Pending',
    UNKNOWN: 'Unknown'
};

const BUILD_STATES = {
    READY: 'ready',
    BUILDING: 'building',
    SUCCESS: 'success',
    ERROR: 'error'
};

const EVENTS = {
    THEME_CHANGED: 'themeChanged',
    SECTION_CHANGED: 'sectionChanged',
    VALIDATION_UPDATED: 'validationUpdated',
    BUILD_COMPLETED: 'buildCompleted',
    BUILD_STARTED: 'buildStarted',
    STATE_UPDATED: 'stateUpdated',
    NAVIGATION_CHANGED: 'navigationChanged'
};

// TB-4.6 — Runtime Alignment. These enums mirror the exact contract
// docs/THEME_PROJECT_SPEC.md defines and js/themeRegistry.js /
// renderer/slideRenderer.js already consume, so the validator checks
// against the same values the importer and renderer do.
const THEME_TYPES = ['story', 'artwork'];
const DEFAULT_THEME_TYPE = 'story';
const LAYOUT_ASPECTS = ['portrait', 'landscape', 'square', 'wide', 'quote', 'full-bleed'];
const LAYER_TYPES = ['text', 'sticker', 'decoration'];
const LAYER_TARGETS = ['slide', 'frame', 'holder', 'element'];
