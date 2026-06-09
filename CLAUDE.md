# Khatape — Build Instructions for Claude

> Read this first, every session. Khatape is a multi-tenant SaaS **POS + khaata ledger** for Indian dairy/grocery shops: a customer is identified by an **RFID tap**, buys **packaged *and* loose goods**, purchases go on their **khaata (running ledger)**, and **monthly/bulk invoices** close it out (WhatsApp + thermal receipts). One super-admin (the operator) runs many shops and decides, **per shop, which modules are switched on**.

This file is *how we build it*. The robust, tested core already exists — extend it, don't reinvent it.

---

## 1. Current state

- **Forked** from a proven single-shop dairy POS (React-Rfid) purely to **reuse its React UI**. Secrets (`.env.local`, `.firebaserc`) and git history were **not** copied. Renamed to `khatape`.
- **Robust domain core is built and tested** in `src/lib/` — **34 Vitest tests pass** (`npm test`). This is the part that must never regress.
- **Backend is being moved Firebase → Supabase.** The forked UI still imports the old Firebase data layer; porting it to Supabase is the main remaining work (build order in §8).

---

## 2. Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 19 + Vite 7 + Tailwind v4** (SPA) | Reuse the forked UI; fast, simple, no SSR overhead for an internal POS |
| Backend | **Supabase** — Postgres + RLS + Auth + Realtime + Edge Functions | Replaces Firebase. Real **per-row tenant isolation** (React-Rfid had *no* security rules), **ACID** money math, and **SQL** for module entitlements, reporting, and 2000-row bulk ops |
| Domain core | **Pure JS in `src/lib/`** (no UI/backend imports) | Backend-agnostic and unit-tested — the robustness lives here |
| PDF / QR / receipts | jsPDF, qrcode, Web Bluetooth thermal | Ported from the fork |
| Tests | **Vitest** | `npm test` |

Money is **always integer paise** — never floats. (`src/lib/money.js`.)

---

## 3. The module system (the centrepiece — `src/lib/modules.js`)

The operator controls, per shop, "what each shop deserves."

- **Registry** `MODULES`: each feature has a key + `core` flag.
  - **Core** (`pos`, `customers`, `products`, `ledger`, `invoicing`) — always on.
  - **Optional** (`loose_items`, `standing_orders`, `prepaid_wallet`, `bulk_invoice`, `bulk_import`, `whatsapp`, `thermal_print`, `gst`, `analytics`, `customer_self_view`) — **off by default**, granted per tenant by the super-admin.
- **Guarantee (tested):** a **new** optional module added to the registry is **disabled for every existing tenant** until explicitly granted — so shipping a feature can never silently change a live shop's app. This is exactly the "set for specific tenants, not all" requirement.
- **Persistence:** a `tenant_modules` row per (tenant, module). The pure functions (`isModuleEnabled`, `grantModule`, `revokeModule`, `enabledModules`) are the source of truth for the *rules*; the DB stores the *flags*.
- **Enforcement:** gate **both** UI (hide nav/routes) **and** server (Edge Function / RLS / RPC checks). Never rely on hiding UI alone.

---

## 4. Items & pricing — loose + packaged (`src/lib/pricing.js`, `units.js`)

A product is `{ id, name, pricingMode, ratePaise, rateUnit }`:
- **packaged**: `ratePaise` = price per piece, `rateUnit: "piece"`, whole quantities only.
- **loose**: `ratePaise` = price per `rateUnit` (`g|kg|ml|l`), decimal quantities, sellable in any unit of the same family.

Use:
- `computeLineTotal(product, quantity, saleUnit)` — e.g. 1.5 L @ ₹54/L → ₹81; 500 ml of that → ₹27.
- `quantityForAmount(product, amountPaise, saleUnit)` — **rupee-first** entry ("₹40 of milk" → litres).
- `computeCartTotal(lines)` — mixed loose + packaged.

---

## 5. Multi-tenant + RLS (the robustness React-Rfid lacked)

- A **`tenants`** (shops) table holds per-shop config — name, GST number, UPI id, branding — **replacing every hardcoded "Chamunda Dairy" / UPI / function-URL** value from the fork.
- **Every business row carries `tenant_id`.** RLS policies enforce: a shop's admin/staff can only read/write **their** tenant's rows; the **super-admin** role spans all tenants and manages `tenant_modules`.
- Privileged/cross-tenant work runs in **Supabase Edge Functions** with the service-role key — **server-side only, never shipped to the browser**.
- Realtime (live POS/orders) subscribes filtered by `tenant_id`.

### Data model (Postgres, snake_case)
`tenants` · `app_users` (role: `super_admin|admin|staff`, `tenant_id`) · `customers` (rfid, phone, opening balance) · `products` (packaged/loose, `rate_paise`, `rate_unit`) · `transactions` + `transaction_items` (**price snapshot** at sale time) · `ledger_entries` (unified khaata **and** prepaid wallet — sign of balance distinguishes due vs credit) · `invoices` · `payments` · `tenant_modules` · `audit_log`.

Generate types from the live schema once it exists; don't hand-maintain them.

---

## 6. Reuse map (from the fork)

- **Keep / port:** `src/components`, `src/layouts`, `src/pages` (UI shells), the jsPDF invoice + UPI-QR generator, WhatsApp message formatting, thermal-printer service, RFID-as-keyboard capture.
- **Replace:** `src/services/firebase.js`, `adminAPI.js`, `staffAPI.js` → a Supabase data layer. `functions/` (Firebase Cloud Functions) → Supabase Edge Functions / Postgres RPCs.
- **De-hardcode:** every `Chamunda Dairy`, UPI id `…@okbizaxis`, and `dairy-69` Cloud-Function URL → read from `tenants` config.

---

## 7. Conventions

- Money = **integer paise**, everywhere. Validate inputs at the boundary (`src/lib/validation.js`) — valid passes, invalid is rejected with reasons (never crashes).
- snake_case DB columns / camelCase JS.
- Always handle **loading / error / empty** in UI. POS must be fast and usable on a counter tablet.
- The `src/lib/` core must stay **100% green** — add a test with every new rule. See `docs/TEST-PLAN.md`.

---

## 8. Build order

1. **Supabase project** → schema migration + RLS policies + seed **one** test tenant.
2. **Auth + roles** (super_admin / admin / staff) on Supabase Auth.
3. **Port POS + customers + products** to the Supabase data layer; add the **loose-item** UI (uses `pricing.js`) — this is the headline feature for the new shops.
4. **Super-admin portal** + **module entitlements** UI (grant/revoke per tenant).
5. **Bulk customer import** (uses `src/lib/bulkImport.js`) — onboard the 2000+ customer shop.
6. **Invoicing** → monthly + **bulk invoice**; **ledger/wallet** views.
7. **WhatsApp / thermal / PDF** receipts, then GST & analytics modules.

---

## 9. Commands & env

```
npm run dev     # Vite dev server
npm run build   # production build
npm test        # Vitest — the src/lib core must pass
npm run lint
```
Env (`.env.local`, gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The service-role key lives **only** in Edge Functions. Per-shop config (UPI, GST, name) lives in the `tenants` table, **not** in env.

---

*Vision in one line: React-Rfid's simplicity, but multi-tenant, loose-goods-ready, module-gated per shop, and robust enough for a shop with 2000+ customers from day one.*
