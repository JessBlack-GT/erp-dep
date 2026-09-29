const router = require('express').Router();
const { authenticateToken } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./roles.service');
router.use(authenticateToken);
router.get('/permissions', requirePermission('roles.read'), (req, res) =>
  res.json({
    success: true,
    data: require('../../security/rbac').PERMISSIONS.filter(
      (p) => req.user.isSuperadmin || req.user.permissions.includes(p),
    ),
  }),
);
router.get(
  '/',
  requirePermission('roles.read'),
  asyncHandler(async (req, res) => res.json({ success: true, data: await service.list(req.user) })),
);
router.post(
  '/',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) =>
    res.status(201).json({ success: true, data: await service.create(req.body, req.user) }),
  ),
);
router.patch(
  '/:name',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) =>
    res.json({ success: true, data: await service.update(req.params.name, req.body, req.user) }),
  ),
);
router.use(require('../auth/security-errors'));
module.exports = router;
