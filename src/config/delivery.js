/**
 * Delivery fees live in the DeliveryArea collection so the manager can change
 * them without a code deploy. Returns null when the suburb is not served.
 */
const DeliveryArea = require('../models/DeliveryArea');

async function getDeliveryFee(suburb) {
  if (!suburb) return null;
  const area = await DeliveryArea.findOne({
    suburb: String(suburb).trim().toLowerCase(),
    isActive: true,
  }).lean();
  return area ? area.fee : null;
}

module.exports = { getDeliveryFee };
