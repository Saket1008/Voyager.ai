import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Utensils, RefreshCcw, Lightbulb, Navigation, AlertCircle, Heart, CalendarDays, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiBase } from '../lib/apiBase';

export default function LiveAdventurePage() {
  const { idToken } = useAuth();
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('idle'); // idle | requesting | ok | error
  const [error, setError] = useState('');

  const [place, setPlace] = useState({ city: '', country: '', display: '' });
  const [placeStatus, setPlaceStatus] = useState('idle'); // idle | loading | ok | error

  // Journeys state
  const [journeys, setJourneys] = useState([]);
  const [journeysStatus, setJourneysStatus] = useState('idle'); // idle | loading | ok | error
  const [activeJourney, setActiveJourney] = useState(null);
  const [currentStep, setCurrentStep] = useState(null); // { time, location, activity }
  const timeTickerRef = useRef(null);

  // Modal state for feature cards
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalData, setModalData] = useState(null);

  const watchIdRef = useRef(null);
  const lastFetchRef = useRef(0);

  const clearWatch = () => {
    try { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
    watchIdRef.current = null;
  };

  const reverseGeocode = async (lat, lon, force = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < 10000) return; // throttle 10s
      lastFetchRef.current = now;
      setPlaceStatus('loading');
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({ format: 'json', lat: String(lat), lon: String(lon) }).toString();
      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
      const data = await res.json();
      const addr = data?.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '';
      const country = addr.country || '';
      const display = data?.display_name || '';
      setPlace({ city, country, display });
      setPlaceStatus('ok');
    } catch (e) {
      setPlaceStatus('error');
    }
  };

  const startWatch = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported by this browser.');
      setLocStatus('error');
      return;
    }
    setError('');
    setLocStatus('requesting');
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const next = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setCoords(next);
          setLocStatus('ok');
          reverseGeocode(next.lat, next.lng);
        },
        (err) => {
          setError(err?.message || 'Failed to get location.');
          setLocStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
      );
      watchIdRef.current = id;
    } catch (e) {
      setError('Location watch failed.');
      setLocStatus('error');
    }
  };

  useEffect(() => {
    // Start continuous watch on mount
    startWatch();
    return () => { clearWatch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch journeys on mount or when token is available
  useEffect(() => {
    const fetchJourneys = async () => {
      try {
        setJourneysStatus('loading');
        const base = getApiBase();
        const res = await fetch(`${base}/api/journeys`, {
          headers: {
            'Accept': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
        });
        let data = null;
        try { data = await res.json(); } catch {}
        if (!res.ok || !data) throw new Error(data?.error || 'Failed to load journeys');
        // Normalize itineraries from API (markdown-based). Convert to time-sliced items if possible later; for now, store markdown payloads too.
        const list = Array.isArray(data?.journeys) ? data.journeys : (Array.isArray(data) ? data : []);
        const normalized = list.map((j, idx) => ({
          id: j.id || j._id || `j-${idx}`,
          title: j.title || j.name || 'Untitled Trip',
          date: j.date || j.createdAt || j.updatedAt || null,
          favorite: Boolean(j.favorite || j.isFavorite),
          itinerary: Array.isArray(j.itinerary) ? j.itinerary : (Array.isArray(j.plan) ? j.plan : []),
          markdown: j.markdown || '',
        }));
        if (!normalized.length) throw new Error('Empty');
        setJourneys(normalized);
        setJourneysStatus('ok');
      } catch (e) {
        // Fallback: use locally saved itineraries captured when user generated trips
        try {
          const raw = localStorage.getItem('voyager_local_journeys');
          const arr = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr) && arr.length) {
            setJourneys(arr.map(j => ({
              id: j.id,
              title: j.title,
              date: j.date,
              favorite: Boolean(j.favorite),
              itinerary: Array.isArray(j.itinerary) ? j.itinerary : [],
              markdown: j.markdown || '',
            })));
            setJourneysStatus('ok');
            return;
          }
        } catch {}
        // No local journeys present — keep previous behavior as empty state
        setJourneys([]);
        setJourneysStatus('ok');
      }
    };
    fetchJourneys();
  }, [idToken]);

  // Utilities to align itinerary to current local time and city
  const parseTimeToMinutes = (t) => {
    if (!t) return null;
    const s = String(t).trim();
    // Handle 12h format like "02:30 PM"
    const twelve = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelve) {
      let h = parseInt(twelve[1], 10);
      const m = parseInt(twelve[2], 10);
      const ampm = twelve[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    // Handle 24h format like "14:05"
    const twenty = s.match(/^(\d{1,2}):(\d{2})$/);
    if (twenty) {
      const h = parseInt(twenty[1], 10);
      const m = parseInt(twenty[2], 10);
      return (h * 60 + m);
    }
    return null;
  };

  const computeCurrentStep = () => {
    try {
      if (!activeJourney || !Array.isArray(activeJourney.itinerary) || !activeJourney.itinerary.length) {
        setCurrentStep(null);
        return;
      }
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const city = (place?.city || '').toLowerCase();
      const items = activeJourney.itinerary
        .map((it, idx) => ({ idx, ...it, minutes: parseTimeToMinutes(it.time) }))
        .filter(x => typeof x.minutes === 'number');
      if (!items.length) { setCurrentStep(null); return; }

      const cityMatches = city
        ? items.filter(x => String(x.location || '').toLowerCase().includes(city))
        : items.slice();
      const pool = cityMatches.length ? cityMatches : items;

      // Prefer the last step at or before now, else the earliest after now
      const pastOrNow = pool.filter(x => x.minutes <= nowMinutes).sort((a,b) => b.minutes - a.minutes);
      const future = pool.filter(x => x.minutes > nowMinutes).sort((a,b) => a.minutes - b.minutes);
      const pick = pastOrNow[0] || future[0] || pool[0];
      setCurrentStep(pick ? { time: pick.time, location: pick.location, activity: pick.activity } : null);
    } catch {
      setCurrentStep(null);
    }
  };

  // Recompute when journey, city, or time passes
  useEffect(() => {
    computeCurrentStep();
    if (timeTickerRef.current) { clearInterval(timeTickerRef.current); }
    timeTickerRef.current = setInterval(() => computeCurrentStep(), 60000); // every minute
    return () => { if (timeTickerRef.current) clearInterval(timeTickerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJourney, place.city]);

  const cityLabel = coords
    ? `Approximate: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (±${Math.round(coords.accuracy || 0)}m)`
    : 'Detecting your location…';

  return (
    <div className="relative z-10 min-h-screen px-4 py-14 sm:px-6 lg:px-10">
      {/* Header */}
      <div className="mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-tight text-white drop-shadow-[0_0_25px_rgba(56,189,248,0.45)]"
        >
          🚀 Live Adventure Mode <span className="text-cyan-300/90">(Coming Soon)</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: 'easeOut' }}
          className="mt-3 text-cyan-100/90"
        >
          A real-time in-trip assistant that adapts your journey on the fly.
        </motion.p>
      </div>

      {/* Location-aware mock panel */}
      <div className="mx-auto mt-10 max-w-4xl">
        <div className="rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-lg p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-white/90 font-semibold">Location Aware (Mock)</div>
              <div className="text-white/70 text-sm">
                {cityLabel}
              </div>
              <div className="text-white/60 text-xs mt-1">
                City name and rich context will appear here when reverse geocoding is enabled.
              </div>
            </div>
            <button
              onClick={() => {
                if (coords) reverseGeocode(coords.lat, coords.lng, true); else startWatch();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-cyan-100 hover:bg-cyan-400/20"
            >
              <Navigation className="w-4 h-4" /> Refresh
            </button>
          </div>
          {/* City/Town + Country */}
          <div className="mt-3 text-sm text-white/80">
            {placeStatus === 'loading' && 'Resolving nearest city…'}
            {placeStatus === 'ok' && (
              <div>
                <span className="font-semibold">{place.city || 'Unknown area'}</span>
                {place.country ? <span className="text-white/70">, {place.country}</span> : null}
              </div>
            )}
            {placeStatus === 'error' && <span className="text-red-300">Could not resolve city right now.</span>}
          </div>
          {locStatus === 'error' && (
            <div className="mt-3 text-sm text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>
      </div>

      {/* Journeys selector */}
      {!activeJourney && (
        <div className="mx-auto mt-10 max-w-6xl">
          <div className="mb-3 text-white/80">Select a recent itinerary to activate Live Adventure features:</div>
          {journeysStatus === 'loading' && (
            <div className="text-white/60 text-sm">Loading your journeys…</div>
          )}
          {journeysStatus === 'ok' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {journeys.map(j => (
                <button
                  key={j.id}
                  onClick={() => setActiveJourney(j)}
                  className="text-left rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-5 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white/90 font-semibold group-hover:text-cyan-100">{j.title}</div>
                      <div className="mt-1 text-white/60 text-sm inline-flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" /> {j.date ? String(j.date).slice(0, 10) : '—'}
                      </div>
                    </div>
                    {j.favorite && (
                      <div className="text-rose-300" title="Favorite">
                        <Heart className="w-5 h-5 fill-rose-300" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feature cards appear after a journey is selected */}
      {activeJourney && (
        <div className="mx-auto mt-10 max-w-6xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-white/80">
              Active Itinerary: <span className="font-semibold text-white/90">{activeJourney.title}</span>
              {activeJourney.date ? <span className="ml-2 text-white/60">({String(activeJourney.date).slice(0,10)})</span> : null}
            </div>
            <button
              onClick={() => setActiveJourney(null)}
              className="text-xs inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-3 py-1.5 text-cyan-100 hover:bg-cyan-400/20"
            >Change</button>
          </div>
          {currentStep && (
            <div className="mb-5 rounded-xl border border-cyan-300/30 bg-white/5 backdrop-blur p-4 text-white/90">
              You are currently at: <span className="font-semibold">{currentStep.activity}</span> in <span className="font-semibold">{currentStep.location}</span>
              {currentStep.time ? <span className="text-white/60"> — {currentStep.time}</span> : null}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <button
              onClick={async () => {
                try {
                  setModalTitle('Nearby Vegetarian Options');
                  setModalOpen(true); setModalLoading(true); setModalError(''); setModalData(null);
                  const base = getApiBase();
                  const res = await fetch(`${base}/api/live/food`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
                    body: JSON.stringify({ city: place.city || 'Your City' }),
                  });
                  let data = null; try { data = await res.json(); } catch {}
                  if (!res.ok) throw new Error(data?.error || 'Failed to load food');
                  setModalData(data);
                } catch (e) { setModalError(e?.message || 'Something went wrong'); }
                finally { setModalLoading(false); }
              }}
              className="text-left rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-5 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white/90 font-semibold">Nearby Food & Attractions</div>
                  <div className="text-white/70 text-sm">Discover great eats and sights within minutes of your current spot.</div>
                </div>
              </div>
            </button>

            <button
              onClick={async () => {
                try {
                  setModalTitle('Smart Re‑routing');
                  setModalOpen(true); setModalLoading(true); setModalError(''); setModalData(null);
                  const base = getApiBase();
                  const res = await fetch(`${base}/api/live/reroute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
                    body: JSON.stringify({ currentStage: currentStep?.activity || 'current plan' }),
                  });
                  let data = null; try { data = await res.json(); } catch {}
                  if (!res.ok) throw new Error(data?.error || 'Failed to compute reroute');
                  setModalData(data);
                } catch (e) { setModalError(e?.message || 'Something went wrong'); }
                finally { setModalLoading(false); }
              }}
              className="text-left rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-5 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                  <RefreshCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white/90 font-semibold">Smart Re‑routing</div>
                  <div className="text-white/70 text-sm">Adjusts your day when plans change—traffic, closures, or new ideas.</div>
                </div>
              </div>
            </button>

            <button
              onClick={async () => {
                try {
                  setModalTitle('Contextual Tips');
                  setModalOpen(true); setModalLoading(true); setModalError(''); setModalData(null);
                  const base = getApiBase();
                  const res = await fetch(`${base}/api/live/tips`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
                    body: JSON.stringify({ city: place.city || 'Your City' }),
                  });
                  let data = null; try { data = await res.json(); } catch {}
                  if (!res.ok) throw new Error(data?.error || 'Failed to load tips');
                  setModalData(data);
                } catch (e) { setModalError(e?.message || 'Something went wrong'); }
                finally { setModalLoading(false); }
              }}
              className="text-left rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-5 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white/90 font-semibold">Contextual Tips</div>
                  <div className="text-white/70 text-sm">Culture, etiquette, and weather insights—just when you need them.</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-cyan-300/30 bg-white/10 backdrop-blur-xl p-5 text-white shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">{modalTitle}</div>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {modalLoading && <div className="text-white/70 text-sm">Loading…</div>}
            {!!modalError && (
              <div className="text-red-300 text-sm flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" /> {modalError}
              </div>
            )}
            {!modalLoading && !modalError && modalData && (
              <div className="space-y-3">
                {Array.isArray(modalData?.restaurants) && (
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {modalData.restaurants.map((r, i) => (
                      <li key={`r-${i}`}>
                        <span className="font-semibold">{r.name}</span> — {r.type} • ~{r.distanceMin} min walk
                      </li>
                    ))}
                  </ul>
                )}
                {Array.isArray(modalData?.suggestions) && (
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {modalData.suggestions.map((s, i) => (
                      <li key={`s-${i}`}>{s}</li>
                    ))}
                  </ul>
                )}
                {Array.isArray(modalData?.tips) && (
                  <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
                    {modalData.tips.map((t, i) => (
                      <li key={`t-${i}`}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
