import { supabase } from "./supabase";
import { getActiveTenantId, setActiveTenantId, getActiveTenantName } from "./session";

// ============================================================
// Khatape admin data layer (Supabase). Method signatures and
// return shapes match what the pages expect so the UI works
// unchanged. Money is stored as exact
// numeric rupees; mappers coerce to JS numbers.
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mapItem = (row) => ({
  id: row.id,
  name: row.name,
  capacity: row.capacity,
  price: Number(row.price),
  pricingMode: row.pricing_mode || "packaged",
  rateUnit: row.rate_unit || "piece",
  image: row.image,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCustomer = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  rfid: row.rfid,
  customerId: row.customer_code || row.id,
  displayId: row.customer_code || row.id,
  sequenceNumber: row.sequence_number,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapInvoice = (row) => ({
  id: row.invoice_id || row.id,
  invoiceId: row.invoice_id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  customerEmail: row.customer_email,
  startDate: row.start_date,
  endDate: row.end_date,
  orders: row.orders || [],
  itemIds: row.item_ids || [],
  totalAmount: Number(row.total_amount),
  paidAmount: Number(row.paid_amount),
  remainingAmount: Number(row.remaining_amount),
  payments: row.payments || [],
  paymentStatus: row.payment_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Derive a 2-letter client prefix from the shop name (mirrors the old logic).
const generateClientPrefix = (name) => {
  const words = (name || "")
    .toLowerCase()
    .replace(/\b(dairy|farm|milk|foods?|products?|company|co|ltd|pvt|private|limited|test)\b/g, "")
    .replace(/[()]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1 && words[0].length >= 2) return words[0].substring(0, 2).toUpperCase();
  return (name || "SH").substring(0, 2).toUpperCase();
};

const paginate = (all, page, limit) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  return {
    slice: all.slice(startIndex, endIndex),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(all.length / limit),
      totalItems: all.length,
      itemsPerPage: limit,
      hasNextPage: endIndex < all.length,
      hasPrevPage: page > 1,
    },
  };
};

export const adminAPI = {
  delay: (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms)),

  // ============================ ITEMS ============================
  async getItems(page = 1, limit = 10, search = "") {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    let items = (data || []).map(mapItem);
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter(
        (i) =>
          (i.name || "").toLowerCase().includes(s) ||
          (i.capacity || "").toLowerCase().includes(s)
      );
    }
    const { slice, pagination } = paginate(items, page, limit);
    return { success: true, data: { items: slice, pagination }, message: "Items retrieved successfully" };
  },

  async getItemById(id) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("items").select("*").eq("tenant_id", tenantId).eq("id", String(id)).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Item not found");
    return { success: true, data: mapItem(data), message: "Item found successfully" };
  },

  async createItem(itemData) {
    const tenantId = await getActiveTenantId();
    const pricingMode = itemData.pricingMode === "loose" ? "loose" : "packaged";
    const rateUnit = pricingMode === "loose" ? itemData.rateUnit : "piece";
    if (!itemData.name || !itemData.price) throw new Error("Name and price are required");
    if (pricingMode === "packaged" && !itemData.capacity) throw new Error("Capacity is required for packaged items");
    if (pricingMode === "loose" && !["g", "kg", "ml", "l"].includes(rateUnit)) {
      throw new Error("Loose items need a unit (g, kg, ml or l)");
    }
    if (parseFloat(itemData.price) <= 0) throw new Error("Price must be greater than 0");
    const payload = {
      tenant_id: tenantId,
      name: itemData.name.trim(),
      capacity: itemData.capacity || null,
      price: parseFloat(itemData.price),
      pricing_mode: pricingMode,
      rate_unit: rateUnit,
      image: itemData.image || null,
    };
    const { data, error } = await supabase.from("items").insert(payload).select().single();
    if (error) throw error;
    return { success: true, data: mapItem(data), message: "Item created successfully" };
  },

  async updateItem(id, itemData) {
    const tenantId = await getActiveTenantId();
    const pricingMode = itemData.pricingMode === "loose" ? "loose" : "packaged";
    const rateUnit = pricingMode === "loose" ? itemData.rateUnit : "piece";
    if (!itemData.name || !itemData.price) throw new Error("Name and price are required");
    if (pricingMode === "packaged" && !itemData.capacity) throw new Error("Capacity is required for packaged items");
    if (pricingMode === "loose" && !["g", "kg", "ml", "l"].includes(rateUnit)) {
      throw new Error("Loose items need a unit (g, kg, ml or l)");
    }
    if (parseFloat(itemData.price) <= 0) throw new Error("Price must be greater than 0");
    const { data, error } = await supabase
      .from("items")
      .update({
        name: itemData.name.trim(),
        capacity: itemData.capacity || null,
        price: parseFloat(itemData.price),
        pricing_mode: pricingMode,
        rate_unit: rateUnit,
        image: itemData.image !== undefined ? itemData.image : null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId).eq("id", String(id))
      .select().single();
    if (error) throw error;
    return { success: true, data: mapItem(data), message: "Item updated successfully" };
  },

  async deleteItem(id) {
    const tenantId = await getActiveTenantId();
    const { error } = await supabase.from("items").delete().eq("tenant_id", tenantId).eq("id", String(id));
    if (error) throw error;
    return { success: true, data: { id }, message: "Item deleted successfully" };
  },

  // ========================= CUSTOMERS =========================
  async getCustomers(page = 1, limit = 10, search = "") {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers").select("*").eq("tenant_id", tenantId)
      .order("sequence_number", { ascending: true });
    if (error) throw error;
    let customers = (data || []).map(mapCustomer);
    if (search.trim()) {
      const s = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(s) ||
          (c.phone || "").includes(search) ||
          (c.rfid || "").includes(search) ||
          (c.customerId || "").toLowerCase().includes(s)
      );
    }
    const { slice, pagination } = paginate(customers, page, limit);
    return { success: true, data: { customers: slice, pagination }, message: "Customers retrieved successfully" };
  },

  async getCustomerById(id) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers").select("*").eq("tenant_id", tenantId).eq("id", String(id)).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Customer not found");
    return { success: true, data: mapCustomer(data), message: "Customer found successfully" };
  },

  async getCustomerByRfid(rfid) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers").select("*").eq("tenant_id", tenantId).eq("rfid", String(rfid)).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Customer not found");
    return { success: true, data: mapCustomer(data), message: "Customer found successfully" };
  },

  async validateRfid(rfid, excludeCustomerId = null) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("customers").select("id, name").eq("tenant_id", tenantId).eq("rfid", String(rfid));
    if (error) throw error;
    const clash = (data || []).find((c) => String(c.id) !== String(excludeCustomerId));
    if (clash) {
      return { success: true, data: { isValid: false, message: `RFID already registered to ${clash.name || "another user"}` } };
    }
    return { success: true, data: { isValid: true, message: "RFID is available" } };
  },

  async _nextCustomerCode(tenantId) {
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    const prefix = generateClientPrefix(tenant?.name);
    const { data: top } = await supabase
      .from("customers").select("sequence_number").eq("tenant_id", tenantId)
      .order("sequence_number", { ascending: false }).limit(1).maybeSingle();
    const nextSequence = (top?.sequence_number || 0) + 1;
    return { prefix, nextSequence, code: `${prefix}${nextSequence}` };
  },

  async createCustomer(customerData) {
    const tenantId = await getActiveTenantId();
    if (!customerData.name || !customerData.phone || !customerData.rfid) {
      throw new Error("Name, phone, and RFID are required");
    }
    if (String(customerData.phone).length < 10) throw new Error("Phone number must be at least 10 digits");
    const check = await this.validateRfid(customerData.rfid);
    if (!check.data.isValid) throw new Error(check.data.message);

    const { nextSequence, code } = await this._nextCustomerCode(tenantId);
    const payload = {
      tenant_id: tenantId,
      name: customerData.name.trim(),
      phone: customerData.phone,
      email: customerData.email || `${customerData.phone}@sms.local`,
      rfid: customerData.rfid,
      customer_code: code,
      sequence_number: nextSequence,
    };
    const { data, error } = await supabase.from("customers").insert(payload).select().single();
    if (error) throw error;
    return { success: true, data: mapCustomer(data), message: "Customer created successfully" };
  },

  async updateCustomer(id, customerData) {
    const tenantId = await getActiveTenantId();
    if (!customerData.name || !customerData.phone || !customerData.rfid) {
      throw new Error("Name, phone, and RFID are required");
    }
    if (String(customerData.phone).length < 10) throw new Error("Phone number must be at least 10 digits");
    const check = await this.validateRfid(customerData.rfid, id);
    if (!check.data.isValid) throw new Error(check.data.message);
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: customerData.name.trim(),
        phone: customerData.phone,
        email: customerData.email || `${customerData.phone}@sms.local`,
        rfid: customerData.rfid,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId).eq("id", String(id))
      .select().single();
    if (error) throw error;
    return { success: true, data: mapCustomer(data), message: "Customer updated successfully" };
  },

  async deleteCustomer(id) {
    const tenantId = await getActiveTenantId();
    const { error } = await supabase.from("customers").delete().eq("tenant_id", tenantId).eq("id", String(id));
    if (error) throw error;
    return { success: true, data: { id }, message: "Customer deleted successfully" };
  },

  async getNextCustomerNumberForDisplay() {
    try {
      const tenantId = await getActiveTenantId();
      const { prefix, nextSequence, code } = await this._nextCustomerCode(tenantId);
      return {
        success: true,
        data: { nextNumber: nextSequence, nextCustomerId: code, clientPrefix: prefix },
        message: "Next customer number retrieved successfully",
      };
    } catch (error) {
      return {
        success: false,
        data: { nextNumber: 1, nextCustomerId: "Unknown", clientPrefix: "Unknown" },
        message: "Failed to get next customer number",
        error: error.message,
      };
    }
  },

  async migrateExistingCustomers() {
    return { success: true, message: "No migration needed on Supabase" };
  },

  // Bulk-create customers (no RFID — assigned later by tap). `validRows` come from
  // src/lib/bulkImport.js: [{ name, phone, rfid|null, openingBalancePaise }].
  // Opening balance becomes an "opening" transaction so the khaata starts correct.
  async importCustomers(validRows) {
    const tenantId = await getActiveTenantId();
    if (!Array.isArray(validRows) || validRows.length === 0) {
      return { success: true, data: { created: 0, openingBalances: 0 } };
    }
    const { prefix, nextSequence } = await this._nextCustomerCode(tenantId);

    const customerRows = validRows.map((r, i) => ({
      tenant_id: tenantId,
      name: r.name,
      phone: r.phone || null,
      email: r.phone ? `${r.phone}@sms.local` : null,
      rfid: r.rfid || null,
      customer_code: `${prefix}${nextSequence + i}`,
      sequence_number: nextSequence + i,
    }));

    const { data: inserted, error } = await supabase
      .from("customers")
      .insert(customerRows)
      .select("id, customer_code, name");
    if (error) throw error;

    const codeToCust = {};
    (inserted || []).forEach((c) => { codeToCust[c.customer_code] = c; });

    // Opening balance = money already owed → an opening INVOICE (so it shows as
    // outstanding under the invoiced-only model), not a usage transaction.
    const today = new Date().toISOString().split("T")[0];
    const openingInvoices = [];
    validRows.forEach((r, i) => {
      const paise = Number.isInteger(r.openingBalancePaise) ? r.openingBalancePaise : 0;
      if (paise > 0) {
        const cust = codeToCust[`${prefix}${nextSequence + i}`];
        if (cust) {
          const rupees = paise / 100;
          openingInvoices.push({
            tenant_id: tenantId,
            invoice_id: `OPENING-${prefix}${nextSequence + i}`,
            customer_id: cust.id,
            customer_name: cust.name,
            start_date: today,
            end_date: today,
            orders: [{ itemName: "Opening balance", quantity: 1, unitPrice: rupees, total: rupees }],
            total_amount: rupees,
            payment_status: "unpaid",
          });
        }
      }
    });
    if (openingInvoices.length) {
      const { error: invErr } = await supabase.from("invoices").insert(openingInvoices);
      if (invErr) throw invErr;
    }

    return { success: true, data: { created: inserted.length, openingBalances: openingInvoices.length } };
  },

  // ===================== TRANSACTIONS =====================
  async createTransaction(transactionData) {
    const tenantId = await getActiveTenantId();
    if (!transactionData.customerId || !transactionData.items || transactionData.items.length === 0) {
      throw new Error("Customer ID and items are required");
    }
    const payload = {
      tenant_id: tenantId,
      customer_id: String(transactionData.customerId),
      customer_name: transactionData.customerName ?? null,
      items: transactionData.items,
      total: transactionData.total ?? 0,
      status: "completed",
      date: new Date().toISOString().split("T")[0],
    };
    const { data, error } = await supabase.from("transactions").insert(payload).select().single();
    if (error) throw error;
    return { success: true, data: { id: data.id, ...transactionData }, message: "Transaction created successfully" };
  },

  async _getTransaction(tenantId, transactionId) {
    const { data, error } = await supabase
      .from("transactions").select("*").eq("tenant_id", tenantId).eq("id", transactionId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Transaction not found");
    return data;
  },

  async updatePurchase(purchaseId, updatedPurchaseData) {
    const tenantId = await getActiveTenantId();
    if (!purchaseId) throw new Error("Purchase ID is required");
    if (!updatedPurchaseData.quantity || updatedPurchaseData.quantity <= 0) {
      throw new Error("Valid quantity is required");
    }
    const parts = String(purchaseId).split("-");
    const transactionId = parts[0];
    const itemId = parts.slice(1).join("-");
    if (!transactionId || !itemId) throw new Error("Invalid purchase ID format");

    const txn = await this._getTransaction(tenantId, transactionId);
    let found = false;
    const updatedItems = (txn.items || []).map((item) => {
      const matches = String(item.itemId) === String(itemId) || String(item.id) === String(itemId);
      if (matches) {
        found = true;
        const newTotal = (item.unitPrice ?? item.price) * updatedPurchaseData.quantity;
        return { ...item, quantity: updatedPurchaseData.quantity, total: newTotal, isEdited: true, editedAt: new Date().toISOString() };
      }
      return item;
    });
    if (!found) throw new Error("Item not found in transaction");
    const newTotal = updatedItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const { error } = await supabase
      .from("transactions").update({ items: updatedItems, total: newTotal, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", transactionId);
    if (error) throw error;
    const updatedItem = updatedItems.find((i) => String(i.itemId) === String(itemId) || String(i.id) === String(itemId));
    return { success: true, data: { id: purchaseId, transactionId, ...updatedItem }, message: "Purchase updated successfully" };
  },

  async deletePurchase(purchaseId) {
    const tenantId = await getActiveTenantId();
    if (!purchaseId) throw new Error("Purchase ID is required");
    const parts = String(purchaseId).split("-");
    if (parts.length < 2) throw new Error("Invalid purchase ID format. Expected: transactionId-itemId");
    const transactionId = parts[0];
    const itemId = parts.slice(1).join("-");

    const txn = await this._getTransaction(tenantId, transactionId);
    if ((txn.items || []).length <= 1) {
      const { error } = await supabase.from("transactions").delete().eq("tenant_id", tenantId).eq("id", transactionId);
      if (error) throw error;
      return { success: true, data: { id: purchaseId, transactionId, deletedEntireTransaction: true }, message: "Purchase deleted successfully (entire transaction removed)" };
    }
    const updatedItems = (txn.items || []).filter(
      (item) => !(String(item.itemId) === String(itemId) || String(item.id) === String(itemId))
    );
    if (updatedItems.length === (txn.items || []).length) throw new Error("Item not found in transaction");
    const newTotal = updatedItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const { error } = await supabase
      .from("transactions").update({ items: updatedItems, total: newTotal, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", transactionId);
    if (error) throw error;
    return { success: true, data: { id: purchaseId, transactionId, deletedEntireTransaction: false }, message: "Purchase deleted successfully" };
  },

  async getCustomerTransactions(customerId, page = 1, limit = 10) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("transactions").select("*").eq("tenant_id", tenantId).eq("customer_id", String(customerId))
      .order("created_at", { ascending: false });
    if (error) throw error;
    const all = data || [];
    const { slice, pagination } = paginate(all, page, limit);
    return {
      success: true,
      data: {
        transactions: slice,
        pagination,
        summary: { totalTransactions: all.length, totalAmount: all.reduce((sum, t) => sum + Number(t.total || 0), 0) },
      },
      message: "Transactions retrieved successfully",
    };
  },

  async getCustomerOrders(customerId, startDate = null, endDate = null) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("transactions").select("*").eq("tenant_id", tenantId).eq("customer_id", String(customerId));
    if (error) throw error;

    let orders = [];
    (data || []).forEach((transaction) => {
      const transactionDate = transaction.date || (transaction.created_at ? transaction.created_at.split("T")[0] : "");
      (transaction.items || []).forEach((item) => {
        const isCustomItem = item.isCustom || (item.id && String(item.id).startsWith("custom-")) || (item.itemId && String(item.itemId).startsWith("custom-"));
        const effectiveItemId = isCustomItem ? (item.id || item.itemId) : item.itemId;
        if (!effectiveItemId) return;
        orders.push({
          id: `${transaction.id}-${effectiveItemId}`,
          itemId: isCustomItem ? effectiveItemId : String(item.itemId),
          itemName: item.itemName || item.name || "Item",
          date: transactionDate,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? item.price,
          total: item.total,
          transactionId: transaction.id,
          isCustom: isCustomItem,
          originalItemId: effectiveItemId,
        });
      });
    });

    if (startDate && endDate) {
      orders = orders.filter((o) => {
        const d = new Date(o.date);
        return d >= new Date(startDate) && d <= new Date(endDate);
      });
    }
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    return {
      success: true,
      data: {
        orders,
        summary: {
          totalOrders: orders.length,
          totalAmount: orders.reduce((sum, o) => sum + (o.total || 0), 0),
          dateRange: startDate && endDate ? { startDate, endDate } : null,
        },
      },
      message: "Customer orders retrieved successfully",
    };
  },

  // ===================== INVOICES =====================
  // Invoice paid/remaining is DERIVED from the single payments ledger (never stored):
  //  - payments targeted to an invoice (invoice_id) apply to that invoice,
  //  - untargeted (row) payments are allocated FIFO across invoices, oldest first.
  async getCustomerInvoices(customerId) {
    const tenantId = await getActiveTenantId();
    const [invRes, payRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("tenant_id", tenantId).eq("customer_id", String(customerId))
        .order("created_at", { ascending: true }), // oldest first for FIFO
      supabase.from("payments").select("*").eq("tenant_id", tenantId).eq("customer_id", String(customerId)),
    ]);
    if (invRes.error) throw invRes.error;
    if (payRes.error) console.warn("payments unavailable:", payRes.error.message);
    const payments = payRes.error ? [] : payRes.data || [];

    // Build derivation state per invoice (key by invoice_id text, falling back to uuid).
    // `allocs` records EVERY payment portion landing on this invoice so the payment
    // history shows the full paid amount (targeted + FIFO-allocated row payments).
    const invoices = (invRes.data || []).map((row) => ({
      row,
      key: row.invoice_id || row.id,
      total: Number(row.total_amount || 0),
      paid: 0,
      allocs: [], // { payment, applied, targeted }
    }));
    const byKey = {};
    invoices.forEach((i) => { byKey[i.key] = i; });

    // 1) targeted payments → their own invoice (full amount)
    const untargeted = []; // { payment, remaining }
    payments.forEach((p) => {
      const amt = Number(p.amount || 0);
      if (p.invoice_id && byKey[p.invoice_id]) {
        const inv = byKey[p.invoice_id];
        inv.paid += amt;
        inv.allocs.push({ payment: p, applied: amt, targeted: true });
      } else {
        untargeted.push({ payment: p, remaining: amt });
      }
    });
    // 2) untargeted (row) payments → FIFO: oldest payment first, oldest invoice first.
    untargeted.sort((a, b) => new Date(a.payment.created_at) - new Date(b.payment.created_at));
    for (const inv of invoices) {
      let need = Math.max(0, inv.total - inv.paid);
      if (need <= 0) continue;
      for (const u of untargeted) {
        if (need <= 0) break;
        if (u.remaining <= 0) continue;
        const apply = Math.min(need, u.remaining);
        inv.paid += apply;
        inv.allocs.push({ payment: u.payment, applied: apply, targeted: false });
        u.remaining -= apply;
        need -= apply;
      }
    }

    const mapped = invoices.map((inv) => {
      const paid = Math.min(inv.paid, inv.total);
      const remaining = Math.max(0, inv.total - paid);
      const status = paid >= inv.total && inv.total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
      return {
        ...mapInvoice(inv.row),
        paidAmount: paid,
        remainingAmount: remaining,
        paymentStatus: status,
        // Full history: targeted payments + the FIFO-allocated portions of row payments.
        payments: inv.allocs.map((a, idx) => ({
          id: `${a.payment.id}-${idx}`,
          amount: a.applied,
          method: a.payment.method,
          date: a.payment.created_at,
          notes: a.targeted
            ? a.payment.note
            : (a.payment.note ? `${a.payment.note} · ` : "") + "from account payment",
        })),
      };
    });
    // return newest-first for display
    mapped.reverse();
    return { success: true, data: { invoices: mapped }, message: "Customer invoices retrieved successfully" };
  },

  async saveInvoice(invoiceData) {
    const tenantId = await getActiveTenantId();
    const payload = {
      tenant_id: tenantId,
      invoice_id: invoiceData.invoiceId,
      customer_id: String(invoiceData.customerId),
      customer_name: invoiceData.customerName ?? null,
      customer_phone: invoiceData.customerPhone ?? null,
      customer_email: invoiceData.customerEmail ?? null,
      start_date: invoiceData.startDate || null,
      end_date: invoiceData.endDate || null,
      orders: invoiceData.orders || [],
      item_ids: invoiceData.itemIds || [],
      total_amount: invoiceData.totalAmount || 0,
      paid_amount: invoiceData.paidAmount || 0,
      remaining_amount: invoiceData.remainingAmount ?? invoiceData.totalAmount ?? 0,
      payments: invoiceData.payments || [],
      payment_status: invoiceData.paymentStatus || "unpaid",
    };
    const { data, error } = await supabase
      .from("invoices").upsert(payload, { onConflict: "tenant_id,invoice_id" }).select().single();
    if (error) throw error;
    return { success: true, data: mapInvoice(data), message: "Invoice saved successfully" };
  },

  async createInvoice(invoiceData) {
    return this.saveInvoice(invoiceData);
  },

  async updateInvoicePayment(invoiceId, updatedInvoiceData) {
    const tenantId = await getActiveTenantId();
    if (!invoiceId) throw new Error("Invoice ID is required");
    const patch = {
      paid_amount: updatedInvoiceData.paidAmount,
      remaining_amount: updatedInvoiceData.remainingAmount,
      payment_status: updatedInvoiceData.paymentStatus,
      payments: updatedInvoiceData.payments,
      updated_at: new Date().toISOString(),
    };
    let req = supabase.from("invoices").update(patch).eq("tenant_id", tenantId);
    req = UUID_RE.test(String(invoiceId)) ? req.eq("id", String(invoiceId)) : req.eq("invoice_id", String(invoiceId));
    const { data, error } = await req.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Invoice not found");
    return { success: true, data: mapInvoice(data), message: "Invoice payment updated successfully" };
  },

  async sendInvoice(invoiceData) {
    if (!invoiceData.customerId || !invoiceData.orders || invoiceData.orders.length === 0) {
      throw new Error("Customer ID and orders are required");
    }
    const invoice = {
      id: `INV-${Date.now()}`,
      ...invoiceData,
      generatedAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      status: "sent",
    };
    return { success: true, data: invoice, message: `Invoice prepared for ${invoiceData.customerName || "customer"}` };
  },

  // ===================== PAYMENTS + KHAATA (live, never-stored invoices) =====================
  // Record a customer payment (collection). Stored separately from invoices.
  // invoiceId optional: set it to target a specific invoice (invoice tab);
  // omit it for a row/khaata payment that gets allocated to invoices FIFO.
  async recordPayment({ customerId, amount, method = "cash", note, invoiceId } = {}) {
    const tenantId = await getActiveTenantId();
    if (!customerId) throw new Error("Customer is required");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new Error("Enter a valid payment amount");
    const { data, error } = await supabase
      .from("payments")
      .insert({
        tenant_id: tenantId,
        customer_id: String(customerId),
        invoice_id: invoiceId || null,
        amount: amt,
        method: method || "cash",
        note: note || null,
      })
      .select()
      .single();
    if (error) throw error;
    return { success: true, data, message: "Payment recorded successfully" };
  },

  async getCustomerPayments(customerId) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("customer_id", String(customerId))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: { payments: data || [] } };
  },

  async deletePayment(id) {
    const tenantId = await getActiveTenantId();
    const { error } = await supabase.from("payments").delete().eq("tenant_id", tenantId).eq("id", String(id));
    if (error) throw error;
    return { success: true, data: { id }, message: "Payment deleted" };
  },

  // Outstanding for ONE customer: due = INVOICED - PAID (usage isn't owed until invoiced).
  async getCustomerBalance(customerId) {
    const tenantId = await getActiveTenantId();
    const invRes = await supabase
      .from("invoices").select("total_amount").eq("tenant_id", tenantId).eq("customer_id", String(customerId));
    if (invRes.error) throw invRes.error;
    const payRes = await supabase
      .from("payments").select("amount").eq("tenant_id", tenantId).eq("customer_id", String(customerId));
    if (payRes.error) console.warn("payments unavailable:", payRes.error.message);
    const invoiced = (invRes.data || []).reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paid = (payRes.error ? [] : payRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { success: true, data: { invoiced, paid, due: invoiced - paid } };
  },

  // Live khaata for EVERY customer in the tenant — two queries, aggregated in JS
  // (cheap for now; swap to a SQL view/RPC if a shop grows very large).
  // Tolerant of a missing payments table so purchases-based dues still render.
  async getTenantBalances() {
    const tenantId = await getActiveTenantId();

    // Fast path: pre-aggregated view → ~1 tiny row per customer (cheap egress, fast).
    const viewRes = await supabase
      .from("customer_balances")
      .select("customer_id, invoiced, paid, due")
      .eq("tenant_id", tenantId);
    if (!viewRes.error) {
      const map = {};
      (viewRes.data || []).forEach((r) => {
        if (!r.customer_id) return;
        map[r.customer_id] = {
          invoiced: Number(r.invoiced || 0),
          paid: Number(r.paid || 0),
          due: Number(r.due || 0),
        };
      });
      return map;
    }

    // Fallback (view not updated yet): aggregate invoices − payments client-side.
    console.warn("customer_balances view missing/old — re-run add_customer_balances_view.sql:", viewRes.error.message);
    const invRes = await supabase
      .from("invoices").select("customer_id, total_amount").eq("tenant_id", tenantId);
    if (invRes.error) throw invRes.error;
    const payRes = await supabase
      .from("payments").select("customer_id, amount").eq("tenant_id", tenantId);
    const map = {};
    const ensure = (k) => (map[k] = map[k] || { invoiced: 0, paid: 0, due: 0 });
    (invRes.data || []).forEach((i) => {
      if (!i.customer_id) return;
      ensure(i.customer_id).invoiced += Number(i.total_amount || 0);
    });
    (payRes.error ? [] : payRes.data || []).forEach((p) => {
      if (!p.customer_id) return;
      ensure(p.customer_id).paid += Number(p.amount || 0);
    });
    Object.values(map).forEach((b) => { b.due = b.invoiced - b.paid; });
    return map;
  },

  // ===================== TENANT (SHOP) PROFILE =====================
  async getTenantProfile() {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
    if (error) throw error;
    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        phone: data.phone,
        upiId: data.upi_id,
        gstNumber: data.gst_number,
      },
    };
  },

  async updateTenantProfile({ name, phone, upiId, gstNumber } = {}) {
    const tenantId = await getActiveTenantId();
    if (!name || !name.trim()) throw new Error("Shop name is required");
    const { data, error } = await supabase
      .from("tenants")
      .update({
        name: name.trim(),
        phone: phone || null,
        upi_id: upiId || null,
        gst_number: gstNumber || null,
      })
      .eq("id", tenantId)
      .select()
      .single();
    if (error) throw error;
    // keep the sidebar/banner shop name in sync if it was set
    if (getActiveTenantName()) setActiveTenantId(tenantId, data.name);
    return { success: true, data, message: "Shop profile updated" };
  },

  // ===================== STANDING ORDERS + DELIVERY ROUND =====================
  async setStandingOrder({ customerId, itemId, itemName, quantity, saleUnit } = {}) {
    const tenantId = await getActiveTenantId();
    if (!customerId || !itemId) throw new Error("Customer and item are required");
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) throw new Error("Enter a valid quantity");
    const { data, error } = await supabase
      .from("standing_orders")
      .upsert(
        {
          tenant_id: tenantId,
          customer_id: String(customerId),
          item_id: itemId,
          item_name: itemName,
          quantity: qty,
          sale_unit: saleUnit || "piece",
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,customer_id,item_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return { success: true, data, message: "Standing order saved" };
  },

  async getCustomerStandingOrders(customerId) {
    const tenantId = await getActiveTenantId();
    const { data, error } = await supabase
      .from("standing_orders")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("customer_id", String(customerId))
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { success: true, data: { standingOrders: data || [] } };
  },

  async removeStandingOrder(id) {
    const tenantId = await getActiveTenantId();
    const { error } = await supabase.from("standing_orders").delete().eq("tenant_id", tenantId).eq("id", String(id));
    if (error) throw error;
    return { success: true, data: { id } };
  },

  // Was a delivery already recorded for this customer today? (guards double-tap)
  async wasDeliveredToday(customerId) {
    const tenantId = await getActiveTenantId();
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("customer_id", String(customerId))
      .eq("source", "delivery")
      .eq("date", today)
      .limit(1);
    if (error) throw error;
    return (data || []).length > 0;
  },

  // Record a delivery = a transaction with source='delivery' (flows into khaata).
  async recordDelivery({ customerId, customerName, items, total, date } = {}) {
    const tenantId = await getActiveTenantId();
    if (!customerId || !items || items.length === 0) throw new Error("Customer and items are required");
    const payload = {
      tenant_id: tenantId,
      customer_id: String(customerId),
      customer_name: customerName ?? null,
      items,
      total: total ?? 0,
      status: "completed",
      source: "delivery",
      date: date || new Date().toISOString().split("T")[0],
    };
    const { data, error } = await supabase.from("transactions").insert(payload).select().single();
    if (error) throw error;
    return { success: true, data: { id: data.id }, message: "Delivery recorded" };
  },

  // Build today's delivery round: each customer with standing orders, their lines
  // (with current item price), and whether already delivered today.
  async getTodayRound() {
    const tenantId = await getActiveTenantId();
    const today = new Date().toISOString().split("T")[0];
    const [soRes, custRes, itemRes, delRes] = await Promise.all([
      supabase.from("standing_orders").select("*").eq("tenant_id", tenantId).eq("active", true),
      supabase.from("customers").select("id, name, phone, customer_code").eq("tenant_id", tenantId),
      supabase.from("items").select("id, name, price, pricing_mode, rate_unit").eq("tenant_id", tenantId),
      supabase.from("transactions").select("customer_id").eq("tenant_id", tenantId).eq("source", "delivery").eq("date", today),
    ]);
    if (soRes.error) throw soRes.error;
    if (custRes.error) throw custRes.error;
    if (itemRes.error) throw itemRes.error;
    if (delRes.error) throw delRes.error;

    const custMap = {};
    (custRes.data || []).forEach((c) => { custMap[c.id] = c; });
    const itemMap = {};
    (itemRes.data || []).forEach((i) => { itemMap[i.id] = i; });
    const deliveredSet = new Set((delRes.data || []).map((d) => d.customer_id));

    const byCustomer = {};
    (soRes.data || []).forEach((so) => {
      const item = itemMap[so.item_id];
      const key = so.customer_id;
      if (!byCustomer[key]) {
        const c = custMap[key];
        byCustomer[key] = {
          customerId: key,
          name: c?.name || "Unknown",
          code: c?.customer_code,
          phone: c?.phone,
          deliveredToday: deliveredSet.has(key),
          lines: [],
        };
      }
      byCustomer[key].lines.push({
        standingId: so.id,
        itemId: so.item_id,
        itemName: so.item_name || item?.name || "Item",
        quantity: Number(so.quantity),
        saleUnit: so.sale_unit,
        price: item ? Number(item.price) : 0,
        pricingMode: item?.pricing_mode || "packaged",
        rateUnit: item?.rate_unit || "piece",
        missing: !item,
      });
    });

    const round = Object.values(byCustomer).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return { success: true, data: { round, date: today } };
  },

  // ===================== SEARCH =====================
  async searchItems(query, limit = 10) {
    if (!query.trim()) return { success: true, data: [], message: "Please provide a search query" };
    const res = await this.getItems(1, 1000, query);
    const filtered = res.data.items.slice(0, limit);
    return { success: true, data: filtered, query, message: `Found ${filtered.length} items matching "${query}"` };
  },

  async searchCustomers(query, limit = 10) {
    if (!query.trim()) return { success: true, data: [], message: "Please provide a search query" };
    const res = await this.getCustomers(1, 1000, query);
    const filtered = res.data.customers.slice(0, limit);
    return { success: true, data: filtered, query, message: `Found ${filtered.length} customers matching "${query}"` };
  },

  async globalSearch(query, limit = 10) {
    if (!query.trim()) return { success: true, data: [], message: "Please provide a search query" };
    const [itemsRes, customersRes] = await Promise.all([
      this.getItems(1, 1000, query),
      this.getCustomers(1, 1000, query),
    ]);
    const itemResults = itemsRes.data.items.map((i) => ({
      id: i.id, name: i.name, capacity: i.capacity, type: "item", category: "Products", path: "/admin/manage-items",
    }));
    const customerResults = customersRes.data.customers.map((c) => ({
      id: c.id, name: c.name, phone: c.phone, rfid: c.rfid, customerId: c.customerId,
      type: "customer", category: "Customers", path: "/admin/customers",
    }));
    const allResults = [...itemResults, ...customerResults].slice(0, limit);
    return { success: true, data: allResults, query, message: `Found ${allResults.length} results matching "${query}"` };
  },

  // ===================== FILE UPLOAD (client-side base64) =====================
  async uploadImage(file) {
    if (!file) throw new Error("No file provided");
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) throw new Error("Only JPEG, PNG, and WebP images are allowed");
    if (file.size > 100 * 1024) throw new Error("Image size must be less than 100KB");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve({ success: true, data: { url: reader.result, filename: file.name, size: file.size, type: file.type }, message: "Image uploaded successfully" });
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  },

  // ===================== STATS =====================
  async getDashboardStats() {
    const tenantId = await getActiveTenantId();
    const [items, customers, txns] = await Promise.all([
      supabase.from("items").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("transactions").select("total").eq("tenant_id", tenantId),
    ]);
    const transactions = txns.data || [];
    return {
      success: true,
      data: {
        totalItems: items.count || 0,
        totalCustomers: customers.count || 0,
        totalTransactions: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + Number(t.total || 0), 0),
        timestamp: new Date().toISOString(),
      },
      message: "Dashboard statistics retrieved successfully",
    };
  },

  async getItemsCount() {
    const tenantId = await getActiveTenantId();
    const { count } = await supabase.from("items").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    return { success: true, data: { total: count || 0, timestamp: new Date().toISOString() }, message: "Items count retrieved successfully" };
  },

  async getCustomersCount() {
    const tenantId = await getActiveTenantId();
    const { count } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    return { success: true, data: { total: count || 0, timestamp: new Date().toISOString() }, message: "Customers count retrieved successfully" };
  },

  async getTodayStats() {
    const tenantId = await getActiveTenantId();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const { data, error } = await supabase
      .from("transactions").select("*").eq("tenant_id", tenantId)
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (error) throw error;
    const transactions = data || [];
    return {
      success: true,
      data: {
        sales: transactions.reduce((sum, t) => sum + Number(t.total || 0), 0),
        orderCount: transactions.length,
        date: start.toISOString().split("T")[0],
        transactions,
      },
    };
  },

  async getMonthStats() {
    const tenantId = await getActiveTenantId();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const { data, error } = await supabase
      .from("transactions").select("total").eq("tenant_id", tenantId)
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (error) throw error;
    const transactions = data || [];
    return {
      success: true,
      data: {
        sales: transactions.reduce((sum, t) => sum + Number(t.total || 0), 0),
        orderCount: transactions.length,
        monthStart: start.toISOString().split("T")[0],
        monthEnd: end.toISOString().split("T")[0],
      },
    };
  },

  async getOutstandingTotal() {
    // New model: outstanding = live khaata dues (purchases - payments), not stored invoices.
    const balances = await this.getTenantBalances();
    let total = 0;
    let customersWithDue = 0;
    Object.values(balances).forEach((b) => {
      if (b.due > 0) {
        total += b.due;
        customersWithDue += 1;
      }
    });
    return { success: true, data: { total, unpaidInvoiceCount: customersWithDue } };
  },
};
