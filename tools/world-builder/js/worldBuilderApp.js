// js/worldBuilderApp.js — Sprint B1.0 (Screens 1-2) + Sprint B1.1 (Builder
// Workspace). Wires Screen 1 (Welcome), Screen 2 (Choose a Template) and
// Screen 3 (Builder Workspace) together. Still no router, no state
// machine, no dashboard machinery survives from tools/theme-builder
// (docs/WORLD_BUILDER_ARCHITECTURE.md, LOCK 01/04) — three screens,
// switched by simple show/hide, is the entire Builder application.
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    const screenWelcome = $('wb-screen-welcome');
    const screenTemplates = $('wb-screen-templates');
    const screenWorkspace = $('wb-screen-workspace');
    const myWorldsList = $('wb-my-worlds-list');
    const myWorldsEmpty = $('wb-my-worlds-empty');
    const templateGrid = $('wb-template-grid');

    function _hideAllScreens() {
        screenWelcome.classList.add('wb-hidden');
        screenTemplates.classList.add('wb-hidden');
        screenWorkspace.classList.add('wb-hidden');
    }

    function showWelcome() {
        _hideAllScreens();
        screenWelcome.classList.remove('wb-hidden');
        renderMyWorlds();
    }

    function showTemplates() {
        _hideAllScreens();
        screenTemplates.classList.remove('wb-hidden');
    }

    function _timeAgo(iso) {
        const then = new Date(iso).getTime();
        const diffMs = Date.now() - then;
        const mins = Math.round(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
        const hours = Math.round(mins / 60);
        if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
        const days = Math.round(hours / 24);
        return days + (days === 1 ? ' day ago' : ' days ago');
    }

    // ---------------------------------------------------------------
    // Screen 1 — Welcome
    // ---------------------------------------------------------------

    function _projectCard(project) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-project-card';

        const thumb = document.createElement('span');
        thumb.className = 'wb-project-thumb';
        thumb.textContent = project.icon || '🌎';

        const info = document.createElement('div');
        info.className = 'wb-project-info';

        const name = document.createElement('span');
        name.className = 'wb-project-name';
        name.textContent = project.name;

        const metaLine = document.createElement('span');
        metaLine.className = 'wb-project-meta-line';

        const status = document.createElement('span');
        status.className = 'wb-project-status';
        status.textContent = project.status || 'draft';

        const updated = document.createTextNode('Edited ' + _timeAgo(project.updatedAt));

        metaLine.appendChild(status);
        metaLine.appendChild(updated);

        info.appendChild(name);
        info.appendChild(metaLine);

        card.appendChild(thumb);
        card.appendChild(info);

        card.addEventListener('click', function () {
            openWorkspace(project);
        });

        return card;
    }

    function renderMyWorlds() {
        const projects = window.ProjectStore ? window.ProjectStore.list() : [];
        myWorldsList.innerHTML = '';
        if (!projects.length) {
            myWorldsEmpty.classList.remove('wb-hidden');
            return;
        }
        myWorldsEmpty.classList.add('wb-hidden');
        projects.forEach(function (p) {
            myWorldsList.appendChild(_projectCard(p));
        });
    }

    // ---------------------------------------------------------------
    // Screen 2 — Choose a Template
    // ---------------------------------------------------------------

    function _templateCard(entry) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-template-card';
        card.dataset.templateId = entry.id;

        const icon = document.createElement('span');
        icon.className = 'wb-template-icon';
        icon.textContent = entry.icon;

        const title = document.createElement('span');
        title.className = 'wb-template-title';
        title.textContent = entry.title;

        const desc = document.createElement('p');
        desc.className = 'wb-template-desc';
        desc.textContent = entry.blurb || '';

        card.appendChild(icon);
        card.appendChild(title);
        card.appendChild(desc);

        // Template Rule: the moment a creator selects a template, the
        // template disappears — the Builder edits a World Project, never
        // a Template. Generation + opening the Workspace happen in the
        // same interaction, with no return trip to Screen 1/2.
        card.addEventListener('click', function () {
            if (card.classList.contains('wb-busy')) return;
            card.classList.add('wb-busy');
            const generated = window.WorldTemplates.generate(entry.id);
            if (!generated) { card.classList.remove('wb-busy'); return; }
            const project = window.ProjectStore.create(entry.id, generated);
            openWorkspace(project);
        });

        return card;
    }

    function renderTemplateGrid() {
        const templates = window.WorldTemplates ? window.WorldTemplates.list() : [];
        templateGrid.innerHTML = '';
        templates.forEach(function (t) {
            templateGrid.appendChild(_templateCard(t));
        });
    }

    $('wb-create-new').addEventListener('click', showTemplates);
    $('wb-back-to-welcome').addEventListener('click', showWelcome);

    // ---------------------------------------------------------------
    // Screen 3 — Builder Workspace
    // ---------------------------------------------------------------

    const NAV_ITEMS = [
        { id: 'overview', icon: '🏠', label: 'Overview' },
        { id: 'representations', icon: '🖼️', label: 'Representations' },
        { id: 'layouts', icon: '📐', label: 'Layouts' },
        { id: 'frames', icon: '🖌️', label: 'Frames' },
        { id: 'layerpacks', icon: '📚', label: 'Layer Packs' },
        { id: 'assets', icon: '📦', label: 'Assets' },
        { id: 'validation', icon: '✅', label: 'Validation' },
        { id: 'build', icon: '🔨', label: 'Build' },
        { id: 'publish', icon: '📤', label: 'Publish' }
    ];

    const CREATION_TYPE_ICONS = {
        story: '📖', artwork: '🖼️', quote: '💬', card: '💌',
        'artwork-collection': '🗂️', poem: '📝'
    };

    const ASPECT_RATIOS = {
        landscape: '4 / 3', portrait: '3 / 4', square: '1 / 1',
        wide: '16 / 9', quote: '3 / 4', 'full-bleed': '4 / 3'
    };

    // Sprint B2.0.1 — Builder Guidance. Every Workspace state opens with
    // a concise What/Why/Do/Next explanation so a creator never has to
    // leave the Builder to open a contract doc. Kept short on purpose —
    // this is a one-paragraph orientation, not documentation.
    const STATE_GUIDANCE = {
        overview: 'What: your World\'s identity — name, tagline, description, and how it introduces itself. Why: this is the card a child sees before picking your World. Do: fill in the fields below and upload a Thumbnail/Hero Image. Next: head to Representations to decide how creations look.',
        representations: 'What: the page styles a child can choose (e.g. Showcase, Portrait, Quote). Why: Studio\'s Creation Flow shows exactly these, nothing more. Do: pick or add a Representation, then set its Default Layout and Default Frame. Next: make sure every Layout/Frame you reference actually exists (see Layouts/Frames).',
        layouts: 'What: the geometry each page can use — aspect ratio, caption position, composition. Why: a Representation always points at one of these. Do: adjust Aspect/Composition/Spacing for the selected Layout, or add a new one. Next: design a Frame to go with it.',
        frames: 'What: the visual "mount" around the artwork — mat, border, wall colour, shadow. Why: a Representation\'s Default Frame decides how its pictures are presented. Do: tune the fields for the selected Frame, or create another. Next: connect Frames to Layer Packs for captions and decorations.',
        layerpacks: 'What: small elements placed on the page — captions, page numbers, stickers. Why: this is how a World adds its own personality on top of a Layout/Frame. Do: add Layers and set their Target Container/Anchor. Next: check Assets for anything these Layers need (like a decoration image).',
        assets: 'What: the images (and other files) this World needs. Why: Thumbnail and Hero Image are required before you can Build; everything else is optional polish. Do: upload what you have — the checklist shows exactly what\'s missing and why. Next: run Validation once everything looks complete.',
        validation: 'What: a real check of this World against the World Project Contract — the same rules Studio itself enforces. Why: catches problems before you spend time Building. Do: press Run Validation, then fix anything marked Error (Warnings are optional polish). Next: once it says "All Good!", move on to Build.',
        build: 'What: compiles this World Project into a real .vtheme package, the same file format VihuStudio imports. Why: nothing can be Published until it\'s Built. Do: press Build World Package (Validation must pass first). Next: once built, continue to Publish.',
        publish: 'What: share the World Package Build just produced. Why: a World only reaches VihuStudio once it leaves the Builder. Do: choose Export (download for backup/sharing) or Publish to Official Themes (installs it where Studio will find it). Next: open VihuStudio and confirm your World appears.'
    };

    function _stateIntro(navId) {
        const text = STATE_GUIDANCE[navId];
        if (!text) return;
        const parts = text.split(/(What:|Why:|Do:|Next:)/).filter(function (s) { return s.trim().length; });
        const box = document.createElement('div');
        box.className = 'wb-state-intro';
        for (let i = 0; i < parts.length; i += 2) {
            const label = parts[i];
            const body = parts[i + 1] || '';
            const p = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = label + ' ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(body.trim()));
            box.appendChild(p);
        }
        contextPanel.appendChild(box);
    }

    function _fieldHelp(text) {
        const p = document.createElement('p');
        p.className = 'wb-field-help';
        p.textContent = text;
        return p;
    }

    const workspaceNav = $('wb-workspace-nav');
    const workspaceName = $('wb-workspace-name');
    const workspaceHome = $('wb-workspace-home');
    const previewCanvas = $('wb-preview-canvas');
    const previewSelector = $('wb-preview-selector');
    const contextPanel = $('wb-context-panel');

    let currentProject = null;
    let currentNav = 'overview';
    let currentRepresentationId = null;
    let currentLayoutId = null;
    let currentFrameId = null;
    let currentLayerPackId = null;
    let currentLayerId = null;
    let lastValidation = null;

    workspaceHome.addEventListener('click', showWelcome);

    // ---------------------------------------------------------------
    // Header toolbar (Sprint B2.0.1 — Preview/Settings/Save/Menu, all
    // real, none decorative).
    // ---------------------------------------------------------------

    const btnPreview = $('wb-btn-preview');
    const btnSettings = $('wb-btn-settings');
    const btnSave = $('wb-btn-save');
    const btnMenu = $('wb-btn-menu');
    const menuDropdown = $('wb-menu-dropdown');
    const menuDuplicate = $('wb-menu-duplicate');
    const menuDelete = $('wb-menu-delete');
    const savedText = $('wb-workspace-saved-text');

    // Settings — Overview already IS "World Settings" (World Name /
    // Tagline / Description / Publisher / Version / Icon / Purpose /
    // Mood / Creation Types / Thumbnail / Hero Image, all writing
    // through immediately). Rather than build a second, duplicate
    // settings surface, Settings simply opens it.
    btnSettings.addEventListener('click', function () {
        currentNav = 'overview';
        _renderNav();
        _renderWorkspace();
    });

    // Save — every field already autosaves on change (ProjectStore.save
    // per edit); this button's job is an explicit, user-visible
    // confirmation that nothing is pending, not a second save mechanism.
    btnSave.addEventListener('click', function () {
        window.ProjectStore.save(currentProject);
        const original = savedText.textContent;
        btnSave.textContent = '✓ Saved';
        savedText.textContent = 'Saved just now';
        setTimeout(function () {
            btnSave.innerHTML = '💾 Save';
            savedText.textContent = original;
        }, 1500);
    });

    // Overflow menu — Duplicate/Delete, the two real, non-redundant
    // actions a Project Workspace needs. No dead entries.
    btnMenu.addEventListener('click', function (e) {
        e.stopPropagation();
        menuDropdown.classList.toggle('wb-hidden');
    });
    document.addEventListener('click', function () {
        menuDropdown.classList.add('wb-hidden');
    });
    menuDropdown.addEventListener('click', function (e) { e.stopPropagation(); });

    menuDuplicate.addEventListener('click', function () {
        window.ProjectStore.duplicate(currentProject);
        menuDropdown.classList.add('wb-hidden');
        showWelcome();
    });

    menuDelete.addEventListener('click', function () {
        if (!window.confirm('Delete "' + currentProject.name + '"? This cannot be undone.')) return;
        window.ProjectStore.remove(currentProject.id);
        menuDropdown.classList.add('wb-hidden');
        showWelcome();
    });

    btnPreview.addEventListener('click', function () { _openPreviewModal(); });

    // ---------------------------------------------------------------
    // Preview modal (Sprint B2.0.1) — renders through VihuStudio's own
    // real engine (renderer/slideRenderer.js), the same pipeline
    // Runtime uses, NOT the Workspace's illustrative Live Preview. This
    // is a genuinely different surface from the always-visible center
    // Preview: that one stays a lightweight mockup (LOCK 01 — the
    // Builder never renders like Runtime as its everyday editing
    // surface); this modal is a deliberate, on-demand exception that
    // reuses the unmodified renderer, so "what you see is what Studio
    // will render" is literally true, not just implied.
    // ---------------------------------------------------------------

    const previewModal = $('wb-preview-modal');
    const previewRealCanvas = $('wb-preview-real-canvas');
    const previewModalNote = $('wb-preview-modal-note');
    const previewCloseBtn = $('wb-preview-close');

    previewCloseBtn.addEventListener('click', function () {
        previewModal.classList.add('wb-hidden');
    });
    previewModal.addEventListener('click', function (e) {
        if (e.target === previewModal) previewModal.classList.add('wb-hidden');
    });

    async function _openPreviewModal() {
        previewModal.classList.remove('wb-hidden');
        previewModalNote.textContent = 'Rendering…';
        const project = currentProject;

        // Reuses builder.js's own packaging step (unmodified) to get
        // the exact resolved theme shape Build would produce — Preview
        // never invents a second interpretation of the Project's data.
        await window.ProjectCompiler.loadIntoProjectLoader(project);
        const packageData = await builder.packageTheme();
        const manifest = builder.buildManifest(packageData);
        const theme = builder.buildTheme(packageData, manifest);

        const rep = window.ProjectModel.findRepresentation(project, currentRepresentationId);
        const layoutId = (rep && rep.layout) || (window.ProjectModel.layouts(project)[0] || {}).id;
        const frameId = rep ? rep.defaultFrame : null;
        const isArtwork = manifest.type === 'artwork';

        const s = {
            image: null,
            storyBeat: '',
            bookTitle: project.name || '',
            handle: '',
            page: 1,
            totalPages: 1,
            theme: isArtwork ? null : theme,
            themeOptions: null,
            artworkTheme: isArtwork ? theme : null,
            imageView: null,
            overrides: null,
            pageType: 'story',
            metadata: {
                layout: layoutId,
                cardOverrides: (isArtwork && frameId) ? { artwork: { frameVariation: frameId } } : null
            }
        };

        window.SlideRenderer.init(previewRealCanvas, { dpr: window.devicePixelRatio || 1 });
        window.SlideRenderer.render(s);

        previewModalNote.textContent = rep
            ? 'Showing "' + rep.name + '" — no artwork image is placed yet, so only the Frame/Layer Pack render.'
            : 'This World has no Representations yet — showing its default Layout.';
    }

    function openWorkspace(project) {
        currentProject = project;
        currentNav = 'overview';
        const reps = window.ProjectModel.representations(project);
        const layouts = window.ProjectModel.layouts(project);
        const frames = window.ProjectModel.frames(project);
        const packs = window.ProjectModel.listLayerPacks(project);
        currentRepresentationId = reps.length ? reps[0].id : null;
        currentLayoutId = layouts.length ? layouts[0].id : null;
        currentFrameId = frames.length ? frames[0].id : null;
        currentLayerPackId = window.ProjectModel.getDefaultLayerPack(project) || (packs.length ? packs[0].id : null);
        currentLayerId = null;
        lastValidation = null;
        _hideAllScreens();
        screenWorkspace.classList.remove('wb-hidden');
        _renderWorkspaceHeader();
        _renderNav();
        _renderWorkspace();
    }

    function _persist() {
        window.ProjectStore.save(currentProject);
        _renderWorkspaceHeader();
    }

    function _renderWorkspaceHeader() {
        workspaceName.textContent = currentProject.name || 'Untitled World';
    }

    function _renderNav() {
        workspaceNav.innerHTML = '';
        NAV_ITEMS.forEach(function (item) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-nav-item' + (item.id === currentNav ? ' active' : '');
            const icon = document.createElement('span');
            icon.className = 'wb-nav-icon';
            icon.textContent = item.icon;
            const label = document.createElement('span');
            label.textContent = item.label;
            btn.appendChild(icon);
            btn.appendChild(label);
            btn.addEventListener('click', function () {
                currentNav = item.id;
                _renderNav();
                _renderWorkspace();
            });
            workspaceNav.appendChild(btn);
        });
    }

    function _renderWorkspace() {
        _renderPreview();
        _renderContextPanel();
    }

    // ---------- Live Preview (illustrative — the Builder never renders
    // a page the way Studio's Runtime does; see LOCK 01) ----------

    function _capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
    }

    function _activeAspectAndFrame() {
        const layouts = window.ProjectModel.layouts(currentProject);
        const frames = window.ProjectModel.frames(currentProject);
        let aspect = 'portrait';
        let frame = frames[0] || null;

        if (currentNav === 'layouts') {
            const layout = window.ProjectModel.findLayout(currentProject, currentLayoutId) || layouts[0];
            if (layout) aspect = layout.aspect;
        } else if (currentNav === 'frames') {
            frame = window.ProjectModel.findFrame(currentProject, currentFrameId) || frame;
            if (layouts[0]) aspect = layouts[0].aspect;
        } else {
            const rep = window.ProjectModel.findRepresentation(currentProject, currentRepresentationId);
            if (rep) {
                const layout = window.ProjectModel.findLayout(currentProject, rep.layout);
                if (layout) aspect = layout.aspect;
                const repFrame = window.ProjectModel.findFrame(currentProject, rep.defaultFrame);
                if (repFrame) frame = repFrame;
            } else if (layouts[0]) {
                aspect = layouts[0].aspect;
            }
        }
        return { aspect: aspect, frame: frame };
    }

    const AAF_STATES = { representations: 1, layouts: 1, frames: 1 };

    // Sprint B2.0.1 — Overview must consume the SAME shared
    // `currentRepresentationId` selection Representations uses, not a
    // second selection model. Overview shows the representation-aware
    // Preview (not the generic identity card) whenever the World has at
    // least one Representation to browse; a World with none (e.g. a
    // fresh Blank World) still gets the identity card, since there is
    // nothing to select yet.
    function _showsRepresentationPreview() {
        if (AAF_STATES[currentNav]) return true;
        return currentNav === 'overview' && window.ProjectModel.representations(currentProject).length > 0;
    }

    function _renderPreview() {
        previewCanvas.innerHTML = '';
        const wallTone = (function () {
            const state = _activeAspectAndFrame();
            return (state.frame && state.frame.fields && state.frame.fields.wallTone) || 'var(--wb-cream)';
        })();
        previewCanvas.style.background = wallTone;

        const frameEl = document.createElement('div');
        frameEl.className = 'wb-preview-frame';

        if (!_showsRepresentationPreview()) {
            frameEl.style.width = '70%';
            frameEl.style.aspectRatio = '3 / 4';
            frameEl.style.borderRadius = '10px';
            const icon = document.createElement('span');
            icon.className = 'wb-preview-icon';
            icon.textContent = currentProject.icon || '🌎';
            const thumbURL = window.ProjectModel.getAsset(currentProject, 'thumbnail.png');
            if (thumbURL) {
                const img = document.createElement('img');
                img.src = thumbURL;
                img.style.width = '64px';
                img.style.height = '64px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                frameEl.appendChild(img);
            } else {
                frameEl.appendChild(icon);
            }
            const title = document.createElement('span');
            title.className = 'wb-preview-title';
            title.textContent = currentProject.name || 'Untitled World';
            const tagline = document.createElement('span');
            tagline.className = 'wb-preview-tagline';
            tagline.textContent = currentProject.tagline || '';
            frameEl.appendChild(title);
            frameEl.appendChild(tagline);
        } else {
            const state = _activeAspectAndFrame();
            const ratio = ASPECT_RATIOS[state.aspect] || '3 / 4';
            frameEl.style.aspectRatio = ratio;
            frameEl.style.width = (state.aspect === 'wide' || state.aspect === 'landscape') ? '85%' : '55%';
            frameEl.style.borderRadius = '6px';
            const fields = (state.frame && state.frame.fields) || {};
            if (state.frame) {
                const thickness = fields.frameThickness || 0;
                frameEl.style.border = thickness + 'px solid ' + (fields.borderColor || '#1D3457');
            } else {
                frameEl.style.border = '2px solid var(--wb-border)';
            }
            const icon = document.createElement('span');
            icon.className = 'wb-preview-icon';
            icon.textContent = currentProject.icon || '🌎';
            frameEl.appendChild(icon);
            if (currentNav === 'layouts') {
                const layout = window.ProjectModel.findLayout(currentProject, currentLayoutId);
                const label = document.createElement('span');
                label.className = 'wb-preview-tagline';
                label.textContent = layout ? _capitalize(layout.aspect) + ' · caption ' + (layout.captionPosition || 'below') : '';
                frameEl.appendChild(label);
            } else if (currentNav === 'frames') {
                const label = document.createElement('span');
                label.className = 'wb-preview-title';
                label.textContent = state.frame ? state.frame.name : '';
                frameEl.appendChild(label);
            } else {
                const rep = window.ProjectModel.findRepresentation(currentProject, currentRepresentationId);
                const label = document.createElement('span');
                label.className = 'wb-preview-title';
                label.textContent = rep ? rep.name : '';
                frameEl.appendChild(label);
            }
        }

        previewCanvas.appendChild(frameEl);
        _renderPreviewSelector();
    }

    function _renderPreviewSelector() {
        previewSelector.innerHTML = '';

        if (currentNav === 'frames') {
            const frames = window.ProjectModel.frames(currentProject);
            frames.forEach(function (frame) {
                previewSelector.appendChild(_selectorChip(
                    '🖼️',
                    frame.name,
                    frame.id === currentFrameId,
                    function () { currentFrameId = frame.id; _renderWorkspace(); }
                ));
            });
            previewSelector.appendChild(_addChip('+ New', function () {
                const frame = window.ProjectModel.addFrame(currentProject);
                currentFrameId = frame.id;
                _persist();
                _renderWorkspace();
            }));
            return;
        }

        if (currentNav === 'layouts') {
            const layouts = window.ProjectModel.layouts(currentProject);
            layouts.forEach(function (layout) {
                previewSelector.appendChild(_selectorChip(
                    layout.aspect === 'quote' ? '💬' : '▭',
                    layout.name || _capitalize(layout.id),
                    layout.id === currentLayoutId,
                    function () { currentLayoutId = layout.id; _renderWorkspace(); }
                ));
            });
            previewSelector.appendChild(_addChip('+ New', function () {
                const layout = window.ProjectModel.addLayout(currentProject);
                currentLayoutId = layout.id;
                _persist();
                _renderWorkspace();
            }));
            return;
        }

        const reps = window.ProjectModel.representations(currentProject);
        if (!reps.length) {
            if (currentNav === 'representations') {
                previewSelector.appendChild(_addChip('+ Add', function () {
                    const rep = window.ProjectModel.addRepresentation(currentProject);
                    currentRepresentationId = rep.id;
                    _persist();
                    _renderWorkspace();
                }));
            }
            return;
        }
        reps.forEach(function (rep) {
            previewSelector.appendChild(_selectorChip(
                rep.thumbnail || '✨',
                rep.name,
                rep.id === currentRepresentationId,
                function () { currentRepresentationId = rep.id; _renderWorkspace(); }
            ));
        });
        if (currentNav === 'representations') {
            previewSelector.appendChild(_addChip('+ Add', function () {
                const rep = window.ProjectModel.addRepresentation(currentProject);
                currentRepresentationId = rep.id;
                _persist();
                _renderWorkspace();
            }));
        }
    }

    function _selectorChip(icon, label, active, onClick) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wb-selector-chip' + (active ? ' active' : '');
        const iconEl = document.createElement('span');
        iconEl.className = 'wb-selector-chip-icon';
        iconEl.textContent = icon;
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        chip.appendChild(iconEl);
        chip.appendChild(labelEl);
        chip.addEventListener('click', onClick);
        return chip;
    }

    function _addChip(label, onClick) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wb-selector-chip';
        chip.textContent = label;
        chip.addEventListener('click', onClick);
        return chip;
    }

    // ---------- Context Panel — one mount point, reused by every state ----------

    function _renderContextPanel() {
        contextPanel.innerHTML = '';
        if (currentNav === 'overview') return _renderOverviewPanel();
        if (currentNav === 'representations') return _renderRepresentationsPanel();
        if (currentNav === 'layouts') return _renderLayoutsPanel();
        if (currentNav === 'frames') return _renderFramesPanel();
        if (currentNav === 'layerpacks') return _renderLayerPacksPanel();
        if (currentNav === 'assets') return _renderAssetsPanel();
        if (currentNav === 'validation') return _renderValidationPanel();
        if (currentNav === 'build') return _renderBuildPanel();
        if (currentNav === 'publish') return _renderPublishPanel();
        return _renderStubPanel();
    }

    function _heading(title, sub) {
        const h = document.createElement('h2');
        h.className = 'wb-context-heading';
        h.textContent = title;
        contextPanel.appendChild(h);
        if (sub) {
            const p = document.createElement('p');
            p.className = 'wb-context-subheading';
            p.textContent = sub;
            contextPanel.appendChild(p);
        }
    }

    function _fieldGroup(labelText, inputEl, helpText) {
        const group = document.createElement('div');
        group.className = 'wb-field-group';
        const label = document.createElement('label');
        label.className = 'wb-field-label';
        label.textContent = labelText;
        group.appendChild(label);
        group.appendChild(inputEl);
        if (helpText) group.appendChild(_fieldHelp(helpText));
        contextPanel.appendChild(group);
        return group;
    }

    function _textInput(value, onInput) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'wb-field-input';
        input.value = value || '';
        input.addEventListener('input', function () { onInput(input.value); });
        return input;
    }

    function _textarea(value, onInput) {
        const ta = document.createElement('textarea');
        ta.className = 'wb-field-textarea';
        ta.value = value || '';
        ta.addEventListener('input', function () { onInput(ta.value); });
        return ta;
    }

    function _select(options, selected, onChange) {
        const sel = document.createElement('select');
        sel.className = 'wb-field-select';
        options.forEach(function (opt) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === selected) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', function () { onChange(sel.value); });
        return sel;
    }

    function _range(min, max, value, onInput) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.value = value;
        input.style.flex = '1';
        const readout = document.createElement('span');
        readout.className = 'wb-field-hint';
        readout.textContent = value;
        input.addEventListener('input', function () {
            readout.textContent = input.value;
            onInput(Number(input.value));
        });
        wrap.appendChild(input);
        wrap.appendChild(readout);
        return wrap;
    }

    function _colorInput(value, onInput) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        const input = document.createElement('input');
        input.type = 'color';
        input.value = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#1D3457';
        input.style.width = '44px';
        input.style.height = '32px';
        input.style.border = 'none';
        input.style.background = 'none';
        input.style.cursor = 'pointer';
        const readout = document.createElement('span');
        readout.className = 'wb-field-hint';
        readout.textContent = value || '';
        input.addEventListener('input', function () {
            readout.textContent = input.value;
            onInput(input.value);
        });
        wrap.appendChild(input);
        wrap.appendChild(readout);
        return wrap;
    }

    // Real upload — a hidden file input read via FileReader into a data
    // URI, the same embedding approach js/services/builder.js already
    // expects for assets/preview.png/thumbnail.png (Sprint B2.0; no
    // asset upload existed before this sprint).
    function _fileInputUpload(accept, onFile) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', function () {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () { onFile(reader.result); };
            reader.readAsDataURL(file);
        });
        return input;
    }

    function _assetUploadRow(iconFallback, existingDataURL, onUpload) {
        const row = document.createElement('div');
        row.className = 'wb-asset-row';
        const thumb = document.createElement('span');
        thumb.className = 'wb-asset-thumb';
        if (existingDataURL) {
            const img = document.createElement('img');
            img.src = existingDataURL;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '10px';
            thumb.appendChild(img);
        } else {
            thumb.textContent = iconFallback;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wb-asset-change-btn';
        btn.textContent = existingDataURL ? 'Replace' : 'Upload';
        const input = _fileInputUpload('image/*', onUpload);
        btn.addEventListener('click', function () { input.click(); });
        row.appendChild(thumb);
        row.appendChild(btn);
        row.appendChild(input);
        return row;
    }

    // ---------- State 1: Overview ----------

    function _renderOverviewPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        const man = window.ProjectModel.manifest(project);
        const theme = window.ProjectModel.theme(project);
        _heading('Overview', 'Give your world a wonderful identity.');
        _stateIntro('overview');

        // Sprint B2.0.1 — Overview consumes the SAME shared
        // currentRepresentationId selection Representations uses (no
        // duplicated selection logic). Browsing the thumbnails below the
        // Live Preview updates this summary, the Preview itself, and the
        // active/highlighted thumbnail, all from that one shared value.
        const reps = window.ProjectModel.representations(project);
        if (reps.length) {
            const activeRep = window.ProjectModel.findRepresentation(project, currentRepresentationId) || reps[0];
            const repBox = document.createElement('div');
            repBox.className = 'wb-state-intro';
            const repTitle = document.createElement('div');
            const repStrong = document.createElement('strong');
            repStrong.textContent = 'Previewing: ';
            repTitle.appendChild(repStrong);
            repTitle.appendChild(document.createTextNode((activeRep.thumbnail || '') + ' ' + activeRep.name));
            const repDesc = document.createElement('div');
            repDesc.textContent = activeRep.description || '';
            repBox.appendChild(repTitle);
            repBox.appendChild(repDesc);
            contextPanel.appendChild(repBox);
            contextPanel.appendChild(_fieldHelp('Pick a different thumbnail below the Preview to browse this World\'s Representations. Edit their details in the Representations state.'));
        }

        _fieldGroup('World Name', _textInput(project.name, function (v) {
            window.ProjectModel.setIdentity(project, { name: v });
            _persist();
        }));

        _fieldGroup('Tagline', _textInput(project.tagline, function (v) {
            window.ProjectModel.setIdentity(project, { tagline: v });
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Description', _textarea(project.description, function (v) {
            window.ProjectModel.setIdentity(project, { description: v });
            _persist();
        }));

        _fieldGroup('World Id', _textInput(man.id, function (v) {
            const id = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            window.ProjectModel.setIdentity(project, { id: id });
            _persist();
        }));

        const typeRow = document.createElement('div');
        typeRow.className = 'wb-creation-type-row';
        const activeTypes = window.ProjectModel.creationTypes(project);
        window.ProjectModel.ALL_CREATION_TYPES.forEach(function (t) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wb-creation-type-chip' + (activeTypes.indexOf(t) !== -1 ? ' active' : '');
            chip.title = t;
            chip.textContent = CREATION_TYPE_ICONS[t] || '✨';
            chip.addEventListener('click', function () {
                window.ProjectModel.toggleCreationType(project, t);
                _persist();
                _renderOverviewPanel();
            });
            typeRow.appendChild(chip);
        });
        _fieldGroup('Creation Types', typeRow);

        _fieldGroup('Publisher', _textInput(man.author, function (v) {
            window.ProjectModel.setIdentity(project, { publisher: v });
            _persist();
        }));

        _fieldGroup('Version', _textInput(man.version, function (v) {
            window.ProjectModel.setIdentity(project, { version: v });
            _persist();
        }));

        const meta = window.ProjectModel.metadata(project);

        _fieldGroup('Icon', _textInput(project.icon, function (v) {
            window.ProjectModel.setIdentity(project, { icon: v });
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Purpose', _textInput(meta.purpose, function (v) {
            window.ProjectModel.setIdentity(project, { purpose: v });
            _persist();
        }));

        _fieldGroup('Mood', _textInput(meta.mood, function (v) {
            window.ProjectModel.setIdentity(project, { mood: v });
            _persist();
        }));

        _fieldGroup('Thumbnail', _assetUploadRow(
            project.icon || '🌎',
            window.ProjectModel.getAsset(project, 'thumbnail.png'),
            function (dataURL) {
                window.ProjectModel.setIdentityAsset(project, 'thumbnail', dataURL);
                _persist();
                _renderWorkspace();
            }
        ));
        _fieldGroup('Hero Image', _assetUploadRow(
            '🖼️',
            window.ProjectModel.getAsset(project, 'preview.png'),
            function (dataURL) {
                window.ProjectModel.setIdentityAsset(project, 'hero', dataURL);
                _persist();
                _renderWorkspace();
            }
        ));
    }

    // ---------- State 2: Representations ----------

    function _representationOptionsFor(kind) {
        if (kind === 'layout') {
            return window.ProjectModel.layouts(currentProject).map(function (l) {
                return { value: l.id, label: l.name || _capitalize(l.id) };
            });
        }
        const opts = [{ value: '', label: 'None' }];
        window.ProjectModel.frames(currentProject).forEach(function (f) {
            opts.push({ value: f.id, label: f.name || _capitalize(f.id) });
        });
        return opts;
    }

    function _renderRepresentationsPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Representations', 'Define how creations can be presented.');
        _stateIntro('representations');

        const reps = window.ProjectModel.representations(project);
        if (!reps.length) {
            const empty = document.createElement('p');
            empty.className = 'wb-field-hint';
            empty.textContent = 'No representations yet — add one to offer a page style.';
            contextPanel.appendChild(empty);
        } else {
            reps.forEach(function (rep) {
                const row = document.createElement('div');
                row.className = 'wb-rep-list-row' + (rep.id === currentRepresentationId ? ' active' : '');
                const name = document.createElement('span');
                name.className = 'wb-rep-list-row-name';
                name.textContent = (rep.thumbnail || '') + ' ' + rep.name;
                row.appendChild(name);
                row.addEventListener('click', function () {
                    currentRepresentationId = rep.id;
                    _renderWorkspace();
                });
                contextPanel.appendChild(row);
            });
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-add-btn';
        addBtn.textContent = '+ Add Representation';
        addBtn.addEventListener('click', function () {
            const rep = window.ProjectModel.addRepresentation(project);
            currentRepresentationId = rep.id;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);

        const rep = window.ProjectModel.findRepresentation(project, currentRepresentationId);
        if (!rep) return;

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'Selected Representation';
        contextPanel.appendChild(divider);

        _fieldGroup('Name', _textInput(rep.name, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'name', v);
            _persist();
            _renderPreviewSelector();
        }));

        _fieldGroup('Description', _textarea(rep.description, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'description', v);
            _persist();
        }));

        _fieldGroup('Default Layout', _select(_representationOptionsFor('layout'), rep.layout, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'layout', v);
            _persist();
            _renderPreview();
        }), 'Which Layout (aspect + composition) this Representation opens with. Defined in the Layouts state.');

        _fieldGroup('Default Frame', _select(_representationOptionsFor('frame'), rep.defaultFrame, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'defaultFrame', v || null);
            _persist();
            _renderPreview();
        }), 'Which Frame Variation this Representation suggests first. A child can still change it. Defined in the Frames state.');

        const packOptions = window.ProjectModel.listLayerPacks(project).map(function (p) {
            return { value: p.id, label: p.name };
        });
        _fieldGroup('Layer Pack', _select(packOptions, rep.defaultLayerPack || packOptions[0].value, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'defaultLayerPack', v);
            _persist();
        }), 'Which set of captions/decorations (from Layer Packs) this Representation uses.');

        const actionRow = document.createElement('div');
        actionRow.className = 'wb-action-chip-row';
        ['editCaption', 'editQuote'].forEach(function (action) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'wb-action-chip';
            chip.style.opacity = (rep.actions || []).indexOf(action) !== -1 ? '1' : '.4';
            chip.style.border = 'none';
            chip.style.cursor = 'pointer';
            chip.textContent = action;
            chip.addEventListener('click', function () {
                const actions = rep.actions || (rep.actions = []);
                const idx = actions.indexOf(action);
                if (idx === -1) actions.push(action); else actions.splice(idx, 1);
                _persist();
                _renderRepresentationsPanel();
            });
            actionRow.appendChild(chip);
        });
        _fieldGroup('Supported Actions', actionRow);
    }

    // ---------- State 3: Layouts ----------

    function _renderLayoutsPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Layouts', 'Design the composition.');
        _stateIntro('layouts');

        const layouts = window.ProjectModel.layouts(project);
        layouts.forEach(function (layout) {
            const row = document.createElement('div');
            row.className = 'wb-rep-list-row' + (layout.id === currentLayoutId ? ' active' : '');
            const name = document.createElement('span');
            name.className = 'wb-rep-list-row-name';
            name.textContent = layout.name || _capitalize(layout.id);
            row.appendChild(name);
            row.addEventListener('click', function () {
                currentLayoutId = layout.id;
                _renderWorkspace();
            });
            contextPanel.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-add-btn';
        addBtn.textContent = '+ Add Layout';
        addBtn.addEventListener('click', function () {
            const layout = window.ProjectModel.addLayout(project);
            currentLayoutId = layout.id;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);

        const layout = window.ProjectModel.findLayout(project, currentLayoutId);
        if (!layout) return;
        if (layout.captionPosition === undefined) layout.captionPosition = 'below';
        if (layout.padding === undefined) layout.padding = 24;
        if (layout.spacing === undefined) layout.spacing = 16;
        if (layout.alignment === undefined) layout.alignment = 'center';
        if (layout.composition === undefined) layout.composition = 'below';

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'Selected Layout';
        contextPanel.appendChild(divider);

        _fieldGroup('Layout Name', _textInput(layout.name || _capitalize(layout.id), function (v) {
            layout.name = v;
            _persist();
            _renderPreviewSelector();
        }));

        _fieldGroup('Aspect', _select([
            { value: 'landscape', label: 'Landscape' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'square', label: 'Square' },
            { value: 'wide', label: 'Wide' },
            { value: 'quote', label: 'Quote' },
            { value: 'full-bleed', label: 'Full Bleed' }
        ], layout.aspect, function (v) {
            layout.aspect = v;
            _persist();
            _renderPreview();
        }), 'The page shape this Layout resolves to. Pick "Quote" for a text-only page with no picture at all.');

        const holderDiagram = document.createElement('div');
        holderDiagram.className = 'wb-holder-area-diagram';
        holderDiagram.textContent = 'Holder Area';
        _fieldGroup('Holder Area', holderDiagram);

        _fieldGroup('Composition', _select([
            { value: 'below', label: 'Below — caption under the Frame (default)' },
            { value: 'right', label: 'Right — Frame left, caption right (Wide)' },
            { value: 'quote', label: 'Quote — no Frame/Holder, centered text only' }
        ], layout.composition, function (v) {
            layout.composition = v;
            _persist();
            _renderPreview();
        }), 'How the Frame and caption are arranged on the page. Must be "Quote" for a Quote-aspect Layout to render correctly.');

        _fieldGroup('Caption Position', _select([
            { value: 'below', label: 'Below' },
            { value: 'right', label: 'Right' },
            { value: 'overlay', label: 'Overlay' },
            { value: 'none', label: 'None' }
        ], layout.captionPosition, function (v) {
            layout.captionPosition = v;
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Padding', _range(0, 48, layout.padding, function (v) {
            layout.padding = v;
            _persist();
        }));

        _fieldGroup('Spacing', _range(0, 32, layout.spacing, function (v) {
            layout.spacing = v;
            _persist();
        }));

        const alignRow = document.createElement('div');
        alignRow.className = 'wb-alignment-row';
        ['left', 'center', 'right'].forEach(function (align) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-alignment-btn' + (layout.alignment === align ? ' active' : '');
            btn.textContent = align === 'left' ? '⟸' : align === 'right' ? '⟹' : '≡';
            btn.title = _capitalize(align);
            btn.addEventListener('click', function () {
                layout.alignment = align;
                _persist();
                _renderLayoutsPanel();
            });
            alignRow.appendChild(btn);
        });
        _fieldGroup('Alignment', alignRow);
    }

    // ---------- State 4: Frames (Sprint B2.0) ----------

    function _renderFramesPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Frames', 'Create beautiful frames.');
        _stateIntro('frames');

        const frames = window.ProjectModel.frames(project);
        frames.forEach(function (frame, idx) {
            const row = document.createElement('div');
            row.className = 'wb-rep-list-row' + (frame.id === currentFrameId ? ' active' : '');

            const name = document.createElement('span');
            name.className = 'wb-rep-list-row-name';
            name.textContent = frame.name;
            row.appendChild(name);

            const ctrls = document.createElement('span');
            ctrls.className = 'wb-row-controls';
            [
                ['↑', function (e) { e.stopPropagation(); window.ProjectModel.moveFrame(project, frame.id, 'up'); _persist(); _renderFramesPanel(); }],
                ['↓', function (e) { e.stopPropagation(); window.ProjectModel.moveFrame(project, frame.id, 'down'); _persist(); _renderFramesPanel(); }],
                ['⧉', function (e) { e.stopPropagation(); const c = window.ProjectModel.duplicateFrame(project, frame.id); currentFrameId = c.id; _persist(); _renderWorkspace(); }],
                ['🗑', function (e) {
                    e.stopPropagation();
                    if (frames.length <= 1) return;
                    window.ProjectModel.deleteFrame(project, frame.id);
                    if (currentFrameId === frame.id) currentFrameId = null;
                    _persist();
                    _renderWorkspace();
                }]
            ].forEach(function (pair) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'wb-row-btn';
                btn.textContent = pair[0];
                btn.addEventListener('click', pair[1]);
                ctrls.appendChild(btn);
            });
            row.appendChild(ctrls);

            row.addEventListener('click', function () {
                currentFrameId = frame.id;
                _renderWorkspace();
            });
            contextPanel.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-add-btn';
        addBtn.textContent = '+ Create Frame';
        addBtn.addEventListener('click', function () {
            const frame = window.ProjectModel.addFrame(project);
            currentFrameId = frame.id;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);

        const frame = window.ProjectModel.findFrame(project, currentFrameId);
        if (!frame) return;
        if (!frame.fields) frame.fields = {};
        const f = frame.fields;
        if (f.matWidth === undefined) f.matWidth = 20;
        if (f.frameThickness === undefined) f.frameThickness = 4;
        if (f.borderColor === undefined) f.borderColor = '#1D3457';
        if (f.wallTone === undefined) f.wallTone = '#F4F1EC';
        if (f.shadow === undefined) f.shadow = 'soft';

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'Selected Frame';
        contextPanel.appendChild(divider);

        _fieldGroup('Frame Name', _textInput(frame.name, function (v) {
            window.ProjectModel.setFrameField(project, frame.id, 'name', v);
            _persist();
            _renderPreviewSelector();
        }));

        _fieldGroup('Description', _textarea(frame.description, function (v) {
            window.ProjectModel.setFrameField(project, frame.id, 'description', v);
            _persist();
        }));

        _fieldGroup('Thickness (Frame Thickness)', _range(0, 40, f.frameThickness, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'frameThickness', v);
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Padding (Mat Width)', _range(0, 64, f.matWidth, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'matWidth', v);
            _persist();
        }));

        _fieldGroup('Inset', _range(0, 20, f.inset || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'inset', v);
            _persist();
        }));

        _fieldGroup('Border Color', _colorInput(f.borderColor, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'borderColor', v);
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Wall Tone (Background)', _colorInput(f.wallTone, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'wallTone', v);
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Shadow', _select([
            { value: 'none', label: 'None' },
            { value: 'soft', label: 'Soft' },
            { value: 'floating', label: 'Floating' },
            { value: 'gallery', label: 'Gallery' }
        ], f.shadow, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'shadow', v);
            _persist();
        }));

        _fieldGroup('Corner Radius', _range(0, 24, f.cornerRadius || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'cornerRadius', v);
            _persist();
        }));

        _fieldGroup('Default Margin', _range(0, 40, f.defaultMargin || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'defaultMargin', v);
            _persist();
        }));
    }

    // ---------- State 5: Layer Packs (Sprint B2.0) ----------

    const LAYER_TYPES_OPTS = [
        { value: 'text', label: 'Text' },
        { value: 'sticker', label: 'Sticker' },
        { value: 'decoration', label: 'Decoration' }
    ];
    const LAYER_TARGETS_OPTS = [
        { value: 'slide', label: 'Slide' },
        { value: 'frame', label: 'Frame' },
        { value: 'holder', label: 'Holder' },
        { value: 'element', label: 'Element' }
    ];

    function _renderLayerPacksPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Layer Packs', 'Control visible elements.');
        _stateIntro('layerpacks');

        const packs = window.ProjectModel.listLayerPacks(project);
        const defaultPackId = window.ProjectModel.getDefaultLayerPack(project);
        if (!currentLayerPackId || !packs.find(function (p) { return p.id === currentLayerPackId; })) {
            currentLayerPackId = defaultPackId || (packs[0] && packs[0].id);
        }

        packs.forEach(function (pack) {
            const row = document.createElement('div');
            row.className = 'wb-rep-list-row' + (pack.id === currentLayerPackId ? ' active' : '');

            const name = document.createElement('span');
            name.className = 'wb-rep-list-row-name';
            name.textContent = pack.name + (pack.id === defaultPackId ? ' ⭐' : '');
            row.appendChild(name);

            const ctrls = document.createElement('span');
            ctrls.className = 'wb-row-controls';
            [
                ['⧉', function (e) {
                    e.stopPropagation();
                    const c = window.ProjectModel.duplicateLayerPack(project, pack.id);
                    if (c) { currentLayerPackId = c.id; _persist(); _renderWorkspace(); }
                }],
                ['🗑', function (e) {
                    e.stopPropagation();
                    if (window.ProjectModel.deleteLayerPack(project, pack.id)) {
                        currentLayerPackId = null;
                        _persist();
                        _renderWorkspace();
                    }
                }]
            ].forEach(function (pair) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'wb-row-btn';
                btn.textContent = pair[0];
                btn.addEventListener('click', pair[1]);
                ctrls.appendChild(btn);
            });
            row.appendChild(ctrls);

            row.addEventListener('click', function () {
                currentLayerPackId = pack.id;
                currentLayerId = null;
                _renderWorkspace();
            });
            contextPanel.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-add-btn';
        addBtn.textContent = '+ Create Pack';
        addBtn.addEventListener('click', function () {
            const pack = window.ProjectModel.addLayerPack(project);
            currentLayerPackId = pack.id;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);

        const pack = packs.find(function (p) { return p.id === currentLayerPackId; });
        if (!pack) return;

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'Selected Pack';
        contextPanel.appendChild(divider);

        _fieldGroup('Pack Name', _textInput(pack.name, function (v) {
            window.ProjectModel.renameLayerPack(project, pack.id, v);
            _persist();
            _renderLayerPacksPanel();
        }));

        const defaultBtn = document.createElement('button');
        defaultBtn.type = 'button';
        defaultBtn.className = 'wb-add-btn';
        defaultBtn.textContent = pack.id === defaultPackId ? '⭐ Default Layer Pack' : 'Set as Default Layer Pack';
        defaultBtn.disabled = pack.id === defaultPackId;
        defaultBtn.addEventListener('click', function () {
            window.ProjectModel.setDefaultLayerPack(project, pack.id);
            _persist();
            _renderLayerPacksPanel();
        });
        contextPanel.appendChild(defaultBtn);

        const layersHeading = document.createElement('h3');
        layersHeading.className = 'wb-context-heading';
        layersHeading.style.marginTop = '20px';
        layersHeading.style.fontSize = '13px';
        layersHeading.textContent = 'Layers';
        contextPanel.appendChild(layersHeading);

        if (!pack.layers.length) {
            const empty = document.createElement('p');
            empty.className = 'wb-field-hint';
            empty.textContent = 'No layers yet in this pack.';
            contextPanel.appendChild(empty);
        }

        pack.layers.forEach(function (layer) {
            const row = document.createElement('div');
            row.className = 'wb-layer-row' + (layer.id === currentLayerId ? ' active' : '');

            const vis = document.createElement('button');
            vis.type = 'button';
            vis.className = 'wb-row-btn';
            vis.textContent = layer.visible === false ? '🚫' : '👁️';
            vis.title = 'Toggle visibility';
            vis.addEventListener('click', function (e) {
                e.stopPropagation();
                window.ProjectModel.updateLayer(project, pack.id, layer.id, { visible: layer.visible === false });
                _persist();
                _renderLayerPacksPanel();
            });

            const lock = document.createElement('button');
            lock.type = 'button';
            lock.className = 'wb-row-btn';
            lock.textContent = layer.locked ? '🔒' : '🔓';
            lock.title = 'Toggle lock';
            lock.addEventListener('click', function (e) {
                e.stopPropagation();
                window.ProjectModel.updateLayer(project, pack.id, layer.id, { locked: !layer.locked });
                _persist();
                _renderLayerPacksPanel();
            });

            const name = document.createElement('span');
            name.className = 'wb-layer-row-name';
            name.textContent = layer.id + ' · ' + layer.target;

            const up = document.createElement('button');
            up.type = 'button';
            up.className = 'wb-row-btn';
            up.textContent = '↑';
            up.addEventListener('click', function (e) {
                e.stopPropagation();
                window.ProjectModel.moveLayer(project, pack.id, layer.id, 'up');
                _persist();
                _renderLayerPacksPanel();
            });

            const down = document.createElement('button');
            down.type = 'button';
            down.className = 'wb-row-btn';
            down.textContent = '↓';
            down.addEventListener('click', function (e) {
                e.stopPropagation();
                window.ProjectModel.moveLayer(project, pack.id, layer.id, 'down');
                _persist();
                _renderLayerPacksPanel();
            });

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'wb-row-btn';
            del.textContent = '🗑';
            del.addEventListener('click', function (e) {
                e.stopPropagation();
                window.ProjectModel.deleteLayer(project, pack.id, layer.id);
                if (currentLayerId === layer.id) currentLayerId = null;
                _persist();
                _renderLayerPacksPanel();
            });

            row.appendChild(vis);
            row.appendChild(lock);
            row.appendChild(name);
            row.appendChild(up);
            row.appendChild(down);
            row.appendChild(del);
            row.addEventListener('click', function () {
                currentLayerId = layer.id;
                _renderLayerPacksPanel();
            });
            contextPanel.appendChild(row);
        });

        const addLayerBtn = document.createElement('button');
        addLayerBtn.type = 'button';
        addLayerBtn.className = 'wb-add-btn';
        addLayerBtn.textContent = '+ Add Layer';
        addLayerBtn.addEventListener('click', function () {
            const layer = window.ProjectModel.addLayer(project, pack.id);
            currentLayerId = layer.id;
            _persist();
            _renderLayerPacksPanel();
        });
        contextPanel.appendChild(addLayerBtn);

        const layer = pack.layers.find(function (l) { return l.id === currentLayerId; });
        if (!layer) return;

        const layerDivider = document.createElement('h3');
        layerDivider.className = 'wb-context-heading';
        layerDivider.style.marginTop = '20px';
        layerDivider.style.fontSize = '13px';
        layerDivider.textContent = 'Selected Layer';
        contextPanel.appendChild(layerDivider);

        _fieldGroup('Layer Id', _textInput(layer.id, function (v) {
            if (!v) return;
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { id: v });
            currentLayerId = v;
            _persist();
        }));

        _fieldGroup('Type', _select(LAYER_TYPES_OPTS, layer.type, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { type: v });
            _persist();
        }));

        _fieldGroup('Target Container', _select(LAYER_TARGETS_OPTS, layer.target, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { target: v });
            _persist();
        }), 'Which containership scope this Layer draws on: the whole Slide, the Frame, the picture Holder, or a specific Element.');

        _fieldGroup('Anchor', _select([
            { value: '', label: '(none — uses position instead)' },
            { value: 'top-left', label: 'Top Left' },
            { value: 'top-center', label: 'Top Center' },
            { value: 'top-right', label: 'Top Right' },
            { value: 'bottom-left', label: 'Bottom Left' },
            { value: 'bottom-center', label: 'Bottom Center' },
            { value: 'bottom-right', label: 'Bottom Right' }
        ], layer.anchor || '', function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { anchor: v || undefined });
            _persist();
        }), 'Where this Layer sits within its Target Container. Use Anchor for most Layers; use Position only for a Slide-targeted shorthand like a page number.');

        _fieldGroup('Position (Slide-targeted shorthand)', _select([
            { value: '', label: '(none — uses anchor instead)' },
            { value: 'bottom-left', label: 'Bottom Left' },
            { value: 'bottom-right', label: 'Bottom Right' },
            { value: 'top-left', label: 'Top Left' },
            { value: 'top-right', label: 'Top Right' }
        ], layer.position || '', function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { position: v || undefined });
            _persist();
        }));

        _fieldGroup('Offset X', _range(-60, 60, layer.offsetX || 0, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { offsetX: v });
            _persist();
        }));

        _fieldGroup('Offset Y', _range(-60, 60, layer.offsetY || 0, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { offsetY: v });
            _persist();
        }));

        _fieldGroup('Z-Index (Layer Order)', _range(0, 10, layer.zIndex || 0, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { zIndex: v });
            _persist();
        }), 'Stacking order within the same Target Container — higher draws on top of lower. Only matters when two Layers overlap.');

        if (layer.type === 'text') {
            _fieldGroup('Text Source', _textInput(layer.text && layer.text.source, function (v) {
                const text = Object.assign({}, layer.text, { source: v });
                window.ProjectModel.updateLayer(project, pack.id, layer.id, { text: text });
                _persist();
            }));
        }
    }

    // ---------- State 6: Assets (Sprint B2.0) ----------
    // Entirely generated from AssetSpec.resolve(project)
    // (js/assetSpec.js) — the Builder-readable mirror of
    // docs/WORLD_ASSET_SPEC.md. No per-category markup lives here.

    function _renderAssetsPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Assets', 'Upload and manage this World\'s own assets.');
        _stateIntro('assets');

        const categories = window.AssetSpec.resolve(project);
        const overall = window.AssetSpec.stats(project);

        categories.forEach(function (cat) {
            if (!cat.slots.length) return;
            const filledCount = cat.slots.filter(function (s) { return s.filled; }).length;

            const catHeading = document.createElement('h3');
            catHeading.className = 'wb-context-heading';
            catHeading.style.fontSize = '13px';
            catHeading.style.marginTop = '18px';
            catHeading.textContent = cat.label + ' (' + filledCount + '/' + cat.slots.length + ')';
            contextPanel.appendChild(catHeading);

            const catDesc = document.createElement('p');
            catDesc.className = 'wb-context-subheading';
            catDesc.style.marginBottom = '10px';
            catDesc.textContent = cat.description;
            contextPanel.appendChild(catDesc);

            cat.slots.forEach(function (slot) {
                contextPanel.appendChild(_assetSlotRow(project, slot));
            });
        });

        const progressWrap = document.createElement('div');
        progressWrap.className = 'wb-asset-progress-wrap';
        const pct = overall.total ? Math.round((overall.filled / overall.total) * 100) : 0;
        const bar = document.createElement('div');
        bar.className = 'wb-asset-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'wb-asset-progress-fill';
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        const label = document.createElement('span');
        label.className = 'wb-field-hint';
        label.textContent = 'Asset Progress ' + overall.filled + '/' + overall.total + ' · ' + pct + '% Complete';
        progressWrap.appendChild(bar);
        progressWrap.appendChild(label);
        contextPanel.appendChild(progressWrap);

        if (overall.requiredMissing.length) {
            const missing = document.createElement('p');
            missing.className = 'wb-field-hint';
            missing.textContent = 'Still needed: ' + overall.requiredMissing.join(', ');
            contextPanel.appendChild(missing);
        }
    }

    function _assetSlotRow(project, slot) {
        const row = document.createElement('div');
        row.className = 'wb-asset-slot-row';

        const thumb = document.createElement('span');
        thumb.className = 'wb-asset-thumb';
        const existing = window.ProjectModel.getAsset(project, slot.path);
        if (existing && slot.previewType !== 'none') {
            const img = document.createElement('img');
            img.src = existing;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '10px';
            thumb.appendChild(img);
        } else {
            thumb.textContent = existing ? '📄' : '—';
        }

        const info = document.createElement('div');
        info.className = 'wb-asset-slot-info';

        const nameRow = document.createElement('div');
        nameRow.className = 'wb-asset-slot-name-row';
        const name = document.createElement('span');
        name.className = 'wb-asset-slot-name';
        name.textContent = slot.displayName;
        const badge = document.createElement('span');
        badge.className = 'wb-asset-req-badge' + (slot.required ? ' required' : '');
        badge.textContent = slot.required ? 'Required' : 'Optional';
        nameRow.appendChild(name);
        nameRow.appendChild(badge);

        const purpose = document.createElement('p');
        purpose.className = 'wb-field-hint';
        purpose.textContent = slot.purpose;

        const usage = document.createElement('p');
        usage.className = 'wb-field-hint';
        usage.textContent = 'Used by: ' + slot.usedBy;

        // Sprint B2.0.1 — every value here is read straight off the
        // slot itself (AssetSpec.resolve/js/assetSpec.js, the mirror of
        // docs/WORLD_ASSET_SPEC.md) — no second, duplicated set of
        // dimensions/formats lives in this screen.
        const specGrid = document.createElement('div');
        specGrid.className = 'wb-asset-spec-grid';
        const specEntries = [
            ['Dimensions', slot.recommendedDimensions],
            ['Aspect Ratio', slot.aspectRatio],
            ['Formats', (slot.formats || []).join(', ').toUpperCase()],
            ['Max Size', slot.maxFileSizeMB ? slot.maxFileSizeMB + ' MB' : '—']
        ];
        specEntries.forEach(function (pair) {
            const span = document.createElement('span');
            const strong = document.createElement('strong');
            strong.textContent = pair[0] + ': ';
            span.appendChild(strong);
            span.appendChild(document.createTextNode(pair[1] || '—'));
            specGrid.appendChild(span);
        });

        const status = document.createElement('span');
        status.className = 'wb-asset-status' + (existing ? ' filled' : '');
        status.textContent = existing ? 'Filled' : 'Missing';

        info.appendChild(nameRow);
        info.appendChild(purpose);
        info.appendChild(specGrid);
        info.appendChild(usage);
        info.appendChild(status);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wb-asset-change-btn';
        btn.textContent = existing ? 'Replace' : 'Upload';
        const input = _fileInputUpload('image/*', function (dataURL) {
            if (slot.category === 'identity') {
                window.ProjectModel.setIdentityAsset(project, slot.id, dataURL);
            } else {
                window.ProjectModel.setAsset(project, slot.path, dataURL);
            }
            _persist();
            _renderWorkspace();
        });
        btn.addEventListener('click', function () { input.click(); });

        row.appendChild(thumb);
        row.appendChild(info);
        row.appendChild(btn);
        row.appendChild(input);
        return row;
    }

    // ---------- State 7: Validation (Sprint B2.0) ----------

    const VALIDATION_CATEGORY_ORDER = [
        'World Contract', 'Representations', 'Layouts', 'Frames',
        'Layer Packs', 'Assets', 'References', 'Metadata', 'Version'
    ];

    function _categorizeValidationMessage(msg) {
        const m = msg.toLowerCase();
        if (m.indexOf('representation') !== -1) return 'Representations';
        if (m.indexOf('layout') !== -1) return 'Layouts';
        if (m.indexOf('frame') !== -1) return 'Frames';
        if (m.indexOf('layer') !== -1) return 'Layer Packs';
        if (m.indexOf('asset') !== -1) return 'Assets';
        if (m.indexOf('reference') !== -1) return 'References';
        if (m.indexOf('version') !== -1) return 'Version';
        if (m.indexOf('metadata') !== -1) return 'Metadata';
        return 'World Contract';
    }

    // Sprint B2.0.1 — Validation UX. validator.js's own messages are
    // precise but technical ("Representation references unknown
    // frame"); this translates the known, common message shapes into
    // What's-wrong / Why / Fix-Now-navigation, without ever hiding the
    // underlying message (an unrecognized message still displays,
    // verbatim, just without the extra explanation).
    const NAV_FOR_LABEL = { Layout: 'layouts', Frame: 'frames', Layer: 'layerpacks', Representation: 'representations', layout: 'layouts', frame: 'frames', layer: 'layerpacks', representation: 'representations' };
    const FOLDER_NAV = { 'layouts': 'layouts', 'frames': 'frames', 'layer-packs': 'layerpacks', 'representations': 'representations' };

    function _explainValidationMessage(msg) {
        let m;
        if ((m = msg.match(/^Representation "([^"]+)" references unknown layout "([^"]+)"$/))) {
            return { why: 'Every Representation\'s Default Layout must point at a real Layout in this World.', fixNav: 'representations', fixLabel: 'Open Representations → ' + m[1] };
        }
        if ((m = msg.match(/^Representation "([^"]+)" references unknown frame "([^"]+)" in defaultFrame$/))) {
            return { why: 'A Representation "' + m[1] + '" references Frame "' + m[2] + '" which no longer exists. Every Default Frame must point at a real Frame, or be left as None.', fixNav: 'representations', fixLabel: 'Open Representations → ' + m[1] + ' and choose an existing Default Frame' };
        }
        if ((m = msg.match(/^Layout "([^"]+)" references unknown frame "([^"]+)" in supportedFrames$/))) {
            return { why: 'supportedFrames is authoring guidance for which Frames suit this Layout — it should only list Frames that still exist.', fixNav: 'layouts', fixLabel: 'Open Layouts → ' + m[1] };
        }
        if ((m = msg.match(/^(Layout|Frame|Layer|Representation) entry in (\S+) is missing "id"$/))) {
            return { why: 'Every ' + m[1] + ' needs a unique id to be referenced by anything else in this World.', fixNav: NAV_FOR_LABEL[m[1]], fixLabel: 'Open ' + m[1] + 's' };
        }
        if ((m = msg.match(/^(Layout|Frame|Representation) "([^"]+)" \(([^)]+)\) is missing "name"$/))) {
            return { why: 'A ' + m[1] + '\'s Name is what a creator sees in its own picker — it\'s required, not optional.', fixNav: NAV_FOR_LABEL[m[1]], fixLabel: 'Open ' + m[1] + 's → ' + m[2] + ' and set its Name' };
        }
        if ((m = msg.match(/^Duplicate (\w+) id "([^"]+)" in (.+) and (.+)$/))) {
            return { why: 'Every id within its own category must be unique so it can be referenced unambiguously.', fixNav: NAV_FOR_LABEL[m[1]], fixLabel: 'Open ' + _capitalize(m[1]) + 's and rename one of them' };
        }
        if ((m = msg.match(/^theme\.name "([^"]*)" does not match manifest\.name "([^"]*)"$/))) {
            return { why: 'These two must always be identical — Overview keeps them in sync automatically once you re-save the World Name.', fixNav: 'overview', fixLabel: 'Open Overview and re-enter the World Name' };
        }
        if ((m = msg.match(/^(manifest|metadata|theme)\.json missing required field: (\w+)$/))) {
            return { why: 'The World Project Contract requires this field before a World can validate and Build.', fixNav: 'overview', fixLabel: 'Open Overview' };
        }
        if ((m = msg.match(/^Missing required folder: ([\w-]+)\/$/))) {
            return { why: 'Every World needs at least one entry here — an empty folder is the same as none at all.', fixNav: FOLDER_NAV[m[1]], fixLabel: 'Open ' + _capitalize(m[1].replace('-', ' ')) };
        }
        if ((m = msg.match(/^(.+) "([^"]+)" references missing asset "([^"]+)"$/))) {
            return { why: 'This asset file hasn\'t been uploaded yet, so nothing would actually draw at runtime.', fixNav: 'assets', fixLabel: 'Open Assets and upload it' };
        }
        return { why: null, fixNav: null, fixLabel: null };
    }

    function _renderValidationPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Validation', 'Check this World\'s contract and completeness.');
        _stateIntro('validation');

        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'wb-add-btn';
        runBtn.textContent = lastValidation ? '↻ Run Validation Again' : '▶ Run Validation';
        runBtn.addEventListener('click', function () {
            runBtn.textContent = 'Validating…';
            runBtn.disabled = true;
            window.ProjectCompiler.runValidation(project).then(function (result) {
                lastValidation = result;
                _renderValidationPanel();
            });
        });
        contextPanel.appendChild(runBtn);

        if (!lastValidation) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Run validation to check this World against the World Project Contract.';
            contextPanel.appendChild(hint);
            return;
        }

        const result = lastValidation;
        const byCategory = {};
        VALIDATION_CATEGORY_ORDER.forEach(function (c) { byCategory[c] = { errors: [], warnings: [] }; });
        result.errors.forEach(function (e) { byCategory[_categorizeValidationMessage(e)].errors.push(e); });
        result.warnings.forEach(function (w) { byCategory[_categorizeValidationMessage(w)].warnings.push(w); });

        const statusBanner = document.createElement('div');
        statusBanner.className = 'wb-validation-status ' + (result.isValid ? 'pass' : 'fail');
        statusBanner.textContent = result.isValid
            ? '✅ All Good! Ready to build.'
            : '⚠️ ' + result.errors.length + ' error' + (result.errors.length === 1 ? '' : 's') + ' to fix.';
        contextPanel.appendChild(statusBanner);

        const countsLine = document.createElement('p');
        countsLine.className = 'wb-field-hint';
        countsLine.textContent = 'Errors: ' + result.errors.length + ' · Warnings: ' + result.warnings.length;
        contextPanel.appendChild(countsLine);

        VALIDATION_CATEGORY_ORDER.forEach(function (cat) {
            const bucket = byCategory[cat];
            const hasIssues = bucket.errors.length || bucket.warnings.length;
            const row = document.createElement('div');
            row.className = 'wb-validation-row';
            const label = document.createElement('span');
            label.textContent = cat;
            const state = document.createElement('span');
            state.className = 'wb-validation-chip ' + (bucket.errors.length ? 'error' : bucket.warnings.length ? 'warning' : 'pass');
            state.textContent = bucket.errors.length ? 'Error' : bucket.warnings.length ? 'Warning' : 'All good';
            row.appendChild(label);
            row.appendChild(state);
            contextPanel.appendChild(row);
            if (hasIssues) {
                bucket.errors.concat(bucket.warnings).forEach(function (msg) {
                    const detail = document.createElement('p');
                    detail.className = 'wb-field-hint wb-validation-detail';
                    detail.textContent = msg;
                    contextPanel.appendChild(detail);

                    const explained = _explainValidationMessage(msg);
                    if (explained.why) {
                        const why = document.createElement('p');
                        why.className = 'wb-validation-why';
                        why.textContent = 'Why: ' + explained.why;
                        contextPanel.appendChild(why);
                    }
                    if (explained.fixNav) {
                        const fixBtn = document.createElement('button');
                        fixBtn.type = 'button';
                        fixBtn.className = 'wb-fix-now-btn';
                        fixBtn.textContent = '→ Fix Now: ' + explained.fixLabel;
                        fixBtn.addEventListener('click', function () {
                            currentNav = explained.fixNav;
                            _renderNav();
                            _renderWorkspace();
                        });
                        contextPanel.appendChild(fixBtn);
                    }
                });
            }
        });
    }

    // ---------- State 8: Build (Sprint B2.0) ----------

    function _renderBuildPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Build', 'Build your World Package.');
        _stateIntro('build');

        const manifest = window.ProjectModel.manifest(project);
        const infoBox = document.createElement('div');
        infoBox.className = 'wb-build-info-box';
        infoBox.innerHTML =
            '<p><strong>Output File</strong><br>' + (manifest.id || 'world') + '.vtheme</p>' +
            '<p><strong>Version</strong><br>' + (manifest.version || '1.0.0') + '</p>' +
            '<p><strong>Last Validation</strong><br>' + (lastValidation ? (lastValidation.isValid ? 'Passed' : 'Failed') : 'Not run yet') + '</p>';
        contextPanel.appendChild(infoBox);

        const buildBtn = document.createElement('button');
        buildBtn.type = 'button';
        buildBtn.className = 'wb-add-btn wb-build-btn';
        buildBtn.textContent = '🎁 Build World Package';
        buildBtn.addEventListener('click', function () {
            buildBtn.textContent = 'Building…';
            buildBtn.disabled = true;
            window.ProjectCompiler.runBuild(project).then(function (buildResult) {
                lastValidation = buildResult.validationReport;
                if (buildResult.success) {
                    const reader = new FileReader();
                    reader.onload = function () {
                        project.lastBuild = {
                            filename: buildResult.packageFile.filename,
                            size: buildResult.packageSize,
                            version: buildResult.version,
                            builtAt: new Date().toISOString(),
                            dataURL: reader.result
                        };
                        _persist();
                        _renderBuildPanel();
                    };
                    reader.readAsDataURL(buildResult.packageFile.blob);
                } else {
                    _renderBuildPanel();
                    const err = document.createElement('div');
                    err.className = 'wb-validation-status fail';
                    err.textContent = '⚠️ Build failed — fix Validation errors first.';
                    contextPanel.insertBefore(err, contextPanel.firstChild.nextSibling);
                }
            });
        });
        contextPanel.appendChild(buildBtn);

        if (project.lastBuild) {
            const success = document.createElement('div');
            success.className = 'wb-validation-status pass';
            success.textContent = '✓ World Package Built';
            contextPanel.appendChild(success);

            const details = document.createElement('div');
            details.className = 'wb-build-info-box';
            details.innerHTML =
                '<p><strong>Package Name</strong><br>' + project.lastBuild.filename + '</p>' +
                '<p><strong>Package Size</strong><br>' + _formatBytes(project.lastBuild.size) + '</p>' +
                '<p><strong>Build Timestamp</strong><br>' + new Date(project.lastBuild.builtAt).toLocaleString() + '</p>';
            contextPanel.appendChild(details);

            const continueBtn = document.createElement('button');
            continueBtn.type = 'button';
            continueBtn.className = 'wb-add-btn';
            continueBtn.textContent = 'Continue to Publish →';
            continueBtn.addEventListener('click', function () {
                currentNav = 'publish';
                _renderNav();
                _renderWorkspace();
            });
            contextPanel.appendChild(continueBtn);
        }
    }

    function _formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    // ---------- State 9: Publish (Sprint B2.0) ----------

    function _downloadDataURL(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Sprint B2.0.1 — the exact package Build produced, decoded back
    // into a plain {manifest,theme,assets} object. Publish never reads
    // project.files (the editable Project data) — only this.
    async function _lastBuiltPackage(project) {
        const resp = await fetch(project.lastBuild.dataURL);
        return await resp.json();
    }

    function _renderPublishPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Publish', 'Share your World with the world.');
        _stateIntro('publish');

        if (!project.lastBuild) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Build your World Package first — Publish always ships exactly what Build produced.';
            contextPanel.appendChild(hint);
            return;
        }

        const resultBox = document.createElement('div');

        function showResult(cls, text) {
            resultBox.innerHTML = '';
            const div = document.createElement('div');
            div.className = 'wb-validation-status ' + cls;
            div.textContent = text;
            resultBox.appendChild(div);
        }

        // Publish to Official Themes — operates ONLY on the Build
        // output (never project.files), and installs it through the
        // exact same ThemeRegistry.importPackage() a real "Import
        // Theme" click uses (unmodified — no privileged pipeline, per
        // the Import Parity rule). Builder and Runtime share one
        // origin, so ThemeRegistry's own existing localStorage
        // persistence (_persistImported/_loadImported) is what "Runtime
        // automatically discovers the updated package" means here —
        // opening VihuStudio next shows it immediately, with no
        // re-import step.
        async function publishToOfficialThemes() {
            if (typeof window.ThemeRegistry === 'undefined') {
                showResult('fail', '⚠️ ThemeRegistry is not available in this environment.');
                return;
            }
            const pkg = await _lastBuiltPackage(project);
            const result = window.ThemeRegistry.importPackage(pkg, { onDuplicate: 'replace' });
            if (result.ok) {
                showResult('pass', '✓ Published "' + result.manifest.name + '" — VihuStudio will discover it automatically the next time it loads (existing versions replaced).');
            } else if (result.problems) {
                showResult('fail', '⚠️ The built package failed registration: ' + result.problems.join('; '));
            } else {
                showResult('fail', '⚠️ Could not publish — try Building again.');
            }
        }

        const options = [
            {
                icon: '💾', title: 'Export Package', note: 'Download the built .vtheme to your computer — for backup, sharing, or manual import elsewhere.',
                action: function () { _downloadDataURL(project.lastBuild.dataURL, project.lastBuild.filename); }
            },
            {
                icon: '🌐', title: 'Community World', note: 'Share with the community. Coming soon.',
                action: null
            },
            {
                icon: '🏛️', title: 'Publish to Official Themes', note: 'Installs the built package where VihuStudio will find it, replacing any existing version. Uses only the .vtheme Build produced — never this Project\'s editable files.',
                action: publishToOfficialThemes
            }
        ];

        options.forEach(function (opt) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'wb-publish-option';
            row.disabled = !opt.action;
            row.innerHTML =
                '<span class="wb-publish-icon">' + opt.icon + '</span>' +
                '<span class="wb-publish-text"><span class="wb-publish-title">' + opt.title + '</span>' +
                '<span class="wb-publish-note">' + opt.note + '</span></span>';
            if (opt.action) row.addEventListener('click', opt.action);
            contextPanel.appendChild(row);
        });

        contextPanel.appendChild(resultBox);
    }

    // ---------- Placeholder states ----------

    function _renderStubPanel() {
        contextPanel.innerHTML = '';
        const item = NAV_ITEMS.find(function (n) { return n.id === currentNav; });
        const wrap = document.createElement('div');
        wrap.className = 'wb-stub-panel';
        const icon = document.createElement('span');
        icon.className = 'wb-stub-icon';
        icon.textContent = item ? item.icon : '✨';
        const title = document.createElement('span');
        title.className = 'wb-stub-title';
        title.textContent = item ? item.label : '';
        const note = document.createElement('span');
        note.className = 'wb-stub-note';
        note.textContent = 'Coming in the next sprint.';
        wrap.appendChild(icon);
        wrap.appendChild(title);
        wrap.appendChild(note);
        contextPanel.appendChild(wrap);
    }

    renderTemplateGrid();
    renderMyWorlds();
})();
