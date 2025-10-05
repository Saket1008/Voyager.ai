'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OneClickItinerary from '../components/OneClickItinerary.jsx'
import { motion } from 'framer-motion'
import SpaceBackground from '../components/SpaceBackground.jsx'
import { useDevSettings } from '../context/DevSettingsContext.jsx'
import SimpleLoader from '../components/Loader.jsx'
import ChatboxStage from '../components/ChatboxStage.jsx'
import ItineraryCanvas from '../components/ItineraryCanvas.jsx'
import '../styles/globals.css'

function ItineraryOverlayList({ onOpen }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('voyager_local_journeys') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    const refresh = () => {
      try { setItems(JSON.parse(localStorage.getItem('voyager_local_journeys') || '[]')); } catch { setItems([]); }
    };
    try { window.addEventListener('voyager:itinerarySaved', refresh); } catch {}
    return () => { try { window.removeEventListener('voyager:itinerarySaved', refresh); } catch {} };
  }, []);
  const toggleFav = (id) => {
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      const idx = Array.isArray(arr) ? arr.findIndex(x => x.id === id) : -1;
      if (idx >= 0) {
        arr[idx].favorite = !Boolean(arr[idx].favorite);
        localStorage.setItem('voyager_local_journeys', JSON.stringify(arr));
        setItems(arr);
        try { window.dispatchEvent(new CustomEvent('voyager:itinerarySaved')); } catch {}
      }
    } catch {}
  };
  const deleteItem = (id) => {
    try {
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr) ? arr.filter(x => x.id !== id) : [];
      localStorage.setItem('voyager_local_journeys', JSON.stringify(next));
      setItems(next);
      try { window.dispatchEvent(new CustomEvent('voyager:itinerarySaved')); } catch {}
    } catch {}
  };
  return (
    <div className="divide-y divide-white/10">
      {(!Array.isArray(items) || !items.length) && (
        <div className="text-white/70 text-sm">No itineraries yet</div>
      )}
      {Array.isArray(items) && items.map((it) => (
        <div key={it.id} className="py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white/90 truncate">{it.title || 'Itinerary'}</div>
            <div className="text-xs text-white/60 truncate">
              {it.chatId ? <span className="opacity-80">Chat: {it.chatId}</span> : null}
              {it.date ? <span className="ml-2 opacity-80">Created: {new Date(it.date).toLocaleString()}</span> : null}
              {it.startDate || it.endDate ? <span className="ml-2 opacity-80">Travel: {it.startDate || '—'}{it.endDate ? ` → ${it.endDate}` : ''}</span> : null}
            </div>
          </div>
          <button
            onClick={() => toggleFav(it.id)}
            title={it.favorite ? 'Unfavorite' : 'Favorite'}
            className={`px-2 py-1 rounded-md border ${it.favorite ? 'border-rose-300 text-rose-300 bg-rose-400/10' : 'border-white/20 text-white/80 hover:bg-white/10'}`}
          >
            {it.favorite ? '★' : '☆'}
          </button>
          <button
            onClick={() => deleteItem(it.id)}
            className="px-2 py-1 rounded-md border border-white/20 text-white/70 hover:bg-white/10"
            title="Delete itinerary"
          >
            Delete
          </button>
          <button
            onClick={() => onOpen && onOpen(it)}
            className="px-3 py-1.5 rounded-md bg-green-500 text-black font-semibold hover:bg-green-400"
          >Open</button>
        </div>
      ))}
    </div>
  );
}

