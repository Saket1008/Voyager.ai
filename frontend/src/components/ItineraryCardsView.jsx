import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sunrise, Sun, Moon, Utensils, Info, Star, Heart, Copy, Printer } from 'lucide-react';

// Lightweight parser duplicated from ItineraryCanvas to avoid refactor
function parseItinerary(markdown) {
  if (!markdown || typeof markdown !== 'string') return null;
  const lines = markdown.split(/\r?\n/);
  const days = [];
  let overview = '';
  let mustTry = '';
  let tips = '';
  let current = null;

  const matchDay = (line) => {
    const patterns = [
      /^#{1,6}\s*Day\s+(\d+)\s*(?:[:\-–—]\s*(.+))?\s*$/i,
      /^Day\s+(\d+)\s*(?:[:\-–—]\s*(.+))?\s*$/i,
      /^#{1,6}\s*Day\s+(\d+)\s+(.+)$/i,
    ];
    for (const re of patterns) {
      const m = line.match(re);
      if (m) return m;
    }
    return null;
  };

  const isHeading = (line) => /^#{1,6}\s+/.test(line.trim());
  const isOverviewHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*trip\s+overview\s*[:\-]?/i.test(line.trim());
  const isMustTryHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*must\s*[-\s]?try/i.test(line.trim());
  const isTipsHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*(tips|logistics\s*&?\s*tips)\b/i.test(line.trim());

  const captureSection = (predicate) => {
    const startIdx = lines.findIndex(predicate);
    if (startIdx === -1) return '';
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (isHeading(lines[i]) && !predicate(lines[i])) { endIdx = i; break; }
    }
    return lines.slice(startIdx + 1, endIdx).join('\n').trim();
  };
  overview = captureSection(isOverviewHeading);
  mustTry = captureSection(isMustTryHeading);
  tips = captureSection(isTipsHeading);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = matchDay(line);
    if (m) {
      if (current) days.push(current);
      const dayNumber = m[1];
      const dayTheme = (m[2] || `Day ${dayNumber}`).trim();
      current = { dayNumber, dayTheme, content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) days.push(current);

  if (!days.length) {
    const headingIdx = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^###\s+/.test(lines[i])) headingIdx.push(i);
    }
    if (headingIdx.length > 0) {
      for (let j = 0; j < headingIdx.length; j++) {
        const start = headingIdx[j];
        const end = j < headingIdx.length - 1 ? headingIdx[j + 1] : lines.length;
        const title = lines[start].replace(/^###\s+/, '').trim();
        days.push({ dayNumber: String(j + 1), dayTheme: title || `Day ${j + 1}`, content: lines.slice(start + 1, end) });
      }
    } else {
      days.push({ dayNumber: '1', dayTheme: 'Overview', content: lines });
    }
  }

  const titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
  const tripTitle = titleMatch ? titleMatch[1].trim() : 'Your Itinerary';

  if (!overview) {
    const firstDayIdx = lines.findIndex(l => matchDay(l));
    if (firstDayIdx > 0) overview = lines.slice(0, firstDayIdx).join('\n').trim();
  }

  const toSections = (contentLines) => {
    const text = contentLines.join('\n');
    const specs = [
      { key: 'morning', re: /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?morning(?:\*\*)?\s*[:\-–]\s*/i },
      { key: 'afternoon', re: /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?afternoon(?:\*\*)?\s*[:\-–]\s*/i },
      { key: 'evening', re: /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?evening(?:\*\*)?\s*[:\-–]\s*/i },
      { key: 'meals', re: /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?meals?(?:\*\*)?\s*[:\-–]\s*/i },
      { key: 'logistics', re: /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?(?:logistics(?:\s*\/\s*|\s*&\s*)?tips|tips|logistics)(?:\*\*)?\s*[:\-–]\s*/i },
    ];
    const found = [];
    for (const s of specs) {
      const re = new RegExp(s.re);
      const m = re.exec(text);
      if (m) found.push({ key: s.key, index: m.index, len: m[0].length });
    }
    if (!found.length) return { overview: text.trim() };
    found.sort((a, b) => a.index - b.index);
    const sections = {};
    for (let i = 0; i < found.length; i++) {
      const { key, index, len } = found[i];
      const end = i < found.length - 1 ? found[i + 1].index : text.length;
      sections[key] = text.slice(index + len, end).trim();
    }
    return sections;
  };

  const enrichedDays = days.map(d => ({ ...d, sections: toSections(d.content) }));
  return { tripTitle, overview, dailyPlans: enrichedDays, mustTry, tips };
}

