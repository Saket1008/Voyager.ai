import React, { useMemo, useState } from 'react';

function parseMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  const data = { title: '', tagline: '', overview: {}, days: [] };
  const titleLine = lines.find(l => l.trim().startsWith('# '));
  data.title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : '';
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
  if (t.includes('cuisine') || t.includes('restaurant') || t.includes('dinner') || t.includes('lunch') || t.includes('breakfast')) return '🍽️';
  if (t.includes('taxi') || t.includes('bus') || t.includes('train') || t.includes('metro') || t.includes('rickshaw')) return '🚗';
  if (t.includes('hidden gem') || t.includes('tip') || t.includes('insider')) return '💡';
  if (t.includes('temple') || t.includes('museum') || t.includes('fort') || t.includes('landmark')) return '🏛️';
  if (t.includes('contingency') || t.includes('bad weather')) return '⛈️';
  return '📍';
}

function extractMeta(text) {
  const time = (text.match(/(\b\d{1,2}:\d{2}\s?(?:AM|PM)?)/i) || [])[1] || null;
  const duration = (text.match(/\b(?:Duration\s*)?((?:\d+\s*hr\s*)?\d+\s*min)\b/i) || [])[1] || null;
  const distance = (text.match(/\b(\d+(?:\.\d+)?)\s*(km|mi)\b/i) || [])[1] ? `${RegExp.$1} ${RegExp.$2}` : null;
  const strong = (text.match(/\*\*(.+?)\*\*/) || [])[1] || null;
  return { time, duration, distance, strong };
}

export default function ItineraryResults({ md }) {
  const data = useMemo(() => parseMarkdown(md), [md]);
  const [dayIdx, setDayIdx] = useState(0);
  const dest = useMemo(() => {
    const m = (data.title || '').match(/Itinerary:\s*(.+)$/i);
    return m ? m[1] : 'Trip';
  }, [data.title]);

  if (!data.days.length) return <div className="text-sm whitespace-pre-wrap">{md}</div>;

  const day = data.days[dayIdx] || data.days[0];
  const items = [
    ...day.morning.map(x => ({ section: 'Morning', text: x })),
    ...day.afternoon.map(x => ({ section: 'Afternoon', text: x })),
    ...day.evening.map(x => ({ section: 'Evening', text: x })),
  ];

  return (
    <div className="text-white/90">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-base font-semibold">Trip to {dest} <span className="text-white/60">(v1)</span></div>
        <div className="flex items-center gap-2">
          <button className="rounded-full bg-yellow-400/90 text-black text-[11px] px-3 py-1 font-semibold hover:brightness-105">Shortlisted Hotels →</button>
          <button className="rounded-full bg-white/10 border border-white/20 text-[11px] px-3 py-1 hover:bg-white/15">Map View ⤢</button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {data.days.map((d, i) => (
          <button key={i} onClick={() => setDayIdx(i)} className={`rounded-full px-3 py-1 text-[12px] border ${i===dayIdx? 'bg-white text-black border-white' : 'bg-white/5 border-white/20 text-white hover:bg-white/10'}`}>Day {d.number}</button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => {
          const meta = extractMeta(it.text);
          const icon = iconFor(it.text);
          const title = meta.strong || it.text.replace(/\*\*|__/g, '').slice(0, 80);
          return (
            <div key={idx} className="rounded-xl border border-white/15 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-lg">{icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{title}</div>
                  <div className="text-[12px] text-white/80 line-clamp-2">{it.text.replace(/\*\*(.+?)\*\*/g, '$1')}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {meta.time ? <Chip>{meta.time}</Chip> : null}
                  {meta.duration ? <Chip>{meta.duration}</Chip> : null}
                  {meta.distance ? <Chip>{meta.distance}</Chip> : null}
                  <button className="ml-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px]">•••</button>
                </div>
              </div>
              <div className="mt-2 text-[12px] text-white/70">
                <span className="rounded-md bg-white/5 px-2 py-0.5 mr-1">{it.section}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[12px] text-white/60">Suitable for all ages and fitness levels</div>
        <button className="rounded-full bg-[#25D366] text-black text-[12px] px-3 py-1 font-semibold">WhatsApp</button>
      </div>
    </div>
  );
}

function Chip({ children }) {
  return <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/90">{children}</span>;
}
