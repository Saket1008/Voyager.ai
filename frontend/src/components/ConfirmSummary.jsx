import React from 'react';

// Compact summary card used on confirm step
// Props: flowState: {
//   locations?: string[],
//   region?: string,
//   durationDays?: number,
//   startDate?: string, // YYYY-MM-DD
//   endDate?: string,   // YYYY-MM-DD
//   travelers?: number,
//   pace?: string,
//   budget?: string
// }
export default function ConfirmSummary({ flowState = {} }) {
  const {
    locations,
    region,
    durationDays,
    startDate,
    endDate,
    travelers,
    pace,
    budget,
    transportation,
    doorstep,
  } = flowState || {};

  // Derive destination label
  const destination = (() => {
    if (Array.isArray(locations) && locations.length) {
      const label = locations.filter(Boolean).join(', ');
      return label || null;
    }
    return region || null;
  })();

  // Derive days from dates if not explicitly set
  const daysDerived = (() => {
    if (durationDays && Number.isFinite(durationDays)) return durationDays;
    if (!startDate || !endDate) return null;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      // Inclusive days
      const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : null;
    } catch {
      return null;
    }
  })();

  const dateRange = startDate && endDate ? `${startDate} → ${endDate}` : (startDate || endDate || null);
  const pax = Number.isFinite(travelers) ? `${travelers}` : null;
  const chips = [
    daysDerived ? `${daysDerived} days` : null,
    pax ? `${pax} travelers` : null,
    pace || null,
    budget || null,
    // Transport mode chip
    (() => {
      try {
        if (transportation && typeof transportation === 'object') {
          const mode = transportation.mode || transportation.type;
          if (mode) return String(mode);
        } else if (typeof transportation === 'string') {
          return transportation;
        }
      } catch {}
      return null;
    })(),
    // Doorstep chip
    (() => {
      if (doorstep === true) return 'Start: Doorstep';
      if (doorstep === false) return 'Start: At destination';
      if (typeof doorstep === 'string' && doorstep.trim()) return doorstep;
      return null;
    })(),
  ].filter(Boolean);

  if (!destination && !dateRange && !chips.length) {
    return null; // nothing to show
  }

  return (
    <div className="w-full rounded-2xl bg-white/6 border border-white/15 p-4 md:p-5 backdrop-blur-md" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Review summary</div>
          {destination && (
            <div className="text-white text-base md:text-lg font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span>{destination}</span>
            </div>
          )}
          {dateRange && (
            <div className="text-white/90 text-sm md:text-base mt-1">{dateRange}</div>
          )}
        </div>
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/90">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}
