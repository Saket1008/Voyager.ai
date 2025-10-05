import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ensureFirebaseAdmin } from '../services/firebaseAdmin.js';

const router = Router();

// Danger: destructive operation for the authenticated user only.
router.post('/reset-user', authMiddleware, async (req, res) => {
  try {
    const admin = ensureFirebaseAdmin();
    if (!admin) return res.status(500).json({ ok: false, error: 'Server Firebase not configured' });
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const db = admin.firestore();
    const tasks = [];

    // Helper to batch delete all docs in a collection ref
    const deleteCollection = async (colRef) => {
      const snap = await colRef.get();
      const batch = db.batch();
      snap.forEach((doc) => batch.delete(doc.ref));
      if (!snap.empty) await batch.commit();
      return snap.size;
    };

    // Helper to delete subcollection by name under a document
    const deleteSubcollection = async (docRef, subName) => {
      const col = docRef.collection(subName);
      const snap = await col.get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
      }
      return snap.size;
    };

    // 1) users/{uid}/itineraries
    const userDoc = db.collection('users').doc(uid);
    tasks.push(deleteCollection(userDoc.collection('itineraries')));

    // 2) users/{uid}/journeys (if used)
    tasks.push(deleteCollection(userDoc.collection('journeys')));

    // 3) users/{uid}/chatSessions/* and their exchanges subcollections
    tasks.push((async () => {
      const chatSessions = await userDoc.collection('chatSessions').get();
      for (const sess of chatSessions.docs) {
        // Delete nested exchanges
        const exchangesCol = sess.ref.collection('exchanges');
        const exSnap = await exchangesCol.get();
        for (const ex of exSnap.docs) await ex.ref.delete();
        await sess.ref.delete();
      }
      return chatSessions.size;
    })());

    // 4) dreams/{uid}/trips
    tasks.push((async () => {
      const dreamsRoot = db.collection('dreams').doc(uid);
      const trips = await dreamsRoot.collection('trips').get();
      for (const t of trips.docs) await t.ref.delete();
      return trips.size;
    })());

    // 5) feedback where uid == current user
    tasks.push((async () => {
      const feedbackSnap = await db.collection('feedback').where('uid', '==', uid).get();
      const batch = db.batch();
      feedbackSnap.forEach((d) => batch.delete(d.ref));
      if (!feedbackSnap.empty) await batch.commit();
      return feedbackSnap.size;
    })());

    // Execute all deletes
    const results = await Promise.all(tasks);

    // 6) Remove the user profile doc itself (leaves subcollections already cleared)
    await userDoc.delete().catch(() => {});

    res.json({ ok: true, deleted: {
      itineraries: results[0] || 0,
      journeys: results[1] || 0,
      chatSessions: results[2] || 0,
      dreamsTrips: results[3] || 0,
      feedback: results[4] || 0,
    }});
  } catch (e) {
    console.error('[admin:reset-user] error', e);
    res.status(500).json({ ok: false, error: e?.message || 'Failed to reset user data' });
  }
});

export default router;
