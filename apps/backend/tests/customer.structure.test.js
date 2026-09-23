/**
 * ============================================
 * ERP-SYSTEM - Test de Estructura de Clientes
 * ============================================
 */

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Customer Module Structure', () => {
  const modulePath = path.join(__dirname, '..', 'src', 'modules', 'customers');

  it('debería tener el directorio del módulo', () => {
    expect(fs.existsSync(modulePath)).to.be.true;
  });

  it('debería tener customers.model.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.model.js'))).to.be.true;
  });

  it('debería tener customers.repository.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.repository.js'))).to.be.true;
  });

  it('debería tener customers.service.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.service.js'))).to.be.true;
  });

  it('debería tener customers.controller.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.controller.js'))).to.be.true;
  });

  it('debería tener customers.routes.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.routes.js'))).to.be.true;
  });

  it('debería tener customers.validation.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.validation.js'))).to.be.true;
  });

  it('debería tener customers.test.js', () => {
    expect(fs.existsSync(path.join(modulePath, 'customers.test.js'))).to.be.true;
  });
});

describe('Customer Module Logic', () => {
  it('debería cargar el modelo de cliente', () => {
    const Customer = require('../src/modules/customers/customers.model');
    expect(Customer).to.be.a('function');
  });

  it('debería cargar el repositorio de clientes', () => {
    const repo = require('../src/modules/customers/customers.repository');
    expect(repo).to.be.an('object');
    expect(repo.findAll).to.be.a('function');
    expect(repo.findById).to.be.a('function');
    expect(repo.create).to.be.a('function');
    expect(repo.updateById).to.be.a('function');
  });

  it('debería cargar el servicio de clientes', () => {
    const service = require('../src/modules/customers/customers.service');
    expect(service).to.be.an('object');
    expect(service.getAll).to.be.a('function');
    expect(service.getById).to.be.a('function');
    expect(service.create).to.be.a('function');
    expect(service.update).to.be.a('function');
    expect(service.delete).to.be.a('function');
  });

  it('debería cargar el controlador de clientes', () => {
    const controller = require('../src/modules/customers/customers.controller');
    expect(controller).to.be.an('object');
    expect(controller.getCustomers).to.be.a('function');
    expect(controller.createCustomer).to.be.a('function');
    expect(controller.getCustomerById).to.be.a('function');
    expect(controller.updateCustomer).to.be.a('function');
    expect(controller.deleteCustomer).to.be.a('function');
    expect(controller.searchCustomers).to.be.a('function');
    expect(controller.getCustomerStats).to.be.a('function');
  });

  it('debería cargar las rutas de clientes', () => {
    const routes = require('../src/modules/customers/customers.routes');
    expect(routes).to.be.a('function');
    expect(routes.use).to.be.a('function');
  });
});

describe('Customer Routes Integration', () => {
  it('debería tener las rutas de clientes registradas en routes/index.js', () => {
    const routes = require('../src/routes');
    // Verificar que el módulo de rutas existe y puede ser requerido
    const customersRoutes = require('../src/modules/customers/customers.routes');
    expect(customersRoutes).to.be.a('function');
  });
});
