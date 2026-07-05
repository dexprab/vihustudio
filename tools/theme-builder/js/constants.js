// Theme Builder Constants

const TB_VERSION = '1.0.0-TB';
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
