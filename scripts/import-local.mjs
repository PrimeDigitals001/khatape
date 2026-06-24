// ============================================================================
//  Import React-Rfid (Firestore dump) -> LOCAL Supabase, as practice data.
//  LOCAL ONLY. Refuses to run against anything that isn't 127.0.0.1/localhost.
//
//  Usage (PowerShell):
//     $env:SERVICE_ROLE_KEY="<local service_role key from `npx supabase status`>"
//     node scripts/import-local.mjs
//
//  What it does: reads ../React-Rfid/firestore-dump.json, reshapes Firebase
//  records into the Khatape tables, and loads them into the local DB. It first
//  CLEARS the target tenant's existing customers/items/transactions/invoices/
//  payments (so it's re-runnable and replaces the 2 dummy seed customers).
// ============================================================================

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const KEY = process.env.SERVICE_ROLE_KEY;
const TENANT_NAME = process.env.TENANT_NAME || "Chamunda Dairy";

// --- Safety: never let this touch a cloud/prod project -----------------------
if (!/127\.0\.0\.1|localhost/.test(SUPA_URL)) {
  console.error(`REFUSING: SUPABASE_URL is not local (${SUPA_URL}). This script is local-only.`);
  process.exit(1);
}
if (!KEY) {
  console.error("Missing SERVICE_ROLE_KEY env var (get it from `npx supabase status`).");
  process.exit(1);
}

const sb = createClient(SUPA_URL, KEY, { auth: { persistSession: false } });

// --- Load the dump -----------------------------------------------------------
const dumpUrl = new URL("../../React-Rfid/firestore-dump.json", import.meta.url);
const dump = JSON.parse(readFileSync(dumpUrl, "utf8"));
const shopKey = Object.keys(dump.shops).find((k) => k.toLowerCase().includes("chamunda")) || Object.keys(dump.shops)[0];
const shop = dump.shops[shopKey];
console.log(`Source shop: ${shopKey} — ${shop.customers.length} customers, ${shop.items.length} items, ${shop.transactions.length} txns, ${shop.invoices.length} invoices`);

// --- Date helpers ------------------------------------------------------------
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const isoTs = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : null);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// --- Resolve target tenant ---------------------------------------------------
const { data: tenants, error: tErr } = await sb.from("tenants").select("id, name").order("created_at");
if (tErr) throw tErr;
if (!tenants?.length) { console.error("No tenants exist locally. Run the seed first."); process.exit(1); }
const tenant = tenants.find((t) => t.name === TENANT_NAME) || tenants[0];
const TID = tenant.id;
console.log(`Target tenant: ${tenant.name} (${TID})`);

// --- Clear existing rows for this tenant (local, re-runnable) -----------------
for (const tbl of ["payments", "invoices", "transactions", "standing_orders", "customers", "items"]) {
  const { error } = await sb.from(tbl).delete().eq("tenant_id", TID);
  if (error) throw new Error(`clear ${tbl}: ${error.message}`);
}
console.log("Cleared existing tenant data.");

