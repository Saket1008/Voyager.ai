import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { generateMemoryWeaver } from '../services/ai.js';

const router = Router();

/**
 * POST /api/memory
 * Body: { journeyId: string }
 * Loads the user's journey/itinerary doc from Firestore and returns an AI-crafted journal markdown.
 * If AI fails or is unavailable, returns a readable fallback markdown.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid, name } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const journeyId = String(req.body?.journeyId || '').trim();
    if (!journeyId) return res.status(400).json({ error: 'journeyId is required' });

    // Read from users/{uid}/itineraries/{journeyId}
    const ref = admin.firestore().collection('users').doc(uid).collection('itineraries').doc(journeyId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Journey not found' });
    const data = snap.data() || {};

    // Normalize journey object for AI helper
    const journey = {
      id: journeyId,
      title: data.title || 'Journey',
      markdown: data.markdown || '',
      tripState: data.tripState || {},
      durationDays: data.durationDays || (data.tripState ? data.tripState.durationDays : null) || null,
      locations: Array.isArray(data.locations) ? data.locations : (data.tripState?.locations || []),
      region: data.tripState?.region || null,
      date: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
    };

    const user = { displayName: name || req.user?.displayName || null };
    const markdown = await generateMemoryWeaver({ journey, user });
    return res.json({ markdown });
  } catch (e) {
    console.error('[memory] error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to generate travel journal' });
  }
});

export default router;
