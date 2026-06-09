import { describe, it, expect } from "vitest";
import { importCustomers } from "./bulkImport.js";

describe("bulkImport — robustness on messy real-world data", () => {
  it("imports valid rows and reports invalid ones without throwing", () => {
    const rows = [
      { name: "Ramesh", phone: "9876543210", rfid: "1001" },
      { name: "", phone: "9876500000" }, // bad: no name
      { name: "Sita", phone: "12345" }, // bad: phone
      { name: "Mohan", phone: "9811111111", rfid: "1002" },
    ];
    const res = importCustomers(rows);
    expect(res.validCount).toBe(2);
    expect(res.invalidCount).toBe(2);
    expect(res.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it("flags within-batch duplicate phone and rfid", () => {
    const rows = [
      { name: "A", phone: "9876543210", rfid: "1001" },
      { name: "B", phone: "9876543210", rfid: "1002" }, // duplicate phone
      { name: "C", phone: "9800000000", rfid: "1001" }, // duplicate rfid
    ];
    const res = importCustomers(rows);
    expect(res.validCount).toBe(1);
    expect(res.invalidCount).toBe(2);
  });

  it("handles 2000+ mixed rows fast and correctly (the first shop's real scale)", () => {
    const rows = [];
    for (let i = 0; i < 2000; i++) {
      // 9000000000 + i stays a valid 10-digit number starting with 9, and unique
      rows.push({ name: `Customer ${i}`, phone: String(9000000000 + i), rfid: String(100000 + i) });
    }
    for (let i = 0; i < 50; i++) rows.push({ name: "", phone: "123" }); // 50 bad rows

    const t0 = performance.now();
    const res = importCustomers(rows);
    const ms = performance.now() - t0;

    expect(res.total).toBe(2050);
    expect(res.validCount).toBe(2000);
    expect(res.invalidCount).toBe(50);
    expect(ms).toBeLessThan(1000); // 2050 rows validated in well under a second
  });

  it("throws only when handed something that isn't a batch at all", () => {
    expect(() => importCustomers("nope")).toThrow();
  });
});
