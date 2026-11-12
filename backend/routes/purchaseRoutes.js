const express = require('express');
const { body } = require('express-validator');
const purchaseController = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

router.get('/', purchaseController.listPurchases);
router.get('/suppliers', purchaseController.listSuppliers);

router.post(
  '/',
  [
    body('product_id').isInt({ min: 1 }).withMessage('Valid product is required'),
    body('supplier_name').trim().notEmpty().withMessage('Supplier name is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Purchase quantity must be at least 1'),
    body('unit_cost').isFloat({ min: 0.01 }).withMessage('Purchase price per unit must be greater than 0'),
    body('payment_status').optional().isIn(['Paid', 'Pending', 'Partial']).withMessage('Invalid payment status')
  ],
  handleValidation,
  purchaseController.createPurchase
);

router.put(
  '/:id',
  [body('payment_status').isIn(['Paid', 'Pending', 'Partial']).withMessage('Invalid payment status')],
  handleValidation,
  purchaseController.updatePurchase
);

module.exports = router;
