import React, { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import HomeClient from './app/HomeClient';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Chatbox from './components/Chatbox';
import { auth, db, isFirebaseReady } from './lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseReady);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isFirebaseReady || !auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u && db) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setNeedsOnboarding(!snap.exists());
      } else {
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="grid min-h-screen place-items-center text-white">Loading Voyager AI…</div>;

  // If Firebase is configured, prefer its auth gating; else show the existing experience
  if (isFirebaseReady) {
    if (!fbUser) return <Auth />;
    if (needsOnboarding) return <div className="min-h-screen p-4"><Onboarding onDone={() => setNeedsOnboarding(false)} /></div>;
    return <div className="min-h-screen"><Chatbox /></div>;
  }

  // Fallback to the existing splash+chat experience if Firebase isn’t configured
  return (
    <div className="min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700">Sign in</button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
      <HomeClient />
    </div>
  );
}
