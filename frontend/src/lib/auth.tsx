import React from 'react';
import {
  ClerkProvider as RealClerkProvider,
  SignedIn as RealSignedIn,
  SignedOut as RealSignedOut,
  SignInButton as RealSignInButton,
  UserButton as RealUserButton,
  useAuth as realUseAuth,
} from '@clerk/clerk-react';

const hasClerk = Boolean(import.meta?.env?.VITE_CLERK_PUBLISHABLE_KEY);

export const ClerkProvider: React.FC<{ publishableKey?: string; children: React.ReactNode }> = ({ publishableKey, children }) => {
  if (hasClerk && publishableKey) {
    return <RealClerkProvider publishableKey={publishableKey}>{children}</RealClerkProvider>;
  }
  return <>{children}</>;
};

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (hasClerk) return <RealSignedIn>{children}</RealSignedIn>;
  return <>{children}</>;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (hasClerk) return <RealSignedOut>{children}</RealSignedOut>;
  return null;
};

export const SignInButton: React.FC<{ children?: React.ReactNode; mode?: 'modal' | 'redirect' }> = ({ children }) => {
  if (hasClerk) return <RealSignInButton>{children}</RealSignInButton>;
  // Dev fallback: render nothing but allow UI to work without sign-in
  return null;
};

export const UserButton: React.FC<{ afterSignOutUrl?: string }> = (props) => {
  if (hasClerk) return <RealUserButton {...props} />;
  return null;
};

export function useAuth(): { isSignedIn: boolean; getToken: () => Promise<string | null> } {
  if (hasClerk) return realUseAuth();
  return {
    isSignedIn: true,
    async getToken() {
      return null;
    },
  };
}

export const authHelpers = { hasClerk };


