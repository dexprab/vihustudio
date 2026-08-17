# Lumo — Studio Rite voice script

Every line Lumo speaks, in order, exactly as the shipped code says it.
Generated from `js/studioRite.js` -> SCREENS, not transcribed by hand.

- **Screens:** 23  · **Lines:** 33
- **Recorded: screens 1-7** (`lumo-screen1-redone.mp3` … `screen7`), one
  continuous take per screen. They are registered WHOLE and the text is
  cued to the performance, so the pacing on screen is the pacing that was
  recorded.
- **All 23 screens are recorded and wired.** Screens 8-23 arrived later
  (`lumo-screen8-redone.mp3` … `screen23`) and are registered in
  `js/lumoVoice.js` as `riteScreen8` … `riteScreen23`.
- Every declared duration was measured by decoding the file, and matches
  the real length to 0 ms.
- The four multi-line takes (**14, 18, 22, 23**) carry a `cues` array.
  Those cues were found by decoding each take and locating the silences
  between lines, then choosing between candidate boundaries with a
  speaking rate derived from screens 1, 2 and 7 — where the cues were
  already known, and which the same method reproduces exactly. **Worth
  one listen**: they are inferred, not heard.
- A screen's lines play one after another on their own; the child only
  acts (or taps) to LEAVE a screen.
- *Italic* is the second half of the same line (the instruction). Record
  it as one continuous take per line, not two.

---

### Screen 1 — stage (full screen)

**01.** Welcome to VihuStudio.  
*This is where you make stories.*

**02.** This is your Story Egg.  
*It is yours to look after.*

**03.** It will stay with you while you make your story.

> button: **Let's Begin**


### Screen 2 — stage (full screen)

**04.** Everyone who comes here is called a Traveller.  
*That is you.*

**05.** Travellers make stories.  
*You are going to make one now.*

**06.** Nobody knows what is inside a Story Egg.  
*Not even me.*

> button: **Start My First Story**


### Screen 3 — dock (beside the page)

**07.** We are going to make a story about a star that falls out of the sky.  
*Add a star to your page.*

> waits for the child: `sticker-added`


### Screen 4 — dock (beside the page)

**08.** Stars are hard to see in the daytime.  
*Make the sky dark.*

> waits for the child: `bg-set`


### Screen 5 — dock (beside the page)

**09.** Your star is far away up in the sky.  
*Make your star smaller.*

> waits for the child: `sticker-resized`


### Screen 6 — dock (beside the page)

**10.** Now the star starts to fall.  
*Turn your star a little.*

> waits for the child: `sticker-rotated`


### Screen 7 — dock (beside the page)

**11.** The star falls down and down.

**12.** Your page can make a copy of itself.  
*Copy this page.*

> waits for the child: `page-added`


### Screen 8 — dock (beside the page)

**13.** This new page is the ground.  
*Choose a colour for the ground.*

> waits for the child: `bg-set`


### Screen 9 — dock (beside the page)

**14.** A tree grows here.  
*Add a tree.*

> waits for the child: `sticker-added`


### Screen 10 — dock (beside the page)

**15.** Make your tree bigger.

> waits for the child: `sticker-resized`


### Screen 11 — dock (beside the page)

**16.** Someone comes to find the star.  
*Add a person or an animal.*

> waits for the child: `sticker-added`


### Screen 12 — dock (beside the page)

**17.** Good choice.  
*Move them next to the star.*

> waits for the child: `sticker-moved`


### Screen 13 — dock (beside the page)

**18.** They want to say something to the star.  
*Add some words.*

> waits for the child: `text-added`


### Screen 14 — dock (beside the page)

**19.** They stayed with the star all night.

**20.** Now it is morning.  
*Copy this page again.*

> waits for the child: `page-added`


### Screen 15 — dock (beside the page)

**21.** Make this sky light.

> waits for the child: `bg-set`


### Screen 16 — dock (beside the page)

**22.** The star is strong again.  
*Move your star up high.*

> waits for the child: `sticker-moved`


### Screen 17 — dock (beside the page)

**23.** The star is going home.  
*Make your star very small.*

> waits for the child: `sticker-resized`


### Screen 18 — dock (beside the page)

**24.** Your star is home now.

**25.** Your friend is happy.  
*Add a heart or a smiley face.*

> waits for the child: `sticker-added`


### Screen 19 — dock (beside the page)

**26.** Now tell us how the story ends.  
*Add some words.*

> waits for the child: `text-added`


### Screen 20 — dock (beside the page)

**27.** Every story needs a name.  
*Give your story a name.*

> waits for the child: `story-named`


### Screen 21 — dock (beside the page)

**28.** Your story is finished.  
*Watch it from the beginning.*

> button: **That is my story**


### Screen 22 — dock (beside the page)

**29.** Right now your story only lives on this screen.

**30.** Finishing it makes it yours to keep.  
*Tap Finish Story.*

> gate: the child finishes their story


### Screen 23 — dock (beside the page)

**31.** You made this story.  
*It was not here before today.*

**32.** You did all of it yourself.  
*I only asked the questions.*

**33.** Now you know how to make a story.

> button: **Into the Studio**


---

*The sharing beat below was listed here as "not built yet". It is built,
and it ships BEFORE the finale — so what was screen 22 is now screen 23.
Its wording changed with Decision 12, which took the word "Publish" out
of child-facing language: the control is Finish Story.*
