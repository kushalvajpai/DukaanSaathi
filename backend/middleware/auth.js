const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET environment variable is not configured securely');
  }
  return secret;
}

/**
 * Middleware to authenticate requests using HTTP-only JWT cookie.
 * Attaches req.user = { userId, businessId, email, ownerName, storeName }
 */
function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies.dukaansaathi_token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || !decoded.userId || !decoded.businessId) {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    req.user = {
      userId: decoded.userId,
      businessId: decoded.businessId,
      email: decoded.email
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

module.exports = {
  authenticate,
  getJwtSecret
};
