import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebaseClient';
import { doc, setDoc } from 'firebase/firestore';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';
import SpaceBackground from '../components/SpaceBackground';

export default function OnboardingPage({ onDone }) {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [integrateAnim, setIntegrateAnim] = useState({ active: false, from: null, to: null, onDone: null });
  const cardRef = useRef(null);
  const helixRef = useRef(null);
  const [impactPulse, setImpactPulse] = useState(null);

  const isComplete = currentStep >= DNA_QUESTIONS.length;
  const question = useMemo(() => DNA_QUESTIONS[currentStep], [currentStep]);

  function handleAnswer(key, value) {
    const q = DNA_QUESTIONS.find((x) => x.key === key);
    setAnswers((prev) => {
      const next = { ...prev };
      if (q?.isMultiSelect) {
        const prevArr = Array.isArray(prev[key]) ? prev[key] : [];
        const isSelected = prevArr.includes(value);
        let updated = isSelected ? prevArr.filter((v) => v !== value) : [...prevArr, value];
        if (!isSelected && q.maxSelections && updated.length > q.maxSelections) {
          // Enforce max selections quietly
          updated = prevArr; // ignore this extra selection
        }
        next[key] = updated;
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function handleNext() {
    setCurrentStep((s) => Math.min(DNA_QUESTIONS.length, s + 1));
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  async function handleFinishOnboarding() {
    if (!currentUser || !db) {
      // Small celebratory moment even if we can't persist yet
      setCelebrate(true);
      setTimeout(() => onDone?.(), 1100);
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, 'users', currentUser.uid);
  // Persist Traveler's DNA and ensure app-wide vegetarian default is recorded
  const payload = { ...answers, diet: 'vegetarian' };
  await setDoc(ref, { travelProfile: payload }, { merge: true });
      // Trigger a subtle celebration and then proceed
      setCelebrate(true);
      setTimeout(() => onDone?.(), 1100);
    } catch (e) {
      console.error('Failed saving onboarding profile', e);
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.min(currentStep, DNA_QUESTIONS.length) / DNA_QUESTIONS.length;

  // Iconography for options (simple inline SVGs, themed)
  const Icon = ({ name }) => {
    const base = 'stroke-current text-white';
    const sz = 20;
    switch (name) {
      case 'Relaxed':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M3 17h18M5 17c1.5-3 4-5 7-5s5.5 2 7 5" strokeWidth="1.5" />
          </svg>
        );
      case 'Balanced':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
            <path d="M12 4v16M4 12h16" strokeWidth="1.5" />
          </svg>
        );
      case 'Action-Packed':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M4 12l6 6L20 6" strokeWidth="2" />
          </svg>
        );
      case 'Budget-Friendly':
      case 'Mid-Range':
      case 'Luxury':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M4 7h16v10H4z" strokeWidth="1.5" />
            <path d="M8 12h8" strokeWidth="1.5" />
          </svg>
        );
      case 'History & Museums':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M3 10l9-6 9 6v10H3V10z" strokeWidth="1.5" />
          </svg>
        );
      case 'Food & Local Cuisine':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M7 3v10M11 3v10M15 5h4v8" strokeWidth="1.5" />
          </svg>
        );
      case 'Adventure & Outdoors':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M3 17l6-9 6 9 3-4 3 4" strokeWidth="1.5" />
          </svg>
        );
      case 'Art & Culture':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M12 3a9 9 0 100 18 5 5 0 100-10" strokeWidth="1.5" />
          </svg>
        );
      case 'Nightlife & Entertainment':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M9 3l6 6-6 6V3z" strokeWidth="1.5" />
            <circle cx="17" cy="17" r="2" strokeWidth="1.5" />
          </svg>
        );
      case 'Shopping':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M6 7h12l-1 12H7L6 7z" strokeWidth="1.5" />
            <path d="M9 7a3 3 0 016 0" strokeWidth="1.5" />
          </svg>
        );
      case 'Relaxation & Wellness':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M12 4c3 3 3 6 0 9-3-3-3-6 0-9zM4 18h16" strokeWidth="1.5" />
          </svg>
        );
      case 'Must-see Landmarks':
      case 'Off-the-beaten-path':
      case 'Mix of both':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 3 2-7L2 9h7l3-7z" strokeWidth="1.2" />
          </svg>
        );
      case 'Hotels':
      case 'Boutique Hotels':
      case 'Resorts':
      case 'Hostels':
      case 'Vacation Rentals (Airbnb)':
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <path d="M3 11l9-7 9 7v9H3v-9z" strokeWidth="1.5" />
            <path d="M9 20v-6h6v6" strokeWidth="1.5" />
          </svg>
        );
      default:
        return (
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className={base}>
            <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
          </svg>
        );
    }
  };

  const OptionCard = ({ label, selected, onClick }) => (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:translate-y-[-1px] hover:shadow-[0_0_0_1px_rgba(255,255,255,.15),0_10px_30px_-10px_rgba(25,195,125,.35)] ${
        selected
          ? 'border-white/80 bg-white text-black'
          : 'border-white/10 bg-white/5 text-white hover:border-white/30'
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-black/10' : 'bg-white/10'} backdrop-blur-sm`}>
        <Icon name={label} />
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
      {DNA_QUESTIONS.map((_, idx) => {
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
            {idx < DNA_QUESTIONS.length - 1 && (
              <div className={`h-[2px] w-7 rounded ${done ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const HelixAnimated = () => {
    const [phase, setPhase] = React.useState(0);

    React.useEffect(() => {
      let raf;
      const tick = () => {
  setPhase((p) => (p + 0.02) % (Math.PI * 2));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);

    const W = 240; // viewBox width
    const H = 440; // viewBox height
    const cx = W / 2;
    const marginTop = 28;
    const marginBottom = 28;
    const usableH = H - marginTop - marginBottom;
    const rungs = 24;
    const step = usableH / (rungs - 1);
  const amplitude = 40; // horizontal spread (slightly reduced)
  const freq = 0.2; // twist density (slightly reduced)

    const lerp = (a, b, t) => a + (b - a) * t;

    // Subtle sway using framer-motion wrapper
    return (
      <motion.div
        className="opacity-95"
        animate={{ rotate: [-1, 1, -1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
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

            return (
              <g key={i} style={{ transformOrigin: `${cx}px ${y}px` }}>
                {/* Rung connector */}
                <path
                  d={`M${leftX} ${y} C ${cx - 8} ${y - curveAmp}, ${cx + 8} ${y + curveAmp}, ${rightX} ${y}`}
                  stroke={stroke}
                  strokeWidth={lineWidth}
                  fill="none"
                  opacity={lerp(0.35, 0.75, depth)}
                />
                {/* Left and right nucleotides */}
                <circle cx={leftX} cy={y} r={nodeR} fill={fill} opacity={lerp(0.45, 0.95, depth)} />
                <circle cx={rightX} cy={y} r={nodeR} fill={fill} opacity={lerp(0.45, 0.95, depth)} />
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
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden text-white">
      <SpaceBackground isAnimating={celebrate} />
      {/* Aurora overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(25,195,125,0.15),transparent_60%),radial-gradient(40%_40%_at_80%_20%,rgba(96,165,250,0.12),transparent_60%),radial-gradient(30%_30%_at_20%_10%,rgba(255,255,255,0.08),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:gap-10 md:px-8 md:py-12">
        {/* Hero */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 shadow-inner">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Personalized onboarding
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Craft your Traveler's DNA
            </h1>
            <p className="mt-2 max-w-prose text-sm text-white/80">
              Help Voyager understand your vibe. We'll tailor destinations, day plans, and hidden gems to match your style—every time.
            </p>
          </div>
          <div className="hidden md:block" ref={helixRef}>
            <HelixAnimated />
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-4">
          <Stepper />
          <div className="text-xs text-white/70">Step {Math.min(currentStep + 1, DNA_QUESTIONS.length)} of {DNA_QUESTIONS.length}</div>
        </div>

        {/* Card */}
        <div ref={cardRef} className="relative rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] md:p-6">
          {!isComplete ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={question.key}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="grid gap-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-base font-medium md:text-lg">{question.title}</div>
                  {question.isMultiSelect && (
                    <div className="text-[11px] text-white/60">Select up to {question.maxSelections || 3}</div>
                  )}
                </div>
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 1 },
                    show: { transition: { staggerChildren: 0.03 } }
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {question.options.map((opt) => {
                    const key = question.key;
                    const isMulti = !!question.isMultiSelect;
                    const selected = isMulti
                      ? (Array.isArray(answers[key]) && answers[key].includes(opt))
                      : answers[key] === opt;
                    return (
                      <motion.div
                        key={opt}
                        variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                      >
                        <OptionCard
                          label={opt}
                          selected={selected}
                          onClick={() => {
                            handleAnswer(key, opt);
                            if (!question.isMultiSelect) {
                              // Animate integration then advance
                              try {
                                const fromEl = cardRef.current;
                                const helixEl = helixRef.current;
                                if (!fromEl) { handleNext(); return; }
                                const from = fromEl.getBoundingClientRect();
                                let targetX = window.innerWidth / 2;
                                let targetY = window.innerHeight / 2;
                                if (helixEl) {
                                  const to = helixEl.getBoundingClientRect();
                                  targetX = to.left + to.width / 2;
                                  targetY = to.top + to.height / 2;
                                }
                                // Curved mid control point (arc upward)
                                const mid = {
                                  x: (from.left + targetX) / 2,
                                  y: (from.top + targetY) / 2 - Math.min(120, window.innerHeight * 0.15)
                                };
                                setIntegrateAnim({
                                  active: true,
                                  from: { left: from.left, top: from.top, width: from.width, height: from.height },
                                  to: { x: targetX, y: targetY },
                                  mid,
                                  onDone: () => {
                                    setIntegrateAnim({ active: false, from: null, to: null, onDone: null });
                                    setImpactPulse({ x: targetX, y: targetY, id: Date.now() });
                                    handleNext();
                                  }
                                });
                              } catch {
                                handleNext();
                              }
                            }
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>

                {question.isMultiSelect && (
                  <div className="-mt-2 text-[11px] text-white/60">Selected: {Array.isArray(answers[question.key]) ? answers[question.key].length : 0}</div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <button onClick={handleBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30 disabled:opacity-50" disabled={currentStep === 0}>Back</button>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (question.isMultiSelect) {
                        try {
                          const fromEl = cardRef.current;
                          const helixEl = helixRef.current;
                          if (!fromEl) { handleNext(); return; }
                          const from = fromEl.getBoundingClientRect();
                          let targetX = window.innerWidth / 2;
                          let targetY = window.innerHeight / 2;
                          if (helixEl) {
                            const to = helixEl.getBoundingClientRect();
                            targetX = to.left + to.width / 2;
                            targetY = to.top + to.height / 2;
                          }
                          const mid = {
                            x: (from.left + targetX) / 2,
                            y: (from.top + targetY) / 2 - Math.min(120, window.innerHeight * 0.15)
                          };
                          setIntegrateAnim({
                            active: true,
                            from: { left: from.left, top: from.top, width: from.width, height: from.height },
                            to: { x: targetX, y: targetY },
                            mid,
                            onDone: () => {
                              setIntegrateAnim({ active: false, from: null, to: null, onDone: null });
                              setImpactPulse({ x: targetX, y: targetY, id: Date.now() });
                              handleNext();
                            }
                          });
                        } catch {
                          handleNext();
                        }
                      } else {
                        handleNext();
                      }
                    }} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">
                      {question.isMultiSelect ? 'Next' : 'Skip'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="mb-1 text-base font-medium md:text-lg">You're all set!</div>
                <div className="text-sm text-white/80">Save your Traveler's DNA to personalize every suggestion from here on out.</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:border-white/30">Back</button>
                <button disabled={saving} onClick={handleFinishOnboarding} className="rounded-lg border border-emerald-400/20 bg-emerald-400 px-5 py-2 text-xs font-semibold text-black shadow-[0_10px_30px_-10px_rgba(25,195,125,.55)] transition hover:translate-y-[-1px] disabled:opacity-50">
                  {saving ? 'Saving…' : 'Finish'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Glow accent */}
          <div className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-inset ring-white/10" />
          <div className="pointer-events-none absolute -top-24 right-6 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
      </div>

      {/* Welcome overlay */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 text-white shadow-[0_20px_60px_-20px_rgba(25,195,125,.35)]"
            >
              <div className="absolute -top-16 right-8 hidden h-24 w-24 rounded-full bg-emerald-400/20 blur-3xl md:block" />
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-black shadow-[0_10px_30px_-10px_rgba(25,195,125,.7)]">
                  <span className="text-lg font-bold">V</span>
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Welcome to Voyager</div>
                  <div className="text-lg font-semibold">Let’s craft your Traveler's DNA</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/80">
                Answer a few quick questions so we can tailor destinations, day plans, and hidden gems to your travel style.
              </p>
              <div className="mt-5 flex items-center justify-end gap-3 text-xs">
                <button
                  onClick={() => setShowWelcome(false)}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-white hover:border-white/30"
                >
                  Skip
                </button>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="rounded-lg border border-emerald-400/20 bg-emerald-400 px-5 py-2 font-semibold text-black shadow-[0_10px_30px_-10px_rgba(25,195,125,.55)] hover:translate-y-[-1px]"
                >
                  Begin
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

  {/* Integration animation overlay */}
      <AnimatePresence>
        {integrateAnim.active && integrateAnim.from && integrateAnim.to && (
          <>
            {/* Ghost card chip along a curved keyframe */}
            <motion.div
              className="fixed z-30 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              initial={{
                left: integrateAnim.from.left,
                top: integrateAnim.from.top,
                width: integrateAnim.from.width,
                height: integrateAnim.from.height,
                opacity: 0.9
              }}
              animate={{
                left: [
                  integrateAnim.from.left,
                  (integrateAnim.mid?.x ?? integrateAnim.to.x) - (integrateAnim.from.width * 0.2),
                  integrateAnim.to.x - 10
                ],
                top: [
                  integrateAnim.from.top,
                  (integrateAnim.mid?.y ?? integrateAnim.to.y) - (integrateAnim.from.height * 0.2),
                  integrateAnim.to.y - 10
                ],
                width: [integrateAnim.from.width, Math.max(60, integrateAnim.from.width * 0.4), 20],
                height: [integrateAnim.from.height, Math.max(50, integrateAnim.from.height * 0.4), 20],
                borderRadius: [16, 16, 999],
                opacity: [0.9, 0.45, 0.12],
                filter: ['blur(0px)', 'blur(0.5px)', 'blur(1px)']
              }}
              transition={{ duration: 0.65, ease: 'easeInOut', times: [0, 0.65, 1] }}
              onAnimationComplete={() => {
                const done = integrateAnim.onDone;
                setIntegrateAnim({ active: false, from: null, to: null, onDone: null });
                done?.();
              }}
              style={{ pointerEvents: 'none' }}
            >
              <div className="h-full w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]" />
            </motion.div>

            {/* Particle trail */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="fixed z-30 h-2 w-2 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(163,230,255,0.9) 0%, rgba(59,130,246,0.0) 70%)', pointerEvents: 'none' }}
                initial={{
                  left: integrateAnim.from.left + (integrateAnim.from.width / 2) + (Math.random() * 20 - 10),
                  top: integrateAnim.from.top + (integrateAnim.from.height / 2) + (Math.random() * 16 - 8),
                  opacity: 0.8,
                  scale: 0.9
                }}
                animate={{
                  left: [
                    integrateAnim.from.left + integrateAnim.from.width / 2,
                    (integrateAnim.mid?.x ?? integrateAnim.to.x) + (Math.random() * 20 - 10),
                    integrateAnim.to.x + (Math.random() * 8 - 4)
                  ],
                  top: [
                    integrateAnim.from.top + integrateAnim.from.height / 2,
                    (integrateAnim.mid?.y ?? integrateAnim.to.y) + (Math.random() * 16 - 8),
                    integrateAnim.to.y + (Math.random() * 6 - 3)
                  ],
                  opacity: [0.8, 0.5, 0],
                  scale: [0.9, 0.7, 0.4]
                }}
                transition={{ duration: 0.65, ease: 'easeInOut', delay: i * 0.015 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Helix impact pulse */}
      <AnimatePresence>
        {impactPulse && (
          <motion.div
            key={impactPulse.id}
            className="fixed z-20"
            style={{ left: impactPulse.x - 20, top: impactPulse.y - 20, width: 40, height: 40 }}
            initial={{ scale: 0.6, opacity: 0.35 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            onAnimationComplete={() => setImpactPulse(null)}
          >
            <div className="h-full w-full rounded-full ring-2 ring-emerald-300/60" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
