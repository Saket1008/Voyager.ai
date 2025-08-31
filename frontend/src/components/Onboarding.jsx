import React, { useState } from 'react';
import { isFirebaseReady, auth, db } from '../lib/firebaseClient';
import { doc, setDoc } from 'firebase/firestore';

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    pace: '', budget: '', interests: [], dietaryRestrictions: [], favoriteCuisines: [], mustAvoid: []
  });

  function next() { setStep(s => Math.min(4, s + 1)); }
  function back() { setStep(s => Math.max(1, s - 1)); }

  async function save() {
    if (!isFirebaseReady || !auth?.currentUser || !db) { onDone?.(); return; }
    setSaving(true);
    try {
      const uid = auth.currentUser.uid;
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        name: auth.currentUser.displayName || '',
        email: auth.currentUser.email || '',
        createdAt: new Date().toISOString(),
        travelProfile: { pace: profile.pace, budget: profile.budget, interests: profile.interests },
        foodProfile: { dietaryRestrictions: profile.dietaryRestrictions, favoriteCuisines: profile.favoriteCuisines, mustAvoid: profile.mustAvoid }
      }, { merge: true });
    } finally { setSaving(false); onDone?.(); }
  }

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-white">
      <div className="mb-2 text-sm">Create your Traveler's DNA</div>
      {step === 1 && (
        <div className="space-y-2">
          <div className="text-xs">Preferred pace</div>
          <div className="flex gap-2">
            {['Relaxed','Balanced','Action-Packed'].map(p => (
              <button key={p} onClick={() => setProfile(v=>({...v, pace:p}))} className={`px-3 py-1 rounded-md border ${profile.pace===p?'bg-white text-black border-white':'bg-white/10 border-white/20'}`}>{p}</button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-2">
          <div className="text-xs">Budget</div>
          <div className="flex gap-2">
            {['Budget-Friendly','Mid-Range','Luxury'].map(b => (
              <button key={b} onClick={() => setProfile(v=>({...v, budget:b}))} className={`px-3 py-1 rounded-md border ${profile.budget===b?'bg-white text-black border-white':'bg-white/10 border-white/20'}`}>{b}</button>
            ))}
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-2">
          <div className="text-xs">Top interests</div>
          <div className="flex gap-2 flex-wrap">
            {['History & Museums','Food & Local Cuisine','Adventure & Outdoors','Art & Culture','Nightlife & Entertainment','Shopping','Relaxation & Wellness'].map(i => {
              const on = profile.interests.includes(i);
              return <button key={i} onClick={() => setProfile(v=>({...v, interests: on? v.interests.filter(x=>x!==i):[...v.interests,i]}))} className={`px-3 py-1 rounded-md border ${on?'bg-white text-black border-white':'bg-white/10 border-white/20'}`}>{i}</button>
            })}
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 text-xs text-white/80">Review and save your profile to personalize itineraries.</div>
      )}
      <div className="mt-3 flex justify-between text-xs">
        <button onClick={back} className="px-3 py-1 rounded-md border border-white/20 bg-white/10">Back</button>
        {step < 4 ? (
          <button onClick={next} className="px-3 py-1 rounded-md border border-white/20 bg-white/10">Next</button>
        ) : (
          <button disabled={saving} onClick={save} className="px-3 py-1 rounded-md border border-white/20 bg-[#19c37d] text-black disabled:opacity-50">{saving?'Saving…':'Finish'}</button>
        )}
      </div>
    </div>
  );
}
