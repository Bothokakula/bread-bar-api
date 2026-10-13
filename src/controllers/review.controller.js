const asyncHandler = require('../utils/asyncHandler');
const reviews = require('../services/review.service');

exports.list = asyncHandler(async (req, res) => {
  res.json({ reviews: await reviews.listRecent() });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ review: await reviews.create(req.user.id, req.body) });
});
