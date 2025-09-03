import React, { useState, useEffect } from 'react';

export default function StageInput({
  inputSpec = { type: 'freeText' },
  quickOptions = [],
  flowState = {},
  setFlowState = () => {},
  onSubmit = () => {},
}) {
  const [multi, setMulti] = useState([]);
  const [days, setDays] = useState(flowState.durationDays || null);
  const [startDate, setStartDate] = useState(flowState.startDate || '');

  useEffect(() => {
    setDays(flowState.durationDays || null);
    setStartDate(flowState.startDate || '');
  }, [flowState]);

  const handleOption = (opt) => {
    // For simple options, submit the option text as the user's message
    onSubmit(String(opt));
  };

  const handleMultiToggle = (opt) => {
    setMulti((prev) => {
      const exists = prev.includes(opt);
      const next = exists ? prev.filter((p) => p !== opt) : [...prev, opt];
      return next;
    });
  };

  const submitMulti = () => {
    if (multi.length) {
      setFlowState({ ...flowState, interests: multi });
      onSubmit(multi.join(', '));
    }
  };

  const submitDays = (d) => {
    const n = Number(d) || 0;
    setDays(n);
    setFlowState({ ...flowState, durationDays: n });
    onSubmit(String(n));
  };

  const submitStartDate = (d) => {
    setStartDate(d);
    // compute endDate if durationDays present
    const daysNum = Number(flowState.durationDays || days || 0);
    let end = '';
    if (d && daysNum > 0) {
      const dt = new Date(d);
      const endDt = new Date(dt);
      endDt.setDate(dt.getDate() + daysNum - 1);
      end = endDt.toISOString().slice(0, 10);
    }
    const next = { ...flowState, startDate: d, endDate: end };
    setFlowState(next);
    onSubmit(JSON.stringify({ startDate: d, endDate: end }));
  };

  if (!inputSpec) return null;

  const type = inputSpec.type || 'freeText';

  return (
    <div className="mt-3 px-4 max-w-3xl mx-auto">
      <div className="rounded-lg bg-white/3 p-3 border border-white/6 text-sm text-white/90">
        {type === 'options' && Array.isArray(inputSpec.options) ? (
          <div className="flex flex-wrap gap-2">
            {inputSpec.options.map((o, i) => (
              <button key={i} onClick={() => handleOption(o)} className="px-3 py-1.5 rounded-md bg-white/6 hover:bg-white/10">
                {o}
              </button>
            ))}
          </div>
        ) : type === 'multiselect' && Array.isArray(inputSpec.options) ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {inputSpec.options.map((o, i) => (
                <button key={i} onClick={() => handleMultiToggle(o)} className={`px-3 py-1.5 rounded-md ${multi.includes(o) ? 'bg-green-500 text-black' : 'bg-white/6 hover:bg-white/10'}`}>
                  {o}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={submitMulti} className="ml-auto px-3 py-1.5 rounded-md bg-gradient-to-r from-[#16a34a] to-[#10b981] text-black">Submit</button>
            </div>
          </div>
        ) : type === 'days' ? (
          <div className="flex items-center gap-3">
            <button onClick={() => submitDays(Math.max(1, (days || 1) - 1))} className="px-3 py-1 rounded-md bg-white/6">-</button>
            <input type="number" value={days || ''} onChange={(e) => setDays(Number(e.target.value))} className="w-20 text-center rounded-md bg-transparent border border-white/10 px-2 py-1" />
            <button onClick={() => submitDays((days || 1) + 1)} className="px-3 py-1 rounded-md bg-white/6">+</button>
            <div className="ml-4 flex gap-2">
              {[3,5,7].map(p => (
                <button key={p} onClick={() => submitDays(p)} className="px-2 py-1 rounded-md bg-white/6">{p}d</button>
              ))}
            </div>
          </div>
        ) : type === 'dates' ? (
          <div className="flex items-center gap-3">
            <input type="date" value={startDate || ''} onChange={(e) => submitStartDate(e.target.value)} className="rounded-md bg-transparent border border-white/10 px-2 py-1" />
            {flowState.durationDays ? (
              <div className="text-white/80">End: {flowState.endDate || ''}</div>
            ) : null}
          </div>
        ) : (
          // freeText: show quickOptions as suggestions
          <div className="flex flex-wrap gap-2">
            {Array.isArray(quickOptions) && quickOptions.map((q, i) => (
              <button key={i} onClick={() => handleOption(q)} className="px-3 py-1.5 rounded-md bg-white/6 hover:bg-white/10">{q}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
