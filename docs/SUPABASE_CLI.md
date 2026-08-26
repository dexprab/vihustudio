# Supabase CLI

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** How this repository is wired to its hosted Supabase project, what
the CLI is and is not used for here, and the exact steps to connect a new
machine. It changes no product behaviour and no schema.

---

## What is already connected

The application itself has always been connected. `supabase-config.json` at
the repository root carries the hosted project's URL and its **public anon
key**, and every client module reads it from there:

```json
{ "url": "https://yqzqqtaruhgbmiyutksq.supabase.co", "anonKey": "…" }
```

That file is committed on purpose. The anon key is public by design — it is
served from a public site out of a public repository, and it authorises
nothing on its own. Every Edge Function derives its caller from the
**verified session** instead (`supabase/functions/*/edgeAuth.js`, CLAUDE.md
Decision 30), and every table's RLS derives it from `auth.uid()`.

So the CLI is not what connects the product to Supabase. It connects *you* to
the project, for two jobs:

1. Deploying the Edge Functions in `supabase/functions/`.
2. Setting those functions' secrets.

Project ref: **`yqzqqtaruhgbmiyutksq`**.

---

## What the CLI does NOT own here

Read this before running anything with `db` in it.

The SQL in this repository is `supabase/migrations_*.sql` — flat files at the
top of `supabase/`, not a CLI-managed `supabase/migrations/` folder. They are
applied by hand in the Dashboard SQL Editor, and their verification scripts
(`supabase/verify_edge_rate_limit.sql`, `supabase/verify_identity_hardening.sql`)
are separate files meant to be run on a live project at any time.

Two consequences:

- **`supabase db push` has nothing to push.** There is no CLI migration
  history, so it is not a way to apply the SQL in this folder.
- **`supabase db pull` would invent one.** It dumps the entire live schema
  into a new `supabase/migrations/` folder that nothing else in this
  repository expects, and that would then compete with `schema.sql` for being
  the truth about the database. Don't.

Local development (`supabase start`, `supabase db reset`) needs Docker and is
not part of this project's workflow: the site is static and talks to the
hosted project directly. `config.toml`'s local settings are kept accurate
anyway — notably `enable_anonymous_sign_ins = true`, because VihuPlanet has no
accounts and every visitor is an anonymous session (Decision 11).

Every function here is **one file**, and that is load-bearing rather than
tidy (Decision 30). A Dashboard deploy carries neither
`supabase/functions/_shared/` nor a second file placed beside `index.ts` —
both were measured, the second one failing for two functions out of five —
so the authorization gate is inlined into each `index.ts` between markers.

`_shared/edgeAuth.js` is the canonical source and is never deployed: it has
no `index.ts`, so it is not a function. Never hand-edit an inlined block. Run
`node tools/edge-auth-test/sync-shared.js` after any change to the canonical
file; `tools/edge-auth-test/run-edge-auth-tests.js` asserts each `index.ts`
matches what that script produces and re-runs the gate's real assertions
against the inlined copy, so drift is a failing test.

---

## Connecting a machine

You need **one thing that is not in this repository**: a Supabase personal
access token, from <https://supabase.com/dashboard/account/tokens>. It is
account-level, so treat it as a real credential — never commit it, never put
it in `supabase-config.json`.

```sh
# 1. Authenticate (opens a browser), or export SUPABASE_ACCESS_TOKEN instead.
npx supabase login

# 2. Link this checkout to the project.
npx supabase link --project-ref yqzqqtaruhgbmiyutksq
```

`link` writes to `supabase/.temp/`, which is gitignored — linking is per
machine and is never committed.

A database password is prompted for by some CLI versions during `link`. It is
only needed for the `db` commands this project does not use; skipping it
leaves function deploys and secrets working normally.

---

## Deploying functions

```sh
npx supabase functions deploy voice-speak
npx supabase functions deploy sky-protection
npx supabase functions deploy family-album
npx supabase functions deploy invite-send
npx supabase functions deploy creator-born

# …or all of them at once:
npx supabase functions deploy
```

Bundling uses Docker by default. On a machine without it, add `--use-api` to
bundle server-side instead:

```sh
npx supabase functions deploy voice-speak --use-api
```

Don't pass `--prune` casually: it deletes functions that exist on the project
but not in this checkout.

Each function keeps the gateway's JWT check on — stated per function in
`config.toml` rather than left to the default, so switching one off is a
visible edit — and then does its own session-derived authorization on top.

---

## Secrets

Set against the linked project; never committed, never in a bundle, never in
the browser (Decision 25).

```sh
npx supabase secrets set ELEVENLABS_API_KEY=…
npx supabase secrets list
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform. **Do not set them** — the CLI rejects them anyway.

| Secret | Used by | Notes |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | voice-speak | Absent ⇒ the line is simply unspoken. Silence is a correct answer (Decision 25). |
| `VOICE_CACHE_BUCKET` | voice-speak | Optional. Storage bucket for generated audio. |
| `RESEND_API_KEY` | sky-protection, invite-send, creator-born | Either this **or** the `SMTP_*` set. Resend wins when both are present. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | sky-protection | The alternative to Resend. |
| `SKY_FROM_EMAIL` | sky-protection, invite-send, creator-born | Sender address. |
| `SKY_REPLY_TO` | sky-protection, invite-send | Optional. |
| `SKY_BASE_URL` | sky-protection | Origin the Magic Card letter's links point at. |
| `INVITE_BASE_URL` | invite-send | Origin invite links point at. |
| `CREATOR_BORN_TO` | creator-born | Where the new-Creator notice goes. |

Every one of these is optional in the sense that matters: an unconfigured or
unreachable deployment is a handled state everywhere, and VihuPlanet never
claims a sky is safe when it is not (Decision 14).

---

## Pointing at a different project

Replace `url` and `anonKey` in `supabase-config.json` (the shape is in
`supabase-config.example.json`), re-`link` with the new ref, apply every
`supabase/migrations_*.sql` in the Dashboard SQL Editor, deploy the five
functions, and set the secrets above. Nothing in the client code holds a
project ref.
