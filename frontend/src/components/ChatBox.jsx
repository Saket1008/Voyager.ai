import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Menu, Plus, Settings, Send, Copy, RefreshCw, Square, Trash2 } from "lucide-react";

export default function Chatbox() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const makeChat = (title = "New chat") => ({
    id: cryptoRandomId(),
    title,
    messages: [],
    createdAt: Date.now(),
  });
  const [chats, setChats] = useState([makeChat("Welcome")] );
  const [activeId, setActiveId] = useState(chats[0].id);
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState('greeting');
  const [quickOptions, setQuickOptions] = useState([]);
  const [inputSpec, setInputSpec] = useState({ type: 'freeText' });
  const [flowState, setFlowState] = useState({});
  const [hints, setHints] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  // UI controls for special stages
  const [uiDays, setUiDays] = useState(7);
  const [uiDaysFlex, setUiDaysFlex] = useState(false);
  const [uiStartDate, setUiStartDate] = useState('');
  const [uiDateFlex, setUiDateFlex] = useState('none'); // none | start | all
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);
  const streamBufferRef = useRef("");
  const endRef = useRef(null);
  const greetedRef = useRef(false);
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [activeChat?.messages.length, isTyping]);
  // Reset multiselect when input type changes
  useEffect(() => { setMultiSel([]); }, [inputSpec?.type, stage]);

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

  function getUserInfoMinimal() {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress,
    };
  }

  const defaultExperienceOptions = ["Adventure","Relaxation","Cultural","Nature","Luxury"];

  function inputSpecForStage(stageName) {
    switch (stageName) {
      case 'ask_intent':
        return { type: 'options', options: ["I have specific locations","I only know a region"] };
      case 'input_locations':
      case 'input_region':
        return { type: 'freeText' };
      case 'ask_duration':
        return { type: 'days' };
      case 'ask_dates':
        return { type: 'dates' };
      case 'ask_travelers':
        return { type: 'options', options: ['Solo Traveler','A Couple','Family','A Group of Friends'] };
      case 'ask_pace':
        return { type: 'options', options: ['Relaxed','Balanced','Action-Packed'] };
      case 'ask_interests':
        return { type: 'multiselect', options: ['History & Museums','Food & Local Cuisine','Adventure & Outdoors','Art & Culture','Nightlife & Entertainment','Shopping','Relaxation & Wellness'] };
      case 'ask_budget':
        return { type: 'options', options: ['Budget-Friendly','Mid-Range','Luxury'] };
      default:
        return { type: 'freeText' };
    }
  }

  async function greet() {
    try {
      setIsTyping(true);
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
  const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "omit",
        body: JSON.stringify({ mode: 'chat', stage: 'greeting', message: '', user: getUserInfoMinimal(), state: flowState }),
      });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  const reply = typeof data === 'string' ? data : data.reply || JSON.stringify(data, null, 2);
      pushMessage('assistant', reply);
  const next = data.stageNext || 'ask_intent';
  setStage(next);
  const fallbackSpec = inputSpecForStage(next);
  const nextSpec = data.input || fallbackSpec;
  setInputSpec(nextSpec);
  if (Array.isArray(data.quickOptions)) setQuickOptions(data.quickOptions);
  else if (nextSpec.type === 'options' || nextSpec.type === 'multiselect') setQuickOptions(nextSpec.options || []);
  if (data.hints) setHints(data.hints);
    } catch {
      pushMessage('assistant', "Hello! I'm your Voyager.AI assistant. Do you already have a specific list of locations in mind, or only a region?");
      setStage('ask_intent');
      setQuickOptions(["I have specific locations","I only know a region"]);
  setInputSpec(inputSpecForStage('ask_intent'));
    } finally {
      setIsTyping(false);
    }
  }

  // Kick off greeting when a new chat is empty
  useEffect(() => {
    if (!activeChat) return;
    if (activeChat.messages.length === 0 && !greetedRef.current) {
      greetedRef.current = true;
      greet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);
  async function send(selectedText, stateDelta = undefined, stageOverride = undefined) {
    const content = (selectedText ?? input).trim();
    if (!content || !activeChat) return;
    pushMessage("user", content);
    setInput("");
    // Determine stage for this turn and collect context into state
    let sendStage = stageOverride || stage;
    let uiNextStage = null;
    const INTENT_LOC = "i have specific locations";
    const INTENT_REG = "i only know a region";
    let newState = { ...flowState };
    if (stage === 'ask_intent') {
      const lower = content.toLowerCase();
      if (lower.includes('specific')) uiNextStage = 'input_locations';
      else if (lower.includes('region')) uiNextStage = 'input_region';
      // Immediately branch locally and prompt for the next input; skip server call.
      if (uiNextStage) {
        const localPrompt = uiNextStage === 'input_locations'
          ? 'Please type the names of the locations you want to explore (comma separated).'
          : 'Please type the region or area you’re interested in.';
        pushMessage('assistant', localPrompt);
        setStage(uiNextStage);
        setInputSpec({ type: 'freeText' });
        setQuickOptions([]);
        setIsTyping(false);
        return;
      }
      sendStage = 'ask_intent';
    }
  if (sendStage === 'input_locations') {
      const parts = content.split(/,|\n/).map(s => s.trim()).filter(Boolean);
      if (parts.length) newState.locations = parts;
    } else if (sendStage === 'input_region') {
      newState.region = content;
    } else if (sendStage === 'ask_experience') {
      newState.experience = content;
    } else if (sendStage === 'ask_budget') {
      newState.budget = content;
    } else if (sendStage === 'ask_duration') {
      // if coming from UI, prefer stateDelta
  const days = (stateDelta?.durationDays ?? parseInt(content.replace(/\D+/g, ''), 10)) || undefined;
      if (days) newState.durationDays = days;
      if (typeof stateDelta?.durationFlex === 'boolean') newState.durationFlex = stateDelta.durationFlex;
    } else if (sendStage === 'ask_dates') {
      if (stateDelta?.startDate) newState.startDate = stateDelta.startDate;
      if (stateDelta?.endDate) newState.endDate = stateDelta.endDate;
      if (stateDelta?.dateFlex) newState.dateFlex = stateDelta.dateFlex; // none | start | all
    } else if (sendStage === 'ask_travelers') {
      newState.travelers = content;
    } else if (sendStage === 'ask_pace') {
      newState.pace = content;
    } else if (sendStage === 'ask_interests') {
      // allow comma or button selections
      const parts = content.split(/,|\n/).map(s => s.trim()).filter(Boolean);
      if (parts.length) newState.interests = parts;
    } else if (sendStage === 'ask_preferences') {
      newState.preferences = content;
    }
    if (stateDelta && typeof stateDelta === 'object') {
      newState = { ...newState, ...stateDelta };
    }

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
        credentials: "omit",
        body: JSON.stringify({ mode: "chat", message: content, stage: sendStage, user: getUserInfoMinimal(), state: newState }),
      });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  setFlowState(newState);
  if (uiNextStage) {
        // Show the free-text box for locations/region next
        setStage(uiNextStage);
        setInputSpec({ type: 'freeText' });
        setQuickOptions([]);
        if (data.hints) setHints(data.hints);
        return;
      }
  const next = data.stageNext || ((sendStage === 'input_locations' || sendStage === 'input_region') ? 'ask_duration' : stage);
  setStage(next);
  const fallbackSpec = inputSpecForStage(next);
  const nextSpec = data.input || fallbackSpec;
  setInputSpec(nextSpec);
  const reply = typeof data === "string" ? data : data.reply || data.message || JSON.stringify(data, null, 2);
  pushMessage("assistant", reply);
  if (Array.isArray(data.quickOptions)) setQuickOptions(data.quickOptions);
  else if (nextSpec.type === 'options' || nextSpec.type === 'multiselect') setQuickOptions(nextSpec.options || []);
  else setQuickOptions([]);
  if (data.hints) setHints(data.hints);
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
      <div className={`group relative w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-[0_0_30px_rgba(59,130,246,0.08)] ${isUser ? "ml-auto bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white" : "bg-white/10 backdrop-blur-md border border-white/20 text-white"}`}>
        <div className="whitespace-pre-wrap">{m.text}</div>
        {!isUser && (
          <div className="mt-2 flex items-center gap-1">
            <button title="Regenerate" onClick={() => simulateStreamReply(m.text)} className="grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"><RefreshCw size={12} /></button>
            <button title="Copy" onClick={() => copy(m.text)} className="grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"><Copy size={12} /></button>
            {isTyping ? (
              <button title="Stop" onClick={stopGenerating} className="ml-1 grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"><Square size={12} /></button>
            ) : null}
          </div>
        )}
      </div>
    );
  }
  function StreamingBubble() {
    if (!isTyping || !activeChat) return null;
    return (
      <div className="w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-[0_0_30px_rgba(236,72,153,0.08)]">
        <div className="min-h-[1lh] whitespace-pre-wrap">{streamBufferRef.current || "Typing…"}</div>
        <div className="mt-2 flex items-center gap-1">
          <button title="Regenerate" onClick={() => simulateStreamReply("repeat last")} className="grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"><RefreshCw size={12} /></button>
          <button title="Stop" onClick={stopGenerating} className="grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"><Square size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full select-none text-white bg-transparent">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(1200px_800px_at_10%_10%,rgba(59,130,246,0.08),transparent_60%),radial-gradient(1000px_700px_at_90%_20%,rgba(236,72,153,0.06),transparent_60%),radial-gradient(900px_600px_at_50%_80%,rgba(34,197,94,0.06),transparent_60%)]"></div>
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} hidden md:flex h-full flex-col overflow-hidden border-r border-white/15 bg-white/5 backdrop-blur-xl backdrop-saturate-150 transition-[width] duration-300`}>
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
      <div className="flex h-full min-h-0 flex-1 flex-col bg-transparent">
        <header className="sticky top-0 z-10 border-b border-white/15 bg-white/10 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-3">
            <IconButton onClick={() => setSidebarOpen((s) => !s)} ariaLabel="Toggle sidebar" className="md:opacity-100"><Menu size={18} /></IconButton>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white">Voyager.AI</div>
            <div className="ml-auto flex items-center gap-3 text-sm text-white/80">
              {isSignedIn && user ? (
                <span>Welcome, {user.firstName || user.username || "Explorer"}</span>
              ) : null}
              <IconButton onClick={newChat} ariaLabel="New chat"><Plus size={18} /></IconButton>
              <IconButton onClick={() => {}} ariaLabel="Settings"><Settings size={18} /></IconButton>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4 py-6">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {activeChat.messages.map((m) => (<MessageBubble key={m.id} m={m} />))}
            <StreamingBubble />
            <div ref={endRef} />
          </div>
          {/* Stage-specific panels that appear in the flow area (days/dates) */}
          {inputSpec?.type === 'days' ? (
            <div className="mb-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm">How many days?</div>
                {hints?.recommended_days || hints?.best_months ? (
                  <div className="text-[11px] text-white/80">
                    {hints?.recommended_days ? (<span>Suggested: {hints.recommended_days}</span>) : null}
                    {hints?.best_months ? (<span>{hints?.recommended_days ? ' • ' : ''}Best months: {hints.best_months}</span>) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button className="h-8 w-8 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20" onClick={() => setUiDays((d) => Math.max(1, d - 1))}>-</button>
                <div className="min-w-10 text-center text-sm">{uiDays} days</div>
                <button className="h-8 w-8 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20" onClick={() => setUiDays((d) => d + 1)}>+</button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-white/90">
                <input type="checkbox" checked={uiDaysFlex} onChange={(e) => setUiDaysFlex(e.target.checked)} />
                I'm okay with ±1–2 days flexibility
              </label>
              <div className="mt-3 text-right">
                <button onClick={() => {
                  const summary = `${uiDays} days${uiDaysFlex ? ' (flex ±2)' : ''}`;
                  send(summary, { durationDays: uiDays, durationFlex: uiDaysFlex }, 'ask_duration');
                }} className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white hover:brightness-105">Continue</button>
              </div>
            </div>
          ) : null}
          {inputSpec?.type === 'dates' ? (
            <div className="mb-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm">Select your start date</div>
                {hints?.best_months ? (<div className="text-[11px] text-white/80">Best months: {hints.best_months}</div>) : null}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input type="date" value={uiStartDate} onChange={(e) => setUiStartDate(e.target.value)} className="rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-sm outline-none" />
                <div className="text-xs text-white/80">
                  {(() => {
                    const days = Number(flowState?.durationDays) || uiDays || 7;
                    if (!uiStartDate) return 'Return date will auto-calculate';
                    const start = new Date(uiStartDate);
                    if (isNaN(start)) return 'Invalid date';
                    const end = new Date(start.getTime() + (Math.max(1, days) - 1) * 24 * 60 * 60 * 1000);
                    const iso = (d) => d.toISOString().split('T')[0];
                    return `Return: ${iso(end)}`;
                  })()}
                </div>
              </div>
              {flowState?.durationFlex ? (
                <div className="mt-3">
                  <div className="text-xs mb-1">Date flexibility</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <label className={`flex items-center gap-2 rounded-lg border ${uiDateFlex==='none'?'border-white/50':'border-white/20'} bg-white/10 px-2 py-1`}> <input type="radio" name="dateflex" checked={uiDateFlex==='none'} onChange={() => setUiDateFlex('none')} /> No flexibility </label>
                    <label className={`flex items-center gap-2 rounded-lg border ${uiDateFlex==='start'?'border-white/50':'border-white/20'} bg-white/10 px-2 py-1`}> <input type="radio" name="dateflex" checked={uiDateFlex==='start'} onChange={() => setUiDateFlex('start')} /> Flexible around start date </label>
                    <label className={`flex items-center gap-2 rounded-lg border ${uiDateFlex==='all'?'border-white/50':'border-white/20'} bg-white/10 px-2 py-1`}> <input type="radio" name="dateflex" checked={uiDateFlex==='all'} onChange={() => setUiDateFlex('all')} /> Okay with full flexibility </label>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 text-right">
                <button onClick={() => {
                  if (!uiStartDate) return;
                  const days = Number(flowState?.durationDays) || uiDays || 7;
                  const start = new Date(uiStartDate);
                  const end = new Date(start.getTime() + (Math.max(1, days) - 1) * 24 * 60 * 60 * 1000);
                  const iso = (d) => d.toISOString().split('T')[0];
                  const summary = `Dates: ${iso(start)} → ${iso(end)} (${days} days)`;
                  send(summary, { startDate: iso(start), endDate: iso(end), dateFlex: uiDateFlex }, 'ask_dates');
                }} className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white hover:brightness-105">Confirm dates</button>
              </div>
            </div>
          ) : null}
          <div className="sticky bottom-3 z-10">
      {inputSpec?.type === 'options' && quickOptions?.length ? (
              <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md backdrop-saturate-150 p-3 shadow-lg">
        <div className="mb-2 text-[12px] text-white/80">Choose one</div>
                <AnimatePresence>
                  <div className="flex flex-wrap gap-2">
                    {quickOptions.map((q, idx) => (
                      <motion.button
                        key={q}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ delay: idx * 0.03, duration: 0.18 }}
                        onClick={() => send(q)}
                        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs hover:bg-white/20 transition-colors shadow-sm"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </AnimatePresence>
              </div>
            ) : null}
            {inputSpec?.type === 'multiselect' && quickOptions?.length ? (
              <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md backdrop-saturate-150 p-3 shadow-lg">
                <div className="mb-2 text-[12px] text-white/80">Choose any</div>
                <AnimatePresence>
                  <div className="flex flex-wrap gap-2">
                    {quickOptions.map((q, idx) => {
                      const active = multiSel.includes(q);
                      return (
                        <motion.button
                          key={q}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          transition={{ delay: idx * 0.03, duration: 0.18 }}
                          onClick={() => setMultiSel((arr) => (arr.includes(q) ? arr.filter((x) => x !== q) : [...arr, q]))}
                          className={`rounded-xl border px-4 py-2 text-xs transition-colors shadow-sm ${active ? 'bg-white/25 border-white/50' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                        >
                          {q}
                        </motion.button>
                      );
                    })}
                  </div>
                </AnimatePresence>
                <div className="mt-3 text-right">
                  <button
                    disabled={!multiSel.length}
                    onClick={() => {
                      const summary = multiSel.join(', ');
                      send(summary, { interests: multiSel }, 'ask_interests');
                    }}
                    className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : null}
            {inputSpec?.type === 'freeText' ? (
              <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md backdrop-saturate-150 p-2 shadow-lg">
                <textarea rows={1} placeholder="Type your answer…" className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-gray-400" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <div className="flex items-center justify-between px-2">
                  <div className="text-[11px] text-gray-400">Enter to send • Shift+Enter for newline</div>
                  <button onClick={() => send()} className="rounded-lg bg-[#19c37d] px-3 py-1.5 text-xs font-medium text-white hover:brightness-105 active:translate-y-[1px]"><div className="flex items-center gap-1"><Send size={14} /> Send</div></button>
                </div>
              </div>
            ) : null}
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

