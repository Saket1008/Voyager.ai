'use client'

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs'

const Header = () => {
  const { user } = useUser()
  return (
    <div className="fixed top-0 right-0 z-50 p-4">
      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton>
            <button className="px-4 py-2 rounded-full bg-transparent border border-white/20 text-white/90 hover:bg-white/10 transition">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="px-4 py-2 rounded-full bg-transparent border border-white/20 text-white/90 hover:bg-white/10 transition">
              Sign Up
            </button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <span className="hidden sm:block px-3 py-1.5 rounded-full bg-black/30 text-white/90 backdrop-blur-md">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}
          </span>
          <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'ring-1 ring-white/30' } }} />
        </SignedIn>
      </div>
    </div>
  )
}

export default Header


