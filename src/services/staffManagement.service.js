const env = require('../config/env');
const AppError = require('../utils/AppError');
const Staff = require('../models/Staff');
const StaffInvite = require('../models/StaffInvite');
const AuditLog = require('../models/AuditLog');
const { canManageRole } = require('../config/roles');
const { sha256, generateInviteCode } = require('../utils/crypto');
const { audit } = require('../utils/audit');
const { logoutEverywhere } = require('./session.service');

/**
 * Creates a one-time invite. The plain code is returned ONCE so the
 * owner/manager can hand it to the employee; only its hash is saved.
 */
async function createInvite({ email, role }, actor, ctx) {
  if (!canManageRole(actor.role, role)) {
    throw new AppError(403, `Your role cannot invite ${role} accounts`, 'FORBIDDEN');
  }
  if (await Staff.exists({ email })) {
    throw new AppError(409, 'A staff account with this email already exists', 'EMAIL_TAKEN');
  }

  await StaffInvite.deleteMany({ email, usedAt: null }); // older unused invites stop working

  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + env.inviteTtlHours * 60 * 60 * 1000);
  const invite = await StaffInvite.create({ codeHash: sha256(inviteCode), email, role, createdBy: actor.id, expiresAt });

  await audit('STAFF_INVITE_CREATED', {
    actorId: actor.id, actorType: 'staff', targetId: invite._id, ctx, meta: { email, role },
  });

  return {
    inviteCode,
    email,
    role,
    expiresAt,
    instructions: 'Give this code to the employee in person. It works once, only with this email, and expires in 48 hours.',
  };
}

async function listStaff() {
  const staff = await Staff.find().sort({ role: 1, name: 1 });
  return staff.map((s) => s.toJSON());
}

async function deactivateStaff(staffId, actor, ctx) {
  if (staffId === actor.id) throw new AppError(400, 'You cannot deactivate your own account', 'SELF_DEACTIVATION');

  const target = await Staff.findById(staffId);
  if (!target) throw new AppError(404, 'Staff member not found', 'NOT_FOUND');
  if (!canManageRole(actor.role, target.role)) {
    throw new AppError(403, `Your role cannot deactivate ${target.role} accounts`, 'FORBIDDEN');
  }
  if (!target.isActive) return target.toJSON();

  target.isActive = false;
  await target.save();
  await logoutEverywhere(target._id, 'staff'); // access is removed immediately, on every device

  await audit('STAFF_DEACTIVATED', {
    actorId: actor.id, actorType: 'staff', targetId: target._id, ctx, meta: { role: target.role },
  });
  return target.toJSON();
}

async function listAuditLogs({ page, limit }) {
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(),
  ]);
  return { items, page, limit, total };
}

module.exports = { createInvite, listStaff, deactivateStaff, listAuditLogs };
