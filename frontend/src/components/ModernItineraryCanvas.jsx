import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Sunrise, Sun, Moon, Utensils, Info, Copy, Printer, Star, 
  MapPin, Clock, Calendar, Users, DollarSign, Heart, Share2,
  Download, Bookmark, Navigation, Camera, Coffee, ShoppingBag
} from 'lucide-react';

// Parse markdown into structured data
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
  const tripTitle = titleMatch ? titleMatch[1].trim() : 'Your Amazing Journey';

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

// Enhanced timeline component with better visuals
function ModernTimeline({ steps = [] }) {
  if (!steps.length) return null;
  
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-teal-500"></div>
      {steps.map((s, idx) => (
        <motion.div 
          key={idx} 
          className="relative mb-6 pl-12"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <div className="absolute -left-2 top-2 w-4 h-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 border-2 border-slate-800 shadow-lg"></div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-mono text-emerald-300 font-semibold">{s.time}</span>
              {s.duration && (
                <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full">
                  {s.duration}
                </span>
              )}
            </div>
            <h4 className="text-white font-semibold mb-1">{s.title}</h4>
            {s.desc && <p className="text-slate-300 text-sm">{s.desc}</p>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Modern day card component
function DayCard({ day, isActive, onClick }) {
  return (
    <motion.div
      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-400/50 shadow-lg shadow-emerald-500/10' 
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/40'
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
          isActive 
            ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
            : 'bg-slate-700 text-slate-300'
        }`}>
          {day.dayNumber}
        </div>
        <div>
          <h3 className={`font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
            {day.dayTheme}
          </h3>
          <p className="text-xs text-slate-400">
            {Object.keys(day.sections || {}).length} activities
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ModernItineraryCanvas({ itineraryMarkdown, onClose, plannedDays = null }) {
  const itinerary = useMemo(() => parseItinerary(itineraryMarkdown), [itineraryMarkdown]);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDay, setActiveDay] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const scrollRef = useRef(null);

  if (!itinerary) return null;

  const { tripTitle, overview, dailyPlans, mustTry, tips } = itinerary;
  const normalizedDays = useMemo(() => {
    const src = dailyPlans || [];
    const p = Number(plannedDays) || 0;
    if (!p || p === src.length) return src;
    if (p < src.length) return src.slice(0, p);
    const out = [...src];
    for (let i = src.length + 1; i <= p; i++) {
      out.push({ dayNumber: String(i), dayTheme: `Day ${i}`, content: ["No details provided."], sections: { overview: 'No details provided.' } });
    }
    return out;
  }, [dailyPlans, plannedDays]);

  useEffect(() => {
    try { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, [activeTab, activeDay]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(itineraryMarkdown || ''); } catch {}
  };

  const printCanvas = () => { try { window.print(); } catch {} };

  const downloadPDF = () => {
    // Future implementation for PDF download
    console.log('PDF download feature coming soon!');
  };

  const shareItinerary = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle,
          text: `Check out my amazing travel itinerary: ${tripTitle}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      copyAll();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="modern-itinerary-canvas fixed top-0 right-0 h-full w-full md:w-[65%] lg:w-[55%] z-40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-2xl border-l border-slate-700/50 flex flex-col shadow-2xl"
      >
        {/* Modern Header */}
        <div className="print:hidden flex-shrink-0 p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{tripTitle}</h1>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {normalizedDays.length} Days
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Adventure
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Premium
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  isBookmarked 
                    ? 'bg-red-500/20 text-red-400 border border-red-400/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Heart className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </motion.button>
              
              <motion.button
                onClick={shareItinerary}
                className="p-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={copyAll}
                className="p-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Copy className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={downloadPDF}
                className="p-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-5 h-5" />
              </motion.button>
              
              <motion.button
                onClick={printCanvas}
                className="p-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50 transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Printer className="w-5 h-5" />
              </motion.button>
              
              <button 
                onClick={onClose} 
                className="p-3 rounded-xl bg-slate-700/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 border border-slate-600/50 hover:border-red-400/30 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modern Navigation Tabs */}
        <div className="print:hidden flex-shrink-0 p-4 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 overflow-x-auto">
            <motion.button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === 'overview' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Overview
              </div>
            </motion.button>
            
            {normalizedDays.map((day, index) => (
              <motion.button
                key={day.dayNumber}
                onClick={() => { setActiveTab('day'); setActiveDay(index); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'day' && activeDay === index
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Day {day.dayNumber}
                </div>
              </motion.button>
            ))}
            
            <motion.button
              onClick={() => setActiveTab('must')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === 'must' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Must Try
              </div>
            </motion.button>
            
            <motion.button
              onClick={() => setActiveTab('tips')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === 'tips' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Tips
              </div>
            </motion.button>
          </div>
        </div>

        {/* Modern Content Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  Trip Overview
                </h2>
                <div className="prose prose-invert max-w-none text-slate-300">
                  <ReactMarkdown>{overview || 'No overview provided.'}</ReactMarkdown>
                </div>
              </div>
              
              {/* Day Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {normalizedDays.map((day, index) => (
                  <DayCard
                    key={day.dayNumber}
                    day={day}
                    isActive={activeDay === index}
                    onClick={() => { setActiveTab('day'); setActiveDay(index); }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'day' && normalizedDays[activeDay] && (
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  {normalizedDays[activeDay].dayTheme}
                </h2>
                
                {(() => {
                  const day = normalizedDays[activeDay];
                  const order = [
                    { key: 'morning', label: 'Morning', Icon: Sunrise, color: 'from-orange-400 to-yellow-500' },
                    { key: 'afternoon', label: 'Afternoon', Icon: Sun, color: 'from-yellow-400 to-orange-500' },
                    { key: 'evening', label: 'Evening', Icon: Moon, color: 'from-purple-400 to-indigo-500' },
                    { key: 'meals', label: 'Meals', Icon: Utensils, color: 'from-red-400 to-pink-500' },
                    { key: 'logistics', label: 'Logistics', Icon: Info, color: 'from-blue-400 to-cyan-500' },
                  ];
                  
                  return order.map(({ key, label, Icon, color }) => {
                    const content = day.sections?.[key];
                    if (!content) return null;
                    
                    const isTimelineCandidate = key === 'morning' || key === 'afternoon' || key === 'evening';
                    const steps = isTimelineCandidate ? parseTimedSteps(content) : [];
                    
                    return (
                      <motion.div 
                        key={key} 
                        className="mb-6 last:mb-0"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-white">{label}</h3>
                        </div>
                        
                        {steps.length ? (
                          <ModernTimeline steps={steps} />
                        ) : (
                          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                            <div className="prose prose-invert max-w-none text-slate-300">
                              <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}

          {activeTab === 'must' && (
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400" />
                  Must Try Experiences
                </h2>
                <div className="prose prose-invert max-w-none text-slate-300">
                  <ReactMarkdown>{mustTry || 'No recommendations provided.'}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tips' && (
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-400" />
                  Travel Tips & Logistics
                </h2>
                <div className="prose prose-invert max-w-none text-slate-300">
                  <ReactMarkdown>{tips || 'No tips provided.'}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to parse timed steps
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
