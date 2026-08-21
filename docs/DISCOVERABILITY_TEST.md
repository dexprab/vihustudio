# Discoverability Test — The Five Entity Questions

The test this sprint is held to: when a search engine or an AI assistant is
asked these five questions, the public surface must now contain grounded
answers — on a crawlable page, in machine-readable form, in words the
repository's canon actually supports. These are the answers the surface
gives; none is manufactured beyond what `/about`, the home head, the
JSON-LD and `llms.txt` actually say.

## 1. What is VihuPlanet?

> VihuPlanet is a creative universe for children — a living world where
> drawings, stories, characters and ideas become part of an evolving world
> of their own. Children don't just visit VihuPlanet; they live there: they
> are known by their own stars, they make stories in VihuStudio, and what
> they choose to share drifts in the Ether for other Travellers to
> discover.

Grounded at: `https://vihuplanet.com/` (title, meta description, JSON-LD
`Brand` + `WebSite`), `https://vihuplanet.com/about#vihuplanet`,
`llms.txt`.

## 2. What is VihuStudio?

> VihuStudio is the Hall of Creation inside VihuPlanet — the creative
> studio where children turn their ideas into stories: pages with pictures,
> words, characters, their own drawings from paper, their own handwriting,
> and their own voice reading it aloud.

Grounded at: `https://vihuplanet.com/about#vihustudio`, JSON-LD
`WebApplication` (`#vihustudio`), `llms.txt`.

## 3. How do VihuPlanet and VihuStudio relate?

> VihuPlanet is the world; VihuStudio is one place inside it — children
> visit the Studio, they live in VihuPlanet. VihuStudio is never a separate
> product and never the parent brand.

Grounded at: `/about` (the VihuPlanet and VihuStudio sections), JSON-LD
(`#vihustudio` `isPartOf` the VihuPlanet `WebSite`, whose `about` is the
VihuPlanet `Brand`), `llms.txt` (Relationships).

## 4. What is My Garden?

> My Garden is where the things a child creates live — a growing collection
> inside VihuPlanet where their real drawings (My Drawings) and handwritten
> letters (My Letters) are captured and kept. The letters together become
> the child's very own handwriting, which their stories can be written in.
> Nothing in the Garden is counted, scored or compared.

Grounded at: `https://vihuplanet.com/about#garden`, JSON-LD `Thing`
(`#my-garden`), `llms.txt`.

## 5. What can children create in VihuPlanet?

> Stories of their own — made page by page in VihuStudio, some inside
> crafted Story Worlds, with their own drawings, handwriting and voice.
> A finished story becomes a book to keep; a story a child chooses to
> share joins the Ether, VihuPlanet's living space, where other Travellers
> can discover and read it. Along the way children are accompanied by
> characters: Lumo the Guardian, the Story Egg, and their own bonded Story
> Companion.

Grounded at: `/about` (Stories, Books, Characters, Story Worlds, Ether
sections), `llms.txt`.

## What the surface deliberately does NOT claim

No founders, no company facts, no address, no social accounts, no ratings,
no user counts, no "publish" in child-facing words, no promises about
Story Worlds a child can create (they are grown, not manufactured —
Decision 9), and no ranking guarantees of any kind. If an answer is not in
the repository's canon, the public surface does not give it.
