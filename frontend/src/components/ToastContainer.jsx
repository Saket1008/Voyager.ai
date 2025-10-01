import React, { useEffect, useState } from 'react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const DURATION = 3500; // ms
  useEffect(() => {
    const onToast = (ev) => {
      const t = ev?.detail;
      if (!t) return;
      // new toast with animation flags
      const item = { ...t, createdAt: Date.now(), show: false, closing: false, progressStart: false };
      setToasts((arr) => [...arr, item]);
      // kick off enter + progress in next ticks
      setTimeout(() => {
        setToasts((arr) => arr.map((x) => (x.id === t.id ? { ...x, show: true } : x)));
      }, 20);
      setTimeout(() => {
        setToasts((arr) => arr.map((x) => (x.id === t.id ? { ...x, progressStart: true } : x)));
      }, 40);
      // begin closing a bit before removal
      setTimeout(() => {
        setToasts((arr) => arr.map((x) => (x.id === t.id ? { ...x, closing: true } : x)));
      }, DURATION - 250);
      // remove
      setTimeout(() => {
        setToasts((arr) => arr.filter((x) => x.id !== t.id));
      }, DURATION);
    };
    try { window.addEventListener('voyager:toast', onToast); } catch {}
    return () => { try { window.removeEventListener('voyager:toast', onToast); } catch {} };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto overflow-hidden rounded-lg border px-3 py-2 shadow text-sm backdrop-blur transition-all duration-300 ${
            t.type === 'success' ? 'bg-emerald-500/10 border-emerald-300/30 text-emerald-100' :
            t.type === 'error' ? 'bg-rose-500/10 border-rose-300/30 text-rose-100' :
            t.type === 'warn' ? 'bg-amber-500/10 border-amber-300/30 text-amber-100' :
            'bg-white/10 border-white/20 text-white/90'
          } ${t.show && !t.closing ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'} translate-x-6`}
          style={{ willChange: 'transform, opacity' }}
        >
          <div>{t.message}</div>
          {/* progress bar */}
          <div className="mt-2 h-1 w-full bg-white/10">
            <div
              className={`h-full ${
                t.type === 'success' ? 'bg-emerald-300/80' : t.type === 'error' ? 'bg-rose-300/80' : t.type === 'warn' ? 'bg-amber-300/80' : 'bg-white/60'
              } transition-[width]`}
              style={{ width: t.progressStart ? '0%' : '100%', transitionDuration: `${DURATION}ms`, transitionTimingFunction: 'linear' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
