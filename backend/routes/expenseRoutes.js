const express = require('express');
const { body } = require('express-validator');
const expenseController = require('../controllers/expenseController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

const expenseRules = [
  body('category').isIn(expenseController.ALLOWED_CATEGORIES).withMessage('Invalid expense category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('expense_date').isISO8601().withMessage('Valid expense date is required')
];

router.get('/', expenseController.listExpenses);
router.post('/', expenseRules, handleValidation, expenseController.createExpense);
router.put('/:id', expenseRules, handleValidation, expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
