const env = require('../config/env');
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'Route not found', 'NOT_FOUND'));
}

/**
 * Converts every error into a safe JSON response. Stack traces, database
 * messages and internal details are NEVER sent to the client (NFR-R03).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again later.';
  let details;

  if (err instanceof AppError) {
    ({ statusCode: status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    [status, code, message] = [400, 'INVALID_JSON', 'Request body is not valid JSON'];
  } else if (err.type === 'entity.too.large') {
    [status, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'];
  } else if (err.name === 'CastError') {
    [status, code, message] = [400, 'INVALID_ID', 'Invalid identifier'];
  } else if (err.code === 11000) {
    [status, code, message] = [409, 'DUPLICATE', 'A record with these details already exists'];
  } else if (err.name === 'ValidationError') {
    [status, code, message] = [400, 'VALIDATION_ERROR', 'Some of the data provided is invalid'];
  }

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  if (!env.isProduction && status >= 500) body.error.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
