const router = require('express').Router();
const c = require('./inventory.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
router.use(authenticateToken);
for (const kind of ['warehouses', 'products', 'balances', 'movements'])
  router.get('/' + kind, requirePermission('inventory.read'), c.list(kind));
router.get(
  '/balances/product/:id',
  requirePermission('inventory.read'),
  c.byProduct,
);
router.post(
  '/warehouses',
  requirePermission('inventory.warehouse.manage'),
  c.createWarehouse,
);
router.patch(
  '/warehouses/:id',
  requirePermission('inventory.warehouse.manage'),
  c.updateWarehouse,
);
const permissions = {
  ENTRY: 'entry',
  EXIT: 'exit',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjust',
};
router.post(
  '/movements',
  (req, res, next) => {
    const action =
      typeof req.body?.type === 'string'
        ? Object.hasOwn(permissions, req.body.type)
          ? permissions[req.body.type]
          : null
        : null;
    if (!action)
      return res.status(400).json({ success: false, error: 'Tipo inválido' });
    return requirePermission('inventory.' + action)(req, res, next);
  },
  c.move,
);
router.use((err, req, res, next) => {
  const status =
    err.code === 11000
      ? 409
      : err.isOperational && [400, 404, 409].includes(err.statusCode)
        ? err.statusCode
        : 500;
  res.status(status).json({
    success: false,
    error:
      status === 500
        ? 'Error interno del servidor'
        : err.code === 11000
          ? 'Elemento duplicado'
          : err.message,
  });
});
module.exports = router;
