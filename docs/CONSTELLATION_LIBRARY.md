# The Canon Constellation Library

Seventeen real constellations, each reduced to the prominent stars a child
needs to recognise it, plus one legacy family kept for cards that already
carry it. The purpose is recognition and mythology, not astronomical
precision: these are the shapes as a star atlas **draws** them.

Defined in `js/magicCard.js` (`CONSTELLATIONS` and `CONSTELLATION_META`).
`js/cardPlatform.js` keeps its own separate table for World Cards; the two
were once in lockstep and are now deliberately different.

## A family is not an identity

A Creator's identity is their **exact canonical star-cell set** — shape,
orientation and position together. Recognition compares only that, on the
device (`canonical()`) and on the platform (`_card_platform_sort_pattern`).
Nothing uses the family name, or family-plus-rotation, as a Creator id.

Two Creators may both hold Lyra and be different people. Verified by minting
200 distinct Lyra cards.

Where a constellation is mathematically symmetric and a rotation lands on the
*same* cells, that is the same pattern and is treated as such — the sprint's
rule, and what the `orientations` column below counts.

## The library

| Constellation | Family | Stars | Grid | Orientations | Distinct cards | Line | Minted |
|---|---|---|---|---|---|---|---|
| Orion | Orion | 7 | 8x6 | 8/8 | 120 | certain | yes |
| Cassiopeia | Perseus | 5 | 3x9 | 4/8 | 64 | certain | yes |
| Cygnus | Hercules | 5 | 7x7 | 1/8 | 16 | ambiguous | yes |
| Lyra | Hercules | 5 | 6x5 | 4/8 | 120 | ambiguous | yes |
| Crux | Hercules | 4 | 7x6 | 4/8 | 80 | ambiguous | yes |
| Scorpius | Zodiac | 7 | 8x6 | 8/8 | 120 | certain | yes |
| Leo | Zodiac | 7 | 5x6 | 8/8 | 240 | certain | yes |
| Taurus | Zodiac | 7 | 4x7 | 4/8 | 112 | certain | yes |
| Gemini | Zodiac | 8 | 4x5 | 8/8 | 336 | certain | yes |
| Canis Major | Orion | 6 | 6x4 | 8/8 | 280 | certain | yes |
| Aquarius | Zodiac | 7 | 7x3 | 8/8 | 256 | certain | yes |
| Pegasus | Perseus | 6 | 7x7 | 4/8 | 64 | ambiguous | yes |
| Aries | Zodiac | 4 | 3x5 | 8/8 | 384 | certain | yes |
| Triangulum | Perseus | 3 | 3x4 | 8/8 | 448 | certain | yes |
| Delphinus | Heavenly Waters | 5 | 5x3 | 8/8 | 384 | certain | yes |
| Sagitta | Hercules | 4 | 3x4 | 4/8 | 224 | ambiguous | yes |
| Corona Borealis | Ursa Major | 6 | 4x7 | 8/8 | 224 | certain | yes |
| Ursa Major | Ursa Major | 7 | 8x8 | 8/8 | 72 | certain | legacy |

**Grid** is rows × columns at origin; all fit the 10×10 card.
**Orientations** is how many of the 8 rotations/mirrors produce *different*
cells — the rest land on the same pattern and are the same card.
**Distinct cards** is orientations × every offset that fits the grid.
**Line** is whether the connecting line can be recovered from the cells alone
(see below).

## Special handling

**Ambiguous line — Cygnus, Lyra, Crux, Pegasus, Sagitta.** More than one
placement fits the same cells *and* the placements draw different segments,
so a photographed card cannot say which way it is traced. The drawing board
shows the stars without a joining line for these rather than guessing; a
device holding the card uses the card's own order and is exact. Cassiopeia
also has two placements, but both draw the *same* segments, so its line is
certain.

**Cygnus is the one that needs a decision.** Its cross is perfectly
symmetric, so all eight transforms land on the same cells: one orientation
where Orion has eight, and 16 possible cards where Triangulum has 448. The
real Cygnus is *not* symmetric — Deneb and Albireo sit at very different
distances from Sadr — so a truer shape would raise its count and make its
tracing knowable at once. Not changed here: existing cards carry the
symmetric one, and changing it alters how they are traced.

**Ursa Major is legacy.** Not among the seventeen, but real cards carry it,
so it stays defined and traceable and is never minted again
(`mintable: false`). No existing card was altered or reminted.

## Identity conflicts found

| | Distinct patterns | Collision per pair | 50% chance at |
|---|---|---|---|
| Before | 392 | 0.435% | 19 Creators |
| After | 3472 | 0.059% | 49 Creators |

Expanding the library moved the risk but does not remove it, and **Cygnus
alone accounts for 37% of what remains.**

**Two open issues in the database, not addressed by this sprint** (both are
schema changes):

1. `magic_card_identities` has **no unique constraint on `pattern`**. Two
   Creators can be minted the same card.
2. `recall_magic_card` resolves a pattern with `... limit 1`. If two rows
   ever match, it silently picks one — a child could be let into another
   Creator's sky, which Decision 16 forbids.

The fix is one of: enforce uniqueness at mint and re-roll a taken pattern;
make `recall` refuse when more than one row matches; or both. Both need
approval, so neither was done here.
