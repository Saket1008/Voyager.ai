import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirebaseIdToken } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User } from 'lucide-react';

// Simple message bubble
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
        <div className="prose prose-invert prose-p:my-0 prose-headings:my-2">
          <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
  );
};

export default function ChatboxStage() {
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
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="w-72 flex-shrink-0 border-r border-white/10 bg-black/20 backdrop-blur-md">
          <div className="h-full p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/80">Chats</div>
              <button onClick={newChat} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/20">New</button>
            </div>
            <div className="h-[calc(100%-2rem)] overflow-y-auto">
              {chats.map((c) => (
                <div key={c.id} onClick={() => setActiveId(c.id)} className={`cursor-pointer mb-2 p-2 rounded-md ${c.id === activeId ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/5`}>
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-xs text-white/50">{c.messages.length ? `${c.messages.length} messages` : 'No messages'}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col">
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
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKey} placeholder="Ask me about your trip..." className="w-full resize-none bg-transparent py-3 pl-4 pr-16 text-gray-200 placeholder-gray-500 outline-none" rows={1} />
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
