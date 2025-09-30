import { Router } from 'express';
import { getModelCandidates } from '../services/ai.js';

const router = Router();

// Public diagnostics: minimal info, no secrets
router.get('/', async (_req, res) => {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || null;
    const candidates = getModelCandidates();
    res.json({ ok: true, gemini: { hasKey, model, candidates } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'diagnostics failed' });
  }
});

export default router;
