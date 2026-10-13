const { Schema, model } = require('mongoose');

const promotionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    menuItemIds: { type: [{ type: Schema.Types.ObjectId, ref: 'MenuItem' }], default: [] },
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

promotionSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

module.exports = model('Promotion', promotionSchema);
