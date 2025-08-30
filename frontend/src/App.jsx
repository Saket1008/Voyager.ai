import React from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from './lib/auth';
import ChatWizard from './components/ChatWizard.jsx';
import HomeClient from './app/HomeClient';

export default function App() {
  const audienceMode = (import.meta?.env?.VITE_AUDIENCE_VIEW === '1') ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('audience'));

  if (audienceMode) {
    return <HomeClient />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 sticky top-0 backdrop-blur bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">🌌 Voyager AI</div>
          <div>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700">Sign in</button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <ChatWizard />
      </main>
    </div>
  );
}
