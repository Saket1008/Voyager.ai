/**
 * Voyager.AI - Main Home Page
 * A cosmic journey planner with animated space background,
 * elegant loading animation, and interactive trip wizard
 */

import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import SpaceBackground from '../components/SpaceBackground';
import SimpleLoader from '../components/SimpleLoader';
import WormholeTransition from '../components/WormholeTransition';

export default function Home() {
  const [currentView, setCurrentView] = useState('loading'); // 'loading', 'main', 'wormhole', 'final'
  const [showTitle, setShowTitle] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWormholeActive, setIsWormholeActive] = useState(false);
  const titleRef = useRef(null);
  const buttonRef = useRef(null);

  const handleStartJourney = () => {
    console.log('handleStartJourney: Starting journey');
    // Add a small delay to ensure proper state transition
    setIsAnimating(true);
    setCurrentView('wormhole');
    
    // Small delay to ensure the wormhole component is properly mounted
    setTimeout(() => {
      console.log('handleStartJourney: Setting wormhole active');
      setIsWormholeActive(true);
    }, 100);
  };

  const handleWormholeComplete = () => {
    console.log('handleWormholeComplete: Animation completed');
    setIsWormholeActive(false);
    setCurrentView('final');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
    setShowTitle(true);
    setTimeout(() => setShowButton(true), 800);
  };

  const handleLoadingComplete = () => {
    setCurrentView('main');
    // Show title first
    setTimeout(() => {
      setShowTitle(true);
      // Then show button after title appears
      setTimeout(() => {
        setShowButton(true);
      }, 800);
    }, 500);
  };

  return (
    <>
      <Head>
        <title>Voyager.AI - Your Cosmic Journey Planner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Space Background - Always visible */}
      <SpaceBackground isAnimating={false} />
      
      {/* Wormhole Transition - Overlay when active */}
      <WormholeTransition 
        isActive={isWormholeActive} 
        onTransitionComplete={handleWormholeComplete}
      />
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 z-[10000] text-white text-sm bg-black/50 p-2 rounded">
          <div>Current View: {currentView}</div>
          <div>Wormhole Active: {isWormholeActive ? 'Yes' : 'No'}</div>
          <div>Animating: {isAnimating ? 'Yes' : 'No'}</div>
        </div>
      )}
      
      {/* Simple Loader overlay */}
      {currentView === 'loading' && (
        <SimpleLoader onLoadingComplete={handleLoadingComplete} />
      )}

      {/* Main App Content */}
      {currentView !== 'loading' && (
        <>
          {/* Main View */}
          {currentView === 'main' && (
            <div className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="text-center mb-12">
                <h1 
                  ref={titleRef}
                  className={`text-white font-light tracking-widest transition-all duration-150 ${
                    isAnimating ? 'opacity-0 transform scale-100' : 
                    showTitle ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-75'
                  }`}
                  style={{
                    fontSize: '5vw',
                    fontWeight: '200',
                    letterSpacing: '0.5rem',
                    textShadow: '0 0 15px rgba(173, 216, 230, 0.7)',
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                  }}
                >
                  VOYAGER.AI
                </h1>
                
                <div className="mt-8 flex justify-center">
                  <button
                    ref={buttonRef}
                    onClick={handleStartJourney}
                    className={`group relative bg-transparent border-2 border-blue-300 text-blue-200 px-8 py-4 rounded-lg font-light tracking-wider transition-all duration-150 hover:bg-blue-300 hover:text-gray-900 hover:shadow-2xl transform hover:scale-105 ${
                      isAnimating ? 'opacity-0 transform translate-y-0' : 
                      showButton ? 'opacity-100 transform translate-y-0 pointer-events-auto' : 'opacity-0 transform translate-y-10 pointer-events-none'
                    }`}
                    style={{
                      background: 'linear-gradient(135deg, rgba(173, 216, 230, 0.1) 0%, rgba(173, 216, 230, 0.05) 100%)',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 0 20px rgba(173, 216, 230, 0.3)',
                      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                      letterSpacing: '0.2rem'
                    }}
                  >
                    <span className="relative z-10 flex items-center">
                      <svg 
                        className="w-5 h-5 mr-3 transition-transform duration-300 group-hover:rotate-12" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                        />
                      </svg>
                      BEGIN YOUR JOURNEY
                    </span>
                    
                    {/* Floating particles effect */}
                    <div className="absolute inset-0 overflow-hidden rounded-lg opacity-50">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-blue-300 rounded-full animate-pulse"
                          style={{
                            left: `${20 + i * 15}%`,
                            top: `${30 + (i % 2) * 40}%`,
                            animationDelay: `${i * 0.2}s`,
                            animationDuration: `${2 + i * 0.3}s`
                          }}
                        />
                      ))}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Final View - Simple message with same backdrop theme */}
          {currentView === 'final' && (
            <div className="fixed inset-0 flex flex-col items-center justify-center z-20">
              <div className="text-center">
                <h2 className="text-blue-200 text-4xl font-light tracking-widest mb-8"
                    style={{ 
                      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                      textShadow: '0 0 15px rgba(173, 216, 230, 0.7)'
                    }}>
                  Chat will appear here
                </h2>
                <p className="text-blue-300/70 text-lg mb-8 max-w-md">
                  Your cosmic journey through the wormhole is complete. The chat interface will be integrated here with the same beautiful space backdrop.
                </p>
                <button
                  onClick={handleBackToMain}
                  className="px-8 py-4 bg-transparent border-2 border-blue-300 text-blue-200 rounded-lg font-light tracking-wide hover:bg-blue-300 hover:text-gray-900 transition-all duration-300"
                >
                  ← Back to Home
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
