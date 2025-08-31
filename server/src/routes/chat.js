import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateSuggestion, generateItinerary, generateChat, STAGES } from '../services/ai.js';

const router = Router();
// router.use(mustBeAuthed); // Temporarily disabled for public chat access

// POST /api/chat
// Body: { mode: 'chat' | 'itinerary' | 'suggest', message?, payload? }
router.post('/', async (req, res) => {
  try {
  const { mode = 'chat', message = '', payload = {}, stage, user, state } = req.body || {};

    let data;
    switch (mode) {
      case 'itinerary':
        data = await generateItinerary(payload || {});
        break;
      case 'suggest':
        data = await generateSuggestion(payload || {});
        break;
      case 'chat':
      default: {
        // stage-based chat
        const stageSafe = stage || STAGES.greeting;
        data = await generateChat({ message, stage: stageSafe, user: user || null, state: state || payload?.context || {} });
        break;
      }
    }
    res.json(data);
  } catch (err) {
    console.error('chat route error', err);
    // Graceful fallback for chat mode so the UI can proceed even if model/env fails
    const fallback = {
      reply: "Hello! I'm your Voyager.AI assistant. Do you already have a specific list of locations in mind, or only a region?",
      stageNext: STAGES.ask_intent,
      input: { type: 'options', options: ['I have specific locations', 'I only know a region'] },
      quickOptions: ['I have specific locations', 'I only know a region'],
    };
    res.status(200).json(fallback);
  }
});

export default router;


