import React, { useEffect, useRef, useState } from 'react';

/**
 * SimpleLoader - Orbiting dot loader with trail effect
 * Shows a white dot that orbits in a circle leaving a fading white trail
 * Displays animated "Loading..." text with cycling dots below
 */

const SimpleLoader = ({ onLoadingComplete }) => {
  const canvasRef = useRef(null);
  const [loadingDots, setLoadingDots] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    let width = canvas.width;
    let height = canvas.height;
    let angle = 0;
    let animationId;
    let trailPoints = [];
    
    // Animated loading dots
    const updateLoadingDots = () => {
      setLoadingDots(prev => {
        if (prev === '') return '.';
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '';
      });
    };
    
    const dotsInterval = setInterval(updateLoadingDots, 500);
    
    // Simple orbiting star loader with trail
    const drawOrbitingStar = () => {
      // Fade the entire canvas slightly to create trail effect
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.05;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      
      const centerX = width / 2;
      const centerY = height / 2;
      const orbitRadius = 27;
      
      // Calculate dot position in circular orbit
      const dotX = centerX + Math.cos(angle) * orbitRadius;
      const dotY = centerY + Math.sin(angle) * orbitRadius;
      
      // Add current position to trail
      trailPoints.push({ x: dotX, y: dotY, alpha: 1.0 });
      
      // Keep trail length manageable
      if (trailPoints.length > 30) {
        trailPoints.shift();
      }
      
      // Draw trail
      trailPoints.forEach((point, index) => {
        const trailAlpha = (index / trailPoints.length) * 0.6;
        const trailSize = 2 + (index / trailPoints.length) * 2;
        
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha})`;
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 8 * trailAlpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      
      // Draw the main orbiting white dot
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 15;
      
      // Draw main dot/circle
      const dotSize = 6;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      angle += 0.08; // Rotation speed
      
      animationId = requestAnimationFrame(drawOrbitingStar);
    };
    
    // Auto-complete loading shortly after start
    const loadingTimer = setTimeout(() => {
      if (onLoadingComplete) {
        onLoadingComplete();
      }
    }, 200);

    // Start the animation
    drawOrbitingStar();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(dotsInterval);
      clearTimeout(loadingTimer);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener('resize', setCanvasSize);
      window.removeEventListener('resize', handleResize);
    };
  }, [onLoadingComplete]);

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'transparent' }}>
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Loading text with animated dots */}
      <div 
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center"
        style={{
          marginTop: '80px',
          fontSize: '1.8rem',
          fontWeight: '300',
          letterSpacing: '0.1rem',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          zIndex: 10
        }}
      >
        Loading{loadingDots}
      </div>
    </div>
  );
};

export default SimpleLoader;


