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
// Informative logging so developers can see in the browser console whether the
// firebase client detected VITE_FIREBASE_* env vars. Use info/warn so it's
// visible even when "Verbose" console level isn't enabled.
try {
  // eslint-disable-next-line no-console
  if (hasConfig && isFirebaseReady) {
    console.info('[firebaseClient] Firebase config detected and initialized');
  } else if (hasConfig && !isFirebaseReady) {
    console.warn('[firebaseClient] Firebase config present but initialization failed');
    console.info('[firebaseClient] cfgFromEnv =', cfgFromEnv);
  } else {
    console.warn('[firebaseClient] No Firebase config found (VITE_FIREBASE_* missing).');
    console.info('[firebaseClient] cfgFromEnv =', cfgFromEnv);
  }
} catch (e) { /* ignore in non-browser envs */ }
export const auth = isFirebaseReady ? getAuth(app) : (null as any);
export const db = isFirebaseReady ? getFirestore(app) : (null as any);

// Returns a Firebase ID token. If the initial attempt fails, it will try a forced refresh.
export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseReady || !auth) return null;
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(forceRefresh);
  } catch {
    // Retry with force refresh once
    if (!forceRefresh) {
      try { return await u.getIdToken(true); } catch { return null; }
    }
    return null;
  }
}

export function waitForAuth(): Promise<User | null> {
  if (!isFirebaseReady || !auth) return Promise.resolve(null);
  return new Promise(resolve => {
  const off = onAuthStateChanged(auth, (u: User | null) => { off(); resolve(u); });
  });
}
