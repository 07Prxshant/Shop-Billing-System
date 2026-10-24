const express = require('express');
const { body } = require('express-validator');
const settingController = require('../controllers/settingController');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authMiddleware);

router.get('/', settingController.getSettings);
router.put(
  '/',
  [
    body('shop_name').trim().notEmpty().withMessage('Shop name is required'),
    validate
  ],
  settingController.updateSettings
);

module.exports = router;
