const { ValidationError, ConflictError } = require('../../shared/errors/appErrors');
const catalog = require('../products/products.validation');
const quantity = require('../inventory/inventory.validation');
const money = require('../../shared/utils/money');
const TYPES = Object.freeze({ SALE: 'customer', PURCHASE: 'supplier' });
const STATES = Object.freeze(['draft', 'confirmed', 'cancelled']);
const fail = message => { throw new ValidationError(message); };
function type(value) {
  if (typeof value !== 'string' || !Object.hasOwn(TYPES, value)) fail('Tipo comercial inválido');
  return value;
}
function transition(from, to) {
  if (!STATES.includes(from) || !STATES.includes(to)) fail('Estado comercial inválido');
  if (!(from === 'draft' && ['confirmed', 'cancelled'].includes(to)) &&
      !(from === 'confirmed' && to === 'cancelled'))
    throw new ConflictError('Transición comercial no permitida');
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Fecha inválida');
  const result = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value)
    fail('Fecha inválida');
  return result;
}
function input(data, documentType) {
  quantity.object(data, ['type', 'date', 'currency', 'entityId', 'lines']);
  const selectedType = type(documentType === undefined ? data.type : documentType);
  if (data.type !== undefined && data.type !== selectedType) fail('Tipo inmutable');
  if (typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)) fail('Moneda inválida');
  if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > 200)
    fail('Se requieren entre 1 y 200 líneas');
  return {
    type: selectedType, date: date(data.date), currency: data.currency,
    entityId: catalog.id(data.entityId),
    lines: data.lines.map(line => {
      quantity.object(line, ['productId', 'quantity', 'unitPrice', 'discountRate', 'taxRate']);
      const result = {
        productId: catalog.id(line.productId),
        quantity: quantity.decimal(quantity.units(line.quantity)),
        discountRate: money.rate(line.discountRate === undefined ? '0' : line.discountRate),
        taxRate: money.rate(line.taxRate === undefined ? '0' : line.taxRate),
      };
      if (line.unitPrice !== undefined) result.unitPrice = money.money(line.unitPrice);
      return result;
    }),
  };
}
module.exports = { TYPES, STATES, type, transition, input, id: catalog.id };
