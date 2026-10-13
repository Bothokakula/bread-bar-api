/** Records that the customer chose EFT. The reference is their payment reference, not account details. */
function pay({ reference } = {}) {
  return { method: 'eft', status: 'pending', reference: reference || undefined };
}

module.exports = { method: 'eft', pay };
