// server/src/routes/live.js
import { Router } from 'express';

const router = Router();

// All endpoints are mock/demo and return fast, static-ish data
router.post('/food', async (req, res) => {
  try {
    const city = (req.body && typeof req.body.city === 'string' && req.body.city.trim()) || 'Your City';
    // Simple mock list; could vary by city label
    return res.json({
      city,
      restaurants: [
        { name: `${city} Green Leaf Cafe`, type: 'Vegetarian', distanceMin: 6 },
        { name: `${city} Garden Bowl`, type: 'Vegan', distanceMin: 10 },
        { name: `${city} Spice Harmony`, type: 'Veg-Friendly', distanceMin: 14 },
      ],
    });
  } catch (e) {
    console.error('[/api/live/food] error:', e);
    return res.status(500).json({ error: 'Failed to load food options' });
  }
});

router.post('/reroute', async (req, res) => {
  try {
    const stage = (req.body && req.body.currentStage) || 'current plan';
    // Mock reroute suggestions
    return res.json({
      currentStage: stage,
      suggestions: [
        'Area seems crowded now — swap with the next stop to save 25 minutes.',
        'There’s light rain expected; consider an indoor museum first.',
        'Traffic slowdown nearby; take the metro for this leg.',
      ],
    });
  } catch (e) {
    console.error('[/api/live/reroute] error:', e);
    return res.status(500).json({ error: 'Failed to compute reroute' });
  }
});

router.post('/tips', async (req, res) => {
  try {
    const city = (req.body && typeof req.body.city === 'string' && req.body.city.trim()) || 'Your City';
    return res.json({
      city,
      tips: [
        'Carry small cash for cafes and kiosks',
        'Dress modestly when visiting religious sites',
        'Use the metro or tram for faster cross-town travel',
      ],
    });
  } catch (e) {
    console.error('[/api/live/tips] error:', e);
    return res.status(500).json({ error: 'Failed to load tips' });
  }
});

export default router;
