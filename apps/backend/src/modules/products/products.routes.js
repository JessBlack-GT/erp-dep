const router = require('express').Router();
const c = require('./products.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
router.use(authenticateToken);
router.get('/search', requirePermission('products.read'), c.search);
router
  .route('/')
  .get(requirePermission('products.read'), c.list)
  .post(requirePermission('products.create'), c.create);
router
  .route('/:id')
  .get(requirePermission('products.read'), c.get)
  .patch(requirePermission('products.update'), c.update)
  .delete(requirePermission('products.delete'), c.remove);
router.patch('/:id/status', requirePermission('products.update'), c.status);
// Keep unexpected database details and stacks out of M04 responses, including development.
router.use((err, req, res, next) => {
  const status =
    err.code === 11000
      ? 409
      : err.isOperational && [400, 404, 409].includes(err.statusCode)
        ? err.statusCode
        : err.name === 'ValidationError'
          ? 400
          : 500;
  res.status(status).json({
    success: false,
    error:
      status === 500
        ? 'Error interno del servidor'
        : err.code === 11000
          ? 'Elemento duplicado'
          : err.name === 'ValidationError'
            ? 'Datos inválidos'
            : err.message,
  });
});
module.exports = router;
