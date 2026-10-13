const { toCents } = require('./money');

/** 1 point per R10 of the order total (R9.99 earns nothing). */
function pointsForTotal(totalRands) {
  const cents = toCents(totalRands);
  if (cents <= 0) return 0;
  return Math.floor(cents / 1000);
}

module.exports = { pointsForTotal };
