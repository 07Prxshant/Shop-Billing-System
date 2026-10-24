const express = require('express');
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/', billController.getAllBills);
router.get('/:id', billController.getBillById);

router.post(
  '/',
  [
    body('customer_id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required in the bill'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('Product ID must be valid'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount cannot be negative'),
    body('amount_paid').optional().isFloat({ min: 0 }).withMessage('Amount paid cannot be negative'),
    validate
  ],
  billController.createBill
);

router.put(
  '/:id',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('Product ID must be valid'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount cannot be negative'),
    body('amount_paid').optional().isFloat({ min: 0 }).withMessage('Amount paid cannot be negative'),
    validate
  ],
  billController.updateBill
);

router.patch(
  '/:id/paid',
  [
    body('amount_paid').isFloat({ min: 0 }).withMessage('Amount paid must be non-negative'),
    validate
  ],
  billController.quickUpdatePaid
);

router.delete('/:id', billController.deleteBill);

module.exports = router;
