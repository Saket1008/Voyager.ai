import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFirebaseIdToken } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';
import ReactMarkdown from 'react-markdown';
import { Send } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import Avatar from './Avatar.jsx';
import { Clock, Utensils, MapPin, Bed, Info, Lightbulb, Bot } from 'lucide-react';

// Render itinerary cards (same as Chatbox version)
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

// Simple message bubble
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

export default function ChatboxStage({ isSidebarOpen = false, setIsSidebarOpen = () => {} }) {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState(() => [{ id: 'default', title: 'New chat', messages: [] }]);
  const [activeId, setActiveId] = useState('default');
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState('greeting');
  const [inputSpec, setInputSpec] = useState({ type: 'freeText' });
  const [quickOptions, setQuickOptions] = useState([]);
  const [flowState, setFlowState] = useState({});
  const endRef = useRef(null);

  useEffect(() => {
    // auto-scroll
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isTyping]);

  const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

  const pushMessage = (chatId, role, content) => {
    setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, { role, content }] } : c));
  };

  async function sendMessage(text = '', stageOverride = undefined) {
    const chatId = activeId;
    const msg = (text || input).trim();
    if (!msg && !text) return;
    // append user message
    pushMessage(chatId, 'user', msg);
    setInput('');
    setIsTyping(true);

    try {
      const token = await getFirebaseIdToken();
      const payload = {
        mode: 'chat',
        message: msg,
        stage: stageOverride || stage,
        user: currentUser ? { uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email } : null,
        state: flowState,
      };
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // server returns { reply, stageNext, input, quickOptions }
      const reply = data?.reply || data?.message || '...';
      pushMessage(chatId, 'assistant', reply);

      // update stage & inputSpec
      if (data?.stageNext) setStage(data.stageNext);
      if (data?.input) setInputSpec(data.input);
      if (Array.isArray(data?.quickOptions)) setQuickOptions(data.quickOptions);

      // update state if server returned an updated state
      if (data?.state) setFlowState(data.state);
    } catch (err) {
      console.error('chat send error', err);
      pushMessage(chatId, 'assistant', `Sorry — I couldn't reach the server: ${String(err?.message || err)}`);
    } finally {
      setIsTyping(false);
    }
  }

  // start greeting when first mounted
  useEffect(() => {
    if (activeChat?.messages?.length === 0) {
      // trigger greeting from server without user message
      sendMessage('', 'greeting');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const handleQuick = (opt) => {
    // if input type expects options, send directly
    sendMessage(opt);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const newChat = () => {
    const id = Math.random().toString(36).slice(2, 9);
    const c = { id, title: 'New chat', messages: [] };
    setChats((p) => [c, ...p]);
    setActiveId(id);
    setStage('greeting');
    setFlowState({});
    setQuickOptions([]);
    setInputSpec({ type: 'freeText' });
  };

  return (
    <div className="text-white">
      <div className="relative h-[calc(100vh-4rem)]">
        {/* Slide-out JourneyHistory */}
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
                    <button onClick={newChat} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20">New</button>
                  </div>
                  <div className="h-[calc(100%-2rem)] overflow-y-auto">
                    <div className="p-2 text-sm text-white/60">Loading…</div>
                  </div>
                </div>
              </motion.div>

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

        <section className="absolute inset-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl">
              {activeChat?.messages?.map((m, i) => (
                <ChatMessage key={i} message={m} />
              ))}
              {isTyping && (
                <div className="my-4 flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="max-w-xl rounded-2xl rounded-bl-none bg-gray-800 p-4 text-gray-400">Thinking…</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/20 p-4 backdrop-blur-md">
            {quickOptions.length > 0 && (
              <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
                {quickOptions.map((q) => (
                  <button key={q} onClick={() => handleQuick(q)} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs hover:bg-white/20">{q}</button>
                ))}
              </div>
            )}

            <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-lg transition-all focus-within:border-blue-500">
              <div className="relative">
                <TextareaAutosize value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKey} minRows={1} maxRows={6} placeholder="Ask me about your trip..." className="w-full resize-none bg-transparent py-3 pl-4 pr-16 text-gray-200 placeholder-gray-500 outline-none" />
                <button onClick={() => sendMessage()} disabled={isTyping || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 p-2 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600">
                  <Send size={18} />
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">Press Shift + Enter for a new line.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
