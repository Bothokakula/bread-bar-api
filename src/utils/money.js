const toCents = (rands) => Math.round(Number(rands) * 100);
const toRands = (cents) => cents / 100;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

module.exports = { toCents, toRands, round2 };
