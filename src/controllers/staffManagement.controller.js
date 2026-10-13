const asyncHandler = require('../utils/asyncHandler');
const staffManagement = require('../services/staffManagement.service');
const { requestContext } = require('../utils/audit');

exports.createInvite = asyncHandler(async (req, res) => {
  res.status(201).json(await staffManagement.createInvite(req.body, req.user, requestContext(req)));
});

exports.listStaff = asyncHandler(async (req, res) => {
  res.json({ staff: await staffManagement.listStaff() });
});

exports.deactivate = asyncHandler(async (req, res) => {
  const staff = await staffManagement.deactivateStaff(req.validated.params.id, req.user, requestContext(req));
  res.json({ staff });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  res.json(await staffManagement.listAuditLogs(req.validated.query));
});
