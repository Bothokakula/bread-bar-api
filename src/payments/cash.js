/** Cash is collected when the customer picks up or receives the order. No card data is stored. */
function pay() {
  return { method: 'cash', status: 'pay_on_collection' };
}

module.exports = { method: 'cash', pay };
