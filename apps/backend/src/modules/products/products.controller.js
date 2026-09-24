const service = require('./products.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { ValidationError } = require('../../shared/errors/appErrors');
exports.list = asyncHandler(async (req, res) =>
  res.json({ success: true, ...(await service.getAll(req.query)) }),
);
exports.search = asyncHandler(async (req, res) => {
  if (
    Object.keys(req.query).some((k) => !['q', 'page', 'limit'].includes(k)) ||
    typeof req.query.q !== 'string' ||
    !req.query.q.trim()
  )
    throw new ValidationError('Búsqueda inválida');
  const { q, ...options } = req.query;
  res.json({
    success: true,
    ...(await service.getAll({ ...options, search: q })),
  });
});
exports.get = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await service.getById(req.params.id) }),
);
exports.create = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ success: true, data: await service.create(req.body, req.user.id) }),
);
exports.update = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.update(req.params.id, req.body, req.user.id),
  }),
);
exports.status = asyncHandler(async (req, res) => {
  if (!req.body || Object.keys(req.body).some((k) => k !== 'status'))
    throw new ValidationError('Payload inválido');
  res.json({
    success: true,
    data: await service.status(req.params.id, req.body.status, req.user.id),
  });
});
exports.remove = asyncHandler(async (req, res) => {
  await service.delete(req.params.id, req.user.id);
  res.json({ success: true, message: 'Elemento eliminado' });
});
