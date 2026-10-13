const asyncHandler = require('../utils/asyncHandler');
const menu = require('../services/menu.service');

exports.listPublic = asyncHandler(async (req, res) => {
  res.json({ items: await menu.listPublic(req.validated.query) });
});

exports.listManage = asyncHandler(async (req, res) => {
  res.json({ items: await menu.listManage() });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ item: await menu.create(req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ item: await menu.update(req.validated.params.id, req.body) });
});

exports.setAvailability = asyncHandler(async (req, res) => {
  res.json({ item: await menu.setAvailability(req.validated.params.id, req.body.isAvailable) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json(await menu.remove(req.validated.params.id));
});
