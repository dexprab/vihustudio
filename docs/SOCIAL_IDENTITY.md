# Social Identity — Creator Identity & Discovery (Sprint SOCIAL 1)

A child creates something → another child discovers it → wants to see
more from that creator. This document is the architecture of that one
loop, and of nothing else: SOCIAL 1 is identity and discovery, not a
social network.

## The model

```
ACCOUNT (auth.uid, internal, never public, never searchable)
   ↓ owns
CREATOR IDENTITY (magic_card_identities — the Magic Card, Decision 11)
   ├─ nickname          (existing; travels on stories as creatorName)
   └─ username          (SOCIAL 1 — the public alias, @moonmaker)
   ↓ makes
PUBLIC CREATIONS (creator_projects rows with publishedAt / is_shared)
   └─ creatorUsername   (stamped on the record, like creatorName)
```

The identity table is REUSED, not duplicated. `magic_card_identities`
is already this product's creator identity, and its `id` is the same
`cardId` every project record carries (Decision 19) — a second
`creator_profiles` table would be a second identity system for the
same person. The username is a column on that row, and it is never the
account: `auth.uid()` stays internal and no public surface can reach
it.

## The username

* Globally unique, **case-insensitively** — a partial unique index on
  `lower(username)` is the rule, not a habit.
* 3–20 characters, `a-z 0-9 _`, at least one letter; reserved platform
  names refused. The rules live twice — `js/creatorHandle.js` for an
  instant kind answer, and inside `creator_username_claim()` beside
  the index that enforces them — and the social-identity suite fails
  if the two reserved lists ever differ.
* **The child chooses. Nothing is ever generated** — no moonmaker8472,
  no suggestions, no pre-filled field.
* Stable in v1: the first name is the name (`already_named` on any
  second claim). Renames are a future decision.
* Written by exactly one thing: `creator_username_claim(identity, name)`,
  SECURITY DEFINER, which verifies `owner_id = auth.uid()` — a
  client-named identity is a selector, never an assertion (the
  sky-protection rule). A stranger's identity answers exactly like a
  nonexistent one.
* Travels with the card: `recall_magic_card()` returns it, so a
  Creator recognised on a brand-new device is still @moonmaker there.
  `MagicCard.adopt()` carries it, `_pushIdentitySnapshot` cannot lose
  it (it updates only the columns it names).

## Existing accounts (S1.1)

The migration's backfill names every account that existed before
usernames did, **from its own display name** (product owner's
decision): the nickname normalized to the username shape — case
folded, everything outside `a-z 0-9 _` removed, nothing ever
appended. A nickname that cannot be a name (too short, no letter,
reserved) is skipped; a collision keeps the earliest account
(claimed_at order); nobody already named is renamed. Skipped accounts
keep the choose-your-name invitation. The backfill also stamps
`creatorUsername` onto those accounts' **already-shared** stories
server-side (`creator_projects.data`, cardId-matched, `updated_at`
untouched), so the whole Ether shows names the moment the migration
runs. `MagicCard.refreshUsername()` adopts the backfilled name onto
the device (owner-only RLS, once per load, network failure not
remembered), and Studio Home asks it before offering the invitation.

## The four surfaces

*"on card, in ether, on shared story card, shared foldable book"* —
the product owner's list, all shipped: the **Magic Card's own face**
(gold, beside the YOUNG CREATOR line; centred on a companion-less
card — a deliberate amendment to Decision 22's card-face discipline),
the **Ether** (the Preview chip and the shelf), the **Story Card**
back, and the **foldable's back cover** (*by @moonmaker*). Absent
rather than empty everywhere while no name exists.

## Attribution

`creatorUsername` is stamped onto project records exactly as
`creatorName` always has been: carried forward on every autosave,
filled from the active card when absent
(`js/creatorProjectStore.js` → `upsert`). Stories shared BEFORE the
name was chosen are healed by `_sweepUsernames()` — the
`_sweepCompanions()` shape: one lazy pass per load, only once a name
exists, only onto records the active card provably owns, never
rewriting a record that already carries one, **never onto a private
draft**.

## Discovery — deliberately no server endpoint

The Ether already shows Canon plus everything anybody shared
(Decision 15), and the username travels ON the shared record. So:

* `EtherFeed.byUsername(name)` filters the already-loaded public feed.
* `js/creatorPresence.js` renders that as the Creator's shelf (their
  public creations, covers and titles, nothing else) and as
  **🔎 Find a Creator** (exact name, any case).
