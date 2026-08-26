-- Fixture for run-edge-auth-tests.js — the smallest slice of Supabase
-- that supabase/migrations_edge_rate_limit.sql actually needs.
--
-- The migration grants EXECUTE on edge_rate_limit_hit() to service_role,
-- and that role does not exist in a bare PostgreSQL. It is created here
-- rather than softened in the migration, because the migration should
-- say exactly what it says on the real project.
--
-- This lives in a file rather than in a `psql -c` string on purpose:
-- `$$` inside a double-quoted shell argument is the shell's own PID,
-- which silently corrupts any DO block passed that way. A real bug,
-- caught by this suite failing on its own first run.
--
-- Same convention as tools/family-photos-test/fixture.sql.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
