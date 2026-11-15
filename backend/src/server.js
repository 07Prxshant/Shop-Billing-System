const app = require('./app');
const db = require('./config/db');
const { getJwtSecret } = require('./config/jwt');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Validate JWT configuration upfront (fails safely in production if secret is insecure or missing)
    getJwtSecret();

    // Initialize database
    await db.initDB();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Shop Billing API server running on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Server] Startup configuration failure:', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
