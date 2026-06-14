// Khatape — customer-view Edge Function (PUBLIC, no login).
// Given a customer's public_token, returns ONLY that customer's own dues +
// recent purchases. Uses the service role server-side; only ever returns the
// single customer matching the token, so RLS is not weakened.
//
// Deploy: Supabase dashboard → Edge Functions → create "customer-view",
// paste this file, and TURN OFF "Verify JWT" (it must be callable without login).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token } = await req.json();
    if (!token) return json(400, { error: "token required" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cust } = await admin
      .from("customers")
      .select("id, tenant_id, name, customer_code, phone")
      .eq("public_token", token)
      .maybeSingle();
    if (!cust) return json(404, { error: "Not found" });

    const [tenantRes, invRes, payRes, txnRes] = await Promise.all([
      admin.from("tenants").select("name, upi_id, phone").eq("id", cust.tenant_id).maybeSingle(),
      admin.from("invoices").select("total_amount").eq("tenant_id", cust.tenant_id).eq("customer_id", cust.id),
      admin.from("payments").select("amount").eq("tenant_id", cust.tenant_id).eq("customer_id", cust.id),
      admin.from("transactions").select("total, items, date")
        .eq("tenant_id", cust.tenant_id).eq("customer_id", cust.id)
        .order("date", { ascending: false }).limit(20),
    ]);

    const invoiced = (invRes.data || []).reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paid = (payRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = invoiced - paid;

    return json(200, {
      shop: tenantRes.data?.name || "Shop",
      shopUpi: tenantRes.data?.upi_id || null,
      shopPhone: tenantRes.data?.phone || null,
      name: cust.name,
      code: cust.customer_code,
      outstanding: due > 0 ? due : 0,
      advance: due < 0 ? -due : 0,
      recent: (txnRes.data || []).map((t) => ({
        date: t.date,
        total: Number(t.total || 0),
        items: (t.items || []).map((it: Record<string, unknown>) => ({
          name: it.itemName || it.name || "Item",
          qty: it.quantity,
          total: it.total,
        })),
      })),
    });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Server error" });
  }
});
