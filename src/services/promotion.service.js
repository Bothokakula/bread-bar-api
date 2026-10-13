const AppError = require('../utils/AppError');
const Promotion = require('../models/Promotion');
const { publish } = require('./orderEvents');
const { isCurrent } = require('./promotionMath');

const notFound = () => new AppError(404, 'Promotion not found', 'NOT_FOUND');

function changed() {
  publish({ type: 'menu:updated', resource: 'promotion' });
}

async function listActive(now = new Date()) {
  const promos = await Promotion.find({ isActive: true }).sort({ startsAt: -1 }).lean();
  return promos.filter((promo) => isCurrent(promo, now));
}

function listAll() {
  return Promotion.find().sort({ createdAt: -1 }).lean();
}

async function create(input) {
  const promo = await Promotion.create(input);
  changed();
  return promo;
}

async function update(id, input) {
  const promo = await Promotion.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!promo) throw notFound();
  changed();
  return promo;
}

async function deactivate(id) {
  const promo = await Promotion.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!promo) throw notFound();
  changed();
  return promo;
}

module.exports = { listActive, listAll, create, update, deactivate };
