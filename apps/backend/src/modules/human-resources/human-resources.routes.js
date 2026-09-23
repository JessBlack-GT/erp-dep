/**
 * ERP-SYSTEM - Rutas de human-resources
 */
const express = require('express');
const router = express.Router();
const humanResourcesController = require('./human-resources.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
