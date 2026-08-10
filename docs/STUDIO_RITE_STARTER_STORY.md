# The Starter Story — *The Night a Star Came Down*

The one canonical story every Traveller makes before VihuStudio unlocks. Part
of VihuPlanet's lore; experienced exactly once.

**Canon:** `docs/COMPANION_CANON.md` → Canon 6 & 7 · **Rite script:**
`docs/STUDIO_RITE_SCRIPT.md` · **Architecture:** `docs/STUDIO_RITE_PROPOSAL.md`

**Status: approved as the foundation. Design refined, not redesigned. No
implementation yet.** Supersedes the current Acts III–IV placeholder
interactions.

**Success metric (revised):** not how many capabilities are introduced, but
whether a child can confidently begin a story of their own the moment the Rite
ends. Every capability the story teaches is used **at least twice, in two
different narrative situations** — once to discover it, once to own it.

---

## 0. Three constraints that shaped it

**Places, Frames and Experiences are unavailable.** They belong to a **World**,
and the Rite deliberately runs on a **blank page with no World at all**
(`CREATION_TYPES`' `blank:true` path). Studio ships with zero built-in Worlds —
the Theme Repository is remote — so a Rite that required a World would
hard-fail on a first launch with no network, on a mandatory gate. The story
builds its settings from **background colour + stickers**, which are local and
offline.

**"Reading the finished story" is unavailable.** Reading a finished story means
Story Book, a Publish destination. The rewritten Decision 7 does let the Rite
reach the sharing moment, but sharing is a *giving*, not a *reading* — and
sitting the child down to read it back would put a lull exactly where the
ceremony belongs.

**Layer ordering is deliberately excluded.** It exists, but only as
drag-to-reorder inside the Object Strip (`SceneEngine.setLayerOrder`) — the
fiddliest interaction in Studio, and no beat needs it. It is also not a
first-hour capability, which under the revised metric is the stronger reason.

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
told a Story Egg was entrusted to them, that it has waited a long time for a
story of its own, and that nobody knows what is inside. Then their first act as
a Creator is to look after something small and not-yet-ready until it can go
on. The parallel is never named.

**The child is the author, not the audience.** Only the *shape* is canonical:
star falls, someone helps, star goes home. **Who** helps, what they say, what
colour the night is, and what the story is called are all the child's.

**It has a natural second half.** This is what makes it work as a *teaching*
story rather than a demo: every capability introduced on pages 1–2 has an
honest reason to come back on page 3 in a changed situation. The story didn't
have to be bent to allow that — a thing that falls has to rise again.

**It is universal.** No reading age, no cultural specificity, no named
character, no villain, no failure state.

---

## 3. Pages

**Three.** One per act, and the smallest number that teaches *sequence*.

| Page | Act | Feeling | Role in learning |
|---|---|---|---|
| 1 | The Falling | wonder | **discover** — every control met for the first time |
| 2 | The Finding | care | **apply** — same controls, new purpose; the story gets a cast |
| 3 | The Going Home | letting go | **own** — the child repeats everything unprompted, in reverse |

---

## 4. Scene by scene

Stage directions: `[EGG: pose]` — one of the five poses the Rite is allowed
(`idle · curious · thinking · excited · sleep`). Lumo never names a control.
Every beat waits for the child, indefinitely. `[LOOK]` is a deliberate silence —
no line, no prompt, nothing asked. The child just looks at what they made.

### Page 1 — The Falling · *discover*

*Reordered. The star now comes **before** the sky — see "Why the star comes
first" below.*

> **LUMO:** Every story starts somewhere. This one starts with something
> falling.
> *Put it up there.*

`[CHILD: adds a star]` `[EGG: excited]`

> **LUMO:** You can't see a star in the daytime.
> *What colour is the sky when the stars come out?*

`[CHILD: sets the page background colour]` `[EGG: curious]`

> **LUMO:** There it is.
> *Is it close to us, or very far away?*

`[CHILD: resizes the star]` `[EGG: thinking]`

> **LUMO:** Falling things turn as they fall.
> *Show me how it tumbles.*

`[CHILD: rotates the star]` `[EGG: excited]`

`[LOOK]` — two seconds. Nobody says anything.

> **LUMO:** Down it comes.

→ **Turn the page**

### Page 2 — The Finding · *apply*

> **LUMO:** It has to land somewhere. Let's make the place where it lands.

`[CHILD: adds a page]` `[EGG: curious]`

> **LUMO:** This is the ground now, not the sky.
> *What colour is it down here?*

`[CHILD: sets the background colour]`

> **LUMO:** Somewhere to land, and something to land under.

`[CHILD: adds a tree]` `[EGG: idle]`

> **LUMO:** Trees are tall. Is that one tall enough?

`[CHILD: resizes the tree]` `[EGG: thinking]`

> **LUMO:** Now the star is here, and it is very small, and it is alone.
> *Somebody is about to find it. Who?*

`[CHILD: adds a character of their choosing]` `[EGG: excited]`

> **LUMO:** Oh — them. Good. I like them already.
> *Bring them over. Nobody helps from far away.*

`[CHILD: moves the character to the star]` `[EGG: thinking]`

> **LUMO:** They found it. They are the first thing this star has ever met.
> *What do they say to it?*

`[CHILD: adds text — their own words]` `[EGG: excited]`

`[LOOK]` — hold.

> **LUMO:** *(quietly)* Nobody told them to be kind. They just were.

→ **Turn the page**

### Page 3 — The Going Home · *own*

*Lumo stops offering. Every beat on this page is a capability the child has
already used, asked for in one line without a hint.*

> **LUMO:** They stayed all night. Make it morning.

`[CHILD: adds a page and sets a dawn background]` `[EGG: curious]`

> **LUMO:** The star is stronger now. Take it home.

`[CHILD: moves the star up into the sky]` `[EGG: thinking]`

> **LUMO:** Further. It's a long way up.

`[CHILD: resizes the star smaller]` `[EGG: excited]`

> **LUMO:** *(quietly)* Far away again. Where it belongs.

`[LOOK]` — the longest pause in the story.

> **LUMO:** How does your friend feel, watching it go?

`[CHILD: adds an emotion or a heart]` `[EGG: excited]`

> **LUMO:** Every story needs somebody telling it, too.
> *Tell us how it ends.*

`[CHILD: adds text — the story's own last words]` `[EGG: idle]`

> **LUMO:** You made something small, and you looked after it, and then you let
> it go.
> *Every story does that.*

> **LUMO:** Stories need names, the way stars do.
> *What is this one called?*

`[CHILD: names the story]` `[EGG: excited]`

`[LOOK]` — let the name sit on the page.

> **LUMO:** *(quietly)* You made that. It didn't exist, and now it does.

`[EGG: idle]` — settles close to the child.

> **LUMO:** And you did all of it. I only asked questions.

> **LUMO:** Whatever you want to make next — you already know how to start.

→ *continues into the sharing moment (`docs/STUDIO_RITE_SCRIPT.md` → Completion)*

---

## 5. Every interaction, and why it earns its place

| # | Page | Story reason | Capability | Use | Why it isn't instructional |
|---|---|---|---|---|---|
| 1 | 1 | Something must be up there to fall | **Add sticker** | 1st — *subject* | Casting the story |
| 2 | 1 | A star is invisible in daylight | **Background** | 1st — *place* | The story **needs** it: the child cannot see their own star until they fix it |
| 3 | 1 | Is it near or far? | **Resize** | 1st — *distance* | Size is distance; only the child knows the answer |
| 4 | 1 | Falling things tumble | **Rotate** | only use | The one place rotation is obviously physics |
| 5 | 2 | It has to land somewhere | **Add page** | 1st — *the fall* | The page break *is* the fall |
| 6 | 2 | Ground is not sky | **Background** | 2nd — *a different place* | Same control, new job — the child leads |
| 7 | 2 | Something to land under | **Add sticker** | 2nd — *setting* | Building a place, not decorating |
| 8 | 2 | Trees are tall | **Resize** | 2nd — *scale* | Not distance this time — proportion |
| 9 | 2 | Somebody finds it | **Add sticker** | 3rd — *character* | The most authorial act in the story |
| 10 | 2 | Nobody helps from far away | **Move** | 1st — *helping* | Position carries the meaning of the scene |
| 11 | 2 | What do they say? | **Text** | 1st — *dialogue* | Their words, in their story |
| 12 | 3 | Morning | **Add page + Background** | 2nd / 3rd — *time passing* | Colour as time, not place |
| 13 | 3 | Take it home | **Move** | 2nd — *returning* | Asked in one line, no hint |
| 14 | 3 | It's a long way up | **Resize** | 3rd — *distance again, reversed* | Closes the loop opened on page 1 |
| 15 | 3 | How do they feel? | **Add sticker** | 4th — *emotion* | Emotion is the ending |
| 16 | 3 | Tell us how it ends | **Text** | 2nd — *narration* | A different kind of writing from dialogue |
| 17 | 3 | Stories need names | **Story title** | only use | The last thing an author does |

**17 interactions · 8 capabilities · 6 of them used two or more times.**

### ⚠ Pages must carry their content forward — open decision

Found while building, not while designing. The story assumes continuity that a
blank page does not give it:

- Page 2 says *"Now the star is here, and it is very small, and it is alone."*
- Page 3 says *"The star is stronger now. Take it home."*

But `+ Add Page` creates an **empty** page. On page 3 there is no star to take
home, so that beat can never be satisfied — and because the Rite is mandatory
and every beat waits indefinitely, that is a **lockout**, not a rough edge.
Verified: the full 17-making run only completes when the pages are created with
`PageOps.duplicatePage`; with a blank page it stalls at "Take it home".

Two ways out, and it is a product decision:

1. **Teach duplicate instead of add** *(recommended)*. A storybook page that
   continues the previous scene is the honest authoring move, the story already
   depends on it, and `duplicatePage` exists. Cost: two lines of approved copy
   change — *"It has to land somewhere"* and *"Make it morning"* become
   invitations to make **another page like this one** — and the coverage table's
   "Add page" becomes "Duplicate page".
2. **Add beats that re-place the star** on pages 2 and 3. Keeps the copy, but
   adds two interactions and asks the child to rebuild what they just made,
   which reads as busywork rather than storytelling.

Nothing has been changed either way. The code accepts any increase in page
count, so both work mechanically; only option 1 makes the *story* work.

### Why the star comes first

The original order asked for the **background colour** as the child's very
first action in VihuStudio. Two problems, both real:

**The vocabulary gap.** Lumo says *"sky."* The control says **"Background."** A
five-year-old does not translate one into the other, and we would be asking
them to do it on their first action ever — which is exactly the software-word
problem the whole Rite exists to remove.

**The reward gap.** Adding a sticker is the largest, most obvious affordance on
the panel and something *appears* when you use it. Colouring a blank page is a
subtler payoff for a first attempt.

Reversing them fixes both and improves the writing: the sky is no longer
coloured because Lumo asked, it is coloured because **the story stops working
otherwise** — you cannot see a star in daylight. The child's own need creates
the action, which is the principle this document is built on.

### The nudge on page 1

Page 1 is *discover*: every control is being met for the first time, so the
glow appears **immediately** on each ask, with no delay (Part IV of
`docs/STUDIO_RITE_PROPOSAL.md`). Page 2 waits ~4s, page 3 waits ~12s. Lumo
still never names a control; the interface shows where it is.

**Rotate remains the riskiest beat in the Rite.** It is the fourth first-time
control in a row, it needs the star selected before the dial exists, and it is
the one capability we have agreed is not first-hour core. It is also the beat
most likely to strand a child on a mandatory, unskippable gate. The nudge's
stepwise path — select the star, *then* the dial — is what makes it safe, and
it should be tested first.

---

## 6. Capability coverage

| Capability | Uses | The situations it is learned in | First-hour core? |
|---|---|---|---|
| **Add sticker** | 4 | subject · setting · character · emotion | yes |
| **Background colour** | 3 | night sky · ground · dawn *(place, place, time)* | yes |
| **Resize** | 3 | distance · scale · distance reversed | yes |
| **Move** | 2 | going to help · going home | yes |
| **Text** | 2 | dialogue · narration | yes |
| **Add page** | 2 | the fall · the morning | yes |
| **Rotate** | 1 | tumbling | no — see below |
| **Story title** | 1 | naming the finished story | yes, but once is right |

**Rotate is the one single-use capability, deliberately.** It is not something
most children reach for in their first hour, and the story offers exactly one
honest reason to spin something. A second use would be invented rather than
needed — and Principle 3 (*every interaction must earn its place*) outranks
Principle 1 (*reuse for familiarity*) whenever they disagree. It stays because
a falling star tumbling is real, and it stays once.

**Story title is used once by nature** — a story has one name, and naming it is
the closing act. Repeating it would be nonsense.

**Still deliberately excluded:** Places / Frames / Experiences (need a World) ·
reading the finished story (needs Story Book) · layer ordering (fiddly, and not
first-hour) · speech-bubble shapes (a shape plus a separate text object is two
positioning steps for the same story beat a plain Text gives in one) · doodle,
photo, family photos (personal-content paths that deserve their own moment, not
a first-story obligation).

---

## 7. The Story Egg through the story

The Egg never speaks, never teaches, never guides. It reacts, and the reactions
form their own quiet arc:

| Moment | Pose |
|---|---|
| The sky is chosen | `curious` |
| The star appears | `excited` |
| Distance, scale, the move | `thinking` |
| Somebody is chosen | `excited` |
| The star goes home | `thinking` → `excited` |
| The last words are written | `idle` |
| The story is named | `excited` → `idle`, settles close |
| Long pause anywhere | `sleep` → wakes `curious` |

**Nothing about hatching, Companions or the Ceremony is said.** The Egg simply
watches the whole thing happen. The closing lines no longer claim it grew — the
Rite's own Act I/II copy already established that nobody knows what is inside,
and the ending lets that stand.

---

## 8. Teaching objectives per page

| Page | Learned by doing | The child's state at the end |
|---|---|---|
| 1 | A page is a moment. Things have size and angle. Colour sets mood. | *"I've seen how this works."* |
| 2 | Stories move across pages. Position means something. You choose the cast. Words are yours. | *"I've done that before."* |
| 3 | Endings are made. Everything reverses. Stories are named. | *"I did that without being shown."* |

Page 3 is the graduation, and it is designed to feel like one: Lumo drops from
two-line prompts to single sentences, and every capability asked for is one the
child has already used. Nothing new is introduced after the halfway point.

---

## 9. Time

**Honest estimate: 9–11 minutes.**

Seventeen interactions, three of which are now repeats a child performs faster
than the first time. The earlier revision of this document offered a cut list to
reach five minutes; **it has been withdrawn** — the direction is explicit that
coverage must not be reduced and familiarity outranks brevity.

This is a real trade, and worth naming rather than hiding: the Rite is now
roughly twice the length originally targeted, and it is mandatory. If session
length becomes a problem in testing, the honest lever is **not** cutting
capabilities but splitting the Rite — pages 1–2 before the Studio unlocks, page
3 offered as the child's first return. That would be a change to Canon 6 and is
not proposed here.

---

## 10. Closing dialogue — confidence, not completion

The final beats were rewritten under Principle 4. What changed and why:

| Removed | Why |
|---|---|
| *"Your Egg felt every bit of that. It's a little stronger than it was this morning."* | Claimed a growth mechanic the platform doesn't have, and contradicted the Rite's own "nobody knows what is inside" |
| *"The Studio is yours now. Go and see what else is in it."* | Reads as a door being unlocked — a reward for finishing |

| Added | Why |
|---|---|
| *"And you did all of it. I only asked questions."* | Names the child as the author of everything that just happened. This is the confidence line; Lumo explicitly removes himself |
| *"Whatever you want to make next — you already know how to start."* | Points forward at their own work, not back at a completed exercise |

The Rite's own Completion screen then asks whether they would like the story to
become part of VihuPlanet (Decision 7 as rewritten). The child leaves having
made something, been told they made it, and chosen what happens to it.

---

*Design only. Story approved and unchanged; this revision refines pacing,
reuse and the closing beats. Nothing about Studio Rite's architecture or
implementation roadmap is altered.*
