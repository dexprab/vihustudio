// Theme Builder Router

class ThemeBuilderRouter {
    constructor() {
        this.currentPage = PAGES.DASHBOARD;
        this.history = [PAGES.DASHBOARD];
        this.setupRouting();
    }

    /**
     * Setup browser history API
     */
    setupRouting() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const page = e.state?.page || PAGES.DASHBOARD;
            this.navigateTo(page, false);
        });

        // Initialize with current page
        this.pushState(this.currentPage);
    }

    /**
     * Navigate to a page
     * @param {string} page - Page name (from PAGES)
     * @param {boolean} addToHistory - Whether to add to browser history
     */
    navigateTo(page, addToHistory = true) {
        if (!PAGES[page.toUpperCase()] && !Object.values(PAGES).includes(page)) {
            console.warn(`Invalid page: ${page}`);
            return;
        }

        this.currentPage = page;
        appState.setSelectedSection(page);

        if (addToHistory) {
            this.pushState(page);
        }

        this.updatePageTitle(page);
    }

    /**
     * Push state to browser history
     */
    pushState(page) {
        const title = PAGE_METADATA[page]?.title || TB_NAME;
        window.history.pushState(
            { page },
            title,
            `#${page}`
        );
    }

    /**
     * Update page title
     */
    updatePageTitle(page) {
        const metadata = PAGE_METADATA[page];
        if (metadata) {
            document.title = `${metadata.title} - ${TB_NAME}`;
        }
    }

    /**
     * Get current page
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get browser hash
     */
    static getHashPage() {
        const hash = window.location.hash.slice(1);
        return Object.values(PAGES).includes(hash) ? hash : PAGES.DASHBOARD;
    }
}

// Create global router instance
const router = new ThemeBuilderRouter();
