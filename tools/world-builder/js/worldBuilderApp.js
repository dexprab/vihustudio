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

    workspaceHome.addEventListener('click', showWelcome);

    function openWorkspace(project) {
        currentProject = project;
        currentNav = 'overview';
        const reps = window.ProjectModel.representations(project);
        const layouts = window.ProjectModel.layouts(project);
        currentRepresentationId = reps.length ? reps[0].id : null;
        currentLayoutId = layouts.length ? layouts[0].id : null;
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

    function _renderPreview() {
        previewCanvas.innerHTML = '';
        const wallTone = (function () {
            const state = _activeAspectAndFrame();
            return (state.frame && state.frame.wallTone) || 'var(--wb-cream)';
        })();
        previewCanvas.style.background = wallTone;

        const frameEl = document.createElement('div');
        frameEl.className = 'wb-preview-frame';

        if (currentNav !== 'representations' && currentNav !== 'layouts') {
            frameEl.style.width = '70%';
            frameEl.style.aspectRatio = '3 / 4';
            frameEl.style.borderRadius = '10px';
            const icon = document.createElement('span');
            icon.className = 'wb-preview-icon';
            icon.textContent = currentProject.icon || '🌎';
            const title = document.createElement('span');
            title.className = 'wb-preview-title';
            title.textContent = currentProject.name || 'Untitled World';
            const tagline = document.createElement('span');
            tagline.className = 'wb-preview-tagline';
            tagline.textContent = currentProject.tagline || '';
            frameEl.appendChild(icon);
            frameEl.appendChild(title);
            frameEl.appendChild(tagline);
        } else {
            const state = _activeAspectAndFrame();
            const ratio = ASPECT_RATIOS[state.aspect] || '3 / 4';
            frameEl.style.aspectRatio = ratio;
            frameEl.style.width = (state.aspect === 'wide' || state.aspect === 'landscape') ? '85%' : '55%';
            frameEl.style.borderRadius = '6px';
            if (state.frame) {
                const thickness = state.frame.frameThickness || 0;
                frameEl.style.border = thickness + 'px solid ' + (state.frame.borderColor || '#1D3457');
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

    function _fieldGroup(labelText, inputEl) {
        const group = document.createElement('div');
        group.className = 'wb-field-group';
        const label = document.createElement('label');
        label.className = 'wb-field-label';
        label.textContent = labelText;
        group.appendChild(label);
        group.appendChild(inputEl);
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

    function _assetRow(icon, changeLabel) {
        const row = document.createElement('div');
        row.className = 'wb-asset-row';
        const thumb = document.createElement('span');
        thumb.className = 'wb-asset-thumb';
        thumb.textContent = icon;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wb-asset-change-btn';
        btn.textContent = changeLabel;
        btn.title = 'Asset uploads are coming in a future sprint';
        btn.addEventListener('click', function () {
            btn.textContent = 'Coming soon';
            setTimeout(function () { btn.textContent = changeLabel; }, 1400);
        });
        row.appendChild(thumb);
        row.appendChild(btn);
        return row;
    }

    // ---------- State 1: Overview ----------

    function _renderOverviewPanel() {
        const project = currentProject;
        const man = window.ProjectModel.manifest(project);
        const theme = window.ProjectModel.theme(project);
        _heading('Overview', 'Give your world a wonderful identity.');

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

        const typeRow = document.createElement('div');
        typeRow.className = 'wb-creation-type-row';
        const types = window.ProjectModel.creationTypes(project);
        if (!types.length) {
            const hint = document.createElement('span');
            hint.className = 'wb-field-hint';
            hint.textContent = 'None yet';
            typeRow.appendChild(hint);
        } else {
            types.forEach(function (t) {
                const chip = document.createElement('span');
                chip.className = 'wb-creation-type-chip';
                chip.title = t;
                chip.textContent = CREATION_TYPE_ICONS[t] || '✨';
                typeRow.appendChild(chip);
            });
        }
        _fieldGroup('Creation Types', typeRow);

        _fieldGroup('Publisher', _textInput(man.author, function (v) {
            window.ProjectModel.setIdentity(project, { publisher: v });
            _persist();
        }));

        _fieldGroup('Version', _textInput(man.version, function (v) {
            window.ProjectModel.setIdentity(project, { version: v });
            _persist();
        }));

        _fieldGroup('Thumbnail', _assetRow(project.icon || '🌎', 'Change'));
        _fieldGroup('Hero Image', _assetRow('🖼️', 'Change'));
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
        const project = currentProject;
        _heading('Representations', 'Define how creations can be presented.');

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
        }));

        _fieldGroup('Default Frame', _select(_representationOptionsFor('frame'), rep.defaultFrame, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'defaultFrame', v || null);
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Layer Pack', _select([{ value: 'basic', label: 'Basic' }], 'basic', function () {}));

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
        const project = currentProject;
        _heading('Layouts', 'Design the composition.');

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
        }));

        const holderDiagram = document.createElement('div');
        holderDiagram.className = 'wb-holder-area-diagram';
        holderDiagram.textContent = 'Holder Area';
        _fieldGroup('Holder Area', holderDiagram);

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

    // ---------- Placeholder states ----------

    function _renderStubPanel() {
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
