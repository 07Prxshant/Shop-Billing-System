const express = require('express');
const reportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard', reportController.getDashboardSummary);
router.get('/sales', reportController.getSalesChart);

module.exports = router;
