import { describe, it, expect } from "vitest";
import { convert, sameFamily, isLooseUnit, isValidUnit, unitFamily } from "./units.js";

describe("units", () => {
  it("knows valid units and their families", () => {
    expect(isValidUnit("kg")).toBe(true);
    expect(isValidUnit("dozen")).toBe(false);
    expect(unitFamily("l")).toBe("volume");
    expect(unitFamily("g")).toBe("weight");
    expect(unitFamily("piece")).toBe("count");
  });

  it("converts within a family", () => {
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(500, "ml", "l")).toBe(0.5);
    expect(convert(1.5, "l", "ml")).toBe(1500);
    expect(convert(250, "g", "kg")).toBe(0.25);
  });

  it("refuses cross-family conversion", () => {
    expect(() => convert(1, "kg", "l")).toThrow();
    expect(() => convert(1, "l", "piece")).toThrow();
    expect(sameFamily("kg", "l")).toBe(false);
    expect(sameFamily("ml", "l")).toBe(true);
  });

  it("identifies loose vs packaged units", () => {
    expect(isLooseUnit("kg")).toBe(true);
    expect(isLooseUnit("l")).toBe(true);
    expect(isLooseUnit("piece")).toBe(false);
  });
});
