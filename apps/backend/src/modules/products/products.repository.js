/**
 * ERP-SYSTEM - Repositorio de products
 */
const Product = require('./products.model');
const mongoose = require('mongoose');
const { ConflictError } = require('../../shared/errors/appErrors');
class ProductsRepository {
  async list({ filters, page, limit, search, sortBy, sortOrder }) {
    const query = { ...filters };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['name', 'sku', 'barcode'].map((key) => ({
        [key]: { $regex: escaped, $options: 'i' },
      }));
    }
    const [rows, total] = await Promise.all([
      Product.find(query)
        .sort({ [sortBy]: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);
    return { rows, total };
  }
  get(id) {
    return Product.findOne({ _id: id, status: { $ne: 'deleted' } }).lean();
  }
  unique(field, value) {
    return Product.findOne({ [field]: value }).lean();
  }
  create(data) {
    return Product.create(data);
  }
  update(id, set, unset = {}) {
    // Preserve ledger identity and keep positive balances usable.
    // Lock the same Product document as M06 before checking stock or history.
    if (set.type === 'SERVICE' || set.trackInventory === false ||
        set.status === 'deleted' || set.status === 'inactive') {
      return mongoose.connection.transaction(
        async (session) => {
          const previous = await Product.findOneAndUpdate(
            { _id: id, status: { $ne: 'deleted' } },
            { $inc: { __v: 1 } },
            { new: true, session, timestamps: false },
          );
          if (!previous) return null;
          if (set.status === 'deleted' || set.status === 'inactive') {
            const stock = await mongoose.connection
              .collection('inventoryBalances')
              .findOne(
                { productId: previous._id, quantityUnits: { $gt: 0 } },
                { session, projection: { _id: 1 } },
              );
            if (stock)
              throw new ConflictError(
                'Un producto con existencias no puede eliminarse ni desactivarse',
              );
          }
          if (
            (set.type === 'SERVICE' && previous.type !== 'SERVICE') ||
            (set.trackInventory === false && previous.trackInventory)
          ) {
            const history = await mongoose.connection
              .collection('inventoryMovements')
              .findOne(
                { productId: previous._id },
                { session, projection: { _id: 1 } },
              );
            if (history)
              throw new ConflictError(
                'Un producto con movimientos debe conservar su tipo y seguimiento de inventario',
              );
          }
          return Product.findOneAndUpdate(
            { _id: id, status: { $ne: 'deleted' } },
            {
              $set: set,
              ...(Object.keys(unset).length ? { $unset: unset } : {}),
            },
            { new: true, runValidators: true, session },
          );
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        },
      );
    }
    return Product.findOneAndUpdate(
      { _id: id, status: { $ne: 'deleted' } },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    );
  }
}
module.exports = new ProductsRepository();
