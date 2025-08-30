import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateItinerary } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

// POST /api/itinerary  { ...full payload from wizard }
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.destinations || !Array.isArray(payload.destinations)) {
      return res.status(400).json({ error: 'destinations array required' });
    }
    const data = await generateItinerary(payload);
    res.json(data);
  } catch (err) {
    console.error('itinerary error', err);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

export default router;


