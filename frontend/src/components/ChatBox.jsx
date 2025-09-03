import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const [flowState, setFlowState] = useState({}); // persistent state from backend
  const [inputSpec, setInputSpec] = useState(null); // backend input instructions
  const [serverStage, setServerStage] = useState(null);

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

  // The frontend no longer tracks local stages; backend is the source of truth.
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

  // NOTE: initial assistant greeting is requested from the backend (see the effect below)

  // Initial greeting effect: trigger backend 'greeting' when there are no messages
  useEffect(() => {
    if (messages.length === 0 && !isLoading && currentUser) {
      // Request the backend to produce the initial greeting.
      send('', {}, 'greeting');
    }
  }, [messages.length, isLoading, currentUser, send]);

  // Helper: push a message to messages state but avoid duplicate consecutive messages
  function pushMessage(role, content) {
    setMessages((prev) => {
      const msgs = Array.isArray(prev) ? prev.slice() : [];
      const last = msgs[msgs.length - 1];
      if (last && last.role === role && String(last.content) === String(content)) return msgs;
      msgs.push({ role, content });
      return msgs;
    });
  }
  // Backend call helper (returns parsed JSON or text-wrapped object)
  async function callBackendChat(payload) {
    const token = idToken ?? await getFirebaseIdToken();
    const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to get chat response');
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    // If server returned markdown/plain text, return as { reply: text }
    const text = await res.text();
    return { reply: text };
  }

  // Derive currentChatStage from last assistant message's inputSpec.stage or default to 'greeting'
  const currentChatStage = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? (messages[messages.length - 1].inputSpec?.stage || 'greeting')
    : 'greeting';

  // The central 'send' function for all user interactions (backup-adapted)
  const send = useCallback(async (text, stateDelta = {}, stageOverride = null) => {
    if (isLoading || (!text && !stageOverride)) return;

    setIsLoading(true);

    const userMessage = text ? { role: 'user', content: text, timestamp: new Date().toISOString() } : null;
    if (userMessage) setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const payload = {
        message: text || '',
        stage: stageOverride || currentChatStage,
        user: currentUser ? { uid: currentUser.uid, displayName: currentUser.displayName } : null,
        state: { ...flowState, ...stateDelta },
      };

      const aiResponse = await callBackendChat(payload);

      // Update flowState and inputSpec from backend
      setFlowState(aiResponse.state || {});
  setInputSpec(aiResponse.input || aiResponse.inputSpec || null);
  // Trust backend-provided next stage
  if (aiResponse.stageNext) setServerStage(aiResponse.stageNext);

      const aiFullMessage = {
        role: 'assistant',
        content: aiResponse.reply || aiResponse.message || aiResponse,
        timestamp: new Date().toISOString(),
        inputSpec: aiResponse.input || aiResponse.inputSpec || null,
        hints: aiResponse.hints,
      };
      setMessages((prev) => [...prev, aiFullMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Oops! Something went wrong. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentUser, flowState, currentChatStage]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Local navigation removed. Backend controls stage transitions.

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

  pushMessage('assistant', assistantContent || 'No response');
    } catch (e) {
      console.error('itinerary generation failed', e);
  pushMessage('assistant', `Failed to generate itinerary: ${e.message}`);
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

  // Duration helpers: increment, decrement, and preset setter
  function incrementDuration() {
    setTrip((t) => ({ ...t, durationDays: Math.max(1, (Number(t.durationDays) || 0) + 1) }));
  }
  function decrementDuration() {
    setTrip((t) => ({ ...t, durationDays: Math.max(1, (Number(t.durationDays) || 1) - 1) }));
  }
  function setDurationPreset(n) {
    setTripField('durationDays', n);
  }

  const handleConfirmDate = () => {
    if (!startDate) return;
    const iso = startDate.toISOString().slice(0, 10); // yyyy-mm-dd
    setTripField('dateStart', iso);
    // Inform backend of the date selection; backend will respond with the next prompt.
    send(iso, { startDate: iso }, serverStage || currentChatStage);
  };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If backend expects locations input (legacy name) or serverStage indicates input_locations, treat Enter as addDestination
      if ((inputSpec && inputSpec.type === 'locations') || serverStage === 'input_locations') {
        addDestination(input);
      } else {
        // otherwise send as normal chat message
        send(input, {}, serverStage || currentChatStage);
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
                    <button onClick={async () => {
                      // Reset local UI state and request a fresh greeting from backend
                      setMessages([]);
                      setFlowIndex(0);
                      setTripAnswers({});
                      setInput('');
                      setCurrentSelections([]);
                      await send('', {}, 'greeting');
                    }} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20">New</button>
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

          {/* Composer (server-driven) */}
          <div className="border-t border-white/10 bg-black/20 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-3xl">
              {inputSpec && inputSpec.type === 'options' ? (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">{inputSpec.prompt || 'Choose an option'}</div>
                  <div className="flex flex-wrap gap-2">
                    {(inputSpec.options || []).map((opt) => (
                      <button key={opt.value ?? opt} onClick={async () => { try { await send(opt.value ?? opt, {}, serverStage || currentChatStage); } catch (e) {} }} className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-sm">{opt.label ?? opt}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-full bg-white/5 backdrop-blur-md p-3">
                  <TextareaAutosize value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, {}, serverStage || currentChatStage); } }} minRows={1} maxRows={6} placeholder={inputSpec?.placeholder || 'Type your message...'} className="w-full resize-none bg-transparent py-3 pl-4 pr-24 text-gray-200 placeholder-gray-400 outline-none text-sm" />
                  <button onClick={() => send(input, {}, serverStage || currentChatStage)} disabled={!input.trim()} className="ml-auto rounded-full bg-[#19c37d] px-4 py-2 text-black font-semibold">Send</button>
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

