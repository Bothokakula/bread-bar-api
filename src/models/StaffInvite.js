const { Schema, model } = require('mongoose');
const { STAFF_ROLES } = require('../config/roles');

/**
 * One-time invite created by the owner/manager for a specific employee.
 * Only the SHA-256 hash of the code is stored, so a database leak does not
 * reveal usable codes. The invite is locked to one email and one role.
 */
const staffInviteSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: STAFF_ROLES.filter((r) => r !== 'owner'), required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
  },
  { timestamps: true }
);

staffInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB auto-deletes expired invites

module.exports = model('StaffInvite', staffInviteSchema);
