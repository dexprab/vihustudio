# Deploying LOOK WHAT I MADE (creation-share)

Three steps, in this order. Everything degrades gracefully until the
last one — the hub appears immediately after the code ships, and its
doors answer "not right now" gently until the platform half is live.

## 1. The migration

Run `supabase/migrations_creation_share.sql` whole in the SQL editor.
It returns nothing. Then run `supabase/verify_creation_share.sql` —
one word per check, `CREATION SHARE: OK` on top, and it cleans up
after itself (safe on a live project).

## 2. The function

Deploy `supabase/functions/creation-share/index.ts`.

**With the CLI, use `--no-verify-jwt`:**

```
supabase functions deploy creation-share --no-verify-jwt --project-ref <ref>
```

Why: the letter's cover image is fetched by `<img>` tags in mail
clients, which cannot send an Authorization header, so the gateway
must let the request through to the function — where the `?cover=`
route is gated by the share token itself (the same capability that
gates look.html) and EVERY POST still goes through the full session
gate inside the file, exactly like the other functions.

From the Dashboard: paste `index.ts` as-is (it is one file — the gate
is generated in) and switch OFF "Enforce JWT verification" for this
function.

Secrets: it reuses what sky-protection already has — `RESEND_API_KEY`,
`SKY_FROM_EMAIL`, `SKY_REPLY_TO`, `SKY_BASE_URL`. Nothing new to set.

Probe (any signed-in session):

```
GET  {SUPABASE_URL}/functions/v1/creation-share
→ { ok:true, build:'LW4', creationShares:true, mail:true, base:'https://vihuplanet.com' }
```

`creationShares:false` means step 1 has not run; `mail:false` means
the Resend secrets are missing (mint and the Story Card still work —
only the letter refuses, gently).

## 2b. SOCIAL 1 rides the same deploy

The `LW4` build of the function carries the `creatorUsername` sweep
(the share's "Made by @moonmaker" attribution). A deployment still on
`LW3` refuses payloads carrying it by name and the client retries
without it — nothing breaks, shares simply travel unattributed until
the redeploy. The identity half is its own migration:

1. Run `supabase/migrations_social_identity.sql` whole (returns
   nothing). Besides the column and the claim function, it BACKFILLS:
   every existing account is named from its own nickname (normalized;
   collisions and un-nameable nicknames are skipped and keep the
   invitation), and their already-shared stories are stamped with the
   name so the whole Ether shows it immediately. Safe to re-run —
   it renames nobody.
2. Run `supabase/verify_social_identity.sql` — one word per check,
   `all checks pass` in the OVERALL row.

No new secrets, no new function. Claiming a name goes through the
existing REST RPC (`creator_username_claim`); discovery has no server
endpoint at all.

## 3. The smoke test

1. Open a story in the Studio, press **✨ Look What I Made** →
   **🃏 Print Story Card**. The back's QR should appear — that proves
   session → gate → sweep → mint → token, end to end.
2. Scan it with a phone: `look.html?t=…` opens the exact creation.
3. **💌 Share with Parent** → SEND. The letter should arrive with the
   cover image visible (that proves `--no-verify-jwt` took) and both
   buttons opening the creation.
