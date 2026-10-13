const asyncHandler = require('../utils/asyncHandler');
const staffAuth = require('../services/staffAuth.service');
const session = require('../services/session.service');
const { requestContext } = require('../utils/audit');

exports.setupOwner = asyncHandler(async (req, res) => {
  res.status(201).json(await staffAuth.setupOwner(req.body, requestContext(req)));
});

exports.register = asyncHandler(async (req, res) => {
  res.status(201).json(await staffAuth.register(req.body, requestContext(req)));
});

exports.login = asyncHandler(async (req, res) => {
  res.json(await staffAuth.login(req.body, requestContext(req)));
});

exports.refresh = asyncHandler(async (req, res) => {
  res.json(await session.refreshSession(req.body.refreshToken, 'staff'));
});

exports.logout = asyncHandler(async (req, res) => {
  await session.logout(req.body.refreshToken, 'staff');
  res.status(204).end();
});

exports.logoutAll = asyncHandler(async (req, res) => {
  await session.logoutEverywhere(req.user.id, 'staff');
  res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: await staffAuth.getProfile(req.user.id) });
});
