-- Khatape — per-tenant toggle: open WhatsApp automatically after each POS sale.
-- Off by default (keeps the counter flow fast); the shop can turn it on in Settings.
alter table tenants add column if not exists wa_on_purchase boolean not null default false;
