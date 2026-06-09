-- Khatape — incremental migration: add the payments table.
-- Run this ONCE in the SQL Editor on an existing database (no reset needed).
-- (It is also included in schema.sql for fresh installs.)
--
-- Payments are stored SEPARATELY from invoices. The khaata (running due) is
-- computed live as: sum(transactions.total) - sum(payments.amount) per customer.
-- Invoices are generated on demand and never stored.

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

alter table payments enable row level security;
drop policy if exists payments_rw on payments;
create policy payments_rw on payments for all
  using (is_super_admin() or tenant_id = current_tenant_id())
  with check (is_super_admin() or tenant_id = current_tenant_id());
