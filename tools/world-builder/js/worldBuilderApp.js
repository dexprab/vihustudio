// js/worldBuilderApp.js — Sprint B1.0. Wires Screen 1 (Welcome) and
// Screen 2 (Choose a Template) together. This is the entire Builder
// application this sprint — no router, no state machine, no dashboard
// machinery survives from tools/theme-builder (docs/WORLD_BUILDER_
// ARCHITECTURE.md, LOCK 01/04). Picking a template is the only
// interaction Screen 2 offers; there is no wizard step in between.
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    const screenWelcome = $('wb-screen-welcome');
    const screenTemplates = $('wb-screen-templates');
    const myWorldsList = $('wb-my-worlds-list');
    const myWorldsEmpty = $('wb-my-worlds-empty');
    const templateGrid = $('wb-template-grid');

    function showWelcome() {
        screenTemplates.classList.add('wb-hidden');
        screenWelcome.classList.remove('wb-hidden');
        renderMyWorlds();
    }

    function showTemplates() {
        screenWelcome.classList.add('wb-hidden');
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

    function _projectCard(project) {
        const card = document.createElement('div');
        card.className = 'wb-project-card';

        const top = document.createElement('div');
        top.className = 'wb-project-card-top';

        const icon = document.createElement('span');
        icon.className = 'wb-project-icon';
        icon.textContent = project.icon || '🌎';

        const name = document.createElement('span');
        name.className = 'wb-project-name';
        name.textContent = project.name;

        top.appendChild(icon);
        top.appendChild(name);

        const tagline = document.createElement('p');
        tagline.className = 'wb-project-tagline';
        tagline.textContent = project.tagline || '';

        const meta = document.createElement('div');
        meta.className = 'wb-project-meta';

        const status = document.createElement('span');
        status.className = 'wb-project-status';
        status.textContent = project.status || 'draft';

        const updated = document.createElement('span');
        updated.className = 'wb-project-updated';
        updated.textContent = _timeAgo(project.updatedAt);

        meta.appendChild(status);
        meta.appendChild(updated);

        card.appendChild(top);
        card.appendChild(tagline);
        card.appendChild(meta);
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

        card.appendChild(icon);
        card.appendChild(title);

        card.addEventListener('click', function () {
            if (card.classList.contains('wb-busy')) return;
            card.classList.add('wb-busy');
            const generated = window.WorldTemplates.generate(entry.id);
            if (!generated) { card.classList.remove('wb-busy'); return; }
            window.ProjectStore.create(entry.id, generated);
            showWelcome();
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

    renderTemplateGrid();
    renderMyWorlds();
})();
