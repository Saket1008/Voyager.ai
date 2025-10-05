import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, Train, Bus as BusIcon, Globe2, ArrowLeft, Home, ExternalLink, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/apiBase';
import { toast } from '../lib/toast';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const TabKeys = ['Flights', 'Trains', 'Buses'];
const ModeIcon = ({ tab }) => {
  switch (tab) {
    case 'Flights': return <Plane className="w-4 h-4" />;
    case 'Trains': return <Train className="w-4 h-4" />;
    case 'Buses': return <BusIcon className="w-4 h-4" />;
    default: return <Globe2 className="w-4 h-4" />;
  }
};

function formatTimeRange(opt) {
  const t = (s) => s || '';
  if (opt.departTime && opt.arriveTime) return `${t(opt.departTime)} → ${t(opt.arriveTime)}`;
  return t(opt.time) || '';
}

export default function BookingsRequiredPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const q = useQuery();
  const location = useLocation();

  const [mode, setMode] = useState('select');
  const [itineraryJson, setItineraryJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState([]);
  const [activeTabs, setActiveTabs] = useState({}); // per segment index
  const [journeys, setJourneys] = useState([]);
  const [activeJourney, setActiveJourney] = useState(null);

  const setTab = (idx, tab) => setActiveTabs((prev) => ({ ...prev, [idx]: tab }));

  useEffect(() => {
    let mounted = true;
    // If itinerary was passed via navigation state, prefer it
    const passed = location.state?.itinerary;
    if (passed && mounted) {
      (async () => {
        try {
          setLoading(true);
          await handleFetch(passed);
        } finally { setLoading(false); }
      })();
    }
    // Load journeys for selection mode
    (async () => {
      try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (!token) return; // not signed in -> selection list stays empty
        const res = await fetch(`${getApiBase()}/api/journeys`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.journeys) ? data.journeys : [];
        if (mounted) setJourneys(list);
      } catch (e) { /* ignore */ }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildMock = () => ([{
    id: 'seg-1', from: 'Delhi', to: 'Agra',
    flights: [
      { carrier: 'IndiGo 6E-123', departTime: '08:30', arriveTime: '09:25', duration: '55m', priceINR: 3499, label: 'Fastest', url: 'https://www.google.com/travel/flights' },
    ],
    trains: [
      { carrier: 'Gatimaan Express 12049', departTime: '08:10', arriveTime: '09:50', duration: '1h 40m', priceINR: 980, label: 'Best', url: 'https://www.irctc.co.in/' },
      { carrier: 'Taj Express 12279', departTime: '06:45', arriveTime: '09:30', duration: '2h 45m', priceINR: 430, label: 'Cheapest', url: 'https://www.irctc.co.in/' },
    ],
    buses: [
      { carrier: 'Volvo AC Seater', departTime: '07:30', arriveTime: '11:15', duration: '3h 45m', priceINR: 650, label: 'Budget', url: 'https://www.redbus.in/' },
    ],
  }]);

  const selectDefaultTab = (segs) => {
    const next = {};
    segs.forEach((s, i) => {
      if (s.flights?.length) next[i] = 'Flights';
      else if (s.trains?.length) next[i] = 'Trains';
      else next[i] = 'Buses';
    });
    setActiveTabs(next);
  };

  async function handleFetch(explicitItinerary = null) {
    setLoading(true);
    try {
      let itinerary = explicitItinerary;
      if (!itinerary) {
        if (mode === 'select') {
          if (!activeJourney) { toast.warn('Select an itinerary first'); return; }
          itinerary = {
            markdown: activeJourney.markdown || '',
            tripState: activeJourney.tripState || {},
            durationDays: activeJourney.durationDays || null,
            locations: activeJourney.locations || null,
            title: activeJourney.title || 'Journey',
          };
        } else {
          if (!itineraryJson.trim()) { toast.warn('Paste itinerary JSON first'); return; }
          try { itinerary = JSON.parse(itineraryJson); } catch { throw new Error('Invalid JSON'); }
        }
      }

      // Call bookings API
      const token = currentUser ? await currentUser.getIdToken() : null;
      const res2 = await fetch(`${getApiBase()}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ itinerary }),
      });
      let out = await res2.json().catch(() => ({}));
      if (!res2.ok || !out?.segments) {
        // Use mock on failure
        out = { segments: buildMock() };
        toast.info('Showing sample bookings (API unavailable).');
      }
      setSegments(Array.isArray(out.segments) ? out.segments : buildMock());
      selectDefaultTab(Array.isArray(out.segments) ? out.segments : buildMock());
    } catch (e) {
      console.error('[Bookings] fetch error:', e);
      setSegments(buildMock());
      selectDefaultTab(buildMock());
      toast.error(e?.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" title="Back">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" title="Home">
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
          <div className="text-right">
            <div className="text-xl md:text-2xl font-semibold">🧳 Bookings Required</div>
            <div className="text-xs text-white/70">All trains and flights for your journey, curated for convenience and savings.</div>
          </div>
        </div>

        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <div className="inline-flex rounded-xl border border-white/15 bg-black/30 p-1 self-start">
              {['select', 'paste'].map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-sm rounded-lg ${mode===m ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'}`}>{m === 'select' ? 'Select from My Itineraries' : 'Paste Itinerary JSON'}</button>
              ))}
            </div>

            {mode === 'select' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {!currentUser ? (
                  <div className="text-sm text-white/70">Sign in to view your saved itineraries.</div>
                ) : journeys.length === 0 ? (
                  <div className="text-sm text-white/70">No itineraries found.</div>
                ) : journeys.map((j) => {
                  const isActive = activeJourney?.id === j.id;
                  const dateStr = j.date ? new Date(j.date).toLocaleDateString() : '';
                  const destinations = Array.isArray(j.locations) ? j.locations.join(', ') : (j.tripState?.region || '');
                  return (
                    <motion.button
                      key={j.id}
                      onClick={() => setActiveJourney(j)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`text-left rounded-xl border p-3 transition ${isActive ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_10px_30px_rgba(25,195,125,0.25)]' : 'border-white/10 bg-white/5'}`}
                    >
                      <div className="font-semibold truncate">{j.title || 'Journey'}</div>
                      <div className="text-xs text-white/70 truncate">{dateStr}</div>
                      <div className="text-xs text-white/60 truncate">{destinations}</div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <textarea value={itineraryJson} onChange={(e)=>setItineraryJson(e.target.value)} placeholder='{"markdown":"...","tripState":{...}}' className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none min-h-28" />
            )}

            <div>
              <button onClick={() => handleFetch()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400 disabled:opacity-50">
                {loading ? 'Fetching…' : 'Find Bookings'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Segments */}
        <div className="mt-6 grid grid-cols-1 gap-5">
          {loading && (
            <div className="h-24 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
          )}
          {!loading && segments.map((seg, idx) => {
            const from = seg.from || seg.origin || 'Origin';
            const to = seg.to || seg.destination || 'Destination';
            const tab = activeTabs[idx] || 'Flights';
            const lists = {
              Flights: seg.flights || [],
              Trains: seg.trains || [],
              Buses: seg.buses || [],
            };
            const options = lists[tab] || [];
            return (
              <motion.div key={seg.id || idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{from} → {to}</div>
                    <div className="text-xs text-white/60">Recommended options by class</div>
                  </div>
                  <div className="inline-flex rounded-xl border border-white/15 bg-black/30 p-1">
                    {TabKeys.map((t) => (
                      <button key={t} onClick={()=>setTab(idx, t)} className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition ${tab===t ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'}`}>
                        <ModeIcon tab={t} /> {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {options.length === 0 ? (
                    <div className="col-span-full text-sm text-white/70">No {tab.toLowerCase()} available for this segment.</div>
                  ) : options.map((opt, i) => (
                    <motion.div key={i} whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:border-cyan-300/50 hover:shadow-[0_10px_30px_rgba(34,211,238,0.25)] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-2">
                            <ModeIcon tab={tab} /> {opt.carrier || 'Carrier'}
                            {opt.label && (
                              <span className="text-[10px] rounded-full px-2 py-0.5 border border-emerald-300/40 bg-emerald-400/10 text-emerald-200 inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> {opt.label}</span>
                            )}
                          </div>
                          <div className="text-xs text-white/70">{formatTimeRange(opt)} • {opt.duration || ''}</div>
                          <div className="text-sm mt-1">₹ {Number(opt.priceINR || opt.price || 0).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => { try { window.open(opt.url || 'https://www.google.com', '_blank', 'noopener,noreferrer'); } catch {} }}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-3 py-1.5 hover:bg-emerald-400"
                        >
                          Book Now <ExternalLink className="w-4 h-4" />
                        </button>
                        <button onClick={() => toast.info('Added to My Bookings (coming soon)')} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" title="Add to My Bookings">
                          Save
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
