const router = require('express').Router();
const ctrl = require('../controllers/staffManagement.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { createInviteSchema, idParamSchema, paginationQuerySchema } = require('../validators/schemas');

router.use(authenticateStaff); // every route below needs a valid STAFF token

router.post('/invites', requirePermission('staff:invite'), validate({ body: createInviteSchema }), ctrl.createInvite);
router.get('/', requirePermission('staff:read'), ctrl.listStaff);
router.patch('/:id/deactivate', requirePermission('staff:deactivate'), validate({ params: idParamSchema }), ctrl.deactivate);
router.get('/audit-logs', requirePermission('audit:read'), validate({ query: paginationQuerySchema }), ctrl.auditLogs);

module.exports = router;
