// Theme Builder UI Module

class ThemeBuilderUI {
    constructor() {
        this.elements = this.cacheElements();
        this.setupEventListeners();
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        return {
            header: document.getElementById('header'),
            navigation: document.getElementById('navigation'),
            main: document.getElementById('main'),
            workspaceContainer: document.getElementById('workspaceContainer'),
            infoPanel: document.getElementById('infoPanel'),
            panelContent: document.getElementById('panelContent'),
            footer: document.getElementById('footer'),
            navItems: document.querySelectorAll('.nav-item'),
            currentThemeName: document.getElementById('currentThemeName'),
            buildStatus: document.getElementById('buildStatus'),
            actionSave: document.getElementById('actionSave'),
            actionBuild: document.getElementById('actionBuild'),
            footerTheme: document.getElementById('footerTheme'),
            footerValidation: document.getElementById('footerValidation'),
            footerStatus: document.getElementById('footerStatus'),
            version: document.getElementById('version')
        };
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Navigation
        this.elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.handleNavigation(page);
            });
        });

        // Action buttons
        this.elements.actionSave.addEventListener('click', () => {
            eventBus.emit(EVENTS.THEME_CHANGED, { action: 'save' });
        });

        this.elements.actionBuild.addEventListener('click', () => {
            eventBus.emit(EVENTS.BUILD_STARTED);
        });

        // Subscribe to state changes
        appState.subscribe((state) => {
            this.updateUI(state);
        });

        // Subscribe to events
        eventBus.on(EVENTS.THEME_CHANGED, (data) => {
            this.onThemeChanged(data);
        });

        eventBus.on(EVENTS.VALIDATION_UPDATED, (state) => {
            this.onValidationUpdated(state);
        });

        eventBus.on(EVENTS.BUILD_COMPLETED, (data) => {
            this.onBuildCompleted(data);
        });
    }

    /**
     * Handle navigation to a page
     */
    handleNavigation(page) {
        appState.setSelectedSection(page);
        this.setActiveNavItem(page);
        this.renderWorkspace(page);
        eventBus.emit(EVENTS.NAVIGATION_CHANGED, page);
    }

    /**
     * Set active navigation item
     */
    setActiveNavItem(page) {
        this.elements.navItems.forEach(item => {
            if (item.dataset.page === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Render workspace for a page
     */
    renderWorkspace(page) {
        const metadata = PAGE_METADATA[page];
        if (!metadata) return;

        const html = `
            <div class="workspace-page">
                <div class="page-header">
                    <h2>${metadata.title}</h2>
                    <p>${metadata.description}</p>
                </div>
                <div class="page-content">
                    <p>Content for ${metadata.title} will be rendered here.</p>
                </div>
            </div>
        `;

        this.elements.workspaceContainer.innerHTML = html;
    }

    /**
     * Update UI based on state changes
     */
    updateUI(state) {
        // Update header
        const themeName = state.currentTheme ? state.currentTheme.name : '—';
        this.elements.currentThemeName.textContent = themeName;

        // Update build status
        const buildStatusClass = `status-${state.buildState}`;
        this.elements.buildStatus.textContent = state.buildState.charAt(0).toUpperCase() + state.buildState.slice(1);
        this.elements.buildStatus.className = `value ${buildStatusClass}`;

        // Update footer
        this.elements.footerTheme.textContent = themeName;
        this.elements.footerValidation.textContent = state.validationState;
        this.elements.footerStatus.textContent = state.buildState.charAt(0).toUpperCase() + state.buildState.slice(1);
        this.elements.footerStatus.className = `value status-${state.buildState}`;
    }

    /**
     * Update info panel with context-sensitive content
     */
    updateInfoPanel(content) {
        this.elements.panelContent.innerHTML = content;
    }

    /**
     * Render theme summary in info panel
     */
    renderThemeSummary(theme) {
        const html = theme ? `
            <div class="panel-section">
                <h3 class="panel-section-title">Theme Summary</h3>
                <div class="panel-items">
                    <div class="panel-item">
                        <div class="panel-label">Name</div>
                        <div class="panel-value">${theme.name}</div>
                    </div>
                    <div class="panel-item">
                        <div class="panel-label">Version</div>
                        <div class="panel-value">${theme.version || 'N/A'}</div>
                    </div>
                </div>
            </div>
            <div class="panel-section">
                <h3 class="panel-section-title">Validation Status</h3>
                <div class="panel-items">
                    <div class="panel-item">
                        <div class="panel-label">Status</div>
                        <div class="panel-value">${appState.getState().validationState}</div>
                    </div>
                </div>
            </div>
        ` : `
            <div class="panel-section">
                <h3 class="panel-section-title">No Theme Selected</h3>
                <p style="font-size: 12px; color: var(--color-text-secondary);">Select or create a theme to begin.</p>
            </div>
        `;

        this.updateInfoPanel(html);
    }

    /**
     * Handle theme changed event
     */
    onThemeChanged(data) {
        const state = appState.getState();
        this.renderThemeSummary(state.currentTheme);
    }

    /**
     * Handle validation updated event
     */
    onValidationUpdated(state) {
        const validationHtml = `
            <div class="panel-section">
                <h3 class="panel-section-title">Validation Status</h3>
                <div class="panel-items">
                    <div class="panel-item">
                        <div class="panel-label">Status</div>
                        <div class="panel-value">${state}</div>
                    </div>
                </div>
            </div>
        `;
        this.updateInfoPanel(validationHtml);
    }

    /**
     * Handle build completed event
     */
    onBuildCompleted(data) {
        console.log('Build completed:', data);
    }

    /**
     * Show loading state
     */
    setLoading(isLoading) {
        this.elements.actionBuild.disabled = isLoading;
        this.elements.actionSave.disabled = isLoading;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Future: Implement toast notification UI
    }

    /**
     * Initialize UI with default state
     */
    initialize() {
        const state = appState.getState();
        this.setActiveNavItem(state.selectedSection);
        this.renderWorkspace(state.selectedSection);
        this.renderThemeSummary(state.currentTheme);
        this.elements.version.textContent = TB_VERSION;
    }
}

// Create global UI instance
const ui = new ThemeBuilderUI();
