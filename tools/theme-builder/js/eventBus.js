// Event Bus - Lightweight event system for decoupled communication

class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);

        // Return unsubscribe function
        return () => {
            this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
        };
    }

    /**
     * Subscribe to an event once
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function
     */
    once(eventName, callback) {
        const unsubscribe = this.on(eventName, (...args) => {
            callback(...args);
            unsubscribe();
        });
    }

    /**
     * Emit an event
     * @param {string} eventName - Name of the event
     * @param {*} data - Data to pass to subscribers
     */
    emit(eventName, data) {
        if (!this.events[eventName]) {
            return;
        }

        this.events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${eventName}:`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event
     * @param {string} eventName - Name of the event
     */
    off(eventName) {
        if (this.events[eventName]) {
            this.events[eventName] = [];
        }
    }

    /**
     * Remove all listeners
     */
    clear() {
        this.events = {};
    }
}

// Create global event bus instance
const eventBus = new EventBus();
