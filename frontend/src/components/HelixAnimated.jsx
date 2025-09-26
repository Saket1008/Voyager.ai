import React from 'react';
import { motion } from 'framer-motion';

/**
 * Continuous DNA helix animation.
 * - Rotation is driven by a single rAF loop that never stops (component lifetime).
 * - Speed is controlled by a ref multiplier updated from props (`speedMult`).
 * - Safe to re-render without restarting the animation loop.
 */
export default function HelixAnimated({ highlightIndex, speedMult = 1, glow = false }) {
  const [phase, setPhase] = React.useState(0);
  const speedRef = React.useRef(1);

  React.useEffect(() => {
    // Update speed multiplier without restarting the RAF loop
    speedRef.current = Math.max(0.1, Number(speedMult) || 1);
  }, [speedMult]);

  React.useEffect(() => {
    let raf;
    const tick = () => {
      // Continuous tick, independent from props changing
      const inc = 0.02 * speedRef.current; // slightly slower base speed
      setPhase((p) => (p + inc) % (Math.PI * 2));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Visual parameters
  const W = 240; // viewBox width
  const H = 440; // viewBox height
  const cx = W / 2;
  const marginTop = 28;
  const marginBottom = 28;
  const usableH = H - marginTop - marginBottom;
  const rungs = 24;
  const step = usableH / (rungs - 1);
  const amplitude = 40; // horizontal spread
  const freq = 0.2; // twist density

  const lerp = (a, b, t) => a + (b - a) * t;

  return (
    <motion.div
      className="opacity-95"
      animate={{ rotate: [-1, 1, -1] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      style={{ filter: glow ? 'drop-shadow(0 0 14px rgba(167,243,208,0.45)) drop-shadow(0 0 20px rgba(147,197,253,0.35))' : 'none' }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[260px] w-[140px] md:h-[420px] md:w-[220px]">
        <defs>
          <linearGradient id="helix-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="100%" stopColor="#93C5FD" />
          </linearGradient>
        </defs>
        {/* Subtle backbone guide (very faint) */}
        <path d={`M${cx - amplitude} ${marginTop} Q ${cx - amplitude * 0.6} ${H / 2}, ${cx - amplitude} ${H - marginBottom}`} stroke="#7DD3FC14" strokeWidth="1" fill="none" />
        <path d={`M${cx + amplitude} ${marginTop} Q ${cx + amplitude * 0.6} ${H / 2}, ${cx + amplitude} ${H - marginBottom}`} stroke="#6EE7B71A" strokeWidth="1" fill="none" />

        {Array.from({ length: rungs }).map((_, i) => {
          const baseY = marginTop + i * step;
          const t = baseY * freq + phase;
          const xOffset = amplitude * Math.cos(t);
          const depth = (Math.sin(t) + 1) / 2; // 0..1 front/back cue
          const leftX = cx - xOffset;
          const rightX = cx + xOffset;
          const y = baseY;
          const nodeR = lerp(2.6, 5.2, depth);
          const lineWidth = lerp(0.6, 1.2, depth);
          const curveAmp = 12 * Math.cos(t + Math.PI / 2);

          const stroke = 'url(#helix-grad)';
          const fill = 'url(#helix-grad)';

          const isHi = highlightIndex === i;
          const hiOpacityBoost = isHi ? 0.25 : 0;
          const hiScale = isHi ? 1.06 : 1;

          return (
            <g key={i} style={{ transformOrigin: `${cx}px ${y}px` }}>
              {/* Rung connector */}
              <path
                d={`M${leftX} ${y} C ${cx - 8} ${y - curveAmp}, ${cx + 8} ${y + curveAmp}, ${rightX} ${y}`}
                stroke={stroke}
                strokeWidth={lineWidth * hiScale}
                fill="none"
                opacity={lerp(0.35, 0.75, depth) + hiOpacityBoost}
              />
              {isHi && (
                <path
                  d={`M${leftX} ${y} C ${cx - 8} ${y - curveAmp}, ${cx + 8} ${y + curveAmp}, ${rightX} ${y}`}
                  stroke="#ffffff"
                  strokeWidth={lineWidth * 1.6}
                  fill="none"
                  opacity={0.06}
                />
              )}
              {/* Left and right nucleotides */}
              <circle cx={leftX} cy={y} r={nodeR * hiScale} fill={fill} opacity={lerp(0.45, 0.95, depth) + hiOpacityBoost} />
              <circle cx={rightX} cy={y} r={nodeR * hiScale} fill={fill} opacity={lerp(0.45, 0.95, depth) + hiOpacityBoost} />
            </g>
          );
        })}

        {/* Cross-strand hint curves (faint) */}
        {Array.from({ length: rungs - 2 }).map((_, i) => {
          const y1 = marginTop + i * step;
          const y2 = y1 + step;
          const t1 = y1 * freq + phase;
          const t2 = y2 * freq + phase;
          const x1 = cx - amplitude * Math.cos(t1);
          const x2 = cx + amplitude * Math.cos(t2);
          return (
            <path
              key={`hint-${i}`}
              d={`M${x1} ${y1} Q ${cx} ${(y1 + y2) / 2}, ${x2} ${y2}`}
              stroke="#AEEBD826"
              strokeWidth={0.5}
              fill="none"
            />
          );
        })}
      </svg>
    </motion.div>
  );
}
