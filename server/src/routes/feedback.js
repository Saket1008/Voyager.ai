// server/src/routes/feedback.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) {
      return res.status(500).json({ ok: false, error: 'Firebase Admin not configured' });
    }
    const { action, messageIndex, chatId, messageSnippet, stage, meta } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: 'Missing action' });
    const uid = req.user?.uid || 'anonymous';

    const payload = {
      uid,
      action,
      messageIndex: typeof messageIndex === 'number' ? messageIndex : null,
      chatId: chatId || null,
      messageSnippet: (messageSnippet || '').slice(0, 300),
      stage: stage || null,
      meta: meta || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().collection('feedback').add(payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/feedback] Error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
