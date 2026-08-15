# Identity Foundation Report

Magic Card Identity Foundation Hardening. Everything below was measured
from the code, not asserted; where something could not be measured — the
live database — that is said plainly rather than assumed.

## A. Canon identity rule

    constellation family  ≠  Creator identity
    exact canonical star-cell set  =  Creator identity

The cells encode shape, orientation and position together. The family
name is descriptive and mythological only.

Verified by inspection that nothing uses the family name, family id, or
family-plus-rotation as an identity: `canonical()` (js/creatorRecognition.js)
and `_card_platform_sort_pattern()` (supabase/schema.sql) both reduce a
pattern to its sorted cells and compare that alone. The connecting line
and the order stars were drawn in are never part of identity.

## B. Actual current identity capacity

**3,472 distinct mintable patterns**, confirmed by *exhaustive
enumeration* of what the generator can actually reach — all four
rotations × both mirrors × every offset that fits, canonicalised and
counted as a set — rather than from the earlier formula.

Per family, the largest and smallest: Triangulum 448, Aries 384,
Delphinus 384, Gemini 336 … Pegasus 64, Cassiopeia 64, **Cygnus 16**.

## C. Duplicate patterns found

**None. Zero duplicate patterns across all live Creators.**

Measured against the live database after the migration ran:

| | |
|---|---|
| Creators | 6 |
| Distinct canonical patterns | 6 |
| **Duplicate patterns** | **0** |
| Cards on the twelve new families | 0 |

Two independent confirmations agree. The count above is direct; and
STEP 2 of the migration *raises and aborts* if any duplicate exists, so
a clean run — which produced STEP 3 and STEP 4 — could only have
happened with none.

No Creator identity was deleted, merged, reassigned or reminted, and
none needed to be. There is no product decision outstanding.

**The constellation CHECK break never bit anyone.** `on_new_families`
is 0: no card had yet been minted with one of the twelve new families,
so the constraint would have rejected the *next* claim rather than
having already lost one. It was a latent break, caught before its first
victim.

At 6 Creators the residual collision risk is about 0.9% across all
fifteen pairs — and is now moot regardless, since the unique index
makes a duplicate impossible rather than unlikely.

## D. Database constraint added

`magic_card_identities_canonical_pattern_key` — a unique index on
`_card_platform_sort_pattern(pattern)`, the existing canonical form. No
second representation was introduced.

Also fixed, and it was a **live break**: `magic_card_identities.constellation`
carried a CHECK naming only the original five families, so every card
minted with one of the twelve new ones was rejected on its way to the
platform — silently, because the client's push swallows errors. Those
cards work on their own device and cannot be recalled anywhere else. The
CHECK now names all eighteen.

## E. Mint behaviour

    generate candidate → canonicalise → attempt to reserve
        taken?  yes → new candidate, same family → retry (up to 6)
                no  → minted

Race-safety comes from the unique index, not from a JavaScript check:
`mint_magic_card()` inserts and lets the index arbitrate, so two
simultaneous mints cannot both succeed however they interleave. The
client cannot pre-check — `magic_card_identities` is owner-only SELECT
by design — which is exactly why the attempt happens inside a
SECURITY DEFINER function.

A retry keeps the **same constellation family**: the ceremony has
already named the child's sky, and changing Lyra to Aries underneath
them would be a visible lie. Nothing is shown to the child.

## F. Recall behaviour

    0 matches   → no_match
    1 match     → success
    >1 matches  → identity_conflict, and no Sky opens

`limit 1` is removed from both the pattern and typed-code paths. It was
never a safety mechanism; it was the absence of one. The conflict branch
returns no id, no nickname and no constellation, because the caller is
by definition not established as either Creator.

`CreatorRecognition` maps `identity_conflict` to *unreachable*, not
*unknown* — the child is never told their stars are wrong, because they
are not. Our data is ambiguous, not their card.

## G. Device / platform canonical consistency

