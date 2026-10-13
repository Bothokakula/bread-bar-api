require('dotenv').config();

const REQUIRED = ['MONGO_URI', 'JWT_CUSTOMER_SECRET', 'JWT_STAFF_SECRET', 'BUSINESS_SETUP_KEY'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

for (const key of ['JWT_CUSTOMER_SECRET', 'JWT_STAFF_SECRET']) {
  if (process.env[key].length < 32) throw new Error(`${key} must be at least 32 characters long`);
}
if (process.env.JWT_CUSTOMER_SECRET === process.env.JWT_STAFF_SECRET) {
  throw new Error('JWT_CUSTOMER_SECRET and JWT_STAFF_SECRET must be different');
}
if (process.env.BUSINESS_SETUP_KEY.length < 16) {
  throw new Error('BUSINESS_SETUP_KEY must be at least 16 characters long');
}

const isProduction = process.env.NODE_ENV === 'production';

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  trustProxy: process.env.TRUST_PROXY === 'true',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwt: Object.freeze({
    customerSecret: process.env.JWT_CUSTOMER_SECRET,
    staffSecret: process.env.JWT_STAFF_SECRET,
    issuer: 'breadbar-api',
    customerAudience: 'breadbar-customer-app',
    staffAudience: 'breadbar-business-app',
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  }),

  // Customers stay signed in on their phone; staff sessions last one shift.
  refreshTokenTtlHours: Object.freeze({ customer: 24 * 30, staff: 12 }),

  bcryptRounds: 12,
  lockout: Object.freeze({ maxAttempts: 5, lockMinutes: 15 }),
  inviteTtlHours: 48,
  businessSetupKey: process.env.BUSINESS_SETUP_KEY,
});
