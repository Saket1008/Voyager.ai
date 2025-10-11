import { Router } from 'express';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/community → public profiles (suggested travelers)
router.get('/community', async (_req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    // If Firestore not configured, return a curated sample
    if (!admin) {
      return res.json({ travelers: [
        { id: 'u1', name: 'Ananya', origin: 'Bengaluru', travelStyle: 'Backpacker', interests: ['Mountains', 'Street Food', 'Hostels'] },
        { id: 'u2', name: 'Rohit', origin: 'Delhi', travelStyle: 'Comfort', interests: ['Museums', 'City Walks', 'Photography'] },
        { id: 'u3', name: 'Meera', origin: 'Mumbai', travelStyle: 'Luxury', interests: ['Beach', 'Spa', 'Fine Dining'] },
      ]});
    }

    const db = admin.firestore();
    const snap = await db.collection('users').limit(50).get();
    const travelers = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const profile = data.travelProfile || {};
      const isPublic = (profile.isPublic !== false) && (data.publicProfile !== false); // default to public if not explicitly false
      if (!isPublic) continue;
      const name = data.displayName || data.name || profile.name || 'Traveler';
      const origin = profile.origin || data.origin || profile.city || null;
      const travelStyle = profile.style || profile.travelStyle || null;
      let interests = profile.interests || [];
      if (typeof interests === 'string') interests = interests.split(',').map(s=>s.trim()).filter(Boolean);
      travelers.push({ id: doc.id, name, origin, travelStyle, interests });
    }
    // Shuffle lightly for variety
    travelers.sort(() => Math.random() - 0.5);
    return res.json({ travelers });
  } catch (e) {
    console.error('[community:list] error', e);
    return res.json({ travelers: [] });
  }
});

// GET /api/circles/public → discover public circles
router.get('/circles/public', async (_req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) {
      return res.json({ groups: [
        { id: 'g1', name: 'Himalaya Trekkers', topic: 'Uttarakhand • Kedarkantha', members: 128 },
        { id: 'g2', name: 'Goa Beach Bums', topic: 'Goa • Beaches & Cafes', members: 342 },
        { id: 'g3', name: 'Cultural Capitals', topic: 'Delhi • Jaipur • Agra', members: 89 },
      ]});
    }
    const db = admin.firestore();
    const snap = await db.collection('circles').where('isPublic', '==', true).limit(50).get();
    const groups = snap.docs.map(d => {
      const data = d.data() || {};
      const members = typeof data.membersCount === 'number' ? data.membersCount : (Array.isArray(data.members) ? data.members.length : null);
      return { id: d.id, name: data.name || 'Group', topic: data.topic || null, members };
    });
    return res.json({ groups });
  } catch (e) {
    console.error('[circles:public] error', e);
    return res.json({ groups: [] });
  }
});

// POST /api/community/connect → create a connection request (mock or Firestore)
router.post('/community/connect', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const { toUid, travelerId } = req.body || {};
    const target = String(toUid || travelerId || '').trim();
    if (!target) return res.status(400).json({ ok: false, error: 'Missing target user id' });

    const admin = ensureFirebaseAdmin();
    if (!admin) return res.json({ ok: true, note: 'mock request accepted (no DB)' });

    const db = admin.firestore();
    await db.collection('connections').add({
      fromUid: uid,
      toUid: target,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[community:connect] error', e);
    return res.status(500).json({ ok: false, error: 'Failed to send request' });
  }
});

export default router;
