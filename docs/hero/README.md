# Hero Page Documentation

This folder is the single source of truth for the VihuPlanet Hero Page.

From this point onward:

- Chat is for discussion.
- Git is the source of truth.
- Nothing is considered locked until it is committed to Git.

## Contract-Driven Design

Every decision about the Hero Page is captured as a numbered contract
document. A contract defines the purpose, behaviour, and boundaries of one
part of the Hero Page experience. Discussions happen in chat; decisions
live here.

## Versioning

Every document in this folder is versioned. Changes to a locked contract
require a version bump and an entry in that contract's Change History
section, plus a corresponding entry in `CHANGELOG.md`.

## Contract Lifecycle

Every contract moves through four states:

- 🟡 **DRAFT** — Under discussion.
- 🔵 **REVIEW** — Ready for approval.
- 🟢 **LOCKED** — Approved and becomes the source of truth.
- 🔴 **DEPRECATED** — Superseded by a newer contract.

## Immutability

Once a contract reaches 🟢 LOCKED, it is immutable as written. Future
changes require a new version of the contract, not a silent edit, and must
be reflected in the Change History section and `CHANGELOG.md`.

## Files

- `00-HERO-BIBLE.md` — top-level vision and index of the Hero Page.
- `CONTRACT-*.md` — individual contracts covering each area of the Hero
  Page. See the Core Contracts list in `00-HERO-BIBLE.md` for the
  current numbering and status of each.
- `../01-canon/CANON.md` — immutable Canon Laws that every contract
  must honor.
- `HERO-EMOTIONS.md` — the emotional goals the Hero Page must achieve.
- `HERO-NON-NEGOTIABLES.md` — constraints that must never be violated.
- `CHANGELOG.md` — history of documentation changes.
