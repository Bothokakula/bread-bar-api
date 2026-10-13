const env = require('../config/env');
const AppError = require('./AppError');

function isLocked(user) {
  return Boolean(user && user.lockUntil && user.lockUntil.getTime() > Date.now());
}

function lockedError() {
  return new AppError(
    423,
    `Too many failed attempts. This account is locked for ${env.lockout.lockMinutes} minutes.`,
    'ACCOUNT_LOCKED'
  );
}

/** Atomic counter so parallel guesses can't slip past the limit. */
async function recordFailedAttempt(Model, userId) {
  const updated = await Model.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginAttempts: 1 } },
    { new: true, projection: { failedLoginAttempts: 1 } }
  );
  if (updated && updated.failedLoginAttempts >= env.lockout.maxAttempts) {
    await Model.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + env.lockout.lockMinutes * 60 * 1000) } }
    );
  }
}

async function recordSuccessfulLogin(Model, userId) {
  await Model.updateOne(
    { _id: userId },
    { $set: { failedLoginAttempts: 0, lastLoginAt: new Date() }, $unset: { lockUntil: 1 } }
  );
}

module.exports = { isLocked, lockedError, recordFailedAttempt, recordSuccessfulLogin };
