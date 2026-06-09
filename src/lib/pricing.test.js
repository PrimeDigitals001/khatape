import { describe, it, expect } from "vitest";
import { computeLineTotal, quantityForAmount, computeCartTotal } from "./pricing.js";

const looseMilk = { id: "milk", name: "Loose Milk", pricingMode: "loose", ratePaise: 5400, rateUnit: "l" }; // ₹54/L
const looseSugar = { id: "sugar", name: "Sugar", pricingMode: "loose", ratePaise: 4500, rateUnit: "kg" }; // ₹45/kg
const amulTaza = { id: "taza", name: "Amul Taza", pricingMode: "packaged", ratePaise: 2800, rateUnit: "piece" }; // ₹28/pc

describe("pricing — loose goods (the headline gap over React-Rfid)", () => {
  it("prices loose milk by the litre, decimals allowed", () => {
    expect(computeLineTotal(looseMilk, 1.5, "l")).toBe(8100); // ₹81
    expect(computeLineTotal(looseMilk, 2, "l")).toBe(10800); // ₹108
  });

  it("prices a loose item entered in a different unit of the same family", () => {
    expect(computeLineTotal(looseMilk, 500, "ml")).toBe(2700); // 500 ml of ₹54/L = ₹27
    expect(computeLineTotal(looseSugar, 250, "g")).toBe(1125); // 250 g of ₹45/kg = ₹11.25
  });

  it("supports rupee-first entry ('₹40 of milk')", () => {
    const r = quantityForAmount(looseMilk, 4000, "l");
    expect(r.quantity).toBeCloseTo(0.741, 3); // 4000 / 5400 ≈ 0.7407 -> 0.741 L
    expect(r.totalPaise).toBe(computeLineTotal(looseMilk, r.quantity, "l"));
    expect(r.totalPaise).toBeLessThanOrEqual(4010);
  });

  it("rejects a decimal quantity on a packaged item", () => {
    expect(() => computeLineTotal(amulTaza, 1.5, "piece")).toThrow();
  });

  it("rejects incompatible sale units", () => {
    expect(() => computeLineTotal(looseMilk, 1, "kg")).toThrow(); // volume vs weight
    expect(() => computeLineTotal(amulTaza, 1, "kg")).toThrow();
  });

  it("rejects bad product config and bad quantities", () => {
    expect(() => computeLineTotal({ pricingMode: "loose", ratePaise: 0, rateUnit: "l" }, 1, "l")).toThrow();
    expect(() => computeLineTotal({ pricingMode: "loose", ratePaise: 100, rateUnit: "piece" }, 1, "piece")).toThrow();
    expect(() => computeLineTotal(looseMilk, 0, "l")).toThrow();
    expect(() => computeLineTotal(looseMilk, -2, "l")).toThrow();
  });
});

describe("pricing — packaged goods", () => {
  it("prices packaged items by whole pieces", () => {
    expect(computeLineTotal(amulTaza, 2, "piece")).toBe(5600);
  });
});

describe("pricing — mixed cart (loose + packaged together)", () => {
  it("totals a cart of loose and packaged lines", () => {
    const cart = [
      { product: amulTaza, quantity: 2, saleUnit: "piece" }, // ₹56.00
      { product: looseMilk, quantity: 1.5, saleUnit: "l" }, // ₹81.00
      { product: looseSugar, quantity: 500, saleUnit: "g" }, // ₹22.50
    ];
    expect(computeCartTotal(cart)).toBe(5600 + 8100 + 2250); // ₹159.50
  });
});
