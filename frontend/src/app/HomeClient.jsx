'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import SpaceBackground from '../components/SpaceBackground.jsx'
import SimpleLoader from '../components/Loader.jsx'
import ChatboxStage from '../components/ChatboxStage.jsx'
import '../styles/globals.css'

export default function HomeClient() {
  const [currentView, setCurrentView] = useState('loading')
  const [showTitle, setShowTitle] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showWormhole, setShowWormhole] = useState(false)
  const titleRef = useRef(null)
  const buttonRef = useRef(null)

  const handleStartJourney = () => {
    setIsAnimating(true)
    setShowWormhole(true)
    setTimeout(() => { setShowWormhole(false); setCurrentView('final'); setIsAnimating(false); }, 4000)
  }

  const handleLoadingComplete = () => {
    setCurrentView('main')
    setTimeout(() => { setShowTitle(true); setTimeout(() => setShowButton(true), 800) }, 500)
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
          <ChatboxStage />
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
