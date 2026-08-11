# Rite stage artwork

The background behind Studio Rite screens 1 and 2 — the two screens that
play full-screen, before the Rite moves into the live Studio.

## The file

Drop **one** image in here named `stage`, with any of these extensions:

    stage.webp   (preferred — smallest)
    stage.jpg
    stage.png

`js/studioRite.js` tries them in that order and uses the first that
loads, so no conversion is needed to see it working.

**If no file is present nothing breaks.** The Rite keeps its original
gradient (`#171034 → #372a63 → #7c5c86 → #dd9c62 → #f6ce8c`). That
fallback is deliberate and must stay: the Rite is a mandatory gate on a
child's first run, so a missing or slow asset can never be allowed to
show them an empty screen.

## What the art has to do

- **Full-bleed, cropped to `cover`.** It has to survive everything from a
  short laptop (1360×596) to a tall portrait window, so keep anything
  that matters away from the edges. Around 2560×1600 is a good master.
- **Lumo and the Story Egg stand low-centre.** The composition needs
  ground for them — a horizon, a hill, a rise. Without it they float.
- **Dark at the top, warm at the bottom.** The Traveller Gateway hands
  straight into screen 1 and ends on that gradient; art that starts near
  the Gateway's own sky keeps the seam invisible, which is what makes the
  two read as one journey (Studio Rite Decision 8 — the Gateway itself is
  deliberately never modified).
- **Under ~400KB** if it can be. This loads on a child's first ever run,
  alongside Lumo's voice.

A scrim is drawn over the lower half at runtime so the gold titles and
cream subtitles stay readable — the artwork does not need to leave room
for text, and should not be dimmed in the file itself.
