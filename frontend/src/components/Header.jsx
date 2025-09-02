import React from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebaseClient';
import { signOut } from 'firebase/auth';
import { Menu } from 'lucide-react';

export default function Header({ onToggleSidebar }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-20 border-b border-white/8 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-white">
        <div className="flex items-center gap-4">
          <button onClick={() => onToggleSidebar && onToggleSidebar()} aria-label="Open journeys" className="rounded-md p-3 bg-white/5 hover:bg-white/10 mr-2">
            <Menu className="w-6 h-6 text-white" />
          </button>
          <img src="/logo.png" alt="Voyager logo" className="h-12 w-12 rounded-md object-cover shadow-md" />
          <div className="text-2xl font-bold tracking-wide">Voyager AI</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/12 bg-black/30 px-4 py-2 backdrop-blur-md shadow"> 
            <span className="text-xs text-white/80">Welcome,</span>{' '}
            <span className="text-sm font-medium">{currentUser?.displayName || currentUser?.email || 'Guest'}</span>
          </div>
          {currentUser ? (
            <button onClick={() => { if (!auth) { alert('Firebase client not initialized. Cannot sign out.'); return; } try { signOut(auth); } catch (e) { console.error('Sign out failed', e); alert('Sign out failed.'); } }} className="rounded-full border border-white/20 bg-gradient-to-r from-rose-500/70 to-pink-500/70 px-4 py-2 text-sm font-semibold">Logout</button>
          ) : (
            <>
              <button onClick={() => { window.location.hash = '#auth:signin'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full border border-white/12 bg-transparent px-4 py-2 text-sm">Sign In</button>
              <button onClick={() => { window.location.hash = '#auth:signup'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full border border-white/12 bg-yellow-400 px-4 py-2 text-sm font-semibold">Sign Up</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
