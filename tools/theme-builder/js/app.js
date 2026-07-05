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
     * Validate current project
     */
    async validateProject() {
        if (!projectLoader.isLoaded()) {
            ui.showNotification('No project loaded', 'warning');
            return;
        }

        ui.setLoading(true);
        const result = await validator.validate();
        appState.setValidationState(result.isValid ? VALIDATION_STATES.VALID : VALIDATION_STATES.INVALID);
        ui.setLoading(false);

        return result;
    }

    /**
     * Build current project
     */
    async buildProject() {
        if (!projectLoader.isLoaded()) {
            ui.showNotification('No project loaded', 'warning');
            return;
        }

        ui.setLoading(true);
        appState.setBuildState(BUILD_STATES.BUILDING);

        const result = await builder.build();
        
        appState.setBuildState(result.success ? BUILD_STATES.SUCCESS : BUILD_STATES.ERROR);
        ui.setLoading(false);

        return result;
    }

    /**
     * Load a theme project
     */
    async loadProject(files) {
        ui.setLoading(true);
        const result = await projectLoader.loadProjectFromFiles(files);
        ui.setLoading(false);
        return result;
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

// Expose global API for debugging and programmatic access
window.ThemeBuilder = {
    app,
    appState,
    eventBus,
    router,
    ui,
    projectLoader,
    validator,
    builder,
    constants: {
        PAGES,
        EVENTS,
        VALIDATION_STATES,
        BUILD_STATES
    }
};
