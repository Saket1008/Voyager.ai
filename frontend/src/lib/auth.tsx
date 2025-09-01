// Clerk has been removed. Provide no-op fallbacks to avoid import churn until cleanup is complete.
import React from 'react';

export const ClerkProvider: React.FC<{ publishableKey?: string; children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const SignedOut: React.FC<{ children: React.ReactNode }> = () => null;
export const SignInButton: React.FC<{ children?: React.ReactNode; mode?: 'modal' | 'redirect' }> = () => null;
export const UserButton: React.FC<{ afterSignOutUrl?: string }> = () => null;
export function useAuth(): { isSignedIn: boolean; getToken: () => Promise<string | null> } {
  return { isSignedIn: false, async getToken() { return null; } };
}
export const authHelpers = { hasClerk: false };


