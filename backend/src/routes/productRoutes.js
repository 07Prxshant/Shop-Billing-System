const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All product routes require valid JWT
router.use(authMiddleware);

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a valid non-negative number'),
    body('gst_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('GST % must be between 0 and 100'),
    body('stock_qty').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
    body('low_stock_limit').optional().isInt({ min: 0 }).withMessage('Low stock limit must be a non-negative integer'),
    validate
  ],
  productController.createProduct
);

router.put(
  '/:id',
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a valid non-negative number'),
    body('gst_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('GST % must be between 0 and 100'),
    body('stock_qty').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
    body('low_stock_limit').optional().isInt({ min: 0 }).withMessage('Low stock limit must be a non-negative integer'),
    validate
  ],
  productController.updateProduct
);

router.delete('/:id', productController.deleteProduct);

module.exports = router;
