const commercial = require('../commercial/commercial.validation');
const { object, id } = require('../inventory/inventory.validation');
const { ValidationError } = require('../../shared/errors/appErrors');
const fields = ['date', 'currency', 'entityId', 'lines'];
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ValidationError(
      'expectedRevision debe ser un entero no negativo',
    );
  return value;
}
function input(data) {
  object(data, fields);
  return { ...data, type: 'SALE' };
}
function update(data) {
  object(data, [...fields, 'expectedRevision']);
  const { expectedRevision, ...content } = data;
  return {
    content: input(content),
    expectedRevision: revision(expectedRevision),
  };
}
function command(data) {
  object(data, ['expectedRevision']);
  return revision(data.expectedRevision);
}
function query(data = {}) {
  object(data, ['page', 'limit', 'status', 'entityId', 'from', 'to', 'search']);
  const result = { page: 1, limit: 20 };
  for (const [key, max] of [
    ['page', 1000000],
    ['limit', 100],
  ]) {
    if (data[key] !== undefined) {
      if (
        typeof data[key] !== 'string' ||
        !/^[1-9]\d*$/.test(data[key]) ||
        Number(data[key]) > max
      )
        throw new ValidationError('Paginación inválida');
      result[key] = Number(data[key]);
    }
  }
  if (data.status !== undefined) {
    if (!commercial.STATES.includes(data.status))
      throw new ValidationError('Estado inválido');
    result.status = data.status;
  }
  if (data.entityId !== undefined) result.entityId = id(data.entityId);
  for (const key of ['from', 'to'])
    if (data[key] !== undefined) result[key] = commercial.date(data[key]);
  if (result.from && result.to && result.from > result.to)
    throw new ValidationError('Rango de fechas inválido');
  if (data.search !== undefined) {
    if (typeof data.search !== 'string' || data.search.trim().length > 100)
      throw new ValidationError('Búsqueda inválida');
    result.search = data.search.trim();
  }
  return result;
}
module.exports = { input, update, command, query };
