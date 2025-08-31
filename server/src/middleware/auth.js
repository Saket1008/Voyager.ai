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
  const decoded = await adm.auth().verifyIdToken(idToken);
    req.user = decoded; // { uid, email, ... }
    return next();
  } catch (error) {
    console.error('[authMiddleware] Error verifying Firebase ID token:', error?.message || error);
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
}

