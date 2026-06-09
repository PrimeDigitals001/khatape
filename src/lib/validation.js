// Input validation at the data boundary. Every validator returns an array of error
// strings (empty array == valid) so callers can show all problems at once and so bulk
// import can report per-row reasons without throwing.

import { isLooseUnit, PACKAGED_UNIT } from "./units.js";

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Strip non-digits and drop a leading 91 country code; returns the bare 10-digit number. */
export function normalizePhone(input) {
  if (typeof input !== "string" && typeof input !== "number") return "";
  const digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

export function validateCustomer(c) {
  if (!c || typeof c !== "object") return ["customer must be an object"];
  const errors = [];
  if (!c.name || typeof c.name !== "string" || c.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (!INDIAN_MOBILE_RE.test(normalizePhone(c.phone))) {
    errors.push("phone must be a valid 10-digit Indian mobile (starts 6-9)");
  }
  const rfid = c.rfid == null ? "" : String(c.rfid).trim();
  if (rfid !== "" && !/^\d{4,}$/.test(rfid)) {
    errors.push("rfid must be at least 4 digits when provided");
  }
  return errors;
}

export function validateProduct(p) {
  if (!p || typeof p !== "object") return ["product must be an object"];
  const errors = [];
  if (!p.name || typeof p.name !== "string" || p.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (p.pricingMode !== "packaged" && p.pricingMode !== "loose") {
    errors.push("pricingMode must be 'packaged' or 'loose'");
  }
  if (!Number.isInteger(p.ratePaise) || p.ratePaise <= 0) {
    errors.push("ratePaise must be a positive integer");
  }
  if (p.pricingMode === "packaged" && p.rateUnit !== PACKAGED_UNIT) {
    errors.push("packaged item rateUnit must be 'piece'");
  }
  if (p.pricingMode === "loose" && !isLooseUnit(p.rateUnit)) {
    errors.push("loose item rateUnit must be one of g/kg/ml/l");
  }
  return errors;
}

/** Convenience: true when a validator returned no errors. */
export function isValid(errors) {
  return Array.isArray(errors) && errors.length === 0;
}
