const express = require('express');
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/', paymentController.getPayments);

router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than zero'),
    body('mode').optional().isIn(['CASH', 'UPI', 'CARD']).withMessage('Payment mode must be CASH, UPI, or CARD'),
    validate
  ],
  paymentController.createPayment
);

router.delete('/:id', paymentController.deletePayment);

module.exports = router;
