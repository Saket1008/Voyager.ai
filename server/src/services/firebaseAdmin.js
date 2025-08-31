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
  console.warn('[FirebaseAdmin] Service account not configured. Set FIREBASE_SERVICE_ACCOUNT or provide serviceAccountKey.json');
  return null;
}

export default admin;
