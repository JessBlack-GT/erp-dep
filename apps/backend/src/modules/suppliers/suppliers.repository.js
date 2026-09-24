/**
 * ERP-SYSTEM - Repositorio de suppliers
 */
const Supplier = require('./suppliers.model');
class SuppliersRepository {
  async list({ filters, page, limit, search, sortBy, sortOrder }) {
    const query = { ...filters };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = ['name', 'tradeName', 'email', 'taxId', 'contactName'].map(
        (key) => ({ [key]: { $regex: escaped, $options: 'i' } }),
      );
    }
    const [rows, total] = await Promise.all([
      Supplier.find(query)
        .sort({ [sortBy]: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Supplier.countDocuments(query),
    ]);
    return { rows, total };
  }
  get(id) {
    return Supplier.findOne({ _id: id, status: { $ne: 'deleted' } }).lean();
  }
  email(email) {
    return Supplier.findOne({ email }).lean();
  }
  fiscal(data) {
    return Supplier.findOne({
      taxCountry: data.taxCountry,
      taxType: data.taxType,
      taxId: data.taxId,
    }).lean();
  }
  create(data) {
    return Supplier.create(data);
  }
  update(id, set, unset = {}) {
    return Supplier.findOneAndUpdate(
      { _id: id, status: { $ne: 'deleted' } },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    );
  }
}
module.exports = new SuppliersRepository();
