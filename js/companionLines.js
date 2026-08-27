// js/companionLines.js — the twenty system-owned Companion lines.
//
// Ten for arriving, ten for leaving. They were authored in Sprint 1.1
// for the Ether's World Host (CLAUDE.md -> Decision 26) and lived
// inside js/etherHost.js, which is where the only thing that spoke
// them was. Sprint 1J gives the Studio a deterministic sense of
// arrival, and an arrival needs the same words.
//
// SO THEY MOVED, AND THEY DID NOT CHANGE. Not one line was rewritten,
// reordered, added to or removed; js/etherHost.js reads them from here
// and behaves exactly as it did. There is now ONE copy of a piece of
// authored product content that two surfaces speak, rather than one
// surface owning it and another quietly growing a second set that
// drifts.
//
// ---------------------------------------------------------------
// WHAT THESE LINES MAY NEVER BE
//
// Decision 26's rules bind every one of them, in the Ether and in the
// Studio alike:
//
//   · NOT A NARRATOR. No line describes a Story, explains one, or
//     refers to what is on the page.
//   · NO TRAVELLER MEMORY. Nothing says "back", "again" or "remember".
//     The Ether knows a Story, its owner and that owner's Companion,
//     and nothing else, so a line claiming to have met this person
//     before would be a lie. In the Studio a return CAN be proved —
//     but it is proved by VihuPlanet's own records, and the line
//     chosen for it is still one of these ten, still making no claim
//     of its own.
//   · NO EMOTIONAL DEPENDENCY. Never "don't leave me", "I'll miss
//     you", "please come back". The test the whole set is held to:
//     would this line still be kind if the child never came back?
//
// The suites check the first two mechanically. The third is why there
// is no eleventh farewell.
//
// ---------------------------------------------------------------
// THE DEFAULTS ARE INDEX 0
//
// DEFAULT_OPENING and DEFAULT_FAREWELL are the canonical fallbacks
// named by Decision 26, and they are the first entry of each library
// rather than separate literals, so "the default" and "the first one"
// cannot drift apart.
const CompanionLines = (function () {
  'use strict';

  const OPENING = [
    { text: 'Hey… you\'re here.',                       emotion: 'happy'     },
    { text: 'Oh! Ready to see what\'s here?',           emotion: 'curious'   },
    { text: 'Come on… let\'s explore.',                 emotion: 'warm'      },
    { text: 'I wonder what we\'ll find.',               emotion: 'curious'   },
    { text: 'Ooh… this looks interesting.',             emotion: 'curious'   },
    { text: 'Something magical is waiting.',            emotion: 'warm'      },
    { text: 'Come along… the story\'s about to begin.', emotion: 'gentle'    },
    { text: 'Oh! I think we\'re going to like this.',   emotion: 'happy'     },
    { text: 'Shhh… look around.',                       emotion: 'whisper'   },
    { text: 'Ready? Let\'s go.',                        emotion: 'happy'     }
  ];

  const FAREWELL = [
    { text: 'That was a lovely story.',                 emotion: 'warm'      },
    { text: 'Wow… what an adventure!',                  emotion: 'celebrate' },
    { text: 'And that\'s where our story ends.',        emotion: 'gentle'    },
    { text: 'What a wonderful little adventure.',       emotion: 'warm'      },
    { text: 'I wonder what happens next…',              emotion: 'curious'   },
    { text: 'That was fun!',                            emotion: 'happy'     },
    { text: 'Thanks for coming along.',                 emotion: 'warm'      },
    { text: 'And so… the story comes to an end.',       emotion: 'gentle'    },
    { text: 'The story\'s resting now.',                emotion: 'gentle'    },
    { text: 'See you in the next story.',               emotion: 'warm'      }
  ];

  const DEFAULT_OPENING  = OPENING[0];
  const DEFAULT_FAREWELL = FAREWELL[0];

  const api = {
    OPENING: OPENING,
    FAREWELL: FAREWELL,
    DEFAULT_OPENING: DEFAULT_OPENING,
    DEFAULT_FAREWELL: DEFAULT_FAREWELL
  };
  try { window.CompanionLines = api; } catch (e) {}
  return api;
})();
