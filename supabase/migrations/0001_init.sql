-- Khatape — Supabase schema (Postgres + RLS)
-- Paste this whole file into the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run: every object uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY guards.
--
-- Money is stored as exact `numeric(12,2)` rupees (Postgres numeric = exact decimal, no float drift).
-- snake_case columns. Every business row carries tenant_id, enforced by RLS.

-- =====================================================================
-- 0. Enums
-- =====================================================================
do $$ begin
  create type user_role as enum ('super_admin', 'admin', 'staff');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 1. Tenants (shops) — replaces every hardcoded "Chamunda Dairy" / UPI / fn-URL
-- =====================================================================
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  gst_number  text,
  upi_id      text,
  phone       text,
  branding    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. App users — maps an auth.users id to a role + tenant
-- =====================================================================
create table if not exists app_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid references tenants(id) on delete cascade,  -- null for super_admin
  role       user_role not null default 'staff',
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. Per-tenant module entitlements (see src/lib/modules.js)
--    A row's presence = granted. Optional modules are absent (= off) by default.
-- =====================================================================
create table if not exists tenant_modules (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  module_key  text not null,
  enabled     boolean not null default true,
  granted_at  timestamptz not null default now(),
  primary key (tenant_id, module_key)
);

-- =====================================================================
-- 4. Items (products) — shape matches the existing POS / ManageItems UI
-- =====================================================================
create table if not exists items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  capacity      text,                       -- e.g. "500 ml", "1 Ltr" (packaged label)
  price         numeric(12,2) not null check (price > 0),  -- rupees per rate_unit, exact
  pricing_mode  text not null default 'packaged',  -- 'packaged' | 'loose'
  rate_unit     text not null default 'piece',     -- piece | g | kg | ml | l
  image         text,                       -- URL or base64 data-uri
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists items_tenant_idx on items(tenant_id);

-- =====================================================================
-- 5. Customers — RFID-tap identity + per-tenant display code
-- =====================================================================
create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  rfid            text,
  customer_code   text,        -- per-tenant display id, e.g. "CD1"
  sequence_number int,         -- per-tenant running number
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, rfid),
  unique (tenant_id, customer_code)
);
create index if not exists customers_tenant_idx on customers(tenant_id);
create index if not exists customers_rfid_idx on customers(tenant_id, rfid);

-- =====================================================================
-- 6. Transactions — embedded items[] array (mirrors the POS cart)
-- =====================================================================
create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   text,                      -- customer uuid string
  customer_name text,
  items         jsonb not null default '[]'::jsonb,  -- [{itemId,itemName,quantity,unitPrice,total}]
  total         numeric(12,2) not null default 0,
  status        text not null default 'completed',
  source        text not null default 'pos',  -- 'pos' (counter) | 'delivery' (round)
  date          date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists transactions_tenant_idx on transactions(tenant_id, created_at desc);
create index if not exists transactions_customer_idx on transactions(tenant_id, customer_id);

-- =====================================================================
-- 7. Invoices — rich document shape used by InvoiceManagement / CustomerInvoice
-- =====================================================================
create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  invoice_id       text,                     -- human invoice number (also used as lookup)
  customer_id      text,
  customer_name    text,
  customer_phone   text,
  customer_email   text,
  start_date       date,
  end_date         date,
  orders           jsonb not null default '[]'::jsonb,
  item_ids         jsonb not null default '[]'::jsonb,
  total_amount     numeric(12,2) not null default 0,
  paid_amount      numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payments         jsonb not null default '[]'::jsonb,
  payment_status   text not null default 'unpaid',  -- 'unpaid' | 'partial' | 'paid'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, invoice_id)
);
create index if not exists invoices_tenant_idx on invoices(tenant_id, created_at desc);
create index if not exists invoices_customer_idx on invoices(tenant_id, customer_id);

-- =====================================================================
-- 7b. Payments — stored SEPARATELY from invoices. Khaata due is computed
--     live as sum(transactions.total) - sum(payments.amount) per customer.
--     Invoices are generated on demand and never stored.
-- =====================================================================
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id text not null,                 -- customer uuid (matches transactions.customer_id)
  invoice_id  text,                          -- set only for invoice-targeted payments; null = FIFO
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null default 'cash',  -- 'cash' | 'upi' | 'other'
  note        text,
  paid_at     date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists payments_tenant_idx on payments(tenant_id, created_at desc);
create index if not exists payments_customer_idx on payments(tenant_id, customer_id);
create index if not exists payments_invoice_idx on payments(tenant_id, invoice_id);

