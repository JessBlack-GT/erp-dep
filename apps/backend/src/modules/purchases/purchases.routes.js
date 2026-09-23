/**
 * ERP-SYSTEM - Rutas de purchases
 */
const express = require('express');
const router = express.Router();
const purchasesController = require('./purchases.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
