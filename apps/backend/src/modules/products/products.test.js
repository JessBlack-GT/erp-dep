const { expect } = require('chai');
const Product = require('./products.model');
describe('M05 schema', () => {
  it('requires name and sku', () => {
    const e = new Product({}).validateSync();
    expect(e.errors).to.have.keys('name', 'sku');
  });
  it('uses unique SKU and partial barcode indexes', () => {
    const indexes = Product.schema.indexes();
    expect(indexes.some(([k, o]) => k.sku === 1 && o.unique)).to.equal(true);
    expect(
      indexes.some(
        ([k, o]) => k.barcode === 1 && o.unique && o.partialFilterExpression,
      ),
    ).to.equal(true);
  });
  it('keeps exact monetary strings and strict protected structure', () => {
    const p = new Product({ name: 'QA', sku: 'QA', price: '0.1000' });
    expect(p.price).to.equal('0.1000');
    expect(() => new Product({ name: 'QA', sku: 'QA', stock: 1 })).to.throw();
  });
});
