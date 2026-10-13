const router = require('express').Router();
const ctrl = require('../controllers/staffAuth.controller');
const validate = require('../middleware/validate');
const { authenticateStaff } = require('../middleware/authenticate');
const { loginLimiter, registerLimiter, setupLimiter } = require('../middleware/rateLimiters');
const { ownerSetupSchema, staffRegisterSchema, staffLoginSchema, refreshSchema } = require('../validators/schemas');

// Public - but each one requires a business-only secret
router.post('/setup-owner', setupLimiter, validate({ body: ownerSetupSchema }), ctrl.setupOwner);  // Business Setup Key
router.post('/register', registerLimiter, validate({ body: staffRegisterSchema }), ctrl.register); // one-time invite code
router.post('/login', loginLimiter, validate({ body: staffLoginSchema }), ctrl.login);             // password + staff PIN
router.post('/refresh', loginLimiter, validate({ body: refreshSchema }), ctrl.refresh);
router.post('/logout', validate({ body: refreshSchema }), ctrl.logout);

// Protected
router.get('/me', authenticateStaff, ctrl.me);
router.post('/logout-all', authenticateStaff, ctrl.logoutAll);

module.exports = router;
