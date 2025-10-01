import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { generateChatTitle } from '../services/ai.js';

const router = Router();

// List recent itineraries for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const snap = await admin
      .firestore()
      .collection('users').doc(uid)
      .collection('itineraries')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const journeys = snap.docs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        title: data.title || 'Trip',
        date: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
        favorite: false,
        markdown: data.markdown || '',
        tripState: data.tripState || {},
        durationDays: data.durationDays || null,
        locations: data.locations || null,
      };
    });
    res.json({ journeys });
  } catch (err) {
    console.error('list journeys error', err);
    res.status(500).json({ error: 'Failed to list journeys' });
  }
});

// Protected: POST /api/journeys
router.post('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const payload = req.body || {};
    const docRef = admin.firestore().collection('users').doc(uid).collection('journeys').doc();
    const toSave = {
      title: payload.title || payload.prompt || 'Journey',
      prompt: payload.prompt || null,
      meta: payload.meta || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.set(toSave);
    res.json({ ok: true, id: docRef.id });
  } catch (err) {
    console.error('save journey error', err);
    res.status(500).json({ error: 'Failed to save journey' });
  }
});

export default router;

// Generate catchy chat title for sidebar
router.post('/title', authMiddleware, async (req, res) => {
  try {
    const { tripState } = req.body || {};
    const out = await generateChatTitle({ tripState: tripState || {} });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to generate title' });
  }
});
