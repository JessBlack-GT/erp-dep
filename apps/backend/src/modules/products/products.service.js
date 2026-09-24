/**
 * ERP-SYSTEM - Servicio de products
 */
const repo = require('./products.repository');
const v = require('./products.validation');
const {
  NotFoundError,
  ConflictError,
  ValidationError,
} = require('../../shared/errors/appErrors');
class ProductsService {
  async getAll(params) {
    const options = v.query(params);
    const { rows, total } = await repo.list(options);
    return {
      data: rows,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
      },
    };
  }
  async getById(id) {
    const item = await repo.get(v.id(id));
    if (!item) throw new NotFoundError('Elemento no encontrado');
    return item;
  }
  async duplicates(data, id) {
    for (const field of ['sku', 'barcode']) {
      const match = data[field] ? await repo.unique(field, data[field]) : null;
      if (match && String(match._id).toLowerCase() !== String(id).toLowerCase())
        throw new ConflictError('SKU o código de barras duplicado');
    }
  }
  async create(data, actor) {
    const clean = { type: 'PRODUCT', trackInventory: false, ...v.input(data) };
    clean.unit ||= clean.type === 'SERVICE' ? 'service' : 'unit';
    v.domain(clean);
    await this.duplicates(clean);
    for (const key of Object.keys(clean))
      if (clean[key] === '') delete clean[key];
    return repo.create({ ...clean, createdBy: actor, updatedBy: actor });
  }
  async update(id, data, actor) {
    const clean = v.input(data, true);
    const previous = await this.getById(id);
    const merged = { ...previous, ...clean };
    v.domain(merged);
    await this.duplicates(merged, id);
    const unset = {};
    for (const key of Object.keys(clean))
      if (clean[key] === '') {
        unset[key] = 1;
        delete clean[key];
      }
    const item = await repo.update(id, { ...clean, updatedBy: actor }, unset);
    if (!item) throw new NotFoundError('Elemento no encontrado');
    return item;
  }
  async status(id, status, actor) {
    if (!['active', 'inactive'].includes(status))
      throw new ValidationError('Estado inválido');
    await this.getById(id);
    const item = await repo.update(id, { status, updatedBy: actor });
    if (!item) throw new NotFoundError('Elemento no encontrado');
    return item;
  }
  async delete(id, actor) {
    await this.getById(id);
    const item = await repo.update(id, { status: 'deleted', updatedBy: actor });
    if (!item) throw new NotFoundError('Elemento no encontrado');
    return item;
  }
}
module.exports = new ProductsService();
