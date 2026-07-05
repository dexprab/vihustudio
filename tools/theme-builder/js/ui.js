// Theme Builder UI Module - Updated for TB-2

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
            actionValidate: document.getElementById('actionValidate'),
            actionLoad: document.getElementById('actionLoad'),
            fileInput: document.getElementById('fileInput'),
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

        // File input for project loading
        if (this.elements.actionLoad) {
            this.elements.actionLoad.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    await this.handleProjectLoad(files);
                }
                // Reset input
                this.elements.fileInput.value = '';
            });
        }

        // Action buttons
        if (this.elements.actionValidate) {
            this.elements.actionValidate.addEventListener('click', async () => {
                await this.handleValidation();
            });
        }

        if (this.elements.actionBuild) {
            this.elements.actionBuild.addEventListener('click', async () => {
                await this.handleBuild();
            });
        }

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
     * Handle project folder loading
     */
    async handleProjectLoad(files) {
        this.setLoading(true);
        const result = await projectLoader.loadProjectFromFiles(files);

        if (!result.success) {
            this.showNotification(`Failed to load project: ${result.error}`, 'error');
            this.setLoading(false);
            return;
        }

        const projectInfo = projectLoader.getProjectInfo();
        appState.setCurrentTheme({
            name: projectInfo.name,
            version: projectInfo.version,
            author: projectInfo.author,
            description: projectInfo.description,
            fileCount: projectInfo.fileCount
        });

        this.showNotification(`Project loaded: ${projectInfo.name}`, 'success');
        this.renderDashboard(projectInfo);
        this.setLoading(false);
    }

    /**
     * Handle validation
     */
    async handleValidation() {
        if (!projectLoader.isLoaded()) {
            this.showNotification('No project loaded', 'warning');
            return;
        }

        this.setLoading(true);
        const validationResult = await validator.validate();
        const report = validator.formatReport(validationResult);

        this.renderValidationReport(report);
        appState.setValidationState(report.status);

        if (report.status === 'VALID') {
            this.showNotification('Validation passed!', 'success');
        } else {
            this.showNotification(`Validation failed: ${report.errorCount} error(s)`, 'error');
        }

        this.setLoading(false);
    }

    /**
     * Handle build
     */
    async handleBuild() {
        if (!projectLoader.isLoaded()) {
            this.showNotification('No project loaded', 'warning');
            return;
        }

        this.setLoading(true);
        appState.setBuildState(BUILD_STATES.BUILDING);

        const buildResult = await builder.build();
        const report = builder.formatReport(buildResult);

        if (buildResult.success) {
            this.renderBuildReport(report, buildResult);
            appState.setBuildState(BUILD_STATES.SUCCESS);
            this.showNotification(`Build successful! Package: ${report.packageSize}`, 'success');
            
            // Offer download
            setTimeout(() => {
                builder.downloadPackage(buildResult.packageFile);
            }, 500);
        } else {
            this.renderBuildReport(report, buildResult);
            appState.setBuildState(BUILD_STATES.ERROR);
            this.showNotification('Build failed', 'error');
        }

        this.setLoading(false);
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
     * Render dashboard with project info
     */
    renderDashboard(projectInfo) {
        const html = `
            <div class="workspace-page dashboard">
                <div class="page-header">
                    <h2>Dashboard</h2>
                    <p>Theme Builder Compiler</p>
                </div>
                <div class="page-content">
                    <div class="dashboard-grid">
                        <div class="dashboard-card">
                            <div class="card-label">Project Name</div>
                            <div class="card-value">${projectInfo.name}</div>
                        </div>
                        <div class="dashboard-card">
                            <div class="card-label">Version</div>
                            <div class="card-value">${projectInfo.version}</div>
                        </div>
                        <div class="dashboard-card">
                            <div class="card-label">Author</div>
                            <div class="card-value">${projectInfo.author}</div>
                        </div>
                        <div class="dashboard-card">
                            <div class="card-label">Files</div>
                            <div class="card-value">${projectInfo.fileCount}</div>
                        </div>
                    </div>
                    <div class="dashboard-section">
                        <h3>Project Structure</h3>
                        <div class="structure-check">
                            <div class="check-item ${projectInfo.structure.hasManifest ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasManifest ? '✓' : '✗'} manifest.json
                            </div>
                            <div class="check-item ${projectInfo.structure.hasMetadata ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasMetadata ? '✓' : '✗'} metadata.json
                            </div>
                            <div class="check-item ${projectInfo.structure.hasTheme ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasTheme ? '✓' : '✗'} theme.json
                            </div>
                            <div class="check-item ${projectInfo.structure.hasLayouts ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasLayouts ? '✓' : '✗'} layouts/
                            </div>
                            <div class="check-item ${projectInfo.structure.hasFrames ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasFrames ? '✓' : '✗'} frames/
                            </div>
                            <div class="check-item ${projectInfo.structure.hasLayerPacks ? 'valid' : 'invalid'}">
                                ${projectInfo.structure.hasLayerPacks ? '✓' : '✗'} layer-packs/
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.elements.workspaceContainer.innerHTML = html;
    }

    /**
     * Render validation report
     */
    renderValidationReport(report) {
        const errorsHtml = report.errors.length > 0 ? `
            <div class="report-section errors">
                <h4>Errors (${report.errorCount})</h4>
                <ul>
                    ${report.errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        const warningsHtml = report.warnings.length > 0 ? `
            <div class="report-section warnings">
                <h4>Warnings (${report.warningCount})</h4>
                <ul>
                    ${report.warnings.map(warn => `<li>${warn}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        const statusClass = report.status === 'VALID' ? 'success' : 'error';
        const html = `
            <div class="workspace-page validation-report">
                <div class="page-header">
                    <h2>Validation Report</h2>
                </div>
                <div class="page-content">
                    <div class="report-status ${statusClass}">
                        Status: ${report.status}
                    </div>
                    ${errorsHtml}
                    ${warningsHtml}
                    ${report.errors.length === 0 && report.warnings.length === 0 ? '<p class="success-message">All checks passed!</p>' : ''}
                </div>
            </div>
        `;

        this.elements.workspaceContainer.innerHTML = html;
    }

    /**
     * Render build report
     */
    renderBuildReport(report, buildResult) {
        const statusClass = buildResult.success ? 'success' : 'error';
        const html = `
            <div class="workspace-page build-report">
                <div class="page-header">
                    <h2>Build Report</h2>
                </div>
                <div class="page-content">
                    <div class="report-status ${statusClass}">
                        ${buildResult.success ? '✓ Build Successful' : '✗ Build Failed'}
                    </div>
                    <div class="report-details">
                        <div class="detail-row">
                            <span class="label">Theme Name:</span>
                            <span class="value">${report.themeName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Version:</span>
                            <span class="value">${report.version}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Build Time:</span>
                            <span class="value">${report.buildTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Package Size:</span>
                            <span class="value">${report.packageSize}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Timestamp:</span>
                            <span class="value">${new Date(report.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    ${buildResult.success ? '<p class="success-message">Package ready for download</p>' : ''}
                    ${buildResult.errors.length > 0 ? `
                        <div class="report-section errors">
                            <h4>Build Errors</h4>
                            <ul>
                                ${buildResult.errors.map(err => `<li>${err}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        this.elements.workspaceContainer.innerHTML = html;
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
                    <p>Select "Load Project" to begin.</p>
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
        const themeName = state.currentTheme ? state.currentTheme.name : 'No Project';
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

        // Enable/disable build button based on validation
        if (this.elements.actionBuild) {
            this.elements.actionBuild.disabled = state.validationState !== VALIDATION_STATES.VALID;
        }
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
                <h3 class="panel-section-title">No Project Loaded</h3>
                <p style="font-size: 12px; color: var(--color-text-secondary);">Click "Load Project" to begin.</p>
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
        if (this.elements.actionBuild) this.elements.actionBuild.disabled = isLoading;
        if (this.elements.actionValidate) this.elements.actionValidate.disabled = isLoading;
        if (this.elements.actionLoad) this.elements.actionLoad.disabled = isLoading;
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
