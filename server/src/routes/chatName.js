// server/src/routes/chatName.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateChatName } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  try {
    const { message, stage, flowState, user } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const chatName = await generateChatName({ 
      message, 
      stage, 
      flowState, 
      user 
    });
    
    res.json({ name: chatName });

  } catch (err) {
    console.error('[/api/chat/name] Error:', err);
    res.status(500).json({ 
      error: 'Failed to generate chat name',
      fallback: 'New Journey'
    });
  }
});

export default router;
