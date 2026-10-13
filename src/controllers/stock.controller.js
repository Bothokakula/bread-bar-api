const asyncHandler = require('../utils/asyncHandler');
const stock = require('../services/stock.service');

exports.list = asyncHandler(async (req, res) => {
  res.json({ items: await stock.list() });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ item: await stock.create(req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ item: await stock.update(req.validated.params.id, req.body) });
});
