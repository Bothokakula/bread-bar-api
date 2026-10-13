const AppError = require('../utils/AppError');
const Customer = require('../models/Customer');
const Staff = require('../models/Staff');
const { verifyAccessToken, peekUserType } = require('../utils/tokens');

function extractBearerToken(req) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Verifies the JWT, then re-checks the account in the database so that
 * deactivated staff, role changes and "log out everywhere" take effect
 * immediately instead of waiting for the token to expire.
 * The role used for authorisation comes from the DATABASE, not the token.
 */
function authenticate(userType) {
  const Model = userType === 'staff' ? Staff : Customer;

  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) throw new AppError(401, 'Please log in to continue', 'AUTH_REQUIRED');

      let payload;
      try {
        payload = verifyAccessToken(token, userType);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          throw new AppError(401, 'Your session has expired', 'TOKEN_EXPIRED');
        }
        throw new AppError(401, 'Invalid session. Please log in again.', 'INVALID_TOKEN');
      }

      const user = await Model.findById(payload.sub).select('role tokenVersion isActive').lean();
      const inactiveStaff = userType === 'staff' && user && !user.isActive;
      if (!user || user.tokenVersion !== payload.tv || inactiveStaff) {
        throw new AppError(401, 'Your session is no longer valid. Please log in again.', 'SESSION_REVOKED');
      }

      req.user = { id: String(user._id), role: user.role, type: userType };
      next();
    } catch (err) {
      next(err);
    }
  };
}

const authenticateCustomer = authenticate('customer');
const authenticateStaff = authenticate('staff');

/** For routes both apps use (e.g. viewing one order). */
function authenticateAny(req, res, next) {
  const token = extractBearerToken(req);
  const userType = token && peekUserType(token);
  if (!userType) return next(new AppError(401, 'Please log in to continue', 'AUTH_REQUIRED'));
  return authenticate(userType)(req, res, next);
}

module.exports = { authenticateCustomer, authenticateStaff, authenticateAny };
