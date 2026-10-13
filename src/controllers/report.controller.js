const asyncHandler = require('../utils/asyncHandler');
const reports = require('../services/report.service');

exports.dashboard = asyncHandler(async (req, res) => {
  res.json(await reports.dashboard());
});

exports.sales = asyncHandler(async (req, res) => {
  res.json(await reports.sales(req.validated.query.period));
});
