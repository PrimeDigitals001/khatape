import { describe, it, expect } from "vitest";
import { validateCustomer, validateProduct, normalizePhone, isValid } from "./validation.js";

describe("validation — phone normalization", () => {
  it("strips formatting and a leading country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
    expect(normalizePhone(9876543210)).toBe("9876543210");
  });
});

describe("validation — customers", () => {
  it("accepts valid customers", () => {
    expect(isValid(validateCustomer({ name: "Ramesh", phone: "9876543210" }))).toBe(true);
    expect(isValid(validateCustomer({ name: "Sita", phone: "+919812345678", rfid: "100200300" }))).toBe(true);
  });

  it("rejects invalid customers with clear reasons", () => {
    expect(validateCustomer({ name: "", phone: "9876543210" })).toContain("name is required");
    expect(validateCustomer({ name: "X", phone: "12345" }).length).toBeGreaterThan(0);
    expect(validateCustomer({ name: "X", phone: "5876543210" }).length).toBeGreaterThan(0); // starts with 5
    expect(validateCustomer({ name: "X", phone: "9876543210", rfid: "12" })).toContain(
      "rfid must be at least 4 digits when provided",
    );
    expect(validateCustomer(null)).toContain("customer must be an object");
  });
});

describe("validation — products", () => {
  it("accepts valid packaged and loose products", () => {
    expect(isValid(validateProduct({ name: "Amul Taza", pricingMode: "packaged", ratePaise: 2800, rateUnit: "piece" }))).toBe(true);
    expect(isValid(validateProduct({ name: "Loose Milk", pricingMode: "loose", ratePaise: 5400, rateUnit: "l" }))).toBe(true);
  });

  it("rejects invalid products with clear reasons", () => {
    expect(validateProduct({ name: "X", pricingMode: "loose", ratePaise: 0, rateUnit: "l" })).toContain(
      "ratePaise must be a positive integer",
    );
    expect(validateProduct({ name: "X", pricingMode: "packaged", ratePaise: 100, rateUnit: "kg" })).toContain(
      "packaged item rateUnit must be 'piece'",
    );
    expect(validateProduct({ name: "X", pricingMode: "loose", ratePaise: 100, rateUnit: "piece" })).toContain(
      "loose item rateUnit must be one of g/kg/ml/l",
    );
    expect(validateProduct({ name: "", pricingMode: "bogus", ratePaise: 1.5, rateUnit: "x" }).length).toBeGreaterThan(0);
  });
});
