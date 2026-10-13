const { Schema, model } = require('mongoose');

const menuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300 },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    // Recipe: how much of each stock item one portion uses. Empty means no stock is deducted.
    ingredients: {
      type: [
        {
          _id: false,
          stockItemId: { type: Schema.Types.ObjectId, ref: 'StockItem', required: true },
          quantity: { type: Number, required: true, min: 0.001 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

menuItemSchema.index({ category: 1, isAvailable: 1 });

module.exports = model('MenuItem', menuItemSchema);
