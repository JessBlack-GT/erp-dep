const service = require('./inventory.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const v = require('./inventory.validation');
exports.list = (kind) =>
  asyncHandler(async (req, res) =>
    res.json({ success: true, ...(await service.list(kind, req.query)) }),
  );
exports.byProduct = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    ...(await service.list('balances', {
      ...req.query,
      productId: v.id(req.params.id),
    })),
  }),
);
exports.createWarehouse = asyncHandler(async (req, res) =>
  res.status(201).json({
    success: true,
    data: await service.createWarehouse(req.body, req.user.id),
  }),
);
exports.updateWarehouse = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.updateWarehouse(req.params.id, req.body, req.user.id),
  }),
);
exports.move = asyncHandler(async (req, res) => {
  const result = await service.move(req.body, req.user.id);
  res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
});
