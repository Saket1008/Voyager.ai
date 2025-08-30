import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateSuggestion, generateItinerary, generateChat } from '../services/ai.js';

const router = Router();
// router.use(mustBeAuthed); // Temporarily disabled for public chat access

// POST /api/chat
// Body: { mode: 'chat' | 'itinerary' | 'suggest', message?, payload? }
router.post('/', async (req, res) => {
  try {
    const { mode = 'chat', message = '', payload = {} } = req.body || {};

    let data;
    switch (mode) {
      case 'itinerary':
        data = await generateItinerary(payload || {});
        break;
      case 'suggest':
        data = await generateSuggestion(payload || {});
        break;
      case 'chat':
      default:
        data = await generateChat({ message, context: payload?.context });
        break;
    }
    res.json(data);
  } catch (err) {
    console.error('chat route error', err);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

export default router;


