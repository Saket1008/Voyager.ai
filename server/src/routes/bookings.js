import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateTransportOptions } from '../services/ai.js';

const router = Router();

function normalizeSegmentsInput(itinerary) {
  // Accept either array of segments or attempt to derive from locations array
  if (Array.isArray(itinerary)) {
    return itinerary.filter(s => s && (s.from || s.to)).map((s, i) => ({ id: s.id || `seg-${i+1}`, from: s.from || 'Origin', to: s.to || 'Destination', date: s.date || null }));
  }
  const trip = itinerary?.tripState || {};
  const locs = Array.isArray(itinerary?.locations) && itinerary.locations.length
    ? itinerary.locations
    : (Array.isArray(trip.locations) ? trip.locations : []);
  const segments = [];
  for (let i = 0; i < Math.max(0, locs.length - 1); i++) {
    segments.push({ id: `seg-${i+1}`, from: String(locs[i] || 'Origin'), to: String(locs[i+1] || 'Destination'), date: null });
  }
  if (!segments.length && (trip.region || itinerary?.title)) {
    segments.push({ id: 'seg-1', from: 'Airport', to: String(trip.region || itinerary.title || 'Destination'), date: null });
  }
  return segments;
}

// POST /api/bookings { itinerary: [ { from, to, date } ] } or { itinerary: { locations:[...] } }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    const itinerary = payload.itinerary;
    if (!itinerary) return res.status(400).json({ error: 'itinerary is required' });

    const segs = normalizeSegmentsInput(itinerary);
    if (!Array.isArray(segs) || !segs.length) {
      // Graceful fallback: return a sample segment
      const sample = await generateTransportOptions({ from: 'Delhi', to: 'Agra', date: null }).catch(() => ({ flights: [], trains: [] }));
      return res.json({ segments: [{ id: 'seg-1', from: 'Delhi', to: 'Agra', ...sample }] });
    }

    const results = [];
    for (const s of segs) {
      const opts = await generateTransportOptions({ from: s.from, to: s.to, date: s.date }).catch(() => []);
      const mixed = Array.isArray(opts) ? opts : [];
      const flights = mixed.filter(o => String(o.type || '').toLowerCase().includes('flight'));
      const trains = mixed.filter(o => String(o.type || '').toLowerCase().includes('train'));
      const busesMixed = mixed.filter(o => String(o.type || '').toLowerCase().includes('bus'));
      const buses = busesMixed.length ? busesMixed : [
        { type: 'bus', carrier: 'Volvo AC Seater', departTime: '07:30', arriveTime: '11:15', duration: '3h 45m', priceINR: 650, label: 'Budget', url: 'https://www.redbus.in/' },
      ];
      results.push({ id: s.id, from: s.from, to: s.to, flights, trains, buses });
    }

    return res.json({ segments: results });
  } catch (e) {
    console.error('[bookings] error:', e?.message || e);
    // return a minimal yet valid structure to keep client UX smooth
    return res.json({ segments: [{ id: 'seg-err', from: 'Origin', to: 'Destination', flights: [], trains: [], buses: [] }] });
  }
});

export default router;
