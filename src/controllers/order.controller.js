const asyncHandler = require('../utils/asyncHandler');
const orders = require('../services/order.service');

exports.placeOrder = asyncHandler(async (req, res) => {
  res.status(201).json({ order: await orders.placeOrder(req.user.id, req.body) });
});

exports.myOrders = asyncHandler(async (req, res) => {
  res.json({ orders: await orders.listCustomerOrders(req.user.id) });
});

exports.listOrders = asyncHandler(async (req, res) => {
  res.json({ orders: await orders.listOrders(req.validated.query) });
});

exports.assignedDeliveries = asyncHandler(async (req, res) => {
  res.json({ orders: await orders.listAssignedDeliveries(req.user.id) });
});

exports.getOrder = asyncHandler(async (req, res) => {
  res.json({ order: await orders.getOrderForUser(req.validated.params.id, req.user) });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  res.json({ order: await orders.updateStatus(req.validated.params.id, req.body, req.user) });
});

exports.cancel = asyncHandler(async (req, res) => {
  res.json({ order: await orders.cancelOrder(req.validated.params.id, req.user.id) });
});
