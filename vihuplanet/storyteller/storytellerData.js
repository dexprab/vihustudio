// storytellerData.js — Chapter 2 registry of storytellers.
//
// The Contract's Storyteller Data Contract requires a single source
// of truth for storyteller entries, with no inline JSON in HTML.
// Adding a new storyteller = one more `Storyteller.register()` call
// here. No UI changes needed anywhere else.
//
// Descriptor shape (matches the Storyteller Registry spec):
//
//   Storyteller.register({
//     id:         'vihaan',
//     name:       'Vihaan',
//     avatar:     'assets/avatars/vihaan.svg',
//     themeColor: '#5FB3FF',        // ring + name accent
//     accent:     '#FFD166',        // twinkle stars on select
//     enabled:    true               // future storytellers can ship
//                                    // disabled and be toggled on
//   });
//
// The 'add' descriptor is a special-cased "Add Storyteller" tile.
// It carries `kind: 'add'` so StorytellerManager can render its
// distinct plus-icon treatment without hardcoding IDs.

(function () {
  'use strict';
  if (typeof Storyteller === 'undefined') return;

  Storyteller.register({
    id:         'vihaan',
    name:       'Vihaan',
    avatar:     'assets/avatars/vihaan.svg',
    themeColor: '#5FB3FF',
    accent:     '#FFD166',
    enabled:    true
  });

  Storyteller.register({
    id:         'myra',
    name:       'Myra',
    avatar:     'assets/avatars/myra.svg',
    themeColor: '#FF7BA7',
    accent:     '#FFE8BA',
    enabled:    true
  });

  Storyteller.register({
    id:         'vilo',
    name:       'Vilo',
    avatar:     'assets/avatars/vilo.svg',
    themeColor: '#9B7BFF',
    accent:     '#D6B3FF',
    enabled:    true
  });

  // Add Storyteller — special tile. Carries kind:'add' so the
  // manager renders the "+" treatment instead of an avatar image.
  Storyteller.register({
    id:         'add',
    name:       'Add Storyteller',
    kind:       'add',
    themeColor: '#B8A5EA',
    accent:     '#F0E8FF',
    enabled:    true
  });
})();
