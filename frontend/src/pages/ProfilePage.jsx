import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { getApiBase } from '../lib/apiBase';
import { getFirebaseIdToken, isFirebaseReady } from '../lib/firebaseClient';
import JourneyHistory from '../components/JourneyHistory.jsx';
import { DNA_QUESTIONS } from '../lib/dnaQuestions.js';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ travelProfile: { pace: '', budget: '', interests: [], travelStyle: '', accommodation: '' } });

  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    const load = async () => {
      try {
        if (!isFirebaseReady || !db) {
          setUserDoc({});
          setLoading(false);
          return;
        }
        const ref = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        if (!alive) return;
        setUserDoc(data);
        const tp = data.travelProfile || {};
        setForm({
          travelProfile: {
            pace: tp.pace || '',
            budget: tp.budget || '',
            interests: Array.isArray(tp.interests) ? tp.interests : [],
            travelStyle: tp.travelStyle || '',
            accommodation: tp.accommodation || ''
          }
        });
        setLoading(false);
      } catch (e) {
        console.error('Load profile failed', e);
        if (!alive) return;
        setError('Failed to load your profile');
        setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      // If no user, kick back to home/auth
      navigate('/');
    }
  }, [currentUser, navigate]);

  const questions = useMemo(() => DNA_QUESTIONS, []);

  const setTP = (patch) => setForm((prev) => ({ travelProfile: { ...prev.travelProfile, ...patch } }));

  const toggleInterest = (opt) => {
    setTP({
      interests: (() => {
        const list = Array.isArray(form.travelProfile.interests) ? [...form.travelProfile.interests] : [];
        const i = list.indexOf(opt);
        if (i >= 0) list.splice(i, 1); else list.push(opt);
        // Cap at max selections if defined
        const max = questions.find(q => q.key === 'interests')?.maxSelections || 3;
        return list.slice(0, max);
      })()
    });
  };

  const handleSaveChanges = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      const base = getApiBase();
      let res = await fetch(`${base}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ travelProfile: { ...form.travelProfile } }),
      });
      if (res.status === 401 || res.status === 403) {
        const fresh = await getFirebaseIdToken(true);
        if (fresh) {
          res = await fetch(`${base}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` },
            body: JSON.stringify({ travelProfile: { ...form.travelProfile } }),
          });
        }
      }
      if (!res.ok) throw new Error(await res.text());
      // Merge locally for optimistic UI
      setUserDoc((prev) => ({ ...(prev || {}), travelProfile: { ...form.travelProfile } }));
      setIsEditing(false);
    } catch (e) {
      console.error('Save profile failed', e);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const tp = form.travelProfile || {};

  return (
    <div className="min-h-screen text-white pt-24 px-6 bg-black">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">Your Profile</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 text-sm">Back to app</button>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold">Edit Profile</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleSaveChanges} disabled={saving} className="px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
                <button onClick={() => { setIsEditing(false); setForm({ travelProfile: { ...(userDoc?.travelProfile || {}) } }); }} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-md bg-red-500/15 border border-red-400/30 text-sm text-red-200">{error}</div>}
        {loading ? (
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Account info + DNA */}
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold mb-3">Account</h2>
                <div className="text-sm text-white/80">Name: <span className="font-medium">{currentUser?.displayName || userDoc?.name || '—'}</span></div>
                <div className="text-sm text-white/80 mt-1">Email: <span className="font-medium">{currentUser?.email || '—'}</span></div>
              </section>

              <section className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold mb-4">Traveler's DNA</h2>
                {!isEditing ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-white/70">Pace</div>
                      <div className="font-medium">{userDoc?.travelProfile?.pace || '—'}</div>
                    </div>
                    <div>
                      <div className="text-white/70">Budget</div>
                      <div className="font-medium">{userDoc?.travelProfile?.budget || '—'}</div>
                    </div>
                    <div>
                      <div className="text-white/70">Interests</div>
                      <div className="font-medium">{Array.isArray(userDoc?.travelProfile?.interests) && userDoc.travelProfile.interests.length ? userDoc.travelProfile.interests.join(', ') : '—'}</div>
                    </div>
                    {userDoc?.travelProfile?.travelStyle ? (
                      <div>
                        <div className="text-white/70">Travel Style</div>
                        <div className="font-medium">{userDoc.travelProfile.travelStyle}</div>
                      </div>
                    ) : null}
                    {userDoc?.travelProfile?.accommodation ? (
                      <div>
                        <div className="text-white/70">Accommodation</div>
                        <div className="font-medium">{userDoc.travelProfile.accommodation}</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Pace */}
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Pace</label>
                      <select value={tp.pace} onChange={(e) => setTP({ pace: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select pace</option>
                        {questions.find(q => q.key === 'pace')?.options?.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    {/* Budget */}
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Budget</label>
                      <select value={tp.budget} onChange={(e) => setTP({ budget: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select budget</option>
                        {questions.find(q => q.key === 'budget')?.options?.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    {/* Interests */}
                    <div>
                      <div className="block text-sm text-white/80 mb-2">Interests</div>
                      <div className="flex flex-wrap gap-2">
                        {questions.find(q => q.key === 'interests')?.options?.map((opt) => {
                          const selected = Array.isArray(tp.interests) && tp.interests.includes(opt);
                          return (
                            <button key={opt} onClick={() => toggleInterest(opt)} className={`px-3 py-1.5 rounded-full border text-xs ${selected ? 'bg-green-500/30 border-green-400 text-green-100' : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'}`}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-white/50 mt-1">Select up to {questions.find(q => q.key === 'interests')?.maxSelections || 3}</div>
                    </div>
                    {/* Optional extras */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/80 mb-1">Travel Style</label>
                        <select value={tp.travelStyle} onChange={(e) => setTP({ travelStyle: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm">
                          <option value="">Select style</option>
                          {questions.find(q => q.key === 'travelStyle')?.options?.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-white/80 mb-1">Accommodation</label>
                        <select value={tp.accommodation} onChange={(e) => setTP({ accommodation: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm">
                          <option value="">Select accommodation</option>
                          {questions.find(q => q.key === 'accommodation')?.options?.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right: Journey history */}
            <aside>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 h-full">
                <div className="text-sm font-semibold text-white/90 mb-3">Journey History</div>
                <div className="h-[520px] overflow-hidden">
                  <JourneyHistory />
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
