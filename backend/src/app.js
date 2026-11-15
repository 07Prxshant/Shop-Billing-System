const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const billRoutes = require('./routes/billRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const settingRoutes = require('./routes/settingRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoints (both /health and /api/health)
const healthHandler = async (req, res) => {
  try {
    const dbHealth = await db.checkDbHealth();
    const isProduction = process.env.NODE_ENV === 'production';
    const isHealthy = dbHealth.connected && (!isProduction || dbHealth.driver === 'mysql' || process.env.ALLOW_IN_MEMORY_FALLBACK === 'true');
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'Shop Billing System API is healthy and operational' : 'Database connectivity error',
      database: {
        connected: dbHealth.connected,
        driver: dbHealth.driver
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Registered API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reports', reportRoutes);

// In production or unified hosting (e.g. Railway, Docker):
// Serve compiled frontend SPA if frontend/dist exists
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);

module.exports = app;
