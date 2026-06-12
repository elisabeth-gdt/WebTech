const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verifies the JWT from the Authorization header.
 * Attaches the decoded user payload to req.user.
 * Does NOT reject unauthenticated requests — use requireAuth for that.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Middleware: rejects request if user is not authenticated.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Middleware factory: rejects request if user does not have one of the required roles.
 * Usage: requireRole('admin') or requireRole('admin', 'moderator')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

/**
 * Injects the authenticated user into the GraphQL context.
 * Used in the Apollo Server context function.
 */
function getGraphQLUser(req) {
  return req.user || null;
}

module.exports = { verifyToken, requireAuth, requireRole, getGraphQLUser, JWT_SECRET };