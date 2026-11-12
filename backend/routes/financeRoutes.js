const express = require('express');
const { body } = require('express-validator');
const financeController = require('../controllers/financeController');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', financeController.getDashboard);
router.get('/pnl', financeController.getProfitAndLoss);
router.get('/reports/:type', financeController.getReport);
router.get('/reports/:type/csv', financeController.exportReportCsv);
router.get('/settings', financeController.getSettings);
router.put(
  '/settings',
  [
    body('owner_name').trim().notEmpty().withMessage('Owner name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('store_name').trim().notEmpty().withMessage('Store name is required'),
    body('business_type').trim().notEmpty().withMessage('Business type is required')
  ],
  handleValidation,
  financeController.updateSettings
);
router.post('/demo/reset', financeController.resetDemo);

module.exports = router;
