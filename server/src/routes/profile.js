import { Router } from 'express';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

const router = Router();

// PUT /api/profile — update the authenticated user's travelProfile
router.put('/', async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });

    const user = req.user || {};
    const uid = user.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const travelProfile = body.travelProfile;
    if (typeof travelProfile !== 'object' || travelProfile == null) {
      return res.status(400).json({ error: 'Invalid travelProfile payload' });
    }

    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.set({ travelProfile }, { merge: true });

    return res.json({ ok: true, message: 'Profile updated' });
  } catch (err) {
    console.error('[profile.put] update error', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
