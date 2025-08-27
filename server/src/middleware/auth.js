import { requireAuth } from '@clerk/clerk-sdk-node';

// Clerk's requireAuth middleware verifies the JWT from Authorization header or cookies
// and attaches auth info to req.auth when valid. If invalid, it returns 401.
// We wrap it to also mirror the user shape to req.user for convenience.

export const clerkRequireAuth = async (req, res, next) => {
  try {
    // Execute Clerk's middleware
    await new Promise((resolve, reject) => {
      requireAuth()(req, res, (err) => (err ? reject(err) : resolve()));
    });

    // Attach a friendlier user object if available
    if (req.auth) {
      req.user = {
        userId: req.auth.userId,
        sessionId: req.auth.sessionId,
        orgId: req.auth.orgId,
        claims: req.auth.claims,
      };
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

export default clerkRequireAuth;

