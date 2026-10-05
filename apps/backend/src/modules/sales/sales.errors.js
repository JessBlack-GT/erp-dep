// Also mounted at app level: JSON parser errors occur before the Sales router.
// eslint-disable-next-line no-unused-vars
module.exports = function salesErrors(err, req, res, next) {
  const unavailable = [
    'MongoNetworkError',
    'MongoServerSelectionError',
  ].includes(err.name);
  const malformed =
    ['ValidationError', 'CastError', 'StrictModeError', 'URIError'].includes(
      err.name,
    ) || ['entity.parse.failed', 'entity.too.large'].includes(err.type);
  const status =
    err.code === 11000
      ? 409
      : unavailable
        ? 503
        : err.isOperational &&
            [400, 401, 403, 404, 409, 503].includes(err.statusCode)
          ? err.statusCode
          : malformed
            ? 400
            : 500;
  res
    .status(status)
    .json({
      success: false,
      error:
        status >= 500
          ? 'Servicio no disponible'
          : err.code === 11000
            ? 'Conflicto de operación'
            : err.isOperational
              ? err.message
              : 'Datos inválidos',
    });
};
