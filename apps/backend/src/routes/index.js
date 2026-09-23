/**
 * ============================================
 * ERP-SYSTEM - Rutas Principales
 * ============================================
 * Punto de entrada de todas las rutas de la API v1.
 * ============================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// Módulos de autenticación y seguridad
// ============================================
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const rolesRoutes = require('../modules/roles/roles.routes');

// ============================================
// Módulos de negocio
// ============================================
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const suppliersRoutes = require('../modules/suppliers/suppliers.routes');
const productsRoutes = require('../modules/products/products.routes');
const inventoryRoutes = require('../modules/inventory/inventory.routes');
const salesRoutes = require('../modules/sales/sales.routes');
const purchasesRoutes = require('../modules/purchases/purchases.routes');
const financeRoutes = require('../modules/finance/finance.routes');
const hrRoutes = require('../modules/human-resources/human-resources.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const notificationsRoutes = require('../modules/notifications/notifications.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const settingsRoutes = require('../modules/settings/settings.routes');

// ============================================
// Módulos de extensión (pendientes)
// ============================================
// const aiRoutes = require('../modules/integrations/ai.routes');
// const integrationsRoutes = require('../modules/integrations/integrations.routes');

// ============================================
// Montaje de rutas
// ============================================

// Autenticación
router.use('/auth', authRoutes);

// Usuarios y roles
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// Módulos de negocio
router.use('/customers', customersRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/products', productsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/finance', financeRoutes);
router.use('/human-resources', hrRoutes);
router.use('/reports', reportsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/audit', auditRoutes);
router.use('/settings', settingsRoutes);

// Módulos de extensión (pendientes - rutas placeholder)
// router.use('/ai', aiRoutes);
// router.use('/integrations', integrationsRoutes);

module.exports = router;
