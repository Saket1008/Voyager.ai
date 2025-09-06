// server/src/routes/itinerary.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { generateItineraryMarkdown } from '../services/ai.js';
import { getTravelProfile } from '../services/firebaseAdmin.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  const user = req.user;
  console.log('\n--- [ITINERARY REQUEST START] ---');

  if (!user || !user.uid) {
    console.error('[ITINERARY_ERROR] User not found on request object. Middleware might have failed.');
    return res.status(401).send('## Authentication Error\n\nYour session is invalid. Please log in again.');
  }
  console.log(`[ITINERARY_LOG] Authenticated User: UID=${user.uid}, Name=${user.name || user.displayName || user.email}`);

  try {
    const { tripState } = req.body;
    if (!tripState) {
      console.error('[ITINERARY_ERROR] Missing tripState in request body.');
      return res.status(400).send('## Bad Request\n\n`tripState` object is required.');
    }
    console.log('[ITINERARY_LOG] Received tripState:', JSON.stringify(tripState, null, 2));

    let travelProfile = null;
    try {
      travelProfile = await getTravelProfile(user.uid);
    } catch (e) {
      console.warn('[ITINERARY_LOG] Failed to fetch travel profile:', e?.message);
    }
    console.log('[ITINERARY_LOG] Calling generateItineraryMarkdown...');
    const markdown = await generateItineraryMarkdown({ user, travelProfile, tripState });

    console.log('[ITINERARY_LOG] Successfully generated itinerary markdown.');
    res.type('text/markdown').send(markdown);

  } catch (err) {
    console.error('--- [ITINERARY_CRITICAL_ERROR] ---');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('--- [END ITINERARY ERROR] ---\n');

    if (err.message.includes('API key not configured')) {
      res.status(500).send('## Itinerary Generation Failed\n\n**Reason:** The Gemini API key is missing or invalid on the server. Please check your `server/.env` configuration.');
    } else if (err.message.includes('Gemini API Error')) {
      res.status(500).send(`## Itinerary Generation Failed\n\n**Reason:** There was an issue connecting to the AI service.\n\n*Details: ${err.message}*`);
    } else {
      res.status(500).send('## Itinerary Unavailable\n\nA critical error occurred on the server. Please check the server logs for more details.');
    }
  }
});

export default router;