export default function HomeClient({ isSidebarOpen = false, setIsSidebarOpen = () => {} }) {
  const navigate = useNavigate();
  const { settings } = useDevSettings();
  const showBg = settings.devMode ? settings.showSpaceBg !== false : true;
  const showSplash = settings.devMode ? settings.showSplashLoader !== false : true;
  const showLanding = settings.devMode ? settings.showLandingStart !== false : true;
  const enableWormhole = settings.devMode ? settings.enableWormhole !== false : true;
  const startAtChat = settings.devMode ? !!settings.startAtChat : false;
  const [currentView, setCurrentView] = useState(() => {
    // On localhost, land on the Begin Journey landing by default
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'main';
    }
    return 'loading';
  })
  const [showTitle, setShowTitle] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showWormhole, setShowWormhole] = useState(false)
  const [showOneClick, setShowOneClick] = useState(false)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)
  // When an itinerary is generated we store a normalized shape: { markdown: string, plannedDays?: number|null }
  const [itineraryData, setItineraryData] = useState(null)
  const [isItineraryOpen, setIsItineraryOpen] = useState(false)
  const [showItineraryList, setShowItineraryList] = useState(false)

  const handleStartJourney = () => {
    setIsAnimating(true)
    if (enableWormhole) {
      setShowWormhole(true)
      setTimeout(() => { setShowWormhole(false); setCurrentView('final'); setIsAnimating(false); }, 4000)
    } else {
      setCurrentView('final');
      setIsAnimating(false);
    }
  }

  const handleLoadingComplete = () => {
    // decide what the next view should be, considering toggles
    if (startAtChat || !showLanding) {
      setCurrentView('final')
      return;
    }
    setCurrentView('main')
    setTimeout(() => { setShowTitle(true); setTimeout(() => setShowButton(true), 800) }, 500)
  }

  const handleItineraryGenerated = (payload) => {
    // Support both legacy string and new object payload { markdown, plannedDays }
    const markdown = typeof payload === 'string' ? payload : (payload?.markdown || '')
    const plannedDays = typeof payload === 'object' ? (payload?.plannedDays ?? null) : null
    const next = { markdown, plannedDays }
    setItineraryData(next)
    setIsItineraryOpen(true)
    try {
      localStorage.setItem('voyager_last_itinerary', JSON.stringify(next));
      localStorage.setItem('voyager_itinerary_open', '1');
      // Append to local journeys list so Live mode can use them when offline/local
      const raw = localStorage.getItem('voyager_local_journeys');
      const arr = raw ? (JSON.parse(raw) || []) : [];
      // Associate itinerary with current chat title if available
      let title = 'Itinerary';
      try {
        const chatIdx = JSON.parse(localStorage.getItem('voyager_chat_index') || '[]');
        const activeId = localStorage.getItem('voyager_active_chat');
        const found = Array.isArray(chatIdx) ? chatIdx.find(c => c.id === activeId) : null;
        if (found && found.title) title = found.title;
      } catch {}
      const travelFlow = (() => { try { return JSON.parse(localStorage.getItem('voyager_flow_state') || '{}') } catch { return {} }})();
      const itemId = `loc-${Date.now()}`;
      const item = {
        id: itemId,
        title,
        date: new Date().toISOString(),
        favorite: false,
        markdown: next.markdown,
        durationDays: next.plannedDays || null,
        locations: null,
        chatId: (() => { try { return localStorage.getItem('voyager_active_chat') || null; } catch { return null; } })(),
        startDate: travelFlow?.startDate || null,
        endDate: travelFlow?.endDate || null,
      };
      arr.unshift(item);
      // cap to last 20
      while (arr.length > 20) arr.pop();
      localStorage.setItem('voyager_local_journeys', JSON.stringify(arr));
      // Keep selected itinerary id in state for favorite toggles
      setItineraryData(prev => ({ ...(prev || next), id: itemId }))
      try { window.dispatchEvent(new CustomEvent('voyager:itinerarySaved')); } catch {}
    } catch {}
    try { setIsSidebarOpen(false) } catch {}
  }

  // Auto-progress out of loading on mount if splash is disabled or startAtChat set
  useEffect(() => {
    if (currentView === 'loading') {
      if (!showSplash) {
        handleLoadingComplete();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplash, currentView]);

  // If we land directly on 'main' (e.g., clicking Home navigates here), reveal title/buttons immediately
  useEffect(() => {
    if (currentView === 'main') {
      // Only set once to avoid flicker loops
      if (!showTitle) setShowTitle(true);
      if (!showButton) setShowButton(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Restore last itinerary on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('voyager_last_itinerary');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.markdown) {
          setItineraryData(parsed);
          const open = localStorage.getItem('voyager_itinerary_open') === '1';
          setIsItineraryOpen(open);
        }
      }
    } catch {}
  }, []);

  // Persist open/close state
  useEffect(() => {
    try { localStorage.setItem('voyager_itinerary_open', isItineraryOpen ? '1' : '0'); } catch {}
  }, [isItineraryOpen]);

  // React to global home navigation to ensure main view is visible
  useEffect(() => {
    const handler = () => {
      setIsItineraryOpen(false);
      setShowOneClick(false);
      setShowWormhole(false);
      setIsAnimating(false);
      // Show the Begin Journey landing screen
      setCurrentView('main');
      setShowTitle(true);
      setShowButton(true);
      try { setIsSidebarOpen(false) } catch {}
    };
    try { window.addEventListener('voyager:goHome', handler); } catch {}
    return () => { try { window.removeEventListener('voyager:goHome', handler); } catch {} };
  }, []);

  // Allow opening a previously saved itinerary from the sidebar
  useEffect(() => {
    const handler = (ev) => {
      try {
        const detail = ev?.detail || {};
        const markdown = detail.markdown || '';
        const plannedDays = detail.plannedDays ?? null;
        if (markdown) {
          const next = { markdown, plannedDays };
          setItineraryData(next);
          setIsItineraryOpen(true);
          setCurrentView('final');
          try { setIsSidebarOpen(false) } catch {}
        }
      } catch {}
    };
    try { window.addEventListener('voyager:openItinerary', handler); } catch {}
    return () => { try { window.removeEventListener('voyager:openItinerary', handler); } catch {} };
  }, []);

  // Toggle itinerary list overlay
  useEffect(() => {
    const handler = () => setShowItineraryList(true);
    try { window.addEventListener('voyager:openItineraryList', handler); } catch {}
    return () => { try { window.removeEventListener('voyager:openItineraryList', handler); } catch {} };
  }, []);


  return (
    <>
      {/* Background (dev toggle) */}
      {showBg && (
        <SpaceBackground isAnimating={false} />
      )}

      {/* Loader */}
      {currentView === 'loading' && showSplash && (
        <SimpleLoader onLoadingComplete={handleLoadingComplete} />
      )}
      {/* If splash is disabled, move to the next step after mount */}
      {/* We avoid calling state setters during render; use an effect instead */}
      {currentView === 'loading' && !showSplash && null}

      {/* Main */}
      {currentView === 'main' && showLanding && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="text-center mb-12">
            <h1 ref={titleRef} className={`text-white font-light tracking-widest transition-all duration-150 ${isAnimating ? 'opacity-0' : showTitle ? 'opacity-100' : 'opacity-0'}`} style={{ fontSize: '5vw', fontWeight: 200, letterSpacing: '0.5rem', textShadow: '0 0 15px rgba(173, 216, 230, 0.7)' }}>VOYAGER.AI</h1>
            <div className="mt-8 flex justify-center gap-4">
              <button ref={buttonRef} onClick={handleStartJourney} className={`group relative bg-transparent border-2 border-blue-300 text-blue-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} style={{ backdropFilter: 'blur(10px)' }}>
                BEGIN YOUR JOURNEY
              </button>
              <button
                onClick={() => navigate('/begin')}
                className={`group relative bg-transparent border-2 border-cyan-300 text-cyan-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
              >
                EXPLORE FEATURES
              </button>
              <button
                onClick={() => navigate('/dreams')}
                className={`group relative bg-transparent border-2 border-emerald-300 text-emerald-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="Plan and collaborate on dream destinations"
              >
                DREAM DESTINATIONS
              </button>
              <button
                onClick={() => navigate('/live')}
                className={`group relative bg-transparent border-2 border-purple-300 text-purple-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="Live Adventure Mode (Preview)"
              >
                LIVE ADVENTURE (PREVIEW)
              </button>
              <button
                onClick={() => navigate('/bookings')}
                className={`group relative bg-transparent border-2 border-cyan-300 text-cyan-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="View all flights and trains your itinerary needs — best, cheapest, and fastest options."
              >
                BOOKINGS REQUIRED
              </button>
              <button
                onClick={() => navigate('/memory')}
                className={`group relative bg-transparent border-2 border-amber-300 text-amber-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="Generate an AI-crafted travel journal from your journeys"
              >
                MEMORY WEAVER
              </button>
              <button
                onClick={() => setShowOneClick(v => !v)}
                className={`group relative bg-transparent border-2 border-green-300 text-green-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ backdropFilter: 'blur(10px)' }}
                title="Instant itinerary with your saved DNA"
              >
                ONE‑CLICK ITINERARY
              </button>
            </div>
            {showOneClick && (
              <div className="mt-6 pointer-events-auto mx-auto w-full max-w-2xl px-4">
                <OneClickItinerary />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Final Chat */}
      {currentView === 'final' && (
        <motion.div className="fixed inset-0 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
          <div className="h-full w-full flex">
            {/* Chat area shrinks when canvas is open */}
            <motion.div
              animate={{ width: isItineraryOpen ? '50%' : '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="h-full"
            >
              <ChatboxStage 
                isSidebarOpen={isSidebarOpen} 
                setIsSidebarOpen={setIsSidebarOpen} 
                onItineraryGenerated={handleItineraryGenerated}
              />
            </motion.div>
            {/* Canvas area expands from the right */}
            <motion.div
              animate={{ width: isItineraryOpen ? '50%' : '0%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="h-full overflow-hidden"
            >
        {itineraryData && isItineraryOpen && (
                <ItineraryCanvas 
          // Always pass a markdown string; plannedDays if provided by generator
          itineraryMarkdown={typeof itineraryData === 'string' ? itineraryData : (itineraryData?.markdown || '')}
                  onClose={() => { setIsItineraryOpen(false); try { setIsSidebarOpen(true) } catch {} }}
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => { try { setIsSidebarOpen(v => !v) } catch {} }}
          plannedDays={typeof itineraryData === 'object' ? (itineraryData?.plannedDays ?? null) : null}
                />
              )}
            </motion.div>
          </div>

          {/* Reopen chip only if the active chat has at least one saved itinerary */}
          {(() => {
            try {
              if (isItineraryOpen) return false;
              const aid = localStorage.getItem('voyager_active_chat');
              const raw = localStorage.getItem('voyager_local_journeys');
              const arr = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(arr)) return false;
              return arr.some(x => x && x.chatId && aid && x.chatId === aid);
            } catch { return false; }
          })() && (
            <div className="fixed bottom-4 right-4 z-10">
              <button
                onClick={() => setIsItineraryOpen(true)}
                className="px-4 py-2 rounded-full bg-green-500 text-black font-semibold shadow hover:bg-green-400"
                title="Open itinerary"
              >
                View itinerary
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* My Itineraries Overlay */}
      {showItineraryList && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/10 text-white shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold">My Itineraries</div>
                <button onClick={() => setShowItineraryList(false)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-white/80">Close</button>
              </div>
              <ItineraryOverlayList onOpen={(item) => {
                try {
                  // Open the itinerary in canvas
                  window.dispatchEvent(new CustomEvent('voyager:openItinerary', { detail: { markdown: item.markdown, plannedDays: item.durationDays || null, chatId: item.chatId || null } }));
                  // Also focus the associated chat in the sidebar if available
                  if (item.chatId) {
                    window.dispatchEvent(new CustomEvent('voyager:setActiveChat', { detail: { id: item.chatId } }));
                  }
                  setShowItineraryList(false);
                } catch {}
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Simple wormhole overlay */}
      {showWormhole && enableWormhole && (
        <div className="fixed inset-0 z-[9999] bg-black grid place-items-center">
          <div className="relative h-64 w-64">
            <div className="absolute inset-0 rounded-full border-2 border-sky-500/30 animate-ping"></div>
            <div className="absolute inset-4 rounded-full border-2 border-sky-400/50 animate-pulse"></div>
            <div className="absolute inset-8 rounded-full border-2 border-sky-300/80 animate-spin"></div>
          </div>
        </div>
      )}
    </>
  )
}
