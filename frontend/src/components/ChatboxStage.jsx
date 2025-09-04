import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFirebaseIdToken } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebaseClient';
import { signOut } from 'firebase/auth';
import { Search, LogOut, RefreshCw, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Send } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import Avatar from './Avatar.jsx';
import StageInput from './StageInput.jsx';
import { Clock, Utensils, MapPin, Bed, Info, Lightbulb, Bot } from 'lucide-react';

// Render itinerary cards
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

const ChatMessage = ({ message, userName }) => {
  const isUser = message.role === 'user';
  const assistantCls = 'w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/6 backdrop-blur-md border border-white/10 text-white shadow-inner';
  const userCls = 'ml-auto inline-block rounded-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-500 to-indigo-600';

  return (
    <div className={`flex items-start gap-4 my-6 ${isUser ? 'justify-end' : ''}`}>
  {!isUser && <Avatar role={message.role} />}
      <div>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <div className={assistantCls}>
            <ItineraryCards items={message.content} />
          </div>
        ) : isUser ? (
          <div className={userCls}>{message.content}</div>
        ) : (
          <div>
            <div className={assistantCls}>
              <div className="prose prose-invert prose-p:my-0 prose-headings:my-2 break-words">
                <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button title="Regenerate" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button title="Copy" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
  {isUser && <Avatar role={message.role} name={userName} />}
    </div>
  );
};

