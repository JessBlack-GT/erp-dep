const mongoose = require('mongoose');
const {
  Warehouse,
  InventoryBalance,
  InventoryMovement,
} = require('./inventory.model');
const Product = require('../products/products.model');
const { MAX_UNITS } = require('./inventory.validation');
const { ConflictError } = require('../../shared/errors/appErrors');
const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
class InventoryRepository {
  async transaction(work) {
    // Driver retries transient write conflicts; bounded outer retry handles concurrent first inserts.
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = await mongoose.startSession();
      try {
        let result;
        await session.withTransaction(
          async () => {
            result = await work(session);
          },
          {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            readPreference: 'primary',
          },
        );
        return result;
      } catch (error) {
        if (error.code !== 11000 || attempt === 2) throw error;
      } finally {
        await session.endSession();
      }
    }
  }
  replay(actor, key, session) {
    return InventoryMovement.findOne({ createdBy: actor, idempotencyKey: key })
      .session(session)
      .lean();
  }
  product(id, session) {
    return Product.findById(id).session(session).lean();
  }
  warehouse(id, session) {
    return Warehouse.findById(id).session(session).lean();
  }
  async change(productId, warehouseId, delta, session) {
    const identity = { productId, warehouseId };
    // Upsert only a zero row, never an unconditional stock increment.
    await InventoryBalance.updateOne(
      identity,
      { $setOnInsert: { quantityUnits: 0 } },
      { upsert: true, session },
    );
    const row = await InventoryBalance.findOneAndUpdate(
      {
        ...identity,
        quantityUnits:
          delta < 0 ? { $gte: -delta } : { $lte: MAX_UNITS - delta },
      },
      { $inc: { quantityUnits: delta } },
      { new: true, session },
    );
    if (!row)
      throw new ConflictError(
        delta < 0 ? 'Stock insuficiente' : 'Límite de existencia excedido',
      );
    return row;
  }
  async append(data, session) {
    return (await InventoryMovement.create([data], { session }))[0];
  }
  createWarehouse(data) {
    return Warehouse.create(data);
  }
  updateWarehouse(id, data) {
    return Warehouse.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    );
  }
  async list(kind, options) {
    const {
      page,
      limit,
      search,
      productId,
      warehouseId,
      type,
      from,
      to,
      status,
    } = options;
    const filter = {};
    let Model;
    if (kind === 'products') {
      Model = Product;
      Object.assign(filter, {
        type: 'PRODUCT',
        trackInventory: true,
        status: 'active',
      });
      if (search)
        filter.$or = ['name', 'sku'].map((k) => ({
          [k]: { $regex: literal(search), $options: 'i' },
        }));
    } else if (kind === 'warehouses') {
      Model = Warehouse;
      if (status) filter.status = status;
      if (search)
        filter.$or = ['name', 'code'].map((k) => ({
          [k]: { $regex: literal(search), $options: 'i' },
        }));
    } else {
      Model = kind === 'balances' ? InventoryBalance : InventoryMovement;
      if (productId) filter.productId = productId;
      if (search) {
        const products = await Product.find({
          $or: ['name', 'sku'].map((k) => ({
            [k]: { $regex: literal(search), $options: 'i' },
          })),
        })
          .select('_id')
          .lean();
        filter.productId = {
          $in: products
            .map((p) => p._id)
            .filter((id) => !productId || String(id) === productId),
        };
      }
      if (warehouseId) {
        if (kind === 'balances') filter.warehouseId = warehouseId;
        else
          filter.$or = [
            { sourceWarehouseId: warehouseId },
            { destinationWarehouseId: warehouseId },
          ];
      }
      if (type) filter.type = type;
      if (from || to)
        filter.createdAt = {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        };
    }
    let rowsQuery = Model.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (kind === 'products')
      rowsQuery = rowsQuery.select('name sku unit type trackInventory status');
    if (kind === 'balances' || kind === 'movements') {
      rowsQuery = rowsQuery.populate(
        'productId',
        'name sku unit type trackInventory status',
      );
      for (const field of kind === 'balances'
        ? ['warehouseId']
        : ['sourceWarehouseId', 'destinationWarehouseId'])
        rowsQuery = rowsQuery.populate(field, 'name code status');
    }
    const [rows, total] = await Promise.all([
      rowsQuery.lean(),
      Model.countDocuments(filter),
    ]);
    return { rows, total };
  }
}
module.exports = new InventoryRepository();