// --- Batch insert helper -----------------------------------------------------
async function insertAll(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table} insert @${i}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + chunk, rows.length)}/${rows.length}`);
  }
  if (rows.length) process.stdout.write("\n");
}

// --- 1. Customers (build code -> uuid map; dedupe rfid) ----------------------
const codeToId = {};
const seenRfid = new Set();
const customerRows = shop.customers.map((c) => {
  const id = randomUUID();
  const code = c.customerId || c._id;
  codeToId[code] = id;
  let rfid = (c.rfid || "").trim() || null;
  if (rfid && seenRfid.has(rfid)) rfid = null; // unique(tenant_id, rfid)
  if (rfid) seenRfid.add(rfid);
  return {
    id,
    tenant_id: TID,
    name: c.name || "Customer",
    phone: c.phone || null,
    email: c.email || null,
    rfid,
    customer_code: code,
    sequence_number: c.sequenceNumber ?? null,
    created_at: isoTs(c.createdAt) || new Date().toISOString(),
    updated_at: isoTs(c.updatedAt) || new Date().toISOString(),
  };
});
await insertAll("customers", customerRows);

// --- 2. Items (drop the huge base64 images; assign indexed codes CH-I1…) ------
const codePrefix = (customerRows.find((c) => c.customer_code)?.customer_code || "SH").replace(/[0-9].*$/, "") || "SH";
const itemRows = shop.items.map((it, i) => ({
  id: randomUUID(),
  tenant_id: TID,
  name: it.name || "Item",
  capacity: it.capacity || null,
  price: Math.max(num(it.price), 1),
  pricing_mode: "packaged",
  rate_unit: "piece",
  image: null, // base64 images dropped to keep the practice DB lean
  item_code: `${codePrefix}-I${i + 1}`,
  sequence_number: i + 1,
  created_at: isoTs(it.createdAt) || new Date().toISOString(),
  updated_at: isoTs(it.updatedAt) || new Date().toISOString(),
}));
await insertAll("items", itemRows);

// --- 3. Transactions ---------------------------------------------------------
const txnRows = shop.transactions.map((t) => ({
  id: randomUUID(),
  tenant_id: TID,
  customer_id: codeToId[t.customerId] || null,
  customer_name: t.customerName || null,
  items: Array.isArray(t.items) ? t.items : [],
  total: num(t.total),
  status: t.status || "completed",
  source: "pos",
  date: isoDate(t.timestamp) || isoDate(t.createdAt),
  created_at: isoTs(t.timestamp) || isoTs(t.createdAt) || new Date().toISOString(),
}));
await insertAll("transactions", txnRows);

// --- 4. Invoices (dedupe invoice_id) + 5. Payments (separate table) ----------
const invRows = [];
const payRows = [];
const seenInv = new Set();
for (const v of shop.invoices) {
  const invId = v.invoiceId || v._id;
  if (!invId || seenInv.has(invId)) continue;
  seenInv.add(invId);
  const cid = codeToId[v.customerId] || null;
  const created = isoTs(v.createdAt) || isoTs(v.updatedAt) || (v.endDate ? `${v.endDate}T00:00:00Z` : new Date().toISOString());
  invRows.push({
    id: randomUUID(),
    tenant_id: TID,
    invoice_id: invId,
    customer_id: cid,
    customer_name: v.customerName || null,
    customer_phone: v.customerPhone || null,
    start_date: isoDate(v.startDate),
    end_date: isoDate(v.endDate),
    orders: Array.isArray(v.orders) ? v.orders : [],
    item_ids: Array.isArray(v.itemIds) ? v.itemIds : [],
    total_amount: num(v.totalAmount),
    paid_amount: num(v.paidAmount),
    remaining_amount: num(v.remainingAmount),
    payments: Array.isArray(v.payments) ? v.payments : [],
    payment_status: v.paymentStatus || "unpaid",
    created_at: created,
  });
  // Each embedded payment becomes a row in the payments ledger, targeted to this
  // invoice — so outstanding = sum(invoices.total) - sum(payments.amount) is right.
  for (const p of v.payments || []) {
    if (num(p.amount) <= 0) continue;
    payRows.push({
      tenant_id: TID,
      customer_id: cid || "unknown",
      invoice_id: invId,
      amount: num(p.amount),
      method: p.method || "cash",
      note: p.notes || null,
      paid_at: isoDate(p.date) || isoDate(v.endDate) || isoDate(v.startDate) || new Date().toISOString().slice(0, 10),
      created_at: isoTs(p.date) || created,
    });
  }
}
await insertAll("invoices", invRows);
await insertAll("payments", payRows);

// --- Summary -----------------------------------------------------------------
console.log(
  `\n✓ Imported into ${tenant.name}: ${customerRows.length} customers, ${itemRows.length} items, ` +
    `${txnRows.length} transactions, ${invRows.length} invoices, ${payRows.length} payments.`
);
process.exit(0);
