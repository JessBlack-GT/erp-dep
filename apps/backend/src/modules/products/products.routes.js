/**
 * ERP-SYSTEM - Rutas de products
 */
const express = require('express');
const router = express.Router();
const productsController = require('./products.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
