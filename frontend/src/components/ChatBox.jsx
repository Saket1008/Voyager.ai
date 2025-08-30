import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import {
  Menu,
  Plus,
  Settings,
  Send,
  Copy,
  MoreVertical,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";

export default function Chatbox() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const makeChat = (title = "New chat") => ({
    id: cryptoRandomId(),
    title,
    messages: [
      {
        id: cryptoRandomId(),
        role: "assistant",
        text:
          "Hello! I'm your Voyager.AI assistant. Ready to help you plan your next adventure? Where would you like to explore today?\n\nYou can:\n• Type a message to chat\n• Use `/itinerary [prompt]` for quick itinerary generation",
      },
    ],
    createdAt: Date.now(),
  });
  const [chats, setChats] = useState([makeChat("Welcome")] );
  const [activeId, setActiveId] = useState(chats[0].id);
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);
  const streamBufferRef = useRef("");
  const endRef = useRef(null);
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [activeChat?.messages.length, isTyping]);

  function newChat() {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setInput("");
  }
  function deleteChat(id) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId && chats.length > 1) {
      const next = chats.find((c) => c.id !== id);
      if (next) setActiveId(next.id);
    }
  }
  function pushMessage(role, text) {
    setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, { id: cryptoRandomId(), role, text }] } : c)));
    // ensure scroll after DOM updates
    setTimeout(() => scrollToBottom(), 0);
  }
  async function send() {
    const content = input.trim();
    if (!content || !activeChat) return;
    pushMessage("user", content);
    setInput("");
    // Send to backend chat
    try {
      setIsTyping(true);
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ mode: "chat", message: content }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = typeof data === "string" ? data : data.reply || data.message || JSON.stringify(data, null, 2);
      pushMessage("assistant", reply);
    } catch (err) {
      simulateStreamReply(content);
    } finally {
      setIsTyping(false);
    }
  }
  function stopGenerating() {
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamBufferRef.current) { pushMessage("assistant", streamBufferRef.current); streamBufferRef.current = ""; }
    setIsTyping(false);
  }
  function simulateStreamReply(prompt) {
    stopGenerating(); setIsTyping(true); const reply = generateAssistantText(prompt); streamBufferRef.current = ""; let i = 0;
    intervalRef.current = window.setInterval(() => {
      streamBufferRef.current += reply[i];
      i++;
      setTick((t) => (t + 1) % 1000);
      if (i >= reply.length) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        pushMessage("assistant", streamBufferRef.current);
        streamBufferRef.current = "";
        setIsTyping(false);
      }
    }, 18);
  }

  useEffect(() => { scrollToBottom(); }, [tick]);

  function MessageBubble({ m }) {
    const isUser = m.role === "user";
    return (
      <div className={`group relative w-fit max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm ${isUser ? "ml-auto bg-[#1f6feb] text-white" : "bg-black/60 backdrop-blur-sm border border-white/20 text-white"}`}>
        <div className="whitespace-pre-wrap">{m.text}</div>
        {!isUser && (
          <div className="absolute -right-10 top-1/2 hidden -translate-y-1/2 items-center gap-2 group-hover:flex">
            <IconButton onClick={() => copy(m.text)} ariaLabel="Copy"><Copy size={14} /></IconButton>
            <IconButton onClick={() => {}} ariaLabel="More options"><MoreVertical size={14} /></IconButton>
          </div>
        )}
        {!isUser && (
          <div className="mt-2 flex gap-2">
            <SmallButton onClick={() => simulateStreamReply(m.text)} icon={<RefreshCw size={12} />}>Regenerate</SmallButton>
            {isTyping ? (<SmallButton onClick={stopGenerating} icon={<Square size={12} />}>Stop generating</SmallButton>) : null}
          </div>
        )}
      </div>
    );
  }
  function StreamingBubble() {
    if (!isTyping || !activeChat) return null;
    return (
      <div className="w-fit max-w-[85%] rounded-xl px-4 py-3 text-sm bg-black/60 backdrop-blur-sm border border-white/20 text-white shadow-sm">
        <div className="min-h-[1lh] whitespace-pre-wrap">{streamBufferRef.current || "Typing…"}</div>
        <div className="mt-2 flex gap-2">
          <SmallButton onClick={() => simulateStreamReply("repeat last")} icon={<RefreshCw size={12} />}>Regenerate</SmallButton>
          <SmallButton onClick={stopGenerating} icon={<Square size={12} />}>Stop generating</SmallButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full select-none text-white bg-black/30 backdrop-blur-xl">
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} hidden md:flex h-full flex-col overflow-hidden border-r border-white/20 bg-black/30/70 backdrop-blur-xl transition-[width] duration-300`}>
        <div className="p-3 border-b border-white/20 flex items-center justify-between">
          <button className="w-full rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm px-3 py-2 text-sm text-white hover:bg-black/80 transition-colors" onClick={newChat}>+ New Journey</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {chats.map((c) => (
            <div key={c.id} className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer ${c.id === activeId ? "bg-white/10" : "hover:bg-white/10"}`} onClick={() => setActiveId(c.id)}>
              <div className="truncate text-white" title={c.title}>{c.title}</div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <IconButton onClick={() => deleteChat(c.id)} ariaLabel="Delete chat"><Trash2 size={14} /></IconButton>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex h-full flex-1 flex-col bg-black/30 backdrop-blur-xl">
        <header className="sticky top-0 z-10 border-b border-white/20 bg-black/60 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3">
            <IconButton onClick={() => setSidebarOpen((s) => !s)} ariaLabel="Toggle sidebar" className="md:opacity-100"><Menu size={18} /></IconButton>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white">Voyager.AI</div>
            <div className="ml-auto flex items-center gap-3 text-sm text-white/80">
              {isSignedIn && user ? (
                <span className="hidden md:inline">Welcome, {user.firstName || user.username || "Explorer"}</span>
              ) : null}
              <IconButton onClick={newChat} ariaLabel="New chat"><Plus size={18} /></IconButton>
              <IconButton onClick={() => {}} ariaLabel="Settings"><Settings size={18} /></IconButton>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {activeChat.messages.map((m) => (<MessageBubble key={m.id} m={m} />))}
            <StreamingBubble />
            <div ref={endRef} />
          </div>
          <div className="sticky bottom-3 z-10">
            <div className="rounded-xl border border-white/20 bg-black/60 backdrop-blur-sm p-2 shadow-lg">
              <textarea rows={1} placeholder="Ask me about your next adventure..." className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-gray-400" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <div className="flex items-center justify-between px-2">
                <div className="text-[11px] text-gray-400">Enter to send • Shift+Enter for newline</div>
                <button onClick={send} className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white hover:brightness-105 active:translate-y-[1px]"><div className="flex items-center gap-1"><Send size={14} /> Send</div></button>
              </div>
            </div>
          </div>
        </main>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }`}</style>
    </div>
  );
}

function IconButton({ children, onClick, ariaLabel, className = "" }) { return (<button aria-label={ariaLabel} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm hover:bg-black/80 active:translate-y-[1px] text-white ${className}`}>{children}</button>); }
function SmallButton({ children, onClick, icon }) { return (<button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs text-white hover:bg-black/80 transition-colors">{icon}{children}</button>); }
function copy(text) { if (navigator?.clipboard?.writeText) { navigator.clipboard.writeText(text); } else { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); } }
function cryptoRandomId() { if (typeof crypto !== "undefined" && crypto.randomUUID) { return crypto.randomUUID(); } return Math.random().toString(36).slice(2); }
function generateAssistantText(prompt) { const responses = [
  `I'm excited to help you plan your journey! Based on your request: "${prompt}", I can create a personalized itinerary that maximizes your experience. Would you like me to include specific preferences for activities, budget range, or accommodation style?`,
  `Perfect! Let me craft an incredible adventure for you. I'll consider optimal routes, timing, and unique experiences that align with your interests. This will be an unforgettable journey!`,
  `I'm processing your request and will provide you with a detailed itinerary shortly. I'll include recommendations for must-see destinations, hidden gems, and practical travel tips to make your trip seamless.`,
  `Based on your preferences, I can suggest some amazing destinations and experiences. Let me create a comprehensive plan that balances adventure, relaxation, and cultural immersion.`,
  `I'd love to help you explore new horizons! Your request sounds fantastic, and I'll make sure to include all the details you need for a perfect journey.`,
]; return responses[Math.floor(Math.random() * responses.length)]; }