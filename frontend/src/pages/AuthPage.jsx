import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebaseClient';

export default function AuthPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash || '';
      if (h.includes('auth:signup')) setMode('signup');
      else if (h.includes('auth:signin')) setMode('signin');
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) throw new Error('Please enter your name');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
      }
    } catch (err) {
      setError(err?.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center text-white">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
        <div className="mb-3 text-center text-lg font-semibold">{mode === 'signin' ? 'Sign In' : 'Sign Up'}</div>
        <form onSubmit={onSubmit} className="space-y-2">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-white/70">Name</label>
              <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm outline-none" placeholder="Your name" />
            </div>
          )}
          <div>
            <label className="text-xs text-white/70">Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm outline-none" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-xs text-white/70">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm outline-none" placeholder="••••••••" required />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button disabled={loading} className="w-full rounded-md bg-[#19c37d] py-1.5 text-sm font-medium text-black disabled:opacity-60">{loading?'Processing…':(mode==='signin'?'Sign In':'Create Account')}</button>
        </form>
        <div className="mt-3 text-center text-xs text-white/70">
          {mode==='signin'? 'No account yet?':'Already have an account?'}{' '}
          <button onClick={()=>{setMode(mode==='signin'?'signup':'signin'); setError('');}} className="text-white underline">{mode==='signin'?'Sign Up':'Sign In'}</button>
        </div>
      </div>
    </div>
  );
}
