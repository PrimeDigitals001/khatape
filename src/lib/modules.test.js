import { describe, it, expect } from "vitest";
import {
  isModuleEnabled,
  enabledModules,
  grantModule,
  revokeModule,
  isCoreModule,
  optionalModules,
} from "./modules.js";

describe("modules — per-tenant entitlements (super-admin controlled)", () => {
  it("core modules are always enabled, even with no entitlements", () => {
    expect(isModuleEnabled({}, "pos")).toBe(true);
    expect(isModuleEnabled(null, "ledger")).toBe(true);
    expect(isModuleEnabled(undefined, "customers")).toBe(true);
  });

  it("optional modules are OFF by default", () => {
    expect(isModuleEnabled({}, "standing_orders")).toBe(false);
    expect(isModuleEnabled({}, "gst")).toBe(false);
  });

  it("super-admin grants an optional module to one tenant only", () => {
    const tenant = grantModule({}, "standing_orders");
    expect(isModuleEnabled(tenant, "standing_orders")).toBe(true);
    expect(isModuleEnabled(tenant, "gst")).toBe(false); // others stay off
  });

  it("revoking an optional module disables it again", () => {
    const tenant = revokeModule(grantModule({}, "gst"), "gst");
    expect(isModuleEnabled(tenant, "gst")).toBe(false);
  });

  it("core modules cannot be revoked", () => {
    expect(() => revokeModule({}, "pos")).toThrow();
  });

  it("a FUTURE module stays disabled for existing tenants until explicitly granted", () => {
    // A tenant whose entitlements were saved before a new module shipped.
    const existingTenant = { standing_orders: true };
    expect(isModuleEnabled(existingTenant, "analytics")).toBe(false);
    expect(isModuleEnabled(existingTenant, "some_unreleased_feature")).toBe(false);
  });

  it("reports the enabled set (core + granted) per tenant", () => {
    const tenant = grantModule(grantModule({}, "standing_orders"), "bulk_import");
    const enabled = enabledModules(tenant);
    expect(enabled).toContain("pos"); // core
    expect(enabled).toContain("loose_items"); // now core (default)
    expect(enabled).toContain("whatsapp"); // now core (default)
    expect(enabled).toContain("standing_orders"); // granted optional
    expect(enabled).toContain("bulk_import"); // granted optional
    expect(enabled).not.toContain("gst");
    expect(optionalModules()).not.toContain("pos");
    expect(isCoreModule("pos")).toBe(true);
    expect(isCoreModule("loose_items")).toBe(true);
    expect(isCoreModule("gst")).toBe(false);
  });

  it("rejects granting an unknown module", () => {
    expect(() => grantModule({}, "nope")).toThrow();
  });
});
