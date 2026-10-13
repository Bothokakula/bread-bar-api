const AppError = require('../utils/AppError');
const Review = require('../models/Review');
const Order = require('../models/Order');

async function create(customerId, { orderId, rating, comment }) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status !== 'Completed') {
    throw new AppError(409, 'You can review an order after it is completed', 'ORDER_NOT_COMPLETE');
  }
  if (await Review.exists({ orderId })) {
    throw new AppError(409, 'You have already reviewed this order', 'REVIEW_EXISTS');
  }

  try {
    return await Review.create({ orderId, customerId, rating, comment });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'You have already reviewed this order', 'REVIEW_EXISTS');
    throw err;
  }
}

async function listRecent() {
  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('customerId', 'name')
    .lean();

  return reviews.map((review) => ({
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    customerName: review.customerId?.name || 'Customer',
  }));
}

module.exports = { create, listRecent };
