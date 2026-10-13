/** Records that the customer chose card. The reference is a till slip id, never a card number. */
function pay({ reference } = {}) {
  return { method: 'card', status: 'pending', reference: reference || undefined };
}

module.exports = { method: 'card', pay };
