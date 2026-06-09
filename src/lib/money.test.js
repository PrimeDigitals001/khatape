import { describe, it, expect } from "vitest";
import {
  rupeesToPaise,
  paiseToRupees,
  multiplyPaise,
  addPaise,
  formatINR,
  assertPaise,
} from "./money.js";

describe("money", () => {
  it("converts rupees to integer paise", () => {
    expect(rupeesToPaise(54)).toBe(5400);
    expect(rupeesToPaise(0.5)).toBe(50);
    expect(rupeesToPaise(28.5)).toBe(2850);
  });

  it("avoids floating-point drift (the 0.1 + 0.2 problem)", () => {
    const total = addPaise(rupeesToPaise(0.1), rupeesToPaise(0.2));
    expect(total).toBe(30);
    expect(paiseToRupees(total)).toBe(0.3);
  });

  it("multiplies a rate by a fractional quantity, rounding to the nearest paise", () => {
    expect(multiplyPaise(5400, 1.5)).toBe(8100); // 1.5 L @ ₹54/L
    expect(multiplyPaise(5400, 0.5)).toBe(2700); // 500 ml
    expect(multiplyPaise(100, 0.333)).toBe(33); // rounds
  });

  it("rejects non-integer paise and bad inputs", () => {
    expect(() => assertPaise(10.5)).toThrow();
    expect(() => rupeesToPaise("54")).toThrow();
    expect(() => rupeesToPaise(Infinity)).toThrow();
    expect(() => multiplyPaise(5400, -1)).toThrow();
    expect(() => multiplyPaise(10.5, 2)).toThrow();
  });

  it("formats Indian rupees", () => {
    expect(formatINR(8100)).toBe("₹81.00");
    expect(formatINR(2850)).toBe("₹28.50");
    expect(formatINR(10000000)).toBe("₹1,00,000.00");
  });
});
