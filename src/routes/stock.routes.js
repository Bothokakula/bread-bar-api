const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { stockWriteSchema, stockUpdateSchema, idParamSchema } = require('../validators/schemas');

router.use(authenticateStaff, requirePermission('stock:manage'));
router.get('/', ctrl.list);
router.post('/', validate({ body: stockWriteSchema }), ctrl.create);
router.patch('/:id', validate({ params: idParamSchema, body: stockUpdateSchema }), ctrl.update);

module.exports = router;
