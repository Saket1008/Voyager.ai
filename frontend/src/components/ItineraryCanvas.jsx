// frontend/src/components/ItineraryCanvas.jsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sunrise, Sun, Moon, Utensils, Info, Copy, Printer, Star, Heart, Plane } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Parse markdown into days based on headings like "### Day N: Title"
function parseItinerary(markdown) {
  if (!markdown || typeof markdown !== 'string') return null;
  const lines = markdown.split(/\r?\n/);
  const days = [];
  let overview = '';
  let mustTry = '';
  let tips = '';
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

  // Helpers for global sections
  const isHeading = (line) => /^#{1,6}\s+/.test(line.trim());
  const isOverviewHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*trip\s+overview\s*[:\-]?/i.test(line.trim());
  const isMustTryHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*must\s*[-\s]?try/i.test(line.trim());
  const isTipsHeading = (line) => /^(?:#{1,6}\s*)?(\*\*)?\s*(tips|logistics\s*&?\s*tips)\b/i.test(line.trim());

  // First pass: capture explicit global sections by heading blocks
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

  // If no explicit overview captured, infer from content before first day
  if (!overview) {
    const firstDayIdx = lines.findIndex(l => matchDay(l));
    if (firstDayIdx > 0) overview = lines.slice(0, firstDayIdx).join('\n').trim();
  }

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
  return { tripTitle, overview, dailyPlans: enrichedDays, mustTry, tips };
}

// Extract time-stamped steps from a markdown bullet list (e.g., "- 09:30 AM — Title: details (Duration: 1h)")
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

function Timeline({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <div className="relative pl-6 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
      {steps.map((s, idx) => (
        <div key={idx} className="relative mb-4">
          <span className="absolute -left-0.5 top-2 w-2 h-2 rounded-full bg-green-400" />
          <div className="text-xs font-mono text-green-300">{s.time}{s.duration ? ` • ${s.duration}` : ''}</div>
          <div className="text-white font-medium">{s.title}</div>
          {s.desc ? <div className="text-white/80 text-sm">{s.desc}</div> : null}
        </div>
      ))}
    </div>
  );
}

export default function ItineraryCanvas({ itineraryMarkdown, onClose, isSidebarOpen = false /* onToggleSidebar unused per request */, plannedDays = null }) {
  const itinerary = useMemo(() => parseItinerary(itineraryMarkdown), [itineraryMarkdown]);
  // activeTab: 'overview' | number (1-based day) | 'must' | 'tips'
  const [activeTab, setActiveTab] = useState('overview');
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  if (!itinerary) return null;

  const { tripTitle } = itinerary;
  // Normalize daily plans to match plannedDays when provided
  const normalizedDays = useMemo(() => {
    const src = itinerary.dailyPlans || [];
    const p = Number(plannedDays) || 0;
    if (!p || p === src.length) return src;
    if (p < src.length) return src.slice(0, p);
    // pad with empty overview days
    const out = [...src];
    for (let i = src.length + 1; i <= p; i++) {
      out.push({ dayNumber: String(i), dayTheme: `Day ${i}`, content: ["No details provided."], sections: { overview: 'No details provided.' } });
    }
    return out;
  }, [itinerary.dailyPlans, plannedDays]);
  const dayIndex = typeof activeTab === 'number' ? activeTab - 1 : 0;
  const activeDay = normalizedDays[dayIndex];

  useEffect(() => {
    // Scroll to top when switching days
    try { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, [activeTab]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(itineraryMarkdown || ''); } catch {}
  };
  const printCanvas = () => { try { window.print(); } catch {} };
  const [fav, setFav] = useState(() => {
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      const last = Array.isArray(arr) ? arr.find(x => x && typeof x === 'object' && x.markdown === itineraryMarkdown) : null;
      return Boolean(last?.favorite);
    } catch {
      return false;
    }
  });

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

  const openBookings = () => {
    // Try to find the stored journey item that matches this markdown to extract metadata
    let meta = {};
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const found = arr.find(x => x && typeof x === 'object' && x.markdown === itineraryMarkdown);
        if (found) {
          meta = {
            tripState: found.tripState || {},
            durationDays: found.durationDays || null,
            locations: found.locations || (found.tripState?.locations || null),
            title: found.title || itinerary.tripTitle || 'Journey',
          };
        }
      }
    } catch {}
    const state = { itinerary: { markdown: itineraryMarkdown, title: itinerary.tripTitle, ...meta } };
    navigate('/bookings', { state });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="itinerary-canvas fixed top-0 right-0 h-full w-full md:w-[60%] lg:w-[50%] z-40 bg-gray-900/85 backdrop-blur-2xl border-l border-white/10 flex flex-col"
      >
        {/* Screen UI (hidden on print) */}
        <div className="print:hidden contents">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/10 flex items-center justify-between mt-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white">{tripTitle}</h2>
              <p className="text-sm text-white/60">{normalizedDays.length} Day{normalizedDays.length>1?'s':''} Planned</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-white/70 hover:bg-white/10 transition-colors" aria-label="Close itinerary">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs: Overview | Day 1..N | Must Try | Tips */}
          <div className="flex-shrink-0 p-2 border-b border-white/10 overflow-x-auto sticky top-0 z-10 bg-gray-900/85 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'overview' ? 'bg-green-500 text-black' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Overview
                </button>
                {normalizedDays.map((d) => (
                  <button
                    key={d.dayNumber}
                    onClick={() => setActiveTab(Number(d.dayNumber))}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === Number(d.dayNumber) ? 'bg-green-500 text-black' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    Day {d.dayNumber}
                  </button>
                ))}
                <button
                  onClick={() => setActiveTab('must')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'must' ? 'bg-green-500 text-black' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Must Try
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'tips' ? 'bg-green-500 text-black' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  Tips
                </button>
              </div>
              <div className="flex items-center gap-2 pr-1">
                <button onClick={openBookings} title="View all flights and trains" className="p-2 rounded-md text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20">
                  <Plane className="w-4 h-4" />
                </button>
                <button onClick={toggleFav} title={fav ? 'Unfavorite' : 'Favorite'} className={`p-2 rounded-md ${fav ? 'text-rose-300 bg-rose-400/10 hover:bg-rose-400/20' : 'text-white/80 hover:bg-white/10'}`}>
                  <Heart className={`w-4 h-4 ${fav ? 'fill-rose-300' : ''}`} />
                </button>
                <button onClick={copyAll} title="Copy markdown" className="p-2 rounded-md text-white/80 hover:bg-white/10">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={printCanvas} title="Print / Save PDF" className="p-2 rounded-md text-white/80 hover:bg-white/10">
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-green-300">Trip Overview</h3>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                  <ReactMarkdown>{(itinerary.overview || '').trim() || 'No overview provided.'}</ReactMarkdown>
                </div>
              </div>
            )}

            {typeof activeTab === 'number' && activeDay && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-green-300">{activeDay.dayTheme}</h3>
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
                    const content = activeDay.sections?.[o.key];
                    if (!content) continue;
                    const isTimelineCandidate = o.key === 'morning' || o.key === 'afternoon' || o.key === 'evening';
                    const steps = isTimelineCandidate ? parseTimedSteps(content) : [];
                    items.push(
                      <div key={o.key} className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-2 text-white/90">
                          <o.Icon className="w-4 h-4" />
                          <div className="font-semibold text-sm">{o.label}</div>
                        </div>
                        {steps.length ? (
                          <Timeline steps={steps} />
                        ) : (
                          <div className="prose prose-invert max-w-none text-white/90">
                            <ReactMarkdown>{content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return items.length ? items : (
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                      <ReactMarkdown>{activeDay.content.join('\n')}</ReactMarkdown>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'must' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-green-300 flex items-center gap-2"><Star className="w-4 h-4" /> Must Try</h3>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                  <ReactMarkdown>{(itinerary.mustTry || '').trim() || 'No recommendations provided.'}</ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === 'tips' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-green-300">Tips</h3>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                  <ReactMarkdown>{(itinerary.tips || '').trim() || 'No tips provided.'}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Print-only full itinerary */}
        <div className="hidden print:block p-8 text-black w-full">
          <h1 className="text-3xl font-bold mb-4">{tripTitle}</h1>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Trip Overview</h2>
            <div className="prose max-w-none">
              <ReactMarkdown>{(itinerary.overview || '').trim() || 'No overview provided.'}</ReactMarkdown>
            </div>
          </section>

          {normalizedDays.map((d) => (
            <section key={`print-day-${d.dayNumber}`} className="mb-6 print-page-break">
              <h2 className="text-xl font-semibold mb-2">Day {d.dayNumber}: {d.dayTheme?.replace(/^Day\s*\d+[:\-–—]?\s*/i, '')}</h2>
              <div className="space-y-3">
                {(() => {
                  const order = [
                    { key: 'overview', label: 'Overview' },
                    { key: 'morning', label: 'Morning' },
                    { key: 'afternoon', label: 'Afternoon' },
                    { key: 'evening', label: 'Evening' },
                    { key: 'meals', label: 'Meals' },
                    { key: 'logistics', label: 'Logistics & Tips' },
                  ];
                  const items = [];
                  for (const o of order) {
                    const content = d.sections?.[o.key];
                    if (!content) continue;
                    const isTimelineCandidate = o.key === 'morning' || o.key === 'afternoon' || o.key === 'evening';
                    const steps = isTimelineCandidate ? parseTimedSteps(content) : [];
                    items.push(
                      <div key={o.key}>
                        <h3 className="font-semibold">{o.label}</h3>
                        {steps.length ? (
                          <ul className="list-none pl-0">
                            {steps.map((s, i) => (
                              <li key={i} className="mb-1">
                                <span className="font-mono">{s.time}</span>{s.duration ? ` • ${s.duration}` : ''} — <strong>{s.title}</strong>{s.desc ? `: ${s.desc}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="prose max-w-none">
                            <ReactMarkdown>{content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (!items.length) {
                    return (
                      <div className="prose max-w-none">
                        <ReactMarkdown>{d.content?.join('\n') || ''}</ReactMarkdown>
                      </div>
                    );
                  }
                  return items;
                })()}
              </div>
            </section>
          ))}

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Must Try</h2>
            <div className="prose max-w-none">
              <ReactMarkdown>{(itinerary.mustTry || '').trim() || 'No recommendations provided.'}</ReactMarkdown>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Tips</h2>
            <div className="prose max-w-none">
              <ReactMarkdown>{(itinerary.tips || '').trim() || 'No tips provided.'}</ReactMarkdown>
            </div>
          </section>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
