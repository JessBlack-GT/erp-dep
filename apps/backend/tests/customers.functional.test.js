const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const customerService = require('../src/modules/customers/customers.service');
const customerRepository = require('../src/modules/customers/customers.repository');
const customerController = require('../src/modules/customers/customers.controller');
const { authenticateToken } = require('../src/middleware/authenticate');
const { ValidationError, ConflictError, NotFoundError } = require('../src/shared/errors/appErrors');

describe('M03 - Customers functional isolated tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('1. registra un cliente con datos válidos', async () => {
    sinon.stub(customerRepository, 'exists').resolves(null);
    sinon.stub(customerRepository, 'findByDocumentNumber').resolves(null);
    sinon.stub(customerRepository, 'create').resolves({
      _id: '507f1f77bcf86cd799439011',
      name: 'Ana',
      email: 'ana@example.com',
      status: 'active',
    });

    const customer = await customerService.create({
      name: 'Ana',
      email: 'ana@example.com',
      documentNumber: '12345678',
    });

    expect(customer).to.include({ name: 'Ana', email: 'ana@example.com' });
    expect(customerRepository.create.calledOnce).to.be.true;
  });

  it('2. rechaza datos obligatorios ausentes o inválidos', async () => {
    try {
      await customerService.create({ email: 'no-valido' });
      expect.fail('Se esperaba una validación');
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      expect(error.message).to.match(/Email inválido|Nombre/);
    }
  });

  it('3. lista clientes con filtros y paginación', async () => {
    const fakeResult = [{ id: '1', name: 'Ana', email: 'ana@example.com' }];
    const repositoryStub = sinon.stub(customerRepository, 'findAll').resolves(fakeResult);

    const result = await customerService.getAll({ page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc', search: 'ana' });

    expect(result).to.deep.equal(fakeResult);
    expect(repositoryStub.calledWith({}, {
      page: 2,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
      search: 'ana',
    })).to.be.true;
  });

  it('4. consulta un cliente existente por ID', async () => {
    const fakeCustomer = { _id: '507f1f77bcf86cd799439011', name: 'Ana', email: 'ana@example.com' };
    sinon.stub(customerRepository, 'findById').resolves(fakeCustomer);

    const customer = await customerService.getById('507f1f77bcf86cd799439011');

    expect(customer).to.deep.equal(fakeCustomer);
  });

  it('5. maneja una consulta por ID inexistente', async () => {
    sinon.stub(customerRepository, 'findById').resolves(null);

    try {
      await customerService.getById('507f1f77bcf86cd799439012');
      expect.fail('Se esperaba NotFoundError');
    } catch (error) {
      expect(error).to.be.instanceOf(NotFoundError);
      expect(error.message).to.equal('Cliente no encontrado');
    }
  });

  it('6. actualiza un cliente', async () => {
    const existingCustomer = { _id: '507f1f77bcf86cd799439011', name: 'Ana', email: 'ana@example.com' };
    const updatedCustomer = { ...existingCustomer, name: 'Ana M.' };

    sinon.stub(customerRepository, 'findById').resolves(existingCustomer);
    sinon.stub(customerRepository, 'exists').resolves(null);
    sinon.stub(customerRepository, 'updateById').resolves(updatedCustomer);

    const customer = await customerService.update('507f1f77bcf86cd799439011', { name: 'Ana M.' });

    expect(customer.name).to.equal('Ana M.');
    expect(customerRepository.updateById.calledOnce).to.be.true;
  });

  it('7. busca clientes por texto', async () => {
    const result = [{ name: 'Ana', email: 'ana@example.com' }];
    sinon.stub(customerRepository, 'findAll').resolves(result);

    const customers = await customerService.getAll({ search: 'ana', limit: 20 });

    expect(customers).to.deep.equal(result);
  });

  it('8. cambia el estado de un cliente cuando la operación existe', async () => {
    const existingCustomer = { _id: '507f1f77bcf86cd799439011', name: 'Ana', status: 'active' };
    const updatedCustomer = { ...existingCustomer, status: 'inactive' };

    sinon.stub(customerRepository, 'findById').resolves(existingCustomer);
    sinon.stub(customerRepository, 'updateStatus').resolves(updatedCustomer);

    const customer = await customerService.changeStatus('507f1f77bcf86cd799439011', 'inactive');

    expect(customer.status).to.equal('inactive');
  });

  it('9. ejecuta eliminación lógica', async () => {
    const existingCustomer = { _id: '507f1f77bcf86cd799439011', name: 'Ana', status: 'active' };
    const deletedCustomer = { ...existingCustomer, status: 'deleted' };

    sinon.stub(customerRepository, 'findById').resolves(existingCustomer);
    sinon.stub(customerRepository, 'softDelete').resolves(deletedCustomer);

    const customer = await customerService.delete('507f1f77bcf86cd799439011');

    expect(customer.status).to.equal('deleted');
    expect(customerRepository.softDelete.calledOnce).to.be.true;
  });

  it('10. rechaza correos duplicados', async () => {
    sinon.stub(customerRepository, 'exists').resolves({ _id: '507f1f77bcf86cd799439000', email: 'ana@example.com' });

    try {
      await customerService.create({
        name: 'Ana',
        email: 'ana@example.com',
      });
      expect.fail('Se esperaba conflicto por email duplicado');
    } catch (error) {
      expect(error).to.be.instanceOf(ConflictError);
      expect(error.message).to.match(/email/i);
    }
  });

  it('11. maneja errores de persistencia', async () => {
    sinon.stub(customerRepository, 'exists').resolves(null);
    sinon.stub(customerRepository, 'findByDocumentNumber').resolves(null);
    sinon.stub(customerRepository, 'create').rejects(new Error('MongoDB unavailable'));

    try {
      await customerService.create({ name: 'Ana', email: 'ana@example.com' });
      expect.fail('Se esperaba un error de persistencia');
    } catch (error) {
      expect(error.message).to.equal('MongoDB unavailable');
    }
  });

  it('12. valida la protección de rutas mediante autenticación', () => {
    const req = { headers: {} };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    expect(res.statusCode).to.equal(401);
    expect(nextCalled).to.equal(false);
    expect(res.body.error).to.equal('No se proporcionó token de autenticación');
  });

  it('13. valida token válido para autorización', () => {
    const token = jwt.sign({ id: 'u-1', email: 'admin@example.com', role: 'admin' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).to.equal(true);
    expect(req.user.email).to.equal('admin@example.com');
  });

  it('14. el controlador devuelve respuesta de error para filtros inválidos', async () => {
    const req = { query: { page: 'abc', limit: '0' } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    await customerController.getCustomers(req, res);

    expect(res.statusCode).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it('15. el controlador crea cliente con validación manual de entrada', async () => {
    sinon.stub(customerService, 'create').resolves({ _id: '1', name: 'Ana', email: 'ana@example.com' });

    const req = { body: { name: 'Ana', email: 'ana@example.com' } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    await customerController.createCustomer(req, res);

    expect(res.statusCode).to.equal(201);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.name).to.equal('Ana');
  });
});
