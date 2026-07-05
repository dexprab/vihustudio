// Theme Builder State Management

class ThemeBuilderState {
    constructor() {
        this.state = {
            currentTheme: null,
            selectedSection: PAGES.DASHBOARD,
            isDirty: false,
            validationState: VALIDATION_STATES.UNKNOWN,
            buildState: BUILD_STATES.READY,
            themes: [],
            currentProject: null
        };

        this.listeners = [];
    }

    /**
     * Get the current state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Set a piece of state
     * @param {string} key - State key
     * @param {*} value - New value
     */
    setState(key, value) {
        if (this.state[key] !== value) {
            this.state[key] = value;
            this.notifyListeners();
            eventBus.emit(EVENTS.STATE_UPDATED, { key, value, state: this.getState() });
        }
    }

    /**
     * Set multiple state values
     * @param {Object} updates - Object with key-value pairs to update
     */
    setMultiple(updates) {
        let changed = false;
        for (const [key, value] of Object.entries(updates)) {
            if (this.state[key] !== value) {
                this.state[key] = value;
                changed = true;
            }
        }

        if (changed) {
            this.notifyListeners();
            eventBus.emit(EVENTS.STATE_UPDATED, { updates, state: this.getState() });
        }
    }

    /**
     * Set current theme
     * @param {Object|null} theme - Theme object or null
     */
    setCurrentTheme(theme) {
        this.setState('currentTheme', theme);
        if (theme) {
            eventBus.emit(EVENTS.THEME_CHANGED, theme);
        }
    }

    /**
     * Set selected section
     * @param {string} section - Section name (from PAGES)
     */
    setSelectedSection(section) {
        this.setState('selectedSection', section);
        eventBus.emit(EVENTS.SECTION_CHANGED, section);
    }

    /**
     * Set dirty flag (unsaved changes)
     * @param {boolean} isDirty
     */
    setIsDirty(isDirty) {
        this.setState('isDirty', isDirty);
    }

    /**
     * Set validation state
     * @param {string} state - Validation state (from VALIDATION_STATES)
     */
    setValidationState(state) {
        this.setState('validationState', state);
        eventBus.emit(EVENTS.VALIDATION_UPDATED, state);
    }

    /**
     * Set build state
     * @param {string} state - Build state (from BUILD_STATES)
     */
    setBuildState(state) {
        this.setState('buildState', state);
        if (state === BUILD_STATES.BUILDING) {
            eventBus.emit(EVENTS.BUILD_STARTED);
        } else if (state === BUILD_STATES.SUCCESS || state === BUILD_STATES.ERROR) {
            eventBus.emit(EVENTS.BUILD_COMPLETED, { state });
        }
    }

    /**
     * Register a state listener
     * @param {Function} listener - Callback function called on state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners of state change
     */
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.getState());
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Reset state to initial values
     */
    reset() {
        this.state = {
            currentTheme: null,
            selectedSection: PAGES.DASHBOARD,
            isDirty: false,
            validationState: VALIDATION_STATES.UNKNOWN,
            buildState: BUILD_STATES.READY,
            themes: [],
            currentProject: null
        };
        this.notifyListeners();
    }
}

// Create global state instance
const appState = new ThemeBuilderState();
