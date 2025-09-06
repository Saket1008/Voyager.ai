// frontend/src/components/ItineraryCanvas.jsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sunrise, Sun, Moon, Utensils, Info, Copy, Printer } from 'lucide-react';

// Parse markdown into days based on headings like "### Day N: Title"
function parseItinerary(markdown) {
  if (!markdown || typeof markdown !== 'string') return null;
  const lines = markdown.split(/\r?\n/);
  const days = [];
  let current = null;

  // Support multiple heading styles:
  // ### Day 1: Title | ## Day 1 - Title | Day 1: Title | ### Day 1 Title
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

  // If no days detected, fallback to split by any ### heading as pseudo-days
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
      // Last resort, single overview day
      days.push({ dayNumber: '1', dayTheme: 'Overview', content: lines });
    }
  }

  // Trip title if any (first H1 or fallback)
  const titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/^##\s+(.+)$/m);
  const tripTitle = titleMatch ? titleMatch[1].trim() : 'Your Itinerary';

  // Extract named sections within each day (Morning/Afternoon/Evening/Meals/Logistics)
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
  return { tripTitle, dailyPlans: enrichedDays };
}

export default function ItineraryCanvas({ itineraryMarkdown, onClose, isSidebarOpen = false /* onToggleSidebar unused per request */ }) {
  const itinerary = useMemo(() => parseItinerary(itineraryMarkdown), [itineraryMarkdown]);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  if (!itinerary) return null;

  const { tripTitle, dailyPlans } = itinerary;
  const active = dailyPlans[activeIndex] || dailyPlans[0];

  useEffect(() => {
    // Scroll to top when switching days
    try { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, [activeIndex]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(itineraryMarkdown || ''); } catch {}
  };
  const printCanvas = () => { try { window.print(); } catch {} };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 h-full w-full md:w-[60%] lg:w-[50%] z-40 bg-gray-900/85 backdrop-blur-2xl border-l border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-white/10 flex items-center justify-between mt-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">{tripTitle}</h2>
            <p className="text-sm text-white/60">{dailyPlans.length} Day{dailyPlans.length>1?'s':''} Planned</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-white/70 hover:bg-white/10 transition-colors" aria-label="Close itinerary">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Day Tabs */}
        <div className="flex-shrink-0 p-2 border-b border-white/10 overflow-x-auto sticky top-0 z-10 bg-gray-900/85 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
            {dailyPlans.map((d, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  idx === activeIndex ? 'bg-green-500 text-black' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Day {d.dayNumber}
              </button>
            ))}
            </div>
            <div className="flex items-center gap-2 pr-1">
              <button onClick={copyAll} title="Copy markdown" className="p-2 rounded-md text-white/80 hover:bg-white/10">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={printCanvas} title="Print / Save PDF" className="p-2 rounded-md text-white/80 hover:bg-white/10">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Day Content */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto">
          {active && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-green-300">{active.dayTheme}</h3>
              {/* Section cards */}
              {(() => {
                const order = [
                  { key: 'morning', label: 'Morning', Icon: Sunrise },
                  { key: 'afternoon', label: 'Afternoon', Icon: Sun },
                  { key: 'evening', label: 'Evening', Icon: Moon },
                  { key: 'meals', label: 'Meals', Icon: Utensils },
                  { key: 'logistics', label: 'Logistics & Tips', Icon: Info },
                  { key: 'overview', label: 'Overview', Icon: Info },
                ];
                const items = [];
                for (const o of order) {
                  const content = active.sections?.[o.key];
                  if (!content) continue;
                  items.push(
                    <div key={o.key} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-2 text-white/90">
                        <o.Icon className="w-4 h-4" />
                        <div className="font-semibold text-sm">{o.label}</div>
                      </div>
                      <div className="prose prose-invert max-w-none text-white/90">
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    </div>
                  );
                }
                return items.length ? items : (
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                    <ReactMarkdown>{active.content.join('\n')}</ReactMarkdown>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
