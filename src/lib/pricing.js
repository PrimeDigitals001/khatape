// Pricing engine — the headline gap over React-Rfid, which only sold fixed-price
// PACKAGED units in whole quantities. Khatape sells both:
//
//   packaged : ratePaise is the price per piece; quantity is a whole number.
//   loose    : ratePaise is the price per `rateUnit` (e.g. ₹54/litre); quantity is a
//              decimal in any compatible unit (1.5 l, 500 ml, 0.25 kg, ...).
//
// A product looks like:
//   { id, name, pricingMode: 'packaged' | 'loose', ratePaise, rateUnit }
//      packaged -> rateUnit must be 'piece'
//      loose    -> rateUnit is one of g | kg | ml | l

import { multiplyPaise } from "./money.js";
import { sameFamily, convert, isLooseUnit, PACKAGED_UNIT } from "./units.js";

/** Validate a product's pricing fields. Throws with a clear message on bad config. */
export function validatePricingProduct(product) {
  if (!product || typeof product !== "object") throw new TypeError("product is required");
  if (product.pricingMode !== "packaged" && product.pricingMode !== "loose") {
    throw new RangeError(`pricingMode must be 'packaged' or 'loose', got ${product.pricingMode}`);
  }
  if (!Number.isInteger(product.ratePaise) || product.ratePaise <= 0) {
    throw new RangeError(`ratePaise must be a positive integer, got ${product.ratePaise}`);
  }
  if (product.pricingMode === "packaged" && product.rateUnit !== PACKAGED_UNIT) {
    throw new RangeError(`packaged item rateUnit must be 'piece', got ${product.rateUnit}`);
  }
  if (product.pricingMode === "loose" && !isLooseUnit(product.rateUnit)) {
    throw new RangeError(`loose item rateUnit must be one of g/kg/ml/l, got ${product.rateUnit}`);
  }
}

/**
 * Total (in paise) for selling `quantity` of `product` measured in `saleUnit`.
 *  - packaged: saleUnit must be 'piece' and quantity a whole number.
 *  - loose: saleUnit must share the product's unit family; quantity may be decimal.
 */
export function computeLineTotal(product, quantity, saleUnit) {
  validatePricingProduct(product);
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
    throw new RangeError(`quantity must be a positive number, got ${quantity}`);
  }

  if (product.pricingMode === "packaged") {
    if (saleUnit !== PACKAGED_UNIT) {
      throw new RangeError(`packaged item must be sold in 'piece', got '${saleUnit}'`);
    }
    if (!Number.isInteger(quantity)) {
      throw new RangeError(`packaged item quantity must be a whole number, got ${quantity}`);
    }
    return multiplyPaise(product.ratePaise, quantity);
  }

  // loose
  if (!sameFamily(saleUnit, product.rateUnit)) {
    throw new RangeError(
      `sale unit '${saleUnit}' is not compatible with rate unit '${product.rateUnit}'`,
    );
  }
  const qtyInRateUnit = convert(quantity, saleUnit, product.rateUnit);
  return multiplyPaise(product.ratePaise, qtyInRateUnit);
}

/**
 * Rupee-first entry for loose goods: customer says "₹40 of milk", we derive how much
 * milk that buys. Returns the rounded quantity AND the exact total recomputed from that
 * rounded quantity (so the displayed qty and the charged amount always agree).
 */
export function quantityForAmount(product, amountPaise, saleUnit, precision = 3) {
  validatePricingProduct(product);
  if (product.pricingMode !== "loose") {
    throw new Error("quantityForAmount only applies to loose items");
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new RangeError(`amountPaise must be a positive integer, got ${amountPaise}`);
  }
  if (!sameFamily(saleUnit, product.rateUnit)) {
    throw new RangeError(`sale unit '${saleUnit}' incompatible with rate unit '${product.rateUnit}'`);
  }
  const qtyInRateUnit = amountPaise / product.ratePaise;
  const qtyInSaleUnit = convert(qtyInRateUnit, product.rateUnit, saleUnit);
  const factor = Math.pow(10, precision);
  const quantity = Math.round(qtyInSaleUnit * factor) / factor;
  const totalPaise = computeLineTotal(product, quantity, saleUnit);
  return { quantity, saleUnit, totalPaise };
}

/**
 * Sum a cart of mixed packaged + loose lines.
 * lines: [{ product, quantity, saleUnit }]
 */
export function computeCartTotal(lines) {
  if (!Array.isArray(lines)) throw new TypeError("lines must be an array");
  return lines.reduce(
    (sum, line) => sum + computeLineTotal(line.product, line.quantity, line.saleUnit),
    0,
  );
}
