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

    // Sprint B2.0.5 — Draft Management. Real authoring exposed that
    // there was no visual way to restart from a clean slate: no Rename,
    // Duplicate, or Delete for a World Project once created. All three
    // reuse existing, already-real functions (ProjectModel.setIdentity,
    // ProjectStore.duplicate/remove — the last two shipped in Sprint
    // B2.0.1 for the Workspace header's own overflow menu, just never
    // exposed here); no new persistence logic, no filesystem operation,
    // and Delete only ever removes this Builder Project record — a
    // published Official Theme or exported .vtheme package lives
    // entirely outside ProjectStore's localStorage key, so neither is
    // touched. The card itself changes from a <button> to a
    // role="button" <div> so it can contain its own action <button>s
    // without illegal nested buttons — same pattern already used for
    // Frame/Layout rows in the Workspace (each row's own controls call
    // e.stopPropagation() so a control click never also opens the row).
    function _projectCard(project) {
        const card = document.createElement('div');
        card.className = 'wb-project-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const thumb = document.createElement('span');
        thumb.className = 'wb-project-thumb';
        // The authored World thumbnail is its canonical visual
        // representation wherever a World is shown as a card — the same
        // getAsset/fallback pattern the Overview identity card already
        // uses (_renderIdentityCard) — falling back to the icon glyph
        // only when nothing has been uploaded yet.
        const thumbURL = window.ProjectModel.getAsset(project, 'thumbnail.png');
        if (thumbURL) {
            const img = document.createElement('img');
            img.src = thumbURL;
            img.alt = '';
            thumb.appendChild(img);
        } else {
            thumb.textContent = project.icon || '🌎';
        }

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

        const ctrls = document.createElement('span');
        ctrls.className = 'wb-project-card-controls';
        [
            ['✎', 'Rename', function (e) {
                e.stopPropagation();
                const next = window.prompt('Rename this World', project.name);
                if (next === null) return;
                const trimmed = next.trim();
                if (!trimmed) return;
                window.ProjectModel.setIdentity(project, { name: trimmed });
                window.ProjectStore.save(project);
                renderMyWorlds();
            }],
            ['⧉', 'Duplicate', function (e) {
                e.stopPropagation();
                window.ProjectStore.duplicate(project);
                renderMyWorlds();
            }],
            ['🗑', 'Delete', function (e) {
                e.stopPropagation();
                // Deletes only this Builder Project record (the
                // localStorage draft) — never a published Official
                // Theme or an exported .vtheme package, which live
                // outside ProjectStore entirely and are never touched.
                if (!window.confirm('Delete "' + project.name + '"? This cannot be undone.')) return;
                window.ProjectStore.remove(project.id);
                renderMyWorlds();
            }]
        ].forEach(function (t) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-project-card-btn';
            btn.title = t[1];
            btn.setAttribute('aria-label', t[1]);
            btn.textContent = t[0];
            btn.addEventListener('click', t[2]);
            ctrls.appendChild(btn);
        });

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(ctrls);

        card.addEventListener('click', function () {
            openWorkspace(project);
        });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWorkspace(project);
            }
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

    // Builder V2 — each World template seeds exactly one starter Scene
    // (Engine V2's genuinely new, additive authoring surface), using the
    // Engine Scene Template that best matches that World template's own
    // spirit. Blank World deliberately seeds none — Blueprint §5's own
    // "World with zero Scenes" empty state is exactly this template's
    // "no assumptions" intent, not an oversight.
    const TEMPLATE_STARTER_SCENE = {
        'artwork-gallery': { template: 'single-holder', name: 'Showcase' },
        storybook: { template: 'cover', name: 'Cover' },
        quotes: { template: 'quote', name: 'Quote' },
        sketchbook: { template: 'single-holder', name: 'Sketch' },
        'greeting-cards': { template: 'single-holder', name: 'Card' }
    };

    function _seedStarterScene(project, templateId) {
        const starter = TEMPLATE_STARTER_SCENE[templateId];
        if (!starter) return;
        const scene = window.ProjectModel.addScene(project, starter.template);
        window.ProjectModel.renameScene(project, scene.id, starter.name);
    }

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
            _seedStarterScene(project, entry.id);
            window.ProjectStore.save(project);
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

    // Builder V2 — Global Navigation (docs/BUILDER_V2_VISION.md §1):
    // World | Scenes | Validation | Build | Publish, exactly five
    // destinations, moved to the top and structurally outside the
    // workspace. Theme Assets is reachable only as a secondary link from
    // World (Vision §1) — 'assets' stays a valid internal state but is
    // deliberately not one of these five entries.
    //
    // Representations/Layouts/Frames/Layer Packs are no longer top-level
    // destinations — Engine V2 folds Canvas+Holders directly into each
    // Scene (Engine Canon §2). Their render functions below
    // (_renderRepresentationsPanel etc.) are retained, not deleted:
    // Frame selection returns inside the Place activity per Blueprint §8
    // once that activity is built (a following slice), and rewriting
    // that logic from scratch then would be wasted work. Until that
    // slice lands they are unreachable from this nav — a disclosed,
    // temporary gap, not a silent one (see this slice's own commit
    // message / implementation report).
    const NAV_ITEMS = [
        { id: 'overview', icon: '🌍', label: 'World' },
        { id: 'scenes', icon: '🎬', label: 'Scenes' },
        { id: 'validation', icon: '✅', label: 'Validation' },
        { id: 'build', icon: '🔨', label: 'Build' },
        { id: 'publish', icon: '📤', label: 'Publish' }
    ];

    // Builder V2 — the three Creative Activities (Vision §3). Scene
    // Configuration is deliberately not a fourth entry (Vision §2) — it
    // is selected via the Scene Header's glance, not this switcher.
    const ACTIVITIES = [
        { id: 'place', icon: '🖼️', label: 'Place' },
        { id: 'decorations', icon: '✨', label: 'Decorations' },
        { id: 'text', icon: '✍️', label: 'Text' }
    ];

    // AP-002 — small inline line-icon set (currentColor, no binary
    // assets) for the Context Inspector's own panel-title headings —
    // the specific emoji-as-heading usage AP-002 flagged. Nav bar/
    // Activity switcher/row-control glyphs are a separate, established
    // emoji-based visual language used consistently across the whole
    // app (Story Meadow, Sticker Studio, etc.) and are out of this
    // narrower scope, since no built vector icon set exists yet to
    // replace them with (assets/icons/* are still empty placeholder
    // folders reserved by the Product Asset System sprint).
    const ICONS = {
        place: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="15" height="12" rx="1.5"/><circle cx="7" cy="8.5" r="1.4"/><path d="M3.5 14.5l4.5-4.5 3 3 5-5"/></svg>',
        decorations: '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 1.5l1.7 6.3 6.3 1.7-6.3 1.7L10 18.5l-1.7-6.3-6.3-1.7 6.3-1.7z"/></svg>',
        text: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5V13l9-9 3.5 3.5-9 9H3z"/><path d="M11 5l3.5 3.5"/></svg>'
    };

    const CREATION_TYPE_ICONS = {
        story: '📖', artwork: '🖼️', quote: '💬', card: '💌',
        'artwork-collection': '🗂️', poem: '📝'
    };

    // Sprint B2.0.1 — Builder Guidance. Every Workspace state opens with
    // a concise What/Why/Do/Next explanation so a creator never has to
    // leave the Builder to open a contract doc. Kept short on purpose —
    // this is a one-paragraph orientation, not documentation.
    const STATE_GUIDANCE = {
        overview: 'What: your World\'s identity — name, tagline, description, and how it introduces itself. Why: this is the card a child sees before picking your World. Do: fill in the fields below and upload a Thumbnail/Hero Image. Next: head to Scenes to add the pages this World offers.',
        scenes: 'What: the actual pages of your World — each one a complete, curated Scene (a shape, its photo spots, its decoration, its words). Why: a World is a curated library of Scenes — this is that library. Do: press Add a Scene, choose a Scene Template, then open it to set its shape in the Scene Configuration glance above Working View. Next: use Place/Decorations/Text to design what\'s actually on the page.',
        representations: 'What: the page styles a child can choose (e.g. Showcase, Portrait, Quote). Why: Studio\'s Creation Flow shows exactly these, nothing more. Do: pick or add a Representation, then set its Default Layout and Default Frame. Next: make sure every Layout/Frame you reference actually exists (see Layouts/Frames).',
        layouts: 'What: the geometry each page can use — aspect ratio, caption position, composition. Why: a Representation always points at one of these. Do: adjust Aspect/Composition/Spacing for the selected Layout, or add a new one. Next: design a Frame to go with it.',
        frames: 'What: the visual "mount" around the artwork — mat, border, wall colour, shadow. Why: a Representation\'s Default Frame decides how its pictures are presented. Do: tune the fields for the selected Frame, or create another. Next: connect Frames to Layer Packs for captions and decorations.',
        layerpacks: 'What: small elements placed on the page — captions, page numbers, stickers. Why: this is how a World adds its own personality on top of a Layout/Frame. Do: add Layers and set their Target Container/Anchor. Next: check Assets for anything these Layers need (like a decoration image).',
        assets: 'What: the images (and other files) this World needs. Why: Thumbnail and Hero Image are required before you can Build; everything else is optional polish. Do: upload what you have — the checklist shows exactly what\'s missing and why. Next: run Validation once everything looks complete.',
        validation: 'What: a real check of this World against the World Project Contract — the same rules Studio itself enforces. Why: catches problems before you spend time Building. Do: press Run Validation, then fix anything marked Error (Warnings are optional polish). Next: once it says "All Good!", move on to Build.',
        build: 'What: compiles this World Project into a real .vtheme package, the same file format VihuStudio imports. Why: nothing can be Published until it\'s Built. Do: press Build World Package (Validation must pass first). Next: once built, continue to Publish.',
        publish: 'What: share the World Package Build just produced. Why: a World only reaches VihuStudio once it leaves the Builder. Do: choose Export (download for backup/sharing) or Publish to Official Themes (installs it where Studio will find it). Next: open VihuStudio and confirm your World appears.'
    };

    // Sprint B2.0.6 — Builder Information Density. This guidance was
    // always useful once, rarely useful twice — but it used to occupy
    // permanent, premium Property Editor space above every single field.
    // A native <details> collapses it by default (no `open` attribute)
    // so documentation never competes with editing, while staying one
    // click away for whoever still wants it; no JS toggle logic needed,
    // the browser already does this correctly and accessibly.
    function _stateIntro(navId) {
        const text = STATE_GUIDANCE[navId];
        if (!text) return;
        const parts = text.split(/(What:|Why:|Do:|Next:)/).filter(function (s) { return s.trim().length; });
        const details = document.createElement('details');
        details.className = 'wb-state-intro';
        const summary = document.createElement('summary');
        summary.className = 'wb-state-intro-summary';
        summary.textContent = 'What is this, and what should I do here?';
        details.appendChild(summary);
        const body = document.createElement('div');
        body.className = 'wb-state-intro-body';
        for (let i = 0; i < parts.length; i += 2) {
            const label = parts[i];
            const bodyText = parts[i + 1] || '';
            const p = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = label + ' ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(bodyText.trim()));
            body.appendChild(p);
        }
        details.appendChild(body);
        contextPanel.appendChild(details);
    }

    function _fieldHelp(text) {
        const p = document.createElement('p');
        p.className = 'wb-field-help';
        p.textContent = text;
        return p;
    }

    const workspaceNav = $('wb-global-nav');
    const sceneHeaderEl = $('wb-scene-header');
    const workspaceName = $('wb-workspace-name');
    const workspaceHome = $('wb-workspace-home');
    const workingCanvas = $('wb-working-canvas');
    const workingOverlays = $('wb-working-overlays');
    const runtimePreviewCanvas = $('wb-runtime-preview-canvas');
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
    // Engine V2's own Validation report (Scenes) — deliberately a
    // separate result, not merged into `lastValidation`'s V1 category
    // list, since Scene Model §5/LOCK V2-04 treats Engine V2 Validation
    // as its own pipeline operating directly on the canonical Scene
    // Model, never routed through or interleaved with Engine V1's.
    let lastSceneValidation = null;

    // Builder V2 — Scenes state. `currentSceneId` null means the Scenes
    // Library is showing; set means a specific Scene's editor is open.
    // `currentInspectorTarget` is the selection driving Context Inspector
    // independently of `currentActivity` (Vision §2 — Scene Configuration
    // is a selectable target but never an activity of its own).
    let currentSceneId = null;
    let currentActivity = 'place';
    let currentInspectorTarget = null;
    let scenesShowingTemplatePicker = false;

    workspaceHome.addEventListener('click', showWelcome);

    // ---------------------------------------------------------------
    // Header toolbar (Sprint B2.0.1 — Preview/Settings/Save/Menu, all
    // real, none decorative).
    // ---------------------------------------------------------------

    const btnSettings = $('wb-btn-settings');
    const btnSave = $('wb-btn-save');
    const btnMenu = $('wb-btn-menu');
    const menuDropdown = $('wb-menu-dropdown');
    const menuDuplicate = $('wb-menu-duplicate');
    const menuResetLayout = $('wb-menu-reset-layout');
    const menuDelete = $('wb-menu-delete');
    const savedBadge = $('wb-workspace-saved');
    const saveDot = $('wb-save-dot');
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

    // Sprint B2.0.6 — Editing Confidence. "Draft Saved" was a single,
    // static label that never actually told a creator whether their
    // most recent keystroke had been saved. Every edit already
    // autosaves synchronously (ProjectStore.save is a plain localStorage
    // write — there is no genuine async gap to bridge), so rather than
    // fake a "Saving…" sub-state that would never be observably
    // different from "dirty" in the same synchronous tick, the save
    // itself still happens immediately and only the *visible* return to
    // "saved" is deliberately debounced off the trailing edge of edits —
    // this both gives the 🟠 Unsaved Changes state a real, perceptible
    // moment on screen, and keeps the indicator from flickering on every
    // keystroke while a creator is still typing.
    let _saveDisplayTimer = null;
    function _setSaveState(state) {
        if (state === 'error') {
            // AV-009 — a real, visible failure state: the previous binary
            // dirty/saved model had no way to say "this did not actually
            // save," which is exactly how a quota-exceeded write went
            // unnoticed until the next reload silently reverted it.
            saveDot.textContent = '🔴';
            savedText.textContent = 'Save Failed — try a smaller image';
        } else if (state === 'dirty') {
            saveDot.textContent = '🟠';
            savedText.textContent = 'Unsaved Changes';
        } else {
            saveDot.textContent = '🟢';
            savedText.textContent = 'All Changes Saved';
        }
        savedBadge.classList.toggle('wb-save-dirty', state === 'dirty');
        savedBadge.classList.toggle('wb-save-saved', state === 'saved');
        savedBadge.classList.toggle('wb-save-error', state === 'error');
        btnSave.classList.toggle('wb-save-btn-dirty', state !== 'saved');
    }

    // Save — every field already autosaves on change (ProjectStore.save
    // per edit); this button's job is an explicit, user-visible
    // confirmation that nothing is pending, not a second save mechanism.
    btnSave.addEventListener('click', function () {
        const result = window.ProjectStore.save(currentProject);
        clearTimeout(_saveDisplayTimer);
        _setSaveState(result.ok ? 'saved' : 'error');
    });

    // Overflow menu — Duplicate/Reset Layout/Delete. No dead entries.
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

    menuResetLayout.addEventListener('click', function () {
        _resetWorkspaceLayout();
        menuDropdown.classList.add('wb-hidden');
    });

    menuDelete.addEventListener('click', function () {
        if (!window.confirm('Delete "' + currentProject.name + '"? This cannot be undone.')) return;
        window.ProjectStore.remove(currentProject.id);
        menuDropdown.classList.add('wb-hidden');
        showWelcome();
    });

    // ---------------------------------------------------------------
    // Builder V2 — Vision §4 realignment (v1.1 reorder: Working View |
    // Context Inspector | Runtime Preview). Two sash-style resize
    // handles, each a real CSS Grid track (see world-builder.css's
    // .wb-workspace-body rule) rather than an absolutely-positioned
    // overlay recomputed after every render — a real grid track can
    // never drift out of sync with the panel boundary it drags, and
    // resizing it is nothing more than writing one CSS custom property.
    // Previously (Sprint B2.0.6) the Inspector sash resized its *height*,
    // since Context Inspector was a full-width row beneath Working View +
    // Runtime Preview. Vision §4 makes Context Inspector a full-height
    // column instead, so both sashes are vertical (col-resize) and both
    // persisted dimensions are widths: --wb-inspector-w (Working View ↔
    // Context Inspector boundary) and --wb-runtime-w (Context Inspector ↔
    // Runtime Preview boundary).
    // ---------------------------------------------------------------

    const WORKSPACE_LAYOUT_KEY = 'vihustudio.worldBuilder.workspaceLayout';
    // Vision §4's own explicit warning: a naive equal three-way split
    // would under-serve Context Inspector, so its default (420px) is
    // deliberately generous relative to Runtime Preview's (340px) —
    // Working View largest, Context Inspector medium, Runtime Preview
    // smallest, per its own lower edit-frequency role (v1.1).
    const LAYOUT_DEFAULTS = { runtimeW: 340, inspectorW: 420 };
    const INSPECTOR_PCT_MIN = 0.25, INSPECTOR_PCT_MAX = 0.65; // Working View >=35%, Context Inspector >=25% of the Working+Inspector share
    const RUNTIME_W_MIN = 260, RUNTIME_PCT_MAX = 0.4; // Runtime Preview never exceeds 40% of the full workspace width, and has a smaller floor since it's the smallest pane

    const workspaceBody = $('wb-workspace-body');
    const resizeRuntime = $('wb-resize-runtime');
    const resizeInspector = $('wb-resize-inspector');

    function _loadWorkspaceLayout() {
        try {
            const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_KEY);
            if (!raw) return Object.assign({}, LAYOUT_DEFAULTS);
            const parsed = JSON.parse(raw);
            return {
                runtimeW: typeof parsed.runtimeW === 'number' ? parsed.runtimeW : LAYOUT_DEFAULTS.runtimeW,
                inspectorW: typeof parsed.inspectorW === 'number' ? parsed.inspectorW : LAYOUT_DEFAULTS.inspectorW
            };
        } catch (e) {
            return Object.assign({}, LAYOUT_DEFAULTS);
        }
    }

    function _saveWorkspaceLayout(layout) {
        try {
            window.localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(layout));
        } catch (e) { /* localStorage unavailable — layout simply won't persist */ }
    }

    function _applyWorkspaceLayout() {
        const layout = _loadWorkspaceLayout();
        workspaceBody.style.setProperty('--wb-runtime-w', layout.runtimeW + 'px');
        workspaceBody.style.setProperty('--wb-inspector-w', layout.inspectorW + 'px');
    }

    // Reset Workspace Layout (three-dot menu) — clears the persisted
    // preference and reapplies the shipped defaults immediately, on
    // this Workspace, without a reload.
    function _resetWorkspaceLayout() {
        try { window.localStorage.removeItem(WORKSPACE_LAYOUT_KEY); } catch (e) { /* ignore */ }
        _applyWorkspaceLayout();
    }

    // One shared drag driver for both handles — each just supplies how
    // to read/clamp/write its own dimension from a pointer position. The
    // Navigation sash retired along with the left sidebar it used to
    // resize (Builder V2 — Vision §1 moves Navigation to a top bar with
    // nothing left to drag).
    function _wireResizeHandle(handle, onDrag) {
        handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            handle.classList.add('wb-resize-dragging');
            const bodyRect = workspaceBody.getBoundingClientRect();
            function move(ev) { onDrag(ev, bodyRect); }
            function up() {
                handle.classList.remove('wb-resize-dragging');
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                const layout = _loadWorkspaceLayout();
                const current = getComputedStyle(workspaceBody);
                layout.runtimeW = parseFloat(current.getPropertyValue('--wb-runtime-w')) || layout.runtimeW;
                layout.inspectorW = parseFloat(current.getPropertyValue('--wb-inspector-w')) || layout.inspectorW;
                _saveWorkspaceLayout(layout);
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    // Working View ↔ Context Inspector boundary. Bounded as a percentage
    // of the width available to those two columns alone (total width
    // minus both 6px sashes minus Runtime Preview's own current width),
    // so resizing Runtime Preview first and then this sash still yields
    // sane Working/Inspector proportions.
    _wireResizeHandle(resizeInspector, function (e, bodyRect) {
        const runtimeW = parseFloat(getComputedStyle(workspaceBody).getPropertyValue('--wb-runtime-w')) || LAYOUT_DEFAULTS.runtimeW;
        const combinedW = bodyRect.width - 12 - runtimeW; // both 6px sashes + Runtime Preview's own column
        if (combinedW <= 0) return;
        const rightEdge = bodyRect.right - runtimeW - 6; // boundary of Context Inspector's own right edge
        const inspectorW = Math.min(combinedW * INSPECTOR_PCT_MAX, Math.max(combinedW * INSPECTOR_PCT_MIN, rightEdge - e.clientX));
        workspaceBody.style.setProperty('--wb-inspector-w', inspectorW + 'px');
    });

    // Context Inspector ↔ Runtime Preview boundary. Runtime Preview is
    // the rightmost column, so its width is simply the distance from the
    // cursor to the workspace's own right edge.
    _wireResizeHandle(resizeRuntime, function (e, bodyRect) {
        const maxW = Math.min(bodyRect.width * RUNTIME_PCT_MAX, bodyRect.width - 12 - 300);
        const runtimeW = Math.min(maxW, Math.max(RUNTIME_W_MIN, bodyRect.right - e.clientX));
        workspaceBody.style.setProperty('--wb-runtime-w', runtimeW + 'px');
    });

    // ---------------------------------------------------------------
    // Sprint B2.0.3 — Working View + Runtime Preview. Both are real
    // renders through VihuStudio's own engine (renderer/slideRenderer.js,
    // unmodified) — the same pipeline Runtime uses, fed from a
    // lightweight, synchronous "live theme" built straight off
    // ProjectModel accessors (below), not the heavier
    // ProjectCompiler/builder.js Blob-based pipeline Validate/Build use.
    // That heavier path is correct for a one-shot compile; it is far too
    // slow to re-run on every keystroke, and every edit here must
    // re-render with no Save/Build/Validate step. There is exactly one
    // render call (SlideRenderer.render) invoked twice — once per
    // canvas — never a second, Builder-owned rendering implementation.
    // ---------------------------------------------------------------

    // Mirrors builder.js's collectFolder() exactly (spec §5/§6/§7: a
    // folder's .json files each hold either one object or an array;
    // flatten to one array either way) but reads project.files directly
    // — already-parsed JS values in memory, no Blob/FileReader round
    // trip — since this must be cheap enough to call on every edit.
    function _collectFolderLight(project, folderPrefix) {
        const out = [];
        const prefix = folderPrefix + '/';
        Object.keys(project.files).forEach(function (path) {
            if (path.indexOf(prefix) !== 0) return;
            const val = project.files[path];
            if (Array.isArray(val)) out.push.apply(out, val);
            else if (val && typeof val === 'object') out.push(val);
        });
        return out;
    }

    // Mirrors builder.js's buildManifest()/buildTheme() merge rules
    // exactly (metadata fields fill gaps manifest.json doesn't set;
    // layouts/frameVariations/layerPack/representations flatten onto
    // theme.json only when theme.json doesn't already define them) —
    // same compiled shape Build produces, computed synchronously.
    function _buildLiveManifest(project) {
        const man = window.ProjectModel.manifest(project);
        const meta = window.ProjectModel.metadata(project);
        const manifest = Object.assign({}, man);
        Object.keys(meta).forEach(function (key) {
            if (manifest[key] === undefined) manifest[key] = meta[key];
        });
        return manifest;
    }

    function _buildLiveTheme(project, manifest) {
        const theme = Object.assign({}, window.ProjectModel.theme(project));
        theme.id = manifest.id;
        theme.name = manifest.name;
        const layouts = _collectFolderLight(project, 'layouts');
        const frameVariations = _collectFolderLight(project, 'frames');
        const layerPack = _collectFolderLight(project, 'layer-packs');
        const representations = _collectFolderLight(project, 'representations');
        if (theme.layouts === undefined && layouts.length) theme.layouts = layouts;
        if (theme.frameVariations === undefined && frameVariations.length) theme.frameVariations = frameVariations;
        if (theme.layerPack === undefined) theme.layerPack = layerPack;
        if (theme.representations === undefined && representations.length) theme.representations = representations;
        return theme;
    }

    // A generic sample artwork image, drawn once into an offscreen
    // canvas and cached — Layout/Frame/Representation editing always
    // has *something* to show in the picture holder, without a real
    // upload (Sprint B2.0.3 "Layout Sample Content"). Never saved,
    // never part of the Project — purely an in-memory Image the
    // renderer treats like any other s.image.
    let _cachedSampleImage = null;
    let _sampleImageWaiters = [];
    function _sampleArtworkImage(onReady) {
        if (_cachedSampleImage) { onReady(_cachedSampleImage); return; }
        _sampleImageWaiters.push(onReady);
        if (_sampleImageWaiters.length > 1) return;
        const off = document.createElement('canvas');
        off.width = 640; off.height = 640;
        const octx = off.getContext('2d');
        const grad = octx.createLinearGradient(0, 0, 0, 640);
        grad.addColorStop(0, '#9FB0CB');
        grad.addColorStop(1, '#3D5A82');
        octx.fillStyle = grad;
        octx.fillRect(0, 0, 640, 640);
        octx.fillStyle = '#FFD27A';
        octx.beginPath();
        octx.arc(640 * 0.72, 640 * 0.28, 60, 0, Math.PI * 2);
        octx.fill();
        octx.fillStyle = 'rgba(255,255,255,0.9)';
        octx.font = 'bold 34px Georgia, serif';
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText('Sample Artwork', 320, 560);
        const img = new Image();
        img.onload = function () {
            _cachedSampleImage = img;
            const waiters = _sampleImageWaiters;
            _sampleImageWaiters = [];
            waiters.forEach(function (cb) { cb(img); });
        };
        img.src = off.toDataURL('image/png');
    }

    // Generic sample metadata (Museum Caption / slideCaption / Quote
    // sources all read specific slide.metadata fields — see
    // renderer/slideRenderer.js's _drawMuseumCaption/_drawQuoteText) so
    // whichever text a World's own Layer Pack/Composition draws has
    // real-looking sample content instead of rendering nothing.
    const SAMPLE_METADATA = {
        artworkTitle: 'Sample Artwork',
        artist: 'Sample Artist',
        age: '8',
        date: 'This Year',
        caption: 'A sample caption for this World.',
        quoteText: 'Every world begins with a single idea.',
        quoteAttribution: 'Sample Author'
    };

    // Same Story-runtime-chrome suppression Sprint B2.0.2 fixed for the
    // old Preview modal (no invented page number / book-title footer /
    // "@vihuplanet" handle) — this is a *generic sample page*, not a
    // simulated book.
    const SAMPLE_THEME_OPTIONS = {
        variant: 'classic',
        panelStyle: 'classic',
        footerStyle: 'classic',
        decorations: [],
        pageNumber: 'hidden',
        bookTitleVisibility: 'hide',
        bookTitlePosition: 'bottom-left',
        handleVisibility: 'hide',
        handlePosition: 'top-right'
    };

    // Resolves which Layout/Frame this render should show for the
    // current Nav + selection — same resolution rules the pre-B2.0.3
    // illustrative mockup used (_activeAspectAndFrame), now driving the
    // real renderer instead of a DOM approximation.
    function _resolveActiveLayoutAndFrame(project) {
        const layouts = window.ProjectModel.layouts(project);
        const frames = window.ProjectModel.frames(project);
        let layoutId = (layouts[0] || {}).id || null;
        let frame = frames[0] || null;

        if (currentNav === 'layouts') {
            const layout = window.ProjectModel.findLayout(project, currentLayoutId) || layouts[0];
            layoutId = layout ? layout.id : null;
            const rep = window.ProjectModel.findRepresentation(project, currentRepresentationId);
            const repFrame = rep && window.ProjectModel.findFrame(project, rep.defaultFrame);
            if (repFrame) frame = repFrame;
        } else if (currentNav === 'frames') {
            frame = window.ProjectModel.findFrame(project, currentFrameId) || frame;
        } else {
            const rep = window.ProjectModel.findRepresentation(project, currentRepresentationId);
            if (rep) {
                layoutId = rep.layout || layoutId;
                const repFrame = window.ProjectModel.findFrame(project, rep.defaultFrame);
                if (repFrame) frame = repFrame;
            }
        }
        return { layoutId: layoutId, frame: frame };
    }

    // The one shared synthetic slide both Working View and Runtime
    // Preview render — same data, same SlideRenderer.render() call,
    // just two target canvases (one gets Builder overlays drawn on top
    // afterward, in DOM, never touching this object or the canvas
    // pixels the Runtime Preview canvas also received).
    function _buildPreviewSlide(sampleImage) {
        const project = currentProject;
        const manifest = _buildLiveManifest(project);
        const theme = _buildLiveTheme(project, manifest);
        const isArtwork = manifest.type === 'artwork';
        const active = _resolveActiveLayoutAndFrame(project);
        const frameId = active.frame ? active.frame.id : null;

        return {
            image: sampleImage,
            storyBeat: '',
            bookTitle: '',
            handle: '',
            page: 1,
            totalPages: 1,
            theme: isArtwork ? null : theme,
            themeOptions: SAMPLE_THEME_OPTIONS,
            artworkTheme: isArtwork ? theme : null,
            imageView: null,
            overrides: null,
            pageType: 'story',
            metadata: Object.assign({
                layout: active.layoutId,
                cardOverrides: (isArtwork && frameId) ? { artwork: { frameVariation: frameId } } : null
            }, SAMPLE_METADATA)
        };
    }

    // AV-008 — Builder navigation memory (which nav/Scene/Holder/Frame an
    // author was last looking at), deliberately kept out of the Project
    // itself: it never touches `project.updatedAt` or `ProjectStore.save`,
    // so merely opening/browsing a World can never be mistaken for
    // *editing* it — exactly the "open time vs. edit time" conflation
    // this ticket's own Project Activity investigation flagged as a risk.
    // A brand-new World has no entry here yet, which is precisely what
    // makes it correctly start on World (New World Behaviour) — no
    // separate "is this new" flag needed.
    const EDITING_CONTEXT_KEY = 'vihu-world-builder-editing-context';

    function _readEditingContexts() {
        try {
            const raw = localStorage.getItem(EDITING_CONTEXT_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) { return {}; }
    }

    function _saveEditingContext() {
        if (!currentProject) return;
        try {
            const map = _readEditingContexts();
            map[currentProject.id] = {
                nav: currentNav,
                sceneId: currentSceneId,
                activity: currentActivity,
                inspectorTarget: currentInspectorTarget,
                frameId: currentFrameId
            };
            localStorage.setItem(EDITING_CONTEXT_KEY, JSON.stringify(map));
        } catch (e) {}
    }

    function _loadEditingContext(projectId) {
        return _readEditingContexts()[projectId] || null;
    }

    // Validates a restored `currentInspectorTarget` still resolves to a
    // real object — a Holder/Layer/Frame remembered from a previous
    // session may have been deleted since.
    function _isValidInspectorTarget(project, sceneId, target) {
        if (!target) return false;
        if (target === 'sceneConfig') return !!sceneId;
        if (!sceneId) return false;
        if (target.indexOf('holder:') === 0) {
            return !!window.ProjectModel.findHolder(project, sceneId, target.slice('holder:'.length));
        }
        if (target.indexOf('layer:') === 0) {
            return !!window.ProjectModel.findSceneLayer(project, sceneId, target.slice('layer:'.length));
        }
        return false;
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
        lastSceneValidation = null;
        currentSceneId = null;
        currentActivity = 'place';
        currentInspectorTarget = null;
        scenesShowingTemplatePicker = false;

        // AV-008 — resume the author's last meaningful editing context
        // (Scene → Holder → Frame, Scene → Text, Scene → Decorations, or
        // simply the last Global Nav tab) instead of always restarting
        // on World, whenever it's still valid — a Scene/Holder/Layer/
        // Frame remembered from a previous session may have been deleted
        // since, in which case this falls back to today's defaults
        // rather than opening onto a reference that no longer exists.
        // No architectural constraint prevented this: the same
        // ProjectModel lookups Working View already uses to render each
        // state are enough to validate a remembered selection.
        const restored = _loadEditingContext(project.id);
        if (restored && restored.nav) {
            const navNeedsScene = restored.nav === 'scenes' || restored.nav === 'frames' || restored.nav === 'layerpacks';
            const scene = restored.sceneId ? window.ProjectModel.findScene(project, restored.sceneId) : null;
            if (!navNeedsScene || scene) {
                currentNav = restored.nav;
                currentSceneId = scene ? scene.id : null;
                currentActivity = restored.activity || 'place';
                if (restored.frameId && window.ProjectModel.findFrame(project, restored.frameId)) {
                    currentFrameId = restored.frameId;
                }
                if (_isValidInspectorTarget(project, currentSceneId, restored.inspectorTarget)) {
                    currentInspectorTarget = restored.inspectorTarget;
                } else if (currentSceneId) {
                    currentInspectorTarget = 'sceneConfig';
                }
            }
        }

        _hideAllScreens();
        screenWorkspace.classList.remove('wb-hidden');
        _renderWorkspaceHeader();
        _renderNav();
        _renderWorkspace();
        _applyWorkspaceLayout();
        _setSaveState('saved');
    }

    // Sprint B2.0.6 — see _setSaveState above for why this shows the
    // dirty indicator immediately, saves synchronously (no data-loss
    // risk from debouncing the real write), and only debounces the
    // *return* to "saved" so rapid edits settle into one clean
    // confirmation instead of flickering.
    function _persist() {
        _setSaveState('dirty');
        const result = window.ProjectStore.save(currentProject);
        clearTimeout(_saveDisplayTimer);
        if (!result.ok) {
            // AV-009 — a save that didn't actually reach localStorage
            // (quota exceeded is the realistic case, e.g. a very large
            // upload) must never claim "All Changes Saved" — that lie is
            // exactly what let Hero Image uploads silently vanish on the
            // next reload. Show the real state and keep it visible
            // (no auto-return to "saved") until a save actually succeeds.
            _setSaveState('error');
        } else {
            _saveDisplayTimer = setTimeout(function () {
                _setSaveState('saved');
            }, 600);
        }
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
                // "Back to Scenes" is always one click on the Scenes
                // item itself (Blueprint §6 — World-level navigation
                // stays reachable the entire time a Scene is open),
                // whether arriving from elsewhere or already there.
                if (item.id === 'scenes') {
                    currentSceneId = null;
                    scenesShowingTemplatePicker = false;
                    currentInspectorTarget = null;
                }
                _renderNav();
                _renderWorkspace();
            });
            workspaceNav.appendChild(btn);
        });
    }

    function _renderWorkspace() {
        _saveEditingContext();
        _renderSceneHeader();
        _renderPreview();
        _renderContextPanel();
    }

    // ---------- Working View + Runtime Preview (Sprint B2.0.3) ----------

    function _capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
    }

    // Overview isn't editing a rendered page at all — it's World
    // identity (Name/Tagline/Hero/Thumbnail), which the Slide-rendering
    // contract has no concept of. Rather than force it through
    // SlideRenderer, Working View keeps a small identity card there
    // (Working View is explicitly allowed to be context-aware and show
    // something other than a rendered page); every other state edits a
    // real page, so Working View renders it for real. Runtime Preview
    // (the right column) always shows the real rendered page regardless
    // of Nav, since it must always answer "what will the reader see."
    function _workingViewIsIdentityCard() {
        return currentNav === 'overview' && window.ProjectModel.representations(currentProject).length === 0;
    }

    function _renderIdentityCard(target) {
        // Only removes a previous identity card, never the canvas/overlay
        // siblings that also live in this wrap — those must survive so
        // later renders can find them again.
        const existing = target.querySelector('.wb-preview-frame');
        if (existing) existing.remove();
        target.classList.remove('wb-hidden');
        const strayInactive = target.parentElement.querySelector('.wb-inactive-state');
        if (strayInactive) strayInactive.remove();
        const frameEl = document.createElement('div');
        frameEl.className = 'wb-preview-frame';
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
        target.appendChild(frameEl);
    }

    // The single entry point every edit handler calls. Builds one
    // synthetic slide, renders it into both canvases via the real
    // SlideRenderer (identical call, two targets — no second rendering
    // implementation), then draws Working-View-only guide overlays.
    // Sample artwork loads once and is cached; every call after the
    // first resolves synchronously.
    // AV-005 — Runtime Preview is project-scoped, never editor-scoped: it
    // continues rendering the current Museum Scene through the real
    // Engine V2 pipeline whenever one is open behind the active editor,
    // regardless of which reusable-asset editor (Frames/Layer Packs/etc.,
    // reached via the Place activity's "manage the full shelf" bridges,
    // Blueprint §6.3) Working View currently shows instead. Working View
    // itself is unaffected — it stays free to become a specialized editor
    // for whatever `currentNav` names, per AV-004's own "Working View is
    // editor-scoped" rule.
    function _activeSceneForRuntimePreview() {
        if (!currentSceneId) return null;
        return window.ProjectModel.findScene(currentProject, currentSceneId) || null;
    }

    // AV-008 — Working View and Runtime Preview only ever "activate"
    // while a Scene is actually being authored (the Scene editor itself,
    // or a Scene-anchored bridge editor like Manage Frames/Layer Packs —
    // both keep currentSceneId set). Outside that, showing a legacy
    // Engine V1 specimen (built from whichever Representation/Layout/
    // Frame happens to be selected) was a pseudo-preview of World
    // metadata Museum Theme authoring doesn't actually use — this
    // replaces that with an explicit, honest inactive state instead,
    // with a direct path into Scene authoring.
    function _renderInactiveWorkspace() {
        const hasAnyScenes = window.ProjectModel.scenes(currentProject).length > 0;

        workingOverlays.innerHTML = '';
        const strayFrame = workingCanvas.parentElement.querySelector('.wb-preview-frame');
        if (strayFrame) strayFrame.remove();
        workingCanvas.classList.add('wb-hidden');
        // The aspect-ratio-locked -inner box collapses to near-zero size
        // once its only normally-sized content (the canvas) is hidden —
        // mount the panel on the outer wrap instead, which keeps its own
        // real flex:1 size regardless of canvas state, and hide the now-
        // empty inner box outright so it doesn't leave a stray 0-size gap.
        const wrap = workingCanvas.parentElement.parentElement;
        workingCanvas.parentElement.classList.add('wb-hidden');

        let panel = wrap.querySelector('.wb-inactive-state');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'wb-inactive-state';
            wrap.appendChild(panel);
        }
        panel.innerHTML = '';
        const icon = document.createElement('span');
        icon.className = 'wb-inactive-state-icon';
        icon.textContent = '🎬';
        const title = document.createElement('p');
        title.className = 'wb-inactive-state-title';
        title.textContent = hasAnyScenes ? 'No Scene open.' : 'No Scene yet.';
        const body = document.createElement('p');
        body.className = 'wb-inactive-state-body';
        body.textContent = hasAnyScenes
            ? 'Select a Scene to begin authoring.'
            : 'Create your first Scene to begin authoring.';
        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'wb-add-btn';
        cta.textContent = hasAnyScenes ? 'Go to Scenes' : '+ Create Scene';
        cta.addEventListener('click', function () {
            currentNav = 'scenes';
            if (!hasAnyScenes) scenesShowingTemplatePicker = true;
            _renderNav();
            _renderWorkspace();
        });
        panel.appendChild(icon);
        panel.appendChild(title);
        panel.appendChild(body);
        panel.appendChild(cta);

        _renderRuntimePreviewEmpty(hasAnyScenes
            ? 'Runtime Preview becomes available once a Scene is open.'
            : 'Runtime Preview becomes available once a Scene has been created.');

        previewSelector.innerHTML = '';
    }

    function _renderPreview() {
        if (currentNav === 'scenes') {
            return _renderScenesWorkingView();
        }

        const activeScene = _activeSceneForRuntimePreview();
        if (!activeScene) {
            return _renderInactiveWorkspace();
        }

        // Runtime Preview is project-scoped (AV-005): it keeps showing
        // the active Scene through the real Engine V2 pipeline
        // regardless of which editor Working View shows instead.
        _drawSceneCanvas(runtimePreviewCanvas, activeScene, { guides: false, interactive: false });

        if (_workingViewIsIdentityCard()) {
            workingOverlays.innerHTML = '';
            _renderIdentityCard(workingCanvas.parentElement);
            workingCanvas.classList.add('wb-hidden');
        } else {
            workingCanvas.classList.remove('wb-hidden');
            workingCanvas.parentElement.classList.remove('wb-hidden');
            const stray = workingCanvas.parentElement.querySelector('.wb-preview-frame');
            if (stray) stray.remove();
            const strayInactive = workingCanvas.parentElement.parentElement.querySelector('.wb-inactive-state');
            if (strayInactive) strayInactive.remove();
        }

        _sampleArtworkImage(function (sampleImage) {
            const s = _buildPreviewSlide(sampleImage);
            if (!_workingViewIsIdentityCard()) {
                window.SlideRenderer.init(workingCanvas, { dpr: window.devicePixelRatio || 1 });
                window.SlideRenderer.render(s);
                _renderWorkingOverlays(s);
            }
        });

        _renderPreviewSelector();
    }

    // ---------- Scenes (Builder V2 — Blueprint §5, §6-§7; Vision §2-§4) ----------
    // Deliberately not routed through SlideRenderer: no Engine V2 render
    // pipeline exists yet for Scene/Canvas/Holder/Layer/Element (Engine
    // Canon's object model has no compiled-package or Runtime
    // counterpart in any frozen document). Working View and Runtime
    // Preview here are a small, self-contained canvas draw routine —
    // Canvas shape, Safe Area guide, and generic Holder placeholder
    // chrome only. This is a disclosed, temporary gap, not a silent
    // reuse of the Engine V1 renderer for a shape it knows nothing about.

    function _sceneHeaderTitleFor(scene) {
        return (currentProject.name || 'Untitled World') + ' › ' + scene.name;
    }

    function _renderSceneHeader() {
        const scene = (currentNav === 'scenes' && currentSceneId) ? window.ProjectModel.findScene(currentProject, currentSceneId) : null;
        if (!scene) {
            sceneHeaderEl.classList.add('wb-hidden');
            sceneHeaderEl.innerHTML = '';
            return;
        }
        sceneHeaderEl.classList.remove('wb-hidden');
        sceneHeaderEl.innerHTML = '';

        const crumb = document.createElement('div');
        crumb.className = 'wb-scene-breadcrumb';
        const worldStrong = document.createElement('strong');
        worldStrong.textContent = currentProject.name || 'Untitled World';
        crumb.appendChild(worldStrong);
        crumb.appendChild(document.createTextNode(' › ' + scene.name));

        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);
        const glance = document.createElement('button');
        glance.type = 'button';
        glance.className = 'wb-scene-config-glance' + (currentInspectorTarget === 'sceneConfig' ? ' active' : '');
        glance.title = 'Scene Configuration — select to edit Aspect Ratio';

        const chip1 = document.createElement('span');
        chip1.className = 'wb-scene-config-chip';
        chip1.textContent = aspect.icon + ' ' + aspect.label;
        const chip2 = document.createElement('span');
        chip2.className = 'wb-scene-config-chip';
        chip2.textContent = '📐 ' + scene.canvas.safeArea;
        const chip3 = document.createElement('span');
        chip3.className = 'wb-scene-config-chip';
        chip3.textContent = '📦 ' + aspect.width + ' × ' + aspect.height;
        glance.appendChild(chip1);
        glance.appendChild(chip2);
        glance.appendChild(chip3);

        glance.addEventListener('click', function () {
            currentInspectorTarget = 'sceneConfig';
            _renderWorkspace();
        });

        sceneHeaderEl.appendChild(crumb);
        sceneHeaderEl.appendChild(glance);
    }

    // ---------- Place activity (Builder V2 — Blueprint §8) ----------
    // Selection-driven, matching Blueprint §6.1 exactly: clicking a
    // Holder in Working View selects it, populates Context Inspector,
    // and switches the activity indicator to Place — regardless of
    // which activity was active a moment before.

    function _selectedHolderId() {
        if (currentInspectorTarget && currentInspectorTarget.indexOf('holder:') === 0) {
            return currentInspectorTarget.slice('holder:'.length);
        }
        return null;
    }

    // ---------- Decorations activity (Builder V2 — Blueprint §9) ----------
    // Same selection-driven pattern as Place (§6.1): clicking a
    // decoration in Working View selects it and switches the activity
    // indicator to Decorations.

    function _selectedLayerId() {
        if (currentInspectorTarget && currentInspectorTarget.indexOf('layer:') === 0) {
            return currentInspectorTarget.slice('layer:'.length);
        }
        return null;
    }

    const DECORATION_GLYPHS = ['🎀', '🌸', '⭐', '🍃', '🦋', '💫', '🌿', '❤️', '✨', '🎈'];

    // A generic fractional-rect hit test — works for a Holder or a Scene
    // Layer alike, since both carry the same {position:{x,y}, size:{w,h}}
    // shape.
    // AV-006 — a text Layer's editable footprint is its measured,
    // rendered line-wrap height (EngineV2Runtime.textFootprint), not its
    // declared position/size box, which only ever set the wrap width and
    // a creation-time placeholder height, disconnected from what actually
    // renders once real words are typed. Holders/Decorations are
    // unaffected — their rect literally is what gets drawn.
    function _effectiveObjectRect(obj, kind, canvasEl) {
        if (kind === 'layer' && obj.kind === 'text' && canvasEl) {
            const ctx = canvasEl.getContext('2d');
            return window.EngineV2Runtime.textFootprint(ctx, obj, { width: canvasEl.width, height: canvasEl.height });
        }
        return null;
    }

    function _pointInHolder(fx, fy, obj, kind, canvasEl) {
        const footprint = _effectiveObjectRect(obj, kind, canvasEl);
        if (footprint && canvasEl) {
            const fxPx = fx * canvasEl.width;
            const fyPx = fy * canvasEl.height;
            return fxPx >= footprint.x && fxPx <= footprint.x + footprint.w &&
                fyPx >= footprint.y && fyPx <= footprint.y + footprint.h;
        }
        return fx >= obj.position.x && fx <= obj.position.x + obj.size.w &&
            fy >= obj.position.y && fy <= obj.position.y + obj.size.h;
    }

    // The Scene Model's one cross-reference (Scene Model §2): a Holder's
    // `frame` id resolves to a Theme Asset (Frame) this Builder owns —
    // the native Runtime (`js/services/engineRuntime.js`) knows nothing
    // about Theme Asset storage, so this resolver is injected at every
    // call site instead.
    //
    // AV-003 — takes a Frame *id* (a string), matching exactly how
    // `EngineV2Runtime`'s `_paintHolder` already calls it
    // (`graph.resolveFrame(holder.frame)`). A previous version of this
    // function took a Holder object and read `.frame` off it — since a
    // string has no `.frame` property, that mismatch made this resolver
    // return null unconditionally, silently defaulting every Holder to
    // no-Frame chrome regardless of which Frame was actually picked.
    // This was the root cause of Frame changes never appearing in
    // either rendering surface.
    function _holderFrameFields(frameId) {
        if (!frameId) return null;
        const frame = window.ProjectModel.findFrame(currentProject, frameId);
        return frame ? (frame.fields || {}) : null;
    }

    // EV-002 — the World's own authored Hero Image is its representative
    // artwork; Thumbnail is the fallback when no Hero Image has been
    // uploaded yet (the ticket's own "prefer its original high-resolution
    // source rather than the exported thumbnail" instruction — Overview's
    // own Hero Image field already uploads to `preview.png`, a
    // higher-resolution source than the small `thumbnail.png` card
    // image). Deliberately reuses the World's own asset rather than
    // inventing a second "sample artwork" concept (the ticket's own
    // explicit instruction) — `_sampleArtworkImage` above is a wholly
    // separate, generic stand-in the legacy Engine V1 specimen path
    // uses and is untouched by this. Cached by data-URL so a change to
    // either asset (re-upload) is picked up on the very next redraw
    // without re-decoding an unchanged image every frame.
    let _repArtCache = { src: null, img: null };
    function _representativeArtworkImage(project, sceneId) {
        const src = window.ProjectModel.getAsset(project, 'preview.png') || window.ProjectModel.getAsset(project, 'thumbnail.png');
        if (!src) { _repArtCache = { src: null, img: null }; return null; }
        if (_repArtCache.src === src) return _repArtCache.img;
        _repArtCache = { src: src, img: null };
        const img = new Image();
        img.onload = function () {
            if (_repArtCache.src !== src) return; // superseded by a newer upload before this one finished loading
            _repArtCache.img = img;
            _redrawSceneCanvases(sceneId);
        };
        img.src = src;
        return null; // not decoded yet this frame — falls back to placeholder chrome until onload fires
    }

    // Draws the Scene's full Scene Stack through the native Engine V2
    // Runtime (Engine Canon §5 — Scene Layers and Holders together,
    // bottom to top; Canvas owns this order but is never itself a
    // member of it; LOCK V2-04 — Runtime, Validation, Build, and Publish
    // operate directly on this same canonical Scene Model, no
    // translation layer), then layers Builder-only authoring affordances
    // on top: in Working View only, a felt Safe Area guide (Blueprint
    // §7 — never a labeled numeric field, never a hard wall) and a
    // selection outline (+ resize handle, Holders only) for whichever
    // object is currently selected. Neither affordance is something
    // `EngineV2Runtime.render` itself ever draws — a published/reader
    // render has no editing surface (Engine Canon §5 step 5).
    function _drawSceneCanvas(canvasEl, scene, opts) {
        opts = opts || {};
        // Reconciles scene.stack in place before handing the Scene to
        // the Runtime — a Scene created before `stack` existed (or
        // missing an entry for a newly-added Holder/Layer) has no
        // persisted stack at all until this runs (js/projectModel.js's
        // `_ensureStack`). EngineV2Runtime.load is deliberately pure and
        // never reconciles or mutates on its own (Scene Model §5 —
        // reconciliation is Builder-only read-time convenience,
        // Validation only *reports* a Scene that needed it); this is the
        // one Builder-side call responsible for making that convenience
        // still true before every render.
        window.ProjectModel.sceneStack(currentProject, scene.id);
        const repImage = _representativeArtworkImage(currentProject, scene.id);
        const graph = window.EngineV2Runtime.load(scene, _holderFrameFields, repImage);
        canvasEl.width = graph.width;
        canvasEl.height = graph.height;
        // AV-001 — the Scene's own Aspect Ratio must drive the editing
        // surface's shape, not just the canvas's internal pixel buffer
        // (Engine Canon §4: Canvas geometry is determined by the
        // Scene's Aspect Ratio). `.wb-working-canvas-inner`/
        // `.wb-runtime-preview-canvas-inner` (this canvas's own parent)
        // carry a fixed `aspect-ratio: 1080/1350` in the stylesheet only
        // as a before-first-render fallback; every real draw overrides
        // it inline so a Landscape/Square/Quote Scene is actually
        // authored on a Landscape/Square/Quote-shaped surface, not a
        // portrait box with a stretched bitmap inside it.
        if (canvasEl.parentElement) {
            canvasEl.parentElement.style.aspectRatio = graph.width + ' / ' + graph.height;
        }
        const ctx = canvasEl.getContext('2d');

        window.EngineV2Runtime.render(ctx, graph);

        if (opts.interactive) {
            const selectedHolderId = _selectedHolderId();
            const selectedLayerId = _selectedLayerId();
            graph.stack.forEach(function (entry) {
                if (entry.type === 'holder' && entry.object.id === selectedHolderId) {
                    // AV-004 — construction guides first, selection
                    // outline drawn on top of them (so the outline stays
                    // the clearest, outermost line even when Frame bands
                    // are also shown).
                    _drawHolderConstructionGuides(ctx, entry.object, graph, canvasEl.width);
                    _drawSelectionOutline(ctx, window.EngineV2Runtime.rectFor(entry.object, graph), canvasEl.width, true);
                } else if (entry.type === 'layer' && entry.object.id === selectedLayerId) {
                    // AV-006 — a selected text Layer's outline traces its
                    // measured rendered footprint, not its declared
                    // position/size box, so the selection genuinely
                    // matches what the author sees (see
                    // _effectiveObjectRect).
                    const outlineRect = entry.object.kind === 'text'
                        ? window.EngineV2Runtime.textFootprint(ctx, entry.object, graph)
                        : window.EngineV2Runtime.rectFor(entry.object, graph);
                    _drawSelectionOutline(ctx, outlineRect, canvasEl.width, false);
                }
            });
        }

        if (opts.guides && graph.aspect.safeInset > 0) {
            const inset = graph.aspect.safeInset;
            const x = canvasEl.width * inset;
            const y = canvasEl.height * inset;
            const w = canvasEl.width * (1 - inset * 2);
            const hgt = canvasEl.height * (1 - inset * 2);
            ctx.save();
            ctx.strokeStyle = '#D9A441';
            ctx.setLineDash([canvasEl.width * 0.012, canvasEl.width * 0.008]);
            ctx.lineWidth = Math.max(2, canvasEl.width * 0.003);
            ctx.strokeRect(x, y, w, hgt);
            ctx.restore();
        }
    }

    // AV-004 — Working View's own construction affordance for a
    // selected Holder: felt guide lines at the real Frame-band
    // boundaries (Wall → Frame → Mat → Artwork), read from
    // `EngineV2Runtime.holderBands` — the same geometry the Runtime just
    // painted, never re-derived independently, so a guide can never
    // drift from what's actually there. Builder-only: never drawn into
    // Runtime Preview (only called from the `opts.interactive` branch,
    // Working View's own), never serialized, never affects the Scene
    // Model, Build, or Publish. Runtime Preview stays the stable,
    // guide-free "what the reader gets" verification window (Vision's
    // own "never shows a guide" rule for that surface, unchanged);
    // Working View is where construction detail belongs.
    function _drawHolderConstructionGuides(ctx, holder, graph, canvasWidth) {
        const bands = window.EngineV2Runtime.holderBands(holder, graph);
        const candidates = [
            { rect: bands.border, label: 'Wall → Frame', show: bands.hasWall },
            { rect: bands.mat, label: bands.hasMat ? 'Frame → Mat' : 'Frame → Artwork', show: bands.hasFrame },
            { rect: bands.content, label: 'Artwork', show: bands.hasMat || bands.hasPadding }
        ];
        ctx.save();
        ctx.strokeStyle = 'rgba(29,52,87,0.5)';
        ctx.lineWidth = Math.max(1, canvasWidth * 0.0012);
        ctx.setLineDash([canvasWidth * 0.006, canvasWidth * 0.004]);
        ctx.font = Math.max(9, Math.round(canvasWidth * 0.011)) + 'px sans-serif';
        ctx.fillStyle = 'rgba(29,52,87,0.8)';
        ctx.textBaseline = 'bottom';
        let lastKey = null;
        candidates.forEach(function (c) {
            if (!c.show) return;
            const key = Math.round(c.rect.x) + ':' + Math.round(c.rect.w);
            if (key === lastKey) return; // two bands with identical bounds (e.g. Mat width 0) draw one line, not two
            lastKey = key;
            ctx.strokeRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
            ctx.fillText(c.label.toUpperCase(), c.rect.x + 4, Math.max(10, c.rect.y - 4));
        });
        ctx.restore();
    }

    // Builder-only selection chrome — a dashed outline, plus a
    // bottom-right resize handle for Holders only (Decorations/Text
    // reposition but never resize via a handle, Blueprint §9/§10).
    function _drawSelectionOutline(ctx, rect, canvasWidth, withResizeHandle) {
        ctx.save();
        ctx.strokeStyle = '#1D3457';
        ctx.setLineDash([canvasWidth * (withResizeHandle ? 0.01 : 0.008), canvasWidth * (withResizeHandle ? 0.006 : 0.005)]);
        ctx.lineWidth = Math.max(2, canvasWidth * (withResizeHandle ? 0.0025 : 0.002));
        ctx.strokeRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8);
        ctx.restore();
        if (withResizeHandle) {
            const handleR = Math.max(10, canvasWidth * 0.014);
            ctx.save();
            ctx.fillStyle = '#1D3457';
            ctx.beginPath();
            ctx.arc(rect.x + rect.w, rect.y + rect.h, handleR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function _redrawSceneCanvases(sceneId) {
        if (currentSceneId !== sceneId) return;
        const scene = window.ProjectModel.findScene(currentProject, sceneId);
        if (!scene) return;
        // AV-005 — Runtime Preview redraws whenever the active Scene's
        // data changes, regardless of currentNav, since it is
        // project-scoped rather than editor-scoped (unlike Working View,
        // which only shows the Scene editor while Scenes nav is open).
        _drawSceneCanvas(runtimePreviewCanvas, scene, { guides: false, interactive: false });
        if (currentNav === 'scenes') {
            _drawSceneCanvas(workingCanvas, scene, { guides: true, interactive: true });
        }
    }

    function _renderScenesWorkingView() {
        const strayFrame = workingCanvas.parentElement.querySelector('.wb-preview-frame');
        if (strayFrame) strayFrame.remove();
        workingCanvas.parentElement.classList.remove('wb-hidden');
        const strayInactive = workingCanvas.parentElement.parentElement.querySelector('.wb-inactive-state');
        if (strayInactive) strayInactive.remove();

        if (!currentSceneId) {
            workingCanvas.classList.add('wb-hidden');
            workingOverlays.innerHTML = '';
            _renderSceneLibrary(workingCanvas.parentElement);
            _renderRuntimePreviewEmpty('Select a Scene, or add one, to preview it here.');
            previewSelector.innerHTML = '';
            return;
        }

        _removeSceneLibrary(workingCanvas.parentElement);
        const scene = window.ProjectModel.findScene(currentProject, currentSceneId);
        if (!scene) { currentSceneId = null; return _renderScenesWorkingView(); }

        workingCanvas.classList.remove('wb-hidden');
        workingOverlays.innerHTML = '';
        _drawSceneCanvas(workingCanvas, scene, { guides: true, interactive: true });
        _drawSceneCanvas(runtimePreviewCanvas, scene, { guides: false, interactive: false });
        _renderActivitySwitcher();
    }

    // Click-to-select + drag-to-move + drag-to-resize, wired once at
    // module init (never re-bound per render) — state is read live from
    // the module's own currentNav/currentSceneId/currentActivity at
    // event time, matching Blueprint §6.1's "selection drives the
    // slice" rule: hitting a Holder always selects it and switches to
    // Place, regardless of which activity was showing a moment before.
    let _holderDragState = null;

    function _canvasFraction(canvasEl, evt) {
        const rect = canvasEl.getBoundingClientRect();
        return {
            fx: (evt.clientX - rect.left) / rect.width,
            fy: (evt.clientY - rect.top) / rect.height
        };
    }

    function _findByKind(sceneId, kind, id) {
        return kind === 'holder'
            ? window.ProjectModel.findHolder(currentProject, sceneId, id)
            : window.ProjectModel.findSceneLayer(currentProject, sceneId, id);
    }

    workingCanvas.addEventListener('mousedown', function (e) {
        if (currentNav !== 'scenes' || !currentSceneId) return;
        const scene = window.ProjectModel.findScene(currentProject, currentSceneId);
        if (!scene) return;
        const pt = _canvasFraction(workingCanvas, e);

        // Resize handle — Holders only (Blueprint §9 gives Decorations
        // "reposition" and "bring forward/send backward," never resize).
        if (currentActivity === 'place') {
            const selectedId = _selectedHolderId();
            const selectedHolder = selectedId ? window.ProjectModel.findHolder(currentProject, scene.id, selectedId) : null;
            if (selectedHolder) {
                const hx = selectedHolder.position.x + selectedHolder.size.w;
                const hy = selectedHolder.position.y + selectedHolder.size.h;
                if (Math.abs(pt.fx - hx) < 0.03 && Math.abs(pt.fy - hy) < 0.03) {
                    _holderDragState = {
                        mode: 'resize', kind: 'holder', sceneId: scene.id, id: selectedHolder.id,
                        startFX: pt.fx, startFY: pt.fy, startW: selectedHolder.size.w, startH: selectedHolder.size.h
                    };
                    e.preventDefault();
                    return;
                }
            }
        }

        // Hit-test the whole Scene Stack, topmost first (Blueprint §6.1
        // — selection drives the activity, not the other way around).
        // A full-bleed Background fill is deliberately excluded — it is
        // an edit made through the Decorations colour picker, never a
        // clickable object in its own right (Blueprint §9's own "set
        // the background" phrasing, not "select the background").
        const stack = window.ProjectModel.sceneStack(currentProject, scene.id);
        let hit = null;
        for (let i = stack.length - 1; i >= 0; i--) {
            const entry = stack[i];
            const obj = _findByKind(scene.id, entry.type, entry.id);
            if (!obj) continue;
            if (entry.type === 'layer' && obj.kind === 'fill') continue;
            if (_pointInHolder(pt.fx, pt.fy, obj, entry.type, workingCanvas)) { hit = { kind: entry.type, obj: obj }; break; }
        }

        if (hit) {
            currentActivity = hit.kind === 'holder' ? 'place' : (hit.obj.kind === 'text' ? 'text' : 'decorations');
            currentInspectorTarget = (hit.kind === 'holder' ? 'holder:' : 'layer:') + hit.obj.id;
            _holderDragState = {
                mode: 'move', kind: hit.kind, sceneId: scene.id, id: hit.obj.id,
                startFX: pt.fx, startFY: pt.fy, startX: hit.obj.position.x, startY: hit.obj.position.y
            };
            _renderWorkspace();
            e.preventDefault();
        } else if (currentInspectorTarget !== 'sceneConfig') {
            // AV-002 — the empty Canvas is the Scene's own natural hit
            // target: hitting nothing (no Holder, Decoration, or Text
            // underneath the click) selects the Scene itself, exactly
            // the way clicking an object selects that object (Blueprint
            // §6.1's rule extended to the one remaining selectable
            // object in the Engine hierarchy, Scene → Place/Decorations/
            // Text). This replaces the old behaviour of merely clearing
            // whatever was selected back to nothing — Working View never
            // has to leave selection empty, since Scene Configuration is
            // itself a real Context Inspector state (Vision §2) and
            // never a fourth Working View activity.
            currentInspectorTarget = 'sceneConfig';
            _renderWorkspace();
        }
    });

    window.addEventListener('mousemove', function (e) {
        if (!_holderDragState) return;
        const pt = _canvasFraction(workingCanvas, e);
        const dx = pt.fx - _holderDragState.startFX;
        const dy = pt.fy - _holderDragState.startFY;
        const obj = _findByKind(_holderDragState.sceneId, _holderDragState.kind, _holderDragState.id);
        if (!obj) return;
        if (_holderDragState.mode === 'move') {
            // AV-006 — clamp a text Layer against its measured rendered
            // footprint, not its declared size.h, which is only ever a
            // wrap-width + creation-time placeholder disconnected from
            // what actually renders (see _effectiveObjectRect above).
            let clampH = obj.size.h;
            if (_holderDragState.kind === 'layer' && obj.kind === 'text') {
                const footprint = _effectiveObjectRect(obj, 'layer', workingCanvas);
                if (footprint) clampH = footprint.h / workingCanvas.height;
            }
            obj.position.x = Math.min(1 - obj.size.w, Math.max(0, _holderDragState.startX + dx));
            obj.position.y = Math.min(1 - clampH, Math.max(0, _holderDragState.startY + dy));
        } else {
            obj.size.w = Math.min(1 - obj.position.x, Math.max(0.06, _holderDragState.startW + dx));
            obj.size.h = Math.min(1 - obj.position.y, Math.max(0.06, _holderDragState.startH + dy));
        }
        _redrawSceneCanvases(_holderDragState.sceneId);
    });

    window.addEventListener('mouseup', function () {
        if (!_holderDragState) return;
        const sceneId = _holderDragState.sceneId;
        _holderDragState = null;
        _persist();
        // Refresh the Inspector's numeric fields to match the drag
        // result — via the shared dispatcher (_renderContextPanel), not
        // the Scenes-specific renderer directly, since only the
        // dispatcher clears contextPanel first.
        if (currentNav === 'scenes' && currentSceneId === sceneId) _renderContextPanel();
    });

    function _renderRuntimePreviewEmpty(message) {
        const ctx = runtimePreviewCanvas.getContext('2d');
        runtimePreviewCanvas.width = 1080;
        runtimePreviewCanvas.height = 1350;
        ctx.fillStyle = '#F4F1EC';
        ctx.fillRect(0, 0, runtimePreviewCanvas.width, runtimePreviewCanvas.height);
        ctx.fillStyle = '#8B7355';
        ctx.font = '44px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        _wrapText(ctx, message, runtimePreviewCanvas.width / 2, runtimePreviewCanvas.height / 2, 800, 56);
    }

    function _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        words.forEach(function (word) {
            const test = line + word + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word + ' ';
            } else {
                line = test;
            }
        });
        lines.push(line);
        const startY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach(function (l, i) { ctx.fillText(l.trim(), x, startY + i * lineHeight); });
    }

    function _renderActivitySwitcher() {
        if (!currentSceneId) return;
        const wrap = document.createElement('div');
        wrap.className = 'wb-activity-switcher';
        ACTIVITIES.forEach(function (a) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-activity-item' + (currentActivity === a.id && currentInspectorTarget !== 'sceneConfig' ? ' active' : '');
            btn.textContent = a.icon + ' ' + a.label;
            btn.addEventListener('click', function () {
                currentActivity = a.id;
                currentInspectorTarget = a.id;
                _renderWorkspace();
            });
            wrap.appendChild(btn);
        });
        previewSelector.innerHTML = '';
        previewSelector.appendChild(wrap);
    }

    // ---------- Scenes Library (Blueprint §5) ----------

    function _renderSceneLibrary(target) {
        let lib = target.querySelector('.wb-scene-library');
        if (!lib) {
            lib = document.createElement('div');
            lib.className = 'wb-scene-library';
            target.appendChild(lib);
        }
        lib.innerHTML = '';

        if (scenesShowingTemplatePicker) {
            lib.appendChild(_sceneTemplatePicker());
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'wb-scene-library-grid';
        window.ProjectModel.scenes(currentProject).forEach(function (scene) {
            grid.appendChild(_sceneCard(scene));
        });
        grid.appendChild(_sceneAddCard());
        lib.appendChild(grid);
    }

    function _removeSceneLibrary(target) {
        const lib = target.querySelector('.wb-scene-library');
        if (lib) lib.remove();
    }

    function _smallBtn(label, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    function _openScene(sceneId) {
        currentSceneId = sceneId;
        currentActivity = 'place';
        // AV-002 — a Scene is a first-class selectable object in the
        // Engine hierarchy (Scene → Place/Decorations/Text), so opening
        // one (whether just created or reopened from the Library)
        // selects the Scene itself first, exactly like clicking it in
        // Working View does (see the mousedown handler's "no hit"
        // branch below) — never a Holder, which used to be the
        // effective default the moment Place's own Holder-list panel
        // rendered. Configuring the Scene's own shape is the first
        // authoring action, not editing a Holder.
        currentInspectorTarget = 'sceneConfig';
        _renderWorkspace();
    }

    // Blueprint §5 — "each [Scene] shown live... by a live-updating
    // thumbnail of its actual composition." Reuses `_drawSceneCanvas`
    // directly at native resolution (no guides, no selection state,
    // since the Library isn't an editing surface) — the same real
    // Scene Stack render the Scene Editor uses, never a second,
    // Library-owned drawing routine.
    function _sceneCardThumb(scene) {
        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);
        const wrap = document.createElement('div');
        wrap.className = 'wb-scene-card-thumb';
        wrap.style.aspectRatio = aspect.width + ' / ' + aspect.height;
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        wrap.appendChild(canvas);
        _drawSceneCanvas(canvas, scene, { guides: false, interactive: false });
        return wrap;
    }

    function _sceneCard(scene) {
        const card = document.createElement('div');
        card.className = 'wb-scene-card' + (scene.id === currentSceneId ? ' active' : '');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);

        const name = document.createElement('div');
        name.className = 'wb-scene-card-name';
        name.textContent = scene.name;

        const sub = document.createElement('div');
        sub.className = 'wb-scene-card-sub';
        sub.textContent = aspect.label + (scene.holders.length ? ' · ' + scene.holders.length + ' Holder' + (scene.holders.length > 1 ? 's' : '') : ' · No Holder');

        // Reorder — Blueprint §5's own "Rename, duplicate, delete,
        // reorder a Scene," reusing ProjectModel.moveScene the same way
        // Frame rows already reuse moveFrame.
        const reorderRow = document.createElement('div');
        reorderRow.className = 'wb-row-controls';
        reorderRow.appendChild(_smallBtn('↑', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveScene(currentProject, scene.id, 'up');
            _persist();
            _renderWorkspace();
        }));
        reorderRow.appendChild(_smallBtn('↓', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveScene(currentProject, scene.id, 'down');
            _persist();
            _renderWorkspace();
        }));

        const controls = document.createElement('div');
        controls.className = 'wb-scene-card-controls';
        controls.appendChild(_smallBtn('Rename', function (e) {
            e.stopPropagation();
            const next = window.prompt('Rename Scene', scene.name);
            if (next && next.trim()) {
                window.ProjectModel.renameScene(currentProject, scene.id, next.trim());
                _persist();
                _renderWorkspace();
            }
        }));
        controls.appendChild(_smallBtn('Duplicate', function (e) {
            e.stopPropagation();
            const copy = window.ProjectModel.duplicateScene(currentProject, scene.id);
            if (copy) { _persist(); _renderWorkspace(); }
        }));
        controls.appendChild(_smallBtn('Delete', function (e) {
            e.stopPropagation();
            if (!window.confirm('Delete "' + scene.name + '"? This cannot be undone.')) return;
            window.ProjectModel.deleteScene(currentProject, scene.id);
            if (currentSceneId === scene.id) currentSceneId = null;
            _persist();
            _renderWorkspace();
        }));

        card.appendChild(_sceneCardThumb(scene));
        card.appendChild(name);
        card.appendChild(sub);
        card.appendChild(reorderRow);
        card.appendChild(controls);

        card.addEventListener('click', function () { _openScene(scene.id); });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _openScene(scene.id); }
        });
        return card;
    }

    function _sceneAddCard() {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-scene-card-add';
        const icon = document.createElement('span');
        icon.className = 'wb-scene-card-add-icon';
        icon.textContent = '➕';
        const label = document.createElement('span');
        label.textContent = 'Add a Scene';
        card.appendChild(icon);
        card.appendChild(label);
        card.addEventListener('click', function () {
            scenesShowingTemplatePicker = true;
            _renderWorkspace();
        });
        return card;
    }

    // Engine Scene Template picker (Engine Canon §10 — a new Scene never
    // starts from a blank Canvas, Invariant 4).
    function _sceneTemplatePicker() {
        const wrap = document.createElement('div');

        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'wb-selector-chip';
        back.style.marginBottom = '12px';
        back.textContent = '← Back to Scenes';
        back.addEventListener('click', function () {
            scenesShowingTemplatePicker = false;
            _renderWorkspace();
        });
        wrap.appendChild(back);

        const grid = document.createElement('div');
        grid.className = 'wb-scene-template-grid';
        window.EngineSchema.SCENE_TEMPLATES.forEach(function (t) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-scene-template-card';

            const icon = document.createElement('div');
            icon.className = 'wb-scene-template-icon';
            icon.textContent = t.icon;
            const name = document.createElement('div');
            name.className = 'wb-scene-template-name';
            name.textContent = t.name;
            const desc = document.createElement('div');
            desc.className = 'wb-scene-template-desc';
            desc.textContent = t.description;

            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(desc);
            card.addEventListener('click', function () {
                const scene = window.ProjectModel.addScene(currentProject, t.id);
                scenesShowingTemplatePicker = false;
                _persist();
                _openScene(scene.id);
            });
            grid.appendChild(card);
        });
        wrap.appendChild(grid);
        return wrap;
    }

    // ---------- Working View guide overlays (Layouts only, Sprint B2.0.3) ----------
    // Builder-only annotations drawn in DOM on top of the Working View
    // canvas, positioned as percentages of SlideRenderer's own logical
    // 1080×1350 coordinate space (via getPanelRect/getCaptionRect) so
    // they track the real render exactly without duplicating its
    // geometry math. Never drawn onto the canvas pixels themselves, so
    // Runtime Preview — the same render, no overlay pass — never shows
    // them.
    function _guideBox(cls, label, rectPct, labelAtBottom) {
        const box = document.createElement('div');
        box.className = 'wb-guide-box ' + cls;
        box.style.left = rectPct.x + '%';
        box.style.top = rectPct.y + '%';
        box.style.width = rectPct.w + '%';
        box.style.height = rectPct.h + '%';
        if (label) {
            const lbl = document.createElement('span');
            lbl.className = 'wb-guide-label' + (labelAtBottom ? ' wb-guide-label-bottom' : '');
            lbl.textContent = label;
            box.appendChild(lbl);
        }
        return box;
    }

    function _toPct(rect, canvasSize) {
        return {
            x: (rect.x / canvasSize.w) * 100,
            y: (rect.y / canvasSize.h) * 100,
            w: (rect.w / canvasSize.w) * 100,
            h: (rect.h / canvasSize.h) * 100
        };
    }

    function _renderWorkingOverlays(s) {
        workingOverlays.innerHTML = '';
        if (currentNav !== 'layouts') return;

        const layout = window.ProjectModel.findLayout(currentProject, currentLayoutId);
        if (!layout) return;

        const canvasSize = window.SlideRenderer.getCanvasSize();
        const isQuote = layout.composition === 'quote';
        const panelRect = window.SlideRenderer.getPanelRect(s);
        const panelPct = _toPct(panelRect, canvasSize);

        // Safe margins — a fixed illustrative inset from the page edge,
        // always shown so a creator can judge how close a Frame sits to
        // the edge of the page.
        workingOverlays.appendChild(_guideBox('wb-guide-margin', 'Safe Margin', _toPct(
            { x: 40, y: 40, w: canvasSize.w - 80, h: canvasSize.h - 80 }, canvasSize
        )));

        // Holder Boundary — the actual resolved Frame/picture rect for
        // this Layout (Quote has none; the panel rect there is the
        // centered text area instead).
        workingOverlays.appendChild(_guideBox('wb-guide-holder', isQuote ? 'Quote Text Area' : 'Holder Boundary', panelPct));

        // Padding guide — an inset within the Holder Boundary sized from
        // the Layout's own Padding field, so dragging Padding visibly
        // shrinks/grows this inner box immediately. Labeled at the
        // bottom corner (not top, like Holder Boundary) since the two
        // boxes nest almost exactly on top of each other.
        if (!isQuote) {
            const pad = Math.max(0, Math.min(layout.padding || 0, Math.min(panelRect.w, panelRect.h) / 2 - 4));
            workingOverlays.appendChild(_guideBox('wb-guide-padding', 'Padding', _toPct({
                x: panelRect.x + pad, y: panelRect.y + pad,
                w: Math.max(1, panelRect.w - pad * 2), h: Math.max(1, panelRect.h - pad * 2)
            }, canvasSize), true));
        }

        // Caption area — for "Right" composition this is the real,
        // distinct rect SlideRenderer.getCaptionRect resolves (beside
        // the Frame). For "Below" (the default) the real contract has
        // no independent caption rect at all — a Layer Pack caption
        // there is anchored per-layer, not to a fixed area — so this is
        // a Builder-only illustrative band placed just under the Holder,
        // honestly labeled as an approximation rather than reusing the
        // real API to imply a precision that isn't there.
        if (!isQuote) {
            let captionRect, captionLabel;
            if (layout.composition === 'right') {
                captionRect = window.SlideRenderer.getCaptionRect(s);
                captionLabel = 'Caption Boundary';
            } else {
                captionRect = {
                    x: panelRect.x, w: panelRect.w, h: 100,
                    y: Math.min(panelRect.y + panelRect.h + 24, canvasSize.h - 130)
                };
                captionLabel = 'Caption Area (approx.)';
            }
            if (captionRect) workingOverlays.appendChild(_guideBox('wb-guide-caption', captionLabel, _toPct(captionRect, canvasSize)));

            // Alignment guide — a vertical line inside the Caption area
            // at the Layout's own Alignment value, and a sample caption
            // placeholder positioned per Caption Position, so both
            // fields visibly move something in the Working View even
            // though the real Runtime contract has no per-position
            // caption concept yet (see AUTHORING_FINDINGS.md).
            if (captionRect) {
                const align = layout.alignment || 'center';
                const alignX = align === 'left' ? captionRect.x + 6
                    : align === 'right' ? captionRect.x + captionRect.w - 6
                        : captionRect.x + captionRect.w / 2;
                const lineEl = document.createElement('div');
                lineEl.className = 'wb-guide-align-line';
                lineEl.style.left = (alignX / canvasSize.w * 100) + '%';
                lineEl.style.top = _toPct(captionRect, canvasSize).y + '%';
                lineEl.style.height = _toPct(captionRect, canvasSize).h + '%';
                workingOverlays.appendChild(lineEl);

                const captionPosition = layout.captionPosition || 'below';
                if (captionPosition !== 'none') {
                    const sample = document.createElement('div');
                    sample.className = 'wb-guide-sample-caption';
                    sample.textContent = '“' + SAMPLE_METADATA.caption + '”';
                    let sx = panelPct.x, sy = panelPct.y + panelPct.h + 1;
                    if (captionPosition === 'right') { sx = panelPct.x + panelPct.w + 2; sy = panelPct.y + panelPct.h / 2 - 3; }
                    else if (captionPosition === 'overlay') { sx = panelPct.x + 4; sy = panelPct.y + panelPct.h - 12; }
                    sample.style.left = Math.max(0, Math.min(sx, 96)) + '%';
                    sample.style.top = Math.max(0, Math.min(sy, 96)) + '%';
                    workingOverlays.appendChild(sample);
                }
            }
        }
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
        if (currentNav === 'scenes') return _renderScenesContextPanel();
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

    // ---------- Scenes — Context Inspector (Blueprint §5-§10; Vision §2-§3) ----------

    function _renderScenesContextPanel() {
        if (!currentSceneId) {
            _heading('Scenes', 'The pages of this World — recognizable at a glance, never by an internal id.');
            _stateIntro('scenes');
            if (scenesShowingTemplatePicker) {
                contextPanel.appendChild(_fieldHelp('Choose a Scene Template to start from — every Scene begins from one, never a blank Canvas.'));
            } else if (!window.ProjectModel.scenes(currentProject).length) {
                contextPanel.appendChild(_fieldHelp('This World has no Scenes yet. Press "Add a Scene" in Working View to add its first page.'));
            } else {
                contextPanel.appendChild(_fieldHelp('Select a Scene to open its editor, or press "Add a Scene" to add another.'));
            }
            return;
        }

        const scene = window.ProjectModel.findScene(currentProject, currentSceneId);
        if (!scene) return;

        if (currentInspectorTarget === 'sceneConfig') {
            return _renderSceneConfigPanel(scene);
        }

        const selectedHolderId = _selectedHolderId();
        if (selectedHolderId) {
            const holder = window.ProjectModel.findHolder(currentProject, scene.id, selectedHolderId);
            if (holder) return _renderHolderPanel(scene, holder);
            currentInspectorTarget = null; // stale reference (e.g. Holder was just deleted)
        }

        const selectedLayerId = _selectedLayerId();
        if (selectedLayerId) {
            const layer = window.ProjectModel.findSceneLayer(currentProject, scene.id, selectedLayerId);
            if (layer) return layer.kind === 'text' ? _renderTextLayerPanel(scene, layer) : _renderLayerPanel(scene, layer);
            currentInspectorTarget = null; // stale reference (e.g. the Element was just deleted)
        }

        if (currentActivity === 'place') {
            return _renderPlacePanel(scene);
        }

        if (currentActivity === 'decorations') {
            return _renderDecorationsPanel(scene);
        }

        return _renderTextPanel(scene);
    }

    // ---------- Place — no Holder selected: the Holder list + Add (Blueprint §8) ----------

    function _renderPlacePanel(scene) {
        _heading('Place', 'Where does the photo go, how big, what shape, and how is it framed?', ICONS.place);
        contextPanel.appendChild(_stateIntroText('Click a Holder in Working View to select it (drag to move, drag its corner handle to resize), or add a new one below. Add as many Holders as this Scene needs.'));

        if (scene.holders.length) {
            const list = document.createElement('div');
            list.className = 'wb-scene-library-grid';
            scene.holders.forEach(function (h) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'wb-scene-template-card';
                const name = document.createElement('div');
                name.className = 'wb-scene-template-name';
                name.textContent = h.name;
                const desc = document.createElement('div');
                desc.className = 'wb-scene-template-desc';
                desc.textContent = Math.round(h.size.w * 100) + '% × ' + Math.round(h.size.h * 100) + '%';
                card.appendChild(name);
                card.appendChild(desc);
                card.addEventListener('click', function () {
                    currentInspectorTarget = 'holder:' + h.id;
                    _renderWorkspace();
                });
                list.appendChild(card);
            });
            contextPanel.appendChild(list);
        } else {
            contextPanel.appendChild(_fieldHelp('This Scene has no Holders yet — add one below.'));
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
        addBtn.style.marginTop = '12px';
        addBtn.textContent = '➕ Add a Holder';
        addBtn.addEventListener('click', function () {
            const holder = window.ProjectModel.addHolder(currentProject, scene.id);
            if (holder) {
                currentInspectorTarget = 'holder:' + holder.id;
                _persist();
                _renderWorkspace();
            }
        });
        contextPanel.appendChild(addBtn);
    }

    function _stateIntroText(text) {
        const p = document.createElement('p');
        p.className = 'wb-field-help';
        p.textContent = text;
        return p;
    }

    // ---------- Place — a Holder is selected: its full property panel ----------

    function _renderHolderPanel(scene, holder) {
        _heading('Place — ' + holder.name, 'Position, size, shape, padding, fit, and Frame for this photo — plus what a Story Author is allowed to do with it.', ICONS.place);

        contextPanel.appendChild(_buildFieldGroup('Holder Name', _textInput(holder.name, function (v) {
            window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { name: v });
            _persist();
        })));

        const xGroup = _buildFieldGroup('Position X %', _range(0, 100, Math.round(holder.position.x * 100), function (v) {
            holder.position.x = Math.min(1 - holder.size.w, Math.max(0, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const yGroup = _buildFieldGroup('Position Y %', _range(0, 100, Math.round(holder.position.y * 100), function (v) {
            holder.position.y = Math.min(1 - holder.size.h, Math.max(0, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(xGroup, yGroup);

        const wGroup = _buildFieldGroup('Width %', _range(6, 100, Math.round(holder.size.w * 100), function (v) {
            holder.size.w = Math.min(1 - holder.position.x, Math.max(0.06, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const hGroup = _buildFieldGroup('Height %', _range(6, 100, Math.round(holder.size.h * 100), function (v) {
            holder.size.h = Math.min(1 - holder.position.y, Math.max(0.06, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(wGroup, hGroup);

        const shapeGroup = _buildFieldGroup('Shape', _select(window.EngineSchema.HOLDER_SHAPES, holder.shape, function (v) {
            window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { shape: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const fitGroup = _buildFieldGroup('Fit', _select(window.EngineSchema.HOLDER_FITS, holder.fit, function (v) {
            window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { fit: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(shapeGroup, fitGroup);

        // AV-003 — Fit and Padding persisted correctly but never
        // triggered a redraw (unlike every other Holder field above and
        // below them), so neither view ever reflected the new value
        // until some unrelated edit happened to redraw the canvas. Both
        // now redraw immediately, matching every other presentation
        // property. Padding's own live visual effect (an inset between
        // the Holder's edge and its content, Engine Canon §6) also
        // wasn't implemented in the Runtime's paint routine — fixed
        // alongside in js/services/engineRuntime.js's `_paintHolder`.
        _fieldGroup('Padding', _range(0, 40, holder.padding, function (v) {
            window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { padding: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }), 'Inset between the Holder’s edge and its content.');

        _renderFramePicker(scene, holder);
        _renderHolderPermissionBlock(scene, holder);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wb-workspace-btn';
        removeBtn.style.marginTop = '14px';
        removeBtn.textContent = '🗑 Remove this Holder';
        removeBtn.addEventListener('click', function () {
            if (!window.confirm('Remove "' + holder.name + '"? This cannot be undone.')) return;
            window.ProjectModel.deleteHolder(currentProject, scene.id, holder.id);
            currentInspectorTarget = null;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(removeBtn);

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'wb-workspace-btn';
        backBtn.style.marginTop = '8px';
        backBtn.textContent = '← All Holders';
        backBtn.addEventListener('click', function () {
            currentInspectorTarget = null;
            _renderWorkspace();
        });
        contextPanel.appendChild(backBtn);
    }

    // Frame editing lives in Place, not Decorations — confirmed by
    // Engine Canon §9's own rule that a Frame Element is placed inside a
    // Holder Layer (Blueprint §8). The overlay is scoped to Frames only
    // (§6.3); "Manage Frames" bridges to the full Frames screen,
    // reintroduced here as a reachable link rather than a Global
    // Navigation peer (Vision §1). Named "Manage Frames," not "Manage
    // Theme Assets," to avoid colliding with World's own "Manage Theme
    // Assets" link (§_renderOverviewPanel), which goes to a different
    // screen (Assets — uploads/textures) — Blueprint §11's eventual
    // one-shelf consolidation of Frames/Decorations/Textures/Fonts/
    // Icons/Patterns hasn't happened yet (see docs/BUILDER_V2_ENGINE_GAP.md
    // for why the related Build/Validate/Publish work is blocked;
    // this specific consolidation isn't blocked by that gap, just not
    // yet done).
    function _renderFramePicker(scene, holder) {
        const wrap = document.createElement('div');
        wrap.className = 'wb-field-group';
        const label = document.createElement('label');
        label.className = 'wb-field-label';
        label.textContent = 'Frame';
        wrap.appendChild(label);

        const frames = window.ProjectModel.frames(currentProject);
        const currentFrame = holder.frame ? window.ProjectModel.findFrame(currentProject, holder.frame) : null;
        wrap.appendChild(_fieldHelp(currentFrame ? ('Current: ' + currentFrame.name) : 'No Frame chosen yet — Border/Shadow/Mat come from whichever Frame is picked.'));

        const grid = document.createElement('div');
        grid.className = 'wb-scene-template-grid';
        grid.appendChild(_frameOptionCard('✕ None', null, !holder.frame, function () { _setHolderFrame(scene, holder, null); }));
        frames.forEach(function (f) {
            grid.appendChild(_frameOptionCard(f.name, (f.fields && f.fields.borderColor) || null, holder.frame === f.id, function () { _setHolderFrame(scene, holder, f.id); }));
        });
        wrap.appendChild(grid);

        const manageLink = document.createElement('button');
        manageLink.type = 'button';
        manageLink.className = 'wb-workspace-btn';
        manageLink.style.marginTop = '8px';
        manageLink.textContent = '🖌️ Manage Frames →';
        manageLink.addEventListener('click', function () {
            currentNav = 'frames';
            _renderNav();
            _renderWorkspace();
        });
        wrap.appendChild(manageLink);

        contextPanel.appendChild(wrap);
    }

    function _frameOptionCard(name, swatchColor, active, onClick) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-scene-template-card' + (active ? ' active' : '');
        if (swatchColor) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '18px';
            swatch.style.borderRadius = '4px';
            swatch.style.background = swatchColor;
            card.appendChild(swatch);
        }
        const nameEl = document.createElement('div');
        nameEl.className = 'wb-scene-template-name';
        nameEl.textContent = name;
        card.appendChild(nameEl);
        card.addEventListener('click', onClick);
        return card;
    }

    function _setHolderFrame(scene, holder, frameId) {
        window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { frame: frameId });
        _persist();
        _redrawSceneCanvases(scene.id);
        _renderContextPanel();
    }

    // The Holder variant of the shared Story-Author-permission block
    // (Blueprint §6.2) — skips "can the Story Author populate this"
    // (that's not a permission, it's the Holder's entire reason for
    // existing, Engine Invariant 10) and asks only what happens after.
    // Collapsed by default (UX Package Part 6's adopted refinement),
    // reusing the same `<details>` mechanics as every state's guidance.
    function _renderHolderPermissionBlock(scene, holder) {
        const details = document.createElement('details');
        details.className = 'wb-state-intro';
        const summary = document.createElement('summary');
        summary.className = 'wb-state-intro-summary';
        const isOpen = holder.permissions.moveable || holder.permissions.editable;
        summary.textContent = (isOpen ? '🔓 Story Author may adjust this' : '🔒 Locked for Story Authors') + '  [Change]';
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'wb-state-intro-body';
        body.appendChild(_permissionCheckbox('Can a Story Author move this?', holder.permissions.moveable, function (v) {
            holder.permissions.moveable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Can a Story Author change this? (its Frame, once populated)', holder.permissions.editable, function (v) {
            holder.permissions.editable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Should a Story Author see this at all?', holder.permissions.visible, function (v) {
            holder.permissions.visible = v;
            _persist();
        }));
        details.appendChild(body);
        contextPanel.appendChild(details);
    }

    function _permissionCheckbox(labelText, checked, onChange) {
        const row = document.createElement('label');
        row.className = 'wb-permission-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.addEventListener('change', function () { onChange(input.checked); });
        row.appendChild(input);
        row.appendChild(document.createTextNode(labelText));
        return row;
    }

    // ---------- Decorations — no decoration selected: background + list + add (Blueprint §9) ----------

    function _renderDecorationsPanel(scene) {
        _heading('Decorations', 'What does this page feel like — what’s behind the photo, and what’s scattered around it?', ICONS.decorations);

        const bgColor = window.ProjectModel.getSceneBackgroundColor(currentProject, scene.id);
        _fieldGroup('Background', _colorInput(bgColor, function (v) {
            window.ProjectModel.setSceneBackground(currentProject, scene.id, v);
            _persist();
            _redrawSceneCanvases(scene.id);
        }), 'Whatever sits at the very bottom of the page — there is no separate background setting anywhere else; this simply edits it.');

        contextPanel.appendChild(_fieldHelp('Click a decoration in Working View to select it and drag to reposition, or add a new one below.'));

        const decorations = (scene.layers || []).filter(function (l) { return l.kind !== 'fill'; });
        if (decorations.length) {
            const list = document.createElement('div');
            list.className = 'wb-scene-library-grid';
            decorations.forEach(function (l) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'wb-scene-template-card';
                const glyph = document.createElement('div');
                glyph.className = 'wb-scene-template-icon';
                glyph.textContent = l.glyph;
                const name = document.createElement('div');
                name.className = 'wb-scene-template-name';
                name.textContent = l.name;
                card.appendChild(glyph);
                card.appendChild(name);
                card.addEventListener('click', function () {
                    currentInspectorTarget = 'layer:' + l.id;
                    _renderWorkspace();
                });
                list.appendChild(card);
            });
            contextPanel.appendChild(list);
        }

        const addWrap = document.createElement('div');
        addWrap.className = 'wb-field-group';
        const addLabel = document.createElement('label');
        addLabel.className = 'wb-field-label';
        addLabel.textContent = 'Add a Decoration';
        addWrap.appendChild(addLabel);
        addWrap.appendChild(_fieldHelp('Choose a decoration to place in your scene.'));

        const grid = document.createElement('div');
        grid.className = 'wb-scene-template-grid';
        DECORATION_GLYPHS.forEach(function (g) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-scene-template-card';
            card.style.fontSize = '22px';
            card.style.textAlign = 'center';
            card.textContent = g;
            card.addEventListener('click', function () {
                const layer = window.ProjectModel.addSceneLayer(currentProject, scene.id, {
                    kind: 'decoration', glyph: g, name: 'Decoration',
                    position: { x: 0.4, y: 0.4 }, size: { w: 0.14, h: 0.14 }
                });
                currentInspectorTarget = 'layer:' + layer.id;
                _persist();
                _renderWorkspace();
            });
            grid.appendChild(card);
        });
        addWrap.appendChild(grid);
        contextPanel.appendChild(addWrap);
    }

    // ---------- Decorations — a decoration is selected: its full property panel ----------

    function _renderLayerPanel(scene, layer) {
        _heading('Decorations — ' + layer.name, 'Reposition, bring it forward or send it backward, or mark this spot open for Story Authors too.', ICONS.decorations);

        contextPanel.appendChild(_buildFieldGroup('Name', _textInput(layer.name, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { name: v });
            _persist();
        })));

        const xGroup = _buildFieldGroup('Position X %', _range(0, 100, Math.round(layer.position.x * 100), function (v) {
            layer.position.x = Math.min(1 - layer.size.w, Math.max(0, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const yGroup = _buildFieldGroup('Position Y %', _range(0, 100, Math.round(layer.position.y * 100), function (v) {
            layer.position.y = Math.min(1 - layer.size.h, Math.max(0, v / 100));
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(xGroup, yGroup);

        _fieldGroup('Size %', _range(4, 60, Math.round(layer.size.w * 100), function (v) {
            const frac = Math.max(0.03, v / 100);
            layer.size.w = frac;
            layer.size.h = frac; // decorations keep a square footprint this slice
            _persist();
            _redrawSceneCanvases(scene.id);
        }));

        const stackRow = document.createElement('div');
        stackRow.className = 'wb-row-controls';
        stackRow.style.marginBottom = '12px';
        const fwdBtn = document.createElement('button');
        fwdBtn.type = 'button';
        fwdBtn.textContent = '⬆ Bring Forward';
        fwdBtn.addEventListener('click', function () {
            window.ProjectModel.moveInStack(currentProject, scene.id, 'layer', layer.id, 'forward');
            _persist();
            _redrawSceneCanvases(scene.id);
        });
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.textContent = '⬇ Send Backward';
        backBtn.addEventListener('click', function () {
            window.ProjectModel.moveInStack(currentProject, scene.id, 'layer', layer.id, 'backward');
            _persist();
            _redrawSceneCanvases(scene.id);
        });
        stackRow.appendChild(fwdBtn);
        stackRow.appendChild(backBtn);
        contextPanel.appendChild(stackRow);

        _renderLayerPermissionBlock(scene, layer);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wb-workspace-btn';
        removeBtn.style.marginTop = '14px';
        removeBtn.textContent = '🗑 Remove this Decoration';
        removeBtn.addEventListener('click', function () {
            window.ProjectModel.deleteSceneLayer(currentProject, scene.id, layer.id);
            currentInspectorTarget = null;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(removeBtn);

        const backAllBtn = document.createElement('button');
        backAllBtn.type = 'button';
        backAllBtn.className = 'wb-workspace-btn';
        backAllBtn.style.marginTop = '8px';
        backAllBtn.textContent = '← All Decorations';
        backAllBtn.addEventListener('click', function () {
            currentInspectorTarget = null;
            _renderWorkspace();
        });
        contextPanel.appendChild(backAllBtn);
    }

    // The Decorations variant of the shared Story-Author-permission
    // block (Blueprint §6.2) gains one line beyond the standard three —
    // "let the Story Author add their own decorations here too." Saying
    // yes is the entire mechanism by which this Scene Layer becomes a
    // Decoration Slot (Engine Canon §7); there is no separate "mark as
    // Slot" control anywhere.
    function _renderLayerPermissionBlock(scene, layer) {
        const details = document.createElement('details');
        details.className = 'wb-state-intro';
        const summary = document.createElement('summary');
        summary.className = 'wb-state-intro-summary';
        const isOpen = layer.permissions.moveable || layer.permissions.editable || layer.decorationSlot;
        summary.textContent = (isOpen ? '🔓 Story Author may adjust this' : '🔒 Locked for Story Authors') + '  [Change]';
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'wb-state-intro-body';
        body.appendChild(_permissionCheckbox('Can a Story Author move this?', layer.permissions.moveable, function (v) {
            layer.permissions.moveable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Can a Story Author change this?', layer.permissions.editable, function (v) {
            layer.permissions.editable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Should a Story Author see this at all?', layer.permissions.visible, function (v) {
            layer.permissions.visible = v;
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        body.appendChild(_permissionCheckbox('Let the Story Author add their own decorations here too', layer.decorationSlot, function (v) {
            layer.decorationSlot = v;
            _persist();
        }));
        details.appendChild(body);
        contextPanel.appendChild(details);
    }

    // ---------- Text (Builder V2 — Blueprint §10) ----------
    // Unlike a decoration, text is not sourced from a Theme Asset shelf
    // (Blueprint §2's own resolved contradiction) — wording is always
    // bespoke to its Scene, so nothing constrains adding more of it the
    // way the shelf constrains decorations.

    const TEXT_FONT_OPTIONS = [
        { value: 'Georgia, serif', label: 'Georgia (Serif)' },
        { value: '"Iowan Old Style", "Palatino Linotype", serif', label: 'Iowan Old Style' },
        { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica (Sans)' },
        { value: '"Comic Sans MS", cursive', label: 'Comic Sans' },
        { value: '"Palatino Linotype", Palatino, serif', label: 'Palatino' }
    ];

    const TEXT_ALIGN_OPTIONS = [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
    ];

    // No decoration selected: the text-element list + Add (mirrors
    // _renderPlacePanel/_renderDecorationsPanel's own no-selection shape).
    function _renderTextPanel(scene) {
        _heading('Text', 'What does this page say, and what should the words look like?', ICONS.text);
        contextPanel.appendChild(_fieldHelp('Click a text element in Working View to select it and drag to reposition, or add a new one below — text is never sourced from a shelf, so nothing constrains adding more of it.'));

        const texts = (scene.layers || []).filter(function (l) { return l.kind === 'text'; });
        if (texts.length) {
            const list = document.createElement('div');
            list.className = 'wb-scene-library-grid';
            texts.forEach(function (l) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'wb-scene-template-card';
                const name = document.createElement('div');
                name.className = 'wb-scene-template-name';
                name.textContent = l.name;
                const desc = document.createElement('div');
                desc.className = 'wb-scene-template-desc';
                desc.textContent = (l.text || '').slice(0, 40) || '(empty)';
                card.appendChild(name);
                card.appendChild(desc);
                card.addEventListener('click', function () {
                    currentInspectorTarget = 'layer:' + l.id;
                    _renderWorkspace();
                });
                list.appendChild(card);
            });
            contextPanel.appendChild(list);
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
        addBtn.style.marginTop = '12px';
        addBtn.textContent = '➕ Add Text';
        addBtn.addEventListener('click', function () {
            const layer = window.ProjectModel.addSceneLayer(currentProject, scene.id, {
                kind: 'text', name: 'Text', text: 'New text',
                font: 'Georgia, serif', fontSize: 48, color: '#1D3457', align: 'left',
                position: { x: 0.15, y: 0.1 }, size: { w: 0.7, h: 0.15 }
            });
            currentInspectorTarget = 'layer:' + layer.id;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);
    }

    // A text element is selected: write the words directly, then style
    // them (Blueprint §10's own two-step framing).
    function _renderTextLayerPanel(scene, layer) {
        _heading('Text — ' + layer.name, 'Write the words directly, then style them.', ICONS.text);

        contextPanel.appendChild(_buildFieldGroup('Name', _textInput(layer.name, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { name: v });
            _persist();
        })));

        contextPanel.appendChild(_fieldGroup('Words', _textarea(layer.text, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { text: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        })));

        const fontGroup = _buildFieldGroup('Font', _select(TEXT_FONT_OPTIONS, layer.font, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { font: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const alignGroup = _buildFieldGroup('Alignment', _select(TEXT_ALIGN_OPTIONS, layer.align, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { align: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(fontGroup, alignGroup);

        const sizeGroup = _buildFieldGroup('Size', _range(16, 120, layer.fontSize, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { fontSize: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        const colorGroup = _buildFieldGroup('Colour', _colorInput(layer.color, function (v) {
            window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { color: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        _fieldRow(sizeGroup, colorGroup);

        _renderTextPermissionBlock(scene, layer);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wb-workspace-btn';
        removeBtn.style.marginTop = '14px';
        removeBtn.textContent = '🗑 Remove this Text';
        removeBtn.addEventListener('click', function () {
            window.ProjectModel.deleteSceneLayer(currentProject, scene.id, layer.id);
            currentInspectorTarget = null;
            _persist();
            _renderWorkspace();
        });
        contextPanel.appendChild(removeBtn);

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'wb-workspace-btn';
        backBtn.style.marginTop = '8px';
        backBtn.textContent = '← All Text';
        backBtn.addEventListener('click', function () {
            currentInspectorTarget = null;
            _renderWorkspace();
        });
        contextPanel.appendChild(backBtn);
    }

    // The Text-variant permission block (Blueprint §10) — no Decoration
    // Slot line (that mechanism is specific to Decorations, Engine
    // Canon §7); `editable` here covers both wording and styling
    // together, exactly as Blueprint §10 specifies: "for text
    // specifically, editable governs whether a Story Author may change
    // the wording itself, distinct from whether they may restyle it,
    // both expressible through the same three questions."
    function _renderTextPermissionBlock(scene, layer) {
        const details = document.createElement('details');
        details.className = 'wb-state-intro';
        const summary = document.createElement('summary');
        summary.className = 'wb-state-intro-summary';
        const isOpen = layer.permissions.moveable || layer.permissions.editable;
        summary.textContent = (isOpen ? '🔓 Story Author may adjust this' : '🔒 Locked for Story Authors') + '  [Change]';
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'wb-state-intro-body';
        body.appendChild(_permissionCheckbox('Can a Story Author move this?', layer.permissions.moveable, function (v) {
            layer.permissions.moveable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Can a Story Author change the wording or styling?', layer.permissions.editable, function (v) {
            layer.permissions.editable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Should a Story Author see this at all?', layer.permissions.visible, function (v) {
            layer.permissions.visible = v;
            _persist();
            _redrawSceneCanvases(scene.id);
        }));
        details.appendChild(body);
        contextPanel.appendChild(details);
    }

    // Vision §2's "how Scene Configuration is actually edited" — the one
    // real Scene Configuration edit this slice implements. Changing
    // Aspect Ratio also refreshes the Safe Area label, since Engine
    // Canon §4 does not let them vary independently.
    function _renderSceneConfigPanel(scene) {
        _heading('Scene Configuration', 'This Scene’s shape — click an empty area of the Canvas any time to come back here.');

        const options = window.EngineSchema.ASPECT_ORDER.map(function (id) {
            const info = window.EngineSchema.aspectInfo(id);
            return { value: id, label: info.icon + ' ' + info.label + ' (' + info.width + '×' + info.height + ')' };
        });
        _fieldGroup('Aspect Ratio', _select(options, scene.canvas.aspectRatio, function (value) {
            window.ProjectModel.setSceneAspect(currentProject, scene.id, value);
            _persist();
            _renderWorkspace();
        }), 'Size is set automatically from the Aspect Ratio you choose.');

        contextPanel.appendChild(_fieldHelp('Safe Area: ' + scene.canvas.safeArea + '. Shown as a guide in Working View to help you compose — it won’t stop you from placing things outside it.'));
    }

    function _heading(title, sub, iconSvg) {
        const h = document.createElement('h2');
        h.className = 'wb-context-heading';
        if (iconSvg) {
            const iconEl = document.createElement('span');
            iconEl.className = 'wb-heading-icon';
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.innerHTML = iconSvg;
            h.appendChild(iconEl);
            h.appendChild(document.createTextNode(title));
        } else {
            h.textContent = title;
        }
        contextPanel.appendChild(h);
        if (sub) {
            const p = document.createElement('p');
            p.className = 'wb-context-subheading';
            p.textContent = sub;
            contextPanel.appendChild(p);
        }
    }

    // Builds a field group without mounting it — the shared piece
    // _fieldGroup() and _fieldRow() (Sprint B2.0.4) both need, since a
    // paired row must build two groups before appending either one.
    function _buildFieldGroup(labelText, inputEl, helpText) {
        const group = document.createElement('div');
        group.className = 'wb-field-group';
        const label = document.createElement('label');
        label.className = 'wb-field-label';
        label.textContent = labelText;
        group.appendChild(label);
        group.appendChild(inputEl);
        if (helpText) group.appendChild(_fieldHelp(helpText));
        return group;
    }

    function _fieldGroup(labelText, inputEl, helpText) {
        const group = _buildFieldGroup(labelText, inputEl, helpText);
        contextPanel.appendChild(group);
        return group;
    }

    // Sprint B2.0.4 — the Inspector is now the primary workspace and
    // has substantially more width to work with; pairs of short,
    // related fields (Aspect|Composition, Padding|Spacing, ...) sit
    // side by side instead of stacking the full form vertically, per
    // this sprint's own "logical horizontal grouping" instruction.
    function _fieldRow() {
        const groups = Array.prototype.slice.call(arguments);
        const row = document.createElement('div');
        row.className = 'wb-field-row';
        groups.forEach(function (g) { row.appendChild(g); });
        contextPanel.appendChild(row);
        return row;
    }

    function _textInput(value, onInput) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'wb-field-input';
        input.value = value || '';
        input.addEventListener('input', function () { onInput(input.value); });
        return input;
    }

    // Sprint B2.0.2 — World Id must be auto-generated and never
    // manually editable (see docs/WORLD_BUILDER_ARCHITECTURE.md). A
    // plain read-only field, not a disabled input, so it still reads
    // clearly rather than looking broken/greyed-out.
    function _readOnlyField(value) {
        const div = document.createElement('div');
        div.className = 'wb-field-readonly';
        div.textContent = value || '';
        return div;
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

    // AV-009 — a raw camera-resolution photo can produce a multi-megabyte
    // data URL; every uploaded asset lands in the single JSON blob
    // ProjectStore keeps in one localStorage key (the same World Project
    // Contract persistence choice, unchanged), so one large upload could
    // silently push a save past the browser's per-origin quota. Root
    // cause traced to `_writeAll`'s pre-existing try/catch swallowing
    // that failure with no visible error — a save that never reached
    // localStorage still showed "All Changes Saved" until the very next
    // reload silently reverted it (see ProjectStore.save's own AV-009
    // note for the other half of this fix). Rather than only detect the
    // failure after the fact, large uploads are downscaled/re-compressed
    // here, before they ever reach ProjectModel/ProjectStore, so a
    // realistic photo actually fits; anything already small enough
    // (icons, small graphics) passes through untouched, byte-for-byte,
    // since there's no reason to lossily recompress something that was
    // never a risk.
    const UPLOAD_DOWNSCALE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
    const UPLOAD_MAX_DIMENSION = 1600;

    function _downscaleImageDataURL(dataURL, onDone) {
        const img = new Image();
        img.onload = function () {
            const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
            const scale = Math.min(1, UPLOAD_MAX_DIMENSION / longestEdge);
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            try {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const out = canvas.toDataURL('image/jpeg', 0.85);
                onDone(out.length < dataURL.length ? out : dataURL);
            } catch (e) {
                onDone(dataURL); // canvas export failed — fall back to the original upload
            }
        };
        img.onerror = function () { onDone(dataURL); };
        img.src = dataURL;
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
            reader.onload = function () {
                const dataURL = reader.result;
                const isImage = file.type && file.type.indexOf('image/') === 0;
                if (isImage && dataURL.length > UPLOAD_DOWNSCALE_THRESHOLD_BYTES) {
                    _downscaleImageDataURL(dataURL, onFile);
                } else {
                    onFile(dataURL);
                }
            };
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
        // "World" — renamed from "Overview," label only (Vision §1);
        // same screen, same purpose, still every project's first stop.
        _heading('World', 'Give your world a wonderful identity.');
        _stateIntro('overview');

        // Blueprint §4 — "for a brand-new World with zero Scenes,
        // Overview also shows an inviting, unmissable prompt toward
        // Scenes." Scenes now owns Canvas/Holders directly (Engine V2),
        // so this is the natural next stop for a fresh World.
        if (!window.ProjectModel.scenes(project).length) {
            const prompt = document.createElement('div');
            prompt.className = 'wb-info-banner';
            const promptBtn = document.createElement('button');
            promptBtn.type = 'button';
            promptBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
            promptBtn.textContent = '✨ No Scenes yet — add your first one →';
            promptBtn.addEventListener('click', function () {
                currentNav = 'scenes';
                _renderNav();
                _renderWorkspace();
            });
            prompt.appendChild(promptBtn);
            contextPanel.appendChild(prompt);
        }

        // Theme Assets — a secondary entry from World, never a Global
        // Navigation peer (Vision §1; Blueprint §11).
        const assetsLink = document.createElement('button');
        assetsLink.type = 'button';
        assetsLink.className = 'wb-workspace-btn';
        assetsLink.style.marginBottom = '16px';
        assetsLink.textContent = '📦 Manage Theme Assets →';
        assetsLink.addEventListener('click', function () {
            currentNav = 'assets';
            _renderNav();
            _renderWorkspace();
        });
        contextPanel.appendChild(assetsLink);

        // Sprint B2.0.1 — Overview consumes the SAME shared
        // currentRepresentationId selection Representations uses (no
        // duplicated selection logic). Browsing the thumbnails below the
        // Live Preview updates this summary, the Preview itself, and the
        // active/highlighted thumbnail, all from that one shared value.
        const reps = window.ProjectModel.representations(project);
        if (reps.length) {
            const activeRep = window.ProjectModel.findRepresentation(project, currentRepresentationId) || reps[0];
            const repBox = document.createElement('div');
            repBox.className = 'wb-info-banner';
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

        // Sprint B2.0.6 — Property Editor grouping. Short, related
        // fields pair side by side (Name|Tagline, Publisher|Version,
        // Purpose|Mood, Thumbnail|Hero Image as upload cards); only
        // Description (multiline) and the two full-width identity rows
        // (World Id, Creation Types) stay their own row, per the
        // sprint's own "only multiline content should span full width"
        // rule.
        const nameGroup = _buildFieldGroup('World Name', _textInput(project.name, function (v) {
            window.ProjectModel.setIdentity(project, { name: v });
            _persist();
        }));
        const taglineGroup = _buildFieldGroup('Tagline', _textInput(project.tagline, function (v) {
            window.ProjectModel.setIdentity(project, { tagline: v });
            _persist();
            _renderPreview();
        }));
        _fieldRow(nameGroup, taglineGroup);

        const publisherGroup = _buildFieldGroup('Publisher', _textInput(man.author, function (v) {
            window.ProjectModel.setIdentity(project, { publisher: v });
            _persist();
        }));
        const versionGroup = _buildFieldGroup('Version', _textInput(man.version, function (v) {
            window.ProjectModel.setIdentity(project, { version: v });
            _persist();
        }));
        _fieldRow(publisherGroup, versionGroup);

        const meta = window.ProjectModel.metadata(project);

        const purposeGroup = _buildFieldGroup('Purpose', _textInput(meta.purpose, function (v) {
            window.ProjectModel.setIdentity(project, { purpose: v });
            _persist();
        }));
        const moodGroup = _buildFieldGroup('Mood', _textInput(meta.mood, function (v) {
            window.ProjectModel.setIdentity(project, { mood: v });
            _persist();
        }));
        _fieldRow(purposeGroup, moodGroup);

        _fieldGroup('World Id', _readOnlyField(man.id),
            'Auto-generated when this World was created. It never changes, so nothing that references this World (Studio, links, other Worlds) ever breaks.');

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

        const thumbnailGroup = _buildFieldGroup('Thumbnail', _assetUploadRow(
            project.icon || '🌎',
            window.ProjectModel.getAsset(project, 'thumbnail.png'),
            function (dataURL) {
                window.ProjectModel.setIdentityAsset(project, 'thumbnail', dataURL);
                _persist();
                _renderWorkspace();
            }
        ));
        const heroGroup = _buildFieldGroup('Hero Image', _assetUploadRow(
            '🖼️',
            window.ProjectModel.getAsset(project, 'preview.png'),
            function (dataURL) {
                window.ProjectModel.setIdentityAsset(project, 'hero', dataURL);
                _persist();
                _renderWorkspace();
            }
        ));
        _fieldRow(thumbnailGroup, heroGroup);

        _fieldGroup('Description', _textarea(project.description, function (v) {
            window.ProjectModel.setIdentity(project, { description: v });
            _persist();
        }));
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

        // Sprint B2.0.6 — Property Editor grouping: Name|Default Layout,
        // Default Frame|Layer Pack, Supported Actions its own row
        // (chips, not naturally pairable), Description last (multiline,
        // full width).
        const nameGroup = _buildFieldGroup('Name', _textInput(rep.name, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'name', v);
            _persist();
            _renderPreviewSelector();
        }));
        const defaultLayoutGroup = _buildFieldGroup('Default Layout', _select(_representationOptionsFor('layout'), rep.layout, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'layout', v);
            _persist();
            _renderPreview();
        }), 'Which Layout this Representation opens with. Defined in Layouts.');
        _fieldRow(nameGroup, defaultLayoutGroup);

        const defaultFrameGroup = _buildFieldGroup('Default Frame', _select(_representationOptionsFor('frame'), rep.defaultFrame, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'defaultFrame', v || null);
            _persist();
            _renderPreview();
        }), 'Which Frame Variation this Representation suggests first. Defined in Frames.');

        const packOptions = window.ProjectModel.listLayerPacks(project).map(function (p) {
            return { value: p.id, label: p.name };
        });
        const layerPackGroup = _buildFieldGroup('Layer Pack', _select(packOptions, rep.defaultLayerPack || packOptions[0].value, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'defaultLayerPack', v);
            _persist();
        }), 'Every new World begins with a default Layer Pack called Basic — a small set of captions and decorations placed on the page. You can customise or rename it later in the Layer Packs state.');
        _fieldRow(defaultFrameGroup, layerPackGroup);

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

        _fieldGroup('Description', _textarea(rep.description, function (v) {
            window.ProjectModel.setRepresentationField(project, rep.id, 'description', v);
            _persist();
        }));
    }

    // ---------- State 3: Layouts ----------

    function _renderLayoutsPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Layouts', 'Design the composition.');
        _stateIntro('layouts');

        // Sprint B2.0.2 — creators were never told which Representation
        // they were designing Layouts for. Layouts are shared/reusable
        // (any Representation can point at one via its Default Layout),
        // so this reads the same shared `currentRepresentationId` every
        // other state uses rather than inventing a stricter ownership
        // model — see docs/WORLD_BUILDER_ARCHITECTURE.md A-005, still an
        // open question across more Official Worlds.
        const activeRepForLayouts = window.ProjectModel.findRepresentation(project, currentRepresentationId);
        if (activeRepForLayouts) {
            const repBanner = document.createElement('div');
            repBanner.className = 'wb-info-banner';
            const repBannerTitle = document.createElement('div');
            const repBannerStrong = document.createElement('strong');
            repBannerStrong.textContent = 'Current Representation: ';
            repBannerTitle.appendChild(repBannerStrong);
            repBannerTitle.appendChild(document.createTextNode((activeRepForLayouts.thumbnail || '') + ' ' + activeRepForLayouts.name));
            repBanner.appendChild(repBannerTitle);
            contextPanel.appendChild(repBanner);
            contextPanel.appendChild(_fieldHelp('Layouts are shared — other Representations can reuse the same one. Switch which Representation you\'re viewing from the Representations state.'));
        }

        // Sprint B2.0.3 — Layout Library "Used By": communicates Layout
        // reuse (a Layout is shared/independent, per the Current
        // Representation banner above) by listing every Representation
        // that currently points at each one via its Default Layout.
        const allReps = window.ProjectModel.representations(project);
        const layouts = window.ProjectModel.layouts(project);
        layouts.forEach(function (layout) {
            const row = document.createElement('div');
            row.className = 'wb-rep-list-row' + (layout.id === currentLayoutId ? ' active' : '');
            const name = document.createElement('span');
            name.className = 'wb-rep-list-row-name';
            name.textContent = layout.name || _capitalize(layout.id);
            row.appendChild(name);

            const usedBy = allReps.filter(function (r) { return r.layout === layout.id; });
            const usedByLine = document.createElement('span');
            usedByLine.className = 'wb-field-hint wb-layout-used-by';
            usedByLine.textContent = usedBy.length
                ? 'Used by: ' + usedBy.map(function (r) { return '✓ ' + r.name; }).join('   ')
                : 'Not used by any Representation yet';
            row.appendChild(usedByLine);

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

        // Sprint B2.0.6 — Property Editor grouping: Name|Aspect,
        // Composition|Caption Position, Padding|Spacing, Alignment|Used
        // By (a compact readout of the same reuse data the list above
        // already shows per-row, surfaced here too since "Used By" is
        // part of this Layout's own property grid per the sprint spec).
        const nameGroup = _buildFieldGroup('Layout Name', _textInput(layout.name || _capitalize(layout.id), function (v) {
            layout.name = v;
            _persist();
            _renderPreviewSelector();
        }));

        // Sprint B2.0.3 — Layout Guidance: Quote aspect and Quote
        // composition are the same concept from two fields, and the old
        // help text ("Must be Quote...") only ever *warned* about the
        // invalid combination rather than preventing it. Aspect now
        // drives Composition automatically — no invalid state is
        // reachable through the UI at all, so nothing needs to explain
        // an implementation rule a creator could otherwise violate.
        const aspectGroup = _buildFieldGroup('Aspect', _select([
            { value: 'landscape', label: 'Landscape' },
            { value: 'portrait', label: 'Portrait' },
            { value: 'square', label: 'Square' },
            { value: 'wide', label: 'Wide' },
            { value: 'quote', label: 'Quote' },
            { value: 'full-bleed', label: 'Full Bleed' }
        ], layout.aspect, function (v) {
            layout.aspect = v;
            if (v === 'quote') layout.composition = 'quote';
            else if (layout.composition === 'quote') layout.composition = 'below';
            _persist();
            _renderLayoutsPanel();
            _renderPreview();
        }), 'The page shape this Layout resolves to.');
        _fieldRow(nameGroup, aspectGroup);

        const isQuoteAspect = layout.aspect === 'quote';
        const compositionOptions = isQuoteAspect
            ? [{ value: 'quote', label: 'Quote — no Frame/Holder, centered text only' }]
            : [
                { value: 'below', label: 'Below — caption under the Frame (default)' },
                { value: 'right', label: 'Right — Frame left, caption right (Wide)' }
            ];
        const compositionSelect = _select(compositionOptions, layout.composition, function (v) {
            layout.composition = v;
            _persist();
            _renderPreview();
        });
        if (isQuoteAspect) compositionSelect.disabled = true;
        const compositionGroup = _buildFieldGroup('Composition', compositionSelect, isQuoteAspect
            ? 'Fixed for a Quote-aspect Layout.'
            : 'How the Frame and caption are arranged.');

        const captionPositionGroup = _buildFieldGroup('Caption Position', _select([
            { value: 'below', label: 'Below' },
            { value: 'right', label: 'Right' },
            { value: 'overlay', label: 'Overlay' },
            { value: 'none', label: 'None' }
        ], layout.captionPosition, function (v) {
            layout.captionPosition = v;
            _persist();
            _renderPreview();
        }), 'Moves the sample caption in the Working View.');
        _fieldRow(compositionGroup, captionPositionGroup);

        const holderDiagram = document.createElement('div');
        holderDiagram.className = 'wb-holder-area-diagram';
        holderDiagram.textContent = 'Holder Area';
        _fieldGroup('Holder Area', holderDiagram);

        const paddingGroup = _buildFieldGroup('Padding', _range(0, 48, layout.padding, function (v) {
            layout.padding = v;
            _persist();
            _renderPreview();
        }), 'Shrinks the Padding guide in the Working View.');

        const spacingGroup = _buildFieldGroup('Spacing', _range(0, 32, layout.spacing, function (v) {
            layout.spacing = v;
            _persist();
            _renderPreview();
        }));

        _fieldRow(paddingGroup, spacingGroup);

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
                _renderPreview();
            });
            alignRow.appendChild(btn);
        });
        const alignmentGroup = _buildFieldGroup('Alignment', alignRow);

        const usedBySelected = allReps.filter(function (r) { return r.layout === layout.id; });
        const usedByReadout = document.createElement('p');
        usedByReadout.className = 'wb-field-hint';
        usedByReadout.style.margin = '9px 0 0';
        usedByReadout.textContent = usedBySelected.length
            ? usedBySelected.map(function (r) { return '✓ ' + r.name; }).join('   ')
            : 'Not used by any Representation yet';
        const usedByGroup = _buildFieldGroup('Used By', usedByReadout);

        _fieldRow(alignmentGroup, usedByGroup);
    }

    // ---------- State 4: Frames (Sprint B2.0) ----------

    function _renderFramesPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Frames', 'Create beautiful frames.');

        // Reached from the Place activity's Frame picker (Blueprint §6.3
        // — "manage the full shelf" bridge) rather than a Global
        // Navigation peer (Vision §1) — a Scene stays open behind this
        // screen, so returning to it is one click, not a re-navigation.
        if (currentSceneId) {
            const back = document.createElement('button');
            back.type = 'button';
            back.className = 'wb-workspace-btn';
            back.style.marginBottom = '12px';
            back.textContent = '← Back to Scene';
            back.addEventListener('click', function () {
                currentNav = 'scenes';
                _renderNav();
                _renderWorkspace();
            });
            contextPanel.appendChild(back);
        }

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

        // Sprint B2.0.6 — Property Editor grouping: Name|Wall Tone,
        // Border|Corner Radius, Shadow|Inset, Padding|Margin, Thickness
        // alone (doesn't pair naturally with what's left), Description
        // last (multiline, full width).
        const nameGroup = _buildFieldGroup('Frame Name', _textInput(frame.name, function (v) {
            window.ProjectModel.setFrameField(project, frame.id, 'name', v);
            _persist();
            _renderPreviewSelector();
        }));
        const wallToneGroup = _buildFieldGroup('Wall Tone (Background)', _colorInput(f.wallTone, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'wallTone', v);
            _persist();
            _renderPreview();
        }));
        _fieldRow(nameGroup, wallToneGroup);

        const borderColorGroup = _buildFieldGroup('Border Color', _colorInput(f.borderColor, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'borderColor', v);
            _persist();
            _renderPreview();
        }));
        const cornerRadiusGroup = _buildFieldGroup('Corner Radius', _range(0, 24, f.cornerRadius || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'cornerRadius', v);
            _persist();
            _renderPreview();
        }));
        _fieldRow(borderColorGroup, cornerRadiusGroup);

        const shadowGroup = _buildFieldGroup('Shadow', _select([
            { value: 'none', label: 'None' },
            { value: 'soft', label: 'Soft' },
            { value: 'floating', label: 'Floating' },
            { value: 'gallery', label: 'Gallery' }
        ], f.shadow, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'shadow', v);
            _persist();
            _renderPreview();
        }));
        const insetGroup = _buildFieldGroup('Inset', _range(0, 20, f.inset || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'inset', v);
            _persist();
            _renderPreview();
        }));
        _fieldRow(shadowGroup, insetGroup);

        const matWidthGroup = _buildFieldGroup('Padding (Mat Width)', _range(0, 64, f.matWidth, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'matWidth', v);
            _persist();
            _renderPreview();
        }));
        const defaultMarginGroup = _buildFieldGroup('Default Margin', _range(0, 40, f.defaultMargin || 0, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'defaultMargin', v);
            _persist();
            _renderPreview();
        }));
        _fieldRow(matWidthGroup, defaultMarginGroup);

        _fieldGroup('Thickness (Frame Thickness)', _range(0, 40, f.frameThickness, function (v) {
            window.ProjectModel.setFrameFieldValue(project, frame.id, 'frameThickness', v);
            _persist();
            _renderPreview();
        }));

        _fieldGroup('Description', _textarea(frame.description, function (v) {
            window.ProjectModel.setFrameField(project, frame.id, 'description', v);
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

        // Sprint B2.0.6 — Property Editor grouping: Type|Target, Anchor|
        // Position, Offset X|Offset Y — the ticket's own master-detail
        // flow (Layer List → Selected Layer → Target → Anchor → Offsets
        // → Visibility → Lock), with Visibility/Lock already living as
        // inline icon buttons on each Layer List row above rather than
        // stacked fields down here. Layer Id and Z-Index/Text Source
        // don't pair naturally with anything left, so they stay solo.
        _fieldGroup('Layer Id', _textInput(layer.id, function (v) {
            if (!v) return;
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { id: v });
            currentLayerId = v;
            _persist();
        }));

        const typeGroup = _buildFieldGroup('Type', _select(LAYER_TYPES_OPTS, layer.type, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { type: v });
            _persist();
        }));
        const targetGroup = _buildFieldGroup('Target Container', _select(LAYER_TARGETS_OPTS, layer.target, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { target: v });
            _persist();
        }), 'Which containership scope this Layer draws on: the whole Slide, the Frame, the picture Holder, or a specific Element.');
        _fieldRow(typeGroup, targetGroup);

        const anchorGroup = _buildFieldGroup('Anchor', _select([
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
        const positionGroup = _buildFieldGroup('Position (Slide-targeted shorthand)', _select([
            { value: '', label: '(none — uses anchor instead)' },
            { value: 'bottom-left', label: 'Bottom Left' },
            { value: 'bottom-right', label: 'Bottom Right' },
            { value: 'top-left', label: 'Top Left' },
            { value: 'top-right', label: 'Top Right' }
        ], layer.position || '', function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { position: v || undefined });
            _persist();
        }));
        _fieldRow(anchorGroup, positionGroup);

        const offsetXGroup = _buildFieldGroup('Offset X', _range(-60, 60, layer.offsetX || 0, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { offsetX: v });
            _persist();
        }));
        const offsetYGroup = _buildFieldGroup('Offset Y', _range(-60, 60, layer.offsetY || 0, function (v) {
            window.ProjectModel.updateLayer(project, pack.id, layer.id, { offsetY: v });
            _persist();
        }));
        _fieldRow(offsetXGroup, offsetYGroup);

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

            // Sprint B2.0.6 — Assets Property Editor: upload cards in a
            // grid instead of one full-width stacked row per slot.
            // Dimensions/formats/required-state still shown per card —
            // just laid out for scanning at a glance instead of reading
            // top to bottom.
            const cardGrid = document.createElement('div');
            cardGrid.className = 'wb-asset-card-grid';
            cat.slots.forEach(function (slot) {
                cardGrid.appendChild(_assetSlotRow(project, slot));
            });
            contextPanel.appendChild(cardGrid);
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

    // Sprint B2.0.6 — Assets Property Editor: rebuilt as a vertical
    // upload card (thumb on top, then name/badge, purpose, a compact
    // one-line spec summary, status, and the upload button) instead of
    // a wide horizontal row, so several fit side by side in
    // _renderAssetsPanel's new .wb-asset-card-grid. Every value is still
    // read straight off AssetSpec.resolve()'s own slot object — no
    // second, duplicated set of dimensions/formats/required-state.
    function _assetSlotRow(project, slot) {
        const card = document.createElement('div');
        card.className = 'wb-asset-slot-row';

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

        // Sprint B2.0.1 — every value here is read straight off the
        // slot itself (AssetSpec.resolve/js/assetSpec.js, the mirror of
        // docs/WORLD_ASSET_SPEC.md) — no second, duplicated set of
        // dimensions/formats lives in this screen. Condensed to one
        // compact line (Sprint B2.0.6) now that the card is narrower.
        const specLine = document.createElement('p');
        specLine.className = 'wb-field-hint wb-asset-spec-line';
        const specParts = [slot.recommendedDimensions, (slot.formats || []).join('/').toUpperCase()];
        if (slot.maxFileSizeMB) specParts.push('≤' + slot.maxFileSizeMB + 'MB');
        specLine.textContent = specParts.filter(Boolean).join(' · ');

        const usage = document.createElement('p');
        usage.className = 'wb-field-hint';
        usage.textContent = 'Used by: ' + slot.usedBy;

        const status = document.createElement('span');
        status.className = 'wb-asset-status' + (existing ? ' filled' : '');
        status.textContent = existing ? 'Filled' : 'Missing';

        info.appendChild(nameRow);
        info.appendChild(purpose);
        info.appendChild(specLine);
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

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(btn);
        card.appendChild(input);
        return card;
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

    // Engine V2's own Validation report — a deliberately separate block
    // from the Engine V1 category list above it, never interleaved with
    // it (LOCK V2-04: Engine V2 Validation operates directly on the
    // canonical Scene Model, no translation layer, no merging with
    // Engine V1's own report). Each message is a plain string produced
    // by js/services/engineValidator.js — shown verbatim, since Scene
    // Model §5's four checks are already precise and Scene-name-scoped.
    function _renderSceneValidationSection(sceneResult) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-heading';
        heading.style.marginTop = '4px';
        heading.style.fontSize = '13px';
        heading.textContent = 'Scenes';
        contextPanel.appendChild(heading);

        const banner = document.createElement('div');
        banner.className = 'wb-validation-status ' + (sceneResult.isValid ? 'pass' : 'fail');
        banner.textContent = sceneResult.isValid
            ? '✅ Every Scene checks out.'
            : '⚠️ ' + sceneResult.errors.length + ' error' + (sceneResult.errors.length === 1 ? '' : 's') + ' to fix.';
        contextPanel.appendChild(banner);

        const countsLine = document.createElement('p');
        countsLine.className = 'wb-field-hint';
        countsLine.textContent = 'Errors: ' + sceneResult.errors.length + ' · Warnings: ' + sceneResult.warnings.length;
        contextPanel.appendChild(countsLine);

        sceneResult.errors.concat(sceneResult.warnings).forEach(function (msg) {
            const detail = document.createElement('p');
            detail.className = 'wb-field-hint wb-validation-detail';
            detail.textContent = msg;
            contextPanel.appendChild(detail);
        });
    }

    function _renderValidationPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Validation', 'Check this World\'s contract and completeness.');
        _stateIntro('validation');

        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'wb-add-btn';
        runBtn.textContent = (lastValidation || lastSceneValidation) ? '↻ Run Validation Again' : '▶ Run Validation';
        runBtn.addEventListener('click', function () {
            runBtn.textContent = 'Validating…';
            runBtn.disabled = true;
            // Two independent validation engines, run together but never
            // merged (LOCK V2-04 — Engine V2 Validation operates directly
            // on the canonical Scene Model, no translation layer, no
            // interleaving with Engine V1's own report). Engine V2's is
            // synchronous (plain JS objects already in memory); Engine
            // V1's is async (projectLoader's Blob/FileReader pipeline).
            lastSceneValidation = window.EngineV2Validator.validate(project);
            window.ProjectCompiler.runValidation(project).then(function (result) {
                lastValidation = result;
                _renderValidationPanel();
            });
        });
        contextPanel.appendChild(runBtn);

        if (!lastValidation && !lastSceneValidation) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Run validation to check this World against the World Project Contract.';
            contextPanel.appendChild(hint);
            return;
        }

        if (lastSceneValidation) _renderSceneValidationSection(lastSceneValidation);
        if (!lastValidation) return;

        if (lastSceneValidation) {
            const v1Heading = document.createElement('h3');
            v1Heading.className = 'wb-context-heading';
            v1Heading.style.marginTop = '20px';
            v1Heading.style.fontSize = '13px';
            v1Heading.textContent = 'World Contract';
            contextPanel.appendChild(v1Heading);
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

    // Sprint B2.0.6 — Build/Publish Property Editor: compact stat cards
    // in a grid instead of a single tall box of stacked <p> lines.
    function _statCardGrid(entries) {
        const grid = document.createElement('div');
        grid.className = 'wb-build-info-box';
        entries.forEach(function (pair) {
            const card = document.createElement('div');
            card.className = 'wb-build-stat';
            const label = document.createElement('span');
            label.className = 'wb-build-stat-label';
            label.textContent = pair[0];
            const value = document.createElement('span');
            value.className = 'wb-build-stat-value';
            value.textContent = pair[1];
            card.appendChild(label);
            card.appendChild(value);
            grid.appendChild(card);
        });
        return grid;
    }

    // Engine V2 Build — a deliberately separate section from the Engine
    // V1 build below it, never merged (LOCK V2-04: Build operates
    // directly on the canonical Scene Model, no translation layer). The
    // package itself is plain JSON, so no Blob/FileReader round trip is
    // strictly required to *produce* it, but `project.lastSceneBuild`
    // stores a dataURL anyway so Publish's existing `_downloadDataURL`
    // helper (and its "never read project.files, only the built
    // package" discipline, Sprint B2.0.1) works identically for both
    // engines' output.
    function _renderSceneBuildSection(project) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-heading';
        heading.style.marginTop = '4px';
        heading.style.fontSize = '13px';
        heading.textContent = 'Scenes';
        contextPanel.appendChild(heading);

        const manifest = window.ProjectModel.manifest(project);
        contextPanel.appendChild(_statCardGrid([
            ['Output File', (manifest.id || 'world') + '.v2world.json'],
            ['Scenes', String(window.ProjectModel.scenes(project).length)],
            ['Last Scene Validation', lastSceneValidation ? (lastSceneValidation.isValid ? 'Passed' : 'Failed') : 'Not run yet']
        ]));

        const buildBtn = document.createElement('button');
        buildBtn.type = 'button';
        buildBtn.className = 'wb-add-btn wb-build-btn';
        buildBtn.textContent = '🎬 Build Scene Package';
        buildBtn.addEventListener('click', function () {
            lastSceneValidation = window.EngineV2Validator.validate(project);
            const result = window.EngineV2Builder.build(project);
            if (!result.ok) {
                _renderBuildPanel();
                const err = document.createElement('div');
                err.className = 'wb-validation-status fail';
                err.textContent = '⚠️ Build failed — fix Scene Validation errors first.';
                contextPanel.insertBefore(err, contextPanel.firstChild.nextSibling);
                return;
            }
            const json = JSON.stringify(result.package, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const filename = (manifest.id || 'world') + '.v2world.json';
            const reader = new FileReader();
            reader.onload = function () {
                project.lastSceneBuild = {
                    filename: filename,
                    size: blob.size,
                    builtAt: result.package.builtAt,
                    dataURL: reader.result
                };
                _persist();
                _renderBuildPanel();
            };
            reader.readAsDataURL(blob);
        });
        contextPanel.appendChild(buildBtn);

        if (project.lastSceneBuild) {
            const success = document.createElement('div');
            success.className = 'wb-validation-status pass';
            success.textContent = '✓ Scene Package Built';
            contextPanel.appendChild(success);

            contextPanel.appendChild(_statCardGrid([
                ['Package Name', project.lastSceneBuild.filename],
                ['Package Size', _formatBytes(project.lastSceneBuild.size)],
                ['Build Timestamp', new Date(project.lastSceneBuild.builtAt).toLocaleString()]
            ]));
        }

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'World Package';
        contextPanel.appendChild(divider);
    }

    function _renderBuildPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Build', 'Build your World Package.');
        _stateIntro('build');

        _renderSceneBuildSection(project);

        const manifest = window.ProjectModel.manifest(project);
        contextPanel.appendChild(_statCardGrid([
            ['Output File', (manifest.id || 'world') + '.vtheme'],
            ['Version', manifest.version || '1.0.0'],
            ['Last Validation', lastValidation ? (lastValidation.isValid ? 'Passed' : 'Failed') : 'Not run yet']
        ]));

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

            contextPanel.appendChild(_statCardGrid([
                ['Package Name', project.lastBuild.filename],
                ['Package Size', _formatBytes(project.lastBuild.size)],
                ['Build Timestamp', new Date(project.lastBuild.builtAt).toLocaleString()]
            ]));

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

    // Engine V2 Publish — deliberately just "share the built package,"
    // mirroring Engine V1's Publish stage in kind (Scene Model §5's own
    // closing bullet: "sharing mechanics... are unchanged in *kind*").
    // Only Export exists so far: there is no Engine V2 Runtime outside
    // this Builder yet for "Official Themes" to install into (LOCK
    // V2-04's native Runtime is implemented here, not as a standalone
    // reader-facing consumer) — a disclosed gap, not an oversight, and
    // not this slice's scope to close. Operates only on
    // `project.lastSceneBuild`, never `project.files`, matching the
    // same "Publish never reads editable Project data" discipline
    // Engine V1's own Publish established (Sprint B2.0.1).
    function _renderScenePublishSection(project) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-heading';
        heading.style.marginTop = '4px';
        heading.style.fontSize = '13px';
        heading.textContent = 'Scenes';
        contextPanel.appendChild(heading);

        if (!project.lastSceneBuild) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Build a Scene Package first — Publish always ships exactly what Build produced.';
            contextPanel.appendChild(hint);
        } else {
            const grid = document.createElement('div');
            grid.className = 'wb-publish-grid';
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-publish-option';
            card.innerHTML =
                '<span class="wb-publish-icon">💾</span>' +
                '<span class="wb-publish-text"><span class="wb-publish-title">Export Scene Package</span>' +
                '<span class="wb-publish-note">Download the built Scene Package to your computer to back it up or share it.</span></span>';
            card.addEventListener('click', function () {
                _downloadDataURL(project.lastSceneBuild.dataURL, project.lastSceneBuild.filename);
            });
            grid.appendChild(card);
            contextPanel.appendChild(grid);
        }

        const divider = document.createElement('h3');
        divider.className = 'wb-context-heading';
        divider.style.marginTop = '20px';
        divider.style.fontSize = '13px';
        divider.textContent = 'World Package';
        contextPanel.appendChild(divider);
    }

    function _renderPublishPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Publish', 'Share your World with the world.');
        _stateIntro('publish');

        _renderScenePublishSection(project);

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

        const grid = document.createElement('div');
        grid.className = 'wb-publish-grid';
        options.forEach(function (opt) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-publish-option';
            card.disabled = !opt.action;
            card.innerHTML =
                '<span class="wb-publish-icon">' + opt.icon + '</span>' +
                '<span class="wb-publish-text"><span class="wb-publish-title">' + opt.title + '</span>' +
                '<span class="wb-publish-note">' + opt.note + '</span></span>';
            if (opt.action) card.addEventListener('click', opt.action);
            grid.appendChild(card);
        });
        contextPanel.appendChild(grid);

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
        note.textContent = 'Coming soon.';
        wrap.appendChild(icon);
        wrap.appendChild(title);
        wrap.appendChild(note);
        contextPanel.appendChild(wrap);
    }

    renderTemplateGrid();
    renderMyWorlds();
})();
