// Bulk customer import — the first prospect shop has 2000+ existing customers, so
// onboarding can't be one-at-a-time. This validates a whole batch and NEVER throws on
// bad row data: valid rows are normalised and returned, invalid rows are reported with
// reasons, and within-batch duplicates (same phone or rfid) are flagged. "All right and
// wrong data should pass" = good rows import, bad rows are caught instead of crashing.

import { validateCustomer, normalizePhone } from "./validation.js";

/**
 * @param {Array<object>} rows  raw customer rows (e.g. parsed from CSV/Excel)
 * @returns {{ valid: Array, invalid: Array, total:number, validCount:number, invalidCount:number }}
 */
export function importCustomers(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");

  const valid = [];
  const invalid = [];
  const seenPhone = new Set();
  const seenRfid = new Set();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const errors = validateCustomer(row);

    const phone = normalizePhone(row && row.phone);
    const rfid = row && row.rfid != null ? String(row.rfid).trim() : "";

    if (phone && seenPhone.has(phone)) errors.push("duplicate phone in batch");
    if (rfid && seenRfid.has(rfid)) errors.push("duplicate rfid in batch");

    if (errors.length === 0) {
      seenPhone.add(phone);
      if (rfid) seenRfid.add(rfid);
      valid.push({
        name: String(row.name).trim(),
        phone,
        rfid: rfid || null,
        openingBalancePaise: Number.isInteger(row.openingBalancePaise) ? row.openingBalancePaise : 0,
      });
    } else {
      invalid.push({ index, row, errors });
    }
  }

  return {
    valid,
    invalid,
    total: rows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
  };
}
