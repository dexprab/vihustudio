// templates.js — the six starting points on Screen 2, and what each one
// generates into a complete, valid World Project (docs/WORLD_PROJECT_CONTRACT.md,
// LOCK 03 — "a New World is born valid"). The creator never sees any of
// this data directly; picking a card is the entire interaction.
const WorldTemplates = (function () {
  'use strict';

  function _slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function _uid() {
    return Math.random().toString(36).slice(2, 8);
  }

  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

  // Sprint B2.0 fix: `name` is a **required** Layout field
  // (docs/THEME_PROJECT_SPEC.md §5) — the pre-B2.0 shape (`{id, aspect}`
  // only) would fail the real validator.js the instant Validation ran
  // for real (Sprint B1.0/B1.1 never exercised it). See
  // FIRST_OFFICIAL_WORLD_REPORT.md, "Platform gaps discovered."
  function _layout(id, name, aspect, description) {
    return { id: id, name: name, aspect: aspect, description: description || '' };
  }

  // Sprint B2.0 fix: a Frame Variation's presentation fields live under
  // a nested `fields` object (docs/THEME_PROJECT_SPEC.md §6), not flat
  // on the entry itself — the pre-B2.0 shape put them flat, which
  // `builder.js`/`validator.js` don't reject (neither enforces `fields`
  // nesting) but which the runtime's own frame-variation resolver
  // (`renderer/slideRenderer.js`) reads from `.fields`, so a flat shape
  // would compile "successfully" yet silently fail to apply at render
  // time. See FIRST_OFFICIAL_WORLD_REPORT.md.
  function _frame(id, name, description, fields) {
    return { id: id, name: name, description: description || '', fields: fields || {} };
  }

  function _representation(id, name, description, thumbnail, layout, defaultFrame) {
    return {
      id: id,
      name: name,
      description: description,
      thumbnail: thumbnail,
      layout: layout,
      defaultFrame: defaultFrame || null,
      defaultLayerPack: null,
      background: null,
      actions: []
    };
  }

  // Every template shares the same manifest/metadata shape — only the
  // creative specifics differ. Building it once here means a new
  // template is just new creative content, never new plumbing.
  function _buildCommon(spec) {
    const id = _slug(spec.name) + '-' + _uid();
    const today = _today();

    const manifest = {
      id: id,
      name: spec.name,
      version: '1.0.0',
      builderVersion: '1.0.0',
      minStudioVersion: '9.5.0',
      author: 'You',
      category: 'Community',
      tags: spec.tags || [],
      description: spec.tagline,
      thumbnail: 'thumbnail.png',
      createdDate: today,
      updatedDate: today,
      type: spec.type
    };

    const metadata = {
      displayName: spec.name,
      description: spec.description,
      category: 'Community',
      purpose: spec.purpose,
      mood: spec.mood,
      bestFor: spec.bestFor || [],
      notRecommendedFor: [],
      themeIcon: spec.icon,
      previewImage: null
    };

    const theme = Object.assign({
      id: id,
      name: spec.name,
      supportedCreationTypes: spec.supportedCreationTypes
    }, spec.themeFields);

    const files = {
      'README.md': '# ' + spec.name + '\n\n' + spec.tagline + '\n\n' + spec.description + '\n',
      'manifest.json': manifest,
      'metadata.json': metadata,
      'theme.json': theme,
      'docs/WORLD_SPEC.md': [
        '# ' + spec.name + ' — World Spec',
        '',
        '## Purpose', spec.purpose,
        '', '## Mood', spec.mood,
        '', '## Best For', (spec.bestFor || []).map(function (b) { return '- ' + b; }).join('\n') || '- (not set yet)',
        ''
      ].join('\n'),
      'docs/WORLD_ASSET_SPEC.md': [
        '# ' + spec.name + ' — World Asset Spec',
        '',
        'Every asset below is a starter placeholder from the "' + spec.name + '" template.',
        'Nothing here is final — replace any of it visually once the Builder',
        'Workspace exists.',
        '',
        '## Layouts', spec.layouts.map(function (l) { return '- ' + l.id + ' (' + l.aspect + ')'; }).join('\n'),
        '', '## Frame Variations', spec.frames.map(function (f) { return '- ' + f.name; }).join('\n'),
        '', '## Representations', (spec.representations || []).map(function (r) { return '- ' + r.name; }).join('\n') || '- (none yet)',
        ''
      ].join('\n')
    };

    spec.layouts.forEach(function (l) { files['layouts/' + l.id + '.json'] = l; });
    spec.frames.forEach(function (f) { files['frames/' + f.id + '.json'] = f; });
    files['layer-packs/basic.json'] = spec.layerPack || [];
    if (spec.representations && spec.representations.length) {
      files['representations/all.json'] = spec.representations;
    }

    return {
      name: spec.name,
      tagline: spec.tagline,
      description: spec.description,
      icon: spec.icon,
      files: files
    };
  }

  const TEMPLATES = [
    {
      id: 'artwork-gallery',
      title: 'Artwork Gallery',
      icon: '🖼️',
      blurb: 'Showcase paintings, drawings and photography beautifully.',
      spec: {
        name: 'My Artwork Gallery',
        tagline: 'A world to showcase art and creativity.',
        description: 'A beautiful gallery style world for artwork, stories and creative expressions.',
        purpose: 'Present a child’s artwork like a professional gallery exhibition.',
        mood: 'Calm, refined, quietly proud.',
        bestFor: ['Fine art & paintings', 'Photography', 'Portraits'],
        icon: '🖼️',
        type: 'artwork',
        supportedCreationTypes: ['artwork'],
        tags: ['gallery', 'art'],
        themeFields: { presentation: 'gallery', caption: 'none', enhancement: [] },
        layouts: [
          _layout('landscape', 'Landscape', 'landscape', 'The classic gallery wall — a wide picture, caption below.'),
          _layout('portrait', 'Portrait', 'portrait', 'Tall and centered, like a framed portrait.'),
          _layout('quote', 'Quote', 'quote', 'No picture — a centered quote, beautifully set.')
        ],
        frames: [_frame('classic-white', 'Classic White', 'A clean white mat, always in style.', { matWidth: 24, frameThickness: 10, borderColor: '#FFFFFF', wallTone: '#F4F1EC' })],
        layerPack: [],
        representations: [
          _representation('showcase', 'Showcase', 'Big and bold — the classic gallery look.', '🖼️', 'landscape', 'classic-white'),
          _representation('portrait', 'Portrait', 'Tall and centered, like a framed portrait.', '🧍', 'portrait', 'classic-white'),
          _representation('quote', 'Quote', 'Just your words, beautifully centered.', '💬', 'quote', null)
        ]
      }
    },
    {
      id: 'storybook',
      title: 'Storybook',
      icon: '📖',
      blurb: 'Tell a story, page by page, with warmth and wonder.',
      spec: {
        name: 'My Storybook',
        tagline: 'A world for telling stories, page by page.',
        description: 'A warm, traditional storybook world for narrative adventures.',
        purpose: 'Tell a story a page at a time, cover to ending.',
        mood: 'Warm, rounded, friendly.',
        bestFor: ['Bedtime stories', 'Fairy tales', 'Adventures'],
        icon: '📖',
        type: 'story',
        supportedCreationTypes: ['story'],
        tags: ['story', 'book'],
        themeFields: {
          frame: { color: '#1D3457' },
          panel: { color: '#FFFFFF' },
          storyText: { font: 'Georgia, serif', size: 56, color: '#FFFFFF' },
          footerText: { font: 'Georgia, serif', size: 24, color: '#FFFFFF' },
          watermark: { font: 'Georgia, serif', size: 24, color: '#FFFFFF' }
        },
        layouts: [_layout('classic', 'Classic', 'portrait', 'A single storybook page.')],
        frames: [_frame('classic', 'Classic', 'A simple book-page frame.', { frameThickness: 8 })],
        layerPack: [],
        representations: [
          _representation('cover', 'Cover', 'Your story’s opening page.', '📕', 'classic', 'classic'),
          _representation('story', 'Story', 'A page of your story.', '📖', 'classic', 'classic'),
          _representation('ending', 'Ending', 'How your story wraps up.', '🏁', 'classic', 'classic')
        ]
      }
    },
    {
      id: 'quotes',
      title: 'Quotes',
      icon: '💬',
      blurb: 'Turn your favorite words into elegant, shareable art.',
      spec: {
        name: 'My Quotes',
        tagline: 'Art is my voice.',
        description: 'A world for turning favorite words into beautiful, shareable art.',
        purpose: 'Turn a favorite quote, poem, or saying into elegant art.',
        mood: 'Elegant, quiet, expressive.',
        bestFor: ['Quotes', 'Poems', 'Certificates'],
        icon: '💬',
        type: 'artwork',
        supportedCreationTypes: ['quote'],
        tags: ['quote', 'words'],
        themeFields: { presentation: 'gallery', caption: 'none', enhancement: [] },
        layouts: [_layout('quote', 'Quote', 'quote', 'No picture — a centered quote, beautifully set.')],
        frames: [_frame('simple', 'Simple', 'A plain, quiet mat.', { matWidth: 16, frameThickness: 0, borderColor: '#FFFFFF', wallTone: '#FFFFFF' })],
        layerPack: [],
        representations: [
          _representation('quote', 'Quote', 'Just your words, beautifully centered.', '💬', 'quote', 'simple')
        ]
      }
    },
    {
      id: 'sketchbook',
      title: 'Sketchbook',
      icon: '✏️',
      blurb: 'Share sketches and drafts, just as they are.',
      spec: {
        name: 'My Sketchbook',
        tagline: 'A world for sketches, doodles, and drafts.',
        description: 'A relaxed, hand-drawn world for works in progress.',
        purpose: 'Show sketches and drafts exactly as they are — unpolished and honest.',
        mood: 'Playful, informal, hand-made.',
        bestFor: ['Sketches', 'Doodles', 'Drafts'],
        icon: '✏️',
        type: 'artwork',
        supportedCreationTypes: ['artwork'],
        tags: ['sketch', 'draft'],
        themeFields: { presentation: 'gallery', caption: 'none', enhancement: [] },
        layouts: [
          _layout('landscape', 'Landscape', 'landscape', 'Wide and casual, like an open sketchbook.'),
          _layout('portrait', 'Portrait', 'portrait', 'Tall and centered.')
        ],
        frames: [_frame('kraft', 'Kraft Paper', 'A warm, hand-made paper mat.', { matWidth: 12, frameThickness: 4, borderColor: '#C9B79C', wallTone: '#EFE7D8' })],
        layerPack: [],
        representations: [
          _representation('sketch', 'Sketch', 'Wide and casual, like an open sketchbook.', '✏️', 'landscape', 'kraft'),
          _representation('portrait', 'Portrait', 'Tall and centered.', '🧍', 'portrait', 'kraft')
        ]
      }
    },
    {
      id: 'greeting-cards',
      title: 'Greeting Cards',
      icon: '❤️',
      blurb: 'Make a heartfelt card for someone special.',
      spec: {
        name: 'My Greeting Cards',
        tagline: 'A world for cards made with love.',
        description: 'A warm world for creating cards for the people you care about.',
        purpose: 'Make a greeting card for someone special.',
        mood: 'Warm, celebratory, personal.',
        bestFor: ['Birthdays', 'Holidays', 'Thank-you notes'],
        icon: '❤️',
        type: 'artwork',
        supportedCreationTypes: ['card'],
        tags: ['card', 'greeting'],
        themeFields: { presentation: 'gallery', caption: 'none', enhancement: [] },
        layouts: [_layout('portrait', 'Portrait', 'portrait', 'A card-shaped page, ready for a message.')],
        frames: [_frame('festive', 'Festive', 'A soft, celebratory mat.', { matWidth: 10, frameThickness: 6, borderColor: '#E8B4B8', wallTone: '#FFF6F2' })],
        layerPack: [],
        representations: [
          _representation('card', 'Card', 'A card-shaped page, ready for a message.', '💌', 'portrait', 'festive')
        ]
      }
    },
    {
      id: 'blank',
      title: 'Blank World',
      icon: '➕',
      blurb: 'Start from nothing and make it your own.',
      spec: {
        name: 'My Blank World',
        tagline: 'Start from nothing and make it your own.',
        description: 'The simplest possible starting point — one layout, one frame, no assumptions.',
        purpose: 'A minimal starting point for a completely original World.',
        mood: 'Open, unwritten.',
        bestFor: [],
        icon: '➕',
        type: 'story',
        supportedCreationTypes: [],
        tags: [],
        themeFields: {
          frame: { color: '#1D3457' },
          panel: { color: '#FFFFFF' },
          storyText: { font: 'Georgia, serif', size: 48, color: '#FFFFFF' },
          footerText: { font: 'Georgia, serif', size: 20, color: '#FFFFFF' },
          watermark: { font: 'Georgia, serif', size: 20, color: '#FFFFFF' }
        },
        layouts: [_layout('default', 'Default', 'portrait', 'A single blank page.')],
        frames: [_frame('plain', 'Plain', 'No border at all.', { frameThickness: 0 })],
        layerPack: [],
        representations: []
      }
    }
  ];

  function list() {
    return TEMPLATES.map(function (t) { return { id: t.id, title: t.title, icon: t.icon, blurb: t.blurb }; });
  }

  function generate(templateId) {
    const entry = TEMPLATES.find(function (t) { return t.id === templateId; });
    if (!entry) return null;
    return _buildCommon(entry.spec);
  }

  return { list: list, generate: generate };
})();
try { window.WorldTemplates = WorldTemplates; } catch (e) {}
