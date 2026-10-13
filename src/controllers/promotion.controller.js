const asyncHandler = require('../utils/asyncHandler');
const promotions = require('../services/promotion.service');

exports.listActive = asyncHandler(async (req, res) => {
  res.json({ promotions: await promotions.listActive() });
});

exports.listAll = asyncHandler(async (req, res) => {
  res.json({ promotions: await promotions.listAll() });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ promotion: await promotions.create(req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ promotion: await promotions.update(req.validated.params.id, req.body) });
});

exports.deactivate = asyncHandler(async (req, res) => {
  res.json({ promotion: await promotions.deactivate(req.validated.params.id) });
});
