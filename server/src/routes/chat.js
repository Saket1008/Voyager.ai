import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateChat, STAGES } from '../services/ai.js';

const router = Router();
// Enforce Firebase auth for chat interactions
router.use(mustBeAuthed);

// POST /api/chat
// Body: { message?, stage, user?, state? }
router.post('/', async (req, res) => {
  try {
    const { message = '', stage, user, state } = req.body || {};
    const stageSafe = stage || STAGES.greeting;
    const data = await generateChat({ message, stage: stageSafe, user: user || null, state: state || {} });

  // Always respond with JSON; the frontend renderer decides how to display (markdown, cards, etc.)
  return res.json(data);
  } catch (err) {
    console.error('chat route error', err);
    // Graceful fallback for chat mode so the UI can proceed even if model/env fails
    const fallback = {
      reply: "Hello! I'm your Voyager.AI assistant. Do you already have a specific list of locations in mind, or only a region?",
      stageNext: STAGES.ask_intent,
      input: { type: 'options', options: ['I have specific locations', 'I only know a region'] },
      quickOptions: ['I have specific locations', 'I only know a region'],
    };
    return res.status(200).json(fallback);
  }
});

export default router;


