const { logger } = require('../../shared/utils/logger');

// Never forward free-form exception properties, messages, stack, request or document.
const names = new Set(['Error', 'TypeError', 'ValidationError', 'MongoServerError',
  'MongoNetworkError', 'MongoServerSelectionError', 'MongooseError', 'CastError',
  'JsonWebTokenError', 'TokenExpiredError', 'AbortError']);
const codes = new Set(['VALIDATION_ERROR', 'FORBIDDEN', 'UNAUTHORIZED', 'CONFLICT',
  'EMAIL_NOT_CONFIGURED', 'EMAIL_INVALID_MESSAGE', 'EMAIL_PROVIDER_ERROR',
  'EMAIL_TIMEOUT', 'EMAIL_SEND_FAILED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT']);
const providers = new Set(['validation_error', 'missing_api_key', 'invalid_api_key',
  'restricted_api_key', 'rate_limit_exceeded', 'application_error', 'internal_server_error']);
const status = (value) => Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
function createDiagnostics() {
  const seen = new WeakSet();
  const started = Date.now();
  const trace = {
    stage: 'request_received',
    mark(stage) {
      trace.stage = stage;
      logger.info('users.create stage_started', { stage, durationMs: Date.now() - started });
    },
    error(stage, error, since = started) {
      if (error && typeof error === 'object') {
        if (seen.has(error)) return;
        seen.add(error);
      }
      logger.error('users.create stage_failed', {
        stage,
        errorName: names.has(error?.name) ? error.name : 'Error',
        errorCode: Number.isSafeInteger(error?.code) ? error.code : codes.has(error?.code) ? error.code : null,
        httpStatus: status(error?.httpStatus) || status(error?.statusCode) || status(error?.status),
        providerCode: providers.has(error?.providerCode) ? error.providerCode : null,
        // An allowlisted summary is safer than regex redaction of arbitrary provider text.
        providerMessage: error?.code === 'EMAIL_PROVIDER_ERROR' ? 'Resend rejected or returned an invalid response' : null,
        durationMs: Math.max(0, Date.now() - since),
      });
    },
    async run(stage, operation) {
      trace.mark(stage);
      const since = Date.now();
      try {
        const result = await operation();
        logger.info('users.create stage_completed', { stage, durationMs: Date.now() - since });
        return result;
      } catch (error) {
        trace.error(stage === 'database_transaction' ? trace.stage : stage, error, since);
        throw error;
      }
    },
  };
  return trace;
}
function requestDiagnostics(req, res, next) {
  if (req.method !== 'POST' || req.path !== '/') return next();
  const trace = req.userCreationDiagnostics = createDiagnostics();
  trace.mark('request_received');
  trace.mark('authentication');
  res.once('finish', () => logger.info('users.create response', {
    stage: 'response', httpStatus: res.statusCode,
  }));
  res.once('close', () => {
    if (!res.writableFinished) trace.error(trace.stage, new Error());
  });
  next();
}
module.exports = { createDiagnostics, requestDiagnostics };
