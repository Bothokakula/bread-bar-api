const { toCents } = require('../utils/money');

function isCurrent(promo, now) {
  if (!promo.isActive) return false;
  if (promo.startsAt && new Date(promo.startsAt) > now) return false;
  if (promo.endsAt && new Date(promo.endsAt) < now) return false;
  return true;
}

function lineCents(line) {
  return toCents(line.unitPrice) * line.quantity;
}

function applicableCents(promo, lines) {
  const ids = (promo.menuItemIds || []).map(String);
  const relevant = ids.length
    ? lines.filter((line) => ids.includes(String(line.menuItemId)))
    : lines;
  return relevant.reduce((sum, line) => sum + lineCents(line), 0);
}

function discountFor(promo, lines) {
  const base = applicableCents(promo, lines);
  if (base <= 0) return 0;
  if (promo.discountType === 'percent') {
    return Math.min(base, Math.round((base * promo.discountValue) / 100));
  }
  return Math.min(base, toCents(promo.discountValue));
}

/** Picks the single active promotion that saves the customer the most. */
function choosePromotion(promotions, lines, now = new Date()) {
  let best = null;
  let bestCents = 0;
  for (const promo of promotions) {
    if (!isCurrent(promo, now)) continue;
    const cents = discountFor(promo, lines);
    if (cents > bestCents) {
      best = promo;
      bestCents = cents;
    }
  }
  return { promotion: best, discountCents: bestCents };
}

module.exports = { choosePromotion, isCurrent, discountFor };
