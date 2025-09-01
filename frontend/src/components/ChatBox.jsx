import React, { useState, useEffect, useRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { getFirebaseIdToken, db } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';
import ReactMarkdown from 'react-markdown';
import { Settings, Send, Bot, User, CornerDownLeft, Clock, Utensils, MapPin, Bed, Info, Lightbulb } from 'lucide-react';

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
  const Icon = isUser ? User : Bot;

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
      <div className={`max-w-xl p-4 rounded-2xl ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <ItineraryCards items={message.content} />
        ) : (
          <div className="prose prose-invert prose-p:my-0 prose-headings:my-2">
            <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
          </div>
        )}
      </div>
       {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
  );
};

// Main Chatbox Component
const Chatbox = ({ onEditProfile, user }) => {
  const { currentUser } = useAuth();
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

  // Build dynamic chat flow: core trip questions + skipped DNA
  const coreTripQuestions = useMemo(() => [
    { key: 'destination', title: 'Where would you like to go?' },
    { key: 'dates', title: 'When are you planning to travel?' },
  ], []);

  const chatFlow = useMemo(() => {
    const dnaQs = skippedQuestions.map(q => ({ key: q.key, title: q.title, options: q.options, fromDNA: true, isMultiSelect: q.isMultiSelect, maxSelections: q.maxSelections }));
    return [...coreTripQuestions, ...dnaQs];
  }, [coreTripQuestions, skippedQuestions]);

  useEffect(() => {
    // Initial welcome plus first dynamic question
    const first = chatFlow[0];
    const welcome = `Welcome, ${user?.displayName || 'Traveler'}!`;
    const qLine = first ? ` ${first.title}` : " Where would you like to go first?";
    setMessages([{ role: 'assistant', content: `${welcome}${qLine}` }]);
    setFlowIndex(0);
    setTripAnswers({});
  setCurrentSelections([]);
  }, [user, chatFlow.length]);

  useEffect(() => {
    // Auto-scroll to the latest message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function updateProfileInBackground(dataToSave) {
    try {
      if (!dataToSave || typeof dataToSave !== 'object' || Object.keys(dataToSave).length === 0) return;
      if (!currentUser || !db) return;
      const ref = doc(db, 'users', currentUser.uid);
      await setDoc(ref, { travelProfile: dataToSave }, { merge: true });
    } catch (e) {
      // Silent failure; do not interrupt chat UX
      console.warn('Background profile update failed', e?.message || e);
    }
  }

  const handleSendMessage = async (textOverride, structuredArray) => {
    const messageText = (textOverride ?? input).trim();
    if (!messageText || isLoading) return;

    const step = chatFlow[flowIndex];
    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);

    // Capture structured answer for known steps
    if (step) {
      setTripAnswers(prev => ({ ...prev, [step.key]: structuredArray ?? messageText }));
    }

  if (textOverride === undefined) setInput('');

    // If there is a next question in the flow, ask it; otherwise, generate itinerary
    const hasNext = flowIndex + 1 < chatFlow.length;
    if (hasNext) {
      const nextIndex = flowIndex + 1;
      const nextQ = chatFlow[nextIndex];
      setFlowIndex(nextIndex);
      setMessages(prev => [...prev, { role: 'assistant', content: nextQ.title }]);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Authentication token not found.');

      const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
      const masterPromptContext = {
        travelProfile: travelProfile || {},
        trip: tripAnswers,
  freeform: messageText,
      };
      const response = await fetch(`${base}/api/generate-itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: masterPromptContext }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get a response from the server.');
      }

      const data = await response.json();
      const content = Array.isArray(data?.itinerary) ? data.itinerary : (data?.itinerary || data);
      const assistantMessage = Array.isArray(content)
        ? { role: 'assistant', type: 'itinerary-json', content }
        : { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) };
      setMessages(prev => [...prev, assistantMessage]);

      // Persist newly answered DNA fields (keys that were skipped)
      try {
        const skippedKeys = new Set(skippedQuestions.map(q => q.key));
        const newDnaAnswers = Object.fromEntries(
          Object.entries(tripAnswers).filter(([k, v]) => skippedKeys.has(k) && (Array.isArray(v) ? v.length > 0 : String(v || '').trim().length > 0))
        );
        // Update in background; do not await
        updateProfileInBackground(newDnaAnswers);
      } catch {}
    } catch (error) {
      console.error('API call failed:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I ran into a problem: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = chatFlow[flowIndex];

  const handleQuickReply = (replyText) => {
    // Programmatically submit the reply as the user's answer
    handleSendMessage(replyText);
  };

  const handleMultiSelect = (option) => {
    if (!currentQuestion?.isMultiSelect) return;
    setCurrentSelections((prev) => {
      const exists = prev.includes(option);
      if (exists) return prev.filter((o) => o !== option);
      const max = currentQuestion.maxSelections || 3;
      if (prev.length >= max) return prev; // ignore extra
      return [...prev, option];
    });
  };

  const handleConfirmSelections = () => {
    if (!currentQuestion?.isMultiSelect) return;
    if (!currentSelections || currentSelections.length === 0) return;
    const joined = currentSelections.join(', ');
    // Pass structured array so tripAnswers stores list instead of string
    handleSendMessage(joined, currentSelections);
    setCurrentSelections([]);
  };

  // Destination suggestions
  const handleDestinationInputChange = async (val) => {
    setInput(val);
    if (!val || val.trim().length < 3) { setSuggestions([]); return; }
    try {
      const token = await getFirebaseIdToken();
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
    handleSendMessage(city);
  };

  const handleConfirmDate = () => {
    if (!startDate) return;
    const iso = startDate.toISOString().slice(0, 10); // yyyy-mm-dd
    handleSendMessage(iso);
  };
    
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-md bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
             <Bot className="w-5 h-5 text-white"/>
          </div>
          <h1 className="text-xl font-bold">Voyager AI</h1>
        </div>
        <div className="flex items-center gap-4">
           <p className="text-sm text-gray-400">Welcome, {user?.displayName || user?.email}</p>
          <button onClick={onEditProfile} className="text-gray-400 hover:text-white transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Message List */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}
           {isLoading && (
            <div className="flex items-start gap-4 my-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
                 <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="max-w-xl p-4 rounded-2xl bg-gray-800 text-gray-400 rounded-bl-none">
                Generating your next adventure...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-shrink-0 p-4">
        {currentQuestion?.options && !currentQuestion.isMultiSelect && (
          <div className="max-w-4xl mx-auto mb-2 flex flex-wrap gap-2">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleQuickReply(opt)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {currentQuestion?.options && currentQuestion.isMultiSelect && (
          <div className="max-w-4xl mx-auto mb-2">
            <div className="flex flex-wrap gap-2">
              {currentQuestion.options.map((opt) => {
                const selected = currentSelections.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => handleMultiSelect(opt)}
                    className={`rounded-full border px-3 py-1 text-xs ${selected ? 'border-white bg-white text-black' : 'border-white/20 bg-white/10 hover:bg-white/20'}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>Selected {currentSelections.length}{currentQuestion.maxSelections ? `/${currentQuestion.maxSelections}` : ''}</span>
              <button
                onClick={handleConfirmSelections}
                disabled={currentSelections.length === 0}
                className="rounded-md border border-white/20 bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-1 disabled:opacity-50"
              >
                Confirm Selections
              </button>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto p-2 rounded-2xl border border-white/10 backdrop-blur-lg bg-black/30 focus-within:border-blue-500 transition-all">
          <div className="relative">
            {currentQuestion?.key === 'dates' ? (
              <div className="px-2 py-2">
                <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} inline />
                <div className="mt-2 flex justify-end">
                  <button onClick={handleConfirmDate} className="rounded-md border border-white/20 bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-1 text-xs">Confirm Date</button>
                </div>
              </div>
            ) : (
              <div>
                <textarea
                  value={input}
                  onChange={(e) => currentQuestion?.key === 'destination' ? handleDestinationInputChange(e.target.value) : setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., 'A 5-day cultural trip to Kyoto'"
                  className="w-full bg-transparent text-gray-200 placeholder-gray-500 resize-none outline-none pl-4 pr-16 py-3"
                  rows={1}
                />
                {currentQuestion?.key === 'destination' && suggestions.length > 0 && (
                  <div className="mx-2 -mt-2 mb-2 rounded-md border border-white/10 bg-black/60 backdrop-blur">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => handleSelectDestination(s)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!input.trim() && currentQuestion?.key !== 'dates')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
         <p className="text-xs text-center text-gray-500 mt-2">
          Press Shift + <CornerDownLeft size={10} className="inline-block"/> for a new line.
        </p>
      </footer>
    </div>
  );
};

export default Chatbox;

