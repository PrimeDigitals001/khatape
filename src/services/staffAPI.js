import { supabase } from "./supabase";
import { getActiveTenantId } from "./session";

// Map a DB item row to the shape the UI expects (price as a number).
const mapItem = (row) => ({
  id: row.id,
  name: row.name,
  capacity: row.capacity,
  price: Number(row.price),
  pricingMode: row.pricing_mode || "packaged",
  rateUnit: row.rate_unit || "piece",
  image: row.image,
  itemCode: row.item_code || null,
  displayId: row.item_code || row.id,
});

// Map a DB customer row; the UI reads `customerId` (the per-tenant display code).
const mapCustomer = (row) => ({
  ...row,
  customerId: row.customer_code || row.id,
});

export const staffAPI = {
  // Customer operations
  async getCustomerByRfid(rfid) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("rfid", String(rfid))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Customer not found");
    return { success: true, data: mapCustomer(data), message: "Customer found successfully" };
  },

  // Shop preferences the POS needs (e.g. auto-open WhatsApp after a sale).
  async getShopSettings() {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("tenants").select("wa_on_purchase").eq("id", tenantId).maybeSingle();
    if (error) throw error;
    return { success: true, data: { waOnPurchase: data?.wa_on_purchase || false } };
  },

  async getAllCustomers() {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sequence_number", { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(mapCustomer);
    return { success: true, data: mapped, count: mapped.length };
  },

  // Items operations
  async getAllItems() {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(mapItem);
    return { success: true, data: mapped, count: mapped.length };
  },

  async getItemById(id) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", String(id))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Item not found");
    return { success: true, data: mapItem(data) };
  },

  // Search items by name. Strip PostgREST filter metacharacters (, ( ) *) from the
  // user input so it can't be used to inject extra .or() conditions.
  async searchItems(query) {
    const tenantId = await getActiveTenantId();
    const ql = (query || "").trim().replace(/[,()*]/g, "");
    let req = supabase.from("items").select("*").eq("tenant_id", tenantId);
    if (ql) req = req.or(`name.ilike.%${ql}%,capacity.ilike.%${ql}%`);
    const { data, error } = await req;
    if (error) throw error;
    return { success: true, data: (data || []).map(mapItem), query };
  },

  // Transaction operations
  async createTransaction(transactionData) {
    const tenantId = await getActiveTenantId();
    const payload = {
      tenant_id: tenantId,
      customer_id: transactionData.customerId ? String(transactionData.customerId) : null,
      customer_name: transactionData.customerName ?? null,
      items: transactionData.items ?? [],
      total: transactionData.total ?? 0,
      status: "completed",
      date: new Date().toISOString().split("T")[0],
    };
    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return {
      success: true,
      data: { id: data.id, ...transactionData, status: "completed" },
      message: "Transaction completed successfully",
    };
  },

  async getTransactionById(id) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", String(id))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Transaction not found");
    return { success: true, data };
  },
};
