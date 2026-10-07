const router = require('express').Router();
const controller = require('./reports.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');

router.use(authenticateToken);
router.get('/sales/:format', requirePermission('commercial.read'), controller.sales);
router.get('/inventory/:view/:format', requirePermission('inventory.read'), controller.inventory);

module.exports = router;
