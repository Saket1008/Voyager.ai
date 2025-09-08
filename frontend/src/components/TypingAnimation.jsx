import React, { useState, useEffect, useRef } from 'react';

const TypingAnimation = ({ 
  text, 
  speed = 30, 
  pauseDuration = 1000, 
  onComplete,
  showCursor = true,
  enableCorrections = true 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCursorBlink, setShowCursorBlink] = useState(true);
  const timeoutRef = useRef(null);
  const cursorIntervalRef = useRef(null);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedText('');
    
    let currentIndex = 0;
    let isCorrecting = false;
    let correctionIndex = 0;
    
    const typeText = () => {
      if (currentIndex >= text.length && !isCorrecting) {
        setIsTyping(false);
        onComplete?.();
        return;
      }

      // Random pause logic
      const shouldPause = Math.random() < 0.15 && currentIndex > 0; // 15% chance to pause
      const pauseTime = shouldPause ? Math.random() * 800 + 200 : 0; // 200-1000ms pause
      
      // Correction logic (only for longer texts and if enabled)
      const shouldCorrect = enableCorrections && 
                           text.length > 20 && 
                           Math.random() < 0.1 && // 10% chance
                           currentIndex > 10 && 
                           !isCorrecting;

      if (shouldCorrect && currentIndex > 0) {
        // Start correction
        isCorrecting = true;
        correctionIndex = currentIndex;
        
        const correctText = () => {
          if (correctionIndex > 0) {
            correctionIndex--;
            setDisplayedText(text.slice(0, correctionIndex));
            timeoutRef.current = setTimeout(correctText, Math.random() * 50 + 30); // 30-80ms
          } else {
            // Start retyping
            isCorrecting = false;
            timeoutRef.current = setTimeout(typeText, Math.random() * 100 + 50);
          }
        };
        
        timeoutRef.current = setTimeout(correctText, Math.random() * 200 + 100);
        return;
      }

      // Normal typing
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        
        // Variable typing speed
        const baseSpeed = speed;
        const variation = Math.random() * 20 - 10; // ±10ms variation
        const finalSpeed = Math.max(10, baseSpeed + variation);
        
        timeoutRef.current = setTimeout(typeText, finalSpeed + pauseTime);
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };

    // Start typing after a small delay
    timeoutRef.current = setTimeout(typeText, Math.random() * 300 + 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, pauseDuration, onComplete, enableCorrections]);

  // Cursor blinking effect
  useEffect(() => {
    if (showCursor) {
      cursorIntervalRef.current = setInterval(() => {
        setShowCursorBlink(prev => !prev);
      }, 530);
    }

    return () => {
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, [showCursor]);

  return (
    <span className="inline-block">
      {displayedText}
      {showCursor && (isTyping || showCursorBlink) && (
        <span className="inline-block w-0.5 h-4 bg-white/80 ml-0.5 animate-pulse" />
      )}
    </span>
  );
};

export default TypingAnimation;
