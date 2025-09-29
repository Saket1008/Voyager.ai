// server/src/routes/liveFood.js
import { Router } from 'express';
import { callGemini } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const CHAT_USE_AI = String(process.env.CHAT_USE_AI || 'false').toLowerCase() === 'true';
    const HAS_GEMINI = Boolean(process.env.GEMINI_API_KEY);
    const city = (req.body && typeof req.body.city === 'string' && req.body.city.trim()) || 'Your City';

    const mock = () => ({
      restaurants: [
        { name: `${city} Shree PureVeg`, address: 'MG Road', rating: 4.5 },
        { name: `${city} Sattvik Bites`, address: 'Market Square', rating: 4.3 },
        { name: `${city} Green Leaf`, address: 'Near City Park', rating: 4.4 },
        { name: `${city} Annapurna`, address: 'Old Town', rating: 4.2 },
        { name: `${city} Rasoi Pure Veg`, address: 'Station Road', rating: 4.1 },
      ],
    });

    if (CHAT_USE_AI && HAS_GEMINI) {
      try {
        const prompt = `Return STRICT JSON ONLY with the following shape and nothing else: {"restaurants":[{"name":"...","address":"...","rating":4.5}]}. List 5 popular pure vegetarian restaurants in ${city}, India. Keep addresses short (area or street), ratings as numbers (4.0-5.0), no markdown, no extra keys.`;
        const text = await callGemini({ prompt });
        const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(cleaned); } catch {
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.restaurants)) {
          // Sanitize ratings and coerce fields
          const out = {
            restaurants: parsed.restaurants.slice(0, 5).map((r, i) => ({
              name: String(r.name || `Restaurant ${i+1}`),
              address: String(r.address || 'City Center'),
              rating: Number(r.rating || 4.2),
            })),
          };
          return res.json(out);
        }
      } catch (e) {
        console.warn('[/api/live/food] AI failed; using mock:', e?.message || e);
      }
    }

    return res.json(mock());
  } catch (e) {
    console.error('[/api/live/food] error:', e);
    return res.status(500).json({ error: 'Failed to load food options' });
  }
});

export default router;
