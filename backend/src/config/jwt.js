const jwt = require('jsonwebtoken');

const KNOWN_INSECURE_SECRETS = [
  'super_secret_jwt_key_shop_billing_2026',
  'your_jwt_secret',
  'secret',
  'change_me',
  'jwt_secret',
  'password',
  '123456',
  'supersecretkey',
  'shop_billing_secret_jwt_key_2026'
];

/**
 * Validates JWT configuration against production security rules.
 * In production:
 * - Refuses startup if JWT_SECRET is missing.
 * - Refuses startup if JWT_SECRET is shorter than 32 characters.
 * - Refuses startup if JWT_SECRET matches a known insecure/demo placeholder.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.trim() === '') {
      throw new Error(
        '[Security Error] Production deployment blocked: JWT_SECRET environment variable is missing. ' +
        'Please configure a cryptographically random secret in your production environment.'
      );
    }

    if (KNOWN_INSECURE_SECRETS.includes(secret.trim().toLowerCase())) {
      throw new Error(
        '[Security Error] Production deployment blocked: JWT_SECRET matches a known insecure demo placeholder. ' +
        'Please generate a secure random secret (e.g. `node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"`).'
      );
    }

    if (secret.length < 32) {
      throw new Error(
        `[Security Error] Production deployment blocked: JWT_SECRET is too short (${secret.length} chars). ` +
        'Production JWT_SECRET must be at least 32 characters long.'
      );
    }
  }

  return secret || 'super_secret_jwt_key_shop_billing_2026';
}

function signToken(payload, options = {}) {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn, ...options });
}

function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

module.exports = {
  getJwtSecret,
  signToken,
  verifyToken,
  KNOWN_INSECURE_SECRETS
};
