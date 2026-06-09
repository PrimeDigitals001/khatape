-- Khatape — DANGER: drops all Khatape tables/types/functions so schema.sql can
-- recreate them cleanly. LOCAL / DEV ONLY — NEVER run on production.
-- It does NOT delete your Authentication users.
--
-- Order matters: drop the trigger, then the TABLES (cascade removes their RLS
-- policies), THEN the functions (policies depended on them).

-- ========================== SAFETY GUARD ==========================
-- Refuses to run unless this database is explicitly marked as DEV
-- (run dev-marker.sql once on a local/dev DB). Production never has the marker,
-- so pasting this into a prod SQL editor aborts instead of wiping data.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = '_khatape_env'
  ) or not exists (select 1 from public._khatape_env where env = 'dev') then
    raise exception
      'SAFETY: this is not a dev database (no dev marker). reset.sql aborted to protect production data.';
  end if;
end $$;
-- ==================================================================

drop trigger if exists on_auth_user_created on auth.users;
drop view if exists customer_balances;

-- Tables first — `cascade` also removes the RLS policies + foreign keys on them.
-- (covers both the current schema and the earlier draft: products/transaction_items/ledger_entries/payments)
drop table if exists audit_log cascade;
drop table if exists standing_orders cascade;
drop table if exists payments cascade;
drop table if exists ledger_entries cascade;
drop table if exists transaction_items cascade;
drop table if exists invoices cascade;
drop table if exists transactions cascade;
drop table if exists products cascade;
drop table if exists items cascade;
drop table if exists customers cascade;
drop table if exists tenant_modules cascade;
drop table if exists app_users cascade;
drop table if exists tenants cascade;

-- Now the functions (nothing depends on them anymore). cascade for safety.
drop function if exists handle_new_auth_user() cascade;
drop function if exists current_tenant_id() cascade;
drop function if exists is_super_admin() cascade;
drop function if exists current_app_user() cascade;

drop type if exists pricing_mode;
drop type if exists user_role;
