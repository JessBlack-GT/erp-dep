/* eslint-env es2020 */
const { ValidationError } = require('../errors/appErrors');
const SCALE = 10000n;
const MAX = 9999999999999999n;
const fail = () => { throw new ValidationError('Importe o tasa fuera de rango'); };

// Preserve the M05 wire/storage contract: decimal strings, 12 whole + 4 fractional digits.
function money(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,4})?$/.test(value))
    throw new ValidationError('Importe inválido: use texto decimal no negativo, máximo 12 enteros y 4 decimales');
  const [integer, fraction = ''] = value.split('.');
  return integer + '.' + fraction.padEnd(4, '0');
}
function units(value) { return BigInt(money(value).replace('.', '')); }
function decimal(value) {
  if (typeof value !== 'bigint' || value < 0n || value > MAX) fail();
  return `${value / SCALE}.${String(value % SCALE).padStart(4, '0')}`;
}
function rate(value) {
  const result = money(value);
  if (units(result) > 100n * SCALE) fail();
  return result;
}
// Non-negative HALF_UP; rounding happens once per line subtotal, discount and tax.
const round = (value, divisor) => (value + divisor / 2n) / divisor;
function calculateLine(quantityUnits, unitPrice, discountRate = '0', taxRate = '0') {
  if (!Number.isSafeInteger(quantityUnits) || quantityUnits <= 0)
    throw new ValidationError('Cantidad inválida');
  unitPrice = money(unitPrice);
  discountRate = rate(discountRate);
  taxRate = rate(taxRate);
  const subtotal = units(unitPrice) * BigInt(quantityUnits);
  const base = round(subtotal, SCALE);
  const discount = round(base * units(discountRate), 100n * SCALE);
  const tax = round((base - discount) * units(taxRate), 100n * SCALE);
  return {
    unitPrice, discountRate, taxRate,
    subtotal: decimal(base), discount: decimal(discount),
    tax: decimal(tax), total: decimal(base - discount + tax),
  };
}
function totals(lines) {
  const result = {};
  for (const field of ['subtotal', 'discount', 'tax', 'total'])
    result[field] = decimal(lines.reduce((sum, line) => sum + units(line[field]), 0n));
  return result;
}
module.exports = { money, units, decimal, rate, calculateLine, totals };
