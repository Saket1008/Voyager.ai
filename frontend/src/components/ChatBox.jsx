import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import { getFirebaseIdToken, db } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';
import ReactMarkdown from 'react-markdown';
import { Settings, Send, CornerDownLeft, Clock, Utensils, MapPin, Bed, Info, Lightbulb, Bot } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import Avatar from './Avatar.jsx';
import JourneyHistory from './JourneyHistory';

// Render a JSON itinerary as cards
const ItineraryCards = ({ items }) => {
  const iconFor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'food': return Utensils;
      case 'activity': return MapPin;
      case 'lodging': return Bed;
      case 'info': return Info;
      case 'tip': return Lightbulb;
      default: return MapPin;
    }
  };
  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const Icon = iconFor(it.type);
        return (
          <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-white/10 grid place-items-center">
                <Icon className="w-4 h-4 text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-white font-medium truncate">{it.title || 'Untitled'}</h4>
                  {it.time ? (
                    <span className="inline-flex items-center gap-1 text-xs text-white/80 bg-white/10 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />{it.time}</span>
                  ) : null}
                </div>
                {it.description ? (
                  <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{it.description}</p>
                ) : null}
                {it.type ? (
                  <div className="mt-2 text-[11px] text-white/60 capitalize">{it.type}</div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// A simple component for individual chat messages
const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <Avatar role={message.role} />}
      <div className={`max-w-xl p-4 rounded-2xl ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <ItineraryCards items={message.content} />
        ) : (
          <div className="prose prose-invert prose-p:my-0 prose-headings:my-2">
            <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && <Avatar role={message.role} />}
    </div>
  );
};

// Main Chatbox Component
const Chatbox = ({ onEditProfile, user }) => {
  const { currentUser, idToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [travelProfile, setTravelProfile] = useState(null);
  const [skippedQuestions, setSkippedQuestions] = useState([]);
  const [tripAnswers, setTripAnswers] = useState({});
  const [flowIndex, setFlowIndex] = useState(0);
  const [currentSelections, setCurrentSelections] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch user's DNA profile
  useEffect(() => {
    let ignore = false;
    async function fetchProfile() {
      try {
        if (!currentUser || !db) return;
        const ref = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        if (ignore) return;
        const tp = data?.travelProfile || null;
        setTravelProfile(tp);
        // Determine skipped questions based on missing keys or empty values
        const skipped = DNA_QUESTIONS.filter(q => {
          if (!tp || !(q.key in tp)) return true;
          const v = tp[q.key];
          if (Array.isArray(v)) return v.length === 0;
          return !v;
        });
        setSkippedQuestions(skipped);
      } catch (e) {
        console.warn('Failed to load travelProfile', e?.message || e);
      }
    }
    fetchProfile();
    return () => { ignore = true; };
  }, [currentUser]);

  // New Itinerary staged flow (per-journey)
  const STAGES = [
    'greeting',
    'ask_intent',
    'input_locations',
    'input_region',
    'ask_duration',
    'ask_dates',
    'ask_travelers',
    'must_haves',
    'must_nots',
    'generate_suggestions',
  ];

  const [stageIndex, setStageIndex] = useState(0);
  const stage = STAGES[stageIndex];
  const [trip, setTrip] = useState({
    intent: null,
    destinations: [],
    region: null,
    durationDays: null,
    dateStart: null,
    dateFlex: 'none',
    travelers: null,
    mustHaves: '',
    mustNots: '',
  });

  useEffect(() => {
    // Initial greeting message
    const who = currentUser?.displayName || user?.displayName || 'Traveler';
    const welcome = `Welcome, ${who}!`;
    setMessages([{ role: 'assistant', content: `${welcome} Ready to plan a new trip?` }]);
    setStageIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, stageIndex]);

  function goNext() {
    setStageIndex((s) => Math.min(STAGES.length - 1, s + 1));
  }
  function goBack() {
    setStageIndex((s) => Math.max(0, s - 1));
  }

  function setTripField(key, value) {
    setTrip((t) => ({ ...t, [key]: value }));
  }

  // Add/remove destination helpers
  function addDestination(city) {
    if (!city || !city.trim()) return;
    setTrip((t) => ({ ...t, destinations: Array.from(new Set([...(t.destinations || []), city.trim()])) }));
    setInput('');
    setSuggestions([]);
  }
  function removeDestination(city) {
    setTrip((t) => ({ ...t, destinations: (t.destinations || []).filter((d) => d !== city) }));
  }

  async function handleGenerateItinerary() {
    setIsLoading(true);
    try {
  const token = idToken ?? await getFirebaseIdToken();
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

      const payload = {
        user: currentUser ? { uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email } : null,
        travelProfile: travelProfile || {},
        trip: {
          intent: trip.intent,
          destinations: trip.destinations,
          region: trip.region,
          durationDays: trip.durationDays,
          dateStart: trip.dateStart,
          dateFlex: trip.dateFlex,
          travelers: trip.travelers,
          mustHaves: trip.mustHaves,
          mustNots: trip.mustNots,
        },
      };

      // Use the unified chat endpoint and ask it to generate the itinerary for the current staged state
      const chatPayload = {
        message: 'Generate itinerary',
        stage: 'generate_suggestions',
        user: payload.user,
        state: {
          locations: payload.trip.destinations,
          region: payload.trip.region,
          durationDays: payload.trip.durationDays,
          startDate: payload.trip.dateStart,
          dateFlex: payload.trip.dateFlex,
          travelers: payload.trip.travelers,
          must_haves: payload.trip.mustHaves,
          must_nots: payload.trip.mustNots,
        },
      };

      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(chatPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate itinerary');
      }

      const contentType = res.headers.get('content-type') || '';
      let assistantContent = null;
      if (contentType.includes('text/markdown')) {
        assistantContent = await res.text();
      } else {
        assistantContent = await res.json().catch(() => null);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent || 'No response' }]);
      setStageIndex(STAGES.indexOf('generate_suggestions'));
    } catch (e) {
      console.error('itinerary generation failed', e);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to generate itinerary: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  // Destination suggestions
  const handleDestinationInputChange = async (val) => {
    setInput(val);
    if (!val || val.trim().length < 3) { setSuggestions([]); return; }
    try {
  const token = idToken ?? await getFirebaseIdToken();
      const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
      const res = await fetch(`${base}/api/destinations/suggest?q=${encodeURIComponent(val.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      const list = await res.json();
      setSuggestions(Array.isArray(list) ? list : []);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectDestination = (city) => {
  setSuggestions([]);
  addDestination(city);
  };

  const handleConfirmDate = () => {
    if (!startDate) return;
    const iso = startDate.toISOString().slice(0, 10); // yyyy-mm-dd
    setTripField('dateStart', iso);
    goNext();
  };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (stage === 'input_locations') {
        addDestination(input);
      }
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="text-white">
      <div className="relative h-[calc(100vh-4rem)]">
        {/* Slide-out JourneyHistory panel (absolute) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute left-0 top-0 bottom-0 w-72 z-40 border-r border-white/10 bg-black/20 backdrop-blur-md"
              >
                <div className="h-full p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white/80">My Journeys</div>
                    <button onClick={() => { setMessages([]); setFlowIndex(0); setTripAnswers({}); setInput(''); setCurrentSelections([]); }} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20">New</button>
                  </div>
                  <div className="h-[calc(100%-2rem)] overflow-y-auto">
                    <JourneyHistory />
                  </div>
                </div>
              </motion.div>

              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="absolute inset-0 z-30 bg-black"
              />
            </>
          )}
        </AnimatePresence>

        {/* Main chat area */}
        <section className="absolute inset-0 flex flex-col">
          {/* Top header for small controls */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen((s) => !s)} className="rounded-md p-2 bg-white/5 hover:bg-white/10">
                <Settings className="w-4 h-4 text-white" />
              </button>
              <div className="text-sm font-semibold">Voyager AI</div>
            </div>
            <div className="text-xs text-white/60">{currentUser?.displayName || user?.displayName || 'Guest'}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl">
              {messages.map((msg, index) => (
                <ChatMessage key={index} message={msg} />
              ))}
              {isLoading && (
                <div className="my-4 flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="max-w-xl rounded-2xl rounded-bl-none bg-gray-800 p-4 text-gray-400">
                    Generating your next adventure...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-black/20 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-3xl">
              {stage === 'ask_intent' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Do you have specific places in mind, or just a region?</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setTripField('intent', 'locations'); goNext(); }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">I have specific places</button>
                    <button onClick={() => { setTripField('intent', 'region'); goNext(); }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">I only know a region</button>
                  </div>
                </div>
              )}

              {stage === 'input_locations' && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Add destinations (click suggestion or press Enter)</div>
                  <div className="flex gap-2">
                    <input value={input} onChange={(e) => handleDestinationInputChange(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDestination(input); } }} className="flex-1 rounded-md bg-transparent border border-white/10 px-3 py-2" placeholder="Type a city or place" />
                    <button onClick={() => addDestination(input)} className="rounded-md bg-blue-600 px-3 py-2">Add</button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="mt-2 rounded-md border border-white/10 bg-black/60">
                      {suggestions.map((s) => (
                        <button key={s} onClick={() => addDestination(s)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10">{s}</button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(trip.destinations || []).map((d) => (
                      <div key={d} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                        <span className="text-xs">{d}</span>
                        <button onClick={() => removeDestination(d)} className="text-xs text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={goNext} className="rounded-md bg-blue-600 px-3 py-1">Next</button>
                  </div>
                </div>
              )}

              {stage === 'input_region' && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Which region or area are you interested in?</div>
                  <input value={trip.region || ''} onChange={(e) => setTripField('region', e.target.value)} className="rounded-md bg-transparent border border-white/10 px-3 py-2" placeholder="e.g., Kyoto region" />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={goNext} className="rounded-md bg-blue-600 px-3 py-1">Next</button>
                  </div>
                </div>
              )}

              {stage === 'ask_duration' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">How many days will the trip be?</div>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} value={trip.durationDays || ''} onChange={(e) => setTripField('durationDays', Number(e.target.value))} className="w-24 rounded-md bg-transparent border border-white/10 px-3 py-2" />
                    <label className="text-xs text-white/60"><input type="checkbox" checked={trip.dateFlex === 'start'} onChange={(e) => setTripField('dateFlex', e.target.checked ? 'start' : 'none')} /> Flexible start date</label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={goNext} className="rounded-md bg-blue-600 px-3 py-1">Next</button>
                  </div>
                </div>
              )}

              {stage === 'ask_dates' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Select a start date</div>
                  <div>
                    <DatePicker selected={trip.dateStart ? new Date(trip.dateStart) : startDate} onChange={(date) => { setStartDate(date); setTripField('dateStart', date ? date.toISOString().slice(0,10) : null); }} inline />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={goNext} className="rounded-md bg-blue-600 px-3 py-1">Next</button>
                  </div>
                </div>
              )}

              {stage === 'ask_travelers' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Who's traveling?</div>
                  <div className="flex gap-2">
                    {['Solo Traveler','A Couple','Family','A Group of Friends'].map((label) => (
                      <button key={label} onClick={() => { setTripField('travelers', label); goNext(); }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">{label}</button>
                    ))}
                  </div>
                </div>
              )}

              {stage === 'must_haves' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Anything you absolutely must see or do?</div>
                  <TextareaAutosize value={trip.mustHaves} onChange={(e) => setTripField('mustHaves', e.target.value)} className="rounded-md bg-transparent border border-white/10 p-3" minRows={2} maxRows={6} />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={goNext} className="rounded-md bg-blue-600 px-3 py-1">Next</button>
                  </div>
                </div>
              )}

              {stage === 'must_nots' && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">Anything to avoid?</div>
                  <TextareaAutosize value={trip.mustNots} onChange={(e) => setTripField('mustNots', e.target.value)} className="rounded-md bg-transparent border border-white/10 p-3" minRows={2} maxRows={6} />
                  <div className="mt-3 flex justify-between">
                    <button onClick={goBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
                    <button onClick={handleGenerateItinerary} className="rounded-md bg-green-500 px-3 py-1">Generate Itinerary</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Chatbox;

