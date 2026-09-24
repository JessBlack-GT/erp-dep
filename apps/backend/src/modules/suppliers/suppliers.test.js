const { expect } = require('chai');
const Supplier = require('./suppliers.model');
describe('Supplier schema', () => {
  it('requires a name but accepts a basic supplier without fiscal/contact fields', () => {
    expect(new Supplier({}).validateSync().errors).to.have.property('name');
    expect(new Supplier({ name: 'Basic' }).validateSync()).to.equal(undefined);
  });
  it('rejects unknown type, invalid status and overlong names', () => {
    const e = new Supplier({
      name: 'x'.repeat(256),
      type: 'unknown',
      status: 'other',
    }).validateSync();
    expect(Object.keys(e.errors)).to.include.members([
      'name',
      'type',
      'status',
    ]);
  });
  it('defines optional unique email and country/type scoped tax indexes', () => {
    const indexes = Supplier.schema.indexes();
    expect(
      indexes.some(
        ([keys, opt]) =>
          keys.email === 1 && opt.unique && opt.partialFilterExpression,
      ),
    ).to.equal(true);
    expect(
      indexes.some(
        ([keys, opt]) =>
          keys.taxId === 1 &&
          keys.taxCountry === 1 &&
          keys.taxType === 1 &&
          opt.unique,
      ),
    ).to.equal(true);
  });
});
