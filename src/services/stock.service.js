const AppError = require('../utils/AppError');
const StockItem = require('../models/StockItem');
const MenuItem = require('../models/MenuItem');
const { publish } = require('./orderEvents');

const notFound = () => new AppError(404, 'Stock item not found', 'NOT_FOUND');

function present(item) {
  const raw = item.toObject ? item.toObject() : item;
  return { ...raw, isLow: raw.quantityOnHand <= raw.reorderLevel };
}

async function list() {
  const items = await StockItem.find().sort({ name: 1 }).lean();
  return items.map(present);
}

async function create(input) {
  try {
    const item = await StockItem.create(input);
    return present(item);
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'A stock item with this name already exists', 'DUPLICATE');
    throw err;
  }
}

async function update(id, input) {
  const item = await StockItem.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!item) throw notFound();
  const presented = present(item);
  if (presented.isLow) publish({ type: 'stock:low', items: [presented] });
  return presented;
}

/**
 * How much of each stock item the lines need, based on each menu item's recipe.
 */
async function usageFor(lines) {
  const ids = [...new Set(lines.map((line) => String(line.menuItemId)))];
  const menuItems = await MenuItem.find({ _id: { $in: ids } }).select('ingredients').lean();
  const byId = new Map(menuItems.map((item) => [String(item._id), item]));
  const need = new Map();

  for (const line of lines) {
    const menu = byId.get(String(line.menuItemId));
    for (const ingredient of menu?.ingredients || []) {
      const key = String(ingredient.stockItemId);
      need.set(key, (need.get(key) || 0) + ingredient.quantity * line.quantity);
    }
  }
  return need;
}

async function restoreApplied(applied) {
  for (const { stockItemId, qty } of applied) {
    await StockItem.updateOne({ _id: stockItemId }, { $inc: { quantityOnHand: qty } });
  }
}

/**
 * Deducts recipe quantities. If any ingredient is short, earlier deductions
 * are put back and the order is rejected.
 */
async function deductForLines(lines) {
  const need = await usageFor(lines);
  const applied = [];
  try {
    for (const [stockItemId, qty] of need) {
      const updated = await StockItem.findOneAndUpdate(
        { _id: stockItemId, quantityOnHand: { $gte: qty } },
        { $inc: { quantityOnHand: -qty } },
        { new: true }
      ).lean();
      if (!updated) throw new AppError(409, 'Not enough stock to make this order', 'INSUFFICIENT_STOCK');
      applied.push({ stockItemId, qty, updated });
    }
  } catch (err) {
    await restoreApplied(applied);
    throw err;
  }

  const low = applied
    .filter((row) => row.updated.quantityOnHand <= row.updated.reorderLevel)
    .map((row) => present(row.updated));
  return low;
}

async function restoreForLines(lines) {
  const need = await usageFor(lines);
  await restoreApplied([...need].map(([stockItemId, qty]) => ({ stockItemId, qty })));
}

module.exports = { list, create, update, deductForLines, restoreForLines, present };
