/**
 * ERP-SYSTEM - Repositorio de products
 */
const Product = require('./products.model');
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
    return Product.findOneAndUpdate(
      { _id: id, status: { $ne: 'deleted' } },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    );
  }
}
module.exports = new ProductsRepository();
