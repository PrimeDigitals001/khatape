-- Khatape — SECURITY FIX (HIGH): privilege escalation via app_users write RLS.
--
-- The old app_users_write policy allowed any tenant member to write app_users
-- rows in their own tenant — including updating THEIR OWN row to
-- role='super_admin' (tenant_id stays the same so WITH CHECK passed), which
-- granted cross-tenant super-admin access via a direct PostgREST call.
--
-- Fix: only super_admin may write app_users. The signup trigger (security
-- definer) and the manage-tenant-users Edge Function (service role) bypass RLS,
-- so legitimate user creation/promotion still works.
--
-- Apply to LOCAL (test) then the cloud (prod) project.

drop policy if exists app_users_write on app_users;
create policy app_users_write on app_users for all
  using (is_super_admin())
  with check (is_super_admin());
