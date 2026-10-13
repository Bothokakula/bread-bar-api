const asyncHandler = require('../utils/asyncHandler');
const areas = require('../services/deliveryArea.service');

exports.listActive = asyncHandler(async (req, res) => {
  res.json({ areas: await areas.listActive() });
});

exports.listAll = asyncHandler(async (req, res) => {
  res.json({ areas: await areas.listAll() });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ area: await areas.create(req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ area: await areas.update(req.validated.params.id, req.body) });
});

exports.deactivate = asyncHandler(async (req, res) => {
  res.json({ area: await areas.deactivate(req.validated.params.id) });
});
