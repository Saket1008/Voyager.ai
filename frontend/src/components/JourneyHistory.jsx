import React, { useEffect, useState } from 'react';
import { auth, db, isFirebaseReady } from '../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function JourneyHistory() {
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(isFirebaseReady);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isFirebaseReady || !auth || !db) { setLoading(false); return; }
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setJourneys([]); setLoading(false); return; }
      const ref = collection(db, 'users', user.uid, 'journeys');
      const q = query(ref, orderBy('createdAt', 'desc'));
      const unsubSnap = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setJourneys(list);
        setLoading(false);
      }, (err) => {
        console.error('Journey history snapshot error', err);
        setError('Could not load journey history.');
        setLoading(false);
      });
      return () => unsubSnap();
    });
    return () => unsubAuth();
  }, []);

  if (!isFirebaseReady) return null; // Hidden when Firebase isn’t configured

  return (
    <div className="p-2 h-full flex flex-col">
      <div className="text-xs font-semibold text-white/80 mb-2">My Journeys</div>
      <div className="mb-2 flex gap-2">
        <button onClick={async () => {
          if (!auth) return alert('Login required to save journeys');
          setSaving(true);
          try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:5000') + '/api/journeys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ title: 'Saved from UI', prompt: 'Saved via JourneyHistory' }),
            });
            if (!res.ok) throw new Error('Save failed');
            alert('Saved');
          } catch (e) {
            console.error('Save journey failed', e);
            alert('Save failed');
          } finally { setSaving(false); }
        }} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20">{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && <p className="text-[12px] text-white/60">Loading history...</p>}
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        {!loading && !error && journeys.length === 0 && (
          <p className="text-[12px] text-white/60">Your past journeys will appear here.</p>
        )}
        {!loading && !error && journeys.length > 0 && (
          <ul className="space-y-1">
            {journeys.map((j) => {
              const created = j.createdAt?.toDate ? j.createdAt.toDate() : (j.createdAt ? new Date(j.createdAt) : null);
              const dateStr = created ? created.toLocaleDateString() : '';
              return (
                <li key={j.id}>
                  <div className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors">
                    <div className="text-[12px] font-medium text-white truncate" title={j.prompt || j.title || 'Journey'}>
                      {j.title || j.prompt || 'Journey'}
                    </div>
                    {dateStr ? <div className="text-[11px] text-white/50">{dateStr}</div> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
