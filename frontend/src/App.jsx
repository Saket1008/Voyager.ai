import React from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import HomeClient from './app/HomeClient';

export default function App() {
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
