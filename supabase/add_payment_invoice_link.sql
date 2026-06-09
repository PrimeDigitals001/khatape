-- Khatape — incremental migration: link a payment to a specific invoice (optional).
-- Run ONCE in the SQL Editor (no reset needed). Also folded into schema.sql.
--
-- Single payments ledger is the source of truth. invoice_id is set ONLY when a
-- payment is entered against a specific invoice (invoice tab = "targeted").
-- Row payments leave it null and are allocated to invoices FIFO (oldest first).

alter table payments add column if not exists invoice_id text;
create index if not exists payments_invoice_idx on payments(tenant_id, invoice_id);
