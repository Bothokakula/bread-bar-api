const env = require('../config/env');
const AppError = require('../utils/AppError');
const Customer = require('../models/Customer');
const Staff = require('../models/Staff');
const {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} = require('../utils/tokens');

const modelFor = (userType) => (userType === 'staff' ? Staff : Customer);

async function createSession(user, userType) {
  return {
    tokenType: 'Bearer',
    accessToken: signAccessToken(user, userType),
    expiresIn: env.jwt.accessTokenTtl,
    refreshToken: await issueRefreshToken(user._id, userType),
    user: user.toJSON(),
  };
}

async function refreshSession(rawRefreshToken, userType) {
  const { userId, refreshToken } = await rotateRefreshToken(rawRefreshToken, userType);
  const user = await modelFor(userType).findById(userId);

  if (!user || (userType === 'staff' && !user.isActive)) {
    await revokeAllRefreshTokens(userId, userType);
    throw new AppError(401, 'Session expired. Please log in again.', 'INVALID_REFRESH_TOKEN');
  }

  return {
    tokenType: 'Bearer',
    accessToken: signAccessToken(user, userType),
    expiresIn: env.jwt.accessTokenTtl,
    refreshToken,
    user: user.toJSON(),
  };
}

async function logout(rawRefreshToken, userType) {
  await revokeRefreshToken(rawRefreshToken, userType);
}

/** Kills every session on every device: bumps tokenVersion + revokes refresh tokens. */
async function logoutEverywhere(userId, userType) {
  await modelFor(userType).updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  await revokeAllRefreshTokens(userId, userType);
}

module.exports = { createSession, refreshSession, logout, logoutEverywhere };
