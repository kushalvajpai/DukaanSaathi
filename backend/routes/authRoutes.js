const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

router.post(
  '/register',
  authLimiter,
  [
    body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().isLength({ min: 7, max: 20 }).withMessage('Valid phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('storeName').trim().notEmpty().withMessage('Store name is required')
  ],
  handleValidation,
  authController.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  handleValidation,
  authController.login
);

router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
