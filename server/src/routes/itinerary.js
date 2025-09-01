import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateItinerary, generateItineraryMarkdown } from '../services/ai.js';

const router = Router();
router.use(authMiddleware);

// POST /api/itinerary  { ...full payload from wizard }
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const format = (req.query.format || payload.format || 'json').toString();
    if (format === 'markdown') {
      const md = await generateItineraryMarkdown({ user: payload.user || null, state: payload });
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