export default function ChatboxStage({ isSidebarOpen = false, setIsSidebarOpen = () => {} }) {
  const { currentUser } = useAuth();
  const fullNameOrEmail = currentUser?.displayName || currentUser?.email || '';
  const shortName = (() => {
    try {
      const raw = (currentUser?.displayName || '').trim();
      const parts = raw ? raw.split(/\s+/).filter(Boolean) : [];
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`; // first + last
      if (parts.length === 1) return parts[0];
      // fallback to email prefix
      const e = (currentUser?.email || '').split('@')[0];
      return e || 'Guest';
    } catch (e) {
      return (currentUser?.email || 'Guest').split('@')[0];
    }
  })();
  const firstName = (() => {
    const raw = (currentUser?.displayName || currentUser?.email || '').trim();
    if (!raw) return '';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length) return parts[0];
    return raw.split('@')[0] || raw;
  })();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chats, setChats] = useState(() => [{ id: 'default', title: 'New chat', messages: [] }]);
  const searchRef = useRef(null);
  const [activeId, setActiveId] = useState('default');
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Frontend is a dumb renderer; backend provides stage/inputSpec/quickOptions
  const [inputSpec, setInputSpec] = useState({ type: 'freeText' });
  const [quickOptions, setQuickOptions] = useState([]);
  const [flowState, setFlowState] = useState({});
  const [stage, setStage] = useState('greeting');
  const greetedRef = useRef(new Set());
  const lastAssistantStageRef = useRef({});
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isTyping]);

  const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

  const pushMessage = (chatId, role, content) => {
    // Build the normalized message object
    const makeMsg = (role, content) => {
      if (content && typeof content === 'object' && ('text' in content || 'content' in content) && !Array.isArray(content)) {
        const text = content.content || content.text || '';
        return { role, content: text, ...content };
      }
      return { role, content };
    };

    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      const msgs = Array.isArray(c.messages) ? c.messages.slice() : [];
      const newMsg = makeMsg(role, content);
      // Avoid pushing duplicate consecutive messages with same role and similar content.
      const last = msgs[msgs.length - 1];
      if (last && last.role === newMsg.role) {
        const normalize = (s) => String(s || '').replace(/\p{Emoji_Presentation}|\p{Emoji}|[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
        try {
          const a = normalize(last.content);
          const b = normalize(newMsg.content);
          if (a && b && a === b) return c; // skip if normalized content matches
        } catch (e) {
          // fallback simple compare
          if (String(last.content) === String(newMsg.content)) return c;
        }
      }
      // Avoid adding duplicate assistant replies for the same stage: track stage info attached to assistant messages
      if (role === 'assistant') {
        try {
          const lastStage = lastAssistantStageRef.current[chatId];
          const newStage = newMsg?.inputSpec?.stage || newMsg?.stage || newMsg?.stageNext || undefined;
          if (lastStage && newStage && lastStage === newStage) {
            return c; // skip duplicate assistant reply for same stage
          }
          // record the stage for this assistant message
          if (newStage) lastAssistantStageRef.current[chatId] = newStage;
        } catch (e) {}
      }
      msgs.push(newMsg);
      return { ...c, messages: msgs };
    }));
  };

  async function sendMessage(text = '', stageOverride = undefined) {
    const chatId = activeId;
    const msg = (text || input).trim();
    if (!msg && !stageOverride) return;
    // Only push a user message if there is non-empty text (avoid empty placeholders when using stage overrides)
    if (msg) pushMessage(chatId, 'user', msg);
    setInput('');
    setIsTyping(true);

    try {
      const token = await getFirebaseIdToken();
      // Determine the stage to send: prefer explicit override, otherwise use component state.
      const stageToSend = stageOverride || stage;

      const payload = {
        mode: 'chat',
        message: msg,
        stage: stageToSend,
        user: currentUser ? { uid: currentUser.uid, displayName: firstName } : null,
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

      // --- DIAGNOSTIC LOGS START ---
      console.log('Raw response from server:', res);
      // --- DIAGNOSTIC LOGS END ---

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server responded with ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      
      // --- DIAGNOSTIC LOGS START ---
      console.log('Parsed JSON data:', data);
      console.log('State before update:', { flowState, inputSpec, stage });
      console.log('Data to be set:', { input: data.input, quickOptions: data.quickOptions, state: data.state, stageNext: data.stageNext });
      // --- DIAGNOSTIC LOGS END ---


      const reply = data?.reply || data?.message || '...';
      // Include backend metadata in the assistant message so the UI can render accordingly
      const assistantMsg = { content: reply };
      if (Array.isArray(data?.suggestions) && data.suggestions.length) assistantMsg.suggestions = data.suggestions;
      if (data?.input) assistantMsg.inputSpec = data.input;
      if (data?.stageNext) assistantMsg.stageNext = data.stageNext;
      if (data?.hints) assistantMsg.hints = data.hints;

      pushMessage(chatId, 'assistant', assistantMsg);

      // Update UI controls from backend response
      if (data?.input) setInputSpec(data.input);
      if (Array.isArray(data?.quickOptions)) setQuickOptions(data.quickOptions);
      if (data?.state) setFlowState(data.state);
      if (data?.stageNext) setStage(data.stageNext); // <-- THE FIX
      return data;
    } catch (err) {
      console.error('chat send error', err);
      pushMessage(chatId, 'assistant', `Sorry — I couldn't reach the server: ${String(err?.message || err)}`);
    } finally {
      setIsTyping(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      // Only send the greeting once when a new chat is opened and it has no messages.
      // Avoid auto-sending the follow-up stage to prevent duplicate assistant phrasing.
      if (activeChat?.messages?.length === 0 && !greetedRef.current.has(activeId)) {
        greetedRef.current.add(activeId);
        await sendMessage('', 'greeting');
      }
    })();
    return () => { mounted = false; };
  }, [activeId]);

  // When user clicks a quick option, send it as a message. The `sendMessage` function will use the current stage from state.
  const handleQuick = (opt) => sendMessage(opt);
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const newChat = () => {
    const id = Math.random().toString(36).slice(2, 9);
    const c = { id, title: 'New chat', messages: [] };
    setChats((p) => [c, ...p]);
    setActiveId(id);
  setFlowState({});
  setQuickOptions([]);
  setInputSpec({ type: 'freeText' });
  setStage('greeting');
  // Request greeting from backend for this new chat
  setTimeout(() => { sendMessage('', 'greeting'); }, 50);
  };

  // Load saved chats & search from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('voyager_chats');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setChats(parsed);
      }
      const s = localStorage.getItem('voyager_search');
      if (s) setSearch(s);
    } catch (e) {
      console.warn('Failed to load local state', e);
    }
  }, []);

  // Persist chats and search to localStorage
  useEffect(() => {
    try { localStorage.setItem('voyager_chats', JSON.stringify(chats)); } catch (e) { /* ignore */ }
  }, [chats]);
  useEffect(() => { try { localStorage.setItem('voyager_search', search); } catch (e) {} }, [search]);

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-screen w-full text-white bg-transparent">
      <div className="flex min-h-0">
        {/* Sidebar: full-height column */}
        <aside className={`w-80 border-r border-white/8 bg-gradient-to-b from-black/30 to-black/20 backdrop-blur-xl p-6 flex flex-col items-center min-h-0`} style={{ height: '100vh' }}>
          {/* Centered logo block */}
          <div className="flex flex-col items-center mb-4">
            <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-white/3 p-3">
              <img src="/logo.png" alt="Voyager" className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">Voyager.ai</div>
            <div className="mt-1 text-sm text-white/70">Welcome, {(currentUser?.displayName || currentUser?.email || 'Guest').split(' ')[0]}</div>
          </div>

          {/* Search toggle/button */}
          <div className="w-full mb-4">
            {!searchOpen ? (
              <button onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 60); }} className="w-full text-left rounded-lg bg-black/40 px-3 py-2 text-sm text-white/80 hover:bg-black/50">🔎 Search chats</button>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1">
                <Search className="w-4 h-4 text-white/70" />
                <input ref={searchRef} placeholder="Search chats" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent outline-none text-sm text-white/80 w-full" />
                <button onClick={() => { setSearch(''); setSearchOpen(false); }} className="text-white/60">✕</button>
              </div>
            )}
          </div>

          <div className="w-full mb-4">
            <button onClick={newChat} className="w-full text-left rounded-lg bg-gradient-to-r from-[#16a34a] to-[#10b981] px-4 py-2 text-sm font-semibold text-black shadow-sm">+ New Journey</button>
          </div>

          <div className="w-full border-t border-white/6 pt-3 mt-2 space-y-2 overflow-y-auto flex-1 min-h-0">
            {(() => {
              const q = search.trim().toLowerCase();
              const visible = q ? chats.filter((c) => (c.title || '').toLowerCase().includes(q)) : chats;
              return visible.map((c) => (
                <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.id === activeId ? 'bg-white/6 text-white' : 'text-white/70 hover:bg-white/3'}`} onClick={() => setActiveId(c.id)}>{c.title}</div>
              ));
            })()}
          </div>

          {/* Profile / Logout at bottom */}
          <div className="w-full mt-4 pt-3 border-t border-white/6 flex items-center gap-3">
            <div className="flex items-center gap-3">
              <Avatar role="user" name={currentUser?.displayName || currentUser?.email || ''} size={44} />
              <div className="text-sm">
                <div className="font-medium">{shortName}</div>
                <div className="text-xs text-white/60">{currentUser ? 'Member' : 'Not signed in'}</div>
              </div>
            </div>
            <div className="ml-auto">
              {currentUser ? (
                <button onClick={() => { try { signOut(auth); } catch (e) { console.error(e); } }} className="rounded-md p-2 bg-white/5 hover:bg-white/10">
                  <LogOut className="w-4 h-4 text-white" />
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main chat area: full-height flex column so input stays at bottom */}
        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0" style={{ height: '100vh' }}>
          <div
            className="flex-1 overflow-y-auto p-8 min-h-0"
            style={{
              // very subtle starlight-style highlight: faint radial dots and inset glow
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '220px 220px',
              boxShadow: 'inset 0 0 40px rgba(255,255,255,0.01)'
            }}
          >
            <div className="mx-auto max-w-3xl pt-2">
              {activeChat?.messages?.map((m, i) => (
                <div key={i}>
                  <ChatMessage message={m} userName={fullNameOrEmail} />
                </div>
              ))}

              {isTyping && (
                <div className="my-4 flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/6 backdrop-blur-md border border-white/10 text-white">Thinking…</div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Server-driven stage input */}
          {/* StageInput was moved into the composer area below so it can replace the text input */}

          {/* Composer pinned to bottom inside the main column */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pointer-events-none" style={{ paddingBottom: '8px' }}>
            <div className="pointer-events-auto max-w-3xl w-full px-4">
              <AnimatePresence mode="wait">
                {inputSpec && (inputSpec.type === 'options' || inputSpec.type === 'multiselect' || inputSpec.type === 'dates' || inputSpec.type === 'days') ? (
                  <motion.div key="options-panel" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.18 }}>
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <StageInput
                        inputSpec={inputSpec}
                        quickOptions={quickOptions}
                        flowState={flowState}
                        setFlowState={(s) => setFlowState(s)}
                        onSubmit={async (value) => {
                          let parsed = value;
                          try { parsed = JSON.parse(value); } catch (e) { parsed = value; }
                          if (typeof parsed === 'object' && parsed !== null) {
                            setFlowState((prev) => ({ ...prev, ...parsed }));
                          }
                          // The sendMessage function will correctly use the component's stage state.
                          // No need to pass it as an override or make a second call.
                          await sendMessage(typeof value === 'string' ? value : JSON.stringify(value));
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="text-input" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.18 }}>
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3 flex items-center gap-3" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <TextareaAutosize value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKey} minRows={1} maxRows={6} placeholder="Type your message..." className="w-full resize-none bg-transparent py-3 pl-4 pr-24 text-gray-200 placeholder-gray-400 outline-none text-sm" />
                      <button onClick={() => sendMessage()} disabled={isTyping || !input.trim()} className="ml-auto rounded-full bg-[#19c37d] px-4 py-2 text-black font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Send size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}