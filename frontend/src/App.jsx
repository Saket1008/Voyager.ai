import React, { useEffect, useState } from 'react';
import HomeClient from './app/HomeClient';
import Onboarding from './components/Onboarding';
import OnboardingPage from './pages/OnboardingPage';
import Chatbox from './components/Chatbox';
import EditProfile from './components/EditProfile';
import Header from './components/Header';
import AuthPage from './pages/AuthPage';
import { auth, db, isFirebaseReady } from './lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseReady);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    if (!isFirebaseReady || !auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u && db) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const data = snap.exists() ? snap.data() : null;
        const hasProfile = !!(data && data.travelProfile);
        setNeedsOnboarding(!hasProfile);
      } else {
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  let content = null;
  if (loading) {
    content = <div className="grid min-h-screen place-items-center text-white">Loading Voyager AI…</div>;
  } else if (isFirebaseReady) {
    if (!fbUser) {
      content = <AuthPage />;
    } else if (needsOnboarding) {
      content = <div className="min-h-screen p-4"><OnboardingPage onDone={() => setNeedsOnboarding(false)} /></div>;
    } else {
      content = (
        <div className="min-h-screen">
          <Chatbox user={fbUser} onEditProfile={() => setIsEditingProfile(true)} />
          {isEditingProfile && <EditProfile onClose={() => setIsEditingProfile(false)} />}
        </div>
      );
    }
  } else {
    // Fallback to the existing splash+chat experience if Firebase isn’t configured
    content = (
      <div className="min-h-screen">
        <HomeClient />
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Header />
        {content}
      </div>
    </AuthProvider>
  );
}
