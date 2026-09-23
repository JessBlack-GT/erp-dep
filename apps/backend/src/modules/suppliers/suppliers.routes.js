/**
 * ERP-SYSTEM - Rutas de suppliers
 */
const express = require('express');
const router = express.Router();
const suppliersController = require('./suppliers.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
