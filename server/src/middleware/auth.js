import admin from '../services/firebaseAdmin.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

// Firebase-first middleware: verifies a Firebase ID token and attaches decoded user to req.user
export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
  const adm = ensureFirebaseAdmin() || admin;
  if (!adm) {
      console.error('[authMiddleware] Firebase Admin SDK not initialized.');
      return res.status(500).json({ error: 'Internal Server Error: Auth service not configured.' });
    }
  // Optional: in local development, allow a very explicit bypass for troubleshooting
  if (process.env.AUTH_BYPASS_DEV === 'true' && (req.hostname === 'localhost' || req.hostname === '127.0.0.1')) {
      console.warn('[authMiddleware] AUTH_BYPASS_DEV enabled — treating request as uid="dev".');
      req.user = { uid: 'dev', email: 'dev@local' };
      return next();
  }
  const decoded = await adm.auth().verifyIdToken(idToken);
    req.user = decoded; // { uid, email, ... }
    return next();
  } catch (error) {
    // Include basic token diagnostics without logging the token itself
    const hdr = (req.headers.authorization || '').split(' ')[0];
    console.error('[authMiddleware] Verify error:', error?.message || error, 'hdrPrefix=', hdr);
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
}

// Back-compat alias for older route imports
export const mustBeAuthed = authMiddleware;

