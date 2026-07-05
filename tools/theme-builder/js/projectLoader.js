// Theme Project Detector and Loader

class ProjectLoader {
    constructor() {
        this.currentProject = null;
        this.projectStructure = null;
    }

    /**
     * Load a theme project from a folder (via file input)
     * @param {FileList} files - Files from input
     * @returns {Promise<Object>} Project data or error
     */
    async loadProjectFromFiles(files) {
        try {
            const project = {
                name: null,
                version: null,
                author: null,
                description: null,
                files: {},
                structure: {}
            };

            // Convert FileList to array and organize by path
            const fileArray = Array.from(files);
            
            // Extract root folder name
            const rootFolder = fileArray[0].webkitRelativePath.split('/')[0];
            project.name = rootFolder;

            // Organize files by category
            for (const file of fileArray) {
                const relativePath = file.webkitRelativePath.substring(rootFolder.length + 1);
                if (!relativePath) continue;

                project.files[relativePath] = file;

                // Categorize files
                if (relativePath === 'manifest.json') {
                    const content = await this.readFile(file);
                    project.manifest = this.parseJSON(content);
                } else if (relativePath === 'metadata.json') {
                    const content = await this.readFile(file);
                    project.metadata = this.parseJSON(content);
                } else if (relativePath === 'theme.json') {
                    const content = await this.readFile(file);
                    project.theme = this.parseJSON(content);
                }
            }

            // Extract metadata for display
            if (project.manifest) {
                project.version = project.manifest.version;
                project.author = project.manifest.author;
            }
            if (project.metadata) {
                project.description = project.metadata.description;
            }

            this.currentProject = project;
            this.buildStructure();

            return { success: true, project };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Read file content as text
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
        });
    }

    /**
     * Parse JSON safely
     */
    parseJSON(content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Build project structure map
     */
    buildStructure() {
        if (!this.currentProject) return;

        this.projectStructure = {
            hasManifest: 'manifest.json' in this.currentProject.files,
            hasMetadata: 'metadata.json' in this.currentProject.files,
            hasTheme: 'theme.json' in this.currentProject.files,
            hasLayouts: this.hasFolder('layouts'),
            hasFrames: this.hasFolder('frames'),
            hasLayerPacks: this.hasFolder('layer-packs'),
            hasAssets: this.hasFolder('assets'),
            hasPreview: this.hasFile('preview.png'),
            hasThumbnail: this.hasFile('thumbnail.png'),
            hasReadme: this.hasFile('README.md'),
            files: this.currentProject.files,
            folders: this.extractFolders()
        };
    }

    /**
     * Check if folder exists
     */
    hasFolder(folderName) {
        if (!this.currentProject) return false;
        return Object.keys(this.currentProject.files).some(path => 
            path.startsWith(folderName + '/')
        );
    }

    /**
     * Check if specific file exists
     */
    hasFile(fileName) {
        if (!this.currentProject) return false;
        return fileName in this.currentProject.files;
    }

    /**
     * Extract all folders in project
     */
    extractFolders() {
        if (!this.currentProject) return {};

        const folders = {};
        for (const path of Object.keys(this.currentProject.files)) {
            const parts = path.split('/');
            if (parts.length > 1) {
                const folder = parts[0];
                if (!folders[folder]) {
                    folders[folder] = [];
                }
                folders[folder].push(path);
            }
        }
        return folders;
    }

    /**
     * Get project info
     */
    getProjectInfo() {
        if (!this.currentProject) return null;

        return {
            name: this.currentProject.name,
            version: this.currentProject.version || 'unknown',
            author: this.currentProject.author || 'unknown',
            description: this.currentProject.description || 'No description',
            fileCount: Object.keys(this.currentProject.files).length,
            structure: this.projectStructure
        };
    }

    /**
     * Get file content
     */
    async getFileContent(relativePath) {
        if (!this.currentProject) return null;
        const file = this.currentProject.files[relativePath];
        if (!file) return null;
        return await this.readFile(file);
    }

    /**
     * Get all files in folder
     */
    getFilesInFolder(folderName) {
        if (!this.projectStructure) return [];
        return this.projectStructure.folders[folderName] || [];
    }

    /**
     * Reset project
     */
    reset() {
        this.currentProject = null;
        this.projectStructure = null;
    }

    /**
     * Check if project is loaded
     */
    isLoaded() {
        return this.currentProject !== null;
    }
}

// Create global project loader instance
const projectLoader = new ProjectLoader();
