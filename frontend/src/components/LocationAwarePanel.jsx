import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, AlertCircle, Utensils, Route, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiBase } from '../lib/apiBase';

export default function LocationAwarePanel({ className = '' }) {
  const { idToken } = useAuth();
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('idle'); // idle | requesting | ok | error
  const [error, setError] = useState('');
  const [place, setPlace] = useState({ city: '', country: '', display: '' });
  const [placeStatus, setPlaceStatus] = useState('idle');
  const [suggStatus, setSuggStatus] = useState('idle'); // idle | loading | ok | error
  const [suggestions, setSuggestions] = useState({ attractions: [], food: [], tips: [] });
  const watchIdRef = useRef(null);
  const lastFetchRef = useRef(0);
  const lastCityRef = useRef('');

  const clearWatch = () => {
    try { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
    watchIdRef.current = null;
  };

  const reverseGeocode = async (lat, lon, force = false) => {
    try {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < 10000) return; // 10s throttle
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
      // Trigger suggestions fetch when city changes
      if (city && city !== lastCityRef.current) {
        lastCityRef.current = city;
        fetchSuggestions(city).catch(() => {});
      }
    } catch (e) {
      setPlaceStatus('error');
    }
  };

  const buildMockFromApi = (city, api) => {
    const tips = [];
    if (api?.best_months) tips.push(`Best months to visit: ${api.best_months}`);
    if (api?.recommended_days) tips.push(`Typical duration: ${api.recommended_days} days`);
    if (!tips.length) tips.push('Stay flexible and hydrate. Check local events for surprise finds.');
    const baseAttractions = [
      `${city} Old Town Walk`,
      `${city} Central Market`,
      `${city} City Lookout`,
      `Riverfront / Park in ${city}`,
    ];
    const baseFood = [
      `${city} Street Eats`,
      `${city} Coffee & Bakery`,
      `${city} Local Diner`,
      `Chef’s Spot in ${city}`,
    ];
    return {
      attractions: api?.attractions?.length ? api.attractions : baseAttractions,
      food: api?.food?.length ? api.food : baseFood,
      tips: api?.tips?.length ? api.tips : tips,
    };
  };

  const fetchSuggestions = async (city) => {
    try {
      setSuggStatus('loading');
      const base = getApiBase();
      // Backend expects { destinations: [...] }
      const res = await fetch(`${base}/api/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ location: city }),
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch suggestions');
      const mapped = buildMockFromApi(city, data || {});
      setSuggestions(mapped);
      setSuggStatus('ok');
    } catch (e) {
      // Mock fallbacks when backend not ready or unauthorized
      setSuggestions(buildMockFromApi(city, null));
      setSuggStatus('error');
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
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setCoords(next);
          setLocStatus('ok');
          reverseGeocode(next.lat, next.lng);
        },
        (err) => {
          if (err && (err.code === 1 /* PERMISSION_DENIED */)) {
            setError('Location access is required for Live Adventure Mode.');
          } else {
            setError(err?.message || 'Failed to get location.');
          }
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
    startWatch();
    return () => { clearWatch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-lg p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-white/90 font-semibold">Location Aware (Preview)</div>
          <div className="text-white/70 text-sm">
            {coords
              ? `Approx: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (±${Math.round(coords.accuracy || 0)}m)`
              : 'Detecting your location…'}
          </div>
          <div className="text-cyan-200/90 text-sm mt-1">
            {placeStatus === 'loading' && 'Resolving nearest city…'}
            {placeStatus === 'ok' && (
              <span className="drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                <span className="font-semibold">{place.city || 'Unknown area'}</span>
                {place.country ? <span className="text-white/70">, {place.country}</span> : null}
              </span>
            )}
            {placeStatus === 'error' && <span className="text-red-300">Could not resolve city right now.</span>}
          </div>
        </div>
        <button
          onClick={() => {
            if (coords) {
              reverseGeocode(coords.lat, coords.lng, true);
              if (place?.city) { fetchSuggestions(place.city); }
            } else {
              startWatch();
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-cyan-100 hover:bg-cyan-400/20"
        >
          <Navigation className="w-4 h-4" /> Refresh
        </button>
      </div>
      {locStatus === 'error' && (
        <div className="mt-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Suggestion cards */}
      <div className="mt-5">
        <div className="text-sm text-white/70 mb-2">
          {place.city ? `Suggestions near ${place.city}` : 'Suggestions near you'}
          {suggStatus === 'loading' && <span className="ml-2 text-cyan-200/80">(loading…)</span>}
        </div>
        {suggStatus === 'error' && (
          <div className="-mt-1 mb-3 text-xs text-yellow-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Suggestions unavailable, please try again later.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-4 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="h-9 w-9 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white/90 font-semibold">Nearby Food & Attractions</div>
                <ul className="text-white/70 text-sm mt-1 list-disc list-inside space-y-1">
                  {(suggestions.attractions.slice(0,2)).map((a, i) => <li key={`a-${i}`}>{a}</li>)}
                  {(suggestions.food.slice(0,2)).map((f, i) => <li key={`f-${i}`}>{f}</li>)}
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-4 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="h-9 w-9 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white/90 font-semibold">Smart Re‑routing</div>
                <ul className="text-white/70 text-sm mt-1 list-disc list-inside space-y-1">
                  {/* Derive simple hints from tips */}
                  {(suggestions.tips.slice(0,3)).map((t, i) => <li key={`t-${i}`}>{t}</li>)}
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="rounded-2xl border border-cyan-300/30 bg-white/5 backdrop-blur-md p-4 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] transition-all"
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="h-9 w-9 grid place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white/90 font-semibold">Contextual Tips</div>
                <ul className="text-white/70 text-sm mt-1 list-disc list-inside space-y-1">
                  {(suggestions.tips.slice(0,4)).map((t, i) => <li key={`ct-${i}`}>{t}</li>)}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
