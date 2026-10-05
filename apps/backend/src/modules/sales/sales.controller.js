const service = require('./sales.service');
const { asyncHandler } = require('../../middleware/errorHandler');
exports.list = asyncHandler(async (req, res) =>
  res.json({ success: true, ...(await service.getAll(req.query, req.user)) }),
);
exports.get = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getById(req.params.id, req.user),
  }),
);
exports.create = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({ success: true, data: await service.create(req.body, req.user) }),
);
for (const action of ['update', 'confirm', 'cancel'])
  exports[action] = asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await service[action](req.params.id, req.body, req.user),
    }),
  );
