import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

// Strict auth for APIs (returns 401 JSON instead of redirecting)
export function mustBeAuthed(req, res, next) {
  // If no server-side Clerk secret, allow all requests (dev mode)
  if (!process.env.CLERK_SECRET_KEY) {
    return next();
  }
  try {
    const requireAuth = ClerkExpressRequireAuth();
    requireAuth(req, res, next);
  } catch (e) {
    console.error('Auth error', e);
    return res.status(401).json({ error: 'Unauthenticated' });
  }
}

