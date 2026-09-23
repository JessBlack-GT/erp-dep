/**
 * ERP-SYSTEM - Rutas de audit
 */
const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
