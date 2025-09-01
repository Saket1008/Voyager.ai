import React from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebaseClient';
import { signOut } from 'firebase/auth';

export default function Header() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-white/10 bg-black/30 backdrop-blur-lg">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 text-white">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 grid place-items-center text-white/95 text-sm">🛸</div>
          <div className="text-lg font-semibold">Voyager AI</div>
        </div>
        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md shadow-lg">
              <span className="text-xs text-white/90">Welcome,</span>{' '}
              <span className="text-sm font-medium">{currentUser.displayName || currentUser.email}</span>
            </div>
            <button
              onClick={() => {
                if (!auth) {
                  // firebase client not ready
                  alert('Firebase client not initialized. Cannot sign out.');
                  return;
                }
                try { signOut(auth); } catch (e) { console.error('Sign out failed', e); alert('Sign out failed. See console.'); }
              }}
              className="rounded-full border border-white/20 bg-gradient-to-r from-rose-500/70 to-pink-500/70 px-3 py-1.5 text-xs font-medium hover:from-rose-500 hover:to-pink-500 shadow-lg"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { window.location.hash = '#auth:signin'; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-medium hover:bg-black/60 backdrop-blur-md shadow-lg"
            >
              Sign In
            </button>
            <button
              onClick={() => { window.location.hash = '#auth:signup'; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="rounded-full border border-white/20 bg-gradient-to-r from-emerald-500/70 to-teal-500/70 px-3 py-1.5 text-xs font-medium hover:from-emerald-500 hover:to-teal-500 shadow-lg"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
