const express = require('express');
const { body } = require('express-validator');
const customerController = require('../controllers/customerController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/summary', customerController.getCustomerSummary);
router.get('/:id/transactions', customerController.getCustomerTransactions);
router.get('/:id/statement', customerController.getCustomerStatement);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    validate
  ],
  customerController.createCustomer
);

router.put(
  '/:id',
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    validate
  ],
  customerController.updateCustomer
);

router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
