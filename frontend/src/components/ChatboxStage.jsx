import React, { useState, useEffect, useRef, useMemo } from 'react';
// NOTE: ChatMessage component extracted (lightweight) in ChatMessage.jsx; existing inline rendering retained for now.
import { motion, AnimatePresence } from 'framer-motion';
import { getFirebaseIdToken, auth } from '../lib/firebaseClient';
import { getApiBase, isApiMisconfiguredForHosting } from '../lib/apiBase';
import { useAuth } from '../context/AuthContext';
import { Search, RefreshCw, Copy, Send, Calendar, MapPin, Menu, Check, ChevronLeft, ChevronRight, LogOut, Trash2, ThumbsUp, ThumbsDown, Pencil, Home as HomeIcon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import Avatar from './Avatar.jsx';
import { Clock, Utensils, Bed, Info, Lightbulb } from 'lucide-react';
import { capitalizeLocationSegments, titleCaseLocationText } from '../lib/format';
import { useDevSettings } from '../context/DevSettingsContext.jsx';
import DaySelector from './DaySelector.jsx';
import DatePicker from './DatePicker.jsx';
import ConfirmSummary from './ConfirmSummary.jsx';

// Enhanced StageInput component with advanced date selection and pace options
const StageInput = ({ inputSpec, quickOptions, flowState, setFlowState, onSubmit, stage, hints }) => {
  const [multiSel, setMultiSel] = useState([]);
  const [uiDays, setUiDays] = useState(flowState?.durationDays || 7);
  const [uiDaysFlex, setUiDaysFlex] = useState(flowState?.durationFlex || false);
  const [uiStartDate, setUiStartDate] = useState(flowState?.startDate || '');
  const [uiEndDate, setUiEndDate] = useState(flowState?.endDate || '');
  const [uiDateFlex, setUiDateFlex] = useState(flowState?.dateFlex || 'none');
  const [uiPace, setUiPace] = useState(flowState?.pace || '');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showDurationWarning, setShowDurationWarning] = useState(false);
  const [originalDays, setOriginalDays] = useState(null);
  const [pendingDuration, setPendingDuration] = useState(null);
  // Inline custom input support for options lists ("Other…")
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  // Typeahead for input_locations free text field
  const [locText, setLocText] = useState('');
  const [locSug, setLocSug] = useState([]);
  const [locOpen, setLocOpen] = useState(false);
  const abortRef = useRef(null);
  const capitalizeWords = (s) => titleCaseLocationText(s);
  useEffect(() => {
    if (stage !== 'input_locations' || inputSpec?.type !== 'freeText') { setLocSug([]); setLocOpen(false); return; }
    const last = (locText.split(/[\n,]+/).pop() || '').trim();
    if (last.length < 2) { setLocSug([]); setLocOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const token = await getFirebaseIdToken();
        const base = getApiBase();
        const res = await fetch(`${base}/api/destinations/suggest?q=${encodeURIComponent(last)}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('sugg fail');
        const arr = await res.json();
        setLocSug(Array.isArray(arr) ? arr : []);
        setLocOpen(true);
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('loc typeahead', e?.message);
        setLocSug([]); setLocOpen(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [locText, stage, inputSpec?.type]);

  // Debug logging
  useEffect(() => {
    console.log('StageInput flowState:', flowState);
    console.log('uiStartDate:', uiStartDate, 'uiEndDate:', uiEndDate);
  }, [flowState, uiStartDate, uiEndDate]);

  // Store original days when component loads
  useEffect(() => {
    if (flowState?.durationDays && !originalDays) {
      setOriginalDays(flowState.durationDays);
    }
  }, [flowState?.durationDays, originalDays]);

  useEffect(() => {
    if (inputSpec?.type === 'multiselect') {
      setMultiSel(flowState?.interests || []);
    }
  }, [inputSpec?.type, flowState?.interests]);

  // Helper: format date as local YYYY-MM-DD (avoid UTC toISOString off-by-one)
  const fmtLocalYMD = (d) => {
    if (!(d instanceof Date)) d = new Date(d);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Auto-calculate end date when start date and days are set
  useEffect(() => {
    if (uiStartDate && uiDays && inputSpec?.type === 'dates') {
      const start = new Date(uiStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + uiDays - 1);
      setUiEndDate(fmtLocalYMD(end));
    }
  }, [uiStartDate, uiDays, inputSpec?.type]);

  const generateCalendar = () => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isDateInRange = (day) => {
    if (!day || !uiStartDate) return false;
    const date = new Date(calendarYear, calendarMonth, day);
    const start = new Date(uiStartDate);
    const end = uiEndDate ? new Date(uiEndDate) : start;
    return date >= start && date <= end;
  };

  const isDateSelected = (day) => {
    if (!day) return false;
    const date = fmtLocalYMD(new Date(calendarYear, calendarMonth, day));
    return date === uiStartDate || date === uiEndDate;
  };

  const handleDateSelect = (day) => {
    if (!day) return;
    const selectedDate = new Date(calendarYear, calendarMonth, day);
    const dateString = fmtLocalYMD(selectedDate);

    if (!uiStartDate || (uiStartDate && uiEndDate)) {
      // First click or resetting - set start date
      setUiStartDate(dateString);
      setUiEndDate('');
      setShowDurationWarning(false);
    } else if (uiStartDate && !uiEndDate) {
      // Second click - set end date
      const start = new Date(uiStartDate);
      if (selectedDate >= start) {
        setUiEndDate(dateString);
        const diffTime = selectedDate - start;
        const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Check if duration changed significantly from original
        if (originalDays && Math.abs(newDays - originalDays) > 0) {
          setShowDurationWarning(true);
          setPendingDuration(newDays);
        } else {
          setUiDays(newDays);
        }
      }
    }
  };

  // Handle accepting or rejecting a duration change when end date selection alters days
  const acceptDurationChange = () => {
    if (pendingDuration && pendingDuration > 0) {
      setUiDays(pendingDuration);
    }
    setShowDurationWarning(false);
    setPendingDuration(null);
  };

  const rejectDurationChange = () => {
    if (uiStartDate && originalDays && originalDays > 0) {
      const start = new Date(uiStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + originalDays - 1);
      setUiEndDate(fmtLocalYMD(end));
      setUiDays(originalDays);
    }
    setShowDurationWarning(false);
    setPendingDuration(null);
  };

  const handleSubmit = async (value) => {
    if (inputSpec?.type === 'days') {
      const payload = { 
        durationDays: uiDays, 
        durationFlex: uiDaysFlex
      };
      setFlowState(prev => ({ ...prev, ...payload }));
      
      let response = `${uiDays} days`;
      if (uiDaysFlex) {
        response += ` with flexibility`;
      }
      await onSubmit(response);
      
    } else if (inputSpec?.type === 'dates') {
      const payload = { 
        startDate: uiStartDate, 
        endDate: uiEndDate,
        dateFlex: uiDateFlex,
        durationDays: uiDays
      };
      setFlowState(prev => ({ ...prev, ...payload }));
      
      let response = `Start: ${formatDate(uiStartDate)}`;
      if (uiEndDate) response += ` → End: ${formatDate(uiEndDate)} (${uiDays} days)`;
      if (flowState?.durationFlex && uiDateFlex && uiDateFlex !== 'none') {
        response += ` with ${uiDateFlex} flexibility`;
      }
      await onSubmit(response);
      
    } else if (inputSpec?.type === 'pace') {
      const payload = { pace: uiPace };
      setFlowState(prev => ({ ...prev, ...payload }));
      await onSubmit(`${uiPace} pace`);
      
    } else if (inputSpec?.type === 'multiselect') {
      setFlowState(prev => ({ ...prev, interests: multiSel }));
      await onSubmit(multiSel.join(', '));
    } else {
      // Free text stages
      if (stage === 'input_region') {
        const region = String(value || '').trim();
        if (region) setFlowState(prev => ({ ...prev, region }));
      } else if (stage === 'input_locations') {
          const locations = String(value || '')
            .split(/,|\n/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => capitalizeWords(s));
        if (locations.length) setFlowState(prev => ({ ...prev, locations }));
      }
      await onSubmit(value);
    }
  };

  if (inputSpec?.type === 'options') {
    // Unified option card style with mini descriptions for all option prompts
    const descriptionFor = (label) => {
      const map = {
        // Intent
        'I have specific locations': 'Type your list of places',
        'I only know a region': 'We’ll suggest cities and routes',
        // Travelers
        'Solo Traveler': 'Independent trip for one',
        'A Couple': 'Two travelers together',
        'Family': 'Family-friendly planning',
        'A Group of Friends': 'Fun and flexible group plans',
        // Pace
        'Relaxed': 'Take it easy, plenty of downtime',
        'Balanced': 'Mix of activities and rest',
        'Action-Packed': 'See and do as much as possible',
        'Fixed Schedule': 'Stick to planned itinerary',
        // Budget
        'Budget-Friendly': 'Keep costs low and smart',
        'Mid-Range': 'Comfort plus value',
        'Luxury': 'Premium stays and experiences',
        // Generation
        'Generate itinerary': 'Create your detailed day-by-day plan now',
      };
      return map[label] || 'Make a selection to continue';
    };

    // Prefer server-provided quickOptions; fall back to inputSpec.options so mock mode works too
    const opts = (Array.isArray(quickOptions) && quickOptions.length
      ? quickOptions
      : (Array.isArray(inputSpec?.options) ? inputSpec.options : []));
    const gridCols = (() => {
      const n = opts.length;
      if (n === 1) return 'grid-cols-1';
      if (n === 2) return 'grid-cols-2';
      if (n === 3) return 'grid-cols-3'; // all in one line
      if (n === 4) return 'grid-cols-2'; // 2 + 2, avoid 3+1
      return 'grid-cols-2 md:grid-cols-3';
    })();

  const centerSingle = (stage === 'generate_suggestions' || stage === 'iterate') && opts.length === 1;
    // Determine if we should disable Generate itinerary based on required fields
    const requiresGuard = opts.includes('Generate itinerary');
    const hasDest = (Array.isArray(flowState?.locations) && flowState.locations.length > 0) || !!flowState?.region;
    const hasDuration = !!flowState?.durationDays || (flowState?.startDate && flowState?.endDate);

    const [otherOpen, setOtherOpen] = React.useState(false);
    const [otherText, setOtherText] = React.useState('');
    const showOther = !opts.some(o => String(o).toLowerCase() === 'other');

    return (
      <div className="space-y-4">
        <div className={`${centerSingle ? 'grid grid-cols-1 place-items-center' : `grid ${gridCols}`} gap-4`}>
          {opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                // For the initial intent question, route explicitly to the correct next stage
                if ((stage === 'greeting' || stage === 'ask_intent')) {
                  const override = opt === 'I have specific locations'
                    ? 'input_locations'
                    : (opt === 'I only know a region' ? 'input_region' : null);
                  if (override) {
                    onSubmit({ value: opt, stageOverride: override });
                    return;
                  }
                }
                handleSubmit(opt);
              }}
              disabled={requiresGuard && opt === 'Generate itinerary' && !(hasDest && hasDuration)}
              className={`p-4 rounded-xl text-sm transition-all bg-white/10 text-white/90 hover:bg-purple-500/20 border-2 border-white/20 hover:border-purple-400 group text-left ${centerSingle ? 'min-w-[280px]' : ''}`}
            >
              <div className="font-medium text-base text-purple-200 group-hover:text-purple-100">{opt}</div>
              <div className="text-xs opacity-75 mt-1 text-white/70">{descriptionFor(opt)}</div>
            </button>
          ))}
          {showOther && (
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/5 border border-white/20">
              {!otherOpen ? (
                <button
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-sm border border-white/20"
                  onClick={() => setOtherOpen(true)}
                  disabled={isTyping}
                >Other…</button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 placeholder-white/50 text-sm"
                    placeholder="Type your own answer"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    disabled={isTyping}
                  />
                  <button
                    className="px-3 py-2 rounded-lg bg-[#19c37d] text-black font-semibold disabled:opacity-50"
                    onClick={() => { if (otherText.trim()) handleSubmit(otherText.trim()); }}
                    disabled={isTyping || !otherText.trim()}
                  >Send</button>
                </div>
              )}
            </div>
          )}
        </div>
        {requiresGuard && !hasDest && (
          <div className="text-center text-xs text-white/70">Add at least one destination or a region first.</div>
        )}
        {requiresGuard && hasDest && !hasDuration && (
          <div className="text-center text-xs text-white/70">Set trip days or select dates before generating.</div>
        )}
      </div>
    );
  }

  if (inputSpec?.type === 'multiselect') {
    const options = inputSpec?.options || [];
    return (
      <div className="space-y-4">
        <div className="text-center text-white/80 text-sm mb-4">Select all that interest you:</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {options.map((opt, i) => {
            const isSelected = multiSel.includes(opt);
            return (
              <button
                key={i}
                onClick={() => {
                  setMultiSel(prev => 
                    isSelected ? prev.filter(x => x !== opt) : [...prev, opt]
                  );
                }}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  isSelected 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-200' 
                    : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                }`}
              >
                <div className="text-sm font-medium flex items-center justify-between">
                  {opt}
                  {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => handleSubmit(multiSel)}
            disabled={multiSel.length === 0}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
          >
            Continue ({multiSel.length} selected)
          </button>
        </div>
      </div>
    );
  }

  if (inputSpec?.type === 'days') {
    return (
      <div className="space-y-6">
        {/* Quick Day Selector component for streamlined input */}
        <div className="max-w-md mx-auto">
          {(() => {
            // Build suggestions: include defaults and optionally a numeric hint
            const hinted = (() => {
              const raw = hints?.recommended_days;
              if (!raw) return null;
              const m = String(raw).match(/\d+/);
              return m ? parseInt(m[0], 10) : null;
            })();
            const base = [3, 5, 7, 10];
            const sugg = Array.from(new Set([...(hinted ? [hinted] : []), ...base]));
            return (
              <DaySelector
                currentValue={uiDays}
                onValueChange={(v) => setUiDays(parseInt(String(v || 0), 10) || 1)}
                suggestedDurations={sugg}
                onSelect={(d) => {
                  const val = parseInt(String(d || 0), 10) || 1;
                  setUiDays(val);
                  // Confirm immediately for faster flow
                  handleSubmit(val);
                }}
              />
            );
          })()}
        </div>

        <div className="text-center">
          <div className="text-white/80 text-sm mb-4">How many days are you planning?</div>
          <div className="flex items-center justify-center gap-4 mb-2">
            <button
              onClick={() => setUiDays(Math.max(1, uiDays - 1))}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xl font-bold"
            >
              −
            </button>
            <div className="text-3xl font-bold text-white min-w-[4rem] px-4 py-2 bg-white/10 rounded-xl border border-white/20">
              {uiDays}
            </div>
            <button
              onClick={() => setUiDays(uiDays + 1)}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xl font-bold"
            >
              +
            </button>
          </div>
          {latestHints?.recommended_days && (
            <div className="text-center text-xs text-emerald-200 mb-3">
              Suggested by AI: <button
                className="underline hover:no-underline"
                onClick={() => {
                  const n = parseInt(String(latestHints.recommended_days).match(/\d+/)?.[0] || '');
                  if (n) setUiDays(n);
                }}
              >{latestHints.recommended_days} days</button>
            </div>
          )}
        </div>

        {hints?.recommended_days && (
          <div className="mx-auto max-w-sm rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 text-xs flex items-center justify-between gap-3">
            <span className="opacity-90">Suggested: {hints.recommended_days} days</span>
            <button
              onClick={() => {
                const numeric = parseInt(String(hints.recommended_days).match(/\d+/)?.[0] || '');
                if (numeric) setUiDays(numeric);
              }}
              className="px-2 py-1 rounded-md bg-emerald-500/30 hover:bg-emerald-500/50 text-[11px] font-medium"
            >Apply</button>
          </div>
        )}

        {/* Simple flexibility checkbox with description */}
        <div className="text-center">
          <label className="inline-flex items-center gap-3 text-white/90 text-sm cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={uiDaysFlex}
                onChange={(e) => setUiDaysFlex(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 transition-all ${
                uiDaysFlex 
                  ? 'bg-green-500 border-green-500' 
                  : 'bg-transparent border-white/40'
              }`}>
                {uiDaysFlex && (
                  <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                )}
              </div>
            </div>
            <span>Flexible dates</span>
          </label>
          <div className="text-xs text-white/60 mt-1">
            Flexibility means ±2-3 days adjustment in your trip duration
          </div>
        </div>

        <button
          onClick={() => handleSubmit(uiDays)}
          className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Continue with {uiDays} days
        </button>
      </div>
    );
  }

  if (inputSpec?.type === 'dates') {
    return (
      <div className="space-y-6">
        <div className="text-center text-white/80 text-sm">Plan your travel dates</div>

        {/* Inline simplified DatePicker for quick selection */}
        <div className="max-w-2xl mx-auto">
          {hints?.best_months && (
            <div className="mb-2 text-center">
              <span className="inline-block text-[11px] px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200">
                Best months: {hints.best_months}
              </span>
            </div>
          )}
          {(() => {
            const suggestedMonths = (() => {
              const raw = hints?.best_months;
              if (!raw) return [];
              // Split on commas or slashes; trim and remove empties
              return String(raw).split(/[,/]| and /i).map(s => s.trim()).filter(Boolean);
            })();
            const handleDpSelect = (payload) => {
              if (typeof payload !== 'string') return;
              if (/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/.test(payload)) {
                const [s, e] = payload.split(' to ').map(x => x.trim());
                setUiStartDate(s);
                setUiEndDate(e);
                try {
                  const sd = new Date(s);
                  const ed = new Date(e);
                  const diff = Math.ceil((ed - sd) / (1000 * 60 * 60 * 24)) + 1;
                  if (diff > 0) setUiDays(diff);
                } catch {}
                // Keep confirmation via existing Confirm button
                return;
              }
              if (/^\d{4}-\d{2}-\d{2}$/.test(payload)) {
                setUiStartDate(payload);
                // Auto end date will be derived if uiDays is known via effect above
                return;
              }
              // Otherwise treat as month/season preference text and send directly
              onSubmit(payload);
            };
            return (
              <DatePicker
                startDate={uiStartDate}
                duration={uiDays}
                suggestedMonths={suggestedMonths}
                onSelect={handleDpSelect}
              />
            );
          })()}
        </div>
        
        {/* Main layout: Left side (inputs + submit) and Right side (calendar + flexibility) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Side - Date Inputs, Trip Summary, and Submit Button */}
          <div className="space-y-6">
            {/* Date inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Start Date</label>
                <input
                  type="date"
                  value={uiStartDate}
                  onChange={(e) => {
                    setUiStartDate(e.target.value);
                    setShowDurationWarning(false);
                    console.log('Start date changed:', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
                    min={fmtLocalYMD(new Date())}
                />
                {uiStartDate && (
                  <p className="mt-1 text-xs text-white/70">{formatDate(uiStartDate)}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  End Date {uiDays && `(${uiDays} days)`}
                </label>
                <input
                  type="date"
                  value={uiEndDate}
                  onChange={(e) => {
                    setUiEndDate(e.target.value);
                    console.log('End date changed:', e.target.value);
                    if (uiStartDate && e.target.value) {
                      const start = new Date(uiStartDate);
                      const end = new Date(e.target.value);
                      const diffTime = end - start;
                      const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      
                      // Check for duration change
                      if (originalDays && Math.abs(newDays - originalDays) > 0) {
                        setShowDurationWarning(true);
                        setPendingDuration(newDays);
                      } else {
                        setUiDays(newDays);
                      }
                    }
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
                  min={uiStartDate || fmtLocalYMD(new Date())}
                />
                {uiEndDate && (
                  <p className="mt-1 text-xs text-white/70">{formatDate(uiEndDate)}</p>
                )}
              </div>
            </div>

            {/* Trip summary */}
            {uiStartDate && uiEndDate && (
              <div className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-400/30 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-blue-200 font-medium flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Trip Summary
                  </div>
                  <div className="text-sm text-blue-300 mt-1">
                    {formatDate(uiStartDate)} → {formatDate(uiEndDate)}
                  </div>
                  <div className="text-lg font-bold text-blue-100 mt-1">
                    {uiDays} days
                    {originalDays && uiDays !== originalDays && (
                      <span className="text-xs text-yellow-300 ml-2">
                        (Changed from {originalDays} days)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Duration Change Warning */}
            {showDurationWarning && (
              <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-400/50 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-yellow-200 font-medium flex items-center justify-center gap-2 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Duration Changed
                  </div>
                  <p className="text-sm text-yellow-100 mb-3">
                    You originally selected <strong>{originalDays} days</strong>, but your new dates span <strong>{pendingDuration} days</strong>.
                    {pendingDuration > originalDays ? ' This extends your trip.' : ' This shortens your trip.'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={acceptDurationChange}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Accept ({pendingDuration} days)
                    </button>
                    <button
                      onClick={rejectDurationChange}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Keep Original ({originalDays} days)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button - moved here from bottom */}
            <div className="bg-gradient-to-br from-black/20 to-black/40 backdrop-blur-md p-5 rounded-xl border border-white/20">
              <button
                onClick={() => {
                  console.log('Confirm dates clicked. Start:', uiStartDate, 'End:', uiEndDate);
                  if (uiStartDate || uiEndDate) {
                    handleSubmit(uiStartDate || uiEndDate);
                  }
                }}
                disabled={!uiStartDate && !uiEndDate}
                className="w-full px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center gap-3">
                  <Calendar className="w-5 h-5" />
                  <span>Confirm Dates</span>
                  {flowState?.durationFlex && uiDateFlex && uiDateFlex !== 'none' && (
                    <span className="text-sm opacity-90">({uiDateFlex} flexibility)</span>
                  )}
                </div>
              </button>
              
              {/* Debug info - smaller and more subtle */}
              <div className="mt-3 text-xs text-white/40 text-center">
                {uiStartDate || 'No start'} • {uiEndDate || 'No end'} • {uiDays} days
              </div>
            </div>
          </div>

          {/* Right Side - Calendar + Flexibility Options */}
          <div className="space-y-4">
            {/* Calendar */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-5 backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                
                <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  {hints?.best_months && (
                    <span className="text-[11px] font-normal px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200">
                      Best: {hints.best_months}
                    </span>
                  )}
                </h3>
                
                <button
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-white/70">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {generateCalendar().map((day, index) => {
                  const todayMid = new Date(); todayMid.setHours(0,0,0,0);
                  const isDisabled = !day || new Date(calendarYear, calendarMonth, day) < todayMid;
                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(day)}
                      disabled={isDisabled}
                      className={`p-2 text-sm rounded-lg transition-all ${
                        !day 
                          ? 'invisible' 
                          : isDateSelected(day)
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg'
                          : isDateInRange(day)
                          ? 'bg-blue-300/30 text-blue-200 border border-blue-400/50'
                          : isDisabled
                          ? 'text-white/30 cursor-not-allowed'
                          : 'text-white/90 hover:bg-white/20 hover:scale-110'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Instruction text below calendar */}
              <div className="mt-4 text-[11px] text-white/50 text-center">
                Click once for start, again for end. {hints?.best_months ? `Prime months: ${hints.best_months}` : ''}
              </div>
            </div>

            {/* Flexibility options - moved to below calendar */}
            {flowState?.durationFlex && (uiStartDate || uiEndDate) && (
              <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-5 border border-white/20 backdrop-blur-sm">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-medium text-white/90 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Date Flexibility Options
                  </h3>
                  <p className="text-xs text-white/60 mt-1">Choose your preferred flexibility level</p>
                </div>
                
                <div className="space-y-3">
                  {[
                    { key: 'start', label: 'Start flexibility', desc: '±2-3 days at beginning', icon: '🏁' },
                    { key: 'end', label: 'End flexibility', desc: '±2-3 days at conclusion', icon: '🏃‍♂️' },
                    { key: 'full', label: 'Full flexibility', desc: 'Throughout entire trip', icon: '🌟' }
                  ].map(option => (
                    <button
                      key={option.key}
                      onClick={() => setUiDateFlex(option.key)}
                      className={`w-full p-3 rounded-lg text-sm transition-all duration-200 ${
                        uiDateFlex === option.key
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                          : 'bg-white/10 text-white/90 hover:bg-white/20 hover:scale-102'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{option.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium flex items-center gap-2">
                            {option.label}
                            {uiDateFlex === option.key && <Check className="w-4 h-4" />}
                          </div>
                          <div className="text-xs opacity-75">{option.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Separate pace question with fix option
  if (inputSpec?.type === 'pace') {
    return (
      <div className="space-y-6">
        <div className="text-center text-white/80 text-sm mb-6">What's your preferred travel pace?</div>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'relaxed', label: 'Relaxed', desc: 'Take it easy, plenty of downtime' },
            { key: 'moderate', label: 'Moderate', desc: 'Balanced mix of activities and rest' },
            { key: 'fast', label: 'Fast-paced', desc: 'See and do as much as possible' },
            { key: 'fixed', label: 'Fixed Schedule', desc: 'Stick to planned itinerary' }
          ].map(option => (
            <button
              key={option.key}
              onClick={() => setUiPace(option.key)}
              className={`p-4 rounded-xl text-sm transition-all ${
                uiPace === option.key
                  ? 'bg-purple-500 text-white border-2 border-purple-400'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border-2 border-white/20'
              }`}
            >
              {uiPace === option.key && <Check className="w-4 h-4 inline mr-2" />}
              <div className="font-medium text-base">{option.label}</div>
              <div className="text-xs opacity-75 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => handleSubmit(uiPace)}
          disabled={!uiPace}
          className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
        >
          Continue with {uiPace} pace
        </button>
      </div>
    );
  }

  return null;
};

// Render itinerary cards
const ItineraryCards = ({ items }) => {
  const iconFor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'food': return Utensils;
      case 'activity': return MapPin;
      case 'lodging': return Bed;
      case 'info': return Info;
      case 'tip': return Lightbulb;
      default: return MapPin;
    }
  };
  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const Icon = iconFor(it.type);
        return (
          <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-white/10 grid place-items-center">
                <Icon className="w-4 h-4 text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-white font-medium truncate">{it.title || 'Untitled'}</h4>
                  {it.time ? (
                    <span className="inline-flex items-center gap-1 text-xs text-white/80 bg-white/10 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />{it.time}</span>
                  ) : null}
                </div>
                {it.description ? (
                  <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{it.description}</p>
                ) : null}
                {it.type ? (
                  <div className="mt-2 text-[11px] text-white/60 capitalize">{it.type}</div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChatMessage = ({ index, message, userName, onCopy, onRegenerate, onReact, onEdit }) => {
  const isUser = message.role === 'user';
  const assistantCls = 'w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/5 backdrop-blur-md border border-white/8 text-white shadow-inner';
  const userCls = 'ml-auto inline-block max-w-[70%] rounded-[18px] px-4 py-3 text-sm font-medium text-white bg-gradient-to-br from-[#16a34a]/80 to-[#10b981]/80 border border-white/10 shadow-inner whitespace-pre-wrap break-words text-center leading-6';
  const [showThinking, setShowThinking] = React.useState(false);
  const hasThinking = !!message?.contextUsed;

  const gapCls = isUser ? 'gap-3' : 'gap-4';

  return (
    <div className={`group/message flex items-start ${gapCls} my-6 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <Avatar role={message.role} />}
      <div>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <div className={assistantCls}>
            <ItineraryCards items={message.content} />
          </div>
        ) : isUser ? (
          <div className="relative">
            <div className={userCls}>{message.content}</div>
            {/* Edit button on hover (user messages) */}
            <div className="absolute -top-2 -right-2 opacity-0 group-hover/message:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit?.(index)}
                title="Edit"
                className="h-8 w-8 rounded-md bg-white/5 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className={assistantCls}>
              <div className="prose prose-invert prose-p:my-0 prose-headings:my-2 break-words">
                <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
              </div>
              {/* Per-new spec: remove centralized hints panel; hints now appear contextually in StageInput */}
            </div>
            {/* Hover-only toolbar under assistant messages */}
            <div className="mt-2 flex items-center gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity pointer-events-none group-hover/message:pointer-events-auto">
              <button onClick={onRegenerate} title="Regenerate" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => onCopy(String(message.content ?? ''))} title="Copy" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => onReact?.(index, 'like')} title="Like" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button onClick={() => onReact?.(index, 'dislike')} title="Dislike" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <ThumbsDown className="w-4 h-4" />
              </button>
              {hasThinking && (
                <button
                  onClick={() => setShowThinking(v => !v)}
                  title={showThinking ? 'Hide thinking' : 'Show thinking'}
                  className="h-8 rounded-md px-2 bg-white/6 border border-white/10 text-white/90 hover:bg-white/10 flex items-center gap-1 text-xs"
                >
                  <Lightbulb className="w-4 h-4" /> {showThinking ? 'Hide' : 'Thinking'}
                </button>
              )}
            </div>
            {hasThinking && showThinking && (
              <div className="mt-3 rounded-xl bg-black/40 border border-white/10 p-3 text-xs text-white/80">
                <div className="mb-1 font-medium text-white/90">Context used</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 opacity-90">{JSON.stringify(message.contextUsed, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && <Avatar role={message.role} name={userName} />}
    </div>
  );
};

export default function ChatboxStage({ isSidebarOpen = false, setIsSidebarOpen = () => {}, onItineraryGenerated }) {
  const navigate = useNavigate();
  const { settings } = useDevSettings();
  const { currentUser } = useAuth();
  const fullNameOrEmail = currentUser?.displayName || currentUser?.email || '';
  const shortName = (() => {
    try {
      const raw = (currentUser?.displayName || '').trim();
      const parts = raw ? raw.split(/\s+/).filter(Boolean) : [];
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`; // first + last
      if (parts.length === 1) return parts[0];
      // fallback to email prefix
      const e = (currentUser?.email || '').split('@')[0];
      return e || 'Guest';
    } catch (e) {
      return (currentUser?.email || 'Guest').split('@')[0];
    }
  })();
  const firstName = (() => {
    const raw = (currentUser?.displayName || currentUser?.email || '').trim();
    if (!raw) return '';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length) return parts[0];
    return raw.split('@')[0] || raw;
  })();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chats, setChats] = useState(() => [{ id: 'default', title: 'New chat', messages: [] }]);
  const searchRef = useRef(null);
  const [activeId, setActiveId] = useState('default');
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState('');
  const [inputSuggestions, setInputSuggestions] = useState([]);
  const [inputSuggestOpen, setInputSuggestOpen] = useState(false);
  const inputSuggestAbortRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  // Dynamic flow: next question from backend
  const [currentQuestionType, setCurrentQuestionType] = useState(null);
  const [currentQuestionPrompt, setCurrentQuestionPrompt] = useState('');
  const [currentQuestionCurrentValue, setCurrentQuestionCurrentValue] = useState(null);
  const [currentQuestionOptions, setCurrentQuestionOptions] = useState([]);
  // Simple local states for dynamic widgets
  const [dynText, setDynText] = useState('');
  const [dynSuggestions, setDynSuggestions] = useState([]);
  const [dynSuggestOpen, setDynSuggestOpen] = useState(false);
  const dynSuggestAbortRef = useRef(null);
  const [dynDays, setDynDays] = useState(5);
  const [dynStartDate, setDynStartDate] = useState('');
  const [dynEndDate, setDynEndDate] = useState('');
  const [dynTravelers, setDynTravelers] = useState(2);
  const [funNick, setFunNick] = useState(() => {
    try { return localStorage.getItem('voyager_fun_nick') || ''; } catch { return ''; }
  });

  // Prefill dynamic widgets when backend provides a current value
  useEffect(() => {
    if (currentQuestionType === 'destination' || currentQuestionType === 'freeText') {
      if (typeof currentQuestionCurrentValue === 'string') setDynText(currentQuestionCurrentValue);
    }
    if (currentQuestionType === 'duration') {
      const n = parseInt(currentQuestionCurrentValue, 10);
      if (!Number.isNaN(n) && n > 0) setDynDays(n);
    }
    if (currentQuestionType === 'dates') {
      if (currentQuestionCurrentValue && typeof currentQuestionCurrentValue === 'string' && currentQuestionCurrentValue.includes(' to ')) {
        const [s, e] = currentQuestionCurrentValue.split(' to ').map(x => x.trim());
        if (s) setDynStartDate(s);
        if (e) setDynEndDate(e);
      }
    }
    if (currentQuestionType === 'travelers') {
      const n = parseInt(currentQuestionCurrentValue, 10);
      if (!Number.isNaN(n) && n > 0) setDynTravelers(n);
    }
  }, [currentQuestionType, currentQuestionCurrentValue]);

  // Derive a fun user nickname from saved DNA (onboarding) answers
  useEffect(() => {
    try {
      const key = `voyager:onboard:v1:${currentUser?.uid || 'anon'}`;
      const raw = localStorage.getItem(key);
      let nick = '';
      if (raw) {
        const parsed = JSON.parse(raw);
        const answers = parsed?.answers || {};
        const likes = (k) => {
          const v = answers[k];
          if (!v) return '';
          if (Array.isArray(v)) return v.join(' ').toLowerCase();
          return String(v).toLowerCase();
        };
        const s = [likes('interests'), likes('pace'), likes('food'), likes('vibe'), likes('style')].filter(Boolean).join(' ');
        if (/food|cuisine|eat|veg|restaurant|street/.test(s)) nick = 'Culinary Voyager';
        else if (/adventure|hike|trail|mountain|surf|ski|thrill/.test(s)) nick = 'Trailblazer';
        else if (/relax|spa|beach|chill|slow/.test(s)) nick = 'Chill Explorer';
        else if (/museum|art|history|culture/.test(s)) nick = 'Culture Seeker';
        else if (/night|party|club|bar/.test(s)) nick = 'Night Owl';
        else nick = 'Globetrotter';
      }
      setFunNick(nick);
      try { localStorage.setItem('voyager_fun_nick', nick); } catch {}
    } catch {}
  }, [currentUser?.uid]);

  // Sidebar subcomponent: lists locally saved itineraries with their chat titles
  const ItineraryList = ({ isOpen }) => {
    const [items, setItems] = useState(() => {
      try { return JSON.parse(localStorage.getItem('voyager_local_journeys') || '[]'); } catch { return []; }
    });
    const refresh = () => {
      try { setItems(JSON.parse(localStorage.getItem('voyager_local_journeys') || '[]')); } catch { setItems([]); }
    };
    useEffect(() => {
      const onSaved = () => refresh();
      try { window.addEventListener('voyager:itinerarySaved', onSaved); } catch {}
      return () => { try { window.removeEventListener('voyager:itinerarySaved', onSaved); } catch {} };
    }, []);
    if (!Array.isArray(items) || !items.length) {
      return isOpen ? (<div className="text-white/50 text-xs px-1">No itineraries yet</div>) : null;
    }
    return (
      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('voyager:openItinerary', { detail: { markdown: it.markdown, plannedDays: it.durationDays || null } }));
              } catch {}
            }}
            className={`w-full ${isOpen ? 'px-2 py-1.5 text-left' : 'p-2 text-center'} rounded-md text-white/80 hover:bg-white/8 transition-colors`}
            title={it.title || 'Itinerary'}
          >
            {isOpen ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white/60" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-white/90">{it.title || 'Itinerary'}</div>
                  <div className="text-[11px] text-white/60 truncate">{new Date(it.date || Date.now()).toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <Calendar className="w-4 h-4" />
            )}
          </button>
        ))}
      </div>
    );
  };

  // Debounced typeahead for destination input
  useEffect(() => {
    const v = String(dynText || '');
    const lastSegment = v.split(/[\n,]+/).pop()?.trim() || '';
    const shouldSuggest = currentQuestionType === 'destination' && lastSegment.length >= 2;
    if (!shouldSuggest) { setDynSuggestions([]); setDynSuggestOpen(false); return; }
    const handler = setTimeout(async () => {
      try {
        if (dynSuggestAbortRef.current) { dynSuggestAbortRef.current.abort(); }
        const ctrl = new AbortController();
        dynSuggestAbortRef.current = ctrl;
        const token = await getFirebaseIdToken();
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/api/destinations/suggest?q=${encodeURIComponent(lastSegment)}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Suggest failed ${res.status}`);
        const arr = await res.json();
        setDynSuggestions(Array.isArray(arr) ? arr : []);
        setDynSuggestOpen(true);
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('typeahead error', e?.message);
        setDynSuggestions([]);
        setDynSuggestOpen(false);
      }
    }, 180);
    return () => clearTimeout(handler);
  }, [dynText, currentQuestionType]);

  // Helper: auto-capitalize first letter of each word for destinations
  const capitalizeWords = (s) => titleCaseLocationText(s);
  // Frontend is a dumb renderer; backend provides stage/inputSpec/quickOptions
  const [inputSpec, setInputSpec] = useState({ type: 'freeText' });
  const [quickOptions, setQuickOptions] = useState([]);
  const [flowState, setFlowState] = useState({});
  const [stage, setStage] = useState('greeting');
  const [latestHints, setLatestHints] = useState(null);
  const greetedRef = useRef(new Set());
  const lastAssistantStageRef = useRef({});
  const endRef = useRef(null);
  const sendingRef = useRef(false); // Prevent concurrent sends

  // Minimal toast helper
  const showToast = (text) => {
    try {
      const root = document.getElementById('toast-root');
      if (!root) return;
      const el = document.createElement('div');
      el.className = 'px-3 py-1.5 rounded-md text-xs text-white bg-white/10 border border-white/15 backdrop-blur-md';
      el.textContent = text;
      root.appendChild(el);
      setTimeout(() => {
        el.style.transition = 'opacity 300ms';
        el.style.opacity = '0';
        setTimeout(() => root.removeChild(el), 320);
      }, 1200);
    } catch {}
  };

  // Debug: Log current state to understand question/option mismatch
  console.log('🔍 ChatboxStage State Debug:', {
    stage,
    inputSpecType: inputSpec?.type,
    inputSpecOptions: inputSpec?.options,
    lastMessage: activeChat?.messages?.slice(-1)[0],
    messagesLength: activeChat?.messages?.length || 0
  });

  // Let server drive inputSpec; only fill reasonable defaults if missing
  useEffect(() => {
    if (!inputSpec || !inputSpec.type) {
      // Minimal fallback map if server didn't provide input
      const fallback = {
        greeting: { type: 'options', options: ['I have specific locations', 'I only know a region'] },
        ask_intent: { type: 'options', options: ['I have specific locations', 'I only know a region'] },
        ask_duration: { type: 'days' },
        ask_dates: { type: 'dates' },
        ask_travelers: { type: 'options', options: ['Solo Traveler', 'A Couple', 'Family', 'A Group of Friends'] },
        ask_pace: { type: 'options', options: ['Relaxed', 'Balanced', 'Action-Packed'] },
        ask_interests: { type: 'multiselect', options: [
          'History & Museums',
          'Food & Local Cuisine',
          'Adventure & Outdoors',
          'Art & Culture',
          'Nightlife & Entertainment',
          'Shopping',
          'Relaxation & Wellness',
        ] },
        ask_budget: { type: 'options', options: ['Budget-Friendly','Mid-Range','Luxury'] },
      };
      setInputSpec(fallback[stage] || { type: 'freeText' });
    }
  }, [stage, inputSpec]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isTyping]);

  // Resolve API base with production safeguards
  const base = getApiBase();
  const apiMisconfigured = isApiMisconfiguredForHosting();

  // Local mock helpers when useGeminiApi is false
  const devMockReply = (payload) => {
    // simple rule-based canned responses for testing
    const s = (payload?.stage || stage);
    if (s === 'greeting') {
      return {
        reply: `Hey${firstName ? ' ' + firstName : ''}! I’m Voyager. Shall we start with specific locations you already have, or would you like me to suggest cities for a region?`,
        stageNext: 'ask_intent',
        input: { type: 'options', options: ['I have specific locations', 'I only know a region'] },
        quickOptions: ['I have specific locations', 'I only know a region'],
      };
    }
    if (s === 'input_locations') {
      // If we don't have locations yet, prompt for them
      let existing = payload?.state?.locations;
      let fromMsg = (payload?.message || '').trim();
      let parsed = [];
      if (fromMsg && fromMsg.toLowerCase() !== 'i have specific locations') {
        parsed = fromMsg
          .split(/[\n,]+/)
          .map(x => x.trim())
          .filter(Boolean);
      }
      const locations = Array.isArray(existing) && existing.length ? existing : parsed;
      if (!locations.length) {
        return {
          reply: 'Please share your destinations (comma-separated). For example: Paris, Lyon',
          stageNext: 'input_locations',
          input: { type: 'freeText', placeholder: 'Type cities/places, e.g., Paris, Lyon' }
        };
      }
      return {
        reply: 'Great! How many days are you planning?',
        stageNext: 'ask_duration',
        input: { type: 'days' },
        state: { locations }
      };
    }
    if (s === 'input_region') {
      // If we don't have a region yet, prompt for one
      const existing = (payload?.state?.region || '').trim();
      const fromMsg = (payload?.message || '').trim();
      const region = existing || (fromMsg && fromMsg.toLowerCase() !== 'i only know a region' ? fromMsg : '');
      if (!region) {
        return {
          reply: 'Which region are you considering? (e.g., Southern France)',
          stageNext: 'input_region',
          input: { type: 'freeText', placeholder: 'Type a region, e.g., Southern France' }
        };
      }
      return {
        reply: 'Nice choice. How many days are you planning?',
        stageNext: 'ask_duration',
        input: { type: 'days' },
        state: { region }
      };
    }
    if (s === 'ask_duration') {
      return {
        reply: 'Noted! Want to pick exact dates?',
        stageNext: 'ask_dates',
        input: { type: 'dates' },
        state: { durationDays: payload?.state?.durationDays }
      };
    }
    if (s === 'ask_dates') {
      return {
        reply: 'Thanks, almost done. Choose your travel pace:',
        stageNext: 'ask_pace',
        input: { type: 'options', options: ['Relaxed', 'Balanced', 'Action-Packed'] },
        quickOptions: ['Relaxed', 'Balanced', 'Action-Packed'],
      };
    }
    if (s === 'ask_pace') {
      return {
        reply: 'Ready to generate your itinerary?',
        stageNext: 'generate_suggestions',
        input: { type: 'options', options: ['Generate itinerary'] },
        quickOptions: ['Generate itinerary'],
        state: { pace: payload?.message || 'Balanced' },
      };
    }
    // default fallback
    return {
      reply: 'Acknowledged. Continue...',
      stageNext: 'greeting',
      input: { type: 'options', options: ['I have specific locations', 'I only know a region'] }
    };
  };

  const devMockItinerary = (st) => {
    const loc = (st?.locations && st.locations[0]) || st?.region || 'your destination';
    const days = st?.durationDays || 3;
    const morning = [
      'Explore a landmark',
      'Guided walking tour',
      'Neighborhood coffee crawl',
      'Museum highlights'
    ];
    const afternoon = [
      'Local cafe and stroll',
      'Riverfront promenade',
      'Food market tastings',
      'Biking through scenic areas'
    ];
    const evening = [
      'Scenic viewpoint',
      'Sunset by the waterfront',
      'Live music venue',
      'Street food night'
    ];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    let md = `# ${days}-Day Plan for ${loc}\n\n`;
    for (let d = 1; d <= days; d++) {
      md += `## Day ${d}\n- Morning: ${pick(morning)}\n- Afternoon: ${pick(afternoon)}\n- Evening: ${pick(evening)}\n\n`;
    }
    md += `\n> Mock itinerary generated locally (Gemini disabled).`;
    return md;
  };
  
  // Generate a catchy chat title using backend AI endpoint
  const updateChatTitle = async (tripOverride = {}) => {
    try {
      if (settings.devMode && !settings.useGeminiApi) {
        const title = (() => {
          const loc = (tripOverride.locations?.[0]) || flowState.locations?.[0] || flowState.region || 'Trip';
          const days = tripOverride.durationDays || flowState.durationDays || '';
          return `${loc}${days ? ` • ${days}d` : ''}`;
        })();
        setChats(prev => prev.map(c => c.id === activeId ? { ...c, title } : c));
        return;
      }
      const token = await getFirebaseIdToken();
      const payload = { tripState: { ...flowState, ...tripOverride } };
      let res = await fetch(`${base}/api/journeys/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      // If token is expired or invalid, refresh once and retry
      if (res.status === 401 || res.status === 403) {
        const fresh = await getFirebaseIdToken(true);
        if (fresh) {
          res = await fetch(`${base}/api/journeys/title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` },
            body: JSON.stringify(payload),
          });
        }
      }
      if (!res.ok) return;
      const data = await res.json();
      const nextTitle = (data?.title || '').trim();
      if (!nextTitle) return;
      setChats(prev => prev.map(c => c.id === activeId ? { ...c, title: nextTitle, subtitle: data?.subtitle } : c));
    } catch {}
  };
  
  // Generate itinerary via dedicated API, bypassing chat generation to save cost
  const generateItineraryDirect = async () => {
    const chatId = activeId;
    try {
      if (apiMisconfigured) {
        pushMessage(chatId, 'assistant', {
          content: 'Service is not configured for production. Please set VITE_API_BASE to your live backend URL and redeploy.'
        });
        return;
      }
      // Pre-check: require at least a destination or a region before generating
      const hasDest = (Array.isArray(flowState?.locations) && flowState.locations.length > 0) || !!flowState?.region;
      if (!hasDest) {
        // Nudge the user and route to the destinations input
        pushMessage(chatId, 'assistant', {
          content: 'Need Destinations First\n\nPlease provide at least one destination (city/place) or a region before generating an itinerary.'
        });
        setStage('input_locations');
        setInputSpec({ type: 'freeText', placeholder: 'Type one or more cities/places (comma-separated)…' });
        return;
      }

      setIsTyping(true);
      // Show the user's click in the transcript if not already present
      pushMessage(chatId, 'user', 'Generate itinerary');
      const token = await getFirebaseIdToken();
      if (!token && currentUser == null && (settings.devMode && settings.useGeminiApi)) {
        pushMessage(chatId, 'assistant', {
          content: 'Please sign in to generate an itinerary.'
        });
        return;
      }

      // Only use mock if explicitly in devMode AND useGeminiApi is false AND running on localhost
      if (settings.devMode && !settings.useGeminiApi && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const markdown = devMockItinerary(flowState);
        if (typeof onItineraryGenerated === 'function') {
          onItineraryGenerated({ markdown, plannedDays: flowState?.durationDays || null });
          pushMessage(chatId, 'assistant', { content: 'Mock itinerary ready — opening the canvas.' });
        } else {
          pushMessage(chatId, 'assistant', { content: markdown });
        }
        setStage('iterate');
        setInputSpec({ type: 'freeText' });
        return;
      }
      let res = await fetch(`${base}/api/itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tripState: { ...flowState } }),
      });
      if (res.status === 401 || res.status === 403) {
        const fresh = await getFirebaseIdToken(true);
        if (fresh) {
          res = await fetch(`${base}/api/itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` },
            body: JSON.stringify({ tripState: { ...flowState } }),
          });
        }
      }
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401) {
          throw new Error('401 Unauthorized — please sign in.');
        }
        throw new Error(`${res.status}: ${errText}`);
      }
      const markdown = await res.text();
      // If parent provided a handler, show the dedicated Itinerary Canvas instead of dumping markdown in chat
      if (typeof onItineraryGenerated === 'function') {
        onItineraryGenerated({ markdown, plannedDays: flowState?.durationDays || null });
        // Add a small confirmation in-chat
        pushMessage(chatId, 'assistant', { content: 'Your detailed itinerary is ready — opening the canvas.' });
      } else {
        // Backward-compatibility: render in chat
        pushMessage(chatId, 'assistant', { content: markdown });
      }
      // Move stage to iterate
      setStage('iterate');
      setInputSpec({ type: 'freeText' });
    } catch (e) {
      pushMessage(chatId, 'assistant', `Sorry, I couldn't generate the itinerary. ${e?.message || 'Unknown error.'}`);
    } finally {
      setIsTyping(false);
    }
  };
 

  const pushMessage = (chatId, role, content) => {
    const makeMsg = (role, content) => {
      if (content && typeof content === 'object' && ('text' in content || 'content' in content) && !Array.isArray(content)) {
        const text = content.content || content.text || '';
        return { role, content: text, ...content };
      }
      return { role, content };
    };

    setChats((prev) => {
      // Find the chat to update
      const chat = prev.find(c => c.id === chatId);
      if (!chat) return prev;

      const msgs = Array.isArray(chat.messages) ? [...chat.messages] : [];
      const newMsg = makeMsg(role, content);
      
      // For user messages, always add them
      if (role === 'user') {
        // Prevent duplicate user messages
        if (msgs.length > 0 && 
            msgs[msgs.length - 1].role === 'user' && 
            msgs[msgs.length - 1].content === newMsg.content) {
          return prev;
        }
        msgs.push(newMsg);
      }
      // For assistant messages
      else if (role === 'assistant') {
        // Add assistant messages unless the previous assistant message is truly identical.
        // Previously we only compared the text (`content`) which caused the UI to drop
        // messages that had identical text but different metadata (for example
        // different `nextStage` or updated `inputSpec`). That prevented the chat
        // flow from visibly progressing. We now compare key metadata too.
        const lastAssistantMsg = [...msgs].reverse().find(m => m.role === 'assistant');
        const suggestionsEqual = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
        const inputSpecEqual = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

        const shouldAdd = !lastAssistantMsg
          || lastAssistantMsg.content !== newMsg.content
          || lastAssistantMsg.nextStage !== newMsg.nextStage
          || !suggestionsEqual(lastAssistantMsg.suggestions, newMsg.suggestions)
          || !inputSpecEqual(lastAssistantMsg.inputSpec, newMsg.inputSpec);

        if (shouldAdd) {
          msgs.push(newMsg);
        }
      }

      return prev.map(c => c.id === chatId ? { ...c, messages: msgs } : c);
    });
  };

  // This function is now the single source of truth for sending messages.
  // It correctly uses the component's `stage` state and updates it from the server's `stageNext` response.
  async function sendMessage(text = '', stageOverride = undefined) {
    if (sendingRef.current) {
      return;
    }
    sendingRef.current = true;

    const chatId = activeId;
    const msg = text.trim();
    // Determine stage as early as possible; used in logging/pushMessage metadata
    const stageToSend = stageOverride || stage || 'greeting';

    if (!msg && !stageOverride) {
      sendingRef.current = false;
      return;
    }

    try {
      // Remove unwanted message before dates summary
      if (stage === 'ask_dates' && activeChat?.messages?.length) {
        const lastMsg = activeChat.messages[activeChat.messages.length - 1];
        if (lastMsg?.content?.includes('Pick a start date. I’ll auto-calculate the return date from your days.')) {
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.slice(0, -1) } : c));
        }
      }

      // Add user message
      const prevMessage = activeChat?.messages?.[activeChat.messages.length - 1];
      if (msg && (!prevMessage || prevMessage.role !== 'user' || prevMessage.content !== msg)) {
        // Attach the stage at send time for future edits
        pushMessage(chatId, 'user', { content: msg, stageAtSend: stageToSend });
      }
      setInput('');
      setIsTyping(true);

      if (apiMisconfigured) {
        pushMessage(chatId, 'assistant', {
          content: 'Service is not configured for production. Please set VITE_API_BASE to your live backend URL and redeploy.'
        });
        setIsTyping(false);
        sendingRef.current = false;
        return;
      }
      const token = await getFirebaseIdToken();
      if (!token && currentUser == null && (settings.devMode && settings.useGeminiApi)) {
        pushMessage(chatId, 'assistant', {
          content: 'Please sign in to continue the chat.'
        });
        setIsTyping(false);
        sendingRef.current = false;
        return;
      }
  // stageToSend already computed above

      // Persist destinations/region when using the free-text composer or destination stage
    if (stageToSend === 'input_locations' && msg) {
        const locations = msg.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        if (locations.length) {
          setFlowState(prev => ({ ...prev, locations }));
      // Generate a catchy title via backend
      updateChatTitle({ locations });
        }
      } else if (stageToSend === 'input_region' && msg) {
        const region = msg.trim();
        if (region) {
          setFlowState(prev => ({ ...prev, region }));
      updateChatTitle({ region });
        }
      } else if ((stageToSend === 'destination' || currentQuestionType === 'destination') && msg) {
        const locations = msg.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        if (locations.length) {
          setFlowState(prev => ({ ...prev, locations }));
          updateChatTitle({ locations });
        }
      }

      // Build dynamic chat payload for new backend contract
      const history = (activeChat?.messages || []).map(m => ({
        sender: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : (m?.content?.text || JSON.stringify(m.content))
      }));

      // Ensure lastQuestionType is included in tripState
      const flowToSend = { ...flowState };
      if (currentQuestionType) {
        flowToSend.lastQuestionType = currentQuestionType;
      }

      const payload = {
        userMessage: msg,
        currentTripState: flowToSend,
        chatHistory: history,
      };

      if (settings.devMode && !settings.useGeminiApi) {
        // Simulate a small delay and return a local response
        await new Promise(r => setTimeout(r, 300));
        const data = devMockReply({ stage: stageToSend, message: msg, state: { ...flowState } });
        // Update stage/input as real handler does
        if (data?.stageNext && data.stageNext !== stage) setStage(data.stageNext);
        if (data?.input) setInputSpec(data.input);
        if (Array.isArray(data?.quickOptions)) setQuickOptions(data.quickOptions);
        else if (Array.isArray(data?.input?.options)) setQuickOptions(data.input.options);
        if (data?.state) setFlowState(prev => ({ ...prev, ...data.state }));
        const assistantMsg = {
          content: data?.reply || data?.message,
          currentStage: data?.stageNext || stage,
          nextStage: data?.stageNext,
          inputSpec: data?.input,
        };
        pushMessage(chatId, 'assistant', assistantMsg);
        setIsTyping(false);
        sendingRef.current = false;
        return;
      }

      let res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401 || res.status === 403) {
        const fresh = await getFirebaseIdToken(true);
        if (fresh) {
          res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` },
            body: JSON.stringify(payload),
          });
        }
      }

      if (!res.ok) {
        const t = await res.text();
        if (res.status === 401) {
          throw new Error('401 Unauthorized — please sign in.');
        }
        throw new Error(`Server responded with ${res.status}: ${t}`);
      }

      // Be robust to accidental HTML (e.g., Hosting rewrite to index.html)
      let data;
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        // If we received HTML, surface a helpful hint instead of a cryptic JSON error
        if (/<!doctype html>/i.test(text) || /<html[\s>]/i.test(text)) {
          pushMessage(chatId, 'assistant', {
            content: 'Unexpected HTML from /api/chat. On Firebase Hosting, ensure you deploy from the repo root so hosting rewrites route /api/** to your Cloud Function. If you deployed from the frontend folder, /api requests are going to index.html.'
          });
          setIsTyping(false);
          sendingRef.current = false;
          return;
        }
        // Try to parse if it was actually JSON without proper content-type
        try { data = JSON.parse(text); }
        catch {
          throw new Error('API returned a non-JSON response.');
        }
      }



      // Remove unwanted summary message if present
      if (activeChat?.messages?.length) {
        const lastMsg = activeChat.messages[activeChat.messages.length - 1];
        if (lastMsg?.content?.includes('Pick a start date. I’ll auto-calculate the return date from your days.')) {
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.slice(0, -1) } : c));
        }
      }

      // New dynamic response handling
  const assistantMessage = data?.assistantMessage || data?.assistantReply || data?.message || '';
  let nextType = data?.nextQuestionType || data?.nextQuestion?.type || null;
  const nextPrompt = data?.nextQuestionPrompt || data?.nextQuestion?.prompt || '';
  const nextCurrent = (data?.nextQuestionCurrentValue !== undefined) ? data?.nextQuestionCurrentValue : (data?.nextQuestion?.currentValue ?? null);
  const newState = data?.newTripState || data?.tripState || null;
  const nextOptions = data?.nextQuestionOptions || data?.nextQuestion?.options || [];
  const nextHints = data?.nextQuestionHints || data?.nextQuestion?.hints || null;

      if (assistantMessage) {
        pushMessage(chatId, 'assistant', { content: assistantMessage });
      }

      if (newState && typeof newState === 'object') {
        setFlowState(newState);
      }
      setLatestHints(nextHints || null);

      // Normalize type for common prompts (map freeText prompts to concrete types)
      if ((!nextType || nextType === 'freeText') && nextPrompt) {
        const p = String(nextPrompt).toLowerCase();
        if (p.includes('budget')) nextType = 'budget';
      }

      // Respect an `input` spec the server may provide (e.g., doorstep choice)
      if (data?.input && typeof data.input === 'object') {
        setInputSpec(data.input);
      }

  setCurrentQuestionType(nextType);
      setCurrentQuestionPrompt(nextPrompt || '');
      setCurrentQuestionCurrentValue(nextCurrent ?? null);
  setCurrentQuestionOptions(Array.isArray(nextOptions) ? nextOptions : []);

      // Persist for next turn
      if (nextType) {
        setFlowState(prev => ({ 
          ...prev, 
          lastQuestionType: nextType,
          lastQuestionPrompt: nextPrompt || '',
          lastQuestionOptions: Array.isArray(nextOptions) ? nextOptions : undefined,
        }));
      }

    } catch (err) {
      pushMessage(chatId, 'assistant', `Sorry, I encountered an error. ${err?.message || ''}`);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  }


  useEffect(() => {
    // This effect is responsible for sending the initial "greeting" message when a new chat is created.
    // It runs when the active chat changes.
    if (activeChat && activeChat.messages.length === 0 && !greetedRef.current.has(activeId)) {
      // We immediately mark this chat ID as "greeted" to prevent this effect from ever running
      // for this chat again.
      greetedRef.current.add(activeId);
      
      // We send a message with an empty text content but a specific 'greeting' stage.
      // The backend will see the 'greeting' stage and know to send the initial welcome message.
      sendMessage('Hello Voyager!', 'greeting');
    }
    // The dependency array ensures this logic re-evaluates ONLY when the active chat instance changes.
    // The guards inside the 'if' statement prevent it from re-sending the greeting.
  }, [activeId, activeChat]);

  // When user clicks a quick option, immediately move to next stage
  const handleQuick = async (opt) => {
    // Prevent any concurrent actions
    if (isTyping || sendingRef.current) {
      console.log('Preventing concurrent quick option click');
      return;
    }

    // Get both the last user and assistant messages
    const messages = activeChat?.messages || [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    // Prevent duplicate submissions
    if (lastUserMsg?.content === opt) {
      console.log('Preventing duplicate quick option submission');
      return;
    }

    // Clear any existing input
    setInput('');

    // Track the current stage to detect if we're stuck
    const currentStage = stage;

    // Special handling for the initial stage transition
    if (currentStage === 'greeting' || currentStage === 'ask_intent') {
      if (opt === 'I have specific locations') {
        await sendMessage(opt, 'input_locations');
      } else if (opt === 'I only know a region') {
        await sendMessage(opt, 'input_region');
      }
      return;
    }

    // For all other options, include the current stage as context
  // For option stages, also echo to flowState when they convey concrete info
  if (currentStage === 'ask_travelers') setFlowState(prev => ({ ...prev, travelers: opt }));
  if (currentStage === 'ask_pace') setFlowState(prev => ({ ...prev, pace: opt }));
  if (currentStage === 'ask_budget') setFlowState(prev => ({ ...prev, budget: opt }));
  await sendMessage(opt, currentStage);
  };
  
  const handleKey = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(input); 
    } 
  };

  const newChat = () => {
    const id = Math.random().toString(36).slice(2, 9);
    const c = { id, title: 'New chat', messages: [], createdAt: Date.now() };
    
    // Reset all states first
    setFlowState({});
    setQuickOptions([]);
    setInputSpec({ type: 'freeText' });
    setStage('greeting');
    setInput('');
    
    // Then update the chat list and active ID
    setChats((p) => [c, ...p]);
    setActiveId(id);
    
    // Clean up any references
    greetedRef.current.delete(id);
    delete lastAssistantStageRef.current[id];
  };

  const deleteChat = (id) => {
    try { greetedRef.current.delete(id); } catch {}
    try { delete lastAssistantStageRef.current[id]; } catch {}
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (next.length) {
          setActiveId(next[0].id);
        } else {
          const nid = Math.random().toString(36).slice(2, 9);
          setActiveId(nid);
          return [{ id: nid, title: 'New chat', messages: [] }];
        }
      }
      return next;
    });
  };

  // Load saved chats & search from localStorage on mount
  useEffect(() => {
    try {
      // Prefer primary key; if absent, migrate from legacy localhost key
      let raw = localStorage.getItem('voyager_chats');
      if (!raw || raw === '[]') {
        const localRaw = localStorage.getItem('voyager_chats_local');
        if (localRaw) {
          raw = localRaw;
          // Migrate to primary key for consistency
          try { localStorage.setItem('voyager_chats', raw); } catch {}
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setChats(parsed);
        } else {
          // Fallback: reconstruct chat stubs from chat index and itinerary associations
          try {
            const idxRaw = localStorage.getItem('voyager_chat_index');
            const idx = idxRaw ? JSON.parse(idxRaw) : [];
            const itRaw = localStorage.getItem('voyager_local_journeys');
            const it = itRaw ? JSON.parse(itRaw) : [];
            const byId = new Map();
            if (Array.isArray(idx)) {
              idx.forEach((e) => { if (e?.id) byId.set(e.id, { id: e.id, title: e.title || 'New chat', messages: [], createdAt: e.createdAt || null }); });
            }
            if (Array.isArray(it)) {
              it.forEach((e) => {
                const cid = e?.chatId;
                if (cid && !byId.has(cid)) byId.set(cid, { id: cid, title: e.title || 'New chat', messages: [], createdAt: null });
              });
            }
            const stubs = Array.from(byId.values());
            if (stubs.length) setChats(stubs);
          } catch { /* ignore */ }
        }
        // Ensure an active chat is selected on first load
        try {
          let aid = localStorage.getItem('voyager_active_chat');
          if (!aid) {
            const aidLocal = localStorage.getItem('voyager_active_chat_local');
            if (aidLocal) {
              aid = aidLocal;
              try { localStorage.setItem('voyager_active_chat', aidLocal); } catch {}
            }
          }
          const pickFrom = (() => {
            try { const r = localStorage.getItem('voyager_chats'); return r ? JSON.parse(r) : null; } catch { return null; }
          })() || [];
          if (!aid && Array.isArray(pickFrom) && pickFrom[0]?.id) {
            setActiveId(pickFrom[0].id);
            localStorage.setItem('voyager_active_chat', pickFrom[0].id);
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
              localStorage.setItem('voyager_active_chat_local', pickFrom[0].id);
            }
          }
        } catch {}
      }
      const s = localStorage.getItem('voyager_search');
      if (s) setSearch(s);
    } catch (e) {
      console.warn('Failed to load local state', e);
    }
  }, []);

  // Load active chat and flow state on mount
  useEffect(() => {
    try {
      // Active chat id with localhost fallback + migration
      let aid = localStorage.getItem('voyager_active_chat');
      if (!aid) {
        const aidLocal = localStorage.getItem('voyager_active_chat_local');
        if (aidLocal) {
          aid = aidLocal;
          try { localStorage.setItem('voyager_active_chat', aidLocal); } catch {}
        }
      }
      if (aid) setActiveId(aid);

      // Flow state with localhost fallback + migration
      let rawFlow = localStorage.getItem('voyager_flow_state');
      if (!rawFlow) {
        const rawFlowLocal = localStorage.getItem('voyager_flow_state_local');
        if (rawFlowLocal) {
          rawFlow = rawFlowLocal;
          try { localStorage.setItem('voyager_flow_state', rawFlowLocal); } catch {}
        }
      }
      if (rawFlow) {
        const parsed = JSON.parse(rawFlow);
        if (parsed && typeof parsed === 'object') setFlowState(parsed);
      }
    } catch {}
  }, []);

  // Persist chats and search to localStorage (always, even in local mode)
  useEffect(() => {
    try {
      localStorage.setItem('voyager_chats', JSON.stringify(chats));
      // Also persist in local mode for dev
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        localStorage.setItem('voyager_chats_local', JSON.stringify(chats));
      }
      // Maintain a lightweight index of chat metadata for quick selection and association
      try {
        const index = chats.map(c => ({ id: c.id, title: c.title || 'New chat', createdAt: c.createdAt || null }));
        localStorage.setItem('voyager_chat_index', JSON.stringify(index));
      } catch {}
    } catch (e) {
      console.error('Failed to save chats:', e);
    }
  }, [chats]);

  useEffect(() => { 
    try { 
      localStorage.setItem('voyager_search', search); 
    } catch (e) {
      console.error('Failed to save search:', e);
    }
  }, [search]);

  // Persist active chat id
  useEffect(() => {
    try {
      localStorage.setItem('voyager_active_chat', activeId);
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        localStorage.setItem('voyager_active_chat_local', activeId);
      }
    } catch {}
  }, [activeId]);

  // Allow other components to programmatically select a chat
  useEffect(() => {
    const onSetActive = (ev) => {
      try {
        const id = ev?.detail?.id;
        if (id && id !== activeId) setActiveId(id);
      } catch {}
    };
    try { window.addEventListener('voyager:setActiveChat', onSetActive); } catch {}
    return () => { try { window.removeEventListener('voyager:setActiveChat', onSetActive); } catch {} };
  }, [activeId]);

  // Persist flow state for continuity across refreshes
  useEffect(() => {
    try {
      localStorage.setItem('voyager_flow_state', JSON.stringify(flowState || {}));
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        localStorage.setItem('voyager_flow_state_local', JSON.stringify(flowState || {}));
      }
    } catch {}
  }, [flowState]);

  // Debounced typeahead for bottom composer when entering destinations
  useEffect(() => {
    const isDestStage = stage === 'input_locations' && inputSpec?.type === 'freeText';
    const last = (String(input || '').split(/[\n,]+/).pop() || '').trim();
    if (!isDestStage || last.length < 2) { setInputSuggestions([]); setInputSuggestOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        inputSuggestAbortRef.current?.abort();
        const ctrl = new AbortController();
        inputSuggestAbortRef.current = ctrl;
        const token = await getFirebaseIdToken();
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/api/destinations/suggest?q=${encodeURIComponent(last)}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`suggest ${res.status}`);
        const arr = await res.json();
        setInputSuggestions(Array.isArray(arr) ? arr : []);
        setInputSuggestOpen(true);
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('composer typeahead', e?.message);
        setInputSuggestions([]);
        setInputSuggestOpen(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [input, stage, inputSpec?.type]);

  // capitalization handled via shared helpers in ../lib/format

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle copy functionality
  const handleCopy = (content) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(content).then(() => {
        showToast('Copied');
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };

  // Handle regenerate functionality
  const handleRegenerate = async () => {
    if (!activeChat?.messages?.length) return;
    
    // Find the last user message
    const lastUserMsgIndex = activeChat.messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return;
    
    const lastUserMsg = activeChat.messages[lastUserMsgIndex];
    
    // Remove messages after the last user message
    setChats(prev => prev.map(c => {
      if (c.id !== activeId) return c;
      return {
        ...c,
        messages: c.messages.slice(0, lastUserMsgIndex + 1)
      };
    }));
    
    // Resend the message
    await sendMessage(lastUserMsg.content);
    try {
      // Fire-and-forget feedback event
      fetch(`${base}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', messageIndex: lastUserMsgIndex, chatId: activeId })
      }).catch(() => {});
    } catch {}
  };

  // React to assistant message (like/dislike)
  const handleReact = (idx, reaction) => {
    setChats(prev => prev.map(c => {
      if (c.id !== activeId) return c;
      const msgs = [...(c.messages || [])];
      if (!msgs[idx] || msgs[idx].role !== 'assistant') return c;
      msgs[idx] = { ...msgs[idx], reaction };
      return { ...c, messages: msgs };
    }));
    try {
      const msg = activeChat?.messages?.[idx];
      const snippet = (msg?.content || '').slice(0, 200);
      fetch(`${base}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reaction, messageIndex: idx, chatId: activeId, messageSnippet: snippet, stage })
      }).catch(() => {});
      showToast(reaction === 'like' ? 'Thanks for the feedback' : 'We’ll improve');
    } catch {}
  };

  // Edit a user message: trim following messages, reset stage, and re-ask the question
  const handleEditUserMessage = async (idx) => {
    const messages = activeChat?.messages || [];
    const msg = messages[idx];
    if (!msg || msg.role !== 'user') return;
    const stageToReask = msg.stageAtSend || 'greeting';
    // Trim messages up to the message (exclude it so user can rewrite)
    setChats(prev => prev.map(c => {
      if (c.id !== activeId) return c;
      return { ...c, messages: c.messages.slice(0, idx) };
    }));
    // Reset flow state to avoid conflicts beyond this point
    setFlowState({});
    // Pre-fill the composer with the original text for editing
    setInput(String(msg.content || ''));
    // Ask the question again via backend or mocks
    try {
      await sendMessage('', stageToReask);
    } catch {}
    try {
      const msgSnippet = String(msg.content || '').slice(0, 200);
      fetch(`${base}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', messageIndex: idx, chatId: activeId, messageSnippet: msgSnippet, stage: stageToReask })
      }).catch(() => {});
    } catch {}
  };

  return (
    <div className="relative h-screen w-full text-white bg-transparent">
      <div className="flex min-h-0">
          {/* Sidebar: collapsible with animation; when canvas is open it will be controlled from canvas header */}
        <motion.aside
          animate={{ width: isSidebarOpen ? 280 : 60 }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          className={`border-r border-white/8 bg-gradient-to-b from-black/30 to-black/20 backdrop-blur-xl px-3 py-4 flex flex-col items-stretch min-h-0 overflow-hidden`}
          style={{ height: '100vh' }}
        >
          {/* Sidebar header */}
          <div className={`mb-3 px-1 ${isSidebarOpen ? 'block' : 'flex flex-col items-center gap-2'}`}>
            {isSidebarOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-md text-white/80 hover:bg-white/10"
                    title="Collapse"
                    onClick={() => setIsSidebarOpen && setIsSidebarOpen(false)}
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2 rounded-md text-white/80 hover:bg-white/10"
                    title="Home"
                    onClick={() => { try { navigate('/'); window.dispatchEvent(new CustomEvent('voyager:goHome')); } catch { navigate('/'); } }}
                  >
                    <HomeIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-4 flex flex-col items-center text-center px-0">
                  <img src="/logo-secondary.png" alt="Voyager brand" className="h-16 w-16 rounded-full object-contain" />
                  <div className="mt-3">
                    <div className="text-3xl font-semibold tracking-tight leading-tight">Voyager.ai</div>
                    <div className="text-sm text-white/70 mt-1">Welcome, {funNick || firstName || 'Traveler'}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button
                  className="p-2 rounded-md text-white/80 hover:bg-white/10"
                  title="Expand"
                  onClick={() => setIsSidebarOpen && setIsSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button
                  className="p-2 rounded-md text-white/80 hover:bg-white/10"
                  title="Home"
                  onClick={() => { try { navigate('/'); window.dispatchEvent(new CustomEvent('voyager:goHome')); } catch { navigate('/'); } }}
                >
                  <HomeIcon className="w-5 h-5" />
                </button>
                <button
                  className="p-1.5 rounded-lg text-white/90 hover:bg-white/10"
                  title="Expand"
                  onClick={() => setIsSidebarOpen && setIsSidebarOpen(true)}
                >
                  <img src="/logo-secondary.png" alt="Voyager" className="h-9 w-9 rounded-full object-contain" />
                </button>
              </>
            )}
          </div>

          {/* Search (icon-only in collapsed mode) */}
          <div className="w-full mb-4">
            {isSidebarOpen ? (
              !searchOpen ? (
                <div 
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 60); }} 
                  className="flex items-center gap-2 text-sm text-white/80 cursor-text select-none px-1"
                  title="Search chats"
                >
                  <span className="text-base">🔎</span>
                  <span>Search chats</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1">
                  <Search className="w-4 h-4 text-white/70" />
                  <input 
                    ref={searchRef} 
                    placeholder="Search chats" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="bg-transparent outline-none text-sm text-white/80 w-full" 
                  />
                  <button 
                    onClick={() => { setSearch(''); setSearchOpen(false); }} 
                    className="text-white/60 hover:text-white/80 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsSidebarOpen && setIsSidebarOpen(true)}
                  className="p-2 rounded-md text-white/80 hover:bg-white/10"
                  title="Open search"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="w-full mb-4">
            <button 
              onClick={newChat} 
              className={`w-full rounded-lg bg-gradient-to-r from-[#16a34a] to-[#10b981] ${isSidebarOpen ? 'px-4 py-2 text-sm' : 'p-2'} font-semibold text-black shadow-sm hover:shadow-md transition-shadow flex items-center justify-center`}
              title="New Journey"
            >
              {isSidebarOpen ? '+ New Journey' : '+'}
            </button>
          </div>

          <div className="w-full border-t border-white/6 pt-3 mt-2 space-y-2 overflow-y-auto flex-1 min-h-0">
            {(() => {
              // Only filter when the search UI is open and a query is present
              const q = searchOpen ? search.trim().toLowerCase() : '';
              const visible = q ? chats.filter((c) => (c.title || '').toLowerCase().includes(q)) : chats;
              return visible.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg ${isSidebarOpen ? 'px-2 py-1.5 text-sm' : 'p-2'} transition-colors flex items-center ${
                    isSidebarOpen ? 'justify-between' : 'justify-center'
                  } ${c.id === activeId ? 'bg-white/6 text-white' : 'text-white/70 hover:bg-white/3'}`}
                  title={c.title}
                >
                  <button
                    className={`${isSidebarOpen ? 'flex-1 text-left truncate' : 'flex items-center justify-center w-full'}`}
                    onClick={() => setActiveId(c.id)}
                  >
                    {isSidebarOpen ? (
                      <span className="truncate block pr-2">{c.title}</span>
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </button>
                  {isSidebarOpen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const confirmDelete = c.messages?.length ? confirm('Delete this chat? This cannot be undone.') : true;
                        if (confirmDelete) deleteChat(c.id);
                      }}
                      title="Delete chat"
                      className="ml-2 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ));
            })()}
          </div>

          {/* My Itineraries: open a semi-transparent overlay list */}
          <div className="w-full mt-4 pt-3 border-t border-white/6">
            <div className={`${isSidebarOpen ? 'px-1' : 'flex items-center justify-center'}`}>
              <button
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('voyager:openItineraryList')); } catch {}
                }}
                className={`${isSidebarOpen ? 'w-full px-2 py-1.5 text-left rounded-md bg-white/5 hover:bg-white/10' : 'p-2 rounded-md bg-white/5 hover:bg-white/10'}`}
                title="My Itineraries"
              >
                <span className="inline-flex items-center gap-2 text-white/80 text-sm">
                  <Calendar className="w-4 h-4 text-white/70" />
                  {isSidebarOpen ? 'My Itineraries' : ''}
                </span>
              </button>
            </div>
          </div>

          {/* Profile / Logout at bottom */}
          <div className={`w-full mt-4 pt-3 border-t border-white/6 flex items-center gap-3 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className={`flex items-center ${isSidebarOpen ? 'gap-3 w-full' : 'justify-center w-full'}`}>
              <Avatar role="user" name={currentUser?.displayName || currentUser?.email || ''} size={isSidebarOpen ? 44 : 40} />
              {isSidebarOpen && (
                <div className="text-sm flex-1 min-w-0">
                  <div className="font-medium truncate">{shortName}</div>
                  <div className="text-xs text-white/60">{currentUser ? 'Member' : 'Not signed in'}</div>
                </div>
              )}
              {isSidebarOpen && (
                <button
                  onClick={() => { try { window.history.pushState({}, '', '/profile'); window.dispatchEvent(new PopStateEvent('popstate')); } catch { window.location.href = '/profile'; } }}
                  title="Profile"
                  className="ml-auto rounded-md p-2 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Profile
                </button>
              )}
              {isSidebarOpen && currentUser && (
                <button
                  onClick={() => { try { signOut(auth); } catch (e) { console.error('Sign out error:', e); } }}
                  title="Log out"
                  className="ml-auto rounded-md p-2 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
  </motion.aside>

        {/* Main chat area: full-height flex column so input stays at bottom */}
        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0" style={{ height: '100vh' }}>
          {/* Connection/auth status banner */}
          {(apiMisconfigured && !(settings.devMode && !settings.useGeminiApi)) && (
            <div className="mx-auto max-w-3xl mt-3 mb-0 p-3 rounded-lg border border-yellow-400/40 bg-yellow-500/10 text-yellow-100 text-xs">
              Backend not configured for production. Set VITE_API_BASE to your live API URL before building and deploying.
            </div>
          )}
          {(settings.devMode && !settings.useGeminiApi) && (
            <div className="mx-auto max-w-3xl mt-3 mb-0 p-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 text-xs">
              Mock mode: Gemini API calls are disabled. Using local responses.
            </div>
          )}
          <div
            className="flex-1 overflow-y-auto p-8 min-h-0"
            style={{
              // very subtle starlight-style highlight: faint radial dots and inset glow
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '220px 220px',
              boxShadow: 'inset 0 0 40px rgba(255,255,255,0.01)'
            }}
          >
            <div className="mx-auto max-w-3xl pt-2">
        {activeChat?.messages?.map((m, i) => (
                <div key={i}>
          <ChatMessage index={i} message={m} userName={fullNameOrEmail} onCopy={handleCopy} onRegenerate={handleRegenerate} onReact={handleReact} onEdit={handleEditUserMessage} />
                </div>
              ))}

              {isTyping && (
                <div className="my-4 flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/6 border border-white/10 overflow-hidden">
                      <img src="/logo.png" alt="Voyager" className="h-8 w-8 object-contain animate-pulse" />
                    </div>
                  <div className="w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/6 backdrop-blur-md border border-white/10 text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Composer pinned to bottom inside the main column */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pointer-events-none" style={{ paddingBottom: '8px' }}>
            <div className="pointer-events-auto max-w-3xl w-full px-4">
              {(settings.devMode && settings.showAutoChatButton) && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={async () => {
                      // A fast demo script to auto-walk through the flow
                      if (sendingRef.current) return;
                      const flow = async () => {
                        // Local-first deterministic flow
                        await sendMessage('Start at the destination'); // doorstepChoice
                        await new Promise(r => setTimeout(r, 200));
                        await sendMessage('Palitana'); // destination
                        await new Promise(r => setTimeout(r, 200));
                        await sendMessage('3'); // duration days
                        await new Promise(r => setTimeout(r, 200));
                        const start = '2025-10-01';
                        const end = '2025-10-03';
                        await sendMessage(`${start} to ${end}`); // dates range
                        await new Promise(r => setTimeout(r, 200));
                        await sendMessage('2'); // travelers
                        await new Promise(r => setTimeout(r, 200));
                        await sendMessage('yes'); // confirm
                        await new Promise(r => setTimeout(r, 200));
                        await generateItineraryDirect(); // generate
                      };
                      try { await flow(); } catch {}
                    }}
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-xs"
                    title="Auto walk-through"
                  >
                    ▶ Auto Chat
                  </button>
                </div>
              )}
              <AnimatePresence mode="wait">
                {currentQuestionType ? (
                  <motion.div 
                    key={`dyn-${currentQuestionType}`}
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 30 }} 
                    transition={{ duration: 0.18 }}
                  >
                    <div className="rounded-xl bg-white/5 backdrop-blur-md p-4 border border-white/10">
                      {currentQuestionPrompt ? (
                        <div className="text-white/80 text-sm mb-3">{currentQuestionPrompt}</div>
                      ) : null}

                      {/* doorstepChoice / multiChoice */}
                      {(currentQuestionType === 'doorstepChoice' || (currentQuestionType === 'multiChoice' && currentQuestionOptions.length > 0)) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(currentQuestionOptions.length ? currentQuestionOptions : ['Start from my doorstep','Start at the destination']).map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => sendMessage(String(opt))}
                              disabled={isTyping}
                              className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 text-sm text-left"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* destination/freeText */}
                      {(currentQuestionType === 'destination' || currentQuestionType === 'freeText' || currentQuestionType === 'budget') && (
                        <div className="flex items-start gap-3 relative">
                          <TextareaAutosize
                            value={dynText}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (currentQuestionType === 'destination') {
                                val = capitalizeLocationSegments(val);
                              }
                              setDynText(val);
                            }}
                            minRows={1}
                            maxRows={6}
                            placeholder={currentQuestionPrompt || 'Type your answer...'}
                            className="w-full resize-none bg-transparent py-3 px-4 text-gray-200 placeholder-gray-400 outline-none text-sm rounded-lg border border-white/10"
                            disabled={isTyping}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                const v = (currentQuestionType === 'destination' ? dynText.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).join(', ') : dynText).trim();
                                if (v) { sendMessage(v); setDynText(''); }
                              }
                            }}
                          />
                          {/* Typeahead dropdown */}
                          {currentQuestionType === 'destination' && dynSuggestOpen && dynSuggestions.length > 0 && (
                            <div className="absolute left-0 right-14 bottom-full mb-2 max-h-56 overflow-auto rounded-lg border border-white/15 bg-black/70 backdrop-blur-md z-40 shadow-xl">
                              {dynSuggestions.map((opt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    const parts = dynText.split(/[\n,]+/);
                                    parts[parts.length - 1] = ` ${opt}`;
                                    const out = parts.filter(Boolean).join(', ').replace(/\s+,/g, ',');
                                    setDynText(out.trim());
                                    setDynSuggestOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                >{opt}</button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const v = (currentQuestionType === 'destination' ? dynText.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).join(', ') : dynText).trim();
                              if (v) { sendMessage(v); setDynText(''); }
                            }}
                            disabled={isTyping || !dynText.trim()}
                            className="ml-auto rounded-full bg-[#19c37d] px-4 py-2 text-black font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      )}

                      {/* duration */}
                      {currentQuestionType === 'duration' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4">
                              <button onClick={() => setDynDays(d => Math.max(1, d - 1))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl">−</button>
                              <div className="text-2xl font-bold text-white min-w-[4rem] px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-center">{dynDays}</div>
                              <button onClick={() => setDynDays(d => d + 1)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl">+</button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {[2,3,4,5,7,10,14].map((d) => (
                                <button
                                  key={d}
                                  onClick={() => { setDynDays(d); sendMessage(String(d)); }}
                                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs border border-white/15"
                                  disabled={isTyping}
                                >{d} days</button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => sendMessage(String(dynDays))}
                            className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
                          >Continue</button>
                        </div>
                      )}

                      {/* dates */}
                      {currentQuestionType === 'dates' && (
                        <div className="space-y-4">
                          {/* Suggested months */}
                          <div className="flex items-center flex-wrap gap-2">
                            {(() => {
                              const today = new Date();
                              const suggestions = [];
                              for (let i = 0; i < 6; i++) {
                                const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(2,'0');
                                const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
                                suggestions.push({ y, m, label });
                              }
                              const knownDays = parseInt(flowState?.durationDays || flowState?.duration, 10);
                              return suggestions.map(({ y, m, label }) => (
                                <button
                                  key={`${y}-${m}`}
                                  onClick={() => {
                                    const start = `${y}-${m}-01`;
                                    setDynStartDate(start);
                                    if (!Number.isNaN(knownDays) && knownDays > 1) {
                                      const s = new Date(start);
                                      const e = new Date(s);
                                      e.setDate(s.getDate() + (knownDays - 1));
                                      const ey = e.getFullYear();
                                      const em = String(e.getMonth() + 1).padStart(2,'0');
                                      const ed = String(e.getDate()).padStart(2,'0');
                                      setDynEndDate(`${ey}-${em}-${ed}`);
                                    } else {
                                      setDynEndDate('');
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs border border-white/15"
                                  disabled={isTyping}
                                >{label}</button>
                              ));
                            })()}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-white/70 mb-1">Start Date</label>
                              <input type="date" value={dynStartDate} onChange={e => {
                                const v = e.target.value; setDynStartDate(v);
                                // Auto-suggest end date if duration known and end not set
                                const days = parseInt(flowState?.durationDays || flowState?.duration, 10);
                                if (v && !dynEndDate && !Number.isNaN(days) && days > 1) {
                                  const start = new Date(v);
                                  const end = new Date(start);
                                  end.setDate(start.getDate() + (days - 1));
                                  const y = end.getFullYear();
                                  const m = String(end.getMonth() + 1).padStart(2,'0');
                                  const d = String(end.getDate()).padStart(2,'0');
                                  setDynEndDate(`${y}-${m}-${d}`);
                                }
                              }} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-white/70 mb-1">End Date</label>
                              <input type="date" value={dynEndDate} onChange={e => setDynEndDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none" />
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const msgOut = dynStartDate && dynEndDate ? `${dynStartDate} to ${dynEndDate}` : (dynStartDate || dynEndDate || '');
                              if (msgOut) sendMessage(msgOut);
                            }}
                            disabled={!dynStartDate && !dynEndDate}
                            className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all"
                          >Confirm Dates</button>
                        </div>
                      )}

                      {/* travelers */}
                      {currentQuestionType === 'travelers' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-4">
                            <button onClick={() => setDynTravelers(n => Math.max(1, n - 1))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl">−</button>
                            <div className="text-2xl font-bold text-white min-w-[4rem] px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-center">{dynTravelers}</div>
                            <button onClick={() => setDynTravelers(n => n + 1)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl">+</button>
                          </div>
                          <button
                            onClick={() => sendMessage(String(dynTravelers))}
                            className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
                          >Continue</button>
                        </div>
                      )}

                      {/* confirm */}
                      {currentQuestionType === 'confirm' && (
                        <div className="space-y-4">
                          <ConfirmSummary flowState={flowState} />
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => sendMessage('yes')} className="px-6 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold">Yes, Confirm</button>
                            <button onClick={() => sendMessage('no')} className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold">No, Revise</button>
                          </div>
                        </div>
                      )}

                      {/* done */}
                      {currentQuestionType === 'done' && (
                        <div className="flex justify-center">
                          <button onClick={generateItineraryDirect} className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold hover:from-purple-600 hover:to-purple-700 transition-all">Generate Itinerary</button>
                        </div>
                      )}

                      {/* generate */}
                      {currentQuestionType === 'generate' && (
                        <div className="flex justify-center">
                          <button onClick={generateItineraryDirect} className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold hover:from-purple-600 hover:to-purple-700 transition-all">Generate Itinerary</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : inputSpec && (inputSpec.type === 'options' || inputSpec.type === 'multiselect' || inputSpec.type === 'dates' || inputSpec.type === 'days') ? (
                  <motion.div 
                    key={stage} 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 30 }} 
                    transition={{ duration: 0.18 }}
                  >
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <StageInput
                        inputSpec={inputSpec}
                        quickOptions={quickOptions}
                        flowState={flowState}
                        setFlowState={(s) => setFlowState(s)}
                        stage={stage}
                        hints={latestHints}
                        onSubmit={async (value) => {
                          // Accept either a raw string or an object { value, stageOverride }
                          let messageText = value;
                          let stageOverride;
                          if (typeof value === 'object' && value !== null && 'value' in value) {
                            messageText = value.value;
                            stageOverride = value.stageOverride;
                          }
                          messageText = typeof messageText === 'string' ? messageText : JSON.stringify(messageText);

                            // Special-case: for the initial intent buttons, don't send the literal label
                            // to the backend as user input when advancing to input stages. Otherwise the
                            // server (or our own pre-processing) may treat the label as a real location/region
                            // and skip the expected free-text prompt.
                            const normalized = messageText.trim().toLowerCase();
                            if (stageOverride === 'input_locations' && normalized === 'i have specific locations') {
                              // Echo choice and advance locally to the locations input prompt without hitting the backend yet
                              pushMessage(activeId, 'user', 'I have specific locations');
                              setStage('input_locations');
                              setInputSpec({ type: 'freeText', placeholder: 'Type cities/places (comma-separated)…' });
                              setQuickOptions([]);
                              // Add an assistant prompt so the UI shows the follow-up question
                              pushMessage(activeId, 'assistant', {
                                content: 'Please share your destinations (comma-separated). For example: Paris, Lyon',
                                nextStage: 'input_locations',
                                inputSpec: { type: 'freeText', placeholder: 'Type cities/places (comma-separated)…' }
                              });
                              return;
                            }
                            if (stageOverride === 'input_region' && normalized === 'i only know a region') {
                              pushMessage(activeId, 'user', 'I only know a region');
                              setStage('input_region');
                              setInputSpec({ type: 'freeText', placeholder: 'Type a region, e.g., Southern France' });
                              setQuickOptions([]);
                              pushMessage(activeId, 'assistant', {
                                content: 'Which region are you considering? (e.g., Southern France)',
                                nextStage: 'input_region',
                                inputSpec: { type: 'freeText', placeholder: 'Type a region, e.g., Southern France' }
                              });
                              return;
                            }
                          if (messageText === 'Generate itinerary') {
                            await generateItineraryDirect();
                          } else {
                            await sendMessage(messageText, stageOverride);
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="text-input" 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 30 }} 
                    transition={{ duration: 0.18 }}
                  >
                    {/* Finalize details helper: show a centered proceed button while keeping free text input */}
                    {stage === 'finalize_details' && inputSpec?.proceedOption ? (
                      <div className="flex justify-center mb-3">
                        <button
                          onClick={() => sendMessage(inputSpec.proceedOption, 'finalize_details')}
                          className="px-6 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
                        >
                          {inputSpec.proceedOption}
                        </button>
                      </div>
                    ) : null}
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3 flex items-start gap-3 relative" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <TextareaAutosize 
                        value={input} 
                        onChange={(e) => {
                          let val = e.target.value;
                          if (stage === 'input_locations' && inputSpec?.type === 'freeText') {
                            // Auto-capitalize first letter of each word per segment
                            val = capitalizeLocationSegments(val);
                          }
                          setInput(val);
                        }} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const msg = (stage === 'input_locations' ? input.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).join(', ') : input);
                            sendMessage(msg);
                          }
                        }} 
                        minRows={1} 
                        maxRows={6} 
                        placeholder={inputSpec?.placeholder || (stage === 'finalize_details' ? 'Any must-sees or things to avoid? (optional) — or press No, Proceed' : 'Type your message...')} 
                        className="w-full resize-none bg-transparent py-3 pl-4 pr-24 text-gray-200 placeholder-gray-400 outline-none text-sm" 
                        disabled={isTyping}
                      />
                      {stage === 'input_locations' && inputSuggestOpen && inputSuggestions.length > 0 && (
                        <div className="absolute left-4 right-24 bottom-full mb-2 max-h-56 overflow-auto rounded-lg border border-white/15 bg-black/70 backdrop-blur-md z-40 shadow-xl">
                          {inputSuggestions.map((opt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const parts = input.split(/[\n,]+/);
                                parts[parts.length - 1] = ` ${opt}`;
                                const out = parts.filter(Boolean).join(', ').replace(/\s+,/g, ',');
                                setInput(out.trim());
                                setInputSuggestOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                            >{opt}</button>
                          ))}
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          const msg = (stage === 'input_locations' ? input.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).join(', ') : input);
                          sendMessage(msg);
                        }} 
                        disabled={isTyping || !input.trim()} 
                        className="ml-auto rounded-full bg-[#19c37d] px-4 py-2 text-black font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
      {/* Lightweight toast container */}
      <div id="toast-root" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] space-y-2"></div>
    </div>
  );
}