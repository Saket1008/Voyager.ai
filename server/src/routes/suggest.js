// server/src/routes/suggest.js

import { Router } from 'express';
import { mustBeAuthed } from '../middleware/auth.js';
import { callGemini } from '../services/ai.js';

const router = Router();
router.use(mustBeAuthed);

router.post('/', async (req, res) => {
  try {
    const CHAT_USE_AI = String(process.env.CHAT_USE_AI || 'false').toLowerCase() === 'true';
    const HAS_GEMINI = Boolean(process.env.GEMINI_API_KEY);

    const body = req.body || {};
    const rawLocation = typeof body.location === 'string' ? body.location.trim() : '';
    if (!rawLocation) {
      return res.status(400).json({ error: 'Location required' });
    }
    const city = rawLocation;

    // Fallback-friendly city label
    const safeCity = city || 'Your City';

    // Build deterministic fallback samples
    const buildFallback = (label) => ({
      attractions: [
        `${label} Old Town Walk`,
        `${label} Central Market`,
        `${label} City Lookout`,
      ],
      food: [
        `${label} Street Eats`,
        `${label} Coffee & Bakery`,
        `${label} Local Diner`,
      ],
      tips: [
        'Carry small cash for cafes',
        'Use public transit for fastest travel',
        'Check opening hours; prebook popular spots',
      ],
    });

    // If AI is allowed and configured, try to get curated lists
    if (CHAT_USE_AI && HAS_GEMINI) {
      try {
        const prompt = `You are a concise travel expert. Return STRICT JSON ONLY with exactly these three keys and nothing else: {"attractions": string[], "food": string[], "tips": string[]}. 
Requirements:
- Focus on or near the city: ${safeCity}.
- Provide 3-6 items per category, short phrases (no descriptions), culturally accurate and recognizable.
- No markdown, no comments, no extra keys.
Begin JSON now.`;
        const text = await callGemini({ prompt });
        const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(cleaned); } catch {
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (m) {
            try { parsed = JSON.parse(m[0]); } catch {}
          }
        }
        if (parsed && typeof parsed === 'object') {
          const out = {
            attractions: Array.isArray(parsed.attractions) ? parsed.attractions.filter(Boolean).slice(0, 6) : [],
            food: Array.isArray(parsed.food) ? parsed.food.filter(Boolean).slice(0, 6) : [],
            tips: Array.isArray(parsed.tips) ? parsed.tips.filter(Boolean).slice(0, 6) : [],
          };
          // Ensure minimum items with fallback top-ups
          const fb = buildFallback(safeCity);
          if (out.attractions.length < 2) out.attractions = (out.attractions.concat(fb.attractions)).slice(0, 6);
          if (out.food.length < 2) out.food = (out.food.concat(fb.food)).slice(0, 6);
          if (out.tips.length < 2) out.tips = (out.tips.concat(fb.tips)).slice(0, 6);
          return res.json(out);
        }
      } catch (aiErr) {
        console.warn('[/api/suggest] AI path failed, using fallback:', aiErr?.message || aiErr);
      }
    }

    // Non-AI or AI failure: return deterministic fallback based on city label
    return res.json(buildFallback(safeCity));

  } catch (err) {
    console.error('[/api/suggest] Error:', err);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;