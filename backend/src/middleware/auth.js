const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    // ignoreExpiration: sessions are timeless. Tokens issued before this change
    // (30-day expiry) keep working past their old exp, so existing users are
    // never forced to re-sign-in. A bad signature still throws → 401.
    const payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — allows requests with or without a token.
 * If no token, sets req.userId = 0 (sentinel for "guest", no user matches).
 * Used for read-only endpoints so demo-mode users can browse content.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.userId = 0;
    return next();
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    req.userId = payload.userId;
    next();
  } catch {
    req.userId = 0;
    next();
  }
}

authenticate.optionalAuth = optionalAuth;
module.exports = authenticate;
