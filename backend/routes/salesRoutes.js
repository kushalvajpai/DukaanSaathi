const express = require('express');
const { body } = require('express-validator');
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

router.get('/', salesController.listSales);
router.get('/:id', salesController.getSaleById);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one product is required in the bill'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('payment_method').optional().isIn(['Cash', 'UPI', 'Card', 'Other']).withMessage('Invalid payment method')
  ],
  handleValidation,
  salesController.createSale
);

module.exports = router;
