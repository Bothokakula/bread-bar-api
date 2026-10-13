const AppError = require('../utils/AppError');
const MenuItem = require('../models/MenuItem');
const StockItem = require('../models/StockItem');
const Order = require('../models/Order');
const { publish } = require('./orderEvents');

const notFound = () => new AppError(404, 'Menu item not found', 'NOT_FOUND');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function changed() {
  publish({ type: 'menu:updated', resource: 'menu' });
}

async function assertIngredients(ingredients) {
  if (!ingredients?.length) return;
  const ids = [...new Set(ingredients.map((row) => String(row.stockItemId)))];
  const found = await StockItem.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) {
    throw new AppError(400, 'One or more ingredients do not exist', 'INVALID_INGREDIENT');
  }
}

async function listPublic({ category, q } = {}) {
  const filter = { isAvailable: true };
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  return MenuItem.find(filter).sort({ category: 1, name: 1 }).lean();
}

function listManage() {
  return MenuItem.find().sort({ category: 1, name: 1 }).lean();
}

async function create(input) {
  await assertIngredients(input.ingredients);
  const item = await MenuItem.create(input);
  changed();
  return item;
}

async function update(id, input) {
  if (input.ingredients) await assertIngredients(input.ingredients);
  const item = await MenuItem.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!item) throw notFound();
  changed();
  return item;
}

async function setAvailability(id, isAvailable) {
  const item = await MenuItem.findByIdAndUpdate(id, { isAvailable }, { new: true });
  if (!item) throw notFound();
  changed();
  return item;
}

/**
 * Items that already appear on an order are marked unavailable instead of
 * deleted, so old receipts keep their names and prices.
 */
async function remove(id) {
  const item = await MenuItem.findById(id);
  if (!item) throw notFound();
  const used = await Order.exists({ 'items.menuItemId': item._id });
  if (used) {
    item.isAvailable = false;
    await item.save();
    changed();
    return { item, deleted: false };
  }
  await item.deleteOne();
  changed();
  return { deleted: true };
}

module.exports = { listPublic, listManage, create, update, setAvailability, remove };
