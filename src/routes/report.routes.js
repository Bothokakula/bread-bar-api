const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { salesQuerySchema } = require('../validators/schemas');

router.use(authenticateStaff, requirePermission('reports:read'));
router.get('/dashboard', ctrl.dashboard);
router.get('/sales', validate({ query: salesQuerySchema }), ctrl.sales);

module.exports = router;
