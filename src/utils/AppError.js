/** An expected, safe-to-show error. Anything else becomes a generic 500. */
class AppError extends Error {
  constructor(statusCode, message, code = 'ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
