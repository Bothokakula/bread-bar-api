const asyncHandler = require('../utils/asyncHandler');
const customerAuth = require('../services/customerAuth.service');
const session = require('../services/session.service');

exports.register = asyncHandler(async (req, res) => {
  res.status(201).json(await customerAuth.register(req.body));
});

exports.login = asyncHandler(async (req, res) => {
  res.json(await customerAuth.login(req.body));
});

exports.refresh = asyncHandler(async (req, res) => {
  res.json(await session.refreshSession(req.body.refreshToken, 'customer'));
});

exports.logout = asyncHandler(async (req, res) => {
  await session.logout(req.body.refreshToken, 'customer');
  res.status(204).end();
});

exports.logoutAll = asyncHandler(async (req, res) => {
  await session.logoutEverywhere(req.user.id, 'customer');
  res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: await customerAuth.getProfile(req.user.id) });
});
