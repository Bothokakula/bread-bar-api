/**
 * STAFF AUTHENTICATION - the "only the business knows" layer.
 *
 * Nobody outside Bread Bar can create or use a staff account because:
 *  1. OWNER SETUP needs the BUSINESS_SETUP_KEY, a secret held only by the owner
 *     (stored in server environment variables, never in the app). It works once:
 *     the database allows only one owner.
 *  2. STAFF REGISTRATION needs a one-time INVITE CODE that the owner/manager
 *     generates for a specific email and role and hands to the employee in person.
 *     Codes expire after 48 hours, work once, and the role comes from the invite -
 *     never from the request.
 *  3. EVERY STAFF LOGIN needs email + password + a personal 6-digit STAFF PIN.
 *     A leaked password alone is not enough to get into the business app.
 */
const env = require('../config/env');
const AppError = require('../utils/AppError');
const Staff = require('../models/Staff');
const StaffInvite = require('../models/StaffInvite');
const { hashSecret, compareSecret } = require('../utils/password');
const { sha256, safeEqual } = require('../utils/crypto');
const { isLocked, lockedError, recordFailedAttempt, recordSuccessfulLogin } = require('../utils/lockout');
const { audit } = require('../utils/audit');
const { createSession } = require('./session.service');

async function setupOwner({ setupKey, name, email, password, pin }, ctx) {
  if (!safeEqual(setupKey, env.businessSetupKey)) {
    await audit('OWNER_SETUP_FAILED', { actorType: 'system', ctx, meta: { email } });
    throw new AppError(403, 'Invalid business setup key', 'INVALID_SETUP_KEY');
  }
  if (await Staff.exists({ role: 'owner' })) {
    throw new AppError(409, 'The owner account has already been set up', 'OWNER_EXISTS');
  }

  const [passwordHash, pinHash] = await Promise.all([hashSecret(password), hashSecret(pin)]);
  let owner;
  try {
    owner = await Staff.create({ name, email, role: 'owner', passwordHash, pinHash });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'The owner account has already been set up', 'OWNER_EXISTS');
    throw err;
  }

  await audit('OWNER_ACCOUNT_CREATED', { actorId: owner._id, actorType: 'staff', targetId: owner._id, ctx });
  return createSession(owner, 'staff');
}

async function register({ inviteCode, name, email, password, pin }, ctx) {
  // Claim the invite atomically: code, email, unused and unexpired must ALL match.
  const invite = await StaffInvite.findOneAndUpdate(
    { codeHash: sha256(inviteCode), email, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );

  if (!invite) {
    await audit('STAFF_REGISTER_FAILED', { actorType: 'system', ctx, meta: { email } });
    // One generic message: don't reveal whether the code, email or expiry was wrong.
    throw new AppError(400, 'This invite code is invalid, expired, or was issued to a different email', 'INVALID_INVITE');
  }

  const [passwordHash, pinHash] = await Promise.all([hashSecret(password), hashSecret(pin)]);
  let staff;
  try {
    staff = await Staff.create({ name, email, role: invite.role, passwordHash, pinHash, invitedBy: invite.createdBy });
  } catch (err) {
    await StaffInvite.updateOne({ _id: invite._id }, { $set: { usedAt: null } }); // give the code back
    if (err.code === 11000) throw new AppError(409, 'A staff account with this email already exists', 'EMAIL_TAKEN');
    throw err;
  }

  await StaffInvite.updateOne({ _id: invite._id }, { $set: { usedBy: staff._id } });
  await audit('STAFF_REGISTERED', {
    actorId: staff._id, actorType: 'staff', targetId: staff._id, ctx,
    meta: { role: staff.role, invitedBy: String(invite.createdBy) },
  });
  return createSession(staff, 'staff');
}

async function login({ email, password, pin }, ctx) {
  const staff = await Staff.findOne({ email }).select('+passwordHash +pinHash');

  if (isLocked(staff)) {
    await audit('STAFF_LOGIN_BLOCKED_LOCKED', { actorType: 'system', targetId: staff._id, ctx });
    throw lockedError();
  }

  // Check password AND PIN every time, and never say which one was wrong.
  const [passwordOk, pinOk] = await Promise.all([
    compareSecret(password, staff && staff.passwordHash),
    compareSecret(pin, staff && staff.pinHash),
  ]);

  if (!staff || !passwordOk || !pinOk || !staff.isActive) {
    if (staff) await recordFailedAttempt(Staff, staff._id);
    const reason = !staff ? 'unknown_email' : !staff.isActive ? 'account_deactivated' : 'bad_credentials';
    await audit('STAFF_LOGIN_FAILED', { actorType: 'system', targetId: staff && staff._id, ctx, meta: { email, reason } });
    throw new AppError(401, 'Incorrect email, password or PIN', 'INVALID_CREDENTIALS');
  }

  await recordSuccessfulLogin(Staff, staff._id);
  await audit('STAFF_LOGIN', { actorId: staff._id, actorType: 'staff', ctx });
  return createSession(staff, 'staff');
}

async function getProfile(staffId) {
  const staff = await Staff.findById(staffId);
  if (!staff) throw new AppError(404, 'Account not found', 'NOT_FOUND');
  return staff.toJSON();
}

module.exports = { setupOwner, register, login, getProfile };
