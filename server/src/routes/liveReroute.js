// server/src/routes/liveReroute.js
import { Router } from 'express';
import { callGemini } from '../services/ai.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const CHAT_USE_AI = String(process.env.CHAT_USE_AI || 'false').toLowerCase() === 'true';
    const HAS_GEMINI = Boolean(process.env.GEMINI_API_KEY);
    const stage = (req.body && req.body.currentStage) || {};
    const location = String(stage.location || 'your current location');
    const activity = String(stage.activity || 'your plan');
    const time = String(stage.time || 'now');

    const mock = () => ({ reroute: true, suggestion: `Crowds at ${location}, reroute to a nearby alternative instead.` });

    if (CHAT_USE_AI && HAS_GEMINI) {
      try {
        const prompt = `Return STRICT JSON ONLY with exactly these keys and nothing else: {"reroute": boolean, "suggestion": string}.
Check if ${location} has traffic jams, crowds, or weather issues right now (${time}). If issues likely, set reroute=true and suggest a concise alternative. Otherwise reroute=false with a short reassurance. Keep it brief.`;
        const text = await callGemini({ prompt });
        const cleaned = String(text || '').replace(/```json\n?|```/g, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(cleaned); } catch {
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (parsed && typeof parsed === 'object' && typeof parsed.suggestion === 'string') {
          return res.json({ reroute: Boolean(parsed.reroute), suggestion: parsed.suggestion });
        }
      } catch (e) {
        console.warn('[/api/live/reroute] AI failed; using mock:', e?.message || e);
      }
    }

    return res.json(mock());
  } catch (e) {
    console.error('[/api/live/reroute] error:', e);
    return res.status(500).json({ error: 'Failed to compute reroute' });
  }
});

export default router;
