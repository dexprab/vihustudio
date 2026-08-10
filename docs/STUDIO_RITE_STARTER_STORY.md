# The Starter Story — *The Night a Star Came Down*

The one canonical story every Traveller makes before VihuStudio unlocks. Part
of VihuPlanet's lore; experienced exactly once.

**Canon:** `docs/COMPANION_CANON.md` → Canon 6 · **Rite script:**
`docs/STUDIO_RITE_SCRIPT.md` · **Architecture:** `docs/STUDIO_RITE_PROPOSAL.md`

**Status: design only. No implementation.** This supersedes the current Acts
III–IV interactions (place / move / resize one character on one page), which
were a placeholder for exactly this.

---

## 0. Three constraints that shaped it

Stated first because two capabilities on the brief's list genuinely cannot be
used, and one estimate does not hold.

**Places, Frames and Experiences are unavailable.** They belong to a **World**,
and the Rite deliberately runs on a **blank page with no World at all**
(`CREATION_TYPES`' `blank:true` path). That was not a shortcut: Studio ships
with zero built-in Worlds — the Theme Repository is remote — so a Rite that
required a World would hard-fail on a first launch with no network, on a
mandatory gate. The story therefore builds its settings from **background
colour + stickers**, which are local and offline.

**"Reading the finished story" is unavailable.** Reading a finished story means
Story Book, a Publish destination. The rewritten Decision 7 does let the Rite
reach the sharing moment, but sharing is a *giving*, not a *reading* — the
child chooses to let the story become part of VihuPlanet and the Creator
Ceremony follows immediately. Sitting them down to read it back first would
put a lull exactly where the ceremony belongs.

**Layer ordering is deliberately excluded.** It exists, but only as
drag-to-reorder inside the Object Strip (`SceneEngine.setLayerOrder`) — the
fiddliest interaction in Studio, and no beat in this story genuinely needs it.
Adding it would be coverage for coverage's sake, which the brief forbids.

---

## 1. Synopsis

A star falls out of the sky.

It lands, small and dim, in the grass under a tree. Somebody finds it — somebody
the child chooses — and stays with it while it is weak. When the sky begins to
lighten, the star is strong enough to go home, and rises. The one who found it
watches it go.

Three pages. Beginning, middle, end.

---

## 2. Why this story

**It rhymes with the Egg without revealing anything.** The child has just been
told a Story Egg was *entrusted* to them and that it will be ready one day. Then
their first act as a Creator is to look after something small and not-yet-ready
until it can go on. The lesson lands as feeling, not explanation, and nothing
about hatching, Companions or the Creator Ceremony is spoiled — the parallel is
never named. Lumo's closing question plants the curiosity and stops.

**The child is the author, not the audience.** Only the *shape* is canonical:
star falls, someone helps, star goes home. **Who** helps, what they say, what
colour the night is, and what the story is called are all the child's. Every
Traveller makes the same story and no two are alike — which is what makes it
lore rather than a tutorial.

**Every capability has a reason to exist here.** A falling star must tumble
(rotate) and be far away (resize). A landing needs somewhere to land (a second
page, a background, a tree). Someone who finds it must come *to* it (move). A
rescue needs a voice (text). Going home is distance (resize + move). Nothing is
bolted on.

**It is universal.** No reading age, no cultural specificity, no named
character, no villain, no failure state.

---

## 3. Pages

**Three.** One per act, which is also the smallest number that teaches
*sequence* — that pages are a story moving, not a pile of drawings.

| Page | Act | Feeling |
|---|---|---|
| 1 | The Falling | wonder |
| 2 | The Finding | care |
| 3 | The Going Home | letting go |

---

## 4. Scene by scene

Stage directions: `[EGG: pose]` — one of the five poses the Rite is allowed
(`idle · curious · thinking · excited · sleep`). Lumo never names a control.
Every beat waits for the child, indefinitely.

### Page 1 — The Falling

> **LUMO:** Every story starts somewhere. This one starts in the sky.
> *What colour is your sky tonight?*

`[CHILD: sets the page background colour]` `[EGG: curious]`

> **LUMO:** Beautiful. Now — something is up there, and it is about to fall.

`[CHILD: adds a star]` `[EGG: excited]`

> **LUMO:** There it is.
> *Is it close to us, or very far away?*

`[CHILD: resizes the star]` `[EGG: thinking]`

> **LUMO:** Falling things turn as they fall.
> *Show me how it tumbles.*

`[CHILD: rotates the star]` `[EGG: excited]`

> **LUMO:** Down it comes.

→ **Turn the page**

### Page 2 — The Finding

> **LUMO:** It has to land somewhere. Let's make the place where it lands.

`[CHILD: adds a page]` `[EGG: curious]`

> **LUMO:** This is the ground now, not the sky.
> *What colour is it down here?*

`[CHILD: sets the background colour]`

> **LUMO:** Somewhere to land, and something to land under.

`[CHILD: adds a tree]` `[EGG: idle]`

> **LUMO:** Now the star is here, and it is very small, and it is alone.
> *Somebody is about to find it. Who?*

`[CHILD: adds a character of their choosing]` `[EGG: excited]`

> **LUMO:** Oh — them. Good. I like them already.
> *Bring them over. Nobody helps from far away.*

`[CHILD: moves the character to the star]` `[EGG: thinking]`

> **LUMO:** They found it. They are the first thing this star has ever met.
> *What do they say to it?*

`[CHILD: adds text — their own words]` `[EGG: excited]`

> **LUMO:** *(quietly)* Nobody told them to be kind. They just were.

→ **Turn the page**

### Page 3 — The Going Home

> **LUMO:** They stayed all night. Look — the sky is getting lighter.

`[CHILD: adds a page and sets a dawn background]` `[EGG: curious]`

> **LUMO:** The star is stronger now. Strong enough to go home.
> *Take it up.*

`[CHILD: moves the star high, and makes it small]` `[EGG: thinking]`

> **LUMO:** Far away again. Where it belongs.
> *How does your friend feel, watching it go?*

`[CHILD: adds an emotion or a heart]` `[EGG: excited]`

`[BEAT]` — hold. Nothing moves.

> **LUMO:** You made something small, and you looked after it, and then you let
> it go.
> *Every story does that.*

> **LUMO:** Stories need names, the way stars do.
> *What is this one called?*

`[CHILD: names the story]` `[EGG: excited]`

> **LUMO:** *(quietly)* You made that. It didn't exist, and now it does.

`[EGG: idle]` — settles close to the child.

> **LUMO:** Your Egg felt every bit of that.
> *It's a little stronger than it was this morning.*

`[BEAT]`

> **LUMO:** The Studio is yours now.
> *Go and see what else is in it.*

→ **Into the Studio**

---

## 5. Every interaction, and why it earns its place

| # | Page | Story reason | Capability | Why it isn't instructional |
|---|---|---|---|---|
| 1 | 1 | The sky has to have a colour | **Page background** | The child is choosing the *mood of a night*, not filling a swatch |
| 2 | 1 | Something must be up there to fall | **Add sticker (Emojis)** | They are casting the story's subject |
| 3 | 1 | Is it near or far? | **Resize** | Size is *distance* here — a storytelling decision with a right answer only the child has |
| 4 | 1 | Falling things tumble | **Rotate** | The one place rotation is obviously physics, not a slider |
| 5 | 2 | It has to land somewhere | **Add page** | The page break *is* the fall. Sequence is felt, not explained |
| 6 | 2 | Ground is not sky | **Page background** (2nd) | Repetition with a changed purpose — proves the control is a tool of theirs |
| 7 | 2 | Something to land under | **Add sticker (Nature)** | Building a place, not decorating |
| 8 | 2 | Somebody finds it | **Add sticker (child's choice)** | The single most authorial act in the story. Nobody is named for them |
| 9 | 2 | Nobody helps from far away | **Move** | Position carries meaning: *near* is the whole point of the scene |
| 10 | 2 | What do they say? | **Text** | Their words, in their story — not a caption exercise |
| 11 | 3 | Dawn | **Add page + background** | Time passing, shown by colour |
| 12 | 3 | The star goes home | **Move + Resize** | Reuses both, now *combined* and reversed — small means far again |
| 13 | 3 | How do they feel? | **Add sticker (Emotions)** | Emotion is the story's ending, not an emoji picker |
| 14 | 3 | Stories need names | **Story title** | The last thing an author does |

**14 interactions. 8 distinct capabilities. Zero tools named aloud.**

---

## 6. Capabilities introduced

**Covered naturally:** page background colour · adding stickers (four
categories: Space, Nature, Characters/Animals, Emotions) · move · resize ·
rotate · text · multiple pages · page sequence · story title · scene
progression · simple three-act storytelling.

**Deliberately not covered, with reasons:** Places / Frames / Experiences
(need a World — §0) · reading the finished story (needs Publish — §0) · layer
ordering (fiddly, and no beat needs it — §0) · speech bubbles (the Speech Bubble
*shape* exists, but pairing a shape with a separate text object is two
positioning steps; a plain Text object gives the same story beat in one) ·
doodle, photo, family photos (personal-content paths that deserve their own
moment, not a first-story obligation).

---

## 7. The Story Egg through the story

The Egg never speaks, never teaches, never guides. It reacts, and the reactions
tell their own quiet arc:

| Moment | Pose | Reading |
|---|---|---|
| The sky is chosen | `curious` | interest |
| The star appears | `excited` | delight |
| Distance, tumbling, the move | `thinking` | attention |
| Somebody is chosen | `excited` | the story's warmest beat so far |
| The words are written | `excited` | — |
| The star goes home | `thinking` → `excited` | — |
| The story is named | `excited` → `idle` | settles, close |
| Long pause anywhere | `sleep` → wakes `curious` | never nags |

**Curiosity is planted exactly twice, and never explained.** Lumo says *"Your
Egg felt every bit of that"* and *"a little stronger than it was this morning."*
Nothing about hatching, Companions, or the Ceremony. The child leaves with a
question, which is the point.

---

## 8. Teaching objectives per page

| Page | Learned by doing | Never said aloud |
|---|---|---|
| 1 | A page is a moment. Objects have size and angle. Colour sets mood. | "This is the resize control" |
| 2 | Stories move across pages. Position means something. You choose the cast. Words are yours. | "Add a text object" |
| 3 | Endings are made, not found. Feelings belong on the page. Stories are named. | "Now publish" |

---

## 9. Time

**Honest estimate: 7–9 minutes**, not the 3–5 the brief targets.

14 interactions is the cost of the coverage requested. At roughly 20–30 seconds
each for a child locating a control for the first time, plus Lumo's lines
between, 3–5 minutes is not reachable without cutting.

**If 5 minutes is firm, cut in this order** — each removes one interaction and
costs the least story:

1. **Rotate** (#4) — the star still falls; it just doesn't tumble. *−1*
2. **Second background** (#6) — the ground keeps page 1's colour; Lumo says
   *"it's darker down here"* instead. *−1*
3. **Emotion sticker** (#13) — the ending rests on the text from page 2. *−1*
4. **Tree** (#7) — the star lands in open grass. *−1*

Cutting all four gives **10 interactions ≈ 5 minutes**, keeping all three
pages, the character choice, the words, and the ending intact. I would not cut
further: #8 (who finds it) and #10 (what they say) are the story.

---

## 10. Open question for the product owner

The closing line — *"a little stronger than it was this morning"* — commits to
the Egg growing across many stories. `COMPANION_CANON.md` Canon 4 currently
hatches the Egg at the **first Publish**, which for most children will be
minutes after this story ends. The promise and the mechanic disagree.

This is the same tension already flagged against the Screen 1–2 copy. It wants
one decision, not two: either the Egg hatches later (a change to Canon 4 and
`MagicCard.shouldOfferAwakening()`), or these lines soften. **The story is
written assuming the Egg hatches later**, because that is what makes the
Starter Story mean something.

---

*Design only. Nothing implemented. Awaiting sign-off on the story, the cut
list in §9, and the Canon 4 question in §10.*
