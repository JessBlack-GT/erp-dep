const { asyncHandler } = require('../../middleware/errorHandler');
const service = require('./reports.service');

function sendFile(res, file) {
  return res
    .status(200)
    .set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.buffer.length,
      'Cache-Control': 'no-store',
    })
    .send(file.buffer);
}

exports.sales = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  delete filters.page;
  delete filters.limit;
  const file = await service.sales(filters, req.params.format, req.user);
  return sendFile(res, file);
});

exports.inventory = asyncHandler(async (req, res) => {
  const filters = { ...req.query };
  delete filters.page;
  delete filters.limit;
  const file = await service.inventory(req.params.view, filters, req.params.format);
  return sendFile(res, file);
});
