// server/src/routes/liveReroute.js
import { Router } from 'express';
import { callGemini } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    const stage = (req.body && req.body.currentStage) || {};
    const location = String(stage.location || 'your current location');
    const activity = String(stage.activity || 'your plan');
    const time = String(stage.time || 'now');

    const prompt = `Return STRICT JSON ONLY with exactly these keys and nothing else: {"reroute": boolean, "suggestion": string}.
Check if ${location} has traffic jams, crowds, or weather issues right now (${time}). If issues likely, set reroute=true and suggest a concise alternative mentioning a nearby place. Otherwise reroute=false with a short reassurance. Keep it brief.`;
    const text = await callGemini({ prompt });
    const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
    let parsed = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.suggestion !== 'string') {
      return res.status(502).json({ error: 'Invalid AI response for reroute' });
    }
    return res.json({ reroute: Boolean(parsed.reroute), suggestion: parsed.suggestion });
  } catch (e) {
    console.error('[/api/live/reroute] error:', e);
    return res.status(500).json({ error: 'Failed to compute reroute' });
  }
});

export default router;
