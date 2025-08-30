import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateSuggestion } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

// POST /api/suggest  { destinations: ["Germany","France"] }
router.post('/', async (req, res) => {
  try {
    const { destinations } = req.body || {};
    if (!Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: 'destinations array required' });
    }
    const data = await generateSuggestion({ destinations });
    res.json(data);
  } catch (err) {
    console.error('suggest error', err);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

export default router;
