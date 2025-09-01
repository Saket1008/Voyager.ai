import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, isFirebaseReady } from '../lib/firebaseClient';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';

const AuthContext = createContext({ currentUser: null, loading: !isFirebaseReady, idToken: null });

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseReady);
  const [idToken, setIdToken] = useState(null);

  useEffect(() => {
    if (!isFirebaseReady || !auth) { setLoading(false); return; }
    const unsubUser = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      setLoading(false);
    });
    const unsubToken = onIdTokenChanged(auth, async (u) => {
      if (!u) { setIdToken(null); return; }
      try { const t = await u.getIdToken(); setIdToken(t); } catch { setIdToken(null); }
    });
    return () => { unsubUser(); unsubToken(); };
  }, []);

  const value = useMemo(() => ({ currentUser, loading, idToken }), [currentUser, loading, idToken]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
