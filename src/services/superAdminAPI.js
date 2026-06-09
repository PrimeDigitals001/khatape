import { supabase } from "./supabase";

// Super-admin operations: manage tenants (shops) and their module entitlements.
// RLS lets only super_admins touch tenants/tenant_modules across all rows.

export const superAdminAPI = {
  async listTenants() {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const { data: mods, error: modErr } = await supabase
      .from("tenant_modules")
      .select("tenant_id, module_key, enabled");
    if (modErr) throw modErr;

    const byTenant = {};
    (mods || []).forEach((m) => {
      if (m.enabled) (byTenant[m.tenant_id] = byTenant[m.tenant_id] || []).push(m.module_key);
    });

    // counts per tenant (cheap, single queries)
    const [{ data: custCounts }, { data: itemCounts }] = await Promise.all([
      supabase.from("customers").select("tenant_id"),
      supabase.from("items").select("tenant_id"),
    ]);
    const tally = (rows) => {
      const m = {};
      (rows || []).forEach((r) => { m[r.tenant_id] = (m[r.tenant_id] || 0) + 1; });
      return m;
    };
    const cust = tally(custCounts);
    const items = tally(itemCounts);

    return (tenants || []).map((t) => ({
      ...t,
      modules: byTenant[t.id] || [],
      customerCount: cust[t.id] || 0,
      itemCount: items[t.id] || 0,
    }));
  },

  async createTenant({ name, gstNumber, upiId, phone }) {
    if (!name || !name.trim()) throw new Error("Shop name is required");
    const { data, error } = await supabase
      .from("tenants")
      .insert({
        name: name.trim(),
        gst_number: gstNumber || null,
        upi_id: upiId || null,
        phone: phone || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ---- Tenant logins (via the manage-tenant-users Edge Function) ----
  async _invokeUsers(body) {
    const { data, error } = await supabase.functions.invoke("manage-tenant-users", { body });
    if (error) {
      // surface the function's JSON error message when available
      let msg = error.message;
      try {
        const ctx = await error.context?.json?.();
        if (ctx?.error) msg = ctx.error;
      } catch { /* ignore */ }
      throw new Error(msg || "Login management failed");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async listTenantUsers(tenantId) {
    const data = await this._invokeUsers({ action: "list", tenantId });
    return data.users || [];
  },

  async createTenantUser({ email, password, tenantId, role }) {
    const data = await this._invokeUsers({ action: "create", email, password, tenantId, role });
    return data.user;
  },

  async resetTenantUserPassword({ userId, password }) {
    await this._invokeUsers({ action: "reset_password", userId, password });
    return true;
  },

  async setModule(tenantId, moduleKey, enabled) {
    if (enabled) {
      const { error } = await supabase
        .from("tenant_modules")
        .upsert({ tenant_id: tenantId, module_key: moduleKey, enabled: true }, { onConflict: "tenant_id,module_key" });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("tenant_modules")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("module_key", moduleKey);
      if (error) throw error;
    }
  },
};
