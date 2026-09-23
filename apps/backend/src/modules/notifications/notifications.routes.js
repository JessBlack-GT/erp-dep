/**
 * ERP-SYSTEM - Rutas de notifications
 */
const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
