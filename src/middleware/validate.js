const AppError = require('../utils/AppError');

/**
 * validate({ body, params, query }) - checks each part of the request against
 * a Zod schema. The cleaned body replaces req.body; cleaned params/query are
 * placed on req.validated. Controllers only ever read validated data.
 */
const validate = (schemas) => (req, res, next) => {
  req.validated = req.validated || {};
  for (const part of ['body', 'params', 'query']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || part,
        message: i.code === 'unrecognized_keys' ? `Unexpected field(s): ${i.keys.join(', ')}` : i.message,
      }));
      return next(new AppError(400, 'Please check the highlighted fields', 'VALIDATION_ERROR', details));
    }
    if (part === 'body') req.body = result.data;
    req.validated[part] = result.data;
  }
  next();
};

module.exports = validate;
