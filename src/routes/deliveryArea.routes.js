const router = require('express').Router();
const ctrl = require('../controllers/deliveryArea.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { deliveryAreaSchema, deliveryAreaUpdateSchema, idParamSchema } = require('../validators/schemas');

const manage = [authenticateStaff, requirePermission('delivery_areas:manage')];

router.get('/', ctrl.listActive);
router.get('/manage', ...manage, ctrl.listAll);
router.post('/', ...manage, validate({ body: deliveryAreaSchema }), ctrl.create);
router.patch('/:id', ...manage, validate({ params: idParamSchema, body: deliveryAreaUpdateSchema }), ctrl.update);
router.delete('/:id', ...manage, validate({ params: idParamSchema }), ctrl.deactivate);

module.exports = router;
