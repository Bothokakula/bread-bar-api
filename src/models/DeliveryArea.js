const { Schema, model } = require('mongoose');

const deliveryAreaSchema = new Schema(
  {
    suburb: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 60 },
    fee: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('DeliveryArea', deliveryAreaSchema);
