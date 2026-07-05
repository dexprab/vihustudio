// Theme Builder - Main Application

class ThemeBuilderApp {
    constructor() {
        this.version = TB_VERSION;
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    init() {
        if (this.initialized) {
            console.warn('Application already initialized');
            return;
        }

        console.log(`Initializing ${TB_NAME} v${this.version}`);

        // Set initial state
        appState.setSelectedSection(PAGES.DASHBOARD);
        appState.setValidationState(VALIDATION_STATES.UNKNOWN);
        appState.setBuildState(BUILD_STATES.READY);

        // Initialize UI
        ui.initialize();

        // Handle hash navigation
        const hashPage = ThemeBuilderRouter.getHashPage();
        if (hashPage !== PAGES.DASHBOARD) {
            router.navigateTo(hashPage, false);
        }

        // Setup event listeners
        this.setupEventListeners();

        this.initialized = true;
        console.log(`${TB_NAME} initialized successfully`);
    }

    /**
     * Setup application-wide event listeners
     */
    setupEventListeners() {
        // Listen for state changes
        appState.subscribe((state) => {
            console.log('State updated:', state);
        });

        // Listen for navigation changes
        eventBus.on(EVENTS.NAVIGATION_CHANGED, (page) => {
            console.log('Navigated to:', page);
        });

        // Listen for theme changes
        eventBus.on(EVENTS.THEME_CHANGED, (data) => {
            console.log('Theme changed:', data);
        });

        // Listen for build events
        eventBus.on(EVENTS.BUILD_STARTED, () => {
            appState.setBuildState(BUILD_STATES.BUILDING);
            ui.setLoading(true);
            console.log('Build started');
        });

        eventBus.on(EVENTS.BUILD_COMPLETED, (data) => {
            appState.setBuildState(data.state || BUILD_STATES.SUCCESS);
            ui.setLoading(false);
            console.log('Build completed:', data);
        });

        // Listen for validation updates
        eventBus.on(EVENTS.VALIDATION_UPDATED, (state) => {
            console.log('Validation updated:', state);
        });
    }

    /**
     * Create a new theme project
     */
    createTheme(name) {
        const theme = {
            id: Date.now().toString(),
            name: name,
            version: '0.0.1',
            created: new Date().toISOString(),
            manifest: {},
            metadata: {},
            layouts: [],
            frames: [],
            layers: [],
            assets: [],
            buildOutput: null
        };

        appState.setCurrentTheme(theme);
        appState.setIsDirty(true);
        return theme;
    }

    /**
     * Save current theme
     */
    saveTheme() {
        const state = appState.getState();
        if (!state.currentTheme) {
            ui.showNotification('No theme to save', 'warning');
            return false;
        }

        console.log('Saving theme:', state.currentTheme);
        appState.setIsDirty(false);
        ui.showNotification('Theme saved successfully', 'success');
        return true;
    }

    /**
     * Build current theme
     */
    buildTheme() {
        const state = appState.getState();
        if (!state.currentTheme) {
            ui.showNotification('No theme to build', 'warning');
            return;
        }

        eventBus.emit(EVENTS.BUILD_STARTED);

        // Simulate build process
        setTimeout(() => {
            appState.setBuildState(BUILD_STATES.SUCCESS);
            eventBus.emit(EVENTS.BUILD_COMPLETED, { state: BUILD_STATES.SUCCESS });
            ui.showNotification('Theme built successfully', 'success');
        }, 2000);
    }

    /**
     * Get application info
     */
    getInfo() {
        return {
            name: TB_NAME,
            version: this.version,
            initialized: this.initialized,
            currentPage: router.getCurrentPage(),
            state: appState.getState()
        };
    }
}

// Create global app instance
const app = new ThemeBuilderApp();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Expose global API for debugging
window.ThemeBuilder = {
    app,
    appState,
    eventBus,
    router,
    ui,
    constants: {
        PAGES,
        EVENTS,
        VALIDATION_STATES,
        BUILD_STATES
    }
};
