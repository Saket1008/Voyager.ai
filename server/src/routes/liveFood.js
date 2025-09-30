// server/src/routes/liveFood.js
import { Router } from 'express';
import { callGemini } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    const city = (req.body && typeof req.body.city === 'string' && req.body.city.trim()) || 'Your City';
    const prompt = `Return STRICT JSON ONLY with the following shape and nothing else: {"restaurants":[{"name":"...","address":"...","rating":4.5}]}. List 5 popular pure vegetarian restaurants in ${city}, India. Keep addresses short (area or street), ratings as numbers (4.0-5.0), no markdown, no extra keys.`;
    const text = await callGemini({ prompt });
    const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
    let parsed = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.restaurants)) {
      return res.status(502).json({ error: 'Invalid AI response for restaurants' });
    }
    const out = {
      restaurants: parsed.restaurants.slice(0, 5).map((r, i) => ({
        name: String(r.name || `Restaurant ${i+1}`),
        address: String(r.address || 'City Center'),
        rating: Number(r.rating || 4.2),
      })),
    };
    return res.json(out);
  } catch (e) {
    console.error('[/api/live/food] error:', e);
    return res.status(500).json({ error: 'Failed to load food options' });
  }
});

export default router;
