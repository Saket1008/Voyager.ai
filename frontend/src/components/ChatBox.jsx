import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import ChatWizard from "./ChatWizard";
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

export default function ChatGPTClone() {
  const { getToken, isSignedIn } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const makeChat = (title = "New chat") => ({
    id: cryptoRandomId(),
    title,
    messages: [
      {
        id: cryptoRandomId(),
        role: "assistant",
        text: "Hello! I'm your Voyager.AI assistant. Ready to help you plan your next cosmic adventure? Where would you like to explore today?\n\nYou can:\n• Type a message to chat\n• Use `/itinerary [prompt]` for quick itinerary generation\n• Use `/wizard` for guided itinerary planning",
      },
    ],
    createdAt: Date.now(),
  });
  const [chats, setChats] = useState([makeChat("Welcome")]);
  const [activeId, setActiveId] = useState(chats[0].id);
  const [wizardActive, setWizardActive] = useState(false);
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeId),
    [chats, activeId]
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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
  function renameActive(title) {
    setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, title } : c)));
  }
  function pushMessage(role, text) {
    setChats((prev) => prev.map((c) => c.id === activeId ? { ...c, messages: [...c.messages, { id: cryptoRandomId(), role, text }] } : c));
  }
  async function send() {
    const content = input.trim();
    if (!content || !activeChat) return;
    pushMessage("user", content);
    setInput("");
    if (content.toLowerCase().startsWith("/itinerary ")) {
      const prompt = content.slice("/itinerary ".length).trim();
      await handleItinerary(prompt);
    } else if (content.toLowerCase() === "/wizard") {
      setWizardActive(true);
    } else {
      simulateStreamReply(content);
    }
  }
  function stopGenerating() {
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamBufferRef.current) { pushMessage("assistant", streamBufferRef.current); streamBufferRef.current = ""; }
    setIsTyping(false);
  }
  async function handleItinerary(prompt) {
    stopGenerating();
    setIsTyping(true);
    try {
      if (!isSignedIn) { pushMessage("assistant", "Please sign in to generate an itinerary."); setIsTyping(false); return; }
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const res = await fetch(`${base}/api/itinerary`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, credentials: "include", body: JSON.stringify({ prompt }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error || data?.message || `Request failed (${res.status})`); }
      const data = await res.json();
      const formatted = formatItineraryText(data);
      pushMessage("assistant", formatted);
    } catch (err) {
      pushMessage("assistant", `Failed to generate itinerary: ${err.message || err}`);
    } finally { setIsTyping(false); }
  }
  function formatItineraryText(data) {
    const flights = Array.isArray(data?.flights) ? data.flights : [];
    const hotels = Array.isArray(data?.hotels) ? data.hotels : [];
    const activities = Array.isArray(data?.activities) ? data.activities : [];
    const lines = [];
    lines.push("Here is your itinerary:\n");
    lines.push("Flights:");
    if (flights.length) { flights.forEach((f, i) => lines.push(`  ${i + 1}. ${f.from || "?"} → ${f.to || "?"} on ${f.date || "?"}`)); } else { lines.push("  (none)"); }
    lines.push("");
    lines.push("Hotels:");
    if (hotels.length) { hotels.forEach((h, i) => lines.push(`  ${i + 1}. ${h.name || "?"}: ${h.checkIn || "?"} → ${h.checkOut || "?"}`)); } else { lines.push("  (none)"); }
    lines.push("");
    lines.push("Activities:");
    if (activities.length) { activities.forEach((a, i) => lines.push(`  Day ${a.day ?? "?"}: ${a.activity || "?"}`)); } else { lines.push("  (none)"); }
    return lines.join("\n");
  }
  function handleWizardComplete(result) { setWizardActive(false); pushMessage("assistant", result); }
  function regenerate() { if (!activeChat) return; const lastUser = [...activeChat.messages].reverse().find((m) => m.role === "user"); if (lastUser) simulateStreamReply(lastUser.text); }
  function simulateStreamReply(prompt) {
    stopGenerating(); setIsTyping(true); const reply = generateAssistantText(prompt); streamBufferRef.current = ""; let i = 0;
    intervalRef.current = window.setInterval(() => {
      streamBufferRef.current += reply[i]; i++;
      setChats((prev) => prev.map((c) => { if (c.id !== activeId) return c; const msgs = [...c.messages]; const last = msgs[msgs.length - 1]; return { ...c, messages: msgs }; }));
      if (i >= reply.length) { if (intervalRef.current) window.clearInterval(intervalRef.current); intervalRef.current = null; pushMessage("assistant", streamBufferRef.current); streamBufferRef.current = ""; setIsTyping(false); }
    }, 18);
  }
  function MessageBubble({ m }) {
    const isUser = m.role === "user"; const isWizardCommand = m.text === "/wizard";
    return (
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`group relative w-fit max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm transition ${isUser ? "ml-auto bg-[#1f6feb] text-white" : "bg-black/60 backdrop-blur-sm border border-white/20 text-white"}`}>
        {isWizardCommand ? (<ChatWizard onComplete={handleWizardComplete} />) : (<div className="whitespace-pre-wrap">{m.text}</div>)}
        {!isUser && !isWizardCommand && (
          <div className="absolute -right-10 top-1/2 hidden -translate-y-1/2 items-center gap-2 group-hover:flex">
            <IconButton onClick={() => copy(m.text)} ariaLabel="Copy"><Copy size={14} /></IconButton>
            <IconButton onClick={() => {}} ariaLabel="More options"><MoreVertical size={14} /></IconButton>
          </div>
        )}
        {!isUser && !isWizardCommand && (
          <div className="mt-2 flex gap-2">
            <SmallButton onClick={regenerate} icon={<RefreshCw size={12} />}>Regenerate</SmallButton>
            {isTyping ? (<SmallButton onClick={stopGenerating} icon={<Square size={12} />}>Stop generating</SmallButton>) : null}
          </div>
        )}
      </motion.div>
    );
  }
  function StreamingBubble() {
    if (!isTyping || !activeChat) return null;
    return (
      <div className="w-fit max-w-[85%] rounded-xl px-4 py-3 text-sm bg-black/60 backdrop-blur-sm border border-white/20 text-white shadow-sm">
        <div className="min-h-[1lh] whitespace-pre-wrap">
          {streamBufferRef.current || (<div className="flex items-center gap-2 text-gray-300"><TypingDots /> <span className="text-xs">Voyager.AI is crafting your journey...</span></div>)}
        </div>
        <div className="mt-2 flex gap-2">
          <SmallButton onClick={regenerate} icon={<RefreshCw size={12} />}>Regenerate</SmallButton>
          <SmallButton onClick={stopGenerating} icon={<Square size={12} />}>Stop generating</SmallButton>
        </div>
      </div>
    );
  }
  return (
    <motion.div className="flex h-screen w-full select-none text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.0, ease: "easeOut" }}>
      <motion.aside className={`${sidebarOpen ? "w-64" : "w-0"} hidden md:flex h-full flex-col overflow-hidden border-r border-white/20 bg-black/40 backdrop-blur-xl transition-[width] duration-300`} initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
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
      </motion.aside>
      <motion.div className="flex h-full flex-1 flex-col bg-black/40 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}>
        <header className="sticky top-0 z-10 border-b border-white/20 bg-black/60 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3">
            <IconButton onClick={() => setSidebarOpen((s) => !s)} ariaLabel="Toggle sidebar" className="md:opacity-100"><Menu size={18} /></IconButton>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white">Voyager.AI</div>
            <div className="ml-auto flex items-center gap-2">
              <IconButton onClick={newChat} ariaLabel="New chat"><Plus size={18} /></IconButton>
              <IconButton onClick={() => {}} ariaLabel="Settings"><Settings size={18} /></IconButton>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
            {activeChat.messages.map((m) => (<MessageBubble key={m.id} m={m} />))}
            <StreamingBubble />
            <div ref={endRef} />
          </div>
          <motion.div className="sticky bottom-3 z-10" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}>
            <div className="rounded-xl border border-white/20 bg-black/60 backdrop-blur-sm p-2 shadow-lg">
              <textarea rows={1} placeholder="Ask me about your next cosmic adventure... (Try /wizard for guided planning)" className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-gray-400" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <div className="flex items-center justify-between px-2">
                <div className="text-[11px] text-gray-400">Enter to send • Shift+Enter for newline • /wizard for guided planning</div>
                <button onClick={send} className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white hover:brightness-105 active:translate-y-[1px]"><div className="flex items-center gap-1"><Send size={14} /> Send</div></button>
              </div>
            </div>
          </motion.div>
        </main>
      </motion.div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }`}</style>
    </motion.div>
  );
}
function IconButton({ children, onClick, ariaLabel, className = "" }) { return (<button aria-label={ariaLabel} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm hover:bg-black/80 active:translate-y-[1px] text-white ${className}`}>{children}</button>); }
function SmallButton({ children, onClick, icon }) { return (<button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs text-white hover:bg-black/80 transition-colors">{icon}{children}</button>); }
function TypingDots() { return (<div className="flex items-center gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:0ms]"></span><span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:120ms]"></span><span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:240ms]"></span></div>); }
function copy(text) { if (navigator?.clipboard?.writeText) { navigator.clipboard.writeText(text); } else { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); } }
function cryptoRandomId() { if (typeof crypto !== "undefined" && crypto.randomUUID) { return crypto.randomUUID(); } return Math.random().toString(36).slice(2); }
function generateAssistantText(prompt) { const responses = [
  `I'm excited to help you plan your journey! Based on your request: "${prompt}", I can create a personalized itinerary that maximizes your experience. Would you like me to include specific preferences for activities, budget range, or accommodation style?`,
  `Perfect! Let me craft an incredible cosmic adventure for you. I'll consider optimal routes, timing, and unique experiences that align with your interests. This will be an unforgettable journey!`,
  `I'm processing your request and will provide you with a detailed itinerary shortly. I'll include recommendations for must-see destinations, hidden gems, and practical travel tips to make your trip seamless.`,
  `Based on your preferences, I can suggest some amazing destinations and experiences. Let me create a comprehensive plan that balances adventure, relaxation, and cultural immersion.`,
  `I'd love to help you explore new horizons! Your request sounds fantastic, and I'll make sure to include all the details you need for a perfect journey.`
]; return responses[Math.floor(Math.random() * responses.length)]; }


