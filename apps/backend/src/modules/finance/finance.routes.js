/**
 * ERP-SYSTEM - Rutas de finance
 */
const express = require('express');
const router = express.Router();
const financeController = require('./finance.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
