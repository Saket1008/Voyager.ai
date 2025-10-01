import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';
import { estimateDreamBudget } from '../services/ai.js';

const router = Router();

// Helper: get collection ref for user's dreams
function tripsCol(admin, uid) {
  return admin.firestore().collection('dreams').doc(uid).collection('trips');
}

// GET /api/dreams → list all dream trips for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const ownSnap = await tripsCol(admin, uid).orderBy('createdAt', 'desc').get();
    const ownTrips = ownSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const collTrips = [];
    try {
      const dreamsOwners = await admin.firestore().collection('dreams').get();
      for (const ownerDoc of dreamsOwners.docs) {
        const ownerUid = ownerDoc.id;
        if (ownerUid === uid) continue;
        const sub = await tripsCol(admin, ownerUid).where('members', 'array-contains', uid).get();
        sub.forEach((doc) => { collTrips.push({ id: doc.id, ...doc.data() }); });
      }
    } catch (e) { /* ignore during dev scale */ }
    const trips = [...ownTrips, ...collTrips];
    return res.json({ trips });
  } catch (e) {
    console.error('[dreams:list] error', e);
    return res.status(500).json({ error: 'Failed to list dreams' });
  }
});

// POST /api/dreams → create a new dream trip
router.post('/', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const {
      destination,
      days,
      travelers,
      budget,
      budgetTotal,
      targetDate,
      saved = 0,
      collaborative = false,
      members,
      shareId
    } = req.body || {};

    if (!destination) return res.status(400).json({ error: 'destination is required' });

    // Prefer explicit budget if provided; otherwise accept budgetTotal; else estimate via AI
    let finalBudget = Number(budget);
    if (!finalBudget || !isFinite(finalBudget) || finalBudget <= 0) {
      const bt = Number(budgetTotal);
      if (isFinite(bt) && bt > 0) {
        finalBudget = bt;
      } else {
        try {
          finalBudget = await estimateDreamBudget({
            destination: String(destination).trim(),
            days: Number(days) || 1,
            travelers: Number(travelers) || 1,
          });
        } catch (e) {
          console.warn('[dreams:create] Budget estimate failed, using fallback:', e?.message);
          finalBudget = 25000;
        }
      }
    }

    const toSave = {
      destination: String(destination).trim(),
      days: Number(days) || null,
      travelers: Number(travelers) || 1,
      budgetTotal: Number(finalBudget) || 0,
      savedAmount: Math.max(0, Number(saved) || 0),
      targetDate: targetDate || null,
      collaborative: !!collaborative,
      members: Array.isArray(members) && members.length ? members.map(String) : [uid],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      currency: req.body?.currency || 'INR',
      shareId: shareId ? String(shareId).toUpperCase() : null,
      ownerUid: uid,
    };
    const ref = await tripsCol(admin, uid).add(toSave);
    // Fetch the created doc to return full data
    const snap = await ref.get();
    const dream = { id: ref.id, ...(snap.data() || toSave) };
    return res.json({ success: true, dream });
  } catch (e) {
    console.error('[dreams:create] error', e);
    return res.status(500).json({ error: 'Failed to create dream trip' });
  }
});

// PUT /api/dreams/:id → update dream trip
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const ownerUid = req.query.owner || uid; // allow updating an owner's trip when collaborative
    const ref = tripsCol(admin, ownerUid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data() || {};

    // If collaborative, allow member updates; otherwise, only owner
    const members = Array.isArray(data.members) ? data.members : [data.ownerUid || ownerUid];
    const isOwner = (data.ownerUid || ownerUid) === uid;
    if (!isOwner && !members.includes(uid)) return res.status(403).json({ error: 'Forbidden' });

    const patch = {};
    if (isOwner) {
      if (req.body.destination !== undefined) patch.destination = String(req.body.destination).trim();
      if (req.body.budget !== undefined) patch.budgetTotal = Number(req.body.budget) || 0;
      if (req.body.targetDate !== undefined) patch.targetDate = req.body.targetDate || null;
      if (req.body.collaborative !== undefined) patch.collaborative = !!req.body.collaborative;
      if (req.body.members !== undefined && Array.isArray(req.body.members)) patch.members = req.body.members.map(String);
      if (req.body.currency !== undefined) patch.currency = String(req.body.currency);
      if (req.body.saved !== undefined) patch.savedAmount = Math.max(0, Number(req.body.saved) || 0);
    } else {
      // Non-owners (collab members) can only update saved amount
      if (req.body.saved === undefined) return res.status(403).json({ error: 'Only owners can modify trip details' });
      patch.savedAmount = Math.max(0, Number(req.body.saved) || 0);
    }

    await ref.set(patch, { merge: true });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[dreams:update] error', e);
    return res.status(500).json({ error: 'Failed to update dream trip' });
  }
});

// DELETE /api/dreams/:id → remove dream trip (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const ownerUid = req.query.owner || uid;
    const ref = tripsCol(admin, ownerUid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data() || {};
    const isOwner = (data.ownerUid || ownerUid) === uid;
    if (!isOwner) return res.status(403).json({ error: 'Only owners can delete dream trips' });
    await ref.delete();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[dreams:delete] error', e);
    return res.status(500).json({ error: 'Failed to delete dream trip' });
  }
});

export default router;

// Join by shareId
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'Server Firebase not configured' });
    const { uid } = req.user || {};
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const code = (req.body?.shareId || '').toString().toUpperCase();
    if (!code) return res.status(400).json({ error: 'shareId required' });
    const owners = await admin.firestore().collection('dreams').get();
    for (const ownerDoc of owners.docs) {
      const ownerUid = ownerDoc.id;
      const match = await tripsCol(admin, ownerUid).where('shareId', '==', code).limit(1).get();
      if (!match.empty) {
        const docRef = match.docs[0].ref;
        const data = match.docs[0].data() || {};
        const members = Array.isArray(data.members) ? data.members : [];
        if (!members.includes(uid)) {
          await docRef.update({ members: [...members, uid], collaborative: true });
        }
        return res.json({ ok: true, ownerUid, id: match.docs[0].id });
      }
    }
    return res.status(404).json({ error: 'Trip not found for shareId' });
  } catch (e) {
    console.error('[dreams:join] error', e);
    return res.status(500).json({ error: 'Failed to join trip' });
  }
});

// POST /api/dreams/estimate → return numeric INR amount from AI
router.post('/estimate', authMiddleware, async (req, res) => {
  try {
    const { destination, days, travelers } = req.body || {};
    if (!destination) return res.status(400).json({ error: 'destination is required' });
    const amount = await estimateDreamBudget({ destination, days, travelers });
    return res.json({ success: true, amount });
  } catch (e) {
    console.error('[dreams:estimate] error', e?.message || e);
    // Always return success with a fallback amount to keep UX smooth
    return res.json({ success: true, amount: 25000, note: 'fallback' });
  }
});
