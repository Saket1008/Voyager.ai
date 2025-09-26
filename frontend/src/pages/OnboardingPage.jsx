import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HelixAnimated from '../components/HelixAnimated';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebaseClient';
import { doc, setDoc } from 'firebase/firestore';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';

export default function OnboardingPage({ onDone }) {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [userInfo, setUserInfo] = useState({ name: '', email: '', phone: '', origin: '' });
  const [celebrate, setCelebrate] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Helix effects state
  const helixRef = useRef(null);
  const cardRef = useRef(null);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0, key: 0 });
  const [highlightRung, setHighlightRung] = useState(null);
  const [helixBoost, setHelixBoost] = useState(false);
  const [helixGlow, setHelixGlow] = useState(false);
  const [impactPulse, setImpactPulse] = useState(null);

  // Thread integration animation state
  const [integrateAnim, setIntegrateAnim] = useState({ active: false, id: 0, pathD: '', tipXs: [], tipYs: [], duration: 1.2, palette: null, onDone: null });

  // Grouped questions mode: 0 = user info, 1..N = grouped preferences pages
  const qMap = useMemo(() => {
    const m = {};
    (DNA_QUESTIONS || []).forEach((q) => { m[q.key] = q; });
    return m;
  }, []);
  const GROUPS = useMemo(() => ([
    { id: 'core', title: 'Core preferences', keys: ['pace','budget','travelStyle','interests'], requiredKeys: ['pace','budget','travelStyle','interests'] },
    { id: 'stays', title: 'Stays', keys: ['accommodation','roomType'] },
    { id: 'food', title: 'Food & dietary', keys: ['foodPrefs','dietaryRestrictions'] },
    { id: 'gettingAround', title: 'Getting around', keys: ['transportMode'] },
    { id: 'lifestyle', title: 'Lifestyle', keys: ['dailyStart','nightlife'] },
  ]), []);
  // Steps: 0=user info, 1..N question groups, N+1=Review, N+2=Complete (auto)
  const totalSteps = 2 + GROUPS.length;
  const isQuestionStep = currentStep > 0 && currentStep <= GROUPS.length;
  const isReviewStep = currentStep === GROUPS.length + 1;
  const isComplete = currentStep >= totalSteps;

  const isUserInfoValid = useMemo(() => {
    const nameOK = userInfo.name.trim().length >= 2;
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInfo.email.trim());
    const phoneDigits = userInfo.phone.replace(/\D/g, '');
    const phoneOK = phoneDigits.length >= 7; // basic sanity
    const originOK = userInfo.origin.trim().length >= 2;
    return nameOK && emailOK && phoneOK && originOK;
  }, [userInfo]);

  const progress = Math.min(currentStep / totalSteps, 1);

  // Local storage helpers (autosave/resume)
  const getLsKey = () => `voyager:onboard:v1:${currentUser?.uid || 'anon'}`;
  useEffect(() => {
    if (loadedFromStorage) return;
    try {
      const raw = localStorage.getItem(getLsKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.userInfo) setUserInfo(parsed.userInfo);
          if (parsed.answers) setAnswers(parsed.answers);
          if (Number.isFinite(parsed.currentStep)) {
            const clamped = Math.max(0, Math.min(parsed.currentStep, Math.max(0, totalSteps - 1)));
            setCurrentStep(clamped);
          }
          if (typeof parsed.showIntro === 'boolean') setShowIntro(parsed.showIntro);
        }
      }
    } catch { /* ignore */ }
    setLoadedFromStorage(true);
  }, [currentUser?.uid, loadedFromStorage, totalSteps]);
  useEffect(() => {
    // Debounced autosave
    const t = setTimeout(() => {
      try {
        localStorage.setItem(getLsKey(), JSON.stringify({ currentStep, answers, userInfo, showIntro, ts: Date.now(), userId: currentUser?.uid || null }));
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [currentStep, answers, userInfo, showIntro, currentUser?.uid]);

  const handleResetProgress = () => {
    try { localStorage.removeItem(getLsKey()); } catch { /* ignore */ }
    setCurrentStep(0);
    setAnswers({});
    setUserInfo({ name: '', email: '', phone: '', origin: '' });
    setShowIntro(true);
  };

  const handleAnswer = (key, opt) => {
    setAnswers((prev) => {
      const q = DNA_QUESTIONS.find((x) => x.key === key) || {};
      if (q.isMultiSelect) {
        const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
        const idx = arr.indexOf(opt);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(opt);
        const maxSel = q.maxSelections || 3;
        if (arr.length > maxSel) arr.splice(maxSel);
        return { ...prev, [key]: arr };
      }
      return { ...prev, [key]: opt };
    });
  };

  const handleNext = () => setCurrentStep((s) => Math.min(s + 1, totalSteps));
  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const handleSkip = () => setCurrentStep((s) => Math.min(s + 1, totalSteps));

  // Persist on completion
  useEffect(() => {
    const save = async () => {
      try {
        setSaving(true);
        if (currentUser?.uid) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            userDetails: userInfo,
            dnaAnswers: answers,
            onboardingCompletedAt: new Date().toISOString(),
          }, { merge: true });
        }
  // Trigger global background celebration and finish
  window.dispatchEvent(new CustomEvent('spacebg:explode'));
  setCelebrate(true);
  setTimeout(() => onDone?.(), 900);
      } catch (e) {
  // Proceed anyway and still celebrate
  window.dispatchEvent(new CustomEvent('spacebg:explode'));
  setTimeout(() => onDone?.(), 900);
      } finally {
        setSaving(false);
        // Clear draft
        try { localStorage.removeItem(getLsKey()); } catch { /* ignore */ }
      }
    };
    if (isComplete) save();
  }, [isComplete]);

  // Build cubic bezier path from card center to helix centerline and sample tip trail points
  const buildThreadPath = (from, helRect) => {
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    let endX = startX + 260;
    let endY = startY - 120;
    if (helRect) {
      endX = helRect.left + helRect.width / 2;
      const topClamp = helRect.top + 16;
      const botClamp = helRect.bottom - 16;
      endY = Math.max(topClamp, Math.min(botClamp, startY));
    }
    const dx = endX - startX;
    const dy = endY - startY;
    const c1 = { x: startX + dx * 0.35, y: startY - Math.abs(dy) * 0.35 - 60 };
    const c2 = { x: startX + dx * 0.75, y: startY + dy * 0.55 + 60 };
    const pathD = `M ${startX},${startY} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${endX},${endY}`;
    const n = 45;
    const tipXs = [];
    const tipYs = [];
    const cb = (t, p0, p1, p2, p3) => (
      (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
    );
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = cb(t, startX, c1.x, c2.x, endX);
      const y = cb(t, startY, c1.y, c2.y, endY);
      tipXs.push(x);
      tipYs.push(y);
    }
    const dist = Math.hypot(dx, dy);
    const duration = Math.min(1.6, Math.max(0.9, dist / 700 + 0.6));
    const mid = { x: (startX + endX) / 2, y: (startY + endY) / 2 };
    return { pathD, tipXs, tipYs, mid, duration, targetX: endX, targetY: endY };
  };

  // Animate integration from a specific element rect (e.g., clicked option)
  const animateIntegrationFromRect = (fromRect) => {
    try {
      const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const helixEl = helixRef.current;
      if (!fromRect) { return; }
      const helRect = helixEl?.getBoundingClientRect();
      if (prefersReducedMotion) { return; }
      const { pathD, tipXs, tipYs, mid, duration, targetX, targetY } = buildThreadPath(fromRect, helRect);
      const palettes = [
        { start: '#A7F3D0', mid: '#99F6E4', end: '#93C5FD' },
        { start: '#86EFAC', mid: '#67E8F9', end: '#60A5FA' },
        { start: '#BBF7D0', mid: '#A5F3FC', end: '#A5B4FC' },
      ];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      const animId = Date.now();
      setIntegrateAnim({
        active: true,
        from: { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height },
        to: { x: targetX, y: targetY },
        mid,
        duration,
        palette,
        id: animId,
        pathD,
        tipXs,
        tipYs,
        onDone: () => {
          setIntegrateAnim({ active: false, from: null, to: null, onDone: null });
          const helRect2 = helixEl?.getBoundingClientRect();
          if (helRect2) {
            const helCx = helRect2.left + helRect2.width / 2;
            const helCy = helRect2.top + helRect2.height / 2;
            const dx = targetX - helCx;
            const dy = targetY - helCy;
            const mag = Math.hypot(dx, dy) || 1;
            const nudgeMag = 8;
            setParallaxOffset({ x: (dx / mag) * nudgeMag, y: (dy / mag) * nudgeMag, key: Date.now() });
            const W = 240, H = 440, marginTop = 28, marginBottom = 28;
            const usableH = H - marginTop - marginBottom;
            const rungs = 24;
            const relY = ((targetY - helRect2.top) / helRect2.height) * H;
            let idx = Math.round((relY - marginTop) / (usableH / (rungs - 1)));
            idx = Math.max(0, Math.min(rungs - 1, idx));
            setHighlightRung(idx);
            const sweep = [idx - 1, idx, idx + 1];
            sweep.forEach((ri, k) => { if (ri >= 0 && ri < rungs) setTimeout(() => setHighlightRung(ri), 100 + k * 70); });
            setTimeout(() => setHighlightRung(null), 520);
          }
          setHelixBoost(true);
          setHelixGlow(true);
          setImpactPulse({ x: targetX, y: targetY, id: Date.now() });
          setTimeout(() => setHelixGlow(false), 420);
          setTimeout(() => { setHelixBoost(false); }, 900);
        }
      });
    } catch { /* ignore */ }
  };

  // Simple placeholder icon
  const Icon = ({ size = 18, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" strokeWidth="1.5" stroke="currentColor" />
    </svg>
  );

  const OptionCard = ({ label, selected, onClick, disabled }) => (
    <button
      disabled={disabled}
      onClick={(e) => onClick?.(e)}
      className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:translate-y-[-1px] hover:shadow-[0_0_0_1px_rgba(255,255,255,.15),0_10px_30px_-10px_rgba(25,195,125,.35)] ${
        selected
          ? 'border-white/80 bg-white text-black'
          : 'border-white/10 bg-white/5 text-white hover:border-white/30'
      } disabled:opacity-50`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-black/10' : 'bg-white/10'} backdrop-blur-sm`}>
        <Icon />
      </div>
      <div className="text-sm font-medium">{label}</div>
      {selected && (
        <span className="absolute right-3 top-1.5 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-black shadow-emerald-500/40 shadow-md">Selected</span>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 group-hover:ring-white/20" />
    </button>
  );

  const Stepper = () => (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, idx) => {
        const done = idx < currentStep;
        const active = idx === currentStep;
        return (
          <div key={idx} className="flex items-center gap-2">
            <div
              className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold ${
                done ? 'bg-emerald-500 text-black shadow-[0_0_0_2px_rgba(25,195,125,.35)]' : active ? 'bg-white text-black' : 'bg-white/10 text-white/70'
              }`}
            >
              {idx + 1}
            </div>
            {idx < totalSteps - 1 && (
              <div className={`h-[2px] w-7 rounded ${done ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // HelixAnimated moved to components/HelixAnimated.jsx to keep rotation continuous across re-renders

  // Field-level validation messages
  const fieldErrors = useMemo(() => {
    const errs = {};
    if (userInfo.name.trim().length > 0 && userInfo.name.trim().length < 2) errs.name = 'Please enter at least 2 characters.';
    if (userInfo.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInfo.email.trim())) errs.email = 'Enter a valid email address.';
    const phoneDigits = userInfo.phone.replace(/\D/g, '');
    if (userInfo.phone.trim().length > 0 && phoneDigits.length < 7) errs.phone = 'Phone number looks too short.';
    if (userInfo.origin.trim().length > 0 && userInfo.origin.trim().length < 2) errs.origin = 'Add your city and country.';
    return errs;
  }, [userInfo]);

  const handleUserInfoEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isUserInfoValid) setCurrentStep(1);
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden text-white">

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:gap-10 md:px-8 md:py-12">
        {/* Hero */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {showIntro ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 shadow-inner">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Personalized onboarding
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    Craft your Traveler's DNA
                  </h1>
                  <p className="mt-2 max-w-prose text-sm text-white/80">
                    Help Voyager understand your vibe. We'll tailor destinations, day plans, and hidden gems to match your style—every time.
                  </p>
                  <div className="mt-5 flex justify-start">
                    <button
                      onClick={() => setShowIntro(false)}
                      className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90"
                    >
                      Begin
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="onboarding-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className=""
                >
                  {/* Card moved here so it appears where the hero was */}
                  <div ref={cardRef} className="relative rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] md:p-6">
                    {/* Outer-box step progress bar (single bar from left to right with endpoint dots) */}
                    {isQuestionStep && (() => {
                      const g = GROUPS[currentStep - 1];
                      const keys = g?.keys || [];
                      const answeredCount = keys.reduce((acc, k) => {
                        const v = answers[k];
                        if (Array.isArray(v)) return acc + (v.length > 0 ? 1 : 0);
                        return acc + (v ? 1 : 0);
                      }, 0);
                      const frac = keys.length > 0 ? Math.min(1, answeredCount / keys.length) : 0;
                      return (
                        <div className="pointer-events-none absolute -inset-4 md:-inset-6 z-10">
                          {/* Top and bottom tracks flush to the border */}
                          <div className="absolute left-0 right-0 top-0 h-[2px] bg-white/15" />
                          <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/15" />
                          {/* Fills from the left border to the right */}
                          {/* Tiny starter segments to ensure fill begins exactly at the dot */}
                          <motion.div
                            className="absolute left-0 top-0 h-[2px] w-3 bg-white"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: frac > 0 ? 1 : 0, opacity: frac > 0 ? 1 : 0 }}
                            style={{ transformOrigin: 'left' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          />
                          <motion.div
                            className="absolute left-0 bottom-0 h-[2px] w-3 bg-white"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: frac > 0 ? 1 : 0, opacity: frac > 0 ? 1 : 0 }}
                            style={{ transformOrigin: 'left' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          />
                          <motion.div
                            className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-white to-white/70 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
                            style={{ transformOrigin: 'left' }}
                            initial={false}
                            animate={{ scaleX: frac }}
                            transition={{ type: 'tween', duration: 0.35, ease: 'easeOut' }}
                          />
                          <motion.div
                            className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-white to-white/70 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
                            style={{ transformOrigin: 'left' }}
                            initial={false}
                            animate={{ scaleX: frac }}
                            transition={{ type: 'tween', duration: 0.35, ease: 'easeOut' }}
                          />
                          {/* Left center start dot on the border line */}
                          <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                          {/* Small fork connectors from center dot to top/bottom bars (animated) */}
                          <motion.div
                            className="absolute left-0 w-[2px] bg-white/70"
                            style={{ transformOrigin: 'bottom' }}
                            initial={false}
                            animate={{ height: frac > 0 ? 8 : 0, top: 'calc(50% - 8px)' }}
                            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                          />
                          <motion.div
                            className="absolute left-0 w-[2px] bg-white/70"
                            style={{ transformOrigin: 'top' }}
                            initial={false}
                            animate={{ height: frac > 0 ? 8 : 0, top: 'calc(50% + 6px)' }}
                            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                          />
                          {/* Right center end dot on the border line */}
                          <motion.div
                            className="absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                            animate={frac >= 1 ? { scale: [1, 1.25, 1], boxShadow: ['0 0 10px rgba(255,255,255,0.35)', '0 0 24px rgba(255,255,255,0.75)', '0 0 14px rgba(255,255,255,0.45)'] } : { scale: 1, boxShadow: '0 0 10px rgba(255,255,255,0.35)' }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      );
                    })()}
                    {!isComplete ? (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={isReviewStep ? 'review' : isQuestionStep ? 'combined-questions' : 'user-info'}
                          initial={{ y: 8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -8, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="grid gap-5"
                        >
                          {isReviewStep ? (
                            // Review and confirm step
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-lg font-semibold md:text-xl">Review your details</div>
                              </div>
                              <div className="grid gap-4">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-white/80">Your info</div>
                                    <button onClick={() => setCurrentStep(0)} className="text-xs text-white/70 underline-offset-2 hover:underline">Edit</button>
                                  </div>
                                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                    <div><span className="text-white/60">Name:</span> <span className="text-white">{userInfo.name || '—'}</span></div>
                                    <div><span className="text-white/60">Email:</span> <span className="text-white">{userInfo.email || '—'}</span></div>
                                    <div><span className="text-white/60">Phone:</span> <span className="text-white">{userInfo.phone || '—'}</span></div>
                                    <div><span className="text-white/60">Origin:</span> <span className="text-white">{userInfo.origin || '—'}</span></div>
                                  </div>
                                </div>
                                {GROUPS.map((g, idx) => (
                                  <div key={g.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-medium text-white/80">{g.title}</div>
                                      <button onClick={() => setCurrentStep(idx + 1)} className="text-xs text-white/70 underline-offset-2 hover:underline">Edit</button>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                      {(g.keys || []).map((k) => {
                                        const q = qMap[k];
                                        const v = answers[k];
                                        let display = '—';
                                        if (Array.isArray(v)) display = v.length ? v.join(', ') : '—';
                                        else if (v) display = String(v);
                                        return (
                                          <div key={k} className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                                            <span className="text-white/60">{q?.title || k}:</span> <span className="text-white">{display}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <button onClick={handleBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">Back</button>
                                <button
                                  onClick={() => setCurrentStep(totalSteps)}
                                  className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
                                >
                                  Confirm & Finish
                                </button>
                              </div>
                            </>
                          ) : isQuestionStep ? (
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-lg font-semibold md:text-xl">{GROUPS[currentStep - 1]?.title}</div>
                              </div>
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                              >
                                <div className="divide-y divide-white/10 max-h-[65vh] overflow-y-auto overscroll-contain">
                                  {(GROUPS[currentStep - 1]?.keys || []).map((key) => {
                                    const q = qMap[key];
                                    if (!q) return null;
                                    return (
                                      <div key={q.key} className="px-4 md:px-5 py-3 md:py-3.5">
                                        {/* Header: question label with optional badge and hint on the right */}
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-sm md:text-base text-white/90 flex items-center gap-2">
                                            <span className="leading-snug">{q.title}</span>
                                            {q.isOptional && (
                                              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] md:text-xs text-white/70">Optional</span>
                                            )}
                                          </div>
                                          {q.isMultiSelect && (
                                            <div className="text-[11px] md:text-[12px] text-white/60">Up to {q.maxSelections || 3}</div>
                                          )}
                                        </div>
                                        {/* Options stacked under the question */}
                                        <div className="mt-2 flex flex-wrap items-center gap-2.5">
                                          {q.options.map((opt) => {
                                            const isMulti = !!q.isMultiSelect;
                                            const selected = isMulti ? (Array.isArray(answers[q.key]) && answers[q.key].includes(opt)) : answers[q.key] === opt;
                                            return (
                                              <button
                                                key={opt}
                                                disabled={integrateAnim.active}
                                                onClick={(e) => {
                                                  handleAnswer(q.key, opt);
                                                  if (!q.isMultiSelect) {
                                                    const rect = e?.currentTarget?.getBoundingClientRect?.();
                                                    if (rect) animateIntegrationFromRect(rect);
                                                  }
                                                }}
                                                className={`whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-sm md:text-[13px] transition-colors ${
                                                  selected ? 'border-white/80 bg-white text-black shadow-sm' : 'border-white/10 bg-white/5 text-white hover:border-white/30'
                                                }`}
                                              >
                                                {opt}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button onClick={handleBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">Back</button>
                                  <button onClick={handleSkip} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">Skip</button>
                                </div>
                                <button
                                  onClick={handleNext}
                                  className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                                  disabled={(() => {
                                    const required = GROUPS[currentStep - 1]?.requiredKeys || [];
                                    for (const k of required) {
                                      if (k === 'interests') {
                                        if (!Array.isArray(answers[k]) || answers[k].length < 1) return true;
                                      } else if (!answers[k]) return true;
                                    }
                                    return false;
                                  })()}
                                >
                                  {currentStep === GROUPS.length ? 'Review' : 'Continue'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-base font-medium md:text-lg">Let's start with your details</div>
                              </div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs text-white/70">Full name</span>
                                  <input value={userInfo.name} onKeyDown={handleUserInfoEnter} onChange={(e) => setUserInfo((s) => ({ ...s, name: e.target.value }))} className={`rounded-lg border bg-black/20 px-3 py-2 text-sm outline-none placeholder-white/40 focus:border-white/30 ${fieldErrors.name ? 'border-rose-400/60' : 'border-white/15'}`} placeholder="e.g. Alex Traveler" />
                                  {fieldErrors.name && <span className="text-[11px] text-rose-300/90">{fieldErrors.name}</span>}
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs text-white/70">Email</span>
                                  <input type="email" value={userInfo.email} onKeyDown={handleUserInfoEnter} onChange={(e) => setUserInfo((s) => ({ ...s, email: e.target.value }))} className={`rounded-lg border bg-black/20 px-3 py-2 text-sm outline-none placeholder-white/40 focus:border-white/30 ${fieldErrors.email ? 'border-rose-400/60' : 'border-white/15'}`} placeholder="you@example.com" />
                                  {fieldErrors.email && <span className="text-[11px] text-rose-300/90">{fieldErrors.email}</span>}
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs text-white/70">Contact number</span>
                                  <input value={userInfo.phone} onKeyDown={handleUserInfoEnter} onChange={(e) => setUserInfo((s) => ({ ...s, phone: e.target.value }))} className={`rounded-lg border bg-black/20 px-3 py-2 text-sm outline-none placeholder-white/40 focus:border-white/30 ${fieldErrors.phone ? 'border-rose-400/60' : 'border-white/15'}`} placeholder="e.g. +1 555 123 4567" />
                                  {fieldErrors.phone && <span className="text-[11px] text-rose-300/90">{fieldErrors.phone}</span>}
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs text-white/70">Primary location (start point)</span>
                                  <input value={userInfo.origin} onKeyDown={handleUserInfoEnter} onChange={(e) => setUserInfo((s) => ({ ...s, origin: e.target.value }))} className={`rounded-lg border bg-black/20 px-3 py-2 text-sm outline-none placeholder-white/40 focus:border-white/30 ${fieldErrors.origin ? 'border-rose-400/60' : 'border-white/15'}`} placeholder="City, Country" />
                                  {fieldErrors.origin && <span className="text-[11px] text-rose-300/90">{fieldErrors.origin}</span>}
                                </label>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <button onClick={handleBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30" disabled={currentStep === 0}>Back</button>
                                <div className="flex gap-2">
                                  <button onClick={() => setCurrentStep(1)} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">Skip</button>
                                  <button onClick={() => setCurrentStep(1)} disabled={!isUserInfoValid} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">Continue</button>
                                </div>
                              </div>
                            </>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <div className="grid place-items-center py-10 text-center">
                        <div className="text-lg font-medium">{saving ? 'Saving your preferences…' : "All set! Crafting your Traveler's DNA…"}</div>
                        <div className="mt-2 text-sm text-white/70">You can close this page. We'll take you to your dashboard shortly.</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.div
            className="hidden md:block"
            ref={helixRef}
            animate={impactPulse ? { scale: [1, 1.03, 1], rotate: [0, 0.8, 0], x: [0, parallaxOffset.x, 0], y: [0, parallaxOffset.y, 0] } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <HelixAnimated highlightIndex={highlightRung} speedBoost={helixBoost} glow={helixGlow} />
          </motion.div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-4">
          <Stepper />
          <div className="flex items-center gap-3">
            <button onClick={handleResetProgress} className="text-[11px] text-white/60 underline-offset-2 hover:text-white/80 hover:underline">Reset</button>
            <div className="text-xs text-white/70">Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}</div>
          </div>
        </div>

        {/* Card moved to hero area; no separate card below */}

        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded bg-white/5">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Thread integration overlay */}
      {integrateAnim.active && (
        <>
          <svg className="pointer-events-none fixed inset-0 z-30" style={{ width: '100vw', height: '100vh' }}>
            <defs>
              <linearGradient id={`thread-grad-${integrateAnim.id || '0'}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={integrateAnim.palette?.start || '#A7F3D0'} />
                <stop offset="45%" stopColor={integrateAnim.palette?.mid || '#99F6E4'} />
                <stop offset="100%" stopColor={integrateAnim.palette?.end || '#93C5FD'} />
              </linearGradient>
              {/* Soft glow for the filament */}
              <filter id={`filament-glow-${integrateAnim.id || '0'}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Outer faint halo (circle-dotted look via short dash + round caps) */}
            <motion.path
              d={integrateAnim.pathD || ''}
              fill="none"
              stroke={`url(#thread-grad-${integrateAnim.id || '0'})`}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.18}
              initial={{ pathLength: 0, strokeWidth: 7, strokeDasharray: '2 10', strokeDashoffset: 0 }}
              animate={{ pathLength: 1, strokeWidth: 5, strokeDashoffset: -22 }}
              transition={{ duration: integrateAnim.duration || 1.2, ease: 'easeInOut' }}
              filter={`url(#filament-glow-${integrateAnim.id || '0'})`}
            />
            {/* Core filament (circle-dotted) */}
            <motion.path
              d={integrateAnim.pathD || ''}
              fill="none"
              stroke={`url(#thread-grad-${integrateAnim.id || '0'})`}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, strokeWidth: 3.5, opacity: 0.8, strokeDasharray: '2 8', strokeDashoffset: 0 }}
              animate={{ pathLength: 1, strokeWidth: 2.1, opacity: 0.12, strokeDashoffset: -18 }}
              transition={{ duration: integrateAnim.duration || 1.2, ease: 'easeInOut' }}
              filter={`url(#filament-glow-${integrateAnim.id || '0'})`}
              onAnimationComplete={() => {
                const done = integrateAnim.onDone;
                setIntegrateAnim({ active: false, from: null, to: null, onDone: null });
                done?.();
              }}
            />
          </svg>
          {/* Moving glowing tip */}
          {Array.isArray(integrateAnim.tipXs) && Array.isArray(integrateAnim.tipYs) && integrateAnim.tipXs.length > 0 && (() => {
            const xs = integrateAnim.tipXs;
            const ys = integrateAnim.tipYs;
            const d = integrateAnim.duration || 1.2;
            const end = integrateAnim.palette?.end || '#93C5FD';
            // Helper to build a lagged sequence (trim first N points)
            const lag = (arr, n) => arr.slice(Math.min(n, arr.length - 1));
            const tip = (
              <motion.div
                key="tip-main"
                className="fixed z-30 rounded-full"
                style={{ pointerEvents: 'none', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${end}E6 0%, ${end}00 70%)` }}
                initial={{ left: xs[0], top: ys[0], width: 10, height: 10, opacity: 0.9 }}
                animate={{ left: xs, top: ys, width: [10, 8, 6, 4, 2], height: [10, 8, 6, 4, 2], opacity: [0.9, 0.8, 0.6, 0.35, 0] }}
                transition={{ duration: d, ease: 'easeInOut' }}
              />
            );
            const spark1 = (
              <motion.div
                key="tip-s1"
                className="fixed z-30 rounded-full"
                style={{ pointerEvents: 'none', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${end}B3 0%, ${end}00 70%)` }}
                initial={{ left: lag(xs, 3)[0], top: lag(ys, 3)[0], width: 6, height: 6, opacity: 0.55 }}
                animate={{ left: lag(xs, 3), top: lag(ys, 3), width: [6, 5, 4, 3], height: [6, 5, 4, 3], opacity: [0.55, 0.45, 0.3, 0] }}
                transition={{ duration: Math.max(0.7, d - 0.15), ease: 'easeOut' }}
              />
            );
            const spark2 = (
              <motion.div
                key="tip-s2"
                className="fixed z-30 rounded-full"
                style={{ pointerEvents: 'none', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${end}80 0%, ${end}00 70%)` }}
                initial={{ left: lag(xs, 6)[0], top: lag(ys, 6)[0], width: 4, height: 4, opacity: 0.4 }}
                animate={{ left: lag(xs, 6), top: lag(ys, 6), width: [4, 3, 2], height: [4, 3, 2], opacity: [0.4, 0.25, 0] }}
                transition={{ duration: Math.max(0.55, d - 0.3), ease: 'easeOut' }}
              />
            );
            return (<>{tip}{spark1}{spark2}</>);
          })()}
        </>
      )}
    </div>
  );
}
