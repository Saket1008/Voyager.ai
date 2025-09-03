import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateItinerary, generateItineraryMarkdown } from '../services/ai.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

const router = Router();
router.use(authMiddleware);

// POST /api/itinerary  { ...full payload from wizard }
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const format = (req.query.format || payload.format || 'json').toString();
    if (format === 'markdown') {
      let travelProfile = {};
      try {
        const adm = ensureFirebaseAdmin();
        if (adm && payload.user && payload.user.uid) {
          const doc = await adm.firestore().collection('users').doc(payload.user.uid).get();
          if (doc.exists) travelProfile = doc.data().travelProfile || {};
        }
      } catch (e) { /* ignore */ }
      const md = await generateItineraryMarkdown({ user: payload.user || null, state: payload, travelProfile });
      res.type('text/markdown').send(md);
    } else {
      if (!payload.destinations || !Array.isArray(payload.destinations)) {
        return res.status(400).json({ error: 'destinations array required' });
      }
      const data = await generateItinerary(payload);
      res.json(data);
    }
  } catch (err) {
    console.error('itinerary error', err);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

export default router;


