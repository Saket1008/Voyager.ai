// server/src/routes/suggest.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateSuggestion } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  try {
    const { destinations } = req.body;
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: '"destinations" array is required.' });
    }
    
    const suggestion = await generateSuggestion({ destinations });
    res.json(suggestion);

  } catch (err) {
    console.error('[/api/suggest] Error:', err);
    res.status(500).json({ error: 'Failed to generate suggestions.' });
  }
});

export default router;