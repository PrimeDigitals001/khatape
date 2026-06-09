import { supabase } from "./supabase";
import { MODULES, isModuleEnabled } from "../lib/modules";

// Resolves the logged-in user's role + active tenant for the data layer.
// app_users holds (role, tenant_id). super_admins have tenant_id = null and may
// operate across tenants; until the super-admin portal ships, they default to a
// chosen "active tenant" (persisted in localStorage) or the first tenant.

const ACTIVE_TENANT_KEY = "khatape.activeTenantId";

let cachedAppUser = null; // { id, role, tenant_id, email, name }

let cachedModules = null; // { tenantId, keys: Set }

export function clearSessionCache() {
  cachedAppUser = null;
  cachedModules = null;
}

// Module keys enabled for the active tenant (core modules are always on).
// Returns a Set of keys, e.g. { 'pos','customers',...,'standing_orders' }.
export async function getEnabledModules() {
  const tenantId = await getActiveTenantId();
  if (cachedModules && cachedModules.tenantId === tenantId) return cachedModules.keys;

  const { data, error } = await supabase
    .from("tenant_modules")
    .select("module_key, enabled")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const entitlements = {};
  (data || []).forEach((r) => {
    if (r.enabled) entitlements[r.module_key] = true;
  });

  const keys = new Set(
    Object.keys(MODULES).filter((k) => isModuleEnabled(entitlements, k))
  );
  cachedModules = { tenantId, keys };
  return keys;
}

export async function isModuleOn(key) {
  const keys = await getEnabledModules();
  return keys.has(key);
}

export async function getAppUser() {
  if (cachedAppUser) return cachedAppUser;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("app_users")
    .select("id, role, tenant_id, email, name")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  cachedAppUser = data;
  return data;
}

const ACTIVE_TENANT_NAME_KEY = "khatape.activeTenantName";

export function setActiveTenantId(tenantId, tenantName) {
  if (tenantId) {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    if (tenantName) localStorage.setItem(ACTIVE_TENANT_NAME_KEY, tenantName);
  } else {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(ACTIVE_TENANT_NAME_KEY);
  }
}

export function getActiveTenantName() {
  return localStorage.getItem(ACTIVE_TENANT_NAME_KEY) || "";
}

// The tenant whose data the app is currently operating on.
export async function getActiveTenantId() {
  const appUser = await getAppUser();
  if (appUser.tenant_id) return appUser.tenant_id; // admin/staff: their own shop

  // super_admin (no fixed tenant): use the chosen active tenant, else the first one.
  const stored = localStorage.getItem(ACTIVE_TENANT_KEY);
  if (stored) return stored;

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No tenants exist yet. Seed a tenant first.");
  setActiveTenantId(data.id);
  return data.id;
}