**4,320 fixtures, 4,320 agreeing.** Every family, every orientation,
every position each can occupy, plus edge-of-grid fixtures — enumerated
exhaustively rather than sampled. Order-independence proven on both
sides by feeding each pattern reversed and requiring an identical
canonical form.

Disclosed: the platform side is verified against a faithful model of
`_card_platform_sort_pattern()` — sort by `(elem->>0)::int` then
`(elem->>1)::int` — because no database was reachable. The SQL itself
was read, not executed.

## H. Existing-card migration status

**No existing card altered, reminted, or reassigned.** Verified: five
stored shapes (minted, mirrored, upside-down, damaged-by-an-old-
migration, hand-drawn) are unchanged by repeated reads and by a
successful recognition; a legacy Ursa Major card is untouched and still
traces. The constellation library is unchanged — no star definitions, no
grid definitions, no orientation logic, no ambiguous-line handling.

## I. Lyra 120 vs 200 — resolved

**The 200 was my own reporting error, twice over.**

1. The check counted 200 *pairs that differed*, not 200 distinct cards,
   and the label said "200 distinct LYRA cards".
2. `generatePattern()` took **no argument** and silently ignored one, so
   `generatePattern('LYRA')` returned a random family. The two cards
   being compared were usually different constellations entirely. The
   test said nothing about Lyra at all.

The table was right. Enumerated directly: **Lyra has exactly 120
distinct cards.** Both faults are fixed — `generatePattern(name)` now
honours the family, and the harness counts the actual set.

## J. Remaining identity-capacity limitation

3,472 is finite and is **not** claimed to be sufficient. Collision
probability between any two Creators is 0.059%; a 50% chance of some
collision arrives at roughly 49 Creators.

**Cygnus alone is 37% of that risk.** Its cross is perfectly symmetric,
so all eight transforms land on the same cells: one orientation, 16
possible cards, against Triangulum's 448. Per this sprint it was left
alone — mathematically identical patterns are correctly treated as the
same identity, and the symmetric definition remains valid for existing
cards. Capacity expansion is a separate design decision.

Uniqueness is now enforced, so a collision can no longer create two
Creators; it exhausts the pool instead, which is a visible failure
rather than a silent one.

With 6 of 3,472 patterns taken, the pool is 0.17% used. The limit is
real and is nowhere near.

## K. Tests

**13 passed, 0 failed.**

| | Test | Result |
|---|---|---|
| A | same pattern twice → second rejected | pass |
| B | same family, different pattern → both allowed | pass |
| C | same shape, different orientation → allowed | pass |
| D | different family, identical cells → cannot coexist | pass |
| E | symmetric rotation, same cells → same identity | pass |
| F | recall, zero matches → NOT_FOUND | pass |
| G | recall, exactly one → SUCCESS | pass |
| H | recall, historical duplicates → IDENTITY_CONFLICT, no Sky | pass |
| I | two concurrent mints → only one succeeds | pass |
| — | device/platform canonical agreement (4,320 fixtures) | pass |
| — | order-independence, both sides | pass |
| — | edge-of-grid fixtures | pass |
| — | capacity by enumeration = 3,472 | pass |

A–I run against a model of the hardened database. They verify the
*logic* the SQL implements; they are not a substitute for running the
migration against the real one.

## Migration status

**Run, and verified.** `supabase/migrations_identity_hardening.sql`
executed cleanly against the live database:

- the constellation CHECK accepts all eighteen families
- the canonical unique index is installed
- `recall_magic_card` refuses on `identity_conflict` and no longer
  contains `limit 1`
- `mint_magic_card` is deployed

`supabase/verify_identity_hardening.sql` re-checks all four at any time
and changes nothing.

Every guarantee in this report is now enforced by the database rather
than only by the client:

    one canonical star pattern  ->  one Creator
    one Creator                 ->  one Magic Card identity

and an ambiguous identity can never open a Sky.
