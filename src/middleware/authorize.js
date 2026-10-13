const AppError = require('../utils/AppError');
const { hasPermission } = require('../config/roles');

const forbidden = () => new AppError(403, 'You do not have permission to do this', 'FORBIDDEN');
const unauthenticated = () => new AppError(401, 'Please log in to continue', 'AUTH_REQUIRED');

/** User must have ALL listed permissions. */
const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(unauthenticated());
  const allowed = permissions.every((p) => hasPermission(req.user.role, p));
  return allowed ? next() : next(forbidden());
};

/** User must have AT LEAST ONE of the listed permissions. */
const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(unauthenticated());
  const allowed = permissions.some((p) => hasPermission(req.user.role, p));
  return allowed ? next() : next(forbidden());
};

module.exports = { requirePermission, requireAnyPermission };
