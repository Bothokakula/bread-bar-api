const { Schema, model } = require('mongoose');

const stockItemSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    quantityOnHand: { type: Number, required: true, min: 0 },
    reorderLevel: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports = model('StockItem', stockItemSchema);
