const router = require('express').Router();
const ctrl = require('../controllers/customerAuth.controller');
const validate = require('../middleware/validate');
const { authenticateCustomer } = require('../middleware/authenticate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');
const { customerRegisterSchema, customerLoginSchema, refreshSchema } = require('../validators/schemas');

// Public
router.post('/register', registerLimiter, validate({ body: customerRegisterSchema }), ctrl.register);
router.post('/login', loginLimiter, validate({ body: customerLoginSchema }), ctrl.login);
router.post('/refresh', loginLimiter, validate({ body: refreshSchema }), ctrl.refresh);
router.post('/logout', validate({ body: refreshSchema }), ctrl.logout);

// Protected
router.get('/me', authenticateCustomer, ctrl.me);
router.post('/logout-all', authenticateCustomer, ctrl.logoutAll);

module.exports = router;
