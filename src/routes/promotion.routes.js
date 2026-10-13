const router = require('express').Router();
const ctrl = require('../controllers/promotion.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { promotionSchema, promotionUpdateSchema, idParamSchema } = require('../validators/schemas');

const manage = [authenticateStaff, requirePermission('promotions:manage')];

router.get('/active', ctrl.listActive);
router.get('/', ...manage, ctrl.listAll);
router.post('/', ...manage, validate({ body: promotionSchema }), ctrl.create);
router.patch('/:id', ...manage, validate({ params: idParamSchema, body: promotionUpdateSchema }), ctrl.update);
router.delete('/:id', ...manage, validate({ params: idParamSchema }), ctrl.deactivate);

module.exports = router;
