-- Khatape — incremental migration: standing orders (daily delivery round).
-- Run this ONCE in the SQL Editor on an existing database (no reset needed).
-- (Also included in schema.sql for fresh installs.)
--
-- A standing order = a customer's usual daily item + quantity (e.g. 1 L milk/day).
-- A delivery is recorded as a normal transaction with source = 'delivery', so it
-- flows into the same khaata (due = purchases - payments). Invoices stay on-demand.

create table if not exists standing_orders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id text not null,                 -- customer uuid
  item_id     uuid references items(id) on delete cascade,
  item_name   text not null,                 -- snapshot for display
  quantity    numeric(12,3) not null check (quantity > 0),
  sale_unit   text not null default 'piece', -- piece | g | kg | ml | l
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, customer_id, item_id)
);
create index if not exists standing_orders_tenant_idx on standing_orders(tenant_id);
create index if not exists standing_orders_customer_idx on standing_orders(tenant_id, customer_id);

alter table standing_orders enable row level security;
drop policy if exists standing_orders_rw on standing_orders;
create policy standing_orders_rw on standing_orders for all
  using (is_super_admin() or tenant_id = current_tenant_id())
  with check (is_super_admin() or tenant_id = current_tenant_id());

-- Distinguish counter sales from delivery-round entries.
alter table transactions add column if not exists source text not null default 'pos';
