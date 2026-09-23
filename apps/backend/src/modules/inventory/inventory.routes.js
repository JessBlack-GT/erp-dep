/**
 * ERP-SYSTEM - Rutas de inventory
 */
const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
