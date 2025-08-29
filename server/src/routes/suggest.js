import express from 'express';
import clerkRequireAuth from '../middleware/auth.js';
import { generateSuggestions } from '../services/ai.js';

const router = express.Router();

router.post('/', clerkRequireAuth, async (req, res) => {
  try {
    const { location } = req.body;
    if (!location) return res.status(400).json({ error: "location required" });
    const suggestions = await generateSuggestions(location);
    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI suggestion failed" });
  }
});

export default router;
