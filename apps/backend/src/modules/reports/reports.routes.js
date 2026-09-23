/**
 * ERP-SYSTEM - Rutas de reports
 */
const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
