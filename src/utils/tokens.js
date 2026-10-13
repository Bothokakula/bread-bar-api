const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('./AppError');
const RefreshToken = require('../models/RefreshToken');
const { sha256, generateOpaqueToken } = require('./crypto');

const USER_TYPES = ['customer', 'staff'];

function jwtSettings(userType) {
  if (!USER_TYPES.includes(userType)) throw new Error(`Unknown user type: ${userType}`);
  return userType === 'staff'
    ? { secret: env.jwt.staffSecret, audience: env.jwt.staffAudience }
    : { secret: env.jwt.customerSecret, audience: env.jwt.customerAudience };
}

/**
 * Short-lived access token. Customer and staff tokens use different secrets
 * AND audiences, so a customer token is rejected by every staff route.
 * `tv` (token version) lets us kill all sessions instantly (logout-all,
 * password change, staff deactivation).
 */
function signAccessToken(user, userType) {
  const { secret, audience } = jwtSettings(userType);
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, secret, {
    subject: String(user._id),
    audience,
    issuer: env.jwt.issuer,
    expiresIn: env.jwt.accessTokenTtl,
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token, userType) {
  const { secret, audience } = jwtSettings(userType);
  return jwt.verify(token, secret, { audience, issuer: env.jwt.issuer, algorithms: ['HS256'] });
}

/** Reads which app a token claims to be for (verification happens afterwards). */
function peekUserType(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') return null;
  if (decoded.aud === env.jwt.staffAudience) return 'staff';
  if (decoded.aud === env.jwt.customerAudience) return 'customer';
  return null;
}

/** Refresh tokens are random strings; only their SHA-256 hash is stored. */
async function issueRefreshToken(userId, userType, familyId = crypto.randomUUID()) {
  const raw = generateOpaqueToken();
  await RefreshToken.create({
    tokenHash: sha256(raw),
    userId,
    userType,
    familyId,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlHours[userType] * 60 * 60 * 1000),
  });
  return raw;
}

/**
 * Rotation with reuse detection: every refresh returns a NEW refresh token and
 * revokes the old one. If a revoked token is presented again, it was probably
 * stolen, so the whole token family is revoked.
 */
async function rotateRefreshToken(raw, userType) {
  const tokenHash = sha256(raw);
  const now = new Date();

  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, userType, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
    { new: false }
  );

  if (!current) {
    const reused = await RefreshToken.findOne({ tokenHash, userType, revokedAt: { $ne: null } });
    if (reused) {
      await RefreshToken.updateMany({ familyId: reused.familyId, revokedAt: null }, { $set: { revokedAt: now } });
    }
    throw new AppError(401, 'Session expired. Please log in again.', 'INVALID_REFRESH_TOKEN');
  }

  const refreshToken = await issueRefreshToken(current.userId, userType, current.familyId);
  return { userId: current.userId, refreshToken };
}

async function revokeRefreshToken(raw, userType) {
  await RefreshToken.updateOne({ tokenHash: sha256(raw), userType, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function revokeAllRefreshTokens(userId, userType) {
  await RefreshToken.updateMany({ userId, userType, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  peekUserType,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
