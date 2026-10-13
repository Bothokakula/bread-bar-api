const { Schema, model } = require('mongoose');
const { stripPrivateFields } = require('./toJSON');

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer'], default: 'customer', immutable: true },
    loyaltyPoints: { type: Number, default: 0, min: 0 },

    // security bookkeeping (stripped from every response)
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: stripPrivateFields } }
);

module.exports = model('Customer', customerSchema);