* There is **no search RPC, no username query, no enumeration
  surface**: nothing new to rate-limit, and no query that could reach
  emails, account ids, or anyone who never shared. A Creator with no
  public creation is not discoverable anywhere — creation-first, by
  construction rather than by filtering.

On the runtime side the name rides on the entity's `source` (copied
wholesale, never read by physics/renderer/story layer — the same seam
`origin` and the Companion already use), because `storyEntity.js`
drops top-level fields it does not declare (measured: a top-level copy
never reached a met entity).

Surfaces:

* **Preview**: an `@moonmaker` chip under the maker's name — tap to
  open the shelf (`[data-preview-handle]`).
* **Find**: a quiet corner affordance on the Ether
  (`.vp-find`) — NOT a third permanent action; Decision 10's two are
  untouched.
* **`?creator=moonmaker`**: a one-shot intent like `?story=` —
  consumed, stripped from the address bar, opens the shelf after the
  threshold (Decision 23's own shape). This is the landing's
  "See more from @moonmaker" door.

## The share

* The share payload carries `creatorUsername` (whitelist-constructed
  in `js/creationShare.js`); the function's sweep (BUILD `LW4`)
  admits a well-formed one and refuses a malformed one by name, and
  the client's deploy-window retry strips exactly the named optional
  key on an older deployment.
* `look.html` says **Made by @moonmaker** and offers **See more from
  @moonmaker** → `./?creator=…`.
* The Story Card back carries `@moonmaker`.
* **Username is identity. The share token is access.** The opaque
  token remains the only way a share resolves; no username-based
  share URLs exist and none may be added.

## Cheer activity — derived, never logged

"✨ Your Moon Dragon is getting cheers!" (`js/creatorSocial.js`).
There is no event store and no notification system: the platform
already keeps each story's cheer count (Decision 20 — the count IS
the rows), and the line exists only where today's count is higher
than the count this card last saw
(`localStorage vihu.cheerSeen.<cardId>`). Never a number, never who
cheered (`story_cheers` keeps no social graph to ask), never a
ranking. Shown on Studio Home's social band; `markSeen()` is called
by the surface that actually showed it.

The **invitation** to choose a name lives on the same band and is
earned, not pushed: a card in hand + at least one shared story + no
name yet. Absent rather than empty, no decline, no dismiss
(Decision 22's shelf discipline).

## What SOCIAL 1 is not

No followers, no friend requests, no DMs, no chat, no "contact
creator", no comments, no likes, no leaderboards, no counts anywhere
a child can see. The suite scans the layer's code and surfaces for
that vocabulary and fails on any of it. SOCIAL 2 (My Circle) arrives
as its own decision; the seams it will use — the identity column, the
shelf, `byUsername` — exist, and nothing here presumes it.

## Files

`supabase/migrations_social_identity.sql` ·
`supabase/verify_social_identity.sql` · `js/creatorHandle.js` ·
`js/creatorSocial.js` · `js/creatorPresence.js` · `js/magicCard.js` ·
`js/creatorProjectStore.js` · `js/etherFeed.js` ·
`js/vihuplanetHome.js` · `js/creationFlow.js` · `js/creationShare.js` ·
`js/creationShareClient.js` · `js/etherShare.js` ·
`js/storyCardComposer.js` · `look.html` ·
`supabase/functions/creation-share/index.ts` (BUILD LW4) ·
`tools/social-identity-test/run-social-identity-tests.js`
