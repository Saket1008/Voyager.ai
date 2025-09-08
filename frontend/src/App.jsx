import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomeClient from './app/HomeClient.jsx';
import SimpleLoader from './components/Loader.jsx';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebaseClient';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = React.useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = React.useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    if (currentUser) {
      const checkProfile = async () => {
        try {
          if (!db) { if (mounted) { setNeedsOnboarding(true); setCheckingOnboarding(false); } return; }
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          const data = snap.exists() ? snap.data() : null;
          const profileExists = !!(data && data.travelProfile);
          if (mounted) { setNeedsOnboarding(!profileExists); setCheckingOnboarding(false); }
        } catch (e) {
          console.error('Error checking profile', e);
          if (mounted) { setNeedsOnboarding(true); setCheckingOnboarding(false); }
        }
      };
      checkProfile();
    } else {
      setCheckingOnboarding(false);
    }
    return () => { mounted = false; };
  }, [currentUser]);

  if (loading || checkingOnboarding) return <FullPageLoader />;

  return (
    <div className="min-h-screen bg-black">
      <main className="pt-0">
        {!currentUser ? (
          <AuthPage />
        ) : needsOnboarding ? (
          <div className="min-h-screen p-4"><OnboardingPage onDone={() => setNeedsOnboarding(false)} /></div>
        ) : (
          <HomeClient isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
        )}
      </main>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen grid place-items-center">
      <SimpleLoader />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
