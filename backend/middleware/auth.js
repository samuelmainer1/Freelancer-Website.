import jwt from 'jsonwebtoken';

const DEV_SECRET = 'dev-secret-change-me';

// In production a real secret is mandatory — silently falling back would let
// anyone who knows the default forge tokens for any account.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

export const SECRET = process.env.JWT_SECRET || DEV_SECRET;
export const USING_DEV_SECRET = SECRET === DEV_SECRET;

// Verifies the JWT from the Authorization: Bearer <token> header
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  try {
    req.user = jwt.verify(token, SECRET); // { id, name, role }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// Restricts a route to a specific user role ('client' | 'freelancer')
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Only ${role}s can perform this action.` });
    }
    next();
  };
}
