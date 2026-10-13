const rateLimit = require('express-rate-limit');

function limiter({ windowMinutes, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
  });
}

module.exports = {
  apiLimiter: limiter({ windowMinutes: 15, limit: 300, message: 'Too many requests. Please slow down.' }),
  loginLimiter: limiter({
    windowMinutes: 15,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Too many login attempts from this device. Try again in 15 minutes.',
  }),
  registerLimiter: limiter({ windowMinutes: 60, limit: 10, message: 'Too many sign-up attempts. Try again later.' }),
  setupLimiter: limiter({ windowMinutes: 60, limit: 5, message: 'Too many setup attempts. Try again later.' }),
};
