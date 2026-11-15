const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../config/jwt');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Parameterized query to prevent SQL injection
    const [rows] = await db.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = rows[0];

    let isMatch = false;
    if (user.password_hash) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    // Demo bypass: strictly forbidden in production.
    // In production, only cryptographic hash verification is accepted.
    if (!isMatch && process.env.NODE_ENV !== 'production') {
      if (password === 'admin123' && user.email === 'admin@shop.com') {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = signToken(payload);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: payload
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe
};
