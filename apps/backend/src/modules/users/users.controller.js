const service = require('./users.service');
const { asyncHandler } = require('../../middleware/errorHandler');
exports.list = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await service.getAll(req.query) }),
);
exports.detail = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await service.getById(req.params.id) }),
);
exports.profile = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await service.getProfile(req.user.id) }),
);
exports.create = asyncHandler(async (req, res) =>
  res.status(201).json({ success: true, data: await service.create(req.body, req.user, req.userCreationDiagnostics) }),
);
exports.mutate = (action) =>
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await service.mutate(
        req.params.id,
        req.method === 'DELETE' ? { status: 'deleted' } : req.body,
        req.user,
        action,
      ),
    }),
  );
