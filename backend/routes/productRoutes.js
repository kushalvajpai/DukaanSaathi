const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

const productRules = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('purchase_price').isFloat({ min: 0 }).withMessage('Purchase price must be 0 or greater'),
  body('selling_price').isFloat({ min: 0 }).withMessage('Selling price must be 0 or greater'),
  body('min_stock_level').optional().isInt({ min: 0 }).withMessage('Minimum stock level must be 0 or greater')
];

router.get('/', productController.listProducts);
router.get('/categories', productController.getCategories);
router.post('/categories', [body('name').trim().notEmpty().withMessage('Category name is required')], handleValidation, productController.createCategory);
router.get('/search', productController.binarySearchProduct);
router.get('/sort', productController.sortProducts);
router.get('/:id', productController.getProductById);
router.post(
  '/',
  [...productRules, body('available_quantity').optional().isInt({ min: 0 }).withMessage('Quantity cannot be negative')],
  handleValidation,
  productController.createProduct
);
router.put('/:id', productRules, handleValidation, productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
