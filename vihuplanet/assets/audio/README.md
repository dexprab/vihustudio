# Hero Audio — placeholder sounds

Every file here is a **placeholder**, generated procedurally to prove
`js/heroAudio.js`'s loading path works end to end. None of them are
real recordings — replace them with real audio and nothing else
needs to change: same filename, same folder, `js/heroAudio.js` picks
it up automatically (same replace-in-place workflow the World
Library uses for images).

Format: 44.1kHz mono WAV. You can hand me a different format (mp3,
ogg) instead — just say so and I'll update the one line in
`js/heroAudio.js` that names the file extension.

## Files to replace

| File | Used for | Target character (Hero Premium Pass, Part 2) | Max duration |
|---|---|---|---|
| `story-world-click.wav` | Clicking any Story World | Soft paper touch — a watercolor page, a cloth-covered book. Handcrafted, organic, low volume. | 250ms |
| `dreaming-home-click.wav` | Clicking the Dreaming Home | Warm wooden touch with a subtle creak. Never theatrical. | 250ms |
| `telescope-click.wav` | Clicking the telescope | Tiny brass movement — very subtle. | 250ms |
| `transition-page-turn.wav` | Not wired to anything yet — reserved for entering a Story World, which doesn't exist as a feature yet (Chapter 3) | A gentle page turn. | — |
| `transition-breeze.wav` | Same — reserved, unwired | A light magical breeze. | — |

## Rules this is designed to satisfy

- No hover sounds — only these five clips exist, and only clicks trigger them.
- No looping ambience, no background music.
- Nothing should exceed 250ms for the three click sounds.
- Nothing should sound like software — the placeholders are an honest
  stand-in for this, not a claim that synthesized audio meets the bar.

## How to replace

1. Record or source the real sound.
2. Export/convert to WAV (or tell me the format you're using).
3. Drop it in this folder with the exact filename from the table above.
4. Reload the Hero — no code change needed.
