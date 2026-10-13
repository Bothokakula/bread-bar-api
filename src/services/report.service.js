const Order = require('../models/Order');
const { round2 } = require('../utils/money');

const TIMEZONE = 'Africa/Johannesburg';

function rangeFor(period, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'weekly') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'monthly') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    const AppError = require('../utils/AppError');
    throw new AppError(400, 'Period must be daily, weekly, or monthly', 'VALIDATION_ERROR');
  }
  return { start, end };
}

/** Completed orders whose completion timestamp falls in the window. */
function completedPipeline(start, end) {
  return [
    { $match: { status: 'Completed' } },
    {
      $addFields: {
        completedAt: {
          $max: {
            $map: {
              input: {
                $filter: {
                  input: '$statusHistory',
                  as: 'entry',
                  cond: { $eq: ['$$entry.status', 'Completed'] },
                },
              },
              as: 'entry',
              in: '$$entry.at',
            },
          },
        },
      },
    },
    { $match: { completedAt: { $gte: start, $lte: end } } },
  ];
}

async function dashboard(now = new Date()) {
  const { start, end } = rangeFor('daily', now);
  const pipeline = completedPipeline(start, end);
  const [totals] = await Order.aggregate([
    ...pipeline,
    { $group: { _id: null, orderCount: { $sum: 1 }, salesTotal: { $sum: '$totalAmount' } } },
  ]);
  const bestSellers = await Order.aggregate([
    ...pipeline,
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItemId',
        name: { $first: '$items.name' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
      },
    },
    { $sort: { quantity: -1, name: 1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        menuItemId: '$_id',
        name: 1,
        quantity: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);

  return {
    orderCount: totals?.orderCount || 0,
    salesTotal: round2(totals?.salesTotal || 0),
    bestSellers,
  };
}

async function sales(period, now = new Date()) {
  const { start, end } = rangeFor(period, now);
  const days = await Order.aggregate([
    ...completedPipeline(start, end),
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: TIMEZONE } },
        orderCount: { $sum: 1 },
        salesTotal: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        orderCount: 1,
        salesTotal: { $round: ['$salesTotal', 2] },
      },
    },
  ]);

  return { period, from: start.toISOString(), to: end.toISOString(), days };
}

module.exports = { rangeFor, dashboard, sales };
