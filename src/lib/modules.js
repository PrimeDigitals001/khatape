// Module registry + per-tenant entitlements — the system the super-admin uses to decide
// "what each shop deserves".
//
//   CORE modules     : always available to every tenant (the irreducible POS).
//   OPTIONAL modules : OFF by default; the super-admin grants them per tenant.
//
// Crucial property the founder asked for: when a NEW optional module is added to this
// registry in the future, it is automatically DISABLED for every existing tenant until
// the super-admin explicitly grants it — so a new feature can never silently change the
// app for a shop (and its customers) that wasn't opted in.

export const MODULES = {
  // --- core: always on for every shop ---
  pos: { name: "Point of Sale", core: true },
  customers: { name: "Customers", core: true },
  products: { name: "Products", core: true },
  ledger: { name: "Khaata Ledger", core: true },
  invoicing: { name: "Invoicing", core: true },
  loose_items: { name: "Loose / weighed items", core: true }, // default for all shops
  whatsapp: { name: "WhatsApp delivery", core: true },        // default (prefilled-message shortcut)

  // --- optional: super-admin grants per tenant ---
  standing_orders: { name: "Daily standing orders", core: false },
  prepaid_wallet: { name: "Prepaid wallet", core: false },
  bulk_invoice: { name: "Bulk invoicing", core: false },
  bulk_import: { name: "Bulk customer import", core: false },
  thermal_print: { name: "Thermal receipt printing", core: false },
  gst: { name: "GST billing", core: false },
  analytics: { name: "Analytics", core: false },
  customer_self_view: { name: "Customer self-view link", core: false },
};

export function isKnownModule(key) {
  return Object.prototype.hasOwnProperty.call(MODULES, key);
}

export function isCoreModule(key) {
  return isKnownModule(key) && MODULES[key].core === true;
}

export function optionalModules() {
  return Object.keys(MODULES).filter((k) => !MODULES[k].core);
}

/**
 * Is `key` enabled for a tenant?
 * `entitlements` is the tenant's stored module map, e.g. { loose_items: true, gst: true }.
 * Core modules are always enabled. Unknown / un-granted modules are disabled.
 */
export function isModuleEnabled(entitlements, key) {
  if (!isKnownModule(key)) return false;
  if (MODULES[key].core) return true;
  if (!entitlements || typeof entitlements !== "object") return false;
  return entitlements[key] === true;
}

/** All module keys currently enabled for a tenant (core + granted optional). */
export function enabledModules(entitlements) {
  return Object.keys(MODULES).filter((k) => isModuleEnabled(entitlements, k));
}

// --- super-admin operations (pure: return the next entitlements map; caller persists it) ---

export function grantModule(entitlements, key) {
  if (!isKnownModule(key)) throw new RangeError(`Unknown module: ${key}`);
  if (isCoreModule(key)) return { ...(entitlements || {}) }; // core is always on; no-op
  return { ...(entitlements || {}), [key]: true };
}

export function revokeModule(entitlements, key) {
  if (!isKnownModule(key)) throw new RangeError(`Unknown module: ${key}`);
  if (isCoreModule(key)) throw new Error(`Cannot revoke a core module: ${key}`);
  const next = { ...(entitlements || {}) };
  delete next[key];
  return next;
}
