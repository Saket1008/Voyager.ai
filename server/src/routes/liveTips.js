// server/src/routes/liveTips.js
import { Router } from 'express';
import { callGemini } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    const city = (req.body && typeof req.body.city === 'string' && req.body.city.trim()) || 'Your City';
    const prompt = `Return STRICT JSON ONLY with exactly this shape and nothing else: {"tips":["...","...","..."]}. Give 3 short cultural/etiquette/weather tips for travelers currently in ${city}. Keep each under 90 characters. No markdown, no extra keys.`;
    const text = await callGemini({ prompt });
    const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
    let parsed = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tips)) {
      return res.status(502).json({ error: 'Invalid AI response for tips' });
    }
    const tips = parsed.tips.map(String).filter(Boolean).slice(0, 3);
    return res.json({ tips });
  } catch (e) {
    console.error('[/api/live/tips] error:', e);
    return res.status(500).json({ error: 'Failed to load tips' });
  }
});

export default router;
