const router = require('express').Router();
const ctrl = require('../controllers/review.controller');
const validate = require('../middleware/validate');
const { authenticateCustomer } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const { reviewSchema } = require('../validators/schemas');

router.get('/', ctrl.list);
router.post('/', authenticateCustomer, requirePermission('reviews:create'), validate({ body: reviewSchema }), ctrl.create);

module.exports = router;
