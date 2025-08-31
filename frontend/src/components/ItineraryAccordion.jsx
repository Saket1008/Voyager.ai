import React, { useMemo, useState } from 'react';

function parseMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  const data = { title: '', tagline: '', overview: {}, days: [] };
  const titleLine = lines.find(l => l.trim().startsWith('# '));
  data.title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : '';
  let titleIdx = lines.findIndex(l => l.trim().startsWith('# '));
  let i = titleIdx >= 0 ? titleIdx + 1 : 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && !lines[i].trim().startsWith('*') && !/^#{2,}/.test(lines[i].trim())) {
    data.tagline = lines[i].trim();
  }
  for (const line of lines) {
    const m = line.match(/^\*\s*\*\*(.+?):\*\*\s*(.+)$/);
    if (m) data.overview[m[1].trim()] = m[2].trim();
  }
  const dayIdxs = [];
  lines.forEach((l, idx) => { if (l.trim().startsWith('#### Day ')) dayIdxs.push(idx); });
  for (let d = 0; d < dayIdxs.length; d++) {
    const start = dayIdxs[d];
    const end = d + 1 < dayIdxs.length ? dayIdxs[d + 1] : lines.length;
    const header = lines[start].trim();
    const m = header.match(/^####\s+Day\s+(\d+):\s+(.+)\s+\((\d{4}-\d{2}-\d{2})\)\s*$/);
    const day = { number: d + 1, theme: '', date: '', morning: [], afternoon: [], evening: [] };
    if (m) { day.number = parseInt(m[1], 10); day.theme = m[2]; day.date = m[3]; }
    let sec = '';
    for (let j = start + 1; j < end; j++) {
      const t = lines[j].trim();
      if (/^\*\*Morning:\*\*/i.test(t)) { sec = 'morning'; continue; }
      if (/^\*\*Afternoon:\*\*/i.test(t)) { sec = 'afternoon'; continue; }
      if (/^\*\*Evening:\*\*/i.test(t)) { sec = 'evening'; continue; }
      if (t.startsWith('*')) {
        const text = t.replace(/^\*\s*/, '');
        if (sec) day[sec].push(text);
      }
    }
    data.days.push(day);
  }
  return data;
}

function iconFor(text) {
  const t = text.toLowerCase();
  if (t.includes('cuisine') || t.includes('restaurant') || t.includes('dinner') || t.includes('lunch') || t.includes('breakfast')) return '🍴';
  if (t.includes('taxi') || t.includes('bus') || t.includes('train') || t.includes('metro') || t.includes('rickshaw')) return '🚗';
  if (t.includes('hidden gem') || t.includes('tip') || t.includes('insider')) return '💡';
  if (t.includes('temple') || t.includes('museum') || t.includes('fort') || t.includes('landmark')) return '🏛️';
  if (t.includes('contingency') || t.includes('bad weather')) return '⛈️';
  return '•';
}

export default function ItineraryAccordion({ md }) {
  const data = useMemo(() => parseMarkdown(md), [md]);
  const [openIndex, setOpenIndex] = useState(0);

  if (!data.days.length) {
    // Fallback: render raw
    return <div className="text-sm whitespace-pre-wrap">{md}</div>;
  }

  return (
    <div className="text-white/90">
      {/* Header inside bubble */}
      <div className="mb-2">
        {data.title ? <div className="text-base font-bold text-white">{data.title}</div> : null}
        {data.tagline ? <div className="mt-0.5 text-xs text-white/80">{data.tagline}</div> : null}
      </div>
      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {['Travel Dates','Focus','Pace','Budget'].map(k => (
          data.overview[k] ? (
            <div key={k} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-white/60">{k}</div>
              <div className="text-xs font-medium text-white">{data.overview[k]}</div>
            </div>
          ) : null
        ))}
      </div>

      {/* Accordion */}
      <div className="space-y-2">
        {data.days.map((day, idx) => (
          <div key={idx} className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  Day {day.number}: {day.theme} <span className="text-white/70">({day.date})</span>
                </div>
              </div>
              <div className={`shrink-0 transition-transform duration-300 ${openIndex === idx ? 'rotate-180' : ''}`}>▾</div>
            </button>
            <div className="px-3 pb-2" style={{ display: openIndex === idx ? 'block' : 'none' }}>
              <div className="grid gap-2">
                {day.morning?.length ? (
                  <Section title="Morning" items={day.morning} />
                ) : null}
                {day.afternoon?.length ? (
                  <Section title="Afternoon" items={day.afternoon} />
                ) : null}
                {day.evening?.length ? (
                  <Section title="Evening" items={day.evening} />
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, items }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2">
      <div className="text-[11px] font-semibold text-white mb-1">{title}</div>
      <ul className="text-[12px] leading-relaxed">
        {items.map((raw, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="w-4 text-center">{iconFor(raw)}</span>
            <span className="whitespace-pre-wrap">{raw}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
