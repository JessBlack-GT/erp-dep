/**
 * ERP-SYSTEM - Rutas de settings
 */
const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
