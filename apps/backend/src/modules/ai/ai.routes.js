/**
 * ERP-SYSTEM - Rutas de ai
 */
const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const { authenticateToken } = require('../../middleware/authenticate');
router.use(authenticateToken);
module.exports = router;