-- =====================================================================
-- 7c. Standing orders — a customer's usual daily item + qty (delivery round).
--     A delivery is a transaction with source='delivery'.
-- =====================================================================
create table if not exists standing_orders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id text not null,
  item_id     uuid references items(id) on delete cascade,
  item_name   text not null,
  quantity    numeric(12,3) not null check (quantity > 0),
  sale_unit   text not null default 'piece',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, customer_id, item_id)
);
create index if not exists standing_orders_tenant_idx on standing_orders(tenant_id);
create index if not exists standing_orders_customer_idx on standing_orders(tenant_id, customer_id);

-- =====================================================================
-- 8. Audit log
-- =====================================================================
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenants(id) on delete cascade,
  actor_id   uuid references app_users(id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 9. Auth helpers (SECURITY DEFINER so RLS can call them without recursion)
-- =====================================================================
create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from app_users where id = auth.uid();
$$;

create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from app_users where id = auth.uid()), false);
$$;

-- =====================================================================
-- 10. Enable RLS + policies
-- =====================================================================
alter table tenants          enable row level security;
alter table app_users        enable row level security;
alter table tenant_modules   enable row level security;
alter table items            enable row level security;
alter table customers        enable row level security;
alter table transactions     enable row level security;
alter table invoices         enable row level security;
alter table payments         enable row level security;
alter table standing_orders  enable row level security;
alter table audit_log        enable row level security;

-- tenants: super_admin sees all; a member sees their own shop
drop policy if exists tenants_read on tenants;
create policy tenants_read on tenants for select
  using (is_super_admin() or id = current_tenant_id());
drop policy if exists tenants_write on tenants;
create policy tenants_write on tenants for all
  using (is_super_admin() or id = current_tenant_id())
  with check (is_super_admin() or id = current_tenant_id());

-- app_users
drop policy if exists app_users_read on app_users;
create policy app_users_read on app_users for select
  using (is_super_admin() or id = auth.uid() or tenant_id = current_tenant_id());
drop policy if exists app_users_write on app_users;
create policy app_users_write on app_users for all
  using (is_super_admin() or tenant_id = current_tenant_id())
  with check (is_super_admin() or tenant_id = current_tenant_id());

-- tenant_modules: only super_admin manages; tenant reads its own
drop policy if exists tenant_modules_read on tenant_modules;
create policy tenant_modules_read on tenant_modules for select
  using (is_super_admin() or tenant_id = current_tenant_id());
drop policy if exists tenant_modules_write on tenant_modules;
create policy tenant_modules_write on tenant_modules for all
  using (is_super_admin()) with check (is_super_admin());

-- business tables: tenant-scoped read+write (super_admin spans all)
do $$
declare t text;
begin
  foreach t in array array['items','customers','transactions','invoices','payments','standing_orders','audit_log']
  loop
    execute format('drop policy if exists %1$s_rw on %1$s;', t);
    execute format($f$
      create policy %1$s_rw on %1$s for all
        using (is_super_admin() or tenant_id = current_tenant_id())
        with check (is_super_admin() or tenant_id = current_tenant_id());
    $f$, t);
  end loop;
end $$;

-- =====================================================================
-- 11. Auto-create an app_users row on signup (defaults to staff, no tenant).
--     The super_admin then assigns tenant + role.
-- =====================================================================
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_users (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Backfill: ensure any users created BEFORE this schema ran get an app_users row
-- (the trigger above only fires for new signups).
insert into app_users (id, email, role)
select id, email, 'staff' from auth.users
on conflict (id) do nothing;

-- =====================================================================
-- 13. customer_balances — outstanding = INVOICED − PAID per customer.
--     Purchases/deliveries are usage and only become outstanding once invoiced.
--     Pre-aggregated so the Customers list / dashboard fetch tiny rows.
--     security_invoker keeps per-tenant RLS.
-- =====================================================================
create or replace view customer_balances
with (security_invoker = true) as
with inv as (
  select tenant_id, customer_id, sum(total_amount) as invoiced
  from invoices
  where customer_id is not null
  group by tenant_id, customer_id
),
pmt as (
  select tenant_id, customer_id, sum(amount) as paid
  from payments
  group by tenant_id, customer_id
)
select
  coalesce(inv.tenant_id, pmt.tenant_id)      as tenant_id,
  coalesce(inv.customer_id, pmt.customer_id)  as customer_id,
  coalesce(inv.invoiced, 0)                   as invoiced,
  coalesce(pmt.paid, 0)                        as paid,
  coalesce(inv.invoiced, 0) - coalesce(pmt.paid, 0) as due
from inv
full outer join pmt
  on inv.tenant_id = pmt.tenant_id and inv.customer_id = pmt.customer_id;

grant select on customer_balances to authenticated;
