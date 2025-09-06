// server/src/routes/chat.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateChat } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  try {
    const { message = '', stage, state = {} } = req.body;
    
    // The AI service now handles all the complex logic instantly
    const response = await generateChat({ message, stage, state });
    
    res.json(response);

  } catch (err) {
    console.error('[/api/chat] Error:', err);
    res.status(500).json({ 
      reply: "I seem to be having trouble connecting. Please try again in a moment.",
      stageNext: req.body.stage || 'greeting',
      input: { type: 'freeText' }
    });
  }
});

export default router;