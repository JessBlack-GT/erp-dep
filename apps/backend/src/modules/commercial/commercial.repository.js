/* eslint-env es2020 */
const Document = require('./commercial.model');
const Product = require('../products/products.model');
const Customer = require('../customers/customers.model');
const Supplier = require('../suppliers/suppliers.model');
const scope = (type) => (type === undefined ? {} : { type });
module.exports = {
  get: (id, type) => Document.findOne({ _id: id, ...scope(type) }).lean(),
  async list(options, type) {
    const { page, limit, status, entityId, from, to, search } = options;
    const filter = { ...scope(type) };
    if (status) filter.status = status;
    if (entityId) filter['entity.id'] = entityId;
    if (from || to)
      filter.date = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    if (search)
      filter.number = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    const [rows, total] = await Promise.all([
      Document.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Document.countDocuments(filter),
    ]);
    return {
      data: rows.map((row) => ({ ...row, revision: row.revision ?? 0 })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },
  lock: (id, session, type) =>
    Document.findOneAndUpdate(
      { _id: id, ...scope(type) },
      { $inc: { __v: 1 } },
      { new: true, session, timestamps: false },
    ).lean(),
  product: (id, session) =>
    Product.findOneAndUpdate(
      { _id: id, status: 'active' },
      { $inc: { __v: 1 } },
      { new: true, session, timestamps: false },
    ).lean(),
  entity: (kind, id, session) =>
    (kind === 'customer' ? Customer : Supplier)
      .findOneAndUpdate(
        { _id: id, status: 'active' },
        { $inc: { __v: 1 } },
        { new: true, session, timestamps: false },
      )
      .lean(),
  create: async (data, session) =>
    (await Document.create([data], { session }))[0].toObject(),
  update: (id, status, data, session, type, revision) =>
    Document.findOneAndUpdate(
      {
        _id: id,
        status,
        ...scope(type),
        ...(revision === undefined
          ? {}
          : revision === 0
            ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
            : { revision }),
      },
      { $set: data },
      { new: true, runValidators: true, session },
    ).lean(),
};
