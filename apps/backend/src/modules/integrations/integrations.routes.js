/**
 * ERP-SYSTEM - Rutas de integrations
 */
const express = require('express');
const router = express.Router();
const integrationsController = require('./integrations.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
