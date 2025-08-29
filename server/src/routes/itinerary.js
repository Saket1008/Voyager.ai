import express from 'express';
import clerkRequireAuth from '../middleware/auth.js';
import { generateItinerary } from '../services/ai.js';

const router = express.Router();

// POST /api/itinerary
router.post('/', clerkRequireAuth, async (req, res) => {
  try {
    const data = req.body;
    const itinerary = await generateItinerary(data);
    return res.status(200).json(itinerary);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Itinerary generation error:', error);
    return res.status(500).json({ error: 'Itinerary generation failed' });
  }
});

export default router;


