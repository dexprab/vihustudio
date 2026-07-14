-- supabase/create_base_builder_user.sql
--
-- Creates the first real (non-anonymous) Supabase Auth user for World
-- Builder: a single "Vihu Planet" identity to start assigning real
-- ownership to instead of every session getting its own throwaway
-- anonymous auth.uid(). This is deliberately the FIRST account, not
-- the ONLY one — more real builder accounts can be created the exact
-- same way later (see the "More builders" note at the bottom).
--
-- WHY THIS IS NEEDED (see docs/THEME_REPOSITORY_ARCHITECTURE.md and
-- CLAUDE.md's "World Builder — Builder Project Cloud Backup" and
-- "'My World Projects' Lists Personal/Official/Growing" entries): every
-- Builder session today calls supabase.auth.signInAnonymously()
-- (js/themeRepositoryClient.js's _ensureAuth()), which mints a brand
-- new, disposable auth.uid() per browser profile — a different
-- browser/incognito window is structurally a different "user" with no
-- way to see the same Personal Themes or Cloud Backups. A real,
-- persistent account (one you actually sign in as) fixes that, and is
-- the identity Official Theme publishing should eventually be
-- attributed to instead of the empty-string sentinel every Official
-- row currently uses.
--
-- WHAT THIS SCRIPT DOES NOT DO YET (disclosed, not silently skipped):
-- it only creates the account IN SUPABASE. World Builder's own sign-in
-- flow still calls signInAnonymously() everywhere — nothing in
-- js/themeRepositoryClient.js / tools/world-builder-v2 has been changed
-- to actually sign in as this account. Wiring a real sign-in UI
-- (replacing the anonymous session with a real email+password sign-in,
-- deciding what happens to content already owned by old anonymous
-- sessions, etc.) is separate, not-yet-built follow-up work.
--
-- HOW TO RUN THIS:
--   1. Open your Supabase project's Dashboard -> SQL Editor.
--   2. Below, replace 'CHANGE_ME_STRONG_PASSWORD' with a real, strong
--      password of your own choosing (e.g. output of
--      `openssl rand -base64 24` on your own machine). Do NOT commit
--      that edited value back into git — run it once, then either
--      discard the edit or keep this file with the placeholder
--      restored. Store the real password in a password manager.
--   3. Run the whole script. It's idempotent (ON CONFLICT DO NOTHING on
--      email) so re-running it after the user already exists is safe
--      and just does nothing the second time.
--   4. Immediately after, in the Dashboard's Authentication -> Users
--      list, confirm "vihu-planet-builder@vihustudio.app" (or whatever
--      email you used below) shows up with a confirmed email.
--
-- A NOTE ON HOW THIS WORKS: this inserts directly into Supabase's own
-- internal auth.users / auth.identities tables rather than going
-- through the officially documented Admin API
-- (supabase.auth.admin.createUser(), which needs a service-role key and
-- a script environment that can reach your project — this sandbox
-- cannot). Writing directly to auth.* is a widely used, well-tested
-- community pattern for seeding a real sign-in-capable user without
-- that extra step, but it is not Supabase's own officially documented
-- path and its exact internal shape could in principle change in a
-- future Supabase Auth version. If this script ever errors on your
-- project (e.g. a NOT NULL column this script doesn't set), the
-- reliable fallback is the Admin API from a small Node script you run
-- locally, where Supabase is reachable:
--
--   const { createClient } = require('@supabase/supabase-js');
--   const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
--   await supabase.auth.admin.createUser({
--     email: 'vihu-planet-builder@vihustudio.app',
--     password: 'CHANGE_ME_STRONG_PASSWORD',
--     email_confirm: true,
--     user_metadata: { name: 'Vihu Planet', account_type: 'base-builder' }
--   });

create extension if not exists pgcrypto;

do $$
declare
  new_user_id uuid := gen_random_uuid();
  new_identity_id uuid := gen_random_uuid();
  target_email text := 'vihu-planet-builder@vihustudio.app';
  target_password text := 'CHANGE_ME_STRONG_PASSWORD';
begin
  if exists (select 1 from auth.users where email = target_email) then
    raise notice 'User % already exists — nothing to do.', target_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    target_email,
    crypt(target_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Vihu Planet","account_type":"base-builder"}'::jsonb,
    '', '', '', '',
    false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    new_identity_id,
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', target_email),
    'email',
    now(),
    now(),
    now()
  );

  raise notice 'Created base builder user % with id %', target_email, new_user_id;
end $$;

-- More builders: to add another real builder account later (per "there
-- can be more builders"), copy this whole file, give it a new filename
-- and a new target_email/target_password, and run it the same way — no
-- schema change needed, since every RLS policy in schema.sql already
-- keys off auth.uid() generically, real or anonymous alike.
