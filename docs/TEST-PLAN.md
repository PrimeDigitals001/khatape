# Khatape — Test Plan

"Robust" here has a concrete meaning: **valid data is accepted, wrong data is rejected (not crashed on), and large/multi-tenant data behaves correctly.** The pure domain core is fully unit-tested today; the integration/RLS layer is specified below and gets implemented as the Supabase backend lands.

Run: `npm test` (Vitest). Current status: **34 tests / 6 files, all passing.**

---

## A. Implemented & green (`src/lib`)

### Money (`money.test.js`)
- Rupees → integer paise (whole and decimal).
- **No floating-point drift** — `0.1 + 0.2` in paise is exactly `30`.
- Fractional-rate multiply with paise rounding.
- Rejects non-integer paise, non-numbers, `Infinity`, negative quantities.
- Indian-format currency (`₹1,00,000.00`).

### Units (`units.test.js`)
- Valid units & families (count / weight / volume).
- Conversion within a family (kg↔g, l↔ml).
- **Cross-family conversion refused** (kg→l throws).
- Loose vs packaged unit detection.

### Pricing — loose + packaged (`pricing.test.js`)
- Loose by the litre, decimals allowed (1.5 L @ ₹54/L = ₹81).
- Loose entered in a sibling unit (500 ml of ₹54/L = ₹27; 250 g of ₹45/kg = ₹11.25).
- **Rupee-first** entry (₹40 of milk → quantity, with total recomputed from the rounded qty so they always agree).
- Packaged by whole pieces; **decimal qty on packaged is rejected**.
- Incompatible sale unit rejected (volume vs weight).
- Bad product config rejected (zero/negative rate, wrong unit for mode).
- **Mixed cart** (loose + packaged) totals correctly.

### Modules / entitlements (`modules.test.js`)
- Core modules always enabled (even with empty/null entitlements).
- Optional modules off by default.
- Super-admin grant enables for **one** tenant only; others unaffected.
- Revoke disables; **core modules cannot be revoked**.
- **A future/unknown module stays disabled for existing tenants until granted.**
- Enabled-set reporting; granting an unknown module throws.

### Validation (`validation.test.js`)
- Phone normalization (strip formatting + country code).
- Valid customers/products accepted.
- Invalid rejected **with reasons**: missing name, bad phone, non-9-start mobile, short rfid, zero/negative rate, wrong unit-for-mode, non-object input.

### Bulk import — multi-data (`bulkImport.test.js`)
- Mixed good/bad rows → valid imported, invalid reported, **no throw**.
- Within-batch duplicate phone/rfid flagged.
- **2000 valid + 50 bad rows** → exact counts, completes in < 1 s.
- Non-array input throws (the only hard failure).

---

## B. To implement with the Supabase backend (integration / RLS)

### Multi-tenant isolation (RLS) — the security core
- Shop A's admin **cannot** read or write Shop B's customers/products/transactions/invoices.
- Shop A's staff is limited to POS-scope tables within Shop A.
- Super-admin **can** span tenants and write `tenant_modules`.
- Anonymous/unauthenticated access is denied to all business tables.
- A customer self-view link (when that module is on) exposes **only** that one customer's ledger, nothing else.

### Module gating (server-side)
- Calling a disabled module's endpoint/RPC is rejected server-side, not just hidden in the UI.
- Granting/revoking a module takes effect immediately for the affected tenant only.

### Ledger / money integrity
- Khaata: a sale increases outstanding; a payment reduces it; running balance reconciles across many entries.
- Prepaid wallet (optional module): a sale deducts balance; insufficient balance is refused; recharge credits.
- **Price snapshots:** changing a product's rate does **not** alter the totals of past transactions/invoices.
- Monthly + bulk invoice totals equal the sum of their snapshotted line items.

### Scale / performance
- Seed a tenant with 2000+ customers and a month of transactions; list/search/invoice stay responsive.
- Bulk invoice for all customers completes as a single batched operation.

### Import end-to-end
- A 2000-row CSV import writes valid rows transactionally and returns a per-row error report for the rest.

---

## C. How to extend
Every new business rule ships with a test in the same `src/lib` file pattern. The core staying green is the definition of done.
