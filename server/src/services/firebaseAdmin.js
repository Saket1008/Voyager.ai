import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK once
let initialized = false;
export function ensureFirebaseAdmin() {
  if (initialized) return admin;
  try {
    // Preferred: JSON from env FIREBASE_SERVICE_ACCOUNT (stringified JSON)
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saJson) {
      const credentials = JSON.parse(saJson);
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
      initialized = true;
      return admin;
    }
  } catch (e) {
    console.warn('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', e?.message);
  }
  // Fallback: serviceAccountKey.json next to server folder or path provided in FIREBASE_SERVICE_ACCOUNT_PATH
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const guessPath = resolve(__dirname, '../../serviceAccountKey.json');
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || guessPath;
  if (fs.existsSync(filePath)) {
    const credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(credentials) });
    initialized = true;
    return admin;
  }
  // Last fallback: initialize with Application Default Credentials (works on Cloud Functions/App Engine)
  try {
    admin.initializeApp();
    initialized = true;
    console.log('[FirebaseAdmin] Initialized with Application Default Credentials');
    return admin;
  } catch (e) {
    console.warn('[FirebaseAdmin] Service account not configured and ADC init failed. Set FIREBASE_SERVICE_ACCOUNT or provide serviceAccountKey.json');
    return null;
  }
}

export default admin;
// PASTE THIS CODE AT THE END OF firebaseAdmin.js

export async function getTravelProfile(uid) {
  if (!uid) return null;
  const admin = ensureFirebaseAdmin();
  if (!admin) return null;

  try {
    const userDocRef = admin.firestore().collection('users').doc(uid);
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
      return docSnap.data().travelProfile || {};
    }
    return {};
  } catch (error) {
    console.error(`Failed to fetch travel profile for UID: ${uid}`, error);
    return null;
  }
}

// Firestore helpers for persistence
export function getFirestore() {
  const adm = ensureFirebaseAdmin();
  return adm ? adm.firestore() : null;
}

export async function logChatExchange(uid, data) {
  try {
    if (!uid) return false;
    const db = getFirestore();
    if (!db) return false;
    const sessionId = data?.sessionId || new Date().toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
    const exchanges = db
      .collection('users').doc(uid)
      .collection('chatSessions').doc(sessionId)
      .collection('exchanges');
    const payload = {
      userMessage: String(data?.userMessage || ''),
      assistantMessage: String(data?.assistantMessage || ''),
      tripState: data?.tripState || {},
      nextQuestionType: data?.nextQuestionType || null,
      nextQuestionPrompt: data?.nextQuestionPrompt || null,
      meta: data?.meta || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await exchanges.add(payload);
    return true;
  } catch (e) {
    console.warn('[Firestore] logChatExchange failed:', e?.message || e);
    return false;
  }
}

export async function saveItinerary(uid, itineraryData) {
  try {
    if (!uid) return false;
    const db = getFirestore();
    if (!db) return false;
    const col = db.collection('users').doc(uid).collection('itineraries');
    const doc = {
      tripState: itineraryData?.tripState || {},
      travelProfile: itineraryData?.travelProfile || {},
      markdown: String(itineraryData?.markdown || ''),
      title: itineraryData?.title || null,
      durationDays: itineraryData?.durationDays || null,
      locations: itineraryData?.locations || null,
      source: itineraryData?.source || 'api',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await col.add(doc);
    return true;
  } catch (e) {
    console.warn('[Firestore] saveItinerary failed:', e?.message || e);
    return false;
  }
}



















































