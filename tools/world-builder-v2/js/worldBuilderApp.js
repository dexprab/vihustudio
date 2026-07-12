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
        // world-builder-v2 — real Personal/Official badge: resolved
        // asynchronously by `_annotateProjectBadges` right after this
        // card mounts (see `renderMyWorlds`), never assumed up front —
        // the card renders correctly with no badge at all (matching
        // today's real "growing"-only status) whenever the Repository is
        // unreachable or this World was never actually published there.
        card.dataset.worldId = window.ProjectModel.manifest(project).id || '';

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
        status.textContent = project.status === 'draft' ? 'growing' : (project.status || 'growing');

        const updated = document.createTextNode('Edited ' + _timeAgo(project.updatedAt));

        const badge = document.createElement('span');
        badge.className = 'wb-project-badge wb-hidden';

        metaLine.appendChild(status);
        metaLine.appendChild(updated);
        metaLine.appendChild(badge);

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
            // Restored — the only way to get an editable copy of an
            // Official World (which opens read-only, see View Mode)
            // without touching the Official original itself. Duplicate
            // is a plain deep copy with a fresh id/timestamps (see
            // ProjectStore.duplicate) — it never carries the source's
            // own Personal/Official publish status, since the copy has
            // never been published anywhere itself.
            ['⧉', 'Duplicate', function (e) {
                e.stopPropagation();
                const copy = window.ProjectStore.duplicate(project);
                // A duplicate must be a genuinely distinct World — a
                // plain deep copy (ProjectStore.duplicate) keeps the
                // exact same manifest.json id as the source, which is
                // what openWorkspace's View Mode check (and the
                // Personal/Official badge match) is keyed on. Left
                // unfixed, duplicating an Official World would silently
                // open the copy in View Mode too, defeating the whole
                // point of duplicating it. Regenerate the id so the
                // copy has never itself been published anywhere.
                const man = window.ProjectModel.manifest(copy);
                man.id = man.id + '-copy-' + Math.random().toString(36).slice(2, 8);
                window.ProjectStore.save(copy);
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
        _annotateProjectBadges(projects);
    }

    // Stamps every project card's badge with the same text/class/tooltip
    // — used for the diagnostic states below (unavailable/unconfigured/
    // unreachable) where every card shares one explanation, as opposed
    // to the per-card Personal/Official match further down.
    function _markAllBadges(projects, text, cls, title) {
        projects.forEach(function (project) {
            const worldId = window.ProjectModel.manifest(project).id;
            const card = worldId && myWorldsList.querySelector('[data-world-id="' + worldId.replace(/"/g, '') + '"]');
            const badge = card && card.querySelector('.wb-project-badge');
            if (!badge) return;
            badge.textContent = text;
            badge.className = 'wb-project-badge ' + cls;
            if (title) badge.title = title;
        });
    }

    // world-builder-v2 — real Growing/Personal/Official badge. A Builder
    // Project's own status is always just "growing" (ProjectStore has no
    // concept of Publish/Promote at all); Personal/Official describe
    // whether this World's own id has actually been Published/Promoted
    // into a Repository — a separate system (ThemeRepositoryClient) with
    // no built-in cross-reference to ProjectStore. This resolves that
    // cross-reference for real, asynchronously.
    //
    // Every exit path below now leaves a visible trace on the card —
    // an earlier version silently `return`ed on all three of "script
    // didn't load," "Supabase isn't configured," and "fetch failed,"
    // which made all three indistinguishable from "genuinely never
    // published" (every card just stayed on plain "growing"). A Theme
    // Author who really had published had no way to tell "it's not
    // showing because nothing's configured" from "it's not showing
    // because something's broken" from "it's not showing, wait, did my
    // Publish even work?" — this makes each state say which one it is.
    async function _annotateProjectBadges(projects) {
        if (!window.ThemeRepositoryClient) {
            _markAllBadges(projects, '⚪ Repository unavailable', 'muted', 'js/themeRepositoryClient.js did not load in this deployment.');
            return;
        }
        let configured;
        try {
            configured = await window.ThemeRepositoryClient.isConfigured();
        } catch (e) {
            console.error('World Builder: ThemeRepositoryClient.isConfigured() threw', e);
            _markAllBadges(projects, '⚠️ Repository check failed', 'error', (e && e.message) || 'See browser console for details.');
            return;
        }
        if (!configured) {
            _markAllBadges(projects, '⚪ Not connected to a Repository', 'muted', 'supabase-config.json is missing or empty in this deployment — Publish/Promote in the Workspace will show the same message.');
            return;
        }
        let personalRows, officialRows;
        try {
            const results = await Promise.all([
                window.ThemeRepositoryClient.list('personal'),
                window.ThemeRepositoryClient.list('official')
            ]);
            personalRows = results[0];
            officialRows = results[1];
        } catch (e) {
            console.error('World Builder: could not check Repository status for My World Projects', e);
            _markAllBadges(projects, '⚠️ Couldn’t check Repository', 'error', (e && e.message) || 'See browser console for details.');
            return;
        }
        const personalIds = new Set((personalRows || []).map(function (r) { return r.theme_id; }));
        const officialIds = new Set((officialRows || []).map(function (r) { return r.theme_id; }));
        projects.forEach(function (project) {
            const worldId = window.ProjectModel.manifest(project).id;
            if (!worldId) return;
            const card = myWorldsList.querySelector('[data-world-id="' + worldId.replace(/"/g, '') + '"]');
            const badge = card && card.querySelector('.wb-project-badge');
            if (!badge) return;
            // Growing/Personal/Official are one status, not two badges
            // shown side by side — a card used to show "GROWING" (the
            // status pill) and "🌍 OFFICIAL" (a second, separate badge)
            // at once, which reads as two contradictory states on the
            // same card. A real repository match now replaces the status
            // pill itself instead of adding a competing one beside it;
            // the diagnostic states above (Repository unavailable/not
            // configured/check failed) are left exactly as a separate
            // badge, since those describe the *check*, not the Project's
            // own status, and don't read as a competing state.
            const statusEl = card && card.querySelector('.wb-project-status');
            if (officialIds.has(worldId)) _lastKnownOfficialIds.add(worldId);
            else _lastKnownOfficialIds.delete(worldId);
            if (officialIds.has(worldId)) {
                if (statusEl) { statusEl.textContent = '🌍 Official'; statusEl.className = 'wb-project-status wb-project-status-official'; }
                badge.className = 'wb-project-badge wb-hidden';
            } else if (personalIds.has(worldId)) {
                if (statusEl) { statusEl.textContent = '👤 Personal'; statusEl.className = 'wb-project-status wb-project-status-personal'; }
                badge.className = 'wb-project-badge wb-hidden';
            }
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
    // "no assumptions" intent, not an oversight. An optional `aspect`
    // overrides the Engine Scene Template's own default when the two
    // disagree — 'single-holder' always defaults to Portrait, but Artwork
    // Gallery's own starter Scene means "big and bold, the classic
    // gallery look," which reads as Landscape; seeding it Portrait left
    // every new Artwork Gallery World's first Scene mismatched against
    // its own intent until a Theme Author noticed and fixed it by hand.
    //
    // Builder & Studio Alignment Sprint — this starter Scene's own name
    // converges into this World's one default Representation (see
    // builder.js's convergeScenes()), so it is exactly the kind of
    // content the platform must not prescribe as if it were reserved.
    // Artwork Gallery's starter Scene was renamed away from "Showcase"
    // (one of the three names that sprint explicitly flagged) — its
    // first replacement, "Story," turned out to be its own mismatch: it
    // reads (and, with the 🎭 default thumbnail glyph, visually looks)
    // like the Tell a Story Creation Type, confusing on an Artwork
    // Gallery Representation carousel. "Gallery" isn't part of the
    // flagged Showcase/Portrait/Quote trio either, while actually
    // describing what this template is; the other four templates' names
    // (Cover/Quote/Sketch/Card) were never part of that flagged set and
    // already read as ordinary, template-appropriate authorial choices,
    // not platform-reserved vocabulary, so they are unchanged.
    const TEMPLATE_STARTER_SCENE = {
        'artwork-gallery': { template: 'single-holder', name: 'Gallery', aspect: 'landscape' },
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
        if (starter.aspect) window.ProjectModel.setSceneAspect(project, scene.id, starter.aspect);
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
        { id: 'experiences', icon: '🌟', label: 'Experiences' },
        { id: 'checkbuild', icon: '✅', label: 'Check & Build' },
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
        experiences: 'What: everything that enriches this World — frames, decorations, atmosphere, and more — kept in one home instead of scattered across Scenes. Why: an Experience always belongs to the Theme, never to one Scene or Place, so it can be found and reused wherever it fits. Do: grow a new idea in the Nursery — it starts as a protected sketch you can freely change or delete. Next: once an idea feels ready, it will graduate into the Gallery as part of the Theme.',
        representations: 'What: the page styles a child can choose — name them anything that fits your World (Story, Journey, Discovery, Comic... whatever you like). Why: Studio\'s Creation Flow shows exactly these, nothing more — the platform never prescribes what a Representation is called. Do: pick or add a Representation, then set its Default Layout and Default Frame. A Theme needs at least one; add more only if they genuinely improve the experience. Next: make sure every Layout/Frame you reference actually exists (see Layouts/Frames).',
        layouts: 'What: the geometry each page can use — aspect ratio, caption position, composition. Why: a Representation always points at one of these. Do: adjust Aspect/Composition/Spacing for the selected Layout, or add a new one. Next: design a Frame to go with it.',
        frames: 'What: the visual "mount" around the artwork — mat, border, wall colour, shadow. Why: a Representation\'s Default Frame decides how its pictures are presented. Do: tune the fields for the selected Frame, or create another. Next: connect Frames to Layer Packs for captions and decorations.',
        layerpacks: 'What: small elements placed on the page — captions, page numbers, stickers. Why: this is how a World adds its own personality on top of a Layout/Frame. Do: add Layers and set their Target Container/Anchor. Next: check Assets for anything these Layers need (like a decoration image).',
        assets: 'What: the images (and other files) this World needs. Why: Thumbnail and Hero Image are required before you can Build; everything else is optional polish. Do: upload what you have — the checklist shows exactly what\'s missing and why. Next: run Validation once everything looks complete.',
        validation: 'What: a real check of this World against the World Project Contract — the same rules Studio itself enforces. Why: catches problems before you spend time Building. Do: press Run Validation, then fix anything marked Error (Warnings are optional polish). Next: once it says "All Good!", move on to Build.',
        build: 'What: compiles this World Project into a real .vtheme-shaped Theme, the same shape VihuStudio imports. Why: nothing can be Published until it\'s Built. Do: press Build Theme (Validation must pass first). Next: once built, continue to Publish.',
        checkbuild: 'What: check this World against the World Project Contract, then compile it into a real Theme — one screen, since Build always needs Validation to pass first anyway. Why: catches problems before you spend time Building, and nothing can be Published until it\'s Built. Do: press Run Validation, fix anything marked Error, then press Build Theme. Next: once built, continue to Publish.',
        publish: 'What: share the Theme Build just produced. Why: a World only reaches VihuStudio once it leaves the Builder. Do: Publish to your Personal Repository first — this is your normal working environment, where you test and iterate in Studio — then Promote to the Official Repository once it\'s ready for everyone. Export is also available (a portable .vtheme package for backup), but it\'s not part of this primary workflow. Next: open VihuStudio and confirm your World appears.'
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
    const viewModeBanner = $('wb-view-mode-banner');
    const viewOnlyChip = $('wb-view-only-chip');
    const workspaceHome = $('wb-workspace-home');
    const workingCanvas = $('wb-working-canvas');
    const workingOverlays = $('wb-working-overlays');
    const runtimePreviewCanvas = $('wb-runtime-preview-canvas');
    const previewSelector = $('wb-preview-selector');
    let contextPanel = $('wb-context-panel');
    const experiencesPanel = $('wb-experiences-panel');

    // world-builder-v2 — Global Nav retired: World/Check & Build/Publish
    // and the legacy Engine V1 management screens (Representations/
    // Layouts/Frames/Layer Packs/Assets) all now open as a modal layered
    // on top of the always-visible workspace, instead of a mutually-
    // exclusive tab. `currentNav` keeps its exact pre-existing meaning
    // and every pre-existing dispatch site is unchanged — only where
    // that dispatch's OUTPUT gets mounted (into #wb-modal-body instead
    // of #wb-context-panel) is new. 'scenes' is the one non-modal,
    // "resting" value.
    const MODAL_NAVS = new Set(['overview', 'checkbuild', 'publish', 'representations', 'layouts', 'frames', 'layerpacks', 'assets']);
    // Working View keeps showing its own real content (the open Scene,
    // or the Experience Studio) behind most modals — only these navs
    // have a genuine Working View "specimen" of their own (AV-005's
    // already-correct Frame/Layout/Representation specimen editor, and
    // the Experience Studio), so every other modal nav (Overview/
    // Check&Build/Publish/Layer Packs/Assets) leaves Working View
    // showing the Scene/inactive-state exactly as if nav were 'scenes'.
    const WORKING_VIEW_PASSTHROUGH_NAVS = new Set(['representations', 'layouts', 'frames', 'experiences']);
    function _workingViewNav() {
        if (MODAL_NAVS.has(currentNav) && !WORKING_VIEW_PASSTHROUGH_NAVS.has(currentNav)) return 'scenes';
        return currentNav;
    }
    const modalOverlay = $('wb-modal');
    const modalBody = $('wb-modal-body');
    const modalTitleEl = $('wb-modal-title');
    const modalCloseBtn = $('wb-modal-close');
    const MODAL_TITLES = {
        overview: '🌍 World Settings', checkbuild: '✅ Check & Build', publish: '📤 Publish',
        representations: '🎭 Representations', layouts: '📐 Layouts', frames: '🖼️ Frames',
        layerpacks: '🧩 Layer Packs', assets: '📦 Assets'
    };
    function _closeModal() {
        currentNav = 'scenes';
        _renderNav();
        _renderWorkspace();
    }
    modalCloseBtn.addEventListener('click', _closeModal);
    modalOverlay.querySelector('.wb-modal-backdrop').addEventListener('click', _closeModal);

    let currentProject = null;
    // View Mode — an Official World opens read-only: every property is
    // visible, nothing is editable, protecting the curated Official
    // Repository from an accidental overwrite (Publish/Promote replace
    // in place with no version history). Personal stays fully editable,
    // matching the existing "Personal is your working/iteration space"
    // model. The only way out of View Mode is Duplicate (Welcome
    // screen), which creates a fresh, unpublished, fully editable copy —
    // deliberately no in-Workspace "Edit Anyway" unlock, so an Official
    // World can never be modified in place through the Builder.
    let currentProjectReadOnly = false;
    // Cached the moment the Welcome screen's own Official-repository
    // check (_annotateProjectBadges) resolves — openWorkspace() reads
    // this rather than firing a second live Supabase lookup on every
    // open. Starts empty (not read-only) until a real check succeeds.
    let _lastKnownOfficialIds = new Set();
    let currentNav = 'scenes';
    // Builder Workspace Polish — Continuous Builder. The right-side
    // authoring panel is two tabs: 'stack' (default) walks the current
    // Scene's real scene.stack directly (Holders + Layers, together,
    // reorderable); 'library' is the Theme-wide Experience collection,
    // unfiltered by Scene.
    let experiencesTab = 'stack';
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
    // Experiences (Builder V3 Milestone 3) — likewise its own report,
    // never merged into either of the above; Nurturing Experiences are
    // excluded entirely, since they aren't part of the Theme yet.
    let lastExperienceValidation = null;

    // Builder V2 — Scenes state. `currentSceneId` null means the Scenes
    // Library is showing; set means a specific Scene's editor is open.
    // `currentInspectorTarget` is the selection driving Context Inspector
    // independently of `currentActivity` (Vision §2 — Scene Configuration
    // is a selectable target but never an activity of its own).
    let currentSceneId = null;
    let currentActivity = 'place';
    let currentInspectorTarget = null;
    let scenesShowingTemplatePicker = false;
    // world-builder-v2 — Scenes strip reorder mode (session-only, not
    // persisted): toggles whether each strip card shows its ↑/↓
    // controls, mirroring the same reorder affordance the old Scenes
    // Library grid already had per card, just opt-in here since the
    // strip is visible at all times and reorder controls aren't needed
    // on every glance at it.
    let scenesReorderMode = false;

    workspaceHome.addEventListener('click', showWelcome);

    // ---------------------------------------------------------------
    // Header toolbar (Sprint B2.0.1 — Preview/Settings/Save/Menu, all
    // real, none decorative).
    // ---------------------------------------------------------------

    const btnSettings = $('wb-btn-settings');
    const btnMenu = $('wb-btn-menu');
    const menuDropdown = $('wb-menu-dropdown');
    const menuDuplicate = $('wb-menu-duplicate');
    const menuResetLayout = $('wb-menu-reset-layout');
    const menuDelete = $('wb-menu-delete');
    const savedBadge = $('wb-workspace-saved');
    const saveDot = $('wb-save-dot');
    const savedText = $('wb-workspace-saved-text');
    const cloudSyncBadge = $('wb-cloud-sync');
    const cloudSyncDot = $('wb-cloud-sync-dot');
    const cloudSyncText = $('wb-cloud-sync-text');

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

    // world-builder-v2 — Check & Build and Publish move from Nav tabs to
    // top-bar pill buttons, each opening the exact same, unmodified
    // _renderCheckBuildPanel()/_renderPublishPanel() content as a modal.
    const btnCheckBuild = $('wb-btn-checkbuild');
    const btnPublish = $('wb-btn-publish');
    btnCheckBuild.addEventListener('click', function () {
        currentNav = 'checkbuild';
        _renderWorkspace();
    });
    btnPublish.addEventListener('click', function () {
        currentNav = 'publish';
        _renderWorkspace();
    });

    // Status pill — a live Errors/Warnings readout in the top bar,
    // summed across all three independent validation reports
    // (World Contract/Scenes/Experiences, LOCK V2-04 — never merged
    // into one). Validation itself stays manual (pressing "Run
    // Validation" inside the Check & Build modal), so the pill reflects
    // the last run's result rather than performing an expensive
    // Blob-based check on every render; before any run, it stays
    // hidden rather than fabricating a status nothing has checked yet.
    const statusPillEl = $('wb-status-pill');
    function _renderStatusPill() {
        if (!lastValidation && !lastSceneValidation && !lastExperienceValidation) {
            statusPillEl.classList.add('wb-hidden');
            return;
        }
        let errors = 0, warnings = 0;
        [lastValidation, lastSceneValidation].forEach(function (r) {
            if (!r) return;
            errors += r.errors.length;
            warnings += r.warnings.length;
        });
        // validateExperiences() returns a plain findings array (every
        // entry `level:'error'` today — see _renderExperienceValidationSection,
        // the same treatment this mirrors), not the {errors,warnings}
        // shape the other two engines share.
        if (lastExperienceValidation) errors += lastExperienceValidation.length;
        statusPillEl.innerHTML = '';
        const errorItem = document.createElement('span');
        errorItem.className = 'wb-status-pill-item';
        errorItem.innerHTML = '<span class="wb-status-pill-dot ' + (errors ? 'error' : 'ok') + '"></span>' + errors + ' Error' + (errors === 1 ? '' : 's');
        const warnItem = document.createElement('span');
        warnItem.className = 'wb-status-pill-item';
        warnItem.innerHTML = '<span class="wb-status-pill-dot ' + (warnings ? 'warn' : 'ok') + '"></span>' + warnings + ' Warning' + (warnings === 1 ? '' : 's');
        statusPillEl.appendChild(errorItem);
        statusPillEl.appendChild(warnItem);
        statusPillEl.classList.remove('wb-hidden');
    }

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
    }

    // Cloud backup indicator — a second, separate readout from the local
    // save badge above. The local write (js/projectStore.js) is still
    // the only thing the Workspace actually reads from and is already
    // honestly reported by _setSaveState; this one reports the
    // best-effort background copy pushed to Supabase's builder_projects
    // table (js/services/projectSync.js), so "my work is safe" doesn't
    // rest on trusting an invisible mechanism. Hidden entirely until the
    // Repository's configured state is actually known (mirrors
    // #wb-status-pill's own "no status pill until there's a real status"
    // discipline) rather than guessing.
    function _setCloudSyncState(state) {
        cloudSyncBadge.classList.remove('wb-hidden');
        if (state === 'unavailable') {
            cloudSyncDot.textContent = '⚪';
            cloudSyncText.textContent = 'Cloud backup unavailable';
            cloudSyncBadge.title = 'Supabase is not configured in this deployment — your work is still saved locally in this browser.';
        } else if (state === 'pending') {
            cloudSyncDot.textContent = '🌤️';
            cloudSyncText.textContent = 'Backing up…';
            cloudSyncBadge.title = '';
        } else if (state === 'error') {
            cloudSyncDot.textContent = '⚠️';
            cloudSyncText.textContent = 'Cloud backup failed';
            cloudSyncBadge.title = 'The background copy to your Personal space did not go through — your work is still saved locally in this browser.';
        } else {
            cloudSyncDot.textContent = '☁️';
            cloudSyncText.textContent = 'Backed up';
            cloudSyncBadge.title = 'A copy of this World Project is saved to your Personal space.';
        }
        cloudSyncBadge.classList.toggle('wb-save-dirty', state === 'pending');
        cloudSyncBadge.classList.toggle('wb-save-error', state === 'error');
    }

    // Debounced separately from the local save (which is synchronous and
    // immediate, per AV-009/Sprint B2.0.6) — a network push on every
    // keystroke would be wasteful and would just queue up redundant
    // requests behind each other. 2s of no further edits before the
    // background copy actually goes out; ProjectSync.push() itself never
    // throws (see its own header comment), so this never needs a
    // try/catch of its own.
    let _cloudSyncTimer = null;
    function _scheduleCloudSync() {
        if (!window.ProjectSync) return;
        clearTimeout(_cloudSyncTimer);
        _cloudSyncTimer = setTimeout(function () {
            const project = currentProject;
            window.ProjectSync.isAvailable().then(function (ok) {
                if (!ok) { _setCloudSyncState('unavailable'); return; }
                _setCloudSyncState('pending');
                window.ProjectSync.push(project).then(function (result) {
                    // A later edit may have already fired a newer sync —
                    // never let a stale response overwrite a fresher state.
                    if (project !== currentProject) return;
                    _setCloudSyncState(result.ok ? 'synced' : 'error');
                });
            });
        }, 2000);
    }

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
    // world-builder-v2 — Runtime Preview no longer has its own grid
    // track (it nests inside Working View's own column, see
    // .wb-working-stages), so --wb-runtime-w/runtimeW/RUNTIME_* are
    // retired; only Context Inspector's and Experiences' widths, plus
    // the Scenes strip's own height, are still persisted.
    // Builder Workspace Polish — Continuous Builder: scenesH's default
    // shrinks from 220 to 128 — the filmstrip is Scene navigation only
    // (a thumbnail + a name/number badge), not a peer editing surface, so
    // it no longer needs to claim nearly a quarter of the Workspace's
    // height by default; 128px is enough for a legible thumbnail plus
    // the strip's own head row. SCENES_H_MIN (the drag floor) is
    // unchanged — 96px was already the practical minimum for a
    // recognizable thumbnail.
    const LAYOUT_DEFAULTS = { inspectorW: 420, experiencesW: 280, scenesH: 128, stageSplit: 60, dock: 'horizontal' };
    const INSPECTOR_PCT_MIN = 0.25, INSPECTOR_PCT_MAX = 0.65; // Working View >=35%, Context Inspector >=25% of the Working+Inspector+Experiences share
    const EXPERIENCES_W_MIN = 220, EXPERIENCES_PCT_MAX = 0.3;
    const SCENES_H_MIN = 96, SCENES_PCT_MAX = 0.45;
    const STAGE_SPLIT_MIN = 25, STAGE_SPLIT_MAX = 75; // Working View's own share of the stages' main axis, in percent

    const workspaceBody = $('wb-workspace-body');
    const scenesStripWrap = $('wb-scenes-strip-wrap');
    const resizeInspector = $('wb-resize-inspector');
    const resizeExperiences = $('wb-resize-experiences');
    const resizeScenes = $('wb-resize-scenes');

    function _loadWorkspaceLayout() {
        try {
            const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_KEY);
            if (!raw) return Object.assign({}, LAYOUT_DEFAULTS);
            const parsed = JSON.parse(raw);
            return {
                inspectorW: typeof parsed.inspectorW === 'number' ? parsed.inspectorW : LAYOUT_DEFAULTS.inspectorW,
                experiencesW: typeof parsed.experiencesW === 'number' ? parsed.experiencesW : LAYOUT_DEFAULTS.experiencesW,
                scenesH: typeof parsed.scenesH === 'number' ? parsed.scenesH : LAYOUT_DEFAULTS.scenesH,
                stageSplit: typeof parsed.stageSplit === 'number' ? parsed.stageSplit : LAYOUT_DEFAULTS.stageSplit,
                dock: parsed.dock === 'vertical' ? 'vertical' : LAYOUT_DEFAULTS.dock
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
        workspaceBody.style.setProperty('--wb-inspector-w', layout.inspectorW + 'px');
        workspaceBody.style.setProperty('--wb-experiences-w', layout.experiencesW + 'px');
        // Builder Workspace Polish — Continuous Builder: --wb-scenes-h is
        // now read by .wb-workspace-body's own grid-template-rows (the
        // filmstrip is a grid row of the Workspace body, not a flex
        // sibling of it any more), so it must be set here, on
        // workspaceBody itself — a CSS custom property only reaches a
        // property that reads it via inheritance from an ancestor (or the
        // element itself), never from a descendant like scenesStripWrap.
        workspaceBody.style.setProperty('--wb-scenes-h', layout.scenesH + 'px');
        workingStages.style.setProperty('--wb-stage-split', layout.stageSplit + '%');
        _applyDock(layout.dock);
    }

    // Working View's two internal stages (its own editing canvas, and
    // Runtime Preview nested beside/beneath it) — "horizontal" (side by
    // side) is the real, pre-existing default; "vertical" (stacked) is
    // the one alternative, toggled from Working View's own heading. No
    // longer a grid-level toggle (Runtime Preview isn't a grid column
    // any more) — just a flex-direction switch on #wb-working-stages.
    // #wb-resize-stage's own orientation classes follow the same
    // toggle, since a col-resize sash makes no sense once the stages
    // are stacked vertically (and vice versa).
    const dockHorizontalBtn = $('wb-dock-horizontal');
    const dockVerticalBtn = $('wb-dock-vertical');
    const workingStages = $('wb-working-stages');
    const resizeStage = $('wb-resize-stage');

    function _applyDock(dock) {
        workingStages.classList.toggle('wb-stage-stack', dock === 'vertical');
        dockHorizontalBtn.classList.toggle('active', dock !== 'vertical');
        dockVerticalBtn.classList.toggle('active', dock === 'vertical');
        resizeStage.classList.toggle('wb-resize-handle-v', dock !== 'vertical');
        resizeStage.classList.toggle('wb-resize-handle-h', dock === 'vertical');
        resizeStage.setAttribute('aria-orientation', dock === 'vertical' ? 'horizontal' : 'vertical');
    }

    function _setDock(dock) {
        const layout = _loadWorkspaceLayout();
        layout.dock = dock;
        _saveWorkspaceLayout(layout);
        _applyDock(dock);
    }

    dockHorizontalBtn.addEventListener('click', function () { _setDock('horizontal'); });
    dockVerticalBtn.addEventListener('click', function () { _setDock('vertical'); });

    // Working View ↔ Runtime Preview split, within the stages themselves
    // — a plain mousedown/mousemove/mouseup driver (not the shared
    // _wireResizeHandle below, since that one measures the workspace
    // body's own rect and this sash's boundary lives inside a nested
    // flex container instead) computing Working View's share of
    // whichever axis is currently the main one (width when side by
    // side, height when stacked).
    resizeStage.addEventListener('mousedown', function (e) {
        e.preventDefault();
        resizeStage.classList.add('wb-resize-dragging');
        function move(ev) {
            const rect = workingStages.getBoundingClientRect();
            const stacked = workingStages.classList.contains('wb-stage-stack');
            const pct = stacked
                ? ((ev.clientY - rect.top) / rect.height) * 100
                : ((ev.clientX - rect.left) / rect.width) * 100;
            const clamped = Math.min(STAGE_SPLIT_MAX, Math.max(STAGE_SPLIT_MIN, pct));
            workingStages.style.setProperty('--wb-stage-split', clamped + '%');
        }
        function up() {
            resizeStage.classList.remove('wb-resize-dragging');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            const layout = _loadWorkspaceLayout();
            layout.stageSplit = parseFloat(getComputedStyle(workingStages).getPropertyValue('--wb-stage-split')) || layout.stageSplit;
            _saveWorkspaceLayout(layout);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });

    // Collapsible panels (world-builder-v2) — a collapse button on
    // Context Inspector, Experiences, and Scenes shrinks that region to
    // a narrow rail without losing its resized width/height, which is
    // simply re-applied the next time it's expanded. Session-only state
    // (not persisted), independent of the resize/dock preferences above.
    // Working View/Runtime Preview are never collapsible — collapsing
    // the one editing canvas isn't a useful affordance, and Runtime
    // Preview no longer has an independent track of its own to collapse.
    const COLLAPSED_TRACK_W = 44;
    // Matches .wb-scenes-strip-wrap's own CSS min-height — low enough
    // that collapsing genuinely gives the strip's space away to Working
    // View above it (both now share the left grid column's own two rows,
    // so .wb-workspace-body's own grid row sizing claims whatever height
    // the strip gives up — Context Inspector/Experiences, spanning both
    // rows, are unaffected either way).
    const COLLAPSED_TRACK_H = 44;
    const inspectorWrap = $('wb-inspector-wrap');
    const experiencesWrapEl = $('wb-experiences-wrap');
    const collapseInspectorBtn = $('wb-collapse-inspector');
    const collapseExperiencesBtn = $('wb-collapse-experiences');
    const collapseScenesBtn = $('wb-collapse-scenes');
    const panelCollapsed = { inspector: false, experiences: false, scenes: false };
    const PANEL_COLLAPSE_META = {
        inspector: { wrap: inspectorWrap, btn: collapseInspectorBtn, cssVar: '--wb-inspector-w', layoutKey: 'inspectorW', target: workspaceBody, collapsedSize: COLLAPSED_TRACK_W },
        experiences: { wrap: experiencesWrapEl, btn: collapseExperiencesBtn, cssVar: '--wb-experiences-w', layoutKey: 'experiencesW', target: workspaceBody, collapsedSize: COLLAPSED_TRACK_W },
        // target: workspaceBody, not scenesStripWrap — see
        // _applyWorkspaceLayout's own comment on why --wb-scenes-h must
        // be set on the grid container that actually reads it.
        scenes: { wrap: scenesStripWrap, btn: collapseScenesBtn, cssVar: '--wb-scenes-h', layoutKey: 'scenesH', target: workspaceBody, collapsedSize: COLLAPSED_TRACK_H }
    };

    function _applyPanelCollapse(which) {
        const meta = PANEL_COLLAPSE_META[which];
        const collapsed = panelCollapsed[which];
        meta.wrap.classList.toggle('wb-panel-collapsed', collapsed);
        meta.btn.classList.toggle('wb-collapse-btn-collapsed', collapsed);
        if (collapsed) {
            meta.target.style.setProperty(meta.cssVar, meta.collapsedSize + 'px');
        } else {
            const layout = _loadWorkspaceLayout();
            meta.target.style.setProperty(meta.cssVar, layout[meta.layoutKey] + 'px');
        }
    }

    function _toggleCollapse(which) {
        panelCollapsed[which] = !panelCollapsed[which];
        _applyPanelCollapse(which);
    }

    collapseInspectorBtn.addEventListener('click', function () { _toggleCollapse('inspector'); });
    collapseExperiencesBtn.addEventListener('click', function () { _toggleCollapse('experiences'); });
    collapseScenesBtn.addEventListener('click', function () { _toggleCollapse('scenes'); });

    // Reset Workspace Layout (three-dot menu) — clears the persisted
    // preference and reapplies the shipped defaults immediately, on
    // this Workspace, without a reload.
    function _resetWorkspaceLayout() {
        try { window.localStorage.removeItem(WORKSPACE_LAYOUT_KEY); } catch (e) { /* ignore */ }
        _applyWorkspaceLayout();
    }

    // One shared drag driver for both vertical (column-resize) handles
    // — each just supplies how to read/clamp/write its own dimension
    // from a pointer position. The Navigation sash retired along with
    // the left sidebar it used to resize (Builder V2 — Vision §1 moves
    // Navigation to a top bar with nothing left to drag).
    function _wireResizeHandle(handle, onDrag) {
        handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            handle.classList.add('wb-resize-dragging');
            const bodyRect = workspaceBody.getBoundingClientRect();
            const scenesRect = scenesStripWrap.getBoundingClientRect();
            function move(ev) { onDrag(ev, bodyRect, scenesRect); }
            function up() {
                handle.classList.remove('wb-resize-dragging');
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                const layout = _loadWorkspaceLayout();
                const bodyStyle = getComputedStyle(workspaceBody);
                layout.inspectorW = parseFloat(bodyStyle.getPropertyValue('--wb-inspector-w')) || layout.inspectorW;
                layout.experiencesW = parseFloat(bodyStyle.getPropertyValue('--wb-experiences-w')) || layout.experiencesW;
                layout.scenesH = parseFloat(bodyStyle.getPropertyValue('--wb-scenes-h')) || layout.scenesH;
                _saveWorkspaceLayout(layout);
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    // Working View ↔ Context Inspector boundary. Bounded as a percentage
    // of the width available to those two columns alone (total width
    // minus every sash minus Experiences' own current width), so
    // resizing either sash first still yields sane proportions.
    _wireResizeHandle(resizeInspector, function (e, bodyRect) {
        const expTrackW = (parseFloat(getComputedStyle(workspaceBody).getPropertyValue('--wb-experiences-w')) || LAYOUT_DEFAULTS.experiencesW) + 6;
        const combinedW = bodyRect.width - 12 - expTrackW; // both fixed sashes + Experiences' own column
        if (combinedW <= 0) return;
        const rightEdge = bodyRect.right - expTrackW - 6; // boundary of Context Inspector's own right edge
        const inspectorW = Math.min(combinedW * INSPECTOR_PCT_MAX, Math.max(combinedW * INSPECTOR_PCT_MIN, rightEdge - e.clientX));
        workspaceBody.style.setProperty('--wb-inspector-w', inspectorW + 'px');
    });

    // Context Inspector ↔ Experiences boundary. Experiences is the
    // rightmost column, so its width is simply the distance from the
    // cursor to the workspace's own right edge.
    _wireResizeHandle(resizeExperiences, function (e, bodyRect) {
        const maxW = Math.min(bodyRect.width * EXPERIENCES_PCT_MAX, bodyRect.width - 12 - 300);
        const experiencesW = Math.min(maxW, Math.max(EXPERIENCES_W_MIN, bodyRect.right - e.clientX));
        workspaceBody.style.setProperty('--wb-experiences-w', experiencesW + 'px');
    });

    // Scenes strip height — a horizontal (row-resize) sash above the
    // strip, dragging its own height rather than a width.
    resizeScenes.addEventListener('mousedown', function (e) {
        e.preventDefault();
        resizeScenes.classList.add('wb-resize-dragging');
        function move(ev) {
            const workspaceRect = document.getElementById('wb-screen-workspace').getBoundingClientRect();
            const maxH = Math.min(workspaceRect.height * SCENES_PCT_MAX, workspaceRect.height - 200);
            const scenesH = Math.min(maxH, Math.max(SCENES_H_MIN, workspaceRect.bottom - ev.clientY));
            // Set on workspaceBody, not scenesStripWrap — see
            // _applyWorkspaceLayout's own comment; --wb-scenes-h now
            // sizes .wb-workspace-body's own grid row.
            workspaceBody.style.setProperty('--wb-scenes-h', scenesH + 'px');
        }
        function up() {
            resizeScenes.classList.remove('wb-resize-dragging');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            const layout = _loadWorkspaceLayout();
            layout.scenesH = parseFloat(getComputedStyle(workspaceBody).getPropertyValue('--wb-scenes-h')) || layout.scenesH;
            _saveWorkspaceLayout(layout);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
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
        // View Mode — reuses the Welcome screen's own already-resolved
        // Official-repository check (_annotateProjectBadges, cached in
        // _lastKnownOfficialIds the moment it succeeds) rather than
        // firing a second live Supabase lookup on every open; if that
        // check hasn't resolved yet or Supabase is unreachable, this
        // fails open (editable) rather than blocking the Workspace on a
        // possibly-unreachable network call — matching every other
        // Repository check's own graceful-degradation discipline.
        const worldId = window.ProjectModel.manifest(project).id;
        currentProjectReadOnly = !!(worldId && _lastKnownOfficialIds.has(worldId));
        // world-builder-v2 — 'scenes' is the one resting, non-modal nav:
        // Working View/Context Inspector/Experiences/Scenes strip are
        // always visible, so a brand-new World opens straight onto them
        // instead of into the World Settings modal.
        currentNav = 'scenes';

        // Frame Reference Integrity fix — a Frame deleted before this fix
        // shipped could leave a Representation's `defaultFrame` (or a
        // Scene Holder's `frame`) pointing at an id that no longer
        // exists, which Validation correctly rejects but which no
        // Builder screen lets an author inspect or clear by hand
        // (Representations has no reachable UI of its own). Repair it
        // silently the moment the Project is opened — the same
        // reconcile-on-read discipline this file already uses for a
        // Scene's `stack`/Holder defaults — and persist immediately so
        // the repair survives even if the author makes no other edit
        // before Validating/Building/Publishing.
        if (window.ProjectModel.reconcileFrameReferences(project)) {
            try { window.ProjectStore.save(project); } catch (e) {}
        }

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
        lastExperienceValidation = null;
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
        // Reflects the cloud badge's real state shortly after opening,
        // not only after the author's first edit.
        _scheduleCloudSync();
    }

    // Sprint B2.0.6 — see _setSaveState above for why this shows the
    // dirty indicator immediately, saves synchronously (no data-loss
    // risk from debouncing the real write), and only debounces the
    // *return* to "saved" so rapid edits settle into one clean
    // confirmation instead of flickering.
    function _persist() {
        // View Mode's real backstop: even if some individual control
        // somewhere in the Workspace was missed when disabling inputs
        // (a large, mostly-shared-helper-gated surface, but not a
        // 100%-audited one), no in-memory mutation of an Official World
        // can ever actually reach localStorage or Supabase, since every
        // real mutation path in this file funnels through this one
        // function before being saved.
        if (currentProjectReadOnly) return;
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
            // Only schedule a cloud backup for a write that actually
            // reached localStorage — an errored local save already shows
            // its own real failure state, and pushing to Supabase
            // wouldn't make an unsaved edit any safer.
            _scheduleCloudSync();
        }
        _renderWorkspaceHeader();
    }

    function _renderWorkspaceHeader() {
        workspaceName.textContent = currentProject.name || 'Untitled World';
        viewModeBanner.classList.toggle('wb-hidden', !currentProjectReadOnly);
        viewOnlyChip.classList.toggle('wb-hidden', !currentProjectReadOnly);
        // View Mode disables every action in the overflow menu except
        // Duplicate — Delete removes the Project outright, and Reset
        // Workspace Layout still writes to this browser's stored
        // preferences while an Official World is open, which reads as
        // "changing something" even though it isn't Project data.
        // Duplicate alone stays enabled, since it's exactly how you're
        // meant to leave View Mode.
        btnCheckBuild.disabled = currentProjectReadOnly;
        btnPublish.disabled = currentProjectReadOnly;
        menuResetLayout.disabled = currentProjectReadOnly;
        menuDelete.disabled = currentProjectReadOnly;
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
        _renderScenesExperiencesSidebar();
        _renderScenesStrip();
        _renderStatusPill();
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
        // Builder V3.1 — Working View Experience Studio: once a specific
        // Experience is open (selected from Gallery or Nursery), Working
        // View becomes that Experience's own isolated editing workspace
        // instead of the generic World identity card — Experience Home's
        // own grid view (nothing selected yet) keeps the identity card,
        // since there's still no single object to isolate there.
        const nav = _workingViewNav();
        if (nav === 'experiences') return !experienceInspectorId;
        return nav === 'overview' && window.ProjectModel.representations(currentProject).length === 0;
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

    // ---------- Working View Experience Studio (Builder V3.1) ----------
    // Restores the Builder's original two-view philosophy: Runtime
    // Preview is the Reader's complete published Scene (unchanged,
    // AV-005); Working View is the Author's own workspace, and while a
    // specific Experience is open it becomes that Experience's isolated
    // Studio — only its own populated content, cropped away from the
    // rest of the Scene, never the full composition. Reuses
    // `EngineV2Runtime.paintLayer` (the exact same primitive `render()`
    // uses for every Scene Layer) rather than a second rendering
    // implementation — this module only ever computes *where* to draw
    // (a cropped local coordinate space) and layers Builder-only
    // selection/resize chrome on top, never repaints anything Runtime
    // wouldn't recognise as the same content model.

    // A fixed reference width, matching this Builder's own most common
    // Scene resolution (Portrait/Square, 1080px), used only to scale a
    // Text section's absolute pixel Font Size sensibly when the
    // isolated Studio canvas is a different, typically much smaller,
    // pixel size than the eventual Scene it may or may not even be
    // hosted in yet (a Nurturing Experience has no Scene at all). This
    // is a Working-View-only cosmetic approximation — Runtime Preview
    // always renders the real Scene at its own real resolution through
    // the unmodified Engine V2 pipeline, completely unaffected by it.
    const EXPERIENCE_STUDIO_REFERENCE_WIDTH = 1080;

    function _experienceStudioStage(exp) {
        const props = exp.properties || {};
        const footprint = window.ProjectModel.experienceContentFootprint(props, exp.contentKind || 'text');
        // 18% padding on every side — handles and guide labels need
        // room, and a single small object should never fill the Studio
        // edge-to-edge.
        const padX = footprint.w * 0.18, padY = footprint.h * 0.18;
        return {
            x: footprint.x - padX, y: footprint.y - padY,
            w: footprint.w + padX * 2, h: footprint.h + padY * 2
        };
    }

    function _drawCheckerboard(ctx, w, h) {
        const cell = Math.max(10, Math.round(Math.min(w, h) / 20));
        ctx.save();
        ctx.fillStyle = '#EDE9DE';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#D6D0C0';
        for (let y = 0; y * cell < h; y++) {
            for (let x = 0; x * cell < w; x++) {
                if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }
        ctx.restore();
    }

    function _experienceSlotKeys(slot) {
        if (slot === 'text') return { x: 'textX', y: 'textY', w: 'textW', h: 'textH' };
        if (slot === 'image') return { x: 'imageX', y: 'imageY', w: 'imageW', h: 'imageH' };
        return { x: 'graphicX', y: 'graphicY', w: 'graphicW', h: 'graphicH' };
    }

    function _experienceAbsRect(exp, slot) {
        const k = _experienceSlotKeys(slot);
        const p = exp.properties || {};
        return { x: p[k.x] || 0, y: p[k.y] || 0, w: p[k.w] || 0.1, h: p[k.h] || 0.1 };
    }

    // The one live render state the Studio's own drag handlers read —
    // rebuilt on every non-dragging render, frozen (passed back in
    // unchanged) for the duration of an active drag gesture so the
    // coordinate mapping a gesture started with never shifts mid-drag
    // (a live-recomputed stage would otherwise chase its own tail: the
    // very rect being dragged is part of what decides the crop).
    let _experienceStudioState = null;

    // `frozenStage` — supplied only by the drag handlers below, mid-
    // gesture; every other caller (an Inspector field edit, an initial
    // selection, an image finishing decode) always recomputes fresh.
    // Authoring Convergence Sprint (Objective 2 — Runtime consistency):
    // the isolated Studio renders straight from an Experience's own
    // `properties`, independent of whether it's actually hosted
    // anywhere — correct for authoring (Nurturing/Personal ideas need
    // to be visible before they're hosted at all), but a real
    // Working-View-shows-it/Runtime-Preview-doesn't gap unless the
    // Builder says so. Returns `null` when the currently open Scene
    // already has this Experience hosted (Working View and Runtime
    // Preview already agree, nothing to disclose).
    function _experienceHostingStatus(exp) {
        const usage = window.ProjectModel.usageOf(currentProject, exp.id);
        if (!usage.length) {
            return 'Not yet hosted anywhere — this won’t appear in Runtime Preview until it’s hosted in a Scene.';
        }
        if (usage.some(function (u) { return u.sceneId === currentSceneId; })) {
            return null;
        }
        const names = usage.map(function (u) { return u.sceneName; })
            .filter(function (name, i, arr) { return arr.indexOf(name) === i; });
        return 'Hosted in ' + names.join(', ') + ' — open that Scene to see it in Runtime Preview.';
    }

    function _renderExperienceStudio(exp, frozenStage) {
        workingOverlays.innerHTML = '';
        const hostingStatus = _experienceHostingStatus(exp);
        if (hostingStatus) {
            const banner = document.createElement('div');
            banner.className = 'wb-info-banner';
            banner.style.position = 'absolute';
            banner.style.top = '10px';
            banner.style.left = '10px';
            banner.style.right = '10px';
            banner.style.zIndex = '5';
            banner.textContent = '🌱 ' + hostingStatus;
            workingOverlays.appendChild(banner);
        }
        const stray = workingCanvas.parentElement.querySelector('.wb-preview-frame');
        if (stray) stray.remove();
        const strayInactive = workingCanvas.parentElement.parentElement.querySelector('.wb-inactive-state');
        if (strayInactive) strayInactive.remove();
        _removeSceneLibrary(workingCanvas.parentElement);
        workingCanvas.classList.remove('wb-hidden');
        workingCanvas.parentElement.classList.remove('wb-hidden');

        const props = exp.properties || {};
        // Only-one-content-type-at-a-time — this isolated Studio used to
        // paint every populated section simultaneously (Colour+Text+
        // Image+Graphics all at once if each happened to have data),
        // matching the old V3.1 "show everything" model but never
        // updated when that model was replaced. Since switching kinds
        // deliberately preserves the *other* sections' stored data
        // (non-destructive, so switching back shows what was there
        // before), leaving this ungated meant Working View kept
        // painting stale, now-inactive content the real Adapter
        // (ProjectModel._syncUniversalContent, already gated) had
        // correctly stopped mirroring — a real Working View/Runtime
        // Preview mismatch, not just a stale-redraw timing issue.
        const kind = exp.contentKind || 'text';
        const stage = frozenStage || _experienceStudioStage(exp);

        let canvasW, canvasH;
        if (frozenStage && _experienceStudioState && _experienceStudioState.exp.id === exp.id) {
            canvasW = _experienceStudioState.canvasW;
            canvasH = _experienceStudioState.canvasH;
        } else {
            const target = 900;
            if (stage.w >= stage.h) { canvasW = target; canvasH = Math.max(200, Math.round(target * (stage.h / stage.w))); }
            else { canvasH = target; canvasW = Math.max(200, Math.round(target * (stage.w / stage.h))); }
        }

        workingCanvas.width = canvasW;
        workingCanvas.height = canvasH;
        if (workingCanvas.parentElement) workingCanvas.parentElement.style.aspectRatio = canvasW + ' / ' + canvasH;

        const ctx = workingCanvas.getContext('2d');
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Colour — the Experience's own backdrop; checkerboard is the
        // universal "no fill" convention when Transparent is enabled
        // (or, now, whenever Colour simply isn't the active kind).
        if (kind === 'colour' && props.colorTransparent === false) {
            ctx.save();
            ctx.globalAlpha = typeof props.colorOpacity === 'number' ? props.colorOpacity : 1;
            ctx.fillStyle = props.colorValue || '#F4F1EC';
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.restore();
        } else {
            _drawCheckerboard(ctx, canvasW, canvasH);
        }

        function toLocal(rect) {
            return {
                position: { x: (rect.x - stage.x) / stage.w, y: (rect.y - stage.y) / stage.h },
                size: { w: rect.w / stage.w, h: rect.h / stage.h }
            };
        }

        const graph = { width: canvasW, height: canvasH, resolveLayerImage: function (dataURI) { return _resolveLayerImage(dataURI, null); } };
        const zoom = canvasW / (stage.w * EXPERIENCE_STUDIO_REFERENCE_WIDTH);
        const sections = [];

        if (kind === 'image' && props.imageSrc) {
            const local = toLocal(_experienceAbsRect(exp, 'image'));
            window.EngineV2Runtime.paintLayer(ctx, Object.assign({ kind: 'decoration', image: props.imageSrc, glyph: '🖼️', fit: props.imageFit || 'fit', opacity: props.imageOpacity }, local), graph);
            sections.push({ slot: 'image', rect: window.EngineV2Runtime.rectFor(local, graph) });
        }
        if (kind === 'graphics' && props.graphicSrc) {
            const local = toLocal(_experienceAbsRect(exp, 'graphic'));
            window.EngineV2Runtime.paintLayer(ctx, Object.assign({ kind: 'decoration', image: props.graphicSrc, glyph: '🎭', opacity: props.graphicOpacity }, local), graph);
            sections.push({ slot: 'graphic', rect: window.EngineV2Runtime.rectFor(local, graph) });
        }
        if (kind === 'text' && props.textContent && props.textContent.trim()) {
            const local = toLocal(_experienceAbsRect(exp, 'text'));
            const textLayer = Object.assign({
                kind: 'text', text: props.textContent, font: props.textFont,
                fontSize: Math.max(6, (props.textSize || 32) * zoom),
                align: props.textAlign, color: props.textColor, opacity: props.textOpacity
            }, local);
            window.EngineV2Runtime.paintLayer(ctx, textLayer, graph);
            const footprint = window.EngineV2Runtime.textFootprint(ctx, textLayer, graph);
            sections.push({ slot: 'text', rect: footprint });
        }

        // Editor-only chrome — selection outline + a resize handle for
        // every populated section, exactly like the Scene editor's own
        // Holder chrome (`_drawSelectionOutline`, reused verbatim) —
        // never drawn onto Runtime Preview.
        sections.forEach(function (sec) {
            _drawSelectionOutline(ctx, sec.rect, canvasW, true);
        });
        // A soft dashed Studio boundary — the isolation frame itself,
        // reassuring the author nothing outside it is part of what
        // they're editing (Blueprint's own Safe-Area-guide spirit,
        // applied to this new isolated stage rather than a full Scene).
        ctx.save();
        ctx.strokeStyle = 'rgba(29,52,87,0.25)';
        ctx.setLineDash([canvasW * 0.012, canvasW * 0.008]);
        ctx.lineWidth = Math.max(1, canvasW * 0.0015);
        ctx.strokeRect(2, 2, canvasW - 4, canvasH - 4);
        ctx.restore();

        _experienceStudioState = { exp: exp, stage: stage, canvasW: canvasW, canvasH: canvasH, sections: sections };
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
            ? 'Select a Scene from the strip below to begin authoring.'
            : 'Create your first Scene to begin authoring.';
        panel.appendChild(icon);
        panel.appendChild(title);
        panel.appendChild(body);
        // world-builder-v2 — Scenes is a permanent strip now, always
        // visible right below Working View, so "go to Scenes" has
        // nothing left to navigate to when at least one already exists;
        // only the zero-Scenes case still needs a real CTA (opening the
        // Scene Template picker, Engine Invariant 4).
        if (!hasAnyScenes) {
            const cta = document.createElement('button');
            cta.type = 'button';
            cta.className = 'wb-add-btn';
            cta.textContent = '+ Create Scene';
            cta.addEventListener('click', function () {
                scenesShowingTemplatePicker = true;
                _renderWorkspace();
            });
            panel.appendChild(cta);
        }

        _renderRuntimePreviewEmpty(hasAnyScenes
            ? 'Runtime Preview becomes available once a Scene is open.'
            : 'Runtime Preview becomes available once a Scene has been created.');

        previewSelector.innerHTML = '';
    }

    // Scenes+Experiences simultaneous view — an Experience selected from
    // either the Experience Home Gallery/Nursery (Nav: experiences) or
    // the new always-visible Experiences-in-this-Scene column (Nav:
    // scenes, a Scene actually open) opens the same Working View
    // Experience Studio either way. Nurturing Experiences have no Scene
    // yet, so the 'scenes' half is gated on a Scene actually being open,
    // matching where the new column itself is shown.
    function _experienceStudioShouldBeActive() {
        if (!experienceInspectorId) return false;
        if (currentNav === 'experiences') return true;
        return currentNav === 'scenes' && !!currentSceneId;
    }

    function _renderPreview() {
        // Builder V3.1 — Working View Experience Studio takes priority
        // over both the Scene canvas and the generic identity-card path
        // whenever a specific Experience is open. It doesn't require an
        // active Scene at all (a Nurturing Experience can be authored
        // before it's ever hosted anywhere) — Runtime Preview stays
        // exactly as project-scoped as always (AV-005), independent of
        // what Working View shows: the active Scene if one exists, or an
        // honest empty state if not.
        if (_experienceStudioShouldBeActive()) {
            const exp = window.ProjectModel.findExperience(currentProject, experienceInspectorId);
            if (exp) {
                const activeSceneForExp = _activeSceneForRuntimePreview();
                if (activeSceneForExp) {
                    _drawSceneCanvas(runtimePreviewCanvas, activeSceneForExp, { guides: false, interactive: false });
                } else {
                    _renderRuntimePreviewEmpty('Runtime Preview becomes available once a Scene is open.');
                }
                _renderExperienceStudio(exp);
                previewSelector.innerHTML = '';
                return;
            }
            experienceInspectorId = null; // stale reference — fall through to the normal dispatch below
        }

        if (_workingViewNav() === 'scenes') {
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
        const scene = (_workingViewNav() === 'scenes' && currentSceneId) ? window.ProjectModel.findScene(currentProject, currentSceneId) : null;
        if (!scene) {
            sceneHeaderEl.classList.add('wb-hidden');
            sceneHeaderEl.innerHTML = '';
            workspaceName.classList.remove('wb-hidden');
            return;
        }
        sceneHeaderEl.classList.remove('wb-hidden');
        sceneHeaderEl.innerHTML = '';
        // The breadcrumb already repeats the World name, so the plain
        // name display hides while it's showing rather than sitting
        // beside it — one line, not two, in the same top-bar row.
        workspaceName.classList.add('wb-hidden');

        const crumb = document.createElement('div');
        crumb.className = 'wb-scene-breadcrumb';
        const worldStrong = document.createElement('strong');
        worldStrong.textContent = currentProject.name || 'Untitled World';
        crumb.appendChild(worldStrong);
        crumb.appendChild(document.createTextNode(' › ' + scene.name));

        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);
        const glance = document.createElement('span');
        glance.className = 'wb-scene-config-glance';
        glance.title = 'Scene Configuration — change this Scene\'s Aspect Ratio';

        const aspectSelect = document.createElement('select');
        aspectSelect.className = 'wb-scene-aspect-select';
        aspectSelect.disabled = currentProjectReadOnly;
        window.EngineSchema.ASPECT_ORDER.forEach(function (id) {
            const info = window.EngineSchema.aspectInfo(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = info.icon + ' ' + info.label;
            if (id === scene.canvas.aspectRatio) opt.selected = true;
            aspectSelect.appendChild(opt);
        });
        aspectSelect.addEventListener('change', function () {
            window.ProjectModel.setSceneAspect(currentProject, scene.id, aspectSelect.value);
            _persist();
            _renderWorkspace();
        });
        aspectSelect.addEventListener('click', function (e) { e.stopPropagation(); });

        const chip2 = document.createElement('span');
        chip2.className = 'wb-scene-config-chip';
        chip2.textContent = '📐 ' + scene.canvas.safeArea;
        const chip3 = document.createElement('span');
        chip3.className = 'wb-scene-config-chip';
        chip3.textContent = '📦 ' + aspect.width + ' × ' + aspect.height;
        glance.appendChild(aspectSelect);
        glance.appendChild(chip2);
        glance.appendChild(chip3);

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

    // Authoring Convergence Sprint — the Universal Experience content
    // model (Builder V3.1) has no "glyph" concept of its own (Text/
    // Image/Graphics/Colour only); rasterizing a one-click glyph pick
    // into a small PNG data URI and storing it as a Graphics asset lets
    // the Decorations quick-picker below keep its exact existing one-
    // click feel while creating a real Experience underneath, rather
    // than inventing a fifth content section just for this.
    function _rasterizeGlyphToDataURL(glyph) {
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 160;
        const ctx = canvas.getContext('2d');
        ctx.font = '120px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, 80, 88);
        return canvas.toDataURL('image/png');
    }

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

    // Builder V3 MEP — Decoration Image support. Same "caller resolves,
    // module only draws" shape as `_representativeArtworkImage` above,
    // generalized to any number of data-URI images a Scene's Layers may
    // reference (rather than the one Holder-level artwork slot): a
    // plain cache keyed by the data URI itself, so re-using the same
    // uploaded image across multiple Decorations decodes it only once.
    const _layerImageCache = {};
    function _resolveLayerImage(dataURI, sceneId) {
        if (!dataURI) return null;
        const cached = _layerImageCache[dataURI];
        if (cached) return cached.loaded ? cached.img : null;
        const entry = { img: new Image(), loaded: false };
        entry.img.onload = function () {
            entry.loaded = true;
            _redrawSceneCanvases(sceneId);
            // Builder V3.1 — the Experience Studio's Image/Graphics
            // sections resolve through this same cache but aren't Scene-
            // keyed (a Nurturing Experience may have no Scene at all),
            // so `_redrawSceneCanvases`'s own Scene-id early return can't
            // reach it; give it an explicit nudge once decoding finishes.
            if (_experienceStudioShouldBeActive()) {
                const exp = window.ProjectModel.findExperience(currentProject, experienceInspectorId);
                if (exp) _renderExperienceStudio(exp);
            }
        };
        entry.img.src = dataURI;
        _layerImageCache[dataURI] = entry;
        return null; // not decoded yet this frame — falls back to glyph until onload fires
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
        const graph = window.EngineV2Runtime.load(scene, _holderFrameFields, repImage, function (dataURI) {
            return _resolveLayerImage(dataURI, scene.id);
        });
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
        if (_workingViewNav() === 'scenes') {
            _drawSceneCanvas(workingCanvas, scene, { guides: true, interactive: true });
        }
    }

    function _renderScenesWorkingView() {
        // world-builder-v2 — Scenes now has its own permanent strip
        // beneath the workspace (see _renderScenesStrip), so Working
        // View no longer duplicates that browsing grid when no Scene is
        // open. The one thing it still shows here is the Scene Template
        // picker (Engine Invariant 4 — a new Scene never starts from a
        // blank Canvas), triggered by the strip's own "+ Add Scene" —
        // checked first and unconditionally, since "Add a Scene" is now
        // reachable from the strip even while a different Scene is
        // already open in Working View (a new interaction path this
        // always-visible strip enables); otherwise, with no picker and
        // no Scene open, it falls through to the honest AV-008 empty
        // state.
        if (!scenesShowingTemplatePicker && !currentSceneId) {
            return _renderInactiveWorkspace();
        }

        const strayFrame = workingCanvas.parentElement.querySelector('.wb-preview-frame');
        if (strayFrame) strayFrame.remove();
        workingCanvas.parentElement.classList.remove('wb-hidden');
        const strayInactive = workingCanvas.parentElement.parentElement.querySelector('.wb-inactive-state');
        if (strayInactive) strayInactive.remove();

        if (scenesShowingTemplatePicker) {
            workingCanvas.classList.add('wb-hidden');
            workingOverlays.innerHTML = '';
            _renderSceneLibrary(workingCanvas.parentElement);
            _renderRuntimePreviewEmpty('Choose a Scene Template to start from — every Scene begins from one, never a blank Canvas.');
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
        if (_workingViewNav() !== 'scenes' || !currentSceneId) return;
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
            // AV-006/AV-010 — clamp a text Layer against its measured
            // rendered footprint (both width and height), not its
            // declared size.w/size.h, which are only ever a wrap-width
            // and a creation-time placeholder height disconnected from
            // what actually renders (see _effectiveObjectRect above). The
            // footprint's x-offset from the declared box's own left edge
            // is constant for a given piece of text (it depends only on
            // alignment/content, never on position), so it's measured
            // once from the object's current position and reused to
            // convert a footprint-based clamp back into a position.x
            // clamp — correct for left/center/right alignment alike.
            let clampMinX = 0, clampMaxX = 1 - obj.size.w, clampH = obj.size.h;
            if (_holderDragState.kind === 'layer' && obj.kind === 'text') {
                const footprint = _effectiveObjectRect(obj, 'layer', workingCanvas);
                if (footprint) {
                    const rect = window.EngineV2Runtime.rectFor(obj, { width: workingCanvas.width, height: workingCanvas.height });
                    const offsetXFraction = (footprint.x - rect.x) / workingCanvas.width;
                    const footprintWFraction = footprint.w / workingCanvas.width;
                    clampMinX = -offsetXFraction;
                    clampMaxX = 1 - footprintWFraction - offsetXFraction;
                    clampH = footprint.h / workingCanvas.height;
                }
            }
            obj.position.x = Math.min(clampMaxX, Math.max(clampMinX, _holderDragState.startX + dx));
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

    // ---------- Working View Experience Studio — Move/Resize (Builder V3.1) ----------
    // A separate click-to-drag driver from the Scene editor's own
    // (`_holderDragState` above), scoped to whichever populated content
    // section (Text/Image/Graphics) the author clicks inside the
    // isolated Studio canvas — Colour has no Transform of its own, so
    // it's never a drag target. Mirrors the Scene editor's own
    // established shape (freeze-at-mousedown, mutate live on mousemove,
    // persist + refresh Inspector on mouseup) but reads/writes an
    // Experience's own universal properties directly instead of a Scene
    // Holder/Layer.
    let _experienceStudioDragState = null;

    function _experienceStudioHit(state, pxX, pxY) {
        const order = ['text', 'graphic', 'image']; // topmost-drawn-first
        for (let i = 0; i < order.length; i++) {
            const sec = state.sections.find(function (s) { return s.slot === order[i]; });
            if (!sec) continue;
            const hx = sec.rect.x + sec.rect.w, hy = sec.rect.y + sec.rect.h;
            const handleR = Math.max(12, state.canvasW * 0.022);
            if (Math.hypot(pxX - hx, pxY - hy) <= handleR * 1.5) {
                return { slot: order[i], mode: 'resize' };
            }
        }
        for (let i = 0; i < order.length; i++) {
            const sec = state.sections.find(function (s) { return s.slot === order[i]; });
            if (!sec) continue;
            if (pxX >= sec.rect.x && pxX <= sec.rect.x + sec.rect.w && pxY >= sec.rect.y && pxY <= sec.rect.y + sec.rect.h) {
                return { slot: order[i], mode: 'move' };
            }
        }
        return null;
    }

    workingCanvas.addEventListener('mousedown', function (e) {
        if (!_experienceStudioShouldBeActive() || !_experienceStudioState) return;
        if (_experienceStudioState.exp.id !== experienceInspectorId) return;
        const state = _experienceStudioState;
        const pt = _canvasFraction(workingCanvas, e);
        const pxX = pt.fx * state.canvasW, pxY = pt.fy * state.canvasH;
        const found = _experienceStudioHit(state, pxX, pxY);
        if (!found) return;
        _experienceStudioDragState = {
            mode: found.mode, slot: found.slot, exp: state.exp, stage: state.stage,
            canvasW: state.canvasW, canvasH: state.canvasH,
            startPxX: pxX, startPxY: pxY, startAbs: _experienceAbsRect(state.exp, found.slot)
        };
        e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
        if (!_experienceStudioDragState) return;
        const d = _experienceStudioDragState;
        const pt = _canvasFraction(workingCanvas, e);
        const pxX = pt.fx * d.canvasW, pxY = pt.fy * d.canvasH;
        // Local-fraction delta (canvas 0..1) converted back into
        // absolute Scene-fraction delta via the *frozen* stage this
        // gesture started with, per `_renderExperienceStudio`'s own
        // `toLocal` mapping, inverted.
        const dAbsX = ((pxX - d.startPxX) / d.canvasW) * d.stage.w;
        const dAbsY = ((pxY - d.startPxY) / d.canvasH) * d.stage.h;
        const k = _experienceSlotKeys(d.slot);
        const exp = d.exp;
        if (d.mode === 'move') {
            window.ProjectModel.updateExperienceProperty(currentProject, exp.id, k.x, Math.max(0, d.startAbs.x + dAbsX));
            window.ProjectModel.updateExperienceProperty(currentProject, exp.id, k.y, Math.max(0, d.startAbs.y + dAbsY));
        } else {
            window.ProjectModel.updateExperienceProperty(currentProject, exp.id, k.w, Math.max(0.02, d.startAbs.w + dAbsX));
            window.ProjectModel.updateExperienceProperty(currentProject, exp.id, k.h, Math.max(0.02, d.startAbs.h + dAbsY));
        }
        // Working View redraws with the *same frozen stage* the gesture
        // started with (never re-cropping mid-drag, which would chase
        // its own tail — the very rect being dragged is part of what
        // decides the crop); Runtime Preview redraws normally, since the
        // full Scene's own framing never depends on this Experience's
        // Studio crop.
        _renderExperienceStudio(exp, d.stage);
        exp.attachments.forEach(function (a) { _redrawSceneCanvases(a.sceneId); });
    });

    window.addEventListener('mouseup', function () {
        if (!_experienceStudioDragState) return;
        const exp = _experienceStudioDragState.exp;
        _experienceStudioDragState = null;
        _persist();
        // Settle the Studio's crop back to a fresh (non-frozen) fit
        // around the gesture's final result, and refresh the Inspector's
        // Transform sliders to match.
        if (_experienceStudioShouldBeActive() && experienceInspectorId === exp.id) {
            _renderExperienceStudio(exp);
            _renderContextPanel();
        }
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
        sub.textContent = aspect.label + (scene.holders.length ? ' · ' + scene.holders.length + ' Place' + (scene.holders.length > 1 ? 's' : '') : ' · No Place');

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
        card.disabled = currentProjectReadOnly;
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

    // ---------- Scenes strip (world-builder-v2) ----------
    // A permanent horizontal row beneath Working View/Context Inspector/
    // Experiences — picking a Scene is a quick, occasional switch, not
    // something that needs a whole screen of its own. Reuses the exact
    // same _sceneCardThumb (a real, live-updating Scene Stack render)
    // and ProjectModel.moveScene the old Scenes Library grid already
    // used; only the card's own layout is new.
    const scenesStripEl = $('wb-scenes-strip');
    const scenesStripSub = $('wb-scenes-strip-sub');
    const scenesReorderToggleBtn = $('wb-scenes-reorder-toggle');
    const scenesAddBtn = $('wb-scenes-add-btn');

    // The card IS the thumbnail: height comes from the strip (flex
    // stretch), width is derived from the Scene's own Aspect Ratio via
    // an inline `aspect-ratio`, so a Portrait Scene renders as a narrow
    // tall card and a Landscape/Wide Scene as a short wide one — neither
    // ever gets squeezed into the other's shape. Name/number and (in
    // reorder mode) the ↑/↓ controls are absolutely-positioned overlays
    // on top of the canvas rather than flow content below it, so they
    // never compete with the thumbnail for vertical space; the strip's
    // own height is the only thing that changes when it's resized or
    // collapsed, and the thumbnail scales with it automatically.
    function _sceneStripCard(scene, index, total) {
        const aspect = window.EngineSchema.aspectInfo(scene.canvas.aspectRatio);
        const card = document.createElement('div');
        card.className = 'wb-scene-strip-card' + (scene.id === currentSceneId ? ' active' : '');
        card.style.aspectRatio = aspect.width + ' / ' + aspect.height;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const canvas = document.createElement('canvas');
        canvas.className = 'wb-scene-strip-canvas';
        card.appendChild(canvas);
        _drawSceneCanvas(canvas, scene, { guides: false, interactive: false });

        const overlay = document.createElement('div');
        overlay.className = 'wb-scene-strip-overlay';
        const num = document.createElement('span');
        num.className = 'wb-scene-strip-num';
        num.textContent = String(index + 1);
        const name = document.createElement('span');
        name.className = 'wb-scene-strip-name';
        name.textContent = scene.name;
        overlay.appendChild(num);
        overlay.appendChild(name);
        card.appendChild(overlay);

        if (scenesReorderMode) {
            const reorderRow = document.createElement('div');
            reorderRow.className = 'wb-scene-strip-reorder';
            const upBtn = _smallBtn('↑', function (e) {
                e.stopPropagation();
                window.ProjectModel.moveScene(currentProject, scene.id, 'up');
                _persist();
                _renderScenesStrip();
            });
            upBtn.disabled = index === 0;
            const downBtn = _smallBtn('↓', function (e) {
                e.stopPropagation();
                window.ProjectModel.moveScene(currentProject, scene.id, 'down');
                _persist();
                _renderScenesStrip();
            });
            downBtn.disabled = index === total - 1;
            reorderRow.appendChild(upBtn);
            reorderRow.appendChild(downBtn);
            card.appendChild(reorderRow);
        }

        card.addEventListener('click', function () { _openScene(scene.id); });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _openScene(scene.id); }
        });
        return card;
    }

    function _sceneStripAddCard() {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-scene-strip-add';
        const icon = document.createElement('span');
        icon.className = 'wb-scene-strip-add-icon';
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

    function _renderScenesStrip() {
        scenesStripEl.innerHTML = '';
        const scenes = window.ProjectModel.scenes(currentProject);
        scenesStripSub.textContent = scenes.length
            ? (scenes.length + ' Scene' + (scenes.length > 1 ? 's' : ''))
            : 'No Scenes yet';
        if (!scenes.length) {
            const empty = document.createElement('span');
            empty.className = 'wb-scenes-strip-empty';
            empty.textContent = 'This World has no Scenes yet — press "Add Scene" to add its first page.';
            scenesStripEl.appendChild(empty);
        } else {
            scenes.forEach(function (scene, i) {
                scenesStripEl.appendChild(_sceneStripCard(scene, i, scenes.length));
            });
        }
        scenesStripEl.appendChild(_sceneStripAddCard());
        scenesReorderToggleBtn.classList.toggle('wb-scenes-reorder-toggle-active', scenesReorderMode);
    }

    scenesReorderToggleBtn.addEventListener('click', function () {
        scenesReorderMode = !scenesReorderMode;
        _renderScenesStrip();
    });
    scenesAddBtn.addEventListener('click', function () {
        scenesShowingTemplatePicker = true;
        _renderWorkspace();
    });

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
        workingOverlays.appendChild(_guideBox('wb-guide-holder', isQuote ? 'Quote Text Area' : 'Place Boundary', panelPct));

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
        // world-builder-v2 — modal mount. Every screen that used to be a
        // mutually-exclusive Nav tab (World Settings/Check & Build/
        // Publish/the legacy Engine V1 management screens) now mounts
        // into the shared modal instead of the permanent Context
        // Inspector column whenever `currentNav` names one of them —
        // the dispatch chain below is completely unchanged, only where
        // its output lands differs.
        const isModal = MODAL_NAVS.has(currentNav);
        modalOverlay.classList.toggle('wb-hidden', !isModal);
        if (isModal) modalTitleEl.textContent = MODAL_TITLES[currentNav] || '';
        contextPanel = isModal ? modalBody : $('wb-context-panel');
        contextPanel.innerHTML = '';
        if (currentNav === 'overview') return _renderOverviewPanel();
        // Scenes+Experiences simultaneous view — an Experience picked from
        // the new always-visible Experiences-in-this-Scene column takes
        // over Context Inspector exactly the way a Place/Decoration/Text
        // selection already does; same one Inspector, same "whatever is
        // selected" rule (Blueprint §6.1), just one more selectable kind.
        if (currentNav === 'scenes' && currentSceneId && experienceInspectorId) {
            const exp = window.ProjectModel.findExperience(currentProject, experienceInspectorId);
            if (exp) return _renderExperienceInspector(exp);
            experienceInspectorId = null; // stale reference — fall through to the normal Scene dispatch below
        }
        if (currentNav === 'scenes') return _renderScenesContextPanel();
        if (currentNav === 'experiences') return _renderExperiencesPanel();
        if (currentNav === 'representations') return _renderRepresentationsPanel();
        if (currentNav === 'layouts') return _renderLayoutsPanel();
        if (currentNav === 'frames') return _renderFramesPanel();
        if (currentNav === 'layerpacks') return _renderLayerPacksPanel();
        if (currentNav === 'assets') return _renderAssetsPanel();
        if (currentNav === 'checkbuild') return _renderCheckBuildPanel();
        if (currentNav === 'publish') return _renderPublishPanel();
        return _renderStubPanel();
    }

    // ---------- Experiences column (world-builder-v2) ----------
    // Builder Workspace Polish — Continuous Builder. Permanently visible,
    // right-side workspace column — Scenes and Experiences no longer
    // force a choice between them, and this column no longer needs a
    // Scene open at all: it's always there, beside Working View/Context
    // Inspector, whether authoring a Scene or browsing the Theme's full
    // library. Two tabs replace the old "This Scene"/"All Experiences"
    // toggle: Scene Stack (default) renders directly from the current
    // Scene's real scene.stack — the actual, authoritative composition
    // and reorder order — and Experience Library is the Theme-wide
    // collection, unfiltered by Scene, unchanged in behavior from the
    // old "All Experiences" branch.
    function _renderScenesExperiencesSidebar() {
        experiencesPanel.innerHTML = '';
        const scene = currentSceneId ? window.ProjectModel.findScene(currentProject, currentSceneId) : null;

        const tabs = document.createElement('div');
        tabs.className = 'wb-exp-scope-toggle';
        [['stack', 'Scene Stack'], ['library', 'Experience Library']].forEach(function (pair) {
            const id = pair[0], label = pair[1];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = experiencesTab === id ? 'active' : '';
            btn.textContent = label;
            btn.addEventListener('click', function () {
                experiencesTab = id;
                _renderScenesExperiencesSidebar();
            });
            tabs.appendChild(btn);
        });
        experiencesPanel.appendChild(tabs);

        if (experiencesTab === 'stack') {
            _renderSceneStackTab(scene);
        } else {
            _renderExperienceLibraryTab();
        }
    }

    // Scene Stack — renders directly from window.ProjectModel.sceneStack,
    // the real, authoritative Scene composition (Engine Canon §5): every
    // Holder and every Scene Layer, in real paint order, Holders and
    // Layers together in one list. A Holder's attached Frame Experience
    // (if any) is shown nested beneath it, read-only — it has no Stack
    // entry of its own (Frame projects onto its Place's single frame
    // slot, Engine Canon §9), so it is structurally incapable of drifting
    // out of sync with its Place: moving the Place in the Stack carries
    // it along for free, nothing to keep in sync. A Layer resolves to its
    // owning Experience by sourceExperienceId when one exists (Free- or
    // Scene-hosted); a Layer with none is a legacy, pre-Experience entry,
    // shown by its own name/kind. The bottom-most full-bleed fill Layer
    // is labelled Background — the same identity check
    // window.ProjectModel's own _bottomFillLayer uses internally.
    function _renderSceneStackTab(scene) {
        if (!scene) {
            experiencesPanel.appendChild(_fieldHelp('Open a Scene to see what belongs to it — or switch to "Experience Library" to browse the whole Theme.'));
            return;
        }
        const stack = window.ProjectModel.sceneStack(currentProject, scene.id);
        if (!stack.length) {
            experiencesPanel.appendChild(_fieldHelp('This Scene is empty — add a Place below, or press "➕ New Experience" in Experience Library.'));
            return;
        }
        stack.forEach(function (entry, index) {
            if (entry.type === 'holder') {
                const holder = (scene.holders || []).find(function (h) { return h.id === entry.id; });
                if (holder) experiencesPanel.appendChild(_sceneStackHolderRow(scene, holder, index, stack.length));
            } else {
                const layer = (scene.layers || []).find(function (l) { return l.id === entry.id; });
                if (layer) experiencesPanel.appendChild(_sceneStackLayerRow(scene, layer, index, stack.length));
            }
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-workspace-btn';
        addBtn.style.width = '100%';
        addBtn.style.marginTop = '10px';
        addBtn.textContent = '➕ Add a Place';
        addBtn.disabled = currentProjectReadOnly;
        addBtn.addEventListener('click', function () {
            const holder = window.ProjectModel.addHolder(currentProject, scene.id);
            if (holder) {
                currentInspectorTarget = 'holder:' + holder.id;
                experienceInspectorId = null;
                _persist();
                _renderWorkspace();
            }
        });
        experiencesPanel.appendChild(addBtn);
    }

    function _sceneStackHolderRow(scene, holder, index, total) {
        const wrap = document.createElement('div');

        const row = document.createElement('div');
        row.className = 'wb-exp-sidebar-row';
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-exp-sidebar-card';
        const thumb = document.createElement('span');
        thumb.className = 'wb-exp-sidebar-thumb';
        thumb.textContent = '🖼️';
        card.appendChild(thumb);
        const info = document.createElement('span');
        info.className = 'wb-exp-sidebar-info';
        const name = document.createElement('span');
        name.className = 'wb-exp-sidebar-name';
        name.textContent = holder.name;
        const meta = document.createElement('span');
        meta.className = 'wb-exp-sidebar-meta';
        meta.textContent = 'Place · ' + Math.round(holder.size.w * 100) + '% × ' + Math.round(holder.size.h * 100) + '%';
        info.appendChild(name);
        info.appendChild(meta);
        card.appendChild(info);
        card.addEventListener('click', function () {
            currentInspectorTarget = 'holder:' + holder.id;
            experienceInspectorId = null;
            _renderWorkspace();
        });
        row.appendChild(card);

        const controls = document.createElement('div');
        controls.className = 'wb-row-controls';
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'wb-row-btn';
        upBtn.title = 'Bring forward';
        upBtn.textContent = '⬆';
        // moveInStack's 'forward' is index+1 (projectModel.js) — disabled
        // only once already at the frontmost (highest-index) position.
        upBtn.disabled = currentProjectReadOnly || index === total - 1;
        upBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveInStack(currentProject, scene.id, 'holder', holder.id, 'forward');
            _persist();
            _redrawSceneCanvases(scene.id);
            _renderScenesExperiencesSidebar();
        });
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'wb-row-btn';
        downBtn.title = 'Send backward';
        downBtn.textContent = '⬇';
        // 'backward' is index-1 — disabled only once already backmost.
        downBtn.disabled = currentProjectReadOnly || index === 0;
        downBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveInStack(currentProject, scene.id, 'holder', holder.id, 'backward');
            _persist();
            _redrawSceneCanvases(scene.id);
            _renderScenesExperiencesSidebar();
        });
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        row.appendChild(controls);
        wrap.appendChild(row);

        // The attached Frame Experience, nested and read-only — it has no
        // Stack entry of its own to reorder (see this function's own
        // header comment), so no ⬆/⬇ controls are offered on it at all.
        if (holder.frame) {
            const attached = window.ProjectModel.findExperience(currentProject, holder.frame);
            if (attached) {
                const child = document.createElement('button');
                child.type = 'button';
                child.className = 'wb-exp-sidebar-card wb-scene-stack-child';
                const childThumb = document.createElement('span');
                childThumb.className = 'wb-exp-sidebar-thumb';
                const attachedProps = attached.properties || {};
                if (attachedProps.borderColor) childThumb.style.background = attachedProps.borderColor;
                else childThumb.textContent = '🖼️';
                child.appendChild(childThumb);
                const childInfo = document.createElement('span');
                childInfo.className = 'wb-exp-sidebar-info';
                const childName = document.createElement('span');
                childName.className = 'wb-exp-sidebar-name';
                childName.textContent = attached.name;
                const childMeta = document.createElement('span');
                childMeta.className = 'wb-exp-sidebar-meta';
                childMeta.textContent = 'Attached Frame';
                childInfo.appendChild(childName);
                childInfo.appendChild(childMeta);
                child.appendChild(childInfo);
                child.addEventListener('click', function () {
                    experienceInspectorId = attached.id;
                    _renderWorkspace();
                });
                wrap.appendChild(child);
            }
        }

        return wrap;
    }

    function _sceneStackLayerRow(scene, layer, index, total) {
        const isBackground = index === 0 && layer.kind === 'fill'
            && layer.position.x <= 0.01 && layer.position.y <= 0.01
            && layer.size.w >= 0.99 && layer.size.h >= 0.99;
        const owningExp = layer.sourceExperienceId ? window.ProjectModel.findExperience(currentProject, layer.sourceExperienceId) : null;

        const row = document.createElement('div');
        row.className = 'wb-exp-sidebar-row';

        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'wb-exp-sidebar-card';
        const thumb = document.createElement('span');
        thumb.className = 'wb-exp-sidebar-thumb';
        if (isBackground) {
            thumb.style.background = layer.color || '#F4F1EC';
        } else if (owningExp) {
            const props = owningExp.properties || {};
            if (props.imageSrc || props.graphicSrc) {
                const img = document.createElement('img');
                img.src = props.imageSrc || props.graphicSrc;
                img.alt = '';
                thumb.appendChild(img);
            } else if (!props.colorTransparent && props.colorValue) {
                thumb.style.background = props.colorValue;
            } else {
                thumb.textContent = '✨';
            }
        } else if (layer.kind === 'text') {
            thumb.textContent = '✍️';
        } else if (layer.image) {
            const img = document.createElement('img');
            img.src = layer.image;
            img.alt = '';
            thumb.appendChild(img);
        } else {
            thumb.textContent = layer.glyph || '✨';
        }
        card.appendChild(thumb);

        const info = document.createElement('span');
        info.className = 'wb-exp-sidebar-info';
        const name = document.createElement('span');
        name.className = 'wb-exp-sidebar-name';
        name.textContent = isBackground ? '🎨 Background' : (owningExp ? owningExp.name : layer.name);
        const meta = document.createElement('span');
        meta.className = 'wb-exp-sidebar-meta';
        meta.textContent = isBackground ? 'Background'
            : owningExp ? ('Experience · ' + _hostedByLabel(owningExp))
            : ('Legacy Layer · ' + (layer.kind === 'text' ? 'Text' : 'Decoration'));
        info.appendChild(name);
        info.appendChild(meta);
        card.appendChild(info);

        card.addEventListener('click', function () {
            if (owningExp) {
                experienceInspectorId = owningExp.id;
            } else {
                currentInspectorTarget = 'layer:' + layer.id;
                experienceInspectorId = null;
            }
            _renderWorkspace();
        });
        row.appendChild(card);

        const controls = document.createElement('div');
        controls.className = 'wb-row-controls';
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'wb-row-btn';
        upBtn.title = 'Bring forward';
        upBtn.textContent = '⬆';
        // moveInStack's 'forward' is index+1 (projectModel.js) — disabled
        // only once already at the frontmost (highest-index) position.
        upBtn.disabled = currentProjectReadOnly || index === total - 1;
        upBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveInStack(currentProject, scene.id, 'layer', layer.id, 'forward');
            _persist();
            _redrawSceneCanvases(scene.id);
            _renderScenesExperiencesSidebar();
        });
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'wb-row-btn';
        downBtn.title = 'Send backward';
        downBtn.textContent = '⬇';
        // 'backward' is index-1 — disabled only once already backmost.
        downBtn.disabled = currentProjectReadOnly || index === 0;
        downBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.ProjectModel.moveInStack(currentProject, scene.id, 'layer', layer.id, 'backward');
            _persist();
            _redrawSceneCanvases(scene.id);
            _renderScenesExperiencesSidebar();
        });
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        row.appendChild(controls);

        return row;
    }

    // Experience Library — the Theme-wide collection (Nurturing excluded,
    // same rule the Gallery itself uses), unfiltered by which Scene (if
    // any) is open. Unchanged in behavior from the old "All Experiences"
    // branch: browse, select (opens the Experience Inspector — the same
    // "Host Here"/attachment workflow every other entry point already
    // uses), or create a new one.
    function _renderExperienceLibraryTab() {
        const all = window.ProjectModel.experiences(currentProject).filter(function (e) { return e.lifecycle !== 'nurturing'; });

        if (!all.length) {
            experiencesPanel.appendChild(_fieldHelp('Nothing has joined the Theme yet — press "➕ New Experience" below to start one.'));
        }

        all.forEach(function (exp) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-exp-sidebar-card';

            const thumb = document.createElement('span');
            thumb.className = 'wb-exp-sidebar-thumb';
            const props = exp.properties || {};
            if (props.imageSrc || props.graphicSrc) {
                const img = document.createElement('img');
                img.src = props.imageSrc || props.graphicSrc;
                img.alt = '';
                thumb.appendChild(img);
            } else if (exp.type === 'frame' && props.borderColor) {
                thumb.style.background = props.borderColor;
            } else if (!props.colorTransparent && props.colorValue) {
                thumb.style.background = props.colorValue;
            } else {
                thumb.textContent = '✨';
            }
            card.appendChild(thumb);

            const info = document.createElement('span');
            info.className = 'wb-exp-sidebar-info';
            const name = document.createElement('span');
            name.className = 'wb-exp-sidebar-name';
            name.textContent = exp.name;
            const meta = document.createElement('span');
            meta.className = 'wb-exp-sidebar-meta';
            const lifecycleInfo = window.ExperienceSchema.lifecycleInfo(exp.lifecycle);
            const hereCount = exp.attachments.length;
            meta.textContent = lifecycleInfo.icon + ' ' + lifecycleInfo.label
                + (hereCount ? ' · ' + hereCount + (hereCount === 1 ? ' Host' : ' Hosts') : '');
            info.appendChild(name);
            info.appendChild(meta);
            card.appendChild(info);

            card.addEventListener('click', function () {
                experienceInspectorId = exp.id;
                _renderWorkspace();
            });

            experiencesPanel.appendChild(card);
        });

        // The one and only creation entry point for this column — opens
        // the full Experience Home (search across Gallery/Nursery, every
        // idea still growing, the richer creation form this compact
        // column deliberately doesn't duplicate) — also still how you
        // browse/reuse everything already in the Theme, the same "Manage
        // Theme Assets" bridge pattern Place's Frame picker already uses.
        const libraryLink = document.createElement('button');
        libraryLink.type = 'button';
        libraryLink.className = 'wb-workspace-btn wb-workspace-btn-primary';
        libraryLink.style.width = '100%';
        libraryLink.style.marginTop = '10px';
        libraryLink.textContent = '➕ New Experience →';
        libraryLink.addEventListener('click', function () {
            currentNav = 'experiences';
            _renderWorkspace();
        });
        experiencesPanel.appendChild(libraryLink);
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

    // ---------- Place — no Place selected: the Place list + Add (Blueprint §8) ----------
    // "Place" is the Builder-facing rename of Engine's Holder (Builder V3
    // Foundation Final) — a storytelling location, not a technical
    // container. Internal identifiers (holder, findHolder, updateHolder,
    // addHolder, deleteHolder) are unchanged by design: this is a Builder
    // authoring-language change only, not a new Engine ownership tier.

    function _renderPlacePanel(scene) {
        _heading('Place', 'Where does the photo go, how big, what shape, and how is it framed?', ICONS.place);
        contextPanel.appendChild(_stateIntroText('Click a Place in Working View to select it (drag to move, drag its corner handle to resize), or add a new one below. Add as many Places as this Scene needs.'));

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
            contextPanel.appendChild(_fieldHelp('This Scene has no Places yet — add one below.'));
        }

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
        addBtn.style.marginTop = '12px';
        addBtn.textContent = '➕ Add a Place';
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

    // ---------- Place — a Place is selected: its full property panel ----------

    function _renderHolderPanel(scene, holder) {
        _heading('Place — ' + holder.name, 'Position, size, shape, padding, fit, and Frame for this photo — plus what a Story Author is allowed to do with it.', ICONS.place);

        contextPanel.appendChild(_buildFieldGroup('Place Name', _textInput(holder.name, function (v) {
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
        }), 'Inset between the Place’s edge and its content.');

        _renderFramePicker(scene, holder);
        _renderContextualExperienceActions(scene, { sceneId: scene.id, placeId: holder.id }, {
            compatibleType: 'frame',
            defaultName: 'Frame for ' + holder.name,
            attachedExperience: holder.frame ? window.ProjectModel.findExperience(currentProject, holder.frame) : null
        });
        _renderHolderPermissionBlock(scene, holder);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wb-workspace-btn';
        removeBtn.style.marginTop = '14px';
        removeBtn.textContent = '🗑 Remove this Place';
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
        backBtn.textContent = '← All Places';
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

    // Builder V3 MEP — the legacy Frame picker (still fully functional
    // alongside Experience-first authoring, Milestone 3's own "both
    // paths side by side" decision) was writing `holder.frame` directly,
    // bypassing attachExperience/detachExperience — so switching a
    // Place's Frame here left a hosting Experience's own Usage record
    // stale (still claiming to be hosted at a Place it no longer
    // actually renders at). Fixed by routing through the real Engine
    // Adapter entry points whenever either side of the change is
    // Experience-backed, so Usage/Gallery bookkeeping can never drift
    // from what's actually on the Place, regardless of which control a
    // Theme Author used to change it.
    function _setHolderFrame(scene, holder, frameId) {
        if (holder.frame) {
            const hostingExp = window.ProjectModel.findExperience(currentProject, holder.frame);
            if (hostingExp && hostingExp.type === 'frame') {
                window.ProjectModel.detachExperience(currentProject, hostingExp.id, { sceneId: scene.id, placeId: holder.id });
            }
        }
        const newExp = frameId ? window.ProjectModel.findExperience(currentProject, frameId) : null;
        if (newExp && newExp.type === 'frame' && window.ProjectModel.attachExperience(currentProject, newExp.id, { sceneId: scene.id, placeId: holder.id })) {
            // attachExperience already set holder.frame + re-synced the mirror.
        } else {
            window.ProjectModel.updateHolder(currentProject, scene.id, holder.id, { frame: frameId });
        }
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
        input.disabled = currentProjectReadOnly;
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

        _renderContextualExperienceActions(scene, { sceneId: scene.id, placeId: null }, {
            compatibleType: 'decoration',
            defaultName: 'New Decoration',
            attachedExperience: null
        });

        // `l.kind === 'decoration'` specifically — a Scene's layers also
        // include 'fill' (Background, edited above) and 'text' (its own
        // Text activity); a broader `!== 'fill'` check here used to leak
        // Text layers into this list too.
        const decorations = (scene.layers || []).filter(function (l) { return l.kind === 'decoration'; });
        if (decorations.length) {
            const list = document.createElement('div');
            list.className = 'wb-scene-library-grid';
            decorations.forEach(function (l) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'wb-scene-template-card';
                const glyph = document.createElement('div');
                glyph.className = 'wb-scene-template-icon';
                if (l.image) {
                    const img = document.createElement('img');
                    img.src = l.image;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    glyph.appendChild(img);
                } else {
                    glyph.textContent = l.glyph;
                }
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
                // Authoring Convergence Sprint — this used to create a
                // plain Scene Layer directly (`addSceneLayer`), a second,
                // parallel path to the same enrichment an Experience
                // already covers. It now creates a real Experience
                // (Nurturing → Personal → hosted here immediately,
                // exactly like "+ Add Experience" already does elsewhere)
                // with the picked glyph rasterized into its Graphics
                // section, so every Decoration — however it was created
                // — is a real Experience underneath, never an orphan
                // Scene Layer with no Experience backing it.
                const exp = window.ProjectModel.addExperience(currentProject, {
                    name: 'Decoration', type: 'decoration', hostedBy: 'free'
                });
                window.ProjectModel.graduateToPersonal(currentProject, exp.id, scene.id);
                window.ProjectModel.updateExperienceProperty(currentProject, exp.id, 'graphicSrc', _rasterizeGlyphToDataURL(g));
                window.ProjectModel.attachExperience(currentProject, exp.id, { sceneId: scene.id, placeId: null });
                currentNav = 'experiences';
                experienceHomeZone = 'gallery';
                experienceInspectorId = exp.id;
                _persist();
                _renderNav();
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

        // Builder V3 MEP Freeze audit — same class of bug as the Text
        // Layer panel: when this Decoration is Experience-sourced,
        // renaming it here must go through the Experience itself, or
        // the name silently reverts the next time the Experience's own
        // Properties re-sync (`_mirrorSceneLayer` always writes
        // `name: experience.name`).
        contextPanel.appendChild(_buildFieldGroup('Name', _textInput(layer.name, function (v) {
            if (layer.sourceExperienceId) window.ProjectModel.updateExperience(currentProject, layer.sourceExperienceId, { name: v });
            else window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { name: v });
            _persist();
            _redrawSceneCanvases(scene.id);
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

    // The Experience variant of the shared Story-Author-permission block
    // (Blueprint §6.2) — Experience itself has no `.permissions` field
    // (js/projectModel.js's Experience shape); the real permission
    // object lives on whichever real, hosted object this Experience
    // currently projects onto in the open Scene (Place-hosted: the
    // Holder's own block, already shown in the Place panel — a Frame
    // Experience's "editable" is literally the Holder panel's "Can a
    // Story Author change this? (its Frame, once populated)" checkbox,
    // so nothing new is needed there). Scene/Free-hosted: the one real
    // mirrored Scene Layer this Experience currently has in
    // currentSceneId — "Only-one-content-type-at-a-time" guarantees at
    // most one exists per Scene, so there is never an ambiguous choice
    // of which instance's permissions to edit. Shown only once the
    // Experience is actually hosted here (a Nurturing idea, or one not
    // yet attached to the open Scene, has no real object yet to set
    // permissions on).
    function _renderExperiencePermissionBlock(exp) {
        if (exp.hostedBy === 'place') return;
        if (!currentSceneId) return;
        const slot = _experienceMirroredSlot(exp);
        const layer = window.ProjectModel.findMirroredSceneLayer(currentProject, currentSceneId, exp.id, slot);
        if (!layer || !layer.permissions) return;

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
        body.appendChild(_permissionCheckbox('Can a Story Author change this?', layer.permissions.editable, function (v) {
            layer.permissions.editable = v;
            _persist();
        }));
        body.appendChild(_permissionCheckbox('Should a Story Author see this at all?', layer.permissions.visible, function (v) {
            layer.permissions.visible = v;
            _persist();
            _redrawSceneCanvases(currentSceneId);
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

        _renderContextualExperienceActions(scene, { sceneId: scene.id, placeId: null }, {
            compatibleType: 'text',
            defaultName: 'New Text',
            attachedExperience: null
        });

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
            // Authoring Convergence Sprint — this used to create a plain
            // text Scene Layer directly, a second, parallel path to the
            // same enrichment the Experience Text section already
            // covers. It now creates a real Experience instead (Nurturing
            // → Personal → hosted here immediately), matching the
            // Decorations quick-picker's identical convergence fix.
            const exp = window.ProjectModel.addExperience(currentProject, {
                name: 'Text', type: 'text', hostedBy: 'free'
            });
            window.ProjectModel.graduateToPersonal(currentProject, exp.id, scene.id);
            window.ProjectModel.updateExperienceProperty(currentProject, exp.id, 'textContent', 'New text');
            window.ProjectModel.attachExperience(currentProject, exp.id, { sceneId: scene.id, placeId: null });
            currentNav = 'experiences';
            experienceHomeZone = 'gallery';
            experienceInspectorId = exp.id;
            _persist();
            _renderNav();
            _renderWorkspace();
        });
        contextPanel.appendChild(addBtn);
    }

    // A text element is selected: write the words directly, then style
    // them (Blueprint §10's own two-step framing).
    // Builder V3 MEP Freeze audit finding (Audit 1, a first-time-author
    // pass): clicking a Text object directly in Working View lands here
    // — the pre-Experience per-Layer editor, kept fully functional
    // alongside Experience-first authoring (Milestone 3's own "both
    // paths side by side" decision). For an ordinary, non-Experience
    // Text Layer that's fine. But when this Layer is Experience-sourced
    // (`sourceExperienceId` set — true for any Text created via
    // "+ Add Experience"), writing straight to the Layer here bypassed
    // the Experience's own `properties` entirely; the Experience's next
    // unrelated edit (from its own Inspector) re-synced the mirror from
    // its stale `properties` and silently wiped whatever had just been
    // typed here — a real data-loss bug, the same class this MEP
    // already fixed once for the legacy Frame picker (`_setHolderFrame`).
    // Fixed the same way: when Experience-sourced, these fields route
    // through `updateExperience`/`updateExperienceProperty` (which
    // re-syncs the mirror itself) instead of `updateSceneLayer` directly,
    // so both editing surfaces always agree on the one source of truth.
    function _renderTextLayerPanel(scene, layer) {
        _heading('Text — ' + layer.name, 'Write the words directly, then style them.', ICONS.text);
        const expId = layer.sourceExperienceId;

        contextPanel.appendChild(_buildFieldGroup('Name', _textInput(layer.name, function (v) {
            if (expId) window.ProjectModel.updateExperience(currentProject, expId, { name: v });
            else window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { name: v });
            _persist();
            _redrawSceneCanvases(scene.id);
        })));

        function onField(key) {
            return function (v) {
                if (expId) window.ProjectModel.updateExperienceProperty(currentProject, expId, key, v);
                else window.ProjectModel.updateSceneLayer(currentProject, scene.id, layer.id, { [key]: v });
                _persist();
                _redrawSceneCanvases(scene.id);
            };
        }

        // AV-011 — the same reusable EmojiPicker every Text Element field
        // in the main Studio app already uses (Sprint 9.6), wrapped
        // around the existing textarea rather than a second, Builder-only
        // picker: inserting an emoji just dispatches a real 'input' event
        // on the same element, so it persists through the exact save path
        // this field already had.
        const wordsInput = _textarea(layer.text, onField('text'));
        contextPanel.appendChild(_fieldGroup('Words', window.EmojiPicker ? window.EmojiPicker.wrap(wordsInput) : wordsInput));

        const fontGroup = _buildFieldGroup('Font', _select(TEXT_FONT_OPTIONS, layer.font, onField('font')));
        const alignGroup = _buildFieldGroup('Alignment', _select(TEXT_ALIGN_OPTIONS, layer.align, onField('align')));
        _fieldRow(fontGroup, alignGroup);

        const sizeGroup = _buildFieldGroup('Size', _range(16, 120, layer.fontSize, onField('fontSize')));
        const colorGroup = _buildFieldGroup('Colour', _colorInput(layer.color, onField('color')));
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

    // Aspect Ratio now lives as a real dropdown in the top bar's Scene
    // glance (_renderSceneHeader) — this panel is what shows when nothing
    // else is selected, since Scene Configuration itself has no other
    // editable field.
    function _renderSceneConfigPanel(scene) {
        _heading('Nothing selected', 'Click a Place, Decoration, or Text on the Canvas to edit it.');
        contextPanel.appendChild(_fieldHelp('This Scene is ' + window.EngineSchema.aspectInfo(scene.canvas.aspectRatio).label + ' with a ' + scene.canvas.safeArea + '. Change the shape any time from the dropdown at the top of the screen.'));
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
        input.disabled = currentProjectReadOnly;
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
        ta.disabled = currentProjectReadOnly;
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
        sel.disabled = currentProjectReadOnly;
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
        input.disabled = currentProjectReadOnly;
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
        input.disabled = currentProjectReadOnly;
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

    function _assetUploadRow(iconFallback, existingDataURL, onUpload, accept) {
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
        btn.disabled = currentProjectReadOnly;
        const input = _fileInputUpload(accept || 'image/*', onUpload);
        btn.addEventListener('click', function () { input.click(); });
        row.appendChild(thumb);
        row.appendChild(btn);
        row.appendChild(input);
        if (existingDataURL) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'wb-asset-change-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.disabled = currentProjectReadOnly;
            removeBtn.addEventListener('click', function () { onUpload(null); });
            row.appendChild(removeBtn);
        }
        return row;
    }

    // ---------- Experiences — Experience Home (Builder V3 Milestone 2) ----------
    // Two creative spaces, per docs/BUILDER_V3_EXPERIENCE_STUDIO.md: The
    // Gallery (Theme Experiences — Personal/Public, "what can I use
    // today?") and The Nursery (Nurturing ideas only, "what am I still
    // growing?"). Milestone 2 scope: the Gallery is honestly empty —
    // nothing can graduate yet, that is Milestone 3's Graduation
    // workflow — and the Nursery supports only the minimal creation
    // flow this milestone specifies (Name/Type/Intended Attachment/
    // Description) plus Delete (Canon Decision #9 — the only place
    // Delete exists). No Inspector, no attach-to-Place/Scene, no
    // Graduation, no Reuse Existing, no Usage Explorer yet — those are
    // explicitly out of this milestone's scope.

    let experienceHomeZone = 'gallery'; // 'gallery' | 'nursery'
    let experienceCreateFormOpen = false;
    let experienceInspectorId = null;
    let contextualQuickCreateOpen = false;
    let contextualReuseOpen = false;

    function _renderExperiencesPanel() {
        if (experienceInspectorId) {
            const exp = window.ProjectModel.findExperience(currentProject, experienceInspectorId);
            if (exp) return _renderExperienceInspector(exp);
            experienceInspectorId = null; // stale reference (e.g. deleted elsewhere)
        }

        _heading('Experiences', 'What enriches this World — frames, decorations, atmosphere, and more.');
        _stateIntro('experiences');

        const tabs = document.createElement('div');
        tabs.className = 'wb-experience-tabs';
        tabs.appendChild(_experienceTabButton('🖼️ Gallery', experienceHomeZone === 'gallery', function () {
            experienceHomeZone = 'gallery';
            experienceCreateFormOpen = false;
            _renderContextPanel();
        }));
        tabs.appendChild(_experienceTabButton('🌱 Nursery', experienceHomeZone === 'nursery', function () {
            experienceHomeZone = 'nursery';
            _renderContextPanel();
        }));
        contextPanel.appendChild(tabs);

        if (experienceHomeZone === 'gallery') {
            _renderExperienceGallery();
        } else {
            _renderExperienceNursery();
        }
    }

    function _experienceTabButton(label, active, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wb-experience-tab' + (active ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    // The Gallery answers "what can I use today?" — only Theme
    // Experiences (Personal or Public) ever appear here; Nurturing
    // ideas are never mixed in (Canon Decision #5).
    function _renderExperienceGallery() {
        const themeExperiences = window.ProjectModel.experiences(currentProject)
            .filter(function (e) { return e.lifecycle !== 'nurturing'; });

        if (!themeExperiences.length) {
            contextPanel.appendChild(_fieldHelp('Nothing has joined the Theme yet — grow an idea in the Nursery, then graduate it here once it feels ready.'));
            const goBtn = document.createElement('button');
            goBtn.type = 'button';
            goBtn.className = 'wb-add-btn';
            goBtn.textContent = '🌱 Go to the Nursery';
            goBtn.addEventListener('click', function () {
                experienceHomeZone = 'nursery';
                _renderContextPanel();
            });
            contextPanel.appendChild(goBtn);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'wb-scene-library-grid';
        themeExperiences.forEach(function (exp) {
            grid.appendChild(_experienceCard(exp, 'gallery'));
        });
        contextPanel.appendChild(grid);
    }

    // The Nursery answers "what am I still growing?" — Nurturing ideas
    // only, never mixed with the Gallery (Canon Decision #4). Delete
    // exists only here (Canon Decision #9).
    function _renderExperienceNursery() {
        const nurturing = window.ProjectModel.experiences(currentProject)
            .filter(function (e) { return e.lifecycle === 'nurturing'; });

        if (nurturing.length) {
            const grid = document.createElement('div');
            grid.className = 'wb-scene-library-grid';
            nurturing.forEach(function (exp) {
                grid.appendChild(_experienceCard(exp, 'nursery'));
            });
            contextPanel.appendChild(grid);
        } else {
            contextPanel.appendChild(_fieldHelp('Nothing is growing yet — every Experience starts here, as a sketch you can freely change or throw away.'));
        }

        if (experienceCreateFormOpen) {
            _renderExperienceCreateForm();
        } else {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
            addBtn.style.marginTop = '12px';
            addBtn.textContent = '➕ New Experience';
            addBtn.addEventListener('click', function () {
                experienceCreateFormOpen = true;
                _renderContextPanel();
            });
            contextPanel.appendChild(addBtn);
        }
    }

    // Short, product-language label for an Experience's Hosted By value
    // ('place'/'scene'/'free') — used anywhere a compact meta line needs
    // it, so no call site re-derives its own wording.
    function _hostedByLabel(exp) {
        if (exp.hostedBy === 'scene') return 'Scene';
        if (exp.hostedBy === 'free') return 'Free';
        return 'Place';
    }

    // The Scene Layer "slot" an Experience's active content kind mirrors
    // onto (ProjectModel._syncUniversalContent's own naming) — matches
    // the Adapter's own kind->slot mapping exactly, so a lookup here
    // finds the same Layer the Adapter just wrote.
    function _experienceMirroredSlot(exp) {
        const kind = exp.contentKind || 'text';
        if (kind === 'image') return 'image';
        if (kind === 'graphics') return 'graphic';
        if (kind === 'colour') return 'color';
        return 'text';
    }

    // Preview-first: a miniature composition, not a database row (Part
    // 4 of docs/BUILDER_V3_EXPERIENCE_STUDIO.md). Domain-sensitive —
    // Gallery cards show ownership + usage; Nursery cards deliberately
    // omit both, since neither concept exists yet for an idea that
    // hasn't graduated.
    function _experienceCard(exp, domain) {
        const card = document.createElement('div');
        card.className = 'wb-scene-card wb-experience-card';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.addEventListener('click', function () {
            experienceInspectorId = exp.id;
            // Builder V3.1 — selecting an Experience must also refresh
            // Working View (into the Experience Studio) and Runtime
            // Preview, not only the Context Inspector; `_renderContextPanel()`
            // alone left Working View showing whatever it showed a
            // moment before (the root cause of Working View never
            // actually becoming the Experience Studio).
            _renderWorkspace();
        });
        card.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); card.click(); }
        });

        // Builder V3 MEP — "Preview-first: a miniature composition, not
        // a database row" (this Part's own comment above) wasn't fully
        // true: every card showed the same generic Type icon regardless
        // of content, so a Gallery with several Frame variations or
        // Decorations was indistinguishable at a glance — exactly the
        // "natural place to discover reusable Experiences" this
        // milestone asks the Gallery to become. Frame shows its real
        // border colour (the same swatch style the legacy Frame picker
        // already uses); Decoration shows its real Image or Glyph;
        // other types keep the Type icon, which is already the most
        // meaningful preview available for them.
        const thumb = document.createElement('div');
        thumb.className = 'wb-scene-card-thumb wb-experience-card-thumb';
        const props = exp.properties || {};
        // Builder V3.1 — prefers whichever universal content section is
        // actually populated (Image, then Graphics, then Colour) so a
        // Gallery/Nursery card previews real authored content, not an
        // implementation-type icon; falls back to legacy fields (a
        // pre-existing Frame's border swatch, an unmigrated Decoration's
        // own glyph) so nothing already authored loses its preview.
        if (props.imageSrc) {
            const img = document.createElement('img');
            img.src = props.imageSrc;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            thumb.appendChild(img);
        } else if (props.graphicSrc) {
            const img = document.createElement('img');
            img.src = props.graphicSrc;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            thumb.appendChild(img);
        } else if (exp.type === 'frame' && props.borderColor) {
            thumb.style.background = props.borderColor;
        } else if (!props.colorTransparent && props.colorValue) {
            thumb.style.background = props.colorValue;
        } else if (exp.type === 'decoration' && props.glyph) {
            thumb.textContent = props.glyph;
        } else {
            thumb.textContent = '✨';
        }
        card.appendChild(thumb);

        const name = document.createElement('div');
        name.className = 'wb-scene-card-name';
        name.textContent = exp.name;
        card.appendChild(name);

        if (exp.description) {
            const desc = document.createElement('div');
            desc.className = 'wb-scene-card-sub';
            desc.textContent = exp.description;
            card.appendChild(desc);
        }

        // Builder V3.1 — the Type label is dropped from this line
        // entirely (an author never picks or sees an implementation
        // type anymore; every new Experience is internally the same
        // one, so showing it here would only ever read as noise).
        const hostedByLabel = _hostedByLabel(exp);
        const meta = document.createElement('div');
        meta.className = 'wb-experience-card-meta';
        if (domain === 'gallery') {
            const lifecycleInfo = window.ExperienceSchema.lifecycleInfo(exp.lifecycle);
            meta.textContent = 'Hosted by ' + hostedByLabel + ' · ' + lifecycleInfo.icon + ' ' + lifecycleInfo.label;
        } else {
            meta.textContent = 'Hosted by ' + hostedByLabel;
        }
        card.appendChild(meta);

        // Usage is a Gallery-only concept (Canon: ownership/usage don't
        // exist yet for a Nurturing idea) — real Hosted-By usage counts,
        // per Milestone 3's Usage Explorer.
        if (domain === 'gallery') {
            const count = window.ProjectModel.usageOf(currentProject, exp.id).length;
            const usage = document.createElement('div');
            usage.className = 'wb-scene-card-sub';
            usage.textContent = 'Used by ' + count + (count === 1 ? ' Host' : ' Hosts');
            card.appendChild(usage);
        }

        if (exp.tags && exp.tags.length) {
            const tags = document.createElement('div');
            tags.className = 'wb-experience-card-tags';
            tags.textContent = exp.tags.map(function (t) { return '#' + t; }).join(' ');
            card.appendChild(tags);
        }

        if (domain === 'nursery') {
            const controls = document.createElement('div');
            controls.className = 'wb-scene-card-controls';
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.textContent = '🗑 Delete';
            delBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (!window.confirm('Delete "' + exp.name + '"? This cannot be undone.')) return;
                window.ProjectModel.deleteExperience(currentProject, exp.id);
                _persist();
                _renderContextPanel();
            });
            controls.appendChild(delBtn);
            card.appendChild(controls);
        }

        return card;
    }

    // ---------- Experience Inspector (Builder V3 Milestone 3) ----------
    // Same Context Inspector philosophy as every other selectable object
    // (Blueprint §6.1) — no dedicated Experience workspace. A Place-
    // hosted Experience shows only identity + Properties (bounds/
    // clipping are inherited from its Host, never edited here); a Free
    // Experience also exposes Position/Rotation/Scale plus "Adjust in
    // Scene," reusing Working View exactly like every other Free/Scene-
    // level object already does (Blueprint §9's own drag-to-reposition).

    function _renderExperienceInspector(exp) {
        const lifecycleInfo = window.ExperienceSchema.lifecycleInfo(exp.lifecycle);
        // Builder V3.1 — no Type label here either (see `_experienceCard`'s
        // own identical reasoning): an author never picks or sees one.
        _heading('Experience — ' + exp.name, 'Hosted by ' + _hostedByLabel(exp), null);

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'wb-workspace-btn';
        backBtn.textContent = '← Back';
        backBtn.addEventListener('click', function () {
            experienceInspectorId = null;
            _renderWorkspace(); // Builder V3.1 — restores Working View out of the Experience Studio
        });
        contextPanel.appendChild(backBtn);

        contextPanel.appendChild(_buildFieldGroup('Name', _textInput(exp.name, function (v) {
            window.ProjectModel.updateExperience(currentProject, exp.id, { name: v });
            _persist();
        })));
        contextPanel.appendChild(_buildFieldGroup('Description', _textarea(exp.description, function (v) {
            window.ProjectModel.updateExperience(currentProject, exp.id, { description: v });
            _persist();
        })));

        _renderExperienceProperties(exp);
        _renderExperienceBounds(exp);
        _renderExperienceOwnership(exp, lifecycleInfo);

        if (exp.lifecycle !== 'nurturing') {
            _renderExperienceUsage(exp);
            _renderExperienceAttachPicker(exp);
            _renderExperiencePermissionBlock(exp);
        }

        if (exp.lifecycle === 'nurturing') {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'wb-workspace-btn';
            delBtn.style.marginTop = '14px';
            // "Delete" (not "Remove," matching Place/Decoration/Text's
            // own panel-button wording) is deliberate — this is the one
            // real deletion Canon Decision #9 allows, distinct from
            // "detach" (Used In) or "remove this Place/Decoration/Text"
            // (an object leaving a Scene, not an idea ceasing to exist).
            delBtn.textContent = '🗑 Delete this Experience';
            delBtn.addEventListener('click', function () {
                if (!window.confirm('Delete "' + exp.name + '"? This cannot be undone.')) return;
                window.ProjectModel.deleteExperience(currentProject, exp.id);
                experienceInspectorId = null;
                _persist();
                _renderWorkspace(); // Builder V3.1 — restores Working View out of the Experience Studio
            });
            contextPanel.appendChild(delBtn);
        }
    }

    const TEXT_FONT_CHOICES = [
        { value: 'Georgia, serif', label: 'Georgia' }, { value: 'Arial, sans-serif', label: 'Arial' },
        { value: '"Comic Sans MS", cursive', label: 'Comic Sans' }
    ];
    const TEXT_ALIGN_CHOICES = [
        { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }
    ];
    const TEXT_WEIGHT_CHOICES = [
        { value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' }
    ];
    const IMAGE_FIT_CHOICES = [
        { value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }, { value: 'original', label: 'Original' }
    ];

    // A section's own Transform (Move/Resize, Builder V3.1) — X/Y/Width/
    // Height as percentages, exactly the same fractional Scene-space
    // convention every other Position/Size control in this Builder
    // already uses (Place, Decorations, the pre-V3.1 Free Bounds
    // editor this supersedes).
    function _contentTransformFields(props, xKey, yKey, wKey, hKey, onProp) {
        const xGroup = _buildFieldGroup('X %', _range(0, 100, Math.round((props[xKey] || 0) * 100), function (v) { onProp(xKey)(v / 100); }));
        const yGroup = _buildFieldGroup('Y %', _range(0, 100, Math.round((props[yKey] || 0) * 100), function (v) { onProp(yKey)(v / 100); }));
        _fieldRow(xGroup, yGroup);
        const wGroup = _buildFieldGroup('Width %', _range(2, 100, Math.round((props[wKey] || 0.1) * 100), function (v) { onProp(wKey)(v / 100); }));
        const hGroup = _buildFieldGroup('Height %', _range(2, 100, Math.round((props[hKey] || 0.1) * 100), function (v) { onProp(hKey)(v / 100); }));
        _fieldRow(wGroup, hGroup);
    }

    function _contentSectionHeading(label) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = label;
        contextPanel.appendChild(heading);
    }

    // Approved "Authoring view" reference — each of Text/Image/Graphics/
    // Colour becomes its own self-contained, bordered card (icon+title
    // header) instead of one long undifferentiated scroll of fields.
    // Redirects the module-level `contextPanel` to the card body for
    // the duration of that section, the same swap-and-restore trick
    // already used for the shared modal (`_renderContextPanel`) — every
    // existing `_buildFieldGroup`/`_fieldRow`/etc. call keeps working
    // unmodified, it just lands inside the card instead of the raw
    // Inspector. Returns the outer contextPanel so the caller can
    // restore it once the section (and its foot, below) is done.
    function _openContentCard(icon, title) {
        const outer = contextPanel;
        const card = document.createElement('div');
        card.className = 'wb-content-section-card';
        const header = document.createElement('div');
        header.className = 'wb-content-section-card-header';
        const iconEl = document.createElement('span');
        iconEl.className = 'wb-content-section-card-icon';
        iconEl.textContent = icon;
        const titleEl = document.createElement('span');
        titleEl.className = 'wb-content-section-card-title';
        titleEl.textContent = title;
        header.appendChild(iconEl);
        header.appendChild(titleEl);
        card.appendChild(header);
        outer.appendChild(card);
        contextPanel = card;
        return outer;
    }

    // A compact, read-only "Hosted By / Usage / Lifecycle" summary per
    // card — deliberately no action button of any kind. This used to
    // also carry its own "Make Public" button (matching the approved
    // reference's own per-card mockup), but that duplicated the real
    // Nurturing→Personal→Public journey the Ownership section below
    // already implements in full (Graduate to Personal, which Scene it
    // belongs to, Graduate to Public, the "permanent, no reverse path"
    // messaging) — two buttons calling the identical graduateToPublic
    // action in two different places, with this one silently skipping
    // the Nurturing stage entirely, read as broken/confusing rather
    // than helpful. This card foot is now purely informational; the
    // Ownership section is the one and only place lifecycle actions
    // live. Nurturing still has no Usage concept yet (Canon: it doesn't
    // exist before graduation), so only the lifecycle line shows for a
    // still-growing idea, not a blank foot. Must be called while
    // `contextPanel` still points at the open card (i.e. before
    // restoring it via `_openContentCard`'s returned outer reference).
    function _contentCardFoot(exp) {
        const lifecycleInfo = window.ExperienceSchema.lifecycleInfo(exp.lifecycle);
        const foot = document.createElement('div');
        foot.className = 'wb-content-section-card-foot';

        if (exp.lifecycle !== 'nurturing') {
            const hostedRow = document.createElement('div');
            hostedRow.className = 'wb-content-section-card-stat';
            const hostedLabel = document.createElement('span');
            hostedLabel.textContent = 'Hosted By';
            const hostedValue = document.createElement('strong');
            hostedValue.textContent = _hostedByLabel(exp);
            hostedRow.appendChild(hostedLabel);
            hostedRow.appendChild(hostedValue);
            foot.appendChild(hostedRow);

            const usage = window.ProjectModel.usageOf(currentProject, exp.id);
            const usageRow = document.createElement('div');
            usageRow.className = 'wb-content-section-card-stat';
            const usageLabel = document.createElement('span');
            usageLabel.textContent = 'Usage';
            const usageValue = document.createElement('strong');
            usageValue.textContent = usage.length
                ? usage[0].sceneName + (usage.length > 1 ? ' +' + (usage.length - 1) : '')
                : 'Not yet used';
            usageRow.appendChild(usageLabel);
            usageRow.appendChild(usageValue);
            foot.appendChild(usageRow);
        }

        const lifecycleRow = document.createElement('div');
        lifecycleRow.className = 'wb-content-section-card-stat';
        const lifecycleLabel = document.createElement('span');
        lifecycleLabel.textContent = 'Lifecycle';
        const lifecycleValue = document.createElement('strong');
        lifecycleValue.textContent = lifecycleInfo.icon + ' ' + lifecycleInfo.label;
        lifecycleRow.appendChild(lifecycleLabel);
        lifecycleRow.appendChild(lifecycleValue);
        foot.appendChild(lifecycleRow);

        contextPanel.appendChild(foot);
    }

    // Only-one-content-type-at-a-time (a direct product simplification
    // request, superseding Builder V3.1's original "every Experience
    // exposes all four sections simultaneously, do not hide any of
    // them" instruction): `exp.contentKind` picks exactly one of Text/
    // Image/Graphics/Colour, shown as a segmented control above the
    // single matching card — switching it only changes which card is
    // visible/editable here; it never destroys the other sections' own
    // stored data, so switching back shows whatever was there before.
    // The real, Engine-level enforcement lives in
    // `ProjectModel._syncUniversalContent`'s own `kind` gate — this
    // Inspector's one-card-at-a-time display and that gate are two
    // views of the same single field, never two separate rules that
    // could drift apart. `type` still decides one thing, Engine Adapter
    // plumbing an author never sees: a legacy Frame Experience keeps
    // its own dedicated Properties (matWidth/frameThickness/
    // borderColor/wallTone/shadow — the mat/border chrome a Place's own
    // single Frame slot still needs, a concept the universal content
    // model doesn't replace) alongside whichever universal section is
    // active.
    const CONTENT_KIND_META = {
        text: { icon: '📝', label: 'Text' },
        image: { icon: '🖼', label: 'Image' },
        graphics: { icon: '🎭', label: 'Graphics' },
        colour: { icon: '🎨', label: 'Colour' }
    };
    const CONTENT_KIND_ORDER = ['text', 'image', 'graphics', 'colour'];

    function _renderContentKindSelector(exp, kind) {
        const row = document.createElement('div');
        row.className = 'wb-content-kind-selector';
        CONTENT_KIND_ORDER.forEach(function (k) {
            const meta = CONTENT_KIND_META[k];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-content-kind-btn' + (k === kind ? ' active' : '');
            btn.innerHTML = '<span>' + meta.icon + '</span>' + meta.label;
            btn.addEventListener('click', function () {
                if (k === kind) return;
                window.ProjectModel.updateExperience(currentProject, exp.id, { contentKind: k });
                _persist();
                _redrawSceneCanvasesForExperience(exp);
                _renderContextPanel();
            });
            row.appendChild(btn);
        });
        contextPanel.appendChild(row);
    }

    function _renderExperienceProperties(exp) {
        const props = exp.properties || {};
        const kind = exp.contentKind || 'text';

        // An author should always know what will be affected by an edit
        // (Builder V3 MEP — Usage completeness): a reused Experience's
        // Properties change everywhere it's hosted, silently, unless
        // said so up front — this reads the same real Usage records
        // "Used In" (below) lists, just surfaced before editing starts.
        const usageCount = window.ProjectModel.usageOf(currentProject, exp.id).length;
        if (usageCount > 1) {
            contextPanel.appendChild(_fieldHelp('Editing this updates everywhere it’s hosted — ' + usageCount + ' places right now.'));
        }

        function onProp(key) {
            return function (v) {
                window.ProjectModel.updateExperienceProperty(currentProject, exp.id, key, v);
                _persist();
                _redrawSceneCanvasesForExperience(exp);
            };
        }
        // Builder V3.1 P0 fix — an Upload/Replace/Remove action needs a
        // visible acknowledgment (a fresh thumbnail, "Replace"/"Remove"
        // appearing) the way a slider or colour swatch already shows its
        // own new value inherently; the root cause of the reported
        // "Image upload doesn't work" was that `onProp` above never
        // re-rendered this panel, so the row silently stayed on
        // "Upload" even though the Asset/Adapter/Working View/Runtime
        // Preview had already all updated correctly. Only the discrete,
        // one-shot upload actions need this — not every keystroke/drag
        // on the other Properties fields.
        function onUploadProp(key) {
            return function (v) {
                window.ProjectModel.updateExperienceProperty(currentProject, exp.id, key, v);
                _persist();
                _redrawSceneCanvasesForExperience(exp);
                _renderContextPanel();
            };
        }

        if (exp.type === 'frame') {
            _contentSectionHeading('Frame');
            _fieldRow(
                _buildFieldGroup('Mat Width', _range(0, 80, props.matWidth || 0, onProp('matWidth'))),
                _buildFieldGroup('Frame Thickness', _range(0, 20, props.frameThickness || 0, onProp('frameThickness')))
            );
            _fieldRow(
                _buildFieldGroup('Border Colour', _colorInput(props.borderColor, onProp('borderColor'))),
                _buildFieldGroup('Wall Tone', _colorInput(props.wallTone, onProp('wallTone')))
            );
            contextPanel.appendChild(_buildFieldGroup('Shadow', _select([
                { value: 'none', label: 'None' }, { value: 'soft', label: 'Soft' },
                { value: 'floating', label: 'Floating' }, { value: 'gallery', label: 'Gallery' }
            ], props.shadow || 'soft', onProp('shadow'))));
        }

        _renderContentKindSelector(exp, kind);

        // ---- 📝 Text ----
        if (kind === 'text') {
            const outer = _openContentCard('📝', 'Text');
            // AV-011's EmojiPicker (👍) — the same reusable wrap every Text
            // field already gets — carries over to the universal Text
            // section too, so this authoring path doesn't lose a capability
            // the legacy Text Layer panel already had.
            const textContentInput = _textarea(props.textContent, onProp('textContent'));
            contextPanel.appendChild(_buildFieldGroup('Content', window.EmojiPicker ? window.EmojiPicker.wrap(textContentInput) : textContentInput));
            _fieldRow(
                _buildFieldGroup('Font', _select(TEXT_FONT_CHOICES, props.textFont || 'Georgia, serif', onProp('textFont'))),
                _buildFieldGroup('Size', _range(12, 160, props.textSize || 32, onProp('textSize')))
            );
            _fieldRow(
                _buildFieldGroup('Weight', _select(TEXT_WEIGHT_CHOICES, props.textWeight || 'normal', onProp('textWeight'))),
                _buildFieldGroup('Alignment', _select(TEXT_ALIGN_CHOICES, props.textAlign || 'left', onProp('textAlign')))
            );
            _fieldRow(
                _buildFieldGroup('Colour', _colorInput(props.textColor, onProp('textColor'))),
                _buildFieldGroup('Opacity', _range(0, 100, Math.round((props.textOpacity == null ? 1 : props.textOpacity) * 100), function (v) { onProp('textOpacity')(v / 100); }))
            );
            const textTransform = document.createElement('h4');
            textTransform.className = 'wb-context-subheading';
            textTransform.style.marginTop = '8px';
            textTransform.textContent = 'Transform';
            contextPanel.appendChild(textTransform);
            _contentTransformFields(props, 'textX', 'textY', 'textW', 'textH', onProp);
            _contentCardFoot(exp);
            contextPanel = outer;
        }

        // ---- 🖼 Image ----
        if (kind === 'image') {
            const outer = _openContentCard('🖼', 'Image');
            contextPanel.appendChild(_buildFieldGroup('Photo', _assetUploadRow('🖼️', props.imageSrc, onUploadProp('imageSrc'))));
            _fieldRow(
                _buildFieldGroup('Fit', _select(IMAGE_FIT_CHOICES, props.imageFit || 'fit', onProp('imageFit'))),
                _buildFieldGroup('Opacity', _range(0, 100, Math.round((props.imageOpacity == null ? 1 : props.imageOpacity) * 100), function (v) { onProp('imageOpacity')(v / 100); }))
            );
            const imageTransform = document.createElement('h4');
            imageTransform.className = 'wb-context-subheading';
            imageTransform.style.marginTop = '8px';
            imageTransform.textContent = 'Transform';
            contextPanel.appendChild(imageTransform);
            _contentTransformFields(props, 'imageX', 'imageY', 'imageW', 'imageH', onProp);
            _contentCardFoot(exp);
            contextPanel = outer;
        }

        // ---- 🎭 Graphics ----
        if (kind === 'graphics') {
            const outer = _openContentCard('🎭', 'Graphics');
            contextPanel.appendChild(_fieldHelp('A reusable visual asset — an SVG or PNG icon or sticker.'));
            contextPanel.appendChild(_buildFieldGroup('Asset', _assetUploadRow('🎭', props.graphicSrc, onUploadProp('graphicSrc'), 'image/*,.svg,image/svg+xml')));
            contextPanel.appendChild(_buildFieldGroup('Opacity', _range(0, 100, Math.round((props.graphicOpacity == null ? 1 : props.graphicOpacity) * 100), function (v) { onProp('graphicOpacity')(v / 100); })));
            const graphicTransform = document.createElement('h4');
            graphicTransform.className = 'wb-context-subheading';
            graphicTransform.style.marginTop = '8px';
            graphicTransform.textContent = 'Transform';
            contextPanel.appendChild(graphicTransform);
            _contentTransformFields(props, 'graphicX', 'graphicY', 'graphicW', 'graphicH', onProp);
            _contentCardFoot(exp);
            contextPanel = outer;
        }

        // ---- 🎨 Colour ----
        if (kind === 'colour') {
            const outer = _openContentCard('🎨', 'Colour');
            contextPanel.appendChild(_buildFieldGroup('Colour Picker', _colorInput(props.colorValue, onProp('colorValue'))));
            contextPanel.appendChild(_buildFieldGroup('Opacity', _range(0, 100, Math.round((props.colorOpacity == null ? 1 : props.colorOpacity) * 100), function (v) { onProp('colorOpacity')(v / 100); })));
            contextPanel.appendChild(_checkboxField('Transparent (no colour fill)', !!props.colorTransparent, onProp('colorTransparent')));
            _contentCardFoot(exp);
            contextPanel = outer;
        }

        if (exp.hostedBy === 'place' && exp.type !== 'frame') {
            contextPanel.appendChild(_fieldHelp('Text/Image/Graphics/Colour don’t render when hosted by a Place yet — try Scene or Free instead.'));
        }
    }

    function _checkboxField(labelText, checked, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'wb-field-group';
        const row = document.createElement('label');
        row.className = 'wb-permission-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.disabled = currentProjectReadOnly;
        input.addEventListener('change', function () { onChange(input.checked); });
        row.appendChild(input);
        row.appendChild(document.createTextNode(labelText));
        wrap.appendChild(row);
        return wrap;
    }

    function _redrawSceneCanvasesForExperience(exp) {
        exp.attachments.forEach(function (a) { _redrawSceneCanvases(a.sceneId); });
        // Builder V3.1 — an Inspector field edit (Properties, not a
        // Working-View drag) always recomputes the Studio's crop fresh;
        // only an active drag gesture (below) needs a frozen stage.
        if (_experienceStudioShouldBeActive() && experienceInspectorId === exp.id) {
            _renderExperienceStudio(exp);
        }
    }

    // Host-aware Bounds — the Builder Canon's own rule: Hosted By
    // determines the bounds of the Experience (Builder V3.1's own
    // instruction, unchanged from Builder V3 MEP). Scene/Place hosting
    // still inherit their bounds entirely (nothing stored, nothing
    // editable here). Free hosting used to own one single editable
    // rect here — Builder V3.1 replaces that with each content
    // section's own Transform (`_renderExperienceProperties`'s Text/
    // Image/Graphics Transform groups) so Move/Resize lives with the
    // content it actually moves/resizes, rather than a separate,
    // redundant control surface.
    function _renderExperienceBounds(exp) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = 'Bounds';
        contextPanel.appendChild(heading);

        if (exp.hostedBy === 'scene') {
            contextPanel.appendChild(_fieldHelp('Inherited from Scene (read-only) — this Experience fills the whole Scene. Text/Image/Graphics can still be positioned within it using each section’s own Transform above.'));
        } else if (exp.hostedBy === 'place') {
            contextPanel.appendChild(_fieldHelp('Inherited from Place (read-only) — this Experience fills whichever Place hosts it.'));
        } else {
            contextPanel.appendChild(_fieldHelp('Free — each content section above (Text/Image/Graphics) has its own position and size (Transform), roaming the Scene independently.'));
        }
    }

    // The Creative Journey's one fork (Milestone 3): Nurturing graduates
    // directly to Personal (choosing a Scene) or straight to Public;
    // Personal may later become Public. No reverse path, ever (Canon
    // Decisions #6, #8) — this Inspector never shows a "make Personal"
    // or "return to Nursery" action for a graduated Experience.
    function _renderExperienceOwnership(exp, lifecycleInfo) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = 'Ownership';
        contextPanel.appendChild(heading);

        if (exp.lifecycle === 'nurturing') {
            contextPanel.appendChild(_fieldHelp(lifecycleInfo.icon + ' Nurturing — still growing, not yet part of the Theme.'));
            const scenes = window.ProjectModel.scenes(currentProject);
            if (scenes.length) {
                const sceneSelect = _select(scenes.map(function (s) { return { value: s.id, label: s.name }; }), scenes[0].id, function () {});
                contextPanel.appendChild(_buildFieldGroup('Graduate to Personal — belongs to', sceneSelect));
                const personalBtn = document.createElement('button');
                personalBtn.type = 'button';
                personalBtn.className = 'wb-workspace-btn';
                personalBtn.textContent = '👤 Graduate to Personal';
                personalBtn.addEventListener('click', function () {
                    window.ProjectModel.graduateToPersonal(currentProject, exp.id, sceneSelect.value);
                    _persist();
                    _renderContextPanel();
                });
                contextPanel.appendChild(personalBtn);
            } else {
                contextPanel.appendChild(_fieldHelp('Add a Scene first to graduate this Experience to Personal.'));
            }
            const publicBtn = document.createElement('button');
            publicBtn.type = 'button';
            publicBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
            publicBtn.style.marginTop = '8px';
            publicBtn.textContent = '🌍 Graduate to Public';
            publicBtn.addEventListener('click', function () {
                window.ProjectModel.graduateToPublic(currentProject, exp.id);
                _persist();
                _renderContextPanel();
            });
            contextPanel.appendChild(publicBtn);
        } else if (exp.lifecycle === 'personal') {
            const scene = window.ProjectModel.findScene(currentProject, exp.scopeSceneId);
            contextPanel.appendChild(_fieldHelp(lifecycleInfo.icon + ' Personal — belongs to ' + (scene ? scene.name : '(deleted Scene)') + '. Permanent — never deleted, never returns to the Nursery.'));
            const publicBtn = document.createElement('button');
            publicBtn.type = 'button';
            publicBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
            publicBtn.textContent = '🌍 Make Public';
            publicBtn.addEventListener('click', function () {
                window.ProjectModel.graduateToPublic(currentProject, exp.id);
                _persist();
                _renderContextPanel();
            });
            contextPanel.appendChild(publicBtn);
        } else {
            contextPanel.appendChild(_fieldHelp(lifecycleInfo.icon + ' Public — part of the Theme, reusable everywhere. Permanent — never deleted, never returns to the Nursery.'));
        }
    }

    // Usage Explorer (Milestone 3) — every Theme Experience answers
    // "where is this used," from real attachment records, each entry
    // clickable to jump straight to that Scene/Place.
    function _renderExperienceUsage(exp) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = 'Used In';
        contextPanel.appendChild(heading);

        const usage = window.ProjectModel.usageOf(currentProject, exp.id);
        if (!usage.length) {
            contextPanel.appendChild(_fieldHelp('Not used anywhere yet.'));
            return;
        }
        usage.forEach(function (u) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'wb-workspace-btn';
            row.style.display = 'block';
            row.style.width = '100%';
            row.style.textAlign = 'left';
            row.style.marginBottom = '6px';
            row.textContent = '✓ ' + u.sceneName + (u.placeName ? ' — ' + u.placeName : '') + '  (detach)';
            row.addEventListener('click', function () {
                window.ProjectModel.detachExperience(currentProject, exp.id, { sceneId: u.sceneId, placeId: u.placeId });
                _persist();
                _redrawSceneCanvases(u.sceneId);
                _renderContextPanel();
            });
            contextPanel.appendChild(row);
        });
    }

    // Host / Reuse (Milestone 3) — a Personal Experience may only host
    // within its own scopeSceneId ("belongs to one Scene only"); a
    // Public Experience may host wherever compatible. This same control
    // is what makes an Inspector opened from the Gallery double as
    // "Reuse Existing" — there is no separate reuse mechanism.
    function _renderExperienceAttachPicker(exp) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = 'Host Here';
        contextPanel.appendChild(heading);

        const allScenes = window.ProjectModel.scenes(currentProject);
        const scenes = exp.lifecycle === 'personal'
            ? allScenes.filter(function (s) { return s.id === exp.scopeSceneId; })
            : allScenes;

        if (!scenes.length) {
            contextPanel.appendChild(_fieldHelp('No Scenes available to host in.'));
            return;
        }

        // Authoring Convergence Sprint (Objective 4) — a Personal
        // Experience only ever has one Scene to choose from, and if it's
        // already hosted there with nothing further to pick (no Place
        // choice, since only Frame-type Experiences have one), this
        // section had nothing left to offer — it still showed a full
        // Scene picker + an actionable-looking "Host Here" button that
        // would only ever re-attach the exact same thing. Ownership
        // ("belongs to X"), Usage ("used in X"), and the Hosting action
        // itself are distinct concepts (this ticket's own framing) — an
        // already-fully-hosted Personal Experience has nothing left to
        // *do* here, so it says so plainly instead of implying a
        // pointless action.
        if (exp.hostedBy !== 'place' && scenes.length === 1) {
            const usage = window.ProjectModel.usageOf(currentProject, exp.id);
            if (usage.some(function (u) { return u.sceneId === scenes[0].id; })) {
                contextPanel.appendChild(_fieldHelp('Already hosted in ' + scenes[0].name + ' — nothing more to host here.'));
                return;
            }
        }

        let selectedSceneId = scenes[0].id;
        const sceneSelect = _select(scenes.map(function (s) { return { value: s.id, label: s.name }; }), selectedSceneId, function (v) {
            selectedSceneId = v;
            placeSelect.innerHTML = '';
            _populatePlaceOptions(placeSelect, selectedSceneId);
            _updateAttachButtonState();
        });
        contextPanel.appendChild(_buildFieldGroup('Scene', sceneSelect));

        const placeSelect = document.createElement('select');
        placeSelect.className = 'wb-field-select';
        placeSelect.addEventListener('change', _updateAttachButtonState);
        _populatePlaceOptions(placeSelect, selectedSceneId);
        if (exp.hostedBy === 'place') {
            contextPanel.appendChild(_buildFieldGroup('Place', placeSelect));
        }

        const attachBtn = document.createElement('button');
        attachBtn.type = 'button';
        attachBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';

        // The currently-selected Scene(+Place) target might already be
        // exactly where this Experience is hosted — re-clicking "Host
        // Here" would be a no-op that looks like a real action. Reflect
        // that plainly instead of only discovering it via a redundant
        // click.
        function _updateAttachButtonState() {
            const placeId = exp.hostedBy === 'place' ? placeSelect.value : null;
            const usage = window.ProjectModel.usageOf(currentProject, exp.id);
            const already = usage.some(function (u) { return u.sceneId === selectedSceneId && (u.placeId || null) === (placeId || null); });
            attachBtn.textContent = already ? '✓ Already Hosted Here' : '📎 Host Here';
            attachBtn.disabled = already;
            attachBtn.classList.toggle('wb-workspace-btn-primary', !already);
        }
        _updateAttachButtonState();

        attachBtn.addEventListener('click', function () {
            const placeId = exp.hostedBy === 'place' ? placeSelect.value : null;
            const ok = window.ProjectModel.attachExperience(currentProject, exp.id, { sceneId: selectedSceneId, placeId: placeId });
            if (!ok) { window.alert('Could not host here — check this Experience’s ownership scope.'); return; }
            _persist();
            _redrawSceneCanvases(selectedSceneId);
            _renderContextPanel();
        });
        contextPanel.appendChild(attachBtn);
    }

    function _populatePlaceOptions(selectEl, sceneId) {
        const scene = window.ProjectModel.findScene(currentProject, sceneId);
        const holders = scene ? scene.holders : [];
        holders.forEach(function (h) {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = h.name;
            selectEl.appendChild(opt);
        });
    }

    // ---------- Contextual Authoring (Builder V3 Milestone 3) ----------
    // Reachable from Place and Scene, per docs/BUILDER_V3_EXPERIENCE_STUDIO.md
    // — every path resolves back to the one Experience, never a copy of
    // it (Blueprint's own "no duplicate editors" rule, restated for
    // Experiences). Creating here is a deliberate convenience: a
    // Nurturing Experience cannot attach (Canon), so "+ Add Experience"
    // from a Place/Scene creates it Nurturing, then immediately
    // graduates it to Personal (scoped to this Scene) and attaches it —
    // a Theme Author clicking this wants it here, now, not a separate
    // trip to the Nursery to babysit it. "Reuse Existing" browses
    // already-Public Experiences compatible with this context and
    // attaches directly, since nothing to graduate is needed.

    function _renderContextualExperienceActions(scene, target, opts) {
        // opts: { compatibleType: 'frame'|null (null = any Free-rendering type), label }
        const heading = document.createElement('h3');
        heading.className = 'wb-context-subheading';
        heading.style.marginTop = '14px';
        heading.textContent = 'Experiences';
        contextPanel.appendChild(heading);

        if (opts.attachedExperience) {
            contextPanel.appendChild(_fieldHelp('Hosting: ' + opts.attachedExperience.name));
            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'wb-workspace-btn';
            openBtn.textContent = 'Open in Experience Home →';
            openBtn.addEventListener('click', function () {
                currentNav = 'experiences';
                experienceHomeZone = opts.attachedExperience.lifecycle === 'nurturing' ? 'nursery' : 'gallery';
                experienceInspectorId = opts.attachedExperience.id;
                _renderNav();
                _renderWorkspace();
            });
            contextPanel.appendChild(openBtn);
            return;
        }

        if (contextualQuickCreateOpen) {
            _renderContextualQuickCreateForm(scene, target, opts);
        } else {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
            addBtn.textContent = '➕ Add Experience';
            addBtn.addEventListener('click', function () {
                contextualQuickCreateOpen = true;
                contextualReuseOpen = false;
                _renderContextPanel();
            });
            contextPanel.appendChild(addBtn);
        }

        const reuseBtn = document.createElement('button');
        reuseBtn.type = 'button';
        reuseBtn.className = 'wb-workspace-btn';
        reuseBtn.style.marginTop = '6px';
        reuseBtn.textContent = 'Reuse Existing Experience';
        reuseBtn.addEventListener('click', function () {
            contextualReuseOpen = !contextualReuseOpen;
            contextualQuickCreateOpen = false;
            _renderContextPanel();
        });
        contextPanel.appendChild(reuseBtn);

        if (contextualReuseOpen) {
            _renderContextualReuseList(scene, target, opts);
        }
    }

    function _renderContextualQuickCreateForm(scene, target, opts) {
        const wrap = document.createElement('div');
        wrap.className = 'wb-field-group';
        let name = opts.defaultName || 'New Experience';
        wrap.appendChild(_buildFieldGroup('Name', _textInput(name, function (v) { name = v; })));

        const actions = document.createElement('div');
        actions.className = 'wb-experience-create-actions';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
        // Builder V3 MEP Freeze audit — the Canon Alignment Sprint's
        // Attach→Host rename (js/worldBuilderApp.js's "Host Here"
        // elsewhere) missed this one button's own label.
        saveBtn.textContent = '📎 Create & Host';
        saveBtn.addEventListener('click', function () {
            const exp = window.ProjectModel.addExperience(currentProject, {
                name: name.trim() || opts.defaultName,
                type: opts.compatibleType,
                hostedBy: target.placeId ? 'place' : 'free'
            });
            window.ProjectModel.graduateToPersonal(currentProject, exp.id, scene.id);
            window.ProjectModel.attachExperience(currentProject, exp.id, target);
            contextualQuickCreateOpen = false;
            _persist();
            _redrawSceneCanvases(scene.id);
            _renderWorkspace();
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wb-workspace-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            contextualQuickCreateOpen = false;
            _renderContextPanel();
        });
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        wrap.appendChild(actions);
        contextPanel.appendChild(wrap);
    }

    function _renderContextualReuseList(scene, target, opts) {
        const options = window.ProjectModel.experiences(currentProject).filter(function (e) {
            if (e.lifecycle !== 'public') return false;
            return opts.compatibleType ? e.type === opts.compatibleType : e.type !== 'frame';
        });
        if (!options.length) {
            contextPanel.appendChild(_fieldHelp('No compatible Public Experiences yet.'));
            return;
        }
        options.forEach(function (exp) {
            const type = window.ExperienceSchema.findType(exp.type);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wb-workspace-btn';
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.marginBottom = '6px';
            btn.textContent = type.icon + ' ' + exp.name;
            btn.addEventListener('click', function () {
                window.ProjectModel.attachExperience(currentProject, exp.id, target);
                contextualReuseOpen = false;
                _persist();
                _redrawSceneCanvases(scene.id);
                _renderWorkspace();
            });
            contextPanel.appendChild(btn);
        });
    }

    // Placeholder creation flow only (Milestone 2's own scope): Name,
    // Hosted By, Description. Always born Nurturing (Canon Decision #2)
    // — no Inspector, no Graduation here.
    //
    // Builder V3.1 Universal Experience Authoring — the Type field is
    // gone: an author never chooses an implementation type again, every
    // Experience exposes the same Text/Image/Graphics/Colour content
    // sections regardless (`_renderExperienceProperties` below).
    // Internally this always creates the Decoration implementation
    // (`window.ExperienceSchema.DEFAULT_EXPERIENCE_TYPE`) — an Engine
    // Adapter detail the author never sees.
    function _renderExperienceCreateForm() {
        const wrap = document.createElement('div');
        wrap.className = 'wb-field-group';
        wrap.style.marginTop = '12px';

        const draft = {
            name: '',
            hostedBy: window.ExperienceSchema.EXPERIENCE_HOSTS[0].value,
            description: ''
        };

        wrap.appendChild(_buildFieldGroup('Name', _textInput(draft.name, function (v) { draft.name = v; })));
        wrap.appendChild(_buildFieldGroup('Hosted By', _select(window.ExperienceSchema.EXPERIENCE_HOSTS, draft.hostedBy, function (v) { draft.hostedBy = v; })));
        wrap.appendChild(_buildFieldGroup('Description', _textarea(draft.description, function (v) { draft.description = v; })));

        const actions = document.createElement('div');
        actions.className = 'wb-experience-create-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'wb-workspace-btn wb-workspace-btn-primary';
        saveBtn.textContent = '🌱 Start Growing';
        saveBtn.addEventListener('click', function () {
            window.ProjectModel.addExperience(currentProject, {
                name: draft.name.trim() || 'New Experience',
                hostedBy: draft.hostedBy,
                description: draft.description.trim()
            });
            experienceCreateFormOpen = false;
            _persist();
            _renderContextPanel();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wb-workspace-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            experienceCreateFormOpen = false;
            _renderContextPanel();
        });

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        wrap.appendChild(actions);

        contextPanel.appendChild(wrap);
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

        // Builder V3 MEP Freeze audit finding: a Frame record can be
        // Experience-backed (`_mirrorFrame` writes `id: experience.id`,
        // so this "Manage Frames" screen and the Experience Properties
        // panel edit the exact same record by construction) — but this
        // screen was writing straight to the Frame's own fields via
        // `setFrameFieldValue`, bypassing the Experience's `properties`
        // entirely. The next unrelated Experience edit re-synced the
        // mirror from those stale `properties` and silently discarded
        // whatever had just been changed here — the same data-loss bug
        // class this milestone already found and fixed for Text/
        // Decoration. Fixed the same way: when backed by a live Frame
        // Experience, field/name edits route through
        // `updateExperienceProperty`/`updateExperience` instead.
        const backingExp = window.ProjectModel.findExperience(project, frame.id);
        const isExpBacked = !!(backingExp && backingExp.type === 'frame');

        function onFrameField(key) {
            return function (v) {
                if (isExpBacked) window.ProjectModel.updateExperienceProperty(project, frame.id, key, v);
                else window.ProjectModel.setFrameFieldValue(project, frame.id, key, v);
                _persist();
                _renderPreview();
            };
        }

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
            if (isExpBacked) window.ProjectModel.updateExperience(project, frame.id, { name: v });
            else window.ProjectModel.setFrameField(project, frame.id, 'name', v);
            _persist();
            _renderPreviewSelector();
        }));
        const wallToneGroup = _buildFieldGroup('Wall Tone (Background)', _colorInput(f.wallTone, onFrameField('wallTone')));
        _fieldRow(nameGroup, wallToneGroup);

        const borderColorGroup = _buildFieldGroup('Border Color', _colorInput(f.borderColor, onFrameField('borderColor')));
        const cornerRadiusGroup = _buildFieldGroup('Corner Radius', _range(0, 24, f.cornerRadius || 0, onFrameField('cornerRadius')));
        _fieldRow(borderColorGroup, cornerRadiusGroup);

        const shadowGroup = _buildFieldGroup('Shadow', _select([
            { value: 'none', label: 'None' },
            { value: 'soft', label: 'Soft' },
            { value: 'floating', label: 'Floating' },
            { value: 'gallery', label: 'Gallery' }
        ], f.shadow, onFrameField('shadow')));
        const insetGroup = _buildFieldGroup('Inset', _range(0, 20, f.inset || 0, onFrameField('inset')));
        _fieldRow(shadowGroup, insetGroup);

        const matWidthGroup = _buildFieldGroup('Padding (Mat Width)', _range(0, 64, f.matWidth, onFrameField('matWidth')));
        const defaultMarginGroup = _buildFieldGroup('Default Margin', _range(0, 40, f.defaultMargin || 0, onFrameField('defaultMargin')));
        _fieldRow(matWidthGroup, defaultMarginGroup);

        _fieldGroup('Thickness (Frame Thickness)', _range(0, 40, f.frameThickness, onFrameField('frameThickness')));

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
        if ((m = msg.match(/^(manifest\.thumbnail|metadata\.previewImage) references "([^"]+)" which does not exist in the project$/))) {
            return { why: 'Thumbnail and Hero Image are uploaded from Overview, not Assets — this field is set automatically once you upload one there.', fixNav: 'overview', fixLabel: 'Open Overview and upload a Thumbnail/Hero Image' };
        }
        if ((m = msg.match(/^Missing (preview\.png|thumbnail\.png) \(recommended\)$/))) {
            const label = m[1] === 'preview.png' ? 'Hero Image' : 'Thumbnail';
            return { why: 'This is the picture a creator sees for this World before opening it — Overview is where it\'s uploaded.', fixNav: 'overview', fixLabel: 'Open Overview and upload a ' + label };
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

    // Experiences (Builder V3 Milestone 3) — Nursery items are ignored
    // entirely (they aren't part of the Theme yet), matching every
    // other "Nursery items are excluded" rule this milestone specifies.
    function _renderExperienceValidationSection(findings) {
        const heading = document.createElement('h3');
        heading.className = 'wb-context-heading';
        heading.style.marginTop = '20px';
        heading.style.fontSize = '13px';
        heading.textContent = 'Experiences';
        contextPanel.appendChild(heading);

        const errors = findings.filter(function (f) { return f.level === 'error'; });
        const isValid = errors.length === 0;
        const banner = document.createElement('div');
        banner.className = 'wb-validation-status ' + (isValid ? 'pass' : 'fail');
        banner.textContent = isValid
            ? '✅ Every Experience checks out.'
            : '⚠️ ' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + ' to fix.';
        contextPanel.appendChild(banner);

        findings.forEach(function (f) {
            const detail = document.createElement('p');
            detail.className = 'wb-field-hint wb-validation-detail';
            detail.textContent = f.message;
            contextPanel.appendChild(detail);
        });
    }

    // Check & Build — Validation and Build were two separate Nav
    // destinations; merged into one screen since Build always requires
    // Validation to pass first anyway, so a Theme Author never actually
    // used them as independent stops. The two sections below keep their
    // own internal structure (and their own recursive re-render calls
    // now point at this wrapper, not at themselves, so neither section
    // ever disappears when the other one re-renders).
    function _renderCheckBuildPanel() {
        contextPanel.innerHTML = '';
        _heading('Check & Build', 'Validate this World, then build it into a real Theme.');
        _stateIntro('checkbuild');
        _renderValidationSection();
        const buildHeading = document.createElement('h3');
        buildHeading.className = 'wb-context-heading';
        buildHeading.style.marginTop = '24px';
        buildHeading.textContent = 'Build';
        contextPanel.appendChild(buildHeading);
        _renderBuildSection();
    }

    function _renderValidationSection() {
        const project = currentProject;

        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'wb-add-btn';
        runBtn.textContent = (lastValidation || lastSceneValidation || lastExperienceValidation) ? '↻ Run Validation Again' : '▶ Run Validation';
        runBtn.addEventListener('click', function () {
            runBtn.textContent = 'Validating…';
            runBtn.disabled = true;
            // Three independent validation engines, run together but
            // never merged (LOCK V2-04 — Engine V2 Validation operates
            // directly on the canonical Scene Model, no translation
            // layer, no interleaving with Engine V1's own report).
            // Experiences' is likewise its own, separate report.
            lastSceneValidation = window.EngineV2Validator.validate(project);
            lastExperienceValidation = window.ProjectModel.validateExperiences(project);
            window.ProjectCompiler.runValidation(project).then(function (result) {
                lastValidation = result;
                _renderCheckBuildPanel();
                _renderStatusPill();
            });
        });
        contextPanel.appendChild(runBtn);

        if (!lastValidation && !lastSceneValidation && !lastExperienceValidation) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Run validation to check this World against the World Project Contract.';
            contextPanel.appendChild(hint);
            return;
        }

        if (lastSceneValidation) _renderSceneValidationSection(lastSceneValidation);
        if (lastExperienceValidation) _renderExperienceValidationSection(lastExperienceValidation);
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

    function _renderBuildSection() {
        const project = currentProject;

        // Builder Convergence Sprint — a Scene converges into the same
        // Theme this button builds (builder.js's packageTheme() ->
        // convergeScenes()), so there is exactly one Build action and
        // one Published Theme; Scene count is shown here only as an
        // informational stat, never a second Build/Publish path.
        const manifest = window.ProjectModel.manifest(project);
        contextPanel.appendChild(_statCardGrid([
            ['Output File', (manifest.id || 'world') + '.vtheme'],
            ['Version', manifest.version || '1.0.0'],
            ['Scenes', String(window.ProjectModel.scenes(project).length)],
            ['Last Validation', lastValidation ? (lastValidation.isValid ? 'Passed' : 'Failed') : 'Not run yet']
        ]));

        const buildBtn = document.createElement('button');
        buildBtn.type = 'button';
        buildBtn.className = 'wb-add-btn wb-build-btn';
        buildBtn.textContent = '🎁 Build Theme';
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
                        _renderCheckBuildPanel();
                    };
                    reader.readAsDataURL(buildResult.packageFile.blob);
                } else {
                    _renderCheckBuildPanel();
                    const err = document.createElement('div');
                    err.className = 'wb-validation-status fail';
                    err.textContent = '⚠️ Build failed — fix Validation errors first.';
                    contextPanel.appendChild(err);
                }
            });
        });
        contextPanel.appendChild(buildBtn);

        if (project.lastBuild) {
            const success = document.createElement('div');
            success.className = 'wb-validation-status pass';
            success.textContent = '✓ Theme Built';
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

    function _renderPublishPanel() {
        contextPanel.innerHTML = '';
        const project = currentProject;
        _heading('Publish', 'Share your World with the world.');
        _stateIntro('publish');

        // Builder Convergence Sprint — a Scene converges into this same
        // Theme at Build time (builder.js's convergeScenes()), so
        // Publish/Export below ship Scene content automatically with no
        // separate Scene publish path — project.lastSceneBuild no
        // longer exists as an alternate published artifact.
        if (!project.lastBuild) {
            const hint = document.createElement('p');
            hint.className = 'wb-field-hint';
            hint.textContent = 'Build your Theme first — Publish always ships exactly what Build produced.';
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

        // WEP Scope Freeze — Repository Model. The WEP proves exactly one
        // authoring workflow: Builder Project -> Build Theme -> Publish to
        // Personal Repository -> Author/Test/Iterate -> Promote to
        // Official Repository -> Studio Consumption. Personal is the
        // primary, ordinary authoring environment (not an "offline mode")
        // — every Theme is published there first; Official is the
        // curated, released environment a Theme graduates into once it's
        // ready, and Promote is deliberately a *different* operation from
        // Publish, not a second copy of the same one: it never builds or
        // reads project.lastBuild again — "nothing new is created" — it
        // takes whatever is already published to Personal and copies it,
        // verbatim (Theme row + every Storage asset), into Official via
        // js/themeRepositoryClient.js's promote(). Promoting a Theme that
        // hasn't been published to Personal yet fails with a clear
        // message rather than silently building one on the spot, since
        // that would defeat the whole point of "test in Personal first."
        async function _publishToPersonal() {
            if (typeof window.ThemeRepositoryClient === 'undefined') {
                showResult('fail', '⚠️ The repository client is not available in this environment.');
                return;
            }
            const configured = await window.ThemeRepositoryClient.isConfigured();
            if (!configured) {
                showResult('fail', '⚠️ Supabase is not configured — see supabase-config.example.json.');
                return;
            }
            showResult('pending', 'Publishing…');
            try {
                const pkg = await _lastBuiltPackage(project);
                const result = await window.ThemeRepositoryClient.publish('personal', {
                    manifest: pkg.manifest, theme: pkg.theme, assetsRaw: pkg.assets
                });
                if (result && result.ok) {
                    showResult('pass', '✓ Published "' + pkg.manifest.name + '" to the Personal Repository — test it in Studio, then Promote when it\'s ready.');
                } else {
                    showResult('fail', '⚠️ Could not publish — try Building again.');
                }
            } catch (e) {
                showResult('fail', '⚠️ Publish failed: ' + ((e && e.message) || 'unknown error'));
            }
        }

        async function _promoteToOfficial() {
            if (typeof window.ThemeRepositoryClient === 'undefined') {
                showResult('fail', '⚠️ The repository client is not available in this environment.');
                return;
            }
            const configured = await window.ThemeRepositoryClient.isConfigured();
            if (!configured) {
                showResult('fail', '⚠️ Supabase is not configured — see supabase-config.example.json.');
                return;
            }
            showResult('pending', 'Promoting…');
            try {
                const manifest = window.ProjectModel.manifest(project);
                const result = await window.ThemeRepositoryClient.promote(manifest.id);
                if (result && result.ok) {
                    showResult('pass', '✓ Promoted "' + (result.name || manifest.name) + '" to the Official Repository — visible to every VihuStudio reader.');
                } else if (result && result.reason === 'not_published_to_personal') {
                    showResult('fail', '⚠️ Publish to the Personal Repository first — Promote copies a Theme that\'s already there, it doesn\'t build a new one.');
                } else {
                    showResult('fail', '⚠️ Could not promote — try again.');
                }
            } catch (e) {
                showResult('fail', '⚠️ Promote failed: ' + ((e && e.message) || 'unknown error'));
            }
        }

        function _publishCard(opt) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wb-publish-option';
            card.disabled = !opt.action;
            card.innerHTML =
                '<span class="wb-publish-icon">' + opt.icon + '</span>' +
                '<span class="wb-publish-text"><span class="wb-publish-title">' + opt.title + '</span>' +
                '<span class="wb-publish-note">' + opt.note + '</span></span>';
            if (opt.action) card.addEventListener('click', opt.action);
            return card;
        }

        // Publish — installs into the Personal Repository, the primary
        // WEP authoring step, listed first. Community/Marketplace/Import
        // are out of WEP scope; no disabled placeholder is shown for
        // them — this screen only exposes completed workflows.
        const publishHeading = document.createElement('h3');
        publishHeading.className = 'wb-context-heading';
        publishHeading.style.marginTop = '4px';
        publishHeading.style.fontSize = '13px';
        publishHeading.textContent = 'Publish';
        contextPanel.appendChild(publishHeading);

        const publishGrid = document.createElement('div');
        publishGrid.className = 'wb-publish-grid';
        publishGrid.appendChild(_publishCard({
            icon: '📁', title: 'Publish to Personal Repository', note: 'Your working environment — installs this Theme so you can test and iterate in Studio. Publishing again replaces the previously published Theme; there is no version history.',
            action: _publishToPersonal
        }));
        contextPanel.appendChild(publishGrid);

        // Promote — a distinct, later step: takes what's already in the
        // Personal Repository and copies it into Official, once it's
        // been tested and is ready for release.
        const promoteHeading = document.createElement('h3');
        promoteHeading.className = 'wb-context-heading';
        promoteHeading.style.marginTop = '20px';
        promoteHeading.style.fontSize = '13px';
        promoteHeading.textContent = 'Promote';
        contextPanel.appendChild(promoteHeading);

        const promoteGrid = document.createElement('div');
        promoteGrid.className = 'wb-publish-grid';
        promoteGrid.appendChild(_publishCard({
            icon: '🏛️', title: 'Promote to Official Repository', note: 'Copies the Theme already published to your Personal Repository into Official, once it\'s tested and ready — visible to every VihuStudio reader. Promoting again replaces the previously promoted Theme; there is no version history.',
            action: _promoteToOfficial
        }));
        contextPanel.appendChild(promoteGrid);

        // Export — portability/backup, not part of the primary WEP
        // authoring workflow. Export never installs into a Repository.
        const exportHeading = document.createElement('h3');
        exportHeading.className = 'wb-context-heading';
        exportHeading.style.marginTop = '20px';
        exportHeading.style.fontSize = '13px';
        exportHeading.textContent = 'Export';
        contextPanel.appendChild(exportHeading);

        const exportGrid = document.createElement('div');
        exportGrid.className = 'wb-publish-grid';
        exportGrid.appendChild(_publishCard({
            icon: '💾', title: 'Export .vtheme Package', note: 'Downloads a portable .vtheme package to your computer, for backup or future interoperability. Not part of the primary Publish -> Promote workflow, and Export never installs into a Repository.',
            action: function () { _downloadDataURL(project.lastBuild.dataURL, project.lastBuild.filename); }
        }));
        contextPanel.appendChild(exportGrid);

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
