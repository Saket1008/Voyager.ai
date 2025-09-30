import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomeClient from './app/HomeClient.jsx';
import BeginJourney from './app/BeginJourney.jsx';
import LiveAdventurePage from './pages/LiveAdventurePage.jsx';
import SimpleLoader from './components/Loader.jsx';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebaseClient';
import { useDevSettings } from './context/DevSettingsContext.jsx';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProfilePage from './pages/ProfilePage.jsx';
import SpaceBackground from './components/SpaceBackground';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = React.useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = React.useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { settings } = useDevSettings();
  const showOnboarding = settings.devMode ? settings.showOnboarding : true;

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

  if (loading || (checkingOnboarding && showOnboarding)) return <FullPageLoader />;

  return (
    <div className="min-h-screen bg-black">
      {/* Global space background and aurora tint */}
      <SpaceBackground isAnimating={false} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(25,195,125,0.15),transparent_60%),radial-gradient(40%_40%_at_80%_20%,rgba(96,165,250,0.12),transparent_60%),radial-gradient(30%_30%_at_20%_10%,rgba(255,255,255,0.08),transparent_60%)]" />
      <main className="relative z-10 pt-0">
        {!currentUser ? (
          <AuthPage />
        ) : (needsOnboarding && showOnboarding) ? (
          <div className="min-h-screen"><OnboardingPage onDone={() => setNeedsOnboarding(false)} /></div>
        ) : (
          <Routes>
            <Route path="/" element={<HomeClient isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />} />
            <Route path="/begin" element={<BeginJourney />} />
            <Route path="/live" element={<LiveAdventurePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="relative z-10 min-h-screen grid place-items-center">
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
