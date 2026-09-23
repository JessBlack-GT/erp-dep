/**
 * ERP-SYSTEM - Rutas de dashboard
 */
const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
