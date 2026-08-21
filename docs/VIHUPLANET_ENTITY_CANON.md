# VihuPlanet Entity Canon — Public Identity Language

The single source of truth for how VihuPlanet describes itself to the outside
world: to search engines, to AI assistants, to a parent pasting a link, to
anything that asks *"what is this?"*. Every public description — page copy,
meta description, Open Graph text, structured data, `llms.txt` — draws its
words from here. When public copy and this file disagree, this file wins;
when this file and `CLAUDE.md` disagree, `CLAUDE.md` wins and this file gets
corrected.

This file is about **public identity language only**. It renames nothing,
changes no behaviour, and adds no product surface.

## The one-line answers

- **What is VihuPlanet?** VihuPlanet is a creative universe for children —
  a living world where a child's drawings, stories, characters and ideas
  become part of something that grows. Children don't just use VihuPlanet;
  they live there.
- **What is VihuStudio?** VihuStudio is the Hall of Creation inside
  VihuPlanet — the creative studio where children turn their ideas into
  stories. Children visit the Studio; they live in VihuPlanet.
- **How do they relate?** VihuPlanet is the world; VihuStudio is one place
  inside it. VihuStudio is never the parent brand and never stands alone —
  it only makes sense as part of VihuPlanet.

## The entities

### VihuPlanet — the universe (parent entity)

The home of everything. A child arrives in VihuPlanet, is known by their own
stars, and everything else — making, keeping, sharing, discovering — happens
inside it. The canonical public description:

> VihuPlanet is a creative universe for children — a living world where
> drawings, stories, characters and ideas become part of an evolving world
> of their own.

Canon it rests on: "VihuPlanet is Home. VihuStudio is the Hall of Creation.
Children visit the Studio; they live in VihuPlanet" (Decision 10). "Preserve
what is real. Beautify originals rather than replacing them" (Product
Vision).

### VihuStudio — the Hall of Creation

The creative studio inside VihuPlanet where children make their stories:
pages, pictures, words, their own drawings, their own handwriting, their own
voice. Canonical public description:

> VihuStudio is the Hall of Creation inside VihuPlanet — the studio where
> children turn their ideas into stories of their own.

Never described as a product of its own, never the parent brand, never
"VihuStudio's VihuPlanet". The repository is named vihustudio for historical
reasons; the public identity is VihuPlanet first.

### Stories

What children make. A story is the child's own — their pictures, their
words, their name on it. Finishing a story and sharing it are separate acts
(Decision 12): every child can always finish their story and take it with
them; sharing it with VihuPlanet is a choice, made in a ceremony, never
required. Public copy never uses the word "publish" for what a child does —
a child **finishes** a story, and may **share** it with VihuPlanet.

### Books

A finished story can become a book — a real, keepable thing: a story book to
read and turn pages of, and artifacts a family can hold onto. Books are what
finishing gives every child, with nothing asked and nothing judged.

### Characters

The living company of VihuPlanet. Lumo the Guardian, who welcomes new
Travellers and guides first steps; the Story Egg, which accompanies without
ever speaking; and Story Companions, each bonded to one creator, who live in
that creator's stories and quietly host visiting readers. And beyond these,
every character a child draws into a story themselves.

### Story Worlds

Crafted worlds a story can be made inside — each with its own places, scenes
and experiences a child can build with. And in VihuPlanet itself, worlds are
grown, not manufactured: Story Worlds emerge from a universe that already
has stories in it (Decision 9 — there is no "create a Story World" button,
and public copy never promises one).

### My Garden

Where the things a child creates live. Canonical public description:

> My Garden is the growing collection inside VihuPlanet where a child's own
> drawings and handwritten letters are captured and kept — and quietly grow
> into something more.

Its two beds (Decision 27):

- **My Drawings** — real drawings from paper, captured and kept, ready to
  be placed into stories.
- **My Letters** — the child's real handwritten letters, kept one by one,
  which together become the child's own handwriting inside their stories.

No public copy ever describes the Garden with counts, scores, levels or
progress — the Garden grows; it is never measured.

### The Ether

The repository's own definition, verbatim in spirit (Decision 9): the Ether
is **the living space of VihuPlanet** — where a story a child chooses to
share drifts, waiting to be discovered. At any moment the Ether holds the
stories that belong to VihuPlanet itself and every story anybody has shared
(Decision 15). Stories in the Ether are Story Spirits — a light first, an
identity only once approached — never a gallery of floating cards.

## Entity relationship model

```
VihuPlanet — the creative universe (parent of everything public)
│
├── The Ether — the living space of VihuPlanet
│     └── shared Stories drift here as Story Spirits
│
├── VihuStudio — the Hall of Creation (the studio inside VihuPlanet)
│     ├── Stories        — what children make there
│     ├── Books          — what a finished Story becomes
│     ├── Characters     — Lumo · the Story Egg · Story Companions ·
│     │                    the characters children draw
│     └── Story Worlds   — crafted worlds stories are made inside
│
└── My Garden — where the things a child creates live
      ├── My Drawings    — captured real drawings
      └── My Letters     — kept handwritten letters, becoming the
                           child's own handwriting
```

Cross-relations that keep the tree honest: Stories are *made* in VihuStudio
but *live* in VihuPlanet — a shared Story leaves the Studio and joins the
Ether. Characters accompany a child everywhere, not only in the Studio.
The Garden's drawings and letters flow into Stories.

## Language rules (binding on all public copy)

1. **VihuPlanet is the brand; VihuStudio must never read as the parent.**
2. **Traveller, Creator, Story, Companion** — the canonical vocabulary
   (Decision 8). Never "Visitor", never "user".
3. **Never "publish" child-facing** — a child finishes a story and may
   share it with VihuPlanet (Decisions 8, 12).
4. **The language never blames** — no "failed", "invalid", "incorrect",
   "unsupported" anywhere public (Decisions 11, 16, 21).
5. **No counters, no levels, no scores, no rankings** in any public
   description (Decisions 20, 22, 27).
6. **No technical words child-facing** — no "app", "platform", "account",
   "AI", "upload", "login". A parent-facing sentence may say "website".
7. **Facts only.** No invented founders, addresses, social accounts,
   ratings, review counts or claims. If it is not in the repository's
   canon, it is not in the public identity.

## Where this language is deployed

- `index.html` head — title, description, Open Graph, JSON-LD.
- `about.html` — the public knowledge page (`/about`).
- `robots.txt`, `sitemap.xml`, `llms.txt` — the machine entry points.
- Policy for what is indexed at all: `docs/INDEXING_POLICY.md`.
- What the surface can now answer: `docs/DISCOVERABILITY_TEST.md`.
