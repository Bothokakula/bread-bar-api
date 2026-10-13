/**
 * Order placement, ownership checks, and the status state machine.
 * Prices, discounts, delivery fees, and loyalty points are decided here.
 */
const AppError = require('../utils/AppError');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Staff = require('../models/Staff');
const Customer = require('../models/Customer');
const Promotion = require('../models/Promotion');
const { hasPermission } = require('../config/roles');
const { getDeliveryFee } = require('../config/delivery');
const { requiredPermissionFor } = require('./orderWorkflow');
const { toCents, toRands } = require('../utils/money');
const { pointsForTotal } = require('../utils/loyalty');
const { applyPayment } = require('../payments');
const { choosePromotion } = require('./promotionMath');
const { deductForLines, restoreForLines } = require('./stock.service');
const { publish } = require('./orderEvents');

const notFound = () => new AppError(404, 'Order not found', 'NOT_FOUND');
const conflict = () => new AppError(409, 'This order was just updated by someone else. Refresh and try again.', 'CONFLICT');

function publishOrder(type, order) {
  const plain = order.toObject ? order.toObject() : { ...order };
  plain.customerId = plain.customerId ? String(plain.customerId) : plain.customerId;
  if (plain.assignedDriverId) plain.assignedDriverId = String(plain.assignedDriverId);
  publish({ type, order: plain });
}

async function placeOrder(customerId, { orderType, items, deliveryAddress, paymentMethod, paymentReference }) {
  const ids = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems = await MenuItem.find({ _id: { $in: ids }, isAvailable: true }).lean();
  const byId = new Map(menuItems.map((item) => [String(item._id), item]));

  // Prices come from the database. The app never tells the server what to charge.
  const lines = items.map(({ menuItemId, quantity }) => {
    const item = byId.get(String(menuItemId).toLowerCase());
    if (!item) throw new AppError(400, 'One or more items in your cart are no longer available', 'ITEM_UNAVAILABLE');
    return { menuItemId: item._id, name: item.name, quantity, unitPrice: item.price };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + toCents(line.unitPrice) * line.quantity, 0);
  const promos = await Promotion.find({ isActive: true }).lean();
  const { promotion, discountCents } = choosePromotion(promos, lines);
  const foodCents = subtotalCents - discountCents;

  let deliveryFeeCents = 0;
  if (orderType === 'delivery') {
    const fee = await getDeliveryFee(deliveryAddress.suburb);
    if (fee === null) throw new AppError(400, 'Sorry, we do not deliver to this suburb yet', 'OUTSIDE_DELIVERY_AREA');
    deliveryFeeCents = toCents(fee);
  }

  const payment = applyPayment(paymentMethod, { reference: paymentReference });
  const lowStock = await deductForLines(lines);

  let order;
  try {
    order = await Order.create({
      customerId,
      items: lines,
      orderType,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      subtotal: toRands(subtotalCents),
      discount: toRands(discountCents),
      promotionId: promotion ? promotion._id : undefined,
      deliveryFee: toRands(deliveryFeeCents),
      totalAmount: toRands(foodCents + deliveryFeeCents),
      payment,
      statusHistory: [{ status: 'Received', changedBy: customerId, changedByType: 'customer' }],
    });
  } catch (err) {
    await restoreForLines(lines);
    throw err;
  }

  publishOrder('order:created', order);
  if (lowStock.length) publish({ type: 'stock:low', items: lowStock });
  return order;
}

function listCustomerOrders(customerId) {
  return Order.find({ customerId }).sort({ createdAt: -1 }).limit(50).lean();
}

function listOrders({ status, limit }) {
  const filter = status ? { status } : {};
  return Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

function listAssignedDeliveries(driverId) {
  return Order.find({ assignedDriverId: driverId, status: 'OutForDelivery' }).sort({ updatedAt: 1 }).lean();
}

/**
 * Ownership check (prevents IDOR). A customer asking for someone else's
 * order gets 404, so they can't even tell that the order exists.
 */
async function getOrderForUser(orderId, user) {
  if (user.type === 'customer') {
    const order = await Order.findOne({ _id: orderId, customerId: user.id }).lean();
    if (!order) throw notFound();
    return order;
  }

  const order = await Order.findById(orderId).lean();
  if (!order) throw notFound();
  if (hasPermission(user.role, 'orders:read')) return order;
  if (user.role === 'delivery' && String(order.assignedDriverId) === user.id) return order;
  throw notFound();
}

async function awardLoyaltyIfCompleted(order) {
  if (!order || order.status !== 'Completed') return 0;
  const points = pointsForTotal(order.totalAmount);
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: 'Completed', loyaltyAwarded: { $ne: true } },
    { $set: { loyaltyAwarded: true } }
  );
  if (!claimed) return 0;
  if (points > 0) await Customer.updateOne({ _id: order.customerId }, { $inc: { loyaltyPoints: points } });
  return points;
}

async function updateStatus(orderId, { status, driverId }, user) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound();

  const permission = requiredPermissionFor(order.status, status);
  if (!permission) {
    throw new AppError(409, `An order cannot move from ${order.status} to ${status}`, 'INVALID_TRANSITION');
  }
  if (!hasPermission(user.role, permission)) {
    throw new AppError(403, 'You do not have permission to make this status change', 'FORBIDDEN');
  }

  const set = { status };
  const previous = order.status;

  if (status === 'OutForDelivery') {
    if (order.orderType !== 'delivery') throw new AppError(409, 'This is a collection order', 'INVALID_TRANSITION');
    if (!driverId) throw new AppError(400, 'Choose a driver to assign this delivery to', 'DRIVER_REQUIRED');
    const driver = await Staff.exists({ _id: driverId, role: 'delivery', isActive: true });
    if (!driver) throw new AppError(400, 'That driver was not found or is inactive', 'INVALID_DRIVER');
    set.assignedDriverId = driverId;
  }

  if (status === 'Collected' && order.orderType !== 'collection') {
    throw new AppError(409, 'This is a delivery order', 'INVALID_TRANSITION');
  }

  if (order.status === 'OutForDelivery' && user.role === 'delivery' && String(order.assignedDriverId) !== user.id) {
    throw new AppError(403, 'This delivery is not assigned to you', 'FORBIDDEN');
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { status, changedBy: user.id, changedByType: 'staff' } } },
    { new: true }
  );
  if (!updated) throw conflict();

  // Ingredients are returned only if the kitchen has not started (still Received).
  if (previous === 'Received' && status === 'Cancelled') await restoreForLines(updated.items);
  if (status === 'Completed') await awardLoyaltyIfCompleted(updated);

  publishOrder('order:updated', updated);
  return updated;
}

/** Customers may cancel only their own order, and only while it is still Received. */
async function cancelOrder(orderId, customerId) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) throw notFound();
  if (order.status !== 'Received') {
    throw new AppError(409, 'You can only cancel an order that has just been received', 'INVALID_TRANSITION');
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, customerId, status: 'Received' },
    {
      $set: { status: 'Cancelled' },
      $push: { statusHistory: { status: 'Cancelled', changedBy: customerId, changedByType: 'customer' } },
    },
    { new: true }
  );
  if (!updated) throw conflict();

  await restoreForLines(updated.items);
  publishOrder('order:updated', updated);
  return updated;
}

module.exports = {
  placeOrder,
  listCustomerOrders,
  listOrders,
  listAssignedDeliveries,
  getOrderForUser,
  updateStatus,
  cancelOrder,
  awardLoyaltyIfCompleted,
};
