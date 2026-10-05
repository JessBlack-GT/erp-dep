/* eslint-env es2020 */
const { describe, it } = require('mocha');
const { expect } = require('chai');
const money = require('../src/shared/utils/money');
const quantity = require('../src/modules/inventory/inventory.validation');
const product = require('../src/modules/products/products.validation');
const line = (qty, price, discount, tax) => money.calculateLine(quantity.units(qty), price, discount, tax);

describe('Commercial exact monetary contract', () => {
  it('reuses the same normalizer as M05 for price and cost', () => {
    expect(product.money).to.equal(money.money);
    expect(product.input({ price: '12.1', cost: '0', currency: 'USD' }, true))
      .to.deep.equal({ price: '12.1000', cost: '0.0000', currency: 'USD' });
  });
  for (const [value, expected] of [['0', '0.0000'], ['1', '1.0000'], ['0.1', '0.1000'], ['999999999999.9999', '999999999999.9999']]) {
    it('normalizes and round-trips ' + value, () => {
      expect(money.money(value)).to.equal(expected);
      expect(money.decimal(money.units(value))).to.equal(expected);
    });
  }
  for (const value of [-1, 0.1, '-1', '1e2', 'NaN', 'Infinity', '1.00001', '1000000000000', ' 1', '01', null])
    it('rejects unsafe or malformed amount ' + JSON.stringify(value), () => {
      expect(() => money.money(value)).to.throw().with.property('statusCode', 400);
    });
  it('multiplies decimal quantities without floating-point drift', () => {
    expect(line('0.3', '0.1').total).to.equal('0.0300');
    expect(line('1.25', '3.99').total).to.equal('4.9875');
  });
  it('handles integers and free lines', () => {
    expect(line('2', '12').total).to.equal('24.0000');
    expect(line('2', '0', '0', '0')).to.include({ subtotal: '0.0000', discount: '0.0000', tax: '0.0000', total: '0.0000' });
  });
  it('computes configurable tax after the line discount', () => {
    expect(line('2', '10', '10', '7.5')).to.include({
      subtotal: '20.0000', discount: '2.0000', tax: '1.3500', total: '19.3500',
    });
  });
  it('supports a full discount without negative taxable value', () => {
    expect(line('1', '25', '100', '50')).to.include({ discount: '25.0000', tax: '0.0000', total: '0.0000' });
  });
  it('rounds half-up at four decimals for subtotal, discount and tax', () => {
    expect(line('0.5', '0.0001').subtotal).to.equal('0.0001');
    expect(line('0.4999', '0.0001').subtotal).to.equal('0.0000');
    expect(line('1', '0.0001', '50').discount).to.equal('0.0001');
    expect(line('1', '0.0001', '0', '50').tax).to.equal('0.0001');
  });
  it('document totals sum rounded lines and discounts without a second rounding policy', () => {
    expect(money.totals([line('2', '10', '10', '7.5'), line('0.3', '0.1')])).to.deep.equal({
      subtotal: '20.0300', discount: '2.0000', tax: '1.3500', total: '19.3800',
    });
  });
  for (const value of ['-1', '100.0001', '0.00001', 10])
    it('rejects out-of-range or non-text percentage ' + value, () => {
      expect(() => line('1', '1', value)).to.throw();
      expect(() => line('1', '1', '0', value)).to.throw();
    });
  it('rejects monetary overflow after multiplication, tax and summation', () => {
    expect(() => line('2', '999999999999.9999')).to.throw();
    expect(() => line('1', '999999999999.9999', '0', '1')).to.throw();
    expect(() => money.totals([line('1', '999999999999.9999'), line('1', '0.0001')])).to.throw();
  });
  for (const qty of ['0', '-1', '1.00001', '100000001', '1e2', 1])
    it('rejects invalid commercial quantity ' + qty, () => expect(() => line(qty, '1')).to.throw());
  it('rejects an unsafe scaled integer passed directly to the calculator', () => {
    for (const value of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])
      expect(() => money.calculateLine(value, '1')).to.throw();
  });
});
