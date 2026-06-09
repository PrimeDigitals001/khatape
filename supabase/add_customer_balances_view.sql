-- Khatape — customer_balances view. Run in SQL Editor (re-runnable, no reset).
--
-- OUTSTANDING MODEL: a customer's pending = INVOICED − PAID.
-- Purchases / deliveries / standing orders are just usage and do NOT count as
-- outstanding until you generate an invoice. Once invoiced, that amount becomes
-- the pending in the customer row. Payments reduce it. (Invoices stay the source
-- of "what is owed"; the khaata is settled from one place.)
--
-- security_invoker = true → runs under the caller's RLS (per-tenant isolation).

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
