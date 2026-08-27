# Applying the Companion Memory table

Everything in `supabase/migrations_companion_memory.sql` was written,
executed and verified against a real PostgreSQL 16 — but against a
**disposable** one, in the test harness. It has never been applied to
the live project, and the agent working on this repository cannot apply
it: the sandbox's network policy refuses the Supabase host outright
(`gateway answered 403 to CONNECT`), so there is no path from here to
the SQL Editor or the REST API.

This is the runbook for a person with the Dashboard open. Four steps,
in order. Everything except step 2 is read-only.

---

## Step 1 — pre-flight (read-only)

The migration runs inside one transaction, so if any statement fails the
whole thing rolls back and nothing is created. Exactly one thing can
make that happen: its SELECT policy calls
`public.has_magic_recall_grant(text)`, which the base schema defines and
`creator_library` already uses. If that function is missing, apply
`supabase/schema.sql` first.

```sql
select
  to_regclass('public.creator_companion_memory') as memory_table,   -- expect NULL
  to_regclass('public.magic_card_identities')    as identities,     -- expect not null
  to_regclass('public.creator_projects')         as projects,       -- expect not null
  (to_regprocedure('public.has_magic_recall_grant(text)') is not null)
                                                 as recall_grant_fn; -- expect true
```

Proceed only when `memory_table` is NULL and the other three are
present. If `memory_table` is already non-NULL the table exists — skip
to step 3 rather than re-running anything.

If you would rather ask the wider question first — *what else has this
project never had applied?* — run `supabase/what_is_missing.sql`. It is
read-only, safe on a live project at any time, and answers APPLIED or
MISSING for every migration in this repository, naming the file to run
for each one that is absent.

---

## Step 2 — apply

Paste the whole of `supabase/migrations_companion_memory.sql` into the
SQL Editor and run it.

It is **idempotent and non-destructive**, and that is not a claim about
the filename — it is what the statements are. The whole migration is:

| Kind | Count | Target |
|---|---|---|
| `create table if not exists` | 1 | the new table |
| `create index if not exists` | 3 | the new table |
| `alter table … enable row level security` | 1 | the new table |
| `drop policy if exists` | 4 | policies **on the new table** |
| `create policy` | 4 | the new table |

There is no `INSERT`, no `UPDATE`, no `DELETE`, no `TRUNCATE` and no
`DROP TABLE` anywhere in it. It touches no existing object. The four
`drop policy if exists` statements are what make it safe to run twice —
the harness runs it twice on purpose and checks that it still applies.

Do not edit the file to make it run. If it fails, capture the error
verbatim; a failure means step 1's prerequisite is missing, not that the
schema needs changing.

---

## Step 3 — verify

Paste the whole of `supabase/verify_companion_memory.sql` and run it. It
prints one row per check plus a summary on top, and it is safe on a live
project: it writes only to a reserved probe and deletes what it wrote.

Expected:

```
── OVERALL ──   all checks pass   PASS
```

Anything else: stop and report the failing rows rather than adjusting
the verifier.

---

## Step 4 — the clean state (read-only)

```sql
select
  (select count(*) from public.creator_companion_memory)             as rows,
  (select relrowsecurity from pg_class
     where oid = 'public.creator_companion_memory'::regclass)        as rls_on,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='creator_companion_memory') as policies,
  (select count(*) from pg_constraint
     where conrelid='public.creator_companion_memory'::regclass
       and contype='u')                                              as unique_constraints;
```

On a first application the honest expected answer is
`rows = 0 · rls_on = true · policies = 4 · unique_constraints = 1`.

**Zero rows is the correct state, not a failure.** Nothing backfills
memory, and nothing should: a memory is made when a Creator's own device
proves the moment, so the table fills as children use the product. If
rows already exist, do not delete them — report the count and the
`kind` / `status` / `source` grouping, and nothing of the `content`.

---

## What this does NOT turn on

Applying the table changes no behaviour. `js/companionMemory.js` is
local-first: `localStorage` remains the source of truth for a device,
and the table is the mirror that lets a proven Magic Card recall carry a
past to a second device. No Companion says anything new, and no model is
involved — both OpenAI production gates stay unset.
