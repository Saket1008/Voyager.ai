// Optional Firebase client. Initializes only if config is present.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfgFromEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasConfig = Object.values(cfgFromEnv).some(Boolean);
let app = null as any;
if (hasConfig) {
  app = getApps()[0] || initializeApp(cfgFromEnv as any);
}

export const isFirebaseReady = !!app;
export const auth = isFirebaseReady ? getAuth(app) : (null as any);
export const db = isFirebaseReady ? getFirestore(app) : (null as any);

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!isFirebaseReady || !auth) return null;
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

export function waitForAuth(): Promise<User | null> {
  if (!isFirebaseReady || !auth) return Promise.resolve(null);
  return new Promise(resolve => {
  const off = onAuthStateChanged(auth, (u: User | null) => { off(); resolve(u); });
  });
}
