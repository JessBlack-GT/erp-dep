/**
 * ERP-SYSTEM - Rutas de sales
 */
const express = require('express');
const router = express.Router();
const salesController = require('./sales.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
