const AppError = require('../utils/AppError');
const DeliveryArea = require('../models/DeliveryArea');
const { publish } = require('./orderEvents');

const notFound = () => new AppError(404, 'Delivery area not found', 'NOT_FOUND');

function changed() {
  publish({ type: 'menu:updated', resource: 'delivery-area' });
}

function listActive() {
  return DeliveryArea.find({ isActive: true }).select('suburb fee').sort({ suburb: 1 }).lean();
}

function listAll() {
  return DeliveryArea.find().sort({ suburb: 1 }).lean();
}

async function create(input) {
  try {
    const area = await DeliveryArea.create(input);
    changed();
    return area;
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'That suburb is already listed', 'DUPLICATE');
    throw err;
  }
}

async function update(id, input) {
  try {
    const area = await DeliveryArea.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!area) throw notFound();
    changed();
    return area;
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'That suburb is already listed', 'DUPLICATE');
    throw err;
  }
}

/** Hides the suburb from customers. Existing orders keep the fee they were charged. */
async function deactivate(id) {
  const area = await DeliveryArea.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!area) throw notFound();
  changed();
  return area;
}

module.exports = { listActive, listAll, create, update, deactivate };
