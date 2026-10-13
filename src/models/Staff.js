const { Schema, model } = require('mongoose');
const { STAFF_ROLES } = require('../config/roles');
const { stripPrivateFields } = require('./toJSON');

/**
 * Staff live in a separate collection from customers. A customer account can
 * never become a staff account, and staff can only be created through the
 * owner-setup key or a one-time invite code.
 */
const staffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: STAFF_ROLES, required: true },
    passwordHash: { type: String, required: true, select: false },
    pinHash: { type: String, required: true, select: false }, // personal 6-digit staff PIN
    isActive: { type: Boolean, default: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },

    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: stripPrivateFields } }
);

// The database itself guarantees there can only ever be ONE owner account.
staffSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: 'owner' } });

module.exports = model('Staff', staffSchema);
