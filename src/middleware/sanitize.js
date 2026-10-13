/**
 * Removes keys that could be used for NoSQL injection ("$gt", "$where", "a.b")
 * or prototype pollution ("__proto__"), recursively, from body/query/params.
 * Zod validation runs after this as a second line of defence.
 */
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function clean(value) {
  if (Array.isArray(value)) {
    value.forEach((v) => clean(v));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) {
        delete value[key];
      } else {
        clean(value[key]);
      }
    }
  }
  return value;
}

function sanitizeRequest(req, res, next) {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}

module.exports = { sanitizeRequest, clean };
