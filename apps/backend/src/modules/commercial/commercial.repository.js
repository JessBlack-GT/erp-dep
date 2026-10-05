const Document = require('./commercial.model');
const Product = require('../products/products.model');
const Customer = require('../customers/customers.model');
const Supplier = require('../suppliers/suppliers.model');
module.exports = {
  get: id => Document.findById(id).lean(),
  lock: (id, session) => Document.findOneAndUpdate(
    { _id: id }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false },
  ).lean(),
  product: (id, session) => Product.findOneAndUpdate(
    { _id: id, status: 'active' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false },
  ).lean(),
  entity: (kind, id, session) => (kind === 'customer' ? Customer : Supplier).findOneAndUpdate(
    { _id: id, status: 'active' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false },
  ).lean(),
  create: async (data, session) => (await Document.create([data], { session }))[0].toObject(),
  update: (id, status, data, session) => Document.findOneAndUpdate(
    { _id: id, status }, { $set: data }, { new: true, runValidators: true, session },
  ).lean(),
};
