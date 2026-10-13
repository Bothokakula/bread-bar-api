const { Schema, model } = require('mongoose');
const { ORDER_STATUSES } = require('../services/orderWorkflow');

const orderItemSchema = new Schema(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    orderType: { type: String, enum: ['collection', 'delivery'], required: true },
    deliveryAddress: { line1: String, suburb: String },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0, min: 0 },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    deliveryFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    payment: {
      method: { type: String, enum: ['cash', 'card', 'eft'], required: true },
      status: { type: String, required: true },
      reference: { type: String },
    },
    loyaltyAwarded: { type: Boolean, default: false },
    status: { type: String, enum: ORDER_STATUSES, default: 'Received', index: true },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUSES },
        changedBy: Schema.Types.ObjectId,
        changedByType: { type: String, enum: ['customer', 'staff'] },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });

module.exports = model('Order', orderSchema);
