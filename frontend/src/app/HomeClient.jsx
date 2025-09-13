'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import SpaceBackground from '../components/SpaceBackground.jsx'
import SimpleLoader from '../components/Loader.jsx'
import ChatboxStage from '../components/ChatboxStage.jsx'
import ItineraryCanvas from '../components/ItineraryCanvas.jsx'
import '../styles/globals.css'

export default function HomeClient({ isSidebarOpen = false, setIsSidebarOpen = () => {} }) {
  const [currentView, setCurrentView] = useState('loading')
  const [showTitle, setShowTitle] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showWormhole, setShowWormhole] = useState(false)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)
  // When an itinerary is generated we store a normalized shape: { markdown: string, plannedDays?: number|null }
  const [itineraryData, setItineraryData] = useState(null)
  const [isItineraryOpen, setIsItineraryOpen] = useState(false)

  const handleStartJourney = () => {
    setIsAnimating(true)
    setShowWormhole(true)
    setTimeout(() => { setShowWormhole(false); setCurrentView('final'); setIsAnimating(false); }, 4000)
  }

  const handleLoadingComplete = () => {
    setCurrentView('main')
    setTimeout(() => { setShowTitle(true); setTimeout(() => setShowButton(true), 800) }, 500)
  }

  const handleItineraryGenerated = (payload) => {
    // Support both legacy string and new object payload { markdown, plannedDays }
    const markdown = typeof payload === 'string' ? payload : (payload?.markdown || '')
    const plannedDays = typeof payload === 'object' ? (payload?.plannedDays ?? null) : null
    setItineraryData({ markdown, plannedDays })
    setIsItineraryOpen(true)
    try { setIsSidebarOpen(false) } catch {}
  }


  return (
    <>
      {/* Background */}
      <SpaceBackground isAnimating={false} />

      {/* Loader */}
      {currentView === 'loading' && (
        <SimpleLoader onLoadingComplete={handleLoadingComplete} />
      )}

      {/* Main */}
      {currentView === 'main' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="text-center mb-12">
            <h1 ref={titleRef} className={`text-white font-light tracking-widest transition-all duration-150 ${isAnimating ? 'opacity-0' : showTitle ? 'opacity-100' : 'opacity-0'}`} style={{ fontSize: '5vw', fontWeight: 200, letterSpacing: '0.5rem', textShadow: '0 0 15px rgba(173, 216, 230, 0.7)' }}>VOYAGER.AI</h1>
            <div className="mt-8 flex justify-center">
              <button ref={buttonRef} onClick={handleStartJourney} className={`group relative bg-transparent border-2 border-blue-300 text-blue-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 ${isAnimating ? 'opacity-0' : showButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} style={{ backdropFilter: 'blur(10px)' }}>
                BEGIN YOUR JOURNEY
              </button>
            </div>
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

          {/* Reopen chip when canvas closed but data exists */}
          {itineraryData && !isItineraryOpen && (
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

      {/* Simple wormhole overlay */}
      {showWormhole && (
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
