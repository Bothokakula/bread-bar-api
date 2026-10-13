/**
 * Order lifecycle from the UML State Diagram (Section 6), with the
 * permission required for each transition. Any transition not listed
 * here is rejected, so statuses can't jump (e.g. Received -> Completed).
 */
const ORDER_STATUSES = Object.freeze([
  'Received', 'Preparing', 'Ready', 'OutForDelivery', 'Collected', 'Completed', 'Cancelled',
]);

const TRANSITIONS = Object.freeze({
  Received: { Preparing: 'orders:update_status', Cancelled: 'orders:update_status' },
  Preparing: { Ready: 'orders:update_status', Cancelled: 'orders:update_status' },
  Ready: { OutForDelivery: 'deliveries:assign', Collected: 'orders:update_status' },
  OutForDelivery: { Completed: 'deliveries:update_status' },
  Collected: { Completed: 'orders:update_status' },
  Completed: {},
  Cancelled: {},
});

function requiredPermissionFor(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] && TRANSITIONS[fromStatus][toStatus]) || null;
}

module.exports = { ORDER_STATUSES, TRANSITIONS, requiredPermissionFor };
