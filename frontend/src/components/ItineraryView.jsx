import React from 'react';

export default function ItineraryView({ data }) {
  if (!data) return null;
  const { summary, flights = [], hotels = [], daily_plan = [], transport = [], notes = [] } = data;
  return (
    <div className="space-y-6">
      {summary && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h2 className="text-xl font-semibold mb-2">✨ Trip Summary</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div><div className="text-slate-400">Days</div><div className="font-medium">{summary.recommended_days}</div></div>
            <div><div className="text-slate-400">Best Months</div><div className="font-medium">{summary.best_months}</div></div>
            <div><div className="text-slate-400">Budget</div><div className="font-medium">{summary.estimated_budget}</div></div>
          </div>
          {summary.key_tips?.length > 0 && (
            <div className="mt-4">
              <div className="text-slate-400 mb-1">Key Tips</div>
              <ul className="list-disc pl-5 space-y-1">
                {summary.key_tips.map((t, i) => (<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}

      {flights.length > 0 && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h3 className="text-lg font-semibold mb-2">✈️ Flights</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {flights.map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="font-medium">{f.from} → {f.to}</div>
                <div className="text-sm text-slate-400">{f.airline} • {f.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hotels.length > 0 && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h3 className="text-lg font-semibold mb-2">🏨 Hotels</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {hotels.map((h, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="font-medium">{h.city}: {h.name}</div>
                <div className="text-sm text-slate-400">{h.checkIn} → {h.checkOut}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {daily_plan.length > 0 && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h3 className="text-lg font-semibold mb-4">📅 Daily Plan</h3>
          <div className="space-y-3">
            {daily_plan.map((d, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="font-medium">Day {d.day} – {d.city}</div>
                <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                  {d.activities?.map((a, j) => (<li key={j}>{a}</li>))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {transport.length > 0 && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h3 className="text-lg font-semibold mb-2">🚇 Transport</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {transport.map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
          <h3 className="text-lg font-semibold mb-2">📌 Notes</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {notes.map((n, i) => (<li key={i}>{n}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}