function parseTimedSteps(sectionText) {
  if (!sectionText) return [];
  const lines = sectionText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const steps = [];
  const re = /^[-*]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[—–-]\s*([^:]+?)(?:\s*:\s*([^()]*?))?(?:\s*\(\s*Duration\s*:\s*([^)]*)\))?\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      const time = m[1].trim();
      const title = (m[2] || '').trim();
      const desc = (m[3] || '').trim();
      const duration = (m[4] || '').trim();
      steps.push({ time, title, desc, duration, raw: line });
    }
  }
  return steps;
}

export default function ItineraryCardsView({ itineraryMarkdown, onClose, plannedDays = null }) {
  const itinerary = useMemo(() => parseItinerary(itineraryMarkdown), [itineraryMarkdown]);
  const [index, setIndex] = useState(0); // 0: Overview, 1..N: Day i, last+1: Must Try, last+2: Tips
  const containerRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [fav, setFav] = useState(false);

  const normalizedDays = useMemo(() => {
    if (!itinerary) return [];
    const src = itinerary.dailyPlans || [];
    const p = Number(plannedDays) || 0;
    if (!p || p === src.length) return src;
    if (p < src.length) return src.slice(0, p);
    const out = [...src];
    for (let i = src.length + 1; i <= p; i++) {
      out.push({ dayNumber: String(i), dayTheme: `Day ${i}`, content: ["No details provided."], sections: { overview: 'No details provided.' } });
    }
    return out;
  }, [itinerary, plannedDays]);

  const totalCards = useMemo(() => 1 + normalizedDays.length + 2, [normalizedDays.length]);

  const clampIndex = useCallback((i) => Math.max(0, Math.min(totalCards - 1, i)), [totalCards]);

  const goNext = () => setIndex(i => clampIndex(i + 1));
  const goPrev = () => setIndex(i => clampIndex(i - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); }
      if (e.key === 'ArrowRight') { goNext(); }
      if (e.key === 'ArrowLeft') { goPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(itineraryMarkdown || ''); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      const last = Array.isArray(arr) ? arr.find(x => x && typeof x === 'object' && x.markdown === itineraryMarkdown) : null;
      setFav(Boolean(last?.favorite));
    } catch {}
  }, [itineraryMarkdown]);

  const toggleFav = () => {
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        for (const it of arr) {
          if (it && typeof it === 'object' && it.markdown === itineraryMarkdown) {
            it.favorite = !Boolean(it.favorite);
            setFav(Boolean(it.favorite));
            break;
          }
        }
        localStorage.setItem('voyager_local_journeys', JSON.stringify(arr));
        try { window.dispatchEvent(new CustomEvent('voyager:itinerarySaved')); } catch {}
      }
    } catch {}
  };

  if (!itinerary) return null;

  const { tripTitle, overview, mustTry, tips } = itinerary;

  const renderDayCard = (d) => {
    const order = [
      { key: 'morning', label: 'Morning', Icon: Sunrise, accent: 'from-amber-400/20 to-orange-400/10' },
      { key: 'afternoon', label: 'Afternoon', Icon: Sun, accent: 'from-sky-400/20 to-cyan-400/10' },
      { key: 'evening', label: 'Evening', Icon: Moon, accent: 'from-purple-400/20 to-fuchsia-400/10' },
      { key: 'meals', label: 'Meals', Icon: Utensils, accent: 'from-emerald-400/20 to-lime-400/10' },
      { key: 'logistics', label: 'Logistics & Tips', Icon: Info, accent: 'from-gray-400/20 to-slate-400/10' },
      { key: 'overview', label: 'Overview', Icon: Info, accent: 'from-gray-400/20 to-slate-400/10' },
    ];
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {order.map(o => {
          const content = d.sections?.[o.key];
          if (!content) return null;
          const steps = (o.key === 'morning' || o.key === 'afternoon' || o.key === 'evening') ? parseTimedSteps(content) : [];
          return (
            <div key={o.key} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${o.accent} p-4`}> 
              <div className="flex items-center gap-2 mb-2 text-white/90">
                <o.Icon className="w-4 h-4" />
                <div className="font-semibold text-sm">{o.label}</div>
              </div>
              {steps.length ? (
                <div className="relative pl-6 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                  {steps.map((s, idx) => (
                    <div key={idx} className="relative mb-4">
                      <span className="absolute -left-0.5 top-2 w-2 h-2 rounded-full bg-emerald-400" />
                      <div className="text-xs font-mono text-emerald-300">{s.time}{s.duration ? ` • ${s.duration}` : ''}</div>
                      <div className="text-white font-medium">{s.title}</div>
                      {s.desc ? <div className="text-white/80 text-sm">{s.desc}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-white/90">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const cards = [
    {
      key: 'overview',
      title: tripTitle,
      subtitle: `${normalizedDays.length} Day${normalizedDays.length>1?'s':''} • Overview`,
      body: (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{(overview || '').trim() || 'No overview provided.'}</ReactMarkdown>
        </div>
      )
    },
    ...normalizedDays.map((d) => ({
      key: `day-${d.dayNumber}`,
      title: `Day ${d.dayNumber}`,
      subtitle: d.dayTheme?.replace(/^Day\s*\d+[:\-–—]?\s*/i, '') || 'Plan',
      body: renderDayCard(d)
    })),
    {
      key: 'must',
      title: 'Must Try',
      subtitle: 'Top picks and highlights',
      body: (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{(mustTry || '').trim() || 'No recommendations provided.'}</ReactMarkdown>
        </div>
      )
    },
    {
      key: 'tips',
      title: 'Tips',
      subtitle: 'Logistics and local wisdom',
      body: (
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown>{(tips || '').trim() || 'No tips provided.'}</ReactMarkdown>
        </div>
      )
    }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white"
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto select-none">
            <div className="text-sm text-white/60">{tripTitle}</div>
            <div className="text-xs text-white/50">Use arrows • Esc to close</div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={toggleFav} title={fav ? 'Unfavorite' : 'Favorite'} className={`p-2 rounded-md ${fav ? 'text-rose-300 bg-rose-400/10 hover:bg-rose-400/20' : 'text-white/80 hover:bg-white/10'}`}>
              <Heart className={`w-5 h-5 ${fav ? 'fill-rose-300' : ''}`} />
            </button>
            <button onClick={copyAll} title={copied ? 'Copied!' : 'Copy markdown'} className="p-2 rounded-md text-white/80 hover:bg-white/10">
              <Copy className="w-5 h-5" />
            </button>
            <button onClick={() => { try { window.print(); } catch {} }} title="Print / Save PDF" className="p-2 rounded-md text-white/80 hover:bg-white/10">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 rounded-full text-white/80 hover:bg-white/10" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div ref={containerRef} className="h-full w-full overflow-hidden">
          <motion.div
            className="h-full flex"
            animate={{ x: `-${index * 100}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.x < -80) goNext();
              else if (info.offset.x > 80) goPrev();
            }}
            style={{ touchAction: 'pan-y' }}
          >
            {cards.map((card, i) => (
              <div key={card.key} className="min-w-full h-full p-6 md:p-10 flex">
                <div className="m-auto w-full max-w-6xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="h-[78vh] md:h-[80vh] rounded-3xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-[0_0_40px_rgba(0,0,0,0.25)] p-6 md:p-8 flex flex-col"
                  >
                    <div className="mb-4">
                      <div className="text-xs uppercase tracking-widest text-white/50">{i+1} / {totalCards}</div>
                      <h2 className="text-2xl md:text-3xl font-semibold text-white/95">{card.title}</h2>
                      {card.subtitle ? <div className="text-white/70">{card.subtitle}</div> : null}
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                      {card.body}
                    </div>
                  </motion.div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Nav arrows */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
          <button onClick={goPrev} className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={goNext} className="pointer-events-auto p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Dots */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
          {cards.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className={`w-2.5 h-2.5 rounded-full ${i===index ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
