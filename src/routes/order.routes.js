const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const validate = require('../middleware/validate');
const { authenticateCustomer, authenticateStaff, authenticateAny } = require('../middleware/authenticate');
const { requirePermission, requireAnyPermission } = require('../middleware/authorize');
const { placeOrderSchema, listOrdersQuerySchema, idParamSchema, updateStatusSchema } = require('../validators/schemas');

// Customer Mobile App
router.post('/', authenticateCustomer, requirePermission('orders:create'), validate({ body: placeOrderSchema }), ctrl.placeOrder);
router.get('/mine', authenticateCustomer, requirePermission('orders:read_own'), ctrl.myOrders);
router.post('/:id/cancel', authenticateCustomer, requirePermission('orders:cancel_own'), validate({ params: idParamSchema }), ctrl.cancel);

// Business Management App
router.get('/deliveries/assigned', authenticateStaff, requirePermission('deliveries:read_assigned'), ctrl.assignedDeliveries);
router.get('/', authenticateStaff, requirePermission('orders:read'), validate({ query: listOrdersQuerySchema }), ctrl.listOrders);
router.patch(
  '/:id/status',
  authenticateStaff,
  requireAnyPermission('orders:update_status', 'deliveries:assign', 'deliveries:update_status'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  ctrl.updateStatus
);

// Both apps (ownership enforced in the service)
router.get('/:id', authenticateAny, validate({ params: idParamSchema }), ctrl.getOrder);

module.exports = router;
