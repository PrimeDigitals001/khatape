-- Khatape — item codes + customer suspend + card replacement.
-- Idempotent; safe to run on local and cloud.

-- 1. Item codes (per-tenant indexed: <prefix>-I<n>, e.g. CH-I1) ----------------
alter table items add column if not exists item_code text;
alter table items add column if not exists sequence_number int;

-- 2. Customer suspend (temporarily stop service; records are kept) -------------
alter table customers add column if not exists suspended boolean not null default false;

-- 3. Blocked cards — a stolen/replaced RFID stays unusable so it can't be
--    re-registered or tapped to reach the (now reassigned) account.
create table if not exists blocked_cards (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  rfid        text not null,
  customer_id text,                 -- who it used to belong to
  reason      text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, rfid)
);
create index if not exists blocked_cards_tenant_idx on blocked_cards(tenant_id, rfid);
alter table blocked_cards enable row level security;
drop policy if exists blocked_cards_rw on blocked_cards;
create policy blocked_cards_rw on blocked_cards for all
  using (is_super_admin() or tenant_id = current_tenant_id())
  with check (is_super_admin() or tenant_id = current_tenant_id());

-- 4. Backfill item codes for existing items. Prefix is taken from the tenant's
--    existing customer codes (so items match: CH1 -> CH-I1); fallback 'SH'.
with pref as (
  select tenant_id, (regexp_match(min(customer_code), '^[A-Za-z]+'))[1] as prefix
  from customers
  where customer_code ~ '^[A-Za-z]+[0-9]+'
  group by tenant_id
),
numbered as (
  select i.id,
         coalesce(p.prefix, 'SH') as prefix,
         row_number() over (partition by i.tenant_id order by i.created_at, i.id) as rn
  from items i
  left join pref p on p.tenant_id = i.tenant_id
  where i.item_code is null
)
update items set item_code = n.prefix || '-I' || n.rn, sequence_number = n.rn
from numbered n
where items.id = n.id;

create unique index if not exists items_code_idx on items(tenant_id, item_code);
