// Money is represented EVERYWHERE as integer paise (1 rupee = 100 paise).
// Why: floating-point rupees drift (0.1 + 0.2 !== 0.3). For a billing/khaata system
// handling thousands of customers, that drift becomes real money lost. Integers don't drift.

/** Convert a rupee number (possibly with decimals) to integer paise. */
export function rupeesToPaise(rupees) {
  if (typeof rupees !== "number" || !Number.isFinite(rupees)) {
    throw new TypeError(`rupeesToPaise: expected a finite number, got ${rupees}`);
  }
  return Math.round(rupees * 100);
}

/** Convert integer paise back to a rupee number (for display/formatting only). */
export function paiseToRupees(paise) {
  assertPaise(paise);
  return paise / 100;
}

/** Throw unless the value is a valid integer-paise amount. */
export function assertPaise(paise) {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`Money must be integer paise, got ${paise}`);
  }
}

/** Sum any number of paise amounts. Stays exact because everything is integers. */
export function addPaise(...amounts) {
  return amounts.reduce((sum, p) => {
    assertPaise(p);
    return sum + p;
  }, 0);
}

/**
 * Multiply a paise rate by a (possibly fractional) quantity, rounding to the nearest paise.
 * Used for loose goods: e.g. 1.5 litres x 5400 paise/litre = 8100 paise.
 */
export function multiplyPaise(ratePaise, quantity) {
  assertPaise(ratePaise);
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`quantity must be a non-negative finite number, got ${quantity}`);
  }
  return Math.round(ratePaise * quantity);
}

/** Format paise as an Indian-rupee string, e.g. 8100 -> "₹81.00", 10000000 -> "₹1,00,000.00". */
export function formatINR(paise) {
  assertPaise(paise);
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
