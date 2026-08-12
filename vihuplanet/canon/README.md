# The Canon Repository

Canon Stories are the official stories of VihuPlanet. They are made by
the VihuPlanet team, they are part of the product, and they are owned by
nobody. A child never learns that this distinction exists — in the Ether
a Canon Story is simply a story that is there.

They are **shipped with the application**, which is why they live here
rather than in any database. `creator_projects` is a private, card-gated
backup of a *child's* work; putting product content in it would make
canon somebody's possession, which is the one thing canon is not.

## What is in here

```
canon.json        the manifest — the ids that ship, in order
<canon-id>.json   one file per Canon Story
```

`canon.json` is the source of truth for what ships. A story file that is
not listed in the manifest does not appear in the Ether, which makes
adding and removing content a one-line change that is reviewable on its
own.

The repository ships **empty**, and an empty Ether is not a broken one.
Adding the first Canon Story is a content decision, and it is two steps:
commit the story file, and add its id to `stories`.

## Adding a Canon Story

1. Open the Studio in Author Mode — `studio.html?author=on`. This is a
   development configuration, not a role or an account; there is no user
   administration anywhere in the product and none is planned.
2. Make the story in the ordinary editor. It is the same editor children
   use, with the same controls and the same story format. Nothing about
   authoring changes; only where the finished story goes.
3. **Review** it — flip through it on the first screen.
4. **Freeze** it. Freezing is what makes a story canon: it ships
   identically to every child, so publishing it is the act of declaring
   it final. There is no draft state in this folder.
5. **Publish to Canon.** You get a `canon_*.json` file.
6. Put that file in this folder and add its id to `canon.json`.

Between steps 5 and 6 the story is held in your own browser so you can go
and look at it in the Ether straight away. That copy is a development
convenience and is not the repository — committing the file is. Clear it
with `CanonRepository.unstage(id)`.

## The story file

The same shape a creator project has, minus everything about ownership.
There is no `creatorId`, no `creatorName` and no `author`, and there is
nowhere to put one.

```json
{
  "id": "canon_the_falling_star",
  "origin": "canon",
  "name": "The Falling Star",
  "thumbnail": "data:image/png;base64,…",
  "createdAt": "2026-08-12T00:00:00.000Z",
  "updatedAt": "2026-08-12T00:00:00.000Z",
  "publishedAt": "2026-08-12T00:00:00.000Z",
  "frozen": true,
  "data": { "project": { … }, "slides": [ … ] }
}
```

`origin` is what makes a story canon, and it is the only field anything
has to read to know. Creator stories carry `origin: "creator"` and their
creator's name; Canon Stories carry neither.

## What Canon Stories do in the Ether

They appear, they drift, they can be discovered and they can be read —
exactly like any other Story Spirit. They are never shown as *Created by
VihuPlanet*, *Created by Admin* or *Created by* anybody. They simply
belong to the universe.
