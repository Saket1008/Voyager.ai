import React, { useState, useMemo, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '../lib/auth';
import { api } from '../lib/api';
import ItineraryView from './ItineraryView';
import SimpleLoader from './SimpleLoader';

const LOCATION_GROUPS = {
  countries: ['Germany', 'France', 'United Kingdom', 'Belgium', 'Italy', 'Spain', 'Switzerland'],
  regions: ['Europe', 'Asia', 'South America', 'North America', 'Africa']
};

export default function ChatWizard() {
  const { getToken } = useAuth();
  const [step, setStep] = useState(1);
  const [destinations, setDestinations] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [days, setDays] = useState('');
  const [flexible, setFlexible] = useState(false);
  const [flexStart, setFlexStart] = useState(false);
  const [flexEnd, setFlexEnd] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [tripType, setTripType] = useState('Nature Lover');
  const [budget, setBudget] = useState('Economical');
  const [stay, setStay] = useState('Hotels');
  const [flightPref, setFlightPref] = useState('Direct only');
  const [localTransport, setLocalTransport] = useState('Public Transport');
  const [needs, setNeeds] = useState({ visa: true, insurance: true, translation: false });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const computedEndDate = useMemo(() => {
    if (!startDate || !days) return '';
    const d = new Date(startDate);
    const n = parseInt(days, 10);
    if (Number.isNaN(n)) return '';
    d.setDate(d.getDate() + (n - 1));
    return d.toISOString().slice(0, 10);
  }, [startDate, days]);

  useEffect(() => {
    if (!endDate && computedEndDate) setEndDate(computedEndDate);
  }, [computedEndDate, endDate]);

  function toggleList(list, value) {
    return list.includes(value) ? list.filter(x => x !== value) : [...list, value];
  }

  async function handleDestinationsSubmit() {
    try {
      setLoading(true); setError('');
      const token = await getToken();
      const data = await api.suggest(destinations, token);
      setSuggestion(data);
      const firstNum = String(data.recommended_days || '').match(/\d+/)?.[0];
      if (firstNum) setDays(firstNum);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleGenerate() {
    try {
      setLoading(true); setError('');
      const payload = {
        destinations,
        duration_days: Number(days),
        duration_flexible: flexible,
        dates: { start: startDate, end: endDate, flex_start: flexStart, flex_end: flexEnd },
        travelers: { adults, children_under5: children },
        trip_type: tripType,
        budget,
        accommodation: stay,
        flight_preference: flightPref,
        local_transport: localTransport,
        vegetarian_jain: true,
        needs,
      };
      const token = await getToken();
      const data = await api.itinerary(payload, token);
      setResult(data);
      setStep(99);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">🌌 Voyager AI – Trip Planner</h1>
        <SignedOut><SignInButton mode="modal"><button className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Sign in</button></SignInButton></SignedOut>
      </div>

      {error && (<div className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-800 text-sm">{error}</div>)}
      {loading && <SimpleLoader />}

      <SignedIn>
        {step === 1 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">1) Where do you want to travel?</h2>
            <div className="text-sm text-slate-400">Choose <b>Specific locations</b> (countries) and/or <b>Regions</b>. No free text.</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-slate-400 mb-2">Specific locations</div>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_GROUPS.countries.map(c => (
                    <button key={c} onClick={() => setDestinations(prev => toggleList(prev, c))}
                      className={`px-3 py-1.5 rounded-full border ${destinations.includes(c) ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-2">Regions</div>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_GROUPS.regions.map(r => (
                    <button key={r} onClick={() => setDestinations(prev => toggleList(prev, r))}
                      className={`px-3 py-1.5 rounded-full border ${destinations.includes(r) ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button disabled={loading || destinations.length === 0} onClick={handleDestinationsSubmit}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50">Get suggestions</button>
            </div>
            {loading && <div className="text-sm text-slate-400">Thinking…</div>}
            {suggestion && (
              <div className="mt-4 text-sm">
                <div className="text-slate-400">Gemini suggests:</div>
                <div>Days: <span className="font-medium">{suggestion.recommended_days}</span></div>
                <div>Best Months: <span className="font-medium">{suggestion.best_months}</span></div>
                <div>Budget: <span className="font-medium">{suggestion.estimated_budget}</span></div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">2) How many days?</h2>
            <input type="number" min="1" value={days} onChange={e => setDays(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)} /> Flexible (+/– 2 days)
            </label>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">3) Dates</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-slate-400 mb-1">Start date</div>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800"/>
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-1">End date (auto)</div>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800"/>
              </div>
            </div>
            {flexible && (
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={flexStart} onChange={e => setFlexStart(e.target.checked)} /> Start can shift</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={flexEnd} onChange={e => setFlexEnd(e.target.checked)} /> End can shift</label>
                <div className="text-slate-400">(Everything is flexible)</div>
              </div>
            )}
            {suggestion?.best_months && (
              <div className="text-sm text-slate-400">Preferred time to visit: {suggestion.best_months}</div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(4)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">4) Travelers</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Adults</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAdults(Math.max(1, adults - 1))} className="px-2 py-1 rounded bg-slate-800">-</button>
                  <span className="w-6 text-center">{adults}</span>
                  <button onClick={() => setAdults(adults + 1)} className="px-2 py-1 rounded bg-slate-800">+</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span>Children (&lt;5)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setChildren(Math.max(0, children - 1))} className="px-2 py-1 rounded bg-slate-800">-</button>
                  <span className="w-6 text-center">{children}</span>
                  <button onClick={() => setChildren(children + 1)} className="px-2 py-1 rounded bg-slate-800">+</button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(5)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">5) Trip Type</h2>
            <div className="flex flex-wrap gap-2">
              {['Adventure','Relaxing','Romantic','Pilgrimage','Family','Business','Nature Lover'].map(t => (
                <button key={t} onClick={() => setTripType(t)}
                  className={`px-3 py-1.5 rounded-full border ${tripType === t ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(6)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">6) Budget</h2>
            <div className="flex flex-wrap gap-2">
              {['Saver','Economical','Premium','No Limit'].map(b => (
                <button key={b} onClick={() => setBudget(b)}
                  className={`px-3 py-1.5 rounded-full border ${budget === b ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{b}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(5)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(7)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">7) Accommodation</h2>
            <div className="flex flex-wrap gap-2">
              {['Hotels','Airbnb','Resorts','Hostels'].map(s => (
                <button key={s} onClick={() => setStay(s)}
                  className={`px-3 py-1.5 rounded-full border ${stay === s ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(6)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(8)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
              </div>
            )}

        {step === 8 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">8) Flights</h2>
            <div className="flex flex-wrap gap-2">
              {['Direct only','Cheapest','Flexible'].map(s => (
                <button key={s} onClick={() => setFlightPref(s)}
                  className={`px-3 py-1.5 rounded-full border ${flightPref === s ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(7)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(9)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
          </div>
        </div>
        )}

        {step === 9 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">9) Local Transport</h2>
            <div className="flex flex-wrap gap-2">
              {['Public Transport','Car Rental','Private Taxi'].map(s => (
                <button key={s} onClick={() => setLocalTransport(s)}
                  className={`px-3 py-1.5 rounded-full border ${localTransport === s ? 'bg-sky-600 border-sky-500' : 'bg-slate-950/60 border-slate-800'}`}>{s}</button>
              ))}
              </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(8)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button onClick={() => setStep(10)} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700">Next</button>
            </div>
          </div>
        )}

        {step === 10 && (
          <div className="space-y-4 rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
            <h2 className="text-lg font-semibold">10) Special Considerations</h2>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={needs.visa} onChange={e => setNeeds({ ...needs, visa: e.target.checked })}/> Visa guidance</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={needs.insurance} onChange={e => setNeeds({ ...needs, insurance: e.target.checked })}/> Travel insurance</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={needs.translation} onChange={e => setNeeds({ ...needs, translation: e.target.checked })}/> Language support</label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(9)} className="px-4 py-2 rounded-xl bg-slate-800">Back</button>
              <button disabled={loading} onClick={handleGenerate} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">Generate Itinerary</button>
            </div>
            {loading && <div className="text-sm text-slate-400">Generating…</div>}
        </div>
      )}

        {step === 99 && (
          <div className="space-y-4">
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
              <h2 className="text-lg font-semibold mb-2">Your Itinerary</h2>
              <ItineraryView data={result} />
            </div>
            <button onClick={() => { setResult(null); setStep(1); }} className="px-4 py-2 rounded-xl bg-slate-800">Plan another trip</button>
      </div>
        )}
      </SignedIn>

      <SignedOut>
        <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">Please sign in to plan a trip.</div>
      </SignedOut>
    </div>
  );
}
