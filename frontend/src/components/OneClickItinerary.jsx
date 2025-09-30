import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Compass, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { db, isFirebaseReady } from '../lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { getApiBase } from '../lib/apiBase';
import ItineraryCanvas from './ItineraryCanvas.jsx';

export default function OneClickItinerary({ className = '' }) {
  const { currentUser, idToken } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('');
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultMd, setResultMd] = useState('');

  // Prefetch user's saved DNA from Firestore when form opens
  useEffect(() => {
    let cancelled = false;
    async function fetchDNA() {
      if (!showForm) return;
      try {
        if (!isFirebaseReady || !db || !currentUser?.uid) return;
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!cancelled && snap.exists()) {
          const data = snap.data() || {};
          setDna(data.travelProfile || null);
        }
      } catch (e) {
        if (!cancelled) {
          // Non-fatal; server can still fetch DNA
          setDna(null);
        }
      }
    }
    fetchDNA();
    return () => { cancelled = true; };
  }, [showForm, currentUser]);

  const canSubmit = useMemo(() => {
    const d = String(destination || '').trim();
    const n = Number(days);
    return d.length >= 2 && Number.isFinite(n) && n >= 1 && n <= 60;
  }, [destination, days]);

  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!canSubmit) {
      setError('Please enter a destination and a valid number of days (1-60).');
      return;
    }
    try {
      setLoading(true);
      const base = getApiBase();
      const tripState = {
        locations: [String(destination).trim()],
        durationDays: Number(days),
        // Provide dna as a hint; the server will also fetch it server-side
        dna: dna || undefined,
      };

      const res = await fetch(`${base}/api/itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/markdown, text/plain, */*',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ tripState }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || 'Failed to generate itinerary');
      }
      setResultMd(text || '');
    } catch (err) {
      setError(err?.message || 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const resetResult = () => setResultMd('');

  return (
    <div className={`relative ${className}`}>
      {/* Glassmorphism card */}
      <div className="relative rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-lg p-6 shadow-[0_0_25px_rgba(34,211,238,0.08)]">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-300/10 via-transparent to-blue-300/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white/90">One‑Click Itinerary</h3>
              <p className="text-white/70 text-sm">Skip the back‑and‑forth. Generate a tailored plan instantly.</p>
            </div>
          </div>

          {/* Big CTA */}
          {!showForm && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-6 py-4 text-cyan-100 backdrop-blur hover:bg-cyan-400/20 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
            >
              <Rocket className="h-5 w-5" /> ✨ Generate My Itinerary
            </motion.button>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleGenerate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Paris"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/80 mb-1">Days</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder="e.g., 5"
                    className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/60 mb-1">Traveler DNA (preview)</label>
                  <div className="text-xs text-white/60 bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-h-[42px]">
                    {dna ? (
                      <span>{JSON.stringify({ pace: dna?.pace, budget: dna?.budget, interests: (dna?.interests || []).slice(0,4) })}</span>
                    ) : (
                      <span className="italic">Not loaded yet or not set.</span>
                    )}
                  </div>
                </div>
              </div>

              {error && <div className="text-sm text-red-300">{error}</div>}

              <div className="flex items-center gap-3">
                <motion.button
                  type="submit"
                  disabled={loading || !canSubmit}
                  whileHover={{ scale: canSubmit && !loading ? 1.02 : 1.0 }}
                  whileTap={{ scale: canSubmit && !loading ? 0.98 : 1.0 }}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors ${
                    loading || !canSubmit
                      ? 'bg-cyan-400/20 text-cyan-100/60 border border-cyan-300/30 cursor-not-allowed'
                      : 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/60 hover:bg-cyan-400/30'
                  }`}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {loading ? 'Generating…' : 'Generate'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  className="text-sm text-white/70 hover:text-white/90"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Itinerary Canvas Overlay */}
      {resultMd ? (
        <ItineraryCanvas
          itineraryMarkdown={resultMd}
          plannedDays={Number(days) || null}
          onClose={resetResult}
          isSidebarOpen={false}
        />
      ) : null}
    </div>
  );
}
