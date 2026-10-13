const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const AppError = require('./utils/AppError');
const { sanitizeRequest } = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', 1); // behind the AWS load balancer

// Security headers: HSTS, no sniffing, frame blocking, strict CSP for API responses.
app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true },
    contentSecurityPolicy: {
      directives: {
        // Only upgrade http->https in production (localhost runs on plain http).
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
  })
);

const corsOptions = {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};
app.use(
  cors((req, cb) => {
    const origin = req.get('origin');
    const sameOrigin = origin === `${req.protocol}://${req.get('host')}`;
    // Allowed: mobile apps (no Origin header), the pages served by this server,
    // and web dashboards listed in CORS_ORIGINS.
    if (!origin || sameOrigin || env.corsOrigins.includes(origin)) return cb(null, { ...corsOptions, origin: true });
    return cb(new AppError(403, 'Origin not allowed', 'CORS_BLOCKED'));
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(sanitizeRequest);

// Browser versions of the Customer app and Business app (see /public).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store'); // never cache personal data or tokens
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/customer/auth', require('./routes/customerAuth.routes'));
app.use('/api/staff/auth', require('./routes/staffAuth.routes'));
app.use('/api/staff', require('./routes/staffManagement.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/menu', require('./routes/menu.routes'));
app.use('/api/stock', require('./routes/stock.routes'));
app.use('/api/delivery-areas', require('./routes/deliveryArea.routes'));
app.use('/api/promotions', require('./routes/promotion.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/reports', require('./routes/report.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
