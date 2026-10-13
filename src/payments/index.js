const AppError = require('../utils/AppError');
const cash = require('./cash');
const card = require('./card');
const eft = require('./eft');

const STRATEGIES = Object.freeze({
  cash,
  card,
  eft,
});

function applyPayment(method, details) {
  const strategy = STRATEGIES[method];
  if (!strategy) throw new AppError(400, 'Choose cash, card, or EFT', 'INVALID_PAYMENT');
  return strategy.pay(details);
}

module.exports = { STRATEGIES, applyPayment };
