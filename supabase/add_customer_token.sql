-- Khatape — incremental migration: per-customer public self-view token.
-- Run ONCE in the SQL Editor (no reset). Also folded into schema.sql.
--
-- Each customer gets an unguessable token. A public page (/c/<token>) shows ONLY
-- that customer their own dues + recent purchases, read-only, via the
-- customer-view Edge Function (no login). RLS is untouched — the function uses
-- the service role and only ever returns the single customer matching the token.

alter table customers add column if not exists public_token text;
update customers set public_token = gen_random_uuid()::text where public_token is null;
alter table customers alter column public_token set default gen_random_uuid()::text;
create unique index if not exists customers_public_token_idx on customers(public_token);
