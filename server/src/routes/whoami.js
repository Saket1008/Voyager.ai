import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    const app = admin ? admin.app() : null;
    const projectId = app && app.options ? app.options.projectId : null;
    // decoded token is at req.user (verifyIdToken result)
    const { uid, email, aud, iss, sub } = req.user || {};
    res.json({ ok: true, uid, email, aud, iss, sub, serverProjectId: projectId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'whoami failed' });
  }
});

export default router;
