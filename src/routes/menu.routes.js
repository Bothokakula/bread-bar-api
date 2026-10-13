const router = require('express').Router();
const ctrl = require('../controllers/menu.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const {
  menuCreateSchema, menuUpdateSchema, menuQuerySchema, availabilitySchema, idParamSchema,
} = require('../validators/schemas');

const manage = [authenticateStaff, requirePermission('menu:manage')];

router.get('/', validate({ query: menuQuerySchema }), ctrl.listPublic);
router.get('/manage', ...manage, ctrl.listManage);
router.post('/', ...manage, validate({ body: menuCreateSchema }), ctrl.create);
router.patch('/:id/availability', ...manage, validate({ params: idParamSchema, body: availabilitySchema }), ctrl.setAvailability);
router.patch('/:id', ...manage, validate({ params: idParamSchema, body: menuUpdateSchema }), ctrl.update);
router.delete('/:id', ...manage, validate({ params: idParamSchema }), ctrl.remove);

module.exports = router;
