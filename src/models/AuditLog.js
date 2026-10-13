const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId },
    actorType: { type: String, enum: ['customer', 'staff', 'system'] },
    targetId: { type: Schema.Types.ObjectId },
    ip: String,
    userAgent: String,
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = model('AuditLog', auditLogSchema);
