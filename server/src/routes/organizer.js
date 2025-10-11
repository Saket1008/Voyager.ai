import { Router } from 'express';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/organizer/trips → list organizer's trips
router.get('/organizer/trips', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user || {};
    const admin = ensureFirebaseAdmin();
    if (!admin) {
      // Fallback list if Firestore is not configured
      return res.json({ trips: [
        { id: 't1', title: 'Goa Long Weekend', startDate: '2025-11-14', endDate: '2025-11-17', destination: 'Goa', membersCount: 12, status: 'upcoming', owner: uid || null },
        { id: 't2', title: 'Himalayan Trek', startDate: '2025-10-20', endDate: '2025-10-26', destination: 'Kedarkantha', membersCount: 18, status: 'ongoing', owner: uid || null },
        { id: 't3', title: 'Golden Triangle', startDate: '2025-09-01', endDate: '2025-09-05', destination: 'Delhi • Jaipur • Agra', membersCount: 25, status: 'completed', owner: uid || null },
      ]});
    }
    const db = admin.firestore();
    const snap = await db
      .collection('organizerTrips')
      .where('owner', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const trips = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ trips });
  } catch (e) {
    console.error('[organizer:trips:list] error', e);
    return res.status(500).json({ error: 'Failed to list trips' });
  }
});

// POST /api/organizer/trips (legacy) and /api/organizer/trip (preferred) → create trip
async function createTripHandler(req, res) {
  try {
    const { uid } = req.user || {};
    const { title, startDate, endDate, destination, status } = req.body || {};
    if (!title || !startDate || !endDate || !destination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const admin = ensureFirebaseAdmin();
    if (!admin) {
      // Mock create if Firestore not available
      const trip = {
        id: `t-${Date.now()}`,
        title,
        startDate,
        endDate,
        destination,
        membersCount: 0,
        status: status || 'upcoming',
        owner: uid || null,
        members: [],
        logistics: {},
      };
      return res.json({ trip });
    }
    const db = admin.firestore();
    const payload = {
      title,
      startDate,
      endDate,
      destination,
      membersCount: 0,
      status: status || 'upcoming',
      owner: uid,
      members: [],
      logistics: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('organizerTrips').add(payload);
    const trip = { id: ref.id, ...payload };
    return res.json({ trip });
  } catch (e) {
    console.error('[organizer:trip:create] error', e);
    return res.status(500).json({ error: 'Failed to create trip' });
  }
}

router.post('/organizer/trips', authMiddleware, createTripHandler);
router.post('/organizer/trip', authMiddleware, createTripHandler);

// GET /api/organizer/trip/:id → fetch trip details (members, logistics)
router.get('/organizer/trip/:id', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user || {};
    const { id } = req.params || {};
    const admin = ensureFirebaseAdmin();
    if (!admin) {
      return res.json({ trip: {
        id,
        title: 'Sample Trip',
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Goa',
        status: 'upcoming',
        owner: uid || null,
        membersCount: 2,
        members: [ { id: 'u1', name: 'Ananya' }, { id: 'u2', name: 'Rohit' } ],
        logistics: { transport: 'Flight', hotel: 'Taj Vivanta' },
      }});
    }
    const db = admin.firestore();
    const docRef = db.collection('organizerTrips').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Trip not found' });
    const data = snap.data() || {};
    if (data.owner && data.owner !== uid) return res.status(403).json({ error: 'Forbidden' });

    // Prefer embedded fields; optionally read subcollections if present
    let members = Array.isArray(data.members) ? data.members : [];
    let logistics = data.logistics || {};

    if (!members.length) {
      try {
        const msnap = await docRef.collection('members').limit(100).get();
        if (!msnap.empty) members = msnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      } catch {}
    }
    if (!Object.keys(logistics).length) {
      try {
        const lsnap = await docRef.collection('logistics').limit(100).get();
        if (!lsnap.empty) logistics = Object.fromEntries(lsnap.docs.map(d => [d.id, d.data()]));
      } catch {}
    }

    const trip = { id: snap.id, ...data, members, logistics };
    return res.json({ trip });
  } catch (e) {
    console.error('[organizer:trip:get] error', e);
    return res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// PUT /api/organizer/trip/:id → update trip info
router.put('/organizer/trip/:id', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user || {};
    const { id } = req.params || {};
    const patch = req.body || {};
    const admin = ensureFirebaseAdmin();
    if (!admin) {
      // Mock updated return
      const trip = { id, ...patch };
      return res.json({ trip });
    }
    const db = admin.firestore();
    const docRef = db.collection('organizerTrips').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Trip not found' });
    const data = snap.data() || {};
    if (data.owner && data.owner !== uid) return res.status(403).json({ error: 'Forbidden' });

    const allowed = ['title', 'startDate', 'endDate', 'destination', 'status', 'members', 'membersCount', 'logistics'];
    const update = {};
    for (const k of allowed) if (k in patch) update[k] = patch[k];
    update.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await docRef.set(update, { merge: true });
    const updatedSnap = await docRef.get();
    const trip = { id: updatedSnap.id, ...(updatedSnap.data() || {}) };
    return res.json({ trip });
  } catch (e) {
    console.error('[organizer:trip:update] error', e);
    return res.status(500).json({ error: 'Failed to update trip' });
  }
});

export default router;
