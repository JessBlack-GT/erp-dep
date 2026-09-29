// Never expose database values, hashes, tokens or stack traces, even in development.
module.exports = (err, req, res, next) => {
  const status =
    err.code === 11000
      ? 409
      : err.isOperational && [400, 401, 403, 404, 409].includes(err.statusCode)
        ? err.statusCode
        : 500;
  res
    .status(status)
    .json({
      success: false,
      error:
        status === 500
          ? 'Error interno del servidor'
          : status === 409
            ? 'Conflicto con un registro existente'
            : err.message,
    });
};
