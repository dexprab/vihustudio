# Deploying `lab-generate` — the Ether Mystery Lab's secure generation path

> Build 0767 (Decision 58, the Ether Mystery Lab). Edge Functions are
> deployed BY HAND here — there is no CI that deploys them
> (docs/SUPABASE_CLI.md). The Lab works before this is deployed:
> FIXTURE MODE needs nothing, and Direct mode (dev-only, key typed at
> runtime, memory-only) can run the first real experiment. This
> function is the PREFERRED path because it keeps the key server-side.

## What it is

An administrators-only relay from the browser Lab
(`tools/ether-mystery-lab/index.html`) to the model provider. The
prompt is built in ONE place (`tools/ether-mystery-lab/labKit.js`);
the function holds the KEY, the session-derived caller check, the
`platform_admins` gate, the `lab-generate` rate bucket (30/hour), the
bounded one-attempt request, and the guarantee that no provider error
text and no key ever reaches a browser. Its `BUILD` is `LAB1`.

It is NOT part of the Ether runtime and no child-facing path reaches
it. A candidate it returns still passes the one validator, a human
review, and a reviewed commit before any child could meet it.

## Steps

1. **The rate-limit migration must already be applied** (it has been
   since Sprint 1A — `supabase/migrations_edge_rate_limit.sql`). The
   bucket needs no migration of its own: `LIMITS` travels inside the
   function.

2. **Deploy the function.** `index.ts` is single-file (nothing local
   to inline, so there is no dashboard-paste variant — index.ts IS the
   paste):

   Dashboard → Edge Functions → Deploy a new function → Via Editor
   → name it exactly `lab-generate` → replace the template with the
   whole of `supabase/functions/lab-generate/index.ts` → Deploy.
   Leave "Verify JWT" at its default — the function derives its own
   caller on top of it.

   Or by CLI: `supabase functions deploy lab-generate`.

3. **Configure the key** (Function secrets). `OPENAI_API_KEY` is the
   same secret companion-chat already uses on this project — if that
   is set project-wide, nothing new is needed. Optionally `LAB_MODEL`
   (default `gpt-4.1-mini`).

4. **Check who may call it.** The caller's session email must be in
   `platform_admins` — the same table the invite desk uses. An empty
   table refuses everybody (that is the sky-protection discipline, not
   a fault).

5. **Verify from the Lab.** Open the Lab → Connection → Endpoint →
   paste `https://<project>.supabase.co/functions/v1/lab-generate`
   and an administrator session's access token → **Test connection**.
   Expected: `LLM CONNECTED (endpoint)`, and the ping reports
   `build: LAB1, provider: configured`. `provider: none` means step 3;
   401 means the token; 403 means step 4.

6. **Generate.** Every failure is HTTP 200 with a one-word reason
   (`not-configured` · `unavailable` · `provider-busy` · `malformed` ·
   `bad-messages`); 429 is the bucket and passes on its own within the
   hour.

## What it never does

No retry loop (one attempt per press; the developer asks again). No
provider text out (a 500's body dies inside the function). No key in
any response, log line or export. No write to any table. No path to
the experience pool — exports are reviewed and committed by a person.
