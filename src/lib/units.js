// Unit system for sellable goods.
//
// Families:
//   count  -> piece            (packaged goods: an Amul pouch, a bottle)
//   weight -> g, kg            (loose grain, sugar, vegetables sold by weight)
//   volume -> ml, l            (loose milk, oil sold by volume)
//
// Each unit converts to a canonical BASE within its family (g, ml, or piece) so a
// price quoted per litre and a sale entered in millilitres stay perfectly consistent.

export const UNIT_FAMILIES = {
  piece: "count",
  g: "weight",
  kg: "weight",
  ml: "volume",
  l: "volume",
};

// How many base units (g / ml / piece) ONE of this unit equals.
const TO_BASE = { piece: 1, g: 1, kg: 1000, ml: 1, l: 1000 };

export const LOOSE_UNITS = ["g", "kg", "ml", "l"];
export const PACKAGED_UNIT = "piece";

export function isValidUnit(unit) {
  return Object.prototype.hasOwnProperty.call(UNIT_FAMILIES, unit);
}

export function unitFamily(unit) {
  if (!isValidUnit(unit)) throw new RangeError(`Unknown unit: ${unit}`);
  return UNIT_FAMILIES[unit];
}

export function sameFamily(a, b) {
  return isValidUnit(a) && isValidUnit(b) && UNIT_FAMILIES[a] === UNIT_FAMILIES[b];
}

export function isLooseUnit(unit) {
  return LOOSE_UNITS.includes(unit);
}

/** Convert a quantity from one unit to another WITHIN the same family. */
export function convert(quantity, fromUnit, toUnit) {
  if (!sameFamily(fromUnit, toUnit)) {
    throw new RangeError(`Cannot convert '${fromUnit}' to '${toUnit}': different unit families`);
  }
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw new TypeError(`quantity must be a finite number, got ${quantity}`);
  }
  return (quantity * TO_BASE[fromUnit]) / TO_BASE[toUnit];
}
